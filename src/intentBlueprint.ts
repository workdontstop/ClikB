import type { SceneTarget } from "./sceneTargetArchitecture";

import type { ImagePromptPacing } from './imagePromptPacing';

export const INTENT_BLUEPRINT_SCHEMA_VERSION = 1 as const;

export type IntentMode = "shorts" | "cinema" | "interactive";
export type IntentSyncStatus = "ready" | "syncing" | "failed";
export type IntentSceneKind =
  | "shorts-scene"
  | "cinema-stage"
  | "interactive-node";
export type IntentDerivedFrom = "initial-compile" | "image-prompt-edit";

export type IntentAuditIssue = {
  code: string;
  message: string;
  sceneId?: string;
  factKey?: string;
};

export type IntentAudit = {
  status: "valid" | "warning" | "invalid";
  issues: IntentAuditIssue[];
};

export type DynamicFactValue = string | number | boolean | string[];

export type GlobalIntentFact = {
  key: string;
  label?: string;
  value: DynamicFactValue;
  description?: string;
  confidence: "high" | "medium" | "low";
};

export type SceneIntentFact = GlobalIntentFact & {
  depiction: "depicted" | "implied" | "off-screen";
  continuityDerived: boolean;
};

export type DynamicEntity<TFact extends GlobalIntentFact = SceneIntentFact> = {
  key: string;
  name: string;
  canonRef?: string;
  role?: string;
  facts: TFact[];
};

export type DynamicDirective = {
  key: string;
  instruction: string;
  priority: "required" | "preferred" | "optional";
};

export type InteractionOpportunity = {
  subject: string;
  possibleInput: string;
  intendedResponse?: string;
  visualAffordance?: string;
};

export type IntentModeProfile =
  | {
      kind: "shorts";
      hook: string;
      payoff: string;
      beatMap: GlobalIntentFact[];
      loopIntent?: string;
    }
  | {
      kind: "cinema";
      narrativeArc: string;
      actStructure: GlobalIntentFact[];
      toneProgression?: string[];
      pacingNotes?: string[];
    }
  | {
      kind: "interactive";
      experienceKind: string;
      userRole: string;
      userObjective?: string;
      interfaceLanguage: GlobalIntentFact[];
      progressionModel: string;
      terminalConditions?: GlobalIntentFact[];
    };

export type GlobalIntentBlueprint = {
  /** Short evocative name for the creation. Written for the user to read. */
  title: string;
  /**
   * Two or three sentences describing what is being created, written for the
   * user rather than for a model. Intended for the waiting screen while images
   * generate, so the box is never blank.
   */
  overview: string;
  experienceType: string;
  premise: string;
  userGoal: string;
  audienceExpectation: string;
  canon: {
    characters: DynamicEntity<GlobalIntentFact>[];
    locations: DynamicEntity<GlobalIntentFact>[];
    props: DynamicEntity<GlobalIntentFact>[];
    worldRules: GlobalIntentFact[];
  };
  visualLanguage: {
    artStyle: string;
    paletteNotes?: string;
    cameraLanguage?: string[];
    recurringMotifs?: string[];
  };
  globalMustPreserve: string[];
  globalMustAvoid: string[];
  modeProfile: IntentModeProfile;
  audit: IntentAudit;
};

export type InteractiveNodeMeta = {
  declaredNodeId?: string;
  parentNodeId?: string;
  branchLabel?: string;
  role: string;
  branchingContext?: string;
  sourcePrefix?: string;
};

export type SceneIntentBlueprintBase = {
  /** Original scene conception plus the derived render prompt; persisted with this scene. */
  imagePacing?: ImagePromptPacing;
  /** Historical context remains useful to later image edits after a new canonical prompt. */
  imagePacingContext?: ImagePromptPacing;
  lastEditInstruction?: string;
  sceneId: string;
  mode: IntentMode;
  kind: IntentSceneKind;
  revision: number;
  sourceContextHash: string;
  boundImagePromptHash: string | null;
  syncStatus: IntentSyncStatus;
  derivedFrom: IntentDerivedFrom;
  /**
   * The whole payload: one passage of prose describing what is in this scene,
   * what it means, and what the viewer should take from it. Never parsed — it
   * is handed to the image and video prompt writers as context.
   */
  text: string;
};

