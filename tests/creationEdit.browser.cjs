const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const ts=require('typescript');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
// Mount the production callbacks and Go/input JSX in React, starting with the
// stuck ready-screen flag. Other application surfaces/providers are isolated.
const source=ts.createSourceFile('PromptInput.tsx',fs.readFileSync(path.join(root,'src/PromptInput.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const names=['handleActualSubmit','handleEditGenerationPlan','StartStory','StartPlan','handleCloseOverlay'];
const declarations={},ui={};
function visit(node){
    if(ts.isVariableDeclaration(node)&&names.includes(node.name.getText(source)))declarations[node.name.getText(source)]='const '+node.getText(source)+';';
    if(ts.isJsxElement(node)){
        const attrs=node.openingElement.attributes.getText(source);
        if(attrs.includes('Update generation plan with AI'))ui.go=node.getText(source);
    }
    if(ts.isJsxSelfClosingElement(node)&&node.attributes.getText(source).includes('Edit generation plan instruction'))ui.input=node.getText(source);
    ts.forEachChild(node,visit);
}visit(source);assert.equal(Object.keys(declarations).length,names.length);assert.ok(ui.go&&ui.input);
const callbacks=names.map(name=>declarations[name]).join('\n');
const owned=new Set(['setCreationConfirmationOpen','setIsSubmittingKick','setshowButton','setGotIm','setError','setPrompt','setPlanEditText','setIsPlanEditSubmitting','setShowPathChoiceOverlay','setParsedKeyPoints','setParsedKeyPoints2','setParsedKeyPointsb','setParsedKeyPointsx','setPlanInfo','setallowSpin','setPlanx','setPostId']);
const stubSetters=[...new Set(callbacks.match(/\bset[A-Za-z_]\w*(?=\()/g))].filter(name=>!owned.has(name)).map(name=>`const ${name}=noop;`).join('\n');
const fixture=ts.transpileModule(`
import React,{useState,useCallback,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {Box,Button,TextField,CircularProgress} from '@mui/material';
import {appAccentButtonSx} from '/src/appAccentStyles.ts';
function App(){
const noop=()=>{},query=new URLSearchParams(location.search);
const [isSubmittingKick,setIsSubmittingKick]=useState(true);
const [allowSpin,setallowSpin]=useState(false);
const [prompt,setPrompt]=useState('Original spaceship');
const [planEditText,setPlanEditText]=useState('');
const [isPlanEditSubmitting,setIsPlanEditSubmitting]=useState(false);
const [showPathChoiceOverlay,setShowPathChoiceOverlay]=useState(true);
const [parsedKeyPoints,setParsedKeyPoints]=useState(['Old scene']);
const [parsedKeyPoints2,setParsedKeyPoints2]=useState(['Old scene']);
const [parsedKeyPointsb,setParsedKeyPointsb]=useState(['Old scene']);
const [parsedKeyPointsx,setParsedKeyPointsx]=useState(['Old scene']);
const [Planx,setPlanx]=useState('Old plan'),[PostId,setPostId]=useState(123);
const [error,setError]=useState(''),[planInfo,setPlanInfo]=useState(0);
const [showButton,setshowButton]=useState(true),[GotIm,setGotIm]=useState(false);
const actualSubmitRef=useRef(null),submitInFlightRef=useRef(false);
const protectedVipCharacterUrlsRef=useRef(new Set()),finalCreationReviewStartedAtRef=useRef(null),finalCreationReviewSentRef=useRef(false);
const homeModelLocked=useRef(false),hasAutoOpenedScenesRef=useRef(false),stepTwoCastingCancelledRef=useRef(false),stepTwoAuditAbortRef=useRef(null),stepOneCastingSnapshotRef=useRef(null),hasStartedCastingRef=useRef(false);
const loggedUser={id:2},GeneratedImage=[],GeneratedImageFlux='',selectedStyle='Auto',modelz='fixture',type=3,APP_STATE='test',CLIK_URL='/api',interactionExperienceMode='spatial';
const remixData='Saved world guide',Vipcharacters=[],promptMusicUrl='',promptMusicSceneCount=2,editGenSnapshot=null;
const darkModeReducer=query.get('light')!=='1',appColor=darkModeReducer?'#69d5ed':'#316bce',matchMobile=query.get('mobile')==='1';
const cb=()=>({}),dispatch=noop,setCreationConfirmationOpen=()=>({}),handleSubmit=noop,callAudio=noop;
const cancelAutomaticGuideCall=noop,sceneDoubleCheckCallId='test',resetVideoModeRunGuard=noop,resetCreationLedger=noop,startNewFluxRun=noop;
const resetPromptMusicState=noop,updateReferenceImages=noop,DEFAULT_IMAGE_MODEL='fixture';
const countAuthoredScenes=()=>0,cleanPoints=x=>x,applyArtStyleToPlan=x=>x,calcModelPixels=()=>5;
const axios={post:async(url,body)=>{const result=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await result.json();if(!result.ok)throw {response:{data}};return {data};}};
const getPixel=async()=>{const {data}=await axios.post('/api/getPixels',{});return data.pixels;};
${stubSetters}
${callbacks}
return <main style={{padding:20,background:'#101318',color:'#fff',minHeight:'95vh'}} data-kick={String(isSubmittingKick)} data-post={PostId} data-plan={String(Planx)}>
{showPathChoiceOverlay?<><p>Ready to continue</p><Box sx={{display:'flex'}}>${ui.input}${ui.go}</Box><button onClick={()=>setShowPathChoiceOverlay(false)}>Skip</button></>:<p role="status">{allowSpin?'Creating scenes…':'Creation restarted'}</p>}
{error&&<p role="alert">{error}</p>}
<p data-scenes>{parsedKeyPoints.join('|')}</p><p data-prompt>{prompt}</p>
<button onClick={()=>setShowPathChoiceOverlay(true)}>Reopen choice</button>
</main>;
}createRoot(document.getElementById('root')).render(<App/>);
`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
(async()=>{
 const output=fs.mkdtempSync(path.join(os.tmpdir(),'creation-edit-'));
 const {createServer}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')));
 const requests=[];let fail='',balance=1000;
 const server=await createServer({root,configFile:false,logLevel:'error',cacheDir:output+'/vite',server:{host:'127.0.0.1',port:5195,strictPort:true,hmr:false},plugins:[{name:'creation-edit',resolveId(id){if(id==='/fixture.js')return '\0creation-edit-fixture';},load(id){if(id==='\0creation-edit-fixture')return fixture;},configureServer(server){server.middlewares.use((req,res,next)=>{
   if(req.url.startsWith('/__test')){res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/fixture.js"></script>');return;}
   if(req.url.startsWith('/api/')){let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{requests.push({url:req.url,body:JSON.parse(body)});setTimeout(()=>{res.setHeader('Content-Type','application/json');if(req.url===fail){res.statusCode=500;res.end(JSON.stringify({message:'Fixture request failed'}));return;}res.end(JSON.stringify(req.url.endsWith('getPixels')?{pixels:balance}:req.url.endsWith('startPlan')?{plan:'New plan'}:{initialSteps:{keyPoints:['New scene 1','New scene 2']}}));},100);});return;}
   next();
 });}}]});await server.listen();
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Browser:',e.message);});page.on('console',m=>{if(m.type()==='error')console.error('Console:',m.text());});page.setDefaultTimeout(60000);
  await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:5195/')?r.continue():r.abort());
  for(const light of [0,1]){
   requests.length=0;await page.goto('http://127.0.0.1:5195/__test?light='+light);
   await page.getByPlaceholder('Edit generation plan...').fill('It should be two scenes');
   const go=page.getByRole('button',{name:'Update generation plan with AI'});assert.equal(await go.isEnabled(),true);
   await go.click();await page.waitForFunction(()=>document.querySelector('[data-scenes]').textContent.includes('New scene 2'));
   assert.deepEqual(requests.map(r=>r.url),['/api/getPixels','/api/startInteractions','/api/startPlan']);
   assert.equal(requests[1].body.pp,"Update: 'It should be two scenes', Original prompt:'Original spaceship'");assert.equal(requests[1].body.interactionExperienceMode,'spatial');
   assert.equal(await page.locator('main').getAttribute('data-post'),'0');assert.equal(await page.locator('main').getAttribute('data-kick'),'false');
   await page.getByRole('button',{name:'Reopen choice'}).click();assert.equal(await page.getByPlaceholder('Edit generation plan...').inputValue(),'');await page.getByRole('button',{name:'Skip',exact:true}).click();
   console.log('PASS '+(light?'light':'dark')+': stuck-ready flag permits Go, restart sends edited text and spatial mode, new scenes arrive and Skip continues');
  }
  for(const endpoint of ['/api/startInteractions','/api/startPlan']){
   fail=endpoint;requests.length=0;await page.goto('http://127.0.0.1:5195/__test?mobile=1');await page.getByPlaceholder('Edit generation plan...').fill('Two scenes');await page.getByRole('button',{name:'Update generation plan with AI'}).click();await page.getByRole('alert').waitFor();
   assert.equal(await page.locator('main').getAttribute('data-kick'),'false');assert.equal(await page.locator('[data-scenes]').textContent(),'');
   fail='';await page.getByRole('button',{name:'Reopen choice'}).click();await page.getByPlaceholder('Edit generation plan...').fill('Try two scenes again');await page.getByRole('button',{name:'Update generation plan with AI'}).click();await page.waitForFunction(()=>document.querySelector('[data-scenes]').textContent.includes('New scene 2'));
   console.log('PASS '+endpoint+': failure clears active flags; a fresh edited creation works again');
  }
  balance=0;requests.length=0;await page.goto('http://127.0.0.1:5195/__test');await page.getByPlaceholder('Edit generation plan...').fill('Two scenes');await page.getByRole('button',{name:'Update generation plan with AI'}).click();await page.getByRole('alert').waitFor();assert.deepEqual(requests.map(r=>r.url),['/api/getPixels']);assert.equal(await page.locator('main').getAttribute('data-post'),'123');assert.equal(await page.getByRole('button',{name:'Update generation plan with AI'}).isEnabled(),true);
  assert.deepEqual(errors,[]);console.log('PASS balance failure: no creation call, Go remains usable; no browser errors');
 }finally{await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
