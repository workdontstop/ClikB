import {
    applyAuthoringRefinement,
    evaluateAuthoringDraft,
    prototypeUnitPose,
    samplePose,
    type AuthoringCommand,
    type PoseTarget,
    type SceneAuthoringDraft,
} from './sceneAuthoring';
import { armTargetCommands, legTargetCommands } from './sceneRig';
import { defaultLightingRigForPreset } from './sceneCamera';

// A separate assistance profile; conversation/Concierge settings stay owned there.
export const SCENE_ASSIST_PROFILE = { tier: 'luna', reasoningEffort: 'low', purpose: 'small-constrained-scene-edits' } as const;
export const SCENE_JEV_ROLE = 'bounded-assist-decisions-only' as const;

export function buildSceneAssistContext(draft: SceneAuthoringDraft, input: { instruction: string; participants: string[]; time: number }) {
    if (!input.instruction.trim() || input.instruction.length > 4000) throw new Error('Describe a focused scene change.');
    const current = evaluateAuthoringDraft(draft, input.time), participants = new Set(input.participants);
    for (const id of participants) if (!current.plan.objects.some(object => object.id === id)) throw new Error('An assistance participant no longer exists.');
    // Include attachment ancestors/children, so a mounted rider or held item is not lost.
    for (let pass = 0; pass < current.plan.objects.length; pass++) {
        for (const object of current.plan.objects) {
            if (object.attachment && (participants.has(object.id) || participants.has(object.attachment.objectId))) {
                participants.add(object.id);
                participants.add(object.attachment.objectId);
            }
        }
    }
    return {
        captured: { draftId: draft.draftId, sourceKey: draft.sourceKey, revision: draft.revision },
        profile: SCENE_ASSIST_PROFILE,
        instruction: input.instruction,
        time: input.time,
        duration: draft.plan.duration,
        participants: current.plan.objects
            .filter(object => participants.has(object.id))
            .map(object => ({ object, rig: draft.rigs[object.id], state: current.state.objects[object.id] })),
        relationships: current.state.relationships.filter(relation => participants.has(relation.from) || participants.has(relation.to)),
        locks: draft.locks.filter(lock => participants.has(lock.objectId)),
        rule: 'Return proposed data edits only. Preserve pinned channels and unrelated participants. Local IK handles pointer feedback; this request is not a pointer-frame loop.',
    };
}

/** Validate and apply bounded assistance proposals against captured revision, participant scope, and user pins. */
export function applySceneAssistProposal(
    draft: SceneAuthoringDraft,
    captured: Pick<SceneAuthoringDraft, 'draftId' | 'sourceKey' | 'revision'>,
    allowedParticipants: string[],
    commands: AuthoringCommand[],
) {
    const permitted = new Set(allowedParticipants);
    const check = (target: PoseTarget) => {
        if (!permitted.has(target.objectId)) throw new Error('The proposal edits an entity outside the requested participants.');
    };
    for (const command of commands) {
        if (command.kind === 'pose') check(command.target);
        else if (command.kind === 'lock' || command.kind === 'unlock') throw new Error('Scene assistance cannot change user pin permissions.');
        else if (command.kind === 'event') {
            check({ objectId: command.event.objectId });
            if (command.event.kind === 'attach') check(command.event.parent);
        } else if (command.kind === 'move') check({ objectId: command.move.objectId });
        else if (command.kind === 'locomotion') check({ objectId: command.objectId });
        else if (command.kind === 'mask') {
            const target = command.mask.target ?? (command.mask.objectId ? { objectId: command.mask.objectId, partId: command.mask.partId } : undefined);
            if (!target) throw new Error('The mask command is missing a target.');
            check(target);
        }
        else if (command.kind === 'cameraRig') {
            if (command.rig && command.rig.kind !== 'free' && command.rig.target) check(command.rig.target);
        } else if (command.kind !== 'camera' && command.kind !== 'lightingRig') throw new Error('Unsupported scene-assist operation.');
    }
    return applyAuthoringRefinement(draft, captured, commands);
}

