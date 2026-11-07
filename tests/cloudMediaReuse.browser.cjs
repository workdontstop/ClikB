const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {pathToFileURL}=require('node:url'),ts=require('typescript');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||path.resolve(__dirname,'../.tmp/concierge-browser-deps/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),output=path.join(root,'.tmp/cloud-media-reuse'),origin='http://127.0.0.1:5296',remoteOrigin='http://127.0.0.1:5297';
fs.mkdirSync(output,{recursive:true});
const clip=path.join(root,'.tmp/viewer-autoplay-capture/audio-portrait.mp4');assert.ok(fs.existsSync(clip),'Generate the tiny local video with viewerAutoplayCapture.browser.cjs first');
const fixture=ts.transpileModule(`
import React,{useState,useRef,useEffect} from 'react';import {createRoot} from 'react-dom/client';import {Provider} from 'react-redux';
import {ThemeProvider,createTheme} from '@mui/material';import {store} from '/src/store.ts';
import MediaPromptImage from '/src/MediaPromptImage.tsx';import MediaFinalImage from '/src/MediaFinalImage.tsx';import MediaPromptVideo from '/src/MediaPromptVideo.tsx';
import {downloadImageUrlAsBlob} from '/src/imageCorsDownloadManager.ts';import {imageBlobToPng} from '/src/imageBlobConversion.ts';import {captureVideoFrameBlob} from '/src/videoFrameCapture.ts';
window.fixture={requests:[],releases:[],continued:false};
const put=async(blob,kind)=>{const response=await fetch('/api/storage/'+kind,{method:'PUT',body:blob});if(!response.ok)throw Error('fixture storage failed');return (await response.json()).url;};
function App(){
const [mobile,setMobile]=useState(window.innerWidth<600);useEffect(()=>{const resize=()=>setMobile(window.innerWidth<600);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
const [image,setImage]=useState(''),[video,setVideo]=useState(''),[otherVideo,setOtherVideo]=useState(''),[videoHistory,setVideoHistory]=useState([]),[currentVideoPrompt,setCurrentVideoPrompt]=useState(''),[images,setImages]=useState([]),[selected,setSelected]=useState([]),[characters,setCharacters]=useState([]),[references,setReferences]=useState([]);
const [imagePrompt,setImagePrompt]=useState([{uploadedImages:[]}]),[characterSource,setCharacterSource]=useState('');
const owner=useRef({image:null,video:null,frame:null,context:null}),urls=useRef(new Set());
window.fixture.state=()=>({image,video,otherVideo,videoHistory,currentVideoPrompt,images,selected,characters,references,continued:false,
 retainedOriginalBytes:Object.values(owner.current).reduce((bytes,value)=>bytes+(value?.size||0),0),ownedObjectUrls:[...urls.current]});
window.fixture.generate=async(version)=>{
 const imageFile=new File(['<svg xmlns="http://www.w3.org/2000/svg" width="96" height="128"><rect width="96" height="128" fill="'+(version%2?'#cc2200':'#0033cc')+'"/></svg>'],'scene-'+version+'.svg',{type:'image/svg+xml'});
 const videoFile=new File([await (await fetch('/initial-video.mp4')).blob()],'scene-'+version+'.mp4',{type:'video/mp4'});
 owner.current.image=imageFile;owner.current.video=videoFile;
 const imagePreview=URL.createObjectURL(imageFile),videoPreview=URL.createObjectURL(videoFile);urls.current.add(imagePreview);urls.current.add(videoPreview);
 const [savedImage,savedVideo]=await Promise.all([put(imageFile,'image'),put(videoFile,'video')]);
 // Explicit fixture persistence boundary: no DB operation and no Continue exists here.
 owner.current.image=null;owner.current.video=null;setImage(savedImage);setVideo(savedVideo);if(version===1)setOtherVideo(savedVideo);setVideoHistory(previous=>[...previous,{videoUrl:savedVideo,createdAt:1700000000000+version,prompt:'Authored version '+version}]);setCurrentVideoPrompt('Authored version '+version);setImages(previous=>[...previous,savedImage]);setCharacterSource(savedImage);
 URL.revokeObjectURL(imagePreview);URL.revokeObjectURL(videoPreview);urls.current.delete(imagePreview);urls.current.delete(videoPreview);
 window.fixture.releases.push({version,imagePreview,videoPreview,savedImage,savedVideo});return {savedImage,savedVideo};
};
window.fixture.selectCharacter=source=>{setCharacters([]);setReferences([]);setCharacterSource(source);};
window.fixture.endFrame=async(source)=>{const frame=await captureVideoFrameBlob(source,{endOffsetSeconds:.04,mimeType:'image/webp'});owner.current.frame=frame;const url=await put(frame,'frame');owner.current.frame=null;return {url,bytes:frame.size,type:frame.type};};
const selectContext=async(source)=>{const downloaded=await downloadImageUrlAsBlob(source);owner.current.context=downloaded;const converted=await imageBlobToPng(downloaded);const url=await put(converted,'context');owner.current.context=null;setSelected([url]);};
const useFrame=async(_index,frame)=>{owner.current.frame=frame;const url=await put(frame,'frame');owner.current.frame=null;setImage(url);window.fixture.usedFrame={url,bytes:frame.size,type:frame.type};};
return <main style={{padding:20,color:'white',maxWidth:900,margin:'0 auto'}}>
 <h2>Cloud-only completed scene fixture</h2><div id="image-context"><MediaPromptImage index={0} imagesList={images} selectedImages={selected} onSelect={selectContext}
 darkMode={true} setGeneratedImagePrompt={setImagePrompt} generatedImagePrompt={imagePrompt} ImagesHdCloud={[image]} PostId={1} selectedStyle="fixture" Planx={{}}
 Seed={1} steps={['one']} modelz="fixture" generatedImagesFlux={images} prompt="Authored prompt" worldModelsInuse={[]} setWorldModelsInuse={()=>{}}/></div>
 <div id="character-copy"><MediaFinalImage index={0} imagesList={images} selectedImages={characterSource?[characterSource]:[]} onTriggerFilePicker={()=>{}} darkMode={true}
 onImageUrlChange={selectContext} PostId={1} selectedStyle="fixture" Planx={{}} Seed={1} steps={['one']} modelz="fixture" generatedImagesFlux={images} prompt="Authored prompt"
 onFileChange={()=>{}} showWorldModel3={false} setshowWorldModel3={()=>{}} Vipcharacters={characters} referenceImages={references} setVipcharacters={setCharacters} setReferenceImages={setReferences}/></div>
 <div id="video-context" style={{position:'relative',height:100}}><MediaPromptVideo index={0} VideoArrayCloud={video?[video,otherVideo]:[]} currentImage={image} videoHistory={videoHistory}
 onRestoreVideo={async entry=>{window.fixture.restores=(window.fixture.restores||[]).concat(entry);setVideo(entry.videoUrl);setCurrentVideoPrompt(entry.prompt||'');}}
 onSelectStepback={()=>{}} onToggleContext={()=>{}} isDirectMode={false} darkMode={true} appColor="#ff66aa" matchMobile={mobile} CreationMode="Video" onResetToDefault={()=>{}} onExtractFrame={useFrame}/></div>
 </main>;
}createRoot(document.getElementById('root')).render(<Provider store={store}><ThemeProvider theme={createTheme({palette:{mode:'dark'}})}><App/></ThemeProvider></Provider>);
`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
(async()=>{
let sourceColor='#cc2200',nextObject=0;const objects=new Map(),requests=[],blocked=[],errors=[],screenshots=[];
const svg=()=>Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="128"><rect width="96" height="128" fill="'+sourceColor+'"/></svg>');
const remote=http.createServer((req,res)=>{if(req.url.includes('allow'))res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Cache-Control','no-store');
 if(req.url.startsWith('/video.mp4'))return require('./localVideoFixture.cjs').serveLocalVideo(req,res,clip);
 res.setHeader('Content-Type','image/svg+xml');res.end(svg());});await new Promise(resolve=>remote.listen(5297,'127.0.0.1',resolve));
const {createServer}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')));
const server=await createServer({root,configFile:false,logLevel:'error',cacheDir:path.join(output,'vite'),esbuild:{jsx:'automatic'},optimizeDeps:{include:['react','react/jsx-runtime','react-dom/client','react-redux','@reduxjs/toolkit','@mui/material','@emotion/react','@emotion/styled','axios','framer-motion','react-device-detect']},server:{host:'127.0.0.1',port:5296,strictPort:true,hmr:false},plugins:[{name:'cloud-media-reuse',enforce:'pre',resolveId:id=>id==='/fixture.js'?'\0cloud-media-reuse':undefined,load:id=>id==='\0cloud-media-reuse'?fixture:undefined,
 transform(code,id){if(id.endsWith('/WorldModel.tsx'))return 'export default function WorldModel(){return null;}';if(id.endsWith('/MediaFinalImage.tsx')||id.endsWith('/imageCorsDownloadManager.ts')||id.endsWith('/MediaPromptImage.tsx'))return code.replaceAll('import.meta.env.VITE_CLIK_URL',"'/api'");},
 configureServer(s){s.middlewares.use((req,res,next)=>{
  if(req.url.startsWith('/__test')){res.setHeader('Content-Type','text/html');res.end('<style>body{margin:0;background:#101010}</style><div id="root"></div><script type="module" src="/fixture.js"></script>');return;}
  if(req.url==='/initial-video.mp4')return require('./localVideoFixture.cjs').serveLocalVideo(req,res,clip);
  if(req.url.startsWith('/cloud/')||(req.method==='GET'&&req.url.startsWith('/uploads/'))){const key=req.url.startsWith('/uploads/')?'/cloud/'+req.url.slice(9).split('?')[0]:req.url.split('?')[0];const object=objects.get(key);if(!object){res.statusCode=404;res.end();return;}if(object.file)return require('./localVideoFixture.cjs').serveLocalVideo(req,res,object.file);res.setHeader('Content-Type',object.type);res.setHeader('Cache-Control','no-store');res.end(object.body);return;}
  if(req.url.startsWith('/api/')||req.url.startsWith('/uploads/')){const chunks=[];req.on('data',chunk=>chunks.push(chunk));req.on('end',()=>{const body=Buffer.concat(chunks);const payload=req.url.startsWith('/api/')&&!req.url.startsWith('/api/storage/')?JSON.parse(body.toString()||'{}'):{};requests.push({method:req.method,url:req.url,body:payload});const json=value=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));};
    const store=(bytes,type)=>{const key='/cloud/object-'+(++nextObject),object={body:Buffer.from(bytes),type};if(type==='video/mp4'){object.file=path.join(output,'stored-video-'+nextObject+'.mp4');fs.writeFileSync(object.file,bytes);}objects.set(key,object);return origin+key;};
    if(req.url.startsWith('/api/storage/')){const type=req.headers['content-type']||(req.url.endsWith('/video')?'video/mp4':req.url.endsWith('/image')?'image/svg+xml':req.url.endsWith('/context')?'image/png':'image/jpeg');return json({url:store(body,type)});}
    if(req.url==='/api/get_signed_url_imageStory'){const key='/cloud/frozen-'+(++nextObject);return json({holder:[{urlHD:origin+'/uploads/'+key.slice(7)}]});}
    if(req.url.startsWith('/uploads/')){objects.set('/cloud/'+req.url.slice(9),{body:Buffer.from(body),type:'image/svg+xml'});return json({ok:true});}
    if(req.url==='/api/normalize-image-to-s3'){assert.ok(payload.sourceUrl.startsWith(remoteOrigin+'/'));return json({imageUrl:store(svg(),'image/svg+xml')});}
    if(req.url==='/api/download-image-for-client'){const own=objects.get(new URL(payload.sourceUrl).pathname);const bytes=own?.body||svg();res.setHeader('Content-Type',own?.type||'image/svg+xml');res.end(bytes);return;}
    if(req.url==='/api/replace-source'){sourceColor='#0033cc';return json({ok:true});}
    res.statusCode=404;json({error:'Unexpected fixture endpoint'});
  });return;}next();
 });}}]});await server.listen();let browser;
try{
browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({viewport:{width:1280,height:950}});page.setDefaultTimeout(30000);page.on('pageerror',error=>{errors.push(error.message);console.error(error.message);});
await page.route('**/*',route=>{const url=route.request().url();if(url.startsWith(origin+'/')||url.startsWith(remoteOrigin+'/')||url.startsWith('blob:')||url.startsWith('data:'))return route.continue();blocked.push(url);return route.abort();});
await page.goto(origin+'/__test');await page.waitForFunction(()=>window.fixture?.generate);
for(let version=1;version<=9;version++){
const saved=await page.evaluate(version=>window.fixture.generate(version),version);await page.waitForFunction(()=>window.fixture.state().ownedObjectUrls.length===0);
const state=await page.evaluate(()=>window.fixture.state());assert.equal(state.retainedOriginalBytes,0);assert.equal(state.continued,false);assert.equal(state.image,saved.savedImage);assert.equal(state.video,saved.savedVideo);
const released=await page.evaluate(async()=>{const last=window.fixture.releases.at(-1);const valid=[];for(const url of [last.imagePreview,last.videoPreview])try{await fetch(url);valid.push(true);}catch{valid.push(false);}return valid;});assert.deepEqual(released,[false,false]);
}console.log('PASS nine image/video replacement versions before any DB/Continue: original File owners clear and original URLs cannot be read.');
// Actual image-context selection invokes the real existing server download manager and PNG converter.
await page.locator('#image-context img[alt="Prompt 0"]').click();await page.waitForFunction(()=>window.fixture.state().selected[0]?.startsWith('http:'));
assert.ok(requests.some(request=>request.url==='/api/download-image-for-client'));assert.equal((await page.evaluate(()=>window.fixture.state())).retainedOriginalBytes,0);
console.log('PASS actual image-context selection from stored URL creates a cloud PNG and releases transient input/conversion data.');
// Actual video-context preview and Use Frame consume only cloud URLs after original video files are gone.
await page.locator('[data-creation-control="clikb.creation.workstation_video.control.open_context"]').click();
await page.locator('[data-creation-control="clikb.creation.workstation_video_context.control.frame_history_video_1"]').click();
const preview=page.locator('video[controls]');await preview.waitFor();await page.waitForFunction(()=>document.querySelector('video[controls]')?.readyState>=2);await preview.evaluate(v=>{v.pause();v.currentTime=4.2;});
await page.waitForFunction(()=>Math.abs(document.querySelector('video[controls]').currentTime-4.2)<.05&&!document.querySelector('video[controls]').seeking);
await page.locator('[data-creation-control="clikb.creation.workstation_video_context.control.use_frame"]').click();await page.waitForFunction(()=>window.fixture.usedFrame?.url&&window.fixture.state().retainedOriginalBytes===0);
assert.equal(await page.evaluate(()=>window.fixture.usedFrame.type),'image/jpeg');
console.log('PASS actual video-context Use Frame at4.2s works after original video release and persists only a frame URL.');
// Video History is separate from Frame History and restores a current-scene URL/prompt locally.
await page.locator('[data-creation-control="clikb.creation.workstation_video.control.open_context"]').click();
await page.locator('[data-creation-control="clikb.creation.workstation_video_context.control.show_video_history"]').click();
const earlier=page.locator('video[aria-label^="Earlier Scene"]');assert.equal(await earlier.count(),8);
const historyLayout=[];
for(const viewport of [{width:1280,height:950},{width:390,height:844}]){
await page.setViewportSize(viewport);
const restore=page.locator('[data-creation-control="clikb.creation.workstation_video_context.control.restore_video_1"]');
await page.waitForFunction(()=>getComputedStyle(document.querySelector('[data-creation-control$="show_video_history"]').closest('[data-editstory-gesture-guard]')).opacity==='1');
await earlier.first().evaluate(video=>new Promise(resolve=>{if(video.readyState>=2)return resolve();video.addEventListener('loadeddata',resolve,{once:true});}));
await restore.scrollIntoViewIfNeeded();
const bounds=await restore.boundingBox();assert.ok(bounds&&bounds.x>=0&&bounds.x+bounds.width<=viewport.width+1&&bounds.y>=0&&bounds.y+bounds.height<=viewport.height+1,'Restore remains reachable within viewport');
const previewBounds=await earlier.first().boundingBox();assert.ok(previewBounds&&previewBounds.x>=0&&previewBounds.x+previewBounds.width<=viewport.width+1&&previewBounds.y>=0&&previewBounds.y+previewBounds.height<=viewport.height+1,'First history preview and Restore are simultaneously visible');
assert.ok(await page.locator('[data-creation-control="clikb.creation.workstation_video_context.control.close"]').isVisible());
const screen=path.join(output,'video-history-'+viewport.width+'.png');await page.screenshot({path:screen,fullPage:false});screenshots.push(screen);historyLayout.push({viewport,restore:bounds,preview:previewBounds});
}
await page.setViewportSize({width:1280,height:950});
const beforeRestore=requests.length,otherSource=(await page.evaluate(()=>window.fixture.state())).otherVideo;
await page.locator('[data-creation-control="clikb.creation.workstation_video_context.control.restore_video_1"]').click();
await page.waitForFunction(()=>window.fixture.state().currentVideoPrompt==='Authored version 8');
assert.equal(requests.length,beforeRestore,'History restore must not generate or upload');assert.equal((await page.evaluate(()=>window.fixture.state())).otherVideo,otherSource);
await page.locator('[data-creation-control="clikb.creation.workstation_video_context.control.show_frame_history"]').click();
const latest=page.locator('[data-creation-control^="clikb.creation.workstation_video_context.control.frame_history_video_"]');assert.equal(await latest.count(),2);
assert.equal(await latest.nth(1).locator('video').getAttribute('src'),otherSource);
assert.equal(await latest.nth(0).locator('video').getAttribute('src'),(await page.evaluate(()=>window.fixture.state())).video);
await page.locator('[data-creation-control="clikb.creation.workstation_video_context.control.show_video_history"]').click();
await page.locator('[data-creation-control="clikb.creation.workstation_video_context.control.close"]').click();
assert.equal(await page.locator('video[aria-label^="Earlier Scene"]').count(),0,'Closed Video History must release its temporary preview decoders');
console.log('PASS separate Video History restores version8 URL/authored prompt at0 new uploads, keeps Frame History latest clips from both scenes, and releases closed previews.');
const end=await page.evaluate(source=>window.fixture.endFrame(source),remoteOrigin+'/video.mp4?allow=1');assert.equal(end.type,'image/webp');assert.ok(end.bytes>100);assert.equal((await page.evaluate(()=>window.fixture.state())).retainedOriginalBytes,0);
console.log('PASS native end-frame extraction from CORS-permitted stored video URL after original release.');
const pixel=async url=>page.evaluate(async url=>{const image=new Image();image.crossOrigin='anonymous';await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Frozen image could not be decoded: '+url));image.src=url;});const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const rgba=[...ctx.getImageData(10,10,1,1).data];image.removeAttribute('src');canvas.width=canvas.height=0;return rgba;},url);
for(const cors of ['allow','blocked']){
sourceColor='#cc2200';await page.evaluate(source=>window.fixture.selectCharacter(source),remoteOrigin+'/source.svg?'+cors+'=1');
const before=requests.length;await page.locator('[data-creation-control="clikb.creation.workstation_image_context.control.add_to_characters"]').click();await page.waitForFunction(()=>window.fixture.state().characters.length===1);
const character=(await page.evaluate(()=>window.fixture.state())).characters[0];assert.notEqual(character.imageUrl,character.sourceImageUrl);assert.equal(character.type,'saved-scene');
const oldPixel=await pixel(character.imageUrl);assert.ok(oldPixel[0]>150&&oldPixel[2]<50);
sourceColor='#0033cc';const newSource=remoteOrigin+'/source.svg?allow=1&changed='+cors;assert.ok((await pixel(newSource))[2]>150);assert.deepEqual(await pixel(character.imageUrl),oldPixel,'Frozen copied reference must survive original source replacement');
const recent=requests.slice(before);assert.equal(recent.filter(request=>request.url==='/api/normalize-image-to-s3').length,cors==='blocked'?1:0);assert.equal(recent.filter(request=>request.url==='/api/get_signed_url_imageStory').length,cors==='allow'?1:0);
assert.equal((await page.evaluate(()=>window.fixture.state())).retainedOriginalBytes,0);console.log('PASS actual frozen character copy '+cors+' CORS: independent copy remains unchanged after original replacement, bounded existing fallback only when required.');
}
const file=path.join(output,'cloud-contexts-after-release.png');await page.screenshot({path:file,fullPage:true});screenshots.push(file);
assert.equal(requests.some(request=>/UpdatePost|PostStory|Gpt|generate|del-/.test(request.url)),false);assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify({versions:9,imageContext:true,currentFrame:true,endFrame:true,videoHistory:{previousVersions:8,restoredPrompt:'Authored version 8',newUploads:0,frameHistoryScenes:2,closedPreviewNodes:0,layout:historyLayout},frozenCopyCors:['allow','blocked'],retainedOriginalBytes:0,continueCalls:0,databaseCalls:0,providerCalls:0,externalRequests:blocked,pageErrors:errors,screenshots,requests:requests.map(({method,url})=>({method,url}))},null,2));
console.log('PASS cloud reuse browser suite: original image/video owners released; actual context/frame/frozen-copy actions remain usable; no DB/Continue/provider/external calls.');
}finally{await browser?.close();await server.close();await new Promise(resolve=>remote.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
