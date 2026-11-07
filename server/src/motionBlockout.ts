import { validateMotionPlan, type MotionPlan, type MotionVec3 } from './motionGuidePlan';
import { fitSourceCamera, fitSourceSubjects, sceneWorldCorners, type SceneLayout } from './spatialSceneCalibration';
import { expandBlockoutAuthoring, normalizeBlockoutGeometry } from './motionBlockoutAuthoring';
import { initialMotionMatrix } from './motionNodeTransforms';

/** Normal references must keep every authored motion track. Static spatial
 * shorthand, missing tracks and lossy key repair cannot become a successful
 * stationary animation. Saved/edit plans retain the same strict wire format. */
export function prepareMotionGuide(input: unknown, aspect: string, layout?: SceneLayout): MotionPlan {
    const authored = validateMotionPlan(normalizeBlockoutGeometry(input));
    // Reuse ground presentation only. Subject fitting belongs to static spatial
    // reconstruction: changing a root here can break seating and prop contact.
    const plan = prepareMotionBlockout(authored, aspect);
    return layout ? fitSourceCamera(plan, layout, aspect) : plan;
}

/** Applied only to newly authored scenes, never on loading a saved recording. */
export function prepareMotionBlockout(input: unknown, aspect: string, layout?: SceneLayout, relationships: any[] = [], walkable: any[] = []): MotionPlan {
    let plan = validateMotionPlan(expandBlockoutAuthoring(input, relationships));
    const flatSurface = (node: MotionPlan['objects'][number]) => node.shape === 'box' &&
        /(^|_)(ground|floor|path|terrain|platform|landing|road|walkway|bridge|deck|tread|paving|slab|slabs)(_|$)/i.test(node.id) &&
        node.keys[0].scale[1] < Math.min(node.keys[0].scale[0], node.keys[0].scale[2]);
    for (const object of plan.objects) {
        if (!object.parts && flatSurface(object)) object.surface = 'ground';
        for (const part of object.parts || []) if (flatSurface(part) || (object.surface === 'ground' || flatSurface({ ...part, id: object.id })) && part.shape === 'box' && part.keys[0].scale[1] < Math.min(part.keys[0].scale[0], part.keys[0].scale[2])) part.surface = 'ground';
    }
    const isStatic = plan.objects.every(object => object.keys.every(key => JSON.stringify({ ...key, t: 0 }) === JSON.stringify({ ...object.keys[0], t: 0 })));
    if (isStatic) for (const relation of relationships) {
        if (!/^(stands_on|rests_on|supported_by)$/.test(relation.relation)) continue;
        const subject = plan.objects.find(object => object.id === relation.from);
        const support = plan.objects.find(object => object.id === relation.to);
        if (!subject || !support || subject.attachment) continue;
        const surfaces = (support.parts || [support]).filter(part => part.shape === 'box' &&
            (part.surface === 'ground' || /(^|_)(top|tabletop|surface)(_|$)/i.test(part.id)));
        const [x, , z] = subject.keys[0].position;
        const heights = surfaces.flatMap(part => {
            const m = initialMotionMatrix(plan, support.id, support.parts ? part.id : undefined);
            // Only horizontal, explicitly identified supporting surfaces. Do
            // not turn scenery bounds or a sloping roof into a guessed floor.
            if (Math.abs(m[4]) > .001 || Math.abs(m[6]) > .001 || m[5] <= 0) return [];
            const det = m[0] * m[10] - m[2] * m[8];
            const lx = ((x - m[3]) * m[10] - (z - m[11]) * m[2]) / det;
            const lz = ((z - m[11]) * m[0] - (x - m[3]) * m[8]) / det;
            return Math.abs(lx) <= .5 && Math.abs(lz) <= .5 ? [m[7] + m[5] / 2] : [];
        });
        if (!heights.length) continue;
        const bottom = Math.min(...sceneWorldCorners(plan)[subject.id].map(point => point[1]));
        const dy = Math.max(...heights) - bottom;
        if (subject.keys.every(key => Math.abs(key.position[1] + dy) <= 100))
            subject.keys = subject.keys.map(key => ({ ...key, position: [key.position[0], key.position[1] + dy, key.position[2]] }));
    }
    if (layout) {
        plan = fitSourceCamera(plan, layout, aspect);
        if (isStatic) plan = fitSourceSubjects(plan, layout, aspect, relationships, walkable);
    }
    if (!plan.objects.some(object => object.surface === 'ground' || object.parts?.some(part => part.surface === 'ground'))) {
        const points = Object.values(sceneWorldCorners(plan)).flat();
        const min = [0, 1, 2].map(axis => Math.min(...points.map(point => point[axis])));
        const max = [0, 1, 2].map(axis => Math.max(...points.map(point => point[axis])));
        let id = 'blockout_ground';
        while (plan.objects.some(object => object.id === id)) id += '_';
        const position: MotionVec3 = [(min[0] + max[0]) / 2, Math.min(0, min[1]) - .1, (min[2] + max[2]) / 2];
        const scale: MotionVec3 = [Math.min(100, Math.max(20, max[0] - min[0] + 12)), .2, Math.min(100, Math.max(20, max[2] - min[2] + 12))];
        if (position.every(n => Number.isFinite(n) && Math.abs(n) <= 100)) plan.objects.push({ id, shape: 'box', color: '#BBC3D2', surface: 'ground',
            keys: [0, plan.duration].map(t => ({ t, position: [...position], rotation: [0, 0, 0], scale: [...scale] })) });
    }
    return plan;
}
