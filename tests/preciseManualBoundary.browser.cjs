const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const fixture = `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {Provider} from 'react-redux';
import {store} from './src/store';import {useCreationControls} from './src/useCreationControls';
import {creationBinding as cb} from './src/creationControlSnapshot';
import {observeCurrentAppSnapshot,handleNavigationBrowserRequest} from './src/navigationBrowserControl';
import {creationControlHit} from './src/creationControlHitTest';
import {setAutoControlVisible,setAutoControl} from './src/settingsSlice';
store.dispatch(setAutoControlVisible({visible:true,actor:'user'}));store.dispatch(setAutoControl({enabled:true,actor:'user'}));
const calls={launch:0,generate:0,save:0,ordinary:0};
function App(){const [open,setOpen]=useState(false);
useCreationControls('precise_test','Fixture',true);
useCreationControls('workstation_precise','Fixture',open,{model:'Flare',pixels:6,regions:2,references:1,status:'ready',prompt:'PRIVATE_INSTRUCTION',imageUrl:'PRIVATE_URL'});
window.precise={observe:observeCurrentAppSnapshot,run:message=>handleNavigationBrowserRequest(message,location.origin),calls,hit:id=>!!creationControlHit(document.getElementById(id),'click')};
return <main><button id='launch' data-precise-launch='true' data-ai-control-excluded='true' {...cb('precise_test','launch','Precise','open')} onClick={()=>{calls.launch++;setOpen(true)}}>Precise</button>
<button id='ordinary' {...cb('precise_test','ordinary','Ordinary','ordinary')} onClick={()=>calls.ordinary++}>Ordinary</button>
{open&&<section role='dialog' aria-modal='true' data-precise-editor='true' data-ai-control-excluded='true' style={{position:'fixed',inset:0,zIndex:100,background:'white'}}>
<h1>PRIVATE_INSTRUCTION</h1><button id='generate' {...cb('precise_test','generate','Generate','generate')} onClick={()=>calls.generate++}>Generate</button>
<button id='save' {...cb('workstation_precise','save','Save','save')} onClick={()=>calls.save++}>Save</button>
<button id='close' onClick={()=>setOpen(false)}>Close</button></section>}</main>}
createRoot(document.getElementById('root')).render(<Provider store={store}><App/></Provider>);
`;
(async () => {
  const result = await require('esbuild').build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',loader:{'.css':'empty','.png':'dataurl','.svg':'dataurl','.jpg':'dataurl','.jpeg':'dataurl','.webp':'dataurl','.mp3':'dataurl','.mp4':'dataurl'},define:{'import.meta.env':'{}','process.env.NODE_ENV':'"production"'},logLevel:'silent'});
  const html='<div id="root"></div><script>'+result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>';
  const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',timeout:30000});
  const replies=new Map();
  try {
    const page=await browser.newPage({viewport:{width:1200,height:900}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',route=>{
      if(route.request().isNavigationRequest())return route.fulfill({contentType:'text/html',body:html});
      if(route.request().url().endsWith('/navigation/browser-reply')){const data=route.request().postDataJSON();replies.set(data.requestId,data.reply);return route.fulfill({json:{}});}
      return route.abort();
    });
    await page.goto('http://fixture.test/',{waitUntil:'domcontentloaded'});
    await page.locator('#ordinary').waitFor();
    const observe=()=>page.evaluate(()=>window.precise.observe());
    async function request(key){const before=await observe(),requestId='manual-'+key;
      await page.evaluate(message=>window.precise.run(message),{requestId,command:'action',actionId:'clikb.creation.'+(key==='save'?'workstation_precise':'precise_test')+'.action.'+key,expectedVersion:before.creation.controls.stateVersion});
      return replies.get(requestId);
    }
    let snapshot=await observe();
    assert.ok(snapshot.creation.controls.areas['clikb.creation.precise_test'].controls.some(control=>control.actionId.endsWith('.ordinary')));
    assert.equal(await page.evaluate(()=>window.precise.hit('launch')),false);
    assert.notEqual((await request('launch')).status,'dispatched');
    assert.equal(await page.evaluate(()=>window.precise.calls.launch),0);
    await page.locator('#launch').click();
    snapshot=await observe();
    assert.deepEqual(snapshot.creation.controls.areas['clikb.creation.workstation_precise'].state,{model:'Flare',pixels:6,regions:2,references:1,status:'ready'});
    assert.deepEqual(snapshot.creation.controls.areas['clikb.creation.workstation_precise'].controls,[]);
    assert.deepEqual(snapshot.conciergeFocus.areaIds,['clikb.creation.workstation_precise']);
    assert.deepEqual(snapshot.conciergeFocus.controlIds,[]);assert.deepEqual(snapshot.conciergeFocus.textFields,[]);
    assert.equal(await page.evaluate(()=>window.precise.hit('generate')),false);
    for(const key of ['generate','save'])assert.notEqual((await request(key)).status,'dispatched');
    assert.deepEqual(await page.evaluate(()=>window.precise.calls),{launch:1,generate:0,save:0,ordinary:0});
    await page.locator('#generate').click();assert.equal(await page.evaluate(()=>window.precise.calls.generate),1,'manual controls retain their handlers');
    await page.locator('#close').click();
    snapshot=await observe();assert.equal(snapshot.creation.controls.areas['clikb.creation.workstation_precise'],undefined);
    assert.equal((await request('ordinary')).status,'dispatched');assert.equal(await page.evaluate(()=>window.precise.calls.ordinary),1);
    assert.deepEqual(errors,[]);
    console.log('PASS manual Precise launcher/popup exclusion, compact state lifecycle, no AI dispatch, and ordinary mapped controls');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
