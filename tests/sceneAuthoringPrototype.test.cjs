const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
require.extensions['.ts']=(mod,filename)=>mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
const core=require('../server/src/sceneAuthoringPrototype.ts'),rigs=require('../server/src/sceneRigPrototype.ts'),transforms=require('../server/src/motionNodeTransforms.ts'),THREE=require('three');
const {createMotionScene}=require('../src/motionScene.ts');
const cameras=require('../server/src/sceneCameraPrototype.ts'),assist=require('../server/src/sceneAssistPrototype.ts');
const near=(a,b,tolerance=1e-6)=>{assert.equal(a.length,b.length);a.forEach((n,i)=>assert.ok(Math.abs(n-b[i])<tolerance,`${i}: ${n} != ${b[i]}`));};
const worldPosition=(plan,id,part)=>{const m=transforms.initialMotionMatrix(plan,id,part);return[m[3],m[7],m[11]];};
const apply=(draft,...commands)=>core.applyAuthoringCommands(draft,draft.revision,commands);
const drop=(time=2)=>({kind:'event',event:{id:'drop',kind:'detach',time,objectId:'sword',landing:{time:time+.6,position:[1,.09,1]}}});

test('timed release preserves instantaneous world pose, lands durably and never mutates source or sibling',()=>{
 const original=rigs.makeSceneAuthoringFixture(),saved=JSON.stringify(original),draft=apply(original,drop());
 near(worldPosition(core.evaluateAuthoringDraft(original,2).plan,'sword'),worldPosition(core.evaluateAuthoringDraft(draft,2).plan,'sword'));
 assert.ok(core.evaluateAuthoringDraft(draft,1.99).plan.objects.find(o=>o.id==='sword').attachment);
 const end=core.evaluateAuthoringDraft(draft,5);assert.equal(end.plan.objects.find(o=>o.id==='sword').attachment,undefined);near(end.state.objects.sword.transform.position,[1,.09,1]);
 assert.ok(!end.state.relationships.some(r=>r.to==='sword'&&r.relation==='holds'));
 assert.deepEqual(core.evaluateAuthoringDraft(draft,0).state.relationships,original.sourceState.relationships);
 assert.equal(JSON.stringify(original),saved);assert.ok(core.evaluateAuthoringDraft(original,5).plan.objects.find(o=>o.id==='sword').attachment);
});

test('a moving parent carries the held prop; release stops inheriting the parent path',()=>{
 let draft=rigs.makeSceneAuthoringFixture();const root=draft.plan.objects.find(o=>o.id==='actor'),pose=structuredClone(root.keys[0]);pose.position[0]+=4;
 draft=apply(draft,{kind:'pose',target:{objectId:'actor'},time:5,pose});const released=apply(draft,{kind:'event',event:{id:'release',kind:'detach',time:2,objectId:'sword'}});
 near(worldPosition(core.evaluateAuthoringDraft(released,2).plan,'sword'),worldPosition(core.evaluateAuthoringDraft(released,5).plan,'sword'));
 assert.ok(worldPosition(core.evaluateAuthoringDraft(draft,5).plan,'sword')[0]-worldPosition(core.evaluateAuthoringDraft(released,5).plan,'sword')[0]>2);
});

test('mount then dismount preserves rider and held prop, with no duplicate identities or repeated effects on seek',()=>{
 let draft=rigs.makeSceneAuthoringFixture();draft.sourceState.objects.actor.facts.quest='kept';
 draft=apply(draft,{kind:'event',event:{id:'mount',kind:'attach',time:1.5,objectId:'actor',parent:{objectId:'mount',partId:'saddle'},relation:'riding',localPose:core.prototypeUnitPose([0,.1,0])}},{kind:'event',event:{id:'dismount',kind:'detach',time:3.5,objectId:'actor'}});
 for(const time of[4,0,2,4,2]){const result=core.evaluateAuthoringDraft(draft,time);assert.equal(result.plan.objects.filter(o=>o.id==='actor').length,1);assert.equal(result.state.relationships.filter(r=>r.relation==='riding').length,time>=1.5&&time<3.5?1:0);assert.ok(result.plan.objects.find(o=>o.id==='sword').attachment);assert.equal(result.state.objects.actor.facts.quest,'kept');}
 const at=core.evaluateAuthoringDraft(draft,3.5),before=core.evaluateAuthoringDraft({...draft,events:draft.events.slice(0,1)},3.5);near(worldPosition(at.plan,'actor'),worldPosition(before.plan,'actor'));
});

