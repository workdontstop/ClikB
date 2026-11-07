const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { build } = require('esbuild');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const fixture = `
import React,{useState,useRef,useMemo} from 'react';import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';import {BrowserRouter} from 'react-router-dom';
import FullScreenStories from './src/FullScreenStories';import {store} from './src/store';
const noop=()=>{};window.fixture={renders:[]};
function App(){
 const [index,setIndex]=useState(0),[horizontal,setHorizontal]=useState(0),[videos,setVideos]=useState([]),[audio,setAudio]=useState([]),[generated,setGenerated]=useState([]),[liked,setLiked]=useState([]),[counts,setCounts]=useState([]);
 const refs=useRef([]),container=useRef(null),audioRef=useRef(null),feedRef=useRef(null);
 const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960"><rect width="540" height="960" fill="blue"/></svg>');
 const feeds=useMemo(()=>Array.from({length:8},(_,i)=>({id:777+i,sender:2,username:'fixture',caption:'Game '+(777+i),profile_image:image,item1:image,x1:image,mode:2,inttype:i%2,main:'/main-'+(777+i)+'.mp4',subl:'/left-'+(777+i)+'.mp4',subr:'/right-'+(777+i)+'.mp4',mainaud:'/audio-'+(777+i)+'.mp3',touchlx:.2+i*.01,touchly:.5,touchlr:.1,touchrx:.8,touchry:.5,touchrr:.1,ratio:0})),[]);
 window.fixture.choose=setIndex;
 return <FullScreenStories feeds={feeds} activeIndex={index} setActiveIndex={setIndex} verticalActiveIndex={index} setverticalActiveIndex={setIndex}
 IsFullscreen={true} setIsFullscreen={noop} fullscreenRefsX={refs} fullScreenContainerRef={container} feedContainerRef={feedRef}
 audioPlaying={false} setAudioPlaying={noop} horizontalActiveIndex={horizontal} setHorizontalActiveIndex={setHorizontal}
 generatedAudios={generated} setGeneratedAudios={setGenerated} AudioArray={audio} setAudioArray={setAudio} audioElementRef={audioRef}
 videoArray={videos} setVideoArray={setVideos} storyVidArray={[]} setStoryVidArray={noop} LastId={null} setLastId={noop}
 isMenuOpen={false} type={1} closePop={noop} searchData="" MyPageId={null} likedArray={liked} setLikedArray={setLiked}
 likeCountArray={counts} setLikeCountArray={setCounts} setLikesPostid={noop} setLikes={noop} setShowEmotions={noop} showEmotions={false}
 setsearchDataNav={noop} setMyPageIdNav={noop} setfeedLastIdNav={noop} setfeedScrollPosNav={noop}/>;
}createRoot(document.getElementById('root')).render(<Provider store={store}><BrowserRouter><App/></BrowserRouter></Provider>);
`;
(async () => {
  const baseline = process.argv.includes('--baseline');
  const bundle = await build({ stdin: { contents: fixture, resolveDir: root, loader: 'tsx' }, bundle: true, write: false,
    format: 'iife', platform: 'browser', jsx: 'automatic', loader: { '.css': 'empty', '.png': 'dataurl', '.jpg': 'dataurl' }, logLevel: 'silent',
    define: { 'import.meta.env': JSON.stringify({ VITE_CLIK_URL: 'http://fixture.test', PROD: false }) },
    plugins: [{ name: 'fullscreen-game', setup(b) {
      if (baseline) b.onLoad({ filter: /[\\/]FullScreenStories\.tsx$/ }, () => ({ contents: fs.readFileSync(path.join(root, '.tmp/game-transition-baseline/src/FullScreenStories.tsx'), 'utf8'), loader: 'tsx', resolveDir: path.join(root, 'src') }));
      b.onResolve({ filter: /^(axios|.*\/(Sandbox|InteractInput|SpatialExperiencePlayer|FollowPanel|EditPost|Plan|DetectDevice))$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'axios'
        ? `export default {post:async()=>({data:{payload:[],holder:[]}}),put:async()=>({data:{}})};`
        : /DetectDevice/.test(args.path) ? `export const matchMobile=innerWidth<600,matchPc=!matchMobile,matchTablet=false;`
        : /InteractInput$/.test(args.path) ? `import React from 'react';export default function Game(p){const entry={id:p.feedData.id,main:p.vid1,left:p.vid2,audio:p.mainAudioUrl,mode:p.mode,hotspot:p.touchHotspots[0].x};window.fixture.renders.push(entry);return React.createElement('div',{'data-game-id':p.feedData.id,'data-game-main':p.vid1,style:{width:300,height:500}},p.vid1);}`
        : `export default ()=>null;`, loader: 'js', resolveDir: root }));
    } }] });
  const html = '<meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0}</style><div id="root"></div><script>' + bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>';
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } }), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => route.request().isNavigationRequest() ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort());
      await page.goto('http://fixture.test/feeds');
      try { await page.locator('[data-game-id]').waitFor(); }
      catch (error) { console.error(JSON.stringify({ errors, text: (await page.locator('body').innerText()).slice(0, 1200), games: await page.evaluate(() => window.fixture?.renders) })); throw error; }
      // Real fullscreen scroll observer, forward and backward; every render is
      // recorded so even a one-render mismatch cannot hide behind settling.
      for (const index of [1, 2, 3, 5, 7, 6, 4, 2, 0]) {
        await page.evaluate(index => { const container = document.querySelector('[data-fullscreen-stories]'); container.scrollTo({ top: container.clientHeight * index, behavior: 'instant' }); }, index);
        await page.waitForFunction(id => document.querySelector('[data-game-id]')?.getAttribute('data-game-id') === String(id), 777 + index);
      }
      const rendered = await page.evaluate(() => window.fixture.renders);
      const wrong = rendered.filter(entry => entry.main !== '/main-' + entry.id + '.mp4' || entry.left !== '/left-' + entry.id + '.mp4'
        || entry.audio !== '/audio-' + entry.id + '.mp3' || entry.mode !== ((entry.id - 777) % 2 ? 'touch' : 'swipe'));
      if (baseline) assert.ok(wrong.length, 'baseline unexpectedly failed to reproduce the previous-post mismatch');
      else assert.deepEqual(wrong, [], 'a fullscreen game rendered with another post media/mode/audio');
      assert.deepEqual(errors, []);
      console.log('PASS ' + width + 'px: ' + (baseline ? 'reproduced ' + wrong.length + ' stale game renders' : rendered.length + ' renders retain post media, mode and audio during forward/backward scrolling'));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
