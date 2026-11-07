const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {LivePlanAssembler,applyLiveOps,mergeContinuationRaw}=require('../server/src/liveSceneStream.ts');
const {validateMotionPlan}=require('../server/src/motionGuidePlan.ts');
const keys=(position=[0,0,0])=>[0,5].map(t=>({t,position:[...position],rotation:[0,0,0],scale:[1,1,1]}));
const object=(id,extra={})=>({id,shape:'box',color:'#6686b3',keys:keys(),...extra});
const plan=(objects=[object('ground')])=>({version:1,duration:5,background:'#edf5fc',camera:[0,5].map(t=>({t,position:[0,2,7],target:[0,.7,0],fov:45})),objects});

test('ordinary and Spatial scenes render actual completed objects while the response is still unfinished',()=>{
 for(const path of [[],['plan']]){
  const source=plan([object('ground'),object('actor',{parts:[object('torso'),object('head',{parentId:'torso'})]})]);
  const body=JSON.stringify(path.length?{plan:source,controlledObject:'actor'}:source);
  const assembler=new LivePlanAssembler(path,undefined,5);let visible,first=-1;
  for(let i=0;i<body.length;i++){const commit=assembler.push(body[i]);if(commit){visible=applyLiveOps(visible,commit.ops);if(first<0&&visible?.objects.length)first=i;}}
  assert.ok(first>0&&first<body.length-30,'content appeared before the whole JSON was complete');
  assert.equal(visible.objects.length,2);assert.equal(visible.objects[1].parts.length,2);validateMotionPlan(visible);
 }
});
test('completed articulated parts appear before the enclosing actor closes, with escaped braces and Unicode split safely',()=>{
 const source=plan([object('actor',{parts:[object('torso'),object('head',{parentId:'torso'})]})]);
 const full=JSON.stringify(source),cut=full.indexOf('},{"id":"head"')+1;
 const assembler=new LivePlanAssembler([],undefined,5);
 assembler.push(full.slice(0,cut));assert.equal(assembler.current?.objects[0]?.parts?.length,1);assert.equal(assembler.watcher.complete,false);
 for(const chunk of full.slice(cut))assembler.push(chunk);assert.equal(assembler.current.objects[0].parts.length,2);
});
test('continuation retains corrected and pinned objects while accepting additions and camera/lighting edits',()=>{
 const corrected=plan([object('table',{keys:keys([3,0,0])}),object('actor')]);
 const raw={...plan([object('table',{keys:keys([99,0,0])}),object('lamp')]),lightingRig:{preset:'golden',azimuthDeg:-55,elevationDeg:22,intensity:1.1}};
 const merged=mergeContinuationRaw(raw,corrected,[],['table'],undefined);
 assert.equal(merged.objects.find(o=>o.id==='table').keys[0].position[0],3);assert.ok(merged.objects.some(o=>o.id==='actor'));assert.ok(merged.objects.some(o=>o.id==='lamp'));
 const assembler=new LivePlanAssembler([],corrected,5,{pinned:['table']});let mirror=corrected;
 for(const char of JSON.stringify(raw)){const commit=assembler.push(char);if(commit)mirror=applyLiveOps(mirror,commit.ops);}
 assert.equal(mirror.lightingRig.preset,'golden');assert.equal(mirror.objects.find(o=>o.id==='table').keys[0].position[0],3);
});
test('attachments wait for their actual parent; invalid data never replaces the accepted scene',()=>{
 const source=plan([object('rider',{attachment:{objectId:'horse'}}),object('horse')]);
 const assembler=new LivePlanAssembler([],undefined,5);assembler.push(JSON.stringify(source));
 assert.equal(assembler.current.objects.length,2);validateMotionPlan(assembler.current);
 const invalid=new LivePlanAssembler([],plan(),5);invalid.push(JSON.stringify(plan([object('bad',{keys:keys([1000,0,0])})])));
 assert.equal(invalid.current.objects[0].id,'ground');assert.ok(invalid.rejected>0);
});
test('malformed/incomplete JSON retains the previous accepted geometry',()=>{
 const assembler=new LivePlanAssembler([],plan(),5);assembler.push('{"version":1,"duration":5,"objects":[{"id":"broken"');
 assert.equal(assembler.current.objects[0].id,'ground');assert.equal(assembler.watcher.complete,false);
});
test('scene rendering preserves unchanged root identities across construction and track-only edits',()=>{
 const {createMotionScene}=require('../src/motionScene.ts');const a=plan();const view=createMotionScene(a,16/9);const original=view.roots.get('ground');
 view.draw(0,plan([object('ground'),object('actor')]));assert.equal(view.roots.get('ground'),original);
 view.draw(0,plan([object('ground',{keys:keys([2,0,0])}),object('actor')]));assert.equal(view.roots.get('ground'),original);assert.equal(original.position.x,2);
 view.dispose();
});
