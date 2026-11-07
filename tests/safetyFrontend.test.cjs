const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const safety=require('../src/safetyConditioning.ts');
const plan=require('../src/planKontextMedia.ts');
const scene='https://assets.example/scene.png',sheet='https://assets.example/clean-sheet.png',mesh='https://assets.example/mesh.png';
test('scene safety is invalidated by a replaced frame or global character sheet, without replacing originals',()=>{
 const refs=[{name:'Hero',imageUrl:sheet,vipSourceImageUrl:'https://assets.example/input-photo.png'}];
 const set={active:true,sourceSignature:safety.computeSafetyImageSignature(scene,refs),originalSceneImageUrl:scene,safetySceneImageUrl:mesh,originalCharacterUrls:{hero:sheet},safetyCharacterUrls:{hero:'https://assets.example/mesh-sheet.png'}};
 assert.equal(safety.isCurrentSafetyImageSet(set,mesh,refs),true);
 assert.equal(safety.isCurrentSafetyImageSet(set,'https://assets.example/new.png',refs),false);
 assert.equal(safety.isCurrentSafetyImageSet(set,mesh,[{...refs[0],imageUrl:'https://assets.example/new-sheet.png'}]),false);
 assert.equal(safety.safetySceneSourceUrl(mesh,set),scene);
 assert.equal(safety.safetySceneSourceUrl('https://assets.example/new.png',set),'https://assets.example/new.png');
 const payload=plan.buildPlanKontextPayload({referenceImages:refs});
 assert.equal(payload.characters[0].url,sheet);
 assert.equal(refs[0].imageUrl,sheet);
});
test('saved global character list resolves an explicitly conditioned view back to its clean sheet',()=>{
 const payload=plan.buildPlanKontextPayload({referenceImages:[{name:'Hero',imageUrl:mesh,originalImageUrl:sheet}],vipCharacters:[{name:'VIP',imageUrl:sheet}]});
 assert.equal(payload.characters[0].url,sheet);assert.equal(payload.inputCharacters[0].url,sheet);
});
test('used motion guide videos use the actual nested format and preserve repeated A/B bindings',()=>{
 const video='https://assets.example/motion.mp4',guide={motion:{videoUrl:video}};
 const payload=plan.buildPlanKontextPayload({autoDrawGuideData:[guide,guide],bShotAutoDrawGuideData:[[guide]],referenceVideoUrls:[video,video],bShotReferenceVideoUrls:[[video]],textVideo:['A one','A two'],bShotTextVideo:[['B one']]});
 assert.equal(payload.motionVideos.length,3);assert.equal(payload.referenceVideos.length,3);
 assert.deepEqual(payload.motionVideos.map(item=>[item.scene,item.bIndex]),[[1,undefined],[2,undefined],[1,1]]);
 assert.equal(payload.videoPrompts['A:1'],'A two');assert.equal(payload.videoPrompts['B:0:0'],'B one');
});
test('media retention returns unique image/video/audio URLs, including full source and remuxed take',()=>{
 const result=safety.collectAllSafetyUrls({one:{originalSceneImageUrl:scene,safetySceneImageUrl:mesh,safetyCharacterUrls:{hero:mesh}}},{one:{sourceVideoUrl:'https://assets.example/ref.mp4',depthVideoUrl:'https://assets.example/depth.mp4',extractedAudioUrl:'https://assets.example/ref.mp3',remuxedOutputMap:{take:'https://assets.example/remux.mp4'}}});
 assert.deepEqual(result.images,[mesh,scene]);assert.equal(result.videos.length,3);assert.deepEqual(result.audios,['https://assets.example/ref.mp3']);
 const payload=plan.buildPlanKontextPayload({safetyAudioUrls:result.audios,safetyMediaUrls:safety.safetyPlanMediaEntries({}, {'B:2:0':{depthVideoUrl:'https://assets.example/depth.mp4'}})});
 assert.deepEqual(payload.safetyAudioUrls,result.audios);
 assert.equal(payload.safetyMedia[0].scene,3);assert.equal(payload.safetyMedia[0].bIndex,1);
});
