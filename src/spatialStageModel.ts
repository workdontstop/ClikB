import { authoringLocked, type SpatialLedger } from '../server/src/spatialWorld';
export const SPATIAL_MANIFEST_VERSION = 1 as const;
export const MAX_SPATIAL_CONNECTIONS_PER_SCENE = 40;

export type SpatialDirection = "forward" | "backward";
export type SpatialConnectionKind = "movement" | "action";
export type SpatialGenerationStatus = "draft" | "generating-forward" | "generating-backward" | "generating-context" | "ready" | "failed";

export interface SpatialMovementSample {
  x: number;
  y: number;
  radius: number;
  angle: number;
  elapsedMs: number;
}

export type SpatialGuidanceMode = "automatic" | "user";

export interface SpatialMovementGuidance {
  mode: SpatialGuidanceMode;
  instruction: string;
  /** Exact editor video duration this instruction was paced for. */
  durationSeconds: number;
  cacheKey: string;
  sourceFrameUrl: string;
  generatedAt: number;
  model?: string;
  /** Tiny annotated scene map supplied only to spatial-capable video models. */
  movementReferenceImageUrl?: string;
  /** Present only when the popup's separate Create button was used. */
  userInstruction?: string;
}

export interface SpatialCapturedTrail {
  width: number;
  height: number;
  points: { x: number; y: number }[];
}

export interface SpatialMovementDraft {
  /** Actual rendered trail in normalized overlay coordinates. */
  capturedTrail?: SpatialCapturedTrail;
  /** Normalized current-frame coordinates: x right, y down. Movement authoring only. */
  startPoint?: { x: number; y: number };
  id: string;
  sourceNodeId: string;
  createdAt: number;
  durationMs: number;
  samples: SpatialMovementSample[];
  /** Reused when the exact same failed movement is retried. */
  guidance?: SpatialMovementGuidance;
  /** Independently generated physical return plan, never a reversed clip prompt. */
  returnGuidance?: SpatialMovementGuidance;
}

export interface SpatialSceneLink {
  sceneId: string;
  bShotIndex?: number;
  bShotIdentity?: string;
}

/** New B-shot links use their saved stage ID; old indexed/hash links remain resolvable. */
export const spatialBShotIdentity = (link: SpatialSceneLink): string | undefined => link.bShotIndex === undefined ? undefined
  : link.bShotIdentity?.startsWith(`${link.sceneId}:b:`) ? link.bShotIdentity
    : link.bShotIdentity ? `${link.sceneId}:b:${link.bShotIndex}:${link.bShotIdentity}` : undefined;
export const sameSpatialSceneLink = (a: SpatialSceneLink, b: SpatialSceneLink): boolean => a.sceneId === b.sceneId
  && (a.bShotIndex === undefined ? b.bShotIndex === undefined : b.bShotIndex !== undefined && Boolean(spatialBShotIdentity(a)) && spatialBShotIdentity(a) === spatialBShotIdentity(b));

export interface SpatialSceneLinkOption extends SpatialSceneLink {
  label: string;
  frameUrl: string;
  videoUrl?: string;
}

export interface SpatialNode {
  id: string;
  label: string;
  frameUrl: string;
  actionLink?: SpatialSceneLink;
  actionBacktrack?: { targetNodeId: string };
  createdAt: number;
  /** Action result nodes render as triangles; omitted means a movement node. */
  kind?: SpatialConnectionKind;
}

export type SpatialControlMode = "character" | "vehicle" | "mounted" | "pov" | "other";

/**
 * A short, inherited contract for intelligent stick movement. Scene roots own
 * the initial entry; future action nodes can append another entry at their
 * node without changing the graph or overwriting sibling branches.
 */
export interface SpatialMotionContext {
  id: string;
  anchorNodeId: string;
  source: "scene-root" | "action-transition";
  controlMode: SpatialControlMode;
  controlledSubject: string;
  primaryMotion: string;
  ambientMotion: string;
  userPriorityHint: string;
  sourceContextHash: string;
  createdAt: number;
  updatedAt: number;
}

