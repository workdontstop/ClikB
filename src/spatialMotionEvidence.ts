import { createMotionRenderer } from './motionGuideRenderer';
import { motionEvidencePlanText, motionEvidenceTimes, type SpatialMotionEvidence } from '../server/src/spatialMotionEvidence';
import type { SpatialAnimatic } from '../server/src/spatialWorld';
import { createSpatialMotionDiagram } from './spatialMotionDiagram';

/** Capture the processed animation, never a forward clip reused as a return. */
export async function captureSpatialMotionEvidence(animation: SpatialAnimatic, aspectRatio: string, controlledObject: string, upload: (blob: Blob) => Promise<string>, retain: () => Promise<void>): Promise<SpatialMotionEvidence> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(motionEvidencePlanText(animation.plan, aspectRatio, animation.authoring)));
    const planKey = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    if (animation.motionEvidence?.animationId !== animation.id || animation.motionEvidence.planKey !== planKey || animation.motionEvidence.aspectRatio !== aspectRatio) {
        animation.motionEvidence = { animationId: animation.id, planKey, aspectRatio, frames: [] };
        delete animation.guidance;
    }
    const evidence = animation.motionEvidence;
    const times = motionEvidenceTimes(animation.plan.duration);
    if (evidence.frames.length === times.length && evidence.diagram) return evidence;
    const canvas = document.createElement('canvas');
    const [width, height] = aspectRatio === '9:16' ? [540, 960] : aspectRatio === '1:1' ? [720, 720] : [960, 540];
    const renderer = createMotionRenderer(canvas, animation.plan, width, height, animation.authoring);
    try {
        for (const t of times) {
            if (evidence.frames.some(frame => frame.t === t)) continue;
            renderer.draw(t);
            const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not capture the motion image.')), 'image/png'));
            evidence.frames.push({ t, imageUrl: await upload(blob) });
            evidence.frames.sort((left, right) => left.t - right.t);
            // An interrupted upload resumes from the successful captures.
            await retain();
        }
        if (!evidence.diagram) {
            renderer.draw(0);
            const diagram = createSpatialMotionDiagram(canvas, animation.plan, controlledObject);
            const blob = await new Promise<Blob>((resolve, reject) => diagram.toBlob(value => value ? resolve(value) : reject(new Error('Could not capture the motion diagram.')), 'image/png'));
            evidence.diagram = { imageUrl: await upload(blob) };
            await retain();
        }
        return evidence;
    } finally { renderer.dispose(); }
}
