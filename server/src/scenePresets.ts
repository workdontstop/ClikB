import type { MotionKey, MotionObject, MotionPlan, MotionVec3 } from './motionGuidePlan';
import {
    applyAuthoringCommands,
    createAuthoringDraft,
    evaluateAuthoringDraft,
    samplePose,
    retimePostureCue,
    authoredRootPoseFromReference,
    travelledDistance,
    type AuthoringCommand,
    type MovePerformance,
    type PoseChannel,
    type PoseTarget,
    type RigBinding,
    type SceneAuthoringDraft,
    type TimedSceneEvent,
} from './sceneAuthoring';
import type { SceneCameraRig } from './sceneCamera';
import { validateScenePerformance } from './scenePerformance';
import { cloneWorld, validateWorld, type SpatialWorld } from './spatialWorld';
import { initialMotionMatrix, initialMotionTransform, continueMotionPose, localMotionMatrix } from './motionNodeTransforms';

export type PresetVisibility = 'private' | 'unlisted' | 'public_review' | 'published';

export type PresetMetadataInput = {
    presetId?: string;
    title: string;
    description?: string;
    tags?: string[];
    previewUrl?: string;
    creatorUserId?: number;
};

export type PresetProvenance = {
    presetId: string;
    versionId: string;
    kind: 'rig_asset' | 'motion_preset' | 'action_preset' | 'stage_preset';
    targetObjectId?: string;
    roleBindings?: Record<string, string>;
};

export type PresetEconomyTerms = {
    pricePixels: number;
    creatorShareBps: number;
    license: 'project-use' | 'remix-allowed';
};

export type BasePresetHeader = {
    presetId: string;
    versionId: string;
    title: string;
    description: string;
    tags: string[];
    previewUrl?: string;
    visibility: PresetVisibility;
    createdAt: number;
    creatorUserId?: number;
    economy?: PresetEconomyTerms;
};

export type RigAssetPreset = BasePresetHeader & {
    kind: 'rig_asset';
    rigKind: RigBinding['kind'];
    objectTemplate: MotionObject;
    rig: RigBinding;
    sockets: string[];
    dependencies: string[];
    initialFacts?: Record<string, unknown>;
};

export type MotionNodePreset = BasePresetHeader & {
    kind: 'motion_preset';
    compatibleRigKinds: Array<RigBinding['kind']>;
    referenceHipHeight: number;
    referenceStrideLength: number;
    duration: number;
    relativeRootKeys: MotionKey[];
    partDeltaKeys: Record<string, MotionKey[]>;
    moves: Array<Omit<MovePerformance, 'id' | 'objectId'>>;
    masks: Array<{ partId?: string; start: number; end: number; channels: PoseChannel[] }>;
    locomotionEnabled: boolean;
    /** Actual source full-track ownership; copied delta keys are not overrides. */
    manualControls?: string[];
};

export type ActionRoleSpec = {
    role: string;
    requiredRigKind?: RigBinding['kind'];
    requiredSocket?: string;
};
type ActionRelationship = { fromRole: string; toRole: string; relation: string; facts?: Record<string, unknown> };
type ActionStatePayload = Pick<TimedSceneEvent, 'facts' | 'conditions' | 'addFacts' | 'removeFacts' | 'removeConditions' | 'locomotion' | 'stateCue'> & { relationships?: ActionRelationship[]; removeRelationships?: ActionRelationship[] };
type ActionOwnership = { controls: string[]; masks: Array<{ partId?: string; start: number; end: number; channels: PoseChannel[] }> };

/** Fit every typed timestamp together; never clamp away a preset's ending. */
export function fitPresetDuration<T extends MotionNodePreset | ActionNodePreset>(preset: T, duration: number): T {
    if (!Number.isFinite(duration) || duration < 2 || duration > 15 || !Number.isFinite(preset.duration) || preset.duration <= 0) throw new Error('Invalid preset duration.');
    const next = cloneWorld(preset), at = (time: number) => time / preset.duration * duration;
    const keys = (track: MotionKey[]) => track.map(key => ({ ...key, t: at(key.t) }));
    next.duration = duration;
    if (next.kind === 'motion_preset') {
        next.relativeRootKeys = keys(next.relativeRootKeys);
        next.partDeltaKeys = Object.fromEntries(Object.entries(next.partDeltaKeys).map(([id, track]) => [id, keys(track)]));
        next.moves = next.moves.map(move => ({ ...move, start: at(move.start), duration: at(move.duration) }));
        next.masks = next.masks.map(mask => ({ ...mask, start: at(mask.start), end: at(mask.end) }));
    } else {
        next.rootDeltaKeysByRole = Object.fromEntries(Object.entries(next.rootDeltaKeysByRole || {}).map(([role, track]) => [role, keys(track)]));
        next.partDeltaKeysByRole = Object.fromEntries(Object.entries(next.partDeltaKeysByRole).map(([role, parts]) => [role, Object.fromEntries(Object.entries(parts).map(([id, track]) => [id, keys(track)]))]));
        next.movesByRole = Object.fromEntries(Object.entries(next.movesByRole).map(([role, moves]) => [role, moves.map(move => ({ ...move, start: at(move.start), duration: at(move.duration) }))]));
        if (next.ownershipByRole) next.ownershipByRole = Object.fromEntries(Object.entries(next.ownershipByRole).map(([role, policy]) => [role, { ...policy, masks: policy.masks.map(mask => ({ ...mask, start: at(mask.start), end: at(mask.end) })) }]));
        next.events = next.events.map(event => ({ ...event, time: at(event.time), ...(event.stateCue ? { stateCue: retimePostureCue(event.stateCue, at) } : {}), ...(event.localPose ? { localPose: { ...event.localPose, t: at(event.localPose.t) } } : {}), ...(event.landingOffset ? { landingOffset: { ...event.landingOffset, dt: at(event.landingOffset.dt) } } : {}) }));
    }
    return next;
}

export type ActionNodePreset = BasePresetHeader & {
    kind: 'action_preset';
    duration: number;
    roles: ActionRoleSpec[];
    relativePlacements: Record<string, { offset: MotionVec3; rotation: MotionVec3 }>;
    rootDeltaKeysByRole?: Record<string, MotionKey[]>;
    locomotionByRole?: string[];
    ownershipByRole?: Record<string, ActionOwnership>;
    partStartPosesByRole?: Record<string, Record<string, MotionKey>>;
    referenceHipHeightByRole?: Record<string, number>;
    initialFactsByRole?: Record<string, Record<string, unknown>>;
    referenceFramesByRole?: Record<string, MotionKey>;
    rootStartPosesByRole?: Record<string, MotionKey>;
    initialAttachmentsByRole?: Record<string, { parentRole: string; parentSocket?: string; relation?: 'holds' | 'riding' | 'attached'; localPose: MotionKey }>;
    initialRelationships?: ActionRelationship[];
    initialConditions?: Record<string, unknown>;
    partDeltaKeysByRole: Record<string, Record<string, MotionKey[]>>;
    movesByRole: Record<string, Array<Omit<MovePerformance, 'id' | 'objectId'>>>;
    events: Array<ActionStatePayload & {
        role: string;
        kind: TimedSceneEvent['kind'];
        time: number;
        parentRole?: string;
        parentSocket?: string;
        relation?: 'holds' | 'riding' | 'mounted' | 'attached';
        localPose?: MotionKey;
        landingOffset?: { dt: number; offset: MotionVec3 };
        landingPosition?: MotionVec3;
        addFacts?: string[];
        removeFacts?: string[];
        conditions?: Record<string, unknown>;
        facts?: Record<string, unknown>;
    }>;
    cameraRig?: Omit<SceneCameraRig, 'target'> & { targetRole?: string };
};

