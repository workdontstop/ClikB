const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),{EventEmitter}=require('node:events');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {LiveSceneClient}=require('../src/liveSceneClient.ts');
const originalFetch=global.fetch;
const storage=new Map();global.sessionStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
const keys=[0,5].map(t=>({t,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}));
const plan={version:1,duration:5,background:'#ffffff',objects:[{id:'actor',shape:'box',color:'#6686b3',keys}],camera:[0,5].map(t=>({t,position:[0,2,7],target:[0,.7,0],fov:45}))};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function gate(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject};}
function wire(){let controller,closed=false;const response=new Response(new ReadableStream({start(c){controller=c},cancel(){closed=true}}),{headers:{'Content-Type':'application/x-ndjson'}});return{response,send:event=>{if(!closed)controller.enqueue(new TextEncoder().encode(JSON.stringify(event)+'\n'));},close:()=>{if(!closed){closed=true;controller.close();}}};}
const json=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
test.after(()=>{global.fetch=originalFetch;});

test('pause racing a completed final stays completed rather than reopening an editable ghost',async()=>{
 const source=wire(),paused=gate();global.fetch=async url=>url.endsWith('/pause')?paused.promise:source.response;
 const client=new LiveSceneClient('/api','race-final'),result=client.run('/motion-guide/build',{prompt:'scene',duration:5,llmTier:'sol',liveNewBuild:true});await tick();
 source.send({type:'started',buildId:'race-final',seq:1,tier:'sol',basePlan:plan});await tick();
 const pausing=client.pause();assert.equal(client.snapshot().phase,'streaming','editing is unavailable until pause is acknowledged');assert.equal(client.snapshot().pausing,true);
 const final={plan,receipt:'finished'};source.send({type:'final',buildId:'race-final',seq:2,result:final});source.close();await tick();
 paused.resolve(json({type:'snapshot',status:'completed',plan,final,commitSeq:1}));await pausing;
 assert.equal((await result).receipt,'finished');assert.equal(client.snapshot().phase,'idle');assert.equal(client.snapshot().pausing,false);
 await client.continue('too late');assert.equal(client.snapshot().phase,'idle');
});

test('old reads after source replacement cannot resolve or display into a new run',async()=>{
 const old=wire(),next=wire();let calls=0;global.fetch=async()=>++calls===1?old.response:next.response;
 const client=new LiveSceneClient('/api','reused-client'),first=client.run('/motion-guide/build',{prompt:'old',duration:5,liveNewBuild:true});await tick();client.detach();await assert.rejects(first,/source changed/);
 const second=client.run('/motion-guide/build',{prompt:'new',duration:5,liveNewBuild:true});await tick();
 old.send({type:'started',seq:1,buildId:'old'});old.send({type:'final',seq:2,buildId:'old',result:{wrong:true}});old.close();await tick();
 assert.equal(client.snapshot().buildId,undefined,'the old started frame is sealed out');
 next.send({type:'started',seq:1,buildId:'new',basePlan:plan});next.send({type:'final',seq:2,buildId:'new',result:{plan,right:true}});next.close();assert.equal((await second).right,true);assert.equal(client.snapshot().buildId,'new');
});

test('reconnect seals the previous reader even when its late frames use the same build ID',async()=>{
 const old=wire(),replay=wire();let requests=0;global.fetch=async()=>++requests===1?old.response:replay.response;
 const client=new LiveSceneClient('/api','replay-reader'),result=client.run('/motion-guide/build',{prompt:'scene',duration:5,liveNewBuild:true});await tick();old.send({type:'started',buildId:'same',seq:1,basePlan:plan});await tick();
 await client.reconnect();await tick();replay.send({type:'snapshot',buildId:'same',seq:4,commitSeq:2,status:'streaming',plan});await tick();
 old.send({type:'final',buildId:'same',seq:100,result:{wrong:true}});old.close();await tick();assert.equal(client.snapshot().phase,'streaming');
 replay.send({type:'final',buildId:'same',seq:5,result:{plan,replayed:true}});replay.close();assert.equal((await result).replayed,true);
});

test('Stop keeps an editable draft, releases its native waiter, and reattaches that waiter before Continue',async()=>{
 const source=wire(),continued=wire();let continuationBody,resumed;
 global.fetch=async(url,options)=>{
  if(url.endsWith('/pause')){source.send({type:'paused',buildId:'kept',seq:2,plan,commitSeq:0,continuationsLeft:4});source.close();return json({status:'paused',plan,commitSeq:0,continuationsLeft:4});}
  if(url.endsWith('/stop'))return json({kept:true,plan});
  const body=JSON.parse(options.body||'{}');if(body.continueBuildId){continuationBody=body;return continued.response;}return source.response;
 };
 const client=new LiveSceneClient('/api','kept-draft'),body={prompt:'scene',duration:5,llmTier:'sol',liveNewBuild:true};
 const initial=client.run('/motion-guide/build',body);await tick();source.send({type:'started',buildId:'kept',seq:1,tier:'sol',basePlan:plan});await tick();await client.stop(true);
 const marker=await initial;assert.equal(marker.liveDraft,true);assert.equal(marker.liveBuild.buildId,'kept');assert.equal(client.snapshot().phase,'paused');
 client.canResume=()=>true;client.onResume=()=>{resumed=client.run('/motion-guide/build',body);};
 await client.continue('keep my correction');await tick();assert.ok(resumed);assert.equal(continuationBody.llmTier,'sol');assert.equal(continuationBody.continueBuildId,'kept');
 continued.send({type:'continued',buildId:'kept',seq:3,plan,segment:2,continuationsLeft:3});continued.send({type:'final',buildId:'kept',seq:4,result:{plan,resumed:true}});continued.close();assert.equal((await resumed).resumed,true);
});

