#!/usr/bin/env node
/* Offline source-block replay. Never loads GptApi, a server, a database or a real provider. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const loadTs = require('../tests/loadTs.cjs');

const root = path.resolve(__dirname, '..');
const context = loadTs(path.join(root, 'server/src/ConciergeContext.ts'));
const { feedsConversationSnapshot } = loadTs(path.join(root, 'server/src/FeedsExecutionContext.ts'));
const knowledge = loadTs(path.join(root, 'server/src/ConciergeKnowledge.ts'));
const { CONCIERGE_TOOLS } = loadTs(path.join(root, 'server/src/ConciergeTools.ts'));
const { ConciergeResponseSession } = loadTs(path.join(root, 'server/src/ConciergeInference.ts'), {
  './ConciergeContext': { ...context, logConciergeInputSizes: () => {} },
});
const DEFAULT_SESSION = 'conversation-96b063d1-b16f-4dee-80aa-ccf45dcab5eb';
const DEFAULT_GOAL = 'Create three racing game cover images in Shorts. Recreate all three with their game titles, then generate videos and a Motion Guide. Stop at Publish.';

function collectObservedSnapshots(value, sourcePath = '') {
  if (!value || typeof value !== 'object') return [];
  const here = value.creation?.controls && value.navigation && value.autoControl
    ? [{ snapshot: value, sourcePath }] : [];
  return here.concat(Object.entries(value).flatMap(([key, child]) =>
    collectObservedSnapshots(child, `${sourcePath}/${key}`)));
}

// Extract just the production renderer, rather than importing the API module's
// provider/DB initialisers or substituting a tiny hand-built snapshot fixture.
function snapshotRenderer(source, compile = context.compileConciergeModelSnapshot) {
  const parsed = ts.createSourceFile('GptApi.ts', source, ts.ScriptTarget.Latest, true);
  let renderer;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'renderBrainstormUserSnapshot') renderer = node.initializer;
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  if (!renderer) throw new Error('Production renderBrainstormUserSnapshot was not found');
  const rendererText = renderer.getText(parsed).replace(/catch\s*\{\s*return\s+"";\s*\}/g, 'catch (error) { throw error; }');
  const expression = ts.transpileModule(`(${rendererText})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText.trim().replace(/;$/, '');
  return new Function('compileConciergeModelSnapshot', 'projectConciergeSnapshot', 'feedsConversationSnapshot', 'recordUsageEvent',
    `return ${expression};`)(compile, context.projectConciergeSnapshot, feedsConversationSnapshot, () => {});
}

const stats = values => ({
  count: values.length,
  totalCharacters: values.reduce((sum, n) => sum + n, 0),
  minimumCharacters: values.length ? Math.min(...values) : null,
  maximumCharacters: values.length ? Math.max(...values) : null,
  meanCharacters: values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null,
});
const comparison = (before, after) => ({
  before: stats(before), after: stats(after),
  reductionPercent: before.reduce((sum, n) => sum + n, 0)
    ? 100 * (1 - after.reduce((sum, n) => sum + n, 0) / before.reduce((sum, n) => sum + n, 0)) : null,
});

async function assembleProviderSources(knowledgeText, snapshotText) {
  let captured;
  const client = { responses: { create: async request => {
    captured = request;
    return { output: [] };
  } } };
  const messages = context.withConciergeCurrentSnapshot([
    { role: 'assistant', tool_calls: [{ id: 'offline-knowledge', type: 'function',
      function: { name: 'searchAppKnowledge', arguments: '{}' } }] },
    { role: 'tool', tool_call_id: 'offline-knowledge', content: JSON.stringify({ referenceData: true,
      source: 'instructions', matches: [{ text: knowledgeText }] }) },
  ], snapshotText);
  const session = new ConciergeResponseSession();
  const stream = await session.start(client, {
    profile: { model: 'gpt-6-luna', reasoningEffort: 'low' },
    messages, tools: CONCIERGE_TOOLS, bypassOpenAi: false, maxCompletionTokens: 32000,
  });
  for await (const _event of stream) { /* Local mock; no real usage or cost is recorded. */ }
  if (!captured) throw new Error('Provider adapter did not assemble an input');
  return context.measureConciergeInput(captured.input, captured.tools);
}

function historicalInputTelemetry(session) {
  const totals = new Map();
  let eventCount = 0, serializedCharacters = 0, eventsAfterSavedObservation = 0;
  let requestCount = 0, recordedMainProviderCalls = 0;
  for (const record of session.records || []) {
    if (record.route !== '/startBrainstormStream') continue;
    requestCount++;
    recordedMainProviderCalls += (record.calls || []).filter(call => call.model === 'gpt-6-luna').length;
    let savedObservation = false;
    for (const event of record.events || []) {
      if (collectObservedSnapshots(event).length) savedObservation = true;
      if (event.name !== 'concierge.input_context') continue;
      eventCount++;
      if (savedObservation) eventsAfterSavedObservation++;
      serializedCharacters += event.detail?.serializedCharacters || 0;
      for (const source of event.detail?.sources || []) {
        totals.set(source.source, (totals.get(source.source) || 0) + (source.characters || 0));
      }
    }
  }
  return { requestCount, eventCount, recordedMainProviderCalls, serializedCharacters,
    eventsAfterSavedObservation, sourceCharacterTotals: Object.fromEntries(totals) };
}

