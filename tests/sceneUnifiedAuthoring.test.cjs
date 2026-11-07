const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8').replace(/import\.meta\.env/g, '({})'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { adoptSceneBuild, reconcileSceneOutcome } = require('../server/src/sceneBuildAuthoring.ts');
const { evaluateAuthoringDraft, applyAuthoringCommands, manualPoseCommands, fitAuthoringDuration } = require('../server/src/sceneAuthoring.ts');
const { LivePlanAssembler, applyLiveOps } = require('../server/src/liveSceneStream.ts');
const { extractActionNodePreset, applyActionPreset, extractRigAssetPreset, applyRigAssetPreset, fitPresetDuration } = require('../server/src/scenePresets.ts');
const { LiveSceneClient } = require('../src/liveSceneClient.ts');
const { initialMotionTransform } = require('../server/src/motionNodeTransforms.ts');
const { hasVisibleSceneGeometry } = require('../server/src/sceneVisibility.ts');
const keys = (position = [0, 0, 0], duration = 5) => [0, duration].map(t => ({ t, position: [...position], rotation: [0, 0, 0], scale: [1, 1, 1] }));
const plan = (objects, duration = 5) => ({ version: 1, duration, background: '#edf5fc', objects, camera: [0, duration].map(t => ({ t, position: [3, 2, 6], target: [0, 1, 0], fov: 45 })) });
const box = id => ({ id, shape: 'box', color: '#6686b3', keys: keys() });

test('live and export visibility use compound parts rather than invisible transform roots', () => {
    assert.equal(hasVisibleSceneGeometry(plan([{ ...box('root'), shape: 'anchor', parts: [box('body')] }])), true);
    assert.equal(hasVisibleSceneGeometry(plan([{ ...box('root'), parts: [{ ...box('pivot'), shape: 'anchor' }] }])), false);
    assert.equal(hasVisibleSceneGeometry(plan([{ ...box('live_workspace'), shape: 'anchor' }])), false);
});

test('AI recipes build progressively in both plan formats and compile a persistent grounded kneeling state', () => {
    const raw = { ...plan([{ id: 'hero', recipe: 'humanoid', initialPosture: 'kneeling', keys: keys() }]), initialState: { objects: { hero: { facts: { posture: 'kneeling', holding: 'nothing' } } } }, performance: { states: [{ objectId: 'hero', time: 0, posture: 'kneeling' }] } };
    for (const path of [[], ['plan']]) {
        const assembler = new LivePlanAssembler(path, undefined, 5);
        const text = JSON.stringify(path.length ? { plan: raw, performance: raw.performance } : raw); let visible;
        for (const char of text) { const commit = assembler.push(char); if (commit) visible = applyLiveOps(visible, commit.ops); }
        assert.ok(visible.objects[0].parts.length > 20);
        assert.equal(visible.objects[0].parts.find(part => part.id === 'pelvis').keys[0].position[1], .48, 'the streamed recipe already has the grounded starting pose');
    }
    const draft = adoptSceneBuild(raw, 'motion:shot');
    for (const time of [0, 2.5, 5]) {
        const frame = evaluateAuthoringDraft(draft, time);
        assert.equal(frame.state.objects.hero.facts.posture, 'kneeling');
        assert.equal(frame.plan.objects[0].parts.find(part => part.id === 'pelvis').keys[0].position[1], .48);
    }
    assert.deepEqual(draft.locomotion, []);
});

