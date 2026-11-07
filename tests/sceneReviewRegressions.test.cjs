const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { adoptSceneBuild, reconcileSceneOutcome } = require('../server/src/sceneBuildAuthoring.ts');
const { adoptLiveAuthoringResult } = require('../server/src/liveAuthoringPlan.ts');
const { applyAuthoringCommands, evaluateAuthoringDraft } = require('../server/src/sceneAuthoring.ts');
const { fitAuthoringDuration, restoreAuthoringDraft } = require('../server/src/sceneAuthoring.ts');
const { validateScenePerformance } = require('../server/src/scenePerformance.ts');
const { mergeContinuationRaw, LivePlanAssembler, applyLiveOps } = require('../server/src/liveSceneStream.ts');
const { extractActionNodePreset, applyActionPreset, fitPresetDuration, extractMotionNodePreset, applyMotionPreset } = require('../server/src/scenePresets.ts');
const { initialMotionTransform, initialMotionMatrix } = require('../server/src/motionNodeTransforms.ts');
const keys = (position = [0, 0, 0], rotation = [0, 0, 0]) => [0, 5].map(t => ({ t, position: [...position], rotation: [...rotation], scale: [1, 1, 1] }));
const box = (id, position, rotation) => ({ id, shape: 'box', color: '#6686b3', keys: keys(position, rotation) });
const plan = objects => ({ version: 1, duration: 5, background: '#edf5fc', objects, camera: [0, 5].map(t => ({ t, position: [3, 2, 6], target: [0, 1, 0], fov: 45 })) });
const close = (actual, expected) => actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-6, `${actual} != ${expected}`));

