const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const ts = require('typescript');
const { chromium } = require(process.env.NOTEPAD_PLAYWRIGHT || '../.tmp/notepad-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const baseline = process.env.NOTEPAD_BASELINE === '1';
const cpuRate = Number(process.env.NOTEPAD_CPU_RATE || 1);
const fixture = ts.transpileModule(`
import React,{useState,Profiler} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {store} from '/src/store';
import Notepad from '/src/Notepad';
const q=new URLSearchParams(location.search), noop=()=>{};
window.samples=[]; window.commits=[]; window.hostChanges=[]; window.enterValues=[];
document.addEventListener('input',()=>{const start=performance.now();requestAnimationFrame(()=>window.samples.push(performance.now()-start));},true);
const originalQuery=document.querySelectorAll.bind(document);window.scans=0;
document.querySelectorAll=(selector)=>{if(selector.includes('data-creation-control'))window.scans++;return originalQuery(selector);};
const refs=[{name:'Alice',imageUrl:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}];
function App(){
 const [open,setOpen]=useState(false),[value,setValue]=useState(q.get('seed')||'');
 window.currentValue=value;
 return <><button id="open" onClick={()=>setOpen(true)}>Open</button><output id="saved">{value}</output>
 <Profiler id="notepad" onRender={(id,phase,duration)=>window.commits.push(duration)}>
 <Notepad open={open} value={value} onChange={text=>{window.hostChanges.push(text);setValue(text);}}
 onClose={()=>setOpen(false)} setIsNotepadOpen={setOpen} hide={false} type={Number(q.get('type')||0)}
 mode={Number(q.get('mode')||0)} placeholder="Enter Video Prompt" guideContext="editstory-video-prompt"
 handleKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();window.enterValues.push(value);}}} GeneratedImage={[]} TextFieldactive={false}
 setTextFieldactive={noop} showTemplates={true} referenceImages={refs} SelectedModel="Pro"/>
 </Profiler></>;
}createRoot(document.getElementById('root')).render(<Provider store={store}><App/></Provider>);
`, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext } }).outputText;
// Keep production Notepad, editor, MUI fields, Redux, scene/reference controls,
// and PromptConstructor. Isolate the network/voice session and floating guide.
const session = `const noop=()=>{};const session={guideEnabled:false,setGuideEnabled:noop,setGuidePanelState:noop,textAsk:async()=>'',registerGuideUseTarget:()=>noop,chatHistory:[],chatHistoryRef:{current:[]},setChatHistory:noop,buildBrainstormPayload:()=>({messages:[]}),noteMemoryAfterAssistant:noop,waitForCreationMemorySync:async()=>{}};export const useBrainstormSession=()=>session;`;
(async()=>{
 const {createServer}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')));
 const server=await createServer({root,configFile:false,logLevel:'error',cacheDir:'.tmp/notepad-vite',server:{host:'127.0.0.1',port:5197,strictPort:true,hmr:false},plugins:[{
  name:'notepad-test',enforce:'pre',
  resolveId(id){if(id==='/fixture.js')return '\0notepad-fixture';},
  load(id){if(id==='\0notepad-fixture')return fixture;},
  transform(code,id){
   if(id.endsWith('/BrainstormSessionProvider.tsx'))return session;
   if(id.endsWith('/GlobalBrainstormGuide.tsx'))return 'export const GlobalBrainstormGuide=()=>null;';
   if(baseline&&id.endsWith('/useCreationControls.ts'))return execFileSync('git',['show','HEAD:src/useCreationControls.ts'],{cwd:root,encoding:'utf8'});
  },
  configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url.startsWith('/__test')){res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/fixture.js"></script>');}else next();});}
 }]});await server.listen();
 const browser=await chromium.launch({headless:true,executablePath:process.env.NOTEPAD_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const report=[];
 try{
  for(const mobile of [false,true]){
   const context=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'}:{viewport:{width:1440,height:1000}});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
   if(cpuRate>1){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpuRate});}
   await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:5197/')||r.request().url().startsWith('data:')?r.continue():r.abort());
   for(const mode of [0,1]){
    const seed=mode===1?'World\n\nScene 1: First scene\n\nScene 2: Second scene':'';
    await page.goto('http://127.0.0.1:5197/__test?mode='+mode+'&seed='+encodeURIComponent(seed));
    await page.locator('#open').click();
    const field=page.locator('textarea[data-creation-handler="handleBaseChange"]');await field.waitFor({state:'visible'});
    // No animation wait: first characters must survive immediate keyboard input.
    await page.keyboard.type('FIRST',{delay:0});assert.ok((await field.inputValue()).includes('FIRST'));
    await field.fill('');
    const text='Fast typing @Alice and @Scene1 keeps every character. '.repeat(6);
    await page.evaluate(()=>{window.samples=[];window.commits=[];window.scans=0;});
    await field.pressSequentially(text,{delay:5});
    assert.equal(await field.inputValue(),text);
    assert.equal(await page.evaluate(()=>window.hostChanges.length),0);
    const metrics=await page.evaluate(()=>({samples:window.samples,commits:window.commits,scans:window.scans}));
    const percentile=(values,p)=>values.slice().sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))];
    report.push({mobile,mode,baseline,cpuRate,characters:text.length,scansDuringTyping:metrics.scans,inputToFrameP95:percentile(metrics.samples,.95),renderP95:percentile(metrics.commits,.95),maxRender:Math.max(...metrics.commits)});
    if(mode===1){
     const scene=page.locator('textarea[data-creation-control="clikb.creation.notepad.control.scene_2"]');
     await scene.fill('Edited second scene @Scene1');
     assert.equal(await field.inputValue(),text);
    }
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>window.hostChanges.length>0);
    const saved=await page.evaluate(()=>({value:window.currentValue,enter:window.enterValues.at(-1)}));
    assert.ok(saved.value.includes(text));assert.equal(saved.enter,saved.value);
    if(mode===1)assert.ok(saved.value.includes('Edited second scene @Scene1'));
    await page.locator('#open').click();await field.waitFor({state:'visible'});assert.equal(await field.inputValue(),text);
    // Replace a selection in the middle and verify caret continuity.
    await field.focus();await field.evaluate(el=>el.setSelectionRange(5,11));await page.keyboard.type('REPLACE');
    assert.equal(await field.inputValue(),text.slice(0,5)+'REPLACE'+text.slice(11));
    assert.equal(await field.evaluate(el=>el.selectionStart),12);
    // The real avatar insertion path must use the live draft and caret.
    await field.fill('Hello world');await field.evaluate(el=>el.setSelectionRange(6,6));
    const reference=page.locator('[data-creation-control="clikb.creation.notepad.control.reference_1"]');
    await reference.click();await reference.click();
    assert.ok((await field.inputValue()).includes('@Alice'));
    assert.ok((await field.inputValue()).startsWith('Hello '));
    assert.ok((await field.inputValue()).endsWith('world'));
    await page.keyboard.type('NEXT');assert.ok((await field.inputValue()).includes('@Alice NEXT'));
    // Long prompt, clipboard-style replacement, undo, and sustained typing.
    const longText='A detailed world with @Alice and @Scene1. '.repeat(500);
    await field.fill(longText);await field.press('ControlOrMeta+End');
    await page.keyboard.type('X',{delay:0});assert.equal(await field.inputValue(),longText+'X');
    await field.press('ControlOrMeta+z');assert.equal(await field.inputValue(),longText);
    await field.fill(text.slice(0,5)+'REPLACE'+text.slice(11));
    const entersBeforeClose=await page.evaluate(()=>window.enterValues.length);
    assert.equal(await page.getByRole('button',{name:'Save and close Notepad',exact:true}).count(),0,'ordinary Notepad has no added save/close header');
    // Normal Notepad saves by clicking its existing outside area on both layouts.
    await page.mouse.click(4,4);
    await page.waitForFunction(()=>window.currentValue.includes('REPLACE'));
    await field.waitFor({state:'hidden'});
    assert.equal(await page.evaluate(()=>window.enterValues.length),entersBeforeClose,'outside close does not run the host Enter action');
    assert.deepEqual(errors,[]);
    console.log('PASS',JSON.stringify(report.at(-1)));
   }
   await context.close();
  }
  fs.writeFileSync(path.join(root,'.tmp/notepad-'+(baseline?'baseline':'current')+(cpuRate>1?'-cpu'+cpuRate:'')+'-report.json'),JSON.stringify(report,null,2));
 }finally{await browser.close();await server.close();}
})().catch(error=>{console.error(String(error.stack).slice(-1800));console.error('actual tail:',String(error.actual).slice(-100),'expected tail:',String(error.expected).slice(-100));process.exitCode=1;});

