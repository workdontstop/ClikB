import { applyAuthoringCommands, evaluateAuthoringDraft, samplePose, type AuthoringCommand, type SceneAuthoringDraft, type PoseTarget, type PoseChannel } from './sceneAuthoring';
import { adoptMotionGuideState } from './motionGuideState';
import { expandScenePlan } from './sceneRecipes';
import { validateScenePerformance } from './scenePerformance';
import { cloneWorld, type WorldState } from './spatialWorld';
import { compileSceneStateCues } from './sceneStatePerformance';

/** A protected local control depends on its whole parent chain, including
 * attachment changes later in the shot. AI operations cannot alter that chain. */
function dependsOn(draft: SceneAuthoringDraft, child: PoseTarget, ancestor: PoseTarget, seen = new Set<string>()): boolean {
    if (child.objectId === ancestor.objectId && (!ancestor.partId || child.partId === ancestor.partId)) return true;
    const key = JSON.stringify(child);
    if (seen.has(key)) return false;
    seen.add(key);
    const object = draft.plan.objects.find(item => item.id === child.objectId);
    if (!object) return false;
    if (child.partId) {
        const part = object.parts?.find(item => item.id === child.partId);
        if (dependsOn(draft, { objectId: child.objectId, ...(part?.parentId ? { partId: part.parentId } : {}) }, ancestor, seen)) return true;
    } else {
        const parents = [object.attachment, ...draft.events.flatMap(event => event.kind === 'attach' && event.objectId === child.objectId ? [event.parent] : [])].filter(Boolean) as PoseTarget[];
        if (parents.some(parent => dependsOn(draft, parent, ancestor, new Set(seen)))) return true;
    }
    return false;
}

function aiOperationProtected(draft: SceneAuthoringDraft, command: AuthoringCommand, pinned: readonly string[]): boolean {
    if (command.kind === 'lock' || command.kind === 'unlock' || command.kind === 'mask') throw new Error('AI must preserve creator pins and masks.');
    if (command.kind === 'lightingRig') return false;
    if (command.kind === 'camera' || command.kind === 'cameraRig') return draft.manualControls.includes(JSON.stringify(['$camera', '']));
    const value: any = command;
    const targets: PoseTarget[] = [value.target || { objectId: value.objectId || value.event?.objectId || value.move?.objectId }];
    // Replacing an operation ID also removes its previous subject's motion.
    if (command.kind === 'event') {
        const old = draft.events.find(event => event.id === command.event.id);
        if (old) targets.push({ objectId: old.objectId });
        for (const relation of [...(command.event.relationships || []), ...(command.event.removeRelationships || [])]) targets.push({ objectId: relation.from }, { objectId: relation.to });
    }
    if (command.kind === 'move') {
        const old = draft.moves.find(move => move.id === command.move.id);
        if (old) targets.push({ objectId: old.objectId });
    }
    const whole: PoseTarget[] = pinned.map(objectId => ({ objectId }));
    if (targets.some(target => pinned.includes(target.objectId))) return true;
    // Manual base keys remain fixed while separately authored procedural moves
    // may animate them. Explicit pins/interval masks also protect evaluated motion.
    for (const key of command.kind === 'move' || command.kind === 'locomotion' ? [] : draft.manualControls) {
        const [objectId, partId] = JSON.parse(key);
        if (objectId !== '$camera') whole.push({ objectId, ...(partId ? { partId } : {}) });
    }
    if (whole.some(control => targets.some(target => dependsOn(draft, control, target)))) return true;
    const ranges = [
        ...(draft.masks || []).map(mask => ({ target: mask.target || mask, start: mask.start, end: mask.end, channels: mask.channels })),
        ...draft.locks.map(lock => ({ target: lock, start: lock.time, end: lock.end ?? lock.time, channels: lock.channels })),
    ];
    return ranges.some(range => targets.some(target => {
        if (!dependsOn(draft, range.target, target)) return false;
        // Non-pose operations can change hierarchy/procedural output. Retain
        // the creator's interval rather than guessing a partial safe rewrite.
        if (command.kind !== 'pose') return true;
        const same = target.objectId === range.target.objectId && target.partId === range.target.partId;
        const channels: PoseChannel[] = command.channels || ['position', 'rotation', 'scale'];
        if (same && !channels.some(channel => range.channels.includes(channel))) return false;
        const object = draft.plan.objects.find(item => item.id === target.objectId);
        const track = target.partId ? object?.parts?.find(part => part.id === target.partId) : object;
        const before = track?.keys.filter(key => key.t < command.time).at(-1)?.t ?? 0;
        const after = command.holdTail ? draft.plan.duration : track?.keys.find(key => key.t > command.time)?.t ?? draft.plan.duration;
        const [start, end] = command.interval || [before, after];
        return start <= range.end && end >= range.start;
    }));
}