export type ShortsSceneIntentBlueprint = SceneIntentBlueprintBase & {
  kind: "shorts-scene";
  mode: "shorts";
};

export type CinemaStageIntentBlueprint = SceneIntentBlueprintBase & {
  kind: "cinema-stage";
  mode: "cinema";
  logicalSceneId: string;
  stage: "A" | "B";
};

export type InteractiveNodeIntentBlueprint = SceneIntentBlueprintBase & {
  kind: "interactive-node";
  mode: "interactive";
  node: InteractiveNodeMeta;
};

export type SceneIntentBlueprint =
  | ShortsSceneIntentBlueprint
  | CinemaStageIntentBlueprint
  | InteractiveNodeIntentBlueprint;

export type CinemaLogicalSceneStructure = {
  logicalSceneId: string;
  orderIndex: number;
  stageAId: string;
  stageBId: string;
  sharedPurpose: string;
  cinematicCoverageIntent: string;
};

export type IntentModeStructure =
  | { kind: "shorts" }
  | {
      kind: "cinema";
      logicalSceneOrder: string[];
      logicalScenes: Record<string, CinemaLogicalSceneStructure>;
    }
  | { kind: "interactive" };

export type IntentBlueprintBundle = {
  schemaVersion: typeof INTENT_BLUEPRINT_SCHEMA_VERSION;
  blueprintId: string;
  revision: number;
  mode: IntentMode;
  sourceContextHash: string;
  global: GlobalIntentBlueprint;
  modeStructure: IntentModeStructure;
  sceneOrder: string[];
  scenes: Record<string, SceneIntentBlueprint>;
  audit: IntentAudit;
};

export type IntentSceneBinding = {
  sceneId: string;
  orderIndex: number;
  logicalSceneId?: string;
  stage?: "A" | "B";
};

export type IntentCompileSceneInput = IntentSceneBinding & {
  text: string;
};

export type IntentCompileRequest = {
  blueprintId: string;
  mode: IntentMode;
  creationType: number;
  artStyle: string;
  scenes: IntentCompileSceneInput[];
  planx: unknown;
  characters?: unknown;
  referenceNotes?: string[];
  sourceContextHash: string;
};

export type IntentReconcileRequest = {
  blueprintId: string;
  sceneId: string;
  mode: IntentMode;
  previousSceneBlueprint: SceneIntentBlueprint;
  previousImagePrompt: string;
  committedImagePrompt: string;
  editInstruction: string;
  expectedSceneRevision: number;
  expectedPromptHash: string;
  committedPromptHash: string;
};

const normalizeForStableJson = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeForStableJson);
  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    return Object.keys(objectValue)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        const nextValue = objectValue[key];
        if (nextValue !== undefined) {
          result[key] = normalizeForStableJson(nextValue);
        }
        return result;
      }, {});
  }
  return value;
};

export const stableStringify = (value: unknown): string =>
  JSON.stringify(normalizeForStableJson(value));

