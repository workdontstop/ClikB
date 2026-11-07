import type { MotionObject, MotionPart, MotionPlan, MotionVec3 } from './motionGuidePlan';
import { createAuthoringDraft, prototypeUnitPose, type AuthoringCommand, type RigBinding, type SceneAuthoringDraft } from './sceneAuthoring';
import { newWorldState } from './spatialWorld';
import { bipedPosture, type BipedPosture } from './scenePosture';

const duration = 5;
const part = (id: string, shape: MotionPart['shape'], position: MotionVec3, scale: MotionVec3, parentId?: string, rotation: MotionVec3 = [0, 0, 0]): MotionPart => ({
    id, shape, color: '#eff5fc', ...(parentId ? { parentId } : {}),
    keys: [0, duration].map(t => ({ t, position: [...position], rotation: [...rotation], scale: [...scale] })),
});
const anchor = (id: string, position: MotionVec3, parentId?: string) => part(id, 'anchor', position, [1, 1, 1], parentId);
const root = (id: string, position: MotionVec3, color: string, parts: MotionPart[]): MotionObject => ({
    ...part(id, 'box', position, [1, 1, 1]), role: 'actor', subjectColor: color, parts,
});

export function humanoidRecipe(id: string, position: MotionVec3, color = '#bd5c65', height = 1.75, initialPosture: BipedPosture = 'standing'): { object: MotionObject; rig: RigBinding } {
    if (!Number.isFinite(height) || height < .1 || height > 20) throw new Error('Choose a finite supported mannequin height.');
    const s = height / 1.75;
    const posture = bipedPosture(initialPosture);
    const parts: MotionPart[] = [
        anchor('pelvis', [0, .91, 0]),
        part('pelvis_mass', 'capsule', [0, 0, 0], [.38, .25, .24], 'pelvis', [0, 0, Math.PI / 2]),
        anchor('chest', [0, .28, 0], 'pelvis'),
        part('torso', 'capsule', [0, 0, 0], [.46, .52, .26], 'chest'),
        anchor('neck', [0, .29, 0], 'chest'),
        part('head', 'sphere', [0, .12, 0], [.28, .34, .27], 'neck'),
    ];
    for (const [side, x] of [['left', -.18], ['right', .18]] as const) {
        parts.push(
            anchor(`${side}_hip`, [x, 0, 0], 'pelvis'),
            part(`${side}_upper_leg`, 'capsule', [0, -.215, 0], [.18, .43, .18], `${side}_hip`),
            anchor(`${side}_knee`, [0, -.43, 0], `${side}_hip`),
            part(`${side}_lower_leg`, 'capsule', [0, -.215, 0], [.15, .43, .15], `${side}_knee`),
            anchor(`${side}_ankle`, [0, -.43, 0], `${side}_knee`),
            part(`${side}_foot`, 'box', [0, -.01, .08], [.17, .1, .3], `${side}_ankle`),
            anchor(`${side}_shoulder`, [x * 1.5, .17, 0], 'chest'),
            part(`${side}_upper_arm`, 'capsule', [0, -.15, 0], [.14, .3, .14], `${side}_shoulder`),
            anchor(`${side}_elbow`, [0, -.3, 0], `${side}_shoulder`),
            part(`${side}_forearm`, 'capsule', [0, -.14, 0], [.12, .28, .12], `${side}_elbow`),
            anchor(`${side}_wrist`, [0, -.28, 0], `${side}_elbow`),
            part(`${side}_hand`, 'sphere', [0, -.04, 0], [.12, .16, .11], `${side}_wrist`),
        );
    }
    for (const p of parts) {
        for (const key of p.keys) {
            key.position = key.position.map(n => n * s) as MotionVec3;
            if (p.id === 'pelvis') key.position[1] = posture.pelvisHeight * s;
            if (Object.prototype.hasOwnProperty.call(posture.rotations, p.id)) key.rotation[0] = posture.rotations[p.id];
            if (p.shape !== 'anchor') key.scale = key.scale.map(n => n * s) as MotionVec3;
        }
    }
    const controls = Object.fromEntries(parts.filter(p => p.shape === 'anchor').map(p => [p.id, p.id]));
    return {
        object: root(id, position, color, parts),
        rig: { kind: 'biped', controls, strideLength: 1.3 * s, legLengths: [.43 * s, .43 * s], hipHeight: .91 * s, halfHipWidth: .18 * s },
    };
}

