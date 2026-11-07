const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {pathToFileURL}=require('node:url');
// Bundle this isolated fixture once and fulfil its requests in-process. Vite's
// cold dependency scan of the full app can otherwise stall the initial navigation.
require('./bundledFixtureServer.cjs').install();
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||'../.tmp/concierge-browser-deps/node_modules/playwright');
const root=path.resolve(__dirname,'..'),port=5221;
const {conciergeVisibleView}=require('./loadTs.cjs')('server/src/ConciergeSnapshotBroker.ts');
const raw=fs.readFileSync(path.join(root,'src/PromptInput.tsx'),'utf8').replace(/\r\n/g,'\n');
const source=ts.createSourceFile('PromptInput.tsx',raw,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const callbacks={},hooks={};let confirmation='',promptPreview='';
function visit(node){
 if(ts.isVariableDeclaration(node)&&['handleStartSubmit','confirmCreation','chooseCreationMode'].includes(node.name.getText(source)))callbacks[node.name.getText(source)]='const '+node.getText(source)+';';
 if(ts.isCallExpression(node)&&node.expression.getText(source)==='useCreationControls'&&['setup','confirmation','preview_choice'].includes(node.arguments[0]?.text))hooks[node.arguments[0].text]=node.getText(source)+';';
 if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(source)==='Modal'&&node.openingElement.attributes.getText(source).includes('aria-labelledby="creation-confirmation-title"'))confirmation=node.getText(source);
 if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(source)==='Modal'&&node.openingElement.attributes.getText(source).includes('aria-labelledby="creation-prompt-preview-title"'))promptPreview=node.getText(source);
 ts.forEachChild(node,visit);
}visit(source);assert.ok(confirmation&&hooks.confirmation&&Object.keys(callbacks).length===3);
const storySource=ts.createSourceFile('Storybook.tsx',fs.readFileSync(path.join(root,'src/Storybook.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let startButton='',continueGen='',startHook='';
function visitStory(node){
 if(ts.isVariableDeclaration(node)&&node.name.getText(storySource)==='ContinueGen')continueGen='const '+node.getText(storySource)+';';
 if(ts.isCallExpression(node)&&node.expression.getText(storySource)==='useCreationControls'&&node.arguments[0]?.text==='storybook_start')startHook=node.getText(storySource)+';';
 if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(storySource)==='Button'&&node.openingElement.attributes.getText(storySource).includes("cb('storybook_start', 'start'"))startButton=node.getText(storySource);
 ts.forEachChild(node,visitStory);
}visitStory(storySource);assert.ok(startButton&&continueGen&&startHook);
const progressStart=raw.indexOf('  const creationProgressLiveRef =');
const progressEnd=raw.indexOf('\n\n\n  useEffect(() => {',progressStart);
assert.ok(progressStart>0&&progressEnd>progressStart);
const progress=raw.slice(progressStart,progressEnd);
const compile=text=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
// Real Notepad/editor, Guide, Modal JSX, mode/Go callbacks, progress observer,
// snapshot producers and browser dispatcher; generation/speech are local mocks.
const session=compile(`import React from 'react';
const noop=()=>{},listeners=new Set();const state={guideEnabled:true,guidePanelState:'normal',guidePlayMode:false,status:'idle',chatHistory:[{id:'welcome',role:'ai',content:'Ready to help with this creation.'}]};
const update=patch=>{Object.assign(state,patch);listeners.forEach(listener=>listener());};
const voice={error:null,level:0,start:async()=>update({status:'listening'}),stop:()=>update({status:'idle'}),askText:async text=>{window.sessionTest.messages.push(text);return 'Answer';},speakText:noop,stopSpeech:noop};
window.sessionTest={progress:[],cancels:[],messages:[],resets:0,update};
const chatHistoryRef={current:state.chatHistory};
const setChatHistory=next=>{const chatHistory=typeof next==='function'?next(state.chatHistory):next;chatHistoryRef.current=chatHistory;update({chatHistory});};
const stable={voice,chatHistoryRef,setChatHistory,clearBrainstormSession:async()=>{window.sessionTest.resets++;setChatHistory([]);},setVoiceAskHandler:noop,sessionIdentity:{userId:'fixture-user',username:'Fixture',sessionId:'fixture-session',deviceId:'fixture-device'},buildBrainstormPayload:()=>({messages:[]}),noteMemoryAfterAssistant:noop,waitForCreationMemorySync:async()=>{},textAsk:async text=>{window.sessionTest.messages.push(text);return 'Answer';},setGuideEnabled:guideEnabled=>update({guideEnabled}),setGuidePanelState:guidePanelState=>update({guidePanelState}),setGuidePlayMode:guidePlayMode=>update({guidePlayMode}),hasGuideUseTarget:false,appendGuideTextToTarget:()=>false,isGuideInlineHostActive:false,registerGuideInlineHost:()=>noop,registerGuideUseTarget:()=>noop,runAutomaticGuideCall:async call=>{window.sessionTest.progress.push(call);return 'Progress update';},cancelAutomaticGuideCall:id=>window.sessionTest.cancels.push(id)};
export function useBrainstormSession(){const [,render]=React.useReducer(n=>n+1,0);React.useEffect(()=>{listeners.add(render);return()=>listeners.delete(render);},[]);return {...stable,...state,voice:{...voice,status:state.status}};}`);
const fixture=compile(`
import React,{useState,useCallback,useRef,useEffect} from 'react';import {createRoot} from 'react-dom/client';
import {Provider,useDispatch,useSelector} from 'react-redux';import {MemoryRouter,useLocation,useNavigate} from 'react-router-dom';
import {Box,Button,Modal,IconButton,Typography} from '@mui/material';import {alpha} from '@mui/material/styles';import CloseIcon from '@mui/icons-material/Close';
import DoubleArrowIcon from '@mui/icons-material/DoubleArrow';
import {store} from '/src/store.ts';import {setThemePreference,setAutoControlVisible,setAutoControl,setCreationConfirmationOpen,setPromptRed,cycleAspectRatio} from '/src/settingsSlice.ts';
import {patchUserSnapshot} from '/src/brainstormSlice.ts';import {useCreationControls} from '/src/useCreationControls.ts';import {creationBinding as cb} from '/src/creationControlSnapshot.ts';
import {handleNavigationBrowserRequest,observeCurrentAppSnapshot} from '/src/navigationBrowserControl.ts';
import {useBrainstormSession} from '/src/components/BrainstormSessionProvider.tsx';import {GlobalBrainstormGuide} from '/src/components/GlobalBrainstormGuide.tsx';
import {getCreationImageModelName,getImageModelDisplayName,isGptImageModel} from '/src/imageModels.ts';import {appAccentButtonSx} from '/src/appAccentStyles.ts';import Notepad from '/src/Notepad.tsx';
store.dispatch(setThemePreference('dark'));store.dispatch(setAutoControlVisible({visible:true,actor:'user'}));store.dispatch(setAutoControl({enabled:true,actor:'user'}));
const noop=()=>{},image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="teal"/></svg>');
const refs=[{name:'Alice',type:'character',imageUrl:image,description:'Reference identity'}];
function StoryStartFixture(){
 const [Continue,setContinue]=useState(true),startEdit=false,price4all=78,modelz='Schnell',nanoImages=[image,image],matchMobile=false,darkModeReducer=true;
 const GeneratedImage=[image],GeneratedText=['Cover','Life 1.0'],loggedUser={id:3},s3ResultUrl=image,type=1,timeoutRefsxp=useRef({});
 const handleSubmitFluxImageNew=(...args)=>window.workflow.startCalls.push(args);
 ${continueGen}
 ${startHook}
 return Continue?<div data-creation-owner="Storybook:fixture" style={{marginTop:300,maxWidth:600,display:'grid',gap:12}}><div style={{display:'none'}}>${startButton}</div><div>${startButton}</div><div>${startButton}</div></div>:<output data-start-consumed>Story generation accepted</output>;
}
function App(){
 const dispatch=useDispatch(),location=useLocation(),navigate=useNavigate();
 const type=location.pathname==='/kickit'?1:location.pathname==='/clikit'?3:0,isAllFeeds=location.pathname==='/feeds';
 const [prompt,setPrompt]=useState(''),[isNotepadOpen,setIsNotepadOpen]=useState(false),[minimisePrompt,setminimisePrompt]=useState(false),[showPromptWelcomeUI,setShowPromptWelcomeUI]=useState(false),[storyVisible,setStoryVisible]=useState(false);
 const [promptPreviewOpen,setPromptPreviewOpen]=useState(false),[open,setOpen]=useState(false),[styleModalOpen,setStyleModalOpen]=useState(false),[showInteractionExperienceChoice,setShowInteractionExperienceChoice]=useState(false),[interactionExperienceMode,setInteractionExperienceMode]=useState(null);
 const [confirmationDockHost,setConfirmationDockHost]=useState(null);
 const [creationProgressRunKey,setCreationProgressRunKey]=useState(null),[planInfo,setPlanInfo]=useState(0),[parsedKeyPointsx,setParsedKeyPointsx]=useState([]),[parsedKeyPoints,setParsedKeyPoints]=useState([]),[intentOverview,setIntentOverview]=useState(null),[nanoImages,setNanoImages]=useState([]),[showPathChoiceOverlay,setShowPathChoiceOverlay]=useState(false);
 const creationProgressReportedRef=useRef({runKey:null,milestones:new Set()}),creationProgressBusyRef=useRef(false),creationProgressCallId='creation-progress';
 const {guideEnabled,runAutomaticGuideCall,cancelAutomaticGuideCall}=useBrainstormSession();
 const creationConfirmationOpen=useSelector(s=>s.settings.creationConfirmationOpen),autoControlEnabled=useSelector(s=>s.settings.autoControlEnabled),autoControlVisible=useSelector(s=>s.settings.autoControlVisible);
 const ratioKey=useSelector(s=>s.settings.aspectRatio),darkModeReducer=true,appColor='#c487ed',appColorDark=appColor,appColorLight='#316bce';
 const selectedStyle='Auto',modelz='Schnell',modelRedux=modelz,imageModelPreview=null,artstylePreview=null,artstyleRedux='Auto',languageModel='luna';
 const models=[{name:modelz,img:image}],LANGUAGE_MODELS=[{id:'luna',name:'Luna',image}],exampleSets=[{model_images:{Schnell:image}}],Vipcharacters=refs,selectedWorldId='world-7';
 const showWorldModel=false,promptMusicPickerOpen=false,creationStage={isComposer:true},planEditText='';
 const handleActualSubmit=async()=>{window.workflow.generations.push({prompt,type,model:modelz,refs:Vipcharacters,route:location.pathname});setCreationProgressRunKey(Date.now());setPlanInfo(1);};
 ${Object.values(callbacks).join('\n')}
 ${Object.values(hooks).join('\n')}
 ${progress}
 useEffect(()=>{dispatch(patchUserSnapshot({route:location.pathname,ui:{minimisePrompt:false},creation:{isActive:true,isInitialComposer:true,stage:'prompt_input_golden_prompt',mode:isAllFeeds?'Unselected':type===1?'Cinema':type===3?'Games':'Shorts',modeType:isAllFeeds?undefined:type,modeSelectionRequired:isAllFeeds,goBlockedReason:isAllFeeds?'Choose Shorts, Games or Cinema to continue.':null}}));},[isAllFeeds,type]);
 useEffect(()=>{if(creationProgressRunKey)dispatch(patchUserSnapshot({creation:{isInitialComposer:false,isCompactOverlay:parsedKeyPoints.length===0}}));},[dispatch,creationProgressRunKey,parsedKeyPoints.length]);
 const existing=window.workflow||{generations:[],enters:0,startCalls:[]};window.workflow={...existing,snapshot:observeCurrentAppSnapshot,run:message=>handleNavigationBrowserRequest(message,window.location.origin),showStory:()=>setStoryVisible(true),current:()=>({prompt,type,route:location.pathname,open:isNotepadOpen,model:modelz,refs:Vipcharacters}),permission:enabled=>dispatch(setAutoControl({enabled,actor:'user'})),milestone:patch=>{if(patch.phase!==undefined)setPlanInfo(patch.phase);if(patch.outline)setParsedKeyPointsx(patch.outline);if(patch.scenes)setParsedKeyPoints(patch.scenes);if(patch.intent)setIntentOverview(patch.intent);if(patch.previews)setNanoImages(patch.previews);if(patch.done)setShowPathChoiceOverlay(true);}};
 return <main style={{minHeight:'100vh',background:'#141922',color:'white',padding:20}}>
 <Button {...cb('setup','editor','Open Notepad editor','setIsNotepadOpen(true)')} onClick={()=>setIsNotepadOpen(true)}>Open prompt</Button>
 <Button {...cb('setup','create','Review creation setup','handleStartSubmit')} onClick={handleStartSubmit}>Create</Button>
 <output data-saved>{prompt}</output>
 <Notepad open={isNotepadOpen} value={prompt} onChange={setPrompt} onClose={()=>setIsNotepadOpen(false)} setIsNotepadOpen={setIsNotepadOpen} hide={false} type={type} mode={0} placeholder="Enter a Prompt To Recreate The Image" handleKeyDown={e=>{if(e.key==='Enter')window.workflow.enters++;}} setTextFieldactive={noop} GeneratedImage={[]} referenceImages={refs} ImagesHdCloud={[image]} darkMode={true} showTemplates={true}/>
 <GlobalBrainstormGuide minimisePrompt={false} creationTop confirmationDockHost={confirmationDockHost}/>
 ${confirmation}
 ${promptPreview}
 {showPathChoiceOverlay&&<div data-creation-owner="PromptInput:preview_choice"><button {...cb('preview_choice','skip','Skip characters and continue to storyboard','handleSkipCharacters','click','candidate')} onClick={()=>{setShowPathChoiceOverlay(false);setStoryVisible(true);}}>Skip</button><button {...cb('preview_choice','create_characters','Create characters from generated scenes','runAutoCastingPipeline','click','candidate')} onClick={()=>setShowPathChoiceOverlay(false)}>Create Characters</button></div>}{storyVisible&&<StoryStartFixture/>}
 </main>;
}createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter initialEntries={[new URLSearchParams(window.location.search).get('route')||'/feeds']}><App/></MemoryRouter></Provider>);
`);
(async()=>{
 const {createServer}=require('./bundledFixtureServer.cjs');
 const replies=new Map();
 // RAG checks explicitly opt this isolated fixture into the existing custom dev
 // mode. Production's original VITE_APPX_STATE gate is not changed or bypassed.
 const server=await createServer({root,configFile:false,logLevel:'error',define:{'import.meta.env.VITE_APPX_STATE':JSON.stringify('dev')},cacheDir:'.tmp/creation-workflow-vite',esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port,strictPort:true,hmr:false},plugins:[{
  name:'creation-workflow',enforce:'pre',resolveId(id,importer){if(id==='/fixture.js')return '\0workflow';if(id.includes('BrainstormSessionProvider'))return '\0session';if(importer?.includes('NotepadEditor')&&id.includes('GlobalBrainstormGuide'))return '\0inline-guide';},
  load(id){if(id==='\0workflow')return fixture;if(id==='\0session')return session;if(id==='\0inline-guide')return 'export const GlobalBrainstormGuide=()=>null;';},
  configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url.startsWith('/__test')){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0}*,*::before,*::after{animation:none!important;transition:none!important}.MuiDialog-paper{transform:scale(1)!important}</style><div id="root"></div><script type="module" src="/fixture.js"></script>');return;}if(req.url==='/navigation/browser-reply'){let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{const data=JSON.parse(body);replies.set(data.requestId,data.reply);res.end('{}');});return;}next();});}
 }]},fixture);await server.listen();
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Browser:',e.message);});page.setDefaultTimeout(45000);
  let ragRequests=0;
  await page.route('**/*',route=>{
   if(new URL(route.request().url()).pathname==='/get_rag_instructions'){
    ragRequests++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ragInstructions:[]})});
   }
   return route.request().url().startsWith('http://127.0.0.1:'+port+'/')?route.continue():route.abort();
  });
  let sequence=0;
  const controls=s=>Object.values(s.creation.controls.areas).flatMap(a=>a.controls);
  async function action(actionId,text){
   await page.waitForFunction(id=>window.workflow&&Object.values(window.workflow.snapshot().creation.controls.areas).some(a=>a.controls.some(c=>c.actionId===id)),actionId);
   const observed=await page.evaluate(()=>window.workflow.snapshot());
   const visible=conciergeVisibleView(observed);
   assert.ok(Object.values(visible.areas).some(area=>area.controls.some(control=>control.actionId===actionId)), 'Concierge foreground must retain real executable control '+actionId);
   const expectedVersion=await page.evaluate(()=>window.workflow.snapshot().creation.controls.stateVersion),requestId='workflow-'+(++sequence);
   await page.evaluate(message=>window.workflow.run(message),{requestId,command:text===undefined?'action':'text',actionId,expectedVersion,...(text===undefined?{}:{text})});
   assert.ok(replies.has(requestId));const reply=replies.get(requestId);assert.equal(reply.status,'dispatched',JSON.stringify(reply));return reply;
  }
  const brief='Create a cinematic visual essay recapping Life 3.0 by Max Tegmark. Keep Alice as our guide. Stop before publishing so I can review and publish myself.';
  await page.clock.install();await page.goto('http://127.0.0.1:'+port+'/__test');
  await action('clikb.creation.setup.action.editor');
  await page.clock.fastForward(400); // Finish the real MUI Grow transition before testing zoom geometry.
  await action('clikb.creation.notepad.action.prompt',brief);
  assert.equal(await page.evaluate(()=>window.workflow.current().prompt),'','draft stays local until close');
  await page.locator('[data-creation-control="clikb.creation.notepad.control.reference_1"]').click();
  await page.getByText('Alice',{exact:true}).click();
  await action('clikb.creation.notepad.action.zoom_close');
  assert.equal(await page.locator('textarea[data-creation-control="clikb.creation.notepad.control.prompt"]').inputValue(),brief,'zoom Close keeps Notepad draft open');
  await action('clikb.creation.notepad.action.close');
  assert.equal(await page.evaluate(()=>window.workflow.current().prompt),brief);assert.equal(await page.evaluate(()=>window.workflow.enters),0,'mapped outside close never invokes Enter/submit');
  const desktopComposerTop=(await page.locator('[data-guide-ui]').boundingBox()).y;
  await action('clikb.creation.setup.action.create');
  assert.equal(await page.locator('[data-creation-confirmation-guide] [data-guide-ui]').count(),0,'Desktop confirmation keeps its existing Concierge placement');
  let snapshot=await page.evaluate(()=>window.workflow.snapshot()),confirmationState=snapshot.creation.controls.areas['clikb.creation.confirmation'].state;
  assert.equal(confirmationState.mode,null);assert.equal(confirmationState.modeSelectionRequired,true);
  assert.equal(controls(snapshot).find(c=>c.actionId==='clikb.creation.confirmation.action.go').enabled,false);assert.match(controls(snapshot).find(c=>c.actionId==='clikb.creation.confirmation.action.go').disabledReason,/Choose Shorts, Games or Cinema/);
  for(const mode of ['shorts','games','cinema'])assert.ok(controls(snapshot).some(c=>c.actionId==='clikb.creation.confirmation.action.mode_'+mode));
  // The production MUI modal must allow the visible production Guide to type.
  await page.locator('[aria-label="Open Guide input"]').click();
  const guideInput=page.locator('textarea[aria-label="Message to Guide"]');await guideInput.fill('Keep the requested Cinema mode');await guideInput.press('End');await guideInput.pressSequentially(' please');
  assert.equal(await guideInput.inputValue(),'Keep the requested Cinema mode please');assert.equal(await guideInput.evaluate(e=>e===document.activeElement),true,'modal does not steal Guide input focus');await guideInput.press('Escape');
  await action('clikb.creation.confirmation.action.mode_cinema');
  snapshot=await page.evaluate(()=>window.workflow.snapshot());confirmationState=snapshot.creation.controls.areas['clikb.creation.confirmation'].state;
  assert.equal(confirmationState.mode,1);assert.equal(confirmationState.modeSelectionRequired,false);assert.equal(confirmationState.goBlockedReason,null);
  assert.ok(!controls(snapshot).some(c=>/confirmation.action.mode_/.test(c.actionId)));
  assert.equal(await page.evaluate(()=>window.workflow.current().prompt),brief);
  await action('clikb.creation.confirmation.action.read_prompt');
  await page.getByText('Your prompt',{exact:true}).waitFor();
  snapshot=await page.evaluate(()=>window.workflow.snapshot());
  const readablePreview=conciergeVisibleView(snapshot);
  assert.ok(readablePreview.liveFields.some(field=>field.mode==='displayed-submitted'&&field.value.includes(brief)),'real Typography preview must expose the complete saved prompt');
  assert.ok(!JSON.stringify(readablePreview.areas).includes('confirmation.action.go'),'covered GO stays unavailable while preview is open');
  await action('clikb.creation.confirmation.action.close_prompt');
  snapshot=await page.evaluate(()=>window.workflow.snapshot());
  assert.equal(conciergeVisibleView(snapshot).areas['clikb.creation.confirmation'].controls.find(c=>c.actionId==='clikb.creation.confirmation.action.go').enabled,true,'closing an inspected preview restores GO');
  await action('clikb.creation.confirmation.action.go');
  await page.waitForFunction(()=>window.workflow.snapshot().creation.isInitialComposer===false);
  assert.equal((await page.locator('[data-guide-ui]').boundingBox()).y,desktopComposerTop,'Desktop Concierge stays above the compact composer after Go');
  assert.deepEqual(await page.evaluate(()=>window.workflow.generations.map(({prompt,type,model,refs,route})=>({prompt,type,model,names:refs.map(r=>r.name),route}))),[{prompt:brief,type:1,model:'Schnell',names:['Alice'],route:'/kickit'}]);
  // Real source observer, fake browser clock: useful milestones only while On.
  await page.clock.fastForward(4100);assert.equal(await page.evaluate(()=>window.sessionTest.progress.length),1);
  await page.clock.fastForward(12000);assert.equal(await page.evaluate(()=>window.sessionTest.progress.length),1,'unchanged milestone stays quiet');
  await page.evaluate(()=>window.workflow.milestone({outline:['One','Two']}));await page.clock.fastForward(4100);assert.equal(await page.evaluate(()=>window.sessionTest.progress.length),2);
  await page.evaluate(()=>window.workflow.permission(false));await page.evaluate(()=>window.workflow.milestone({scenes:['One','Two']}));await page.clock.fastForward(12000);assert.equal(await page.evaluate(()=>window.sessionTest.progress.length),2,'Auto Control Off suppresses progress');
  await page.evaluate(()=>window.workflow.permission(true));await page.clock.fastForward(4100);assert.equal(await page.evaluate(()=>window.sessionTest.progress.length),3);
  assert.ok((await page.evaluate(()=>window.sessionTest.progress)).every(c=>c.callId==='creation-progress'&&/Mode: Cinema/.test(c.message)&&/not a new user instruction/.test(c.message)));
  await page.evaluate(()=>window.workflow.milestone({done:true,previews:['preview']}));await page.clock.fastForward(12000);assert.equal(await page.evaluate(()=>window.sessionTest.progress.length),3,'completed preparation stops loading announcements');
  console.log('PASS All Feeds: fresh snapshots, real Notepad draft/save, Guide focus over setup, mode choice preserves brief/model/references, mocked Go and On-only deduplicated milestones');
  await page.clock.resume();
  snapshot=await page.evaluate(()=>window.workflow.snapshot());assert.ok(snapshot.creation.controls.areas['clikb.creation.preview_choice'],'preview_choice area mounts when preparation completes');assert.equal(snapshot.creation.controls.areas['clikb.creation.preview_choice'].state.sceneCount,2);await action('clikb.creation.preview_choice.action.skip');
  await page.locator('[data-creation-control="clikb.creation.storybook_start.control.start"]:visible').first().waitFor();
  assert.equal(await page.locator('[data-creation-control="clikb.creation.storybook_start.control.start"]:visible').count(),2,'repeated Start copies on scene cards 2 and 3 are mounted');
  await action('clikb.creation.storybook_start.action.start');
  assert.deepEqual(await page.evaluate(()=>window.workflow.startCalls.map(args=>({prompt:args[1],index:args[3]}))),[{prompt:'Life 1.0',index:1}]);
  await page.locator('[data-start-consumed]').waitFor();
  assert.ok(!controls(await page.evaluate(()=>window.workflow.snapshot())).some(c=>c.actionId==='clikb.creation.storybook_start.action.start'),'consumed Start is removed from live controls');
  console.log('PASS actual Storybook Start JSX, control publication, browser click and ContinueGen callback reach exactly one mocked generation');
  for(const route of ['/images','/kickit','/clikit']){
   await page.goto('http://127.0.0.1:'+port+'/__test?route='+encodeURIComponent(route));
   if(route==='/images'){
    await action('clikb.creation.setup.action.editor');
    await page.locator('[data-creation-control="clikb.creation.notepad.control.reference_1"]').click();
    await page.getByText('Alice',{exact:true}).click();
    await page.locator('[data-creation-control="clikb.creation.notepad.control.zoom_close"]').locator('..').click({position:{x:4,y:4}});
    assert.equal(await page.evaluate(()=>window.workflow.current().open),true,'zoom backdrop closes only image preview');
    await action('clikb.creation.notepad.action.close');
   }
   await action('clikb.creation.setup.action.create');snapshot=await page.evaluate(()=>window.workflow.snapshot());
   assert.equal(snapshot.creation.controls.areas['clikb.creation.confirmation'].state.modeSelectionRequired,false);assert.ok(!controls(snapshot).some(c=>/confirmation.action.mode_/.test(c.actionId)));assert.equal(controls(snapshot).find(c=>c.actionId==='clikb.creation.confirmation.action.go').enabled,true);
  }
  console.log('PASS direct Shorts/Cinema/Games reviews use established mode without All Feeds choices');
  // Actual Brainstorm UI must retain its existing X/Stay/Leave/Reset boundary.
  // No outer save/close header or executable backdrop may bypass that boundary.
  await page.goto('http://127.0.0.1:'+port+'/__test?route=%2Fkickit');
  await action('clikb.creation.setup.action.editor');
  await action('clikb.creation.notepad.action.prompt',brief);
  assert.equal(await page.getByRole('button',{name:'Save and close Notepad',exact:true}).count(),0);
  assert.equal(await page.locator('.MuiDialog-container[data-creation-control="clikb.creation.notepad.control.close"]').count(),1,'close maps the existing outside area');
  await action('clikb.creation.assistant.action.brainstorm');
  await page.getByText('Brainstorm Assistant',{exact:true}).waitFor();
  fs.mkdirSync('.tmp/concierge-execution/screens',{recursive:true});await page.screenshot({path:'.tmp/concierge-execution/screens/chat-surface.png'});
  assert.ok(!controls(await page.evaluate(()=>window.workflow.snapshot())).some(c=>c.actionId==='clikb.creation.notepad.action.close'),'outer close is unavailable inside Brainstorm');
  assert.equal(await page.locator('[data-creation-control="clikb.creation.notepad.control.close"]').count(),0);
  await page.mouse.click(4,4);await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>window.workflow.current().open),true);
  await page.getByText('Brainstorm Assistant',{exact:true}).waitFor();
  const blockedRequest='workflow-'+(++sequence);
  await page.evaluate(message=>window.workflow.run(message),{requestId:blockedRequest,command:'action',actionId:'clikb.creation.notepad.action.close',expectedVersion:await page.evaluate(()=>window.workflow.snapshot().creation.controls.stateVersion)});
  assert.equal(replies.get(blockedRequest)?.status,'stale_or_unavailable','stale outer action cannot bypass Brainstorm');
  // Escape opens the same guarded leave confirmation as the close button.
  // Stay explicitly before testing the underlying developer tools.
  await action('clikb.creation.brainstorm.action.stay');
  await page.getByRole('button',{name:'Open RAG injector',exact:true}).click();
  await page.getByRole('button',{name:'Close RAG injector',exact:true}).waitFor();
  await page.getByRole('button',{name:/^Instructions/}).click();
  await page.getByRole('button',{name:'Upload RAG',exact:true}).waitFor();
  assert.ok(ragRequests>0,'developer RAG panel loads only the mocked local response');
  await page.getByRole('button',{name:'Close RAG injector',exact:true}).click();
  await action('clikb.creation.brainstorm.action.close');
  await page.getByText('Leave brainstorm?',{exact:true}).waitFor();
  await action('clikb.creation.brainstorm.action.stay');
  assert.equal(await page.getByText('Leave brainstorm?',{exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>window.sessionTest.resets),0);
  await action('clikb.creation.brainstorm.action.close');
  await action('clikb.creation.brainstorm.action.leave');
  await page.getByText('Brainstorm Assistant',{exact:true}).waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>window.workflow.current().open),true,'Leave returns to the same Notepad');
  assert.equal(await page.evaluate(()=>window.sessionTest.resets),0,'Leave preserves the conversation');
  await action('clikb.creation.assistant.action.brainstorm');
  await action('clikb.creation.brainstorm.action.close');
  await page.getByRole('button',{name:'Reset',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.sessionTest.resets),1,'Reset remains the explicit conversation-clear action');
  await page.getByText('Leave brainstorm?',{exact:true}).waitFor();
  await action('clikb.creation.brainstorm.action.leave');
  await action('clikb.creation.notepad.action.close');
  assert.equal(await page.evaluate(()=>window.workflow.current().prompt),brief,'returning from Brainstorm preserves the pending Notepad draft');
  assert.equal(await page.evaluate(()=>window.workflow.enters),0);
  assert.equal(await page.evaluate(()=>window.workflow.generations.length),0,'boundary checks never trigger generation');
  assert.deepEqual(errors,[]);
  console.log('PASS no added Notepad header; real Brainstorm close confirmation/Stay/Leave/Reset, guarded outside click and mocked dev RAG panel; no live API calls or browser errors');

  await page.setViewportSize({width:390,height:600});
  await page.goto('http://127.0.0.1:'+port+'/__test?route=/images');
  await action('clikb.creation.setup.action.editor');
  await page.clock.fastForward(400);
  await action('clikb.creation.notepad.action.prompt','Two scenes of a city at sunrise');
  await action('clikb.creation.notepad.action.close');
  const guide=page.locator('[data-guide-ui]');
  await guide.waitFor();
  const composerTop=(await guide.boundingBox()).y;
  await action('clikb.creation.setup.action.create');
  const dockedGuide=page.locator('[data-creation-confirmation-guide] [data-guide-ui]');
  const confirmationPanel=page.locator('[data-creation-confirmation-panel]');
  await dockedGuide.waitFor();
  const assertNoOverlap=async()=>{
   const guideBounds=await dockedGuide.boundingBox(),panelBounds=await confirmationPanel.boundingBox();
   assert.ok(guideBounds.y>=0&&guideBounds.y<30,'Confirmation Guide sits at the mobile safe-area top');
   assert.ok(guideBounds.y+guideBounds.height<panelBounds.y,'The confirmation panel starts below the full Guide');
   assert.ok(panelBounds.y+panelBounds.height<=600,'The confirmation panel fits inside the viewport');
  };
  await assertNoOverlap();
  await page.getByRole('button',{name:'Open Guide input'}).click();
  await page.getByRole('textbox',{name:'Message to Guide'}).fill('Keep the 9:16 aspect ratio');
  await assertNoOverlap();
  await action('clikb.creation.confirmation.action.close');
  await dockedGuide.waitFor({state:'hidden'});
  assert.equal((await guide.boundingBox()).y,composerTop,'Closing confirmation restores the mobile composer position');
  await action('clikb.creation.setup.action.create');
  await confirmationPanel.locator('[data-creation-control="clikb.creation.confirmation.control.go"]').scrollIntoViewIfNeeded();
  await action('clikb.creation.confirmation.action.go');
  await dockedGuide.waitFor({state:'hidden'});
  await page.waitForFunction(()=>window.workflow.snapshot().creation.isInitialComposer===false);
  assert.equal((await guide.boundingBox()).y,composerTop,'Mobile Concierge stays above the compact composer after Go');
  assert.deepEqual(errors,[]);
  console.log('PASS mobile confirmation keeps Concierge above the panel in reply and input modes and restores its composer position');
 }finally{await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
