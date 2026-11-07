const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||'../.tmp/concierge-browser-deps/node_modules/playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'.tmp/deck'),port=5219;
fs.mkdirSync(output,{recursive:true});
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
// Real DeckRuntimeProvider keeps one production Guide mounted while its portal
// changes host. Only conversational/speech providers are mocked, with call and
// subscription counts. No requests leave localhost and no provider calls run.
const session=compile(`
import React from 'react';
const state={status:'idle',guideEnabled:true,guidePanelState:'normal',guidePlayMode:false,chatHistory:[]};
const listeners=new Set();const metrics={mounts:0,unmounts:0,voiceStarts:0,voiceStops:0,speech:[],speechStops:0,textCalls:[],voiceCalls:[]};
const update=patch=>{Object.assign(state,patch);listeners.forEach(listener=>listener());};
const noop=()=>{};
const reply='The current Deck contains a dragon story, a space journey, and a quiet cinema scene. '+('This explanation remains in the same conversation as the user moves between Deck, fullscreen and the grid. '.repeat(8));
const voice={error:null,level:.3,start:async()=>{metrics.voiceStarts++;update({status:'listening'});},stop:()=>{metrics.voiceStops++;update({status:'idle'});},askText:async text=>{metrics.voiceCalls.push(text);update({status:'speaking',chatHistory:[...state.chatHistory,{id:'user-'+Date.now(),role:'user',content:text},{id:'voice-'+Date.now(),role:'ai',content:reply}]});return reply;},speakText:async text=>{metrics.speech.push(text);},stopSpeech:()=>{metrics.speechStops++;}};
const stable={textAsk:async text=>{metrics.textCalls.push(text);update({chatHistory:[...state.chatHistory,{id:'user-'+Date.now(),role:'user',content:text},{id:'reply-'+Date.now(),role:'ai',content:reply}]});return reply;},setGuideEnabled:guideEnabled=>update({guideEnabled}),setGuidePanelState:guidePanelState=>update({guidePanelState}),setGuidePlayMode:guidePlayMode=>update({guidePlayMode}),hasGuideUseTarget:false,guideUseTargetLabel:'Prompt',appendGuideTextToTarget:()=>false,isGuideInlineHostActive:false,registerGuideInlineHost:()=>noop};
window.guideTest={state:()=>({...state}),metrics:()=>({...metrics,activeSubscriptions:listeners.size}),update};
export function useBrainstormSession(){const [,render]=React.useReducer(n=>n+1,0);React.useEffect(()=>{metrics.mounts++;listeners.add(render);return()=>{metrics.unmounts++;listeners.delete(render);};},[]);return {...stable,...state,voice:{...voice,status:state.status}};}
`);
const fixture=compile(`
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider,useSelector} from 'react-redux';
import {BrowserRouter} from 'react-router-dom';
import {store} from '/src/store.ts';
import {setThemePreference,setPixelsOverlayOpen,setDeckCleanMode} from '/src/settingsSlice.ts';
import {setLoggedUser} from '/src/profileSlice.ts';
import {patchUserSnapshot} from '/src/brainstormSlice.ts';
import DeckOverlay from '/src/DeckOverlay.tsx';
import {DeckRuntimeProvider,useDeckRuntime} from '/src/DeckRuntimeContext.tsx';
import BottomMenu from '/src/BottomMenu.tsx';
import AutoControlPill from '/src/AutoControlPill.tsx';
import {matchMobile} from '/src/DetectDevice.ts';
store.dispatch(setThemePreference('dark'));
store.dispatch(setLoggedUser({id:7,name:'Owner',username:'owner',image:'',deckEnabled:true}));
store.dispatch(setDeckCleanMode(false));
store.dispatch(patchUserSnapshot({creation:{stage:'feed_browsing',isInitialComposer:false,isActive:false}}));
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700"><rect width="500" height="700" fill="#254957"/></svg>');
const posts=Array.from({length:28},(_,i)=>({id:i+1,sender:7,username:'stargazer',mode:0,x1:image,finalTitle:'A story '+(i+1),finalOverview:'A concise story overview'}));
function Stage({mode,setMode,menu,setMenu}){
 const runtime=useDeckRuntime();
 const deckOpen=useSelector(state=>state.brainstorm.userSnapshot.feeds?.areas['clikb.feeds.deck']?.state.isOpen===true);
 const deckEnabled=useSelector(state=>state.settings.deckEnabled);
 const [active,setActive]=useState(1);
 window.deckGuide={mode:setMode,state:()=>({mode,minimisePrompt:runtime.minimisePrompt,menu,mobile:matchMobile}),menu:setMenu,pixels:open=>store.dispatch(setPixelsOverlayOpen(open)),profile:()=>store.getState().profile.loggedUser,theme:theme=>store.dispatch(setThemePreference(theme))};
 return <>
  <aside style={{display:menu?'block':'none',position:'fixed',inset:'0 auto 64px 0',width:'20%',background:'#222935',padding:12,boxSizing:'border-box'}}>Sidebar remains accessible</aside>
  <main style={{marginLeft:menu?'20%':0,minHeight:'100vh'}}>
   {mode==='deck'&&deckEnabled?<DeckOverlay cards={posts} activePostId={active} category="all" loading={false} hasMore={true} error={null} onSelectPost={setActive} onPlay={()=>setMode('fullscreen')} onPaginate={()=>{}} onCategory={()=>{}} onClose={()=>setMode('grid')} onCreate={()=>{setMode('grid');runtime.openCreate();}} onDockHost={runtime.setDockHost} isMenuOpen={menu}/>:<div id={mode} style={{position:'fixed',inset:0,background:mode==='fullscreen'?'#151b24':'#202733'}}>Underlying {mode}</div>}
  </main>
  <AutoControlPill hidden={!runtime.minimisePrompt||deckOpen} isMenuOpen={menu}/>
  {mode!=='fullscreen'&&<BottomMenu activeIndex={1} setActiveIndex={()=>{}} isFullscreen={false} isMenuOpen={menu} MenuOpenb={false} setMenuOpenb={()=>{}} setIsMenuOpen={setMenu} setminimisePrompt={()=>{}}/>}
 </>;
}
function App(){const [mode,setMode]=useState('deck'),[minimisePrompt,setMinimisePrompt]=useState(true),[menu,setMenu]=useState(!matchMobile);return <DeckRuntimeProvider minimisePrompt={minimisePrompt} setminimisePrompt={setMinimisePrompt} clikUrl="/fixture" isMenuOpen={menu} matchMobile={matchMobile}><Stage mode={mode} setMode={setMode} menu={menu} setMenu={setMenu}/></DeckRuntimeProvider>;}
createRoot(document.getElementById('root')).render(<Provider store={store}><BrowserRouter><App/></BrowserRouter></Provider>);
`);
(async()=>{
 const {createServer}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')));
 const icons=['CloseRounded','EditRounded','MicRounded','PauseRounded','PlayArrowRounded','PowerSettingsNewRounded','SendRounded','KeyboardArrowDownRounded','KeyboardArrowUpRounded','TouchAppRounded','Photo','TouchApp','Person','Weekend','Widgets','AddCircle','HorizontalSplit','Menu','Search','AutoAwesome','RocketLaunch','Close'];
 const server=await createServer({root,configFile:false,logLevel:'error',cacheDir:path.join(output,'guide-vite'),optimizeDeps:{noDiscovery:true,entries:[],include:['react','react/jsx-runtime','react/jsx-dev-runtime','react-dom','react-dom/client','react-redux','react-router-dom','react-device-detect','use-sync-external-store/with-selector','use-sync-external-store/shim/with-selector','@reduxjs/toolkit','@mui/material','@mui/material/styles','@emotion/react','@emotion/styled','prop-types','react-is','axios',...icons.map(icon=>'@mui/icons-material/'+icon)]},esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port,strictPort:true,hmr:false},plugins:[{
  name:'deck-guide-fixture',enforce:'pre',resolveId(id,importer){if(id==='/deck-guide-fixture.js')return '\0deck-guide-fixture';if(importer?.includes('GlobalBrainstormGuide')&&id==='./BrainstormSessionProvider')return '\0deck-guide-session';},load(id){if(id==='\0deck-guide-fixture')return fixture;if(id==='\0deck-guide-session')return session;},configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url.startsWith('/feeds')){res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#141922;min-height:100%;color:white;font-family:system-ui}*,*::before,*::after{animation:none!important;transition:none!important}</style><div id="root"></div><script type="module" src="/deck-guide-fixture.js"></script>');}else next();});}
 }]});await server.listen();
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  for(const width of [1280,390,320]){
   const mobile=width<600,height=mobile?844:860;
   const context=await browser.newContext({viewport:{width,height},isMobile:mobile,...(mobile?{userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'}:{})}),page=await context.newPage(),errors=[];
   page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(60000);page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:'+port+'/')?route.continue():route.abort());
   const preferenceWrites=[];
   let rejectPreference=true;
   await page.route('**/fixture/settings/deck', route=>{
    preferenceWrites.push(route.request().postDataJSON());
    return route.fulfill({status:rejectPreference?500:200,json:{}});
   });
   await page.clock.install();await page.goto('http://127.0.0.1:'+port+'/feeds',{waitUntil:'domcontentloaded'});
   const guide=page.locator('[data-guide-ui="true"]');await guide.waitFor();
   await page.waitForFunction(()=>document.querySelector('[data-deck-concierge-host] [data-guide-ui]'));
   assert.equal(await guide.count(),1);assert.equal(await page.evaluate(()=>window.guideTest.metrics().mounts),1);assert.equal(await page.evaluate(()=>window.guideTest.metrics().activeSubscriptions),1);
   const response=page.getByRole('status',{name:'Expand Guide response'});await response.waitFor();
   assert.equal(await response.textContent(),'I am ready to guide you through ClikB.');
   assert.deepEqual(await page.evaluate(()=>window.guideTest.metrics().textCalls),[]);assert.deepEqual(await page.evaluate(()=>window.guideTest.metrics().speech),[]);
   await page.clock.fastForward(10050);assert.equal(await page.getByRole('dialog',{name:'ClikB Guide Mode',exact:true}).count(),1);assert.equal(await page.evaluate(()=>window.guideTest.state().guidePanelState),'normal');
   await page.getByRole('button',{name:'Minimise Guide text',exact:true}).click();await page.getByRole('button',{name:'Expand Guide text',exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.guideTest.state().guideEnabled),true);
   await page.getByRole('button',{name:'Expand Guide text',exact:true}).click();await page.getByRole('button',{name:'Open Guide input',exact:true}).waitFor();
   await page.getByRole('button',{name:'Play responses aloud',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.guideTest.metrics().speech),['I am ready to guide you through ClikB.']);
   await page.getByRole('button',{name:'Pause spoken responses',exact:true}).click();
   await page.getByRole('button',{name:'Open Guide input',exact:true}).click();await page.getByRole('textbox',{name:'Message to Guide'}).fill('Retained concierge draft');
   const deckOn=page.getByRole('button',{name:'Deck on. Turn Deck off'}),deckOff=page.getByRole('button',{name:'Deck off. Turn Deck on'});
   assert.equal(await deckOn.getAttribute('data-ai-action'),null);
   assert.equal(await deckOn.evaluate(node=>getComputedStyle(node).color),'rgb(0, 0, 0)');
   await page.evaluate(()=>window.deckGuide.theme('light'));
   assert.equal(await deckOn.evaluate(node=>getComputedStyle(node).color),'rgb(255, 255, 255)');
   await page.evaluate(()=>window.deckGuide.theme('dark'));
   await deckOn.click();await page.getByRole('alert').getByText('Deck preference could not be saved. Try again.').waitFor();
   assert.equal(await page.evaluate(()=>window.deckGuide.profile().deckEnabled),true);
   rejectPreference=false;
   await deckOn.click();await deckOff.waitFor();
   await page.locator('.deck-overlay').waitFor({state:'hidden'});
   await page.waitForFunction(()=>window.deckGuide.profile().deckEnabled===false);
   assert.equal(await page.getByRole('textbox',{name:'Message to Guide'}).inputValue(),'Retained concierge draft');
   await deckOff.click();await deckOn.waitFor();await page.waitForFunction(()=>window.deckGuide.profile().deckEnabled===true);
   assert.deepEqual(preferenceWrites,[{enabled:false},{enabled:false},{enabled:true}]);
   for(const mode of ['fullscreen','grid','deck']){await page.evaluate(mode=>window.deckGuide.mode(mode),mode);await page.waitForFunction(mode=>window.deckGuide.state().mode===mode,mode);assert.equal(await guide.count(),1);assert.equal(await page.getByRole('textbox',{name:'Message to Guide'}).inputValue(),'Retained concierge draft');}
   assert.equal(await page.evaluate(()=>window.guideTest.metrics().mounts),1);assert.equal(await page.evaluate(()=>window.guideTest.metrics().unmounts),0);assert.deepEqual(await page.evaluate(()=>window.guideTest.metrics().textCalls),[]);
   await page.getByRole('textbox',{name:'Message to Guide'}).fill('Explain this deck');await page.getByRole('textbox',{name:'Message to Guide'}).press('Enter');await page.waitForFunction(()=>window.guideTest.metrics().textCalls.length===1);
   await page.getByRole('status',{name:'Expand Guide response'}).click();await page.getByRole('status',{name:'Contract Guide response'}).waitFor();
   await page.getByRole('button',{name:'Show Auto Control',exact:true}).click();await page.getByRole('button',{name:'Auto Control off. Turn on',exact:true}).click();
   assert.equal(await page.getByRole('button',{name:'Auto Control on. Turn off',exact:true}).count(),1);
   const geometry=await page.evaluate(()=>{const host=document.querySelector('[data-deck-concierge-host]'),guide=host.querySelector('[data-guide-ui]'),panel=guide.querySelector('[role="dialog"]'),pill=host.closest('.deck-dock').querySelector('[aria-label="Auto Control"]');const h=host.getBoundingClientRect(),g=guide.getBoundingClientRect(),p=panel.getBoundingClientRect(),a=pill.getBoundingClientRect(),style=getComputedStyle(pill);return {host:{left:h.left,right:h.right},guide:{left:g.left,right:g.right},panel:{left:p.left,right:p.right,bottom:p.bottom},pill:{left:a.left,right:a.right,top:a.top,bottom:a.bottom,minHeight:parseFloat(style.minHeight),fontSize:parseFloat(style.fontSize)},pillCount:document.querySelectorAll('[data-auto-control]').length,width:innerWidth,scrollWidth:document.documentElement.scrollWidth};});
   assert.ok(geometry.guide.left>=geometry.host.left-1&&geometry.guide.right<=geometry.host.right+1,'Guide stays in Deck host');assert.ok(geometry.panel.left>=0&&geometry.panel.right<=width,'Expanded reply stays in viewport');assert.equal(geometry.scrollWidth<=width,true,'No horizontal overflow');
   await page.screenshot({path:path.join(output,'deck-control-'+width+'.png')});
   assert.equal(geometry.pillCount,1,'Deck has one Auto Control pill');
   const pillWidth=geometry.pill.right-geometry.pill.left;
   const expectedCenter=Math.min((geometry.panel.left+geometry.panel.right)/2,geometry.host.right-pillWidth/2);
   assert.ok(Math.abs((geometry.pill.left+geometry.pill.right)/2-expectedCenter)<2,'Auto Control is centered beneath the response within the Deck bounds: '+JSON.stringify(geometry));
   assert.ok(geometry.pill.top>=geometry.panel.bottom+4,'Auto Control has space below the response');
   assert.equal(geometry.pill.minHeight,mobile?42:48,'Auto Control uses its normal height');
   assert.equal(geometry.pill.fontSize,mobile?12:14,'Auto Control uses its normal text size');
   assert.ok(geometry.pill.left>=0&&geometry.pill.right<=width,'Auto Control stays inside narrow viewports');
   const navHit=await page.locator('[data-ai-action="clikb.navigation.bottom_menu.action.shorts"]').evaluate(button=>{const r=button.getBoundingClientRect();const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {visible:hit===button||button.contains(hit),top:r.top,width:r.width,height:r.height};});assert.equal(navHit.visible,true,'BottomMenu is clickable above Deck');assert.ok(navHit.width>=44&&navHit.height>=44);
   assert.ok(geometry.pill.bottom<=navHit.top,'Expanded response keeps Auto Control above bottom navigation: '+JSON.stringify(geometry));
   await page.screenshot({path:path.join(output,'deck-concierge-'+width+'.png')});
   await page.getByRole('status',{name:'Contract Guide response'}).click();
   await page.screenshot({path:path.join(output,'deck-normal-'+width+'.png')});
   await page.getByRole('button',{name:'Minimise Guide text',exact:true}).click();
   assert.equal(await page.locator('[data-auto-control]').count(),1,'Auto Control remains available with compact Guide');
   await page.getByRole('button',{name:'Expand Guide text',exact:true}).click();
   await page.evaluate(()=>window.deckGuide.pixels(true));
   await page.waitForFunction(()=>!document.querySelector('[data-guide-ui]'));
   assert.equal(await page.getByRole('button',{name:'Auto Control on. Turn off',exact:true}).count(),1,'Permission stays available while the Guide is temporarily suppressed');
   await page.evaluate(()=>window.deckGuide.pixels(false));await guide.waitFor();
   await page.getByRole('button',{name:'Auto Control on. Turn off',exact:true}).click();
   await page.getByRole('button',{name:'Auto Control off. Turn on',exact:true}).click();
   await page.getByRole('button',{name:'Hide Auto Control and turn it off',exact:true}).click();
   assert.equal(await page.locator('[data-auto-control]').count(),0);
   await page.getByRole('button',{name:'Show Auto Control',exact:true}).click();
   await page.getByRole('button',{name:'Auto Control off. Turn on',exact:true}).click();
   await page.getByRole('button',{name:'Speak with Guide',exact:true}).click();await page.getByRole('button',{name:'Type a message in voice mode',exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.guideTest.metrics().voiceStarts),1);
   await page.getByRole('button',{name:'Type a message in voice mode',exact:true}).click();await page.getByRole('textbox',{name:'Message to Guide'}).fill('Explain aloud');await page.getByRole('textbox',{name:'Message to Guide'}).press('Enter');await page.waitForFunction(()=>window.guideTest.metrics().voiceCalls.length===1);
   assert.equal(await guide.count(),1);assert.equal(await page.evaluate(()=>window.guideTest.metrics().mounts),1);assert.deepEqual(errors,[]);
   console.log('PASS real Guide '+(mobile?'mobile':'desktop')+': one mount through Deck/fullscreen/grid, exact greeting + speech, stays expanded after ten seconds with manual compact/reexpand, local text draft/conversation retained, manual text/voice/Auto Control, dock bounds and BottomMenu hit test');
   await context.close();
  }
 }finally{await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
