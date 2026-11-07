const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const ts = require('typescript');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || path.resolve(__dirname, '../.tmp/concierge-browser-deps/node_modules/playwright'));
const root = path.resolve(__dirname, '..');
const original = 'SCENE ONE FULL ORIGINAL PROMPT\n' + 'Hover on blue thrusters, turn using thrust vectors, then fire the rear boosters. No helicopter blades. '.repeat(150) + '\nEND OF ORIGINAL';
const secondDraft = 'SCENE TWO ALREADY SAVED DRAFT\n' + 'Keep the second scene camera and character positions. '.repeat(130) + '\nEND OF SECOND DRAFT';
const fixture = ts.transpileModule(`
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {MemoryRouter} from 'react-router-dom';
import {store} from '/src/store.ts';
import {setThemePreference,setPixels} from '/src/settingsSlice.ts';
import {patchUserSnapshot} from '/src/brainstormSlice.ts';
import {flushCreationControls,visibleCreationDrafts} from '/src/useCreationControls.ts';
import MotionGuidePreview from '/src/components/MotionGuidePreview.tsx';
store.dispatch(setThemePreference('light'));store.dispatch(setPixels(1000));
store.dispatch(patchUserSnapshot({creation:{isActive:true,stage:'storybook',editStoryIsOpen:true,editStoryTab:'video'}}));
const plan={version:1,duration:10,background:'#111111',objects:[{id:'actor',shape:'box',color:'#6686b3',keys:[0,10].map(t=>({t,position:[0,.5,0],rotation:[0,0,0],scale:[1,1,1]}))}],camera:[0,10].map(t=>({t,position:[0,2,7],target:[0,.5,0],fov:45}))};
const video='data:video/mp4;base64,AAAAFGZ0eXBpc29tAAAAAGlzb20=';
const makeGuide=(sourcePrompt,id)=>({plan,videoUrl:video+'#'+id,sourcePrompt,sourceFrameUrl:'',aspectRatio:'9:16',createdAt:1});
const originals=[makeGuide(${JSON.stringify(original)},1),{...makeGuide('SCENE TWO SOURCE PROMPT',2),draftPrompt:${JSON.stringify(secondDraft)}}];
window.motionCalls={saves:[],edits:[],retries:[],deletes:[]};
function App(){
 const [guides,setGuides]=useState(originals),[scene,setScene]=useState(0),[tier,setTier]=useState('luna');
 window.test={state:()=>({guides,scene,tier,pixels:store.getState().settings.pixels,calls:window.motionCalls}),
   snapshot:()=>{flushCreationControls();const snapshot=store.getState().brainstorm.userSnapshot;return {...snapshot,creation:{...snapshot.creation,visibleDrafts:visibleCreationDrafts(snapshot.creation.controls?.areas||{})}};},
   select:setScene,
   cachePaid:()=>setGuides(current=>current.map((guide,index)=>index===scene?{...guide,pendingReplacement:{...guide,videoUrl:undefined,draftPrompt:undefined,sourcePrompt:guide.draftPrompt??guide.sourcePrompt}}:guide))};
 return <main style={{maxWidth:750,margin:'20px auto',padding:10}}>
   <button id="scene-one" onClick={()=>setScene(0)}>Scene 1</button><button id="scene-two" onClick={()=>setScene(1)}>Scene 2</button>
   <MotionGuidePreview key={'scene-'+scene} guide={guides[scene]} planningTier={tier} onPlanningTierChange={setTier}
     appColor="#101010" darkMode={false} sceneNumber={scene+1}
     onEdit={async instruction=>{window.motionCalls.edits.push({scene,instruction,tier});return true;}}
     onRebuild={()=>{}} onRetry={()=>window.motionCalls.retries.push({scene,tier})}
     onDelete={()=>window.motionCalls.deletes.push({scene})}
     onPromptSave={value=>{window.motionCalls.saves.push({scene,value});setGuides(current=>current.map((guide,index)=>index===scene?{...guide,draftPrompt:value===guide.sourcePrompt?undefined:value}:guide));}}/>
 </main>;
}createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter><App/></MemoryRouter></Provider>);
`, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;

// Keep real Motion Guide, Notepad, editor, guide UI, prompt constructor,
// fields and controls. Only the network/voice session is isolated.
const session = `
const noop=()=>{};const empty=[];
window.guideTargets=[];
const session={
 guideEnabled:false,setGuideEnabled:noop,setGuidePanelState:noop,guidePanelState:'hidden',guidePlayMode:false,setGuidePlayMode:noop,
 textAsk:async()=>'',chatHistory:empty,chatHistoryRef:{current:empty},setChatHistory:noop,
 buildBrainstormPayload:()=>({messages:[]}),noteMemoryAfterAssistant:noop,waitForCreationMemorySync:async()=>{},
 registerGuideUseTarget:target=>{window.guideTargets.push(target);return ()=>{window.guideTargets=window.guideTargets.filter(item=>item!==target);};},
 hasGuideUseTarget:false,guideUseTargetLabel:'',appendGuideTextToTarget:noop,isGuideInlineHostActive:false,registerGuideInlineHost:()=>noop,
 clearBrainstormSession:noop,setVoiceAskHandler:noop,sessionIdentity:{sessionId:'motion-test',deviceId:'test'},
 voice:{status:'idle',error:null,level:0,start:async()=>{},stop:noop,askText:async()=>'',speakText:async()=>{},stopSpeech:noop}
};export const useBrainstormSession=()=>session;`;

(async () => {
  const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')));
  const server = await createServer({ root, configFile: false, logLevel: 'error', cacheDir: path.join(root, 'node_modules/.tmp/motion-guide-prompt-vite'),
    esbuild: { jsx: 'automatic' },
    optimizeDeps: { include: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client', 'react-redux', 'react-router-dom', 'react-device-detect', 'use-sync-external-store/with-selector', 'use-sync-external-store/shim/with-selector', '@reduxjs/toolkit', '@mui/material', '@mui/material/styles', '@emotion/react', '@emotion/styled', 'axios', 'three'] },
    server: { host: '127.0.0.1', port: 5204, strictPort: true, hmr: false }, plugins: [{ name: 'motion-guide-prompt', enforce: 'pre',
      resolveId(id) { if (id === '/fixture.js') return '\0motion-guide-prompt'; },
      load(id) { if (id === '\0motion-guide-prompt') return fixture; },
      transform(_code, id) { if (id.endsWith('/BrainstormSessionProvider.tsx')) return session; },
      configureServer(server) { server.middlewares.use((req, res, next) => {
        if (req.url.startsWith('/__test')) {
          res.setHeader('Content-Type', 'text/html');
          res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;min-height:100vh;background:#f8f8f8}button{cursor:pointer}</style><div id="root"></div><script type="module" src="/fixture.js"></script>');
          return;
        }
        next();
      }); }
    }] });
  await server.listen();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
    for (const mobile of [false, true]) {
      const context = await browser.newContext(mobile ? {
        viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      } : { viewport: { width: 1440, height: 1000 } });
      const page = await context.newPage(), errors = [], unexpectedRequests = [];
      page.setDefaultTimeout(60000);
      page.on('pageerror', error => { errors.push(error.message); console.error('Browser:', error.message); });
      page.on('console', message => { if (message.type() === 'error') console.error('Console:', message.text()); });
      page.on('requestfailed', request => console.error('Request failed:', request.url(), request.failure()?.errorText));
      page.on('request', request => { if (new URL(request.url()).pathname==='/scene-presets' && request.postDataJSON()?.action==='list') return; if (request.method() !== 'GET' && request.method() !== 'HEAD') unexpectedRequests.push(`${request.method()} ${request.url()}`); });
      await page.route('**/*', route => new URL(route.request().url()).pathname==='/scene-presets' ? route.fulfill({json:{items:[],hasMore:false}}) : route.request().url().startsWith('http://127.0.0.1:5204/') || route.request().url().startsWith('data:') ? route.continue() : route.abort());
      await page.goto('http://127.0.0.1:5204/__test', { waitUntil: 'domcontentloaded' });
      const textIcon = page.getByRole('button', { name: 'Edit Motion Guide prompt', exact: true });
      try { await Promise.race([textIcon.waitFor(), page.waitForEvent('pageerror').then(error => { throw error; })]); }
      catch(error) { console.error('Startup body:', (await page.locator('body').innerText()).slice(0, 1000)); throw error; }
      const state = () => page.evaluate(() => window.test.state());
      const sourceVideo = (await state()).guides.map(guide => guide.videoUrl);
      const field = page.locator('textarea[data-creation-control="clikb.creation.notepad.control.workstation_motion_prompt"]');
      async function openPrompt(expected, sceneNumber) {
        await textIcon.click(); await field.waitFor({ state: 'visible' });
        await page.waitForFunction(() => {
          const field = document.querySelector('textarea[data-creation-control="clikb.creation.notepad.control.workstation_motion_prompt"]');
          return field && field.getBoundingClientRect().width > 250;
        });
        assert.equal(await field.inputValue(), expected, 'Notepad must load the entire source/draft without truncation.');
        await page.waitForFunction(sceneNumber => window.guideTargets.some(target => target.contextLabel === `Motion Guide prompt draft for Scene ${sceneNumber}`), sceneNumber);
      }
      async function closePrompt() { await field.press('Enter'); await field.waitFor({ state: 'hidden' }); }
      await openPrompt(original, 1);
      const draft = 'SCENE ONE CORRECTED FLIGHT MECHANISM\n' + original + '\nOnly rear rocket thrust for the launch.';
      await field.fill(draft);
      assert.equal((await state()).calls.saves.length, 0, 'Typing alone must stay local to the editor.');
      const snapshot = await page.evaluate(() => window.test.snapshot());
      assert.equal(snapshot.creation.visibleDrafts.find(draft => draft.controlId.endsWith('.workstation_motion_prompt'))?.value, draft, 'concierge cannot see the full uncommitted draft');
      assert.equal((await state()).guides[0].sourcePrompt, original);
      await closePrompt();
      let current = await state();
      assert.equal(current.guides[0].draftPrompt, draft); assert.equal(current.guides[0].sourcePrompt, original);
      assert.deepEqual(current.guides.map(guide => guide.videoUrl), sourceVideo);
      assert.deepEqual(current.calls.saves, [{ scene: 0, value: draft }]);
      assert.equal(current.calls.edits.length, 0); assert.equal(current.calls.retries.length, 0); assert.equal(current.pixels, 1000);
      await openPrompt(draft, 1); await closePrompt();
      assert.equal((await state()).calls.saves.length, 1, 'Closing an unchanged draft must not schedule a redundant update.');

      await page.locator('#scene-two').click(); await openPrompt(secondDraft, 2);
      const revisedSecond = secondDraft + '\nSecond-scene adjustment only.';
      await field.fill(revisedSecond); await closePrompt();
      current = await state();
      assert.equal(current.guides[0].draftPrompt, draft); assert.equal(current.guides[1].draftPrompt, revisedSecond);
      assert.deepEqual(current.calls.saves.at(-1), { scene: 1, value: revisedSecond });
      assert.deepEqual(current.guides.map(guide => guide.videoUrl), sourceVideo);

      // EditStory keys this component by scene. A host scene transition while
      // typing must flush the old scene's buffered draft to that old owner.
      await page.locator('#scene-one').click(); await openPrompt(draft, 1);
      const pendingFirst = draft + '\nBuffered before scene transition.';
      await field.fill(pendingFirst);
      await page.evaluate(() => window.test.select(1));
      await field.waitFor({ state: 'hidden' });
      current = await state();
      assert.equal(current.scene, 1); assert.equal(current.guides[0].draftPrompt, pendingFirst);
      assert.equal(current.guides[1].draftPrompt, revisedSecond, 'Switching scenes must not copy the old draft into the new scene.');
      assert.deepEqual(current.calls.saves.at(-1), { scene: 0, value: pendingFirst });
      await openPrompt(revisedSecond, 2); await closePrompt();

      await page.getByRole('button', { name: 'Expand Motion Guide', exact: true }).click();
      const instruction = page.locator('textarea[data-creation-control="clikb.creation.workstation_motion_guide.control.edit_instruction"]');
      await instruction.waitFor(); await instruction.fill('Keep the rear rocket boosters.');
      for (const [tier, cost] of [['luna', 1], ['sol', 1]]) {
        const model = page.locator(`[data-creation-control="clikb.creation.workstation_planning_model.control.model_${tier}"]`);
        await model.click();
        const edit = page.locator('[data-creation-control="clikb.creation.workstation_motion_guide.control.edit"]');
        await page.waitForFunction(cost => document.querySelector('[data-creation-control="clikb.creation.workstation_motion_guide.control.edit"]')?.textContent.includes('at cost'), cost);
        assert.equal(await model.getAttribute('aria-pressed'), 'true');
        assert.equal(await edit.getAttribute('data-creation-policy'), 'requires_video');
        assert.equal(await edit.isEnabled(), true);
        assert.ok((await edit.innerText()).includes('at cost'));
        const rebuild = page.getByRole('dialog').locator('[data-creation-control="clikb.creation.workstation_motion_guide.control.rebuild_prompt"]');
        assert.ok((await rebuild.innerText()).includes('at cost'));
        assert.equal(await rebuild.getAttribute('data-creation-policy'), 'requires_video');
        await edit.scrollIntoViewIfNeeded();
        await page.waitForFunction(cost => window.test.snapshot().creation.controls?.areas['clikb.creation.workstation_motion_guide']?.state.editPixels === cost, cost, {timeout:10000}).catch(async error => {
          console.error('Motion live diagnostics:',JSON.stringify(await page.evaluate(()=>({snapshot:window.test.snapshot().creation, controls:[...document.querySelectorAll('[data-creation-area="clikb.creation.workstation_motion_guide"]')].map(e=>{const r=e.getBoundingClientRect();return {id:e.dataset.creationControl,rect:[r.x,r.y,r.width,r.height],hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,350),aria:e.closest('[aria-hidden]')?.getAttribute('aria-hidden')};})}))));
          await page.screenshot({path:'.tmp/motion-guide-prompt-failure.png'});throw error;
        });
        const live = await page.evaluate(() => window.test.snapshot().creation.controls.areas['clikb.creation.workstation_motion_guide']);
        assert.equal(live.state.editPixels, cost);
        assert.equal(live.controls.find(control => control.controlId.endsWith('.edit')).policy, 'requires_video');
      }
      await page.locator('[data-creation-control="clikb.creation.workstation_motion_guide.control.edit"]').click();
      assert.deepEqual((await state()).calls.edits, [{ scene: 1, instruction: 'Keep the rear rocket boosters.', tier: 'sol' }]);
      assert.equal((await state()).guides[1].draftPrompt, revisedSecond, 'Edit 3D changed the independent video-prompt draft');
      await page.getByRole('button', { name: 'Close Motion Guide', exact: true }).click();
      await page.getByRole('dialog').waitFor({state:'hidden'});
      await page.evaluate(() => window.test.cachePaid());
      const retry = page.locator('[data-creation-control="clikb.creation.workstation_motion_guide.control.retry_export"]:visible');
      await retry.waitFor(); assert.equal(await retry.getAttribute('data-creation-policy'), 'candidate');
      assert.ok((await retry.innerText()).includes('0 P'));
      current = await state();
      assert.equal(current.calls.edits.length, 1); assert.equal(current.calls.retries.length, 0); assert.equal(current.calls.deletes.length, 0);
      await retry.click();
      current = await state();
      assert.deepEqual(current.calls.retries, [{ scene: 1, tier: 'sol' }]);
      assert.deepEqual(current.guides.map(guide => guide.videoUrl), sourceVideo); assert.equal(current.pixels, 1000);
      assert.deepEqual(unexpectedRequests, [], 'The prompt-edit flow must not submit any network generation request.');
      assert.deepEqual(errors, [], `${mobile ? 'mobile' : 'desktop'} browser errors`);
      fs.mkdirSync(path.join(root, '.tmp/motion-guide-prompt'), { recursive: true });
      await openPrompt(revisedSecond, 2);
      await page.waitForFunction(() => {
        const field = document.querySelector('textarea[data-creation-control="clikb.creation.notepad.control.workstation_motion_prompt"]');
        const paper = field?.closest('.MuiDialog-paper');
        if (!paper) return false;
        const transform = getComputedStyle(paper).transform;
        return transform === 'none' || Math.abs(new DOMMatrixReadOnly(transform).a - 1) < .001;
      });
      await page.screenshot({ path: path.join(root, `.tmp/motion-guide-prompt/${mobile ? 'mobile' : 'desktop'}-notepad.png`) });
      await closePrompt();
      await context.close();
      console.log(`PASS ${mobile ? 'mobile' : 'desktop'} real MotionGuidePreview + Notepad: full source/draft, free draft saving, scene ownership, preserved video, provider-cost labels / 1 P starting balance, paid edit/rebuild policies and free cached export retry; no live API requests or browser errors.`);
    }
  } finally { await browser?.close(); await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
