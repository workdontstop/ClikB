/** Isolated host-integration fixture: never uses a signed-in session or paid API. */
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import axios from 'axios';
import * as THREE from 'three';
import SpatialStudio from '../src/components/SpatialStudio';
import { validateWorld, cloneWorld, stateAtEnd } from '../server/src/spatialWorld';
import { prepareSpatialMotion } from '../server/src/spatialMotion';
import { prepareSpatialReconstruction } from '../server/src/spatialReconstruction';
import { readMotionExportDuration } from '../src/motionExportTiming';
import { spatialOperation, spatialSession } from '../src/spatialWorldClient';
import { spatialVideoPixels } from '../server/src/spatialVideoSpec';

const query = new URLSearchParams(location.search);
const ready = query.get('ready') === '1';
const frame = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="640"><rect width="400" height="640" fill="#304440"/><circle cx="200" cy="180" r="55" fill="#dab89a"/><path d="M140 240h120v220H140z" fill="#506fc2"/></svg>')}`;
const plan: any = { version: 1, duration: 5, background: '#304440', objects: [{ id: 'girl', shape: 'box', color: '#506fc2', keys: [0, 5].map(t => ({ t, position: [0, .5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] })) }], camera: [0, 5].map(t => ({ t, position: [3, 3, 5], target: [0, .5, 0], fov: 45 })) };
if (query.get('continuity')) { plan.objects[0].identity='Raider'; plan.objects.push({...cloneWorld(plan.objects[0]),id:'car',identity:'Hover bike'}); }
const world = validateWorld({ version: 2, model: 'luna', revision: 'test', sourceImage: frame, aspectRatio: '9:16', plan, controlledObject: 'girl', controlMode: 'character', walkable: [{ min: [-4, 0, -4], max: [4, 2, 4] }], obstacles: [], approved: true });
if (query.get('flight') || query.get('water')) world.locomotion = { kind: query.get('water') ? 'water' : 'air', vertical: true, speed: 1, turnRate: 2 };
if (query.get('trapped')) { world.walkable = [{ min: [-.5,0,-.5], max: [.5,2,.5] }]; world.obstacles = [{ min: [-1,0,-1], max: [1,2,1] }]; }
if (query.get('review')) {
    world.approved = false; world.controlSelectionRequired = true;
    if (!query.get('noAssets')) { world.drivenName = 'girl'; world.references = [{ name: 'girl', imageUrl: 'https://assets.test/girl.png', description: 'Blue outfit' }]; }
}
const scene: any = { sceneId: 'responsive', activeNodeId: 'root', nodes: [{ id: 'root', label: 'Start', frameUrl: frame }], connections: [], draftMovement: null,
    ...(ready ? { ledger: { version: 2, world, states: { root: world.initialState }, routes: {}, jobs: [], epoch: 0, generationStarted: false, boardOpen: false, view: 'three' } } : {}) };