export interface SpatialDirectionalVideo {
  videoUrl: string;
  durationMs: number;
  provider: "gpu" | "api";
}

export interface SpatialConnection {
  actionPlayback?: 'tap' | 'hold';
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  /** Older saved manifests omit this and are treated as movement connections. */
  kind?: SpatialConnectionKind;
  movement: SpatialMovementDraft;
  actionPrompt?: string;
  /** Stable non-spatial placement for action triangles in the visual map. */
  actionMapOffset?: { x: number; y: number };
  forward: SpatialDirectionalVideo | null;
  backward: SpatialDirectionalVideo | null;
  status: SpatialGenerationStatus;
  guidance?: SpatialMovementGuidance;
  error?: string;
}

export interface SpatialTraversal {
  connection: SpatialConnection;
  direction: SpatialDirection;
  destinationNodeId: string;
  video: SpatialDirectionalVideo;
}

export interface SpatialSceneState {
  /** B-shot source metadata supports restoring its stable stage after edits/reordering. */
  bShotSource?: { prompt: string; frameUrl: string; identity?: string; slot?: number };
  bShotIdentityConflict?: string[];
  /** Versioned 3D authoring ledger; absent in legacy video-only stages. */
  ledger?: SpatialLedger;
  sceneId: string;
  activeNodeId: string;
  nodes: SpatialNode[];
  connections: SpatialConnection[];
  draftMovement: SpatialMovementDraft | null;
  /** New canonical Storybook frame awaiting an explicit destructive stage reset. */
  pendingRootFrameUrl?: string;
}

export interface SpatialManifest {
  version: typeof SPATIAL_MANIFEST_VERSION;
  scenes: SpatialSceneState[];
}

export interface SpatialNodeCutResult {
  scene: SpatialSceneState;
  removedNodeIds: string[];
  removedConnectionIds: string[];
}

const makeId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

export const createSpatialScene = (sceneId: string, firstFrameUrl = ""): SpatialSceneState => {
  const rootId = `${sceneId}:node-0`;
  return {
    sceneId,
    activeNodeId: rootId,
    nodes: [{ id: rootId, label: "Start", frameUrl: firstFrameUrl, createdAt: Date.now() }],
    connections: [],
    draftMovement: null,
  };
};

export const syncSpatialManifest = (
  manifest: SpatialManifest,
  scenes: Array<{ sceneId: string; firstFrameUrl?: string }>,
): SpatialManifest => {
  const nextScenes = scenes.map(({ sceneId, firstFrameUrl = "" }, sceneIndex) => {
    const previous = manifest.scenes[sceneIndex];
    if (!previous) return createSpatialScene(sceneId, firstFrameUrl);
    const rootId = previous.nodes[0]?.id || `${sceneId}:node-0`;
    const currentRootFrame = String(previous.nodes.find((node) => node.id === rootId)?.frameUrl || "").trim();
    const canonicalRootFrame = String(firstFrameUrl || "").trim();
    // Storybook may initialize interaction mode from a Nano preview and later
    // place the real render in ImagesHdCloud. Before any movement exists, keep
    // the spatial root synchronized with that newer canonical HD frame. Once a
    // connection exists its video was generated from the old frame, so changing
    // the root silently would corrupt continuity; reset is required instead.
    const canUpgradeRootFrame = !previous.ledger && previous.connections.length === 0
      && Boolean(canonicalRootFrame)
      && canonicalRootFrame !== currentRootFrame;
    const pendingRootFrameUrl = canonicalRootFrame === currentRootFrame
      ? undefined
      : (previous.connections.length > 0 || previous.ledger) && canonicalRootFrame
        ? canonicalRootFrame
        : canUpgradeRootFrame
          ? undefined
          : previous.pendingRootFrameUrl;
    const nodes = previous.nodes.length
      ? previous.nodes.map((node) => node.id === rootId && ((!node.frameUrl && canonicalRootFrame) || canUpgradeRootFrame)
        ? { ...node, frameUrl: canonicalRootFrame }
        : node)
      : createSpatialScene(sceneId, firstFrameUrl).nodes;
    return {
      ...previous,
      sceneId,
      nodes,
      pendingRootFrameUrl,
      draftMovement: canUpgradeRootFrame && previous.draftMovement
        ? { ...previous.draftMovement, guidance: undefined, returnGuidance: undefined }
        : previous.draftMovement,
      activeNodeId: nodes.some((node) => node.id === previous.activeNodeId) ? previous.activeNodeId : rootId,
    };
  });
  if (nextScenes.length === manifest.scenes.length && nextScenes.every((scene, i) => scene === manifest.scenes[i])) return manifest;
  return { version: SPATIAL_MANIFEST_VERSION, scenes: nextScenes };
};

