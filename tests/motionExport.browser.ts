import { createMotionRenderer, recordMotionGuide, verifyMotionRecording } from '../src/motionGuideRenderer';
import { createMotionScene } from '../src/motionScene';
import * as THREE from 'three';
import type { MotionPlan, MotionPart, MotionVec3 } from '../server/src/motionGuidePlan';
import { readMotionExportDuration } from '../src/motionExportTiming';
import { finishMovementTiming } from '../src/spatialTiming';
const original: any = { version:1,duration:5,background:'#203440',objects:[{id:'girl',shape:'box',color:'#506fc2',keys:[0,1].map(t=>({t,position:[t,.5,0],rotation:[0,t,0],scale:[1,1,1]}))}],camera:[0,1].map(t=>({t,position:[3,3,5],target:[0,.5,0],fov:45})) };
(window as any).testMotionExport = async (seconds: number, aspect: '9:16'|'16:9'|'1:1', pause = false) => {
    await verifyMotionRecording(aspect);
    const plan=finishMovementTiming(original,1);
    if(seconds!==5) {
        for(const object of plan.objects) object.keys.forEach(key=>key.t=key.t/5*seconds);
        plan.camera.forEach(key=>key.t=key.t/5*seconds); plan.duration=seconds;
    }
    let hidden=false, paused=false, progressedWhileHidden=false, resumeTimer:ReturnType<typeof setTimeout> | undefined;
    if(pause)Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});
    try {
        const file=await recordMotionGuide(plan,aspect,new AbortController().signal,percent=>{
            if(hidden)progressedWhileHidden=true;
            if(pause&&!paused&&percent>=10) {
                paused=true;hidden=true;document.dispatchEvent(new Event('visibilitychange'));
                resumeTimer=setTimeout(()=>{hidden=false;document.dispatchEvent(new Event('visibilitychange'));},300);
            }
        });
        const measured=await readMotionExportDuration(file,new AbortController().signal);
        return {measured,bytes:file.size,type:file.type,endpoint:plan.objects[0].keys.at(-1)?.position,paused,progressedWhileHidden,data:Array.from(new Uint8Array(await file.arrayBuffer()))};
    } finally {if(resumeTimer)clearTimeout(resumeTimer);if(pause)delete (document as any).hidden;}
};

// A deliberately richer, hand-authored fixture tests the format and renderer;
// it makes no claim about an AI model's reconstruction accuracy.
const part = (id: string, shape: MotionPart['shape'], position: MotionVec3, scale: MotionVec3, color: string, extra: Partial<MotionPart> = {}): MotionPart => ({ id, shape, color,
    keys: [0, 5].map(t => ({ t, position, rotation: [0, 0, 0], scale })), ...extra });
