const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs'), ts = require('typescript');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..'), port = 5237;
const output = path.join(root, '.tmp/image-model-examples-browser'); fs.mkdirSync(output, { recursive: true });
const fixture = ts.transpileModule(`
import React,{StrictMode,useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';
import {Provider,useDispatch} from 'react-redux';import {MemoryRouter} from 'react-router-dom';
import {ThemeProvider,createTheme} from '@mui/material';
import {store} from '/src/store';import {loadImageModelExampleSets} from '/src/imageModelExamplesSlice';
import {recordGeneratedImageModel,collectModelExampleCandidates} from '/src/imageResultProvenance';
import ImageModelResultPill from '/src/ImageModelResultPill';
import {SaveImageModelExampleSetDialog} from '/src/ImageModelExampleDialogs';import ModelSelectionModal from '/src/ModelSelectionModal';
const models=['Imagen','Gpt Image','fluxUltra','minimax','Schnell'].map(name=>({name,img:'https://old.invalid/wrong-model.png'}));
const keys=['GPT Image 2.5 Flare','GPT Image 2.5 Sunburst','GPT Image 2.5 Flare'];
const images=keys.map((key,i)=>{const url='https://samples.invalid/result-'+i+'.png';recordGeneratedImageModel(key,[url],url);return url;});
window.fixture={store,images};
function App(){const dispatch=useDispatch();const [index,setIndex]=useState(0),[editor,setEditor]=useState(true),[video,setVideo]=useState(false),[open,setOpen]=useState(false),[activeModelName,setModel]=useState('Schnell'),[candidates,setCandidates]=useState(null);
useEffect(()=>{dispatch(loadImageModelExampleSets());},[dispatch]);
return <><button id="index" onClick={()=>setIndex((index+1)%images.length)}>Next image</button><button id="editor" onClick={()=>setEditor(!editor)}>Toggle editor</button><button id="video" onClick={()=>setVideo(!video)}>Toggle video mode</button><button id="models" onClick={()=>setOpen(true)}>Models</button>
{editor&&<div style={{position:'relative',width:300,height:350,background:'#345'}}><img src={images[index]} style={{width:'100%',height:'100%'}}/>
<ImageModelResultPill source={images[index]} active={!video} visitKey={'scene:'+index} onAddSet={()=>setCandidates(collectModelExampleCandidates(images))}/></div>}
<SaveImageModelExampleSetDialog open={candidates!==null} candidates={candidates||[]} onClose={()=>setCandidates(null)} darkMode={true}/>
<ModelSelectionModal open={open} setOpen={setOpen} handleSelect={(name,img)=>{setModel(name);setOpen(false);}} updateModelWithoutClosing={(name,img)=>setModel(name)} activeModelName={activeModelName} models={models} currentImage="" darkModeReducer={true} darkMode={true} matchMobile={window.innerWidth<600} gradient="" labelsByIndex={{}} colorsByLabel={{}}/>
</>;}
createRoot(document.getElementById('root')).render(<StrictMode><Provider store={store}><MemoryRouter><ThemeProvider theme={createTheme({palette:{mode:'dark'}})}><App/></ThemeProvider></MemoryRouter></Provider></StrictMode>);
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
(async () => {
  const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')));
  const requests = [], errors = [], oldImages = []; let sets = [], nextId = 1, mode = 'dev', failRefresh = false;
  const server = await createServer({ root, configFile: false, logLevel: 'error', cacheDir: output + '/vite',
    define: { 'import.meta.env.VITE_CLIK_URL': "'/api'" },
    server: { host: '127.0.0.1', port, strictPort: true, hmr: false }, plugins: [{
      name: 'example-set-fixture', enforce: 'pre', resolveId(id) { if (id === '/fixture.js') return '\0example-fixture'; },
      load(id) { if (id === '\0example-fixture') return fixture; },
      transform(code, id) { if (/\/(?:ImageModelResultPill|ModelSelectionModal)\.tsx$/.test(id)) return code.replaceAll('import.meta.env.VITE_APPX_STATE', JSON.stringify(mode)); },
      configureServer(s) { s.middlewares.use((req, res, next) => {
        if (req.url.startsWith('/__test')) { res.setHeader('Content-Type', 'text/html'); res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/fixture.js"></script>'); return; }
        if (!req.url.startsWith('/api/image-model-example-sets')) return next();
        let raw = ''; req.on('data', chunk => raw += chunk); req.on('end', () => {
          const body = raw ? JSON.parse(raw) : null; requests.push({ method: req.method, url: req.url, body }); res.setHeader('Content-Type', 'application/json');
          if (req.method === 'POST') { const id = String(nextId++); sets.push({ id, ...body }); res.end(JSON.stringify({ id })); }
          else if (req.method === 'DELETE') { sets = sets.filter(set => set.id !== req.url.split('/').at(-1)); res.end('{}'); }
          else if (failRefresh) { res.statusCode = 500; res.end(JSON.stringify({ message: 'Temporary read failure' })); }
          else res.end(JSON.stringify({ sets }));
        });
      }); },
    }] });
  await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }); page.setDefaultTimeout(60000);
    page.on('pageerror', e => { errors.push(e.message); console.error('Browser:', e.message); });
    await page.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith('http://127.0.0.1:' + port)) return route.continue();
      if (url.startsWith('https://samples.invalid/')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="90" height="160"><rect width="90" height="160" fill="teal"/></svg>' });
      if (url.startsWith('https://old.invalid')) oldImages.push(url);
      return route.abort();
    });
    await page.goto(`http://127.0.0.1:${port}/__test`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => window.fixture?.store.getState().imageModelExamples.status === 'ready');
    assert.equal(requests.length, 1, 'StrictMode must not duplicate the startup request');
    const pill = page.getByTestId('image-model-result-pill');
    assert.equal(await pill.textContent(), 'GPT Image 2.6 Flare');
    await page.waitForTimeout(4150); assert.equal(await pill.count(), 0);
    await page.locator('#index').click(); assert.equal(await pill.textContent(), 'GPT Image 2.6 Sunburst');
    await page.locator('#video').click(); assert.equal(await pill.count(), 0);
    await page.locator('#video').click(); assert.equal(await pill.count(), 1);
    await page.locator('#editor').click(); await page.locator('#editor').click(); assert.equal(await pill.count(), 1);
    await pill.click();
    assert.equal(await page.getByText('2 models represented').count(), 1);
    await page.getByLabel('Set name', { exact: true }).fill('Dinosaur comparison');
    await page.waitForTimeout(350);
    await page.screenshot({ path: output + '/dev-save-set.png' });
    failRefresh = true;
    await page.getByRole('button', { name: 'Add set', exact: true }).click();
    await page.getByRole('button', { name: 'Refresh list', exact: true }).waitFor();
    assert.equal(requests.filter(r => r.method === 'POST').length, 1);
    failRefresh = false;
    await page.getByRole('button', { name: 'Refresh list', exact: true }).click();
    await page.waitForFunction(() => window.fixture.store.getState().imageModelExamples.sets.length === 1);
    assert.equal(requests.filter(r => r.method === 'POST').length, 1, 'Retrying a list refresh must not save the same set again');
    assert.equal(Object.keys(sets[0].model_images).length, 2);
    const reads = requests.filter(r => r.method === 'GET').length;
    for (let n = 0; n < 3; n++) {
      await page.locator('#models').click();
      await page.locator('[data-ai-action="clikb.creation.models.action.image_Gpt%20Image"]').waitFor();
      assert.equal(await page.locator('[data-ai-action="clikb.creation.models.action.image_Imagen"] img').count(), 0, 'Missing model must stay empty');
      assert.ok((await page.locator('[data-ai-action="clikb.creation.models.action.image_Gpt%20Image"] img').getAttribute('src')).startsWith('https://samples.invalid/'));
      if (n === 0) {
        const image = page.locator('[data-ai-action="clikb.creation.models.action.image_Gpt%20Image"] img');
        await page.locator('[data-ai-action="clikb.creation.models.action.pro_Gpt%20Image"]').click();
        assert.equal(await image.getAttribute('src'), sets[0].model_images['GPT Image 2.5 Sunburst']);
        await page.locator('[data-ai-action="clikb.creation.models.action.lite_Gpt%20Image"]').click();
        assert.equal(await image.getAttribute('src'), sets[0].model_images['GPT Image 2.5 Flare']);
        await page.getByRole('button', { name: 'Zoom GPT Image 2.6 Flare example', exact: true }).click({ position: { x: 8, y: 8 } });
        const viewer = page.getByTestId('image-model-example-viewer');
        assert.ok((await viewer.textContent()).includes('2 / 2'), 'Partial sets must browse only their available tiers');
        await viewer.getByRole('button', { name: 'Next model image' }).click();
        assert.equal(await viewer.locator('img').getAttribute('src'), sets[0].model_images['GPT Image 2.5 Sunburst']);
        await page.keyboard.press('Escape'); await viewer.waitFor({ state: 'hidden' });
        assert.equal(await image.getAttribute('src'), sets[0].model_images['GPT Image 2.5 Flare'], 'Preview navigation must not toggle the selected tier');
        await page.screenshot({ path: output + '/dev-saved-partial-gallery.png' });
      }
      await page.keyboard.press('Escape');
    }
    assert.equal(requests.filter(r => r.method === 'GET').length, reads);
    assert.equal(oldImages.length, 0);
    await page.locator('#models').click();
    const manager = page.getByRole('button', { name: 'Example sets', exact: true }); await manager.click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Delete set and images', exact: true }).click();
    await page.waitForFunction(() => window.fixture.store.getState().imageModelExamples.sets.length === 0);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('dialog', { name: 'Models', exact: true }).waitFor();
    assert.equal(await page.locator('[data-ai-action="clikb.creation.models.action.image_Gpt%20Image"] img').count(), 0);
    assert.equal(await page.getByRole('button', { name: /^Zoom .+ example$/ }).count(), 0, 'Empty sets must not show zoom controls');
    await page.screenshot({ path: output + '/dev-empty-gallery.png' });
    await page.keyboard.press('Escape');
    console.log('PASS timed attribution, duplicate-model batch save, database refresh retry, cached selector opens, missing samples and dev deletion');
    // Recompile the two gated components exactly as a production build would.
    mode = 'prod'; server.moduleGraph.invalidateAll();
    const before = requests.length;
    await page.reload(); await page.waitForFunction(() => window.fixture?.store.getState().imageModelExamples.status === 'ready');
    assert.equal(requests.length, before + 1);
    assert.equal(await pill.getAttribute('type'), null, 'Production pill must be informational');
    await page.locator('#models').click(); assert.equal(await page.getByRole('button', { name: 'Example sets', exact: true }).count(), 0);
    await page.setViewportSize({ width: 390, height: 844 }); await page.reload();
    await page.waitForFunction(() => window.fixture?.store.getState().imageModelExamples.status === 'ready');
    await page.locator('#models').click(); await page.screenshot({ path: output + '/production-mobile-empty-gallery.png' });
    assert.deepEqual(errors, []); console.log('PASS production informational label and dev-only controls hidden on desktop/mobile');
  } finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