export const createSpatialDraft = (
  sourceNodeId: string,
  samples: SpatialMovementSample[],
  createdAt = Date.now(),
): SpatialMovementDraft | null => {
  const useful = samples.filter((sample) => sample.radius >= 0.08);
  if (!sourceNodeId || useful.length === 0) return null;
  return {
    id: makeId("movement"),
    sourceNodeId,
    createdAt,
    durationMs: Math.max(1, Math.round(useful[useful.length - 1].elapsedMs)),
    samples: useful,
  };
};

/**
 * Create the physical path request used to annotate a return frame. This does
 * not reverse video: it mirrors the recorded stick vector so the return
 * director receives a fresh destination-aware movement map.
 */
export const reverseSpatialMovementDraft = (
  draft: SpatialMovementDraft,
): SpatialMovementDraft => ({
  ...draft,
  // The forward-frame click does not locate the subject in the generated return frame.
  startPoint: undefined,
  samples: draft.samples.map((sample) => {
    const x = -sample.x;
    const y = -sample.y;
    return {
      ...sample,
      x,
      y,
      angle: Math.atan2(y, x),
    };
  }),
});

export const movementPrompt = (draft: SpatialMovementDraft, reverse = false): string => {
  const last = draft.samples[draft.samples.length - 1];
  const horizontal = Math.abs(last.x) >= 0.18 ? (last.x > 0 ? "right" : "left") : "";
  const vertical = Math.abs(last.y) >= 0.18 ? (last.y > 0 ? "forward" : "backward") : "";
  const direction = [vertical, horizontal].filter(Boolean).join(" and ") || "slightly forward";
  return reverse
    ? `Reverse the controlled subject or POV smoothly along the same short path, opposite to ${direction}, until the exact previous state and viewpoint are restored. Preserve independent ambient motion, lighting, scale and continuity.`
    : `Apply the stick input ${direction} as a short controlled movement of the identified subject or POV. Preserve independent ambient motion, camera relationship, lighting and visual continuity; end on a stable usable frame.`;
};

export const spatialJoystickInput = (draft: SpatialMovementDraft) => {
  const sample = draft.samples.at(-1);
  const x = sample?.x || 0;
  const y = sample?.y || 0;
  const direction = [
    Math.abs(y) >= 0.18 ? (y > 0 ? "FORWARD" : "BACKWARD") : "",
    Math.abs(x) >= 0.18 ? (x > 0 ? "RIGHT" : "LEFT") : "",
  ].filter(Boolean).join("_") || (Math.abs(x) >= Math.abs(y) ? (x >= 0 ? "RIGHT" : "LEFT") : (y >= 0 ? "FORWARD" : "BACKWARD"));
  return { x, y, direction, radius: sample?.radius || 0, gestureDurationMs: draft.durationMs, startPoint: draft.startPoint };
};

/** Map a click in a contain-fit image to normalized image coordinates; reject letterboxing. */
export const spatialFrameClick = (x: number, y: number, width: number, height: number, imageWidth: number, imageHeight: number) => {
  if (Math.min(width, height, imageWidth, imageHeight) <= 0) return null;
  const scale = Math.min(width / imageWidth, height / imageHeight);
  const px = (x - (width - imageWidth * scale) / 2) / (imageWidth * scale);
  const py = (y - (height - imageHeight * scale) / 2) / (imageHeight * scale);
  return px >= 0 && px <= 1 && py >= 0 && py <= 1 ? { x: px, y: py } : null;
};

