const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(file) {
  const filename = path.resolve(root, file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module); cache.set(filename, mod);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = name => name.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`))) : Module.prototype.require.call(mod, name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const schema = load('server/src/creationDrafts/schema.ts');
const { createDraftRepository, remixPermissions, imageProjection } = load('server/src/creationDrafts/repository.ts');
const owner = { id: '7', development: false, guestScope: null };
const snapshot = (creationProjectId = 'creation:first') => ({ schemaVersion: 1, creationProjectId, creationType: 0,
  sections: { prompt: { prompt: 'A retained story', parsedKeyPoints: ['First beat'] }, storybook: {
    GeneratedText: ['A faithful image'], ImagesHdCloud: ['https://assets/image.png'], VideoArrayCloud: ['https://assets/clip.mp4'],
    autoDrawGuideData: [{ motion: { videoUrl: 'https://assets/motion.mp4', sourceFrameUrl: 'https://assets/image.png', plan: { action: 'turn' }, authoring: { media: { texture: 'https://assets/image.png' } } } }],
  } } });
function fixture(options = {}) {
  const state = { posts: [], drafts: [], operations: [], assets: [], jobs: [], nextId: 1, writes: [], copies: [] };
  const clone = value => structuredClone(value);
  const insert = (sql, args) => {
    const columns = /\(([^)]+)\)\s*VALUES/i.exec(sql)[1].split(',').map(x => x.trim());
    const tokens = /VALUES\s*\(([^)]+)\)/i.exec(sql)[1].split(',').map(x => x.trim());
    let index = 0;
    return Object.fromEntries(columns.map((column, n) => [column, tokens[n] === '?' ? args[index++] : /^'.*'$/.test(tokens[n]) ? tokens[n].slice(1,-1) : Number(tokens[n])]));
  };
  const update = (row, sql, args) => {
    const fields = /SET (.*?) WHERE/i.exec(sql)[1].split(','); let index = 0;
    for (const part of fields) { const [key, value] = part.split('='); row[key.trim()] = value.trim() === '?' ? args[index++] : /^'.*'$/.test(value.trim()) ? value.trim().slice(1,-1) : Number(value); }
  };
  const query = async (sql, args = []) => {
    if (/^(INSERT|UPDATE|DELETE)/.test(sql)) state.writes.push({ sql, args: clone(args) });
    if (sql === 'SELECT deleted_at FROM creative_profiles WHERE member_id=? FOR UPDATE') return [{ deleted_at: options.profileRemoved ? '2026-11-05' : null }];
    if (sql.startsWith('SELECT response FROM creation_draft_operations')) return clone(state.operations.filter(row => row.user_id === args[0] && row.creation_id === args[1] && row.operation_id === args[2]));
    if (sql.startsWith('SELECT d.*,p.sender')) {
      const row = state.drafts.find(row => row.post_id === args[0]), post = state.posts.find(row => row.id === args[0]);
      return row && post ? [clone({ ...row, sender: post.sender, video: post.video, allow_remix: post.allow_remix })] : [];
    }
    if (sql.startsWith('SELECT * FROM creation_drafts WHERE user_id')) return clone(state.drafts.filter(row => row.user_id === args[0] && row.creation_id === args[1]));
    if (sql.startsWith('SELECT') && sql.includes(' FROM posts WHERE id=')) return clone(state.posts.filter(row => row.id === args[0]));
    if (sql.startsWith('SELECT * FROM creation_remix_jobs WHERE user_id')) return clone(state.jobs.filter(row => row.user_id === args[0] && row.request_id === args[1]));
    if (sql.startsWith('SELECT * FROM creation_remix_jobs WHERE job_id')) return clone(state.jobs.filter(row => row.job_id === args[0] && (!args[1] || row.user_id === args[1])));
    if (sql.startsWith('INSERT INTO posts ')) { const row = insert(sql,args); row.id = state.nextId++; state.posts.push(row); return { insertId: row.id, affectedRows: 1 }; }
    if (sql.startsWith('INSERT INTO creation_drafts ')) { state.drafts.push({ preparation_state: 'ready', lifecycle: 'unpublished', ...insert(sql,args) }); return { affectedRows: 1 }; }
    if (sql.startsWith('INSERT INTO creation_draft_operations ')) { state.operations.push(insert(sql,args)); return { affectedRows: 1 }; }
    if (/^INSERT(?: IGNORE)? INTO creation_draft_assets /.test(sql)) { state.assets.push(insert(sql,args)); return { affectedRows: 1 }; }
    if (sql.startsWith('INSERT INTO creation_remix_jobs ')) { state.jobs.push({ status: 'preparing', ...insert(sql,args) }); return { affectedRows: 1 }; }
    if (sql.startsWith('UPDATE posts SET')) { update(state.posts.find(row => row.id === args.at(-1)), sql, args); return { affectedRows: 1 }; }
    if (sql.startsWith('UPDATE creation_drafts SET')) { update(state.drafts.find(row => row.draft_id === args.at(-1)), sql, args); return { affectedRows: 1 }; }
    if (sql.startsWith('UPDATE creation_remix_jobs SET')) { update(state.jobs.find(row => row.job_id === args.at(-1)), sql, args); return { affectedRows: 1 }; }
    if (sql.startsWith('DELETE FROM creation_draft_assets')) { state.assets = state.assets.filter(row => row.draft_id !== args[0]); return { affectedRows: 1 }; }
    throw new Error(`Unhandled fake query: ${sql}`);
  };
  const transaction = async work => { const before = clone(state); try { return await work(query); } catch (error) { Object.assign(state,before); throw error; } };
  const repo = createDraftRepository({ query, transaction, canonicalMedia: url => typeof url === 'string' && url.startsWith('https://assets/') ? `s3://assets/${url.slice(15)}` : null,
    copyMedia: async (source, creationId, assetId) => { state.copies.push(source); if (options.failCopy?.(source,state)) throw new Error('Copy interrupted'); return `https://assets/creation/${creationId}/${assetId}`; } });
  const save = (actor = owner, body = {}) => repo.checkpoint(actor, { creationProjectId: 'creation:first', saveId: 'save:first', expectedRevision: 0,
    action: 'images', snapshot: snapshot(), projection: { image1: 'https://assets/image.png', imageHd1: 'https://assets/image.png', txt1: 'First beat', GeneratedText1: 'A faithful image' }, ...body });
  return { state, repo, save };
}

