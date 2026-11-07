import { interpolateBoxSpan, motionSegment, validateMotionPlan, type MotionCameraKey, type MotionKey, type MotionObject, type MotionPart, type MotionPlan, type MotionVec3 } from './motionGuidePlan';
import { initialMotionTransform, continueMotionPose } from './motionNodeTransforms';
import { cloneWorld, newWorldState, stateAtEnd, type WorldState } from './spatialWorld';
import {resolveSceneCamera,type SceneCameraRig,type SceneLightingRig} from './sceneCameraPrototype';

// Opt-in shared authoring document. Legacy plans retain their existing semantics.
export type PoseTarget = { objectId: string; partId?: string };
export type PoseChannel = 'position' | 'rotation' | 'scale';
export type RigBinding = { kind: 'biped' | 'quadruped' | 'wheeled' | 'rotor'; controls: Record<string, string>; strideLength: number; legLengths?: [number,number]; hipHeight?: number; halfHipWidth?: number };
export type GeneratedPostureKey = { partId: string; t: number; channel: 'position' | 'rotation'; axis: number; value: number };
export type PostureCueMetadata = { posture: 'standing' | 'kneeling' | 'seated'; until: number; generated?: GeneratedPostureKey[] };
export const retimePostureCue = (cue: PostureCueMetadata, time: (value: number) => number): PostureCueMetadata => ({ ...cue, until: time(cue.until), ...(cue.generated ? { generated: cue.generated.map(key => ({ ...key, t: time(key.t) })) } : {}) });
export type AttachmentEvent = { id: string; time: number; objectId: string; stateCue?: PostureCueMetadata; locomotion?: WorldState['locomotion']; conditions?: Record<string, unknown>; facts?: Record<string, unknown>; addFacts?: string[]; removeFacts?: string[]; removeConditions?: string[]; relationships?: WorldState['relationships']; removeRelationships?: WorldState['relationships'] } & (
    { kind: 'attach'; parent: { objectId: string; partId?: string }; relation: 'holds' | 'riding' | 'attached'; localPose?: MotionKey }
    | { kind: 'detach'; landing?: { time: number; position: MotionVec3 } }
    | { kind: 'facts' }
);
export type TimedSceneEvent = AttachmentEvent;
export type MoveTrigger = { id: string; objectId: string; kind: 'jump' | 'roll' | 'crouch'; start: number; duration: number };
export type MovePerformance = MoveTrigger;
export type ManualMask = PoseTarget & { target?: PoseTarget; start: number; end: number; channels: PoseChannel[] };
export type PoseLock = PoseTarget & { time: number; end?: number; channels: PoseChannel[]; pose: MotionKey };
export type SceneAuthoringDraft = {
    schema: 'clikb.scene-authoring.v1'; draftId: string; sourceKey: string; revision: number;
    plan: MotionPlan; sourceState: WorldState; events: AttachmentEvent[];
    rigs: Record<string, RigBinding>; locomotion: string[]; moves: MoveTrigger[];
    manualControls: string[]; masks?: ManualMask[]; locks: PoseLock[];
    cameraRig?:SceneCameraRig;
    lightingRig?:SceneLightingRig;
};
export type AuthoringCommand =
    | { kind: 'remove'; target: PoseTarget }
    | { kind: 'pose'; target: PoseTarget; time: number; pose: MotionKey; holdTail?: boolean; interval?: [number, number]; channels?: PoseChannel[]; generatedPosture?: boolean }
    | { kind: 'mask'; mask: { target?: PoseTarget; objectId?: string; partId?: string; start: number; end: number; channels: PoseChannel[] } }
    | { kind: 'camera'; time: number; camera: MotionCameraKey }
    | { kind: 'cameraRig'; rig?:SceneCameraRig }
    | { kind: 'lightingRig'; lighting?:SceneLightingRig }
    | { kind: 'event'; event: AttachmentEvent }
    | { kind: 'move'; move: Omit<MoveTrigger, 'start'>; at: number; exact?: boolean }
    | { kind: 'locomotion'; objectId: string; enabled: boolean }
    | { kind: 'lock'; target: PoseTarget; time: number; end?: number; channels: PoseChannel[] }
    | { kind: 'unlock'; target: PoseTarget; time: number };

const copy = cloneWorld;
const controlKey = (target: PoseTarget) => JSON.stringify([target.objectId, target.partId || '']);
// Reserved, non-entity control marker; kept in the existing versioned document
// so manually keyed camera tracks survive save/reload and AI plan adoption.
const cameraControlKey = JSON.stringify(['$camera', '']);
const unit: MotionVec3 = [1, 1, 1];
const lerp = (a: number[], b: number[], t: number): MotionVec3 => a.map((n, i) => n + (b[i] - n) * t) as MotionVec3;
const finite = (n: number) => Number.isFinite(n);
function timeInside(time: number, duration: number) { if (!finite(time) || time < 0 || time > duration) throw new Error('Time is outside this performance.'); }
function targetPart(plan: MotionPlan, target: PoseTarget): MotionPart {
    const object = plan.objects.find(item => item.id === target.objectId);
    const part = target.partId ? object?.parts?.find(item => item.id === target.partId) : object;
    if (!part) throw new Error('The selected entity/control no longer exists.');
    return part;
}

/** A static subject is being arranged, not animated back to its old endpoint.
 * Timed subjects retain their earlier history and hold the correction forward. */
export function manualPoseCommands(draft: SceneAuthoringDraft, target: PoseTarget, time: number, pose: MotionKey): AuthoringCommand[] {
    const part = targetPart(draft.plan, target), first = part.keys[0];
    const stationary = part.keys.every(key => (['position', 'rotation', 'scale'] as const).every(channel => key[channel].every((value, index) => Math.abs(value - first[channel][index]) < 1e-9)));
    if (stationary && !draft.events.some(event => event.objectId === target.objectId)) return part.keys.map(key => ({ kind: 'pose', target, time: key.t, pose: { ...copy(pose), t: key.t } }));
    return [{ kind: 'pose', target, time, pose, ...(stationary ? { holdTail: true } : {}) }];
}