/** Compile a focused natural-language assist instruction into bounded AuthoringCommands. */
export function proposeSceneAssistCommands(
    draft: SceneAuthoringDraft,
    input: { instruction: string; participants: string[]; time: number },
): AuthoringCommand[] {
    const context = buildSceneAssistContext(draft, input);
    const text = input.instruction.toLowerCase();
    const primaryId = input.participants[0] || context.participants[0]?.object.id;
    if (!primaryId) throw new Error('Select a participant for scene assistance.');
    const at = Math.max(0, Math.min(draft.plan.duration, input.time));
    const commands: AuthoringCommand[] = [];
    const primaryObj = draft.plan.objects.find(o => o.id === primaryId)!;
    const basePose = samplePose(primaryObj, at);

    if (/\broll\b/.test(text)) {
        commands.push({ kind: 'move', at: Math.min(draft.plan.duration - .8, at), move: { id: `assist_roll_${draft.revision + 1}`, objectId: primaryId, kind: 'roll', duration: .8 } });
    } else if (/\bjump\b|\bleap\b|\bhop\b/.test(text)) {
        commands.push({ kind: 'move', at: Math.min(draft.plan.duration - 1, at), move: { id: `assist_jump_${draft.revision + 1}`, objectId: primaryId, kind: 'jump', duration: 1 } });
    } else if (/\bcrouch\b|\bduck\b|\bkneel\b|\bsquat\b/.test(text)) {
        commands.push({ kind: 'move', at: Math.min(draft.plan.duration - 1, at), move: { id: `assist_crouch_${draft.revision + 1}`, objectId: primaryId, kind: 'crouch', duration: 1 } });
    }

    if (/\bwave\b|\braise.*arm\b|\breach\b/.test(text) && draft.rigs[primaryId]?.kind === 'biped') {
        const side = /\bleft\b/.test(text) ? 'left' : 'right';
        commands.push(
            { kind: 'mask', mask: { target: { objectId: primaryId, partId: `${side}_shoulder` }, start: at, end: Math.min(draft.plan.duration, at + 1.5), channels: ['rotation'] } },
            ...armTargetCommands(draft, primaryId, side, at, [side === 'left' ? -.25 : .25, 1.65, .35]),
        );
    } else if (/\bstep\b|\bkick\b/.test(text) && draft.rigs[primaryId]?.legLengths) {
        const side = /\bright\b/.test(text) ? 'right' : 'left';
        commands.push(...legTargetCommands(draft, primaryId, side, at, [side === 'left' ? -.18 : .18, .25, .38], true));
    }

    if (/\bdrop\b|\brelease\b/.test(text)) {
        const attached = context.participants.find(p => p.object.attachment?.objectId === primaryId)?.object;
        if (attached) {
            commands.push({
                kind: 'event',
                event: {
                    id: `assist_detach_${draft.revision + 1}`,
                    kind: 'detach',
                    objectId: attached.id,
                    time: at,
                    landing: { time: Math.min(draft.plan.duration, at + .6), position: [basePose.position[0] + .35, .08, basePose.position[2] + .35] },
                },
            });
        }
    } else if (/\bmount\b|\bride\b|\bboard\b/.test(text)) {
        const mountTarget = context.participants.find(p => p.object.id !== primaryId && (p.rig?.kind === 'quadruped' || p.rig?.kind === 'wheeled' || p.rig?.controls?.saddle));
        if (mountTarget) {
            commands.push({
                kind: 'event',
                event: {
                    id: `assist_mount_${draft.revision + 1}`,
                    kind: 'attach',
                    objectId: primaryId,
                    time: at,
                    parent: { objectId: mountTarget.object.id, ...(mountTarget.rig?.controls?.saddle ? { partId: mountTarget.rig.controls.saddle } : {}) },
                    relation: 'riding',
                    localPose: prototypeUnitPose([0, .05, 0]),
                },
            });
        }
    } else if (/\bdismount\b/.test(text) && primaryObj.attachment) {
        commands.push({
            kind: 'event',
            event: { id: `assist_dismount_${draft.revision + 1}`, kind: 'detach', objectId: primaryId, time: at },
        });
    }

    if (/\borbit\b/.test(text)) {
        commands.push({ kind: 'cameraRig', rig: { kind: 'orbit', target: { objectId: primaryId }, focalLengthMm: 35, radius: 5, height: 1.5, turns: 1 } });
    } else if (/\boverhead\b|\btop[- ]down\b|\bzenith\b/.test(text)) {
        commands.push({ kind: 'cameraRig', rig: { kind: 'overhead', target: { objectId: primaryId }, focalLengthMm: 35, height: 7, heading: 0 } });
    } else if (/\bdolly\s*zoom\b|\bzolly\b|\bvertigo\b/.test(text)) {
        commands.push({ kind: 'cameraRig', rig: { kind: 'zolly', target: { objectId: primaryId }, focalLengthMm: 35, startDistance: 4, endDistance: 10, height: 0 } });
    } else if (/\bcrash\s*zoom\b/.test(text)) {
        commands.push({ kind: 'cameraRig', rig: { kind: 'crash', target: { objectId: primaryId }, focalLengthMm: 24, endFocalLengthMm: 135, startTime: at, zoomDuration: .25 } });
    } else if (/\bsnorri\b|\bbody[- ]mount/.test(text)) {
        commands.push({ kind: 'cameraRig', rig: { kind: 'mounted', target: { objectId: primaryId }, focalLengthMm: 24, offset: [0, .15, 1.5], lookOffset: [0, .15, 0] } });
    } else if (/\bdutch\b|\btilt\s*roll\b/.test(text)) {
        const existing = draft.cameraRig || { kind: 'free' as const, focalLengthMm: 35 };
        commands.push({ kind: 'cameraRig', rig: { ...existing, roll: (existing.roll || 0) + (/\bleft\b/.test(text) ? -.2 : .2) } });
    }

    if (/\bgolden\b|\bsunset\b|\bsunrise\b|\bwarm\s*light/.test(text)) {
        commands.push({ kind: 'lightingRig', lighting: defaultLightingRigForPreset('golden') });
    } else if (/\bdramatic\b|\bnoir\b|\bhigh[- ]contrast\b/.test(text)) {
        commands.push({ kind: 'lightingRig', lighting: defaultLightingRigForPreset('dramatic') });
    } else if (/\bmoon\b|\bmoonlight\b|\bnight\s*light/.test(text)) {
        commands.push({ kind: 'lightingRig', lighting: defaultLightingRigForPreset('moonlight') });
    } else if (/\bbacklit\b|\bbacklight\b|\bsilhouette\b/.test(text)) {
        commands.push({ kind: 'lightingRig', lighting: defaultLightingRigForPreset('backlit') });
    } else if (/\bnoon\b|\bhigh\s*sun\b|\bdaylight\b/.test(text)) {
        commands.push({ kind: 'lightingRig', lighting: defaultLightingRigForPreset('noon') });
    } else if (/\bstudio\s*light/.test(text)) {
        commands.push({ kind: 'lightingRig', lighting: defaultLightingRigForPreset('studio') });
    }

    if (!commands.length) {
        const moved = {
            ...basePose,
            t: Math.min(draft.plan.duration, at + 1.2),
            position: [
                basePose.position[0] + (/\bleft\b/.test(text) ? -.8 : /\bright\b/.test(text) ? .8 : 0),
                basePose.position[1],
                basePose.position[2] + (/\bback\b/.test(text) ? -1.2 : 1.2),
            ] as [number, number, number],
        };
        commands.push({ kind: 'pose', target: { objectId: primaryId }, time: moved.t, pose: moved });
        if (draft.rigs[primaryId]) commands.push({ kind: 'locomotion', objectId: primaryId, enabled: true });
    }
    return commands;
}
