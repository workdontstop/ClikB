import { scenePerformanceText } from './scenePerformance';

export type SpatialMotionEvidence = {
    animationId: string;
    planKey: string;
    aspectRatio: string;
    frames: Array<{ t: number; imageUrl: string }>;
    diagram?: { imageUrl: string };
};

// Shared serialization binds browser captures to the exact processed plan.
export const motionEvidencePlanText = scenePerformanceText;
export const motionEvidenceTimes = (duration: number) => [0, duration / 4, duration / 2, duration * 3 / 4, duration];

export function validateMotionEvidence(value: SpatialMotionEvidence, animationId: string, planKey: string, duration: number, aspectRatio: string): SpatialMotionEvidence {
    if (value?.animationId !== animationId || value.planKey !== planKey || value.aspectRatio !== aspectRatio
        || !Array.isArray(value.frames) || value.frames.length !== 5
        || value.frames.some((frame, index) => Math.abs(frame?.t - motionEvidenceTimes(duration)[index]) > .001
            || !Number.isFinite(frame?.t) || typeof frame.imageUrl !== 'string' || frame.imageUrl.length > 8000 || !/^https:\/\//i.test(frame.imageUrl))
        || value.diagram && (typeof value.diagram.imageUrl !== 'string' || value.diagram.imageUrl.length > 8000 || !/^https:\/\//i.test(value.diagram.imageUrl))) {
        throw new Error('The motion images do not match this authored animation.');
    }
    return value;
}
