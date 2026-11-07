const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const { chromium } = require(path.resolve(__dirname, '../.tmp/concierge-browser-deps/node_modules/playwright'));
const esbuild = require('esbuild');
(async () => {
    const output = path.resolve(__dirname, '../.tmp/threejs-unified-browser'); fs.mkdirSync(output, { recursive: true });
    const built = await esbuild.build({ entryPoints: [path.resolve(__dirname, 'fixtures/UnifiedSceneFixture.tsx')], bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env': '{}' }, loader: { '.css': 'empty', '.png': 'dataurl', '.jpg': 'dataurl', '.jpeg': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl', '.gif': 'dataurl', '.mp3': 'dataurl', '.mp4': 'dataurl' }, logLevel: 'silent' });
    const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    const results = [], errors = [];
    try {
        for (const mode of ['live', 'completed', 'spatial', 'stream']) for (const width of [390, 1280]) {
            const page = await browser.newPage({ viewport: { width, height: 850 } });
            page.on('pageerror', error => { errors.push({ mode, width, message: error.message }); console.error('PAGEERROR',mode,width,error.stack); }); page.on('console', message => { if(message.type()==='error')console.error('CONSOLE',message.text()); });
            await page.evaluate(mode => { window.__fixtureMode = mode; window.__glDraws = 0; for (const Type of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) if (Type) for (const method of ['drawElements', 'drawArrays']) { const original = Type.prototype[method]; Type.prototype[method] = function (...args) { window.__glDraws++; return original.apply(this, args); }; } }, mode);
            await page.setContent('<div id="root"></div>');
            await page.addScriptTag({ content: built.outputFiles[0].text });
            await page.locator('canvas').waitFor({ timeout: 20000 }).catch(async error => { console.error('DOM',await page.locator('body').innerText()); await page.screenshot({path:path.join(output,'failure.png')}); throw error; });
            await page.waitForFunction(() => window.__glDraws > 0);
            if (mode === 'stream') {
                await page.getByRole('button', { name: 'Start AI build' }).click();
                await page.waitForFunction(() => window.__fixture.client.snapshot().plan?.objects.some(object => object.id === 'cup'));
                assert.equal(await page.evaluate(() => window.__fixture.client.snapshot().phase), 'streaming');
                await page.getByRole('button', { name: 'Pause AI', exact: true }).click();
                await page.getByRole('button', { name: 'Continue AI', exact: true }).waitFor();
                await page.evaluate(() => window.__fixture.client.applyCommands([{ kind: 'pose', target: { objectId: 'hero' }, time: 0, pose: { t: 0, position: [1, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } }]));
                await page.getByRole('button', { name: 'Continue AI', exact: true }).click();
                await page.waitForFunction(() => window.__fixture.client.snapshot().local === true);
                const result = await page.evaluate(() => ({ position: window.__fixture.client.snapshot().plan.objects.find(object => object.id === 'hero').keys[0].position[0], events: window.__fixture.client.snapshot().authoring.events.length, image: window.__fixture.captures[0] }));
                assert.equal(result.position, 1); assert.equal(result.events, 2); assert.match(result.image, /^data:image\/jpeg;base64,/);
            }
            await page.waitForTimeout(500);
            const idleBefore = await page.evaluate(() => window.__glDraws); await page.waitForTimeout(400);
            const idleDraws = await page.evaluate(before => window.__glDraws - before, idleBefore);
            assert.equal(idleDraws, 0, `${mode}/${width}: idle viewport must stop drawing`);
            const panel = page.locator('#scroll-panel'), rect = await panel.boundingBox();
            await page.mouse.move(rect.x + 8, rect.y + 70); await page.mouse.wheel(0, 280); await page.waitForTimeout(250);
            assert.ok(await panel.evaluate(element => element.scrollTop) > 100, 'scrolling outside the canvas must move the form');
            await panel.evaluate(element => element.scrollTop = element.scrollHeight); await page.waitForTimeout(150);
            const hiddenBefore = await page.evaluate(() => window.__glDraws); await page.waitForTimeout(250);
            assert.equal(await page.evaluate(before => window.__glDraws - before, hiddenBefore), 0, 'offscreen scene must not draw');
            await panel.evaluate(element => element.scrollTop = 200); await page.waitForTimeout(150);
            if (mode !== 'spatial') {
                const slider = page.getByRole('slider', { name: 'Animation time' }); await slider.waitFor();
                if (mode === 'live') { await page.evaluate(() => window.__fixture.client.applyCommands([{ kind: 'pose', target: { objectId: 'hero' }, time: 0, pose: { t: 0, position: [1, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] } }])); const snapshot = await page.evaluate(() => ({ undo: window.__fixture.client.snapshot().canUndo, events: window.__fixture.client.snapshot().authoring.events.length })); assert.equal(snapshot.undo, true); assert.equal(snapshot.events, 2); }
                const canvas = page.locator('canvas').first(), box = await canvas.boundingBox();
                const before = await canvas.evaluate(element => element.toDataURL());
                await page.mouse.move(box.x + box.width * .7, box.y + box.height * .45); await page.mouse.down(); await page.mouse.move(box.x + box.width * .45, box.y + box.height * .6, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(120);
                assert.notEqual(await canvas.evaluate(element => element.toDataURL()), before, 'orbit must update the scene');
                const stopped = await canvas.evaluate(element => element.toDataURL()); await page.waitForTimeout(200); assert.equal(await canvas.evaluate(element => element.toDataURL()), stopped, 'orbit stops on release');
            }
            if (mode === 'stream' && width === 1280) {
                const bytes = await page.evaluate(() => window.__fixture.export()); assert.ok(bytes > 1000);
                const video = await page.locator('#exported').evaluate(async element => {
                    await new Promise(resolve => { if (element.readyState >= 2) resolve(); else element.onloadeddata = resolve; });
                    await new Promise(resolve => { element.onseeked = resolve; element.currentTime = 2.5; });
                    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 96; const context = canvas.getContext('2d'); context.drawImage(element, 0, 0, 96, 96);
                    const pixels = context.getImageData(0, 0, 96, 96).data, min = [255, 255, 255], max = [0, 0, 0];
                    for (let i = 0; i < pixels.length; i += 4) for (let c = 0; c < 3; c++) { min[c] = Math.min(min[c], pixels[i + c]); max[c] = Math.max(max[c], pixels[i + c]); }
                    return { width: element.videoWidth, duration: element.duration, range: Math.max(...max.map((value, index) => value - min[index])), frameEncoder: typeof VideoEncoder !== 'undefined' };
                });
                console.log('Encoded/decoded authoring reference', video);
                assert.ok(video.range > 16); assert.equal(video.width, 854); assert.ok(video.duration >= 5 - 1 / 30 - .002 && video.duration < 5.5, 'complete encoded timeline, including bounded native-recorder padding');
            }
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            await page.screenshot({ path: path.join(output, `${mode}-${width}.png`) }); results.push({ mode, width, idleDraws, scroll: 'passed', offscreen: 'passed' }); await page.close();
        }
        assert.deepEqual(errors, []); fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ results, errors }, null, 2)); console.log(JSON.stringify({ results, errors }, null, 2));
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
