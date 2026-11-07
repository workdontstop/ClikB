const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||path.resolve(__dirname,'../.tmp/concierge-browser-deps/node_modules/playwright'));
(async()=>{
 const root=path.resolve(__dirname,'..'),output=path.join(root,'.tmp/connected-flight');fs.mkdirSync(output,{recursive:true});
 const {createServer}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')));
 const server=await createServer({root,configFile:false,logLevel:'error',cacheDir:output+'/vite',esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port:5206,strictPort:true,hmr:false},plugins:[{name:'fixture',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url.startsWith('/__test')){res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#111}</style><div id="root"></div><script type="module" src="/tests/spatialStudio.responsive.tsx"></script>');}else next();});}}]});await server.listen();
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  for(const width of [320,390,740]){
   const context=await browser.newContext({viewport:{width,height:760},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:5206/')||route.request().url().startsWith('data:')?route.continue():route.abort());
   await page.goto(`http://127.0.0.1:5206/__test?w=${width}&h=730&ready=1&flight=1`);
   const indicator=page.getByRole('button',{name:'Show special movement controls',exact:true});await indicator.waitFor();
   const settings=page.getByRole('button',{name:'Spatial mode settings',exact:true});await settings.click();
   const toggle=page.getByRole('checkbox',{name:'Extra movement controls'});await toggle.uncheck();assert.equal(await indicator.count(),0);await toggle.check();
   await page.getByRole('combobox',{name:'Movement speed'}).click();await page.getByRole('option',{name:'2×',exact:true}).click();await settings.click();
   await indicator.click();const rise=page.getByRole('button',{name:'Rise',exact:true}),descend=page.getByRole('button',{name:'Descend',exact:true});
   for(const pill of [rise,descend]){const box=await pill.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width,`pill outside ${width}px: ${JSON.stringify(box)}`);assert.ok(box.height>=40);}
   assert.equal(await rise.isDisabled(),true);await page.getByRole('button',{name:'Add motion',exact:true}).click();
   const drive=await page.getByLabel(/^Spatial analogue drive;/).boundingBox(),pill=await rise.boundingBox();
   const cdp=await context.newCDPSession(page),up={x:pill.x+pill.width/2,y:pill.y+pill.height/2,id:1},stick={x:drive.x+drive.width/2,y:drive.y+drive.height/2,id:2};
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[up]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[up,stick]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[up,{...stick,y:stick.y-drive.width*.3}]});
   await page.waitForTimeout(900);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[up]});await page.waitForTimeout(250);
   assert.equal(await page.getByRole('button',{name:'Test recording',exact:true}).count(),0,'releasing horizontal input interrupted held vertical input');
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.getByRole('button',{name:'Test recording',exact:true}).waitFor();
   const scene=JSON.parse(await page.locator('html').getAttribute('data-saved-scene')),track=scene.ledger.draft.plan.objects[0].keys,end=track.at(-1);
   assert.ok(end.position[1]>1.4,'vertical movement was not recorded at 2×');assert.ok(Math.hypot(end.position[0],end.position[2])>.5,'directional movement did not combine with flight');
   assert.ok(track.every(key=>Math.abs(key.rotation[1])<1e-5),'straight flight spun the subject');assert.equal(end.t,5);
   assert.equal(await page.locator('html').getAttribute('data-planning-calls'),null,'controller input triggered AI');
   await page.screenshot({path:path.join(output,width+'-flight.png')});assert.deepEqual(errors,[]);console.log(`PASS ${width}px: Settings toggle, padded pills, 2× flight combines vertical/directional touch input without spinning or AI calls; release retains the complete recording.`);
   await context.close();
  }
  const page=await browser.newPage();await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:5206/')||route.request().url().startsWith('data:')?route.continue():route.abort());
  await page.goto('http://127.0.0.1:5206/__test?w=740&h=730&ready=1&water=1');await page.getByRole('button',{name:'Show special movement controls',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Surface',exact:true}).isVisible(),true);assert.equal(await page.getByRole('button',{name:'Dive',exact:true}).isVisible(),true);
  console.log('PASS water scene exposes Surface / Dive using the same controls.');
 }finally{await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
