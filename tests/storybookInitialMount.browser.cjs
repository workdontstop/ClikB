const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||'../.tmp/concierge-browser-deps/node_modules/playwright');
const root=path.resolve(__dirname,'..');
const fixture=`import React from 'react';import {createRoot} from 'react-dom/client';import {Provider} from 'react-redux';import {MemoryRouter} from 'react-router-dom';import {store} from './src/store';import {Storybook} from './src/Storybook';import {createDraftController} from './src/creationDrafts/store';
const noop=()=>{},blank=[],scenes=['Cover','Dinosaur trio at Burger King A','Dinosaur trio at Burger King B','Dinosaur trio at McDonalds A','Dinosaur trio at McDonalds B','Dinosaur trio at Subway A','Dinosaur trio at Subway B','Closing'];
const arrays=['GeneratedImage','generatedImagesFlux','ImagesHdCloud','drawFrameData','autoDrawGuideData','autoDrawGuideModes','referenceImages','detectedCharacters','detectedEnvironments','nanoImages','loadersArray','Vipcharacters','audioSceneStatuses','generatedAudios','generatedAudioTexts','bShotImages','bShotVideos','bShotPrompts','bShotTextVideo','bShotSpatialScenes','bShotSpatialContexts','spatialMotionContexts','bShotNanoImages','bShotDrawFrameData','bShotAutoDrawGuideData','bShotAutoDrawGuideModes','musicSegments'];
const setters=['setSteps','setStepsx','setIsSubmittingKick','handleCloseOverlay','setcallFeeds','setStopText','setGeneratedImagesFlux','setVideMode','setImagesHdCloud','setDrawFrameData','setAutoDrawGuideData','setAutoDrawGuideModes','stopFeeds','setminimisePrompt','setSteps2','setallowgetImage','setDummyMode','setShowWorldModel','setCreationMode','setMinimizeMode','destroyAllFluxCalls','onAllPromptsGenerated','onIntentOverviewChange','setNanoImages','setReferenceImages','setLoadersArray','onSaveVisibilityChange','setVipcharacters','setIsAudioDirty','setAudioSceneStatuses','setIsAudioGenerating','setIsBShotModeActive','setGeneratedAudios','setGeneratedAudioTexts','onBackToInitial','setBShotImages','setBShotVideos','setBShotPrompts','setBShotTextVideo','setSpatialManifest','setBShotSpatialScenes','setBShotSpatialContexts','setSpatialMotionContexts','setBShotNanoImages','setBShotDrawFrameData','setBShotAutoDrawGuideData','setBShotAutoDrawGuideModes','setPostId','setGeneratedImage','GenerateSignedUrl'];
const props={creationProjectId:'cinema-mount-test',steps:scenes,stepsx:scenes,steps2:['They arrive.','They share a meal.','They choose sandwiches.'],prompt:'Create three Cinema dinosaur scenes with narration.',modelz:'Schnell',Planx:{scenes:[]},type:1,Seed:1,DummyMode:false,CreationMode:'Video',allowgetImage:true,allowSpin:false,isSubmittingKick:false,PostId:0,VideMode:false,isBShotModeActive:false,magicMode:false,selectedStyle:'Auto',isAudioDirty:false,isAudioGenerating:false,isMenuOpen:false,minimizeMode:0,timeoutsDisabledRef:{current:false},timeoutRefsxp:{current:{}},stagePromptCache:{},spatialManifest:[]};
for(const name of arrays)props[name]=[];for(const name of setters)props[name]=noop;props.spatialManifest={version:2,scenes:{}};
class Boundary extends React.Component{state={error:null};static getDerivedStateFromError(error){return {error};}componentDidCatch(error){window.mountResult.error=error.message;window.mountResult.stack=error.stack;}render(){return this.state.error?<output data-crash>{this.state.error.message}</output>:this.props.children;}}
window.mountResult={error:null};const q=new URLSearchParams(location.search);props.type=Number(q.get('type')||1);props.musicMode=q.get('music')==='true';
if(q.get('restore')==='true'){
 props.PostId=71;props.ImagesHdCloud=scenes.map((_,i)=>'https://media.fixture.test/hd-'+i+'.png');
 props.generatedImagesFlux=scenes.map((_,i)=>'https://media.fixture.test/sd-'+i+'.png');props.nanoImages=[...props.generatedImagesFlux];
 const record={postId:71,draftId:'fixture-draft',revision:4,digest:'fixture',published:false,snapshot:{schemaVersion:1,creationProjectId:props.creationProjectId,creationType:props.type,sections:{
 prompt:{ImagesHdCloud:props.ImagesHdCloud,generatedImagesFluxx:props.generatedImagesFlux,nanoImages:props.nanoImages,Planx:props.Planx,parsedKeyPoints:scenes},
 storybook:{GeneratedText:scenes.map((v,i)=>'Saved image prompt '+i),GeneratedTextx:scenes.map((v,i)=>'Saved image prompt '+i),
 TextVideo:scenes.map((_,i)=>'Saved video prompt '+i),VideoArrayCloud:scenes.map((_,i)=>'https://media.fixture.test/video-'+i+'.mp4'),
 PlanVid:{storyContext:'Retained complete plan'},savedSceneImages:props.ImagesHdCloud,
 globalIntentResult:{blueprintId:'saved-intent',mode:'cinema',sourceContextHash:'saved-hash',global:{title:'Saved title',overview:'Saved context'},sceneOrder:[],scenesById:{},sceneNotes:{},audit:{status:'valid',issues:[]}}}
 }}};
 props.creationDraft=createDraftController({accountId:7,creationProjectId:props.creationProjectId,creationType:props.type,record,baseUrl:'http://fixture.test'});
 props.creationDraft.endHydration();window.draftController=props.creationDraft;
}

if(q.get('bshots')==='true'){props.VideMode=true;props.isBShotModeActive=true;props.bShotPrompts=scenes.map(()=>['[B-Shot-Pending fixture]']);}
if(q.get('edit')==='true'){props.VideMode=true;props.isBShotModeActive=true;props.bShotPrompts=[['Saved preview B-shot'],['Saved generated B-shot']];props.bShotNanoImages=[['https://media.fixture.test/b-preview.png'],['https://media.fixture.test/b-preview-two.png']];props.bShotImages=[[],['https://media.fixture.test/b-final.png']];}
createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter><Boundary><Storybook {...props}/></Boundary></MemoryRouter></Provider>);`;
(async()=>{
 const baseline=process.env.STORYBOOK_MOUNT_BASELINE;
 const source=baseline?cp.execFileSync('git',['show',baseline+':src/Storybook.tsx'],{encoding:'utf8',maxBuffer:4*1024*1024}):null;
 const session=`const noop=()=>{};const session={syncCreationMemoryCards:noop,registerGuideUseTarget:()=>noop,registerGuideInlineHost:()=>noop,guideEnabled:false,chatHistory:[],setChatHistory:noop};export const useBrainstormSession=()=>session;`;
 const built=await require('esbuild').build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',loader:{'.css':'empty','.png':'dataurl','.jpg':'dataurl','.svg':'dataurl','.webp':'dataurl','.mp3':'dataurl','.mp4':'dataurl','.gif':'dataurl'},define:{'import.meta.env':'{}','process.env.NODE_ENV':'"production"'},plugins:[{name:'mount-fixture',setup(b){
  if(source)b.onLoad({filter:/[\\/]Storybook\.tsx$/},()=>({contents:source,loader:'tsx'}));
  b.onLoad({filter:/BrainstormSessionProvider\.tsx$/},()=>({contents:session,loader:'tsx'}));
 }}],logLevel:'silent'});
 const html='<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script>'+built.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>';
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{for(const [type,music,restore,bshots,edit] of (process.env.SHORTS_ONLY?[[0,false,false],[0,false,true],[0,false,true,true],[0,false,true,false,true]]:[[0,false,false],[1,false,false],[1,true,false],[0,false,true],[1,false,true],[1,true,true],[0,false,true,true],[0,false,true,false,true]])){
  const page=await browser.newPage({viewport:{width:edit?1440:393,height:852}}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async r=>{if(r.request().isNavigationRequest())return r.fulfill({contentType:'text/html',body:html});requests.push(r.request().url());if(bshots)await new Promise(resolve=>setTimeout(resolve,1500));return r.fulfill({json:{}});});
  await page.goto('http://fixture.test/storybook?type='+type+'&music='+music+'&restore='+restore+'&bshots='+!!bshots+'&edit='+!!edit);await page.waitForFunction(()=>window.mountResult.error||document.querySelector('[data-creation-control="clikb.creation.storybook_grid.control.scroll_scenes"]'));
  const error=await page.evaluate(()=>window.mountResult.error);
  if(error&&!(baseline&&type===1)){const stack=await page.evaluate(()=>window.mountResult.stack);console.log(stack.split('\n').slice(0,2).join('\n'));const match=stack.match(/fixture\.test\/storybook[^\s]*?:(\d+):\d+/);if(match){const line=Number(match[1]);console.log(built.outputFiles[0].text.split('\n').slice(line-2,line+1).join('\n').slice(0,1100));}}
  if(baseline&&type===1){assert.match(error,/Cannot access .*activatevoicenarration.* before initialization/);console.log('REPRO baseline Cinema TDZ, music='+music+': '+error);}
  else{assert.equal(error,null,'Storybook mounts for type='+type+', music='+music);assert.deepEqual(errors,[]);console.log('PASS Storybook initial mount type='+type+', music='+music);}
  if(restore){
   await page.waitForTimeout(450);
   const state=await page.evaluate(()=>window.draftController.getState());
   assert.equal(state.snapshot.sections.storybook.PlanVid.storyContext,'Retained complete plan');
   assert.equal(state.snapshot.sections.storybook.TextVideo[1],'Saved video prompt 1');
   assert.equal(state.snapshot.sections.storybook.VideoArrayCloud[1],'https://media.fixture.test/video-1.mp4');
   assert.deepEqual(requests.filter(url=>/\/(?:intent-blueprint|ImageDesign|startPlan|extractCasting|generateCasting|generateReplicateAudio|gpu\/modal\/generate)/i.test(url)),[], 'restoration must not submit AI or GPU work');
   assert.equal(await page.locator('img[src="https://media.fixture.test/sd-1.png"]').count()>0,true,'saved previews enter the actual grid');
   const start=page.locator('[data-creation-control="clikb.creation.storybook_start.control.start"]:visible');
   if(await start.count()){await start.first().click();await page.waitForTimeout(100);}
  }
  if(bshots){
   const start=page.getByRole('button',{name:'Start B-roll',exact:true}).first();await start.waitFor();await start.click();
   const stop=page.getByRole('button',{name:'Stop B-roll',exact:true}).first();await stop.waitFor();
   assert.equal(await stop.getAttribute('aria-busy'),'true','Preparation shows busy before a preview returns');
   assert.match(await stop.evaluate(node=>getComputedStyle(node).animationName),/bShotPreparing/);
   await stop.click();await start.waitFor();assert.equal(await start.getAttribute('aria-busy'),'false');
   assert.equal(await start.evaluate(node=>getComputedStyle(node).animationName),'none');
   assert.deepEqual(errors,[]);console.log('PASS optional B-shots: immediate preparation animation and Stop restores idle feedback');
  }
  if(edit){
   const badge=page.locator('[data-scene-number="2"]');assert.equal(await badge.count(),1);
   await page.mouse.move(1435,845);assert.equal(await badge.evaluate(node=>getComputedStyle(node).opacity),'0','Scene circles are absent at rest');
   await badge.locator('xpath=ancestor::*[@data-scene-card][1]').hover();assert.equal(await badge.evaluate(node=>getComputedStyle(node).opacity),'1','Hover exposes the compact number');
   await page.locator('[data-creation-control="clikb.creation.storybook_grid.control.open_bshot_1_1"]:visible').click();
   const videoNext=page.locator('[data-creation-control="clikb.creation.workstation_video.control.next_scene"]:visible');
   const imageNext=page.locator('[data-creation-control="clikb.creation.workstation_image.control.next_scene"]:visible');
   await imageNext.waitFor();assert.equal(await page.getByTestId('scene-result-number').textContent(),'2','B-roll preview gets its visible grid ordinal in the editor');
   assert.equal(await page.evaluate(()=>window.draftController.getState().snapshot.sections.editor.firstFrameModeChoices['B:0:0']),true,'A preview-only video scene defaults to Direct without generating an image');
   await imageNext.click();await videoNext.waitFor();assert.equal(await page.getByTestId('scene-result-number').textContent(),'3','Slider follows displayed numbering');
   await videoNext.click();await videoNext.waitFor();
   await page.locator('[data-creation-control="clikb.creation.workstation_video.control.images_tab"]:visible').first().click();
   await imageNext.waitFor();await page.waitForTimeout(150);assert.equal(await imageNext.count(),1,'Manual image tab remains selected within the same HD scene');
   await page.locator('[data-creation-control="clikb.creation.workstation_image.control.previous_scene"]:visible').click();await videoNext.waitFor();
   await page.locator('[data-creation-control="clikb.creation.workstation_video.control.previous_scene"]:visible').click();await imageNext.waitFor();
   await page.locator('[data-creation-control="clikb.creation.workstation_image.control.previous_scene"]:visible').click();await videoNext.waitFor();
   assert.deepEqual(errors,[]);console.log('PASS actual EditStory slider: video → preview/Images → video → generated image/Videos; reverse navigation and manual tab choice');
  }
  const media=requests.filter(url=>/\/(?:fluxschnell|Bannana\d*|Imagen\d*|upscaleImage)(?:\?|$)/i.test(url));assert.deepEqual(media,[],'initial mount does not submit image generation');await page.close();
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
