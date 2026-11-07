import { createMotionRenderer } from './motionGuideRenderer';
import type { MotionPlan } from './motionGuide';

/** One frame, same renderer/aspect as the editor; no upload or stored media. */
export function motionBlockoutPreview(plan: MotionPlan, aspect: string): string {
    const canvas = document.createElement('canvas');
    const [width, height] = aspect === '9:16' ? [432, 768] : aspect === '1:1' ? [640, 640] : [768, 432];
    const renderer = createMotionRenderer(canvas, plan, width, height);
    try { renderer.draw(0); return canvas.toDataURL('image/jpeg', .85); }
    finally { renderer.dispose(); }
}
