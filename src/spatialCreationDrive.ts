import type { MotionKey, MotionVec3 } from '../server/src/motionGuidePlan';
import type { SpatialWorld, WorldState } from '../server/src/spatialWorld';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';

export type CreationRotationMode = 'horizontal' | 'vertical' | 'roll' | null;

export const CREATION_STICK_DEAD_ZONE = .06;
type Drive = { x: number; y: number; active: boolean };
export function creationLocomotion(world: SpatialWorld) {
    if (world.locomotion) return world.locomotion;
    // Existing saved worlds retain their successful walking/vehicle defaults.
    const kind = /fly|flight|flying|hover/i.test(world.motionStyle) ? 'air' : /swim|underwater/i.test(world.motionStyle) ? 'water' : world.controlMode === 'vehicle' ? 'vehicle' : 'ground';
    return { kind, vertical: kind === 'air' || kind === 'water', speed: world.controlMode === 'vehicle' || world.controlMode === 'mounted' ? 1.2 : .65, turnRate: 3 };
}

function cameraForward(camera: WorldState['camera']): [number, number] | undefined {
    const x = camera.target[0] - camera.position[0], z = camera.target[2] - camera.position[2];
    const length = Math.hypot(x, z);
    return length > .0001 ? [x / length, z / length] : undefined;
}

/** Primitive proxies have no standard forward axis. Prefer their own front/body
 * landmarks, including nested/pivoted parts; old unlabelled solids retain the
 * authored camera frame. This is a control frame only, never saved geometry. */
export function creationOrientationAxes(world: SpatialWorld, state: WorldState): { forward: MotionVec3; right: MotionVec3 } {
    const object = state.objects[world.controlledObject];
    const original = world.plan.objects.find(candidate => candidate.id === world.controlledObject);
    const parts = object.geometry?.parts || original?.parts || [];
    const matrices = new Map<string, Matrix4>();
    const matrix = (id: string): Matrix4 => {
        if (matrices.has(id)) return matrices.get(id)!;
        const part = parts.find(candidate => candidate.id === id)!;
        const key = object.parts?.[id] || original?.parts?.find(candidate => candidate.id === id)?.keys[0];
        const result = new Matrix4(); matrices.set(id, result);
        if (!key) return result;
        result.compose(new Vector3(...key.position), new Quaternion().setFromEuler(new Euler(...key.rotation)), new Vector3(...key.scale));
        if (part.pivot) result.premultiply(new Matrix4().makeTranslation(...part.pivot)).multiply(new Matrix4().makeTranslation(...part.pivot.map(value => -value) as MotionVec3));
        if (part.parentId && parts.some(candidate => candidate.id === part.parentId)) result.premultiply(matrix(part.parentId));
        return result;
    };
    const landmarks = parts.map(part => ({
        words: part.id.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/),
        position: new Vector3().setFromMatrixPosition(matrix(part.id)),
    })).filter(part => !part.words.some(word => ['rider', 'driver', 'passenger'].includes(word)));
    const score = (words: string[], groups: string[][]) => groups.reduce((best, group, index) => words.some(word => group.includes(word)) ? Math.max(best, groups.length - index) : best, 0);
    const body = landmarks.map(part => ({ ...part, score: score(part.words, [['body', 'chassis', 'fuselage', 'hull'], ['torso']]) }))
        .sort((a, b) => b.score - a.score).find(part => part.score)?.position || new Vector3();
    const choose = (groups: string[][]) => {
        const candidates = landmarks.map(part => ({ ...part, score: score(part.words, groups) }))
            .filter(part => part.score).sort((a, b) => b.score - a.score || b.position.distanceToSquared(body) - a.position.distanceToSquared(body));
        if (!candidates.length) return undefined;
        // Paired generic front/rear landmarks (e.g. wheels) identify the centre
        // of an end, not whichever left/right corner happens to be listed first.
        const generic = candidates.filter(part => part.score === 1);
        return candidates[0].score === 1 ? generic.reduce((sum, part) => sum.add(part.position), new Vector3()).divideScalar(generic.length) : candidates[0].position;
    };
    const front = choose([['nose', 'muzzle', 'snout', 'beak', 'hood', 'bonnet'], ['head'], ['front']]);
    const rear = choose([['tail'], ['rear', 'back']]);
    const forward = front ? front.clone().sub(rear || body) : rear ? body.clone().sub(rear) : new Vector3();
    forward.y = 0;
    const up = new Vector3(0, 1, 0);
    if (forward.lengthSq() < 1e-6) {
        const authored = cameraForward(state.camera) || [0, -1];
        const inverse = new Quaternion().setFromEuler(new Euler(...object.transform.rotation)).invert();
        forward.set(authored[0], 0, authored[1]).applyQuaternion(inverse);
        up.applyQuaternion(inverse);
    } else forward.multiply(new Vector3(...object.transform.scale));
    forward.normalize();
    return { forward: forward.toArray() as MotionVec3, right: forward.clone().cross(up).normalize().toArray() as MotionVec3 };
}

