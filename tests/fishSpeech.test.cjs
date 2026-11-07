const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const load=require('./loadTs.cjs');
const {FISH_VOICES,DEFAULT_FISH_VOICE}=load('server/src/fishVoiceCatalog.ts');
const {streamFishSpeech,FishSpeechError}=load('server/src/FishSpeech.ts');
process.env.FISH_KEY='test-key-not-real';
const pcm=Buffer.alloc(48,3),mp3=Buffer.concat([Buffer.from('ID3'),Buffer.alloc(30)]);
const response=(parts,mime='audio/pcm')=>new Response(new ReadableStream({start(c){parts.forEach(p=>c.enqueue(p));c.close();}}),{headers:{'Content-Type':mime}});

test('shared catalogue has thirty distinct real voice identities, independent of previews',()=>{
 assert.equal(FISH_VOICES.length,30);assert.equal(new Set(FISH_VOICES.map(v=>v.referenceId)).size,30);
 assert.ok(FISH_VOICES.every(v=>v.id==='fish_'+v.referenceId&&/^[a-f0-9]{32}$/.test(v.referenceId)&&v.fallbackGemini));
 assert.ok(FISH_VOICES.some(v=>v.tags.includes('old')));assert.ok(FISH_VOICES.some(v=>/child/i.test(v.name)));
});
test('PCM streaming preserves exact bytes across split prefixes and requests explicit paid model/24kHz',async()=>{
 const out=[];let body;
 const stats=await streamFishSpeech({voiceId:DEFAULT_FISH_VOICE,text:'Hello 🌍',format:'pcm',fetcher:async(_url,init)=>{
  body=JSON.parse(init.body);assert.equal(init.headers.model,'s2.1-pro');return response([pcm.subarray(0,5),pcm.subarray(5,13),pcm.subarray(13)]);
 }},b=>out.push(b));
 assert.deepEqual(Buffer.concat(out),pcm);assert.equal(body.sample_rate,24000);assert.equal(body.format,'pcm');
 assert.equal(stats.inputBytes,Buffer.byteLength('Hello 🌍'));assert.equal(stats.audioBytes,pcm.length);
});
test('a WAV header split across chunks is rejected before delivery',async()=>{
 const out=[];await assert.rejects(streamFishSpeech({voiceId:DEFAULT_FISH_VOICE,text:'Test',format:'pcm',fetcher:async()=>response([Buffer.from('RI'),Buffer.from('FF1234WAVE123456')])},b=>out.push(b)),/container/);assert.deepEqual(out,[]);
});
test('MP3 preview uses the actual MP3 payload; failures and unknown voices never become audio',async()=>{
 const out=[];await streamFishSpeech({voiceId:DEFAULT_FISH_VOICE,text:'Test',format:'mp3',fetcher:async()=>response([mp3],'audio/mpeg')},b=>out.push(b));assert.deepEqual(Buffer.concat(out),mp3);
 await assert.rejects(streamFishSpeech({voiceId:'fish_missing',text:'Test',format:'pcm'},()=>assert.fail()),/Unknown Fish/);
 await assert.rejects(streamFishSpeech({voiceId:DEFAULT_FISH_VOICE,text:'Test',format:'pcm',fetcher:async()=>new Response('{}',{headers:{'Content-Type':'application/json'}})},()=>assert.fail()),/unexpected audio format/);
});
test('first-audio timeout aborts the actual fetch and caller cancellation aborts streaming',async()=>{
 let aborted=false;
 await assert.rejects(streamFishSpeech({voiceId:DEFAULT_FISH_VOICE,text:'Test',format:'pcm',firstAudioTimeoutMs:15,
  fetcher:async(_url,init)=>new Promise((_,reject)=>init.signal.addEventListener('abort',()=>{aborted=true;reject(Error('Aborted'));}))},()=>assert.fail()),/timed out/);
 assert.equal(aborted,true);
 const abort=new AbortController();let delivered=0;
 await assert.rejects(streamFishSpeech({voiceId:DEFAULT_FISH_VOICE,text:'Test',format:'pcm',signal:abort.signal,
  fetcher:async()=>response([pcm,pcm])},()=>{delivered++;abort.abort();}),FishSpeechError);
 assert.equal(delivered,1);
});

