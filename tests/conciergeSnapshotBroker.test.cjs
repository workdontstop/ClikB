const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./loadTs.cjs');
const { ConciergeSnapshotBroker, conciergeVisibleView } = load('server/src/ConciergeSnapshotBroker.ts');
const { querySnapshotFields } = load('server/src/ConciergeTools.ts');
const { runConciergeControlLoop } = load('server/src/ConciergeControlLoop.ts');
const { conciergeVisibleSurface } = load('src/conciergeVisibleSurface.ts');
const { resolveConciergeCreationTarget } = load('server/src/ConciergeCreationTarget.ts');
let n = 0;
const area = 'clikb.creation.notepad';
const action = `${area}.action.save`;
function state() { return { route: '/images?deck=1', autoControl: { enabled: true, videoEnabled: false },
  creation: { projectId: 'p1', mode: 'shorts', stage: 'editor', originalRequest: 'SAVED_ORIGINAL', blueprint: 'SAVED_BLUEPRINT',
    editStoryCurrentVideoPrompt: 'SAVED_OTHER_VIDEO', visibleDrafts: [{ controlId: 'draft', value: 'CURRENT_UNSAVED' }],
    controls: { stateVersion: 1, areas: { [area]: { state: { ready: true, originalPrompt: 'SAVED_SHORT_PROMPT',
      promptInstruction: 'SAVED_INSTRUCTION', promptPreview: 'SAVED_PREVIEW', promptLength: 14, timestamp: 1 },
      controls: [{ controlId: `${area}.control.save`, actionId: action, kind: 'click', enabled: true, policy: 'candidate', ownerId: 'owner-1',
        label: 'Save', handlerRef: 'RAW_HANDLER_DESCRIPTION', valueHint: 'PRIVATE_HINT' }] } } } } }; }
const broker = s => new ConciergeSnapshotBroker(`test:${++n}`, s);
const query = (b, s, pointers) => b.readFields(querySnapshotFields(s, pointers));

test('automatic notice excludes catalogue and saved content; explicit read preserves exact current draft and native ownership', () => {
  const s = state(), raw = structuredClone(s), b = broker(s);
  const notice = JSON.stringify(b.automatic());
  assert.doesNotMatch(notice, /SAVED_|RAW_HANDLER|PRIVATE_HINT|\.action\.save/);
  assert.match(notice, /CURRENT_UNSAVED/);
  assert.equal(b.knows(action), false);
  const view = b.readSnapshot();
  assert.equal(view.liveFields[0].mode, 'editing-draft');
  assert.equal(view.areas[area].controls[0].ownerId, 'owner-1');
  assert.equal(b.knows(action), true);
  assert.doesNotMatch(JSON.stringify(view), /SAVED_|RAW_HANDLER|PRIVATE_HINT/);
  assert.equal(view.areas[area].state.promptLength, 14);
  assert.deepEqual(s, raw, 'raw Jev/browser evidence is unmodified');
  assert.equal(b.readSnapshot().status, 'unchanged');
});

test('reporting and direct questions retain current outcomes across unchanged references without replaying controls or prompts', () => {
  const s = state(), owner = `report:${++n}`;
  s.creation.hdImageCount = 3;
  Object.assign(s.creation.controls.areas[area].state, { primaryImagesReady: 3, remainingPrimaryImages: 0 });
  const first = new ConciergeSnapshotBroker(owner, s);
  first.decisionContext(true);
  const next = new ConciergeSnapshotBroker(owner, s);
  const report = next.decisionContext(false);
  assert.equal(report.unchanged, true);
  assert.equal(report.progress.hdImageCount, 3);
  assert.equal(report.outcomes[area].primaryImagesReady, 3);
  assert.equal(report.outcomes[area].remainingPrimaryImages, 0);
  assert.doesNotMatch(JSON.stringify(report), /SAVED_|RAW_HANDLER|PRIVATE_HINT|\.action\.save/);
  s.creation.hdImageCount = 2;
  s.creation.controls.areas[area].state.primaryImagesReady = 2;
  next.update(s);
  assert.equal(next.decisionContext(false).outcomes[area].primaryImagesReady, 2, 'New state supersedes the earlier report');
});

