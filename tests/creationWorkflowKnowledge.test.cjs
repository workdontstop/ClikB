const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
function load(file, mocks = {}, cache = new Map()) {
  const filename = path.resolve(root, file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.')
    ? load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)), mocks, cache)
    : Module.prototype.require.call(mod, name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return mod.exports;
}

const source = fs.readFileSync(path.join(root, 'docs/apps live rag fro app control/03_creation_intro.rag.txt'), 'utf8').replace(/\r\n/g, '\n');
const packet = { ragId: 'clikb_creation', title: 'ClikB Creation', instructions: source };
const snapshot = load('server/src/imagePacerWorkflowSnapshot.ts');
const { selectImagePacerWorkflowKnowledge, selectConciergePacketKnowledge, selectCompactConciergePacketKnowledge } = load('server/src/ConciergeKnowledge.ts');
const { activeRagExcerpt } = load('server/src/JevActionGate.ts', { './JevDecisionService': {} });
const { replaceConciergeContextBlocks, compileConciergeModelSnapshot } = load('server/src/ConciergeContext.ts');
const { querySnapshotFields } = load('server/src/ConciergeTools.ts');
const { createImagePacerWorkflowKnowledgeLoader } = load('server/src/creationWorkflowKnowledge.ts', {
  './PostDatabase': { findUploadedRagInstructionById: async () => assert.fail('Tests must not access the database') },
});

test('Creation Deck knowledge separates showing and opening an exact scene and keeps creation exit confirmed', () => {
  const current = { creation: { isActive: true, controls: { areas: {
    'clikb.creation.deck_view': { controls: [{ actionId: 'clikb.creation.deck_view.action.settings' }] },
    'clikb.creation.storybook_toolbar': { controls: [{ actionId: 'clikb.creation.storybook_toolbar.action.close' }] },
  } } } };
  const selected = selectConciergePacketKnowledge(packet, current);
  assert.equal(selected.fallback, false);
  assert.match(selected.instructions, /show_scene brings that card into view/);
  assert.match(selected.instructions, /open_scene opens its workstation where available and Back returns to the previously centred card/);
  assert.match(selected.instructions, /The final red Exit creation action/);
  assert.match(selected.instructions, /Stage A\/B and attached B-roll/);
});

