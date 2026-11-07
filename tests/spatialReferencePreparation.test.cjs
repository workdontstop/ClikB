const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Module=require('node:module');
function load(file,mocks={},cache=new Map()) {
  const filename=path.resolve(__dirname,'..',file);
  if(cache.has(filename))return cache.get(filename).exports;
  const mod=new Module(filename,module);cache.set(filename,mod);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
  mod.require=name=>Object.hasOwn(mocks,name)?mocks[name]:name.startsWith('.')?load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(filename),name+'.ts')),mocks,cache):Module.prototype.require.call(mod,name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
  return mod.exports;
}
const {SpatialReferencePreparation,spatialReferencePreparation}=load('src/spatialReferencePreparation.ts');
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
function sceneFixture() {
  const plan={version:1,duration:5,background:'#121212',objects:[{id:'ranger',shape:'box',color:'#ffffff',keys:[0,5].map(t=>({t,position:[0,.5,0],rotation:[0,0,0],scale:[1,1,1]}))}],camera:[0,5].map(t=>({t,position:[0,2,6],target:[0,.5,0],fov:45}))};
  return {sceneId:'scene',activeNodeId:'root',nodes:[{id:'root',frameUrl:'https://a/root.png'},{id:'end',frameUrl:'https://a/end.png'}],connections:[{id:'edge',sourceNodeId:'root',targetNodeId:'end',kind:'action'}],draftMovement:null,
    ledger:{version:2,world:{revision:'world',aspectRatio:'16:9',controlledObject:'ranger'},routes:{edge:{connectionId:'edge',forward:{id:'animation',plan,prompt:'Walk to the chair.',startAnchor:'https://a/root.png',endAnchor:'https://a/end.png'}}},states:{},jobs:[],epoch:0,generationStarted:false,view:'three'}};
}
function attach(scene,work) { Object.assign(scene.ledger.routes[work.routeId][work.direction],{referenceVideo:work.animation.referenceVideo,referencePlanKey:work.planKey,startAnchor:work.animation.startAnchor,endAnchor:work.animation.endAnchor,motionEvidence:work.animation.motionEvidence}); }

test('background export survives editor reopen and Finish joins it without duplicate work',async()=>{
  const scene=sceneFixture(),entered=deferred(),release=deferred(),owner={};let renders=0,saves=0;
  const adapter={read:()=>scene,prepare:async work=>{renders++;entered.resolve();await release.promise;work.animation.referenceVideo='https://a/export.mp4';},persist:async work=>{saves++;attach(scene,work);}};
  const queue=spatialReferencePreparation(owner,adapter),background=queue.start();await entered.promise;
  assert.equal(queue.status.pending,1);assert.equal(spatialReferencePreparation(owner,adapter),queue);
  const finish=queue.start('edge',true);release.resolve();await Promise.all([background,finish]);
  assert.equal(renders,1);assert.equal(saves,1);assert.equal(queue.status.pending,0);
  await queue.start();await queue.start('edge',true);assert.equal(renders,1);assert.equal(saves,1);
});

test('prompt edits keep prepared assets, but edits to an already exported plan prepare new assets',async()=>{
  const scene=sceneFixture();let renders=0;const observed=[];
  const queue=new SpatialReferencePreparation({read:()=>scene,prepare:async work=>{observed.push(work.animation.referenceVideo);renders++;work.animation.referenceVideo=`https://a/export-${renders}.mp4`;work.animation.endAnchor=`https://a/end-${renders}.png`;},persist:async work=>attach(scene,work)});
  await queue.start();const first=scene.ledger.routes.edge.forward.referencePlanKey;
  scene.ledger.routes.edge.forward.prompt='Turn at the chair and return.';await queue.start();assert.equal(renders,1);
  scene.ledger.routes.edge.forward.plan.objects[0].keys[1].position[0]=2;
  await queue.start();assert.equal(renders,2);assert.notEqual(scene.ledger.routes.edge.forward.referencePlanKey,first);
  assert.deepEqual(observed,[undefined,undefined]);assert.equal(scene.ledger.routes.edge.forward.prompt,'Turn at the chair and return.');
});

test('a prompt edit during export is preserved when only the completed assets attach',async()=>{
  const scene=sceneFixture(),entered=deferred(),release=deferred();
  const queue=new SpatialReferencePreparation({read:()=>scene,prepare:async work=>{entered.resolve();await release.promise;work.animation.referenceVideo='https://a/export.mp4';},persist:async work=>attach(scene,work)});
  const background=queue.start();await entered.promise;scene.ledger.routes.edge.forward.prompt='My exact edited instruction.';release.resolve();await background;
  assert.equal(scene.ledger.routes.edge.forward.prompt,'My exact edited instruction.');assert.equal(scene.ledger.routes.edge.forward.referenceVideo,'https://a/export.mp4');
});

