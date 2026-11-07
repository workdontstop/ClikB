const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const root=path.resolve(__dirname,'..').replaceAll('\\','/'),output=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'spatial-action-check-'));
  const {createServer}=await import(pathToFileURL(root+'/node_modules/vite/dist/node/index.js'));
  const server=await createServer({root,configFile:false,logLevel:'error',cacheDir:output+'/vite',optimizeDeps:{entries:['tests/spatialStudio.responsive.tsx']},esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port:5195,strictPort:true,hmr:false},plugins:[{name:'fixture',configureServer(server){server.middlewares.use((req,res,next)=>{
    if(req.url.startsWith('/__test')){res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#111}</style><div id="root"></div><script type="module" src="/tests/spatialStudio.responsive.tsx"></script>');}else next();
  });}}]});await server.listen();
  const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME});
  try{
    const page=await browser.newPage({viewport:{width:740,height:960}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:5195/')?route.continue():route.abort());
    const saved=()=>page.locator('html').getAttribute('data-saved-scene').then(JSON.parse);
    if(!process.env.SPATIAL_CHECKPOINT_ONLY){
    for(const duration of [5,10]){
      await page.goto(`http://127.0.0.1:5195/__test?w=740&h=920&ready=1&actionOrigin=1&stateContext=1&actionHost=1&exportReady=1&notices=1&duration=${duration}`);
      await page.getByRole('button',{name:'Create a spatial action',exact:true}).click();
      const cancel=page.getByRole('button',{name:'Cancel action',exact:true});await cancel.waitFor();
      await page.evaluate(()=>{document.documentElement.dataset.trackPosition='true';window.__fixturePositions=[];});
      await page.getByRole('button',{name:'Generate action reference',exact:true}).click();
      const save=page.getByRole('button',{name:'Save motion',exact:true});await save.waitFor();
      await page.waitForFunction(()=>document.querySelector('button')&&[...document.querySelectorAll('button')].some(button=>button.textContent==='Save motion'&&!button.disabled),null,{timeout:20000});
      const positions=await page.evaluate(()=>window.__fixturePositions);
      const context=JSON.parse(await page.locator('html').getAttribute('data-plan-state-context'));
      assert.equal(context.image,'https://assets.test/actual-cup.png');assert.match(context.currentStateContext.primaryMotion,/cup held/);
      assert.ok(positions.length>15,'no rendered action frames observed');
      assert.ok(positions.every(p=>Math.abs(p[0]-3)<.01&&Math.abs(p[2]+2)<.01),'action teleported away from current cup position: '+JSON.stringify(positions.filter(p=>Math.abs(p[0]-3)>=.01||Math.abs(p[2]+2)>=.01).slice(0,12)));
      assert.equal(await page.locator('[data-spatial-info-pill]').count(),0);
      assert.equal(await page.getByText(/Use the EditStory action prompt|Your instructions and recording are kept/).count(),0);
      const before=await saved();assert.equal(before.activeNodeId,'beside');assert.equal(before.ledger.draft.kind,'action');
      await page.getByRole('button',{name:'Try again · Metered P'}).click();
      await page.getByText(`Playing preview · ${duration}s`).waitFor();
      assert.equal(await cancel.isEnabled(),true,'cannot cancel while previewing a bad retry');
      await cancel.click();await cancel.waitFor({state:'hidden'});
      const cancelled=await saved();assert.equal(cancelled.ledger.draft,undefined);assert.equal(cancelled.activeNodeId,'beside');
      assert.deepEqual(cancelled.connections,before.connections);assert.deepEqual(cancelled.ledger.routes,before.ledger.routes);
      assert.deepEqual(cancelled.ledger.states,before.ledger.states);assert.deepEqual(cancelled.ledger.jobs,before.ledger.jobs);
      assert.equal(await page.getByRole('button',{name:'Preview action',exact:true}).count(),0);
      await page.getByRole('button',{name:'Create a spatial action',exact:true}).click();
      await page.getByRole('button',{name:'Generate action reference',exact:true}).click();
      await save.waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Save motion'&&!button.disabled),null,{timeout:20000});
      await save.click();await save.waitFor({state:'hidden'});
      const result=await saved(),action=result.connections.find(edge=>edge.kind==='action');
      assert.equal(action.sourceNodeId,'beside');assert.equal(result.ledger.routes[action.id].forward.plan.duration,duration);
      assert.deepEqual(result.ledger.states[action.targetNodeId].objects.girl.transform.position,[3,.5,-2]);
      await page.screenshot({path:`${output}/saved-action-${duration}s.png`});
      console.log(`PASS ${duration}s: every rendered frame stays at moved source; cancel a retry preserves saved graph; re-enter and save from same node`);
    }
    for(const light of [0,1]){
      await page.goto(`http://127.0.0.1:5195/__test?w=740&h=920&ready=1&actionHost=1&networkFail=1&light=${light||''}`);
      await page.getByRole('button',{name:'Create a spatial action',exact:true}).click();
      await page.getByRole('button',{name:'Generate action reference',exact:true}).click();
      await page.getByText('Connection interrupted. Please try again.',{exact:true}).waitFor();
      assert.equal(await page.getByText('read ECONNRESET',{exact:true}).count(),0);
      const retry=page.getByRole('button',{name:'Try again · Metered P'});
      const style=await retry.evaluate(el=>({border:getComputedStyle(el).borderWidth,gradient:getComputedStyle(el).backgroundImage,color:getComputedStyle(el).color}));
      assert.equal(style.border,'2px');assert.equal(style.color,light?'rgb(0, 0, 0)':'rgb(255, 255, 255)');
      assert.ok(style.gradient.includes('linear-gradient'));
      await page.getByRole('button',{name:'Cancel action'}).click();
      await page.getByRole('button',{name:'Create a spatial action',exact:true}).click();
      const settings=page.getByRole('button',{name:'Spatial mode settings'}),link=page.getByRole('button',{name:'Link',exact:true});
      assert.equal(await link.evaluate(el=>getComputedStyle(el).backgroundImage),await settings.evaluate(el=>getComputedStyle(el).backgroundImage));
      assert.equal(await link.evaluate(el=>getComputedStyle(el).borderWidth),'2px');
      console.log(`PASS ${light?'light':'dark'}: plain-language blocking error, neutral Settings-style controls, two-tone retry and thicker border`);
    }
    await page.goto('http://127.0.0.1:5195/__test?w=740&h=920&ready=1&board=1&mappedBoard=1&modelHost=1');
    const models=page.getByRole('group',{name:'Spatial video models'});await models.waitFor();
    await page.getByRole('button',{name:'Continue mapping',exact:true}).click();assert.equal(await models.count(),0);
    await page.getByRole('button',{name:'Motion videos',exact:true}).click();await models.waitFor();
    await page.getByRole('button',{name:/Generate all/}).click();
    const quote=page.getByRole('dialog',{name:'Generate 2 motion videos'});await quote.waitFor();await models.waitFor();
    assert.equal(await models.getByRole('button').count(),5);
    const dropdown=quote.getByRole('combobox',{name:'Video generation model'});
    await dropdown.click();await page.getByRole('option',{name:/Seedance 2.0 Mini/}).click();
    await page.waitForFunction(()=>document.querySelector('[aria-label="Spatial video models"] button[aria-pressed="true"]')?.textContent==='SeedanceMini');
    await models.getByRole('button',{name:'pPro',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('input[value="pPro"]'));
    assert.ok((await dropdown.textContent()).includes('2.5'));
    await quote.getByRole('button',{name:'Cancel',exact:true}).click();await quote.waitFor({state:'hidden'});assert.equal(await models.count(),1);
    await page.getByRole('button',{name:'Continue mapping',exact:true}).click();assert.equal(await models.count(),0);
    console.log('PASS host selection: models hidden during authoring; only five supported; dropdown and right-side selection synchronized both ways');
    }
    for(const control of ['analog','dpad']){
      await page.goto('http://127.0.0.1:5195/__test?w=740&h=920&ready=1&checkpointSetup=1&links=1');
      await page.getByRole('slider').waitFor();
      if(control==='dpad')await page.getByRole('slider').dblclick();
      const hold=async(direction)=>{
        if(control==='dpad'){const button=page.getByRole('button',{name:direction>0?/^Move forward;/:/^Move backward;/});await button.hover();await page.mouse.down();}
        else{const box=await page.getByRole('slider').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y+box.height/2-direction*48,{steps:4});}
      };
      await hold(1);await page.waitForFunction(()=>JSON.parse(document.documentElement.dataset.savedScene||'{}').activeNodeId==='cup',{},{timeout:8000}).catch(async error=>{
        console.log('Checkpoint diagnostic',await page.evaluate(()=>({text:document.body.innerText,saved:document.documentElement.dataset.savedScene,playback:document.querySelector('[data-spatial-playback]')?.outerHTML,events:window.__spatialDiagnostics?.entries()})));
        console.log('Runtime errors',errors);await page.screenshot({path:`${output}/checkpoint-failure.png`});throw error;
      });
      const action=page.getByRole('button',{name:'Play spatial action',exact:true});await action.waitFor();
      const started=Date.now();await page.waitForTimeout(400);assert.equal((await saved()).activeNodeId,'cup','held input skipped action pause');
      await action.waitFor({state:'hidden',timeout:4000});assert.ok(Date.now()-started>=1450,'action pause shorter than two seconds');
      await page.waitForFunction(()=>JSON.parse(document.documentElement.dataset.savedScene||'{}').activeNodeId==='after');await page.mouse.up();
      assert.equal(await action.count(),0,'action persisted past its node');
      await hold(-1);await page.waitForFunction(()=>JSON.parse(document.documentElement.dataset.savedScene||'{}').activeNodeId==='cup');await action.waitFor();
      await page.waitForTimeout(400);assert.equal((await saved()).activeNodeId,'cup','backward input skipped action pause');
      await action.waitFor({state:'hidden',timeout:4000});await page.waitForFunction(()=>JSON.parse(document.documentElement.dataset.savedScene||'{}').activeNodeId==='root');await page.mouse.up();
      assert.equal(await action.count(),0);console.log(`PASS creation ${control}: forward and backward two-second action checkpoint; button hidden during movement and absent past the cup`);
    }
    assert.deepEqual(errors,[]);console.log('Screenshots: '+output);
  }finally{await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