test('a grounded seated driver stays at the authored seat while the carrier moves throughout the shot', () => {
    const carKeys = keys(); carKeys[1].position[0] = 8;
    const raw = { ...plan([{ id: 'driver', recipe: 'humanoid', keys: keys() }, { id: 'car', recipe: 'vehicle', keys: carKeys, parts: [{ ...box('driver_seat'), shape: 'anchor', keys: keys([.3, .8, -.1]) }] }]), performance: { states: [{ objectId: 'driver', time: 0, posture: 'seated' }], events: [{ id: 'seated-driver', time: 0, objectId: 'driver', kind: 'attach', parent: { objectId: 'car', partId: 'driver_seat' }, relation: 'riding', localPose: { t: 0, position: [0, -.48, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, facts: { activity: 'driving' } }] } };
    const draft = adoptSceneBuild(raw, 'motion:driving');
    for (const time of [0, 2.5, 5]) {
        const frame = evaluateAuthoringDraft(draft, time);
        const pelvis = initialMotionTransform(frame.plan, 'driver', undefined, { partId: 'pelvis' });
        const seat = initialMotionTransform(frame.plan, 'car', undefined, { partId: 'driver_seat' });
        pelvis.position.forEach((value, index) => assert.ok(Math.abs(value - seat.position[index]) < 1e-6));
        assert.equal(frame.state.objects.driver.facts.activity, 'driving');
        assert.ok(frame.state.relationships.some(relation => relation.from === 'driver' && relation.to === 'car' && relation.relation === 'riding'));
    }
});

function fallenCup() {
    return adoptSceneBuild({ ...plan([box('hero'), { ...box('cup'), attachment: { objectId: 'hero' } }]), initialState: { relationships: [{ from: 'hero', to: 'cup', relation: 'holds' }], objects: { cup: { facts: { held: true } } } }, performance: { events: [
        { id: 'release', kind: 'detach', objectId: 'cup', time: 1, landing: { time: 3, position: [4, .2, 1] } },
        { id: 'landed', kind: 'facts', objectId: 'cup', time: 3, facts: { fallen: true }, removeFacts: ['held'] },
    ] } }, 'motion:cup');
}

test('a cup falls once, remains fallen after landing and later AI revisions, and rewinds without accumulated state', () => {
    const first = fallenCup();
    for (const time of [3, 4, 5]) {
        const frame = evaluateAuthoringDraft(first, time);
        assert.deepEqual(frame.plan.objects.find(object => object.id === 'cup').keys[0].position, [4, .2, 1]);
        assert.equal(frame.state.objects.cup.facts.fallen, true); assert.equal(frame.state.objects.cup.facts.held, undefined);
    }
    const continued = adoptSceneBuild({ ...first.plan, objects: [...first.plan.objects, box('lamp')] }, first.sourceKey, first);
    assert.deepEqual(evaluateAuthoringDraft(continued, 5).state.objects.cup.transform.position, [4, .2, 1]);
    const earlier = evaluateAuthoringDraft(continued, .5);
    assert.equal(earlier.state.objects.cup.facts.fallen, undefined); assert.equal(earlier.state.objects.cup.facts.held, true);
    assert.ok(earlier.state.relationships.some(relation => relation.relation === 'holds'));
});

test('paused local commands, undo and redo preserve the complete performance and use no server request', () => {
    const original = fallenCup(), client = new LiveSceneClient('', 'local'); client.loadLocalDraft(original);
    client.applyCommands([{ kind: 'pose', target: { objectId: 'hero' }, time: 4, pose: { ...keys([2, 0, 0])[0], t: 4 } }]);
    const changed = client.snapshot().authoring;
    assert.deepEqual(changed.events, original.events); assert.equal(client.snapshot().canUndo, true);
    client.undo(); assert.deepEqual(client.snapshot().plan, original.plan); assert.deepEqual(client.snapshot().authoring.events, original.events);
    client.redo(); assert.deepEqual(client.snapshot().plan, changed.plan); assert.ok(client.snapshot().authoring.revision > changed.revision);
    client.applyCommands([{ kind: 'remove', target: { objectId: 'cup' } }]);
    assert.ok(!client.snapshot().plan.objects.some(object => object.id === 'cup'));
    assert.ok(client.snapshot().pinned.includes('cup'));
    client.undo(); assert.deepEqual(client.snapshot().authoring.events, original.events);
});

test('arranging a static prop stays arranged through the clip; a post-landing correction preserves earlier history', () => {
    const ordinary = adoptSceneBuild(plan([box('table')]), 'manual:table'), client = new LiveSceneClient('', 'manual:table'); client.loadLocalDraft(ordinary);
    client.applyCommands(manualPoseCommands(ordinary, { objectId: 'table' }, 2, { ...keys([3, 0, 0])[0], t: 2 }));
    for (const time of [0, 2, 5]) assert.equal(evaluateAuthoringDraft(client.snapshot().authoring, time).state.objects.table.transform.position[0], 3);
    const fallen = fallenCup(); client.loadLocalDraft(fallen);
    client.applyCommands(manualPoseCommands(fallen, { objectId: 'cup' }, 4, { ...keys([2, 0, 0])[0], t: 4 }));
    assert.equal(evaluateAuthoringDraft(client.snapshot().authoring, 3).state.objects.cup.transform.position[0], 4);
    assert.equal(evaluateAuthoringDraft(client.snapshot().authoring, 5).state.objects.cup.transform.position[0], 6);
});

test('AI timed commands are idempotent, preserve manual controls, and honor explicit move times', () => {
    let draft = adoptSceneBuild(plan([{ id: 'hero', recipe: 'humanoid', keys: keys() }]), 'motion:protected');
    draft = applyAuthoringCommands(draft, draft.revision, [{ kind: 'pose', target: { objectId: 'hero' }, time: 0, pose: keys([2, 0, 0])[0] }]);
    const raw = { ...draft.plan, performance: { commands: [
        { kind: 'pose', target: { objectId: 'hero' }, time: 0, pose: keys([9, 0, 0])[0] },
        { kind: 'move', at: 1, move: { id: 'jump', objectId: 'hero', kind: 'jump', duration: 1 } },
    ] } };
    const first = adoptSceneBuild(raw, draft.sourceKey, draft), second = adoptSceneBuild(raw, draft.sourceKey, first);
    assert.equal(second.plan.objects[0].keys[0].position[0], 2); assert.equal(second.moves.length, 1); assert.equal(second.moves[0].start, 1);
});

test('streaming and final adoption preserve manually edited controls against implicit or explicit AI deletion', () => {
    const { mergeContinuationRaw } = require('../server/src/liveSceneStream.ts');
    const source = plan([{ ...box('hero'), parts: [{ ...box('arm'), parentId: 'body' }, box('body')] }, box('other')]);
    const controls = [JSON.stringify(['hero', 'arm'])];
    const input = { ...source, objects: [{ ...source.objects[0], removedPartIds: ['body', 'arm'] }], removedObjectIds: ['hero'] };
    const assembler = new LivePlanAssembler([], source, 5, { deltaOnly: true, protectedControls: controls });
    assembler.push(JSON.stringify(input));
    assert.ok(assembler.current.objects.find(object => object.id === 'hero').parts.some(part => part.id === 'arm'));
    const merged = mergeContinuationRaw(input, source, [], [], undefined, controls);
    assert.ok(merged.objects.find(object => object.id === 'hero').parts.some(part => part.id === 'body'));
});

test('legacy Spatial outcomes are retained as timed state without changing source or earlier state', () => {
    const draft = fallenCup(), outcome = evaluateAuthoringDraft(draft, 5).state;
    outcome.objects.hero.facts.finished = true; outcome.conditions.doorOpen = true;
    const next = reconcileSceneOutcome(draft, outcome, 'action');
    assert.equal(evaluateAuthoringDraft(next, 5).state.objects.hero.facts.finished, true);
    assert.equal(evaluateAuthoringDraft(next, 4).state.objects.hero.facts.finished, undefined);
    assert.deepEqual(next.sourceState, draft.sourceState);
    const sparseLegacy = structuredClone(outcome); delete sparseLegacy.objects.cup.facts.fallen;
    const preserved = reconcileSceneOutcome(draft, sparseLegacy, 'sparse', { facts: ['hero'], conditions: false, relationships: false });
    assert.equal(evaluateAuthoringDraft(preserved, 5).state.objects.cup.facts.fallen, true);
});

test('pinning keeps timed events and moves through AI continuation; saved rig assets retain the starting pose', () => {
    const source = fallenCup(), client = new LiveSceneClient('', 'local'); client.loadLocalDraft(source); client.togglePin('cup');
    assert.deepEqual(client.snapshot().authoring.events, source.events);
    const continued = adoptSceneBuild(client.snapshot().plan, source.sourceKey, client.snapshot().authoring, ['cup']);
    assert.equal(evaluateAuthoringDraft(continued, 5).state.objects.cup.facts.fallen, true);
    const kneeling = adoptSceneBuild({ ...plan([{ id: 'hero', recipe: 'humanoid', keys: keys() }]), performance: { states: [{ objectId: 'hero', time: 0, posture: 'kneeling' }] } }, 'asset:source');
    const preset = extractRigAssetPreset(kneeling, 'hero', { title: 'Kneeling actor', presetId: 'actor' });
    const inserted = applyRigAssetPreset(adoptSceneBuild(plan([box('other')]), 'asset:target'), preset, 'new_actor');
    const frame = evaluateAuthoringDraft(inserted, 5);
    assert.equal(frame.state.objects.new_actor.facts.posture, 'kneeling');
    assert.equal(frame.plan.objects.find(object => object.id === 'new_actor').parts.find(part => part.id === 'pelvis').keys[0].position[1], .48);
});

test('portable action presets retain root motion, timed release, landing and facts with explicit participant binding', () => {
    const source = fallenCup(); source.plan.objects[0].keys[1].position[0] = 2;
    const preset = extractActionNodePreset(source, { person: 'hero', prop: 'cup' }, { title: 'Drop cup', presetId: 'drop_cup' });
    const target = adoptSceneBuild(plan([box('other_person'), box('other_cup')]), 'motion:target');
    const next = applyActionPreset(target, preset, { person: 'other_person', prop: 'other_cup' }).draft;
    const result = evaluateAuthoringDraft(next, 5);
    assert.equal(result.state.objects.other_person.transform.position[0], 2);
    assert.equal(result.state.objects.other_cup.facts.fallen, true);
    assert.throws(() => applyActionPreset(target, preset, { person: 'other_person', prop: 'other_person' }), /distinct/);
});

test('fitting reusable stages and actions preserves the complete timeline and landing on shorter clips', () => {
    const source = fallenCup(), fitted = fitAuthoringDuration(source, 2.5);
    assert.equal(fitted.plan.duration, 2.5); assert.equal(fitted.events.find(event => event.id === 'release').landing.time, 1.5);
    assert.deepEqual(evaluateAuthoringDraft(fitted, 2.5).state.objects.cup.transform.position, [4, .2, 1]);
    const preset = fitPresetDuration(extractActionNodePreset(source, { actor: 'hero', prop: 'cup' }, { title: 'Short drop', presetId: 'short' }), 2.5);
    const target = fitAuthoringDuration(adoptSceneBuild(plan([box('person'), box('prop')]), 'short:target'), 2.5);
    const applied = applyActionPreset(target, preset, { actor: 'person', prop: 'prop' }).draft;
    assert.equal(evaluateAuthoringDraft(applied, 2.5).state.objects.prop.facts.fallen, true);
});
