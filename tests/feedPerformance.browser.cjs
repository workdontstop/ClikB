const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.tmp/feed-performance');
fs.mkdirSync(output, { recursive: true });
const baseline = process.argv.includes('--baseline');
const fixture = `
import React,{StrictMode,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {BrowserRouter,useLocation,useNavigate} from 'react-router-dom';
import axios from 'axios';
import StoryAutoScroller from '/src/StoryAutoScroller.tsx';
import TouchPreviewMedia from '/src/TouchPreviewMedia.tsx';
import InteractInput from '/src/InteractInput.tsx';
import Feedgate from '/src/FeedsGate.tsx';
import {store} from '/src/store.ts';
import {setAutoControl,setThemePreference} from '/src/settingsSlice.ts';
import {clear,cacheStats} from '/src/interactionAssetCache.ts';
store.dispatch(setThemePreference('light'));store.dispatch(setAutoControl({enabled:false,actor:'user'}));
window.__assetCacheDebug=false;
const poster='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="500"><rect width="300" height="500" fill="#357c9d"/></svg>');
const noop=()=>{};
const interactionPost={id:97,mode:2,inttype:1,x1:poster,main:'/media/main.mp4'};
const hotspots=[{id:'left',x:.3,y:.6,r:.12},{id:'right',x:.7,y:.6,r:.12},{id:'top',x:.5,y:.3,r:.12},{id:'bottom',x:.5,y:.8,r:.12}];
function Interaction(){return <div id="interaction" style={{position:'relative',width:800,height:600}}><InteractInput vid1="/media/main.mp4" vid2="" vid3="" mode="touch" setmode={noop} stage={2} setStage={noop} interactionPostId={97} touchHotspots={hotspots} setTouchHotspots={noop} feeds={true} wipeInteractionState={noop} mainAudioUrl="" sub1AudioUrl="" sub2AudioUrl="" setMainAudioUrl={noop} setSub1AudioUrl={noop} setSub2AudioUrl={noop} mainAudioUrlx="" sub1AudioUrlx="" sub2AudioUrlx="" setMainAudioUrlx={noop} setSub1AudioUrlx={noop} setSub2AudioUrlx={noop} videoArray={[]} feedData={interactionPost}/></div>}
window.events=[];window.requests=[];window.releaseMedia=null;
HTMLMediaElement.prototype.play=function(){window.events.push({kind:'play',src:this.getAttribute('src')});return Promise.resolve();};
HTMLMediaElement.prototype.pause=function(){};HTMLMediaElement.prototype.load=function(){};
window.fetch=(url)=>{window.requests.push(String(url));return new Promise(resolve=>{if(String(url).endsWith('main.mp4'))window.releaseMedia=()=>resolve(new Response(new Blob(['fixture'],{type:'video/mp4'})));});};
const feeds=Array.from({length:36},(_,i)=>({id:i+1,sender:3,username:'fixture',mode:0,item1:poster,x1:poster,x2:poster,xv2:'/media/branch-'+i+'.mp4',caption:'Post '+(i+1)}));
axios.post=async(url)=>{window.apiCalls=(window.apiCalls||0)+1;await new Promise(resolve=>setTimeout(resolve,350));return {data:{payload:feeds,hasMore:false}};};
function Grid(){const [loaded,setLoaded]=useState(Array(36).fill(true));return <div id="grid" style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:20}}>{feeds.map((post,i)=><StoryAutoScroller key={post.id} images={[poster,poster]} image={poster} caption={post.caption} onClick={()=>{}} type={4} isMenuOpen={false} captionVisibility={Array(36).fill(true)} idx={i} videoUrlItem={post.xv2} itemLoadArray={loaded} setitemLoadArray={setLoaded} minimisePrompt={true} vertical={true} isFullscreen={false} mode={0}/>)}</div>}
function Hotspot(){const mainRef=useRef(null),left=useRef(null),right=useRef(null),top=useRef(null),bottom=useRef(null),mainAudioRef=useRef(null),la=useRef(null),ra=useRef(null),ta=useRef(null),ba=useRef(null),globalAudioRef=useRef(null);const [loaded,setLoaded]=useState(false),[preloaded,setPreloaded]=useState(false),[audio,setAudio]=useState(false),[branchLoaded,setBranchLoaded]=useState({left:false,right:false,top:false,bottom:false});return <div id="hotspot" style={{position:'relative',width:300,height:500}}><TouchPreviewMedia mainRef={mainRef} subRefs={{left,right,top,bottom}} mainAudioRef={mainAudioRef} branchAudioRefs={{left:la,right:ra,top:ta,bottom:ba}} mainSrc="/media/main.mp4" subs={['/media/left.mp4','/media/right.mp4','/media/top.mp4','/media/bottom.mp4']} preloadKey="root" mainPoster={poster} feeds={{x1:poster}} MuteReducer={true} IS_IPHONE_OR_SAFARI={false} active={null} mainLoaded={loaded} branchLoaded={branchLoaded} setMainLoaded={setLoaded} setBranchLoaded={(branch,value)=>setBranchLoaded(s=>({...s,[branch]:value}))} handleMainPointerUp={()=>{}} jumpToPrePause={()=>{}} onExitSub={()=>{}} audioEnabled={audio} setAudioEnabled={setAudio} globalAudioRef={globalAudioRef} setIsPreloaded={setPreloaded} isPreloaded={preloaded} branchAudioUrls={{}}/></div>}
function Feeds(){const location=useLocation(),navigate=useNavigate(),ref=useRef(null),[posts,setPosts]=useState([]),[call,setCall]=useState(true),[last,setLast]=useState(null),[fullscreen,setFullscreen]=useState(false);window.nav=navigate;useEffect(()=>setCall(true),[location.pathname]);return <Feedgate key={location.pathname} callFeeds={call} setcallFeeds={setCall} feeds={posts} setFeeds={setPosts} LastId={last} setLastId={setLast} type={location.pathname==='/images'?1:4} vertical={true} isMenuOpen={false} minimisePrompt={true} feedContainerRef={ref} isFullscreen={fullscreen} setIsFullscreen={setFullscreen} setsearchDataNav={()=>{}} setMyPageIdNav={()=>{}} setfeedLastIdNav={()=>{}} setfeedScrollPosNav={()=>{}}/>}
function App(){const mode=new URLSearchParams(location.search).get('fixture');return mode==='interaction'?<BrowserRouter><Interaction/></BrowserRouter>:mode==='hotspot'?<Hotspot/>:mode==='feeds'?<BrowserRouter><Feeds/></BrowserRouter>:<Grid/>;}
createRoot(document.getElementById('root')).render(<StrictMode><Provider store={store}><App/></Provider></StrictMode>);
window.cacheStats=cacheStats;
`;
(async () => {
  const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')));
  const server = await createServer({ root, configFile: false, logLevel: 'error', cacheDir: path.join(output, 'vite'),
    optimizeDeps: { include: ['react', 'react/jsx-runtime', 'react-dom/client', 'react-router-dom', 'react-redux', '@reduxjs/toolkit', '@mui/material', '@emotion/react', '@emotion/styled', 'axios', 'framer-motion'] },
    esbuild: { jsx: 'automatic' }, server: { host: '127.0.0.1', port: 5298, strictPort: true, hmr: false },
    plugins: [{ name: 'feed-performance-fixture', enforce: 'pre',
      resolveId(id, importer) {
        if (id === '/fixture.js') return '\0fixture';
        if (importer?.endsWith('/InteractInput.tsx') && ['./DefaultStageUI','./SwipeEditStageUI','./SwipePreviewStageUI','./TouchEditStageUI','./Texttospeech','./InteractionNodeMap'].includes(id)) return '\0empty';
        if (importer?.endsWith('/FeedsGate.tsx') && ['./FeedLayout', './FeedLayoutHorizontal'].includes(id)) return '\0layout';
        if (importer?.endsWith('/FeedsGate.tsx') && ['./FullScreenStories', './StoryAutoScroller', './Footer', './ProfileInfo'].includes(id)) return '\0empty';
        if (id === './DeckRuntimeContext' && importer?.endsWith('/FeedsGate.tsx')) return '\0runtime';
      },
      load(id) {
        if (id === '\0fixture') return ts.transpileModule(fixture, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
        if (id === '\0empty') return 'export default ()=>null;';
        if (id === '\0runtime') return 'export const useDeckRuntime=()=>({minimisePrompt:false,creationEpoch:0,prepareDeck(){},onCreate(){},dismissCreationBackdrop(){},setDockHost(){}});';
        if (id === '\0layout') return "import React from 'react';export default props=>React.createElement('div',{id:'feed-posts'},...props.feeds.map(p=>React.createElement('img',{key:p.id,src:p.item1,'data-post':p.id})));";
      },
      configureServer(s) { s.middlewares.use((req, res, next) => { if (req.url.startsWith('/__test') || /^\/(feeds|images)\?fixture=/.test(req.url)) { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><style>body{margin:0}</style><div id="root"></div><script type="module" src="/fixture.js"></script>'); } else next(); }); },
    }],
  });
  await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  const report = {};
  try {
    await page.goto('http://127.0.0.1:5298/__test?fixture=grid', {waitUntil:'domcontentloaded'});
    await page.waitForSelector('#grid img');
    await page.waitForTimeout(12000);
    report.grid = await page.evaluate(() => ({ mountedVideos: document.querySelectorAll('#grid video').length, playCalls: window.events.length, offscreenVideos: [...document.querySelectorAll('#grid video')].filter(v=>v.getBoundingClientRect().top>innerHeight+200).length }));
    await page.screenshot({ path: path.join(output, baseline ? 'grid-before.png' : 'grid-after.png') });
    await page.goto('http://127.0.0.1:5298/__test?fixture=hotspot', {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.releaseMedia);
    await page.waitForTimeout(400);
    report.hotspot = await page.evaluate(() => ({ requestsBeforeMainReady: window.requests.length, hasPreview: [...document.querySelectorAll('#hotspot img')].some(img=>img.complete&&img.naturalWidth>0&&getComputedStyle(img).opacity!=='0'), mainSourceBeforeReady: document.querySelector('#hotspot video').getAttribute('src') }));
    await page.screenshot({ path: path.join(output, baseline ? 'hotspot-before.png' : 'hotspot-after.png') });
    await page.evaluate(() => window.releaseMedia());
    await page.waitForFunction(() => document.querySelector('#hotspot video').getAttribute('src')?.startsWith('blob:'));
    await page.evaluate(() => document.querySelector('#hotspot video').dispatchEvent(new Event('loadeddata')));
    await page.waitForTimeout(300);
    report.hotspot.requestsAfterMainReady = await page.evaluate(() => window.requests.length);
    if (!baseline) {
      await page.goto('http://127.0.0.1:5298/__test?fixture=interaction', {waitUntil:'domcontentloaded'});
      await page.waitForFunction(() => window.releaseMedia);
      await page.waitForTimeout(200);
      report.interaction = await page.evaluate(() => ({ hiddenAutoplay: document.querySelector('#main-video').autoplay, hiddenPreload: document.querySelector('#main-video').preload, hasPreview: [...document.querySelectorAll('#interaction img')].some(img=>img.complete&&img.naturalWidth>0), snapshotCanvas: Boolean(document.querySelector('#interaction canvas')) }));
      assert.equal(report.interaction.hiddenAutoplay, false, 'hidden measuring video must not run a second player');
      assert.equal(report.interaction.hiddenPreload, 'metadata', 'hidden measuring video still supplies dimensions');
      assert.equal(report.interaction.hasPreview, true, 'the real hotspot stage must receive the saved post cover');
      assert.equal(report.interaction.snapshotCanvas, true, 'transition snapshot canvas remains mounted');
    }
    await page.goto('http://127.0.0.1:5298/feeds?fixture=feeds', {waitUntil:'domcontentloaded'});
    await page.waitForSelector('[data-post]');
    await page.evaluate(() => window.nav('/images?fixture=feeds'));
    await page.waitForTimeout(550);
    const callsBeforeReturn = await page.evaluate(() => window.apiCalls);
    await page.evaluate(() => { window.reentryStart=performance.now(); window.nav('/feeds?fixture=feeds'); });
    await page.waitForSelector('[data-post]');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    report.feeds = await page.evaluate(() => ({ reentryMs: Math.round(performance.now()-window.reentryStart), apiCalls: window.apiCalls }));
    report.feeds.newRequestsOnReentry = report.feeds.apiCalls - callsBeforeReturn;
    console.log(JSON.stringify(report));
    if (!baseline) {
      assert.equal(report.grid.offscreenVideos, 0, 'offscreen grid cards must not own decoders');
      assert.equal(report.hotspot.hasPreview, true, 'poster must be visible during a pending video download');
      assert.equal(report.hotspot.requestsBeforeMainReady, 1, 'opening video must get bandwidth before branch lookahead');
      assert.equal(report.hotspot.requestsAfterMainReady, 5, 'all four branches still preload after the opening frame');
      assert.ok(report.feeds.reentryMs < 250, 'cached feed must restore without waiting for the API');
      assert.equal(report.feeds.newRequestsOnReentry, 0, 'cached re-entry must not request the feed again');
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, baseline ? 'before.json' : 'after.json'), JSON.stringify(report, null, 2));
  } finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

