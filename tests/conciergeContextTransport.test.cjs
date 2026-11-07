const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const load = require('./loadTs.cjs');
const context = load('server/src/ConciergeContext.ts');
const { createConciergeRetrieval } = load('server/src/ConciergeRetrieval.ts');
const { buildConciergePromptPolicy } = load('server/src/ConciergePromptPolicy.ts');
const { CONCIERGE_TOOLS, CONCIERGE_CONTROL_PROMPT } = load('server/src/ConciergeTools.ts');
const { ConciergeResponseSession } = load('server/src/ConciergeInference.ts');
const { runConciergeControlLoop } = load('server/src/ConciergeControlLoop.ts');

test('both provider adapters exclude system/developer RAG but preserve read-only tool data and current state', async () => {
  const messages = [
    { role: 'system', content: buildConciergePromptPolicy(1) },
    { role: 'system', clikbContext: 'knowledge', content: 'uploaded instructions' },
    { role: 'developer', content: 'CLIKB_SESSION_RECALL\nprivate session facts' },
    { role: 'system', content: 'Older review\nSESSION_RECALL_STATUS: found\nprivate creation facts' },
    { role: 'system', content: 'LIVE USER SNAPSHOT.\n' + JSON.stringify({ stage: 'setup', prompt: 'SESSION_RECALL_STATUS: quoted editor content' }) },
    { role: 'assistant', tool_calls: [{ id: 'read-1', type: 'function', function: { name: 'searchCreationMemory', arguments: '{}' } }] },
    { role: 'tool', tool_call_id: 'read-1', content: 'private creation facts as reference data' },
    { role: 'user', content: 'What happens in scene one?' },
  ];
  for (const responses of [true, false]) {
    let request;
    const capture = async r => { request = r; return { output: [], choices: [] }; };
    const client = { responses: { create: capture }, chat: { completions: { create: capture } } };
    const session = new ConciergeResponseSession();
    const stream = await session.start(client, { profile: { model: 'gpt-6-luna', reasoningEffort: responses ? 'low' : undefined },
      messages, tools: CONCIERGE_TOOLS, bypassOpenAi: false, maxCompletionTokens: 32000 });
    if (responses) for await (const _ of stream) {}
    const items = responses ? request.input : request.messages;
    const priority = items.filter(x => ['system', 'developer'].includes(x.role));
    assert.doesNotMatch(JSON.stringify(priority), /uploaded instructions|private session facts|private creation facts/);
    assert.match(JSON.stringify(priority), /quoted editor content/);
    assert.match(JSON.stringify(items), /private creation facts as reference data/);
    assert.match(JSON.stringify(items), /LIVE USER SNAPSHOT/);
  }
});

test('fixed policy is smaller while preserving control, permission, media and scene boundaries', () => {
  for (const mode of [0, 1, 3]) {
    const policy = buildConciergePromptPolicy(mode);
    assert.ok(policy.length < CONCIERGE_CONTROL_PROMPT.length * .6);
    for (const required of ['virtualGate', 'Jev', 'Video', 'Publish', 'uncertain', 'searchAppKnowledge', 'searchSessionMemory', 'searchCreationMemory']) {
      assert.ok(policy.includes(required), required);
    }
    assert.doesNotMatch(policy, /CLIKB_OPERATIONAL_KNOWLEDGE|CLIKB_SESSION_RECALL|SESSION_RECALL_STATUS|RAG_TRAINING_MEMORY_STATUS/);
  }
});

test('input telemetry attributes retrieval data to its actual source without calling it system context', () => {
  const items = ['instructions', 'session', 'creation'].map(source => ({ type: 'function_call_output',
    call_id: source, output: JSON.stringify({ referenceData: true, source, matches: [{ text: 'Reference only' }] }) }));
  const sizes = context.measureConciergeInput(items, []);
  assert.deepEqual(sizes.sources.filter(row => row.source !== 'tool_definitions').map(row => row.source),
    ['retrieved_app_knowledge', 'retrieved_session_memory', 'retrieved_creation_memory']);
  assert.equal(sizes.sources.some(row => row.source === 'system_context'), false);
});