/** Explicitly fit a reusable stage to a shot without truncating events or motion. */
export function fitAuthoringDuration(draft: SceneAuthoringDraft, duration: number): SceneAuthoringDraft {
    if (!Number.isFinite(duration) || duration < 2 || duration > 15) throw new Error('Choose a supported take duration.');
    if (draft.plan.duration === duration) return copy(draft);
    const time = (value: number) => value / draft.plan.duration * duration;
    const track = <T extends { t: number }>(keys: T[]) => keys.map(key => ({ ...copy(key), t: time(key.t) }));
    const plan = { ...copy(draft.plan), duration, camera: track(draft.plan.camera), objects: draft.plan.objects.map(object => ({ ...copy(object), keys: track(object.keys), ...(object.parts ? { parts: object.parts.map(part => ({ ...copy(part), keys: track(part.keys) })) } : {}) })) };
    const next = mergeAuthoringPlan(draft, plan, { preserveManualTracks: true });
    next.events = draft.events.map(event => ({ ...copy(event), time: time(event.time), ...(event.stateCue ? { stateCue: retimePostureCue(event.stateCue, time) } : {}), ...(event.kind === 'detach' && event.landing ? { landing: { ...event.landing, time: time(event.landing.time) } } : {}) }));
    next.moves = draft.moves.map(move => ({ ...copy(move), start: time(move.start), duration: time(move.duration) }));
    if (next.cameraRig?.kind === 'crash') next.cameraRig = { ...next.cameraRig, ...(next.cameraRig.startTime !== undefined ? { startTime: time(next.cameraRig.startTime) } : {}), ...(next.cameraRig.zoomDuration !== undefined ? { zoomDuration: time(next.cameraRig.zoomDuration) } : {}) };
    return next;
}

// Match the renderer's quaternion interpolation without a backend Three.js dependency.
function quaternionEuler(a: MotionVec3, b: MotionVec3, t: number): MotionVec3 {
    const q = ([x, y, z]: MotionVec3) => {
        const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2), s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
        return [s1*c2*c3+c1*s2*s3, c1*s2*c3-s1*c2*s3, c1*c2*s3+s1*s2*c3, c1*c2*c3-s1*s2*s3];
    };
    const x = q(a), y = q(b); let dot = x.reduce((sum, n, i) => sum + n * y[i], 0);
    if (dot < 0) { y.forEach((n, i) => y[i] = -n); dot = -dot; }
    let result: number[];
    if (dot > .9995) { result = x.map((n, i) => n + (y[i]-n)*t); const length = Math.hypot(...result); result = result.map(n => n/length); }
    else { const angle = Math.acos(Math.min(1, dot)), den = Math.sin(angle); result = x.map((n, i) => (n*Math.sin((1-t)*angle)+y[i]*Math.sin(t*angle))/den); }
    const [qx,qy,qz,qw] = result, r13 = 2*(qx*qz+qy*qw);
    return Math.abs(r13) < .9999999
        ? [Math.atan2(2*(qx*qw-qy*qz),1-2*(qx*qx+qy*qy)),Math.asin(Math.max(-1,Math.min(1,r13))),Math.atan2(2*(qz*qw-qx*qy),1-2*(qy*qy+qz*qz))]
        : [Math.atan2(2*(qy*qz+qx*qw),1-2*(qx*qx+qz*qz)),Math.asin(Math.max(-1,Math.min(1,r13))),0];
}
export function samplePose(part: MotionPart, time: number): MotionKey {
    let [a,b,t] = motionSegment(part.keys, time);
    if (part.interpolation === 'step') { b = a; t = 0; }
    if (a.span || b.span) return { ...interpolateBoxSpan(a,b,t), t: time };
    return { t: time, position: lerp(a.position,b.position,t), rotation: part.rotationMode === 'quaternion' ? quaternionEuler(a.rotation,b.rotation,t) : lerp(a.rotation,b.rotation,t), scale: lerp(a.scale,b.scale,t),
        ...(a.opacity !== undefined || b.opacity !== undefined ? { opacity: (a.opacity ?? 1)+((b.opacity ?? 1)-(a.opacity ?? 1))*t } : {}) };
}
function freezeTrack(pose: MotionKey, duration: number): MotionKey[] { return [0,duration].map(t => ({ ...copy(pose), t })); }
export function travelledDistance(part: MotionPart, time: number) {
    let distance = 0;
    for (let i=1;i<part.keys.length;i++) {
        const a=part.keys[i-1],b=part.keys[i]; if (a.t >= time) break;
        distance += Math.hypot(...b.position.map((n,j)=>n-a.position[j])) * Math.min(1,(time-a.t)/(b.t-a.t));
    }
    return distance;
}
function sampleBase(draft: SceneAuthoringDraft, time: number): MotionPlan {
    const duration = draft.plan.duration;
    const frame = { ...copy(draft.plan), objects: draft.plan.objects.map(object => ({ ...copy(object), keys: freezeTrack(samplePose(object,time),duration),
        ...(object.parts ? { parts: object.parts.map(part => ({ ...copy(part), keys: freezeTrack(samplePose(part,time),duration) })) } : {}) })) };
    const [a,b,t] = motionSegment(draft.plan.camera,time);
    const up=lerp(a.up || [0,1,0],b.up || [0,1,0],t);
    const camera = { t: 0, position: lerp(a.position,b.position,t), target: lerp(a.target,b.target,t), fov: a.fov+(b.fov-a.fov)*t, roll: (a.roll ?? 0)+((b.roll ?? 0)-(a.roll ?? 0))*t,
        ...(a.up || b.up ? {up:Math.hypot(...up)<1e-9 ? a.up || [0,1,0] as MotionVec3 : up} : {}) };
    frame.camera = [0,duration].map(t => ({ ...copy(camera),t }));
    for (const id of draft.locomotion) {
        const rig = draft.rigs[id], object = frame.objects.find(item=>item.id===id), original = draft.plan.objects.find(item=>item.id===id);
        if (!rig || !object || !original) continue;
        const distance = travelledDistance(original,time), phase = distance/rig.strideLength*Math.PI*2;
        const animate = (control: string, axis: number, value: number) => {
            const partId = rig.controls[control];
            if (!partId) return;
            const key = controlKey({ objectId: id, partId });
            if (draft.manualControls.includes(key)) return;
            if ((draft.masks || []).some(mask => controlKey(mask) === key && time >= mask.start - 1e-6 && time <= mask.end + 1e-6 && mask.channels.includes('rotation'))) return;
            const part = object.parts?.find(item=>item.id===partId); if (part) part.keys.forEach(key=>key.rotation[axis]+=value);
        };
        if (rig.kind === 'biped' || rig.kind === 'quadruped') {
            const amplitude = Math.min(.85,.25+distance/duration*.2);
            for (const [control,offset] of [['left_hip',0],['right_hip',Math.PI],['left_shoulder',Math.PI],['right_shoulder',0],['front_left_hip',Math.PI],['front_right_hip',0]] as const) animate(control,0,Math.sin(phase+offset)*amplitude);
            animate('left_knee',0,Math.max(0,Math.sin(phase))*.8); animate('right_knee',0,Math.max(0,Math.sin(phase+Math.PI))*.8);
        } else if (rig.kind === 'wheeled') { for (const control of Object.keys(rig.controls)) if (control.startsWith('wheel')) animate(control,0,distance/Math.max(.05,rig.strideLength)); }
        else if (rig.kind === 'rotor') animate('rotor',1,(time*20)%(Math.PI*2));
    }
    for (const move of draft.moves) {
        if (time < move.start || time >= move.start + move.duration) continue;
        const object=frame.objects.find(item=>item.id===move.objectId)!;
        const p=Math.min(1,(time-move.start)/move.duration), wave=Math.sin(Math.PI*p);
        if (move.kind==='jump') object.keys.forEach(key=>key.position[1]+=wave*.9);
        if (move.kind==='roll') { object.pivot=[0,.85,0]; object.keys.forEach(key=>{key.rotation[0]+=2*Math.PI*(p*p*(3-2*p)); key.position[1]+=wave*.2;}); }
        if (move.kind==='crouch') {
            const pelvis=object.parts?.find(part=>part.id===draft.rigs[object.id]?.controls.pelvis);
            pelvis?.keys.forEach(key=>key.position[1]-=wave*.25);
        }
    }
    return frame;
}