const rich: MotionPlan = { version: 1, duration: 5, background: '#202b3c', objects: [
    { ...part('dragon', 'box', [-.8, .7, 0], [1, 1, 1], '#397782'), identity: 'Blue dragon', parts: [
        part('body', 'capsule', [0, 0, 0], [.8, 1.3, .7], '#397782', { keys: [0, 5].map(t => ({ t, position: [0, 0, 0], rotation: [0, 0, -Math.PI / 2], scale: [.8, 1.3, .7] })) }),
        part('neck', 'cylinder', [.7, .2, 0], [.6, .65, .6], '#397782', { geometry: { radiusTop: .24, radiusBottom: .35 } }),
        part('head', 'sphere', [.95, .65, 0], [.65, .5, .5], '#4b91a0'),
        part('snout', 'box', [1.23, .6, .03], [.42, .21, .33], '#4b91a0'),
        part('eye', 'sphere', [1.06, .75, .22], [.1, .1, .06], '#f3ca59'),
        part('tail', 'tube', [-.6, -.05, 0], [1, 1, 1], '#397782', { geometry: { path: [[0, 0, 0], [-.6, -.15, 0], [-1, .2, .12]], radius: .13 } }),
        ...[-1, 1].map(side => part(`wing${side}`, 'extrude', [-.15, .28, side * .32], [1, 1, 1], '#b87553', { geometry: { outline: [[0, 0], [-1.15, .85], [-.95, .1], [-.65, -.2]], depth: .04 }, pivot: [0, 0, 0], keys: [0, 1.25, 2.5, 3.75, 5].map((t, i) => ({ t, position: [-.15, .28, side * .32], rotation: [side * (i % 2 ? .3 : 1.15), 0, 0], scale: [1, 1, 1] })) })),
        ...[-1, 1].flatMap((side, sideIndex) => [-.45, .45].map((x, legIndex) => part(`leg_${sideIndex}_${legIndex}`, 'capsule', [x, -.48, side * .25], [.3, .7, .3], '#397782'))),
        part('saddle', 'box', [0, .5, 0], [.5, .12, .42], '#5e453e'),
    ], keys: [0, 5].map(t => ({ t, position: [-.8 + t * .25, .7 + t * .12, 0], rotation: [0, 0, 0], scale: [1, 1, 1] })) },
    { ...part('rider', 'box', [0, .28 / .12, 0], [2, 1 / .12, 1 / .42], '#c8d6df'), attachment: { objectId: 'dragon', partId: 'saddle' }, identity: 'Knight', parts: [
        part('torso', 'capsule', [0, 0, 0], [.9, .7, .65], '#c8d6df'),
        part('helmet', 'sphere', [0, .4, 0], [.38, .42, .38], '#dde6ec'),
        part('visor', 'box', [.15, .39, .03], [.12, .08, .27], '#303945'),
        part('arm', 'capsule', [.24, .03, .14], [.22, .5, .22], '#c8d6df', { pivot: [0, .2, 0], keys: [0, 2.5, 5].map((t, i) => ({ t, position: [.24, .03, .14], rotation: [0, 0, i === 1 ? 1.25 : -.25], scale: [.22, .5, .22] })) }),
        part('hand', 'sphere', [0, -.45, 0], [.16 / .22, .16 / .5, .16 / .22], '#d8ae81', { parentId: 'arm' }),
        part('blade', 'extrude', [0, -1.2, 0], [6.25, 6.25, 6.25], '#eef3ff', { identity: 'Silver sword', parentId: 'hand', geometry: { outline: [[-.05, 0], [.05, 0], [.04, -.6], [0, -.75], [-.04, -.6]], depth: .05 } }),
        part('guard', 'box', [0, -1.2, 0], [.45 / .16, .12 / .16, .18 / .16], '#ddb86e', { parentId: 'hand' }),
        ...[-1, 1].map(side => part(`rider_leg${side}`, 'capsule', [.05, -.3, side * .27], [.22, .65, .22], '#94a9b9')),
    ] },
    part('ground', 'box', [0, -.05, 0], [6, .1, 4], '#35464e'),
], camera: [0, 5].map(t => ({ t, position: [4.5, 3, 5], target: [0, 1.2, 0], fov: 45 })) };
(window as any).testRichMotionPreview = () => {
    const scene = createMotionScene(rich, 16 / 9), meshes: THREE.Mesh[] = []; scene.scene.traverse(node => { if (node instanceof THREE.Mesh) meshes.push(node); });
    const geometries = meshes.map(mesh => mesh.geometry), materials = meshes.map(mesh => mesh.material);
    const started = performance.now(); for (let frame = 0; frame < 300; frame++) scene.draw(frame / 60);
    const sceneUpdateMs = performance.now() - started;
    const reuse = meshes.every((mesh, i) => mesh.geometry === geometries[i] && mesh.material === materials[i]);
    const blade = scene.parts.get('rider')!.get('blade')!.getWorldPosition(new THREE.Vector3()).toArray();
    const triangles = meshes.reduce((total, mesh) => total + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0);
    scene.dispose();
    const canvas = document.createElement('canvas'); canvas.style.width = '960px'; document.body.replaceChildren(canvas);
    const renderer = createMotionRenderer(canvas, rich, 960, 540); renderer.draw(2.5);
    (window as any).disposeRichPreview = () => renderer.dispose();
    return { meshes: meshes.length, uniqueGeometry: new Set(geometries).size, triangles, reuse, sceneUpdateMs, blade };
};
(window as any).testRichMotionExport = async () => {
    const started = performance.now(), file = await recordMotionGuide(rich, '16:9', new AbortController().signal, () => {});
    return { measured: await readMotionExportDuration(file, new AbortController().signal), exportMs: performance.now() - started, bytes: file.size, data: Array.from(new Uint8Array(await file.arrayBuffer())) };
};

