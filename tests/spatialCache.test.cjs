const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');
class Video {
 constructor(){this.readyState=4;this.src='';this.buffered={length:1};this.loads=0;this.pauses=0;}
 load(){this.loads++;}pause(){this.pauses++;}remove(){}removeAttribute(key){if(key==='src')this.src='';}
 cloneNode(){const copy=new Video();copy.src=this.src;return copy;}
}
global.document={createElement:()=>new Video()};global.HTMLMediaElement={HAVE_FUTURE_DATA:3};
function fixture(){const file=path.resolve(__dirname,'../src/spatialVideoCache.ts'),mod=new Module(file,module);mod.paths=Module._nodeModulePaths(path.dirname(file));mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);return mod.exports.spatialVideoRamCache;}
const plan=(owner,urls)=>({sceneId:'scene-'+owner,sceneIndex:owner,activeNodeId:'root',forwardConnectionIds:[],backwardConnectionIds:[],assets:urls.map((url,index)=>({url,connectionId:'edge-'+index,assetDirection:'forward',slotDirection:'forward',distance:index+1}))});
test('repeat traversal reuses the preloaded element and does not reload its media',()=>{
 const cache=fixture();cache.reconcile(plan(1,['forward.mp4','return.mp4']));const video=cache.playbackElement('forward.mp4'),loads=video.loads;
 for(let i=0;i<4;i++){const lease=cache.acquirePlayback('forward.mp4');assert.equal(lease.video,video);lease.release();cache.reconcile(plan(1,['forward.mp4','return.mp4']));}
 assert.equal(video.loads,loads);cache.releaseScene(1);assert.equal(cache.playbackElement('forward.mp4'),null);
});
test('a current/retained video remains pinned when navigation moves beyond all cache windows',()=>{
 const cache=fixture();cache.reconcile(plan(1,['old.mp4']));const lease=cache.acquirePlayback('old.mp4'),video=lease.video,loads=video.loads;
 cache.reconcile(plan(1,['next.mp4']));assert.equal(video.src,'old.mp4');assert.equal(video.loads,loads);assert.equal(cache.playbackElement('old.mp4'),video);
 cache.releaseScene(1);assert.equal(video.src,'old.mp4','releaseScene destroyed a live playback lease');
 lease.release();assert.equal(video.src,'');assert.equal(cache.playbackElement('old.mp4'),null);assert.equal(cache.snapshot().entries.length,0);
});
test('creation and preview have separate drivers, and either can unmount without evicting the other',()=>{
 const cache=fixture();cache.reconcile(plan(1,['shared.mp4']));cache.reconcile(plan(2,['shared.mp4']));
 const creation=cache.acquirePlayback('shared.mp4'),preview=cache.acquirePlayback('shared.mp4');assert.notEqual(creation.video,preview.video);
 cache.releaseScene(1);creation.release();assert.equal(preview.video.src,'shared.mp4');assert.ok(cache.playbackElement('shared.mp4'));
 cache.releaseScene(2);assert.ok(cache.playbackElement('shared.mp4'),'active cloned preview lost its cache entry');
 preview.release();assert.equal(preview.video.src,'');assert.equal(cache.snapshot().entries.length,0);preview.release();assert.equal(cache.snapshot().entries.length,0);
});
test('a released preview clone cannot remove another creator/player cache window',()=>{
 const cache=fixture();cache.reconcile(plan(1,['shared.mp4']));const first=cache.acquirePlayback('shared.mp4'),second=cache.acquirePlayback('shared.mp4');
 second.release();assert.equal(first.video.src,'shared.mp4');assert.equal(cache.playbackElement('shared.mp4'),first.video);
 first.release();assert.ok(cache.playbackElement('shared.mp4'));cache.releaseScene(1);assert.equal(cache.snapshot().entries.length,0);
});
