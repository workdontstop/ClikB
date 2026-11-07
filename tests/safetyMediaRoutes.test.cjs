const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {normalizeSafetyMediaInput,safetyOutputLocation,safetyAudioRemuxJob}=require('../server/src/safetyMediaJobs.ts');
const {createSafetyMediaHandlers}=require('../server/src/safetyMediaRoutes.ts');
const response=()=>({code:200,body:undefined,status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
test('S3 media normalization preserves dotted buckets, paths and external HTTPS sources',()=>{
 assert.equal(normalizeSafetyMediaInput('https://my.bucket.s3.us-east-1.amazonaws.com/a%20file.mp4?token=x'),'s3://my.bucket/a file.mp4');
 assert.equal(normalizeSafetyMediaInput('https://s3.us-east-1.amazonaws.com/my-bucket/media/file.mp4'),'s3://my-bucket/media/file.mp4');
 assert.equal(normalizeSafetyMediaInput('https://bucket.s3.amazonaws.com/media/file.mp4'),'s3://bucket/media/file.mp4');
 assert.equal(normalizeSafetyMediaInput('https://cdn.example.com/media/file.mp4?token=x'),'https://cdn.example.com/media/file.mp4?token=x');
 for(const bad of[undefined,{},'file:///x','ftp://example.com/x','https://user:secret@example.com/x','s3://bucket/'])assert.throws(()=>normalizeSafetyMediaInput(bad));
});
test('explicit MediaConvert destination basename and public URL agree without guessing input name',()=>{
 const out=safetyOutputLocation('s3://bucket/media outputs/','reference-audio-id','mp3','us-east-1');
 assert.equal(out.destination,'s3://bucket/media outputs/reference-audio-id');
 assert.equal(out.url,'https://bucket.s3.us-east-1.amazonaws.com/media%20outputs/reference-audio-id.mp3');
});
test('remux uses only original external audio and preserves zero-offset/default gain',()=>{
 const job=safetyAudioRemuxJob('s3://bucket/video.mp4','s3://bucket/audio.mp3','s3://bucket/result','role');
 const input=job.Settings.Inputs[0],output=job.Settings.OutputGroups[0].Outputs[0];
 assert.equal(input.AudioSelectors['Original reference audio'].ExternalAudioFileInput,'s3://bucket/audio.mp3');
 assert.equal(input.AudioSelectors['Original reference audio'].Offset,0);
 assert.equal(Object.keys(input.AudioSelectors).length,1);assert.equal(output.AudioDescriptions.length,1);
 assert.equal(output.AudioDescriptions[0].RemixSettings,undefined);assert.equal(output.VideoDescription.VideoPreprocessors,undefined);
});
test('extract validates before submission, polls to completion and returns exact output URL',async()=>{
 const sent=[];let polls=0;
 const handlers=createSafetyMediaHandlers({send:async command=>{sent.push(command);return command.constructor.name==='CreateJobCommand'?{Job:{Id:'mock-job'}}:{Job:{Status:++polls===1?'PROGRESSING':'COMPLETE'}};},region:async()=> 'us-east-1',pause:async()=>{},id:()=> 'test-id'});
 const invalid=response();await handlers.extract({body:{videoUrl:{bad:true}}},invalid);assert.equal(invalid.code,400);assert.equal(sent.length,0);
 const res=response();await handlers.extract({body:{videoUrl:'https://s3.us-east-1.amazonaws.com/bucket/test.mp4'}},res);
 assert.equal(res.code,200);assert.equal(res.body.jobId,'mock-job');assert.match(res.body.outputAudio,/reference-audio-test-id\.mp3$/);
 assert.equal(sent[0].input.Settings.Inputs[0].FileInput,'s3://bucket/test.mp4');assert.equal(polls,2);
});
test('failed remux returns the provider error without a nonexistent successful output',async()=>{
 const handlers=createSafetyMediaHandlers({send:async command=>command.constructor.name==='CreateJobCommand'?{Job:{Id:'failed-job'}}:{Job:{Status:'ERROR',ErrorMessage:'No audio track'}},region:async()=> 'us-east-1',pause:async()=>{},id:()=> 'test-id'});
 const res=response();await handlers.remux({body:{videoUrlx:'https://cdn.example.com/video.mp4',audioSourceUrl:'https://cdn.example.com/audio.mp3'}},res);
 assert.equal(res.code,500);assert.match(res.body.details,/No audio track/);assert.equal(res.body.outputVideo,undefined);
});
