const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),{EventEmitter}=require('node:events');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
let builds=new Map(),presets=new Map(),balances=new Map([['1',100],['2',100]]),provider,providerCalls=0,failWrite=false,rawProviderPixels=0;
const billingSql=require('./helpers/meteredSqlHarness.cjs').createMeteredSqlHarness([...balances]);
const billingEnv=billingSql.makeEnv();
const query=async(sql,args=[])=>{
 if(sql.includes('ai_metered_billing_'))return billingEnv.execQuery(sql,args);
 if(sql.startsWith('CREATE TABLE'))return[];
 if(sql.startsWith('INSERT INTO scene_live_builds')){if(failWrite)throw new Error('offline');const [id,user,kind,operation,target,tier,status,body,checkpoint,final,charged,segments]=args;const old=builds.get(id);builds.set(id,{build_id:id,user_id:user,kind,operation,target_key:target,tier,status,request_body:body,checkpoint,final_result:final||old?.final_result,charged:old?.charged||charged,segments});return{affectedRows:1};}
 if(sql.startsWith('SELECT')&&sql.includes('FROM scene_live_builds')){const row=builds.get(args[0]);return row&&String(row.user_id)===String(args[1])?[structuredClone(row)]:[];}
 if(sql.startsWith("UPDATE scene_live_builds SET checkpoint=?,charged=1")){const row=builds.get(args[2]);if(row){row.checkpoint=args[0];row.charged=1;row.status='completed';row.final_result=args[1];}return{affectedRows:1};}
 if(sql.startsWith('UPDATE scene_live_builds SET checkpoint=')){const segments=sql.includes('segments=');const row=builds.get(args[segments?2:1]);if(row){row.checkpoint=args[0];if(segments)row.segments=args[1];}return{affectedRows:1};}
 if(sql.startsWith('UPDATE scene_live_builds SET charged=1')){const row=builds.get(args[1]);row.charged=1;row.status='completed';row.final_result=args[0];return{affectedRows:1};}
 if(sql.startsWith('UPDATE members SET pixels')){const [cost,user]=args,current=balances.get(user)||0;if(current<cost)return{affectedRows:0};balances.set(user,current-cost);return{affectedRows:1};}
 if(sql.startsWith('SELECT pixels FROM members')||sql.startsWith('SELECT COALESCE(pixels, 0) AS pixels FROM members'))return[{pixels:balances.get(args[0])||0}];
 if(sql.startsWith('INSERT INTO user_scene_presets')){const [id,user,request,kind,title,payload]=args;const old=[...presets.values()].find(p=>p.user_id===user&&p.request_id===request);if(!old)presets.set(id,{id,user_id:user,request_id:request,preset_kind:kind,title,payload,revision:1,creator_name:'Creator '+user});return{affectedRows:old?0:1};}
 if(sql.startsWith('SELECT id FROM user_scene_presets'))return[...presets.values()].filter(p=>p.user_id===args[0]&&p.request_id===args[1]).map(p=>({id:p.id}));
 if(sql.startsWith('SELECT user_id,revision')){const p=presets.get(args[0]);return p?[{user_id:p.user_id,revision:p.revision}]:[];}
 if(sql.startsWith('SELECT p.*')){let rows=[...presets.values()];if(sql.includes('WHERE p.id=?'))rows=rows.filter(p=>p.id===args[0]);else if(sql.includes('p.user_id=?'))rows=rows.filter(p=>p.user_id===args[0]);return structuredClone(rows);}
 if(sql.startsWith('UPDATE user_scene_presets')){const p=presets.get(args[2]);p.title=args[0];p.payload=args[1];p.revision++;return{affectedRows:1};}
 if(sql.startsWith('DELETE FROM user_scene_presets')){const p=presets.get(args[0]);if(p?.user_id!==args[1]||p?.revision!==args[2])return{affectedRows:0};presets.delete(args[0]);return{affectedRows:1};}
 throw new Error('Unexpected test query: '+sql);
};
const transaction=async fn=>{const before={builds:structuredClone(builds),presets:structuredClone(presets),balances:structuredClone(balances)},beforeBilling={sessions:structuredClone(billingSql.state.sessions),events:structuredClone(billingSql.state.events),receipts:structuredClone(billingSql.state.receipts)};try{return await fn(query);}catch(e){({builds,presets,balances}=before);Object.assign(billingSql.state,beforeBilling);throw e;}};
const original=Module._load;
Module._load=function(name,parent,...args){
 if(/(?:liveSceneBuilds|scenePresetRoutes|meteredUsageBilling)\.ts$/.test(parent?.filename||'')){
  if(name==='./execQuery')return{__esModule:true,default:query,withTransaction:transaction};
  if(name==='./db')return{getPixelsForUser:async user=>balances.get(user)||0,trySpendPixels:async()=>{throw new Error('Direct wallet debit bypassed accounting');}};
  if(name==='./requestAuth')return{authenticatedUserId:req=>req.user||null};
  if(name==='./aiUsageLedger')return{recordPixelCharge:()=>{},providerUsageCursor:()=>0,providerPixelsSince:()=>rawProviderPixels};
  if(name==='./liveSceneModelClient')return{createLiveSceneModelClient:()=>({}),LIVE_SCENE_REQUEST_TIMEOUT_MS:600000};
  if(name==='./textGeneration')return{streamRoutedChatText:(...params)=>{providerCalls++;return provider(...params);}};
  if(name==='openai')return class OpenAI{};
 }
 return original.call(this,name,parent,...args);
};
const live=require('../server/src/liveSceneBuilds.ts'),{scenePresetRoute}=require('../server/src/scenePresetRoutes.ts'),{validateMotionPlan}=require('../server/src/motionGuidePlan.ts');
Module._load=original;
class Response extends EventEmitter{constructor(){super();this.statusCode=200;this.events=[];}status(n){this.statusCode=n;return this;}setHeader(){}flushHeaders(){}write(text){this.events.push(JSON.parse(text));}end(){this.ended=true;this.emit('close');}json(data){this.data=data;this.end();return this;}}
const keys=()=>[0,5].map(t=>({t,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}));
const shape=id=>({id,shape:'box',color:'#6686b3',keys:keys()});
const plan=()=>({version:1,duration:5,background:'#edf5fc',objects:[shape('table'),shape('actor')],camera:[0,5].map(t=>({t,position:[0,2,7],target:[0,.7,0],fov:45}))});
const spec=async()=>({kind:'motion',operation:'motion-build',price:1,tier:'luna',planPath:[],duration:5,request:{model:'gpt-6-luna',reasoning_effort:'max',max_completion_tokens:32000,messages:[{role:'system',content:'Build a scene'}]},finalize:raw=>({plan:validateMotionPlan(raw)}),charge:()=>{throw new Error('Live billing must use the durable transaction');},recordUsage:()=>{}});
live.registerLivePreparer('motion',spec);
const jpeg='data:image/jpeg;base64,'+Buffer.from([255,216,255,217]).toString('base64');
test('shared presets work across accounts, reject non-owner mutation, and retry saves without duplication',async()=>{
 const preset={kind:'motion_preset',title:'Walk',duration:5,relativeRootKeys:keys(),partDeltaKeys:{},moves:[],masks:[],compatibleRigKinds:['biped'],referenceHipHeight:1,referenceStrideLength:1,locomotionEnabled:true};
 let r=new Response();await scenePresetRoute({user:'1',body:{action:'save',requestId:'request_once',preset}},r);assert.equal(r.statusCode,200);const item=r.data;
 r=new Response();await scenePresetRoute({user:'1',body:{action:'save',requestId:'request_once',preset}},r);assert.equal(r.data.id,item.id);assert.equal(presets.size,1);
 r=new Response();await scenePresetRoute({user:'2',body:{action:'list'}},r);assert.equal(r.data.items[0].editable,false);assert.equal(r.data.items[0].id,item.id);
 r=new Response();await scenePresetRoute({user:'2',body:{action:'read',id:item.id}},r);assert.equal(r.data.preset.title,'Walk');
 r=new Response();await scenePresetRoute({user:'2',body:{action:'save',id:item.id,revision:1,requestId:'request_other',preset:{...preset,title:'Hijacked'}}},r);assert.equal(r.statusCode,403);
 r=new Response();await scenePresetRoute({user:'2',body:{action:'delete',id:item.id,revision:1}},r);assert.equal(r.statusCode,409);assert.equal(presets.size,1);
 r=new Response();await scenePresetRoute({user:'1',body:{action:'save',id:item.id,revision:1,requestId:'request_rename',preset:{...preset,title:'Updated'}}},r);assert.equal(r.data.revision,2);
 r=new Response();await scenePresetRoute({user:'1',body:{action:'delete',id:item.id,revision:1}},r);assert.equal(r.statusCode,409);
 r=new Response();await scenePresetRoute({user:'1',body:{action:'delete',id:item.id,revision:2}},r);assert.equal(r.statusCode,200);
});

