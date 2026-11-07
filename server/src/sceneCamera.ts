import type { MotionCameraKey, MotionPlan, MotionVec3 } from './motionGuidePlan';
import { initialMotionMatrix } from './motionNodeTransforms';
import type { SceneAuthoringDraft } from './sceneAuthoring';

type Target = { objectId: string; partId?: string };
type Optical = {
    focalLengthMm: number;
    aspect?: number;
    sensorWidthMm?: number;
    sensorHeightMm?: number;
    offset?: MotionVec3;
    targetOffset?: MotionVec3;
    roll?: number;
};
export type SceneCameraRig = Optical & (
    | { kind: 'free' }
    | { kind: 'mounted'; target: Target; offset: MotionVec3; lookOffset: MotionVec3 }
    | { kind: 'orbit'; target: Target; radius: number; height: number; turns: number }
    | { kind: 'overhead'; target: Target; height: number; heading: number }
    | { kind: 'zolly'; target: Target; startDistance: number; endDistance: number; height: number }
    | { kind: 'crash'; target: Target; endFocalLengthMm: number; startTime: number; zoomDuration: number }
);
export type SceneLightingPreset = 'studio' | 'golden' | 'noon' | 'dramatic' | 'moonlight' | 'backlit';
export type SceneLightingRig = {
    preset: SceneLightingPreset;
    azimuthDeg: number;
    elevationDeg: number;
    intensity: number;
};
export const LIGHTING_PRESETS: readonly SceneLightingPreset[] = ['studio', 'golden', 'noon', 'dramatic', 'moonlight', 'backlit'] as const;
export function defaultLightingRigForPreset(preset: SceneLightingPreset): SceneLightingRig {
    switch (preset) {
        case 'golden': return { preset, azimuthDeg: -55, elevationDeg: 22, intensity: 1.1 };
        case 'noon': return { preset, azimuthDeg: -15, elevationDeg: 78, intensity: 1.2 };
        case 'dramatic': return { preset, azimuthDeg: 65, elevationDeg: 35, intensity: 1.25 };
        case 'moonlight': return { preset, azimuthDeg: 40, elevationDeg: 48, intensity: 0.85 };
        case 'backlit': return { preset, azimuthDeg: 165, elevationDeg: 28, intensity: 1.15 };
        case 'studio':
        default:
            return { preset: 'studio', azimuthDeg: -34, elevationDeg: 48, intensity: 1 };
    }
}
export function describeSceneLighting(lighting: SceneLightingRig): string {
    const label = lighting.preset === 'golden'
        ? 'warm golden-hour key light'
        : lighting.preset === 'noon'
            ? 'high overhead daylight key'
            : lighting.preset === 'dramatic'
                ? 'high-contrast side key with cool rim'
                : lighting.preset === 'moonlight'
                    ? 'cool nocturnal moonlight key'
                    : lighting.preset === 'backlit'
                        ? 'strong silhouette backlight with rim separation'
                        : 'balanced neutral studio key and fill';
    return `LIGHTING: ${label}, key azimuth ${Math.round(lighting.azimuthDeg)}°, elevation ${Math.round(lighting.elevationDeg)}°, relative intensity ${Number(lighting.intensity.toFixed(2))}x.`;
}
export type PrototypeCameraKey = MotionCameraKey & { up: MotionVec3 };
export const LENS_PRESETS_MM = [9, 16, 24, 35, 50, 85, 135] as const;

const length = (v: MotionVec3) => Math.hypot(...v);
const normal = (v: MotionVec3): MotionVec3 => {
    const n = length(v);
    if (n < 1e-9) throw new Error('Camera direction cannot be zero.');
    return v.map(x => x / n) as MotionVec3;
};
const point = (matrix: number[], p: MotionVec3): MotionVec3 =>
    [0, 1, 2].map(row => matrix[row * 4] * p[0] + matrix[row * 4 + 1] * p[1] + matrix[row * 4 + 2] * p[2] + matrix[row * 4 + 3]) as MotionVec3;
const direction = (matrix: number[], p: MotionVec3): MotionVec3 =>
    normal([0, 1, 2].map(row => matrix[row * 4] * p[0] + matrix[row * 4 + 1] * p[1] + matrix[row * 4 + 2] * p[2]) as MotionVec3);

/** Rectilinear optics with a declared sensor and centered crop to output aspect. */
export function focalLengthToVerticalFov(focalLengthMm: number, aspect = 16 / 9, sensorWidthMm = 36, sensorHeightMm = 24) {
    if (![focalLengthMm, aspect, sensorWidthMm, sensorHeightMm].every(n => Number.isFinite(n) && n > 0)) {
        throw new Error('Lens, sensor and aspect must be positive finite values.');
    }
    const effectiveHeight = Math.min(sensorHeightMm, sensorWidthMm / aspect);
    return (2 * Math.atan(effectiveHeight / (2 * focalLengthMm)) * 180) / Math.PI;
}

