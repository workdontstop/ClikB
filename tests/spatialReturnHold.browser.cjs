const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), { pathToFileURL } = require('node:url');
const { serveLocalVideo } = require('./localVideoFixture.cjs');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const root = path.resolve(__dirname, '..').replaceAll('\\', '/');
  const output = process.env.SPATIAL_TEST_OUTPUT || path.join(root, '.tmp/return-hold-browser');
  const sample = process.env.SPATIAL_TEST_VIDEO;
  if (!sample || !fs.existsSync(sample)) throw Error('Set SPATIAL_TEST_VIDEO to a local MP4.');
  fs.mkdirSync(output, { recursive: true });
  const { createServer } = await import(pathToFileURL(root + '/node_modules/vite/dist/node/index.js'));
  const server = await createServer({ root, configFile: false, logLevel: 'error', cacheDir: output + '/vite', esbuild: { jsx: 'automatic' },
    resolve: { alias: { react: root + '/node_modules/react', 'react-dom': root + '/node_modules/react-dom' } },
    server: { host: '127.0.0.1', port: 5207, strictPort: true, hmr: false, watch: null }, plugins: [{ name: 'return-hold-fixture', configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url.startsWith('/__test')) { res.setHeader('Content-Type', 'text/html'); res.end('<div id="root"></div><script type="module" src="/tests/spatialPlayer.browser.tsx"></script>'); return; }
        if (req.url.startsWith('/sample.mp4')) { serveLocalVideo(req, res, sample); return; }
        next();
      });
    } }] });
  await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME, args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } }), errors = [], passed = [], failures = [];
  page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:5207/') ? route.continue() : route.abort());
  const primary = page.locator('[data-test-primary]'), pad = primary.locator('.spatial-drive-control');
  const waiting = primary.locator('[data-spatial-return-hold="true"]');
  const at = node => page.waitForFunction(node => document.querySelector('[data-test-primary] [data-spatial-node]')?.getAttribute('data-spatial-node') === node, node);
  const node = () => primary.locator('[data-spatial-node]').getAttribute('data-spatial-node');
  const drive = async (control, direction) => {
    if (control === 'dpad') { await pad.locator('[data-drive-direction="' + (direction < 0 ? 'left' : 'right') + '"]').dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true, button: 0 }); return; }
    const box = await pad.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
    if (control === 'analog') { await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + direction * 45, y, { steps: 4 }); }
    else await page.mouse.move(x + direction * (box.width / 2 - 20), y);
  };
  const release = async control => {
    if (control === 'dpad') await pad.dispatchEvent('pointerup', { pointerId: 1, isPrimary: true, button: 0 });
    else { await page.mouse.up(); await page.mouse.move(1100, 700); }
  };
  const finish = async () => {
    await page.waitForFunction(() => { const video = document.querySelector('[data-test-primary] [data-spatial-playback] video'); return video?.style.visibility === 'visible' && !video.paused && video.currentTime > .05; });
    await primary.locator('[data-spatial-playback] video').evaluate(video => { video.currentTime = video.duration - .08; });
  };
  const prepare = async (mode, control = 'analog') => {
    await page.goto('http://127.0.0.1:5207/__test?mode=' + mode + '&actionLink=1&thirdAction=1&control=' + control, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await at('root'); await page.evaluate(() => window.test.player.current.jump('acted-3')); await at('inside');
    // Unlocking still requires at least one second of actual movement away.
    await drive(control, -1); await page.waitForTimeout(300); await release(control);
    assert.equal(await node(), 'inside'); assert.equal(await waiting.count(), 0);
    await drive(control, 1);
    await page.waitForFunction(() => document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentTime > 1.2);
    await finish(); await at('room'); await release(control);
    await page.evaluate(() => {
      const root = document.querySelector('[data-test-primary]'); window.returnHoldEvents = []; let held = false, node = '';
      new MutationObserver(() => {
        const nextHeld = !!root.querySelector('[data-spatial-return-hold="true"]'), nextNode = root.querySelector('[data-spatial-node]')?.getAttribute('data-spatial-node');
        if (held !== nextHeld || node !== nextNode) window.returnHoldEvents.push({ held: nextHeld, node: nextNode, at: performance.now() });
        held = nextHeld; node = nextNode;
      }).observe(root, { attributes: true, childList: true, subtree: true });
    });
  };
  const reachEntry = async (control, longTravel = false) => {
    await drive(control, -1);
    await page.waitForFunction(() => document.querySelector('[data-test-primary] [data-spatial-playback="backward"] video')?.currentTime > .05);
    assert.equal(await waiting.count(), 0, 'travel started the return countdown');
    if (longTravel) {
      await primary.locator('[data-spatial-playback] video').evaluate(video => { video.playbackRate = .2; });
      await page.waitForTimeout(3200);
      assert.equal(await node(), 'room'); assert.equal(await waiting.count(), 0, 'travel time counted toward the hold');
      await primary.locator('[data-spatial-playback] video').evaluate(video => { video.playbackRate = 1; });
    }
    await finish(); await at('inside'); await waiting.waitFor({ state: 'attached' });
  };
  const check = async (name, work) => {
    try { await work(); passed.push(name); console.log('PASS ' + name); }
    catch (error) { failures.push({ name, error: String(error) }); console.log('FAIL ' + name + ': ' + error.message); await page.mouse.up(); await page.screenshot({ path: output + '/failure-' + failures.length + '.png' }); }
  };
  try {
    for (const mode of ['preview', 'feed']) for (const control of ['analog', 'dpad', 'hover']) await check(mode + ' ' + control + ': release resets the full hold and replays the exact source action', async () => {
      await prepare(mode, control); await reachEntry(control, control === 'analog');
      const pulse = await pad.evaluate(element => { const style = getComputedStyle(element, '::after'); return { content: style.content, animation: style.animationName }; });
      assert.equal(pulse.content, '""'); assert.equal(pulse.animation, 'spatial-link-return-pulse');
      await page.screenshot({ path: output + '/' + mode + '-' + control + '-hold.png' });
      await page.waitForTimeout(650); await release(control); await waiting.waitFor({ state: 'detached' });
      await page.waitForTimeout(2000); assert.equal(await node(), 'inside', 'released input still crossed the link');
      await drive(control, -1); await waiting.waitFor({ state: 'attached' });
      await page.waitForTimeout(1500); assert.equal(await node(), 'inside', 'separate holds accumulated time');
      await at('acted-3'); await release(control);
      const events = await page.evaluate(() => window.returnHoldEvents), arrival = events.findLast(event => event.node === 'acted-3'), start = events.findLast(event => event.held);
      assert.ok(arrival.at - start.at >= 1780, 'return occurred before 1.8 seconds: ' + JSON.stringify(events));
      assert.ok(arrival.at - start.at < 2500, 'return still uses the old longer hold: ' + JSON.stringify(events));
      await page.waitForFunction(() => document.querySelector('[data-test-primary] [data-spatial-playback] video')?.currentSrc.endsWith('?act-3'));
      assert.equal(await waiting.count(), 0);
    });
    for (const mode of ['preview', 'feed']) for (const cancelKind of ['neutral', 'direction', 'navigation', 'blur']) await check(mode + ': ' + cancelKind + ' cancels the countdown immediately', async () => {
      await prepare(mode); await reachEntry('analog'); await page.waitForTimeout(100);
      const box = await pad.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
      if (cancelKind === 'neutral') await page.mouse.move(x, y);
      else if (cancelKind === 'direction') await page.mouse.move(x + 45, y);
      else if (cancelKind === 'navigation') await page.evaluate(() => window.test.player.current.home());
      else await page.evaluate(() => window.dispatchEvent(new Event('blur')));
      await waiting.waitFor({ state: 'detached' });
      await release('analog'); await page.waitForTimeout(2150);
      assert.equal(await node(), cancelKind === 'navigation' ? 'root' : 'inside');
      assert.equal(await primary.locator('[data-spatial-action-navigation]').count(), 0);
    });
    for (const mode of ['preview', 'feed']) await check(mode + ': explicit Back and motion-source returns remain immediate', async () => {
      await prepare(mode); await reachEntry('analog');
      await page.evaluate(() => window.test.player.current.back()); await at('moved'); await release('analog');
      assert.equal(await waiting.count(), 0); assert.equal(await primary.locator('[data-spatial-action-navigation]').count(), 0);
      await page.goto('http://127.0.0.1:5207/__test?mode=' + mode, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await at('root'); await page.evaluate(() => window.test.player.current.jump('door')); await at('inside');
      const started = Date.now(); await drive('analog', -1); await at('door'); await release('analog');
      assert.ok(Date.now() - started < 1200, 'motion-source return gained the action hold'); assert.equal(await waiting.count(), 0);
    });
    fs.writeFileSync(output + '/report.json', JSON.stringify({ passed, failures, errors, localOnly: true }, null, 2));
    assert.deepEqual(errors, []); assert.deepEqual(failures, []);
    console.log(JSON.stringify({ passed: passed.length, output }));
  } finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