test('Social and Creative Profile controls retain matching Jev rules after foreground packet selection', () => {
  const ragId = 'clikb_navigation_shell';
  const instructions = fs.readFileSync(path.join(root, 'docs/apps live rag fro app control/01_navigation_profile_settings.rag.txt'), 'utf8');
  const nav = { ragId, title: 'Navigation', instructions };
  const chat = 'clikb.navigation.social_chat';
  const groups = {
    [chat]: ['close', 'tab_global', 'tab_feeds', 'tab_post', 'tab_notifications', 'tab_rooms', 'filter_all', 'filter_likes',
      'filter_chats', 'pause', 'resume', 'room_list', 'notification_31', 'dismiss_31', 'expand_legacy-44', 'reply_legacy-44', 'post_44',
      'share_44', 'remove_reference', 'compose', 'send', 'new_room', 'member_search', 'room_member_18', 'room_open_93', 'options_44',
      'start_room_44', 'report_44', 'block_44', 'load_older', 'retry'],
    'clikb.navigation.profile_image': ['close', 'upload', 'ai_prompt', 'image_prompt', 'toggle_prompt', 'mode_recreate', 'mode_edit', 'quality_hd', 'quality_sd2', 'quality_sd', 'generate', 'inspect', 'close_inspect', 'remove', 'use'],
    'clikb.navigation.creative_profiles_settings': ['profile_14', 'expand', 'create', 'username', 'retry_username', 'create_submit', 'delete_14', 'delete_submit', 'close_dialog'],
    'clikb.navigation.creative_profiles_profile': ['profile_14', 'expand', 'create', 'username', 'retry_username', 'create_submit', 'use', 'main', 'visit_main', 'details', 'profile_name', 'profile_bio', 'save_details', 'close_dialog'],
    'clikb.navigation.creative_profiles_cover': ['use', 'main', 'visit_main', 'details', 'profile_name', 'profile_bio', 'save_details', 'close_dialog'],
  };
  for (const [areaId, names] of Object.entries(groups)) {
    for (const name of names) {
      const actionId = `${areaId}.action.${name}`;
      const controlId = `${areaId}.control.${name}`;
      const current = { navigation: { areas: { [areaId]: {} }, availableActions: [{ actionId, controlId }] } };
      const packet = selectConciergePacketKnowledge(nav, current);
      assert.equal(packet.fallback, false);
      const rag = `ACTIVE_SNAPSHOT_MODE_RAG_ID: ${ragId}\n${packet.instructions}`;
      const exactRule = name.replace(/_(?:legacy-)?\d+$/, '_<id>');
      assert.ok(activeRagExcerpt(rag, { kind: 'click', actionId, controlId }).includes(`.action.${exactRule}`), actionId);
    }
  }
  const browse = selectConciergePacketKnowledge(nav, {});
  assert.equal(browse.selectedSections.includes('socialChatActions'), false);
  assert.equal(browse.selectedSections.includes('creativeProfileActions'), false);
  for (const [areaId, key, expected] of [
    ['clikb.navigation.profile_image', 'content', 'clikb.navigation.profile_image:content'],
    [chat, 'list', `${chat}:list`],
    ['clikb.navigation.creative_profiles_profile', 'row', 'creative_profiles_<surface>:row'],
    ['clikb.navigation.creative_profiles_settings', 'list', 'creative_profiles_<surface>:list'],
  ]) {
    const current = { navigation: { areas: { [areaId]: { scrolls: { [key]: { canScrollForward: true } } } } } };
    const packet = selectConciergePacketKnowledge(nav, current);
    const rag = `ACTIVE_SNAPSHOT_MODE_RAG_ID: ${ragId}\n${packet.instructions}`;
    assert.ok(activeRagExcerpt(rag, { kind: 'scroll', scrollId: `${areaId}:${key}`, direction: 'forward' }).includes(expected));
  }
  const feedId = 'clikb_feeds';
  const feeds = { ragId: feedId, title: 'Feeds', instructions: fs.readFileSync(path.join(root, 'docs/apps live rag fro app control/02_feeds_usage.rag.txt'), 'utf8') };
  const actionId = 'clikb.feeds.fullscreen.games.1.open_post_chat';
  const selected = selectConciergePacketKnowledge(feeds, { feeds: { availableActions: [{ actionId }] } });
  const rag = `ACTIVE_SNAPSHOT_MODE_RAG_ID: ${feedId}\n${selected.instructions}`;
  assert.match(activeRagExcerpt(rag, { kind: 'click', actionId, controlId: actionId }), /current displayed post/);
});

test('each World control resolves to its own live Creation RAG rule', () => {
  const id = '550e8400-e29b-41d4-a716-446655440000';
  const groups = {
    worlds: ['scroll', 'page_page_2|page_<itemtype>_<pagenumber>', ...['open', 'request_delete', 'cancel_delete', 'delete'].map(key => key + '_8|' + key + '_<worldid>')],
    world_detail: ['scroll', 'description_world_8|description_world_<worldid>', 'section_world_8_blueprint|section_world_<worldid>_blueprint',
      'section_world_8_original_prompt|section_world_<worldid>_original_prompt', 'use', 'edit_world', 'back',
      ...['section', 'character', 'copy', 'copy_dialog', 'close_copy'].map(key => key + '_world_8_character_12|' + key + '_world_<worldid>_character_<assetid>')],
    storybook_grid: ['create_world'],
    storybook_world_entry: ['close'],
    storybook_world: ['scroll', 'edit_title', 'edit_description', 'edit_blueprint', 'generate_blueprint',
      'add_character|add_<kind>', 'add_environment|add_<kind>', 'add_object|add_<kind>',
      'asset_12|asset_<assetid>', 'remove_' + id + '|remove_<assetid>', 'asset_name', 'asset_description',
      'mode_recreate', 'mode_edit', 'upload_asset', 'reference_picker', 'reference_scroll', 'reference_none',
      'reference_19|reference_<index>', 'use_asset_reference', 'image_prompt', 'generate_asset', 'close', 'create'],
  };
  for (const [area, keys] of Object.entries(groups)) {
    const areaId = 'clikb.creation.' + area;
    const active = { creation: { isActive: true, mode: 'shorts', controls: { areas: { [areaId]: {} } } } };
    const knowledge = selectConciergePacketKnowledge(packet, active);
    assert.equal(knowledge.fallback, false, area);
    const rag = 'ACTIVE_SNAPSHOT_MODE_RAG_ID: clikb_creation\n' + knowledge.instructions;
    for (const entry of keys) {
      const [key, rule = key] = entry.split('|');
      const actionId = areaId + '.action.' + key;
      const op = key.endsWith('scroll') ? { kind: 'scroll', scrollId: actionId, direction: 'forward' } :
        { kind: 'click', actionId, controlId: areaId + '.control.' + key };
      assert.ok(activeRagExcerpt(rag, op).toLowerCase().includes(rule), actionId);
    }
  }
  const priorToOpening = selectCompactConciergePacketKnowledge(packet, { creation: { mode: 'shorts' } }, 'Edit a saved World');
  assert.match(priorToOpening.instructions, /reference_scroll/);
});

