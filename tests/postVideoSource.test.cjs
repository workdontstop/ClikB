const test=require('node:test'),assert=require('node:assert/strict');
const {loadTypeScript}=require('./promptTestBindings.cjs');
const {postVideoSource}=loadTypeScript('src/postVideoSource.ts');
test('published output and historical single-scene video retain their precedence; image-only posts stay images',()=>{
 assert.equal(postVideoSource({mode:0,videoUrl:'published.mp4',xv1:'scene.mp4'}),'published.mp4');
 assert.equal(postVideoSource({mode:0,xv1:'scene.mp4',main:'legacy.mp4'},'0'),'scene.mp4');
 assert.equal(postVideoSource({mode:0,item1:'image.webp',videoUrl:null,xv1:''}),'');
 assert.equal(postVideoSource({mode:0,item1:'image.webp',video:'1'}),'');
 assert.equal(postVideoSource({mode:0,item1:'image.webp',video:'100'}),'');
 assert.equal(postVideoSource({mode:2,main:'game.mp4',videoUrl:'game-cover.mp4'}),'');
 assert.equal(postVideoSource({mode:'2',xv1:'cover.mp4'}),'');
 assert.equal(postVideoSource({mode:0,main:'<html>game code</html>'}),'');
 assert.equal(postVideoSource({mode:0,main:'https://media.test/legacy.mp4'}),'https://media.test/legacy.mp4');
 assert.equal(postVideoSource({mode:0,kontext:{motion:'draft-only.mp4'}}),'');
});
