import SceneControlsToggle from './SceneControlsToggle';
import SceneActionPresets from './SceneActionPresets';
import { copyLiveSceneLogs } from '../liveSceneDiagnostics';
import { liveSceneDebug } from '../liveSceneDebug';
import { useScenePresetLibrary } from '../useScenePresetLibrary';
import ScenePresetLibraryControls from './ScenePresetLibraryControls';
import LiveSceneWorkspace from './LiveSceneWorkspace';
import { LiveSceneClient, type LiveSceneState } from '../liveSceneClient';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Alert, Box, Button, Dialog, DialogContent, DialogTitle, IconButton, LinearProgress, MenuItem, TextField, Tooltip, Typography } from '@mui/material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import EditIcon from '@mui/icons-material/Edit';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import Notepad from '../Notepad';
import { alpha } from '@mui/material/styles';
import { appAccentButtonSx } from '../appAccentStyles';
import type { MotionGuideData } from '../motionGuide';
import { motionGuidePrice } from '../motionGuide';
import {
    createAuthoringDraft,
    fitAuthoringDuration,
    restoreAuthoringDraft,
    applyAuthoringCommands,
    type SceneAuthoringDraft,
} from '../../server/src/sceneAuthoring';
import { bindWorldRigs } from '../../server/src/sceneRig';
import { LENS_PRESETS_MM, LIGHTING_PRESETS, defaultLightingRigForPreset, type SceneCameraRig, type SceneLightingPreset } from '../../server/src/sceneCamera';
import { BUILTIN_MOTION_PRESETS, applyMotionPreset, fitPresetDuration, extractMotionNodePreset, type MotionNodePreset, type StagePreset } from '../../server/src/scenePresets';
import { creationBinding as cb } from '../creationControlSnapshot';
import { useCreationControls } from '../useCreationControls';
import PlanningModelSelector from './PlanningModelSelector';
import SpatialTheme from './SpatialTheme';
import type { PlanningTier } from '../../server/src/spatialWorld';

const inactiveLive: LiveSceneState = { phase: 'idle', message: '', pinned: [], continuationsLeft: 15, segment: 1 };
const noSubscribe = () => () => {};
const idleSnapshot = () => inactiveLive;

