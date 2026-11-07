/** JSON-only creation state, shared by the browser coordinator and the server. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type DraftSection = Record<string, JsonValue>;
export type DraftSectionName = 'prompt' | 'storybook' | 'editor' | 'publication';
export interface DraftSnapshot {
  schemaVersion: 1;
  creationProjectId: string;
  creationType: 0 | 1 | 3;
  sections: Partial<Record<DraftSectionName, DraftSection>>;
}
export interface DraftRecord {
  postId: number;
  draftId: string;
  revision: number;
  digest: string;
  snapshot: DraftSnapshot;
  published: boolean;
  imageProjectionDigest?: string | null;
}
export interface DraftCheckpointRequest {
  creationProjectId: string;
  postId?: number;
  saveId: string;
  expectedRevision: number;
  snapshot: DraftSnapshot;
  action: 'images' | 'quiet' | 'publish';
  projection?: Record<string, JsonValue>;
}
export interface DraftCapabilities {
  postId: number;
  isDraft: boolean;
  draftReady: boolean;
  owner: boolean;
  ownerId?: string;
  creationType?: 0 | 1 | 3;
  allowRemix: boolean;
  canResume: boolean;
  canRemix: boolean;
  canToggleRemix: boolean;
}

const unsafeKeys = new Set(['__proto__', 'constructor', 'prototype']);
const excludedKeys = new Set([
  'referenceVideoUrls', 'referenceVideoActiveList', 'bShotReferenceVideoUrls', 'bShotReferenceVideoActiveList',
  'isGenerating', 'isUpscaling', 'isUploading', 'queuedCastingPrompts',
  'spatialManifest', 'spatialMotionContexts', 'bShotSpatialScenes', 'bShotSpatialContexts',
  'liveDraft', 'pendingReplacement', 'resumeBody', 'providerJobId', 'authToken', 'accessToken',
  'referenceVideos', 'usedReferenceVideoUrl', 'referenceVideoUrl',
]);

/** Strip runtime-only media and excluded orchestration from the JSON boundary. */
export function draftJson(value: unknown, depth = 0): JsonValue | undefined {
  if (depth > 64) throw new Error('Draft nesting exceeds the supported limit.');
  if (value == null) return null;
  if (typeof value === 'string') return /^(?:blob:|data:)/i.test(value) ? null : value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(item => draftJson(item, depth + 1) ?? null);
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return undefined;
  const result: Record<string, JsonValue> = {};
  for (const [key, item] of Object.entries(value)) {
    if (unsafeKeys.has(key) || excludedKeys.has(key)) continue;
    const next = draftJson(item, depth + 1);
    if (next !== undefined) result[key] = next;
  }
  return result;
}

export function validateDraftSnapshot(input: unknown): DraftSnapshot {
  if (!input || typeof input !== 'object') throw new Error('A complete draft snapshot is required.');
  const value = input as any;
  if (value.schemaVersion !== 1) throw new Error('Unsupported creation draft version.');
  if (typeof value.creationProjectId !== 'string' || !/^[A-Za-z0-9:_-]{1,160}$/.test(value.creationProjectId)) throw new Error('Invalid creation identity.');
  if (![0, 1, 3].includes(value.creationType)) throw new Error('Invalid creation type.');
  if (!value.sections || typeof value.sections !== 'object' || Array.isArray(value.sections)) throw new Error('Draft sections are required.');
  const sections: DraftSnapshot['sections'] = {};
  for (const name of ['prompt', 'storybook', 'editor', 'publication'] as const) {
    if (value.sections[name] === undefined) continue;
    const section = draftJson(value.sections[name]);
    if (!section || Array.isArray(section) || typeof section !== 'object') throw new Error('Invalid draft section.');
    sections[name] = section;
  }
  if (value.creationType === 3 && sections.prompt?.interactionExperienceMode === 'spatial') {
    for (const key of ['VideoArray', 'VideoArrayCloud', 'videoHistory', 'savedVideoUpscales']) if (sections.storybook) delete sections.storybook[key];
    for (const key of ['sceneCloudVideos', 'bShotVideos']) if (sections.prompt) delete sections.prompt[key];
  }
  const result: DraftSnapshot = { schemaVersion: 1, creationProjectId: value.creationProjectId, creationType: value.creationType, sections };
  if (JSON.stringify(result).length > 8 * 1024 * 1024) throw new Error('Creation draft exceeds the supported size.');
  return result;
}

