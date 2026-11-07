const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), ts=require('typescript'), Module=require('node:module');
const root=path.resolve(__dirname,'..');
function load(file, mocks = {}, cache = new Map()) {
    const filename = path.resolve(root, file);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename, module); cache.set(filename, mod);
    mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
    mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.')
        ? load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')), mocks, cache)
        : Module.prototype.require.call(mod, name);
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
    return mod.exports;
}
const pose = t => ({ t, position: [t, .5, 0], rotation: [0, t / 2, 0], scale: [1, 1, 1] });
const plan = { version: 1, duration: 5, background: '#111111', objects: [{ id: 'girl', shape: 'box', color: '#ffffff', keys: [pose(0), pose(.5), pose(1)], parts: [{id:'head',shape:'sphere',color:'#ffffff',keys:[pose(0),pose(1)]}] }], camera: [0, 1].map(t => ({ t, position: [0, 2, 6], target: [t, .5, 0], fov: 45 })) };

function driveFixture() {
    const complete=load('src/spatialTiming.ts').finishMovementTiming(plan,1);
    return load('server/src/spatialWorld.ts').validateWorld({ version:2, model:'luna', plan:complete, controlledObject:'girl', controlMode:'character', walkable:[{min:[-.5,0,-.5],max:[.5,2,.5]}], obstacles:[{min:[-1,0,-1],max:[1,2,1]}], approved:true });
}

test('mount and vehicle forward retain the current node heading, without changing character steering',()=>{
 const {creationDriveStep}=load('src/spatialCreationDrive.ts');
 for(const mode of ['mounted','vehicle']) {
  const world=driveFixture();world.controlMode=mode;
  const state=structuredClone(world.initialState);state.objects.girl.transform.rotation[1]=1.4;
  const last=state.objects.girl.transform;
  const next=creationDriveStep(world,state,last,{x:0,y:1,active:true},.05);
  assert.deepEqual(next.rotation,last.rotation);assert.notDeepEqual(next.position,last.position);
 }
});
test('rotation stays in place, supports full turns and pitched travel without air/water classification',()=>{
 const {creationDriveStep}=load('src/spatialCreationDrive.ts');
 const world=driveFixture(), state=world.initialState; state.camera.position=[0,2,6];state.camera.target=[0,.5,0];
 let last=structuredClone(state.objects.girl.transform);last.rotation=[0,0,0];state.objects.girl.transform.rotation=[0,0,0];
 const first=structuredClone(last);
 const {Quaternion,Euler}=require('three');let angle=0;
 for(let i=0;i<150;i++){const before=new Quaternion().setFromEuler(new Euler(...last.rotation));last=creationDriveStep(world,state,last,{x:1,y:0,active:true},.05,{rotationMode:'horizontal'});angle+=before.angleTo(new Quaternion().setFromEuler(new Euler(...last.rotation)));}
 assert.deepEqual(last.position,first.position);assert.ok(angle>Math.PI*2);
 const up=creationDriveStep(world,state,first,{x:0,y:1,active:true},.05,{rotationMode:'vertical'});
 assert.deepEqual(up.position,first.position);assert.ok(up.rotation[0]>0);
 const moved=creationDriveStep(world,state,up,{x:0,y:1,active:true},.05,{heading:up.rotation});
 assert.ok(moved.position[1]>up.position[1]);assert.deepEqual(moved.rotation,up.rotation);
 const sideways={...first,rotation:[0,Math.PI/2,0]};
 const pitched=creationDriveStep(world,state,sideways,{x:0,y:1,active:true},.1,{rotationMode:'vertical'});
 const climbed=creationDriveStep(world,state,pitched,{x:0,y:1,active:true},.1,{heading:pitched.rotation});
 assert.ok(climbed.position[1]>pitched.position[1], 'pitch must climb even after a 90-degree horizontal turn');
});
test('processed movement preserves full recorded turn, endpoint and five-second duration',()=>{
 const world=driveFixture(), source=world.initialState, recorded=structuredClone(world.plan);
 recorded.objects[0].rotationMode='quaternion';
 const {creationDriveStep}=load('src/spatialCreationDrive.ts');
 let key=structuredClone(source.objects.girl.transform);const track=[{...key,t:0}];
 for(let i=1;i<=60;i++){key=creationDriveStep(world,source,key,{x:1,y:0,active:true},.05,{rotationMode:'horizontal'});track.push({...key,t:i*.05});}
 recorded.objects[0].keys=track;
 const timed=load('src/spatialTiming.ts').finishMovementTiming(recorded,3);
 assert.equal(timed.duration,5);assert.equal(timed.objects[0].keys.at(-1).t,5);
 const processed=load('server/src/spatialMotion.ts').prepareSpatialMotion(timed,world,source,timed,'movement');
 assert.deepEqual(processed.plan.objects[0].keys,timed.objects[0].keys);assert.equal(processed.plan.objects[0].rotationMode,'quaternion');
 const {Quaternion,Euler}=require('three');let total=0;for(let i=1;i<timed.objects[0].keys.length;i++)total+=new Quaternion().setFromEuler(new Euler(...timed.objects[0].keys[i-1].rotation)).angleTo(new Quaternion().setFromEuler(new Euler(...timed.objects[0].keys[i].rotation)));assert.ok(total>Math.PI*2,'retiming lost the complete turn');
});
test('automatic character prompts enforce turnaround while environments and names stay intact',async()=>{
 const source=ts.createSourceFile('GptApi.ts',fs.readFileSync(path.join(root,'server/src/GptApi.ts'),'utf8'),ts.ScriptTarget.Latest,true);let handler;
 const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='GptGenerateCastingPrompts')handler=node.initializer;ts.forEachChild(node,visit);};visit(source);
 const {CHARACTER_TURNAROUND}=load('server/src/castingNames.ts');
 const code=ts.transpileModule('const handler='+handler.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const call=new Function('generateGPT4oPrompt5B','CHARACTER_TURNAROUND','cleanPromptLiterals','withoutVideoCreationContext',code+';return handler;')(async()=>JSON.stringify([{name:'wrong',type:'character',imagePrompt:'Adventurer in armor, painterly art style'},{name:'wrong',type:'environment',imagePrompt:'Garden at dawn, painterly art style'}]),CHARACTER_TURNAROUND,require('./promptTestBindings.cjs').cleanPromptLiterals,load('server/src/videoCreationContext.ts').withoutVideoCreationContext);
 let result;await call({body:{characters:[{name:'Adventurer'}],environments:[{name:'Garden'}],prompts:[]}}, {send:value=>result=value,status:()=>{throw new Error('Unexpected generation error');}});
 assert.equal(result.prompts[0].name,'Adventurer');assert.match(result.prompts[0].imagePrompt,/360-degree/);assert.match(result.prompts[0].imagePrompt,/front, left profile, back and right profile/);assert.match(result.prompts[0].imagePrompt,/pure white background/);
 assert.match(result.prompts[1].imagePrompt,/^Clean unpopulated location reference plate\./);assert.ok(result.prompts[1].imagePrompt.endsWith('Garden at dawn, painterly art style'));
});
