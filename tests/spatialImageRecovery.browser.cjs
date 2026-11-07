const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||path.resolve(__dirname,'../.tmp/concierge-browser-deps/node_modules/playwright'));
(async()=>{
 const root=path.resolve(__dirname,'..'),{createServer}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')));
 const server=await createServer({root,configFile:false,logLevel:'error',cacheDir:'.tmp/image-recovery-vite',esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port:5207,strictPort:true,hmr:false},plugins:[{name:'fixture',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url.startsWith('/__test')){res.setHeader('Content-Type','text/html');res.end('<div id="root"></div><script type="module" src="/tests/spatialPlayer.browser.tsx"></script>');}else next();});}}]});await server.listen();
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1000,height:750}}),errors=[],counts={};let releaseOld;
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());if(!url.href.startsWith('http://127.0.0.1:5207/'))return route.abort();
   if(url.pathname.startsWith('/recover-')){
    const count=counts[url.pathname]=(counts[url.pathname]||0)+1;
    if(url.pathname==='/recover-old.svg'&&count===1)await new Promise(resolve=>releaseOld=resolve);
    const fail=url.pathname==='/recover-manual.svg'&&count<=3||url.pathname==='/recover-transient.svg'&&count<=2||url.pathname==='/recover-old.svg';
    return route.fulfill({status:fail?503:200,contentType:fail?'text/plain':'image/svg+xml',body:fail?'Fixture temporarily unavailable':'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="blue"/></svg>'});
   }
   return route.continue();
  });
  await page.goto('http://127.0.0.1:5207/__test?mode=feed&frameRecovery=manual');
  const retry=page.getByRole('button',{name:'Retry image',exact:true});await retry.waitFor();assert.equal(counts['/recover-manual.svg'],3);
  await retry.click();await retry.waitFor({state:'hidden'});assert.equal(counts['/recover-manual.svg'],4);
  assert.equal(await page.getByText('The stage image could not load.',{exact:true}).count(),0);console.log('PASS Feeds: three bounded failures show Retry image; recovery clears the matching warning.');
  await page.goto('http://127.0.0.1:5207/__test?mode=feed&frameRecovery=transient');
  await page.waitForFunction(()=>window.__spatialDiagnostics.entries().some(event=>event.event==='frame.ready'&&event.details.attempt===3));
  assert.equal(counts['/recover-transient.svg'],3);assert.equal(await retry.count(),0);console.log('PASS Feeds: transient failures recover automatically without leaving an image warning.');
  await page.evaluate(()=>window.test.frame('/recover-old.svg'));while(!releaseOld)await page.waitForTimeout(50);
  await page.evaluate(()=>window.test.frame('/recover-new.svg'));await page.waitForFunction(()=>window.__spatialDiagnostics.entries().some(event=>event.event==='frame.ready'&&String(event.details.url).includes('recover-new')));
  releaseOld();await page.waitForTimeout(1600);assert.equal(counts['/recover-old.svg'],3);assert.equal(await retry.count(),0);
  assert.equal(await page.locator('[data-spatial-appearance-frame]').getAttribute('data-spatial-appearance-frame'),'/recover-new.svg');
  assert.deepEqual(errors,[]);console.log('PASS obsolete failed loads cannot restore an old Feeds warning or replace the current image.');
 }finally{await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