export function dollyZoomFov(initialFov: number, initialDistance: number, distance: number) {
    if (![initialFov, initialDistance, distance].every(Number.isFinite) || initialFov <= 0 || initialFov >= 179 || initialDistance <= 0 || distance <= 0) {
        throw new Error('Invalid dolly-zoom geometry.');
    }
    return (2 * Math.atan((Math.tan((initialFov * Math.PI) / 360) * initialDistance) / distance) * 180) / Math.PI;
}

export function safeCameraUp(position: MotionVec3, target: MotionVec3, preferred: MotionVec3 = [0, 1, 0], heading = 0): MotionVec3 {
    const forward = normal(target.map((n, i) => n - position[i]) as MotionVec3), up = normal(preferred);
    const dot = forward.reduce((sum, n, i) => sum + n * up[i], 0);
    if (Math.abs(dot) < .9999) return up;
    let alternate: MotionVec3 = [Math.sin(heading), 0, Math.cos(heading)];
    if (Math.abs(alternate.reduce((sum, n, i) => sum + n * forward[i], 0)) > .9999) {
        const axes: MotionVec3[] = [[0, 1, 0], [0, 0, 1], [1, 0, 0]];
        axes.sort((a, b) => Math.abs(a.reduce((s, n, i) => s + n * forward[i], 0)) - Math.abs(b.reduce((s, n, i) => s + n * forward[i], 0)));
        alternate = axes[0];
    }
    return normal(alternate.map((n, i) => n - forward[i] * alternate.reduce((sum, a, j) => sum + a * forward[j], 0)) as MotionVec3);
}

export function resolveSceneCamera(rig: SceneCameraRig | undefined, frame: MotionPlan, time: number): PrototypeCameraKey {
    const base = frame.camera[0];
    const camera: PrototypeCameraKey = { ...base, position: [...base.position], target: [...base.target], up: safeCameraUp(base.position, base.target, base.up) };
    if (!rig) return camera;
    camera.fov = focalLengthToVerticalFov(rig.focalLengthMm, rig.aspect, rig.sensorWidthMm, rig.sensorHeightMm);
    if (camera.fov <= .1 || camera.fov >= 179) throw new Error('The lens is outside the prototype camera projection range.');
    if (rig.roll !== undefined) {
        if (!Number.isFinite(rig.roll)) throw new Error('Camera roll must be finite.');
        camera.roll = rig.roll;
    }
    const progress = Math.max(0, Math.min(1, time / frame.duration));
    if (rig.kind === 'free') {
        if (rig.offset) camera.position = camera.position.map((n, i) => n + (rig.offset![i] || 0)) as MotionVec3;
        if (rig.targetOffset) camera.target = camera.target.map((n, i) => n + (rig.targetOffset![i] || 0)) as MotionVec3;
        if (Math.hypot(...camera.target.map((n, i) => n - camera.position[i])) < 1e-6) {
            camera.target = [camera.position[0], camera.position[1], camera.position[2] - 1];
        }
        camera.up = safeCameraUp(camera.position, camera.target, camera.up);
        return camera;
    }
    const matrix = initialMotionMatrix(frame, rig.target.objectId, rig.target.partId), target = point(matrix, [0, 0, 0]);
    if (rig.kind === 'mounted') {
        camera.position = point(matrix, rig.offset);
        camera.target = point(matrix, rig.lookOffset);
        camera.up = safeCameraUp(camera.position, camera.target, direction(matrix, [0, 1, 0]));
    } else if (rig.kind === 'orbit') {
        if (!Number.isFinite(rig.turns) || !Number.isFinite(rig.radius) || rig.radius <= 0 || !Number.isFinite(rig.height)) throw new Error('Invalid orbital camera.');
        const angle = progress * Math.PI * 2 * rig.turns;
        camera.position = [target[0] + Math.sin(angle) * rig.radius, target[1] + rig.height, target[2] + Math.cos(angle) * rig.radius];
        camera.target = target;
    } else if (rig.kind === 'overhead') {
        if (!Number.isFinite(rig.height) || rig.height <= 0 || !Number.isFinite(rig.heading)) throw new Error('Invalid overhead camera.');
        camera.position = [target[0], target[1] + rig.height, target[2]];
        camera.target = target;
        camera.up = safeCameraUp(camera.position, camera.target, [0, 1, 0], rig.heading);
    } else if (rig.kind === 'zolly') {
        if (![rig.startDistance, rig.endDistance].every(n => Number.isFinite(n) && n > 0)) throw new Error('Dolly-zoom distances must be positive.');
        const distance = rig.startDistance + (rig.endDistance - rig.startDistance) * progress;
        if (!Number.isFinite(rig.height)) throw new Error('Invalid dolly-zoom height.');
        camera.target = target;
        camera.position = [target[0], target[1] + rig.height, target[2] + distance];
        camera.fov = dollyZoomFov(camera.fov, Math.hypot(rig.startDistance, rig.height), Math.hypot(distance, rig.height));
    } else if (rig.kind === 'crash') {
        if (!Number.isFinite(rig.startTime) || !Number.isFinite(rig.zoomDuration) || rig.zoomDuration <= 0) throw new Error('Invalid crash-zoom timing.');
        const fraction = Math.max(0, Math.min(1, (time - rig.startTime) / rig.zoomDuration)), ease = fraction * fraction * (3 - 2 * fraction);
        camera.fov = focalLengthToVerticalFov(rig.focalLengthMm + (rig.endFocalLengthMm - rig.focalLengthMm) * ease, rig.aspect, rig.sensorWidthMm, rig.sensorHeightMm);
        camera.target = target;
    }
    if (rig.targetOffset) {
        camera.target = camera.target.map((n, i) => n + (rig.targetOffset![i] || 0)) as MotionVec3;
    }
    if (![...camera.position, ...camera.target, ...camera.up, camera.fov].every(Number.isFinite) || camera.fov <= .1 || camera.fov >= 179) {
        throw new Error('The camera rig produced invalid optics.');
    }
    camera.up = safeCameraUp(camera.position, camera.target, camera.up);
    return camera;
}