export const upsertSpatialMotionContext = (
  contexts: SpatialMotionContext[],
  context: SpatialMotionContext,
): SpatialMotionContext[] => {
  const existingIndex = contexts.findIndex((entry) => entry.anchorNodeId === context.anchorNodeId);
  const next = [...contexts];
  if (existingIndex >= 0) next[existingIndex] = context;
  else next.push(context);
  return next;
};

/** Resolve the nearest state transition inherited by a node on its real graph path. */
export const resolveSpatialMotionContext = (
  scene: SpatialSceneState,
  nodeId: string,
  contexts: SpatialMotionContext[],
): SpatialMotionContext | null => {
  if (!contexts.length || !scene.nodes.some((node) => node.id === nodeId)) return null;
  const byAnchor = new Map(contexts.map((context) => [context.anchorNodeId, context]));
  const visited = new Set<string>();
  let frontier = [nodeId];

  while (frontier.length) {
    const matches = frontier
      .map((id) => byAnchor.get(id))
      .filter((context): context is SpatialMotionContext => Boolean(context))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    if (matches.length) return matches[0];

    const next: string[] = [];
    for (const currentNodeId of frontier) {
      if (visited.has(currentNodeId)) continue;
      visited.add(currentNodeId);
      // An action can change who/what the stick controls. Never inherit a
      // pre-action state through this boundary while its new state is absent.
      if (scene.connections.some((connection) => (
        connection.kind === "action" && connection.targetNodeId === currentNodeId
      ))) continue;
      for (const connection of scene.connections) {
        if (connection.targetNodeId === currentNodeId && !visited.has(connection.sourceNodeId)) {
          next.push(connection.sourceNodeId);
        }
      }
    }
    frontier = next;
  }
  return null;
};

export const buildIntelligentSpatialMovementPrompt = (
  context: SpatialMotionContext,
  draft: SpatialMovementDraft,
  reverse = false,
): string => [
  "SPATIAL CONTROL DATA (reasoning input only; do not copy its directional words):",
  `Controlled subject: ${context.controlledSubject}`,
  context.userPriorityHint.trim()
    ? `USER PRIORITY MOTION (follow this with highest motion priority): ${context.userPriorityHint.trim()}`
    : "",
  "",
  "RECORDED STICK INPUT:",
  movementPrompt(draft, reverse),
  "Infer the controlled subject's scene-relative route from the image. Write movement for that controlled subject only; do not assign motion or behavior to any other visible subject.",
].filter(Boolean).join("\n");

export const replaceSpatialScene = (
  manifest: SpatialManifest,
  sceneId: string,
  updater: (scene: SpatialSceneState) => SpatialSceneState,
): SpatialManifest => {
  const index = manifest.scenes.findIndex((scene) => scene.sceneId === sceneId);
  if (index < 0) return manifest;
  const nextScene = updater(manifest.scenes[index]);
  if (nextScene === manifest.scenes[index]) return manifest;
  const scenes = [...manifest.scenes];
  scenes[index] = nextScene;
  return { ...manifest, scenes };
};

/**
 * Returns the selected node and every node reachable in the forward direction.
 * The connection graph is the spatial source of truth; UI order and map
 * coordinates deliberately have no part in deciding what is downstream.
 */
export const findSpatialNodeThread = (
  scene: SpatialSceneState,
  nodeId: string,
): Set<string> => {
  const existingNodeIds = new Set(scene.nodes.map((node) => node.id));
  if (!existingNodeIds.has(nodeId)) return new Set();

  const thread = new Set<string>([nodeId]);
  const pending = [nodeId];
  while (pending.length) {
    const sourceNodeId = pending.shift()!;
    for (const connection of scene.connections) {
      if (connection.sourceNodeId !== sourceNodeId) continue;
      if (!existingNodeIds.has(connection.targetNodeId) || thread.has(connection.targetNodeId)) continue;
      thread.add(connection.targetNodeId);
      pending.push(connection.targetNodeId);
    }
  }
  return thread;
};

/**
 * Cuts a node and its forward thread. The root is never deleted: cutting it
 * resets the whole stage back to its original registration point.
 */