(window as any).testMotionResourceBaseline = async () => {
    const canvas = document.createElement('canvas'), getContext = canvas.getContext.bind(canvas);
    const counts = { buffers: 0, textures: 0, maxBuffers: 0, maxTextures: 0 }, patched = new Set<WebGLRenderingContext | WebGL2RenderingContext>();
    let gl: WebGLRenderingContext | WebGL2RenderingContext | undefined;
    canvas.getContext = ((...args: any[]) => {
        const context: any = (getContext as any)(...args);
        if (context && (args[0] === 'webgl' || args[0] === 'webgl2') && !patched.has(context)) {
            gl = context; patched.add(context);
            for (const [create, remove, field, max] of [['createBuffer', 'deleteBuffer', 'buffers', 'maxBuffers'], ['createTexture', 'deleteTexture', 'textures', 'maxTextures']] as const) {
                const allocate = context[create].bind(context), release = context[remove].bind(context), owned = new Set<unknown>();
                context[create] = (...params: unknown[]) => {
                    const result = allocate(...params); if (result) { owned.add(result); counts[field]++; counts[max] = Math.max(counts[max], counts[field]); } return result;
                };
                context[remove] = (value: unknown) => { if (owned.delete(value)) counts[field]--; return release(value); };
            }
        }
        return context;
    }) as typeof canvas.getContext;
    const plan = structuredClone(rich);
    plan.objects.push({ ...part('label', 'text', [0, 2.8, 0], [2, .4, 1], '#FF00FF'), text: { content: 'Exact words 0' } });
    const view = createMotionRenderer(canvas, plan, 960, 540);
    view.draw(0); const initial = { ...counts };
    const started = performance.now(); for (let frame = 0; frame < 120; frame++) view.draw(frame / 30);
    const renderMs = performance.now() - started;
    for (let edit = 1; edit <= 10; edit++) {
        const edited = structuredClone(plan); edited.objects[0].subjectColor = `#${(0x123450 + edit).toString(16)}`;
        edited.objects.at(-1)!.text!.content = `Exact words ${edit}`; view.draw(2.5, edited);
    }
    const afterEdits = { ...counts }; view.dispose(); view.dispose();
    return { initial, afterEdits, afterDispose: { ...counts }, contextLost: gl?.isContextLost(), renderMs, frames: 120,
        mountedVideos: document.querySelectorAll('video').length, mountedCanvases: document.querySelectorAll('canvas').length };
};

// Real text pixels in the preview and decoded MP4, with an attached moving
// parent and timed visibility. No provider, uploaded asset or user session.
(window as any).testTextMotionExport = async () => {
    const plan: MotionPlan = { version: 1, duration: 2, background: '#FFFFFF', objects: [
        { id: 'owner', shape: 'box', color: '#445566', keys: [0, 2].map(t => ({ t, position: [t * .2, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] })) },
        { id: 'words', shape: 'text', color: '#FF00FF', text: { content: "USER'S WORDS\nExact @Case", fontFamily: 'serif', fontWeight: 700 },
            attachment: { objectId: 'owner' }, interpolation: 'step', keys: [0, .5, 1.5, 2].map(t => ({ t, position: [0, 1.3, .01], rotation: [0, 0, 0], scale: [2.4, .7, 1], opacity: t >= .5 && t < 2 ? 1 : 0 })) },
    ], camera: [0, 2].map(t => ({ t, position: [0, 1, 6], target: [0, 1, 0], fov: 45 })) };
    const canvas = document.createElement('canvas'); document.body.replaceChildren(canvas);
    const view = createMotionRenderer(canvas, plan, 1280, 720);
    const stats = (data: Uint8ClampedArray) => {
        let count = 0, x = 0, y = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i] > 170 && data[i + 1] < 100 && data[i + 2] > 170) {
            count++; x += i / 4 % 1280; y += Math.floor(i / 4 / 1280);
        }
        return { count, x: count ? x / count : 0, y: count ? y / count : 0 };
    };
    const copy = document.createElement('canvas'); copy.width = 1280; copy.height = 720;
    const context = copy.getContext('2d')!;
    view.draw(0); context.drawImage(canvas, 0, 0); const hidden = stats(context.getImageData(0, 0, 1280, 720).data);
    view.draw(1); context.drawImage(canvas, 0, 0); const preview = stats(context.getImageData(0, 0, 1280, 720).data);
    const previewPng = copy.toDataURL('image/png');
    const file = await recordMotionGuide(plan, '16:9', new AbortController().signal, () => {});
    const video = document.createElement('video'), url = URL.createObjectURL(file);
    try {
        video.muted = true; video.preload = 'auto';
        await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error('Text MP4 failed to load.')); video.src = url; });
        await new Promise<void>(resolve => { video.onseeked = () => resolve(); video.currentTime = 1; });
        context.clearRect(0, 0, 1280, 720); context.drawImage(video, 0, 0, 1280, 720);
        const exported = stats(context.getImageData(0, 0, 1280, 720).data);
        return { hidden, preview, exported, previewPng, exportedPng: copy.toDataURL('image/png'), measured: video.duration, data: Array.from(new Uint8Array(await file.arrayBuffer())) };
    } finally { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); view.dispose(); }
};
