// Explicit opt-in only: real selected-tier calls, isolated from user posts/database/media.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Module=require('node:module'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
if(process.env.BLOCKOUT_LIVE!=='1')throw new Error('Set BLOCKOUT_LIVE=1 only for an authorized live test');
const root=path.resolve(__dirname,'..'),out=path.join(root,process.env.BLOCKOUT_OUTPUT || '.tmp/blockout-live');fs.mkdirSync(out,{recursive:true});
require('../server/node_modules/dotenv').config({path:path.join(root,'server/.env'),quiet:true});
function load(file,mocks={},cache=new Map()){const filename=path.resolve(root,file);if(cache.has(filename))return cache.get(filename).exports;const mod=new Module(filename,module);cache.set(filename,mod);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=name=>Object.hasOwn(mocks,name)?mocks[name]:name.startsWith('.')?load(path.relative(root,path.resolve(path.dirname(filename),name+'.ts')),mocks,cache):Module.prototype.require.call(mod,name);mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);return mod.exports;}
const source='https://blockout-fixture.invalid/source.png',sourceData='data:image/png;base64,'+fs.readFileSync(path.join(out,'source.png')).toString('base64');
const tier=process.env.BLOCKOUT_TIER || 'luna';assert.ok(['luna','terra'].includes(tier));const model=load('server/src/languageModels.ts').languageModelForTier(tier);
const calls=[],usage=[];let charges=0;
const ledger={recordOpenAiUsage(model,response,meta){usage.push({model,usage:response.usage,...meta});},recordPixelCharge(){charges++;},recordReplicateUsage(){}};
const routing=load('server/src/textGeneration.ts',{'./aiUsageLedger':ledger});
const mocks = {
 './aiUsageLedger': ledger,
 './requestAuth': {authenticatedUserId: () => '1'},
 './db': {getPixelsForUser: async () => 1000, trySpendPixels: async () => true},
 './textGeneration': {createRoutedTextClient: sdk => {
   const client = routing.createRoutedTextClient(sdk);
   return {chat: {completions: {create: async request => {
     assert.equal(request.model, model);
     const i = calls.length; calls.push({model: request.model, start: Date.now()});
     console.log(tier+' call', i + 1, 'started');
     const payload = structuredClone(request);
     for (const message of payload.messages) if (Array.isArray(message.content))
       for (const part of message.content) if (part.image_url?.url === source) part.image_url.url = sourceData;
     const cachedAnalysis = process.env.BLOCKOUT_ANALYSIS_PATH && request.messages[0]?.content?.startsWith('Measure the FIRST scene image');
     const replayPath = process.env.BLOCKOUT_REPLAY_DIR && path.join(process.env.BLOCKOUT_REPLAY_DIR, `response-${i+1}.json`);
     const savedResponse = replayPath || cachedAnalysis && process.env.BLOCKOUT_ANALYSIS_PATH;
     const result = savedResponse ? {choices:[{message:{content:fs.readFileSync(savedResponse,'utf8')}}]} : await client.chat.completions.create(payload);
     assert.notEqual(result._clikbProvider, 'replicate', 'This selected-tier test must not silently substitute a different provider');
     calls[i].ms = Date.now() - calls[i].start; calls[i].cachedAnalysis = Boolean(cachedAnalysis); calls[i].replayed = Boolean(replayPath);
     fs.writeFileSync(path.join(out, `response-${i+1}.json`), result.choices[0]?.message?.content || '{}');
     console.log(tier+' call', i + 1, 'finished in', calls[i].ms, 'ms'); return result;
   }}}};
 }}
};
const {spatialWorldPlan}=load('server/src/SpatialWorldPlanRoute.ts',mocks);
async function api(body){let code=200,result;await spatialWorldPlan({body},{status(n){code=n;return this;},json(value){result=value;return this;}});assert.equal(code,200,result?.message);return result;}
(async()=>{const {createServer}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')));const server=await createServer({root,configFile:false,cacheDir:path.join(out,'vite'),optimizeDeps:{entries:['tests/motionBlockout.preview.ts']},server:{host:'127.0.0.1',port:5228,strictPort:true,hmr:false,watch:null},plugins:[{name:'fixture',configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url==='/__blockout'){res.setHeader('Content-Type','text/html');res.end('<script type="module" src="/tests/motionBlockout.preview.ts"></script>');}else next();});}}]});await server.listen();
const {chromium}=require('../.tmp/concierge-browser-deps/node_modules/playwright');const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{const page=await browser.newPage({viewport:{width:720,height:1280},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:5228/')||route.request().url().startsWith('data:')?route.continue():route.abort());await page.goto('http://127.0.0.1:5228/__blockout');await page.waitForFunction(()=>window.renderBlockout);
const prompt='Reconstruct this source image as a simple connected SOLID low-poly motion reference with solid environment and props. Boxes are the base, other simple primitives may complete connected silhouettes. Keep the knight in the left foreground, dragon on the raised landing to the right, continuous stone path and steps, and the stone arch. Match the source camera and visible proportions. The knight is on foot and holds the sword pointing diagonally down to his right. Shared joints connect the solid figures. Represent the man as a simple body underneath his clothing: head, torso, pelvis, two distinct arms and two distinct legs. Ignore his cape and armor entirely, with no clothing panel or slab behind or over his body. Preserve his held sword. Keep the visible body inside the left foreground of the frame. No exposed skeletons.';
let built;
if(process.env.BLOCKOUT_RAW_PATH){const raw=JSON.parse(fs.readFileSync(process.env.BLOCKOUT_RAW_PATH,'utf8'));const layout=JSON.parse(fs.readFileSync(process.env.BLOCKOUT_LAYOUT_PATH,'utf8'));const plan=load('server/src/motionBlockout.ts').prepareMotionBlockout(raw.plan,'9:16',layout,raw.initialState?.relationships || [],raw.walkable);const world=load('server/src/spatialReconstruction.ts').prepareSpatialReconstruction({...raw,plan},{sourceImage:source,aspectRatio:'9:16',drivenName:'Knight',primarySubjectName:'Knight',version:2,revision:'local-test',model:tier});built={world};fs.writeFileSync(path.join(out,'first-response.json'),JSON.stringify(built));fs.writeFileSync(path.join(out,'final-plan.json'),JSON.stringify(world.plan));}
else if(process.env.BLOCKOUT_RESUME==='1')built=JSON.parse(fs.readFileSync(path.join(out,'first-response.json'),'utf8'));
else{built=await api({operation:'reconstruct',llmTier:tier,image:source,prompt,drivenName:'Knight',primarySubjectName:'Knight',aspectRatio:'9:16'});fs.writeFileSync(path.join(out,'first-response.json'),JSON.stringify(built));}
if(process.env.BLOCKOUT_RENDER_ONLY==='1'){await page.evaluate(plan=>window.renderBlockout(plan),JSON.parse(fs.readFileSync(path.join(out,'final-plan.json'),'utf8')));await page.locator('canvas').screenshot({path:path.join(out,'styled-render.png')});return;}
await page.evaluate(plan=>window.renderBlockout(plan),built.world.plan);await page.locator('canvas').screenshot({path:path.join(out,'first-render.png')});
fs.writeFileSync(path.join(out,'final-plan.json'),JSON.stringify(built.world.plan,null,2));await page.locator('canvas').screenshot({path:path.join(out,'final-render.png')});assert.deepEqual(errors,[]);const report={model,calls,usage,charges,automaticReview:false,corrected:false,objects:built.world.plan.objects.length,parts:built.world.plan.objects.reduce((n,o)=>n+(o.parts?.length||1),0),errors};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();await server.close();}})().catch(error=>{console.error(error.message);process.exitCode=1;});

