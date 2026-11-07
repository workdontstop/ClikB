import { PerspectiveCamera, Vector3 } from 'three';
import type { MotionPlan } from '../server/src/motionGuidePlan';

/** An annotated 3D route map for interpretation and video direction guidance. */
export function createSpatialMotionDiagram(source: HTMLCanvasElement, plan: MotionPlan, controlledObject: string): HTMLCanvasElement {
    const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not draw the motion diagram.');
    ctx.drawImage(source, 0, 0);
    const controlled = plan.objects.find(object => object.id === controlledObject)!;
    const label = (text: string, x: number, y: number, color = '#ffffff') => {
        ctx.font = `${Math.max(12, Math.round(canvas.width / 48))}px sans-serif`;
        const width = ctx.measureText(text).width + 10;
        x = Math.max(0, Math.min(canvas.width - width, x)); y = Math.max(22, Math.min(canvas.height - 8, y));
        ctx.fillStyle = 'rgba(0,0,0,.82)'; ctx.fillRect(x, y - 20, width, 26);
        ctx.fillStyle = color; ctx.fillText(text, x + 5, y);
    };
    const arrow = (start: number[], end: number[], color: string) => {
        if (Math.hypot(end[0] - start[0], end[1] - start[1]) < 2) return;
        ctx.strokeStyle = '#111111'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(start[0], start[1]); ctx.lineTo(end[0], end[1]); ctx.stroke();
        ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
        const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
        ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(end[0], end[1]);
        ctx.lineTo(end[0] - 11 * Math.cos(angle - .5), end[1] - 11 * Math.sin(angle - .5));
        ctx.lineTo(end[0] - 11 * Math.cos(angle + .5), end[1] - 11 * Math.sin(angle + .5)); ctx.closePath(); ctx.fill();
    };
    const cameraState = plan.camera[0];
    const camera = new PerspectiveCamera(cameraState.fov, canvas.width / canvas.height, .01, 1000);
    camera.position.fromArray(cameraState.position); camera.lookAt(new Vector3(...cameraState.target)); camera.updateMatrixWorld();
    const project = (position: number[]) => { const p = new Vector3(...position).project(camera); return [(p.x + 1) * canvas.width / 2, (1 - p.y) * canvas.height / 2, p.z]; };
    const visible = (p: number[]) => p[2] >= -1 && p[2] <= 1 && p[0] >= 0 && p[0] <= canvas.width && p[1] >= 0 && p[1] <= canvas.height;
    for (const object of plan.objects) {
        const point = project(object.keys[0].position);
        if (visible(point)) label(object.id, point[0], point[1], object.id === controlledObject ? '#5cf6d4' : '#ffffff');
    }
    const projected = controlled.keys.map(key => project(key.position));
    for (let index = 1; index < projected.length; index++) if (visible(projected[index - 1]) && visible(projected[index])) arrow(projected[index - 1], projected[index], '#5cf6d4');
    if (visible(projected[0])) label('START · 0s', projected[0][0], projected[0][1] + 30, '#5cf6d4');
    if (visible(projected.at(-1)!)) label(`STOP · ${plan.duration}s`, projected.at(-1)![0], projected.at(-1)![1] + 30, '#ffcd77');
    // A labelled top view retains the entire route when the source perspective
    // crops its endpoint. Its coordinates come from the same X/Z keyframes.
    const insetWidth = canvas.width * .44, insetHeight = canvas.height * .28, left = canvas.width - insetWidth - 12, top = canvas.height - insetHeight - 12;
    ctx.fillStyle = 'rgba(0,0,0,.88)'; ctx.fillRect(left, top, insetWidth, insetHeight);
    const positions = [...controlled.keys.map(key => key.position), ...plan.objects.map(object => object.keys[0].position)];
    const bounds = [0, 2].map(axis => [Math.min(...positions.map(p => p[axis])) - .5, Math.max(...positions.map(p => p[axis])) + .5]);
    const topView = (position: number[]) => [left + 18 + (position[0] - bounds[0][0]) / (bounds[0][1] - bounds[0][0]) * (insetWidth - 36), top + 32 + (position[2] - bounds[1][0]) / (bounds[1][1] - bounds[1][0]) * (insetHeight - 50)];
    label('TOP VIEW · X/Z · metres', left + 4, top + 21);
    for (const object of plan.objects) {
        const point = topView(object.keys[0].position); ctx.fillStyle = object.color; ctx.fillRect(point[0] - 3, point[1] - 3, 6, 6);
        if (object.id !== controlledObject) label(object.id, point[0] + 4, point[1]);
    }
    const path = controlled.keys.map(key => topView(key.position));
    for (let index = 1; index < path.length; index++) arrow(path[index - 1], path[index], '#5cf6d4');
    label('START', path[0][0], path[0][1], '#5cf6d4'); label('STOP', path.at(-1)![0], path.at(-1)![1] + 20, '#ffcd77');
    label(`MOTION PLAN · ${controlledObject} · arrows show time direction`, 10, 24);
    return canvas;
}
