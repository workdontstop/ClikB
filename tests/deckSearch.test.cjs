const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(file,mocks){const filename=path.join(root,file);if(!mocks&&cache.has(filename))return cache.get(filename).exports;const mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));if(!mocks)cache.set(filename,mod);mod.require=name=>mocks?(Object.hasOwn(mocks,name)?mocks[name]:name.startsWith('.')?{}:Module.prototype.require.call(mod,name)):name==='./JevDecisionService'?{consultJev:async()=>{throw Error('Live AI disabled');}}:name.startsWith('.')?load(path.relative(root,path.resolve(path.dirname(filename),name+'.ts'))):Module.prototype.require.call(mod,name);mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,filename);return mod.exports;}

test('VirtualGate permits only the live Deck search text address and bounds its value',()=>{
 const {virtualGateOperation}=load('server/src/ConciergeTools.ts');
 const args={kind:'text',actionId:'clikb.feeds.deck.action.search_text',scrollId:null,direction:null,textValue:'cars',rationale:'Find existing cars posts'};
 assert.equal(virtualGateOperation(args).text,'cars');assert.throws(()=>virtualGateOperation({...args,textValue:'x'.repeat(501)}));
 for(const actionId of ['clikb.feeds.deck.action.run_search','clikb.feeds.search.action.caption','clikb.settings.action.search_text'])assert.throws(()=>virtualGateOperation({...args,actionId}));
});

test('natural browsing requests retain an autonomous task without interpreting them as media creation',()=>{
 const continuation=load('src/autoControlContinuation.ts'),{isConciergeActionGoal}=load('server/src/ConciergeRecovery.ts');
 for(const goal of ['I want to see videos of cars','Search for clowns','Find cars','Browse Cinema']){continuation.clearAutoControlTask();continuation.noteAutoControlUserTurn(goal);continuation.noteAutoControlGateStage('app_action_requested');assert.equal(continuation.getAutoControlTask().goal,goal);assert.equal(isConciergeActionGoal(goal),true);}
 continuation.clearAutoControlTask();continuation.noteAutoControlUserTurn('Why does search work this way?');assert.equal(continuation.getAutoControlTask(),null);
});

test('Search landing and keyword results offer Games, Shorts and Cinema independently',()=>{
 const {buildDeckSnapshot}=load('src/deckControlSnapshot.ts');
 const base={cards:[],activePostId:null,category:'search',loading:false,hasMore:false,error:null,muted:true,autoControlEnabled:true,categorySelectorOpen:false,mediaPlaying:false,autoplayBlocked:false};
 const landing=buildDeckSnapshot({...base,search:{section:'shorts',query:'',input:'',selectorOpen:true}});
 assert.ok(landing.visibleControls.some(control=>control.candidateActionId==='clikb.feeds.deck.action.search_section.games'));
 const results=buildDeckSnapshot({...base,search:{section:'shorts',query:'cars',input:'cars',selectorOpen:true}});
 assert.ok(results.visibleControls.some(control=>control.candidateActionId==='clikb.feeds.deck.action.search_section.games'));
 assert.ok(results.visibleControls.some(control=>control.candidateActionId==='clikb.feeds.deck.action.search_section.cinema'));
});

test('Creation backdrop advertises retained top controls and hides post playback/context controls',()=>{
 const {buildDeckSnapshot}=load('src/deckControlSnapshot.ts');
 const snapshot=buildDeckSnapshot({cards:[{id:1,item1:'image.webp'}],activePostId:1,category:'all',loading:false,hasMore:true,error:null,muted:true,autoControlEnabled:true,categorySelectorOpen:false,mediaPlaying:false,autoplayBlocked:false,composing:true});
 assert.equal(snapshot.state.creationBackdrop,true);assert.equal(snapshot.state.contextPostCount,0);
 assert.deepEqual(snapshot.visiblePosts,[]);assert.equal(snapshot.collectionPosts,undefined);
 const ids=snapshot.visibleControls.map(c=>c.candidateActionId.split('.action.')[1]);
 assert.deepEqual(ids,['select_category','paginate','close']);
 const {feedsActionObserved}=load('server/src/FeedsExecutionContext.ts');
 const before={visibleControls:[{areaId:'clikb.feeds.deck',candidateActionId:'clikb.feeds.deck.action.open_create'}],areas:{'clikb.feeds.deck':{state:{isOpen:true}}}};
 assert.equal(feedsActionObserved(before,{areas:{'clikb.feeds.deck':snapshot}},'clikb.feeds.deck.action.open_create',{ui:{minimisePrompt:false}}),true);
});

test('publication accepts explicit natural consent but never stop-at/before instructions',()=>{
 const {confirmedCreationControl}=load('server/src/CreationExecutionContext.ts');
 for(const key of ['publish','process_video','save_post','publish_spatial','publish_music_video']){
  const control={policy:'needs_confirmation',actionId:'clikb.creation.storybook_publish.action.'+key,controlId:key,label:key==='publish'?'Publish':'Process and publish the video'};
  for(const text of ['publish','yes publish it','confirm publish','publish it now'])assert.equal(confirmedCreationControl(text,control),key,text);
  for(const text of ['stop at Publish','stop before Process and publish the video','can I publish it?','I will publish later','do not publish','not yet','continue first then publish I assume'])assert.equal(confirmedCreationControl(text,control),undefined,text);
 }
});

test('Search summarizes all result rows with their own counts, loading and pagination facts',()=>{
 const {deckSearchCollections,buildDeckSnapshot}=load('src/deckControlSnapshot.ts');
 const area=(query,count,status='ready',hasMore=false)=>({state:{route:'/search',query,loadedCount:count,status,hasMore}});
 const areas={'clikb.feeds.context.search.shorts':area('cars',4),'clikb.feeds.context.search.cinema':area('cars',7,'ready',true),'clikb.feeds.context.search.games':area('cars',3)};
 const collections=deckSearchCollections('cars',areas);
 assert.deepEqual(collections,[{section:'games',loadedCount:3,status:'ready',hasMore:false},{section:'shorts',loadedCount:4,status:'ready',hasMore:false},{section:'cinema',loadedCount:7,status:'ready',hasMore:true}]);
 assert.equal(deckSearchCollections('',areas).length,3);
 assert.equal(deckSearchCollections('clowns',areas)[0].loadedCount,0);
 assert.equal(deckSearchCollections('clowns',areas)[0].status,'loading');
 const state=buildDeckSnapshot({cards:[],activePostId:null,category:'search',loading:false,hasMore:false,error:null,muted:true,autoControlEnabled:true,categorySelectorOpen:false,mediaPlaying:false,autoplayBlocked:false,search:{section:'shorts',query:'cars',input:'cars',selectorOpen:false,collections}}).state;
 assert.equal(state.searchShortsLoadedCount,4);assert.equal(state.searchCinemaLoadedCount,7);assert.equal(state.searchCinemaHasMore,true);assert.equal(state.searchGamesLoadedCount,3);assert.equal(state.searchCollectionSections,'games,shorts,cinema');
});