async function replayRecordedContext({ session, packet, userGoal = DEFAULT_GOAL,
  currentRendererSource, baselineRendererSource, baselineRef = 'b1f1479' }) {
  if (!session || !Array.isArray(session.records)) throw new Error('A recorded session with records is required');
  const currentSource = currentRendererSource || fs.readFileSync(path.join(root, 'server/src/GptApi.ts'), 'utf8');
  const baselineSource = baselineRendererSource || execFileSync('git', ['show', `${baselineRef}:server/src/GptApi.ts`], {
    cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024,
  });
  const renderBefore = snapshotRenderer(baselineSource, context.projectConciergeSnapshot);
  const renderAfter = snapshotRenderer(currentSource);
  const observations = collectObservedSnapshots(session);
  const rows = [];
  for (const { snapshot, sourcePath } of observations) {
    const beforeKnowledge = knowledge.selectConciergePacketKnowledge(packet, snapshot);
    const afterKnowledge = knowledge.selectCompactConciergePacketKnowledge(packet, snapshot, { userGoal });
    const beforeRendered = renderBefore(snapshot, { userGoal });
    const afterRendered = renderAfter(snapshot, { userGoal });
    if (!beforeRendered || !afterRendered) throw new Error(`Snapshot rendering failed at ${sourcePath}`);
    const beforeAssembly = await assembleProviderSources(beforeKnowledge.instructions, beforeRendered);
    const afterAssembly = await assembleProviderSources(afterKnowledge.instructions, afterRendered);
    rows.push({ sourcePath, stage: snapshot.creation?.stage, mode: snapshot.creation?.mode,
      snapshotJsonBefore: JSON.stringify(context.projectConciergeSnapshot(snapshot)).length,
      snapshotJsonAfter: JSON.stringify(context.compileConciergeModelSnapshot(snapshot, { userGoal })).length,
      knowledgeBefore: beforeKnowledge.instructions.length, knowledgeAfter: afterKnowledge.instructions.length,
      knowledgeFallback: afterKnowledge.fallback,
      renderedSnapshotBefore: beforeRendered.length, renderedSnapshotAfter: afterRendered.length,
      providerSourcesBefore: beforeAssembly.serializedCharacters, providerSourcesAfter: afterAssembly.serializedCharacters,
    });
  }
  const compare = (a, b) => comparison(rows.map(row => row[a]), rows.map(row => row[b]));
  return {
    schemaVersion: 1,
    method: 'Offline recorded-state replay and production Responses adapter assembly of Creation knowledge + rendered snapshot + tool definitions only.',
    sessionId: session.sessionId, baselineRef,
    scenarioGoal: userGoal,
    scenarioGoalSource: 'Explicit representative replay goal; the complete original utterance/refinement history is not reconstructed.',
    packetSha256: crypto.createHash('sha256').update(packet.instructions).digest('hex'),
    observationCount: observations.length,
    snapshotJson: compare('snapshotJsonBefore', 'snapshotJsonAfter'),
    creationKnowledge: compare('knowledgeBefore', 'knowledgeAfter'),
    renderedSnapshot: compare('renderedSnapshotBefore', 'renderedSnapshotAfter'),
    reconstructedProviderSourceBlocks: compare('providerSourcesBefore', 'providerSourcesAfter'),
    historicalInputTelemetry: historicalInputTelemetry(session),
    newWholeSessionInputTokens: null, newWholeSessionProviderCalls: null, newWholeSessionCostUsd: null,
    limitations: [
      'Observations can repeat within a workflow; they are not independent tasks or a full transcript replay.',
      'Sizes are serialized characters, not tokenizer output, provider usage, cache hits or latency.',
      'The mock provider captures production adapter inputs and never executes inference or app actions.',
      'Reconstructed blocks exclude original conversation, system/memory/action history, other operational packets and semantic retrieval results.',
      'Historical source totals are reported unchanged. Missing request blocks and initial snapshots prevent a full new-session total or a verified decision-call reduction.',
      'No RAG documents are rewritten or reindexed. Full gate selection and raw snapshot queries are unchanged.',
    ],
    observations: rows,
  };
}

module.exports = { collectObservedSnapshots, historicalInputTelemetry, replayRecordedContext, DEFAULT_SESSION, DEFAULT_GOAL };

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2);
    const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
    const ledgerPath = path.resolve(option('--ledger', path.join(root, 'server/logs/conversation-cost-ledger.json')));
    const sessionId = option('--session', DEFAULT_SESSION);
    const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
    const session = (ledger.sessions || []).find(item => item.sessionId === sessionId);
    if (!session) throw new Error(`Recorded session not found: ${sessionId}`);
    const packet = { ragId: 'clikb_creation', title: 'ClikB Creation',
      instructions: fs.readFileSync(path.join(root, 'docs/control-rag/03_creation_intro.rag.txt'), 'utf8').replace(/\r\n/g, '\n') };
    const report = await replayRecordedContext({ session, packet, userGoal: option('--goal', DEFAULT_GOAL) });
    const text = `${JSON.stringify(report, null, 2)}\n`;
    const output = option('--output');
    if (output) fs.writeFileSync(path.resolve(output), text);
    else process.stdout.write(text);
  })().catch(error => { console.error(error.message); process.exitCode = 1; });
}
