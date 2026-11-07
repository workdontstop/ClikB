import { validateMotionPlan, type MotionPlan, type MotionPart, type MotionObject, type MotionKey, type MotionVec3 } from './motionGuidePlan';
import type { SpatialMotionEvidence } from './spatialMotionEvidence';
import type { AudioReference } from './audioReference';
import type { SceneAuthoringDraft } from './sceneAuthoring';
import { evaluateAuthoringDraft } from './sceneAuthoring';
import { validateScenePerformance } from './scenePerformance';

export type PlanningTier = 'luna' | 'terra' | 'sol' | 'deepseek' | 'kimi';
export type SpatialAssetReference = { name: string; imageUrl: string; description?: string };
export function spatialAssetReferences(value: unknown): SpatialAssetReference[] {
    if (!Array.isArray(value)) return [];
    return value.filter(item => item && typeof item.name === 'string' && item.name.trim() && typeof item.imageUrl === 'string' && /^https:\/\//i.test(item.imageUrl))
        .map(item => ({ name: item.name.trim(), imageUrl: item.imageUrl, description: typeof item.description === 'string' ? item.description : undefined }));
}
export type WorldFacts = Record<string, unknown>;
type WorldGeometry = Omit<MotionObject, 'id' | 'keys' | 'parts'> & { parts?: Array<Omit<MotionPart, 'keys'>> };
const geometryOf = ({ id: _id, keys: _keys, parts, ...object }: MotionObject): WorldGeometry => ({
    ...object, ...(parts ? { parts: parts.map(({ keys: _track, ...part }) => part) } : {}),
});
export type WorldState = {
    controlledObject?: string;
    controlMode?: SpatialWorld['controlMode'];
    locomotion?: SpatialWorld['locomotion'];
    objects: Record<string, { transform: MotionKey; geometry?: WorldGeometry; parts?: Record<string, MotionKey>; facts: WorldFacts; assets: string[] }>;
    relationships: Array<{ from: string; to: string; relation: string; facts?: WorldFacts }>;
    conditions: WorldFacts;
    camera: MotionPlan['camera'][number];
};
export type SpatialWorld = {
    authoring?: SceneAuthoringDraft;
    locomotion?: { kind: 'ground' | 'air' | 'water' | 'vehicle'; vertical: boolean; speed: number; turnRate: number };
    sceneContext?: { imagePrompt: string; sceneIntent: string; videoPrompt: string };
    sourceLayout?: { camera: string; landmarks: Array<{ id: string; description: string; box: [number, number, number, number]; occluded: boolean }> };
    references?: SpatialAssetReference[];
    drivenName?: string;
    /** Persistent story identity; drivenName/controlledObject may name its local carrier. */
    primarySubjectName?: string;
    controlSelectionRequired?: boolean;
    navigationNeedsReview?: boolean;
    calibrationNotes?: string[];
    reviewRejected?: boolean;
    version: 2;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    revision: string;
    sourceImage: string;
    prompt: string;
    model: PlanningTier;
    plan: MotionPlan;
    controlledObject: string;
    controlMode: 'character' | 'vehicle' | 'mounted' | 'pov' | 'other';
    motionStyle: string;
    walkable: { min: MotionVec3; max: MotionVec3 }[];
    obstacles: { min: MotionVec3; max: MotionVec3 }[];
    initialState: WorldState;
    approved: boolean;
};
export type SpatialAnimatic = {
    authoring?: SceneAuthoringDraft;
    audioReferenceHistory?: AudioReference[];
    audioReference?: AudioReference;
    motionEvidence?: SpatialMotionEvidence;
    guidance?: SpatialJob['guidance'];
    creatorInstruction?: string;
    promptVersion?: number;
    reviewNotes?: string[];
    references?: SpatialAssetReference[];
    id: string;
    prompt: string;
    plan: MotionPlan;
    sourceState: WorldState;
    endState: WorldState;
    stateChanges: WorldFacts;
    referenceVideo?: string;
    referencePlanKey?: string;
    startAnchor?: string;
    endAnchor?: string;
    model: PlanningTier;
    createdAt: number;
};
export type SpatialRoute = {
    connectionId: string;
    worldRevision: string;
    forward: SpatialAnimatic;
    backward?: SpatialAnimatic;
};
export type SpatialJobStatus = 'waiting-on-parent' | 'queued' | 'preparing' | 'submitting' | 'generating' | 'checking' | 'ready' | 'failed' | 'blocked' | 'cancelled';
export type SpatialUpscale = { status: 'submitting' | 'generating' | 'ready' | 'failed'; pixels: number; output?: string; original: string; error?: string; submissionToken?: string; providerJobId?: string; endpoint?: string; resolution?: '1080p' | '2k'; duration?: number; variant?: 'Standard'; videoType?: 'AIGC'; targetFps?: 60 };
export const spatialUpscaleIsActive = (job: { upscale?: { status: string } }): boolean => Boolean(job.upscale && ['submitting', 'generating'].includes(job.upscale.status));
export const spatialReadyUpscales = (job: { upscale?: SpatialUpscale; upscaleHistory?: SpatialUpscale[] }): SpatialUpscale[] =>
    [...(job.upscale ? [job.upscale] : []), ...(job.upscaleHistory || []).slice().reverse()].filter(item => item.status === 'ready' && item.output);
export const spatialUpscaleSource = (job: { output?: string; upscale?: SpatialUpscale; upscaleHistory?: SpatialUpscale[] }): string | undefined => spatialReadyUpscales(job)[0]?.output || job.output;
export const spatialJobIsActive = (job: { status: SpatialJobStatus; completionError?: string; upscale?: { status: string } }): boolean =>
    (['queued', 'preparing', 'submitting', 'generating', 'checking'].includes(job.status) && !(job.status === 'checking' && job.completionError))
    || Boolean(job.upscale && ['submitting', 'generating'].includes(job.upscale.status));
export type SpatialJob = {
    audioReferenceHistory?: AudioReference[];
    audioReference?: AudioReference;
    sceneContext?: SpatialWorld['sceneContext'];
    motionEvidence?: SpatialMotionEvidence;
    creatorInstruction?: string;
    preparationStartedAt?: number;
    guidance?: { key: string; instruction: string; interpretation?: { startRelation: string; route: string; endRelation: string; controlledMovement: string; secondaryMotion: string; spatialPlan: unknown }; motionContext: { controlledSubject: string; controlMode: string; primaryMotion: string; ambientMotion: string } };
    resultHistory?: Array<{ output: string; actualEndFrame?: string; prompt: string; model?: string; pixels?: number; options?: SpatialJob['options']; upscale?: SpatialUpscale; upscaleHistory?: SpatialUpscale[] }>;
    options?: { model: string; resolution: string; aspect: string; audio: boolean; music?: boolean };
    promptVersion?: number;
    kind?: 'movement' | 'action';
    previousResult?: { output: string; actualEndFrame?: string; prompt: string; model?: string; pixels?: number; options?: SpatialJob['options']; continuity?: 'needs-review' | 'approved'; upscale?: SpatialJob['upscale']; upscaleHistory?: SpatialUpscale[]; nodeContext?: NonNullable<SpatialLedger['nodeContexts']>[string]; completionAssets?: SpatialJob['completionAssets']; completionError?: string };
    references?: SpatialAssetReference[];
    upscale?: SpatialUpscale;
    upscaleHistory?: SpatialUpscale[];
    id: string;
    connectionId: string;
    direction: 'forward' | 'backward';
    sourceNodeId: string;
    targetNodeId: string;
    dependsOn: string[];
    status: SpatialJobStatus;
    prompt: string;
    referenceVideo: string;
    startAnchor: string;
    endAnchor: string;
    duration: number;
    model: string;
    pixels: number;
    attempt: number;
    provider?: string;
    providerJobId?: string;
    submissionToken?: string;
    submissionStartedAt?: number;
    submissionUncertain?: boolean;
    endpoint?: string;
    output?: string;
    actualEndFrame?: string;
    /** Uploaded assets survive a failed state refresh and editor/page reload. */
    completionAssets?: { videoUrl: string; endFrame: string; attempt: number; sourceOutput: string };
    completionError?: string;
    error?: string;
    continuity?: 'needs-review' | 'approved';
};
export type SpatialLedger = {
    actionAudioReferenceHistory?: AudioReference[];
    actionAudioReferences?: Record<string, AudioReference>;
    nodeContexts?: Record<string, { key: string; frameUrl: string; motionContext: NonNullable<SpatialJob['guidance']>['motionContext'] }>;
    actionImageEdits?: Record<string, { id: string; status: 'submitting' | 'ready' | 'failed' | 'applied'; startedAt?: number; prompt: string; original: string; output?: string; pixels: number; error?: string }>;
    draft?: { plan: MotionPlan; authoring?: SceneAuthoringDraft; samples: Array<{ x: number; y: number; radius: number; angle: number; elapsedMs: number }>; kind: 'movement' | 'action'; prompt: string; generatedPrompt?: string; hold: boolean; sourceNodeId: string; forward?: SpatialAnimatic; backward?: SpatialAnimatic };
    version: 2;
    world: SpatialWorld;
    routes: Record<string, SpatialRoute>;
    states: Record<string, WorldState>;
    jobs: SpatialJob[];
    epoch: number;
    generationStarted: boolean;
    view: 'three' | 'video';
    boardOpen: boolean;
};

export const planningTiers: PlanningTier[] = ['luna', 'terra', 'sol', 'deepseek', 'kimi'];
export const isPlanningTier = (value: unknown): value is PlanningTier => planningTiers.includes(value as PlanningTier);
export function cloneWorld<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }
/** Replacements must not orphan paid descendants or an in-flight upscale. */
export function spatialRegenerationBlocker(jobs: SpatialJob[], job: SpatialJob): string | undefined {
    if (job.previousResult && job.status !== 'ready') return 'Wait for this replacement to finish, or keep the previous result.';
    if (job.upscale && ['submitting', 'generating'].includes(job.upscale.status)) return 'Wait for this clip’s existing upscale to finish.';
    const descendants = new Set([job.id]);
    for (let pass = 0; pass < jobs.length; pass++) for (const item of jobs) if (item.dependsOn.some(id => descendants.has(id))) descendants.add(item.id);
    if (jobs.some(item => item.id !== job.id && descendants.has(item.id) && (item.submissionUncertain || ['preparing', 'submitting', 'generating', 'checking'].includes(item.status)))) return 'Wait for dependent clips to finish before replacing this video.';
}
export const authoringLocked = (ledger?: SpatialLedger): boolean => Boolean(ledger && (ledger.generationStarted || ledger.jobs.some(job => job.output)));
export const baseWorldEditable = (ledger: SpatialLedger, connectionCount: number): boolean => !authoringLocked(ledger) && connectionCount === 0;
export const newWorldState = (plan: MotionPlan): WorldState => ({
    objects: Object.fromEntries(plan.objects.map(object => [object.id, { transform: cloneWorld(object.keys[0]), geometry: geometryOf(object), ...(object.parts ? { parts: Object.fromEntries(object.parts.map(part => [part.id, cloneWorld(part.keys[0])])) } : {}), facts: {}, assets: [] }])),
    relationships: [], conditions: {}, camera: cloneWorld(plan.camera[0]),
});

