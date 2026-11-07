import type { MotionPlan } from '../server/src/motionGuidePlan';
import { hasVideoModelCapability } from './videoModelCapabilities';
export { validateMotionPlan, motionSegment } from '../server/src/motionGuidePlan';
export type { MotionPlan } from '../server/src/motionGuidePlan';

export { motionGuidePrice, MOTION_GUIDE_PRICES } from '../server/src/motionGuidePricing';
export type MotionGuideData = {
    authoring?: import('../server/src/sceneAuthoring').SceneAuthoringDraft;
    plan: MotionPlan;
    videoUrl?: string;
    sourcePrompt: string;
    sourceFrameUrl: string;
    aspectRatio: '16:9' | '9:16' | '1:1';
    editInstruction?: string;
    createdAt: number;
    /** Actual routing result, kept separately from the user's selected tier. */
    model?: string;
    provider?: string;
    requestedModel?: string;
    requestedReasoningEffort?: 'low' | 'high' | 'max';
    llmTier?: 'luna' | 'terra' | 'sol';
    /** Free prompt draft; applying it requires an explicit rebuild. */
    draftPrompt?: string;
    /** Paid replacement retained for a free export retry; the completed reference stays usable. */
    pendingReplacement?: MotionGuideData;
    /** Unfinalized kept AI work. It is editable/recoverable, never an exported reference. */
    liveDraft?: { buildId: string; sourceIdentity: string };
};
export const motionReferenceInstruction = 'Use [Video1] only as a motion reference: follow its subject trajectories, action timing, relative positions and camera movement. Render the finished scene and subjects described in the prompt and appearance references. Preserve the visual text requested in the prompt, including its exact wording, placement, style, attachment and timing; distinguish visible lettering from spoken dialogue. Do not reproduce the primitive shapes, plain materials or ground grid of the animatic. Preserve the physical ground and altitude relationships it demonstrates.';

export function attachMotionVideoReference(payload: Record<string, any>, guide: MotionGuideData, model: string, prompt: string) {
    if (!hasVideoModelCapability(model, 'videoReferences')) throw new Error('This model does not accept video references.');
    if (!guide.videoUrl) throw new Error('The Motion Guide video has not finished exporting.');
    payload.referenceVideoUrl = guide.videoUrl;
    const instruction = model === 'Proxxx' || model === 'FalH3' ? motionReferenceInstruction.replace('[Video1]', 'Video 1') : motionReferenceInstruction;
    payload.prompt = `${String(payload.prompt || prompt)}\n\n${instruction}`;
}

// Tokens never repeat, even after deletion, reset or a topology change.
// Independent scene keys can run concurrently; only the current token may commit.
export class MotionGuideJobs {
    private active = new Map<string, symbol>();
    start(key: string) { const token = Symbol(key); this.active.set(key, token); return token; }
    current(key: string, token: symbol) { return this.active.get(key) === token; }
    busy(key: string) { return this.active.has(key); }
    finish(key: string, token: symbol) { if (this.current(key, token)) this.active.delete(key); }
    cancel(key: string) { this.active.delete(key); }
    reset() { this.active.clear(); }
}
