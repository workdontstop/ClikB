const assert = require('node:assert/strict');
const path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');

const fixture = `
import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider, useSelector } from 'react-redux';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { store } from './src/store';
import { setDeckEnabled } from './src/settingsSlice';
import { useCreationDeckHistory } from './src/useCreationDeckHistory';
import { usePromptInputHistory } from './src/usePromptInputHistory';
import { useDeckNavigation } from './src/useDeckNavigation';
const enabled = new URLSearchParams(location.search).get('deck') !== 'off';
const background = new URLSearchParams(location.search).has('background');
store.dispatch(setDeckEnabled(enabled));
const feedLayer = { version:1,tier:'deck',sessionId:'background',activePostId:5,collectionIds:[5,6],collectionReady:false,category:'all',scroll:{x:0,y:120},returnTo:{pathname:'/feeds',search:'',hash:'',state:null} };
history.replaceState({ idx: 0, key: 'feed', usr: { feedMarker: 'preserve', ...(background ? {clikbDeck:feedLayer} : {}) } }, '');
function App() {
  const route = useLocation();
  const deckEnabled = useSelector(state => state.settings.deckEnabled !== false);
  const [open, setOpen] = useState(false);
  const [workstation, setWorkstation] = useState('');
  const [revealed, setRevealed] = useState('');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [feedLoading,setFeedLoading] = useState(background);
  const feeds = useMemo(() => [{id:5},{id:6}], []);
  useDeckNavigation({feeds,category:'all',enabled:background,deckEnabled,autoOpen:false,loading:feedLoading,
    minimisePrompt:!open,getScroll:()=>({x:0,y:120}),restoreScroll:()=>{},prepareDeck:()=>{},onFullscreen:()=>{},onCreate:()=>setOpen(true)});
  usePromptInputHistory({ open, suspended: false, blockBack: true, routeKey: route.key, onClose: () => setOpen(false), onReopen: () => setOpen(true) });
  const deck = useCreationDeckHistory({ enabled: deckEnabled, active: open, escapeBlocked: optionsOpen,
    onRestoreWorkstation: setWorkstation, onCloseWorkstation: () => setWorkstation(''),
    onRevealGrid: scene => setRevealed(scene || ''),
  });
  window.fixture = {
    open: () => setOpen(true),
    closeCreation: () => setOpen(false),
    openDeck: deck.openDeck,
    selectScene: deck.selectScene,
    openWorkstation: deck.openWorkstation,
    closeWorkstation: deck.closeWorkstation,
    closeDeck: deck.closeDeck,
    setDeckEnabled: value => store.dispatch(setDeckEnabled(value)),
    closeVisibleWorkstation: () => {
      if (deck.workstationOpen) deck.closeWorkstation();
      else setWorkstation('');
    },
    setOptionsOpen,
    hydrateBackground: () => setFeedLoading(false),
    state: () => ({ open, workstation, revealed, deck: deck.deckOpen, scene: deck.sceneKey, optionsOpen, idx: history.state.idx }),
  };
  return <div>{open ? 'creation' : 'feed'}</div>;
}
createRoot(document.getElementById('root')).render(<StrictMode><Provider store={store}><BrowserRouter><App /></BrowserRouter></Provider></StrictMode>);
`;

