import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import axios from 'axios';
import SpatialStudio from '../../src/components/SpatialStudio';
import MotionGuidePreview from '../../src/components/MotionGuidePreview';
import { LiveSceneClient } from '../../src/liveSceneClient';
import { makeSceneAuthoringFixture } from '../../server/src/sceneRigPrototype';
import { validateWorld, cloneWorld } from '../../server/src/spatialWorld';
import type { SpatialSceneState } from '../../src/spatialStageModel';
import type { MotionGuideData } from '../../src/motionGuide';
import { recordMotionGuide } from '../../src/motionGuideRenderer';

const query = new URLSearchParams(location.search), dark = query.get('theme') !== 'light', surface = query.get('surface') || 'motion';
const draft = makeSceneAuthoringFixture('state');
const frame = 'https://example.test/reference.jpg';
const world = validateWorld({ version: 2, revision: 'fixture-original', sourceImage: frame, aspectRatio: '16:9', model: 'luna', plan: draft.plan, controlledObject: draft.sourceState.controlledObject, controlMode: 'character', walkable: [{ min: [-12, 0, -12], max: [12, 3, 12] }], obstacles: [], approved: true });
const initial: SpatialSceneState = { sceneId: 'fixture-stage', activeNodeId: 'root', nodes: [{ id: 'root', label: 'Start', frameUrl: frame, createdAt: 1 }], connections: [], draftMovement: null, ledger: { version: 2, world, states: { root: world.initialState }, routes: {}, jobs: [], epoch: 0, generationStarted: false, boardOpen: false, view: 'three' } };
let saved = { scene: initial, revision: 1 };
axios.defaults.adapter = async config => {
    const body = JSON.parse(String(config.data || '{}'));
    if (config.url?.includes('/spatial-world/document')) {
        if (body.action === 'save') saved = { scene: body.scene, revision: saved.revision + 1 };
        return { data: cloneWorld(saved), status: 200, statusText: 'OK', headers: {}, config };
    }
    const response = await fetch(config.url!, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { data: await response.json(), status: response.status, statusText: response.statusText, headers: {}, config };
};
const store = configureStore({ reducer: (state = { settings: { darkMode: dark, appColorDark: '#c5d83e', appColorLight: '#2670ba', spatialControlMode: 'dpad', spatialViewerHoverActive: false }, profile: { loggedUser: { id: Number(query.get('user') || 1) } } }) => state });
const reject = async () => { throw new Error('External media operations are disabled in this fixture.'); };
function Fixture() {
    const aspect = query.get('aspect') === '9:16' ? '9:16' : '16:9';
    const [scene, setScene] = useState(initial), [guide, setGuide] = useState<MotionGuideData | undefined>(query.has('empty') ? undefined : { plan: draft.plan, sourcePrompt: 'Make a scene', sourceFrameUrl: frame, aspectRatio: aspect, createdAt: 1 }), [status, setStatus] = useState('');
    const client = useMemo(() => new LiveSceneClient('/local-live', `fixture-motion-${query.get('user') || 1}`), []);
    const build = async (instruction = '') => { setStatus('AI is working…'); try { const result = await client.run('/motion-guide/build', { prompt: 'Create an actor and table', previousPlan: instruction ? guide?.plan : undefined, duration: 5, aspectRatio: aspect, llmTier: 'luna', editInstruction: instruction, liveNewBuild: true, visualCheckpoints: query.has('visual') }); const next: MotionGuideData = { plan: result.plan, sourcePrompt: 'Create an actor and table', aspectRatio: aspect, createdAt: Date.now() }; setGuide(next);
        if (query.has('export')) { setStatus('Exporting motion…'); await new Promise(resolve => setTimeout(resolve, 300)); const file = await recordMotionGuide(next.plan, aspect, new AbortController().signal, () => {}, undefined, { shortEdge: 480 }); setGuide({ ...next, videoUrl: URL.createObjectURL(file) }); }
        return true; } finally { setStatus(''); } };
    (window as any).__liveFixture = { client, getScene: () => saved.scene };
    return <Provider store={store}><style>{`*{box-sizing:border-box}html,body,#root{margin:0;min-height:100%;font-family:Arial,sans-serif;background:${dark ? '#101722' : '#f3f7fc'};color:${dark ? '#fff' : '#111'}}main{max-width:1080px;margin:auto;padding:16px}header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;font-size:14px}button{cursor:pointer}.stage{position:relative;width:100%;aspect-ratio:16/9;border-radius:18px;overflow:hidden;background:#edf5fc}@media(max-width:600px){main{padding:8px}.stage{aspect-ratio:9/16}}`}</style><main><header><strong>clikB · {surface === 'spatial' ? 'Spatial studio' : 'Motion Guide'}</strong>{surface === 'motion' && <button onClick={() => void build()}>Create motion</button>}</header>
        {surface === 'spatial' ? <section className="stage"><SpatialStudio scene={scene} stages={[]} postId={-900} api="/local-live" appColor={dark ? '#c5d83e' : '#2670ba'} darkMode={dark} prompt="Create an actor and table" duration={5} model="SeedanceMini" resolution="480p" aspect="16:9" audio={false} update={updater => setScene(updater)} navigate={() => false} uploadVideo={reject} uploadFrame={reject} extractEnd={reject} dispatch={store.dispatch} /></section>
            : <MotionGuidePreview apiUrl="/local-live" liveClient={client} guide={guide} status={status} aspectRatio={aspect} appColor={dark ? '#c5d83e' : '#2670ba'} darkMode={dark} onEdit={build} onDelete={() => setGuide(undefined)} onRetry={() => void build()} onRebuild={() => void build()} onPromptSave={() => {}} />}
    </main></Provider>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
