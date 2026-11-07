const fs = require('node:fs');
const ts = require('typescript');
const test = require('node:test');
const assert = require('node:assert/strict');
function callback(file, name, bindings) {
 const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let found;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(source)===name)found=n.initializer.arguments[0];ts.forEachChild(n,visit);}visit(source);
 const js=ts.transpileModule('const fn='+found.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return new Function(...Object.keys(bindings),js+';return fn;')(...Object.values(bindings));
}
const pending=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function retainedSpeechFixture(ensureOutputContext = async () => {}) {
 const requests=[],deliveries=[];
 const ttsVoiceRef={current:'Kore'};
 const names=['ttsRunIdRef','voiceTurnIdRef','ttsKnownResponseTextRef','ttsCurrentChunkTextRef','ttsSpokenTextRef','currentTtsTextNormRef','lastTtsTextNormRef','audioChunksRef','ttsAbortRef','ttsSpeakingRef'];
 const refs=Object.fromEntries(names.map(name=>[name,{current:0}]));
 const send=callback('src/hooks/useGeminiVoice.ts','sendReplyForTts',{
  ...refs,ttsVoice:'Kore',ttsVoiceRef,closedRef:{current:false},drainAutomaticSpeechRef:{current:()=>{}},
  cleanTtsChunkText:text=>text,normalizeTranscript:text=>text,ensureOutputContext,
  stopPlayback:()=>refs.ttsRunIdRef.current++,restoreTtsVolume(){},L(){},clikUrl:'/api',
  setTtsDelivery:delivery=>deliveries.push(delivery),setStatus(){},setError:message=>assert.fail(message),
  store:{getState:()=>({settings:{conversationModel:'luna'}})},CONVERSATION_PROFILE_POLICY_VERSION:'fixture-policy',
  conversationMeasurementHeaders:()=>({}),finishTtsRun:async()=>{},
  fetch:async(url,options)=>{assert.ok(url.endsWith('/voiceTtsStream'));requests.push(JSON.parse(options.body));return new Response(new Uint8Array());},
 });
 return {send,ttsVoiceRef,requests,deliveries};
}
test('a retained microphone speech callback uses the newly selected voice on its next request',async()=>{
 const f=retainedSpeechFixture();
 // Keep the same callback, as an already-connected microphone does across renders.
 for(const selectedVoice of ['Kore','fish_fixture_voice','Puck']){
  f.ttsVoiceRef.current=selectedVoice;
  await f.send('Speak with my selected voice.');
  assert.equal(f.requests.at(-1).voice,selectedVoice);
  assert.equal(f.deliveries.at(-1).actualVoice,selectedVoice);
 }
});
test('voice selection made while audio context resumes applies to the pending speech request',async()=>{
 const audio=pending();const f=retainedSpeechFixture(()=>audio.promise);
 const work=f.send('Use my current voice.');
 assert.equal(f.requests.length,0);
 f.ttsVoiceRef.current='fish_fixture_voice';audio.resolve();await work;
 assert.equal(f.requests[0].voice,'fish_fixture_voice');
});
for(const [file,name] of [['src/components/PromptConstructor.tsx','voiceAsk'],['src/components/BrainstormSessionProvider.tsx','fullAppVoiceAsk']]) {
 function fixture(events) {
  const memory=pending(),status=pending(),requests=[],deltas=[],finals=[],memoryWrites=[];let history=[];
  const payload={messages:[{role:'user',content:'ok'}],memorySlots:[{id:'retained-memory'}],sessionIdentity:{sessionId:'test'},userSnapshot:{route:'/feeds',creation:{isActive:true},autoControl:{enabled:false}}};
  const bindings={console:{log(){},error(){}},CLIK_URL:'/api',clikUrl:'/api',conversationModel:'unchanged',chatHistoryRef:{current:[]},setChatHistory:f=>history=f(history),waitForCreationMemorySync:()=>memory.promise,buildBrainstormPayload:()=>payload,cleanVoiceReply:s=>s.trim(),notepadTypeRef:{current:'story'},webSearchRef:{current:false},conversationSupportsOnlineAccess:false,getAutoControlTask:()=>null,noteMemoryAfterAssistant:(...args)=>memoryWrites.push(args),axios:{get:()=>status.promise},fetch:async(url,options)=>{requests.push(JSON.parse(options.body));return new Response(events.map(e=>'data: '+JSON.stringify(e)+'\n\n').join(''));},heartbeatAbortRef:{current:null},store:{getState:()=>({brainstorm:{userSnapshot:payload.userSnapshot}})},voiceContextRef:{current:{}},AUTOMATIC_GUIDE_RESPONSE_INSTRUCTION:"fixture instruction",AUTOMATIC_GUIDE_CALLS:{SCENE_GENERATION_DOUBLE_CHECK:{id:'double'},CHARACTER_LIST_AUDIT:{id:'audit'}},guidePlayModeRef:{current:false},guideUseTargetRef:{current:null},formatNavigationHistory:()=>'',conversationMeasurementHeaders:()=>({})};
  Object.assign(bindings,require('./loadTs.cjs')('src/conciergeAnnouncements.ts'),{
   autoControlRequestContext:()=>({}),clearPendingAutoControlUserTurn(){},automaticGuideControllersRef:{current:new Map()},
   announcementsRef:{current:new (require('./loadTs.cjs')('src/conciergeAnnouncements.ts').AnnouncementLedger)()},
   observeCurrentAppSnapshot:()=>payload.userSnapshot,automaticSpeechCancelRef:{current:null},
  });
  const fn=callback(file,name,bindings);
  return {memory,status,requests,deltas,finals,memoryWrites,payload,history:()=>history,run:(signal,options)=>fn('ok',signal,{onTextDelta:d=>deltas.push(d),onFinalText:t=>finals.push(t)},options)};
 }
 test(name+': retains memory synchronization and payload, finishes short reply while provider status is hung',async()=>{
  const f=fixture([{type:'delta',text:'OK.'},{type:'done'}]);const work=f.run();await Promise.resolve();assert.equal(f.requests.length,0);f.memory.resolve();
  assert.equal(await Promise.race([work,new Promise((_,reject)=>setTimeout(()=>reject(Error('voice waited for provider status')),300))]),'OK.');
  assert.deepEqual(f.requests[0].memorySlots,f.payload.memorySlots);assert.deepEqual(f.requests[0].userSnapshot,f.payload.userSnapshot);assert.deepEqual(f.requests[0].sessionIdentity,f.payload.sessionIdentity);assert.equal(f.requests[0].conversationModel,'unchanged');assert.deepEqual(f.finals,['OK.']);assert.equal(f.history().at(-1).streaming,false);
 });
 test(name+': repeated SSE event identity publishes and speaks one paragraph',async()=>{
  const f=fixture([{type:'delta',eventId:'turn:1',text:'The reference is ready.'},{type:'delta',eventId:'turn:1',text:'The reference is ready.'},{type:'done'}]);
  f.memory.resolve();assert.equal(await f.run(),'The reference is ready.');assert.deepEqual(f.deltas,['The reference is ready.']);assert.deepEqual(f.finals,['The reference is ready.']);assert.equal(f.history().at(-1).content,'The reference is ready.');
 });
 test(name+': interrupted stream remains visible and speakable, without repeating the request',async()=>{
  const f=fixture([{type:'delta',text:'Here is the answer.'},{type:'error'}]);f.memory.resolve();const reply=await f.run();assert.match(reply,/Here is the answer.*interrupted/);assert.equal(f.requests.length,1);assert.equal(f.deltas.join(''),reply);assert.equal(f.history().at(-1).content,reply);assert.equal(f.memoryWrites.length,0);
 });
 if(name==='fullAppVoiceAsk') test('automatic guide stream failure remains a failure',async()=>{const f=fixture([{type:'error'}]);f.memory.resolve();assert.equal(await f.run(undefined,{automaticGuideCallId:'test-guide'}),'');assert.equal(f.finals.length,0);assert.equal(f.memoryWrites.length,0);});
 test(name+': failed stream without text gives a speakable failure',async()=>{
  const f=fixture([{type:'error'}]);f.memory.resolve();assert.match(await f.run(),/interrupted/);assert.equal(f.requests.length,1);
 });
}
for(const cancellation of ['stop','new turn','new playback']) test('TTS audio resume cannot revive speech after '+cancellation,async()=>{
 const audio=pending(),closedRef={current:false},ttsRunIdRef={current:1},voiceTurnIdRef={current:1};let fetched=false;
 const fn=callback('src/hooks/useGeminiVoice.ts','sendReplyForTts',{cleanTtsChunkText:s=>s,closedRef,ttsRunIdRef,voiceTurnIdRef,ensureOutputContext:()=>audio.promise,fetch:()=>{fetched=true;throw Error('unexpected TTS');}});
 const work=fn('stale answer');if(cancellation==='stop')closedRef.current=true;else if(cancellation==='new turn')voiceTurnIdRef.current++;else ttsRunIdRef.current++;audio.resolve();await work;assert.equal(fetched,false);
});
function voiceTurnFixture() {
 const refs={};const source=fs.readFileSync('src/hooks/useGeminiVoice.ts','utf8');
 for(const [,name] of source.matchAll(/\b(\w+Ref)\.current\b/g))refs[name]={current:null};
 Object.assign(refs,{voiceTurnIdRef:{current:0},ttsRunIdRef:{current:0},closedRef:{current:false},recentTranscriptNormsRef:{current:new Map()}});
 refs.automaticSpeechRef.current=new (require('./loadTs.cjs')('src/conciergeAnnouncements.ts').AutomaticSpeechQueue)();
 const requests=[],spoken=[];const noop=()=>{};
 const fn=callback('src/hooks/useGeminiVoice.ts','processTranscript',{
 ...refs,window:{clearTimeout:noop},L:noop,normalizeTranscript:s=>s.toLowerCase(),setError:noop,setStatus:noop,setInputReceipt:noop,setAcceptedSpeechPending:noop,
 clearTtsInterruptionRecovery:noop,clearSavedRetry:noop,clearCurrentAudioCapture:noop,hasAudiblePlayback:()=>false,
 stopPlayback:()=>refs.ttsRunIdRef.current++,restoreTtsVolume:noop,cleanTtsChunkText:s=>s.trim(),
 takeNextTtsSpeechChunk:(s,force)=>force&&s.trim()?{chunk:s,rest:''}:null,
 finishTtsRun:async()=>{},sendReplyForTts:async(s)=>spoken.push(s),
 callBrain:(text,signal,stream)=>{const done=pending();requests.push({text,signal,stream,done});return done.promise;},
 });return {fn,refs,requests,spoken};
}
test('short streamed reply speaks once on completion',async()=>{
 const f=voiceTurnFixture();const work=f.fn('ok','text');f.requests[0].stream.onTextDelta('OK.');assert.deepEqual(f.spoken,[]);f.requests[0].done.resolve('OK.');await work;await new Promise(r=>setImmediate(r));assert.deepEqual(f.spoken,['OK.']);
});
test('new typed turn cancels old answer and late callbacks cannot speak it',async()=>{
 const f=voiceTurnFixture();const old=f.fn('old question','text');const fresh=f.fn('new question','text');assert.equal(f.requests[0].signal.aborted,true);
 f.requests[0].stream.onTextDelta('Old answer.');f.requests[0].stream.onFinalText('Old answer.');f.requests[0].done.resolve('Old answer.');await old;
 f.requests[1].stream.onTextDelta('New answer.');f.requests[1].done.resolve('New answer.');await fresh;await new Promise(r=>setImmediate(r));assert.deepEqual(f.spoken,['New answer.']);
});
test('accepted production input discards a pending automatic announcement',async()=>{
 const f=voiceTurnFixture();f.refs.automaticSpeechRef.current.offer('Old automatic update',()=>true);
 const work=f.fn('New direct request','text');const automatic=[];
 await f.refs.automaticSpeechRef.current.flush(async text=>{automatic.push(text);return true;});assert.deepEqual(automatic,[]);
 f.requests[0].done.resolve('New answer.');await work;
});
test('bubble Play speaks the existing reply and Pause stops speech',()=>{
 const calls=[];const bindings={cancelAutoOffTimer:()=>{},guidePlayMode:false,latestAiReply:'Existing bubble answer',setGuidePlayMode:v=>calls.push(['mode',v]),speakText:t=>calls.push(['speak',t]),stopSpeech:()=>calls.push(['stop'])};
 callback('src/components/GlobalBrainstormGuide.tsx','handlePlay',bindings)();
 assert.deepEqual(calls,[['mode',true],['speak','Existing bubble answer']]);calls.length=0;
 callback('src/components/GlobalBrainstormGuide.tsx','handlePlay',{...bindings,guidePlayMode:true})();assert.deepEqual(calls,[['mode',false],['stop']]);
});
test('explicit bubble playback is allowed when microphone session is stopped',async()=>{
 const requests=[];const closedRef={current:true};const names=['ttsRunIdRef','voiceTurnIdRef','ttsKnownResponseTextRef','ttsCurrentChunkTextRef','ttsSpokenTextRef','currentTtsTextNormRef','lastTtsTextNormRef','audioChunksRef','ttsAbortRef','ttsSpeakingRef'];const refs=Object.fromEntries(names.map(n=>[n,{current:0}]));
 const send=callback('src/hooks/useGeminiVoice.ts','sendReplyForTts',{...refs,closedRef,drainAutomaticSpeechRef:{current:()=>{}},cleanTtsChunkText:s=>s,normalizeTranscript:s=>s,ensureOutputContext:async()=>{},stopPlayback:()=>refs.ttsRunIdRef.current++,restoreTtsVolume:()=>{},L:()=>{},ttsVoiceRef:{current:'fixture'},clikUrl:'/api',setTtsDelivery:delivery=>assert.equal(delivery.actualVoice,'fixture'),setStatus:()=>{},setError:message=>assert.fail(message),store:{getState:()=>({settings:{conversationModel:'luna'},profile:{loggedUser:{id:7}}})},CONVERSATION_PROFILE_POLICY_VERSION:'fixture-policy',conversationMeasurementHeaders:()=>({}),fetch:async(url,options)=>{assert.ok(url.endsWith('/voiceTtsStream'));requests.push(JSON.parse(options.body));return new Response(new Uint8Array());},finishTtsRun:async()=>{}});
 const speak=callback('src/hooks/useGeminiVoice.ts','speakText',{sendReplyForTts:send,automaticSpeechRef:{current:{cancel(){}}}});await speak('Existing bubble answer');assert.equal(closedRef.current,false);assert.equal(requests.length,1);assert.equal(requests[0].text,'Existing bubble answer');
});
