const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs'), ts = require('typescript');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..'), port = 5238;
const output = path.join(root, '.tmp/model-example-viewer-browser'); fs.mkdirSync(output, { recursive: true });
// Include the desktop rule that ships with App around the picker.
const appSource = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8');
const appScrollbarStyles = appSource.match(/@media \(hover: hover\) and \(pointer: fine\)\s*\{\s*\/\* WebKit browsers[\s\S]*?(?=`\s*\}\}\s*\/>)/)?.[0];
assert.ok(appScrollbarStyles);
const desktopScrollbarStyles = appScrollbarStyles.replace(/\$\{darkModeReducer \? "[^"]+" : "([^"]+)"\}/g, '$1');
const keys = ['fluxUltra2', 'Imagen2', 'GPT Image 2.5 Sunburst', 'GPT Image 2.5 Flare', 'Imagen', 'fluxUltra', 'minimax', 'minimax2', 'Schnell'];
const images = Object.fromEntries(keys.map((key, index) => [key, `https://samples.invalid/model-${index}.png`]));
const fixture = ts.transpileModule(`
import React,{useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';
import {Provider,useDispatch} from 'react-redux';import {MemoryRouter} from 'react-router-dom';
import {ThemeProvider,createTheme,Button} from '@mui/material';
import {store} from '/src/store';import {loadImageModelExampleSets} from '/src/imageModelExamplesSlice';
import ModelSelectionModal from '/src/ModelSelectionModal';import PromptToolbar from '/src/PromptToolbar';
import {setThemePreference} from '/src/settingsSlice';
import '/src/index.css';
window.fixture={store,loadImageModelExampleSets,selections:[],styles:[]};
const dark=location.search.includes('dark');
store.dispatch(setThemePreference(dark?'dark':'light'));
function App(){const dispatch=useDispatch();const [open,setOpen]=useState(true),[model,setModel]=useState('Schnell'),[stylesOpen,setStylesOpen]=useState(false),[style,setStyle]=useState('Auto');
useEffect(()=>{dispatch(loadImageModelExampleSets());},[dispatch]);
const select=(name)=>{window.fixture.selections.push(name);setModel(name);};
return <><Button id="models" onClick={()=>setOpen(true)}>Models</Button><Button id="styles" onClick={()=>setStylesOpen(true)}>Styles</Button>
<ModelSelectionModal overlayZIndex={1000002} open={open} setOpen={setOpen} handleSelect={name=>{select(name);setOpen(false);}} updateModelWithoutClosing={select} activeModelName={model}
models={['Imagen','Gpt Image','fluxUltra','minimax','Schnell'].map(name=>({name,img:''}))} currentImage="" darkModeReducer={dark} darkMode={dark} matchMobile={innerWidth<600} gradient="" labelsByIndex={{}} colorsByLabel={{}}/>
<PromptToolbar minimizeMode={2} parsedKeyPoints={[]} referenceImages={[]} selectedStyle={style}
setSelectedStyle={value=>{window.fixture.styles.push(value);setStyle(value);}}
styleModalOpen={stylesOpen} onStyleModalOpenChange={setStylesOpen}/></>;}
createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter><ThemeProvider theme={createTheme({palette:{mode:dark?'dark':'light'}})}><App/></ThemeProvider></MemoryRouter></Provider>);
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;

(async () => {
  const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')));
  const requests = [], errors = []; let catalog = [{ id: '1', name: 'Comparison', model_images: images }];
  const server = await createServer({ root, configFile: false, logLevel: 'error', cacheDir: output + '/vite',
    define: { 'import.meta.env.VITE_CLIK_URL': "'/api'", 'import.meta.env.VITE_APPX_STATE': "'prod'" },
    server: { host: '127.0.0.1', port, strictPort: true, hmr: false }, plugins: [{
      name: 'viewer-fixture', enforce: 'pre', resolveId(id) { if (id === '/fixture.js') return '\0viewer-fixture'; },
      load(id) { if (id === '\0viewer-fixture') return fixture; },
      configureServer(s) { s.middlewares.use((req, res, next) => {
        if (req.url.startsWith('/__test')) { res.setHeader('Content-Type', 'text/html'); res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>' + desktopScrollbarStyles + '</style><div id="root"></div><script type="module" src="/fixture.js"></script>'); return; }
        if (req.url.endsWith('/get-artstyle-images')) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ images: [
            { artstyle_name: 'Cinematic', image_url: 'https://samples.invalid/cinematic.png' },
            { artstyle_name: 'Final Fantasy', image_url: 'https://samples.invalid/fantasy.png' },
          ] }));
          return;
        }
        if (!req.url.startsWith('/api/')) return next();
        requests.push({ method: req.method, url: req.url });
        if (req.method !== 'GET' || req.url !== '/api/image-model-example-sets') { res.statusCode = 400; res.end('Unexpected API call'); return; }
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ sets: catalog }));
      }); },
    }] });
  await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const mobile of [false, true]) {
      catalog = [{ id: '1', name: 'Comparison', model_images: images }];
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: mobile, hasTouch: mobile });
      const page = await context.newPage(); page.setDefaultTimeout(30000);
      page.on('pageerror', error => errors.push(error.message));
      await page.route('https://samples.invalid/**', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600"><defs><linearGradient id="g" x2="0.7" y2="1"><stop stop-color="#243c63"/><stop offset="1" stop-color="#bc863c"/></linearGradient></defs><rect width="900" height="1600" fill="url(#g)"/><circle cx="620" cy="320" r="160" fill="#bdd7df"/><path d="M0 1150 L400 600 L900 1050 V1600 H0" fill="#172337"/><text x="80" y="1450" fill="white" font-size="60">Sample image</text></svg>' }));
      await page.goto(`http://127.0.0.1:${port}/__test${mobile ? '?dark' : ''}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => window.fixture?.store.getState().imageModelExamples.status === 'ready');
      const anotherSet = page.getByRole('button', { name: 'Show another image set', exact: true });
      assert.equal(await anotherSet.isDisabled(), true, 'A single set cannot be switched');
      // MUI disables pointer events on the button when only one set exists.
      // Verify the actual hovered surface, including the tooltip wrapper.
      for (const target of [anotherSet.getByText('Image model', { exact: true }), anotherSet.locator('svg')]) {
        const bounds = await target.boundingBox();
        const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        assert.equal(await page.evaluate(({ x, y }) => getComputedStyle(document.elementFromPoint(x, y)).cursor, point), 'pointer',
          'The label and icon must retain the pointer cursor even with a single comparison set');
      }
      await anotherSet.locator('..').hover();
      const setHint = page.getByRole('tooltip'); await setHint.waitFor();
      const hintBounds = await setHint.locator('.MuiTooltip-tooltip').boundingBox();
      const hintPanelBounds = await page.getByRole('dialog', { name: 'Models', exact: true }).boundingBox();
      assert.ok(hintBounds.x >= hintPanelBounds.x && hintBounds.x + hintBounds.width <= hintPanelBounds.x + hintPanelBounds.width,
        'The hint must stay horizontally inside the model popup');
      assert.equal(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest('[role="tooltip"]')),
        { x: hintBounds.x + hintBounds.width / 2, y: hintBounds.y + hintBounds.height / 2 }), true,
        'The comparison hint must appear above the elevated Creation Deck model popup');
      await page.screenshot({ path: output + (mobile ? '/mobile-image-set-hint.png' : '/desktop-image-set-hint.png') });
      await page.mouse.move(2, 2); await setHint.waitFor({ state: 'hidden' });
      assert.equal(await page.getByRole('button', { name: 'Example sets', exact: true }).count(), 0, 'Set management stays dev-only');
      catalog = Array.from({ length: 9 }, (_, set) => ({ id: String(set + 1), name: `Comparison ${set + 1}`,
        model_images: Object.fromEntries(keys.map((key, image) => [key, `https://samples.invalid/set-${set + 1}/model-${image}.png`])) }));
      await page.evaluate(async () => { await window.fixture.store.dispatch(window.fixture.loadImageModelExampleSets(true)); });
      assert.equal(await anotherSet.isEnabled(), true);
      const reads = requests.length;
      const models = page.getByRole('dialog', { name: 'Models', exact: true });
      assert.equal(await models.getByAltText(/conversation robot/).count(), 0, 'The creation model modal uses text-only concierge choices');
      const modelBounds = await models.boundingBox();
      const glass = await models.evaluate(panel => getComputedStyle(panel).backgroundImage);
      assert.equal(modelBounds.width, mobile ? 390 : 640);
      assert.ok(Math.abs(modelBounds.height - (mobile ? 844 * 0.9 : 720)) < 1);
      assert.deepEqual(await models.locator('.social-picker-scroll').evaluateAll(regions => regions.map(region => {
        const style = getComputedStyle(region);
        return [style.scrollbarWidth, style.overflowX, style.overflowY, getComputedStyle(region, '::-webkit-scrollbar').display];
      })), [['none', 'auto', 'hidden', 'none'], ['none', 'auto', 'hidden', 'none']]);
      const creationModels = models.locator('.social-picker-scroll').nth(1);
      assert.ok(await creationModels.evaluate(row => {
        row.scrollLeft = row.scrollWidth;
        const canScroll = row.scrollLeft > 0;
        row.scrollLeft = 0;
        return canScroll;
      }), 'The models beyond the edge remain reachable');
      if (mobile) {
        assert.ok(modelBounds.y > 70);
        await page.touchscreen.tap(195, 12);
        await models.waitFor({ state: 'hidden' });
        await page.locator('#models').tap();
      }
      const initialSettings = await page.evaluate(() => JSON.stringify(window.fixture.store.getState().settings));
      const selectorImages = models.locator('[data-ai-action^="clikb.creation.models.action.image_"] img');
      const setLabel = anotherSet.getByText('Image model', { exact: true });
      const setIcon = anotherSet.locator('svg');
      assert.equal(await setLabel.evaluate(node => getComputedStyle(node).cursor), 'pointer');
      assert.equal(await setIcon.evaluate(node => getComputedStyle(node).cursor), 'pointer');
      for (let n = 0; n < 12; n++) {
        const before = await selectorImages.evaluateAll(nodes => nodes.map(node => node.src));
        await (n % 2 ? setIcon : setLabel)[mobile ? 'tap' : 'click']();
        assert.equal(await anotherSet.evaluate(node => getComputedStyle(node).outlineStyle), 'none', 'Pointer activation must not leave a focus border on the image-set button');
        const after = await selectorImages.evaluateAll(nodes => nodes.map(node => node.src));
        assert.notEqual(after[0], before[0], 'Each click must choose a different comparison set');
        const setPath = after[0].slice(0, after[0].lastIndexOf('/') + 1);
        assert.ok(after.every(url => url.startsWith(setPath)), 'All model images must change to the same comparison set');
        assert.equal(await models.isVisible(), true);
      }
      assert.deepEqual(await page.evaluate(() => window.fixture.selections), [], 'Switching examples never selects a model or tier');
      assert.equal(await page.evaluate(() => JSON.stringify(window.fixture.store.getState().settings)), initialSettings);
      assert.equal(requests.length, reads, 'Switching examples uses the cached sets without API calls');
      await page.mouse.move(2, 2);
      await page.screenshot({ path: output + (mobile ? '/mobile-image-set-switch.png' : '/desktop-image-set-switch.png') });
      const zoom = page.getByRole('button', { name: 'Zoom GPT Image 2.6 Flare example', exact: true });
      await zoom.scrollIntoViewIfNeeded();
      assert.ok((await page.locator('.model-example-zoom-icon').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).opacity))).every(opacity => opacity === '0'), 'Icons must be hidden on initial load');
      await page.screenshot({ path: output + (mobile ? '/mobile-selector-clean.png' : '/desktop-selector-clean.png') });
      if (!mobile) {
        await zoom.hover(); await page.waitForTimeout(180);
        assert.equal(await zoom.locator('.model-example-zoom-icon').evaluate(node => getComputedStyle(node).opacity), '1');
      }
      await zoom[mobile ? 'tap' : 'click']({ position: { x: 8, y: 8 } });
      const viewer = page.getByTestId('image-model-example-viewer'); await viewer.waitFor();
      assert.equal(await viewer.locator('img').getAttribute('alt'), 'GPT Image 2.6 Flare example');
      assert.ok((await viewer.textContent()).includes('4 / 9'));
      await viewer.locator('img').click();
      assert.equal(await viewer.isVisible(), true, 'Clicking the displayed image must keep the preview open');
      assert.deepEqual(await page.evaluate(() => window.fixture.selections), [], 'Opening zoom must not select a model');
      await viewer.getByRole('button', { name: 'Next model image' }).click();
      assert.equal(await viewer.locator('img').getAttribute('alt'), 'Nano Banana 2.1 example');
      await viewer.getByRole('button', { name: 'Previous model image' }).click();
      if (mobile) {
        const stage = await page.getByTestId('image-model-example-stage').boundingBox();
        const cdp = await context.newCDPSession(page);
        const y = stage.y + stage.height / 2, x = stage.x + stage.width * .75;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 160, y }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
        await page.waitForFunction(() => document.querySelector('[data-testid="image-model-example-viewer"] img')?.alt === 'Nano Banana 2.1 example');
      } else {
        await page.keyboard.press('ArrowLeft');
        assert.equal(await viewer.locator('img').getAttribute('alt'), 'GPT Image 2.6 Sunburst example');
        await page.getByTestId('image-model-example-stage').hover(); await page.mouse.wheel(100, 0);
        await page.waitForFunction(() => document.querySelector('[data-testid="image-model-example-viewer"] img')?.alt === 'GPT Image 2.6 Flare example');
        assert.deepEqual(await viewer.evaluate(node => [2, -2, 15].map(deltaX => {
          const event = new WheelEvent('wheel', { deltaX, bubbles: true, cancelable: true });
          node.dispatchEvent(event); return event.defaultPrevented;
        })), [true, true, true], 'Small deltas and cooldown momentum must also block browser history gestures across the viewer');
        assert.equal(await viewer.evaluate(node => {
          const event = new WheelEvent('wheel', { deltaY: 15, bubbles: true, cancelable: true });
          node.dispatchEvent(event); return event.defaultPrevented;
        }), false, 'The horizontal guard must not cancel vertical wheel input');
        const stage = await page.getByTestId('image-model-example-stage').boundingBox();
        await page.mouse.move(stage.width * .65, stage.y + stage.height / 2); await page.mouse.down();
        await page.mouse.move(stage.width * .65 - 160, stage.y + stage.height / 2, { steps: 5 }); await page.mouse.up();
        assert.equal(await viewer.locator('img').getAttribute('alt'), 'Nano Banana 2.1 example');
      }
      await page.screenshot({ path: output + (mobile ? '/mobile-fullscreen-viewer.png' : '/desktop-fullscreen-viewer.png') });
      assert.deepEqual(await page.evaluate(() => window.fixture.selections), []);
      const previewSurface = await viewer.elementHandle();
      const stageBounds = await page.getByTestId('image-model-example-stage').boundingBox();
      await viewer.click({ position: { x: 2, y: stageBounds.y + stageBounds.height / 2 } });
      await viewer.waitFor({ state: 'hidden' });
      assert.equal(await models.isVisible(), true, 'Clicking black letterbox space closes only the preview');
      assert.equal(await previewSurface.evaluate(node => {
        const event = new WheelEvent('wheel', { deltaX: 10, bubbles: true, cancelable: true });
        node.dispatchEvent(event); return event.defaultPrevented;
      }), false, 'Closing the preview removes its native wheel guard');
      await zoom.click({ position: { x: 8, y: 8 } });
      await viewer.waitFor();
      await page.keyboard.press('Escape'); await viewer.waitFor({ state: 'hidden' });
      assert.equal(await zoom.count(), 1, 'Closing preview must keep model selector open');
      await zoom.evaluate(node => node.blur());
      await models.getByText('Models', { exact: true }).click();
      await zoom.focus();
      assert.equal(await zoom.evaluate(node => getComputedStyle(node).outlineStyle), 'none', 'Restoring pointer focus must not leave a border over the preview image');
      if (!mobile) {
        await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
        assert.equal(await zoom.evaluate(node => node === document.activeElement && getComputedStyle(node).outlineStyle === 'solid'), true, 'Keyboard navigation retains its focus indicator');
      }
      assert.equal(requests.length, reads, 'Browsing must make no additional API/database calls');

      const cardImage = page.locator('[data-ai-action="clikb.creation.models.action.image_Gpt%20Image"] img');
      const box = await cardImage.boundingBox();
      await cardImage.click({ position: { x: box.width / 2, y: box.height * .8 } });
      assert.deepEqual(await page.evaluate(() => window.fixture.selections), ['GPT Image 2.5 Flare'], 'Normal model selection must still work');
      await page.locator('#styles').click();
      const styles = page.getByRole('dialog', { name: 'Select Art Style', exact: true });
      assert.deepEqual(await styles.boundingBox(), modelBounds);
      assert.equal(await styles.evaluate(panel => getComputedStyle(panel).backgroundImage), glass);
      if (mobile) {
        await page.touchscreen.tap(195, 12);
        await styles.waitFor({ state: 'hidden' });
        await page.locator('#styles').tap();
      }
      const styleImage = page.getByTestId('art-style-image-Cinematic'); await styleImage.scrollIntoViewIfNeeded();
      await styleImage.click({ position: { x: 12, y: 12 } });
      assert.deepEqual(await page.evaluate(() => window.fixture.styles), ['Cinematic']);
      assert.equal(await page.getByAltText('Full Screen Art Style').count(), 0, 'First image click must select, not zoom');
      await styleImage.click({ position: { x: 12, y: 12 } }); await page.getByAltText('Full Screen Art Style').waitFor();
      assert.deepEqual(await page.evaluate(() => window.fixture.styles), ['Cinematic'], 'Zooming must not reselect');
      await page.getByRole('button', { name: 'Close art style preview' }).click();
      const fantasy = page.getByTestId('art-style-image-Final Fantasy'); await fantasy.scrollIntoViewIfNeeded(); await fantasy.click({ position: { x: 12, y: 12 } });
      assert.deepEqual(await page.evaluate(() => window.fixture.styles), ['Cinematic', 'Final Fantasy']);
      assert.equal(await page.getByAltText('Full Screen Art Style').count(), 0);
      await fantasy.click({ position: { x: 12, y: 12 } }); await page.getByAltText('Full Screen Art Style').waitFor();
      await page.screenshot({ path: output + (mobile ? '/mobile-art-style-preview.png' : '/desktop-art-style-preview.png') });
      assert.equal(requests.length, reads);
      await context.close();
      console.log(`PASS ${mobile ? 'mobile touch swipe' : 'desktop hover/drag/keyboard/horizontal scroll'}, cached nine-set switching, nine-tier preview, selection isolation and art-style select-then-zoom`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
