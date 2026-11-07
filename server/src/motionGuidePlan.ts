// Shared wire format. No executable AI code or external assets are accepted.
export type MotionVec3 = [number, number, number];
export type BoxSpan = { start: MotionVec3; end: MotionVec3; width: number; depth: number };
export type MotionKey = { t: number; position: MotionVec3; rotation: MotionVec3; scale: MotionVec3; span?: BoxSpan; opacity?: number };
export type MotionCameraKey = { t: number; position: MotionVec3; target: MotionVec3; fov: number; roll?: number; up?: MotionVec3 };
export type MotionShape = 'anchor' | 'bone' | 'box' | 'sphere' | 'cylinder' | 'cone' | 'capsule' | 'extrude' | 'tube' | 'text';
/** Text is painted locally; it never loads a font, URL or executable markup. */
export type MotionText = { content: string; fontFamily?: string; fontSize?: number; fontWeight?: number; italic?: boolean; align?: 'left' | 'center' | 'right'; lineHeight?: number; strokeColor?: string; strokeWidth?: number; background?: string; padding?: number };
export type MotionGeometry = { radiusTop?: number; radiusBottom?: number; outline?: [number, number][]; depth?: number; path?: MotionVec3[]; radius?: number };
export type MotionPart = { id: string; shape: MotionShape; color: string; subjectColor?: string; role?: 'actor' | 'prop' | 'scenery'; surface?: 'ground'; geometry?: MotionGeometry; text?: MotionText; identity?: string; parentId?: string; pivot?: MotionVec3; rotationMode?: 'linear' | 'quaternion'; interpolation?: 'linear' | 'step'; keys: MotionKey[] };
export type MotionObject = MotionPart & { parts?: MotionPart[]; attachment?: { objectId: string; partId?: string } };
export type MotionPlan = {
    version: 1;
    duration: number;
    background: string;
    cameraInstruction?: string;
    lightingRig?: { preset: 'studio' | 'golden' | 'noon' | 'dramatic' | 'moonlight' | 'backlit'; azimuthDeg: number; elevationDeg: number; intensity: number };
    objects: MotionObject[];
    camera: MotionCameraKey[];
};

/** Normal Motion Guide display nodes contain literal words, never reference handles.
 * Keep saved/spatial validation lossless; only the normal planning boundary calls this. */
export function cleanMotionGuideDisplayText(value: unknown): unknown {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const plan = value as Record<string, any>;
    if (!Array.isArray(plan.objects)) return value;
    const cleanNode = (node: any) => node?.shape === 'text' && typeof node.text?.content === 'string' && node.text.content.includes('@')
        ? { ...node, text: { ...node.text, content: node.text.content.replace(/@/g, '') } } : node;
    return { ...plan, objects: plan.objects.map((object: any) => {
        const cleaned = cleanNode(object);
        return Array.isArray(object?.parts) ? { ...cleaned, parts: object.parts.map(cleanNode) } : cleaned;
    }) };
}

