import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import axios from 'axios';
import LiveSceneWorkspace from '../../src/components/LiveSceneWorkspace';
import MotionGuidePreview from '../../src/components/MotionGuidePreview';
import SpatialWorldViewport from '../../src/components/SpatialWorldViewport';
import { LiveSceneClient } from '../../src/liveSceneClient';
import { adoptSceneBuild } from '../../server/src/sceneBuildAuthoring';
import { validateWorld } from '../../server/src/spatialWorld';
import { evaluateAuthoringDraft } from '../../server/src/sceneAuthoring';
import { recordMotionGuide } from '../../src/motionGuideRenderer';

const keys = (position: number[]) => [0, 5].map(t => ({ t, position, rotation: [0, 0, 0], scale: [1, 1, 1] }));
const draft = adoptSceneBuild({ version: 1, duration: 5, background: '#edf5fc', objects: [{ id: 'hero', recipe: 'humanoid', keys: keys([0, 0, 0]) }, { id: 'cup', shape: 'box', color: '#aa6655', keys: keys([1, 1, 0]) }], camera: [0, 5].map(t => ({ t, position: [3, 2, 6], target: [0, .7, 0], fov: 45 })), performance: { states: [{ objectId: 'hero', time: 0, posture: 'kneeling' }], events: [{ id: 'cup-drop', kind: 'detach', objectId: 'cup', time: 1, landing: { time: 3, position: [1, .1, 0] } }] } }, 'fixture:grounded');
const store = configureStore({ reducer: (state = { settings: { darkMode: true, appColorDark: '#bb88dd' }, profile: { loggedUser: { id: 1 } } }) => state });
axios.defaults.adapter = async config => ({ data: { items: [], hasMore: false }, status: 200, statusText: 'OK', headers: {}, config });
const world = validateWorld({ version: 2, revision: 'fixture', plan: draft.plan, authoring: draft, controlledObject: 'hero', controlMode: 'character', aspectRatio: '16:9', sourceImage: 'https://example.test/source.png', model: 'luna', walkable: [{ min: [-10, 0, -10], max: [10, 3, 10] }], obstacles: [], approved: true });
let streamController: ReadableStreamDefaultController<Uint8Array> | undefined, sequence = 0, commit = 0;
const captures: string[] = [];
let accepted = draft;
const send = (event: any) => streamController?.enqueue(new TextEncoder().encode(JSON.stringify({ ...event, seq: ++sequence, buildId: 'offline-build' }) + '\n'));
const json = (data: any) => Promise.resolve(new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }));
const nativeFetch = window.fetch.bind(window);
window.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    if (!String(url).startsWith('/fixture-live')) return nativeFetch(url, init);
    const body = JSON.parse(String(init?.body || '{}'));
    if (String(url).endsWith('/scene-live/pause')) {
        if (body.authoring) accepted = body.authoring;
        if (!body.checkpointOnly) { send({ type: 'paused', status: 'paused', plan: accepted.plan, authoring: accepted, commitSeq: commit }); streamController?.close(); streamController = undefined; }
        return json({ status: 'paused', plan: accepted.plan, authoring: accepted, commitSeq: commit });
    }
    if (String(url).endsWith('/scene-live/render-feedback')) {
        captures.push(body.viewportSnapshot);
        send({ type: 'final', result: { plan: accepted.plan, authoring: accepted } }); streamController?.close(); streamController = undefined;
        return json({ accepted: true });
    }
    if (String(url).endsWith('/motion-guide/build')) {
        const resumed = Boolean(body.continueBuildId);
        const stream = new ReadableStream<Uint8Array>({ start(controller) { streamController = controller; } });
        if (resumed) {
            accepted = adoptSceneBuild({ ...body.partialPlan, objects: [...body.partialPlan.objects, { id: 'lamp', shape: 'sphere', color: '#eebb55', keys: keys([0, 2.5, 0]) }] }, draft.sourceKey, body.authoring, body.pinnedObjectIds);
            send({ type: 'continued', plan: accepted.plan, authoring: accepted, segment: 2, continuationsLeft: 3 });
            setTimeout(() => send({ type: 'render-checkpoint', checkpointId: 'final-check', commitSeq: commit, plan: accepted.plan, authoring: accepted, message: 'Checking the full animation' }), 50);
        } else {
            send({ type: 'started', tier: 'luna', duration: 5 });
            setTimeout(() => send({ type: 'commit', sequence: ++commit, ops: [{ op: 'upsertObject', object: draft.plan.objects[0] }], authoring: adoptSceneBuild({ ...draft.plan, objects: [draft.plan.objects[0]] }, draft.sourceKey), message: 'First geometry' }), 50);
            setTimeout(() => send({ type: 'commit', sequence: ++commit, ops: [{ op: 'upsertObject', object: draft.plan.objects[1] }], authoring: draft }), 120);
        }
        return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } });
    }
    return json({ builds: [] });
}) as typeof window.fetch;
function Fixture() {
    const client = useMemo(() => new LiveSceneClient('/fixture-live', 'fixture:editor'), []);
    const [guide, setGuide] = useState({ plan: draft.plan, authoring: draft, sourcePrompt: 'Kneeling character drops a cup', sourceFrameUrl: '', aspectRatio: '16:9' as const, createdAt: 1 });
    const mode = (window as any).__fixtureMode || 'live';
    useMemo(() => {
        if (mode !== 'stream') client.loadLocalDraft(draft);
        (window as any).__fixture = { client, draft, captures, evaluate: (time: number) => evaluateAuthoringDraft(client.snapshot().authoring!, time),
            start: () => { void client.run('/motion-guide/build', { prompt: 'Kneeling character drops a cup', duration: 5, aspectRatio: '16:9', llmTier: 'luna', liveNewBuild: true }).then(result => client.loadLocalDraft(result.authoring)); },
            export: async () => {
                const source = client.snapshot().authoring || draft;
                const file = await recordMotionGuide(source.plan, '16:9', new AbortController().signal, () => {}, source, { shortEdge: 480 });
                const video = document.createElement('video'); video.id = 'exported'; video.src = URL.createObjectURL(file); video.muted = true; video.preload = 'auto'; document.body.append(video); return file.size;
            },
        };
    }, [client]);
    return <Provider store={store}><style>{`html,body{margin:0;background:#111820;color:white;font-family:sans-serif}*{box-sizing:border-box}#scroll-panel{margin:12px auto;width:calc(100% - 24px);max-width:700px;height:560px;overflow:auto;overscroll-behavior:contain;border:1px solid #444;border-radius:16px}header,footer{height:240px;padding:24px;background:#182330}section{position:relative;height:360px}button{cursor:pointer}`}</style><div id="scroll-panel"><header>Video controls and prompt{mode === 'stream' && <button onClick={() => (window as any).__fixture.start()}>Start AI build</button>}</header>
        {mode === 'completed' ? <MotionGuidePreview apiUrl="/fixture" guide={guide} aspectRatio="16:9" onEdit={async () => false} onManualCommit={async authoring => { setGuide({ ...guide, plan: authoring.plan, authoring }); return true; }} onDelete={() => {}} onRetry={() => {}} onPromptSave={() => {}} />
            : mode === 'spatial' ? <section><SpatialWorldViewport world={world} state={world.initialState} recording={false} authoring={draft} /></section>
                : <LiveSceneWorkspace client={client} persistent aspect="16:9" />}
        <footer><button>Generate video</button><p>Ordinary page scrolling remains outside canvas gestures.</p></footer><div style={{ height: 700 }}>More settings</div></div></Provider>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
