import { createSpatialDraft, findSpatialParentNodeId, findSpatialTraversalForMovement, sameSpatialSceneLink, type SpatialSceneState, type SpatialTraversal } from "./spatialStageModel";
import type { SpatialExperienceStage } from "./spatialExperience";

export interface SpatialPosition { stageId: string; nodeId: string }
export interface SpatialLinkVisit { source: SpatialPosition; destination: SpatialPosition; returnLocked?: boolean }
export interface SpatialDriveInput { x: number; y: number; radius: number; active: boolean; angle: number }
export const sameSpatialPosition = (a: SpatialPosition | null, b: SpatialPosition | null) =>
    a?.stageId === b?.stageId && a?.nodeId === b?.nodeId;

/** Mapped nodes contain proxy thumbnails until their actual video frame is saved.
 * Image/video view must never present those thumbnails as generated appearance. */
export function spatialAppearanceFrame(scene: SpatialSceneState, nodeId: string): string {
    const ledger = scene.ledger;
    const original = scene.nodes.find(node => node.id === nodeId);
    if (!ledger) return original?.frameUrl || '';
    let currentId = nodeId;
    const visited = new Set<string>();
    while (!visited.has(currentId)) {
        visited.add(currentId);
        const node = scene.nodes.find(item => item.id === currentId);
        if (!node) break;
        const incoming = scene.connections.find(edge => edge.targetNodeId === currentId);
        if (!incoming) return ledger.nodeContexts?.[currentId]?.frameUrl || node.frameUrl || ledger.world.sourceImage;
        const job = ledger.jobs.find(item => item.connectionId === incoming.id && item.direction === 'forward');
        if (job?.status === 'ready' && job.actualEndFrame) return job.actualEndFrame;
        if (job?.previousResult?.actualEndFrame) return job.previousResult.actualEndFrame;
        const edit = ledger.actionImageEdits?.[currentId];
        if (edit?.status === 'applied' && edit.output) return edit.output;
        // An actual compiled frame remains appearance evidence even when a
        // legacy/published document does not retain its generation job receipt.
        const stateFrame = ledger.nodeContexts?.[currentId]?.frameUrl;
        if (stateFrame) return stateFrame;
        if (!ledger.routes[incoming.id] || (!job && incoming.forward?.videoUrl && !incoming.forward.videoUrl.startsWith('three:'))) return node.frameUrl;
        currentId = incoming.sourceNodeId;
    }
    return ledger.world.sourceImage || scene.nodes[0]?.frameUrl || '';
}

/** Generation may leave incomplete edges in the live editor document. */
export function playableSpatialScene(scene: SpatialSceneState): SpatialSceneState {
    return { ...scene, connections: scene.connections.filter(edge => edge.forward?.videoUrl
        // Spatial world movement is an authored pair. Do not expose a half-ready
        // pair to the legacy reverse-forward-video fallback.
        && (!scene.ledger || edge.kind === 'action' || edge.backward?.videoUrl)
        && scene.nodes.some(node => node.id === edge.targetNodeId && node.frameUrl)) };
}

export function spatialTraversalForDrive(scene: SpatialSceneState, sample: SpatialDriveInput) {
    if (!sample.active || sample.radius < 0.08) return null;
    const draft = createSpatialDraft(scene.activeNodeId, [{ ...sample, elapsedMs: 1 }]);
    return draft ? findSpatialTraversalForMovement(playableSpatialScene(scene), draft) : null;
}

export function spatialDirections(scene: SpatialSceneState | null, clip: SpatialTraversal | null, linkReturnAxes: { x: number; y: number }[] = []) {
    const directions = { top: false, right: false, bottom: false, left: false };
    if (!scene) return directions;
    const mark = (x: number, y: number) => {
        if (Math.abs(y) >= Math.abs(x) * 0.55) { if (y >= 0) directions.top = true; else directions.bottom = true; }
        if (Math.abs(x) >= Math.abs(y) * 0.55) { if (x >= 0) directions.right = true; else directions.left = true; }
    };
    for (const edge of clip ? [clip.connection] : playableSpatialScene(scene).connections) {
        if (edge.kind === "action") continue;
        const sample = edge.movement.samples.at(-1);
        if (!sample || Math.hypot(sample.x, sample.y) < 0.08) continue;
        if (clip || edge.sourceNodeId === scene.activeNodeId) mark(sample.x, sample.y);
        if (clip || edge.targetNodeId === scene.activeNodeId) mark(-sample.x, -sample.y);
    }
    if (!clip) for (const axis of linkReturnAxes) mark(axis.x, axis.y);
    return directions;
}

/** Return to the exact followed-link source, including individual action results. */
export function spatialLinkReturn(scene: SpatialSceneState, history: SpatialLinkVisit[], stages: SpatialExperienceStage[]) {
    const visit = history.at(-1);
    if (visit?.returnLocked || scene.activeNodeId !== scene.nodes[0]?.id || visit?.destination.stageId !== scene.sceneId
        || visit.destination.nodeId !== scene.activeNodeId) return null;
    const source = stages.find(stage => stage.id === visit.source.stageId)?.scene;
    if (!source?.nodes.some(node => node.id === visit.source.nodeId && node.frameUrl)) return null;
    const position = visit.source;
    const axes = playableSpatialScene(scene).connections.filter(edge => edge.kind !== 'action' && edge.sourceNodeId === scene.activeNodeId)
        .map(edge => edge.movement.samples.at(-1)).filter(axis => axis && Math.hypot(axis.x, axis.y) >= 0.08)
        .map(axis => ({ x: -axis!.x, y: -axis!.y }));
    if (!axes.length) {
        const incoming = source.connections.find(edge => edge.kind !== 'action' && edge.targetNodeId === position.nodeId)?.movement.samples.at(-1);
        axes.push(incoming && Math.hypot(incoming.x, incoming.y) >= 0.08 ? { x: -incoming.x, y: -incoming.y } : { x: 0, y: -1 });
    }
    return { position, axes };
}

