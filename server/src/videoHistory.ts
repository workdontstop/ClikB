export type VideoHistoryEntry = { videoUrl: string; createdAt: number; prompt?: string; model?: string };
export type VideoHistory = Record<string, VideoHistoryEntry[]>;

export function normalizeVideoHistory(value: unknown): VideoHistory {
    const result: VideoHistory = {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
    for (const [key, items] of Object.entries(value)) {
        if (!/^(?:A:\d+|B:\d+:\d+)$/.test(key) || !Array.isArray(items)) continue;
        const seen = new Set<string>();
        const entries: VideoHistoryEntry[] = [];
        for (const item of items) {
            const url = typeof item?.videoUrl === 'string' ? item.videoUrl.trim() : '';
            if (!/^https?:\/\//i.test(url) || url.length > 8000 || seen.has(url)) continue;
            seen.add(url);
            entries.push({ videoUrl: url, createdAt: Number.isFinite(item.createdAt) ? Math.max(0, item.createdAt) : 0,
                ...(typeof item.prompt === 'string' ? { prompt: item.prompt.slice(0, 30000) } : {}),
                ...(typeof item.model === 'string' && item.model.trim() ? { model: item.model.trim().slice(0, 120) } : {}) });
        }
        if (entries.length) result[key] = entries;
    }
    return result;
}

export function appendVideoHistory(history: unknown, key: string, entry: VideoHistoryEntry): VideoHistory {
    const result = normalizeVideoHistory(history);
    const incoming = normalizeVideoHistory({ [key]: [entry] })[key]?.[0];
    if (!incoming) return result;
    const current = result[key] || [];
    // Restoring a version keeps its original generation time and existing prompt.
    const existing = current.find(item => item.videoUrl === incoming.videoUrl);
    if (!existing) result[key] = [...current, incoming];
    else if (!existing.model && incoming.model) result[key] = current.map(item => item === existing ? { ...item, model: incoming.model } : item);
    return result;
}

export function mergeVideoHistory(previous: unknown, incoming: unknown): VideoHistory {
    let result = normalizeVideoHistory(previous);
    for (const [key, entries] of Object.entries(normalizeVideoHistory(incoming))) {
        for (const entry of entries) result = appendVideoHistory(result, key, entry);
    }
    return result;
}

export function parseVideoHistoryContext(raw: unknown): Record<string, any> {
    let context: any;
    try { context = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { /* legacy context */ }
    if (!context || typeof context !== 'object' || Array.isArray(context)) {
        context = { ...(raw ? { legacyKontext: raw } : {}) };
        if (typeof raw === 'string' && /^https?:\/\//i.test(raw)) context.cover = { url: raw, kind: 'image', role: 'kontext', deleteOnPostDelete: false };
    }
    return { ...context, type: context.type || 'clik-plan-media', version: context.version || 1 };
}