test('image pacing selects actual local workflow knowledge without execution controls or story-specific recipes', () => {
  const selected = selectImagePacerWorkflowKnowledge(packet);
  assert.equal(selected.fallback, false);
  assert.deepEqual(selected.selectedSections, ['modeOverview', 'visualHierarchy', 'modeSemantics', 'imagePromptPacing']);
  assert.match(selected.instructions, /complete-scene writer/);
  assert.match(selected.instructions, /Image Prompt Pacer/);
  assert.match(selected.instructions, /collective membership/);
  const { LANGUAGE_MODEL_TIERS } = load('server/src/languageModels.ts');
  for (const [tier, label] of Object.entries({ luna: 'Luna', luna_extra: 'Luna Extra', terra: 'Terra', sol: 'Sol', deepseek: 'DeepSeek', kimi: 'Kimi' })) {
    assert.ok(selected.instructions.includes(`${label} ${LANGUAGE_MODEL_TIERS[tier].pixels} P`), `missing current ${label} quote`);
  }
  assert.match(selected.instructions, /current editable paced image prompt is the current starting depiction and rewrite target/);
  assert.match(selected.instructions, /last committed intent before the new edit/);
  assert.match(selected.instructions, /can replace the entire scene/);
  assert.doesNotMatch(selected.instructions, /virtualGate|controlExecutionContract|userSnapshot\.|\bactionId\b|\bscrollId\b/);
  assert.doesNotMatch(selected.instructions, /\bdonut\b|\bhandgun\b|\bhelicopter\b|\bwoman drinking\b|\bfour angels\b|\balien race\b/i);
  const concierge = selectConciergePacketKnowledge(packet, { creation: { isActive: true, mode: 'shorts', controls: { areas: { 'clikb.creation.setup': {} } } } });
  assert.equal(concierge.fallback, false);
  assert.ok(concierge.selectedSections.includes('imagePromptPacing'));
  assert.ok(concierge.selectedSections.includes('controlKeys'));
  assert.match(concierge.instructions, /virtualGate/);
});

test('uploaded Windows line endings produce the same workflow selection as the bundled source', () => {
  assert.equal(selectImagePacerWorkflowKnowledge({ ...packet, instructions: source.replace(/\n/g, '\r\n') }).instructions,
    selectImagePacerWorkflowKnowledge(packet).instructions);
});

test('bundled deployment fallback exactly matches the local RAG selection and source revision', () => {
  assert.equal(snapshot.BUNDLED_IMAGE_PACER_WORKFLOW_VERSION, Number(source.match(/\bversion:\s*(\d+)/)[1]));
  assert.equal(snapshot.BUNDLED_IMAGE_PACER_WORKFLOW_KNOWLEDGE, selectImagePacerWorkflowKnowledge(packet).instructions);
  assert.equal(snapshot.BUNDLED_IMAGE_PACER_WORKFLOW_SOURCE_SHA256, crypto.createHash('sha256').update(source).digest('hex'));
  const generated = require('../scripts/sync-image-pacer-workflow.cjs').buildWorkflowSnapshot();
  assert.equal(fs.readFileSync(path.join(root, 'server/src/imagePacerWorkflowSnapshot.ts'), 'utf8').replace(/\r\n/g, '\n'), generated);
});