test('invalid cycles, duplicate events and unsupported event discriminators leave the draft unchanged',()=>{
 const draft=rigs.makeSceneAuthoringFixture(),before=JSON.stringify(draft);
 assert.throws(()=>apply(draft,{kind:'event',event:{id:'cycle',kind:'attach',time:1,objectId:'actor',parent:{objectId:'sword'},relation:'attached'}}),/cycle/);
 assert.throws(()=>apply(draft,drop(),drop()),/unique/);
 assert.throws(()=>apply(draft,{kind:'event',event:{id:'bad',kind:'unsupported',time:1,objectId:'sword'}}),/Unsupported/);
 assert.equal(JSON.stringify(draft),before);
});

test('performance clock records stationary time and pauses without requiring root travel',()=>{
 const clock=new core.PerformanceClock(5);clock.start();clock.advance(1.25);clock.pause();clock.advance(1);assert.equal(clock.time,1.25);clock.start(clock.time);clock.advance(8);assert.equal(clock.time,5);assert.equal(clock.recording,false);assert.throws(()=>clock.advance(NaN));
 let draft=rigs.makeSceneAuthoringFixture();draft=apply(draft,{kind:'move',at:1,move:{id:'crouch',objectId:'actor',kind:'crouch',duration:1}});
 const first=core.evaluateAuthoringDraft(draft,0),middle=core.evaluateAuthoringDraft(draft,1.5);near(first.state.objects.actor.transform.position,middle.state.objects.actor.transform.position);
 assert.ok(middle.state.objects.actor.parts.pelvis.position[1]<first.state.objects.actor.parts.pelvis.position[1]-.2);
});

test('two move presses create separate queued performances and reject truncated endpoints',()=>{
 const draft=apply(rigs.makeSceneAuthoringFixture(),{kind:'move',at:1,move:{id:'roll-a',kind:'roll',objectId:'actor',duration:.8}},{kind:'move',at:1,move:{id:'roll-b',kind:'roll',objectId:'actor',duration:.8}});
 near(draft.moves.map(move=>move.start),[1,1.8]);
 for(const time of[1.4,2.2])assert.ok(core.evaluateAuthoringDraft(draft,time).state.objects.actor.transform.rotation[0]>3);
 near(core.evaluateAuthoringDraft(draft,2.6).state.objects.actor.transform.rotation,draft.plan.objects.find(o=>o.id==='actor').keys[0].rotation);
 assert.throws(()=>apply(draft,{kind:'move',at:4.8,move:{id:'late',kind:'jump',objectId:'actor',duration:1}}),/beyond/);
});

test('manual foot solving reaches the selected point with unit control scales across recipe sizes',()=>{
 for(const height of[1.1,1.75,2.6]){
  const made=rigs.humanoidRecipe('actor',[0,0,0],'#bc6674',height),fixture=rigs.makeSceneAuthoringFixture(),plan={...fixture.plan,objects:[made.object]};
  let draft=core.createAuthoringDraft(plan,'ik',{actor:made.rig});const target=[-made.rig.halfHipWidth,made.rig.hipHeight*.35,.2*(height/1.75)];
  draft=apply(draft,...rigs.legTargetCommands(draft,'actor','left',2,target,true));const frame=core.evaluateAuthoringDraft(draft,2).plan;
  near(worldPosition(frame,'actor','left_ankle'),target,1e-5);for(const p of frame.objects[0].parts.filter(p=>p.shape==='anchor'))near(p.keys[0].scale,[1,1,1]);
 }
});

