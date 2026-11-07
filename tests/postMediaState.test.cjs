const test=require('node:test'),assert=require('node:assert/strict');
const {loadTypeScript}=require('./promptTestBindings.cjs');
const {reindexPostMedia}=loadTypeScript('src/postMediaState.ts');
test('replaced and reordered feeds never inherit media from an unrelated index',()=>{
 const old=['gta.mp4','other.mp4'];
 assert.deepEqual(reindexPostMedia(old,[10,20],[{id:30,videoUrl:'rabbit.mp4'},{id:10,videoUrl:'gta.mp4'}],p=>p.videoUrl),['rabbit.mp4','gta.mp4']);
 assert.deepEqual(reindexPostMedia(['rendered.mp4'],[10],[{id:10},{id:40,videoUrl:'new.mp4'}],p=>p.videoUrl||''),['rendered.mp4','new.mp4']);
 assert.deepEqual(reindexPostMedia([{xa1:'old.mp3'}],[10],[{id:30,xa1:'rabbit.mp3'}],p=>({xa1:p.xa1})),[{xa1:'rabbit.mp3'}]);
 assert.deepEqual(reindexPostMedia([[]],[10],[{id:10,xv1:'ready.mp4'}],p=>[p.xv1]),[['ready.mp4']]);
});