test('Spatial Assist and recovery adopt canonical moves/events and reject foreign or inconsistent documents', () => {
    const base = adoptSceneBuild(plan([{ id: 'hero', recipe: 'humanoid', keys: keys() }]), 'spatial:node');
    const accepted = adoptSceneBuild({ ...base.plan, performance: { commands: [{ kind: 'move', at: 1, move: { id: 'jump', objectId: 'hero', kind: 'jump', duration: 2 } }], events: [{ id: 'done', time: 3, kind: 'facts', objectId: 'hero', facts: { jumped: true } }] } }, base.sourceKey, base);
    const result = { plan: accepted.plan, authoring: accepted };
    for (const original of [base, structuredClone(base)]) {
        const next = adoptLiveAuthoringResult(original, result);
        assert.equal(evaluateAuthoringDraft(next, 2).state.objects.hero.transform.position[1], .9);
        assert.equal(evaluateAuthoringDraft(next, 5).state.objects.hero.facts.jumped, true);
    }
    assert.ok(adoptLiveAuthoringResult(base, { plan: base.plan }));
    assert.throws(() => adoptLiveAuthoringResult({ ...base, sourceKey: 'other' }, result), /different source/);
    const bad = structuredClone(result); bad.plan = structuredClone(bad.plan); bad.plan.background = '#111111';
    assert.throws(() => adoptLiveAuthoringResult(base, bad), /disagree/);
    const component = fs.readFileSync(require.resolve('../src/components/SpatialStudio.tsx'), 'utf8');
    assert.equal((component.match(/adoptLiveAuthoringResult\((?:initial|baseDraft), result,/g) || []).length, 2);
});

test('AI cannot delete ancestors of pinned attached entities or protected articulated controls', () => {
    const base = adoptSceneBuild(plan([box('parent'), { ...box('child'), attachment: { objectId: 'parent', partId: 'hand' } }, box('other')].map(object => object.id === 'parent' ? { ...object, parts: [box('body'), { ...box('hand'), parentId: 'body' }] } : object)), 'protect');
    for (const target of [{ objectId: 'parent' }, { objectId: 'parent', partId: 'body' }]) {
        const next = adoptSceneBuild({ ...base.plan, performance: { commands: [{ kind: 'remove', target }] } }, base.sourceKey, base, ['child']);
        assert.equal(next.plan.objects.length, 3);
        assert.equal(next.plan.objects[0].parts.length, 2);
    }
    const parentPin = adoptSceneBuild({ ...base.plan, performance: { commands: [{ kind: 'remove', target: { objectId: 'parent', partId: 'hand' } }] } }, base.sourceKey, base, ['parent']);
    assert.equal(parentPin.plan.objects[0].parts.length, 2);
    const manual = applyAuthoringCommands(base, base.revision, [{ kind: 'pose', target: { objectId: 'parent', partId: 'hand' }, time: 0, pose: keys([7, 0, 0])[0] }]);
    const next = adoptSceneBuild({ ...manual.plan, performance: { commands: [{ kind: 'remove', target: { objectId: 'parent', partId: 'body' } }] } }, manual.sourceKey, manual);
    assert.ok(next.plan.objects[0].parts.find(part => part.id === 'hand'));
});

test('AI preserves masked intervals across key interpolation, moves, hierarchy changes and operation replacement', () => {
    let base = adoptSceneBuild(plan([{ id: 'hero', recipe: 'humanoid', keys: keys([7, 0, 0]) }, box('other')]), 'mask');
    base = applyAuthoringCommands(base, base.revision, [{ kind: 'mask', mask: { target: { objectId: 'hero' }, start: 1, end: 3, channels: ['position'] } }]);
    const commands = [
        { kind: 'pose', target: { objectId: 'hero' }, time: 2, pose: keys([99, 0, 0])[0] },
        { kind: 'pose', target: { objectId: 'hero' }, time: 4, pose: keys([99, 0, 0])[0] },
        { kind: 'move', at: 1, move: { id: 'jump', objectId: 'hero', kind: 'jump', duration: 2 } },
        { kind: 'event', event: { id: 'attach', objectId: 'hero', time: 2, kind: 'attach', parent: { objectId: 'other' }, relation: 'attached' } },
    ];
    const next = adoptSceneBuild({ ...base.plan, performance: { commands } }, base.sourceKey, base);
    for (const t of [1, 2, 3]) assert.equal(evaluateAuthoringDraft(next, t).state.objects.hero.transform.position[0], 7);
    assert.equal(next.moves.length, 0); assert.equal(next.events.length, 0);
    const rotate = adoptSceneBuild({ ...base.plan, performance: { commands: [{ kind: 'pose', target: { objectId: 'hero' }, time: 2, channels: ['rotation'], pose: keys([99, 0, 0], [0, 1, 0])[0] }] } }, base.sourceKey, base);
    assert.equal(evaluateAuthoringDraft(rotate, 2).state.objects.hero.transform.position[0], 7);
    assert.equal(evaluateAuthoringDraft(rotate, 2).state.objects.hero.transform.rotation[1], 1);
    const moved = adoptSceneBuild({ ...base.plan, performance: { commands: [{ kind: 'move', at: 1, move: { id: 'retained', objectId: 'other', kind: 'jump', duration: 1 } }] } }, base.sourceKey, base);
    const replaced = adoptSceneBuild({ ...moved.plan, performance: { commands: [{ kind: 'move', at: 1, move: { id: 'retained', objectId: 'hero', kind: 'jump', duration: 1 } }] } }, base.sourceKey, moved, ['other']);
    assert.equal(replaced.moves[0].objectId, 'other');
});

test('Spatial capabilities are canonical timed outcomes and survive serialization', () => {
    const ground = { kind: 'ground', vertical: false, speed: .65, turnRate: 1 }, air = { kind: 'air', vertical: true, speed: 2, turnRate: 2 };
    const base = adoptSceneBuild(plan([box('hero')]), 'spatial:caps'); base.sourceState.locomotion = ground;
    const outcome = structuredClone(base.sourceState); outcome.locomotion = air;
    for (const operation of ['action', 'return']) {
        const result = reconcileSceneOutcome(base, outcome, `outcome:${operation}`, { facts: [], conditions: false, relationships: false, locomotion: true });
        assert.deepEqual(evaluateAuthoringDraft(result, 0).state.locomotion, ground);
        const adopted = adoptLiveAuthoringResult(base, { plan: result.plan, authoring: JSON.parse(JSON.stringify(result)) });
        assert.deepEqual(evaluateAuthoringDraft(adopted, 5).state.locomotion, air);
    }
    assert.throws(() => applyAuthoringCommands(base, 0, [{ kind: 'event', event: { id: 'bad', time: 1, objectId: 'hero', kind: 'facts', locomotion: { ...air, speed: NaN } } }]), /capabilities/);
});

test('posture cues sort by story time, resolve overlapping holds, and replace interior posture channels only', () => {
    let base = adoptSceneBuild(plan([{ id: 'hero', recipe: 'humanoid', keys: keys() }]), 'posture');
    const pelvis = base.plan.objects[0].parts.find(part => part.id === 'pelvis');
    pelvis.keys.splice(1, 0, { ...structuredClone(pelvis.keys[0]), t: 2, position: [.2, .7, .3], rotation: [0, .4, 0] });
    const cues = [{ objectId: 'hero', time: 0, posture: 'kneeling', until: 5 }, { objectId: 'hero', time: 3, posture: 'standing', until: 4 }];
    for (const states of [cues, [...cues].reverse()]) {
        const next = adoptSceneBuild({ ...base.plan, performance: { states } }, base.sourceKey);
        for (const time of [0, 1, 2]) {
            const part = evaluateAuthoringDraft(next, time).plan.objects[0].parts.find(part => part.id === 'pelvis');
            assert.equal(part.keys[0].position[1], .48);
        }
        for (const time of [3, 4, 5]) {
            const frame = evaluateAuthoringDraft(next, time);
            assert.equal(frame.plan.objects[0].parts.find(part => part.id === 'pelvis').keys[0].position[1], .91);
            assert.equal(frame.state.objects.hero.facts.posture, 'standing');
        }
        const custom = evaluateAuthoringDraft(next, 2).plan.objects[0].parts.find(part => part.id === 'pelvis').keys[0];
        assert.equal(custom.position[0], .2); assert.equal(custom.rotation[1], .4);
    }
    const first = adoptSceneBuild({ ...base.plan, performance: { states: [cues[0]] } }, base.sourceKey);
    const later = adoptSceneBuild({ ...first.plan, performance: { states: [cues[1]] } }, base.sourceKey, first);
    const final = evaluateAuthoringDraft(later, 5);
    assert.equal(final.plan.objects[0].parts.find(part => part.id === 'pelvis').keys[0].position[1], .91);
    assert.equal(final.state.objects.hero.facts.posture, 'standing');
});

test('action presets retain initial attachments, relationships and all attach/detach state payloads', () => {
    const source = adoptSceneBuild({ ...plan([box('actor'), { ...box('cup', [1, 0, 0]), attachment: { objectId: 'actor' } }, box('other')]), initialState: { objects: { cup: { facts: { held: true, old: true } } }, relationships: [{ from: 'actor', to: 'cup', relation: 'holds' }] }, performance: { events: [
        { id: 'drop', time: 1, objectId: 'cup', kind: 'detach', facts: { dropped: true }, removeFacts: ['held', 'old'], conditions: { spilled: true }, removeConditions: ['dry'], relationships: [{ from: 'cup', to: 'actor', relation: 'near', facts: { distance: 1 } }] },
        { id: 'pick', time: 3, objectId: 'cup', kind: 'attach', parent: { objectId: 'actor' }, relation: 'holds', facts: { held: true }, removeFacts: ['dropped'], removeConditions: ['spilled'], removeRelationships: [{ from: 'cup', to: 'actor', relation: 'near' }] },
    ] } }, 'preset:source');
    source.sourceState.conditions.dry = true;
    const preset = extractActionNodePreset(source, { actor: 'actor', prop: 'cup' }, { presetId: 'cup_action', title: 'Cup action' });
    const target = adoptSceneBuild(plan([box('newActor'), box('newCup'), box('unrelated')]), 'preset:target');
    const applied = applyActionPreset(target, JSON.parse(JSON.stringify(preset)), { actor: 'newActor', prop: 'newCup' }).draft;
    assert.deepEqual(evaluateAuthoringDraft(applied, .5).plan.objects.find(object => object.id === 'newCup').attachment, { objectId: 'newActor' });
    assert.ok(evaluateAuthoringDraft(applied, .5).state.relationships.some(r => r.from === 'newActor' && r.to === 'newCup' && r.relation === 'holds'));
    const dropped = evaluateAuthoringDraft(applied, 2).state;
    assert.equal(dropped.objects.newCup.facts.dropped, true); assert.equal(dropped.objects.newCup.facts.held, undefined); assert.equal(dropped.conditions.dry, undefined);
    assert.ok(dropped.relationships.some(r => r.from === 'newCup' && r.to === 'newActor' && r.relation === 'near'));
    const picked = evaluateAuthoringDraft(applied, 4).state;
    assert.equal(picked.objects.newCup.facts.held, true); assert.equal(picked.conditions.spilled, undefined); assert.ok(!picked.relationships.some(r => r.relation === 'near'));
    assert.throws(() => extractActionNodePreset(source, { prop: 'cup' }, { title: 'Missing parent' }), /dependencies|parent/);
    assert.throws(() => applyActionPreset(target, preset, { prop: 'newCup' }), /Bind/);
    const fit = fitPresetDuration(preset, 2); assert.equal(fit.events[0].time, .4);
});

test('action root travel, prop placement and landing retarget through source/target facing frames', () => {
    // Source faces +X; target faces +Z. A forward path must rotate with it.
    const actor = box('actor', [2, 0, 3], [0, Math.PI / 2, 0]); actor.keys[1].position[0] += 4;
    const prop = box('prop', [3, 0, 3], [0, Math.PI / 2, 0]); prop.keys[1].position[0] += 4;
    const source = adoptSceneBuild(plan([actor, prop]), 'facing:source');
    const preset = extractActionNodePreset(source, { actor: 'actor', prop: 'prop' }, { title: 'Forward' });
    const target = adoptSceneBuild(plan([box('hero', [10, 0, 10]), box('cup')]), 'facing:target');
    const result = applyActionPreset(target, preset, { actor: 'hero', prop: 'cup' }).draft;
    close(evaluateAuthoringDraft(result, 5).state.objects.hero.transform.position, [10, 0, 14]);
    close(evaluateAuthoringDraft(result, 0).state.objects.cup.transform.position, [10, 0, 11]);
    close(evaluateAuthoringDraft(result, 5).state.objects.cup.transform.position, [10, 0, 15]);
    const attachedSource = adoptSceneBuild({ ...source.plan, objects: [actor, { ...box('prop', [0, 0, 1]), attachment: { objectId: 'actor' } }], performance: { events: [{ id: 'release', kind: 'detach', objectId: 'prop', time: 1, landing: { time: 2, position: [8, .2, 3] } }] } }, 'attached:source');
    const heldPreset = extractActionNodePreset(attachedSource, { actor: 'actor', prop: 'prop' }, { title: 'Held forward' });
    const held = applyActionPreset(target, heldPreset, { actor: 'hero', prop: 'cup' }).draft;
    close(initialMotionTransform(evaluateAuthoringDraft(held, 0).plan, 'cup').position, [10, 0, 11]);
    close(initialMotionTransform(evaluateAuthoringDraft(held, 3).plan, 'cup').position, [10, .2, 16]);
});

test('whole-plan continuation and streamed updates preserve pinned dependency frames while unrelated geometry can change', () => {
    const raw = plan([{ ...box('parent'), parts: [{ ...box('socket', [0, 1, 0]), pivot: [.2, 0, 0] }] }, { ...box('child', [1, 0, 0]), attachment: { objectId: 'parent', partId: 'socket' } }, box('other')]);
    const base = adoptSceneBuild(raw, 'frames:protected'); base.manualControls = [JSON.stringify(['child', ''])];
    const incoming = structuredClone(base.plan);
    incoming.objects[0].keys = keys([20, 0, 0], [0, .7, 0]); incoming.objects[0].pivot = [.4, 0, 0]; incoming.objects[0].color = '#ff0000';
    incoming.objects[0].parts[0].keys = keys([2, 3, 0]); incoming.objects[0].parts[0].pivot = [1, 0, 0];
    incoming.objects[2].keys = keys([4, 0, 0]);
    const merged = mergeContinuationRaw(incoming, base.plan, [], ['child'], undefined, base.manualControls);
    const adopted = adoptSceneBuild(merged, base.sourceKey, base, ['child']);
    const direct = adoptSceneBuild(incoming, base.sourceKey, base, ['child']);
    for (const next of [adopted, direct]) {
        close(initialMotionTransform(evaluateAuthoringDraft(next, 2).plan, 'child').position, [1, 1, 0]);
        assert.equal(next.plan.objects[0].color, '#ff0000');
        assert.equal(next.plan.objects.find(object => object.id === 'other').keys[0].position[0], 4);
        assert.deepEqual(next.plan.objects[0].parts[0].pivot, [.2, 0, 0]);
    }
    const assembler = new LivePlanAssembler([], base.plan, 5, { pinned: ['child'], protectedControls: base.manualControls, deltaOnly: true });
    let visible = base.plan;
    for (const char of JSON.stringify(incoming)) { const commit = assembler.push(char); if (commit) visible = applyLiveOps(visible, commit.ops); }
    close(initialMotionTransform(visible, 'child').position, [1, 1, 0]);
    const shorter = { ...base.plan, duration: 2.5, camera: base.plan.camera.map(key => ({ ...key, t: key.t / 2 })), objects: [box('other')].map(object => ({ ...object, keys: object.keys.map(key => ({ ...key, t: key.t / 2 })) })) };
    assert.doesNotThrow(() => adoptSceneBuild(shorter, base.sourceKey, base, ['child']));
});

test('duration fitting retimes posture metadata through validation, serialization, presets and sparse refinement', () => {
    const base = adoptSceneBuild({ ...plan([{ id: 'hero', recipe: 'humanoid', keys: keys() }]), performance: { states: [{ objectId: 'hero', time: 0, posture: 'kneeling' }] } }, 'duration:posture');
    for (const duration of [2.5, 10]) {
        const fitted = fitAuthoringDuration(base, duration);
        const checked = validateScenePerformance({ plan: fitted.plan, authoring: fitted }).authoring;
        assert.equal(checked.events[0].stateCue.until, duration);
        assert.ok(checked.events[0].stateCue.generated.every(key => key.t <= duration));
        const restored = restoreAuthoringDraft(JSON.stringify(checked));
        const next = adoptSceneBuild({ ...restored.plan, performance: { states: [{ objectId: 'hero', time: duration * .8, posture: 'standing' }] } }, restored.sourceKey, restored);
        assert.equal(evaluateAuthoringDraft(next, duration).state.objects.hero.facts.posture, 'standing');
        const action = fitPresetDuration(extractActionNodePreset(base, { actor: 'hero' }, { title: 'Kneel' }), duration);
        const applied = applyActionPreset(checked, action, { actor: 'hero' }).draft;
        assert.doesNotThrow(() => validateScenePerformance({ plan: applied.plan, authoring: applied }));
    }
});

test('saved posture replay preserves explicit asymmetric refinements through sparse and repeated adoption', () => {
    const raw = { ...plan([{ id: 'hero', recipe: 'humanoid', keys: keys() }]), performance: { states: [{ objectId: 'hero', time: 0, posture: 'kneeling' }], commands: [{ kind: 'pose', target: { objectId: 'hero', partId: 'left_knee' }, time: 2, pose: { ...keys()[0], rotation: [.9, .1, 0] } }] } };
    const first = adoptSceneBuild(raw, 'custom:knee');
    const patch = { states: [{ objectId: 'hero', time: 4, posture: 'standing' }] };
    const second = adoptSceneBuild({ ...first.plan, performance: patch }, first.sourceKey, first);
    const third = adoptSceneBuild({ ...second.plan, performance: patch }, first.sourceKey, second);
    for (const draft of [first, second, third, restoreAuthoringDraft(JSON.stringify(third))]) {
        const knee = evaluateAuthoringDraft(draft, 2).plan.objects[0].parts.find(part => part.id === 'left_knee').keys[0];
        assert.equal(knee.rotation[0], .9); assert.equal(knee.rotation[1], .1);
    }
    assert.equal(evaluateAuthoringDraft(third, 5).state.objects.hero.facts.posture, 'standing');
    // An explicit refinement remains creator-authored even if its scalar
    // happens to equal the generic pose it replaced.
    const initial = adoptSceneBuild({ ...plan([{ id: 'hero', recipe: 'humanoid', keys: keys() }]), performance: { states: [{ objectId: 'hero', time: 0, posture: 'kneeling' }] } }, 'same-value:custom');
    const knee = initial.plan.objects[0].parts.find(part => part.id === 'left_knee');
    const refined = adoptSceneBuild({ ...initial.plan, performance: { commands: [{ kind: 'pose', target: { objectId: 'hero', partId: 'left_knee' }, time: 5, pose: structuredClone(knee.keys.at(-1)) }] } }, initial.sourceKey, initial);
    const continued = adoptSceneBuild({ ...refined.plan, performance: { states: [{ objectId: 'hero', time: 3, until: 4, posture: 'standing' }] } }, refined.sourceKey, refined);
    assert.equal(evaluateAuthoringDraft(continued, 5).plan.objects[0].parts.find(part => part.id === 'left_knee').keys[0].rotation[0], Math.PI / 2);
});

test('action attach without a local pose preserves the evaluator-derived offset for moving rotated parents and sockets', () => {
    for (const socket of [false, true]) {
        const actor = box('actor', [3, 0, 0], [0, .4, 0]); actor.keys[1].position[0] = 7; actor.keys[1].rotation[1] = 1;
        if (socket) actor.parts = [box('hand', [.4, 1, 0], [.2, 0, 0])];
        const source = adoptSceneBuild({ ...plan([actor, box('prop', [5, 1, 0])]), performance: { events: [{ id: 'pickup', time: 2, kind: 'attach', objectId: 'prop', parent: { objectId: 'actor', ...(socket ? { partId: 'hand' } : {}) }, relation: 'holds' }] } }, 'attach:source');
        const preset = extractActionNodePreset(source, { actor: 'actor', prop: 'prop' }, { title: 'Pick up' });
        assert.equal(preset.events[0].localPose, undefined);
        const targetActor = box('hero', [3, 0, 0], [0, .4, 0]); if (socket) targetActor.parts = [box('hand', [.4, 1, 0], [.2, 0, 0])];
        const target = adoptSceneBuild(plan([targetActor, box('cup', [5, 1, 0])]), 'attach:target');
        const applied = applyActionPreset(target, preset, { actor: 'hero', prop: 'cup' }).draft;
        for (const t of [0, 1.99, 2, 3, 5]) {
            const original = initialMotionTransform(evaluateAuthoringDraft(source, t).plan, 'prop');
            const actual = initialMotionTransform(evaluateAuthoringDraft(applied, t).plan, 'cup');
            close(actual.position, original.position); close(actual.rotation, original.rotation);
        }
    }
});

test('standalone action detaches attached targets without a world-frame jump, including delayed starts', () => {
    for (const travel of [0, 2]) for (const startTime of [0, 2]) for (const socket of [false, true]) {
        const actor = box('actor'); actor.keys[1].position[2] = travel;
        const source = adoptSceneBuild(plan([actor]), 'detach:source');
        const full = extractActionNodePreset(source, { actor: 'actor' }, { title: 'Stand or move' });
        const carrier = box('carrier', [10, 0, 0], [0, .8, 0]); carrier.keys[1].position[0] = 15;
        if (socket) carrier.parts = [box('seat', [.4, .6, 0], [0, .2, 0])];
        const hero = { ...box('hero', [1, 0, 0], [0, .1, 0]), pivot: [.2, .1, 0], attachment: { objectId: 'carrier', ...(socket ? { partId: 'seat' } : {}) } };
        const target = adoptSceneBuild(plan([carrier, hero]), 'detach:target');
        const before = initialMotionTransform(evaluateAuthoringDraft(target, startTime).plan, 'hero');
        const applied = applyActionPreset(target, fitPresetDuration(full, 5 - startTime), { actor: 'hero' }, startTime).draft;
        for (const t of [startTime, 5]) {
            const actual = initialMotionTransform(evaluateAuthoringDraft(applied, t).plan, 'hero');
            const distance = t === startTime ? 0 : travel;
            const facing = socket ? 1.1 : .9;
            close(actual.position, [before.position[0] + Math.sin(facing) * distance, before.position[1], before.position[2] + Math.cos(facing) * distance]); close(actual.rotation, before.rotation);
        }
        if (startTime) for (const t of [0, 1, 1.99]) close(initialMotionTransform(evaluateAuthoringDraft(applied, t).plan, 'hero').position, initialMotionTransform(evaluateAuthoringDraft(target, t).plan, 'hero').position);
    }
});

test('restoring canonical moves preserves exact starts and overlap independently of array order; manual queueing remains', () => {
    const base = adoptSceneBuild(plan([{ id: 'hero', recipe: 'humanoid', keys: keys() }]), 'moves:exact');
    const commands = [{ kind: 'move', at: 3, move: { id: 'late', objectId: 'hero', kind: 'jump', duration: 1 } }, { kind: 'move', at: 1, move: { id: 'early', objectId: 'hero', kind: 'jump', duration: 1 } }, { kind: 'move', at: 3.2, move: { id: 'overlap', objectId: 'hero', kind: 'roll', duration: .5 } }];
    const accepted = adoptSceneBuild({ ...base.plan, performance: { commands } }, base.sourceKey, base);
    assert.ok(commands.every(command => command.exact === undefined), 'AI adoption must not mutate the caller commands');
    const starts = [['late', 3], ['early', 1], ['overlap', 3.2]];
    assert.deepEqual(accepted.moves.map(move => [move.id, move.start]), starts);
    const restored = restoreAuthoringDraft(JSON.stringify(accepted));
    const checked = validateScenePerformance({ plan: restored.plan, authoring: restored }).authoring;
    assert.deepEqual(checked.moves.map(move => [move.id, move.start]), starts);
    const action = extractActionNodePreset(checked, { actor: 'hero' }, { title: 'Timed moves' });
    const applied = applyActionPreset(base, action, { actor: 'hero' }).draft;
    assert.deepEqual(applied.moves.map(move => move.start), [3, 1, 3.2]);
    const motion = extractMotionNodePreset(checked, 'hero', { title: 'Timed motion' });
    assert.deepEqual(applyMotionPreset(base, motion, 'hero').draft.moves.map(move => move.start), [3, 1, 3.2]);
    for (const time of [1.5, 3.4]) close(evaluateAuthoringDraft(checked, time).state.objects.hero.transform.position, evaluateAuthoringDraft(accepted, time).state.objects.hero.transform.position);
    const manual = applyAuthoringCommands(base, base.revision, commands.slice(0, 2));
    assert.equal(manual.moves[1].start, 4, 'new manual moves retain intentional queueing');
});

test('delayed action insertion preserves an earlier detach, landing or reparent and every pre-start frame', () => {
    const source = adoptSceneBuild(plan([box('actor')]), 'prior-event:source');
    const preset = fitPresetDuration(extractActionNodePreset(source, { actor: 'actor' }, { title: 'Stand' }), 3);
    for (const kind of ['detach', 'landing', 'reparent']) {
        const carrier = box('carrier', [10, 0, 0], [0, .4, 0]); carrier.keys[1].position[2] = 3;
        const nextCarrier = box('nextCarrier', [-3, 0, 2], [0, 1, 0]); nextCarrier.keys[1].position[0] = 2; nextCarrier.parts = [box('seat', [.2, .6, 0], [0, .2, 0])];
        const hero = { ...box('hero', [1, 0, 0], [0, .2, 0]), pivot: [.15, .2, 0], attachment: { objectId: 'carrier' } };
        const event = kind === 'reparent' ? { id: 'old-event', time: 1, objectId: 'hero', kind: 'attach', parent: { objectId: 'nextCarrier', partId: 'seat' }, relation: 'riding' }
            : { id: 'old-event', time: 1, objectId: 'hero', kind: 'detach', ...(kind === 'landing' ? { landing: { time: 1.5, position: [3, .2, 2] } } : {}) };
        const target = adoptSceneBuild({ ...plan([carrier, nextCarrier, hero]), performance: { events: [event] } }, `prior-event:${kind}`);
        const original = JSON.stringify(target);
        const applied = applyActionPreset(target, preset, { actor: 'hero' }, 2).draft;
        assert.equal(JSON.stringify(target), original);
        for (let frame = 0; frame <= 100; frame++) {
            const time = frame / 20;
            // A standalone preset intentionally releases the currently mounted
            // participant at its start; earlier reparent history must survive.
            const referenceTime = kind === 'reparent' ? Math.min(time, 2) : time;
            close(initialMotionMatrix(evaluateAuthoringDraft(applied, time).plan, 'hero'), initialMotionMatrix(evaluateAuthoringDraft(target, referenceTime).plan, 'hero'));
        }
        assert.deepEqual(applied.events.find(item => item.id === 'old-event'), target.events[0]);
    }
});

test('delayed action requiring a discontinuous starting arrangement rejects without changing accepted history', () => {
    const source = adoptSceneBuild(plan([box('actor'), box('prop', [1, 0, 0])]), 'transition:source');
    const preset = fitPresetDuration(extractActionNodePreset(source, { actor: 'actor', prop: 'prop' }, { title: 'Pair' }), 3);
    const target = adoptSceneBuild(plan([box('hero'), box('cup', [8, 0, 0])]), 'transition:target');
    const before = JSON.stringify(target);
    assert.throws(() => applyActionPreset(target, preset, { actor: 'hero', prop: 'cup' }, 2), /transition/);
    assert.equal(JSON.stringify(target), before);
});

test('delayed action root deltas compose before existing jump/roll effects, with no pre-start change or doubled boundary', () => {
    for (const kind of ['jump', 'roll']) for (const travel of [0, 2]) {
        const actor = box('actor'); actor.keys[1].position[2] = travel;
        const source = adoptSceneBuild(plan([actor]), 'active-move:source');
        const preset = fitPresetDuration(extractActionNodePreset(source, { actor: 'actor' }, { title: 'Stand or move' }), 3);
        const target = adoptSceneBuild({ ...plan([{ id: 'hero', recipe: 'humanoid', keys: keys([0, 0, 0], [0, .3, 0]), pivot: [.2, .1, 0] }]), performance: { commands: [{ kind: 'move', at: 1, move: { id: 'old-move', objectId: 'hero', kind, duration: 2 } }] } }, `active-move:${kind}`);
        const original = JSON.stringify(target);
        const applied = applyActionPreset(target, preset, { actor: 'hero' }, 2).draft;
        assert.equal(JSON.stringify(target), original);
        assert.deepEqual(applied.moves, target.moves);
        for (let frame = 0; frame <= (travel ? 40 : 100); frame++) {
            const time = frame / 20;
            close(initialMotionMatrix(evaluateAuthoringDraft(applied, time).plan, 'hero'), initialMotionMatrix(evaluateAuthoringDraft(target, time).plan, 'hero'));
        }
        const base = initialMotionTransform(evaluateAuthoringDraft(target, 5).plan, 'hero');
        const end = initialMotionTransform(evaluateAuthoringDraft(applied, 5).plan, 'hero');
        close(end.position, [base.position[0] + Math.sin(.3) * travel, base.position[1], base.position[2] + Math.cos(.3) * travel]);
    }
});

test('delayed part ownership preserves locomotion history and validates walking/wheel/rotor transitions', () => {
    for (const recipe of ['humanoid', 'vehicle', 'helicopter']) {
        const source = adoptSceneBuild(plan([{ id: 'actor', recipe, keys: keys() }]), 'scoped:source');
        const start = recipe === 'helicopter' ? Math.PI / 10 : 2;
        const duration = recipe === 'helicopter' ? 7 * Math.PI / 10 : 3;
        const preset = fitPresetDuration(extractActionNodePreset(source, { actor: 'actor' }, { title: 'Hold this pose' }), duration);
        let target = adoptSceneBuild(plan([{ id: 'hero', recipe, keys: keys() }]), `scoped:${recipe}`);
        const rig = target.rigs.hero;
        if (recipe !== 'helicopter') target.plan.objects[0].keys[1].position[2] = rig.strideLength * (recipe === 'vehicle' ? 2 * Math.PI : 1) * 5 / start;
        target = applyAuthoringCommands(target, target.revision, [{ kind: 'locomotion', objectId: 'hero', enabled: true }]);
        if (recipe === 'humanoid') target.manualControls.push(JSON.stringify(['hero', 'neck']));
        const before = JSON.stringify(target);
        const applied = applyActionPreset(target, preset, { actor: 'hero' }, start).draft;
        assert.equal(JSON.stringify(target), before);
        assert.deepEqual(applied.manualControls, target.manualControls);
        assert.deepEqual(applied.locomotion, target.locomotion);
        assert.ok(applied.masks.some(mask => mask.start === start && mask.end === start + duration));
        const restored = validateScenePerformance({ plan: applied.plan, authoring: JSON.parse(JSON.stringify(applied)) }).authoring;
        if (recipe === 'humanoid') {
            const crowded = structuredClone(target);
            crowded.masks = Array.from({ length: 511 }, () => ({ objectId: 'hero', start: 0, end: 0, channels: ['position'] }));
            const untouched = JSON.stringify(crowded);
            assert.throws(() => applyActionPreset(crowded, preset, { actor: 'hero' }, start), /limit exceeded/);
            assert.equal(JSON.stringify(crowded), untouched);
        }
        for (let frame = 0; frame <= 40; frame++) {
            const time = start * frame / 40;
            const originalFrame = evaluateAuthoringDraft(target, time).plan;
            for (const doc of [applied, restored]) {
                const nextFrame = evaluateAuthoringDraft(doc, time).plan;
                close(initialMotionMatrix(nextFrame, 'hero'), initialMotionMatrix(originalFrame, 'hero'));
                for (const part of originalFrame.objects[0].parts) close(initialMotionMatrix(nextFrame, 'hero', part.id), initialMotionMatrix(originalFrame, 'hero', part.id));
            }
        }
    }
    const source = adoptSceneBuild(plan([{ id: 'actor', recipe: 'humanoid', keys: keys() }]), 'walking:source');
    const preset = fitPresetDuration(extractActionNodePreset(source, { actor: 'actor' }, { title: 'Stand' }), 3);
    let moving = adoptSceneBuild(plan([{ id: 'hero', recipe: 'humanoid', keys: keys() }]), 'walking:target');
    moving.plan.objects[0].keys[1].position[2] = 5;
    moving = applyAuthoringCommands(moving, moving.revision, [{ kind: 'locomotion', objectId: 'hero', enabled: true }]);
    const before = JSON.stringify(moving);
    assert.throws(() => applyActionPreset(moving, preset, { actor: 'hero' }, 2), /transition/);
    assert.equal(JSON.stringify(moving), before);
    const walkingSource = applyAuthoringCommands(source, source.revision, [{ kind: 'locomotion', objectId: 'actor', enabled: true }]);
    const walkingPreset = fitPresetDuration(extractActionNodePreset(walkingSource, { actor: 'actor' }, { title: 'Start walking' }), 3);
    const still = adoptSceneBuild(plan([{ id: 'hero', recipe: 'humanoid', keys: keys() }]), 'walking:still');
    assert.throws(() => applyActionPreset(still, walkingPreset, { actor: 'hero' }, 2), /timed locomotion transition/);
    const step = structuredClone(moving); step.plan.objects[0].interpolation = 'step'; step.plan.objects[0].keys[1].position[2] = step.rigs.hero.strideLength * 2.5;
    assert.throws(() => applyActionPreset(step, preset, { actor: 'hero' }, 2), /locomotion phase/);
    const rotor = adoptSceneBuild(plan([{ id: 'hero', recipe: 'helicopter', keys: keys() }]), 'rotor:end');
    const spinning = applyAuthoringCommands(rotor, rotor.revision, [{ kind: 'locomotion', objectId: 'hero', enabled: true }]);
    const rotorSource = adoptSceneBuild(plan([{ id: 'actor', recipe: 'helicopter', keys: keys() }]), 'rotor:source');
    const rotorPreset = fitPresetDuration(extractActionNodePreset(rotorSource, { actor: 'actor' }, { title: 'Stop rotor' }), 3);
    assert.throws(() => applyActionPreset(spinning, rotorPreset, { actor: 'hero' }, Math.PI / 10), /transition/);
});

test('delayed initial held/riding graphs reject world-space jumps and accept compatible moving sockets', () => {
    for (const relation of ['holds', 'riding']) for (const alreadyAttached of [false, true]) {
        const parent = box('actor', [0, 0, 0], [0, .2, 0]); parent.parts = [box('socket', [.3, .8, 0], [0, .1, 0])];
        const child = { ...box('prop', [1, 0, 0], [0, .15, 0]), attachment: { objectId: 'actor', partId: 'socket' } };
        const source = adoptSceneBuild({ ...plan([parent, child]), initialState: { relationships: [relation === 'holds' ? { from: 'actor', to: 'prop', relation } : { from: 'prop', to: 'actor', relation }] } }, 'graph:source');
        const preset = fitPresetDuration(extractActionNodePreset(source, { actor: 'actor', prop: 'prop' }, { title: 'Held or riding' }), 3);
        const carrier = box('hero', [10, 0, 0], [0, .6, 0]); carrier.keys[1].position[0] = 15; carrier.parts = structuredClone(parent.parts);
        const temp = adoptSceneBuild(plan([carrier, { ...box('cup', [1, 0, 0], [0, .15, 0]), attachment: { objectId: 'hero', partId: 'socket' } }]), 'graph:template');
        const expected = initialMotionTransform(evaluateAuthoringDraft(temp, 2).plan, 'cup');
        const cup = alreadyAttached ? temp.plan.objects[1] : { ...box('cup'), keys: [0, 5].map(t => ({ ...structuredClone(expected), t })) };
        const target = adoptSceneBuild(plan([carrier, cup]), 'graph:target');
        const applied = applyActionPreset(target, preset, { actor: 'hero', prop: 'cup' }, 2).draft;
        for (let frame = 0; frame <= 40; frame++) {
            const time = frame / 20;
            close(initialMotionMatrix(evaluateAuthoringDraft(applied, time).plan, 'cup'), initialMotionMatrix(evaluateAuthoringDraft(target, time).plan, 'cup'));
        }
        const mismatched = adoptSceneBuild(plan([carrier, box('cup', [8, 0, 0])]), 'graph:mismatch');
        const before = JSON.stringify(mismatched);
        assert.throws(() => applyActionPreset(mismatched, preset, { actor: 'hero', prop: 'cup' }, 2), /transition/);
        assert.equal(JSON.stringify(mismatched), before);
        assert.doesNotThrow(() => applyActionPreset(mismatched, preset, { actor: 'hero', prop: 'cup' }, 0));
    }
    const source = adoptSceneBuild({ ...plan([box('actor'), box('prop', [8, 0, 0])]), performance: { events: [{ id: 'intentional-pickup', kind: 'attach', time: 0, objectId: 'prop', parent: { objectId: 'actor' }, relation: 'holds', localPose: keys([1, 0, 0])[0] }] } }, 'pickup:source');
    const preset = fitPresetDuration(extractActionNodePreset(source, { actor: 'actor', prop: 'prop' }, { title: 'Explicit pickup' }), 3);
    const target = adoptSceneBuild(plan([box('hero'), box('cup', [8, 0, 0])]), 'pickup:target');
    const result = applyActionPreset(target, preset, { actor: 'hero', prop: 'cup' }, 2).draft;
    close(initialMotionTransform(evaluateAuthoringDraft(result, 1.99).plan, 'cup').position, [8, 0, 0]);
    close(initialMotionTransform(evaluateAuthoringDraft(result, 2).plan, 'cup').position, [1, 0, 0]);
});

test('action presets replay their own procedural walking/wheels/rotor and precise source ownership', () => {
    for (const recipe of ['humanoid', 'vehicle', 'helicopter']) for (const overrides of [false, true]) {
        let source = adoptSceneBuild(plan([{ id: 'actor', recipe, keys: keys() }]), `replay:${recipe}`);
        if (recipe !== 'helicopter') source.plan.objects[0].keys[1].position[2] = 5;
        source = applyAuthoringCommands(source, source.revision, [{ kind: 'locomotion', objectId: 'actor', enabled: true }]);
        const primary = recipe === 'humanoid' ? 'left_hip' : recipe === 'vehicle' ? 'wheel_left_front' : 'rotor';
        const secondary = recipe === 'humanoid' ? 'right_hip' : recipe === 'vehicle' ? 'wheel_right_front' : 'rotor';
        if (overrides) {
            if (recipe !== 'helicopter') {
                const part = source.plan.objects[0].parts.find(part => part.id === primary);
                source = applyAuthoringCommands(source, source.revision, part.keys.map(key => ({ kind: 'pose', target: { objectId: 'actor', partId: primary }, time: key.t, pose: { ...structuredClone(key), rotation: [.4, 0, 0] } })));
            }
            source = applyAuthoringCommands(source, source.revision, [{ kind: 'mask', mask: { target: { objectId: 'actor', partId: secondary }, start: 1, end: 2, channels: ['rotation'] } }]);
        }
        const preset = JSON.parse(JSON.stringify(extractActionNodePreset(source, { actor: 'actor' }, { title: 'Procedural action' })));
        const target = adoptSceneBuild(plan([{ id: 'hero', recipe, keys: keys() }]), 'replay:target');
        const applied = applyActionPreset(target, preset, { actor: 'hero' }).draft;
        const restored = restoreAuthoringDraft(JSON.stringify(applied));
        for (const time of [.5, 1, 1.5, 2.5, 4]) {
            const original = evaluateAuthoringDraft(source, time).plan;
            for (const doc of [applied, restored]) {
                const actual = evaluateAuthoringDraft(doc, time).plan;
                close(initialMotionMatrix(actual, 'hero'), initialMotionMatrix(original, 'actor'));
                for (const part of original.objects[0].parts) close(initialMotionMatrix(actual, 'hero', part.id), initialMotionMatrix(original, 'actor', part.id));
            }
        }
        if (!overrides) {
            const legacy = structuredClone(preset); delete legacy.ownershipByRole;
            const old = applyActionPreset(target, legacy, { actor: 'hero' }).draft;
            assert.ok(Math.abs(evaluateAuthoringDraft(old, 1).plan.objects[0].parts.find(part => part.id === primary).keys[0].rotation[recipe === 'helicopter' ? 1 : 0]) > .01);
        }
    }
    for (const recipe of ['humanoid', 'vehicle', 'helicopter']) {
        let source = adoptSceneBuild(plan([{ id: 'actor', recipe, keys: keys() }]), 'delayed-proc:source');
        const travel = recipe === 'vehicle' ? source.rigs.actor.strideLength * Math.PI * 2 : recipe === 'humanoid' ? source.rigs.actor.strideLength : 0;
        source.plan.objects[0].keys[1].position[2] = travel;
        source = applyAuthoringCommands(source, source.revision, [{ kind: 'locomotion', objectId: 'actor', enabled: true }]);
        const preset = fitPresetDuration(extractActionNodePreset(source, { actor: 'actor' }, { title: 'Keep moving' }), 3);
        let target = adoptSceneBuild(plan([{ id: 'hero', recipe, keys: keys() }]), 'delayed-proc:target');
        target.plan.objects[0].keys[1].position[2] = travel * 5 / 2;
        target = applyAuthoringCommands(target, target.revision, [{ kind: 'locomotion', objectId: 'hero', enabled: true }]);
        const applied = applyActionPreset(target, preset, { actor: 'hero' }, 2).draft;
        const clean = { ...applied, masks: target.masks, manualControls: target.manualControls };
        const control = recipe === 'humanoid' ? 'left_hip' : recipe === 'vehicle' ? 'wheel_left_front' : 'rotor';
        for (const time of [2.75, 4.25]) {
            const actual = evaluateAuthoringDraft(applied, time).plan.objects[0].parts.find(part => part.id === control).keys[0];
            const expected = evaluateAuthoringDraft(clean, time).plan.objects[0].parts.find(part => part.id === control).keys[0];
            close(actual.rotation, expected.rotation);
            assert.ok(Math.abs(actual.rotation[recipe === 'helicopter' ? 1 : 0]) > .01);
        }
        for (let frame = 0; frame <= 40; frame++) {
            const time = frame / 20, before = evaluateAuthoringDraft(target, time).plan, after = evaluateAuthoringDraft(applied, time).plan;
            for (const part of before.objects[0].parts) close(initialMotionMatrix(after, 'hero', part.id), initialMotionMatrix(before, 'hero', part.id));
        }
    }
    let source = adoptSceneBuild(plan([{ id: 'actor', recipe: 'humanoid', keys: keys() }]), 'owned-delay:source');
    source.plan.objects[0].keys[1].position[2] = source.rigs.actor.strideLength;
    const hip = source.plan.objects[0].parts.find(part => part.id === 'left_hip');
    source = applyAuthoringCommands(source, source.revision, [
        { kind: 'locomotion', objectId: 'actor', enabled: true },
        ...hip.keys.map(key => ({ kind: 'pose', target: { objectId: 'actor', partId: 'left_hip' }, time: key.t, pose: { ...key, rotation: [.4, 0, 0] } })),
        { kind: 'mask', mask: { target: { objectId: 'actor', partId: 'right_hip' }, start: 1, end: 2, channels: ['rotation'] } },
    ]);
    const preset = fitPresetDuration(extractActionNodePreset(source, { actor: 'actor' }, { title: 'Asymmetric walk' }), 3);
    close([preset.ownershipByRole.actor.masks[0].start, preset.ownershipByRole.actor.masks[0].end], [.6, 1.2]);
    let target = adoptSceneBuild(plan([{ id: 'hero', recipe: 'humanoid', keys: keys() }]), 'owned-delay:target');
    target.plan.objects[0].keys[1].position[2] = target.rigs.hero.strideLength * 2.5;
    target.plan.objects[0].parts.find(part => part.id === 'left_hip').keys.forEach(key => key.rotation[0] = .4);
    target = applyAuthoringCommands(target, target.revision, [{ kind: 'locomotion', objectId: 'hero', enabled: true }]);
    const applied = applyActionPreset(target, preset, { actor: 'hero' }, 2).draft;
    assert.deepEqual(applied.manualControls, []);
    assert.ok(applied.masks.some(mask => mask.partId === 'left_hip' && mask.start === 2 && mask.end === 5));
    assert.ok(applied.masks.some(mask => mask.partId === 'right_hip' && Math.abs(mask.start - 2.6) < 1e-6 && Math.abs(mask.end - 3.2) < 1e-6));
    for (const time of [.5, 1, 1.5, 1.99, 2]) close(initialMotionMatrix(evaluateAuthoringDraft(applied, time).plan, 'hero', 'left_hip'), initialMotionMatrix(evaluateAuthoringDraft(target, time).plan, 'hero', 'left_hip'));
    assert.equal(evaluateAuthoringDraft(applied, 2.8).plan.objects[0].parts.find(part => part.id === 'left_hip').keys[0].rotation[0], .4);
    assert.equal(evaluateAuthoringDraft(applied, 2.8).plan.objects[0].parts.find(part => part.id === 'right_hip').keys[0].rotation[0], 0);
    const creator = structuredClone(target); creator.manualControls.push(JSON.stringify(['hero', 'right_hip']));
    creator.masks.push({ objectId: 'hero', partId: 'left_shoulder', start: 0, end: 5, channels: ['rotation'] });
    const kept = applyActionPreset(creator, preset, { actor: 'hero' }, 2).draft;
    assert.ok(kept.manualControls.includes(JSON.stringify(['hero', 'right_hip'])));
    assert.ok(kept.masks.some(mask => mask.partId === 'left_shoulder' && mask.start === 0 && mask.end === 5));
});

test('single-entity motion presets replay procedural parts, source ownership and relative rest-pose deltas', () => {
    for (const recipe of ['humanoid', 'vehicle', 'helicopter']) for (const overrides of [false, true]) {
        let source = adoptSceneBuild(plan([{ id: 'actor', recipe, keys: keys() }]), 'motion-replay:source');
        if (recipe !== 'helicopter') source.plan.objects[0].keys[1].position[2] = 5;
        source = applyAuthoringCommands(source, source.revision, [{ kind: 'locomotion', objectId: 'actor', enabled: true }]);
        const full = recipe === 'humanoid' ? 'left_hip' : recipe === 'vehicle' ? 'wheel_left_front' : undefined;
        const masked = recipe === 'humanoid' ? 'right_hip' : recipe === 'vehicle' ? 'wheel_right_front' : 'rotor';
        if (overrides) {
            const commands = [{ kind: 'mask', mask: { target: { objectId: 'actor', partId: masked }, start: 1, end: 2, channels: ['rotation'] } }];
            if (full) { const part = source.plan.objects[0].parts.find(part => part.id === full); commands.push({ kind: 'pose', target: { objectId: 'actor', partId: full }, time: 5, pose: { ...structuredClone(part.keys[1]), rotation: [.4, 0, 0] } }); }
            source = applyAuthoringCommands(source, source.revision, commands);
        }
        const preset = JSON.parse(JSON.stringify(extractMotionNodePreset(source, 'actor', { title: 'Procedural motion' })));
        const target = adoptSceneBuild(plan([{ id: 'hero', recipe, keys: keys() }]), 'motion-replay:target');
        const before = JSON.stringify(target), next = applyMotionPreset(target, preset, 'hero').draft;
        assert.equal(JSON.stringify(target), before);
        for (const doc of [next, restoreAuthoringDraft(JSON.stringify(next))]) for (const time of [.5, 1, 1.5, 2.5, 4]) {
            const a = evaluateAuthoringDraft(source, time).plan, b = evaluateAuthoringDraft(doc, time).plan;
            for (const part of a.objects[0].parts) close(initialMotionMatrix(b, 'hero', part.id), initialMotionMatrix(a, 'actor', part.id));
        }
        if (!overrides) {
            const legacy = structuredClone(preset); delete legacy.manualControls;
            const old = applyMotionPreset(target, legacy, 'hero').draft;
            const control = full || 'rotor', axis = recipe === 'helicopter' ? 1 : 0;
            assert.ok(Math.abs(evaluateAuthoringDraft(old, 1).plan.objects[0].parts.find(part => part.id === control).keys[0].rotation[axis]) > .01);
            const protectedTarget = structuredClone(target);
            protectedTarget.manualControls.push(JSON.stringify(['hero', control]));
            protectedTarget.masks.push({ objectId: 'hero', partId: masked, start: 1, end: 2, channels: ['rotation'] });
            const kept = applyMotionPreset(protectedTarget, preset, 'hero').draft;
            assert.ok(kept.manualControls.includes(JSON.stringify(['hero', control])));
            assert.ok(kept.masks.some(mask => mask.partId === masked && mask.start === 1 && mask.end === 2));
        }
    }
    for (const recipe of ['humanoid', 'vehicle', 'helicopter']) {
        let source = adoptSceneBuild(plan([{ id: 'actor', recipe, keys: keys() }]), 'motion-delay:source');
        const distance = recipe === 'humanoid' ? source.rigs.actor.strideLength : recipe === 'vehicle' ? source.rigs.actor.strideLength * Math.PI * 2 : 0;
        source.plan.objects[0].keys[1].position[2] = distance;
        source = applyAuthoringCommands(source, source.revision, [{ kind: 'locomotion', objectId: 'actor', enabled: true }]);
        const preset = fitPresetDuration(extractMotionNodePreset(source, 'actor', { title: 'Continue motion' }), 3);
        let target = adoptSceneBuild(plan([{ id: 'hero', recipe, keys: keys() }]), 'motion-delay:target');
        target.plan.objects[0].keys[1].position[2] = distance * 2.5;
        target = applyAuthoringCommands(target, target.revision, [{ kind: 'locomotion', objectId: 'hero', enabled: true }]);
        const next = applyMotionPreset(target, preset, 'hero', 2).draft;
        for (let frame = 0; frame <= 40; frame++) {
            const time = frame / 20, a = evaluateAuthoringDraft(target, time).plan, b = evaluateAuthoringDraft(next, time).plan;
            for (const part of a.objects[0].parts) close(initialMotionMatrix(b, 'hero', part.id), initialMotionMatrix(a, 'hero', part.id));
        }
        const control = recipe === 'humanoid' ? 'left_hip' : recipe === 'vehicle' ? 'wheel_left_front' : 'rotor';
        for (const time of [2.75, 4.25]) assert.ok(Math.abs(evaluateAuthoringDraft(next, time).plan.objects[0].parts.find(part => part.id === control).keys[0].rotation[recipe === 'helicopter' ? 1 : 0]) > .01);
    }
    let source = adoptSceneBuild(plan([{ id: 'actor', recipe: 'humanoid', keys: keys() }]), 'rest:source');
    source.plan.objects[0].keys[1].position[0] = 2;
    const wrist = source.plan.objects[0].parts.find(part => part.id === 'right_wrist');
    wrist.keys[1].position[0] += .2; wrist.keys[1].rotation[1] += .3;
    const motion = extractMotionNodePreset(source, 'actor', { title: 'Relative gesture' });
    const target = adoptSceneBuild(plan([{ id: 'hero', recipe: 'humanoid', height: 2.7, keys: keys() }]), 'rest:target');
    const rest = target.plan.objects[0].parts.find(part => part.id === 'right_wrist'); rest.keys.forEach(key => key.rotation[2] = .25);
    const expected = structuredClone(rest.keys[0]), ratio = target.rigs.hero.hipHeight / motion.referenceHipHeight;
    const result = applyMotionPreset(target, motion, 'hero').draft;
    const actual = evaluateAuthoringDraft(result, 5).plan.objects[0].parts.find(part => part.id === 'right_wrist').keys[0];
    close(actual.position, [expected.position[0] + .2 * ratio, expected.position[1], expected.position[2]]);
    close(actual.rotation, [expected.rotation[0], expected.rotation[1] + .3, .25]);
    assert.equal(result.plan.objects[0].keys.at(-1).position[0], 2 * ratio);
    assert.throws(() => applyMotionPreset(target, motion, 'hero', 2), /full motion must fit/);
});
