// Production UI in an isolated browser; every image, quote, generation and save is mocked.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const fixture = `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import PreciseImageEditor from './src/components/PreciseImageEditor';
import {preparePreciseImageRequest,assertPreciseRequestSize} from './src/components/preciseImageRequest';
const state=window.fixture={saved:[],archived:[],snapshots:[],closes:0,underlyingKeys:0,saveAttempts:0,archiveAttempts:0,failSave:true,failArchive:false,holdArchive:false,releaseArchive:null};
window.preciseRequestHelpers={preparePreciseImageRequest,assertPreciseRequestSize};
const webp=new URLSearchParams(location.search).has('webp');
window.addEventListener('keydown',()=>state.underlyingKeys++);
const store=configureStore({reducer:()=>({settings:{darkMode:new URLSearchParams(location.search).get('light')!=='1'}})});
function App(){const[open,setOpen]=useState(true);return <Provider store={store}><div onKeyDown={()=>state.underlyingKeys++}>
<button onClick={()=>setOpen(true)}>Open Precise</button>
<PreciseImageEditor open={open} imageUrl={'https://assets.test/source.'+(webp?'webp':'png')} initialPrompt="An adventurer in a red coat." originalContext={{target:'scene-a'}}
references={Array.from({length:9},(_,i)=>({name:'Character '+(i+1),url:'https://assets.test/ref'+i+(webp&&i===0?'.webp':'.png')}))} accentColor="#bda1f5"
onClose={()=>{state.closes++;setOpen(false)}} onSnapshot={value=>state.snapshots.push(value)}
onGenerated={async value=>{state.archiveAttempts++;if(state.holdArchive){await new Promise(resolve=>{state.releaseArchive=resolve});state.holdArchive=false}if(state.failArchive){state.failArchive=false;throw new Error('Mock history temporarily unavailable.')}state.archived.push(value)}}
onSave={async value=>{state.saveAttempts++;if(state.failSave){state.failSave=false;throw new Error('Mock storage temporarily unavailable.')}state.saved.push(value)}} />
</div></Provider>};createRoot(document.getElementById('root')).render(<App/>);`;

(async () => {
    const bundle = await require('esbuild').build({ stdin: { contents: fixture, resolveDir: path.resolve('.'), loader: 'tsx' }, bundle: true, write: false, outfile: 'fixture.js', platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'import.meta.env.VITE_CLIK_URL': '"http://fixture.test"', 'process.env.NODE_ENV': '"production"' }, logLevel: 'silent' });
    const script = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
    const css = bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
    const browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    const reports = [];
    try {
        for (const mobile of [false, true]) {
            const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1366, height: 900 }, hasTouch: mobile, isMobile: mobile });
            const requests = { quotes: [], generations: [], reconciles: [] }, errors = [];
            let releaseGeneration = null;
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/*', async route => {
                const request = route.request(), url = request.url();
                if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>' });
                if (url.startsWith('https://assets.test/')) return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768"><rect width="1024" height="768" fill="#56677c"/><circle cx="520" cy="360" r="170" fill="#d9b896"/><path d="M330 768V580Q520 470 710 580V768" fill="#ba594e"/></svg>' });
                if (url.endsWith('/preciseImage/quote')) { const body = request.postDataJSON(); requests.quotes.push(body); return route.fulfill({ json: { pixels: body.model === 'flare' ? 6 : body.model === 'sunburst' ? 24 : 60 + body.referenceCount } }); }
                if (url.endsWith('/preciseImage')) {
                    const body = request.postDataJSON(); requests.generations.push(body);
                    await new Promise(resolve => { releaseGeneration = resolve; });
                    return route.fulfill({ json: { imageUrl: `https://assets.test/result${requests.generations.length}.png`, modelName: body.model === 'krea' ? 'Krea 3' : 'Flare' } });
                }
                if (url.endsWith('/reconcilePreciseImagePrompt')) { requests.reconciles.push(request.postDataJSON()); return route.fulfill({ json: { prompt: requests.reconciles.length === 1 ? 'An adventurer in a blue coat.' : 'An adventurer in a blue coat holding a compass.' } }); }
                return route.abort();
            });
            await page.goto(`http://fixture.test/?light=${mobile ? 1 : 0}`);
            await page.addStyleTag({ content: css }); await page.addScriptTag({ content: script });
            await page.getByRole('button', { name: 'Generate · 60 P', exact: true }).waitFor();
            assert.equal(await page.getByLabel('Editing model').inputValue(), 'krea');
            assert.equal(await page.getByRole('button', { name: 'Generate · 60 P', exact: true }).getAttribute('title'), 'Image edit: 60 P. Prompt reconciliation uses normal text billing.');
            assert.equal(await page.locator('.precise-generate').evaluate(element => getComputedStyle(element).color), mobile ? 'rgb(255, 255, 255)' : 'rgb(17, 17, 17)');
            assert.equal(await page.locator('[data-precise-editor="true"][data-ai-control-excluded="true"][data-editstory-gesture-guard="true"]').count(), 1);
            const stage = page.locator('.precise-image-stage');
            const drag = async (start, end) => {
                if (mobile) {
                    const client = await page.context().newCDPSession(page);
                    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1 }] });
                    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...end, id: 1 }] });
                    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await client.detach();
                } else { await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 6 }); await page.mouse.up(); }
            };
            const draw = async (from, to) => {
                await stage.scrollIntoViewIfNeeded(); const b = await stage.boundingBox();
                await drag({ x: b.x + b.width * from[0], y: b.y + b.height * from[1] }, { x: b.x + b.width * to[0], y: b.y + b.height * to[1] });
            };
            await draw([.15, .18], [.45, .56]);
            const note = page.getByRole('textbox', { name: 'Region 1 instruction' });
            await note.fill('Make the coat blue.');
            assert.equal(await page.getByRole('button', { name: 'Delete region 1', exact: true }).locator('svg[aria-hidden="true"]').count(), 1);
            await note.press('End'); await note.type(' Keep the cloth texture.');
            assert.equal(await page.evaluate(() => window.fixture.underlyingKeys), 0, 'editor keyboard shortcuts leaked');
            const firstBox = await page.locator('.precise-region').evaluate(element => ({ left: parseFloat(element.style.left), top: parseFloat(element.style.top), width: parseFloat(element.style.width), height: parseFloat(element.style.height) }));
            assert.ok(Math.abs(firstBox.left - 15) < 1 && Math.abs(firstBox.width - 30) < 1 && Math.abs(firstBox.height - 38) < 1, JSON.stringify(firstBox));
            await stage.scrollIntoViewIfNeeded();
            let canvasBox = await stage.boundingBox(), regionBox = await page.locator('.precise-region').boundingBox();
            await drag({ x: regionBox.x + regionBox.width / 2, y: regionBox.y + regionBox.height / 2 }, { x: regionBox.x + regionBox.width / 2 + canvasBox.width * .08, y: regionBox.y + regionBox.height / 2 + canvasBox.height * .04 });
            const handle = await page.getByRole('button', { name: 'Resize region 1', exact: true }).boundingBox();
            await drag({ x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }, { x: handle.x + handle.width / 2 + canvasBox.width * .06, y: handle.y + handle.height / 2 + canvasBox.height * .07 });
            const adjustedBox = await page.locator('.precise-region').evaluate(element => ({ left: parseFloat(element.style.left), top: parseFloat(element.style.top), width: parseFloat(element.style.width), height: parseFloat(element.style.height) }));
            assert.ok(Math.abs(adjustedBox.left - 23) < 1 && Math.abs(adjustedBox.top - 22) < 1 && Math.abs(adjustedBox.width - 36) < 1 && Math.abs(adjustedBox.height - 45) < 1, 'move/resize: ' + JSON.stringify(adjustedBox));
            assert.equal(await page.getByRole('button', { name: 'Generate · 60 P', exact: true }).isDisabled(), true, 'unconfirmed note should block generation');
            await page.getByRole('button', { name: /^References/ }).click();
            for (let index = 1; index <= 7; index++) await page.getByRole('checkbox', { name: `Use reference Character ${index}`, exact: true }).check();
            assert.equal(await page.getByRole('checkbox', { name: 'Use reference Character 8', exact: true }).isDisabled(), true);
            await page.getByRole('button', { name: 'Confirm region 1 note, free' }).click();
            assert.equal(requests.generations.length, 0, 'confirming notes must be free');
            assert.equal(await page.getByRole('textbox').count(), 0, 'confirmed inactive notes should collapse');
            await page.getByLabel('Editing model').selectOption('krea');
            await page.getByRole('button', { name: 'Generate · 67 P', exact: true }).waitFor();
            assert.ok(requests.quotes.some(quote => quote.model === 'krea' && quote.referenceCount === 7 && quote.width === 1024 && quote.height === 768));
            await page.getByRole('button', { name: 'Generate · 67 P', exact: true }).evaluate(button => { button.click(); button.click(); });
            await page.waitForFunction(() => document.querySelector('[role="dialog"]').getAttribute('aria-busy') === 'true');
            while (!releaseGeneration) await new Promise(resolve => setTimeout(resolve, 5));
            assert.equal(requests.generations.length, 1, 'duplicate paid request');
            assert.equal(await page.getByLabel('Close precise editing').isDisabled(), true);
            await page.keyboard.press('Escape');
            assert.equal(await page.evaluate(() => window.fixture.closes), 0, 'Escape closed an in-flight paid generation');
            await page.evaluate(() => { window.fixture.holdArchive = true; });
            releaseGeneration(); releaseGeneration = null;
            await page.waitForFunction(() => typeof window.fixture.releaseArchive === 'function');
            assert.equal(await page.locator('.precise-image').getAttribute('src'), 'https://assets.test/result1.png', 'working result must be retained before history completes');
            assert.equal(await page.getByLabel('Close precise editing').isDisabled(), true, 'cancel enabled before generated history completed');
            assert.equal(await page.evaluate(() => window.fixture.saved.length), 0, 'archive must not replace parent current image');
            await page.evaluate(() => { window.fixture.releaseArchive(); });
            await page.getByRole('button', { name: 'Save', exact: true }).waitFor();
            await page.waitForFunction(() => !document.querySelector('.precise-save').disabled);
            assert.equal(await page.evaluate(() => window.fixture.archived.length), 1);
            assert.equal(requests.reconciles[0].prompt, 'An adventurer in a red coat.');
            assert.equal(requests.generations[0].billingAction, 'precise-image');
            assert.equal(requests.generations[0].references.length, 7);
            assert.equal(requests.generations[0].regions[0].confirmed, undefined);
            assert.ok(requests.generations[0].regions[0].x > .22 && requests.generations[0].regions[0].x < .24);
            assert.equal(await page.evaluate(() => window.fixture.saved.length), 0, 'generation should not update parent');
            // A second result must edit the working output and preserve accepted instructions.
            await stage.focus(); await page.keyboard.press('Enter');
            await page.getByRole('textbox', { name: 'Region 1 instruction' }).fill('Put a compass in their hand.');
            await page.getByRole('button', { name: /^References/ }).click();
            for (let index = 1; index <= 7; index++) await page.getByRole('checkbox', { name: `Use reference Character ${index}`, exact: true }).uncheck();
            await page.getByRole('button', { name: 'Confirm region 1 note, free' }).click();
            await page.getByRole('button', { name: 'Generate · 60 P', exact: true }).click();
            while (!releaseGeneration) await new Promise(resolve => setTimeout(resolve, 5));
            assert.equal(requests.generations[1].imageUrl, 'https://assets.test/result1.png');
            releaseGeneration(); releaseGeneration = null;
            await page.waitForFunction(() => !document.querySelector('.precise-save').disabled);
            assert.equal(await page.evaluate(() => window.fixture.archived.length), 2);
            assert.equal(requests.reconciles.length, 2);
            assert.equal(requests.reconciles[1].prompt, 'An adventurer in a blue coat.');
            // Each paid result is archived with its incremental prompt; Save reuses that prompt.
            await page.getByRole('button', { name: 'Save', exact: true }).click();
            await page.getByRole('alert').filter({ hasText: 'Mock storage' }).waitFor();
            assert.equal(requests.reconciles.length, 2);
            assert.equal(requests.reconciles[0].edits.length, 1);
            assert.equal(requests.reconciles[1].edits.length, 1);
            assert.equal(requests.reconciles[0].edits[0].regions[0].note, 'Make the coat blue. Keep the cloth texture.');
            assert.equal(requests.reconciles[0].imageUrl, 'https://assets.test/result1.png');
            assert.equal(requests.reconciles[1].imageUrl, 'https://assets.test/result2.png');
            assert.deepEqual(requests.reconciles[0].originalContext, { target: 'scene-a' });
            await page.getByRole('button', { name: 'Save', exact: true }).click();
            await page.waitForFunction(() => window.fixture.saved.length === 1);
            assert.equal(requests.reconciles.length, 2, 'save or save retry repeated prompt reconciliation');
            assert.equal(requests.generations.length, 2, 'save regenerated an image');
            const saved = await page.evaluate(() => window.fixture.saved[0]);
            assert.equal(saved.imageUrl, 'https://assets.test/result2.png'); assert.equal(saved.modelName, 'Krea 3');
            await page.getByRole('button', { name: 'Open Precise', exact: true }).click();
            await page.getByRole('button', { name: 'Generate · 60 P', exact: true }).waitFor();
            assert.equal(await page.getByLabel('Editing model').inputValue(), 'krea');
            assert.equal(await page.getByRole('button', { name: 'Save', exact: true }).isDisabled(), true);
            // Keyboard-only region placement and the eight-region cap.
            for (let i = 0; i < 9; i++) { await stage.focus(); await page.keyboard.press('Enter'); }
            assert.equal(await page.locator('.precise-region').count(), 8);
            assert.equal(await page.getByRole('textbox').count(), 1);
            assert.equal(await page.getByRole('button', { name: /Add region/ }).count(), 0);
            assert.deepEqual(await page.getByLabel('Editing model').locator('option').allTextContents(), ['GPT Flare', 'GPT Sunburst', 'Krea 3']);
            await page.getByRole('button', { name: 'Select region 1', exact: true }).focus();
            await page.keyboard.press('ArrowRight');
            await page.getByRole('button', { name: 'Resize region 1', exact: true }).focus();
            await page.keyboard.press('ArrowRight');
            const keyboardBox = await page.locator('.precise-region').first().evaluate(element => ({ left: parseFloat(element.style.left), width: parseFloat(element.style.width) }));
            assert.equal(keyboardBox.left, 3); assert.equal(keyboardBox.width, 17);
            // Moving into the next region, including through keyboard controls, must fail.
            for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
            const overlapWidth = await page.locator('.precise-region').first().evaluate(element => parseFloat(element.style.width));
            assert.ok(overlapWidth <= 18.0001, 'keyboard resize overlapped a neighbor');
            await page.getByRole('button', { name: 'Select region 1', exact: true }).focus();
            await page.keyboard.press('Shift+ArrowRight');
            assert.equal(await page.locator('.precise-region').first().evaluate(element => parseFloat(element.style.left)), 3, 'keyboard move overlapped neighbor');
            await page.getByLabel('Dismiss error').click();
            for (let i = 0; i < 8; i++) { await page.getByRole('button', { name: 'Select region 1', exact: true }).click(); await page.getByRole('button', { name: 'Delete region 1', exact: true }).click(); }
            // A blank tap creates a small region. An overlapping drag is rejected entirely.
            await draw([.3, .3], [.3, .3]);
            assert.equal(await page.locator('.precise-region').count(), 1);
            await page.getByRole('button', { name: 'Hide region note' }).click();
            await draw([.7, .3], [.7, .3]);
            await page.getByRole('button', { name: 'Hide region note' }).click();
            const geometryBeforeConflict = await page.locator('.precise-region').first().getAttribute('style');
            canvasBox = await stage.boundingBox();
            regionBox = await page.locator('.precise-region').first().boundingBox();
            await drag({ x: regionBox.x + regionBox.width / 2, y: regionBox.y + regionBox.height / 2 }, { x: canvasBox.x + canvasBox.width * .65, y: canvasBox.y + canvasBox.height * .3 });
            assert.equal(await page.locator('.precise-region').first().getAttribute('style'), geometryBeforeConflict, 'overlapping pointer move was not rejected');
            const firstResize = await page.getByRole('button', { name: 'Resize region 1', exact: true }).boundingBox();
            await drag({ x: firstResize.x + firstResize.width / 2, y: firstResize.y + firstResize.height / 2 }, { x: canvasBox.x + canvasBox.width * .7, y: firstResize.y + firstResize.height / 2 });
            assert.equal(await page.locator('.precise-region').first().getAttribute('style'), geometryBeforeConflict, 'overlapping pointer resize was not rejected');
            await page.getByRole('button', { name: 'Hide region note' }).click();
            await page.getByRole('button', { name: 'Select region 2', exact: true }).click();
            await page.getByRole('button', { name: 'Delete region 2', exact: true }).click();
            await draw([.8, .8], [.3, .3]);
            assert.equal(await page.locator('.precise-region').count(), 1, 'overlapping draw created a region');
            await page.getByRole('button', { name: 'Select region 1', exact: true }).click();
            await page.getByRole('textbox', { name: 'Region 1 instruction' }).fill('Refine this area.');
            await stage.scrollIntoViewIfNeeded();
            const geometry = await stage.boundingBox();
            assert.ok(Math.abs(geometry.width / geometry.height - 4 / 3) < .01, 'canvas does not fit actual image ratio');
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'horizontal overflow');
            const snapshots = await page.evaluate(() => window.fixture.snapshots.filter(Boolean));
            assert.ok(snapshots.every(snapshot => Object.keys(snapshot).sort().join(',') === 'model,pixels,references,regions,status'), 'snapshot leaked image or prompt data');
            fs.mkdirSync('.tmp/precise-editor-browser', { recursive: true });
            await page.screenshot({ path: `.tmp/precise-editor-browser/${mobile ? 'mobile' : 'desktop'}.png`, fullPage: true });
            if (mobile) {
                await page.getByRole('textbox', { name: 'Region 1 instruction' }).focus();
                await page.setViewportSize({ width: 390, height: 440 });
                await page.waitForFunction(() => Math.abs(document.querySelector('.precise-editor').getBoundingClientRect().height - window.visualViewport.height) < 2);
                const keyboardLayout = await page.evaluate(() => {
                    const toolbar = document.querySelector('.precise-toolbar').getBoundingClientRect(), note = document.querySelector('textarea').getBoundingClientRect();
                    return { toolbarBottom: toolbar.bottom, noteBottom: note.bottom, toolbarTop: toolbar.top, visibleHeight: visualViewport.height, focused: document.activeElement.tagName };
                });
                assert.equal(keyboardLayout.focused, 'TEXTAREA');
                assert.ok(keyboardLayout.toolbarBottom <= keyboardLayout.visibleHeight + 1 && keyboardLayout.noteBottom < keyboardLayout.toolbarTop, JSON.stringify(keyboardLayout));
                await page.screenshot({ path: '.tmp/precise-editor-browser/mobile-keyboard.png' });
                await page.setViewportSize({ width: 390, height: 844 });
            }
            await page.getByRole('button', { name: 'Hide region note' }).click();
            await page.getByLabel('Editing model').focus();
            await page.keyboard.press('Tab');
            assert.equal(await page.getByLabel('Close precise editing').evaluate(element => element === document.activeElement), true, 'focus escaped dialog');
            await page.getByLabel('Close precise editing').click();
            assert.equal(await page.evaluate(() => window.fixture.saved.length), 1, 'cancel changed parent result');
            assert.equal(await page.evaluate(() => window.fixture.archived.length), 2, 'cancel discarded paid history');
            // Cancel after a fresh paid result still keeps its prompt-paired archive.
            await page.getByRole('button', { name: 'Open Precise', exact: true }).click();
            await page.getByRole('button', { name: 'Generate · 60 P', exact: true }).waitFor();
            await stage.focus(); await page.keyboard.press('Enter');
            await page.getByRole('textbox', { name: 'Region 1 instruction' }).fill('Make the sky cloudy.');
            await page.getByRole('button', { name: 'Confirm region 1 note, free' }).click();
            await page.getByRole('button', { name: 'Generate · 60 P', exact: true }).click();
            while (!releaseGeneration) await new Promise(resolve => setTimeout(resolve, 5));
            releaseGeneration(); releaseGeneration = null;
            await page.waitForFunction(() => !document.querySelector('.precise-save').disabled);
            assert.equal(requests.reconciles[2].prompt, 'An adventurer in a red coat.', 'new session lost original source prompt');
            await page.getByLabel('Close precise editing').click();
            assert.equal(await page.evaluate(() => window.fixture.archived.length), 3);
            assert.equal(await page.evaluate(() => window.fixture.saved.length), 1, 'cancel replaced parent current image');
            assert.deepEqual(errors, []);
            reports.push({ mobile, quotes: requests.quotes.length, generations: requests.generations.length, reconciliations: requests.reconciles.length, geometry });
            await page.close();
        }
        // Decode actual WebP bytes in the real browser, then send PNG while preserving URLs for ownership.
        const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
        const rasterBytes = async (width, height) => Buffer.from((await page.evaluate(({ width, height }) => {
            const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
            const context = canvas.getContext('2d'); context.fillStyle = '#a14f39'; context.fillRect(0, 0, width, height);
            context.fillStyle = '#ccb498'; context.fillRect(width / 4, height / 4, width / 2, height / 2);
            return canvas.toDataURL('image/webp');
        }, { width, height })).split(',')[1], 'base64');
        const sourceWebp = await rasterBytes(1024, 768), referenceWebp = await rasterBytes(2048, 1536);
        const webpCalls = { downloads: [], quotes: [], generations: [], reconciles: [] };
        let failReconcile = true;
        await page.route('**/*', async route => {
            const request = route.request(), url = request.url();
            if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' });
            if (url.startsWith('https://assets.test/')) return route.fulfill({ contentType: 'image/webp', body: url.includes('ref0') ? referenceWebp : sourceWebp });
            if (url.endsWith('/download-image-for-client')) {
                const { sourceUrl } = request.postDataJSON(); webpCalls.downloads.push(sourceUrl);
                return route.fulfill({ contentType: 'image/webp', body: sourceUrl.includes('ref0') ? referenceWebp : sourceWebp });
            }
            if (url.endsWith('/preciseImage/quote')) { webpCalls.quotes.push(request.postDataJSON()); return route.fulfill({ json: { pixels: 6 } }); }
            if (url.endsWith('/preciseImage')) { webpCalls.generations.push(request.postDataJSON()); return route.fulfill({ json: { imageUrl: 'https://assets.test/final.png', modelName: 'Flare' } }); }
            if (url.endsWith('/reconcilePreciseImagePrompt')) {
                webpCalls.reconciles.push(request.postDataJSON());
                if (failReconcile) { failReconcile = false; return route.fulfill({ status: 503, json: { message: 'Mock Luna temporarily unavailable.' } }); }
                return route.fulfill({ json: { prompt: 'An adventurer in a blue coat.' } });
            }
            return route.abort();
        });
        await page.goto('http://fixture.test/?webp=1');
        await page.addStyleTag({ content: css }); await page.addScriptTag({ content: script });
        await page.getByRole('button', { name: 'Generate · 6 P', exact: true }).waitFor();
        const helperCheck = await page.evaluate(async () => {
            const { preparePreciseImageRequest } = window.preciseRequestHelpers, cache = new Map();
            const run = () => preparePreciseImageRequest('https://assets.test/source.webp', { width: 1024, height: 768 }, [{ name: 'Character 1', url: 'https://assets.test/ref0.webp' }], cache);
            const first = await run(), second = await run();
            const dimensions = async url => { const image = new Image(); image.src = url; await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight }; };
            return { png: first.imageUrl.startsWith('data:image/png;base64,'), referencePng: first.references[0].url.startsWith('data:image/png;base64,'), source: await dimensions(first.imageUrl), reference: await dimensions(first.references[0].url), cached: first.imageUrl === second.imageUrl, cacheSize: cache.size };
        });
        assert.deepEqual(helperCheck, { png: true, referencePng: true, source: { width: 1024, height: 768 }, reference: { width: 1024, height: 768 }, cached: true, cacheSize: 2 });
        assert.equal(webpCalls.downloads.length, 2, 'cache repeated WebP downloads');
        await page.locator('.precise-image-stage').focus(); await page.keyboard.press('Enter');
        await page.getByRole('textbox', { name: 'Region 1 instruction' }).fill('Make the coat blue.');
        await page.getByRole('button', { name: /^References/ }).click();
        await page.getByRole('checkbox', { name: 'Use reference Character 1', exact: true }).check();
        await page.getByRole('button', { name: 'Confirm region 1 note, free' }).click();
        await page.evaluate(() => { window.fixture.failArchive = true; window.fixture.failSave = false; });
        await page.getByRole('button', { name: 'Generate · 6 P', exact: true }).click();
        await page.getByRole('alert').filter({ hasText: 'Mock Luna' }).waitFor();
        await page.waitForFunction(() => !document.querySelector('.precise-save').disabled);
        assert.equal(webpCalls.generations.length, 1);
        assert.ok(webpCalls.generations[0].imageUrl.startsWith('data:image/png;base64,'));
        assert.ok(webpCalls.generations[0].references[0].url.startsWith('data:image/png;base64,'));
        assert.equal(webpCalls.generations[0].width, 1024); assert.equal(webpCalls.generations[0].height, 768);
        assert.ok(webpCalls.quotes.every(quote => quote.width === 1024 && quote.height === 768));
        assert.equal(await page.locator('.precise-image').getAttribute('src'), 'https://assets.test/final.png');
        assert.equal(await page.getByLabel('Close precise editing').isDisabled(), true, 'unarchived result could be cancelled');
        assert.equal(await page.evaluate(() => window.fixture.archiveAttempts), 0);
        assert.equal(webpCalls.reconciles.length, 1);
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.getByRole('alert').filter({ hasText: 'Mock history' }).waitFor();
        assert.equal(webpCalls.reconciles.length, 2, 'failed Luna should retry on Save');
        assert.equal(await page.evaluate(() => window.fixture.archiveAttempts), 1);
        assert.equal(await page.getByLabel('Close precise editing').isDisabled(), true);
        await page.getByRole('button', { name: 'Save', exact: true }).click();
        await page.waitForFunction(() => window.fixture.saved.length === 1);
        assert.equal(webpCalls.reconciles.length, 2, 'archive retry repeated successful Luna');
        assert.equal(webpCalls.generations.length, 1, 'history recovery repeated paid image call');
        assert.equal(await page.evaluate(() => window.fixture.archiveAttempts), 2);
        assert.equal(await page.evaluate(() => window.fixture.archived.length), 1);
        assert.equal(webpCalls.reconciles[0].imageUrl, 'https://assets.test/final.png');
        assert.equal(await page.evaluate(() => window.fixture.saved[0].imageUrl), 'https://assets.test/final.png');
        reports.push({ webp: true, helperCheck, downloads: webpCalls.downloads.length, generations: webpCalls.generations.length });
        await page.close();
        fs.writeFileSync('.tmp/precise-editor-browser/report.json', JSON.stringify(reports, null, 2));
        console.log('Precise desktop and touch browser checks passed:', JSON.stringify(reports));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
