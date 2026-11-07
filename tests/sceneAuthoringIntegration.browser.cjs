const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||path.resolve(__dirname,'../.tmp/concierge-browser-deps/node_modules/playwright'));
(async()=>{
 const root=path.resolve(__dirname,'..'),output=path.join(root,'.tmp/scene-authoring-prototype');fs.mkdirSync(output,{recursive:true});
 const {createServer}=await import('vite'),{sceneAuthoringPreviewPlugin}=await import('../scripts/scene-authoring-preview-config.mjs');
 const server=await createServer({root,configFile:false,plugins:[sceneAuthoringPreviewPlugin],logLevel:'error',cacheDir:output+'/vite-integration-test',optimizeDeps:{entries:['scene-authoring-integration.html']},esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port:5214,strictPort:true,hmr:false}});await server.listen();
 let browser;const results=[],errors=[];
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),origin='http://127.0.0.1:5214';
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>route.request().url().startsWith(origin)||/^(data:|blob:)/.test(route.request().url())?route.continue():route.abort());
  for(const aspect of ['9:16','16:9','1:1']){
   await page.goto(origin+'/scene-authoring-integration.html?aspect='+aspect);
   await page.locator('[data-spatial-authoring="integrated"] canvas').waitFor({timeout:60000});
   for(const name of ['Try controls','Rotate horizontally','Rotate vertically','Roll','Rise','Descend'])assert.ok(await page.getByRole('button',{name,exact:true}).isVisible(),name);
   const size=await page.locator('[data-native-preview] canvas').evaluate(canvas=>({width:canvas.width,height:canvas.height,rect:{width:canvas.getBoundingClientRect().width,height:canvas.getBoundingClientRect().height}}));
   const [w,h]=aspect.split(':').map(Number);assert.ok(Math.abs(size.width/size.height-w/h)<.001);assert.ok(Math.abs(size.rect.width/size.rect.height-w/h)<.002);
   assert.equal(await page.locator('input[type="number"]').count(),0);
   await page.screenshot({path:output+'/integrated-'+aspect.replace(':','x')+'.png',fullPage:true});
   await page.getByRole('button',{name:'Expand',exact:true}).click();
   const expanded=await page.locator('[data-native-preview]').boundingBox();assert.ok(Math.abs(expanded.width/expanded.height-w/h)<.002);
   await page.screenshot({path:output+'/integrated-expanded-'+aspect.replace(':','x')+'.png',fullPage:true});
   await page.getByRole('button',{name:'Close expanded preview',exact:true}).click();
   results.push('Actual SpatialStudio '+aspect+' retains native pills and six author controls; canvas and expanded frame keep the creation aspect; no numeric transform inspector.');
  }
  await page.setViewportSize({width:390,height:844});await page.goto(origin+'/scene-authoring-integration.html?aspect=9:16',{waitUntil:'networkidle'});await page.locator('[data-spatial-authoring="integrated"] canvas').waitFor();
  const trial=page.getByRole('button',{name:'Try controls',exact:true}),before=await trial.getAttribute('aria-pressed');await trial.click();await page.locator(`button[aria-label="Try controls"][aria-pressed="${before==='true'?'false':'true'}"]`).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:output+'/integrated-mobile.png',fullPage:true});
  results.push('390px native control trial works with no horizontal overflow or provider requests.');
  assert.deepEqual(errors,[]);fs.writeFileSync(output+'/integration-results.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors,output},null,2));
 }finally{if(browser)await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
