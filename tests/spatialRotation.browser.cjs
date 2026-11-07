const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs'), { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || path.resolve(__dirname, '../.tmp/concierge-browser-deps/node_modules/playwright'));
(async () => {
 const root = path.resolve(__dirname, '..'), output = path.join(root, '.tmp/rotation-controls'); fs.mkdirSync(output, { recursive: true });
 const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')));
 const server = await createServer({ root, configFile: false, logLevel: 'error', optimizeDeps: { entries: ['tests/spatialStudio.responsive.tsx'] }, cacheDir: output + '/vite', esbuild: { jsx: 'automatic' },
  server: { host: '127.0.0.1', port: 5209, strictPort: true, hmr: false }, plugins: [{ name: 'fixture', enforce: 'pre', transform(code, id) {
   if (id.replaceAll('\\', '/').split('?')[0].endsWith('/tests/spatialStudio.responsive.tsx')) return code.replace("spatialControlMode: 'dpad'", "spatialControlMode: 'analog'");
  }, configureServer(server) { server.middlewares.use((req, res, next) => {
   if (req.url.startsWith('/__test')) { res.setHeader('Content-Type', 'text/html'); res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#111}</style><div id="root"></div><script type="module" src="/tests/spatialStudio.responsive.tsx"></script>'); } else next();
  }); } }] }); await server.listen();
 const browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
 const errors = [];
 const visit = async (width = 740, extra = '') => {
  const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: width < 500, hasTouch: width < 500 });
  const page = await context.newPage(); page.setDefaultTimeout(10000); page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:5209/') || route.request().url().startsWith('data:') ? route.continue() : route.abort());
  await page.goto(`http://127.0.0.1:5209/__test?w=${width}&h=770&ready=1${extra}`);
  await page.getByRole('button', { name: 'Rotate horizontally', exact: true }).waitFor();
  return { context, page };
 };
 const button = (page, name) => page.getByRole('button', { name, exact: true });
 const joystick = page => page.getByLabel(/^Spatial analogue drive;/);
 const drag = async (page, x, y, ms = 450) => {
  const box = await joystick(page).boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + x * box.width, cy - y * box.height, { steps: 4 });
  await page.waitForTimeout(ms); await page.mouse.up();
 };
 const hold = async (page, name, ms) => {
  const box = await button(page, name).boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up();
 };
 const saved = page => page.locator('html').getAttribute('data-saved-scene').then(JSON.parse);
 const noPlanning = async page => assert.equal(await page.locator('html').getAttribute('data-planning-calls'), null);
 const finish = async page => { await button(page, 'Finish recording').click(); await button(page, 'Test recording').waitFor(); return saved(page); };
 const image = page => page.locator('[aria-label="Playable 3D scene proxy"] canvas').evaluate(canvas => canvas.toDataURL());
 const exportReference = page => page.evaluate(async () => {
  const scene = JSON.parse(document.documentElement.dataset.savedScene);
  const { recordMotionGuide } = await import('/src/motionGuideRenderer.ts');
  const { readMotionExportDuration } = await import('/src/motionExportTiming.ts');
  const signal = new AbortController().signal, file = await recordMotionGuide(scene.ledger.draft.plan, '9:16', signal, () => {});
  return { duration: await readMotionExportDuration(file, signal), type: file.type, size: file.size };
 });
 const assertExport = exported => { assert.ok(Math.abs(exported.duration - 5) < .1, JSON.stringify(exported)); assert.equal(exported.type, 'video/mp4'); assert.ok(exported.size > 1000); };
 const heightInterruptions = async () => {
  for (const interruption of ['window blur', 'Escape', 'document hidden', 'pointer cancel', 'lost pointer capture', 'keyboard release']) {
   const { context, page } = await visit(), rise = button(page, 'Rise');
   await button(page, 'Add motion').click();
   const box = await rise.boundingBox();
   if (interruption === 'keyboard release') { await rise.focus(); await page.keyboard.down(' '); }
   else { await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); }
   await page.waitForTimeout(350); assert.equal(await rise.getAttribute('aria-pressed'), 'true', `${interruption}: Rise did not engage`);
   if (interruption === 'window blur') await page.evaluate(() => window.dispatchEvent(new Event('blur')));
   else if (interruption === 'Escape') await page.keyboard.press('Escape');
   else if (interruption === 'document hidden') await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
   });
   else if (interruption === 'keyboard release') await page.keyboard.up(' ');
   else await rise.evaluate((element, type) => element.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1 })), interruption === 'pointer cancel' ? 'pointercancel' : 'lostpointercapture');
   const paused = page.getByText(/^Mapping paused/); await paused.waitFor(); await page.waitForTimeout(150);
   assert.equal(await rise.getAttribute('aria-pressed'), 'false', `${interruption}: height input stayed active`);
   const pausedText = await paused.textContent(), pausedImage = await image(page);
   assert.ok(Number(pausedText.match(/(\d+\.\d+)s left/)[1]) < 5, `${interruption}: no active ascent was recorded`);
   await page.waitForTimeout(350);
   assert.equal(await paused.textContent(), pausedText, `${interruption}: idle time advanced capture`);
   assert.equal(await image(page), pausedImage, `${interruption}: rendered pose drifted after stopping height`);
   if (interruption !== 'keyboard release') await page.mouse.up();
   if (interruption === 'document hidden') await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
   });
   await hold(page, 'Rise', 250); await paused.waitFor(); await page.waitForTimeout(150);
   assert.ok(Number((await paused.textContent()).match(/(\d+\.\d+)s left/)[1]) < Number(pausedText.match(/(\d+\.\d+)s left/)[1]), `${interruption}: resumed height did not advance active time`);
   assert.notEqual(await image(page), pausedImage, `${interruption}: resumed height did not change the rendered pose`);
   await noPlanning(page); const scene = await finish(page), track = scene.ledger.draft.plan.objects[0].keys;
   assert.ok(track.at(-1).position[1] > track[0].position[1], `${interruption}: resumed ascent was absent from the saved recording`);
   console.log(`PASS height ${interruption}: pauses time and rendered pose; resume advances; no AI calls`);
   await context.close();
  }
 };
 try {
  if (process.env.SPATIAL_HEIGHT_INTERRUPTION_ONLY === '1') { await heightInterruptions(); assert.deepEqual(errors, []); return; }
  for (const width of [320, 390, 740]) {
   const { context, page } = await visit(width), horizontal = button(page, 'Rotate horizontally'), vertical = button(page, 'Rotate vertically'), roll = button(page, 'Roll');
   const stick = await joystick(page).boundingBox();
   for (const name of ['Try controls', 'Rotate horizontally', 'Rotate vertically', 'Roll', 'Rise', 'Descend']) {
    const control = button(page, name), box = await control.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= stick.x + 1 && box.y >= 0 && box.y + box.height <= 800, `control overlaps or leaves viewport at ${width}: ${name} ${JSON.stringify(box)} / ${JSON.stringify(stick)}`);
    assert.equal(await control.isEnabled(), true);
   }
   await page.waitForTimeout(150); const startImage = await image(page);
   await horizontal.click(); await drag(page, .3, 0, 450); await page.waitForTimeout(100);
   assert.equal(await horizontal.getAttribute('aria-pressed'), 'true');
   assert.notEqual(await image(page), startImage, 'free rehearsal must visibly rotate the proxy');
   assert.equal((await saved(page)).ledger.draft, undefined, 'testing created a saved motion draft');
   assert.equal(await button(page, 'Finish recording').count(), 0, 'testing started a recording timer');
   await noPlanning(page);
   await button(page, 'Add motion').click(); await page.waitForTimeout(100);
   assert.equal(await horizontal.getAttribute('aria-pressed'), 'false', 'Add motion retained rehearsal rotation mode');
   assert.equal(await image(page), startImage, 'Add motion did not reset the rehearsal pose to the saved source');
   await horizontal.click(); await drag(page, .3, 0, 350);
   const paused = page.getByText(/^Mapping paused/); await paused.waitFor(); await page.waitForTimeout(150); const remaining = await paused.textContent();
   await page.waitForTimeout(650); assert.equal(await paused.textContent(), remaining, 'idle time consumed recording duration');
   assert.equal(await button(page, 'Test recording').count(), 0, 'release saved before explicit Finish');
   await horizontal.click(); await drag(page, .22, .28, 450);
   await vertical.click(); assert.equal(await horizontal.getAttribute('aria-pressed'), 'false'); assert.equal(await vertical.getAttribute('aria-pressed'), 'true');
   await drag(page, 0, .3, 350); await vertical.click(); await drag(page, .22, .28, 450);
   await roll.click(); assert.equal(await vertical.getAttribute('aria-pressed'), 'false'); await drag(page, .3, 0, 350); await roll.click();
   const scene = await finish(page), track = scene.ledger.draft.plan.objects[0].keys;
   assert.ok(scene.ledger.draft.samples.length > 0);
   assert.ok(scene.ledger.draft.samples.every(sample => sample.x > 0 && sample.y > 0), 'rotation gestures contaminated the travel mapping');
   assert.equal(scene.ledger.draft.plan.duration, 5); assert.equal(track[0].t, 0); assert.equal(track.at(-1).t, 5);
   assert.ok(track.some(key => key.rotation.some(value => Math.abs(value) > .1)), 'rotation was absent from the actual recorded root');
   assert.ok(track.every(key => Math.abs(key.position[1] - .5) < 1e-8), 'pitch or roll changed height without an explicit height input');
   const delta = track.at(-1).position.map((value, index) => value - track[0].position[index]), camera = scene.ledger.world.initialState.camera;
   const fx = camera.target[0] - camera.position[0], fz = camera.target[2] - camera.position[2], length = Math.hypot(fx, fz);
   assert.ok(delta[0] * (-fz / length) + delta[2] * (fx / length) > 0, 'stick-right did not travel to screen-right after rotation');
   assert.ok(delta[0] * (fx / length) + delta[2] * (fz / length) > 0, 'stick-up did not travel forward after rotation');
   await noPlanning(page); await page.screenshot({ path: path.join(output, `${width}-controls.png`) });
   console.log(`PASS ${width}: six controls fit; rehearsal is free; Add resets; yaw/pitch/roll preserve stick direction; active-time pause and explicit Finish; no AI calls`);
   if (width === 740) { const exported = await exportReference(page); assertExport(exported); console.log('PASS actual five-second composed MP4 reference: ' + JSON.stringify(exported)); }
   await context.close();
  }
  const height = await visit();
  await button(height.page, 'Add motion').click(); await hold(height.page, 'Rise', 700); await height.page.getByText(/^Mapping paused/).waitFor();
  await hold(height.page, 'Descend', 250); const heightScene = await finish(height.page), heightTrack = heightScene.ledger.draft.plan.objects[0].keys;
  assert.ok(heightTrack.at(-1).position[1] > heightTrack[0].position[1]);
  assert.ok(heightTrack.every(key => key.position[0] === heightTrack[0].position[0] && key.position[2] === heightTrack[0].position[2]), 'height-only input drifted across the floor');
  assert.ok(heightScene.ledger.draft.samples.length > 0 && heightScene.ledger.draft.samples.every(sample => Math.hypot(sample.x, sample.y) >= .08), 'height-only motion has no playable joystick mapping');
  assert.ok(heightScene.ledger.draft.samples.some(sample => sample.y > 0) && heightScene.ledger.draft.samples.some(sample => sample.y < 0));
  await noPlanning(height.page); const heightExport = await exportReference(height.page); assertExport(heightExport);
  console.log('PASS height-only Rise/Descend recording, nonzero mapping and actual five-second MP4: ' + JSON.stringify(heightExport)); await height.context.close();

  const turn = await visit(740, '&water=1'); await button(turn.page, 'Add motion').click();
  await button(turn.page, 'Rotate horizontally').click(); await drag(turn.page, .3, 0, 550);
  const turnScene = await finish(turn.page), turnTrack = turnScene.ledger.draft.plan.objects[0].keys;
  assert.deepEqual(turnTrack[0].position, turnTrack.at(-1).position); assert.equal(turnScene.ledger.draft.plan.duration, 5);
  assert.ok(turnScene.ledger.draft.samples.length > 0); await noPlanning(turn.page); console.log('PASS turn-only recording is retained and mapped'); await turn.context.close();

  const ordinary = await visit(); await button(ordinary.page, 'Add motion').click(); await drag(ordinary.page, 0, .3, 450);
  await ordinary.page.getByText(/^Mapping paused/).waitFor(); assert.equal(await button(ordinary.page, 'Test recording').count(), 0);
  await finish(ordinary.page); await noPlanning(ordinary.page); console.log('PASS ordinary travel pauses on release and finishes explicitly'); await ordinary.context.close();

  const full = await visit(); await button(full.page, 'Add motion').click(); await drag(full.page, 0, .3, 5400);
  await button(full.page, 'Test recording').waitFor(); assert.equal((await saved(full.page)).ledger.draft.plan.duration, 5);
  assert.equal(await button(full.page, 'Finish recording').count(), 0); await noPlanning(full.page);
  console.log('PASS five active seconds completes automatically'); await full.context.close();
  await heightInterruptions();
  assert.deepEqual(errors, []);
 } finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
