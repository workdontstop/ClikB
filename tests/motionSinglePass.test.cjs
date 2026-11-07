const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Module=require('node:module');

function load(file,mocks={},cache=new Map()){
 if(/server[\\/]src[\\/](?:MotionGuideRoute|SpatialWorldPlanRoute)\.ts$/.test(file))mocks=require('./helpers/isolatedPlanningBilling.cjs').withIsolatedPlanningBilling(mocks,load);
 const filename=path.resolve(__dirname,'..',file);if(cache.has(filename))return cache.get(filename).exports;
 const mod=new Module(filename,module);cache.set(filename,mod);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
 mod.require=name=>Object.hasOwn(mocks,name)?mocks[name]:name.startsWith('.')?load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(filename),name+'.ts')),mocks,cache):Module.prototype.require.call(mod,name);
 mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);return mod.exports;
}

const {validateMotionPlan}=load('server/src/motionGuidePlan.ts');
const fixture=()=>validateMotionPlan({version:1,duration:5,background:'#ffffff',objects:[{
 id:'subject',role:'actor',identity:'same subject',shape:'box',color:'#C4CAD6',keys:[0,5].map(t=>({t,position:[0,.5,0],rotation:[0,0,0],scale:[1,1,1]})),
}],camera:[0,5].map(t=>({t,position:[0,2,6],target:[0,.5,0],fov:45}))});

function harness(kind,{authenticated=true,outputs=[]}={}){
 const calls=[],charges=[],cache=new Map();let clients=0,balanceReads=0;
 const mocks={openai:class{},
  './textGeneration':{resetOpenAiAvailability(){},createRoutedTextClient:()=>{clients++;return{chat:{completions:{create:async request=>{calls.push(request);assert.ok(outputs.length,'unexpected model request');return{choices:[{message:{content:JSON.stringify(outputs.shift())}}]};}}}};}},
  './jwtUtils':{verifyToken:()=>{if(!authenticated)throw new Error('No session');return{id:'single-pass-user'};}},
  './requestAuth':{authenticatedUserId:()=>authenticated?'single-pass-user':''},
  './db':{getPixelsForUser:async()=>{balanceReads++;return 100;},trySpendPixels:async(_user,price)=>{charges.push(price);return true;}},
  './aiUsageLedger':{recordOpenAiUsage(){},recordPixelCharge(){}},
 };
 const handler=kind==='guide'?load('server/src/MotionGuideRoute.ts',mocks,cache).buildMotionGuide:load('server/src/SpatialWorldPlanRoute.ts',mocks,cache).spatialWorldPlan;
 return{calls,charges,get clients(){return clients;},get balanceReads(){return balanceReads;},
  ticket:input=>load('server/src/motionVisualReview.ts',mocks,cache).issueMotionReview('single-pass-user','luna-fixture',input),
  async run(body){const res={statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(value){this.body=value;return this;}};await handler({cookies:{authToken:'fixture'},body},res);return res;},
 };
}

test('new Motion Guide builds return the first renderable plan without an automatic review ticket',async()=>{
 const h=harness('guide',{outputs:[fixture()]});
 const res=await h.run({prompt:'Keep the figure in place',duration:5,aspectRatio:'16:9',firstFrameUrl:'https://assets.test/source.jpg',llmTier:'luna'});
 assert.equal(res.statusCode,200,JSON.stringify(res.body));assert.ok(res.body.plan.objects.some(object=>object.id==='subject'));
 assert.equal(Object.hasOwn(res.body,'reviewTicket'),false);assert.equal(h.calls.length,1);assert.equal(h.clients,1);assert.equal(h.charges.length,1);
});

test('Spatial reconstruction returns geometry and source measurement from one response without a visual review ticket',async()=>{
 const layout={camera:'Standing eye level',landmarks:[{id:'subject',description:'The visible subject',box:[.4,.35,.2,.35],occluded:false}]};
 const h=harness('spatial',{outputs:[{sourceLayout:layout,plan:fixture(),controlledObject:'subject',controlMode:'character',motionStyle:'walk',walkable:[{min:[-5,0,-5],max:[5,2,5]}],obstacles:[]}]});
 const res=await h.run({operation:'reconstruct',prompt:'Keep the subject and ground',image:'https://assets.test/source.jpg',aspectRatio:'16:9',drivenName:'same subject',llmTier:'luna'});
 assert.equal(res.statusCode,200,JSON.stringify(res.body));assert.ok(res.body.world.plan.objects.some(object=>object.id==='subject'));
 assert.equal(Object.hasOwn(res.body,'reviewTicket'),false);assert.equal(h.calls.length,1,'geometry and optional source measurements share the same inference call');assert.equal(h.clients,1);assert.equal(h.charges.length,1);
});

test('legacy review requests on both endpoints return the original validated plan with no inference or billing',async()=>{
 for(const kind of ['guide','spatial']){
  const h=harness(kind),plan=fixture(),input={plan,image:'https://assets.test/source.jpg',aspect:'16:9',prompt:'Keep the current result'};
  const ticket=h.ticket(input);assert.ok(ticket,'use a real valid legacy ticket rather than relying on signature rejection');
  const res=await h.run({...input,operation:'review',reviewTicket:ticket,preview:'data:image/jpeg;base64,YQ=='});
  assert.equal(res.statusCode,200);assert.deepEqual(res.body,{plan});assert.equal(h.clients,0);assert.equal(h.calls.length,0);assert.equal(h.charges.length,0);assert.equal(h.balanceReads,0);
 }
});

test('retired review endpoints still enforce authentication and renderable-plan validation without inference',async()=>{
 const oldAppState=process.env.APP_STATE;process.env.APP_STATE='test';
 try{for(const kind of ['guide','spatial']){
  const unauthenticated=harness(kind,{authenticated:false}),unauthenticatedResult=await unauthenticated.run({operation:'review',plan:fixture()});
  assert.equal(unauthenticatedResult.statusCode,401);assert.equal(unauthenticated.clients,0);assert.equal(unauthenticated.charges.length,0);
  const invalid=harness(kind),plan=fixture();plan.objects[0].keys[0].scale[0]=-1;
  const invalidResult=await invalid.run({operation:'review',plan});assert.equal(invalidResult.statusCode,400);assert.equal(invalid.clients,0);assert.equal(invalid.calls.length,0);assert.equal(invalid.charges.length,0);
 }}finally{if(oldAppState===undefined)delete process.env.APP_STATE;else process.env.APP_STATE=oldAppState;}
});
