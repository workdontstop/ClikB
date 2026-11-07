const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),ts=require('typescript');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||path.resolve(__dirname,'../.tmp/concierge-browser-deps/node_modules/playwright'));
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {LivePlanAssembler,mergeContinuationRaw}=require('../server/src/liveSceneStream.ts');
const {newWorldState}=require('../server/src/spatialWorld.ts');
const THREE=require('three');
const keys=(position,scale=[1,1,1])=>[0,5].map(t=>({t,position,rotation:[0,0,0],scale}));
const plan={version:1,duration:5,background:'#edf5fc',camera:[0,5].map(t=>({t,position:[5,3.6,8],target:[0,1,0],fov:45})),objects:[
 {id:'ground',shape:'box',color:'#edf5fc',surface:'ground',keys:keys([0,-.1,0],[10,.2,10])},
 {id:'table',shape:'box',color:'#ab925e',role:'prop',keys:keys([1,.8,0],[1.6,1.6,1])},
 {id:'actor',shape:'box',color:'#6686b3',role:'actor',keys:keys([-1,0,0]),parts:[{id:'body',shape:'box',color:'#6686b3',keys:keys([0,1,0],[.6,1,.4])},{id:'head',shape:'sphere',color:'#6686b3',keys:keys([0,1.8,0],[.5,.5,.5])}]},
]};
const sessions=new Map(),observed=[],shared=[];let latestId=0;
const send=(session,event)=>session.res?.write(JSON.stringify({...event,buildId:session.id,seq:++session.seq})+'\n');
const headers=res=>{res.setHeader('Content-Type','application/x-ndjson');res.setHeader('Cache-Control','no-cache');res.flushHeaders();};
const plugin={name:'live-scene-fixture-api',configureServer(server){server.middlewares.use('/local-live',async(req,res,next)=>{
 if(!/\/(scene-|motion-guide|spatial-world)/.test(req.url))return next();
 let body={};try{let text='';for await(const chunk of req)text+=chunk;body=text?JSON.parse(text):{};}catch{res.statusCode=400;return res.end();}
 const reply=data=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
 if(req.url==='/scene-presets'){
  if(body.action==='list')return reply({items:shared,hasMore:false});
  if(body.action==='save'){const item={schema:'clikb.scene-preset.v1',id:'shared-'+(shared.length+1),revision:1,creatorId:'1',creatorName:'Fixture creator',editable:true,preset:body.preset};shared.push(item);return reply(item);}
 }
 if(req.url.startsWith('/scene-live/recent'))return reply({builds:[]});
 if(req.url==='/scene-live/render-feedback'){
  const session=sessions.get(body.buildId);assert.ok(session);assert.equal(body.checkpointId,session.checkpointId);assert.equal(body.commitSeq,session.commit);
  assert.match(body.viewportSnapshot,/^data:image\/jpeg;base64,/);observed.push({automaticImage:body.viewportSnapshot});reply({accepted:true});
  if(session.checkpointId==='step-1'){
   const extra={id:'lamp',shape:'sphere',color:'#eebb55',keys:keys([0,2.7,0],[.5,.5,.5])};session.accepted={...plan,objects:[...plan.objects,extra]};
   send(session,{type:'commit',sequence:++session.commit,ops:[{op:'upsertObject',object:extra}]});session.checkpointId='step-2';
   send(session,{type:'render-checkpoint',checkpointId:session.checkpointId,commitSeq:session.commit,plan:session.accepted,message:'Rendering next step'});
  }else{send(session,{type:'final',result:{plan:session.accepted}});session.res.end();session.status='completed';}
  return;
 }
 if(req.url==='/scene-live/pause'){
  const session=sessions.get(body.buildId);if(!session)return reply({});session.status='paused';if(body.partialPlan)session.accepted=body.partialPlan;
  if(body.viewportSnapshot)observed.push({pauseImage:body.viewportSnapshot});
  send(session,{type:'paused',plan:session.accepted,commitSeq:session.commit,status:'paused',continuationsLeft:4});session.res?.end();
  return reply({status:'paused',plan:session.accepted,commitSeq:session.commit,continuationsLeft:4});
 }
 if(req.url==='/scene-live/stop'){const session=sessions.get(body.buildId);session.status='paused';session.res?.end();return reply(body.keep?{kept:true,plan:session.accepted}:{discarded:true});}
 if(['/motion-guide/build','/spatial-world/plan'].includes(req.url)){
  headers(res);let session;
  if(body.continueBuildId){session=sessions.get(body.continueBuildId);session.res=res;session.status='streaming';observed.push({guidance:body.guidance,viewportSnapshot:body.viewportSnapshot,partialPlan:body.partialPlan,pinned:body.pinnedObjectIds});
   send(session,{type:'continued',plan:body.partialPlan,segment:2,continuationsLeft:3});
   const raw={...plan,objects:[{id:'lamp',shape:'sphere',color:'#eebb55',keys:keys([0,2.7,0],[.5,.5,.5])}]};
   const merged=mergeContinuationRaw(raw,body.partialPlan,[],body.pinnedObjectIds||[]);
   send(session,{type:'commit',sequence:++session.commit,ops:[{op:'upsertObject',object:raw.objects[0]}]});
   setTimeout(()=>{const result=session.spatial?{world:{...session.body.world,revision:'fixture-built-'+session.id,plan:merged,initialState:newWorldState(merged,merged.objects.find(o=>o.id==='actor')?'actor':merged.objects[0].id,'character'),controlledObject:merged.objects.find(o=>o.id==='actor')?'actor':merged.objects[0].id,approved:false}}:{plan:merged};send(session,{type:'final',result});session.status='completed';res.end();},150);return;
  }
  session={id:'fixture-build-'+(++latestId),res,seq:0,commit:0,status:'streaming',body,spatial:req.url.includes('spatial-world')};sessions.set(session.id,session);
  send(session,{type:'started',basePlan:body.previousPlan||body.world?.plan,duration:5,price:1});
  const assembler=new LivePlanAssembler(session.spatial?['plan']:[],body.previousPlan||body.world?.plan,5);
  const text=JSON.stringify(session.spatial?{plan,controlledObject:'actor'}:plan),prefix=text.slice(0,text.lastIndexOf(']')+1);
  for(let i=0;i<prefix.length;i+=47){const commit=assembler.push(prefix.slice(i,i+47));if(commit){session.accepted=assembler.current;session.commit=commit.sequence;send(session,{type:'commit',...commit});}}
  if(body.visualCheckpoints&&!session.spatial){session.checkpointId='step-1';send(session,{type:'render-checkpoint',checkpointId:session.checkpointId,commitSeq:session.commit,plan:session.accepted,message:'Rendering first step'});}
  // Deliberately withhold final completion: the tests inspect real rendered
  // intermediate geometry and interact with pause/guidance before it exists.
  return;
 }
 res.statusCode=404;reply({message:'Unimplemented fixture endpoint'});
});}};
(async()=>{
 const root=path.resolve(__dirname,'..'),output=path.join(root,'.tmp/live-scene-review');fs.mkdirSync(output,{recursive:true});
 const {createServer}=await import('vite');const server=await createServer({root,configFile:false,plugins:[plugin],logLevel:'error',cacheDir:output+'/vite',optimizeDeps:{entries:['tests/fixtures/live-scene.html']},esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port:5227,strictPort:true,hmr:false}});await server.listen();
 let browser;const checks=[],errors=[];
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  for(const surface of ['motion','spatial'])for(const [name,width,height,theme] of [['desktop',1440,1000,'dark'],['mobile',390,844,'light']]){
   const page=await browser.newPage({viewport:{width,height}}),origin='http://127.0.0.1:5227';page.on('pageerror',e=>errors.push({surface,name,error:e.message}));
   await page.route('**/*',route=>route.request().url().startsWith(origin)||/^(data:|blob:)/.test(route.request().url())?route.continue():route.abort());
   await page.goto(`${origin}/tests/fixtures/live-scene.html?surface=${surface}&theme=${theme}`,{waitUntil:'domcontentloaded',timeout:120000});
   if(surface==='spatial'){await page.getByRole('button',{name:'Spatial mode settings'}).waitFor({timeout:60000});await page.getByRole('button',{name:'Spatial mode settings'}).click();await page.getByRole('button',{name:'Edit scene',exact:true}).click();await page.getByRole('button',{name:/Apply with AI/}).click();}
   else{await page.getByRole('button',{name:'Create motion',exact:true}).waitFor({timeout:60000});await page.getByRole('button',{name:'Create motion',exact:true}).click();}
   const workspace=page.locator('[data-live-scene-workspace]');await workspace.locator('canvas').waitFor({timeout:60000});
   await page.getByRole('button',{name:'Pause AI',exact:true}).waitFor();
   assert.equal(await page.getByLabel('Guide the AI',{exact:true}).count(),0,'guidance must not cover the viewport until requested');
   const canvasId=await workspace.locator('canvas').evaluate(canvas=>{canvas.dataset.fixtureIdentity='stable';return canvas.dataset.fixtureIdentity;});
   const coverage=await workspace.evaluate(el=>{const area=el.getBoundingClientRect(),buttons=[...el.querySelectorAll('button')];return buttons.reduce((sum,b)=>{const r=b.getBoundingClientRect();return sum+r.width*r.height;},0)/(area.width*area.height);});assert.ok(coverage<.08,'compact toolbar covers under 8% of viewport');
   await page.screenshot({path:`${output}/${surface}-${name}-building.png`});
   await page.getByRole('button',{name:'Pause AI',exact:true}).click();await page.getByRole('button',{name:'Continue AI',exact:true}).waitFor();
   assert.equal(await workspace.locator('canvas').getAttribute('data-fixture-identity'),canvasId,'pause retains the WebGL canvas');
   await page.screenshot({path:`${output}/${surface}-${name}-paused.png`});
   const rect=await workspace.locator('canvas').boundingBox(),camera=new THREE.PerspectiveCamera(45,rect.width/rect.height,.05,500);camera.position.set(5,3.6,8);camera.lookAt(0,1,0);camera.updateMatrixWorld(true);const point=new THREE.Vector3(1,.8,0).project(camera);
   await page.mouse.click(rect.x+(point.x+1)*rect.width/2,rect.y+(1-point.y)*rect.height/2);
   await page.getByRole('button',{name:'Delete selected object',exact:true}).waitFor().catch(async error=>{console.error('PICK',surface,name,rect,errors,await page.locator('body').innerText());await page.screenshot({path:output+'/pick-failure.png'});throw error;});
   await page.getByRole('button',{name:'Delete selected object',exact:true}).click();
   await page.getByRole('button',{name:'Guide AI',exact:true}).click();await page.getByLabel('Guide the AI',{exact:true}).fill('Make the table smaller and keep my corrections');
   await page.screenshot({path:`${output}/${surface}-${name}-guidance.png`});
   await page.getByRole('button',{name:'Continue · included in this build',exact:true}).click();
   if(surface==='spatial')await workspace.waitFor({state:'detached',timeout:30000});
   else {await page.waitForFunction(()=>window.__liveFixture.client.snapshot().phase==='idle');await page.getByRole('button',{name:'Play timeline',exact:true}).waitFor().catch(async error=>{console.error('COMPLETE',errors,await page.locator('body').innerText());throw error;});}
   const continuation=observed.filter(o=>o.guidance).at(-1);assert.match(continuation.viewportSnapshot,/^data:image\/jpeg;base64,/);assert.ok(continuation.viewportSnapshot.length>5000);assert.ok(!continuation.partialPlan.objects.some(o=>o.id==='table'),'manual deletion survives continuation');assert.ok(continuation.pinned.includes('table'));
   fs.writeFileSync(`${output}/viewport-${surface}-${name}.jpg`,Buffer.from(continuation.viewportSnapshot.split(',')[1],'base64'));
   assert.ok(observed.some(o=>o.pauseImage?.startsWith('data:image/jpeg;base64,')));checks.push(`${surface}/${name}: actual streamed geometry before final, compact edge controls, explicit guidance popup, pause retains canvas, current viewport JPEG accompanies continuation`);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.close();
  }
  const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push({surface:'automatic',error:e.message}));
  await page.goto('http://127.0.0.1:5227/tests/fixtures/live-scene.html?surface=motion&empty=1&visual=1&export=1&aspect=9:16',{waitUntil:'domcontentloaded',timeout:120000});
  const workspace=page.locator('[data-live-scene-workspace]'),canvas=workspace.locator('canvas');await canvas.waitFor({timeout:60000});
  const initial=await canvas.evaluate(c=>{c.dataset.fixtureIdentity='automatic';return c.toDataURL();});assert.ok(initial.length>5000,'local grid and cube have pixels before any AI request');
  await page.getByRole('button',{name:'Reset inspection camera',exact:true}).waitFor();
  await page.screenshot({path:output+'/motion-entry.png'});
  await page.getByRole('button',{name:'Create motion',exact:true}).click();
  await page.getByText('Exporting motion…',{exact:true}).waitFor();
  assert.equal(await canvas.getAttribute('data-fixture-identity'),'automatic','same canvas survives final receipt into export');
  await page.screenshot({path:output+'/motion-exporting-visible.png'});
  await page.getByRole('button',{name:'View exported reference',exact:true}).click();
  await page.locator('video').waitFor({timeout:60000});
  const video=await page.locator('video').evaluate(async v=>{
   await new Promise((resolve,reject)=>{if(v.readyState>=2)return resolve();v.onloadeddata=resolve;v.onerror=reject;});
   const c=document.createElement('canvas');c.width=c.height=96;const ctx=c.getContext('2d');const ranges=[];
   for(const fraction of [.05,.5,.9]){await new Promise(resolve=>{v.onseeked=resolve;v.currentTime=v.duration*fraction;});await new Promise(requestAnimationFrame);ctx.drawImage(v,0,0,96,96);const data=ctx.getImageData(0,0,96,96).data,min=[255,255,255],max=[0,0,0];for(let i=0;i<data.length;i+=4)for(let channel=0;channel<3;channel++){min[channel]=Math.min(min[channel],data[i+channel]);max[channel]=Math.max(max[channel],data[i+channel]);}ranges.push(Math.max(...max.map((value,index)=>value-min[index])));}
   return{width:v.videoWidth,height:v.videoHeight,duration:v.duration,range:Math.max(...ranges),ranges};});
  console.log('Decoded reference',video);

  assert.equal(video.width,480);assert.equal(video.height,854);assert.ok(Math.abs(video.duration-5)<.04);assert.ok(video.range>16);
  assert.equal(observed.filter(o=>o.automaticImage).length,2,'every build step returns an actual rendered image');
  checks.push('automatic Motion Guide: local entry workspace, two rendered-image acknowledgements, same canvas through export, decoded 480x854 five-second MP4 contains scene pixels');await page.close();
  assert.deepEqual(errors,[]);fs.writeFileSync(output+'/results.json',JSON.stringify({checks,errors},null,2));console.log(JSON.stringify({checks,errors,output},null,2));
 }finally{for(const session of sessions.values())session.res?.end();if(browser)await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
