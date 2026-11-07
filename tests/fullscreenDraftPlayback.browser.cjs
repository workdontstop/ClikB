const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require('../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const fixture = `
import React,{useState,useRef,useMemo} from 'react';import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';import {BrowserRouter,useLocation,useNavigate} from 'react-router-dom';
import FullScreenStories from './src/FullScreenStories';import {useDeckNavigation} from './src/useDeckNavigation';import {store} from './src/store';
const noop=()=>{},image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960"><rect width="540" height="960" fill="#357"/></svg>');
function App(){
 const location=useLocation(),navigate=useNavigate();const [index,setIndex]=useState(0),[active,setActive]=useState(null),[fullscreen,setFullscreen]=useState(false),[horizontal,setHorizontal]=useState(0),[videos,setVideos]=useState([]),[audio,setAudio]=useState([]),[generated,setGenerated]=useState([]),[liked,setLiked]=useState([]),[counts,setCounts]=useState([]),[revision,refresh]=useState(0);
 const feeds=useMemo(()=>[0,1,2].map(i=>({id:4420-i,sender:1,username:'Guest',caption:'Draft '+(4420-i),profile_image:image,item1:image,x1:image,x2:image,x3:image,xv1:i===0?'/fixture.mp4':'',publicationVideo:100,mode:0,ratio:0})),[revision]);
 const refs=useRef([]),container=useRef(null),audioRef=useRef(null),feedRef=useRef(null);
 const deck=useDeckNavigation({feeds,category:'page',enabled:true,loading:false,minimisePrompt:true,autoOpen:false,
 fullscreenPostId:fullscreen?feeds[index]?.id:null,getScroll:()=>({x:0,y:0}),restoreScroll:noop,prepareDeck:noop,onCreate:noop,
 onFullscreen:id=>{const next=feeds.findIndex(post=>post.id===id);setFullscreen(next>=0);setActive(next>=0?next:null);if(next>=0)setIndex(next);}});
 window.fixture={refresh:()=>refresh(n=>n+1),openStory:postId=>navigate({pathname:location.pathname,search:'?story='+postId},{state:{...location.state,clikbDeck:{...location.state.clikbDeck,activePostId:postId}}}),state:()=>({index,active,horizontal,fullscreen,post:feeds[index]?.id,key:location.key,history:history.state})};
 return <><section>{feeds.map(post=><button key={post.id} onClick={()=>deck.openPost(post.id)}>{post.caption}</button>)}</section>
 {deck.isDeckOpen&&<button onClick={deck.play}>Play</button>}
 {fullscreen&&<FullScreenStories feeds={feeds} activeIndex={active} setActiveIndex={setActive} verticalActiveIndex={index} setverticalActiveIndex={setIndex}
 IsFullscreen={fullscreen} setIsFullscreen={setFullscreen} fullscreenRefsX={refs} fullScreenContainerRef={container} feedContainerRef={feedRef}
 audioPlaying={false} setAudioPlaying={noop} horizontalActiveIndex={horizontal} setHorizontalActiveIndex={setHorizontal}
 generatedAudios={generated} setGeneratedAudios={setGenerated} AudioArray={audio} setAudioArray={setAudio} audioElementRef={audioRef}
 videoArray={videos} setVideoArray={setVideos} storyVidArray={[]} setStoryVidArray={noop} LastId={null} setLastId={noop}
 isMenuOpen={innerWidth>600} type={10} closePop={deck.close} searchData="" MyPageId={1} likedArray={liked} setLikedArray={setLiked}
 likeCountArray={counts} setLikeCountArray={setCounts} setLikesPostid={noop} setLikes={noop} setShowEmotions={noop} showEmotions={false}
 setsearchDataNav={noop} setMyPageIdNav={noop} setfeedLastIdNav={noop} setfeedScrollPosNav={noop}/>}</>;
}createRoot(document.getElementById('root')).render(<Provider store={store}><BrowserRouter><App/></BrowserRouter></Provider>);
`;
(async()=>{
 const bundle=await build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',
 loader:{'.css':'empty','.png':'dataurl','.jpg':'dataurl','.webp':'dataurl','.svg':'dataurl'},logLevel:'silent',define:{'import.meta.env':JSON.stringify({VITE_CLIK_URL:'http://fixture.test',PROD:false,DEV:true})},
 plugins:[{name:'offline-playback',setup(b){
  b.onResolve({filter:/^(axios|.*\/(Sandbox|InteractInput|SpatialExperiencePlayer|FollowPanel|EditPost|Plan|DetectDevice))$/},args=>({path:args.path,namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='axios'?'export default {post:async()=>({data:{payload:[],holder:[]}}),put:async()=>({data:{}})};':/DetectDevice/.test(args.path)?'export const matchMobile=innerWidth<600,matchPc=!matchMobile,matchTablet=false;':'export default function Stub(){return null;}',loader:'js'}));
 }}]});
 const html='<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><div id="root"></div><script>'+bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>';
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:html}):new URL(r.request().url()).pathname==='/fixture.mp4'?r.fulfill({contentType:'video/mp4',body:fs.readFileSync(path.join(root,'.tmp/viewer-cover-browser/portrait.mp4'))}):r.abort());
  await page.goto('http://fixture.test/pages');await page.getByText('Draft 4420',{exact:true}).click();await page.getByText('Play',{exact:true}).click();
  await page.locator('[data-fullscreen-stories]').waitFor();
  for(const index of [1,0,1,0]){
   await page.evaluate(index=>document.querySelector('[data-fullscreen-stories]').scrollTo({top:900*index,behavior:'smooth'}),index);
   await page.waitForFunction(index=>window.fixture.state().index===index,index);
   await page.waitForTimeout(1100);
   const state=await page.evaluate(()=>window.fixture.state());
   assert.equal(state.index,index,'Adjacent drafts stay on the scrolled post: '+JSON.stringify(state));
   assert.equal(state.history.usr.clikbDeck.activePostId,4420-index);
  }
  await page.evaluate(()=>window.fixture.openStory(4419));
  await page.waitForTimeout(1500);
  const restored=await page.evaluate(()=>window.fixture.state());
  assert.equal(restored.index,1,'A route selecting the adjacent draft must settle: '+JSON.stringify(restored));
  assert.equal(restored.history.usr.clikbDeck.activePostId,4419);
  const key=restored.key;
  await page.waitForTimeout(1100);
  assert.equal((await page.evaluate(()=>window.fixture.state())).key,key,'Settled fullscreen must not keep replacing browser history');
  await page.goBack();await page.waitForFunction(()=>window.fixture.state().index===0&&history.state.usr.clikbDeck.activePostId===4420);
  await page.goForward();await page.waitForFunction(()=>window.fixture.state().index===1&&history.state.usr.clikbDeck.activePostId===4419);
  assert.deepEqual(errors,[]);console.log('PASS '+width+'px adjacent partial-video/legacy drafts: scrolling settles without post/history oscillation');await page.close();
 }}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