test('the shared literal parser rejects executable or unrelated packets instead of injecting their controls', () => {
  const executable = '[RAG clikbKnowledge] Object { modeOverview: `${globalThis.untrustedWorkflowCode = true}` }';
  for (const candidate of [
    { ...packet, ragId: 'clikb_deck' },
    { ...packet, instructions: executable },
    { ...packet, instructions: '[RAG] Object { modeOverview: "safe" }; globalThis.untrustedWorkflowCode = true' },
  ]) {
    const result = selectImagePacerWorkflowKnowledge(candidate);
    assert.equal(result.instructions, '');
    assert.equal(result.fallback, true);
  }
  assert.equal(globalThis.untrustedWorkflowCode, undefined);
});

test('concurrent scenes share an exact uploaded packet lookup, then refresh after the brief cache expires', async () => {
  let time = 0, calls = 0, release;
  const waiting = new Promise(resolve => { release = resolve; });
  const remotePacket = { ...packet, instructions: source.replace('topic: "ClikB Creation"', 'topic: "Uploaded Creation"').replace('complete-scene writer', 'uploaded complete-scene writer') };
  const get = createImagePacerWorkflowKnowledgeLoader({
    lookup: async id => { assert.equal(id, 'clikb_creation'); calls++; return calls === 1 ? waiting : remotePacket; },
    now: () => time, cacheMs: 30, lookupTimeoutMs: 1000,
  });
  const a = get(), b = get();
  assert.equal(calls, 1);
  release(remotePacket);
  const [first, second] = await Promise.all([a, b]);
  assert.equal(first, second);
  assert.match(first, /uploaded complete-scene writer/);
  assert.equal(await get(), first);
  assert.equal(calls, 1);
  time = 31;
  assert.equal(await get(), first);
  assert.equal(calls, 2);
});

test('missing, unavailable, old or malformed uploads preserve the exact bundled workflow without a model call', async () => {
  const oldPacket = { ...packet, instructions: '[RAG] Object { modeOverview: "Older workflow", visualHierarchy: "request to image", modeSemantics: { shorts: "one main shot" } }' };
  for (const lookup of [async () => null, async () => { throw new Error('database unavailable'); }, async () => oldPacket, async () => ({ ...packet, instructions: 'invalid' })]) {
    const get = createImagePacerWorkflowKnowledgeLoader({ lookup });
    assert.equal(await get(), snapshot.BUNDLED_IMAGE_PACER_WORKFLOW_KNOWLEDGE);
  }
});

test('a stalled exact lookup has a bounded fallback and does not block paid generation indefinitely', async () => {
  const get = createImagePacerWorkflowKnowledgeLoader({ lookup: () => new Promise(() => {}), lookupTimeoutMs: 5 });
  assert.equal(await get(), snapshot.BUNDLED_IMAGE_PACER_WORKFLOW_KNOWLEDGE);
});

test('compact concierge packet knowledge selects only active-mode and mounted/goal-referenced creation areas while keeping full Jev gate evidence intact', () => {
  const sceneEditorSnapshot = {
    creation: {
      isActive: true,
      mode: 'shorts',
      editStoryIsOpen: true,
      controls: {
        areas: {
          'clikb.creation.workstation_image': {},
          'clikb.creation.storybook_grid': {},
        },
      },
    },
  };
  const compact = selectCompactConciergePacketKnowledge(packet, sceneEditorSnapshot, 'Close this scene');
  const fullGate = selectConciergePacketKnowledge(packet, sceneEditorSnapshot);
  assert.equal(compact.fallback, false);
  assert.equal(fullGate.fallback, false);
  assert.ok(!compact.selectedSections.includes('imagePromptPacing'));
  assert.ok(compact.instructions.length < fullGate.instructions.length * 0.45, `Expected compact (${compact.instructions.length}) < 45% of full (${fullGate.instructions.length})`);
  assert.match(compact.instructions, /workstation_image/);
  assert.match(compact.instructions, /availableAreaDirectory/);
  assert.ok(fullGate.selectedSections.includes('imagePromptPacing'));

  const navSource = '[RAG clikbKnowledge] clikb_navigation_shell Object {\n  topic: "ClikB Navigation Shell",\n  contract: "Navigation shell contract...",\n  settingsControls: ["clikb.navigation.settings.action.theme_dark switches theme to dark mode"]\n}';
  const navCompact = selectCompactConciergePacketKnowledge({ ragId: 'clikb_navigation_shell', title: 'Nav', instructions: navSource }, sceneEditorSnapshot, 'Refine this scene');
  assert.deepEqual(navCompact.selectedSections, ['topic', 'backgroundDirectory']);
  assert.ok(navCompact.instructions.length < 350);
  const navWhenAsked = selectCompactConciergePacketKnowledge({ ragId: 'clikb_navigation_shell', title: 'Nav', instructions: navSource }, sceneEditorSnapshot, 'Switch theme to dark mode in settings');
  assert.ok(navWhenAsked.selectedSections.includes('contract'));
});

