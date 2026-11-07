const {pathToFileURL}=require('node:url');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {serveLocalVideo}=require('./localVideoFixture.cjs');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..').replaceAll('\\','/');
const output=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'spatial-player-test-'));
const sampleVideo=process.env.SPATIAL_TEST_VIDEO;
if(!sampleVideo || !fs.existsSync(sampleVideo))throw new Error('Set SPATIAL_TEST_VIDEO to a local short MP4 file.');
(async()=>{
 const {createServer}=await import(pathToFileURL(root+'/node_modules/vite/dist/node/index.js'));
 const server=await createServer({root,configFile:false,cacheDir:output+'/vite-cache',esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port:5189,strictPort:true,hmr:false,fs:{allow:[root,__dirname]}},
 resolve:{alias:{react:root+'/node_modules/react','react-dom':root+'/node_modules/react-dom'}},
 plugins:[{name:'spatial-test',configureServer(server){server.middlewares.use((req,res,next)=>{
  if(req.url.startsWith('/__test')){res.setHeader('Content-Type','text/html');res.end('<div id="root"></div><script type="module" src="/@fs/'+__dirname.replaceAll('\\','/')+'/spatialPlayer.browser.tsx"></script>');return;}
  if(req.url.startsWith('/sample.mp4')){serveLocalVideo(req,res,sampleVideo);return;}next();
 });}}]});
 await server.listen();
 const browser=await chromium.launch({executablePath:process.env.SPATIAL_CHROME,headless:true,args:['--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1500,height:800}}),errors=[];
 page.setDefaultTimeout(10000);
 page.setDefaultNavigationTimeout(60000);
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',msg=>{if(msg.type()==='error')console.log('console:',msg.text().slice(0,300));});
 const primary=page.locator('[data-test-primary]');
 const at=async node=>{await page.waitForFunction(node=>document.querySelector('[data-test-primary] [data-spatial-node]')?.getAttribute('data-spatial-node')===node,node);};
 const hold=async (direction,scope=primary)=>{const box=await scope.getByRole('slider').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+direction*45,box.y+box.height/2,{steps:5});};
 const finish=async()=>{await primary.locator('[data-spatial-playback] video').evaluate(v=>{v.currentTime=v.duration-0.05;});};
 try{
  for(const mode of ['creation','preview','feed']){
   await page.goto('http://127.0.0.1:5189/__test?mode='+mode);await at('root');
   // Start off-axis, then steer onto the saved route without releasing.
   // An initial unmatched sample must not lock creation into authoring.
   const stick=await primary.getByRole('slider').boundingBox();
   await page.mouse.move(stick.x+stick.width/2,stick.y+stick.height/2);await page.mouse.down();
   await page.mouse.move(stick.x+stick.width/2,stick.y+stick.height/2-35,{steps:5});
   await page.waitForTimeout(150);
   if(mode==='creation')assert.ok(await page.evaluate(()=>window.test.events.current.some(e=>e.drive)));
   await page.mouse.move(stick.x+stick.width/2+45,stick.y+stick.height/2,{steps:5});
   await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime>0.2, null, {timeout:5000});
   await page.mouse.up();await page.waitForTimeout(120);
   assert.equal(await page.evaluate(()=>window.test.events.current.some(e=>e.end)),false,'Replay must not finalize a new draft');
   const paused=await primary.locator('[data-spatial-playback] video').evaluate(v=>({time:v.currentTime,paused:v.paused}));assert.equal(paused.paused,true);
   await page.waitForTimeout(180);assert.ok(Math.abs((await primary.locator('[data-spatial-playback] video').evaluate(v=>v.currentTime))-paused.time)<0.06);
   if(mode==='creation'){await page.evaluate(()=>window.test.edit());assert.equal(await primary.locator('[data-spatial-playback] video').count(),1);}
   await hold(-1);await page.waitForFunction(()=>window.__spatialDiagnostics.entries().some(entry=>entry.event==='playback.start'&&entry.details.connectionId==='move'&&entry.details.direction==='backward'));await at('root');await page.waitForFunction(()=>!document.querySelector('[data-test-primary] [data-spatial-playback] video'));await page.mouse.up();
   await hold(1);await primary.locator('[data-spatial-playback] video').waitFor();await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime>0.1);await finish();await at('moved');await page.mouse.up();
   if(mode!=='creation')await primary.getByRole('button',{name:'Activate interaction',exact:true}).click();else await page.getByRole('button',{name:'activate',exact:true}).click();
   await page.waitForFunction(mode=>{const v=document.querySelector('[data-test-primary] [data-spatial-playback] video');return v?.parentElement.style.zIndex===(mode==='creation'?'30':'40000') && v.readyState>=2 && !v.paused;},mode);assert.equal(await primary.getByRole('slider').getAttribute('aria-disabled'),'true');await finish();await at('acted');
   // The action result has its own playable movement, and that route supports the fallback return.
   await hold(1);await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime>0.2);await page.mouse.up();await hold(-1);
   // A short partially played fallback can finish its reversal between DOM polls.
   // Verify the actual reverse-start event, then its completed destination.
   await page.waitForFunction(()=>window.__spatialDiagnostics.entries().some(entry=>entry.event==='playback.start'&&entry.details.connectionId==='after-action'&&entry.details.direction==='backward'));
   await page.waitForFunction(()=>!document.querySelector('[data-test-primary] [data-spatial-playback] video'));await page.mouse.up();await at('acted');
   await page.getByRole('button',{name:'back',exact:true}).click();await at('moved');await page.getByRole('button',{name:'back',exact:true}).click();await at('root');
    await page.getByRole('button',{name:'jump door',exact:true}).click();if(mode==='creation'){await at('door');await page.getByRole('button',{name:'activate',exact:true}).click();}await at('inside');
   await page.getByRole('button',{name:'back',exact:true}).click();await at('door');
   await page.getByRole('button',{name:'home',exact:true}).click();await at('root');assert.equal(await page.evaluate(()=>window.test.player.current.back()),false);
   if(mode==='creation'){
    await page.evaluate(()=>window.test.block(true));await page.getByRole('button',{name:'jump door',exact:true}).click();await at('root');assert.equal(await primary.getByRole('slider').getAttribute('aria-disabled'),'true');await page.evaluate(()=>window.test.block(false));
    // Creation records unconnected gestures; preview never authors.
    await hold(-1);await page.waitForTimeout(150);await page.mouse.up();assert.ok(await page.evaluate(()=>window.test.events.current.some(e=>e.end)));
    await hold(1);await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime>0.2);await page.mouse.up();
    await page.evaluate(()=>window.test.second(true));const secondary=page.locator('[data-test-second]');await secondary.getByRole('slider').waitFor();await hold(1,secondary);
    await page.waitForFunction(()=>document.querySelector('[data-test-second] [data-spatial-playback] video')?.currentTime>0.1);await page.mouse.up();
    assert.equal(await primary.locator('[data-spatial-playback] video').count(),1);assert.equal(await secondary.locator('[data-spatial-playback] video').count(),1);await page.evaluate(()=>window.test.second(false));
    await page.getByRole('button',{name:'home',exact:true}).click();await at('root');
    await page.evaluate(()=>window.test.external());await at('inside');assert.equal(await page.evaluate(()=>window.test.player.current.back()),false);
   }
   await primary.getByRole('slider').dblclick();await primary.getByRole('group',{name:'Spatial directional drive'}).waitFor();
   await page.getByRole('button',{name:'home',exact:true}).click();await primary.getByRole('group',{name:'Spatial directional drive'}).waitFor();
   await page.screenshot({path:output+'/'+mode+'-verified.png'});
   console.log('PASS '+mode+': pause, generated/fallback reversal, action completion, parent Back, A/B link Back, Home'+(mode==='creation'?', live edit, generation block, authoring, concurrent preview, external stage switch':''));
  }
  for(const mode of ['preview','feed']) {
   await page.goto('http://127.0.0.1:5189/__test?mode='+mode+'&optional=1');await at('root');
   await hold(1);await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime>.1);await finish();await at('moved');
   await primary.getByRole('button',{name:'Activate interaction',exact:true}).waitFor();
   await page.waitForTimeout(350);
   assert.equal(await primary.locator('[data-spatial-playback] video').count(),0,'held movement skipped the action pause');
   await page.waitForFunction(()=>window.__spatialDiagnostics.entries().some(entry=>entry.event==='playback.start'&&entry.details.connectionId==='skip'),null,{timeout:5000});
   await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime>.1);await finish();await at('inside');await page.mouse.up();
   assert.equal(await primary.getByRole('button',{name:'Activate interaction',exact:true}).count(),0,'action leaked across nodes');
   assert.equal(await page.evaluate(()=>window.__spatialDiagnostics.entries().some(entry=>entry.event==='playback.start'&&entry.details.connectionId==='act')),false,'optional action played without a click');
   console.log('PASS '+mode+': arrival pauses with optional action visible, held movement resumes after dwell without drinking, scene link then runs automatically, action clears at next node');
   await page.goto('http://127.0.0.1:5189/__test?mode='+mode+'&optional=1&backtrack=1');await at('root');
   await hold(1);await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime>.1);await finish();await at('moved');await page.mouse.up();
   await primary.getByRole('button',{name:'Activate interaction',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime>.1);await finish();
   await page.waitForFunction(()=>window.__spatialDiagnostics.entries().some(entry=>entry.event==='playback.ended'&&entry.details.connectionId==='act'));
   await at('moved');
   assert.equal(await page.evaluate(()=>window.__spatialDiagnostics.entries().filter(entry=>entry.event==='playback.start'&&entry.details.connectionId==='act').length),1,'action replayed after its authored backtrack');
   await hold(1);await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime>.1);await finish();await at('inside');await page.mouse.up();
   console.log('PASS '+mode+': click optional drink → finish → authored backtrack to checkpoint → continue movement → automatic scene link');
  }
  for(const mode of ['preview','feed']){
   await page.goto('http://127.0.0.1:5189/__test?mode='+mode+'&optional=1&control=hover');await at('root');
   const ring=primary.getByRole('group',{name:/Spatial donut drive/});await ring.waitFor();
   const hover=async direction=>{const box=await ring.boundingBox();await page.mouse.move(box.x+box.width/2+direction*(box.width/2-12),box.y+box.height/2);};
   const action=primary.getByRole('button',{name:'Activate interaction',exact:true});
   await hover(1);await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime>.1);await finish();await at('moved');await action.waitFor();
   await hover(-1);await page.waitForTimeout(400);assert.equal(await primary.locator('[data-spatial-playback] video').count(),0,'hover skipped backward action checkpoint');
   await primary.locator('[data-spatial-playback="backward"] video').waitFor();
   let entries=await page.evaluate(()=>window.__spatialDiagnostics.entries());
   let arrived=entries.find(entry=>entry.event==='playback.ended'&&entry.details.connectionId==='move'),resumed=entries.find(entry=>entry.event==='playback.start'&&entry.details.connectionId==='move'&&entry.details.direction==='backward');
   assert.ok(Date.parse(resumed.time)-Date.parse(arrived.time)>=1950,'hover backward dwell shorter than two seconds');
   await at('root');await hover(1);await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime>.1);await finish();await at('moved');await action.waitFor();
   await page.waitForTimeout(400);assert.equal(await primary.locator('[data-spatial-playback] video').count(),0,'hover skipped forward action checkpoint');
   await page.waitForFunction(()=>window.__spatialDiagnostics.entries().some(entry=>entry.event==='playback.start'&&entry.details.connectionId==='skip'));
   entries=await page.evaluate(()=>window.__spatialDiagnostics.entries());arrived=entries.filter(entry=>entry.event==='playback.ended'&&entry.details.connectionId==='move').at(-1);resumed=entries.find(entry=>entry.event==='playback.start'&&entry.details.connectionId==='skip');
   assert.ok(Date.parse(resumed.time)-Date.parse(arrived.time)>=1950,'hover forward dwell shorter than two seconds');
   assert.equal(await action.count(),0,'hover action stays visible after movement resumes');
   await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime>.1);await finish();await at('inside');await page.mouse.move(900,700);
   assert.equal(await action.count(),0,'hover action leaked past the checkpoint');
   assert.equal(entries.some(entry=>entry.event==='playback.start'&&entry.details.connectionId==='act'),false,'hover played optional action without a click');
   console.log('PASS '+mode+' hover: forward/backward two-second action checkpoint, action clears while moving and at next node, no implicit action');
  }
  assert.deepEqual(errors,[]);console.log('PASS no browser runtime exceptions; screenshots: '+output);
 }catch(e){console.log('ERROR',e);console.log('PAGE ERRORS',errors);console.log(JSON.stringify(await page.evaluate(()=>({diagnostics:window.__spatialDiagnostics.entries().filter(entry=>entry.event.startsWith('playback.')),media:[...document.querySelectorAll('[data-test-primary] [data-spatial-playback] video')].map(video=>({src:video.getAttribute('src'),time:video.currentTime,duration:video.duration,readyState:video.readyState,seeking:video.seeking,paused:video.paused,visibility:video.style.visibility}))})),null,2));await page.screenshot({path:output+'/failure.png'});throw e;}
 finally{await browser.close();await server.close();}
})().catch(()=>process.exitCode=1);
