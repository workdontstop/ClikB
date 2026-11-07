const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const ts = require('typescript');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || path.resolve(__dirname,'../.tmp/concierge-browser-deps/node_modules/playwright'));
const root = path.resolve(__dirname,'..'), output = path.join(root,'.tmp/viewer-autoplay-capture');
fs.mkdirSync(output,{recursive:true});
const clip = path.join(output,'audio-portrait.mp4');
if(!fs.existsSync(clip)) {
  const result=spawnSync(path.join(root,'.video-review-deps/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe'),[
    '-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=0x185c83:s=180x320:r=10','-f','lavfi','-i','sine=frequency=440:sample_rate=22050',
    '-t','30','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-b:a','32k','-af','volume=0.01','-movflags','+faststart',clip],{windowsHide:true});
  if(result.status!==0)throw Error(result.stderr.toString());
}
const source=ts.createSourceFile('FullScreenStories.tsx',fs.readFileSync(path.join(root,'src/FullScreenStories.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const captions=[],callbacks=[],declarations=[];let playbackEffect;
function visit(node) {
  if(ts.isJsxElement(node)&&node.openingElement.tagName.getText(source)==='Typography'&&node.openingElement.attributes.properties.some(prop=>prop.name?.getText(source)==='data-feeds-caption-scroll'))captions.push(node.getText(source));
  if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(source)==='VideoPlayer'){const prop=node.attributes.properties.find(prop=>prop.name?.getText(source)==='onPlaybackChange');if(prop)callbacks.push(prop.initializer.expression.getText(source));}
  if(ts.isVariableDeclaration(node)&&['normalVideoSource','hidePlayingCaption','captionExpanded'].includes(node.name.getText(source)))declarations.push('const '+node.getText(source)+';');
  if(ts.isCallExpression(node)&&node.expression.getText(source)==='useEffect'&&node.arguments[0]?.getText(source).includes('const reportPlaybackState'))playbackEffect=node.getText(source)+';';
  ts.forEachChild(node,visit);
}visit(source);assert.equal(captions.length,2);assert.ok(playbackEffect);
const fixture=ts.transpileModule(`
import React,{useState,useRef,useEffect,useMemo,useCallback} from 'react';
import {createRoot} from 'react-dom/client';import {Provider} from 'react-redux';
import {Typography,IconButton,ThemeProvider,createTheme} from '@mui/material';import CloseIcon from '@mui/icons-material/Close';
import {store} from '/src/store.ts';import {setPlaybackMuted} from '/src/settingsSlice.ts';
import VideoPlayer from '/src/VideoPlayer.tsx';import {videoPlaybackKey,shouldHideVideoCaption} from '/src/videoPlaybackLayout.ts';
import {captureVideoFrameBlob} from '/src/videoFrameCapture.ts';import {imageBlobToPng} from '/src/imageBlobConversion.ts';
const query=new URLSearchParams(location.search),blocked=query.get('blocked')==='1',refStart=query.get('ref')==='1';
store.dispatch(setPlaybackMuted(!blocked));
window.fixture={failures:[],profiles:[],playEvents:0};
async function readFrame(url,options={}) {
const original=document.createElement.bind(document),owned=[];
document.createElement=(name,...args)=>{const element=original(name,...args);if(name==='video')owned.push(element);return element;};
const controller=new AbortController();let abortTimer;if(options.abortAfterMs)abortTimer=setTimeout(()=>controller.abort(),options.abortAfterMs);
try {const blob=await captureVideoFrameBlob(url,{...options,signal:controller.signal});const bitmap=await createImageBitmap(blob);
const result={ok:true,bytes:blob.size,type:blob.type,width:bitmap.width,height:bitmap.height};bitmap.close();return result;}
catch(error){return {ok:false,name:error.name,error:error.message};}
finally {clearTimeout(abortTimer);document.createElement=original;window.fixture.lastCapture=owned.map(v=>({src:v.getAttribute('src'),paused:v.paused,metadata:v.onloadedmetadata,seeked:v.onseeked,error:v.onerror,data:v.onloadeddata}));}
}
async function png(fail=false){const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL),owned=[],released=[];
URL.createObjectURL=blob=>{const url=create(blob);owned.push(url);return url;};URL.revokeObjectURL=url=>{released.push(url);return revoke(url);};
try{const blob=await imageBlobToPng(new Blob([fail?'invalid image':'<svg xmlns="http://www.w3.org/2000/svg" width="48" height="64"><rect width="48" height="64" fill="red"/></svg>'],{type:fail?'image/png':'image/svg+xml'}));return{ok:true,bytes:blob.size,type:blob.type};}
catch(error){return{ok:false,error:error.message};}finally{URL.createObjectURL=create;URL.revokeObjectURL=revoke;window.fixture.pngUrls={owned,released};}}
window.fixture.capture=readFrame;window.fixture.png=png;
function App(){
const [mounted,setMounted]=useState(true),[postId,setPostId]=useState(21),[source,setSource]=useState('/media/audio-portrait.mp4'),[branch,setBranch]=useState(Number(query.get('branch'))||0);
const [playvid,setplayvid]=useState(false),[hideVidCap,setHideVidCap]=useState([false]),[normalVideoPlaying,setNormalVideoPlaying]=useState({}),[ActiveCap,setActiveCap]=useState(false);
const feeds=useMemo(()=>[{id:postId,mode:0,ratio:1,xv1:source,username:'author',sender:7,caption:'Saved post caption'}],[postId,source]);
const videoArray=useMemo(()=>branch===0?[source]:[''],[branch,source]);const item=feeds[0],index=0,verticalActiveIndex=0,type=1,matchMobile=false,darkModeReducer=true,fullscreenAreaId='fixture';
const videoRefs=useRef([]),startedNodes=useRef(new WeakSet());const reportVideoPlayback=useCallback((id,source,playing)=>{const key=videoPlaybackKey(id,source);setNormalVideoPlaying(previous=>previous[key]===playing?previous:{...previous,[key]:playing});},[]);
${declarations.join('\n')}
const callback=branch===0?${callbacks[0]}:${callbacks[1]};
const setHideT=()=>{},GotoProfile=(...args)=>window.fixture.profiles.push(args);
${playbackEffect}
const assign=useCallback(video=>{videoRefs.current[0]=video;if(video&&refStart&&!startedNodes.current.has(video)){startedNodes.current.add(video);video.play().catch(error=>window.fixture.failures.push(error.name));setplayvid(true);}},[source,mounted,refStart]);
useEffect(()=>{if(!mounted)return;setplayvid(false);const timer=setTimeout(()=>{const v=videoRefs.current[0];if(v){v.play().catch(error=>window.fixture.failures.push(error.name));setplayvid(true);}},200);return()=>clearTimeout(timer);},[mounted,source]);
window.fixture.state=()=>({mounted,source,postId,branch,playvid,playing:normalVideoPlaying[videoPlaybackKey(postId,source)]||false,seeker:hideVidCap[0],hidePlayingCaption,failures:window.fixture.failures,playEvents:window.fixture.playEvents});
window.fixture.open=({source,branch,postId})=>{if(source)setSource(source);if(branch!==undefined)setBranch(branch);if(postId)setPostId(postId);setMounted(true);};
window.fixture.close=()=>setMounted(false);
window.fixture.bounce=()=>{setplayvid(false);setTimeout(()=>{videoRefs.current[0]?.play().catch(error=>window.fixture.failures.push(error.name));setplayvid(true);},200);};
return <div id="stage" style={{position:'relative',width:800,height:700,background:'#121212',margin:'20px auto'}}>{mounted&&<VideoPlayer item={item} index={0} src={source} isActive={true} playvid={playvid}
isUIHidden={hideVidCap[0]} setUIHidden={value=>setHideVidCap([value])} onPlaybackChange={callback} onRefAssign={assign}
matchMobile={false} isNineTwelve={true} isMenuOpen={false} muted={!blocked} singleMode={branch===1} darkMode={true}/>}<div id="caption" style={{position:'absolute',bottom:90,left:20,right:20,color:'white',zIndex:20,display:hideVidCap[0]?'none':'block'}}>{branch===0?${captions[0]}:${captions[1]}}</div></div>;
}createRoot(document.getElementById('root')).render(<Provider store={store}><ThemeProvider theme={createTheme({palette:{mode:'dark'}})}><App/></ThemeProvider></Provider>);
`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
(async()=>{
const {createServer}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')));
const origin='http://127.0.0.1:5294',remoteOrigin='http://127.0.0.1:5295';let stalled=0;
const remote=http.createServer((req,res)=>{if(req.url.includes('allow'))res.setHeader('Access-Control-Allow-Origin',origin);if(req.url.includes('stall')){stalled++;res.setHeader('Content-Type','video/mp4');res.flushHeaders();res.on('close',()=>stalled--);return;}if(req.url.includes('missing')){res.statusCode=404;res.end();return;}require('./localVideoFixture.cjs').serveLocalVideo(req,res,clip);});
await new Promise(resolve=>remote.listen(5295,'127.0.0.1',resolve));
const server=await createServer({root,configFile:false,logLevel:'error',cacheDir:path.join(output,'vite'),esbuild:{jsx:'automatic'},optimizeDeps:{include:['react','react/jsx-runtime','react-dom/client','react-redux','@reduxjs/toolkit','@mui/material','@emotion/react','@emotion/styled','react-device-detect']},server:{host:'127.0.0.1',port:5294,strictPort:true,hmr:false},plugins:[{name:'autoplay-capture',resolveId:id=>id==='/fixture.js'?'\0autoplay-capture':undefined,load:id=>id==='\0autoplay-capture'?fixture:undefined,configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url.startsWith('/__test')){res.setHeader('Content-Type','text/html');res.end('<style>body{margin:0;background:#050505}</style><div id="root"></div><script type="module" src="/fixture.js"></script>');return;}if(req.url.startsWith('/media/'))return require('./localVideoFixture.cjs').serveLocalVideo(req,res,clip);next();});}}]});
await server.listen();let browser;const errors=[],blockedRequests=[],results=[];
try{
browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--autoplay-policy=document-user-activation-required','--disable-features=PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies']});
const context=await browser.newContext({viewport:{width:1200,height:850}}),page=await context.newPage();page.setDefaultTimeout(30000);
async function secure(p){p.on('pageerror',error=>errors.push(error.message));await p.route('**/*',route=>{const url=route.request().url();if(url.startsWith(origin+'/')||url.startsWith(remoteOrigin+'/')||url.startsWith('blob:')||url.startsWith('data:'))return route.continue();blockedRequests.push(url);return route.abort();});}
await secure(page);
for(const branch of [0,1])for(const cached of [false,true]){
await page.goto(origin+'/__test?branch='+branch+'&ref='+(cached?1:0));
for(let round=0;round<3;round++){
if(round){await page.evaluate(()=>window.fixture.close());await page.locator('video').waitFor({state:'detached'});await page.evaluate(({branch,source,postId})=>window.fixture.open({branch,source,postId}),{branch,source:cached?'/media/audio-portrait.mp4':'/media/audio-portrait.mp4?round='+round,postId:21+round});}
try{await page.waitForFunction(()=>window.fixture.state().playing&&document.querySelector('video')?.readyState>=2&&!document.querySelector('video').paused);}catch(error){console.error('Entry state:',{branch,cached,round},await page.evaluate(()=>({state:window.fixture.state(),video:[...document.querySelectorAll('video')].map(v=>({src:v.src,paused:v.paused,ended:v.ended,ready:v.readyState,muted:v.muted,time:v.currentTime}))})));throw error;}
assert.equal(await page.getByText('Saved post caption',{exact:false}).isVisible(),false);assert.equal(await page.getByText('@author',{exact:true}).isVisible(),true);
await page.evaluate(()=>{const v=document.querySelector('video');v.addEventListener('play',()=>window.fixture.playEvents++);window.fixture.bounce();});
await page.waitForTimeout(80);assert.equal(await page.evaluate(()=>window.fixture.state().playvid),false);assert.equal(await page.getByText('Saved post caption',{exact:false}).isVisible(),false,'An already-playing node must keep caption hidden while viewer flag is false');
await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>window.fixture.state().playing),true);assert.equal(await page.evaluate(()=>window.fixture.playEvents),0,'Repeated play must not need a fresh play event');
}
await page.evaluate(({source,branch})=>{window.fixture.switchNode=document.querySelector('video');window.fixture.open({source,branch,postId:99});},{source:cached?'/media/audio-portrait.mp4':'/media/audio-portrait.mp4?same-node-switch=1',branch});
await page.waitForFunction(()=>window.fixture.state().playing&&document.querySelector('video')?.readyState>=2&&!document.querySelector('video').paused);
assert.equal(await page.evaluate(()=>document.querySelector('video')===window.fixture.switchNode),true,'Feed source switch must exercise the same DOM player');
assert.equal(await page.getByText('Saved post caption',{exact:false}).isVisible(),false);assert.equal(await page.getByText('@author',{exact:true}).isVisible(),true);
await page.screenshot({path:path.join(output,'branch-'+branch+'-'+(cached?'cached':'uncached')+'-entry-playing.png')});
const video=page.locator('video');await video.evaluate(v=>v.pause());await page.waitForFunction(()=>!window.fixture.state().playing);assert.equal(await page.getByText('Saved post caption',{exact:false}).isVisible(),true);
await video.dblclick();await page.getByRole('slider',{name:'Seek video'}).waitFor();await video.evaluate(v=>v.pause());await page.getByRole('slider',{name:'Seek video'}).fill('4');assert.equal(await page.getByText('Saved post caption',{exact:false}).isVisible(),false);
await page.screenshot({path:path.join(output,'branch-'+branch+'-'+(cached?'cached':'uncached')+'-seeker.png')});
await video.dblclick();await video.evaluate(v=>v.pause());await page.waitForFunction(()=>!window.fixture.state().seeker&&!window.fixture.state().playing);assert.equal(await page.getByText('Saved post caption',{exact:false}).isVisible(),true);
results.push({branch,cached,opens:3,sameNodeSwitch:true,repeatedPlayNoEvent:true});console.log('PASS branch '+branch+' '+(cached?'cached/ref-entry':'uncached/delayed-entry')+': three opens + same-node switch, repeated play with no event, normal pause and seeker precedence.');
}
for(const branch of [0,1]){const blockedContext=await browser.newContext({viewport:{width:1200,height:850}}),p=await blockedContext.newPage();await secure(p);await p.goto(origin+'/__test?blocked=1&branch='+branch);
// Playwright evaluations grant synthetic user activation. Let the native timer attempt playback first.
await p.waitForTimeout(600);const blockedState=await p.evaluate(()=>window.fixture.state());assert.ok(blockedState.failures.includes('NotAllowedError'),JSON.stringify(blockedState));assert.equal(await p.locator('video').evaluate(v=>v.paused),true);assert.equal(blockedState.seeker,false);assert.equal(await p.getByText('Saved post caption',{exact:false}).isVisible(),true);assert.equal(await p.getByText('@author',{exact:true}).isVisible(),true);await p.screenshot({path:path.join(output,'branch-'+branch+'-blocked-autoplay.png')});await blockedContext.close();console.log('PASS branch '+branch+' native blocked audible autoplay retains paused caption and username.');}
await page.locator('video').evaluate(v=>v.play());
for(const options of [{timeSeconds:0},{timeSeconds:4.2},{endOffsetSeconds:.04,mimeType:'image/webp'}]){
const result=await page.evaluate(async({url,options})=>window.fixture.capture(url,options),{url:remoteOrigin+'/frame.mp4?allow=1',options});assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.width,180);assert.equal(result.height,320);assert.ok(result.bytes>100);const disposed=await page.evaluate(()=>window.fixture.lastCapture);assert.equal(disposed.length,1);assert.deepEqual(disposed[0],{src:null,paused:true,metadata:null,seeked:null,error:null,data:null});assert.equal(await page.locator('video').evaluate(v=>v.paused),false,'Detached cleanup must preserve the active player');console.log('PASS real CORS-permitted URL frame '+JSON.stringify(options)+' exports and releases detached decoder.');}
for(const [url,options,expected] of [[remoteOrigin+'/frame.mp4?blocked=1',{timeSeconds:2},'load'],[remoteOrigin+'/missing.mp4?allow=1',{timeSeconds:2},'load'],[remoteOrigin+'/stall.mp4?allow=1',{timeSeconds:2,timeoutMs:120},'Timed out'],[remoteOrigin+'/stall.mp4?allow=1',{timeSeconds:2,abortAfterMs:20},'cancelled']]){const result=await page.evaluate(async({url,options})=>window.fixture.capture(url,options),{url,options});assert.equal(result.ok,false);assert.match(result.error,new RegExp(expected));assert.equal((await page.evaluate(()=>window.fixture.lastCapture[0])).src,null);assert.equal(await page.locator('video').evaluate(v=>v.paused),false,'Detached failure cleanup must preserve the active player');console.log('PASS real frame '+expected+' outcome releases detached source.');}
for(const fail of [false,true]){const result=await page.evaluate(fail=>window.fixture.png(fail),fail);assert.equal(result.ok,!fail);const urls=await page.evaluate(()=>window.fixture.pngUrls);assert.equal(urls.owned.length,1);assert.deepEqual(urls.owned,urls.released);console.log('PASS real PNG '+(fail?'invalid-image rejection':'encoding')+' revokes its private URL.');}
await page.waitForTimeout(150);assert.equal(stalled,0,'Aborted/time-out video loading must close stalled requests');assert.deepEqual(errors,[]);assert.deepEqual(blockedRequests,[]);
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({autoplay:results,blockedBranches:2,frameCases:7,pngCases:2,stalledRequests:stalled,pageErrors:errors,externalRequests:blockedRequests},null,2));
console.log('PASS autoplay/capture browser suite; 12 repeated entries, 2 blocked branches, 7 real frame outcomes, 2 real PNG outcomes; no page errors/external requests.');
}finally{await browser?.close();await server.close();await new Promise(resolve=>remote.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