type AttachmentOverride = { pose: MotionKey; parent?: MotionObject['attachment']; releasedAt: number; landing?: { time: number; position: MotionVec3 } };
function frameAt(draft: SceneAuthoringDraft, time: number, overrides: Map<string,AttachmentOverride>) {
    const frame=sampleBase(draft,time);
    for (const [id,value] of overrides) {
        const object=frame.objects.find(item=>item.id===id)!;
        object.attachment=copy(value.parent ?? null) ?? undefined;
        const pose=copy(value.pose);
        if (value.landing) {
            const fraction=Math.max(0,Math.min(1,(time-value.releasedAt)/(value.landing.time-value.releasedAt)));
            pose.position=fraction===1?copy(value.landing.position):lerp(pose.position,value.landing.position,fraction*fraction);
        }
        const anchorTime=value.landing?.time ?? value.releasedAt;
        // Event pose already includes the active move at its boundary. Compose
        // the sampled local delta once, including any subsequent move triggers.
        const baseline=sampleBase(draft,anchorTime).objects.find(item=>item.id===id)!;
        const continued=time >= anchorTime ? continueMotionPose(pose,baseline,object) : pose;
        object.keys=freezeTrack(continued,frame.duration);
    }
    return frame;
}
export function evaluateAuthoringDraft(draft: SceneAuthoringDraft, time: number): { plan: MotionPlan; state: WorldState } {
    timeInside(time,draft.plan.duration);
    const overrides=new Map<string,AttachmentOverride>(), relationships=copy(draft.sourceState.relationships);
    const conditions=copy(draft.sourceState.conditions || {}), objectFacts: Record<string, Record<string, unknown>> = {};
    let locomotion = draft.sourceState.locomotion;
    const removedFacts: Record<string, Set<string>> = {};
    for (const event of draft.events.map((value,index)=>({value,index})).sort((a,b)=>a.value.time-b.value.time||a.index-b.index).map(item=>item.value)) {
        if (event.time>time) break;
        if (event.locomotion) locomotion = event.locomotion;
        if (event.conditions && typeof event.conditions === 'object') Object.assign(conditions, copy(event.conditions));
        for (const key of event.removeConditions || []) delete conditions[key];
        for (const key of event.removeFacts || []) { (removedFacts[event.objectId] ||= new Set()).add(key); if (objectFacts[event.objectId]) delete objectFacts[event.objectId][key]; }
        for (const key of event.addFacts || []) { (objectFacts[event.objectId] ||= {})[key] = true; removedFacts[event.objectId]?.delete(key); }
        if (event.facts && typeof event.facts === 'object') objectFacts[event.objectId] = { ...(objectFacts[event.objectId] || {}), ...copy(event.facts) };
        for (const key of Object.keys(event.facts || {})) removedFacts[event.objectId]?.delete(key);
        for (const relation of event.removeRelationships || []) for (let i = relationships.length - 1; i >= 0; i--) {
            const old = relationships[i]; if (old.from === relation.from && old.to === relation.to && old.relation === relation.relation) relationships.splice(i, 1);
        }
        for (const relation of event.relationships || []) {
            const i = relationships.findIndex(old => old.from === relation.from && old.to === relation.to && old.relation === relation.relation);
            if (i < 0) relationships.push(copy(relation)); else relationships[i] = copy(relation);
        }
        if (event.kind === 'facts') continue;
        const before=frameAt(draft,event.time,overrides);
        const pose=event.kind==='attach' && event.localPose ? copy(event.localPose) : initialMotionTransform(before,event.objectId,event.kind==='attach'?event.parent:undefined);
        overrides.set(event.objectId,{pose,parent:event.kind==='attach'?event.parent:undefined,releasedAt:event.time,...(event.kind==='detach'&&event.landing?{landing:event.landing}:{})});
        for (let i=relationships.length-1;i>=0;i--) {
            const r=relationships[i];
            if ((r.to===event.objectId&&r.relation==='holds') || (r.from===event.objectId&&['riding','attached'].includes(r.relation))) relationships.splice(i,1);
        }
        if(event.kind==='attach') relationships.push(event.relation==='holds'?{from:event.parent.objectId,to:event.objectId,relation:'holds'}:{from:event.objectId,to:event.parent.objectId,relation:event.relation});
        // Validate each intermediate graph, including same-time atomic ordering.
        validateMotionPlan(frameAt(draft,event.time,overrides));
    }
    const plan=validateMotionPlan(frameAt(draft,time,overrides)), state=stateAtEnd(plan,draft.sourceState);
    // This prototype's versioned evaluator owns wider optics and camera-up.
    // Existing MotionPlan loading/validation remains unchanged.
    const shot=resolveSceneCamera(draft.cameraRig,plan,time);plan.camera=[0,plan.duration].map(t=>({...copy(shot),t}));state.camera={...copy(shot),t:0};
    state.relationships=relationships;
    state.conditions=conditions;
    if (locomotion) state.locomotion=copy(locomotion);
    for (const [id, facts] of Object.entries(objectFacts)) if (state.objects[id]) state.objects[id].facts = { ...(state.objects[id].facts || {}), ...facts };
    for (const [id, keys] of Object.entries(removedFacts)) if (state.objects[id]) for (const key of keys) delete state.objects[id].facts[key];
    let controlled=draft.sourceState.controlledObject;const seen=new Set<string>();
    while(controlled&&!seen.has(controlled)){seen.add(controlled);const parent=plan.objects.find(object=>object.id===controlled)?.attachment?.objectId;if(!parent)break;controlled=parent;}
    if(controlled){state.controlledObject=controlled;state.controlMode=controlled!==draft.sourceState.controlledObject?(draft.rigs[controlled]?.kind==='wheeled'||draft.rigs[controlled]?.kind==='rotor'?'vehicle':'mounted'):draft.sourceState.controlMode;}
    for(const pose of Object.values(state.objects)){pose.transform.t=0; for(const key of Object.values(pose.parts||{}))key.t=0;}
    state.camera={...state.camera,t:0};
    return {plan,state};
}

