const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||'../.tmp/concierge-browser-deps/node_modules/playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'.tmp/qol-badges');fs.mkdirSync(output,{recursive:true});
const fixture=`import React from 'react';import{createRoot}from'react-dom/client';import{Provider}from'react-redux';
import{configureStore}from'@reduxjs/toolkit';import imageModelExamples,{recordImageResultModel}from'./src/imageModelExamplesSlice';
import Pill,{SceneNumberBadge}from'./src/ImageModelResultPill';
const store=configureStore({reducer:{imageModelExamples}});store.dispatch(recordImageResultModel({model:'GPT Image 2.5 Flare',urls:['image-fixture']}));
const root=createRoot(document.getElementById('root'));window.adds=0;window.showBadge=(patch={})=>root.render(<Provider store={store}><div style={{position:'relative',width:320,height:400,background:'#ddd'}}>
<Pill source="image-fixture" active visitKey="scene:1" sceneNumber={1} onAddSet={()=>window.adds++} {...patch}/></div></Provider>);window.showBadge();`;
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{for(const mode of ['dev','production']){const built=await require('esbuild').build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'import.meta.env':JSON.stringify({VITE_APPX_STATE:mode})},logLevel:'silent'});
 const page=await browser.newPage({viewport:{width:650,height:500}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<div id="root"></div><script>'+built.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>'}));
 await page.goto('http://qol.fixture.test');const circle=page.getByTestId('scene-result-number');await circle.waitFor();assert.equal(await circle.textContent(),'1');
 assert.equal(await circle.evaluate(n=>getComputedStyle(n).width),'28px');assert.equal(await circle.evaluate(n=>getComputedStyle(n).borderRadius),'50%');
 await page.screenshot({path:path.join(output,mode+'-scene.png')});await page.clock.fastForward(4100);
 const image=page.getByTestId('image-model-result-pill');await image.waitFor();assert.equal(await image.textContent(),'GPT Image 2.6 Flare');
 assert.equal(await image.evaluate(n=>n.tagName),mode==='dev'?'BUTTON':'SPAN');if(mode==='dev'){await image.click();assert.equal(await page.evaluate(()=>window.adds),1);}
 await page.clock.fastForward(4100);assert.equal(await image.count(),0,'Both badges disappear');
 await page.evaluate(()=>window.showBadge({sceneNumber:4,visitKey:'scene:4',source:'video-fixture',mediaKind:'video',videoModel:'SeedanceMini'}));
 await circle.waitFor();assert.equal(await circle.textContent(),'4');await page.clock.fastForward(4100);
 const video=page.getByTestId('video-model-result-pill');await video.waitFor();assert.match(await video.textContent(),/Seedance/);assert.equal(await video.evaluate(n=>n.tagName),'SPAN');
 await page.screenshot({path:path.join(output,mode+'-video-model.png')});
 await page.evaluate(()=>window.showBadge({active:false,visitKey:'closed'}));assert.equal(await video.count(),0);await page.clock.fastForward(10000);
 await page.evaluate(()=>window.showBadge({sceneNumber:2,visitKey:'scene:2'}));await circle.waitFor();assert.equal(await circle.textContent(),'2');
 assert.deepEqual(errors,[]);await page.close();console.log('PASS '+mode+': compact scene circle → actual result model → hidden; resets on travel/close; image dev action preserved');
}}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