test('meaningful deltas survive intervening calls; timestamp churn and unchanged catalogues become references', () => {
  const s = state(), b = broker(s); b.readSnapshot();
  s.creation.controls.stateVersion++; s.creation.controls.areas[area].state.timestamp++;
  b.update(s); assert.equal(b.automatic().unchanged, true);
  s.creation.controls.areas[area].controls[0].enabled = false;
  b.update(s);
  const first = b.automatic(), second = b.automatic();
  assert.deepEqual(second.changes, first.changes);
  assert.equal(first.changes.length, 1);
  assert.equal(first.changes[0].value, false);
  assert.match(first.changes[0].pointer, /byId.*enabled/);
  b.readSnapshot(); assert.equal(b.automatic().unchanged, true);
  s.creation.mediaRevision = 'rendered-replacement-2'; b.update(s);
  assert.ok(b.automatic().changes.some(change => change.pointer === '/progress/mediaRevision'));
});

test('nested modal, new scene, tab and project invalidate old controls; unmapped modal exposes no background', () => {
  const s = state(), b = broker(s); b.readSnapshot();
  for (const change of [() => s.conciergeFocus = { kind: 'modal', scopeId: 'outer', areaIds: [area], controlIds: [action] },
    () => s.conciergeFocus.scopeId = 'nested', () => s.creation.editStoryNativeSceneIndex = 4,
    () => s.creation.editStoryTab = 'video', () => s.creation.projectId = 'p2']) {
    change(); b.update(s); assert.equal(b.knows(action), false); b.readSnapshot(); assert.equal(b.knows(action), true);
  }
  s.conciergeFocus = { kind: 'modal', scopeId: 'unmapped', areaIds: [], controlIds: [] };
  b.update(s); assert.deepEqual(b.readSnapshot().areas, {}); assert.equal(b.knows(action), false);
});

test('modal includes only its own bindings even when sharing a parent area; exact scroll owners survive', () => {
  const s = state();
  s.creation.controls.areas[area].controls.push({ actionId: `${area}.action.background`, enabled: true });
  s.creation.controls.areas[area].scrolls = { parent: { axis: 'vertical' }, modal: { axis: 'horizontal' } };
  s.conciergeFocus = { kind: 'modal', scopeId: 'm', areaIds: [area], controlIds: [action], scrollIds: [`${area}:modal`] };
  const b = broker(s), view = b.readSnapshot();
  assert.equal(view.areas[area].controls.length, 1);
  assert.deepEqual(Object.keys(view.areas[area].scrolls), ['modal']);
  assert.equal(b.knows(`${area}.action.background`), false);
  assert.equal(b.knows(`${area}:modal`), true);
  assert.equal(b.knows(`${area}:parent`), false);
  assert.equal(b.knows(`${area}:invented`), false);
});

test('queries cannot bypass projection through nested objects, arrays or short stored content', () => {
  const s = state(), b = broker(s);
  const roots = `/creation/controls/areas/${area}`;
  const results = query(b, s, ['/creation/blueprint', '/creation/originalRequest', '/creation/editStoryCurrentVideoPrompt',
    `${roots}/state`, `${roots}/state/promptPreview`, `${roots}/controls/0`, `${roots}/controls/0/valueHint`]);
  assert.doesNotMatch(JSON.stringify(results), /SAVED_|RAW_HANDLER|PRIVATE_HINT/);
  assert.equal(results[0].status, 'retrieval_required');
  assert.equal(query(b, s, ['/creation/__proto__/secret'])[0].status, 'outside_foreground');
});

test('current long text has a deferred pointer and complete exact read; displayed prompt remains distinct from editing', () => {
  const s = state(), text = 'Full unsaved value '.repeat(4000);
  s.creation.visibleDrafts[0].value = text;
  const b = broker(s);
  assert.ok(JSON.stringify(b.automatic()).length < 3000);
  assert.equal(query(b, s, ['/creation/visibleDrafts/0/value'])[0].value, text);
  assert.equal(b.readSnapshot().liveFields[0].value, text);
  s.creation.controls.areas = { 'clikb.creation.workstation_image': { controls: [] } };
  s.creation.editStoryIsOpen = true; s.creation.editStoryCurrentImagePrompt = text;
  const view = conciergeVisibleView(s);
  assert.equal(view.liveFields[0].mode, 'displayed-submitted');
  assert.equal(view.liveFields[0].value, text);
});