export type StagePreset = BasePresetHeader & {
    kind: 'stage_preset';
    aspectRatio: '16:9' | '9:16' | '1:1';
    plan: MotionPlan;
    authoring?: SceneAuthoringDraft;
    locomotion?: SpatialWorld['locomotion'];
    rigs: Record<string, RigBinding>;
    controlledObject: string;
    controlMode: 'character' | 'vehicle' | 'mounted' | 'pov' | 'other';
    walkable: SpatialWorld['walkable'];
    obstacles: SpatialWorld['obstacles'];
    initialState: SpatialWorld['initialState'];
    dependencies: string[];
    nodes?: Array<{ id: string; label?: string; kind?: 'movement' | 'action' }>;
    connections?: Array<{ id: string; sourceNodeId: string; targetNodeId: string; kind: 'movement' | 'action'; actionPlayback?: 'tap' | 'hold'; actionPrompt?: string; movement: { durationMs: number; samples: Array<{ x: number; y: number; radius: number; angle: number; active: boolean; timestamp: number; elapsedMs: number }> } }>;
    routes?: Record<string, { forward?: { plan: MotionPlan; authoring?: SceneAuthoringDraft; prompt: string; creatorInstruction?: string; sourceState: any; endState: any; stateChanges?: any }; backward?: { plan: MotionPlan; authoring?: SceneAuthoringDraft; prompt: string; sourceState: any; endState: any } }>;
    states?: Record<string, any>;
};

export type AnyScenePreset = RigAssetPreset | MotionNodePreset | ActionNodePreset | StagePreset;

