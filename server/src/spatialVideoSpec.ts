import { effectiveSpatialClipPrompt } from './spatialClipPrompt';
import type { SpatialMotionEvidence } from './spatialMotionEvidence';
import { validateAudioReference, audioReferencePrompt, type AudioReference } from './audioReference';
import { falH3Dollars } from './falH3Spec';

/** Reference-video rates read from the provider model pages, 2026-09-29.
 * Hard frames + motion video are intentionally not enabled without a live compatibility test.
 * https://replicate.com/bytedance/seedance-2.0[-fast|-mini]
 * https://replicate.com/bytedance/seedance-2.5
 * https://fal.ai/models/minimax/h3/reference-to-video
 */
export const spatialVideoModels = {
    Pro: { provider: 'replicate', endpoint: 'bytedance/seedance-2.0', rates: [0.10, 0.22] },
    Minix: { provider: 'replicate', endpoint: 'bytedance/seedance-2.0-fast', rates: [0.08, 0.17] },
    SeedanceMini: { provider: 'replicate', endpoint: 'bytedance/seedance-2.0-mini', rates: [0.05, 0.11] },
    pPro: { provider: 'replicate', endpoint: 'bytedance/seedance-2.5', rates: [0.4304, 0.9676] },
    Proxxx: { provider: 'fal', endpoint: 'minimax/h3/reference-to-video', rates: [0.05, 0.06] },
    FalH3: { provider: 'fal', endpoint: 'minimax/h3-max/reference-to-video', rates: [0.05, 0.08] },
} as const;
export type SpatialVideoModel = keyof typeof spatialVideoModels;
export const isSpatialVideoModel = (model: unknown): model is SpatialVideoModel => typeof model === 'string' && Object.prototype.hasOwnProperty.call(spatialVideoModels, model);
export function spatialVideoPixels(model: string, resolution: string, duration = 5, job?: { direction?: string; kind?: string; references?: unknown[]; motionEvidence?: SpatialMotionEvidence; audioReference?: AudioReference }, audio = false): number {
    if (!isSpatialVideoModel(model)) throw new Error('Choose a spatial reference-video API model.');
    if (!['480p', '720p', '768p'].includes(resolution) || !Number.isFinite(duration) || duration < 2 || duration > 15) throw new Error('Choose a supported clip duration and 480p or 720p (H3: 768p).');
    if (model === 'FalH3') {
        const images = 1 + Number(job?.direction === 'backward') + Number(job?.kind !== 'action' && Boolean(job?.motionEvidence?.diagram?.imageUrl)) + (job?.references?.length || 0);
        return Math.round(falH3Dollars(duration, resolution, images, 1, Number(audio && Boolean(job?.audioReference?.enabled))) * 333);
    }
    return Math.round(spatialVideoModels[model].rates[resolution === '480p' ? 0 : 1] * duration * 333);
}
export function spatialVideoInput(model: SpatialVideoModel, job: { audioReference?: AudioReference; prompt: string; promptVersion?: number; guidance?: { instruction: string }; currentMotionContext?: { controlledSubject: string; controlMode: string; primaryMotion: string; ambientMotion: string }; motionEvidence?: SpatialMotionEvidence; kind?: 'movement' | 'action'; direction?: 'forward' | 'backward'; duration?: number; startAnchor: string; endAnchor: string; referenceVideo: string; references?: Array<{ name: string; imageUrl: string }> }, resolution: string, aspect: string, audio: boolean, music = false) {
    audio = audio === true;
    // Explicit silence wins over an attachment, without clearing the saved reference.
    const sound = audio && job.audioReference?.enabled ? validateAudioReference(job.audioReference, job.duration ?? 5) : undefined;
    const h3 = model === 'Proxxx' || model === 'FalH3';
    const image = (n: number) => h3 ? `Image ${n}` : `[Image${n}]`;
    const video = h3 ? 'Video 1' : '[Video1]';
    // Forward/action endpoints are proxy captures, not appearance references.
    // A return's endpoint is the actual original 2D source, assigned at dispatch.
    const includeEnd = job.direction === 'backward';
    const diagram = job.kind !== 'action' ? job.motionEvidence?.diagram?.imageUrl : undefined;
    const diagramIndex = includeEnd ? 3 : 2;
    const sourceInstruction = effectiveSpatialClipPrompt({ ...job, direction: job.direction || 'forward' });
    // Apply sound choices only to the submitted copy. Older automatic refiners
    // appended these flags; they must not defeat an explicit Music on choice.
    const instruction = audio && music ? sourceInstruction
        .replace(/\bMusic\s*:\s*none\b[.;]?/gi, '')
        .replace(/(^|\n)\s*(?:[-•]\s*)?No music[.!]?\s*(?=\n|$)/gi, '$1')
        .trim() : sourceInstruction;
    const audioPolicy = !audio
        ? 'Silent video: no dialogue, sound effects, ambience or music. Do not generate any audio.'
        : 'Audio: permit requested dialogue, sound effects and ambience; do not invent dialogue. ' + (music ? 'Music: permitted. Generated background music is allowed.' : 'Music: none. Do not generate background music.');
    // Keep the old image-based refiner's instruction verbatim, then adapt only
    // the reference-binding text from appendSpatialMovementReferences.
    const prompt = `${instruction} Use ${image(1)} as the 0-second start frame composition. Reconstruct ${image(1)} as the exact opening composition and visual state.${includeEnd ? ` Transition continuously until ${image(2)} is reconstructed as the exact required ending composition and visual state.` : ''}${diagram ? ` Use ${image(diagramIndex)} only as a spatial movement plan: its arrow, dots, labels, and overlays indicate the intended screen/depth direction and must never appear in the generated video. The annotated subject is the SAME subject already in the opening frame, not another person. Its top view explains the same scene's depth and route; do not change the output camera to that view.` : ''} Use ${video} only as supplemental evidence for the controlled subject's physical route, pose, timing and stopping relation. The proxy subject is the SAME subject already in the opening frame. Preserve the opening subject count and identity; never add a clone or foreground replacement. Preserve the physical terrain, ground contacts and altitude relationships demonstrated by the proxy. Never render its ground grid or primitive appearance or override the movement instruction's camera constraints. Infer realistic scene geometry, contacts, obstacles and subject reactions while following that route. Preserve completed actions and scene continuity.${!audio ? ' Silent video: no music, dialogue or sound effects.' : ''}`;
    const references = job.references || [];
    const currentState = job.kind === 'action' && job.currentMotionContext ? `Established starting state from the actual previous action frame: ${JSON.stringify(job.currentMotionContext)}. Preserve these outcomes until this new action explicitly changes them; the new creator instruction above has priority. Do not repeat the completed action.` : '';
    const identities = references.map((ref, index) => `${image(index + diagramIndex + Number(Boolean(diagram)))} is the appearance reference for @${ref.name}.`).join('\n');
    const base = { prompt: [prompt, currentState, identities, sound ? audioReferencePrompt(h3 ? 'Audio 1' : '[Audio1]') : '', `Sound settings take priority over earlier audio or music instructions. ${audioPolicy}`].filter(Boolean).join('\n'), duration: job.duration ?? 5, aspect_ratio: aspect };
    const images = [job.startAnchor, ...(includeEnd ? [job.endAnchor] : []), ...(diagram ? [diagram] : []), ...references.map(ref => ref.imageUrl)];
    if (h3 && images.length + 1 + Number(Boolean(sound)) > 12) throw new Error('MiniMax H3 accepts 12 total references. Remove an image reference to make room for audio.');
    if (model === 'FalH3' && images.length > 9) throw new Error('Fal H3 accepts up to 9 reference images. Remove an image reference.');
    return h3 ? { ...base, prompt_expansion_mode: 'disabled', resolution: resolution === '480p' ? '480P' : '768P', reference_image_urls: images, reference_video_urls: [job.referenceVideo], ...(sound ? { reference_audio_urls: [sound.url] } : {}) }
        : { ...base, resolution: resolution === '480p' ? '480p' : '720p', generate_audio: audio, reference_images: images, reference_videos: [job.referenceVideo], ...(sound ? { reference_audios: [sound.url] } : {}) };
}
