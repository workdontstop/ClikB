const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const { build } = require('esbuild');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const brokerFile = path.join(root, 'server/src/ConciergeSnapshotBroker.ts');
const brokerModule = new Module(brokerFile, module);
brokerModule._compile(ts.transpileModule(fs.readFileSync(brokerFile, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, brokerFile);
const { conciergeVisibleView } = brokerModule.exports;
const fixture = `
import React,{useState,useRef} from 'react';import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';import {BrowserRouter,useLocation} from 'react-router-dom';import {Modal,Box} from '@mui/material';
import {store} from '/src/store';import {setLoggedUser} from '/src/profileSlice';import {setPixels} from '/src/settingsSlice';
import {TemplateLibrary} from '/src/components/TemplateGallery';import Notepad from '/src/Notepad';
import {usePromptInputHistory} from '/src/usePromptInputHistory';import {flushCreationControls} from '/src/useCreationControls';
import {conciergeVisibleSurface} from '/src/conciergeVisibleSurface';
store.dispatch(setLoggedUser({id:2,name:'Reviewer',username:'reviewer',image:'',imageThumb:''}));store.dispatch(setPixels(1000));
const noop=()=>{},asyncNoop=async()=>{};
const templates=[{id:'42',name:'Sailors at Dawn',basePrompt:'Scene 1: Sailors discover an island. Scene 2: They explore a hidden temple.',thumbnailUrl:'http://clikb.test/old.png',createdAt:1,isCustom:true,userId:9,artStyle:'Anime',category:'Cinema & Lore',inLibrary:true},{id:'43',name:'My Own Game',basePrompt:'An interactive mystery in a frozen observatory.',thumbnailUrl:'',createdAt:2,isCustom:true,userId:2,artStyle:'PhotoRealistic',category:'Interactive Games'}];
templates.push(...Array.from({length:6},(_,i)=>({id:'seed-sort-'+i,presetKey:'sort-'+i,name:'Stable Short '+i,basePrompt:'An unchanged Shorts idea '+i,thumbnailUrl:'',createdAt:1,isCustom:true,userId:2,artStyle:'Anime',category:'Shorts & Viral'})));
templates.push({id:'44',name:'Parallel Character Remix',basePrompt:'Keep the same character identity across new settings.',thumbnailUrl:'',createdAt:1,isCustom:true,userId:2,artStyle:'Anime',category:'Character & Remix Rules'});
window.refreshRequests=0;window.apiCalls=[];window.coverJobs={};window.finishCoverFor=target=>window.coverJobs[target].resolve();window.failCoverFor=target=>window.coverJobs[target].reject(new Error('Fixture provider failure'));window.templateApi=async(url,body)=>{window.apiCalls.push({url,body});
 if(/get_rag|fish|artstyle/.test(url))return {data:[]};
 if(/GptImageFlare|fluxschnell|minimax2/.test(url))return new Promise((resolve,reject)=>{const target=body.templateCoverTarget;const finish=()=>resolve({data:{imageUrl:target==='43'?'http://clikb.test/new-43.png':'http://clikb.test/new.png',coverReceipt:'verified-fixture'}});window.coverJobs[target]={resolve:finish,reject};window.finishCover=finish;});
 if(/update_template_image/.test(url))return {data:{id:Number(body.id)||42}};
 if(/create_template_prompt/.test(url))return {data:{message:'Saved',id:99}};
 if(/examplestory/.test(url))return {data:{initialSteps:{keyPoints:['A new complete creative idea.']}}};
 return {data:{}};
};
history.replaceState({idx:4,key:'profile',usr:{profile:2}},'','/pages');
history.pushState({idx:5,key:'deck',usr:{clikbDeck:{postId:42}}},'','/images?deck=42');
function App(){const [catalog,setCatalog]=useState(templates);const [composer,setComposer]=useState(true),[library,setLibrary]=useState(false),[notepad,setNotepad]=useState(false),[prompt,setPrompt]=useState('My draft');const loc=useLocation();const gallery=useRef(null);
usePromptInputHistory({open:composer,suspended:library,blockBack:false,routeKey:loc.key,onClose:()=>setComposer(false),onReopen:()=>setComposer(true)});
window.fixture={state:()=>({composer,library,notepad,prompt,history:history.state}),openLibrary:()=>setLibrary(true),openNotepad:()=>setNotepad(true),observe:()=>{flushCreationControls();const raw=store.getState().brainstorm.userSnapshot;const snapshot={...raw,route:location.pathname,ui:{minimisePrompt:false},creation:{...raw.creation,isActive:true,isInitialComposer:true}};snapshot.conciergeFocus=conciergeVisibleSurface(snapshot);return snapshot;}};
return <><button onClick={()=>setLibrary(true)}>Composer Templates</button><button onClick={()=>setNotepad(true)}>Open Notepad</button><output>{prompt}</output>
<Modal open={library} onClose={()=>{if(!gallery.current?.handleBackOrClose())setLibrary(false)}}><Box sx={{width:'90vw',height:'100dvh',mx:'auto',bgcolor:'#fff'}}>{library&&<TemplateLibrary ref={gallery} standalone templates={catalog} activeTemplateId={null} darkMode={false} appColor='#b32c24' appColorHover='#a00' onClose={()=>setLibrary(false)} handleTemplateSelect={t=>setPrompt(t.basePrompt)} onTemplateCreated={()=>{window.refreshRequests++;setCatalog(previous=>[...previous].reverse().map((t,i)=>({...t,id:t.id.startsWith('seed-sort-')?String(700+i):t.id,createdAt:100000-i*1000})));}} onOpenBrainstorm={params=>{setLibrary(false);setNotepad(true);setTimeout(()=>window.dispatchEvent(new CustomEvent('clikb-open-brainstorm',{detail:params})),60)}}/>}</Box></Modal>
<Notepad open={notepad} onClose={()=>setNotepad(false)} setIsNotepadOpen={setNotepad} value={prompt} onChange={setPrompt} type={0} GeneratedImage={[]} hide={false} placeholder='Prompt' handleKeyDown={noop} TextFieldactive={false} setTextFieldactive={noop} mode={0} showTemplates={true} templateList={catalog} ensureTemplateLibraryLoaded={asyncNoop} loadMoreTemplates={asyncNoop} onTemplateLibraryChanged={asyncNoop}/>
</>}
createRoot(document.getElementById('root')).render(<React.StrictMode><Provider store={store}><BrowserRouter><App/></BrowserRouter></Provider></React.StrictMode>);
`;
(async () => {
  const bundle = await build({ stdin: { contents: fixture, loader: 'tsx', resolveDir: root }, bundle: true, write: false,
    platform: 'browser', format: 'iife', jsx: 'automatic', logLevel: 'silent', loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.webp': 'dataurl', '.css': 'empty' },
    define: { 'import.meta.env': JSON.stringify({ VITE_CLIK_URL: 'http://clikb.test', DEV: false, PROD: true }) }, plugins: [{ name: 'offline-template-review', setup(b) {
      b.onResolve({ filter: /^(axios|.*BrainstormSessionProvider|.*fishVoices|.*FishVoicePreviewManager|.*GlobalBrainstormGuide|.*AutoControlRevealButton|.*AutoControlPill|.*DetectDevice)$/ }, a => ({ path: a.path, namespace: 'mock' }));
      b.onLoad({ filter: /.*/, namespace: 'mock' }, a => ({ contents: a.path === 'axios' ? `const api={post:(url,body)=>window.templateApi(url,body),get:url=>window.templateApi(url),put:(url,body)=>window.templateApi(url,body)};export default api;` : /BrainstormSessionProvider/.test(a.path) ? `const noop=()=>{},session={chatHistory:[],setChatHistory:noop,chatHistoryRef:{current:[]},buildBrainstormPayload:noop,noteMemoryAfterAssistant:noop,waitForCreationMemorySync:async()=>{},takePendingMilestonesForTurn:()=>[],resolveMilestoneBatch:noop,registerGuideUseTarget:()=>noop,registerGuideAskTarget:()=>noop,registerGuideContext:()=>noop,clearBrainstormSession:noop,setVoiceAskHandler:noop,setGuideEnabled:noop,sessionIdentity:{},voice:{status:'idle',active:false,stopSpeech:noop,speakText:noop}};export const useBrainstormSession=()=>session;` : /fishVoices/.test(a.path) ? `export const useFishVoices=()=>[];export const GEMINI_VOICE_OPTIONS=[{id:'Zephyr',label:'Zephyr',tone:'Bright',gender:'Female',previewUrl:''}];` : /FishVoicePreviewManager/.test(a.path) ? 'export const FishVoicePreviewManager=()=>null;' : /DetectDevice/.test(a.path) ? 'export const matchMobile=innerWidth<600,matchPc=!matchMobile,matchTablet=false;' : 'export const GlobalBrainstormGuide=()=>null;export default function Stub(){return null;}', loader: 'jsx', resolveDir: root }));
      b.onResolve({ filter: /^\/(src|server)\// }, a => { const file=path.join(root,a.path.slice(1)); return {path:[file,file+'.tsx',file+'.ts'].find(p=>fs.existsSync(p))||file}; });
    } }] });
  const html = '<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}*{box-sizing:border-box}</style><div id="root"></div><script>' + bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>';
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } }), errors = [];
      page.setDefaultTimeout(12000);page.on('pageerror', e => {errors.push(e.message);console.error('PAGE ERROR',e.message)});
      await page.route('**/*', route => route.request().isNavigationRequest() ? route.fulfill({ status: 200, contentType: 'text/html', body: html }) : route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5gAAAABJRU5ErkJggg==', 'base64') }));
      await page.goto('http://clikb.test/images');
      await page.waitForFunction(() => window.fixture?.state().history.clikbPromptInput);
      const base = await page.evaluate(() => window.fixture.state().history);
      const action = key => page.locator(`[data-ai-action="clikb.creation.templates.action.${key}"]`).filter({ visible: true });
      await page.getByText('Composer Templates', { exact: true }).click();
      let list = conciergeVisibleView(await page.evaluate(() => window.fixture.observe()));
      const listRaw = await page.evaluate(() => window.fixture.observe());
      assert.ok(!listRaw.creation.controls.areas['clikb.creation.templates'].state.registryConflicts);
      const listControls = Object.values(list.areas).flatMap(a => a.controls);
      assert.ok(listControls.some(c => c.actionId.endsWith('open_detail_42') && c.description.includes('Cinema & Lore')));
      await action('open_detail_42').first().click();
      let snapshot = await page.evaluate(() => window.fixture.observe());
      assert.ok(snapshot.conciergeFocus.textFields.some(f => f.value.includes('hidden temple')));
      assert.ok(conciergeVisibleView(snapshot).liveFields.some(f => f.value.includes('hidden temple')));
      assert.ok(!('templateTitles' in snapshot.creation.controls.areas['clikb.creation.templates'].state));
      await page.goBack();await action('open_detail_42').first().waitFor();
      await page.goForward();await action('detail_use_42').waitFor();
      await action('detail_use_42').click();
      await page.waitForFunction(() => !window.fixture.state().library);
      assert.deepEqual((await page.evaluate(() => window.fixture.state())).history, base);
      assert.ok((await page.evaluate(() => window.fixture.state())).composer);
      await page.goForward();await page.waitForFunction(idx => history.state.idx === idx, base.idx);
      await page.goBack();await page.waitForFunction(() => !window.fixture.state().composer);
      await page.goForward();await page.waitForFunction(() => window.fixture.state().composer);
      // The actual Notepad -> PromptConstructor -> TemplateLibrary path.
      await page.getByText('Open Notepad', { exact: true }).click();
      await page.waitForTimeout(250);
      await page.locator('[data-ai-action="clikb.creation.assistant.action.templates"]').click();
      await action('open_detail_42').first().click();
      await page.goBack();await action('open_detail_42').first().waitFor();
      await action('create_new_template').click();
      const field = key => page.locator(`[data-ai-action="clikb.creation.brainstorm.action.${key}"]`).locator('input,textarea').filter({ visible: true }).first();
      await field('manual_name').fill('An authored template');await field('manual_prompt').fill('Scene 1: Complete authored script. Scene 2: A happy ending.');
      snapshot = await page.evaluate(() => window.fixture.observe());
      assert.ok(snapshot.conciergeFocus.textFields.some(f => f.value.includes('Complete authored script')));
      await page.locator('[data-ai-action="clikb.creation.brainstorm.action.manual_finalize"]').filter({ visible: true }).click();
      await page.waitForFunction(() => window.finishCover);await page.evaluate(() => window.finishCover());
      await page.locator('[data-ai-action="clikb.creation.brainstorm.action.restore_image_prompt"]').click();
      assert.ok((await field('finalize_prompt').inputValue()).includes('Complete authored script'));
      await page.locator('[data-ai-action="clikb.creation.brainstorm.action.image_prompt_mode"]').click();
      const qualityButtons=page.locator('[data-ai-action^="clikb.creation.brainstorm.action.quality_"]').filter({visible:true});
      assert.equal(await qualityButtons.count(),3);
      for(const button of await qualityButtons.all())assert.ok((await button.boundingBox()).height>=44);
      const beforeSD2=await page.evaluate(()=>window.apiCalls.filter(c=>/GptImageFlare|fluxschnell|minimax2/.test(c.url)).length);
      await page.locator('[data-ai-action="clikb.creation.brainstorm.action.quality_sd2"]').click();
      assert.equal(await page.evaluate(()=>window.apiCalls.filter(c=>/GptImageFlare|fluxschnell|minimax2/.test(c.url)).length),beforeSD2);
      await page.locator('[data-ai-action="clikb.creation.brainstorm.action.generate_image"]').click();
      await page.waitForFunction(()=>window.apiCalls.some(c=>c.url.endsWith('/minimax2')));await page.evaluate(()=>window.finishCoverFor('new'));
      await page.locator('[data-ai-action="clikb.creation.brainstorm.action.template_prompt_mode"]').click();
      await page.locator('[data-ai-action="clikb.creation.brainstorm.action.save_template"]').click();
      await page.waitForFunction(() => window.apiCalls.some(c => c.url.endsWith('/create_template_prompt')));
      const save = await page.evaluate(() => window.apiCalls.find(c => c.url.endsWith('/create_template_prompt')));
      assert.ok(save.body.template_prompt.includes('happy ending'));assert.equal(save.body.template_image, 'http://clikb.test/new.png');assert.equal(save.body.coverReceipt, 'verified-fixture');assert.equal(save.body.coverQuality,'sd2');
      // Two different covers run simultaneously; finishing one must leave the other busy.
      await page.reload();await page.waitForFunction(() => window.fixture?.state().history.clikbPromptInput);
      await page.getByText('Composer Templates', { exact: true }).click();
      await page.evaluate(()=>{
        const row=document.querySelector('[data-template-category="Shorts & Viral"]');row.scrollLeft=180;
        window.unchangedRow=row;window.unchangedScroll=row.scrollLeft;
        window.unchangedOrder=Array.from(row.querySelectorAll('[data-creation-handler="openDetailView"]')).map(card=>card.dataset.creationLabel);
      });
      await action('open_detail_42').first().click();
      await action('detail_cover_menu_42').click();await action('detail_cover_hd').click();
      await page.waitForFunction(() => window.coverJobs['42']);await page.goBack();
      await page.locator('[data-creation-handler="openDetailView"][data-ai-action*="open_detail_43"]').first().click();
      await action('detail_cover_menu_43').click();
      await action('detail_cover_sd2').evaluate(button => { button.click();button.click(); });
      await page.waitForFunction(() => window.coverJobs['43']);
      assert.equal(await page.evaluate(() => window.apiCalls.filter(c=>/GptImageFlare|minimax2/.test(c.url)).length),2,'duplicate clicks cannot submit the same template twice');
      let concurrent = await page.evaluate(() => window.fixture.observe());
      assert.equal(concurrent.creation.controls.areas['clikb.creation.templates'].state.coverGenerationCount,2);
      await page.goBack();await action('close').click();
      assert.equal(await page.evaluate(() => window.fixture.state().library), true);
      await page.evaluate(()=>{
        const row=document.querySelector('[data-template-category="Shorts & Viral"]');
        if(row.scrollLeft!==window.unchangedScroll)throw new Error('Detail navigation lost an unrelated row scroll position');
        window.unchangedRow=row;
      });
      await page.goBack();await page.waitForFunction(() => Boolean(history.state.clikbTemplateHistory));
      await page.evaluate(() => window.finishCoverFor('43'));
      await page.waitForFunction(() => window.apiCalls.some(c=>c.url.endsWith('/update_template_image')&&c.body.id===43));
      await page.waitForFunction(() => window.fixture.observe().creation.controls.areas['clikb.creation.templates'].state.coverGenerationCount===1);
      const secondCover = await page.evaluate(() => window.apiCalls.find(c=>c.url.endsWith('/update_template_image')&&c.body.id===43));
      assert.equal(secondCover.body.template_image,'http://clikb.test/new-43.png');
      assert.equal(await page.evaluate(()=>window.refreshRequests),0,'a partial batch must not refetch the catalog');
      await action('close').click();assert.equal(await page.evaluate(() => window.fixture.state().library), true);
      await page.evaluate(() => window.finishCoverFor('42'));
      await page.waitForFunction(() => window.fixture.observe().creation.controls.areas['clikb.creation.templates'].state.coverGenerationCount===0);
      const cover = await page.evaluate(() => window.apiCalls.find(c => c.url.endsWith('/update_template_image')&&c.body.id===42));
      assert.equal(cover.body.coverReceipt, 'verified-fixture');assert.equal(cover.body.template_image,'http://clikb.test/new.png');
      await page.waitForFunction(()=>window.refreshRequests===1);
      const stability=await page.evaluate(()=>{
        const row=document.querySelector('[data-template-category="Shorts & Viral"]');
        return {sameRow:row===window.unchangedRow,scroll:row.scrollLeft,expectedScroll:window.unchangedScroll,order:Array.from(row.querySelectorAll('[data-creation-handler="openDetailView"]')).map(card=>card.dataset.creationLabel),expectedOrder:window.unchangedOrder};
      });
      assert.equal(stability.sameRow,true);assert.equal(stability.scroll,stability.expectedScroll);assert.deepEqual(stability.order,stability.expectedOrder);
      assert.ok(!await page.evaluate(() => window.apiCalls.some(c => /signed_url|del-image/.test(c.url))));
      await action('close').click();await page.waitForFunction(() => !window.fixture.state().library);
      await page.getByText('Composer Templates',{exact:true}).click();
      const longCategoryCard=page.locator('[data-creation-handler="openDetailView"][data-ai-action*="open_detail_44"]').first();
      await longCategoryCard.scrollIntoViewIfNeeded();
      const longBounds=await longCategoryCard.evaluate(card=>{
        const bounds=card.getBoundingClientRect(),actions=card.querySelector('[data-template-card-actions]'),chip=card.querySelector('.MuiChip-root');
        const chipBounds=chip.getBoundingClientRect();
        return {fit:[...actions.querySelectorAll('button')].every(button=>{const r=button.getBoundingClientRect();return r.left>=bounds.left&&r.right<=bounds.right&&r.width>=26;}),noOverlap:chipBounds.right<=actions.getBoundingClientRect().left,fullLabel:chip.textContent};
      });
      assert.equal(longBounds.fit,true);assert.equal(longBounds.noOverlap,true);assert.equal(longBounds.fullLabel,'Character & Remix Rules');
      if(process.env.TEMPLATE_COVER_SCREENSHOT_DIR){fs.mkdirSync(process.env.TEMPLATE_COVER_SCREENSHOT_DIR,{recursive:true});await longCategoryCard.screenshot({path:path.join(process.env.TEMPLATE_COVER_SCREENSHOT_DIR,`long-category-${width}.png`)});}
      await page.locator('[data-ai-action^="clikb.creation.templates.action.gen_open_43"]').first().click();
      const choices=page.locator('[data-ai-action^="clikb.creation.templates.action.cover_"]').filter({visible:true});
      assert.equal(await choices.count(),3);
      const closeChoice=page.getByRole('button',{name:'Close cover model choices'});
      const closeBox=await closeChoice.boundingBox();
      let previous;
      for(const button of await choices.all()){
        const box=await button.boundingBox();assert.ok(box.height>=43.9&&box.width>=100,JSON.stringify({width,box,text:await button.innerText()}));
        if(previous)assert.ok(box.y>=previous.y+previous.height+4);
        assert.ok(box.x+box.width<=closeBox.x||box.y>=closeBox.y+closeBox.height);
        assert.ok(await button.evaluate(el=>{const bounds=el.getBoundingClientRect();const parent=el.closest('[data-creation-handler="openDetailView"]').getBoundingClientRect();return bounds.top>=parent.top&&bounds.bottom<=parent.bottom&&bounds.right<=parent.right;}));
        previous=box;
      }
      if(process.env.TEMPLATE_COVER_SCREENSHOT_DIR){
        fs.mkdirSync(process.env.TEMPLATE_COVER_SCREENSHOT_DIR,{recursive:true});
        await choices.first().locator('xpath=ancestor::*[@data-creation-handler="openDetailView"]').screenshot({path:path.join(process.env.TEMPLATE_COVER_SCREENSHOT_DIR,`cover-choices-${width}.png`)});
      }
      await closeChoice.click();await action('close').click();await page.waitForFunction(()=>!window.fixture.state().library);
      assert.deepEqual(errors, []);
      console.log('PASS', width, 'real library history, composer preservation, Notepad handoff, Concierge list/draft/detail projection, Original, save payload and concurrent HD covers, SD2 in both pickers, mobile touch targets, one batch refresh and stable unrelated row order/scroll');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
