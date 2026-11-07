const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {serveLocalVideo}=require('./localVideoFixture.cjs');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..').replaceAll('\\','/'),output=process.env.SPATIAL_TEST_OUTPUT || fs.mkdtempSync(path.join(require('node:os').tmpdir(),'spatial-playback-test-')),sample=process.env.SPATIAL_TEST_VIDEO;
 if(!sample || !fs.existsSync(sample)) throw new Error('Set SPATIAL_TEST_VIDEO to a local short MP4 file.');
 fs.mkdirSync(output,{recursive:true});
 const {createServer}=await import(pathToFileURL(root+'/node_modules/vite/dist/node/index.js'));
 const server=await createServer({root,configFile:false,logLevel:'error',cacheDir:output+'/vite',esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port:5198,strictPort:true,hmr:false},plugins:[{name:'fixture',load(id){if(!process.env.SPATIAL_BASELINE_DIR)return;const relative=path.relative(root,id.split('?')[0]);const before=path.join(process.env.SPATIAL_BASELINE_DIR,relative);if(relative.startsWith('src'+path.sep)&&fs.existsSync(before))return fs.readFileSync(before,'utf8');},configureServer(server){server.middlewares.use((req,res,next)=>{
  if(req.url.startsWith('/__surface')){res.setHeader('Content-Type','text/html');res.end('<div id="root"></div><script type="module" src="/tests/spatialSurfaceHandoff.browser.tsx"></script>');return;}
  if(req.url.startsWith('/__test')){res.setHeader('Content-Type','text/html');res.end('<div id="root"></div><script type="module" src="/tests/spatialPlayer.browser.tsx"></script>');return;}
  if(req.url.startsWith('/sample.mp4')){serveLocalVideo(req,res,sample);return;}next();
 });}}]});await server.listen();
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME,args:['--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1500,height:800}}),errors=[],results=[],failures=[];
 page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:5198/')?route.continue():route.abort());
 const primary=page.locator('[data-test-primary]'),at=node=>page.waitForFunction(node=>document.querySelector('[data-test-primary] [data-spatial-node]')?.getAttribute('data-spatial-node')===node,node);
 const visit=query=>page.goto('http://127.0.0.1:5198/__test?'+query,{waitUntil:'domcontentloaded',timeout:60000});
 const hold=async direction=>{const box=await primary.getByRole('slider').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+direction*45,box.y+box.height/2,{steps:4});};
 const check=async(name,work)=>{try{await work();results.push(name);console.log('PASS '+name);}catch(error){failures.push({name,error:String(error)});console.log('FAIL '+name+': '+error.message);await page.screenshot({path:output+'/failure-'+failures.length+'.png'});}};
 try{
  await check('still-image handoff paints the destination before releasing playback, including shared-image nodes',async()=>{
   await page.goto('http://127.0.0.1:5198/__surface',{waitUntil:'domcontentloaded',timeout:60000});
   await page.waitForFunction(()=>window.surfaceTest?.events.length>0);
   const first=await page.evaluate(()=>window.surfaceTest.events[0]);assert.ok(first.rgba[0]>240&&first.rgba[1]<10&&first.rgba[2]<10,'initial ready signal precedes the red frame render');
   await page.evaluate(()=>window.surfaceTest.setFrame({color:'#0000ff',key:'destination'}));
   await page.waitForFunction(()=>window.surfaceTest.events.some(event=>event.key==='destination'));
   const destination=await page.evaluate(()=>window.surfaceTest.events.find(event=>event.key==='destination'));
   assert.ok(destination.rgba[2]>240&&destination.rgba[0]<10&&destination.rgba[1]<10,'ready signal would reveal an unrelated previous frame');
   await page.evaluate(()=>window.surfaceTest.setFrame({color:'#0000ff',key:'same-image-next-node'}));
   await page.waitForFunction(()=>window.surfaceTest.events.some(event=>event.key==='same-image-next-node'));
   assert.equal(await page.locator('canvas').count(),1,'shared-image arrival rebuilt the renderer');
  });
  for(const mode of ['preview','feed']){
   if(!process.env.SPATIAL_BASELINE_DIR) for(const origin of ['A','C']) await check(mode+': backward movement returns through the followed link from '+origin,async()=>{
    await visit('mode='+mode+'&twoOrigins=1&origin='+origin);await at(origin==='A'?'root':'c-root');
    if(origin==='A') await page.getByRole('button',{name:'jump door',exact:true}).click();
    else {await hold(1);await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime>.1);await primary.locator('[data-spatial-playback] video').last().evaluate(video=>video.currentTime=video.duration-.05);}
    await at('inside');await page.mouse.up();
    await hold(1);await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime>.1);
    await primary.locator('[data-spatial-playback] video').last().evaluate(video=>video.currentTime=video.duration-.05);await at('room');await page.mouse.up();
    await primary.getByRole('slider').waitFor();
    assert.equal(await primary.getByRole('slider').count(),1,'completed destination hides backward movement');
    await hold(-1);await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback="backward"] video')?.currentTime>.1);
    await primary.locator('[data-spatial-playback] video').last().evaluate(video=>video.currentTime=video.duration-.05);
    await at(origin==='A'?'door':'c-door');await page.mouse.up();await page.waitForTimeout(200);
    assert.equal(await primary.locator('[data-spatial-stage]').getAttribute('data-spatial-stage'),origin,'return guessed a different linked source or bounced forward again');
    assert.equal(await primary.locator('[data-spatial-node]').getAttribute('data-spatial-node'),origin==='A'?'door':'c-door');
    await page.screenshot({path:output+'/'+mode+'-return-'+origin+'.png'});
   });
   await check(mode+': same-image action result releases retained video and document replacement clears old playback',async()=>{
    await visit('mode='+mode+'&sharedFrames=1');await at('root');
    await hold(1);await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime>.1);
    await primary.locator('[data-spatial-playback] video').evaluate(video=>video.currentTime=video.duration-.05);
    await at('moved');await page.mouse.up();await page.waitForFunction(()=>!document.querySelector('[data-test-primary] [data-spatial-playback] video'));
    await primary.getByRole('button',{name:'Activate interaction',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime>.1);
    await primary.locator('[data-spatial-playback] video').evaluate(video=>video.currentTime=video.duration-.05);
    await at('acted');await page.waitForTimeout(300);
    assert.equal(await primary.locator('[data-spatial-playback] video').count(),0,'completed action from another node remains over the shared still frame');
    await hold(1);await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime>.1);await page.mouse.up();
    await page.evaluate(()=>window.test.replace());await at('root');await page.waitForTimeout(300);
    assert.equal(await primary.locator('[data-spatial-playback] video').count(),0,'a replaced experience still displays a previous experience video');
   });
   await check(mode+': cached-video reveal waits for a decoded frame after seeking',async()=>{
    await visit('mode='+mode);await at('root');
    await hold(1);await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime>.15);await page.mouse.up();
    await page.evaluate(()=>window.test.player.current.home());await at('root');await page.waitForFunction(()=>!document.querySelector('[data-test-primary] [data-spatial-playback] video'));
    // Warm this exact cached element at a different frame, then hold its compositor callback.
    await page.evaluate(async()=>{
     const {spatialVideoRamCache}=await import('/src/spatialVideoCache.ts');const video=spatialVideoRamCache.playbackElement('/sample.mp4?move');
     video.currentTime=1;await new Promise(resolve=>video.addEventListener('seeked',resolve,{once:true}));
     window.__releaseDecodedFrame=()=>{for(const release of window.__decodedReleases||[])release();window.__decodedReleases=[];};window.__decodedReleases=[];
     const acquire=spatialVideoRamCache.acquirePlayback.bind(spatialVideoRamCache);
     spatialVideoRamCache.acquirePlayback=url=>{const lease=acquire(url);if(lease){const original=lease.video.requestVideoFrameCallback.bind(lease.video);lease.video.requestVideoFrameCallback=callback=>original((now,metadata)=>window.__decodedReleases.push(()=>callback(now,metadata)));}return lease;};
    });
    await hold(1);await primary.locator('[data-spatial-playback] video').last().waitFor({state:'attached'});await page.waitForTimeout(150);
    const state=await primary.locator('[data-spatial-playback] video').last().evaluate(video=>({visibility:video.style.visibility,muted:video.muted,time:video.currentTime,pending:window.__decodedReleases.length}));
    assert.equal(state.visibility,'hidden','reused video revealed before its decoded target frame was presented');
    assert.equal(state.muted,true,'hidden frame preparation played audio before visual handoff');
    assert.ok(state.pending>0,'no decoded frame was requested');
    await page.evaluate(()=>window.__releaseDecodedFrame());await page.waitForFunction(()=>{const video=document.querySelector('[data-test-primary] [data-spatial-playback] video');return video?.style.visibility==='visible'&&video.currentTime>.05;});await page.mouse.up();
   });
   if(!process.env.SPATIAL_BASELINE_DIR) for(const kind of ['action','return']) await check(mode+': '+kind+' waits for its own decoded frame',async()=>{
    await visit('mode='+mode);await at('root');
    await hold(1);await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime>.1);
    await primary.locator('[data-spatial-playback] video').last().evaluate(video=>video.currentTime=video.duration-.05);await at('moved');await page.mouse.up();
    await page.waitForFunction(()=>!document.querySelector('[data-test-primary] [data-spatial-playback] video'));
    const url=kind==='action'?'/sample.mp4?act':'/sample.mp4?move-return';
    await page.evaluate(async url=>{
     const {spatialVideoRamCache}=await import('/src/spatialVideoCache.ts');const video=spatialVideoRamCache.playbackElement(url);
     video.currentTime=1;await new Promise(resolve=>video.addEventListener('seeked',resolve,{once:true}));
     window.__decodedReleases=[];const acquire=spatialVideoRamCache.acquirePlayback.bind(spatialVideoRamCache);
     spatialVideoRamCache.acquirePlayback=requested=>{const lease=acquire(requested);if(lease&&requested===url){const original=lease.video.requestVideoFrameCallback.bind(lease.video);lease.video.requestVideoFrameCallback=callback=>original((now,metadata)=>window.__decodedReleases.push(()=>callback(now,metadata)));}return lease;};
    },url);
    if(kind==='action') await primary.getByRole('button',{name:'Activate interaction',exact:true}).click();else await hold(-1);
    await primary.locator('[data-spatial-playback] video').last().waitFor({state:'attached'});await page.waitForTimeout(150);
    assert.equal(await primary.locator('[data-spatial-playback] video').last().evaluate(video=>video.style.visibility),'hidden');
    assert.ok(await page.evaluate(()=>window.__decodedReleases.length>0));
    await page.evaluate(()=>{for(const release of window.__decodedReleases)release();window.__decodedReleases=[];});
    await page.waitForFunction(()=>{const video=document.querySelector('[data-test-primary] [data-spatial-playback] video');return video?.style.visibility==='visible'&&video.currentTime>.05;});
    await page.mouse.up();
   });
   if(!process.env.SPATIAL_BASELINE_DIR) await check(mode+': view switch appears only inside Settings',async()=>{
    await visit('mode='+mode+'&world=1');await at('root');
    assert.equal(await page.getByRole('button',{name:'Switch between Three.js and AI video'}).count(),0);
    await primary.getByRole('button',{name:'Stages and nodes'}).click();
    const toggle=page.getByRole('button',{name:'Switch between Three.js and AI video'});await toggle.waitFor();assert.equal(await toggle.count(),1);
    await toggle.click();assert.match(await toggle.innerText(),/Video/);
    await page.getByRole('button',{name:'Close stages and nodes'}).click();assert.equal(await toggle.count(),0);
    await page.screenshot({path:output+'/'+mode+'-settings-only.png'});
   });
  }
  fs.writeFileSync(output+'/report.json',JSON.stringify({passed:results,failures,errors,localOnly:true},null,2));assert.deepEqual(failures,[]);assert.deepEqual(errors,[]);
 }finally{await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
