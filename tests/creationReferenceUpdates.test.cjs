const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const source = ts.createSourceFile('PromptInput.tsx', fs.readFileSync(path.join(__dirname, '../src/PromptInput.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let updateNode, repairNode;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'updateReferenceImages') updateNode = node.initializer.arguments[0];
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.getText(source).includes('if (!Vipcharacters || Vipcharacters.length === 0) return;')) repairNode = node.arguments[0];
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(updateNode); assert.ok(repairNode);
function evaluate(node, bindings) {
  const code = ts.transpileModule(`const callback = ${node.getText(source)};`, {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText;
  return new Function(...Object.keys(bindings), code + 'return callback;')(...Object.values(bindings));
}
function fixture(initial = []) {
  const writes = [], referenceImagesRef = {current: initial}, ids = {current: 0};
  const maps = Array.from({length: 3}, () => ({current: new Map()}));
  const loading = {current: new Set()};
  const update = evaluate(updateNode, {
    referenceImagesRef, nextReferenceClientIdRef: ids,
    referencePromptDraftsRef: maps[0], latestReferenceAiRequestRef: maps[1],
    referenceAiLoadingKeysRef: loading, manualVipRenderClaimsRef: maps[2],
    setReferenceImages: next => writes.push(next),
  });
  return {update, writes, referenceImagesRef, ids, maps, loading};
}
test('unchanged reference updates do not publish fresh state', () => {
  for (const initial of [[], [{name: 'Terra', imageUrl: '/terra.png', clientReferenceId: 'terra'}]]) {
    const f = fixture(initial);
    f.update(previous => previous);
    assert.equal(f.writes.length, 0);
    assert.equal(f.referenceImagesRef.current, initial);
  }
});
test('VIP self-healing settles with World and manual references, including empty casting cards', () => {
  for (const sourceType of ['world', 'upload']) for (const initial of [[], [{name: 'Terra', clientReferenceId: 'terra'}]]) {
    const f = fixture(initial);
    const repair = evaluate(repairNode, {
      Vipcharacters: [{name: 'Terra', imageUrl: '/terra.png', source: sourceType}],
      updateReferenceImages: f.update,
      referenceNamesMatch: (a, b) => a === b,
    });
    repair();
    const writesAfterRepair = f.writes.length;
    repair(); repair();
    assert.equal(f.writes.length, writesAfterRepair, 'repair kept scheduling renders');
    if (initial.length) assert.equal(f.referenceImagesRef.current[0].imageUrl, '/terra.png');
  }
});
test('real reference updates still assign IDs and clean removed edit state', () => {
  const f = fixture([{name: 'Terra', clientReferenceId: 'old'}]);
  for (const map of f.maps) map.current.set('old', 'draft');
  f.loading.current.add('old');
  f.update(() => [{name: 'Cuzon', imageUrl: '/cuzon.png'}]);
  assert.equal(f.writes.length, 1);
  assert.equal(f.referenceImagesRef.current[0].clientReferenceId, 'creation-reference-1');
  for (const map of f.maps) assert.equal(map.current.size, 0);
  assert.equal(f.loading.current.size, 0);
  f.update(previous => previous.map(item => ({...item, imageUrl: '/updated.png'})));
  assert.equal(f.referenceImagesRef.current[0].imageUrl, '/updated.png');
  assert.equal(f.referenceImagesRef.current[0].clientReferenceId, 'creation-reference-1');
});