/** A construction revision updates ONE shot; event time is always story time. */
export function adoptSceneBuild(raw: any, sourceKey: string, previous?: SceneAuthoringDraft, pinned: readonly string[] = [], planInput = raw?.plan || raw): SceneAuthoringDraft {
    let draft = adoptMotionGuideState(expandScenePlan(planInput), sourceKey, previous, raw?.initialState, pinned, true, true);
    const performance = raw?.performance;
    if (!performance) return draft;
    if (typeof performance !== 'object' || Array.isArray(performance)) throw new Error('Invalid scene performance.');
    if (performance.commands && !Array.isArray(performance.commands) || performance.events && !Array.isArray(performance.events)) throw new Error('Performance operations must be arrays.');
    const authoredCommands = cloneWorld(performance.commands || []).map((command: any) => { delete command.generatedPosture; return command; });
    const commands: AuthoringCommand[] = cloneWorld([...(performance.states ? compileSceneStateCues(draft, performance.states) : []), ...authoredCommands, ...(performance.events || []).map((event: any) => ({ kind: 'event', event }))]);
    if (commands.length > 2000) throw new Error('Too many performance operations in one update.');
    const oldControls = [...draft.manualControls], oldMasks = cloneWorld(draft.masks || []);
    for (const command of commands) {
        if (aiOperationProtected({ ...draft, manualControls: oldControls, masks: oldMasks }, command, pinned)) continue;
        if (command.kind === 'pose' && command.channels) {
            const object = draft.plan.objects.find(item => item.id === command.target.objectId)!;
            const track = command.target.partId ? object.parts!.find(part => part.id === command.target.partId)! : object;
            const pose = samplePose(track, command.time);
            for (const channel of command.channels) pose[channel] = cloneWorld(command.pose[channel]);
            command.pose = pose;
        }
        if (command.kind === 'event') draft.events = draft.events.filter(event => event.id !== command.event.id);
        if (command.kind === 'move') { draft.moves = draft.moves.filter(move => move.id !== command.move.id); command.exact = true; }
        draft = applyAuthoringCommands(draft, draft.revision, [command]);
    }
    // AI-authored keys are refinable; only creator-authored controls are pinned.
    draft.manualControls = oldControls;
    draft.masks = oldMasks;
    return validateScenePerformance({ plan: draft.plan, authoring: draft }).authoring!;
}

/** Carry legacy planner outcomes into the same event timeline as physical edits.
 * End metadata can supplement geometry, never overwrite the starting state. */
