const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file) {
  const module = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText)(module, module.exports);
  return module.exports;
}
function extract(file, name, bindings) {
  bindings = { ...load('server/src/videoHistory.ts'), ...load('server/src/imageModelExamples.ts'),
    ...load('server/src/planVideoMedia.ts'), ...bindings };
  const source = ts.createSourceFile(file, fs.readFileSync(path.join(root, file), 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  let found;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) found = node.initializer;
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  }
  visit(source); assert.ok(found, name);
  const text = ts.isFunctionDeclaration(found) ? found.getText(source).replace(/^export /, '') : `const ${name} = ${found.getText(source)};`;
  const code = ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(bindings), code + `;return ${name};`)(...Object.values(bindings));
}
function response() { return { code: 200, body: null, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; }, send(body) { this.body = body; return this; } }; }
const spec = load('server/src/videoUpscaleSpec.ts');
test('both upscale choices use the shared no-markup whole-second rates and tolerance cap', () => {
  for (const [seconds, hd, twoK] of [[5, 23, 46], [10, 46, 92], [10.1, 46, 92]]) {
    assert.equal(spec.videoUpscalePixels(seconds, '1080p'), hd);
    assert.equal(spec.videoUpscalePixels(seconds, '2k'), twoK);
  }
  assert.equal(spec.videoUpscaleResolution('2K'), '2k');
  assert.throws(() => spec.videoUpscaleResolution('4k'), /1080p or 2K/);
});
test('image return updates the owned post without deleting or rewriting video/audio/cover', async () => {
  const writes = [];
  const handler = extract('server/src/PostDatabase.ts', 'PostStory', {
    authenticatedUserId: () => '7', console, execQuery: () => { throw Error('Must not INSERT'); },
    withTransaction: work => work(async (sql, args) => {
      if (sql.startsWith('SELECT')) return [{ sender: 7, kontext: JSON.stringify({ type: 'clik-plan-media', upscales: { xv1: [{ videoUrl: 'hd' }] }, bshotUpscales: { 'B:0:0': ['b'] } }) }];
      writes.push({ sql, args }); return { affectedRows: 1 };
    }),
  });
  const res = response();
  await handler({ body: { values: { postId: 9, id: 7, mode: 0, image1: 'new-image', imageHd1: 'new-hd-image', kontext: '{"type":"clik-plan-media","inputs":[]}' } } }, res);
  assert.equal(res.body.go, 9); assert.equal(writes.length, 1);
  assert.doesNotMatch(writes[0].sql, /DELETE|INSERT|xv1|xa1|thumb1|caption|sender|time/);
  const context = JSON.parse(writes[0].args[writes[0].args.length - 2]);
  assert.equal(context.upscales.xv1[0].videoUrl, 'hd'); assert.deepEqual(context.bshotUpscales['B:0:0'], ['b']);
});
test('image return refuses a different owner without making a write', async () => {
  const handler = extract('server/src/PostDatabase.ts', 'PostStory', {
    authenticatedUserId: () => '8', console, withTransaction: work => work(async sql => {
      assert.match(sql, /^SELECT/); return [{ sender: 7 }];
    }),
  });
  const res = response(); await handler({ body: { values: { postId: 9 } } }, res); assert.equal(res.code, 403);
});
test('A upscale receipt cannot replace a newer source and keeps both durable results', async () => {
  const writes = [];
  const handler = extract('server/src/PostDatabase.ts', 'VideoDb', {
    authenticatedUserId: () => '7', console,
    withTransaction: work => work(async (sql, args) => {
      if (sql.startsWith('SELECT')) return [{ sender: 7, previousVideo: 'https://assets/newer.mp4', kontext: '{}' }];
      writes.push({ sql, args }); return {};
    }),
  });
  const res = response(); await handler({ body: { values: { postId: 9, type: 0, vid: 'https://assets/hd.mp4', mode: 0,
    upscale: { sourceUrl: 'https://assets/original.mp4', resolution: '2k', duration: 5, predictionId: 'paid-1' } } } }, res);
  assert.equal(res.body.promoted, false); assert.doesNotMatch(writes[0].sql, /xv1=/);
  const context = JSON.parse(writes[0].args[0]);
  assert.deepEqual(new Set(context.retainedMedia.map(item => item.url)), new Set(['https://assets/newer.mp4', 'https://assets/hd.mp4', 'https://assets/original.mp4']));
  assert.equal(context.upscales.xv1[0].predictionId, 'paid-1');
});
test('B upscale merges its own slot and preserves concurrently saved neighbours', async () => {
  for (const newer of [false, true]) {
    let write;
    const truth = { videoarray: [[newer ? 'https://assets/newer.mp4' : 'https://assets/original.mp4', 'neighbour-current']], imagesarray: [['image-current']] };
    const handler = extract('server/src/PostDatabase.ts', 'BShotTruthDb', {
      authenticatedUserId: () => '7', console,
      withTransaction: work => work(async (sql, args) => {
        if (sql.startsWith('SELECT')) return [{ sender: 7, bshot: JSON.stringify(truth), kontext: '{}' }];
        write = { sql, args }; return {};
      }),
    });
    const res = response(); await handler({ body: { values: { postId: 9, bshot: '{"videoarray":[["stale","stale neighbour"]]}',
      upscale: { parentScene: 0, bShotIndex: 0, sourceUrl: 'https://assets/original.mp4', videoUrl: 'https://assets/hd.mp4', resolution: '1080p' } } } }, res);
    assert.equal(res.body.promoted, !newer);
    if (newer) assert.doesNotMatch(write.sql, /bshot=/);
    else assert.deepEqual(JSON.parse(write.args[0]).videoarray, [['https://assets/hd.mp4', 'neighbour-current']]);
  }
});

