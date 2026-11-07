const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {recordSceneVideoPlanMedia,mergeSavedVideoPlanMedia}=require('../server/src/planVideoMedia.ts');
test('same video URL retains independent A/B scene bindings',()=>{
 const context={};for(const target of[{promptKey:'A:0',scene:1},{promptKey:'A:1',scene:2},{promptKey:'B:0:1',scene:1,bIndex:2}])recordSceneVideoPlanMedia(context,{usedReferenceVideoUrl:'https://example.com/shared.mp4',videoPrompt:target.promptKey},target);
 assert.equal(context.referenceVideos.length,3);assert.deepEqual(context.referenceVideos.map(x=>[x.scene,x.bIndex]),[[1,undefined],[2,undefined],[1,2]]);
 assert.equal(context.videoPrompts['B:0:1'],'B:0:1');
});
test('video save retains conditioning variants created after the last image save',()=>{
 const context={};const values={safetyMedia:[{url:'https://example.com/mesh.png',kind:'image',scene:99},{url:'https://example.com/depth.mp4',kind:'video'},{url:'javascript:bad',kind:'image'}],safetyAudioUrls:['https://example.com/audio.mp3']};
 for(let i=0;i<2;i++)recordSceneVideoPlanMedia(context,values,{promptKey:'B:1:2',scene:2,bIndex:3});
 assert.equal(context.safetyMedia.length,2);assert.deepEqual(context.safetyMedia.map(item=>[item.scene,item.bIndex]),[[2,3],[2,3]]);
 assert.deepEqual(context.safetyAudioUrls,['https://example.com/audio.mp3']);
 const {collectPostDeletionMedia}=require('../server/src/postDeletionMedia.ts');
 context.type='clik-plan-media';assert.equal(collectPostDeletionMedia({kontext:context},[],url=>typeof url==='string'&&url.startsWith('https://example.com/')?url:null).length,3);
});
test('switching/removing a reference updates only captured slot and retains previous asset ownership',()=>{
 const context={};const target={promptKey:'A:0',scene:1};
 recordSceneVideoPlanMedia(context,{usedReferenceVideoUrl:'https://example.com/old.mp4'},target);
 recordSceneVideoPlanMedia(context,{referenceUsageCaptured:true,usedReferenceVideoUrl:'',usedMotionVideoUrl:'https://example.com/motion.mp4'},target);
 assert.equal(context.referenceVideos.length,0);assert.equal(context.motionVideos[0].url,'https://example.com/motion.mp4');assert.equal(context.retainedMedia[0].url,'https://example.com/old.mp4');
 recordSceneVideoPlanMedia(context,{videoPrompt:'upscale'},target);assert.equal(context.motionVideos.length,1,'legacy/upscale save must not clear provenance');
});
test('image-only context refresh preserves used video bindings and saved prompt truth',()=>{
 const old={referenceVideos:[{url:'https://example.com/ref.mp4',scene:1},{url:'https://example.com/ref.mp4',scene:2}],motionVideos:[{url:'https://example.com/motion.mp4',scene:1}],videoPrompts:{'A:0':'saved video prompt'},safetyAudioUrls:['https://example.com/audio.mp3']};
 const merged=mergeSavedVideoPlanMedia(old,{referenceVideos:[],motionVideos:[],videoPrompts:{'A:0':'stale image prompt','A:1':'new scene'},characters:[{url:'new-image'}]});
 assert.equal(merged.referenceVideos.length,2);assert.equal(merged.motionVideos.length,1);assert.equal(merged.videoPrompts['A:0'],'saved video prompt');assert.equal(merged.videoPrompts['A:1'],'new scene');assert.equal(merged.characters[0].url,'new-image');
 assert.deepEqual(merged.safetyAudioUrls,['https://example.com/audio.mp3']);
});
