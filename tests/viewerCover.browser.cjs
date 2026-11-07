const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const ts = require('typescript');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || path.resolve(__dirname, '../.tmp/concierge-browser-deps/node_modules/playwright'));
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.tmp/viewer-cover-browser');
fs.mkdirSync(output, { recursive: true });
const ffmpeg = path.join(root, '.video-review-deps/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
for (const [name, size] of [['portrait', '180x320'], ['square', '240x240'], ['landscape', '320x180']]) {
  const file = path.join(output, `${name}.mp4`);
  if (!fs.existsSync(file)) {
    const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=0x185c83:s=${size}:r=10`,
      '-t', '30', '-an', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { windowsHide: true });
    if (result.status !== 0) throw Error(result.stderr.toString());
  }
}
const source = ts.createSourceFile('FullScreenStories.tsx', fs.readFileSync(path.join(root, 'src/FullScreenStories.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const captions = [], playback = [], declarations = [];
function visit(node) {
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'Typography' &&
    node.openingElement.attributes.properties.some(prop => prop.name?.getText(source) === 'data-feeds-caption-scroll')) captions.push(node.getText(source));
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'VideoPlayer') {
    const prop = node.attributes.properties.find(prop => prop.name?.getText(source) === 'onPlaybackChange');
    if (prop) playback.push(prop.initializer.expression.getText(source));
  }
  if (ts.isVariableDeclaration(node) && ['normalVideoSource', 'hidePlayingCaption', 'captionExpanded'].includes(node.name.getText(source))) declarations.push(`const ${node.getText(source)};`);
  ts.forEachChild(node, visit);
} visit(source);
assert.equal(captions.length, 2); assert.equal(playback.length, 2); assert.equal(declarations.length, 3);
const fixture = ts.transpileModule(`
import React,{useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {ThemeProvider,createTheme,Typography,IconButton} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {store} from '/src/store.ts';
import {setThemePreference,setAppColorDark,setPlaybackMuted,setPlaybackVolume} from '/src/settingsSlice.ts';
import {shouldHideVideoCaption,videoPlaybackKey} from '/src/videoPlaybackLayout.ts';
import Thumbnail from '/src/Thumbnail.tsx';
import VideoPlayer from '/src/VideoPlayer.tsx';
store.dispatch(setThemePreference('dark'));store.dispatch(setAppColorDark('#ff66aa'));store.dispatch(setPlaybackMuted(true));
const query=new URLSearchParams(location.search),matchMobile=query.get('mobile')==='1';
const theme=createTheme({palette:{mode:'dark'}});
const scenes=Array.from({length:12},(_,index)=>({id:'scene-'+index,image:'/scene-'+index+'.svg'}));
window.fixture={profile:[],closed:0};
function App(){
const [mode,setMode]=useState(query.get('mode')||'viewer');
const [aspect,setAspect]=useState('portrait'),[branch,setBranch]=useState(0),[panelWidth,setPanelWidth]=useState(matchMobile?390:1100);
const [hideVidCap,setHideVidCap]=useState([false]);
const [normalVideoPlaying,setNormalVideoPlaying]=useState({}),[ActiveCap,setActiveCap]=useState(false);
const index=0,verticalActiveIndex=0,type=1,fullscreenAreaId='fixture',darkModeReducer=true;
const item={id:21,mode:0,ratio:aspect==='portrait'?1:aspect==='square'?2:3,xv1:'/media/'+aspect+'.mp4'};
const feeds=[{username:'author',sender:7,caption:'Saved post caption'}],videoArray=[item.xv1];
const reportVideoPlayback=(postId,source,playing)=>{const key=videoPlaybackKey(postId,source);setNormalVideoPlaying(previous=>previous[key]===playing?previous:{...previous,[key]:playing});};
${declarations.join('\n')}
const onPlaybackChange=branch===0?${playback[0]}:${playback[1]};
const setHideT=()=>{},GotoProfile=(...args)=>window.fixture.profile.push(args);
window.fixture.state=()=>({mode,aspect,branch,seeker:hideVidCap[0],playing:normalVideoPlaying[videoPlaybackKey(item.id,item.xv1)]||false,
 hidePlayingCaption,captionExpanded,muted:store.getState().settings.fullscreenMute,volume:store.getState().settings.playbackVolume});
window.fixture.choose=({aspect,branch,width,mode})=>{if(aspect)setAspect(aspect);if(branch!==undefined)setBranch(branch);if(width)setPanelWidth(width);if(mode)setMode(mode);};
const stageHeight=matchMobile?innerHeight:700;
return mode==='cover'?<Thumbnail image={scenes[0].image} sceneImages={scenes} PostId="local-fixture" title="Original cover" prompt="Original caption"
 steps={['a','b']} type={1} DummyMode={false} setGeneratedImage={()=>{}} closeT={()=>window.fixture.closed++} />:
<><div id="player-stage" style={{position:'relative',width:Math.min(panelWidth,innerWidth),height:stageHeight,margin:'0 auto',background:'#141414',border:'1px solid #333',boxSizing:'border-box'}}>
<VideoPlayer index={0} src={item.xv1} item={item} isActive={true} playvid={true} isUIHidden={hideVidCap[0]}
 setUIHidden={value=>setHideVidCap([value])} onPlaybackChange={onPlaybackChange} onRefAssign={()=>{}} matchMobile={matchMobile}
 isNineTwelve={true} isMenuOpen={false} singleMode={branch===1} muted={store.getState().settings.fullscreenMute}
 darkMode={true} loop={true} mobileViewportHeight={stageHeight+'px'}/>
<div id="caption-panel" style={{position:'absolute',bottom:85,left:20,right:20,zIndex:20,display:hideVidCap[0]?'none':'block',color:'white'}}>
{branch===0?${captions[0]}:${captions[1]}}
</div></div>
<div id="audio-peer" style={{position:'absolute',left:-1000,top:0,width:100,height:100,visibility:'hidden'}}>
<VideoPlayer index={1} src="/media/square.mp4" item={{id:22,ratio:2}} isActive={true} playvid={true} isUIHidden={false} setUIHidden={()=>{}}
 onRefAssign={()=>{}} matchMobile={false} isNineTwelve={false} isMenuOpen={false} singleMode={false} muted={true} darkMode={true}/>
</div></>;
}
createRoot(document.getElementById('root')).render(<Provider store={store}><ThemeProvider theme={theme}><App/></ThemeProvider></Provider>);
`, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;

(async () => {
  const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')));
  const uploads = [], calls = [], blocked = [], screenshots = [], errors = [];
  let origin;
  const server = await createServer({ root, configFile: false, logLevel: 'error', cacheDir: path.join(output, 'vite'),
    esbuild: { jsx: 'automatic' }, optimizeDeps: { include: ['react','react/jsx-runtime','react-dom/client','react-redux','@reduxjs/toolkit','@mui/material','@emotion/react','@emotion/styled','framer-motion','axios','react-device-detect'] },
    server: { host: '127.0.0.1', port: 5292, strictPort: true, hmr: false }, plugins: [{ name: 'isolated-viewer-cover', enforce: 'pre',
      resolveId: id => id === '/fixture.js' ? '\0viewer-cover' : undefined,
      load: id => id === '\0viewer-cover' ? fixture : undefined,
      transform(code, id) { if (id.endsWith('/Thumbnail.tsx')) return code.replace('import.meta.env.VITE_CLIK_URL', "'/api'"); },
      configureServer(s) { s.middlewares.use((req, res, next) => {
        if (req.url.startsWith('/__test')) { res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#080808;font-family:Arial}button{cursor:pointer}</style><div id="root"></div><script type="module" src="/fixture.js"></script>');return; }
        const media = /^\/media\/(portrait|square|landscape)\.mp4/.exec(req.url);
        if (media) return require('./localVideoFixture.cjs').serveLocalVideo(req,res,path.join(output,media[1]+'.mp4'));
        const scene = /^\/scene-(\d+)\.svg/.exec(req.url);
        if (scene) { const color=Number(scene[1])===0?'#0044ee':Number(scene[1])===1?'#ee3300':'#448833';res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="'+color+'"/><rect x="730" width="100" height="900" fill="white"/><text x="80" y="200" fill="white" font-size="100">Scene '+scene[1]+'</text></svg>');return; }
        if (req.url.startsWith('/api/') || req.url.startsWith('/__upload/')) {
          if (req.method==='GET' && req.url.startsWith('/__upload/')) { res.setHeader('Content-Type','image/webp');res.end(uploads.at(-1));return; }
          const chunks=[];req.on('data',chunk=>chunks.push(chunk));req.on('end',()=>{
            const body=Buffer.concat(chunks);calls.push({method:req.method,url:req.url,body:req.url.startsWith('/__upload/')?undefined:JSON.parse(body.toString()||'{}')});
            if(req.url.startsWith('/__upload/'))uploads.push(body);
            res.setHeader('Content-Type','application/json');
            res.end(JSON.stringify(req.url.endsWith('/GptTagger')?{title:'Fixture cover',tags:['local'],categories:['test']}:
              req.url.endsWith('/get_signed_url_image')?{holder:[{urlBase:origin+'/__upload/base',urlHD:origin+'/__upload/cover.webp?fixture=1'}]}:{ok:true}));
          });return;
        }
        next();
      }); },
    }] });
  await server.listen(); origin='http://127.0.0.1:5292';
  let browser;
  try {
    browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    for(const mobile of [false,true]) {
      const context=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'}:{viewport:{width:1440,height:1000}});
      const page=await context.newPage(); page.setDefaultTimeout(30000);
      page.on('pageerror',error=>{errors.push(error.message);console.error('Browser error:',error.message);});
      await page.route('**/*',route=>{const url=route.request().url();if(url.startsWith(origin+'/')||url.startsWith('blob:')||url.startsWith('data:'))return route.continue();blocked.push(url);return route.abort();});
      const shot=async name=>{const file=path.join(output,(mobile?'mobile-':'desktop-')+name+'.png');await page.screenshot({path:file});screenshots.push(file);};
      await page.goto(origin+'/__test?mode=cover&mobile='+(mobile?1:0));
      const control=key=>page.locator('[data-creation-control="clikb.creation.post_finish.control.'+key+'"]');
      await control('save_post').waitFor();await page.waitForFunction(()=>document.querySelector('[data-creation-control$=".save_post"]')?.disabled===false);
      const canvas=page.locator('canvas');
      const initial=await canvas.evaluate(c=>c.toDataURL('image/webp'));
      await control('caption').locator('textarea:not([aria-hidden=true])').fill('Authored caption '+(mobile?'mobile':'desktop'));
      await control('cover_text').locator('input').fill('Authored cover');
      const canvasRect=await canvas.boundingBox(),toggleRect=await control('toggle_scene_list').boundingBox();
      assert.ok(toggleRect.y>=canvasRect.y && toggleRect.y<canvasRect.y+80,'Scene selector belongs at top of preview');
      assert.equal(await control('toggle_scene_list').evaluate(e=>getComputedStyle(e).color),'rgb(255, 102, 170)');
      assert.equal(await control('cover_scene_scene-0').getAttribute('aria-pressed'),'true');
      const strip=control('cover_scene_scroll');
      const stripRect=await strip.boundingBox();
      assert.ok(stripRect.x+stripRect.width<=page.viewportSize().width+1,'Scene strip must stay within viewport: '+JSON.stringify(stripRect));
      assert.equal(await strip.evaluate(e=>e.scrollWidth>e.clientWidth),true);
      await strip.evaluate(e=>e.scrollLeft=e.scrollWidth);assert.ok(await strip.evaluate(e=>e.scrollLeft)>0);
      await strip.evaluate(e=>e.scrollLeft=0);
      await control('toggle_crop').click();
      const point={x:canvasRect.x+canvasRect.width/2,y:canvasRect.y+canvasRect.height/2};
      await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+60,point.y);await page.mouse.up();
      const cropped=await canvas.evaluate(c=>c.toDataURL('image/webp'));assert.notEqual(cropped,initial);
      await control('cover_scene_scene-1').click();await page.waitForFunction(()=>document.querySelector('[data-creation-control$=".save_post"]')?.disabled===false);
      const selected=await canvas.evaluate(c=>c.toDataURL('image/webp'));assert.notEqual(selected,cropped);
      await shot('cover-scenes');
      await control('toggle_scene_list').click();assert.equal(await control('cover_scene_scene-1').count(),0);
      assert.equal(await canvas.evaluate(c=>c.toDataURL('image/webp')),selected);
      assert.equal(await control('caption').locator('textarea:not([aria-hidden=true])').inputValue(),'Authored caption '+(mobile?'mobile':'desktop'));
      assert.equal(await control('cover_text').locator('input').inputValue(),'Authored cover');await shot('cover-collapsed');
      await control('toggle_scene_list').click();await control('cover_scene_scene-0').click();await page.waitForFunction(()=>document.querySelector('[data-creation-control$=".save_post"]')?.disabled===false);
      assert.equal(await canvas.evaluate(c=>c.toDataURL('image/webp')),cropped,'Returning to a scene restores its crop');
      await control('cover_scene_scene-1').click();await page.waitForFunction(()=>document.querySelector('[data-creation-control$=".save_post"]')?.disabled===false);
      const beforeSave=calls.length;await control('save_post').click();
      await page.waitForFunction(()=>window.fixture.closed===1);
      const saved=calls.slice(beforeSave).find(call=>call.url.endsWith('/UpdatePostThumb'));
      assert.equal(saved.body.values.caption,'Authored caption '+(mobile?'mobile':'desktop'));
      assert.ok(uploads.at(-1).length>500);assert.equal(uploads.at(-1).toString('ascii',8,12),'WEBP');
      const pixels=await page.evaluate(async()=>{const bitmap=await createImageBitmap(await (await fetch('/__upload/cover.webp')).blob());const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);return [...ctx.getImageData(50,c.height/2,1,1).data];});
      assert.ok(pixels[0]>180 && pixels[2]<60,'Encoded uploaded cover must be selected red scene');
      const hash=crypto.createHash('sha256').update(uploads.at(-1)).digest('hex');
      fs.writeFileSync(path.join(output,(mobile?'mobile':'desktop')+'-chosen-cover.webp'),uploads.at(-1));
      console.log('PASS '+(mobile?'mobile':'desktop')+' cover: top horizontal selector/collapse, app accent, retained edits/crop, selected real WEBP pixels, hash '+hash.slice(0,12));

      await page.goto(origin+'/__test?mode=viewer&mobile='+(mobile?1:0));
      for(const branch of [0,1]) for(const aspect of ['portrait','square','landscape']) {
        await page.evaluate(({branch,aspect})=>window.fixture.choose({branch,aspect}),{branch,aspect});
        const video=page.locator('#player-stage video');await page.waitForFunction(()=>document.querySelector('#player-stage video').readyState>=2);
        await video.evaluate(v=>v.play());await page.waitForFunction(()=>window.fixture.state().playing);
        assert.equal(await page.getByText('Saved post caption',{exact:false}).isVisible(),false);
        assert.equal(await page.getByText('@author',{exact:true}).isVisible(),true);
        await video.evaluate(v=>v.pause());await page.waitForFunction(()=>!window.fixture.state().playing);
        assert.equal(await page.getByText('Saved post caption',{exact:false}).isVisible(),true);
        if(!await page.evaluate(()=>window.fixture.state().seeker))await video.dblclick();
        await page.getByRole('slider',{name:'Seek video'}).waitFor();await video.evaluate(v=>v.pause());
        assert.equal(await page.getByText('Saved post caption',{exact:false}).isVisible(),false);
        const seek=page.getByRole('slider',{name:'Seek video'});await seek.fill('8');await seek.dispatchEvent('input');
        assert.equal(await page.getByText('Saved post caption',{exact:false}).isVisible(),false);
        const geometry=await page.evaluate(()=>{const v=document.querySelector('#player-stage video'),r=v.getBoundingClientRect(),button=document.querySelector('[aria-label$="playback"]'),row=button.parentElement.getBoundingClientRect(),b=button.getBoundingClientRect(),slider=document.querySelector('[aria-label="Seek video"]').getBoundingClientRect();const scale=Math.min(r.width/v.videoWidth,r.height/v.videoHeight),width=v.videoWidth*scale,height=v.videoHeight*scale;return {expected:{left:r.left+(r.width-width)/2,width,bottom:r.top+(r.height+height)/2},row:{left:row.left,width:row.width,bottom:row.bottom},button:{width:b.width,height:b.height},slider:{left:slider.left,right:slider.right,height:slider.height}};});
        assert.ok(Math.abs(geometry.row.width-geometry.expected.width)<1,JSON.stringify(geometry));
        assert.ok(Math.abs(geometry.row.left-geometry.expected.left)<1,JSON.stringify(geometry));
        assert.ok(Math.abs(geometry.row.bottom-geometry.expected.bottom)<1,JSON.stringify(geometry));
        assert.equal(geometry.button.width,42);assert.equal(geometry.button.height,42);
        assert.ok(geometry.slider.right<geometry.row.left+geometry.row.width && geometry.slider.left>geometry.row.left);
        if(branch===0)await shot('seeker-'+aspect);
        await video.dblclick();await page.waitForFunction(()=>!window.fixture.state().seeker);
        await video.evaluate(v=>v.pause());await page.waitForFunction(()=>!window.fixture.state().playing);
        assert.equal(await page.getByText('Saved post caption',{exact:false}).isVisible(),true);
        console.log('PASS '+(mobile?'mobile':'desktop')+' branch '+branch+' '+aspect+': actual play/pause, username, seeker-paused/scrub, fitted row '+geometry.row.width.toFixed(1)+'px');
      }
      const video=page.locator('#player-stage video');await video.dblclick();await page.getByRole('slider',{name:'Seek video'}).waitFor();
      await page.locator('#audio-peer video').evaluate(v=>v.volume=.35);await page.waitForFunction(()=>document.querySelector('#player-stage video').volume===.35);
      await page.getByRole('button',{name:'Unmute playback',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#audio-peer video').muted);
      await page.evaluate(()=>window.fixture.choose({aspect:'square',width:600}));await page.waitForFunction(()=>document.querySelector('#player-stage video').readyState>=2);
      assert.equal(await video.evaluate(v=>v.volume),.35);assert.equal(await video.evaluate(v=>v.muted),false);
      if(!mobile){await page.setViewportSize({width:900,height:800});await page.waitForTimeout(150);const width=await page.getByRole('button',{name:'Mute playback',exact:true}).evaluate(button=>button.parentElement.getBoundingClientRect().width);const available=await page.locator('#player-stage').evaluate(stage=>Math.min(stage.clientWidth,stage.clientHeight));assert.ok(Math.abs(width-available)<1,'Resized square controls must fit within the stage: '+width+' vs '+available);await shot('resized-square');}
      console.log('PASS '+(mobile?'mobile':'desktop')+' shared mute/volume and resize retain fitted geometry');
      await context.close();
    }
    assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
    fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({screenshots,uploadBytes:uploads.map(buf=>buf.length),requests:calls.map(({method,url})=>({method,url})),externalRequests:blocked,pageErrors:errors},null,2));
    console.log('PASS isolated actual-browser suite; '+screenshots.length+' screenshots; no external requests or page errors.');
  } finally {await browser?.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
