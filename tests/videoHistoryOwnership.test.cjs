const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
function load(file) { const mod = { exports: {} }; Function('module', 'exports', ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(mod, mod.exports); return mod.exports; }
const history = load('server/src/videoHistory.ts'), scene = load('src/sceneTargetArchitecture.ts');
const source = fs.readFileSync('src/Storybook.tsx', 'utf8'), tree = ts.createSourceFile('Storybook.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function extract(name, bindings, effect = false) {
    bindings = { creationDraft: undefined, ...bindings };
    let found; const visit = node => {
        if (!effect && ts.isVariableDeclaration(node) && node.name.getText(tree) === name) found = node.initializer;
        if (effect && ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect' && node.arguments[0]?.getText(tree).includes(name)) found = node;
        ts.forEachChild(node, visit);
    }; visit(tree); assert.ok(found, name);
    const code = ts.isCallExpression(found) ? found.arguments[0].getText(tree) : found.getText(tree);
    return Function(...Object.keys(bindings), ts.transpileModule(`return (${code});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(bindings));
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture(postId = '0') {
    const cache = new Map(), requests = [], protectedUrls = [], state = { history: {}, upscales: {} };
    const owner = { current: { postId, creationProjectId: 'same-draft-id', userId: '5' } };
    const bindings = { ...history, ...scene, dispatch() {}, restoreImageResultModels: value => value, videoHistoryOwnerRef: owner, restoredVideoHistoryOwnerRef: { current: null }, videoHistoryRef: { current: {} },
        RemoveVideoFromDeleteLater: urls => protectedUrls.push(...urls), ProtectSavedMediaFromDeleteLater() {},
        localStorage: { getItem: key => cache.get(key), setItem: (key, value) => cache.set(key, value) }, console: { warn() {}, error() {} },
        setVideoHistory: value => state.history = value, setSavedVideoUpscales: value => state.upscales = value, CLIK_URL: 'http://fixture',
        axios: { get: (_url, options) => new Promise((resolve, reject) => requests.push({ resolve, reject, postId: options.params.postId })) },
    };
    for (const name of ['protectVideoHistory', 'cacheVideoHistory', 'onVideoMediaStored']) bindings[name] = extract(name, bindings);
    const restore = extract('const owner = { ...videoHistoryOwnerRef.current }, previous = restoredVideoHistoryOwnerRef.current;', bindings, true);
    return { cache, requests, protectedUrls, state, owner, bindings, restore, stored: bindings.onVideoMediaStored };
}
const version = (url, createdAt = 10, prompt = 'Authored prompt') => ({ videoUrl: `https://storage.test/${url}.mp4`, createdAt, prompt });

test('actual storage callback keeps every paid A/B URL and original prompt/time, strips binary owners, and protects all versions', () => {
    const f = fixture('4'); f.restore();
    for (let i = 0; i < 9; i++) f.stored({ type: 'A', index: 0 }, { ...version(`a-${i}`, i), projectId: '4', creationProjectId: 'same-draft-id', file: new Blob(['never owned']), preview: 'blob:never-owned' });
    f.stored({ type: 'B', index: 2, bIndex: 1 }, { ...version('b-1'), projectId: '4' });
    f.stored({ type: 'A', index: 0 }, { ...version('a-0', 999, 'Restore must not rewrite original'), projectId: '4' });
    assert.equal(f.state.history['A:0'].length, 9); assert.deepEqual(f.state.history['A:0'][0], version('a-0', 0));
    assert.equal(f.state.history['B:2:1'].length, 1); assert.equal(Object.values(f.state.history['A:0'][0]).some(value => value instanceof Blob || String(value).startsWith('blob:')), false);
    for (const entry of Object.values(f.state.history).flat()) assert.ok(f.protectedUrls.includes(entry.videoUrl));
    const cached = JSON.parse(f.cache.get('clik-video-history:5:post:4')); assert.deepEqual(cached, f.state.history);
    f.stored({ type: 'A', index: 0 }, { ...version('stale-other-project'), projectId: '9' }); assert.equal(f.state.history['A:0'].length, 9);
});

test('A to B post switch with same user/draft id isolates paid histories and ignores a late A restore response', async () => {
    const f = fixture('4'); const cleanup = f.restore(); f.stored({ type: 'A', index: 0 }, { ...version('post-a'), projectId: '4' });
    f.cache.set('clik-video-history:5:post:9', JSON.stringify({ 'B:1:0': [version('post-b')] }));
    cleanup(); f.owner.current = { ...f.owner.current, postId: '9' }; f.restore();
    assert.deepEqual(f.state.history, { 'B:1:0': [version('post-b')] });
    f.requests[0].resolve({ data: { videoHistory: { 'A:0': [version('late-post-a')] } } }); await flush();
    assert.deepEqual(f.state.history, { 'B:1:0': [version('post-b')] });
    f.requests[1].resolve({ data: { videoHistory: { 'B:1:0': [version('server-b')] }, upscales: { 'B:1:0': { resolution: '2k' } }, retainedMediaUrls: ['https://storage.test/retained-b.mp4'] } }); await flush();
    assert.deepEqual(f.state.history['B:1:0'], [version('post-b'), version('server-b')]); assert.equal(f.state.history['A:0'], undefined);
    assert.ok(f.protectedUrls.includes('https://storage.test/retained-b.mp4'));
});

test('a stored draft carries into its first saved post even when metadata restore fails, then another post resets', async () => {
    const f = fixture('0'); f.restore(); f.stored({ type: 'A', index: 3 }, { ...version('draft-paid'), projectId: '0' });
    f.owner.current = { ...f.owner.current, postId: '4' }; f.restore(); assert.deepEqual(f.state.history, { 'A:3': [version('draft-paid')] });
    assert.deepEqual(JSON.parse(f.cache.get('clik-video-history:5:post:4')), f.state.history);
    f.requests[0].reject(Error('database temporarily unavailable')); await flush(); assert.equal(f.state.history['A:3'].length, 1);
    f.owner.current = { ...f.owner.current, postId: '9' }; f.restore(); assert.deepEqual(f.state.history, {});
    f.owner.current = { ...f.owner.current, postId: '4' }; f.restore(); assert.deepEqual(f.state.history, { 'A:3': [version('draft-paid')] });
});

test('a first saved post can reopen a URL-only unbound draft cache without adopting another persisted project', () => {
    const f = fixture('4'); f.cache.set('clik-video-history:5:project:same-draft-id', JSON.stringify({ postId: null, videoHistory: { 'A:0': [version('draft')] } }));
    f.restore(); assert.deepEqual(f.state.history, { 'A:0': [version('draft')] });
    const g = fixture('9'); g.cache.set('clik-video-history:5:project:same-draft-id', JSON.stringify({ postId: '4', videoHistory: { 'A:0': [version('other-post')] } }));
    g.restore(); assert.deepEqual(g.state.history, {});
});

test('server restore merges into newer S3 callback history rather than replacing a pending paid version', async () => {
    const f = fixture('4'); f.restore(); f.stored({ type: 'A', index: 0 }, { ...version('new-paid'), projectId: '4' });
    f.requests[0].resolve({ data: { videoHistory: { 'A:0': [version('older-server')] } } }); await flush();
    assert.deepEqual(f.state.history['A:0'], [version('new-paid'), version('older-server')]);
    assert.deepEqual(JSON.parse(f.cache.get('clik-video-history:5:post:4')), f.state.history);
});
