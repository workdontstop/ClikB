const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

test('Deck browser/server contract and Jev gates run with paid providers disabled', () => {
  const output = path.join(root, '.tmp/deck-pipeline-tests');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'package.json'), '{"type":"commonjs"}');
  for (const name of ['FeedsExecutionContext', 'FeedsExecutionContext.test', 'JevActionGate', 'JevActionGate.test', 'CreationExecutionContext']) {
    const source = fs.readFileSync(path.join(root, 'server/src', `${name}.ts`), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    fs.writeFileSync(path.join(output, `${name}.js`), code);
  }
  fs.writeFileSync(path.join(output, 'JevDecisionService.js'), 'exports.consultJev = async () => { throw new Error("Paid provider calls are disabled in Deck regression tests"); };');
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', path.join(output, 'FeedsExecutionContext.test.js'), path.join(output, 'JevActionGate.test.js')], { cwd: root, encoding: 'utf8', env: environment });
  fs.writeFileSync(path.join(root, '.tmp/deck/pipeline-regressions.log'), result.stdout + result.stderr);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /# tests (?:3[2-9]|[4-9]\d)\b/, 'All backend mock cases must actually execute');
  assert.match(result.stdout, /# fail 0\b/, 'Zero failures in Deck and Jev gate regression suite');
});
