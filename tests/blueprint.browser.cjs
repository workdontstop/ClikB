const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||path.resolve(__dirname,'../.tmp/concierge-browser-deps/node_modules/playwright'));
(async()=>{
 const root=path.resolve(__dirname,'..'),output=path.join(root,'.tmp/blueprint-review');fs.mkdirSync(output,{recursive:true});
 const {createServer}=await import('vite');
 const server=await createServer({root,configFile:false,logLevel:'error',cacheDir:output+'/vite',optimizeDeps:{entries:['tests/fixtures/blueprint.html']},esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port:5223,strictPort:true,hmr:false}});await server.listen();
 const checks=[],failures=[],errors=[];let browser;
 const check=async(name,fn)=>{try{await fn();checks.push(name);}catch(e){failures.push({name,error:e.message});}};
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  for(const [name,width,height,theme] of [['desktop-light',1440,1000,'light'],['desktop-dark',1440,1000,'dark'],['mobile-light',390,844,'light'],['mobile-dark',390,844,'dark']]){
   const page=await browser.newPage({viewport:{width,height}}),origin='http://127.0.0.1:5223';
   page.on('pageerror',e=>errors.push({name,error:e.message}));
   await page.route('**/*',r=>r.request().url().startsWith(origin)||/^(data:|blob:)/.test(r.request().url())?r.continue():r.abort());
   await page.goto(origin+'/tests/fixtures/blueprint.html?theme='+theme,{waitUntil:'domcontentloaded'});
   await page.getByRole('dialog',{name:'Blueprint',exact:true}).waitFor({timeout:60000});
   await check(name+': title and body scroll lock',async()=>{assert.equal(await page.getByText('Blueprint',{exact:true}).count(),1);assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');});
   const prompt=page.locator('[data-plan-text="prompt"] [data-blueprint-expandable]');
   await check(name+': initial prompt shows five lines and expands from text click',async()=>{
    await prompt.waitFor();const metrics=await prompt.evaluate(el=>({height:el.clientHeight,lineHeight:parseFloat(getComputedStyle(el).lineHeight),clamp:getComputedStyle(el).webkitLineClamp}));
    assert.equal(metrics.clamp,'5');assert.ok(Math.abs(metrics.height/metrics.lineHeight-5)<.15,JSON.stringify(metrics));
    await prompt.click();assert.equal(await prompt.getAttribute('aria-expanded'),'true');
   });
   await check(name+': selecting text does not collapse it',async()=>{
    await prompt.evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(range);});
    await prompt.dispatchEvent('click');assert.equal(await prompt.getAttribute('aria-expanded'),'true');assert.ok(await page.evaluate(()=>getSelection().toString().length>20));
    await page.evaluate(()=>getSelection().removeAllRanges());
   });
   await page.screenshot({path:output+'/'+name+'-prompt.png',fullPage:false});
   await check(name+': only Scene 3 jump is active and A/B prompts match native slots',async()=>{
    await page.locator('[data-blueprint-jump="3"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-blueprint-jump="3"]')?.getAttribute('aria-current')==='location');
    assert.equal(await page.locator('[data-blueprint-jump][aria-current="location"]').count(),1);
    const scene=page.locator('[data-plan-scene="3"]');assert.ok((await scene.innerText()).includes('UNIQUE A3 VIDEO PROMPT'));assert.ok((await scene.innerText()).includes('UNIQUE B3 VIDEO PROMPT'));
    assert.ok(!(await scene.innerText()).includes('UNIQUE A2 VIDEO PROMPT'));
   });
   await check(name+': wheel is isolated from underlying feed',async()=>{
    const before=await page.evaluate(()=>({scroll:scrollY,wheels:window.__blueprintFixture.parentWheels()}));
    await page.locator('.blueprint-body').dispatchEvent('wheel',{deltaY:600,bubbles:true});
    await page.locator('.blueprint-body').hover();await page.mouse.wheel(0,300);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const after=await page.evaluate(()=>({scroll:scrollY,wheels:window.__blueprintFixture.parentWheels()}));assert.deepEqual(after,before);
   });
   await check(name+': audio badges stay on one line with no card overflow',async()=>{
    const dimensions=await page.locator('[data-plan-scene="3"] audio').evaluateAll(nodes=>nodes.map(audio=>{const card=audio.parentElement,badge=card.querySelector('span'),style=getComputedStyle(badge),range=document.createRange();range.selectNodeContents(badge);return{height:range.getBoundingClientRect().height,lineHeight:parseFloat(style.lineHeight)||parseFloat(style.fontSize)*1.2,overflow:card.scrollWidth-card.clientWidth};}));
    assert.equal(dimensions.length,2);for(const d of dimensions){assert.ok(d.height<d.lineHeight*1.6,JSON.stringify(d));assert.ok(d.overflow<2,JSON.stringify(d));}
   });
   await check(name+': media background and theme text contrast',async()=>{
    const info=await page.locator('.blueprint-root').evaluate(el=>{const s=getComputedStyle(el);return{media:s.getPropertyValue('--blueprint-media'),text:s.getPropertyValue('--blueprint-text'),background:s.getPropertyValue('--blueprint-background')};});
    if(theme==='dark')assert.ok(info.media.includes('#ffffff')&&info.media.includes('#dceafb'),JSON.stringify(info));
    else{assert.ok(info.background.includes('#f8fbff')&&info.background.includes('#eaf2fc'),JSON.stringify(info));assert.equal(info.text.trim(),'#111827');}
   });
   await page.screenshot({path:output+'/'+name+'-scene3.png',fullPage:false});
   await check(name+': closing restores body scroll',async()=>{await page.locator('[data-ai-action="clikb.feeds.plan.close"]').click();await page.locator('.blueprint-root').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>document.body.style.overflow),'');});
   await page.close();
  }
  const result={checks,failures,errors};fs.writeFileSync(output+'/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 }finally{if(browser)await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