test('a completed A upscale does not restore a deleted source slot', async () => {
  let write;
  const handler = extract('server/src/PostDatabase.ts', 'VideoDb', {
    authenticatedUserId: () => '7', console,
    withTransaction: work => work(async (sql, args) => {
      if (sql.startsWith('SELECT')) return [{ sender: 7, previousVideo: null, kontext: '{}' }];
      write = { sql, args }; return {};
    }),
  });
  const res = response();
  await handler({ body: { values: { postId: 9, type: 0, mode: 0, vid: 'https://assets/hd.mp4',
    upscale: { sourceUrl: 'https://assets/deleted.mp4', resolution: '1080p' } } } }, res);
  assert.equal(res.body.promoted, false); assert.doesNotMatch(write.sql, /xv1=/);
  assert.equal(JSON.parse(write.args[0]).upscales.xv1[0].videoUrl, 'https://assets/hd.mp4');
});
function upscaleFixture() {
  const events = [], requests = [], previews = [], choices = [];
  const target = { type: 'A', index: 0 };
  const bindings = { storedVideoReceiptsRef:{current:new Map()},persistStoredVideoReceipt:async()=>{},PostId:9,upscaleTopologyRef:{current:{}},index: 0, captureSceneTarget: () => target, resolveSceneTargetIndex: () => 0, getSceneTargetKey: () => 'A:0',
    VideoArrayCloud: ['https://assets/original.mp4'], currentVideoMetadataSource: 'original-local', currentVideoDimensions: { width: 720, height: 1280 }, currentVideoDuration: 5,
    isSupportedVideoUploadDuration: value => value <= 10.25, pixels: 1000, time: 5, CLIK_URL: '/mock', EDITSTORY_VIDEO_UPSCALE_LINK_MODE: false,
    videoUploadClaimsRef:{current:new Map()},currentVideoMetadataIdentityRef:{current:'original-local'},sceneSourceDataRef:{current:{VideoArrayCloud:['https://assets/original.mp4'],VideoArray:['original-local']}},videoUpscaleClaimsRef: { current: new Set() }, videoUpscaleCompletedRef: { current: {} }, videoUpscaleProviderResultsRef: { current: {} },
    getBShotSaveContextSnapshot: () => ({}), resolveVideoPromptForTarget: () => 'prompt',
    priceVideoUpscale: spec.videoUpscalePixels, setVideoUpscaleChoice: value => choices.push(value), setVideoUpscaleJobs: () => {}, setVideoUpscaleStatusVersion: () => {},
    axios: { post: async (url, body) => { requests.push(body); return { data: { videoBase64: 'result', predictionId: 'paid-id' } }; } },
    base64ToBlob: async () => new Blob(['result']), GenerateSignedUrlForVideo: async () => 'https://assets/hd.mp4',
    setVideoArray: updater => previews.push(updater([])), setVideoArrayBlob: () => {}, videoUpscaledSourceRef: { current: {} },
    globalErrorEmitter: { emit: (...args) => events.push(args) },
  };
  return { events, requests, previews, choices, target, bindings, run: choice => extract('src/EditStory.tsx', 'handleVideoUpscaleClick', bindings)(choice) };
}
test('opening/cancelling the upscale chooser makes no provider request', async () => {
  const f = upscaleFixture(); await f.run(); assert.equal(f.requests.length, 0); assert.equal(f.choices[0].resolution, '1080p'); assert.equal(f.choices[0].duration, 5);
});

test('upscale cannot quote an old cloud clip while a different local preview is uploading', async () => {
  const f = upscaleFixture();
  f.bindings.currentVideoMetadataSource = 'new-local-10s';
  f.bindings.currentVideoDuration = 10;
  f.bindings.videoUploadClaimsRef.current.set('9:A:0', new Set([Symbol('upload')]));
  await f.run(); assert.equal(f.requests.length, 0); assert.equal(f.choices.length, 0);
  assert.match(f.events[0][0], /still saving/);
});