export function creatureRecipe(id: string, position: MotionVec3, color: string, size = 1, wings = false): { object: MotionObject; rig: RigBinding } {
    if (!Number.isFinite(size) || size < .1 || size > 20) throw new Error('Choose a finite supported creature size.');
    const parts: MotionPart[] = [
        part('body', 'capsule', [0, 1.05, 0], [1.05, 2.3, 1], '', [Math.PI / 2, 0, 0]),
        part('neck', 'capsule', [0, 1.45, .9], [.55, 1, .55], undefined, [-.4, 0, 0]),
        part('head', 'box', [0, 1.9, 1.12], [.65, .5, .85]),
        part('snout', 'box', [0, 1.8, 1.57], [.52, .32, .55]),
        part('tail', 'tube', [0, 1, -1], [1, 1, 1]),
    ];
    parts[4].geometry = { path: [[0, 0, 0], [0, -.1, -.8], [.15, .2, -1.6]], radius: .18 };
    const controls: Record<string, string> = {};
    for (const [name, x, z] of [['left', -.4, -.65], ['right', .4, -.65], ['front_left', -.4, .65], ['front_right', .4, .65]] as const) {
        const hipId = `${name}_hip`;
        controls[hipId] = hipId;
        parts.push(
            anchor(hipId, [x, 1, z]),
            part(`${name}_leg`, 'capsule', [0, -.42, 0], [.25, .85, .25], hipId),
            part(`${name}_foot`, 'box', [0, -.83, .13], [.3, .15, .45], hipId),
        );
    }
    parts.push(anchor('saddle', [0, 1.65, -.1]), part('saddle_mass', 'box', [0, 0, 0], [.65, .12, .6], 'saddle'));
    controls.saddle = 'saddle';
    if (wings) {
        for (const [side, x] of [['left', -1], ['right', 1]] as const) {
            const wingId = `${side}_wing`;
            controls[wingId] = wingId;
            parts.push(
                anchor(wingId, [x * .4, 1.5, 0]),
                { ...part(`${side}_wing_mass`, 'extrude', [0, 0, 0], [2.2, 1, 1], wingId, [-Math.PI / 2, 0, 0]), geometry: { outline: [[0, 0], [x, 1], [x * .82, -.15], [x * .32, -.35]], depth: .05 } },
            );
        }
    }
    for (const p of parts) {
        for (const k of p.keys) {
            k.position = k.position.map(n => n * size) as MotionVec3;
            if (p.shape !== 'anchor') k.scale = k.scale.map(n => n * size) as MotionVec3;
        }
    }
    return { object: root(id, position, color, parts), rig: { kind: 'quadruped', controls, strideLength: 2.4 * size } };
}