/** Explicit Back is independent of this movement-only action-link guard. */
export function spatialUnlockLinkReturn(history: SpatialLinkVisit[], stageId: string) {
    const visit = history.at(-1);
    if (!visit?.returnLocked || visit.destination.stageId !== stageId) return history;
    return [...history.slice(0, -1), { ...visit, returnLocked: false }];
}

export function spatialLinkReturnForDrive(scene: SpatialSceneState, history: SpatialLinkVisit[], stages: SpatialExperienceStage[], sample: SpatialDriveInput) {
    if (!sample.active || sample.radius < 0.08) return null;
    const destination = spatialLinkReturn(scene, history, stages);
    if (!destination || !destination.axes.some(axis => (sample.x * axis.x + sample.y * axis.y)
        / (Math.hypot(sample.x, sample.y) * Math.hypot(axis.x, axis.y)) >= 0.35)) return null;
    return destination.position;
}

export function spatialAction(scene: SpatialSceneState, stages: SpatialExperienceStage[]) {
    const node = scene.nodes.find(item => item.id === scene.activeNodeId);
    const backtrack = node?.actionBacktrack;
    if (backtrack) return { kind: "backtrack" as const, destination: scene.nodes.some(n => n.id === backtrack.targetNodeId && n.frameUrl)
        ? { stageId: scene.sceneId, nodeId: backtrack.targetNodeId } : null };
    if (node?.actionLink) {
        const link = node.actionLink;
        const target = stages.find(s => sameSpatialSceneLink(link, s.address));
        return { kind: "link" as const, destination: target?.scene.nodes[0]?.frameUrl
            ? { stageId: target.id, nodeId: target.scene.nodes[0].id } : null };
    }
    const edge = [...playableSpatialScene(scene).connections].reverse().find(c => c.kind === "action" && c.sourceNodeId === scene.activeNodeId);
    return edge?.forward ? { kind: "video" as const, traversal: { connection: edge, direction: "forward" as const,
        destinationNodeId: edge.targetNodeId, video: edge.forward } } : null;
}

/** A published leaf is a completed route; incoming return travel is not a child. */
export function spatialIsTerminalNode(scene: SpatialSceneState, stages: SpatialExperienceStage[]) {
    if (spatialAction(scene, stages)) return false;
    return !playableSpatialScene(scene).connections.some(connection => (
        connection.kind !== "action" && connection.sourceNodeId === scene.activeNodeId
    ));
}

/** Returning to an action replays its forward clip, with normal completion behavior. */
export function spatialActionReplay(scene: SpatialSceneState): SpatialTraversal | null {
    const edge = [...playableSpatialScene(scene).connections].reverse().find(connection =>
        connection.kind === 'action' && connection.targetNodeId === scene.activeNodeId);
    return edge?.forward ? { connection: { ...edge, actionPlayback: 'tap' }, direction: 'forward',
        destinationNodeId: scene.activeNodeId, video: edge.forward } : null;
}

export function spatialActionForwardDestination(scene: SpatialSceneState, stages: SpatialExperienceStage[]) {
    const action = spatialAction(scene, stages);
    return action?.kind === 'video' ? { stageId: scene.sceneId, nodeId: action.traversal.destinationNodeId }
        : action?.destination || null;
}

/** The existing explicit Back gesture skips action chains in viewer mode. */
function spatialPlayableReturnNodeId(scene: SpatialSceneState, nodeId: string) {
    let current = nodeId;
    const visited = new Set<string>();
    while (!visited.has(current)) {
        visited.add(current);
        const incoming = [...scene.connections].reverse().find(edge => edge.kind === 'action' && edge.targetNodeId === current
            && scene.nodes.some(node => node.id === edge.sourceNodeId));
        if (!incoming) break;
        current = incoming.sourceNodeId;
    }
    return current;
}

export function spatialBackDestination(scene: SpatialSceneState, history: SpatialLinkVisit[], options: {
    skipActionResults?: boolean; stages?: SpatialExperienceStage[];
} = {}) {
    const playablePosition = (position: SpatialPosition) => {
        if (!options.skipActionResults) return position;
        const targetScene = position.stageId === scene.sceneId ? scene : options.stages?.find(stage => stage.id === position.stageId)?.scene;
        return targetScene ? { ...position, nodeId: spatialPlayableReturnNodeId(targetScene, position.nodeId) } : position;
    };
    const visit = history.at(-1);
    // A followed link can enter the same stage. Return at its entry before looking at ancestry.
    if (visit?.destination.stageId === scene.sceneId && visit.destination.nodeId === scene.activeNodeId)
        return { position: playablePosition(visit.source), popLink: true };
    const parent = findSpatialParentNodeId(scene);
    return parent ? { position: playablePosition({ stageId: scene.sceneId, nodeId: parent }), popLink: false } : null;
}
