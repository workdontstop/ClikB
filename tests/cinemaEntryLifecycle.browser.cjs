const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const origin = 'http://fixture.test';
const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="teal"/></svg>');

// External voice/Guide services are inert. PromptInput, its submit callbacks,
// Storybook, reference context, Redux and their hooks/render lifecycle are real.
const sessionMock = `const noop=()=>{},empty=[];const session={
 guideEnabled:false,setGuideEnabled:noop,setGuidePanelState:noop,guidePanelState:'hidden',guidePlayMode:false,setGuidePlayMode:noop,
 syncCreationMemoryCards:async()=>{},creationMemoryUnsyncedCardKeys:empty,runAutomaticGuideCall:async()=>'',cancelAutomaticGuideCall:noop,
 textAsk:async()=>'',chatHistory:empty,chatHistoryRef:{current:empty},setChatHistory:noop,buildBrainstormPayload:()=>({messages:[]}),
 noteMemoryAfterAssistant:noop,waitForCreationMemorySync:async()=>{},registerGuideUseTarget:()=>noop,hasGuideUseTarget:false,
 guideUseTargetLabel:'',appendGuideTextToTarget:noop,isGuideInlineHostActive:false,registerGuideInlineHost:()=>noop,
 clearBrainstormSession:noop,setVoiceAskHandler:noop,sessionIdentity:{sessionId:'isolated-lifecycle'},
 voice:{status:'idle',error:null,level:0,start:async()=>{},stop:noop,askText:async()=>'',speakText:async()=>{},stopSpeech:noop}};
 export const useBrainstormSession=()=>session;`;
const fixture = `
import React,{useRef,useState} from 'react';import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';import {MemoryRouter} from 'react-router-dom';
import {store} from './src/store';import {setLoggedUser} from './src/profileSlice';
import {setPixels,setNotepadPreviewActive,dismissAppIntro,setPromptRed,setThemePreference} from './src/settingsSlice';
import PromptInput from './src/PromptInput';
import {CreationReferenceDraftProvider,useCreationReferenceDraftState} from './src/CreationReferenceDraftContext';
import {BrainstormChat} from './src/components/BrainstormChat';
const noop=()=>{};const q=new URLSearchParams(location.search),type=Number(q.get('type')||1);
store.dispatch(setLoggedUser({id:3,username:'Fixture',image:''}));store.dispatch(setPixels(1000));
store.dispatch(setNotepadPreviewActive(false));store.dispatch(dismissAppIntro());store.dispatch(setPromptRed(''));
store.dispatch(setThemePreference('dark'));
window.fixture={store,mounted:false,error:null,stacks:[],renders:0};
class Boundary extends React.Component{state={error:null};static getDerivedStateFromError(error){return{error};}
 componentDidCatch(error){window.fixture.error=error.message;window.fixture.stacks.push(error.stack);}
 render(){return this.state.error?<output data-crash>{this.state.error.message}</output>:this.props.children;}}
function Creation(){const draft=useCreationReferenceDraftState();const [minimisePrompt,setminimisePrompt]=useState(false);
 const [isSubmittingKick,setIsSubmittingKick]=useState(false),[isSubmitting,setIsSubmitting]=useState(false);
 const [allowPing,setAllowPing]=useState(false),[isMobileBack,setIsMobileBack]=useState(false),[fluxLoaded,setFluxLoaded]=useState(false);
 return <CreationReferenceDraftProvider value={draft}><PromptInput type={type} isMenuOpen={false}
 setcallFeeds={noop} callFeeds={false} AllowPing={allowPing} setAllowPing={setAllowPing} minimisePrompt={minimisePrompt} setminimisePrompt={setminimisePrompt}
 fluxLoaded={fluxLoaded} setFluxLoaded={setFluxLoaded} isSubmittingKick={isSubmittingKick} setIsSubmittingKick={setIsSubmittingKick}
 isSubmitting={isSubmitting} setIsSubmitting={setIsSubmitting} IsMobileBackActive={isMobileBack} setIsMobileBackActive={setIsMobileBack}
 clikt={false} setclikt={noop} setHideBottom={noop} setstopFeeds={noop} stopFeeds={false} magicMode={false} setType={noop}
 instantCall={false} setinstantCall={noop} handleLoginSuccess={noop} handleLoginError={noop}/></CreationReferenceDraftProvider>;}
function Ledger(){const [currentInput,setCurrentInput]=useState(''),end=useRef(null);window.fixture.type=value=>setCurrentInput(value);window.fixture.renders++;
 return <BrainstormChat isAIEnabled={true} setIsAIEnabled={noop} chatHistory={[]} currentInput={currentInput} setCurrentInput={setCurrentInput}
 handleSendMessage={noop} handleUseMessage={noop} handleSaveMessage={noop} handleCloseBrainstorm={noop}
 manualName="" setManualName={noop} manualPrompt="" setManualPrompt={noop} handleManualUse={noop} handleManualSave={noop}
 chatEndRef={end} darkMode={true} appColor="#bd81db" appColorDeep="#9556ad" appColorHover="#bb8ad1" clikUrl="${origin}" ratioKey={1} onTemplateCreated={noop}/>;}
createRoot(document.getElementById('root')).render(<React.StrictMode><Provider store={store}><MemoryRouter initialEntries={[type===0?'/images':type===3?'/clikit':'/kickit']}>
 <Boundary>{q.get('view')==='ledger'?<Ledger/>:<Creation/>}</Boundary></MemoryRouter></Provider></React.StrictMode>);window.fixture.mounted=true;
`;

