const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {AutomaticSpeechQueue,announcementKey}=require('./loadTs.cjs')('src/conciergeAnnouncements.ts');
const voiceFile='src/hooks/useGeminiVoice.ts',providerFile='src/components/BrainstormSessionProvider.tsx';
function callback(file,name,bindings){
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let found;
 function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(source)===name)found=n.initializer.arguments[0];ts.forEachChild(n,visit);}visit(source);assert.ok(found,name);
 const js=ts.transpileModule('const fn='+found.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return new Function(...Object.keys(bindings),js+';return fn;')(...Object.values(bindings));
}
const pending=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const refs={};for(const [,name] of fs.readFileSync(voiceFile,'utf8').matchAll(/\b(\w+Ref)\.current\b/g))refs[name]={current:null};
 for(const name of ['ttsRunIdRef','voiceTurnIdRef','nextStartRef','audioChunksRef'])refs[name].current=0;
 for(const name of ['transcriptRef','ttsSpokenTextRef'])refs[name].current='';
 for(const name of ['closedRef','processingTranscriptRef','ttsSpeakingRef','activeRef'])refs[name].current=false;
 refs.sourcesRef.current=[];refs.automaticSpeechRef.current=new AutomaticSpeechQueue();
 const requests=[],drains=[],statuses=[],stopped=[];let resume=async()=>{},reply=()=>new Response(new Uint8Array([0,1]));
 const noop=()=>{},bindings={...refs,L:noop,cleanTtsChunkText:s=>s.trim(),normalizeTranscript:s=>s.toLowerCase(),
 clearTtsInterruptionRecovery:noop,clearDuckRestoreTimer:noop,restoreTtsVolume:noop,armTtsInterruptionRecovery:noop,
 setStatus:s=>statuses.push(s),setError:noop,ensureOutputContext:()=>resume(),ttsVoice:'fixture',clikUrl:'/api',conversationMeasurementHeaders:()=>({}),
 store:{getState:()=>({settings:{conversationModel:'luna'},profile:{loggedUser:{id:7}}})},CONVERSATION_PROFILE_POLICY_VERSION:'fixture-policy',
 getConciergeMeteredReceiptCursor:()=>0,handleConciergeMeteredReceiptBatch:noop,handleConciergeMeteredBillingEvent:noop,
 pollConciergeVoiceReceipts:async()=>{},
 fetch:async(url,opts)=>{if(!url.endsWith('/voiceTtsStream'))return Response.json({receipts:[],meteredBilling:null});requests.push(JSON.parse(opts.body));return reply();},
 bytesToInt16:()=>new Int16Array([1]),playPcm:()=>{refs.sourcesRef.current.push({stop:()=>stopped.push('audio')});statuses.push('speaking');},
 waitForPlaybackDrain:()=>{const d=pending();drains.push(d);return d.promise;},
 };
 for(const name of ['hasAudiblePlayback','hasActiveTts','stopPlayback','finishTtsRun','sendReplyForTts'])bindings[name]=callback(voiceFile,name,bindings);
 refs.drainAutomaticSpeechRef.current=()=>void refs.automaticSpeechRef.current.flush(async(text,current)=>(await bindings.sendReplyForTts(text,{allowWhenStopped:true,automaticCurrent:current}))!==false);
 const speak=callback(voiceFile,'speakText',bindings),offer=callback(voiceFile,'queueAutomaticSpeech',bindings),stop=callback(voiceFile,'stopSpeech',bindings);
 const finish=async()=>{refs.sourcesRef.current=[];drains.shift()?.resolve();await tick();};
 return {refs,bindings,requests,drains,statuses,stopped,speak,offer,stop,finish,resume:fn=>resume=fn,response:fn=>reply=fn};
}
test('real automatic scheduler completes during long direct audio; latest announcement waits without stopping it',async()=>{
 const f=fixture(),direct=f.speak('A long direct answer');await tick();assert.equal(f.drains.length,1);
 const controls=[],inflight=new Set(),controllers=new Map();
 const run=callback(providerFile,'runAutomaticGuideCall',{
 automaticGuide:{enabled:true,callOverrides:{},calls:{}},store:{getState:()=>({settings:{autoControlEnabled:true,autoControlVisible:true}})},guideEnabled:true,isChatOpen:false,
 voiceBusyRef:{current:false},chatHistoryRef:{current:[]},automaticGuideControllersRef:{current:controllers},automaticGuideInFlightRef:{current:inflight},heartbeatAbortRef:{current:null},heartbeatQuietUntilRef:{current:0},AUTO_CONTROL_PING_INTERVAL:2000,
 dispatch:action=>controls.push(action),automaticGuideCallStarted:x=>({started:x}),automaticGuideCallSucceeded:x=>({succeeded:x}),automaticGuideCallFailed:x=>({failed:x}),automaticGuideCallCancelled:x=>({cancelled:x}),
 fullAppVoiceAsk:async text=>text,queueAutomaticAnnouncement:text=>f.offer(text,()=>true),setChatHistory(){},resumeAutoControlTask(){},
 });
 await run({callId:'creation-progress',message:'Old milestone'});await tick();
 await run({callId:'creation-progress',message:'Latest milestone'});await tick();
 assert.equal(inflight.size,0);assert.equal(controllers.size,0);assert.equal(controls.filter(a=>a.succeeded).length,2);
 assert.deepEqual(f.requests.map(r=>r.text),['A long direct answer']);assert.equal(f.stopped.length,0);
 await f.finish();await direct;assert.deepEqual(f.requests.map(r=>r.text),['A long direct answer','Latest milestone']);assert.equal(f.stopped.length,0);
 await f.finish();
});
test('TTS first-audio wait does not own control scheduling and still excludes automatic playback',async()=>{
 const f=fixture(),audio=pending();f.resume(()=>audio.promise);const direct=f.speak('Direct answer waiting for audio');await tick();
 f.offer('Automatic announcement',()=>true);await tick();audio.resolve();await tick();
 assert.deepEqual(f.requests.map(r=>r.text),['Direct answer waiting for audio']);assert.equal(f.stopped.length,0);
 const source=fs.readFileSync(providerFile,'utf8'),assignment=source.match(/voiceBusyRef.current = ([^;]+);/)[1];
 const busy=new Function('voice','return '+assignment);assert.equal(busy({status:'thinking',inputPending:false}),false);assert.equal(busy({status:'speaking',inputPending:false}),false);assert.equal(busy({status:'speaking',inputPending:true}),true);
 await f.finish();await direct;await f.finish();
});
test('automatic speech cannot replace direct playback while its first TTS bytes are pending',async()=>{
 const f=fixture(),response=pending();f.response(()=>response.promise);const direct=f.speak('Waiting for first bytes');await tick();
 assert.equal(f.statuses.at(-1),'thinking');f.offer('Milestone while audio starts',()=>true);await tick();assert.equal(f.requests.length,1);
 f.response(()=>new Response(new Uint8Array([0,1])));response.resolve(new Response(new Uint8Array([0,1])));await tick();
 assert.equal(f.requests.length,1);assert.equal(f.stopped.length,0);await f.finish();await direct;assert.equal(f.requests.length,2);await f.finish();
});
test('a newer announcement supersedes one waiting for AudioContext resume',async()=>{
 const f=fixture(),audio=pending();f.resume(()=>audio.promise);f.offer('Superseded update',()=>true);await tick();f.offer('Current update',()=>true);audio.resolve();await tick();
 assert.deepEqual(f.requests.map(r=>r.text),['Current update']);await f.finish();
});
for(const reason of ['obsolete snapshot','new user input','Stop'])test('queued automatic speech is cancelled by '+reason,async()=>{
 const f=fixture();const direct=f.speak('Direct answer');await tick();let current=true;f.offer('Stale announcement',()=>current);await tick();
 if(reason==='obsolete snapshot')current=false;
 else if(reason==='Stop')f.stop();
 else {f.refs.automaticSpeechRef.current.cancel();f.refs.voiceTurnIdRef.current++;}
 await f.finish();await direct;assert.deepEqual(f.requests.map(r=>r.text),['Direct answer']);
});
test('automatic audio resume rechecks playback ownership and cancellation atomically',async()=>{
 for(const reason of ['input','stop','playback']){
  const f=fixture(),audio=pending();f.resume(()=>audio.promise);f.offer('Waiting announcement',()=>true);await tick();
  if(reason==='input'){f.refs.processingTranscriptRef.current=true;f.refs.automaticSpeechRef.current.cancel();}
  if(reason==='stop')f.stop();
  if(reason==='playback'){f.refs.ttsSpeakingRef.current=true;f.refs.sourcesRef.current=[{stop:()=>f.stopped.push('direct')}];}
  audio.resolve();await tick();assert.equal(f.requests.length,0);assert.equal(f.stopped.length,0);
 }
});
test('production announcement validity checks current target, permission, mode and abort at emission',()=>{
 let snapshot={route:'/creation',creation:{projectId:'p',selectedReferenceId:'a',mediaRevision:1}},valid;
 const state={brainstorm:{automaticGuide:{enabled:true,callOverrides:{}}},settings:{autoControlEnabled:true,autoControlVisible:true}};
 const controller=new AbortController(),mode={current:true};
 const identity={current:{sessionId:'session',deviceId:'device',userId:1}};
 const queue=callback(providerFile,'queueAutomaticAnnouncement',{announcementKey,observeCurrentAppSnapshot:()=>snapshot,sessionIdentityRef:identity,automaticSpeechQueueRef:{current:(text,current)=>valid=current},store:{getState:()=>state},guideEnabledRef:{current:true},guidePlayModeRef:mode,voiceActiveRef:{current:false}});
 queue('Ready','creation-progress',controller.signal);assert.equal(valid(),true);
 snapshot={...snapshot,creation:{...snapshot.creation,selectedReferenceId:'b'}};assert.equal(valid(),false);
 snapshot.creation.selectedReferenceId='a';state.settings.autoControlEnabled=false;assert.equal(valid(),false);state.settings.autoControlEnabled=true;
 mode.current=false;assert.equal(valid(),false);mode.current=true;
 identity.current={...identity.current,sessionId:'new-session'};assert.equal(valid(),false);identity.current={...identity.current,sessionId:'session'};
 controller.abort();assert.equal(valid(),false);
});
test('production Reset cancels completed automatic speech waiting behind a direct answer',async()=>{
 const f=fixture(),direct=f.speak('Direct answer');await tick();f.offer('Old session narration',()=>true);await tick();
 const noop=()=>{},refs={};for(const [,name] of fs.readFileSync(providerFile,'utf8').matchAll(/\b(\w+Ref)\.current\b/g))refs[name]={current:new Map()};
 Object.assign(refs,{automaticSpeechCancelRef:{current:()=>f.refs.automaticSpeechRef.current.cancel()},heartbeatAbortRef:{current:null},sessionIdentityRef:{current:{userId:1,sessionId:'old-session',deviceId:'device'}},creationMemoryTimerRef:{current:null},creationMemorySyncGenerationRef:{current:0},sessionMemoryGenerationRef:{current:0}});
 const reset=callback(providerFile,'clearBrainstormSession',{...refs,clikUrl:'',clearAutoControlTask:noop,getOrCreateBrainstormDeviceId:()=>'',createBrainstormScopedId:()=> 'new-session',setCreationMemoryUnsyncedCardKeys:noop,dispatch:noop,resetBrainstormSession:noop,setBrainstormSessionIdentity:noop});
 await reset();await f.finish();await direct;assert.deepEqual(f.requests.map(r=>r.text),['Direct answer']);
});
