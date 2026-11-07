const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const source = ts.createSourceFile('PostDatabase.ts',
    fs.readFileSync(path.join(root, 'server/src/PostDatabase.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
const selected = ['insertWorldModelSQL', 'isWorldOwnedImage', 'isWorldImageSource', 'readWorldPlan', 'createWorldModel', 'getAllWorldsWithCharacters'];
const declarations = source.statements.filter(node => {
    if (ts.isFunctionDeclaration(node)) return selected.includes(node.name?.text);
    return ts.isVariableStatement(node) && node.declarationList.declarations.some(decl => selected.includes(decl.name.getText(source)));
});
const { outputText } = ts.transpileModule(declarations.map(node => node.getText(source)).join('\n'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});

function fixture({ oldSchema = false, badRevision = false, newAsset = false } = {}) {
    const originalImage = 'https://legacy.example.invalid/terra.png';
    const writes = [];
    const copies = [];
    const asset = { id: 32, image: originalImage };
    const world = { id: 11, catalog_revision: 0 };
    const schemaError = Object.assign(new Error('Missing additive column'), { code: 'ER_BAD_FIELD_ERROR' });
    const legacyPlan = 'Legacy plain-text story plan';
    const query = async (sql, params) => {
        if (sql.includes('LIMIT 0')) {
            if (oldSchema) throw schemaError;
            return [];
        }
        if (sql.includes('SELECT c.id, c.image') || sql.includes('SELECT id, image FROM characters')) return [asset];
        if (sql.includes('SELECT id, catalog_revision FROM world_models')) return [world];
        if (sql.includes('SELECT COUNT(*)')) return [{ total: 1 }];
        if (sql.includes('LEFT JOIN characters')) {
            if (oldSchema && sql.includes('c.asset_type')) throw schemaError;
            return [{ id: 11, userid: 7, title: 'Legacy World', planx: legacyPlan,
                char_id: 32, char_name: 'Terra', char_description: 'Legacy description', char_image: originalImage }];
        }
        writes.push([sql, params]);
        return { insertId: 11 };
    };
    const storageUrl = value => typeof value === 'string' && value.startsWith('https://app.example.invalid/')
        ? value.replace('https://app.example.invalid/', 's3://app/') : null;
    const dependencies = {
        authenticatedUserId: () => '7',
        execQuery: query,
        withTransaction: callback => callback(query),
        postMediaStorageUrl: storageUrl,
        copyPublicWorldImage: async (url, purpose) => {
            copies.push([url, purpose]);
            return url.replace('app.example.invalid/', 'app.example.invalid/independent-');
        },
        queueTemplateAssetCleanup: async url => assert.fail(`Unexpected cleanup of ${url}`),
        drainTemplateAssetCleanup: async () => {},
    };
    const routes = new Function('exports', ...Object.keys(dependencies),
        `${outputText}\nreturn { createWorldModel, getAllWorldsWithCharacters };`)({}, ...Object.values(dependencies));
    const response = { statusCode: 200, status(value) { this.statusCode = value; return this; },
        json(value) { this.body = value; return this; }, send(value) { this.body = value; return this; } };
    const request = { body: { worldId: 11, revision: badRevision ? 1 : 0, title: 'Edited World',
        description: 'Updated summary', blueprint: 'Story notes', assets: [
            { id: 32, image: originalImage, kind: 'character', name: 'Terra', description: 'Legacy description' },
            ...(newAsset ? [{ kind: 'environment', name: 'Workshop', description: 'Timber frame',
                image: 'https://app.example.invalid/workshop.png' }] : []),
        ] } };
    return { routes, response, request, writes, copies, originalImage, legacyPlan };
}

test('an unmigrated World catalogue reads legacy rows and plain-text plans without writing anything', async () => {
    const { routes, response, writes, copies, originalImage, legacyPlan } = fixture({ oldSchema: true });
    await routes.getAllWorldsWithCharacters({ query: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data[0].catalog_revision, 0);
    assert.equal(response.body.data[0].planx, legacyPlan);
    assert.deepEqual(response.body.data[0].characters, [
        { id: 32, kind: 'character', name: 'Terra', description: 'Legacy description', image: originalImage },
    ]);
    assert.deepEqual([writes, copies], [[], []]);
});

test('first edit keeps the legacy asset ID and URL and copies only the added image', async () => {
    const { routes, response, request, writes, copies, originalImage } = fixture({ newAsset: true });
    await routes.createWorldModel(request, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(copies, [['https://app.example.invalid/workshop.png', 'world-environment']]);
    assert.deepEqual(writes.find(([sql]) => sql.startsWith('UPDATE characters'))[1],
        ['Terra', 'Legacy description', originalImage, 'character', 32, 11]);
    assert.deepEqual(writes.find(([sql]) => sql.startsWith('INSERT INTO characters'))[1],
        [11, 'Workshop', 'Timber frame', 'https://app.example.invalid/independent-workshop.png', 'environment']);
});

test('missing schema and stale revision reject a save before storage or row writes', async () => {
    for (const [options, expected] of [[{ oldSchema: true }, 503], [{ badRevision: true }, 409]]) {
        const { routes, response, request, writes, copies } = fixture({ ...options, newAsset: true });
        await routes.createWorldModel(request, response);
        assert.equal(response.statusCode, expected);
        assert.deepEqual([writes, copies], [[], []]);
    }
});

test('World copies require public image access and bind to the inspected object version', async () => {
    const storage = ts.createSourceFile('S3Routes.ts',
        fs.readFileSync(path.join(root, 'server/src/S3Routes.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
    const declaration = storage.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'copyPublicWorldImage');
    const { outputText } = ts.transpileModule(declaration.getText(storage), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const copied = [];
    let readable = false;
    let type = 'image/png';
    const dependencies = {
        postMediaStorageUrl: () => 's3://app/story frames/terra.png',
        parseS3Uri: () => ({ Bucket: 'app', Key: 'story frames/terra.png' }),
        getPublicS3Url: key => `https://app.s3.example.invalid/${key}`,
        NormalizeImageError: Error,
        NORMALIZE_IMAGE_TIMEOUT_MS: 200,
        NORMALIZE_IMAGE_MAX_BYTES: 100,
        normalizeImageContentType: value => value,
        isSupportedRaster: value => value === 'image/png',
        fetch: async (url, options) => {
            assert.equal(url, 'https://app.s3.example.invalid/story%20frames/terra.png');
            assert.equal(options.method, 'HEAD');
            assert.equal(options.redirect, 'error');
            assert.equal(options.headers, undefined);
            const headers = new Map([['content-type', type], ['content-length', '42'], ['etag', '"same-version"']]);
            return { ok: readable, headers };
        },
        createNormalizedImageKey: async () => 'world-character-independent.png',
        s3Client: { send: async command => copied.push(command.input) },
        CopyObjectCommand: class { constructor(input) { this.input = input; } },
    };
    const copy = new Function('exports', ...Object.keys(dependencies),
        `${outputText}\nreturn copyPublicWorldImage;`)({}, ...Object.values(dependencies));
    await assert.rejects(copy('https://app.example.invalid/terra.png', 'world-character'), /readable image/);
    readable = true;
    type = 'image/svg+xml';
    await assert.rejects(copy('https://app.example.invalid/terra.png', 'world-character'), /readable image/);
    assert.deepEqual(copied, []);
    type = 'image/png';
    assert.equal(await copy('https://app.example.invalid/terra.png', 'world-character'),
        'https://app.s3.example.invalid/world-character-independent.png');
    assert.equal(copied[0].CopySourceIfMatch, '"same-version"');
    assert.equal(copied[0].CopySource, 'app/story%20frames/terra.png');
});
