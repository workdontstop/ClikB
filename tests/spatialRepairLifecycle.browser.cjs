const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE);
(async()=>{
const root=path.resolve(__dirname,'..'),out=path.join(root,'.tmp/repair-lifecycle');fs.mkdirSync(out,{recursive:true});
const {createServer}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')));
const server=await createServer({root,configFile:false,logLevel:'error',cacheDir:out+'/vite',optimizeDeps:{entries:['tests/spatialStudio.responsive.tsx']},esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port:5210,strictPort:true,hmr:false},plugins:[{name:'fixture',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url.startsWith('/__test')){res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#111}</style><div id="root"></div><script type="module" src="/tests/spatialStudio.responsive.tsx"></script>');}else next();});}}]});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME}),page=await browser.newPage({viewport:{width:390,height:800}}),errors=[];
page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:5210/')||r.request().url().startsWith('data:')?r.continue():r.abort());
const visit=q=>page.goto('http://127.0.0.1:5210/__test?w=390&h=770&'+q);
const calls=()=>page.locator('html').getAttribute('data-operation-calls').then(v=>JSON.parse(v||'{}'));
const saved=()=>page.locator('html').getAttribute('data-saved-scene').then(JSON.parse);
const helper=async()=>{const input=page.getByRole('textbox',{name:'Context / edit this motion',exact:true});if(!await input.isVisible())await page.getByRole('button',{name:'Edit intelligent motion helper',exact:true}).click();return input;};
try{
for(const light of [false,true]){
await visit(light?'light=1':'');await page.getByRole('button',{name:'Scene instructions and model',exact:true}).click();
const input=page.getByRole('textbox',{name:'Scene instructions',exact:true});await input.fill('Keep the girl crouched near the horse.');
const assets=page.locator('[data-spatial-scene-assets] [data-spatial-asset]');
for(const name of ['Prop 1','Prop 2'])await page.locator('[data-spatial-scene-assets]').getByRole('button',{name,exact:true}).click();
await page.waitForTimeout(350);
for(const name of ['youngGirl','Prop 1','Prop 2']){
const b=page.locator('[data-spatial-scene-assets]').getByRole('button',{name,exact:true});assert.equal(await b.getAttribute('aria-pressed'),'true');
const colors=await b.evaluate(el=>({card:getComputedStyle(el).borderTopColor,circle:getComputedStyle(el.querySelector('img')).borderTopColor}));assert.equal(colors.card,colors.circle);assert.notEqual(colors.card,'rgb(255, 255, 255)');assert.notEqual(colors.card,'rgba(0, 0, 0, 0)');
}
const unselected=assets.filter({hasText:'Prop 3'});assert.equal(await unselected.evaluate(el=>getComputedStyle(el).borderTopColor),'rgb(255, 255, 255)');
await page.getByRole('combobox',{name:'Driven character',exact:true}).click();await page.getByRole('option',{name:'youngGirl',exact:true}).click();
await page.getByRole('listbox').waitFor({state:'hidden'});await page.waitForTimeout(300);await page.screenshot({path:out+`/assets-${light?'light':'dark'}.png`});
await page.getByRole('button',{name:'Build scene · Metered P',exact:true}).click();await page.getByRole('button',{name:'Approve scene',exact:true}).waitFor();
await page.getByRole('button',{name:'Edit scene',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'Scene corrections',exact:true}).inputValue(),'');
await page.getByRole('textbox',{name:'Scene corrections',exact:true}).fill('Move the framing closer.');await page.getByRole('button',{name:'Apply with AI · Metered P',exact:true}).click();
await page.getByRole('button',{name:'Approve scene',exact:true}).waitFor();await page.getByRole('button',{name:'Edit scene',exact:true}).click();assert.equal(await page.getByRole('textbox',{name:'Scene corrections',exact:true}).inputValue(),'');
await page.getByRole('button',{name:'Close scene editor',exact:true}).click();await page.getByRole('button',{name:'Approve scene',exact:true}).click();
const motion=await helper();assert.equal(await motion.inputValue(),'');assert.equal((await calls()).reconstruct,2);
console.log(`PASS ${light?'light':'dark'}: all selected card+circle borders; scene build/edit consumed input stays empty at motion`);
}
await visit('ready=1&review=1&failRebuild=1');await page.getByRole('button',{name:'Edit scene',exact:true}).click();await page.getByRole('textbox',{name:'Scene corrections',exact:true}).fill('Please keep this text on failure.');
await page.getByRole('button',{name:'Apply with AI · Metered P',exact:true}).click();await page.getByRole('dialog').getByText('Fixture interrupted reconstruction.').waitFor();assert.equal(await page.getByRole('textbox',{name:'Scene corrections',exact:true}).inputValue(),'Please keep this text on failure.');console.log('PASS failed reconstruction preserves input');
await visit('ready=1&draft=1&failReturn=1&exportReady=1&remount=1');await page.getByRole('button',{name:'Process movement · Metered P',exact:true}).click();await page.getByText('Fixture interrupted return planning.').waitFor();
assert.equal((await saved()).ledger.draft.prompt,'');assert.equal((await saved()).ledger.draft.generatedPrompt,'@youngGirl walks');await page.getByRole('button',{name:'Reopen fixture editor',exact:true}).click();let motion=await helper();assert.equal(await motion.inputValue(),'');await page.getByRole('button',{name:"Don't use",exact:true}).click();
await page.getByRole('button',{name:'Plan return · Metered P',exact:true}).click();await page.getByRole('button',{name:'Preview return',exact:true}).waitFor();assert.deepEqual(await calls(),{movement:1,return:2});
await page.waitForTimeout(5300);assert.equal(await page.getByRole('button',{name:'Save motion',exact:true}).isEnabled(),true);motion=await helper();assert.equal(await motion.inputValue(),'');
await motion.fill('She stands up, then walks.');await page.getByRole('button',{name:'Use',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Save motion',exact:true}).isEnabled(),false);assert.equal((await saved()).ledger.draft.prompt,'She stands up, then walks.');await page.getByRole('button',{name:'Reopen fixture editor',exact:true}).click();motion=await helper();assert.equal(await motion.inputValue(),'She stands up, then walks.');await page.getByRole('button',{name:'Use',exact:true}).click();
await page.getByRole('button',{name:'Rebuild movement · Metered P',exact:true}).click();await page.getByRole('button',{name:'Preview return',exact:true}).waitFor();assert.deepEqual(await calls(),{movement:2,return:3});assert.equal((await saved()).ledger.draft.prompt,'');assert.equal((await saved()).ledger.draft.generatedPrompt,'She stands up, then walks.');
await page.waitForTimeout(5300);await page.getByRole('button',{name:'Save motion',exact:true}).click();await page.getByRole('button',{name:'Finish mapping',exact:true}).waitFor();motion=await helper();assert.equal(await motion.inputValue(),'');assert.deepEqual(await calls(),{movement:2,return:3});
console.log('PASS movement consumes input before return; retry reuses forward once; deliberate new edit rebuilds; Save has no extra AI calls');
await visit('ready=1&board=1&mappedBoard=1&staleProps=1');await page.getByRole('button',{name:'Close board',exact:true}).click();
assert.equal(await page.getByRole('button',{name:'Try controls',exact:true}).getAttribute('aria-pressed'),'false','loaded saved routes were intercepted by Testing');
const forwardButton=page.getByRole('button',{name:/^Move forward;/});
if(await forwardButton.count()){await forwardButton.hover();await page.mouse.down();}else{const b=await page.getByLabel(/^Spatial analogue drive;/).boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height*.2);}
await page.locator('[data-spatial-playback="forward"] canvas').waitFor();await page.waitForTimeout(5300);await page.mouse.up();assert.equal((await saved()).ledger.draft,undefined);assert.deepEqual(await calls(),{});
console.log('PASS async load of existing routes preserves mapped playback without recording or planning');
assert.deepEqual(errors,[]);
}catch(e){await page.screenshot({path:out+'/failure.png'});console.log('Page errors',errors);throw e;}finally{await browser.close();await server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