test('changing the source after the choice invalidates confirmation before a paid request', async () => {
  const f = upscaleFixture(); await f.run(); const choice = f.choices[0];
  f.bindings.sceneSourceDataRef.current.VideoArrayCloud[0] = 'https://assets/newer.mp4';
  f.bindings.sceneSourceDataRef.current.VideoArray[0] = 'newer-local';
  await f.run(choice); assert.equal(f.requests.length, 0); assert.match(f.events[0][0], /video changed/);
});
test('rapid confirmation deduplicates active work, then HD accepts a deliberate second pass', async () => {
  const f = upscaleFixture(); let resolve;
  f.bindings.axios.post = async (_url, body) => { f.requests.push(body); return new Promise(done => { resolve = done; }); };
  const choice = { target: f.target, sourceUrl: 'https://assets/original.mp4', width: 720, height: 1280, duration: 5, resolution: '2k' };
  const first = f.run(choice); await f.run(choice); assert.equal(f.requests.length, 1);
  resolve({ data: { videoBase64: 'result', predictionId: 'first' } }); await first;
  f.bindings.axios.post = async (_url, body) => { f.requests.push(body); return { data: { videoBase64: 'result', predictionId: 'second' } }; };
  f.bindings.sceneSourceDataRef.current.VideoArrayCloud[0]='https://assets/hd.mp4';
  await f.run({ ...choice, sourceUrl: 'https://assets/hd.mp4' }); assert.equal(f.requests.length, 2); assert.equal(f.requests[1].video, 'https://assets/hd.mp4');
});
test('failed save retains the paid result and retries persistence without generating again', async () => {
  const f = upscaleFixture(); const choice = { target: f.target, sourceUrl: 'https://assets/original.mp4', width: 720, height: 1280, duration: 5, resolution: '1080p' };
  f.bindings.GenerateSignedUrlForVideo = async () => { throw Error('Save failed'); };
  await f.run(choice); assert.equal(f.requests.length, 1); assert.equal(f.previews.length, 0);
  assert.match(f.events[0][0], /retained; use Retry save/);
  f.bindings.GenerateSignedUrlForVideo = async () => { f.bindings.setVideoArray(() => ['https://assets/hd.mp4']); return 'https://assets/hd.mp4'; };
  await f.run(); assert.equal(f.requests.length, 1); assert.deepEqual(f.previews, [['https://assets/hd.mp4']]);
});

test('reopened upscale metadata matches current A/B truth and protects all retained video sources/results', async () => {
  const url = name => `https://assets/${name}.mp4`;
  const activeA = { videoUrl: url('a-hd'), sourceUrl: url('a-original'), resolution: '2k' };
  const activeB = { videoUrl: url('b-hd'), sourceUrl: url('b-original'), resolution: '1080p' };
  const staleB = { videoUrl: url('b-late-stale'), sourceUrl: url('b-original'), resolution: '2k' };
  const historyA = { videoUrl: url('a-earlier-hd'), sourceUrl: url('a-earlier-original') };
  const removedB = { videoUrl: url('b-removed'), sourceUrl: url('b-removed-source') };
  let calls = 0;
  const handler = extract('server/src/PostDatabase.ts', 'SavedVideoUpscales', {
    authenticatedUserId: () => '7',
    execQuery: async (sql, args) => {
      calls++; assert.match(sql, /SELECT sender, mode, kontext, bshot,/); assert.deepEqual(args, [9]);
      return [{ sender: 7, mode: 1, xv1: url('a-hd'), xv1B: url('a-stage-b-hd'),
        bshot: JSON.stringify({ videoarray: [[url('b-hd'), null], [url('new-unrelated')]] }),
        kontext: JSON.stringify({ upscales: { xv1: [null, historyA, activeA, { videoUrl: url('a-stale'), sourceUrl: url('a-original') }],
          xv1B: [{ videoUrl: url('a-stage-b-hd'), sourceUrl: url('a-stage-b-original') }] },
          bshotUpscales: { 'B:0:0': [activeB, staleB], 'B:1:0': [removedB], 'B:0:1': [removedB] },
          retainedMedia: [{ kind: 'video', url: url('retained-only') }, { kind: 'video', url: url('b-original') }, { kind: 'image', url: 'https://assets/image.png' }] }),
      }];
    },
  });
  const res = response(); await handler({ query: { postId: 9 } }, res);
  assert.equal(calls, 1); assert.equal(res.code, 200);
  assert.deepEqual(res.body.upscales['A:0'], activeA); assert.equal(res.body.upscales['A:1'].videoUrl, url('a-stage-b-hd'));
  assert.deepEqual(res.body.upscales['B:0:0'], activeB); assert.equal(res.body.upscales['B:1:0'], undefined); assert.equal(res.body.upscales['B:0:1'], undefined);
  assert.deepEqual(new Set(res.body.retainedMediaUrls), new Set(['retained-only', 'a-original', 'a-hd', 'a-earlier-original', 'a-earlier-hd',
    'a-stale', 'a-stage-b-original', 'a-stage-b-hd', 'b-original', 'b-hd', 'b-late-stale', 'b-removed-source', 'b-removed', 'new-unrelated'].map(url)));
  assert.deepEqual(res.body.videoHistory['A:0'].map(item => item.videoUrl), ['a-earlier-original', 'a-earlier-hd', 'a-original', 'a-hd', 'a-stale'].map(url));
  assert.deepEqual(res.body.videoHistory['B:0:0'].map(item => item.videoUrl), ['b-original', 'b-hd', 'b-late-stale'].map(url));
  assert.equal(res.body.retainedMediaUrls.length, new Set(res.body.retainedMediaUrls).size);
});

