const assert = require('node:assert/strict');
const path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const fixture = `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import {useFullscreenPlaybackDiagnostics} from './src/fullscreenPlaybackDiagnostics';
window.mediaCalls=[];for(const name of ['play','pause','load'])HTMLMediaElement.prototype[name]=function(){window.mediaCalls.push(name);};
function Viewer(){const [post,setPost]=useState(42);window.changePost=setPost;
useFullscreenPlaybackDiagnostics({route:'/images',routeKey:'route-'+post,tier:'story',historyPostId:post,
 fullscreen:true,postId:post,index:post-42,scene:0,count:2,mode:0,expectedSource:'https://assets.test/'+post+'.mp4?secret=signed',
 mappedSource:'https://assets.test/wrong.mp4?secret=mapped',coverSource:'https://assets.test/cover.png?secret=cover',coverHidden:true,playing:true,captionHidden:true,relationshipsOpen:false});
return <div data-fullscreen-stories><div data-playback-post-id={post}><video id="media" preload="none" src={'https://assets.test/'+post+'.mp4?secret=signed'}/></div></div>;
}const root=createRoot(document.getElementById('root'));root.render(<Viewer/>);window.unmount=()=>root.unmount();`;
(async () => {
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  for(const dev of [true,false]){
   const bundle=await build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',minify:true,
    define:{'import.meta.env.DEV':String(dev),'process.env.NODE_ENV':JSON.stringify(dev?'development':'production')}});
   const page=await browser.newPage(),logs=[],errors=[];
   page.on('console',message=>{if(message.text().startsWith('[FullscreenPlayback]'))logs.push(message.text());});page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',route=>route.request().isNavigationRequest()?route.fulfill({contentType:'text/html',body:'<div id="root"></div><script>'+bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>'}):route.abort());
   await page.goto('http://fixture.test/');await page.locator('#media').waitFor();await page.waitForTimeout(80);
   if(dev){
    await page.evaluate(()=>{const video=document.getElementById('media');Object.defineProperty(video,'currentSrc',{value:'https://assets.test/old.mp4?secret=current',configurable:true});video.dispatchEvent(new Event('playing'));});
    let entries=await page.evaluate(()=>window.__fullscreenPlaybackDiagnostics.entries());
    const playing=entries.findLast(entry=>entry.event==='playing').details;
    assert.equal(playing.postId,42);assert.equal(playing.mediaPostId,'42');assert.equal(playing.sourceMatchesDeclared,false);assert.equal(playing.node>0,true);
    assert.equal(playing.expectedSource,'https://assets.test/42.mp4');assert.equal(playing.actual,'https://assets.test/old.mp4');
    await page.evaluate(()=>window.changePost(43));await page.waitForFunction(()=>window.__fullscreenPlaybackDiagnostics.entries().some(entry=>entry.event==='viewer-state'&&entry.details.postId===43));
    await page.evaluate(()=>{const video=document.getElementById('media');video.style.opacity='0';video.setAttribute('poster','https://assets.test/cover.png?secret=poster');});
    await page.waitForFunction(()=>window.__fullscreenPlaybackDiagnostics.entries().some(entry=>entry.event==='media-poster'));
    const before=await page.evaluate(()=>window.__fullscreenPlaybackDiagnostics.entries().length);
    await page.evaluate(()=>{for(let i=0;i<100;i++)document.getElementById('media').dispatchEvent(new Event('timeupdate'));});
    assert.equal(await page.evaluate(()=>window.__fullscreenPlaybackDiagnostics.entries().length),before,'No frame-by-frame logging');
    await page.evaluate(()=>{for(let i=0;i<350;i++)document.getElementById('media').dispatchEvent(new Event('waiting'));});
    assert.equal(await page.evaluate(()=>window.__fullscreenPlaybackDiagnostics.entries().length),300);
    const exported=await page.evaluate(()=>window.__fullscreenPlaybackDiagnostics.export());assert.equal(exported.includes('secret='),false);assert.ok(exported.includes('[FullscreenPlayback]'));
    await page.evaluate(()=>{window.detachedVideo=document.getElementById('media');window.unmount();});await page.waitForTimeout(30);
    const afterUnmount=logs.length;
    await page.evaluate(()=>{const root=document.createElement('div');root.setAttribute('data-fullscreen-stories','true');root.append(window.detachedVideo);document.body.append(root);window.detachedVideo.dispatchEvent(new Event('waiting'));window.detachedVideo.style.opacity='1';});await page.waitForTimeout(30);
    assert.equal(logs.length,afterUnmount,'Unmount removes listeners and observer');
   } else {
    await page.evaluate(()=>document.getElementById('media').dispatchEvent(new Event('waiting')));
    assert.equal(await page.evaluate(()=>typeof window.__fullscreenPlaybackDiagnostics),'undefined');assert.equal(logs.length,0);
   }
   assert.deepEqual(await page.evaluate(()=>window.mediaCalls),[],'Diagnostics never call play, pause or load');assert.deepEqual(errors,[]);
   console.log('PASS '+(dev?'development: identity/source correlation, redaction, bounded log, no frame logging, cleanup':'production: no diagnostic global or output')+'; media unchanged');await page.close();
  }
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
