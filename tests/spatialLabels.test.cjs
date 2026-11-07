const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Module=require('node:module');
function load(file,mocks={},cache=new Map()) {
 const filename=path.resolve(__dirname,'..',file);if(cache.has(filename))return cache.get(filename).exports;
 const mod=new Module(filename,module);cache.set(filename,mod);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
 mod.require=name=>Object.hasOwn(mocks,name)?mocks[name]:name.startsWith('.')?load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(filename),name+'.ts')),mocks,cache):Module.prototype.require.call(mod,name);
 mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);return mod.exports;
}
const metadata=load('server/src/spatialLabelMetadata.ts');
const fixture=()=>({version:1,entry:{stageId:'A',nodeId:'root'},stages:[{id:'A',scene:{nodes:[{id:'root',frameUrl:'frame.png'},{id:'result',frameUrl:'result.png'}],connections:[{id:'act',kind:'action',sourceNodeId:'root',targetNodeId:'result',forward:{videoUrl:'video.mp4'},movement:{samples:[]}}, {id:'move',kind:'movement'}],ledger:{jobs:[{status:'ready',output:'video.mp4'}]}}}]});
const patch=(label='Strike',stageId='A',connectionId='act')=>({stageId,connectionId,label});
test('labels normalize short phrases, reject duplicates, long labels and prototype keys',()=>{
 assert.deepEqual(metadata.validateActionLabelPatches([patch('  Pick\nup  ')]),[patch('Pick up')]);
 assert.deepEqual(metadata.validateActionLabelPatches([patch('   ')]),[patch('')]);
 for(const patches of [[patch('x'.repeat(33))],[patch(),patch()],[],[patch('Strike','__proto__')],[{...patch(),label:42}]])assert.throws(()=>metadata.validateActionLabelPatches(patches));
 assert.equal(metadata.validateActionLabelPatches([patch('😀'.repeat(32))])[0].label.length,64);
 assert.notEqual(metadata.actionLabelKey('a:b','c'),metadata.actionLabelKey('a','b:c'));
});
test('saving and removing a label leave graph, media and authoring receipts untouched',()=>{
 const original=fixture(),before=structuredClone(original),updated=metadata.patchActionLabels(original,[patch()]);
 assert.deepEqual(original,before);assert.equal(updated.stages,original.stages);assert.deepEqual(updated.actionLabels,{A:{act:'Strike'}});
 assert.deepEqual(metadata.patchActionLabels(updated,[patch('')]).actionLabels,{});
 assert.throws(()=>metadata.patchActionLabels(updated,[patch('Sit','A','move')]));
 assert.throws(()=>metadata.patchActionLabels(updated,[patch('Sit'),patch('Go','missing')]));
 assert.deepEqual(updated.actionLabels,{A:{act:'Strike'}},'invalid batch mutated stored metadata');
});
test('preview labels persist before publication without publishing a graph, then survive editor republishing',()=>{
 const saved=metadata.patchActionLabels({},[patch()],true);assert.equal(saved.version,undefined);assert.equal(saved.stages,undefined);
 const published=metadata.retainActionLabels(fixture(),saved);assert.deepEqual(published.actionLabels,{A:{act:'Strike'}});
 assert.deepEqual(metadata.retainActionLabels(fixture(),metadata.patchActionLabels(published,[patch('')])).actionLabels,{});
 const removed=fixture();removed.stages[0].scene.connections=[];assert.deepEqual(metadata.retainActionLabels(removed,published).actionLabels,{});
});
function handlerFixture({userId=1,owned=true,document=fixture(),fail=false,nativeJson=false}={}) {
 let stored=JSON.stringify(document),writes=0,queries=[];
 const handler=load('server/src/SpatialActionLabels.ts',{'./requestAuth':{authenticatedUserId:()=>userId},'./execQuery':{withTransaction:async work=>{
  const before=stored;try{return await work(async(sql,args)=>{queries.push({sql,args});if(fail)throw Error('offline');if(sql.startsWith('SELECT'))return owned?[{spatial_experience_json:nativeJson?JSON.parse(stored):stored}]:[];writes++;stored=args[0];return{affectedRows:1};});}catch(error){stored=before;throw error;}
 }}}).spatialActionLabels;
 const call=async(body={postId:42,labels:[patch()]},method='PUT')=>{let code=200,result;await handler({method,query:{postId:42},body},{status(value){code=value;return this;},json(value){result=value;return this;}});return{code,result};};
 return {call,stored:()=>JSON.parse(stored),writes:()=>writes,queries};
}
test('label route uses authenticated ownership and rejects invalid requests before writing',async()=>{
 for(const [options,body,code] of [[{userId:null},{postId:42,labels:[patch()]},401],[{owned:false},{postId:42,userId:1,labels:[patch()]},404],[{}, {postId:0,labels:[patch()]},400],[{}, {postId:42,labels:[patch('x'.repeat(33))]},400]]){
  const h=handlerFixture(options);assert.equal((await h.call(body)).code,code);assert.equal(h.writes(),0);
 }
});
test('label route atomically updates only metadata and rejects stale/nonaction targets',async()=>{
 const h=handlerFixture(),before=fixture();assert.equal((await h.call()).code,200);assert.equal(h.writes(),1);
 assert.deepEqual(h.stored().stages,before.stages);assert.deepEqual(h.stored().entry,before.entry);
 assert.deepEqual(h.queries[0].args,[42,1]);assert.match(h.queries[0].sql,/FOR UPDATE/);
 assert.doesNotMatch(h.queries[1].sql,/interaction_format|video|image|draft/i);
 assert.equal((await h.call({postId:42,labels:[patch('Sit'),patch('Go','A','move')]})).code,409);
 assert.equal(h.writes(),1);assert.deepEqual(h.stored().actionLabels,{A:{act:'Strike'}});
});
test('preview metadata read/save supports unpublished posts and reports database failure',async()=>{
 const h=handlerFixture({document:{}});assert.equal((await h.call({postId:42,preview:true,labels:[patch()]})).code,200);
 assert.deepEqual((await h.call(undefined,'GET')).result,{actionLabels:{A:{act:'Strike'}},actionLabelsRevision:1});assert.equal(h.writes(),1);
 assert.equal((await handlerFixture({fail:true}).call()).code,500);
});
test('MySQL native JSON objects support label reads, updates and clearing without double parsing',async()=>{
 const h=handlerFixture({nativeJson:true});assert.equal((await h.call()).code,200);assert.deepEqual(h.stored().actionLabels,{A:{act:'Strike'}});
 assert.deepEqual((await h.call(undefined,'GET')).result,{actionLabels:{A:{act:'Strike'}},actionLabelsRevision:1});
 assert.equal((await h.call({postId:42,labels:[patch('')]})).code,200);assert.deepEqual(h.stored().actionLabels,{});assert.equal(h.stored().actionLabelsRevision,2);
});
test('Redux isolates drafts by author/post and a late save cannot erase a newer edit',()=>{
 const {default:reducer,draftActionLabel,commitActionLabels}=load('src/spatialLabelsSlice.ts');
 let state=reducer(undefined,{type:'init'});
 state=reducer(state,draftActionLabel({owner:'1:42',patch:patch('Strike')}));state=reducer(state,draftActionLabel({owner:'2:42',patch:patch('Sit')}));
 state=reducer(state,draftActionLabel({owner:'1:42',patch:patch('Pick up')}));
 state=reducer(state,commitActionLabels({owner:'1:42',postId:42,patches:[patch('Strike')],labels:{A:{act:'Strike'}}}));
 assert.equal(state.drafts['1:42'][metadata.actionLabelKey('A','act')].label,'Pick up');assert.equal(state.drafts['2:42'][metadata.actionLabelKey('A','act')].label,'Sit');
 state=reducer(state,commitActionLabels({owner:'1:42',postId:42,patches:[patch('Pick up')],labels:{A:{act:'Pick up'}}}));
 assert.deepEqual(state.drafts['1:42'],{});assert.deepEqual(state.saved[42],{A:{act:'Pick up'}});
});
test('a delayed read cannot replace newer labels and revision survives republishing',()=>{
 const {default:reducer,receiveActionLabels}=load('src/spatialLabelsSlice.ts');
 let state=reducer(undefined,receiveActionLabels({postId:42,labels:{A:{act:'Sit'}},revision:2}));
 state=reducer(state,receiveActionLabels({postId:42,labels:{A:{act:'Strike'}},revision:1}));
 assert.deepEqual(state.saved[42],{A:{act:'Sit'}});assert.equal(state.revisions[42],2);
 const document=metadata.retainActionLabels(fixture(),{actionLabels:state.saved[42],actionLabelsRevision:2});assert.equal(document.actionLabelsRevision,2);
 assert.equal(metadata.patchActionLabels(document,[patch('')]).actionLabelsRevision,3);
});
test('the actual publish handler retains post-production labels under the same ownership lock',async()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../server/src/PostDatabase.ts'),'utf8'),ast=ts.createSourceFile('PostDatabase.ts',source,ts.ScriptTarget.ES2022,true);
 const statement=ast.statements.find(s=>ts.isVariableStatement(s)&&s.declarationList.declarations.some(d=>d.name.getText(ast)==='SaveSpatialExperience'));
 const code=ts.transpileModule(statement.getText(ast),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};
 let saved,queries=[];
 new Function('exports','authenticatedUserId','withTransaction','retainActionLabels',code)(exports,()=>1,async work=>work(async(sql,args)=>{
  queries.push({sql,args});if(sql.startsWith('SELECT'))return[{spatial_experience_json:{actionLabels:{A:{act:'Pick up'}}}}];saved=JSON.parse(args[1]);return{affectedRows:1};
 }),metadata.retainActionLabels);
 let status=200;const res={status(code){status=code;return this;},send(){return this;}};
 await exports.SaveSpatialExperience({body:{postId:42,spatialExperienceJson:JSON.stringify(fixture())}},res);
 assert.equal(status,200);assert.deepEqual(saved.actionLabels,{A:{act:'Pick up'}});assert.deepEqual(saved.stages,fixture().stages);
 assert.match(queries[0].sql,/FOR UPDATE/);assert.deepEqual(queries[0].args,[42,1]);
});
