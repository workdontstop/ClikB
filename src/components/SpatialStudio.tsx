import SceneControlsToggle from './SceneControlsToggle';
import SceneActionPresets from './SceneActionPresets';
import { applySavedStagePreset } from '../applySavedStagePreset';
import { LiveSceneClient } from '../liveSceneClient';
import LiveSceneWorkspace from './LiveSceneWorkspace';
import { useScenePresetLibrary } from '../useScenePresetLibrary';
import ScenePresetLibraryControls from './ScenePresetLibraryControls';
import { useSyncExternalStore, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, LinearProgress, MenuItem, Switch, TextField, Tooltip, Typography } from '@mui/material';
import SwipeIcon from '@mui/icons-material/Swipe';
import SwipeVerticalIcon from '@mui/icons-material/SwipeVertical';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import CloseIcon from '@mui/icons-material/Close';
import TuneIcon from '@mui/icons-material/Tune';
import TimelineIcon from '@mui/icons-material/Timeline';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeIcon from '@mui/icons-material/Home';
import LinkIcon from '@mui/icons-material/Link';
import UndoIcon from '@mui/icons-material/Undo';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import VideocamIcon from '@mui/icons-material/Videocam';
import { matchMobile } from '../DetectDevice';
import { alpha } from '@mui/material/styles';
import PlanningModelSelector from './PlanningModelSelector';
import { planningModelSelection } from '../planningModelSelection';
import { SPATIAL_HELPER_PRICES as prices } from '../../server/src/spatialHelperPricing';
import SpatialTheme from './SpatialTheme';
import SpatialNotice from './SpatialNotice';
import AudioReferenceDialog from './AudioReferenceDialog';
import { validateAudioReference, type AudioReference } from '../../server/src/audioReference';
import SpatialGenerationBoard, { spatialJobRetryable } from './SpatialGenerationBoard';
import SpatialWorldViewport, { type SpatialWorldViewportHandle } from './SpatialWorldViewport';
import SpatialExperiencePlayer, { type SpatialPlayerHandle } from '../SpatialExperiencePlayer';
import SpatialNodeMap from './SpatialNodeMap';
import { createMotionRenderer, recordMotionGuide } from '../motionGuideRenderer';
import { validateMotionPlan, type MotionPlan } from '../motionGuide';
import { mergeLiveAuthoringPlan, adoptLiveAuthoringResult } from '../liveAuthoringPlan';
import { authoringLocked, baseWorldEditable, cloneWorld, planAtState, worldAtState, spatialStateContextAt, spatialJobIsActive, spatialRouteGenerationBlocker, validateWorld, type PlanningTier, type SpatialAnimatic, type SpatialJob } from '../../server/src/spatialWorld';
import { spatialAppearanceFrame } from '../spatialPlayerModel';
import { MAX_SPATIAL_CONNECTIONS_PER_SCENE, cutSpatialNodeThread, sameSpatialSceneLink, type SpatialSceneState, type SpatialSceneLinkOption, type SpatialMovementSample } from '../spatialStageModel';
import type { SpatialExperienceStage } from '../spatialExperience';
import { isSpatialVideoModel, spatialVideoModels, spatialVideoPixels } from '../../server/src/spatialVideoSpec';
import { effectiveSpatialClipPrompt } from '../../server/src/spatialClipPrompt';
import { spatialOperation, spatialSession, runSpatialAuthoring, updateSpatialAuthoring, spatialErrorMessage } from '../spatialWorldClient';
import { getVideoModelDisplayName } from '../videoModelCapabilities';
import { applyLlmBilling, applyPixelBillingHeaders } from '../llmBilling';
import { appAccentButtonSx } from '../appAccentStyles';
import { recordedMovementPreview } from '../spatialTiming';
import type { CreationRotationMode } from '../spatialCreationDrive';
import { captureSpatialMotionEvidence } from '../spatialMotionEvidence';
import { spatialReferencePreparation } from '../spatialReferencePreparation';
import { spatialSceneContinuity } from '../../server/src/spatialContinuity';
import SpatialUpscaleDialog, { type SpatialUpscaleQuote } from './SpatialUpscaleDialog';
import { AuthoringHistory, createAuthoringDraft, evaluateAuthoringDraft, mergeAuthoringPlan, prototypeUnitPose, type AuthoringCommand, type PoseTarget, type SceneAuthoringDraft } from '../../server/src/sceneAuthoring';
import { bindWorldRigs } from '../../server/src/sceneRig';
import { LENS_PRESETS_MM, LIGHTING_PRESETS, defaultLightingRigForPreset, describeSceneCamera, describeSceneLighting, type SceneCameraRig, type SceneLightingPreset } from '../../server/src/sceneCamera';
import { BUILTIN_MOTION_PRESETS, applyMotionPreset, extractMotionNodePreset, extractStagePreset, type MotionNodePreset, type StagePreset } from '../../server/src/scenePresets';

