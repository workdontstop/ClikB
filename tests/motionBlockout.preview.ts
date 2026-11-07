import { createMotionRenderer } from '../src/motionGuideRenderer';
import type { MotionPlan } from '../src/motionGuide';
let dispose: (() => void) | undefined;
(window as any).renderBlockout = (plan: MotionPlan) => {
    dispose?.(); document.body.innerHTML = ''; document.body.style.margin = '0';
    const canvas = document.createElement('canvas'); document.body.appendChild(canvas);
    const renderer = createMotionRenderer(canvas, plan, 720, 1280); dispose = renderer.dispose;
    renderer.draw(0); return canvas.toDataURL('image/jpeg', .85);
};
