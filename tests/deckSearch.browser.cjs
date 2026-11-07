const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { build } = require('esbuild');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.tmp/deck-search');
fs.mkdirSync(output, { recursive: true });

// Actual Homepage, FeedsGate, Deck, runtime, snapshots and router. Replace only
// expensive card/fullscreen rendering, suggestions and external API transports.
const layout = `import React from 'react';export default function Layout(p){return <section data-grid-type={p.type} data-suspended={p.deckOpen}><div ref={p.feedContainerRef}>{p.feeds.map(post=><button key={post.id} data-grid-post={post.id} onClick={()=>p.handleOpenPostId(post.id,false)}>{post.caption}</button>)}</div>{p.isFullscreen&&<div data-fullscreen={p.feeds[p.activeIndex]?.id}><button onClick={p.closePop}>Back to Deck</button></div>}</section>;}`;
const guide = `import React,{useState} from 'react';import {createPortal} from 'react-dom';export function GlobalBrainstormGuide({dockHost}){const [draft,setDraft]=useState('');const content=<div data-fixture-concierge><input aria-label="Concierge draft" value={draft} onChange={e=>setDraft(e.target.value)}/></div>;return dockHost?createPortal(content,dockHost):content;}`;
const fixture = `
import React,{useState,useRef,useEffect} from 'react';import {createRoot} from 'react-dom/client';import {Provider} from 'react-redux';
import {BrowserRouter,useLocation} from 'react-router-dom';import Homepage from '/src/Homepage.tsx';import Feedgate from '/src/FeedsGate.tsx';
import {DeckRuntimeProvider} from '/src/DeckRuntimeContext.tsx';import {store} from '/src/store.ts';
import {setLoggedUser} from '/src/profileSlice.ts';
import {setAutoControlVisible,setAutoControl,setThemePreference,setDeckCleanMode} from '/src/settingsSlice.ts';
import {handleNavigationBrowserRequest,observeCurrentAppSnapshot,startNavigationActionRegistry} from '/src/navigationBrowserControl.ts';
import {feedsExecutionContext} from '/server/src/FeedsExecutionContext.ts';
store.dispatch(setAutoControlVisible({visible:true,actor:'user'}));store.dispatch(setAutoControl({enabled:true,actor:'user'}));store.dispatch(setThemePreference('dark'));
store.dispatch(setLoggedUser({id:7,name:'Owner',username:'owner',image:'',imageThumb:'',deckEnabled:true}));
// This suite exercises Normal-mode search controls; Clean default is covered by deckSettings.
store.dispatch(setDeckCleanMode(false));
window.fixture={requests:[],replies:{},snapshot:observeCurrentAppSnapshot,permission:enabled=>store.dispatch(setAutoControl({enabled,actor:'user'})),run:message=>handleNavigationBrowserRequest(message,'http://clikb.test'),context:id=>feedsExecutionContext(observeCurrentAppSnapshot().feeds,id)};
window.fetch=async(url,options)=>{if(!String(url).endsWith('/navigation/browser-reply'))throw new Error('Unexpected network call: '+url);const data=JSON.parse(options.body);window.fixture.replies[data.requestId]=data.reply;return new Response('{}',{status:200});};
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><rect width="400" height="600" fill="#35597a"/></svg>');
window.auditApi=async(url,values={})=>{if(window.fixture.blockFeeds)throw Error('Collection switching must reuse loaded rows');const endpoint=url.split('/').pop();window.fixture.requests.push({endpoint,values});const mode=endpoint.startsWith('getSearch')?values.typex:endpoint.startsWith('getFeedStory')?1:endpoint.startsWith('getFeedsclik')?2:endpoint.startsWith('getFeedsFeeds')?4:0;
 const query=values.searchData||'',base=(query?'cars'===query?10000:20000:0)+(mode+1)*100;const more=/More/.test(endpoint);await new Promise(resolve=>setTimeout(resolve,query==='slow'?250:15));if(query==='error')throw new Error('Search unavailable');
 return {data:{hasMore:query!=='counts'&&query!=='empty'&&!more,payload:query==='empty'?[]:Array.from({length:query==='counts'?(mode===0?4:mode===1?7:3):28},(_,i)=>({id:base+(more?29:1)+i,score:100-(more?28:0)-i,mode:mode===4?0:mode,caption:(query||'Browse')+' '+mode+' '+(more?29+i:1+i),username:'fixture',sender:2,item1:image,x1:image,finalTitle:(query||'Browse')+' result '+i,...(mode===2?{interactionFormat:'spatial-v1',spatialExperienceJson:'{}'}:{})}))}};};
const noop=()=>{};
function App(){const location=useLocation(),[callFeeds,setcallFeeds]=useState(true),[feeds,setFeeds]=useState([]),[lastId,setLastId]=useState(null),[minimisePrompt,setminimisePrompt]=useState(true),[isFullscreen,setIsFullscreen]=useState(false),[isFullscreen1,setIsFullscreen1]=useState(false),[isFullscreen2,setIsFullscreen2]=useState(false),[isFullscreen3,setIsFullscreen3]=useState(false),ref=useRef(null),isMenuOpen=new URLSearchParams(location.search).has('menu');
 window.fixture.compose=setminimisePrompt;
 const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);useEffect(()=>setcallFeeds(true),[location.pathname]);
 const props={callFeeds,setcallFeeds,feeds,setFeeds,LastId:lastId,setLastId,feedContainerRef:ref,isMenuOpen,setIsMenuOpen:noop,AllowPing:false,setAllowPing:noop,isFullscreen,setIsFullscreen,fluxLoaded:true,setFluxLoaded:noop,isSubmittingKick:false,setIsSubmittingKick:noop,isSubmitting:false,setIsSubmitting:noop,minimisePrompt,setminimisePrompt,MenuOpenb:false,setMenuOpenb:noop,allowUploadText:false,setallowUploadText:noop,setHideBottom:noop,setShowThumb:noop,showEmotions:false,setLikesPostid:noop,setLikes:noop,setShowEmotions:noop,isFullscreen1,setIsFullscreen1,isFullscreen2,setIsFullscreen2,isFullscreen3,setIsFullscreen3,setsearchDataNav:noop,setMyPageIdNav:noop,setfeedLastIdNav:noop,setfeedScrollPosNav:noop};
 return mounted?<DeckRuntimeProvider minimisePrompt={minimisePrompt} setminimisePrompt={setminimisePrompt} clikUrl="http://clikb.test" isMenuOpen={false} matchMobile={innerWidth<600}><main>{location.pathname==='/search'?<Homepage {...props}/>:<Feedgate {...props} type={4} vertical={true}/>}</main></DeckRuntimeProvider>:null;
}createRoot(document.getElementById('root')).render(<Provider store={store}><BrowserRouter><App/></BrowserRouter></Provider>);startNavigationActionRegistry();
`;

