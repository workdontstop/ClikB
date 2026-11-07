import { SpatialSceneState, SpatialSceneLinkOption, SpatialMotionContext, createSpatialScene, spatialBShotIdentity, sameSpatialSceneLink } from "./spatialStageModel";

export interface SpatialExperienceStage {
  id: string;
  label: string;
  address: { sceneId: string; bShotIndex?: number; bShotIdentity?: string };
  scene: SpatialSceneState;
  contexts: SpatialMotionContext[];
  videoUrl?: string;
}
/** Database payload: no React state, callbacks, DOM objects or cache handles. */
export interface SpatialExperience {
  version: 1;
  actionLabels?: import('../server/src/spatialLabelMetadata').SpatialActionLabels;
  actionLabelsRevision?: number;
  stages: SpatialExperienceStage[];
  entry: { stageId: string; nodeId: string } | null;
}

/** Hide unused storyboard placeholders, but retain deliberately linked destinations. */
export function usedSpatialStages(stages: SpatialExperienceStage[], entryStageId?: string): SpatialExperienceStage[] {
  const targets = stages.flatMap(stage => stage.scene.nodes.flatMap(node => node.actionLink ? [node.actionLink] : []));
  return stages.filter(stage => stage.id === entryStageId || stage.scene.connections.length > 0
    || Boolean(stage.scene.ledger?.world.approved)
    || stage.scene.nodes.some(node => node.actionLink || node.actionBacktrack)
    || targets.some(target => sameSpatialSceneLink(target, stage.address)));
}

/** Parse a persisted/feed value without trusting JSON returned by the database. */
export function parseSpatialExperience(value: unknown): SpatialExperience | null {
  try {
    const document = typeof value === "string" ? JSON.parse(value) : value;
    if (!document || typeof document !== "object") return null;
    const candidate = document as Partial<SpatialExperience>;
    if (candidate.version !== 1 || !Array.isArray(candidate.stages) || candidate.stages.length === 0 || !candidate.entry) return null;
    const stageIds = new Set<string>();
    for (const stage of candidate.stages) {
      if (!stage || typeof stage.id !== "string" || !stage.id || stageIds.has(stage.id)) return null;
      if (!stage.scene || stage.scene.sceneId !== stage.id || !Array.isArray(stage.scene.nodes) || !Array.isArray(stage.scene.connections)) return null;
      if (!Array.isArray(stage.contexts) || stage.scene.nodes.length === 0) return null;
      const nodeIds = new Set<string>();
      for (const node of stage.scene.nodes) {
        if (!node || typeof node.id !== "string" || !node.id || typeof node.frameUrl !== "string" || nodeIds.has(node.id)) return null;
        nodeIds.add(node.id);
      }
      if (!nodeIds.has(stage.scene.activeNodeId)) return null;
      for (const connection of stage.scene.connections) {
        if (!connection || !nodeIds.has(connection.sourceNodeId) || !nodeIds.has(connection.targetNodeId)) return null;
        if (!Array.isArray(connection.movement?.samples)) return null;
      }
      stageIds.add(stage.id);
    }
    const entryStage = candidate.stages.find(stage => stage.id === candidate.entry?.stageId);
    if (!entryStage?.scene.nodes.some(node => node.id === candidate.entry?.nodeId)) return null;
    return candidate as SpatialExperience;
  } catch {
    return null;
  }
}
export function buildSpatialExperienceStages(options: SpatialSceneLinkOption[], scenes: SpatialSceneState[], bScenes: (SpatialSceneState | null)[][], contexts: SpatialMotionContext[][], bContexts: SpatialMotionContext[][][]): SpatialExperienceStage[] {
  const stages = options.flatMap(option => {
    const a = scenes.findIndex(scene => scene.sceneId === option.sceneId);
    const id = option.bShotIndex === undefined ? option.sceneId : spatialBShotIdentity(option)!;
    const saved = option.bShotIndex === undefined ? scenes[a] : bScenes[a]?.find(scene => scene?.sceneId === id);
    const scene = (option.bShotIndex === undefined || saved?.sceneId === id ? saved : null) || createSpatialScene(id, option.frameUrl);
    if (!scene.nodes.some(node => node.frameUrl && !node.frameUrl.startsWith("EMPTY"))) return [];
    return [{id, label: option.label, address: {sceneId: option.sceneId, bShotIndex: option.bShotIndex, bShotIdentity: option.bShotIdentity},
      scene,
      contexts: (option.bShotIndex === undefined ? contexts[a] : bContexts[a]?.[option.bShotIndex]) || [], videoUrl: option.videoUrl}];
  });
  return stages;
}

/** Snapshot for preview/persistence. The creation adapter uses the live stages above. */
export function buildSpatialExperience(options: SpatialSceneLinkOption[], scenes: SpatialSceneState[], bScenes: (SpatialSceneState | null)[][], contexts: SpatialMotionContext[][], bContexts: SpatialMotionContext[][][]): SpatialExperience {
  const stages = buildSpatialExperienceStages(options, scenes, bScenes, contexts, bContexts)
    .map(stage => ({...stage, scene: {...stage.scene, activeNodeId: stage.scene.nodes[0].id, draftMovement: null}}));
  return JSON.parse(JSON.stringify({version: 1, stages, entry: stages.length ? {stageId: stages[0].id, nodeId: stages[0].scene.nodes[0].id} : null}));
}