export const cutSpatialNodeThread = (
  scene: SpatialSceneState,
  nodeId: string,
): SpatialNodeCutResult | null => {
  if (authoringLocked(scene.ledger)) return null;
  const rootNode = scene.nodes[0];
  if (!rootNode || !scene.nodes.some((node) => node.id === nodeId)) return null;

  const selectedIsRoot = nodeId === rootNode.id;
  const removedNodeIds = findSpatialNodeThread(scene, nodeId);
  if (selectedIsRoot) {
    // A stage reset is a recovery boundary as well as a normal graph cut.
    // Remove disconnected/restored orphan nodes too, leaving one valid root.
    removedNodeIds.clear();
    for (const node of scene.nodes) {
      if (node.id !== rootNode.id) removedNodeIds.add(node.id);
    }
  }

  const incomingConnection = selectedIsRoot
    ? null
    : scene.connections.find((connection) => connection.targetNodeId === nodeId) || null;
  const nextActiveNodeId = incomingConnection?.sourceNodeId || rootNode.id;
  const removedConnectionIds = scene.connections
    .filter((connection) => selectedIsRoot
      || removedNodeIds.has(connection.sourceNodeId)
      || removedNodeIds.has(connection.targetNodeId))
    .map((connection) => connection.id);
  const removedConnectionIdSet = new Set(removedConnectionIds);
  const remainingConnections = scene.connections.filter((connection) => !removedConnectionIdSet.has(connection.id));
  // A pending Storybook base can become spatial truth only when no surviving
  // video still depends on the old root. Resetting Start always satisfies this;
  // deleting the final leaf connection does too.
  const shouldAdoptPendingRoot = Boolean(
    scene.pendingRootFrameUrl && (selectedIsRoot || remainingConnections.length === 0)
  );

  return {
    scene: {
      ...scene,
      activeNodeId: scene.nodes.some((node) => node.id === nextActiveNodeId && !removedNodeIds.has(node.id))
        ? nextActiveNodeId
        : rootNode.id,
      nodes: scene.nodes
        .filter((node) => !removedNodeIds.has(node.id))
        .map(node => node.actionBacktrack && removedNodeIds.has(node.actionBacktrack.targetNodeId) ? {...node, actionBacktrack: undefined} : node)
        .map((node) => selectedIsRoot ? { ...node, actionLink: undefined, actionBacktrack: undefined } : node)
        .map((node) => shouldAdoptPendingRoot && node.id === rootNode.id && scene.pendingRootFrameUrl
          ? { ...node, frameUrl: scene.pendingRootFrameUrl }
          : node),
      connections: remainingConnections,
      ledger: scene.ledger ? { ...scene.ledger,
        draft: undefined,
        routes: Object.fromEntries(Object.entries(scene.ledger.routes).filter(([id]) => !removedConnectionIdSet.has(id))),
        states: Object.fromEntries(Object.entries(scene.ledger.states).filter(([id]) => !removedNodeIds.has(id))),
        ...(scene.ledger.actionAudioReferences ? { actionAudioReferences: Object.fromEntries(Object.entries(scene.ledger.actionAudioReferences).filter(([id]) => !removedNodeIds.has(id))) } : {}),
      } : undefined,
      draftMovement: null,
      pendingRootFrameUrl: shouldAdoptPendingRoot ? undefined : scene.pendingRootFrameUrl,
    },
    removedNodeIds: [...removedNodeIds],
    removedConnectionIds,
  };
};

export const beginSpatialConnection = (scene: SpatialSceneState): { scene: SpatialSceneState; connection: SpatialConnection } | null => {
  const draft = scene.draftMovement;
  if (!draft || scene.connections.length >= MAX_SPATIAL_CONNECTIONS_PER_SCENE) return null;
  const targetNodeId = makeId(`${scene.sceneId}:node`);
  const connection: SpatialConnection = {
    id: makeId(`${scene.sceneId}:connection`),
    sourceNodeId: draft.sourceNodeId,
    targetNodeId,
    kind: "movement",
    movement: draft,
    forward: null,
    backward: null,
    status: "generating-forward",
  };
  return {
    connection,
    scene: { ...scene, connections: [...scene.connections, connection], draftMovement: null },
  };
};