test('references do not imply unseen memory across requests or users; superseded tool bodies leave paired IDs intact', () => {
  const s = state(), owner = `owner:${++n}`, first = new ConciergeSnapshotBroker(owner, s), full = first.readSnapshot();
  const second = new ConciergeSnapshotBroker(owner, s);
  assert.equal(second.automatic().unchanged, true);
  assert.equal(second.knows(action), false);
  assert.equal(second.readSnapshot().status, 'observed');
  const foreign = new ConciergeSnapshotBroker(`other:${++n}`, s);
  assert.equal(foreign.automatic().scopeChanged, true);
  s.creation.projectId = 'another'; second.update(s);
  const history = second.retireHistory([{ role: 'tool', tool_call_id: 'keep-me', content: JSON.stringify(full) }]);
  assert.equal(history[0].tool_call_id, 'keep-me');
  assert.doesNotMatch(history[0].content, /CURRENT_UNSAVED|\.action\.save/);
  assert.match(history[0].content, /superseded/);
});

test('new complete read replaces an older same-surface body without losing tool pairings', () => {
  const s = state(), b = broker(s), first = b.readSnapshot();
  s.creation.visibleDrafts[0].value = 'CURRENT_SECOND_DRAFT'; b.update(s);
  const second = b.readSnapshot();
  const history = b.retireHistory([first, second].map((body, i) => ({ role: 'tool', tool_call_id: `read-${i}`, content: JSON.stringify(body) })));
  assert.match(history[0].content, /superseded/); assert.equal(history[0].tool_call_id, 'read-0');
  assert.match(history[1].content, /CURRENT_SECOND_DRAFT/); assert.doesNotMatch(JSON.stringify(history), /CURRENT_UNSAVED/);
});

test('broker supplies controls on the first decision and still passes every Jev gate with untouched raw state', async () => {
  const s = state(), b = broker(s), events = [], requests = [];
  const call = (name, args) => ({ id: `call-${requests.length}`, type: 'function', function: { name, arguments: JSON.stringify(args) } });
  const op = { kind: 'click', actionId: action, controlId: `${area}.control.save` };
  const proposal = () => call('virtualGate', { kind: 'click', actionId: action, scrollId: null, direction: null, textValue: null, rationale: 'Save requested text' });
  const responses = [proposal];
  await runConciergeControlLoop({ messages: [{ role: 'user', content: 'Save this draft' }], snapshot: s, userGoal: 'Save this draft', heartbeat: false, observationOnly: false }, {
    snapshotBroker: b, complete: async messages => { requests.push(messages); return { text: 'Saved draft.', calls: responses.length ? [responses.shift()()] : [] }; },
    observe: async () => ({ status: 'observed', snapshot: s }), intent: async (_, raw) => { assert.equal(raw, s); events.push('intent'); return { status: 'ok', intent: 'app_action_requested' }; },
    select: async () => { events.push('select'); return { status: 'selected', operation: op, choice: action, reason: 'exact' }; },
    approve: async () => { events.push('approve'); return { status: 'approved', reason: 'valid' }; },
    execute: async () => { events.push('execute'); return { status: 'settled', mutationSent: true, snapshot: s }; },
    snapshotText: () => { throw Error('Must not auto-render raw snapshot'); }, feedsContext: () => '', stage: () => {}, cancelled: () => false,
  });
  assert.deepEqual(events, ['intent', 'select', 'approve', 'execute']);
  assert.match(JSON.stringify(requests[0]), /\.action\.save/);
  assert.doesNotMatch(JSON.stringify(requests), /snapshot_read_required/);
  assert.doesNotMatch(JSON.stringify(requests), /SAVED_|RAW_HANDLER|PRIVATE_HINT/);
});

// Tiny deterministic DOM contract: no browser, network, paid generation or dependencies.
function element(dataset = {}, extra = {}) { return { dataset, parentElement: null, type: 'text', value: 'draft', readOnly: false, disabled: false,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 40 }), getAttribute: () => null,
  closest: () => null, contains: () => false, querySelectorAll: () => [], ...extra }; }
