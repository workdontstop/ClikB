const assert = require('node:assert/strict');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');
require('./bundledFixtureServer.cjs').install();
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const { conciergeVisibleView } = require('./loadTs.cjs')('server/src/ConciergeSnapshotBroker.ts');
const root = path.resolve(__dirname, '..');
// Real Settings, model picker, snapshot producers and browser dispatcher. Only
// their parent application and browser-reply server are isolated. No model/API calls.
const fixture = ts.transpileModule(`
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {MemoryRouter} from 'react-router-dom';
import {store} from '/src/store.ts';
import Settings from '/src/Settings.tsx';
import ModelSelectionModal from '/src/ModelSelectionModal.tsx';
import {setThemePreference,setAutoControlVisible,setAutoControl} from '/src/settingsSlice.ts';
import {setLoggedUser} from '/src/profileSlice.ts';
import {handleNavigationBrowserRequest,startNavigationActionRegistry,observeCurrentAppSnapshot} from '/src/navigationBrowserControl.ts';
import {APP_ACCENT_COLORS} from '/src/appAccentColors.ts';
import {Box} from '@mui/material';
import {patchUserSnapshot,publishNavigationArea,publishFeedsArea,removeNavigationArea,removeFeedsArea} from '/src/brainstormSlice.ts';
import {creationBinding as cb} from '/src/creationControlSnapshot.ts';
import {useCreationControls} from '/src/useCreationControls.ts';
store.dispatch(setThemePreference('dark'));
// Settings persists accents for authenticated users; exercise that production
// contract with a local fixture account and mocked persistence endpoint.
store.dispatch(setLoggedUser({id:2,name:'Controls Test',username:'controls-test',image:'',imageThumb:''}));
store.dispatch(setAutoControlVisible({visible:true,actor:'user'}));
store.dispatch(setAutoControl({enabled:true,actor:'user'}));
const mount=createRoot(document.getElementById('root'));
const svg='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700"><rect width="500" height="700" fill="teal"/></svg>');
function LayeredComposerFixture(){
 const [generating,setGenerating]=useState(false);
 const [minimised,setMinimised]=useState(false);
 const [confirmOpen,setConfirmOpen]=useState(false);
 React.useEffect(()=>{
  store.dispatch(patchUserSnapshot({route:'/',pageName:'Feeds',ui:{isMenuOpen:false,minimisePrompt:minimised,isBrainstormChatOpen:true},creation:{isActive:true,isInitialComposer:true,stage:generating?'generating':'composer'}}));
  store.dispatch(publishNavigationArea({areaId:'clikb.navigation.bottom_menu',source:'LayeredFixture',state:{activeRoute:'/'},visibleControls:[{controlId:'clikb.navigation.bottom_menu.control.cinema',areaId:'clikb.navigation.bottom_menu',enabled:true,candidateActionId:'clikb.navigation.bottom_menu.action.cinema',handlerRef:'openCinema',aiPolicy:'candidate'}]}));
  store.dispatch(publishFeedsArea({areaId:'clikb.feeds.deck',source:'LayeredFixture',instanceId:'deck-1',state:{isOpen:true},visiblePosts:[],visibleControls:[{controlId:'clikb.feeds.deck.control.next',areaId:'clikb.feeds.deck',enabled:true,candidateActionId:'clikb.feeds.deck.action.next',handlerRef:'nextDeckCard',aiPolicy:'candidate'}]}));
  return ()=>{
   store.dispatch(removeNavigationArea({areaId:'clikb.navigation.bottom_menu',source:'LayeredFixture'}));
   store.dispatch(removeFeedsArea({areaId:'clikb.feeds.deck',source:'LayeredFixture'}));
  };
 },[generating,minimised]);
 useCreationControls('styles','LayeredToolbar',!minimised,{stage:generating?'generating':'composer'});
 useCreationControls('storybook_toolbar','LayeredConfirm',!minimised,{confirmOpen});
 useCreationControls('brainstorm','LayeredBrainstorm',!minimised,{});
 window.layeredTest={setGenerating,setMinimised,setConfirmOpen,state:()=>({generating,minimised,confirmOpen})};
 const isComposerStage=!generating;const isBlinking=generating;const allowSpin=false;
 return <Box sx={{p:2}}>
  <Box sx={{display:'flex',gap:2,mb:2}}>
   <button data-ai-action="clikb.navigation.bottom_menu.action.cinema">Cinema</button>
   <button data-ai-action="clikb.feeds.deck.action.next">Next Deck</button>
  </Box>
  {!minimised && <Box sx={{display:'flex',gap:1,flexWrap:'wrap'}}>
   <button onClick={()=>setConfirmOpen(true)} {...cb('styles','close_composer','Close Creation composer','onCompactClose','click',isComposerStage&&!isBlinking&&!allowSpin?'candidate':'needs_confirmation')}>Close Composer</button>
   <input defaultValue="" {...cb('brainstorm','input','Brainstorm message','setCurrentInput','text','needs_handoff')}/>
   <button {...cb('brainstorm','send','Send Brainstorm message','handleSendMessage','click','needs_handoff')}>Send</button>
   <button {...cb('brainstorm','use_msg1','Use this response in prompt','handleUseMessage','click','needs_handoff')}>Use This</button>
   <button {...cb('brainstorm','finalize_msg1','Create template from response','onSaveClicked')}>Create Template</button>
   <button {...cb('brainstorm','close','Review leaving Brainstorm','setShowLeaveConfirm(true)')}>Close Brainstorm</button>
  </Box>}
  {confirmOpen && <Box role="alertdialog" aria-modal="true" aria-label="Confirm close creation" sx={{position:'fixed',inset:0,zIndex:10000,display:'flex',flexDirection:'column',bgcolor:'rgba(0,0,0,0.85)'}}>
   <Box {...cb('storybook_toolbar','confirm_close','Yes, close and wipe the current creation','handleCloseOverlay','click','needs_confirmation')} sx={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff'}}>YES</Box>
   <Box {...cb('storybook_toolbar','cancel_close','No, keep current creation','setShowConfirmClose')} onClick={()=>setConfirmOpen(false)} sx={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',cursor:'pointer'}}>NO</Box>
  </Box>}
 </Box>;
}
function App(){
 const [selected,setSelected]=useState('Schnell');
 const params=new URLSearchParams(location.search);
 if(params.has('layered')) return <LayeredComposerFixture/>;
 return params.has('models')
 ? <><output id="selected">{selected}</output><ModelSelectionModal open={true} setOpen={()=>{}} handleSelect={name=>setSelected(name)} models={[{name:'Schnell',img:svg},{name:'fluxUltra2',img:svg}]} currentImage={svg} darkModeReducer={true} matchMobile={false} darkMode={true} gradient="teal" labelsByIndex={{}} colorsByLabel={{}} activeModelName={selected}/></>
 : <Settings isMenuOpen={false} callFeeds={false} setcallFeeds={()=>{}} AllowPing={false} setAllowPing={()=>{}}/>;
}
mount.render(<Provider store={store}><MemoryRouter initialEntries={['/settings']}><App/></MemoryRouter></Provider>);
startNavigationActionRegistry();
window.test={snapshot:observeCurrentAppSnapshot, settings:()=>store.getState().settings, colors:APP_ACCENT_COLORS,
 run:message=>handleNavigationBrowserRequest(message,location.origin), permission:enabled=>store.dispatch(setAutoControl({enabled,actor:'user'})),
 detach:()=>mount.render(<p>Another route</p>)};
`, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;

(async () => {
  const createServer = options => require('./bundledFixtureServer.cjs').createServer(options, fixture);
  const replies = new Map();
  const server = await createServer({root, configFile:false, logLevel:'error', cacheDir:path.join(root,'node_modules/.tmp/concierge-browser-vite'),
    define:{'import.meta.env.VITE_CLIK_URL':JSON.stringify('http://127.0.0.1:5198')},
    optimizeDeps:{noDiscovery:true,include:['react','react/jsx-runtime','react/jsx-dev-runtime','react-dom/client','react-redux','react-router-dom','@reduxjs/toolkit','@mui/material','@mui/material/styles','prop-types','react-is','@emotion/react','@emotion/styled','axios',...['BrightnessAuto','LightMode','DarkMode','Download','Check','Close','InfoOutlined'].map(name=>'@mui/icons-material/'+name)]},
    server:{host:'127.0.0.1',port:5198,strictPort:true,hmr:false}, plugins:[{name:'concierge-controls',
      resolveId(id){if(id==='/fixture.js')return '\0concierge-controls';},
      load(id){if(id==='\0concierge-controls')return fixture;},
      configureServer(server){server.middlewares.use((req,res,next)=>{
        if(req.url.startsWith('/__test')){res.setHeader('Content-Type','text/html');res.end('<div id="root"></div><script type="module" src="/fixture.js"></script>');return;}
        if(req.url==='/navigation/browser-reply'){let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{const data=JSON.parse(body);replies.set(data.requestId,data.reply);res.end('{}');});return;}
        if(req.method==='POST'&&(req.url==='/settings/accent-color'||req.url==='/ai-provider/select-openai')){req.resume();res.setHeader('Content-Type','application/json');res.end('{"ok":true}');return;}
        next();
      });}
    }]});
  await server.listen();
  const browser = await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:800}});
    const errors=[];
    page.on('pageerror',error=>{errors.push(error.message);console.error('Browser:',error.message);});
    page.on('console',message=>{if(message.type()==='error')console.error('Console:',message.text());});
    page.setDefaultTimeout(60000);
    await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:5198/')?route.continue():route.abort());
    let sequence=0;
    async function run(command){const requestId='test-'+(++sequence);await page.evaluate(message=>window.test.run(message),{...command,requestId});assert.ok(replies.has(requestId));return replies.get(requestId);}
    async function click(actionId){await page.waitForFunction(id=>window.test?.snapshot().navigation?.availableActions.some(item=>item.actionId===id),actionId);const raw=await page.evaluate(()=>window.test.snapshot());const projected=conciergeVisibleView(raw);assert.ok(Object.values(projected.areas).some(area=>area.controls.some(control=>control.actionId===actionId||control.candidateActionId===actionId)), 'Native Settings action missing from model projection: '+actionId);const expectedVersion=raw.navigation.stateVersion;return run({command:'action',actionId,expectedVersion});}
    await page.goto('http://127.0.0.1:5198/__test',{waitUntil:'domcontentloaded'});
    const darkPurple='clikb.settings.action.accent_dark_purple';
    await page.waitForFunction(id=>window.test?.snapshot().navigation?.availableActions.some(item=>item.actionId===id),darkPurple);
    const original=await page.evaluate(()=>window.test.settings());
    for (const profile of ['luna_none','luna_xhigh','terra','luna']) {
      const actionId='clikb.settings.action.conversation_'+profile;
      await page.locator('[data-ai-action="'+actionId+'"]').scrollIntoViewIfNeeded();
      const selected=await click(actionId);
      assert.equal(selected.status,'observed_change');
      const settings=await page.evaluate(()=>window.test.settings());
      assert.equal(settings.conversationModel,profile);
      assert.equal(settings.languageModel,original.languageModel);
      assert.equal(settings.model,original.model);
    }
    console.log('PASS concierge profiles: explicit Luna None/Low/Medium, and Terra 6.1 Low have executable Settings bindings without changing creation/image selections');
    let reply=await click(darkPurple);
    assert.equal(reply.status,'observed_change');
    const purple=await page.evaluate(()=>window.test.colors.dark.find(color=>color.name==='Purple').value);
    assert.equal(reply.snapshot.app.appearance.appColor,purple);
    assert.equal(reply.snapshot.app.appearance.appColorLight,original.appColorLight);
    assert.equal(reply.snapshot.navigation.areas['clikb.settings'].state.activeAccentName,'Purple');
    assert.ok(!reply.snapshot.navigation.availableActions.some(item=>item.actionId===darkPurple));
    assert.equal(reply.snapshot.navigation.recentTransitions.at(-1).actor,'ai');
    reply=await click('clikb.settings.action.theme_light');
    assert.equal(reply.status,'observed_change');
    assert.equal(reply.snapshot.app.appearance.appColorDark,purple);
    assert.equal(reply.snapshot.app.appearance.appColor,original.appColorLight);
    reply=await click('clikb.settings.action.accent_light_red');
    assert.equal(reply.status,'observed_change');
    const red=reply.snapshot.app.appearance.appColorLight;
    await page.evaluate(()=>window.test.permission(false));
    reply=await click('clikb.settings.action.accent_light_purple');
    assert.equal(reply.status,'rejected');
    assert.equal(reply.snapshot.app.appearance.appColorLight,red);
    await page.evaluate(()=>window.test.detach());
    await page.waitForFunction(()=>!window.test.snapshot().navigation.areas['clikb.settings']);
    reply=await run({command:'snapshot'});
    assert.equal(reply.snapshot.app.appearance.appColor,red);
    assert.equal(reply.snapshot.app.appearance.appColorDark,purple);
    console.log('PASS Settings: AI accent/theme changes, independent mode colors, selected swatch exclusion, permission stop and appearance snapshot after leaving Settings');

    await page.goto('http://127.0.0.1:5198/__test?models',{waitUntil:'domcontentloaded'});
    const scrollId='clikb.creation.models.action.scroll';
    await page.waitForFunction(id=>window.test?.snapshot().creation.controls?.areas['clikb.creation.models']?.controls.some(control=>control.actionId===id&&control.canScrollForward),scrollId);
    const before=await page.locator('[data-ai-action="'+scrollId+'"]').evaluate(element=>element.scrollTop);
    let expectedVersion=await page.evaluate(()=>window.test.snapshot().creation.controls.stateVersion);
    reply=await run({command:'scroll',scrollId,direction:'forward',expectedVersion});
    assert.equal(reply.status,'dispatched');
    assert.ok(await page.locator('[data-ai-action="'+scrollId+'"]').evaluate(element=>element.scrollTop)>before);
    // Center a mapped child under the parent scroll owner's hit-test point. This
    // is the regression: the child is a valid descendant, not an obstruction.
    await page.locator('[data-ai-action="clikb.creation.models.action.image_Schnell"]').evaluate(child=>{
      const owner=child.closest('[data-creation-kind="scroll"]');const bounds=owner.getBoundingClientRect();const rect=child.getBoundingClientRect();owner.scrollTop+=rect.top+rect.height/2-(bounds.top+bounds.height/2);
    });
    await page.waitForFunction(id=>{const element=document.querySelector('[data-ai-action="'+id+'"]');const rect=element.getBoundingClientRect();const hit=document.elementFromPoint(rect.left+rect.width/2,rect.top+rect.height/2);return hit?.closest('[data-creation-control]')!==element&&window.test.snapshot().creation.controls.areas['clikb.creation.models']?.controls.some(control=>control.actionId===id&&control.canScrollForward);},scrollId);
    expectedVersion=await page.evaluate(()=>window.test.snapshot().creation.controls.stateVersion);
    reply=await run({command:'scroll',scrollId,direction:'forward',expectedVersion});
    assert.equal(reply.status,'dispatched');
    const banana='clikb.creation.models.action.image_fluxUltra2';
    for(let i=0;i<4;i++){
      const visible=await page.evaluate(id=>window.test.snapshot().creation.controls.areas['clikb.creation.models']?.controls.some(control=>control.actionId===id&&control.enabled),banana);
      if(visible)break;
      await page.waitForFunction(id=>window.test.snapshot().creation.controls.areas['clikb.creation.models']?.controls.some(control=>control.actionId===id&&control.canScrollForward),scrollId);
      expectedVersion=await page.evaluate(()=>window.test.snapshot().creation.controls.stateVersion);
      assert.equal((await run({command:'scroll',scrollId,direction:'forward',expectedVersion})).status,'dispatched');
    }
    await page.waitForFunction(id=>window.test.snapshot().creation.controls.areas['clikb.creation.models']?.controls.some(control=>control.actionId===id&&control.enabled),banana);
    expectedVersion=await page.evaluate(()=>window.test.snapshot().creation.controls.stateVersion);
    reply=await run({command:'action',actionId:banana,expectedVersion});
    assert.equal(reply.status,'dispatched');
    await page.waitForFunction(()=>document.getElementById('selected').textContent==='fluxUltra2');
    for (const profile of ['luna_extra','terra','sol','luna']) {
      const actionId='clikb.creation.models.action.creation_'+profile;
      await page.locator('[data-ai-action="'+actionId+'"]').scrollIntoViewIfNeeded();
      await page.waitForFunction(id=>window.test.snapshot().creation.controls.areas['clikb.creation.models']?.controls.some(control=>control.actionId===id&&control.enabled),actionId);
      expectedVersion=await page.evaluate(()=>window.test.snapshot().creation.controls.stateVersion);
      assert.equal((await run({command:'action',actionId,expectedVersion})).status,'dispatched');
      await page.waitForFunction(profile=>window.test.settings().languageModel===profile,profile);
      assert.equal(await page.locator('#selected').textContent(),'fluxUltra2');
      assert.equal(await page.evaluate(()=>window.test.settings().conversationModel),'luna');
    }
    console.log('PASS creation profiles: explicit Luna Extra, Terra 6.1, Sol 6.1 and Luna choices preserve image and conversation selections');
    assert.deepEqual(errors,[]);
    console.log('PASS real model picker: parent scroll with mapped child at center, refreshed live control visibility, then Nano Banana Pro selection; no browser errors');

    await page.goto('http://127.0.0.1:5198/__test?layered',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>{
      const s=window.test?.snapshot();
      return Boolean(s?.creation?.controls?.areas['clikb.creation.styles']
        && s?.creation?.controls?.areas['clikb.creation.brainstorm']
        && s?.feeds?.areas['clikb.feeds.deck']
        && s?.navigation?.areas['clikb.navigation.bottom_menu']);
    });
    let layeredRaw=await page.evaluate(()=>window.test.snapshot());
    let layeredProjected=conciergeVisibleView(layeredRaw);
    assert.equal(layeredProjected.areas['clikb.creation.styles']?.layer,'floating_overlay');
    assert.equal(layeredProjected.areas['clikb.creation.brainstorm']?.layer,'floating_overlay');
    assert.equal(layeredProjected.areas['clikb.feeds.deck']?.layer,'backdrop');
    assert.equal(layeredProjected.areas['clikb.navigation.bottom_menu']?.layer,'shell');
    const idleClose=layeredProjected.areas['clikb.creation.styles'].controls.find(c=>c.actionId==='clikb.creation.styles.action.close_composer');
    assert.equal(idleClose?.policy,'candidate');
    const bsControls=layeredProjected.areas['clikb.creation.brainstorm'].controls;
    for (const handoffKey of ['input','send','use_msg1']) {
      assert.equal(bsControls.find(c=>c.actionId==='clikb.creation.brainstorm.action.'+handoffKey)?.policy,'needs_handoff');
    }
    for (const candidateKey of ['finalize_msg1','close']) {
      assert.equal(bsControls.find(c=>c.actionId==='clikb.creation.brainstorm.action.'+candidateKey)?.policy,'candidate');
    }

    await page.evaluate(()=>window.layeredTest.setGenerating(true));
    await page.waitForFunction(()=>window.test.snapshot().creation.controls.areas['clikb.creation.styles']?.controls.find(c=>c.actionId==='clikb.creation.styles.action.close_composer')?.policy==='needs_confirmation');
    await page.evaluate(()=>window.layeredTest.setGenerating(false));
    await page.waitForFunction(()=>window.test.snapshot().creation.controls.areas['clikb.creation.styles']?.controls.find(c=>c.actionId==='clikb.creation.styles.action.close_composer')?.policy==='candidate');

    await page.evaluate(()=>window.layeredTest.setConfirmOpen(true));
    await page.waitForFunction(()=>window.test.snapshot().conciergeFocus?.kind==='modal');
    layeredRaw=await page.evaluate(()=>window.test.snapshot());
    layeredProjected=conciergeVisibleView(layeredRaw);
    assert.deepEqual(Object.keys(layeredProjected.areas),['clikb.creation.storybook_toolbar']);
    assert.deepEqual(
      layeredProjected.areas['clikb.creation.storybook_toolbar'].controls.map(c=>c.actionId).sort(),
      ['clikb.creation.storybook_toolbar.action.cancel_close','clikb.creation.storybook_toolbar.action.confirm_close']
    );
    expectedVersion=layeredRaw.creation.controls.stateVersion;
    reply=await run({command:'action',actionId:'clikb.creation.storybook_toolbar.action.cancel_close',expectedVersion});
    assert.equal(reply.status,'dispatched');
    await page.waitForFunction(()=>!window.layeredTest.state().confirmOpen && window.test.snapshot().conciergeFocus?.kind==='page');

    await page.evaluate(()=>window.layeredTest.setMinimised(true));
    await page.waitForFunction(()=>window.test.snapshot().ui?.minimisePrompt===true);
    layeredRaw=await page.evaluate(()=>window.test.snapshot());
    layeredProjected=conciergeVisibleView(layeredRaw);
    assert.ok(!Object.keys(layeredProjected.areas).some(id=>id.startsWith('clikb.creation.')));
    assert.ok(Boolean(layeredProjected.areas['clikb.feeds.deck']));
    assert.ok(Boolean(layeredProjected.areas['clikb.navigation.bottom_menu']));
    assert.deepEqual(errors,[]);
    console.log('PASS layered composer & alertdialog: floating overlay + backdrop deck + shell nav, stage-dependent close_composer, Brainstorm handoff boundary, role=alertdialog modal isolation, and ui.minimisePrompt hiding');
  } finally {await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
