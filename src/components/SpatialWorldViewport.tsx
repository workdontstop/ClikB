import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { createMotionRenderer } from '../motionGuideRenderer';
import { cloneWorld, planAtState, stateAtEnd, type SpatialWorld, type WorldState } from '../../server/src/spatialWorld';
import { applyAuthoringCommands, createAuthoringDraft, evaluateAuthoringDraft, finishAuthoringCapturePlan, manualPoseCommands, mergeAuthoringPlan, type AuthoringCommand, type PoseTarget, type SceneAuthoringDraft } from '../../server/src/sceneAuthoring';
import type { MotionPlan } from '../motionGuide';
import type { JoystickDriveSample } from './VirtualJoystickDrive';
import { finishMovementTiming, MOVEMENT_SECONDS } from '../spatialTiming';
import { creationDriveStep, type CreationRotationMode } from '../spatialCreationDrive';

export type SpatialWorldViewportHandle = {
    drive(sample: JoystickDriveSample): void;
    elevate(value: number): void;
    rotate(mode: CreationRotationMode): void;
    elapsed(): number;
    finish(): MotionPlan | null;
    reset(): void;
    triggerMove?(kind: 'jump' | 'roll' | 'crouch'): SceneAuthoringDraft | null;
    commitAuthoring?(commands: AuthoringCommand[]): SceneAuthoringDraft | null;
    currentAuthoring?(): SceneAuthoringDraft | null;
};

export function computeAspectFitBox(containerWidth: number, containerHeight: number, aspect: string) {
    const ratio = aspect === '9:16' ? 9 / 16 : aspect === '1:1' ? 1 : 16 / 9;
    const [defaultWidth, defaultHeight] = aspect === '9:16' ? [540, 960] : aspect === '1:1' ? [720, 720] : [960, 540];
    if (!Number.isFinite(containerWidth) || !Number.isFinite(containerHeight) || containerWidth <= 0 || containerHeight <= 0) {
        return { left: 0, top: 0, width: defaultWidth, height: defaultHeight, ratio };
    }
    const width = Math.min(containerWidth, containerHeight * ratio);
    const height = width / ratio;
    return {
        left: Math.max(0, (containerWidth - width) / 2),
        top: Math.max(0, (containerHeight - height) / 2),
        width: Math.max(1, width),
        height: Math.max(1, height),
        ratio,
    };
}

/** Live drive frames may repeat one pose, so saved roleless solids have no
 * motion track to identify them. Keep this control hint in the render copy. */
export function spatialViewportRenderPlan(plan: MotionPlan, controlledObject: string): MotionPlan {
    const controlled = plan.objects.find(object => object.id === controlledObject);
    if (!controlled || controlled.role) return plan;
    return { ...plan, objects: plan.objects.map(object => object === controlled ? { ...object, role: 'actor' } : object) };
}

type ViewportProps = {
    world: SpatialWorld;
    state: WorldState;
    aspect?: '16:9' | '9:16' | '1:1';
    recording?: boolean;
    plan?: MotionPlan;
    playing?: boolean;
    authoring?: SceneAuthoringDraft;
    onAuthoringChange?: (draft: SceneAuthoringDraft) => void;
    selection?: PoseTarget | null;
    onSelect?: (target: PoseTarget | null) => void;
    gizmoMode?: 'translate' | 'rotate' | 'scale' | null;
    interactive?: boolean;
    onEnd?: () => void;
    onCaptureEnd?: (plan: MotionPlan | null, authoring?: SceneAuthoringDraft) => void;
    onCaptureProgress?: (remaining: number | null) => void;
    onError?: (message: string) => void;
    time?: () => number;
    speedMultiplier?: number;
    renderWhen?: () => boolean;
};