type Props = {
    apiUrl?: string;
    liveClient?: LiveSceneClient;
    guide?: MotionGuideData;
    status?: string;
    error?: string;
    progress?: number;
    appColor?: string;
    darkMode?: boolean;
    planningTier?: PlanningTier;
    onPlanningTierChange?: (tier: PlanningTier) => void;
    onEdit: (instruction: string, authoring?: SceneAuthoringDraft) => Promise<boolean>;
    onManualCommit?: (authoring: SceneAuthoringDraft) => Promise<boolean>;
    onDelete: () => void;
    onRetry: () => void;
    onRebuild?: () => void;
    onPromptSave: (prompt: string) => void;
    sceneNumber?: number;
    aspectRatio?: string;
};
export default function MotionGuidePreview({ apiUrl = '', liveClient, guide, status, error, progress = 0, appColor = '#c5d83e', darkMode = true, planningTier = 'luna', onPlanningTierChange, onEdit, onManualCommit, onDelete, onRetry, onRebuild, onPromptSave, sceneNumber, aspectRatio = '16:9' }: Props) {
    const liveState = useSyncExternalStore(liveClient?.subscribe || noSubscribe, liveClient?.snapshot || idleSnapshot);
    const liveActive = liveState.phase !== 'idle';
    const retainViewport = liveActive || Boolean(liveClient && (!guide || status));
    const viewportAspect = guide?.aspectRatio || String(liveState.resumeBody?.aspectRatio || aspectRatio);
    const [open, setOpen] = useState(false);
    const [showReference, setShowReference] = useState(false);
    const [controlsHidden, setControlsHidden] = useState(false);
    const expandedLive = liveActive || Boolean(status) || !guide;
    const [instruction, setInstruction] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [promptOpen, setPromptOpen] = useState(false);
    const [textActive, setTextActive] = useState(false);
    const [selectedActorId, setSelectedActorId] = useState('');
    const [assistText, setAssistText] = useState('');
    const presetLibrary = useScenePresetLibrary(apiUrl);
    const savedMotionPresets = presetLibrary.items.map(item => item.preset).filter((p): p is MotionNodePreset => p.kind === 'motion_preset');
    const savedStagePresets = presetLibrary.items.map(item => item.preset).filter((p): p is StagePreset => p.kind === 'stage_preset');
    const [presetNotice, setPresetNotice] = useState('');
    const [history, setHistory] = useState<{ draft: SceneAuthoringDraft | null; undo: SceneAuthoringDraft[]; redo: SceneAuthoringDraft[] }>({
        draft: null,
        undo: [],
        redo: [],
    });
    useEffect(() => {
        if (!guide) {
            setHistory({ draft: null, undo: [], redo: [] });
            return;
        }
        const initialDraft = guide.authoring || createAuthoringDraft(guide.plan, `mg_${guide.createdAt || 1}`, bindWorldRigs(guide.plan));
        setHistory({ draft: initialDraft, undo: [], redo: [] });
        setSelectedActorId(current => current && guide.plan.objects.some(obj => obj.id === current) ? current : (guide.plan.objects[0]?.id || ''));
    }, [guide?.plan, guide?.authoring, guide?.createdAt]);
    const activeDraft = history.draft;
    const pushDraft = (nextDraft: SceneAuthoringDraft) => {
        setHistory(current => ({
            draft: nextDraft,
            undo: current.draft ? [...current.undo.slice(-29), current.draft] : current.undo,
            redo: [],
        }));
    };
    const localClient = useMemo(() => new LiveSceneClient('', 'local-motion-editor'), []);
    localClient.onLocalEdit = pushDraft;
    useEffect(() => { if (activeDraft) localClient.loadLocalDraft(activeDraft); }, [localClient, activeDraft]);
    const hasManualChanges = Boolean(activeDraft && activeDraft.revision > (guide?.authoring?.revision || 0));
    const price = motionGuidePrice(planningTier);
    const paidExportReady = Boolean(guide && !(guide.pendingReplacement || guide).liveDraft && (guide.pendingReplacement || !guide.videoUrl));
    const canDelete = Boolean(guide) && !status;
    useCreationControls('workstation_motion_guide', 'MotionGuidePreview', Boolean(guide || status || error), {
        planReady: Boolean(guide),
        referenceVideoReady: Boolean(guide?.videoUrl),
        busy: Boolean(status),
        status: status || '',
        error: error || '',
        expanded: open,
        deleteConfirming: confirmDelete,
        editInstructionLength: instruction.length,
        editPixels: price,
        promptEditorOpen: promptOpen,
        promptDraftPresent: guide?.draftPrompt !== undefined,
        replacementPlanReady: Boolean(guide?.pendingReplacement),
    });
    // EditStory passes the normalized active light/dark Redux app colour.
    const actionSx = {
        ...appAccentButtonSx(appColor, darkMode),
        width: 36, height: 36, flexShrink: 0,
    };
    const media = (expanded = false) => guide && activeDraft
        ? <LiveSceneWorkspace client={localClient} accent={appColor} aspect={viewportAspect} expanded={expanded} maximized={expanded} fillContainer={expanded && controlsHidden} exportedVideoUrl={guide?.videoUrl} persistent controlsHidden={expanded && controlsHidden} fallbackPlan={activeDraft.plan} fallbackAuthoring={activeDraft} />
        : null;
    const feedback = <>
        {liveSceneDebug && (status || error) && <Button size="small" onClick={() => void copyLiveSceneLogs()}>Copy Logs</Button>}
        {status && <Typography role="status" sx={{ p: 1 }}>{status}</Typography>}
        {(status || progress === 100) && <Box sx={{ px: 1, pb: 1 }}>
            <LinearProgress variant="determinate" value={progress} aria-label="Motion Guide progress" sx={{ height: 6, borderRadius: 3, bgcolor: alpha(appColor, darkMode ? 0.18 : 0.12), '& .MuiLinearProgress-bar': { bgcolor: appColor, transition: 'transform 0.4s ease' } }} />
            {status && !status.startsWith('Exporting') && !status.startsWith('Uploading') && <Typography variant="caption">Estimated build progress</Typography>}
        </Box>}
        {error && <Alert severity="error">{error}</Alert>}
        {paidExportReady && !status && <Button {...cb('workstation_motion_guide', 'retry_export', 'Retry exporting the existing motion plan without a new plan charge', 'onRetry')} onClick={onRetry}>Retry export · 0 P</Button>}
        {guide?.draftPrompt !== undefined && onRebuild && !status && <Button {...cb('workstation_motion_guide', 'rebuild_prompt', `Rebuild Motion Guide from the saved prompt at provider cost`, 'onRebuild', 'click', 'requires_video')} onClick={onRebuild}>Rebuild motion · at cost</Button>}
    </>;
    return <SpatialTheme darkMode={darkMode}><Box sx={{ borderRadius: 3, overflow: 'hidden', bgcolor: 'rgba(127,127,127,0.08)', border: '1px solid rgba(127,127,127,0.25)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', p: 1, gap: 1 }}>
            <Typography sx={{ flex: 1 }}>Motion Guide</Typography>
            {guide && <Button {...cb('workstation_motion_guide', 'edit_3d', 'Edit the existing 3D plan without changing the scene video prompt', 'setOpen')} sx={{ ...appAccentButtonSx(appColor, darkMode), display: { xs: 'none', sm: 'inline-flex' }, flexShrink: 0, minWidth: 0 }} startIcon={<EditIcon />} disabled={Boolean(status)} onClick={() => setOpen(true)}>Edit 3D</Button>}

            {guide && <Tooltip title="Edit Motion Guide prompt"><IconButton {...cb('workstation_motion_guide', 'edit_prompt', 'Edit the full Motion Guide prompt in Notepad; save a draft without rebuilding', 'setPromptOpen')} sx={actionSx} aria-label="Edit Motion Guide prompt" onClick={() => setPromptOpen(true)}><TextFieldsIcon /></IconButton></Tooltip>}
            {(guide || liveClient) && <Tooltip title="Zoom Motion Guide"><IconButton {...cb('workstation_motion_guide', 'expand', 'Open the Motion Guide preview and edit controls', 'setOpen')} sx={actionSx} aria-label="Expand Motion Guide" onClick={() => setOpen(true)}><FullscreenIcon /></IconButton></Tooltip>}
            {canDelete && <Tooltip title="Delete Motion Guide"><IconButton {...cb('workstation_motion_guide', 'request_delete', 'Ask to delete the Motion Guide', 'setConfirmDelete')} sx={actionSx} aria-label="Delete Motion Guide" onClick={() => setConfirmDelete(true)}><DeleteOutlineIcon /></IconButton></Tooltip>}
        </Box>
        {!open && retainViewport && liveClient && <LiveSceneWorkspace client={liveClient} accent={appColor} aspect={viewportAspect} persistent={retainViewport} fallbackPlan={(guide?.pendingReplacement || guide)?.plan} fallbackAuthoring={(guide?.pendingReplacement || guide)?.authoring} />}
        {!open && !retainViewport && media()}
        {!liveActive && feedback}
        {guide?.videoUrl && !status && <Box sx={{ px: 1, pb: 1 }}><Button size="small" onClick={() => setShowReference(value => !value)}>{showReference ? 'Hide exported reference' : 'View exported reference'}</Button>{showReference && <video src={guide.videoUrl} controls muted loop playsInline preload="metadata" style={{ width: '100%', maxHeight: 320, objectFit: 'contain' }} />}</Box>}
        {guide?.videoUrl && !status && <Typography variant="caption" sx={{ display: 'block', px: 1, pb: 1 }}>Using Motion Guide as video reference</Typography>}
        <Dialog open={open} fullWidth maxWidth={controlsHidden?false:'lg'} PaperProps={{sx:{height:controlsHidden?'100dvh':'90dvh',maxHeight:'100dvh',maxWidth:controlsHidden?'100vw':undefined,m:controlsHidden?0:undefined,width:controlsHidden?'100vw':undefined,position:'relative',display:'flex',flexDirection:'column'}}} onClose={() => setOpen(false)} sx={{ zIndex: 2147483000 }}>
            <SceneControlsToggle hidden={controlsHidden} onToggle={()=>setControlsHidden(value=>!value)}/>
            <DialogTitle sx={{pl:8,display:controlsHidden?'none':undefined}}>Motion Guide <IconButton {...cb('workstation_motion_guide', 'close', 'Close the expanded Motion Guide', 'setOpen')} aria-label="Close Motion Guide" onClick={() => setOpen(false)} sx={{ float: 'right' }}><CloseIcon /></IconButton></DialogTitle>
            <DialogContent sx={{position:'relative',minHeight:0,flex:1, ...(controlsHidden ? {p:0,display:'flex',flexDirection:'column',overflow:'hidden','& > :not([data-live-scene-workspace]):not([data-scene-controls-toggle])':{display:'none'}} : liveActive ? {'& > :not([data-live-scene-workspace]):not([data-motion-planning-controls]):not([data-scene-controls-toggle])':{display:'none'}} : {})}}>
                {expandedLive && liveClient && <LiveSceneWorkspace client={liveClient} accent={appColor} aspect={viewportAspect} expanded maximized fillContainer={controlsHidden} exportedVideoUrl={guide?.videoUrl} controlsHidden={controlsHidden} persistent={expandedLive} fallbackPlan={(guide?.pendingReplacement || guide)?.plan} fallbackAuthoring={(guide?.pendingReplacement || guide)?.authoring} />}
                {!expandedLive && media(true)}
                {feedback}
                {guide && activeDraft && <Box data-motion-guide-studio sx={{ mt: 1.5, p: 1.25, borderRadius: 2, border: '1px solid rgba(127,127,127,0.25)', display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                        <TextField select size="small" label="Subject" value={selectedActorId || guide.plan.objects[0]?.id || ''} onChange={e => setSelectedActorId(e.target.value)} sx={{ minWidth: 130 }}>
                            {guide.plan.objects.map(obj => <MenuItem key={obj.id} value={obj.id}>{obj.id}</MenuItem>)}
                        </TextField>
                        <TextField select size="small" label="Camera rig" value={activeDraft.cameraRig?.kind || 'free'} onChange={e => {
                            const rigKind = e.target.value as SceneCameraRig['kind'];
                            const focalLengthMm = activeDraft.cameraRig?.focalLengthMm || 35;
                            const targetId = selectedActorId || guide.plan.objects[0]?.id || 'actor';
                            const nextRig: SceneCameraRig = rigKind === 'free'
                                ? { kind: 'free', focalLengthMm }
                                : rigKind === 'orbit'
                                    ? { kind: 'orbit', target: { objectId: targetId }, focalLengthMm, radius: 5, height: 1.5, turns: 1 }
                                    : rigKind === 'overhead'
                                        ? { kind: 'overhead', target: { objectId: targetId }, focalLengthMm, height: 7, heading: 0 }
                                        : rigKind === 'zolly'
                                            ? { kind: 'zolly', target: { objectId: targetId }, focalLengthMm, startDistance: 4, endDistance: 10, height: 0 }
                                            : rigKind === 'crash'
                                                ? { kind: 'crash', target: { objectId: targetId }, focalLengthMm: 24, endFocalLengthMm: 135, startTime: 0, zoomDuration: .35 }
                                                : { kind: 'mounted', target: { objectId: targetId }, focalLengthMm, offset: [0, .2, 1.5], lookOffset: [0, .15, 0] };
                            pushDraft(applyAuthoringCommands(activeDraft, activeDraft.revision, [{ kind: 'cameraRig', rig: nextRig }]));
                        }} sx={{ minWidth: 120 }}>
                            {(['free', 'orbit', 'mounted', 'overhead', 'zolly', 'crash'] as const).map(mode => <MenuItem key={mode} value={mode}>{mode}</MenuItem>)}
                        </TextField>
                        <TextField select size="small" label="Lens" value={activeDraft.cameraRig?.focalLengthMm || 35} onChange={e => {
                            const focalLengthMm = Number(e.target.value);
                            const existing = activeDraft.cameraRig || { kind: 'free' as const, focalLengthMm };
                            pushDraft(applyAuthoringCommands(activeDraft, activeDraft.revision, [{ kind: 'cameraRig', rig: { ...existing, focalLengthMm } }]));
                        }} sx={{ minWidth: 96 }}>
                            {LENS_PRESETS_MM.map(mm => <MenuItem key={mm} value={mm}>{mm}mm</MenuItem>)}
                        </TextField>
                        <TextField select size="small" label="Lighting" value={(activeDraft.lightingRig || defaultLightingRigForPreset('studio')).preset} onChange={e => {
                            const preset = e.target.value as SceneLightingPreset;
                            pushDraft(applyAuthoringCommands(activeDraft, activeDraft.revision, [{ kind: 'lightingRig', lighting: defaultLightingRigForPreset(preset) }]));
                        }} sx={{ minWidth: 112 }}>
                            {LIGHTING_PRESETS.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                        </TextField>
                        <TextField select size="small" label="Key angle" value={Math.round((activeDraft.lightingRig || defaultLightingRigForPreset('studio')).azimuthDeg)} onChange={e => {
                            const cur = activeDraft.lightingRig || defaultLightingRigForPreset('studio');
                            pushDraft(applyAuthoringCommands(activeDraft, activeDraft.revision, [{ kind: 'lightingRig', lighting: { ...cur, azimuthDeg: Number(e.target.value) } }]));
                        }} sx={{ minWidth: 86 }}>
                            {([-90, -55, -34, 0, 40, 65, 90, 165] as const).map(deg => <MenuItem key={deg} value={deg}>{deg}°</MenuItem>)}
                        </TextField>
                        <IconButton size="small" aria-label="Undo Motion Guide 3D edit" disabled={!history.undo.length} onClick={() => {
                            const prev = history.undo[history.undo.length - 1];
                            if (!prev || !activeDraft) return;
                            setHistory({ draft: prev, undo: history.undo.slice(0, -1), redo: [...history.redo, activeDraft] });
                        }}><UndoIcon fontSize="small" /></IconButton>
                        <IconButton size="small" aria-label="Redo Motion Guide 3D edit" disabled={!history.redo.length} onClick={() => {
                            const next = history.redo[history.redo.length - 1];
                            if (!next || !activeDraft) return;
                            setHistory({ draft: next, undo: [...history.undo, activeDraft], redo: history.redo.slice(0, -1) });
                        }}><RedoIcon fontSize="small" /></IconButton>
                    </Box>
                    {(() => {
                        const activeRig: SceneCameraRig = activeDraft.cameraRig || { kind: 'free', focalLengthMm: 35 };
                        const nudge = (dPos: [number, number, number], dTarget: [number, number, number] = [0, 0, 0], dRoll?: number) => {
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
                            const nextRoll = dRoll !== undefined ? Number(((activeRig.roll || 0) + dRoll).toFixed(3)) : activeRig.roll;
                            pushDraft(applyAuthoringCommands(activeDraft, activeDraft.revision, [{
                                kind: 'cameraRig',
                                rig: { ...activeRig, offset: nextOffset, targetOffset: nextTarget, ...(nextRoll !== undefined ? { roll: nextRoll } : {}) },
                            }]));
                        };
                        return <Box sx={{ display: 'flex', gap: .5, flexWrap: 'wrap' }}>
                            <Button size="small" variant="outlined" onClick={() => nudge([0, 0, -.6])}>Dolly In</Button>
                            <Button size="small" variant="outlined" onClick={() => nudge([0, 0, .6])}>Dolly Out</Button>
                            <Button size="small" variant="outlined" onClick={() => nudge([-.45, 0, 0], [-.45, 0, 0])}>Truck L</Button>
                            <Button size="small" variant="outlined" onClick={() => nudge([.45, 0, 0], [.45, 0, 0])}>Truck R</Button>
                            <Button size="small" variant="outlined" onClick={() => nudge([0, .35, 0], [0, .15, 0])}>Cam Up</Button>
                            <Button size="small" variant="outlined" onClick={() => nudge([0, -.35, 0], [0, -.15, 0])}>Cam Down</Button>
                            <Button size="small" variant="outlined" onClick={() => nudge([0, 0, 0], [0, 0, 0], -.175)}>Roll -10°</Button>
                            <Button size="small" variant="outlined" onClick={() => nudge([0, 0, 0], [0, 0, 0], .175)}>Roll +10°</Button>
                        </Box>;
                    })()}
                    <Box sx={{ display: 'flex', gap: .75, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Typography sx={{ fontSize: '.7rem', fontWeight: 800, opacity: .75, mr: .25 }}>Moves & Presets:</Typography>
                        {(['jump', 'roll', 'crouch'] as const).map(move => <Button key={move} size="small" variant="outlined" sx={{ borderRadius: 99, textTransform: 'none', py: .2, px: 1 }} onClick={() => {
                            const actor = selectedActorId || activeDraft.plan.objects[0]?.id || 'actor';
                            pushDraft(applyAuthoringCommands(activeDraft, activeDraft.revision, [{
                                kind: 'move',
                                at: 0,
                                move: { id: `mg_${move}_${activeDraft.revision + 1}`, objectId: actor, kind: move, duration: 1 },
                            }]));
                        }}>{move}</Button>)}
                        {[...BUILTIN_MOTION_PRESETS, ...savedMotionPresets].map(preset => <Button key={preset.presetId} size="small" variant="outlined" sx={{ borderRadius: 99, textTransform: 'none', py: .2, px: 1, borderColor: alpha(appColor, .55) }} onClick={() => {
                            try {
                            const actorId = selectedActorId || activeDraft.plan.objects[0]?.id || 'actor';
                            pushDraft(applyMotionPreset(activeDraft, fitPresetDuration(preset, activeDraft.plan.duration), actorId, 0).draft);
                            setPresetNotice(`Applied preset: ${preset.title} · fitted to ${activeDraft.plan.duration}s`);
                            } catch (error) { setPresetNotice(error instanceof Error ? error.message : 'This preset is incompatible with this subject.'); }
                        }}>{preset.title}</Button>)}
                        <Button size="small" variant="contained" sx={{ ...appAccentButtonSx(appColor, darkMode), borderRadius: 99, textTransform: 'none', py: .2, px: 1.1, fontSize: '.72rem' }} onClick={() => {
                            const actorId = selectedActorId || activeDraft.plan.objects[0]?.id || 'actor';
                            const saved = extractMotionNodePreset(activeDraft, actorId, {
                                presetId: `mg_${actorId}_${Date.now()}`,
                                title: `Guide ${actorId.slice(0, 8)} #${savedMotionPresets.length + 1}`,
                                description: 'Saved from Motion Guide studio',
                            });
                            void presetLibrary.save(saved).then(() => setPresetNotice(`Saved to shared library: ${saved.title}`)).catch(() => {});
                        }}>+ Save Motion Preset</Button>
                        {savedStagePresets.map(sp => <Button key={sp.presetId} size="small" variant="outlined" sx={{ borderRadius: 99, textTransform: 'none', py: .2, px: 1, bgcolor: alpha(appColor, .12) }} onClick={() => {
                            try {
                            if (sp.aspectRatio !== guide.aspectRatio) throw new Error('Choose a stage preset with the same aspect ratio as this shot.');
                            const savedStage = sp.authoring ? restoreAuthoringDraft(JSON.stringify(sp.authoring)) : createAuthoringDraft(sp.plan, `stage_${sp.presetId}`, sp.rigs || bindWorldRigs(sp.plan), sp.initialState);
                            const stageDraft = fitAuthoringDuration(savedStage, activeDraft.plan.duration);
                            const bumped = { ...stageDraft, draftId: crypto.randomUUID(), sourceKey: activeDraft.sourceKey, revision: activeDraft.revision + 1 };
                            pushDraft(bumped);
                            setSelectedActorId(sp.controlledObject || sp.plan.objects[0]?.id || '');
                            setPresetNotice(`Applied stage preset: ${sp.title}`);
                            } catch (error) { setPresetNotice(error instanceof Error ? error.message : 'This stage preset could not be applied.'); }
                        }}>Stage: {sp.title}</Button>)}
                    </Box>
                    <ScenePresetLibraryControls library={presetLibrary} />
                    <SceneActionPresets draft={activeDraft} library={presetLibrary} onChange={pushDraft} disabled={Boolean(status)} />
                    {presetNotice && <Typography sx={{ fontSize: '.7rem', color: appColor, fontWeight: 700 }}>{presetNotice}</Typography>}
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <TextField size="small" fullWidth placeholder="AI assist (e.g. wave, jump, zolly)" value={assistText} onChange={e => setAssistText(e.target.value)} />
                        <Button size="small" variant="outlined" disabled={!assistText.trim()} onClick={() => {
                            const actorId = selectedActorId || guide.plan.objects[0]?.id || 'actor';
                            void onEdit(`For ${actorId}: ${assistText}`, activeDraft);
                            setAssistText('');
                        }} startIcon={<AutoFixHighIcon fontSize="small" />}>Apply</Button>
                        {onManualCommit && <Button {...cb('workstation_motion_guide', 'save_manual_3d', 'Export and save manual 3D edits locally without a new AI plan charge', 'onManualCommit')} variant="contained" disabled={!hasManualChanges || Boolean(status)} onClick={() => { void onManualCommit(activeDraft); }} sx={{ flexShrink: 0 }}>Save 3D edits · 0 P</Button>}
                    </Box>
                </Box>}
                {onPlanningTierChange && <Box data-motion-planning-controls><PlanningModelSelector value={planningTier} onChange={onPlanningTierChange} appColor={appColor} disabled={Boolean(status) || liveActive} /></Box>}
                <TextField inputProps={cb('workstation_motion_guide', 'edit_instruction', 'Describe a change to the Motion Guide plan', 'setInstruction', 'text')} fullWidth multiline minRows={2} label="Edit this 3D motion" helperText="Adjust shapes, attachments, motion or camera. Your video prompt stays unchanged." value={instruction} onChange={e => setInstruction(e.target.value)} disabled={Boolean(status)} sx={{ mt: 2 }} />
                <Button {...cb('workstation_motion_guide', 'edit', `Edit the Motion Guide from this instruction at provider cost`, 'onEdit', 'click', 'requires_video')} disabled={!instruction.trim() || Boolean(status)} onClick={async () => { if (await onEdit(instruction.trim(), activeDraft || undefined)) setInstruction(''); }}>Edit motion · at cost</Button>
                {canDelete && <Button {...cb('workstation_motion_guide', 'request_delete', 'Ask to delete the Motion Guide', 'setConfirmDelete')} color="error" onClick={() => setConfirmDelete(true)}>Delete build</Button>}
            </DialogContent>
        </Dialog>
        <Dialog open={confirmDelete && canDelete} onClose={() => setConfirmDelete(false)} sx={{ zIndex: 2147483001 }}>
            <DialogTitle>Delete Motion Guide?</DialogTitle>
            <DialogContent><Typography>AI builds are billed at provider cost, rounded up to whole pixels.</Typography>
                <Button {...cb('workstation_motion_guide', 'keep', 'Keep the Motion Guide', 'setConfirmDelete')} onClick={() => setConfirmDelete(false)}>Keep</Button>
                <Button {...cb('workstation_motion_guide', 'confirm_delete', `Delete the Motion Guide; the next build is billed at provider cost`, 'onDelete', 'click', 'needs_confirmation')} color="error" disabled={!canDelete} onClick={() => { if (!canDelete) return; onDelete(); setConfirmDelete(false); setOpen(false); }}>Delete</Button>
            </DialogContent>
        </Dialog>
        {guide && <Notepad type={200} GeneratedImage="" hide={!promptOpen} open={promptOpen}
            value={guide.draftPrompt ?? guide.sourcePrompt} onChange={value => {
                if (value !== (guide.draftPrompt ?? guide.sourcePrompt)) onPromptSave(value);
            }} onClose={() => setPromptOpen(false)} setIsNotepadOpen={setPromptOpen}
            darkMode={darkMode} placeholder="Motion Guide prompt draft"
            handleKeyDown={() => {}} TextFieldactive={textActive} setTextFieldactive={setTextActive}
            guideContext="editstory-motion-prompt" guideSceneNumber={sceneNumber} showTemplates={false}
            zIndex={2147483002} />}
    </Box></SpatialTheme>;
}
