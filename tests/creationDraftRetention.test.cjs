const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const filename = path.resolve(root,file), mod = new Module(filename,module);
  mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
  mod.require=name=>Object.hasOwn(mocks,name)?mocks[name]:Module.prototype.require.call(mod,name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);
  return mod.exports;
}
const retention=load('server/src/creationDrafts/retention.ts',{'../execQuery':{default:()=>{throw Error('No external database access permitted');}}});
const auth=load('server/src/creationDrafts/auth.ts');
const url=key=>`s3://app-bucket/${key}`;

test('draft deletion preserves shared track/World/library references while owning generated outputs',async()=>{
  const removed=[];
  const query=async(sql,args)=>{
    if(sql.startsWith('SELECT job_id'))return [];
    if(sql.startsWith('SELECT draft_id FROM creation_drafts'))return [{draft_id:'draft-own'}];
    if(sql.startsWith('SELECT asset_hash,asset_url'))return ['generated.png','world.png','song.mp3','shared.mp4'].map(key=>({asset_hash:key,asset_url:url(key)}));
    if(sql.includes('asset_hash=? AND draft_id<>?'))return args[0]==='shared.mp4'?[{draft_id:'other-draft'}]:[];
    if(sql.startsWith('SELECT id FROM music'))return args[0].includes('song.mp3')?[{id:1}]:[];
    if(sql.startsWith('SELECT id FROM world_models'))return args[0].includes('world.png')?[{id:2}]:[];
    if(sql.startsWith('SELECT'))return [];
    removed.push(sql);return {affectedRows:1};
  };
  const cleanup=await retention.creationDraftDeletion(query,7);
  assert.deepEqual(cleanup.urls,[url('generated.png')]);
  assert.equal(removed.length,0);
  await cleanup.finish();
  assert.ok(removed.some(sql=>sql==='DELETE FROM creation_drafts WHERE post_id=?'));
  assert.equal(removed.some(sql=>sql.includes('source_post_id')),false,'Deleting source must never cascade to independently owned forks');
});

test('explicit deletion refuses active source and target copy jobs before media ownership can be removed',async()=>{
  const sqls=[];
  await assert.rejects(retention.creationDraftDeletion(async(sql,args)=>{sqls.push(sql);assert.deepEqual(args,[7,7]);return [{job_id:'active'}];},7),/copied/);
  assert.match(sqls[0],/source_post_id=\? OR post_id=\?/);
  assert.equal(sqls.length,1);
});

test('retention checks fail closed on database failure but retain old-schema deletion compatibility',async()=>{
  const canonical=url('selected.png');
  assert.equal(await retention.isCreationAssetRetained(canonical,async()=>[{draft_id:'owner'}]),true);
  assert.equal(await retention.isCreationAssetRetained(canonical,async()=>[]),false);
  assert.equal(await retention.isCreationAssetRetained(canonical,async()=>{throw Object.assign(Error('legacy'),{code:'ER_NO_SUCH_TABLE'});}),false);
  await assert.rejects(retention.isCreationAssetRetained(canonical,async()=>{throw Error('database offline');}),/offline/);
});

test('Guest draft scope is private, signed and cross-site compatible with production login',()=>{
  const oldSecret=process.env.SECRET_KEYY,oldState=process.env.APP_STATE;
  try {
    process.env.SECRET_KEYY='isolated-test-secret';
    for(const state of ['dev','prod']){
      process.env.APP_STATE=state;
      let cookie;
      const scope=auth.creationGuestScope({cookies:{}},{cookie(name,value,options){cookie={name,value,options};}},true);
      assert.match(scope,/^[a-f0-9]{64}$/);
      assert.equal(cookie.options.httpOnly,true);
      assert.equal(cookie.options.secure,state!=='dev');
      assert.equal(cookie.options.sameSite,state==='dev'?'lax':'none');
      assert.equal(auth.creationGuestScope({cookies:{[cookie.name]:cookie.value}}),scope);
      const changed=cookie.value.replace(/^./,cookie.value[0]==='a'?'b':'a');
      assert.equal(auth.creationGuestScope({cookies:{[cookie.name]:changed}}),null);
      assert.equal(auth.creationGuestScope({cookies:{}}),null);
    }
  }finally{
    if(oldSecret===undefined)delete process.env.SECRET_KEYY;else process.env.SECRET_KEYY=oldSecret;
    if(oldState===undefined)delete process.env.APP_STATE;else process.env.APP_STATE=oldState;
  }
});

function copyFixture({retained=false,fail=false,contentType='video/mp4'}={}){
  const source=fs.readFileSync(path.join(root,'server/src/S3Routes.ts'),'utf8');
  const ast=ts.createSourceFile('S3Routes.ts',source,ts.ScriptTarget.Latest,true);let declaration;
  ts.forEachChild(ast,node=>{if(ts.isFunctionDeclaration(node)&&node.name?.text==='copyCreationMediaObject')declaration=node;});
  const code=ts.transpileModule(declaration.getText(ast).replace(/^export /,''),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  class Head{constructor(input){this.input=input;this.kind='head';}}
  class Copy{constructor(input){this.input=input;this.kind='copy';}}
  const commands=[],assetId='a'.repeat(64);let copied=retained;
  const run=Function('postMediaStorageUrl','HeadObjectCommand','CopyObjectCommand','s3Client','BUCKET_NAME','getPublicS3Url','parseS3Uri','IMMUTABLE_VIDEO_CACHE_CONTROL',`${code};return copyCreationMediaObject;`)(
    value=>value==='https://app.test/source.mp4'?'s3://app-bucket/source.mp4':null,Head,Copy,
    {send:async command=>{commands.push(command);if(command.kind==='copy'){if(fail)throw Error('copy denied');copied=true;return {};}
      if(command.input.Key==='source.mp4')return {ContentLength:100,ContentType:contentType,ETag:'"original"',Metadata:{author:'test'}};
      if(copied)return {ContentLength:100,Metadata:{creation_copy_source:assetId}};
      throw Object.assign(Error('not found'),{name:'NotFound'});
    }},'app-bucket',key=>`https://app.test/${key}`,uri=>({Bucket:'app-bucket',Key:uri.split('/').at(-1)}),'public,max-age=31536000');
  return {run,commands,assetId};
}

test('authorized remix copy creates a verified independent key without changing the source and reuses verified retry copies',async()=>{
  const f=copyFixture(),copied=await f.run('https://app.test/source.mp4','creation:new',f.assetId);
  const command=f.commands.find(command=>command.kind==='copy');
  assert.equal(command.input.CopySource,'app-bucket/source.mp4');
  assert.equal(command.input.CopySourceIfMatch,'"original"');
  assert.match(command.input.Key,/^creation\/creation_new\//);
  assert.notEqual(command.input.Key,'source.mp4');
  assert.equal(command.input.ContentType,'video/mp4');assert.equal(command.input.ACL,'private');
  assert.ok(copied.includes(command.input.Key));
  const retry=copyFixture({retained:true});await retry.run('https://app.test/source.mp4','creation:new',retry.assetId);
  assert.equal(retry.commands.some(command=>command.kind==='copy'),false);
  await assert.rejects(f.run('https://untrusted.test/arbitrary.mp4','creation:new',f.assetId),/Invalid stored/);
  const audio=copyFixture({contentType:'audio/mpeg'});await audio.run('https://app.test/source.mp4','creation:audio',audio.assetId);
  assert.equal(audio.commands.find(command=>command.kind==='copy').input.ACL,'public-read','Remix audio remains GET-able like ordinary stored narration/music');
});
