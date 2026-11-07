const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {build}=require('esbuild');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||'../.tmp/concierge-browser-deps/node_modules/playwright');
const shared=require('./deckSearch.browser.cjs'),root=path.resolve(__dirname,'..');
const layout=shared.layout.replace('<section data-grid-type','<section style={{paddingTop:160}} data-grid-type');
let fixture=shared.fixture.replace('store.dispatch(setDeckCleanMode(false));','');
fixture="import Settings from '/src/Settings.tsx';import {useNavigate} from 'react-router-dom';import {setLoggedUser} from '/src/profileSlice.ts';import {setDeckEnabled} from '/src/settingsSlice.ts';import {openDeckCreation} from '/src/useDeckNavigation.ts';import {usePromptInputHistory} from '/src/usePromptInputHistory.ts';\n"+fixture;
fixture=fixture.replace('function App()',"store.dispatch(setLoggedUser({id:7,name:'Owner',username:'owner',image:'',imageThumb:'',deckEnabled:true}));function App()");
fixture=fixture.replace('const location=useLocation(),','const navigate=useNavigate(),location=useLocation(),');
fixture=fixture.replace('window.fixture.compose=setminimisePrompt;',`window.fixture.compose=setminimisePrompt;window.fixture.profile=()=>store.getState().profile.loggedUser;window.fixture.relogin=()=>{const user=store.getState().profile.loggedUser;store.dispatch(setDeckEnabled(true));store.dispatch(setLoggedUser(user));};window.fixture.nav=navigate;
 window.fixture.settings=()=>store.getState().settings;window.fixture.create=()=>openDeckCreation(location,navigate,()=>setminimisePrompt(false),store.getState().settings.deckEnabled);
 window.fixture.state=()=>({pathname:location.pathname,minimisePrompt,isFullscreen,isFullscreen1,isFullscreen2,isFullscreen3});
 usePromptInputHistory({open:!minimisePrompt,suspended:false,blockBack:false,routeKey:location.key,onClose:()=>setminimisePrompt(true),onReopen:()=>setminimisePrompt(false)});`);