test('a removed Creative Profile cannot finish a late draft or remix request', async () => {
  const child = { ...owner, id: '101', ownerId: owner.id };
  const { state, repo, save } = fixture({ profileRemoved: true });
  await assert.rejects(save(child), { status: 409, code: 'CREATIVE_PROFILE_REMOVED' });
  await assert.rejects(repo.prepareRemix(child, 1, 'remix:late'), { status: 409, code: 'CREATIVE_PROFILE_REMOVED' });
  assert.deepEqual(state.writes, []);
});

test('snapshot schema strips runtime/media exclusions and retains completed editable Motion Ref', () => {
  const input = snapshot(); input.sections.prompt.referenceVideoUrls = ['https://assets/manual.mp4'];
  input.sections.storybook.autoDrawGuideData[0].motion.liveDraft = { buildId: 'old-build' };
  input.sections.prompt.referenceImages = [{imageUrl:'https://assets/kept.png',isGenerating:true,isUpscaling:true,isUploading:true}];
  input.sections.prompt.queuedCastingPrompts = [{name:'stale running queue'}];
  input.sections.storybook.blob = 'blob:lost'; input.sections.prompt.spatialManifest = { old: true };
  const restored = schema.validateDraftSnapshot(input);
  assert.equal(restored.sections.prompt.referenceVideoUrls, undefined);
  assert.deepEqual(restored.sections.prompt.referenceImages,[{imageUrl:'https://assets/kept.png'}]);
  assert.equal(restored.sections.prompt.queuedCastingPrompts,undefined);
  assert.equal(restored.sections.prompt.spatialManifest, undefined);
  assert.equal(restored.sections.storybook.blob, null);
  assert.equal(restored.sections.storybook.autoDrawGuideData[0].motion.liveDraft, undefined);
  assert.deepEqual(restored.sections.storybook.autoDrawGuideData[0].motion.plan, { action: 'turn' });
  assert.throws(() => schema.validateDraftSnapshot({ ...input, schemaVersion: 2 }), /version/);
});

