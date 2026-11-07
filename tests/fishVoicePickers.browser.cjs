const fs=require('fs'),path=require('path'),ts=require('typescript'),assert=require('node:assert/strict');
const {chromium}=require('../.tmp/concierge-browser-deps/node_modules/playwright');
const {FISH_VOICES}=require('./loadTs.cjs')('server/src/fishVoiceCatalog.ts');
const tree=ts.createSourceFile('BrainstormChat.tsx',fs.readFileSync('src/components/BrainstormChat.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let menu,legacy,options;
function visit(n){
 if(ts.isJsxElement(n)&&n.openingElement.tagName.getText(tree)==='Menu'&&n.openingElement.attributes.getText(tree).includes('voiceMenuAnchor'))menu=n.getText(tree);
 if(ts.isVariableDeclaration(n)&&n.name.getText(tree)==='VOICE_OPTIONS')legacy=n.initializer.getText(tree);
 if(ts.isVariableDeclaration(n)&&n.name.getText(tree)==='voiceOptions')options=n.initializer.getText(tree);
 ts.forEachChild(n,visit);
}visit(tree);assert.ok(menu&&legacy&&options);
const fixture=`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{Provider}from'react-redux';
import{Menu,MenuItem,ListItemText,Tooltip,IconButton,Button,Box,Typography}from'@mui/material';import StopIcon from'@mui/icons-material/Stop';import PlayArrowIcon from'@mui/icons-material/PlayArrow';
import VoicePicker from'./src/VoicePicker';import{FishVoicePreviewManager}from'./src/components/FishVoicePreviewManager';import{useFishVoices}from'./src/fishVoices';import{store}from'./src/store';import{setBrainstormSelectedVoice}from'./src/brainstormSlice';
const VOICE_OPTIONS=${legacy};window.fixture={};window.previewUrls=[];window.Audio=class{constructor(url){this.url=url;this.paused=true;}play(){this.paused=false;window.previewUrls.push(this.url);return Promise.resolve();}pause(){this.paused=true;}};
function App(){const[mode,setMode]=useState('story'),[selectedVoice,setSelectedVoice]=useState('Puck'),[voiceMenuAnchor,setVoiceMenuAnchor]=useState(null),[previewingVoice,setPreviewingVoice]=useState(null);const fishVoices=useFishVoices(Boolean(voiceMenuAnchor)),voiceOptions=${options},matchMobile=innerWidth<600,darkMode=false,appColor='#8844aa';const dispatch=a=>{store.dispatch(a);setSelectedVoice(a.payload);},toggleVoicePreview=option=>{new Audio(option.previewUrl).play();setPreviewingVoice(option.id);};window.fixture={setMode,selected:()=>selectedVoice};return mode==='story'?<VoicePicker showVoicesList selectedVoice={selectedVoice} onClose={()=>{}} onSelectVoice={setSelectedVoice} setName={()=>{}} setMemeMusic={()=>{}} type={1} MemeMusic={false}/>:<><Button onClick={e=>setVoiceMenuAnchor(e.currentTarget)}>Open Concierge voices</Button><FishVoicePreviewManager/>${menu}</>;}createRoot(document.getElementById('root')).render(<Provider store={store}><App/></Provider>);`;
(async()=>{
 const bundled=await require('esbuild').build({stdin:{contents:fixture,resolveDir:path.resolve('.'),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',loader:{'.css':'empty','.png':'dataurl','.svg':'dataurl','.jpg':'dataurl','.webp':'dataurl'},define:{'import.meta.env':JSON.stringify({VITE_APPX_STATE:'dev',VITE_CLIK_URL:'https://fixture.test'}),'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{for(const width of[1200,390]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[],counts={generate:0,save:0,speech:0};let saved=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{
   const u=r.request().url();
   if(r.request().isNavigationRequest())return r.fulfill({contentType:'text/html',body:'<div id="root"></div>'});
   if(u.endsWith('/api/fish-voices'))return r.fulfill({json:{voices:FISH_VOICES.map((v,i)=>({...v,previewUrl:i===0?(saved?'https://fixture.s3/voice.mp3':''):v.previewUrl,savedPreview:i===0&&saved}))}});
   if(u.endsWith('/generate-preview')){counts.generate++;return r.fulfill({json:{draftId:'fixture-draft',audioContent:Buffer.from('ID3fixture').toString('base64'),mimeType:'audio/mpeg'}});}
   if(u.endsWith('/save-preview')){counts.save++;saved=true;return r.fulfill({json:{id:'saved',s3Url:'https://fixture.s3/voice.mp3'}});}
   if(/voiceTtsStream|generateReplicateAudio/.test(u))counts.speech++;
   return r.abort();
  });
  await page.goto('https://fixture.test');await page.addScriptTag({content:bundled.outputFiles[0].text});
  await page.getByRole('heading',{name:'Choose a voice'}).waitFor();
  assert.equal(await page.locator('[data-ai-action*=".select_fish_"]').count(),30);
  await page.waitForFunction(()=>document.querySelector('[data-ai-action*=".preview_fish_"]')?.getAttribute('aria-disabled')==='true');
  await page.locator('[data-ai-action*=".select_fish_"]').first().click();
  assert.equal(await page.evaluate(()=>window.fixture.selected()),FISH_VOICES[0].id,'No saved preview must not disable selection');
  assert.deepEqual(counts,{generate:0,save:0,speech:0});
  await page.getByRole('button',{name:'Add',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Add Fish voice preview'});await dialog.waitFor();
  await dialog.getByRole('textbox',{name:'Preview text'}).fill('A developer-created preview.');
  assert.equal(counts.generate,0);
  await dialog.getByRole('button',{name:'Generate',exact:true}).click();
  await dialog.getByRole('button',{name:'Save preview',exact:true}).waitFor({state:'visible'});
  await dialog.getByRole('button',{name:'Save preview',exact:true}).click();
  await dialog.getByText('Saved. Both voice lists now use the stored preview.').waitFor();
  assert.deepEqual(counts,{generate:1,save:1,speech:0});
  await dialog.getByRole('button',{name:'Close',exact:true}).click();
  const preview=page.locator('[data-ai-action*=".preview_fish_"]').first();await preview.click();await preview.click();
  assert.equal(counts.generate,1);assert.equal(counts.speech,0);
  assert.ok((await page.evaluate(()=>window.previewUrls)).includes('https://fixture.s3/voice.mp3'));
  await page.evaluate(()=>window.fixture.setMode('concierge'));await page.waitForTimeout(100);assert.deepEqual(errors,[],'Concierge menu must render');
  await page.getByRole('button',{name:'Open Concierge voices'}).click();
  assert.equal(await page.getByRole('menuitem').filter({hasText:'(Fish)'}).count(),30);
  await page.getByRole('menuitem').filter({hasText:FISH_VOICES[0].name+' (Fish)'}).first().click();
  assert.equal(await page.evaluate(()=>window.fixture.selected()),FISH_VOICES[0].id);
  assert.deepEqual(errors,[]);
  console.log('PASS Storybook and production Concierge menu:30 shared Fish voices, selectable without preview, developer Generate/Save, cached Play; width '+width);
  await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
