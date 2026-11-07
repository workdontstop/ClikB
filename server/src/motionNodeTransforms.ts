import type { MotionKey, MotionPart, MotionPlan, MotionVec3 } from './motionGuidePlan';

// Row-major affine 3x4 matrices. Backend deployment does not depend on the
// frontend's Three.js package; Euler order matches the renderer exactly.
type Matrix = number[];
export function localMotionMatrix(node: MotionPart): Matrix {
    const key = node.keys[0], [x, y, z] = key.rotation;
    const a = Math.cos(x), b = Math.sin(x), c = Math.cos(y), d = Math.sin(y), e = Math.cos(z), f = Math.sin(z);
    const [sx, sy, sz] = key.scale;
    const matrix = [c * e * sx, -c * f * sy, d * sz, key.position[0],
        (a * f + b * e * d) * sx, (a * e - b * f * d) * sy, -b * c * sz, key.position[1],
        (b * f - a * e * d) * sx, (b * e + a * f * d) * sy, a * c * sz, key.position[2]];
    const pivot = node.pivot;
    if (pivot) for (let row = 0; row < 3; row++) matrix[row * 4 + 3] += pivot[row] - pivot.reduce((sum, n, col) => sum + n * matrix[row * 4 + col], 0);
    return matrix;
}
const local = localMotionMatrix;
function multiply(a: Matrix, b: Matrix): Matrix {
    return Array.from({ length: 12 }, (_, index) => {
        const row = Math.floor(index / 4), col = index % 4;
        return [0, 1, 2].reduce((sum, k) => sum + a[row * 4 + k] * b[k * 4 + col], col === 3 ? a[row * 4 + 3] : 0);
    });
}
function inverse(m: Matrix): Matrix {
    const [a, b, c, , d, e, f, , g, h, i] = m;
    const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
    if (!det || !Number.isFinite(det)) throw new Error('The saved attachment transform cannot be inverted.');
    const out = [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det, 0,
        (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det, 0,
        (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det, 0];
    for (let row = 0; row < 3; row++) out[row * 4 + 3] = -[0, 1, 2].reduce((sum, col) => sum + out[row * 4 + col] * m[col * 4 + 3], 0);
    return out;
}
export function initialMotionMatrix(plan: MotionPlan, objectId: string, partId?: string): Matrix {
    const object = plan.objects.find(candidate => candidate.id === objectId);
    if (!object) throw new Error('The saved attachment owner is missing.');
    const anchor = object.attachment;
    const root = anchor ? multiply(initialMotionMatrix(plan, anchor.objectId, anchor.partId), local(object)) : local(object);
    const partMatrix = (id: string): Matrix => {
        const part = object.parts?.find(candidate => candidate.id === id);
        if (!part) throw new Error('The saved attachment part is missing.');
        return multiply(part.parentId ? partMatrix(part.parentId) : root, local(part));
    };
    return partId ? partMatrix(partId) : root;
}
/** Preserve starting world position when an action releases or reparents an
 * asset. As with TRS scene formats, a detached sheared pose is approximated. */
export function initialMotionTransform(plan: MotionPlan, objectId: string, anchor?: { objectId: string; partId?: string }, options: { partId?: string; targetPlan?: MotionPlan; pivot?: MotionVec3 } = {}): MotionKey {
    let matrix = initialMotionMatrix(plan, objectId, options.partId);
    if (anchor) matrix = multiply(inverse(initialMotionMatrix(options.targetPlan || plan, anchor.objectId, anchor.partId)), matrix);
    return motionMatrixPose(matrix, options.pivot);
}

/** Destination-local continuation. Reject shear instead of silently losing it. */
export function continueMotionPose(anchor: MotionKey, baseline: MotionPart, current: MotionPart): MotionKey {
    const matrix = multiply(multiply(local({ ...current, pivot: undefined, keys: [anchor] }), inverse(local(baseline))), local(current));
    const columns = [0, 1, 2].map(col => [matrix[col], matrix[4 + col], matrix[8 + col]]);
    const lengths = columns.map(col => Math.hypot(...col));
    const determinant = matrix[0]*(matrix[5]*matrix[10]-matrix[6]*matrix[9])-matrix[1]*(matrix[4]*matrix[10]-matrix[6]*matrix[8])+matrix[2]*(matrix[4]*matrix[9]-matrix[5]*matrix[8]);
    if (determinant <= 1e-12 || lengths.some(n => !Number.isFinite(n) || n < 1e-9)
        || [[0,1],[0,2],[1,2]].some(([a,b]) => Math.abs(columns[a].reduce((sum,n,i)=>sum+n*columns[b][i],0)/(lengths[a]*lengths[b])) > 1e-6))
        throw new Error('Authoring continuation cannot represent a singular, reflected or sheared transform.');
    return motionMatrixPose(matrix, current.pivot);
}

function motionMatrixPose(matrix: Matrix, pivot?: MotionVec3): MotionKey {
    const scale = [0, 1, 2].map(col => Math.hypot(matrix[col], matrix[4 + col], matrix[8 + col])) as MotionVec3;
    const m = matrix.map((n, index) => index % 4 < 3 ? n / scale[index % 4] : n);
    // Matrix -> quaternion -> XYZ Euler follows the renderer's TRS decomposition.
    let x: number, y: number, z: number, w: number;
    const trace = m[0] + m[5] + m[10];
    if (trace > 0) { const s = .5 / Math.sqrt(trace + 1); w = .25 / s; x = (m[9] - m[6]) * s; y = (m[2] - m[8]) * s; z = (m[4] - m[1]) * s; }
    else if (m[0] > m[5] && m[0] > m[10]) { const s = 2 * Math.sqrt(1 + m[0] - m[5] - m[10]); w = (m[9] - m[6]) / s; x = s / 4; y = (m[1] + m[4]) / s; z = (m[2] + m[8]) / s; }
    else if (m[5] > m[10]) { const s = 2 * Math.sqrt(1 + m[5] - m[0] - m[10]); w = (m[2] - m[8]) / s; x = (m[1] + m[4]) / s; y = s / 4; z = (m[6] + m[9]) / s; }
    else { const s = 2 * Math.sqrt(1 + m[10] - m[0] - m[5]); w = (m[4] - m[1]) / s; x = (m[2] + m[8]) / s; y = (m[6] + m[9]) / s; z = s / 4; }
    const r13 = 2 * (x * z + y * w), rotation: MotionVec3 = [0, Math.asin(Math.max(-1, Math.min(1, r13))), 0];
    if (Math.abs(r13) < .9999999) { rotation[0] = Math.atan2(-2 * (y * z - x * w), 1 - 2 * (x * x + y * y)); rotation[2] = Math.atan2(-2 * (x * y - z * w), 1 - 2 * (y * y + z * z)); }
    else rotation[0] = Math.atan2(2 * (y * z + x * w), 1 - 2 * (x * x + z * z));
    const key: MotionKey = { t: 0, position: [matrix[3], matrix[7], matrix[11]], rotation, scale };
    if (pivot) {
        const rotated = local({ keys: [{ ...key, position: [0, 0, 0] }] } as MotionPart);
        key.position = key.position.map((n, row) => n - pivot[row] + pivot.reduce((sum, v, col) => sum + v * rotated[row * 4 + col], 0)) as MotionVec3;
    }
    return key;
}
