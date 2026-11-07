import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Popover, TextField, Tooltip, Typography, Slider } from '@mui/material';
import './LiveSceneWorkspace.css';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import StopIcon from '@mui/icons-material/Stop';
import CloseIcon from '@mui/icons-material/Close';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import PushPinIcon from '@mui/icons-material/PushPin';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import ThreeSixtyIcon from '@mui/icons-material/ThreeSixty';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { createMotionRenderer } from '../motionGuideRenderer';
import { LiveSceneClient } from '../liveSceneClient';
import { copyLiveSceneLogs, liveSceneLog } from '../liveSceneDiagnostics';
import { liveSceneDebug } from '../liveSceneDebug';
import { type MotionPlan } from '../../server/src/motionGuidePlan';
import { manualPoseCommands, samplePose, type SceneAuthoringDraft } from '../../server/src/sceneAuthoring';
import { evaluateScenePerformance } from '../../server/src/scenePerformance';
import { localMotionMatrix } from '../../server/src/motionNodeTransforms';
import { hasVisibleSceneGeometry } from '../../server/src/sceneVisibility';
import type { PlanningTier } from '../../server/src/spatialWorld';
import { computeAspectFitBox } from './SpatialWorldViewport';

const emptyPlan: MotionPlan = { version: 1, duration: 5, background: '#edf5fc', objects: [{ id: 'live_workspace', shape: 'anchor', color: '#ffffff', keys: [{ t: 0, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, { t: 5, position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }] }], camera: [{ t: 0, position: [0, 2, 7], target: [0, .7, 0], fov: 45 }, { t: 5, position: [0, 2, 7], target: [0, .7, 0], fov: 45 }] };

/** Production viewport shared by the two native editors. Only edge icons overlay the scene. */
export default function LiveSceneWorkspace({ client, accent = '#c5d83e', overlay = false, aspect = '16:9', expanded = false, persistent = false, fallbackPlan, fallbackAuthoring, planningTier, controlsHidden = false, maximized = false, fillContainer = false, exportedVideoUrl }: { client: LiveSceneClient; maximized?: boolean; fillContainer?: boolean; exportedVideoUrl?: string; accent?: string; overlay?: boolean; aspect?: string; expanded?: boolean; persistent?: boolean; fallbackPlan?: MotionPlan; fallbackAuthoring?: SceneAuthoringDraft; planningTier?: PlanningTier; controlsHidden?: boolean }) {
    const state = useSyncExternalStore(client.subscribe, client.snapshot);
    const host = useRef<HTMLDivElement>(null), latest = useRef(state); latest.current = state;
    const fallback = useRef(fallbackPlan); fallback.current = fallbackPlan;
    const fallbackState = useRef(fallbackAuthoring); fallbackState.current = fallbackAuthoring;
    const [selected, setSelected] = useState(''), [mode, setMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
    const modeRef = useRef(mode); modeRef.current = mode;
    const selectedRef = useRef(selected); selectedRef.current = selected;
    const [guideAnchor, setGuideAnchor] = useState<HTMLElement | null>(null), [guidance, setGuidance] = useState('');
    const [noticeOpen, setNoticeOpen] = useState(false);
    const [discardBuild, setDiscardBuild] = useState<string | null>(null);
    const activityBar = useRef<HTMLDivElement>(null);
    const [copyStatus, setCopyStatus] = useState('Copy Logs');
    const [renderError, setRenderError] = useState('');
    const [meteredPill, setMeteredPill] = useState<{ id: string; pixelsCharged: number } | null>(null);
    useEffect(() => {
        const billing = state.lastMeteredBilling;
        if (!billing || billing.pixelsCharged <= 0) return;
        setMeteredPill({ id: billing.id, pixelsCharged: billing.pixelsCharged });
        const timer = window.setTimeout(() => setMeteredPill(prev => prev?.id === billing.id ? null : prev), 2600);
        return () => window.clearTimeout(timer);
    }, [state.lastMeteredBilling?.id]);
    const resetView = useRef<() => void>(() => {});
    const wakeViewport = useRef<() => void>(() => {});
    const hiddenControls = useRef(controlsHidden); hiddenControls.current = controlsHidden;
    const copyLogs = async () => { setCopyStatus(await copyLiveSceneLogs()); };
    const active = !state.local && state.phase !== 'idle';
    const controlsBusy = Boolean(state.pausing || state.stopping || state.exporting);
    const working = active && state.phase === 'streaming' && !controlsBusy && !state.error;
    const [playing, setPlaying] = useState(false), [playhead, setPlayhead] = useState(0);
    const playingRef = useRef(playing); playingRef.current = playing;
    const playheadRef = useRef(0), clockRef = useRef<number>();
    useEffect(() => { if (state.phase === 'paused') { setPlaying(false); clockRef.current = undefined; setPlayhead(playheadRef.current); } }, [state.phase]);
    const visible = active || persistent;
    const interactive = visible;
    const buildTier = state.tier === 'luna' || state.tier === 'sol' || state.tier === 'terra' ? state.tier : planningTier;
    useEffect(() => {
        if (!active || discardBuild && discardBuild !== state.buildId) setDiscardBuild(null);
    }, [active, state.buildId, discardBuild]);
    useEffect(() => {
        const bar = activityBar.current;
        if (!working || !bar) return;
        let inView = true;
        const update = () => { bar.style.animationPlayState = inView && !document.hidden ? 'running' : 'paused'; };
        const observer = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(entries => {
            inView = entries.some(entry => entry.isIntersecting); update();
        });
        observer?.observe(bar); document.addEventListener('visibilitychange', update); update();
        return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', update); };
    }, [working, controlsHidden]);
    useEffect(() => {
        if (!visible || !host.current) return;
        const holder = host.current, canvas = document.createElement('canvas'); canvas.style.cssText = 'width:100%;height:100%;display:block'; holder.replaceChildren(canvas);
        let renderer: ReturnType<typeof createMotionRenderer>;
        const [aspectW, aspectH] = aspect.split(':').map(Number);
        try { renderer = createMotionRenderer(canvas, latest.current.plan || fallback.current || emptyPlan, Math.round(480 * aspectW / aspectH), 480); setRenderError(''); }
        catch (error) {
            liveSceneLog('renderer-error', { error: (error as Error).message });
            setRenderError('The 3D preview could not start. Reopen the preview to retry.');
            void client.pause();
            canvas.remove(); return;
        }
        const inspectionCamera = renderer.view.camera.clone();
        const controls = new OrbitControls(inspectionCamera, canvas); controls.enabled = false;
        let needsRender = true, disposed = false, inView = true, raf = 0;
        let draw: (now: number) => void;
        const schedule = () => {
            if (disposed || raf || !inView || document.hidden) return;
            raf = requestAnimationFrame(now => { raf = 0; if (!disposed) draw(now); });
        };
        const invalidate = () => { needsRender = true; schedule(); };
        wakeViewport.current = invalidate;
        controls.addEventListener('change', invalidate);
        const drawPlan = (time: number, plan: MotionPlan, authoring?: SceneAuthoringDraft) => renderer.draw(time, authoring ? undefined : plan, undefined, authoring);
        resetView.current = () => { const current = client.snapshot(), authoring = current.plan ? current.authoring : fallbackState.current; const plan = current.plan || fallback.current || emptyPlan; const frame = evaluateScenePerformance({ plan, authoring }, playheadRef.current); renderer.view.draw(0, frame, authoring?.lightingRig); inspectionCamera.copy(renderer.view.camera); controls.target.set(...frame.camera[0].target); controls.update(); invalidate(); };
        const transform = new TransformControls(inspectionCamera, canvas); transform.enabled = false; const helper = transform.getHelper(); renderer.view.scene.add(helper);
        // Keep gestures on the fitted canvas; the surrounding card belongs to
        // the scrolling form. Inline and expanded scenes remain inspectable.
        canvas.style.touchAction = interactive ? 'none' : 'pan-y';
        const proxy = new THREE.Object3D(); renderer.view.scene.add(proxy);
        // Local editor guides appear immediately. They never enter the AI scene,
        // checkpoint image, or exported plan, and disappear once geometry arrives.
        const grid = new THREE.GridHelper(16, 16, '#8c9baa', '#d3dde5');
        const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#6686b3' })); cube.position.y = .5;
        renderer.view.scene.add(grid, cube);
        let dragging = false, selectedNode: THREE.Object3D | undefined;
        let dragOrigin: { position: number[]; rotation: number[]; scale: number[] } | undefined;
        const ensureCanvasSized = () => {
            if (canvas.width > 1 && canvas.height > 1) return;
            const rect = holder.getBoundingClientRect();
            const fallbackW = Math.max(64, Math.round(480 * (aspectW || 16) / (aspectH || 9)));
            const fallbackH = 480;
            const w = rect.width > 1 ? Math.max(1, Math.round(rect.width)) : fallbackW;
            const h = rect.height > 1 ? Math.max(1, Math.round(rect.height)) : fallbackH;
            renderer.renderer.setSize(w, h, false);
        };
        const capture = () => { try {
            ensureCanvasSized();
            const current = client.snapshot();
            if (current.plan) {
                const frame = evaluateScenePerformance({ plan: current.plan, authoring: current.authoring }, Math.min(current.plan.duration, playheadRef.current));
                renderer.view.draw(0, frame, current.authoring?.lightingRig);
            }
            const inspect = interactive && (current.phase === 'paused' || !current.plan?.objects.some(object => object.id !== 'live_workspace'));
            renderer.renderer.render(renderer.view.scene, inspect ? inspectionCamera : renderer.view.camera);
            const shot = document.createElement('canvas'), factor = Math.min(1, 1024 / Math.max(canvas.width, canvas.height)); shot.width = Math.max(1, Math.round(canvas.width * factor)); shot.height = Math.max(1, Math.round(canvas.height * factor)); shot.getContext('2d')!.drawImage(canvas, 0, 0, shot.width, shot.height); return shot.toDataURL('image/jpeg', .8);
        } catch { return undefined; } };
        client.capture = capture;
        const checkpointCapture = (plan: MotionPlan) => {
            ensureCanvasSized();
            const guides = [grid.visible, cube.visible, helper.visible];
            try {
                grid.visible = cube.visible = helper.visible = false;
                const authoring = client.snapshot().authoring;
                const times = [...new Set([0, plan.duration / 2, plan.duration, ...(authoring?.events || []).flatMap(event => [Math.max(0, event.time - .05), event.time, ...(event.kind === 'detach' && event.landing ? [event.landing.time] : [])])])].sort((a, b) => a - b);
                const samples = times.length <= 6 ? times : [times[0], ...times.slice(1, -1).filter((_, i, middle) => i % Math.ceil(middle.length / 4) === 0).slice(0, 4), times[times.length - 1]];
                const shot = document.createElement('canvas');
                const tileWidth = 256, tileHeight = Math.max(96, Math.round(tileWidth * canvas.height / canvas.width));
                shot.width = tileWidth * 3; shot.height = (tileHeight + 20) * Math.ceil(samples.length / 3);
                const context = shot.getContext('2d')!;
                context.fillStyle = '#111820'; context.fillRect(0, 0, shot.width, shot.height);
                for (const [index, time] of samples.entries()) {
                    drawPlan(time, plan, authoring);
                    if (renderer.renderer.getContext().isContextLost()) return undefined;
                    const x = index % 3 * tileWidth, y = Math.floor(index / 3) * (tileHeight + 20);
                    context.drawImage(canvas, x, y, tileWidth, tileHeight);
                    context.fillStyle = '#ffffff'; context.font = '12px sans-serif'; context.fillText(`${time.toFixed(2)}s`, x + 6, y + tileHeight + 14);
                }
                return shot.toDataURL('image/jpeg', .8);
            } catch { return undefined; }
            finally { [grid.visible, cube.visible, helper.visible] = guides; const current = client.snapshot(); if (current.plan) drawPlan(Math.min(current.plan.duration, playheadRef.current), current.plan, current.authoring); invalidate(); }
        };
        const unregisterViewportOwner = typeof client.registerViewportOwner === 'function'
            ? client.registerViewportOwner({ expanded, capture, captureCheckpoint: checkpointCapture })
            : (() => {
                client.capture = capture;
                client.captureCheckpoint = checkpointCapture;
                return () => {
                    if (client.capture === capture) client.capture = undefined;
                    if (client.captureCheckpoint === checkpointCapture) client.captureCheckpoint = undefined;
                };
            })();
        transform.addEventListener('dragging-changed', event => { dragging = Boolean(event.value); controls.enabled = interactive && !dragging && client.snapshot().phase === 'paused'; if (dragging && selectedNode) { playingRef.current = false; setPlaying(false); dragOrigin = { position: selectedNode.position.toArray(), rotation: selectedNode.rotation.toArray().slice(0, 3).map(Number), scale: selectedNode.scale.toArray() }; selectedNode.updateWorldMatrix(true, false); selectedNode.matrixWorld.decompose(proxy.position, proxy.quaternion, proxy.scale); } invalidate(); });
        transform.addEventListener('objectChange', () => { if (dragging && selectedNode) { proxy.updateMatrixWorld(true); selectedNode.parent?.updateWorldMatrix(true, false); const local = (selectedNode.parent?.matrixWorld.clone().invert() || new THREE.Matrix4()).multiply(proxy.matrixWorld); selectedNode.matrix.copy(local); local.decompose(selectedNode.position, selectedNode.quaternion, selectedNode.scale); selectedNode.matrixWorldNeedsUpdate = true; invalidate(); } });
        transform.addEventListener('change', invalidate);
        transform.addEventListener('mouseUp', () => {
            const current = latest.current, id = selectedRef.current; if (!current.plan || !id) return;
            const [objectId, partId] = id.split('/');
            const object = current.plan.objects.find(o => o.id === objectId), source = partId ? object?.parts?.find(part => part.id === partId) : object; if (!source || !object || !selectedNode) return;
            proxy.updateMatrixWorld(true); selectedNode.parent?.updateWorldMatrix(true, false);
            const local = (selectedNode.parent?.matrixWorld.clone().invert() || new THREE.Matrix4()).multiply(proxy.matrixWorld);
            const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3(); local.decompose(position, rotation, scale);
            const time = Math.min(current.plan.duration, playheadRef.current), from = samplePose(source, time);
            const before = dragOrigin || from;
            const evaluated = new THREE.Matrix4().compose(new THREE.Vector3().fromArray(before.position), new THREE.Quaternion().setFromEuler(new THREE.Euler(before.rotation[0], before.rotation[1], before.rotation[2])), new THREE.Vector3().fromArray(before.scale));
            const m = localMotionMatrix({ ...source, keys: [from] });
            const authored = new THREE.Matrix4().set(m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9], m[10], m[11], 0, 0, 0, 1).multiply(evaluated.invert()).multiply(local);
            authored.decompose(position, rotation, scale);
            if (source.pivot) { const pivot = new THREE.Vector3(...source.pivot); position.sub(pivot).add(pivot.clone().multiply(scale).applyQuaternion(rotation)); }
            const pose = { ...from, t: time, position: position.toArray(), rotation: new THREE.Euler().setFromQuaternion(rotation).toArray().slice(0, 3).map(Number) as [number, number, number], scale: scale.toArray() };
            try { const target = { objectId, ...(partId ? { partId } : {}) }; client.applyCommands(current.authoring ? manualPoseCommands(current.authoring, target, time, pose) : [{ kind: 'pose', target, time, pose }]); }
            catch (error) { setRenderError((error as Error).message); invalidate(); }

        });
        let pointerDown = { x: 0, y: 0 };
        const beginPointer = (event: PointerEvent) => { pointerDown = { x: event.clientX, y: event.clientY }; };
        const pick = (event: PointerEvent) => { if (!interactive || hiddenControls.current || client.snapshot().phase !== 'paused' || transform.axis || Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 5) return; const rect = canvas.getBoundingClientRect(), ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), inspectionCamera); for (const hit of ray.intersectObjects([...renderer.view.roots.values()], true)) { let node: THREE.Object3D | null = hit.object; while (node && !renderer.view.roots.has(node.name)) node = node.parent; if (node) { const root = node; let part: THREE.Object3D | null = hit.object; while (part && part !== root && !renderer.view.parts.get(root.name)?.has(part.name)) part = part.parent; setSelected(part && part !== root ? `${root.name}/${part.name}` : root.name); break; } } };
        canvas.addEventListener('pointerdown', beginPointer);
        canvas.addEventListener('pointerup', pick);
        const resize = () => { const rect = holder.getBoundingClientRect(); if (rect.width && rect.height) { const { width, height, left, top, ratio } = computeAspectFitBox(rect.width, rect.height, aspect); canvas.style.width = `${width}px`; canvas.style.height = `${height}px`; canvas.style.position = 'absolute'; canvas.style.left = `${left}px`; canvas.style.top = `${top}px`; const bufferWidth = Math.max(1, Math.round(width)), bufferHeight = Math.max(1, Math.round(height)); if (canvas.width !== bufferWidth || canvas.height !== bufferHeight) renderer.renderer.setSize(bufferWidth, bufferHeight, false); for (const camera of [renderer.view.camera, inspectionCamera]) { camera.aspect = ratio; camera.updateProjectionMatrix(); } invalidate(); } };
        const observer = new ResizeObserver(resize); observer.observe(holder); resize();
        let previouslyOrbitable = false, previousPlan: MotionPlan | undefined, previousAuthoring: SceneAuthoringDraft | undefined, previousTime = -1, lastAnimatedDraw = -Infinity;
        draw = (now: number) => {
            if (!inView || document.hidden) return;
            const current = client.snapshot(), plan = current.plan || fallback.current || emptyPlan, paused = current.phase === 'paused';
            const authoring = current.plan ? current.authoring : fallbackState.current;
            const changed = previousPlan !== plan || previousAuthoring !== authoring;
            const placeholder = !hasVisibleSceneGeometry(plan);
            const frozen = placeholder || paused && !playingRef.current;
            if (!frozen && !dragging && !changed && now - lastAnimatedDraw < 1000 / 30) { schedule(); return; }
            if (!frozen) { if (clockRef.current === undefined) clockRef.current = now; playheadRef.current = (playheadRef.current + Math.min(.1, (now - clockRef.current) / 1000)) % plan.duration; clockRef.current = now; } else clockRef.current = undefined;
            const orbitable = interactive && frozen;
            grid.visible = cube.visible = placeholder;
            if (playheadRef.current > plan.duration) playheadRef.current = 0;
            if (!dragging) {
                if (!frozen) { drawPlan(playheadRef.current, plan, authoring); lastAnimatedDraw = now; }
                else {
                    // The same Spatial evaluator supplies the paused pose. A
                    // camera drag never re-evaluates the animation or resets it.
                    if (changed || !previouslyOrbitable || previousTime !== playheadRef.current) {
                        const frame = evaluateScenePerformance({ plan, authoring }, Math.min(plan.duration, playheadRef.current));
                        renderer.view.draw(0, frame, authoring?.lightingRig);
                        if (orbitable && (!previouslyOrbitable || previousPlan?.objects.every(object => object.id === 'live_workspace') && !placeholder)) { inspectionCamera.copy(renderer.view.camera); controls.target.set(...frame.camera[0].target); }
                        needsRender = true;
                    }
                    if (orbitable) controls.update();
                }
                const [objectId, partId] = selectedRef.current.split('/');
                const wanted = partId ? renderer.view.parts.get(objectId)?.get(partId) : renderer.view.roots.get(objectId);
                if (interactive && !hiddenControls.current && paused && !current.stopping && !current.exporting && wanted) {
                    if (selectedNode !== wanted || changed) { selectedNode = wanted; wanted.updateWorldMatrix(true, false); wanted.matrixWorld.decompose(proxy.position, proxy.quaternion, proxy.scale); transform.attach(proxy); needsRender = true; }
                    if (transform.getMode() !== modeRef.current) { transform.setMode(modeRef.current); needsRender = true; }
                } else if (selectedNode) { transform.detach(); selectedNode = undefined; needsRender = true; }
            }
            controls.enabled = orbitable && !dragging; transform.enabled = interactive && !hiddenControls.current && paused && !current.stopping && !current.exporting;
            const showHelper = interactive && !hiddenControls.current && paused && !current.stopping && !current.exporting && Boolean(selectedNode);
            if (helper.visible !== showHelper) { helper.visible = showHelper; needsRender = true; }
            if (needsRender && (frozen || dragging)) { renderer.renderer.render(renderer.view.scene, orbitable || dragging ? inspectionCamera : renderer.view.camera); needsRender = false; }
            previouslyOrbitable = orbitable; previousPlan = plan; previousAuthoring = authoring; previousTime = playheadRef.current;
            if (!frozen && !dragging) schedule();
        };
        const unsubscribe = client.subscribe(invalidate);
        const visibilityChanged = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else invalidate(); };
        document.addEventListener('visibilitychange', visibilityChanged);
        const intersection = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(entries => { inView = entries.some(entry => entry.isIntersecting); if (inView) invalidate(); else { cancelAnimationFrame(raf); raf = 0; } });
        intersection?.observe(holder);
        schedule();
        return () => { disposed = true; cancelAnimationFrame(raf); unsubscribe(); observer.disconnect(); intersection?.disconnect(); document.removeEventListener('visibilitychange', visibilityChanged); canvas.removeEventListener('pointerdown', beginPointer); canvas.removeEventListener('pointerup', pick); controls.dispose(); transform.dispose(); grid.geometry.dispose(); (grid.material as THREE.Material).dispose(); cube.geometry.dispose(); cube.material.dispose(); renderer.dispose(); canvas.remove(); if (wakeViewport.current === invalidate) wakeViewport.current = () => {}; unregisterViewportOwner(); };
    }, [visible, client, aspect, interactive]);
    useEffect(() => { if (controlsHidden) setGuideAnchor(null); wakeViewport.current(); }, [controlsHidden, selected, mode, fallbackPlan, fallbackAuthoring, playing, playhead]);
    if (!visible) return state.error ? <Alert severity="error" sx={{ pointerEvents: 'auto' }}>{state.error}{liveSceneDebug && <Button onClick={() => void copyLogs()}>{copyStatus}</Button>}</Alert> : null;
    const icon = (title: string, action: () => void, child: React.ReactNode, disabled = false) => <Tooltip title={title}><span><IconButton size="small" aria-label={title} disabled={disabled} onClick={action} sx={{ color: '#fff', bgcolor: 'rgba(12,20,32,.7)', border: '1px solid rgba(255,255,255,.25)', width: 34, height: 34 }}>{child}</IconButton></span></Tooltip>;
    return <Box data-live-scene-workspace data-editstory-gesture-guard="true" data-phase={state.phase} data-selected={selected || undefined} sx={{ ...(overlay ? { position: 'absolute', inset: 0, zIndex: 120 } : { position: 'relative', width: '100%', height: fillContainer ? '100%' : expanded ? '52vh' : 'clamp(240px,34vh,320px)', minHeight: fillContainer ? 0 : 180, ...(fillContainer ? {flex:'1 1 0',width:'100%'} : {}) }), bgcolor: overlay ? '#edf5fc' : 'transparent', overflow: 'hidden', pointerEvents: 'auto', '& [data-live-scene-controls]': controlsHidden ? { display: 'none' } : {} }}>
        <Box ref={host} sx={{ position: 'absolute', inset: 0, contain: 'layout paint' }} />
        {working && !controlsHidden && <div ref={activityBar} data-live-scene-activity aria-hidden="true" className="live-scene-activity" style={{ backgroundColor: accent }} />}
        {meteredPill && <Box key={meteredPill.id} data-live-scene-metered-pill="true" aria-hidden="true" sx={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 130, px: 1.25, py: 0.3, borderRadius: 999, bgcolor: 'rgba(12,20,32,.84)', border: `1px solid ${accent}`, color: accent, fontSize: 11, fontWeight: 800, letterSpacing: 0.2, boxShadow: '0 6px 16px rgba(0,0,0,.32)' }}>-{meteredPill.pixelsCharged} P</Box>}
        {interactive && (state.phase !== 'streaming' || !state.plan?.objects.some(object => object.id !== 'live_workspace')) && <Box data-live-scene-controls sx={{ position: 'absolute', left: 10, top: maximized ? 54 : 10 }}>{icon('Reset inspection camera', () => resetView.current(), <RestartAltIcon />)}</Box>}
        {active && <Box data-live-scene-controls sx={{ position: 'absolute', right: 10, top: 10, display: 'flex', gap: .5 }}>
            {liveSceneDebug && <Button size="small" onClick={() => void copyLogs()} sx={{ color: '#fff', bgcolor: 'rgba(12,20,32,.7)' }}>{copyStatus}</Button>}
            {state.phase === 'streaming' ? icon('Pause AI', () => void client.pause(), <PauseIcon />, controlsBusy) : icon('Continue AI', () => void client.continue(), <PlayArrowIcon />, !state.plan || controlsBusy || state.continuationsLeft <= 0)}
            <Tooltip title="Guide AI"><IconButton size="small" aria-label="Guide AI" disabled={controlsBusy} onClick={event => { setGuideAnchor(event.currentTarget); if (state.phase === 'streaming') void client.pause(); }} sx={{ color: '#fff', bgcolor: 'rgba(12,20,32,.7)', width: 34, height: 34 }}><ChatBubbleOutlineIcon fontSize="small" /></IconButton></Tooltip>
            {icon(client.canExportDraft() ? 'Stop and export video' : 'Stop and keep draft', () => void client.stop(true), <StopIcon />, controlsBusy || !state.buildId)}
            {icon('Discard AI build', () => setDiscardBuild(state.buildId || null), <CloseIcon />, controlsBusy || !state.buildId)}
        </Box>}
        {interactive && state.phase === 'paused' && !controlsBusy && <Box data-live-scene-controls sx={{ position: 'absolute', left: 10, bottom: 36, display: 'flex', gap: .4 }}>
            {selected && <>
            {icon('Move selected object', () => setMode('translate'), <OpenWithIcon fontSize="small" />, !selected)}{icon('Rotate selected object', () => setMode('rotate'), <ThreeSixtyIcon fontSize="small" />, !selected)}{icon('Scale selected object', () => setMode('scale'), <ZoomOutMapIcon fontSize="small" />, !selected)}
            {icon('Pin selected object', () => client.togglePin(selected.split('/')[0]), <PushPinIcon fontSize="small" />, !selected)}
            {icon('Delete selected object', () => { const [objectId, partId] = selected.split('/'); try { client.applyCommands([{ kind: 'remove', target: { objectId, ...(partId ? { partId } : {}) } }]); setSelected(''); } catch (error) { setRenderError((error as Error).message); } }, <DeleteOutlineIcon fontSize="small" />, !selected)}
            </>}
            {state.canUndo && icon('Undo authoring change', () => client.undo(), <UndoIcon fontSize="small" />)}
            {state.canRedo && icon('Redo authoring change', () => client.redo(), <RedoIcon fontSize="small" />)}
        </Box>}
        {state.phase === 'paused' && state.plan && !controlsBusy && <Box data-live-scene-controls sx={{ position: 'absolute', right: 10, bottom: 37, width: 'min(220px,44%)', display: 'flex', gap: 1, alignItems: 'center', bgcolor: 'rgba(12,20,32,.75)', px: 1, borderRadius: 2 }}>
            {icon(playing ? 'Pause playback' : 'Play timeline', () => { playingRef.current = !playingRef.current; setPlaying(playingRef.current); setPlayhead(playheadRef.current); clockRef.current = undefined; wakeViewport.current(); }, playing ? <PauseIcon /> : <PlayArrowIcon />)}
            <Slider size="small" aria-label="Animation time" min={0} max={state.plan.duration} step={.01} value={Math.min(playhead, state.plan.duration)} valueLabelDisplay="auto" onChange={(_, value) => { const time = Number(value); playingRef.current = false; setPlaying(false); playheadRef.current = time; setPlayhead(time); wakeViewport.current(); }} />
        </Box>}
        <Box data-live-scene-controls sx={{ position: 'absolute', left: 10, bottom: 8, display: 'flex', alignItems: 'center', gap: .6, bgcolor: 'rgba(12,20,32,.7)', color: '#fff', borderRadius: 4, px: 1, py: .3, maxWidth: 'calc(100% - 20px)' }}><Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: accent, flexShrink: 0 }} />{active && planningTier && buildTier && <Typography variant="caption" sx={{ flexShrink: 0, fontWeight: 700 }}>{buildTier === 'sol' ? 'Sol · Low' : buildTier === 'terra' ? 'Terra · Low' : 'Luna · Low'}</Typography>}<Typography variant="caption" noWrap sx={{ minWidth: 0 }}>{state.message || (interactive ? '3D workspace · drag to orbit, scroll to zoom' : 'Expand to inspect the 3D workspace')}</Typography>{(state.error || state.notice) && <Button size="small" sx={{ p: 0, minWidth: 34, color: '#fff', fontSize: 11 }} onClick={() => setNoticeOpen(v => !v)}>Details</Button>}</Box>
        {maximized && (state.exportedVideoUrl || exportedVideoUrl) && <Tooltip title="Open exported video file"><IconButton data-live-scene-controls component="a" href={state.exportedVideoUrl || exportedVideoUrl} target="_blank" rel="noopener noreferrer" aria-label="Open exported video file" size="small" sx={{position:'absolute',right:10,top:52,color:'#fff',bgcolor:'rgba(12,20,32,.8)'}}><FileDownloadIcon fontSize="small"/></IconButton></Tooltip>}
        <Popover open={Boolean(guideAnchor)} anchorEl={guideAnchor} onClose={() => setGuideAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} sx={{ zIndex: 2147483100 }}><Box sx={{ p: 1.5, width: 'min(330px,85vw)' }}><TextField autoFocus fullWidth multiline minRows={3} label="Guide the AI" placeholder="The table is too big…" value={guidance} onChange={event => setGuidance(event.target.value)} /><Typography variant="caption">Your current viewport image and scene data accompany this guidance. Manual corrections are kept.</Typography><Button onClick={() => { void client.continue(guidance); setGuideAnchor(null); setGuidance(''); }} disabled={!state.plan || state.phase !== 'paused' || controlsBusy}>Continue · included in this build</Button></Box></Popover>
        <Dialog open={Boolean(discardBuild) && active} onClose={() => setDiscardBuild(null)} aria-labelledby="live-scene-discard-title" aria-describedby="live-scene-discard-description" maxWidth="xs" fullWidth sx={{ zIndex: 2147483101 }}>
            <DialogTitle id="live-scene-discard-title">Discard this Three.js build?</DialogTitle>
            <DialogContent><DialogContentText id="live-scene-discard-description">This stops AI generation and discards the current build and its unsaved edits. Your previous saved scene and video reference remain unchanged.</DialogContentText></DialogContent>
            <DialogActions>
                <Button autoFocus onClick={() => setDiscardBuild(null)}>No, keep build</Button>
                <Button disabled={controlsBusy} onClick={() => { const currentBuild = discardBuild; setDiscardBuild(null); if (currentBuild === client.snapshot().buildId) void client.stop(false); }} sx={{ color: accent }}>Yes, discard</Button>
            </DialogActions>
        </Dialog>
        {(noticeOpen || renderError) && <Box data-live-scene-controls sx={{ position: 'absolute', bottom: 40, right: 10, width: 'min(330px,85%)' }}><Alert severity={state.error || renderError ? 'warning' : 'info'} onClose={() => { setNoticeOpen(false); setRenderError(''); }}>{renderError || state.error || state.notice}<Button size="small" onClick={() => void client.reconnect()}>Reconnect</Button></Alert></Box>}
    </Box>;
}