test('fresh image checkpoint creates one owned unpublished post, binds identity and deduplicates retry', async () => {
  const f = fixture(), first = await f.save(), retry = await f.save();
  assert.equal(first.go, retry.go); assert.equal(first.revision,1); assert.equal(f.state.posts.length,1);
  assert.equal(f.state.posts[0].sender,'7'); assert.equal(f.state.posts[0].video,100);
  assert.equal(f.state.drafts.length,1); assert.equal(f.state.operations.length,1);
  assert.ok(first.imageProjectionDigest.includes('First beat'));
  assert.ok(f.state.assets.length >= 3);
});

test('same save identity cannot be reused for different content and stale revisions cannot overwrite', async () => {
  const f = fixture(); await f.save();
  const changed = snapshot(); changed.sections.prompt.prompt = 'Changed';
  await assert.rejects(f.save(owner, { snapshot: changed }), error => error.code === 'SAVE_ID_REUSED');
  await assert.rejects(f.save(owner, { saveId: 'save:new', snapshot: changed }), error => error.code === 'DRAFT_CONFLICT');
  assert.equal(JSON.parse(f.state.drafts[0].snapshot).sections.prompt.prompt,'A retained story');
});

test('quiet context saves do not rewrite legacy post columns or lose the acknowledged image projection', async () => {
  const f = fixture(), first = await f.save(); f.state.writes.length = 0;
  const changed = snapshot(); changed.sections.storybook.PlanVid = { story: 'Video plan' };
  const saved = await f.save(owner,{ action:'quiet',saveId:'save:quiet',expectedRevision:1,postId:first.postId,snapshot:changed,projection:undefined });
  assert.equal(saved.revision,2); assert.equal(saved.imageProjectionDigest,first.imageProjectionDigest);
  assert.equal(f.state.writes.filter(row => row.sql.startsWith('UPDATE posts SET')).length,0);
});

test('read and checkpoint reject foreign owners, published source writes and cross-Guest sessions', async () => {
  const f = fixture(), first = await f.save();
  await assert.rejects(f.repo.read({ ...owner,id:'8' },first.postId), error => error.code === 'DRAFT_NOT_FOUND');
  f.state.posts[0].video=1;
  assert.equal((await f.repo.read(owner,first.postId)).published,true);
  await assert.rejects(f.save(owner,{saveId:'save:published',expectedRevision:1}), error => error.code === 'PUBLISHED_SOURCE');
  const g=fixture(), guest={id:'1',development:false,guestScope:'session-A'}, gsave=await g.save(guest);
  await assert.rejects(g.repo.read({...guest,guestScope:'session-B'},gsave.postId), error=>error.code==='DRAFT_NOT_FOUND');
  assert.equal((await g.repo.capabilities({...guest,guestScope:'session-B'},gsave.postId)).canResume,false);
});

test('image checkpoint mapping preserves Cinema A/B distinction and explicitly clears removed slots', () => {
  const projection=imageProjection({image1:'a',image2:'b',imageHd1:'hd-a',txt1:'one',txt2:'two'},1);
  assert.equal(projection.x1,'a'); assert.equal(projection.x1B,'b'); assert.equal(projection.x2,null);
  assert.equal(projection.xh1,'hd-a'); assert.equal(projection.xh1B,null);
  const shorts=imageProjection({image1:'short'},0); assert.equal(shorts.x1B,null);
});

