const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(file,mocks={}){const filename=path.join(root,file),mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=name=>Object.hasOwn(mocks,name)?mocks[name]:Module.prototype.require.call(mod,name);mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,filename);return mod.exports;}

test('concurrent game tagging shares one request and waits for saved index; retrying a failed write reuses paid metadata',async()=>{
 let generated=0,writes=0,fail=true,release;const pending=new Promise(resolve=>release=resolve);
 const {ensureGameSearchMetadata}=load('src/gameSearchMetadata.ts',{axios:{post:async(url,body)=>{generated++;assert.equal(body.gameKind,'hotspots');await pending;return {data:{title:'Car Chase',tags:['cars'],categories:['Games']}};},put:async(url,body)=>{writes++;assert.equal(body.postId,42);if(fail)throw Error('offline');}}});
 const input={postId:42,kind:'hotspots',context:'A car chase with branching choices'};
 const a=ensureGameSearchMetadata('api',input),b=ensureGameSearchMetadata('api',input);assert.equal(generated,1);assert.equal(writes,0);release();await Promise.all([assert.rejects(a),assert.rejects(b)]);
 assert.equal(writes,1);fail=false;await ensureGameSearchMetadata('api',input);await ensureGameSearchMetadata('api',input);assert.equal(generated,1);assert.equal(writes,2);
});

test('tagger failures remain retryable and another game is indexed separately',async()=>{
 let calls=0,writes=0;
 const {ensureGameSearchMetadata}=load('src/gameSearchMetadata.ts',{axios:{post:async()=>{if(++calls===1)throw Error('AI failed');return {data:{title:'Race',tags:['cars'],categories:['Games']}};},put:async()=>{writes++;}}});
 const input={postId:9,kind:'spatial',context:'Explore a race track'};await assert.rejects(ensureGameSearchMetadata('api',input));await ensureGameSearchMetadata('api',input);await ensureGameSearchMetadata('api',{...input,postId:10});assert.equal(calls,3);assert.equal(writes,2);
 await assert.rejects(ensureGameSearchMetadata('api',{...input,postId:0}));assert.equal(calls,3);
});

function callback(name){const file='src/Storybook.tsx',source=ts.createSourceFile(file,fs.readFileSync(path.join(root,file),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let node;function visit(item){if(ts.isVariableDeclaration(item)&&item.name.getText(source)===name)node=item.initializer.arguments[0];ts.forEachChild(item,visit);}visit(source);assert.ok(node);return ts.transpileModule('const callback='+node.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return callback;';}

test('Spatial indexes before completing Publish; failed indexing leaves publication retryable and the review open',async()=>{
 const events=[],document={entry:{stageId:'A',nodeId:'root'},stages:[{scene:{nodes:[],connections:[]}}]},refs={current:null};let fail=true;
 const values={PostId:42,CLIK_URL:'api',prompt:'Explore a car showroom',lastSpatialPublication:refs,hydrateSpatialExperience:async()=>document,buildCurrentSpatialExperience:()=>document,axios:{put:async()=>events.push('publish')},ProtectSavedMediaFromDeleteLater:()=>{},RemoveFromDeleteLater:()=>{},RemoveVideoFromDeleteLater:()=>{},ensureGameSearchMetadata:async()=>{events.push('index');if(fail)throw Error('offline');},setPublishLoader2Open:()=>events.push('close review'),clearSpatialPreviewVerification:()=>{},Close:()=>{},setminimisePrompt:()=>{},navigate:()=>events.push('navigate'),loggedUser:{id:7}};
 const run=Function(...Object.keys(values),callback('publishSpatialExperience'))(...Object.values(values));await assert.rejects(run(),/Retry Publish/);assert.deepEqual(events,['index']);fail=false;await run();assert.deepEqual(events,['index','index','publish','close review','navigate']);
});

test('Games feed UI maps to database mode 2 and resumes a query with its exact ranked cursor',()=>{
 const {searchFeedMode,searchFeedCursor}=load('src/feedSearch.ts');assert.deepEqual([1,2,3].map(searchFeedMode),[0,1,2]);assert.deepEqual(searchFeedCursor('cars',3,{id:99,score:1.5}),{query:'cars',mode:2,id:99,score:1.5});assert.equal(searchFeedCursor('cars',3,{id:99}),undefined);
});

test('search metadata writes lock the owned post and cannot recreate an index row for a deleted game',async()=>{
 const file='server/src/PostDatabase.ts',source=ts.createSourceFile(file,fs.readFileSync(path.join(root,file),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);let handler;
 function visit(item){if(ts.isVariableDeclaration(item)&&item.name.getText(source)==='InsertPostSearch')handler=item.initializer;ts.forEachChild(item,visit);}visit(source);assert.ok(handler);
 const code=ts.transpileModule('const handler='+handler.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return handler;';
 for(const [user,exists,expected] of [[7,true,200],[null,true,401],[7,false,404]]){
  const writes=[],queries=[];const run=Function('authenticatedUserId','withTransaction','createPostSearch',code)(()=>user,async work=>work(async(sql,args)=>{queries.push(sql);if(sql.startsWith('SELECT'))return exists?[{id:42}]:[];writes.push(args);return {affectedRows:1};}),'REPLACE INTO post_search');let status=200;
  await run({body:{postId:42,caption:'Car Race',tags:['cars'],categories:['Games']}},{status(code){status=code;return this;},json(){return this;}});assert.equal(status,expected);assert.equal(writes.length,expected===200?1:0);
  if(expected===200){assert.match(queries[0],/sender = \? FOR UPDATE/);assert.deepEqual(writes[0],[42,'Car Race','cars','Games']);}
 }
});
