import { motionGuideVideoUrl, normalCharacterImageUrl } from './safetyConditioning';
import { normalizeVideoHistory, type VideoHistory } from '../server/src/videoHistory';

export const PLAN_KONTEXT_TYPE = "clik-plan-media";
export const PLAN_KONTEXT_VERSION = 1;

export type PlanKontextMediaKind = "image" | "video";

export type PlanKontextMediaItem = {
  url: string;
  kind: PlanKontextMediaKind;
  role: string;
  label?: string;
  name?: string;
  description?: string;
  prompt?: string;
  source?: string;
  scene?: number;
  bIndex?: number;
  deleteOnPostDelete?: boolean;
  sourceUrl?: string;
};

export type PlanKontextPayload = {
  type: typeof PLAN_KONTEXT_TYPE;
  version: typeof PLAN_KONTEXT_VERSION;
  cover?: PlanKontextMediaItem | null;
  inputs?: PlanKontextMediaItem[];
  inputCharacters?: PlanKontextMediaItem[];
  characters?: PlanKontextMediaItem[];
  bshots?: PlanKontextMediaItem[];
  retainedMedia?: PlanKontextMediaItem[];
  referenceVideos?: PlanKontextMediaItem[];
  motionVideos?: PlanKontextMediaItem[];
  videoPrompts?: Record<string, string>;
  safetyMedia?: PlanKontextMediaItem[];
  safetyAudioUrls?: string[];
  upscales?: Record<string, Array<{ videoUrl: string; sourceUrl: string; resolution: "1080p" | "2k"; fps: number; predictionId: string }>>;
  bshotUpscales?: PlanKontextPayload["upscales"];
  videoHistory?: VideoHistory;
  imageModels?: Record<string, string>;
};

const EMPTY_BSHOT = "EMPTY_BSHOT";

export const isPlanMediaUrl = (value: unknown): value is string => {
  const url = typeof value === "string" ? value.trim() : "";
  return !!url && ![EMPTY_BSHOT, "EMPTY", "ERROR"].includes(url) && !url.startsWith("blob:");
};

const normalizeName = (value: unknown) =>
  String(value || "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const namesMatch = (left: unknown, right: unknown) => {
  const a = normalizeName(left);
  const b = normalizeName(right);
  if (!(a && b)) return false;
  return a === b || a.includes(b) || b.includes(a);
};

const isWorldVip = (vip: any) => {
  const source = String(vip?.source || vip?.origin || vip?.assetSource || "").toLocaleLowerCase();
  return source === "world" || source === "world-model" || source === "world_model";
};

const mediaItem = (
  url: unknown,
  kind: PlanKontextMediaKind,
  role: string,
  overrides: Partial<PlanKontextMediaItem> = {}
): PlanKontextMediaItem | null => {
  if (!isPlanMediaUrl(url)) return null;
  return {
    url: url.trim(),
    kind,
    role,
    deleteOnPostDelete: true,
    ...overrides,
  };
};

