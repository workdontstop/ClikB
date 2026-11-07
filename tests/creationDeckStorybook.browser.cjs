const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {build}=require('esbuild');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||'../.tmp/concierge-browser-deps/node_modules/playwright');
const root=path.resolve(__dirname,'..');
const loadTs=require('./loadTs.cjs');
const {chooseJevProposedOperation,assessJevAction}=loadTs('server/src/JevActionGate.ts',{'./JevDecisionService':{}});
const {executeApprovedConciergeOperation}=loadTs('server/src/ConciergeBrowserOperation.ts');
const {creationExecutionContext}=loadTs('server/src/creationControlIdentity.ts');
const ragContext='ACTIVE_SNAPSHOT_MODE_RAG_ID: clikb_creation\n'+fs.readFileSync(path.join(root,'docs/apps live rag fro app control/03_creation_intro.rag.txt'),'utf8')+'\nRAG_TRAINING_MEMORY_STATUS: skipped';
const original=fs.readFileSync(path.join(__dirname,'storybookInitialMount.browser.cjs'),'utf8');
const fixtureText=original.slice(original.indexOf('const fixture=')+14,original.indexOf('\n(async()=>'));
let fixture=Function('return '+fixtureText.replace(/;\s*$/,''))();
fixture=fixture.replace(/MemoryRouter/g,'BrowserRouter')
.replace('<Storybook {...props}/>', '<StatefulStorybook/>')
.replace("createRoot(document.getElementById('root'))", "function StatefulStorybook(){const [video,setVideo]=React.useState(props.VideMode);const [broll,setBroll]=React.useState(props.isBShotModeActive);const [narration,setNarration]=React.useState(false);return <Storybook {...props} VideMode={video} setVideMode={setVideo} isBShotModeActive={broll} setIsBShotModeActive={setBroll} cinemaNarrationEnabled={narration} onCinemaNarrationChange={setNarration}/>;} createRoot(document.getElementById('root'))")
.replace("const noop=()=>{}", "history.replaceState({idx:1,clikbPromptInput:{id:'creation-fixture',baseIndex:0}},''); const noop=()=>{}")
.replace('const props={', "const props={onCreationDeckModels:()=>{},onCreationDeckCharacters:()=>{},onCreationDeckCloseCreation:()=>{},")
.replace('const [narration,setNarration]=React.useState(false);', 'const [narration,setNarration]=React.useState(false);const [audioProgress,setAudioProgress]=React.useState(false);window.setFixtureAudioProgress=setAudioProgress;')
.replace('cinemaNarrationEnabled={narration}', 'isAudioGenerating={audioProgress} setIsAudioGenerating={setAudioProgress} cinemaNarrationEnabled={narration}')
.replace('const [audioProgress,setAudioProgress]=React.useState(false);', 'const [audioProgress,setAudioProgress]=React.useState(false);const [loaders,setLoaders]=React.useState([]);window.setFixtureLoaders=setLoaders;')
.replace('isAudioGenerating={audioProgress}', 'loadersArray={loaders} setLoadersArray={setLoaders} isAudioGenerating={audioProgress}')
.replace("import {store} from './src/store';", "import {store} from './src/store'; import {setDeckEnabled,setAutoControlVisible,setAutoControl,setConciergeEnabled} from './src/settingsSlice'; store.dispatch(setAutoControlVisible({visible:true,actor:'user'})); store.dispatch(setAutoControl({enabled:true,actor:'user'})); store.dispatch(setConciergeEnabled(true)); import {observeCurrentAppSnapshot,handleNavigationBrowserRequest} from './src/navigationBrowserControl'; window.observe=observeCurrentAppSnapshot; window.store=store; window.deckOff=()=>store.dispatch(setDeckEnabled(false));")
.replace("window.store=store;", "window.store=store; import {creationExecutionContext} from './server/src/creationControlIdentity'; window.actionContext=(id,kind='click')=>creationExecutionContext(observeCurrentAppSnapshot(),id,kind);")
.replace('window.mountResult={error:null};', "window.mountResult={error:null}; window.fetch=async(url,options)=>{if(String(url).endsWith('/navigation/browser-reply')){window.reply=JSON.parse(options.body).reply;return Response.json({ok:true});}return Response.json({});};window.run=async(actionId,text)=>{const s=observeCurrentAppSnapshot();await handleNavigationBrowserRequest({command:text==null?'action':'text',text,requestId:Math.random().toString(),actionId,expectedVersion:s.creation.controls.stateVersion},'http://fixture.test');return window.reply;};");
fixture=fixture.replace('return Response.json({});};window.run=', 'if(String(url).endsWith("/ImageDesignStoryStage")&&JSON.parse(options.body||"{}").isBShotPrompt)await new Promise(resolve=>setTimeout(resolve,1500));return Response.json({});};window.run=');
fixture=fixture.replace("window.run=async(actionId,text)=>", "window.run=async(actionId,text,expectedCreationContext)=>").replace("command:text==null?'action':'text',text,requestId:", "command:text==null?'action':'text',text,expectedCreationContext:expectedCreationContext||window.actionContext(actionId,text==null?'click':'text'),requestId:");
const session="const noop=()=>{};const session={syncCreationMemoryCards:noop,registerGuideUseTarget:()=>noop,registerGuideInlineHost:()=>noop,guideEnabled:false,chatHistory:[],setChatHistory:noop};export const useBrainstormSession=()=>session;";
(async()=>{
const result=await build({stdin:{contents:fixture,loader:'tsx',resolveDir:root},bundle:true,write:false,jsx:'automatic',platform:'browser',format:'iife',loader:{'.css':'empty','.png':'dataurl','.jpg':'dataurl','.svg':'dataurl','.webp':'dataurl','.mp3':'dataurl','.mp4':'dataurl','.gif':'dataurl'},define:{'import.meta.env':'{}','process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated-session',setup(b){b.onLoad({filter:/BrainstormSessionProvider\.tsx$/},()=>({contents:session,loader:'tsx'}));}}],logLevel:'silent'});
const css=['DeckOverlay.css','CreationDeck.css'].map(f=>fs.readFileSync(path.join(root,'src',f),'utf8')).join('\n');
const html='<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><div id="root"></div><script>'+result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>';
const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
 await page.addInitScript(()=>{
   window.expectDeck=true;window.bareGridFrames=[];
   const frame=()=>{
     const grid=document.querySelector('[data-creation-control="clikb.creation.storybook_grid.control.scroll_scenes"]');
     const workstation=[...document.querySelectorAll('[data-creation-control^="clikb.creation.workstation_"]')]
       .some(node=>node.getBoundingClientRect().height>0&&!node.closest('[aria-hidden="true"]'));
     if(window.expectDeck&&grid&&!grid.closest('[data-creation-deck-covered="true"]')&&!document.querySelector('.creation-deck')&&!workstation)
       window.bareGridFrames.push(performance.now());
     requestAnimationFrame(frame);
   };requestAnimationFrame(frame);
 });
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:html})
   : r.request().url().endsWith('/lambdaFfmpeg/start')?r.fulfill({json:{jobId:'fixture',statusBucket:'fixture',statusKey:'fixture'}})
   : r.request().url().endsWith('/lambdaFfmpeg/status')?r.fulfill({json:{state:'failed',stage:'failed',message:'Fixture render failed'}})
   : r.request().resourceType()==='image'?r.fulfill({contentType:'image/jpeg',body:fs.readFileSync(path.join(root,'cinema.jpg'))}):r.fulfill({json:{}}));
 await page.goto('http://fixture.test/storybook?type=0');
 const deck=page.locator('.creation-deck');
 await deck.waitFor();
 assert.deepEqual(await page.evaluate(()=>window.bareGridFrames),[],'Initial Deck opens before a bare Grid frame paints');
 await deck.locator('.deck-category').click();
 assert.equal(await deck.locator('[data-creation-control*=".control.deck_mode_"]').count(),0,'Initial incomplete storyboard does not offer unavailable stage jumps');
 assert.equal(await deck.locator('.creation-deck-menu > button:disabled').count(),0);
 await deck.getByRole('button',{name:'Klein',exact:true}).waitFor();
 await deck.getByRole('button',{name:'Characters',exact:true}).waitFor();
 await page.goto('http://fixture.test/storybook?type=0&restore=true');
 const action = async (actionId, text) => {
   await page.locator(`.creation-deck [data-ai-action="${actionId}"]`).scrollIntoViewIfNeeded();
   const snapshot=await page.evaluate(()=>window.observe());
   const userGoal=text==null?'Use the selected live Creation control':'Set the requested Storyboard scene number';
   const choice=await chooseJevProposedOperation({userGoal,proposal:JSON.stringify({suggestedActionId:actionId,...(text!=null?{textValue:text}:{})}),snapshot},async consultation=>{
     assert.ok(consultation.options.includes(actionId),'Jev can select the live Creation control');
     return {status:'ok',answer:{type:'choice',choice:actionId}};
   });
   assert.equal(choice.status,'selected');
   const approval=await assessJevAction({userGoal,operation:choice.operation,snapshot,ragContext},async consultation=>{
     if(/clikb\.creation\.deck_view\.action\.(scene_number|show_scene|open_scene)$/.test(actionId)) assert.match(consultation.controlFrame.relevantRagRule,/show_scene centres that card or open_scene enters its workstation/,'Jev receives current Deck operation meanings');
     return {status:'ok',answer:{type:'choice',choice:actionId}};
   });
   assert.equal(approval.status,'approved');
   const expectedCreationContext=creationExecutionContext(snapshot,actionId,text==null?'click':'text');
   const reply=await executeApprovedConciergeOperation({operation:choice.operation,stateVersion:snapshot.creation.controls.stateVersion,feedsContext:'',latestRealUserText:userGoal,expectedCreationContext,
     observe:async()=>({status:'observed',snapshot:await page.evaluate(()=>window.observe())}),cancelled:()=>false,
     dispatch:async(_command,id,_version,_scroll,_direction,_confirmed,_feeds,input,context)=>page.evaluate(([id,input,context])=>window.run(id,input,context),[id,input,context])});
   assert.equal(reply.status, 'dispatched', JSON.stringify(reply));
 };
 await page.locator('.creation-deck').waitFor();
 const start=page.locator('.creation-deck [data-ai-action="clikb.creation.storybook_start.action.start"]');
 if(await start.count())await start.click();
 await page.waitForTimeout(400);
 const autoPill=page.locator('.creation-deck-auto');
 if(await autoPill.count()){
   assert.match(await autoPill.innerText(),/Auto/);
   const bounds=await autoPill.boundingBox();
   assert.ok(bounds.width>bounds.height,'Auto remains a labelled pill');
 }
 await page.screenshot({path:path.join(root,'.tmp','creation-deck-storybook-'+width+'.png')});
 await action('clikb.creation.deck_view.action.settings');
 assert.equal(await deck.locator('[data-creation-control="clikb.creation.storybook_grid.control.deck_mode_0"]').count(),0,'Current Images stage is not offered as an action');
 assert.equal(await deck.locator('[data-creation-control*=".control.deck_mode_"]').count(),0,'Fresh Images stage has no Video or B-roll shortcuts');
 assert.equal(await deck.locator('.creation-deck-menu > button:disabled').count(),0,'Unavailable modes are absent rather than disabled');
 const menu=deck.locator('.creation-deck-menu');
 assert.equal(await menu.getByRole('button',{name:/^Scene \d/}).count(),0,'Settings contains no scene shortcuts');
 assert.equal(await menu.locator('button').last().innerText(),'Exit creation');
 const exitColor=await menu.locator('button').last().evaluate(button=>getComputedStyle(button).color);
 assert.match(exitColor,/rgb\((180, 35, 52|255, 135, 148)\)/);
 await action('clikb.creation.deck_view.action.settings');
 const stage=deck.locator('.creation-deck-stage');
 const activeCard=deck.locator('.deck-card--active');
 await page.evaluate(()=>window.setFixtureLoaders([24,68]));
 await activeCard.getByText('24%',{exact:true}).waitFor();
 await stage.press('ArrowRight');
 await activeCard.getByText('68%',{exact:true}).waitFor();
 await stage.press('ArrowRight');
 assert.equal(await activeCard.getByText(/^(24|68)%$/).count(),0,'An idle card does not inherit an adjacent scene loader');
 await stage.press('ArrowLeft');
 await stage.press('ArrowLeft');
 await page.evaluate(()=>window.setFixtureLoaders([]));
 await activeCard.getByText('24%',{exact:true}).waitFor({state:'hidden'});
 const historyLength=await page.evaluate(()=>history.length);
 await action('clikb.creation.deck_view.action.settings');
 await action('clikb.creation.deck_view.action.scene_number','7');
 assert.equal(await deck.getAttribute('data-creation-deck-scene'),'A:0','Typing a target does not change the current card');
 await action('clikb.creation.deck_view.action.show_scene');
 assert.equal(await page.evaluate(()=>history.length),historyLength,'Showing a card does not add a history entry');
 assert.equal(await page.locator('.creation-deck').getAttribute('data-creation-deck-scene'),'A:6');
 await action('clikb.creation.deck_view.action.settings');
 await action('clikb.creation.deck_view.action.scene_number','3');
 const staleOpen=await page.evaluate(()=>window.actionContext('clikb.creation.deck_view.action.open_scene'));
 await action('clikb.creation.deck_view.action.scene_number','4');
 const staleReply=await page.evaluate(context=>window.run('clikb.creation.deck_view.action.open_scene',undefined,context),staleOpen);
 assert.equal(staleReply.status,'stale_or_unavailable','Approval for Scene 3 cannot open Scene 4');
 assert.equal(staleReply.mutationSent,false);
 assert.equal(await deck.getAttribute('data-creation-deck-scene'),'A:6');
 await action('clikb.creation.deck_view.action.scene_number','3');
 await action('clikb.creation.deck_view.action.open_scene');
 await page.locator('[data-creation-control^="clikb.creation.workstation_"]').first().waitFor();
 assert.equal(await page.evaluate(()=>history.state.clikbCreationDeck.sceneKey),'A:2','Opening a scene directly targets its own workstation');
 await page.goBack();
 await deck.waitFor();
 assert.equal(await deck.getAttribute('data-creation-deck-scene'),'A:6','Back returns to the card that was already centred');
 const sceneLabel=deck.locator('.creation-deck-scene-label');
 assert.match(await sceneLabel.innerText(),/Scene 7/);
 await sceneLabel.click();
 assert.equal(await deck.getAttribute('data-creation-deck-view'),'normal');
 const heading=deck.locator('.deck-card--active .creation-deck-card-heading');
 assert.equal(await heading.locator('h2').innerText(),'Scene 7');
 assert.match(await heading.locator('.creation-deck-scene-relationships').innerText(),/A-roll/);
 await heading.locator('h2').click();
 assert.equal(await deck.getAttribute('data-creation-deck-view'),'clean');
 await sceneLabel.click();
 await deck.locator('.creation-deck-card-open').click({position:{x:30,y:20}});
 await page.locator('[data-creation-control^="clikb.creation.workstation_"]').first().waitFor();
 await page.goBack();
 await deck.waitFor();
 await deck.locator('.creation-deck-scene-copy').click();
 assert.equal(await deck.getAttribute('data-creation-deck-view'),'clean');
 assert.equal(await deck.locator('.creation-deck-detail').count(),0);
 await sceneLabel.click();
 const beforeDetails=await deck.locator('.deck-card--active').boundingBox();
 await deck.getByRole('button',{name:'Options',exact:true}).click();
 await page.locator('.creation-deck-detail').waitFor();
 assert.deepEqual(await deck.locator('.deck-card--active').boundingBox(),beforeDetails,'Details stays inside the same active card bounds');
 await action('clikb.creation.deck_view.action.settings');
 assert.equal(await deck.locator('[data-creation-control*=".control.deck_mode_"]').count(),0,'Layered scene editing hides stage changes');
 assert.equal(await deck.getByRole('spinbutton',{name:'Storyboard scene number'}).count(),0,'An open detail locks scene jumping');
 await action('clikb.creation.deck_view.action.settings');
 await page.evaluate(()=>window.expectDeck=false);
 await action('clikb.creation.deck_view.action.close');
 await page.locator('.creation-deck').waitFor({state:'hidden'});
 await page.locator('[data-ai-action="clikb.creation.storybook_preview.action.close"]:visible').waitFor();
 const previewCloseReply=await page.evaluate(()=>window.run('clikb.creation.storybook_preview.action.close'));
 assert.equal(previewCloseReply.status,'dispatched',JSON.stringify(previewCloseReply));
 await page.locator('[data-ai-action="clikb.creation.storybook_preview.action.close"]:visible').waitFor({state:'hidden'});
 const gridEntry=page.locator('[data-ai-action="clikb.creation.storybook_grid.action.open_scene_7"]').filter({visible:true});
 await gridEntry.scrollIntoViewIfNeeded();
 assert.match(await gridEntry.getAttribute('data-creation-label'),/Creation Deck/);
 const gridReply=await page.evaluate(()=>{window.expectDeck=true;return window.run('clikb.creation.storybook_grid.action.open_scene_7');});
 assert.equal(gridReply.status,'dispatched',JSON.stringify(gridReply));
 await deck.waitFor();
 assert.equal(await deck.getAttribute('data-creation-deck-scene'),'A:6');
 await action('clikb.creation.storybook_grid.action.open_scene_7');
 await page.locator('[data-creation-control^="clikb.creation.workstation_"]').first().waitFor();
 await page.goBack();
 await deck.waitFor();
 assert.equal(await deck.getAttribute('data-creation-deck-scene'),'A:6');
 assert.deepEqual(await page.evaluate(()=>window.bareGridFrames),[],'Grid → Deck → workstation → Back has no intermediate bare Grid frame');
 await page.evaluate(()=>window.expectDeck=false);
 await page.evaluate(()=>window.deckOff());
 const current=await page.evaluate(()=>window.observe());
 assert.equal(current.creation.controls.areas['clikb.creation.deck_view'],undefined);
 await page.goto('http://fixture.test/storybook?type=0&restore=true&bshots=true');
 await page.locator('.creation-deck').waitFor();
 const brollStart=page.locator('.creation-deck [data-ai-action="clikb.creation.storybook_start.action.start"]');
 if(await brollStart.count())await brollStart.click();
 await page.evaluate(()=>{
   window.modeVisits=[];
   const deck=document.querySelector('.creation-deck');
   new MutationObserver(()=>{window.modeVisits.push(deck.getAttribute('aria-label'));}).observe(deck,{attributes:true,attributeFilter:['aria-label']});
 });
 await action('clikb.creation.deck_view.action.settings');
 assert.equal(await deck.locator('[data-creation-control="clikb.creation.storybook_grid.control.deck_mode_2"]').count(),0,'Returning B-roll stage is not offered as an action');
 assert.equal(await deck.locator('.creation-deck-menu > button:disabled').count(),0);
 await action('clikb.creation.storybook_grid.action.deck_mode_1');
 const videoDeck=page.locator('.creation-deck[aria-label="Video"]');
 const studioDeck=page.locator('.creation-deck-detail [aria-label="Studio setup"]');
 await videoDeck.waitFor();
 const motionPill=videoDeck.locator('.creation-deck-card-action [data-ai-action^="clikb.creation.storybook_grid.action.open_motion_"]');
 await motionPill.waitFor();
 assert.match(await motionPill.innerText(),/Create motion|Open video/);
 const beforeStudio=await activeCard.boundingBox();
 await action('clikb.creation.storybook_grid.action.next_videos');
 await studioDeck.waitFor();
 const enterStudio=studioDeck.getByRole('button',{name:'Enter Studio',exact:true});
 await enterStudio.waitFor();
 assert.deepEqual(await activeCard.boundingBox(),beforeStudio,'Studio setup preserves the active scene card bounds');
 assert.equal(await activeCard.locator('.creation-deck-detail--frosted').count(),1);
 await page.waitForTimeout(350);
 await page.screenshot({path:path.join(root,'.tmp','creation-deck-studio-glass-'+width+'.png')});
 await page.evaluate(()=>window.store.dispatch({type:'settings/setThemePreference',payload:'light'}));
 await page.screenshot({path:path.join(root,'.tmp','creation-deck-studio-glass-light-'+width+'.png')});
 await page.evaluate(()=>window.store.dispatch({type:'settings/setThemePreference',payload:'dark'}));
 if(width===390){
   await page.setViewportSize({width,height:600});
   const shortCard=await activeCard.boundingBox();
   assert.ok(shortCard.width>=230,'Short workflow cards retain a readable width');
   assert.ok(Math.abs(shortCard.height/shortCard.width-16/9)<.01,'Short workflow cards retain the portrait aspect ratio');
   for(const label of ['Enter Studio','Cancel']){
     const visible=await studioDeck.getByRole('button',{name:label,exact:true}).evaluate(button=>{
       const bounds=button.getBoundingClientRect();
       const panel=button.closest('.creation-deck-detail').getBoundingClientRect();
       return bounds.top>=Math.max(0,panel.top) && bounds.bottom<=Math.min(innerHeight,panel.bottom);
     });
     assert.equal(visible,true,label+' is initially visible without scrolling the card');
   }
   await page.screenshot({path:path.join(root,'.tmp','creation-deck-studio-short-390x600.png')});
   await page.setViewportSize({width,height:900});
 }
 assert.equal(await page.getByRole('dialog',{name:'Studio setup',exact:true}).count(),0,'Deck setup does not duplicate the native dialog');
 await studioDeck.getByRole('button',{name:'Cancel',exact:true}).click();
 await videoDeck.waitFor();
 await action('clikb.creation.storybook_grid.action.next_videos');
 await enterStudio.waitFor();
 await action('clikb.creation.storybook_studio_selector.action.enter_studio');
 const brollDeck=page.locator('.creation-deck[aria-label="B-roll"]');
 await brollDeck.waitFor();
 await page.evaluate(()=>window.setFixtureLoaders([31,72]));
 await activeCard.getByText('31%',{exact:true}).waitFor();
 await stage.press('ArrowRight');
 assert.equal(await deck.getAttribute('data-creation-deck-scene'),'B:0:0');
 assert.equal(await activeCard.getByText(/^(31|72)%$/).count(),0,'B-roll does not inherit either neighboring A-roll loader');
 const brollPillBox=await activeCard.locator('.creation-deck-card-action').boundingBox();
 const brollTitleBox=await activeCard.locator('h2').boundingBox();
 assert.ok(brollPillBox.y+brollPillBox.height<=brollTitleBox.y,'B-roll action and title do not overlap');
 await page.route('**/ImageDesignStoryStage',async route=>{
   if(route.request().postDataJSON()?.isBShotPrompt) await new Promise(resolve=>setTimeout(resolve,1500));
   await route.fallback();
 });
 await activeCard.getByRole('button',{name:'Start B-roll',exact:true}).click();
 await activeCard.getByRole('button',{name:'Stop B-roll',exact:true}).click();
 await activeCard.getByRole('button',{name:'Start B-roll',exact:true}).waitFor();
 await stage.press('ArrowRight');
 await activeCard.getByText('72%',{exact:true}).waitFor();
 await page.evaluate(()=>window.setFixtureLoaders([]));
 if(width===1440){
   await page.evaluate(()=>window.setFixtureAudioProgress(true));
   const progress=page.getByText('Voice Narration Progress',{exact:true});
   await progress.waitFor();
   await page.keyboard.press('Escape');
   await progress.waitFor({state:'hidden'});
   await brollDeck.waitFor();
   await activeCard.evaluate(card=>Promise.all(card.getAnimations().map(animation=>animation.finished)));
   const beforePublish=await activeCard.boundingBox();
   await brollDeck.getByRole('button',{name:'Publish',exact:true}).click();
   const finalReview=activeCard.getByRole('dialog',{name:'Final publish review'});
   await finalReview.getByRole('button',{name:'Process Video',exact:true}).click();
   assert.deepEqual(await activeCard.boundingBox(),beforePublish,'Publish review preserves the active scene card bounds');
   await finalReview.getByText('Rendering Video',{exact:true}).waitFor();
   assert.equal(await brollDeck.locator('.deck-close').isDisabled(),true,'Rendering locks the outer close control');
   await finalReview.getByRole('alert').getByText('Fixture render failed',{exact:true}).waitFor();
   await finalReview.getByText('Render Failed',{exact:true}).waitFor();
   await page.screenshot({path:path.join(root,'.tmp','creation-deck-publish-glass-'+width+'.png')});
   await finalReview.getByRole('button',{name:'Dismiss',exact:true}).click();
   await finalReview.waitFor({state:'hidden'});
   await brollDeck.waitFor();
 }
 await action('clikb.creation.deck_view.action.settings');
 await action('clikb.creation.storybook_grid.action.deck_mode_0');
 await page.waitForFunction(()=>document.querySelector('.creation-deck')?.getAttribute('aria-label')==='Images');
 assert.ok((await page.evaluate(()=>window.modeVisits)).includes('Video'),'B-roll to Images visits the actual Video state');
 await action('clikb.creation.deck_view.action.settings');
 assert.equal(await deck.locator('[data-creation-control="clikb.creation.storybook_grid.control.deck_mode_0"]').count(),0,'Returning to Images recomputes current-stage availability');
 assert.equal(await deck.locator('[data-creation-control="clikb.creation.storybook_grid.control.deck_mode_1"]').count(),1,'Previously reached Video remains available');
 assert.equal(await deck.locator('[data-creation-control="clikb.creation.storybook_grid.control.deck_mode_2"]').count(),1,'Previously reached B-roll remains available');
 assert.equal(await deck.locator('.creation-deck-menu > button:disabled').count(),0);
 if(width===1440){
   await page.goto('http://fixture.test/storybook?type=1&restore=true&edit=true');
   await deck.waitFor();
   const cinemaStart=deck.locator('[data-ai-action="clikb.creation.storybook_start.action.start"]');
   if(await cinemaStart.count())await cinemaStart.click();
   await page.locator('.creation-deck[aria-label="B-roll"]').waitFor();
   await deck.locator('.creation-deck-stage').press('ArrowRight');
   assert.equal(await deck.getAttribute('data-creation-deck-scene'),'B:0:0');
   const gridNumber=await page.locator('[data-creation-scene-key="B:0:0"] [data-scene-number]').getAttribute('data-scene-number');
   const brollNumber=deck.locator('.creation-deck-scene-label');
   assert.equal(await brollNumber.innerText(),'Scene '+gridNumber,'B-roll Deck uses the same ordinal as Grid');
   await brollNumber.click();
   assert.match(await activeCard.locator('.creation-deck-scene-relationships').innerText(),/B-roll for Scene 1/);
   assert.match(await activeCard.locator('.creation-deck-scene-relationships').innerText(),/Stage A/);
   await action('clikb.creation.deck_view.action.settings');
   await action('clikb.creation.storybook_grid.action.deck_mode_1');
   await videoDeck.waitFor();
   await action('clikb.creation.storybook_grid.action.next_videos');
   await studioDeck.waitFor();
   const narration=studioDeck.getByRole('checkbox',{name:'AI voice narration'});
   const cancelReset=page.locator('[data-ai-action="clikb.creation.storybook_bshot_warning.action.cancel_narration_reset"]');
   const confirmReset=page.locator('[data-ai-action="clikb.creation.storybook_bshot_warning.action.confirm_narration_reset"]');
   assert.equal(await narration.isChecked(),false);
   await narration.click();
   await cancelReset.waitFor();
   await studioDeck.waitFor({state:'hidden'});
   await cancelReset.click();
   await studioDeck.waitFor();
   assert.equal(await narration.isChecked(),false,'Cancel keeps the current narration setting');
   await narration.click();
   await confirmReset.click();
   await studioDeck.waitFor();
   assert.equal(await narration.isChecked(),true,'Confirm applies the requested narration change');
   await page.evaluate(()=>window.deckOff());
   await studioDeck.waitFor({state:'hidden'});
   const nativeSetup=page.locator('[role="dialog"][aria-label="Studio setup"]');
   await nativeSetup.locator('[data-ai-action="clikb.creation.storybook_studio_selector.action.enter_studio"]').waitFor();
 }
 assert.deepEqual(errors,[]);
 console.log('PASS '+width+'px actual Storybook settings, scene browsing, workstation, Back centre, Options/Grid handoff and Off');
 await page.close();
}
}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
