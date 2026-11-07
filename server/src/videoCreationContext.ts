export type VideoCreationStage = 'A' | 'B';

export interface VideoCreationSceneContext {
  /** One-based logical scene number; Cinema A/B share this number. */
  scene: number;
  stage?: VideoCreationStage;
  instructions: string;
}

export interface VideoCreationContext {
  global?: string;
  scenes?: VideoCreationSceneContext[];
}

const record = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;

const sceneNumberValue = (value: unknown): number =>
  typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;

/** Validate the optional schema without shortening the user's directions. */
export const normalizeVideoCreationContext = (value: unknown): VideoCreationContext | undefined => {
  const source = record(value);
  if (!source) return undefined;
  const global = typeof source.global === 'string' ? source.global.trim() : '';
  const scenes: VideoCreationSceneContext[] = [];
  if (Array.isArray(source.scenes)) {
    for (const candidate of source.scenes) {
      const entry = record(candidate);
      if (!entry) continue;
      const scene = sceneNumberValue(entry.scene);
      const instructions = typeof entry.instructions === 'string' ? entry.instructions.trim() : '';
      if (!Number.isInteger(scene) || scene < 1 || !instructions) continue;
      const stage = entry.stage === 'A' || entry.stage === 'B' ? entry.stage : undefined;
      // An invalid stage must not accidentally become an instruction for both stages.
      if (entry.stage != null && entry.stage !== '' && !stage) continue;
      scenes.push({ scene, ...(stage ? { stage } : {}), instructions });
    }
  }
  if (!global && !scenes.length) return undefined;
  return { ...(global ? { global } : {}), ...(scenes.length ? { scenes } : {}) };
};

/** Image writers retain the existing plan, excluding only the video-only field. */
export const withoutVideoCreationContext = <T>(plan: T): T => {
  const source = record(plan);
  if (!source || !Object.prototype.hasOwnProperty.call(source, 'video_context')) return plan;
  const { video_context: _videoContext, ...visualPlan } = source;
  return visualPlan as T;
};

/** A saved video plan supplies creative guidance; the current request supplies clip timing. */
export const withoutVideoPlanTiming = <T>(plan: T): T => {
  const source = record(plan);
  if (!source) return plan;
  let changed = false;
  const result = { ...source };
  for (const key of ['camera', 'output'] as const) {
    const section = record(source[key]);
    if (!section || !Object.prototype.hasOwnProperty.call(section, 'duration_seconds')) continue;
    const { duration_seconds: _duration, ...guidance } = section;
    result[key] = guidance;
    changed = true;
  }
  if (Array.isArray(source.dialogue)) {
    let dialogueChanged = false;
    const dialogue = source.dialogue.map(value => {
      const entry = record(value);
      if (!entry || !Object.prototype.hasOwnProperty.call(entry, 'timecode_hint_sec')) return value;
      const { timecode_hint_sec: _timecode, ...speech } = entry;
      dialogueChanged = true;
      return speech;
    });
    if (dialogueChanged) {
      result.dialogue = dialogue;
      changed = true;
    }
  }
  return changed ? result as T : plan;
};

/** Select once-assigned directions instead of making every shot rediscover first speech. */
export const selectVideoCreationContext = (
  planOrContext: unknown,
  sceneNumber?: unknown,
  sceneStage?: unknown,
): VideoCreationContext | undefined => {
  const source = record(planOrContext);
  const context = normalizeVideoCreationContext(source && 'video_context' in source ? source.video_context : source);
  if (!context) return undefined;
  const scene = sceneNumberValue(sceneNumber);
  // Older saved creations have no shot metadata. Preserve their directions as context.
  if (!Number.isInteger(scene) || scene < 1) return context;
  const stage = sceneStage === 'A' || sceneStage === 'B' ? sceneStage : undefined;
  const scenes = context.scenes?.filter(entry =>
    entry.scene === scene && (!entry.stage || !stage || entry.stage === stage));
  return normalizeVideoCreationContext({ global: context.global, scenes });
};

export const buildVideoCreationContextPrompt = (
  planOrContext: unknown,
  sceneNumber?: unknown,
  sceneStage?: unknown,
): string => {
  const context = selectVideoCreationContext(planOrContext, sceneNumber, sceneStage);
  if (!context) return '';
  return `USER VIDEO DIRECTIONS (saved from the initial request):\n${JSON.stringify(context)}\nApply these directions explicitly to this clip's video prompt, including requested exact on-screen words, typography, event ordering, motion, audio and exclusions when present. Calculate the clip timeline from the current Auto Prompt duration only; any clip length, total runtime or fixed timestamp left in an older saved plan is not authoritative. Preserve before/after relationships and requested overlay hold/fade behavior within that current duration. These are video instructions: text requested to appear later in the video need not be visible in the text-free source image. Keep the source image's actual subjects; never add unseen characters to satisfy these directions. Scene numbers are one-based; Cinema A/B share a logical scene number, and a stage-specific instruction applies only to its assigned stage. Do not repeat a one-time introduction in another stage. A newer explicit user change takes priority over the saved direction; reconcile with the current image and intent rather than forcing a stale action. Do not invent video requirements when none were supplied.`;
};