test('action and rig presets save through authenticated validation and retain physical starting pose and timed state', async () => {
 const {adoptSceneBuild}=require('../server/src/sceneBuildAuthoring.ts');
 const {extractActionNodePreset,extractRigAssetPreset}=require('../server/src/scenePresets.ts');
 const raw={...plan(),objects:[{id:'hero',recipe:'humanoid',keys:keys()}],performance:{states:[{objectId:'hero',time:0,posture:'kneeling'}]}};
 const draft=adoptSceneBuild(raw,'preset:source');
 const action=extractActionNodePreset(draft,{actor:'hero'},{presetId:'kneel_action',title:'Kneeling action'});
 const rig=extractRigAssetPreset(draft,'hero',{presetId:'kneel_rig',title:'Kneeling actor'});
 const before=providerCalls;
 for(const [index,preset] of [action,rig].entries()){
  const saved=new Response();await scenePresetRoute({user:'1',body:{action:'save',requestId:`new_kind_${index}`,preset}},saved);
  assert.equal(saved.statusCode,200,JSON.stringify(saved.data));assert.equal(saved.data.preset.kind,preset.kind);
  if(preset.kind==='action_preset'){assert.equal(saved.data.preset.initialFactsByRole.actor.posture,'kneeling');assert.ok(saved.data.preset.partStartPosesByRole.actor.pelvis);assert.ok(saved.data.preset.referenceFramesByRole.actor);assert.ok(saved.data.preset.rootStartPosesByRole.actor);assert.ok(saved.data.preset.events[0].stateCue);}
  else assert.equal(saved.data.preset.initialFacts.posture,'kneeling');
 }
 assert.equal(providerCalls,before);
});

