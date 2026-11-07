const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('./promptTestBindings.cjs');
const { createOwnedMediaPlayback, createOwnedAudioChain } = loadTypeScript('src/ownedMediaLifecycle.ts');
const { renderFixture, settle } = require('./viewerCoverFixtures.cjs');
class Media extends EventTarget {
  constructor() { super(); this.src = ''; this.onended = null; this.isConnected = true; this.muted = false; this.volume = .7; this.paused = true; this.played = []; this.playResult = () => Promise.resolve(); }
  play() { this.paused = false; this.played.push(this.src); return this.playResult(); }
  pause() { this.paused = true; }
  load() { this.paused = true; }
  removeAttribute(name) { if (name === 'src') this.src = ''; }
}
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
const clock = () => {
  const timers = new Map(); let id = 0;
  return { timers, setTimeout(callback) { timers.set(++id, callback); return id; }, clearTimeout(key) { timers.delete(key); }, run() { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); } };
};
test('A disposed fullscreen video cannot resume from a pending play or late native playing event', async () => {
  const media = new Media(); media.src = 'fullscreen.mp4'; let resolve;
  media.playResult = () => new Promise(done => { resolve = done; });
  const owner = createOwnedMediaPlayback(media, () => true), pending = owner.play();
  owner.dispose(); assert.equal(media.src, ''); assert.equal(media.muted, true); assert.equal(media.volume, 0);
  media.paused = false; resolve(); await pending;
  assert.equal(media.paused, true); media.paused = false; media.dispatchEvent(new Event('playing')); assert.equal(media.paused, true);
});
test('An exited narration chain cancels its next-track timer and clears its owned handler/source', async () => {
  const media = new Media(), time = clock(), chain = createOwnedAudioChain(media, time);
  chain.onEnded(() => chain.schedule(() => chain.play('next.mp3'), 500));
  await chain.play('first.mp3'); media.onended(new Event('ended')); assert.equal(time.timers.size, 1);
  chain.dispose(); time.run(); await tick();
  assert.deepEqual(media.played, ['first.mp3']); assert.equal(media.onended, null); assert.equal(media.src, ''); assert.equal(media.paused, true);
});
test('Narration cleanup leaves a newer source/ended-handler owner running', async () => {
  const media = new Media(), time = clock(), chain = createOwnedAudioChain(media, time);
  chain.onEnded(() => chain.schedule(() => chain.play('old-next.mp3'), 500)); await chain.play('old.mp3'); media.onended(new Event('ended'));
  const foreignEnded = () => {}; media.src = 'other-owner.mp3'; media.onended = foreignEnded; media.paused = false;
  chain.dispose(); time.run(); await tick(); media.dispatchEvent(new Event('playing'));
  assert.equal(media.src, 'other-owner.mp3'); assert.equal(media.onended, foreignEnded); assert.equal(media.paused, false); assert.equal(media.muted, false); assert.equal(media.volume, .7);
});
test('Late playback from an already disposed narration chain cannot silence a later external owner', async () => {
  const media = new Media(), time = clock(); let resolve;
  media.playResult = () => new Promise(done => { resolve = done; });
  const chain = createOwnedAudioChain(media, time); chain.onEnded(() => {});
  const pending = chain.play('retired.mp3'); chain.dispose();
  const foreignEnded = () => {}; media.src = 'new-owner.mp3'; media.onended = foreignEnded; media.muted = false; media.volume = .8; media.paused = false;
  resolve(); await pending; media.dispatchEvent(new Event('playing'));
  assert.equal(media.src, 'new-owner.mp3'); assert.equal(media.onended, foreignEnded); assert.equal(media.paused, false); assert.equal(media.muted, false); assert.equal(media.volume, .8);
});
test('Actual VideoPlayer ref stays stable during updates and unmount releases the node without changing Redux preferences', async () => {
  const fixture = renderFixture('src/VideoPlayer.tsx', { index: 0, src: 'video.mp4', isActive: true, isUIHidden: true, setUIHidden() {}, matchMobile: false,
    isNineTwelve: true, isMenuOpen: false, item: { id: 42, ratio: 1 }, playvid: true, muted: false, darkMode: true, singleMode: false, onRefAssign() {} });
  fixture.env.dispatch(fixture.env.settings.setPlaybackMuted(false)); fixture.env.dispatch(fixture.env.settings.setPlaybackVolume(.7)); fixture.render();
  const ref = fixture.find(node => node.type === 'video').props.ref;
  await settle(fixture); assert.equal(fixture.env.video.paused, false, 'Active autoplay starts immediately after the node mounts');
  fixture.find(node => node.type === 'video').props.onClick(); await settle(fixture); assert.equal(fixture.env.video.paused, true, 'A click still pauses autoplay');
  fixture.find(node => node.type === 'video').props.onClick(); await settle(fixture); assert.equal(fixture.env.video.paused, false, 'A second click resumes playback');
  for (let index = 0; index < 5; index++) { fixture.env.video.currentTime = index; fixture.find(node => node.type === 'video').props.onTimeUpdate(); fixture.render(); assert.equal(fixture.find(node => node.type === 'video').props.ref, ref); assert.equal(fixture.env.video.paused, false); }
  fixture.unmount(); assert.equal(fixture.env.video.paused, true); assert.equal(fixture.env.video.src, '');
  assert.equal(fixture.env.state.settings.fullscreenMute, false); assert.equal(fixture.env.state.settings.playbackVolume, .7);
});
