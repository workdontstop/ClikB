const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || path.resolve(__dirname, '../.tmp/concierge-browser-deps/node_modules/playwright'));
(async () => {
    const root = path.resolve(__dirname, '..'), out = path.join(root, '.tmp/spatial-upscale-browser');
    fs.mkdirSync(out, { recursive: true });
    const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')));
    const server = await createServer({ root, configFile: false, cacheDir: path.join(out, 'vite'), esbuild: { jsx: 'automatic' }, optimizeDeps: { entries: [path.join(root, 'tests/spatialMvp.browser.tsx')] }, server: { host: '127.0.0.1', port: 5215, strictPort: true, hmr: false, watch: null }, plugins: [{ name: 'local-upscale', configureServer(server) { server.middlewares.use((req, res, next) => {
        if (req.url.startsWith('/__upscale')) { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/tests/spatialMvp.browser.tsx"></script>'); } else next();
    }); } }] });
    await server.listen();
    let browser;
    try {
        browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
        const page = await browser.newPage({ viewport: { width: 740, height: 1000 } }), errors = [], external = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => { if (route.request().url().startsWith('http://127.0.0.1:5215/')) return route.continue(); external.push(route.request().url()); return route.abort(); });
        await page.goto('http://127.0.0.1:5215/__upscale?board&hd&w=540&h=920');
        await page.locator('[data-spatial-generation-board]').waitFor();
        await page.getByRole('button', { name: 'Motion 1 · Movement', exact: true }).click();
        await page.getByRole('tab', { name: 'Results', exact: true }).click();
        const forward = page.locator('[data-spatial-result="forward"]');
        await forward.getByRole('button', { name: 'Upscale again', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Upscale this moment?', exact: true });
        await dialog.getByRole('button', { name: '1080p · 23 P', exact: true }).waitFor();
        assert.equal(await dialog.getByRole('button', { name: '1080p · 23 P', exact: true }).getAttribute('aria-pressed'), 'true');
        await dialog.getByRole('button', { name: '2K · 46 P', exact: true }).click();
        assert.equal((await page.evaluate(() => window.mvp.requests)).filter(request => request.action === 'upscale').length, 0);
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        assert.equal((await page.evaluate(() => window.mvp.requests)).filter(request => request.action === 'upscale').length, 0);
        await forward.getByRole('button', { name: 'Upscale again', exact: true }).click();
        await dialog.getByRole('button', { name: '2K · 46 P', exact: true }).click();
        await page.screenshot({ path: path.join(out, 'resolution-choice.png') });
        await dialog.getByRole('button', { name: 'Confirm upscale · 46 P', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        const requests = await page.evaluate(() => window.mvp.requests.filter(request => request.action === 'upscale'));
        assert.equal(requests.length, 1); assert.equal(requests[0].targetResolution, '2k'); assert.equal(requests[0].quoteKey, 'upscale-2k');
        await page.waitForFunction(() => window.mvp.snapshot().scene.ledger.jobs[0].upscale.status === 'generating');
        assert.equal(await forward.getByRole('button', { name: 'Upscale again', exact: true }).isDisabled(), true);
        assert.equal(await forward.getByRole('button', { name: 'Use HD', exact: true }).isEnabled(), true);
        assert.equal((await page.evaluate(() => window.mvp.snapshot())).scene.ledger.jobs[0].upscaleHistory[0].output, '/fixture/hd.mp4');
        assert.deepEqual(errors, []); assert.deepEqual(external, []);
        console.log('PASS real SpatialStudio + board: 1080p/2K prices, default selection, cancelled choice submits nothing, repeated HD retains earlier output and active submission disables duplicate upscale.');
        console.log('Screenshot: ' + path.join(out, 'resolution-choice.png'));
    } finally { await browser?.close(); await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
