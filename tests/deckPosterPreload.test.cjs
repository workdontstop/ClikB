const test=require('node:test'),assert=require('node:assert/strict');
const {loadTypeScript}=require('./promptTestBindings.cjs');
const {preloadDeckPoster}=loadTypeScript('src/deckPosterPreload.ts');

test('nearby posters reuse decoding, bound retained images, and retry failed images',()=>{
 const previous=global.Image,images=[];
 global.Image=class {constructor(){images.push(this);this.decodes=0;}decode(){this.decodes++;return Promise.resolve();}};
 try {
  preloadDeckPoster('a');preloadDeckPoster('a');
  assert.equal(images.length,1);assert.equal(images[0].decodes,1);
  images[0].onerror();preloadDeckPoster('a');assert.equal(images.length,2,'failed load can be retried');
  for(let i=0;i<47;i++)preloadDeckPoster('other-'+i);
  preloadDeckPoster('a');preloadDeckPoster('overflow');
  const before=images.length;preloadDeckPoster('a');assert.equal(images.length,before,'recent poster stays warm');
  preloadDeckPoster('other-0');assert.equal(images.length,before+1,'least-recent poster is evicted at 48');
 }finally{global.Image=previous;}
});
