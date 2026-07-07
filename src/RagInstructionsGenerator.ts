export type RagPrimitive = string | number | boolean | null;

export type RagJsonValue =
  | RagPrimitive
  | RagJsonValue[]
  | { [key: string]: RagJsonValue | undefined };

export type RagSnapshotAction = {
  type: string;
  label?: string;
  target?: string;
  tagName?: string;
  route?: string;
  timestamp?: number;
};

export type RagSnapshotExample = {
  sourceLog: string;
  route: string;
  pageName: string;
  device?: "mobile" | "desktop" | string;
  loggedUserName?: string;
  app?: {
    prompt?: string;
    promptLength?: number;
    artstyle?: string;
    model?: string;
    aspectRatio?: number;
  };
  ui?: {
    isMenuOpen?: boolean;
    minimisePrompt?: boolean;
    isBrainstormChatOpen?: boolean;
  };
  lastAction?: RagSnapshotAction;
  recentActions?: RagSnapshotAction[];
};

export type RagSourceEvidence = {
  sourceFile: string;
  routeMatches?: string[];
  pageNames?: string[];
  featureNames?: string[];
  notes?: string;
};

export type RagInstructionMetadataInput = {
  docId?: string;
  sourceName?: string;
  sourceType?: string;
  namespace?: string;
  version?: number;
  searchKeys?: string[];
};

export type RagInstructionMetadata = {
  docId: string;
  sourceType: string;
  sourceName: string;
  namespace?: string;
  version: number;
  vectorIdPrefix: string;
  chunkIdPattern: string;
  deleteFilter: {
    docId: string;
  };
  searchKeys: string[];
};

export type RagSnapshotSignal = {
  routeMatches?: string[];
  pageNames?: string[];
  lastActionTypes?: string[];
  lastActionLabels?: string[];
  tagNames?: string[];
  appFields?: string[];
  uiFields?: string[];
  notes?: string;
};

export type RagUiControl = {
  id: string;
  visibleLabel: string;
  alsoSeenAs?: string[];
  controlType?: string;
  routeMatches?: string[];
  pageNames?: string[];
  pipelineStage?: string;
  sourceFile: string;
  sourceSymbol?: string;
  appearsWhen?: string;
  userSees?: string;
  userIntent?: string;
  systemAction: string;
  resultingState?: string;
  snapshotSignal?: RagSnapshotSignal;
};

export type RagPipelineStage = {
  id: string;
  name: string;
  routeMatches?: string[];
  pageNames?: string[];
  controlIds?: string[];
  userGoal: string;
  systemResult: string;
};

export type RagInstructionInput = {
  id: string;
  topic: string;
  featureDescription: string;
  metadata?: RagInstructionMetadataInput;
  routeMatches?: string[];
  pageNames?: string[];
  featureNames?: string[];
  sourceFiles?: string[];
  pipelineStages?: RagPipelineStage[];
  uiControls?: RagUiControl[];
  sourceEvidence?: RagSourceEvidence[];
  snapshotExample?: RagSnapshotExample;
  extra?: Record<string, RagJsonValue | undefined>;
};

export type RagInstructionPacket = {
  id: string;
  label: string;
  topic: string;
  metadata: RagInstructionMetadata;
  routeMatches: string[];
  pageNames: string[];
  featureNames: string[];
  sourceFiles: string[];
  understanding: string;
  pipelineStages: RagPipelineStage[];
  uiControls: RagUiControl[];
  snapshotExample?: RagSnapshotExample;
  sourceEvidence: RagSourceEvidence[];
  extra?: Record<string, RagJsonValue | undefined>;
};

const RAG_LABEL_PREFIX = "[RAG clikbKnowledge]";

const unique = (values: Array<string | undefined>): string[] => {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
};

const normalizeId = (id: string): string => {
  return String(id || "rag_chunk")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "rag_chunk";
};

const normalizeVersion = (version?: number): number => {
  if (!Number.isFinite(version) || !version || version < 1) return 1;
  return Math.floor(version);
};