function documentFor(modals, children) { return { defaultView: { innerWidth: 1000, innerHeight: 1000,
  getComputedStyle: e => ({ display: 'block', visibility: 'visible', zIndex: String(e.z || 0) }) },
  querySelectorAll: selector => selector.startsWith('[role=') ? modals : selector === '[data-ai-scroll]' ? [] : children,
  elementFromPoint: () => null, createTreeWalker: () => ({ nextNode: () => null }) }; }
test('central DOM measurement ignores Guide dialogs, picks top nested modal and preserves full visible readonly/editable text', () => {
  const s = state(), control = s.creation.controls.areas[area].controls[0]; control.kind = 'text';
  const field = element({ aiAction: action }, { value: 'current '.repeat(8000) });
  const lower = element({}, { z: 10 }), upper = element({}, { z: 20, querySelectorAll: selector => selector === '[data-ai-scroll]' ? [] : [field] });
  const guide = element({}, { z: 10000, closest: () => ({ ignored: true }) });
  const doc = documentFor([lower, upper, guide], []), focus = conciergeVisibleSurface(s, doc);
  assert.equal(focus.kind, 'modal'); assert.deepEqual(focus.controlIds, [action]);
  assert.equal(focus.textFields[0].value, field.value); assert.equal(focus.textFields[0].mode, 'editing-draft');
  field.readOnly = true; assert.equal(conciergeVisibleSurface(s, doc).textFields[0].mode, 'displayed-submitted');
  const oldRef = focus.scopeId; doc.querySelectorAll = selector => selector.startsWith('[role=') ? [lower] : [];
  assert.notEqual(conciergeVisibleSurface(s, doc).scopeId, oldRef);
});

test('manual Precise foreground exposes compact state without controls or the underlying scene prompt', () => {
  const id='clikb.creation.workstation_precise', s=state();
  s.creation.editStoryIsOpen=true;s.creation.editStoryCurrentImagePrompt='COVERED_SCENE_PROMPT';
  s.creation.controls.areas[id]={state:{model:'Flare',pixels:6,regions:2,references:1,status:'ready'},controls:[]};
  const modal=element({}, {z:100,closest:selector=>selector==='[data-precise-editor="true"]'?modal:null});
  s.conciergeFocus=conciergeVisibleSurface(s,documentFor([modal],[]));
  assert.deepEqual(s.conciergeFocus.areaIds,[id]);
  assert.deepEqual(s.conciergeFocus.controlIds,[]);
  const view=conciergeVisibleView(s);
  assert.deepEqual(view.areas[id].state,{model:'Flare',pixels:6,regions:2,references:1,status:'ready'});
  assert.deepEqual(view.areas[id].controls,[]);assert.deepEqual(view.liveFields,[]);
  assert.doesNotMatch(JSON.stringify(view),/COVERED_SCENE_PROMPT/);
});

test('creation retrieval distinguishes native Cinema stage B, logical scene/stage and parent-owned B-roll', () => {
  const s = { creation: { mode: 'cinema', previewSceneCount: 10, editStoryIsOpen: true, editStoryIsBShot: true,
    editStoryNativeSceneIndex: 9, editStoryParentSceneIndex: 5, editStoryBShotIndex: 2 } };
  assert.equal(resolveConciergeCreationTarget(s, 'Scene 2 stage B image prompt').nativeSceneNumber, 2);
  assert.equal(resolveConciergeCreationTarget(s, 'logical scene 2 stage B image prompt').nativeSceneNumber, 4);
  assert.equal(resolveConciergeCreationTarget(s, 'Scene 2 stage A image prompt').status, 'ambiguous_target');
  assert.equal(resolveConciergeCreationTarget(s, 'logical scene 2 prompt').status, 'ambiguous_target');
  const target = resolveConciergeCreationTarget(s, 'Scene 5 B-roll 3 image prompt');
  assert.equal(target.nativeSceneNumber, 5); assert.equal(target.bShotNumber, 3);
  assert.equal(resolveConciergeCreationTarget(s, 'current B-shot prompt').nativeSceneNumber, 5);
  assert.equal(resolveConciergeCreationTarget(s, 'current B-shot prompt').bShotNumber, 2);
  assert.equal(resolveConciergeCreationTarget(s, 'Scene 4 video prompt').bShotNumber, undefined);
  assert.equal(resolveConciergeCreationTarget(s, 'Scene 40 video prompt').status, 'not_found');
});

