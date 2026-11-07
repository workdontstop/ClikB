const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..'), port = 5205;
const source = ts.createSourceFile('EditStory.tsx', fs.readFileSync(path.join(root,'src/EditStory.tsx'),'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const handlers = {};
function visit(node) {
  if(ts.isVariableDeclaration(node) && ['readVideoDuration','handleVideoFileChange','handleVideoUploadDirect'].includes(node.name.getText(source)))
    handlers[node.name.getText(source)] = node.initializer.arguments[0].getText(source);
  ts.forEachChild(node, visit);
} visit(source);
assert.equal(Object.keys(handlers).length,3);
const fixture = ts.transpileModule(`
import {isSupportedVideoUploadDuration} from '/src/videoUploadDuration.ts';
import {recordMotionGuide} from '/src/motionGuideRenderer.ts';
import {Output,Mp4OutputFormat,BufferTarget,CanvasSource} from 'mediabunny';
let index=0, local=['original-0','original-1'], blobs=['blob-0','blob-1'], uploads=[], errors=[], fail=false, done=false, release;
const MAX_VIDEO_SIZE_BYTES=500*1024*1024, videotxt='Existing scene prompt';
const captureSceneTarget=idx=>({kind:'bshot',index:4,bIndex:idx}), resolveSceneTargetIndex=target=>target.bIndex;
const getBShotSaveContextSnapshot=()=>({isBShotMedia:true,parentSceneIndex:4,bIndex:index});
const globalErrorEmitter={emit:(message,idx)=>errors.push({message,idx})};
const setUploadingVideo=()=>{},setVideoArray=updater=>local=updater(local),setVideoArrayBlob=updater=>blobs=updater(blobs);
const GenerateSignedUrlForVideo=async(file,idx,url,context,target)=>{
 uploads.push({idx,target,context,bytes:file.size});await new Promise(resolve=>release=resolve);
 if(fail)throw Error('Simulated upload failure');
 local[target.bIndex]='https://s3.example/saved.mp4';blobs[target.bIndex]=null;URL.revokeObjectURL(url);return local[target.bIndex];
};
const readVideoDuration=${handlers.readVideoDuration};
const handleVideoFileChange=${handlers.handleVideoFileChange};
const handleVideoUploadDirect=${handlers.handleVideoUploadDirect};
const plan={version:1,duration:10,background:'#123456',objects:[{id:'ship',shape:'box',color:'#ccaa88',keys:[0,10].map(t=>({t,position:[t/10,0,0],rotation:[0,0,0],scale:[1,1,1]}))}],camera:[0,10].map(t=>({t,position:[3,3,5],target:[0,0,0],fov:45}))};
window.test={
 state:()=>({local,blobs:blobs.map(value=>value==null?null:typeof value==='string'?value:value.name),uploads,errors,done}),
 begin:async(entry,seconds,shouldFail)=>{
   index=0;local=['original-0','original-1'];blobs=['blob-0','blob-1'];uploads=[];errors=[];fail=shouldFail;done=false;release=undefined;
   let file;
   if(seconds===10)file=await recordMotionGuide(plan,'1:1',new AbortController().signal,()=>{});
   else {
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;canvas.getContext('2d').fillRect(0,0,64,64);
    const output=new Output({format:new Mp4OutputFormat(),target:new BufferTarget()}),video=new CanvasSource(canvas,{codec:'avc',bitrate:100000});
    output.addVideoTrack(video);await output.start();for(let frame=0;frame<seconds*30;frame++)await video.add(frame/30,1/30);await output.finalize();
    file=new File([output.target.buffer],'clip.mp4',{type:'video/mp4'});
   }
   const url=URL.createObjectURL(file);const measured=await readVideoDuration(url);URL.revokeObjectURL(url);
   const event={target:{files:[file],value:'clip'}};
   if(entry==='file')void handleVideoFileChange(event).finally(()=>done=true);else void handleVideoUploadDirect(event,0).finally(()=>done=true);
   return {measured,bytes:file.size};
 },navigate:()=>index=1,finish:()=>{release?.();}
};
`,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
(async()=>{
 const {createServer}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')));
 const server=await createServer({root,configFile:false,logLevel:'error',cacheDir:'.tmp/video-upload-roundtrip-vite',server:{host:'127.0.0.1',port,strictPort:true,hmr:false},plugins:[{
  name:'video-upload-test',resolveId:id=>id==='/fixture.js'?'\0video-upload-test':undefined,load:id=>id==='\0video-upload-test'?fixture:undefined,
  configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url==='/__test'){res.setHeader('Content-Type','text/html');res.end('<script type="module" src="/fixture.js"></script>');}else next();});}
 }]});await server.listen();
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
  page.setDefaultTimeout(60000);await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:'+port+'/')?r.continue():r.abort());
  await page.goto('http://127.0.0.1:'+port+'/__test');await page.waitForFunction(()=>window.test);
  for(const entry of ['file','direct'])for(const [seconds,fail] of [[10,false],[10.1,false],[10,true],[11,false]]){
   const clip=await page.evaluate(async({entry,seconds,fail})=>window.test.begin(entry,seconds,fail),{entry,seconds,fail});
   assert.ok(Math.abs(clip.measured-seconds)<.04,JSON.stringify(clip));assert.ok(clip.bytes>0);
   await page.waitForFunction(()=>window.test.state().uploads.length||window.test.state().errors.length);
   const before=await page.evaluate(()=>window.test.state());assert.deepEqual(before.local,['original-0','original-1']);
   if(seconds===11){assert.equal(before.uploads.length,0);assert.match(before.errors[0].message,/10 seconds/);}
   else{
    assert.equal(before.uploads.length,1);assert.equal(before.errors.length,0);
    await page.evaluate(()=>{window.test.navigate();window.test.finish();});
    if(fail){await page.waitForFunction(()=>window.test.state().errors.length);const after=await page.evaluate(()=>window.test.state());assert.deepEqual(after.local,before.local);assert.deepEqual(after.blobs,before.blobs);assert.equal(after.errors[0].idx,0);}
    else {await page.waitForFunction(()=>window.test.state().done);const after=await page.evaluate(()=>window.test.state());assert.equal(after.local[0],'https://s3.example/saved.mp4');assert.equal(after.blobs[0],null);assert.equal(after.local[1],'original-1');assert.equal(after.uploads[0].target.bIndex,0);}
   }
   console.log('PASS real MP4 '+entry+' entry: '+clip.measured.toFixed(3)+'s, '+(seconds===11?'rejected without mutation':fail?'failed upload retains original after navigation':'accepted with captured shot owner'));
  }
  assert.deepEqual(pageErrors,[]);
 }finally{await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
