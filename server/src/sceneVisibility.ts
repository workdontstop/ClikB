import type { MotionPlan } from './motionGuidePlan';

/** Compound entities render their parts; an invisible root is only a transform. */
export function hasVisibleSceneGeometry(plan?: Pick<MotionPlan, 'objects'>): boolean {
    return Boolean(plan?.objects.some(object => object.id !== 'live_workspace' && (object.parts?.length ? object.parts.some(part => part.shape !== 'anchor') : object.shape !== 'anchor')));
}
