const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

// Run the real hook with a deterministic clock and hook lifecycle. Count DOM
// scans/dispatches, rather than asserting implementation text or wall time.
function fixture({ busyIdle = false } = {}) {
  let cursor = 0, now = 0, id = 0, scans = 0, observers = 0;
  const slots = [], effects = [], jobs = new Map(), listeners = new Map(), actions = [];
  const dispatch = action => actions.push(action);
  const react = {
    useId() { return ':r0:'; },
    useRef(value) { const i = cursor++; return slots[i] ||= { current: value }; },
    useEffect(callback, deps) {
      const i = cursor++, previous = slots[i];
      if (!previous || deps.some((v, j) => !Object.is(v, previous.deps[j]))) {
        effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: callback() }; });
      }
    },
  };
  const schedule = (callback, delay) => { jobs.set(++id, { callback, at: now + delay }); return id; };
  let mutate;
  const sandbox = {
    Element: class { matches() { return true; } },
    exports: {}, require: name => name === './creationControlSnapshot' ? require('./loadTs.cjs')('src/creationControlSnapshot.ts')
      : name === './creationControlRegistry' ? require('./loadTs.cjs')('src/creationControlRegistry.ts')
      : name === './store' ? {store:{getState:()=>({settings:{deckEnabled:true},brainstorm:{userSnapshot:{creation:{controls:{areas:{}}}}}}),dispatch}}
      : name === 'react' ? react : name === 'react-redux'
      ? { useDispatch: () => dispatch }
      : { publishCreationArea: payload => ({ type: 'publish', payload }), removeCreationArea: payload => ({ type: 'remove', payload }) },
    setTimeout: schedule, clearTimeout: key => jobs.delete(key),
    requestAnimationFrame: callback => schedule(callback, 16), cancelAnimationFrame: key => jobs.delete(key),
    MutationObserver: class { constructor(callback) { mutate = callback; observers++; } observe() {} disconnect() {} },
    document: {
      querySelectorAll() { scans++; return []; },
      addEventListener(name, callback) { listeners.set(name, callback); },
      removeEventListener(name) { listeners.delete(name); },
    },
    window: { addEventListener() {}, removeEventListener() {} },
  };
  const source = fs.readFileSync(require('node:path').join(__dirname, '../src/useCreationControls.ts'), 'utf8');
  if (busyIdle) {
    sandbox.requestIdleCallback = (callback, options) => schedule(callback, options?.timeout ?? 1000000);
    sandbox.cancelIdleCallback = key => jobs.delete(key);
  }
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, sandbox);
  return {
    render(length, active = true, area = 'notepad', state = { promptLength: length }) {
      cursor = 0; sandbox.exports.useCreationControls(area, 'NotepadEditor', active, state);
      while (effects.length) effects.shift()();
    },
    tick(ms) {
      const end = now + ms;
      while (true) {
        const next = [...jobs].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        jobs.delete(next[0]); now = next[1].at; next[1].callback();
      }
      now = end;
    },
    input() { listeners.get('input')?.(); },
    flush() { sandbox.exports.flushCreationControls(); },
    mutate() { mutate([{target:new sandbox.Element(),removedNodes:[]}]); },
    get scans() { return scans; }, get observers() { return observers; }, actions,
  };
}

test('rapid typing does no geometry scans or Redux writes and keeps one observer', () => {
  const f = fixture(); f.render(0); f.tick(200);
  const initialScans = f.scans, initialActions = f.actions.length;
  for (let length = 1; length <= 80; length++) {
    f.input(); f.render(length); f.mutate(); f.tick(30);
  }
  assert.equal(f.scans, initialScans);
  assert.equal(f.actions.length, initialActions);
  assert.equal(f.observers, 1);
  f.tick(200);
  assert.equal(f.scans, initialScans + 1);
});

test('a Precise owner publishes current compact facts even with no mapped DOM controls', () => {
  const f = fixture(); f.render(0, true, 'workstation_precise', {model:'Flare',pixels:6,regions:2,references:1,status:'ready',prompt:'private'});
  f.flush();
  assert.equal(f.actions.length,1);
  assert.deepEqual(JSON.parse(JSON.stringify(f.actions[0].payload.state)),{model:'Flare',pixels:6,regions:2,references:1,status:'ready'});
  assert.deepEqual(JSON.parse(JSON.stringify(f.actions[0].payload.controls)),[]);
});
test('busy idle periods are bounded and explicit observations flush without waiting', () => {
  const f = fixture({busyIdle:true}); f.render(0); f.tick(679); assert.equal(f.scans,0);
  f.tick(1); assert.equal(f.scans,1,'a settled update cannot starve waiting for idle');
  f.input(); f.tick(180); f.flush(); assert.equal(f.scans,2,'AI observation is synchronous');
  f.tick(1000); assert.equal(f.scans,2,'explicit flush cancels the queued idle measurement');
});

test('input cancels an already queued measurement frame', () => {
  const f = fixture(); f.render(0); f.tick(180); f.input(); f.tick(16);
  assert.equal(f.scans, 0);
  f.tick(200); assert.equal(f.scans, 1);
});

test('continuous non-input mutations do not starve tracking, and closing cancels pending work', () => {
  const f = fixture(); f.render(0);
  for (let i = 0; i < 20; i++) { f.mutate(); f.tick(30); }
  assert.ok(f.scans >= 2);
  f.input(); f.render(0, false);
  const scans = f.scans, actions = f.actions.length;
  f.tick(1000);
  assert.equal(f.scans, scans); assert.equal(f.actions.length, actions);
  assert.equal(f.actions.length, 0, 'an empty contributor cannot remove another owner');
});
