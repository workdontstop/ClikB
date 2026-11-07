/** Local-only integration host: no account, storage or generation providers. */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import axios from 'axios';
import SpatialStudio from '../src/components/SpatialStudio';
import { cloneWorld, stateAtEnd, validateWorld } from '../server/src/spatialWorld';
import { spatialVideoPixels } from '../server/src/spatialVideoSpec';
import { videoUpscalePixels } from '../server/src/videoUpscaleSpec';
const query = new URLSearchParams(location.search), board = query.has('board'), empty = query.has('empty');
const frame = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="390" height="660"><rect width="390" height="660" fill="#304440"/></svg>');
const plan: any = { version: 1, duration: 2, background: '#304440', objects: [{ id: 'girl', shape: 'box', color: '#506fc2', keys: [0, 2].map(t => ({ t, position: [0, .5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] })) }], camera: [0, 2].map(t => ({ t, position: [3, 3, 5], target: [0, .5, 0], fov: 45 })) };
const world = validateWorld({ version: 2, model: 'luna', revision: 'mvp', sourceImage: frame, aspectRatio: '9:16', plan, controlledObject: 'girl', controlMode: 'character', walkable: [{ min: [-4, 0, -4], max: [4, 2, 4] }], obstacles: [], approved: true });
const scene: any = { sceneId: 'mvp', activeNodeId: 'root', nodes: [{ id: 'root', label: 'Start', frameUrl: frame }], connections: [], draftMovement: null, ledger: { version: 2, world, states: { root: world.initialState }, routes: {}, jobs: [], epoch: 1, generationStarted: board && !empty, boardOpen: board, view: 'three' } };
const batch = { model: 'SeedanceMini', resolution: '480p', aspect: '9:16', audio: false, music: false };
if (board) {
 const movementPlan=cloneWorld(plan);movementPlan.duration=5;movementPlan.objects[0].keys[1].t=5;movementPlan.camera[1].t=5;
 const animation={id:'motion',prompt:'Walk forward.',promptVersion:2,plan:movementPlan,sourceState:world.initialState,endState:world.initialState,stateChanges:{},model:'luna',createdAt:1,referenceVideo:'/fixture/three.mp4',startAnchor:frame,endAnchor:frame};
 scene.nodes.push({id:'end',label:'Step 1',frameUrl:frame});scene.ledger.states.end=cloneWorld(world.initialState);
 scene.connections.push({id:'edge',sourceNodeId:'root',targetNodeId:'end',kind:'movement',movement:{samples:[{x:0,y:1,radius:1,angle:0,elapsedMs:0}],durationMs:5000},forward:{videoUrl:'/fixture/forward.mp4',durationMs:5000,provider:'api'},backward:{videoUrl:'/fixture/back.mp4',durationMs:5000,provider:'api'},status:'ready'});
 scene.ledger.routes.edge={connectionId:'edge',worldRevision:world.revision,forward:animation,backward:cloneWorld(animation)};
 if(!empty)scene.ledger.jobs=['forward','backward'].map(direction=>({id:`edge:${direction}`,connectionId:'edge',direction,kind:'movement',sourceNodeId:direction==='forward'?'root':'end',targetNodeId:direction==='forward'?'end':'root',dependsOn:direction==='forward'?[]:['edge:forward'],status:direction==='backward'&&query.has('retry')?'failed':'ready',prompt:animation.prompt,startAnchor:frame,endAnchor:frame,referenceVideo:animation.referenceVideo,options:{...batch,audio:direction==='backward'},model:'SeedanceMini',pixels:83,duration:5,attempt:1,...(direction==='backward'&&query.has('retry')?{error:'Rejected fixture request'}:{output:`/fixture/${direction}.mp4`,actualEndFrame:frame,continuity:'approved'})}));
 if(query.has('hd'))scene.ledger.jobs[0].upscale={status:'ready',pixels:23,resolution:'1080p',output:'/fixture/hd.mp4',original:scene.ledger.jobs[0].output,submissionToken:'first-hd'};
}
let saved:any={scene,revision:1,options:batch};
const fixture:any=(window as any).mvp={requests:[],snapshot:()=>cloneWorld(saved),failPlan:false,failSave:false,delayPlan:false};
axios.defaults.adapter=async config=>{
 const body=JSON.parse(String(config.data||'{}'));fixture.requests.push(cloneWorld(body));
 if(config.url?.endsWith('/spatial-world/plan')){
  if(fixture.delayPlan)await new Promise(resolve=>setTimeout(resolve,900));
  if(fixture.failPlan){fixture.failPlan=false;throw Error('Fixture action correction failed');}
  const action=cloneWorld(body.existingPlan||body.recorded||plan);action.duration=body.duration;
  if(body.correction)action.objects[0].keys.at(-1).rotation[2]=.3;
  const prompt=body.correction?body.prompt+' '+body.correction:body.prompt;
  return {data:{animatic:{id:'action-'+fixture.requests.length,creatorInstruction:prompt,prompt,promptVersion:2,plan:action,sourceState:cloneWorld(body.sourceState),endState:stateAtEnd(action,body.sourceState),stateChanges:{},model:body.llmTier,createdAt:Date.now()}},status:200,statusText:'OK',headers:{},config};
 }
 if(!config.url?.endsWith('/spatial-world/document'))throw Error('Only mocked spatial operations allowed');
 if(body.action==='save'){
  if(fixture.failSave){fixture.failSave=false;throw Error('Fixture action save failed');}
  saved={...saved,scene:body.scene,revision:saved.revision+1};
 }else if(body.action==='view'){
  if(body.boardOpen!==undefined)saved.scene.ledger.boardOpen=body.boardOpen;
  if(body.view)saved.scene.ledger.view=body.view;
  if(body.activeNodeId)saved.scene.activeNodeId=body.activeNodeId;
 }else if(body.action==='quote'){
  const jobs=body.jobIds?body.jobIds.map((id:string)=>saved.scene.ledger.jobs.find((job:any)=>job.id===id)).sort((a:any,b:any)=>a.direction===b.direction?0:a.direction==='forward'?-1:1)
   :['forward','backward'].map(direction=>({id:`edge:${direction}`,direction,duration:5}));
  const quoted=jobs.map((job:any)=>({...cloneWorld(job),options:body.options,model:body.options.model,pixels:spatialVideoPixels(body.options.model,body.options.resolution,job.duration)}));
  return {data:{...cloneWorld(saved),quote:{key:'mvp-quote-'+JSON.stringify(body.options),jobs:quoted,pixels:quoted.reduce((sum:number,job:any)=>sum+job.pixels,0)}},status:200,statusText:'OK',headers:{},config};
 }else if(body.action==='regenerate'||body.action==='retry'){
  for(const id of body.jobIds||[body.jobId]){const job=saved.scene.ledger.jobs.find((job:any)=>job.id===id);job.options=cloneWorld(body.options);job.model=body.options.model;job.pixels=spatialVideoPixels(job.model,body.options.resolution,job.duration);job.attempt++;job.status='ready';job.output=`/fixture/${job.direction}.mp4`;job.actualEndFrame=frame;delete job.error;}
  saved.revision++;
 }else if(body.action==='save-reference'){
  const animation=saved.scene.ledger.routes[body.routeId][body.direction];
  for(const key of ['referenceVideo','startAnchor','endAnchor','motionEvidence'])if(body[key]!==undefined)animation[key]=cloneWorld(body[key]);
  animation.referencePlanKey=body.planKey;saved.revision++;
 }else if(body.action==='prepare-guidance'){
  saved.scene.ledger.routes[body.routeId][body.direction].guidance={key:'local-fixture',instruction:'Preserve the recorded movement.',motionContext:{}};saved.revision++;
 }else if(body.action==='upscale-quote'){
  return {data:{...cloneWorld(saved),upscaleQuote:{key:'upscale-'+body.targetResolution,pixels:videoUpscalePixels(5,body.targetResolution),duration:5,resolution:body.targetResolution}},status:200,statusText:'OK',headers:{},config};
 }else if(body.action==='upscale'){
  const job=saved.scene.ledger.jobs.find((item:any)=>item.id===body.jobId);if(job.upscale)job.upscaleHistory=[...(job.upscaleHistory||[]),cloneWorld(job.upscale)];
  job.upscale={status:'generating',resolution:body.targetResolution,pixels:videoUpscalePixels(5,body.targetResolution),original:job.upscale?.output||job.output,submissionToken:'next-hd'};saved.revision++;
 }else if(body.action==='read'||body.action==='tick'||body.action==='upscale-tick'){
  // Background work never contacts an actual provider.
 }else throw Error('Unexpected fixture operation '+body.action);
 return {data:cloneWorld(saved),status:200,statusText:'OK',headers:{},config};
};
const store=configureStore({reducer:(state={settings:{appColorDark:'#c5d83e',appColorLight:'#4059cc',spatialControlMode:'dpad',spatialViewerHoverActive:false},profile:{loggedUser:{id:1}}})=>state});
function Host(){const [current,setCurrent]=useState(scene),[videoMode,setVideoMode]=useState(false),[editorKey,setEditorKey]=useState(0);return <Provider store={store}><main style={{position:'relative',width:Number(query.get('w')||390),height:Number(query.get('h')||660),background:'#111'}}>
 <SpatialStudio key={editorKey} scene={current} stages={[]} postId={-101} api="/mvp-fixture" appColor="#c5d83e" oppositeAppColor="#4059cc" darkMode references={[]} prompt="The girl waves" duration={2} model="SeedanceMini" resolution="480p" aspect="9:16" audio={false} onVideoGenerationModeChange={setVideoMode} update={updater=>setCurrent(updater)} navigate={()=>false} uploadVideo={async()=>{throw Error('No real upload');}} uploadFrame={async()=>frame} extractEnd={async()=>frame} dispatch={store.dispatch}/>
 </main><button data-fixture-duration hidden={videoMode}>Host duration</button><button onClick={()=>setEditorKey(key=>key+1)}>Reopen editor</button></Provider>}
createRoot(document.getElementById('root')!).render(<Host/>);
