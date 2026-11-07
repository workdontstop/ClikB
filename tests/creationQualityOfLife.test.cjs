const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file) {
  const filename=path.resolve(root,file), mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
  mod.require=name=>name.startsWith('.')?load(path.relative(root,path.resolve(path.dirname(filename),name+'.ts'))):Module.prototype.require.call(mod,name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);return mod.exports;
}
const {buildSceneDisplayMap,sceneDisplayForTarget,sceneDisplayLabel}=load('src/creationSceneDisplay.ts');
const {resolveConciergeCreationTarget}=load('server/src/ConciergeCreationTarget.ts');
const {creationExecutionContext,compareCreationContext}=load('server/src/creationControlIdentity.ts');
const {buildDraftCreationMemory,CreationMemoryComposition,selectCreationMemoryFallback}=load('src/creationProjectMemory.ts');
const {readPendingCreationMemory}=load('server/src/creationMemoryFallback.ts');
const source=(type,index,bIndex,media={})=>({type,index,bIndex,originalIndex:0,hasPreviewImage:false,hasHdImage:false,hasVideo:false,...media});
const slots=()=>[source('A',0),source('B',0,0,{hasPreviewImage:true}),source('B',0,1),source('A',1,{},{hasVideo:true}),source('B',1,0,{hasHdImage:true})].map((s,i)=>({...s,originalIndex:i}));
const snapshotFor=(map,extra={})=>({creation:{isActive:true,projectId:'p',previewSceneCount:2,mode:'Cinema',sceneDisplayRevision:map.revision,
  sceneSlots:map.entries.map(e=>({...e,role:e.type==='B'?'b-shot':'a-shot',bShotNumber:(e.bIndex??0)+1,parentCinemaStage:e.cinemaStage})),...extra}});
test('display map numbers only materialized cards without changing native order or Cinema parent stage',()=>{
 const native=slots(), before=structuredClone(native), map=buildSceneDisplayMap(native,true);
 assert.deepEqual(native,before);assert.equal(map.entries.length,5);assert.equal(map.count,4);
 assert.deepEqual(map.entries.map(e=>e.displaySceneNumber),[1,2,undefined,3,4]);
 const b=sceneDisplayForTarget(map.entries,{type:'B',index:1,bIndex:0});
 assert.equal(b.slotKey,'B:1:0');assert.equal(b.parentDisplaySceneNumber,3);assert.equal(b.cinemaStage,'Stage B');
 assert.match(sceneDisplayLabel(b),/Scene 4.*B-roll.*Stage B.*A-roll scene 3/);
 assert.equal(resolveConciergeCreationTarget(snapshotFor(map),'go to scene 4').slotKey,'B:1:0');
 assert.equal(resolveConciergeCreationTarget(snapshotFor(map),'review scene 4').nativeSceneNumber,2);
 assert.equal(resolveConciergeCreationTarget(snapshotFor(map),'review scene 4').bShotNumber,1);
 assert.equal(resolveConciergeCreationTarget(snapshotFor(map),'go to scene 5').status,'not_found');
 assert.equal(resolveConciergeCreationTarget(snapshotFor(map),'logical scene 1 stage B').nativeSceneNumber,2);
});
test('layout changes invalidate a pending control while playback and media-quality upgrades keep numbering stable',()=>{
 const raw=slots(),map=buildSceneDisplayMap(raw,true), upgraded=buildSceneDisplayMap(raw.map(e=>({...e,hasVideo:true})),true);
 // Materializing an empty slot changes numbering; changing an existing preview to HD does not.
 assert.notEqual(map.revision,upgraded.revision);
 const hd=buildSceneDisplayMap(raw.map((e,i)=>i===1?{...e,hasPreviewImage:false,hasHdImage:true}:e),true);assert.equal(map.revision,hd.revision);
 const control={controlId:'c',actionId:'a',ownerId:'owner',handler:'setstartEdit'};
 const snap=snapshotFor(map,{controls:{areas:{grid:{areaId:'grid',state:{},controls:[control]}}}});
 const context=creationExecutionContext(snap,'a','click');assert.ok(context);
 const changed={...snap,creation:{...snap.creation,sceneDisplayRevision:upgraded.revision}};
 assert.equal(compareCreationContext(context,creationExecutionContext(changed,'a','click')).reasonCode,'version_changed');
 assert.equal(creationExecutionContext(changed,'a','click').controlId,'c');
});
const draft=()=>({creationProjectId:'p',creationType:1,sections:{prompt:{parsedKeyPoints:['Main A','Main B'],parsedKeyPoints2:['Narration'],
 ImagesHdCloud:['https://assets/full.png','https://assets/template.png'],nanoImages:['https://assets/template0.png','https://assets/template.png'],
 bShotPrompts:[['Cutaway']],bShotNanoImages:[['https://assets/b-preview.png']],bShotTextVideo:[['Cutaway motion']],
 autoDrawGuideData:[{prompt:'Camera visual guide'}]},storybook:{GeneratedText:['Paced A','Paced B'],GeneratedTextx:['Original A','Original B'],
 TextVideo:['Main motion','Stage B motion'],intentSceneBindings:[{sceneId:'scene-a'},{sceneId:'scene-b'}],
 intentBlueprintState:{scenes:{'scene-a':{intent:'Keep the cube',imagePacing:{handoff:'Avoid showing the final action early'}}}},
 imageReceipts:{'A:1':{quality:'preview'}},PlanVid:{story:'Full saved video plan'},noImagePrompt:[false,true],
 videoHistory:{'A:0':[{model:'Seedance2Mini',prompt:'Actual paid video prompt'}]}},editor:{actionImagesMap:{'B:0:0':[{name:'action1',prompt:'Close-up pose'}]},
 activeMotionImagesMap:{'A:1':[{name:'motion1',prompt:'Saved movement'}]},promptDrafts:{image:{'A:0':'Saved uncommitted image edit'},video:{'B:0:0':'Uncommitted cutaway prompt'},dirtyImage:['A:0'],dirtyVideo:['B:0:0']}}}});