test('saved procedural action ownership survives authenticated storage and evaluated replay', async () => {
 const {adoptSceneBuild}=require('../server/src/sceneBuildAuthoring.ts');
 const {extractActionNodePreset,applyActionPreset}=require('../server/src/scenePresets.ts');
 const {applyAuthoringCommands,evaluateAuthoringDraft}=require('../server/src/sceneAuthoring.ts');
 const {initialMotionMatrix}=require('../server/src/motionNodeTransforms.ts');
 const raw={...plan(),objects:[{id:'hero',recipe:'humanoid',keys:keys()}]};
 let source=adoptSceneBuild(raw,'stored-proc:source');source.plan.objects[0].keys[1].position[2]=5;
 const hip=source.plan.objects[0].parts.find(part=>part.id==='left_hip');
 source=applyAuthoringCommands(source,source.revision,[{kind:'locomotion',objectId:'hero',enabled:true},...hip.keys.map(key=>({kind:'pose',target:{objectId:'hero',partId:'left_hip'},time:key.t,pose:{...key,rotation:[.4,0,0]}})),{kind:'mask',mask:{target:{objectId:'hero',partId:'right_hip'},start:1,end:2,channels:['rotation']}}]);
 const action=extractActionNodePreset(source,{actor:'hero'},{title:'Stored walk'});
 const before=providerCalls,saved=new Response();await scenePresetRoute({user:'1',body:{action:'save',requestId:'stored_walk_owner',preset:action}},saved);
 assert.equal(saved.statusCode,200,JSON.stringify(saved.data));
 assert.deepEqual(saved.data.preset.ownershipByRole,action.ownershipByRole);
 const target=adoptSceneBuild({...raw,objects:[{id:'nextHero',recipe:'humanoid',keys:keys()}]},'stored-proc:target');
 const replay=applyActionPreset(target,saved.data.preset,{actor:'nextHero'}).draft;
 for(const time of [.5,1.5,2.5,4]){
  const a=evaluateAuthoringDraft(source,time).plan,b=evaluateAuthoringDraft(replay,time).plan;
  for(const part of a.objects[0].parts)initialMotionMatrix(a,'hero',part.id).forEach((value,index)=>assert.ok(Math.abs(value-initialMotionMatrix(b,'nextHero',part.id)[index])<1e-6));
 }
 assert.equal(providerCalls,before);
});

