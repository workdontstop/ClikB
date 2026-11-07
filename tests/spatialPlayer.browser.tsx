import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import SpatialExperiencePlayer from '/src/SpatialExperiencePlayer.tsx';
import spatialLabelsReducer from '/src/spatialLabelsSlice.ts';
const frame = (label:string) => {
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#182a3b';ctx.fillRect(0,0,320,180);ctx.fillStyle='#fff';ctx.font='24px sans-serif';ctx.fillText(label,20,80);return canvas.toDataURL();
};
const node=(id:string)=>({id,label:id,frameUrl:frame(id),createdAt:1});
const edge=(id:string,source:string,target:string,kind='movement',hasReturn=true)=>({id,sourceNodeId:source,targetNodeId:target,kind,
  movement:{id:id+'-draft',sourceNodeId:source,createdAt:1,durationMs:1000,samples:[{x:1,y:0,radius:1,angle:0,elapsedMs:1000}]},
  forward:{videoUrl:'/sample.mp4?'+id,durationMs:5000,provider:'api'},backward:kind==='action'||!hasReturn?null:{videoUrl:'/sample.mp4?'+id+'-return',durationMs:5000,provider:'api'},status:'ready'});
const initial:any={version:1,entry:{stageId:'A',nodeId:'root'},stages:[
 {id:'A',label:'Scene A',address:{sceneId:'A'},contexts:[],scene:{sceneId:'A',activeNodeId:'root',draftMovement:null,nodes:[node('root'),node('moved'),node('acted'),{...node('door'),actionLink:{sceneId:'A',bShotIndex:0,bShotIdentity:'b1'}}],connections:[edge('move','root','moved'),edge('act','moved','acted','action'),edge('after-action','acted','door','movement',false)]}},
 {id:'A:b:0:b1',label:'B-shot',address:{sceneId:'A',bShotIndex:0,bShotIdentity:'b1'},contexts:[],scene:{sceneId:'A:b:0:b1',activeNodeId:'inside',draftMovement:null,nodes:[node('inside'),node('room')],connections:[edge('interior','inside','room')]}}
]};
if(new URLSearchParams(location.search).has('frameRecovery')) initial.stages[0].scene.nodes[0].frameUrl = '/recover-'+new URLSearchParams(location.search).get('frameRecovery')+'.svg';
if(new URLSearchParams(location.search).has('optional')) {
 initial.stages[0].scene.nodes.push({...node('skip-door'),actionLink:{sceneId:'A',bShotIndex:0,bShotIdentity:'b1'}});
 initial.stages[0].scene.connections.push(edge('skip','moved','skip-door'));
}
if(new URLSearchParams(location.search).has('backtrack')) {
 initial.stages[0].scene.connections=initial.stages[0].scene.connections.filter((item:any)=>item.id!=='after-action');
 initial.stages[0].scene.nodes.find((item:any)=>item.id==='acted').actionBacktrack={targetNodeId:'moved'};
}
if (new URLSearchParams(location.search).has('sharedFrames')) {
 initial.stages[0].scene.nodes.find((item:any)=>item.id==='acted').frameUrl = initial.stages[0].scene.nodes.find((item:any)=>item.id==='moved').frameUrl;
}
if(new URLSearchParams(location.search).has('actionLink')) {
 initial.stages[0].scene.nodes.push({...node('acted-2'),actionLink:{sceneId:'A',bShotIndex:0,bShotIdentity:'b1'}});
 initial.stages[0].scene.connections=initial.stages[0].scene.connections.filter((item:any)=>item.id!=='after-action');
 initial.stages[0].scene.connections.push(edge('act-2','acted','acted-2','action'));
}
if(new URLSearchParams(location.search).has('thirdAction')) {
 const previous=initial.stages[0].scene.nodes.find((item:any)=>item.id==='acted-2');
 delete previous.actionLink;
 initial.stages[0].scene.nodes.push({...node('acted-3'),actionLink:{sceneId:'A',bShotIndex:0,bShotIdentity:'b1'}});
 initial.stages[0].scene.connections.push(edge('act-3','acted-2','acted-3','action'));
}
if(new URLSearchParams(location.search).has('holdAction')) {
 for(const connection of initial.stages[0].scene.connections)if(connection.kind==='action')connection.actionPlayback='hold';
}
if(new URLSearchParams(location.search).has('savedLabel')) initial.actionLabels={A:{act:'Strike'}};
if (new URLSearchParams(location.search).has('world')) {
 const plan:any={version:1,duration:5,background:'#182a3b',objects:[{id:'car',shape:'box',color:'#ffffff',keys:[0,5].map(t=>({t,position:[0,.5,0],rotation:[0,0,0],scale:[1,1,1]}))}],camera:[0,5].map(t=>({t,position:[0,2,6],target:[0,.5,0],fov:45}))};
 initial.stages[0].scene.ledger={world:{plan,aspectRatio:'16:9',initialState:{objects:{car:{transform:plan.objects[0].keys[0],facts:{}}},camera:plan.camera[0]},sourceImage:initial.stages[0].scene.nodes[0].frameUrl},routes:{},jobs:[],states:{},view:'video'};
}
if(new URLSearchParams(location.search).has('three')) {
 const plan=initial.stages[0].scene.ledger.world.plan;
 for(const stage of initial.stages){const world={plan,aspectRatio:'16:9',initialState:{objects:{car:{transform:plan.objects[0].keys[0],facts:{}}},camera:plan.camera[0]},sourceImage:stage.scene.nodes[0].frameUrl};
  stage.scene.ledger={world,jobs:[],states:{},view:'three',routes:Object.fromEntries(stage.scene.connections.map((connection:any)=>[connection.id,{forward:{id:connection.id+'-forward',plan,startAnchor:stage.scene.nodes[0].frameUrl,endAnchor:stage.scene.nodes.find((n:any)=>n.id===connection.targetNodeId).frameUrl},backward:connection.kind==='action'?undefined:{id:connection.id+'-backward',plan}}]))};
 }
}
if (new URLSearchParams(location.search).has('twoOrigins')) {
 initial.stages.push({id:'C',label:'Other room',address:{sceneId:'C'},contexts:[],scene:{sceneId:'C',activeNodeId:'c-root',draftMovement:null,
  nodes:[node('c-root'),{...node('c-door'),actionLink:{sceneId:'A',bShotIndex:0,bShotIdentity:'b1'}}],connections:[edge('c-move','c-root','c-door')]}});
 if(new URLSearchParams(location.search).get('origin')==='C') initial.entry={stageId:'C',nodeId:'c-root'};
}
function App(){
 const mode=new URLSearchParams(location.search).get('mode')||'preview';
 const [data,setData]=useState(initial),[active,setActive]=useState('A'),[blocked,setBlocked]=useState(false),[second,setSecond]=useState(false);
 const player=useRef<any>(null),snapshot=useRef<any>(null),events=useRef<any[]>([]);
 const scene=data.stages.find((s:any)=>s.id===active).scene;
 (window as any).refreshLabels=(labels:any,revision:number)=>setData((previous:any)=>({...previous,actionLabels:labels,actionLabelsRevision:revision}));
 (window as any).test={player,snapshot,events,block:setBlocked,second:setSecond,data,frame:(url:string)=>setData((p:any)=>({...p,stages:p.stages.map((s:any)=>s.id==='A'?{...s,scene:{...s.scene,nodes:s.scene.nodes.map((n:any)=>n.id==='root'?{...n,frameUrl:url}:n)}}:s)})),external:()=>setActive('A:b:0:b1'),replace:()=>setData(previous=>({...previous,stages:previous.stages.map(stage=>({...stage}))})),edit:()=>setData((p:any)=>({...p,stages:p.stages.map((s:any)=>s.id===active?{...s,scene:{...s.scene,pendingRootFrameUrl:'keep-this-edit'}}:s)}))};
 return <><div style={{position:'relative',width:800,height:600}} data-test-primary>
 {mode!=='creation'?<SpatialExperiencePlayer ref={player} document={data} mode={mode as 'preview'|'feed'} postId={new URLSearchParams(location.search).has('labels')?42:undefined} creatorId={1} api="" appColor="#4059cc" darkMode={new URLSearchParams(location.search).get('theme')==='dark'}/>:<SpatialExperiencePlayer ref={player} mode="creation" creation={{scene,stages:data.stages,isBlocked:()=>blocked,
 // Deliberately delay the controlled update: held input must not replay the old node in this gap.
 navigate:p=>{setTimeout(()=>{setData((previous:any)=>({...previous,stages:previous.stages.map((s:any)=>s.id===p.stageId?{...s,scene:{...s.scene,activeNodeId:p.nodeId,draftMovement:null}}:s)}));setActive(p.stageId);},50);return true;},
 onPlaybackStart:()=>{},onNavigate:()=>{},onDrive:()=>{},onStateChange:s=>{snapshot.current=s;},onError:e=>events.current.push({error:e}),
 onUnmatchedDrive:s=>events.current.push({drive:s}),onUnmatchedDriveEnd:s=>events.current.push({end:s})}}/>}
 </div><div style={{display:'flex',gap:8}}>{['activate','back','home'].map(name=><button key={name} onClick={()=>player.current[name]()}>{name}</button>)}
 <button onClick={()=>player.current.jump('door')}>jump door</button><button onClick={()=>player.current.jump('acted')}>jump acted</button></div>
 {second&&<div style={{position:'absolute',left:850,top:0,width:600,height:600}} data-test-second><SpatialExperiencePlayer document={initial} mode="preview"/></div>}</>;
}
const store=configureStore({reducer:{
 settings:(state={appColorDark:'#6dd7ee',appColorLight:'#4059cc',spatialControlMode:new URLSearchParams(location.search).has('defaults')?null:new URLSearchParams(location.search).get('control')==='dpad'?'dpad':'analog',spatialViewerHoverActive:new URLSearchParams(location.search).get('control')==='hover'},action:any)=>action.type==='settings/setSpatialControlMode'?{...state,spatialControlMode:action.payload}:action.type==='settings/setSpatialViewerHoverActive'?{...state,spatialViewerHoverActive:action.payload}:state,
 profile:(state={loggedUser:new URLSearchParams(location.search).has('guest')?null:{id:new URLSearchParams(location.search).has('nonowner')?2:1}})=>state,
 spatialLabels:spatialLabelsReducer,
}});
(window as any).testStore=store;
createRoot(document.getElementById('root')!).render(<Provider store={store}><App/></Provider>);