test('registered owner and Guest development/production remix permissions follow the agreed matrix', () => {
  for (const [id,development,sourceOwner,allow,canRemix,canToggle] of [
    ['7',false,7,0,true,true], ['7',false,8,0,false,false], ['7',false,8,1,true,false],
    ['1',false,1,0,false,false], ['1',false,1,1,true,false], ['1',true,8,0,true,false], ['1',true,1,0,true,true],
  ]) { const actual=remixPermissions(sourceOwner,allow,{id,development,guestScope:null}); assert.equal(actual.canRemix,canRemix); assert.equal(actual.canToggleRemix,canToggle); }
});

test('independent remix reserves fresh IDs, copies each media object once, remaps nested values/JSON/cache keys and defaults Off', async () => {
  const f=fixture(), first=await f.save(); f.state.posts[0].video=1; f.state.posts[0].allow_remix=1;
  const original=JSON.parse(f.state.drafts[0].snapshot);
  original.sections.editor={dialogue:{[JSON.stringify({frame:'https://assets/image.png'})]:JSON.stringify({frame:'https://assets/image.png'})}};
  f.state.drafts[0].snapshot=JSON.stringify(original);
  const actor={...owner,id:'8'}, job=await f.repo.prepareRemix(actor,first.postId,'remix:first');
  assert.notEqual(job.post_id,first.postId); assert.notEqual(job.creation_id,original.creationProjectId);
  const ready=await f.repo.finishRemix(actor,job.job_id);
  assert.equal(ready.state,'ready'); assert.equal(ready.published,false);
  assert.equal(f.state.posts[1].allow_remix,0); assert.equal(f.state.posts[1].sender,'8');
  assert.equal(f.state.copies.filter(url=>url==='https://assets/image.png').length,1);
  assert.equal(JSON.stringify(ready.snapshot).includes('https://assets/image.png'),false);
  assert.equal(JSON.stringify(ready.snapshot).includes('https://assets/motion.mp4'),false);
  assert.equal(JSON.parse(f.state.drafts[0].snapshot).creationProjectId,original.creationProjectId);
  const retried=await f.repo.prepareRemix(actor,first.postId,'remix:first'); assert.equal(retried.post_id,job.post_id);
});

test('failed copy retains the same reserved remix and completed copy mapping for retry', async () => {
  let failed=false;
  const f=fixture({failCopy:source=>{if(source.endsWith('clip.mp4')&&!failed){failed=true;return true;}return false;}});
  const first=await f.save();f.state.posts[0].video=1;
  const job=await f.repo.prepareRemix(owner,first.postId,'remix:retry');
  await assert.rejects(f.repo.finishRemix(owner,job.job_id),/interrupted/);
  assert.equal(f.state.jobs[0].status,'failed');
  assert.equal(f.state.drafts[1].preparation_state,'preparing');
  const same=await f.repo.prepareRemix(owner,first.postId,'remix:retry');assert.equal(same.post_id,job.post_id);
  const ready=await f.repo.finishRemix(owner,job.job_id);assert.equal(ready.state,'ready');
  assert.equal(f.state.copies.filter(url=>url.endsWith('image.png')).length,1);
  assert.equal(f.state.posts.length,2);
});

test('typed quiet video projection retains an obsolete upscale without promoting it over the newer clip', async () => {
  const f=fixture(), first=await f.save();f.state.posts[0].xv1='https://assets/newer.mp4';
  const result=await f.save(owner,{action:'quiet',saveId:'save:upscale',expectedRevision:1,postId:first.postId,
    projection:{kind:'video',values:{postId:first.postId,type:0,mode:0,vid:'https://assets/hd.mp4',upscale:{sourceUrl:'https://assets/old.mp4',resolution:'2k',duration:5}}}});
  assert.equal(result.promoted,false);assert.equal(f.state.posts[0].xv1,'https://assets/newer.mp4');
  const context=JSON.parse(f.state.posts[0].kontext);assert.equal(context.upscales.xv1[0].videoUrl,'https://assets/hd.mp4');
});


