const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..').replaceAll('\\','/'),output=path.join(root,'.tmp/mvp-ui-browser');fs.mkdirSync(output,{recursive:true});
 const {createServer}=await import(pathToFileURL(root+'/node_modules/vite/dist/node/index.js'));
 const server=await createServer({root,configFile:false,logLevel:'error',cacheDir:output+'/vite',esbuild:{jsx:'automatic'},resolve:{alias:{react:root+'/node_modules/react','react-dom':root+'/node_modules/react-dom'}},server:{host:'127.0.0.1',port:5209,strictPort:true,hmr:false,watch:null},plugins:[{name:'mvp-fixture',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url.startsWith('/__test')){res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#111}</style><div id="root"></div><script type="module" src="/tests/spatialMvp.browser.tsx"></script>');}else if(req.url.startsWith('/fixture/')){res.statusCode=204;res.end();}else next();});}}]});
 await server.listen();const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME});const page=await browser.newPage({viewport:{width:780,height:760}}),errors=[],passed=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:5209/')||route.request().url().startsWith('data:')?route.continue():route.abort());
 const visit=async query=>{await page.setViewportSize({width:Number(new URLSearchParams(query).get('w')||390),height:760});await page.goto('http://127.0.0.1:5209/__test?'+query);await page.locator('[data-spatial-authoring]').waitFor();};
 const snap=()=>page.evaluate(()=>window.mvp.snapshot());const requests=action=>page.evaluate(action=>window.mvp.requests.filter(body=>body.action===action),action);
 const visible=async(selector,expected)=>assert.equal(await page.locator(selector).isVisible(),expected);
 async function check(name,fn){await fn();passed.push(name);console.log('PASS '+name);await page.screenshot({path:output+'/'+passed.length+'.png'});}
 try{
  await check('action settings use planning tiers, hide movement controls, and retain prior action across planning/save failures',async()=>{
   await visit('w=390&h=660');await visible('.spatial-drive-control',true);
   await page.getByRole('button',{name:'Create a spatial action',exact:true}).click();await visible('.spatial-drive-control',false);
   for(const name of ['Try controls','Rotate horizontally','Rotate vertically','Roll','Rise','Descend'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),0);
   const settings=page.getByRole('dialog',{name:'Action settings',exact:true});await settings.waitFor();
   await settings.getByRole('button',{name:'Terra',exact:true}).click();await settings.getByLabel('Action instructions').fill('Wave gently');
   assert.equal(await settings.evaluate(element=>element.scrollWidth>element.clientWidth+2),false,'mobile action settings overflow horizontally');await page.screenshot({path:output+'/action-settings.png'});
   await page.evaluate(()=>window.mvp.delayPlan=true);await settings.getByRole('button',{name:/^Create action/}).click();await page.waitForFunction(()=>window.mvp.requests.some(body=>body.operation==='action'));
   assert.equal(await settings.getByRole('button',{name:'Luna',exact:true}).isDisabled(),true);
   await page.waitForFunction(()=>!!window.mvp.snapshot().scene.ledger.draft?.forward);await page.getByRole('button',{name:'Save action',exact:true}).waitFor();
   await page.waitForFunction(()=>!document.querySelector('[data-spatial-authoring]').textContent.includes('Playing preview'));
   const original=(await snap()).scene.ledger.draft.forward;
   await page.getByRole('button',{name:'Action settings',exact:true}).click();await settings.getByLabel('Action correction').fill('Use the other hand');await page.evaluate(()=>window.mvp.failPlan=true);
   await settings.getByRole('button',{name:/^Apply changes/}).click();await settings.getByText('Fixture action correction failed',{exact:true}).waitFor();assert.deepEqual((await snap()).scene.ledger.draft.forward,original);assert.equal(await settings.getByLabel('Action correction').inputValue(),'Use the other hand');
   await page.evaluate(()=>window.mvp.failSave=true);await settings.getByRole('button',{name:/^Apply changes/}).click();await settings.getByText('Fixture action save failed',{exact:true}).waitFor();assert.deepEqual((await snap()).scene.ledger.draft.forward,original);
   await settings.getByRole('button',{name:/^Apply changes/}).click();await page.waitForFunction(()=>window.mvp.snapshot().scene.ledger.draft.forward.plan.objects[0].keys.at(-1).rotation[2]===.3);
   const body=await page.evaluate(()=>window.mvp.requests.filter(b=>b.operation==='action').at(-1));assert.deepEqual(body.existingPlan,original.plan);assert.deepEqual(body.sourceState,original.sourceState);assert.equal(body.correction,'Use the other hand');assert.equal(body.llmTier,'terra');
   await page.waitForFunction(()=>!document.querySelector('[data-spatial-authoring]').textContent.includes('Playing preview'));
   assert.equal(await page.getByRole('button',{name:'Save action',exact:true}).isDisabled(),false,'correction prompt disabled saving');
   await page.getByRole('button',{name:'Reopen editor',exact:true}).click();await page.getByRole('button',{name:'Save action',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Save action',exact:true}).isDisabled(),false,'reopening reset the corrected action prompt');
   await page.getByRole('button',{name:'Action settings',exact:true}).click();assert.equal(await settings.getByLabel('Action correction').inputValue(),'');
   await page.getByRole('button',{name:'Close action settings',exact:true}).click();await page.getByRole('button',{name:'Cancel action',exact:true}).click();await visible('.spatial-drive-control',true);
  });
  await check('each result loads saved sound settings; toggles do not submit or change siblings',async()=>{
   await visit('board=1&w=390&h=660');await page.getByRole('button',{name:'Motion 1 · Movement',exact:true}).click();const forwardAudio=page.getByRole('checkbox',{name:'Forward sound Audio',exact:true}),forwardMusic=page.getByRole('checkbox',{name:'Forward sound Music',exact:true});
   assert.equal(await forwardAudio.isChecked(),false);assert.equal(await forwardMusic.isDisabled(),true);await forwardAudio.check();await forwardMusic.check();
   assert.equal((await requests('regenerate')).length,0);assert.equal((await snap()).scene.ledger.jobs[0].options.audio,false);
   await page.getByRole('tab',{name:'Backward',exact:true}).click();assert.equal(await page.getByRole('checkbox',{name:'Backward sound Audio',exact:true}).isChecked(),true);assert.equal(await page.getByRole('checkbox',{name:'Backward sound Music',exact:true}).isChecked(),false);
   await page.getByRole('tab',{name:'Forward',exact:true}).click();assert.equal(await forwardMusic.isChecked(),true);
   await page.getByRole('button',{name:/^Regenerate this direction/}).click();const review=page.getByRole('dialog',{name:'Regenerate this direction?',exact:true});await review.getByRole('button',{name:/Confirm · 83 P/}).click();await page.waitForFunction(()=>window.mvp.requests.some(b=>b.action==='regenerate'));
   const calls=await requests('regenerate');assert.equal(calls.length,1);assert.deepEqual(calls[0].jobIds,['edge:forward']);assert.deepEqual(calls[0].options,{model:'SeedanceMini',resolution:'480p',aspect:'9:16',audio:true,music:true});assert.equal((await snap()).scene.ledger.jobs[1].options.music,false);
  });
  await check('Regenerate both from Backward confirms one combined quote and applies its settings to the pair',async()=>{
   await visit('board=1&w=740&h=660');await page.getByRole('button',{name:'Motion 1 · Movement',exact:true}).click();await page.getByRole('tab',{name:'Backward',exact:true}).click();await page.getByRole('checkbox',{name:'Backward sound Music',exact:true}).check();
   await page.getByRole('button',{name:/^Regenerate both/}).click();const review=page.getByRole('dialog',{name:'Regenerate both directions?',exact:true});await review.getByRole('button',{name:/Confirm · 166 P/}).waitFor();assert.equal((await requests('regenerate')).length,0);
   assert.equal(await review.getByRole('checkbox',{name:'Both directions sound Music',exact:true}).isChecked(),true);await review.getByRole('button',{name:/Confirm · 166 P/}).click();await page.waitForFunction(()=>window.mvp.requests.some(b=>b.action==='regenerate'));
   const calls=await requests('regenerate');assert.equal(calls.length,1);assert.deepEqual(calls[0].jobIds,['edge:forward','edge:backward']);assert.equal(calls[0].pixels,166);assert.equal(calls[0].confirmation,'edge:forward,edge:backward');assert.ok(calls[0].quoteKey);assert.equal(calls[0].options.music,true);
  });
  await check('failed retry starts from the failed clip sound choices and leaves the ready direction alone',async()=>{
   await visit('board=1&retry=1&w=390&h=660');await page.getByRole('button',{name:'Motion 1 · Movement',exact:true}).click();await page.getByRole('tab',{name:'Backward',exact:true}).click();await page.getByRole('button',{name:/^Retry backward/}).click();const review=page.getByRole('dialog',{name:'Retry failed clips?',exact:true});
   assert.equal(await review.getByRole('checkbox',{name:'Backward sound Audio',exact:true}).isChecked(),true);assert.equal(await review.getByRole('checkbox',{name:'Backward sound Music',exact:true}).isChecked(),false);await review.getByRole('button',{name:/Confirm · 83 P/}).click();await page.waitForFunction(()=>window.mvp.requests.some(b=>b.action==='retry'));
   assert.equal((await requests('retry'))[0].options.audio,true);assert.equal((await snap()).scene.ledger.jobs[0].options.audio,false);
  });
  await check('initial quote defaults Audio and Music on; silence disables Music and hides host duration',async()=>{
   await visit('board=1&empty=1&w=390&h=660');await page.getByRole('button',{name:'Generate all',exact:true}).click();const quote=page.getByRole('dialog',{name:/^Generate [0-9]+ motion video/});await quote.getByRole('checkbox',{name:'Spatial sound Audio',exact:true}).waitFor();
   assert.equal(await quote.getByRole('checkbox',{name:'Spatial sound Audio',exact:true}).isChecked(),true);assert.equal(await quote.getByRole('checkbox',{name:'Spatial sound Music',exact:true}).isChecked(),true);await quote.getByRole('checkbox',{name:'Spatial sound Audio',exact:true}).uncheck();assert.equal(await quote.getByRole('checkbox',{name:'Spatial sound Music',exact:true}).isDisabled(),true);assert.equal(await page.locator('[data-fixture-duration]').isVisible(),false);assert.equal((await requests('start')).length,0);
  });
  assert.deepEqual(errors,[]);fs.writeFileSync(output+'/report.json',JSON.stringify({passed,errors,localOnly:true},null,2));console.log(JSON.stringify({passed:passed.length,output}));
 }catch(error){await page.screenshot({path:output+'/failure.png'});fs.writeFileSync(output+'/failure.txt',String(error)+'\n'+await page.locator('body').innerText());throw error;}finally{await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
