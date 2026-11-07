const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const ts = require('typescript');
const { build } = require('esbuild');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const fullscreenOnly=process.argv.includes('--fullscreen-only');
const menuSource=ts.createSourceFile('MenuSlider.tsx',fs.readFileSync(path.join(root,'src/MenuSlider.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let menuCreate;
function findMenuCreate(node){if(ts.isVariableDeclaration(node)&&node.name.getText(menuSource)==='handleCreateClick')menuCreate=node.getText(menuSource);ts.forEachChild(node,findMenuCreate);}
findMenuCreate(menuSource);assert.ok(menuCreate,'Use the actual sidebar Create handler');

// Real router hook, permission pill and Redux state. No provider or app server calls.
const fixture = `
import React,{useState,useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {MemoryRouter,useLocation,useNavigate} from 'react-router-dom';
import {store} from './src/store';
import {setAutoControlVisible,setAutoControl,setConversationModel} from './src/settingsSlice';
import {useDeckNavigation,openDeckCreation,useDeckCreationRequest} from './src/useDeckNavigation';
import {recordNavigationTransition} from './src/brainstormSlice';
import AutoControlPill from './src/AutoControlPill';
store.dispatch(setConversationModel('terra'));
store.dispatch(setAutoControlVisible({visible:true,actor:'user'}));
store.dispatch(setAutoControl({enabled:true,actor:'user'}));
function App(){
 const location=useLocation(),navigate=useNavigate(),[min,setMin]=useState(true),[epoch,setEpoch]=useState(0),[fullscreen,setFullscreen]=useState(null);
 const dispatch=store.dispatch;
 const deckEnabled=store.getState().settings.deckEnabled;
 const deckRuntime={openCreate:()=>{setMin(false);setEpoch(value=>value+1);}};
 useDeckCreationRequest(deckRuntime.openCreate);
 const ${menuCreate};
 const category=({'/search':'search','/pages':'page','/images':'shorts','/kickit':'cinema','/clikit':'games'})[location.pathname]||'all';
 const feeds=category==='search'||category==='page'?[{id:3338}]:[{id:101},{id:102}];
 const deck=useDeckNavigation({feeds,category,enabled:true,loading:false,minimisePrompt:min,creationEpoch:epoch,
  collectionScope:category,prepareDeck:()=>setMin(true),onCreate:deckRuntime.openCreate,onFullscreen:setFullscreen,
  getScroll:()=>({x:0,y:0}),restoreScroll:()=>{}});
 window.fixture={state:()=>({path:location.pathname,search:location.search,category,min,isDeckOpen:deck.isDeckOpen,active:deck.activePostId,fullscreen}),
  close:deck.close,play:deck.play,charge:(pixels,id)=>window.dispatchEvent(new CustomEvent('clikb:concierge-metered-billing',{detail:{tier:'terra',receiptId:id,pixelsCharged:pixels}}))};
 return <><button onClick={()=>deck.openPost(feeds[0].id)}>Open post deck</button><button onClick={deck.create}>Deck Create</button><button onClick={handleCreateClick}>Sidebar Create</button><section data-composer hidden={min}>Creation prompt</section>
  <AutoControlPill placement={window.testPlacement||'floating'} small={window.testSmall||false}/></>;
}
createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter initialEntries={[window.testPath||'/feeds']}><App/></MemoryRouter></Provider>);
`;

(async () => {
 const bundle = await build({ stdin:{contents:fixture,loader:'tsx',resolveDir:root},bundle:true,write:false,
  format:'iife',platform:'browser',jsx:'automatic',loader:{'.css':'empty','.png':'dataurl','.webp':'dataurl'},
  define:{'import.meta.env':'{}'},logLevel:'silent' });
 const browser = await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  for (const [width,placement,small] of fullscreenOnly?[]:[[1280,'floating',false],[390,'floating',false],[320,'embedded',false],[320,'embedded',true]]) {
   const page=await browser.newPage({viewport:{width,height:844}}),errors=[];
   page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
   await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial}</style><div id="root"></div>');
   await page.evaluate(config=>Object.assign(window,config),{testPlacement:placement,testSmall:small});
   await page.addScriptTag({content:bundle.outputFiles[0].text});
   const pill=page.getByRole('group',{name:'Auto Control'}),toggle=page.locator('[data-ai-action="clikb.global.auto_control.control.toggle"]');
   await pill.waitFor();const initial=await pill.boundingBox(),button=await toggle.boundingBox();
   for (const pixels of [1,123]) {
    await page.evaluate(p=>window.fixture.charge(p,'receipt-'+p),pixels);
    await page.waitForFunction(p=>document.querySelector('[data-concierge-pixel-deduction]')?.textContent.includes('-'+p+' P'),pixels);
    assert.equal(await pill.locator('[data-concierge-pixel-deduction]').count(),1);
    assert.deepEqual(await pill.boundingBox(),initial,'Pill remains stationary');
    assert.deepEqual(await toggle.boundingBox(),button,'Toggle retains its position and width');
   }
   await pill.locator('[data-concierge-pixel-deduction]').waitFor({state:'hidden',timeout:7000});
   assert.deepEqual(await pill.boundingBox(),initial,'Restoring dot retains geometry');
   assert.deepEqual(errors,[]);console.log('PASS stationary deduction '+width+'px '+placement+' small='+small);
   await page.close();
  }
  for (const route of fullscreenOnly?[]:['/search?q=Tesla&section=shorts','/pages','/feeds','/images','/kickit','/clikit']) {
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
   await page.setContent('<div id="root"></div>');await page.evaluate(route=>{window.testPath=route;},route);
   await page.addScriptTag({content:bundle.outputFiles[0].text});await page.getByRole('button',{name:'Deck Create'}).click();
   await page.waitForFunction(()=>window.fixture.state().min===false&&window.fixture.state().isDeckOpen);
   const state=await page.evaluate(()=>window.fixture.state());
   const fallback=route.startsWith('/search')||route==='/pages';
   assert.equal(state.path,fallback?'/images':route);assert.equal(state.category,fallback?'shorts':({'/feeds':'all','/images':'shorts','/kickit':'cinema','/clikit':'games'})[route]);
   assert.equal(state.active,101,'Target feed owns its collection, not Search post IDs');
   assert.doesNotMatch(state.search,/q=|section=|story=/);assert.equal(await page.locator('[data-composer]').isVisible(),true);
   await page.evaluate(()=>window.fixture.close());await page.waitForFunction(()=>!window.fixture.state().isDeckOpen);
   const afterClose=await page.evaluate(()=>window.fixture.state());assert.equal(afterClose.path,state.path);assert.equal(afterClose.min,false,'Backdrop close does not discard composer');
   assert.deepEqual(errors,[]);console.log('PASS Create '+route+' -> '+state.path+' Deck + composer');await page.close();
  }
  for (const width of [1280,390]) for (const route of ['/search?q=Tesla&section=shorts','/pages','/feeds','/images','/kickit','/clikit']) {
   const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.abort());
   await page.setContent('<div id="root"></div>');await page.evaluate(route=>{window.testPath=route;},route);await page.addScriptTag({content:bundle.outputFiles[0].text});
   await page.getByRole('button',{name:'Open post deck'}).click();
   await page.waitForFunction(()=>window.fixture?.state().isDeckOpen).catch(async error=>{console.error('Fullscreen fixture',route,await page.evaluate(()=>window.fixture?.state()),errors);throw error;});await page.evaluate(()=>window.fixture.play());
   await page.waitForFunction(()=>window.fixture.state().fullscreen!==null);
   await page.getByRole('button',{name:'Sidebar Create'}).click();
   await page.waitForFunction(()=>!window.fixture.state().min&&window.fixture.state().isDeckOpen&&window.fixture.state().fullscreen===null);
   const state=await page.evaluate(()=>window.fixture.state()),fallback=route.startsWith('/search')||route==='/pages';
   assert.equal(state.path,fallback?'/images':route);assert.doesNotMatch(state.search,/q=|section=|story=/);
   assert.equal(await page.locator('[data-composer]').isVisible(),true);
   await page.getByRole('button',{name:'Sidebar Create'}).click();
   assert.equal((await page.evaluate(()=>window.fixture.state())).min,false,'Create opens; it never toggles an open composer shut');
   assert.deepEqual(errors,[]);console.log('PASS fullscreen sidebar Create '+route+' '+width+'px');await page.close();
  }
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
