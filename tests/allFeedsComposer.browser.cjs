const assert=require('node:assert/strict'),path=require('node:path'),{build}=require('esbuild');
const {chromium}=require('../.tmp/concierge-browser-deps/node_modules/playwright');
const root=path.resolve(__dirname,'..');
const fixture=`
import React,{StrictMode,useEffect,useMemo,useState} from 'react';import {createRoot} from 'react-dom/client';
import {Provider,useSelector} from 'react-redux';import {BrowserRouter,useLocation,useNavigate} from 'react-router-dom';
import {store} from './src/store';import {setLoggedUser} from './src/profileSlice';
import {useInitialAllFeedsComposer} from './src/allFeedsLanding';import {useDeckNavigation} from './src/useDeckNavigation';import {usePromptInputHistory} from './src/usePromptInputHistory';
import {ChatProvider,useSocialChat} from './src/SocialChat';
function OpenChat(){const {open}=useSocialChat();return <button onClick={()=>open()}>Open Chat</button>;}
const q=new URLSearchParams(location.search),view=q.get('view'),enabled=q.get('saved')!=='off';
const base={version:1,sessionId:'fixture',activePostId:5,collectionIds:[5,6],collectionReady:true,category:'all',scroll:{x:0,y:0},returnTo:{pathname:'/feeds',search:'',hash:'',state:null}};
const usr=view==='grid'?{clikbDeckGrid:{sessionId:'fixture'}}:view==='story'||view==='deck'?{clikbDeck:{...base,tier:view}}:null;
if(view==='story'||view==='deck')q.set(view==='story'?'story':'deck','5');history.replaceState({idx:0,key:'initial',usr},'','/feeds?'+q);
function App(){const location=useLocation(),navigate=useNavigate(),account=useSelector(s=>s.profile.loggedUser),deckEnabled=useSelector(s=>s.settings.deckEnabled);
 const [minimised,setMinimised]=useState(true),[fullscreen,setFullscreen]=useState(null),feeds=useMemo(()=>[{id:5},{id:6}],[]);
 useEffect(()=>{const timer=setTimeout(()=>store.dispatch(setLoggedUser({id:7,name:'Owner',username:'owner',image:'',imageThumb:'',deckEnabled:enabled})),35);return()=>clearTimeout(timer);},[]);
 useInitialAllFeedsComposer(location,!!account,deckEnabled,setMinimised);
 const deck=useDeckNavigation({feeds,category:'all',enabled:location.pathname==='/feeds',deckEnabled:!!account&&deckEnabled,loading:false,minimisePrompt:minimised,getScroll:()=>({x:0,y:0}),restoreScroll:()=>{},prepareDeck:()=>setMinimised(true),onFullscreen:setFullscreen,onCreate:()=>setMinimised(false)});
 usePromptInputHistory({open:!minimised,suspended:false,blockBack:false,routeKey:location.key,onClose:()=>setMinimised(true),onReopen:()=>setMinimised(false)});
 window.fixture={state:()=>({ready:!!account,minimised,deck:deck.isDeckOpen,fullscreen,idx:history.state.idx}),nav:navigate};
 return <ChatProvider minimisePrompt={minimised} onMinimisePrompt={()=>setMinimised(true)}><main><OpenChat/>{!minimised&&<section data-composer><button onClick={()=>setMinimised(true)}>Close composer</button></section>}</main></ChatProvider>;
}createRoot(document.getElementById('root')).render(<StrictMode><Provider store={store}><BrowserRouter><App/></BrowserRouter></Provider></StrictMode>);`;
(async()=>{
 const bundle=await build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',loader:{'.css':'empty'},define:{'import.meta.env':'{}'},plugins:[{name:'offline',setup(b){b.onResolve({filter:/SharedBackControl$/},args=>({path:args.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const registerSharedBack=()=>()=>{};',loader:'js'}));}}]});
 const html='<div id="root"></div><script>'+bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>';
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{for(const saved of ['on','off'])for(const view of ['default','deck','grid','story']){
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:html}));
  await page.goto('http://fixture.test/feeds?saved='+saved+'&view='+view);await page.waitForFunction(()=>window.fixture?.state().ready);await page.waitForTimeout(80);
  const expected=view!=='story'&&(saved==='off'||view!=='grid'),state=await page.evaluate(()=>window.fixture.state());
  assert.equal(!state.minimised,expected,JSON.stringify({saved,view,state}));
  assert.equal(state.deck,saved==='on'&&view!=='story'&&view!=='grid');assert.equal(state.fullscreen,view==='story'?5:null);
  if(expected && view==='default'){
   assert.ok(await page.evaluate(()=>history.state.clikbPromptInput),'composer owns the current entry');
   await page.getByRole('button',{name:'Open Chat'}).click();
   await page.getByRole('dialog',{name:'Chat'}).waitFor();
   assert.equal(await page.evaluate(()=>window.fixture.state().minimised),true);
   assert.equal(await page.evaluate(()=>history.state.idx),state.idx,'Chat replaces the composer entry');
   await page.getByRole('button',{name:'Close Chat'}).click();
   await page.getByRole('dialog',{name:'Chat'}).waitFor({state:'hidden'});
   assert.equal(await page.evaluate(()=>window.fixture.state().deck),state.deck);
   assert.equal(await page.evaluate(()=>window.fixture.state().minimised),true);
  } else if(expected){await page.getByRole('button',{name:'Close composer'}).click();await page.waitForFunction(()=>window.fixture.state().minimised&&!history.state.clikbPromptInput);}
  await page.evaluate(()=>window.fixture.nav('/settings'));await page.evaluate(()=>window.fixture.nav('/feeds'));await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>window.fixture.state().minimised),true,'Ordinary navigation never repeats the startup opening');
  assert.deepEqual(errors,[]);console.log('PASS fresh All Feeds '+saved+'/'+view+': saved preference, exact composer policy, X remains closed through navigation');await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