test('upscale hydration never exposes another owner and accepts legacy context/truth without metadata', async () => {
  for (const [owner, sender, context, expected] of [[null, 7, '{}', 401], ['8', 7, '{}', 403], ['7', 7, 'legacy context', 200], ['7', 7, 'null', 200]]) {
    let queried = false;
    const handler = extract('server/src/PostDatabase.ts', 'SavedVideoUpscales', {
      authenticatedUserId: () => owner,
      execQuery: async () => { queried = true; return [{ sender, kontext: context, bshot: 'legacy truth' }]; },
    });
    const res = response(); await handler({ query: { postId: 9 } }, res);
    assert.equal(res.code, expected); assert.equal(queried, Boolean(owner));
    if (expected === 200) assert.deepEqual(res.body, { upscales: {}, videoHistory: {}, retainedMediaUrls: [], imageModels: {} });
    else assert.equal(res.body.retainedMediaUrls, undefined);
  }
});

test('saved video versions are not added to deferred deletion; unrelated existing cleanup remains', async () => {
  const previousStorage = global.localStorage;
  const storage = new Map([['helpervideosprompt', JSON.stringify([{ url: 'https://assets/original.mp4', time: 0 }, { url: 'https://assets/obsolete.mp4', time: 0 }])]]);
  global.localStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) };
  try {
    const cleanup = load('src/SavepromptHelpersLocal.ts');
    const retained = { current: new Set() }, uploads = { current: new Map() }, context = { isBShotMedia: false, upscale: { sourceUrl: 'https://assets/original.mp4', resolution: '1080p' } };
    let output = 'https://assets/hd.mp4';
    const bindings = { useCallback: callback => callback, PostId: 9, creationProjectId:'project-9', pageType: 0, VideoArrayCloud: ['https://assets/original.mp4'], videoArrayLastFrame: [], CreationMode: 'Video',
      captureSceneTarget: () => ({ type: 'A', index: 0 }), resolveSceneTargetIndex: () => 0, getSceneTargetKey: () => 'A:0',
      videoUploadClaimsRef: uploads, latestVideoUploadRef:{current:new Map()},upscaleTopologyRef:{current:{projectId:'9',topologyVersion:1,aTopologyVersion:1}},sceneSourceDataRef:{current:{VideoArray:['original'],VideoArrayBlob:[]}},setVideoSavingScenes() {}, retainedUpscaleUrlsRef: retained, bShotSaveContextRef: { current: context },
      CLIK_URL: '/mock', axios: { post: async () => ({ data: { holder: [{ urlVideo: 'https://upload.test/signed' }] } }) },
      captureVideoUploadOwner:()=>()=>true,adoptSavedSceneVideo:()=>{},captureMediaSaveOwner:()=>()=>true,PutVideoInS3WithURL: async () => output, ...cleanup, console: { log() {}, error() {} }, isBShotModeActive: false,
    };
    const save = () => extract('src/EditStory.tsx', 'GenerateSignedUrlForVideo', bindings)(new Blob(['video']), 0, 'local-preview');
    await save(); assert.equal(uploads.current.size, 0);
    assert.deepEqual(JSON.parse(storage.get('helpervideosprompt')).map(item => item.url), ['https://assets/obsolete.mp4']);
    bindings.VideoArrayCloud[0] = output; bindings.bShotSaveContextRef.current = { isBShotMedia: false }; output = 'https://assets/replacement.mp4';
    await save(); assert.deepEqual(JSON.parse(storage.get('helpervideosprompt')).map(item => item.url), ['https://assets/obsolete.mp4']);
    bindings.VideoArrayCloud[0] = 'https://assets/unused-unretained.mp4'; await save();
    assert.deepEqual(JSON.parse(storage.get('helpervideosprompt')).map(item => item.url), ['https://assets/obsolete.mp4']);
  } finally { global.localStorage = previousStorage; }
});