test('read-only retrieval paginates whole records, shares query work and ignores caller identity overrides', async () => {
  let calls = 0;
  const snapshot = { scope: 'server-user:project:revision1' };
  const records = Array.from({ length: 6 }, (_, n) => ({ id: String(n), text: `${n}:` + 'x'.repeat(2400) }));
  const retrieve = createConciergeRetrieval({ scopeKey: s => s.scope, search: async (source, query, s) => {
    calls++; assert.equal(source, 'creation'); assert.equal(query, 'scene one full prompt'); assert.ok(s.scope.startsWith('server-user:project:revision'));
    return { status: 'found', matches: records };
  } });
  const collected = [];
  let offset = null;
  do {
    const page = await retrieve('creation', { query: 'scene one full prompt', offset, userId: 'another-user', namespace: 'attacker' }, snapshot);
    collected.push(...page.matches); offset = page.nextOffset;
  } while (offset !== null);
  assert.deepEqual(collected, records);
  assert.equal(calls, 1);
  assert.equal((await retrieve('creation', { query: 'scene one full prompt', offset: 0 }, { scope: 'server-user:project:revision2' })).status, 'found');
  assert.equal(calls, 2);
});

test('retrieval rejects invalid arguments and retries failed searches without clipping an exact long prompt', async () => {
  let calls = 0;
  const fullPrompt = 'scene '.repeat(2000);
  const retrieve = createConciergeRetrieval({ scopeKey: () => 'scope', search: async () => {
    if (++calls === 1) throw Error('temporary failure');
    return { status: 'found', matches: [{ id: 'exact', text: fullPrompt }] };
  } });
  assert.equal((await retrieve('creation', { query: '', offset: 0 }, {})).status, 'invalid_query');
  assert.equal(calls, 0);
  assert.equal((await retrieve('creation', { query: 'scene', offset: 0 }, {})).status, 'unavailable');
  assert.equal((await retrieve('creation', { query: 'scene', offset: 0 }, {})).matches[0].text, fullPrompt);
  assert.equal(calls, 2);
});

test('observation-only search has no mutation tools and repeated results use an already-present reference', async () => {
  const captured = [];
  let turn = 0, searches = 0;
  const call = id => ({ id, type: 'function', function: { name: 'searchAppKnowledge', arguments: JSON.stringify({ query: 'Shorts workflow', offset: 0 }) } });
  const retrieve = createConciergeRetrieval({ scopeKey: () => 'same-page', search: async () => {
    searches++; return { status: 'found', matches: [{ id: 'workflow', text: 'UNIQUE_RETRIEVED_REFERENCE_DATA' }] };
  } });
  const snapshot = { autoControl: { enabled: false }, creation: { mode: 'shorts', stage: 'setup' } };
  const noMutation = async () => { throw Error('A read attempted to use an execution gate'); };
  await runConciergeControlLoop({ messages: [{ role: 'system', content: buildConciergePromptPolicy(0) }], snapshot,
    userGoal: 'Explain Shorts', heartbeat: false, observationOnly: true }, {
    complete: async (messages, tools) => {
      captured.push(messages);
      assert.deepEqual(tools.map(x => x.function.name).sort(), ['getCurrentSnapshot', 'queryLiveSnapshot', 'searchAppKnowledge', 'searchCreationMemory', 'searchSessionMemory']);
      return turn++ < 2 ? { text: '', calls: [call(`read-${turn}`)] } : { text: 'Here is how Shorts works.', calls: [] };
    }, retrieve, observe: noMutation, intent: noMutation, select: noMutation, approve: noMutation, execute: noMutation,
    feedsContext: () => '', snapshotText: () => JSON.stringify(snapshot), stage: () => {}, cancelled: () => false,
  });
  assert.equal(searches, 1);
  const last = captured.at(-1);
  assert.equal((JSON.stringify(last).match(/UNIQUE_RETRIEVED_REFERENCE_DATA/g) || []).length, 1);
  assert.match(JSON.stringify(last), /already_supplied/);
  assert.ok(last.filter(x => x.clikbContext === 'snapshot').length === 1);
});

test('production snapshot rendering keeps all projected data once and retains Cinema stage/B-shot identities', () => {
  const source = fs.readFileSync('server/src/GptApi.ts', 'utf8');
  const sf = ts.createSourceFile('api.ts', source, ts.ScriptTarget.Latest, true);
  let expression;
  const visit = n => { if (ts.isVariableDeclaration(n) && n.name.getText(sf) === 'renderBrainstormUserSnapshot') expression = n.initializer.getText(sf); ts.forEachChild(n, visit); };
  visit(sf);
  const compiled = ts.transpileModule(`const render = ${expression}; module.exports = render`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'compileConciergeModelSnapshot', 'recordUsageEvent', compiled)(mod, context.compileConciergeModelSnapshot, () => {});
  const snapshot = { autoControl: { enabled: true, videoEnabled: false }, creation: { isActive: true, mode: 'cinema',
    editStoryIsOpen: true, editStoryCurrentSceneNumber: 8, editStoryIsBShot: true, editStoryParentSceneIndex: 7,
    editStoryBShotIndex: 2, editStorySceneIndex: 11, editStoryCurrentImagePrompt: 'UNIQUE_CURRENT_EDITOR_PROMPT',
    controls: { stateVersion: 3, areas: { 'clikb.creation.workstation_image': { controls: [{ actionId: 'clikb.creation.workstation_image.action.recreate', label: 'Recreate', enabled: true }] } } } } };
  const text = mod.exports(snapshot);
  assert.equal((text.match(/UNIQUE_CURRENT_EDITOR_PROMPT/g) || []).length, 1);
  assert.match(text, /"cinemaLogicalScene":4,"cinemaStage":"B","narrationOwnerSceneNumber":7/);
  assert.match(text, /"isBShot":true/);
  assert.deepEqual(JSON.parse(text.split('\n').at(-1)), JSON.parse(JSON.stringify(context.compileConciergeModelSnapshot(snapshot))));
});