test('saved motion-preset manual ownership and masks survive storage without freezing unowned procedural parts', async () => {
 const {adoptSceneBuild}=require('../server/src/sceneBuildAuthoring.ts');
 const {extractMotionNodePreset,applyMotionPreset}=require('../server/src/scenePresets.ts');
 const {applyAuthoringCommands,evaluateAuthoringDraft}=require('../server/src/sceneAuthoring.ts');
 let source=adoptSceneBuild({...plan(),objects:[{id:'hero',recipe:'humanoid',keys:keys()}]},'stored-motion:source');
 source.plan.objects[0].keys[1].position[2]=5;
 const hip=source.plan.objects[0].parts.find(part=>part.id==='left_hip');
 source=applyAuthoringCommands(source,source.revision,[{kind:'locomotion',objectId:'hero',enabled:true},{kind:'pose',target:{objectId:'hero',partId:'left_hip'},time:5,pose:{...hip.keys[1],rotation:[.4,0,0]}},{kind:'mask',mask:{target:{objectId:'hero',partId:'right_hip'},start:1,end:2,channels:['rotation']}}]);
 const preset=extractMotionNodePreset(source,'hero',{title:'Stored relative walk'});
 const saved=new Response();await scenePresetRoute({user:'1',body:{action:'save',requestId:'stored_motion_owner',preset}},saved);
 assert.equal(saved.statusCode,200,JSON.stringify(saved.data));assert.deepEqual(saved.data.preset.manualControls,['left_hip']);assert.deepEqual(saved.data.preset.masks,preset.masks);
 const target=adoptSceneBuild({...plan(),objects:[{id:'nextHero',recipe:'humanoid',keys:keys()}]},'stored-motion:target');
 const replay=applyMotionPreset(target,saved.data.preset,'nextHero').draft;
 for(const time of [.5,1.5,2.5,4]){
  const a=evaluateAuthoringDraft(source,time).plan.objects[0],b=evaluateAuthoringDraft(replay,time).plan.objects[0];
  for(const id of ['left_hip','right_hip','left_knee','right_knee'])assert.deepEqual(b.parts.find(part=>part.id===id).keys[0].rotation,a.parts.find(part=>part.id===id).keys[0].rotation);
 }
 const malformed=new Response();await scenePresetRoute({user:'1',body:{action:'save',requestId:'invalid_motion_owner',preset:{...preset,manualControls:['missing_control']}}},malformed);assert.equal(malformed.statusCode,400);
});
test('live pause aborts upstream; manual corrections and viewport image reach continuation; completion/replay charges once',async()=>{
 let release;provider=async function*(_client,request,signal){yield{type:'meta',model:'gpt-6-luna',provider:'openai',liveStreaming:true};const json=JSON.stringify(plan());yield{type:'delta',text:json.slice(0,-1)};await new Promise((resolve,reject)=>{release=resolve;signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true});});yield{type:'delta',text:'}'};yield{type:'done',text:json,model:'gpt-6-luna',provider:'openai',liveStreaming:true};};
 const first=new Response();await live.handleLiveRequest({body:{liveTargetKey:'target_one'}},first,'motion','1');
 await new Promise(resolve=>setTimeout(resolve,10));const id=first.events.find(e=>e.type==='started').buildId;assert.ok(first.events.some(e=>e.type==='commit'));assert.ok(!first.events.some(e=>e.type==='final'));
 const paused=new Response();await live.pauseLiveBuild({user:'1',body:{buildId:id,viewportSnapshot:jpeg}},paused);assert.equal(paused.data.status,'paused');
 const corrected=structuredClone(paused.data.plan);corrected.objects.find(o=>o.id==='table').keys.forEach(key=>key.position[0]=3);
 let observed;provider=async function*(_client,request){observed=request;const json=JSON.stringify({...plan(),objects:[shape('table'),shape('lamp')]});yield{type:'meta',model:'gpt-6-luna',provider:'openai',liveStreaming:true};yield{type:'delta',text:json};yield{type:'done',text:json,model:'gpt-6-luna',provider:'openai',liveStreaming:true};};
 const next=new Response();await live.handleLiveRequest({body:{continueBuildId:id,liveTargetKey:'target_one',partialPlan:corrected,pinnedObjectIds:['table'],guidance:'Keep the smaller table',viewportSnapshot:jpeg}},next,'motion','1');await live.__liveSessionsForTest.get(id).running;
 assert.equal(next.events.at(-1).type,'final');const final=next.events.at(-1).result;assert.equal(final.plan.objects.find(o=>o.id==='table').keys[0].position[0],3);assert.equal(balances.get('1'),99);
 const content=observed.messages.at(-1).content;assert.equal(content.find(p=>p.type==='image_url').image_url.url,jpeg);assert.match(content[0].text,/Keep the smaller table/);assert.match(content[0].text,/acceptedScene/);
 const replay=new Response();await live.liveBuildEvents({user:'1',query:{buildId:id,after:'0'}},replay);assert.equal(balances.get('1'),99);assert.ok(replay.events.some(e=>e.type==='final'));
 live.__liveSessionsForTest.clear();const restored=new Response();await live.liveBuildEvents({user:'1',query:{buildId:id,after:'9'}},restored);assert.equal(restored.events[0].final.liveBuild.buildId,id);assert.equal(balances.get('1'),99);
 const wrong=new Response();await live.liveBuildEvents({user:'2',query:{buildId:id}},wrong);assert.equal(wrong.statusCode,404);assert.equal(providerCalls,2);void release;
});
test('checkpoint failure prevents a paid provider request from being started',async()=>{
 const before=providerCalls;failWrite=true;const r=new Response();await live.handleLiveRequest({body:{liveTargetKey:'unavailable'}},r,'motion','1');failWrite=false;assert.equal(r.statusCode,503);assert.equal(providerCalls,before);
});
test('invalid viewport snapshots are rejected before they enter a continuation prompt',()=>{
 assert.throws(()=>live.validateViewportSnapshot('https://example.com/not-the-viewport'));
 assert.throws(()=>live.validateViewportSnapshot('data:image/jpeg;base64,aGVsbG8='));assert.equal(live.validateViewportSnapshot(jpeg),jpeg);
});


