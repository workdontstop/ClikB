const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||'playwright');
(async()=>{
    const root=path.resolve(__dirname,'..').replaceAll('\\','/');
    const tmp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'motion-export-'));
    const {createServer}=await import(pathToFileURL(root+'/node_modules/vite/dist/node/index.js'));
    const server=await createServer({root,configFile:false,cacheDir:tmp+'/vite',optimizeDeps:{entries:[root+'/tests/motionExport.browser.ts']},server:{host:'127.0.0.1',port:5197,strictPort:true,hmr:false,watch:null},plugins:[{name:'fixture',configureServer(server){server.middlewares.use((req,res,next)=>{
        if(req.url==='/__export'){res.setHeader('Content-Type','text/html');res.end('<script type="module" src="/tests/motionExport.browser.ts"></script>');}else next();
    });}}]}); await server.listen();
    const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    try{
        const page=await browser.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
        await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:5197/')?route.continue():route.abort());
        await page.goto('http://127.0.0.1:5197/__export');await page.waitForFunction(()=>typeof window.testMotionExport==='function');
        for(const [seconds,aspect] of [[5,'9:16'],[5,'16:9'],[10,'1:1']]){
            const result=await page.evaluate(async({seconds,aspect})=>window.testMotionExport(seconds,aspect),{seconds,aspect});
            assert.ok(result.bytes>0);assert.equal(result.type,'video/mp4');assert.deepEqual(result.endpoint,[1,.5,0]);
            assert.ok(result.measured+1/30+.002>=seconds,JSON.stringify(result));
            assert.ok(result.measured<seconds+.04,'unexpected export length '+JSON.stringify(result));
            if(seconds===5&&aspect==='16:9')fs.writeFileSync(path.join(tmp,'sample.mp4'),Buffer.from(result.data));
            console.log(`PASS actual ${aspect} MP4: ${seconds}s timeline, ${result.measured.toFixed(3)}s container, ${result.bytes} bytes`);
        }
        const paused=await page.evaluate(()=>window.testMotionExport(5,'9:16',true));
        assert.equal(paused.paused,true);assert.equal(paused.progressedWhileHidden,false);assert.ok(Math.abs(paused.measured-5)<.04);
        console.log('PASS hidden-tab frame export pauses then resumes the same MP4; five-second duration and endpoint retained');
        console.log('Local test video: '+path.join(tmp,'sample.mp4'));
        const rich=await page.evaluate(()=>window.testRichMotionPreview());
        assert.ok(rich.meshes>20);assert.ok(rich.uniqueGeometry<rich.meshes/2);assert.equal(rich.reuse,true);assert.ok(rich.triangles<5000);assert.ok(rich.blade.every(Number.isFinite));
        await page.screenshot({path:path.join(tmp,'articulated-preview.png')});
        await page.evaluate(()=>window.disposeRichPreview());
        const exported=await page.evaluate(()=>window.testRichMotionExport());
        assert.ok(exported.bytes>0);assert.ok(Math.abs(exported.measured-5)<.04);
        fs.writeFileSync(path.join(tmp,'articulated.mp4'),Buffer.from(exported.data));
        console.log('PASS articulated dragon, mounted knight, moving hand and attached sword: '+JSON.stringify({...rich,exportMs:exported.exportMs,measured:exported.measured,bytes:exported.bytes}));
        console.log('Local articulated assets: '+path.join(tmp,'articulated-preview.png')+' and '+path.join(tmp,'articulated.mp4'));
        const text=await page.evaluate(()=>window.testTextMotionExport());
        assert.equal(text.hidden.count,0);assert.ok(text.preview.count>100);assert.ok(text.exported.count>100);
        assert.ok(Math.abs(text.preview.count-text.exported.count)/text.preview.count<.2,JSON.stringify(text.preview)+' vs '+JSON.stringify(text.exported));
        assert.ok(Math.abs(text.preview.x-text.exported.x)<3);assert.ok(Math.abs(text.preview.y-text.exported.y)<3);
        assert.ok(Math.abs(text.measured-2)<.04);
        fs.writeFileSync(path.join(tmp,'text-preview.png'),Buffer.from(text.previewPng.split(',')[1],'base64'));
        fs.writeFileSync(path.join(tmp,'text-export-frame.png'),Buffer.from(text.exportedPng.split(',')[1],'base64'));
        fs.writeFileSync(path.join(tmp,'text.mp4'),Buffer.from(text.data));
        console.log('PASS literal styled text: attached motion/timed visibility and matching real preview/decoded MP4 pixels '+JSON.stringify({preview:text.preview,exported:text.exported}));
        console.log('Local text assets: '+path.join(tmp,'text-preview.png'));
        const resources=await page.evaluate(()=>window.testMotionResourceBaseline());
        assert.equal(resources.afterEdits.buffers,resources.initial.buffers);assert.equal(resources.afterEdits.textures,resources.initial.textures);
        assert.equal(resources.afterDispose.buffers,0);assert.equal(resources.contextLost,true);
        assert.equal(resources.mountedVideos,0);assert.equal(resources.mountedCanvases,1);
        console.log('PASS renderer resource baseline: stable buffers/textures across ten appearance/text edits, owned context released '+JSON.stringify(resources));
        assert.deepEqual(errors,[]);
    }finally{await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
