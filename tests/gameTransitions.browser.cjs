const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..'), output = path.join(root, '.tmp/game-transitions');
// MediaRecorder's streaming WebM omits Duration. Add it to Segment/Info so the
// game can use its normal finite-duration end/choice logic in this fixture.
function finiteWebm(buffer, milliseconds) {
  const info = buffer.indexOf(Buffer.from([0x15, 0x49, 0xa9, 0x66]));
  assert.ok(info >= 0, 'WebM Info missing');
  const at = info + 4; let width = 1;
  while (!(buffer[at] & (1 << (8 - width)))) width++;
  let size = buffer[at] & ((1 << (8 - width)) - 1);
  for (let i = 1; i < width; i++) size = size * 256 + buffer[at + i];
  const duration = Buffer.alloc(11); duration.set([0x44, 0x89, 0x88]); duration.writeDoubleBE(milliseconds, 3);
  const encoded = Buffer.alloc(width); let updated = size + duration.length;
  for (let i = width - 1; i >= 0; i--) { encoded[i] = updated & 255; updated = Math.floor(updated / 256); }
  encoded[0] |= 1 << (8 - width);
  return Buffer.concat([buffer.subarray(0, at), encoded, buffer.subarray(at + width, at + width + size), duration, buffer.subarray(at + width + size)]);
}
const fixture = `
import React,{StrictMode,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import settings from '/src/settingsSlice.ts';
import brainstorm from '/src/brainstormSlice.ts';
import Stage from '/src/TouchPreviewStageUI.tsx';
import {cacheEntries,cacheStats} from '/src/interactionAssetCache.ts';
const store=configureStore({reducer:{settings,brainstorm},preloadedState:{settings:{...settings(undefined,{type:'init'}),fullscreenMute:true}}});
const hs=()=>['left','right','top','bottom'].map((id,i)=>({id,x:i===0?.25:.75,y:.55,r:.12,isVictory:false}));
const node=(id,color)=>({id,mainSrc:'/media/'+color+'.webm',subs:['','','',''],hotspots:hs(),children:{}});
const world=node('root','red'),child=node('child','blue');child.subs[0]='/media/green.webm';child.hotspots[1].loopTargetNodeId='root';
const mode=new URLSearchParams(location.search).get('mode');
if(mode==='terminal'||mode==='slow-terminal'){world.subs[0]='/media/blue.webm';world.subs[1]='/media/green.webm';}
else if(mode==='drag'){const action=node('action','blue'),payoff=node('payoff','green');action.autoPlaySrc=payoff.mainSrc;action.children.autoPlay=payoff;world.children.dragLeft=action;}
else {world.subs[0]=child.mainSrc;world.children.left=child;if(mode==='hold')world.hotspots[0].holdToPlay=true;}
if(mode?.startsWith('slow-')){world.subs[0]='/media/slow-blue.webm';if(world.children.left)world.children.left.mainSrc='/media/slow-blue.webm';}
function App(){const [preloaded,setPreloaded]=useState(false);return <div id="stage" style={{position:'relative',width:640,height:360,background:'#222'}}><Stage mainSrc={world.mainSrc} subs={world.subs} hotspots={world.hotspots} nestedTree={world} stage="preview" feeds={{}} intbg={0} backToEdit={()=>{}} onPublish={()=>{}} isPreloaded={preloaded} setIsPreloaded={setPreloaded}/></div>}
window.gameTest={cacheEntries,cacheStats,store};
createRoot(document.getElementById('root')).render(<StrictMode><Provider store={store}><App/></Provider></StrictMode>);
`;
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')));
  const videos = new Map(), requests = new Map();
  const server = await createServer({ root, configFile: false, cacheDir: output + '/vite', logLevel: 'error', esbuild: { jsx: 'automatic' },
    server: { host: '127.0.0.1', port: 5216, strictPort: true, hmr: false, watch: null },
    plugins: [{ name: 'game-transitions',
      resolveId(id) { if (id === '/fixture.tsx') return '\0fixture.tsx'; },
      load(id) {
        if (id === '\0fixture.tsx') return require('typescript').transpileModule(fixture, { compilerOptions: { jsx: 4, target: 9, module: 99 } }).outputText;
        if (process.env.GAME_BASELINE_DIR && id.startsWith(root.replaceAll('\\', '/') + '/src/')) {
          const before = path.join(process.env.GAME_BASELINE_DIR, path.relative(root, id.split('?')[0]));
          if (fs.existsSync(before)) return fs.readFileSync(before, 'utf8');
        }
      },
      configureServer(s) { s.middlewares.use((req, res, next) => {
        if (req.url.startsWith('/__test')) { res.setHeader('Content-Type', 'text/html'); res.end('<div id="root"></div><script type="module" src="/fixture.tsx"></script>'); return; }
        if (req.url === '/__record') { res.setHeader('Content-Type', 'text/html'); res.end('<title>video fixture encoder</title>'); return; }
        if (videos.has(req.url)) { requests.set(req.url, (requests.get(req.url) || 0) + 1); res.setHeader('Content-Type', 'video/webm'); res.setHeader('Cache-Control', 'public, max-age=3600'); res.end(videos.get(req.url)); return; }
        next();
      }); }
    }] });
  await server.listen();
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } }), errors = [], passed = [], latencies = [], logs = [];
  let warmBenchmarkRequests;
  page.on('console', message => { logs.push(message.text()); if (logs.length > 40) logs.shift(); });
  page.on('pageerror', error => errors.push(error.message)); page.setDefaultTimeout(15000);
  await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:5216/') ? route.continue() : route.abort());
  const main = () => page.locator('#stage video').first();
  const ready = () => page.waitForFunction(() => { const v = document.querySelector('#stage video'); return v?.readyState >= 2 && Number.isFinite(v.duration); });
  const choices = async () => { await ready(); await main().evaluate(video => { video.currentTime = video.duration - .03; video.play().catch(() => {}); }); await page.waitForTimeout(180); };
  const choice = side => page.getByRole('button', { name: 'Play ' + side + ' sub', exact: true });
  const check = async (name, run) => { await run(); passed.push(name); console.log('PASS ' + name); };
  try {
    await page.goto('http://127.0.0.1:5216/__record');
    // Distinct generated video colors detect stale/incorrect source frames. No
    // downloaded footage, external API, codec executable or billing is involved.
    const fixtureDir = path.join(output, 'fixtures'); fs.mkdirSync(fixtureDir, { recursive: true });
    const saved = ['red', 'blue', 'green'].every(color => fs.existsSync(path.join(fixtureDir, color + '-v2.webm')));
    const encoded = saved ? [] : await page.evaluate(async () => {
      return Promise.all(['red', 'blue', 'green'].map(color => new Promise(resolve => {
        const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180; document.body.appendChild(canvas);
        const context = canvas.getContext('2d'), stream = canvas.captureStream(0), chunks = [];
        const track = stream.getVideoTracks()[0];
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
        const draw = () => { context.fillStyle = color; context.fillRect(0, 0, 320, 180); context.fillStyle = 'white'; context.fillText(color + performance.now().toFixed(0), 50, 80); track.requestFrame(); };
        draw(); const timer = setInterval(draw, 32);
        recorder.ondataavailable = event => chunks.push(event.data);
        recorder.onstop = async () => { clearInterval(timer); stream.getTracks().forEach(track => track.stop()); const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer()); resolve({ color, data: btoa(String.fromCharCode(...bytes)) }); };
        recorder.start(); draw(); setTimeout(() => { draw(); setTimeout(() => recorder.stop(), 100); }, 1800);
      })));
    });
    encoded.forEach(({ color, data }) => fs.writeFileSync(path.join(fixtureDir, color + '-v2.webm'), finiteWebm(Buffer.from(data, 'base64'), 1900)));
    ['red', 'blue', 'green'].forEach(color => videos.set('/media/' + color + '.webm', fs.readFileSync(path.join(fixtureDir, color + '-v2.webm'))));
    await check('one-hop child choices are warm, child/loop navigation remains canonical and ready reveal is fast', async () => {
      await page.goto('http://127.0.0.1:5216/__test?mode=child'); await ready();
      if (!process.env.GAME_BASELINE_DIR) await page.waitForFunction(() => window.gameTest.cacheEntries().some(entry => entry.url.endsWith('green.webm') && entry.state === 'ready'));
      for (let i = 0; i < Number(process.env.GAME_SAMPLES || 30); i++) {
        await choices(); await choice('left').waitFor({ state: 'visible' });
        const elapsed = await page.evaluate(async () => {
          const start = performance.now(); document.querySelector('[aria-label="Play left sub"]').click();
          return await new Promise((resolve, reject) => {
            const pixel = document.createElement('canvas'); pixel.width = pixel.height = 1; const context = pixel.getContext('2d');
            const sample = () => {
              const video = document.querySelector('#stage video'), cover = document.querySelector('#stage > canvas');
              if (video?.readyState >= 2 && !video.seeking) {
                context.drawImage(video, 10, 10, 1, 1, 0, 0, 1, 1); const rgb = context.getImageData(0, 0, 1, 1).data;
                if (rgb[2] > 180 && rgb[0] < 60 && Number(getComputedStyle(video).opacity) === 1 && (!cover || Number(getComputedStyle(cover).opacity) < .01)) { resolve(performance.now() - start); return; }
              }
              if (performance.now() - start > 6000) { reject(Error('correct blue frame never fully revealed')); return; }
              requestAnimationFrame(sample);
            }; requestAnimationFrame(sample);
          });
        });
        latencies.push(elapsed);
        await choices(); await choice('right').evaluate(element => element.click());
        await page.waitForFunction(() => {
          const video = document.querySelector('#stage video'); if (!video || video.readyState < 2) return false;
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const context = canvas.getContext('2d');
          context.drawImage(video, 10, 10, 1, 1, 0, 0, 1, 1); const pixel = context.getImageData(0, 0, 1, 1).data;
          return pixel[0] > 180 && pixel[1] < 60 && pixel[2] < 60;
        });
        // Loop navigation deliberately suppresses old end hooks for 500 ms.
        // Do not let benchmark setup seek the next node during that guard.
        await page.waitForTimeout(550);
      }
      warmBenchmarkRequests = Object.fromEntries(requests);
      for (const count of requests.values()) assert.equal(count, 1, 'resident media downloaded again during repeated navigation');
      assert.ok(!errors.length, errors.join('\n'));
    });
    await check('terminal branch enters on its presented frame and exit can be reopened safely', async () => {
      await page.goto('http://127.0.0.1:5216/__test?mode=terminal'); await choices(); await choice('left').evaluate(element => element.click());
      const branch = page.locator('#stage video').nth(1);
      await page.waitForFunction(() => { const v = document.querySelectorAll('#stage video')[1]; return v?.readyState >= 2 && v.currentTime > .05 && getComputedStyle(v).opacity === '1'; });
      if (!process.env.GAME_BASELINE_DIR) assert.equal(await branch.evaluate(v => getComputedStyle(v).transitionDuration), '0s');
      await branch.evaluate(element => element.click()); await choice('left').waitFor({ state: 'visible' }); await choice('left').evaluate(element => element.click());
      await page.waitForTimeout(500); assert.ok(await branch.evaluate(video => video.currentTime > .05 && !video.paused), 'old exit rewound a reopened branch');
    });
    if (!process.env.GAME_BASELINE_DIR) for (const mode of ['slow-child', 'slow-terminal']) await check(mode + ': delayed handoff uses black-and-white and restores color on readiness', async () => {
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route('**/media/slow-blue.webm', async route => { await gate; await route.fulfill({ contentType: 'video/webm', body: videos.get('/media/blue.webm') }); });
      try {
        await page.goto('http://127.0.0.1:5216/__test?mode=' + mode); await choices();
        await choice('left').evaluate(element => element.click());
        const pending = mode === 'slow-child' ? page.locator('#stage > canvas') : main();
        await page.waitForTimeout(50);
        assert.notEqual(await pending.evaluate(node => getComputedStyle(node).filter), 'grayscale(1)', 'pending cue appeared immediately');
        await page.waitForFunction(mode => {
          const node = document.querySelector(mode === 'slow-child' ? '#stage > canvas' : '#stage video');
          return node && getComputedStyle(node).filter === 'grayscale(1)';
        }, mode);
        release();
        await page.waitForFunction(mode => {
          const video = document.querySelectorAll('#stage video')[mode === 'slow-terminal' ? 1 : 0];
          const cover = document.querySelector('#stage > canvas');
          return video?.readyState >= 2 && !video.paused && video.currentTime > .05
            && getComputedStyle(video).filter !== 'grayscale(1)'
            && (!cover || Number(getComputedStyle(cover).opacity) < .01);
        }, mode);
        assert.notEqual(await main().evaluate(node => getComputedStyle(node).filter), 'grayscale(1)', 'outgoing loading cue did not clear');
      } finally { release(); await page.unroute('**/media/slow-blue.webm'); }
    });
    if (!process.env.GAME_BASELINE_DIR) await check('hotspots follow a late container resize without a double-click or window resize', async () => {
      await page.goto('http://127.0.0.1:5216/__test?mode=terminal'); await choices();
      await page.waitForTimeout(1500); // beyond the original 1.2 second startup poll
      await page.locator('#stage').evaluate(node => { node.style.width = '400px'; node.style.height = '600px'; });
      await page.waitForFunction(() => {
        const hotspot = document.querySelector('[aria-label="Play left sub"]');
        // 16:9 content fits at 400 x 225, centered vertically in the 600px stage.
        return hotspot && Math.abs(parseFloat(hotspot.style.left) - 100) < 1
          && Math.abs(parseFloat(hotspot.style.top) - (187.5 + .55 * 225)) < 1;
      });
    });
    if (!process.env.GAME_BASELINE_DIR) await check('mobile hotspots follow late fitting with top-aligned letterboxing', async () => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' });
      try {
        const mobile = await context.newPage(); mobile.on('pageerror', error => errors.push(error.message));
        await mobile.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:5216/') ? route.continue() : route.abort());
        await mobile.goto('http://127.0.0.1:5216/__test?mode=terminal');
        await mobile.waitForFunction(() => document.querySelector('#stage video')?.readyState >= 2);
        await mobile.waitForTimeout(1500);
        await mobile.locator('#stage').evaluate(node => { node.style.width = '320px'; node.style.height = '600px'; });
        await mobile.waitForFunction(() => { const spot = document.querySelector('[aria-label="Play left sub"]'); return spot
          && Math.abs(parseFloat(spot.style.left) - 80) < 1 && Math.abs(parseFloat(spot.style.top) - 99) < 1; });
      } finally { await context.close(); }
    });
    await check('Hold ownership survives frame observation and release pauses the destination', async () => {
      await page.goto('http://127.0.0.1:5216/__test?mode=hold'); await ready(); await choices();
      const hold = page.getByRole('button', { name: 'Hold to play left', exact: true }); await hold.waitFor({ state: 'visible' });
      await hold.dispatchEvent('pointerdown', { pointerId: 7, button: 0, isPrimary: true });
      await page.waitForFunction(() => document.querySelector('#stage video')?.currentTime > .1);
      await page.getByRole('button', { name: 'Hold to play left', exact: true }).dispatchEvent('pointerup', { pointerId: 7, button: 0, isPrimary: true });
      await page.waitForTimeout(150); const pausedAt = await main().evaluate(video => video.currentTime);
      await page.waitForTimeout(350); const after = await main().evaluate(video => ({ paused: video.paused, time: video.currentTime }));
      assert.ok(after.paused); assert.ok(Math.abs(after.time - pausedAt) < .08, 'released Hold resumed from media preparation');
    });
    await check('Drag retains media ownership until completion and advances to its payoff', async () => {
      await page.goto('http://127.0.0.1:5216/__test?mode=drag'); await choices();
      const stick = page.getByText('DRAG', { exact: true }).locator('..'); await stick.waitFor({ state: 'visible' });
      const box = await stick.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x - 220, y, { steps: 5 });
      await page.waitForFunction(() => {
        const video = document.querySelector('#stage video'); if (!video || video.readyState < 2) return false;
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const context = canvas.getContext('2d');
        context.drawImage(video, 10, 10, 1, 1, 0, 0, 1, 1); const pixel = context.getImageData(0, 0, 1, 1).data;
        return pixel[1] > 80 && pixel[0] < 50 && pixel[2] < 50 && video.currentTime > .1;
      });
      await page.mouse.up(); await page.waitForTimeout(200);
      assert.ok(await main().evaluate(video => video.currentTime > .1), 'release restarted the payoff');
    });
    assert.deepEqual(errors, []);
    const sorted = [...latencies].sort((a, b) => a - b), report = { passed, samples: latencies.length,
      warmVisibleFrameMs: { p50: Math.round(sorted[Math.floor(sorted.length * .5)]), p95: Math.round(sorted[Math.floor(sorted.length * .95)]) },
      latencies: latencies.map(Math.round), warmBenchmarkRequests, requests: Object.fromEntries(requests), errors };
    fs.writeFileSync(path.join(output, process.env.GAME_BASELINE_DIR ? 'baseline.json' : latencies.length === 30 ? 'report.json' : 'smoke-report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } catch (error) { await page.screenshot({ path: output + '/failure.png' }); console.error(JSON.stringify({ errors, logs,
    geometry: await page.locator('[aria-label="Play left sub"]').evaluateAll(nodes => nodes.map(node => ({ style: node.getAttribute('style'), parent: node.parentElement.getBoundingClientRect().toJSON() }))),
    media: await page.locator('video').evaluateAll(videos => videos.map(v => ({ src: v.src, readyState: v.readyState, duration: v.duration, time: v.currentTime, width: v.videoWidth, height: v.videoHeight, bounds: v.getBoundingClientRect().toJSON(), error: v.error?.message }))) })); throw error; }
  finally { await browser.close(); await server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