if (query.get('audioRef')) spatialSession('/fixture', -100, scene.sceneId).authoring.inputs.kind = 'action';
if (ready && (query.get('board') || query.get('backtrackSetup'))) {
    const animation = {id:'motion',prompt:'CAMERA: walk all the way to cockpit',plan:cloneWorld(plan),sourceState:world.initialState,endState:world.initialState,stateChanges:{},model:'luna',createdAt:1,referenceVideo:'/fixture/three.mp4',startAnchor:frame,endAnchor:frame};
    scene.nodes.push({id:'end',label:'Step 1',frameUrl:frame});
    scene.connections.push({id:'edge',sourceNodeId:'root',targetNodeId:'end',kind:'movement',movement:{samples:[{x:0,y:1,radius:1,angle:0,elapsedMs:0}],durationMs:5000},forward:{videoUrl:'/fixture/forward.mp4',durationMs:5000,provider:'api'},backward:null,status:'ready'});
    scene.ledger.routes.edge={connectionId:'edge',worldRevision:world.revision,forward:animation,backward:cloneWorld(animation)};
    scene.ledger.states.end=cloneWorld(world.initialState);
    scene.ledger.jobs=['forward','backward'].map(direction=>({id:`edge:${direction}`,connectionId:'edge',direction,kind:'movement',sourceNodeId:direction==='forward'?'root':'end',targetNodeId:direction==='forward'?'end':'root',dependsOn:direction==='forward'?[]:['edge:forward'],status:direction==='forward'?'ready':'failed',prompt:animation.prompt,startAnchor:frame,endAnchor:frame,referenceVideo:animation.referenceVideo,model:'SeedanceMini',pixels:83,duration:5,attempt:1,...(direction==='forward'?{output:'/fixture/forward.mp4',actualEndFrame:frame,continuity:'approved'}:{error:'Provider moderation rejected this request (E005).'})}));
    scene.ledger.generationStarted=!query.get('mappedBoard'); scene.ledger.boardOpen=true;
    if(query.get('mappedBoard'))scene.ledger.jobs=[];
    if(query.get('failedChain')) {
        scene.ledger.jobs[0].status='failed'; scene.ledger.jobs[0].error='Provider rejected the opening clip.';
        delete scene.ledger.jobs[0].output; delete scene.ledger.jobs[0].actualEndFrame; delete scene.ledger.jobs[0].continuity;
        scene.ledger.jobs[1].status='blocked'; scene.ledger.jobs[1].error='Waiting for the opening clip.';
        scene.connections[0].forward=null; scene.nodes[1].frameUrl='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="640"><rect width="400" height="640" fill="red"/></svg>');
        scene.activeNodeId='end';
    }
    if(query.get('videoView'))scene.ledger.view='video';
    if(query.get('reviewResult')) {scene.ledger.jobs[0].status='checking';scene.ledger.jobs[0].continuity='needs-review';}
    if(query.get('eightMotions')) {
        for(let index=2;index<=8;index++) {
            const id=`edge-${index}`;
            scene.ledger.routes[id]={...cloneWorld(scene.ledger.routes.edge),connectionId:id};
            scene.ledger.jobs.push(...scene.ledger.jobs.slice(0,2).map((job:any)=>({...cloneWorld(job),id:`${id}:${job.direction}`,connectionId:id})));
        }
    }
    if(query.get('partialBoard')) {
        for(let index=2;index<=3;index++) {
            const id=`edge-${index}`, target=`end-${index}`;
            scene.nodes.push({id:target,label:`Step ${index}`,frameUrl:frame});
            scene.connections.push({...cloneWorld(scene.connections[0]),id,sourceNodeId:index===2?'end':'end-2',targetNodeId:target,forward:null,backward:null});
            scene.ledger.routes[id]={...cloneWorld(scene.ledger.routes.edge),connectionId:id};
            for(const direction of ['forward','backward']) delete scene.ledger.routes[id][direction].referenceVideo;
        }
    }
    if(query.get('backtrackSetup')) {
        scene.activeNodeId='end';scene.ledger.jobs=[];scene.ledger.generationStarted=false;scene.ledger.boardOpen=false;
        scene.nodes.push({id:'acted',label:'Drink result',frameUrl:frame});
        scene.connections.push({id:'drink',sourceNodeId:'end',targetNodeId:'acted',kind:'action',movement:{samples:[],durationMs:5000},forward:null,backward:null,status:'draft'});
        scene.ledger.routes.drink={connectionId:'drink',worldRevision:world.revision,forward:cloneWorld(animation)};
        scene.ledger.states.acted=cloneWorld(world.initialState);
    }
}
if (ready && query.get('draft')) scene.ledger.draft = { plan: cloneWorld(plan), samples: [], kind:'movement', prompt:'@youngGirl walks', hold:false, sourceNodeId:'root' };
if (ready && query.get('checkpointSetup')) {
    for(const [id,x] of [['cup',1],['after',2],['drank',1]] as const){
        const state=cloneWorld(world.initialState);state.objects.girl.transform.position[0]=x;
        scene.nodes.push({id,label:id,frameUrl:frame});scene.ledger.states[id]=state;
    }
    for(const [id,source,target,kind] of [['approach','root','cup','movement'],['continue','cup','after','movement'],['drink','cup','drank','action']]){
        const sourceState=scene.ledger.states[source],endState=scene.ledger.states[target],motion=cloneWorld(plan);motion.duration=2;
        motion.objects[0].keys=[{...cloneWorld(sourceState.objects.girl.transform),t:0},{...cloneWorld(endState.objects.girl.transform),t:2}];
        motion.camera=motion.camera.map((key:any)=>({...key,t:key.t*2/5}));
        const animation={id,prompt:kind==='action'?'Pick up cup.':'Follow motion.',plan:motion,sourceState,endState,stateChanges:{},model:'luna',createdAt:1,referenceVideo:'/fixture/three.mp4',startAnchor:frame,endAnchor:frame};
        scene.connections.push({id,sourceNodeId:source,targetNodeId:target,kind,movement:{samples:[{x:0,y:1,radius:1,angle:0,elapsedMs:500}],durationMs:500},forward:null,backward:null,status:'draft'});
        scene.ledger.routes[id]={connectionId:id,worldRevision:world.revision,forward:animation,...(kind==='movement'?{backward:{...cloneWorld(animation),sourceState:endState,endState:sourceState,plan:{...cloneWorld(motion),objects:[{...cloneWorld(motion.objects[0]),keys:[{...cloneWorld(endState.objects.girl.transform),t:0},{...cloneWorld(sourceState.objects.girl.transform),t:2}]}]}}}:{})};
    }
}
if (ready && query.get('actionOrigin')) {
    const beside=cloneWorld(world.initialState);
    beside.objects.girl.transform.position=[3,.5,-2];
    beside.camera.position=[6,3,3]; beside.camera.target=[3,.5,-2];
    scene.nodes.push({id:'beside',label:'Beside cup',frameUrl:frame});
    scene.connections.push({id:'approach',sourceNodeId:'root',targetNodeId:'beside',kind:'movement',movement:{samples:[],durationMs:5000},forward:null,backward:null,status:'draft'});
    const animation={id:'approach',prompt:'Move to the cup.',plan:cloneWorld(plan),sourceState:cloneWorld(world.initialState),endState:beside,stateChanges:{},model:'luna',createdAt:1,referenceVideo:'/fixture/three.mp4',startAnchor:frame,endAnchor:frame};
    scene.ledger.routes.approach={connectionId:'approach',worldRevision:world.revision,forward:animation,backward:cloneWorld(animation)};
    scene.ledger.states.beside=beside;scene.activeNodeId='beside';
    if(query.get('stateContext')) {
        scene.ledger.nodeContexts = { beside: { key:'actual-cup-state', frameUrl:'https://assets.test/actual-cup.png', motionContext:{controlledSubject:'girl',controlMode:'character',primaryMotion:'Keep the cup held in the right hand.',ambientMotion:'Other subjects hold position.'} } };
        scene.nodes.find((node:any)=>node.id==='beside').frameUrl='https://assets.test/actual-cup.png';
    }
    // WebGLRenderer assigns render in its constructor, so intercept that
    // assignment to observe actual visible draws rather than background exports.
    Object.defineProperty(THREE.WebGLRenderer.prototype, 'render', { configurable: true, set(render) {
        Object.defineProperty(this, 'render', { configurable: true, writable: true, value: (scene: THREE.Scene, camera: THREE.Camera) => {
            render.call(this,scene,camera);
            if(this.domElement.closest('[aria-label="Playable 3D scene proxy"]') && document.documentElement.dataset.trackPosition==='true') scene.traverse(object => {
                if(object instanceof THREE.Group && object.children.some(child=>(child as THREE.Mesh).material?.color?.getHexString()==='506fc2')) {
                    ((window as any).__fixturePositions ||= []).push(object.getWorldPosition(new THREE.Vector3()).toArray());
                }
            });
        } });
    } });
}
if (ready && query.get('wrappedDraft')) {
    const recording=cloneWorld(plan);
    recording.objects[0].keys=[{t:0,yaw:3.05},{t:2,yaw:3.13},{t:2.1,yaw:-3.12},{t:5,yaw:-3}].map(({t,yaw})=>({t,position:[t/5,.5,0],rotation:[0,yaw,0],scale:[1,1,1]}));
    scene.ledger.draft={plan:recording,samples:[],kind:'movement',prompt:'@youngGirl walks',hold:false,sourceNodeId:'root'};
    const update=THREE.Object3D.prototype.updateMatrixWorld;
    THREE.Object3D.prototype.updateMatrixWorld=function (force) {
        if (this instanceof THREE.Group && document.documentElement.dataset.trackYaw==='true' && document.querySelector('[data-spatial-authoring]')?.textContent?.includes('Playing preview')) ((window as any).__fixtureYaw ||= []).push(this.rotation.y);
        update.call(this,force);
    };
}
let saved: any = { scene, revision: 1 };
let releasePreparation: (() => void) | undefined;
const preparationGate = query.get('preparationGate') ? new Promise<void>(resolve => { releasePreparation = resolve; }) : Promise.resolve();
(window as any).__releasePreparation = () => releasePreparation?.();
let releaseReconstruction: (() => void) | undefined;
const reconstructionGate = query.get('reconstructionGate') ? new Promise<void>(resolve => { releaseReconstruction = resolve; }) : Promise.resolve();
(window as any).__releaseReconstruction = () => releaseReconstruction?.();
let planningCalls = 0, saveAttempts = 0, finalSaveAttempts = 0, frameUploads = 0, videoUploads = 0;
const exportedDurations: number[] = [];
const operationCalls: Record<string, number> = {};
const generationCalls: Record<string, number> = {};
const fixtureJobs = (body: any) => Object.values(saved.scene.ledger.routes).filter((route: any)=>!body.routeId || route.connectionId===body.routeId).flatMap((route: any)=>(['forward','backward'] as const).filter(direction=>route[direction] && !saved.scene.ledger.jobs.some((job: any)=>job.id===`${route.connectionId}:${direction}`)).map(direction=>({id:`${route.connectionId}:${direction}`,connectionId:route.connectionId,direction,kind:'movement',status:direction==='forward'?'queued':'waiting-on-parent',dependsOn:direction==='forward'?[]:[`${route.connectionId}:forward`],model:body.options.model,options:body.options,duration:route[direction].plan.duration,pixels:spatialVideoPixels(body.options.model,body.options.resolution,route[direction].plan.duration),attempt:1})));
axios.defaults.adapter = async config => {
    if (query.get('audioRef') && config.url?.endsWith('/get_signed_url_audioStory')) return { data: { holder: [{ urlAudio: 'https://assets.test/original.mp3?fixture=audio' }] }, status: 200, statusText: 'OK', headers: {}, config };
    if (query.get('audioRef') && config.url?.endsWith('/create-lipsync-trimaudio')) return { data: { audioUrl: 'https://assets.test/action.mp3' }, status: 200, statusText: 'OK', headers: {}, config };
    if (query.get('audioRef') && config.method === 'put' && config.url?.startsWith('https://assets.test/')) return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    if (query.get('autoSave') && config.url?.includes('/get_signed_url_')) return {data:{holder:[{urlVideo:'/fixture/forward.mp4',urlHD:'/fixture/frame.jpg'}]},status:200,statusText:'OK',headers:{},config};
    if (query.get('autoSave') && config.method==='put' && config.url?.startsWith('/fixture/')) {
        if (config.url.endsWith('frame.jpg')) document.documentElement.dataset.savedFrameBytes=String((config.data as Blob).size);
        return {data:{},status:200,statusText:'OK',headers:{},config};
    }
    if (config.url?.includes('/fixture/spatial-world/plan')) {
        const body = JSON.parse(String(config.data || '{}'));
        document.documentElement.dataset.lastPlanningBody=JSON.stringify(body);
        document.documentElement.dataset.planStateContext=JSON.stringify({image:body.image,currentStateContext:body.currentStateContext});
        planningCalls++;
        document.documentElement.dataset.planningCalls = String(planningCalls);
        operationCalls[body.operation] = (operationCalls[body.operation] || 0) + 1;
        document.documentElement.dataset.operationCalls = JSON.stringify(operationCalls);
        if (body.operation === 'reconstruct') await reconstructionGate;
        if (query.get('planDelay')) await new Promise(resolve => setTimeout(resolve, 1200));
        if (body.operation === 'reconstruct' && query.get('failRebuild')) throw new Error('Fixture interrupted reconstruction.');
        if (body.operation === 'return' && query.get('failReturn') && operationCalls.return === 1) throw new Error('Fixture interrupted return planning.');
        let animationPlan=cloneWorld(query.get('workflow') && body.recorded ? body.recorded : plan); animationPlan.duration=body.duration || 5;
        if(query.get('workflow') && body.operation==='return') {
            for(const object of animationPlan.objects)for(const keys of [object.keys,...(object.parts || []).map((part:any)=>part.keys)])keys.reverse().forEach((key:any)=>key.t=animationPlan.duration-key.t);
            animationPlan.camera.reverse().forEach((key:any)=>key.t=animationPlan.duration-key.t);
        }
        animationPlan.objects.forEach((object: any)=>object.keys.forEach((key: any)=>key.t=key.t/5*animationPlan.duration));
        animationPlan.camera.forEach((key: any)=>key.t=key.t/5*animationPlan.duration);
        document.documentElement.dataset.plannedDuration=String(animationPlan.duration);
        const sourceState=query.get('workflow') || query.get('actionOrigin') ? body.sourceState : world.initialState;
        if(query.get('actionOrigin') && body.operation==='action') animationPlan=prepareSpatialMotion(animationPlan,body.world,sourceState,body.recorded,body.operation,undefined,body.duration).plan;
        const animation = { id:body.operation, prompt:body.prompt, references:body.references, plan:animationPlan, sourceState, endState:query.get('workflow')||query.get('actionOrigin')?stateAtEnd(animationPlan,sourceState):world.initialState, stateChanges:{}, model:'luna', createdAt:1, ...(query.get('notices') ? {reviewNotes:['The AI changed the proxy geometry. Preview it before saving; you can revise the instructions and try again.','A second motion notice.']} : {}), ...(query.get('exportReady') ? {referenceVideo:'https://assets.test/motion.mp4',startAnchor:'https://assets.test/start.png',endAnchor:'https://assets.test/end.png'} : {}) };
        return { data: body.operation === 'identify' ? {subjects:[{name:'girl',description:'Foreground girl'}]} : body.operation === 'reconstruct' ? { world: prepareSpatialReconstruction(cloneWorld(world), {...world, revision:'rebuilt', references:body.references.map((ref: any)=>({...ref,imageUrl:`https://assets.test/${encodeURIComponent(ref.name)}.png`})), drivenName:body.drivenName, primarySubjectName:body.primarySubjectName}) } : { animatic:animation }, status: 200, statusText: 'OK', headers: {}, config };
    }
    if (!config.url?.includes('/fixture/spatial-world/document')) throw new Error('Only local document operations are allowed.');
    const body = JSON.parse(String(config.data || '{}'));
    generationCalls[body.action]=(generationCalls[body.action]||0)+1;document.documentElement.dataset.generationCalls=JSON.stringify(generationCalls);
    if (body.action !== 'read') document.documentElement.dataset.documentWrites=String(Number(document.documentElement.dataset.documentWrites || 0)+1);
    if (body.action === 'save') {
        saveAttempts++;
        if(query.get('networkFail') && saveAttempts===1) throw new Error('read ECONNRESET');
        if (query.get('failSave') && saveAttempts === 1) throw new Error('Fixture interrupted document save.');
        if (body.scene.connections.length && query.get('failFinalSave') && ++finalSaveAttempts === 1) throw new Error('Fixture interrupted final motion save.');
        saved = { scene: body.scene, revision: saved.revision + 1 };
        document.documentElement.dataset.savedRoutes = String(Object.keys(body.scene.ledger.routes).length);
        document.documentElement.dataset.savedScene = JSON.stringify(body.scene);
    }
    else if (body.action === 'view') { Object.assign(saved.scene.ledger, body.boardOpen !== undefined ? { boardOpen: body.boardOpen } : {}, body.view ? { view: body.view } : {}); if(body.activeNodeId)saved.scene.activeNodeId=body.activeNodeId; }
    else if (body.action === 'prepare-guidance') {
        // The server/compiler is covered separately; this fixture verifies that
        // real browser captures reach authoring and are retained before Save.
        const directions = body.direction ? [body.direction] : ['forward','backward'];
        const animations = body.draft ? directions.map(direction => saved.scene.ledger.draft?.[direction])
            : Object.values(saved.scene.ledger.routes).filter((route:any) => !body.routeId || route.connectionId === body.routeId).flatMap((route:any) => directions.map(direction => route[direction]));
        for (const animation of animations.filter(Boolean)) {
            const returning = body.direction === 'backward' || animation === saved.scene.ledger.draft?.backward;
            animation.guidance = { key:'fixture-'+animation.id, instruction:returning ? 'The girl turns and walks back to her starting position over 5 seconds. Camera locked.' : 'The girl walks along the recorded route and stops at its destination over 5 seconds. Camera locked.', interpretation:{startRelation:'at the start',route:'along the recorded route',endRelation:'at the destination',controlledMovement:'The girl walks along the recorded route over 5 seconds.',secondaryMotion:'',spatialPlan:{}},motionContext:{controlledSubject:'girl',controlMode:'character',primaryMotion:'Walk',ambientMotion:'Hold positions'} };
        }
        saved.revision++;
    }
    else if (body.action === 'quote') {document.documentElement.dataset.quoteRoute=body.routeId || 'all';const jobs=fixtureJobs(body); return {data:{...cloneWorld(saved),quote:{key:'fixture',pixels:jobs.reduce((total:number,job:any)=>total+job.pixels,0),jobs}},status:200,statusText:'OK',headers:{},config};}
    else if (body.action === 'start' && query.get('enableStart')) {
        const jobs=fixtureJobs(body);jobs[0].status='queued';saved.scene.ledger.jobs.push(...jobs);saved.scene.ledger.generationStarted=true;saved.scene.ledger.boardOpen=true;saved.revision++;
    }
    else if (body.action === 'complete' && (query.get('autoSave') || query.get('audioToggle'))) {
        const job=saved.scene.ledger.jobs.find((job:any)=>job.id===body.jobId);job.status='ready';job.actualEndFrame=body.endFrame;saved.revision++;
        if(query.get('audioToggle'))saved.scene.ledger.jobs.find((job:any)=>job.direction==='backward').status='queued';
    }
    else if (query.get('board') && body.action === 'edit-prompt') { const target=body.jobId ? saved.scene.ledger.jobs.find((job:any)=>job.id===body.jobId) : saved.scene.ledger.routes[body.routeId][body.direction]; target.prompt=body.prompt; target.promptVersion=2; saved.revision++; }
    else if (body.action === 'save-reference') {
        const route = saved.scene.ledger.routes[body.routeId], animation = route[body.direction], priorEnd = animation.endAnchor;
        for (const field of ['referenceVideo','startAnchor','endAnchor','motionEvidence']) if (body[field] !== undefined) animation[field] = body[field];
        if (body.referenceVideo !== undefined) animation.referencePlanKey = body.planKey;
        if (body.direction === 'forward' && body.endAnchor !== undefined) {
            const edge = saved.scene.connections.find((item:any) => item.id === body.routeId), node = saved.scene.nodes.find((item:any) => item.id === edge?.targetNodeId);
            if (node && (node.frameUrl === priorEnd || !priorEnd && node.frameUrl === animation.startAnchor)) node.frameUrl = body.endAnchor;
            if (route.backward && (!route.backward.startAnchor || route.backward.startAnchor === priorEnd)) route.backward.startAnchor = body.endAnchor;
        }
        saved.revision++;
    }
    else if (body.action === 'delete') {
        if (body.confirmation !== 'DELETE') throw new Error('Type DELETE first.');
        saved.scene.ledger.jobs = []; saved.scene.ledger.generationStarted = false; saved.scene.ledger.epoch++;
        for (const edge of saved.scene.connections) { edge.forward = null; edge.backward = null; edge.status = 'draft'; }
        saved.revision++;
    }
    else if (query.get('board') && body.action === 'retry') {
        const job=saved.scene.ledger.jobs.find((job:any)=>job.id===body.jobId); if(job.status!=='failed')throw new Error('Only failed fixture jobs may retry');
        if(body.options){job.options=body.options;job.model=body.options.model;job.pixels=body.pixels;document.documentElement.dataset.retrySettings=JSON.stringify(body.options);}
        job.status='queued'; delete job.error; saved.revision++; document.documentElement.dataset.retriedJob=job.id;
    }
    else if (query.get('board') && body.action === 'tick') { const job=saved.scene.ledger.jobs.find((job:any)=>job.id===body.jobId); if(!query.get('enableStart')) { job.status='failed'; job.error='Fixture stops here; no paid generation was made.'; saved.revision++; } else if(job.status==='queued'){
        if(query.get('audioToggle')) {
            const audio=JSON.parse(document.documentElement.dataset.submittedAudio || '{}');audio[job.direction]=job.options.audio;document.documentElement.dataset.submittedAudio=JSON.stringify(audio);
        }
        job.status='generating';saved.revision++;
    } }
    else if (body.action !== 'read') throw new Error('Generation is disabled in this test.');
    document.documentElement.dataset.savedScene=JSON.stringify(saved.scene);
    return { data: cloneWorld(saved), status: 200, statusText: 'OK', headers: {}, config };
};
const store = configureStore({ reducer: (state = { settings: { appColorDark: '#c5d83e', appColorLight: '#4059cc', spatialControlMode: 'dpad', spatialViewerHoverActive: false }, profile: { loggedUser: { id: 1 } } }) => state });
function Host() {
    const [current, setCurrent] = useState(query.get('staleProps') ? { ...cloneWorld(scene), connections: [], ledger: { ...cloneWorld(scene.ledger), routes: {}, jobs: [], boardOpen: false } } : scene);
    const [editorKey, setEditorKey] = useState(0);
    const [event, setEvent] = useState('none');
    const [model,setModel]=useState('Proxxx'),[resolution,setResolution]=useState('480p'),[videoMode,setVideoMode]=useState(false);
    const [audioEnabled,setAudioEnabled]=useState(query.get('audioOn')==='1');
    const actionSubmitRef = useRef<(() => Promise<void>) | null>(null);
    const reject = async () => { throw new Error('No upload in local test'); };
    const uploadFrame = async (blob: Blob) => {
        frameUploads++; document.documentElement.dataset.frameUploads=String(frameUploads);
        await preparationGate;
        const data = await new Promise<string>((resolve,reject)=>{ const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob); });
        ((window as any).__fixtureFrameCaptures ||= []).push(data);
        return frame;
    };
    const uploadVideo = async (blob: Blob) => {
        videoUploads++; document.documentElement.dataset.videoUploads=String(videoUploads);
        exportedDurations.push(await readMotionExportDuration(blob,new AbortController().signal));
        document.documentElement.dataset.exportedDurations=JSON.stringify(exportedDurations);
        if (query.get('failVideoReturn') && videoUploads===2) throw new Error('Fixture interrupted return video upload.');
        return `https://assets.test/local-export-${videoUploads}.mp4`;
    };
    const assets = query.get('noAssets') ? [] : Array.from({ length: 7 }, (_, i) => ({ name: i ? `Prop ${i}` : 'youngGirl', imageUrl: frame }));
    const priorWorld=query.get('continuity') ? {...cloneWorld(world),drivenName:'Raider',references:[{name:'Raider',imageUrl:'https://assets.test/raider.png'},{name:'Hover bike',imageUrl:'https://assets.test/bike.png'}]} : undefined;
    const stages=query.get('continuity') ? [{id:'prior',label:'Prior scene',address:{sceneId:'prior'},contexts:[],scene:{sceneId:'prior',nodes:[{id:'root',actionLink:{sceneId:current.sceneId,nodeId:'root'}}],ledger:{world:priorWorld,states:{root:priorWorld!.initialState}}}},{id:current.sceneId,label:'Current scene',address:{sceneId:current.sceneId},contexts:[],scene:current}] as any : query.get('links') ? [{id:current.sceneId,label:'Scene 1',address:{sceneId:current.sceneId},contexts:[],scene:current},{id:'second',label:'Scene 2',address:{sceneId:'second'},contexts:[],scene:{sceneId:'second',activeNodeId:'second-root',nodes:[{id:'second-root',label:'Start',frameUrl:frame}],connections:[],draftMovement:null}}] : [];
    return <Provider store={store}><main data-test-media onWheel={() => setEvent('carousel-wheel')} onTouchMove={() => setEvent('carousel-touch')} onMouseMove={e => { if (e.buttons === 1) setEvent('carousel-drag'); }} style={{ width: Number(query.get('w') || 390), height: Number(query.get('h') || 600), position: 'relative', overflow: 'hidden', background: '#304440', borderRadius: 22, fontFamily: 'Arial' }}>
        <style>{'[data-test-media]:has([data-spatial-generation-open="true"]) [data-spatial-media-overlay]{visibility:hidden;pointer-events:none}'}</style>
        <button aria-label="Expand original media" onClick={() => setEvent('expand')} style={{ position: 'absolute', inset: 0, width: '100%', background: 'transparent', border: 0 }} />
        {['left', 'right'].map(side => <button key={side} aria-label={`Original ${side} scene`} onClick={() => setEvent(side)} style={{ position: 'absolute', [side]: 0, top: 0, bottom: 0, width: 16, opacity: 0, zIndex: 20 }} />)}
        {query.get('board') && <>
            <div data-fixture-pixels data-spatial-media-overlay style={{position:'absolute',top:16,left:20,zIndex:30000,padding:'12px 18px',borderRadius:999,background:'#181818',color:'white'}}>4,920 P</div>
            <img data-fixture-scene-circle data-spatial-media-overlay src={frame} alt="Scene context" style={{position:'absolute',top:Number(query.get('w'))<500?70:16,right:12,width:Number(query.get('w'))<500?60:80,height:Number(query.get('w'))<500?60:80,zIndex:30000,borderRadius:'50%',border:'2px solid #888'}} />
        </>}
        <SpatialStudio key={editorKey} allowAudioReferences={!query.get('imageMode')} scene={current} stages={stages} postId={-100} api="/fixture" appColor={query.get('light') ? '#4059cc' : '#c5d83e'} oppositeAppColor={query.get('light') ? '#c5d83e' : '#4059cc'} darkMode={!query.get('light')} references={assets} activeReferenceNames={['youngGirl']} prompt="@youngGirl walks" duration={Number(query.get('duration') || 5)} actionSubmitRef={actionSubmitRef} model={model} resolution={resolution} onModelChange={setModel} onResolutionChange={setResolution} onVideoGenerationModeChange={setVideoMode} aspect="9:16" audio={audioEnabled} update={updater => setCurrent(updater)} navigate={() => false} uploadVideo={query.get('autoSave') ? async()=>'/fixture/forward.mp4' : query.get('localUploads') ? uploadVideo : reject} uploadFrame={query.get('autoSave') ? async()=>frame : uploadFrame} extractEnd={query.get('autoSave') ? async()=>frame : reject} dispatch={store.dispatch} />
        {query.get('remount') && <button aria-label="Reopen fixture editor" onClick={()=>{ spatialSession('/fixture', -100, scene.sceneId).authoring.inputs = {}; setEditorKey(value=>value+1); }} style={{position:'fixed',bottom:0,right:0,zIndex:40000}}>Reopen</button>}
        {query.get('audioToggle') && <button aria-label="Fixture audio toggle" aria-pressed={audioEnabled} onClick={()=>setAudioEnabled(value=>!value)} style={{position:'fixed',bottom:0,left:0,zIndex:40000}}>Audio {audioEnabled?'on':'off'}</button>}
    </main><output data-test-event>{event}</output>{query.get('actionHost') && <button onClick={() => void actionSubmitRef.current?.()}>Generate action reference</button>}{query.get('modelHost') && videoMode && <div role="group" aria-label="Spatial video models">{['Proxxx','SeedanceMini','Minix','Pro','pPro'].map(value=><button key={value} aria-pressed={model===value} onClick={()=>setModel(value)}>{value}</button>)}</div>}</Provider>;
}
if (query.get('backgroundOnly')) {
    createRoot(document.getElementById('root')!).render(<div>Project reopened; no scene editor mounted.</div>);
    void spatialOperation(spatialSession('/fixture', -100, scene.sceneId), 'read');
} else createRoot(document.getElementById('root')!).render(<Host />);
