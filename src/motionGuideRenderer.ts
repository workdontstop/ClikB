import * as THREE from 'three';
import { validateMotionPlan, type MotionPlan } from './motionGuide';
import { createMotionScene } from './motionScene';
import { motionExportComplete, readMotionExportDuration } from './motionExportTiming';
import { evaluateScenePerformance, validateScenePerformance } from '../server/src/scenePerformance';
import type { SceneAuthoringDraft } from '../server/src/sceneAuthoring';
import { assertMotionVideoContent } from './motionExportContent';
import { liveSceneLog } from './liveSceneDiagnostics';
import { hasVisibleSceneGeometry } from '../server/src/sceneVisibility';

export type MotionExportOptions = { shortEdge?: 480 | 720 };
export function motionExportSettings(aspect: string, options: MotionExportOptions = {}) {
    const edge = options.shortEdge || 720;
    const longEdge = Math.round(edge * 16 / 9 / 2) * 2;
    return { width: aspect === '9:16' || aspect === '1:1' ? edge : longEdge,
        height: aspect === '16:9' || aspect === '1:1' ? edge : longEdge,
        bitrate: edge === 480 ? 1_500_000 : 5_000_000 };
}

export function createMotionRenderer(canvas: HTMLCanvasElement, input: MotionPlan, width: number, height: number, authoring?: SceneAuthoringDraft) {
    const source = validateScenePerformance({plan:input,authoring}), plan = source.plan;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    try {
        renderer.setPixelRatio(1);
        renderer.setSize(width, height, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.18;
        // The caller's first draw may use a chronological node plan. Avoid
        // initializing its matrices at the reconstruction origin beforehand.
        const view = createMotionScene(plan, width / height, false);
        let disposed = false;
        return { renderer, view, draw: (time: number, framePlan?: MotionPlan, camera?: THREE.Camera, nextAuthoring?: SceneAuthoringDraft) => {
            const activeSource = nextAuthoring ? { ...source, authoring: nextAuthoring } : source;
            const frame = framePlan || evaluateScenePerformance(activeSource,time);
            view.draw(!framePlan && activeSource.authoring ? 0 : time, frame, activeSource.authoring?.lightingRig); renderer.render(view.scene, camera || view.camera);
            return frame;
        }, dispose: () => {
            if (disposed) return;
            disposed = true;
            try { view.dispose(); } finally { renderer.dispose(); renderer.forceContextLoss(); }
        } };
    } catch (error) { renderer.dispose(); renderer.forceContextLoss(); throw error; }
}

export function motionRecordingMime(): string {
    if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) throw new Error('This browser cannot export Motion Guides. Use a browser with MP4 recording support.');
    const mime = ['video/mp4;codecs=avc1.42001f', 'video/mp4;codecs=avc1', 'video/mp4'].find(m => MediaRecorder.isTypeSupported(m));
    if (!mime) throw new Error('This browser cannot record MP4 Motion Guides. Try a current Chrome, Edge or Safari browser.');
    return mime;
}

/** Check the same export paths before a paid Motion Guide build. */
export async function verifyMotionRecording(aspect: string, options: MotionExportOptions = {}): Promise<void> {
    const { width, height, bitrate } = motionExportSettings(aspect, options);
    const { canEncodeVideo, Quality } = await import('mediabunny');
    if (await canEncodeVideo('avc', { width, height, frameRate: 30, quality: new Quality({ bitrate }) })) return;
    motionRecordingMime();
}

