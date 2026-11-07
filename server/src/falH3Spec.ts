import { audioReferencePrompt } from './audioReference';

export const FAL_H3_ENDPOINTS = {
    text: 'minimax/h3-max/text-to-video',
    image: 'minimax/h3-max/image-to-video',
    reference: 'minimax/h3-max/reference-to-video',
} as const;

const url = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const urls = (value: unknown): string[] => Array.isArray(value) ? value.map(url).filter(Boolean) : [];
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Same ClikB reference bindings as MiniMax H3; no changes to the base H3 adapter. */
export function falH3Request(body: any) {
    let prompt = url(body?.prompt) || url(body?.inputs);
    if (!prompt) throw new Error('Enter a video prompt.');
    const requested = Number(body.videoLength ?? body.duration ?? 5);
    const duration = Number.isFinite(requested) ? Math.max(.92, Math.min(15, requested)) : 5;
    const resolution = String(body.resolution).toLowerCase() === '480p' ? '480P' : '768P';
    const aspect = ({ 1: '9:16', 2: '1:1', 3: '16:9' } as Record<number, string>)[Number(body.ty)] || '16:9';
    const input: Record<string, any> = { prompt, duration, resolution, prompt_expansion_mode: 'disabled' };
    if (Number.isInteger(body.seed) && body.seed >= 0) input.seed = body.seed;
    const start = url(body.startImage);
    const end = url(body.endImageUrl) || url(body.lastFrame);
    const diagram = url(body.spatialMovementReferenceImageUrl);
    const names = Array.isArray(body.activechracternames) ? body.activechracternames : [];
    const fallback = urls(body.activechracterimages);
    const characters: Array<{ name: string; url: string; handle?: RegExp }> = [];
    names.forEach((entry: any, index: number) => {
        const name = url(entry?.name);
        const image = url(entry?.imageUrl || entry?.url || entry?.image || fallback[index]);
        const compact = name.replace(/[^A-Za-z0-9_]/g, '');
        const handle = compact ? new RegExp(`\\s*@${escape(compact)}\\b`, 'ig') : undefined;
        if (image && (!handle || handle.test(prompt))) characters.push({ name, url: image, handle });
    });
    if (!names.length) fallback.forEach(image => characters.push({ name: '', url: image }));
    const direct = urls(body.referenceImageUrls);
    const videos = urls(Array.isArray(body.referenceVideos) ? body.referenceVideos : body.referenceVideoUrl ? [body.referenceVideoUrl] : []);
    const audios = urls(Array.isArray(body.referenceAudioUrls) ? body.referenceAudioUrls : body.audioReferenceUrl || body.lipSyncUrl ? [body.audioReferenceUrl || body.lipSyncUrl] : []);
    const images: string[] = [];
    let endpoint: string = FAL_H3_ENDPOINTS.text;
    // Fal H3 requires a video reference to anchor temporal trajectory when multi-image references are used.
    // Without a video reference, a starting frame runs pure image-to-video to prevent static slideshow morphs.
    const effectiveCharacters = (start && !videos.length) ? [] : characters;
    const effectiveDirect = (start && !videos.length) ? [] : direct;
    const references = Boolean(effectiveCharacters.length || effectiveDirect.length || videos.length || audios.length || diagram);
    if (references) {
        endpoint = FAL_H3_ENDPOINTS.reference;
        const add = (image: string): number => {
            if (!images.includes(image)) images.push(image);
            return images.indexOf(image) + 1;
        };
        // Preserve the existing H3 soft opening-frame + multimodal-reference route.
        // Direct Video omits this frame; Motion/Visual Guide already does so in EditStory.
        if (start) prompt += ` Use Image ${add(start)} as the exact opening composition and visual state.`;
        if (diagram && end) prompt += ` Transition continuously until Image ${add(end)} is reconstructed as the exact ending composition and visual state.`;
        if (diagram) prompt += ` Use Image ${add(diagram)} only as a spatial movement plan. Its arrows, dots, labels and overlays describe the intended route and must never appear in the generated video. The annotated subject is the SAME subject in the opening frame. Preserve its identity and subject count; do not add a clone. Follow the physical route, contacts, obstacles and ending relation while preserving the scene camera.`;
        effectiveCharacters.forEach(reference => {
            const label = `Image ${add(reference.url)}`;
            if (reference.handle) prompt = prompt.replace(reference.handle, ` ${label}`);
            prompt += reference.name ? ` Use ${label} as the strict identity and silhouette reference for ${reference.name}.` : ` Use ${label} as a subject and style reference.`;
        });
        effectiveDirect.forEach(image => { prompt += ` Use Image ${add(image)} as a subject or style reference.`; });
        if (images.length > 9 || videos.length > 3 || audios.length > 3 || images.length + videos.length + audios.length > 12) {
            throw new Error('Fal H3 supports up to 9 image, 3 video and 3 audio references, with 12 reference files in total.');
        }
        if (videos.length) prompt += ` Use ${videos.map((_, i) => `Video ${i + 1}`).join(', ')} as motion, camera and editing references.`;
        if (audios.length) {
            const labels = audios.map((_, i) => `Audio ${i + 1}`).join(', ');
            prompt += body.audioReferenceUrl ? ` ${audioReferencePrompt(labels)}` : ` Use ${labels} as driving audio for lip-sync, rhythm and timing.`;
        }
        input.aspect_ratio = aspect;
        if (images.length) input.reference_image_urls = images;
        if (videos.length) input.reference_video_urls = videos;
        if (audios.length) input.reference_audio_urls = audios;
    } else if (start) {
        endpoint = FAL_H3_ENDPOINTS.image;
        input.image_url = start;
        if (end) input.end_image_url = end;
    } else {
        input.aspect_ratio = aspect;
    }
    input.prompt = prompt;
    return { endpoint, input };
}

/**
 * Shared ClikB estimate, not an exact provider token meter. List rates verified
 * 2026-10-21: 480P $.05/s, 768P $.08/s; 4096 pooled reference tokens included,
 * then $.02/1000. We use square-image and 24fps landscape/portrait-video
 * reference estimates from fal's published table. Actual input shape, frame
 * count and audio tokenization can change the provider's bill. Do not apply
 * base H3's five-free-images tariff or a temporary T2V/I2V promotion here.
 * https://fal.ai/models/minimax/h3-max/reference-to-video
 */
export function falH3Dollars(duration: number, resolution: string, imageCount = 0, videoCount = 0, audioCount = 0): number {
    const seconds = Math.max(.92, Math.min(15, Number(duration) || 5));
    const low = resolution.toLowerCase() === '480p';
    const points = low ? [[0, 0], [2, 4680], [5, 12480], [10, 26130], [15, 39780]] : [[0, 0], [2, 12096], [5, 32256], [10, 67536], [15, 102816]];
    const upper = points.findIndex(point => point[0] >= seconds);
    const [x1, y1] = points[Math.max(1, upper) - 1];
    const [x2, y2] = points[Math.max(1, upper)];
    const videoTokens = y1 + (seconds - x1) * (y2 - y1) / (x2 - x1);
    const tokens = Math.max(0, imageCount) * 1024 + Math.max(0, videoCount) * videoTokens + Math.max(0, audioCount) * seconds * 80;
    return seconds * (low ? .05 : .08) + Math.max(0, tokens - 4096) * .02 / 1000;
}

export function falH3InputDollars(input: Record<string, any>): number {
    return falH3Dollars(input.duration, input.resolution, input.reference_image_urls?.length, input.reference_video_urls?.length, input.reference_audio_urls?.length);
}