test('manual edits can be refined until explicitly pinned; pinned controls and stale results remain protected',()=>{
 const history=new core.AuthoringHistory(rigs.makeSceneAuthoringFixture()),captured=structuredClone(history.current),target={objectId:'actor',partId:'left_hip'},pose={...core.prototypeUnitPose([-.18,0,0]),rotation:[.3,0,0]};
 history.commit([{kind:'pose',target,time:2,pose}]);const refined=core.applyAuthoringRefinement(history.current,history.current,[{kind:'pose',target,time:2,pose:{...pose,rotation:[.5,0,0]}}]);assert.equal(core.evaluateAuthoringDraft(refined,2).state.objects.actor.parts.left_hip.rotation[0],.5);
 history.commit([{kind:'lock',target,time:2,channels:['rotation']}]);assert.throws(()=>history.commit([{kind:'pose',target,time:2,pose:{...pose,rotation:[.6,0,0]}}]),/pinned/);
 assert.throws(()=>core.applyAuthoringRefinement(history.current,captured,[]),/Stale/);const undo=history.undo();assert.ok(undo.revision>2);assert.throws(()=>core.applyAuthoringRefinement(undo,captured,[]),/Stale/);
 assert.throws(()=>core.applyAuthoringRefinement(rigs.makeSceneAuthoringFixture(),captured,[]),/another/);
});

test('camera-only editing survives save/reload and export frame evaluation without actor motion',()=>{
 let draft=rigs.makeSceneAuthoringFixture();const camera={...draft.plan.camera[0],roll:.4,fov:55};draft=apply(draft,{kind:'camera',time:2.5,camera},drop());
 const restored=core.restoreAuthoringDraft(core.serializeAuthoringDraft(draft));assert.deepEqual(core.evaluateAuthoringDraft(restored,2.5),core.evaluateAuthoringDraft(draft,2.5));
 const frames=core.evaluateAuthoringFrames(restored,10);assert.equal(frames.length,50);assert.equal(frames[0].timestamp,0);assert.equal(frames[49].timestamp,4.9);assert.deepEqual(frames[49].frame,core.evaluateAuthoringDraft(restored,5).plan);assert.equal(core.evaluateAuthoringDraft(restored,2.5).plan.camera[0].roll,.4);
 assert.throws(()=>core.restoreAuthoringDraft('{"schema":"future"}'),/Invalid/);
});

test('shared renderer matrices agree with the state evaluator across reparenting, release and scrubbing',()=>{
 const draft=apply(rigs.makeSceneAuthoringFixture(),drop());const view=createMotionScene(draft.plan,16/9);
 try{for(const time of[0,1.4,2,2.2,5,0,5]){const frame=core.evaluateAuthoringDraft(draft,time).plan;view.draw(0,frame);for(const id of['actor','sword','mount'])near(view.roots.get(id).getWorldPosition(new THREE.Vector3()).toArray(),worldPosition(frame,id),1e-5);}}finally{view.dispose();}
});

test('creature identities and vehicle controls remain distinct; locomotion does not overwrite manual limb tracks',()=>{
 const creatures=rigs.makeSceneAuthoringFixture('creatures');assert.equal(creatures.plan.objects.filter(o=>o.role==='actor').length,2);assert.notEqual(creatures.plan.objects[1].subjectColor,creatures.plan.objects[2].subjectColor);
 let draft=rigs.makeSceneAuthoringFixture('vehicles');draft=apply(draft,{kind:'locomotion',objectId:'helicopter',enabled:true});assert.ok(core.evaluateAuthoringDraft(draft,.2).state.objects.helicopter.parts.rotor.rotation[1]>3);
 draft=rigs.makeSceneAuthoringFixture();const actor=draft.plan.objects.find(o=>o.id==='actor'),end=structuredClone(actor.keys[0]);end.position[2]+=3;
 draft=apply(draft,{kind:'pose',target:{objectId:'actor'},time:5,pose:end},{kind:'locomotion',objectId:'actor',enabled:true});
 const pose={...core.prototypeUnitPose([.27,.17,0]),rotation:[.7,0,0]};draft=apply(draft,{kind:'pose',target:{objectId:'actor',partId:'right_shoulder'},time:2,pose});
 const frame=core.evaluateAuthoringDraft(draft,2);assert.equal(frame.state.objects.actor.parts.right_shoulder.rotation[0],.7);assert.ok(Math.abs(frame.state.objects.actor.parts.left_hip.rotation[0])>.1);
});

test('lens math agrees with independent Three.js optics and changes with sensor/aspect instead of fixed mm/FOV labels',()=>{
 for(const mm of[9,16,24,35,50,85,135]){const camera=new THREE.PerspectiveCamera(45,16/9);camera.filmGauge=36;camera.setFocalLength(mm);near([cameras.focalLengthToVerticalFov(mm)],[camera.fov]);}
 assert.ok(cameras.focalLengthToVerticalFov(135)<15);assert.ok(cameras.focalLengthToVerticalFov(9,9/16)>100);assert.notEqual(cameras.focalLengthToVerticalFov(9),122);assert.throws(()=>cameras.focalLengthToVerticalFov(0));
});

