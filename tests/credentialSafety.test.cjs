const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(file, mocks = {}, cache = new Map()) {
    const filename = path.resolve(root, file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module);
    cache.set(filename, mod); mod.filename = filename;
    mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.')
        ? load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')), mocks, cache)
        : Module.prototype.require.call(mod, name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText, filename);
    return mod.exports;
}

// Use an isolated fixture signing key and disable dotenv loading. Production
// credentials, storage and database connections are never used by this suite.
const fixtureKey = 'local-credential-safety-fixture-key-only';
const previousKey = process.env.SECRET_KEYY;
let tokens;
try {
    process.env.SECRET_KEYY = fixtureKey;
    tokens = load('server/src/jwtUtils.ts', { dotenv: { config() {} } });
} finally {
    if (previousKey === undefined) delete process.env.SECRET_KEYY;
    else process.env.SECRET_KEYY = previousKey;
}
const auth = load('server/src/requestAuth.ts', { './jwtUtils': tokens });
const jwt = require(require.resolve('jsonwebtoken', { paths: [path.join(root, 'server')] }));
const valid = tokens.generateToken('42');
const invalid = [
    undefined,
    'malformed-token',
    jwt.sign({ id: '42' }, 'a-different-fixture-key'),
    jwt.sign({ id: '42' }, fixtureKey, { expiresIn: -1 }),
    jwt.sign({ id: '42' }, null, { algorithm: 'none' }),
    ...['0', '-1', 'someone-else'].map(id => jwt.sign({ id }, fixtureKey)),
];
const request = (token, body = {}) => ({
    method: 'PUT', cookies: token ? { authToken: token } : {},
    headers: { authorization: 'Bearer ' + valid }, body,
    query: { postId: 7, userId: 42 },
});
async function invoke(handler, req) {
    let status = 200, body;
    const res = {
        status(value) { status = value; return this; },
        json(value) { body = value; return this; },
    };
    await handler(req, res);
    return { status, body };
}

test('actual JWT authentication accepts the signed cookie and rejects invalid identities and tokens', () => {
    assert.equal(auth.authenticatedUserId(request(valid)), '42');
    assert.equal(auth.authenticatedUserId(request(tokens.generateToken('1'))), '1');
    for (const token of invalid) {
        const req = request(token, { userId: 42, authenticatedUserId: '42', authToken: valid });
        assert.equal(auth.authenticatedUserId(req), null);
        let rejected, next = false;
        auth.requireAuthenticatedRequest(req, {
            status(code) { rejected = code; return this; }, json() {},
        }, () => { next = true; });
        assert.equal(rejected, 401); assert.equal(next, false);
    }
});

function routeFixture({ ownerId = 42, failStorage = false } = {}) {
    const queries = [], cleanup = [], cancellations = [];
    let saved;
    const mocks = {
        './requestAuth': auth,
        './execQuery': {
            withTransaction: async work => work(async (sql, args) => {
                queries.push({ sql, args });
                if (sql.startsWith('SELECT * FROM posts')) return String(args[1]) === String(ownerId)
                    ? [{ id: 7, sender: ownerId, videoUrl: 's3://fixture-bucket/clip.mp4' }] : [];
                if (sql.startsWith('SELECT spatial_experience_json')) return String(args[1]) === String(ownerId)
                    ? [{ spatial_experience_json: '{}' }] : [];
                if (sql.startsWith('SELECT document')) return [];
                if (sql.startsWith('UPDATE')) saved = JSON.parse(args[0]);
                return { affectedRows: 1 };
            }),
        },
        './S3Routes': {
            postMediaStorageUrl: value => typeof value === 'string' && value.startsWith('s3://fixture-bucket/') ? value : null,
            deleteCloudImageUrl: async value => {
                cleanup.push(value);
                if (failStorage) throw Object.assign(new Error('fixture-provider-secret'), {
                    config: { headers: { Authorization: 'Bearer fixture-provider-secret' } },
                });
            },
        },
        './SpatialVideoProvider': { cancelSpatialVideo: async job => cancellations.push(job) },
    };
    return {
        deletion: load('server/src/PostDeletion.ts', mocks).deletePost,
        labels: load('server/src/SpatialActionLabels.ts', mocks).spatialActionLabels,
        queries, cleanup, cancellations, saved: () => saved,
    };
}
const labelBody = { postId: 7, preview: true, labels: [{ stageId: 'A', connectionId: 'act', label: 'Strike' }] };