export const beginSpatialActionConnection = (
  scene: SpatialSceneState,
  actionPrompt: string,
  createdAt = Date.now(),
): { scene: SpatialSceneState; connection: SpatialConnection } | null => {
  const prompt = String(actionPrompt || "").trim();
  if (!prompt || !scene.activeNodeId || scene.connections.length >= MAX_SPATIAL_CONNECTIONS_PER_SCENE
    || scene.nodes.find(node => node.id === scene.activeNodeId)?.actionBacktrack
    || scene.nodes.find(node => node.id === scene.activeNodeId)?.actionLink
    || scene.connections.some(edge => edge.kind === "action" && edge.sourceNodeId === scene.activeNodeId)) return null;
  const targetNodeId = makeId(`${scene.sceneId}:action-node`);
  const outgoingActionIndex = scene.connections.filter((connection) => (
    connection.sourceNodeId === scene.activeNodeId && connection.kind === "action"
  )).length;
  const side = outgoingActionIndex % 2 === 0 ? -1 : 1;
  const lane = Math.floor(outgoingActionIndex / 2);
  const movement: SpatialMovementDraft = {
    id: makeId("action"),
    sourceNodeId: scene.activeNodeId,
    createdAt,
    durationMs: 1,
    // Action placement is not joystick truth. The neutral sample preserves
    // the existing durable schema while traversal code ignores action edges.
    samples: [{ x: 0, y: 0, radius: 0, angle: 0, elapsedMs: 1 }],
  };
  const connection: SpatialConnection = {
    id: makeId(`${scene.sceneId}:action`),
    sourceNodeId: scene.activeNodeId,
    targetNodeId,
    kind: "action",
    movement,
    actionPrompt: prompt,
    actionMapOffset: { x: side * (42 + lane * 18), y: -(54 + lane * 12) },
    forward: null,
    backward: null,
    status: "generating-forward",
  };
  return {
    connection,
    scene: { ...scene, connections: [...scene.connections, connection], draftMovement: null },
  };
};

export const findSpatialTraversalToNode = (
  scene: SpatialSceneState,
  destinationNodeId: string,
): SpatialTraversal | null => {
  if (!destinationNodeId || destinationNodeId === scene.activeNodeId) return null;

  for (const connection of scene.connections) {
    if (connection.sourceNodeId === scene.activeNodeId
      && connection.targetNodeId === destinationNodeId
      && connection.forward) {
      return { connection, direction: "forward", destinationNodeId, video: connection.forward };
    }
    if (connection.targetNodeId === scene.activeNodeId
      && connection.sourceNodeId === destinationNodeId
      && (connection.backward || connection.forward)) {
      return { connection, direction: "backward", destinationNodeId, video: connection.backward || connection.forward! };
    }
  }
  return null;
};

/** Retry only a failed movement touching this node, never an unrelated branch or action. */
export const findSpatialFailedReturn = (scene: SpatialSceneState): SpatialConnection | null => (
  [...scene.connections].reverse().find((connection) => (
    connection.kind !== "action"
    && (connection.sourceNodeId === scene.activeNodeId || connection.targetNodeId === scene.activeNodeId)
    && connection.status === "failed"
    && connection.forward?.provider === "api"
    && !connection.backward
  )) || null
);

/** Return the immediate graph parent used by explicit Back navigation. */
export const findSpatialParentNodeId = (
  scene: SpatialSceneState,
  nodeId = scene.activeNodeId,
): string | null => {
  if (!nodeId || nodeId === scene.nodes[0]?.id) return null;
  const incoming = [...scene.connections].reverse().find((connection) => (
    connection.targetNodeId === nodeId
    && scene.nodes.some((node) => node.id === connection.sourceNodeId)
  ));
  return incoming?.sourceNodeId || null;
};