test('Precise knowledge is retrievable for its state-only foreground without inventing app actions', () => {
  const id = 'clikb.creation.workstation_precise';
  const current = { creation: { isActive: true, mode: 'shorts', editStoryIsOpen: true,
    controls: { areas: { [id]: { state: { model: 'Flare', pixels: 6, regions: 2, references: 1, status: 'ready' }, controls: [] } } } },
    conciergeFocus: { kind: 'modal', areaIds: [id], controlIds: [], textFields: [] } };
  for (const selected of [selectConciergePacketKnowledge(packet, current), selectCompactConciergePacketKnowledge(packet, current, 'Explain Precise')]) {
    assert.equal(selected.fallback, false);
    assert.match(selected.instructions, /full-screen popup for manual use only/);
    assert.match(selected.instructions, /whole current first-frame image-pacing description/);
    assert.match(selected.instructions, /preserves any existing video result/);
    assert.match(selected.instructions, /Every new opening starts with Krea 3 selected/);
    assert.match(selected.instructions, /Every paid result is retained in the scene image history/);
    assert.match(selected.instructions, /Cancel leaves the active workstation image and prompt unchanged/);
    assert.doesNotMatch(selected.instructions, /workstation_precise\.(?:action|control)\./);
  }
});

test('replaceConciergeContextBlocks updates prefix slots in-place without invalidating prompt cache order across tool turns', () => {
  const initial = [
    { role: 'system', content: 'SYSTEM_PROMPT' },
    { role: 'system', clikbContext: 'knowledge', content: 'KNOWLEDGE_V1' },
    { role: 'system', clikbContext: 'memory', content: 'MEMORY_V1' },
    { role: 'system', clikbContext: 'snapshot', content: 'SNAPSHOT_V1' },
    { role: 'user', content: 'Close scene' },
    { role: 'assistant', content: '', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'virtualGate', arguments: '{}' } }] },
    { role: 'tool', tool_call_id: 'call_1', content: '{"ok":true}' },
  ];
  const updated = replaceConciergeContextBlocks(initial, [
    { role: 'system', clikbContext: 'knowledge', content: 'KNOWLEDGE_V1' },
    { role: 'system', clikbContext: 'memory', content: 'MEMORY_V1' },
    { role: 'system', clikbContext: 'task', content: 'TASK_V1' },
    { role: 'system', clikbContext: 'actions', content: 'ACTIONS_V2' },
    { role: 'system', clikbContext: 'snapshot', content: 'SNAPSHOT_V2' },
  ]);
  assert.equal(updated[0].content, 'SYSTEM_PROMPT');
  assert.equal(updated[1].clikbContext, 'knowledge');
  assert.equal(updated[2].clikbContext, 'memory');
  assert.equal(updated[3].clikbContext, 'task');
  assert.equal(updated[4].role, 'user');
  assert.equal(updated[5].role, 'assistant');
  assert.equal(updated[6].role, 'tool');
  assert.equal(updated[7].clikbContext, 'actions');
  assert.equal(updated[8].clikbContext, 'snapshot');
});

