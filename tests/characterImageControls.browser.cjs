const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || path.resolve(__dirname, '../.tmp/concierge-browser-deps/node_modules/playwright'));

(async () => {
  const root = path.resolve(__dirname, '..');
  const output = path.join(root, '.tmp/character-reference-review');
  fs.mkdirSync(output, { recursive: true });
  const { createServer } = await import('vite');
  const server = await createServer({ root, configFile: false, logLevel: 'error', cacheDir: output + '/vite', optimizeDeps: { entries: ['tests/fixtures/character-image-controls.html'] }, esbuild: { jsx: 'automatic' }, server: { host: '127.0.0.1', port: 5231, strictPort: true, hmr: false } });
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  const checks = [], failures = [], errors = [];
  const check = async (name, fn) => { try { await fn(); checks.push(name); } catch (error) { failures.push({ name, error: error.message }); } };
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    for (const [device, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844], ['small-mobile', 320, 568]]) {
      for (const theme of ['light', 'dark']) {
        const name = `${device}-${theme}`;
        const page = await browser.newPage({ viewport: { width, height } });
        page.on('pageerror', error => errors.push({ name, error: error.message }));
        await page.route('**/*', route => route.request().url().startsWith(origin) || /^(data:|blob:)/.test(route.request().url()) ? route.continue() : route.abort());
        await page.goto(origin + '/tests/fixtures/character-image-controls.html?theme=' + theme, { waitUntil: 'domcontentloaded' });
        const recreate = page.getByRole('button', { name: 'Recreate', exact: true });
        const edit = page.getByRole('button', { name: 'Edit', exact: true });
        const upload = page.getByRole('button', { name: 'Upload replacement character image', exact: true });
        await recreate.waitFor({ timeout: 60000 });
        await check(name + ': title, controls, and prompt fit within panel', async () => {
          const metrics = await page.locator('[data-character-panel]').evaluate(panel => {
            const panelBounds = panel.getBoundingClientRect();
            const buttons = [...panel.querySelectorAll('button')].map(button => {
              const bounds = button.getBoundingClientRect();
              return { left: bounds.left, right: bounds.right, height: bounds.height };
            });
            return { viewport: innerWidth, documentOverflow: document.documentElement.scrollWidth - innerWidth, panelOverflow: panel.scrollWidth - panel.clientWidth, panelWidth: panelBounds.width, buttons };
          });
          assert.ok(metrics.documentOverflow <= 1, JSON.stringify(metrics));
          assert.ok(metrics.panelOverflow <= 1, JSON.stringify(metrics));
          if (device === 'desktop') assert.equal(metrics.panelWidth, 420);
          for (const button of metrics.buttons) {
            assert.ok(button.left >= 0 && button.right <= metrics.viewport + 1, JSON.stringify(metrics));
            assert.ok(button.height >= 30, JSON.stringify(button));
          }
        });
        await check(name + ': modes are mutually exclusive and active click keeps selection', async () => {
          assert.equal(await recreate.getAttribute('aria-pressed'), 'true');
          assert.equal(await edit.getAttribute('aria-pressed'), 'false');
          await edit.click();
          assert.equal(await edit.getAttribute('aria-pressed'), 'true');
          assert.equal(await recreate.getAttribute('aria-pressed'), 'false');
          await edit.click();
          assert.equal(await edit.getAttribute('aria-pressed'), 'true');
          await recreate.click();
          assert.equal(await recreate.getAttribute('aria-pressed'), 'true');
          assert.equal(await edit.getAttribute('aria-pressed'), 'false');
        });
        await check(name + ': upload invokes callback once', async () => {
          await upload.click();
          assert.equal(await page.locator('[data-uploads]').textContent(), '1');
        });
        await check(name + ': Edit unavailable until an image exists', async () => {
          await page.evaluate(() => window.characterControlsFixture.setCanEdit(false));
          await page.waitForFunction(() => document.querySelector('button[value="edit"]')?.disabled === true);
          assert.equal(await edit.isDisabled(), true);
          assert.equal(await recreate.isEnabled(), true);
          assert.equal(await upload.isEnabled(), true);
          await page.evaluate(() => window.characterControlsFixture.setCanEdit(true));
          await page.waitForFunction(() => document.querySelector('button[value="edit"]')?.disabled === false);
        });
        await page.screenshot({ path: path.join(output, name + '.png') });
        await check(name + ': upload state shows spinner and locks actions', async () => {
          await page.evaluate(() => window.characterControlsFixture.setUploading(true));
          await page.waitForFunction(() => document.querySelector('[role="progressbar"]') !== null);
          assert.equal(await recreate.isDisabled(), true);
          assert.equal(await edit.isDisabled(), true);
          assert.equal(await upload.isDisabled(), true);
          assert.equal(await upload.getByRole('progressbar').count(), 1);
          await page.evaluate(() => window.characterControlsFixture.setUploading(false));
          await page.waitForFunction(() => document.querySelector('[role="progressbar"]') === null);
          assert.equal(await upload.isEnabled(), true);
        });
        await check(name + ': generation lock disables every action', async () => {
          await page.evaluate(() => window.characterControlsFixture.setDisabled(true));
          await page.waitForFunction(() => document.querySelector('button[value="recreate"]')?.disabled === true);
          assert.equal(await recreate.isDisabled(), true);
          assert.equal(await edit.isDisabled(), true);
          assert.equal(await upload.isDisabled(), true);
        });
        await page.close();
      }
    }
    const result = { checks, failures, errors };
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    assert.deepEqual(errors, []);
    assert.deepEqual(failures, []);
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