export function vehicleRecipe(id: string, position: MotionVec3, color: string, helicopter = false): { object: MotionObject; rig: RigBinding } {
    const parts: MotionPart[] = [], controls: Record<string, string> = {};
    if (helicopter) {
        parts.push(
            part('fuselage', 'capsule', [0, 1.2, 0], [1.2, 2.5, 1.1], undefined, [Math.PI / 2, 0, 0]),
            part('tail', 'cone', [0, 1.35, -1.8], [.3, 2.2, .3], undefined, [-Math.PI / 2, 0, 0]),
            part('cockpit', 'sphere', [0, 1.25, 1], [1.05, .8, .8]),
            anchor('rotor', [0, 2, 0]),
            part('rotor_blade_a', 'box', [0, 0, 0], [4.7, .05, .15], 'rotor'),
            part('rotor_blade_b', 'box', [0, 0, 0], [.15, .05, 4.7], 'rotor'),
        );
        for (const x of [-.6, .6]) parts.push(part(`skid_${x < 0 ? 'left' : 'right'}`, 'box', [x, .3, 0], [.1, .12, 2.7]));
        controls.rotor = 'rotor';
    } else {
        parts.push(
            { ...part('body', 'extrude', [0, .65, 0], [1, 1, 1], undefined, [0, Math.PI / 2, 0]), geometry: { outline: [[-2, -.25], [-2, .05], [-1.2, .15], [-.65, .72], [.85, .72], [1.35, .15], [2, .02], [2, -.25]], depth: 1.65 } },
            part('hood', 'box', [0, .72, 1.4], [1.55, .12, 1]),
            part('nose', 'box', [0, .57, 1.98], [1.55, .16, .1]),
        );
        for (const [side, x] of [['left', -.84], ['right', .84]] as const) {
            for (const [end, z] of [['front', 1.2], ['rear', -1.2]] as const) {
                const name = `wheel_${side}_${end}`;
                controls[name] = name;
                parts.push(anchor(name, [x, .38, z]), part(`${name}_tire`, 'cylinder', [0, 0, 0], [.7, .22, .7], name, [0, 0, Math.PI / 2]));
            }
        }
    }
    return { object: root(id, position, color, parts), rig: { kind: helicopter ? 'rotor' : 'wheeled', controls, strideLength: .35 } };
}

export function bikeRecipe(id: string, position: MotionVec3, color = '#4d80c2'): { object: MotionObject; rig: RigBinding } {
    const parts: MotionPart[] = [
        part('frame', 'capsule', [0, .62, 0], [.22, 1.35, .28], undefined, [Math.PI / 2, 0, 0]),
        anchor('saddle', [0, .86, -.22]),
        part('seat_pad', 'box', [0, 0, 0], [.24, .1, .42], 'saddle'),
        anchor('handlebar', [0, .96, .52]),
        part('handlebar_bar', 'cylinder', [0, 0, 0], [.06, .68, .06], 'handlebar', [0, 0, Math.PI / 2]),
    ];
    const controls: Record<string, string> = { saddle: 'saddle', handlebar: 'handlebar' };
    for (const [end, z] of [['front', .68], ['rear', -.68]] as const) {
        const name = `wheel_center_${end}`;
        controls[name] = name;
        parts.push(anchor(name, [0, .34, z]), part(`${name}_tire`, 'cylinder', [0, 0, 0], [.64, .16, .64], name, [0, 0, Math.PI / 2]));
    }
    return { object: root(id, position, color, parts), rig: { kind: 'wheeled', controls, strideLength: .34 } };
}