test('main streaming assembly has no automatic knowledge or memory injection, and reporting projection is read-only', () => {
  const source = fs.readFileSync('server/src/GptApi.ts', 'utf8').split('export const GptBrainstormStream = ')[1];
  assert.doesNotMatch(source, /ragMemoryContext|sessionRecallContext|clikbContext:\s*['"](?:knowledge|memory)['"]/);
  assert.match(source, /createBrainstormRetrieval/);
  const snapshot = { creation: { stage: 'creating_images', imagesReady: 2, editStoryCurrentSceneNumber: 3,
    controls: { private: 'large catalogue' }, editStoryCurrentImagePrompt: 'full original remains on owner' }, autoControl: { enabled: true } };
  const report = context.conciergeReportingSnapshot(snapshot);
  assert.equal(report.creation.imagesReady, 2);
  assert.equal(report.creation.editStoryCurrentSceneNumber, 3);
  assert.equal(report.creation.controls, undefined);
  assert.equal(snapshot.creation.controls.private, 'large catalogue');
});

test('deferred fields resolve to the complete raw value once, and native bindings are never virtualised', async () => {
  const fullText = 'EXACT_LIVE_FIELD_'.repeat(180);
  const longId = 'clikb.creation.notepad.action.' + 'x'.repeat(650);
  const snapshot = { autoControl: { enabled: false }, creation: { isActive: true, editStoryIsOpen: true,
    editStoryCurrentImagePrompt: fullText, controls: { areas: { 'clikb.creation.notepad': {
      controls: [{ actionId: longId, enabled: true, policy: 'candidate', label: 'Prompt' }],
    } } } } };
  const projected = context.compileConciergeModelSnapshot(snapshot);
  assert.deepEqual(projected.creation.editStoryCurrentImagePrompt, {
    deferred: true, readPointer: '/creation/editStoryCurrentImagePrompt', kind: 'string', characters: fullText.length,
  });
  assert.equal(projected.creation.controls.areas['clikb.creation.notepad'].controls[0].actionId, longId);
  let turn = 0;
  const captured = [];
  const noMutation = async () => { throw Error('Read attempted a mutation'); };
  await runConciergeControlLoop({ messages: [], snapshot, userGoal: 'Read the current image prompt', heartbeat: false, observationOnly: false }, {
    complete: async messages => {
      captured.push(messages);
      return turn++ === 0 ? { text: '', calls: [{ id: 'full-read', type: 'function', function: {
        name: 'queryLiveSnapshot', arguments: JSON.stringify({ pointers: ['/creation/editStoryCurrentImagePrompt'] }),
      } }] } : { text: 'I have read the full current prompt.', calls: [] };
    }, observe: async () => ({ status: 'observed', snapshot }), intent: noMutation, select: noMutation, approve: noMutation, execute: noMutation,
    feedsContext: () => '', snapshotText: value => JSON.stringify(context.compileConciergeModelSnapshot(value)), stage: () => {}, cancelled: () => false,
  });
  const requested = captured.at(-1).find(message => String(message.content).startsWith(context.CONCIERGE_CURRENT_READ));
  const field = JSON.parse(requested.content.slice(context.CONCIERGE_CURRENT_READ.length)).fields[0];
  assert.equal(field.value, fullText);
  assert.equal((JSON.stringify(captured.at(-1)).match(/EXACT_LIVE_FIELD_/g) || []).length, 180);
  assert.equal(snapshot.creation.editStoryCurrentImagePrompt, fullText);
});

test('STT keyterms, publish typo boundaries, single companion voice, observationOnly guard, and REC 69 pre-tool hold match alignment contract', () => {
  const { DEFAULT_KEYTERMS } = load('server/src/XaiStt.ts');
  assert.deepEqual([...DEFAULT_KEYTERMS], ['ClikB', 'Brainstorm', 'Shorts', 'Cinema', 'Interactions']);

  const { conciergeTaskBoundary } = load('server/src/ConciergeTaskBoundary.ts');
  for (const clause of [
    'Create two pirate scenes and stop at publsih',
    'Generate the images and hold before publlsih',
    'Build the story, do not pulbish yet',
    'Make a short without pubishing',
  ]) {
    assert.deepEqual(conciergeTaskBoundary(clause), { destination: 'publish', stopBeforePublication: true }, clause);
  }
  assert.equal(
    conciergeTaskBoundary('Create two pirate scenes and stop at publsih\nUser refinement: Go ahead and publish it now'),
    undefined,
  );

  for (const mode of [0, 1, 3]) {
    const policy = buildConciergePromptPolicy(mode);
    assert.doesNotMatch(policy, /Creation Guide/i);
    assert.doesNotMatch(policy, /always stop before publish/i);
    assert.match(policy, /confirmed/i);
  }

  const gptApiSource = fs.readFileSync('server/src/GptApi.ts', 'utf8');
  assert.doesNotMatch(gptApiSource, /You are ClikB[’']s Creation Guide/);
  assert.match(gptApiSource, /const observationTurn = Boolean\(conciergeObservationTurn \|\| automaticGuideCallId\)/);
  assert.match(gptApiSource, /observationOnly:\s*observationTurn/);
  assert.match(gptApiSource, /const streamLiveDelta = !bufferControlNarration && calls\.size === 0/);
});

test('frontend control contracts: stage-dependent close_composer, alertdialog isolation, strict Brainstorm handoff boundary, and measurement headers', () => {
  const promptToolbarSource = fs.readFileSync('src/PromptToolbar.tsx', 'utf8');
  assert.match(
    promptToolbarSource,
    /cb\('styles',\s*'close_composer',\s*'Close Creation composer',\s*'onCompactClose',\s*'click',\s*isComposerStage && !isBlinking && !allowSpin \? 'candidate' : 'needs_confirmation'\)/
  );
  assert.match(
    promptToolbarSource,
    /showConfirmClose && \(\s*<Box role="alertdialog" aria-modal="true" aria-label="Confirm close creation"/
  );

  const promptInputSource = fs.readFileSync('src/PromptInput.tsx', 'utf8');
  assert.ok(
    /role="alertdialog"[\s\S]{0,80}aria-modal="true"[\s\S]{0,120}Confirm close character studio/i.test(promptInputSource),
    'Expected Character Studio showConfirmClose Box to declare role="alertdialog" and aria-modal="true"'
  );

  const brainstormChatSource = fs.readFileSync('src/components/BrainstormChat.tsx', 'utf8');
  assert.match(
    brainstormChatSource,
    /cb\('brainstorm',\s*`use_\$\{msg\.id\}`,\s*'Use this response in prompt',\s*'handleUseMessage',\s*'click',\s*'needs_handoff'\)/
  );
  assert.match(
    brainstormChatSource,
    /cb\('brainstorm',\s*'input',\s*'Brainstorm message',\s*'setCurrentInput',\s*'text',\s*'needs_handoff'\)/
  );
  assert.match(
    brainstormChatSource,
    /cb\('brainstorm',\s*'send',\s*'Send Brainstorm message',\s*'handleSendMessage',\s*'click',\s*'needs_handoff'\)/
  );
  // Leave close and Finalize/template controls untouched:
  assert.match(
    brainstormChatSource,
    /cb\('brainstorm',\s*'close',\s*'Review leaving Brainstorm',\s*'setShowLeaveConfirm\(true\)'\)/
  );
  assert.match(
    brainstormChatSource,
    /cb\('brainstorm',\s*`finalize_\$\{msg\.id\}`,\s*'Create template from response',\s*'onSaveClicked'\)/
  );

  const promptConstructorSource = fs.readFileSync('src/components/PromptConstructor.tsx', 'utf8');
  const headerMatches = promptConstructorSource.match(/\.\.\.conversationMeasurementHeaders\(\)/g) || [];
  assert.equal(headerMatches.length, 2, 'Expected conversationMeasurementHeaders() on both handleSendMessage and voiceAsk');
  assert.match(promptConstructorSource, /conciergeObservationTurn:\s*options\.conciergeObservationTurn/);
  assert.match(promptConstructorSource, /pendingMilestoneEvents:\s*options\.pendingMilestoneEvents/);
});
