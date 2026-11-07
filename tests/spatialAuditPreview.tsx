/** Local visual test fixture. No authenticated API, upload, generation or billing. */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import axios from 'axios';
import SpatialStudio from '../src/components/SpatialStudio';
import SpatialExperiencePlayer from '../src/SpatialExperiencePlayer';
import MotionGuidePreview from '../src/components/MotionGuidePreview';
import { validateWorld, cloneWorld, stateAtEnd } from '../server/src/spatialWorld';
import { spatialVideoPixels } from '../server/src/spatialVideoSpec';

const settings = { appColorDark: '#c5d83e', appColorLight: '#6548c8', spatialControlMode: 'dpad', spatialViewerHoverActive: false };
const store = configureStore({ reducer: (state = { settings }) => state });
const frame = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960"><rect width="540" height="960" fill="#25252b"/><text x="270" y="450" text-anchor="middle" fill="white" font-size="30">Local test frame</text></svg>')}`;
const key = (t: number, x = 0) => ({ t, position: [x, .5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] });
const plan: any = { version: 1, duration: 5, background: '#25252b', objects: [
    { id: 'actor', shape: 'box', color: '#c5d83e', keys: [key(0), key(5)] },
    { id: 'floor', shape: 'box', color: '#53535b', keys: [0, 5].map(t => ({ ...key(t), position: [0, -.1, 0], scale: [8, .1, 8] })) },
], camera: [0, 5].map(t => ({ t, position: [4, 4, 7], target: [0, .5, 0], fov: 50 })) };
const world = validateWorld({ version: 2, revision: 'ui-audit', sourceImage: frame, aspectRatio: '9:16', model: 'luna', plan, controlledObject: 'actor', controlMode: 'character', walkable: [{ min: [-4, 0, -4], max: [4, 2, 4] }], obstacles: [], approved: true });
const routePlan = cloneWorld(world.plan); routePlan.objects[0].keys[1].position[0] = 2;
const forward: any = { id: 'go', prompt: 'Walk to the table', plan: routePlan, sourceState: world.initialState, endState: stateAtEnd(routePlan, world.initialState), stateChanges: {}, model: 'luna', startAnchor: frame, endAnchor: frame, createdAt: 1 };
const reversePlan = cloneWorld(routePlan); reversePlan.objects[0].keys = [key(0, 2), key(5)] as any;
const backward = { ...forward, id: 'return', plan: reversePlan, sourceState: forward.endState, endState: forward.sourceState };
const scene: any = { sceneId: 'audit-stage', activeNodeId: 'root', nodes: [{ id: 'root', label: 'Start', frameUrl: frame }, { id: 'table', label: 'Table', frameUrl: frame }], connections: [{ id: 'walk', kind: 'movement', sourceNodeId: 'root', targetNodeId: 'table', movement: { id: 'walk', sourceNodeId: 'root', durationMs: 5000, samples: [{ x: 1, y: 0, radius: 1, angle: 0, elapsedMs: 1000 }] }, forward: null, backward: null, status: 'draft' }], draftMovement: null,
    ledger: { version: 2, world, states: { root: world.initialState, table: forward.endState }, routes: { walk: { connectionId: 'walk', worldRevision: world.revision, forward, backward } }, jobs: [], epoch: 0, generationStarted: false, boardOpen: false, view: 'three' } };
let document: any = { scene, revision: 1 };
axios.defaults.adapter = async config => {
    if (!config.url?.includes('/spatial-world/document')) throw new Error('External requests are disabled in the UI fixture.');
    const body = JSON.parse(String(config.data || '{}'));
    if (body.action === 'save') document = { scene: body.scene, revision: document.revision + 1 };
    if (body.action === 'view') {
        if (body.view) document.scene.ledger.view = body.view;
        if (body.boardOpen !== undefined) document.scene.ledger.boardOpen = body.boardOpen;
        if (body.activeNodeId) document.scene.activeNodeId = body.activeNodeId;
        document.revision++;
    }
    if (!['read', 'view', 'quote', 'save'].includes(body.action)) throw new Error('Generation is disabled in this local UI fixture.');
    const result = cloneWorld(document);
    if (body.action === 'quote') result.quote = { key: 'fixture-only', pixels: spatialVideoPixels(body.options.model, body.options.resolution) * 2, jobs: [] };
    return { data: result, status: 200, statusText: 'OK', headers: {}, config };
};
function Audit() {
    const [mode, setMode] = useState('studio'), [dark, setDark] = useState(true), [tier, setTier] = useState<any>('luna');
    const [current, setCurrent] = useState(scene);
    const stages = [{ id: scene.sceneId, label: 'Main scene', address: { sceneId: scene.sceneId }, scene: current, contexts: [] }];
    const accent = dark ? settings.appColorDark : settings.appColorLight;
    const reject = async () => { throw new Error('Uploads are disabled in the fixture.'); };
    return <Provider store={store}><div style={{ height: '100vh', background: dark ? '#111' : '#fff', color: dark ? '#fff' : '#111', fontFamily: 'sans-serif' }}>
        <header style={{ height: 72, padding: 8, boxSizing: 'border-box' }}><div>LOCAL UI AUDIT · no real API calls or charges</div>
            {['studio', 'preview', 'feed', 'motion'].map(item => <button key={item} onClick={() => setMode(item)}>{item}</button>)}<button onClick={() => setDark(!dark)}>{dark ? 'Light theme' : 'Dark theme'}</button>
        </header><main style={{ position: 'relative', height: 'calc(100vh - 72px)', overflow: 'hidden' }}>
            {mode === 'studio' ? <SpatialStudio scene={current} stages={stages} postId={-99} api="/fixture" appColor={accent} darkMode={dark} prompt="Walk" model="Proxxx" resolution="480p" aspect="9:16" audio={false} update={updater => setCurrent(updater)} navigate={() => false} uploadVideo={reject} uploadFrame={reject} extractEnd={reject} dispatch={store.dispatch} />
            : mode === 'motion' ? <MotionGuidePreview guide={{ plan: world.plan, sourceFrameUrl: frame, sourcePrompt: 'Walk', aspectRatio: '9:16', createdAt: 1 }} appColor={accent} darkMode={dark} planningTier={tier} onPlanningTierChange={setTier} onEdit={async () => false} onDelete={() => {}} onRetry={() => {}} />
            : <SpatialExperiencePlayer mode={mode as 'preview' | 'feed'} document={{ version: 1, stages, entry: { stageId: scene.sceneId, nodeId: 'root' } }} darkMode={dark} />}
        </main></div></Provider>;
}
createRoot(documentGetRoot()).render(<Audit />);
function documentGetRoot() { return window.document.getElementById('root')!; }