/** Infer capability-aware RigBindings for any MotionPlan objects that do not already declare one. */
export function bindWorldRigs(plan: MotionPlan, existing: Record<string, RigBinding> = {}): Record<string, RigBinding> {
    const rigs: Record<string, RigBinding> = { ...existing };
    for (const object of plan.objects) {
        if (rigs[object.id] || object.surface === 'ground' || object.id === 'ground' || object.role === 'scenery') continue;
        const parts = object.parts || [];
        const partIds = new Set(parts.map(p => p.id));
        const controls = Object.fromEntries(parts.map(p => [p.id, p.id]));
        if (partIds.has('left_hip') && partIds.has('right_hip') && (partIds.has('front_left_hip') || partIds.has('front_right_hip'))) {
            rigs[object.id] = { kind: 'quadruped', controls, strideLength: 2.2 };
        } else if (partIds.has('left_hip') && partIds.has('right_hip')) {
            const hip = parts.find(p => p.id === 'left_hip');
            const knee = parts.find(p => p.id === 'left_knee');
            const ankle = parts.find(p => p.id === 'left_ankle');
            const upper = knee ? Math.hypot(...knee.keys[0].position) || .43 : .43;
            const lower = ankle ? Math.hypot(...ankle.keys[0].position) || .43 : .43;
            // Anatomical size comes from bone lengths, never the current pelvis
            // height: kneeling/seated poses must not shrink the rig on adoption.
            const hipHeight = (upper + lower) / .86 * .91;
            const halfHipWidth = Math.abs(hip?.keys[0]?.position[0] || .18);
            rigs[object.id] = { kind: 'biped', controls, strideLength: 1.3 * (hipHeight / .91), legLengths: [upper, lower], hipHeight, halfHipWidth };
        } else if (parts.some(p => p.id.startsWith('wheel_'))) {
            rigs[object.id] = { kind: 'wheeled', controls, strideLength: .35 };
        } else if (partIds.has('rotor')) {
            rigs[object.id] = { kind: 'rotor', controls, strideLength: .35 };
        } else if (object.role === 'actor') {
            rigs[object.id] = { kind: 'biped', controls, strideLength: 1.3 };
        }
    }
    return rigs;
}

export function makeSceneAuthoringFixture(kind: 'state' | 'creatures' | 'vehicles' = 'state'): SceneAuthoringDraft {
    const ground: MotionObject = { ...part('ground', 'box', [0, -.12, 0], [24, .2, 24]), surface: 'ground', role: 'scenery' };
    const rigs: Record<string, RigBinding> = {}, objects: MotionObject[] = [ground];
    const add = (value: { object: MotionObject; rig: RigBinding }) => { objects.push(value.object); rigs[value.object.id] = value.rig; };
    if (kind === 'state') {
        add(humanoidRecipe('actor', [-1.2, 0, .2], '#c65b65'));
        add(creatureRecipe('mount', [3, 0, -1.5], '#668eac', .8));
        const sword: MotionObject = {
            ...part('sword', 'box', [0, -.06, 0], [1, 1, 1]),
            role: 'prop',
            attachment: { objectId: 'actor', partId: 'right_wrist' },
            parts: [
                part('blade', 'box', [0, -.43, 0], [.07, .68, .035]),
                part('guard', 'box', [0, -.08, 0], [.28, .055, .08]),
                part('handle', 'cylinder', [0, .02, 0], [.06, .18, .06]),
            ],
        };
        objects.push(sword);
    } else if (kind === 'creatures') {
        add(creatureRecipe('red_dragon', [-3, 0, 0], '#c85161', 1.1, true));
        add(creatureRecipe('blue_dragon', [3, 0, -2], '#4d80c2', 1.35, true));
    } else {
        add(vehicleRecipe('car', [-2, 0, 1], '#4d80c2'));
        add(vehicleRecipe('helicopter', [3, .1, -2], '#bf6863', true));
    }
    const plan: MotionPlan = {
        version: 1,
        duration,
        background: '#edf5fc',
        objects,
        camera: [0, duration].map(t => ({
            t,
            position: kind === 'state' ? [6, 4.4, 7.5] : [8, 6.3, 10],
            target: kind === 'state' ? [.7, .9, 0] : [0, 1, 0],
            fov: 43,
            roll: 0,
        })),
    };
    const source = newWorldState(plan);
    source.controlledObject = Object.keys(rigs)[0];
    source.controlMode = kind === 'vehicles' ? 'vehicle' : 'character';
    if (kind === 'state') source.relationships.push({ from: 'actor', to: 'sword', relation: 'holds' });
    return createAuthoringDraft(plan, `local-fixture:${kind}`, rigs, source);
}

