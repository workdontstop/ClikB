const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const fixture = `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {BrowserRouter} from 'react-router-dom';
import {store} from './src/store';
import {setLoggedUser} from './src/profileSlice';
import {setPixels,setDeckEnabled} from './src/settingsSlice';
import PromptInput from './src/PromptInput';
import {CreationReferenceDraftProvider,useCreationReferenceDraftState} from './src/CreationReferenceDraftContext';
import {prepareDraftEntry} from './src/creationDrafts/entry';
import {stableDraftJson} from './server/src/creationDrafts/schema';
import {createDraftController} from './src/creationDrafts/store';
window.resumeResult={error:null,reads:0,writes:0,requests:[]};
const q=new URLSearchParams(location.search),type=Number(q.get('type')||0),noop=()=>{};
const scenes=type===1?['Pilot approaches console A','Pilot approaches console B','Pilot tests engine A','Pilot tests engine B']:['Pilot approaches console','Pilot tests engine'];
const image=i=>'https://media.fixture.test/accepted-'+i+'.png';
const reference={clientReferenceId:'pilot-reference',name:'Pilot',type:'character',imageUrl:image('pilot'),prompt:'Saved Pilot identity prompt',description:'Saved Pilot appearance'};
const plan={prompt_summary:'Keep the Pilot identity and original accepted story.',characters:[{name:'Pilot'}],scenes:scenes.map(text=>({text}))};
const prompt={prompt:'Saved original Pilot adventure',promptx:'Saved original Pilot adventure',Planx:plan,parsedKeyPoints:scenes,
 parsedKeyPointsb:scenes,parsedKeyPointsx:scenes,parsedKeyPoints2:['Saved narration one','Saved narration two'],
 nanoImages:scenes.map((_,i)=>image('preview-'+i)),ImagesHdCloud:scenes.map((_,i)=>image('hd-'+i)),generatedImagesFluxx:scenes.map((_,i)=>image('sd-'+i)),
 GeneratedImage:[image('input')],Vipcharacters:[reference],referenceImages:[reference],detectedCharacters:[{name:'Pilot',description:'Saved Pilot appearance'}],detectedEnvironments:[],
 queuedCastingPrompts:[{name:'Pilot',prompt:'Saved Pilot identity prompt',type:'character'}],castingPrompts:[{name:'Pilot',prompt:'Saved Pilot identity prompt',type:'character'}],
 castingCompleted:true,castingInstruction:'',stepOneCastingReady:true,stepOneDetectedCount:1,cinemaNarrationEnabled:false,
 Seed:42,aspectRatio:1,remixData:'Saved reference context',worldCover:'',worldStyle:'',selectedWorldId:null};
const storybook={GeneratedText:scenes.map((_,i)=>'Saved selected image prompt '+i),GeneratedTextx:scenes.map((_,i)=>'Saved selected image prompt '+i),
 TextVideo:scenes.map((_,i)=>'Saved selected video prompt '+i),VideoArrayCloud:scenes.map((_,i)=>'https://media.fixture.test/accepted-video-'+i+'.mp4'),
 savedSceneImages:prompt.ImagesHdCloud,PlanVid:{storyContext:'Saved full video plan'},videoPlanInput:[plan,prompt.parsedKeyPoints2],videoHistory:{},
 globalIntentResult:{blueprintId:'saved-intent',mode:type===1?'cinema':'shorts',sourceContextHash:'accepted-hash',global:{title:'Saved Pilot',overview:'Saved scene intent'},
 sceneOrder:[],scenesById:{},sceneNotes:{},audit:{status:'valid',issues:[]}}};
const record={postId:81,draftId:'draft-pilot',revision:9,digest:'accepted-digest',published:false,snapshot:{schemaVersion:1,creationProjectId:'saved-pilot-project',creationType:type,sections:{prompt,storybook}}};
if(q.get('previewOnly')==='true'){
 prompt.ImagesHdCloud=[];prompt.generatedImagesFluxx=[];prompt.nanoImages=[image('preview-0')];
 storybook.savedSceneImages=[];storybook.VideoArrayCloud=[];storybook.videoPlanInput=[];
}
const api={read:async postId=>{window.resumeResult.reads++;if(postId!==81)throw Error('wrong post');return JSON.parse(JSON.stringify(record));},
 checkpoint:async request=>{window.resumeResult.writes++;window.resumeResult.requests.push(request);
 if(q.get('previewOnly')==='true'&&window.resumeResult.writes===1)await new Promise(resolve=>window.releaseCloseSave=resolve);
 await new Promise(resolve=>setTimeout(resolve,80));return {...record,revision:record.revision+window.resumeResult.writes,snapshot:request.snapshot,imageProjectionDigest:request.projection?stableDraftJson(request.projection):window.draftController.getState().imageProjectionDigest}}};
store.dispatch(setLoggedUser({id:7,name:'Owner',username:'owner',image:image('owner'),imageThumb:image('owner')}));store.dispatch(setPixels(500));
store.dispatch(setDeckEnabled(false));
class Boundary extends React.Component{state={error:null};static getDerivedStateFromError(error){return {error};}componentDidCatch(error){window.resumeResult.error=error.message;window.resumeResult.stack=error.stack;}render(){return this.state.error?<output data-crash>{this.state.error.message}</output>:this.props.children;}}
function App(){const references=useCreationReferenceDraftState(),[minimised,setMinimised]=useState(false),[submitting,setSubmitting]=useState(false),[kick,setKick]=useState(false);
 window.composerState=()=>({minimised});window.openComposer=()=>setMinimised(false);
 window.referenceState=references;
 return <CreationReferenceDraftProvider value={references}><PromptInput type={type} isMenuOpen={false} callFeeds={false} AllowPing={true} minimisePrompt={minimised} setminimisePrompt={setMinimised}
 setcallFeeds={noop} setAllowPing={noop} setFluxLoaded={noop} fluxLoaded={false} isSubmittingKick={kick} setIsSubmittingKick={setKick} isSubmitting={submitting} setIsSubmitting={setSubmitting}
 IsMobileBackActive={false} setIsMobileBackActive={noop} clikt={false} setclikt={noop} setHideBottom={noop} setstopFeeds={noop} stopFeeds={false} magicMode={false} setType={noop}
 instantCall={false} setinstantCall={noop} handleLoginSuccess={noop} handleLoginError={noop} hasMoreTemplates={false}/></CreationReferenceDraftProvider>;}
prepareDraftEntry({accountId:7,postId:81,mode:'resume',api,storage:null}).then(entry=>{
 if(q.get('closeFirst')==='true'){
  entry.record={...entry.record,postId:0,revision:0};
  entry.controller=createDraftController({accountId:7,creationProjectId:record.snapshot.creationProjectId,creationType:type,record:entry.record,api,storage:null});
 }
 window.draftController=entry.controller;
 history.replaceState({idx:0,key:'initial',usr:null},'',(type===1?'/kickit':type===3?'/clikit':'/images')+'?type='+type);
 createRoot(document.getElementById('root')).render(<Provider store={store}><BrowserRouter><Boundary><App/></Boundary></BrowserRouter></Provider>);
}).catch(error=>{window.resumeResult.error=error.message;});
`;

