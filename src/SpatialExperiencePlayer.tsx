import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Drawer, IconButton, TextField, Typography } from "@mui/material";
import axios from 'axios';
import { actionLabelKey, ACTION_LABEL_MAX_LENGTH, normalizeActionLabel, readActionLabels, readActionLabelRevision } from '../server/src/spatialLabelMetadata';
import { commitActionLabels, draftActionLabel, receiveActionLabels } from './spatialLabelsSlice';
import "./SpatialExperiencePlayer.css";
import "./mediaLoadingCover.css";
import SettingsIcon from "@mui/icons-material/Settings";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import HomeIcon from "@mui/icons-material/Home";
import TimelineIcon from "@mui/icons-material/Timeline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { alpha, useTheme } from "@mui/material/styles";
import SpatialSceneSurface from "./SpatialSceneSurface";
import SpatialWorldViewport from './components/SpatialWorldViewport';
import { createMotionRenderer } from './motionGuideRenderer';
import { threePlayableScene } from './spatialThreePlayback';
import SpatialNodeMap from "./components/SpatialNodeMap";
import SpatialTheme from './components/SpatialTheme';
import VirtualJoystickDrive, { type JoystickDriveSample } from "./components/VirtualJoystickDrive";
import SpatialActionNavigation from './components/SpatialActionNavigation';
import CompletionConfetti from "./components/CompletionConfetti";
import { matchMobile } from "./DetectDevice";
import { useDispatch, useSelector } from "react-redux";
import { setSpatialControlMode, setSpatialViewerHoverActive } from "./settingsSlice";
import type { RootState } from "./store";
import { publishFeedsArea, removeFeedsArea } from "./brainstormSlice";
import { boundedFeedTextHint, type FeedAreaId, type FeedControl } from "./feedsControlSnapshot";
import type { SpatialExperience, SpatialExperienceStage } from "./spatialExperience";
import { usedSpatialStages } from './spatialExperience';
import type { SpatialSceneState, SpatialTraversal } from "./spatialStageModel";
import { buildSpatialVideoCachePlan, spatialVideoRamCache, uniqueSpatialVideoAssets, type SpatialForwardRouteSelections } from "./spatialVideoCache";
import { attachSpatialPlayback } from "./spatialPlayback";
import { playableSpatialScene, sameSpatialPosition, spatialAction, spatialAppearanceFrame, spatialBackDestination, spatialDirections,
    spatialIsTerminalNode, spatialLinkReturn, spatialLinkReturnForDrive, spatialTraversalForDrive, spatialActionReplay,
    spatialActionForwardDestination, spatialUnlockLinkReturn, type SpatialLinkVisit, type SpatialPosition } from "./spatialPlayerModel";

export interface SpatialPlayerSnapshot { position: SpatialPosition | null; clip: SpatialTraversal | null; canBack: boolean }
export interface SpatialPlayerHandle {
    holdAction(held: boolean): void;
    activate(): boolean;
    jump(nodeId: string): boolean;
    back(): boolean;
    home(): boolean;
    cancel(): void;
    rememberRoute(stageId: string, sourceNodeId: string, connectionId: string): void;
}
/** Live editor data remains with its owner; only navigation is written through the adapter. */
export interface SpatialCreationAdapter {
    scene: SpatialSceneState | null;
    stages: SpatialExperienceStage[];
    navigate(position: SpatialPosition): boolean;
    isBlocked(): boolean;
    onPlaybackStart(traversal: SpatialTraversal): void;
    onNavigate(): void;
    onDrive(sample: JoystickDriveSample): void;
    onUnmatchedDrive(sample: JoystickDriveSample): void;
    onUnmatchedDriveEnd(sample: JoystickDriveSample): void;
    onUnmatchedDriveCancel?(): void;
    /** Explicit rotation composition owns input until its recording is finished. */
    capturesDrive?(): boolean;
    onStateChange(snapshot: SpatialPlayerSnapshot): void;
    onError(message: string): void;
    joystick?: { size?: number; disabled?: boolean; editMotionDisabled?: boolean; hasCustomMotionHint?: boolean; accentColor?: string; onEditMotion?: () => void };
    objectFit?: "contain" | "cover";
    view?: 'three' | 'video';
    hideSurface?: boolean;
}
type Props = { mode: "creation"; creation: SpatialCreationAdapter; document?: never; onSurfaceTap?: never }
    | { mode?: "preview" | "feed"; document: SpatialExperience; creation?: never; postId?: number; creatorId?: number; api?: string; appColor?: string; darkMode?: boolean; controlsHidden?: boolean; snapshotObscured?: boolean; muted?: boolean; poster?: string; onSurfaceTap?: () => void };
let nextCacheOwner = -1000;
const idleDrive = (): JoystickDriveSample => ({ x: 0, y: 0, radius: 0, angle: 0, active: false, timestamp: performance.now() });
const ACTION_CHECKPOINT_DWELL_MS = 2000;
const ACTION_CHECKPOINT_NEUTRAL_MS = 80;
const ACTION_LINK_RETURN_HOLD_MS = 1800;

