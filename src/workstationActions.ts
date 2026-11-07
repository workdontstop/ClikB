import type { CreationControl } from './creationControlSnapshot';
export type WorkstationAction = { key: string; label: string; pixels: number; policy: CreationControl['policy'] };
/** Mirrors handleVideoGenerateClick's existing branch order. Labels and control metadata share the result. */
export function videoWorkstationAction(input: {
    update: boolean; promptPixels: number; spatialStudio: boolean; spatialAction: boolean; spatialPixels: number;
    motion: boolean; motionReady: boolean; motionDraft: boolean; paidMotionPlan: boolean; motionPixels: number;
    visual: boolean; visualReady: boolean; gpuRunning: boolean; model: string; imagePixels: number; videoPixels: number;
    retryVideoSave?: boolean;
}): WorkstationAction {
    if (input.retryVideoSave && !input.spatialStudio) return { key: 'retry_video_save', label: 'Retry save', pixels: 0, policy: 'candidate' };
    if (input.update) return { key: 'update_prompt', label: 'Update Prompt', pixels: input.promptPixels, policy: 'candidate' };
    if (input.spatialStudio) return { key: 'create_spatial_action', label: 'Create 3D action', pixels: input.spatialPixels, policy: 'candidate' };
    if (input.motion && !input.motionReady) {
        if (input.paidMotionPlan) return { key: 'retry_motion_export', label: 'Retry Motion Export', pixels: 0, policy: 'candidate' };
        return { key: 'build_motion_guide', label: 'Build Motion Guide', pixels: input.motionPixels, policy: 'requires_video' };
    }
    if (!input.gpuRunning && input.model !== 'GeminiOmni' && input.visual && !input.visualReady)
        return { key: 'create_visual_guide', label: 'Generate Visual Guide', pixels: input.imagePixels, policy: 'candidate' };
    return { key: 'generate_video', label: input.spatialAction ? 'Generate Action Video' : 'Generate Video', pixels: input.gpuRunning ? 0 : input.videoPixels, policy: 'requires_video' };
}
