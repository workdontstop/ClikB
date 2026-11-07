const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
    const root=path.resolve(__dirname,'..').replaceAll('\\','/'),output=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'spatial-workflow-'));
    const {createServer}=await import(pathToFileURL(root+'/node_modules/vite/dist/node/index.js'));
    const server=await createServer({root,configFile:false,logLevel:'error',cacheDir:output+'/vite',optimizeDeps:{entries:['index.html','tests/spatialStudio.responsive.tsx']},esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port:5194,strictPort:true,hmr:false},plugins:[{name:'fixture',configureServer(server){server.middlewares.use((req,res,next)=>{
        if(req.url.startsWith('/fixture/')&&req.url.endsWith('.mp4')&&process.env.SPATIAL_TEST_VIDEO){res.setHeader('Content-Type','video/mp4');fs.createReadStream(process.env.SPATIAL_TEST_VIDEO).pipe(res);return;}
        if(req.url.startsWith('/__test')){res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#111}</style><div id="root"></div><script type="module" src="/tests/spatialStudio.responsive.tsx"></script>');}else next();
    });}}]});await server.listen();
    const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME});
    const errors=[];
    try{
        const page=await browser.newPage({viewport:{width:390,height:700}});
        page.on('pageerror',error=>errors.push(error.message));
        await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:5194/')?route.continue():route.abort());
        const saved=()=>page.locator('html').getAttribute('data-saved-scene').then(JSON.parse);
        const generationCalls=()=>page.locator('html').getAttribute('data-generation-calls').then(value=>JSON.parse(value||'{}'));
        const controlMode=async(controller,mode)=>{
            await controller.waitFor();
            for(let attempt=0;attempt<3 && await controller.getAttribute('data-control-mode')!==mode;attempt++){
                if(await controller.getAttribute('data-control-mode')==='dpad')await controller.getByRole('button',{name:/^Move forward;/}).dblclick();
                else await controller.dblclick();
            }
            assert.equal(await controller.getAttribute('data-control-mode'),mode,`controller did not enter ${mode} mode`);
        };
        if(process.env.SPATIAL_AUDIO_ONLY==='1') {
            await page.goto('http://127.0.0.1:5194/__test?w=390&h=660&ready=1&board=1&mappedBoard=1&enableStart=1&modelHost=1&audioToggle=1&audioOn=1',{waitUntil:'domcontentloaded',timeout:60000});
            const board=page.getByRole('dialog',{name:'Spatial generation board'});await board.waitFor();
            await page.getByRole('group',{name:'Spatial video models'}).getByRole('button',{name:'SeedanceMini',exact:true}).click();
            await board.getByRole('button',{name:'Generate all',exact:true}).click();
            const quote=page.getByRole('dialog',{name:'Generate 2 motion videos',exact:true});await quote.waitFor();
            await quote.getByRole('button',{name:'Confirm · 166 P',exact:true}).click();
            await page.waitForFunction(()=>JSON.parse(document.documentElement.dataset.submittedAudio||'{}').forward===true);
            await page.getByRole('button',{name:'Fixture audio toggle',exact:true}).click();
            assert.equal(await page.getByRole('button',{name:'Fixture audio toggle',exact:true}).getAttribute('aria-pressed'),'false');
            await page.evaluate(async()=>{
                const {spatialOperation,spatialSession}=await import('/src/spatialWorldClient.ts');
                await spatialOperation(spatialSession('/fixture',-100,'responsive'),'complete',{epoch:1,jobId:'edge:forward',endFrame:'https://assets.test/actual-end.png'});
            });
            await page.waitForFunction(()=>JSON.parse(document.documentElement.dataset.submittedAudio||'{}').backward===true);
            assert.deepEqual(JSON.parse(await page.locator('html').getAttribute('data-submitted-audio')),{forward:true,backward:true});
            assert.equal((await generationCalls()).start,1);assert.equal((await generationCalls()).retry,undefined);
            assert.deepEqual(errors,[]);console.log('PASS batch sound choices persist through forward and backward submission after an unrelated host audio toggle changes');
            return;
        }
        if(process.env.SPATIAL_SKIP_CAPTURE!=='1' && process.env.SPATIAL_EVIDENCE_ONLY!=='1') {
        for(const [mode,interruption] of [['analog','release'],['analog','blur'],['dpad','pointercancel'],['analog','lostpointercapture'],['dpad','escape'],['analog','cancel']]){
            await page.goto('http://127.0.0.1:5194/__test?w=390&h=660&ready=1&workflow=1',{waitUntil:'domcontentloaded',timeout:60000});
            const controller=page.locator('.spatial-drive-control');await controller.waitFor();
            await controlMode(controller,mode);
            await page.getByRole('button',{name:'Add motion',exact:true}).click();
            const bounds=await controller.boundingBox(),x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
            if(mode==='dpad'){await page.getByRole('button',{name:/^Move right;/}).hover();await page.mouse.down();}
            else{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+bounds.width*.4,y);}
            await page.waitForTimeout(450);
            await page.getByText(/Recording ·/).waitFor({timeout:10000}).catch(async error=>{
                await page.screenshot({path:`${output}/capture-${mode}-${interruption}.png`});
                console.error('Capture diagnostics', {mode,interruption,status:await page.getByRole('status').allTextContents(),buttons:await page.getByRole('button').allTextContents(),screenshot:`${output}/capture-${mode}-${interruption}.png`});
                throw error;
            });
            await page.getByRole('button',{name:'Cancel recording',exact:true}).waitFor();
            if(interruption==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
            else if(interruption==='cancel')await page.getByRole('button',{name:'Cancel recording',exact:true}).evaluate(button=>button.click());
            else if(interruption==='escape')await controller.press('Escape');
            else if(interruption!=='release')await controller.evaluate((element,type)=>element.dispatchEvent(new PointerEvent(type,{pointerId:1,bubbles:true})),interruption);
            await page.mouse.up();
            const paused=page.getByText(/Mapping paused .*s left/);
            let pausedText;
            if(interruption!=='cancel'){await paused.waitFor();pausedText=await paused.textContent();}
            await page.waitForTimeout(5100);
            assert.equal((await saved()).ledger.draft,undefined,`${mode} ${interruption} saved an unfinished recording`);
            assert.equal(await page.getByText(/Recording ·/).count(),0,`${mode} ${interruption} left a countdown`);
            if(interruption!=='cancel'){
                assert.equal(await paused.textContent(),pausedText,`${mode} ${interruption} consumed recording time while paused`);
                await page.getByRole('button',{name:'Finish recording',exact:true}).waitFor();
                await page.getByRole('button',{name:'Cancel recording',exact:true}).click();
            }
            assert.equal(await paused.count(),0,`${mode} ${interruption} kept a cancelled recording`);
            assert.equal(await page.getByRole('button',{name:'Add motion',exact:true}).isEnabled(),true);
        }
        await page.goto('http://127.0.0.1:5194/__test?w=390&h=660&ready=1&board=1&mappedBoard=1',{waitUntil:'domcontentloaded',timeout:60000});
        await page.getByRole('button',{name:'Close board',exact:true}).click();
        const matchedController=page.locator('.spatial-drive-control');await controlMode(matchedController,'analog');const matchedBounds=await matchedController.boundingBox();
        const mx=matchedBounds.x+matchedBounds.width/2,my=matchedBounds.y+matchedBounds.height/2;
        await page.mouse.move(mx,my);await page.mouse.down();await page.mouse.move(mx,my-matchedBounds.width*.4);
        await page.locator('[data-spatial-playback="forward"] canvas').waitFor();await page.mouse.up();
        await page.waitForTimeout(5300);
        assert.equal((await saved()).ledger.draft,undefined,'saved route playback started recording without Add motion');
        assert.equal(await page.getByText(/Recording ·/).count(),0,'saved route playback showed a recording countdown');
        await page.goto('http://127.0.0.1:5194/__test?w=390&h=660&ready=1&board=1&mappedBoard=1',{waitUntil:'domcontentloaded',timeout:60000});
        await page.getByRole('button',{name:'Close board',exact:true}).click();
        await controlMode(matchedController,'analog');
        await page.getByRole('button',{name:'Add motion',exact:true}).click();
        await page.mouse.move(mx,my);await page.mouse.down();await page.mouse.move(mx+matchedBounds.width*.4,my);await page.waitForTimeout(350);
        await page.getByText(/Recording ·/).waitFor();
        await page.mouse.move(mx,my-matchedBounds.width*.4);
        await page.waitForTimeout(350);await page.mouse.up();
        assert.equal(await page.locator('[data-spatial-playback="forward"] canvas').count(),0,'Add motion replayed a saved route instead of recording that direction');
        await page.getByText(/Mapping paused .*s left/).waitFor();
        assert.equal((await saved()).ledger.draft,undefined,'release finished recording before Finish recording');
        await page.getByRole('button',{name:'Finish recording',exact:true}).click();
        await page.getByRole('button',{name:'Test recording',exact:true}).waitFor();
        assert.ok((await saved()).ledger.draft,'Add motion did not capture an existing route direction');
        console.log('PASS release/blur/Escape/pointer interruption pause analog/D-pad capture, Cancel discards it, saved routes replay normally, and explicit Add motion records matching directions');
        }
        if(process.env.SPATIAL_CAPTURE_ONLY==='1'){assert.deepEqual(errors,[]);return;}
        if(process.env.SPATIAL_EVIDENCE_ONLY!=='1') {
        await page.goto('http://127.0.0.1:5194/__test?w=390&h=660&ready=1&board=1&mappedBoard=1&enableStart=1&modelHost=1',{waitUntil:'domcontentloaded',timeout:60000});
        let flow=page.getByRole('dialog',{name:'Spatial generation board'});await flow.waitFor();
        await flow.getByRole('button',{name:'Generate all',exact:true}).click();
        const newQuote=page.getByRole('dialog',{name:'Generate 2 motion videos',exact:true});await newQuote.waitFor();
        assert.equal((await generationCalls()).start,undefined,'opening confirmation submitted generation');
        await newQuote.getByRole('button',{name:'Confirm · 166 P',exact:true}).click();
        await flow.locator('[data-spatial-generating="true"]').waitFor();
        assert.equal((await generationCalls()).start,1);assert.ok((await flow.locator('[data-spatial-generating="true"]').evaluate(el=>getComputedStyle(el).animationName)).includes('spatialMotionGenerating'));
        assert.equal(await flow.getByRole('status').filter({hasText:'Queued'}).count(),1,'no immediate feedback after Confirm');
        await flow.getByRole('status').filter({hasText:'Generating'}).waitFor();
        assert.equal(await flow.getByRole('status').filter({hasText:'Generating'}).count(),1);
        const started=await saved();assert.equal(started.ledger.jobs.length,2);
        assert.equal(await flow.getByRole('button',{name:'Continue mapping',exact:true}).count(),0,'mapping is offered during generation');
        await flow.getByRole('progressbar',{name:'Generating scene videos',exact:true}).waitFor();
        const spinner=flow.getByRole('progressbar',{name:'Generating Motion 1',exact:true});await spinner.waitFor();
        const spinnerSize=await spinner.boundingBox();assert.ok(spinnerSize.width>=28 && spinnerSize.height>=28,'active card spinner collapsed');
        assert.ok((await generationCalls())['prepare-guidance']>=1,'legacy authored intelligence was not prepared before confirmation');
        await flow.getByRole('button',{name:'Close board',exact:true}).click();await flow.waitFor({state:'hidden'});
        assert.equal(await page.getByRole('button',{name:'Continue mapping',exact:true}).count(),0,'closing the board exposed mapping during generation');
        await page.getByRole('button',{name:'Motion videos',exact:true}).click();await flow.waitFor();
        assert.equal(await page.getByRole('dialog',{name:'Generate 0 motion videos',exact:true}).count(),0,'already queued jobs opened zero quote');
        assert.deepEqual((await saved()).ledger.jobs,started.ledger.jobs);assert.equal((await generationCalls()).start,1);
        await page.screenshot({path:`${output}/generating-grid.png`});
        console.log('PASS Confirm queues once with immediate app-colour loaders; Continue mapping hidden while active, board close/reopen preserves requests');

        await page.goto('http://127.0.0.1:5194/__test?w=390&h=660&ready=1&board=1&failedChain=1&videoView=1&modelHost=1&localUploads=1&exportReady=1&workflow=1',{waitUntil:'domcontentloaded',timeout:60000});
        flow=page.getByRole('dialog',{name:'Spatial generation board'});await flow.waitFor();
        const failed=await saved();assert.equal(failed.ledger.jobs[0].status,'failed');
        assert.equal(await flow.getByRole('button',{name:'Generate all',exact:true}).count(),0);
        await page.getByRole('group',{name:'Spatial video models'}).getByRole('button',{name:'Pro',exact:true}).click();
        assert.equal(await flow.getByRole('combobox',{name:'Model'}).textContent(),'Seedance 2.0');
        await flow.getByRole('combobox',{name:'Resolution'}).click();await page.getByRole('option',{name:'720p',exact:true}).click();
        await flow.getByRole('button',{name:'Retry Motion 1 forward',exact:true}).click();
        const retry=page.getByRole('dialog',{name:'Retry failed clips?',exact:true});await retry.waitFor();
        assert.equal(await retry.getByRole('button',{name:'Confirm · 366 P',exact:true}).count(),1);
        await retry.getByRole('button',{name:'Cancel',exact:true}).click();await retry.waitFor({state:'hidden'});
        assert.deepEqual((await saved()).ledger.jobs,failed.ledger.jobs);assert.equal((await generationCalls()).retry,undefined);
        await flow.getByRole('button',{name:'Close board',exact:true}).click();await flow.waitFor({state:'hidden'});
        const appearance=await page.locator('[data-spatial-appearance-frame]').getAttribute('data-spatial-appearance-frame');
        assert.equal(appearance,failed.ledger.world.sourceImage,'image view shows proxy instead of real appearance');
        await page.getByRole('button',{name:'Continue mapping',exact:true}).click();await page.getByRole('button',{name:'Add motion',exact:true}).waitFor();
        assert.equal((await saved()).ledger.view,'three');assert.equal((await generationCalls()).start,undefined);
        await page.getByRole('button',{name:'Motion videos',exact:true}).click();await flow.waitFor();
        assert.equal(await flow.getByRole('button',{name:'Open failed motion',exact:true}).count(),0);
        await flow.getByRole('button',{name:'Retry Motion 1 forward',exact:true}).click();await retry.waitFor();
        await retry.getByRole('button',{name:'Confirm · 366 P',exact:true}).click();
        await page.waitForFunction(()=>document.documentElement.dataset.retriedJob==='edge:forward');
        assert.deepEqual(JSON.parse(await page.locator('html').getAttribute('data-retry-settings')),{model:'Pro',resolution:'720p',aspect:'9:16',audio:false});
        assert.equal((await saved()).ledger.jobs[1].pixels,83,'retry changed an unrelated clip cost');
        assert.equal((await generationCalls()).start,undefined);
        await page.screenshot({path:`${output}/retry-grid.png`});
        console.log('PASS failed grid Retry, synchronized selectors and current price, cancellation retains jobs, real image fallback, explicit return to mapping and no automatic new batch');
        await page.waitForTimeout(3300); // Let the fake provider finish; never submit a real request.
        const retainedJobs=(await saved()).ledger.jobs;
        await flow.getByRole('button',{name:'Continue mapping',exact:true}).click();await flow.waitFor({state:'hidden'});
        await controlMode(page.locator('.spatial-drive-control'),'analog');
        await page.getByRole('button',{name:'Add motion',exact:true}).click();
        const appendController=page.getByLabel(/^Spatial analogue drive;/),appendBounds=await appendController.boundingBox();
        const appendX=appendBounds.x+appendBounds.width/2,appendY=appendBounds.y+appendBounds.height/2;
        await page.mouse.move(appendX,appendY);await page.mouse.down();await page.mouse.move(appendX+appendBounds.width*.4,appendY);await page.waitForTimeout(650);await page.mouse.up();
        await page.getByRole('button',{name:'Finish recording',exact:true}).click();
        await page.getByRole('button',{name:'Test recording',exact:true}).waitFor();
        await page.getByRole('button',{name:'Process movement · Metered P',exact:true}).click();
        await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Save motion'&&!button.disabled));
        await page.getByRole('button',{name:'Save motion',exact:true}).click();
        await page.waitForFunction(()=>JSON.parse(document.documentElement.dataset.savedScene||'{}').connections?.length===2);
        assert.deepEqual((await saved()).ledger.jobs,retainedJobs);assert.equal((await generationCalls()).start,undefined);
        await page.getByRole('button',{name:'Finish mapping',exact:true}).click();
        await page.getByRole('dialog',{name:'Generate 2 motion videos',exact:true}).waitFor();
        assert.equal((await saved()).ledger.jobs.length,2,'continued mapping dropped or duplicated existing jobs');
        console.log('PASS after failed generation: Continue mapping → controller record → plan → Save motion → Finish mapping quotes only new clips, all existing jobs retained');

        for(const light of [0,1]) {
            await page.goto(`http://127.0.0.1:5194/__test?w=390&h=660&ready=1&board=1&light=${light||''}`);
            const board=page.getByRole('dialog',{name:'Spatial generation board'});await board.waitFor();
            const bounds=await board.boundingBox(),media=await page.locator('[data-test-media]').boundingBox();
            assert.equal(bounds.y,media.y,'board is not at the top'); assert.equal(bounds.height,media.height);
            assert.equal(await page.locator('[data-fixture-pixels]').isVisible(),false,'Pixels overlaps the board');
            assert.equal(await page.locator('[data-fixture-scene-circle]').isVisible(),false,'scene circle overlaps the board');
            await board.getByRole('button',{name:/^Motion 1 ·/}).click();
            await board.getByRole('button',{name:'Close motion',exact:true}).click();
            await board.getByRole('button',{name:'Close board',exact:true}).click();
            assert.equal(await page.locator('[data-fixture-pixels]').isVisible(),true,'Pixels did not return outside board');
            await page.getByRole('button',{name:'Motion videos',exact:true}).click();await board.waitFor();
            assert.equal(await page.locator('html').getAttribute('data-retried-job'),null);
            assert.equal(await board.getByRole('button',{name:'Open failed motion',exact:true}).count(),0);
            assert.equal(await board.getByRole('button',{name:'Retry Motion 1 backward',exact:true}).count(),1);
            await board.getByRole('button',{name:/^Motion 1 ·/}).click();
            await page.getByRole('tab',{name:'Forward',exact:true}).waitFor();
            assert.equal(await page.getByRole('tab').count(),3);
            assert.equal(await page.getByRole('tab',{name:'Results',exact:true}).locator('[data-spatial-new-result]').count(),1);
            assert.equal(await board.getByText(/CAMERA: walk/).count(),0,'legacy narrative remains in movement UI');
            await page.waitForTimeout(250);
            await page.screenshot({path:`${output}/forward-${light?'light':'dark'}.png`});
            const promptStyle=await board.getByRole('button',{name:'Edit prompt',exact:true}).evaluate(button=>({gradient:getComputedStyle(button).backgroundImage,overflow:button.scrollWidth>button.clientWidth+2}));
            assert.ok(promptStyle.gradient.includes('linear-gradient'),'prompt control lost its two-tone glass finish');
            assert.equal(promptStyle.overflow,false,'prompt pill overflows narrow board');
            await board.getByRole('button',{name:'Edit prompt',exact:true}).click();
            const editor=page.getByRole('dialog',{name:/Edit Motion 1/});await editor.waitFor();
            const text=editor.getByRole('textbox',{name:'Clip prompt'});assert.ok((await text.inputValue()).length<100);
            await text.fill('Follow the reference and stop beside the table.');
            await editor.getByRole('button',{name:'Save',exact:true}).click();
            await editor.waitFor({state:'hidden'});
            assert.equal((await saved()).ledger.jobs[0].prompt,'Follow the reference and stop beside the table.');
            assert.equal(await page.locator('html').getAttribute('data-retried-job'),null);
            await page.getByRole('tab',{name:'Backward',exact:true}).click();
            assert.equal(await board.getByAltText('2D return destination').count(),1);
            await board.getByRole('button',{name:'Retry backward · 83 P'}).click();
            const confirmation=page.getByRole('dialog',{name:'Retry failed clips?'});await confirmation.waitFor();
            assert.equal(await confirmation.getByText('Motion 1 · Backward · 83 P',{exact:true}).count(),1);
            await confirmation.getByRole('button',{name:'Cancel',exact:true}).click();
            await confirmation.waitFor({state:'hidden'});
            assert.equal(await page.locator('html').getAttribute('data-retried-job'),null,'cancel submitted a retry');
            await page.getByRole('tab',{name:'Results',exact:true}).click();
            assert.equal(await page.getByRole('tab',{name:'Results',exact:true}).locator('[data-spatial-new-result]').count(),0,'new-result marker did not clear on opening Results');
            await board.locator('video[src="/fixture/forward.mp4"]').waitFor({state:'attached'});
            assert.equal(await board.locator('video[src="/fixture/forward.mp4"]').count(),1,'backward selection hid forward result');
            await board.getByRole('button',{name:'Retry backward · 83 P'}).click();
            await confirmation.getByRole('button',{name:'Confirm · 83 P'}).click();
            await page.waitForFunction(()=>document.documentElement.dataset.retriedJob==='edge:backward');
            const current=await saved();assert.equal(current.ledger.jobs[0].status,'ready');assert.equal(current.ledger.jobs[0].output,'/fixture/forward.mp4');
            await confirmation.waitFor({state:'hidden'});
            await board.locator('video[src="/fixture/forward.mp4"]').waitFor({state:'attached'});
            assert.equal(await board.locator('video[src="/fixture/forward.mp4"]').count(),1);
            await page.screenshot({path:`${output}/preview-${light?'light':'dark'}.png`});
            console.log(`PASS ${light?'light':'dark'}: header clear; three tabs; edit costs nothing; cancel does not submit; backward retry retains forward preview`);
        }
        await page.goto('http://127.0.0.1:5194/__test?w=390&h=660&ready=1&board=1&eightMotions=1',{waitUntil:'domcontentloaded',timeout:60000});
        const eightBoard=page.getByRole('dialog',{name:'Spatial generation board'});await eightBoard.waitFor();
        assert.equal(await eightBoard.getByRole('button',{name:/Motion [1-8] ·/}).count(),8);
        await eightBoard.getByRole('button',{name:/Motion 8 ·/}).scrollIntoViewIfNeeded();
        assert.equal(await eightBoard.evaluate(element=>element.scrollWidth>element.clientWidth+2),false,'eight-motion board overflows horizontally');
        await page.screenshot({path:`${output}/eight-motions.png`});
        console.log('PASS eight-motion grid remains scrollable without horizontal overflow');
        await page.goto('http://127.0.0.1:5194/__test?w=390&h=660&ready=1&board=1&partialBoard=1&localUploads=1',{waitUntil:'domcontentloaded',timeout:60000});
        const partial=page.getByRole('dialog',{name:'Spatial generation board'});await partial.waitFor();
        assert.equal(Number(await partial.getByRole('progressbar',{name:'Scene videos ready'}).getAttribute('aria-valuenow')),Math.round(100/6),'progress excludes unstarted clips');
        await partial.getByRole('button',{name:/^Motion 2 ·/}).click();
        await partial.getByRole('button',{name:'Edit prompt',exact:true}).click();
        await page.getByRole('textbox',{name:'Clip prompt'}).fill('Stop beside the cup.');await page.getByRole('button',{name:'Save',exact:true}).click();
        await partial.getByRole('button',{name:'Generate',exact:true}).click();
        await page.getByRole('dialog',{name:/^Generate \d+ motion videos?$/}).waitFor({timeout:90000});
        const prepared=await saved();assert.ok(prepared.ledger.routes['edge-2'].forward.referenceVideo);assert.ok(prepared.ledger.routes['edge-2'].backward.referenceVideo);
        assert.equal(prepared.ledger.routes['edge-3'].forward.referenceVideo,undefined,'individual generation prepared unrelated motion');
        assert.equal(prepared.ledger.jobs[0].output,'/fixture/forward.mp4');
        console.log('PASS partial generation: unstarted prompt edit, only selected references exported, existing result retained, accurate scene-wide progress');
        await page.goto('http://127.0.0.1:5194/__test?w=390&h=660&ready=1&board=1&mappedBoard=1',{waitUntil:'domcontentloaded',timeout:60000});
        const board=page.getByRole('dialog',{name:'Spatial generation board'});await board.waitFor();
        await board.getByRole('button',{name:'Generate Motion 1',exact:true}).click();
        await page.getByRole('dialog',{name:/^Generate \d+ motion videos?$/}).waitFor();
        assert.equal(await page.locator('html').getAttribute('data-quote-route'),'edge');
        await page.getByRole('button',{name:'Close generation settings'}).click();
        await board.getByRole('button',{name:'Generate all',exact:true}).click();
        const settings=page.getByRole('dialog',{name:/^Generate \d+ motion videos?$/});await settings.waitFor();
        await settings.getByRole('combobox',{name:'Video generation model'}).click();
        assert.equal(await page.getByRole('option').count(),6);
        await page.keyboard.press('Escape');await settings.getByRole('button',{name:'Close generation settings'}).click();
        await board.getByRole('button',{name:/^Motion 1 ·/}).click();await board.getByRole('button',{name:'Edit prompt',exact:true}).click();
        await page.getByRole('textbox',{name:'Clip prompt'}).fill('Stop at the reference endpoint.');
        await page.getByRole('button',{name:'Save',exact:true}).click();
        assert.equal((await saved()).ledger.routes.edge.forward.prompt,'Stop at the reference endpoint.');
        assert.equal((await saved()).ledger.jobs.length,0);
        assert.equal(await settings.getByText(/All missing motion clips|Results save automatically/).count(),0);
        console.log('PASS grid Generate, supported model choices and prompt editing before any generation');

        await page.goto('http://127.0.0.1:5194/__test?w=390&h=660&ready=1&board=1&reviewResult=1&autoSave=1',{waitUntil:'domcontentloaded',timeout:60000});
        await board.getByRole('button',{name:/^Motion 1 ·/}).click();
        assert.equal(await board.getByRole('button',{name:/Approve forward/}).count(),0,'approval is shown without its result');
        await board.locator('[data-spatial-board-content]').evaluate(el=>el.scrollTop=el.scrollHeight);
        await board.getByRole('button',{name:'Review result',exact:true}).click();
        assert.equal(await board.locator('[data-spatial-board-content]').evaluate(el=>el.scrollTop),0,'Preview inherited a hidden/offscreen result position');
        await page.waitForFunction(()=>JSON.parse(document.documentElement.dataset.savedScene||'{}').ledger?.jobs[0].status==='ready');
        assert.ok(Number(await page.locator('html').getAttribute('data-saved-frame-bytes'))>0,'automatic finalizer did not extract/upload an actual video frame');
        assert.equal(await board.getByRole('button',{name:/Approve/}).count(),0);
        if(process.env.SPATIAL_TEST_VIDEO)await board.locator('[data-spatial-result="forward"] video').evaluate(video=>new Promise((resolve,reject)=>{if(video.readyState>=2)return resolve(null);video.addEventListener('loadeddata',()=>resolve(null),{once:true});video.addEventListener('error',()=>reject(new Error('Preview video failed to load')),{once:true});video.preload='auto';video.load();}));
        await page.screenshot({path:`${output}/result-review.png`});
        console.log('PASS result saves automatically into editor state without approval; Preview resets scroll and displays its actual video');
        await page.goto('http://127.0.0.1:5194/__test?ready=1&board=1&reviewResult=1&autoSave=1&backgroundOnly=1',{waitUntil:'domcontentloaded',timeout:60000});
        assert.equal(await page.locator('[data-spatial-authoring]').count(),0);
        await page.waitForFunction(()=>JSON.parse(document.documentElement.dataset.savedScene||'{}').ledger?.jobs[0].status==='ready');
        assert.ok(Number(await page.locator('html').getAttribute('data-saved-frame-bytes'))>0);
        console.log('PASS reopened unvisited scene saves automatically with actual MP4 frame extraction and no SpatialStudio mounted');

        await page.goto('http://127.0.0.1:5194/__test?w=390&h=660&ready=1&backtrackSetup=1',{waitUntil:'domcontentloaded',timeout:60000});
        await page.getByRole('button',{name:'Play spatial action',exact:true}).click();
        await page.waitForFunction(()=>JSON.parse(document.documentElement.dataset.savedScene||'{}').activeNodeId==='acted');
        await page.getByRole('button',{name:'Create a spatial action',exact:true}).click();
        await page.getByRole('button',{name:'Backtrack',exact:true}).click();
        await page.getByRole('button',{name:'Step 1',exact:true}).click();
        await page.getByRole('button',{name:'Save navigation',exact:true}).click();
        assert.equal((await saved()).nodes.find(node=>node.id==='acted').actionBacktrack.targetNodeId,'end');
        assert.equal(await page.locator('html').getAttribute('data-planning-calls'),null);
        await page.getByRole('button',{name:'Backtrack to Step 1',exact:true}).click();
        await page.waitForFunction(()=>JSON.parse(document.documentElement.dataset.savedScene||'{}').activeNodeId==='end');
        console.log('PASS creation: preview action to its result node → author a backtrack → activate that exact destination, no AI call');

        await page.goto('http://127.0.0.1:5194/__test?w=390&h=660&ready=1&links=1',{waitUntil:'domcontentloaded',timeout:60000});
        await page.getByRole('button',{name:'Create a spatial action'}).click();
        await page.getByRole('button',{name:'Link',exact:true}).click();
        const destination=page.getByRole('button',{name:'Scene 2',exact:true});await destination.waitFor();
        assert.equal(await destination.locator('img').count(),1);assert.equal(await destination.locator('img').evaluate(el=>getComputedStyle(el).borderRadius),'50%');
        await destination.click();await page.getByRole('button',{name:'Save navigation',exact:true}).click();
        await page.getByAltText('Scene 2',{exact:true}).waitFor();
        assert.equal((await saved()).nodes[0].actionLink.sceneId,'second');
        assert.equal(await page.getByRole('dialog',{name:'Motion instructions'}).count(),0);
        assert.equal(await page.getByRole('dialog',{name:/^Generate \d+ motion videos?$/}).count(),0);
        assert.equal(await page.locator('html').getAttribute('data-planning-calls'),null);
        console.log('PASS link destinations are circular scene thumbnails; saving a link restores movement controls without a planning/model popup or AI call');
        }

        await page.goto('http://127.0.0.1:5194/__test?w=390&h=660&ready=1&workflow=1&localUploads=1&exportReady=1',{waitUntil:'domcontentloaded',timeout:60000});
        await page.getByRole('button',{name:'Add motion',exact:true}).waitFor();
        const controller=page.locator('.spatial-drive-control');await controlMode(controller,'analog');
        const box=await controller.boundingBox(),x=box.x+box.width/2,y=box.y+box.height/2;
        const forward=async()=>{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y-box.width*.4);};
        await forward();await page.waitForTimeout(400);await page.mouse.up();
        assert.equal(await page.getByRole('button',{name:'Test recording',exact:true}).count(),0,'movement recorded without Add motion');
        await page.getByRole('button',{name:'Add motion',exact:true}).click();await forward();await page.waitForTimeout(900);await page.mouse.up();
        await page.getByText(/Mapping paused .*s left/).waitFor();
        await page.getByRole('button',{name:'Finish recording',exact:true}).click();
        await page.getByRole('button',{name:'Test recording',exact:true}).waitFor();
        await page.getByRole('button',{name:'Process movement · Metered P'}).click();
        const save=page.getByRole('button',{name:'Save motion',exact:true});await save.waitFor();
        await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(button=>button.textContent==='Save motion'&&!button.disabled));
        await save.click();await page.getByRole('button',{name:'Finish mapping',exact:true}).waitFor();
        await page.waitForFunction(()=>{
            const scene=JSON.parse(document.documentElement.dataset.savedScene||'{}');
            const motion=Object.values(scene.ledger?.routes||{})[0];
            return motion && ['forward','backward'].every(direction=>motion[direction]?.motionEvidence?.frames?.length===5 && motion[direction]?.guidance);
        },{},{timeout:45000});
        const first=await saved();assert.equal(first.connections.length,1);assert.ok(first.connections[0].movement.samples.length>0);
        const savedMotion=Object.values(first.ledger.routes)[0];
        const captures=await page.evaluate(()=>window.__fixtureFrameCaptures);
        assert.ok(captures.length>=12,'authoring did not capture both directional sequences and diagrams');
        for(const [index,direction] of [[5,'forward'],[11,'backward']])fs.writeFileSync(`${output}/${direction}-diagram.png`,Buffer.from(captures[index].split(',')[1],'base64'));
        for(const direction of ['forward','backward']) {
            assert.equal(savedMotion[direction].motionEvidence.frames.length,5,'motion snapshots were not saved during authoring');
            assert.ok(savedMotion[direction].motionEvidence.diagram.imageUrl,'annotated route diagram was not saved');
            assert.equal(savedMotion[direction].motionEvidence.animationId,savedMotion[direction].id);
            assert.match(savedMotion[direction].guidance.instruction,/walks.*5 seconds.*Camera locked/);
            assert.ok(savedMotion[direction].guidance.interpretation.endRelation);
        }
        await forward();await page.waitForFunction(()=>JSON.parse(document.documentElement.dataset.savedScene||'{}').activeNodeId!=='root',{timeout:15000});
        await page.waitForTimeout(1000); // Hold past the endpoint: no implicit next recording.
        assert.equal(await page.getByRole('button',{name:'Test recording',exact:true}).count(),0);
        assert.equal((await saved()).ledger.draft,undefined);assert.equal((await saved()).connections.length,1);
        assert.equal(await page.getByText(/newer saved changes|another tab/).count(),0);
        await page.mouse.up();await page.getByRole('button',{name:'Add motion',exact:true}).click();
        await forward();await page.waitForTimeout(800);await page.mouse.up();
        await page.getByRole('button',{name:'Finish recording',exact:true}).click();
        await page.getByRole('button',{name:'Test recording',exact:true}).waitFor();
        assert.ok((await saved()).ledger.draft,'explicit Add motion did not start the next recording');
        console.log('PASS actual controller: explicit Add motion → record → plan → review → save → traverse held past endpoint → Add motion again, no implicit recording/save conflict');
        assert.deepEqual(errors,[]);console.log('Screenshots: '+output);
    }finally{await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
