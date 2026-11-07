const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('crypto'),load=require('./loadTs.cjs');
const {DEFAULT_FISH_VOICE}=load('server/src/fishVoiceCatalog.ts');
const {FishSpeechError}=load('server/src/FishSpeech.ts');
process.env.APP_STATE='dev';process.env.BUCKET_NAME='fixture-bucket';process.env.BUCKET_REGION='fixture-region';process.env.BUCKET_ACCESS_KEY='not-real';process.env.BUCKET_SECRET_KEY='not-real';
function fixture(){
 const rows=[],puts=[],calls=[];let generation=0,failSave=false,failGeneration=false;
 const query=async(sql,args=[])=>{
  calls.push({sql,args});if(sql.startsWith('CREATE TABLE'))return {};
  if(sql.includes('INSERT INTO')){if(failSave)throw Error('offline DB');if(!rows.some(r=>r.request_id===args[1]))rows.push({id:args[0],request_id:args[1],voice_id:args[2],s3_key:args[9],s3_url:args[10],created_by:args[12]});return {};}
  if(sql.includes('WHERE request_id=?'))return rows.filter(r=>r.request_id===args[0]&&r.created_by===args[1]);
  return rows;
 };
 class S3Client{async send(cmd){puts.push(cmd.input);}}
 class Command{constructor(input){this.input=input;}}
 const api=load('server/src/FishVoicePreviews.ts',{'./execQuery':{__esModule:true,default:query},'./requestAuth':{authenticatedUserId:req=>req.testUser||null},
  '@aws-sdk/client-s3':{S3Client,PutObjectCommand:Command,GetObjectCommand:Command},'@aws-sdk/s3-request-presigner':{getSignedUrl:async()=> 'https://fixture.s3/signed-preview'},
  './FishUsage':{recordFishSpeechUsage(){}},'./FishSpeech':{FishSpeechError,streamFishSpeech:async(opts,deliver)=>{generation++;await new Promise(r=>setImmediate(r));if(failGeneration)throw new FishSpeechError('Fish speech HTTP 402',{accepted:false});deliver(Buffer.from('ID3fixture-audio'));return{model:'s2.1-pro'};}}});
 const res=()=>({code:200,status(c){this.code=c;return this;},json(d){this.data=d;return this;},setHeader(){}});
 const req=body=>({testUser:'7',body,socket:{remoteAddress:'127.0.0.1'},get:()=> 'http://localhost:5173'});
 const generate=async body=>{const r=res();await api.generateFishPreviewRoute(req(body),r);return r;};
 const save=async id=>{const r=res();await api.saveFishPreviewRoute(req({draftId:id}),r);return r;};
 return{api,rows,puts,calls,req,res,generate,save,get generation(){return generation;},set failSave(v){failSave=v;},set failGeneration(v){failGeneration=v;}};
}
test('server refuses preview mutations outside developer mode or without an authenticated/local developer',()=>{
 const f=fixture();process.env.APP_STATE='production';assert.throws(()=>f.api.fishPreviewDeveloper(f.req({})),/unavailable/);process.env.APP_STATE='dev';
 assert.throws(()=>f.api.fishPreviewDeveloper({...f.req({}),testUser:null}),/Sign in/);
 assert.throws(()=>f.api.fishPreviewDeveloper({...f.req({}),socket:{remoteAddress:'192.0.2.1'}}),/not allowed/);
 assert.throws(()=>f.api.fishPreviewDeveloper({...f.req({}),get:()=> 'https://untrusted.example'}),/origin/);
});
test('opening the catalogue reads stored data and never generates speech; voices remain selectable without previews',async()=>{
 const f=fixture(),r=f.res();await f.api.fishVoiceListRoute(f.req({}),r);
 assert.equal(r.data.voices.length,30);assert.equal(f.generation,0);assert.ok(r.data.voices.every(v=>v.id&&v.referenceId));assert.equal(f.puts.length,0);
});
test('concurrent Generate requests share one paid result and Save persists S3 URL without generating again',async()=>{
 const f=fixture(),id=randomUUID(),body={requestId:id,voiceId:DEFAULT_FISH_VOICE,text:'Hello',direction:'Warm'};
 const [a,b]=await Promise.all([f.generate(body),f.generate(body)]);assert.equal(a.code,200);assert.equal(b.code,200);assert.equal(f.generation,1);assert.equal(f.rows.length,0);assert.equal(f.puts.length,0);
 const [first,second]=await Promise.all([f.save(id),f.save(id)]);assert.equal(first.code,200);assert.equal(second.data.id,first.data.id);assert.equal(f.generation,1);assert.equal(f.puts.length,1);assert.equal(f.puts[0].ContentType,'audio/mpeg');
 assert.equal(f.rows.length,1);assert.match(f.rows[0].s3_url,/^https:\/\/fixture-bucket\.s3\.fixture-region\.amazonaws\.com\/fish-voice-previews\//);assert.equal(f.rows[0].s3_url.includes('?'),false);
 const list=f.res();await f.api.fishVoiceListRoute(f.req({}),list);assert.equal(list.data.voices.find(v=>v.id===DEFAULT_FISH_VOICE).previewUrl,'https://fixture.s3/signed-preview');assert.equal(f.generation,1);
 assert.equal((await f.save(id)).data.alreadySaved,true);
});
test('failed persistence retains a retryable draft and leaves the previous active sample intact',async()=>{
 const f=fixture(),id=randomUUID();await f.generate({requestId:id,voiceId:DEFAULT_FISH_VOICE,text:'Original'});
 f.failSave=true;const failed=await f.save(id);assert.equal(failed.code,503);assert.equal(f.rows.length,0);assert.equal(f.generation,1);
 f.failSave=false;assert.equal((await f.save(id)).code,200);assert.equal(f.generation,1);assert.equal(f.rows.length,1);
});
test('Save cannot upload arbitrary client bytes/URLs or use an expired/foreign draft',async()=>{
 const f=fixture();assert.equal((await f.save(randomUUID())).code,409);assert.equal(f.puts.length,0);
 const r=f.res();await f.api.saveFishPreviewRoute(f.req({draftId:'https://untrusted.example/audio.mp3',audioContent:'forged'}),r);assert.equal(r.code,400);assert.equal(f.puts.length,0);
});

test('unfunded Fish generation fails explicitly without saving an empty or Gemini preview',async()=>{
 const f=fixture(),id=randomUUID();f.failGeneration=true;
 const r=await f.generate({requestId:id,voiceId:DEFAULT_FISH_VOICE,text:'Hello'});
 assert.equal(r.code,502);assert.match(r.data.message,/Fish preview generation failed/);
 assert.equal(f.generation,1);assert.equal(f.rows.length,0);assert.equal(f.puts.length,0);
 assert.equal((await f.save(id)).code,409);
});