/** Text derives from the evaluated rig; it does not invent a second camera. */
export function describeSceneCamera(rig: SceneCameraRig) {
    const optics = `${rig.focalLengthMm} mm rectilinear lens, ${rig.sensorWidthMm || 36} × ${rig.sensorHeightMm || 24} mm sensor cropped to ${Number((rig.aspect || 16 / 9).toFixed(3))}:1`;
    const rollText = rig.roll ? `, dutch roll ${Math.round((rig.roll * 180) / Math.PI)}°` : '';
    if (rig.kind === 'mounted') return `CAMERA: body-mounted SnorriCam on ${rig.target.objectId}${rig.target.partId ? '/' + rig.target.partId : ''}; local camera and look offsets follow the subject's full transform${rollText}. ${optics}.`;
    if (rig.kind === 'zolly') return `CAMERA: dolly zoom from ${rig.startDistance} m to ${rig.endDistance} m with compensating field of view to preserve reference-plane framing${rollText}. ${optics}.`;
    if (rig.kind === 'overhead') return `CAMERA: perpendicular overhead at ${rig.height} m with stable heading ${rig.heading} rad${rollText}. ${optics}.`;
    if (rig.kind === 'orbit') return `CAMERA: ${rig.turns * 360}° orbit, radius ${rig.radius} m, target-relative height ${rig.height} m${rollText}. ${optics}.`;
    if (rig.kind === 'crash') return `CAMERA: ${rig.focalLengthMm}–${rig.endFocalLengthMm} mm crash zoom over ${rig.zoomDuration} s starting at ${rig.startTime} s; target locked to ${rig.target.objectId}${rollText}. ${optics}.`;
    const offsetText = rig.offset && rig.offset.some(n => Math.abs(n) > 1e-4) ? ` (manual offset [${rig.offset.map(n => Number(n.toFixed(2))).join(', ')}] m)` : '';
    return `CAMERA: authored position, look target and roll${offsetText}${rollText}. ${optics}.`;
}

/** Compile downstream camera guidance from actual authored content/rigs (P06-13, P06-14, P06-15). */
export function compileDownstreamCameraGuidance(plan: MotionPlan, authoring?: SceneAuthoringDraft, aspect: string = '16:9'): string {
    const ratio = aspect === '9:16' ? 9 / 16 : aspect === '1:1' ? 1 : 16 / 9;
    const lightingNote = authoring?.lightingRig ? ` ${describeSceneLighting(authoring.lightingRig)}` : '';
    if (authoring?.cameraRig) {
        return `${describeSceneCamera({ ...authoring.cameraRig, aspect: ratio })}${lightingNote} Blockout geometry defines exact camera trajectory and rectilinear framing; optical depth-of-field and lens finishing belong to final video synthesis.`;
    }
    const keys = plan.camera;
    const first = keys[0], last = keys.at(-1) || first;
    const travel = Math.hypot(...last.position.map((n, i) => n - first.position[i]));
    const pan = Math.hypot(...last.target.map((n, i) => n - first.target[i]));
    const fovDelta = Math.abs(last.fov - first.fov);
    const rollDelta = Math.abs((last.roll || 0) - (first.roll || 0));
    const parts: string[] = [];
    if (travel < .04 && pan < .04 && fovDelta < .5 && rollDelta < .02) {
        parts.push(`CAMERA: locked tripod framing (${first.fov.toFixed(1)}° vertical FOV).`);
    } else {
        if (travel >= .04) parts.push(`camera translates ${travel.toFixed(2)} m`);
        if (pan >= .04) parts.push(`look target shifts ${pan.toFixed(2)} m`);
        if (fovDelta >= .5) parts.push(`vertical FOV transitions from ${first.fov.toFixed(1)}° to ${last.fov.toFixed(1)}°`);
        if (rollDelta >= .02) parts.push(`dutch roll changes by ${((last.roll || 0) - (first.roll || 0)).toFixed(2)} rad`);
        parts.push(`CAMERA: ${parts.splice(0, parts.length).join('; ')} over ${plan.duration} s.`);
    }
    if (lightingNote) parts.push(lightingNote.trim());
    return parts.join(' ');
}
