import type { Request, Response } from 'express';
import { createHash, randomUUID } from 'crypto';
import execQuery, { withTransaction } from './execQuery';
import { authenticatedUserId } from './requestAuth';
import { validateMotionPlan } from './motionGuidePlan';
import { createAuthoringDraft, restoreAuthoringDraft } from './sceneAuthoring';
import { validateScenePerformance } from './scenePerformance';
import { applyActionPreset, type AnyScenePreset } from './scenePresets';

export const PRESET_SCHEMA_SQL = `CREATE TABLE IF NOT EXISTS user_scene_presets (
 id CHAR(36) NOT NULL PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
 request_id VARCHAR(80) NOT NULL, preset_kind VARCHAR(32) NOT NULL,
 revision INT UNSIGNED NOT NULL DEFAULT 1, title VARCHAR(120) NOT NULL,
 payload LONGTEXT NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uniq_scene_preset_request (user_id,request_id),
 KEY idx_scene_preset_kind (preset_kind,updated_at), KEY idx_scene_preset_owner (user_id,updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;
let schema: Promise<unknown> | undefined;
const ensure = () => schema ||= execQuery(PRESET_SCHEMA_SQL).catch(error => { schema = undefined; throw error; });
const fail = (message: string, status = 400): never => { throw Object.assign(new Error(message), { status }); };

/** Validate the portable payload, including nested tracks, before storing or applying it. */
export function validateSavedPreset(input: any): AnyScenePreset {
    if (!input || !['stage_preset', 'motion_preset', 'action_preset', 'rig_asset'].includes(input.kind)) fail('Choose a supported scene preset.');
    const p = JSON.parse(JSON.stringify(input));
    if (typeof p.title !== 'string' || !p.title.trim() || p.title.length > 120) fail('Enter a preset title (up to 120 characters).');
    if (JSON.stringify(p).length > 3_500_000) fail('This preset is too large.');
    p.title = p.title.trim(); p.description = String(p.description || '').slice(0, 600);
    p.tags = Array.isArray(p.tags) ? [...new Set(p.tags.filter((x: unknown) => typeof x === 'string').map((x: string) => x.slice(0, 48)))].slice(0, 16) : [];
    delete p.economy; delete p.entitlements;
    if (p.kind === 'stage_preset') {
        p.plan = validateMotionPlan(p.plan);
        if (p.authoring) p.authoring = validateScenePerformance({ plan: p.plan, authoring: p.authoring }).authoring;
        if (!['16:9', '9:16', '1:1'].includes(p.aspectRatio) || !p.plan.objects.some((o: any) => o.id === p.controlledObject)) fail('The stage needs valid framing and a controlled object.');
        if (!p.initialState?.objects || !Array.isArray(p.walkable) || !Array.isArray(p.obstacles)) fail('The stage is missing its saved state.');
        for (const route of Object.values(p.routes || {}) as any[]) for (const anim of [route.forward, route.backward].filter(Boolean)) {
            anim.plan = validateMotionPlan(anim.plan);
            if (anim.authoring) anim.authoring = restoreAuthoringDraft(JSON.stringify(anim.authoring));
        }
    } else if (p.kind === 'rig_asset') {
        const plan = validateMotionPlan({ version: 1, duration: p.objectTemplate?.keys?.at(-1)?.t, background: '#ffffff', objects: [p.objectTemplate], camera: [0, p.objectTemplate?.keys?.at(-1)?.t].map(t => ({ t, position: [0, 2, 6], target: [0, 0, 0], fov: 45 })) });
        const draft = createAuthoringDraft(plan, 'preset-validation', { [p.objectTemplate.id]: p.rig });
        validateScenePerformance({ plan, authoring: draft });
        p.objectTemplate = plan.objects[0]; p.rigKind = p.rig.kind;
        p.sockets = Array.isArray(p.sockets) ? p.sockets.filter((id: string) => plan.objects[0].parts?.some(part => part.id === id)) : [];
        p.dependencies = [];
    } else if (p.kind === 'action_preset') {
        if (!Array.isArray(p.roles) || !p.roles.length || p.roles.length > 100 || !Array.isArray(p.events) || !p.partDeltaKeysByRole || !p.movesByRole) fail('Invalid action preset.');
        const roles = new Set<string>();
        const poses = (duration: number) => [0, duration].map(t => ({ t, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }));
        const objects = p.roles.map((role: any) => {
            if (typeof role.role !== 'string' || !/^[\w-]{1,64}$/.test(role.role) || roles.has(role.role)) fail('Action roles need unique stable names.');
            roles.add(role.role);
            const ids = new Set([...Object.keys(p.partDeltaKeysByRole[role.role] || {}), ...(role.requiredSocket ? [role.requiredSocket] : [])]);
            return { id: role.role, shape: 'box', color: '#888888', keys: poses(p.duration), parts: [...ids].map(id => ({ id, shape: 'anchor', color: '#888888', keys: poses(p.duration) })) };
        });
        const plan = validateMotionPlan({ version: 1, duration: p.duration, background: '#ffffff', objects, camera: [0, p.duration].map(t => ({ t, position: [0, 2, 6], target: [0, 0, 0], fov: 45 })) });
        const rigs = Object.fromEntries(p.roles.filter((role: any) => role.requiredRigKind).map((role: any) => [role.role, { kind: role.requiredRigKind, controls: Object.fromEntries((objects.find((object: any) => object.id === role.role)?.parts || []).map((part: any) => [part.id, part.id])), strideLength: 1 }]));
        const draft = createAuthoringDraft(plan, 'preset-validation', rigs);
        const applied = applyActionPreset(draft, p, Object.fromEntries(p.roles.map((role: any) => [role.role, role.role]))).draft;
        validateScenePerformance({ plan: applied.plan, authoring: applied });
    } else {
        if (!Array.isArray(p.relativeRootKeys) || !p.relativeRootKeys.length || !Array.isArray(p.moves) || !Array.isArray(p.masks) || !Array.isArray(p.compatibleRigKinds)) fail('Invalid motion preset.');
        if (p.manualControls !== undefined && (!Array.isArray(p.manualControls) || p.manualControls.length > 512 || p.manualControls.some((part: unknown) => typeof part !== 'string' || part !== '' && !Object.hasOwn(p.partDeltaKeys || {}, part)))) fail('Invalid motion ownership.');
        if (p.masks.some((mask: any) => !mask || !Number.isFinite(mask.start) || !Number.isFinite(mask.end) || mask.start < 0 || mask.end < mask.start || mask.end > p.duration || mask.partId !== undefined && (typeof mask.partId !== 'string' || !Object.hasOwn(p.partDeltaKeys || {}, mask.partId)) || !Array.isArray(mask.channels) || mask.channels.some((channel: unknown) => !['position','rotation','scale'].includes(channel as string)))) fail('Invalid motion ownership mask.');
        const root = { id: 'preset_validation', shape: 'box', color: '#888888', keys: p.relativeRootKeys };
        validateMotionPlan({ version: 1, duration: p.duration, background: '#ffffff', objects: [root], camera: [
            { t: 0, position: [0, 2, 6], target: [0, 0, 0], fov: 45 }, { t: p.duration, position: [0, 2, 6], target: [0, 0, 0], fov: 45 },
        ] });
        for (const keys of Object.values(p.partDeltaKeys || {})) validateMotionPlan({ version: 1, duration: p.duration, background: '#ffffff', objects: [{ ...root, keys }], camera: [
            { t: 0, position: [0, 2, 6], target: [0, 0, 0], fov: 45 }, { t: p.duration, position: [0, 2, 6], target: [0, 0, 0], fov: 45 },
        ] });
    }
    const permitted = ['kind', 'presetId', 'versionId', 'title', 'description', 'tags', 'previewUrl', 'createdAt', 'visibility', 'creatorUserId',
        ...(p.kind === 'stage_preset' ? ['aspectRatio', 'plan', 'authoring', 'locomotion', 'rigs', 'controlledObject', 'controlMode', 'walkable', 'obstacles', 'initialState', 'dependencies', 'nodes', 'connections', 'routes', 'states']
            : p.kind === 'action_preset' ? ['duration', 'roles', 'relativePlacements', 'rootDeltaKeysByRole', 'locomotionByRole', 'ownershipByRole', 'partStartPosesByRole', 'referenceHipHeightByRole', 'initialFactsByRole', 'referenceFramesByRole', 'rootStartPosesByRole', 'initialAttachmentsByRole', 'initialRelationships', 'initialConditions', 'partDeltaKeysByRole', 'movesByRole', 'events', 'cameraRig']
            : p.kind === 'rig_asset' ? ['rigKind', 'objectTemplate', 'rig', 'sockets', 'dependencies', 'initialFacts']
            : ['compatibleRigKinds', 'referenceHipHeight', 'referenceStrideLength', 'duration', 'relativeRootKeys', 'partDeltaKeys', 'moves', 'masks', 'locomotionEnabled', 'manualControls'])];
    return Object.fromEntries(permitted.filter(key => p[key] !== undefined).map(key => [key, p[key]])) as AnyScenePreset;
}

function envelope(row: any, user: string) {
    return { schema: 'clikb.scene-preset.v1', id: row.id, revision: Number(row.revision), creatorId: String(row.user_id),
        creatorName: row.creator_name || 'Creator', editable: String(row.user_id) === user, preset: JSON.parse(row.payload) };
}
const select = 'SELECT p.*, m.username AS creator_name FROM user_scene_presets p LEFT JOIN members m ON m.id=p.user_id';

/** All authenticated users may use presets; only their creator may mutate them. */
export async function scenePresetRoute(req: Request, res: Response) {
    const user = authenticatedUserId(req);
    if (!user) return res.status(401).json({ message: 'Please sign in to use saved presets.' });
    try {
        await ensure();
        const body = req.body || {};
        if (body.action === 'list') {
            const offset = Math.max(0, Math.min(100000, Number(body.offset) || 0)), args: any[] = [];
            const clauses: string[] = [];
            if (body.mine) { clauses.push('p.user_id=?'); args.push(user); }
            if (body.kind && ['stage_preset', 'motion_preset'].includes(body.kind)) { clauses.push('p.preset_kind=?'); args.push(body.kind); }
            const rows = await execQuery(`${select}${clauses.length ? ' WHERE ' + clauses.join(' AND ') : ''} ORDER BY p.updated_at DESC,p.id LIMIT 21 OFFSET ?`, [...args, offset]);
            return res.json({ items: rows.slice(0, 20).map((row: any) => envelope(row, user)), hasMore: rows.length > 20 });
        }
        if (body.action === 'read') {
            const rows = await execQuery(`${select} WHERE p.id=?`, [String(body.id || '')]);
            if (!rows[0]) fail('This preset is unavailable.', 404);
            return res.json(envelope(rows[0], user));
        }
        if (body.action === 'delete') {
            const result = await execQuery('DELETE FROM user_scene_presets WHERE id=? AND user_id=? AND revision=?', [body.id, user, body.revision]);
            if (result.affectedRows !== 1) fail('Only the creator can delete the current version of this preset.', 409);
            return res.json({ deleted: true });
        }
        if (body.action !== 'save') fail('Unknown preset action.');
        const preset = validateSavedPreset(body.preset);
        const requestId = String(body.requestId || '');
        if (!/^[a-zA-Z0-9_-]{8,80}$/.test(requestId)) fail('A save request identity is required.');
        const id = typeof body.id === 'string' ? body.id : randomUUID();
        const version = createHash('sha256').update(JSON.stringify(preset)).digest('hex').slice(0, 24);
        const canonical = { ...preset, presetId: id, versionId: `${id}@${version}`, creatorUserId: Number(user), visibility: 'published' };
        const savedId = await withTransaction(async query => {
            if (body.id) {
                const existing = await query('SELECT user_id,revision FROM user_scene_presets WHERE id=? FOR UPDATE', [id]);
                if (!existing[0] || String(existing[0].user_id) !== user) fail('Only the creator can change this preset.', 403);
                if (Number(existing[0].revision) !== Number(body.revision)) fail('This preset has newer changes. Refresh before editing.', 409);
                await query('UPDATE user_scene_presets SET title=?,payload=?,revision=revision+1 WHERE id=? AND user_id=?', [canonical.title, JSON.stringify(canonical), id, user]);
                return id;
            }
            await query('INSERT INTO user_scene_presets(id,user_id,request_id,preset_kind,title,payload) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id', [id, user, requestId, canonical.kind, canonical.title, JSON.stringify(canonical)]);
            const rows = await query('SELECT id FROM user_scene_presets WHERE user_id=? AND request_id=?', [user, requestId]);
            return rows[0].id;
        });
        const rows = await execQuery(`${select} WHERE p.id=?`, [savedId]);
        return res.json(envelope(rows[0], user));
    } catch (error) { return res.status((error as any).status || 500).json({ message: (error as Error).message }); }
}
