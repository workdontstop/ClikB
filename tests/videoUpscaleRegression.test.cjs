const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
const specCode=ts.transpileModule(fs.readFileSync(path.join(root,'server/src/videoUpscaleSpec.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const specModule={exports:{}};new Function('module','exports',specCode)(specModule,specModule.exports);
const spec=specModule.exports;
function handler(file,name,bindings){
 bindings={...spec,...bindings};
 const source=ts.createSourceFile(file,fs.readFileSync(path.join(root,file),'utf8'),ts.ScriptTarget.Latest,true);
 const node=source.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);
 const code=ts.transpileModule(node.getText(source).replace(/^export /,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 return new Function(...Object.keys(bindings),code+'return '+name)(...Object.values(bindings));
}
test('upscale provider validation reasons are readable, URL-redacted and retain the input contract',async()=>{
 for(const payload of [{detail:'Video cannot be read from https://private.test/source.mp4?token=hidden'}, {detail:[{loc:['input','video'],msg:'Unsupported video container'},{msg:'Cannot decode the source'}]}, {error:'Provider failed'}]){
  const requests=[];let result,status;
  const route=handler('server/src/UpscaleRoute.ts','upscaleVideoRoute',{
   process:{env:{REPLI_KEY:'test-only'}},console:{log(){},error(){}},VIDEO_UPSCALE_MODEL_ENDPOINT:'mock-bytedance',
   fetch:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return {ok:false,status:422,text:async()=>JSON.stringify(payload)};}
  });
  await route({body:{video:'https://assets.test/original.mp4',targetWidth:1080,targetHeight:1920,linkmode:true}}, {status:value=>{status=value;return {json:value=>result=value};},json:value=>result=value});
  assert.equal(status,500);assert.match(result.error,/rejected the video upscale \(422\)/);
  assert.ok(!result.error.includes('private.test'));assert.ok(!result.error.includes('[object Object]'));
  if(Array.isArray(payload.detail))assert.match(result.error,/Unsupported video container; Cannot decode/);
  assert.deepEqual(requests,[{url:'mock-bytedance',body:{input:{video:'https://assets.test/original.mp4',processing_type:'standard',scene:'aigc',target_resolution:'1080p',target_fps:60}}}]);
 }
});

test('ByteDance async upscale identifies the model for ledger recovery without downloading output',async()=>{
 let result;const requests=[];
 const route=handler('server/src/UpscaleRoute.ts','upscaleVideoRoute',{
  process:{env:{REPLI_KEY:'test-only'}},console:{log(){},error(){}},
  VIDEO_UPSCALE_MODEL:'bytedance/video-upscaler',VIDEO_UPSCALE_MODEL_ENDPOINT:'mock-bytedance',VIDEO_UPSCALE_TIMEOUT_MS:900000,
  fetch:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({id:'byte-job',status:'processing'})};}
 });
 await route({body:{video:'https://assets.test/original.mp4',linkmode:true,async:true,processing_type:'pro',scene:'old_film',target_resolution:'4k',target_fps:120}}, {json:value=>result=value,status(){return this;}});
 assert.equal(requests.length,1);assert.equal(requests[0].url,'mock-bytedance');
 assert.deepEqual(requests[0].body.input,{video:'https://assets.test/original.mp4',processing_type:'standard',scene:'aigc',target_resolution:'1080p',target_fps:60});
 assert.deepEqual(result,{status:'starting',jobId:'byte-job',provider:'replicate',modelEndpoint:'bytedance/video-upscaler',resolution:'1080p',targetFps:60});
});

test('ByteDance preserves exact MP4 bytes and audio without passing through MediaConvert',async()=>{
 const original=Buffer.from('mock-mp4-video-and-original-audio');let result;const requests=[];
 const route=handler('server/src/UpscaleRoute.ts','upscaleVideoRoute',{
  process:{env:{REPLI_KEY:'test-only'}},console:{log(){},error(){}},Buffer,
  VIDEO_UPSCALE_MODEL_ENDPOINT:'mock-bytedance',VIDEO_UPSCALE_TIMEOUT_MS:900000,
  resolveReplicateFileUrl:output=>output,
  fetch:async(url)=>{requests.push(url);return url==='mock-bytedance'
   ? {ok:true,json:async()=>({id:'byte-job',status:'succeeded',output:'https://provider.test/output.mp4'})}
   : {ok:true,arrayBuffer:async()=>original};}
 });
 await route({body:{video:'https://assets.test/original.mp4',targetWidth:720,targetHeight:1280}}, {json:value=>result=value,status(){return this;}});
 assert.deepEqual(requests,['mock-bytedance','https://provider.test/output.mp4']);
 assert.deepEqual(Buffer.from(result.videoBase64.split(',')[1],'base64'),original);
 assert.equal(result.targetResolution,'1080p');assert.equal(result.targetWidth,undefined);assert.equal(result.targetFps,60);
});

test('2K is passed to Standard AIGC at 60 fps and unsupported resolutions never call the provider',async()=>{
 const requests=[];let result,status;
 const route=handler('server/src/UpscaleRoute.ts','upscaleVideoRoute',{
  process:{env:{REPLI_KEY:'test-only'}},console:{log(){},error(){}},VIDEO_UPSCALE_MODEL_ENDPOINT:'mock-bytedance',VIDEO_UPSCALE_TIMEOUT_MS:900000,
  resolveReplicateFileUrl:output=>output,
  fetch:async(_url,options)=>{requests.push(JSON.parse(options.body));return {ok:true,json:async()=>({id:'job',status:'succeeded',output:'https://provider.test/2k.mp4'})};}
 });
 const res={json:value=>result=value,status:value=>{status=value;return res;}};
 await route({body:{video:'https://assets.test/original.mp4',targetResolution:'2K',linkmode:true}},res);
 assert.deepEqual(requests[0].input,{video:'https://assets.test/original.mp4',processing_type:'standard',scene:'aigc',target_resolution:'2k',target_fps:60});
 assert.equal(result.resolution,'2k');assert.equal(result.targetWidth,undefined);
 await route({body:{video:'https://assets.test/original.mp4',targetResolution:'4k'}},res);
 assert.equal(status,400);assert.equal(requests.length,1);
});

test('resolution preflight rejects invalid choices before source probes and billing, and normalizes supported choices',()=>{
 const validate=handler('server/src/UpscaleRoute.ts','validateVideoUpscaleResolution',{});
 let calls=0,status,result;const res={status:value=>{status=value;return res;},json:value=>result=value};
 validate({body:{targetResolution:'4k'}},res,()=>calls++);
 assert.equal(status,400);assert.equal(calls,0);assert.match(result.error,/1080p or 2K/);
 const selected={body:{targetResolution:'2K',video:'source'}};validate(selected,res,()=>calls++);
 assert.equal(selected.body.targetResolution,'2k');assert.equal(selected.body.video,'source');assert.equal(calls,1);
});

test('ByteDance synchronous upscale waits and polls an active prediction before returning its URL',async()=>{
 let result;const requests=[],waits=[];
 const route=handler('server/src/UpscaleRoute.ts','upscaleVideoRoute',{
  process:{env:{REPLI_KEY:'test-only'}},console:{log(){},error(){}},
  VIDEO_UPSCALE_MODEL_ENDPOINT:'mock-bytedance',VIDEO_UPSCALE_TIMEOUT_MS:900000,VIDEO_UPSCALE_POLL_INTERVAL_MS:2000,
  waitFor:async value=>waits.push(value),resolveReplicateFileUrl:output=>output,
  fetch:async(url)=>{requests.push(url);return {ok:true,json:async()=>url==='mock-bytedance'
   ? {id:'byte-job',status:'processing'}:{id:'byte-job',status:'succeeded',output:'https://provider.test/output.mp4'}};}
 });
 await route({body:{video:'https://assets.test/original.mp4',linkmode:true,targetWidth:1280,targetHeight:720}}, {json:value=>result=value,status(){return this;}});
 assert.deepEqual(requests,['mock-bytedance','https://api.replicate.com/v1/predictions/byte-job']);assert.deepEqual(waits,[2000]);
 assert.equal(result.videoUrl,'https://provider.test/output.mp4');assert.equal(result.targetResolution,'1080p');assert.equal(result.targetHeight,undefined);
});

test('failed video upscale preserves existing media and reports server validation details on its captured scene',async()=>{
 const source=ts.createSourceFile('EditStory.tsx',fs.readFileSync(path.join(root,'src/EditStory.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let node;function visit(item){if(ts.isVariableDeclaration(item)&&item.name.getText(source)==='handleVideoUpscaleClick')node=item.initializer;ts.forEachChild(item,visit);}visit(source);
 assert.ok(node,'Native video upscale handler must be covered');
 // The complete handler is evaluated with fixture state; all provider traffic fails before media mutation.
 const events=[],changes=[];const target={index:0};
 const bindings={priceVideoUpscale:spec.videoUpscalePixels,videoUploadClaimsRef:{current:new Map()},currentVideoMetadataIdentityRef:{current:'https://assets.test/original.mp4'},sceneSourceDataRef:{current:{VideoArrayCloud:['https://assets.test/original.mp4'],VideoArray:['https://assets.test/original.mp4']}},videoUpscaleClaimsRef:{current:new Set()},videoUpscaleCompletedRef:{current:{}},videoUpscaleProviderResultsRef:{current:{}},setVideoUpscaleChoice:()=>{},PostId:9,upscaleTopologyRef:{current:{}},index:0,captureSceneTarget:()=>target,resolveSceneTargetIndex:()=>0,getSceneTargetKey:()=> 'scene-0',
  storedVideoReceiptsRef:{current:new Map()},
  VideoArrayCloud:['https://assets.test/original.mp4'],VideoArray:['original-local'],videoUpscaleJobs:{},isVideoUpscaleBusy:false,
  currentVideoMetadataSource:'https://assets.test/original.mp4',currentVideoDimensions:{width:720,height:1280},
  currentVideoIsHd:false,currentVideoUpscaleArmed:true,videoUpscalePixels:20,pixels:1000,time:10,EDITSTORY_VIDEO_UPSCALE_LINK_MODE:false,
  getBShotSaveContextSnapshot:()=>({}),resolveVideoPromptForTarget:()=> 'Existing prompt',disarmVideoUpscale:()=>{},
  setVideoUpscaleJobs:()=>{},setIsVideoUpscaleConfirmOpen:()=>{},setVideoArray:value=>changes.push(value),setVideoArrayCloud:value=>changes.push(value),
  CLIK_URL:'/mock',axios:{post:async()=>{throw {response:{data:{message:'Source video metadata is unavailable'}}};}},
  globalErrorEmitter:{emit:(message,scene)=>events.push({message,scene})},console:{log(){},error(){}}
 };
 const code=ts.transpileModule('const run='+node.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const run=()=>new Function(...Object.keys(bindings),code+';return run;')(...Object.values(bindings))({target,sourceUrl:'https://assets.test/original.mp4',width:720,height:1280,duration:10,resolution:'1080p'});await run();
 assert.deepEqual(changes,[]);assert.deepEqual(events,[{message:'Source video metadata is unavailable',scene:0}]);
 events.length=0;
 bindings.axios={post:async()=>({data:{videoBase64:'mock-output'}})};
 bindings.base64ToBlob=async()=>new Blob(['test'],{type:'video/mp4'});
 bindings.GenerateSignedUrlForVideo=async()=>{throw Error('Upload persistence failed');};
 bindings.setVideoArrayBlob=value=>changes.push(value);
 await run();assert.deepEqual(changes,[]);assert.deepEqual(events,[{message:'Upload persistence failed The result is retained; use Retry save.',scene:0}]);
});