/** The single creation/preview player: navigation, controls, media and cache ownership. */
const SpatialExperiencePlayer = forwardRef<SpatialPlayerHandle, Props>((props, ref) => {
    const creation = props.creation, game = props.document;
    const dispatch = useDispatch();
    const preferredControlMode = useSelector((state: RootState) => state.settings.spatialControlMode);
    const viewerHoverActive = useSelector((state: RootState) => state.settings.spatialViewerHoverActive);
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const controlsHidden = props.mode !== "creation" && Boolean(props.controlsHidden);
    const appColor = props.mode === "creation" ? (creation?.joystick?.accentColor || appColorDark) : (props.appColor || (props.darkMode ? appColorDark : appColorLight));
    const loggedUserId = useSelector((state: RootState) => state.profile?.loggedUser?.id);
    const labelState = useSelector((state: RootState) => state.spatialLabels);
    const postId = props.mode !== 'creation' ? props.postId : undefined;
    const creatorId = props.mode !== 'creation' ? props.creatorId : undefined;
    const api = props.mode !== 'creation' ? props.api ?? import.meta.env.VITE_CLIK_URL : '';
    const canEditLabels = Boolean(postId && Number.isSafeInteger(postId) && loggedUserId && loggedUserId === creatorId);
    const labelOwner = `${loggedUserId}:${postId}`;
    const [editingLabels, setEditingLabels] = useState(false);
    const [editingLabel, setEditingLabel] = useState<{ stageId: string; connectionId: string } | null>(null);
    const [labelsBusy, setLabelsBusy] = useState(false);
    const [labelError, setLabelError] = useState('');
    const labelRequest = useRef(0);
    const labelSavePending = useRef(false);
    const documentLabels = useMemo(() => readActionLabels(game), [game]);
    const savedLabels = postId && (labelState?.revisions[postId] || 0) >= readActionLabelRevision(game)
        ? labelState?.saved[postId] || documentLabels : documentLabels;
    const labelDrafts = labelState?.drafts[labelOwner];
    useEffect(() => {
        if (postId && readActionLabelRevision(game) > (labelState?.revisions[postId] || 0))
            dispatch(receiveActionLabels({ postId, labels: documentLabels, revision: readActionLabelRevision(game) }));
    }, [game, postId, documentLabels, labelState?.revisions, dispatch]);
    const labelFor = (stageId: string, connectionId: string) => (canEditLabels && editingLabels
        ? labelDrafts?.[actionLabelKey(stageId, connectionId)]?.label : undefined) ?? savedLabels?.[stageId]?.[connectionId] ?? '';
    useEffect(() => {
        setEditingLabels(false); setEditingLabel(null); setLabelError('');
    }, [labelOwner, canEditLabels]);
    useEffect(() => {
        // Preview snapshots contain authoring data; read post-production labels
        // separately without replacing the document or resetting the player.
        if (!canEditLabels || props.mode === 'feed' || !postId) return;
        let active = true;
        const request = ++labelRequest.current;
        void axios.get(`${api}/spatial-experience/action-labels`, { params: { postId }, withCredentials: true, timeout: 15000 }).then(response => {
            if (active && request === labelRequest.current) dispatch(receiveActionLabels({ postId, labels: readActionLabels(response.data), revision: readActionLabelRevision(response.data) }));
        }).catch(() => {});
        return () => { active = false; };
    }, [canEditLabels, postId, api, props.mode, game]);
    const saveLabels = async () => {
        if (!canEditLabels || !postId || labelSavePending.current) return;
        const patches = Object.values(labelDrafts || {}).filter(patch => game?.stages.some(stage => stage.id === patch.stageId
            && stage.scene.connections.some(edge => edge.id === patch.connectionId && edge.kind === 'action')));
        if (!patches.length) { setEditingLabels(false); setEditingLabel(null); return; }
        labelSavePending.current = true; setLabelsBusy(true); setLabelError(''); ++labelRequest.current;
        try {
            const response = await axios.put(`${api}/spatial-experience/action-labels`, { postId, labels: patches, preview: props.mode !== 'feed' }, { withCredentials: true, timeout: 15000 });
            dispatch(commitActionLabels({ owner: labelOwner, postId, patches, labels: readActionLabels(response.data), revision: readActionLabelRevision(response.data) }));
            setEditingLabels(false); setEditingLabel(null);
        } catch (error: any) {
            setLabelError(error?.response?.data?.message || 'Labels could not be saved. Please try again.');
        } finally { labelSavePending.current = false; setLabelsBusy(false); }
    };
    // Redux keeps a user's choice for this page session. Fresh viewers get a donut; authoring gets a stick.
    const initialControlMode: 'hover' | 'analog' | 'dpad' = viewerHoverActive ? "hover" : preferredControlMode === 'dpad' ? 'dpad'
        : preferredControlMode === 'analog' || creation ? 'analog' : 'hover';
    const activeControlMode = useRef(initialControlMode);
    const [currentControlMode, setCurrentControlMode] = useState(initialControlMode);
    const [driveActive, setDriveActive] = useState(false);
    const theme = useTheme();
    const darkMode = props.mode === "creation" ? theme.palette.mode === 'dark' : Boolean(props.darkMode);
    const alternateAppColor = darkMode ? appColorLight : appColorDark;
    const accentText = darkMode ? "#000" : "#fff";
    const [localPosition, setLocalPosition] = useState<SpatialPosition | null>(game?.entry || null);
    const [gameplayArrivalKey, setGameplayArrivalKey] = useState<string | null>(null);
    const position = creation ? (creation.scene ? { stageId: creation.scene.sceneId, nodeId: creation.scene.activeNodeId } : null) : localPosition;
    const stages = useMemo(() => creation?.stages || usedSpatialStages(game?.stages || [], game?.entry?.stageId), [creation?.stages, game]);
    const stage = stages.find(s => s.id === position?.stageId);
    const rawScene = creation?.scene || stage?.scene || null;
    const [viewChoices, setViewChoices] = useState<Record<string, 'three' | 'video'>>({});
    const threeView = Boolean(rawScene?.ledger && (creation?.view || viewChoices[rawScene.sceneId] || rawScene.ledger.view) === 'three');
    const scene = useMemo(() => rawScene && position ? playableSpatialScene({ ...(threeView ? threePlayableScene(rawScene) : rawScene), activeNodeId: position.nodeId }) : null, [rawScene, position?.nodeId, threeView]);
    const node = scene?.nodes.find(n => n.id === scene.activeNodeId);
    const appearanceFrame = rawScene && node ? spatialAppearanceFrame(rawScene, node.id) : '';
    const [clip, setClip] = useState<SpatialTraversal | null>(null);
    const clipRef = useRef<SpatialTraversal | null>(null);
    const actionHeld = useRef(false);
    useEffect(() => {
        const release = () => { actionHeld.current = false; };
        window.addEventListener('blur', release); document.addEventListener('visibilitychange', release);
        return () => { window.removeEventListener('blur', release); document.removeEventListener('visibilitychange', release); };
    }, []);
    const [history, setHistory] = useState<SpatialLinkVisit[]>([]);
    const historyRef = useRef(history);
    const linkMovementHold = useRef<{ visit: SpatialLinkVisit; elapsedMs: number } | null>(null);
    const linkReturnHold = useRef<{ visit: SpatialLinkVisit; position: SpatialPosition; destination: SpatialPosition; timer: number } | null>(null);
    const [waitingForActionReturn, setWaitingForActionReturn] = useState(false);
    const [actionReviewKey, setActionReviewKey] = useState<string | null>(null);
    const [reviewControlsReady, setReviewControlsReady] = useState(false);
    const replayArrival = useRef<SpatialPosition | null>(null);
    const actionForwardTrail = useRef<Array<{ position: SpatialPosition; link?: SpatialLinkVisit }>>([]);
    const [actionTrailVersion, setActionTrailVersion] = useState(0);
    const [settings, setSettings] = useState(false), [showMap, setShowMap] = useState(false);
    const settingsBodyRef = useRef<HTMLDivElement>(null);
    const [settingsViewport, setSettingsViewport] = useState({ stageIds: '', nodeIds: '', homeVisible: false, mapVisible: false, overflow: false });
    const [listStage, setListStage] = useState(game?.entry?.stageId), [error, setError] = useState("");
    const retryPlayback = useRef<{ position: SpatialPosition; traversal: SpatialTraversal } | null>(null);
    const [controlEpoch, setControlEpoch] = useState(0);
    const [frameRetry, setFrameRetry] = useState(0);
    const [showControlSwitchHint, setShowControlSwitchHint] = useState(true);
    const drive = useRef<JoystickDriveSample | null>(null), recording = useRef(false);
    const feedUiHiddenForDrive = useRef(false);
    const resumeProgress = useRef<number | null>(null), expectedPosition = useRef<SpatialPosition | null>(position);
    const navigationPending = useRef(false);
    const automaticNavigationTrail = useRef(new Set<string>());
    const lastAutomaticNavigation = useRef<string | null>(null);
    const skipAutomaticPosition = useRef<string | null>(null);
    const surfacePointer = useRef<{ pointerId: number; x: number; y: number } | null>(null);
    const lastSurfaceTap = useRef<{ time: number; x: number; y: number } | null>(null);
    const suppressSurfaceClick = useRef(false);
    const [owner] = useState(() => nextCacheOwner--);
    const playbackMuted = props.mode !== "creation" && Boolean(props.muted);
    const playbackMutedRef = useRef(playbackMuted); playbackMutedRef.current = playbackMuted;
    const routes = useRef(new Map<string, SpatialForwardRouteSelections>()), [routeVersion, setRouteVersion] = useState(0);
    const playbackHost = useRef<HTMLDivElement>(null), stopMedia = useRef<(() => void) | null>(null);
    const viewerRoot = useRef<HTMLDivElement>(null);
    const retainedPlayback = useRef<{ video: HTMLVideoElement; stop: () => void; release: () => void } | null>(null);
    const activePlayback = useRef<HTMLVideoElement | null>(null);
    const paintedSurface = useRef('');
    const actionCheckpoint = useRef<{ positionKey: string; timer: number; neutralAt: number | null } | null>(null);
    const latest = useRef({ creation, scene, stages, position }); latest.current = { creation, scene, stages, position };
    const blocked = () => Boolean(latest.current.creation?.isBlocked());
    useEffect(() => {
        const timer = window.setTimeout(() => setShowControlSwitchHint(false), 4000);
        return () => window.clearTimeout(timer);
    }, []);
    useEffect(() => {
        if (controlsHidden) setShowControlSwitchHint(false);
    }, [controlsHidden]);
    useEffect(() => {
        const root = viewerRoot.current;
        if (!root || creation) return;
        const preventSelection = (event: Event) => event.preventDefault();
        root.addEventListener("selectstart", preventSelection);
        return () => root.removeEventListener("selectstart", preventSelection);
    }, [creation]);
    const updateHistory = (next: SpatialLinkVisit[]) => { historyRef.current = next; setHistory(next); };
    const clearActionCheckpoint = () => {
        const checkpoint = actionCheckpoint.current;
        if (checkpoint) window.clearTimeout(checkpoint.timer);
        actionCheckpoint.current = null;
    };
    const clearLinkReturnHold = (updateVisual = true) => {
        if (!linkReturnHold.current) return;
        window.clearTimeout(linkReturnHold.current.timer);
        linkReturnHold.current = null;
        if (updateVisual) setWaitingForActionReturn(false);
    };
    const cancel = (resetControls = true) => {
        actionHeld.current = false;
        clearActionCheckpoint();
        clearLinkReturnHold();
        stopMedia.current?.(); stopMedia.current = null; clipRef.current = null; setClip(null); resumeProgress.current = null;
        recording.current = false;
        if (resetControls) { drive.current = null; linkMovementHold.current = null; setControlEpoch(value => value + 1); }
    };
    const reportError = (message: string) => { cancel(); setError(message); latest.current.creation?.onError(message); };
    const navigate = (destination: SpatialPosition, preserveLinks = false, keepDrive = false, gameplayArrival = false, reviewArrival = false) => {
        const current = latest.current;
        if (navigationPending.current || blocked() || !current.stages.find(s => s.id === destination.stageId)?.scene.nodes.some(n => n.id === destination.nodeId && n.frameUrl)) return false;
        if (current.creation && !current.creation.navigate(destination)) return false;
        const changed = !sameSpatialPosition(current.position, destination);
        // A held stick publishes before React necessarily commits the adapter's node update.
        // Keep it held, but never resolve another route against the previous node in that gap.
        navigationPending.current = changed;
        expectedPosition.current = destination; cancel(!keepDrive); setError(""); setSettings(false);
        replayArrival.current = null;
        setActionReviewKey(reviewArrival ? `${destination.stageId}:${destination.nodeId}` : null);
        if (!preserveLinks) { updateHistory([]); actionForwardTrail.current = []; setActionTrailVersion(value => value + 1); }
        if (!current.creation) {
            setLocalPosition(destination);
            setGameplayArrivalKey(gameplayArrival && changed ? `${destination.stageId}:${destination.nodeId}` : null);
        }
        current.creation?.onNavigate(); return true;
    };
    const rememberRoute = (stageId: string, sourceNodeId: string, connectionId: string) => {
        const selected = routes.current.get(stageId) || {};
        if (selected[sourceNodeId] === connectionId) return;
        routes.current.set(stageId, { ...selected, [sourceNodeId]: connectionId }); setRouteVersion(value => value + 1);
    };
    const recordLinkedMovement = (traversal: SpatialTraversal, elapsedMs: number) => {
        const visit = historyRef.current.at(-1), stageId = latest.current.position?.stageId;
        if (!visit?.returnLocked || visit.destination.stageId !== stageId || traversal.connection.kind === 'action'
            || traversal.destinationNodeId === visit.destination.nodeId) { linkMovementHold.current = null; return; }
        const held = linkMovementHold.current?.visit === visit ? linkMovementHold.current : { visit, elapsedMs: 0 };
        held.elapsedMs += elapsedMs; linkMovementHold.current = held;
        if (held.elapsedMs >= 1000) { updateHistory(spatialUnlockLinkReturn(historyRef.current, stageId)); linkMovementHold.current = null; }
    };
    const play = (traversal: SpatialTraversal) => {
        if (navigationPending.current || blocked() || clipRef.current || !latest.current.scene) return false;
        clearLinkReturnHold();
        resumeProgress.current = null; recording.current = false;
        rememberRoute(latest.current.scene.sceneId, traversal.connection.sourceNodeId, traversal.connection.id);
        clipRef.current = traversal; setClip(traversal); setError(""); latest.current.creation?.onPlaybackStart(traversal); return true;
    };
    const startActionCheckpoint = (destination: SpatialPosition) => {
        clearActionCheckpoint();
        const positionKey = `${destination.stageId}:${destination.nodeId}`;
        const timer = window.setTimeout(() => {
            const checkpoint = actionCheckpoint.current;
            if (!checkpoint || checkpoint.positionKey !== positionKey) return;
            actionCheckpoint.current = null;
            const current = latest.current, sample = drive.current;
            if (!sample?.active || sample.radius < 0.08 || !sameSpatialPosition(current.position, destination) || !current.scene) return;
            const traversal = spatialTraversalForDrive(current.scene, sample);
            if (traversal) play(traversal);
        }, ACTION_CHECKPOINT_DWELL_MS);
        actionCheckpoint.current = { positionKey, timer, neutralAt: null };
    };
    const activate = () => {
        const current = latest.current;
        if (navigationPending.current || blocked() || clipRef.current || !current.scene || !current.position) return false;
        const action = spatialAction(current.scene, current.stages);
        if (!action) return false;
        clearActionCheckpoint();
        actionForwardTrail.current = []; setActionTrailVersion(value => value + 1); setActionReviewKey(null);
        if (action.kind === "video") return play(action.traversal);
        if (!action.destination) { reportError("LINK DESTINATION UNAVAILABLE"); return true; }
        const source = current.position;
        if (navigate(action.destination, true, false, action.kind === "link") && action.kind === "link") updateHistory([...historyRef.current,
            { source, destination: action.destination, returnLocked: Boolean(spatialActionReplay(current.scene)) }]);
        return true;
    };
    const actionCursor = () => {
        const current = latest.current;
        const activeClip = clipRef.current;
        const cursor = current.position && activeClip?.connection.kind === 'action'
            ? { ...current.position, nodeId: activeClip.destinationNodeId } : current.position;
        return { ...current, position: cursor, scene: current.scene && cursor ? { ...current.scene, activeNodeId: cursor.nodeId } : null };
    };
    const arriveAction = (destination: SpatialPosition, keepDrive = false) => {
        const target = latest.current.stages.find(stage => stage.id === destination.stageId)?.scene;
        const actionResult = target?.connections.some(edge => edge.kind === 'action' && edge.targetNodeId === destination.nodeId);
        skipAutomaticPosition.current = `${destination.stageId}:${destination.nodeId}`;
        if (!navigate(destination, true, keepDrive, false, Boolean(actionResult))) { skipAutomaticPosition.current = null; return false; }
        replayArrival.current = actionResult ? destination : null;
        return true;
    };
    const back = () => {
        const current = latest.current, destination = current.scene && spatialBackDestination(current.scene, historyRef.current,
            { skipActionResults: !current.creation, stages: current.stages });
        if (!destination) return false;
        skipAutomaticPosition.current = `${destination.position.stageId}:${destination.position.nodeId}`;
        if (!navigate(destination.position, true)) { skipAutomaticPosition.current = null; return false; }
        actionForwardTrail.current = []; setActionTrailVersion(value => value + 1);
        if (destination.popLink) updateHistory(historyRef.current.slice(0, -1)); return true;
    };
    const backAction = () => {
        const current = actionCursor(), destination = current.scene && spatialBackDestination(current.scene, historyRef.current);
        if (!destination) return false;
        const link = destination.popLink ? historyRef.current.at(-1) : undefined;
        if (!arriveAction(destination.position)) return false;
        if (current.position) actionForwardTrail.current.push({ position: current.position, link });
        setActionTrailVersion(value => value + 1);
        if (destination.popLink) updateHistory(historyRef.current.slice(0, -1)); return true;
    };
    const forwardAction = () => {
        const current = actionCursor();
        if (!current.scene || !current.position) return false;
        const redo = actionForwardTrail.current.at(-1);
        const destination = redo?.position || spatialActionForwardDestination(current.scene, current.stages);
        if (!destination) return false;
        const action = spatialAction(current.scene, current.stages);
        const link = redo?.link || (action?.kind === 'link' && sameSpatialPosition(action.destination, destination)
            ? { source: current.position, destination } : undefined);
        if (!arriveAction(destination)) return false;
        if (redo) actionForwardTrail.current.pop();
        setActionTrailVersion(value => value + 1);
        if (link) updateHistory([...historyRef.current, { ...link, returnLocked: Boolean(spatialActionReplay(current.scene)) }]);
        return true;
    };
    const home = () => {
        const current = latest.current;
        const destination = current.creation && current.scene?.nodes[0] ? { stageId: current.scene.sceneId, nodeId: current.scene.nodes[0].id } : game?.entry;
        return destination ? navigate(destination) : false;
    };
    useImperativeHandle(ref, () => ({ activate, back, home, cancel, rememberRoute,
        holdAction: held => { actionHeld.current = held; if (held && !clipRef.current) activate(); },
        jump: nodeId => latest.current.position ? navigate({ ...latest.current.position, nodeId }) : false }));
    // JSON replacement starts a new preview. Live editor updates do not reset playback.
    useLayoutEffect(() => {
        if (!game) return;
        navigationPending.current = false;
        cancel(); updateHistory([]); actionForwardTrail.current = []; replayArrival.current = null; setActionReviewKey(null);
        setLocalPosition(game.entry); setGameplayArrivalKey(null); expectedPosition.current = game.entry; setError("");
    }, [game]);
    useLayoutEffect(() => {
        navigationPending.current = false;
        if (!sameSpatialPosition(position, expectedPosition.current)) {
            cancel(); updateHistory([]); setError(""); latest.current.creation?.onNavigate();
        }
        expectedPosition.current = position;
    }, [position?.stageId, position?.nodeId]);
    useLayoutEffect(() => {
        if (clip && !scene?.connections.some(c => c.id === clip.connection.id && c.forward?.videoUrl === clip.connection.forward?.videoUrl)) cancel();
    }, [scene]);
    const canBack = Boolean(scene && spatialBackDestination(scene, history, { skipActionResults: !creation, stages }));
    useEffect(() => {
        const pending = replayArrival.current;
        if (!pending || !sameSpatialPosition(pending, position) || navigationPending.current || !scene || clipRef.current || blocked()) return;
        replayArrival.current = null;
        const replay = spatialActionReplay(scene);
        if (replay) { skipAutomaticPosition.current = null; play(replay); }
    }, [position?.stageId, position?.nodeId, actionReviewKey, controlEpoch, scene]);
    useEffect(() => { latest.current.creation?.onStateChange({ position, clip, canBack }); }, [position?.stageId, position?.nodeId, clip, canBack]);
    useEffect(() => {
        if (threeView) { spatialVideoRamCache.releaseScene(owner); return; }
        if (!scene) { spatialVideoRamCache.releaseScene(owner); return; }
        const plan = buildSpatialVideoCachePlan(playableSpatialScene(scene), owner, routes.current.get(scene.sceneId) || {}, 5, clip?.destinationNodeId);
        // Prepare the exact action/link target without traversing the experience.
        const arrivalScene = clip ? { ...scene, activeNodeId: clip.destinationNodeId } : scene;
        const arrival = spatialAction(arrivalScene, stages);
        const returning = spatialLinkReturn(scene, historyRef.current, stages);
        const target = arrival?.kind === 'link' ? arrival.destination : returning?.position;
        if (target) {
            const linked = stages.find(stage => stage.id === target.stageId)?.scene;
            if (linked) {
                const targetScene = { ...linked, activeNodeId: target.nodeId };
                const replay = spatialActionReplay(targetScene);
                const linkedPlan = buildSpatialVideoCachePlan(playableSpatialScene(targetScene), owner, {}, 1);
                if (replay) plan.assets.unshift({ url: replay.video.videoUrl, connectionId: replay.connection.id,
                    assetDirection: 'forward', slotDirection: 'forward', distance: 1 });
                plan.assets.push(...linkedPlan.assets.slice(0, 4));
            }
        }
        // Pin both live traversal assets even when edits change the lookahead window.
        if (clip) for (const direction of ["forward", "backward"] as const) {
            const asset = clip.connection[direction];
            if (asset) plan.assets.unshift({ url: asset.videoUrl, connectionId: clip.connection.id,
                assetDirection: direction, slotDirection: direction, distance: 0 });
        }
        plan.assets = uniqueSpatialVideoAssets(plan.assets).slice(0, 20);
        spatialVideoRamCache.reconcile(plan);
    }, [scene, clip, routeVersion, owner, threeView, stages, history]);
    useLayoutEffect(() => {
        if (!threeView) return;
        retainedPlayback.current?.stop(); retainedPlayback.current?.release(); retainedPlayback.current = null;
    }, [threeView]);
    useEffect(() => () => {
        clearActionCheckpoint();
        clearLinkReturnHold(false);
        stopMedia.current?.();
        retainedPlayback.current?.stop(); retainedPlayback.current?.release(); retainedPlayback.current = null;
        spatialVideoRamCache.releaseScene(owner);
    }, [owner]);
    useEffect(() => {
        if (!clip || !playbackHost.current) return;
        if (threeView && rawScene?.ledger) {
            // Each direction plays its saved plan, exactly like its generated video.
            const animation = rawScene.ledger.routes[clip.connection.id]?.[clip.direction];
            if (!animation) { reportError('This 3D route is unavailable.'); return; }
            const canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block';
            playbackHost.current.appendChild(canvas);
            let renderer: ReturnType<typeof createMotionRenderer>;
            const aspect = rawScene.ledger.world.aspectRatio;
            const [width, height] = aspect === '9:16' ? [540, 960] : aspect === '1:1' ? [720, 720] : [960, 540];
            try { renderer = createMotionRenderer(canvas, animation.plan, width, height, animation.authoring); }
            catch (error) { canvas.remove(); reportError(`3D playback failed: ${(error as Error).message}`); return; }
            const progress = resumeProgress.current ?? (clip.direction === 'forward' ? 0 : 1); resumeProgress.current = null;
            const duration = animation.plan.duration;
            let raf = 0, elapsed = (clip.direction === 'forward' ? progress : 1 - progress) * duration, previous = performance.now(), stopped = false;
            const draw = (now: number) => {
                if (stopped) return;
                const delta = Math.min(.05, (now - previous) / 1000); previous = now;
                const sample = drive.current, axis = clip.connection.movement.samples.at(-1);
                const movement = clip.connection.kind !== 'action';
                const denominator = sample && axis ? Math.hypot(sample.x, sample.y) * Math.hypot(axis.x, axis.y) : 0;
                const alignment = sample?.active && sample.radius >= .08 && axis && denominator ? (sample.x * axis.x + sample.y * axis.y) / denominator : 0;
                if (movement && Math.abs(alignment) >= .35 && (alignment > 0 ? 'forward' : 'backward') !== clip.direction) {
                    const direction = alignment > 0 ? 'forward' : 'backward';
                    if (rawScene.ledger?.routes[clip.connection.id]?.[direction]) {
                        resumeProgress.current = clip.direction === 'forward' ? elapsed / duration : 1 - elapsed / duration;
                        const next: SpatialTraversal = { ...clip, direction, destinationNodeId: direction === 'forward' ? clip.connection.targetNodeId : clip.connection.sourceNodeId, video: clip.connection[direction]! };
                        clipRef.current = next; setClip(next); return;
                    }
                }
                const advancing = movement ? (clip.direction === 'forward' ? alignment >= .35 : alignment <= -.35)
                    : clip.connection.actionPlayback !== 'hold' || actionHeld.current;
                if (advancing) {
                    if (movement) recordLinkedMovement(clip, Math.min(delta, duration - elapsed) * 1000);
                    elapsed += delta;
                }
                renderer.draw(Math.min(duration, elapsed));
                if (elapsed >= duration) {
                    if (latest.current.position) {
                        const destination = { ...latest.current.position, nodeId: clip.destinationNodeId };
                        const destinationScene = latest.current.scene ? { ...latest.current.scene, activeNodeId: clip.destinationNodeId } : null;
                        const destinationAction = destinationScene ? spatialAction(destinationScene, latest.current.stages) : null;
                        if (navigate(destination, true, movement, true) && movement && destinationAction?.kind === 'video') startActionCheckpoint(destination);
                    }
                    return;
                }
                raf = requestAnimationFrame(draw);
            };
            raf = requestAnimationFrame(draw);
            const cleanup = () => { stopped = true; cancelAnimationFrame(raf); renderer.dispose(); canvas.remove(); };
            stopMedia.current = cleanup;
            return cleanup;
        }
        const lease = spatialVideoRamCache.acquirePlayback(clip.video.videoUrl);
        if (!lease) { reportError("Playback failed (cache-entry-missing). Try again."); return; }
        const el = lease.video;
        activePlayback.current = el;
        el.style.cssText = `width:100%;height:100%;object-fit:${creation?.objectFit || "contain"};display:block;background:#000;visibility:${creation ? "visible" : "hidden"}`;
        playbackHost.current.appendChild(el);
        const progress = resumeProgress.current; resumeProgress.current = null;
        let disposed = false;
        const session = { video: el, stop: () => {}, release: lease.release };
        const stop = attachSpatialPlayback({ video: el, traversal: clip, progress, drive: () => drive.current,
            muted: () => playbackMutedRef.current,
            actionHeld: () => actionHeld.current,
            waitForSeekBeforePlayback: !creation,
            onVisualReady: () => {
                if (disposed) return;
                el.style.visibility = "visible";
                if (creation) return;
                const previous = retainedPlayback.current;
                retainedPlayback.current = session;
                if (previous && previous !== session) { previous.stop(); previous.release(); }
            },
            onDirection: (next, progress) => { if (!disposed) { resumeProgress.current = progress; clipRef.current = next; setClip(next); } },
            onMovementAdvance: elapsedMs => { if (!disposed) recordLinkedMovement(clip, elapsedMs); },
            onFinish: nodeId => {
                if (disposed || !latest.current.position) return;
                const destination = { ...latest.current.position, nodeId };
                const destinationScene = latest.current.scene ? { ...latest.current.scene, activeNodeId: nodeId } : null;
                const destinationAction = destinationScene ? spatialAction(destinationScene, latest.current.stages) : null;
                const shouldPauseForAction = clip.connection.kind !== "action" && destinationAction?.kind === "video";
                const latchedSample = drive.current;
                const hasNextLatchedMovement = Boolean(destinationScene && latchedSample?.active && latchedSample.radius >= 0.08
                    && spatialTraversalForDrive(destinationScene, latchedSample));
                const shouldResetMobileDonut = clip.connection.kind !== "action" && !creation && matchMobile
                    && activeControlMode.current === "hover" && !hasNextLatchedMovement;
                if (!navigate(destination, true, clip.connection.kind !== "action", true)) { cancel(); return; }
                if (shouldResetMobileDonut) {
                    // Keep the active highlight for the entire clip, then unlatch
                    // only after its destination has no route in that direction.
                    drive.current = null;
                    setControlEpoch(value => value + 1);
                } else if (shouldPauseForAction) startActionCheckpoint(destination);
            },
            onError: reason => {
                if (disposed) return;
                if (latest.current.position) retryPlayback.current = { position: latest.current.position, traversal: clip };
                reportError(`Playback failed (${reason}). Try again.`);
            } });
        session.stop = stop;
        const cleanup = () => {
            if (disposed) return;
            disposed = true; stop();
            if (activePlayback.current === el) activePlayback.current = null;
            if (creation || retainedPlayback.current !== session) lease.release();
        };
        stopMedia.current = cleanup;
        return () => { cleanup(); if (stopMedia.current === cleanup) stopMedia.current = null; };
    }, [clip, threeView]);
    useEffect(() => {
        const video = activePlayback.current;
        if (video) video.muted = playbackMuted;
    }, [playbackMuted]);
    const releaseIdlePlayback = () => {
        const current = latest.current;
        if (creation || clipRef.current || !current.scene || !current.position
            || paintedSurface.current !== `${current.position.stageId}:${current.position.nodeId}`) return;
        const sample = drive.current;
        // Keep the outgoing frame across the short React/input gap before the
        // next eligible movement. Intentional action checkpoints remain idle.
        if (!actionCheckpoint.current && !actionReviewKey && sample?.active
            && spatialTraversalForDrive(current.scene, sample)) return;
        const retained = retainedPlayback.current;
        if (retained) { retainedPlayback.current = null; retained.stop(); retained.release(); }
    };
    useLayoutEffect(releaseIdlePlayback, [clip, driveActive, controlEpoch, position?.stageId, position?.nodeId, actionReviewKey]);
    const onDrive = (sample: JoystickDriveSample) => {
        setDriveActive(previous => previous === sample.active ? previous : sample.active);
        if (sample.active && blocked()) { clearLinkReturnHold(); return; }
        if (!sample.active) feedUiHiddenForDrive.current = false;
        else if (props.mode === "feed" && sample.radius >= 0.08 && !feedUiHiddenForDrive.current) {
            feedUiHiddenForDrive.current = true;
            props.onSurfaceTap?.();
        }
        drive.current = sample; latest.current.creation?.onDrive(sample);
        if (!sample.active || sample.radius < .08) { linkMovementHold.current = null; clearLinkReturnHold(); }
        const checkpoint = actionCheckpoint.current;
        if (checkpoint) {
            if (!sample.active || sample.radius < 0.08) {
                checkpoint.neutralAt ??= performance.now();
                return;
            }
            if (checkpoint.neutralAt === null || performance.now() - checkpoint.neutralAt < ACTION_CHECKPOINT_NEUTRAL_MS) return;
            clearActionCheckpoint();
        }
        if (navigationPending.current || clipRef.current || !sample.active || sample.radius < 0.08 || !latest.current.scene) { clearLinkReturnHold(); return; }
        if (latest.current.creation?.capturesDrive?.()) {
            recording.current = true; latest.current.creation.onUnmatchedDrive(sample); return;
        }
        // Saved movement takes priority even if the drag began off-axis.
        // play() and the creation adapter discard the tentative recording on a match.
        const traversal = spatialTraversalForDrive(latest.current.scene, sample);
        if (traversal) { actionForwardTrail.current = []; setActionTrailVersion(value => value + 1); setActionReviewKey(null); play(traversal); return; }
        if (!latest.current.creation) {
            const destination = spatialLinkReturnForDrive(latest.current.scene, historyRef.current, latest.current.stages, sample);
            if (destination) {
                const link = historyRef.current.at(-1);
                const target = latest.current.stages.find(stage => stage.id === destination.stageId)?.scene;
                const isAction = target && spatialActionReplay({ ...target, activeNodeId: destination.nodeId });
                const returnToSource = () => {
                    const position = latest.current.position;
                    if (arriveAction(destination, !isAction)) {
                        if (position) actionForwardTrail.current.push({ position, link });
                        setActionTrailVersion(value => value + 1); updateHistory(historyRef.current.slice(0, -1));
                    }
                };
                if (isAction && link && latest.current.position) {
                    // Only eligible input at the linked entry starts this hold.
                    // Travel time and the separate movement-unlock guard never contribute.
                    const held = linkReturnHold.current;
                    if (held?.visit === link && sameSpatialPosition(held.position, latest.current.position)
                        && sameSpatialPosition(held.destination, destination)) return;
                    clearLinkReturnHold();
                    const position = latest.current.position;
                    const timer = window.setTimeout(() => {
                        const pending = linkReturnHold.current, current = latest.current, sample = drive.current;
                        if (!pending || pending.timer !== timer) return;
                        clearLinkReturnHold();
                        if (navigationPending.current || blocked() || clipRef.current || !current.scene || !sample
                            || historyRef.current.at(-1) !== link || !sameSpatialPosition(current.position, position)
                            || !sameSpatialPosition(spatialLinkReturnForDrive(current.scene, historyRef.current, current.stages, sample), destination)) return;
                        returnToSource();
                    }, ACTION_LINK_RETURN_HOLD_MS);
                    linkReturnHold.current = { visit: link, position, destination, timer };
                    setWaitingForActionReturn(true);
                } else {
                    clearLinkReturnHold();
                    returnToSource();
                }
                return;
            }
        }
        clearLinkReturnHold();
        if (latest.current.creation) { recording.current = true; latest.current.creation.onUnmatchedDrive(sample); }
    };
    const onDriveEnd = (sample: JoystickDriveSample) => {
        clearLinkReturnHold();
        setDriveActive(false);
        drive.current = null; latest.current.creation?.onDrive(idleDrive());
        if (recording.current && !clipRef.current) latest.current.creation?.onUnmatchedDriveEnd(sample);
        recording.current = false;
    };
    const onDriveCancel = () => {
        clearLinkReturnHold();
        setDriveActive(false); drive.current = null;
        if (recording.current) latest.current.creation?.onUnmatchedDriveCancel?.();
        recording.current = false;
    };
    const action = scene ? spatialAction(scene, stages) : null, actionPlaying = clip?.connection.kind === "action";
    const cursor = actionCursor();
    const showActionNavigation = Boolean(actionReviewKey && position && actionReviewKey === `${position.stageId}:${position.nodeId}`);
    useLayoutEffect(() => {
        setReviewControlsReady(false);
        if (!showActionNavigation) return;
        const timer = window.setTimeout(() => setReviewControlsReady(true), 500);
        return () => window.clearTimeout(timer);
    }, [showActionNavigation, actionReviewKey, Boolean(clip), controlEpoch]);
    const canStepBack = Boolean(cursor.scene && spatialBackDestination(cursor.scene, history));
    const canStepForward = Boolean(actionForwardTrail.current.length || cursor.scene && spatialActionForwardDestination(cursor.scene, stages));
    const isSpatialComplete = Boolean(!creation && !clip && position && gameplayArrivalKey === `${position.stageId}:${position.nodeId}`
        && scene && spatialIsTerminalNode(scene, stages));
    const linkReturn = !creation && scene ? spatialLinkReturn(scene, history, stages) : null;
    const availableDirections = spatialDirections(scene, clip, linkReturn?.axes);
    const canDrive = !isSpatialComplete || Object.values(availableDirections).some(Boolean);
    const selectedStage = stages.find(s => s.id === listStage);
    useEffect(() => {
        const body = settingsBodyRef.current;
        if (!settings || !body) {
            setSettingsViewport(previous => previous.stageIds || previous.nodeIds || previous.homeVisible || previous.mapVisible || previous.overflow
                ? { stageIds: '', nodeIds: '', homeVisible: false, mapVisible: false, overflow: false } : previous);
            return;
        }
        const measure = () => {
            const drawer = body.closest<HTMLElement>('.MuiDrawer-paper');
            const clip = drawer?.getBoundingClientRect();
            const intersects = (element: HTMLElement) => {
                const rect = element.getBoundingClientRect();
                return rect.bottom > Math.max(0, clip?.top ?? 0)
                    && rect.top < Math.min(window.innerHeight, clip?.bottom ?? window.innerHeight)
                    && rect.right > Math.max(0, clip?.left ?? 0)
                    && rect.left < Math.min(window.innerWidth, clip?.right ?? window.innerWidth);
            };
            const visible = (selector: string, attribute: string) => Array.from(body.querySelectorAll<HTMLElement>(selector))
                .filter(intersects).map(element => element.getAttribute(attribute) || '').filter(Boolean);
            const stageIds = visible('[data-spatial-stage-choice]', 'data-spatial-stage-choice');
            const nodeIds = visible('[data-spatial-node-choice]', 'data-spatial-node-choice');
            const next = { stageIds: stageIds.slice(0, 16).join(','), nodeIds: nodeIds.slice(0, 16).join(','),
                homeVisible: Boolean(body.querySelector<HTMLElement>('[data-spatial-home]') && intersects(body.querySelector<HTMLElement>('[data-spatial-home]')!)),
                mapVisible: Boolean(body.querySelector<HTMLElement>('[data-spatial-map]') && intersects(body.querySelector<HTMLElement>('[data-spatial-map]')!)),
                overflow: stageIds.length > 16 || nodeIds.length > 16 };
            setSettingsViewport(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
        };
        const frame = window.requestAnimationFrame(measure);
        const afterDrawerTransition = window.setTimeout(measure, 360);
        document.addEventListener('scroll', measure, true);
        window.addEventListener('resize', measure);
        return () => { window.cancelAnimationFrame(frame); window.clearTimeout(afterDrawerTransition); document.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure); };
    }, [settings, listStage, stages]);
    useEffect(() => {
        const areaId: FeedAreaId = 'clikb.feeds.spatial';
        if (props.mode !== 'feed') return;
        const control = (name: string, handlerRef: string, policy: FeedControl['aiPolicy'] = 'candidate', targetId?: string, enabled = true): FeedControl => ({
            controlId: `${areaId}.${name}`, areaId, handlerRef, enabled, aiPolicy: policy,
            ...(targetId ? { targetId } : {}),
            ...(!enabled ? { disabledReason: 'No stage is selected' } : {}),
            ...(policy === 'candidate' ? { candidateActionId: `${areaId}.${name}` } : {}),
        });
        const directions = availableDirections;
        const controls: FeedControl[] = controlsHidden || props.snapshotObscured || editingLabel ? [] : settings && !actionPlaying ? [
            control('close_settings', 'SpatialExperiencePlayer.setSettings(false)'),
            ...(settingsViewport.homeVisible ? [control('home', 'SpatialExperiencePlayer.home')] : []),
            ...(settingsViewport.mapVisible ? [control('toggle_map', 'SpatialExperiencePlayer.setShowMap', 'candidate', undefined, Boolean(selectedStage))] : []),
            ...settingsViewport.stageIds.split(',').filter(Boolean).map(id =>
                control(`select_stage_${encodeURIComponent(id).slice(0, 60)}`, 'SpatialExperiencePlayer.setListStage', 'candidate', id)),
            ...settingsViewport.nodeIds.split(',').filter(Boolean).map(id =>
                control(`jump_node_${encodeURIComponent(id).slice(0, 60)}`, 'SpatialExperiencePlayer.navigate', 'candidate', id)),
        ] : actionPlaying ? [
            ...(showActionNavigation && reviewControlsReady && canStepBack ? [control('action_step_back', 'SpatialExperiencePlayer.backAction', 'manual_only')] : []),
            ...(showActionNavigation && reviewControlsReady && canStepForward ? [control('action_step_forward', 'SpatialExperiencePlayer.forwardAction', 'manual_only')] : []),
        ] : [
            control('open_settings', 'SpatialExperiencePlayer.setSettings(true)'),
            ...(canBack ? [control('back', 'SpatialExperiencePlayer.back')] : []),
            ...(isSpatialComplete ? [control('home', 'SpatialExperiencePlayer.home')] : []),
            ...(showActionNavigation && reviewControlsReady && canStepBack ? [control('action_step_back', 'SpatialExperiencePlayer.backAction', 'manual_only')] : []),
            ...(showActionNavigation && reviewControlsReady && canStepForward ? [control('action_step_forward', 'SpatialExperiencePlayer.forwardAction', 'manual_only')] : []),
            ...(action?.kind === 'video' && !clip && !showActionNavigation ? [control('activate_interaction',
                action.traversal.connection.actionPlayback === 'hold' ? 'SpatialExperiencePlayer pointer hold/release' : 'SpatialExperiencePlayer.activate',
                action.traversal.connection.actionPlayback === 'hold' ? 'manual_only' : 'candidate')] : []),
            ...(canDrive && !showActionNavigation ? [control('drive', 'SpatialExperiencePlayer.onDrive/onDriveEnd', 'manual_only'),
                control('switch_control_mode', 'VirtualJoystickDrive.onSwitchMode', 'manual_only')] : []),
        ];
        dispatch(publishFeedsArea({ areaId, source: 'SpatialExperiencePlayer', instanceId: 'spatial',
            state: {
                status: !scene || !node || !stage ? 'unavailable' : clip ? 'playing' : isSpatialComplete ? 'complete' : 'ready',
                stageId: boundedFeedTextHint(position?.stageId, 64),
                nodeId: boundedFeedTextHint(position?.nodeId, 64),
                stageLabel: boundedFeedTextHint(stage?.label, 64),
                nodeLabel: boundedFeedTextHint(node?.label, 64),
                controlMode: currentControlMode,
                driveActive, controlsHidden, obscuredByOverlay: Boolean(props.snapshotObscured || editingLabel), settingsOpen: settings && !actionPlaying,
                mapOpen: showMap, canBack, actionKind: action?.kind ?? '',
                clipPlaying: Boolean(clip), complete: isSpatialComplete,
                canDriveTop: directions.top, canDriveRight: directions.right,
                canDriveBottom: directions.bottom, canDriveLeft: directions.left,
                selectedStageId: boundedFeedTextHint(listStage, 64),
                visibleStageIds: settingsViewport.stageIds,
                visibleNodeIds: settingsViewport.nodeIds,
                homeVisible: settingsViewport.homeVisible || isSpatialComplete,
                mapVisible: settingsViewport.mapVisible,
                settingsControlOverflow: settingsViewport.overflow,
                stageCount: stages.length, selectedStageNodeCount: selectedStage?.scene.nodes.filter(n => n.frameUrl).length ?? 0,
                errorHint: '',
            }, visiblePosts: [], visibleControls: controls,
        }));
    }, [dispatch, props.mode, scene, clip, position?.stageId, position?.nodeId, stage, node,
        currentControlMode, driveActive, controlsHidden, props.mode !== 'creation' && props.snapshotObscured, settings, showMap, canBack,
        action?.kind, actionPlaying, isSpatialComplete, canDrive, availableDirections.top, availableDirections.right,
        availableDirections.bottom, availableDirections.left, editingLabel, listStage, stages, settingsViewport,
        actionReviewKey, actionTrailVersion, showActionNavigation, reviewControlsReady, canStepBack, canStepForward]);
    useEffect(() => () => {
        if (props.mode === 'feed') dispatch(removeFeedsArea({ areaId: 'clikb.feeds.spatial', source: 'SpatialExperiencePlayer' }));
    }, [dispatch, props.mode]);
    const automaticAction = action?.kind === "link" || action?.kind === "backtrack" ? action : null;
    useLayoutEffect(() => {
        if (creation || clip || actionReviewKey === `${position?.stageId}:${position?.nodeId}`) {
            automaticNavigationTrail.current.clear();
            lastAutomaticNavigation.current = null;
            return;
        }
        if (!automaticAction || !position) {
            automaticNavigationTrail.current.clear();
            lastAutomaticNavigation.current = null;
            return;
        }
        const positionKey = `${position.stageId}:${position.nodeId}`;
        if (skipAutomaticPosition.current === positionKey) {
            skipAutomaticPosition.current = null;
            automaticNavigationTrail.current.clear();
            lastAutomaticNavigation.current = null;
            return;
        }
        const destination = automaticAction.destination;
        const key = `${position.stageId}:${position.nodeId}:${automaticAction.kind}:${destination?.stageId || "missing"}:${destination?.nodeId || "missing"}`;
        // React development checks can run the same effect twice for one arrival.
        if (lastAutomaticNavigation.current === key) return;
        if (automaticNavigationTrail.current.has(key)) {
            setError(current => current || "Automatic navigation loop stopped.");
            return;
        }
        automaticNavigationTrail.current.add(key);
        lastAutomaticNavigation.current = key;
        activate();
    }, [creation, clip, actionReviewKey, position?.stageId, position?.nodeId, automaticAction?.kind,
        automaticAction?.destination?.stageId, automaticAction?.destination?.nodeId]);
    const round = { background: darkMode ? 'rgba(20,20,20,.9)' : 'rgba(255,255,255,.94)', color: appColor, border: `1px solid ${alpha(appColor, .35)}`, width: 48, height: 48, "&:hover": { background: alpha(appColor, .2) } };
    const actionChrome = { background: darkMode ? 'rgba(8,10,16,.72)' : 'rgba(255,255,255,.94)', color: darkMode ? '#fff' : '#111',
        border: `1px solid ${darkMode ? 'rgba(255,255,255,.48)' : 'rgba(0,0,0,.25)'}`, backdropFilter: 'blur(16px)',
        '&:hover': { background: darkMode ? 'rgba(8,10,16,.88)' : '#fff' } };
    const actionButtonChrome = { background: darkMode ? '#fff' : '#080a10', color: darkMode ? '#111' : '#fff',
        border: `2px solid ${darkMode ? '#000' : '#fff'}`, '--spatial-action-border': darkMode ? '#000' : '#fff',
        '&:hover': { background: darkMode ? '#fff' : '#080a10' } };
    const surface = <>
        {!creation?.hideSurface && node?.frameUrl && <div data-spatial-stage={position?.stageId} data-spatial-node={node.id} style={{ position: "absolute", inset: 0, zIndex: 20, pointerEvents: "none" }}>
            {threeView && rawScene?.ledger ? <SpatialWorldViewport world={rawScene.ledger.world} state={rawScene.ledger.states[node.id] || rawScene.ledger.world.initialState} onError={setError} /> : <SpatialSceneSurface retryKey={frameRetry} frameUrl={appearanceFrame} frameKey={`${position?.stageId}:${node.id}:${clip ? 'playing' : 'idle'}:${controlEpoch}`} video={null} onError={setError} objectFit={creation?.objectFit} onReady={readyFrameUrl => {
                if (readyFrameUrl === appearanceFrame) setError(current => current === 'The stage image could not load.' ? '' : current);
                if (creation || clipRef.current || !latest.current.scene || readyFrameUrl !== spatialAppearanceFrame(latest.current.scene, latest.current.position?.nodeId || '')) return;
                paintedSurface.current = `${latest.current.position?.stageId}:${latest.current.position?.nodeId}`;
                releaseIdlePlayback();
            }} />}
        </div>}
        <div ref={playbackHost} data-spatial-playback={clip?.direction} style={{ position: "absolute", inset: 0,
            zIndex: actionPlaying && !creation ? 40000 : 30, pointerEvents: actionPlaying ? "auto" : "none" }} />
        {!controlsHidden && canDrive && <Box className="spatial-link-return-controller" data-spatial-return-hold={waitingForActionReturn ? 'true' : undefined} sx={{ display: 'contents', '--spatial-return-color': appColor }}><VirtualJoystickDrive resetKey={controlEpoch} {...creation?.joystick} accentColor={appColor} initialControlMode={initialControlMode} allowHoverMode showSwitchHint={showControlSwitchHint} switchHintColor={appColor} switchHintTextColor={accentText} switchHintLabel={`${matchMobile ? "Double-tap" : "Double-click"}${initialControlMode === "hover" ? " centre" : ""} to switch`} onSwitchMode={mode => { clearLinkReturnHold(); activeControlMode.current = mode; setCurrentControlMode(mode); if (mode === "hover") dispatch(setSpatialViewerHoverActive(true)); else { dispatch(setSpatialControlMode(mode)); dispatch(setSpatialViewerHoverActive(false)); } setShowControlSwitchHint(false); }} onDrive={onDrive} onDriveEnd={onDriveEnd} onDriveCancel={onDriveCancel}
            hidden={showActionNavigation} darkMode={darkMode} disabled={Boolean(actionPlaying || creation?.joystick?.disabled || blocked())}
            availableDirections={availableDirections} limitToAvailableDirections={!creation || Boolean(clip)} /></Box>}
        {!controlsHidden && showActionNavigation && <SpatialActionNavigation mode={currentControlMode} visible={reviewControlsReady} controllerSize={creation?.joystick?.size || 132}
            canBack={canStepBack && !blocked()} canForward={canStepForward && !blocked()} onBack={backAction} onForward={forwardAction} />}
    </>;
    if (creation) return <>{surface}</>;
    if (!scene || !node || !stage) return props.mode === 'feed' ? null : <Alert severity="info">No stages are ready to preview yet.</Alert>;
    return <SpatialTheme darkMode={darkMode}><Box
        ref={viewerRoot}
        data-spatial-mode={props.mode || "preview"}
        onPointerDown={(event) => {
            const interactive = event.target instanceof Element && event.target.closest("button,[role='slider'],[role='group']");
            const driveControl = event.target instanceof Element && event.target.closest("[role='slider'],[role='group']");
            if (matchMobile && activeControlMode.current === "hover" && !driveControl) setControlEpoch(value => value + 1);
            if (!event.isPrimary || event.button !== 0 || interactive) return;
            window.getSelection()?.removeAllRanges();
            surfacePointer.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event) => {
            const start = surfacePointer.current;
            surfacePointer.current = null;
            if (!start || start.pointerId !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12
                || actionPlaying || !canBack || (event.target instanceof Element && event.target.closest("button,[role='slider'],[role='group']"))) return;
            const now = performance.now(), previous = lastSurfaceTap.current;
            if (previous && now - previous.time <= 360 && Math.hypot(event.clientX - previous.x, event.clientY - previous.y) <= 28) {
                lastSurfaceTap.current = null;
                suppressSurfaceClick.current = true;
                event.preventDefault(); event.stopPropagation();
                back();
                return;
            }
            lastSurfaceTap.current = { time: now, x: event.clientX, y: event.clientY };
        }}
        onPointerCancel={() => { surfacePointer.current = null; }}
        onDoubleClick={(event) => {
            if (!(event.target instanceof Element && event.target.closest("button,[role='slider'],[role='group']"))) event.preventDefault();
        }}
        onClick={(event) => {
            if (suppressSurfaceClick.current) { suppressSurfaceClick.current = false; event.preventDefault(); event.stopPropagation(); return; }
            if (event.currentTarget === event.target) props.onSurfaceTap?.();
        }}
        sx={{ position: "relative", width: "100%", height: "100%", background: "#080808", overflow: "hidden", touchAction: "manipulation",
            userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent" }}
    >
        {props.mode === 'feed' && props.poster && <img className="media-loading-cover" src={props.poster} alt="" decoding="async"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain',
                pointerEvents: 'none' }} />}
        {surface}
        {isSpatialComplete && <>
            <IconButton data-spatial-completion-home data-ai-action={props.mode === 'feed' ? 'clikb.feeds.spatial.home' : undefined}
                aria-label="Home: stage 1 node 1" onClick={home} sx={{ ...round, position: 'absolute', top: 16, right: 16, zIndex: 40003 }}><HomeIcon /></IconButton>
            <CompletionConfetti key={gameplayArrivalKey} appColor={appColor} alternateColor={alternateAppColor} variant="burst"
                accentColor={appColor}
                originX="50%" originY="calc(100% - clamp(24px, 5vh, 56px) - 66px)" />
            <div className="spatial-completion-badge" role="status" aria-live="polite" style={{ color: appColor }}>Completed</div>
        </>}
        {!controlsHidden && !actionPlaying && <Box sx={{ position: "absolute", left: 16, top: 16, zIndex: 40, display: "flex", gap: 1 }}>
            <IconButton data-ai-action={props.mode === 'feed' ? 'clikb.feeds.spatial.open_settings' : undefined} aria-label="Stages and nodes" onClick={() => { setListStage(stage.id); setSettings(true); }} sx={round}><SettingsIcon /></IconButton>
            {canBack && <IconButton data-ai-action={props.mode === 'feed' ? 'clikb.feeds.spatial.back' : undefined} aria-label="Back to previous node or stage" onClick={back} sx={round}><ArrowBackIcon /></IconButton>}
        </Box>}
        {props.mode !== 'feed' && !controlsHidden && error && <Alert severity="warning" onClose={() => setError("")} sx={{ position: "absolute", top: 76, left: 16, right: 16, zIndex: 41 }}>
            {error.startsWith('Playback failed (') ? 'This clip could not load. Try again.' : error}
            {error.startsWith('Playback failed (') && retryPlayback.current && <Button sx={{ color: appColor }} onClick={() => {
                const retry = retryPlayback.current;
                if (retry && sameSpatialPosition(retry.position, latest.current.position)) play(retry.traversal);
            }}>Retry clip</Button>}
            {error === 'The stage image could not load.' && <Button onClick={() => setFrameRetry(value => value + 1)}>Retry image</Button>}
        </Alert>}
        {!controlsHidden && canEditLabels && editingLabels && <Button aria-label="Save action labels" disabled={labelsBusy} onClick={() => void saveLabels()}
            sx={{ ...round, width: 'auto', minWidth: 72, height: 38, position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 40002, borderRadius: 999, textTransform: 'none' }}>{labelsBusy ? 'Saving…' : labelError ? 'Retry save' : 'Save'}</Button>}
        {!controlsHidden && canEditLabels && editingLabels && labelError && <Alert severity="warning" onClose={() => setLabelError('')} sx={{ position: 'absolute', top: 76, left: 16, right: 16, zIndex: 40002 }}>{labelError}</Alert>}
        {!controlsHidden && !showActionNavigation && action?.kind === 'video' && (!clip || clip.connection.kind === 'action' && clip.connection.actionPlayback === 'hold')
            && (canEditLabels && editingLabels || normalizeActionLabel(labelFor(stage.id, action.traversal.connection.id))) && <Box
                component={canEditLabels && editingLabels ? 'button' : 'div'} data-spatial-action-label="true"
                aria-label={canEditLabels && editingLabels ? 'Edit action label' : undefined} title={normalizeActionLabel(labelFor(stage.id, action.traversal.connection.id)) || undefined}
                onClick={canEditLabels && editingLabels ? (event: MouseEvent<HTMLElement>) => { event.stopPropagation(); drive.current = null; actionHeld.current = false; setControlEpoch(value => value + 1); setEditingLabel({ stageId: stage.id, connectionId: action.traversal.connection.id }); } : undefined}
                sx={{ ...actionChrome, borderRadius: 999, px: 1.2, py: .4,
                    fontFamily: theme.typography.fontFamily, fontSize: 12, fontWeight: 600, lineHeight: '18px', minWidth: 40, maxWidth: 'min(112px, calc(50% - 96px))', boxSizing: 'border-box',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: .5,
                    overflow: 'hidden', whiteSpace: 'nowrap', cursor: canEditLabels && editingLabels ? 'pointer' : 'default',
                    pointerEvents: canEditLabels && editingLabels ? 'auto' : 'none', position: 'absolute', left: 'calc(50% + 122px)', transform: 'translateX(-50%)',
                    bottom: 'calc(clamp(24px, 5vh, 56px) + 106px)', zIndex: 40002 }}>
                {canEditLabels && editingLabels && <EditOutlinedIcon sx={{ fontSize: 14, flexShrink: 0 }} />}
                <Box component="span" sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {normalizeActionLabel(labelFor(stage.id, action.traversal.connection.id)) || 'Edit'}
                </Box>
            </Box>}
        {!controlsHidden && !showActionNavigation && action?.kind === "video" && (!clip || clip.connection.kind === 'action' && clip.connection.actionPlayback === 'hold') && <IconButton className="spatial-interaction-button" aria-label={action.traversal.connection.actionPlayback === 'hold' ? 'Hold to play interaction; release to pause' : 'Activate interaction'}
            data-ai-action={props.mode === 'feed' ? 'clikb.feeds.spatial.activate_interaction' : undefined}
            sx={{ ...actionButtonChrome, position: "absolute", left: "calc(50% + 90px)", bottom: "calc(clamp(24px, 5vh, 56px) + 34px)", width: 64, height: 64, zIndex: 40001, touchAction: 'none' }}
            onPointerDown={event => { if (action.traversal.connection.actionPlayback === 'hold') { event.currentTarget.setPointerCapture(event.pointerId); actionHeld.current = true; if (!clipRef.current) activate(); } }}
            onPointerUp={() => { actionHeld.current = false; }} onPointerCancel={() => { actionHeld.current = false; }} onLostPointerCapture={() => { actionHeld.current = false; }}
            onKeyDown={event => { if ([' ', 'Enter'].includes(event.key) && action.traversal.connection.actionPlayback === 'hold') { event.preventDefault(); actionHeld.current = true; if (!clipRef.current) activate(); } }}
            onKeyUp={() => { actionHeld.current = false; }} onBlur={() => { actionHeld.current = false; }}
            onClick={() => { if (action.traversal.connection.actionPlayback !== 'hold') activate(); }} />}
        {/* Portalled settings must clear the feed/preview layers, below the spatial map dialogs. */}
        <Drawer anchor="left" open={settings && !actionPlaying && !controlsHidden} onClose={() => setSettings(false)} sx={{ zIndex: 2147483001 }} PaperProps={{ sx: { width: "min(460px,90vw)", maxWidth: "100vw", boxSizing: "border-box", overflowX: "hidden", bgcolor: darkMode ? "rgba(15,20,30,.94)" : "rgba(250,251,255,.96)", color: darkMode ? "#fff" : "#111", backdropFilter: "blur(28px)", borderRight: `1px solid ${alpha(appColor, .24)}`, boxShadow: "12px 0 60px rgba(0,0,0,.22)" } }}>
            <Box ref={settingsBodyRef} sx={{ width: "100%", boxSizing: "border-box", p: 2.5 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}><Box sx={{ display: 'flex' }}>
                <IconButton data-spatial-home="true" data-ai-action={props.mode === 'feed' ? 'clikb.feeds.spatial.home' : undefined} aria-label="Home: stage 1 node 1" onClick={home} sx={{ color: appColor }}><HomeIcon /></IconButton>
                <IconButton data-spatial-map="true" data-ai-action={props.mode === 'feed' ? 'clikb.feeds.spatial.toggle_map' : undefined} aria-label="Visual map of selected stage" aria-pressed={showMap} disabled={!selectedStage} onClick={() => setShowMap(value => !value)} sx={{ color: appColor, bgcolor: showMap ? alpha(appColor, 0.15) : "transparent" }}><TimelineIcon /></IconButton>
                </Box>{canEditLabels ? <Button disabled={labelsBusy} onClick={() => { setEditingLabels(true); setSettings(false); setLabelError(''); }} sx={{ color: appColor, textTransform: 'none', borderRadius: 999 }}>Labels</Button> : <span />}
                <IconButton data-ai-action={props.mode === 'feed' ? 'clikb.feeds.spatial.close_settings' : undefined} aria-label="Close stages and nodes" onClick={() => setSettings(false)} sx={{ justifySelf: 'end', color: appColor }}><CloseIcon /></IconButton></Box>
                <Typography variant="h6" sx={{ mt: 2, fontWeight: 750 }}>Explore this experience</Typography><Typography variant="body2" sx={{ opacity: .6, mb: 1 }}>Choose a scene, follow its routes, or inspect the map.</Typography>
                {rawScene?.ledger && <Button aria-label="Switch between Three.js and AI video" onClick={() => { cancel(); setViewChoices(previous => ({ ...previous, [rawScene.sceneId]: threeView ? 'video' : 'three' })); }} sx={{ color: appColor }}>
                    {threeView ? 'View AI Video' : 'Play Three.js'}
                </Button>}
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 1, my: 2 }}>{stages.map(s => <Button key={s.id} data-spatial-stage-choice={s.id} data-ai-action={props.mode === 'feed' ? `clikb.feeds.spatial.select_stage_${encodeURIComponent(s.id).slice(0, 60)}` : undefined} aria-pressed={listStage === s.id} onClick={() => setListStage(s.id)} sx={{ display: "flex", flexDirection: "column", gap: 1, textTransform: "none", p: 1, border: `1px solid ${alpha(appColor, .2)}`, borderRadius: 2.5, color: listStage === s.id ? accentText : appColor, bgcolor: listStage === s.id ? appColor : "transparent", "&:hover": { bgcolor: listStage === s.id ? appColor : alpha(appColor, 0.12) } }}>
                    {s.scene.nodes[0]?.frameUrl && <img src={s.scene.nodes[0].frameUrl} alt="" style={{ width: "100%", height: 88, maxWidth: "100%", borderRadius: 9, objectFit: "cover" }} />}{s.label}
                </Button>)}</Box>
                {showMap && selectedStage && <Box key={selectedStage.id} sx={{ my: 2 }}>
                    <Typography sx={{ mb: 1 }}>{selectedStage.label} · visual map</Typography>
                    <SpatialNodeMap scene={{ ...selectedStage.scene, activeNodeId: position?.stageId === selectedStage.id ? position.nodeId : selectedStage.scene.nodes[0].id }} sceneIndex={stages.indexOf(selectedStage)} linkOptions={stages.map(s => ({ ...s.address, label: s.label, frameUrl: s.scene.nodes[0]?.frameUrl || "" }))} appColor={appColor} connectorColor={appColor} darkMode={darkMode} readOnly />
                </Box>}
                <Typography>Nodes</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2,minmax(0,1fr))", sm: "repeat(3,minmax(0,1fr))" }, gap: 1 }}>{selectedStage?.scene.nodes.filter(n => n.frameUrl).map(n => <Button key={n.id} data-spatial-node-choice={n.id} data-ai-action={props.mode === 'feed' ? `clikb.feeds.spatial.jump_node_${encodeURIComponent(n.id).slice(0, 60)}` : undefined} onClick={() => navigate({ stageId: selectedStage.id, nodeId: n.id })} sx={{ display: "flex", flexDirection: "column", minWidth: 0, gap: 1, color: appColor, "&:hover": { bgcolor: alpha(appColor, 0.12) } }}><img src={n.frameUrl} alt="" style={{ width: 80, height: "auto", aspectRatio: "1 / 1", maxWidth: "100%", borderRadius: "50%", objectFit: "cover" }} />{n.label}</Button>)}</Box>
            </Box>
        </Drawer>
        <Dialog open={canEditLabels && editingLabels && Boolean(editingLabel)} onClose={() => { if (!labelsBusy) setEditingLabel(null); }}
            onPointerDown={event => event.stopPropagation()} onPointerUp={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
            sx={{ zIndex: 2147483003 }} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
            <DialogTitle>Action label</DialogTitle>
            <DialogContent><TextField autoFocus fullWidth size="small" margin="dense" label="Label" placeholder="Pick up" disabled={labelsBusy}
                value={editingLabel ? labelFor(editingLabel.stageId, editingLabel.connectionId) : ''}
                onChange={event => { if (editingLabel) dispatch(draftActionLabel({ owner: labelOwner, patch: { ...editingLabel, label: Array.from(event.target.value).slice(0, ACTION_LABEL_MAX_LENGTH).join('') } })); }}
                onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); setEditingLabel(null); } }} />
            </DialogContent>
            <DialogActions><Button disabled={labelsBusy} onClick={() => setEditingLabel(null)} sx={{ color: appColor }}>Done</Button></DialogActions>
        </Dialog>
    </Box></SpatialTheme>;
});
SpatialExperiencePlayer.displayName = "SpatialExperiencePlayer";
export default SpatialExperiencePlayer;
