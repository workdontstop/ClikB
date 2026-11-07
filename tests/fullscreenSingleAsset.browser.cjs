const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const videoFile = path.join(root, '.tmp/viewer-cover-browser/portrait.mp4');
const contentBounds = locator => locator.evaluate(node => {
 const r = node.getBoundingClientRect(), w = node.videoWidth || node.naturalWidth, h = node.videoHeight || node.naturalHeight;
 const scale = Math.min(r.width / w, r.height / h), width = w * scale, height = h * scale;
 return {x:r.x + (r.width-width)/2, y:r.y + (r.height-height)/2, width, height};
});
const fixture = `
import React,{useState,useRef,useMemo} from 'react';import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';import {BrowserRouter} from 'react-router-dom';
import FullScreenStories from './src/FullScreenStories';import {store} from './src/store';
import {setThemePreference} from './src/settingsSlice';store.dispatch(setThemePreference('light'));
const noop=()=>{};window.fixture={closed:0};history.back=()=>window.fixture.closed++;
function App(){
 const params=new URLSearchParams(location.search),kind=params.get('kind')||'single',ratio=Number(params.get('ratio')||0);
 const [menu,setMenu]=useState(params.has('menu')),[index,setIndex]=useState(0),[horizontal,setHorizontal]=useState(0),[videos,setVideos]=useState(['/wrong-post.mp4']),[audio,setAudio]=useState([]),[generated,setGenerated]=useState([]),[liked,setLiked]=useState([{liked:false}]),[counts,setCounts]=useState([{count:0}]);
 const refs=useRef([]),container=useRef(null),audioRef=useRef(null),feedRef=useRef(null);
 const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960"><rect width="540" height="960" fill="#35597a"/></svg>');
 const feeds=useMemo(()=>Array.from({length:kind==='sequence'?20:1},(_,i)=>({id:777+i,sender:2,username:'fixture',caption:'Single scene '+i,profile_image:image,item1:image,x1:kind==='story'?image:'',xv1:kind==='video'?'/fixture.mp4':kind==='sequence'?'/fixture.mp4?post='+(777+i):'',mode:0,ratio})),[]);
 window.fixture.menu=setMenu;
 return <FullScreenStories feeds={feeds} activeIndex={index} setActiveIndex={setIndex} verticalActiveIndex={index} setverticalActiveIndex={setIndex}
 IsFullscreen={true} setIsFullscreen={noop} fullscreenRefsX={refs} fullScreenContainerRef={container} feedContainerRef={feedRef}
 audioPlaying={false} setAudioPlaying={noop} horizontalActiveIndex={horizontal} setHorizontalActiveIndex={setHorizontal}
 generatedAudios={generated} setGeneratedAudios={setGenerated} AudioArray={audio} setAudioArray={setAudio} audioElementRef={audioRef}
 videoArray={videos} setVideoArray={setVideos} storyVidArray={[]} setStoryVidArray={noop} LastId={null} setLastId={noop}
 isMenuOpen={menu} type={1} closePop={noop} searchData="" MyPageId={null} likedArray={liked} setLikedArray={setLiked}
 likeCountArray={counts} setLikeCountArray={setCounts} setLikesPostid={noop} setLikes={noop} setShowEmotions={noop} showEmotions={false}
 setsearchDataNav={noop} setMyPageIdNav={noop} setfeedLastIdNav={noop} setfeedScrollPosNav={noop}/>;
}createRoot(document.getElementById('root')).render(<Provider store={store}><BrowserRouter><App/></BrowserRouter></Provider>);
`;
(async()=>{
 const bundle=await build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',loader:{'.css':'empty','.png':'dataurl','.jpg':'dataurl','.webp':'dataurl'},logLevel:'silent',define:{'import.meta.env':JSON.stringify({VITE_CLIK_URL:'http://fixture.test',PROD:false})},plugins:[{name:'viewer-fixture',setup(b){
  b.onResolve({filter:/^(axios|.*\/(Sandbox|InteractInput|SpatialExperiencePlayer|FollowPanel|EditPost|Plan|DetectDevice))$/},args=>({path:args.path,namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='axios'?`export default {post:async()=>({data:{payload:[],holder:[]}}),put:async()=>({data:{}})};`:/DetectDevice/.test(args.path)?`export const matchMobile=innerWidth<600,matchPc=!matchMobile,matchTablet=false;`:`export default function Stub(){return null;}`,loader:'js'}));
 }}]});
 const html='<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;font-family:system-ui}</style><div id="root"></div><script>'+bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>';
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  for(const width of [1440,1024,390]){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
   let releaseVideo, pendingVideo;
   let videoGate = Promise.resolve();
   let requestedVideo = Promise.resolve();
   page.on('pageerror',e=>errors.push(e.stack || e.message));
   await page.route('**/*',async route=>{
    if(route.request().isNavigationRequest())return route.fulfill({contentType:'text/html',body:html});
    if(new URL(route.request().url()).pathname==='/fixture.mp4'&&fs.existsSync(videoFile)){
     pendingVideo?.(); await videoGate;
     return route.fulfill({contentType:'video/mp4',body:fs.readFileSync(videoFile)});
    }
    return route.abort();
   });
   for(const kind of ['single','story',...(fs.existsSync(videoFile)?['video']:[])]){
    await page.goto('http://fixture.test/feeds?kind='+kind+'&menu');
    await page.locator('[data-fullscreen-actions]').waitFor();
    await page.waitForTimeout(700);
    const media=page.locator(kind==='video'?'video':'[data-fullscreen-stories] img').first();
    if(kind==='video'){await page.waitForFunction(()=>document.querySelector('video')?.videoWidth>0);assert.match(await page.locator('video').first().getAttribute('src'),/fixture\.mp4$/,'Autoplay resolves the post media, never another index-cached video');}else{assert.equal(await page.locator('video').count(),0,'Stale cached video cannot turn an image post into video');}
    const bounds=await contentBounds(media),rail=await page.locator('[data-fullscreen-actions]').boundingBox();
    assert.ok(bounds&&rail);
    if(width>=600){
     assert.ok(Math.abs(rail.x-bounds.x-bounds.width-10)<5,kind+' rail must sit beside media: '+JSON.stringify({bounds,rail,diagnostics:await page.evaluate(()=>({images:[...document.querySelectorAll('[data-fullscreen-stories] img')].map(n=>({rect:n.getBoundingClientRect().toJSON(),style:n.getAttribute('style')})),rail:document.querySelector('[data-fullscreen-actions]').getAttribute('style'),right:getComputedStyle(document.querySelector('[data-fullscreen-actions]')).right,parent:document.querySelector('[data-fullscreen-actions]').offsetParent.getBoundingClientRect().toJSON()}))}));
     await page.evaluate(()=>window.fixture.menu(false));await page.waitForTimeout(400);
     const resized=await contentBounds(media),moved=await page.locator('[data-fullscreen-actions]').boundingBox();
     assert.ok(Math.abs(moved.x-resized.x-resized.width-10)<5,'Rail follows sidebar resize');
     await page.mouse.click(30,450);assert.equal(await page.evaluate(()=>window.fixture.closed),1,kind+' surrounding space closes viewer');
    }else{
     await page.mouse.click(10,450);assert.equal(await page.evaluate(()=>window.fixture.closed),0,'Mobile behaviour stays unchanged');
    }
   }
   if(fs.existsSync(videoFile)){
    videoGate = new Promise(resolve=>releaseVideo=resolve);
    requestedVideo = new Promise(resolve=>pendingVideo=resolve);
    await page.goto('http://fixture.test/feeds?kind=sequence',{waitUntil:'domcontentloaded'});
    await requestedVideo;
    await page.waitForTimeout(100);
    const before = await page.evaluate(()=>{
     const video=document.querySelector('video'), image=document.querySelector('[data-fullscreen-stories] img'), rail=document.querySelector('[data-fullscreen-actions]');
     const plays=[]; const original=HTMLMediaElement.prototype.play;
     HTMLMediaElement.prototype.play=function(){plays.push({source:this.getAttribute('src'),at:performance.now()});return original.call(this);};
     window.fixture.plays=plays;
     window.fixture.retired=video;
     return {poster:video.poster,opacity:getComputedStyle(video).opacity,rail:rail.getBoundingClientRect().x,coverTransition:getComputedStyle(image).transitionDuration};
    });
    assert.match(before.poster,/^data:image/,'Native poster stays visible while media is loading');
    assert.equal(before.opacity,'1','Autoplay is requested before network completion');
    assert.equal(before.coverTransition,'0s','No fade before playback');
    await page.screenshot({path:path.join(root,'.tmp/viewer-cover-browser/loading-'+width+'.png')});
    releaseVideo();
    await page.waitForFunction(()=>{const v=document.querySelector('video');return v&&v.readyState>=2&&!v.paused;});
    const railAfter=(await page.locator('[data-fullscreen-actions]').first().boundingBox()).x;
    assert.ok(Math.abs(railAfter-before.rail)<1,'Controls do not jump between poster and playback');
    await page.screenshot({path:path.join(root,'.tmp/viewer-cover-browser/playing-'+width+'.png')});
    // Visit twenty posts through the actual scroll observer; include stale ended callbacks.
    for(let i=1;i<20;i++){
     await page.evaluate(index=>{
      const root=document.querySelector('[data-fullscreen-stories]');
      root.scrollTo({top:root.clientHeight*index,behavior:'instant'});
     },i);
     try { await page.waitForFunction(id=>{const v=document.querySelector('video');return v?.getAttribute('src')?.endsWith('post='+id)&&!v.paused&&v.readyState>=2;},777+i,{timeout:5000}); }
     catch(error){console.error('Sequence failed at',width,i,errors,await page.evaluate(()=>({videos:[...document.querySelectorAll('video')].map(v=>({src:v.getAttribute('src'),paused:v.paused,ready:v.readyState})),root:document.querySelector('[data-fullscreen-stories]')?.getBoundingClientRect().toJSON(),scroll:document.querySelector('[data-fullscreen-stories]')?.scrollTop,plays:window.fixture.plays})));throw error;}
     await page.evaluate(()=>window.fixture.retired.dispatchEvent(new Event('ended')));
     assert.match(await page.locator('video').getAttribute('src'),new RegExp('post='+(777+i)+'$'),'Scrolling keeps the selected post source');
    }
    assert.ok(await page.evaluate(()=>window.fixture.plays.length<60),'Re-observation does not repeatedly restart autoplay');
    console.log('PASS '+width+'px slow network poster -> first frame without fade/rail jump; 20 sequential posts retain playback identity');
   }
   assert.deepEqual(errors,[]);console.log('PASS '+width+'px single asset, story and video: media-adjacent actions, desktop backdrop and sidebar resize; mobile preserved');await page.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
