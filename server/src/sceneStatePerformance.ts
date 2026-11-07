import { samplePose, type AuthoringCommand, type SceneAuthoringDraft, type GeneratedPostureKey } from './sceneAuthoring';
import { bipedPosture } from './scenePosture';

export type SceneStateCue = { objectId: string; time: number; posture: 'standing' | 'kneeling' | 'seated'; until?: number };

/** Explicit supported state cues compile to physical local keys. Freeform facts
 * never trigger a guessed pose or gait, and existing custom rigs remain intact. */
export function compileSceneStateCues(draft: SceneAuthoringDraft, cues: SceneStateCue[]): AuthoringCommand[] {
    if (!Array.isArray(cues) || cues.length > 512) throw new Error('Invalid state timeline.');
    const commands: AuthoringCommand[] = [];
    const affected = new Set(cues.map(cue => cue.objectId));
    const saved = draft.events.flatMap(event => affected.has(event.objectId) && event.stateCue
        ? [{ objectId: event.objectId, time: event.time, ...event.stateCue }] : []);
    // Later story-time cues supersede earlier holds regardless of JSON order.
    // At equal times, the last supplied cue wins.
    const ordered = [...saved, ...cues].map((cue, index) => ({ cue, index })).sort((a, b) => a.cue.time - b.cue.time || a.index - b.index)
        .filter((entry, index, all) => !all.slice(index + 1).some(next => next.cue.objectId === entry.cue.objectId && next.cue.time === entry.cue.time)).map(entry => entry.cue);
    for (let index = 0; index < ordered.length; index++) {
        const cue = ordered[index];
        const rig = draft.rigs[cue.objectId], object = draft.plan.objects.find(item => item.id === cue.objectId);
        if (!object || rig?.kind !== 'biped' || !rig.controls.pelvis || !rig.hipHeight) throw new Error('Posture cues require a mapped biped pelvis and leg controls; use explicit local pose keys for other anatomy.');
        if (!['standing', 'kneeling', 'seated'].includes(cue.posture)) throw new Error('Unsupported posture; author explicit local keys.');
        if (!Number.isFinite(cue.time) || cue.time < 0 || cue.time > draft.plan.duration || cue.until !== undefined && (!Number.isFinite(cue.until) || cue.until < cue.time || cue.until > draft.plan.duration)) throw new Error('State cue is outside this timeline.');
        const scale = rig.hipHeight / .91;
        const posture = bipedPosture(cue.posture), controls = posture.rotations;
        const nextCue = ordered.slice(index + 1).find(next => next.objectId === cue.objectId);
        const end = Math.min(cue.until ?? draft.plan.duration, nextCue?.time ?? draft.plan.duration);
        const previous = saved.find(old => old.objectId === cue.objectId && old.time === cue.time);
        const replay = previous?.posture === cue.posture && previous.until === (cue.until ?? draft.plan.duration);
        const generated: GeneratedPostureKey[] = [];
        for (const control of ['pelvis', ...Object.keys(controls)]) {
            const partId = rig.controls[control], part = object.parts?.find(item => item.id === partId);
            if (!part) throw new Error(`Missing posture control: ${control}`);
            // Replace only the channels owned by the posture, at existing
            // interior key times too. Other axes and custom controls survive.
            // A prior construction pass may already have emitted the old hold's
            // tail. Supersede those generated values, not later custom motion.
            const channel = control === 'pelvis' ? 'position' : 'rotation', axis = control === 'pelvis' ? 1 : 0;
            const owned = (old: typeof saved[number], time: number) => {
                const key = part.keys.find(key => Math.abs(key.t - time) < 1e-6);
                if (!key) return false;
                const record = old.generated?.find(item => item.partId === partId && Math.abs(item.t - time) < 1e-6 && item.channel === channel && item.axis === axis);
                if (old.generated && !record) return false;
                const oldPose = bipedPosture(old.posture);
                const expected = record?.value ?? (control === 'pelvis' ? oldPose.pelvisHeight * scale : oldPose.rotations[control]);
                return Math.abs(key[channel][axis] - expected) < 1e-9;
            };
            const superseded = [...saved, ...cues].filter(old => old.objectId === cue.objectId && old.time < cue.time && (old.until ?? draft.plan.duration) > cue.time);
            const staleTimes = part.keys.filter(key => key.t > end && key.t < (nextCue?.time ?? Infinity) && superseded.some(old => {
                if (key.t > (old.until ?? draft.plan.duration)) return false;
                const recorded = saved.find(item => item.objectId === old.objectId && item.time === old.time);
                return owned(recorded || { ...old, until: old.until ?? draft.plan.duration }, key.t);
            })).map(key => key.t);
            const times = [...new Set([cue.time, end, ...staleTimes, ...part.keys.filter(key => key.t > cue.time && key.t < end).map(key => key.t)])].sort((a, b) => a - b);
            for (const time of times) {
                // A generic hold owns only the scalar keys it actually wrote.
                // Explicit later choreography (even on the same joint) survives
                // a sparse continuation that merely replays the old cue.
                if (replay && previous && !owned(previous, time)) continue;
                const pose = samplePose(part, time);
                if (control === 'pelvis') pose.position[1] = posture.pelvisHeight * scale;
                else pose.rotation[0] = controls[control];
                commands.push({ kind: 'pose', target: { objectId: object.id, partId }, time, pose, channels: [control === 'pelvis' ? 'position' : 'rotation'], generatedPosture: true });
                generated.push({ partId, t: time, channel, axis, value: pose[channel][axis] });
            }
        }
        commands.push({ kind: 'event', event: { id: `posture:${cue.objectId}:${cue.time}`, kind: 'facts', time: cue.time, objectId: cue.objectId, facts: { posture: cue.posture }, stateCue: { posture: cue.posture, until: cue.until ?? draft.plan.duration, generated } } });
    }
    return commands;
}
