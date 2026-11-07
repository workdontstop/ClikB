const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(file) {
  const filename = path.resolve(root, file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module); cache.set(filename, mod);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = name => name.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`))) : Module.prototype.require.call(mod, name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const { DraftController } = load('src/creationDrafts/store.ts');
const { DraftApiError } = load('src/creationDrafts/api.ts');
const { stableDraftJson } = load('server/src/creationDrafts/schema.ts');
function memory() { const values = new Map(); return { values, getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) }; }
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const snapshot = (sections = {}) => ({ schemaVersion: 1, creationProjectId: 'project-one', creationType: 1, sections });
const record = (state = snapshot(), revision = 3, projection) => ({ postId: 23, draftId: 'draft-one', snapshot: state, revision, digest: `cloud-${revision}`, published: false,
  imageProjectionDigest: projection ? stableDraftJson(projection) : null });
const tick = () => new Promise(resolve => setImmediate(resolve));
function controller(options = {}) { return new DraftController({ accountId: 7, creationProjectId: 'project-one', creationType: 1,
  storage: memory(), protectMedia() {}, ...options }); }

test('fresh capture stays local before image Continue and merges distinct stage fields', async () => {
  const storage = memory(), calls = [], protectedValues = [];
  const draft = controller({ storage, protectMedia: value => protectedValues.push(value), api: { checkpoint: async value => calls.push(value) } });
  draft.capture('prompt', { Planx: { story: 'Complete intent' }, selected: 'https://assets/fourth.png' });
  draft.capture('prompt', { narration: ['Original speech'] });
  draft.capture('storybook', { textVideo: ['Motion prompt'] }, { quiet: true });
  await draft.flush();
  assert.equal(calls.length, 0); assert.equal(draft.getState().saved, false);
  assert.deepEqual(draft.section('prompt'), { Planx: { story: 'Complete intent' }, selected: 'https://assets/fourth.png', narration: ['Original speech'] });
  assert.equal(protectedValues.length, 3);
  assert.deepEqual(protectedValues[1], { narration: ['Original speech'] }, 'Only the changed patch is scanned on field capture');
  const saved = JSON.parse(storage.getItem('clik-creation-draft:v1:7:project-one'));
  assert.equal(saved.snapshot.sections.prompt.selected, 'https://assets/fourth.png');
  assert.equal(saved.postId, null); draft.dispose();
});

test('cloud hydration rejects default captures and reading a section cannot mutate retained snapshot', () => {
  const draft = controller({ record: record(snapshot({ storybook: { clips: ['https://assets/paid.mp4'], unopened: { full: 'B-roll data' } } })) });
  assert.equal(draft.capture('storybook', { clips: [] }), false);
  const copied = draft.section('storybook'); copied.clips.length = 0;
  assert.deepEqual(draft.getState().snapshot.sections.storybook.clips, ['https://assets/paid.mp4']);
  draft.endHydration(); draft.capture('storybook', { title: 'An edit' });
  assert.equal(draft.section('storybook').unopened.full, 'B-roll data');
  assert.equal(draft.getState().saved, false); draft.dispose();
});

test('returning an edit to the confirmed snapshot clears pending without a redundant close save', async () => {
  const requests = [];
  const draft = controller({ record: record(snapshot({ prompt: { bShotImages: [['https://assets/selected.png']] } })),
    api: { checkpoint: async request => { requests.push(request); return record(request.snapshot, 4); } } });
  draft.endHydration();
  draft.capture('prompt', { bShotImages: [['https://assets/temporary.png']] });
  assert.equal(draft.getState().pending, true);
  draft.capture('prompt', { bShotImages: [['https://assets/selected.png']] });
  await draft.flush();
  assert.equal(requests.length, 0);
  assert.equal(draft.getState().saved, true);
  assert.equal(draft.getState().pending, false);
  draft.dispose();
});

test('quiet saves serialize draft revisions and a slow old acknowledgment does not erase newer edits', async () => {
  const first = deferred(), second = deferred(), requests = [];
  const draft = controller({ record: record(), api: { checkpoint: request => { requests.push(request); return requests.length === 1 ? first.promise : second.promise; } } });
  draft.endHydration(); draft.capture('storybook', { video: 'https://assets/first.mp4' });
  const a = draft.checkpoint('quiet'); await tick();
  draft.capture('storybook', { video: 'https://assets/second.mp4', videoPrompt: 'Matching second prompt' });
  const b = draft.checkpoint('quiet'); await tick();
  assert.equal(requests.length, 1); assert.equal(requests[0].expectedRevision, 3);
  first.resolve(record(requests[0].snapshot, 4)); await a; await tick();
  assert.equal(requests.length, 2); assert.equal(requests[1].expectedRevision, 4);
  assert.equal(draft.section('storybook').video, 'https://assets/second.mp4');
  assert.equal(draft.getState().saved, false);
  second.resolve(record(requests[1].snapshot, 5)); await b;
  assert.equal(draft.getState().saved, true); assert.equal(draft.getState().revision, 5); draft.dispose();
});

test('double image Continue shares one in-flight save and binds post identity without losing local creation', async () => {
  const saved = deferred(), requests = [], storage = memory();
  const draft = controller({ storage, api: { checkpoint: request => { requests.push(request); return saved.promise; } } });
  draft.capture('prompt', { parsedKeyPoints: ['A', 'B'] });
  const projection = { kind: 'story', values: { image1: 'https://assets/a.png', image2: 'https://assets/b.png' } };
  const first = draft.checkpoint('images', projection), second = draft.checkpoint('images', projection);
  assert.equal(first, second); await tick(); assert.equal(requests.length, 1);
  saved.resolve(record(requests[0].snapshot, 1, projection)); await first;
  assert.equal(draft.getState().postId, 23); assert.equal(draft.creationProjectId, 'project-one');
  assert.equal(storage.getItem('clik-creation-draft:v1:7:post:23'), 'project-one');
  await draft.checkpoint('images', projection);
  assert.equal(requests.length, 1, 'Identical acknowledged image projection makes no redundant DB call'); draft.dispose();
});

test('failed save retains original request ID for a lost-response retry and never claims saved', async () => {
  let fail = true; const requests = [], storage = memory();
  const draft = controller({ storage, record: record(), api: { checkpoint: async request => {
    requests.push(request); if (fail) throw new Error('Network interrupted'); return record(request.snapshot, 4);
  } } });
  draft.endHydration(); draft.capture('storybook', { selected: 'https://assets/paid.mp4' });
  await assert.rejects(draft.checkpoint('quiet'), /Network interrupted/);
  assert.equal(draft.getState().saved, false); assert.equal(draft.getState().pending, true);
  const savedOutbox = JSON.parse(storage.getItem('clik-creation-draft:v1:7:project-one')).outbox;
  assert.equal(savedOutbox.saveId, requests[0].saveId);
  fail = false; await draft.flush();
  assert.equal(requests[1].saveId, requests[0].saveId); assert.equal(draft.getState().saved, true); draft.dispose();
});

test('cloud conflict wins and blocks stale component writes until explicit rehydration', async () => {
  const newest = record(snapshot({ prompt: { brief: 'Changed on another device' } }), 8);
  const draft = controller({ record: record(), api: { checkpoint: async () => { throw new DraftApiError('Conflict', 409); }, read: async () => newest } });
  draft.endHydration(); draft.capture('prompt', { brief: 'Stale device' });
  await assert.rejects(draft.checkpoint('quiet'));
  assert.equal(draft.getState().conflicted, true); assert.equal(draft.section('prompt').brief, 'Changed on another device');
  assert.equal(draft.capture('prompt', { brief: 'Old component default' }), false); draft.dispose();
});

test('unavailable local storage retains the active creation and does not mark cloud saved', () => {
  const draft = controller({ storage: { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Quota exceeded'); } } });
  draft.capture('prompt', { Planx: { content: 'Retain me' } }); draft.flushLocal();
  assert.equal(draft.section('prompt').Planx.content, 'Retain me'); assert.equal(draft.getState().localError, 'Quota exceeded');
  assert.equal(draft.getState().saved, false); draft.dispose();
});


test('closing freezes later reset setters while an accepted revision is saving', async () => {
  const pending = deferred(), requests = [];
  const draft = controller({ record: record(), api: { checkpoint: request => { requests.push(request); return pending.promise; } } });
  draft.endHydration(); draft.capture('prompt', { brief: 'Accepted before close' });
  const closing = draft.close(); await tick();
  assert.equal(draft.capture('prompt', { brief: '' }), false);
  pending.resolve(record(requests[0].snapshot, 4)); await closing;
  assert.equal(draft.section('prompt').brief, 'Accepted before close');
  assert.equal(draft.getState().closed, true); assert.equal(draft.getState().saved, true);
});

test('editing a plan invalidates dependent results without releasing the unpublished post ID', async () => {
  const draft = controller({ record: record(snapshot({ prompt: { prompt: 'Original' }, storybook: { PlanVid: 'Old plan', VideoArrayCloud: ['https://assets/old.mp4'] }, editor: { motionImagesMap: { 'A:0': 'old' } }, publication: { metadataReady: true } })) });
  draft.endHydration(); draft.resetDependentSections();
  assert.equal(draft.getState().postId, 23); assert.equal(draft.creationProjectId, 'project-one');
  assert.equal(draft.section('storybook'), undefined); assert.equal(draft.section('publication'), undefined);
  assert.equal(draft.section('prompt').prompt, 'Original'); assert.equal(draft.getState().saved, false); draft.dispose();
});