test('live motion charges rounded provider cost once and replay never starts inference or debits again', async () => {
 balances.set('1',100); rawProviderPixels=2.25;
 live.registerLivePreparer('motion',async()=>({...await spec(),atCostPricing:true}));
 provider=async function*(){const text=JSON.stringify(plan());yield{type:'delta',text};yield{type:'done',text,model:'gpt-6-luna',provider:'openai',usage:{}};};
 const response=new Response();await live.handleLiveRequest({user:'1',body:{liveTargetKey:'at_cost'}},response,'motion','1');
 const id=response.events.find(event=>event.type==='started').buildId;await live.__liveSessionsForTest.get(id).running;
 const final=response.events.find(event=>event.type==='final').result;
 assert.equal(final.llmBilling.pixelsCharged,2);assert.equal(final.llmBilling.rawPixels,2.25);assert.equal(balances.get('1'),98);
 const calls=providerCalls,replay=new Response();await live.liveBuildEvents({user:'1',query:{buildId:id,after:'0'}},replay);
 assert.equal(providerCalls,calls);assert.equal(balances.get('1'),98);assert.equal(replay.events.at(-1).result.liveBuild.buildId,id);
 live.registerLivePreparer('motion',spec);
});

test('server security heartbeat aborts upstream before any visible output when balance or identity becomes invalid', async t => {
 t.mock.timers.enable({apis:['setTimeout','setInterval']});
 for (const reason of ['balance','identity']) {
  balances.set('1',100);let aborted=false;
  provider=async function*(_client,_request,signal){yield{type:'meta',model:'gpt-6-luna',provider:'openai',liveStreaming:true};await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new Error('security abort'));},{once:true}));};
  const request={user:'1',body:{liveTargetKey:'security_'+reason}},response=new Response();
  await live.handleLiveRequest(request,response,'motion','1');
  const id=response.events.find(event=>event.type==='started').buildId,session=live.__liveSessionsForTest.get(id);
   await new Promise(resolve=>setImmediate(resolve)); // Let the durable lease check finish before invalidating an active upstream run.
  if(reason==='balance')balances.set('1',0);else request.user='2';
  t.mock.timers.tick(9000);await new Promise(resolve=>setImmediate(resolve));await session.running;
  assert.equal(aborted,true);assert.equal(session.status,'paused');assert.equal(session.charged,false);
  assert.ok(response.events.some(event=>event.code==='SECURITY_STOP'&&event.stage==='security-heartbeat'));
  assert.ok(!response.events.some(event=>event.type==='commit'||event.type==='final'));
 }
 t.mock.timers.reset();balances.set('1',100);
});