/** Prefer the explicitly named reference; otherwise retain a valid model binding.
 * Never treat the first arbitrary root as a confirmed character selection. */
export function selectedWorldControl(plan: MotionPlan, drivenName: unknown, references: unknown, controlledObject: unknown): { controlledObject?: string; confirmed: boolean } {
    const normalize = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const name = typeof drivenName === 'string' ? normalize(drivenName) : '';
    const named = name ? plan.objects.filter(object => normalize(object.id) === name || normalize(object.identity || '') === name || object.parts?.some(part => normalize(part.identity || '') === name)) : [];
    const claimed = plan.objects.find(object => object.id === controlledObject)?.id;
    let selected = named.length === 1 ? named[0].id : claimed;
    const visited = new Set<string>();
    while (selected && !visited.has(selected)) {
        visited.add(selected);
        const parent = plan.objects.find(object => object.id === selected)?.attachment?.objectId;
        if (!parent) break;
        selected = parent;
    }
    const hasImages = spatialAssetReferences(references).length > 0;
    const camera = name === 'camerapointofview';
    return { controlledObject: selected, confirmed: Boolean(selected && (hasImages || camera)) };
}
export function stateAtEnd(plan: MotionPlan, previous: WorldState): WorldState {
    const state = cloneWorld(previous);
    for (const object of plan.objects) state.objects[object.id] = { ...(state.objects[object.id] || { facts: {}, assets: [] }), transform: cloneWorld(object.keys.at(-1)!), geometry: geometryOf(object), parts: object.parts ? Object.fromEntries(object.parts.map(part => [part.id, cloneWorld(part.keys.at(-1)!)])) : undefined };
    state.camera = cloneWorld(plan.camera.at(-1)!);
    return state;
}
/** Actual state follows ancestors until the next action requires its own frame. */
export function spatialStateContextAt(scene: { connections: Array<{ kind?: string; sourceNodeId: string; targetNodeId: string }>; ledger: Pick<SpatialLedger, 'nodeContexts'> }, nodeId: string): NonNullable<SpatialLedger['nodeContexts']>[string] | undefined {
    const visited = new Set<string>();
    while (!visited.has(nodeId)) {
        visited.add(nodeId);
        const context = scene.ledger.nodeContexts?.[nodeId]; if (context) return context;
        const incoming = scene.connections.find(edge => edge.targetNodeId === nodeId);
        if (!incoming || incoming.kind === 'action') return undefined;
        nodeId = incoming.sourceNodeId;
    }
}
export function planAtState(world: SpatialWorld, state: WorldState, duration = 5): MotionPlan {
    const plan = cloneWorld(world.plan);
    plan.duration = duration;
    const ids = [...new Set([...plan.objects.map(object => object.id), ...Object.keys(state.objects)])];
    plan.objects = ids.flatMap(id => {
        const base = world.plan.objects.find(object => object.id === id), pose = state.objects[id];
        const geometry = pose?.geometry || base;
        if (!geometry || !pose && !base) return [];
        const { parts: _parts, ...rootGeometry } = geometry;
        const parts = geometry.parts?.map(part => {
            const local = pose?.parts?.[part.id] || base?.parts?.find(candidate => candidate.id === part.id)?.keys[0];
            if (!local) throw new Error(`The saved pose for ${id}/${part.id} is missing.`);
            return { ...part, keys: [0, duration].map(t => ({ ...local, t })) };
        });
        return [{ ...rootGeometry, id,
            keys: [0, duration].map(t => ({ ...(pose?.transform || base!.keys[0]), t })),
            ...(parts?.length ? { parts } : {}),
        }];
    });
    plan.camera = [0, duration].map(t => ({ ...state.camera, t }));
    return plan;
}
/** Control follows the chosen identity through this node's saved hierarchy.
 * Mounting drives the outer unit; releasing a rider restores its own root. */