const collectEvidenceValues = (
  evidence: RagSourceEvidence[] | undefined,
  key: "routeMatches" | "pageNames" | "featureNames"
): string[] => {
  if (!evidence?.length) return [];
  return evidence.flatMap((item) => item[key] || []);
};

const collectControlValues = (
  controls: RagUiControl[] | undefined,
  key: "routeMatches" | "pageNames"
): string[] => {
  if (!controls?.length) return [];
  return controls.flatMap((item) => item[key] || []);
};

const collectPipelineValues = (
  stages: RagPipelineStage[] | undefined,
  key: "routeMatches" | "pageNames"
): string[] => {
  if (!stages?.length) return [];
  return stages.flatMap((item) => item[key] || []);
};

const trimVolatileSnapshotAction = (action?: RagSnapshotAction): RagSnapshotAction | undefined => {
  if (!action) return undefined;
  return {
    type: action.type,
    label: action.label,
    target: action.target,
    tagName: action.tagName,
    route: action.route,
  };
};

const normalizeSnapshotExample = (snapshot?: RagSnapshotExample): RagSnapshotExample | undefined => {
  if (!snapshot) return undefined;
  return {
    sourceLog: snapshot.sourceLog,
    route: snapshot.route,
    pageName: snapshot.pageName,
    device: snapshot.device,
    loggedUserName: snapshot.loggedUserName,
    app: snapshot.app,
    ui: snapshot.ui,
    lastAction: trimVolatileSnapshotAction(snapshot.lastAction),
    recentActions: snapshot.recentActions?.map(trimVolatileSnapshotAction).filter(Boolean) as RagSnapshotAction[] | undefined,
  };
};

const buildInstructionMetadata = (
  input: RagInstructionInput,
  id: string,
  routeMatches: string[],
  pageNames: string[],
  featureNames: string[],
  sourceFiles: string[]
): RagInstructionMetadata => {
  const metadata = input.metadata || {};
  const docId = normalizeId(metadata.docId || id);
  const sourceType = metadata.sourceType?.trim() || "clikb-base-rag";
  const sourceName = metadata.sourceName?.trim() || `${docId}.rag.txt`;
  const version = normalizeVersion(metadata.version);
  const vectorIdPrefix = `${docId}::chunk`;
  const searchKeys = unique([
    docId,
    id,
    input.topic,
    ...routeMatches,
    ...pageNames,
    ...featureNames,
    ...sourceFiles,
    ...(metadata.searchKeys || []),
  ]);

  return {
    docId,
    sourceType,
    sourceName,
    namespace: metadata.namespace,
    version,
    vectorIdPrefix,
    chunkIdPattern: `${vectorIdPrefix}-0001`,
    deleteFilter: {
      docId,
    },
    searchKeys,
  };
};

export const generateRagInstruction = (input: RagInstructionInput): RagInstructionPacket => {
  const sourceEvidence = input.sourceEvidence || [];
  const pipelineStages = input.pipelineStages || [];
  const uiControls = input.uiControls || [];
  const snapshotExample = normalizeSnapshotExample(input.snapshotExample);
  const routeMatches = unique([
    ...(input.routeMatches || []),
    ...collectEvidenceValues(sourceEvidence, "routeMatches"),
    ...collectPipelineValues(pipelineStages, "routeMatches"),
    ...collectControlValues(uiControls, "routeMatches"),
    snapshotExample?.route,
  ]);

  const pageNames = unique([
    ...(input.pageNames || []),
    ...collectEvidenceValues(sourceEvidence, "pageNames"),
    ...collectPipelineValues(pipelineStages, "pageNames"),
    ...collectControlValues(uiControls, "pageNames"),
    snapshotExample?.pageName,
  ]);

  const featureNames = unique([
    ...(input.featureNames || []),
    ...collectEvidenceValues(sourceEvidence, "featureNames"),
    ...pipelineStages.map((stage) => stage.name),
    ...uiControls.map((control) => control.visibleLabel),
  ]);

  const sourceFiles = unique([
    ...(input.sourceFiles || []),
    ...sourceEvidence.map((item) => item.sourceFile),
    ...uiControls.map((control) => control.sourceFile),
  ]);

  const id = normalizeId(input.id);
  const metadata = buildInstructionMetadata(input, id, routeMatches, pageNames, featureNames, sourceFiles);
  return {
    id,
    label: `${RAG_LABEL_PREFIX} ${id} Object`,
    topic: input.topic.trim(),
    metadata,
    routeMatches,
    pageNames,
    featureNames,
    sourceFiles,
    understanding: input.featureDescription.trim(),
    pipelineStages,
    uiControls,
    snapshotExample,
    sourceEvidence,
    extra: input.extra,
  };
};

