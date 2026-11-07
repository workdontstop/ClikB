import { restoreAuthoringDraft, evaluateAuthoringDraft, type SceneAuthoringDraft } from './sceneAuthoring';
import { validateMotionPlan, type MotionPlan } from './motionGuidePlan';
import { LIGHTING_PRESETS } from './sceneCamera';

/** Optional capable source carried by existing animatics/guides. No jobs or UI state. */
export type ScenePerformanceSource = { plan: MotionPlan; authoring?: SceneAuthoringDraft };
const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable((value as Record<string, unknown>)[key])])) : value;
export const canonicalAuthoringText = (value: unknown) => JSON.stringify(stable(value));

function finiteJson(value: unknown, depth = 0): void {
    if (depth > 48) throw new Error('Authoring document is too deeply nested.');
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Authoring values must be finite.');
    if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
        if (['__proto__','constructor','prototype'].includes(key)) throw new Error('Invalid authoring field.');
        finiteJson(child, depth + 1);
    }
}

/** Validate on entry, never per render frame. Existing scene byte limit also applies. */
export function validateScenePerformance(source: ScenePerformanceSource): ScenePerformanceSource {
    const plan = validateMotionPlan(source.plan);
    if (!source.authoring) return { plan };
    const raw = source.authoring;
    finiteJson(raw);
    if (new TextEncoder().encode(JSON.stringify(raw)).length > 2_000_000) throw new Error('Authoring performance exceeds its payload budget.');
    const allowed = ['schema','draftId','sourceKey','revision','plan','sourceState','events','rigs','locomotion','moves','manualControls','masks','locks','cameraRig','lightingRig'];
    if (Object.keys(raw).some(key => !allowed.includes(key))) throw new Error('Unsupported authoring field.');
    if (raw.schema !== 'clikb.scene-authoring.v1') throw new Error('Unsupported authoring version; use an explicit adapter.');
    if (raw.sourceKey.length > 2000 || raw.draftId.length > 200) throw new Error('Invalid authoring identity.');
    if ([raw.events,raw.moves,raw.locks,raw.manualControls,raw.masks || []].some(items => !Array.isArray(items) || items.length > 512)) throw new Error('Authoring track/event limit exceeded.');
    if(raw.lightingRig!==undefined){
        const light=raw.lightingRig;
        if(!light||!LIGHTING_PRESETS.includes(light.preset)
            ||!Number.isFinite(light.azimuthDeg)||light.azimuthDeg < -180||light.azimuthDeg > 180
            ||!Number.isFinite(light.elevationDeg)||light.elevationDeg < 0||light.elevationDeg > 90
            ||!Number.isFinite(light.intensity)||light.intensity < 0||light.intensity > 5)
            throw new Error('Invalid authoring lighting rig.');
    }
    for (const [id,rig] of Object.entries(raw.rigs || {})) {
        const object = plan.objects.find(item => item.id === id);
        if (!object || !['biped','quadruped','wheeled','rotor'].includes(rig.kind) || !Number.isFinite(rig.strideLength) || rig.strideLength <= 0
            || !rig.controls || Object.values(rig.controls).some(part => !object.parts?.some(item => item.id === part))) throw new Error('Invalid rig binding.');
    }
    const authoring = restoreAuthoringDraft(JSON.stringify(raw));
    if (canonicalAuthoringText(authoring.plan) !== canonicalAuthoringText(plan)) throw new Error('Authoring and legacy source plans disagree.');
    for (const object of plan.objects) if (!authoring.sourceState.objects[object.id]) throw new Error('Authoring source state is missing an entity.');
    return { plan, authoring };
}

/** The immutable validated source supplies every frame and its semantic endpoint. */
export function evaluateScenePerformance(source: ScenePerformanceSource, time: number): MotionPlan {
    return source.authoring ? evaluateAuthoringDraft(source.authoring, time).plan : source.plan;
}

/** Preserve byte-for-byte legacy hash input. New envelopes use canonical content. */
export function scenePerformanceText(plan: MotionPlan, aspectRatio: string, authoring?: SceneAuthoringDraft): string {
    if (!authoring) return JSON.stringify({ plan, aspectRatio });
    const { draftId: _id, sourceKey: _source, revision: _revision, ...content } = authoring;
    return canonicalAuthoringText({ plan, aspectRatio, evaluator: 'clikb.scene-authoring.v1', authoring: content });
}

export function performanceSelection(source: ScenePerformanceSource) {
    const rigs = source.authoring?.rigs || {};
    return source.plan.objects.flatMap(object => {
        const rig = rigs[object.id];
        const capabilities = rig
            ? [rig.kind, 'locomotion', ...(rig.kind === 'biped' || rig.kind === 'quadruped' ? ['ik', 'stunts', 'hold', 'mount'] : ['carrier', 'mount'])] as const
            : object.role === 'scenery' || object.id === 'ground' ? ['ground'] as const : ['transform', 'attachable'] as const;
        return [
            { objectId: object.id, channels: ['position','rotation','scale'] as const, kind: 'entity' as const, rigKind: rig?.kind, capabilities },
            ...(object.parts || []).map(part => {
                const controlName = rig ? Object.entries(rig.controls).find(([, id]) => id === part.id)?.[0] : undefined;
                return { objectId: object.id, partId: part.id, channels: ['position','rotation','scale'] as const, kind: 'part' as const, controlName, ikTarget: controlName === 'left_ankle' || controlName === 'right_ankle' };
            }),
        ];
    });
}
