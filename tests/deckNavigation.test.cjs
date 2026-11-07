const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..');

test('creator profile entry preserves the source Deck and starts with the selected member identity', () => {
 const sourceFile = ts.createSourceFile('FeedsGate.tsx', fs.readFileSync(path.join(root, 'src/FeedsGate.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
 let callback;
 const findCallback = node => {
  if (ts.isJsxAttribute(node) && node.name.getText(sourceFile) === 'onVisitProfile' && ts.isArrowFunction(node.initializer.expression)) callback = node.initializer.expression.getText(sourceFile);
  ts.forEachChild(node, findCallback);
 };
 findCallback(sourceFile);
 assert.ok(callback, 'Exercise the actual FeedsGate creator navigation callback');
 const navigation = { exports: {} };
 const navigationCode = ts.transpileModule(fs.readFileSync(path.join(root, 'src/useDeckNavigation.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
 }).outputText;
 vm.runInNewContext(navigationCode, {
  module: navigation, exports: navigation.exports, URLSearchParams, Date, Math,
  require: () => ({}),
 });
 const callbackCode = ts.transpileModule(`module.exports = ${callback}`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
 }).outputText;
 for (const deckAllowed of [true, false]) {
  const location = { pathname: '/feeds', search: '?deck=17', hash: '#saved', state: { clikbDeck: {
   version: 1, tier: 'deck', sessionId: 'original', activePostId: 17, category: 'all', collectionIds: [17, 18],
   scroll: { x: 0, y: 322 }, returnTo: { pathname: '/feeds', search: '', hash: '#saved', state: {} },
  } } };
  const original = JSON.stringify(location);
  const calls = [];
  const compiled = { exports: {} };
  const scope = {
   module: compiled, location, deckAllowed, deckCategory: 'all', MyPageId: 0, loggedUser: { id: 7 },
   deckRouteTransition: navigation.exports.deckRouteTransition,
   deck: { close: () => calls.push('close') },
   navigate: (to, options) => calls.push({ to, options }),
  };
  vm.runInNewContext(callbackCode, scope);
  compiled.exports(235, 17);
  assert.equal(calls.length, 1);
  const { to, options } = calls[0];
  assert.equal(typeof to === 'string' ? to : to.pathname, '/pages');
  assert.equal(options.state.userId, 235);
  assert.equal(options.state.profilePostId, 17);
  assert.equal(options.replace, false);
  assert.equal(JSON.stringify(location), original);
  assert.equal(options.state.clikbDeck, undefined);
  if (deckAllowed) {
   assert.equal(options.state.clikbDeckEntrance.activePostId, 17);
   assert.equal(options.state.clikbDeckEntrance.category, 'page');
   assert.equal(options.state.clikbDeckEntrance.returnTo.state.userId, 235);
  }
  scope.deckCategory = 'page'; scope.MyPageId = 235;
  compiled.exports(235);
  assert.equal(calls.at(-1), 'close');
  const count = calls.length;
  compiled.exports(-1); compiled.exports(NaN);
  assert.equal(calls.length, count);
 }
});

test('Deck Off creates no automatic/backdrop tier and opens a post in fullscreen directly',()=>{
 const app=navigationHarness({enabled:false});app.update({enabled:true,deckEnabled:false});
 const grid=app.location();assert.equal(app.operations().length,0);
 app.update({minimisePrompt:false,creationEpoch:1});assert.equal(app.operations().length,0);
 app.act(deck=>deck.openPost(35));assert.equal(app.entries().length,2);assert.equal(app.entries()[0].state.clikbDeckGrid.restoreExact,true);
 assert.equal(app.location().state.clikbDeck.tier,'story');assert.equal(app.result().isDeckOpen,false);assert.equal(app.fullscreenCalls().at(-1),35);
 app.update({minimisePrompt:true});app.back();assert.equal(app.location().pathname,grid.pathname);assert.equal(app.location().search,grid.search);assert.equal(app.result().isDeckOpen,false);
 assert.equal(app.restores().at(-1).y,322);assert.equal(app.gridReturns().at(-1),null);
 app.forward();assert.equal(app.fullscreenCalls().at(-1),35);assert.equal(app.entries().length,2);
});

test('Deck Off suppresses old Deck entries and stale callbacks while fullscreen Back/Forward still works',()=>{
 const app=navigationHarness();app.act(deck=>deck.selectPost(17));const stale=app.result();
 app.act(deck=>deck.play());app.update({deckEnabled:false});assert.equal(app.fullscreenCalls().at(-1),17);
 app.back();assert.equal(app.result().isDeckOpen,false);const before=app.operations().length;
 app.act(()=>{stale.selectPost(18);stale.play();stale.showPage([29,30]);stale.close();});assert.equal(app.operations().length,before);
 app.forward();assert.equal(app.fullscreenCalls().at(-1),17);assert.equal(app.result().isDeckOpen,false);
 app.back();app.update({deckEnabled:true});assert.equal(app.result().isDeckOpen,true);assert.equal(app.result().activePostId,17);
});

// Production router hook with deterministic React hook and router adapters.
// StrictMode repeats first mount effects with the same ref ownership, matching
// the duplicate-history risk. Native browser Back was verified separately.
function navigationHarness({loading=false,strict=false,autoOpen=true,enabled=true,pathname='/feeds',category='all'}={}){
 const hooks=[],effects=[],owners=new Map(),frames=new Map(),restores=[],gridReturns=[],returnOrder=[],fullscreenCalls=[];let hookIndex=0,dirty=true,running=false,result,first=true,frameId=0;
 const location={pathname,search:'?existing=retained',hash:'#original',state:{existingState:'retained'},key:'initial'};
 const entries=[{...location}],operations=[];let index=0;
 const depsEqual=(one,two)=>one&&two&&one.length===two.length&&one.every((value,position)=>Object.is(value,two[position]));
 const react={useRef(initial){const i=hookIndex++;return(hooks[i]??={kind:'ref',value:{current:initial}}).value;},useCallback(fn,deps){const i=hookIndex++;if(!hooks[i]||!depsEqual(hooks[i].deps,deps))hooks[i]={kind:'memo',value:fn,deps};return hooks[i].value;},useEffect(callback,deps){const i=hookIndex++;if(!hooks[i]||!depsEqual(hooks[i].deps,deps)){const cleanup=hooks[i]?.cleanup;hooks[i]={kind:'effect',deps,callback,cleanup};effects.push(i);}}};react.useLayoutEffect=react.useEffect;react.useMemo=(factory,deps)=>react.useCallback(factory,deps)();
 function navigate(to,options={}){operations.push({to,replace:!!options.replace});if(typeof to==='number'){index+=to;assert.ok(index>=0&&index<entries.length);Object.assign(location,entries[index]);}else{const destination=typeof to==='string'?{pathname:to,search:'',hash:''}:to;const next={pathname:destination.pathname??location.pathname,search:destination.search??'',hash:destination.hash??'',state:options.state??null,key:'route-'+operations.length};if(options.replace)entries[index]=next;else{entries.splice(index+1);entries.push(next);index++;}Object.assign(location,next);}dirty=true;}
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(root,'src/useDeckNavigation.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require:name=>name==='react'?react:name==='react-router-dom'?{useLocation:()=>({...location}),useNavigate:()=>navigate}:name==='./SharedBackControl'?{registerSharedBack:(id,owner)=>{owners.set(id,owner);return()=>owners.delete(id);}}:{DECK_PAGE_SIZE:28},URLSearchParams,Date,Math,window:{history:{get state(){return {usr:location.state};}},addEventListener:()=>{},removeEventListener:()=>{}},requestAnimationFrame:callback=>{frames.set(++frameId,callback);return frameId;},cancelAnimationFrame:id=>frames.delete(id)},{filename:'useDeckNavigation.ts'});
 const options={feeds:loading?[]:Array.from({length:56},(_,i)=>({id:i+1})),category,enabled,loading,autoOpen,fullscreenPostId:null,minimisePrompt:true,getScroll:()=>({x:0,y:322}),restoreScroll:point=>{restores.push(point);returnOrder.push('restore');},onGridReturn:postId=>{gridReturns.push(postId);returnOrder.push('post');},prepareDeck:()=>{options.minimisePrompt=true;},onFullscreen:postId=>fullscreenCalls.push(postId),onCreate:()=>{options.minimisePrompt=false;dirty=true;}};
 function flush(){if(running)return;running=true;let count=0;while(dirty){assert.ok(count++<50,'Hook render loop');dirty=false;hookIndex=0;result=module.exports.useDeckNavigation(options);module.exports.useDeckCreationRequest(options.onCreate);const pending=effects.splice(0);for(const i of pending){hooks[i].cleanup?.();hooks[i].cleanup=hooks[i].callback();}if(first&&strict){for(const i of pending){hooks[i].cleanup?.();hooks[i].cleanup=hooks[i].callback();}}first=false;}for(const [id,callback]of [...frames]){frames.delete(id);callback();}running=false;}
 flush();return {result:()=>result,location:()=>({...location}),entries:()=>entries.map(entry=>({...entry})),operations:()=>operations,restores:()=>restores,gridReturns:()=>gridReturns,returnOrder:()=>returnOrder,fullscreenCalls:()=>fullscreenCalls,owners:()=>owners,cache:scope=>module.exports.cachedDeckFeeds(location.state,scope),update:patch=>{Object.assign(options,patch);dirty=true;flush();},act:callback=>{callback(result);flush();},go:steps=>{navigate(steps);flush();},back:()=>{navigate(-1);flush();},forward:()=>{navigate(1);flush();},remount:()=>{for(const hook of hooks)hook?.cleanup?.();hooks.length=0;effects.length=0;first=true;dirty=true;flush();},route:(pathname,state={},config={})=>{const transition=module.exports.deckRouteTransition(location,pathname,state,config);navigate(transition.to,transition.options);flush();}};
}

test('Search retains query/row through Deck and Grid, and search-only parameters leave with Search',()=>{
 const app=navigationHarness();app.update({category:'search',loading:true,feeds:[]});app.route('/search',{}, {search:'?q=cars&section=cinema'});
 assert.equal(app.result().isDeckOpen,true);assert.equal(app.result().cards.length,0);
 app.update({loading:false,feeds:[{id:201},{id:202}]});app.act(deck=>deck.close());assert.equal(app.location().pathname,'/search');assert.match(app.location().search,/q=cars/);assert.match(app.location().search,/section=cinema/);
 app.forward();app.update({category:'shorts'});app.route('/images');assert.equal(app.result().isDeckOpen,true);assert.doesNotMatch(app.location().search,/q=|section=/);
});

test('Create from Search or My Page enters the Shorts Deck and opens the composer',()=>{
 for (const [pathname,category] of [['/search','search'],['/pages','page']]) {
  const app=navigationHarness({pathname,category});
  if(category==='search')app.route('/search',{}, {search:'?q=Tesla&section=shorts'});
  app.act(deck=>deck.create());
  assert.equal(app.location().pathname,'/images');
  assert.equal(app.result().isDeckOpen,true);
  assert.equal(app.location().state.clikbDeck.category,'shorts');
  assert.doesNotMatch(app.location().search,/q=|section=|story=/);
  assert.equal(app.owners().size,0,'Open composer retains Back ownership');
 }
});

test('Create preserves the current regular feed Deck and selected card',()=>{
 for(const [pathname,category] of [['/feeds','all'],['/images','shorts'],['/kickit','cinema'],['/clikit','games']]) {
  const app=navigationHarness({pathname,category});app.act(deck=>deck.selectPost(17));
  const operations=app.operations().length;
  app.act(deck=>deck.create());
  assert.equal(app.location().pathname,pathname);assert.equal(app.result().isDeckOpen,true);
  assert.equal(app.result().activePostId,17);assert.equal(app.operations().length,operations);
  assert.equal(app.owners().size,0,'Open composer retains Back ownership');
 }
});

test('Create from a regular feed fullscreen preserves that fullscreen for Back and Forward',()=>{
 const app=navigationHarness({pathname:'/images',category:'shorts'});
 app.act(deck=>deck.selectPost(9));app.act(deck=>deck.play());
 const before=app.entries().length;
 app.act(deck=>deck.create());
 assert.equal(app.location().state.clikbDeck.tier,'deck');
 assert.equal(app.entries().length,before+1);
 app.update({minimisePrompt:true});app.back();
 assert.equal(app.location().state.clikbDeck.tier,'story');
 assert.equal(app.result().activePostId,9);
 app.forward();assert.equal(app.location().state.clikbDeck.tier,'deck');
 assert.equal(app.result().activePostId,9);assert.equal(app.entries().length,before+1);
});

test('inactive Search rows do not claim history; grid handoff focuses requested card in its containing page',()=>{
 const app=navigationHarness({autoOpen:false,enabled:false,pathname:'/search',category:'search'});
 app.route('/search',{}, {search:'?q=cars&section=shorts',openDeck:true,activePostId:35});assert.equal(app.result().isDeckOpen,false);assert.equal(app.owners().size,0);
 app.update({enabled:true});assert.equal(app.result().isDeckOpen,true);assert.equal(app.result().activePostId,35);assert.equal(app.result().cards[0].id,29);app.act(deck=>deck.close());assert.match(app.location().search,/section=shorts/);
});

test('a changed query cannot restore an earlier query cache under the same session',()=>{
 const app=navigationHarness();app.update({collectionScope:'search:cars'});assert.ok(app.cache('search:cars'));assert.equal(app.cache('search:clowns'),undefined);
});

test('each new creation opening activates Deck once, permits Grid while still creating, and preserves its card',()=>{
 const app=navigationHarness({autoOpen:false});assert.equal(app.result().isDeckOpen,false);
 app.update({minimisePrompt:false,creationEpoch:1});assert.equal(app.result().isDeckOpen,true);
 app.act(deck=>deck.close());assert.equal(app.result().isDeckOpen,false);
 assert.equal(app.operations().at(-1).replace,true,'Backdrop close replaces only Deck without invoking Browser Back');
 assert.equal(app.owners().size,0,'Creation retains Back ownership');
 app.update({minimisePrompt:false,creationEpoch:1});assert.equal(app.result().isDeckOpen,false);
 app.update({minimisePrompt:true});app.update({minimisePrompt:false,creationEpoch:2});assert.equal(app.result().isDeckOpen,true);
});

test('Next collection remains usable behind Creation while earlier browsing pagination is discarded',()=>{
 const app=navigationHarness();const earlier=app.result().showPage;
 app.update({minimisePrompt:false,creationEpoch:1});
 app.act(()=>earlier([29,30]));assert.equal(app.result().activePostId,1);
 app.act(deck=>deck.showPage([29,30]));assert.equal(app.result().activePostId,29);
 app.act(deck=>deck.close());assert.equal(app.result().isDeckOpen,false);
});

test('switching collections restores its selected page and card without reusing a different query scope',()=>{
 const app=navigationHarness({pathname:'/images',category:'shorts'});
 app.update({collectionScope:'shorts'});app.act(deck=>deck.showPage([29,30,31]));app.act(deck=>deck.selectPost(30));
 app.update({loading:true,feeds:[],category:'cinema',collectionScope:'cinema'});app.route('/kickit');
 app.update({loading:false,feeds:[{id:201},{id:202}]});app.act(deck=>deck.selectPost(202));
 app.update({loading:true,feeds:[],category:'shorts',collectionScope:'shorts'});app.route('/images');
 assert.equal(app.cache('shorts').activePostId,30);
 app.update({loading:false,feeds:Array.from({length:56},(_,i)=>({id:i+1}))});
 assert.equal(app.result().activePostId,30);assert.deepEqual(Array.from(app.result().cards,post=>post.id),[29,30,31]);
 app.update({loading:true,feeds:[],category:'search',collectionScope:'search:new-query:shorts'});app.route('/search',{}, {search:'?q=new-query&section=shorts'});
 assert.equal(app.cache('search:new-query:shorts'),undefined);
 app.update({loading:false,feeds:[{id:501}]});assert.equal(app.result().activePostId,501);
});
test('initial loading Deck opens once under StrictMode, fills collection and Back restores Grid without loop',()=>{
 const app=navigationHarness({loading:true,strict:true});assert.equal(app.result().isDeckOpen,true);assert.equal(app.result().activePostId,null);assert.equal(app.result().cards.length,0);assert.equal(app.entries().length,2);assert.equal(app.operations().filter(item=>!item.replace&&typeof item.to!=='number').length,1);
 app.update({loading:false,feeds:Array.from({length:56},(_,i)=>({id:i+1}))});assert.equal(app.result().activePostId,1);assert.equal(app.result().cards.length,28);assert.equal(app.entries().length,2);assert.match(app.location().search,/existing=retained/);assert.equal(app.location().hash,'#original');assert.equal(app.location().state.existingState,'retained');
 app.act(deck=>deck.close());assert.equal(app.result().isDeckOpen,false);assert.equal(app.location().pathname,'/feeds');assert.equal(app.location().search,'?existing=retained');assert.equal(app.owners().size,0);assert.equal(app.restores().at(-1).y,322);assert.equal(app.entries().length,2);
});
test('Shorts to Cinema keeps Deck while loading; Close reveals Cinema Grid with query and hash intact',()=>{
 const app=navigationHarness({pathname:'/images',category:'shorts'});const capturedShortsPage=app.result().showPage;app.update({loading:true,category:'cinema',feeds:[]});app.route('/kickit');assert.equal(app.result().isDeckOpen,true);assert.equal(app.result().cards.length,0);
 app.update({loading:false,feeds:Array.from({length:28},(_,i)=>({id:i+201}))});assert.equal(app.result().activePostId,201);assert.equal(app.result().cards.length,28);const before=app.operations().length;app.act(()=>capturedShortsPage([1,2,3]));assert.equal(app.operations().length,before);assert.equal(app.result().activePostId,201);
 app.act(deck=>deck.close());assert.equal(app.result().isDeckOpen,false);assert.equal(app.location().pathname,'/kickit');assert.equal(app.location().search,'?existing=retained');assert.equal(app.location().hash,'#original');assert.equal(app.owners().size,0);
});
test('Cinema story Back/Forward retains centered post; Deck Back/Forward retains Cinema Grid without loops',()=>{
 const app=navigationHarness({pathname:'/images',category:'shorts'});app.update({loading:true,category:'cinema',feeds:[]});app.route('/kickit');app.update({loading:false,feeds:Array.from({length:28},(_,i)=>({id:i+201}))});app.act(deck=>deck.selectPost(207));app.act(deck=>deck.play());assert.equal(app.location().state.clikbDeck.tier,'story');assert.equal(app.result().activePostId,207);
 app.back();assert.equal(app.result().isDeckOpen,true);assert.equal(app.result().activePostId,207);assert.equal(app.location().pathname,'/kickit');app.forward();assert.equal(app.location().state.clikbDeck.tier,'story');assert.equal(app.result().activePostId,207);app.back();app.back();assert.equal(app.result().isDeckOpen,false);assert.equal(app.location().pathname,'/kickit');assert.equal(app.location().search,'?existing=retained');assert.equal(app.location().hash,'#original');
 const operations=app.operations().length;app.update({loading:false});assert.equal(app.result().isDeckOpen,false);assert.equal(app.operations().length,operations);app.forward();assert.equal(app.result().isDeckOpen,true);assert.equal(app.result().activePostId,207);assert.equal(app.location().pathname,'/kickit');app.act(deck=>deck.close());assert.equal(app.result().isDeckOpen,false);assert.equal(app.location().pathname,'/kickit');
});
test('Close and native Back during Cinema loading retain Cinema Grid without later auto reentry',()=>{
 for(const nativeBack of [false,true]){const app=navigationHarness({pathname:'/images',category:'shorts'});app.update({loading:true,category:'cinema',feeds:[]});app.route('/kickit');const pendingShowPage=app.result().showPage;if(nativeBack)app.back();else app.act(deck=>deck.close());assert.equal(app.result().isDeckOpen,false);assert.equal(app.location().pathname,'/kickit');assert.equal(app.location().search,'?existing=retained');assert.equal(app.location().hash,'#original');app.update({loading:false,feeds:Array.from({length:28},(_,i)=>({id:i+201}))});assert.equal(app.result().isDeckOpen,false);const before=app.operations().length;app.act(()=>pendingShowPage([201,202]));assert.equal(app.operations().length,before);assert.equal(app.result().isDeckOpen,false);}
});
test('Create cancels captured pending collection update; auto opt-out still permits grid card entry',()=>{
 const app=navigationHarness({autoOpen:false});assert.equal(app.result().isDeckOpen,false);app.act(deck=>deck.openPost(30));assert.equal(app.result().activePostId,30);assert.equal(app.result().cards[0].id,29);const capturedShowPage=app.result().showPage;
 app.act(deck=>deck.create());assert.equal(app.result().isDeckOpen,true);const before=app.operations().length;app.act(()=>capturedShowPage([1,2,3]));assert.equal(app.result().isDeckOpen,true);assert.equal(app.operations().length,before);app.act(deck=>deck.openPost(30));assert.equal(app.result().isDeckOpen,true);assert.equal(app.result().activePostId,30);
 const direct=navigationHarness({enabled:false});assert.equal(direct.result().isDeckOpen,false);assert.equal(direct.entries().length,1);
});
test('Deck return restores the base position then focuses the centered post only once per Grid entry',()=>{
 const app=navigationHarness();app.act(deck=>deck.selectPost(17));assert.equal(app.gridReturns().length,0);app.act(deck=>deck.close());assert.equal(app.gridReturns().at(-1),17);assert.deepEqual(app.returnOrder(),['restore','post']);assert.equal(app.restores().at(-1).y,322);
 app.update({feeds:Array.from({length:84},(_,i)=>({id:i+1}))});assert.equal(app.gridReturns().length,1);assert.equal(app.restores().length,1);app.forward();assert.equal(app.result().activePostId,17);app.act(deck=>deck.selectPost(20));app.back();assert.equal(app.gridReturns().at(-1),20);assert.equal(app.gridReturns().length,2);
});
test('A loading Grid remount uses cached current Deck focus after data is ready',()=>{
 const app=navigationHarness();app.act(deck=>deck.selectPost(19));app.update({loading:true,feeds:[]});app.back();assert.equal(app.result().isDeckOpen,false);assert.equal(app.gridReturns().length,0);app.remount();assert.equal(app.gridReturns().length,0);app.update({loading:false,feeds:Array.from({length:56},(_,i)=>({id:i+1}))});assert.equal(app.result().isDeckOpen,false);assert.equal(app.gridReturns().at(-1),19);assert.deepEqual(app.returnOrder(),['restore','post']);
});
test('Fullscreen current post replaces launch identity and returns through matching Deck collection to Grid focus',()=>{
 const app=navigationHarness();app.act(deck=>deck.selectPost(5));app.act(deck=>deck.play());assert.equal(app.fullscreenCalls().at(-1),5);const storyLength=app.entries().length;app.update({fullscreenPostId:40});assert.equal(app.location().state.clikbDeck.tier,'story');assert.equal(app.result().activePostId,40);assert.equal(app.result().cards[0].id,29);assert.equal(app.entries().length,storyLength);assert.match(app.location().search,/story=40/);
 app.back();assert.equal(app.result().isDeckOpen,true);assert.equal(app.result().activePostId,40);assert.equal(app.result().cards[0].id,29);assert.equal(app.fullscreenCalls().at(-1),null);assert.equal(app.gridReturns().length,0);app.back();assert.equal(app.result().isDeckOpen,false);assert.equal(app.gridReturns().at(-1),40);assert.deepEqual(app.returnOrder(),['restore','post']);assert.equal(app.location().search,'?existing=retained');
 app.forward();assert.equal(app.result().activePostId,40);app.forward();assert.equal(app.location().state.clikbDeck.tier,'story');assert.equal(app.fullscreenCalls().at(-1),40);
});
test('Multi-step Back from fullscreen to Grid then Forward into Deck retains the actual fullscreen post',()=>{
 const app=navigationHarness();app.act(deck=>deck.selectPost(5));app.act(deck=>deck.play());app.update({fullscreenPostId:40});app.go(-2);assert.equal(app.result().isDeckOpen,false);assert.equal(app.gridReturns().at(-1),40);assert.equal(app.location().pathname,'/feeds');const historyCount=app.entries().length;
 app.forward();assert.equal(app.result().isDeckOpen,true);assert.equal(app.result().activePostId,40);assert.equal(app.result().cards[0].id,29);assert.match(app.location().search,/deck=40/);assert.equal(app.entries().length,historyCount);app.act(deck=>deck.close());assert.equal(app.result().isDeckOpen,false);assert.equal(app.gridReturns().at(-1),40);
});
