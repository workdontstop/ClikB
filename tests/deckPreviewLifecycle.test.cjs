const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/deckPreviewLifecycle.ts'), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
const exported = {};
new Function('exports', 'module', output)(exported, { exports: exported });
const { createDeckPreviewLifecycle, releaseDeckPreviewMedia } = exported;

class Media extends EventTarget {
  constructor() { super(); this.muted = false; this.volume = 0.7; this.loop = false; this.isConnected = true; this.paused = true; this.attributes = new Map(); this.calls = []; this.playResult = () => Promise.resolve(); }
  play() { this.paused = false; this.calls.push('play'); return this.playResult(); }
  pause() { this.paused = true; this.calls.push('pause'); this.dispatchEvent(new Event('pause')); }
  load() { this.calls.push('load'); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  setAttribute(key, value) { this.attributes.set(key, value); }
  removeAttribute(key) { this.calls.push(`remove:${key}`); this.attributes.delete(key); }
}
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
const fixture = (media = new Media(), overrides = {}) => {
  const preference = { muted: false, volume: 0.7 }, playing = [], blocked = [];
  let visible = true, current = true;
  const lifecycle = createDeckPreviewLifecycle(media, { source: '/fixture/preview.mp4', playback: () => preference,
    isCurrent: () => current, isVisible: () => visible, onPlaying: value => playing.push(value), onBlocked: value => blocked.push(value), ...overrides });
  return { media, lifecycle, preference, playing, blocked, visible: value => { visible = value; }, current: value => { current = value; } };
};

test('Closing immediately silences and releases an unmuted Deck preview, even when play resolves late', async () => {
  const media = new Media(); let resolve;
  media.playResult = () => new Promise(done => { resolve = done; });
  const item = fixture(media); item.lifecycle.start();
  assert.equal(media.paused, false); assert.equal(media.muted, false);
  item.lifecycle.dispose();
  assert.equal(media.paused, true); assert.equal(media.muted, true); assert.equal(media.volume, 0); assert.equal(media.getAttribute('src'), null);
  // A delayed decoder can finish after the router has detached its old node.
  media.isConnected = false; media.paused = false; resolve(); await tick();
  assert.equal(media.paused, true); assert.equal(media.getAttribute('src'), null);
  media.paused = false; media.dispatchEvent(new Event('playing'));
  assert.equal(media.paused, true); assert.equal(media.muted, true);
  assert.deepEqual(item.playing, []); assert.deepEqual(item.blocked, []);
  assert.deepEqual(item.preference, { muted: false, volume: 0.7 });
});

test('Ref replacement retires only the old node, and an old lease cannot silence a newer lease on the same node', async () => {
  const old = new Media(); let resolve;
  old.playResult = () => new Promise(done => { resolve = done; });
  const first = fixture(old); first.lifecycle.start(); first.lifecycle.dispose();
  old.playResult = () => Promise.resolve();
  const second = fixture(old, { source: '/fixture/new.mp4' }); second.lifecycle.start(); await tick();
  resolve(); await tick(); old.dispatchEvent(new Event('playing'));
  assert.equal(old.getAttribute('src'), '/fixture/new.mp4'); assert.equal(old.paused, false); assert.equal(old.muted, false);
  assert.deepEqual(first.playing, []); assert.ok(second.playing.includes(true));
  second.lifecycle.dispose();
});

test('A hidden preview cannot resume from a pending play, and visible resumption restores the shared preference', async () => {
  const media = new Media(); let resolve;
  media.playResult = () => new Promise(done => { resolve = done; });
  const item = fixture(media); item.lifecycle.start(); item.visible(false); item.lifecycle.pause();
  media.paused = false; resolve(); await tick();
  assert.equal(media.paused, true); assert.equal(media.muted, true);
  item.visible(true); media.playResult = () => Promise.resolve(); item.lifecycle.start(); await tick();
  assert.equal(media.paused, false); assert.equal(media.muted, false); assert.equal(media.volume, 0.7);
  assert.deepEqual(item.preference, { muted: false, volume: 0.7 }); item.lifecycle.dispose();
});

test('Autoplay rejection belongs only to the current preview, with no rejected update after disposal', async () => {
  const media = new Media(); let reject;
  media.playResult = () => new Promise((_, fail) => { reject = fail; });
  const item = fixture(media); item.lifecycle.start(); reject(new Error('Blocked')); await tick();
  assert.deepEqual(item.blocked, [true]); assert.equal(item.playing.at(-1), false);
  item.blocked.length = 0; item.lifecycle.start(); item.lifecycle.dispose(); reject(new Error('Abort after close')); await tick();
  assert.deepEqual(item.blocked, []); assert.equal(media.paused, true); assert.equal(media.getAttribute('src'), null);
});

test('Source release still completes if the decoder throws during pause', () => {
  const media = new Media(); media.setAttribute('src', '/fixture/old.mp4'); media.pause = () => { throw new Error('Decoder detached'); };
  releaseDeckPreviewMedia(media);
  assert.equal(media.muted, true); assert.equal(media.volume, 0); assert.equal(media.getAttribute('src'), null); assert.ok(media.calls.includes('load'));
});

test('The production Close, Create and Play handlers dispose preview audio before invoking navigation', () => {
  const component = ts.createSourceFile('DeckOverlay.tsx', fs.readFileSync(path.join(root, 'src/DeckOverlay.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const handlers = {};
  const visit = node => { if (ts.isVariableDeclaration(node) && ['closeDeck', 'createFromDeck', 'playFromDeck'].includes(node.name.getText(component))) handlers[node.name.getText(component)] = node.initializer; ts.forEachChild(node, visit); };
  visit(component);
  for (const [name, callback] of [['closeDeck', 'onClose'], ['createFromDeck', 'onCreate'], ['playFromDeck', 'onPlay']]) {
    const item = fixture(); item.lifecycle.start(); const calls = [];
    const code = ts.transpileModule(`const handler = ${handlers[name].getText(component)};`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
    const handler = new Function('stopSlideshow', 'stopPreview', callback, `${code}; return handler;`)(
      () => calls.push('slideshow'), () => { item.lifecycle.dispose(); calls.push('preview'); },
      () => { assert.equal(item.media.paused, true); assert.equal(item.media.muted, true); assert.equal(item.media.getAttribute('src'), null); calls.push('navigation'); });
    handler(); assert.deepEqual(calls, ['slideshow', 'preview', 'navigation']); assert.equal(item.preference.muted, false);
  }
});
