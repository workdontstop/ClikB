const assert = require('node:assert/strict');
const { build } = require('esbuild');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const { creationExecutionContext } = require('./loadTs.cjs')('server/src/creationControlIdentity.ts');

const fixture = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import WorldCreation from './src/WorldCreation';
import WorldListOpened from './src/WorldListOpened';
import { store } from './src/store';
import { setAutoControlVisible, setAutoControl, setConciergeEnabled } from './src/settingsSlice';
import { observeCurrentAppSnapshot, handleNavigationBrowserRequest } from './src/navigationBrowserControl';
const noop = () => {};
const image = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const world = { id: 8, title: 'World A', description: 'Description', blueprint: 'Blueprint', original_prompt: 'Prompt',
  characters: [
    { id: 11, name: 'Same name', description: 'The character', image, kind: 'character' },
    { id: 12, name: 'Same name', description: 'The object', image: image + '#object', kind: 'object' },
  ] };
const refs = Array.from({ length: 40 }, (_, index) => ({ name: 'Reference ' + index, image: image + '#' + index }));
store.dispatch(setConciergeEnabled(true));
store.dispatch(setAutoControlVisible({visible:true,actor:'user'}));
store.dispatch(setAutoControl({enabled:true,actor:'user'}));
window.worldFixture = { observe: observeCurrentAppSnapshot, execute: request => handleNavigationBrowserRequest(request, location.origin) };
createRoot(document.querySelector('#root')).render(<Provider store={store}><main style={{height:'100dvh',overflow:'hidden'}}>
  {location.pathname === '/details' ? <WorldListOpened world={world} matchMobile={true} mode={0}
    selectedImages={[]} handleSelection={noop} onBack={noop} onEdit={noop} />
    : <WorldCreation world={world} open darkMode={false} PRIMARY_COLOR="#a31b1b" onClose={noop}
      setCreationDone={noop} referenceImages={refs} />}
</main></Provider>);
`;

(async () => {
  const bundle = await build({
    stdin: { contents: fixture, loader: 'tsx', resolveDir: process.cwd() },
    bundle: true, write: false, format: 'iife', jsx: 'automatic',
    define: { 'import.meta.env': '{}', 'process.env.NODE_ENV': '"production"' },
    loader: { '.css': 'empty', '.svg': 'dataurl', '.png': 'dataurl', '.jpg': 'dataurl', '.mp3': 'dataurl', '.mp4': 'dataurl' },
  });
  const html = '<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><div id="root"></div><script>'
    + bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>';
  const browser = await chromium.launch({ executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const replies = new Map();
    await page.route('**/*', route => {
      if (route.request().isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: html });
      if (route.request().url().endsWith('/navigation/browser-reply')) {
        const { requestId, reply } = route.request().postDataJSON();
        replies.set(requestId, reply);
        return route.fulfill({ json: {} });
      }
      return route.abort();
    });
    const read = () => page.evaluate(() => window.worldFixture.observe());
    const lookup = (snapshot, area, key) => snapshot.creation.controls.areas['clikb.creation.' + area]?.controls
      .find(control => control.actionId === 'clikb.creation.' + area + '.action.' + key);
    let request = 0;
    async function execute(area, key, kind = 'click', extra = {}, observed) {
      const before = observed || await read();
      const control = lookup(before, area, key);
      assert.ok(control?.enabled, key + ' is available');
      assert.equal(control.controlId, 'clikb.creation.' + area + '.control.' + key);
      assert.equal(control.kind, kind);
      const requestId = String(++request);
      await page.evaluate(message => window.worldFixture.execute(message), {
        requestId, command: kind === 'click' ? 'action' : kind,
        ...(kind === 'scroll' ? { scrollId: control.actionId } : { actionId: control.actionId }),
        expectedVersion: before.creation.controls.stateVersion,
        expectedCreationContext: creationExecutionContext(before, control.actionId, kind),
        ...extra,
      });
      return replies.get(requestId);
    }
    async function dispatched(...args) {
      const reply = await execute(...args);
      assert.equal(reply?.status, 'dispatched', JSON.stringify({ key: args[1], status: reply?.status, detail: reply?.detail }));
    }
    const editor = 'storybook_world';
    await page.goto('http://fixture.test/editor');
    await page.getByLabel('World title').waitFor();
    await dispatched(editor, 'asset_11');
    const oldTarget = await read();
    assert.equal(oldTarget.creation.controls.areas['clikb.creation.storybook_world'].state.selectedAssetId, '11');
    await page.locator('[data-ai-action$=".asset_12"]').click();
    await page.locator('[data-ai-action$=".asset_name"]').scrollIntoViewIfNeeded();
    assert.equal((await execute(editor, 'asset_name', 'text', { text: 'Wrong target' }, oldTarget)).status, 'stale_or_unavailable');
    assert.equal(await page.getByLabel('Asset name').inputValue(), 'Same name');
    await dispatched(editor, 'asset_name', 'text', { text: 'Selected object' });
    assert.equal(await page.getByLabel('Asset name').inputValue(), 'Selected object');
    await page.getByRole('combobox', { name: 'Saved reference' }).scrollIntoViewIfNeeded();
    await dispatched(editor, 'reference_picker');
    assert.ok(lookup(await read(), editor, 'reference_scroll')?.canScrollForward);
    await dispatched(editor, 'reference_scroll', 'scroll', { direction: 'forward' });
    assert.ok(lookup(await read(), editor, 'reference_scroll')?.canScrollBackward);
    await page.keyboard.press('Escape');
    await page.getByRole('listbox').waitFor({ state: 'hidden' });
    await page.locator('[data-ai-action$=".action.create"]').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.worldFixture.observe().creation.controls.areas['clikb.creation.storybook_world']
      ?.controls.some(control => control.actionId.endsWith('.action.create')));
    assert.equal((await execute(editor, 'create')).status, 'rejected', 'World save requires confirmation');

    const detail = 'world_detail';
    await page.goto('http://fixture.test/details');
    await page.getByText('World A', { exact: true }).waitFor();
    await dispatched(detail, 'description_world_8');
    await dispatched(detail, 'section_world_8_character_11');
    assert.equal((await read()).creation.controls.areas['clikb.creation.world_detail'].state.expandedSection, 'world_8_character_11');
    assert.ok(lookup(await read(), detail, 'scroll')?.canScrollForward);
    await dispatched(detail, 'scroll', 'scroll', { direction: 'forward' });
    await dispatched(detail, 'section_world_8_character_12');
    assert.equal((await read()).creation.controls.areas['clikb.creation.world_detail'].state.expandedSection, 'world_8_character_12');
    console.log('PASS World controls reject a stale asset, drive the reference menu, protect Save, and scroll to exact detail rows on mobile');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