/** Two-bone sagittal IK for the mannequin recipe, with an explicit reachable target. */
export function legTargetCommands(draft: SceneAuthoringDraft, objectId: string, side: 'left' | 'right', time: number, target: MotionVec3, follow = false): AuthoringCommand[] {
    const rig = draft.rigs[objectId];
    if (!rig?.legLengths) throw new Error('This prototype IK requires a bound two-bone leg.');
    const [upper, lower] = rig.legLengths, hipY = rig.hipHeight!;
    if (!target.every(Number.isFinite)) throw new Error('Leg target must be finite.');
    // The current two-bone recipe projects X onto its hip plane. Lateral
    // pointer drift is valid input; abduction is a separate solver capability.
    const y = target[1] - hipY, z = target[2], raw = Math.hypot(y, z);
    const length = Math.min(upper + lower - .0001, Math.max(Math.abs(upper - lower) + .0001, raw));
    const knee = Math.acos(Math.max(-1, Math.min(1, (length * length - upper * upper - lower * lower) / (2 * upper * lower))));
    const hip = Math.atan2(-z, -y) - Math.atan2(lower * Math.sin(knee), upper + lower * Math.cos(knee));
    const commands: AuthoringCommand[] = [];
    const set = (control: string, angle: number) => {
        const id = rig.controls[control];
        if (!id) return;
        const p = draft.plan.objects.find(o => o.id === objectId)!.parts!.find(p => p.id === id)!;
        const existingRot = p.keys[0]?.rotation || [0, 0, 0];
        const pose = { ...prototypeUnitPose(), ...p.keys[0], rotation: [angle, existingRot[1], existingRot[2]] as MotionVec3 };
        commands.push({ kind: 'pose', target: { objectId, partId: id }, time, pose });
    };
    set(`${side}_hip`, hip);
    set(`${side}_knee`, knee);
    set(`${side}_ankle`, -hip - knee);
    if (follow) {
        const other = side === 'left' ? 'right' : 'left';
        set(`${other}_hip`, -hip * .5);
        set(`${side}_shoulder`, -hip * .35);
        set(`${other}_shoulder`, hip * .35);
    }
    return commands;
}

/** Two-bone arm IK for reaching/gesturing while preserving unrelated pose channels. */
export function armTargetCommands(draft: SceneAuthoringDraft, objectId: string, side: 'left' | 'right', time: number, target: MotionVec3): AuthoringCommand[] {
    const rig = draft.rigs[objectId];
    if (!rig || rig.kind !== 'biped') throw new Error('Arm IK requires a biped rig.');
    if (!target.every(Number.isFinite)) throw new Error('Arm target must be finite.');
    const scale = (rig.hipHeight || .91) / .91;
    const upper = .3 * scale, lower = .28 * scale;
    const shoulderY = 1.36 * scale;
    const y = target[1] - shoulderY, z = target[2], raw = Math.hypot(y, z);
    const length = Math.min(upper + lower - .0001, Math.max(Math.abs(upper - lower) + .0001, raw));
    const elbow = -Math.acos(Math.max(-1, Math.min(1, (length * length - upper * upper - lower * lower) / (2 * upper * lower))));
    const shoulder = Math.atan2(-z, -y) - Math.atan2(lower * Math.sin(elbow), upper + lower * Math.cos(elbow));
    const commands: AuthoringCommand[] = [];
    const set = (control: string, pitch: number) => {
        const id = rig.controls[control];
        if (!id) return;
        const p = draft.plan.objects.find(o => o.id === objectId)?.parts?.find(p => p.id === id);
        if (!p) return;
        const existingRot = p.keys[0]?.rotation || [0, 0, 0];
        const pose = { ...prototypeUnitPose(), ...p.keys[0], rotation: [pitch, existingRot[1], existingRot[2]] as MotionVec3 };
        commands.push({ kind: 'pose', target: { objectId, partId: id }, time, pose });
    };
    set(`${side}_shoulder`, shoulder);
    set(`${side}_elbow`, elbow);
    return commands;
}
