const assert = require('node:assert/strict');
const path = require('node:path');
const ts = require('typescript');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const port = 5202;

// Exercise the production permission pill, live Redux snapshots, mapped DOM
// controls, safe child Close and shared Back. Parent media handlers are counters;
// this harness never starts a model, paid job, API request or browser history exit.
const fixture = ts.transpileModule(`
import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider,useSelector} from 'react-redux';
import {MemoryRouter} from 'react-router-dom';
import {store} from '/src/store.ts';
import AutoControlPill from '/src/AutoControlPill.tsx';
import SharedBackControl, {registerSharedBack} from '/src/SharedBackControl.tsx';
import {setThemePreference,setAutoControlVisible,setAutoControl,setVideoControl} from '/src/settingsSlice.ts';
import {patchUserSnapshot} from '/src/brainstormSlice.ts';
import {creationBinding as cb} from '/src/creationControlSnapshot.ts';
import {useCreationControls} from '/src/useCreationControls.ts';
import {handleNavigationBrowserRequest,startNavigationActionRegistry,observeCurrentAppSnapshot} from '/src/navigationBrowserControl.ts';
store.dispatch(setThemePreference('dark'));
store.dispatch(setAutoControlVisible({visible:true,actor:'user'}));
store.dispatch(setAutoControl({enabled:true,actor:'user'}));
store.dispatch(patchUserSnapshot({creation:{isActive:true,stage:'storybook',storybookMode:'Video',editStoryIsOpen:false,editStoryTab:'image'}}));
const calls={ordinary:0,paid:0,childClose:0,sharedBack:0};
let setHidden;
registerSharedBack('permission-test-parent',{priority:999,label:'Leave Creation',back:()=>calls.sharedBack++});
function App(){
 const [hidden,updateHidden]=useState(false);setHidden=updateHidden;
 const creation=useSelector(s=>s.brainstorm.userSnapshot.creation);
 const videoVisible=creation.isActive&&(creation.editStoryIsOpen?creation.editStoryTab==='video':['Video','B-shots'].includes(creation.storybookMode));
 useCreationControls('permission_test','PermissionTest',true);
 return <main style={{padding:24,fontFamily:'Arial',background:'#eee',color:'#111',minHeight:600}}>
   <div style={{display:'flex',gap:16,marginBottom:30}}>
    <button {...cb('permission_test','ordinary','Update prompt','ordinaryHandler')} onClick={()=>calls.ordinary++}>Update prompt</button>
    <button style={{display:videoVisible?'inline-block':'none'}} {...cb('permission_test','paid','Build motion guide','paidHandler','click','requires_video')} onClick={()=>calls.paid++}>Build motion guide</button>
    <button {...cb('permission_test','close_child','Close workstation','childCloseHandler')} onClick={()=>{calls.childClose++;store.dispatch(patchUserSnapshot({creation:{editStoryIsOpen:false,stage:'storybook'}}));}}>Close workstation</button>
   </div>
   <AutoControlPill placement='embedded' hidden={hidden}/><SharedBackControl/>
  </main>;
}
createRoot(document.getElementById('root')).render(<Provider store={store}><MemoryRouter initialEntries={['/feeds']}><App/></MemoryRouter></Provider>);
startNavigationActionRegistry();
window.test={snapshot:observeCurrentAppSnapshot,settings:()=>store.getState().settings,calls:()=>({...calls}),
 run:message=>handleNavigationBrowserRequest(message,location.origin),
 creation:patch=>store.dispatch(patchUserSnapshot({creation:patch})),
 auto:enabled=>store.dispatch(setAutoControl({enabled,actor:'user'})),
 video:enabled=>store.dispatch(setVideoControl(enabled)),hidden:value=>setHidden(value),
 visible:value=>store.dispatch(setAutoControlVisible({visible:value,actor:'user'}))};
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;

(async () => {
  const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')));
  const replies = new Map();
  const server = await createServer({ root, configFile: false, logLevel: 'error',
    cacheDir: path.join(root, 'node_modules/.tmp/video-permission-browser-vite'),
    optimizeDeps: { noDiscovery: true, force: true, include: ['react','react/jsx-runtime','react/jsx-dev-runtime','react-dom/client','react-redux','use-sync-external-store/with-selector','react-router-dom','@reduxjs/toolkit','@mui/material','@mui/material/styles','prop-types','react-is','@emotion/react','@emotion/styled'] },
    server: { host: '127.0.0.1', port, strictPort: true, hmr: false },
    plugins: [{ name: 'video-permission-controls',
      resolveId(id) { if (id === '/fixture.js') return '\0video-permission-controls'; },
      load(id) { if (id === '\0video-permission-controls') return fixture; },
      configureServer(server) { server.middlewares.use((req, res, next) => {
        if (req.url === '/__test') { res.setHeader('Content-Type', 'text/html'); res.end('<div id="root"></div><script type="module" src="/fixture.js"></script>'); return; }
        if (req.url === '/navigation/browser-reply') { let body = ''; req.on('data', chunk => body += chunk); req.on('end', () => { const data = JSON.parse(body); replies.set(data.requestId, data.reply); res.end('{}'); }); return; }
        next();
      }); }
    }]
  });
  await server.listen();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('Browser:', error.message); });
    page.on('console', message => { if (message.type() === 'error') console.error('Console:', message.text()); });
    page.setDefaultTimeout(30000);
    await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:' + port + '/') ? route.continue() : route.abort());
    const prefix = 'clikb.creation.video_permission';
    const videoButton = page.locator('[data-creation-area="' + prefix + '"]');
    let sequence = 0;
    async function run(command) {
      const requestId = 'permission-test-' + (++sequence);
      await page.evaluate(message => window.test.run(message), { ...command, requestId });
      assert.ok(replies.has(requestId), 'dispatcher must reply through its native endpoint');
      return replies.get(requestId);
    }
    async function click(key, extra = {}) {
      const actionId = key.startsWith('clikb.') ? key : 'clikb.creation.permission_test.action.' + key;
      const expectedVersion = await page.evaluate(() => window.test.snapshot().creation.controls?.stateVersion);
      return run({ command: 'action', actionId, expectedVersion, ...extra });
    }
    async function setView(view, expectedVisible) {
      await page.evaluate(patch => window.test.creation(patch), view);
      await page.waitForFunction(visible => !!document.querySelector('[data-creation-area="clikb.creation.video_permission"]') === visible, expectedVisible);
      assert.equal(await videoButton.count(), expectedVisible ? 1 : 0);
      const snapshot = await page.evaluate(() => window.test.snapshot());
      assert.equal(!!snapshot.creation.controls?.areas[prefix], expectedVisible, 'mapped permission target must match the mounted UI');
    }
    await page.goto('http://127.0.0.1:' + port + '/__test', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.test?.snapshot().creation.controls?.areas['clikb.creation.permission_test']);
    const scenarios = [
      [{ isActive: true, stage: 'storybook', storybookMode: 'Video', editStoryIsOpen: false }, true],
      [{ isActive: true, stage: 'storybook', storybookMode: 'B-shots', editStoryIsOpen: false }, true],
      [{ isActive: true, stage: 'storybook', storybookMode: 'Image', editStoryIsOpen: false }, false],
      [{ isActive: true, stage: 'editing_creation_prompt', storybookMode: '', editStoryIsOpen: false }, false],
      [{ isActive: false, stage: 'idle', storybookMode: 'Video', editStoryIsOpen: false }, false],
      [{ isActive: true, stage: 'editstory', storybookMode: 'Image', editStoryIsOpen: true, editStoryTab: 'video' }, true],
      [{ isActive: true, stage: 'editstory', storybookMode: 'Video', editStoryIsOpen: true, editStoryTab: 'image' }, false],
      [{ isActive: true, stage: 'editstory', storybookMode: 'B-shots', editStoryIsOpen: true, editStoryTab: 'narration' }, false],
    ];
    for (const viewport of [{width:1280,height:800},{width:390,height:844}]) {
      await page.setViewportSize(viewport);
      for (const [view, visible] of scenarios) await setView(view, visible);
    }
    console.log('PASS Video permission visibility: Storybook Video/B-shots and EditStory Video only, on desktop and mobile');
    await setView({ isActive: true, storybookMode: 'Video', editStoryIsOpen: false }, true);
    await page.evaluate(() => window.test.hidden(true));
    await page.waitForFunction(() => !document.querySelector('[data-auto-control]'));
    assert.equal(!!(await page.evaluate(() => window.test.snapshot())).creation.controls?.areas[prefix], false);
    await page.evaluate(() => window.test.hidden(false));
    await page.waitForFunction(() => !!document.querySelector('[data-auto-control]'));
    await page.evaluate(() => window.test.visible(false));
    await page.waitForFunction(() => !document.querySelector('[data-auto-control]'));
    assert.equal(!!(await page.evaluate(() => window.test.snapshot())).creation.controls?.areas[prefix], false);
    await page.evaluate(() => { window.test.visible(true); window.test.auto(true); });
    await page.waitForFunction(() => !!document.querySelector('[data-auto-control]'));

    // Native toggles must never couple Video Off to Auto Control Off. Snapshot
    // reads immediately after the native event use the current Redux values.
    await videoButton.click();
    let snapshot = await page.evaluate(() => window.test.snapshot());
    assert.equal(snapshot.autoControl.enabled, true);
    assert.equal(snapshot.autoControl.videoEnabled, true);
    await videoButton.click();
    snapshot = await page.evaluate(() => window.test.snapshot());
    assert.equal(snapshot.autoControl.enabled, true);
    assert.equal(snapshot.autoControl.videoEnabled, false);
    assert.equal(snapshot.autoControl.visible, true);
    assert.equal(snapshot.creation.controls.areas[prefix].controls[0].actionId, prefix + '.action.enable');
    assert.equal((await click('ordinary')).status, 'dispatched');
    assert.equal((await click('paid')).status, 'rejected');
    assert.deepEqual(await page.evaluate(() => window.test.calls()), {ordinary:1,paid:0,childClose:0,sharedBack:0});
    let reply = await click(prefix + '.action.enable');
    assert.equal(reply.status, 'rejected');
    assert.equal(reply.snapshot.autoControl.videoEnabled, false);
    reply = await click(prefix + '.action.enable', { confirmedTargetId: prefix + '.control.enable' });
    assert.equal(reply.status, 'dispatched');
    assert.equal(reply.snapshot.autoControl.videoEnabled, true);
    assert.equal(reply.snapshot.autoControl.enabled, true);
    assert.equal((await click('paid')).status, 'dispatched');
    assert.equal((await click(prefix + '.action.disable')).status, 'dispatched');
    snapshot = await page.evaluate(() => window.test.snapshot());
    assert.equal(snapshot.autoControl.enabled, true);
    assert.equal(snapshot.autoControl.videoEnabled, false);
    console.log('PASS independent permissions: native toggles, immediate current snapshot, ordinary work with Video Off, paid work only with both On, explicit proof before AI enables Video');

    await page.evaluate(() => { window.test.video(true); window.test.auto(false); });
    snapshot = await page.evaluate(() => window.test.snapshot());
    assert.equal(snapshot.autoControl.enabled, false);
    assert.equal(snapshot.autoControl.videoEnabled, true);
    assert.equal((await click('ordinary')).status, 'rejected');
    assert.equal((await click('paid')).status, 'rejected');
    assert.equal((await click(prefix + '.action.disable')).status, 'rejected');
    assert.equal((await click('close_child')).status, 'rejected');
    assert.deepEqual(await page.evaluate(() => window.test.calls()), {ordinary:1,paid:1,childClose:0,sharedBack:0});
    await page.evaluate(() => window.test.auto(true));
    await setView({isActive:true,storybookMode:'Video',editStoryIsOpen:true,editStoryTab:'video'}, true);
    reply = await run({ command: 'action', actionId: 'clikb.navigation.back.action.back' });
    assert.equal(reply.status, 'rejected');
    assert.match(reply.detail, /cannot exit Creation/);
    assert.equal((await click('close_child')).status, 'dispatched');
    snapshot = await page.evaluate(() => window.test.snapshot());
    assert.equal(snapshot.creation.isActive, true);
    assert.equal(snapshot.creation.editStoryIsOpen, false);
    assert.equal(snapshot.creation.stage, 'storybook');
    assert.deepEqual(await page.evaluate(() => window.test.calls()), {ordinary:1,paid:1,childClose:1,sharedBack:0});
    assert.equal(!!snapshot.navigation?.areas['clikb.navigation.back'], false);
    assert.deepEqual(errors, []);
    console.log('PASS Auto Off blocks AI; mapped child Close preserves Creation; shared Back cannot exit active Creation; no browser errors');
  } finally {
    if (browser) await browser.close();
    await server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