test('cloud-restored draft content builds complete canonical scene and B-roll memory before an editor mounts',()=>{
 const cards=buildDraftCreationMemory(draft()),a=cards.find(c=>c.cardKey==='project:p:scene:1:state'),b=cards.find(c=>c.cardKey==='project:p:scene:1:broll:1:state');
 for(const fact of ['Paced A','Original A','Main motion','Keep the cube','Avoid showing the final action early','Narration','Camera visual guide','Actual paid video prompt','Saved uncommitted image edit'])assert.ok(a.text.includes(fact),fact);
 for(const fact of ['Cutaway motion','Close-up pose','hasPreview','previewIsFinalOutput','Uncommitted cutaway prompt'])assert.ok(b.text.includes(fact),fact);
 assert.match(cards.find(c=>c.cardKey==='project:p:scene:2:state').text,/Saved movement/);
 assert.doesNotMatch(JSON.stringify(cards),/https:\/\/assets/,'memory contains text and readiness, not raw S3 media');
 const remix=draft();remix.creationProjectId='remix';assert.ok(buildDraftCreationMemory(remix).every(c=>c.cardKey.startsWith('project:remix:')));
});
test('deleting scenes remaps explicit Direct choices with their original A-roll and B-roll owners',()=>{
 const {removeDraftScenes}=load('server/src/creationDrafts/topology.ts');const saved=draft();
 saved.sections.editor.firstFrameModeChoices={'A:0':false,'A:1':true,'B:1:0':false};
 const next=removeDraftScenes(saved,0,1,0);assert.deepEqual(next.sections.editor.firstFrameModeChoices,{'A:0':true,'B:0:0':false});
 assert.deepEqual(saved.sections.editor.firstFrameModeChoices,{'A:0':false,'A:1':true,'B:1:0':false});
});
test('memory composition is order-independent and deletions remove complete state instead of revealing stale partial state',()=>{
 const complete=buildDraftCreationMemory(draft()),composition=new CreationMemoryComposition(),partial={...complete[0],text:'Partial mount'};
 composition.update('draft',1,complete);composition.update('prompt',0,[partial]);assert.notEqual(composition.cards('p')[0].text,'Partial mount');
 composition.update('grid',2,[{...complete.at(-2),text:'Current combined grid'}]);assert.ok(composition.cards('p').some(c=>c.text==='Current combined grid'));
 const remaining=complete.filter(c=>!c.cardKey.includes(':broll:'));
 const ops=composition.update('draft',1,remaining);assert.equal(ops.find(c=>c.cardKey.includes(':broll:')).text,'');
 assert.equal(composition.cards('p').some(c=>c.cardKey.includes(':broll:')),false);
 composition.clear();assert.deepEqual(composition.cards('p'),[]);
});
test('pending sync fallback answers the displayed B-roll target and is bounded, project-scoped and read-only',()=>{
 const map=buildSceneDisplayMap(slots(),true),snap=snapshotFor(map),cards=buildDraftCreationMemory(draft());
 const fallback=selectCreationMemoryFallback(cards,'p','describe scene 2',snap.creation.sceneSlots);
 assert.equal(fallback[0].cardKey,'project:p:scene:1:broll:1:state');
 const pending={...snap,conciergeMemorySyncPending:true,creationMemoryFallback:[...fallback,{...fallback[0],cardKey:'project:someone-else:scene:1:state'}]};
 const read=readPendingCreationMemory(pending,'p',['project:p:scene:1:broll:1:state']);assert.equal(read.length,1);assert.equal(read[0].status,'current_local_pending_sync');
 assert.deepEqual(readPendingCreationMemory({...pending,conciergeMemorySyncPending:false},'p',['project:p:scene:1:broll:1:state']),[]);
 assert.deepEqual(readPendingCreationMemory(pending,'different',['project:p:scene:1:broll:1:state']),[]);
 const huge=selectCreationMemoryFallback(Array.from({length:20},(_,i)=>({cardKey:`project:p:scene_index:part:${i}`,text:'x'.repeat(50000)})),'p','scene index');
 assert.ok(huge.reduce((n,c)=>n+c.text.length,0)<=18000);assert.ok(huge.length<=4);
});
test('actual session provider composes restoration, skips identical syncs and retries failure before a question with Control Off',async()=>{
 const file=ts.createSourceFile('BrainstormSessionProvider.tsx',fs.readFileSync(path.join(root,'src/components/BrainstormSessionProvider.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const nodes=new Map();function visit(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name))nodes.set(n.name.text,n.initializer);ts.forEachChild(n,visit);}visit(file);
 function actual(name,bindings,isHook=true){const n=isHook?nodes.get(name).arguments[0]:nodes.get(name);assert.ok(n,name);const code=ts.transpileModule(`const run=${n.getText(file)}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;return Function(...Object.keys(bindings),code+';return run')(...Object.values(bindings));}
 const ref=current=>({current}),timers=new Map();let timerId=0,fail=false;const posts=[];
 const bindings={sessionIdentity:{userId:7,deviceId:'device',sessionId:'fresh'},clikUrl:'http://fixture.test',conversationModel:'Luna',
  creationMemoryPendingRef:ref(new Map()),creationMemoryLatestCardsRef:ref(new Map()),creationMemoryCompositionRef:ref(new CreationMemoryComposition()),
  creationMemoryOwnerIdentityRef:ref(''),creationMemoryHashesRef:ref(new Map()),creationMemoryLatestHashesRef:ref(new Map()),creationMemoryAutoPartCountsRef:ref(new Map()),
  creationMemoryTimerRef:ref(null),creationMemorySyncGenerationRef:ref(0),creationMemorySyncChainRef:ref(Promise.resolve()),selectedReferenceMemoryCardRef:ref(null),
  updateCreationMemoryUnsyncedState:()=>{},conversationMeasurementHeaders:()=>({}),chunkCreationMemoryText:load('src/creationMemory.ts').chunkCreationMemoryText,
  CREATION_MEMORY_DEBOUNCE_MS:650,console:{error(){}},window:{setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id},clearTimeout:id=>timers.delete(id)},
  fetch:async(url,req)=>{posts.push(JSON.parse(req.body));return {ok:!fail,status:fail?500:200}}};
 // Release only the short retry backoff; debounce is flushed explicitly.
 bindings.window.setTimeout=(fn,ms)=>{if(ms===400){queueMicrotask(fn);return ++timerId;}const id=++timerId;timers.set(id,fn);return id;};
 bindings.hashCreationMemoryCard=actual('hashCreationMemoryCard',{},false);
 bindings.flushCreationMemoryCards=actual('flushCreationMemoryCards',bindings);
 const sync=actual('syncCreationMemoryCards',bindings),wait=actual('waitForCreationMemorySync',bindings),complete=buildDraftCreationMemory(draft());
 sync(complete,{owner:'draft:p',priority:1});sync([{...complete[0],text:'incomplete early state'}],{owner:'prompt:p',priority:0});await wait();
 assert.equal(posts.length,1);assert.equal(posts[0].sessionIdentity.sessionId,'fresh');assert.ok(posts[0].operations.find(o=>o.cardKey===complete[0].cardKey).text.includes('Paced A'));
 sync(complete,{owner:'draft:p',priority:1});await wait();assert.equal(posts.length,1,'unchanged composition makes no request');
 fail=true;sync([{...complete[0],text:'Current saved edited scene'}],{owner:'draft:p',priority:1});await wait();assert.equal(posts.length,3,'at most two attempts in this flush');
 assert.notEqual(bindings.creationMemoryHashesRef.current.get(complete[0].cardKey),bindings.creationMemoryLatestHashesRef.current.get(complete[0].cardKey));
 fail=false;await wait();assert.equal(posts.length,4);assert.equal(posts[3].operations.find(o=>o.cardKey===complete[0].cardKey).text,'Current saved edited scene');
 assert.equal(bindings.creationMemoryHashesRef.current.get(complete[0].cardKey),bindings.creationMemoryLatestHashesRef.current.get(complete[0].cardKey));
 assert.equal(posts.some(post=>'autoControl' in post),false,'read-only memory synchronization does not enable controls');
});
function callback(name,bindings){const source=ts.createSourceFile('Storybook.tsx',fs.readFileSync(path.join(root,'src/Storybook.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let found;
 function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(source)===name)found=n.initializer.arguments[0];ts.forEachChild(n,visit);}visit(source);assert.ok(found,name);
 const code=ts.transpileModule(`const run=${found.getText(source)}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;return Function(...Object.keys(bindings),code+';return run')(...Object.values(bindings));}
test('actual publisher removes preview stills/fallbacks while keeping final stills and native array offsets',()=>{
 const bindings={generatedImagesFlux:['preview','full'],ImagesHdCloud:['preview-cloud','full-cloud'],isSceneImageFinal:i=>i===1,isUsableMediaUrl:x=>!!x,
 safetyImageSetsByTarget:{},safetySceneSourceUrl:url=>url};
 assert.deepEqual(callback('publishGeneratedImagesFlux',bindings)(),['','full-cloud']);
 const {hasFinalSceneImage}=load('src/sceneImageReadiness.ts');
 assert.deepEqual(callback('publishBShotImages',{hasFinalSceneImage,bShotImages:[['preview','full']],bShotNanoImages:[['preview','nano']],
 imageProvenanceRef:{current:{quality:url=>url==='preview'?'preview':'final'}},safetyImageSetsByTarget:{},safetySceneSourceUrl:url=>url})(),[['','full']]);
});
test('actual publish preflight allows Direct video without a full image and rejects preview-only required stills before work',async()=>{
 let uploads=0;const bindings={type:0,isStoryMusicVideoMode:false,steps:['1'],VideoArrayCloud:[],isValidVideo:url=>/^https:/.test(url||''),isSceneImageFinal:()=>false,
 isUsableMediaUrl:url=>/^(blob:|https:)/.test(url||''),isCloudUrl:url=>/^https:/.test(url||''),generatedAudios:[],
 uploadVisualForLambdaIfNeeded:async()=>{uploads++;return'https://assets/copied.mp4'},uploadAudioForLambdaIfNeeded:async()=>assert.fail('No audio upload expected')};
 const prepare=callback('prepareLambdaRecipeForPublish',bindings),recipe={scenes:[{visuals:[{role:'a-shot',sourceIndex:0,type:'video',url:'blob:actual-video'}]}]};
 const result=await prepare(recipe);assert.equal(result.recipe.scenes[0].visuals[0].url,'https://assets/copied.mp4');assert.equal(result.recipe.scenes[0].visuals[0].role,'a-shot');
 await assert.rejects(prepare({scenes:[]}),/Preview images are not final output/);assert.equal(uploads,1,'failed preflight performs no work');
});