export const findSpatialTraversalForMovement = (
  scene: SpatialSceneState,
  movement: SpatialMovementDraft,
  minimumAlignment = 0.72,
): SpatialTraversal | null => {
  const requested = movement.samples[movement.samples.length - 1];
  const requestedLength = Math.hypot(requested?.x || 0, requested?.y || 0);
  if (!requested || requestedLength < 0.08) return null;

  let best: { traversal: SpatialTraversal; alignment: number } | null = null;
  for (const connection of scene.connections) {
    if (connection.kind === "action") continue;
    const recorded = connection.movement.samples[connection.movement.samples.length - 1];
    const recordedLength = Math.hypot(recorded?.x || 0, recorded?.y || 0);
    if (!recorded || recordedLength < 0.08) continue;

    let traversal: SpatialTraversal | null = null;
    let directionSign = 1;
    if (connection.sourceNodeId === scene.activeNodeId && connection.forward) {
      traversal = {
        connection,
        direction: "forward",
        destinationNodeId: connection.targetNodeId,
        video: connection.forward,
      };
    } else if (connection.targetNodeId === scene.activeNodeId && (connection.backward || connection.forward)) {
      directionSign = -1;
      traversal = {
        connection,
        direction: "backward",
        destinationNodeId: connection.sourceNodeId,
        video: connection.backward || connection.forward!,
      };
    }
    if (!traversal) continue;

    const alignment = (
      requested.x * recorded.x * directionSign
      + requested.y * recorded.y * directionSign
    ) / (requestedLength * recordedLength);
    if (alignment >= minimumAlignment && (!best || alignment > best.alignment)) {
      best = { traversal, alignment };
    }
  }
  return best?.traversal || null;
};

export const setSpatialActionLink = (scene: SpatialSceneState, nodeId: string, link: SpatialSceneLink): SpatialSceneState => {
  if (!scene.nodes.some(node => node.id === nodeId) || scene.connections.some(edge => edge.kind === "action" && edge.sourceNodeId === nodeId)) return scene;
  return { ...scene, draftMovement: null, nodes: scene.nodes.map(node => node.id === nodeId && !node.actionLink && !node.actionBacktrack ? { ...node, actionLink: link } : node) };
};

/** Resolve durable link identity to today's native array indices, independent of editor mode. */
export const resolveSpatialSceneLink = (link: SpatialSceneLink, scenes: SpatialSceneState[], bShotIdentities: string[][]) => {
  const sceneIndex = scenes.findIndex(scene => scene.sceneId === link.sceneId);
  if (sceneIndex < 0) return null;
  if (link.bShotIndex === undefined) return { sceneIndex, bShotIndex: null };
  const matches = (bShotIdentities[sceneIndex] || []).flatMap((identity, index) => sameSpatialSceneLink(link, { sceneId: link.sceneId, bShotIndex: index, bShotIdentity: identity }) ? [index] : []);
  return matches.length === 1 ? { sceneIndex, bShotIndex: matches[0] } : null;
};

/** Backtrack belongs to one Action slot and never creates a video or changes graph ancestry. */
export const setSpatialActionBacktrack = (scene: SpatialSceneState, nodeId: string, targetNodeId: string): SpatialSceneState => {
  if (nodeId === targetNodeId || !scene.nodes.some(node => node.id === targetNodeId)
    || !scene.nodes.some(node => node.id === nodeId && !node.actionLink && !node.actionBacktrack)
    || scene.connections.some(edge => edge.kind === "action" && edge.sourceNodeId === nodeId)) return scene;
  return { ...scene, draftMovement: null, nodes: scene.nodes.map(node => node.id === nodeId ? {...node, actionBacktrack: {targetNodeId}} : node) };
};

/** Clear only navigation from the action slot, preserving videos, nodes and spatial context. */
export const clearSpatialActionNavigation = (scene: SpatialSceneState, nodeId: string): SpatialSceneState => {
  if (!scene.nodes.some(node => node.id === nodeId && (node.actionLink || node.actionBacktrack))) return scene;
  return { ...scene, nodes: scene.nodes.map(node => node.id === nodeId
    ? { ...node, actionLink: undefined, actionBacktrack: undefined } : node) };
};
