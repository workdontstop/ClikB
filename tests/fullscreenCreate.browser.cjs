const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {build}=require('esbuild');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||'../.tmp/concierge-browser-deps/node_modules/playwright');
const root=path.resolve(__dirname,'..');
const shared=require('./deckSearch.browser.cjs');
const nativeGuard=process.argv.includes('--native-guard');
const regularFullscreen=process.argv.includes('--regular-fullscreen');
const quickCreate=process.argv.includes('--quick-create');
const autoCreate=process.argv.includes('--auto-create');
// Real Search with all three FeedsGate rows, real DeckRuntime and MenuSlider.
// Reuse the offline feed transport and lightweight viewer from the Search suite.
let fixture=shared.fixture.replace("import Homepage from '/src/Homepage.tsx';", "import Homepage from '/src/Homepage.tsx';import MenuSlider from '/src/MenuSlider.tsx';");
fixture=fixture.replace('window.fixture.compose=setminimisePrompt;', 'window.fixture.compose=setminimisePrompt;window.fixture.state=()=>({pathname:location.pathname,search:location.search,state:location.state,minimisePrompt});');
fixture=fixture.replace('<main>{location.pathname', '<aside style={{position:"fixed",left:0,top:0,width:300,height:"100vh",zIndex:20000,background:"#111"}}><MenuSlider {...props} categoriesExpanded={true} onExpandCategories={noop} setActiveIndex={noop}/></aside><main>{location.pathname');
fixture=fixture.replace('<Feedgate {...props} type={4} vertical={true}/>', '<><Feedgate {...props} type={location.pathname===\'/pages\'?10:location.pathname===\'/kickit\'?2:location.pathname===\'/clikit\'?3:location.pathname===\'/feeds\'?4:1} vertical={true}/><section data-composer hidden={minimisePrompt}>Creation prompt</section></>');
assert.ok(fixture.includes('import MenuSlider'));assert.ok(fixture.includes('<MenuSlider'));
if(quickCreate){
 fixture=fixture.replace("import MenuSlider from '/src/MenuSlider.tsx';", "import MenuSlider from '/src/MenuSlider.tsx';import TogglePromptButton from '/src/TogglePromptButton.tsx';");
 // Search intentionally has no floating Create control.
 fixture=fixture.replace('<aside style=', "{location.pathname!=='/search'&&<TogglePromptButton {...props} matchMobile={innerWidth<600} darkModeReducer={true} isFullscreen={isFullscreen||isFullscreen1||isFullscreen2||isFullscreen3}/>}<aside style=");
}
if(autoCreate){
 fixture="import {patchUserSnapshot} from '/src/brainstormSlice.ts';\n"+fixture;
 // App publishes these existing observations in production; the fixture must
 // publish them too for the real automatic executor to observe arrival.
 fixture=fixture.replace('const [mounted,setMounted]',"useEffect(()=>{store.dispatch(patchUserSnapshot({route:location.pathname,navigation:{route:location.pathname},ui:{minimisePrompt},creation:{promptOpen:!minimisePrompt}}));},[location.pathname,minimisePrompt]);const [mounted,setMounted]");
}
if(nativeGuard){
 fixture="import {usePromptInputHistory} from '/src/usePromptInputHistory.ts';\n"+fixture;
 fixture=fixture.replace('const [mounted,setMounted]',`const [busy,setBusy]=useState(false);window.fixture.busy=setBusy;
 usePromptInputHistory({open:!minimisePrompt,suspended:false,blockBack:busy,routeKey:location.key,onClose:()=>setminimisePrompt(true),onReopen:()=>setminimisePrompt(false)});
 const [mounted,setMounted]`);
}
(async()=>{
 const bundle=await build({stdin:{contents:fixture,loader:'tsx',resolveDir:root},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',logLevel:'silent',loader:{'.png':'dataurl','.jpg':'dataurl','.webp':'dataurl','.css':'empty'},define:{'import.meta.env':JSON.stringify({VITE_CLIK_URL:'http://clikb.test',PROD:false})},plugins:[{name:'offline-create',setup(b){
  b.onResolve({filter:/^(axios|.*(?:FeedLayoutHorizontal|FeedLayout|GlobalBrainstormGuide|KeywordSelector|TogglePromptButton|Footer|ProfileInfo|FullScreenStories|StoryAutoScroller|DetectDevice))$/},args=>quickCreate&&/TogglePromptButton$/.test(args.path)?{path:path.join(root,'src/TogglePromptButton.tsx')}:{path:args.path,namespace:'fixture'});
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='axios'?`export default {post:(url,body)=>window.auditApi(url,body?.values),get:url=>window.auditApi(url),put:(url,body)=>window.auditApi(url,body?.values)};`:/FeedLayout/.test(args.path)?shared.layout:/GlobalBrainstormGuide/.test(args.path)?shared.guide:/DetectDevice/.test(args.path)?'export const matchMobile=innerWidth<600,matchPc=!matchMobile,matchTablet=false;':'export default function Stub(){return null;}',loader:'jsx',resolveDir:root}));
  b.onResolve({filter:/^\/(?:src|server)\//},args=>({path:path.join(root,args.path.slice(1))}));
 }}]});
 const html='<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial}'+fs.readFileSync(path.join(root,'src/DeckOverlay.css'),'utf8')+'</style><div id="root"></div><script>'+bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>';
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{for(const width of [1280,390])for(const route of quickCreate?['/search?q=cars&section=shorts','/pages','/feeds','/images','/kickit','/clikit']:regularFullscreen?['/images?menu','/kickit?menu']:['/search?q=cars&section=shorts&menu','/pages?menu'])for(const fullscreen of quickCreate?[false]:regularFullscreen?[true]:[false,true]){
  const destination=regularFullscreen||(quickCreate&&!/^\/(search|pages)(?:[?]|$)/.test(route))?route.split('?')[0]:'/images';
  const changesRoute=destination!==route.split('?')[0];
  const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
  await page.goto('http://clikb.test'+route);
  await page.waitForFunction(()=>window.fixture?.snapshot().feeds?.areas['clikb.feeds.deck']?.state.status==='ready');
  if(quickCreate){
   await page.locator('aside').evaluate(node=>{node.style.display='none';});
   assert.equal(await page.locator('[data-ai-action="clikb.navigation.quick_create.action.open_creation"]').count(),0,'Deck retains its own Create control');
   await page.locator('[data-ai-action="clikb.feeds.deck.action.close"]').click();
   if(route.startsWith('/search')){
    await page.locator('[data-deck-overlay]').waitFor({state:'hidden'});
    assert.equal(await page.locator('[data-ai-action="clikb.navigation.quick_create.action.open_creation"]').count(),0,'Search Grid has no floating Create control');
    assert.deepEqual(errors,[]);console.log('PASS Search has no floating Create '+width+'px');await page.close();continue;
   }
   await page.locator('[data-ai-action="clikb.navigation.quick_create.action.open_creation"]').waitFor();
  }
  if(fullscreen){
   // Enter the viewer with the mobile menu dismissed, then reveal navigation.
   await page.locator('aside').evaluate(node=>{node.style.display='none';});
   await page.locator('[data-ai-action="clikb.feeds.deck.action.play"]').click();await page.locator('[data-fullscreen]').waitFor();
   await page.locator('aside').evaluate(node=>{node.style.display='block';});
  }
  const source=await page.evaluate(()=>({url:location.pathname+location.search,tier:history.state?.usr?.clikbDeck?.tier,post:history.state?.usr?.clikbDeck?.activePostId,grid:history.state?.usr?.clikbDeckGrid?.sessionId,idx:history.state?.idx,length:history.length}));
  if(autoCreate){
   const reply=await page.evaluate(async quick=>{
    const requestId='auto-open-creation',actionId=quick?'clikb.navigation.quick_create.action.open_creation':'clikb.navigation.menu.action.create';
    await window.fixture.run({requestId,command:'action',actionId,expectedVersion:window.fixture.snapshot().navigation.stateVersion});
    return window.fixture.replies[requestId];
   },quickCreate);
   assert.equal(reply.status,'observed_change','Automatic mapped Create call executes the existing handler');
  }else await page.locator(quickCreate?'[data-ai-action="clikb.navigation.quick_create.action.open_creation"]':'[data-ai-action="clikb.navigation.menu.action.create"]').click();
  await page.waitForFunction(target=>location.pathname===target&&window.fixture.state().minimisePrompt===false,destination).catch(async error=>{console.error('CREATE FAILURE',width,route,fullscreen,await page.evaluate(()=>({url:location.href,ui:window.fixture?.state(),deck:window.fixture?.snapshot().feeds?.areas['clikb.feeds.deck']?.state})),errors);throw error;});
  await page.locator('[data-composer]').waitFor();await page.waitForFunction(category=>window.fixture.snapshot().feeds?.areas['clikb.feeds.deck']?.state.activeCategory===category,({'/feeds':'all','/kickit':'cinema','/clikit':'games'})[destination]||'shorts');
  await page.waitForTimeout(250);assert.equal(new URL(page.url()).pathname,destination);assert.equal((await page.evaluate(()=>window.fixture.state())).minimisePrompt,false);assert.equal(await page.locator('[data-fullscreen]').count(),0);assert.deepEqual(errors,[]);
  if(nativeGuard){
   await page.waitForFunction(()=>Boolean(history.state?.clikbPromptInput));
   const popup=await page.evaluate(()=>({idx:history.state.idx,length:history.length,url:location.pathname+location.search,post:history.state.usr.clikbDeck.activePostId}));
   assert.equal(popup.idx,source.idx+(changesRoute?2:1)+1,'Exactly one popup layer follows the existing destination layers');
   await page.evaluate(()=>history.back());
   await page.waitForFunction(()=>window.fixture.state().minimisePrompt&&!history.state?.clikbPromptInput);
   assert.equal(await page.evaluate(()=>location.pathname+location.search),popup.url,'First Back closes only PromptInput');
   assert.equal(await page.evaluate(()=>history.state?.usr?.clikbDeck?.activePostId),popup.post,'First Back retains the selected Deck post');
   assert.equal(await page.evaluate(()=>history.state.idx),popup.idx-1);
   await page.evaluate(()=>history.forward());
   await page.waitForFunction(()=>!window.fixture.state().minimisePrompt&&Boolean(history.state?.clikbPromptInput));
   assert.equal(await page.evaluate(()=>history.length),popup.length,'Forward reopens without growing history');
   await page.evaluate(()=>window.fixture.busy(true));await page.waitForTimeout(50);
   await page.evaluate(()=>history.back());await page.waitForTimeout(150);
   assert.equal(await page.evaluate(()=>window.fixture.state().minimisePrompt),false,'Active generation remains protected');
   assert.equal(await page.evaluate(()=>history.state.idx),popup.idx,'Protection restores the same entry');
   assert.equal(await page.evaluate(()=>history.length),popup.length,'Protection never pushes another trap entry');
   await page.evaluate(()=>window.fixture.busy(false));
   for(let cycle=0;cycle<3;cycle++){
    await page.evaluate(()=>window.fixture.compose(true));
    await page.waitForFunction(idx=>history.state?.idx===idx&&window.fixture.state().minimisePrompt,popup.idx-1);
    await page.evaluate(()=>window.fixture.compose(false));
    await page.waitForFunction(()=>Boolean(history.state?.clikbPromptInput));
    assert.equal(await page.evaluate(()=>history.length),popup.length,'Repeated X/open consumes and recreates one popup entry');
   }
   await page.evaluate(()=>history.back());
   await page.waitForFunction(()=>window.fixture.state().minimisePrompt);
   let restored=false;
   for(let step=0;step<3;step++){
    await page.goBack();await page.waitForTimeout(75);
    restored=await page.evaluate(expected=>location.pathname+location.search===expected.url&&history.state?.idx===expected.idx&&history.state?.usr?.clikbDeck?.tier===expected.tier,source);
    if(restored)break;
    assert.equal(new URL(page.url()).pathname,destination);
   }
   assert.equal(restored,true,'Later Back restores the original profile/search/feed and viewing tier');
   for(let step=0;step<4;step++){
    await page.goForward();await page.waitForTimeout(75);
    if(await page.evaluate(()=>Boolean(history.state?.clikbPromptInput)&&!window.fixture.state().minimisePrompt))break;
   }
   assert.equal(await page.evaluate(()=>history.state?.idx),popup.idx);
   assert.equal(await page.evaluate(()=>window.fixture.state().minimisePrompt),false);
   assert.equal(await page.evaluate(()=>history.length),popup.length);
   await page.locator('[data-ai-action="clikb.feeds.deck.action.close"]').click();
   await page.locator('[data-deck-overlay]').waitFor({state:'hidden'});
   await page.waitForFunction(()=>Boolean(history.state?.clikbPromptInput));
   assert.equal(await page.evaluate(()=>window.fixture.state().minimisePrompt),false,'Closing the backdrop keeps the composer open');
   await page.evaluate(()=>history.back());
   await page.waitForFunction(()=>window.fixture.state().minimisePrompt);
   assert.equal(await page.locator('[data-deck-overlay]').count(),0,'Back closes the popup and preserves the selected Grid backdrop');
   assert.equal(await page.evaluate(()=>history.state.idx),popup.idx-1);
   assert.equal(await page.evaluate(()=>history.length),popup.length);
   if(width===1280&&route==='/pages'){
    await page.evaluate(()=>window.fixture.compose(false));
    await page.waitForFunction(()=>Boolean(history.state?.clikbPromptInput));
    await page.locator('[data-ai-action="clikb.feeds.deck.action.select_category"]').click();
    await page.locator('[data-ai-action="clikb.feeds.deck.action.category.cinema"]').click();
    await page.waitForFunction(()=>location.pathname==='/kickit'&&Boolean(history.state?.clikbPromptInput));
    const cinema=await page.evaluate(()=>history.state.idx);
    await page.evaluate(()=>history.back());
    await page.waitForFunction(()=>window.fixture.state().minimisePrompt);
    assert.equal(new URL(page.url()).pathname,'/kickit');
    assert.equal(await page.locator('[data-deck-overlay]').count(),1,'Changing category while composing preserves its Deck on first Back');
    assert.equal(await page.evaluate(()=>history.state.idx),cinema-1);
   }
   assert.deepEqual(errors,[]);
   console.log('PASS PromptInput Back/X/Forward + generation protection '+width+'px '+route+' fullscreen='+fullscreen);await page.close();continue;
  }
  const addedLayers=changesRoute?2:1;
  const arrivalIndex=await page.evaluate(()=>history.state.idx);
  const arrivalLength=await page.evaluate(()=>history.length);
  // Closing Deck to Grid leaves one Forward entry; Create replaces that branch.
  assert.equal(arrivalLength,source.length-(quickCreate?1:0)+addedLayers,'Create adds only the required destination layers: '+route);
  assert.equal(arrivalIndex,source.idx+addedLayers,'Create does not replace its source');
  await page.evaluate(()=>window.fixture.compose(true));
  if(changesRoute){await page.goBack();await page.waitForFunction(()=>Boolean(window.fixture.state().state?.clikbDeckGrid));assert.equal(new URL(page.url()).pathname,destination);}
  await page.goBack();await page.waitForFunction(expected=>location.pathname+location.search===expected,source.url);
  assert.equal(await page.evaluate(()=>history.state?.usr?.clikbDeck?.tier),source.tier);
  assert.equal(await page.evaluate(()=>history.state?.usr?.clikbDeck?.activePostId),source.post);
  if(changesRoute){await page.goForward();await page.waitForFunction(target=>location.pathname===target&&Boolean(window.fixture.state().state?.clikbDeckGrid),destination);}
  await page.goForward();await page.waitForFunction(target=>location.pathname===target&&window.fixture.state().state?.clikbDeck?.tier==='deck',destination);
  assert.equal(await page.evaluate(()=>history.state.idx),arrivalIndex,'Forward does not add new entries');
  assert.equal(await page.evaluate(()=>history.length),arrivalLength,'Back/Forward does not grow history');
  console.log('PASS '+(quickCreate?'floating':'sidebar')+' Create '+width+'px '+route+' fullscreen='+fullscreen+' + Back/Forward (draft guard='+nativeGuard+')');await page.close();
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
