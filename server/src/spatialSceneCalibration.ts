import type { MotionKey, MotionPart, MotionPlan, MotionVec3 } from './motionGuidePlan';
import { initialMotionMatrix } from './motionNodeTransforms';

export type SceneLayout = { landmarks: Array<{ id: string; description: string; box: [number, number, number, number]; occluded: boolean }>; camera: string };

/** Measurements are taken from the source image BEFORE geometry is proposed. */
export function validateSceneLayout(value: any): SceneLayout {
    if (!Array.isArray(value?.landmarks) || !value.landmarks.length || value.landmarks.length > 256 || typeof value.camera !== 'string' || !value.camera.trim()) throw new Error('Scene analysis did not identify its visible layout and perspective.');
    // Vision can name a held object as "owner.item". Normalize that notation
    // to the scene ID alphabet before handing the inventory to authoring;
    // one punctuation mark must not discard all measured scene landmarks.
    const landmarks = value.landmarks.map((item: any) => ({ ...item,
        id: typeof item?.id === 'string' ? item.id.replace(/\./g, '_') : item?.id }));
    const ids = new Set<string>();
    for (const item of landmarks) {
        if (!/^[A-Za-z0-9_-]{1,48}$/.test(item?.id) || ids.has(item.id) || typeof item.description !== 'string' || !item.description.trim()
            || !Array.isArray(item.box) || item.box.length !== 4 || !item.box.every((n: any) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1)
            || item.box[2] <= 0 || item.box[3] <= 0 || item.box[0] + item.box[2] > 1.001 || item.box[1] + item.box[3] > 1.001 || typeof item.occluded !== 'boolean') throw new Error('Scene analysis returned an invalid visible landmark.');
        ids.add(item.id);
    }
    return { ...value, landmarks };
}
const dot = (a: number[], b: number[]) => a.reduce((sum, n, i) => sum + n * b[i], 0);
const cross = (a: number[], b: number[]): MotionVec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: MotionVec3): MotionVec3 => { const length = Math.hypot(...a); return a.map(n => n / length) as MotionVec3; };
const transform = (point: MotionVec3, key: MotionKey): MotionVec3 => {
    let [x, y, z] = point.map((n, axis) => n * key.scale[axis]);
    const [rx, ry, rz] = key.rotation;
    // Three.js XYZ Euler matrix applies Z, then Y, then X to column vectors.
    [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
    [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
    [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
    return [x + key.position[0], y + key.position[1], z + key.position[2]];
};
function transformNode(point: MotionVec3, node: MotionPart): MotionVec3 {
    const pivot = node.pivot || [0, 0, 0];
    const transformed = transform(point.map((n, i) => n - pivot[i]) as MotionVec3, node.keys[0]);
    return transformed.map((n, i) => n + pivot[i]) as MotionVec3;
}
function geometryBounds(node: MotionPart): [number[], number[]] {
    const g = node.geometry;
    if (node.shape === 'tube') {
        const r = g?.radius ?? .05;
        return [[0, 1, 2].map(axis => Math.min(...g!.path!.map(point => point[axis])) - r), [0, 1, 2].map(axis => Math.max(...g!.path!.map(point => point[axis])) + r)];
    }
    const r = node.shape === 'capsule' ? .25 : node.shape === 'cylinder' ? Math.max(g?.radiusTop ?? .5, g?.radiusBottom ?? .5) : .5;
    return [[-r, -.5, -r], [r, .5, r]];
}

function geometryCorners(node: MotionPart): MotionVec3[] {
    if (node.shape === 'extrude') {
        const outline = node.geometry!.outline!, halfDepth = (node.geometry?.depth ?? .1) / 2;
        // Use the actual polygon prism, not its rectangular XY bounds: rotated
        // bounds introduce nonexistent corners that distort visible framing.
        // Each outline edge is a degenerate eight-corner group. XOR 4 follows
        // the edge, XOR 1 crosses its depth, and XOR 2 repeats the same point;
        // this retains every real near-plane crossing without phantom edges.
        return outline.flatMap((point, i) => [point, outline[(i + 1) % outline.length]].flatMap(endpoint =>
            [0, 1].flatMap(() => [-halfDepth, halfDepth].map(z => [endpoint[0], endpoint[1], z] as MotionVec3))));
    }
    const [min, max] = geometryBounds(node), corners: MotionVec3[] = [];
    for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) corners.push([x, y, z]);
    return corners;
}

/** Same camera, Euler order, unit primitives and parent-local parts as the renderer.
 * This checks visible framing/scale, not unobservable depth or texture fidelity. */
export function projectedSceneBoxes(plan: MotionPlan, aspect: string, corners = sceneWorldCorners(plan)): Record<string, number[]> {
    const cameraKey = plan.camera[0];
    const aspectRatio = aspect === '9:16' ? 9 / 16 : aspect === '1:1' ? 1 : 16 / 9;
    const direction = cameraKey.target.map((n, i) => n - cameraKey.position[i]) as MotionVec3;
    if (Math.hypot(...direction) < .00001) throw new Error('Source camera needs a distinct look-at target.');
    const forward = unit(direction);
    // Match Three.js lookAt's small tilt for a camera parallel to its up vector.
    if (Math.abs(forward[1]) === 1) { forward[2] = -.0001; Object.assign(forward, unit(forward)); }
    const cameraRight = unit(cross(forward, [0, 1, 0])), up = cross(cameraRight, forward);
    const lens = Math.tan(cameraKey.fov * Math.PI / 360);
    const boxes: Record<string, number[]> = {};
    for (const [id, vertices] of Object.entries(corners)) {
        const points: Array<{ x: number; y: number }> = [];
        const near = .05;
        const relativeVertices = vertices.map(point => point.map((n, i) => n - cameraKey.position[i]));
        const visible = relativeVertices.filter(point => dot(point, forward) >= near);
        // Corners arrive in groups of eight, with edges addressed by XOR
        // 4/2/1 (degenerate edge prisms for polygon geometry). Clip crossing
        // edges at the camera near plane:
        // dropping their rear corners turns a foreground floor into a narrow
        // distant strip and gives the camera fitter the wrong measurements.
        for (let base = 0; base + 7 < relativeVertices.length; base += 8) {
            for (let corner = 0; corner < 8; corner++) for (const axis of [1, 2, 4]) {
                const neighbor = corner ^ axis;
                if (neighbor < corner) continue;
                const a = relativeVertices[base + corner], b = relativeVertices[base + neighbor];
                const da = dot(a, forward), db = dot(b, forward);
                if ((da < near) === (db < near)) continue;
                const t = (near - da) / (db - da);
                visible.push(a.map((n, i) => n + (b[i] - n) * t));
            }
        }
        for (const relative of visible) {
            const depth = Math.max(near, dot(relative, forward));
            points.push({ x: dot(relative, cameraRight) / (depth * lens * aspectRatio), y: dot(relative, up) / (depth * lens) });
        }
        if (!points.length) continue;
        const left = Math.max(0, Math.min(1, (Math.min(...points.map(point => point.x)) + 1) / 2));
        const right = Math.max(0, Math.min(1, (Math.max(...points.map(point => point.x)) + 1) / 2));
        const top = Math.max(0, Math.min(1, (1 - Math.max(...points.map(point => point.y))) / 2));
        const bottom = Math.max(0, Math.min(1, (1 - Math.min(...points.map(point => point.y))) / 2));
        boxes[id] = [left, top, right - left, bottom - top];
    }
    return boxes;
}

export function sceneWorldCorners(plan: MotionPlan): Record<string, MotionVec3[]> {
    const corners: Record<string, MotionVec3[]> = {};
    const localPart = (point: MotionVec3, object: MotionPlan['objects'][number], part?: MotionPart): MotionVec3 => {
        while (part) { point = transformNode(point, part); part = object.parts?.find(candidate => candidate.id === part!.parentId); }
        return point;
    };
    const worldPoint = (point: MotionVec3, object: MotionPlan['objects'][number]): MotionVec3 => {
        point = transformNode(point, object);
        const anchor = object.attachment;
        if (!anchor) return point;
        const parent = plan.objects.find(candidate => candidate.id === anchor.objectId)!;
        return worldPoint(localPart(point, parent, parent.parts?.find(part => part.id === anchor.partId)), parent);
    };
    for (const object of plan.objects) {
        const points: MotionVec3[] = [];
        for (const part of object.parts?.length ? object.parts : [undefined]) {
          if ((part || object).shape === 'anchor') continue;
          for (const point of geometryCorners(part || object)) points.push(worldPoint(localPart(point, object, part), object));
        }
        corners[object.id] = points;
    }
    return corners;
}

/** One bounded local camera fit, never another AI request or a quality gate.
 * World geometry, ground contacts, attachments and recorded routes are untouched.
 * Geometry corners are cached; only camera projection is evaluated. */
export function fitSourceCamera(input: MotionPlan, layout: SceneLayout, aspect: string): MotionPlan {
    const all = sceneWorldCorners(input);
    const landmarks = layout.landmarks.filter(item => all[item.id]?.length && (!item.occluded ||
        item.box[0] < .005 || item.box[1] < .005 || item.box[0] + item.box[2] > .995 || item.box[1] + item.box[3] > .995));
    if (landmarks.length < 2) return input;
    const corners = Object.fromEntries(landmarks.map(item => [item.id, all[item.id]]));
    const original = input.camera[0];
    const plan = { ...input, camera: input.camera.map(key => ({ ...key, position: [...key.position] as MotionVec3, target: [...key.target] as MotionVec3 })) };
    const distance = Math.hypot(...original.position.map((n, i) => n - original.target[i]));
    let params = [...original.position, ...original.target, original.fov];
    const score = (p: number[]) => {
        if (p.slice(0, 6).some(n => Math.abs(n) > 100) || p[6] < 15 || p[6] > 100 || Math.hypot(p[0] - p[3], p[1] - p[4], p[2] - p[5]) < .1) return Infinity;
        plan.camera[0] = { ...original, position: p.slice(0, 3) as MotionVec3, target: p.slice(3, 6) as MotionVec3, fov: p[6] };
        const boxes = projectedSceneBoxes(plan, aspect, corners);
        return landmarks.reduce((sum, item) => {
            const box = boxes[item.id];
            if (!box || !box[2] || !box[3]) return sum + 4;
            const weight = 1 + Math.sqrt(item.box[2] * item.box[3]) * 3;
            return sum + weight * box.reduce((error, n, i) => error + (n - item.box[i]) ** 2, 0);
        }, 0) / landmarks.length;
    };
    const initial = score(params); let best = initial;
    // Fixed small work budget, independent of visual quality. No retries.
    for (const fraction of [.15, .07, .03, .012, .004]) for (let axis = 0; axis < 7; axis++) {
        const step = axis === 6 ? fraction * 60 : fraction * distance;
        let winner = params;
        for (const sign of [-1, 1]) {
            const candidate = [...params]; candidate[axis] += sign * step;
            const error = score(candidate);
            if (error < best) { best = error; winner = candidate; }
        }
        params = winner;
    }
    if (!(best < initial * .98)) return input;
    // Preserve the camera path's authored deltas in normal Motion Guides.
    plan.camera = input.camera.map(key => ({ ...key,
        position: key.position.map((n, i) => n + params[i] - original.position[i]) as MotionVec3,
        target: key.target.map((n, i) => n + params[i + 3] - original.target[i]) as MotionVec3,
        fov: Math.max(15, Math.min(100, key.fov + params[6] - original.fov)) }));
    if (plan.camera.some(key => [...key.position, ...key.target].some(n => Math.abs(n) > 100))) return input;
    return plan;
}

/** Fit independent subject units to measured screen bounds while keeping their
 * bottom at the authored ground/altitude. Attached riders/props move as a unit.
 * Only new static reconstructions use this; never saved routes or animations. */
export function fitSourceSubjects(input: MotionPlan, layout: SceneLayout, aspect: string, relationships: any[] = [], walkable: any[] = []): MotionPlan {
    const plan: MotionPlan = JSON.parse(JSON.stringify(input));
    const all = sceneWorldCorners(plan);
    const navigation = Array.isArray(walkable) && walkable.length && walkable.every(area =>
        ['min', 'max'].every(field => Array.isArray(area?.[field]) && area[field].length === 3 && area[field].every((n: any) => typeof n === 'number' && Number.isFinite(n)))
        && area.min.every((n: number, axis: number) => n <= area.max[axis])) ? walkable : undefined;
    for (const object of plan.objects) {
        if (object.role !== 'actor' || object.attachment || !all[object.id]?.length) continue;
        const supportRelations = relationships.filter(item => item.from === object.id && /^(stands_on|sits_on|rests_on|supported_by)$/.test(item.relation));
        const supported = supportRelations.length > 0;
        const item = layout.landmarks.find(item => item.id === object.id);
        if (!item || item.occluded && item.box[0] > .005 && item.box[1] > .005 && item.box[0] + item.box[2] < .995 && item.box[1] + item.box[3] < .995) continue;
        const vertices = all[object.id], first = object.keys[0];
        const bottom = Math.min(...vertices.map(point => point[1]));
        const pivot: MotionVec3 = [first.position[0], bottom, first.position[2]];
        // Match framing within the real support footprint, retaining the same
        // ground height. A bounding box of the whole support can include voids
        // and does not describe a rotated or parent-local platform correctly.
        const supportTops = supportRelations.flatMap(relation => {
            const support = plan.objects.find(candidate => candidate.id === relation.to);
            if (!support) return [];
            return (support.parts?.length ? support.parts : [support]).flatMap(part => {
                if (part.shape !== 'box' || support.parts?.length && part.surface !== 'ground' && support.surface !== 'ground'
                    && !/(^|_)(top|tabletop|surface)(_|$)/i.test(part.id)) return [];
                const matrix = initialMotionMatrix(plan, support.id, support.parts?.length ? part.id : undefined);
                const determinant = matrix[0] * matrix[10] - matrix[2] * matrix[8];
                const height = matrix[7] + matrix[5] / 2;
                if (Math.abs(matrix[4]) > .001 || Math.abs(matrix[6]) > .001 || matrix[5] <= 0
                    || Math.abs(determinant) < 1e-8 || Math.abs(height - bottom) > .03) return [];
                return [{ matrix, determinant }];
            });
        });
        const footBand = Math.max(.05, (Math.max(...vertices.map(point => point[1])) - bottom) * .06);
        const feet = vertices.filter(point => point[1] <= bottom + footBand);
        const canMoveOnSupport = supportTops.length > 0 && feet.length > 0;
        const supportedFootprint = (p: number[]) => feet.every(point => {
            const x = pivot[0] + (point[0] - pivot[0]) * p[2] + p[0];
            const z = pivot[2] + (point[2] - pivot[2]) * p[2] + p[1];
            const onSupport = !canMoveOnSupport || supportTops.some(({ matrix: m, determinant }) => {
                const rx = x - m[3] - m[1] / 2, rz = z - m[11] - m[9] / 2;
                const lx = (rx * m[10] - rz * m[2]) / determinant;
                const lz = (rz * m[0] - rx * m[8]) / determinant;
                return Math.abs(lx) <= .500001 && Math.abs(lz) <= .500001;
            });
            return onSupport && (!navigation || navigation.some(area =>
                bottom >= area.min[1] - .03 && bottom <= area.max[1] + .03
                && x >= area.min[0] - 1e-6 && x <= area.max[0] + 1e-6 && z >= area.min[2] - 1e-6 && z <= area.max[2] + 1e-6));
        });
        const footprintPoints = (p: number[]) => feet.map(point => [
            pivot[0] + (point[0] - pivot[0]) * p[2] + p[0],
            pivot[2] + (point[2] - pivot[2]) * p[2] + p[1],
        ]);
        const closestShift = (lower: number, upper: number) => lower > upper + 1e-6 ? undefined : Math.max(lower, Math.min(upper, 0));
        // A larger body may need a small simultaneous move back onto its
        // platform. Greedy scale-only steps otherwise shrink it to fit an
        // incorrectly placed foot even when a full-size supported pose exists.
        const feasibleScaleCandidates = (p: number[]): number[][] => {
            if (!supported || !canMoveOnSupport) return [p];
            const points = footprintPoints(p);
            const supportCandidates = supportTops.flatMap(({ matrix: m, determinant }) => {
                const local = points.map(([x, z]) => {
                    const rx = x - m[3] - m[1] / 2, rz = z - m[11] - m[9] / 2;
                    return [(rx * m[10] - rz * m[2]) / determinant, (rz * m[0] - rx * m[8]) / determinant];
                });
                const sx = closestShift(-.5 - Math.min(...local.map(point => point[0])), .5 - Math.max(...local.map(point => point[0])));
                const sz = closestShift(-.5 - Math.min(...local.map(point => point[1])), .5 - Math.max(...local.map(point => point[1])));
                if (sx === undefined || sz === undefined) return [];
                return [[p[0] + m[0] * sx + m[2] * sz, p[1] + m[8] * sx + m[10] * sz, p[2]]];
            });
            const nearest = (candidates: number[][], origin: number[]) => candidates.sort((a, b) =>
                (a[0] - origin[0]) ** 2 + (a[1] - origin[1]) ** 2 - (b[0] - origin[0]) ** 2 - (b[1] - origin[1]) ** 2).slice(0, 4);
            const seeds = [p, ...nearest(supportCandidates, p)];
            if (!navigation) return seeds;
            return seeds.flatMap(seed => {
                const bounds = footprintPoints(seed);
                const navCandidates = navigation.flatMap(area => {
                    if (bottom < area.min[1] - .03 || bottom > area.max[1] + .03) return [];
                    const sx = closestShift(area.min[0] - Math.min(...bounds.map(point => point[0])), area.max[0] - Math.max(...bounds.map(point => point[0])));
                    const sz = closestShift(area.min[2] - Math.min(...bounds.map(point => point[1])), area.max[2] - Math.max(...bounds.map(point => point[1])));
                    return sx === undefined || sz === undefined ? [] : [[seed[0] + sx, seed[1] + sz, seed[2]]];
                });
                return [seed, ...nearest(navCandidates, seed)];
            });
        };
        const candidateCorners = (p: number[]) => ({ [object.id]: vertices.map(point => [
            pivot[0] + (point[0] - pivot[0]) * p[2] + p[0],
            pivot[1] + (point[1] - pivot[1]) * p[2],
            pivot[2] + (point[2] - pivot[2]) * p[2] + p[1],
        ] as MotionVec3) });
        const score = (p: number[]) => {
            if (p[2] < .3 || p[2] > 3 || Math.abs(first.position[0] + p[0]) > 99 || Math.abs(first.position[2] + p[1]) > 99) return Infinity;
            if (supported && (canMoveOnSupport || navigation) && !supportedFootprint(p)) return Infinity;
            const box = projectedSceneBoxes(plan, aspect, candidateCorners(p))[object.id];
            if (!box?.[2] || !box[3]) return Infinity;
            // Existing skeletal proxies omit body volume; newly authored solid
            // figures and vehicles also need their visible width preserved.
            const weights = [1, 6, object.parts?.some(part => part.shape === 'bone') ? .35 : 1, 6];
            let error = box.reduce((sum, n, i) => sum + weights[i] * (n - item.box[i]) ** 2, 0);
            if (item.box[1] > .01 && box[1] <= .001) error += 10;
            if (item.box[1] + item.box[3] < .99 && box[1] + box[3] >= .999) error += 10;
            return error;
        };
        let params = [0, 0, 1], best = score(params); const initial = best;
        for (const candidate of feasibleScaleCandidates(params)) {
            const error = score(candidate);
            if (error < best) { best = error; params = candidate; }
        }
        const depth = Math.max(1, Math.hypot(...first.position.map((n, i) => n - plan.camera[0].position[i])));
        for (const fraction of [.3, .15, .07, .03, .01, .003]) for (let pass = 0; pass < 2; pass++) for (let axis = 0; axis < 3; axis++) {
            if (supported && !canMoveOnSupport && axis !== 2) continue;
            let winner = params;
            for (const sign of [-1, 1]) {
                const candidate = [...params]; candidate[axis] += sign * fraction * (axis === 2 ? 2 : depth);
                for (const feasible of axis === 2 ? feasibleScaleCandidates(candidate) : [candidate]) {
                    const error = score(feasible);
                    if (error < best) { best = error; winner = feasible; }
                }
            }
            params = winner;
        }
        if (!(best < initial * .98)) continue;
        const [dx, dz, size] = params;
        object.keys = object.keys.map(key => ({ ...key,
            position: [key.position[0] + dx, bottom + (key.position[1] - bottom) * size, key.position[2] + dz],
            scale: key.scale.map(n => n * size) as MotionVec3 }));
    }
    return plan;
}
export function sceneCalibrationIssues(plan: MotionPlan, layout: SceneLayout, aspect: string): string[] {
    const boxes = projectedSceneBoxes(plan, aspect);
    return layout.landmarks.flatMap(item => {
        if (!plan.objects.some(object => object.id === item.id)) {
            // A rider/prop may be a named part of its controlled unit. Its
            // root's bounds cannot be compared to the rider's individual box.
            if (plan.objects.some(object => object.identity === item.id || object.parts?.some(part => part.id === item.id || part.identity === item.id))) return [];
            return [`Missing ${item.id}: ${item.description}.`];
        }
        if (item.occluded) return []; // Visible fragments are not whole-object bounds.
        const projected = boxes[item.id];
        if (!projected || projected[2] <= 0 || projected[3] <= 0) return [`${item.id} is outside the source camera view.`];
        const [x, y, width, height] = item.box;
        const centerError = Math.max(Math.abs(projected[0] + projected[2] / 2 - x - width / 2), Math.abs(projected[1] + projected[3] / 2 - y - height / 2));
        const scaleError = Math.max(Math.abs(projected[2] - width), Math.abs(projected[3] - height));
        return centerError > .08 || scaleError > .12 ? [`${item.id} framing/scale mismatch: expected image box ${JSON.stringify(item.box)}, projected ${JSON.stringify(projected.map(n => +n.toFixed(3)))}.`] : [];
    });
}

/** Initial reconstruction only: pull the camera back just enough to include
 * the controlled body and visible actors. Never move/resize their geometry. */
export function frameSceneSubjects(plan: MotionPlan, aspect: string, controlledObject?: string): MotionPlan {
    const corners = sceneWorldCorners(plan);
    const points = plan.objects.filter(object => object.id === controlledObject || object.role === 'actor')
        .flatMap(object => corners[object.id] || []);
    if (!points.length) return plan;
    const camera = plan.camera[0];
    const forward = unit(camera.target.map((n,i)=>n-camera.position[i]) as MotionVec3);
    if (Math.abs(forward[1]) > .99999) return plan;
    const right=unit(cross(forward,[0,1,0])), up=cross(right,forward);
    const ratio=aspect==='9:16'?9/16:aspect==='1:1'?1:16/9;
    const lens=Math.tan(camera.fov*Math.PI/360), margin=.9;
    const distance=Math.max(0,...points.map(point=>{
        const relative=point.map((n,i)=>n-camera.position[i]),depth=dot(relative,forward);
        return Math.max(Math.abs(dot(relative,right))/(lens*ratio*margin)-depth,
            Math.abs(dot(relative,up))/(lens*margin)-depth,.1-depth);
    }));
    if(distance<=.00001) return plan;
    const moved=plan.camera.map(key=>({...key,position:key.position.map((n,i)=>n-forward[i]*distance) as MotionVec3}));
    if(moved.some(key=>key.position.some(n=>!Number.isFinite(n)||Math.abs(n)>100))) return plan;
    return {...plan,camera:moved};
}