async function buildHtml() {
  // Decorative icons do not affect the lifecycle under test. Loading the icon
  // barrel otherwise scans thousands of modules before the browser can start.
  const iconIndex = fs.readFileSync(path.join(root, 'node_modules/@mui/icons-material/esm/index.js'), 'utf8');
  const iconNames = [...iconIndex.matchAll(/export\s*\{\s*default as (\w+)\s*\}/g)].map(match => match[1]);
  const iconMock = `import React from 'react';const Icon=React.forwardRef((props,ref)=>React.createElement('svg',{...props,ref,'aria-hidden':true}));export default Icon;export {${iconNames.map(name => `Icon as ${name}`).join(',')}};`;
  const result = await require('esbuild').build({
    stdin: { contents: fixture, resolveDir: root, loader: 'tsx' },
    bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    loader: { '.css': 'empty', '.png': 'dataurl', '.jpg': 'dataurl', '.jpeg': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.gif': 'dataurl', '.mp3': 'dataurl', '.mp4': 'dataurl' },
    define: { 'import.meta.env': '{}', 'import.meta.env.DEV': 'true', 'import.meta.env.VITE_APPX_STATE': '"dev"', 'import.meta.env.VITE_CLIK_URL': JSON.stringify(origin), 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'external-services-only', setup(build) {
      build.onResolve({ filter: /^@mui\/icons-material(?:\/.*)?$/ }, () => ({ path: 'fixture-icons', namespace: 'decorative-icons' }));
      build.onLoad({ filter: /.*/, namespace: 'decorative-icons' }, () => ({ contents: iconMock, loader: 'tsx', resolveDir: root }));
      build.onLoad({ filter: /[\\/]BrainstormSessionProvider\.tsx$/ }, () => ({ contents: sessionMock, loader: 'tsx' }));
      build.onResolve({ filter: /^@stripe\/stripe-js$/ }, () => ({ path: 'fixture-stripe', namespace: 'external-service-mock' }));
      build.onResolve({ filter: /^@react-oauth\/google$/ }, () => ({ path: 'fixture-oauth', namespace: 'external-service-mock' }));
      build.onLoad({ filter: /.*/, namespace: 'external-service-mock' }, args => ({ contents: args.path === 'fixture-stripe'
        ? 'export const loadStripe=async()=>null;'
        : 'export const useGoogleLogin=()=>()=>{};export const GoogleLogin=()=>null;export const GoogleOAuthProvider=({children})=>children;', loader: 'tsx' }));
    } }], logLevel: 'silent',
  });
  return '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#111}*,*::before,*::after{animation:none!important;transition:none!important}</style><div id="root"></div><script>'
    + result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>';
}

function largeLedger() {
  const records = Array.from({ length: 5000 }, (_, index) => ({ requestId: 'r' + index, route: '/startBrainstormStream',
    actionLabel: 'Recorded request ' + index, status: 'completed', elapsedMs: 1000, startedAt: '2026-10-28T00:00:00Z',
    events: [{ detail: { trace: 'Long diagnostic state. '.repeat(100) } }] }));
  return { ledger: { sessionId: 'large-ledger-fixture', startedAt: '2026-10-28', updatedAt: '2026-10-28', records,
    totalRecordCount: records.length, page: { offset: 0, limit: 25, total: records.length, hasMore: true },
    summary: { requestCount: records.length, providerCallCount: records.length, successfulRequests: records.length, failedRequests: 0,
      measuredWindowSeconds: 3600, totalCostUsd: 0.5, projectedOneHourCostUsd: 0.5, projectedRequestsPerHour: records.length, projectionStatus: 'measured',
      speedMs: { averageRequest: 1000, p50Request: 900, p95Request: 2000, averageTimeToFirstToken: 400, p95TimeToFirstToken: 800 },
      providerTotals: [], workloadTotals: [] } }, pricing: { sources: {} } };
}

function silentWav(seconds = 20) {
  const dataSize = 8000 * 2 * seconds, wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + dataSize, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(dataSize, 40);
  return wav;
}