test('truncated continuation retains streamed geometry instead of finalizing its empty starting workspace', async()=>{
 live.registerLivePreparer('motion',spec);balances.set('1',100);
 provider=async function*(_client,_request,signal){yield{type:'delta',text:'{"version":1,'};await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('pause')),{once:true}));};
 const first=new Response();await live.handleLiveRequest({user:'1',body:{liveTargetKey:'truncated_resume'}},first,'motion','1');
 const id=first.events.find(e=>e.type==='started').buildId;
 const paused=new Response();await live.pauseLiveBuild({user:'1',body:{buildId:id}},paused);assert.equal(paused.data.plan.objects[0].id,'live_workspace');
 provider=async function*(){const text=JSON.stringify(plan()).slice(0,-1);yield{type:'delta',text};yield{type:'done',text,model:'gpt-6-luna',provider:'openai',liveStreaming:true};};
 const resumed=new Response();await live.handleLiveRequest({user:'1',body:{continueBuildId:id,liveTargetKey:'truncated_resume'}},resumed,'motion','1');await live.__liveSessionsForTest.get(id).running;
 assert.ok(resumed.events.some(e=>e.type==='commit'));
 assert.ok(resumed.events.some(e=>e.code==='INCOMPLETE_SCENE_RESPONSE'));
 assert.ok(!resumed.events.some(e=>e.type==='final'));
 assert.equal(live.__liveSessionsForTest.get(id).status,'paused');
 assert.deepEqual(live.__liveSessionsForTest.get(id).accepted.objects.map(o=>o.id).filter(id=>id!=='live_workspace'),['table','actor']);
 assert.equal(balances.get('1'),100);
});

test('automatic visual cycle waits for authenticated rendered feedback and exports the accumulated scene with one receipt',async()=>{
 balances.set('1',100);rawProviderPixels=1.25;
 live.registerLivePreparer('motion',async()=>({...await spec(),atCostPricing:true}));
 const requests=[];provider=async function*(_client,request){requests.push(request);const step=requests.length;
  const value=step===1?{...plan(),objects:[shape('actor')],buildProgress:{done:false,next:'Add support'}}:{version:1,duration:5,objects:[shape('support')],buildProgress:{done:true,next:''}};
  const text=JSON.stringify(value);yield{type:'delta',text};yield{type:'done',text,model:'gpt-6-luna',provider:'openai',liveStreaming:true,usage:{}};
 };
 const response=new Response();await live.handleLiveRequest({user:'1',body:{visualCheckpoints:true,liveTargetKey:'visual_cycle'}},response,'motion','1');
 const id=response.events.find(e=>e.type==='started').buildId,session=live.__liveSessionsForTest.get(id);
 const checkpoint=async count=>{for(let i=0;i<30;i++){const found=response.events.filter(e=>e.type==='render-checkpoint');if(found.length>=count)return found[count-1];await new Promise(r=>setImmediate(r));}throw new Error('Missing rendered checkpoint');};
 const first=await checkpoint(1);assert.equal(requests.length,1);assert.equal(session.charged,false);
 let feedback=new Response();await live.renderedLiveFeedback({user:'2',body:{buildId:id,checkpointId:first.checkpointId,commitSeq:first.commitSeq,viewportSnapshot:jpeg}},feedback);assert.equal(feedback.statusCode,404);
 feedback=new Response();await live.renderedLiveFeedback({user:'1',body:{buildId:id,checkpointId:first.checkpointId,commitSeq:first.commitSeq+1,viewportSnapshot:jpeg}},feedback);assert.equal(feedback.statusCode,409);assert.equal(requests.length,1);
 const acknowledge=async point=>{const result=new Response();await live.renderedLiveFeedback({user:'1',body:{buildId:id,checkpointId:point.checkpointId,commitSeq:point.commitSeq,viewportSnapshot:jpeg}},result);assert.equal(result.data.accepted,true);};
 await acknowledge(first);const second=await checkpoint(2);assert.equal(requests.length,2);assert.equal(session.charged,false);
 const context=requests[1].messages.at(-1).content;
 assert.equal(context.find(p=>p.type==='image_url').image_url.url,jpeg);
 assert.equal(JSON.parse(context[0].text).acceptedScene.objects[0].id,'actor');
 assert.equal(requests[1].messages.length,2,'test spec has one system message plus one current feedback message');
 assert.equal(requests[0].reasoning_effort,'max');assert.equal(requests[1].reasoning_effort,'max');assert.equal(requests[1].max_completion_tokens,32000);assert.ok(!requests[0].messages[0].content.includes('simple silhouettes'));
 await acknowledge(second);await session.running;
 const final=response.events.find(e=>e.type==='final').result;
 assert.deepEqual(final.plan.objects.map(o=>o.id),['actor','support']);
 assert.deepEqual(session.accepted,final.plan);assert.equal(final.llmBilling.pixelsCharged,2);assert.equal(balances.get('1'),98);
 live.registerLivePreparer('motion',spec);
});

