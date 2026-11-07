const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const core=require('../server/src/sceneAuthoringPrototype.ts'),rigs=require('../server/src/sceneRigPrototype.ts');
const {validateMotionPlan}=require('../server/src/motionGuidePlan.ts'),{createMotionScene}=require('../src/motionScene.ts');
const {initialMotionMatrix}=require('../server/src/motionNodeTransforms.ts');
const near=(a,b)=>a.forEach((x,i)=>assert.ok(Math.abs(x-b[i])<1e-5,`${x} != ${b[i]}`));
const apply=(d,...c)=>core.applyAuthoringCommands(d,d.revision,c);
const root=(d,t,id='actor')=>core.evaluateAuthoringDraft(d,t).plan.objects.find(o=>o.id===id);
test('A: attach continuation follows a rotated moving parent and preserves the boundary matrix',()=>{
 let d=rigs.makeSceneAuthoringFixture(),actor=d.plan.objects.find(o=>o.id==='actor'),mount=d.plan.objects.find(o=>o.id==='mount');
 const pose=structuredClone(actor.keys[0]);mount.keys=mount.keys.map((k,i)=>({...k,rotation:[0,Math.PI/2,0],position:[i*2,0,0]}));
 d=apply(d,{kind:'pose',target:{objectId:'actor'},time:1,pose},{kind:'pose',target:{objectId:'actor'},time:5,pose:{...pose,position:[pose.position[0]+2,pose.position[1],pose.position[2]]}});
 const before=core.evaluateAuthoringDraft(d,1).plan;
 const attached=apply(d,{kind:'event',event:{id:'attach',kind:'attach',time:1,objectId:'actor',parent:{objectId:'mount'},relation:'riding'}});
 near(initialMotionMatrix(core.evaluateAuthoringDraft(attached,1).plan,'actor'),initialMotionMatrix(before,'actor'));
 const THREE=require('three'),mat=m=>new THREE.Matrix4().set(...m.slice(0,4),...m.slice(4,8),...m.slice(8,12),0,0,0,1);
 const start=core.evaluateAuthoringDraft(attached,1).plan,end=core.evaluateAuthoringDraft(attached,5).plan;
 const localStart=mat(initialMotionMatrix(start,'mount')).invert().multiply(mat(initialMotionMatrix(start,'actor')));
 const a=mat(initialMotionMatrix(before,'actor')),b=mat(initialMotionMatrix(core.evaluateAuthoringDraft(d,5).plan,'actor'));
 const expected=mat(initialMotionMatrix(end,'mount')).multiply(localStart).multiply(a.invert()).multiply(b);
 near(mat(initialMotionMatrix(end,'actor')).elements,expected.elements);
});
test('A: release during a jump does not apply the boundary displacement twice',()=>{
 let d=apply(rigs.makeSceneAuthoringFixture(),{kind:'move',at:1,move:{id:'jump',objectId:'actor',kind:'jump',duration:2}});
 const changed=apply(d,{kind:'event',event:{id:'release',kind:'detach',time:2,objectId:'actor'}});
 for(const t of[2,2.5,3,5])near(initialMotionMatrix(core.evaluateAuthoringDraft(changed,t).plan,'actor'),initialMotionMatrix(core.evaluateAuthoringDraft(d,t).plan,'actor'));
});
test('A: dismount continues authored translation and a later jump, with deterministic backward seek',()=>{
 let d=rigs.makeSceneAuthoringFixture();const p=structuredClone(d.plan.objects.find(o=>o.id==='actor').keys[0]);
 d=apply(d,{kind:'pose',target:{objectId:'actor'},time:3,pose:p},{kind:'pose',target:{objectId:'actor'},time:5,pose:{...p,position:[p.position[0]+2,p.position[1],p.position[2]]}},
 {kind:'event',event:{id:'mount',kind:'attach',time:1,objectId:'actor',parent:{objectId:'mount',partId:'saddle'},relation:'riding',localPose:core.prototypeUnitPose()}},
 {kind:'event',event:{id:'leave',kind:'detach',time:3,objectId:'actor'}},
 {kind:'move',at:3.5,move:{id:'jump',objectId:'actor',kind:'jump',duration:1}});
 const start=root(d,3).keys[0],end=root(d,5).keys[0];assert.ok(Math.hypot(...end.position.map((v,i)=>v-start.position[i]))>1.9);
 assert.ok(root(d,4).keys[0].position[1]>start.position[1]+.8);
 const saved=JSON.stringify(core.evaluateAuthoringDraft(d,4));core.evaluateAuthoringDraft(d,.5);assert.equal(JSON.stringify(core.evaluateAuthoringDraft(d,4)),saved);
});
test('A: released prop lands then continues its own track without old parent motion',()=>{
 let d=rigs.makeSceneAuthoringFixture(),p=structuredClone(d.plan.objects.find(o=>o.id==='sword').keys[0]);
 d=apply(d,{kind:'pose',target:{objectId:'sword'},time:3,pose:p},{kind:'pose',target:{objectId:'sword'},time:5,pose:{...p,position:[p.position[0]+1,p.position[1],p.position[2]]}},
 {kind:'event',event:{id:'drop',kind:'detach',time:2,objectId:'sword',landing:{time:3,position:[1,.1,1]}}});
 near(root(d,3,'sword').keys[0].position,[1,.1,1]);assert.ok(Math.hypot(...root(d,5,'sword').keys[0].position.map((v,i)=>v-[1,.1,1][i]))>.9);
});
test('B: completed rolls restore original pivot and authored rotation, without losing mid-roll movement',()=>{
 let d=rigs.makeSceneAuthoringFixture();d.plan.objects.find(o=>o.id==='actor').pivot=[.1,.2,.3];
 d=apply(d,...Array.from({length:6},(_,i)=>({kind:'move',at:i*.6,move:{id:`roll${i}`,objectId:'actor',kind:'roll',duration:.5}})));
 near(root(d,4).pivot,[.1,.2,.3]);near(root(d,4).keys[0].rotation,d.plan.objects.find(o=>o.id==='actor').keys[0].rotation);
 assert.ok(Math.abs(root(d,.25).keys[0].rotation[0])>3);
});
test('C: lateral target drift projects into supported leg plane across scales',()=>{
 for(const height of[1.1,1.75,2.6]){const made=rigs.humanoidRecipe('actor',[0,0,0],'#bc6674',height),f=rigs.makeSceneAuthoringFixture();
 const d=core.createAuthoringDraft({...f.plan,objects:[made.object]},'ik',{actor:made.rig});
 const target=[3,made.rig.hipHeight*.4,.1],next=apply(d,...rigs.legTargetCommands(d,'actor','left',2,target));
 const m=initialMotionMatrix(core.evaluateAuthoringDraft(next,2).plan,'actor','left_ankle');near([m[3],m[7],m[11]],[-made.rig.halfHipWidth,target[1],target[2]]);}
});
test('D: wide/telephoto FOV and camera up survive validation and shared renderer at exact overhead',()=>{
 for(const fov of[8.6,106.3,135]){const p=rigs.makeSceneAuthoringFixture().plan;p.camera=p.camera.map(k=>({...k,position:[0,8,0],target:[0,0,0],up:[0,0,1],fov}));
 const valid=validateMotionPlan(p);assert.equal(valid.camera[0].fov,fov);near(valid.camera[0].up,[0,0,1]);
 const scene=createMotionScene(valid,540/960);scene.draw(2);near(scene.camera.up.toArray(),[0,0,1]);assert.ok(scene.camera.quaternion.toArray().every(Number.isFinite));scene.dispose();}
});
test('D: opposite up interpolation and parallel up produce finite stable camera bases',()=>{
 const p=rigs.makeSceneAuthoringFixture().plan;p.camera=p.camera.map((k,i)=>({...k,position:[0,8,0],target:[0,0,0],up:i?[0,0,-1]:[0,0,1]}));
 const scene=createMotionScene(validateMotionPlan(p),960/540);for(const t of[0,2.5,5]){scene.draw(t);assert.ok(scene.camera.quaternion.toArray().every(Number.isFinite));assert.ok(scene.camera.up.length()>.99);}scene.dispose();
});
test('D: camera up survives state roundtrip and rejects zero/nonfinite data; key limit reports 96',()=>{
 const {stateAtEnd,newWorldState,planAtState}=require('../server/src/spatialWorld.ts');
 const p=rigs.makeSceneAuthoringFixture().plan;p.camera=p.camera.map(k=>({...k,up:[0,0,1],fov:8.6}));
 const valid=validateMotionPlan(p),state=stateAtEnd(valid,newWorldState(valid));
 const restored=planAtState({plan:valid},JSON.parse(JSON.stringify(state)));near(restored.camera[0].up,[0,0,1]);assert.equal(restored.camera[0].fov,8.6);
 for(const up of[[0,0,0],[NaN,0,1]])assert.throws(()=>validateMotionPlan({...p,camera:p.camera.map(k=>({...k,up}))}));
 assert.throws(()=>validateMotionPlan({...p,camera:Array.from({length:97},(_,i)=>({...p.camera[0],t:5*i/96}))}),/96/);
});
test('P03: interval/channel masks preserve locomotion outside the masked window and protect manual overdub inside',()=>{
 let d=rigs.makeSceneAuthoringFixture();
 const actor=d.plan.objects.find(o=>o.id==='actor'),pose=structuredClone(actor.keys[0]);
 d=apply(d,{kind:'pose',target:{objectId:'actor'},time:5,pose:{...pose,position:[pose.position[0]+3,pose.position[1],pose.position[2]]}},
  {kind:'locomotion',objectId:'actor',enabled:true});
 const armId=d.rigs.actor.controls.right_shoulder,armPose=structuredClone(actor.parts.find(p=>p.id===armId).keys[0]);
 const overdub={...armPose,rotation:[1.1,.2,0]};
 d=apply(d,{kind:'pose',target:{objectId:'actor',partId:armId},time:2,pose:overdub,interval:[1.5,2.5],channels:['rotation']});
 const inside=core.evaluateAuthoringDraft(d,2).plan.objects.find(o=>o.id==='actor').parts.find(p=>p.id===armId).keys[0];
 near(inside.rotation,overdub.rotation);
 const outside=core.evaluateAuthoringDraft(d,4).plan.objects.find(o=>o.id==='actor').parts.find(p=>p.id===armId).keys[0];
 const interpolated=core.samplePose(d.plan.objects.find(o=>o.id==='actor').parts.find(p=>p.id===armId),4);
 assert.ok(Math.abs(outside.rotation[0]-interpolated.rotation[0])>0.01,'locomotion still animates outside mask interval');
});
test('P03: interval contact pins reject edits inside the contact window and facts events preserve unrelated state',()=>{
 const {validateScenePerformance,scenePerformanceText,performanceSelection}=require('../server/src/scenePerformance.ts');
 let d=rigs.makeSceneAuthoringFixture();
 d.sourceState.conditions={weather:'snow'};d.sourceState.objects.actor.facts={stamina:100};
 const handId=d.rigs.actor.controls.left_shoulder,handPose=structuredClone(d.plan.objects.find(o=>o.id==='actor').parts.find(p=>p.id===handId).keys[0]);
 d=apply(d,{kind:'lock',target:{objectId:'actor',partId:handId},time:1,end:3,channels:['rotation']},
  {kind:'event',event:{id:'grip-fact',kind:'facts',time:1.5,objectId:'actor',conditions:{alarm:true},facts:{gripping:'rail'}}});
 assert.throws(()=>apply(d,{kind:'pose',target:{objectId:'actor',partId:handId},time:2,pose:{...handPose,rotation:[1.4,0,0]}}),/pinned pose/);
 const endState=core.evaluateAuthoringDraft(d,5).state;
 assert.deepEqual(endState.conditions,{weather:'snow',alarm:true});
 assert.deepEqual(endState.objects.actor.facts,{stamina:100,gripping:'rail'});
 const valid=validateScenePerformance({plan:d.plan,authoring:d});
 assert.ok(valid.authoring);
 const hashA=scenePerformanceText(d.plan,'16:9',d);
 const d2=apply(d,{kind:'cameraRig',rig:{kind:'overhead',target:{objectId:'actor'},height:6,heading:0,focalLengthMm:35,aspect:16/9}});
 const hashB=scenePerformanceText(d2.plan,'16:9',d2);
 assert.equal(JSON.stringify(d.plan),JSON.stringify(d2.plan));
 assert.notEqual(hashA,hashB,'cameraRig-only edit invalidates performance hash even when legacy plan JSON is identical');
 const sel=performanceSelection(valid);
 assert.ok(sel.some(s=>s.objectId==='actor'&&s.kind==='entity'&&s.capabilities.includes('ik')));
 assert.ok(sel.some(s=>s.objectId==='actor'&&s.controlName==='left_ankle'&&s.ikTarget));
});
test('P04: computeAspectFitBox calculates exact inscribed canvas box across 9:16, 1:1 and 16:9',()=>{
 const path=require('node:path');
 const {outputText}=ts.transpileModule(fs.readFileSync('src/components/SpatialWorldViewport.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}});
 const fn=new Function('exports','require','module',outputText);
 const mod={exports:{}};
 fn(mod.exports,(id)=>id==='react'?{forwardRef:x=>x,useRef:()=>({}),useImperativeHandle:()=>{},useEffect:()=>{}}:id==='three/examples/jsm/controls/TransformControls.js'?{TransformControls:class{}}:id.startsWith('.')?require(path.resolve('src/components',id)):require(id),mod);
 const fit916=mod.exports.computeAspectFitBox(1000,800,'9:16');
 assert.equal(fit916.height,800);assert.equal(fit916.width,450);assert.equal(fit916.left,275);assert.equal(fit916.top,0);
 const fit169=mod.exports.computeAspectFitBox(800,1000,'16:9');
 assert.equal(fit169.width,800);assert.equal(fit169.height,450);assert.equal(fit169.left,0);assert.equal(fit169.top,275);
 const fit11=mod.exports.computeAspectFitBox(900,600,'1:1');
 assert.equal(fit11.width,600);assert.equal(fit11.height,600);assert.equal(fit11.left,150);assert.equal(fit11.top,0);
});
test('P05/P06: sceneAuthoring, sceneRig, sceneCamera and sceneAssist preserve pins, stale checks and camera guidance',()=>{
 const {createAuthoringDraft,applyAuthoringCommands}=require('../server/src/sceneAuthoring.ts');
 const {bindWorldRigs}=require('../server/src/sceneRig.ts');
 const {compileDownstreamCameraGuidance}=require('../server/src/sceneCamera.ts');
 const {proposeSceneAssistCommands,applySceneAssistProposal}=require('../server/src/sceneAssist.ts');
 const f=rigs.makeSceneAuthoringFixture();
 const bound=bindWorldRigs(f.plan);
 assert.ok(bound.actor);
 let draft=createAuthoringDraft(f.plan,'d1',bound);
 const cmds=proposeSceneAssistCommands(draft,{instruction:'wave right arm and jump and zolly',participants:['actor'],time:1});
 assert.ok(cmds.length>=2);
 assert.throws(()=>applySceneAssistProposal(draft,{draftId:draft.draftId,sourceKey:'d1',revision:99},['actor'],cmds),/Stale authoring revision/);
 assert.throws(()=>applySceneAssistProposal(draft,{draftId:draft.draftId,sourceKey:'d1',revision:draft.revision},['sword'],cmds),/outside the requested participants/);
 draft=applySceneAssistProposal(draft,{draftId:draft.draftId,sourceKey:'d1',revision:draft.revision},['actor'],cmds);
 const guidance=compileDownstreamCameraGuidance(draft.plan,draft);
 assert.match(guidance,/35\s*mm/i);assert.match(guidance,/dolly[- ]zoom|zolly/i);
});
test('P08: IncrementalConstructionDecoder handles arbitrary UTF-8 byte splits, dependency gating and duplicate sequence protection',()=>{
 const {IncrementalConstructionDecoder}=require('../server/src/sceneStreamDecoder.ts');
 const {createAuthoringDraft}=require('../server/src/sceneAuthoring.ts');
 const f=rigs.makeSceneAuthoringFixture();
 const draft=createAuthoringDraft(f.plan,'stream1',rigs.bindWorldRigs(f.plan));
 const decoder=new IncrementalConstructionDecoder(draft,'build_01');
 const batch1={buildId:'build_01',sequence:1,dependsOn:['sword'],progress:0.5,commands:[{kind:'move',at:1,move:{id:'m1',objectId:'actor',kind:'jump',duration:1}}]};
 const batch2={buildId:'build_01',sequence:2,dependsOn:['missing_entity'],progress:0.8,commands:[{kind:'move',at:2,move:{id:'m2',objectId:'actor',kind:'roll',duration:0.8}}]};
 const streamText=`${JSON.stringify(batch1)}\n${JSON.stringify(batch2)}\n${JSON.stringify(batch1)}\n`;
 const bytes=Buffer.from(streamText,'utf8');
 for(let i=0;i<bytes.length;i+=7){
  decoder.push(bytes.subarray(i,Math.min(bytes.length,i+7)));
 }
 const snap=decoder.snapshot;
 assert.deepEqual(snap.acceptedSequences,[1],'first valid batch accepted once and duplicate sequence ignored');
 assert.equal(snap.pendingBatches.length,1,'batch with missing dependency held in pendingBatches without mutating accepted draft');
 assert.equal(snap.draft.revision,draft.revision+1);
});
test('P09/P10: motion/action presets retarget across actor heights and generate creator-economy entitlement receipts',()=>{
 const {createAuthoringDraft,applyAuthoringCommands}=require('../server/src/sceneAuthoring.ts');
 const {extractMotionNodePreset,applyMotionPreset,extractActionNodePreset,applyActionPreset,submitPresetForPublication,approvePublishedPreset,createPresetEntitlementReceipt}=require('../server/src/scenePresets.ts');
 const f=rigs.makeSceneAuthoringFixture();
 let draft=createAuthoringDraft(f.plan,'p1',rigs.bindWorldRigs(f.plan));
 const actorStart=structuredClone(draft.plan.objects.find(o=>o.id==='actor').keys[0]);
 draft=applyAuthoringCommands(draft,draft.revision,[
  {kind:'pose',target:{objectId:'actor'},time:2,pose:{...actorStart,t:2,position:[actorStart.position[0]+2,actorStart.position[1],actorStart.position[2]]}},
  {kind:'move',at:1,move:{id:'mv1',objectId:'actor',kind:'jump',duration:1}},
  {kind:'event',event:{id:'ev1',kind:'detach',time:1.5,objectId:'sword',landing:{time:2.2,position:[1,0.1,1]}}},
 ]);
 const motionPreset=extractMotionNodePreset(draft,'actor',{presetId:'mp_stride',title:'Stride Jump',description:'test'});
 const tallHero=rigs.humanoidRecipe('tall_actor',[0,0,0],'#bc6674',2.7);
 const tallDraft=createAuthoringDraft({...f.plan,objects:[tallHero.object]},'p2',{tall_actor:tallHero.rig});
 const retargeted=applyMotionPreset(tallDraft,motionPreset,'tall_actor',0).draft;
 const movedKey=retargeted.plan.objects.find(o=>o.id==='tall_actor').keys.find(k=>Math.abs(k.t-2)<1e-5);
 const expectedRatio=tallHero.rig.hipHeight/motionPreset.referenceHipHeight;
 assert.ok(movedKey && Math.abs(movedKey.position[0]-2*expectedRatio)<1e-4,'stride scaled proportionally to hipHeight');
 const actionPreset=extractActionNodePreset(draft,{actor:'actor',prop:'sword'},{presetId:'ap_drop',title:'Drop Sword',description:'test'});
 const baseForAction=createAuthoringDraft(f.plan,'p3',rigs.bindWorldRigs(f.plan));
 const withAction=applyActionPreset(baseForAction,actionPreset,{actor:'actor',prop:'sword'},0).draft;
 assert.equal(withAction.events.filter(event=>event.kind==='detach').length,1);
 const {evaluateAuthoringDraft}=require('../server/src/sceneAuthoring.ts');
 assert.deepEqual(evaluateAuthoringDraft(withAction,.5).plan.objects.find(object=>object.id==='sword').attachment,{objectId:'actor',partId:'right_wrist'});
 assert.equal(evaluateAuthoringDraft(withAction,3).plan.objects.find(object=>object.id==='sword').attachment,undefined);
 const submitted=submitPresetForPublication(motionPreset,{pricePixels:25,creatorShareBps:8000});
 assert.equal(submitted.visibility,'public_review');
 const published=approvePublishedPreset(submitted);
 assert.equal(published.visibility,'published');
 const receipt=createPresetEntitlementReceipt(published,42,'idem_1');
 assert.equal(receipt.pricePixels,25);assert.equal(receipt.creatorEarnedPixels,20);assert.equal(receipt.platformFeePixels,5);
});
test('AuthoringHistory adopt/undo/redo and node isolation preserve multi-step edits',()=>{
 const {AuthoringHistory,createAuthoringDraft,applyAuthoringCommands}=require('../server/src/sceneAuthoring.ts');
 const f=rigs.makeSceneAuthoringFixture();
 const draftA=createAuthoringDraft(f.plan,'nodeA',rigs.bindWorldRigs(f.plan));
 const draftB=createAuthoringDraft(f.plan,'nodeB',rigs.bindWorldRigs(f.plan));
 const histA=new AuthoringHistory(draftA);
 const histB=new AuthoringHistory(draftB);
 assert.equal(histA.canUndo,false);
 assert.equal(histA.canRedo,false);
 const dragged=applyAuthoringCommands(histA.current,histA.current.revision,[
  {kind:'pose',target:{objectId:'actor'},time:0,pose:{t:0,position:[1.2,0,0.4],rotation:[0,0,0],scale:[1,1,1]}},
 ]);
 histA.adopt(dragged);
 assert.equal(histA.canUndo,true);
 assert.equal(histA.canRedo,false);
 assert.deepEqual(histA.current.plan.objects.find(o=>o.id==='actor').keys[0].position,[1.2,0,0.4]);
 assert.deepEqual(histB.current.plan.objects.find(o=>o.id==='actor').keys[0].position,draftB.plan.objects.find(o=>o.id==='actor').keys[0].position,'nodeB history remains isolated from nodeA edits');
 const undone=histA.undo();
 assert.equal(histA.canUndo,false);
 assert.equal(histA.canRedo,true);
 assert.deepEqual(undone.plan.objects.find(o=>o.id==='actor').keys[0].position,draftA.plan.objects.find(o=>o.id==='actor').keys[0].position);
 const redone=histA.redo();
 assert.equal(histA.canUndo,true);
 assert.equal(histA.canRedo,false);
 assert.deepEqual(redone.plan.objects.find(o=>o.id==='actor').keys[0].position,[1.2,0,0.4]);
});
test('Blocker 1: Manual MotionGuide commit and preview validate edited authoring.plan without freezing animated tracks',()=>{
 const {validateScenePerformance,evaluateScenePerformance}=require('../server/src/scenePerformance.ts');
 const f=rigs.makeSceneAuthoringFixture();
 let draft=core.createAuthoringDraft(f.plan,'mg_1',rigs.bindWorldRigs(f.plan));
 const actor=draft.plan.objects.find(o=>o.id==='actor');
 const startPose=structuredClone(actor.keys[0]);
 // Add animated key at t=2.5 and end key at t=5
 draft=apply(draft,
  {kind:'pose',target:{objectId:'actor'},time:2.5,pose:{...startPose,position:[2,startPose.position[1],startPose.position[2]]}},
  {kind:'pose',target:{objectId:'actor'},time:5,pose:{...startPose,position:[4,startPose.position[1],startPose.position[2]]}},
 );
 // Passing mismatched legacy plan vs edited authoring.plan is rejected by validator:
 assert.throws(()=>validateScenePerformance({plan:f.plan,authoring:draft}),/Authoring and legacy source plans disagree/);
 // Passing activeAuthoring.plan alongside activeAuthoring succeeds and preserves multi-key animation:
 const validated=validateScenePerformance({plan:draft.plan,authoring:draft});
 assert.equal(validated.plan.objects.find(o=>o.id==='actor').keys.length,3,'animated track keys are preserved rather than frozen to 2 endpoint keys');
 const midFrame=evaluateScenePerformance(validated,2.5);
 near(midFrame.objects.find(o=>o.id==='actor').keys[0].position,[2,startPose.position[1],startPose.position[2]]);
});
test('Blocker 2 & 3: mergeAuthoringPlan preserves manual limb tracks across recording/route adoption and forward edits invalidate stale return',()=>{
 const {validateScenePerformance}=require('../server/src/scenePerformance.ts');
 const f=rigs.makeSceneAuthoringFixture();
 let draft=core.createAuthoringDraft(f.plan,'studio_1',rigs.bindWorldRigs(f.plan));
 const armId=draft.rigs.actor.controls.right_shoulder;
 const armPart=draft.plan.objects.find(o=>o.id==='actor').parts.find(p=>p.id===armId);
 const raisedArm={...structuredClone(armPart.keys[0]),rotation:[1.25,0.4,-0.2]};
 draft=apply(draft,{kind:'pose',target:{objectId:'actor',partId:armId},time:0,pose:raisedArm,holdTail:true});
 // Simulate finishCapture producing a new root movement plan from planAtState (where limb tracks are default/unposed)
 const recordedPlan=structuredClone(f.plan);
 const recordedActor=recordedPlan.objects.find(o=>o.id==='actor');
 recordedActor.keys=[{...recordedActor.keys[0],t:0},{...recordedActor.keys[0],t:5,position:[3,recordedActor.keys[0].position[1],0]}];
 const mergedAfterRecord=core.mergeAuthoringPlan(draft,recordedPlan,{preserveManualTracks:true,controlledObjectId:'actor'});
 validateScenePerformance({plan:mergedAfterRecord.plan,authoring:mergedAfterRecord});
 // Root travel from recording is kept AND manual limb pose is preserved!
 near(mergedAfterRecord.plan.objects.find(o=>o.id==='actor').keys.at(-1).position,[3,recordedActor.keys[0].position[1],0]);
 near(mergedAfterRecord.plan.objects.find(o=>o.id==='actor').parts.find(p=>p.id===armId).keys[0].rotation,[1.25,0.4,-0.2]);
 // Now simulate studio pose edit on top of an existing pending.forward route (isNewAuthoringEdit: true)
 const posedInStudio=apply(mergedAfterRecord,{kind:'pose',target:{objectId:'sword'},time:5,pose:{t:5,position:[4.5,1.1,0.5],rotation:[0,0.8,0],scale:[1,1,1]}});
 const syncedForwardAuthoring=core.mergeAuthoringPlan(posedInStudio,mergedAfterRecord.plan,{preserveManualTracks:true,isNewAuthoringEdit:true});
 validateScenePerformance({plan:syncedForwardAuthoring.plan,authoring:syncedForwardAuthoring});
 const evaluatedEnd=core.evaluateAuthoringDraft(syncedForwardAuthoring,syncedForwardAuthoring.plan.duration);
 near(evaluatedEnd.state.objects.sword.transform.position,[4.5,1.1,0.5]);
});
test('Blocker 4: Live gizmo transient pose updates rendered THREE.Object3D world matrix with matrixAutoUpdate=false',()=>{
 const f=rigs.makeSceneAuthoringFixture();
 const scene=createMotionScene(f.plan,960/540);
 scene.draw(0);
 const actorGroup=scene.roots.get('actor');
 assert.equal(actorGroup.matrixAutoUpdate,false,'motionScene disables matrixAutoUpdate on root groups');
 const pendingPose={t:0,position:[3.25,1.5,-1.25],rotation:[0,Math.PI/4,0],scale:[1,1,1]};
 const transientPlan={
  ...f.plan,
  objects:f.plan.objects.map(obj=>obj.id==='actor'?{...obj,keys:[{...pendingPose,t:0},{...pendingPose,t:f.plan.duration}]}:obj),
 };
 scene.draw(0,transientPlan);
 const worldPos=new (require('three').Vector3)();
 actorGroup.getWorldPosition(worldPos);
 near(worldPos.toArray(),[3.25,1.5,-1.25]);
 scene.dispose();
});
test('Blocker 5: Pin interval protects the entire locked window against off-midpoint pose edits, locomotion, and moves',()=>{
 let d=rigs.makeSceneAuthoringFixture();
 const actor=d.plan.objects.find(o=>o.id==='actor');
 const handId=d.rigs.actor.controls.left_shoulder;
 const handPart=actor.parts.find(p=>p.id===handId);
 const baseHandPose=structuredClone(handPart.keys[0]);
 // Enable locomotion and root travel across [0..5]
 d=apply(d,
  {kind:'pose',target:{objectId:'actor'},time:5,pose:{...actor.keys[0],position:[4,actor.keys[0].position[1],0]}},
  {kind:'locomotion',objectId:'actor',enabled:true},
  {kind:'lock',target:{objectId:'actor',partId:handId},time:1,end:3,channels:['rotation']},
 );
 // Locomotion must not alter the pinned hand rotation anywhere in [1, 3]
 const lockedRot=d.locks[0].pose.rotation;
 for(const t of [1,1.25,1.73,2,2.41,2.85,3]){
  const sampled=core.evaluateAuthoringDraft(d,t).plan.objects.find(o=>o.id==='actor').parts.find(p=>p.id===handId).keys[0];
  near(sampled.rotation,lockedRot);
 }
 // Off-midpoint edit at t=1.25 (not start=1, midpoint=2, or end=3) must be rejected!
 assert.throws(()=>apply(d,{kind:'pose',target:{objectId:'actor',partId:handId},time:1.25,pose:{...baseHandPose,rotation:[1.3,0.2,0]}}),/pinned pose/);
 // Off-midpoint edit at t=2.75 must also be rejected!
 assert.throws(()=>apply(d,{kind:'pose',target:{objectId:'actor',partId:handId},time:2.75,pose:{...baseHandPose,rotation:[-0.9,0,0]}}),/pinned pose/);
});
test('Blocker 6: AI refinement mergeAuthoringPlan retains events, moves, cameraRig, locks and manual controls',()=>{
 const {validateScenePerformance}=require('../server/src/scenePerformance.ts');
 let d=rigs.makeSceneAuthoringFixture();
 const armId=d.rigs.actor.controls.right_shoulder;
 const armPose=structuredClone(d.plan.objects.find(o=>o.id==='actor').parts.find(p=>p.id===armId).keys[0]);
 d=apply(d,
  {kind:'pose',target:{objectId:'actor',partId:armId},time:1,pose:{...armPose,rotation:[0.9,0.2,0]},holdTail:true},
  {kind:'cameraRig',rig:{kind:'zolly',target:{objectId:'actor'},focalLengthMm:35,startDistance:4,endDistance:9,height:0.5}},
  {kind:'move',at:1.5,move:{id:'jump_1',objectId:'actor',kind:'jump',duration:1}},
  {kind:'event',event:{id:'ev_fact',kind:'facts',time:2,objectId:'actor',conditions:{alert:true}}},
 );
 // Simulate AI returning a refined MotionPlan with new root travel
 const aiPlan=structuredClone(d.plan);
 const aiActor=aiPlan.objects.find(o=>o.id==='actor');
 aiActor.keys=[{...aiActor.keys[0],t:0},{...aiActor.keys[0],t:5,position:[2.5,aiActor.keys[0].position[1],-1]}];
 const merged=core.mergeAuthoringPlan(d,aiPlan,{preserveManualTracks:true});
 const validated=validateScenePerformance({plan:merged.plan,authoring:merged});
 assert.equal(validated.authoring.cameraRig?.kind,'zolly');
 assert.equal(validated.authoring.moves.length,1);
 assert.equal(validated.authoring.events.length,1);
 near(validated.plan.objects.find(o=>o.id==='actor').parts.find(p=>p.id===armId).keys.at(-1).rotation,[0.9,0.2,0]);
 near(validated.plan.objects.find(o=>o.id==='actor').keys.at(-1).position,[2.5,aiActor.keys[0].position[1],-1]);
});
test('Lighting rig, manual camera framing offsets/roll, and stage preset graph extraction work end-to-end',()=>{
 const {defaultLightingRigForPreset,compileDownstreamCameraGuidance}=require('../server/src/sceneCamera.ts');
 const {extractStagePreset}=require('../server/src/scenePresets.ts');
 let d=rigs.makeSceneAuthoringFixture();
 const baseCam=structuredClone(d.plan.camera[0]);
 d=apply(d,
  {kind:'cameraRig',rig:{kind:'free',focalLengthMm:50,offset:[0.45,0.35,-0.6],targetOffset:[0,0.3,0],roll:0.175}},
  {kind:'lightingRig',lighting:defaultLightingRigForPreset('golden')},
 );
 const evaluated=core.evaluateAuthoringDraft(d,0);
 near(evaluated.plan.camera[0].position,[baseCam.position[0]+0.45,baseCam.position[1]+0.35,baseCam.position[2]-0.6]);
 near(evaluated.plan.camera[0].target,[baseCam.target[0],baseCam.target[1]+0.3,baseCam.target[2]]);
 assert.equal(evaluated.plan.camera[0].roll,0.175);
 const guidance=compileDownstreamCameraGuidance(evaluated.plan,d,'16:9');
 assert.match(guidance,/50 mm rectilinear lens/);
 assert.match(guidance,/dutch roll 10°/);
 assert.match(guidance,/LIGHTING: warm golden-hour key light/);

 const scene=createMotionScene(evaluated.plan,960/540);
 scene.draw(0,evaluated.plan,d.lightingRig);
 scene.dispose();

 const stageWorld={
  version:2,
  model:'luna',
  revision:3,
  sourceImage:'https://cdn.example/private.png',
  aspectRatio:'16:9',
  controlledObject:'actor',
  controlMode:'character',
  plan:d.plan,
  walkable:[{min:[-5,0,-5],max:[5,0,5]}],
  obstacles:[],
  initialState:d.sourceState,
 };
 const stagePreset=extractStagePreset(
  stageWorld,
  d.rigs,
  {presetId:'stage_graph_1',title:'Full Stage Preset'},
  {
   nodes:[{id:'n0',label:'Start',frameUrl:'https://cdn.example/frame0.png',createdAt:1},{id:'n1',label:'Step 1',frameUrl:'https://cdn.example/frame1.png',createdAt:2}],
   connections:[{id:'c1',sourceNodeId:'n0',targetNodeId:'n1',kind:'movement',forward:{videoUrl:'https://cdn.example/live.mp4'}}],
   routes:{c1:{connectionId:'c1',worldRevision:3,forward:{id:'a1',plan:d.plan,authoring:d,referenceVideo:'https://cdn.example/ref.mp4',startAnchor:'https://cdn.example/s.png',endAnchor:'https://cdn.example/e.png',sourceState:d.sourceState,endState:d.sourceState}}},
   states:{n0:d.sourceState,n1:d.sourceState},
  },
 );
 assert.equal(stagePreset.nodes.length,2);
 assert.equal(stagePreset.nodes[0].frameUrl,undefined);
 assert.equal(stagePreset.connections[0].forward,undefined);
 assert.equal(stagePreset.routes.c1.forward.referenceVideo,undefined);
 assert.equal(stagePreset.routes.c1.forward.authoring?.lightingRig?.preset,'golden');
});
