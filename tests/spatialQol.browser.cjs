const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {serveLocalVideo}=require('./localVideoFixture.cjs');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..').replaceAll('\\','/'),output=path.join(root,'.tmp/qol-browser'),sample=process.env.SPATIAL_TEST_VIDEO;
 if(!sample||!fs.existsSync(sample))throw Error('Set SPATIAL_TEST_VIDEO to a local MP4.');fs.mkdirSync(output,{recursive:true});
 let labels={},failSave=false,requests=[],mediaRequests=[],labelRevision=0;
 const {createServer}=await import(pathToFileURL(root+'/node_modules/vite/dist/node/index.js'));
 const server=await createServer({root,configFile:false,logLevel:'error',cacheDir:output+'/vite',esbuild:{jsx:'automatic'},resolve:{alias:{react:root+'/node_modules/react','react-dom':root+'/node_modules/react-dom'}},optimizeDeps:{include:['@mui/icons-material/EditOutlined']},server:{host:'127.0.0.1',port:5197,strictPort:true,hmr:false,watch:null},plugins:[{name:'qol',configureServer(server){server.middlewares.use((req,res,next)=>{
  if(req.url.startsWith('/__test')){res.setHeader('Content-Type','text/html');res.end('<div id="root"></div><script type="module" src="/tests/spatialPlayer.browser.tsx"></script>');return;}
  if(req.url.startsWith('/sample.mp4')){mediaRequests.push(req.url);serveLocalVideo(req,res,sample);return;}
  if(req.url.startsWith('/spatial-experience/action-labels')){res.setHeader('Content-Type','application/json');if(req.method==='GET'){res.end(JSON.stringify({actionLabels:labels,actionLabelsRevision:labelRevision}));return;}let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{const request=JSON.parse(body);requests.push(request);if(failSave){res.statusCode=500;res.end(JSON.stringify({message:'Temporary save failure'}));return;}for(const patch of request.labels){if(patch.label.trim())(labels[patch.stageId]||={})[patch.connectionId]=patch.label.trim().replace(/\s+/g,' ');else{delete labels[patch.stageId]?.[patch.connectionId];}}labelRevision++;res.end(JSON.stringify({actionLabels:labels,actionLabelsRevision:labelRevision}));});return;}next();
 });}}]});await server.listen();
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME,args:['--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:1200,height:800}}),errors=[],results=[],failures=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:5197/')?route.continue():route.abort());
 const primary=page.locator('[data-test-primary]'),at=node=>page.waitForFunction(node=>document.querySelector('[data-test-primary] [data-spatial-node]')?.getAttribute('data-spatial-node')===node,node);
 const visit=async query=>{await page.goto('http://127.0.0.1:5197/__test?'+query,{waitUntil:'domcontentloaded',timeout:60000});await at('root');};
 const jump=async node=>{await page.evaluate(node=>window.test.player.current.jump(node),node);await at(node);};
 const editMode=async()=>{await primary.getByRole('button',{name:'Stages and nodes',exact:true}).click();await page.getByRole('button',{name:'Labels',exact:true}).click();await primary.getByRole('button',{name:'Save action labels'}).waitFor();};
 const edit=async text=>{await primary.getByRole('button',{name:'Edit action label'}).click();await page.getByRole('textbox',{name:'Label',exact:true}).fill(text);await page.getByRole('button',{name:'Done',exact:true}).click();await primary.getByRole('button',{name:'Edit action label'}).waitFor();};
 const hold=async direction=>{const box=await primary.getByRole('slider').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+direction*45,box.y+box.height/2,{steps:4});};
 const drive=async(control,direction)=>{
  if(control==='analog')await hold(direction);
  else if(control==='dpad')await primary.locator('[data-drive-direction="'+(direction<0?'left':'right')+'"]').dispatchEvent('pointerdown',{pointerId:1,isPrimary:true,button:0});
  else {const box=await primary.locator('.spatial-drive-control').boundingBox();await page.mouse.move(box.x+box.width/2+direction*(box.width/2-20),box.y+box.height/2);}
 };
 const release=async control=>{if(control==='dpad')await primary.locator('.spatial-drive-control').dispatchEvent('pointerup',{pointerId:1,isPrimary:true,button:0});else {await page.mouse.up();await page.mouse.move(1100,700);}};
 const finish=async()=>{await page.waitForFunction(()=>{const v=document.querySelector('[data-test-primary] [data-spatial-playback] video');return v?.style.visibility==='visible'&&!v.paused&&v.currentTime>.05;});await primary.locator('[data-spatial-playback] video').evaluate(v=>{v.currentTime=v.duration-.08;});};
 const explore=async control=>{await drive(control,1);await page.waitForFunction(()=>{const v=document.querySelector('[data-test-primary] [data-spatial-playback] video');return v?.style.visibility==='visible'&&!v.paused&&v.currentTime>1.25;});await release(control);await drive(control,-1);};
 const track=async()=>page.evaluate(()=>{
  const root=document.querySelector('[data-test-primary]');window.transitions={overlap:0,delays:[],nodes:[]};let key='',playing=false,changed=performance.now(),visible=false;
  const read=()=>{const node=root.querySelector('[data-spatial-node]'),next=node?.getAttribute('data-spatial-stage')+':'+node?.getAttribute('data-spatial-node'),active=!!root.querySelector('[data-spatial-playback="forward"]');
   if(next!==key||playing!==active){if(next!==key)window.transitions.nodes.push(next);key=next;playing=active;changed=performance.now();visible=false;}
   const nav=root.querySelector('[data-spatial-action-navigation]'),pad=root.querySelector('.spatial-drive-control'),shown=!!nav&&getComputedStyle(nav).display!=='none';
   if(shown&&pad&&getComputedStyle(pad).display!=='none')window.transitions.overlap++;
   if(shown&&!visible)window.transitions.delays.push(performance.now()-changed);visible=shown;
  };new MutationObserver(read).observe(root,{subtree:true,childList:true,attributes:true});read();
 });
 const check=async(name,work)=>{try{await work();results.push(name);console.log('PASS '+name);}catch(e){failures.push({name,error:String(e)});console.log('FAIL '+name+': '+e.message);await page.mouse.up();await page.screenshot({path:output+'/failure-'+failures.length+'.png'});}};
 try {
  for(const mode of ['preview','feed']) {
   await check(mode+': author edits multiple action labels, retains failed drafts and saves without resetting position',async()=>{
    labels={};requests=[];failSave=false;await visit('mode='+mode+'&labels=1&actionLink=1');await jump('moved');await editMode();
    assert.equal(await page.getByRole('button',{name:'Close stages and nodes'}).count(),0);assert.equal(await primary.locator('[data-spatial-node]').getAttribute('data-spatial-node'),'moved');
    assert.equal(await primary.getByRole('button',{name:'Edit action label'}).innerText(),'Edit');assert.equal(await primary.getByRole('button',{name:'Edit action label'}).locator('svg').count(),1);
    await edit('Pick up');assert.equal(await page.evaluate(()=>window.testStore.getState().spatialLabels.drafts['1:42']['["A","act"]'].label),'Pick up');assert.equal(requests.length,0);
    assert.equal(await primary.getByRole('button',{name:'Edit action label'}).locator('svg').count(),1);
    await jump('acted');await edit('Sit');failSave=true;await primary.getByRole('button',{name:'Save action labels'}).click();await page.waitForFunction(()=>document.querySelector('[aria-label="Save action labels"]')?.textContent==='Retry save');
    await primary.getByRole('alert').filter({hasText:'Temporary save failure'}).waitFor();
    assert.equal(await primary.locator('[data-spatial-node]').getAttribute('data-spatial-node'),'acted');assert.equal(await primary.getByRole('button',{name:'Edit action label'}).innerText(),'Sit');
    failSave=false;await primary.getByRole('button',{name:'Save action labels'}).click();await primary.getByRole('button',{name:'Save action labels'}).waitFor({state:'hidden'});
    assert.deepEqual(labels,{A:{act:'Pick up','act-2':'Sit'}});assert.equal(await primary.locator('[data-spatial-node]').getAttribute('data-spatial-node'),'acted');assert.equal(await primary.getByRole('button',{name:'Edit action label'}).count(),0);
    assert.equal(requests.at(-1).labels.length,2);assert.equal(requests.at(-1).spatialExperienceJson,undefined);assert.equal(await primary.locator('[data-spatial-playback] video').count(),0);
    await jump('moved');assert.equal(await primary.locator('[data-spatial-action-label]').innerText(),'Pick up');
    assert.equal(await primary.locator('[data-spatial-action-label] svg').count(),0);
    await editMode();await edit('');await primary.getByRole('button',{name:'Save action labels'}).click();await primary.getByRole('button',{name:'Save action labels'}).waitFor({state:'hidden'});
    assert.equal(await primary.locator('[data-spatial-action-label]').count(),0);assert.equal(labels.A.act,undefined);assert.equal(labels.A['act-2'],'Sit');
   });
   await check(mode+': viewers see saved hints but cannot edit them',async()=>{
    labels={A:{act:'Strike'}};await visit('mode='+mode+'&labels=1&savedLabel=1&nonowner=1');await jump('moved');assert.equal(await primary.locator('[data-spatial-action-label]').innerText(),'Strike');
    assert.equal(await primary.getByRole('button',{name:'Edit action label'}).count(),0);await primary.getByRole('button',{name:'Stages and nodes',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Labels',exact:true}).count(),0);
   });
   for(const control of ['analog','dpad','hover'])await check(mode+': '+control+' guards a new action link until one second of movement, then returns with spaced delayed controls and immediate Forward',async()=>{
    await visit('mode='+mode+'&actionLink=1&control='+control);await page.evaluate(()=>window.test.player.current.jump('acted-2'));await at('inside');
    const pad=await primary.locator('.spatial-drive-control').boundingBox();
    await drive(control,-1);await page.waitForTimeout(350);await release(control);assert.equal(await primary.locator('[data-spatial-node]').getAttribute('data-spatial-node'),'inside');assert.equal(await primary.locator('[data-spatial-playback] video').count(),0);
    await drive(control,1);await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime>.05);await release(control);
    await drive(control,-1);await page.waitForFunction(()=>!document.querySelector('[data-test-primary] [data-spatial-playback="backward"] video'));await page.waitForTimeout(150);await release(control);assert.equal(await primary.locator('[data-spatial-node]').getAttribute('data-spatial-node'),'inside','a brief movement unlocked return');
    assert.equal(await primary.locator('[data-spatial-action-navigation]').count(),0);
    await track();await explore(control);await at('acted-2');await release(control);
    await primary.getByRole('button',{name:'Next action step'}).waitFor();
    const nav=primary.locator('[data-spatial-action-navigation]'),buttons=nav.getByRole('button'),left=await buttons.nth(0).boundingBox(),right=await buttons.nth(1).boundingBox();
    assert.ok(Math.abs(left.width-pad.width*.38)<.2);assert.ok(Math.abs(left.y+left.height/2-(pad.y+pad.height/2))<.2);assert.ok(right.x-(left.x+left.width)>=pad.width*.49);
    const style=await buttons.nth(0).evaluate(el=>({border:getComputedStyle(el).borderColor,background:getComputedStyle(el).background}));assert.equal(style.border,'rgba(255, 255, 255, 0.88)');assert.ok(style.background.includes(control==='analog'?'linear-gradient':'rgba(8, 10, 16, 0.88)'));
    assert.equal(await nav.locator('svg').count(),control==='hover'?2:0);assert.equal(await nav.innerText(),control==='dpad'?'◀\n▶':'');
    const transition=await page.evaluate(()=>window.transitions);assert.equal(transition.overlap,0);assert.ok(transition.delays.length>0&&transition.delays.every(delay=>delay>=480),JSON.stringify(transition));
    assert.ok(!transition.nodes.includes('A:b:0:b1:room'),'return incorrectly required completing the forward movement');
    assert.equal(await primary.locator('[data-spatial-playback] video').evaluate(v=>v.paused),false);
    await page.screenshot({path:output+'/'+mode+'-action-review-'+control+'.png'});
    await primary.getByRole('button',{name:'Next action step'}).click();await at('inside');assert.equal(await primary.locator('[data-spatial-action-navigation]').count(),0);
    await drive(control,-1);await page.waitForTimeout(300);await release(control);assert.equal(await primary.locator('[data-spatial-node]').getAttribute('data-spatial-node'),'inside','a newly followed action link was not guarded again');
   });
   await check(mode+': deliberate Back arrow and content double-tap remain unchanged even before exploration',async()=>{
    for(const gesture of ['arrow','double-tap']){await visit('mode='+mode+'&actionLink=1');await page.evaluate(()=>window.test.player.current.jump('acted-2'));await at('inside');
     if(gesture==='arrow')await primary.getByRole('button',{name:'Back to previous node or stage',exact:true}).click();else await primary.locator('[data-spatial-mode]').dblclick({position:{x:300,y:250}});
     await at('moved');assert.equal(await primary.locator('[data-spatial-action-navigation]').count(),0);assert.equal(await primary.getByRole('button',{name:'Activate interaction',exact:true}).count(),1);
    }
   });
  }
  await check('three chained actions replay one at a time, including hold clips, and finishing resumes the authored link',async()=>{
   await visit('mode=feed&actionLink=1&thirdAction=1&holdAction=1&theme=dark');await page.evaluate(()=>window.test.player.current.jump('acted-3'));await at('inside');await track();await explore('analog');await at('acted-3');await release('analog');
   await primary.getByRole('button',{name:'Next action step'}).waitFor();
   assert.equal(await primary.locator('[data-spatial-node]').getAttribute('data-spatial-node'),'acted-3');assert.equal(await primary.locator('.spatial-drive-control').isVisible(),false);
   for(const [button,node,clip] of [['Previous action step','acted-2','act-2'],['Previous action step','acted','act'],['Next action step','acted-2','act-2'],['Next action step','acted-3','act-3']]){
    await primary.getByRole('button',{name:button}).click();await at(node);await primary.getByRole('button',{name:'Next action step'}).waitFor();assert.ok((await primary.locator('[data-spatial-playback] video').evaluate(v=>v.currentSrc)).endsWith('?'+clip));assert.equal(await primary.locator('[data-spatial-playback] video').evaluate(v=>v.paused),false);
   }
   await primary.evaluate(el=>{el.style.width='320px';el.style.height='560px';});const surface=await primary.boundingBox(),nav=await primary.locator('[data-spatial-action-navigation]').boundingBox();assert.ok(nav.x>=surface.x&&nav.x+nav.width<=surface.x+surface.width);await page.screenshot({path:output+'/action-review-small-dark.png'});
   const transition=await page.evaluate(()=>window.transitions);assert.equal(transition.overlap,0);assert.ok(transition.delays.length>=5&&transition.delays.every(delay=>delay>=480),JSON.stringify(transition));
   for(const node of ['acted-2','acted','moved']){await primary.getByRole('button',{name:'Previous action step'}).click();await at(node);if(node!=='moved')await primary.getByRole('button',{name:'Previous action step'}).waitFor();}
   assert.equal(await primary.locator('[data-spatial-action-navigation]').count(),0);assert.equal(await primary.locator('.spatial-drive-control').isVisible(),true);
  });
  await check('finishing a return action follows its next authored scene, with no frozen return controls',async()=>{
   await visit('mode=feed&actionLink=1');await page.evaluate(()=>window.test.player.current.jump('acted-2'));await at('inside');await explore('analog');await at('acted-2');await release('analog');await primary.getByRole('button',{name:'Next action step'}).waitFor();await finish();await at('inside');assert.equal(await primary.locator('[data-spatial-action-navigation]').count(),0);assert.equal(await primary.locator('.spatial-drive-control').isVisible(),true);
  });
  await check('normal action playback never gains return-only action step buttons',async()=>{
   await visit('mode=preview&actionLink=1');await jump('moved');await primary.getByRole('button',{name:'Activate interaction',exact:true}).click();assert.equal(await primary.locator('[data-spatial-action-navigation]').count(),0);await finish();await at('acted');assert.equal(await primary.locator('[data-spatial-action-navigation]').count(),0);
  });
  await check('ordinary motion-origin links still allow an immediate movement-driven return',async()=>{
   await visit('mode=feed');await page.evaluate(()=>window.test.player.current.jump('door'));await at('inside');await drive('analog',-1);await at('door');await release('analog');assert.equal(await primary.locator('[data-spatial-action-navigation]').count(),0);
  });
  await check('Completed has a top-right Home button which returns to the experience entry',async()=>{
   await visit('mode=feed');await page.evaluate(()=>window.test.player.current.jump('door'));await at('inside');await drive('analog',1);await finish();await at('room');await release('analog');await primary.getByText('Completed',{exact:true}).waitFor();const home=primary.locator('[data-spatial-completion-home]'),box=await home.boundingBox(),surface=await primary.boundingBox();assert.ok(box.x>surface.x+surface.width/2&&box.y<surface.y+80);await home.click();await at('root');assert.equal(await home.count(),0);
  });
  for(const mode of ['creation','preview','feed'])await check(mode+': fresh default is '+(mode==='creation'?'stick':'donut')+'; a chosen mode persists until reload',async()=>{
   await visit('mode='+mode+'&defaults=1');const pad=primary.locator('.spatial-drive-control'),defaultMode=mode==='creation'?'analog':'hover';assert.equal(await pad.getAttribute('data-control-mode'),defaultMode);
   if(defaultMode==='hover'){await pad.dblclick();await page.waitForFunction(()=>document.querySelector('[data-test-primary] .spatial-drive-control')?.dataset.controlMode==='analog');}
   await pad.dblclick();await page.waitForFunction(()=>document.querySelector('[data-test-primary] .spatial-drive-control')?.dataset.controlMode==='dpad');
   await pad.locator('[data-drive-direction="right"]').dblclick();await page.waitForFunction(()=>document.querySelector('[data-test-primary] .spatial-drive-control')?.dataset.controlMode==='hover');await page.mouse.move(1100,700);await jump('moved');assert.equal(await pad.getAttribute('data-control-mode'),'hover');await page.evaluate(()=>window.test.player.current.home());await at('root');assert.equal(await pad.getAttribute('data-control-mode'),'hover');await page.reload();await at('root');assert.equal(await pad.getAttribute('data-control-mode'),defaultMode);
  });
  await check('Three.js playback unlocks an action-link return after one second of unfinished movement',async()=>{
   await visit('mode=preview&actionLink=1&world=1&three=1');await page.evaluate(()=>window.test.player.current.jump('acted-2'));await at('inside');await drive('analog',-1);await page.waitForTimeout(300);await release('analog');assert.equal(await primary.locator('[data-spatial-node]').getAttribute('data-spatial-node'),'inside');
   await drive('analog',1);await primary.locator('[data-spatial-playback="forward"] canvas').waitFor();await page.waitForTimeout(1300);await release('analog');assert.equal(await primary.locator('[data-spatial-node]').getAttribute('data-spatial-node'),'inside');await drive('analog',-1);await at('acted-2');await release('analog');await primary.getByRole('button',{name:'Next action step'}).waitFor();await primary.locator('[data-spatial-playback="forward"] canvas').waitFor();assert.equal(await primary.locator('.spatial-drive-control').isVisible(),false);await at('inside');assert.equal(await primary.locator('[data-spatial-action-navigation]').count(),0);assert.equal(await primary.locator('.spatial-drive-control').isVisible(),true);
  });
  await check('preview reload reads labels saved before publication',async()=>{
   labels={A:{act:'Pick up'}};await visit('mode=preview&labels=1');await jump('moved');await primary.getByText('Pick up',{exact:true}).waitFor();
   await page.screenshot({path:output+'/label-light.png'});
  });
  await check('creation stays focused on authoring without post-production label controls',async()=>{
   await visit('mode=creation&labels=1&savedLabel=1');await jump('moved');
   assert.equal(await primary.getByRole('button',{name:'Save action labels'}).count(),0);
   assert.equal(await primary.getByRole('button',{name:'Edit action label'}).count(),0);
   assert.equal(await primary.locator('[data-spatial-action-label]').count(),0);
  });
  await check('a fresh feed document replaces older locally saved labels',async()=>{
   labels={};await visit('mode=feed&labels=1');await jump('moved');await editMode();await edit('Strike');await primary.getByRole('button',{name:'Save action labels'}).click();await primary.getByRole('button',{name:'Save action labels'}).waitFor({state:'hidden'});
   await page.evaluate(revision=>window.refreshLabels({A:{act:'Sit'}},revision),labelRevision+1);await at('root');await jump('moved');assert.equal(await primary.locator('[data-spatial-action-label]').innerText(),'Sit');
   assert.equal(await page.evaluate(()=>window.testStore.getState().spatialLabels.saved[42].A.act),'Sit');
  });
  await check('dark action button is white with a black border; label retains black glass and white text',async()=>{
   labels={A:{act:'Strike'}};await visit('mode=preview&labels=1&theme=dark');await jump('moved');await primary.getByText('Strike',{exact:true}).waitFor();
   await page.mouse.move(1100,700);
   for(const selector of ['.spatial-interaction-button','[data-spatial-action-label]']) {
    const style=await primary.locator(selector).evaluate(el=>{const s=getComputedStyle(el);return{background:s.backgroundColor,border:s.borderColor,color:s.color,glass:s.backdropFilter};});
    if(selector==='.spatial-interaction-button'){assert.equal(style.background,'rgb(255, 255, 255)');assert.equal(style.border,'rgb(0, 0, 0)');assert.equal(style.color,'rgb(17, 17, 17)');}
    else {assert.equal(style.background,'rgba(8, 10, 16, 0.72)');assert.equal(style.border,'rgba(255, 255, 255, 0.48)');assert.equal(style.color,'rgb(255, 255, 255)');assert.equal(style.glass,'blur(16px)');}
   }
   await page.screenshot({path:output+'/label-dark.png'});
  });
  await check('small-screen label pill stays inside the video above its action button',async()=>{
   labels={A:{act:'Pick up'}};await visit('mode=preview&labels=1');await primary.evaluate(el=>{el.style.width='320px';el.style.height='560px';});await jump('moved');await primary.getByText('Pick up',{exact:true}).waitFor();
   const surface=await primary.boundingBox(),pill=await primary.locator('[data-spatial-action-label]').boundingBox(),action=await primary.locator('.spatial-interaction-button').boundingBox();assert.ok(pill.x>=surface.x&&pill.x+pill.width<=surface.x+surface.width+.1);assert.ok(pill.y+pill.height<action.y);
   await page.screenshot({path:output+'/label-small.png'});
  });
  await check('light/dark donut and directional controls use theme surfaces and app highlight',async()=>{
   for(const theme of ['light','dark'])for(const control of ['hover','dpad','analog']) {
    await visit('mode=feed&control='+control+'&theme='+theme);const pad=primary.locator('.spatial-drive-control');
    if(control==='hover'){const style=await pad.locator('.spatial-drive-hover-arrow').nth(1).evaluate(el=>getComputedStyle(el).color);assert.equal(style,theme==='light'?'rgb(17, 17, 17)':'rgb(255, 255, 255)');const ring=await pad.evaluate(el=>[...el.children].find(child=>child.style.border?.includes('solid'))?.style.border);assert.ok(ring.includes(theme==='light'?'255, 255, 255':'8, 10, 16'));}
    if(control==='dpad'){const right=pad.locator('[data-drive-direction="right"]');await right.dispatchEvent('pointerdown',{pointerId:1,isPrimary:true,button:0});await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-test-primary] [data-drive-direction="right"]')).backgroundColor==='rgb(64, 89, 204)');assert.equal(await right.evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(64, 89, 204)');await right.dispatchEvent('pointerup',{pointerId:1,isPrimary:true,button:0});}
    if(control==='analog'){assert.ok((await pad.evaluate(el=>el.style.background)).includes(theme==='light'?'255, 255, 255':'16, 18, 24'));}
    await page.screenshot({path:output+'/'+theme+'-'+control+'.png'});
   }
  });
  await check('withheld compositor callbacks recover through a decoded seek without timeout banners',async()=>{
   await visit('mode=feed');await page.evaluate(async()=>{const {spatialVideoRamCache}=await import('/src/spatialVideoCache.ts');const acquire=spatialVideoRamCache.acquirePlayback.bind(spatialVideoRamCache);spatialVideoRamCache.acquirePlayback=url=>{const lease=acquire(url);if(lease){lease.video.requestVideoFrameCallback=()=>1;lease.video.cancelVideoFrameCallback=()=>{};}return lease;};});
   await hold(1);await page.waitForFunction(()=>{const v=document.querySelector('[data-test-primary] [data-spatial-playback] video');return v?.style.visibility==='visible'&&v.currentTime>.1;});assert.equal(await primary.getByRole('alert').count(),0);await page.mouse.up();
  });
  for(const format of ['legacy','world']) await check(format+': repeated video playback reuses the cached element without another media request',async()=>{
   await visit('mode=feed'+(format==='world'?'&world=1':''));await page.waitForFunction(async()=>{const {spatialVideoRamCache}=await import('/src/spatialVideoCache.ts');return spatialVideoRamCache.isReady('/sample.mp4?move');});
   await page.evaluate(async()=>{const {spatialVideoRamCache}=await import('/src/spatialVideoCache.ts');window.__cachedMove=spatialVideoRamCache.playbackElement('/sample.mp4?move');});
   const before=mediaRequests.filter(url=>url==='/sample.mp4?move').length;
   for(let repeat=0;repeat<3;repeat++) {
    await hold(1);await page.waitForFunction(()=>{const v=document.querySelector('[data-test-primary] [data-spatial-playback] video');return v?.style.visibility==='visible'&&v.currentTime>.1;});await page.mouse.up();
    assert.equal(await primary.locator('[data-spatial-playback] video').evaluate(v=>v===window.__cachedMove),true);
    await page.evaluate(()=>window.test.player.current.home());await at('root');await page.waitForFunction(()=>!document.querySelector('[data-test-primary] [data-spatial-playback] video'));
   }
   assert.equal(mediaRequests.filter(url=>url==='/sample.mp4?move').length,before,'warm playback refetched its video');
  });
  await check('feed failures show no errors and remain retryable using normal controls',async()=>{
   await visit('mode=feed');await hold(1);await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime>.1);await page.mouse.up();await primary.locator('[data-spatial-playback] video').evaluate(v=>v.dispatchEvent(new Event('error')));
   await page.waitForFunction(()=>!document.querySelector('[data-test-primary] [data-spatial-playback] video'));assert.equal(await primary.getByRole('alert').count(),0);assert.equal(await primary.getByText('media-error',{exact:false}).count(),0);assert.equal(await primary.getByRole('button',{name:'Retry clip',exact:true}).count(),0);
   await hold(1);await page.waitForFunction(()=>document.querySelector('[data-test-primary] [data-spatial-playback] video')?.style.visibility==='visible');await page.mouse.up();assert.equal(await primary.getByRole('alert').count(),0);
  });
  assert.deepEqual(errors,[]);fs.writeFileSync(output+'/report.json',JSON.stringify({results,failures,errors},null,2));if(failures.length)throw Error(failures.length+' checks failed');console.log(JSON.stringify({passed:results.length,output}));
 } finally {await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

