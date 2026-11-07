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
import {setPixels,setNotepadPreviewActive,dismissAppIntro,setPromptRed,setThemePreference,setDeckEnabled,setAutoControl,setAutoControlVisible,setConciergeEnabled} from './src/settingsSlice';
import {observeCurrentAppSnapshot,handleNavigationBrowserRequest} from './src/navigationBrowserControl';
import {creationExecutionContext} from './server/src/creationControlIdentity';
import PromptInput from './src/PromptInput';
import {CreationReferenceDraftProvider,useCreationReferenceDraftState} from './src/CreationReferenceDraftContext';
const noop=()=>{};const q=new URLSearchParams(location.search),type=Number(q.get('type')||1);
store.dispatch(setLoggedUser({id:3,username:'Fixture',image:''}));store.dispatch(setPixels(1000));
store.dispatch(setNotepadPreviewActive(false));store.dispatch(dismissAppIntro());store.dispatch(setPromptRed(''));
store.dispatch(setThemePreference('dark'));
store.dispatch(setDeckEnabled(q.get('deck') !== 'off'));
window.fixture={store,mounted:false,error:null,stacks:[],renders:0};
const originalFetch=window.fetch.bind(window);
window.fetch=async(url,options)=>{if(String(url).endsWith('/navigation/browser-reply')){window.fixture.reply=JSON.parse(options.body).reply;return Response.json({ok:true});}return originalFetch(url,options);};
window.fixture.observe=observeCurrentAppSnapshot;
window.fixture.runControl=async (actionId,command='action',direction)=>{
 const previous=store.getState().settings;
 store.dispatch(setConciergeEnabled(true));store.dispatch(setAutoControlVisible({visible:true,actor:'user'}));store.dispatch(setAutoControl({enabled:true,actor:'user'}));
 try{const snapshot=observeCurrentAppSnapshot();await handleNavigationBrowserRequest({command,requestId:String(Math.random()),...(command==='scroll'?{scrollId:actionId,direction}:{actionId}),
 expectedCreationContext:creationExecutionContext(snapshot,actionId,command==='action'?'click':command),expectedVersion:snapshot.creation.controls?.stateVersion},'http://fixture.test');return window.fixture.reply;}
 finally{store.dispatch(setAutoControl({enabled:previous.autoControlEnabled,actor:'user'}));store.dispatch(setAutoControlVisible({visible:previous.autoControlVisible,actor:'user'}));store.dispatch(setConciergeEnabled(previous.conciergeEnabled));}
};
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
createRoot(document.getElementById('root')).render(<React.StrictMode><Provider store={store}><MemoryRouter initialEntries={[type===0?'/images':type===3?'/clikit':'/kickit']}>
 <Boundary><Creation/></Boundary></MemoryRouter></Provider></React.StrictMode>);window.fixture.mounted=true;
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
                    build.onResolve({ filter: /^@mui\/icons-material(?:\/.*)?$/ }, args => args.path === '@mui/icons-material/ViewCarouselOutlined'
                        ? undefined : ({ path: 'fixture-icons', namespace: 'decorative-icons' }));
                    build.onLoad({ filter: /.*/, namespace: 'decorative-icons' }, () => ({ contents: iconMock, loader: 'tsx', resolveDir: root }));
                    build.onLoad({ filter: /[\\/]BrainstormSessionProvider\.tsx$/ }, () => ({ contents: sessionMock, loader: 'tsx' }));
                    build.onResolve({ filter: /^@stripe\/stripe-js$/ }, () => ({ path: 'fixture-stripe', namespace: 'external-service-mock' }));
                    build.onResolve({ filter: /^@react-oauth\/google$/ }, () => ({ path: 'fixture-oauth', namespace: 'external-service-mock' }));
                    build.onLoad({ filter: /.*/, namespace: 'external-service-mock' }, args => ({ contents: args.path === 'fixture-stripe'
                            ? 'export const loadStripe=async()=>null;'
                            : 'export const useGoogleLogin=()=>()=>{};export const GoogleLogin=()=>null;export const GoogleOAuthProvider=({children})=>children;', loader: 'tsx' }));
                } }], logLevel: 'silent',
    });
    return '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;width:100%;background:#111}*,*::before,*::after{animation:none!important;transition:none!important}</style><div id="root"></div><script>'
        + result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>';
}
async function waitForRelease(read, label) {
    const until = Date.now() + 20000;
    while (!read() && Date.now() < until)
        await new Promise(resolve => setTimeout(resolve, 10));
    assert.ok(read(), 'Timed out waiting for ' + label);
}
async function assertRoundReopen(button) {
    await button.waitFor();
    const shape = await button.evaluate(node => {
        const box = node.getBoundingClientRect();
        return { width: box.width, height: box.height, position: getComputedStyle(node).position };
    });
    assert.equal(shape.width, shape.height, 'Deck toggle stays circular');
    assert.ok(shape.width <= 40 && shape.width >= 32, 'Deck toggle matches the small native hint controls');
    assert.notEqual(shape.position, 'fixed', 'Reopen belongs to its native stage row');
}
async function runControl(page, button) {
    await button.scrollIntoViewIfNeeded();
    const id=await button.getAttribute('data-ai-action');
    const reply=await page.evaluate(id=>window.fixture.runControl(id),id);
    assert.equal(reply.status,'dispatched',JSON.stringify(reply));
}
async function startDeckHandoff(page) {
    await page.evaluate(()=>{
        window.deckHandoffFrames=[];window.auditDeckHandoff=true;
        const frame=()=>{if(!window.auditDeckHandoff)return;if(!document.querySelector('.creation-deck'))window.deckHandoffFrames.push(performance.now());requestAnimationFrame(frame);};requestAnimationFrame(frame);
    });
}
async function finishDeckHandoff(page, label) {
    assert.deepEqual(await page.evaluate(()=>{window.auditDeckHandoff=false;return window.deckHandoffFrames;}),[],label+' has no exposed native frame');
}
(async () => {
    const css = ['DeckOverlay.css', 'CreationDeck.css'].map(name => fs.readFileSync(path.join(root, 'src', name), 'utf8')).join('\n');
    console.log('Building actual PromptInput fixture');
    const html = (await buildHtml()).replace('<style>', '<style>' + css);
    const browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    try {
        for (const { width, height = 900, extended, deckEnabled, skip, nativeSkip, rejectBalance, referenceFailure } of [
            { width: 1280, deckEnabled: true, skip: false },
            { width: 393, deckEnabled: true, skip: false },
            { width: 393, height: 600, extended: true, deckEnabled: true, skip: false },
            { width: 1280, deckEnabled: true, skip: false, referenceFailure: true },
            { width: 1280, deckEnabled: true, skip: true },
            { width: 1280, deckEnabled: true, skip: true, nativeSkip: true },
            { width: 1280, deckEnabled: false, skip: true },
            { width: 1280, deckEnabled: true, rejectBalance: true },
        ]) {
            const scenes = extended ? Array.from({length:12},(_,i)=>`Astronaut Ada surveys destination ${i+1} and records the landscape from her vehicle.`) : ['Astronaut Ada leaves Earth.', 'Astronaut Ada visits the Moon.'];
            const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 600, ...(width < 600 ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' } : {}) }), page = await context.newPage(), errors = [], requests = [];
            page.setDefaultTimeout(22000);
            page.on('pageerror', error => errors.push(error.message));
            let releasePlan, releaseAudit, releaseBalance, releaseStory, releaseReferenceImage, releaseDetection, holdBalance = false;
            let holdManualDetection = false;
            let holdDesign = deckEnabled;
            const releaseDesign = [];
            await page.route('**/*', async (route) => {
                const request = route.request(), url = new URL(request.url());
                if (request.isNavigationRequest())
                    return route.fulfill({ contentType: 'text/html', body: html });
                if (request.resourceType() === 'image')
                    return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"/>' });
                const data = request.postDataJSON?.() || {};
                requests.push(url.pathname);
                if (url.pathname === '/getPixels') {
                    const checkingBalance = holdBalance;
                    if (checkingBalance) {
                        holdBalance = false;
                        await new Promise(resolve => releaseBalance = resolve);
                    }
                    return route.fulfill({ json: { pixels: checkingBalance && rejectBalance ? 0 : 1000 } });
                }
                if (url.pathname === '/startStory') {
                    await new Promise(resolve => releaseStory = resolve);
                    return route.fulfill({ json: { initialSteps: { keyPoints: scenes } } });
                }
                if (url.pathname === '/startPlan') {
                    await new Promise(resolve => releasePlan = resolve);
                    return route.fulfill({ json: { plan: { prompt_summary: 'Earth to Moon', scenes: [] } } });
                }
                if (url.pathname === '/intent-blueprint/compile-global')
                    return route.fulfill({ json: { global: { title: 'Earth to Moon', overview: 'The requested voyage.', userGoal: data.prompt || '' }, sceneNotes: {} } });
                if (holdDesign && /^\/ImageDesignStory/.test(url.pathname))
                    await new Promise(resolve => releaseDesign.push(resolve));
                if (url.pathname === '/ImageDesignStoryStage')
                    return route.fulfill({ json: { visualPromptStage1: 'Astronaut Ada leaves Earth.', visualPromptStage2: 'Astronaut Ada travels through space.' } });
                if (url.pathname === '/ImageDesignStory')
                    return route.fulfill({ json: { visualPrompt: 'Astronaut Ada travels to the Moon.' } });
                if (url.pathname === '/extractCasting') {
                    if (!data.auditOnly && holdManualDetection)
                        await new Promise(resolve => releaseDetection = resolve);
                    if (data.auditOnly)
                        await new Promise(resolve => releaseAudit = resolve);
                    return route.fulfill({ json: { data: { characters: [{ name: 'Ada', description: 'An astronaut in white gear' }, ...(extended ? [{name:'Bea',description:'A pilot in blue gear'}] : [])], environments: [] } } });
                }
                if (url.pathname === '/generateCastingPrompts')
                    return route.fulfill({ json: { prompts: [{ name: 'Ada', type: 'character', imagePrompt: 'Astronaut Ada in white gear.' }] } });
                if (referenceFailure && data.billingAction === 'character-image') {
                    await new Promise(resolve => releaseReferenceImage = resolve);
                    return route.fulfill({ status: 500, json: { message: 'Fixture character image failed' } });
                }
                if (/Bannana|flux|image/i.test(url.pathname))
                    return route.fulfill({ json: { imageUrl: image, url: image } });
                return route.fulfill({ json: {} });
            });
            try {
                console.log(`Testing width=${width}, Deck=${deckEnabled ? 'On' : 'Off'}, path=${skip ? 'Skip' : 'Characters'}`);
                await page.goto(origin + '/creation?type=1&deck=' + (deckEnabled ? 'on' : 'off'));
                assert.equal(await page.locator('.creation-deck').count(), 0, 'Initial composer keeps its native presentation');
                assert.equal(await page.getByRole('button', { name: 'Open Creation Deck', exact: true }).count(), 0);
                await page.locator('[data-creation-control="clikb.creation.setup.control.editor"]').filter({ visible: true }).first().click();
                const prompt = page.locator('textarea[data-creation-control="clikb.creation.notepad.control.prompt"]');
                await prompt.fill('Create three Cinema scenes of astronaut Ada travelling from Earth to the Moon.');
                await page.mouse.click(2, 2);
                await prompt.waitFor({ state: 'hidden' });
                await page.getByRole('button', { name: 'Visualize', exact: true }).filter({ visible: true }).first().click();
                assert.equal(await page.locator('.creation-deck').count(), 0, 'Setup review does not start Deck');
                await page.evaluate(() => {
                    window.deckStarts = 0;
                    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
                        if (node.nodeType === 1 && (node.matches('.creation-deck') || node.querySelector('.creation-deck'))) window.deckStarts++;
                    }))).observe(document.body, { childList: true, subtree: true });
                });
                holdBalance = true;
                await page.locator('[data-creation-control="clikb.creation.confirmation.control.go"]').click();
                const deck = page.locator('.creation-deck');
                await waitForRelease(() => releaseBalance, 'the balance check');
                assert.equal(await deck.count(), 0, 'Balance checking is before Using imagination');
                assert.equal(await page.evaluate(() => window.deckStarts), 0);
                releaseBalance();
                if (rejectBalance) {
                    await page.getByText(/This generation needs at least/).first().waitFor();
                    assert.equal(await deck.count(), 0);
                    assert.equal(await page.getByRole('button', { name: 'Open Creation Deck', exact: true }).count(), 0);
                    assert.equal(await page.evaluate(() => window.deckStarts), 0, 'Rejected balance never flashes Deck');
                    assert.equal(requests.filter(url => url === '/startStory').length, 0);
                    assert.deepEqual(errors, []);
                    console.log('PASS rejected balance leaves composer visible without starting Deck');
                    continue;
                }
                await waitForRelease(() => releaseStory, 'the first story response');
                assert.equal(await deck.count(), 0, 'Native progress stays visible while the first response is pending');
                releaseStory();
                if (!deckEnabled) {
                    await waitForRelease(() => releasePlan, 'the plan request');
                    releasePlan();
                    const nativeSkip = page.locator('[data-creation-control="clikb.creation.preview_choice.control.skip"]');
                    await nativeSkip.waitFor();
                    assert.equal(await deck.count(), 0);
                    await nativeSkip.click();
                    await page.locator('[data-creation-control="clikb.creation.storybook_grid.control.scroll_scenes"]').waitFor();
                    assert.equal(await deck.count(), 0);
                    assert.deepEqual(errors, []);
                    assert.equal(requests.filter(url => url === '/startStory').length, 1);
                    console.log('PASS actual PromptInput Deck Off direct preview Skip → native Storyboard');
                    continue;
                }
                await waitForRelease(() => releasePlan, 'the plan request');
                assert.equal(await deck.count(), 0, 'Plan writing stays in the native composer');
                assert.equal(await page.evaluate(() => window.deckStarts), 0, 'Deck does not flash during plan writing');
                releasePlan();
                await waitForRelease(() => releaseDesign[0], 'the first scene design request');
                await deck.locator('.deck-category').filter({ hasText: 'Using imagination' }).waitFor();
                await deck.locator('.deck-category').click();
                const imaginationMenu = deck.locator('.creation-deck-menu');
                assert.equal(await imaginationMenu.getByRole('button', { name: /Models|Characters|Scenes|Restart|understood/i }).count(), 0);
                await imaginationMenu.getByRole('button', { name: 'Exit creation', exact: true }).waitFor();
                assert.equal(await imaginationMenu.locator('button').last().innerText(), 'Exit creation');
                assert.equal(await imaginationMenu.locator('button:disabled').count(), 0);
                await page.screenshot({ path: path.join(root, '.tmp', `creation-deck-followup-imagination-${width}.png`) });
                await deck.locator('.deck-category').click();
                await deck.locator('.creation-deck-stage').click({position:{x:5,y:5}});
                await deck.waitFor({ state: 'hidden' });
                const imaginationReopen = page.getByRole('button', { name: 'Open Creation Deck', exact: true });
                await assertRoundReopen(imaginationReopen);
                if (!skip) {
                    await imaginationReopen.click();
                    await deck.waitFor();
                }
                assert.equal(requests.filter(url => url === '/startStory').length, 1);
                const imaginationMounts = await page.evaluate(() => window.deckStarts);
                if (!skip) await startDeckHandoff(page);
                holdDesign = false;
                releaseDesign.forEach(resolve => resolve());
                if (skip) {
                    assert.equal(await deck.count(), 0, 'Storyboard Deck stays closed while previews are being prepared');
                    const nativeProceed = page.locator('[data-creation-control="clikb.creation.preview_choice.control.skip"]');
                    await nativeProceed.waitFor();
                    if (nativeSkip) {
                        await nativeProceed.click();
                        await page.locator('[data-creation-control="clikb.creation.storybook_grid.control.scroll_scenes"]').waitFor();
                        assert.equal(await deck.count(), 0, 'Native Proceed keeps the Storyboard Grid even with Deck enabled');
                        await page.locator('[data-creation-control="clikb.creation.character_entry.control.open"]').filter({ visible: true }).click();
                        const scenesClose = page.locator('[data-creation-control="clikb.creation.character_scenes.control.close"]').filter({ visible: true });
                        if (await scenesClose.count()) await scenesClose.click();
                        await page.getByRole('button', { name: 'Open Creation Deck', exact: true }).click();
                        const idleCharacterBottom = deck.locator('.creation-deck-card-bottom');
                        await idleCharacterBottom.getByRole('button', { name: 'FIND CHARACTERS', exact: true }).waitFor();
                        assert.equal(await deck.getByText('Analyzing script & matching actors...', { exact: true }).count(), 0);
                        assert.equal(await deck.getByRole('textbox', { name: 'Character detection instruction' }).getAttribute('placeholder'), 'e.g. Extract all locations as well');
                        assert.equal(requests.filter(url => url === '/extractCasting').length, 0, 'Reopening idle Characters does not detect until requested');
                        holdManualDetection = true;
                        await idleCharacterBottom.getByRole('button', { name: 'FIND CHARACTERS', exact: true }).click();
                        await waitForRelease(() => releaseDetection, 'manual character detection');
                        const detectionHelper = 'The model is reading the story scenes and extracting only reusable characters, creatures, environments, vehicles, and important props for consistent references.';
                        await idleCharacterBottom.getByRole('progressbar').waitFor();
                        await idleCharacterBottom.getByText(detectionHelper, { exact: true }).waitFor();
                        await deck.locator('.deck-close').click();
                        await deck.waitFor({ state: 'hidden' });
                        await page.getByText(detectionHelper, { exact: true }).filter({ visible: true }).waitFor();
                        await page.getByRole('button', { name: 'Open Creation Deck', exact: true }).click();
                        await idleCharacterBottom.getByText(detectionHelper, { exact: true }).waitFor();
                        releaseDetection();
                        await waitForRelease(() => releaseAudit, 'manual character audit');
                        await idleCharacterBottom.getByRole('button', { name: 'Use This', exact: true }).click();
                        releaseAudit();
                        await idleCharacterBottom.getByRole('button', { name: 'Close Characters', exact: true }).click();
                        assert.deepEqual(errors, []);
                        console.log('PASS native Preview → Proceed keeps Storyboard Grid with Deck On');
                        continue;
                    }
                    await page.getByRole('button', { name: 'Open Creation Deck', exact: true }).click();
                }
                await deck.locator('.deck-category').filter({ hasText: 'Scene previews' }).waitFor();
                if (!skip) assert.equal(await page.evaluate(() => window.deckStarts), imaginationMounts, 'Imagination Deck stays mounted through the preview handoff');
                if (!skip) await finishDeckHandoff(page,'Imagination → preview');
                assert.equal(await deck.locator('.creation-deck-card').count(), Math.min(scenes.length,2), 'Only available neighboring cards render without loading placeholders');
                assert.deepEqual(await deck.locator('.creation-deck-footer .creation-deck-split button').allTextContents(), ['Characters', 'Proceed']);
                await page.screenshot({ path: path.join(root, '.tmp', `creation-deck-followup-preview-${width}.png`) });
                await deck.locator('.deck-close').click();
                await deck.waitFor({ state: 'hidden' });
                const previewReopen = page.getByRole('button', { name: 'Open Creation Deck', exact: true });
                await assertRoundReopen(previewReopen);
                assert.equal(await previewReopen.evaluate(node => Boolean(node.parentElement.querySelector('[data-creation-control="clikb.creation.preview_choice.control.plan_edit"]'))), true, 'Preview toggle shares the native plan-edit row');
                const planBounds = await page.locator('[data-creation-control="clikb.creation.preview_choice.control.plan_edit"]').boundingBox();
                const previewToggleBounds = await previewReopen.boundingBox();
                assert.ok(previewToggleBounds.x + previewToggleBounds.width <= planBounds.x, 'Preview Deck toggle sits left of the edit field');
                await page.screenshot({ path: path.join(root, '.tmp', `creation-deck-followup-native-preview-${width}.png`) });
                await previewReopen.click();
                await deck.waitFor();
                const balance = deck.getByRole('button', { name: /Pixels\. Open Pixel Vault/ });
                const selectorBounds = await deck.locator('.creation-deck-selector').boundingBox();
                const balanceBounds = await balance.boundingBox();
                assert.ok(Math.abs(selectorBounds.height - balanceBounds.height) < 1 && balanceBounds.x > selectorBounds.x + selectorBounds.width);
                await balance.click();
                const vault = page.getByRole('dialog', { name: 'Pixel Vault' });
                await vault.getByText('Affordable Plans', { exact: true }).waitFor();
                await page.keyboard.press('Escape');
                await vault.waitFor({ state: 'hidden' });
                assert.equal(await deck.locator('.creation-deck-selector-label').textContent(), 'Scene previews');
                await deck.locator('.deck-category').click();
                const modelMenuEntry = deck.locator('.creation-deck-menu [data-creation-control="clikb.creation.storybook_toolbar.control.open_models"]');
                assert.doesNotMatch(await modelMenuEntry.innerText(), /^Models/);
                await modelMenuEntry.click();
                const models = page.locator('[data-creation-control="clikb.creation.models.control.scroll"]');
                await models.waitFor();
                await models.getByRole('button', { name: 'About AI prompt costs' }).click();
                const cost = page.locator('.MuiDialog-paper[role="dialog"]');
                await cost.waitFor();
                assert.ok(await cost.evaluate(node => Number(getComputedStyle(node.closest('.MuiModal-root')).zIndex)) > 1000002);
                await cost.getByRole('button', { name: 'Close', exact: true }).click();
                await cost.waitFor({ state: 'hidden' });
                await page.locator('[data-creation-control="clikb.creation.models.control.dismiss"]').click({ position: { x: 3, y: 3 } });
                await models.waitFor({ state: 'hidden' });
                await deck.locator('.creation-deck-card-open').click({ position: { x: 20, y: 20 } });
                await deck.locator('.creation-deck-detail .creation-deck-scene-detail--media').waitFor();
                assert.equal(await deck.locator('.creation-deck-detail-side .creation-deck-scene-detail--media').count(), 1, 'Neighboring preview card stays browsable with clean detail');
                await deck.locator('.creation-deck-detail .creation-deck-scene-detail--media').click();
                await deck.locator('.creation-deck-detail .creation-deck-scene-detail--expanded').waitFor();
                await deck.locator('.creation-deck-stage').press('ArrowRight');
                assert.equal(await deck.getAttribute('data-creation-deck-scene'), '1', 'Browsing across cards works while scene text is open');
                await deck.locator('.creation-deck-stage').press('ArrowLeft');
                await deck.getByRole('button', { name: 'Close details', exact: true }).click();
                await deck.locator('.creation-deck-detail').waitFor({ state: 'hidden' });
                console.log('Models and cost layering passed');
                if (skip) {
                    await startDeckHandoff(page);
                    await deck.getByRole('button', { name: 'Proceed', exact: true }).click();
                    await deck.locator('.deck-category').filter({ hasText: 'Storyboard' }).waitFor();
                    await finishDeckHandoff(page,'Preview → Storyboard');
                    assert.equal(requests.filter(url => url === '/extractCasting').length, 0);
                    await deck.locator('.deck-category').click();
                    await deck.getByRole('button', { name: 'Characters', exact: true }).click();
                    await deck.locator('.deck-category').filter({ hasText: 'Characters' }).waitFor();
                    assert.equal(await deck.locator('.creation-deck-detail').count(), 0, 'Idle Characters opens its reference card');
                    assert.equal(await deck.getByText('Analyzing script & matching actors...', { exact: true }).count(), 0, 'Idle Character Studio shows no invented detection status');
                    assert.equal(await deck.getByRole('textbox', { name: 'Character detection instruction' }).getAttribute('placeholder'), 'e.g. Extract all locations as well');
                    const idleActions = deck.locator('.creation-deck-card-bottom');
                    await idleActions.getByRole('button', { name: 'FIND CHARACTERS', exact: true }).waitFor();
                    await page.screenshot({ path: path.join(root, '.tmp', `creation-deck-characters-idle-${width}.png`) });
                    await idleActions.getByRole('button', { name: 'Close Characters', exact: true }).click();
                    assert.deepEqual(errors, []);
                    console.log('PASS reopened Deck preview Proceed → Storyboard Deck without casting');
                    continue;
                }
                await deck.getByRole('button', { name: 'Characters', exact: true }).click();
                await deck.locator('.deck-category').filter({ hasText: 'Characters' }).waitFor();
                await waitForRelease(() => releaseAudit, 'the casting audit');
                const characterBottom = deck.locator('.creation-deck-card-bottom');
                await characterBottom.getByRole('status').filter({ hasText: 'Auditing results' }).waitFor();
                const characterSnapshot=await page.evaluate(()=>window.fixture.store.getState().brainstorm.userSnapshot.creation);
                assert.equal(characterSnapshot.stage,'character_creation_step_02_auditing_use_step_01_available','Character Studio reports its actual audit stage');
                assert.match(characterSnapshot.status,/Auditing/,'Character Studio owns the live generation status');
                assert.equal(await deck.locator('.creation-deck-detail').count(), 0, 'Character entry does not open the scenes list over its card');
                assert.equal(await deck.getByRole('textbox', { name: 'Character detection instruction' }).getAttribute('placeholder'), 'e.g. Extract all locations as well');
                await characterBottom.locator('[aria-label="Detected references"]').getByText('Ada', { exact: true }).waitFor();
                await characterBottom.getByRole('button', { name: 'Use This', exact: true }).waitFor();
                await characterBottom.getByRole('button', { name: 'Close Characters', exact: true }).waitFor();
                if (extended) {
                    for (const name of ['Close Characters','Use This']) {
                        assert.equal(await characterBottom.getByRole('button',{name,exact:true}).evaluate(node=>{
                            const rect=node.getBoundingClientRect(),card=node.closest('.creation-deck-card').getBoundingClientRect();
                            return rect.top>=card.top&&rect.bottom<=card.bottom;
                        }),true,name+' is visible in the short card without scrolling to the action');
                    }
                    await page.screenshot({path:path.join(root,'.tmp','creation-deck-character-audit-short-393x600.png')});
                }
                const countBinding = key => deck.locator(`[data-creation-control="clikb.creation.character_studio.control.${key}"]`).count();
                assert.equal(await countBinding('close'), 1, 'Character Close has one visible Deck binding');
                assert.equal(await countBinding('use_step_one'), 1, 'First-pass action has one visible Deck binding');
                await page.screenshot({ path: path.join(root, '.tmp', `creation-deck-characters-audit-${width}.png`) });
                await deck.locator('.deck-category').click();
                assert.equal(await deck.getByRole('button', { name: 'Detect', exact: true }).count(), 0, 'Detection restart is unavailable during audit');
                await deck.locator('.deck-category').click();
                await deck.locator('.deck-close').click();
                await deck.waitFor({ state: 'hidden' });
                const charactersReopen = page.getByRole('button', { name: 'Open Creation Deck', exact: true });
                await assertRoundReopen(charactersReopen);
                assert.equal(await charactersReopen.evaluate(node => node.parentElement.textContent.includes('Character & Environment References')), true, 'Characters toggle shares the native reference heading');
                const headingBounds = await page.getByText('Character & Environment References', { exact: true }).boundingBox();
                const charactersToggleBounds = await charactersReopen.boundingBox();
                assert.ok(charactersToggleBounds.x + charactersToggleBounds.width <= headingBounds.x, 'Characters Deck toggle sits left of its heading');
                await page.screenshot({ path: path.join(root, '.tmp', `creation-deck-followup-native-characters-${width}.png`) });
                await runControl(page,page.locator('[data-creation-control^="clikb.creation.character_studio.control.reference_"]').filter({ visible: true }).first());
                const nativeEditor = page.locator('[data-creation-control="clikb.creation.reference_editor.control.controls_scroll"]');
                await nativeEditor.waitFor();
                await runControl(page,page.locator('[data-creation-control="clikb.creation.reference_editor.control.close"]'));
                await nativeEditor.waitFor({ state: 'hidden' });
                await page.getByRole('button', { name: 'Open Creation Deck', exact: true }).click();
                await deck.waitFor();
                assert.equal(requests.filter(url => url === '/extractCasting').length, 2);
                releaseAudit();
                await deck.getByRole('status').filter({ hasText: 'Casting Complete! Found Characters.' }).waitFor();
                const activeCard = deck.locator('.deck-card--active');
                const cardBounds = await activeCard.boundingBox();
                const cardKey = await deck.getAttribute('data-creation-deck-scene');
                const cardView = await deck.getAttribute('data-creation-deck-view');
                const remove = activeCard.getByRole('button', { name: 'Remove Ada', exact: true });
                await remove.waitFor();
                assert.equal(await remove.locator('svg').count(), 1, 'Active reference exposes its trash affordance');
                const removeBounds = await remove.boundingBox();
                assert.ok(removeBounds.x > cardBounds.x + cardBounds.width / 2 && removeBounds.y < cardBounds.y + 24, 'Remove sits at the card top-right');
                const characterButtons = characterBottom.locator('.creation-deck-character-button');
                const buttonStyles = await characterButtons.evaluateAll(buttons => buttons.map(button => {
                    const style = getComputedStyle(button);
                    return ['fontSize', 'fontWeight', 'letterSpacing', 'paddingTop', 'paddingLeft', 'backgroundColor', 'borderTopColor', 'borderTopWidth', 'borderRadius', 'boxShadow']
                        .map(key => style[key]);
                }));
                assert.equal(buttonStyles.length, 3);
                assert.deepEqual(buttonStyles[0], buttonStyles[1], 'Close and Detect match the Generate Images appearance');
                assert.deepEqual(buttonStyles[1], buttonStyles[2], 'All bottom actions share the same pill appearance');
                await remove.click();
                const removal = deck.getByRole('group', { name: 'Remove Ada', exact: true });
                await removal.waitFor();
                const removalCardBounds = await activeCard.boundingBox();
                assert.equal(removalCardBounds.width, cardBounds.width, 'Opening removal keeps the active card width');
                assert.equal(removalCardBounds.height, cardBounds.height, 'Opening removal keeps the active card height');
                await removal.getByRole('button', { name: 'No', exact: true }).click();
                await removal.waitFor({ state: 'hidden' });
                assert.equal(await deck.getAttribute('data-creation-deck-scene'), cardKey);
                assert.equal(await deck.getAttribute('data-creation-deck-view'), cardView);
                assert.deepEqual(await activeCard.boundingBox(), cardBounds, 'Cancel removal preserves the active card');
                if (referenceFailure) {
                    await characterBottom.getByRole('button', { name: 'GENERATE IMAGES', exact: true }).click();
                    await waitForRelease(() => releaseReferenceImage, 'the character image request');
                    await characterBottom.getByText('The app is preparing and generating the selected reference images. You can hide this panel and return without starting a duplicate run.', { exact: true }).waitFor();
                    await characterBottom.getByRole('progressbar').waitFor();
                    releaseReferenceImage();
                    await characterBottom.getByRole('status').filter({ hasText: 'Finished with errors: 1 failed.' }).waitFor();
                    await characterBottom.getByRole('button', { name: 'GENERATE IMAGES', exact: true }).waitFor();
                    assert.equal(await activeCard.getByText('Generating reference…', { exact: true }).count(), 0, 'Failed reference leaves its loading state and exposes retry');
                    await page.screenshot({ path: path.join(root, '.tmp', `creation-deck-characters-failed-${width}.png`) });
                    await characterBottom.getByRole('button', { name: 'Close Characters', exact: true }).click();
                    assert.deepEqual(errors, []);
                    console.log('PASS actual Character Deck generation feedback, failure cleanup and retry action');
                    continue;
                }
                await runControl(page,deck.getByRole('button', { name: 'Open Ada in workstation' }));
                const editor = page.locator('[data-creation-control="clikb.creation.reference_editor.control.controls_scroll"]');
                await editor.waitFor();
                assert.ok(await editor.evaluate(node => Number(getComputedStyle(node.closest('.MuiModal-root')).zIndex)) > 1000000);
                await runControl(page,page.locator('[data-creation-control="clikb.creation.reference_editor.control.close"]'));
                await editor.waitFor({ state: 'hidden' });
                if (extended) {
                    await runControl(page,deck.locator('[data-creation-control="clikb.creation.deck_view.control.settings"]'));
                    await runControl(page,deck.locator('.creation-deck-menu [data-creation-control="clikb.creation.deck_view.control.toggle_mode"]'));
                    const next=deck.locator('[data-creation-control="clikb.creation.deck_view.control.next_card"]');
                    await runControl(page,next);
                    assert.equal((await page.evaluate(()=>window.fixture.observe().creation.controls.areas['clikb.creation.deck_view'])).state.centeredCardTitle,'Bea');
                    await runControl(page,deck.getByRole('button',{name:'Open Bea in workstation',exact:true}));
                    await nativeEditor.waitFor();
                    assert.equal((await page.evaluate(()=>window.fixture.observe().creation.controls.areas['clikb.creation.reference_editor'])).state.name,'Bea');
                    await runControl(page,page.locator('[data-creation-control="clikb.creation.reference_editor.control.close"]'));
                    await nativeEditor.waitFor({state:'hidden'});
                    await runControl(page,deck.locator('[data-creation-control="clikb.creation.deck_view.control.previous_card"]'));
                    await runControl(page,deck.locator('[data-creation-control="clikb.creation.deck_view.control.settings"]'));
                    await runControl(page,deck.locator('.creation-deck-menu [data-creation-control="clikb.creation.deck_view.control.toggle_mode"]'));
                    assert.equal(await deck.getAttribute('data-creation-deck-view'),'clean');
                    assert.ok((await page.evaluate(()=>window.fixture.observe().creation.controls.areas['clikb.creation.deck_view'])).controls.some(item=>item.actionId.endsWith('.toggle_mode')),'Clean character card exposes its mode toggle above the action panel');
                }
                await deck.locator('.deck-category').click();
                await deck.getByRole('button', { name: 'Rename Ada', exact: true }).click();
                const rename = page.locator('[data-creation-control="clikb.creation.character_rename.control.name"]');
                await rename.waitFor();
                await rename.fill('Ada Prime');
                await page.locator('[data-creation-control="clikb.creation.character_rename.control.save"]').click();
                await rename.waitFor({ state: 'hidden' });
                await deck.locator('.deck-category').click();
                await deck.getByRole('button', { name: 'Scenes and golden prompt', exact: true }).click();
                if (extended) {
                    const scrollId='clikb.creation.character_scenes.action.scroll';
                    const read=()=>page.evaluate(()=>window.fixture.observe().creation.controls.areas['clikb.creation.character_scenes']);
                    let area=await read();
                    assert.equal(area.controls.find(item=>item.actionId===scrollId)?.canScrollForward,true,'Deck publishes the actual scene-list scroll owner');
                    assert.equal(area.controls.some(item=>item.controlId.endsWith('.scene_12')),false,'Distant scene starts outside the current viewport');
                    for(let step=0;step<30&&!area.controls.some(item=>item.controlId.endsWith('.scene_12'));step++){
                        const scrollOwner=deck.locator('[data-creation-control="clikb.creation.character_scenes.control.scroll"]');
                        const before=await scrollOwner.evaluate(element=>element.scrollTop);
                        const reply=await page.evaluate(id=>window.fixture.runControl(id,'scroll','forward'),scrollId);
                        assert.equal(reply.status,'dispatched',JSON.stringify(reply));
                        assert.ok(await scrollOwner.evaluate((element,top)=>element.scrollTop>top,before),'Browser control scrolls the visible scene list forward');
                        area=await read();
                    }
                    assert.ok(area.controls.some(item=>item.controlId.endsWith('.scene_12')),'Mapped scrolling exposes the distant scene');
                    await runControl(page,deck.locator('[data-creation-control="clikb.creation.character_scenes.control.scene_12"]'));
                    await page.locator('[data-creation-control="clikb.creation.character_scene_preview.control.close"]').waitFor();
                    await runControl(page,page.locator('[data-creation-control="clikb.creation.character_scene_preview.control.close"]'));
                }
                await deck.locator('.deck-category').click();
                assert.equal(await deck.getByRole('button', { name: 'Scenes and golden prompt', exact: true }).count(), 0, 'Already-open scenes are not offered again');
                await deck.locator('.deck-category').click();
                await page.keyboard.press('Escape');
                await deck.getByRole('button', { name: 'Close details' }).waitFor({ state: 'hidden' });
                await deck.waitFor();
                await deck.locator('.deck-category').click();
                await deck.getByRole('button', { name: 'Exit creation', exact: true }).click();
                const close = page.getByRole('alertdialog', { name: 'Confirm close creation' });
                await close.waitFor();
                await close.locator('[data-creation-control="clikb.creation.storybook_toolbar.control.cancel_close"]').click();
                await close.waitFor({ state: 'hidden' });
                await activeCard.getByRole('button', { name: 'Remove Ada Prime', exact: true }).click();
                const confirmRemoval = deck.getByRole('group', { name: 'Remove Ada Prime', exact: true });
                await confirmRemoval.getByRole('button', { name: 'Yes', exact: true }).click();
                await confirmRemoval.waitFor({ state: 'hidden' });
                assert.equal(await deck.getAttribute('data-creation-deck-view'), cardView, 'Confirmed removal keeps the selected Deck view');
                assert.equal(await deck.getByRole('button', { name: 'Remove Ada Prime', exact: true }).count(), 0);
                await startDeckHandoff(page);
                await characterBottom.getByRole('button', { name: 'Close Characters', exact: true }).click();
                await deck.locator('.deck-category').filter({ hasText: 'Storyboard' }).waitFor();
                await finishDeckHandoff(page,'Characters → Storyboard');
                assert.deepEqual(errors, []);
                assert.equal(requests.filter(url => url === '/startStory').length, 1);
                console.log('PASS actual PromptInput Deck imagination → preview → models/costs → Characters audit/reopen/rename/scenes → Close creation No → Storyboard; width=' + width);
            }
            catch (error) {
                console.error('Prompt Deck integration failed at width ' + width, { errors, requests });
                throw error;
            }
            finally {
                releasePlan?.();
                releaseStory?.();
                releaseDesign.forEach(resolve => resolve());
                releaseAudit?.();
                releaseBalance?.();
                releaseReferenceImage?.();
                releaseDetection?.();
                await context.close();
            }
        }
    }
    finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
