const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), ts = require('typescript'), Module = require('node:module');
function load(file, mocks = {}, cache = new Map()) {
  const filename = path.resolve(__dirname, '..', file); if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module); cache.set(filename, mod); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.') ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(filename), name + '.ts')), mocks, cache) : Module.prototype.require.call(mod, name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename); return mod.exports;
}
const audio = { url: 'https://assets.test/leaper.mp3', sourceUrl: 'https://assets.test/original.mp3', name: 'Leaper', duration: 5, enabled: true };
test('sound references validate duration changes and stay independent of lip-sync dialogue', () => {
 const api = load('server/src/audioReference.ts'); assert.deepEqual(api.validateAudioReference(audio, 5), audio);
 assert.throws(() => api.validateAudioReference(audio, 3), /Trim/); assert.throws(() => api.validateAudioReference({...audio,url:'javascript:alert(1)'}, 5));
 assert.equal(api.validateAudioReference(null,5),undefined); assert.match(api.audioReferencePrompt('[Audio1]'), /Do not infer dialogue or force lip-sync/);
 assert.equal(api.validateAudioReference({...audio,start:3.25},5).start,3.25);assert.throws(()=>api.validateAudioReference({...audio,start:-1},5));
});
test('spatial providers receive sound references alongside exact start and motion evidence when audio is enabled', () => {
 const {spatialVideoInput} = load('server/src/spatialVideoSpec.ts');
 const job = {prompt:'The leaper approaches.',promptVersion:2,kind:'action',duration:5,startAnchor:'https://assets.test/exact.png',endAnchor:'https://assets.test/end.png',referenceVideo:'https://assets.test/motion.mp4',audioReference:audio};
 for (const model of ['Pro','Minix','SeedanceMini','pPro','Proxxx']) {
  const input=spatialVideoInput(model,job,'720p','9:16',true); assert.deepEqual(input[model==='Proxxx'?'reference_audio_urls':'reference_audios'],[audio.url]);
  assert.equal(input[model==='Proxxx'?'reference_image_urls':'reference_images'][0],job.startAnchor);assert.doesNotMatch(input.prompt,/Silent video/);assert.match(input.prompt,/sound character/);if(model!=='Proxxx')assert.equal(input.generate_audio,true);
 }
 const input=spatialVideoInput('Pro',{...job,audioReference:{...audio,enabled:false}},'720p','9:16',false);assert.equal(input.reference_audios,undefined);assert.match(input.prompt,/Silent video/);
});
test('successful saves protect every retained media URL in all cleanup lists while keeping unrelated temporary files', () => {
 const store=new Map(),previous=global.localStorage;global.localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
 try {const {ProtectSavedMediaFromDeleteLater}=load('src/SavepromptHelpersLocal.ts');
  for(const key of ['helperimagesprompt','helpervideosprompt','helperaudiosprompt'])store.set(key,JSON.stringify([audio.url,audio.sourceUrl,'https://assets.test/held.png','https://assets.test/history.mp4','https://assets.test/unused.mp3'].map(url=>({url,timestamp:0}))));
  ProtectSavedMediaFromDeleteLater({stages:[{ledger:{actionAudioReferences:{root:audio},states:{root:{objects:{unit:{assets:['https://assets.test/held.png?cache=v2']}}}},jobs:[{resultHistory:[{output:'https://assets.test/history.mp4'}]}]}}]});
  for(const list of store.values())assert.deepEqual(JSON.parse(list).map(entry=>entry.url),['https://assets.test/unused.mp3']);
 }finally{global.localStorage=previous;}
});
test('post deletion includes both original and trimmed sound references retained in drafts and histories', () => {
 const {collectPostDeletionMedia}=load('server/src/postDeletionMedia.ts');const urls=collectPostDeletionMedia({spatial_experience_json:{stages:[{scene:{ledger:{routes:{action:{forward:{audioReference:audio}}}}}}]}},[],value=>typeof value==='string'&&value.startsWith('https://assets.test/')?value:null);
 assert.deepEqual(new Set(urls),new Set([audio.url,audio.sourceUrl]));
});
test('MiniMax normal generation sends an actual sound reference without forcing music-video lyrics', async () => {
 const calls=[],{MiniMaxH3Route}=load('server/src/minimaxH3Route.ts',{'dotenv':{config(){}},'@fal-ai/client':{fal:{config(){},queue:{submit:async(endpoint,{input})=>{calls.push(input);return{request_id:'fixture'};}}}}});
 let status=200,result;await MiniMaxH3Route({body:{prompt:'The leaper jumps toward the raider.',startImage:'https://assets.test/frame.png',audioReferenceUrl:audio.url,videoLength:5,asyncMode:true}},{status(n){status=n;return this;},json(value){result=value;return this;}});
 assert.equal(status,200,JSON.stringify(result));assert.deepEqual(calls[0].reference_audio_urls,[audio.url]);assert.match(calls[0].prompt,/sound character/);assert.doesNotMatch(calls[0].prompt,/driving audio for lip-sync/);
});
test('each normal Seedance handler binds sound references and preserves the original music-video lip-sync directive', async () => {
 const vm=require('node:vm'),source=fs.readFileSync('server/src/fluxSchnellRoute.ts','utf8'),tree=ts.createSourceFile('flux.ts',source,ts.ScriptTarget.Latest,true);
 for(const name of ['sora2','seedance2Mini','Seedance2','klingProRoute']) {
  const node=tree.statements.find(item=>ts.isFunctionDeclaration(item)&&item.name?.text===name),calls=[];
  const code=ts.transpileModule(node.getText(tree),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const context={...require('./promptTestBindings.cjs'),exports:{},process:{env:{}},console:{log(){},error(){}},Replicate:class{predictions={create:async request=>{calls.push(request.input);return{id:'fixture'};}}},clamp:(n,min,max)=>Math.max(min,Math.min(max,n)),normalizeSeedanceResolution:()=> '720p',appendSpatialMovementReferences:(images,prompt)=>({enabled:false,prompt,usedReferenceEndFrame:false}),audioReference_1:load('server/src/audioReference.ts')};
  context.audioReferencePrompt=load('server/src/audioReference.ts').audioReferencePrompt;
  vm.runInNewContext(code,context);const res={statusCode:200,status(n){this.statusCode=n;return this;},json(value){this.body=value;return this;}};
  for(const sound of [true,false]){await context.exports[name]({body:{prompt:'Leaper approaches.',startImage:'https://assets.test/frame.png',videoLength:5,asyncMode:true,generateAudio:false,generate_audio:false,...(sound?{audioReferenceUrl:audio.url}:{lipSyncUrl:audio.url})}},res);assert.equal(res.statusCode,200,JSON.stringify(res.body));assert.equal(calls.at(-1).reference_audios[0],audio.url);if(sound){assert.match(calls.at(-1).prompt,/sound character/);assert.equal(calls.at(-1).generate_audio,true);}else assert.match(calls.at(-1).prompt,/driving audio for lip-sync/);}
  const before=calls.length;await context.exports[name]({body:{prompt:'Leaper approaches.',videoLength:5,asyncMode:true,audioReferenceUrl:audio.url}},res);
  assert.equal(res.statusCode,400);assert.match(res.body.error,/starting image or video reference/);assert.equal(calls.length,before);
 }
});
