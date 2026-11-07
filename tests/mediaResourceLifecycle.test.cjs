const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function moduleWithGlobals(file, globals) {
  const exports = {}, module = { exports };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('module','exports',...Object.keys(globals),code)(module,exports,...Object.values(globals));
  return module.exports;
}
function resources(overrides = {}) {
  const events = [], timers = new Map(), videos = [], images = [], canvases = [], urls = [], revoked = [];
  let timerId = 0;
  const canvas = () => {
    const value = {width:1,height:1,getContext:()=>({drawImage(){if(overrides.drawError)throw overrides.drawError;}}),
      toBlob(callback,type){callback(overrides.emptyBlob?null:new Blob(['encoded'],{type}));}};
    canvases.push(value);return value;
  };
  const video = () => {
    const value = {duration:10,videoWidth:180,videoHeight:320,readyState:2,currentTime:0,paused:true,
      pause(){events.push('pause');},removeAttribute(name){if(name==='src')this.source='';},load(){events.push('load');}};
    Object.defineProperty(value,'src',{get(){return this.source||'';},set(source){events.push({source,cors:this.crossOrigin,metadata:!!this.onloadedmetadata,seeked:!!this.onseeked,error:!!this.onerror});this.source=source;}});
    videos.push(value);return value;
  };
  const globals = {document:{createElement:name=>name==='video'?video():canvas()},Blob,DOMException,
    setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);},
    URL:{createObjectURL(blob){urls.push(blob);return 'blob:converter-owned';},revokeObjectURL(url){revoked.push(url);}},
    Image:class{constructor(){this.width=180;this.height=320;images.push(this);}removeAttribute(){this.src='';}},
  };
  return {events,timers,videos,images,canvases,urls,revoked,globals};
}
function assertDisposed(r) {
  assert.equal(r.timers.size,0);
  for(const v of r.videos){assert.equal(v.src,'');assert.equal(v.onloadedmetadata,null);assert.equal(v.onseeked,null);assert.equal(v.onerror,null);assert.equal(v.onloadeddata,null);}
  for(const c of r.canvases){assert.equal(c.width,0);assert.equal(c.height,0);}
}
test('frame helper configures CORS/listeners before unchanged URL and disposes decoder after selected/end frame export',async()=>{
  for(const options of [{timeSeconds:3},{endOffsetSeconds:.06,mimeType:'image/webp'}]){
    const r=resources(),{captureVideoFrameBlob}=moduleWithGlobals('src/videoFrameCapture.ts',r.globals);
    const pending=captureVideoFrameBlob('https://saved.test/video.mp4?signature=retained',options),v=r.videos[0];
    assert.deepEqual(r.events[0],{source:'https://saved.test/video.mp4?signature=retained',cors:'anonymous',metadata:true,seeked:true,error:true});
    v.onloadedmetadata();assert.equal(v.currentTime,options.timeSeconds??9.94);v.onseeked();
    const result=await pending;assert.equal(result.type,options.mimeType||'image/jpeg');assertDisposed(r);
  }
});
test('time-zero frame waits for decoded data without requiring a seek event',async()=>{
  const r=resources(),{captureVideoFrameBlob}=moduleWithGlobals('src/videoFrameCapture.ts',r.globals);
  const pending=captureVideoFrameBlob('https://saved.test/video.mp4',{timeSeconds:0}),v=r.videos[0];
  v.readyState=1;v.onloadedmetadata();assert.equal(r.canvases.length,0);v.readyState=2;v.onloadeddata();
  assert.ok(await pending instanceof Blob);assertDisposed(r);
});
test('frame error, CORS canvas error, empty encoding, timeout, abort and pre-abort release all owned resources',async()=>{
  for(const failure of ['network','cors','empty','timeout','abort','preabort']){
    const r=resources({drawError:failure==='cors'?new DOMException('tainted','SecurityError'):undefined,emptyBlob:failure==='empty'});
    const {captureVideoFrameBlob}=moduleWithGlobals('src/videoFrameCapture.ts',r.globals),controller=new AbortController();
    if(failure==='preabort')controller.abort();
    const pending=captureVideoFrameBlob('https://saved.test/video.mp4',{timeSeconds:2,signal:controller.signal}),v=r.videos[0];
    const rejected=assert.rejects(pending);
    if(failure==='network')v.onerror();else if(failure==='timeout')[...r.timers.values()][0]();else if(failure==='abort')controller.abort();
    else if(failure!=='preabort'){v.onloadedmetadata();v.onseeked();}
    await rejected;assertDisposed(r);
  }
});
test('PNG conversion revokes only its private URL and clears image/canvas/timer on all outcomes',async()=>{
  for(const failure of ['success','network','cors','empty','timeout','abort']){
    const r=resources({drawError:failure==='cors'?new Error('draw failed'):undefined,emptyBlob:failure==='empty'});
    const {imageBlobToPng}=moduleWithGlobals('src/imageBlobConversion.ts',r.globals),controller=new AbortController();
    const input=new Blob(['original']),pending=imageBlobToPng(input,{signal:controller.signal});
    const rejected=failure==='success'?null:assert.rejects(pending);
    if(failure==='network')r.images[0].onerror();else if(failure==='timeout')[...r.timers.values()][0]();else if(failure==='abort')controller.abort();else r.images[0].onload();
    if(rejected)await rejected;else assert.equal((await pending).type,'image/png');
    assert.equal(r.urls[0],input);assert.deepEqual(r.revoked,['blob:converter-owned']);assert.equal(r.images[0].src,'');assert.equal(r.images[0].onload,null);assert.equal(r.images[0].onerror,null);assertDisposed(r);
  }
});
function initializer(file,name){const source=ts.createSourceFile(file,fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let found;const visit=node=>{if(ts.isVariableDeclaration(node)&&node.name.getText(source)===name)found=node.initializer;ts.forEachChild(node,visit);};visit(source);return found.getText(source);}
function evaluate(code,bindings){const js=ts.transpileModule('const handler='+code+';',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;return new Function(...Object.keys(bindings),js+'return handler;')(...Object.values(bindings));}
test('actual MediaPromptVideo frame handler preserves selected time/scene and prevents a cancelled handoff',async()=>{
  for(const cancel of [false,true]){
    const handed=[],closing=[],ref={current:null};let release,captured;
    const handler=evaluate(initializer('src/MediaPromptVideo.tsx','handleUseFrame'),{activeVideoRef:{current:{currentTime:4.2}},onExtractFrame:(...args)=>handed.push(args),activeVideoSrc:'https://saved.test/source.mp4',isExtractingFrame:false,index:3,AbortController,frameCaptureRef:ref,setIsExtractingFrame:()=>{},captureVideoFrameBlob:(source,options)=>{captured={source,options};return new Promise(resolve=>release=resolve);},setActiveVideoSrc:value=>closing.push(value),isDirectMode:true,onToggleContext:()=>{},setOpen:()=>{},console,alert:message=>assert.fail(message)});
    const pending=handler();assert.equal(captured.options.timeSeconds,4.2);assert.equal(captured.source,'https://saved.test/source.mp4');
    if(cancel){ref.current.abort();ref.current=null;}release(new Blob(['frame']));await pending;
    assert.equal(handed.length,cancel?0:1);if(!cancel)assert.equal(handed[0][0],3);assert.equal(closing.length,cancel?0:1);
  }
});
test('actual MirrorView converter delegates to the helper without claiming caller URL ownership',async()=>{
  const input=new Blob(['image']),calls=[];
  const handler=evaluate(initializer('src/MirrorView.tsx','convertToPng'),{useCallback:fn=>fn,imageBlobToPng:blob=>{calls.push(blob);return Promise.resolve(new Blob(['png'],{type:'image/png'}));}});
  assert.equal((await handler(input)).type,'image/png');assert.equal(calls[0],input);
});

test('actual Video History restore rejects duplicate pending calls and recovers from failed metadata saves',async()=>{
  const entry={videoUrl:'https://saved.test/prior.mp4',createdAt:123,prompt:'Authored earlier motion'};
  const pending={current:null},request={current:0},calls=[],states=[],errors=[];let reject;
  const handler=evaluate(initializer('src/MediaPromptVideo.tsx','handleRestoreHistoryVideo'),{
    onRestoreVideo:value=>{calls.push(value);return new Promise((_resolve,no)=>reject=no);},restorePendingRef:pending,restoreRequestRef:request,
    setRestoringVideoUrl:value=>states.push(value),setRestoreError:value=>errors.push(value),
  });
  const job=handler(entry);await handler(entry);assert.equal(calls.length,1);assert.equal(calls[0],entry);
  assert.equal(pending.current,entry.videoUrl);reject(Error('Project metadata failed'));await job;
  assert.equal(pending.current,null);assert.deepEqual(states,[entry.videoUrl,null]);assert.deepEqual(errors,['','Project metadata failed']);
  const retry=handler(entry);assert.equal(calls.length,2);reject(Error('Retry failed'));await retry;assert.equal(pending.current,null);
});

test('actual Video History completion from an old scene cannot overwrite current restore state',async()=>{
  const pending={current:null},request={current:0},states=[],errors=[];let reject;
  const handler=evaluate(initializer('src/MediaPromptVideo.tsx','handleRestoreHistoryVideo'),{
    onRestoreVideo:()=>new Promise((_resolve,no)=>reject=no),restorePendingRef:pending,restoreRequestRef:request,
    setRestoringVideoUrl:value=>states.push(value),setRestoreError:value=>errors.push(value),
  });
  const job=handler({videoUrl:'https://saved.test/old-scene.mp4',createdAt:1});
  request.current++;pending.current='https://saved.test/current-scene.mp4';reject(Error('Old scene failed'));await job;
  assert.equal(pending.current,'https://saved.test/current-scene.mp4');assert.equal(states.length,1);assert.deepEqual(errors,['']);
});

test('actual character copy falls back once on remote read/CORS failure and preserves an independent frozen URL',async()=>{
  const normalized=[],puts=[];
  const handler=evaluate(initializer('src/MediaFinalImage.tsx','copyImageToS3InBrowser'),{
    fetch:async()=>{throw new TypeError('CORS blocked');},AbortController,setTimeout,clearTimeout,
    normalizeImageUrlToS3:async(source,purpose)=>{normalized.push({source,purpose});return 'https://saved.test/frozen-copy.png';},
    axios:{post:()=>assert.fail('Fallback must not start a second browser upload'),put:(...args)=>puts.push(args)},CLIK_URL:'https://fixture.invalid',
  });
  const saved=await handler('https://saved.test/original.png');assert.equal(saved,'https://saved.test/frozen-copy.png');
  assert.equal(normalized.length,1);assert.equal(normalized[0].source,'https://saved.test/original.png');assert.match(normalized[0].purpose,/^saved-scene-reference-/);assert.equal(puts.length,0);
});

test('character copy keeps direct success and does not make another copy after upload failure or missing local data',async()=>{
  const input=new Blob(['original'],{type:'image/png'});
  for(const failure of ['none','upload','local']){
    const copies=[],uploads=[];
    const handler=evaluate(initializer('src/MediaFinalImage.tsx','copyImageToS3InBrowser'),{
      fetch:async()=>{if(failure==='local')throw new TypeError('Missing local Blob');return {ok:true,blob:async()=>input};},AbortController,setTimeout,clearTimeout,
      normalizeImageUrlToS3:async(...args)=>{copies.push(args);return 'https://saved.test/extra.png';},
      axios:{post:async()=>({data:{holder:[{urlHD:'https://saved.test/new.png?signature=1'}]}}),put:async(url,blob)=>{uploads.push({url,blob});if(failure==='upload')throw new Error('upload failed');return {status:200};}},CLIK_URL:'https://fixture.invalid',
    });
    if(failure==='none'){assert.equal(await handler('https://saved.test/original.png'),'https://saved.test/new.png');assert.equal(uploads[0].blob,input);}
    else await assert.rejects(handler(failure==='local'?'blob:unsaved-original':'https://saved.test/original.png'));
    assert.equal(copies.length,0);
  }
});