/** Creation input authors a path; approximate AI navigation boxes are not walls.
 * x/y already contain stick strength, so apply it once, in the camera's floor plane. */
export function creationDriveStep(world: SpatialWorld, state: WorldState, last: MotionKey, sample: Drive, delta: number, options: { vertical?: number; speedMultiplier?: number; rotationMode?: CreationRotationMode; heading?: MotionVec3 } = {}): MotionKey {
    const magnitude = Math.hypot(sample.x, sample.y);
    const profile = creationLocomotion(world);
    // Explicit authoring height is available to every object. AI locomotion
    // defaults describe its performance, not limits on the creator's controls.
    const vertical = Number.isFinite(options.vertical) ? Math.max(-1, Math.min(1, options.vertical!)) : 0;
    if ((!sample.active && !vertical) || !Number.isFinite(magnitude) || (magnitude <= CREATION_STICK_DEAD_ZONE && !vertical) || !Number.isFinite(delta) || delta <= 0) return last;
    const multiplier = Number.isFinite(options.speedMultiplier) ? Math.max(.25, Math.min(3, options.speedMultiplier!)) : 1;
    const speed = profile.speed * multiplier;
    const bounded = (value: number) => Math.max(-100, Math.min(100, value));
    if (options.rotationMode) {
        const current = new Quaternion().setFromEuler(new Euler(...last.rotation));
        const axis = new Vector3(0, 1, 0);
        if (options.rotationMode !== 'horizontal') {
            const frame = creationOrientationAxes(world, state);
            axis.set(...(options.rotationMode === 'vertical' ? frame.right : frame.forward)).applyQuaternion(current).normalize();
        }
        const input = !sample.active || magnitude <= CREATION_STICK_DEAD_ZONE ? 0 : options.rotationMode === 'horizontal' ? -sample.x : options.rotationMode === 'vertical' ? sample.y : sample.x;
        const next = new Quaternion().setFromAxisAngle(axis, input / Math.max(1, magnitude) * profile.turnRate * delta).multiply(current);
        const euler = new Euler().setFromQuaternion(next);
        const rotation: MotionVec3 = [euler.x, euler.y, euler.z];
        return { ...last, rotation, ...(vertical ? { position: [last.position[0], bounded(last.position[1] + vertical * speed * delta), last.position[2]] as MotionVec3 } : {}) };
    }
    // A mount/vehicle can arrive at a node with a new heading. Do not steer it
    // back to the world's original heading. Ordinary walking keeps its rules.
    const baseline = world.controlMode === 'mounted' || world.controlMode === 'vehicle' ? state : world.initialState;
    const originalYaw = baseline.objects[world.controlledObject].transform.rotation[1];
    const authoredForward = cameraForward(baseline.camera) || [Math.sin(originalYaw), Math.cos(originalYaw)];
    const forward = cameraForward(state.camera) || authoredForward;
    const x = sample.active && magnitude > CREATION_STICK_DEAD_ZONE ? sample.x / Math.max(1, magnitude) : 0, y = sample.active && magnitude > CREATION_STICK_DEAD_ZONE ? sample.y / Math.max(1, magnitude) : 0;
    const dx = (-forward[1] * x + forward[0] * y) * speed * delta;
    const dz = (forward[0] * x + forward[1] * y) * speed * delta;
    // These are the renderer's existing coordinate limits, not model-made obstacles.
    const position: MotionVec3 = [bounded(last.position[0] + dx), bounded(last.position[1] + vertical * speed * delta), bounded(last.position[2] + dz)];
    // Facing is independent from travel: even a tilted or inverted subject uses
    // the same screen-relative stick directions and explicit world-up height.
    if (options.heading) return { ...last, rotation: [...options.heading], position };
    const travelX = position[0] - last.position[0], travelZ = position[2] - last.position[2];
    if (Math.hypot(travelX, travelZ) < 1e-8) return position[1] === last.position[1] ? last : { ...last, position };
    const rotation: MotionVec3 = [...last.rotation];
    // Primitive proxies have no standard mesh-forward axis. Retain the authored
    // facing offset rather than forcing every actor to face +Z or spin on forward.
    const facingOffset = originalYaw - Math.atan2(authoredForward[0], authoredForward[1]);
    const targetYaw = Math.atan2(travelX, travelZ) + facingOffset;
    const turn = Math.atan2(Math.sin(targetYaw - rotation[1]), Math.cos(targetYaw - rotation[1]));
    const maxTurn = delta * profile.turnRate * Math.min(1, magnitude);
    const yaw = rotation[1] + Math.max(-maxTurn, Math.min(maxTurn, turn));
    // Keep the captured heading continuous. Wrapping +PI to -PI looks identical
    // live, but linear keyframe playback would turn almost 360 degrees between them.
    rotation[1] = yaw;
    return { ...last, position, rotation };
}