(async () => {
  const out = path.join(root, '.tmp/concierge-execution'); fs.mkdirSync(out, { recursive: true });
  const phase = message => { console.log(message); fs.appendFileSync(path.join(out, 'entry-lifecycle-progress.log'), new Date().toISOString() + ' ' + message + '\n'); };
  const fixtureTimeout = setTimeout(() => { phase('FAIL isolated browser fixture exceeded five minutes'); process.exit(1); }, 300000);
  fixtureTimeout.unref();
  phase('Building isolated actual-component fixture (no Vite dependency scan)');
  const html = await buildHtml();
  phase(`Built isolated fixture: ${Buffer.byteLength(html)} bytes; launching headless browser`);
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  phase('Headless browser launched');
  const evidence = { cases: [], ledger: null, source: 'actual PromptInput + actual Storybook; all provider/network services intercepted' };
  try {
    const variants = [
      { type: 1, name: 'Cinema narrated' }, { type: 0, name: 'Shorts' },
      { type: 1, name: 'Cinema music', music: true },
      { type: 3, name: 'Games Hotspots', experience: 'hotspots' },
      { type: 3, name: 'Games Spatial', experience: 'spatial' },
    ];
    for (const width of [393, 1280]) for (const variant of variants) {
      const { type } = variant;
      const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 600,
        ...(width < 600 ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' } : {}) });
      const page = await context.newPage(), errors = [], requests = [], submittedBriefs = [];
      page.setDefaultTimeout(20000); page.on('pageerror', error => errors.push(error.message));
      let releasePlan;
      await page.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: html });
        if (url.pathname === '/fixture-music.wav') return route.fulfill({ contentType: 'audio/wav', body: silentWav() });
        if (request.resourceType() === 'image') return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"/>' });
        requests.push(url.pathname);
        const data = request.postDataJSON?.() || {};
        if (url.pathname === '/getPixels') return route.fulfill({ json: { pixels: 1000 } });
        if (url.pathname === '/callmusic') return route.fulfill({ json: { allsongs: [{ id: 71, name: 'Fixture music', song: origin + '/fixture-music.wav' }] } });
        if (['/startStory', '/startMemes', '/startInteractions'].includes(url.pathname)) {
          submittedBriefs.push(data);
          return route.fulfill({ json: { initialSteps: { keyPoints: Array.from({ length: data.sceneCount || 3 }, (_, index) => 'Astronaut voyage scene ' + (index + 1)) } } });
        }
        if (url.pathname === '/startPlan') {
          await new Promise(resolve => { releasePlan = resolve; });
          return route.fulfill({ json: { plan: { prompt_summary: 'Earth to Moon', scenes: [] } } });
        }
        if (url.pathname === '/intent-blueprint/compile-global') return route.fulfill({ json: { global: { title: 'Earth to Moon', overview: 'The requested voyage.', userGoal: data.prompt || '' }, sceneNotes: {} } });
        if (url.pathname === '/ImageDesignStoryStage') return route.fulfill({ json: { visualPromptStage1: 'Astronauts leave Earth.', visualPromptStage2: 'Astronauts travel through space.' } });
        if (url.pathname === '/ImageDesignStory') return route.fulfill({ json: { visualPrompt: 'Astronauts travel to the Moon.' } });
        if (/Bannana|flux|image/i.test(url.pathname)) return route.fulfill({ json: { imageUrl: image, url: image } });
        return route.fulfill({ json: {} });
      });
      try {
        phase(`Navigating actual entry ${variant.name} width=${width}, development StrictMode`);
        await page.goto(`${origin}/creation?type=${type}`, { waitUntil: 'domcontentloaded' });
        if (variant.music) {
          await page.locator('button[data-creation-control="clikb.creation.styles.control.music"]').click();
          await page.locator('button[data-creation-control="clikb.creation.music.control.select_71"]').click();
          await page.waitForFunction(() => window.fixture.store.getState().brainstorm.userSnapshot.creation.promptMusicTimingReady === true);
        }
        await page.locator('[data-creation-control="clikb.creation.setup.control.editor"]').first().click();
        const input = page.locator('textarea[data-creation-control="clikb.creation.notepad.control.prompt"]');
        const brief = `Create three ${type === 1 ? variant.music ? 'Cinema scenes with music' : 'Cinema scenes with narration' : type === 3 ? 'Games scenes' : 'Shorts images'} of astronauts travelling from Earth to the Moon. Stop at Publish.`;
        await input.fill(brief);
        await page.mouse.click(2, 2);
        await input.waitFor({ state: 'hidden' });
        await page.getByRole('button', { name: type === 1 ? 'Visualize' : 'Create', exact: true }).filter({ visible: true }).first().click();
        const go = page.locator('button[data-creation-control="clikb.creation.confirmation.control.go"]');
        await go.waitFor();
        assert.equal(submittedBriefs.length, 0, 'Review alone must not submit');
        const planRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/startPlan');
        await go.click();
        if (type === 3) await page.locator(`button[data-creation-control="clikb.creation.interaction.control.${variant.experience}"]`).click();
        await planRequest;
        await page.waitForFunction(() => window.fixture.store.getState().brainstorm.userSnapshot.creation.isActive);
        assert.equal(await page.locator('[data-creation-control="clikb.creation.storybook_grid.control.scroll_scenes"]').count(), 0, 'Storybook must wait for the real pending plan');
        while (!releasePlan) await new Promise(resolve => setTimeout(resolve, 10));
        releasePlan();
        await page.locator('[data-creation-control="clikb.creation.storybook_grid.control.scroll_scenes"]').waitFor({ state: 'attached' });
        await page.waitForTimeout(1200);
        assert.equal(await page.evaluate(() => window.fixture.error), null);
        assert.deepEqual(errors, []);
        assert.equal(submittedBriefs.length, 1);
        assert.ok(submittedBriefs[0].pp.includes(brief), 'Real Notepad draft must reach the original creation route');
        if (type === 3) assert.equal(submittedBriefs[0].interactionExperienceMode, variant.experience);
        assert.equal(requests.filter(url => url === '/startPlan').length, 1);
        const state = await page.evaluate(() => window.fixture.store.getState().brainstorm.userSnapshot.creation);
        evidence.cases.push({ width, type, mode: variant.name, strictMode: true, stage: state.stage,
          storybookMounted: true, startStoryRequests: 1, startPlanRequests: 1, pageErrors: errors });
        phase(`PASS actual golden prompt → setup → pending plan → Storybook: ${variant.name}, width ${width}, StrictMode`);
      } catch (error) {
        await page.screenshot({ path: path.join(out, `entry-failure-${type}-${width}.png`) });
        console.error('Page errors:', errors, 'Requests:', requests);
        throw error;
      } finally { releasePlan?.(); await context.close(); }
    }

    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message)); page.setDefaultTimeout(15000);
    await page.addInitScript(() => {
      window.largePayloadStringifications = 0; window.copiedLedger = '';
      const stringify = JSON.stringify;
      JSON.stringify = function (value, ...args) {
        if ((value?.ledger?.records || value?.records)?.length >= 1000) window.largePayloadStringifications++;
        return stringify.call(this, value, ...args);
      };
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.copiedLedger = text; } } });
    });
    const ledger = largeLedger(), ledgerBody = JSON.stringify(ledger); let ledgerRequests = 0;
    await page.route('**/*', route => {
      if (route.request().isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: html });
      if (new URL(route.request().url()).pathname === '/conversation-measurement') {
        ledgerRequests++;
        return route.fulfill({ contentType: 'application/json', body: ledgerBody });
      }
      return route.fulfill({ json: {} });
    });
    await page.goto(`${origin}/creation?view=ledger`, { waitUntil: 'domcontentloaded' });
    for (let cycle = 0; cycle < 4; cycle++) {
      await page.getByRole('button', { name: 'Open conversation cost ledger', exact: true }).click();
      await page.getByText('Measured cost', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Refresh', exact: true }).click();
      await page.getByRole('button', { name: 'Copy report', exact: true }).waitFor({ state: 'visible' });
      await page.getByRole('button', { name: 'Copy report', exact: true }).click();
      assert.ok(await page.evaluate(() => window.copiedLedger.length < 50000 && window.copiedLedger.includes('ClikB Conversation Cost Ledger')));
      await page.evaluate(async cycle => { for (let n = 0; n < 20; n++) { window.fixture.type(`cycle ${cycle} input ${n}`); await new Promise(resolve => setTimeout(resolve, 50)); } }, cycle);
      await page.getByRole('button', { name: 'Close ledger', exact: true }).click();
      await page.getByRole('button', { name: 'Close ledger', exact: true }).waitFor({ state: 'hidden' });
    }
    assert.equal(await page.evaluate(() => window.largePayloadStringifications), 0);
    assert.deepEqual(errors, []);
    evidence.ledger = { payloadBytes: Buffer.byteLength(ledgerBody), records: ledger.ledger.records.length,
      cycles: 4, ledgerRequests, reRenders: await page.evaluate(() => window.fixture.renders),
      wholePayloadRenderStringifications: 0, pageErrors: errors };
    console.log('PASS sustained actual ledger: 5000 verbose records, repeated open/refresh/copy/close and input renders; no whole-payload JSON stringify');
    await context.close();
    fs.writeFileSync(path.join(out, 'cinema-entry-ledger-results.json'), JSON.stringify(evidence, null, 2) + '\n');
  } finally { await browser.close(); clearTimeout(fixtureTimeout); }
})().catch(error => { console.error(error); process.exitCode = 1; });