test('layered composer over page exposes Creation, backdrop Deck, and Navigation shell together until ui.minimisePrompt hides Creation', () => {
  const { conciergeSurfaceLayers } = load('server/src/ConciergeSnapshotBroker.ts');
  const s = {
    route: '/images',
    ui: { minimisePrompt: false },
    autoControl: { enabled: true, videoEnabled: false },
    navigation: {
      areas: {
        'clikb.navigation.shell': {
          state: { route: '/images' },
          visibleControls: [{ controlId: 'clikb.navigation.shell.control.home', candidateActionId: 'clikb.navigation.shell.action.home', enabled: true, aiPolicy: 'candidate', label: 'Home' }],
        },
      },
    },
    feeds: {
      activeAreaIds: ['clikb.feeds.deck'],
      areas: {
        'clikb.feeds.deck': {
          state: { activeCategory: 'Cinema' },
          visibleControls: [{ controlId: 'clikb.feeds.deck.control.shorts', candidateActionId: 'clikb.feeds.deck.action.shorts', enabled: true, aiPolicy: 'candidate', label: 'Shorts' }],
        },
      },
    },
    creation: {
      isActive: true,
      projectId: 'p-layer',
      stage: 'composer',
      isInitialComposer: true,
      isCompactOverlay: true,
      sceneSlots: [
        { slotKey: 'scene:1', sceneNumber: 1, bShotNumber: null, hasPreviewImage: true, hasHdImage: true, hasVideo: false, hdVersion: 'v1', brief: 'SECRET_SLOT_BRIEF_TEXT' },
      ],
      confirmedFailuresByTarget: {
        'p-layer:image:A:0': { attemptId: 'att-1', failureId: 'fail:att-1', projectId: 'p-layer', mediaKind: 'image', targetKey: 'A:0', sceneNumber: 1, message: 'Timeout', failedAt: 10 },
      },
      controls: {
        stateVersion: 1,
        areas: {
          'clikb.creation.styles': {
            state: { ready: true },
            controls: [{ controlId: 'clikb.creation.styles.control.close_composer', actionId: 'clikb.creation.styles.action.close_composer', kind: 'click', enabled: true, policy: 'candidate', label: 'Close Creation composer' }],
          },
        },
      },
    },
  };

  const openLayers = conciergeSurfaceLayers(s);
  assert.equal(openLayers.mode, 'layered_composer_over_page');
  assert.equal(openLayers.areaLayers['clikb.creation.styles'], 'floating_overlay');
  assert.equal(openLayers.areaLayers['clikb.feeds.deck'], 'backdrop');
  assert.equal(openLayers.areaLayers['clikb.navigation.shell'], 'shell');

  const b = broker(s);
  const view = b.readSnapshot();
  assert.equal(view.surfaceMode, 'layered_composer_over_page');
  assert.ok(view.areas['clikb.creation.styles']);
  assert.ok(view.areas['clikb.feeds.deck']);
  assert.ok(view.areas['clikb.navigation.shell']);
  assert.equal(view.progress.confirmedFailures.length, 1);

  const slotRead = query(b, s, ['/creation/sceneSlots']);
  assert.equal(slotRead[0].value[0].slotKey, 'scene:1');
  assert.doesNotMatch(JSON.stringify(slotRead), /SECRET_SLOT_BRIEF_TEXT/);

  // Minimizing via ui.minimisePrompt hides Creation overlay and leaves Deck + Navigation active
  s.ui.minimisePrompt = true;
  b.update(s);
  const minLayers = conciergeSurfaceLayers(s);
  assert.equal(minLayers.mode, 'browsing_page');
  assert.equal(minLayers.areaLayers['clikb.creation.styles'], undefined);
  assert.ok(minLayers.areaIds.includes('clikb.feeds.deck'));
  assert.ok(minLayers.areaIds.includes('clikb.navigation.shell'));
});