const moduleCache = new Map();
function loadServer(name) {
  if (moduleCache.has(name)) return moduleCache.get(name).exports;
  const filename = path.join(root, 'server/src', name + '.ts');
  const mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));moduleCache.set(name, mod);
  mod.require = id => id === './JevDecisionService' ? {consultJev:async()=>{throw Error('Live AI is disabled in search tests');}}
    : id.startsWith('.') ? loadServer(id.slice(2)) : Module.prototype.require.call(mod,id);
  mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
  return mod.exports;
}

module.exports={fixture,layout,guide};
if(require.main===module)(async () => {
 const bundled = await build({stdin:{contents:fixture,loader:'tsx',resolveDir:root},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',logLevel:'silent',loader:{'.png':'dataurl','.jpg':'dataurl','.webp':'dataurl','.css':'empty'},define:{'import.meta.env':JSON.stringify({VITE_CLIK_URL:'http://clikb.test',PROD:false})},plugins:[{name:'search-fixture',setup(build){
  build.onResolve({filter:/^(axios|.*(?:FeedLayoutHorizontal|FeedLayout|GlobalBrainstormGuide|KeywordSelector|TogglePromptButton|Footer|ProfileInfo|FullScreenStories|StoryAutoScroller|DetectDevice))$/},args=>({path:args.path,namespace:'fixture'}));
  build.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='axios'?`export default {post:(url,body)=>window.auditApi(url,body?.values),get:url=>window.auditApi(url),put:(url,body)=>window.auditApi(url,body?.values)};`:/FeedLayout/.test(args.path)?layout:/GlobalBrainstormGuide/.test(args.path)?guide:/DetectDevice/.test(args.path)?'export const matchMobile=innerWidth<600,matchPc=!matchMobile,matchTablet=false;':'export default function Stub(){return null;}',loader:'jsx',resolveDir:root}));
  build.onResolve({filter:/^\/(?:src|server)\//},args=>({path:path.join(root,args.path.slice(1))}));
 }}]});
 const html='<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#11151c;color:white;font-family:system-ui}</style><style>'+fs.readFileSync(path.join(root,'src/DeckOverlay.css'),'utf8')+'</style><div id="root"></div><script>'+bundled.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>';
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  const page=await browser.newPage({viewport:{width:1280,height:860}}),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
  await page.route('**/*',route=>route.request().isNavigationRequest()?route.fulfill({status:200,contentType:'text/html',body:html}):route.abort());
  await page.goto('http://clikb.test/feeds');
  const snapshot=()=>page.evaluate(()=>window.fixture.snapshot());
  const ready=()=>page.waitForFunction(()=>window.fixture?.snapshot().feeds?.areas['clikb.feeds.deck']?.state.status==='ready').catch(async error=>{console.error(await page.evaluate(()=>({url:location.href,requests:window.fixture?.requests,state:window.fixture?.snapshot().feeds?.areas['clikb.feeds.deck']?.state})));throw error;});
  await ready();
  let sequence=0;
  const dispatch=async(command,actionId,_version,_scroll,_direction,_confirmed,_context,text)=>{
   const requestId='search-'+(++sequence);
   await page.evaluate(message=>window.fixture.run(message),{requestId,command,actionId,text,expectedFeedsContext:_context});
   return page.evaluate(id=>window.fixture.replies[id],requestId);
  };
  const {runConciergeControlLoop}=loadServer('ConciergeControlLoop');
  const {chooseJevProposedOperation,assessJevAction}=loadServer('JevActionGate');
  const {executeApprovedConciergeOperation}=loadServer('ConciergeBrowserOperation');
  const {feedsExecutionContext}=loadServer('FeedsExecutionContext');
  const {detectVirtualGateIntent}=loadServer('VirtualGate');
  const queued=[['click','select_category'],['click','category.search'],['text','search_text','cars'],['click','run_search'],['click','select_search_section'],['click','search_section.cinema']];
  const stages=[];let lastStep;const rag='ACTIVE_SNAPSHOT_MODE_RAG_ID: clikb_deck\n'+fs.readFileSync(path.join(root,'docs/apps live rag fro app control/04_deck_overlay.rag.txt'),'utf8');
  const consult=async question=>{const data=JSON.parse(question.context||'{}');const id=data.proposedOperation?.actionId||JSON.parse(data.conciergeActionProposal||'{}').suggestedActionId;assert.ok(question.options.includes(id));return {status:'ok',answer:{choice:id}};};
  await runConciergeControlLoop({messages:[],snapshot:await snapshot(),userGoal:'I want to see videos of cars in Cinema',heartbeat:false,observationOnly:false},{
   complete:async messages=>{const lastTool=messages.findLast(message=>message.role==='tool');if(lastTool&&JSON.parse(lastTool.content).retryable===true){queued.unshift(lastStep);await ready();}const next=queued.shift();lastStep=next;if(!next)return {text:'Cars results are on your Deck.',calls:[]};return {text:'',calls:[{id:'call-'+sequence,type:'function',function:{name:'virtualGate',arguments:JSON.stringify({kind:next[0],actionId:'clikb.feeds.deck.action.'+next[1],scrollId:null,direction:null,textValue:next[2]??null,rationale:'Find the requested existing cars content while staying in Deck.'})}}]};},
   observe:async()=>({status:'observed',snapshot:await snapshot()}),
   intent:(operation,snapshot)=>detectVirtualGateIntent({latestUserText:'I want to see videos of cars',assistantText:JSON.stringify(operation),snapshot},async()=>({status:'ok',answer:{choice:'app_action_requested'}})),
   select:(proposal,snapshot)=>chooseJevProposedOperation({userGoal:'Find cars in Cinema',proposal,snapshot},consult),
   approve:(operation,snapshot,rationale)=>assessJevAction({userGoal:'Find cars in Cinema',operation,snapshot,rationale,ragContext:rag},consult),
   execute:(approval,snapshot)=>executeApprovedConciergeOperation({...approval,latestRealUserText:'I want to see videos of cars',observe:async()=>({status:'observed',snapshot:await page.evaluate(()=>window.fixture.snapshot())}),dispatch,cancelled:()=>false}),
   feedsContext:(snapshot,id)=>feedsExecutionContext(snapshot.feeds,id),snapshotText:value=>JSON.stringify(value),stage:(name,detail)=>stages.push({name,detail}),cancelled:()=>false,
  });
  assert.equal(queued.length,0,JSON.stringify(stages));await ready();
  let state=(await snapshot()).feeds.areas['clikb.feeds.deck'].state;
  const diagnostics=stages.map(({name,detail})=>({name,status:detail?.status,reason:detail?.reason,detail:detail?.detail}));
  assert.equal(state.activeCategory,'search');assert.equal(state.searchSection,'cinema',JSON.stringify(diagnostics));assert.equal(state.searchQuery,'cars');assert.equal(state.activePostId,10201);
  assert.equal(stages.filter(stage=>stage.name==='observed_success').length,6,JSON.stringify(stages));
  assert.equal(await page.locator('[data-deck-overlay]').count(),1);
  assert.equal(await page.locator('[data-grid-type][data-suspended="true"]').count(),3);
  console.log('PASS real Concierge loop → intent → typed Jev selection/approval → browser validation → Homepage queries → Cinema results in Deck; background result rows suspended.');
  await page.getByLabel('Concierge draft').fill('Keep this conversation');
  await page.getByLabel('Load next collection').click();
  await page.waitForFunction(()=>window.fixture.snapshot().feeds.areas['clikb.feeds.deck'].state.activePostId===10229);
  await page.locator('[data-ai-action="clikb.feeds.deck.action.play"]').click();await page.locator('[data-fullscreen="10229"]').waitFor();
  await page.getByText('Back to Deck',{exact:true}).click();await ready();assert.equal((await snapshot()).feeds.areas['clikb.feeds.deck'].state.activePostId,10229);
  await page.getByLabel('Close Deck to grid').click();await page.waitForFunction(()=>!document.querySelector('[data-deck-overlay]'));
  await page.locator('[data-grid-type="1"] [data-grid-post="10104"]').click();await ready();assert.equal((await snapshot()).feeds.areas['clikb.feeds.deck'].state.activePostId,10104);assert.equal((await snapshot()).feeds.areas['clikb.feeds.deck'].state.searchSection,'shorts');
  assert.equal(await page.getByLabel('Concierge draft').inputValue(),'Keep this conversation');
  console.log('PASS pagination, fullscreen → same card → search grid, inactive-row card → correct Deck row/card, retained Concierge draft.');
  await page.getByLabel('Search collection: Shorts').click();assert.equal(await page.locator('[data-ai-action="clikb.feeds.deck.action.search_section.games"]').count(),1);
  await page.locator('[data-ai-action="clikb.feeds.deck.action.search_section.games"]').click();await ready();assert.equal((await snapshot()).feeds.areas['clikb.feeds.deck'].state.activePostId,10301);
  await page.getByLabel('Load next collection').click();await page.waitForFunction(()=>window.fixture.snapshot().feeds.areas['clikb.feeds.deck'].state.activePostId===10329);
  assert.ok(await page.evaluate(()=>window.fixture.requests.some(request=>request.endpoint==='getSearchMore'&&request.values.typex===2&&request.values.cursor?.id===10328&&request.values.cursor?.score===73)));
  assert.equal((await snapshot()).feeds.areas['clikb.feeds.deck'].state.hasMore,false);
  await page.locator('[data-ai-action="clikb.feeds.deck.action.play"]').click();await page.locator('[data-fullscreen="10329"]').waitFor();await page.getByText('Back to Deck',{exact:true}).click();await ready();assert.equal((await snapshot()).feeds.areas['clikb.feeds.deck'].state.activePostId,10329);
  await page.getByLabel('Search collection: Games').click();
  await page.locator('[data-ai-action="clikb.feeds.deck.action.search_section.cinema"]').click();await ready();
  assert.ok(await page.evaluate(()=>window.fixture.requests.some(request=>request.endpoint==='getSearch'&&request.values.typex===2)));
  console.log('PASS Games query mode 2, ranked pagination cursor, exhausted result state and fullscreen → same Games Deck card.');
  await page.waitForFunction(()=>['games','shorts','cinema'].every(section=>window.fixture.snapshot().feeds.areas['clikb.feeds.deck'].state['search'+section[0].toUpperCase()+section.slice(1)+'Status']==='ready'));
  const requestsBeforeSwitch=await page.evaluate(()=>{window.fixture.blockFeeds=true;return window.fixture.requests.length;});
  for(const section of ['shorts','games','cinema']){
   await page.locator('[data-ai-action="clikb.feeds.deck.action.select_search_section"]').click();
   await page.evaluate(()=>{window.fixture.emptySwitchFrames=0;window.fixture.switchObserver=new MutationObserver(()=>{if(document.querySelector('.deck-empty'))window.fixture.emptySwitchFrames++;});window.fixture.switchObserver.observe(document.body,{subtree:true,childList:true});});
   await page.locator('[data-ai-action="clikb.feeds.deck.action.search_section.'+section+'"]').click();await ready();
   assert.equal((await snapshot()).feeds.areas['clikb.feeds.deck'].state.searchSection,section);
   assert.equal(await page.evaluate(()=>{window.fixture.switchObserver.disconnect();return window.fixture.emptySwitchFrames;}),0);
  }
  assert.equal(await page.evaluate(()=>{window.fixture.blockFeeds=false;return window.fixture.requests.length;}),requestsBeforeSwitch);
  console.log('PASS loaded collection switching works with feed transport disabled, makes zero requests and never paints an empty Deck.');
  for(let repeat=0;repeat<2;repeat++){
   const previousRequests=await page.evaluate(()=>window.fixture.requests.filter(request=>request.endpoint==='getSearch'&&request.values.searchData==='cars').length);
   await page.locator('[data-ai-action="clikb.feeds.deck.action.run_search"]').click();
   await page.waitForFunction(count=>window.fixture.requests.filter(request=>request.endpoint==='getSearch'&&request.values.searchData==='cars').length>=count+3,previousRequests);await ready();
   assert.equal((await snapshot()).feeds.areas['clikb.feeds.deck'].state.activePostId,10201);
  }
  console.log('PASS repeated Go refreshes the same query across all three rows without a stuck shared loading flag.');
  const actionId='clikb.feeds.deck.action.search_text',staleContext=await page.evaluate(id=>window.fixture.context(id),actionId);
  await page.getByLabel('Search ClikB',{exact:true}).fill('manual edit');
  let rejected=await dispatch('text',actionId,0,null,null,null,staleContext,'overwrite');assert.equal(rejected.status,'stale_or_unavailable');
  await page.evaluate(()=>window.fixture.permission(false));rejected=await dispatch('text',actionId,0,null,null,null,await page.evaluate(id=>window.fixture.context(id),actionId),'overwrite');assert.equal(rejected.status,'rejected');await page.evaluate(()=>window.fixture.permission(true));
  console.log('PASS keyword results offer Games/Shorts/Cinema; stale draft protection and Auto Control Off reject text before mutation.');
  await page.getByLabel('Search ClikB',{exact:true}).fill('slow');await page.locator('[data-ai-action="clikb.feeds.deck.action.run_search"]').click();
  await page.waitForFunction(()=>window.fixture.snapshot().feeds.areas['clikb.feeds.deck'].state.searchQuery==='slow');
  await page.getByLabel('Search ClikB',{exact:true}).fill('cars');await page.locator('[data-ai-action="clikb.feeds.deck.action.run_search"]').click();await ready();
  await page.waitForTimeout(300);assert.equal((await snapshot()).feeds.areas['clikb.feeds.deck'].state.searchQuery,'cars');assert.equal((await snapshot()).feeds.areas['clikb.feeds.deck'].state.activePostId,10201);
  console.log('PASS a new keyword request settles even when sibling rows share the loading trigger; late prior-query results cannot replace it.');
  await page.getByLabel('Search ClikB',{exact:true}).fill('counts');await page.locator('[data-ai-action="clikb.feeds.deck.action.run_search"]').click();await ready();
  await page.waitForFunction(()=>{const state=window.fixture.snapshot().feeds.areas['clikb.feeds.deck'].state;return state.searchShortsLoadedCount===4&&state.searchCinemaLoadedCount===7;});
  assert.equal((await snapshot()).feeds.areas['clikb.feeds.deck'].state.searchCollectionSections,'games,shorts,cinema');
  await page.getByLabel('Search collection: Cinema').click();assert.equal(await page.locator('.deck-search-count').nth(0).textContent(),'3 loaded');assert.equal(await page.locator('.deck-search-count').nth(1).textContent(),'4 loaded');assert.equal(await page.locator('.deck-search-count').nth(2).textContent(),'7 loaded');
  await page.locator('[data-ai-action="clikb.feeds.deck.action.search_section.shorts"]').click();await ready();assert.equal((await snapshot()).feeds.areas['clikb.feeds.deck'].state.totalCardsInBatch,4);
  assert.equal(await page.locator('[data-ai-action="clikb.feeds.deck.action.run_search"]').textContent(),'Go');
  console.log('PASS one visible result collection retains live Shorts=4/Cinema=7 loaded summaries; dropdown shows both counts and Go submits.');
  await page.getByLabel('Search ClikB',{exact:true}).fill('empty');await page.locator('[data-ai-action="clikb.feeds.deck.action.run_search"]').click();await page.waitForFunction(()=>window.fixture.snapshot().feeds.areas['clikb.feeds.deck'].state.status==='empty');
  assert.equal((await snapshot()).feeds.areas['clikb.feeds.deck'].state.totalCardsInBatch,0);
  await page.getByLabel('Search ClikB',{exact:true}).fill('error');await page.locator('[data-ai-action="clikb.feeds.deck.action.run_search"]').click();await page.waitForFunction(()=>window.fixture.snapshot().feeds.areas['clikb.feeds.deck'].state.status==='error');
  console.log('PASS empty and failed queries retain Search Deck with accurate status.');
  for(const width of [1280,768,390,320]){
   await page.setViewportSize({width,height:844});await page.goto('http://clikb.test/search?q=cars&section=shorts');await ready();
   assert.equal(await page.locator('[data-deck-overlay]').count(),1);const searchBounds=await page.locator('.deck-search-bar').boundingBox();assert.ok(searchBounds.x>=0&&searchBounds.x+searchBounds.width<=width+1);
   const bounds=await page.locator('.deck-search-form input,.deck-search-form button,.deck-search-section > button').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {y:r.y,height:r.height};}));
   assert.equal(bounds.length,3);assert.ok(bounds.every(box=>Math.abs(box.y-bounds[0].y)<1&&Math.abs(box.height-bounds[0].height)<1),`Search controls misaligned at ${width}px: ${JSON.stringify(bounds)}`);
   const nav=await page.locator('[data-ai-action="clikb.feeds.deck.action.select_category"]').boundingBox(),actions=await page.locator('.deck-top-actions').boundingBox();
   if(width>1024){assert.ok(Math.abs(nav.y-bounds[0].y)<1&&Math.abs(actions.y-bounds[0].y)<1);assert.ok(nav.x+nav.width<searchBounds.x&&searchBounds.x+searchBounds.width<actions.x);}
   else assert.ok(searchBounds.y>=Math.max(nav.y+nav.height,actions.y+actions.height));
   await page.getByLabel('Search collection: Shorts').click();await page.locator('[data-ai-action="clikb.feeds.deck.action.search_section.cinema"]').click();await ready();assert.equal((await snapshot()).feeds.areas['clikb.feeds.deck'].state.searchSection,'cinema');
   await page.screenshot({path:path.join(output,'search-'+width+'.png')});
  }
  await page.setViewportSize({width:1280,height:844});await page.goto('http://clikb.test/search?menu=1');await ready();
  const desktop=await page.locator('.deck-topbar > .deck-category-wrap > button,.deck-search-form input,.deck-search-section > button,.deck-top-actions > button').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}));
  assert.ok(desktop.every(box=>box.x>=256&&box.x+box.width<=1280&&Math.abs(box.y-desktop[0].y)<1&&Math.abs(box.height-desktop[0].height)<1),JSON.stringify(desktop));
  await page.screenshot({path:path.join(output,'search-desktop-with-menu.png')});
  assert.equal((await snapshot()).feeds.areas['clikb.feeds.deck'].state.searchSection,'games');await page.getByLabel('Search collection: Games').click();assert.equal(await page.locator('[data-ai-action="clikb.feeds.deck.action.search_section.games"]').count(),1);assert.equal(await page.locator('[data-grid-type]').count(),3);
  await page.getByRole('button',{name:'Close Deck to grid',exact:true}).click();
  await page.locator('[data-deck-overlay]').waitFor({state:'detached'});
  await page.evaluate(()=>window.fixture.compose(false));
  await page.locator('.deck-overlay--composing').waitFor();
  assert.equal(await page.locator('.deck-create').isVisible(),false);
  await page.getByRole('button',{name:'Show grid behind creation',exact:true}).click();
  await page.locator('[data-deck-overlay]').waitFor({state:'detached'});
  await page.waitForTimeout(300);
  assert.equal(await page.locator('[data-deck-overlay]').count(),0,'Grid choice persists while creation remains open');
  await page.evaluate(()=>window.fixture.compose(true));await page.waitForTimeout(50);
  await page.evaluate(()=>window.fixture.compose(false));await page.locator('.deck-overlay--composing').waitFor();
  console.log('PASS each new creation opening selects Deck; X returns to Grid without closing creation or forcing immediate Deck re-entry.');
  assert.deepEqual(errors,[]);console.log('PASS 1280/768/390/320px search input, Go and dropdown share matching top edges/heights and fit; single Deck; no browser errors or live API/AI calls.');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