type Props = {
    allowAudioReferences?: boolean;
    references?: Array<{ name: string; imageUrl: string; description?: string }>;
    activeReferenceNames?: string[];
    imagePrompt?: string; sceneIntent?: string;
    onActionModeChange?: (active: boolean) => void;
    onVideoGenerationModeChange?: (active: boolean) => void;
    onBusyChange?: (busy: boolean) => void;
    onPlanningPriceChange?: (pixels: number) => void;
    actionSubmitRef?: { current: (() => Promise<void>) | null };
    onModelChange?: (model: string) => void;
    onResolutionChange?: (resolution: string) => void;
    identityCandidates?: SpatialSceneState[];
    scene: SpatialSceneState; stages: SpatialExperienceStage[]; postId: number; api: string; appColor: string; oppositeAppColor?: string; darkMode: boolean;
    prompt: string; duration?: number; model: string; resolution: string; aspect: '16:9' | '9:16' | '1:1'; audio: boolean;
    update: (updater: (scene: SpatialSceneState) => SpatialSceneState) => void;
    navigate: (position: { stageId: string; nodeId: string }) => boolean;
    uploadVideo: (blob: Blob) => Promise<string>; uploadFrame: (blob: Blob) => Promise<string>; extractEnd: (url: string) => Promise<Blob>;
    dispatch: any;
};
type GenerationOptions = NonNullable<SpatialJob['options']> & { music: boolean };
type GenerationReview = { jobs: SpatialJob[]; operation: 'retry' | 'regenerate'; options: Record<string, GenerationOptions>; scope: 'direction' | 'both'; quote?: { key: string; pixels: number } };
export default function SpatialStudio(props: Props) {
    const session = useMemo(() => spatialSession(props.api, props.postId, props.scene.sceneId), [props.api, props.postId, props.scene.sceneId]);
    const [scene, setScene] = useState(session.value?.scene || props.scene);
    const continuity = useMemo(() => spatialSceneContinuity(props.stages.map(stage => stage.scene), props.scene.sceneId), [props.stages, props.scene.sceneId]);
    const [tier, setTier] = useState<PlanningTier>(planningModelSelection(session.authoring.inputs.tier || scene.ledger?.world.model));
    const [selectedNames, setSelectedNames] = useState<string[]>(session.authoring.inputs.selectedNames || scene.ledger?.world.references?.map(ref => ref.name) || props.activeReferenceNames || []);
    const [drivenName, setDrivenName] = useState<string>(session.authoring.inputs.drivenName ?? scene.ledger?.world.drivenName ?? continuity.primarySubjectName);
    const [assetsOpen, setAssetsOpen] = useState(true);
    const [sceneEditorCollapsed, setSceneEditorCollapsed] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [detectedSubjects, setDetectedSubjects] = useState<Array<{ name: string; description: string }> | null>(session.authoring.inputs.detectedSubjects || null);
    const [generationModel, setGenerationModel] = useState(props.model);
    const [generationResolution, setGenerationResolution] = useState(props.resolution === '480p' ? '480p' : '720p');
    const [generationAudio, setGenerationAudio] = useState(true), [generationMusic, setGenerationMusic] = useState(true);
    const [resultOptions, setResultOptions] = useState<Record<string, { version: string; value: GenerationOptions }>>({});
    useEffect(() => setGenerationModel(props.model), [props.model]);
    useEffect(() => setGenerationResolution(props.resolution === '480p' ? '480p' : '720p'), [props.resolution]);
    const [, refreshAuthoring] = useState(0);
    const { busy, error } = session.authoring;
    useEffect(() => {
        if (!busy) return;
        const tick = () => setElapsedSeconds(Math.floor((Date.now() - (session.authoring.startedAt || Date.now())) / 1000));
        tick(); const timer = setInterval(tick, 1000);
        return () => clearInterval(timer);
    }, [Boolean(busy), session]);
    const setBusy = (busy: string) => updateSpatialAuthoring(session, { busy });
    const setError = (error: string) => updateSpatialAuthoring(session, { error: spatialErrorMessage(error) });
    const [loaded, setLoaded] = useState(false);
    const [instruction, setInstruction] = useState<string>((session.authoring.inputs.instructionNodeId === scene.activeNodeId ? session.authoring.inputs.instruction : undefined) ?? (scene.ledger?.draft?.forward && (!scene.ledger.draft.generatedPrompt || scene.ledger.draft.prompt === scene.ledger.draft.generatedPrompt) ? '' : scene.ledger?.draft?.prompt) ?? ''), [kind, setKind] = useState<'movement' | 'action'>(session.authoring.inputs.kind || scene.ledger?.draft?.kind || 'movement');
    const [hold, setHold] = useState(Boolean(session.authoring.inputs.hold)), [mapOpen, setMapOpen] = useState(false), [editWorld, setEditWorld] = useState(false);
    const [draft, setDraft] = useState<MotionPlan | null>(null), [draftSamples, setDraftSamples] = useState<SpatialMovementSample[]>([]);
    const [pending, setPending] = useState<{ forward?: SpatialAnimatic; backward?: SpatialAnimatic }>(session.authoring.inputs.pendingMotion || {});
    const [preview, setPreview] = useState<MotionPlan | undefined>();
    const [motionArmed, setMotionArmed] = useState(false);
    const driveActive = useRef(false), awaitingNeutral = useRef(false), captureArmed = useRef(false);
    const [promptEditJob, setPromptEditJob] = useState<SpatialJob>();
    const [promptEditMapped, setPromptEditMapped] = useState<{ routeId: string; direction: 'forward' | 'backward' }>();
    const [generationConfirmation, setGenerationConfirmation] = useState<GenerationReview>();
    const [replacementQuoting, setReplacementQuoting] = useState(false);
    const [actionSettingsOpen, setActionSettingsOpen] = useState(false), [actionCorrection, setActionCorrection] = useState('');
    const [actionCreationPrompt, setActionCreationPrompt] = useState(session.authoring.inputs.pendingMotionPrompt ?? scene.ledger?.draft?.prompt ?? props.prompt);
    const actionPromptProp = useRef(props.prompt);
    useEffect(() => {
        if (actionPromptProp.current === props.prompt) return;
        actionPromptProp.current = props.prompt;
        setActionCreationPrompt(props.prompt);
    }, [props.prompt]);
    const [captureRemaining, setCaptureRemaining] = useState<number | null>(null);
    const [retryPrompt, setRetryPrompt] = useState('');
    const [audioDialog, setAudioDialog] = useState<'draft' | 'clip'>();
    const [clipAudio, setClipAudio] = useState<AudioReference>();
    const draftAudio: AudioReference | undefined = scene.ledger?.actionAudioReferences?.[scene.activeNodeId] || (scene.ledger?.draft?.sourceNodeId === scene.activeNodeId ? scene.ledger.draft.forward?.audioReference : undefined);
    const editorAnimation = promptEditMapped ? scene.ledger?.routes[promptEditMapped.routeId]?.[promptEditMapped.direction] : undefined;
    const editorJob = promptEditJob ? scene.ledger?.jobs.find(job => job.id === promptEditJob.id) : undefined;
    const editorAudio = editorJob?.audioReference || editorAnimation?.audioReference;
    const [imageNodeId, setImageNodeId] = useState<string>(), [imageInstruction, setImageInstruction] = useState('');
    const [imageQuote, setImageQuote] = useState<{ key: string; pixels: number }>();
    const [deleteText, setDeleteText] = useState(''), [confirmDelete, setConfirmDelete] = useState(false);
    const [deleteBeforeReset, setDeleteBeforeReset] = useState(false);
    useEffect(() => {
        if (!editWorld) return;
        const close = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || event.target instanceof Element && event.target.closest('[role="listbox"], [role="menu"]')) return;
            event.stopPropagation(); setEditWorld(false);
        };
        window.addEventListener('keydown', close, true);
        return () => window.removeEventListener('keydown', close, true);
    }, [editWorld]);
    const [quote, setQuote] = useState<{ key: string; pixels: number }>(), [quoteOpen, setQuoteOpen] = useState(false);
    const [generationRoute, setGenerationRoute] = useState<string>();
    const [upscaleQuote, setUpscaleQuote] = useState<SpatialUpscaleQuote>();
    const [abandonImage, setAbandonImage] = useState('');
    const [link, setLink] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false), [helperOpen, setHelperOpen] = useState(false);
    const [rotationMode, setRotationMode] = useState<CreationRotationMode>(null);
    const [testingControls, setTestingControls] = useState(false);
    const [heightInput, setHeightInput] = useState(0);
    const heightHeld = useRef(0);
    const [capturePaused, setCapturePaused] = useState(false);
    const [speedMultiplier, setSpeedMultiplier] = useState<number>(session.authoring.inputs.speedMultiplier || 1);
    const [uiHidden, setUiHidden] = useState(false);
    const [navigationPicker, setNavigationPicker] = useState<'link' | 'backtrack' | null>(null);
    const [canBack, setCanBack] = useState(false);
    const [movementPlaying, setMovementPlaying] = useState(false);
    const [anyClipPlaying, setAnyClipPlaying] = useState(false);
    const [studioToolsOpen, setStudioToolsOpen] = useState(false);
    const [selection, setSelection] = useState<PoseTarget | null>(null);
    const [gizmoMode, setGizmoMode] = useState<'translate' | 'rotate' | 'scale' | null>('translate');
    const [configuredMove, setConfiguredMove] = useState<'roll' | 'jump' | 'crouch'>('roll');
    const [assistInput, setAssistInput] = useState('');
    const presetLibrary = useScenePresetLibrary(props.api);
    const privatePresets = [...BUILTIN_MOTION_PRESETS, ...presetLibrary.items.map(item => item.preset).filter((p): p is MotionNodePreset => p.kind === 'motion_preset')];
    const stagePresets = presetLibrary.items.map(item => item.preset).filter((p): p is StagePreset => p.kind === 'stage_preset');
    const liveSourceSignature = JSON.stringify([props.postId, scene.sceneId, scene.activeNodeId, scene.ledger?.world.revision, props.scene.nodes[0]?.frameUrl, props.prompt, props.imagePrompt, props.sceneIntent, props.duration, props.aspect]);
    const liveSourceHash = Array.from(liveSourceSignature).reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261) >>> 0;
    const liveClient = useMemo(() => new LiveSceneClient(props.api, `spatial:${props.postId}:${scene.sceneId}:${scene.activeNodeId}:${liveSourceHash}`), [props.api, props.postId, scene.sceneId, scene.activeNodeId, liveSourceHash]);
    const [recoveredLive, setRecoveredLive] = useState<{ id: string; body: any; kind?: string }>();
    const liveOwner = useRef(liveClient); liveOwner.current = liveClient;
    const livePhase = useSyncExternalStore(liveClient.subscribe, () => liveClient.snapshot().phase);
    liveClient.onResponse = response => applyPixelBillingHeaders(props.dispatch, response);
    liveClient.canResume = () => liveOwner.current === liveClient;
    useEffect(() => () => liveClient.detach(), [liveClient]);
    const [authoringDraft, setAuthoringDraft] = useState<SceneAuthoringDraft | undefined>(scene.ledger?.draft?.authoring || scene.ledger?.world.authoring);
    const nodeHistories = useRef(new Map<string, AuthoringHistory>());
    const viewport = useRef<SpatialWorldViewportHandle>(null), player = useRef<SpatialPlayerHandle>(null);
    const instructionInput = useRef<HTMLTextAreaElement>(null);
    useEffect(() => { const listener = () => refreshAuthoring(value => value + 1); session.authoringListeners.add(listener); return () => { session.authoringListeners.delete(listener); }; }, [session]);
    useEffect(() => { session.authoring.inputs = { ...session.authoring.inputs, tier, instruction, instructionNodeId: scene.activeNodeId, kind, hold, selectedNames, drivenName, detectedSubjects }; }, [session, tier, instruction, kind, hold, selectedNames, drivenName, detectedSubjects, scene.activeNodeId]);
    const latest = useRef(props); latest.current = props;
    useEffect(() => { latest.current.onPlanningPriceChange?.(prices[tier]); }, [tier]);
    useEffect(() => { latest.current.onActionModeChange?.(kind === 'action'); }, [kind]);
    useEffect(() => { latest.current.onBusyChange?.(Boolean(busy)); return () => latest.current.onBusyChange?.(false); }, [busy]);
    const nodePosition = useRef(scene.activeNodeId);
    const samples = useRef<SpatialMovementSample[]>([]), start = useRef(0);
    const rotationSamples = useRef<SpatialMovementSample[]>([]);
    const ledger = scene.ledger, locked = authoringLocked(ledger);
    const baseWorld = useMemo(() => ledger?.world && !ledger.world.reviewRejected ? validateWorld(ledger.world) : undefined, [ledger?.world]);
    const state = ledger?.states[scene.activeNodeId] || baseWorld?.initialState;
    const primarySubjectName = ledger?.world.primarySubjectName || continuity.primarySubjectName || drivenName;
    const world = useMemo(() => {
        const tracked = baseWorld && { ...baseWorld, primarySubjectName: baseWorld.primarySubjectName || continuity.primarySubjectName || drivenName };
        return tracked && state ? worldAtState(tracked, state) : tracked;
    }, [baseWorld, state, continuity.primarySubjectName, drivenName]);
    useEffect(() => {
        if (session.authoring.inputs.drivenName === undefined && !scene.ledger?.world.drivenName && continuity.primarySubjectName) setDrivenName(continuity.primarySubjectName);
    }, [continuity.primarySubjectName, scene.ledger?.world.drivenName, session]);
    const references = Array.from(new Map([...continuity.references, ...(ledger?.world.references || []), ...(props.references || [])]
        .filter(ref => ref.name?.trim() && ref.imageUrl?.trim()).map(ref => [ref.name, ref])).values());
    const imageReviewPending = Object.values(ledger?.actionImageEdits || {}).some(edit => edit.status === 'submitting' || edit.status === 'ready');
    useEffect(() => { session.authoring.inputs = { ...session.authoring.inputs, speedMultiplier }; }, [session, speedMultiplier]);
    const boardOpen = Boolean(ledger?.boardOpen);
    useEffect(() => {
        latest.current.onVideoGenerationModeChange?.(Boolean(quoteOpen || boardOpen || generationConfirmation));
        return () => latest.current.onVideoGenerationModeChange?.(false);
    }, [quoteOpen, boardOpen, Boolean(generationConfirmation)]);
    const aspect = world?.aspectRatio || props.aspect;
    // Export the accepted action revision without accepting a new Spatial
    // outcome or completing its live AI session. Movement recording is separate.
    liveClient.onExportDraft = async (snapshot, signal, progress) => {
        const requireOwner = () => {
            if (signal.aborted || liveOwner.current !== liveClient || liveClient.snapshot().buildId !== snapshot.liveBuild.buildId) {
                throw Object.assign(new Error('The source scene changed. The retained action was not applied to the new scene.'), { name: 'AbortError' });
            }
            if (!['action', 'action-correction'].includes(liveClient.snapshot().operation || '')) {
                throw new Error('Only live Spatial action animations use Stop and export.');
            }
        };
        requireOwner();
        const exportAspect = liveClient.snapshot().resumeBody?.aspectRatio || aspect;
        const file = await recordMotionGuide(snapshot.plan, exportAspect, signal,
            percent => progress(`Exporting action ${percent}%`), snapshot.authoring);
        requireOwner();
        progress('Uploading action video…');
        const videoUrl = await latest.current.uploadVideo(file);
        requireOwner();
        // Retain only snapshot/export metadata. Saved routes, action outcomes,
        // references and the continuation receipt stay owned by their old paths.
        session.authoring.inputs.liveDraft = { ...snapshot, videoUrl };
        return videoUrl;
    };
    const actionDuration = Number(props.duration) || 5;
    const options = useMemo<GenerationOptions>(() => ({ model: generationModel, resolution: generationResolution, aspect, audio: generationAudio, music: generationAudio && generationMusic }), [generationModel, generationResolution, aspect, generationAudio, generationMusic]);
    const generationContext = useMemo(() => ({ imagePrompt: props.imagePrompt || '', sceneIntent: props.sceneIntent || '', videoPrompt: props.prompt || '' }), [props.imagePrompt, props.sceneIntent, props.prompt]);
    const glass = { bgcolor: props.darkMode ? 'rgba(20,20,20,.88)' : 'rgba(250,250,250,.92)', color: 'text.primary', border: `1px solid ${alpha(props.appColor, .45)}`, backdropFilter: 'blur(22px) saturate(150%)', borderRadius: 3 };
    const accept = (next: SpatialSceneState) => {
        const activeNodeId = next.nodes.some(n => n.id === nodePosition.current) ? nodePosition.current : next.activeNodeId;
        const positioned = { ...next, bShotSource: latest.current.scene.bShotSource || next.bShotSource, activeNodeId }; nodePosition.current = activeNodeId;
        setScene(positioned); latest.current.update(() => positioned);
    };
    const run = (message: string, work: () => Promise<void>) => {
        if (liveClient.snapshot().phase === 'idle') liveClient.onResume = () => { void run(message, work); };
        return runSpatialAuthoring(session, message, async () => {
            try { await work(); }
            catch (error) {
                if ((error as any)?.liveDraft) { session.authoring.inputs.liveDraft = (error as any).liveDraft; return; }
                throw error;
            }
        });
    };
    const acceptLiveResult = async (work: Promise<any>) => {
        const result = await work;
        if (result.liveDraft) throw Object.assign(new Error('The editable AI draft is kept.'), { liveDraft: result });
        return result;
    };
    const clearInstruction = () => { setInstruction(''); session.authoring.inputs.instruction = ''; session.authoring.inputs.instructionNodeId = scene.activeNodeId; };
    const armCapture = () => {
        viewport.current?.reset(); samples.current = []; rotationSamples.current = []; start.current = 0;
        heightHeld.current = 0; setHeightInput(0); setRotationMode(null); setCaptureRemaining(null);
        setTestingControls(false); captureArmed.current = true; awaitingNeutral.current = driveActive.current;
        setMotionArmed(true); setKind('movement'); setCapturePaused(true);
    };
    const disarmCapture = () => { captureArmed.current = false; heightHeld.current = 0; setHeightInput(0); viewport.current?.elevate(0); setRotationMode(null); setCapturePaused(false); setMotionArmed(false); };
    const toggleRotation = (mode: Exclude<CreationRotationMode, null>) => {
        const next = rotationMode === mode ? null : mode;
        if (!captureArmed.current) setTestingControls(true);
        awaitingNeutral.current = driveActive.current;
        viewport.current?.rotate(next);
        setRotationMode(next); setCapturePaused(!heightHeld.current);
    };
    const discardCapture = () => {
        disarmCapture(); setTestingControls(false); viewport.current?.reset(); samples.current = []; rotationSamples.current = []; start.current = 0;
        awaitingNeutral.current = false; setCaptureRemaining(null);
    };
    const heightDrive = (value: number) => {
        heightHeld.current = value; setHeightInput(value);
        if (value && !captureArmed.current) setTestingControls(true);
        viewport.current?.elevate(value);
        if (captureArmed.current) setCapturePaused(!value && !driveActive.current);
    };
    const leftOverlayOpen = Boolean(settingsOpen || mapOpen || actionSettingsOpen || navigationPicker || quoteOpen || boardOpen || editWorld || helperOpen || generationConfirmation);
    useEffect(() => {
        if ((leftOverlayOpen || uiHidden) && heightHeld.current) heightDrive(0);
    }, [leftOverlayOpen, uiHidden]);
    const nodeHistoryKey = `${scene.sceneId}:${scene.activeNodeId}:${world?.revision || ''}`;
    const getNodeHistory = (): AuthoringHistory | null => {
        if (!world || !state) return null;
        let hist = nodeHistories.current.get(nodeHistoryKey);
        if (!hist) {
            const basePlan = pending.forward?.plan || draft || planAtState(world, state);
            const initial = authoringDraft && authoringDraft.sourceKey.startsWith(`${scene.sceneId}:${scene.activeNodeId}:`)
                ? mergeAuthoringPlan(authoringDraft, basePlan, { preserveManualTracks: true })
                : createAuthoringDraft(basePlan, nodeHistoryKey, bindWorldRigs(basePlan), state);
            hist = new AuthoringHistory(initial);
            nodeHistories.current.set(nodeHistoryKey, hist);
        }
        return hist;
    };
    const applyStudioDraft = (next: SceneAuthoringDraft) => {
        setAuthoringDraft(next);
        if (pending.forward) {
            const syncedAuthoring = mergeAuthoringPlan(next, pending.forward.plan, {
                preserveManualTracks: true,
                isNewAuthoringEdit: true,
            });
            const evaluatedEnd = evaluateAuthoringDraft(syncedAuthoring, syncedAuthoring.plan.duration);
            const updatedForward: SpatialAnimatic = {
                ...pending.forward,
                plan: syncedAuthoring.plan,
                authoring: syncedAuthoring,
                endState: evaluatedEnd.state,
            };
            // Forward pose/rig edits change the forward endpoint, invalidating any previously planned return route.
            const updatedPending = { forward: updatedForward, backward: undefined };
            setPending(updatedPending);
            session.authoring.inputs.pendingMotion = updatedPending;
        } else if (draft) {
            setDraft(next.plan);
        }
    };
    const commitStudioCommands = (commands: AuthoringCommand[]) => {
        try {
            const hist = getNodeHistory();
            if (!hist) return;
            const next = hist.commit(commands);
            applyStudioDraft(next);
            viewport.current?.commitAuthoring?.(commands);
            setError('');
        } catch (err) {
            setError((err as Error).message);
        }
    };
    useEffect(() => {
        const stopHeight = () => { if (heightHeld.current) heightDrive(0); };
        const key = (event: KeyboardEvent) => { if (event.key === 'Escape') stopHeight(); };
        const hidden = () => { if (document.hidden) stopHeight(); };
        window.addEventListener('blur', stopHeight); window.addEventListener('keydown', key); document.addEventListener('visibilitychange', hidden);
        return () => { window.removeEventListener('blur', stopHeight); window.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', hidden); };
    }, []);
    useEffect(() => {
        if (!heightInput || !motionArmed) return;
        const sampleHeight = () => {
            if (!captureArmed.current || driveActive.current) return;
            const elapsedMs = (viewport.current?.elapsed() || 0) * 1000;
            if (!samples.current.length || elapsedMs - samples.current.at(-1)!.elapsedMs >= 100)
                samples.current.push({ x: 0, y: heightHeld.current, radius: 1, angle: heightHeld.current > 0 ? Math.PI / 2 : -Math.PI / 2, elapsedMs });
        };
        sampleHeight(); const interval = setInterval(sampleHeight, 100);
        return () => clearInterval(interval);
    }, [heightInput, motionArmed]);
    const save = async (next: SpatialSceneState) => {
        const tracked = next.ledger ? { ...next, ledger: { ...next.ledger, world: { ...next.ledger.world, primarySubjectName: next.ledger.world.primarySubjectName || primarySubjectName } } } : next;
        const result = await spatialOperation(session, 'save', { scene: tracked, revision: session.value?.revision || 0 });
        if (!result) throw new Error('Draft was not saved.');
        return result.scene;
    };
    const selectControlledSubject = (objectId: string) => run('Saving controlled subject…', async () => {
        if (!world || !ledger) return;
        const normalize = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
        const name = references.find(reference => normalize(reference.name) === normalize(objectId))?.name
            || world.plan.objects.find(object => object.id === objectId)?.identity || objectId;
        const next = cloneWorld(scene);
        Object.assign(next.ledger!.world, { controlledObject: objectId, drivenName: name, primarySubjectName, controlSelectionRequired: false });
        const selectedState = next.ledger!.states[next.activeNodeId];
        if (selectedState) { selectedState.controlledObject = objectId; delete selectedState.controlMode; }
        await save(next); setDrivenName(name);
    });
    const setView = (view: 'three' | 'video') => void run('Changing view…', async () => { discardCapture(); player.current?.cancel(); await spatialOperation(session, 'view', { view }); });
    useEffect(() => {
        let alive = true;
        const listener = (doc: { scene: SpatialSceneState }) => { if (alive) {
            const savedDraft = doc.scene.ledger?.draft;
            if (savedDraft) { setDraft(savedDraft.plan); setDraftSamples(savedDraft.samples); setAuthoringDraft(savedDraft.authoring); setPending(session.authoring.inputs.pendingMotion || { forward: savedDraft.forward, backward: savedDraft.backward }); }
            else { setDraft(null); setAuthoringDraft(doc.scene.activeNodeId === doc.scene.nodes[0]?.id ? doc.scene.ledger?.world.authoring : undefined); setPending({}); }
            accept(doc.scene);
        } };
        session.listeners.add(listener);
        void spatialOperation(session, 'read').then(doc => { if (alive) { if (doc) {
            const savedDraft = doc.scene.ledger?.draft;
            if (!captureArmed.current) setTestingControls(!doc.scene.connections.length);
            if (savedDraft) { setDraft(savedDraft.plan); setDraftSamples(savedDraft.samples); setAuthoringDraft(savedDraft.authoring); setKind(savedDraft.kind); setInstruction((session.authoring.inputs.instructionNodeId === savedDraft.sourceNodeId ? session.authoring.inputs.instruction : undefined) ?? (savedDraft.forward && (!savedDraft.generatedPrompt || savedDraft.prompt === savedDraft.generatedPrompt) ? '' : savedDraft.prompt)); setHold(savedDraft.hold); setPending(session.authoring.inputs.pendingMotion || { forward: savedDraft.forward, backward: savedDraft.backward }); nodePosition.current = savedDraft.sourceNodeId; }
            accept(doc.scene);
        } setLoaded(true); } }).catch(e => { if (alive) { setLoaded(false); setError(e?.response?.data?.message || 'Could not load the saved 3D scene. Reopen this stage before building.'); } });
        return () => { alive = false; session.listeners.delete(listener); };
    }, [session]);
    useEffect(() => {
        if (!quoteOpen || !isSpatialVideoModel(generationModel)) return;
        let alive = true; setQuote(undefined);
        void spatialOperation(session, 'quote', { options, routeId: generationRoute, sceneContext: generationContext }).then(async doc => { if (alive && doc?.quote) {
            if (!doc.quote.jobs.length) { setQuoteOpen(false); await spatialOperation(session, 'view', { boardOpen: true }); }
            else setQuote(doc.quote);
        } }).catch(e => { if (alive) setError(e?.response?.data?.message || 'Quote unavailable.'); });
        return () => { alive = false; };
    }, [quoteOpen, options, generationRoute, generationContext]);
    const plan = async (operation: string, source: any, recorded?: MotionPlan, destinationState?: any, submittedPrompt = instruction, actionEdit?: { existingPlan: MotionPlan; existingEndState: SpatialAnimatic['endState']; existingStateChanges: SpatialAnimatic['stateChanges']; correction?: string }) => {
        const selectedReferences = references.filter(ref => ref.name === drivenName || ref.name === primarySubjectName || selectedNames.includes(ref.name) || continuity.references.some(saved => saved.name === ref.name) || (operation !== 'reconstruct' && (props.activeReferenceNames?.includes(ref.name) || world?.references?.some(saved => saved.name === ref.name))));
        const current = session.value?.scene || scene;
        const currentStateContext = current.ledger && !['identify', 'reconstruct'].includes(operation) ? spatialStateContextAt({ connections: current.connections, ledger: current.ledger }, current.activeNodeId) : undefined;
        const requestBody = { operation, llmTier: tier, image: ['identify', 'reconstruct'].includes(operation) ? scene.nodes[0].frameUrl : currentStateContext ? spatialAppearanceFrame(current, current.activeNodeId) || currentStateContext.frameUrl : world?.sourceImage || scene.nodes[0].frameUrl,
            references: selectedReferences, drivenName, primarySubjectName, linkedState: operation === 'reconstruct' ? continuity.linkedState : undefined, duration: operation === 'action' ? actionDuration : 5,
            currentStateContext: currentStateContext?.motionContext,
            prompt: operation === 'return' ? '' : submittedPrompt,
            context: { ...generationContext, subjects: detectedSubjects || undefined },
            guidanceScene: ['movement', 'return'].includes(operation) ? { sceneId: current.sceneId, sourceNodeId: current.activeNodeId, connections: current.connections, jobs: current.ledger?.jobs, routes: current.ledger?.routes } : undefined,
            aspectRatio: aspect, world, authoringContext: operation === 'return' ? undefined : authoringDraft, visualCheckpoints: true, sourceState: source, recorded, recordingSamples: draftSamples, destinationState, ...actionEdit };
        if (operation !== 'identify') { setSettingsOpen(false); setEditWorld(false); setHelperOpen(false); setActionSettingsOpen(false); }
        const response = operation === 'identify'
            ? await axios.post<any>(`${props.api}/spatial-world/plan`, requestBody, { withCredentials: true, timeout: 540000 })
            : { data: await acceptLiveResult(liveClient.run('/spatial-world/plan', requestBody)) };
        if (liveOwner.current !== liveClient) throw new Error('The source scene changed. The accepted build is retained.');
        applyLlmBilling(props.dispatch, response.data);
        return response.data;
    };
    const reconstruct = () => void run('Building shapes, ground and camera from your image…', async () => {
        if (imageReviewPending) throw new Error('Finish reviewing the action image before editing the scene.');
        if (scene.connections.length || locked) throw new Error('Reset the routes before editing the base scene.');
        if (!world && !references.length && detectedSubjects === null && !session.authoring.inputs.pendingWorld) {
            setBusy('Identifying scene subjects…');
            const response = await plan('identify', undefined);
            session.authoring.inputs.detectedSubjects = response.subjects;
            setDetectedSubjects(response.subjects);
            return;
        }
        if (!drivenName.trim() && !world && !session.authoring.inputs.pendingWorld) throw new Error('Choose the driven character, or camera / point of view, before building.');
        // Keep a successful paid reconstruction if only the document save fails.
        // Retrying must save that same geometry, not bill another model call.
        const result = session.authoring.inputs.pendingWorld ? { world: session.authoring.inputs.pendingWorld } : await plan('reconstruct', undefined);
        const built = validateWorld(result.world);
        clearInstruction();
        session.authoring.inputs.pendingWorld = built;
        const previewScene: SpatialSceneState = { ...scene, ledger: { version: 2, world: built, states: { [scene.nodes[0].id]: built.initialState }, routes: {}, jobs: [], epoch: ledger?.epoch || 0, generationStarted: false, boardOpen: false, view: 'three' } };
        // Display the generated scene before persistence; a save failure must
        // never replace a usable result with the source-image setup screen.
        setScene(previewScene);
        setEditWorld(false);
        setBusy('Saving your 3D scene…');
        try { await save(previewScene); liveClient.acknowledge(); }
        catch { setScene(previewScene); throw new Error('Scene ready. Saving is unavailable right now; use Retry saving scene.'); }
        delete session.authoring.inputs.pendingWorld;
        setEditWorld(false);
    });
    const rejectScene = () => void run('Returning to scene setup; keeping the generated scene…', async () => {
        if (!ledger || !baseWorldEditable(ledger, scene.connections.length)) return;
        const next = cloneWorld(scene);
        next.ledger!.world.reviewRejected = true;
        next.ledger!.world.approved = false;
        await save(next);
        setEditWorld(false); setSettingsOpen(false); setSceneEditorCollapsed(false);
    });
    const restoreScene = () => void run('Restoring the generated scene; no AI call…', async () => {
        const next = cloneWorld(scene);
        delete next.ledger!.world.reviewRejected;
        await save(next);
    });
    const anchor = async (animation: SpatialAnimatic, at: number, framing = aspect) => {
        const canvas = document.createElement('canvas');
        const [w, h] = framing === '9:16' ? [540, 960] : framing === '1:1' ? [720, 720] : [960, 540];
        const renderer = createMotionRenderer(canvas, animation.plan, w, h, animation.authoring);
        try { renderer.draw(at); return await props.uploadFrame(await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not capture endpoint.')), 'image/png'))); }
        finally { renderer.dispose(); }
    };
    const referenceQueue = spatialReferencePreparation(session, {
        read: () => session.value?.scene,
        prepare: async (work, progress) => {
            const animation = work.animation;
            const assetKind = work.action ? 'action' : 'motion';
            progress(`Preparing ${assetKind} assets…`);
            if (!work.action) {
                progress('Preparing motion images…');
                await captureSpatialMotionEvidence(animation, work.aspect, work.controlledObject, props.uploadFrame, async () => {});
                if (work.signal.aborted) return;
                if (!animation.guidance) {
                    await spatialOperation(session, 'save-reference', { routeId: work.routeId, direction: work.direction, animationId: animation.id,
                        worldRevision: work.worldRevision, planKey: work.planKey, motionEvidence: animation.motionEvidence });
                    if (work.signal.aborted) return;
                    progress('Preparing motion instructions…');
                    const prepared = await spatialOperation(session, 'prepare-guidance', { routeId: work.routeId, direction: work.direction, sceneContext: generationContext });
                    animation.guidance = prepared?.scene.ledger?.routes[work.routeId]?.[work.direction]?.guidance;
                }
            }
            if (work.signal.aborted) return;
            if (!animation.referenceVideo) {
                work.videoFile ||= await recordMotionGuide(animation.plan, work.aspect, work.signal, percent => progress(`Exporting ${assetKind} assets ${percent}%`), animation.authoring);
                if (work.signal.aborted) return;
                progress(`Uploading ${assetKind} assets…`);
                animation.referenceVideo = await props.uploadVideo(work.videoFile);
                delete work.videoFile;
            }
            if (!animation.startAnchor) animation.startAnchor = await anchor(animation, 0, work.aspect);
            if (!animation.endAnchor) animation.endAnchor = await anchor(animation, animation.plan.duration, work.aspect);
        },
        persist: work => spatialOperation(session, 'save-reference', { routeId: work.routeId, direction: work.direction,
            animationId: work.animation.id, worldRevision: work.worldRevision, planKey: work.planKey,
            referenceVideo: work.animation.referenceVideo, startAnchor: work.animation.startAnchor,
            endAnchor: work.animation.endAnchor, motionEvidence: work.animation.motionEvidence }),
    });
    const [, refreshReferences] = useState(0);
    useEffect(() => referenceQueue.subscribe(() => refreshReferences(value => value + 1)), [referenceQueue]);
    useEffect(() => { void referenceQueue.start().catch(() => {}); }, [referenceQueue, scene.ledger?.routes, scene.ledger?.world.revision, scene.ledger?.jobs]);
    const referenceStatus = referenceQueue.status;
    const generatedPrompt = session.authoring.inputs.pendingMotionPrompt ?? ledger?.draft?.generatedPrompt ?? ledger?.draft?.prompt;
    // The consumed text remains motion metadata, not input for the next motion.
    const motionPrompt = kind === 'action' ? actionCreationPrompt.trim() : instruction || (pending.forward ? generatedPrompt || '' : '');
    const motionChanged = Boolean(pending.forward && (generatedPrompt !== motionPrompt || kind === 'action' && pending.forward.plan.duration !== actionDuration));
    const keepPending = (next: typeof pending, prompt = motionPrompt) => {
        session.authoring.inputs.pendingMotion = next;
        session.authoring.inputs.pendingMotionPrompt = prompt;
        setPending(next);
    };
    const retainMotion = async (recording: MotionPlan, next: typeof pending, prompt = motionPrompt) => {
        const document = cloneWorld(session.value?.scene || scene);
        document.ledger!.draft = { plan: recording, ...(authoringDraft ? { authoring: authoringDraft } : {}), samples: draftSamples, kind, prompt: next.forward && kind === 'movement' && prompt === (session.authoring.inputs.pendingMotionPrompt ?? generatedPrompt) ? '' : prompt, generatedPrompt: session.authoring.inputs.pendingMotionPrompt ?? generatedPrompt, hold, sourceNodeId: scene.activeNodeId, ...next };
        await save(document);
    };
    const processMotion = (rebuild = false, correction?: string) => run(correction ? 'Applying your action changes…' : kind === 'action' ? 'Planning your 3D action…' : 'Planning forward movement…', async () => {
        if (!world || !ledger || !state || !world.approved) throw new Error('Approve the scene proxy before authoring.');
        if (imageReviewPending) throw new Error('Finish reviewing the action image before authoring another route.');
        if (kind === 'action' && !motionPrompt) throw new Error('Enter the action in Action settings or the video prompt.');
        if (kind === 'action' && draftAudio?.enabled) validateAudioReference(draftAudio, actionDuration);
        if (kind === 'action' && (scene.connections.some(edge => edge.sourceNodeId === scene.activeNodeId && edge.kind === 'action') || scene.nodes.find(n => n.id === scene.activeNodeId)?.actionLink || scene.nodes.find(n => n.id === scene.activeNodeId)?.actionBacktrack)) throw new Error('This node already has an action or navigation. Author from its result node instead.');
        const recording = draft || (kind === 'action' ? planAtState(world, state, actionDuration) : null);
        if (!recording) throw new Error('Record a short step with the controller first.');
        const previousAction = kind === 'action' && correction ? pending.forward : undefined;
        let forward = motionChanged || rebuild || previousAction ? undefined : pending.forward;
        let backward = motionChanged || rebuild ? undefined : pending.backward;
        const submittedPrompt = motionPrompt;
        if (!forward) {
            forward = (await plan(kind, previousAction?.sourceState || state, recording, undefined, submittedPrompt, previousAction ? { existingPlan: previousAction.plan, existingEndState: previousAction.endState, existingStateChanges: previousAction.stateChanges, correction } : undefined)).animatic;
            if (!forward?.plan || !forward.endState) throw new Error('The response contained no usable motion.');
            if (authoringDraft) {
                const syncedAuthoring = forward.authoring || mergeLiveAuthoringPlan(authoringDraft, forward.plan, liveClient.snapshot().pinned, { controlledObjectId: kind === 'movement' ? world.controlledObject : undefined })!;
                forward.plan = syncedAuthoring.plan;
                forward.authoring = syncedAuthoring;
                const evaluated = evaluateAuthoringDraft(syncedAuthoring, syncedAuthoring.plan.duration).state;
                forward.endState = { ...evaluated, controlledObject: forward.endState.controlledObject, controlMode: forward.endState.controlMode };
                setAuthoringDraft(syncedAuthoring);
            }
            if (!previousAction) keepPending({ forward }, submittedPrompt);
        }
        if (kind === 'movement') clearInstruction();
        if (kind === 'action') forward!.audioReference = draftAudio;
        const acceptedPrompt = previousAction ? forward!.creatorInstruction || forward!.prompt || submittedPrompt : submittedPrompt;
        await retainMotion(recording, { forward, backward }, acceptedPrompt);
        liveClient.acknowledge();
        if (previousAction) { keepPending({ forward, backward }, acceptedPrompt); setActionCreationPrompt(acceptedPrompt); }
        if (kind === 'action') { setActionCorrection(''); setActionSettingsOpen(false); }
        setHelperOpen(false);
        if (kind === 'movement' && !backward) {
            setBusy('Planning return movement…');
            backward = (await plan('return', forward!.endState, forward!.plan, state)).animatic;
            keepPending({ forward, backward }, submittedPrompt);
            await retainMotion(recording, { forward, backward }, submittedPrompt);
            liveClient.acknowledge();
        }
        setPreview(forward!.plan);
    });
    const cancelAction = () => void run('Cancelling action…', async () => {
        player.current?.cancel(); setPreview(undefined); viewport.current?.reset();
        const document = cloneWorld(session.value?.scene || scene);
        // Only discard the unsaved action. Saved nodes, routes and videos stay.
        if (document.ledger?.draft?.kind === 'action') { delete document.ledger.draft; await save(document); }
        delete session.authoring.inputs.pendingMotion; delete session.authoring.inputs.pendingMotionPrompt;
        session.authoring.inputs.instruction = ''; session.authoring.inputs.instructionNodeId = scene.activeNodeId;
        disarmCapture(); setDraft(null); setPending({}); setKind('movement');
        setNavigationPicker(null); setLink(''); setHold(false); setHelperOpen(false); setActionSettingsOpen(false); setActionCorrection('');
    });
    const prepareReferences = (routeId?: string) => referenceQueue.start(routeId, true);
    const finishRecording = (recorded: MotionPlan | null, recordedAuthoring?: SceneAuthoringDraft) => {
        disarmCapture();
        player.current?.cancel();
        setCaptureRemaining(null);
        if (!recorded) return;
        if (draft) return;
        // Turning gestures must not steal the forward playback route from the
        // subsequent travel. A turn-only recording uses its rotation gesture.
        const recordedSamples = (samples.current.length ? samples.current : rotationSamples.current).filter(sample => sample.elapsedMs <= 5000).map(sample => ({ ...sample }));
        samples.current = []; rotationSamples.current = [];
        setCaptureRemaining(null);
        const nextAuthoring = recordedAuthoring || authoringDraft;
        const mergedAuthoring = nextAuthoring
            ? mergeAuthoringPlan(nextAuthoring, recorded, { preserveManualTracks: true })
            : undefined;
        const effectiveRecorded = mergedAuthoring ? mergedAuthoring.plan : recorded;
        if (mergedAuthoring) setAuthoringDraft(mergedAuthoring);
        setDraft(effectiveRecorded); setDraftSamples(recordedSamples); setKind('movement');
        void run('Saving recorded motion…', async () => {
            const next = cloneWorld(session.value?.scene || scene);
            next.ledger!.draft = { plan: effectiveRecorded, ...(mergedAuthoring ? { authoring: mergedAuthoring } : {}), samples: recordedSamples, kind: 'movement', prompt: instruction, hold: false, sourceNodeId: scene.activeNodeId };
            await save(next);
        });
    };
    const saveMotion = () => run(`Saving your reviewed ${kind === 'action' ? 'action' : 'motion'}…`, async () => {
        if (!world || !ledger || !pending.forward || motionChanged || kind === 'movement' && !pending.backward) throw new Error('Finish planning and previewing the motion before saving.');
        const forward = cloneWorld(pending.forward);
        if (authoringDraft) {
            const syncedAuthoring = mergeAuthoringPlan(authoringDraft, forward.plan, {
                preserveManualTracks: true,
                isNewAuthoringEdit: true,
            });
            forward.plan = syncedAuthoring.plan;
            forward.authoring = syncedAuthoring;
            forward.endState = evaluateAuthoringDraft(syncedAuthoring, syncedAuthoring.plan.duration).state;
        }
        forward.startAnchor = scene.nodes.find(n => n.id === scene.activeNodeId)!.frameUrl;
        const backward = pending.backward ? cloneWorld(pending.backward) : undefined;
        keepPending({ forward, backward });
        await retainMotion(draft || planAtState(world, state!), { forward, backward });
        if (backward) { backward.startAnchor = forward.endAnchor; backward.endAnchor = forward.startAnchor; }
        const id = crypto.randomUUID(), target = crypto.randomUUID();
        const next = cloneWorld(session.value?.scene || scene);
        next.nodes.push({ id: target, label: kind === 'action' ? `Action ${scene.nodes.length}` : `Step ${scene.nodes.length}`, frameUrl: forward.endAnchor || forward.startAnchor, kind, createdAt: Date.now() });
        next.connections.push({ id, sourceNodeId: scene.activeNodeId, targetNodeId: target, kind, actionPlayback: hold ? 'hold' : 'tap', actionPrompt: kind === 'action' ? motionPrompt : undefined,
            movement: { id, sourceNodeId: scene.activeNodeId, createdAt: Date.now(), durationMs: forward.plan.duration * 1000, samples: kind === 'action' ? [] : draftSamples }, forward: null, backward: null, status: 'draft' });
        next.ledger!.routes[id] = { connectionId: id, worldRevision: world.revision, forward, backward };
        next.ledger!.states[target] = forward.endState;
        delete next.ledger!.draft;
        setBusy(`Saving your reviewed ${kind === 'action' ? 'action' : 'motion'}…`);
        await save(next);
        delete session.authoring.inputs.pendingMotion; delete session.authoring.inputs.pendingMotionPrompt;
        session.authoring.inputs.instruction = ''; session.authoring.inputs.instructionNodeId = scene.activeNodeId; session.authoring.inputs.kind = 'movement';
        disarmCapture(); setTestingControls(false); viewport.current?.reset(); setDraft(null); setPending({}); setPreview(undefined); setInstruction(''); setKind('movement'); setHelperOpen(false);
    });
    useEffect(() => {
        if (!props.actionSubmitRef) return;
        props.actionSubmitRef.current = kind === 'action' ? () => processMotion(Boolean(pending.forward)) : null;
        return () => { if (props.actionSubmitRef) props.actionSubmitRef.current = null; };
    });
    const stages = props.stages.length ? props.stages.map(stage => stage.id === scene.sceneId ? { ...stage, scene } : stage)
        : [{ id: scene.sceneId, label: 'Scene', address: { sceneId: scene.sceneId }, scene, contexts: [] }];
    const imageNode = scene.nodes.find(node => node.id === imageNodeId);
    const imageEdit = imageNodeId ? ledger?.actionImageEdits?.[imageNodeId] : undefined;
    const activeActionResult = scene.connections.some(edge => edge.kind === 'action' && edge.targetNodeId === scene.activeNodeId);
    const holdAction = scene.connections.some(edge => edge.sourceNodeId === scene.activeNodeId && edge.kind === 'action' && edge.actionPlayback === 'hold');
    const hasAction = scene.connections.some(edge => edge.sourceNodeId === scene.activeNodeId && edge.kind === 'action') || Boolean(scene.nodes.find(node => node.id === scene.activeNodeId)?.actionLink || scene.nodes.find(node => node.id === scene.activeNodeId)?.actionBacktrack);
    const links: SpatialSceneLinkOption[] = stages.map(stage => ({ ...stage.address, label: stage.label, frameUrl: stage.scene.nodes[0]?.frameUrl || '' }));
    const currentNode = scene.nodes.find(node => node.id === scene.activeNodeId);
    const linkPreview = currentNode?.actionLink ? links.find(item => sameSpatialSceneLink(item, currentNode.actionLink!)) : undefined;
    const backtrackNode = currentNode?.actionBacktrack ? scene.nodes.find(node => node.id === currentNode.actionBacktrack!.targetNodeId) : undefined;
    const actionLabel = currentNode?.actionLink ? `Go to ${linkPreview?.label || 'linked scene'}` : currentNode?.actionBacktrack ? `Backtrack to ${backtrackNode?.label || 'saved node'}` : hasAction ? (holdAction ? 'Hold to play action' : 'Play spatial action') : kind === 'action' ? 'Exit spatial action creation' : 'Create a spatial action';
    const unstartedCount = (current: SpatialSceneState, routeId?: string) => Object.values(current.ledger?.routes || {}).filter(route => !routeId || route.connectionId === routeId)
        .reduce((total, route) => total + (['forward', 'backward'] as const).filter(direction => route[direction] && !current.ledger?.jobs.some(job => job.id === `${route.connectionId}:${direction}`)).length, 0);
    const continueMapping = () => void run('Returning to mapping…', async () => {
        if ((session.value?.scene.ledger?.jobs || ledger?.jobs || []).some(spatialJobIsActive)) return;
        player.current?.cancel(); setQuoteOpen(false); setGenerationRoute(undefined); setGenerationConfirmation(undefined); setSettingsOpen(false);
        if (!ledger?.draft) setKind('movement');
        await spatialOperation(session, 'view', { boardOpen: false, view: 'three' });
    });
    const finishMapping = (routeId?: string) => void run('Preparing motion references…', async () => {
        if (!unstartedCount(session.value?.scene || scene, routeId)) { setQuoteOpen(false); await spatialOperation(session, 'view', { boardOpen: true }); return; }
        if (routeId) { const blocked = spatialRouteGenerationBlocker(session.value?.scene || scene, routeId); if (blocked) throw new Error(blocked); }
        disarmCapture();
        await prepareReferences(routeId);
        setGenerationRoute(routeId); setQuote(undefined); setQuoteOpen(true);
    });
    const generationCount = unstartedCount(scene, generationRoute);
    const generationTitle = `Generate ${generationCount} motion video${generationCount === 1 ? '' : 's'}`;
    const jobLabel = (job: SpatialJob) => `Motion ${Object.keys(ledger?.routes || {}).indexOf(job.connectionId) + 1} · ${job.direction === 'backward' ? 'Backward' : job.kind === 'action' ? 'Action' : 'Forward'}`;
    const openPromptEditor = (job: SpatialJob) => { setPromptEditJob(job); setRetryPrompt(effectiveSpatialClipPrompt({ ...job, kind: scene.connections.find(edge => edge.id === job.connectionId)?.kind === 'action' ? 'action' : 'movement' })); };
    const savedJobOptions = (job: SpatialJob): GenerationOptions => {
        const saved = job.options || session.value?.options;
        const model = saved?.model || job.model;
        const resolution = saved?.resolution || (isSpatialVideoModel(model) && spatialVideoPixels(model, '480p', job.duration, job, saved?.audio ?? true) === job.pixels ? '480p' : '720p');
        return { model, resolution, aspect: saved?.aspect || aspect, audio: saved?.audio ?? true, music: (saved?.audio ?? true) && (saved?.music ?? false) };
    };
    const resultVersion = (job: SpatialJob) => `${scene.sceneId}:${job.attempt}:${JSON.stringify(job.options || session.value?.options || {})}`;
    const nextJobOptions = (job: SpatialJob) => resultOptions[job.id]?.version === resultVersion(job) ? resultOptions[job.id].value : savedJobOptions(job);
    const changeJobOptions = (job: SpatialJob, value: GenerationOptions) => setResultOptions(previous => ({ ...previous, [job.id]: { version: resultVersion(job), value } }));
    const reviewGeneration = (jobs: SpatialJob[], operation: 'retry' | 'regenerate', scope: 'direction' | 'both' = 'direction') => {
        const pairOptions = nextJobOptions(jobs[0]);
        setError('');
        setGenerationConfirmation({ jobs, operation, scope, options: Object.fromEntries(jobs.map(job => [job.id, scope === 'both' ? { ...pairOptions } : { ...nextJobOptions(job) }])) });
    };
    const replacementQuoteKey = generationConfirmation?.operation === 'regenerate' ? JSON.stringify([generationConfirmation.jobs.map(job => [job.id, job.attempt]).sort(), generationConfirmation.options]) : '';
    useEffect(() => {
        if (!generationConfirmation || generationConfirmation.operation !== 'regenerate') { setReplacementQuoting(false); return; }
        let alive = true;
        const review = generationConfirmation;
        setReplacementQuoting(true);
        setGenerationConfirmation(current => current ? { ...current, quote: undefined } : current);
        void spatialOperation(session, 'quote', { jobIds: review.jobs.map(job => job.id), options: review.options[review.jobs[0].id], sceneContext: generationContext }).then(document => {
            if (!alive || !document?.quote) return;
            const selected = new Map(review.jobs.map(job => [job.id, job]));
            const jobs = document.quote.jobs.map(job => selected.get(job.id)).filter((job): job is SpatialJob => Boolean(job));
            if (jobs.length !== review.jobs.length) throw new Error('The replacement scope changed. Review the clips again.');
            setGenerationConfirmation(current => current ? { ...current, jobs, quote: { key: document.quote!.key, pixels: document.quote!.pixels } } : current);
        }).catch(error => { if (alive) setError(error?.response?.data?.message || error.message || 'Replacement quote unavailable.'); }).finally(() => { if (alive) setReplacementQuoting(false); });
        return () => { alive = false; };
    }, [replacementQuoteKey, session, generationContext]);
    const notice = (message: React.ReactNode, onClose?: () => void) => <SpatialNotice darkMode={props.darkMode} accent={props.appColor} onClose={onClose}>{message}</SpatialNotice>;
    // Geometry and spacing are taken from EditStory at 5b0d29e. Stay inside the
    // media panel and below its existing close/expand controls.
    const accentFinish = { contrast: .3, borderWidth: 2 };
    const pill = { ...appAccentButtonSx(props.appColor, props.darkMode, accentFinish), borderRadius: 999, minHeight: 40, px: 1.5, fontWeight: 750, fontSize: '.75rem', letterSpacing: 0, textTransform: 'none' };
    // The opposite palette keeps its own foreground rule: dark accent = black,
    // light accent = white, even when used on the other mode's neutral surface.
    const alternatePill = { ...pill, ...appAccentButtonSx(props.darkMode ? '#cc0000' : '#E69500', !props.darkMode, accentFinish) };
    const neutralPill = { borderRadius: 999, minHeight: 40, px: 1.5, fontWeight: 750, fontSize: '.75rem', textTransform: 'none',
        color: props.darkMode ? '#fff' : '#111', background: props.darkMode ? 'linear-gradient(135deg, rgba(20,24,31,.88), rgba(6,9,14,.78))' : 'linear-gradient(135deg, rgba(255,255,255,.94), rgba(225,235,248,.82))',
        border: `2px solid ${props.darkMode ? '#000' : '#fff'}`, backdropFilter: 'blur(20px) saturate(160%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.22), 0 3px 10px rgba(0,0,0,.16)',
        '&:hover': { background: props.darkMode ? 'linear-gradient(135deg, rgba(35,41,52,.94), rgba(12,17,26,.9))' : 'linear-gradient(135deg, #fff, rgba(212,225,245,.94))' },
        '&:focus-visible': { outline: `2px solid ${props.appColor}`, outlineOffset: 3 },
    };
    const round = { ...neutralPill, width: 40, height: 40, flex: '0 0 40px', p: 0, '&.Mui-disabled': { color: props.darkMode ? 'rgba(255,255,255,.5)' : 'rgba(0,0,0,.45)', boxShadow: 'none' } };
    const generationSelect = {
        '& .MuiInputBase-root': { ...neutralPill, minHeight: 48, px: 0, color: 'inherit' },
        '& .MuiOutlinedInput-notchedOutline': { border: '0 !important' },
        '& .MuiSelect-select': { py: 1.5, pl: 2, pr: '40px !important', fontSize: '.875rem' },
        '& .MuiSelect-icon': { color: props.appColor, right: 12 },
        '& .MuiInputLabel-root': { position: 'relative', transform: 'none', fontSize: '.7rem', fontWeight: 700, mb: .75, ml: 1, color: 'text.secondary' },
    };
    const retryPixels = (job: SpatialJob, selection = nextJobOptions(job)) => isSpatialVideoModel(selection.model) ? spatialVideoPixels(selection.model, selection.resolution, job.duration, job, selection.audio) : job.pixels;
    const generationSettings = (selection = options, onChange = (next: GenerationOptions) => {
        setQuote(undefined); setError(''); setGenerationModel(next.model); setGenerationResolution(next.resolution); setGenerationAudio(next.audio); setGenerationMusic(next.music);
        if (next.model !== generationModel) props.onModelChange?.(next.model);
        if (next.resolution !== generationResolution) props.onResolutionChange?.(next.resolution);
    }, compact = false, label = 'Spatial sound') => <Box sx={{ display: 'grid', gridTemplateColumns: compact ? 'minmax(0,1fr) minmax(80px,.4fr)' : '1fr', gap: compact ? 1 : 1.5, mb: compact ? 0 : 2 }}>
        <TextField select fullWidth size="small" label={compact ? 'Model' : 'Video generation model'} InputLabelProps={{ shrink: true }} value={isSpatialVideoModel(selection.model) ? selection.model : ''} disabled={Boolean(busy)} onChange={e => onChange({ ...selection, model: e.target.value })} sx={generationSelect}>
            <MenuItem value="" disabled>Choose an API model</MenuItem>
            {Object.keys(spatialVideoModels).map(model => <MenuItem key={model} value={model}>{getVideoModelDisplayName(model)}</MenuItem>)}
        </TextField>
        <TextField select fullWidth size="small" label={compact ? 'Resolution' : 'Video resolution'} InputLabelProps={{ shrink: true }} value={selection.resolution} disabled={Boolean(busy)} onChange={e => onChange({ ...selection, resolution: e.target.value })} sx={generationSelect}>
            <MenuItem value="480p">480p</MenuItem><MenuItem value="720p">{selection.model === 'Proxxx' || selection.model === 'FalH3' ? '768p' : '720p'}</MenuItem>
        </TextField>
        <Box role="group" aria-label={label} sx={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', columnGap: 2 }}>
            <FormControlLabel control={<Switch checked={selection.audio} disabled={Boolean(busy)} onChange={(_, audio) => onChange({ ...selection, audio, music: audio && selection.music })} inputProps={{ 'aria-label': `${label} Audio` }} />} label="Audio" />
            <FormControlLabel control={<Switch checked={selection.audio && selection.music} disabled={Boolean(busy) || !selection.audio} onChange={(_, music) => onChange({ ...selection, music })} inputProps={{ 'aria-label': `${label} Music` }} />} label="Music" />
        </Box>
    </Box>;
    useEffect(() => {
        const sync = () => {
            const snapshot = liveClient.snapshot();
            if (snapshot.phase === 'paused' && snapshot.buildId && snapshot.resumeBody) setRecoveredLive(previous => previous?.id === snapshot.buildId ? previous : { id: snapshot.buildId!, body: snapshot.resumeBody, kind: snapshot.kind });
        };
        const unsubscribe = liveClient.subscribe(sync);
        void liveClient.recover('/spatial-world/plan');
        return unsubscribe;
    }, [liveClient]);
    useEffect(() => {
        if (!recoveredLive || recoveredLive.id !== liveClient.snapshot().buildId || recoveredLive.kind === 'motion') return;
        const body = recoveredLive.body;
        if (body.recorded) { setDraft(validateMotionPlan(body.recorded)); setDraftSamples(Array.isArray(body.recordingSamples) ? body.recordingSamples : []); }
        if (body.operation === 'movement' || body.operation === 'return') { setKind('movement'); setInstruction(body.prompt || ''); }
        if (body.operation === 'action') { setKind('action'); setActionCreationPrompt(body.prompt || ''); setActionCorrection(body.correction || ''); }
    }, [recoveredLive, liveClient]);
    if (recoveredLive && recoveredLive.id === liveClient.snapshot().buildId) {
        if (recoveredLive.kind === 'motion') liveClient.onResume = () => { void run('AI is continuing your scene…', async () => {
            const result = await acceptLiveResult(liveClient.run('/motion-guide/build', recoveredLive.body));
            if (liveOwner.current !== liveClient) return;
            applyLlmBilling(props.dispatch, result);
            const initial = recoveredLive.body.authoringContext?.schema === 'clikb.scene-authoring.v1' ? recoveredLive.body.authoringContext : authoringDraft || getNodeHistory()?.current || createAuthoringDraft(result.plan, nodeHistoryKey, bindWorldRigs(result.plan), state);
            const next = adoptLiveAuthoringResult(initial, result, liveClient.snapshot().pinned);
            getNodeHistory()?.adopt(next); applyStudioDraft(next);
        }); };
        else liveClient.onResume = () => { if (recoveredLive.body.operation === 'reconstruct') reconstruct(); else void processMotion(false, recoveredLive.body.correction); };
    }
    const status = <Box role="status" sx={{ ...glass, borderColor: 'divider', p: 1, width: 240, maxWidth: '100%', boxSizing: 'border-box' }}><Typography variant="body2">{busy}</Typography><LinearProgress sx={{ my: .5, bgcolor: alpha(props.appColor, .15), '& .MuiLinearProgress-bar': { bgcolor: props.appColor } }} /><Typography variant="caption">{elapsedSeconds}s</Typography></Box>;
    return <SpatialTheme darkMode={props.darkMode}><Box data-spatial-authoring="integrated" data-spatial-generation-open={boardOpen ? 'true' : 'false'} data-spatial-controls-hidden={uiHidden ? 'true' : 'false'} data-editstory-gesture-guard="true" sx={{ position: 'absolute', inset: 0, zIndex: 30, color: 'text.primary', pointerEvents: 'none', containerType: 'size',
        '& .MuiButton-root:not([data-spatial-asset]), & .MuiIconButton-root': { borderColor: `${props.darkMode ? '#000' : '#fff'} !important`, borderWidth: '2px !important' },
        '& > .MuiBox-root, & > .MuiButtonBase-root, & .spatial-drive-control': { pointerEvents: 'auto' },
        '& > [data-spatial-top-controls]': { pointerEvents: 'none !important' },
        '& > [data-spatial-stage], & > [data-spatial-playback]': { pointerEvents: 'none !important' },
        '& > [aria-label="Playable 3D scene proxy"]': { pointerEvents: studioToolsOpen && ledger?.view === 'three' && !anyClipPlaying && !preview && !leftOverlayOpen ? 'auto !important' : 'none !important' },
        // Hide only overlays. The viewport/player and their in-flight preview stay mounted.
        '& [data-spatial-ui], & .spatial-drive-control, & > .MuiButtonBase-root, & > .MuiBox-root:not([data-spatial-top-controls])': (uiHidden || livePhase !== 'idle') ? { display: 'none !important' } : {},
        '& .spatial-drive-control': kind === 'action' ? { display: 'none !important' } : {},
    }} onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} onPointerMove={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseMove={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onMouseLeave={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
        {(world || livePhase !== 'idle' || uiHidden) && <SceneControlsToggle hidden={uiHidden} onToggle={()=>setUiHidden(value=>!value)}/>}
        <div data-live-authoring-layer style={{ position: 'absolute', inset: 0, zIndex: 40, pointerEvents: 'none' }}><LiveSceneWorkspace client={liveClient} accent={props.appColor} aspect={aspect} planningTier={tier} controlsHidden={uiHidden} maximized overlay /></div>
        {scene.bShotIdentityConflict?.length ? <Box sx={{ ...glass, m: 2, p: 2 }}>
            <Alert severity="warning">These older B-roll have identical sources and no saved slot identity. Choose the existing map for this shot; no graph will be guessed or overwritten.</Alert>
            {(props.identityCandidates || []).filter(candidate => scene.bShotIdentityConflict!.includes(candidate.sceneId)).map(candidate => <Button key={candidate.sceneId} fullWidth disabled={Boolean(busy)} onClick={() => void run('Binding the selected saved map…', async () => {
                const selected = spatialSession(props.api, props.postId, candidate.sceneId);
                const existing = await spatialOperation(selected, 'read');
                if (!existing) throw new Error('This saved map is unavailable.');
                const bound = await spatialOperation(selected, 'bind-source', { revision: existing.revision, source: { ...scene.bShotSource, identity: candidate.sceneId } });
                if (bound) latest.current.update(() => bound.scene);
            })}>Use map {candidate.sceneId.split(':').at(-1)} · {candidate.nodes.length} nodes · {candidate.connections.length} routes</Button>)}
        </Box> : !world ? null : <>
            {ledger!.view === 'three' && state && <SpatialWorldViewport ref={viewport} world={world} state={state} aspect={aspect} recording={motionArmed} speedMultiplier={speedMultiplier} plan={preview} playing={Boolean(preview)} authoring={authoringDraft} renderWhen={() => liveClient.snapshot().phase === 'idle'} onAuthoringChange={next => { const hist = getNodeHistory(); if (hist) hist.adopt(next); applyStudioDraft(next); }} selection={selection} onSelect={target => { setSelection(target); if (target && !gizmoMode) setGizmoMode('translate'); }} gizmoMode={gizmoMode} interactive={Boolean(studioToolsOpen && !anyClipPlaying && !preview && !leftOverlayOpen)} onEnd={() => setPreview(undefined)} onCaptureProgress={setCaptureRemaining} onCaptureEnd={(recorded, recordedAuthoring) => finishRecording(recorded, recordedAuthoring)} onError={setError} />}
            <SpatialExperiencePlayer ref={player} mode="creation" creation={{ scene, stages, view: ledger!.view, hideSurface: ledger!.view === 'three',
                navigate: position => {
                    if (position.stageId !== scene.sceneId) return props.navigate(position);
                    if (nodePosition.current !== position.nodeId) {
                        setInstruction(''); setHelperOpen(false);
                        session.authoring.inputs.instruction = ''; session.authoring.inputs.instructionNodeId = position.nodeId;
                    }
                    nodePosition.current = position.nodeId;
                    const next = { ...scene, activeNodeId: position.nodeId }; setScene(next); latest.current.update(() => next); setDraft(null); setAuthoringDraft(position.nodeId === scene.nodes[0]?.id ? scene.ledger?.world.authoring : undefined); setSelection(null); setPending({}); setPreview(undefined);
                    void spatialOperation(session, 'view', { activeNodeId: position.nodeId }).catch(e => setError(e.message)); return true;
                }, isBlocked: () => Boolean(busy || quoteOpen || boardOpen || editWorld || preview || draft || pending.forward || !world.approved || kind === 'action' && !hasAction), onPlaybackStart: traversal => { setAnyClipPlaying(true); setMovementPlaying(traversal.connection.kind !== 'action'); discardCapture(); setDraft(null); setPreview(undefined); setHelperOpen(false); }, onNavigate: discardCapture, onDrive: sample => { driveActive.current = sample.active && sample.radius >= .08; if (!driveActive.current) awaitingNeutral.current = false; },
                capturesDrive: () => ledger!.view === 'three' && (captureArmed.current || testingControls),
                onUnmatchedDrive: sample => {
                    if (!(captureArmed.current || testingControls) || awaitingNeutral.current || !world.approved || draft || ledger!.view !== 'three') return;
                    viewport.current?.drive(sample);
                    if (!captureArmed.current) return;
                    setCapturePaused(false);
                    if (!samples.current.length) start.current = sample.timestamp;
                    const elapsedMs = (viewport.current?.elapsed() || 0) * 1000;
                    const routeSamples = rotationMode ? rotationSamples.current : samples.current;
                    if (!routeSamples.length || elapsedMs - routeSamples.at(-1)!.elapsedMs >= 100) routeSamples.push({ ...sample, elapsedMs });
                }, onUnmatchedDriveEnd: () => {
                    driveActive.current = false;
                    viewport.current?.drive({ x: 0, y: 0, radius: 0, angle: 0, active: false, timestamp: performance.now() });
                    if (captureArmed.current) setCapturePaused(!heightHeld.current);
                }, onUnmatchedDriveCancel: () => { driveActive.current = false; awaitingNeutral.current = false; viewport.current?.drive({ x: 0, y: 0, radius: 0, angle: 0, active: false, timestamp: performance.now() }); if (captureArmed.current) setCapturePaused(!heightHeld.current); }, onStateChange: snapshot => { setCanBack(snapshot.canBack); setAnyClipPlaying(Boolean(snapshot.clip)); setMovementPlaying(Boolean(snapshot.clip && snapshot.clip.connection.kind !== 'action')); }, onError: setError,
                joystick: { size: matchMobile ? 116 : 132, accentColor: props.appColor, disabled: Boolean(busy || preview || !world.approved || kind === 'action' && !hasAction), editMotionDisabled: Boolean(busy || preview || quoteOpen || boardOpen || editWorld), hasCustomMotionHint: Boolean(instruction.trim()), onEditMotion: world.approved ? () => setHelperOpen(value => !value) : undefined },
            }} />
            <Box data-spatial-top-controls sx={{ position: 'absolute', top: { xs: 68, sm: 78 }, left: { xs: 16, sm: 20 }, width: 'min(420px,calc(100% - 40px))', maxHeight: 'calc(100% - 248px)', overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'thin', overscrollBehavior: 'contain', zIndex: 42, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, width: '100%', flexShrink: 0 }}>
            <Box data-spatial-ui sx={{ position: 'relative', pointerEvents: 'auto', flexShrink: 0, width: settingsOpen ? 'calc(100% - 48px)' : { xs: 132, sm: 140 }, height: settingsOpen ? 'min(300px,45cqh)' : 40,
                borderRadius: settingsOpen ? '20px' : '999px', overflow: 'hidden', color: props.darkMode ? '#fff' : '#111',
                background: props.darkMode ? 'linear-gradient(135deg, rgba(20,24,31,.82), rgba(6,9,14,.72))' : 'linear-gradient(135deg, rgba(255,255,255,.92), rgba(235,242,250,.72))',
                backdropFilter: 'blur(20px) saturate(180%)', border: props.darkMode ? '1px solid rgba(255,255,255,.16)' : '1px solid rgba(255,255,255,.78)',
                boxShadow: props.darkMode ? '0 9px 24px rgba(0,0,0,.32), inset 0 1px 0 rgba(255,255,255,.08)' : '0 9px 24px rgba(31,38,135,.13), inset 0 1px 0 rgba(255,255,255,.7)',
                transition: 'width 180ms ease, height 220ms ease, border-radius 180ms ease' }}>
                <Button startIcon={<TuneIcon sx={{ fontSize: 18 }} />} aria-label="Spatial mode settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(value => !value)} sx={{ ...neutralPill, width: '100%', height: 40, minWidth: 0, px: 1.35, justifyContent: 'flex-start', '& .MuiButton-startIcon': { mr: .8 } }}>Settings</Button>
                <Box sx={{ display: settingsOpen ? 'block' : 'none', mx: 1.15, pt: .8, pb: 1, height: 'calc(100% - 40px)', boxSizing: 'border-box', overflowY: 'auto', scrollbarWidth: 'thin', overscrollBehavior: 'contain', borderTop: props.darkMode ? '1px solid rgba(255,255,255,.12)' : '1px solid rgba(0,0,0,.08)' }}>
                {!Object.keys(ledger!.routes).length && <Button fullWidth size="small" sx={{ ...pill, mb: 1 }} disabled={Boolean(busy)} onClick={() => void spatialOperation(session, 'view', { boardOpen: true }).catch(e => setError(e.message))}>Generation Board</Button>}
                <Typography sx={{ fontSize: '.68rem', fontWeight: 850, letterSpacing: '.05em' }}>SPATIAL OPTIONS</Typography>
                <TextField select size="small" label="Movement speed" value={speedMultiplier} disabled={Boolean(motionArmed || draft || busy)} onChange={event => setSpeedMultiplier(Number(event.target.value))} sx={{ mt: 1, width: '100%' }}>{[.25, .5, 1, 1.5, 2, 3].map(speed => <MenuItem key={speed} value={speed}>{speed}×</MenuItem>)}</TextField>
                <TextField select size="small" label="Move slot" value={configuredMove} disabled={Boolean(busy)} onChange={event => setConfiguredMove(event.target.value as 'roll' | 'jump' | 'crouch')} sx={{ mt: 1, width: '100%' }}>
                    {(['roll', 'jump', 'crouch'] as const).map(move => <MenuItem key={move} value={move}>{`${move[0].toUpperCase()}${move.slice(1)}`}</MenuItem>)}
                </TextField>
                <Typography sx={{ mt: .25, fontSize: '.67rem', opacity: .6 }}>{scene.connections.filter(connection => connection.kind !== 'action').length} movements · {scene.connections.filter(connection => connection.kind === 'action').length} actions · {scene.connections.length}/{MAX_SPATIAL_CONNECTIONS_PER_SCENE}</Typography>
                <Box sx={{ mt: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(104px,1fr))', gap: 1, height: 144, alignContent: 'start', overflowY: 'auto', p: .5, scrollbarWidth: 'thin' }}>
                    {scene.nodes.map((node, nodeIndex) => <Button key={node.id} onClick={() => player.current?.jump(node.id)}
                        disabled={Boolean(busy || preview || draft || pending.forward || !world.approved || kind === 'action' && !hasAction)}
                        aria-label={`Go to ${node.label || `Stage ${nodeIndex + 1}`}`} aria-pressed={node.id === scene.activeNodeId} title={node.label}
                        sx={{ width: '100%', minWidth: 0, p: .5, borderRadius: 2, display: 'flex', flexDirection: 'column', gap: .75, color: props.appColor, '&:hover': { bgcolor: alpha(props.appColor, .12) } }}>
                        <Box component="img" src={node.frameUrl || world.sourceImage} alt="" sx={{ width: 96, height: 96, maxWidth: '100%', objectFit: 'cover', borderRadius: '50%', boxSizing: 'border-box', border: node.id === scene.activeNodeId ? `2px solid ${props.appColor}` : '1px solid rgba(255,255,255,.38)' }} />
                        <Typography component="span" sx={{ width: '100%', fontSize: '.72rem', fontWeight: 850, lineHeight: 1.3, overflowWrap: 'anywhere', textAlign: 'center' }}>{node.label || (nodeIndex === 0 ? 'Start' : `Stage ${nodeIndex}`)}</Typography>
                    </Button>)}
                </Box>
                <Typography aria-live="polite" sx={{ mt: .45, fontSize: '.65rem', opacity: .72 }}>Active: {scene.nodes.find(node => node.id === scene.activeNodeId)?.label || 'Start'}</Typography>
                <Box sx={{ mt: 1, display: 'grid', gap: 1 }}>
                <Button size="small" sx={glass} onClick={() => setView(ledger!.view === 'three' ? 'video' : 'three')}>{ledger!.view === 'three' ? 'Three.js' : 'AI Video'}</Button>
                {!locked && activeActionResult && <Button size="small" sx={glass} disabled={Boolean(busy || draft)} onClick={() => { setImageNodeId(scene.activeNodeId); setImageInstruction(''); setImageQuote(undefined); }}>Edit action image</Button>}
                {world.approved && baseWorldEditable(ledger!, scene.connections.length) && <Button size="small" sx={glass} onClick={() => setEditWorld(v => !v)}>Edit scene</Button>}
                </Box>
                <Typography sx={{ mt: 1.25, fontSize: '.68rem', fontWeight: 850, letterSpacing: '.05em' }}>STAGE & MOTION PRESETS</Typography>
                <ScenePresetLibraryControls library={presetLibrary} />
                    {authoringDraft && <SceneActionPresets draft={authoringDraft} library={presetLibrary} onChange={applyStudioDraft} disabled={Boolean(busy || locked || anyClipPlaying)} />}
                {session.authoring.inputs.presetUndo && <Button size="small" onClick={() => void run('Restoring previous stage…', async () => { await save(session.authoring.inputs.presetUndo); delete session.authoring.inputs.presetUndo; })}>Undo stage replacement</Button>}
                <Box sx={{ mt: .6, display: 'flex', flexWrap: 'wrap', gap: .6 }}>
                    <Button size="small" sx={{ ...alternatePill, px: 1, py: .25, minHeight: 28, fontSize: '.68rem' }} onClick={() => {
                        try {
                            const preset = extractStagePreset(
                                world,
                                bindWorldRigs(world.plan),
                                {
                                    presetId: `stage_${Date.now()}_${stagePresets.length + 1}`,
                                    title: `Stage Preset #${stagePresets.length + 1}`,
                                    description: `Saved stage with ${scene.nodes.length} node(s)`,
                                },
                                { nodes: scene.nodes, connections: scene.connections, routes: ledger!.routes, states: ledger!.states, authoring: scene.activeNodeId === scene.nodes[0]?.id ? authoringDraft : nodeHistories.current.get(`${scene.sceneId}:${scene.nodes[0]?.id}:${baseWorld?.revision || ''}`)?.current || baseWorld?.authoring },
                            );
                            void presetLibrary.save(preset).catch(error => setError(error?.response?.data?.message || error.message));
                        } catch (err) { setError((err as Error).message); }
                    }}>+ Save Stage Preset</Button>
                    {!locked && stagePresets.map(sp => <Button key={sp.presetId} size="small" sx={{ ...neutralPill, px: .9, py: .2, minHeight: 26, fontSize: '.67rem' }} onClick={() => void run('Applying saved stage preset…', async () => {
                        session.authoring.inputs.presetUndo = cloneWorld(scene);
                        await save(applySavedStagePreset(scene, sp));
                    })}>Apply: {sp.title}</Button>)}
                </Box>
                </Box>
            </Box>

            </Box>
            <Box data-spatial-ui sx={{ position: 'relative', flexShrink: 0, maxWidth: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, '& > *': { pointerEvents: 'auto' } }}>
                {!world.approved && <>
                    {world.controlSelectionRequired && <TextField select size="small" label="Who do you control?" value="" sx={{ ...glass, width: 'min(260px,100%)' }} disabled={Boolean(busy)} onChange={e => void selectControlledSubject(e.target.value)}>
                        <MenuItem value="" disabled>Choose the driven subject</MenuItem>
                        {world.plan.objects.map(object => <MenuItem key={object.id} value={object.id}>{object.id.replace(/[_-]/g, ' ')}</MenuItem>)}
                    </TextField>}
                    <Box data-spatial-scene-review sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, maxWidth: '100%' }}>
                        <Button sx={neutralPill} disabled={Boolean(busy)} onClick={() => setView(ledger!.view === 'three' ? 'video' : 'three')}>{ledger!.view === 'three' ? 'Compare source image' : 'Show 3D scene'}</Button>
                        <Button sx={pill} disabled={Boolean(busy || world.controlSelectionRequired)} onClick={() => void run('Approving scene…', async () => { const next = cloneWorld(scene); next.ledger!.world = { ...world, approved: true }; await save(next); clearInstruction(); })}>Approve scene</Button>
                        {baseWorldEditable(ledger!, scene.connections.length) && <Button sx={pill} disabled={Boolean(busy)} onClick={() => setEditWorld(true)}>Edit scene</Button>}
                    </Box>
                    {baseWorldEditable(ledger!, scene.connections.length) && <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, maxWidth: '100%' }}>
                        <Button sx={pill} disabled={Boolean(busy)} onClick={reconstruct}>{session.authoring.inputs.pendingWorld ? 'Retry saving scene · no new AI call' : 'Rebuild scene · Metered P'}</Button>
                        <Button sx={pill} disabled={Boolean(busy)} onClick={rejectScene}>Reject scene</Button>
                    </Box>}
                </>}
                {!!Object.keys(ledger!.routes).length && !boardOpen && <Button sx={neutralPill} startIcon={<VideocamIcon />} disabled={Boolean(busy)} onClick={() => void spatialOperation(session, 'view', { boardOpen: true }).catch(e => setError(e.message))}>Motion videos</Button>}
                {world.approved && ledger!.view === 'video' && !boardOpen && !ledger!.jobs.some(spatialJobIsActive) && <Button sx={neutralPill} startIcon={<EditIcon />} disabled={Boolean(busy)} onClick={continueMapping}>Continue mapping</Button>}
                {world.approved && !busy && <>
                    {draft && kind !== 'action' && <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{!pending.forward && <Button sx={pill} disabled={Boolean(preview)} onClick={() => setPreview(recordedMovementPreview(draft, world.controlledObject))}>Test recording</Button>}<Button sx={alternatePill} disabled={Boolean(preview)} onClick={() => void run('Clearing recording; keeping instructions…', async () => { const next = cloneWorld(scene); delete next.ledger!.draft; await save(next); delete session.authoring.inputs.pendingMotion; delete session.authoring.inputs.pendingMotionPrompt; setDraft(null); setPending({}); viewport.current?.reset(); armCapture(); })}>Record again</Button></Box>}
                    {draft && kind !== 'action' && (!pending.forward || !pending.backward || motionChanged) && <Button sx={pill} disabled={Boolean(preview)} onClick={() => void processMotion()}>{motionChanged ? 'Rebuild movement · Metered P' : pending.forward ? 'Plan return · Metered P' : 'Process movement · Metered P'}</Button>}
                    {pending.forward && <>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Button sx={pill} disabled={Boolean(preview)} onClick={() => { if (ledger!.view !== 'three') setView('three'); setPreview(pending.forward!.plan); }}>Preview {kind === 'action' ? 'action' : 'forward'}</Button>
                            {pending.backward && <Button sx={pill} disabled={Boolean(preview)} onClick={() => { if (ledger!.view !== 'three') setView('three'); setPreview(pending.backward!.plan); }}>Preview return</Button>}
                            <Button sx={pill} disabled={Boolean(preview || motionChanged || kind === 'movement' && !pending.backward)} onClick={() => void saveMotion()}>Save {kind === 'action' ? 'action' : 'motion'}</Button>
                            <Button sx={alternatePill} disabled={Boolean(preview)} onClick={() => void processMotion(true)}>Try again · Metered P</Button>
                        </Box>
                    </>}
                    {!draft && !pending.forward && kind !== 'action' && ledger!.view === 'three' && <Button sx={pill} disabled={imageReviewPending || motionArmed} onClick={armCapture}>{motionArmed ? 'Move the controller to record' : 'Add motion'}</Button>}
                    {motionArmed && <Button sx={round} aria-label="Cancel recording" onClick={discardCapture}>Cancel</Button>}
                    {motionArmed && captureRemaining !== null && <Button sx={pill} onClick={() => finishRecording(viewport.current?.finish() || null)}>Finish recording</Button>}
                    {!draft && !pending.forward && !motionArmed && kind !== 'action' && scene.connections.length > 0 && <Button sx={pill} disabled={imageReviewPending} onClick={() => finishMapping()}>Finish mapping</Button>}
                </>}
                {kind === 'action' && !hasAction && <Button sx={neutralPill} startIcon={<CloseIcon />} disabled={Boolean(busy)} onClick={cancelAction}>Cancel action</Button>}
                {kind === 'action' && !hasAction && <Button sx={neutralPill} startIcon={<TuneIcon />} aria-expanded={actionSettingsOpen} disabled={Boolean(busy)} onClick={() => setActionSettingsOpen(value => !value)}>Action settings</Button>}
                {busy && !editWorld && status}
                {!!referenceStatus.pending && <Box role="status" sx={{ ...glass, p: 1, width: 240, maxWidth: '100%' }}><Typography variant="body2">{referenceStatus.message}</Typography><LinearProgress sx={{ my: .5 }} /></Box>}
                {Boolean(referenceStatus.error) && <Alert severity="error">{spatialErrorMessage(referenceStatus.error)} Use Finish mapping to retry preparing the motion assets.</Alert>}
                {captureRemaining !== null && <Typography role="status" sx={{ ...glass, px: 1, py: .5, fontSize: '.75rem' }}>{capturePaused ? 'Mapping paused' : 'Recording'} · {captureRemaining.toFixed(1)}s left</Typography>}
                {preview && <Typography role="status" sx={{ ...glass, px: 1, py: .5, fontSize: '.75rem' }}>Playing preview · {preview.duration}s</Typography>}
                {error && notice(error, () => setError(''))}
                <Box sx={{ display: motionArmed || captureRemaining !== null ? 'none' : 'flex', flexWrap: 'wrap', gap: .8 }}>
                    <IconButton sx={round} aria-label="Open spatial movement map" onClick={() => { setSettingsOpen(false); setMapOpen(value => !value); }}><TimelineIcon /></IconButton>
                    <IconButton sx={round} aria-label="Back to previous node" disabled={!canBack || Boolean(busy || draft)} onClick={() => player.current?.back()}><ArrowBackIcon /></IconButton>
                    <IconButton sx={round} aria-label="Home" disabled={Boolean(busy || draft)} onClick={() => player.current?.home()}><HomeIcon /></IconButton>
                    <IconButton sx={{ ...round, color: props.appColor }} aria-label={ledger!.view === 'three' ? 'Switch to AI video view' : 'Switch to Three.js view'} title={ledger!.view === 'three' ? 'Show AI video / scene image' : 'Show Three.js'} disabled={Boolean(busy || preview)} onClick={() => setView(ledger!.view === 'three' ? 'video' : 'three')}>{ledger!.view === 'three' ? <VideocamIcon /> : <ViewInArIcon />}</IconButton>
                    {world.approved && ledger!.view === 'three' && <IconButton sx={{ ...round, ...(studioToolsOpen ? { bgcolor: props.appColor, color: props.darkMode ? '#111' : '#fff' } : {}) }} aria-label="Toggle 3D studio tools" aria-pressed={studioToolsOpen} title="Direct 3D studio tools" disabled={Boolean(busy || preview)} onClick={() => setStudioToolsOpen(value => !value)}><EditIcon /></IconButton>}
                </Box>
                {studioToolsOpen && world.approved && ledger!.view === 'three' && (() => {
                    const activeHist = getNodeHistory();
                    const currentDraft = activeHist?.current;
                    if (!activeHist || !currentDraft) return null;
                    const selectedObjId = selection?.objectId || world.controlledObject;
                    const selectedObj = world.plan.objects.find(o => o.id === selectedObjId);
                    return <Box data-spatial-studio-bar sx={{ ...glass, p: 1, borderRadius: 3, width: 'min(360px,calc(100vw - 48px))', display: 'flex', flexDirection: 'column', gap: .75 }}>
                        <Box sx={{ display: 'flex', gap: .6, flexWrap: 'wrap', alignItems: 'center' }}>
                            <TextField select size="small" label="Entity" value={selectedObjId} onChange={event => setSelection({ objectId: event.target.value })} sx={{ flex: '1 1 110px', minWidth: 100 }}>
                                {world.plan.objects.map(object => <MenuItem key={object.id} value={object.id}>{object.id}</MenuItem>)}
                            </TextField>
                            <TextField select size="small" label="Part" value={selection?.partId || ''} onChange={event => setSelection({ objectId: selectedObjId, ...(event.target.value ? { partId: event.target.value } : {}) })} sx={{ flex: '1 1 92px', minWidth: 84 }}>
                                <MenuItem value="">root</MenuItem>
                                {(selectedObj?.parts || []).map(part => <MenuItem key={part.id} value={part.id}>{part.id}</MenuItem>)}
                            </TextField>
                            <IconButton size="small" aria-label="Undo 3D edit" disabled={!activeHist.canUndo} onClick={() => applyStudioDraft(activeHist.undo())}><UndoIcon fontSize="small" /></IconButton>
                            <IconButton size="small" aria-label="Redo 3D edit" disabled={!activeHist.canRedo} onClick={() => applyStudioDraft(activeHist.redo())}><RotateRightIcon fontSize="small" /></IconButton>
                        </Box>
                        <Box sx={{ display: 'flex', gap: .5, flexWrap: 'wrap' }}>
                            {(['translate', 'rotate', 'scale'] as const).map(mode => <Button key={mode} size="small" aria-pressed={gizmoMode === mode} onClick={() => setGizmoMode(mode)} sx={{ ...neutralPill, px: 1, py: .25, minHeight: 28, fontSize: '.7rem', ...(gizmoMode === mode ? { bgcolor: props.appColor, color: props.darkMode ? '#111' : '#fff' } : {}) }}>{mode === 'translate' ? 'Move' : mode === 'rotate' ? 'Rotate' : 'Scale'}</Button>)}
                            <Button size="small" onClick={() => viewport.current?.triggerMove?.(configuredMove)} sx={{ ...pill, px: 1, py: .25, minHeight: 28, fontSize: '.7rem' }}>{`Do ${configuredMove}`}</Button>
                            <Button size="small" aria-pressed={currentDraft.locomotion.includes(selectedObjId)} onClick={() => commitStudioCommands([{ kind: 'locomotion', objectId: selectedObjId, enabled: !currentDraft.locomotion.includes(selectedObjId) }])} sx={{ ...neutralPill, px: 1, py: .25, minHeight: 28, fontSize: '.7rem', ...(currentDraft.locomotion.includes(selectedObjId) ? { bgcolor: alpha(props.appColor, .22) } : {}) }}>{currentDraft.locomotion.includes(selectedObjId) ? 'Gait: On' : 'Gait: Off'}</Button>
                            {selection && <Button size="small" onClick={() => {
                                const pinned = currentDraft.locks.some(lock => lock.objectId === selection.objectId && (lock.partId || '') === (selection.partId || ''));
                                commitStudioCommands([pinned
                                    ? { kind: 'unlock', target: selection, time: 0 }
                                    : { kind: 'lock', target: selection, time: 0, end: currentDraft.plan.duration, channels: ['position', 'rotation', 'scale'] }]);
                            }} sx={{ ...neutralPill, px: 1, py: .25, minHeight: 28, fontSize: '.7rem' }}>{currentDraft.locks.some(lock => lock.objectId === selection.objectId && (lock.partId || '') === (selection.partId || '')) ? 'Unpin' : 'Pin'}</Button>}
                            {selection && selection.objectId !== world.controlledObject && <Button size="small" onClick={() => {
                                const attached = currentDraft.plan.objects.find(o => o.id === selection.objectId)?.attachment;
                                commitStudioCommands([{
                                    kind: 'event',
                                    event: attached
                                        ? { id: `detach_${selection.objectId}_${currentDraft.revision + 1}`, kind: 'detach', objectId: selection.objectId, time: 0 }
                                        : { id: `attach_${selection.objectId}_${currentDraft.revision + 1}`, kind: 'attach', objectId: selection.objectId, time: 0, parent: { objectId: world.controlledObject }, relation: 'holds', localPose: prototypeUnitPose([0, .1, .2]) },
                                }]);
                            }} sx={{ ...neutralPill, px: 1, py: .25, minHeight: 28, fontSize: '.7rem' }}>Attach / Drop</Button>}
                        </Box>
                        <Box sx={{ display: 'flex', gap: .6, flexWrap: 'wrap' }}>
                            <TextField select size="small" label="Camera rig" value={currentDraft.cameraRig?.kind || 'free'} onChange={event => {
                                const rigKind = event.target.value as SceneCameraRig['kind'];
                                const focalLengthMm = currentDraft.cameraRig?.focalLengthMm || 35;
                                const nextRig: SceneCameraRig = rigKind === 'free'
                                    ? { kind: 'free', focalLengthMm }
                                    : rigKind === 'orbit'
                                        ? { kind: 'orbit', target: { objectId: selectedObjId }, focalLengthMm, radius: 5, height: 1.5, turns: 1 }
                                        : rigKind === 'overhead'
                                            ? { kind: 'overhead', target: { objectId: selectedObjId }, focalLengthMm, height: 7, heading: 0 }
                                            : rigKind === 'zolly'
                                                ? { kind: 'zolly', target: { objectId: selectedObjId }, focalLengthMm, startDistance: 4, endDistance: 10, height: 0 }
                                                : rigKind === 'crash'
                                                    ? { kind: 'crash', target: { objectId: selectedObjId }, focalLengthMm: 24, endFocalLengthMm: 135, startTime: 0, zoomDuration: .35 }
                                                    : { kind: 'mounted', target: { objectId: selectedObjId }, focalLengthMm, offset: [0, .2, 1.5], lookOffset: [0, .15, 0] };
                                commitStudioCommands([{ kind: 'cameraRig', rig: nextRig }]);
                            }} sx={{ flex: '1 1 112px', minWidth: 104 }}>
                                {(['free', 'orbit', 'mounted', 'overhead', 'zolly', 'crash'] as const).map(mode => <MenuItem key={mode} value={mode}>{mode}</MenuItem>)}
                            </TextField>
                            <TextField select size="small" label="Lens" value={currentDraft.cameraRig?.focalLengthMm || 35} onChange={event => {
                                const focalLengthMm = Number(event.target.value);
                                const existing = currentDraft.cameraRig || { kind: 'free' as const, focalLengthMm };
                                commitStudioCommands([{ kind: 'cameraRig', rig: { ...existing, focalLengthMm } }]);
                            }} sx={{ flex: '1 1 86px', minWidth: 80 }}>
                                {LENS_PRESETS_MM.map(mm => <MenuItem key={mm} value={mm}>{mm}mm</MenuItem>)}
                            </TextField>
                        </Box>
                        {currentDraft.cameraRig && <Typography sx={{ fontSize: '.64rem', opacity: .75 }}>{describeSceneCamera(currentDraft.cameraRig)}</Typography>}
                        {(() => {
                            const activeRig: SceneCameraRig = currentDraft.cameraRig || { kind: 'free', focalLengthMm: 35 };
                            const nudgeFreeCamera = (dPos: [number, number, number], dTarget: [number, number, number] = [0, 0, 0], dRoll?: number) => {
                                const curOffset = activeRig.offset || [0, 0, 0];
                                const curTarget = activeRig.targetOffset || [0, 0, 0];
                                const nextOffset: [number, number, number] = [
                                    Number((curOffset[0] + dPos[0]).toFixed(2)),
                                    Number((curOffset[1] + dPos[1]).toFixed(2)),
                                    Number((curOffset[2] + dPos[2]).toFixed(2)),
                                ];
                                const nextTarget: [number, number, number] = [
                                    Number((curTarget[0] + dTarget[0]).toFixed(2)),
                                    Number((curTarget[1] + dTarget[1]).toFixed(2)),
                                    Number((curTarget[2] + dTarget[2]).toFixed(2)),
                                ];
                                const nextRoll = dRoll === 0 ? 0 : dRoll !== undefined ? Number(((activeRig.roll || 0) + dRoll).toFixed(3)) : activeRig.roll;
                                if (activeRig.kind === 'orbit' && dPos[2] !== 0) {
                                    commitStudioCommands([{ kind: 'cameraRig', rig: { ...activeRig, radius: Math.max(1.2, Number((activeRig.radius + dPos[2]).toFixed(2))), height: Number((activeRig.height + dPos[1]).toFixed(2)), targetOffset: nextTarget, ...(nextRoll !== undefined ? { roll: nextRoll } : {}) } }]);
                                    return;
                                }
                                if (activeRig.kind === 'overhead' && dPos[1] !== 0) {
                                    commitStudioCommands([{ kind: 'cameraRig', rig: { ...activeRig, height: Math.max(1.5, Number((activeRig.height + dPos[1]).toFixed(2))), targetOffset: nextTarget, ...(nextRoll !== undefined ? { roll: nextRoll } : {}) } }]);
                                    return;
                                }
                                commitStudioCommands([{ kind: 'cameraRig', rig: { ...activeRig, offset: nextOffset, targetOffset: nextTarget, ...(nextRoll !== undefined ? { roll: nextRoll } : {}) } }]);
                            };
                            const activeLight = currentDraft.lightingRig || defaultLightingRigForPreset('studio');
                            return <>
                                <Box sx={{ display: 'flex', gap: .4, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <Typography sx={{ fontSize: '.64rem', fontWeight: 700, opacity: .78, mr: .3 }}>Cam manual:</Typography>
                                    <Button size="small" onClick={() => nudgeFreeCamera([0, 0, -.6])} sx={{ ...neutralPill, px: .7, py: .15, minHeight: 24, fontSize: '.64rem' }}>Dolly In</Button>
                                    <Button size="small" onClick={() => nudgeFreeCamera([0, 0, .6])} sx={{ ...neutralPill, px: .7, py: .15, minHeight: 24, fontSize: '.64rem' }}>Dolly Out</Button>
                                    <Button size="small" onClick={() => nudgeFreeCamera([-.45, 0, 0], [-.45, 0, 0])} sx={{ ...neutralPill, px: .7, py: .15, minHeight: 24, fontSize: '.64rem' }}>Truck L</Button>
                                    <Button size="small" onClick={() => nudgeFreeCamera([.45, 0, 0], [.45, 0, 0])} sx={{ ...neutralPill, px: .7, py: .15, minHeight: 24, fontSize: '.64rem' }}>Truck R</Button>
                                    <Button size="small" onClick={() => nudgeFreeCamera([0, .35, 0], [0, .15, 0])} sx={{ ...neutralPill, px: .7, py: .15, minHeight: 24, fontSize: '.64rem' }}>Cam Up</Button>
                                    <Button size="small" onClick={() => nudgeFreeCamera([0, -.35, 0], [0, -.15, 0])} sx={{ ...neutralPill, px: .7, py: .15, minHeight: 24, fontSize: '.64rem' }}>Cam Down</Button>
                                    <Button size="small" onClick={() => nudgeFreeCamera([0, 0, 0], [0, .3, 0])} sx={{ ...neutralPill, px: .7, py: .15, minHeight: 24, fontSize: '.64rem' }}>Tilt +</Button>
                                    <Button size="small" onClick={() => nudgeFreeCamera([0, 0, 0], [0, -.3, 0])} sx={{ ...neutralPill, px: .7, py: .15, minHeight: 24, fontSize: '.64rem' }}>Tilt -</Button>
                                    <Button size="small" onClick={() => nudgeFreeCamera([0, 0, 0], [0, 0, 0], -.175)} sx={{ ...neutralPill, px: .7, py: .15, minHeight: 24, fontSize: '.64rem' }}>Roll -10°</Button>
                                    <Button size="small" onClick={() => nudgeFreeCamera([0, 0, 0], [0, 0, 0], .175)} sx={{ ...neutralPill, px: .7, py: .15, minHeight: 24, fontSize: '.64rem' }}>Roll +10°</Button>
                                    <Button size="small" onClick={() => commitStudioCommands([{ kind: 'cameraRig', rig: { kind: 'free', focalLengthMm: activeRig.focalLengthMm } }])} sx={{ ...neutralPill, px: .7, py: .15, minHeight: 24, fontSize: '.64rem' }}>Reset Cam</Button>
                                </Box>
                                <Box sx={{ display: 'flex', gap: .6, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <TextField select size="small" label="Lighting" value={activeLight.preset} onChange={event => {
                                        const preset = event.target.value as SceneLightingPreset;
                                        commitStudioCommands([{ kind: 'lightingRig', lighting: defaultLightingRigForPreset(preset) }]);
                                    }} sx={{ flex: '1 1 112px', minWidth: 104 }}>
                                        {LIGHTING_PRESETS.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                                    </TextField>
                                    <TextField select size="small" label="Key angle" value={Math.round(activeLight.azimuthDeg)} onChange={event => {
                                        commitStudioCommands([{ kind: 'lightingRig', lighting: { ...activeLight, azimuthDeg: Number(event.target.value) } }]);
                                    }} sx={{ flex: '1 1 88px', minWidth: 82 }}>
                                        {([-90, -55, -34, 0, 40, 65, 90, 165] as const).map(deg => <MenuItem key={deg} value={deg}>{deg}°</MenuItem>)}
                                    </TextField>
                                    <TextField select size="small" label="Sun height" value={Math.round(activeLight.elevationDeg)} onChange={event => {
                                        commitStudioCommands([{ kind: 'lightingRig', lighting: { ...activeLight, elevationDeg: Number(event.target.value) } }]);
                                    }} sx={{ flex: '1 1 84px', minWidth: 78 }}>
                                        {([22, 35, 48, 65, 78] as const).map(deg => <MenuItem key={deg} value={deg}>{deg}°</MenuItem>)}
                                    </TextField>
                                </Box>
                                {currentDraft.lightingRig && <Typography sx={{ fontSize: '.64rem', opacity: .75 }}>{describeSceneLighting(currentDraft.lightingRig)}</Typography>}
                            </>;
                        })()}
                        <Box sx={{ display: 'flex', gap: .5, alignItems: 'center' }}>
                            <TextField size="small" fullWidth placeholder="Quick 3D assist (e.g. wave, jump, zolly)" value={assistInput} onChange={event => setAssistInput(event.target.value)} />
                            <Button size="small" sx={{ ...pill, px: 1.1, minHeight: 32, flexShrink: 0 }} disabled={!assistInput.trim()} onClick={() => {
                                try {
                                    const participants = Array.from(new Set([selectedObjId, world.controlledObject]));
                                    const baseDraft = currentDraft;
                                    void run('AI is refining the scene…', async () => {
                                        const result = await acceptLiveResult(liveClient.run('/motion-guide/build', { prompt: props.prompt || 'Refine the selected scene', previousPlan: baseDraft.plan, authoringContext: baseDraft, duration: baseDraft.plan.duration, aspectRatio: aspect, llmTier: tier, editInstruction: assistInput, assistParticipants: participants, pinnedObjectIds: baseDraft.locks.map(lock => lock.objectId), visualCheckpoints: true, liveNewBuild: true }));
                                        if (liveOwner.current !== liveClient) return;
                                        applyLlmBilling(props.dispatch, result);
                                        const next = adoptLiveAuthoringResult(baseDraft, result, liveClient.snapshot().pinned);
                                        activeHist.adopt(next); applyStudioDraft(next);
                                    });
                                    setAssistInput('');
                                } catch (err) {
                                    setError((err as Error).message);
                                }
                            }}>Assist</Button>
                        </Box>
                        <Box sx={{ display: 'flex', gap: .5, flexWrap: 'wrap' }}>
                            {privatePresets.map(preset => <Button key={preset.presetId} size="small" onClick={() => {
                                try {
                                    const applied = applyMotionPreset(currentDraft, preset, selectedObjId, 0);
                                    activeHist.adopt(applied.draft);
                                    applyStudioDraft(applied.draft);
                                } catch (err) {
                                    setError((err as Error).message);
                                }
                            }} sx={{ ...neutralPill, px: .9, py: .2, minHeight: 26, fontSize: '.68rem' }}>{preset.title}</Button>)}
                            <Button size="small" onClick={() => {
                                try {
                                    const saved = extractMotionNodePreset(currentDraft, selectedObjId, {
                                        presetId: `custom_${selectedObjId}_${privatePresets.length + 1}`,
                                        title: `Saved ${selectedObjId.slice(0, 8)} #${privatePresets.length + 1}`,
                                        description: 'User saved motion preset',
                                    });
                                    void presetLibrary.save(saved).catch(error => setError(error?.response?.data?.message || error.message));
                                } catch (err) {
                                    setError((err as Error).message);
                                }
                            }} sx={{ ...alternatePill, px: .9, py: .2, minHeight: 26, fontSize: '.68rem' }}>+ Save preset</Button>
                        </Box>
                    </Box>;
                })()}
                {kind === 'action' && !hasAction && !draft && !pending.forward && <>
                    <Box sx={{ display: 'flex', gap: 1 }}><Button sx={neutralPill} startIcon={<LinkIcon />} onClick={() => setNavigationPicker('link')}>Link</Button><Button sx={neutralPill} startIcon={<UndoIcon />} onClick={() => setNavigationPicker('backtrack')}>Backtrack</Button></Box>
                    {props.allowAudioReferences !== false && <Button sx={pill} disabled={Boolean(busy)} onClick={() => setAudioDialog('draft')}>{draftAudio?.enabled ? 'Using Audio' : 'Audio reference'}</Button>}
                    <Button sx={neutralPill} aria-pressed={hold} onClick={() => setHold(value => !value)}>Hold to play · {hold ? 'On' : 'Off'}</Button>
                </>}
            </Box>
            </Box>
            {kind === 'action' && !hasAction && actionSettingsOpen && <Box data-spatial-ui role="dialog" aria-label="Action settings" sx={{ ...glass, boxSizing: 'border-box', position: 'absolute', left: { xs: 16, sm: 20 }, bottom: 'min(160px,30%)', zIndex: 44, p: 1.5, width: 'min(380px,calc(100% - 40px))', maxHeight: '60%', overflow: 'auto', overscrollBehavior: 'contain' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}><Typography variant="subtitle2">Action settings</Typography><IconButton aria-label="Close action settings" disabled={Boolean(busy)} onClick={() => setActionSettingsOpen(false)}><CloseIcon /></IconButton></Box>
                <PlanningModelSelector value={tier} onChange={setTier} appColor={props.appColor} disabled={Boolean(busy) || liveClient.snapshot().phase !== 'idle'} />
                <TextField fullWidth multiline minRows={2} maxRows={5} label={pending.forward ? 'Action correction' : 'Action instructions'} placeholder={pending.forward ? 'Describe what to change; the rest of the action stays.' : 'Describe the performance, dialogue and movement.'} value={pending.forward ? actionCorrection : actionCreationPrompt} onChange={event => pending.forward ? setActionCorrection(event.target.value) : setActionCreationPrompt(event.target.value)} disabled={Boolean(busy)} sx={{ my: 1.5 }} />
                {pending.forward && <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>Changes apply to this unsaved 3D action. Preview the revised action before saving.</Typography>}
                {busy && status}
                {error && notice(error, () => setError(''))}
                <Button fullWidth sx={pill} disabled={Boolean(busy || preview) || !(pending.forward ? actionCorrection.trim() : actionCreationPrompt.trim())} onClick={() => void processMotion(Boolean(pending.forward), pending.forward ? actionCorrection.trim() : undefined)}>{pending.forward ? 'Apply changes' : 'Create action'} · Metered P</Button>
            </Box>}
            {kind !== 'action' && ledger!.view === 'three' && world.approved && helperOpen && <Box data-spatial-ui role="dialog" aria-label="Motion instructions" sx={{ ...glass, boxSizing: 'border-box', position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: 'min(180px,35%)', zIndex: 43, p: 1.5, width: 'min(380px,90%)', maxHeight: '50%', overflow: 'auto', overscrollBehavior: 'contain' }}>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', position: 'sticky', top: 0, zIndex: 1 }}><Button sx={pill} onClick={() => { setHelperOpen(false); if (draft && !busy) void run('Saving motion instructions…', async () => { await retainMotion(draft, pending); }); }}>{instruction.trim() ? 'Use' : "Don't use"}</Button></Box>
                <PlanningModelSelector value={tier} onChange={setTier} appColor={props.appColor} disabled={Boolean(busy) || liveClient.snapshot().phase !== 'idle'} />
                <TextField select size="small" fullWidth label="Author" value={kind} disabled={Boolean(busy || pending.forward)} onChange={e => { setKind(e.target.value as any); setPending({}); }}>
                    <MenuItem value="movement">Movement</MenuItem><MenuItem value="action">Action</MenuItem>
                </TextField>
                <TextField inputRef={instructionInput} size="small" fullWidth multiline minRows={2} label="Context / edit this motion" value={instruction} disabled={Boolean(busy)} onChange={e => setInstruction(e.target.value)} sx={{ my: 1 }} />
                <Box data-spatial-motion-assets sx={{ display: 'flex', gap: 1, overflowX: 'auto', overscrollBehaviorX: 'contain', pb: .5 }}>{(props.references || world.references || []).map(reference => {
                    const name = reference.name.replace(/[^A-Za-z0-9_]/g, '');
                    const injected = name && new RegExp(`@${name}(?![A-Za-z0-9_])`, 'i').test(instruction);
                    return <Button data-spatial-asset key={reference.name} disabled={Boolean(busy)} aria-pressed={Boolean(injected)} title={`Insert @${reference.name}`} onClick={() => { if (!name) return; setSelectedNames(names => names.includes(reference.name) ? names : [...names, reference.name]); if (!injected) setInstruction(text => `${text.trimEnd()} @${name} `.trimStart()); instructionInput.current?.focus(); }} sx={{ flex: '0 0 88px', flexDirection: 'column', minWidth: 88, p: .5, gap: .5, color: props.appColor, textTransform: 'none', border: `2px solid ${injected ? props.appColor : '#fff'}`, borderRadius: 999, bgcolor: injected ? alpha(props.appColor, .12) : 'transparent' }}><Box component="img" src={reference.imageUrl} alt="" sx={{ width: 80, height: 80, boxSizing: 'border-box', borderRadius: '50%', objectFit: 'cover', border: `3px solid ${injected ? props.appColor : '#fff'}` }} /><Typography sx={{ fontSize: '.72rem', lineHeight: 1.3, width: '100%', overflowWrap: 'anywhere' }}>{reference.name}</Typography></Button>;
                })}</Box>
            </Box>}
            {navigationPicker && <Box data-spatial-ui sx={{ ...glass, position: 'absolute', top: 'min(260px,30%)', left: 20, zIndex: 44, p: 2, width: 'min(300px,calc(100% - 40px))', boxSizing: 'border-box', maxHeight: 'calc(70% - 24px)', overflowY: 'auto' }}>
                <IconButton aria-label="Close navigation picker" onClick={() => setNavigationPicker(null)}><CloseIcon /></IconButton>
                <Typography variant="subtitle2">Choose {navigationPicker === 'link' ? 'scene' : 'return destination'}</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, my: 1 }}>
                    {(navigationPicker === 'link' ? stages.filter(s => s.id !== scene.sceneId).map(s => ({ value: s.id, label: s.label, frame: s.scene.nodes[0]?.frameUrl })) : scene.nodes.filter(n => n.id !== scene.activeNodeId).map(n => ({ value: `node:${n.id}`, label: n.label, frame: n.frameUrl }))).map(destination => <Button key={destination.value} disabled={Boolean(busy)} aria-pressed={link === destination.value} onClick={() => setLink(destination.value)} sx={{ flexDirection: 'column', gap: .5, textTransform: 'none', color: 'inherit', bgcolor: link === destination.value ? alpha(props.appColor, .15) : 'transparent' }}>
                        <Box component="img" src={destination.frame} alt="" sx={{ width: 76, height: 76, objectFit: 'cover', borderRadius: '50%', border: `2px solid ${props.appColor}` }} />{destination.label}
                    </Button>)}
                </Box>
                {link && <Button onClick={() => void run('Saving navigation…', async () => {
                    if (scene.connections.some(edge => edge.sourceNodeId === scene.activeNodeId && edge.kind === 'action')) throw new Error('This node already has an action. Link from its result node instead.');
                    const next = cloneWorld(scene), node = next.nodes.find(n => n.id === scene.activeNodeId)!;
                    delete node.actionLink; delete node.actionBacktrack;
                    if (link.startsWith('node:')) node.actionBacktrack = { targetNodeId: link.slice(5) };
                    else node.actionLink = stages.find(s => s.id === link)!.address;
                    await save(next); disarmCapture(); setLink(''); setNavigationPicker(null); setKind('movement'); setHelperOpen(false);
                })}>Save navigation</Button>}
            </Box>}
            {ledger!.view === 'three' && !uiHidden && kind !== 'action' && !leftOverlayOpen && <Box data-spatial-ui data-spatial-author-controls sx={{
                position: 'absolute',
                left: { xs: 16, sm: 20 },
                bottom: `calc(clamp(24px, 5vh, 56px) + ${(matchMobile ? 116 : 132) / 2 - 48}px)`,
                zIndex: 41,
                display: 'flex',
                flexDirection: 'column',
                gap: .75,
                '@container (max-height: 440px)': {
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    maxWidth: 86,
                    bottom: 16,
                },
            }}>
                <Tooltip title={testingControls ? 'Testing controls · tap to reset' : 'Try controls'} placement="right"><span><IconButton
                    aria-label="Try controls" aria-pressed={testingControls} onClick={() => { const testing = !testingControls; discardCapture(); setTestingControls(testing); }}
                    disabled={!world.approved || Boolean(motionArmed || busy || preview || draft || pending.forward || movementPlaying || quoteOpen || boardOpen || editWorld)}
                    sx={{ ...round, width: 40, height: 40, ...(testingControls ? { bgcolor: props.appColor, color: props.darkMode ? '#111' : '#fff' } : {}) }}><SportsEsportsIcon /></IconButton></span></Tooltip>
                {(['horizontal', 'vertical', 'roll'] as const).map(mode => {
                    const label = mode === 'horizontal' ? 'Rotate horizontally' : mode === 'vertical' ? 'Rotate vertically' : 'Roll';
                    return <Tooltip key={mode} title={`${label} · tap again to move`} placement="right"><span><IconButton
                        aria-label={label} aria-pressed={rotationMode === mode} onClick={() => toggleRotation(mode)}
                        disabled={!world.approved || Boolean(busy || preview || draft || pending.forward || movementPlaying || quoteOpen || boardOpen || editWorld)}
                        sx={{ ...round, width: 40, height: 40, ...(rotationMode === mode ? { background: props.appColor, color: props.darkMode ? '#111' : '#fff', boxShadow: `0 0 0 3px ${alpha(props.appColor, .25)}`, '&:hover': { background: props.appColor } } : {}) }}>
                        {mode === 'horizontal' ? <SwipeIcon /> : mode === 'vertical' ? <SwipeVerticalIcon /> : <RotateRightIcon />}
                    </IconButton></span></Tooltip>;
                })}
                {([1, -1] as const).map(value => <Tooltip key={value} title={value > 0 ? 'Rise · hold' : 'Descend · hold'} placement="right"><span><IconButton
                    aria-label={value > 0 ? 'Rise' : 'Descend'} aria-pressed={heightInput === value}
                    disabled={!world.approved || Boolean(busy || preview || draft || pending.forward || movementPlaying || quoteOpen || boardOpen || editWorld)}
                    onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); heightDrive(value); }}
                    onPointerUp={() => { if (heightHeld.current === value) heightDrive(0); }} onPointerCancel={() => { if (heightHeld.current === value) heightDrive(0); }} onLostPointerCapture={() => { if (heightHeld.current === value) heightDrive(0); }}
                    onKeyDown={event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); heightDrive(value); } }} onKeyUp={() => { if (heightHeld.current === value) heightDrive(0); }} onBlur={() => { if (heightHeld.current === value) heightDrive(0); }}
                    sx={{ ...round, width: 40, height: 40, touchAction: 'none', ...(heightInput === value ? { bgcolor: props.appColor, color: props.darkMode ? '#111' : '#fff' } : {}) }}>{value > 0 ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}</IconButton></span></Tooltip>)}
            </Box>}
            {!movementPlaying && <IconButton className={hasAction ? 'spatial-interaction-button' : undefined} aria-label={actionLabel} title={actionLabel} aria-pressed={kind === 'action'} sx={{ position: 'absolute', left: `calc(75% + ${(matchMobile ? 116 : 132) / 4}px)`, bottom: `calc(clamp(24px, 5vh, 56px) + ${(matchMobile ? 116 : 132) / 2 - 24}px)`, transform: 'translateX(-50%)', zIndex: 40, width: 48, height: 48, borderRadius: '50%', color: props.darkMode ? '#111' : '#fff', bgcolor: props.darkMode ? '#fff' : '#080a10', border: `2px solid ${props.darkMode ? '#000' : '#fff'}`, '--spatial-action-border': props.darkMode ? '#000' : '#fff', boxShadow: kind === 'action' ? `0 0 0 4px ${alpha(props.appColor, .18)}, 0 10px 28px ${alpha(props.appColor, .42)}` : '0 10px 28px rgba(0,0,0,.48)', '&:hover': { bgcolor: props.darkMode ? '#fff' : '#080a10' } }}
                disabled={!world.approved || Boolean(busy || quoteOpen || boardOpen || editWorld || (kind !== 'action' || hasAction) && (preview || draft || pending.forward))}
                onPointerDown={e => { if (holdAction) { e.currentTarget.setPointerCapture(e.pointerId); player.current?.holdAction(true); } }} onPointerUp={() => player.current?.holdAction(false)} onPointerCancel={() => player.current?.holdAction(false)} onLostPointerCapture={() => player.current?.holdAction(false)}
                onKeyDown={e => { if (holdAction && [' ', 'Enter'].includes(e.key)) { e.preventDefault(); player.current?.holdAction(true); } }} onKeyUp={() => player.current?.holdAction(false)} onBlur={() => player.current?.holdAction(false)}
                onClick={() => { discardCapture(); if (hasAction) { if (!holdAction) player.current?.activate(); } else if (kind === 'action') cancelAction(); else { setKind('action'); setHelperOpen(false); setActionCreationPrompt(props.prompt); setActionCorrection(''); setActionSettingsOpen(true); } }}>{hasAction && (currentNode?.actionLink ? linkPreview?.frameUrl ? <Box component="img" src={linkPreview.frameUrl} alt={linkPreview.label} sx={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : <LinkIcon /> : scene.nodes.find(node => node.id === scene.activeNodeId)?.actionBacktrack ? <UndoIcon /> : <PlayArrowIcon />)}</IconButton>}
        </>}
        {!world && !scene.bShotIdentityConflict?.length && <>
            <Box sx={{ position: 'absolute', top: 78, left: 20, zIndex: 44, maxWidth: '85%', maxHeight: 'calc(100% - 94px)', overflowY: 'auto' }}><Button sx={pill} disabled={!loaded || Boolean(busy) || !session.authoring.inputs.pendingWorld && (Boolean(references.length) || detectedSubjects !== null) && !drivenName.trim()} onClick={reconstruct}>{session.authoring.inputs.pendingWorld ? 'Retry saving scene · no new AI call' : !references.length && detectedSubjects === null ? 'Identify subjects' : 'Build scene · Metered P'}</Button>{ledger?.world.reviewRejected && <Button sx={{ ...pill, display: 'block', mt: 1 }} disabled={Boolean(busy)} onClick={restoreScene}>Restore generated scene · no AI call</Button>}{busy && status}{error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}</Box>
            <Box data-spatial-scene-editor sx={{ ...glass, position: 'absolute', bottom: 'max(16px,env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', p: 1.5, width: 'min(380px,85%)', boxSizing: 'border-box', maxHeight: 'calc(100% - 160px)', overflowY: 'auto', overscrollBehavior: 'contain', scrollbarWidth: 'thin', zIndex: 42 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 1, bgcolor: 'background.paper', borderRadius: 2 }}>
                    <IconButton aria-label="Scene instructions and model" onClick={() => { setSceneEditorCollapsed(false); setHelperOpen(value => !value); }} sx={{ color: props.appColor }}><EditIcon /></IconButton>
                    <Typography variant="caption" sx={{ color: props.appColor }}>Scene setup</Typography>
                    <IconButton aria-label={sceneEditorCollapsed ? 'Expand scene setup' : 'Collapse scene setup'} aria-expanded={!sceneEditorCollapsed} onClick={() => setSceneEditorCollapsed(value => !value)} sx={{ color: props.appColor }}>{sceneEditorCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}</IconButton>
                </Box>
                <Box sx={{ display: sceneEditorCollapsed ? 'none' : 'block' }}>
                {helperOpen && <TextField fullWidth multiline label="Scene instructions" value={instruction} onChange={e => setInstruction(e.target.value)} disabled={Boolean(busy)} />}
                {!references.length && <TextField required fullWidth size="small" label="Driven subject" placeholder="e.g. girl in the foreground" value={drivenName} disabled={Boolean(busy)} onChange={e => { setDrivenName(e.target.value); if (detectedSubjects === null) setDetectedSubjects([]); }} helperText="Choose a detected subject or describe one. You can describe the subject yourself if identification fails." />}
                {!references.length && detectedSubjects && <Box sx={{ mb: 1 }}>
                    <Button onClick={() => setAssetsOpen(value => !value)} aria-expanded={assetsOpen}>Who do you control? {assetsOpen ? '▴' : '▾'}</Button>
                    {assetsOpen && <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: .5 }}>{detectedSubjects.map(subject => <Button key={subject.name} title={subject.description} aria-pressed={drivenName === subject.name} disabled={Boolean(busy)} onClick={() => setDrivenName(subject.name)} sx={{ borderRadius: 999, border: `1px solid ${props.appColor}`, bgcolor: drivenName === subject.name ? alpha(props.appColor, .2) : 'transparent', textTransform: 'none' }}>{subject.name}</Button>)}
                        <Button disabled={Boolean(busy)} onClick={() => setDrivenName('camera / point of view')}>Camera / point of view</Button>
                    </Box>}
                </Box>}
                {Boolean(references.length) && <Box>
                    <Button onClick={() => setAssetsOpen(value => !value)} aria-expanded={assetsOpen} sx={{ color: props.appColor }}>Scene characters / assets · {selectedNames.length} {assetsOpen ? '▴' : '▾'}</Button>
                    {assetsOpen && <>
                        <Box data-spatial-scene-assets sx={{ display: 'flex', gap: 1, overflowX: 'auto', py: 1, overscrollBehaviorX: 'contain' }}>
                            {references.map(ref => <Button data-spatial-asset key={ref.name} aria-pressed={selectedNames.includes(ref.name)} disabled={Boolean(busy)} onClick={() => { setSelectedNames(names => names.includes(ref.name) ? names.filter(name => name !== ref.name) : [...names, ref.name]); if (drivenName === ref.name) setDrivenName(''); }} sx={{ flex: '0 0 88px', minWidth: 88, p: .5, display: 'flex', flexDirection: 'column', color: props.appColor, textTransform: 'none', border: `2px solid ${selectedNames.includes(ref.name) ? props.appColor : '#fff'}`, borderRadius: 999 }}>
                                <Box component="img" src={ref.imageUrl} alt="" sx={{ width: 80, height: 80, objectFit: 'cover', objectPosition: 'top', borderRadius: '50%', boxSizing: 'border-box', border: `2px solid ${selectedNames.includes(ref.name) ? props.appColor : '#fff'}` }} />
                                <Typography sx={{ fontSize: '.72rem', overflowWrap: 'anywhere' }}>{ref.name}</Typography>
                            </Button>)}
                        </Box>
                    </>}
                    <TextField required select fullWidth size="small" label="Driven character" value={drivenName} disabled={Boolean(busy)} helperText={continuity.primarySubjectName ? `Main character: ${continuity.primarySubjectName}. Choosing a ride keeps their identity and carried items.` : undefined} onChange={e => { setDrivenName(e.target.value); if (references.some(ref => ref.name === e.target.value)) setSelectedNames(names => names.includes(e.target.value) ? names : [...names, e.target.value]); }} sx={{ mb: 1 }}>
                        <MenuItem value="" disabled>Choose who you control</MenuItem>{references.map(ref => <MenuItem key={ref.name} value={ref.name}>{ref.name}</MenuItem>)}
                        <MenuItem value="camera / point of view">Camera / point of view</MenuItem>
                    </TextField>
                </Box>}
                <PlanningModelSelector value={tier} onChange={setTier} appColor={props.appColor} disabled={Boolean(busy) || liveClient.snapshot().phase !== 'idle'} />
                </Box>
            </Box>
        </>}
        <Dialog open={Boolean(imageNode)} onClose={() => { if (!busy) setImageNodeId(undefined); }} fullWidth maxWidth="sm" sx={{ zIndex: 2147483001 }}><DialogTitle>Edit {imageNode?.label} image</DialogTitle><DialogContent>
            {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
            <Typography variant="body2" sx={{ mb: 2 }}>Changes only this action’s result image, not the base scene. Keep the same poses, objects and action state; use motion authoring for physical changes. Reset this node’s descendants before editing its image.</Typography>
            <img src={imageNode?.frameUrl} alt="Current action result" style={{ width: '100%', maxHeight: 240, objectFit: 'contain' }} />
            {imageEdit?.output && <><Typography variant="subtitle2">Proposed image · original retained</Typography><img src={imageEdit.output} alt="Edited action result" style={{ width: '100%', maxHeight: 280, objectFit: 'contain' }} /></>}
            {imageEdit?.error && <Alert severity="warning">{imageEdit.error}</Alert>}
            {imageEdit?.status === 'submitting' && <Alert severity="info">This edit is still running. Refresh its saved result without submitting another request.<Button disabled={Boolean(busy)} onClick={() => void run('Refreshing action image…', async () => { await spatialOperation(session, 'read'); })}>Refresh status</Button></Alert>}
            {imageEdit?.status === 'ready' ? <>
                <Button disabled={Boolean(busy)} onClick={() => void run('Saving action result image…', async () => {
                    const target = imageNode!.id, editId = imageEdit.id;
                    const response = await fetch(imageEdit.output!); if (!response.ok) throw new Error('Could not load the edited image.');
                    const imageUrl = await props.uploadFrame(await response.blob());
                    await spatialOperation(session, 'action-image-apply', { nodeId: target, editId, imageUrl }); setImageNodeId(undefined);
                })}>Use this image</Button>
                <Button disabled={Boolean(busy)} onClick={() => void run('Keeping original image…', async () => { await spatialOperation(session, 'action-image-discard', { nodeId: imageNode!.id, editId: imageEdit.id }); })}>Keep original</Button>
            </> : <>
                <TextField fullWidth multiline minRows={2} label="Visual correction" value={imageInstruction} disabled={Boolean(busy) || imageEdit?.status === 'submitting'} onChange={e => { setImageInstruction(e.target.value); setImageQuote(undefined); }} sx={{ my: 2 }} />
                <Typography variant="caption">Nano Banana · {imageQuote ? `${imageQuote.pixels} P` : 'Get a server quote before confirming'}</Typography>
                {imageEdit?.status === 'submitting' && <Box sx={{ my: 2 }}>
                    <Typography variant="body2">If this edit was interrupted, after ten minutes you can release it and keep the original. This does not cancel or refund a request already accepted by the provider. A later result will be ignored; another edit would be a new paid request.</Typography>
                    <TextField size="small" label="Type ABANDON to release edit" value={abandonImage} onChange={e => setAbandonImage(e.target.value)} />
                    <Button disabled={Boolean(busy) || abandonImage !== 'ABANDON'} onClick={() => void run('Releasing interrupted edit…', async () => { await spatialOperation(session, 'action-image-abandon', { nodeId: imageNode!.id, editId: imageEdit.id, confirmation: abandonImage }); setAbandonImage(''); })}>Keep original and release</Button>
                </Box>}
                <Button disabled={Boolean(busy) || !imageInstruction.trim() || imageEdit?.status === 'submitting'} onClick={() => void run(imageQuote ? 'Editing the selected action image…' : 'Quoting action image edit…', async () => {
                    const fields = { nodeId: imageNode!.id, prompt: imageInstruction, aspect };
                    if (!imageQuote) { const response: any = await spatialOperation(session, 'action-image-quote', fields); setImageQuote(response.actionImageQuote); }
                    else { await spatialOperation(session, 'action-image', { ...fields, quoteKey: imageQuote.key }); setImageQuote(undefined); }
                })}>{imageQuote ? `Confirm edit · ${imageQuote.pixels} P` : 'Get edit quote'}</Button>
            </>}
        </DialogContent></Dialog>
        <Dialog open={editWorld && Boolean(world)} onClose={() => setEditWorld(false)} maxWidth="sm" fullWidth sx={{ zIndex: 2147483000 }}><DialogTitle sx={{ pr: 7 }}>Correct the scene proxy<IconButton aria-label="Close scene editor" onClick={() => setEditWorld(false)} sx={{ position: 'absolute', right: 8, top: 8, color: 'inherit' }}><CloseIcon /></IconButton></DialogTitle><DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <PlanningModelSelector value={tier} onChange={setTier} appColor={props.appColor} disabled={Boolean(busy) || liveClient.snapshot().phase !== 'idle'} />
            <TextField fullWidth multiline minRows={3} label="Scene corrections" placeholder="Describe changes to geometry, actors, props or camera" value={instruction} disabled={Boolean(busy)} onChange={e => setInstruction(e.target.value)} />
            {world && <TextField select fullWidth label="Controlled subject" value={world.controlledObject} helperText={`Main character: ${primarySubjectName || world.controlledObject}. This changes the moving unit for this scene.`} disabled={Boolean(busy)} onChange={e => void selectControlledSubject(e.target.value)}>{world.plan.objects.map(o => <MenuItem key={o.id} value={o.id}>{o.id.replace(/[_-]/g, ' ')}</MenuItem>)}</TextField>}
            <Typography variant="caption">Base scene editing locks as soon as the first route is saved.</Typography>
            {busy && status}
            {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
        </DialogContent><DialogActions sx={{ px: 3, pb: 3, pt: 1 }}>
            <Button fullWidth sx={{ ...pill, borderRadius: 2, minHeight: 44 }} disabled={Boolean(busy) || !ledger || !baseWorldEditable(ledger, scene.connections.length)} onClick={reconstruct}>{session.authoring.inputs.pendingWorld ? 'Retry saving scene · no new AI call' : 'Apply with AI · Metered P'}</Button>
        </DialogActions></Dialog>
        {mapOpen && <Box sx={{ ...glass, position: 'absolute', top: 'min(174px,25%)', left: { xs: 16, sm: 64 }, width: { xs: 'calc(100% - 32px)', sm: 'min(360px,calc(100% - 80px))' }, boxSizing: 'border-box', maxHeight: '65%', overflow: 'auto', zIndex: 55, p: 1 }}><IconButton aria-label="Close map" onClick={() => setMapOpen(false)} sx={{ color: 'inherit' }}><CloseIcon /></IconButton><SpatialNodeMap scene={scene} sceneIndex={0} appColor={props.appColor} connectorColor={props.appColor} darkMode={props.darkMode} linkOptions={links} resetDisabled={Boolean(busy || draft || pending.forward)}
            onResetRequiresDeletion={() => { setDeleteText(''); setDeleteBeforeReset(true); setConfirmDelete(true); }}
            onResetNode={(_, nodeId) => void run('Resetting routes…', async () => { const cut = cutSpatialNodeThread(scene, nodeId); if (!cut) return; if (cut.scene.ledger) await save(cut.scene); else accept(cut.scene); setDraft(null); setPending({}); })}
            onResetNavigation={(_, nodeId) => void run('Removing link…', async () => { const next = cloneWorld(scene); const node = next.nodes.find(n => n.id === nodeId)!; delete node.actionLink; delete node.actionBacktrack; await save(next); })}
            stagePresets={stagePresets.map(sp => ({ presetId: sp.presetId, title: sp.title }))}
            onSaveStagePreset={world && ledger ? () => {
                try {
                    const preset = extractStagePreset(
                        world,
                        bindWorldRigs(world.plan),
                        {
                            presetId: `stage_${Date.now()}_${stagePresets.length + 1}`,
                            title: `Stage Preset #${stagePresets.length + 1}`,
                            description: `Saved stage with ${scene.nodes.length} node(s)`,
                        },
                        {
                            nodes: scene.nodes,
                            connections: scene.connections,
                            routes: ledger.routes,
                            states: ledger.states,
                            authoring: scene.activeNodeId === scene.nodes[0]?.id ? authoringDraft : nodeHistories.current.get(`${scene.sceneId}:${scene.nodes[0]?.id}:${baseWorld?.revision || ''}`)?.current || baseWorld?.authoring,
                        },
                    );
                    void presetLibrary.save(preset).catch(error => setError(error?.response?.data?.message || error.message));
                } catch (err) {
                    setError((err as Error).message);
                }
            } : undefined}
            onSaveNodePreset={world && ledger ? (nodeId: string) => {
                try {
                    const conn = scene.connections.find(c => c.targetNodeId === nodeId);
                    const forward = conn ? ledger.routes[conn.id]?.forward : undefined;
                    const nodeLabel = scene.nodes.find(n => n.id === nodeId)?.label || 'Node';
                    const sourceDraft = forward?.authoring || (forward ? createAuthoringDraft(forward.plan, conn!.id, bindWorldRigs(forward.plan), forward.sourceState) : authoringDraft || getNodeHistory()?.current);
                    if (!sourceDraft) throw new Error('No 3D motion or action found on this node to save as a preset.');
                    const actorId = sourceDraft.plan.objects.some(o => o.id === world.controlledObject) ? world.controlledObject : sourceDraft.plan.objects[0]?.id;
                    if (!actorId) throw new Error('No actor found in node performance.');
                    const saved = extractMotionNodePreset(sourceDraft, actorId, {
                        presetId: `node_${nodeId.slice(0, 6)}_${privatePresets.length + 1}`,
                        title: `${nodeLabel} (${actorId.slice(0, 8)})`,
                        description: `Saved from map node ${nodeLabel}`,
                    });
                    void presetLibrary.save(saved).catch(error => setError(error?.response?.data?.message || error.message));
                } catch (err) {
                    setError((err as Error).message);
                }
            } : undefined}
            onApplyStagePreset={world && ledger && !locked ? (presetId: string) => void run('Applying saved stage preset…', async () => {
                const chosen = stagePresets.find(sp => sp.presetId === presetId);
                if (!chosen) return;
                session.authoring.inputs.presetUndo = cloneWorld(scene);
                await save(applySavedStagePreset(scene, chosen));
            }) : undefined} /></Box>}
        {quoteOpen && generationCount > 0 && <Box role="dialog" aria-label={generationTitle} sx={{ ...glass, borderColor: props.darkMode ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.12)', position: 'absolute', top: { xs: 'min(144px,30%)', sm: 116 }, left: { xs: 16, sm: 20 }, width: 'min(420px,calc(100% - 40px))', maxHeight: 'calc(100% - 160px)', overflowY: 'auto', boxSizing: 'border-box', p: 2, zIndex: 65 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}><Typography sx={{ fontSize: '1rem', fontWeight: 750 }}>{generationTitle}</Typography><IconButton aria-label="Close generation settings" onClick={() => setQuoteOpen(false)} sx={round}><CloseIcon /></IconButton></Box>
            {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
            {generationSettings()}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button sx={{ ...pill, flex: 1 }} disabled={!quote?.pixels || Boolean(busy) || !isSpatialVideoModel(generationModel)} onClick={() => void run('Starting generation…', async () => { await spatialOperation(session, 'start', { quoteKey: quote!.key, options, routeId: generationRoute, sceneContext: generationContext }); setQuoteOpen(false); })}>{quote ? `Confirm · ${quote.pixels} P` : 'Calculating…'}</Button>
                <Button sx={neutralPill} onClick={() => setQuoteOpen(false)}>Cancel</Button>
            </Box>
        </Box>}
        {boardOpen && ledger && <SpatialGenerationBoard scene={scene} darkMode={props.darkMode} accent={props.appColor} busy={Boolean(busy)} progressMessage={busy ? `${busy} · ${elapsedSeconds}s elapsed` : undefined} error={error} onDismissError={() => setError('')} glass={glass} pill={pill} retryPill={alternatePill}
            generationSettingsForJob={job => <><Typography variant="caption">Next {jobLabel(job)} generation</Typography>{generationSettings(nextJobOptions(job), value => changeJobOptions(job, value), true, `${job.direction === 'backward' ? 'Backward' : job.kind === 'action' ? 'Action' : 'Forward'} sound`)}<Typography variant="caption">Changes take effect after a confirmed retry or regeneration.</Typography></>} priceForJob={retryPixels} priceForPair={(jobs, selected) => jobs.reduce((total, job) => total + retryPixels(job, nextJobOptions(selected)), 0)} onContinueMapping={continueMapping}
            onClose={() => void spatialOperation(session, 'view', { boardOpen: false }).catch(e => setError(e.message))}
            onGenerate={finishMapping} onEdit={openPromptEditor} onEditMapped={(routeId, direction) => {
                const animation = ledger.routes[routeId][direction]!;
                setPromptEditMapped({ routeId, direction });
                setRetryPrompt(effectiveSpatialClipPrompt({ ...animation, direction, kind: scene.connections.find(edge => edge.id === routeId)?.kind === 'action' ? 'action' : 'movement' }));
            }}
            onRetry={jobs => reviewGeneration(jobs, 'retry')}
            onRetrySaving={job => void run('Refreshing the saved action state…', async () => {
                if (session.busy.has(job.id)) return;
                session.busy.add(job.id);
                try { await session.finalize!(job, ledger.epoch); }
                finally { session.busy.delete(job.id); }
            })}
            onRegenerate={(job, scope = 'direction') => reviewGeneration(scope === 'both' ? [job, ...ledger.jobs.filter(candidate => candidate.connectionId === job.connectionId && candidate.id !== job.id)] : [job], 'regenerate', scope)}
            onRecover={job => void run('Recovering the existing request…', async () => { await spatialOperation(session, 'recover', { jobId: job.id }); })}
            onRestore={job => void run('Keeping the previous result…', async () => { await spatialOperation(session, 'restore-result', { jobId: job.id }); })}
            onUpscale={job => {
                setUpscaleQuote({ jobId: job.id, selected: '1080p' });
                void run('Quoting this upscale…', async () => {
                    const quotes = await Promise.all((['1080p', '2k'] as const).map(async targetResolution => {
                        const response: any = await spatialOperation(session, 'upscale-quote', { jobId: job.id, targetResolution });
                        return [targetResolution, response.upscaleQuote] as const;
                    }));
                    setUpscaleQuote(current => current?.jobId === job.id ? { ...current, choices: Object.fromEntries(quotes) as NonNullable<typeof current.choices> } : current);
                });
            }}
            onUseUpscale={(job, version = job.upscale!) => void run('Saving HD video…', async () => {
                const sourceOutput = version.output!;
                const response = await fetch(sourceOutput); if (!response.ok) throw new Error('Could not load HD output.');
                const videoUrl = await props.uploadVideo(await response.blob());
                await spatialOperation(session, 'upscale-complete', { epoch: ledger.epoch, jobId: job.id, videoUrl, submissionToken: version.submissionToken, sourceOutput });
            })}
            onDelete={() => { setDeleteBeforeReset(false); setDeleteText(''); setConfirmDelete(true); }} />}
        <Dialog open={Boolean(promptEditJob || promptEditMapped)} onClose={() => { if (!busy) { setPromptEditJob(undefined); setPromptEditMapped(undefined); } }} fullWidth maxWidth="sm" sx={{ zIndex: 2147483001 }}>
            <DialogTitle>Edit {promptEditJob ? jobLabel(promptEditJob) : promptEditMapped?.direction} prompt</DialogTitle>
            <DialogContent>
                {props.allowAudioReferences !== false && <Button sx={pill} disabled={Boolean(busy)} onClick={() => { setClipAudio(editorAudio); setAudioDialog('clip'); }}>{editorAudio?.enabled ? 'Using Audio' : 'Audio reference'}</Button>}
                <TextField autoFocus fullWidth multiline minRows={3} maxRows={9} label="Clip prompt" value={retryPrompt} onChange={e => setRetryPrompt(e.target.value)} inputProps={{ maxLength: 1100 }} />
                {error && notice(error, () => setError(''))}
            </DialogContent>
            <DialogActions><Button disabled={Boolean(busy)} onClick={() => { setPromptEditJob(undefined); setPromptEditMapped(undefined); }}>Cancel</Button><Button sx={pill} disabled={Boolean(busy) || !retryPrompt.trim()} onClick={() => void run('Saving clip prompt…', async () => {
                if (promptEditJob) {
                    await spatialOperation(session, 'edit-prompt', { jobId: promptEditJob.id, prompt: retryPrompt });
                }
                else if (promptEditMapped) {
                    await spatialOperation(session, 'edit-prompt', { routeId: promptEditMapped.routeId, direction: promptEditMapped.direction, prompt: retryPrompt }); setQuote(undefined);
                }
                setPromptEditJob(undefined); setPromptEditMapped(undefined);
            })}>Save</Button></DialogActions>
        </Dialog>
        <AudioReferenceDialog open={props.allowAudioReferences !== false && Boolean(audioDialog)} duration={audioDialog === 'clip' ? promptEditJob?.duration || (promptEditMapped ? ledger?.routes[promptEditMapped.routeId]?.[promptEditMapped.direction]?.plan.duration : undefined) || actionDuration : actionDuration} value={audioDialog === 'clip' ? clipAudio : draftAudio} onClose={() => setAudioDialog(undefined)} onSave={async reference => {
            if (audioDialog === 'clip') {
                await spatialOperation(session, 'edit-prompt', { ...(promptEditJob ? { jobId: promptEditJob.id } : { routeId: promptEditMapped!.routeId, direction: promptEditMapped!.direction }), prompt: editorJob?.prompt || editorAnimation?.prompt, audioReference: reference || null });
                setClipAudio(reference); setQuote(undefined);
            } else {
                const next = cloneWorld(session.value?.scene || scene); next.ledger!.actionAudioReferences ||= {};
                if (reference) next.ledger!.actionAudioReferences[scene.activeNodeId] = reference; else delete next.ledger!.actionAudioReferences[scene.activeNodeId];
                if (pending.forward && kind === 'action' && draft) {
                    const motion = { ...pending, forward: { ...pending.forward, audioReference: reference } };
                    if (next.ledger!.draft) next.ledger!.draft.forward = motion.forward;
                    await save(next); keepPending(motion);
                } else await save(next);
            }
        }} />
        <Dialog open={Boolean(generationConfirmation)} onClose={() => { if (!busy) setGenerationConfirmation(undefined); }} fullWidth maxWidth="sm" sx={{ zIndex: 2147483001 }}>
            <DialogTitle>{generationConfirmation?.operation === 'retry' ? 'Retry failed clips?' : generationConfirmation?.scope === 'both' ? 'Regenerate both directions?' : 'Regenerate this direction?'}</DialogTitle>
            <DialogContent>
                {generationConfirmation && (generationConfirmation.scope === 'both' ? generationSettings(generationConfirmation.options[generationConfirmation.jobs[0].id], value => setGenerationConfirmation(current => current ? { ...current, quote: undefined, options: Object.fromEntries(current.jobs.map(job => [job.id, { ...value }])) } : current), false, 'Both directions sound') : generationConfirmation.jobs.map(job => <Box key={job.id}><Typography variant="subtitle2" sx={{ mb: 1 }}>{jobLabel(job)}</Typography>{generationSettings(generationConfirmation.options[job.id], value => setGenerationConfirmation(current => current ? { ...current, quote: undefined, options: { ...current.options, [job.id]: value } } : current), false, `${job.direction === 'backward' ? 'Backward' : job.kind === 'action' ? 'Action' : 'Forward'} sound`)}</Box>))}
                {generationConfirmation?.jobs.map(job => <Typography key={job.id} sx={{ mb: 1 }}>{jobLabel(job)} · {retryPixels(job, generationConfirmation.options[job.id])} P</Typography>)}
                {generationConfirmation?.operation === 'regenerate' && <Typography variant="body2" sx={{ mb: 1 }}>{generationConfirmation.scope === 'both' ? 'Forward generates first. Backward then starts from the new Forward ending and returns to its original opening.' : generationConfirmation.jobs[0]?.direction === 'forward' && ledger?.routes[generationConfirmation.jobs[0].connectionId]?.backward ? 'Only Forward changes. The existing Backward video is kept and may no longer match the new ending.' : 'Only this selected clip changes.'}</Typography>}
                {generationConfirmation?.operation === 'regenerate' && <Typography variant="body2" sx={{ mb: 1 }}>Other saved clips are kept.</Typography>}
                {replacementQuoting && <Typography role="status" variant="body2">Calculating the replacement cost…</Typography>}
                {error && notice(error, () => setError(''))}
            </DialogContent>
            <DialogActions><Button disabled={Boolean(busy)} onClick={() => setGenerationConfirmation(undefined)}>Cancel</Button><Button sx={pill} disabled={Boolean(busy || replacementQuoting) || !generationConfirmation || generationConfirmation.jobs.some(job => !isSpatialVideoModel(generationConfirmation.options[job.id].model)) || generationConfirmation.operation === 'regenerate' && !generationConfirmation.quote} onClick={() => void run('Submitting the confirmed clips…', async () => {
                const confirmation = generationConfirmation!;
                const currentJobs: SpatialJob[] = [];
                for (const selected of confirmation.jobs) {
                    const current = session.value?.scene.ledger?.jobs.find(item => item.id === selected.id);
                    if (!current || current.attempt !== selected.attempt || current.status !== selected.status || current.output !== selected.output) throw new Error('The clip changed. Review its current state and price.');
                    if (confirmation.operation === 'retry' && !spatialJobRetryable(current)) continue;
                    currentJobs.push(current);
                }
                if (confirmation.operation === 'regenerate') {
                    const jobIds = currentJobs.map(job => job.id);
                    await spatialOperation(session, 'regenerate', { jobIds, confirmation: jobIds.join(','), quoteKey: confirmation.quote!.key, pixels: confirmation.quote!.pixels, options: confirmation.options[jobIds[0]], sceneContext: generationContext });
                } else for (const current of currentJobs) {
                    const selection = confirmation.options[current.id];
                    await spatialOperation(session, 'retry', { jobId: current.id, prompt: effectiveSpatialClipPrompt({ ...current, kind: scene.connections.find(edge => edge.id === current.connectionId)?.kind === 'action' ? 'action' : 'movement' }), confirmation: current.id, pixels: retryPixels(current, selection), options: selection, sceneContext: generationContext });
                }
                setGenerationConfirmation(undefined);
            })}>Confirm · {generationConfirmation?.operation === 'regenerate' ? generationConfirmation.quote?.pixels ?? '…' : generationConfirmation?.jobs.reduce((total, job) => total + retryPixels(job, generationConfirmation.options[job.id]), 0) || 0} P</Button></DialogActions>
        </Dialog>
        <SpatialUpscaleDialog quote={upscaleQuote} busy={Boolean(busy)} error={error} pill={pill} glass={glass} onDismissError={() => setError('')} onCancel={() => setUpscaleQuote(undefined)} onSelect={selected => setUpscaleQuote(current => current ? { ...current, selected } : current)} onConfirm={() => void run('Upscaling the selected clip…', async () => { const quote = upscaleQuote!; const choice = quote.choices![quote.selected]; setUpscaleQuote(undefined); await spatialOperation(session, 'upscale', { jobId: quote.jobId, quoteKey: choice.key, targetResolution: quote.selected }); })} />
        <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} aria-labelledby="spatial-delete-title" sx={{ zIndex: 2147483001 }}><DialogTitle id="spatial-delete-title">{deleteBeforeReset ? 'Delete videos before resetting this map?' : 'Delete this scene’s generated videos?'}</DialogTitle><DialogContent>
            {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
            <Typography>Active jobs will be cancelled where possible and late results discarded. Already-spent pixels are not refunded. Published viewers will lose this scene’s AI videos and retain its Three.js routes. Other scenes are unaffected. This keeps your 3D world and routes; reset routes separately in the map if you want to rebuild the base scene.</Typography>
            {deleteBeforeReset && <Typography sx={{ mt: 1 }}>Delete this scene’s generated videos first, then use Reset in the visual map to remove the selected routes.</Typography>}
            <TextField fullWidth label="Type DELETE" value={deleteText} onChange={e => setDeleteText(e.target.value)} sx={{ my: 2 }} />
            <Button color="error" disabled={deleteText !== 'DELETE' || Boolean(busy)} onClick={() => void run('Deleting generated outputs…', async () => { await spatialOperation(session, 'delete', { confirmation: deleteText }); setConfirmDelete(false); setDeleteText(''); })}>Delete generated videos</Button>
            <Button onClick={() => setConfirmDelete(false)} disabled={Boolean(busy)}>Cancel</Button>
        </DialogContent></Dialog>
    </Box></SpatialTheme>;
}