const uniqueByUrl = (items: Array<PlanKontextMediaItem | null | undefined>) => {
  const seen = new Set<string>();
  return items.filter((item): item is PlanKontextMediaItem => {
    if (!item?.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
};


// A reused reference keeps one binding per native A/B scene, even with an identical URL.
const uniqueSceneBindings = (items: PlanKontextMediaItem[]) => {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = JSON.stringify([item.url, item.role, item.scene, item.bIndex]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};


export const buildPlanKontextPayload = ({
  coverUrl,
  generatedImages = [],
  referenceImages = [],
  vipCharacters = [],
  bShotImages = [],
  bShotVideos = [],
  bShotNanoImages = [],
  bShotPrompts = [],
  bShotTextVideo = [],
  videoHistory = {},
  imageModels = {},
  referenceVideoUrls = [],
  bShotReferenceVideoUrls = [],
  autoDrawGuideData = [],
  bShotAutoDrawGuideData = [],
  textVideo = [],
  safetyMediaUrls = [],
  safetyAudioUrls = [],
}: {
  coverUrl?: string | null;
  generatedImages?: any[];
  referenceImages?: any[];
  vipCharacters?: any[];
  bShotImages?: any[];
  bShotVideos?: any[];
  bShotNanoImages?: any[];
  bShotPrompts?: any[];
  bShotTextVideo?: any[];
  videoHistory?: VideoHistory;
  imageModels?: Record<string, string>;
  referenceVideoUrls?: any[];
  bShotReferenceVideoUrls?: any[];
  autoDrawGuideData?: any[];
  bShotAutoDrawGuideData?: any[];
  textVideo?: any[];
  safetyAudioUrls?: string[];
  safetyMediaUrls?: Array<{ url: string; kind: PlanKontextMediaKind; label?: string; scene?: number; bIndex?: number; prompt?: string }>;
}): PlanKontextPayload => {
  const worldVipUrls = new Set(
    (vipCharacters || [])
      .filter(isWorldVip)
      .map((vip: any) => (isPlanMediaUrl(vip?.imageUrl) ? vip.imageUrl.trim() : ""))
      .filter(Boolean)
  );

  const vipForReference = (ref: any) =>
    (vipCharacters || []).find(
      (vip: any) =>
        (isPlanMediaUrl(vip?.imageUrl) && vip.imageUrl === ref?.imageUrl) ||
        namesMatch(vip?.name, ref?.name)
    );

  const isPreservedWorldUrl = (url: unknown) =>
    isPlanMediaUrl(url) && worldVipUrls.has(url.trim());

  const cover = mediaItem(coverUrl, "image", "kontext", {
    label: "Kontext",
    deleteOnPostDelete: !isPreservedWorldUrl(coverUrl),
    source: isPreservedWorldUrl(coverUrl) ? "world" : "post",
  });

  const inputs = uniqueByUrl(
    (generatedImages || []).map((url: string, index: number) =>
      mediaItem(url, "image", "input", {
        label: index === 0 ? "Kontext" : `Input ${index + 1}`,
        deleteOnPostDelete: !isPreservedWorldUrl(url),
        source: isPreservedWorldUrl(url) ? "world" : "post",
      })
    )
  );

  const inputCharacters = uniqueByUrl(
    (vipCharacters || []).map((vip: any) => {
      const normalUrl = normalCharacterImageUrl(vip);
      const source = isWorldVip(vip) ? "world" : (vip?.source || "upload");
      return mediaItem(normalUrl, "image", "vip-character", {
        name: vip?.name,
        label: vip?.name || "VIP Character",
        description: vip?.description,
        source,
        deleteOnPostDelete: source !== "world",
      });
    })
  );

  const characters = uniqueByUrl(
    (referenceImages || []).map((ref: any) => {
      const normalUrl = normalCharacterImageUrl(ref);
      const matchedVip = vipForReference(ref);
      const preserveWorld = isPreservedWorldUrl(normalUrl);
      return mediaItem(normalUrl, "image", "character", {
        name: ref?.name,
        label: ref?.name || ref?.type || "Character",
        description: ref?.description,
        prompt: ref?.prompt || ref?.originalPrompt,
        source: preserveWorld ? "world" : matchedVip ? "generated-vip" : "generated",
        sourceUrl: matchedVip?.imageUrl,
        deleteOnPostDelete: !preserveWorld,
      });
    })
  );

  const bshots: PlanKontextMediaItem[] = [];
  (bShotImages || []).forEach((sceneItems: any[], sceneIndex: number) => {
    (sceneItems || []).forEach((url: string, bIndex: number) => {
      const item = mediaItem(url, "image", "bshot", {
        label: `B-shot ${sceneIndex + 1}.${bIndex + 1}`,
        scene: sceneIndex + 1,
        bIndex: bIndex + 1,
        prompt: bShotPrompts?.[sceneIndex]?.[bIndex],
      });
      if (item) bshots.push(item);
    });
  });

  (bShotNanoImages || []).forEach((sceneItems: any[], sceneIndex: number) => {
    (sceneItems || []).forEach((url: string, bIndex: number) => {
      const item = mediaItem(url, "image", "bshot-nano", {
        label: `B-shot ${sceneIndex + 1}.${bIndex + 1}`,
        scene: sceneIndex + 1,
        bIndex: bIndex + 1,
        prompt: bShotPrompts?.[sceneIndex]?.[bIndex],
      });
      if (item) bshots.push(item);
    });
  });

  (bShotVideos || []).forEach((sceneItems: any[], sceneIndex: number) => {
    (sceneItems || []).forEach((url: string, bIndex: number) => {
      const item = mediaItem(url, "video", "bshot-video", {
        label: `B-shot video ${sceneIndex + 1}.${bIndex + 1}`,
        scene: sceneIndex + 1,
        bIndex: bIndex + 1,
        prompt: bShotTextVideo?.[sceneIndex]?.[bIndex] || bShotPrompts?.[sceneIndex]?.[bIndex],
      });
      if (item) bshots.push(item);
    });
  });

  const referenceVideos: PlanKontextMediaItem[] = [];
  (referenceVideoUrls || []).forEach((url: string, sceneIndex: number) => {
    const item = mediaItem(url, "video", "reference-video", {
      label: `Scene ${sceneIndex + 1} Video Ref`,
      scene: sceneIndex + 1,
      prompt: textVideo?.[sceneIndex],
    });
    if (item) referenceVideos.push(item);
  });
  (bShotReferenceVideoUrls || []).forEach((sceneItems: any[], sceneIndex: number) => {
    (sceneItems || []).forEach((url: string, bIndex: number) => {
      const item = mediaItem(url, "video", "reference-video", {
        label: `B-shot ${sceneIndex + 1}.${bIndex + 1} Video Ref`,
        scene: sceneIndex + 1,
        bIndex: bIndex + 1,
        prompt: bShotTextVideo?.[sceneIndex]?.[bIndex],
      });
      if (item) referenceVideos.push(item);
    });
  });

  const motionVideos: PlanKontextMediaItem[] = [];
  (autoDrawGuideData || []).forEach((guide: any, sceneIndex: number) => {
    const motionUrl = motionGuideVideoUrl(guide);
    const item = mediaItem(motionUrl, "video", "motion-video", {
      label: `Scene ${sceneIndex + 1} 3D Motion Ref`,
      scene: sceneIndex + 1,
      description: guide?.cameraPreset || undefined,
      prompt: textVideo?.[sceneIndex],
    });
    if (item) motionVideos.push(item);
  });
  (bShotAutoDrawGuideData || []).forEach((sceneItems: any[], sceneIndex: number) => {
    (sceneItems || []).forEach((guide: any, bIndex: number) => {
      const motionUrl = motionGuideVideoUrl(guide);
      const item = mediaItem(motionUrl, "video", "motion-video", {
        label: `B-shot ${sceneIndex + 1}.${bIndex + 1} 3D Motion Ref`,
        scene: sceneIndex + 1,
        bIndex: bIndex + 1,
        description: guide?.cameraPreset || undefined,
        prompt: bShotTextVideo?.[sceneIndex]?.[bIndex],
      });
      if (item) motionVideos.push(item);
    });
  });

  const videoPrompts: Record<string, string> = {};
  (textVideo || []).forEach((promptText: unknown, sceneIndex: number) => {
    const cleaned = typeof promptText === "string" ? promptText.trim() : "";
    if (cleaned) {
      videoPrompts[`A:${sceneIndex}`] = cleaned;
    }
  });
  (bShotTextVideo || []).forEach((sceneItems: any[], sceneIndex: number) => {
    (sceneItems || []).forEach((promptText: unknown, bIndex: number) => {
      const cleaned = typeof promptText === "string" ? promptText.trim() : "";
      if (cleaned) {
        videoPrompts[`B:${sceneIndex}:${bIndex}`] = cleaned;
      }
    });
  });

  const safetyMedia: PlanKontextMediaItem[] = [];
  (safetyMediaUrls || []).forEach((entry) => {
    const item = mediaItem(entry?.url, entry?.kind || "image", "safety-media", {
      label: entry?.label || "Safety Media",
      scene: entry?.scene,
      bIndex: entry?.bIndex,
      prompt: entry?.prompt,
    });
    if (item) safetyMedia.push(item);
  });

  return {
    type: PLAN_KONTEXT_TYPE,
    version: PLAN_KONTEXT_VERSION,
    cover,
    inputs,
    inputCharacters,
    characters,
    bshots: uniqueByUrl(bshots),
    referenceVideos: uniqueSceneBindings(referenceVideos),
    motionVideos: uniqueSceneBindings(motionVideos),
    videoPrompts,
    safetyMedia: uniqueByUrl(safetyMedia),
    safetyAudioUrls: [...new Set(safetyAudioUrls.filter(url => typeof url === "string" && /^https?:\/\//i.test(url)))],
    videoHistory: normalizeVideoHistory(videoHistory),
    imageModels,
  };
};

export const serializePlanKontextPayload = (payload: PlanKontextPayload) =>
  JSON.stringify(payload);

export const parsePlanKontext = (raw: unknown): { payload: PlanKontextPayload | null; legacyImage: string | null } => {
  if (!raw) return { payload: null, legacyImage: null };
  if (typeof raw === "object") {
    const maybePayload = raw as PlanKontextPayload;
    if (maybePayload.type === PLAN_KONTEXT_TYPE) return { payload: maybePayload, legacyImage: null };
    return { payload: null, legacyImage: null };
  }

  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return { payload: null, legacyImage: null };

  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      if (parsed?.type === PLAN_KONTEXT_TYPE) {
        return { payload: parsed as PlanKontextPayload, legacyImage: null };
      }
    } catch {
      return { payload: null, legacyImage: isPlanMediaUrl(text) ? text : null };
    }
  }

  return { payload: null, legacyImage: isPlanMediaUrl(text) ? text : null };
};

export const getPlanKontextItems = (raw: unknown, includeLegacy = true) => {
  const { payload, legacyImage } = parsePlanKontext(raw);
  const items = uniqueByUrl([
    payload?.cover,
    ...(payload?.inputs || []),
    ...(payload?.inputCharacters || []),
    ...(payload?.characters || []),
    ...(payload?.bshots || []),
    ...(payload?.retainedMedia || []),
    ...(payload?.referenceVideos || []),
    ...(payload?.motionVideos || []),
    ...(payload?.safetyMedia || []),
    ...Object.entries(normalizeVideoHistory(payload?.videoHistory)).flatMap(([key, entries]) => entries.map(entry =>
      mediaItem(entry.videoUrl, 'video', 'video-history', { label: key, prompt: entry.prompt }))),
    includeLegacy && legacyImage ? mediaItem(legacyImage, "image", "legacy-kontext", { deleteOnPostDelete: false }) : null,
  ]);
  return items;
};

export const getPlanKontextPreviewUrl = (raw: unknown) => {
  const items = getPlanKontextItems(raw, true);
  return items.find((item) => item.kind === "image")?.url || "";
};

export const getPlanKontextCleanupUrls = (rawOrPayload: unknown) => {
  const items =
    typeof rawOrPayload === "object" && (rawOrPayload as any)?.type === PLAN_KONTEXT_TYPE
      ? getPlanKontextItems(rawOrPayload, false)
      : getPlanKontextItems(rawOrPayload, true);

  return {
    images: items.filter((item) => item.kind === "image").map((item) => item.url),
    videos: items.filter((item) => item.kind === "video").map((item) => item.url),
  };
};

export const getPlanKontextDeletableMedia = (raw: unknown) => {
  const { payload } = parsePlanKontext(raw);
  if (!payload) return { images: [] as string[], videos: [] as string[] };

  const items = getPlanKontextItems(payload, false).filter(
    (item) => item.deleteOnPostDelete !== false
  );

  return {
    images: items.filter((item) => item.kind === "image").map((item) => item.url),
    videos: items.filter((item) => item.kind === "video").map((item) => item.url),
  };
};
