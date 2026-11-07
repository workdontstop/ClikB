const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const { mergeLiveAuthoringPlan } = require('../src/liveAuthoringPlan.ts');
const core = require('../server/src/sceneAuthoring.ts');
const { validateScenePerformance } = require('../server/src/scenePerformance.ts');
const { planAtState } = require('../server/src/spatialWorld.ts');
const key = (t, x, rotation = 0) => ({ t, position: [x, 0, 0], rotation: [0, rotation, 0], scale: [1, 1, 1] });
const node = (id, x = 0) => ({ id, shape: 'box', color: '#ffffff', keys: [key(0, x), key(5, x + 1)] });
const fixture = () => ({ version: 1, duration: 5, background: '#101010', objects: [{ ...node('actor'), parts: [node('arm')] }, node('other', 10)], camera: [0, 5].map(t => ({ t, position: [0, 3, 8], target: [0, 0, 0], fov: 45 })) });
const control = (id, part = '') => JSON.stringify([id, part]);
const acceptedFixture = () => {
    const plan = fixture(), actor = plan.objects[0];
    actor.shape = 'sphere';
    actor.keys = [key(0, 3), key(2, 6, .3), key(5, 8, .7)];
    actor.parts[0].keys = [key(0, 1, .5), key(3, 2, .9), key(5, 3, 1.4)];
    plan.objects[1].keys = [key(0, 30), key(5, 35)];
    return plan;
};

test('corrected live root and part tracks replace old controls, masks, locks and procedural replay', () => {
    const previous = core.createAuthoringDraft(fixture(), 'live-test');
    previous.manualControls = [control('actor'), control('actor', 'arm'), control('other'), control('$camera')];
    previous.masks = [
        { objectId: 'actor', start: 0, end: 5, channels: ['position'] },
        { objectId: 'actor', partId: 'arm', target: { objectId: 'actor', partId: 'arm' }, start: 0, end: 5, channels: ['rotation'] },
    ];
    previous.locks = [
        { objectId: 'actor', time: 0, end: 5, channels: ['position'], pose: key(0, 0) },
        { objectId: 'actor', partId: 'arm', time: 0, end: 5, channels: ['rotation'], pose: key(0, 0) },
    ];
    previous.rigs.actor = { kind: 'biped', strideLength: 1, controls: { left_shoulder: 'arm' } };
    previous.locomotion = ['actor'];
    previous.moves = [{ id: 'old-jump', objectId: 'actor', kind: 'jump', start: 0, duration: 5 }];
    previous.events = [
        { id: 'old-drop', objectId: 'actor', kind: 'detach', time: 1, landing: { time: 2, position: [0, 0, 0] } },
        { id: 'keep-facts', objectId: 'actor', kind: 'facts', time: 1, facts: { mood: 'ready' } },
    ];
    previous.lightingRig = { preset: 'studio', azimuthDeg: 0, elevationDeg: 40, intensity: 1 };
    previous.sourceState.conditions = { weather: 'sunny' };
    const accepted = acceptedFixture(), before = JSON.stringify(previous), acceptedBefore = JSON.stringify(accepted);
    const merged = mergeLiveAuthoringPlan(previous, accepted, ['actor']);
    assert.deepEqual(merged.plan.objects[0], accepted.objects[0]);
    assert.deepEqual(merged.plan.objects[1].keys, previous.plan.objects[1].keys);
    assert.deepEqual(merged.plan.camera, previous.plan.camera);
    assert.deepEqual(merged.masks, []);
    assert.deepEqual(merged.locks, []);
    assert.deepEqual(merged.moves, []);
    assert.deepEqual(merged.locomotion, []);
    assert.deepEqual(merged.events.map(event => event.id), ['keep-facts']);
    assert.deepEqual(merged.lightingRig, previous.lightingRig);
    assert.deepEqual(merged.sourceState.conditions, previous.sourceState.conditions);
    assert.equal(merged.draftId, previous.draftId);
    assert.equal(merged.sourceKey, previous.sourceKey);
    assert.equal(merged.revision, previous.revision);
    assert.equal(JSON.stringify(previous), before);
    assert.equal(JSON.stringify(accepted), acceptedBefore);
    assert.ok(merged.manualControls.includes(control('actor')));
    assert.ok(merged.manualControls.includes(control('actor', 'arm')));
    assert.deepEqual(core.evaluateAuthoringDraft(merged, 2).plan.objects[0].keys[0].position, [6, 0, 0]);
    assert.ok(validateScenePerformance({ plan: merged.plan, authoring: merged }).authoring);
});

