const assert = require('node:assert/strict');
const path = require('node:path'), fs = require('node:fs'), { pathToFileURL } = require('node:url'), ts = require('typescript');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || path.resolve(__dirname, '../.tmp/concierge-browser-deps/node_modules/playwright'));
const root = path.resolve(__dirname, '..');
const fixture = ts.transpileModule(`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {Provider} from 'react-redux';import {MemoryRouter} from 'react-router-dom';
import axios from 'axios';import {store} from '/src/store';import {setPixels,setNotepadPreviewActive,setAspectRatio} from '/src/settingsSlice';import Notepad from '/src/Notepad';
store.dispatch(setPixels(2));store.dispatch(setNotepadPreviewActive(true));
window.previewRequests=[];window.previewResolvers=[];
axios.defaults.adapter=async config=>{
 if(!config.url.endsWith('/fluxschnell'))throw new Error('Unexpected fixture request: '+config.url);
 window.previewRequests.push(JSON.parse(config.data));store.dispatch(setPixels(store.getState().settings.pixels-1));
 await new Promise(resolve=>window.previewResolvers.push(resolve));
 return {data:{imageUrl:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>')},status:200,statusText:'OK',headers:{},config};
};
const noop=()=>{};
function App(){const [open,setOpen]=useState(true),[value,setValue]=useState('A knight carrying a silver sword');
 window.previewTest={setOpen,setValue,setPixels:value=>store.dispatch(setPixels(value)),setRatio:value=>store.dispatch(setAspectRatio(value)),setPreview:value=>store.dispatch(setNotepadPreviewActive(value)),resolve:index=>window.previewResolvers[index](),state:()=>({open,value,pixels:store.getState().settings.pixels,requests:window.previewRequests})};
 return <Notepad open={open} value={value} onChange={setValue} onClose={()=>setOpen(false)} setIsNotepadOpen={setOpen} hide={false} type={0} mode={0} placeholder="Enter Video Prompt" guideContext="editstory-video-prompt" handleKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();setOpen(false);}}} GeneratedImage={[]} TextFieldactive={false} setTextFieldactive={noop} showTemplates={false} referenceImages={[]} SelectedModel="Pro"/>;
}createRoot(document.getElementById('root')).render(<React.StrictMode><Provider store={store}><MemoryRouter><App/></MemoryRouter></Provider></React.StrictMode>);
`, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const session = `const noop=()=>{};const empty=[];const session={guideEnabled:false,setGuideEnabled:noop,setGuidePanelState:noop,guidePanelState:'hidden',guidePlayMode:false,setGuidePlayMode:noop,textAsk:async()=>'',chatHistory:empty,chatHistoryRef:{current:empty},setChatHistory:noop,buildBrainstormPayload:()=>({messages:[]}),noteMemoryAfterAssistant:noop,waitForCreationMemorySync:async()=>{},registerGuideUseTarget:()=>noop,hasGuideUseTarget:false,guideUseTargetLabel:'',appendGuideTextToTarget:noop,isGuideInlineHostActive:false,registerGuideInlineHost:()=>noop,clearBrainstormSession:noop,setVoiceAskHandler:noop,voice:{status:'idle',error:null,level:0,start:async()=>{},stop:noop,askText:async()=>'',speakText:async()=>{},stopSpeech:noop}};export const useBrainstormSession=()=>session;`;
(async()=>{
 const {createServer}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')));
 const server=await createServer({root,configFile:false,logLevel:'error',cacheDir:'.tmp/preview-billing-vite',esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port:5205,strictPort:true,hmr:false},plugins:[{name:'fixture',enforce:'pre',resolveId:id=>id==='/fixture.js'?'\0preview-billing':undefined,load:id=>id==='\0preview-billing'?fixture:undefined,transform:(code,id)=>id.endsWith('/BrainstormSessionProvider.tsx')?session:undefined,configureServer:server=>{server.middlewares.use((req,res,next)=>{if(req.url.startsWith('/__test')){res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/fixture.js"></script>');}else next();});}}]});await server.listen();
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:5205/')||route.request().url().startsWith('data:')?route.continue():route.abort());
  await page.goto('http://127.0.0.1:5205/__test');const field=page.locator('textarea[data-creation-handler="handleBaseChange"]');await field.waitFor();
  await page.waitForFunction(()=>window.previewRequests.length===1);const state=()=>page.evaluate(()=>window.previewTest.state());
  await page.evaluate(()=>window.previewTest.setPixels(0));await page.waitForTimeout(300);await page.evaluate(()=>window.previewTest.setPixels(1000));await page.waitForTimeout(300);
  assert.equal((await state()).requests.length,1,'balance changes/StrictMode resubmitted a paid preview');
  await page.evaluate(()=>window.previewTest.resolve(0));await page.waitForTimeout(500);
  await page.evaluate(()=>window.previewTest.setOpen(false));await field.waitFor({state:'hidden'});await page.evaluate(()=>window.previewTest.setOpen(true));await field.waitFor();await page.waitForTimeout(400);
  assert.equal((await state()).requests.length,1,'reopening unchanged text resubmitted a preview');
  await page.evaluate(()=>window.previewTest.setRatio(2));await page.waitForFunction(()=>window.previewRequests.length===2);assert.equal((await state()).requests[1].ty,2);
  await page.evaluate(()=>window.previewTest.resolve(1));await page.waitForTimeout(300);
  await page.evaluate(()=>window.previewTest.setPreview(false));await field.fill('Preview disabled while this new draft is typed');await page.waitForTimeout(10400);
  assert.equal((await state()).requests.length,2,'disabled preview generated from new text');
  await field.press('Enter');await field.waitFor({state:'hidden'});await page.evaluate(()=>window.previewTest.setPreview(true));
  await page.evaluate(()=>window.previewTest.setValue('Editor closed with another entirely new prompt'));await page.waitForTimeout(10400);
  assert.equal((await state()).requests.length,2,'closed retained editor generated a preview: '+JSON.stringify(await state()));
  await page.evaluate(()=>window.previewTest.setOpen(true));await field.waitFor();await page.waitForFunction(()=>window.previewRequests.length===3);
  assert.equal((await state()).requests[2].inputs,'Editor closed with another entirely new prompt');await page.evaluate(()=>window.previewTest.resolve(2));
  assert.deepEqual(errors,[]);console.log('PASS real Notepad preview: StrictMode and balance changes produce one request; unchanged reopening reuses it; ratio changes once; disabling/closing prevents requests until reopened. All responses mocked locally.');
 }finally{await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
