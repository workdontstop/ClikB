const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const core=require('../server/src/sceneAuthoring.ts'),rigs=require('../server/src/sceneRigPrototype.ts');
const {validateScenePerformance}=require('../server/src/scenePerformance.ts');
const apply=(draft,...commands)=>core.applyAuthoringCommands(draft,draft.revision,commands);
const near=(a,b)=>a.forEach((n,i)=>assert.ok(Math.abs(n-b[i])<1e-7,`${n} != ${b[i]}`));

test('bounded limb overdub preserves the original animation outside the requested window and untouched channels inside',()=>{
 const draft=rigs.makeSceneAuthoringFixture(),partId=draft.rigs.actor.controls.left_shoulder;
 const original=draft.plan.objects.find(o=>o.id==='actor').parts.find(p=>p.id===partId);
 original.keys=[0,1,4,5].map(t=>({...structuredClone(original.keys[0]),t,position:[t/10,1,t/20],rotation:[t/10,0,0]}));
 const pose={...core.samplePose(original,2),rotation:[1.2,0,0],position:[99,99,99]};
 const next=apply(draft,{kind:'pose',target:{objectId:'actor',partId},time:2,pose,interval:[1.5,2.5],channels:['rotation']});
 const edited=next.plan.objects.find(o=>o.id==='actor').parts.find(p=>p.id===partId);
 for(const t of[0,.2,1,1.49,2.51,3,4,5]){
  const a=core.samplePose(original,t),b=core.samplePose(edited,t);near(a.position,b.position);near(a.rotation,b.rotation);near(a.scale,b.scale);
 }
 near(core.samplePose(edited,2).rotation,[1.2,0,0]);near(core.samplePose(edited,2).position,core.samplePose(original,2).position);
 assert.throws(()=>apply(draft,{kind:'pose',target:{objectId:'actor',partId},time:1.5,pose,interval:[1.5,2.5],channels:['rotation']}),/inside its interval/);
});

test('manual camera track survives AI/recording plan adoption, saved document reload and a second adoption',()=>{
 let draft=rigs.makeSceneAuthoringFixture();
 draft=apply(draft,{kind:'camera',time:2,camera:{...draft.plan.camera[0],position:[2,5,6],target:[1,1,0],fov:31,roll:.25,up:[0,1,0]}});
 const ai=structuredClone(draft.plan);ai.camera=ai.camera.map(k=>({...k,position:[9,9,9],fov:50}));
 ai.objects.find(o=>o.id==='actor').keys[1].position[0]+=2;
 const merged=core.mergeAuthoringPlan(draft,ai,{preserveManualTracks:true});
 assert.deepEqual(merged.plan.camera,draft.plan.camera);
 assert.equal(merged.plan.objects.find(o=>o.id==='actor').keys[1].position[0],ai.objects.find(o=>o.id==='actor').keys[1].position[0]);
 const restored=core.restoreAuthoringDraft(core.serializeAuthoringDraft(merged));
 assert.deepEqual(core.mergeAuthoringPlan(restored,ai,{preserveManualTracks:true}).plan.camera,draft.plan.camera);
 assert.ok(validateScenePerformance({plan:merged.plan,authoring:merged}).authoring);
});

test('early Finish of a rich take keeps root travel, timed drop, stunt, masks and pins on the same performance seconds',()=>{
 let draft=rigs.makeSceneAuthoringFixture();const arm=draft.rigs.actor.controls.left_shoulder,otherArm=draft.rigs.actor.controls.right_shoulder;
 const pose=structuredClone(draft.plan.objects.find(o=>o.id==='actor').parts.find(p=>p.id===arm).keys[0]);
 draft=apply(draft,
  {kind:'pose',target:{objectId:'actor',partId:arm},time:1.5,pose:{...pose,rotation:[.7,0,0]},interval:[1,2],channels:['rotation']},
  {kind:'lock',target:{objectId:'actor',partId:otherArm},time:.2,end:.4,channels:['rotation']},
  {kind:'event',event:{id:'drop',kind:'detach',objectId:'sword',time:1,landing:{time:1.4,position:[2,.1,1]}}},
  {kind:'move',at:1.2,move:{id:'jump',objectId:'actor',kind:'jump',duration:.5}});
 const recording=rigs.makeSceneAuthoringFixture().plan,actor=recording.objects.find(o=>o.id==='actor'),start=structuredClone(actor.keys[0]);
 actor.keys=[0,1,2].map(t=>({...structuredClone(start),t,position:[t,0,0]}));
 recording.camera=recording.camera.map((k,i)=>({...k,t:i?2:0}));
 const completed=core.finishAuthoringCapturePlan(recording,2);
 const merged=core.mergeAuthoringPlan(draft,completed,{preserveManualTracks:true,controlledObjectId:'actor'});
 const track=merged.plan.objects.find(o=>o.id==='actor');near(core.samplePose(track,1).position,[1,0,0]);near(core.samplePose(track,5).position,[2,0,0]);
 assert.equal(merged.events[0].time,1);assert.equal(merged.events[0].landing.time,1.4);
 assert.equal(merged.moves[0].start,1.2);assert.equal(merged.moves[0].duration,.5);
 assert.equal(merged.masks[0].start,1);assert.equal(merged.masks[0].end,2);
 assert.equal(merged.locks[0].time,.2);assert.equal(merged.locks[0].end,.4);
 assert.ok(core.evaluateAuthoringDraft(merged,.99).plan.objects.find(o=>o.id==='sword').attachment);
 assert.equal(core.evaluateAuthoringDraft(merged,1.01).plan.objects.find(o=>o.id==='sword').attachment,undefined);
 assert.ok(validateScenePerformance({plan:merged.plan,authoring:merged}).authoring);
});

test('lighting choices roundtrip through the shared saved-performance boundary and reject invalid settings',()=>{
 const {LIGHTING_PRESETS,defaultLightingRigForPreset}=require('../server/src/sceneCamera.ts');
 for(const preset of LIGHTING_PRESETS){const light=defaultLightingRigForPreset(preset),draft=apply(rigs.makeSceneAuthoringFixture(),{kind:'lightingRig',lighting:light});
  const restored=validateScenePerformance(JSON.parse(JSON.stringify({plan:draft.plan,authoring:draft})));assert.deepEqual(restored.authoring.lightingRig,light);
 }
 const base=rigs.makeSceneAuthoringFixture();
 for(const patch of[{preset:'unknown'},{azimuthDeg:181},{elevationDeg:-1},{elevationDeg:91},{intensity:6},{intensity:NaN}]){
  const authoring={...base,lightingRig:{...defaultLightingRigForPreset('studio'),...patch}};
  assert.throws(()=>validateScenePerformance({plan:base.plan,authoring}));
 }
});
