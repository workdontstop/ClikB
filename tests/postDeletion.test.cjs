const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Module=require('node:module');
const root=path.resolve(__dirname,'..');
function load(file,mocks={},cache=new Map()) {
 const filename=path.resolve(root,file);if(cache.has(filename))return cache.get(filename).exports;
 const mod=new Module(filename,module);cache.set(filename,mod);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
 mod.require=name=>Object.hasOwn(mocks,name)?mocks[name]:name.startsWith('.')?load(path.relative(root,path.resolve(path.dirname(filename),name+'.ts')),mocks,cache):Module.prototype.require.call(mod,name);
 mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);return mod.exports;
}
function declaration(file,name) {
 const source=fs.readFileSync(path.join(root,file),'utf8'),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let result;
 const visit=node=>{if((ts.isFunctionDeclaration(node)||ts.isVariableDeclaration(node))&&node.name?.getText(ast)===name)result=node;ts.forEachChild(node,visit);};visit(ast);assert.ok(result,name+' is missing');return result;
}
const normalizeSource=declaration('server/src/S3Routes.ts','postMediaStorageUrl').getText().replace('export ','');
const normalize=Function('BUCKET_NAME',ts.transpileModule(normalizeSource,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+';return postMediaStorageUrl;')('app-bucket');
const url=key=>'https://app-bucket.s3.eu-west-2.amazonaws.com/'+key;
const {collectPostDeletionMedia}=load('server/src/postDeletionMedia.ts');

test('safety/reference/motion/audio JSON assets remain discoverable for post deletion',()=>{
 const plan={type:'clik-plan-media',referenceVideos:[{url:url('uploaded-ref.mp4')}],motionVideos:[{url:url('motion-guide.mp4')}],
  safetyMedia:[{url:url('mesh.png')},{url:url('depth.mp4')},{url:url('world.png'),deleteOnPostDelete:false}],
  safetyAudioUrls:[url('reference-audio.mp3'),'https://external.example.com/audio.mp3']};
 assert.deepEqual(collectPostDeletionMedia({kontext:JSON.stringify(plan)},[],normalize).sort(),
  ['uploaded-ref.mp4','motion-guide.mp4','mesh.png','depth.mp4','reference-audio.mp3'].map(key=>'s3://app-bucket/'+key).sort());
});
test('post cleanup recognizes owned regional/global/path/URI objects, strips signatures, and rejects external storage',()=>{
 for(const source of [url('clip.mp4')+'?signature=expired','https://app-bucket.s3.amazonaws.com/clip.mp4','https://s3.eu-west-2.amazonaws.com/app-bucket/clip.mp4','s3://app-bucket/clip.mp4'])assert.equal(normalize(source),'s3://app-bucket/clip.mp4');
 assert.equal(normalize(url('end%20frame.png')),'s3://app-bucket/end frame.png');
 for(const source of ['https://provider.test/result.mp4','https://someone-else.s3.amazonaws.com/clip.mp4','s3://other/clip.mp4','https://app-bucket.s3.eu-west-2.amazonaws.com.evil.test/clip.mp4','data:image/png,123','blob:123','three:route',null])assert.equal(normalize(source),null);
});
const scene=()=>({nodes:[{frameUrl:url('end.png')}],connections:[{forward:{videoUrl:url('forward.mp4')},backward:{videoUrl:url('return.mp4')},movement:{guidance:{sourceFrameUrl:url('end.png'),movementReferenceImageUrl:url('guide.png')}}}],ledger:{world:{sourceImage:url('root.png')},routes:{route:{forward:{referenceVideo:url('reference.mp4'),startAnchor:url('anchor.png')}}},jobs:[{status:'ready',output:url('forward.mp4'),actualEndFrame:url('end.png'),completionAssets:{videoUrl:url('completion.mp4'),endFrame:url('completion.png')},previousResult:{output:url('old.mp4'),actualEndFrame:url('old.png')},resultHistory:[{output:url('history.mp4')}],upscale:{output:url('hd.mp4'),original:url('forward.mp4')}}],actionImageEdits:{node:{original:url('end.png'),output:url('edit.png')}},nodeContexts:{node:{frameUrl:url('state.png')}}}});
test('published/draft cleanup covers scene assets and generation history once, preserving shared world assets',()=>{
 const post={x1:url('root.png'),xh1B:url('hd.png'),xv1:url('normal.mp4'),xa1B:url('audio.mp3'),nobgmvideo:url('nobgm.mp4'),thumb1:url('thumb.png'),spatial_experience_json:JSON.stringify({stages:[{scene:scene()}]}),kontext:JSON.stringify({type:'clik-plan-media',cover:{url:url('shared.png'),deleteOnPostDelete:false},characters:[{url:url('character.png')}],inputCharacters:[{url:url('root.png'),source:'world'}],bshots:[{url:url('b.mp4')}]}),caption:'https://app-bucket.s3.amazonaws.com/do-not-delete.png'};
 const draft=scene();draft.nodes.push({frameUrl:url('draft-only.png')},{frameUrl:url('shared.png')},{frameUrl:'https://provider.test/frame.png'});
 const result=collectPostDeletionMedia(post,[{document:JSON.stringify({scene:draft})}],normalize);
 const keys=result.map(item=>item.replace('s3://app-bucket/','')).sort();
 assert.deepEqual(keys,['anchor.png','audio.mp3','b.mp4','character.png','completion.mp4','completion.png','draft-only.png','edit.png','end.png','forward.mp4','guide.png','hd.mp4','hd.png','history.mp4','nobgm.mp4','normal.mp4','old.mp4','old.png','reference.mp4','return.mp4','state.png','thumb.png'].sort());
});
test('old malformed/metadata-only documents still permit cleanup of known post media',()=>{
 for(const doc of ['bad-json',{actionLabels:{A:{act:'Strike'}}},null])assert.deepEqual(collectPostDeletionMedia({item1:url('root.png'),spatial_experience_json:doc},[{document:'bad-draft'}],normalize),['s3://app-bucket/root.png']);
});
test('legacy interaction video/audio and saved world-state assets are included in cleanup',()=>{
 const fields=['mainint','int1','int2','item2','vid1backup','vid2backup','mainaud','sub1aud','sub2aud','interaction_audio_main','interaction_audio_left','interaction_audio_right'];
 const post=Object.fromEntries(fields.map(name=>[name,url(name+'.mp4')]));post.spatial_experience_json={stages:[{scene:{ledger:{states:{node:{objects:{subject:{assets:[url('prop.png')]}}}}}}}]};
 const result=collectPostDeletionMedia(post,[],normalize);assert.equal(result.length,fields.length+1);assert.ok(result.includes('s3://app-bucket/prop.png'));
});
function harness({user=1,owner=true,missingDraftTable=false,failMedia=false,failTable=false,job=false,postPatch={}}={}) {
 let post={id:42,sender:1,item1:url('root.png'),spatial_experience_json:JSON.stringify({actionLabels:{A:{act:'Strike'}}})},drafts=[{document:JSON.stringify({scene:scene()})}],search=true,emotions=true,mediaFailure=failMedia;
 Object.assign(post,postPatch);
 if(job){const data=JSON.parse(drafts[0].document);data.scene.ledger.jobs.push({status:'generating',provider:'replicate',providerJobId:'in-flight'});drafts[0].document=JSON.stringify(data);}
 const queries=[],deleted=[],cancelled=[];
 const handler=load('server/src/PostDeletion.ts',{'./requestAuth':{authenticatedUserId:()=>user},'./S3Routes':{postMediaStorageUrl:normalize,deleteCloudImageUrl:async value=>{deleted.push(value);if(mediaFailure&&value.endsWith('reference.mp4'))throw Error('storage offline');}},'./SpatialVideoProvider':{cancelSpatialVideo:async job=>cancelled.push(job.providerJobId)},'./execQuery':{withTransaction:async work=>{
  const before=structuredClone({post,drafts,search,emotions});try{return await work(async(sql,args)=>{
   queries.push({sql,args});if(sql.includes('spatial_world_drafts')&&missingDraftTable)throw Object.assign(Error('legacy'),{code:'ER_NO_SUCH_TABLE'});
   if(sql.startsWith('SELECT * FROM posts'))return owner&&post?[post]:[];
   if(sql.startsWith('SELECT document')){if(failTable)throw Object.assign(Error('permission'),{code:'ER_TABLEACCESS_DENIED_ERROR'});return drafts;}
   // This legacy fixture has no normal creation drafts, remix jobs or library claims.
   if(sql.startsWith('SELECT'))return [];
   if(sql.startsWith('DELETE FROM spatial_world_drafts'))drafts=[];
   if(sql.startsWith('DELETE FROM post_search'))search=false;
   if(sql.startsWith('DELETE FROM emotions'))emotions=false;
   if(sql.startsWith('DELETE FROM posts'))post=null;
   return {affectedRows:1};
  });}catch(error){({post,drafts,search,emotions}=before);throw error;}
 }}}).deletePost;
 const call=async(postId=42)=>{let code=200,body;await handler({body:{postId}},{status(value){code=value;return this;},json(value){body=value;return this;}});return{code,body};};
 return{call,queries,deleted,cancelled,state:()=>({post,drafts,search,emotions}),retry:()=>{mediaFailure=false;}};
}
test('owned deletion cleans storage/drafts/search/reactions before the post and cancels active generation',async()=>{
 const h=harness({job:true});assert.equal((await h.call()).code,200);assert.deepEqual(h.state(),{post:null,drafts:[],search:false,emotions:false});assert.deepEqual(h.cancelled,['in-flight']);
 assert.match(h.queries[0].sql,/sender=\? FOR UPDATE/);assert.deepEqual(h.queries[0].args,[42,1]);assert.ok(h.deleted.includes('s3://app-bucket/reference.mp4'));assert.match(h.queries.at(-1).sql,/DELETE FROM posts/);
 assert.ok(h.queries.some(q=>q.sql==='DELETE FROM comments WHERE post=?'&&q.args[0]===42));
});
test('missing authentication, foreign ownership, and invalid IDs cannot trigger cleanup',async()=>{
 for(const [options,id,status] of [[{user:null},42,401],[{owner:false},42,404],[{},0,400],[{},'bad',400]]){const h=harness(options);assert.equal((await h.call(id)).code,status);assert.deepEqual(h.deleted,[]);assert.ok(h.state().post);}
});
test('storage failure retains all database receipts and succeeds on an idempotent retry',async()=>{
 const h=harness({failMedia:true});assert.equal((await h.call()).code,500);assert.ok(h.state().post);assert.equal(h.state().drafts.length,1);assert.equal(h.state().search,true);assert.equal(h.queries.some(q=>q.sql.startsWith('DELETE')),false);
 h.retry();assert.equal((await h.call()).code,200);assert.equal(h.state().post,null);assert.equal(h.deleted.filter(value=>value.endsWith('end.png')).length,2);
});
test('legacy installations tolerate an absent draft table while real database errors prevent deletion',async()=>{
 const old=harness({missingDraftTable:true});assert.equal((await old.call()).code,200);assert.equal(old.state().post,null);
 const failed=harness({failTable:true});assert.equal((await failed.call()).code,500);assert.deepEqual(failed.deleted,[]);assert.ok(failed.state().post);
});
test('cinema/short finals and nested hotspot branches, autoplay, audio and backups use the complete server cleanup',async()=>{
 const cinema={videoUrl:url('cinema-final.mp4'),xv1:url('cinema-scene.mp4'),xh1:url('cinema-hd.png'),captionAudio:url('cinema-narration.mp3')};
 const shorts={videoUrl:url('short-final.mp4'),xv1B:url('short-b.mp4'),xa1B:url('short-audio.mp3')};
 const tree={mainSrc:url('hotspot-main.mp4'),subs:[url('hotspot-left.mp4'),url('hotspot-right.mp4')],audio:{main:[[url('hotspot-extra-audio.mp3')]]},children:{left:{mainSrc:url('hotspot-child.mp4'),autoPlaySrc:url('hotspot-victory.mp4'),subs:[url('hotspot-hidden-branch.mp4')],audio:{top:[url('hotspot-child-audio.mp3')]}}}};
 const hotspots={main:url('hotspot-main.mp4'),vid1backup:url('hotspot-backup.mp4'),interaction_audio_main:url('hotspot-root-audio.mp3'),touch_config_json:JSON.stringify({tree})};
 for(const postPatch of [cinema,shorts,hotspots]){
  const h=harness({postPatch});assert.equal((await h.call()).code,200);assert.equal(h.state().post,null);assert.equal(h.state().search,false);
  const expected=Object.values(postPatch).filter(value=>value.startsWith('https://')).map(normalize);
  if(postPatch===hotspots)expected.push(...['hotspot-left.mp4','hotspot-right.mp4','hotspot-extra-audio.mp3','hotspot-child.mp4','hotspot-victory.mp4','hotspot-hidden-branch.mp4','hotspot-child-audio.mp3'].map(key=>normalize(url(key))));
  for(const value of expected)assert.ok(h.deleted.includes(value),'missed '+value);
  assert.equal(h.deleted.filter(value=>value.endsWith('hotspot-main.mp4')).length,postPatch===hotspots?1:0);
 }
});
test('fullscreen deletion sends one server cleanup request, blocks duplicate clicks, and keeps a failed attempt retryable',async()=>{
 const arrow=declaration('src/FullScreenStories.tsx','startDeleteDB').initializer.getText();const js=ts.transpileModule('const run='+arrow+';', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 let calls=0,resolve,deleted=false,retry=false,loading=false,dispatches=[];const ref={current:false};
 const run=Function('deletingPostRef','setDeleteRetry','setLoadingDatabase2','axios','CLIK_URL','dispatch','clearPostActionLabels','setDeleted','evictFeedPost','evictCachedDeckPost',js+';return run;')(ref,v=>retry=v,v=>loading=v,{post:async(address,body)=>{calls++;assert.equal(address,'http://fixture/delPost');assert.deepEqual(body,{postId:42});await new Promise(r=>resolve=r);}},'http://fixture',value=>dispatches.push(value),id=>({clear:id}),v=>deleted=v,()=>{},()=>{});
 const pending=run(42);await run(42);assert.equal(calls,1);assert.equal(loading,true);resolve();await pending;assert.equal(deleted,true);assert.equal(retry,false);assert.equal(loading,false);assert.deepEqual(dispatches,[{clear:42}]);
 const fail=Function('deletingPostRef','setDeleteRetry','setLoadingDatabase2','axios','CLIK_URL','dispatch','clearPostActionLabels','setDeleted','evictFeedPost','evictCachedDeckPost',js+';return run;')(ref,v=>retry=v,v=>loading=v,{post:async()=>{throw Error('offline');}},'',()=>assert.fail('failure cleared data'),()=>{},v=>deleted=v,()=>{},()=>{});
 deleted=false;await fail(42);assert.equal(retry,true);assert.equal(deleted,false);assert.equal(loading,false);assert.equal(ref.current,false);
 const full=fs.readFileSync(path.join(root,'src/FullScreenStories.tsx'),'utf8');assert.equal((full.match(/onClick=\{\(\) => void startDeleteDB\(feeds\[index\]\.id\)\}/g)||[]).length,2);assert.doesNotMatch(full,/deleteFeedImages|deletePlanKontextMedia|\/del-image/);
});
test('successful deletion clears only that post’s Redux label data and author drafts',()=>{
 const {default:reducer,draftActionLabel,receiveActionLabels,clearPostActionLabels}=load('src/spatialLabelsSlice.ts');let state=reducer(undefined,{type:'init'});
 for(const postId of [42,43]){state=reducer(state,receiveActionLabels({postId,labels:{A:{act:'Strike'}},revision:3}));state=reducer(state,draftActionLabel({owner:'1:'+postId,patch:{stageId:'A',connectionId:'act',label:'Sit'}}));}
 state=reducer(state,clearPostActionLabels(42));assert.equal(state.saved[42],undefined);assert.equal(state.revisions[42],undefined);assert.equal(state.drafts['1:42'],undefined);assert.equal(state.saved[43].A.act,'Strike');assert.ok(state.drafts['1:43']);
});
