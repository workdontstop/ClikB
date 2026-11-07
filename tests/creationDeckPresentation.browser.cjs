const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..');

const fixture = `
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './src/store';
import { setDeckEnabled, setDeckCleanMode, setAutoControlVisible, showPixelChargeNotice, clearPixelChargeNotice, showAiProviderNotice, clearAiProviderNotice } from './src/settingsSlice';
import { flushCreationControls } from './src/useCreationControls';
import { DeckRuntimeProvider } from './src/DeckRuntimeContext';
import CreationDeck from './src/CreationDeck';
const cards = [1, 2, 3].map(n => ({ id: 'A:'+n, title: 'Scene '+n, text: 'Scene details', image: n === 2 ? '/wide-scene.svg' : undefined, isPreview: n === 2 }));
store.dispatch(setDeckCleanMode(false));
function App(){
  const [detail,setDetail] = useState(false);
  const [selected,setSelected] = useState('A:1');
  const [open,setOpen] = useState(true);
  const [preview,setPreview] = useState(true);
  const [finalImage,setFinalImage] = useState(false);
  window.fixture = { snapshot: () => { flushCreationControls(); return store.getState().brainstorm.userSnapshot.creation.controls?.areas; },
    off: () => { store.dispatch(setDeckEnabled(false)); return window.fixture.snapshot(); },
    showControl: () => store.dispatch(setAutoControlVisible({visible:true,actor:'user'})),
    clean: value => store.dispatch(setDeckCleanMode(value)), preview: setPreview, finalImage:()=>setFinalImage(true), open: () => setOpen(true),
    notices: () => { store.dispatch(showPixelChargeNotice({pixels:4,label:'Reference Prompts'})); store.dispatch(showAiProviderNotice('Trying the available image provider…')); },
    clearNotices: () => { store.dispatch(clearPixelChargeNotice()); store.dispatch(clearAiProviderNotice()); } };
  return open && <CreationDeck title="Storyboard" cards={cards.map(card=>({...card,isPreview:card.isPreview&&!finalImage}))} activeId={selected} onSelect={setSelected}
    detail={detail ? <p>Open scene options</p> : undefined} onOptions={()=>setDetail(true)}
    onCloseDetail={()=>setDetail(false)} onClose={()=>setOpen(false)} slideshow
    topControls={preview && <div className="creation-deck-split"><input aria-label="Edit generation" style={{flex:1,minWidth:0}}/><button>Go</button></div>}
    footer={preview && <div className="creation-deck-split"><button>Characters</button><button>Proceed</button></div>} />;
}
createRoot(document.getElementById('root')).render(<Provider store={store}><DeckRuntimeProvider minimisePrompt={false} setminimisePrompt={()=>{}} clikUrl="http://fixture.test" isMenuOpen={false} matchMobile={innerWidth<600}><App/></DeckRuntimeProvider></Provider>);
`;