export function worldControlAtPlan(world: Pick<SpatialWorld, 'controlledObject' | 'drivenName' | 'primarySubjectName' | 'references'> & { plan?: MotionPlan; controlMode?: SpatialWorld['controlMode'] }, plan: MotionPlan): string {
    const identityName = world.primarySubjectName || world.drivenName;
    const identityBinding = world.plan && selectedWorldControl(world.plan, identityName, world.references, undefined).controlledObject;
    // A later manual selection takes precedence over the original name.
    const followIdentity = !world.plan || identityBinding === world.controlledObject
        || Boolean(world.primarySubjectName && !identityBinding && ['vehicle', 'mounted'].includes(world.controlMode || '')
            && selectedWorldControl(plan, identityName, world.references, undefined).controlledObject);
    return selectedWorldControl(plan, followIdentity ? identityName : undefined, world.references, world.controlledObject).controlledObject || world.controlledObject;
}
export function worldAtState(world: SpatialWorld, state: WorldState): SpatialWorld {
    const plan = planAtState(world, state);
    const binding = state.controlledObject && plan.objects.some(object => object.id === state.controlledObject)
        ? { ...world, controlledObject: state.controlledObject, controlMode: state.controlMode && ['character', 'vehicle', 'mounted', 'pov', 'other'].includes(state.controlMode) ? state.controlMode : world.controlMode } : world;
    const selected = worldControlAtPlan(binding, plan);
    const oldActor = plan.objects.find(object => object.id === binding.controlledObject);
    const identityName = (world.primarySubjectName || world.drivenName || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const actor = identityName && plan.objects.find(object => [object.id, object.identity || ''].some(name => name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') === identityName));
    const controlMode = actor && actor.attachment && selected !== actor.id ? (state.locomotion?.kind === 'vehicle' ? 'vehicle' : 'mounted')
        : actor && selected === actor.id && (selected !== binding.controlledObject || world.plan.objects.some(object => object.id === actor.id ? object.attachment : object.parts?.some(part => part.identity && part.identity.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '') === identityName))) ? 'character'
        : oldActor?.attachment && selected !== binding.controlledObject ? 'mounted'
        : binding.controlMode === 'mounted' && selected !== binding.controlledObject ? 'character' : binding.controlMode;
    const changed = selected !== world.controlledObject;
    return { ...world, authoring: undefined, plan, controlledObject: selected, controlMode,
        locomotion: state.locomotion || (changed && controlMode === 'character' ? undefined : world.locomotion),
        initialState: changed ? cloneWorld(state) : world.initialState };
}
export function validateWorld(raw: any): SpatialWorld {
    if (!raw || raw.version !== 2 || !isPlanningTier(raw.model)) throw new Error('Invalid 3D world version or planning model.');
    const plan = validateMotionPlan(raw.plan);
    const authoring = raw.authoring ? validateScenePerformance({ plan, authoring: raw.authoring }).authoring : undefined;
    if (!plan.objects.some(object => object.id === raw.controlledObject)) throw new Error('Choose an existing controlled object.');
    if (!['character', 'vehicle', 'mounted', 'pov', 'other'].includes(raw.controlMode)) throw new Error('Invalid control mode.');
    // Old drafts have no record of whether the root was a model binding or an
    // arbitrary fallback. Only an exact named match can repair their flag safely.
    const selected = selectedWorldControl(plan, raw.drivenName, raw.references, undefined);
    // Also repairs saved scenes created by the old unconditional selection flag.
    const inferSelection = raw.controlSelectionRequired === true && selected.confirmed;
    const bounds = (items: any, required: boolean) => {
        if (!Array.isArray(items) || (required && !items.length)) throw new Error('Define bounded walkable geometry.');
        return items.map(item => {
            for (const field of ['min', 'max']) if (!Array.isArray(item[field]) || item[field].length !== 3 || item[field].some((n: any) => !Number.isFinite(n) || Math.abs(n) > 100)) throw new Error('Invalid world bounds.');
            if (item.min.some((n: number, i: number) => n > item.max[i])) throw new Error('Inverted world bounds.');
            return { min: item.min as MotionVec3, max: item.max as MotionVec3 };
        });
    };
    const initialState = authoring ? cloneWorld(evaluateAuthoringDraft(authoring, 0).state) : newWorldState(plan);
    const locomotion = raw.locomotion;
    if (locomotion && (!['ground', 'air', 'water', 'vehicle'].includes(locomotion.kind) || typeof locomotion.vertical !== 'boolean' ||
        typeof locomotion.speed !== 'number' || !Number.isFinite(locomotion.speed) || locomotion.speed < .1 || locomotion.speed > 10 ||
        typeof locomotion.turnRate !== 'number' || !Number.isFinite(locomotion.turnRate) || locomotion.turnRate < .1 || locomotion.turnRate > 6)) throw new Error('Invalid movement capabilities.');
    if (raw.initialState?.conditions && typeof raw.initialState.conditions === 'object') initialState.conditions = cloneWorld(raw.initialState.conditions);
    if (Array.isArray(raw.initialState?.relationships)) initialState.relationships = cloneWorld(raw.initialState.relationships);
    for (const id of Object.keys(initialState.objects)) {
        const supplied = raw.initialState?.objects?.[id];
        if (supplied?.facts && typeof supplied.facts === 'object') initialState.objects[id].facts = cloneWorld(supplied.facts);
        if (Array.isArray(supplied?.assets)) initialState.objects[id].assets = supplied.assets.filter((url: unknown) => typeof url === 'string');
    }
    return { version: 2, ...(authoring ? { authoring } : {}), ...(raw.sceneContext && typeof raw.sceneContext === 'object' ? { sceneContext: Object.fromEntries(['imagePrompt', 'sceneIntent', 'videoPrompt'].map(key => [key, typeof raw.sceneContext[key] === 'string' ? raw.sceneContext[key].slice(0, 6000) : ''])) as SpatialWorld['sceneContext'] } : {}), ...(raw.sourceLayout ? { sourceLayout: cloneWorld(raw.sourceLayout) } : {}), controlSelectionRequired: raw.controlSelectionRequired === true && !inferSelection, references: spatialAssetReferences(raw.references), drivenName: typeof raw.drivenName === 'string' ? raw.drivenName : undefined, aspectRatio: ['16:9', '9:16', '1:1'].includes(raw.aspectRatio) ? raw.aspectRatio : undefined, revision: String(raw.revision || ''), sourceImage: String(raw.sourceImage || ''), prompt: String(raw.prompt || ''), model: raw.model,
        ...(typeof raw.primarySubjectName === 'string' && raw.primarySubjectName.trim() ? { primarySubjectName: raw.primarySubjectName.trim().slice(0, 160) } : {}),
        plan, ...(Array.isArray(raw.calibrationNotes) ? { calibrationNotes: raw.calibrationNotes.filter((note: unknown) => typeof note === 'string').slice(0, 32) } : {}), ...(locomotion ? { locomotion: cloneWorld(locomotion) } : {}), controlledObject: inferSelection ? selected.controlledObject! : raw.controlledObject, controlMode: raw.controlMode, motionStyle: String(raw.motionStyle || 'walk'),
        walkable: bounds(raw.walkable, true), obstacles: bounds(raw.obstacles || [], false), initialState, approved: raw.approved === true && raw.reviewRejected !== true, navigationNeedsReview: raw.navigationNeedsReview === true, ...(raw.reviewRejected === true ? { reviewRejected: true } : {}) };
}

/** Swept short steps prevent crossing an obstacle between captured frames. */
export function moveInWorld(world: SpatialWorld, from: MotionVec3, dx: number, dz: number): MotionVec3 {
    let point: MotionVec3 = [...from];
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.05));
    const size = world.initialState.objects[world.controlledObject]?.transform.scale || [0.4, 1, 0.4];
    const radius = Math.max(0.1, Math.min(size[0], size[2]) / 2);
    for (let i = 0; i < steps; i++) {
        const next: MotionVec3 = [point[0] + dx / steps, point[1], point[2] + dz / steps];
        const inside = world.walkable.some(b => next[0] >= b.min[0] + radius && next[0] <= b.max[0] - radius && next[2] >= b.min[2] + radius && next[2] <= b.max[2] - radius);
        const collision = world.obstacles.some(b => next[0] + radius > b.min[0] && next[0] - radius < b.max[0] && next[2] + radius > b.min[2] && next[2] - radius < b.max[2]);
        if (!inside || collision) break;
        point = next;
    }
    return point;
}

