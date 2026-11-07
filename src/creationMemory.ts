export type CreationMemoryCard = {
  cardKey: string;
  title: string;
  text: string;
  cardType?: string;
  sceneNumber?: string;
  entities?: string[];
  domains?: string[];
  mode?: string | number;
  importance?: number;
};

export const createCreationProjectId = (): string => {
  const randomPart = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `creation-${Date.now()}-${randomPart}`;
};

const MEDIA_VALUE_PATTERN = /^(?:https?:|blob:|data:)/i;
const MEDIA_KEY_PATTERN = /(?:^|_)(?:url|uri|blob|base64|thumbnail|image_url|video_url|audio_url|preview_url)$/i;

export const sanitizeCreationMemoryValue = (value: unknown, depth = 0): unknown => {
  if (depth > 6 || value == null) return undefined;
  if (typeof value === "string") {
    const clean = value.trim();
    return !clean || MEDIA_VALUE_PATTERN.test(clean) ? undefined : clean;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeCreationMemoryValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      if (MEDIA_KEY_PATTERN.test(key)) return;
      const clean = sanitizeCreationMemoryValue(item, depth + 1);
      if (clean !== undefined) result[key] = clean;
    });
    return Object.keys(result).length ? result : undefined;
  }
  return undefined;
};

export const renderCreationMemorySections = (
  sections: Array<[string, unknown]>,
): string => sections
  .map(([label, value]) => {
    const clean = sanitizeCreationMemoryValue(value);
    if (clean === undefined) return "";
    const rendered = typeof clean === "string" ? clean : JSON.stringify(clean, null, 2);
    return rendered ? `${label}:\n${rendered}` : "";
  })
  .filter(Boolean)
  .join("\n\n");

/** Keep each independently retrievable card below the server's 18k character cap. */
export const chunkCreationMemoryText = (value: string, maxLength = 12000): string[] => {
  const text = String(value || "").trim();
  if (!text) return [];
  const chunks: string[] = [];
  for (let offset = 0; offset < text.length;) {
    let end = Math.min(offset + maxLength, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf("\n", end);
      if (boundary > offset + maxLength / 2) end = boundary + 1;
    }
    chunks.push(text.slice(offset, end).trim());
    offset = end;
  }
  return chunks.filter(Boolean);
};
