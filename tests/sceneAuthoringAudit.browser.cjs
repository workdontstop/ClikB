const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||path.resolve(__dirname,'../.tmp/concierge-browser-deps/node_modules/playwright'));
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.join(root,'.tmp/scene-authoring-audit');fs.mkdirSync(out,{recursive:true});
 const {createServer}=await import('vite');const server=await createServer({root,configFile:false,logLevel:'error',cacheDir:out+'/vite',esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port:5215,strictPort:true,hmr:false}});server.middlewares.use('/audit',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Local motion audit</title>');});await server.listen();
 let browser;
 try{
 browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage(),url='http://127.0.0.1:5215';await page.route('**/*',r=>r.request().url().startsWith(url)||/^(blob:|data:)/.test(r.request().url())?r.continue():r.abort());
 await page.goto(url+'/audit',{waitUntil:'domcontentloaded'});
 const results=await page.evaluate(async()=>{
  const {recordMotionGuide}=await import('/src/motionGuideRenderer.ts');
  const {makeSceneAuthoringFixture}=await import('/server/src/sceneRigPrototype.ts');
  const {validateMotionPlan}=await import('/server/src/motionGuidePlan.ts');
  const results=[];
  for(const [aspect,fov] of [['9:16',106.3],['16:9',8.6]]){
   const plan=makeSceneAuthoringFixture().plan;plan.duration=2;
   for(const object of plan.objects){object.keys=object.keys.map((k,i)=>({...k,t:i?2:0}));for(const part of object.parts||[])part.keys=part.keys.map((k,i)=>({...k,t:i?2:0}));}
   plan.camera=plan.camera.map((k,i)=>({...k,t:i?2:0,position:[0,8,0],target:[0,0,0],up:[0,0,1],fov}));
   const file=await recordMotionGuide(validateMotionPlan(JSON.parse(JSON.stringify(plan))),aspect,new AbortController().signal,()=>{});
   const video=document.createElement('video'),src=URL.createObjectURL(file);video.src=src;video.muted=true;
   await new Promise((resolve,reject)=>{video.onloadedmetadata=resolve;video.onerror=reject;});
   results.push({aspect,fov,width:video.videoWidth,height:video.videoHeight,duration:video.duration,size:file.size});URL.revokeObjectURL(src);
  }return results;
 });
 for(const r of results){assert.ok(r.size>1000);assert.ok(Math.abs(r.duration-2)<.1);assert.equal(r.width/r.height,r.aspect==='9:16'?9/16:16/9);}
 fs.writeFileSync(out+'/mp4-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