const formatStringArray = (values: string[]): string => {
  if (!values.length) return "[]";
  return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
};

const formatObject = (value: RagJsonValue | undefined, indentLevel = 1): string => {
  const indent = "  ".repeat(indentLevel);
  const childIndent = "  ".repeat(indentLevel + 1);

  if (value === undefined) return "undefined";
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    if (!value.length) return "[]";
    const items = value.map((item) => `${childIndent}${formatObject(item, indentLevel + 1)}`);
    return `[\n${items.join(",\n")}\n${indent}]`;
  }

  const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined);
  if (!entries.length) return "{}";

  const lines = entries.map(([key, entryValue]) => {
    return `${childIndent}${key}: ${formatObject(entryValue as RagJsonValue, indentLevel + 1)}`;
  });

  return `{\n${lines.join(",\n")}\n${indent}}`;
};

export const formatRagInstruction = (packet: RagInstructionPacket): string => {
  const lines = [
    `${packet.label} {`,
    `  topic: ${JSON.stringify(packet.topic)},`,
    `  metadata: ${formatObject(packet.metadata as unknown as RagJsonValue, 1)},`,
    `  routeMatches: ${formatStringArray(packet.routeMatches)},`,
    `  pageNames: ${formatStringArray(packet.pageNames)},`,
    `  featureNames: ${formatStringArray(packet.featureNames)},`,
    `  sourceFiles: ${formatStringArray(packet.sourceFiles)},`,
    `  understanding: ${JSON.stringify(packet.understanding)},`,
  ];

  if (packet.pipelineStages.length) {
    lines.push(`  pipelineStages: ${formatObject(packet.pipelineStages as unknown as RagJsonValue, 1)},`);
  }

  if (packet.uiControls.length) {
    lines.push(`  uiControls: ${formatObject(packet.uiControls as unknown as RagJsonValue, 1)},`);
  }

  if (packet.snapshotExample) {
    lines.push(`  snapshotExample: ${formatObject(packet.snapshotExample as unknown as RagJsonValue, 1)},`);
  }

  if (packet.sourceEvidence.length) {
    lines.push(`  sourceEvidence: ${formatObject(packet.sourceEvidence as unknown as RagJsonValue, 1)},`);
  }

  if (packet.extra && Object.values(packet.extra).some((value) => value !== undefined)) {
    lines.push(`  extra: ${formatObject(packet.extra, 1)},`);
  }

  lines.push("}");
  return lines.join("\n");
};

export const createRagInstruction = (input: RagInstructionInput): string => {
  return formatRagInstruction(generateRagInstruction(input));
};

export const createRagSourceChecklist = (input: RagInstructionInput): string[] => {
  const packet = generateRagInstruction(input);
  return unique([
    ...packet.routeMatches.map((route) => `Verify route ${route} in App routing and navigation files.`),
    ...packet.pageNames.map((pageName) => `Verify pageName ${pageName} appears in snapshot mapping or user-facing mode labels.`),
    ...packet.featureNames.map((featureName) => `Verify feature ${featureName} in the matching component or backend route.`),
    ...packet.sourceFiles.map((sourceFile) => `Read ${sourceFile} before finalizing this RAG packet.`),
    ...packet.pipelineStages.map((stage) => `Verify pipeline stage "${stage.name}" against route and UI behavior.`),
    ...packet.uiControls.map((control) => `Verify UI control "${control.visibleLabel}" in ${control.sourceFile}.`),
  ]);
};