test('compileConciergeModelSnapshot bounds offscreen fields while preserving native scene indices and queryLiveSnapshot returns full raw values on demand', () => {
  const longPrompt = 'A dramatic cyberpunk neon alley in the rain. '.repeat(20);
  const rawSnapshot = {
    route: '/Create',
    app: { prompt: longPrompt },
    creation: {
      isActive: true,
      mode: 'cinema',
      stage: 'storybook',
      editStoryIsOpen: true,
      storybookSceneIndex: 2,
      editStoryCurrentSceneNumber: 3,
      editStoryNativeSceneIndex: 4,
      editStoryParentSceneIndex: 2,
      editStoryIsBShot: true,
      editStoryBShotIndex: 1,
      editStoryCurrentImagePrompt: 'Scene 3 B-shot 1 prompt',
      controls: { areas: { 'clikb.creation.workstation_image': { state: {} } } },
    },
    feeds: {
      route: '/',
      activeAreaIds: ['clikb.feeds.deck'],
      availableActions: [{ actionId: 'clikb.feeds.deck.select_category:shorts' }],
      posts: [{ id: 1, title: 'Offscreen feed item' }],
    },
  };
  const compiled = compileConciergeModelSnapshot(rawSnapshot, { userGoal: 'Close the current B-shot scene' });
  assert.ok(compiled.app.prompt.length < longPrompt.length);
  assert.equal(compiled.app.promptLength, longPrompt.length);
  assert.equal(compiled.creation.storybookSceneIndex, 2);
  assert.equal(compiled.creation.editStoryNativeSceneIndex, 4);
  assert.equal(compiled.creation.editStoryParentSceneIndex, 2);
  assert.equal(compiled.creation.editStoryBShotIndex, 1);
  assert.ok(typeof compiled.feeds.backgroundSummary === 'string' && compiled.feeds.backgroundSummary.includes('queryLiveSnapshot'));

  // Verify read-tool contract: compacted fields differ between raw and compiled so queryLiveSnapshot returns full raw value
  const rawQueried = querySnapshotFields(rawSnapshot, ['/app/prompt', '/creation/editStoryNativeSceneIndex']);
  const compiledQueried = querySnapshotFields(compiled, ['/app/prompt', '/creation/editStoryNativeSceneIndex']);
  assert.notEqual(JSON.stringify(rawQueried[0].value), JSON.stringify(compiledQueried[0].value));
  assert.equal(rawQueried[0].value, longPrompt);
  assert.equal(JSON.stringify(rawQueried[1].value), JSON.stringify(compiledQueried[1].value));
});

test('stop-at-Publish goals retain mounted stage knowledge without attaching the finish pipeline to earlier stages', () => {
  const multiStageGoal = 'Create a 2-scene Cinema story with character references, style and music, and stop at Publish';
  const stages = [
    { name: 'setup', snapshot: { route: '/Create', creation: { isActive: true, mode: 'cinema', stage: 'setup', controls: { areas: { 'clikb.creation.setup': {} } } } } },
    { name: 'confirmation', snapshot: { route: '/Create', creation: { isActive: true, mode: 'cinema', stage: 'confirmation', controls: { areas: { 'clikb.creation.confirmation': {} } } } } },
    { name: 'preview_choice', snapshot: { route: '/Create', creation: { isActive: true, mode: 'cinema', stage: 'preview-choice', controls: { areas: { 'clikb.creation.preview_choice': {} } } } } },
    { name: 'character_studio', snapshot: { route: '/Create', creation: { isActive: true, mode: 'cinema', stage: 'character-studio', controls: { areas: { 'clikb.creation.character_studio': {} } } } } },
    { name: 'storybook_grid', snapshot: { route: '/Create', creation: { isActive: true, mode: 'cinema', stage: 'storybook', editStoryIsOpen: false, controls: { areas: { 'clikb.creation.storybook_start': {}, 'clikb.creation.storybook_toolbar': {}, 'clikb.creation.storybook_grid': {} } } } } },
    { name: 'workstation_image', snapshot: { route: '/Create', creation: { isActive: true, mode: 'cinema', stage: 'storybook', editStoryIsOpen: true, controls: { areas: { 'clikb.creation.workstation_navigation': {}, 'clikb.creation.workstation_image': {} } } } } },
    { name: 'workstation_video', snapshot: { route: '/Create', creation: { isActive: true, mode: 'cinema', stage: 'storybook', editStoryIsOpen: true, controls: { areas: { 'clikb.creation.workstation_navigation': {}, 'clikb.creation.workstation_video': {} } } } } },
  ];

  for (const st of stages) {
    const selected = selectCompactConciergePacketKnowledge(packet, st.snapshot, multiStageGoal);
    assert.equal(selected.fallback, false, st.name);
    assert.ok(selected.selectedSections.includes('areas'), st.name);
    assert.ok(selected.selectedSections.includes('controlKeys'), st.name);
    assert.ok(!selected.selectedSections.includes('finishPipeline'), st.name);
    for (const area of Object.keys(st.snapshot.creation.controls.areas)) {
      const key = area.replace('clikb.creation.', '');
      // Navigation controls are documented under their image/video owner rather than a separate packet section.
      if (source.includes(`${key}:`)) assert.ok(selected.instructions.includes(key), `${st.name}: ${area}`);
    }
  }
  const publish = { creation: { isActive: true, mode: 'cinema', controls: { areas: { 'clikb.creation.storybook_publish': {} } } } };
  assert.ok(selectCompactConciergePacketKnowledge(packet, publish, multiStageGoal).selectedSections.includes('finishPipeline'));
});

