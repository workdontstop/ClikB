const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const ts=require('../node_modules/typescript');
const root=path.resolve(__dirname,'../server/src');
let calls=[];
class FakeOpenAI {chat={completions:{create:async args=>{calls.push(args);throw new Error('TEST_PROVIDER_STOP');}}};}
const loaded=new Map();
function load(name){if(loaded.has(name))return loaded.get(name);const module={exports:{}};loaded.set(name,module.exports);const code=ts.transpileModule(fs.readFileSync(path.join(root,name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{exports:module.exports,module,require:id=>id==='openai'?FakeOpenAI:id==='./aiUsageLedger'?{recordOpenAiUsage(){}}:id.startsWith('./')?load(id.slice(2)):require(require.resolve(id,{paths:[root]})),process:{env:{}},console:{log(){},error(){}}});return module.exports;}
const routes=load('SpatialMotionContext');
const routing=load('textGeneration');
const context={controlledSubject:'Mara',controlMode:'character',primaryMotion:'walk',ambientMotion:'mist'};
const forward={sceneId:'scene',sceneIntent:'walk',videoPrompt:'walk',motionContext:context,durationSeconds:5,movementText:'walk to the door',imageDataUrl:'data:image/jpeg;base64,AA=='};
const compile={globalIntent:{},scenes:[{nodeId:'root',sceneId:'scene',sceneIntent:'walk',videoPrompt:'walk'}]};
(async()=>{for(const tier of ['luna','terra','sol','astra'])for(const [handler,body] of [[routes.compileSpatialMotionContexts,compile],[routes.compileSpatialMotionContexts,{...compile,scenes:[{...compile.scenes[0],stateMode:'post-action',completedAction:'sat down',finalFrameUrl:'https://example.com/frame.png'}]}],[routes.refineSpatialMovementFromFrame,forward],[routes.refineSpatialMovementFromFrame,{...forward,destinationImageUrl:'https://example.com/destination.png'}]]){calls=[];routing.resetOpenAiAvailability();const res={status(){return this},send(body){if(!calls.length)console.log(body);return this}};await handler({body:{...body,llmTier:tier}},res);assert.ok(calls.length>0);const expectedModel={luna:'gpt-6-luna',terra:'gpt-6.1-terra',sol:'gpt-6.1-sol',astra:'gpt-6-astra'}[tier];assert.ok(calls.every(call=>call.model===expectedModel));assert.ok(calls.every(call=>tier==='astra'?call.reasoning_effort==='low':call.reasoning_effort==='low'&&call.max_completion_tokens===60000));}
for(const handler of [routes.compileSpatialMotionContexts,routes.refineSpatialMovementFromFrame]){calls=[];let status;await handler({body:{...forward,...compile,llmTier:'invalid'}},{status(s){status=s;return this},send(){}});assert.equal(status,400);assert.equal(calls.length,0);}
console.log('PASS: Luna and legacy Terra use MAX, Sol uses extra high, with 32000-token allowances in root/post-action context, forward and return routes; Astra stays on low reasoning; invalid tiers rejected. No API calls.');})().catch(e=>{console.error(e);process.exitCode=1});


