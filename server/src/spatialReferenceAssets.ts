import type { SpatialLedger } from './spatialWorld';
import { scenePerformanceText } from './scenePerformance';

type ReferenceScene = { nodes: { id: string; frameUrl: string }[]; connections: { id: string; targetNodeId: string }[]; ledger?: SpatialLedger };

const assetFields = ['referenceVideo', 'referencePlanKey', 'startAnchor', 'endAnchor', 'motionEvidence', 'guidance'] as const;
export function sceneWithoutReferenceAssets<T extends ReferenceScene>(scene: T) {
    const copy = structuredClone(scene);
    for (const edge of copy.connections) {
        const animation = copy.ledger?.routes[edge.id]?.forward, node = copy.nodes.find(item => item.id === edge.targetNodeId);
        if (node && animation && !copy.ledger?.jobs.some(job => job.connectionId === edge.id)
            && (node.frameUrl === animation.endAnchor || !animation.endAnchor && node.frameUrl === animation.startAnchor)) node.frameUrl = `mapped-endpoint:${edge.id}`;
    }
    for (const route of Object.values(copy.ledger?.routes || {})) for (const direction of ['forward', 'backward'] as const) {
        const animation = route[direction];
        if (animation) for (const field of assetFields) delete animation[field];
    }
    return copy;
}
/** Rebase only reference-only completions; real edits retain the existing revision conflict protection. */
export function retainCurrentReferenceAssets<T extends ReferenceScene>(next: T, current: T) {
    const copy = structuredClone(next);
    if (copy.ledger?.world.revision !== current.ledger?.world.revision) return copy;
    if (copy.ledger?.world.aspectRatio !== current.ledger?.world.aspectRatio) return copy;
    const aspect = copy.ledger?.world.aspectRatio || '16:9';
    for (const [routeId, route] of Object.entries(copy.ledger?.routes || {})) for (const direction of ['forward', 'backward'] as const) {
        const animation = route[direction], saved = current.ledger?.routes[routeId]?.[direction];
        if (!animation || !saved || animation.id !== saved.id || scenePerformanceText(animation.plan,aspect,animation.authoring) !== scenePerformanceText(saved.plan,aspect,saved.authoring)) continue;
        for (const field of assetFields) if (saved[field] !== undefined) (animation as any)[field] = structuredClone(saved[field]);
    }
    for (const edge of copy.connections) {
        const node = copy.nodes.find(item => item.id === edge.targetNodeId), savedNode = current.nodes.find(item => item.id === edge.targetNodeId);
        const before = next.ledger?.routes[edge.id]?.forward, saved = current.ledger?.routes[edge.id]?.forward;
        if (node && savedNode && before && saved && before.id === saved.id && scenePerformanceText(before.plan,aspect,before.authoring) === scenePerformanceText(saved.plan,aspect,saved.authoring)
            && (node.frameUrl === before.endAnchor || !before.endAnchor && node.frameUrl === before.startAnchor)
            && savedNode.frameUrl === saved.endAnchor) node.frameUrl = savedNode.frameUrl;
    }
    return copy;
}