fixture=fixture.replace("{location.pathname==='/search'?", "{location.pathname==='/settings'?<Settings {...props}/>:location.pathname==='/search'?");
fixture=fixture.replace('<Feedgate {...props} type={4} vertical={true}/>',"<Feedgate {...props} type={location.pathname==='/pages'?10:location.pathname==='/images'?1:location.pathname==='/clikit'?3:location.pathname==='/kickit'?2:4} vertical={true}/>");
fixture=fixture.replace('</main>','<section data-composer hidden={minimisePrompt}>Creation prompt</section></main>');
(async()=>{
 const bundled=await build({stdin:{contents:fixture,loader:'tsx',resolveDir:root},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',logLevel:'silent',loader:{'.png':'dataurl','.jpg':'dataurl','.webp':'dataurl','.css':'empty'},define:{'import.meta.env':JSON.stringify({VITE_CLIK_URL:'http://clikb.test',PROD:false})},plugins:[{name:'settings-offline',setup(b){
  b.onResolve({filter:/^(axios|.*(?:FeedLayoutHorizontal|FeedLayout|GlobalBrainstormGuide|KeywordSelector|TogglePromptButton|Footer|ProfileInfo|FullScreenStories|StoryAutoScroller|DetectDevice|ConversationModelPicker))$/},args=>({path:args.path,namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='axios'?`export default {post:(url,body)=>url.endsWith('/settings/deck')&&window.fixture.failDeckSave?Promise.reject(new Error('fixture save failure')):window.auditApi(url,body?.values??body),get:url=>window.auditApi(url),put:(url,body)=>window.auditApi(url,body?.values??body)};`:/FeedLayout/.test(args.path)?layout:/GlobalBrainstormGuide/.test(args.path)?shared.guide:/DetectDevice/.test(args.path)?'export const matchMobile=innerWidth<600,matchPc=!matchMobile,matchTablet=false;':'export default function Stub(){return null;}',loader:'jsx',resolveDir:root}));
  b.onResolve({filter:/^\/(?:src|server)\//},args=>({path:path.join(root,args.path.slice(1))}));
 }}]});
 const html='<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#111;color:white}'+fs.readFileSync(path.join(root,'src/DeckOverlay.css'),'utf8')+'</style><div id="root"></div><script>'+bundled.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>';
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().isNavigationRequest()?route.fulfill({contentType:'text/html',body:html}):route.abort());await page.goto('http://clikb.test/settings');
  await page.getByRole('checkbox',{name:/^(On|Off)$/}).waitFor();assert.equal(await page.getByRole('checkbox',{name:/^(Clean|Normal)$/}).isChecked(),true);
  assert.deepEqual(await page.locator('[aria-label="Deck settings"] .MuiSwitch-switchBase').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).color)),['rgb(255, 255, 255)','rgb(255, 255, 255)'],'Checked switches use the selected white app accent');
  assert.equal(await page.locator('[aria-label="Deck settings"]').getByText('Browse posts in Deck.',{exact:false}).count(),0);
  await page.getByRole('checkbox',{name:/^(Clean|Normal)$/}).uncheck();assert.equal(await page.getByRole('checkbox',{name:'Normal',exact:true}).count(),1);assert.equal(await page.evaluate(()=>window.fixture.settings().deckCleanMode),false);
  await page.getByRole('checkbox',{name:/^(Clean|Normal)$/}).check();await page.getByRole('checkbox',{name:/^(On|Off)$/}).uncheck();
  await page.waitForFunction(()=>window.fixture.profile().deckEnabled===false);
  assert.equal(await page.evaluate(()=>window.fixture.requests.some(request=>request.endpoint==='deck'&&request.values.enabled===false)),true,'Deck Off is written to the member settings endpoint');
  await page.evaluate(()=>window.fixture.relogin());assert.equal(await page.evaluate(()=>window.fixture.settings().deckEnabled),false,'Login rehydrates the saved Off preference');
  assert.equal(await page.getByRole('checkbox',{name:/^(Clean|Normal)$/}).count(),0);
  await page.waitForFunction(()=>!window.fixture.snapshot().navigation.areas['clikb.settings'].visibleControls.some(control=>control.controlId==='clikb.settings.control.toggle_deck_clean_mode'));
  // The real browser registry must activate the input, not a decorative Switch span.
  // Hiding Clean mode changes the Settings viewport; observe settled layout before activating.
  await page.waitForTimeout(350);
  for(let attempt=0;attempt<3;attempt++){
   await page.evaluate(async()=>{const snap=window.fixture.snapshot();await window.fixture.run({requestId:'toggle-on',command:'action',actionId:'clikb.settings.action.toggle_deck',expectedVersion:snap.navigation.stateVersion});});
   if(await page.evaluate(()=>window.fixture.settings().deckEnabled))break;
   await page.waitForTimeout(200);
  }
  await page.waitForFunction(()=>window.fixture.settings().deckEnabled===true).catch(async error=>{console.error(await page.evaluate(()=>({reply:window.fixture.replies['toggle-on'],nav:window.fixture.snapshot().navigation,errors:window.fixture.settings().deckEnabled})));throw error;});
  await page.getByRole('checkbox',{name:/^(On|Off)$/}).uncheck();
  for(const route of ['/feeds','/images','/kickit','/clikit','/pages','/search?q=cars&section=shorts']){
   await page.evaluate(route=>window.fixture.nav(route),route);await page.locator('[data-grid-post]').first().waitFor();
   assert.equal(await page.locator('[data-deck-overlay]').count(),0);assert.equal(await page.evaluate(()=>history.state.usr?.clikbDeck),undefined);
   const before=await page.evaluate(()=>history.state.idx);
   const target=page.locator('[data-grid-type="1"] [data-grid-post]').first();
   await (route.startsWith('/search')?target:page.locator('[data-grid-post]').first()).click();await page.locator('[data-fullscreen]').first().waitFor();
   assert.equal(await page.evaluate(()=>history.state.idx),before+1);assert.equal(await page.evaluate(()=>history.state.usr.clikbDeck.tier),'story');assert.equal(await page.locator('[data-deck-overlay]').count(),0);
   await page.goBack();await page.locator('[data-fullscreen]').waitFor({state:'hidden'});await page.goForward();await page.locator('[data-fullscreen]').first().waitFor();
   await page.evaluate(()=>window.fixture.create());await page.locator('[data-composer]').waitFor({state:'visible'});await page.waitForFunction(()=>!!history.state.clikbPromptInput);
   assert.equal(await page.locator('[data-fullscreen]').count(),0,'Creation uses Grid, not fullscreen');assert.equal(await page.locator('[data-deck-overlay]').count(),0);assert.equal(await page.evaluate(()=>history.state.usr?.clikbDeck),undefined);
   await page.goBack();await page.locator('[data-composer]').waitFor({state:'hidden'});await page.goForward();await page.locator('[data-composer]').waitFor({state:'visible'});
   await page.evaluate(()=>window.fixture.compose(true));await page.locator('[data-composer]').waitFor({state:'hidden'});await page.waitForFunction(()=>!history.state.clikbPromptInput);
  }
  await page.evaluate(()=>window.fixture.nav('/images'));await page.locator('[data-grid-post]').first().waitFor();const before=await page.evaluate(()=>history.state.idx);
  await page.evaluate(()=>window.fixture.compose(false));await page.locator('[data-composer]').waitFor({state:'visible'});await page.waitForFunction(()=>!!history.state.clikbPromptInput);assert.equal(await page.locator('[data-deck-overlay]').count(),0);assert.equal(await page.evaluate(()=>history.state.idx),before+1,'Automatic composer adds only its popup history');
  await page.evaluate(()=>window.fixture.compose(true));await page.locator('[data-composer]').waitFor({state:'hidden'});await page.waitForFunction(()=>!history.state.clikbPromptInput);
  await page.evaluate(()=>window.fixture.nav('/settings'));await page.getByRole('checkbox',{name:/^(On|Off)$/}).check();await page.evaluate(()=>window.fixture.nav('/images'));
  await page.locator('.deck-overlay--clean').waitFor();await page.waitForFunction(()=>window.fixture.snapshot().feeds.areas['clikb.feeds.deck']?.state.cleanMode===true);
  await page.getByRole('button',{name:'Restore deck view',exact:true}).click();await page.waitForFunction(()=>window.fixture.settings().deckCleanMode===false);
  await page.evaluate(()=>window.fixture.nav('/settings'));assert.equal(await page.getByRole('checkbox',{name:/^(Clean|Normal)$/}).isChecked(),false);
  await page.evaluate(()=>window.fixture.failDeckSave=true);
  await page.getByRole('checkbox',{name:'On',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Your Deck setting could not be saved.'}).waitFor();
  assert.equal(await page.getByRole('checkbox',{name:'On',exact:true}).isChecked(),true,'Failed cloud save restores the previous member preference');
  assert.equal(await page.evaluate(()=>window.fixture.profile().deckEnabled),true,'Failed save never changes the stored profile preference');
  assert.deepEqual(errors,[]);console.log('PASS '+width+'px: Settings/Redux/AI toggle; Deck Off feeds/Search/profile fullscreen; Grid composer + automatic opening and popup Back/Forward; Clean default and shared mode preference');await page.close();
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