export function reconcileSceneOutcome(draft: SceneAuthoringDraft, outcome: WorldState, namespace: string, supplied?: { facts: string[]; conditions: boolean; relationships: boolean; locomotion?: boolean }): SceneAuthoringDraft {
    let next = cloneWorld(draft);
    const time = next.plan.duration;
    const evaluated = evaluateAuthoringDraft(next, time).state;
    const commands: AuthoringCommand[] = [];
    if ((!supplied || supplied.locomotion) && outcome.locomotion) {
        const id = `${namespace}:capabilities:outcome`;
        next.events = next.events.filter(event => event.id !== id);
        commands.push({ kind: 'event', event: { id, kind: 'facts', objectId: outcome.controlledObject || next.plan.objects[0].id, time, locomotion: cloneWorld(outcome.locomotion) } });
    }
    for (const [id, object] of Object.entries(outcome.objects)) {
        if (!evaluated.objects[id]) continue;
        const facts = object.facts || {};
        const includesFacts = !supplied || supplied.facts.includes(id);
        const changed = includesFacts ? Object.fromEntries(Object.entries(facts).filter(([key, value]) => JSON.stringify(evaluated.objects[id].facts?.[key]) !== JSON.stringify(value))) : {};
        const removeFacts = includesFacts ? Object.keys(evaluated.objects[id].facts || {}).filter(key => !Object.prototype.hasOwnProperty.call(facts, key)) : [];
        const conditions = !supplied || supplied.conditions ? Object.fromEntries(Object.entries(outcome.conditions || {}).filter(([key, value]) => JSON.stringify(evaluated.conditions?.[key]) !== JSON.stringify(value))) : {};
        const signature = (relation: WorldState['relationships'][number]) => JSON.stringify([relation.from, relation.to, relation.relation]);
        const relationships = !supplied || supplied.relationships ? outcome.relationships.filter(relation => relation.from === id && !evaluated.relationships.some(old => signature(old) === signature(relation) && JSON.stringify(old.facts) === JSON.stringify(relation.facts))) : [];
        const removeRelationships = !supplied || supplied.relationships ? evaluated.relationships.filter(relation => relation.from === id && !outcome.relationships.some(next => signature(next) === signature(relation))) : [];
        const removeConditions = !supplied || supplied.conditions ? Object.keys(evaluated.conditions || {}).filter(key => !Object.prototype.hasOwnProperty.call(outcome.conditions || {}, key)) : [];
        if (Object.keys(changed).length || Object.keys(conditions).length || removeFacts.length || relationships.length || removeRelationships.length || removeConditions.length) {
            const event = { id: `${namespace}:${id}:outcome`, kind: 'facts' as const, objectId: id, time, facts: changed, conditions, removeFacts, relationships, removeRelationships, removeConditions };
            next.events = next.events.filter(old => old.id !== event.id);
            commands.push({ kind: 'event', event });
        }
    }
    return commands.length ? applyAuthoringCommands(next, next.revision, commands) : next;
}

export const scenePerformanceInstructions = `AUTHORITATIVE TIMELINE AND STATE:
Derive the complete performance from the original VIDEO PROMPT plus starting image, guide text and explicit corrections. Existing sourceState is ground truth for the start; the image supplies visible placement/posture where saved state is absent. initialState records the starting facts, supports, possession and carrier relationships, never a later construction revision's endpoint.
Alongside the plan, you may return performance:{commands:[AuthoringCommand],events:[TimedSceneEvent]}. Supported commands are pose {target:{objectId,partId?},time,pose:{t,position,rotation,scale},holdTail?}, camera {time,camera}, cameraRig {rig}, lightingRig {lighting}, locomotion {objectId,enabled}, move {at,move:{id,objectId,kind:jump|roll|crouch,duration}}. Events are {id,time,objectId,kind:facts,facts?,conditions?}, {id,time,objectId,kind:attach,parent:{objectId,partId?},relation:holds|riding|attached,localPose?}, or {id,time,objectId,kind:detach,landing?:{time,position}}. Use stable event/move IDs when refining an accepted operation. Output complete root/local-part keys or explicit pose commands for posture and contacts; semantic words alone do not animate. Do not encode the same motion twice in procedural operations and baked keys.
For a standard recipe biped you may also return performance.states:[{objectId,time,posture:standing|kneeling|seated,until?:number}]. These explicit cues compile into pelvis/hip/knee/ankle keys and timed posture facts. until holds that pose through the specified time; author intermediate transition keys or later cues for transitions. They do not guess asymmetric poses, hand contacts, seat height or equipment: refine those with local keys/commands. Preserve an already correct source pose instead of replacing it with a generic cue. Nonstandard anatomy requires explicit mapped poses.
A released cup falls once, lands at its authored location and remains there until another authored action moves it. Persist position, orientation, supports, inventory and relationships after transitions. For detach+landing the evaluator owns position during the fall; author subsequent root deltas only for intentional post-landing motion. For held objects use attachment/events rather than independent conflicting world tracks. Driving requires the actual actor seated/attached to the carrier and appropriate body/vehicle tracks.
Every construction update refines the SAME complete shot timeline. Preserve unchanged subjects, poses, events and manual pins. Never reset starting state or repeat completed story actions because a new build chunk arrived. New facts must agree with the rendered physical pose. A scene is complete only when all requested actions and their persistent consequences are represented throughout the requested duration.`;