test('pause while waiting for a rendered checkpoint stops automatic AI steps and retains its geometry',async()=>{
 balances.set('1',100);const before=providerCalls;
 provider=async function*(){const text=JSON.stringify({...plan(),buildProgress:{done:false}});yield{type:'delta',text};yield{type:'done',text,model:'gpt-6-luna',provider:'openai',liveStreaming:true};};
 const response=new Response();await live.handleLiveRequest({user:'1',body:{visualCheckpoints:true,liveTargetKey:'pause_checkpoint'}},response,'motion','1');const id=response.events.find(e=>e.type==='started').buildId;
 for(let i=0;i<20&&!live.__liveSessionsForTest.get(id).renderCheckpoint;i++)await new Promise(r=>setImmediate(r));
 assert.ok(live.__liveSessionsForTest.get(id).renderCheckpoint);
 const paused=new Response();await live.pauseLiveBuild({user:'1',body:{buildId:id}},paused);
 assert.equal(paused.data.status,'paused');assert.equal(providerCalls,before+1);assert.equal(paused.data.plan.objects.length,2);assert.equal(balances.get('1'),100);
 assert.equal(live.__liveSessionsForTest.get(id).renderCheckpoint,undefined);
});

test('Spatial uses the same rendered checkpoint loop and retains its finalized animatic performance', async () => {
 const {adoptSceneBuild}=require('../server/src/sceneBuildAuthoring.ts');
 balances.set('1',100);
 const requests=[];
 live.registerLivePreparer('spatial',async()=>({...await spec(),kind:'spatial',operation:'action',planPath:['plan'],
  adoptCheckpoint:(raw,previous,pinned)=>{const authoring=adoptSceneBuild(raw,'spatial:checkpoint',previous,pinned);return{plan:authoring.plan,authoring};},
  finalize:(raw,_meta,previous)=>{const authoring=adoptSceneBuild({...raw,plan:{...raw.plan,camera:raw.plan.camera.map(key=>({...key,fov:50}))}},'spatial:checkpoint',previous);return{animatic:{plan:authoring.plan,authoring}};}}));
 provider=async function*(_client,request){requests.push(request);const value={plan:{...plan(),objects:[{...shape('actor'),shape:'anchor',parts:[shape('body')]}]},buildProgress:{done:requests.length>=2}};const text=JSON.stringify(value);yield{type:'delta',text};yield{type:'done',text,model:'gpt-6-luna',provider:'openai',liveStreaming:true};};
 const response=new Response();await live.handleLiveRequest({user:'1',body:{visualCheckpoints:true,liveTargetKey:'spatial-loop'}},response,'spatial','1');
 const id=response.events.find(event=>event.type==='started').buildId,session=live.__liveSessionsForTest.get(id);
 for(let count=1;count<=2;count++){
  let point;for(let attempt=0;attempt<40&&!point;attempt++){point=response.events.filter(event=>event.type==='render-checkpoint')[count-1];if(!point)await new Promise(resolve=>setImmediate(resolve));}
  assert.ok(point,'Spatial must request a real rendered checkpoint');
  const feedback=new Response();await live.renderedLiveFeedback({user:'1',body:{buildId:id,checkpointId:point.checkpointId,commitSeq:point.commitSeq,viewportSnapshot:jpeg}},feedback);assert.equal(feedback.data.accepted,true);
 }
 await session.running;
 assert.equal(requests.length,2);assert.ok(requests.every(request=>request.reasoning_effort==='max'));
 assert.equal(session.status,'completed');assert.equal(session.accepted.camera[0].fov,50);
 assert.deepEqual(session.authoring.plan,session.final.animatic.plan);assert.equal(balances.get('1'),99);
});
