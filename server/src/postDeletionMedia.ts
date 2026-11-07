/** Deletion reads historical documents without requiring today's graph schema. */
export function parseDeletionDocument(value: unknown): any {
    if (typeof value !== 'string') return value && typeof value === 'object' ? value : null;
    try { return JSON.parse(value); } catch { return null; }
}

const mediaFields = new Set(['url', 'imageUrl', 'videoUrl', 'frameUrl', 'pendingRootFrameUrl',
    'sourceFrameUrl', 'movementReferenceImageUrl', 'referenceVideo', 'startAnchor', 'endAnchor',
    'actualEndFrame', 'sourceImage', 'sourceUrl', 'output', 'original', 'originalFrameUrl', 'thumbnailUrl', 'endFrame',
    'mainSrc', 'autoPlaySrc', 'audioUrl', 'src']);

export function collectPostDeletionMedia(post: Record<string, unknown>, drafts: any[], storageUrl: (value: unknown) => string | null) {
    const media = new Set<string>(), preserved = new Set<string>();
    const add = (value: unknown, target = media) => { const url = storageUrl(value); if (url) target.add(url); };
    const plan = parseDeletionDocument(post.kontext);
    if (plan?.type === 'clik-plan-media') {
        for (const item of [plan.cover, ...['inputs', 'inputCharacters', 'characters', 'bshots', 'retainedMedia', 'referenceVideos', 'motionVideos', 'safetyMedia'].flatMap(key => Array.isArray(plan[key]) ? plan[key] : [])]) {
            if (!item) continue;
            add(item.url, item.deleteOnPostDelete === false || item.source === 'world' ? preserved : media);
        }
        for (const url of Array.isArray(plan.safetyAudioUrls) ? plan.safetyAudioUrls : []) add(url);
    }
    for (const [key, value] of Object.entries(post)) {
        if (/^(?:x|xh|xv|xa)\d+B?$/.test(key) || /^int\d+$/.test(key)
            || ['item1', 'item2', 'thumb1', 'videoUrl', 'video', 'nobgmvideo', 'captionAudio', 'main', 'subl', 'subr',
                'mainint', 'vid1backup', 'vid2backup', 'mainaud', 'sub1aud', 'sub2aud',
                'interaction_audio_main', 'interaction_audio_left', 'interaction_audio_right'].includes(key)) add(value);
    }
    const walk = (value: any) => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) { value.forEach(walk); return; }
        for (const [key, child] of Object.entries(value)) {
            if (mediaFields.has(key)) add(child);
            if (['assets', 'subs', 'audio'].includes(key)) walkMediaValues(child);
            if (child && typeof child === 'object') walk(child);
        }
    };
    const walkMediaValues = (value: any) => {
        if (Array.isArray(value)) value.forEach(walkMediaValues);
        else if (value && typeof value === 'object') Object.values(value).forEach(walkMediaValues);
        else add(value);
    };
    walk(parseDeletionDocument(post.spatial_experience_json));
    walk(plan?.upscales);
    walk(plan?.bshotUpscales);
    walk(parseDeletionDocument(post.touch_config_json));
    drafts.forEach(draft => walk(parseDeletionDocument(draft.document)));
    return [...media].filter(url => !preserved.has(url));
}