test('a stale recovery response cannot replace a newly started scene',async()=>{
 const recent=gate(),source=wire();global.fetch=async url=>url.includes('/recent?')?recent.promise:source.response;
 const client=new LiveSceneClient('/api','recover-race');const recovery=client.recover('/motion-guide/build');
 const result=client.run('/motion-guide/build',{prompt:'new',duration:5,liveNewBuild:true});await tick();recent.resolve(json({builds:[{buildId:'stale'}]}));await recovery;
 source.send({type:'started',buildId:'new',seq:1,basePlan:plan});source.send({type:'final',buildId:'new',seq:2,result:{plan,fresh:true}});source.close();assert.equal((await result).fresh,true);assert.equal(client.snapshot().buildId,'new');
});

test('Continue does not start provider work when native resume exits before attaching a waiter',async()=>{
 const source=wire();let continued=0;
 global.fetch=async(url,options)=>{
  if(url.endsWith('/pause')){source.send({type:'paused',buildId:'preflight',seq:2,plan,commitSeq:0,continuationsLeft:4});source.close();return json({status:'paused',plan,commitSeq:0,continuationsLeft:4});}
  if(url.endsWith('/stop'))return json({kept:true,plan});
  if(JSON.parse(options.body||'{}').continueBuildId)continued++;return source.response;
 };
 const client=new LiveSceneClient('/api','resume-preflight'),initial=client.run('/motion-guide/build',{prompt:'scene',duration:5,liveNewBuild:true});await tick();source.send({type:'started',buildId:'preflight',seq:1,basePlan:plan});await tick();await client.stop(true);await initial;
 client.onResume=()=>{};await client.continue();assert.equal(continued,0);assert.equal(client.snapshot().phase,'paused');assert.match(client.snapshot().error,/could not resume/);
});

const load=Module._load;Module._load=function(name,parent,...args){if(/(?:liveSceneBuilds|meteredUsageBilling)\.ts$/.test(parent?.filename||'')){
 if(name==='./execQuery')return{__esModule:true,default:async()=>{throw new Error('No database access is allowed in lifecycle tests');},withTransaction:async()=>{throw new Error('No transaction is allowed in lifecycle tests');}};
 if(name==='./db')return{getPixelsForUser:async()=>{throw new Error('No database access is allowed in lifecycle tests');}};
 if(name==='./requestAuth')return{authenticatedUserId:req=>req.user||null};if(name==='./aiUsageLedger')return{recordPixelCharge:()=>{}};if(name==='./textGeneration')return{streamRoutedChatText:()=>{throw new Error('No provider access is allowed');}};if(name==='openai')return class OpenAI{};
}return load.call(this,name,parent,...args);};
const live=require('../server/src/liveSceneBuilds.ts');Module._load=load;
class ServerResponse extends EventEmitter{constructor(){super();this.events=[];this.code=200;}status(value){this.code=value;return this;}setHeader(){}flushHeaders(){}write(text){this.events.push(JSON.parse(text));}json(data){this.data=data;this.end();return this;}end(){this.ended=true;this.emit('close');}}
const session=id=>({buildId:id,userId:'1',kind:'motion',operation:'motion-build',targetKey:'target',tier:'sol',body:{},status:'finalizing',events:[],seq:0,commitSeq:0,listeners:new Set(),accepted:plan,pinned:[],segments:1,charged:false,startedAt:1,lastPersist:0});
test('server pause and stop wait for finalizing receipts and return their final result without resetting status',async()=>{
 for(const method of ['pauseLiveBuild','stopLiveBuild']){
  const id='finalizing-'+method,s=session(id),done=gate();s.running=done.promise.then(()=>{s.status='completed';s.final={plan,receipt:id};s.charged=true;});live.__liveSessionsForTest.set(id,s);
  const res=new ServerResponse(),pending=live[method]({user:'1',body:{buildId:id,keep:true}},res);await tick();assert.equal(res.ended,undefined,'finalization is not advertised as an editable pause');
  done.resolve();await pending;assert.equal(s.status,'completed');assert.equal((method==='pauseLiveBuild'?res.data.final:res.data.final).receipt,id);
 }
});
test('replay after an evicted prefix or an already delivered final returns a complete snapshot',async()=>{
 const s={...session('evicted'),status:'paused',seq:5000,commitSeq:200,events:[{type:'status',seq:4999,message:'old'},{type:'paused',seq:5000}],running:undefined};live.__liveSessionsForTest.set(s.buildId,s);
 s.body={operation:'movement',recorded:plan,sourceState:{marker:'retained source'}};
 const res=new ServerResponse();await live.liveBuildEvents({user:'1',query:{buildId:s.buildId,after:'0'}},res);assert.equal(res.events.length,1);assert.equal(res.events[0].type,'snapshot');assert.equal(res.events[0].plan.objects[0].id,'actor');assert.equal(res.events[0].resumeBody.sourceState.marker,'retained source');assert.equal(res.events[0].kind,'motion');
 s.status='completed';s.final={plan,receipt:'once'};const terminal=new ServerResponse();await live.liveBuildEvents({user:'1',query:{buildId:s.buildId,after:'5000'}},terminal);assert.equal(terminal.events[0].final.receipt,'once');
});
