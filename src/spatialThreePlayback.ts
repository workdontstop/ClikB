import type { SpatialSceneState } from './spatialStageModel';
/** Virtual clips expose exactly the authored graph to the existing navigation resolver. */
export function threePlayableScene(scene: SpatialSceneState): SpatialSceneState {
    if (!scene.ledger) return scene;
    return { ...scene, connections: scene.connections.map(edge => {
        const route = scene.ledger!.routes[edge.id];
        if (!route) return edge;
        return { ...edge, status: 'ready',
            forward: { videoUrl: `three:${edge.id}:forward`, durationMs: route.forward.plan.duration * 1000, provider: 'api' },
            backward: route.backward ? { videoUrl: `three:${edge.id}:backward`, durationMs: route.backward.plan.duration * 1000, provider: 'api' } : null };
    }) };
}