test('scene deletion keeps remaining Cinema A/B, narration, history and editor bindings aligned over repeated resume', async () => {
  const { removeDraftScenes } = load('server/src/creationDrafts/topology.ts');
  const initial = snapshot(); initial.creationType = 1;
  initial.sections.prompt = { parsedKeyPoints: ['1A','1B','2A','2B','3A','3B'], generatedImagesFluxx: ['a','b','c','d','e','f'], ImagesHdCloud: ['ha','hb','hc','hd','he','hf'],
    generatedAudios: ['https://assets/voice1.mp3','https://assets/voice2.mp3','https://assets/voice3.mp3'], bShotVideos: [[],[],['https://assets/b2a.mp4'],[],['https://assets/b3a.mp4'],[]] };
  initial.sections.storybook = { GeneratedText: ['p1a','p1b','p2a','p2b','p3a','p3b'], VideoArrayCloud: ['v1a','v1b','v2a','v2b','v3a','v3b'],
    videoHistory: { 'A:2': [{videoUrl:'https://assets/deleted.mp4',createdAt:1}], 'A:4':[{videoUrl:'https://assets/kept.mp4',createdAt:2}], 'B:4:0':[{videoUrl:'https://assets/b3a.mp4',createdAt:2}] },
    imageReceipts: { 'A:4': {hdUrl:'he',sourcePrompt:'p3a'} } };
  initial.sections.editor = { selectedPromptsMap: {'A:2':'drop','A:4':'keep','B:4:0':'bkeep'}, dialogueCache:{initial:{bad:true}} };
  const f=fixture(), first=await f.save(owner,{snapshot:initial});
  const removed=removeDraftScenes(initial,2,2,1);
  assert.deepEqual(removed.sections.prompt.parsedKeyPoints,['1A','1B','3A','3B']);
  assert.equal(removed.sections.storybook.imageReceipts['A:2'].sourcePrompt,'p3a');
  assert.deepEqual(removed.sections.editor.selectedPromptsMap,{'A:2':'keep','B:2:0':'bkeep'});
  assert.deepEqual(removed.sections.editor.dialogueCache,{});
  await f.save(owner,{action:'quiet',saveId:'delete:one',postId:first.postId,expectedRevision:1,snapshot:removed,projection:{kind:'topology'}});
  const post=f.state.posts[0];
  assert.equal(post.xv2,'v3a'); assert.equal(post.xv2B,'v3b'); assert.equal(post.xv3,null); assert.equal(post.xh3B,null);
  assert.equal(post.xa2,'https://assets/voice3.mp3'); assert.equal(post.xa2B,'https://assets/voice3.mp3');
  assert.equal(JSON.parse(post.kontext).videoHistory['A:2'][0].videoUrl,'https://assets/kept.mp4');
  assert.equal(JSON.parse(post.bshot).videoarray[2][0],'https://assets/b3a.mp4');
  const resumed=await f.repo.read(owner,first.postId);
  assert.deepEqual(resumed.snapshot.sections.prompt.parsedKeyPoints,['1A','1B','3A','3B']);
  const again=removeDraftScenes(resumed.snapshot,0,2,0);
  await f.save(owner,{action:'quiet',saveId:'delete:two',postId:first.postId,expectedRevision:2,snapshot:again,projection:{kind:'topology'}});
  assert.equal(post.xv1,'v3a'); assert.equal(post.xv2,null);
  assert.equal((await f.repo.read(owner,first.postId)).snapshot.sections.editor.selectedPromptsMap['A:0'],'keep');
});


test('Remix never declares readiness while operational media still depend on a provider URL', async () => {
  const f=fixture(), first=await f.save();f.state.posts[0].video=1;
  const source=JSON.parse(f.state.drafts[0].snapshot);
  source.sections.prompt.prompt='https://creative-brief.example/story';
  assert.equal(schema.operationalDraftMediaUrls(source).includes(source.sections.prompt.prompt),false);
  source.sections.prompt.referenceImages=[{name:'Unsaved reference',imageUrl:'https://provider.example/expiring.png'}];
  f.state.drafts[0].snapshot=JSON.stringify(source);
  await assert.rejects(f.repo.prepareRemix(owner,first.postId,'remix:unsafe'),error=>error.code==='MEDIA_NOT_DURABLE');
  assert.equal(f.state.posts.length,1);assert.equal(f.state.jobs.length,0);
});