const record = (v: unknown): Record<string, any> => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Expected a motion object.');
    return v as Record<string, any>;
};
const number = (v: unknown, min: number, max: number): number => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Error('Motion value out of range.');
    return v;
};
const vector = (v: unknown, min = -100, max = 100): MotionVec3 => {
    if (!Array.isArray(v) || v.length !== 3) throw new Error('Expected a three-component vector.');
    return v.map(n => number(n, min, max)) as MotionVec3;
};
const color = (v: unknown): string => {
    if (typeof v !== 'string' || !/^#[\da-f]{6}$/i.test(v)) throw new Error('Expected a hex color.');
    return v;
};
const timeline = <T extends { t: number }>(v: unknown, duration: number, parse: (k: Record<string, any>) => T): T[] => {
    if (!Array.isArray(v) || v.length < 2 || v.length > 96) throw new Error('Use 2–96 keyframes per track.');
    const keys = v.map(k => parse(record(k)));
    if (keys[0].t !== 0 || Math.abs(keys[keys.length - 1].t - duration) > 0.001) throw new Error('Tracks must span the full duration.');
    keys.forEach((k, i) => { if (i > 0 && k.t <= keys[i - 1].t) throw new Error('Keyframe times must increase.'); });
    return keys;
};
const id = (value: unknown): string => {
    if (typeof value !== 'string' || !/^[\w-]{1,48}$/.test(value)) throw new Error('Use a valid motion ID.');
    return value;
};
/** Geometry is bounded data, rendered with the Three.js already in the app. */
function appearance(value: Record<string, any>) {
    if (!['anchor', 'bone', 'box', 'sphere', 'cylinder', 'cone', 'capsule', 'extrude', 'tube', 'text'].includes(value.shape)) throw new Error('Unsupported primitive.');
    let text: MotionText | undefined;
    if (value.shape === 'text') {
        const raw = record(value.text);
        if (typeof raw.content !== 'string' || !raw.content.trim() || raw.content.length > 8000) throw new Error('Text needs 1–8000 characters.');
        text = { content: raw.content };
        if (raw.fontFamily !== undefined) {
            if (typeof raw.fontFamily !== 'string' || !raw.fontFamily.trim() || raw.fontFamily.length > 120) throw new Error('Use a local font family.');
            text.fontFamily = raw.fontFamily;
        }
        if (raw.fontSize !== undefined) text.fontSize = number(raw.fontSize, 8, 256);
        if (raw.fontWeight !== undefined) text.fontWeight = number(raw.fontWeight, 100, 900);
        if (raw.italic !== undefined) { if (typeof raw.italic !== 'boolean') throw new Error('Invalid text style.'); text.italic = raw.italic; }
        if (raw.align !== undefined) { if (!['left', 'center', 'right'].includes(raw.align)) throw new Error('Invalid text alignment.'); text.align = raw.align; }
        if (raw.lineHeight !== undefined) text.lineHeight = number(raw.lineHeight, .5, 3);
        if (raw.strokeColor !== undefined) text.strokeColor = color(raw.strokeColor);
        if (raw.strokeWidth !== undefined) text.strokeWidth = number(raw.strokeWidth, 0, 16);
        if (raw.background !== undefined) text.background = color(raw.background);
        if (raw.padding !== undefined) text.padding = number(raw.padding, 0, 128);
    } else if (value.text !== undefined) throw new Error('Text data needs shape text.');
    let geometry: MotionGeometry | undefined;
    if (value.geometry !== undefined) {
        const g = record(value.geometry);
        geometry = {};
        for (const name of ['radiusTop', 'radiusBottom'] as const) if (g[name] !== undefined) geometry[name] = number(g[name], 0, 1);
        if (g.depth !== undefined) geometry.depth = number(g.depth, .01, 2);
        if (g.radius !== undefined) geometry.radius = number(g.radius, .01, 1);
        if (g.outline !== undefined) {
            if (!Array.isArray(g.outline) || g.outline.length < 3 || g.outline.length > 64) throw new Error('An outline needs 3–64 points.');
            geometry.outline = g.outline.map((point: unknown) => {
                if (!Array.isArray(point) || point.length !== 2) throw new Error('Outline points need two coordinates.');
                return point.map(n => number(n, -2, 2)) as [number, number];
            });
            const points = geometry.outline!;
            const area = points.reduce((sum, point, i) => { const next = points[(i + 1) % points.length]; return sum + point[0] * next[1] - next[0] * point[1]; }, 0);
            if (Math.abs(area) < 1e-6) throw new Error('An outline must enclose an area.');
        }
        if (g.path !== undefined) {
            if (!Array.isArray(g.path) || g.path.length < 2 || g.path.length > 64) throw new Error('A tube needs 2–64 path points.');
            geometry.path = g.path.map((point: unknown) => vector(point, -2, 2));
            if (!geometry.path!.some((point, i, points) => i > 0 && Math.hypot(...point.map((n, axis) => n - points[i - 1][axis])) > 1e-5)) throw new Error('A tube path needs length.');
        }
    }
    if (value.shape === 'extrude' && !geometry?.outline) throw new Error('Extruded geometry needs an outline.');
    if (value.shape === 'tube' && !geometry?.path) throw new Error('Tube geometry needs a path.');
    if (value.shape === 'cylinder' && geometry?.radiusTop === 0 && geometry.radiusBottom === 0) throw new Error('A cylinder needs a nonzero radius.');
    if (value.rotationMode !== undefined && !['linear', 'quaternion'].includes(value.rotationMode)) throw new Error('Unsupported rotation interpolation.');
    if (value.interpolation !== undefined && !['linear', 'step'].includes(value.interpolation)) throw new Error('Unsupported track interpolation.');
    if (value.identity !== undefined && (typeof value.identity !== 'string' || !value.identity.trim() || value.identity.length > 160)) throw new Error('Use a short equipment/rider identity.');
    return { shape: value.shape as MotionShape, color: color(value.color), ...(typeof value.subjectColor === 'string' && /^#[\da-f]{6}$/i.test(value.subjectColor) ? { subjectColor: value.subjectColor } : {}), ...(['actor', 'prop', 'scenery'].includes(value.role) ? { role: value.role as MotionPart['role'] } : {}), ...(value.surface === 'ground' ? { surface: 'ground' as const } : {}), ...(geometry ? { geometry } : {}),
        ...(text ? { text } : {}),
        ...(value.identity ? { identity: value.identity.trim() } : {}),
        ...(value.pivot !== undefined ? { pivot: vector(value.pivot, -10, 10) } : {}),
        ...(value.rotationMode ? { rotationMode: value.rotationMode as 'linear' | 'quaternion' } : {}),
        ...(value.interpolation ? { interpolation: value.interpolation as 'linear' | 'step' } : {}) };
}
const opacity = (key: Record<string, any>) => key.opacity === undefined ? {} : { opacity: number(key.opacity, 0, 1) };
function acyclic(items: Array<{ id: string }>, parent: (id: string) => string | undefined) {
    const complete = new Set<string>();
    for (const item of items) {
        const visiting = new Set<string>(); let next: string | undefined = item.id;
        while (next && !complete.has(next)) {
            if (visiting.has(next)) throw new Error('Motion attachments cannot contain a cycle.');
            visiting.add(next); next = parent(next);
        }
        visiting.forEach(key => complete.add(key));
    }
}
export function validateMotionPlan(value: unknown): MotionPlan {
    const p = record(value);
    if (p.version !== 1) throw new Error('Unsupported motion plan version.');
    const duration = number(p.duration, 2, 15);
    if (!Array.isArray(p.objects) || p.objects.length < 1) throw new Error('Include at least one scene object.');
    const ids = new Set<string>();
    const objects: MotionPlan['objects'] = p.objects.map((raw: unknown) => {
        const o = record(raw);
        if (typeof o.id !== 'string' || !/^[\w-]{1,48}$/.test(o.id) || ids.has(o.id)) throw new Error('Object IDs must be unique.');
        ids.add(o.id);
        let parts: MotionPart[] | undefined;
        if (o.parts !== undefined) {
            if (!Array.isArray(o.parts) || o.parts.length < 1) throw new Error('Include at least one local part when parts are supplied.');
            const partIds = new Set<string>();
            parts = o.parts.map((rawPart: unknown) => {
                const part = record(rawPart);
                if (typeof part.id !== 'string' || !/^[\w-]{1,48}$/.test(part.id) || partIds.has(part.id)) throw new Error('Part IDs must be unique within each object.');
                partIds.add(part.id);
                return { id: part.id, ...appearance(part), ...(part.parentId !== undefined ? { parentId: id(part.parentId) } : {}), keys: timeline(part.keys, duration, k => ['box', 'bone'].includes(part.shape) && k.span && !part.pivot ? boxSpanKey(number(k.t, 0, duration), {
                    start: vector(k.span.start), end: vector(k.span.end), width: number(k.span.width, .01, 100), depth: number(k.span.depth, .01, 100),
                }) : ({
                    t: number(k.t, 0, duration), position: vector(k.position), rotation: vector(k.rotation, -32, 32), scale: vector(k.scale, 0.01, 100), ...opacity(k),
                })) };
            });
            for (const part of parts) if (part.parentId && !partIds.has(part.parentId)) throw new Error('Part parent is missing.');
            for (const part of parts) if (part.shape === 'anchor') {
                const parent = parts.find(candidate => candidate.id === part.parentId);
                if (parent?.shape === 'bone' || parent?.shape === 'box' && parent.keys.some(key => key.span)) part.keys = parent.keys.map(key => ({ t: key.t,
                    position: [0, (key.span ? Math.hypot(...key.span.end.map((n, i) => n - key.span!.start[i])) : key.scale[1]) / (2 * key.scale[1]), 0],
                    rotation: [0, 0, 0], scale: key.scale.map(n => 1 / n) as MotionVec3 }));
            }
            acyclic(parts, key => parts!.find(part => part.id === key)?.parentId);
        }
        const attachment = o.attachment == null ? undefined : record(o.attachment);
        return { id: o.id, ...appearance(o), ...(parts ? { parts } : {}),
            ...(attachment ? { attachment: { objectId: id(attachment.objectId), ...(attachment.partId !== undefined ? { partId: id(attachment.partId) } : {}) } } : {}), keys: timeline(o.keys, duration, k => ({
            t: number(k.t, 0, duration), position: vector(k.position), rotation: vector(k.rotation, -32, 32), scale: vector(k.scale, 0.01, 100), ...opacity(k),
        })) };
    });
    for (const object of objects) if (object.attachment) {
        const owner = objects.find(candidate => candidate.id === object.attachment!.objectId);
        if (!owner || object.attachment.partId && !owner.parts?.some(part => part.id === object.attachment!.partId)) throw new Error('Attachment anchor is missing.');
    }
    acyclic(objects, key => objects.find(object => object.id === key)?.attachment?.objectId);
    const camera = timeline(p.camera, duration, k => {
        const position = vector(k.position), target = vector(k.target);
        if (Math.hypot(...position.map((n, i) => n - target[i])) < 0.01) throw new Error('Camera must look away from its position.');
        const roll = k.roll !== undefined ? number(k.roll, -3.15, 3.15) : undefined;
        const up = k.up !== undefined ? vector(k.up) : undefined;
        if (up && Math.hypot(...up) < 1e-9) throw new Error('Camera up must be nonzero.');
        return { t: number(k.t, 0, duration), position, target, fov: number(k.fov, 8, 135), ...(roll !== undefined ? { roll } : {}), ...(up ? { up } : {}) };
    });
    if (p.cameraInstruction !== undefined && (typeof p.cameraInstruction !== 'string' || p.cameraInstruction.length > 4000)) throw new Error('Invalid camera instruction.');
    let lightingRig: MotionPlan['lightingRig'];
    if (p.lightingRig !== undefined) {
        const lighting = record(p.lightingRig);
        if (!['studio', 'golden', 'noon', 'dramatic', 'moonlight', 'backlit'].includes(lighting.preset)) throw new Error('Invalid scene lighting.');
        lightingRig = { preset: lighting.preset, azimuthDeg: number(lighting.azimuthDeg, -360, 360), elevationDeg: number(lighting.elevationDeg, 8, 88), intensity: number(lighting.intensity, .25, 2.5) };
    }
    return { version: 1, duration, background: color(p.background), objects, camera, ...(lightingRig ? { lightingRig } : {}),
        ...(p.cameraInstruction?.trim() ? { cameraInstruction: p.cameraInstruction.trim() } : {}) };
}

/** Shared endpoints keep adjacent box limbs joined even between keyframes.
 * Persist ordinary TRS too, so snapshots and older transform consumers work. */
export function boxSpanKey(t: number, span: BoxSpan): MotionKey {
    const [x, y, z] = span.end.map((n, i) => n - span.start[i]);
    const length = Math.hypot(x, y, z);
    return { t, span, position: span.start.map((n, i) => (n + span.end[i]) / 2) as MotionVec3,
        rotation: [Math.atan2(z, y), 0, -Math.atan2(x, Math.hypot(y, z))],
        scale: [span.width, Math.max(.01, length) + Math.min(span.width, span.depth) * .08, span.depth] };
}
export function spanFromKey(key: MotionKey): BoxSpan {
    if (key.span) return key.span;
    const [x, y, z] = key.rotation;
    const axis = [-Math.cos(y) * Math.sin(z), Math.cos(x) * Math.cos(z) - Math.sin(x) * Math.sin(y) * Math.sin(z), Math.sin(x) * Math.cos(z) + Math.cos(x) * Math.sin(y) * Math.sin(z)];
    return { start: key.position.map((n, i) => n - axis[i] * key.scale[1] / 2) as MotionVec3,
        end: key.position.map((n, i) => n + axis[i] * key.scale[1] / 2) as MotionVec3, width: key.scale[0], depth: key.scale[2] };
}
export function interpolateBoxSpan(a: MotionKey, b: MotionKey, t: number): MotionKey {
    const from = spanFromKey(a), to = spanFromKey(b);
    const lerp = (x: number, y: number) => x + (y - x) * t;
    return boxSpanKey(lerp(a.t, b.t), { start: from.start.map((n, i) => lerp(n, to.start[i])) as MotionVec3,
        end: from.end.map((n, i) => lerp(n, to.end[i])) as MotionVec3,
        width: lerp(from.width, to.width), depth: lerp(from.depth, to.depth) });
}

export function motionSegment<T extends { t: number }>(keys: T[], time: number): [T, T, number] {
    const next = keys.findIndex(k => k.t > time);
    if (next === 0) return [keys[0], keys[0], 0];
    if (next < 0) return [keys[keys.length - 1], keys[keys.length - 1], 0];
    const a = keys[next - 1], b = keys[next];
    return [a, b, (time - a.t) / (b.t - a.t)];
}