function cleanHeader(input: PresetMetadataInput, versionSeed: string): BasePresetHeader {
    const title = (input.title || '').trim();
    if (!title || title.length > 120) throw new Error('Preset title must be between 1 and 120 characters.');
    const tags = Array.from(new Set((input.tags || []).map(t => t.trim().toLowerCase()).filter(Boolean))).slice(0, 16);
    const presetId = (input.presetId || `preset_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'item'}`).slice(0, 80);
    let hash = 2166136261;
    for (let i = 0; i < versionSeed.length; i++) {
        hash ^= versionSeed.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    const versionId = `${presetId}@v_${(hash >>> 0).toString(16)}`;
    return {
        presetId,
        versionId,
        title,
        description: (input.description || '').trim().slice(0, 600),
        tags,
        ...(input.previewUrl ? { previewUrl: input.previewUrl } : {}),
        visibility: 'private', // Always private first (P09-07)
        createdAt: Date.now(),
        ...(input.creatorUserId !== undefined ? { creatorUserId: input.creatorUserId } : {}),
    };
}

/** Extract a portable motion preset from an entity in a draft, stripping world coordinates and project/job state (P09-02, P09-05). */
export function extractMotionNodePreset(draft: SceneAuthoringDraft, objectId: string, metadata: PresetMetadataInput): MotionNodePreset {
    const object = draft.plan.objects.find(o => o.id === objectId);
    if (!object) throw new Error(`Entity ${objectId} does not exist in draft.`);
    const rig = draft.rigs[objectId];
    const origin = object.keys[0];
    const relativeRootKeys: MotionKey[] = object.keys.map(k => ({
        t: k.t,
        position: [k.position[0] - origin.position[0], k.position[1] - origin.position[1], k.position[2] - origin.position[2]],
        rotation: [k.rotation[0] - origin.rotation[0], k.rotation[1] - origin.rotation[1], k.rotation[2] - origin.rotation[2]],
        scale: [k.scale[0] / (origin.scale[0] || 1), k.scale[1] / (origin.scale[1] || 1), k.scale[2] / (origin.scale[2] || 1)],
    }));
    const partDeltaKeys: Record<string, MotionKey[]> = {};
    for (const part of object.parts || []) {
        const rest = part.keys[0];
        if (!rest) continue;
        partDeltaKeys[part.id] = part.keys.map(k => ({
            t: k.t,
            position: [k.position[0] - rest.position[0], k.position[1] - rest.position[1], k.position[2] - rest.position[2]],
            rotation: [k.rotation[0] - rest.rotation[0], k.rotation[1] - rest.rotation[1], k.rotation[2] - rest.rotation[2]],
            scale: [k.scale[0] / (rest.scale[0] || 1), k.scale[1] / (rest.scale[1] || 1), k.scale[2] / (rest.scale[2] || 1)],
        }));
    }
    const moves = draft.moves
        .filter(m => m.objectId === objectId)
        .map(({ id: _id, objectId: _obj, ...rest }) => ({ ...rest }));
    const masks = (draft.masks || [])
        .filter(m => (m.target?.objectId || m.objectId) === objectId)
        .map(m => {
            const partId = m.target?.partId || m.partId;
            return { ...(partId ? { partId } : {}), start: m.start, end: m.end, channels: [...m.channels] };
        });
    const payload = {
        compatibleRigKinds: rig ? [rig.kind] : (['biped'] as Array<RigBinding['kind']>),
        referenceHipHeight: rig?.hipHeight || .91,
        referenceStrideLength: rig?.strideLength || 1.3,
        duration: draft.plan.duration,
        relativeRootKeys,
        partDeltaKeys,
        moves,
        masks,
        locomotionEnabled: draft.locomotion.includes(objectId),
        manualControls: draft.manualControls.flatMap(key => { const [owner, partId] = JSON.parse(key); return owner === objectId ? [partId || ''] : []; }),
    };
    const header = cleanHeader(metadata, JSON.stringify(payload));
    return { kind: 'motion_preset', ...header, ...payload };
}

function prepareDelayedPresetInsertion(draft: SceneAuthoringDraft, commands: AuthoringCommand[], start: number): void {
    if (start === 0) return;
    const anchored = new Set<string>();
    for (const command of commands) if (command.kind === 'pose') {
        const identity = JSON.stringify(command.target);
        if (anchored.has(identity)) continue;
        anchored.add(identity);
        const object = draft.plan.objects.find(item => item.id === command.target.objectId)!;
        const track = command.target.partId ? object.parts!.find(part => part.id === command.target.partId)! : object;
        const before = samplePose(track, start);
        if (Math.abs(command.time - start) < 1e-6) {
            const a = localMotionMatrix({ ...track, keys: [before] }), b = localMotionMatrix({ ...track, keys: [command.pose] });
            if (a.some((value, index) => Math.abs(value - b[index]) > 1e-6) || Math.abs((before.opacity ?? 1) - (command.pose.opacity ?? 1)) > 1e-6 || JSON.stringify(before.span) !== JSON.stringify(command.pose.span)) throw new Error('This preset needs a transition from the participant’s current pose. Arrange its starting pose first or apply it at the start of the take.');
            command.pose = { ...cloneWorld(before), t: start };
        } else commands.push({ kind: 'pose', target: command.target, time: start, pose: before });
    }
    if (commands.some(command => command.kind === 'locomotion' && command.enabled && !draft.locomotion.includes(command.objectId))) throw new Error('This preset needs a timed locomotion transition. Apply it at the start of the take or author the transition first.');
}

/** Both preset formats retain their geometry semantics and share ownership. */
function applyPresetOwnership(draft: SceneAuthoringDraft, next: SceneAuthoringDraft, commands: AuthoringCommand[], start: number, duration: number, procedural: Set<string>, sourceControls: Map<string, PoseTarget>): NonNullable<SceneAuthoringDraft['masks']> {
    const oldControls = new Set(draft.manualControls);
    const copied = new Map(commands.flatMap(command => command.kind === 'pose' ? [[JSON.stringify([command.target.objectId, command.target.partId || '']), command.target] as const] : []));
    next.manualControls = next.manualControls.filter(key => oldControls.has(key) || !copied.has(key) || start === 0 && !procedural.has(copied.get(key)!.objectId));
    if (start === 0) next.manualControls = [...new Set([...next.manualControls, ...sourceControls.keys()])];
    const ownedMasks: NonNullable<SceneAuthoringDraft['masks']> = (next.masks || []).slice(draft.masks?.length || 0);
    if (start > 0) {
        const owners = new Map([...copied].filter(([, target]) => !procedural.has(target.objectId)));
        for (const [key, target] of sourceControls) owners.set(key, target);
        for (const [key, target] of owners) if (!oldControls.has(key)) {
            const mask = { ...cloneWorld(target), target: cloneWorld(target), start, end: Math.min(draft.plan.duration, start + duration), channels: ['position', 'rotation', 'scale'] as PoseChannel[] };
            ownedMasks.push(mask); (next.masks ||= []).push(mask);
        }
    }
    return ownedMasks;
}

function validateDelayedPresetBoundary(draft: SceneAuthoringDraft, next: SceneAuthoringDraft, start: number, duration: number, participants: string[], ownedMasks: NonNullable<SceneAuthoringDraft['masks']>, initialEventIds = new Set<string>(), evaluated?: MotionPlan): void {
    if (start === 0) return;
    for (const id of participants) if (draft.locomotion.includes(id) && draft.rigs[id]?.kind !== 'rotor') {
        const before = draft.plan.objects.find(object => object.id === id)!, after = next.plan.objects.find(object => object.id === id)!;
        const times = new Set([0, start, ...before.keys.map(key => key.t), ...after.keys.map(key => key.t)]);
        for (const time of times) if (time <= start && Math.abs(travelledDistance(before, time) - travelledDistance(after, time)) > 1e-6) throw new Error('This preset needs a transition that preserves the existing locomotion phase.');
    }
    const assertBoundary = (before: MotionPlan, after: MotionPlan) => {
        for (const id of participants) {
            const object = before.objects.find(item => item.id === id)!;
            for (const partId of [undefined, ...(object.parts || []).map(part => part.id)]) {
                const a = initialMotionMatrix(before, id, partId), b = initialMotionMatrix(after, id, partId);
                if (a.some((value, index) => Math.abs(value - b[index]) > 1e-6)) throw new Error('This preset needs a transition from the participant’s evaluated pose or attachment. Arrange its starting pose first or apply it at the start of the take.');
            }
        }
    };
    const priorIds = new Set(draft.events.map(event => event.id));
    const boundary = { ...next, events: next.events.filter(event => priorIds.has(event.id) || initialEventIds.has(event.id)), moves: draft.moves };
    assertBoundary(evaluated || evaluateAuthoringDraft(draft, start).plan, evaluateAuthoringDraft(boundary, start).plan);
    const end = Math.min(draft.plan.duration, start + duration);
    if (end < draft.plan.duration - 1e-6 && ownedMasks.length) {
        const owned = new Set(ownedMasks);
        const resumed = { ...next, masks: (next.masks || []).map(mask => owned.has(mask) ? { ...mask, end: mask.end - 1e-5 } : mask) };
        assertBoundary(evaluateAuthoringDraft(next, end).plan, evaluateAuthoringDraft(resumed, end).plan);
    }
}

/** Retarget and apply a portable MotionNodePreset to any compatible entity in the current draft (P09-10..P09-14, P09-19). */
export function applyMotionPreset(
    draft: SceneAuthoringDraft,
    preset: MotionNodePreset,
    targetObjectId: string,
    startTime = 0,
): { draft: SceneAuthoringDraft; provenance: PresetProvenance } {
    if (!Number.isFinite(startTime) || startTime < 0 || !Number.isFinite(preset.duration) || preset.duration <= 0 || startTime + preset.duration > draft.plan.duration + 1e-6) throw new Error('The full motion must fit in this timeline. Choose a longer take.');
    const object = draft.plan.objects.find(o => o.id === targetObjectId);
    if (!object) throw new Error(`Target entity ${targetObjectId} does not exist.`);
    const targetRig = draft.rigs[targetObjectId];
    if (targetRig && preset.compatibleRigKinds.length && !preset.compatibleRigKinds.includes(targetRig.kind)) {
        throw new Error(`Motion preset "${preset.title}" requires ${preset.compatibleRigKinds.join('/')} rig, but ${targetObjectId} is ${targetRig.kind}.`);
    }
    const scaleRatio = targetRig?.hipHeight && preset.referenceHipHeight > 0
        ? targetRig.hipHeight / preset.referenceHipHeight
        : targetRig?.strideLength && preset.referenceStrideLength > 0
            ? targetRig.strideLength / preset.referenceStrideLength
            : 1;
    const anchorPose = samplePose(object, startTime);
    const commands: AuthoringCommand[] = [];
    const sourceControls = new Map<string, PoseTarget>();
    if (preset.manualControls !== undefined && (!Array.isArray(preset.manualControls) || preset.manualControls.length > 512)) throw new Error('Invalid motion ownership.');
    for (const partId of preset.manualControls || []) {
        if (typeof partId !== 'string') throw new Error('Invalid motion ownership control.');
        const mappedPart = partId ? targetRig?.controls[partId] || partId : undefined;
        if (mappedPart && !object.parts?.some(part => part.id === mappedPart)) throw new Error('The motion ownership control is missing from this subject.');
        const target = { objectId: targetObjectId, ...(mappedPart ? { partId: mappedPart } : {}) };
        sourceControls.set(JSON.stringify([targetObjectId, mappedPart || '']), target);
    }
    for (const rel of preset.relativeRootKeys) {
        const t = Math.min(draft.plan.duration, Math.max(0, startTime + rel.t));
        commands.push({
            kind: 'pose',
            target: { objectId: targetObjectId },
            time: t,
            pose: {
                t,
                position: [
                    anchorPose.position[0] + rel.position[0] * scaleRatio,
                    anchorPose.position[1] + rel.position[1] * scaleRatio,
                    anchorPose.position[2] + rel.position[2] * scaleRatio,
                ],
                rotation: [
                    anchorPose.rotation[0] + rel.rotation[0],
                    anchorPose.rotation[1] + rel.rotation[1],
                    anchorPose.rotation[2] + rel.rotation[2],
                ],
                scale: [
                    anchorPose.scale[0] * rel.scale[0],
                    anchorPose.scale[1] * rel.scale[1],
                    anchorPose.scale[2] * rel.scale[2],
                ],
            },
        });
    }
    for (const [partId, deltas] of Object.entries(preset.partDeltaKeys)) {
        const mappedPartId = targetRig?.controls?.[partId] || partId;
        const part = object.parts?.find(p => p.id === mappedPartId);
        if (!part) continue;
        const rest = part.keys[0];
        for (const delta of deltas) {
            const t = Math.min(draft.plan.duration, Math.max(0, startTime + delta.t));
            commands.push({
                kind: 'pose',
                target: { objectId: targetObjectId, partId: mappedPartId },
                time: t,
                pose: {
                    t,
                    position: [
                        rest.position[0] + delta.position[0] * scaleRatio,
                        rest.position[1] + delta.position[1] * scaleRatio,
                        rest.position[2] + delta.position[2] * scaleRatio,
                    ],
                    rotation: [
                        rest.rotation[0] + delta.rotation[0],
                        rest.rotation[1] + delta.rotation[1],
                        rest.rotation[2] + delta.rotation[2],
                    ],
                    scale: [
                        rest.scale[0] * delta.scale[0],
                        rest.scale[1] * delta.scale[1],
                        rest.scale[2] * delta.scale[2],
                    ],
                },
            });
        }
    }
    preset.moves.forEach((m, index) => {
        const at = Math.min(draft.plan.duration - m.duration, Math.max(0, startTime + m.start));
        commands.push({
            kind: 'move',
            exact: true,
            at,
            move: { id: `${preset.presetId}_move_${draft.revision + index + 1}`, objectId: targetObjectId, kind: m.kind, duration: m.duration },
        });
    });
    for (const mask of preset.masks) {
        if (!mask || !Number.isFinite(mask.start) || !Number.isFinite(mask.end) || mask.start < 0 || mask.end < mask.start || mask.end > preset.duration + 1e-6 || !Array.isArray(mask.channels) || mask.channels.some(channel => !['position','rotation','scale'].includes(channel))) throw new Error('Invalid motion ownership mask.');
        const mappedPartId = mask.partId ? targetRig?.controls?.[mask.partId] || mask.partId : undefined;
        if (mappedPartId && !object.parts?.some(p => p.id === mappedPartId)) throw new Error('The motion ownership mask is missing its target control.');
        commands.push({
            kind: 'mask',
            mask: {
                target: { objectId: targetObjectId, ...(mappedPartId ? { partId: mappedPartId } : {}) },
                start: Math.min(draft.plan.duration, Math.max(0, startTime + mask.start)),
                end: Math.min(draft.plan.duration, Math.max(0, startTime + mask.end)),
                channels: [...mask.channels],
            },
        });
    }
    if (preset.locomotionEnabled && targetRig) {
        commands.push({ kind: 'locomotion', objectId: targetObjectId, enabled: true });
    }
    prepareDelayedPresetInsertion(draft, commands, startTime);
    const next = applyAuthoringCommands(draft, draft.revision, commands);
    const ownedMasks = applyPresetOwnership(draft, next, commands, startTime, preset.duration, new Set(preset.locomotionEnabled && targetRig ? [targetObjectId] : []), sourceControls);
    validateDelayedPresetBoundary(draft, next, startTime, preset.duration, [targetObjectId], ownedMasks);
    return {
        draft: validateScenePerformance({ plan: next.plan, authoring: next }).authoring!,
        provenance: { presetId: preset.presetId, versionId: preset.versionId, kind: 'motion_preset', targetObjectId },
    };
}

/** Extract a portable multi-role ActionNodePreset from a draft, keeping required prop/socket semantics (P09-03, P09-05, P09-06). */
export function extractActionNodePreset(
    draft: SceneAuthoringDraft,
    roleMap: Record<string, string>, // roleName -> objectId in draft
    metadata: PresetMetadataInput,
): ActionNodePreset {
    const objectToRole = new Map<string, string>();
    const roles: ActionRoleSpec[] = [];
    for (const [role, objectId] of Object.entries(roleMap)) {
        const obj = draft.plan.objects.find(o => o.id === objectId);
        if (!obj) throw new Error(`Action role ${role} references missing entity ${objectId}.`);
        objectToRole.set(objectId, role);
        const rig = draft.rigs[objectId];
        roles.push({ role, ...(rig ? { requiredRigKind: rig.kind } : {}) });
    }
    const primaryObjectId = Object.values(roleMap)[0];
    if (!primaryObjectId || objectToRole.size !== Object.keys(roleMap).length) throw new Error('Choose distinct action participants.');
    const primaryOrigin = draft.plan.objects.find(o => o.id === primaryObjectId)!.keys[0];
    const relativePlacements: Record<string, { offset: MotionVec3; rotation: MotionVec3 }> = {};
    const partDeltaKeysByRole: Record<string, Record<string, MotionKey[]>> = {};
    const rootDeltaKeysByRole: Record<string, MotionKey[]> = {};
    const partStartPosesByRole: Record<string, Record<string, MotionKey>> = {};
    const referenceHipHeightByRole: Record<string, number> = {};
    const initialFactsByRole: Record<string, Record<string, unknown>> = {};
    const initial = evaluateAuthoringDraft(draft, 0).state;
    // The initial arrangement precedes intentional story events at t=0.
    // Keep those events in the preset instead of folding their attachment or
    // procedural transform into the arrangement a second time.
    const initialFrame = evaluateAuthoringDraft({ ...draft, events: [], moves: [], locomotion: [] }, 0);
    const referenceFramesByRole: Record<string, MotionKey> = {};
    const rootStartPosesByRole: Record<string, MotionKey> = {};
    const initialAttachmentsByRole: NonNullable<ActionNodePreset['initialAttachmentsByRole']> = {};
    const roleRelations = (relations: typeof initial.relationships): ActionRelationship[] => relations.map(relation => {
        const fromRole = objectToRole.get(relation.from), toRole = objectToRole.get(relation.to);
        if (!fromRole || !toRole) throw new Error('Include all relationship dependencies as action participants.');
        const { from: _from, to: _to, ...payload } = relation;
        return { ...cloneWorld(payload), fromRole, toRole };
    });
    const initialRelationships = roleRelations(initial.relationships.filter(relation => objectToRole.has(relation.from) || objectToRole.has(relation.to)));
    const movesByRole: Record<string, Array<Omit<MovePerformance, 'id' | 'objectId'>>> = {};
    const ownershipByRole: Record<string, ActionOwnership> = {};

    for (const [role, objectId] of Object.entries(roleMap)) {
        const obj = draft.plan.objects.find(o => o.id === objectId)!;
        const start = obj.keys[0];
        ownershipByRole[role] = {
            controls: draft.manualControls.flatMap(key => { const [owner, partId] = JSON.parse(key); return owner === objectId ? [partId || ''] : []; }),
            masks: (draft.masks || []).flatMap(mask => { const target = mask.target || mask; return target.objectId === objectId ? [{ ...(target.partId ? { partId: target.partId } : {}), start: mask.start, end: mask.end, channels: cloneWorld(mask.channels) }] : []; }),
        };
        rootStartPosesByRole[role] = cloneWorld(start);
        referenceFramesByRole[role] = initialMotionTransform(initialFrame.plan, objectId);
        const attached = initialFrame.plan.objects.find(item => item.id === objectId)!;
        if (attached.attachment) {
            const parentRole = objectToRole.get(attached.attachment.objectId);
            if (!parentRole) throw new Error('Include the initial attachment parent as an action participant.');
            const parentSocket = attached.attachment.partId;
            if (parentSocket) roles.find(item => item.role === parentRole)!.requiredSocket = parentSocket;
            const relation = initial.relationships.some(item => item.from === attached.attachment!.objectId && item.to === objectId && item.relation === 'holds') ? 'holds'
                : initial.relationships.some(item => item.from === objectId && item.to === attached.attachment!.objectId && item.relation === 'riding') ? 'riding' : 'attached';
            initialAttachmentsByRole[role] = { parentRole, relation, ...(parentSocket ? { parentSocket } : {}), localPose: cloneWorld(attached.keys[0]) };
        }
        partStartPosesByRole[role] = Object.fromEntries((obj.parts || []).map(part => [part.id, cloneWorld(part.keys[0])]));
        referenceHipHeightByRole[role] = draft.rigs[objectId]?.hipHeight || 1;
        initialFactsByRole[role] = cloneWorld(initial.objects[objectId]?.facts || {});
        rootDeltaKeysByRole[role] = obj.keys.map(key => ({ ...cloneWorld(key), position: key.position.map((v, i) => v - start.position[i]) as MotionVec3, rotation: key.rotation.map((v, i) => v - start.rotation[i]) as MotionVec3, scale: key.scale.map((v, i) => v / start.scale[i]) as MotionVec3 }));
        relativePlacements[role] = {
            offset: [start.position[0] - primaryOrigin.position[0], start.position[1] - primaryOrigin.position[1], start.position[2] - primaryOrigin.position[2]],
            rotation: [start.rotation[0] - primaryOrigin.rotation[0], start.rotation[1] - primaryOrigin.rotation[1], start.rotation[2] - primaryOrigin.rotation[2]],
        };
        partDeltaKeysByRole[role] = {};
        for (const part of obj.parts || []) {
            const rest = part.keys[0];
            if (!rest) continue;
            partDeltaKeysByRole[role][part.id] = part.keys.map(k => ({
                t: k.t,
                position: [k.position[0] - rest.position[0], k.position[1] - rest.position[1], k.position[2] - rest.position[2]],
                rotation: [k.rotation[0] - rest.rotation[0], k.rotation[1] - rest.rotation[1], k.rotation[2] - rest.rotation[2]],
                scale: [k.scale[0] / (rest.scale[0] || 1), k.scale[1] / (rest.scale[1] || 1), k.scale[2] / (rest.scale[2] || 1)],
            }));
        }
        movesByRole[role] = draft.moves
            .filter(m => m.objectId === objectId)
            .map(({ id: _id, objectId: _obj, ...rest }) => ({ ...rest }));
    }

    const events: ActionNodePreset['events'] = [];
    for (const ev of draft.events) {
        const role = objectToRole.get(ev.objectId);
        if (!role) continue;
        const state: ActionStatePayload = {};
        for (const key of ['facts', 'conditions', 'addFacts', 'removeFacts', 'removeConditions', 'locomotion', 'stateCue'] as const) if (ev[key] !== undefined) (state as any)[key] = cloneWorld(ev[key]);
        if (ev.relationships) state.relationships = roleRelations(ev.relationships);
        if (ev.removeRelationships) state.removeRelationships = roleRelations(ev.removeRelationships);
        if (ev.kind === 'attach') {
            const parentRole = objectToRole.get(ev.parent.objectId);
            if (!parentRole) throw new Error('Include every attachment parent as an action participant.');
            const parentRoleSpec = roles.find(r => r.role === parentRole);
            if (parentRoleSpec && ev.parent.partId) parentRoleSpec.requiredSocket = ev.parent.partId;
            events.push({
                ...state,
                role,
                kind: 'attach',
                time: ev.time,
                parentRole,
                ...(ev.parent.partId ? { parentSocket: ev.parent.partId } : {}),
                relation: ev.relation,
                ...(ev.localPose ? { localPose: { ...ev.localPose } } : {}),
            });
        } else if (ev.kind === 'detach') {
            const objStart = draft.plan.objects.find(o => o.id === ev.objectId)!.keys[0];
            events.push({
                ...state,
                role,
                kind: 'detach',
                time: ev.time,
                ...(ev.landing
                    ? {
                        landingPosition: cloneWorld(ev.landing.position),
                        landingOffset: {
                            dt: Math.max(.05, ev.landing.time - ev.time),
                            offset: [
                                ev.landing.position[0] - objStart.position[0],
                                ev.landing.position[1],
                                ev.landing.position[2] - objStart.position[2],
                            ],
                        },
                    }
                    : {}),
            });
        } else if (ev.kind === 'facts') {
            events.push({
                ...state,
                role,
                kind: 'facts',
                time: ev.time,
                ...(ev.addFacts ? { addFacts: [...ev.addFacts] } : {}),
                ...(ev.removeFacts ? { removeFacts: [...ev.removeFacts] } : {}),
                ...(ev.conditions ? { conditions: { ...ev.conditions } } : {}),
                ...(ev.facts ? { facts: cloneWorld(ev.facts) } : {}),
            });
        }
    }

    const payload = {
        duration: draft.plan.duration,
        roles,
        relativePlacements,
        partDeltaKeysByRole,
        rootDeltaKeysByRole,
        partStartPosesByRole,
        referenceHipHeightByRole,
        initialFactsByRole,
        referenceFramesByRole,
        rootStartPosesByRole,
        initialAttachmentsByRole,
        initialRelationships,
        initialConditions: cloneWorld(initial.conditions),
        locomotionByRole: Object.entries(roleMap).filter(([, id]) => draft.locomotion.includes(id)).map(([role]) => role),
        ownershipByRole,
        movesByRole,
        events,
    };
    const header = cleanHeader(metadata, JSON.stringify(payload));
    return { kind: 'action_preset', ...header, ...payload };
}

/** Apply a portable ActionNodePreset to bound participant entities while preserving unrelated inventory/state (P09-10..P09-14). */
export function applyActionPreset(
    draft: SceneAuthoringDraft,
    preset: ActionNodePreset,
    roleBindings: Record<string, string>, // roleName -> targetObjectId
    startTime = 0,
): { draft: SceneAuthoringDraft; provenance: PresetProvenance } {
    if (!Number.isFinite(startTime) || startTime < 0 || startTime + preset.duration > draft.plan.duration + 1e-6) throw new Error('The full action must fit in this timeline. Choose a longer take.');
    if (new Set(Object.values(roleBindings)).size !== Object.keys(roleBindings).length) throw new Error('Bind each action participant to a distinct entity.');
    for (const spec of preset.roles) {
        const targetId = roleBindings[spec.role];
        if (!targetId) throw new Error(`Bind a scene entity for action role "${spec.role}".`);
        const obj = draft.plan.objects.find(o => o.id === targetId);
        if (!obj) throw new Error(`Bound entity "${targetId}" for role "${spec.role}" does not exist.`);
        const rig = draft.rigs[targetId];
        if (spec.requiredRigKind && rig && rig.kind !== spec.requiredRigKind) {
            throw new Error(`Role "${spec.role}" requires a ${spec.requiredRigKind} rig, but "${targetId}" is ${rig.kind}.`);
        }
        if (spec.requiredSocket && !obj.parts?.some(p => p.id === spec.requiredSocket) && !rig?.controls?.[spec.requiredSocket]) {
            throw new Error(`Entity "${targetId}" is missing required socket "${spec.requiredSocket}".`);
        }
    }

    const commands: AuthoringCommand[] = [];
    const sourceControls = new Map<string, { objectId: string; partId?: string }>();
    const sourceMasks: AuthoringCommand[] = [];
    const mapOwnedTarget = (role: string, partId?: string) => {
        const objectId = roleBindings[role], object = draft.plan.objects.find(item => item.id === objectId);
        const mappedPart = partId ? draft.rigs[objectId]?.controls[partId] || partId : undefined;
        if (!object || mappedPart && !object.parts?.some(part => part.id === mappedPart)) throw new Error('The action ownership control has no compatible participant.');
        return { objectId, ...(mappedPart ? { partId: mappedPart } : {}) };
    };
    if (preset.ownershipByRole && (typeof preset.ownershipByRole !== 'object' || Array.isArray(preset.ownershipByRole))) throw new Error('Invalid action ownership.');
    for (const [role, policy] of Object.entries(preset.ownershipByRole || {})) {
        if (!preset.roles.some(spec => spec.role === role) || !policy || !Array.isArray(policy.controls) || !Array.isArray(policy.masks) || policy.controls.length > 512 || policy.masks.length > 512) throw new Error('Invalid action ownership.');
        for (const partId of policy.controls) {
            if (typeof partId !== 'string') throw new Error('Invalid action ownership control.');
            const target = mapOwnedTarget(role, partId);
            sourceControls.set(JSON.stringify([target.objectId, target.partId || '']), target);
        }
        for (const mask of policy.masks) {
            if (!mask || !Number.isFinite(mask.start) || !Number.isFinite(mask.end) || mask.start < 0 || mask.end < mask.start || mask.end > preset.duration + 1e-6 || mask.partId !== undefined && typeof mask.partId !== 'string' || !Array.isArray(mask.channels) || mask.channels.some(channel => !['position','rotation','scale'].includes(channel))) throw new Error('Invalid action ownership mask.');
            sourceMasks.push({ kind: 'mask', mask: { target: mapOwnedTarget(role, mask.partId), start: startTime + mask.start, end: Math.min(draft.plan.duration, startTime + mask.end), channels: cloneWorld(mask.channels) } });
        }
    }
    const primary = draft.plan.objects.find(object => object.id === roleBindings[preset.roles[0].role])!;
    const targetFrame = evaluateAuthoringDraft(draft, startTime).plan;
    const primaryPose = initialMotionTransform(targetFrame, primary.id);
    const sourcePrimary = preset.referenceFramesByRole?.[preset.roles[0].role];
    const transformed = (anchor: MotionKey, baseline: MotionKey, current: MotionKey, pivot?: MotionVec3) => continueMotionPose(anchor, { keys: [baseline], pivot } as any, { keys: [current], pivot } as any);
    const bindRelations = (relations: ActionRelationship[] | undefined) => relations?.map(({ fromRole, toRole, ...relation }) => {
        if (!roleBindings[fromRole] || !roleBindings[toRole]) throw new Error('Bind all action relationship dependencies.');
        return { ...cloneWorld(relation), from: roleBindings[fromRole], to: roleBindings[toRole] };
    });
    const bindState = (value: ActionStatePayload, role: string): Omit<ActionStatePayload, 'relationships' | 'removeRelationships'> & Pick<TimedSceneEvent, 'relationships' | 'removeRelationships'> => ({
        ...Object.fromEntries(['facts', 'conditions', 'addFacts', 'removeFacts', 'removeConditions', 'locomotion'].filter(key => (value as any)[key] !== undefined).map(key => [key, cloneWorld((value as any)[key])])),
        ...(value.relationships ? { relationships: bindRelations(value.relationships) } : {}),
        ...(value.removeRelationships ? { removeRelationships: bindRelations(value.removeRelationships) } : {}),
        ...(value.stateCue ? { stateCue: { ...retimePostureCue(value.stateCue, time => startTime + time), ...(value.stateCue.generated ? { generated: value.stateCue.generated.map(key => ({ ...key, t: startTime + key.t, partId: draft.rigs[roleBindings[role]]?.controls[key.partId] || key.partId, value: key.channel === 'position' ? key.value * ((draft.rigs[roleBindings[role]]?.hipHeight || 1) / (preset.referenceHipHeightByRole?.[role] || draft.rigs[roleBindings[role]]?.hipHeight || 1)) : key.value })) } : {}) } } : {}),
    });
    // Establish the participant graph and starting state before same-time action
    // events, so pickup/drop facts at t=0 can intentionally supersede it.
    for (const role of preset.roles.map(spec => spec.role)) {
        const objectId = roleBindings[role], attached = preset.initialAttachmentsByRole?.[role];
        const facts = preset.initialFactsByRole?.[role];
        if (facts && Object.keys(facts).length) commands.push({ kind: 'event', event: { id: `${preset.presetId}:initial:${role}:${draft.revision}`, kind: 'facts', objectId, time: startTime, facts: cloneWorld(facts) } });
        if (attached) {
            const parentId = roleBindings[attached.parentRole], parent = draft.plan.objects.find(object => object.id === parentId);
            const socket = attached.parentSocket ? draft.rigs[parentId]?.controls[attached.parentSocket] || attached.parentSocket : undefined;
            if (!parent || socket && !parent.parts?.some(part => part.id === socket)) throw new Error('Bind the required initial attachment parent and socket.');
            commands.push({ kind: 'event', event: { id: `${preset.presetId}:attachment:${role}:${draft.revision}`, kind: 'attach', objectId, time: startTime, parent: { objectId: parentId, ...(socket ? { partId: socket } : {}) }, relation: attached.relation || 'attached', localPose: cloneWorld(attached.localPose) } });
        } else if (preset.initialAttachmentsByRole && targetFrame.objects.find(object => object.id === objectId)?.attachment) {
            commands.push({ kind: 'event', event: { id: `${preset.presetId}:attachment:${role}:${draft.revision}`, kind: 'detach', objectId, time: startTime } });
        }
    }
    if (preset.initialRelationships?.length || preset.initialConditions) commands.push({ kind: 'event', event: { id: `${preset.presetId}:initial-graph:${draft.revision}`, kind: 'facts', objectId: primary.id, time: startTime, relationships: bindRelations(preset.initialRelationships), conditions: cloneWorld(preset.initialConditions || {}) } });
    const initialEventIds = new Set(commands.flatMap(command => command.kind === 'event' ? [command.event.id] : []));
    commands.push(...sourceMasks);
    for (const [role, keys] of Object.entries(preset.rootDeltaKeysByRole || {})) {
        const objectId = roleBindings[role], object = draft.plan.objects.find(item => item.id === objectId);
        if (!object) throw new Error('Action root has no participant.');
        const currentOrigin = samplePose(object, startTime), placement = preset.relativePlacements[role];
        const savedStart = preset.rootStartPosesByRole?.[role];
        const attached = preset.initialAttachmentsByRole?.[role];
        const sourceFrame = preset.referenceFramesByRole?.[role];
        const identity: MotionKey = { t: 0, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
        const origin = attached && savedStart ? savedStart
            : sourcePrimary && sourceFrame ? transformed(primaryPose, sourcePrimary, sourceFrame)
            : placement ? transformed(primaryPose, identity, { ...currentOrigin, position: placement.offset, rotation: placement.rotation }) : currentOrigin;
        const baseline = savedStart || identity;
        for (const key of keys) {
            const sourcePose = { ...key, position: key.position.map((v, i) => baseline.position[i] + v) as MotionVec3, rotation: key.rotation.map((v, i) => baseline.rotation[i] + v) as MotionVec3, scale: key.scale.map((v, i) => baseline.scale[i] * v) as MotionVec3 };
            const desired = attached && savedStart ? sourcePose : transformed(origin, baseline, sourcePose, object.pivot);
            const pose = authoredRootPoseFromReference(draft, objectId, startTime, desired, { evaluated: targetFrame, ...(attached && savedStart ? { localReference: baseline } : {}) });
            commands.push({ kind: 'pose', target: { objectId }, time: startTime + key.t, pose: { ...pose, t: startTime + key.t } });
        }
    }
    for (const role of preset.locomotionByRole || []) commands.push({ kind: 'locomotion', objectId: roleBindings[role], enabled: true });
    for (const [role, partDeltas] of Object.entries(preset.partDeltaKeysByRole)) {
        const targetId = roleBindings[role];
        const obj = draft.plan.objects.find(o => o.id === targetId)!;
        const rig = draft.rigs[targetId];
        for (const [partId, deltas] of Object.entries(partDeltas)) {
            const mappedPartId = rig?.controls?.[partId] || partId;
            const part = obj.parts?.find(p => p.id === mappedPartId);
            if (!part) throw new Error(`Action participant is missing control "${mappedPartId}".`);
            const savedStart = preset.partStartPosesByRole?.[role]?.[partId];
            const sizeRatio = (rig?.hipHeight || 1) / (preset.referenceHipHeightByRole?.[role] || rig?.hipHeight || 1);
            const rest = savedStart ? { ...part.keys[0], position: savedStart.position.map(n => n * sizeRatio) as MotionVec3, rotation: cloneWorld(savedStart.rotation) } : part.keys[0];
            for (const delta of deltas) {
                const t = Math.min(draft.plan.duration, Math.max(0, startTime + delta.t));
                commands.push({
                    kind: 'pose',
                    target: { objectId: targetId, partId: mappedPartId },
                    time: t,
                    pose: {
                        t,
                        position: [rest.position[0] + delta.position[0], rest.position[1] + delta.position[1], rest.position[2] + delta.position[2]],
                        rotation: [rest.rotation[0] + delta.rotation[0], rest.rotation[1] + delta.rotation[1], rest.rotation[2] + delta.rotation[2]],
                        scale: [rest.scale[0] * delta.scale[0], rest.scale[1] * delta.scale[1], rest.scale[2] * delta.scale[2]],
                    },
                });
            }
        }
    }

    for (const [role, moves] of Object.entries(preset.movesByRole)) {
        const targetId = roleBindings[role];
        moves.forEach((m, index) => {
            const at = Math.min(draft.plan.duration - m.duration, Math.max(0, startTime + m.start));
            commands.push({
                kind: 'move',
                exact: true,
                at,
                move: { id: `${preset.presetId}_${role}_move_${draft.revision + index + 1}`, objectId: targetId, kind: m.kind, duration: m.duration },
            });
        });
    }

    preset.events.forEach((ev, index) => {
        const targetId = roleBindings[ev.role];
        const time = Math.min(draft.plan.duration, Math.max(0, startTime + ev.time));
        const eventId = `${preset.presetId}_ev_${draft.revision + index + 1}`;
        if (ev.kind === 'attach' && ev.parentRole) {
            const parentId = roleBindings[ev.parentRole];
            const parentRig = draft.rigs[parentId];
            const socket = ev.parentSocket ? parentRig?.controls?.[ev.parentSocket] || ev.parentSocket : undefined;
            commands.push({
                kind: 'event',
                event: {
                    ...bindState(ev, ev.role),
                    id: eventId,
                    kind: 'attach',
                    objectId: targetId,
                    time,
                    parent: { objectId: parentId, ...(socket ? { partId: socket } : {}) },
                    relation: ev.relation === 'mounted' ? 'riding' : (ev.relation || 'holds'),
                    ...(ev.localPose ? { localPose: { ...cloneWorld(ev.localPose), t: time } } : {}),
                },
            });
        } else if (ev.kind === 'detach') {
            const objPose = samplePose(draft.plan.objects.find(o => o.id === targetId)!, time);
            commands.push({
                kind: 'event',
                event: {
                    ...bindState(ev, ev.role),
                    id: eventId,
                    kind: 'detach',
                    objectId: targetId,
                    time,
                    ...(ev.landingOffset
                        ? {
                            landing: {
                                time: Math.min(draft.plan.duration, time + ev.landingOffset.dt),
                                position: ev.landingPosition && sourcePrimary ? transformed(primaryPose, sourcePrimary, { ...sourcePrimary, position: ev.landingPosition }).position : [
                                    objPose.position[0] + ev.landingOffset.offset[0],
                                    ev.landingOffset.offset[1],
                                    objPose.position[2] + ev.landingOffset.offset[2],
                                ],
                            },
                        }
                        : {}),
                },
            });
        } else if (ev.kind === 'facts') {
            commands.push({
                kind: 'event',
                event: {
                    ...bindState(ev, ev.role),
                    id: eventId,
                    kind: 'facts',
                    objectId: targetId,
                    time,
                    ...(ev.addFacts ? { addFacts: [...ev.addFacts] } : {}),
                    ...(ev.removeFacts ? { removeFacts: [...ev.removeFacts] } : {}),
                    ...(ev.conditions ? { conditions: { ...ev.conditions } } : {}),
                    ...(ev.facts ? { facts: cloneWorld(ev.facts) } : {}),
                },
            });
        }
    });

    prepareDelayedPresetInsertion(draft, commands, startTime);
    const next = applyAuthoringCommands(draft, draft.revision, commands);
    const ownedMasks = applyPresetOwnership(draft, next, commands, startTime, preset.duration, new Set((preset.locomotionByRole || []).map(role => roleBindings[role])), sourceControls);
    validateDelayedPresetBoundary(draft, next, startTime, preset.duration, Object.values(roleBindings), ownedMasks, initialEventIds, targetFrame);
    return {
        draft: validateScenePerformance({ plan: next.plan, authoring: next }).authoring!,
        provenance: { presetId: preset.presetId, versionId: preset.versionId, kind: 'action_preset', roleBindings: { ...roleBindings } },
    };
}

/** Save reusable articulated geometry and its starting pose independently of a shot. */
export function extractRigAssetPreset(draft: SceneAuthoringDraft, objectId: string, metadata: PresetMetadataInput): RigAssetPreset {
    const start = evaluateAuthoringDraft(draft, 0);
    const object = start.plan.objects.find(item => item.id === objectId), rig = draft.rigs[objectId];
    if (!object || !rig) throw new Error('Choose a rigged subject to save as an object preset.');
    const objectTemplate = cloneWorld(object);
    const matrix = initialMotionMatrix(start.plan, objectId);
    const columns = [0, 1, 2].map(column => [matrix[column], matrix[4 + column], matrix[8 + column]]);
    const lengths = columns.map(column => Math.hypot(...column));
    if (lengths.some(length => length < 1e-9) || [[0, 1], [0, 2], [1, 2]].some(([a, b]) => Math.abs(columns[a].reduce((sum, value, index) => sum + value * columns[b][index], 0) / (lengths[a] * lengths[b])) > 1e-6)) throw new Error('This attached subject has a sheared transform. Adjust its parent scaling before saving it as an independent object.');
    objectTemplate.keys = [0, draft.plan.duration].map(t => ({ ...initialMotionTransform(start.plan, objectId, undefined, { pivot: object.pivot }), t }));
    delete objectTemplate.attachment;
    for (const part of [objectTemplate, ...(objectTemplate.parts || [])]) part.keys = [0, draft.plan.duration].map(t => ({ ...cloneWorld(part.keys[0]), t }));
    const payload = { rigKind: rig.kind, objectTemplate, rig: cloneWorld(rig), sockets: Object.values(rig.controls), dependencies: [], initialFacts: cloneWorld(start.state.objects[objectId]?.facts || {}) };
    return { kind: 'rig_asset', ...cleanHeader(metadata, JSON.stringify(payload)), ...payload };
}

export function applyRigAssetPreset(draft: SceneAuthoringDraft, preset: RigAssetPreset, objectId: string): SceneAuthoringDraft {
    if (draft.plan.objects.some(object => object.id === objectId)) throw new Error('This object ID is already in the scene.');
    const object = cloneWorld(preset.objectTemplate); object.id = objectId; delete object.attachment;
    for (const part of [object, ...(object.parts || [])]) part.keys = [0, draft.plan.duration].map(t => ({ ...cloneWorld(part.keys[0]), t }));
    const plan = { ...cloneWorld(draft.plan), objects: [...cloneWorld(draft.plan.objects), object] };
    const addition = createAuthoringDraft(plan, draft.sourceKey);
    const next = { ...cloneWorld(draft), revision: draft.revision + 1, plan, rigs: { ...cloneWorld(draft.rigs), [objectId]: cloneWorld(preset.rig) } };
    next.sourceState.objects[objectId] = { ...addition.sourceState.objects[objectId], facts: cloneWorld(preset.initialFacts || {}) };
    return validateScenePerformance({ plan, authoring: next }).authoring!;
}

/** Extract a portable StagePreset without live jobs, billing receipts, or user ownership leaks (P09-04, P09-05, P09-17). */
export function extractStagePreset(
    world: SpatialWorld,
    rigs: Record<string, RigBinding>,
    metadata: PresetMetadataInput,
    stageGraph?: {
        authoring?: SceneAuthoringDraft;
        nodes?: Array<{ id: string; label?: string; kind?: 'movement' | 'action' }>;
        connections?: Array<any>;
        routes?: Record<string, any>;
        states?: Record<string, any>;
    },
): StagePreset {
    const authoring = stageGraph?.authoring || world.authoring;
    const performance = authoring ? validateScenePerformance({ plan: authoring.plan, authoring }) : undefined;
    const cleanWorld = validateWorld(cloneWorld(performance ? { ...world, plan: performance.plan, authoring: performance.authoring } : world));
    const cleanNodes = stageGraph?.nodes?.map(n => ({
        id: String(n.id),
        ...(n.label ? { label: String(n.label) } : {}),
        ...(n.kind ? { kind: n.kind } : {}),
    }));
    const cleanConnections = stageGraph?.connections?.map(c => ({
        id: String(c.id),
        sourceNodeId: String(c.sourceNodeId),
        targetNodeId: String(c.targetNodeId),
        kind: (c.kind === 'action' ? 'action' : 'movement') as 'movement' | 'action',
        ...(c.actionPlayback ? { actionPlayback: c.actionPlayback } : {}),
        ...(c.actionPrompt ? { actionPrompt: String(c.actionPrompt) } : {}),
        movement: {
            durationMs: Number(c.movement?.durationMs) || 5000,
            samples: Array.isArray(c.movement?.samples) ? cloneWorld(c.movement.samples) : [],
        },
    }));
    const cleanRoutes: StagePreset['routes'] = stageGraph?.routes
        ? Object.fromEntries(
            Object.entries(stageGraph.routes).map(([routeId, route]: [string, any]) => {
                const stripAnimatic = (anim: any) => anim && anim.plan ? {
                    plan: cloneWorld(anim.plan),
                    ...(anim.authoring ? { authoring: cloneWorld(anim.authoring) } : {}),
                    prompt: String(anim.prompt || ''),
                    ...(anim.creatorInstruction ? { creatorInstruction: String(anim.creatorInstruction) } : {}),
                    sourceState: cloneWorld(anim.sourceState),
                    endState: cloneWorld(anim.endState),
                    ...(anim.stateChanges ? { stateChanges: cloneWorld(anim.stateChanges) } : {}),
                } : undefined;
                return [routeId, {
                    ...(stripAnimatic(route?.forward) ? { forward: stripAnimatic(route.forward) } : {}),
                    ...(stripAnimatic(route?.backward) ? { backward: stripAnimatic(route.backward) } : {}),
                }];
            })
        )
        : undefined;
    const payload = {
        aspectRatio: (cleanWorld.aspectRatio || '16:9') as '16:9' | '9:16' | '1:1',
        plan: cloneWorld(cleanWorld.plan),
        ...(cleanWorld.authoring ? { authoring: cloneWorld(cleanWorld.authoring) } : {}),
        ...(cleanWorld.locomotion ? { locomotion: cloneWorld(cleanWorld.locomotion) } : {}),
        rigs: cloneWorld(cleanWorld.authoring?.rigs || rigs),
        controlledObject: cleanWorld.controlledObject,
        controlMode: cleanWorld.controlMode,
        walkable: cloneWorld(cleanWorld.walkable),
        obstacles: cloneWorld(cleanWorld.obstacles),
        initialState: cloneWorld(cleanWorld.initialState),
        dependencies: [],
        ...(cleanNodes ? { nodes: cleanNodes } : {}),
        ...(cleanConnections ? { connections: cleanConnections } : {}),
        ...(cleanRoutes ? { routes: cleanRoutes } : {}),
        ...(stageGraph?.states ? { states: cloneWorld(stageGraph.states) } : {}),
    };
    const header = cleanHeader(metadata, JSON.stringify(payload));
    return { kind: 'stage_preset', ...header, ...payload };
}

/** Built-in starter presets for immediate studio use in SpatialStudio and MotionGuidePreview. */
export const BUILTIN_MOTION_PRESETS: MotionNodePreset[] = [
    extractMotionNodePreset(
        {
            schema: 'clikb.scene-authoring.v1',
            draftId: 'builtin_stride',
            sourceKey: 'builtin:stride',
            revision: 1,
            plan: {
                version: 1,
                duration: 5,
                background: '#edf5fc',
                objects: [
                    {
                        id: 'actor',
                        shape: 'box',
                        color: '#bd5c65',
                        role: 'actor',
                        keys: [
                            { t: 0, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
                            { t: 5, position: [0, 0, 2.6], rotation: [0, 0, 0], scale: [1, 1, 1] },
                        ],
                    },
                ],
                camera: [{ t: 0, position: [0, 2, 6], target: [0, 1, 0], fov: 43 }, { t: 5, position: [0, 2, 6], target: [0, 1, 0], fov: 43 }],
            },
            sourceState: {
                controlledObject: 'actor',
                controlMode: 'character',
                camera: { t: 0, position: [0, 2, 6], target: [0, 1, 0], fov: 43 },
                objects: { actor: { transform: { t: 0, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, facts: {}, assets: [] } },
                relationships: [],
                conditions: {},
            },
            rigs: { actor: { kind: 'biped', controls: {}, strideLength: 1.3, hipHeight: .91 } },
            moves: [],
            events: [],
            locks: [],
            masks: [],
            manualControls: [],
            locomotion: ['actor'],
        },
        'actor',
        { presetId: 'preset_forward_stride', title: 'Forward Stride (2.6m)', description: 'Root-synchronized walk stride over 5s.', tags: ['walk', 'locomotion', 'biped'] },
    ),
    extractMotionNodePreset(
        {
            schema: 'clikb.scene-authoring.v1',
            draftId: 'builtin_acrobatic_roll',
            sourceKey: 'builtin:roll',
            revision: 1,
            plan: {
                version: 1,
                duration: 5,
                background: '#edf5fc',
                objects: [
                    {
                        id: 'actor',
                        shape: 'box',
                        color: '#bd5c65',
                        role: 'actor',
                        keys: [
                            { t: 0, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
                            { t: 5, position: [0, 0, 1.8], rotation: [0, 0, 0], scale: [1, 1, 1] },
                        ],
                    },
                ],
                camera: [{ t: 0, position: [0, 2, 6], target: [0, 1, 0], fov: 43 }, { t: 5, position: [0, 2, 6], target: [0, 1, 0], fov: 43 }],
            },
            sourceState: {
                controlledObject: 'actor',
                controlMode: 'character',
                camera: { t: 0, position: [0, 2, 6], target: [0, 1, 0], fov: 43 },
                objects: { actor: { transform: { t: 0, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, facts: {}, assets: [] } },
                relationships: [],
                conditions: {},
            },
            rigs: { actor: { kind: 'biped', controls: {}, strideLength: 1.3, hipHeight: .91 } },
            moves: [{ id: 'roll_1', objectId: 'actor', kind: 'roll', start: .6, duration: .8 }],
            events: [],
            locks: [],
            masks: [],
            manualControls: [],
            locomotion: ['actor'],
        },
        'actor',
        { presetId: 'preset_tactical_roll', title: 'Tactical Roll + Advance', description: 'Forward advance with a full 360° roll at 0.6s.', tags: ['roll', 'stunt', 'action'] },
    ),
];

/** Creator economy publication & entitlement helpers (P10-01..P10-12). */
export function submitPresetForPublication<T extends AnyScenePreset>(
    preset: T,
    terms: PresetEconomyTerms,
): T {
    if (!Number.isInteger(terms.pricePixels) || terms.pricePixels < 0 || terms.pricePixels > 10000) {
        throw new Error('Preset pricePixels must be an integer between 0 and 10000.');
    }
    if (!Number.isInteger(terms.creatorShareBps) || terms.creatorShareBps < 0 || terms.creatorShareBps > 10000) {
        throw new Error('creatorShareBps must be between 0 and 10000.');
    }
    const clone = JSON.parse(JSON.stringify(preset)) as T;
    clone.visibility = 'public_review';
    clone.economy = { ...terms };
    return clone;
}

export function approvePublishedPreset<T extends AnyScenePreset>(preset: T): T {
    if (preset.visibility !== 'public_review') throw new Error('Only presets in public_review can be approved for publication.');
    const clone = JSON.parse(JSON.stringify(preset)) as T;
    clone.visibility = 'published';
    return Object.freeze(clone);
}

export type PresetEntitlementReceipt = {
    receiptId: string;
    buyerUserId: number;
    creatorUserId?: number;
    presetId: string;
    versionId: string;
    pricePixels: number;
    creatorEarnedPixels: number;
    platformFeePixels: number;
    grantedAt: number;
};

export function createPresetEntitlementReceipt(
    preset: AnyScenePreset,
    buyerUserId: number,
    idempotencyKey: string,
): PresetEntitlementReceipt {
    if (preset.visibility !== 'published' && preset.creatorUserId !== buyerUserId) {
        throw new Error('Cannot acquire an unpublished preset owned by another creator.');
    }
    const pricePixels = preset.creatorUserId === buyerUserId ? 0 : (preset.economy?.pricePixels || 0);
    const shareBps = preset.economy?.creatorShareBps ?? 8000;
    const creatorEarnedPixels = Math.floor((pricePixels * shareBps) / 10000);
    const platformFeePixels = pricePixels - creatorEarnedPixels;
    return {
        receiptId: `ent_${preset.versionId}_${buyerUserId}_${idempotencyKey}`,
        buyerUserId,
        ...(preset.creatorUserId !== undefined ? { creatorUserId: preset.creatorUserId } : {}),
        presetId: preset.presetId,
        versionId: preset.versionId,
        pricePixels,
        creatorEarnedPixels,
        platformFeePixels,
        grantedAt: Date.now(),
    };
}