export async function recordMotionGuide(plan: MotionPlan, aspect: string, signal: AbortSignal, progress: (percent: number) => void, authoring?: SceneAuthoringDraft, options: MotionExportOptions = {}): Promise<File> {
    if (signal.aborted) throw new Error('Motion Guide cancelled.');
    if (!hasVisibleSceneGeometry(plan)) throw new Error('The saved motion plan contains no visible geometry. The live checkpoint must be recovered before export.');
    const waitForVisibility = () => document.hidden ? new Promise<void>((resolve, reject) => {
        const cleanup = () => { document.removeEventListener('visibilitychange', visible); signal.removeEventListener('abort', aborted); };
        const visible = () => { if (!document.hidden) { cleanup(); resolve(); } };
        const aborted = () => { cleanup(); reject(new Error('Motion Guide cancelled.')); };
        document.addEventListener('visibilitychange', visible); signal.addEventListener('abort', aborted, { once: true });
        if (signal.aborted) aborted(); else visible();
    }) : Promise.resolve();
    await waitForVisibility();
    const { width, height, bitrate } = motionExportSettings(aspect, options);
    const startedAt = performance.now();
    liveSceneLog('export-start', { width, height, fps: 30, objects: plan.objects.length });
    const canvas = document.createElement('canvas');
    // Frame timestamps define duration, not wall-clock recorder scheduling.
    // Lazy loading keeps the encoding library out of initial app startup.
    const { Output, Mp4OutputFormat, BufferTarget, CanvasSource, Quality, canEncodeVideo } = await import('mediabunny');
    const quality = new Quality({ bitrate });
    const frameEncodingSupported = await canEncodeVideo('avc', { width, height, frameRate: 30, quality });
    if (signal.aborted) throw new Error('Motion Guide cancelled.');
    const view = createMotionRenderer(canvas, plan, width, height, authoring);
    let stream: MediaStream | undefined;
    try {
        if (frameEncodingSupported) {
            const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
            try {
                const source = new CanvasSource(canvas, { codec: 'avc', quality });
                output.addVideoTrack(source, { frameRate: 30 });
                await output.start();
                const frames = Math.round(plan.duration * 30);
                for (let i = 0; i < frames; i++) {
                    if (signal.aborted) throw new Error('Motion Guide cancelled.');
                    await waitForVisibility();
                    view.draw(i === frames - 1 ? plan.duration : i / 30);
                    await source.add(i / 30, 1 / 30, { keyFrame: i % 30 === 0 });
                    progress(Math.round((i + 1) / frames * 100));
                    // Yield without changing encoded timing, even on a slow phone.
                    if (i % 6 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
                }
                await output.finalize();
                if (signal.aborted) throw new Error('Motion Guide cancelled.');
                const file = new File([output.target.buffer!], 'motion-guide.mp4', { type: 'video/mp4' });
                const duration = await readMotionExportDuration(file, signal);
                if (!motionExportComplete(duration, plan.duration)) throw new Error('MP4 encoding did not preserve the full timeline. Retry export; the Three.js motion is retained.');
                await assertMotionVideoContent(file, signal);
                liveSceneLog('export-verified', { width, height, duration, bytes: file.size, elapsedMs: performance.now() - startedAt });
                return file;
            } finally {
                if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel();
            }
        }
        // Older browsers retain their native MP4 recorder as a compatibility path.
        const mimeType = motionRecordingMime();
        view.draw(0);
        stream = canvas.captureStream(30);
        const capture = (padding: number) => new Promise<Blob>((resolve, reject) => {
            const recorder = new MediaRecorder(stream!, { mimeType, videoBitsPerSecond: bitrate });
            const chunks: Blob[] = [];
            let raf = 0, done = false, timeout: ReturnType<typeof setTimeout>;
            const cleanup = () => { cancelAnimationFrame(raf); clearTimeout(timeout); signal.removeEventListener('abort', abort); document.removeEventListener('visibilitychange', visibility); };
            const fail = (message: string) => {
                if (done) return;
                done = true; cleanup();
                if (recorder.state !== 'inactive') recorder.stop();
                reject(new Error(message));
            };
            const abort = () => fail('Motion Guide cancelled.');
            const visibility = () => { if (document.hidden) fail('This browser interrupted motion export while hidden. Return to the scene and click Finish mapping to retry; no new AI charge.'); };
            signal.addEventListener('abort', abort);
            document.addEventListener('visibilitychange', visibility);
            recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
            recorder.onerror = () => fail('MP4 recording failed. You can retry export without rebuilding.');
            recorder.onstop = () => {
                if (done) return;
                done = true; cleanup();
                const output = new Blob(chunks, { type: 'video/mp4' });
                if (!output.size) reject(new Error('The motion recording was empty.'));
                else resolve(output);
            };
            let start = 0, previous = 0;
            const tick = (now: number) => {
                if (done) return;
                if (previous && now - previous > 500) { fail('Motion export fell behind. Retry export with fewer busy browser tabs.'); return; }
                if (!start) start = now;
                previous = now;
                const time = Math.min((now - start) / 1000, plan.duration);
                view.draw(time);
                progress(Math.round(time / plan.duration * 100));
                // Allow captureStream to encode the final pose before stopping.
                // Stopping on the final draw can truncate the MP4 below the requested duration.
                if ((now - start) / 1000 >= plan.duration + padding) recorder.stop();
                else raf = requestAnimationFrame(tick);
            };
            timeout = setTimeout(() => fail('Motion export timed out. Retry export.'), (plan.duration + 10) * 1000);
            try {
                if (signal.aborted) { abort(); return; }
                recorder.start();
                raf = requestAnimationFrame(tick);
            } catch (error) { done = true; cleanup(); reject(error); }
        });
        let padding = 2 / 30;
        for (let attempt = 0; attempt < 2; attempt++) {
            const blob = await capture(padding);
            const duration = await readMotionExportDuration(blob, signal);
            if (motionExportComplete(duration, plan.duration)) {
                await assertMotionVideoContent(blob, signal);
                liveSceneLog('export-verified', { width, height, duration, bytes: blob.size, elapsedMs: performance.now() - startedAt });
                return new File([blob], 'motion-guide.mp4', { type: 'video/mp4' });
            }
            padding += Math.max(.25, plan.duration - duration + .1);
            if (attempt === 1) throw new Error(`Motion reference export measured ${duration.toFixed(3)}s; expected ${plan.duration}s. The Three.js motion is retained. Retry export; no new AI charge.`);
        }
        throw new Error('Motion export could not finish. Retry export; no new AI charge.');
    } finally { try { stream?.getTracks().forEach(t => t.stop()); } finally { view.dispose(); } }
}