test('missing, forged, expired and unsigned cookies cannot invoke deletion or label database work', async () => {
    for (const token of invalid) {
        const h = routeFixture();
        const body = { ...labelBody, userId: 42, sender: 42, authenticatedUserId: '42', authToken: valid };
        assert.equal((await invoke(h.deletion, request(token, body))).status, 401);
        assert.equal((await invoke(h.labels, request(token, body))).status, 401);
        const read = request(token, body); read.method = 'GET';
        assert.equal((await invoke(h.labels, read)).status, 401);
        assert.deepEqual(h.queries, []); assert.deepEqual(h.cleanup, []);
        assert.deepEqual(h.cancellations, []);
    }
});

test('a valid session cannot use supplied owner IDs to delete or label another member post', async () => {
    const h = routeFixture({ ownerId: 99 });
    const body = { ...labelBody, userId: 99, sender: 99, authenticatedUserId: '99' };
    assert.equal((await invoke(h.deletion, request(valid, body))).status, 404);
    assert.equal((await invoke(h.labels, request(valid, body))).status, 404);
    const read = request(valid, body); read.method = 'GET';
    assert.equal((await invoke(h.labels, read)).status, 404);
    assert.equal(h.queries.length, 3);
    for (const query of h.queries) {
        assert.match(query.sql, /sender=\? .*FOR UPDATE/);
        assert.deepEqual(query.args, [7, '42']);
    }
    assert.deepEqual(h.cleanup, []); assert.equal(h.saved(), undefined);
});

test('valid cookie identity authorizes its own post independent of untrusted payload identity', async () => {
    const h = routeFixture();
    const body = { ...labelBody, userId: 99, sender: 99 };
    assert.equal((await invoke(h.labels, request(valid, body))).status, 200);
    assert.deepEqual(h.saved().actionLabels, { A: { act: 'Strike' } });
    assert.equal((await invoke(h.deletion, request(valid, body))).status, 200);
    assert.deepEqual(h.cleanup, ['s3://fixture-bucket/clip.mp4']);
    assert.ok(h.queries.filter(query => /sender=\?/.test(query.sql)).every(query => query.args.at(-1) === '42'));
});

test('provider failures do not leak authorization metadata in deletion responses or server logs', async () => {
    const h = routeFixture({ failStorage: true }), logged = [], previous = console.error;
    let response;
    try {
        console.error = (...args) => logged.push(args);
        response = await invoke(h.deletion, request(valid, { postId: 7 }));
    } finally { console.error = previous; }
    assert.equal(response.status, 500);
    assert.deepEqual(response.body, { error: 'Deletion did not finish. Try again.' });
    assert.deepEqual(logged, [['Post deletion could not finish.']]);
    assert.doesNotMatch(JSON.stringify({ response, logged }), /fixture-provider-secret|Authorization|Bearer/);
    assert.equal(h.queries.some(query => query.sql.startsWith('DELETE')), false);
});

test('delete and label clients send HttpOnly-cookie credentials without client-supplied member identity', () => {
    const full = fs.readFileSync(path.join(root, 'src/FullScreenStories.tsx'), 'utf8');
    const ast = ts.createSourceFile('FullScreenStories.tsx', full, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let deletion;
    const visit = node => {
        if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'startDeleteDB') deletion = node.initializer;
        ts.forEachChild(node, visit);
    };
    visit(ast);
    assert.ok(deletion);
    const text = deletion.getText(ast);
    assert.match(text, /withCredentials:\s*true/);
    assert.doesNotMatch(text, /userId|sender|authToken|authorization|localStorage/i);
    const player = fs.readFileSync(path.join(root, 'src/SpatialExperiencePlayer.tsx'), 'utf8');
    const requests = player.split('\n').filter(line => /axios\.(get|put).*action-labels/.test(line));
    assert.equal(requests.length, 2);
    for (const line of requests) assert.match(line, /withCredentials:\s*true/);
});