test('a reset or plan edit discards an in-flight export rather than attaching it to changed work',async()=>{
  for(const change of ['reset','edit']) {
    const scene=sceneFixture(),entered=deferred(),release=deferred();let writes=0,prepares=0;
    const queue=new SpatialReferencePreparation({read:()=>scene,prepare:async work=>{prepares++;if(prepares===1){entered.resolve();await release.promise;}work.animation.referenceVideo=`https://a/export-${prepares}.mp4`;work.animation.endAnchor='https://a/end.png';},persist:async work=>{writes++;attach(scene,work);}});
    const background=queue.start();await entered.promise;
    if(change==='reset'){scene.connections=[];scene.ledger.routes={};}else scene.ledger.routes.edge.forward.plan.objects[0].keys[1].position[0]=3;
    const updated=queue.start();release.resolve();await Promise.all([background,updated]);
    assert.equal(writes,change==='reset'?0:1);if(change==='edit')assert.equal(scene.ledger.routes.edge.forward.referenceVideo,'https://a/export-2.mp4');
  }
});

test('retry after a persistence failure reuses the completed upload without rendering or uploading again',async()=>{
  const scene=sceneFixture();let renders=0,writes=0;
  const queue=new SpatialReferencePreparation({read:()=>scene,prepare:async work=>{renders++;work.animation.referenceVideo='https://a/export.mp4';},persist:async work=>{if(++writes===1)throw new Error('Interrupted save');attach(scene,work);}});
  await assert.rejects(queue.start(),/Interrupted save/);assert.equal(queue.status.pending,0);
  await assert.rejects(queue.start(),/Interrupted save/);assert.equal(renders,1);assert.equal(writes,1,'background must not retry on its own');
  await queue.start('edge',true);assert.equal(renders,1);assert.equal(writes,2);assert.equal(scene.ledger.routes.edge.forward.referenceVideo,'https://a/export.mp4');
});

test('reference completion and a foreground map save serialize without dropping assets or the new draft',async()=>{
  const entered=deferred(),release=deferred(),requests=[];let document={scene:sceneFixture(),revision:1};
  const client=load('src/spatialWorldClient.ts',{axios:{post:async(url,body)=>{
    requests.push(structuredClone(body));
    if(body.action==='save-reference'){entered.resolve();await release.promise;document=structuredClone(document);document.scene.ledger.routes.edge.forward.referenceVideo='https://a/background.mp4';document.revision++;}
    else if(body.action==='save'){assert.equal(body.revision,document.revision);document={scene:body.scene,revision:document.revision+1};}
    return {data:structuredClone(document)};
  }}});
  const session=client.spatialSession('/test',1,'scene');session.value=structuredClone(document);
  const background=client.spatialOperation(session,'save-reference',{});await entered.promise;
  const next=structuredClone(document.scene);next.ledger.draft={prompt:'New draft'};
  const saving=client.spatialOperation(session,'save',{scene:next,revision:1});release.resolve();await Promise.all([background,saving]);
  assert.equal(requests[1].revision,2);assert.equal(document.scene.ledger.routes.edge.forward.referenceVideo,'https://a/background.mp4');assert.equal(document.scene.ledger.draft.prompt,'New draft');
});

test('a draft already stale when queued cannot use the current reference hash to overwrite a real edit', async () => {
  const original = sceneFixture(), current = structuredClone(original);
  current.ledger.routes.edge.forward.prompt = 'Newer manual edit.';
  const client = load('src/spatialWorldClient.ts', { axios: { post: async (_url, body) => {
    assert.equal(body.revision, 1);
    assert.equal(body.referenceBaseKey, undefined, 'stale draft was given permission to rebase over the current document');
    throw new Error('This scene has newer saved changes.');
  } } });
  const session = client.spatialSession('/stale-test', 1, 'scene');
  session.value = { scene: current, revision: 2 };
  await assert.rejects(client.spatialOperation(session, 'save', { scene: original, revision: 1 }), /newer saved changes/);
  assert.equal(session.value.scene.ledger.routes.edge.forward.prompt, 'Newer manual edit.');
});

test('queued return preparation picks up the forward endpoint saved after the task was created', async () => {
  const scene = sceneFixture();
  scene.ledger.routes.edge.backward = { ...structuredClone(scene.ledger.routes.edge.forward), id: 'return', startAnchor: 'https://a/old-end.png' };
  const starts = [];
  const queue = new SpatialReferencePreparation({ read: () => scene, prepare: async work => {
    starts.push([work.direction, work.animation.startAnchor]);
    work.animation.referenceVideo = `https://a/${work.direction}.mp4`;
    work.animation.endAnchor = `https://a/${work.direction}-end.png`;
  }, persist: async work => {
    attach(scene, work);
    if (work.direction === 'forward') scene.ledger.routes.edge.backward.startAnchor = work.animation.endAnchor;
  } });
  await queue.start();
  assert.deepEqual(starts, [['forward', 'https://a/root.png'], ['backward', 'https://a/forward-end.png']]);
});
