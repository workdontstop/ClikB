import { validateMotionPlan } from './motionGuidePlan';
import { selectedWorldControl, validateWorld, type SpatialWorld } from './spatialWorld';

/** Renderable geometry is retained even when the model's navigation metadata
 * needs creator input. No objects or parts are removed or substituted. */
export function prepareSpatialReconstruction(value: any, metadata: Record<string, unknown>): SpatialWorld {
    const plan = validateMotionPlan(value?.plan);
    const bounded = (items: any) => Array.isArray(items) && items.every(item =>
        ['min', 'max'].every(field => Array.isArray(item?.[field]) && item[field].length === 3 && item[field].every((n: any) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 100))
        && item.min.every((n: number, i: number) => n <= item.max[i]));
    const selected = selectedWorldControl(plan, metadata.drivenName, metadata.references, value?.controlledObject);
    const controlledObject = selected.controlledObject || plan.objects[0].id;
    const bounds = {
        min: [0, 1, 2].map(axis => Math.max(-100, Math.min(...plan.objects.map(o => o.keys[0].position[axis] - o.keys[0].scale[axis] / 2)) - 2)),
        max: [0, 1, 2].map(axis => Math.min(100, Math.max(...plan.objects.map(o => o.keys[0].position[axis] + o.keys[0].scale[axis] / 2)) + 2)),
    };
    return validateWorld({ ...value, ...metadata, plan, controlledObject,
        controlMode: ['character', 'vehicle', 'mounted', 'pov', 'other'].includes(value?.controlMode) ? value.controlMode : 'other',
        walkable: bounded(value?.walkable) && value.walkable.length ? value.walkable : [bounds],
        obstacles: bounded(value?.obstacles) ? value.obstacles : [],
        navigationNeedsReview: !bounded(value?.walkable) || !value.walkable.length || !bounded(value?.obstacles),
        // An inferred default is never permission to drive the wrong subject.
        controlSelectionRequired: !selected.confirmed, approved: false, reviewRejected: false,
    });
}
