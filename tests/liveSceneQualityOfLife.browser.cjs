const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const fixture = `
import React,{useState} from 'react'; import {createRoot} from 'react-dom/client';
import LiveSceneWorkspace from './src/components/LiveSceneWorkspace';
import SceneControlsToggle from './src/components/SceneControlsToggle';
const keys=[0,5].map(t=>({t,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}));
const plan={version:1,duration:5,background:'#edf5fc',objects:[{id:'actor',shape:'box',color:'#6686b3',keys}],camera:[0,5].map(t=>({t,position:[0,2,7],target:[0,.7,0],fov:45}))};
let state={phase:'streaming',kind:'motion',buildId:'fixture-build',plan,message:'AI is building…',pinned:[],continuationsLeft:4,segment:1};
const listeners=new Set(),calls=[];
const patch=next=>{state={...state,...next};listeners.forEach(fn=>fn());};
const client={snapshot:()=>state,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},
 canExportDraft:()=>state.kind==='motion'||state.kind==='spatial'&&['action','action-correction'].includes(state.operation),
 stop:async keep=>{calls.push(['stop',keep]);patch({phase:'paused'});},pause:async()=>{calls.push(['pause']);patch({phase:'paused'});},continue:async()=>{calls.push(['continue']);patch({phase:'streaming'});},
 applyCommands:()=>{},togglePin:()=>{},undo:()=>{},redo:()=>{},reconnect:async()=>{}};
window.fixture={patch,calls,client,plan};
function App(){const [maximized,setMaximized]=useState(false),[hidden,setHidden]=useState(false);window.fixture.presentation=setMaximized;return <div style={{position:'relative',marginTop:20,width:'min(680px,100vw)',height:maximized?'80vh':undefined}}>{maximized&&<SceneControlsToggle hidden={hidden} onToggle={()=>setHidden(value=>!value)}/>}<LiveSceneWorkspace client={client} accent='#18aa88' persistent maximized={maximized} fillContainer={maximized&&hidden} controlsHidden={hidden}/></div>;}createRoot(document.getElementById('root')).render(<App/>);
`;
(async () => {
 const result = await build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',loader:{'.css':'empty','.png':'dataurl','.svg':'dataurl'},define:{'import.meta.env':'{}','process.env.NODE_ENV':'"production"'},logLevel:'silent'});
 const css=fs.readFileSync(path.join(root,'src/components/LiveSceneWorkspace.css'),'utf8');
 const html='<style>body{margin:0}'+css+'</style><div id="root"></div><script>'+result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>';
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
  const page=await browser.newPage({viewport:{width:760,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   window.__draws=0;
   for(const api of [window.WebGLRenderingContext,window.WebGL2RenderingContext])if(api)for(const name of ['drawElements','drawArrays']){
    const original=api.prototype[name];api.prototype[name]=function(...args){window.__draws++;return original.apply(this,args);};
   }
  });
  await page.route('**/*',route=>route.request().isNavigationRequest()?route.fulfill({contentType:'text/html',body:html}):route.abort());
  await page.goto('http://fixture.test/quality-of-life',{waitUntil:'domcontentloaded'});
  const activity=page.locator('[data-live-scene-activity]');
  await activity.waitFor();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-live-scene-activity]')).animationPlayState==='running');
  const start=await activity.boundingBox();
  await page.waitForTimeout(180);
  const next=await activity.boundingBox();
  assert.equal(start.height,3);assert.equal(next.height,3);
  assert.ok(Math.abs(start.width-next.width)>1,'activity visually grows/contracts');
  assert.equal(await activity.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(24, 170, 136)');
  await page.evaluate(()=>{const plan=window.fixture.plan;window.fixture.patch({plan:{...plan,objects:[{...plan.objects[0],id:'live_workspace',shape:'anchor'}]}});});
  await page.waitForTimeout(150);
  const placeholderDraws=await page.evaluate(()=>window.__draws);
  await page.waitForTimeout(260);
  assert.equal(await page.evaluate(()=>window.__draws),placeholderDraws,'CSS activity while AI plans must not drive WebGL redraws');
  await page.evaluate(()=>window.fixture.patch({plan:window.fixture.plan}));
  await page.getByRole('button',{name:'Discard AI build',exact:true}).click();
  await page.getByRole('dialog',{name:'Discard this Three.js build?'}).waitFor();
  assert.deepEqual(await page.evaluate(()=>window.fixture.calls),[],'opening confirmation does not pause/discard');
  await page.getByRole('button',{name:'No, keep build',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>window.fixture.calls),[],'No leaves AI untouched');
  await page.getByRole('button',{name:'Discard AI build',exact:true}).click();
  await page.keyboard.press('Escape');
  assert.deepEqual(await page.evaluate(()=>window.fixture.calls),[],'Escape leaves AI untouched');
  await page.getByRole('button',{name:'Discard AI build',exact:true}).click();
  await page.getByRole('button',{name:'Yes, discard',exact:true}).click();
  await page.waitForFunction(()=>window.fixture.calls.length===1);
  assert.deepEqual(await page.evaluate(()=>window.fixture.calls),[['stop',false]]);
  assert.equal(await activity.count(),0,'paused AI has no animated bar');
  await page.evaluate(()=>window.fixture.patch({exportedVideoUrl:'https://example.test/export.mp4',exporting:true}));
  assert.equal(await page.getByRole('button',{name:'Continue AI',exact:true}).isDisabled(),true);
  assert.equal(await page.getByRole('button',{name:'Stop and export video',exact:true}).isDisabled(),true);
  assert.equal(await page.getByRole('button',{name:'Discard AI build',exact:true}).isDisabled(),true);
  await page.evaluate(()=>window.fixture.patch({exporting:false}));
  assert.equal(await page.getByRole('link',{name:'Open exported video file',exact:true}).count(),0,'small preview has no external file action');
  await page.evaluate(()=>window.fixture.presentation(true));
  assert.equal(await page.getByRole('link',{name:'Open exported video file',exact:true}).getAttribute('href'),'https://example.test/export.mp4');
  await page.getByRole('button',{name:'Stop and export video',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>window.fixture.calls),[['stop',false],['stop',true]]);
  const beforeHide=await page.evaluate(()=>{const canvas=document.querySelector('canvas');canvas.dataset.retained='yes';return JSON.stringify(window.fixture.client.snapshot());});
  await page.getByRole('button',{name:'Hide scene controls',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Show scene controls',exact:true}).isVisible(),true);
  assert.equal(await page.getByRole('button',{name:'Continue AI',exact:true}).isVisible(),false);
  assert.equal(await page.locator('canvas[data-retained="yes"]').count(),1);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.fixture.client.snapshot())),beforeHide);
  assert.deepEqual(await page.evaluate(()=>window.fixture.calls),[['stop',false],['stop',true]],'hide does not control/export the scene');
  await page.getByRole('button',{name:'Show scene controls',exact:true}).click();
  assert.equal(await page.locator('canvas[data-retained="yes"]').count(),1);
  await page.evaluate(()=>window.fixture.patch({kind:'spatial',operation:'movement'}));
  await page.getByRole('button',{name:'Stop and keep draft',exact:true}).waitFor();
  await page.evaluate(()=>window.fixture.patch({kind:'spatial',operation:'action',phase:'streaming'}));
  await page.getByRole('button',{name:'Stop and export video',exact:true}).waitFor();await activity.waitFor();
  await page.evaluate(()=>{document.body.style.height='2400px';window.scrollTo(0,1500);});
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-live-scene-activity]')).animationPlayState==='paused');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-live-scene-activity]')).animationPlayState==='running');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await activity.evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'controls/activity do not widen the mobile page');
  assert.deepEqual(errors,[]);
  console.log('PASS Three.js discard Yes/No/Escape, Stop export labels/scope, export lock/link, accent transform activity with zero planning-idle WebGL draws, offscreen suspension, reduced motion and mobile width.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