test('dolly zoom preserves projected reference-plane height through independent camera projection',()=>{
 const draft=apply(rigs.makeSceneAuthoringFixture(),{kind:'cameraRig',rig:{kind:'zolly',target:{objectId:'actor',partId:'chest'},focalLengthMm:35,startDistance:4,endDistance:10,height:0}});
 const heights=[];for(const time of[0,1,2.5,4,5]){const frame=core.evaluateAuthoringDraft(draft,time),shot=frame.plan.camera[0],camera=new THREE.PerspectiveCamera(shot.fov,16/9,.05,500);camera.position.set(...shot.position);camera.up.set(...shot.up);camera.lookAt(...shot.target);camera.updateMatrixWorld();const top=new THREE.Vector3(shot.target[0],shot.target[1]+.2,shot.target[2]).project(camera),bottom=new THREE.Vector3(shot.target[0],shot.target[1]-.2,shot.target[2]).project(camera);heights.push(top.y-bottom.y);}
 heights.forEach(height=>near([height],[heights[0]],1e-8));assert.match(cameras.describeSceneCamera(draft.cameraRig),/dolly zoom/);
});

test('body-mounted camera follows the selected control and overhead camera stays finite at a vertical look direction',()=>{
 let draft=rigs.makeSceneAuthoringFixture();const actor=draft.plan.objects.find(o=>o.id==='actor'),pose={...actor.keys[0],rotation:[.2,.4,.6]};draft=apply(draft,{kind:'pose',target:{objectId:'actor'},time:2,pose},{kind:'cameraRig',rig:{kind:'mounted',target:{objectId:'actor',partId:'chest'},offset:[0,.15,1.5],lookOffset:[0,.15,0],focalLengthMm:9}});
 const frame=core.evaluateAuthoringDraft(draft,2),shot=frame.plan.camera[0],m=transforms.initialMotionMatrix(frame.plan,'actor','chest'),matrix=new THREE.Matrix4().set(...m.slice(0,4),...m.slice(4,8),...m.slice(8,12),0,0,0,1);near(new THREE.Vector3(...shot.position).applyMatrix4(matrix.clone().invert()).toArray(),[0,.15,1.5]);
 draft=apply(draft,{kind:'cameraRig',rig:{kind:'overhead',target:{objectId:'actor'},height:7,heading:.4,focalLengthMm:35}});const overhead=core.evaluateAuthoringDraft(draft,2).plan.camera[0];assert.ok(overhead.up.every(Number.isFinite));assert.ok(Math.abs(overhead.up[1])<1e-8);const camera=new THREE.PerspectiveCamera(overhead.fov,16/9);camera.position.set(...overhead.position);camera.up.set(...overhead.up);camera.lookAt(...overhead.target);assert.ok(camera.quaternion.toArray().every(Number.isFinite));
});

test('small-model assistance captures connected state and rejects out-of-scope or stale edits',()=>{
 const draft=rigs.makeSceneAuthoringFixture(),context=assist.buildSceneAssistContext(draft,{instruction:'Refine the wrist while retaining the sword grip.',participants:['actor'],time:2});assert.equal(context.profile.tier,'luna');assert.equal(context.profile.reasoningEffort,'low');assert.ok(context.participants.some(item=>item.object.id==='sword'));assert.equal(assist.SCENE_JEV_ROLE,'bounded-assist-decisions-only');
 assert.throws(()=>assist.applySceneAssistProposal(draft,context.captured,['actor'],[{kind:'pose',target:{objectId:'mount'},time:2,pose:core.prototypeUnitPose()}]),/outside/);
 const newer=apply(draft,{kind:'camera',time:2,camera:{...draft.plan.camera[0],roll:.2}});assert.throws(()=>assist.applySceneAssistProposal(newer,context.captured,['actor'],[]),/Stale/);
 assert.throws(()=>assist.applySceneAssistProposal(draft,context.captured,['actor'],[{kind:'unlock',target:{objectId:'actor'},time:2}]),/pin permissions/);
});
