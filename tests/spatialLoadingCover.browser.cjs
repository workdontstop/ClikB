const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, '.tmp/spatial-loading-cover');
fs.mkdirSync(output, { recursive: true });
const fixture = `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';import {store} from './src/store';
import SpatialExperiencePlayer from './src/SpatialExperiencePlayer';
const poster='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="500"><rect width="300" height="500" fill="#e85b27"/><circle cx="150" cy="210" r="90" fill="#36c76f"/></svg>');
function App(){const [mounted,setMounted]=useState(true),[frame,setFrame]=useState('/frame.svg');window.fixture={setMounted,setFrame};
const data={version:1,entry:{stageId:'A',nodeId:'root'},stages:[{id:'A',label:'Stage',address:{sceneId:'A'},contexts:[],scene:{sceneId:'A',activeNodeId:'root',draftMovement:null,nodes:[{id:'root',frameUrl:frame,label:'Root',createdAt:1}],connections:[]}}]};
return <div id="stage" style={{position:'relative',width:300,height:500}}>{mounted&&<SpatialExperiencePlayer mode="feed" document={data} poster={poster} muted={true}/>}</div>;}
createRoot(document.getElementById('root')).render(<Provider store={store}><App/></Provider>);`;
(async () => {
 const bundle = await build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',loader:{'.css':'empty','.png':'dataurl'},define:{'import.meta.env':'{}'},logLevel:'silent'});
 const css = fs.readFileSync(path.join(root,'src/mediaLoadingCover.css'),'utf8');
 const html = '<style>body{margin:0}'+css+'</style><div id="root"></div><script>'+bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>';
 const browser = await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  const page = await browser.newPage({viewport:{width:800,height:650}}), errors=[];
  page.on('pageerror', error=>errors.push(error.message));
  let release, requested;
  const started = new Promise(resolve=>requested=resolve);
  const gate = new Promise(resolve=>release=resolve);
  await page.route('**/*', async route=>{
   if(route.request().isNavigationRequest())return route.fulfill({contentType:'text/html',body:html});
   if(new URL(route.request().url()).pathname==='/frame.svg'){
    requested();await gate;
    return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="500"><rect width="300" height="500" fill="#0060f0"/></svg>'});
   }
   if(new URL(route.request().url()).pathname==='/next.svg')return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="300" height="500"><rect width="300" height="500" fill="#31bb6f"/></svg>'});
   return route.abort();
  });
  await page.goto('http://fixture.test/spatial',{waitUntil:'domcontentloaded'});await started;
  await page.waitForFunction(()=>{const cover=document.querySelector('.media-loading-cover');return cover?.complete&&cover.naturalWidth>0&&getComputedStyle(cover).filter==='grayscale(1)';});
  assert.equal(await page.locator('canvas').evaluate(canvas=>getComputedStyle(canvas).visibility),'hidden','empty WebGL canvas must not obscure the cover');
  await page.screenshot({path:path.join(output,'loading.png')});
  release();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('canvas')).visibility==='visible');
  assert.equal(await page.locator('canvas').evaluate(canvas=>getComputedStyle(canvas).filter),'none','grayscale must not reach the rendered scene');
  await page.screenshot({path:path.join(output,'ready.png')});
  await page.evaluate(()=>window.fixture.setMounted(false));await page.locator('canvas').waitFor({state:'detached'});
  await page.evaluate(()=>window.fixture.setMounted(true));
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('canvas')).visibility==='visible');
  assert.equal(await page.locator('canvas').count(),1,'cached remount owns one renderer');
  await page.evaluate(()=>window.fixture.setFrame('/next.svg'));
  assert.equal(await page.locator('canvas').evaluate(canvas=>getComputedStyle(canvas).visibility),'visible','node changes retain the previous painted surface');
  await page.waitForFunction(()=>window.__spatialDiagnostics?.entries().some(entry=>entry.event==='frame.ready'&&String(entry.details.url).includes('next.svg')));
  assert.deepEqual(errors,[]);
  console.log('PASS stalled spatial load shows grayscale cover; empty canvas stays hidden; first painted frame reveals colour; cached remount and node handoff preserve one renderer.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