function routeFixture(){
 const records=[],fishRecords=[];let googleCalls=0;
 const ai={recordProviderUsage:u=>records.push(u),recordUsageEvent(){},recordUsagePixelBalance(){},recordPixelCharge(){},
  verifyConversationSessionOwnership:()=>true,getRememberedSessionConversationProfile:()=>null,PIXEL_USD:1/333};
 const config={resolveConversationProfile:()=>({tier:'luna'}),resolveAdmittedConversationProfile:()=>({tier:'luna'}),isPaidConversationProfile:()=>false,extractConversationPolicyVersion:()=>1};
 class GoogleGenAI{constructor(){this.models={generateContentStream:async()=>{googleCalls++;return(async function*(){yield{candidates:[{content:{parts:[{inlineData:{data:pcm.toString('base64')}}]}}],usageMetadata:{promptTokenCount:4,candidatesTokenCount:2}};})();}};}}
 const api=load('server/src/VoiceTts.ts',{'@google/genai':{GoogleGenAI,Modality:{AUDIO:'AUDIO'}},'./aiUsageLedger':ai,'./requestAuth':{authenticatedUserId:()=>null},'./conversationModels':config,
 './FishUsage':{recordFishSpeechUsage:s=>fishRecords.push({...s})}});
 process.env.GOOGLE_TTS_KEY='test-key-not-real';
 const res=new EventEmitter();Object.assign(res,{headersSent:false,writableEnded:false,headers:{},parts:[],code:200,
  setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(data){this.data=data;this.writableEnded=true;return this;},
  write(b){this.headersSent=true;this.parts.push(Buffer.from(b));return true;},end(){this.writableEnded=true;},destroy(){this.destroyed=true;this.writableEnded=true;this.emit('close');}});
 return{api,res,records,fishRecords,googleCalls:()=>googleCalls,run:voice=>api.voiceTtsStreamRoute({body:{text:'Hello',voice},headers:{}},res)};
}
test('Fish success keeps the client PCM contract and never constructs Gemini speech',async()=>{
 const f=routeFixture(),original=global.fetch;global.fetch=async()=>response([pcm]);
 try{await f.run(DEFAULT_FISH_VOICE);}finally{global.fetch=original;}
 assert.deepEqual(Buffer.concat(f.res.parts),pcm);assert.equal(f.googleCalls(),0);assert.equal(f.res.headers['X-TTS-Engine'],'fish');assert.equal(f.res.headers['X-Audio-Sample-Rate'],'24000');assert.equal(f.fishRecords.length,1);
});
test('Fish early error asks for manual voice selection; Gemini IDs skip Fish entirely',async()=>{
 for(const voice of [DEFAULT_FISH_VOICE,'Puck']){
  const f=routeFixture(),original=global.fetch;let fishCalls=0;global.fetch=async()=>{fishCalls++;return new Response('',{status:503});};
  try{await f.run(voice);}finally{global.fetch=original;}
  assert.equal(fishCalls,voice==='Puck'?0:1);
  if(voice==='Puck'){assert.equal(f.googleCalls(),1);assert.deepEqual(Buffer.concat(f.res.parts),pcm);}
  else {assert.equal(f.googleCalls(),0);assert.equal(f.res.code,503);assert.equal(f.res.data.code,'FISH_SPEECH_UNAVAILABLE');assert.equal(f.res.parts.length,0);}
 }
});
test('mid-audio failure closes with an error and never replays the utterance under Gemini',async()=>{
 const f=routeFixture(),original=global.fetch;global.fetch=async()=>new Response(new ReadableStream({start(c){c.enqueue(pcm);},pull(c){c.error(Error('upstream drop'));}}),{headers:{'Content-Type':'audio/pcm'}});
 try{await f.run(DEFAULT_FISH_VOICE);}finally{global.fetch=original;}
 assert.equal(f.res.parts.length,1);assert.equal(f.googleCalls(),0);assert.equal(f.res.destroyed,true);assert.equal(f.fishRecords.length,1);
});
test('client disconnect during Fish delivery stops without Gemini or duplicate accounting',async()=>{
 const f=routeFixture(),original=global.fetch,write=f.res.write;
 f.res.write=function(b){write.call(this,b);this.emit('close');return true;};global.fetch=async()=>response([pcm,pcm]);
 try{await f.run(DEFAULT_FISH_VOICE);}finally{global.fetch=original;}
 assert.equal(f.res.parts.length,1);assert.equal(f.googleCalls(),0);assert.equal(f.fishRecords.length,1);
});