export function stableDraftJson(value: unknown): string {
  const sort = (item: any): any => Array.isArray(item) ? item.map(sort) : item && typeof item === 'object'
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, sort(item[key])])) : item;
  return JSON.stringify(sort(value));
}

/** Enumerate operational URLs, including JSON context saved inside legacy strings. */
export const DRAFT_MUSIC_FIELDS = new Set([
  'music',
  'musicUrl',
  'storyBgMusicUrl',
  'promptMusicUrl',
  'musicModeUrl',
  'appBgMusicUrl',
]);

export function draftMediaUrls(value: unknown): string[] {
  const urls = new Set<string>();
  const visit = (item: unknown, depth = 0) => {
    if (depth > 64 || item == null) return;
    if (typeof item === 'string') {
      if (/^https?:\/\//i.test(item)) urls.add(item);
      else if (/^[\[{]/.test(item.trim())) { try { visit(JSON.parse(item), depth + 1); } catch { /* Plain creative text. */ } }
    } else if (Array.isArray(item)) item.forEach(entry => visit(entry, depth + 1));
    else if (typeof item === 'object') Object.entries(item).forEach(([key, entry]) => {
      if (DRAFT_MUSIC_FIELDS.has(key)) return;
      if (/^https?:\/\//i.test(key)) visit(key, depth + 1);
      visit(entry, depth + 1);
    });
  };
  visit(value);
  return [...urls];
}

export function remapDraftMedia(value: unknown, mapping: ReadonlyMap<string, string>): JsonValue {
  if (typeof value === 'string') {
    if (mapping.has(value)) return mapping.get(value)!;
    if (/^[\[{]/.test(value.trim())) { try { return JSON.stringify(remapDraftMedia(JSON.parse(value), mapping)); } catch { /* Creative text. */ } }
    let text = value;
    for (const [source, target] of mapping) text = text.split(source).join(target);
    return text;
  }
  if (Array.isArray(value)) return value.map(item => remapDraftMedia(item, mapping));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [String(remapDraftMedia(key, mapping)), remapDraftMedia(item, mapping)]));
  return value as JsonValue;
}


/** Operational media must be independently copyable; creative website text is not media. */
export function operationalDraftMediaUrls(snapshot: DraftSnapshot): string[] {
  const fields = new Set(['imageUrl','videoUrl','audioUrl','sdUrl','hdUrl','sourceFrameUrl','sourceImageUrl','usedMotionVideoUrl',
    'ImagesHdCloud','generatedImagesFluxx','GeneratedImage','GeneratedImageFlux','nanoImages','referenceImages','Vipcharacters',
    'VideoArrayCloud','sceneCloudVideos','generatedAudios','generatedAudiosCloud','lipSyncAudioUrls','audioReferences',
    'bShotImages','bShotVideos','bShotNanoImages','imageReceipts','savedSceneImages','uploadedUrl','videoHistory','savedVideoUpscales',
    'actionImagesMap','activeActionImagesMap','motionImagesMap','activeMotionImagesMap','resultHistory']);
  const urls = new Set<string>();
  const visit = (value: any, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 64) return;
    for (const [key, item] of Object.entries(value)) {
      if (fields.has(key)) for (const url of draftMediaUrls(item)) urls.add(url);
      else visit(item, depth + 1);
    }
  };
  visit(snapshot.sections);
  return [...urls];
}
