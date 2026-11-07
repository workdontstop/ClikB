const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || path.resolve(__dirname, '../.tmp/concierge-browser-deps/node_modules/playwright'));
const root = path.resolve(__dirname, '..');
// Mount the actual navigation component, Redux reducers and router over a
// bright, varied backdrop. No application servers, model calls or mocked CSS.
const fixture = ts.transpileModule(`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {MemoryRouter} from 'react-router-dom';
import BottomMenu from '/src/BottomMenu.tsx';
import {store} from '/src/store.ts';
import {APP_ACCENT_COLORS} from '/src/appAccentColors.ts';
import {setThemePreference,setAppColorDark,setAppColorLight} from '/src/settingsSlice.ts';
import {matchMobile} from '/src/DetectDevice.ts';
createRoot(document.getElementById('root')).render(
  <Provider store={store}><MemoryRouter initialEntries={['/images']}>
    <BottomMenu activeIndex={1} setActiveIndex={()=>{}} isFullscreen={false} isMenuOpen={false}
      MenuOpenb={false} setMenuOpenb={()=>{}} setIsMenuOpen={()=>{}} setminimisePrompt={()=>{}}/>
  </MemoryRouter></Provider>
);
window.test={
  settings:()=>store.getState().settings, colors:APP_ACCENT_COLORS, mobile:matchMobile,
  appearance:(mode,color)=>{
    store.dispatch(setThemePreference(mode));
    store.dispatch(mode==='dark'?setAppColorDark(color):setAppColorLight(color));
  }
};
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;

const rgb = css => {
  const match = /^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/.exec(css);
  assert.ok(match, `Unrecognized computed color ${css}`);
  return match.slice(1, 4).map(Number).concat(match[4] === undefined ? 1 : Number(match[4]));
};
const luminance = channels => channels.slice(0, 3).map(channel => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
const contrast = (one, two) => {
  const a = luminance(one), b = luminance(two);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
};
const composite = (top, bottom) => top.slice(0, 3).map((channel, index) => channel * top[3] + bottom[index] * (1 - top[3]));

(async () => {
  const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')));
  const server = await createServer({ root, configFile: false, logLevel: 'error', cacheDir: path.join(root, 'node_modules/.tmp/bottom-menu-appearance-vite'),
    optimizeDeps: { noDiscovery: true, include: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom/client', 'react-redux', 'react-router-dom', 'react-device-detect', 'use-sync-external-store/with-selector', 'use-sync-external-store/shim/with-selector', '@reduxjs/toolkit', '@mui/material', '@mui/material/styles', 'prop-types', 'react-is', '@emotion/react', '@emotion/styled', ...['Photo', 'TouchApp', 'Person', 'Weekend', 'Widgets', 'AddCircle', 'HorizontalSplit', 'Menu', 'Search', 'AutoAwesome', 'RocketLaunch', 'Close'].map(name => '@mui/icons-material/' + name)] },
    server: { host: '127.0.0.1', port: 5203, strictPort: true, hmr: false }, plugins: [{ name: 'bottom-menu-appearance',
      resolveId(id) { if (id === '/fixture.js') return '\0bottom-menu-appearance'; },
      load(id) { if (id === '\0bottom-menu-appearance') return fixture; },
      configureServer(server) { server.middlewares.use((req, res, next) => {
        if (req.url.startsWith('/__test')) {
          res.setHeader('Content-Type', 'text/html');
          res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;min-height:100%;background:linear-gradient(90deg,#fff 0%,#ff0080 20%,#00ff80 40%,#ffff00 60%,#00bfff 80%,#000 100%)}body{height:100vh}*,*::before,*::after{transition:none!important;animation:none!important}</style><div id="root"></div><script type="module" src="/fixture.js"></script>');
          return;
        }
        next();
      }); }
    }] });
  await server.listen();
  let browser;
  let combinations = 0, minimumActive = Infinity, minimumInactive = Infinity;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
    for (const mobile of [false, true]) {
      const context = await browser.newContext({ viewport: { width: mobile ? 390 : 1280, height: mobile ? 844 : 800 },
        isMobile: mobile, deviceScaleFactor: 1,
        ...(mobile ? { userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' } : {}) });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => { errors.push(error.message); console.error('Browser:', error.message); });
      page.on('console', message => { if (message.type() === 'error') console.error('Console:', message.text()); });
      page.setDefaultTimeout(60000);
      await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:5203/') ? route.continue() : route.abort());
      await page.goto('http://127.0.0.1:5203/__test', { waitUntil: 'domcontentloaded' });
      assert.deepEqual(errors, [], 'Fixture startup errors');
      await Promise.race([
        page.getByRole('button', { name: 'Shorts', exact: true }).waitFor(),
        page.waitForEvent('pageerror').then(error => { throw error; }),
      ]);
      const initial = await page.evaluate(() => ({ settings: window.test.settings(), mobile: window.test.mobile }));
      assert.equal(initial.settings.appColorLight, '#101010');
      assert.equal(initial.settings.appColorDark, '#FFFFFF');
      assert.equal(initial.mobile, mobile, 'The actual device branch must match this viewport fixture.');
      const palettes = await page.evaluate(() => window.test.colors);
      assert.equal(palettes.light.length, 20); assert.equal(palettes.dark.length, 20);
      for (const mode of ['light', 'dark']) for (const color of palettes[mode]) {
        await page.evaluate(({ mode, value }) => window.test.appearance(mode, value), { mode, value: color.value });
        await page.waitForFunction(({ dark, color }) => {
          const button = document.querySelector('[data-ai-action="clikb.navigation.bottom_menu.action.shorts"]');
          const svg = button?.querySelector('svg');
          if (!svg) return false;
          const resolved = document.createElement('div'); resolved.style.color = color; document.body.appendChild(resolved);
          const wanted = getComputedStyle(resolved).color; resolved.remove();
          return window.test.settings().darkMode === dark && getComputedStyle(svg.parentElement).backgroundColor === wanted;
        }, { dark: mode === 'dark', color: color.value });
        const measured = await page.evaluate(() => {
          const active = document.querySelector('[data-ai-action="clikb.navigation.bottom_menu.action.shorts"]');
          const icon = active.querySelector('svg'), pill = icon.parentElement, nav = active.parentElement, backdrop = nav.parentElement;
          const rect = element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
          return {
            selected: active.classList.contains('Mui-selected'),
            icon: getComputedStyle(icon).color, pill: getComputedStyle(pill).backgroundColor,
            backdrop: getComputedStyle(backdrop).backgroundColor,
            inactive: [...nav.querySelectorAll('button:not(.Mui-selected) svg')].map(svg => getComputedStyle(svg).color),
            iconRect: rect(icon), pillRect: rect(pill), navRect: rect(nav),
            documentWidth: document.documentElement.scrollWidth, viewportWidth: window.innerWidth,
            actions: [...nav.querySelectorAll('button')].map(rect),
          };
        });
        const contextLabel = `${mobile ? 'mobile' : 'desktop'} ${mode} ${color.name}`;
        assert.equal(measured.selected, true, contextLabel);
        assert.equal(rgb(measured.pill)[3], 1, `${contextLabel}: selected accent must be opaque over content`);
        const activeContrast = contrast(rgb(measured.icon), rgb(measured.pill)); minimumActive = Math.min(minimumActive, activeContrast);
        assert.ok(activeContrast >= 4.5, `${contextLabel}: selected icon contrast ${activeContrast.toFixed(2)}`);
        assert.equal(measured.inactive.length, 4, contextLabel);
        // Against the worst underlying content for each mode, the translucent
        // backdrop must still keep every inactive control easy to distinguish.
        const worstBackdrop = composite(rgb(measured.backdrop), mode === 'dark' ? [255, 255, 255] : [0, 0, 0]);
        for (const inactive of measured.inactive) {
          const ratio = contrast(rgb(inactive), worstBackdrop); minimumInactive = Math.min(minimumInactive, ratio);
          assert.ok(ratio >= 4.5, `${contextLabel}: inactive icon contrast ${ratio.toFixed(2)}`);
        }
        assert.ok(measured.documentWidth <= measured.viewportWidth, `${contextLabel}: horizontal overflow`);
        assert.ok(measured.iconRect.width >= 24 && measured.iconRect.height >= 24, `${contextLabel}: icon became too small`);
        assert.ok(measured.pillRect.left >= measured.navRect.left && measured.pillRect.right <= measured.navRect.right, `${contextLabel}: selected pill escapes the navigation`);
        for (const action of measured.actions) assert.ok(action.left >= 0 && action.right <= measured.viewportWidth && action.width >= 44 && action.height >= 44, `${contextLabel}: action target is clipped or too small`);
        combinations++;
      }
      // Native navigation must continue to move selection after palette changes.
      await page.getByRole('button', { name: 'Cinema', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-ai-action="clikb.navigation.bottom_menu.action.cinema"]')?.classList.contains('Mui-selected'));
      await page.getByRole('button', { name: 'Shorts', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-ai-action="clikb.navigation.bottom_menu.action.shorts"]')?.classList.contains('Mui-selected'));
      for (const mode of ['light', 'dark']) {
        await page.evaluate(mode => window.test.appearance(mode, mode === 'dark' ? '#FFFFFF' : '#101010'), mode);
        await page.waitForFunction(mode => window.test.settings().darkMode === (mode === 'dark'), mode);
        fs.mkdirSync(path.join(root, '.tmp/bottom-menu-appearance'), { recursive: true });
        await page.screenshot({ path: path.join(root, `.tmp/bottom-menu-appearance/${mobile ? 'mobile' : 'desktop'}-${mode}.png`) });
      }
      assert.deepEqual(errors, [], `${mobile ? 'mobile' : 'desktop'} browser errors`);
      await context.close();
    }
    console.log(`PASS real BottomMenu: neutral defaults; ${combinations} palette/device combinations; active contrast >= ${minimumActive.toFixed(2)}, inactive worst-backdrop contrast >= ${minimumInactive.toFixed(2)}; no overflow; native route selection; no browser errors.`);
  } finally { await browser?.close(); await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
