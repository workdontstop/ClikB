import type { MotionPlan } from './motionGuide';
import { cloneWorld } from '../server/src/spatialWorld';

export const MOVEMENT_SECONDS = 5;

/** Raw stick recordings turn continuously; repair old wrapped headings for
 * preview without mutating the saved draft or changing intentional AI spins. */
export function recordedMovementPreview(value: MotionPlan, controlledObject: string): MotionPlan {
    const plan = cloneWorld(value);
    const keys = plan.objects.find(object => object.id === controlledObject)?.keys;
    if (!keys?.length) return plan;
    let previous = keys[0].rotation[1];
    for (const key of keys.slice(1)) {
        const difference = key.rotation[1] - previous;
        const turn = Math.atan2(Math.sin(difference), Math.cos(difference));
        key.rotation[1] = previous + turn;
        previous = key.rotation[1];
    }
    return plan;
}

/** Slow a short gesture to five seconds, preserving every captured endpoint.
 * Trim static tracks before retiming, avoiding an artificial final-pose pause. */
export function finishMovementTiming(value: MotionPlan, elapsedSeconds: number): MotionPlan {
    const plan = cloneWorld(value);
    const elapsed = Math.max(.001, Math.min(MOVEMENT_SECONDS, elapsedSeconds));
    const track = <T extends { t: number }>(keys: T[]): T[] => {
        const captured = keys.filter(key => key.t <= elapsed);
        const last = captured.at(-1) || keys[0];
        if (!captured.length) captured.push({ ...last, t: 0 });
        if (captured.at(-1)!.t < elapsed) captured.push({ ...last, t: elapsed });
        const stride = Math.max(1, Math.ceil(captured.length / 44));
        const result = captured.filter((_, i) => i === 0 || i === captured.length - 1 || i % stride === 0)
            .map(key => ({ ...key, t: key.t / elapsed * MOVEMENT_SECONDS }));
        result[0].t = 0;
        result[result.length - 1].t = MOVEMENT_SECONDS;
        return result;
    };
    plan.duration = MOVEMENT_SECONDS;
    for (const object of plan.objects) {
        object.keys = track(object.keys);
        for (const part of object.parts || []) part.keys = track(part.keys);
    }
    plan.camera = track(plan.camera);
    return plan;
}
