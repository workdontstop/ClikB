const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..'), port = 5218;
const output = path.join(root, '.tmp/deck');
fs.mkdirSync(output, { recursive: true });
const promptSource=ts.createSourceFile('PromptInput.tsx',fs.readFileSync(path.join(root,'src/PromptInput.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function sourceNode(predicate){let found;function visit(node){if(!found&&predicate(node))found=node;if(!found)ts.forEachChild(node,visit);}visit(promptSource);assert.ok(found,'Expected native PromptInput draft/history ownership');return found.getText(promptSource);}
const promptDeclarations=['promptRedux','artstyleRedux','modelRedux','[prompt, setPrompt]'].map(name=>'const '+sourceNode(node=>ts.isVariableDeclaration(node)&&node.name.getText(promptSource)===name)+';').join('\n');
const promptEffect=sourceNode(node=>ts.isExpressionStatement(node)&&ts.isCallExpression(node.expression)&&node.expression.expression.getText(promptSource)==='useEffect'&&node.getText(promptSource).includes('dispatch(setPromptRed(prompt))'));
const historyTrap=sourceNode(node=>ts.isExpressionStatement(node)&&ts.isCallExpression(node.expression)&&node.expression.expression.getText(promptSource)==='useEffect'&&node.getText(promptSource).includes('window.history.pushState(null'));

// Production Deck, router hook, Redux snapshot producers and action dispatcher.
// Only surrounding feed requests, fullscreen viewer and media decoder are mocked.
// Every external request is blocked; this fixture never touches the live app.
const fixture = ts.transpileModule(`
import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Provider,useSelector} from 'react-redux';
import {BrowserRouter,useLocation,useNavigate} from 'react-router-dom';
import DeckOverlay from '/src/DeckOverlay.tsx';
import {useDeckNavigation,deckRouteTransition,cachedDeckFeeds} from '/src/useDeckNavigation.ts';
import {store} from '/src/store.ts';
import {setPromptRed,setArtstyle,setModel,setAutoControl,setAutoControlVisible,setThemePreference} from '/src/settingsSlice.ts';
import {startNavigationActionRegistry,observeCurrentAppSnapshot,handleNavigationBrowserRequest} from '/src/navigationBrowserControl.ts';
import {feedsExecutionContext} from '/server/src/FeedsExecutionContext.ts';
window.mediaEvents=[];
HTMLMediaElement.prototype.play=function(){window.mediaEvents.push({kind:'play',src:this.getAttribute('src'),muted:this.muted,loop:this.loop});return window.rejectPlayback?Promise.reject(new DOMException('Fixture blocked autoplay','NotAllowedError')):Promise.resolve();};
HTMLMediaElement.prototype.pause=function(){window.mediaEvents.push({kind:'pause',src:this.getAttribute('src')});};
HTMLMediaElement.prototype.load=function(){window.mediaEvents.push({kind:'load',src:this.getAttribute('src')});};
store.dispatch(setThemePreference('dark'));
store.dispatch(setAutoControlVisible({visible:true,actor:'user'}));
store.dispatch(setAutoControl({enabled:false,actor:'user'}));
store.dispatch(setPromptRed('A saved dragon story'));
store.dispatch(setArtstyle('Watercolor'));
store.dispatch(setModel('Schnell'));
const frame='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700"><rect width="500" height="700" fill="#29485d"/><circle cx="260" cy="290" r="150" fill="#4d8aa0"/><text x="50" y="590" fill="white" font-size="38">Deck fixture</text></svg>');
const makePosts=(base=0)=>Array.from({length:56},(_,i)=>({id:base+i+1,sender:3,username:'stargazer',mode:i===2?2:0,item1:frame,x2:frame,finalTitle:i===19?'Dragon story':'Story '+(base+i+1),finalOverview:'A concise story overview '+(i+1),categories:['Fantasy'],tags:['dragon'],...(i===0?{videoUrl:'/fixture/video.mp4'}:{}),...(i===2?{videoUrl:'/fixture/game.mp4',touchConfigJson:'{}'}:{}),...(i===3?{videoUrl:'/fixture/touch.mp4',touchConfigJson:'{"regions":[{"x":0.4,"y":0.4}]}'}:{}),...(i===4?{videoUrl:'/fixture/spatial.mp4',interactionFormat:'spatial-v1',spatialExperienceJson:'{}'}:{})}));
const categories={all:'/feeds',shorts:'/images',cinema:'/kickit',games:'/clikit',page:'/pages'};
const categoryFor=pathname=>Object.entries(categories).find(([,route])=>route===pathname)?.[0]||'all';
let composerMounts=0;
function Composer({minimisePrompt,onMinimize}){
 const dispatch=store.dispatch;
 ${promptDeclarations}
 const [localDraft,setLocalDraft]=useState('Saved local configuration');
 useEffect(()=>{composerMounts++;},[]);
 // Native PromptInput draft sync and history trap, without generation/provider calls.
 ${promptEffect}
 ${historyTrap}
 return <section id="composer" style={{display:minimisePrompt?'none':'block',position:'fixed',inset:'0 0 auto 20%',height:210,zIndex:500,background:'#252932',padding:15}}>
  <input aria-label="Creation prompt" value={prompt} onChange={e=>setPrompt(e.target.value)}/>
  <output id="draft-style">{artstyleRedux}</output><output id="draft-model">{modelRedux}</output>
  <input aria-label="Local creation config" value={localDraft} onChange={e=>setLocalDraft(e.target.value)}/>
  <button onClick={onMinimize}>Minimize composer</button>
 </section>;
}
function App(){
 const location=useLocation(),navigate=useNavigate(),category=categoryFor(location.pathname);
 const [feeds,setFeeds]=useState(()=>new URLSearchParams(location.search).has('empty')?[]:makePosts()),[loading,setLoading]=useState(false),[minimisePrompt,setMinimisePrompt]=useState(true),[fullscreen,setFullscreen]=useState(null),[guest,setGuest]=useState(true),[loginOpen,setLoginOpen]=useState(false),[isMenuOpen,setMenuOpen]=useState(innerWidth>700),[dockHost,setDockHost]=useState(null);
 const categoryRef=useRef(category),scrollRef=useRef({x:0,y:322});
 const [loadedCategory,setLoadedCategory]=useState(category);
 const prepareDeck=useCallback(()=>flushSync(()=>setMinimisePrompt(true)),[]);
 const onCreate=useCallback(()=>setMinimisePrompt(false),[]),onFullscreen=useCallback(id=>setFullscreen(id),[]);
 const getScroll=useCallback(()=>scrollRef.current,[]),restoreScroll=useCallback(point=>{scrollRef.current=point;},[]);
 const deck=useDeckNavigation({feeds,category,enabled:!location.pathname.startsWith('/experience/'),autoOpen:!new URLSearchParams(location.search).has('no_auto'),loading:loading||loadedCategory!==category,minimisePrompt,prepareDeck,onFullscreen,getScroll,restoreScroll,onCreate});
 useEffect(()=>{
  if(categoryRef.current===category)return;
  categoryRef.current=category;setLoading(true);setFeeds([]);
  const timer=setTimeout(()=>{setFeeds(cachedDeckFeeds(location.state)?.feeds||makePosts(category==='cinema'?200:category==='shorts'?100:0));setLoadedCategory(category);setLoading(false);},80);
  return()=>clearTimeout(timer);
 },[category]);
 const chooseCategory=next=>{if(next==='page'&&guest){setLoginOpen(true);return;}prepareDeck();const transition=deckRouteTransition(location,categories[next]);navigate(transition.to,transition.options);};
 const paginate=()=>{setLoading(true);setTimeout(()=>{deck.showPage(feeds.slice(28,56).map(post=>post.id));setLoading(false);},80);};
 window.test={snapshot:observeCurrentAppSnapshot,area:()=>store.getState().brainstorm.userSnapshot.feeds?.areas['clikb.feeds.deck'],
  state:()=>({isDeckOpen:deck.isDeckOpen,ownsHistory:deck.ownsHistory,activePostId:deck.activePostId,collection:deck.cards.map(post=>post.id),category,minimisePrompt,fullscreen,loginOpen,scroll:scrollRef.current,composerMounts,url:location.pathname+location.search+location.hash}),
  permission:enabled=>store.dispatch(setAutoControl({enabled,actor:'user'})),guest:enabled=>setGuest(enabled),menu:enabled=>setMenuOpen(enabled),loading:setLoading,
  grid:postId=>deck.openPost(postId),select:deck.selectPost,category:chooseCategory,play:deck.play,close:deck.close,create:deck.create,
  run:message=>handleNavigationBrowserRequest(message,window.location.origin),context:actionId=>feedsExecutionContext(observeCurrentAppSnapshot().feeds,actionId),media:()=>window.mediaEvents,clearMedia:()=>{window.mediaEvents=[];},reject:enabled=>{window.rejectPlayback=enabled;}};
 return <>
  <aside style={{position:'fixed',top:0,left:0,bottom:0,width:'20%',display:isMenuOpen?'block':'none',background:'#1b2330',padding:8,boxSizing:'border-box'}}>
   <p>Sidebar</p><button onClick={()=>chooseCategory('cinema')}>Sidebar Cinema</button><button onClick={()=>chooseCategory('shorts')}>Sidebar Shorts</button>
  </aside>
  <main className={isMenuOpen?'content-with-menu':'content-full'} style={{position:'relative',marginLeft:isMenuOpen?'20%':0,width:isMenuOpen?'80%':'100%',minHeight:'100vh'}}>
   <div id="grid" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,padding:20}}>{feeds.map(post=><button key={post.id} data-grid-post={post.id} onClick={()=>deck.openPost(post.id)} style={{height:110}}>Grid {post.id}</button>)}</div>
   {deck.isDeckOpen&&!fullscreen&&<DeckOverlay cards={deck.cards} activePostId={deck.activePostId} category={category} loading={loading} hasMore={deck.cards[0]?.id===feeds[0]?.id} error={null} onSelectPost={deck.selectPost} onPlay={deck.play} onPaginate={paginate} onCategory={chooseCategory} onClose={deck.close} onCreate={deck.create} onDockHost={setDockHost} isMenuOpen={isMenuOpen}/>} 
  </main>
  <Composer key={category} minimisePrompt={minimisePrompt} onMinimize={()=>setMinimisePrompt(true)}/>
  {fullscreen!==null&&<div id="fullscreen" style={{position:'fixed',inset:0,zIndex:1000,background:'#101720',padding:30}}>Fullscreen {fullscreen}<button onClick={deck.close}>Close fullscreen</button></div>}
  {loginOpen&&<div role="dialog" aria-label="Login" style={{position:'fixed',inset:'25%',zIndex:1500,background:'#3b4250'}}>Login requested</div>}
  {dockHost&&<span id="fixture-guide">Existing concierge host</span>}
 </>;
}
createRoot(document.getElementById('root')).render(<Provider store={store}><BrowserRouter><App/></BrowserRouter></Provider>);
startNavigationActionRegistry();
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;

(async () => {
 const {createServer}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')));
 const replies=new Map();
 const server=await createServer({root,configFile:false,logLevel:'error',cacheDir:path.join(output,'browser-vite'),optimizeDeps:{noDiscovery:true,include:['react','react/jsx-runtime','react/jsx-dev-runtime','react-dom','react-dom/client','react-redux','react-router-dom','@reduxjs/toolkit','@mui/material','@mui/material/styles','prop-types','react-is','@emotion/react','@emotion/styled','axios']},esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port,strictPort:true,hmr:false},plugins:[{
  name:'deck-overlay-fixture',resolveId:id=>id==='/deck-fixture.js'?'\0deck-fixture':undefined,load:id=>id==='\0deck-fixture'?fixture:undefined,
  configureServer(s){s.middlewares.use((req,res,next)=>{
   if(/^\/(feeds|images|kickit|clikit|pages|experience\/\d+)(\?|$)/.test(req.url)){res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#11151c;color:white;font-family:system-ui}button{padding:8px}</style><div id="root"></div><script type="module" src="/deck-fixture.js"></script>');return;}
   if(req.url==='/navigation/browser-reply'){let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{const data=JSON.parse(body);replies.set(data.requestId,data.reply);res.setHeader('Content-Type','application/json');res.end('{}');});return;}
   if(req.url.startsWith('/fixture/')){res.statusCode=204;res.end();return;}
   next();
  });}
 }]});await server.listen();
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  const context=await browser.newContext({viewport:{width:1280,height:860}}),page=await context.newPage(),errors=[];
  page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:'+port+'/')?route.continue():route.abort());
  const state=()=>page.evaluate(()=>window.test.state()),area=()=>page.evaluate(()=>window.test.area());
  const ready=()=>page.waitForFunction(()=>window.test?.state().isDeckOpen&&window.test?.area()?.state.totalCardsInBatch===28);
  const action=id=>page.locator('[data-ai-action="clikb.feeds.deck.action.'+id+'"]');
  let sequence=0;
  async function ai(id){const actionId='clikb.feeds.deck.action.'+id;await page.waitForFunction(id=>window.test.snapshot().feeds.availableActions.some(action=>action.actionId===id),actionId);const expectedFeedsContext=await page.evaluate(id=>window.test.context(id),actionId),requestId='deck-'+(++sequence);await page.evaluate(message=>window.test.run(message),{command:'action',actionId,expectedFeedsContext,requestId});assert.ok(replies.has(requestId));return replies.get(requestId);}

  await page.goto('http://127.0.0.1:'+port+'/feeds?existing=retained#grid',{waitUntil:'domcontentloaded'});await ready();
  assert.equal((await state()).minimisePrompt,true);assert.match((await state()).url,/existing=retained/);assert.match((await state()).url,/#grid$/);
  assert.equal((await area()).visiblePosts.length,3);assert.equal((await area()).state.totalCardsInBatch,28);
  assert.equal(await page.locator('video').count(),1);const media=await page.evaluate(()=>window.test.media());assert.ok(media.some(event=>event.kind==='play'&&event.muted&&event.loop));
  await page.screenshot({path:path.join(output,'deck-desktop.png')});
  // Actual pointer drag, release and cancel exercise the production gesture owner.
  const center=await page.locator('.deck-card--active').boundingBox();
  const start={x:center.x+center.width/2,y:center.y+center.height*.35};
  async function drag(dx){await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+dx,start.y,{steps:8});await page.mouse.up();}
  await drag(-100);await page.waitForFunction(()=>window.test.state().activePostId===2);assert.equal((await state()).fullscreen,null);assert.equal((await state()).isDeckOpen,true);
  await drag(100);await page.waitForFunction(()=>window.test.state().activePostId===1);assert.equal((await state()).fullscreen,null);
  await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x-100,start.y,{steps:8});await page.locator('.deck-stage').evaluate(stage=>stage.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true})));await page.mouse.up();assert.equal((await state()).activePostId,1);
  await page.evaluate(()=>window.test.loading(true));await drag(-100);assert.equal((await state()).activePostId,1);await page.evaluate(()=>window.test.loading(false));
  await page.locator('.deck-stage').evaluate(stage=>{stage.dispatchEvent(new WheelEvent('wheel',{deltaX:35,deltaY:0,bubbles:true,cancelable:true}));stage.dispatchEvent(new WheelEvent('wheel',{deltaX:35,deltaY:0,bubbles:true,cancelable:true}));});await page.waitForFunction(()=>window.test.state().activePostId===2);
  await page.locator('.deck-stage').evaluate(stage=>{stage.dispatchEvent(new WheelEvent('wheel',{deltaX:80,deltaY:0,bubbles:true,cancelable:true}));stage.dispatchEvent(new WheelEvent('wheel',{deltaX:0,deltaY:80,bubbles:true,cancelable:true}));});assert.equal((await state()).activePostId,2);
  await page.evaluate(()=>window.test.select(1));await page.waitForFunction(()=>window.test.state().activePostId===1);
  console.log('PASS gestures: desktop drags cycle both directions once, cancelled/loading drags stay put, horizontal wheel threshold/cooldown and vertical wheel exclusion, no fullscreen or overlay dismissal');
  await action('cycle_next').click();await page.waitForFunction(()=>window.test.state().activePostId===2);
  assert.equal((await state()).collection.length,28);assert.equal(await page.locator('video').count(),0);assert.ok((await page.evaluate(()=>window.test.media())).some(event=>event.kind==='pause'));
  await page.evaluate(()=>window.test.permission(true));await page.waitForFunction(()=>window.test.area().collectionPosts?.length===28);
  let reply=await ai('jump_to.20');assert.equal(reply.status,'observed_change');assert.equal((await state()).activePostId,20);
  fs.writeFileSync(path.join(output,'browser-verified-snapshot.json'),JSON.stringify(await page.evaluate(()=>window.test.snapshot()),null,2));
  reply=await ai('cycle_next');assert.equal(reply.status,'observed_change');assert.equal((await state()).activePostId,21);
  await page.evaluate(()=>window.test.permission(false));await page.waitForFunction(()=>window.test.area().visiblePosts.length===3&&!window.test.area().collectionPosts);
  const refused=await page.evaluate(async()=>{const actionId='clikb.feeds.deck.action.cycle_next';await window.test.run({command:'action',actionId,expectedFeedsContext:window.test.context(actionId),requestId:'refused'});});
  assert.equal(replies.get('refused').status,'rejected');assert.equal((await state()).activePostId,21);
  console.log('PASS Deck: live Off three/On 28 context, bounded post metadata, real AI direct snap/cycle and permission stop; no feed collection discard');

  await action('play').click();await page.waitForFunction(()=>window.test.state().fullscreen===21);
  await page.goBack();await page.waitForFunction(()=>window.test.state().fullscreen===null&&window.test.state().isDeckOpen);
  assert.equal((await state()).activePostId,21);assert.equal((await state()).collection.length,28);
  await page.goForward();await page.waitForFunction(()=>window.test.state().fullscreen===21);
  await page.getByRole('button',{name:'Close fullscreen'}).click();await page.waitForFunction(()=>window.test.state().fullscreen===null&&window.test.state().isDeckOpen);
  await action('close').click();await page.waitForFunction(()=>!window.test.state().isDeckOpen);assert.equal((await state()).scroll.y,322);
  await page.goForward();await ready();assert.equal((await state()).activePostId,21);
  await action('open_create').click();await page.waitForFunction(()=>!window.test.state().isDeckOpen&&!window.test.state().minimisePrompt);
  await page.getByLabel('Creation prompt').fill('Edited saved dragon story');await page.getByLabel('Local creation config').fill('Edited local configuration');
  const mounts=(await state()).composerMounts;
  await page.evaluate(()=>window.test.grid(30));await ready();assert.equal((await state()).activePostId,30);assert.deepEqual((await state()).collection,Array.from({length:28},(_,i)=>i+29));
  await action('open_create').click();await page.waitForFunction(()=>!window.test.state().minimisePrompt);
  assert.equal(await page.getByLabel('Creation prompt').inputValue(),'Edited saved dragon story');assert.equal(await page.getByLabel('Local creation config').inputValue(),'Edited local configuration');assert.equal((await state()).composerMounts,mounts);assert.equal(await page.locator('#draft-style').textContent(),'Watercolor');assert.equal(await page.locator('#draft-model').textContent(),'Schnell');
  await page.evaluate(()=>window.test.grid(30));await ready();await page.getByRole('button',{name:'Sidebar Cinema'}).click();await page.waitForFunction(()=>window.test.state().category==='cinema');assert.equal((await state()).isDeckOpen,true);await page.waitForFunction(()=>window.test.state().isDeckOpen&&window.test.state().category==='cinema'&&window.test.state().activePostId===201).catch(async error=>{console.error('Category failure state',await state(),'errors',errors);throw error;});
  assert.equal((await state()).collection[0],201);assert.equal((await state()).minimisePrompt,true);assert.equal(await page.evaluate(()=>window.test.snapshot().feeds.areas['clikb.feeds.deck'].state.activeCategory),'cinema');
  await action('open_create').click();await page.waitForFunction(()=>!window.test.state().minimisePrompt);assert.equal((await state()).category,'cinema');assert.equal(await page.getByLabel('Creation prompt').inputValue(),'Edited saved dragon story');assert.equal(await page.locator('#draft-style').textContent(),'Watercolor');assert.equal(await page.locator('#draft-model').textContent(),'Schnell');
  console.log('PASS navigation: initial Back/Forward, fullscreen Back/Forward/Close, original grid location, card 30 page slice, composer trap cleanup, local drafts retained on minimize and Redux prompt/style/model across category');

  await page.evaluate(()=>window.test.grid(201));await ready();await action('paginate').click();await page.waitForFunction(()=>window.test.state().activePostId===229);assert.equal((await state()).collection.length,28);
  await page.getByRole('button',{name:'Sidebar Shorts'}).click();await page.waitForFunction(()=>window.test.state().category==='shorts'&&window.test.state().activePostId===101);assert.equal((await state()).collection[0],101);
  await action('select_category').click();await action('category.page').click();await page.getByRole('dialog',{name:'Login'}).waitFor();assert.equal((await state()).category,'shorts');assert.equal((await state()).isDeckOpen,true);
  console.log('PASS category/pagination: next bounded collection, category resets batch and centered card, guest My Page retains Deck and requests login');

  await page.goto('http://127.0.0.1:'+port+'/feeds',{waitUntil:'domcontentloaded'});await ready();
  for(const id of [3,4,5]){await page.evaluate(id=>window.test.select(id),id);await page.waitForFunction(id=>window.test.state().activePostId===id,id);assert.equal(await page.locator('video').count(),0);}
  await page.evaluate(()=>{window.test.reject(true);window.test.select(1);});await page.waitForFunction(()=>window.test.state().activePostId===1);await page.waitForFunction(()=>window.test.media().filter(event=>event.kind==='play').length>=2);
  assert.equal(await page.locator('video').evaluate(video=>video.muted),true);await action('toggle_mute').click();assert.equal(await page.locator('video').evaluate(video=>video.muted),false);
  await page.evaluate(()=>window.test.select(2));await page.waitForFunction(()=>window.test.state().activePostId===2);assert.equal(await page.locator('video').count(),0);
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.test.menu(false));await page.screenshot({path:path.join(output,'deck-mobile.png')});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
  assert.deepEqual(errors,[]);
  console.log('PASS media/responsive: games/touch/spatial stay static, autoplay rejection contained, mute parity and inactive media disposed; desktop/mobile screenshots, no page errors');

  await page.goto('http://127.0.0.1:'+port+'/feeds?no_auto=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.test);
  assert.equal((await state()).isDeckOpen,false);await page.evaluate(()=>window.test.grid(30));await ready();assert.equal((await state()).activePostId,30);await action('close').click();await page.waitForFunction(()=>!window.test.state().isDeckOpen);
  await page.goto('http://127.0.0.1:'+port+'/feeds?empty=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.test?.area()?.state.totalCardsInBatch===0);
  assert.equal((await state()).isDeckOpen,true);assert.equal((await state()).activePostId,null);assert.equal(await action('play').count(),0);assert.equal(await action('open_create').isEnabled(),true);await page.goBack();await page.waitForFunction(()=>!window.test.state().isDeckOpen);assert.equal((await state()).url,'/feeds?empty=1');
  await page.goto('http://127.0.0.1:'+port+'/experience/51?existing=keep#direct',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.test);
  assert.equal((await state()).isDeckOpen,false);assert.equal((await state()).url,'/experience/51?existing=keep#direct');assert.equal(await page.locator('[data-deck-overlay]').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS entry guards: opt-out skips auto entrance while grid cards still open Deck, empty collection opens/unwinds safely, direct experience route receives no automatic Deck');
 } finally {await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
