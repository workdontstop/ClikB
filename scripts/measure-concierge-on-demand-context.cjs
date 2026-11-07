/* Offline cold-input comparison, not a model execution or full-session token benchmark. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const load = require('../tests/loadTs.cjs');
const { collectObservedSnapshots, DEFAULT_SESSION, DEFAULT_GOAL } = require('./replay-concierge-context.cjs');
const context = load(path.resolve(__dirname, '../server/src/ConciergeContext.ts'));
const knowledge = load(path.resolve(__dirname, '../server/src/ConciergeKnowledge.ts'));
const tools = load(path.resolve(__dirname, '../server/src/ConciergeTools.ts'));
const { buildConciergePromptPolicy } = load(path.resolve(__dirname, '../server/src/ConciergePromptPolicy.ts'));
const { CONCIERGE_RESPONSE_POLICY } = load(path.resolve(__dirname, '../server/src/conciergeResponsePolicy.ts'));
const { ConciergeSnapshotBroker } = load(path.resolve(__dirname, '../server/src/ConciergeSnapshotBroker.ts'));
const root = path.resolve(__dirname, '..');
const beforeRef = '6d0e14c';
const beforeSource = execFileSync('git', ['show', `${beforeRef}:server/src/GptApi.ts`], { cwd: root, encoding: 'utf8', maxBuffer: 10e6 });
const beforeContextSource = execFileSync('git', ['show', `${beforeRef}:server/src/ConciergeContext.ts`], { cwd: root, encoding: 'utf8' });
const beforeContextModule = { exports: {} };
new Function('module', 'exports', 'require', ts.transpileModule(beforeContextSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText)(beforeContextModule, beforeContextModule.exports,
  name => name === './FeedsExecutionContext' ? load(path.resolve(__dirname, '../server/src/FeedsExecutionContext.ts')) : require(name));
const beforeToolsSource = execFileSync('git', ['show', `${beforeRef}:server/src/ConciergeTools.ts`], { cwd: root, encoding: 'utf8' });
const beforeToolsModule = { exports: {} };
new Function('module', 'exports', 'require', ts.transpileModule(beforeToolsSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText)(beforeToolsModule, beforeToolsModule.exports,
  name => name.startsWith('.') ? load(path.resolve(root, 'server/src', name + '.ts')) : require(name));

function bind(source, name, compiler = context.compileConciergeModelSnapshot) {
  const parsed = ts.createSourceFile('api.ts', source, ts.ScriptTarget.Latest, true);
  let expression;
  const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === name) expression = node.initializer.getText(parsed); ts.forEachChild(node, visit); };
  visit(parsed);
  if (!expression) throw Error(`Missing production function ${name}`);
  const mod = { exports: {} };
  const js = ts.transpileModule(`module.exports = ${expression}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('module', 'compileConciergeModelSnapshot', 'recordUsageEvent', 'CONCIERGE_CONTROL_PROMPT', 'conciergeConversationProfileFacts', js)(
    mod, compiler, () => {}, beforeToolsModule.exports.CONCIERGE_CONTROL_PROMPT, knowledge.conciergeConversationProfileFacts);
  return mod.exports;
}
const beforeRender = bind(beforeSource, 'renderBrainstormUserSnapshot', beforeContextModule.exports.compileConciergeModelSnapshot);
// The previous full renderer is no longer the production model input path.
// Use the same request-owned broker as both Concierge endpoints.
const beforePolicy = bind(beforeSource, 'buildBrainstormSystemPrompt');
const packets = [
  ['clikb_navigation_shell', '01_navigation_profile_settings.rag.txt'],
  ['clikb_feeds', '02_feeds_usage.rag.txt'], ['clikb_creation', '03_creation_intro.rag.txt'], ['clikb_deck', '04_deck_overlay.rag.txt'],
].map(([ragId, file]) => ({ ragId, title: ragId, instructions: fs.readFileSync(path.join(root, 'docs/control-rag', file), 'utf8') }));
const ledger = JSON.parse(fs.readFileSync(path.join(root, 'server/logs/conversation-cost-ledger.json'), 'utf8'));
const recorded = ledger.sessions.find(session => session.sessionId === DEFAULT_SESSION);
if (!recorded) throw Error('Recorded snapshots unavailable; no small fixture is substituted.');
const observations = collectObservedSnapshots(recorded);
const oldTools = beforeToolsModule.exports.CONCIERGE_TOOLS;
const size = (messages, definitions) => JSON.stringify(messages).length + JSON.stringify(definitions.map(tool => ({ type: 'function', ...tool.function }))).length;
const rows = observations.map(({ snapshot, sourcePath }) => {
  const mode = snapshot.creation?.mode === 'cinema' ? 1 : snapshot.creation?.mode === 'games' ? 3 : 0;
  const selected = packets.map(packet => knowledge.selectCompactConciergePacketKnowledge(packet, snapshot, { userGoal: DEFAULT_GOAL }).instructions).join('\n\n');
  const before = size([
    { role: 'system', content: beforePolicy(mode) + '\n' + CONCIERGE_RESPONSE_POLICY },
    { role: 'system', content: `CLIKB_OPERATIONAL_KNOWLEDGE\n${selected}` },
    { role: 'system', content: beforeRender(snapshot, { userGoal: DEFAULT_GOAL }) },
    { role: 'user', content: DEFAULT_GOAL },
  ], oldTools);
  const afterMessages = [
    { role: 'system', content: buildConciergePromptPolicy(mode) },
    { role: 'user', content: DEFAULT_GOAL },
  ];
  const broker = new ConciergeSnapshotBroker(`offline:${DEFAULT_SESSION}`, snapshot);
  const automatic = { role: 'system', content: JSON.stringify(broker.automatic()) };
  const cold = size([...afterMessages, automatic], tools.CONCIERGE_TOOLS);
  const readCall = { role: 'assistant', tool_calls: [{ id: 'offline-snapshot', type: 'function', function: {
    name: 'getCurrentSnapshot', arguments: '{}' } }] };
  const readOutput = { role: 'tool', tool_call_id: 'offline-snapshot', content: JSON.stringify(broker.readSnapshot()) };
  const withRead = [...afterMessages, { role: 'system', content: JSON.stringify(broker.automatic()) }, readCall, readOutput];
  return { sourcePath, stage: snapshot.creation?.stage, beforeCharacters: before,
    coldAfterCharacters: cold,
    // Include both inputs: deciding to read, then deciding from that read.
    // This is still a scripted offline scenario, not measured model behaviour.
    oneReadTwoInputsCharacters: cold + size(withRead, tools.CONCIERGE_TOOLS),
    // Show the cost of a real-sized result explicitly, rather than treating all retrieval as free.
    withRetrievalAfterCharacters: cold + size(withRead, tools.CONCIERGE_TOOLS) + size([...withRead,
      { role: 'assistant', tool_calls: [{ id: 'offline-read', type: 'function', function: { name: 'searchAppKnowledge', arguments: '{"query":"current workflow","offset":0}' } }] },
      { role: 'tool', tool_call_id: 'offline-read', content: JSON.stringify({ referenceData: true, source: 'instructions', matches: [{ text: selected }] }) },
    ], tools.CONCIERGE_TOOLS),
  };
});
const sum = field => rows.reduce((n, row) => n + row[field], 0);
const before = sum('beforeCharacters'), after = sum('coldAfterCharacters');
const report = { baselineRef: beforeRef, sessionId: DEFAULT_SESSION, observations: rows.length,
  baselineCharacters: before, coldAfterCharacters: after, coldReductionPercent: 100 * (1 - after / before),
  oneReadTwoInputsCharacters: sum('oneReadTwoInputsCharacters'),
  oneReadScenarioReductionPercent: 100 * (1 - sum('oneReadTwoInputsCharacters') / before),
  withFullSelectedKnowledgeAfterCharacters: sum('withRetrievalAfterCharacters'),
  actualNewSessionInputTokens: null, targetInputTokenReductionPercent: 80, tokenTargetVerified: false,
  limitations: [
    'Serialized characters across real saved snapshots, not provider token usage, calls, latency or model-quality results.',
    'Uses current local operational packets and an explicit representative goal; original conversation and retrieved text are unavailable.',
    'Cold means before any model-chosen read/retrieval. oneReadTwoInputsCharacters explicitly includes the extra read decision/input, not just its response body.',
    'Expanded comparison includes the whole selected operational packet as a tool result to expose demand-expansion overhead.',
    'Memory, semantic matches, action evidence and original conversation histories are excluded from both sides.',
    'No API, database, browser workflow, reindex or model inference is invoked.',
  ], rows };
const output = process.argv[2] || '.tmp/concierge-on-demand-input-comparison.json';
fs.writeFileSync(path.resolve(root, output), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ observations: rows.length, baselineCharacters: before, coldAfterCharacters: after,
  coldReductionPercent: Number(report.coldReductionPercent.toFixed(2)),
  oneReadTwoInputsCharacters: report.oneReadTwoInputsCharacters,
  oneReadScenarioReductionPercent: Number(report.oneReadScenarioReductionPercent.toFixed(2)),
  expandedCharacters: report.withFullSelectedKnowledgeAfterCharacters, tokenTargetVerified: false, output }));