/** Failed ancestors block only their descendants. A retry reopens that branch. */
export function spatialJobDependenciesReady(jobs: SpatialJob[], job: Pick<SpatialJob, 'dependsOn'>): boolean {
    return job.dependsOn.every(id => jobs.some(parent => parent.id === id && parent.status === 'ready' && Boolean(parent.actualEndFrame)));
}

/** Individual generation needs its opening result now. Generate all may queue
 * the whole chain; a forward/return pair still runs in order within one motion. */
export function spatialRouteGenerationBlocker(scene: { connections: Array<{ id: string; sourceNodeId: string; targetNodeId: string }>; ledger?: SpatialLedger }, routeId: string): string | undefined {
    const ledger = scene.ledger, connection = scene.connections.find(edge => edge.id === routeId), route = ledger?.routes[routeId];
    if (!ledger || !connection || !route) return 'This motion is unavailable.';
    const forwardId = `${routeId}:forward`;
    const forwardIncluded = Boolean(route.forward && !ledger.jobs.some(job => job.id === forwardId));
    const parent = scene.connections.find(edge => edge.targetNodeId === connection.sourceNodeId);
    for (const direction of ['forward', 'backward'] as const) {
        if (!route[direction] || ledger.jobs.some(job => job.id === `${routeId}:${direction}`)) continue;
        const dependencies = direction === 'backward' ? [forwardId] : parent ? [`${parent.id}:forward`] : [];
        if (direction === 'backward' && forwardIncluded) continue;
        if (!spatialJobDependenciesReady(ledger.jobs, { dependsOn: dependencies })) return 'Waiting for the previous video.';
    }
}

export function refreshJobDependencies(jobs: SpatialJob[]): SpatialJob[] {
    const next = cloneWorld(jobs);
    for (let pass = 0; pass < next.length; pass++) for (const job of next) {
        if (!['queued', 'waiting-on-parent', 'blocked'].includes(job.status)) continue;
        const parents = job.dependsOn.map(id => next.find(parent => parent.id === id));
        job.status = parents.some(parent => parent && ['failed', 'blocked', 'cancelled'].includes(parent.status)) ? 'blocked'
            : spatialJobDependenciesReady(next, job) ? 'queued' : 'waiting-on-parent';
    }
    return next;
}