(async () => {
    const noopSession = `const noop=()=>{};const session={syncCreationMemoryCards:noop,creationMemoryUnsyncedCardKeys:[],runAutomaticGuideCall:noop,cancelAutomaticGuideCall:noop,registerGuideUseTarget:()=>noop,registerGuideInlineHost:()=>noop,guideEnabled:false,chatHistory:[],setChatHistory:noop};export const useBrainstormSession=()=>session;export const BrainstormSessionProvider=({children})=>children;`;
    const build = await require('esbuild').build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',
        loader:{'.css':'empty','.png':'dataurl','.jpg':'dataurl','.svg':'dataurl','.webp':'dataurl','.mp3':'dataurl','.mp4':'dataurl','.gif':'dataurl'},
        define:{'import.meta.env':JSON.stringify({VITE_CLIK_URL:'http://fixture.test',VITE_APPX_STATE:'dev',VITE_STRIPE_PUBLISH:'pk_test_fixture',DEV:false}),'process.env.NODE_ENV':'"production"'},
        plugins:[{name:'isolated-concierge',setup(builder){builder.onLoad({filter:/BrainstormSessionProvider\.tsx$/},()=>({contents:noopSession,loader:'tsx'}));}}],logLevel:'silent'});
    // Checkout is an unrelated lazy library in PromptInput's import graph. Keep
    // its SDK boundary inert without filtering real page/React errors.
    const html = '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script>window.Stripe=()=>({_registerWrapper(){},registerAppInfo(){}});</script><script>'+build.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>';
    const browser = await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const forbidden = /\/(?:startStory|startMemes|startInteractions|startPlan(?:Vid)?|extractCasting|generateCastingPrompts|narrateSummary|intent-blueprint|ImageDesign|VideoDesign|GptVideo|GptRemake|generateReplicateAudio|fluxschnell|Bannana\d*|Imagen\d*|upscaleImage|gpu\/modal\/generate)/i;
    try {
        for (const [type,width,choice,closeFirst,previewOnly] of [[0,393,'skip',true,true],...(process.env.SHORTS_ONLY ? [[0,393,'skip',true],[0,1440,'create_characters']] : [[0,393,'skip',true],[1,393,'create_characters'],[0,1440,'create_characters'],[1,1440,'skip'],[3,393,'skip']])]) {
            const page = await browser.newPage({viewport:{width,height:900}}), requests=[], errors=[];
            page.on('pageerror',error=>{ errors.push(error.message); console.error(error.stack); });
            await page.route('**/*',async route=>{
                const request=route.request();
                if(request.isNavigationRequest())return route.fulfill({contentType:'text/html',body:html});
                requests.push({url:request.url(),method:request.method()});
                if(request.url().startsWith('https://media.fixture.test/'))return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+lmJ8AAAAASUVORK5CYII=','base64')});
                if(request.url().endsWith('/get_signed_url_imageStory'))return route.fulfill({json:{holder:[{urlHD:'https://storage.fixture.test/preview.png?signature=fixture'}]}});
                if(request.method()==='PUT')return route.fulfill({status:200,body:''});
                if(/\/getPixels(?:\?|$)/.test(request.url()))return route.fulfill({json:{userid:7,pixels:500}});
                return route.fulfill({json:{}});
            });
            await page.goto('http://fixture.test/resume?type='+type+'&closeFirst='+!!closeFirst+'&previewOnly='+!!previewOnly);
            await page.waitForFunction(()=>window.resumeResult?.error||document.querySelector('[data-creation-control="clikb.creation.preview_choice.control.skip"]'),null,{timeout:20000});
            const result=await page.evaluate(()=>window.resumeResult);
            if(result.error){console.error(result.stack||result.error);fs.writeFileSync(path.join(root,'.tmp/prompt-draft-resume-fixture.js'),build.outputFiles[0].text);}
            assert.equal(result.error,null,`PromptInput resume mount type=${type}, width=${width}`);
            assert.equal(result.reads,1);
            assert.equal(await page.locator('[data-creation-control="clikb.creation.preview_choice.control.create_characters"]').count(),1,'existing character choice is retained');
            await page.locator(`[data-creation-control="clikb.creation.preview_choice.control.${choice}"]`).click();
            if(choice==='create_characters'){
                await page.locator('[data-creation-control="clikb.creation.character_studio.control.scroll"]').waitFor({state:'visible'});
                assert.ok(await page.locator('img[src="https://media.fixture.test/accepted-pilot.png"]').count(),'saved character image appears without generation');
                const continueButton=page.locator('[data-creation-control="clikb.creation.character_studio.control.continue"]');
                await continueButton.click();
            }
            if(previewOnly){
                const start=page.locator('[data-creation-control="clikb.creation.storybook_start.control.start"]:visible');
                await start.waitFor();
                const requestsBeforeClose=requests.length;
                await page.locator('[data-creation-control="clikb.creation.storybook_toolbar.control.close"]:visible').click();
                const confirmation=page.getByRole('alertdialog',{name:'Confirm close creation'});
                await confirmation.getByText('Saving draft…',{exact:true}).waitFor();
                await page.waitForFunction(()=>Boolean(window.releaseCloseSave));
                await confirmation.locator('[data-creation-control="clikb.creation.storybook_toolbar.control.confirm_close"]').click();
                assert.equal(await page.evaluate(()=>window.draftController.getState().closed),false,'Exit waits for acknowledged save');
                assert.equal(await confirmation.isVisible(),true,'Saving confirmation stays visible');
                await page.evaluate(()=>window.releaseCloseSave());
                await confirmation.waitFor({state:'hidden'});
                await page.waitForFunction(()=>window.draftController.getState().closed);
                const saved=await page.evaluate(()=>({state:window.draftController.getState(),requests:window.resumeResult.requests}));
                assert.equal(saved.state.closed,true);
                assert.equal(saved.state.postId,81);
                assert.equal(saved.requests[0].projection.image2,null,'Missing scene is retained as an empty slot');
                assert.equal(saved.requests[0].snapshot.sections.storybook.imageReceipts['A:0'].quality,'preview');
                assert.deepEqual(requests.slice(requestsBeforeClose).filter(request=>forbidden.test(request.url)),[],'Preview close never starts generation');
                assert.deepEqual(errors,[]);
                console.log('PASS preview-only before Start: partial draft saves, preserves Preview, and exit awaits acknowledgement');
                await page.close();
                continue;
            }
            await page.waitForTimeout(400);
            const snapshot=await page.evaluate(()=>({result:window.resumeResult,state:window.draftController.getState(),references:window.referenceState}));
            if(snapshot.result.error)console.error(snapshot.result.stack||snapshot.result.error);
            assert.equal(snapshot.result.error,null);
            assert.equal(snapshot.state.snapshot.sections.prompt.Planx.prompt_summary,'Keep the Pilot identity and original accepted story.');
            assert.equal(snapshot.state.snapshot.sections.prompt.referenceImages[0].prompt,'Saved Pilot identity prompt');
            assert.equal(snapshot.references.vipCharacters[0].imageUrl,'https://media.fixture.test/accepted-pilot.png');
            assert.equal(snapshot.state.postId,closeFirst?null:81);assert.equal(snapshot.state.snapshot.creationProjectId,'saved-pilot-project');
            assert.equal(snapshot.result.reads,1,'each stage reads the same working snapshot, not cloud again');
            assert.deepEqual(requests.filter(request=>forbidden.test(request.url)),[],'saved replay never submits AI/GPU/media-generation calls');
            assert.deepEqual(requests.filter(request=>request.method==='PUT'),[],'replay never uploads media or writes legacy post projections');
            assert.equal(snapshot.result.writes,0,'replay never checkpoints initialization defaults');
            assert.deepEqual(errors,[]);
            // Continue through the native image gate into the restored video grid.
            const start=page.locator('[data-creation-control="clikb.creation.storybook_start.control.start"]:visible');
            if(await start.count()) await start.first().click();
            const continueImages=page.locator('[data-creation-control="clikb.creation.storybook_grid.control.continue_images"]:visible');
            await continueImages.waitFor({state:'visible'});
            if(closeFirst){
                const closeCreation=page.locator('[data-creation-control="clikb.creation.storybook_toolbar.control.close"]:visible');
                await closeCreation.click();
                const confirmation=page.getByRole('alertdialog',{name:'Confirm close creation'});
                await confirmation.getByText('Saving draft…',{exact:true}).waitFor();
                await confirmation.getByText('Draft saved',{exact:true}).waitFor();
                const saved=await page.evaluate(()=>({state:window.draftController.getState(),requests:window.resumeResult.requests}));
                assert.equal(saved.state.postId,81);assert.equal(saved.requests[0].action,'images');assert.equal(saved.requests[0].postId,undefined,'Close creates the first post/draft identity');
                assert.deepEqual(requests.filter(request=>forbidden.test(request.url)),[],'Close saves images without any video-plan or media generation call');
                assert.equal(await page.locator('[data-creation-control="clikb.creation.storybook_grid.control.next_videos"]:visible').count(),0,'Close review does not advance to Videos');
                await page.locator('[data-creation-control="clikb.creation.storybook_toolbar.control.cancel_close"]:visible').click();
                console.log('PASS image close before first Continue: Saving → Saved, new post identity, remains in Images, no video-plan/provider calls');
            }
            await continueImages.click();
            await page.locator('[data-creation-control="clikb.creation.storybook_grid.control.next_videos"]:visible').waitFor({state:'visible'});
            assert.deepEqual(requests.filter(request=>forbidden.test(request.url)),[],'image Continue adopts saved video plan and prompts');
            assert.equal((await page.evaluate(()=>window.draftController.getState())).postId,81);
            assert.deepEqual(requests.filter(request=>request.method==='PUT'),[],'stored images are not uploaded again on ordinary resume');
            assert.deepEqual(errors,[]);
            // Let first-visit video-frame defaults finish their quiet autosave.
            await page.waitForTimeout(750);
            await page.locator('[data-draft-save-notice]').waitFor({state:'hidden'});
            const afterContinue=await page.evaluate(()=>{
                window.unexpectedSaveFeedback=[];
                window.saveFeedbackObserver=new MutationObserver(()=>{
                    const text=document.body.innerText;
                    for(const message of ['Saving..','Uploading Images..','Saving draft…','Draft saved']) {
                        if(text.includes(message)) window.unexpectedSaveFeedback.push(message);
                    }
                });
                window.saveFeedbackObserver.observe(document.body,{subtree:true,childList:true,characterData:true});
                return window.resumeResult.writes;
            });
            for(let repeat=0;repeat<7;repeat++){
                await page.locator('[data-creation-control="clikb.creation.storybook_grid.control.back"]:visible').click();
                await continueImages.waitFor({state:'visible'});
                await continueImages.click();
                await page.locator('[data-creation-control="clikb.creation.storybook_grid.control.next_videos"]:visible').waitFor();
                if(await page.locator('[data-draft-save-notice]').count()) console.error('Repeated Continue state',JSON.stringify(await page.evaluate(()=>{
                    const a=window.resumeResult.requests,old=a.at(-2),next=a.at(-1);
                    const diff=(x,y)=>Object.keys({...x,...y}).filter(k=>JSON.stringify(x?.[k])!==JSON.stringify(y?.[k]));
                    return {writes:window.resumeResult.writes,actions:a.map(r=>r.action),snapshotDiff:diff(old?.snapshot.sections,next?.snapshot.sections).map(k=>({section:k,fields:diff(old?.snapshot.sections[k],next?.snapshot.sections[k]).map(f=>({field:f,before:old?.snapshot.sections[k]?.[f],after:next?.snapshot.sections[k]?.[f]}))})),projectionDiff:diff(old?.projection,next?.projection),notice:document.querySelector('[data-draft-save-notice]')?.textContent};
                })));
                assert.equal(await page.locator('[data-draft-save-notice]').count(),0,'unchanged Continue has no save notice');
            }
            await page.waitForTimeout(650);
            assert.deepEqual(await page.evaluate(()=>{window.saveFeedbackObserver.disconnect();return window.unexpectedSaveFeedback;}),[],'unchanged navigation never displays save or upload progress');
            assert.equal(await page.evaluate(()=>window.resumeResult.writes),afterContinue,'seven unchanged Continues do not write again');
            // Closing the restored funnel replaces its session. Its composer
            // popup must retain the same native history owner through reset.
            await page.locator('[data-creation-control="clikb.creation.storybook_toolbar.control.close"]:visible').click();
            await page.getByRole('alertdialog',{name:'Confirm close creation'}).getByText('Draft saved',{exact:true}).waitFor();
            await page.locator('[data-creation-control="clikb.creation.storybook_toolbar.control.confirm_close"]:visible').click();
            const closeComposer=page.locator('[data-creation-control="clikb.creation.styles.control.close_composer"]:visible');
            await closeComposer.waitFor({timeout:4000}).catch(async error=>{console.error(await page.evaluate(()=>({state:window.composerState(),history:history.state,controls:[...document.querySelectorAll("[data-creation-control]")].map(n=>({control:n.getAttribute("data-creation-control"),visible:!!n.getClientRects().length})).filter(n=>n.visible).slice(-20),text:document.body.innerText.slice(-700)})));throw error;});
            await page.waitForFunction(()=>!!history.state.clikbPromptInput);
            const popupIndex=await page.evaluate(()=>history.state.idx);
            for(let repeat=0;repeat<2;repeat++){
                await closeComposer.click();
                await page.waitForFunction(()=>window.composerState().minimised&&!history.state.clikbPromptInput);
                await page.waitForTimeout(180);
                assert.equal(await page.evaluate(()=>window.composerState().minimised),true,'X stays closed after session reset');
                assert.equal(await page.evaluate(()=>history.state.idx),popupIndex-1,'X consumes exactly one popup entry');
                await page.goForward();await closeComposer.waitFor();
            }
            await page.goBack();
            await page.waitForFunction(()=>window.composerState().minimised);
            assert.deepEqual(errors,[]);
            console.log(`PASS actual PromptInput resume: type=${type}, width=${width}, choice=${choice}; one cloud read, zero replay AI/media/write calls; native Continue reuses saved video plan`);
            await page.close();
        }
    } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