/** Map a desired reference-frame pose into the immutable authored base.
 * A * inverse(C) * D cancels existing event/procedural effects at the insertion
 * boundary. They remain in the evaluator and compose once onto the new deltas.
 * Attached preset tracks use their explicit local reference instead of C. */
export function authoredRootPoseFromReference(draft: SceneAuthoringDraft, objectId: string, time: number, desired: MotionKey, options: { evaluated?: MotionPlan; localReference?: MotionKey } = {}): MotionKey {
    timeInside(time, draft.plan.duration);
    const object = draft.plan.objects.find(item => item.id === objectId);
    if (!object) throw new Error('The action participant no longer exists.');
    const base = { ...object, attachment: undefined, keys: [samplePose(object, time)] };
    const anchor = initialMotionTransform({ ...draft.plan, objects: [base] }, objectId);
    const reference = options.localReference ? { ...object, keys: [options.localReference] }
        : { ...object, pivot: undefined, keys: [initialMotionTransform(options.evaluated || evaluateAuthoringDraft(draft, time).plan, objectId)] };
    return continueMotionPose(anchor, reference, { ...object, keys: [desired] });
}

export function createAuthoringDraft(plan: MotionPlan, sourceKey: string, rigs: Record<string,RigBinding> = {}, sourceState?: WorldState): SceneAuthoringDraft {
    const valid=validateMotionPlan(plan);
    const draftId=globalThis.crypto?.randomUUID?.()||`local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {schema:'clikb.scene-authoring.v1',draftId,sourceKey,revision:0,plan:copy(valid),sourceState:copy(sourceState||newWorldState(valid)),events:[],rigs:copy(rigs),locomotion:[],moves:[],manualControls:[],masks:[],locks:[]};
}
function setKey<T extends {t:number}>(keys:T[],value:T,holdTail=false,duration=5):T[]{
    const next=keys.filter(key=>Math.abs(key.t-value.t)>.000001&&(!holdTail||key.t<value.t)); next.push(copy(value));
    if(holdTail&&value.t<duration)next.push({...copy(value),t:duration});
    return next.sort((a,b)=>a.t-b.t);
}
export function applyAuthoringCommands(draft: SceneAuthoringDraft, expectedRevision: number, commands: AuthoringCommand[]): SceneAuthoringDraft {
    if(draft.revision!==expectedRevision)throw new Error('Stale authoring revision; newer edits are retained.');
    const next=copy(draft),duration=next.plan.duration;
    next.masks ||= [];
    const pinLockToTrack=(plan:MotionPlan,target:PoseTarget,start:number,end:number|undefined,channels:PoseChannel[],lockedPose:MotionKey)=>{
        const part=targetPart(plan,target);
        if(end!==undefined&&end>start){
            const startSample=samplePose(part,start),endSample=samplePose(part,end);
            for(const ch of channels){startSample[ch]=copy(lockedPose[ch]);endSample[ch]=copy(lockedPose[ch]);}
            part.keys=setKey(part.keys,{...startSample,t:start},false,duration);
            part.keys=setKey(part.keys,{...endSample,t:end},false,duration);
            for(const k of part.keys){
                if(k.t>=start-1e-6&&k.t<=end+1e-6){
                    for(const ch of channels)k[ch]=copy(lockedPose[ch]);
                }
            }
        }
    };
    for(const command of commands){
        if(command.kind==='remove'){
            targetPart(next.plan, command.target);
            const removed = new Set<string>(), removedParts = new Set<string>();
            if (!command.target.partId) removed.add(command.target.objectId);
            else {
                removedParts.add(command.target.partId);
                const object = next.plan.objects.find(item => item.id === command.target.objectId)!;
                for (let pass = 0; pass < (object.parts?.length || 0); pass++) for (const part of object.parts || []) if (part.parentId && removedParts.has(part.parentId)) removedParts.add(part.id);
                next.plan.objects = next.plan.objects.map(item => item.id === object.id ? { ...item, parts: item.parts?.filter(part => !removedParts.has(part.id)) } : item);
                for (const item of next.plan.objects) if (item.attachment?.objectId === object.id && removedParts.has(item.attachment.partId || '')) removed.add(item.id);
            }
            for (let pass = 0; pass < next.plan.objects.length; pass++) for (const object of next.plan.objects) if (object.attachment && removed.has(object.attachment.objectId)) removed.add(object.id);
            const plan = { ...next.plan, objects: next.plan.objects.filter(object => !removed.has(object.id)) };
            if (!plan.objects.length) throw new Error('Keep at least one scene object.');
            Object.assign(next, mergeAuthoringPlan(next, plan, { preserveManualTracks: false }));
            for (const id of removed) delete next.sourceState.objects[id];
            next.sourceState.relationships = next.sourceState.relationships.filter(relation => !removed.has(relation.from) && !removed.has(relation.to));
            if (next.sourceState.controlledObject && removed.has(next.sourceState.controlledObject)) delete next.sourceState.controlledObject;
        }else if(command.kind==='pose'){
            timeInside(command.time,duration); const part=targetPart(next.plan,command.target);
            if (!command.generatedPosture) for (const event of next.events) if (event.objectId === command.target.objectId && event.stateCue?.generated) {
                const [start, end] = command.interval || [command.time, command.holdTail ? duration : command.time];
                event.stateCue.generated = event.stateCue.generated.filter(key => !(key.partId === command.target.partId && key.t >= start - 1e-6 && key.t <= end + 1e-6 && (!command.channels || command.channels.includes(key.channel))));
            }
            const key=controlKey(command.target);
            if(command.interval){
                const [start,end]=command.interval;timeInside(start,duration);timeInside(end,duration);
                if(end<start)throw new Error('Mask interval end must be >= start.');
                if(command.time<start||command.time>end)throw new Error('Pose time must be inside its affected interval.');
                const channels=command.channels||['position','rotation','scale'];
                if(!channels.length||channels.some(ch=>!['position','rotation','scale'].includes(ch)))throw new Error('Invalid pose channels.');
                const before=samplePose(part,start),after=samplePose(part,end),pose=samplePose(part,command.time);
                for(const ch of channels)pose[ch]=copy(command.pose[ch]);
                // The legacy continuous track cannot express a jump at an inner
                // interval boundary without changing its neighbouring segment.
                if((start>0&&command.time===start||end<duration&&command.time===end)
                    &&channels.some(ch=>pose[ch].some((n,i)=>Math.abs(n-(command.time===start?before:after)[ch][i])>1e-9)))
                    throw new Error('Place a bounded pose inside its interval to preserve motion outside it.');
                part.keys=setKey(part.keys,{...before,t:start},false,duration);
                part.keys=setKey(part.keys,{...after,t:end},false,duration);
                part.keys=setKey(part.keys,{...pose,t:command.time},false,duration);
                next.masks.push({...copy(command.target),target:copy(command.target),start,end,channels:copy(channels)});
            }else{
                part.keys=setKey(part.keys,{...copy(command.pose),t:command.time},command.holdTail,duration);
                if(!next.manualControls.includes(key))next.manualControls.push(key);
            }
        }else if(command.kind==='mask'){
            const tgt=command.mask.target||{objectId:command.mask.objectId||'',...(command.mask.partId?{partId:command.mask.partId}:{})};
            targetPart(next.plan,tgt);
            timeInside(command.mask.start,duration);timeInside(command.mask.end,duration);
            if(command.mask.end<command.mask.start)throw new Error('Mask interval end must be >= start.');
            next.masks.push({...copy(tgt),target:copy(tgt),start:command.mask.start,end:command.mask.end,channels:copy(command.mask.channels)});
        }else if(command.kind==='camera'){
            timeInside(command.time,duration);next.plan.camera=setKey(next.plan.camera,{...copy(command.camera),t:command.time});
            if(!next.manualControls.includes(cameraControlKey))next.manualControls.push(cameraControlKey);
        }else if(command.kind==='cameraRig'){
            next.cameraRig=command.rig?copy(command.rig):undefined;
        }else if(command.kind==='lightingRig'){
            next.lightingRig=command.lighting?copy(command.lighting):undefined;
        }else if(command.kind==='event'){
            const e=copy(command.event); timeInside(e.time,duration);targetPart(next.plan,{objectId:e.objectId});
            if (e.stateCue) {
                timeInside(e.stateCue.until, duration);
                if (e.stateCue.until < e.time || !['standing','kneeling','seated'].includes(e.stateCue.posture)) throw new Error('Invalid posture cue.');
                if (e.stateCue.generated !== undefined) {
                    if (!Array.isArray(e.stateCue.generated) || e.stateCue.generated.length > 4000) throw new Error('Invalid generated posture keys.');
                    for (const key of e.stateCue.generated) { timeInside(key.t, duration); targetPart(next.plan, { objectId: e.objectId, partId: key.partId }); if (!['position','rotation'].includes(key.channel) || ![0,1,2].includes(key.axis) || !finite(key.value)) throw new Error('Invalid generated posture key.'); }
                }
            }
            if (e.locomotion && (!['ground','air','water','vehicle'].includes(e.locomotion.kind) || typeof e.locomotion.vertical !== 'boolean' || !finite(e.locomotion.speed) || e.locomotion.speed < .1 || e.locomotion.speed > 10 || !finite(e.locomotion.turnRate) || e.locomotion.turnRate < .1 || e.locomotion.turnRate > 6)) throw new Error('Invalid movement capabilities.');
            for (const keys of [e.addFacts, e.removeFacts, e.removeConditions]) if (keys && (!Array.isArray(keys) || keys.some(key => typeof key !== 'string' || ['__proto__','constructor','prototype'].includes(key)))) throw new Error('Invalid state field names.');
            for (const relations of [e.relationships, e.removeRelationships]) if (relations) {
                if (!Array.isArray(relations)) throw new Error('Invalid state relationships.');
                for (const relation of relations) { targetPart(next.plan, { objectId: relation.from }); targetPart(next.plan, { objectId: relation.to }); if (typeof relation.relation !== 'string') throw new Error('Invalid relationship.'); }
            }
            if(!['attach','detach','facts'].includes(e.kind))throw new Error('Unsupported attachment event.');
            if(!e.id||next.events.some(item=>item.id===e.id))throw new Error('Attachment event IDs must be unique.');
            if(e.kind==='attach'){targetPart(next.plan,e.parent);if(!['holds','riding','attached'].includes(e.relation))throw new Error('Unsupported attachment relationship.');}
            if(e.kind==='detach'&&e.landing){timeInside(e.landing.time,duration);if(e.landing.time<=e.time)throw new Error('Landing must follow release.');}
            next.events.push(e);
        }else if(command.kind==='move'){
            timeInside(command.at,duration);targetPart(next.plan,{objectId:command.move.objectId});
            if(!command.move.id||next.moves.some(item=>item.id===command.move.id)||!['jump','roll','crouch'].includes(command.move.kind)||!finite(command.move.duration)||command.move.duration<=0)throw new Error('Invalid or repeated move trigger.');
            const end=command.exact ? command.at : next.moves.filter(item=>item.objectId===command.move.objectId).reduce((end,item)=>Math.max(end,item.start+item.duration),command.at);
            if(end+command.move.duration>duration+.000001)throw new Error('Move extends beyond this take. Choose an earlier time or shorter move.');
            next.moves.push({...copy(command.move),start:end});
        }else if(command.kind==='locomotion'){
            if(!Object.hasOwn(next.rigs,command.objectId))throw new Error('This entity has no bound locomotion controls.');
            next.locomotion=next.locomotion.filter(id=>id!==command.objectId);if(command.enabled)next.locomotion.push(command.objectId);
        }else if(command.kind==='unlock')next.locks=next.locks.filter(lock=>!(controlKey(lock)===controlKey(command.target)&&lock.time===command.time));
        else if(command.kind==='lock'){
            timeInside(command.time,duration);
            if(command.end!==undefined){timeInside(command.end,duration);if(command.end<command.time)throw new Error('Pin interval end must be >= start.');}
            const current=evaluateAuthoringDraft(next,command.time),pose=targetPart(current.plan,command.target).keys[0];
            next.locks=next.locks.filter(lock=>!(controlKey(lock)===controlKey(command.target)&&lock.time===command.time));
            next.locks.push({...copy(command.target),time:command.time,...(command.end!==undefined?{end:command.end}:{}),channels:copy(command.channels),pose:copy(pose)});
            if(command.end!==undefined&&command.end>command.time){
                pinLockToTrack(next.plan,command.target,command.time,command.end,command.channels,pose);
                next.masks.push({...copy(command.target),target:copy(command.target),start:command.time,end:command.end,channels:copy(command.channels)});
            }
        }else throw new Error('Unsupported authoring command.');
    }
    next.plan=validateMotionPlan(next.plan);
    for(const time of new Set([0,duration,...next.events.map(event=>event.time),...next.moves.flatMap(move=>[move.start,move.start+move.duration/2,move.start+move.duration])]))evaluateAuthoringDraft(next,time);
    for(const lock of next.locks){
        const lockEnd=lock.end!==undefined&&lock.end>lock.time?lock.end:lock.time;
        const candidateTimes=new Set<number>([lock.time,lockEnd]);
        if(lockEnd>lock.time){
            const steps=Math.max(8,Math.ceil((lockEnd-lock.time)*30));
            for(let i=1;i<steps;i++)candidateTimes.add(lock.time+(lockEnd-lock.time)*(i/steps));
            for(const obj of next.plan.objects){
                for(const k of obj.keys)if(k.t>=lock.time-1e-6&&k.t<=lockEnd+1e-6)candidateTimes.add(Math.max(lock.time,Math.min(lockEnd,k.t)));
                for(const part of obj.parts||[])for(const k of part.keys)if(k.t>=lock.time-1e-6&&k.t<=lockEnd+1e-6)candidateTimes.add(Math.max(lock.time,Math.min(lockEnd,k.t)));
            }
            for(const ev of next.events){
                if(ev.time>=lock.time-1e-6&&ev.time<=lockEnd+1e-6)candidateTimes.add(Math.max(lock.time,Math.min(lockEnd,ev.time)));
                if(ev.kind==='detach'&&ev.landing&&ev.landing.time>=lock.time-1e-6&&ev.landing.time<=lockEnd+1e-6)candidateTimes.add(Math.max(lock.time,Math.min(lockEnd,ev.landing.time)));
            }
            for(const mv of next.moves){
                for(const mt of [mv.start,mv.start+mv.duration/2,mv.start+mv.duration]){
                    if(mt>=lock.time-1e-6&&mt<=lockEnd+1e-6)candidateTimes.add(Math.max(lock.time,Math.min(lockEnd,mt)));
                }
            }
        }
        for(const t of [...candidateTimes].sort((a,b)=>a-b)){
            const pose=targetPart(evaluateAuthoringDraft(next,t).plan,lock).keys[0];
            if(lock.channels.some(channel=>pose[channel].some((n,i)=>Math.abs(n-lock.pose[channel][i])>.00001)))throw new Error('This edit changes a pinned pose. Unlock it or refine another interval.');
        }
    }
    next.revision=draft.revision+1;return next;
}

export function mergeAuthoringPlan(
    draft: SceneAuthoringDraft,
    targetPlan: MotionPlan,
    options?: { preserveManualTracks?: boolean; controlledObjectId?: string; isNewAuthoringEdit?: boolean }
): SceneAuthoringDraft {
    const validTarget=validateMotionPlan(targetPlan);
    const next=copy(draft);
    const oldDuration=Math.max(0.001,draft.plan.duration||validTarget.duration);
    const newDuration=validTarget.duration;
    const scaleTime=(t:number)=>{
        if(Math.abs(oldDuration-newDuration)<1e-6)return Math.max(0,Math.min(newDuration,t));
        return Math.max(0,Math.min(newDuration,(t/oldDuration)*newDuration));
    };
    const scaleKeys=(keys:MotionKey[]):MotionKey[]=>{
        const mapped=keys.map(k=>({...copy(k),t:scaleTime(k.t)})).sort((a,b)=>a.t-b.t);
        if(mapped.length===0)return [{t:0,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]},{t:newDuration,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}];
        mapped[0].t=0;
        if(mapped.length===1)mapped.push({...copy(mapped[0]),t:newDuration});
        else mapped[mapped.length-1].t=newDuration;
        const deduped:MotionKey[]=[];
        for(const k of mapped){
            if(deduped.length>0&&Math.abs(deduped[deduped.length-1].t-k.t)<=1e-6)deduped[deduped.length-1]=k;
            else deduped.push(k);
        }
        if(deduped.length===1)deduped.push({...copy(deduped[0]),t:newDuration});
        return deduped;
    };
    const manualSet=new Set<string>(next.manualControls||[]);
    for(const mask of next.masks||[])manualSet.add(controlKey(mask));
    for(const lock of next.locks||[])manualSet.add(controlKey(lock));
    const preserveManual=options?.preserveManualTracks!==false;
    const controlledRootKey=options?.controlledObjectId?controlKey({objectId:options.controlledObjectId}):undefined;

    if(options?.isNewAuthoringEdit){
        // `draft` was just edited in studio on top of `targetPlan`. Keep `draft.plan` for all manual controls/masks/locks/camera,
        // while preserving any non-manual multi-key animations from `targetPlan` that were not manually overridden.
        const mergedPlan=copy(draft.plan);
        mergedPlan.duration=newDuration;
        for(const obj of mergedPlan.objects){
            const targetObj=validTarget.objects.find(o=>o.id===obj.id);
            const objKey=controlKey({objectId:obj.id});
            if(targetObj&&!manualSet.has(objKey)&&targetObj.keys.length>obj.keys.length){
                obj.keys=scaleKeys(targetObj.keys);
            }else{
                obj.keys=scaleKeys(obj.keys);
            }
            for(const part of obj.parts||[]){
                const targetPartObj=targetObj?.parts?.find(p=>p.id===part.id);
                const partKey=controlKey({objectId:obj.id,partId:part.id});
                if(targetPartObj&&!manualSet.has(partKey)&&targetPartObj.keys.length>part.keys.length){
                    part.keys=scaleKeys(targetPartObj.keys);
                }else{
                    part.keys=scaleKeys(part.keys);
                }
            }
        }
        next.plan=validateMotionPlan(mergedPlan);
    }else{
        // `validTarget` is a newly recorded or AI-refined plan; overlay manual controls/limb tracks from `draft.plan`.
        const mergedPlan=copy(validTarget);
        if(preserveManual){
            if(manualSet.has(cameraControlKey)){
                mergedPlan.camera=draft.plan.camera.map(key=>({...copy(key),t:scaleTime(key.t)}));
            }
            for(const obj of mergedPlan.objects){
                const draftObj=draft.plan.objects.find(o=>o.id===obj.id);
                if(!draftObj)continue;
                const objKey=controlKey({objectId:obj.id});
                if(manualSet.has(objKey)&&objKey!==controlledRootKey){
                    obj.keys=scaleKeys(draftObj.keys);
                }
                for(const part of obj.parts||[]){
                    const draftPart=draftObj.parts?.find(p=>p.id===part.id);
                    if(!draftPart)continue;
                    const partKey=controlKey({objectId:obj.id,partId:part.id});
                    if(manualSet.has(partKey)){
                        part.keys=scaleKeys(draftPart.keys);
                    }
                }
            }
        }
        next.plan=validateMotionPlan(mergedPlan);
    }

    const hasTarget=(t:PoseTarget)=>{
        const o=next.plan.objects.find(item=>item.id===t.objectId);
        return t.partId?Boolean(o?.parts?.some(p=>p.id===t.partId)):Boolean(o);
    };
    next.manualControls=(next.manualControls||[]).filter(key=>{
        if(key===cameraControlKey)return true;
        try{const [objectId,partId]=JSON.parse(key);return hasTarget({objectId,partId:partId||undefined});}catch{return false;}
    });
    next.masks=(next.masks||[]).filter(m=>hasTarget(m)).map(m=>({...copy(m),start:scaleTime(m.start),end:Math.max(scaleTime(m.start),scaleTime(m.end))}));
    next.locks=(next.locks||[]).filter(l=>hasTarget(l)).map(l=>({...copy(l),time:scaleTime(l.time),...(l.end!==undefined?{end:Math.max(scaleTime(l.time),scaleTime(l.end))}:{})}));
    for(const lock of next.locks){
        const part=targetPart(next.plan,lock);
        const startEnd=lock.end!==undefined&&lock.end>lock.time?lock.end:lock.time;
        const startSample=samplePose(part,lock.time);
        for(const ch of lock.channels)startSample[ch]=copy(lock.pose[ch]);
        part.keys=setKey(part.keys,{...startSample,t:lock.time},false,newDuration);
        if(startEnd>lock.time){
            const endSample=samplePose(part,startEnd);
            for(const ch of lock.channels)endSample[ch]=copy(lock.pose[ch]);
            part.keys=setKey(part.keys,{...endSample,t:startEnd},false,newDuration);
            for(const k of part.keys){
                if(k.t>=lock.time-1e-6&&k.t<=startEnd+1e-6){
                    for(const ch of lock.channels)k[ch]=copy(lock.pose[ch]);
                }
            }
        }
    }
    next.events=(next.events||[]).filter(e=>hasTarget({objectId:e.objectId})&&(e.kind!=='attach'||hasTarget(e.parent))).map(e=>({
        ...copy(e),
        time:scaleTime(e.time),
        ...(e.stateCue ? { stateCue: { ...retimePostureCue(e.stateCue, scaleTime), ...(e.stateCue.generated ? { generated: e.stateCue.generated.filter(key => hasTarget({ objectId: e.objectId, partId: key.partId })).map(key => ({ ...key, t: scaleTime(key.t) })) } : {}) } } : {}),
        ...(e.kind==='detach'&&e.landing?{landing:{...copy(e.landing),time:Math.max(scaleTime(e.time)+0.05,scaleTime(e.landing.time))}}:{})
    })).filter(e=>e.kind!=='detach'||!e.landing||e.landing.time<=newDuration+1e-6);
    next.moves=(next.moves||[]).filter(m=>hasTarget({objectId:m.objectId})).map(m=>{
        const start=scaleTime(m.start);
        const dur=Math.min(m.duration,Math.max(0.05,newDuration-start));
        return {...copy(m),start,duration:dur};
    }).filter(m=>m.start+m.duration<=newDuration+1e-6);
    next.locomotion=(next.locomotion||[]).filter(id=>Object.hasOwn(next.rigs,id)&&hasTarget({objectId:id}));
    next.plan=validateMotionPlan(next.plan);
    return next;
}

/** Rich takes keep performance seconds. Finish stops input collection and holds
 * the recorded path for the remaining movement envelope; authored future
 * triggers/contacts keep their original times. Legacy stick-only takes still
 * use finishMovementTiming in the viewport. */
export function finishAuthoringCapturePlan(recording: MotionPlan, elapsed: number): MotionPlan {
    timeInside(elapsed,recording.duration);
    const finished=copy(recording);
    const hold=<T extends {t:number}>(keys:T[]):T[]=>{
        const captured=keys.filter(key=>key.t<=elapsed).map(key=>copy(key));
        if(!captured.length)throw new Error('The performance has no captured source pose.');
        const last=captured[captured.length-1];
        if(last.t<elapsed)captured.push({...copy(last),t:elapsed});
        if(captured[captured.length-1].t<finished.duration)captured.push({...copy(last),t:finished.duration});
        return captured;
    };
    for(const object of finished.objects){
        object.keys=hold(object.keys);
        for(const part of object.parts||[])part.keys=hold(part.keys);
    }
    finished.camera=hold(finished.camera);
    return validateMotionPlan(finished);
}

export class AuthoringHistory {
    private previous: SceneAuthoringDraft[]=[]; private following: SceneAuthoringDraft[]=[];
    constructor(public current: SceneAuthoringDraft){this.current=copy(current);}
    get canUndo(){return this.previous.length>0;}
    get canRedo(){return this.following.length>0;}
    commit(commands:AuthoringCommand[],expectedRevision=this.current.revision){const next=applyAuthoringCommands(this.current,expectedRevision,commands);this.previous.push(this.current);this.following=[];this.current=next;return copy(next);}
    adopt(next:SceneAuthoringDraft){if(next.revision!==this.current.revision){this.previous.push(this.current);this.following=[];}this.current=copy(next);return copy(this.current);}
    undo(){const next=this.previous.pop();if(next){this.following.push(this.current);this.current={...copy(next),revision:this.current.revision+1};}return copy(this.current);}
    redo(){const next=this.following.pop();if(next){this.previous.push(this.current);this.current={...copy(next),revision:this.current.revision+1};}return copy(this.current);}
}

export function applyAuthoringRefinement(draft:SceneAuthoringDraft,captured:Pick<SceneAuthoringDraft,'draftId'|'sourceKey'|'revision'>,commands:AuthoringCommand[]){
    if(draft.draftId!==captured.draftId||draft.sourceKey!==captured.sourceKey)throw new Error('This refinement belongs to another authoring draft.');
    return applyAuthoringCommands(draft,captured.revision,commands);
}

/** Clock is independent of joystick/root movement. Rehearsal never advances it. */
export class PerformanceClock {
    time=0; recording=false;
    constructor(public duration:number){if(!finite(duration)||duration<=0)throw new Error('Invalid take duration.');}
    start(time=0){timeInside(time,this.duration);this.time=time;this.recording=time<this.duration;}
    pause(){this.recording=false;}
    advance(seconds:number){if(!finite(seconds)||seconds<0)throw new Error('Invalid clock step.');if(this.recording){this.time=Math.min(this.duration,this.time+seconds);if(this.time===this.duration)this.recording=false;}return this.time;}
}

/** Export callers render these frames with the same evaluator as the workspace. */
export function evaluateAuthoringFrames(draft:SceneAuthoringDraft,fps=30){
    if(!Number.isInteger(fps)||fps<1||fps>120)throw new Error('Invalid export frame rate.');
    const count=Math.round(draft.plan.duration*fps);
    return Array.from({length:count},(_,i)=>({timestamp:i/fps,frame:evaluateAuthoringDraft(draft,i===count-1?draft.plan.duration:i/fps).plan}));
}

export function serializeAuthoringDraft(draft:SceneAuthoringDraft){return JSON.stringify(draft);}
export function restoreAuthoringDraft(json:string):SceneAuthoringDraft{
    const draft=JSON.parse(json) as SceneAuthoringDraft;
    if(draft?.schema!=='clikb.scene-authoring.v1'||typeof draft.draftId!=='string'||!draft.draftId||typeof draft.sourceKey!=='string'||!Number.isSafeInteger(draft.revision)||draft.revision<0||!Array.isArray(draft.events)||!Array.isArray(draft.moves)||!Array.isArray(draft.locks)||!Array.isArray(draft.locomotion)||!Array.isArray(draft.manualControls)||(draft.masks!==undefined&&!Array.isArray(draft.masks))||!draft.rigs||!draft.sourceState?.objects||!Array.isArray(draft.sourceState.relationships))throw new Error('Invalid authoring document.');
    draft.plan=validateMotionPlan(draft.plan);
    draft.masks=(draft.masks||[]).map(mask=>{
        timeInside(mask.start,draft.plan.duration);timeInside(mask.end,draft.plan.duration);
        if(mask.end<mask.start||!Array.isArray(mask.channels)||mask.channels.some(ch=>!['position','rotation','scale'].includes(ch)))throw new Error('Invalid manual mask.');
        targetPart(draft.plan,mask);
        return copy(mask);
    });
    // Reapply through the same validation boundary without changing the source revision.
    const events=draft.events,moves=draft.moves;draft.events=[];draft.moves=[];
    const valid=applyAuthoringCommands(draft,draft.revision,[...events.map(event=>({kind:'event' as const,event})),...moves.map(move=>({kind:'move' as const,move,at:move.start,exact:true}))]);
    valid.revision=draft.revision;return valid;
}

export const prototypeUnitPose=(position:MotionVec3=[0,0,0]):MotionKey=>({t:0,position,rotation:[0,0,0],scale:[...unit]});