export const hashIntentValue = (value: unknown): string => {
  const text = typeof value === "string" ? value : stableStringify(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `intent-v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
};

export const createIntentId = (prefix: string): string => {
  const randomId =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomId}`;
};

export const creationTypeToIntentMode = (creationType: number): IntentMode => {
  if (creationType === 1) return "cinema";
  if (creationType === 3) return "interactive";
  return "shorts";
};

export const createIntentSceneBindings = (
  sceneCount: number,
  creationType: number
): IntentSceneBinding[] => {
  const mode = creationTypeToIntentMode(creationType);
  if (mode !== "cinema") {
    return Array.from({ length: sceneCount }, (_, orderIndex) => ({
      sceneId: createIntentId(mode === "interactive" ? "node" : "scene"),
      orderIndex,
    }));
  }

  const bindings: IntentSceneBinding[] = [];
  for (let rawIndex = 0; rawIndex < sceneCount; rawIndex += 2) {
    const logicalSceneId = createIntentId("cinema-scene");
    bindings.push({
      sceneId: createIntentId("cinema-stage-a"),
      orderIndex: rawIndex,
      logicalSceneId,
      stage: "A",
    });
    if (rawIndex + 1 < sceneCount) {
      bindings.push({
        sceneId: createIntentId("cinema-stage-b"),
        orderIndex: rawIndex + 1,
        logicalSceneId,
        stage: "B",
      });
    }
  }
  return bindings;
};

export const intentSceneBindingsFromBundle = (
  bundle: IntentBlueprintBundle
): IntentSceneBinding[] =>
  bundle.sceneOrder.map((sceneId, orderIndex) => {
    const scene = bundle.scenes[sceneId];
    if (scene?.kind === "cinema-stage") {
      return {
        sceneId,
        orderIndex,
        logicalSceneId: scene.logicalSceneId,
        stage: scene.stage,
      };
    }
    return { sceneId, orderIndex };
  });

export const resolveIntentBinding = (
  target: SceneTarget,
  bindings: IntentSceneBinding[]
): IntentSceneBinding | null => {
  // Editor B-shots deliberately have no intent blueprint. Cinema Stage B is an
  // A-target at an odd raw index and therefore still resolves normally here.
  if (target.type === "B") return null;
  return bindings[target.index] ?? null;
};

export const resolveSceneIntent = (
  target: SceneTarget,
  bindings: IntentSceneBinding[],
  bundle: IntentBlueprintBundle | null
): SceneIntentBlueprint | null => {
  const binding = resolveIntentBinding(target, bindings);
  return binding && bundle ? bundle.scenes[binding.sceneId] ?? null : null;
};

export const bindSceneIntentToImagePrompt = (
  bundle: IntentBlueprintBundle,
  sceneId: string,
  imagePrompt: string,
  imagePacing?: ImagePromptPacing
): IntentBlueprintBundle => {
  const scene = bundle.scenes[sceneId];
  if (!scene) return bundle;
  const promptHash = hashIntentValue(imagePrompt);
  if (
    scene.boundImagePromptHash === promptHash &&
    scene.syncStatus === "ready" && (!imagePacing || scene.imagePacing === imagePacing)
  ) {
    return bundle;
  }
  return {
    ...bundle,
    revision: bundle.revision + 1,
    scenes: {
      ...bundle.scenes,
      [sceneId]: {
        ...scene,
        imagePacing: imagePacing ?? scene.imagePacing ?? scene.imagePacingContext,
        boundImagePromptHash: promptHash,
        syncStatus: "ready",
      },
    },
  };
};

export const sceneIntentMatchesPrompt = (
  scene: SceneIntentBlueprint | null,
  imagePrompt: string
): boolean =>
  Boolean(
    scene &&
      scene.syncStatus === "ready" &&
      scene.boundImagePromptHash === hashIntentValue(imagePrompt)
  );

export const parseIntentBlueprintBundle = (
  value: unknown
): IntentBlueprintBundle | null => {
  let candidate = value;
  if (typeof candidate === "string") {
    if (!candidate.trim()) return null;
    try {
      candidate = JSON.parse(candidate) as unknown;
    } catch {
      return null;
    }
  }
  if (!candidate || typeof candidate !== "object") return null;
  const record = candidate as Partial<IntentBlueprintBundle>;
  if (
    record.schemaVersion !== INTENT_BLUEPRINT_SCHEMA_VERSION ||
    typeof record.blueprintId !== "string" ||
    !Array.isArray(record.sceneOrder) ||
    !record.scenes ||
    typeof record.scenes !== "object"
  ) {
    return null;
  }
  return candidate as IntentBlueprintBundle;
};
