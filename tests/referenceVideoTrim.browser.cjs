const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || 'C:/Users/oghen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..'), port = 5210;
const output = path.join(root, '.tmp/reference-video-trim-20261010');
fs.mkdirSync(output, { recursive: true });
const source = ts.createSourceFile('EditStory.tsx', fs.readFileSync(path.join(root, 'src/EditStory.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['REF_VIDEO_MAX_SECONDS', 'REF_VIDEO_MAX_BYTES', 'refVideoInputRef', 'isRefVideoUploading', 'isRefVideoModalOpen',
  'pendingReferenceVideo', 'pendingReferenceVideoRef', 'referenceVideoCallbacksRef', 'activeReferenceVideoUrl',
  'hasReferenceVideo', 'isReferenceVideoActive', 'toggleReferenceVideoActive', 'handleAddVideoClick',
  'readReferenceVideoMetadata', 'uploadReferenceVideoToS3', 'handleReferenceVideoFile', 'handleReferenceVideoUploadSuccess', 'handleCloseReferenceVideoTrim'];
const declarations = new Map(), assignments = new Map(), ui = {};
function visit(node) {
  if (ts.isVariableDeclaration(node)) {
    const text = node.name.getText(source);
    const match = names.find(name => text === name || text.startsWith('[' + name + ','));
    if (match) declarations.set(match, 'const ' + node.getText(source) + ';');
  }
  if (ts.isExpressionStatement(node)) {
    const text = node.getText(source);
    if (text === 'pendingReferenceVideoRef.current = pendingReferenceVideo;') assignments.set('pendingReferenceVideoRef', text);
    if (text === 'referenceVideoCallbacksRef.current = { setReferenceVideoUrls };') assignments.set('referenceVideoCallbacksRef', text);
  }
  if (ts.isJsxSelfClosingElement(node)) {
    const attrs = node.attributes.getText(source);
    if (attrs.includes('ref={refVideoInputRef}')) ui.picker = node.getText(source);
  }
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === 'Button' &&
      node.openingElement.attributes.getText(source).includes('onClick={handleAddVideoClick}')) ui.button = node.getText(source);
  if (ts.isJsxExpression(node) && node.expression?.getText(source).startsWith('pendingReferenceVideo &&')) ui.modal = node.getText(source);
  ts.forEachChild(node, visit);
}
visit(source);
assert.equal(declarations.size, names.length, 'all production reference handlers and state must be found');
assert.ok(assignments.has('referenceVideoCallbacksRef'));
assert.ok(ui.picker && ui.button && ui.modal, 'production Add Video JSX must be found');
let fixture = fs.readFileSync(path.join(__dirname, 'referenceVideoTrim.browser.tsx'), 'utf8');
fixture = fixture.replace('/* EDIT_STORY_DECLARATIONS */', [...declarations].map(([name, declaration]) => declaration + '\n' + (assignments.get(name) || '')).join('\n'))
  .replace('{/* EDIT_STORY_PICKER */}', ui.picker).replace('{/* EDIT_STORY_BUTTON */}', ui.button).replace('{/* EDIT_STORY_MODAL */}', ui.modal);
fixture = ts.transpileModule(fixture, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const passLines = [];
function pass(message) { passLines.push(message); console.log('PASS ' + message); }

(async () => {
  console.log('Starting local reference-video browser harness');
  const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')));
  const server = await createServer({ root, configFile: false, logLevel: 'error',
    cacheDir: path.join(output, 'vite'),
    define: { 'import.meta.env.VITE_CLIK_URL': JSON.stringify('/api') },
    optimizeDeps: { noDiscovery: true, force: true, include: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client', 'react-redux', 'use-sync-external-store/with-selector', '@reduxjs/toolkit', '@mui/material', '@mui/material/styles', '@emotion/react', '@emotion/styled', 'prop-types', 'react-is', 'axios'] },
    server: { host: '127.0.0.1', port, strictPort: true, hmr: false, watch: null },
    plugins: [{ name: 'reference-video-trim-fixture',
      resolveId: id => id === '/fixture.js' ? '\0reference-video-trim-fixture' : undefined,
      load: id => id === '\0reference-video-trim-fixture' ? fixture : undefined,
      configureServer(server) { server.middlewares.use((req, res, next) => {
        if (req.url.startsWith('/__test')) {
          res.setHeader('Content-Type', 'text/html');
          res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/fixture.js"></script>'); return;
        }
        if (req.url.startsWith('/api/') || req.url.startsWith('/__upload/')) {
          res.statusCode = 500; res.end('Real API and upload requests are blocked by the test harness.'); return;
        }
        if (req.url.startsWith('/__media/')) { res.statusCode = 204; res.end(); return; }
        next();
      }); }
    }]
  });
  console.log('Vite fixture created');
  await server.listen();
  console.log('Local fixture server ready at http://127.0.0.1:' + port);
  let browser;
  const browserErrors = [], networkCalls = [];
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    console.log('Headless browser ready');
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(30000);
    page.on('pageerror', error => { browserErrors.push(error.message); console.error('Browser:', error.message); });
    page.on('request', request => {
      if (/\/api\/|\/__upload\//.test(request.url())) networkCalls.push(request.url());
    });
    await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:' + port + '/') ? route.continue() : route.abort());
    const origin = 'http://127.0.0.1:' + port;
    const state = () => page.evaluate(() => window.test.state());
    const confirm = () => page.getByRole('button', { name: 'Trim & Use Video', exact: true });
    const close = () => page.locator('[data-creation-control="clikb.creation.workstation_video_reference_segment.control.close"]');
    async function fresh(surface = 'edit', extra = '') {
      await page.goto(origin + '/__test?surface=' + surface + extra, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.test);
      await page.evaluate(() => localStorage.clear());
    }
    async function pick(expectTrim = true) {
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Add Video', exact: true }).click();
      await (await chooser).setFiles({ name: 'reference.mp4', mimeType: 'video/mp4', buffer: Buffer.from('fixture') });
      if (expectTrim) {
        await confirm().waitFor();
        await page.waitForFunction(() => document.querySelector('[data-creation-control="clikb.creation.workstation_video_reference_segment.control.confirm_process"]')?.disabled === false);
      }
    }
    async function startAt(seconds) {
      const slider = page.getByRole('slider');
      await slider.focus();
      await slider.press('Home');
      for (let step = 0; step < Math.round(seconds * 10); step++) await slider.press('ArrowRight');
      assert.ok(Math.abs(Number(await slider.getAttribute('aria-valuenow')) - seconds) < 0.0001);
      await page.waitForFunction(expected => {
        const input = document.querySelector('.MuiDialog-root input[type="range"]');
        const slider = input?.closest('.MuiSlider-root');
        const thumb = slider?.querySelector('.MuiSlider-thumb');
        if (!input || !slider || !thumb) return false;
        const rail = slider.getBoundingClientRect(), handle = thumb.getBoundingClientRect();
        return Math.abs(handle.x + handle.width / 2 - (rail.x + rail.width * expected / Number(input.max))) < 2;
      }, seconds);
    }
    async function processed() {
      await page.waitForFunction(() => window.test.state().calls.some(call => call.url.endsWith('/del-video')) &&
        (window.test.state().referenceVideoUrls.some(Boolean) || window.test.state().successes.length));
    }
    function trimOf(value) { return value.calls.find(call => call.url.endsWith('/Trim-video')).body; }
    function bounds(trim) { return [trim.start, trim.end].map(seconds => Number(seconds.toFixed(6))); }
    function assertDimensions(trim, width = 1920, height = 1080) {
      assert.equal(trim.inputWidth, width); assert.equal(trim.inputHeight, height);
    }

    await fresh();
    await pick();
    assert.equal((await state()).calls.length, 0, 'choosing a file must wait for explicit trim confirmation');
    await startAt(7);
    await page.screenshot({ path: path.join(output, 'reference-5s-start-7.png') });
    await confirm().click();
    await processed();
    let result = await state(), trim = trimOf(result);
    assert.deepEqual(bounds(trim), [7, 12]); assertDimensions(trim);
    assert.deepEqual(result.calls.map(call => call.method), ['post', 'put', 'post', 'post']);
    assert.ok(result.calls[1].headers['Cache-Control']);
    assert.equal(result.referenceVideoUrls[0], origin + '/__media/trimmed-1.mp4');
    assert.equal(result.referenceVideoUrls[1], ''); assert.deepEqual(result.referenceVideoActiveList, [false, false]);
    assert.deepEqual(result.queued.map(entry => entry.url), [result.referenceVideoUrls[0]]);
    await page.getByRole('button', { name: 'Use Vid', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Using Vid', exact: true }).count(), 1);
    assert.deepEqual((await state()).referenceVideoActiveList, [true, false]);
    await page.screenshot({ path: path.join(output, 'reference-using-vid.png') });
    pass('Actual EditStory Add Video picker opens reference trim; 20s source at 7s produces 7..12, retains 1920x1080, stores URL, toggles Using Vid');

    await fresh(); await pick(); await close().click();
    result = await state(); assert.equal(result.pending, null); assert.deepEqual(result.referenceVideoUrls, ['', '']);
    assert.deepEqual(result.referenceVideoActiveList, [false, false]); assert.deepEqual(result.calls, []); assert.deepEqual(result.queued, []);
    await pick(); assert.equal(await confirm().isEnabled(), true);
    pass('Cancel leaves existing reference state and cleanup queue untouched, sends no upload/transcode requests, and same-file picker reopens');

    await fresh(); await page.evaluate(() => window.test.time(10)); await pick(); await startAt(7); await confirm().click(); await processed();
    result = await state(); trim = trimOf(result); assert.deepEqual(bounds(trim), [7, 17]); assertDimensions(trim);
    pass('10s generation uses the selected 7..17 segment');

    await fresh(); await page.evaluate(() => window.test.time(30)); await pick();
    assert.equal((await state()).pending.durationCap, 15);
    await confirm().click(); await processed(); assert.deepEqual(bounds(trimOf(await state())), [0, 15]);
    pass('Reference duration is capped at 15s for longer generation selections');

    for (const seconds of [3, 5]) {
      await fresh(); await page.evaluate(duration => window.test.metadata({ duration, width: 1080, height: 1920 }), seconds);
      await pick(false); await page.getByRole('button', { name: 'Use Vid', exact: true }).waitFor();
      result = await state(); assert.equal(await page.locator('.MuiDialog-root').count(), 0);
      assert.deepEqual(result.calls.map(call => call.method), ['post', 'put']);
      assert.equal(result.referenceVideoUrls[0], origin + '/__upload/raw-1.mp4');
      assert.deepEqual(result.queued.map(entry => entry.url), [result.referenceVideoUrls[0]]);
    }
    pass('3s and equal 5s sources for 5s generation upload directly, display no trim dialog, and keep the original reference file');

    await fresh(); await pick(); await page.evaluate(() => window.test.failTrim()); await confirm().click();
    await page.getByRole('alert').filter({ hasText: 'Fixture trim failed' }).waitFor();
    await page.waitForFunction(() => !window.test.state().uploading);
    result = await state(); assert.equal(result.calls.filter(call => call.url.endsWith('/del-video')).length, 1);
    assert.equal(result.calls.at(-1).body.url, origin + '/__upload/raw-1.mp4');
    assert.deepEqual(result.referenceVideoUrls, ['', '']); assert.deepEqual(result.queued, []); assert.equal(await confirm().isEnabled(), true);
    await confirm().click(); await processed();
    await page.waitForFunction(() => window.test.state().referenceVideoUrls[0].includes('trimmed-2'));
    result = await state(); assert.equal(result.calls.filter(call => call.url.endsWith('/del-video')).length, 2);
    pass('Failed trim cleans raw upload, preserves references, releases busy state, and retry uploads/trims successfully');

    await fresh(); await pick(); await page.evaluate(() => window.test.holdTrim()); await confirm().click();
    await page.waitForFunction(() => window.test.state().calls.some(call => call.url.endsWith('/Trim-video')));
    await page.evaluate(() => window.test.navigate(1)); await page.evaluate(() => window.test.releaseTrim());
    await page.waitForFunction(() => window.test.state().referenceVideoUrls[0]);
    result = await state(); assert.equal(result.index, 1); assert.equal(result.referenceVideoUrls[1], '');
    await page.getByRole('button', { name: 'Add Video', exact: true }).waitFor();
    await page.evaluate(() => window.test.navigate(0)); await page.getByRole('button', { name: 'Use Vid', exact: true }).waitFor();
    const firstSceneUrl = result.referenceVideoUrls[0];
    await page.evaluate(() => window.test.navigate(1)); await pick(); await startAt(2); await confirm().click();
    await page.waitForFunction(() => window.test.state().referenceVideoUrls[1]);
    result = await state(); assert.equal(result.referenceVideoUrls[0], firstSceneUrl);
    assert.equal(result.referenceVideoUrls[1], origin + '/__media/trimmed-2.mp4');
    await page.getByRole('button', { name: 'Use Vid', exact: true }).click();
    assert.deepEqual((await state()).referenceVideoActiveList, [false, true]);
    await page.evaluate(() => window.test.navigate(0)); await page.getByRole('button', { name: 'Use Vid', exact: true }).click();
    assert.deepEqual((await state()).referenceVideoActiveList, [true, true]);
    pass('Upload completion keeps captured owner after navigation; separate Scene A/B references and Using Vid toggles stay independent');

    await fresh(); await page.evaluate(() => window.test.metadata({ duration: Infinity, width: 0, height: 0 })); await pick(false);
    await page.waitForFunction(() => window.test.state().errors.length > 0);
    result = await state(); assert.match(result.errors[0].message, /readable video at least 2 seconds/);
    assert.deepEqual(result.calls, []); assert.deepEqual(result.referenceVideoUrls, ['', '']);
    assert.equal(await page.locator('.MuiDialog-root').count(), 0);
    await page.waitForFunction(() => !window.test.state().uploading);
    await page.evaluate(() => window.test.metadata({ duration: 20, width: 1920, height: 1080 })); await pick(); await close().click();
    pass('Picker metadata validation rejects unreadable source before network/dialog changes and a fresh valid selection works');

    await fresh('modal'); await confirm().waitFor();
    await page.evaluate(() => window.test.metadata({ duration: Infinity, width: 0, height: 0 }));
    await page.getByRole('alert').filter({ hasText: /valid video duration and dimensions/ }).waitFor();
    assert.equal(await confirm().isEnabled(), false); assert.deepEqual((await state()).calls, []);
    await page.evaluate(() => window.test.metadata({ duration: 20, width: 1920, height: 1080 }));
    await page.waitForFunction(() => !document.querySelector('[data-creation-control="clikb.creation.workstation_video_reference_segment.control.confirm_process"]')?.disabled);
    await startAt(12); await page.evaluate(() => window.test.time(10));
    await page.waitForFunction(() => document.querySelector('input[type="range"]')?.value === '10');
    await page.evaluate(() => window.test.updateCallback()); await confirm().click(); await processed();
    result = await state(); trim = trimOf(result); assert.deepEqual(bounds(trim), [10, 20]);
    assert.equal(result.successes[0].callbackVersion, 1); assert.deepEqual(result.processingChanges, [true, false]);
    pass('Invalid metadata disables processing; valid metadata recovers, cap changes clamp start, and latest callback receives success');

    await fresh('modal'); await confirm().waitFor();
    await page.evaluate(() => window.test.metadata({ duration: 1.5, width: 1920, height: 1080 }));
    await page.getByRole('alert').filter({ hasText: /at least 2 seconds/ }).waitFor(); assert.equal(await confirm().isEnabled(), false);
    assert.deepEqual((await state()).calls, []);
    pass('Segments shorter than 2s are rejected without an upload');

    await fresh('modal'); await confirm().waitFor();
    await page.evaluate(() => window.test.holdTrim()); await confirm().click();
    await page.waitForFunction(() => window.test.state().calls.some(call => call.url.endsWith('/Trim-video')));
    await page.evaluate(() => window.test.unmountModal());
    assert.equal((await state()).calls.filter(call => call.url.endsWith('/del-video')).length, 0, 'do not delete raw while trim still reads it');
    await page.evaluate(() => window.test.releaseTrim());
    await page.waitForFunction(() => window.test.state().calls.filter(call => call.url.endsWith('/del-video')).length === 2);
    result = await state(); assert.deepEqual(result.successes, []);
    assert.deepEqual(result.calls.filter(call => call.url.endsWith('/del-video')).map(call => call.body.url), [origin + '/__upload/raw-1.mp4', origin + '/__media/trimmed-1.mp4']);
    pass('External unmount waits for pending trim then deletes raw and unused result without publishing a stale reference');

    await fresh('modal'); await confirm().waitFor(); await page.evaluate(() => window.test.motion());
    const motionConfirm = page.getByRole('button', { name: 'Confirm & Process', exact: true });
    await motionConfirm.waitFor();
    await page.evaluate(() => window.test.metadata({ duration: 20, width: 1920, height: 1080 }));
    assert.equal(await page.locator('.MuiDialog-root video').evaluate(video => video.style.objectFit), 'cover');
    await motionConfirm.click(); await processed(); trim = trimOf(await state()); assertDimensions(trim, 600, 800);
    assert.deepEqual(bounds(trim), [0, 5]);
    pass('Default motion mode retains image-dimension crop (600x800) and Confirm & Process behavior');

    for (const viewport of [{ width: 1280, height: 600 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      for (const [light, accent] of [[0, '#71d5ee'], [1, '#935fe8']]) {
        await fresh('edit', '&light=' + light + '&accent=' + encodeURIComponent(accent)); await pick();
        const dialog = page.getByRole('dialog');
        const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
        for (const control of [confirm(), cancel]) {
          const box = await control.boundingBox();
          assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width + 1 && box.y + box.height <= viewport.height + 1,
            'trim footer must remain fully visible at ' + JSON.stringify(viewport));
        }
        const metrics = await dialog.evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth }));
        assert.ok(metrics.scrollWidth <= metrics.width + 1, 'dialog must not overflow horizontally');
        const expectedAccent = await page.evaluate(color => {
          const probe = document.createElement('span'); probe.style.color = color; document.body.appendChild(probe);
          const computed = getComputedStyle(probe).color; probe.remove(); return computed;
        }, accent);
        await page.waitForFunction(color => {
          const button = document.querySelector('[data-creation-control="clikb.creation.workstation_video_reference_segment.control.confirm_process"]');
          if (!button) return false;
          const actual = getComputedStyle(button).backgroundColor.match(/[\d.]+/g);
          const expected = color.match(/[\d.]+/g);
          return actual.slice(0, 3).join(',') === expected.slice(0, 3).join(',') && (actual.length < 4 || Number(actual[3]) >= .8);
        }, expectedAccent);
        assert.equal(await confirm().evaluate(element => getComputedStyle(element).color), light ? 'rgb(255, 255, 255)' : 'rgb(0, 0, 0)');
        assert.equal(await page.locator('.MuiDialog-root video').evaluate(video => video.style.objectFit), 'contain');
        await page.screenshot({ path: path.join(output, `reference-${viewport.width}x${viewport.height}-${light ? 'light-purple' : 'dark-cyan'}.png`) });
        await cancel.click(); assert.deepEqual((await state()).calls, []);
      }
    }
    pass('App accent colors and natural contain preview verified in dark/light; mobile390x844 and desktop1280x600 keep Cancel/Trim footer visible without horizontal overflow');

    await page.setViewportSize({ width: 1280, height: 900 }); await fresh('context');
    await page.locator('[data-creation-control="clikb.creation.workstation_video.control.open_context"]').click();
    await page.getByText('Frame History', { exact: true }).waitFor();
    assert.equal(await page.getByText(/Motion Transfer/i).count(), 0);
    assert.equal(await page.getByRole('tab', { includeHidden: true }).count(), 0);
    const history = page.locator('[data-creation-control="clikb.creation.workstation_video_context.control.frame_history_video_1"]');
    await history.click();
    await page.screenshot({ path: path.join(output, 'video-context-frame-preview.png') });
    await page.locator('[data-creation-control="clikb.creation.workstation_video_context.control.use_frame"]').waitFor();
    await page.locator('[data-creation-control="clikb.creation.workstation_video_context.control.close_frame_preview"]').click();
    await page.locator('[data-creation-control="clikb.creation.workstation_video_context.control.default_frame"]').click();
    assert.deepEqual((await state()).contextCalls, ['default']);
    const direct = page.locator('[data-direct-video-toggle="true"]');
    await direct.click(); await page.waitForFunction(() => window.test.state().contextDirect);
    await direct.click(); await page.waitForFunction(() => !window.test.state().contextDirect);
    await page.locator('[data-creation-control="clikb.creation.workstation_video_context.control.draw"]').click();
    await page.getByText('Draw Director', { exact: true }).waitFor();
    await page.getByPlaceholder('Text to stamp on image').fill('Test direction');
    assert.equal(await page.getByText('Save Drawn Image', { exact: true }).isEnabled(), true);
    await page.screenshot({ path: path.join(output, 'video-context-draw-director.png') });
    assert.deepEqual((await state()).calls, []);
    pass('Real MediaPromptVideo has Frame History, frame preview, Default, Direct Video and Draw Director; legacy Motion Transfer tabs are absent');

    assert.deepEqual(networkCalls, [], 'all upload/transcode requests must stay in the local Axios adapter');
    assert.deepEqual(browserErrors, []);
    pass('No real upload/transcode/provider requests and no browser errors');
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ passed: passLines, browserErrors, networkCalls, media: 'Mocked duration/dimensions and all Axios requests; real React production modal and extracted EditStory reference handlers/JSX.' }, null, 2));
  } catch (error) {
    fs.writeFileSync(path.join(output, 'failure.txt'), String(error.stack || error)); throw error;
  } finally {
    if (browser) await browser.close(); await server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