(async () => {
  const bundle = await build({ stdin: { contents: fixture, resolveDir: root, loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', loader: { '.css': 'empty', '.webp': 'dataurl' },
    define: { 'import.meta.env': '{}' }, plugins: [{ name:'stub-guide-host', setup(builder) {
      builder.onResolve({filter:/GlobalBrainstormGuide$/}, () => ({path:'guide',namespace:'fixture'}));
      builder.onLoad({filter:/.*/,namespace:'fixture'}, () => ({contents:'import {createPortal} from "react-dom"; export const GlobalBrainstormGuide=({dockHost})=>dockHost?createPortal(<div style={{height:96}}>Concierge fixture</div>,dockHost):null;',loader:'tsx',resolveDir:root}));
    }}] });
  const css = ['DeckOverlay.css','CreationDeck.css'].map(file => fs.readFileSync(path.join(root,'src',file),'utf8')).join('\n');
  const html = '<meta name="viewport" content="width=device-width, initial-scale=1"><style>'+css+'</style><div id="root"></div><script>'+bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>';
  const browser = await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try {
    for (const width of [1440,390]) {
      const page = await browser.newPage({viewport:{width,height:850}});
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*', route=>route.request().url().endsWith('/wide-scene.svg')
        ? route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="100%" height="100%" fill="white"/></svg>'})
        : route.fulfill({contentType:'text/html',body:html}));
      await page.goto('http://fixture.test/create');
      const deck = page.locator('.creation-deck');
      await deck.waitFor();
      await page.waitForTimeout(350);
      const card = deck.locator('.deck-card--active');
      const guide = deck.locator('.creation-deck-concierge');
      const footer = deck.locator('.creation-deck-footer');
      const cardBox = await card.boundingBox();
      const fieldBox = await deck.locator('.creation-deck-top-controls .creation-deck-split').boundingBox();
      const guideBox = await guide.boundingBox();
      const footerBox = await footer.boundingBox();
      const center = box => box.x + box.width / 2;
      const collection = deck.locator('.creation-deck-collection');
      assert.equal(await collection.locator('.deck-position').count(), 3, 'Normal Deck has one Feeds-style dot per card');
      assert.equal((await collection.locator('.deck-count').textContent()).trim(), '1 / 3');
      assert.equal(await collection.locator('.deck-position[aria-current="true"]').getAttribute('aria-label'), 'Show card 1: Scene 1');
      const collectionBox = await collection.boundingBox();
      assert.ok(collectionBox.y >= cardBox.y + cardBox.height && collectionBox.y + collectionBox.height <= guideBox.y, 'collection dots sit between cards and Concierge');
      assert.ok(Math.abs(cardBox.width - fieldBox.width) < 1 && Math.abs(cardBox.x - fieldBox.x) < 1, 'Edit generation matches the active card edges');
      assert.ok(guideBox.y >= cardBox.y + cardBox.height && footerBox.y >= guideBox.y + guideBox.height + 8, 'Normal Deck leaves separate rows for Concierge and actions');
      await page.evaluate(() => window.fixture.clean(true));
      assert.equal(await deck.locator('.creation-deck-collection').count(), 0, 'Clean Deck keeps the collection indicator hidden');
      await guide.filter({hasText:'Concierge fixture'}).waitFor();
      const topGuide = await deck.locator('.creation-deck-concierge--top').boundingBox();
      const cleanCardBox = await card.boundingBox();
      const cleanFieldBox = await deck.locator('.creation-deck-top-controls .creation-deck-split').boundingBox();
      assert.ok(Math.abs(cleanCardBox.width / cleanCardBox.height - 9 / 16) < .002, 'Clean Creation Deck retains the shared portrait aspect ratio');
      assert.ok(Math.abs(cleanCardBox.width - cleanFieldBox.width) < 1 && Math.abs(cleanCardBox.x - cleanFieldBox.x) < 1, 'Clean edit field follows the actual portrait card edges');
      assert.ok(Math.abs(center(topGuide) - center(await card.boundingBox())) < 1, 'Clean Deck centers Concierge over the active card');
      assert.ok(topGuide.y + topGuide.height <= (await card.boundingBox()).y, 'Concierge sits above the card');
      const previewStage = await deck.locator('.creation-deck-stage').boundingBox();
      await page.evaluate(() => window.fixture.preview(false));
      const headerGuide = deck.locator('.creation-deck-concierge--header');
      await headerGuide.waitFor();
      assert.ok(Math.abs(center(await headerGuide.boundingBox()) - center(await card.boundingBox())) < 1);
      assert.ok((await deck.locator('.creation-deck-stage').boundingBox()).height >= previewStage.height - 1, 'later stages can use the preview space');
      const laterCard = await card.boundingBox();
      assert.ok(Math.abs(laterCard.width - cleanCardBox.width) < 1 && Math.abs(laterCard.height - cleanCardBox.height) < 1, 'preview controls do not change the standard card dimensions');
      await page.evaluate(() => window.fixture.preview(true));
      await page.evaluate(() => window.fixture.clean(false));
      const typography = await deck.locator('.deck-card--active .creation-deck-text').evaluate(el => {
        const heading = getComputedStyle(el.querySelector('h2'));
        const body = getComputedStyle(el.querySelector('p'));
        return { titleSize: parseFloat(heading.fontSize), titleWeight: Number(heading.fontWeight),
          bodySize: parseFloat(body.fontSize), bodyWeight: Number(body.fontWeight) };
      });
      assert.ok(typography.titleSize >= 26 && typography.titleWeight >= 800, 'text cards have a clear bold heading');
      assert.ok(typography.bodySize >= 15 && typography.bodyWeight >= 500, 'response copy remains readable');
      const selector = deck.locator('.creation-deck-selector');
      const chevron = selector.locator('svg');
      const labelBox = await selector.locator('.creation-deck-selector-label').boundingBox();
      const chevronBox = await chevron.boundingBox();
      assert.ok(Math.abs(labelBox.y + labelBox.height / 2 - chevronBox.y - chevronBox.height / 2) < 1, 'selector arrow is vertically centred with its label');
      await selector.click();
      await deck.locator('.creation-deck-menu').waitFor();
      assert.equal(await selector.getAttribute('aria-expanded'), 'true');
      assert.equal(await deck.locator('.creation-deck-footer [data-deck-slideshow-control]').count(), 0);
      await deck.getByRole('button', {name:'Play slideshow',exact:true}).click();
      await deck.locator('.creation-deck-menu').waitFor({state:'hidden'});
      await deck.locator('[data-deck-slideshow-status="running"]').waitFor();
      assert.equal((await page.evaluate(()=>window.fixture.snapshot()?.['clikb.creation.deck_view'])).state.slideshowPlaying, true);
      await selector.click();
      await deck.getByRole('button', {name:'Pause slideshow',exact:true}).click();
      await deck.locator('.creation-deck-menu').waitFor({state:'hidden'});
      await deck.locator('[data-deck-slideshow-status="running"]').waitFor({state:'hidden'});
      assert.equal((await page.evaluate(()=>window.fixture.snapshot()?.['clikb.creation.deck_view'])).state.slideshowPlaying, false);
      await selector.click();
      await page.keyboard.press('Escape');
      await deck.locator('.creation-deck-menu').waitFor({state:'hidden'});
      assert.equal(await selector.getAttribute('aria-expanded'), 'false');
      const wheel = x => deck.locator('.creation-deck-stage').evaluate((el,dx)=>!el.dispatchEvent(new WheelEvent('wheel',{deltaX:dx,bubbles:true,cancelable:true})),x);
      assert.equal(await wheel(110),true,'horizontal wheel is contained');
      await page.waitForFunction(()=>document.querySelector('.creation-deck')?.getAttribute('data-creation-deck-scene')==='A:2');
      assert.equal(await deck.getAttribute('data-creation-deck-scene'),'A:2');
      assert.equal((await collection.locator('.deck-count').textContent()).trim(), '2 / 3');
      assert.equal(await card.locator('img').evaluate(el => getComputedStyle(el).objectFit), 'cover', 'Landscape media fills the card');
      assert.equal(await card.locator('img').evaluate(el => getComputedStyle(el).objectPosition), '50% 10%', 'Creation Deck retains the upper part of a cropped image');
      await card.getByText('Preview',{exact:true}).waitFor();
      await page.evaluate(()=>window.fixture.clean(true));
      await card.getByText('Preview',{exact:true}).waitFor();
      await page.evaluate(()=>window.fixture.finalImage());
      await card.locator('[data-scene-preview]').waitFor({state:'hidden'});
      await page.evaluate(()=>window.fixture.clean(false));
      await deck.getByRole('button',{name:'Options',exact:true}).click();
      await deck.getByText('Open scene options').waitFor();
      assert.equal(await collection.isVisible(), false, 'single-card detail keeps browsing dots hidden');
      await page.waitForTimeout(220);
      assert.equal(await wheel(110),true,'detail still contains browser gesture');
      assert.equal(await deck.getAttribute('data-creation-deck-scene'),'A:2');
      await deck.getByRole('button',{name:'Close details'}).click();
      await collection.getByRole('button',{name:'Show card 3: Scene 3',exact:true}).click();
      assert.equal(await deck.getAttribute('data-creation-deck-scene'),'A:3');
      assert.equal((await collection.locator('.deck-count').textContent()).trim(), '3 / 3', 'dot selection uses the same active card state');
      const area=await page.evaluate(()=>window.fixture.snapshot()?.['clikb.creation.deck_view']);
      assert.equal(area.state.centeredCardId,'A:3');
      assert.ok(area.controls.some(control=>control.actionId==='clikb.creation.deck_view.action.close'));
      await page.evaluate(()=>window.fixture.notices());
      await deck.getByText('−4P · Reference Prompts',{exact:true}).waitFor();
      await deck.getByText('Trying the available image provider…',{exact:true}).waitFor();
      await deck.getByRole('button',{name:'Close Creation Deck to Grid',exact:true}).first().click();
      await deck.waitFor({state:'hidden'});
      await page.evaluate(()=>window.fixture.open());
      await deck.getByText('−4P · Reference Prompts',{exact:true}).waitFor();
      await deck.getByText('Trying the available image provider…',{exact:true}).waitFor();
      await page.evaluate(()=>window.fixture.clearNotices());
      await deck.locator('.creation-deck-notices').waitFor({state:'hidden'});
      await page.evaluate(()=>window.fixture.showControl());
      await deck.locator('.creation-deck-dock [data-auto-control]').waitFor();
      await page.evaluate(()=>window.fixture.clean(true));
      const cleanControl=deck.locator('.creation-deck-clean-control [data-auto-control]');
      await cleanControl.waitFor();
      assert.equal(await deck.locator('[data-auto-control]').count(),1);
      assert.ok((await cleanControl.boundingBox()).y > (await card.boundingBox()).y + (await card.boundingBox()).height);
      const immediateOff=await page.evaluate(()=>window.fixture.off());
      assert.equal(immediateOff?.['clikb.creation.deck_view'],undefined,'Off filters Deck controls before React unmount');
      await deck.waitFor({state:'hidden'});
      assert.equal(await page.evaluate(()=>window.fixture.snapshot()?.['clikb.creation.deck_view']),undefined);
      assert.deepEqual(errors,[]);
      await page.close();
      console.log('PASS '+width+'px Creation Deck swipe containment, locked details, exact snapshot and Deck Off');
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
