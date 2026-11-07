const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');const {pathToFileURL}=require('node:url');
const {chromium}=require(path.resolve('.tmp/concierge-browser-deps/node_modules/playwright'));
const root=process.cwd();
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const mock=compile(`
import React from 'react';
const noop=()=>{};const state={status:'idle',captureAvailable:true,inputPending:false,inputReceipt:null,guideEnabled:true,guidePanelState:'normal',guidePlayMode:false};const listeners=new Set();
const update=patch=>{Object.assign(state,patch);listeners.forEach(f=>f());};
window.voiceTest={calls:[],stops:0,update};
const voice={captureAvailable:true,inputReceipt:null,error:null,level:0,start:async()=>update({status:'listening'}),stop:()=>{window.voiceTest.stops++;update({status:'idle'});},askText:async text=>{window.voiceTest.calls.push(['voice',text]);update({status:'thinking'});await new Promise(r=>setTimeout(r,80));update({status:'speaking'});return 'A spoken answer';},speakText:noop,stopSpeech:noop};
const session={voice,chatHistory:[],textAsk:async text=>window.voiceTest.calls.push(['text',text]),setGuideEnabled:v=>update({guideEnabled:v}),setGuidePanelState:v=>update({guidePanelState:v}),setGuidePlayMode:v=>update({guidePlayMode:v}),hasGuideUseTarget:false,appendGuideTextToTarget:noop,isGuideInlineHostActive:false,registerGuideInlineHost:()=>noop};
export function useBrainstormSession(){const [,render]=React.useReducer(n=>n+1,0);React.useEffect(()=>{listeners.add(render);return()=>listeners.delete(render);},[]);return {...session,...state,voice:{...voice,status:state.status,captureAvailable:state.captureAvailable,inputPending:state.inputPending,inputReceipt:state.inputReceipt}};}
`);
const fixture=compile(`import React from 'react';import {createRoot} from 'react-dom/client';import {Provider} from 'react-redux';import {configureStore} from '@reduxjs/toolkit';import {GlobalBrainstormGuide} from '/src/components/GlobalBrainstormGuide.tsx';
const state={settings:{darkMode:true,appColorDark:'#a983ff',appColorLight:'#6633bb',conciergeResponseExpanded:false},brainstorm:{isChatOpen:false,automaticGuide:{calls:{}},userSnapshot:{creation:{stage:'feed_browsing'},navigation:{areas:{}}}}};
const store=configureStore({reducer:(s=state,a)=>s});createRoot(document.getElementById('root')).render(<Provider store={store}><GlobalBrainstormGuide /></Provider>);`);
(async()=>{
const {createServer}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')));
const server=await createServer({root,configFile:false,logLevel:'error',cacheDir:path.join(root,'node_modules/.tmp/voice-ui-vite'),optimizeDeps:{noDiscovery:true,entries:[],include:['react','react/jsx-runtime','react/jsx-dev-runtime','react-dom/client','react-redux','@reduxjs/toolkit','@mui/material','@emotion/react','@emotion/styled','prop-types','react-is',...['CloseRounded','EditRounded','MicRounded','PauseRounded','PlayArrowRounded','PowerSettingsNewRounded','SendRounded','KeyboardArrowDownRounded','KeyboardArrowUpRounded'].map(n=>'@mui/icons-material/'+n)]},server:{host:'127.0.0.1',port:5217,strictPort:true,hmr:false},plugins:[{name:'voice-ui-fixture',enforce:'pre',resolveId(id,importer){if(id==='/fixture.js')return '\0fixture';if(importer?.includes('GlobalBrainstormGuide')&&id==='./BrainstormSessionProvider')return '\0session';if(importer?.includes('GlobalBrainstormGuide')&&/AutoControl(RevealButton|Pill)$/.test(id))return '\0empty';},load(id){if(id==='\0fixture')return fixture;if(id==='\0session')return mock;if(id==='\0empty')return 'export default ()=>null;';},configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url.startsWith('/__test')){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#26232f;height:100vh}*,*::before,*::after{animation:none!important;transition:none!important}</style><div id="root"></div><script type="module" src="/fixture.js"></script>');}else next();});}}]});
let browser;try{await server.listen();console.log('Fixture listening');browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'});
console.log('Browser launched');for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
 const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Page error:',e.message);});
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto('http://127.0.0.1:5217/__test',{waitUntil:'domcontentloaded',timeout:30000});console.log('Page loaded',viewport.width);page.on('console',m=>{if(m.type()==='error')console.error(m.text());});await page.getByRole('button',{name:'Speak with Guide',exact:true}).click();
 const pencil=page.getByRole('button',{name:'Type a message in voice mode'});await pencil.waitFor();
 const stopped=await page.evaluate(()=>window.voiceTest.stops);await pencil.click();
 const input=page.getByRole('textbox',{name:'Message to Guide'});await input.waitFor();assert.equal(await input.evaluate(e=>document.activeElement===e),true);
 assert.equal(await page.getByRole('status').textContent(),'Listening');
 await page.evaluate(()=>window.voiceTest.update({status:'thinking',inputPending:true,inputReceipt:{turnId:1,text:'Accepted turn'}}));
 assert.match(await page.getByRole('status').textContent(),/Listening.*Received.*thinking/);
 await page.evaluate(()=>window.voiceTest.update({captureAvailable:false}));assert.match(await page.getByRole('status').textContent(),/Microphone off.*Received/);
 await page.evaluate(()=>window.voiceTest.update({status:'listening',captureAvailable:true,inputPending:false,inputReceipt:null}));

 const box=await page.getByRole('dialog').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=viewport.width,'input stays within viewport');
 await input.fill('Tell me about this screen');await input.press('Shift+Enter');assert.match(await input.inputValue(),/\n/);
 fs.mkdirSync('.tmp/voice-restoration',{recursive:true});await page.screenshot({path:'.tmp/voice-restoration/input-'+viewport.width+'.png'});
 await input.press('Enter');await pencil.waitFor();await page.waitForFunction(()=>window.voiceTest.calls.length===1);
 assert.deepEqual(await page.evaluate(()=>window.voiceTest.calls),[['voice','Tell me about this screen']]);assert.equal(await page.evaluate(()=>window.voiceTest.stops),stopped,'typing and submitting keeps voice active');
 await page.waitForFunction(()=>document.querySelector('[aria-label*="Guide is speaking"]'));
 await pencil.click();await input.fill('Keep this draft');await input.press('Escape');await pencil.waitFor();await pencil.click();assert.equal(await input.inputValue(),'Keep this draft');await page.getByRole('button',{name:'Close Guide input'}).click();await pencil.waitFor();
 await page.screenshot({path:'.tmp/voice-restoration/pill-'+viewport.width+'.png'});assert.deepEqual(errors,[]);await page.close();
 console.log('PASS voice input, status, keyboard, spoken routing, no mic restart, and viewport '+viewport.width);
}
}finally{await browser?.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