const recordedLedgerPath = path.resolve(__dirname, '../server/logs/conversation-cost-ledger.json');
test('offline replay uses actual recorded snapshots and production source assembly, and does not invent new whole-session usage or call savings', {
  skip: !fs.existsSync(recordedLedgerPath) && 'Local historical ledger is unavailable; no fixture is substituted',
}, async t => {
  const { replayRecordedContext, collectObservedSnapshots, DEFAULT_SESSION } = require('../scripts/replay-concierge-context.cjs');
  const ledger = JSON.parse(fs.readFileSync(recordedLedgerPath, 'utf8'));
  const session = (ledger.sessions || []).find(item => item.sessionId === DEFAULT_SESSION);
  if (!session) { t.skip('Requested historical session is unavailable; no fixture is substituted'); return; }
  const report = await replayRecordedContext({ session, packet });
  assert.equal(report.observationCount, collectObservedSnapshots(session).length);
  assert.ok(report.observationCount > 0);
  assert.ok(report.observations.every(row => row.sourcePath.startsWith('/records/')));
  assert.ok(report.observations.every(row => row.snapshotJsonBefore > 1000));
  assert.ok(report.observations.every(row => row.providerSourcesAfter > row.snapshotJsonAfter));
  assert.equal(report.newWholeSessionInputTokens, null);
  assert.equal(report.newWholeSessionProviderCalls, null);
  assert.equal(report.newWholeSessionCostUsd, null);
  const recordedCalls = session.records.filter(record => record.route === '/startBrainstormStream')
    .reduce((sum, record) => sum + record.calls.filter(call => call.model === 'gpt-6-luna').length, 0);
  assert.equal(report.historicalInputTelemetry.recordedMainProviderCalls, recordedCalls);
  assert.ok(report.limitations.some(line => line.includes('Missing request blocks')));
});


test('draft and Remix knowledge remains available in selected active Creation, Feeds and Deck packets', () => {
  const selected = selectConciergePacketKnowledge(packet, { creation: { isActive: true, mode: 'shorts', controls: { areas: { 'clikb.creation.setup': {} } } } });
  assert.equal(selected.fallback, false);
  assert.ok(selected.selectedSections.includes('creationDrafts'));
  assert.match(selected.instructions,/same unpublished post identity/);
  assert.match(selected.instructions,/Users can freely remix their own posts/);
  assert.match(selected.instructions,/someone else’s post, that post must have Allow remix turned On/);
  assert.doesNotMatch(selected.instructions,/Development Guest|Production Guest|Guest environment restrictions/);
  for (const [id,file,section] of [['clikb_feeds','02_feeds_usage.rag.txt','creationDraftPosts'],['clikb_deck','04_deck_overlay.rag.txt','creationDraftEntries']]) {
    const instructions=fs.readFileSync(path.join(root,'docs/apps live rag fro app control',file),'utf8');
    const knowledge=selectConciergePacketKnowledge({ragId:id,title:id,instructions},{feeds:{isActive:true},deck:{isOpen:true}});
    assert.equal(knowledge.fallback,false);assert.ok(knowledge.selectedSections.includes(section));
    assert.match(knowledge.instructions,/Clean Deck/);
    assert.match(knowledge.instructions,/Users can freely remix their own posts/);
    assert.match(knowledge.instructions,/someone else’s post, that post must have Allow remix turned On/);
    assert.doesNotMatch(knowledge.instructions,/Development Guest|Production Guest|Guest environment restrictions/);
  }
});
