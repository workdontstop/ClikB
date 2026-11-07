const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
const Module=require('node:module'),cache=new Map();
function load(file){const filename=path.resolve(root,file);if(cache.has(filename))return cache.get(filename).exports;const mod=new Module(filename,module);cache.set(filename,mod);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=name=>name.startsWith('.')?load(path.relative(root,path.resolve(path.dirname(filename),name+'.ts'))):Module.prototype.require.call(mod,name);mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);return mod.exports;}
const exportsMock=load('server/src/spatialActionUpdate.ts');
const {buildSpatialActionUpdate,spatialActionUpdateInstruction}=exportsMock;
const camera={t:0,position:[0,3,6],target:[0,0,0],fov:45};
const transform=position=>({t:0,position,rotation:[0,0,0],scale:[1,1,1]});
const fixture=()=>({sceneId:'A',activeNodeId:'action-start',nodes:[{id:'root',frameUrl:'real-stage.png'},{id:'action-start',frameUrl:'three-proxy.png'}],ledger:{
 world:{sourceImage:'original-stage.png',controlledObject:'rider',drivenName:'Knight',controlMode:'character',initialState:{objects:{rider:{transform:transform([0,0,0]),facts:{pose:'standing'}}},camera},plan:{version:1,duration:5,background:'#ffffff',objects:[{id:'rider',identity:'Knight',shape:'box',color:'#ffffff',keys:[transform([0,0,0]),{...transform([0,0,0]),t:5}]}],camera:[camera,{...camera,t:5}]}},
 states:{'action-start':{objects:{dragon:{transform:transform([0,1,2]),facts:{pose:'mounted'}},rider:{transform:transform([0,2,2]),facts:{equipment:'silver sword',pose:'riding'}}},relationships:[{from:'rider',to:'dragon',relation:'riding'}],conditions:{weather:'snow'},camera}},
 nodeContexts:{'action-start':{frameUrl:'three-action-anchor.png',motionContext:{primaryMotion:'The knight is mounted on the dragon.'}}},jobs:[{secret:'unused receipt'}],routes:{unneeded:'animation'}
}});
test('setup rewrite attaches the original stage image and the current action state without proxy images or full scene history',()=>{
 const body=buildSpatialActionUpdate(fixture());assert.equal(body.imageUrl,'original-stage.png');assert.equal(body.spatialActionContext.mode,'spatial-action-setup');
 assert.equal(body.spatialActionContext.objects[0].id,'rider');assert.equal(body.spatialActionContext.objects[0].facts.pose,'riding');assert.deepEqual(body.spatialActionContext.relationships,[{from:'rider',to:'dragon',relation:'riding',facts:{}}]);
 assert.doesNotMatch(JSON.stringify(body),/three-proxy|three-action-anchor|unused receipt|unneeded|standing/);
 assert.match(spatialActionUpdateInstruction(body.spatialActionContext),/updating the prompt for one action/);assert.match(spatialActionUpdateInstruction(body.spatialActionContext),/image may depict an earlier state/);
});
test('a missing later-node state never falls back to the starting pose; root and legacy fallback remain valid',()=>{
 const scene=fixture();delete scene.ledger.states['action-start'];assert.deepEqual(buildSpatialActionUpdate(scene).spatialActionContext.objects,[]);
 scene.activeNodeId='root';assert.equal(buildSpatialActionUpdate(scene).spatialActionContext.objects[0].facts.pose,'standing');scene.ledger.world.sourceImage='';assert.equal(buildSpatialActionUpdate(scene).imageUrl,'real-stage.png');
 delete scene.ledger;assert.equal(buildSpatialActionUpdate(scene),undefined);assert.equal(spatialActionUpdateInstruction({mode:'normal-video'}),'');
});
test('current-state instructions bound objects, facts and relationships and reject invalid coordinates',()=>{
 const scene=fixture(),state=scene.ledger.states['action-start'];state.objects=Object.fromEntries(Array.from({length:40},(_,i)=>['object-'+i,{transform:{position:[0,NaN,0]},facts:Object.fromEntries(Array.from({length:40},(_,n)=>['fact-'+n,'x'.repeat(1000)]))}]));state.relationships=Array.from({length:40},()=>({from:'a',to:'b',relation:'holding'}));
 const body=buildSpatialActionUpdate(scene),context=JSON.parse(spatialActionUpdateInstruction(body.spatialActionContext).split('SAVED ACTION STARTING STATE: ')[1]);
 assert.equal(context.objects.length,16);assert.equal(context.relationships.length,24);assert.equal(Object.keys(context.objects[0].facts).length,12);assert.equal(context.objects[0].facts['fact-0'].length,160);assert.equal(context.objects[0].position,undefined);
});
function arrow(file,name){const source=ts.createSourceFile(file,fs.readFileSync(path.join(root,file),'utf8'),ts.ScriptTarget.ES2022,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);let found;const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(source)===name)found=ts.isCallExpression(node.initializer)?node.initializer.arguments[0]:node.initializer;ts.forEachChild(node,visit);};visit(source);assert.ok(found);return ts.transpileModule('const handler='+found.getText(source)+';', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'return handler;';}
test('the actual EditStory callback scopes action setup while normal and generated-video rewrites retain their images',async()=>{
 for(const options of [{},{spatialActionMode:false},{spatialVideoGenerationMode:true},{index:1},{isSpatialInteraction:false}]){
  let request,committed;const bindings={...require('./promptTestBindings.cjs'),isSpatialInteraction:true,spatialActionMode:true,spatialVideoGenerationMode:false,index:0,spatialScene:fixture(),buildSpatialActionUpdate,
   captureSceneTarget:()=>({type:'A',index:0}),invalidateInitialDialogue:()=>{},beginSceneRequest:(_,target)=>({target}),resolveSceneTargetIndex:()=>0,setloadersPrompt:()=>{},GeneratedText:['Appearance'],steps:['Scene'],stepsx:['Scene'],videModel:'Kling',time:5,ratioKey:1,ImagesHdCloud:['actual-action-first-frame.png'],PlanVid:{characters:[]},pageType:'interactions',CLIK_URL:'/api',settextVidUpdate:()=>{},
   axios:{post:async(url,body,config)=>{request={url,body,config};return{status:200,data:'updated action'};}},isLatestSceneRequest:()=>true,withPromptWriteSource:(_,work)=>work(),commitVideoPromptToScene:(_,text)=>committed=text,setVideoPromptDraftForTarget:()=>{},getSceneTargetKey:()=>'',alert:message=>assert.fail(message),console:{log(){},error(){}},...options};
  const fn=new Function(...Object.keys(bindings),arrow('src/EditStory.tsx','EditGeneratedVisualTextOnlyFn'))(...Object.values(bindings));await fn(0,'raise the sword','current action',1);
  assert.equal(committed,'updated action');assert.equal(request.config.withCredentials,true);assert.equal(request.body.duration,5);assert.equal(request.body.targetModel,'Kling');assert.equal(request.body.createdvisual,'current action');assert.equal(request.body.editvalue,'raise the sword');
  assert.equal(request.body.imageUrl,Object.keys(options).length?'actual-action-first-frame.png':'original-stage.png');assert.equal(!!request.body.spatialActionContext,!Object.keys(options).length);
 }
});
test('the actual backend rewrite attaches the image, local action instruction, requested change and model format',async()=>{
 for(const actionSetup of [true,false])for(const array of [true,false]){
  let messages,model,response,format;const bindings={...require('./promptTestBindings.cjs'),spatialActionUpdateInstruction,UPDATE_AI_REFERENCE_HANDLE_SYSTEM_RULES:'Reference rules',UPDATE_WITH_AI_MODEL:'gpt-6-luna',buildVideoSkillBlock:()=>'',getModelDirective:(target,duration)=>{format={target,duration};return 'Preserve the model format';},generateGPT4oPrompt5:async(m,v)=>{messages=m;model=v;return 'updated action';},console:{log(){},error(){}}};
  const handler=new Function(...Object.keys(bindings),arrow('server/src/GptApi.ts','EditGeneratedVisualTextOnly'))(...Object.values(bindings));
  await handler({body:{editvalue:'raise the sword',createdvisual:array?[{prompt:'current action',duration:5}]:'current action',targetModel:'Kling',duration:5,imageUrl:actionSetup?'original-stage.png':'normal-video.png',spatialActionContext:actionSetup?buildSpatialActionUpdate(fixture()).spatialActionContext:undefined}},{send(value){response=value;return this;},status(){return this;}});
  assert.equal(model,'gpt-6-luna');assert.deepEqual(format,{target:'Kling',duration:5});assert.equal(messages[1].content[1].image_url.url,actionSetup?'original-stage.png':'normal-video.png');assert.match(messages[1].content[0].text,/raise the sword/);
  assert.equal(messages[0].content.includes('SAVED ACTION STARTING STATE:'),actionSetup);assert.ok(array?JSON.parse(response)[0].prompt==='updated action':response==='updated action');
 }
});