(async () => {
  const bundle = await build({
    stdin: { contents: fixture, resolveDir: path.resolve(__dirname, '..'), loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    define: { 'import.meta.env': '{}' },
  });
  const html = '<div id="root"></div><script>' + bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>';
  const browser = await chromium.launch({
    headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', request => request.fulfill({ contentType: 'text/html', body: html }));
    const waitIndex = idx => page.waitForFunction(expected => window.fixture.state().idx === expected, idx);
    const state = () => page.evaluate(() => window.fixture.state());
    await page.goto('http://fixture.test/feeds?deck=on');
    await page.waitForFunction(() => !!window.fixture);
    await page.evaluate(() => window.fixture.open());
    await waitIndex(2);
    assert.equal((await state()).deck, true);

    await page.evaluate(() => {
      for (const scene of ['A:3', 'A:4', 'B:4:2']) window.fixture.selectScene(scene);
    });
    assert.equal((await state()).idx, 2, 'browsing does not grow history');
    assert.equal((await state()).scene, 'B:4:2');
    await page.evaluate(() => window.fixture.openWorkstation('B:4:2'));
    await waitIndex(3);
    assert.equal((await state()).workstation, 'B:4:2');
    await page.goBack();
    await waitIndex(2);
    assert.deepEqual(await state(), { open: true, workstation: '', revealed: '', deck: true, scene: 'B:4:2', optionsOpen: false, idx: 2 });
    await page.goForward();
    await waitIndex(3);
    assert.equal((await state()).workstation, 'B:4:2');
    await page.evaluate(() => window.fixture.closeWorkstation());
    await waitIndex(2);
    await page.evaluate(() => window.fixture.openWorkstation('A:8'));
    await waitIndex(3);
    await page.evaluate(() => window.fixture.selectScene('A:2'));
    await page.goBack();
    await waitIndex(2);
    assert.equal((await state()).scene, 'A:2', 'navigating scenes inside workstation updates Deck scene on Back');
    await page.evaluate(() => window.fixture.selectScene('B:4:2'));
    await page.evaluate(() => window.fixture.openWorkstation('A:13', true));
    await waitIndex(3);
    assert.equal((await state()).workstation, 'A:13', 'an explicit scene action targets its requested scene');
    await page.goBack();
    await waitIndex(2);
    assert.equal((await state()).scene, 'B:4:2', 'an explicit scene action can preserve the card the user was browsing');

    await page.evaluate(() => window.fixture.setOptionsOpen(true));
    await page.waitForFunction(() => window.fixture.state().optionsOpen === true);
    await page.keyboard.press('Escape');
    assert.equal((await state()).idx, 2, 'foreground options keep ownership of Escape');
    await page.evaluate(() => window.fixture.setOptionsOpen(false));
    await page.waitForFunction(() => window.fixture.state().optionsOpen === false);
    await page.keyboard.press('Escape');
    await waitIndex(1);
    assert.equal((await state()).deck, false);
    assert.equal((await state()).revealed, 'B:4:2');
    await page.goBack();
    await waitIndex(1);
    assert.equal((await state()).open, true, 'creation guard protects the URL beyond its root');

    await page.evaluate(() => window.fixture.openDeck('A:7'));
    await waitIndex(2);
    await page.evaluate(() => window.fixture.openWorkstation('A:7'));
    await waitIndex(3);
    await page.evaluate(() => window.fixture.closeCreation());
    await waitIndex(0);
    assert.equal((await state()).open, false, 'confirmed Close Creation unwinds all child layers');
    assert.equal(await page.evaluate(() => history.state.usr.feedMarker), 'preserve');
    assert.deepEqual(errors, []);

    await page.goto('http://fixture.test/feeds?deck=off');
    await page.waitForFunction(() => !!window.fixture);
    await page.evaluate(() => window.fixture.open());
    await waitIndex(1);
    assert.equal(await page.evaluate(() => window.fixture.openDeck('A:7')), false);
    assert.equal((await state()).deck, false);
    assert.equal((await state()).idx, 1);

    await page.goto('http://fixture.test/feeds?deck=on');
    await page.waitForFunction(() => !!window.fixture);
    await page.evaluate(() => window.fixture.open());
    await waitIndex(2);
    await page.evaluate(() => window.fixture.openWorkstation('A:7'));
    await waitIndex(3);
    await page.evaluate(() => window.fixture.setDeckEnabled(false));
    await page.waitForFunction(() => !window.fixture.state().deck);
    assert.equal((await state()).workstation, 'A:7', 'Deck Off keeps the current workstation open');
    await page.evaluate(() => window.fixture.closeVisibleWorkstation());
    await waitIndex(2);
    assert.equal((await state()).workstation, '', 'Close unwinds the owned workstation while Deck is Off');
    assert.equal(await page.evaluate(() => history.state.clikbCreationDeck.view), 'deck');
    await page.evaluate(() => window.fixture.setDeckEnabled(true));
    await page.waitForFunction(() => window.fixture.state().deck);
    assert.equal((await state()).scene, 'A:7');
    assert.equal(await page.evaluate(() => window.fixture.openWorkstation('A:8')), true, 'Reenabled Deck can open another workstation');
    await waitIndex(3);
    await page.evaluate(() => window.fixture.closeVisibleWorkstation());
    await waitIndex(2);
    assert.equal(await page.evaluate(() => window.fixture.closeDeck()), true, 'Reenabled Deck can close to Grid');
    await waitIndex(1);
    assert.equal((await state()).deck, false);

    await page.goto('http://fixture.test/feeds?deck=on&background=1');
    await page.waitForFunction(() => !!window.fixture);
    await page.evaluate(() => window.fixture.open());
    await waitIndex(2);
    await page.evaluate(() => window.fixture.openWorkstation('A:7'));
    await waitIndex(3);
    const promptOwner = await page.evaluate(() => history.state.clikbPromptInput.id);
    await page.evaluate(() => window.fixture.hydrateBackground());
    await page.waitForFunction(() => history.state.usr.clikbDeck.collectionReady);
    assert.equal(await page.evaluate(() => history.state.clikbPromptInput?.id), promptOwner, 'background Feed hydration keeps the protected Creation owner');
    assert.equal(await page.evaluate(() => history.state.clikbCreationDeck?.sceneKey), 'A:7', 'background Feed hydration keeps the current workstation history');
    assert.equal((await state()).idx, 3, 'background replace adds no new prompt or Deck entries');
    await page.goBack();await waitIndex(2);
    assert.equal((await state()).workstation,'');
    await page.goBack();await waitIndex(1);
    assert.equal((await state()).deck,false);
    assert.equal((await state()).open,true);
    console.log('PASS guarded Creation Deck history, swiping, popup Escape ownership, and live Deck preference changes');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