test('accepted animation is retained as complete manual tracks through a subsequent AI merge', () => {
    const previous = core.createAuthoringDraft(fixture(), 'animated-test'), accepted = acceptedFixture();
    const merged = mergeLiveAuthoringPlan(previous, accepted, ['actor', 'actor']);
    const competing = fixture();
    competing.objects[0].keys = [key(0, 50), key(5, 51)];
    const later = core.mergeAuthoringPlan(merged, competing);
    assert.deepEqual(later.plan.objects[0].keys, accepted.objects[0].keys);
    assert.deepEqual(later.plan.objects[0].parts[0].keys, accepted.objects[0].parts[0].keys);
    assert.equal(merged.manualControls.filter(item => item === control('actor')).length, 1);
    assert.equal(merged.locks.length, 0);
    assert.equal(core.samplePose(later.plan.objects[0], 2).position[0], 6);
    assert.equal(core.samplePose(later.plan.objects[0], 5).position[0], 8);
});

test('deleted pinned entities stay absent from plans, authoring state, rigs and later state reconstruction', () => {
    const previous = core.createAuthoringDraft(fixture(), 'delete-test');
    previous.rigs.actor = { kind: 'biped', strideLength: 1, controls: { left_shoulder: 'arm' } };
    previous.locomotion = ['actor'];
    previous.manualControls = [control('actor'), control('actor', 'arm'), control('other')];
    previous.sourceState.controlledObject = 'actor';
    previous.sourceState.relationships = [{ from: 'actor', to: 'other', relation: 'near' }];
    previous.cameraRig = { kind: 'mounted', target: { objectId: 'actor' }, offset: [0, 2, 8], lookOffset: [0, 0, 0], focalLengthMm: 50 };
    const accepted = fixture(); accepted.objects.shift();
    const merged = mergeLiveAuthoringPlan(previous, accepted, ['actor']);
    assert.equal(merged.plan.objects.some(object => object.id === 'actor'), false);
    assert.equal(merged.sourceState.objects.actor, undefined);
    assert.equal(merged.sourceState.controlledObject, undefined);
    assert.deepEqual(merged.sourceState.relationships, []);
    assert.deepEqual(merged.rigs, {});
    assert.deepEqual(merged.locomotion, []);
    assert.deepEqual(merged.manualControls, [control('other')]);
    assert.equal(merged.cameraRig, undefined);
    const evaluated = core.evaluateAuthoringDraft(merged, 2);
    assert.equal(planAtState({ plan: merged.plan }, evaluated.state).objects.some(object => object.id === 'actor'), false);
});

test('new geometry and removed rig controls validate without mutating the saved baseline', () => {
    const previous = core.createAuthoringDraft(fixture(), 'geometry-test');
    previous.rigs.actor = { kind: 'biped', strideLength: 1, controls: { left_shoulder: 'arm' } };
    const accepted = acceptedFixture();
    accepted.objects[0].parts = [node('new-arm', 2)];
    accepted.objects.push(node('new-object', 4));
    const merged = mergeLiveAuthoringPlan(previous, accepted, ['actor']);
    assert.deepEqual(merged.rigs.actor.controls, {});
    assert.ok(merged.sourceState.objects['new-object']);
    assert.ok(merged.manualControls.includes(control('actor', 'new-arm')));
    assert.equal(merged.manualControls.includes(control('actor', 'arm')), false);
    assert.deepEqual(merged.sourceState.objects.other.transform, previous.sourceState.objects.other.transform);
    assert.ok(validateScenePerformance({ plan: merged.plan, authoring: merged }).authoring);
});

test('corrected attachments use accepted hierarchy and retain unrelated semantic facts', () => {
    const previous = core.createAuthoringDraft(fixture(), 'attachment-test');
    previous.sourceState.relationships = [{ from: 'other', to: 'actor', relation: 'holds', facts: { hand: 'left' } }, { from: 'actor', to: 'other', relation: 'friends' }];
    previous.events = [{ id: 'old-attach', objectId: 'other', kind: 'attach', time: 1, parent: { objectId: 'actor', partId: 'arm' }, relation: 'attached' }];
    const accepted = acceptedFixture(); accepted.objects[0].attachment = { objectId: 'other' };
    const merged = mergeLiveAuthoringPlan(previous, accepted, ['actor']);
    assert.deepEqual(merged.events, []);
    assert.deepEqual(merged.sourceState.relationships, [{ from: 'actor', to: 'other', relation: 'friends' }, { from: 'other', to: 'actor', relation: 'holds', facts: { hand: 'left' } }]);
    assert.deepEqual(core.evaluateAuthoringDraft(merged, 2).plan.objects[0].attachment, { objectId: 'other' });
});

test('legacy plans do not acquire an authoring document and invalid accepted plans are rejected', () => {
    assert.equal(mergeLiveAuthoringPlan(undefined, acceptedFixture(), ['actor']), undefined);
    const previous = core.createAuthoringDraft(fixture(), 'invalid-test'), accepted = acceptedFixture();
    accepted.objects[0].keys[0].position[0] = Infinity;
    assert.throws(() => mergeLiveAuthoringPlan(previous, accepted, ['actor']), /range/);
});
