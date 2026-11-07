const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');

const root = path.resolve(__dirname, '..');

// Mount the production Deck directly so native gesture checks do not depend on
// router startup, feed requests or media decoders. Bundle in memory: no server.
const fixture = `
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import settings, { setAutoControl, setAutoControlVisible } from './src/settingsSlice';
import brainstorm from './src/brainstormSlice';
import DeckOverlay from './src/DeckOverlay';
import AutoControlPill from './src/AutoControlPill';
const store = configureStore({ reducer: { settings, brainstorm } });
store.dispatch(setAutoControlVisible({ visible: true, actor: 'user' }));
const noop = () => {};
const poster = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="500" height="700"><rect width="500" height="700" fill="#29485d"/></svg>');
const cards = Array.from({ length: 3 }, (_, i) => ({ id: i + 1, mode: 0, item1: poster, finalTitle: 'Story ' + (i + 1) }));
function App() {
  const [activePostId, select] = useState(1);
  const [loading, setLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(null);
  const [closed, setClosed] = useState(false);
  const [dockHost, setDockHost] = useState(null);
  const [selections, setSelections] = useState([]);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState(false);
  const [section, setSection] = useState('games');
  const [empty, setEmpty] = useState(false);
  const onSelectPost = id => { select(id); setSelections(previous => [...previous, id]); };
  window.test = { state: () => ({ activePostId, loading, fullscreen, closed, selections, category, section }), loading: setLoading, search: setSearch, empty: setEmpty, select, closeFullscreen: () => setFullscreen(null), autoControl: enabled => store.dispatch(setAutoControl({ enabled, actor: 'user' })) };
  return closed ? <AutoControlPill /> : fullscreen ? <div>Fullscreen {fullscreen}</div> : <><DeckOverlay
    key={search ? section : category} cards={empty ? [] : cards} activePostId={activePostId} category={search ? 'search' : category} loading={loading} hasMore={false} error={null}
    onSelectPost={onSelectPost} onPlay={() => setFullscreen(activePostId)} onPaginate={noop}
    onCategory={setCategory} search={search ? {section, query:'cars', onSection:setSection, onSearch:noop} : undefined}
    onClose={() => setClosed(true)} onCreate={noop} onDockHost={setDockHost} isMenuOpen={false} />
    {dockHost && createPortal(<div className="deck-auto-control"><AutoControlPill placement="embedded" /></div>, dockHost)}
  </>;
}
createRoot(document.getElementById('root')).render(<Provider store={store}><App /></Provider>);
`;

