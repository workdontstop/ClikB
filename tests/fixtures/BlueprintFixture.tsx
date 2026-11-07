import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { legacy_createStore } from 'redux';
import Plan from '../../src/Plan';

const params=new URLSearchParams(location.search);
const initial={profile:{loggedUser:{id:42}},settings:{darkMode:params.get('theme')==='dark',appColorDark:'#c5d83e',appColorLight:'#2670ba'}};
const store=legacy_createStore((state=initial,action:any)=>action.type==='fixture/theme'?{...state,settings:{...state.settings,darkMode:action.dark}}:state);
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#dceafb"/><circle cx="320" cy="130" r="45" fill="#487aaf"/><path d="M240 300Q240 175 320 175Q400 175 400 300Z" fill="#6a92bb"/></svg>');
const prompt=Array.from({length:12},(_,i)=>`Master prompt line ${i+1}: the crew rehearses the whole scene with clear camera direction.`).join('\n');
const videoPrompts=Object.fromEntries(Array.from({length:8},(_,i)=>[`A:${i}`,`UNIQUE ${i%2?'B':'A'}${Math.floor(i/2)+1} VIDEO PROMPT — camera follows this exact native slot.`]));
const item:any={id:901,sender:42,mode:1,prompt,caption:prompt,item1:image,kontext:JSON.stringify({
 type:'clik-plan-media',version:1,
 characters:[{url:image,kind:'image',role:'character',name:'Pilot',label:'Pilot',description:'Canonical clean character reference.'}],
 referenceVideos:[{url:'/fixture-ref.mp4',kind:'video',role:'reference_video',label:'Scene 3 reference',scene:3}],
 motionVideos:[{url:'/fixture-motion.mp4',kind:'video',role:'motion_video',label:'Scene 3 B-shot motion',scene:3,bIndex:0}],videoPrompts,
})};
for(let n=1;n<=4;n++)Object.assign(item,{[`x${n}`]:image,[`x${n}B`]:image,[`xt${n}`]:`Shot A${n} narration.`,[`xt${n}B`]:`Shot B${n} narration.`,[`gent${n}`]:`Shot A${n} image prompt.`,[`gent${n}B`]:`Shot B${n} image prompt.`,[`xa${n}`]:'/fixture-audio.mp3',[`xa${n}B`]:'/fixture-audio.mp3'});

function Fixture(){
 const [open,setOpen]=useState(true),[parentWheels,setParentWheels]=useState(0);
 (window as any).__blueprintFixture={theme:(dark:boolean)=>store.dispatch({type:'fixture/theme',dark}),parentWheels:()=>parentWheels,reopen:()=>setOpen(true)};
 return <Provider store={store}><div onWheel={()=>setParentWheels(n=>n+1)} data-fixture-parent>
  <div style={{height:2400,background:'#718096'}}>Underlying fullscreen feed — must remain still</div>
  {open&&<Plan feeds={[item]} verticalActiveIndex={0} setShowDel={()=>{}} isMenuOpen={false} setZoom2x={setOpen} ty={1}/>} 
 </div></Provider>;
}
document.body.style.margin='0';
document.body.style.fontFamily='Arial, sans-serif';
createRoot(document.getElementById('root')!).render(<Fixture/>);