export default forwardRef<SpatialWorldViewportHandle, ViewportProps>(function SpatialWorldViewport({
    world, state, aspect, recording = true, plan, playing, authoring, onAuthoringChange, selection = null, onSelect, gizmoMode = null, interactive = false, onEnd, onCaptureEnd, onCaptureProgress, onError, time, speedMultiplier = 1, renderWhen,
}, ref) {
    const host = useRef<HTMLDivElement>(null);
    const current = useRef({ world, state, aspect, recording, plan, playing, authoring, onAuthoringChange, selection, onSelect, gizmoMode, interactive, onEnd, onCaptureEnd, onCaptureProgress, onError, time, speedMultiplier, renderWhen });
    current.current = { world, state, aspect, recording, plan, playing, authoring, onAuthoringChange, selection, onSelect, gizmoMode, interactive, onEnd, onCaptureEnd, onCaptureProgress, onError, time, speedMultiplier, renderWhen };
    type LiveInput = { sample: JoystickDriveSample; transform: MotionPlan['objects'][number]['keys'][number] };
    const capture = useRef<(LiveInput & { plan: MotionPlan; sampledAt: number; distance: number }) | null>(null);
    // Rehearsal stores only the current pose. It has no timeline, countdown or
    // capture callbacks, and can never be returned by finish().
    const rehearsal = useRef<LiveInput | null>(null);
    const staticPlan = useRef(planAtState(world, state));
    const cutoffLatched = useRef(false);
    const vertical = useRef(0);
    const rotationMode = useRef<CreationRotationMode>(null);
    const composed = useRef(false);
    const activeSeconds = useRef(0);
    const rotationDistance = useRef(0);
    const stationaryTake = useRef(false);
    const moveSeq = useRef(0);
    const localAuthoring = useRef<SceneAuthoringDraft | undefined>(authoring);
    const wakeViewport = useRef<() => void>(() => {});
    useEffect(() => { wakeViewport.current(); });
    const heading = useRef<MotionPlan['objects'][number]['keys'][number]['rotation']>();
    // Polling replaces JSON object identities. Only a real world/position change
    // may interrupt a recording, not an unrelated generation-board update.
    const stateKey = JSON.stringify(state);
    const aspectRatio = aspect || world.aspectRatio || '16:9';

    useEffect(() => {
        localAuthoring.current = authoring;
    }, [authoring]);

    const ensureAuthoring = (): SceneAuthoringDraft => {
        if (localAuthoring.current) return localAuthoring.current;
        const c = current.current;
        const base = capture.current?.plan || staticPlan.current || planAtState(c.world, c.state);
        const created = createAuthoringDraft(base, `${c.world.revision}:${stateKey}`, {}, c.state);
        localAuthoring.current = created;
        return created;
    };

    const cameraAtPose = (transform: LiveInput['transform']) => {
        const c = current.current, camera = cloneWorld(c.state.camera);
        if (c.world.controlMode === 'pov') {
            const origin = c.state.objects[c.world.controlledObject].transform.position;
            for (let axis = 0; axis < 3; axis++) {
                camera.position[axis] += transform.position[axis] - origin[axis];
                camera.target[axis] += transform.position[axis] - origin[axis];
            }
        }
        camera.t = transform.t;
        return camera;
    };
    const finishCapture = () => {
        if (!current.current.recording || !capture.current) return null;
        const recording = capture.current; capture.current = null; vertical.current = 0;
        composed.current = false; rotationMode.current = null; heading.current = undefined;
        cutoffLatched.current = true;
        current.current.onCaptureProgress?.(null);
        const hasAuthoringTake = stationaryTake.current && Boolean(localAuthoring.current);
        stationaryTake.current = false;
        if (!hasAuthoringTake && recording.distance < .03 && rotationDistance.current < .01) return null;
        const controlled = recording.plan.objects.find(o => o.id === current.current.world.controlledObject)!;
        if (recording.transform.t > controlled.keys.at(-1)!.t) controlled.keys.push(cloneWorld(recording.transform));
        if (recording.transform.t > recording.plan.camera.at(-1)!.t) recording.plan.camera.push(cameraAtPose(recording.transform));
        const elapsed = Math.min(MOVEMENT_SECONDS, Math.max(.001, activeSeconds.current));
        // The last visible pose is the recorded endpoint, not a later AI guess.
        const authored=localAuthoring.current;
        const richTake=Boolean(hasAuthoringTake||authored&&(authored.manualControls.length||authored.events.length||authored.moves.length||authored.locks.length||authored.masks?.length||authored.cameraRig||authored.lightingRig));
        const finished = richTake ? finishAuthoringCapturePlan(recording.plan, elapsed) : finishMovementTiming(recording.plan, elapsed);
        if (localAuthoring.current) {
            const hadRootMotion = recording.distance >= .03 || rotationDistance.current >= .01;
            localAuthoring.current = mergeAuthoringPlan(localAuthoring.current, finished, {
                preserveManualTracks: true,
                controlledObjectId: hadRootMotion ? current.current.world.controlledObject : undefined,
            });
        }
        const finalPlan = localAuthoring.current ? evaluateAuthoringDraft(localAuthoring.current, finished.duration).plan : finished;
        staticPlan.current = planAtState(current.current.world, stateAtEnd(finalPlan, current.current.state));
        return localAuthoring.current ? localAuthoring.current.plan : finished;
    };
    const resetInput = (restoreSource = true) => {
        const hadCapture = Boolean(capture.current);
        capture.current = null; rehearsal.current = null; vertical.current = 0; rotationMode.current = null; composed.current = false; heading.current = undefined;
        activeSeconds.current = 0; rotationDistance.current = 0; cutoffLatched.current = false; stationaryTake.current = false;
        if (restoreSource) staticPlan.current = planAtState(current.current.world, current.current.state);
        if (hadCapture) current.current.onCaptureProgress?.(null);
    };
    useEffect(() => resetInput(), [world.revision, stateKey]);
    // Disarming after Finish keeps its endpoint visible. Arming a new motion
    // restores the saved source pose before capturing any new input.
    useEffect(() => resetInput(recording), [recording]);
    const beginInput = (sample: JoystickDriveSample) => {
        const c = current.current;
        if (!c.recording) {
            if (!rehearsal.current) rehearsal.current = { sample, transform: cloneWorld(staticPlan.current.objects.find(o => o.id === c.world.controlledObject)!.keys[0]) };
            rehearsal.current.sample = sample;
            return;
        }
        if (!capture.current) {
            activeSeconds.current = 0; rotationDistance.current = 0;
            const draft = planAtState(c.world, c.state);
            draft.objects.forEach(o => o.keys = [o.keys[0]]); draft.camera = [draft.camera[0]];
            if (composed.current) draft.objects.find(o => o.id === c.world.controlledObject)!.rotationMode = 'quaternion';
            capture.current = { plan: draft, sampledAt: 0, sample, distance: 0, transform: cloneWorld(draft.objects.find(o => o.id === c.world.controlledObject)!.keys[0]) };
        }
        capture.current.sample = sample;
    };
    const applyCommands = (commands: AuthoringCommand[]): SceneAuthoringDraft | null => {
        const c = current.current;
        if (c.plan) return null;
        try {
            const base = ensureAuthoring();
            const next = applyAuthoringCommands(base, base.revision, commands);
            localAuthoring.current = next;
            wakeViewport.current();
            if (c.recording) {
                stationaryTake.current = true;
                if (!capture.current) {
                    beginInput({ x: 0, y: 0, radius: 0, angle: 0, active: false, timestamp: performance.now() });
                }
            }
            c.onAuthoringChange?.(next);
            return next;
        } catch (error) {
            c.onError?.((error as Error).message);
            return null;
        }
    };
    useImperativeHandle(ref, () => ({
        drive(sample) {
            wakeViewport.current();
            if (!sample.active) { if (capture.current) capture.current.sample = sample; if (rehearsal.current) rehearsal.current.sample = sample; return; }
            if (cutoffLatched.current || current.current.plan) return;
            beginInput(sample);
        },
        rotate(mode) {
            wakeViewport.current();
            if (current.current.plan) return;
            const recording = capture.current;
            composed.current = true;
            if (recording) {
                recording.plan.objects.find(o => o.id === current.current.world.controlledObject)!.rotationMode = 'quaternion';
                heading.current = [...recording.transform.rotation];
                recording.sample = { ...recording.sample, active: false, x: 0, y: 0, radius: 0 };
            }
            if (rehearsal.current) {
                heading.current = [...rehearsal.current.transform.rotation];
                rehearsal.current.sample = { ...rehearsal.current.sample, active: false, x: 0, y: 0, radius: 0 };
            }
            rotationMode.current = mode;
        },
        elapsed() { return capture.current ? activeSeconds.current : 0; },
        elevate(value) {
            wakeViewport.current();
            if (current.current.plan || cutoffLatched.current) return;
            vertical.current = Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
            if (vertical.current && !(current.current.recording ? capture.current : rehearsal.current)) {
                beginInput({ x: 0, y: 0, radius: 0, angle: 0, active: false, timestamp: performance.now() });
            }
        },
        triggerMove(kind) {
            const c = current.current;
            const targetId = c.selection?.objectId || c.world.controlledObject;
            const at = c.recording && capture.current ? activeSeconds.current : 0;
            const duration = kind === 'roll' ? .8 : 1;
            return applyCommands([{ kind: 'move', at: Math.min(MOVEMENT_SECONDS - duration, Math.max(0, at)), move: { id: `move_${++moveSeq.current}`, objectId: targetId, kind, duration } }]);
        },
        commitAuthoring(commands) {
            return applyCommands(commands);
        },
        currentAuthoring() {
            return localAuthoring.current || null;
        },
        finish() { const result = finishCapture(); cutoffLatched.current = false; return result; },
        reset: resetInput,
    }), []);
    useEffect(() => {
        if (!host.current) return;
        const element = host.current;
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block';
        element.replaceChildren(canvas);
        let renderer: ReturnType<typeof createMotionRenderer>;
        const [width, height] = aspectRatio === '9:16' ? [540, 960] : aspectRatio === '1:1' ? [720, 720] : [960, 540];
        try { renderer = createMotionRenderer(canvas, world.plan, width, height, localAuthoring.current); }
        catch (error) { onError?.((error as Error).message); return; }

        let observer: ResizeObserver | undefined;
        const syncLayout = () => {
            if (!element.clientWidth || !element.clientHeight) return;
            const box = computeAspectFitBox(element.clientWidth, element.clientHeight, aspectRatio);
            canvas.style.cssText = `position:absolute;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;display:block`;
        };
        if (typeof ResizeObserver !== 'undefined') {
            observer = new ResizeObserver(syncLayout);
            observer.observe(element);
            syncLayout();
        }

        let transform: TransformControls | undefined;
        let proxy: THREE.Object3D | undefined;
        let helper: THREE.Object3D | undefined;
        let draggingGizmo = false;
        let pendingPose: MotionPlan['objects'][number]['keys'][number] | undefined;
        let pointerDown = { x: 0, y: 0 };

        const selectionNode = (): THREE.Object3D | undefined => {
            const s = current.current.selection;
            if (!s || !renderer.view) return undefined;
            return s.partId ? renderer.view.parts.get(s.objectId)?.get(s.partId) : renderer.view.roots.get(s.objectId);
        };

        const onPointerDown = (event: PointerEvent) => {
            pointerDown = { x: event.clientX, y: event.clientY };
        };
        const onPointerUp = (event: PointerEvent) => {
            const c = current.current;
            if (!c.interactive || c.plan || !renderer.view || draggingGizmo || transform?.axis) return;
            if (Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 6) return;
            const rect = canvas.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) return;
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
            const ray = new THREE.Raycaster();
            ray.setFromCamera(new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1), renderer.view.camera);
            for (const hit of ray.intersectObjects([...renderer.view.roots.values()], true)) {
                let node: THREE.Object3D | null = hit.object;
                while (node && !renderer.view.roots.has(node.name)) node = node.parent;
                if (!node) continue;
                const obj = c.world.plan.objects.find(o => o.id === node!.name);
                if (!obj || obj.surface === 'ground' || obj.id === 'ground') {
                    c.onSelect?.(null);
                    return;
                }
                const part = obj.parts?.find(p => p.id === hit.object.name);
                const boundControls = new Set(Object.values(localAuthoring.current?.rigs?.[obj.id]?.controls || {}));
                const resolvedPartId = part
                    ? (part.parentId && boundControls.has(part.parentId) && !boundControls.has(part.id) ? part.parentId : part.id)
                    : undefined;
                c.onSelect?.({ objectId: obj.id, ...(resolvedPartId ? { partId: resolvedPartId } : {}) });
                return;
            }
            c.onSelect?.(null);
        };

        if (renderer.view && typeof canvas.addEventListener === 'function') {
            try {
                transform = new TransformControls(renderer.view.camera, canvas);
                transform.setSize(.75);
                helper = transform.getHelper();
                proxy = new THREE.Object3D();
                renderer.view.scene.add(proxy, helper);
                transform.addEventListener('dragging-changed', (event: any) => {
                    draggingGizmo = Boolean(event.value);
                    if (!draggingGizmo && pendingPose && current.current.selection) {
                        const time = current.current.recording && capture.current ? activeSeconds.current : 0;
                        applyCommands(current.current.recording ? [{ kind: 'pose', target: current.current.selection, time, pose: pendingPose }] : manualPoseCommands(ensureAuthoring(), current.current.selection, time, pendingPose));
                        pendingPose = undefined;
                    }
                });
                transform.addEventListener('objectChange', () => {
                    const c = current.current, node = selectionNode();
                    if (!node || !proxy || !c.selection) return;
                    const parentInverse = node.parent?.matrixWorld.clone().invert() || new THREE.Matrix4();
                    proxy.updateMatrixWorld(true);
                    const local = parentInverse.multiply(proxy.matrixWorld);
                    const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
                    local.decompose(position, rotation, scale);
                    const euler = new THREE.Euler().setFromQuaternion(rotation);
                    const at = c.recording && capture.current ? activeSeconds.current : 0;
                    pendingPose = { t: at, position: position.toArray(), rotation: [euler.x, euler.y, euler.z], scale: scale.toArray() };
                });
                canvas.addEventListener('pointerdown', onPointerDown);
                canvas.addEventListener('pointerup', onPointerUp);
            } catch {
                // Non-DOM unit test environments omit pointer event listeners.
            }
        }

        const drawFrame = (at: number, frame: MotionPlan) => {
            const c = current.current;
            let renderFrame = spatialViewportRenderPlan(frame, c.world.controlledObject);
            if (draggingGizmo && pendingPose && c.selection) {
                const target = c.selection;
                const pose = pendingPose;
                renderFrame = {
                    ...renderFrame,
                    objects: renderFrame.objects.map(obj => {
                        if (obj.id !== target.objectId) return obj;
                        if (!target.partId) {
                            return { ...obj, keys: [{ ...pose, t: 0 }, { ...pose, t: renderFrame.duration }] };
                        }
                        return {
                            ...obj,
                            parts: obj.parts?.map(part => part.id === target.partId
                                ? { ...part, keys: [{ ...pose, t: 0 }, { ...pose, t: renderFrame.duration }] }
                                : part),
                        };
                    }),
                };
            }
            const activeAuth = localAuthoring.current ? { ...localAuthoring.current, plan: renderFrame } : undefined;
            renderer.draw(at, activeAuth ? undefined : renderFrame, undefined, activeAuth);
            if (transform && helper && proxy && renderer.view) {
                const node = c.interactive && !c.plan && c.selection && c.gizmoMode ? selectionNode() : undefined;
                helper.visible = Boolean(node);
                transform.enabled = Boolean(node);
                if (node && c.gizmoMode) {
                    transform.setMode(c.gizmoMode);
                    if (!draggingGizmo) {
                        node.matrixWorld.decompose(proxy.position, proxy.quaternion, proxy.scale);
                        proxy.updateMatrixWorld();
                        if (transform.object !== proxy) transform.attach(proxy);
                    }
                } else if (transform.object) {
                    transform.detach();
                }
            }
        };
        let raf = 0, elapsed = 0, previous = performance.now(), ended = false, previousPlan: MotionPlan | undefined, inView = true, disposed = false;
        const schedule = () => { if (!disposed && !raf && inView && !document.hidden) raf = requestAnimationFrame(draw); };
        wakeViewport.current = schedule;
        const visibility = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else { previous = performance.now(); schedule(); } };
        document.addEventListener('visibilitychange', visibility);
        const intersection = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(entries => { inView = entries.some(entry => entry.isIntersecting); if (inView) { previous = performance.now(); schedule(); } else { cancelAnimationFrame(raf); raf = 0; } });
        intersection?.observe(element);
        transform?.addEventListener('change', schedule);
        const draw = (now: number) => {
            raf = 0;
            if (disposed || !inView || document.hidden) return;
            const c = current.current, delta = Math.min(.05, Math.max(0, (now - previous) / 1000)); previous = now;
            // Keep authoring/capture state mounted while the live layer owns the
            // scene, without evaluating and rendering a second covered canvas.
            if (c.renderWhen && !c.renderWhen()) return;
            if (previousPlan !== c.plan) {
                previousPlan = c.plan; elapsed = 0; ended = false;
                if (c.plan) {
                    vertical.current = 0;
                    for (const input of [capture.current, rehearsal.current]) if (input) input.sample = { ...input.sample, active: false, x: 0, y: 0, radius: 0 };
                }
            }
            const recording = c.recording ? capture.current : null;
            const input = recording || (!c.recording ? rehearsal.current : null);
            const hasDriveInput = Boolean(!c.plan && input && ((input.sample.active && input.sample.radius > .06) || vertical.current));
            const hasStationaryClock = Boolean(!c.plan && recording && stationaryTake.current);
            if ((hasDriveInput || hasStationaryClock) && input) {
                const inputDelta = recording ? Math.min(delta, MOVEMENT_SECONDS - activeSeconds.current) : delta;
                if (recording) activeSeconds.current = Math.min(MOVEMENT_SECONDS, activeSeconds.current + inputDelta);
                if (hasDriveInput) {
                    const last = input.transform;
                    const driven = creationDriveStep(c.world, c.state, last, input.sample, inputDelta, { vertical: vertical.current, speedMultiplier: c.speedMultiplier, rotationMode: rotationMode.current, heading: heading.current });
                    if (rotationMode.current) heading.current = [...driven.rotation];
                    input.transform = { ...driven, t: recording ? activeSeconds.current : 0 };
                    if (recording) {
                        rotationDistance.current += Math.hypot(...driven.rotation.map((n, i) => n - last.rotation[i]));
                        recording.distance += Math.hypot(...driven.position.map((n, i) => n - last.position[i]));
                    }
                } else if (recording) {
                    input.transform = { ...input.transform, t: activeSeconds.current };
                }
                if (recording) {
                    c.onCaptureProgress?.(Math.max(0, Math.ceil((MOVEMENT_SECONDS - activeSeconds.current) * 10) / 10));
                    if (activeSeconds.current - recording.sampledAt >= .12) {
                        recording.plan.objects.find(o => o.id === c.world.controlledObject)!.keys.push(cloneWorld(input.transform));
                        recording.plan.camera.push(cameraAtPose(input.transform)); recording.sampledAt = activeSeconds.current;
                    }
                }
            }
            if (c.plan) {
                if (c.playing) elapsed += delta;
                const at = c.time ? c.time() : Math.min(c.plan.duration, elapsed);
                drawFrame(at, c.plan);
                if (!c.time && at >= c.plan.duration && !ended) { ended = true; c.onEnd?.(); }
            } else if (input) {
                const at = recording && stationaryTake.current ? activeSeconds.current : 0;
                const frame = { ...input.transform, t: 0 }, camera = { ...cameraAtPose(frame), t: 0 };
                const basis = localAuthoring.current?.plan || recording?.plan || staticPlan.current;
                drawFrame(at, { ...basis, objects: basis.objects.map(o => o.id === c.world.controlledObject ? { ...o, keys: [frame, { ...frame, t: 5 }] } : o), camera: [camera, { ...camera, t: 5 }] });
                if (recording && activeSeconds.current >= MOVEMENT_SECONDS) {
                    const finished = finishCapture();
                    if (finished) drawFrame(MOVEMENT_SECONDS, finished);
                    c.onCaptureEnd?.(finished, localAuthoring.current);
                }
            } else drawFrame(0, localAuthoring.current?.plan || staticPlan.current);
            if (hasDriveInput || hasStationaryClock || draggingGizmo || c.plan && (c.playing || c.time)) schedule();
        };
        schedule();
        return () => {
            disposed = true;
            cancelAnimationFrame(raf);
            if (wakeViewport.current === schedule) wakeViewport.current = () => {};
            intersection?.disconnect();
            document.removeEventListener('visibilitychange', visibility);
            observer?.disconnect();
            if (typeof canvas.removeEventListener === 'function') {
                canvas.removeEventListener('pointerdown', onPointerDown);
                canvas.removeEventListener('pointerup', onPointerUp);
            }
            transform?.dispose();
            renderer.dispose();
            canvas.remove();
        };
    }, [world.revision, aspectRatio]);
    return <div ref={host} aria-label="Playable 3D scene proxy" style={{ position: 'absolute', inset: 0, background: world.plan.background }} />;
});