(async () => {
  const bundle = await build({
    stdin: { contents: fixture, resolveDir: root, loader: 'tsx' },
    bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"development"', 'import.meta.env': '{}' },
  });
  const css = fs.readFileSync(path.join(root, 'src/DeckOverlay.css'), 'utf8');
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const [input, width] of [['mouse', 1280], ['mobile touch', 390], ['mobile touch', 320], ['desktop touch', 1280]]) {
      const touch = input !== 'mouse';
      const context = await browser.newContext({
        viewport: { width, height: input === 'mobile touch' ? 844 : 860 },
        isMobile: input === 'mobile touch', hasTouch: touch,
      });
      try {
        const page = await context.newPage(), errors = [];
        page.setDefaultTimeout(5000);
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => route.abort());
        await page.setContent('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box;margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden}body{font-family:system-ui}' + css + '</style><div id="root"></div>');
        await page.addScriptTag({ content: bundle.outputFiles[0].text });
        await page.waitForFunction(() => window.test?.state().activePostId === 1);
        const pill = page.getByRole('group', { name: 'Auto Control', exact: true });
        await pill.waitFor();
        const pillStyle = () => pill.evaluate(node => {
          const style = getComputedStyle(node), bounds = node.getBoundingClientRect();
          const close = node.querySelector('[data-ai-action="clikb.global.auto_control.control.hide"] svg').getBoundingClientRect();
          return { width: bounds.width, height: bounds.height, font: style.font, padding: style.padding, borderRadius: style.borderRadius,
            background: style.background, color: style.color, shadow: style.boxShadow, gap: style.gap, closeWidth: close.width, closeHeight: close.height };
        });
        const deckPillOff = await pillStyle();
        await page.evaluate(() => window.test.autoControl(true));
        await page.getByRole('button', { name: 'Auto Control on. Turn off', exact: true }).waitFor();
        const deckPillOn = await pillStyle();
        await page.evaluate(() => window.test.autoControl(false));
        await page.getByRole('button', { name: 'Auto Control off. Turn on', exact: true }).waitFor();
        const pillBounds = await pill.boundingBox();
        const dockBounds = await page.locator('[data-deck-concierge-host]').boundingBox();
        assert.ok(pillBounds.x >= dockBounds.x && pillBounds.x + pillBounds.width <= dockBounds.x + dockBounds.width + 1, 'Auto Control stays inside the Deck dock');
        assert.ok(pillBounds.x >= 0 && pillBounds.x + pillBounds.width <= width, 'Auto Control stays inside the viewport');
        assert.ok(pillBounds.height <= (width < 600 ? 44 : 50), 'Auto Control keeps its compact height');
        if (width < 600) {
          assert.ok(pillBounds.width <= 202, 'Mobile Auto Control stays compact');
          assert.equal(await pill.evaluate(node => getComputedStyle(node).fontSize), '12px');
          const output = path.join(root, '.tmp/deck');
          fs.mkdirSync(output, { recursive: true });
          await page.screenshot({ path: path.join(output, 'deck-swipe-mobile-' + width + '.png') });
        }
        await page.locator('.deck-stage').evaluate(stage => {
          window.captureLosses = [];
          window.gestureEvents = [];
          for (const type of ['pointerdown', 'pointerup', 'click']) stage.addEventListener(type, event => window.gestureEvents.push({ type, target: event.target.closest('button')?.getAttribute('aria-label') }));
          stage.addEventListener('pointerdown', event => { window.activePointerId = event.pointerId; });
          stage.addEventListener('lostpointercapture', event => window.captureLosses.push({ target: event.target.tagName, pointerType: event.pointerType }));
        });
        const session = touch ? await context.newCDPSession(page) : null;
        const state = () => page.evaluate(() => window.test.state());
        const active = id => page.waitForFunction(id => window.test.state().activePostId === id, id).catch(async error => { console.error(input, await state(), await page.evaluate(() => window.gestureEvents.slice(-15))); throw error; });
        async function swipe(dx, dy = 0, cancel = false) {
          await page.waitForTimeout(430); // Hit-test the settled card after its deal animation.
          const card = await page.locator('.deck-card--active .deck-card-media').boundingBox();
          const x = card.x + card.width / 2, y = card.y + card.height * .35;
          if (touch) {
            await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
            for (let step = 1; step <= 8; step++) {
              // Use finger-like timing so injected input does not create a synthetic fling.
              await page.waitForTimeout(20);
              await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx * step / 8, y: y + dy * step / 8 }] });
            }
            await session.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
          } else {
            await page.mouse.move(x, y);
            await page.mouse.down();
            await page.mouse.move(x + dx, y + dy, { steps: 8 });
            if (cancel) await page.locator('.deck-stage').evaluate(stage => stage.releasePointerCapture(window.activePointerId));
            await page.mouse.up();
          }
        }
        async function tap(locator) {
          if (!touch) return locator.click();
          const box = await locator.boundingBox();
          await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, radiusX: 1, radiusY: 1 }] });
          await page.waitForTimeout(50);
          await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        }
        await tap(page.getByRole('button', { name: 'Next card', exact: true })); await active(2);
        await tap(page.getByRole('button', { name: 'Previous card', exact: true })); await active(1);
        await swipe(-100); await active(2);
        assert.deepEqual((await state()).selections, [2, 1, 2], input + ': one swipe advances exactly one card');
        assert.equal((await state()).fullscreen, null);
        assert.equal((await state()).closed, false);
        if (touch) assert.ok((await page.evaluate(() => window.captureLosses)).some(event => event.target === 'BUTTON' && event.pointerType === 'touch'), 'Exercise implicit card capture transferring to its parent');
        await swipe(100); await active(1);
        await swipe(-100, 0, true); assert.equal((await state()).activePostId, 1, input + ': cancellation stays put');
        await swipe(-100); await active(2);
        await swipe(100); await active(1);
        assert.deepEqual((await state()).selections, [2, 1, 2, 1, 2, 1], input + ': swipes recover after cancellation');
        // Let post-swipe click suppression expire before checking ordinary taps.
        await page.waitForTimeout(450);
        const next = page.getByRole('button', { name: 'Next card', exact: true });
        const prev = page.getByRole('button', { name: 'Previous card', exact: true });
        await tap(next);
        await active(2);
        await tap(prev);
        await active(1);
        if (!touch) {
          await page.locator('.deck-card--active').hover();
          await page.mouse.wheel(100, 0); await active(2);
          await page.mouse.wheel(0, 100); assert.equal((await state()).activePostId, 2);
          await page.keyboard.press('ArrowLeft'); await active(1);
          await page.keyboard.press('ArrowRight'); await active(2);
        }
        // Let the deliberate post-swipe click suppression expire before a normal tap.
        await page.waitForTimeout(450);
        const selected = (await state()).activePostId;
        const card = page.locator('[data-ai-action="clikb.feeds.deck.action.play"]');
        await tap(card);
        await page.waitForFunction(id => window.test.state().fullscreen === id, selected);
        await page.evaluate(() => { window.test.closeFullscreen(); window.test.select(1); });
        await page.locator('.deck-stage').waitFor();
        await swipe(-20); assert.equal((await state()).activePostId, 1);
        await swipe(0, 100); assert.equal((await state()).activePostId, 1);
        await page.evaluate(() => window.test.loading(true));
        await swipe(-100); assert.equal((await state()).activePostId, 1);
        await page.evaluate(() => window.test.loading(false));
        assert.equal((await state()).fullscreen, null);
        assert.equal((await state()).closed, false);
        // Vertical browsing owns its own ring, including empty/loading lists.
        await page.waitForTimeout(450);
        const categoryBefore = (await state()).category;
        await swipe(0, -100);
        await page.waitForFunction(previous => window.test.state().category !== previous, categoryBefore);
        await page.waitForTimeout(450);
        if (!touch) {
          const beforeWheel = (await state()).category;
          await page.locator('.deck-card--active').hover();
          await page.mouse.wheel(0, 100);
          await page.waitForFunction(previous => window.test.state().category !== previous, beforeWheel);
          const afterWheel = (await state()).category;
          for (let i=0;i<9;i++) { await page.waitForTimeout(60); await page.mouse.wheel(0, 80); }
          assert.equal((await state()).category, afterWheel, 'Momentum cannot switch twice across Deck remounts');
        }
        await page.evaluate(() => window.test.search(true));
        await page.locator('[aria-label="Search collection: Games"]').waitFor();
        await page.waitForTimeout(450);
        await swipe(0,-100);
        await page.locator('[aria-label="Search collection: Shorts"]').waitFor();
        assert.equal(await page.getByLabel('Search ClikB',{exact:true}).inputValue(),'cars');
        await page.waitForTimeout(450);
        await page.evaluate(() => { window.test.empty(true); window.test.loading(true); });
        await page.locator('.deck-stage').focus().catch(()=>{});
        await page.keyboard.press('ArrowDown');
        await page.locator('[aria-label="Search collection: Cinema"]').waitFor();
        await page.keyboard.press('ArrowDown');
        await page.locator('[aria-label="Search collection: Games"]').waitFor();
        await page.evaluate(() => { window.test.empty(false); window.test.loading(false); window.test.search(false); });
        await page.waitForTimeout(450);
        assert.equal(await page.locator('.deck-card-poster[data-ready="true"]').count(),3,'Cached posters settle independently without a collection wait');
        await page.emulateMedia({reducedMotion:'reduce'});
        assert.equal(await page.locator('.deck-card--active').evaluate(node=>getComputedStyle(node).animationName),'none');
        await page.emulateMedia({reducedMotion:'no-preference'});
        // Grid uses the same pill with its default floating placement in App.
        await page.getByRole('button', { name: 'Close Deck to grid', exact: true }).click();
        await page.locator('.deck-overlay').waitFor({ state: 'detached' });
        await pill.waitFor();
        assert.deepEqual(await pillStyle(), deckPillOff, 'Deck and Grid use identical Auto Control styling while Off');
        await page.evaluate(() => window.test.autoControl(true));
        await page.getByRole('button', { name: 'Auto Control on. Turn off', exact: true }).waitFor();
        assert.deepEqual(await pillStyle(), deckPillOn, 'Deck and Grid use identical Auto Control styling while On');
        assert.deepEqual(errors, []);
        console.log('PASS ' + input + ' ' + width + 'px: left/right swipes, cancellation/recovery, short/vertical/loading gestures, arrows, tap-to-open; matching Deck/Grid Auto Control ' + pillBounds.width + 'x' + pillBounds.height);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
