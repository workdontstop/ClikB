const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const shared = require('./deckSearch.browser.cjs');

const root = path.resolve(__dirname, '..');
const api = `
window.auditApi = async (url, values = {}) => {
  const endpoint = url.split('/').pop();
  window.fixture.requests.push({ endpoint, values });
  if (endpoint === 'profileInfo') return { data: { payload: [{ id: values.memberId, username: 'profile' + values.memberId }] } };
  if (endpoint === 'fanStatus') return { data: { ok: true, following: false, followedBy: false, relationship: 'none' } };
  if (endpoint === 'fanList') return { data: { ok: true, userId: values.id, limit: 50, offset: 0, counts: { followers: 3, following: 4 } } };
  const owner = endpoint === 'getProfile' || endpoint === 'getProfileMore' ? Number(values.id) : 235;
  if (endpoint === 'getProfile' && new URLSearchParams(location.search).has('empty')) return { data: { payload: [], hasMore: false } };
  if (endpoint === 'getProfileMore' && values.override) {
    await new Promise(resolve => setTimeout(resolve, 75));
    return { data: { hasMore: true, payload: Array.from({ length: 28 }, (_, index) => ({
      id: values.lastId - index, caption: 'Anchored ' + index, finalTitle: 'Anchored ' + index,
      sender: owner, username: 'creator_with_a_long_name_' + owner, profile_image: image,
      mode: 0, item1: image, x1: image, video: 1,
    })) } };
  }
  const paged = location.pathname === '/' && new URLSearchParams(location.search).has('paged');
  const more = /More/.test(endpoint);
  const start = more ? 24 : 0;
  return { data: { hasMore: paged && !more, payload: Array.from({ length: more ? 12 : 24 }, (_, index) => ({
    id: owner * 100 + start + index + 1, caption: 'Story ' + (start + index + 1), finalTitle: 'Grid story ' + (start + index + 1),
    sender: paged && index % 2 === 0 ? 7 : owner, username: 'creator_with_a_long_name_' + (paged && index % 2 === 0 ? 7 : owner),
    profile_image: image, mode: 0, item1: image, x1: image, video: 1,
  })) } };
};
const noop=`;
const fixture = shared.fixture
  .replace("function App(){", "const initialOwner = new URLSearchParams(location.search).get('owner'); if (initialOwner) history.replaceState({ ...history.state, usr: { ...history.state?.usr, userId: Number(initialOwner) } }, '', location.href);\nfunction App(){")
  .replace('const props={', 'const props={minimiseProfile:false,setminimiseProfile:noop,setIsCropOpen:noop,setfollowType:noop,')
  .replace('setThemePreference,setDeckCleanMode}', 'setThemePreference,setDeckCleanMode,setDeckEnabled}')
  .replace("store.dispatch(setThemePreference('dark'))", "store.dispatch(setThemePreference(new URLSearchParams(location.search).get('theme') || 'light'))")
  .replace('store.dispatch(setDeckCleanMode(false));', "store.dispatch(setDeckCleanMode(false));\nif (new URLSearchParams(location.search).has('deckOff')) store.dispatch(setDeckEnabled(false));")
  .replace(/window\.auditApi=[\s\S]*?\nconst noop=/, api)
  .replace("location.pathname==='/search'?<Homepage {...props}/>:<Feedgate {...props} type={4} vertical={true}/>", `<Feedgate {...props}
    type={location.pathname === '/pages' ? 10 : location.pathname === '/search' ? 1 : 4}
    MyPageId={Number(location.state?.userId || new URLSearchParams(location.search).get('owner') || 7)}
    vertical={location.pathname !== '/search'} searchData={location.pathname === '/search' ? 'cars' : ''}/>`);
const media = `import React from 'react';export default function Media(p){return <button
  data-ai-action={p.aiActionId} onClick={p.onClick} aria-label="Open post"
  style={{display:'block',width:'100%',padding:0,border:0,aspectRatio:'9 / 16',position:'relative',background:'#456379'}}>
  <img src={p.image} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
  <span data-fixture-video-badge style={{position:'absolute',top:5,right:5,width:22,height:18,borderRadius:12,background:'#151922',color:'#fff'}}>▣</span>
  </button>;}`;
const draft = `import React from 'react';export function CreationDraftAction(){return <button
  data-fixture-draft data-creation-draft-action="grid" aria-label="Continue creation"
  style={{position:'absolute',right:8,top:8,width:36,height:36,zIndex:12,borderRadius:'50%'}}>✎</button>};export function BlueprintRemixAction(){return null;} export function BlueprintAllowRemix(){return null;}`;

async function main() {
  const bundled = await build({
    stdin: { contents: fixture, loader: 'tsx', resolveDir: root }, bundle: true, write: false,
    format: 'iife', platform: 'browser', jsx: 'automatic', logLevel: 'silent',
    loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.webp': 'dataurl', '.svg': 'dataurl', '.css': 'empty' },
    define: { 'import.meta.env': JSON.stringify({ VITE_CLIK_URL: 'http://clikb.test', PROD: false }) },
    plugins: [{ name: 'grid-creators', setup(builder) {
      builder.onResolve({ filter: /^(axios|.*(?:GlobalBrainstormGuide|KeywordSelector|TogglePromptButton|Footer|CropImageModal|CreativeProfiles|StoryAutoScroller|DetectDevice|creationDrafts\/actions))$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
        contents: args.path === 'axios' ? `export default {post:(url,body)=>window.auditApi(url,body?.values),get:url=>window.auditApi(url),put:(url,body)=>window.auditApi(url,body?.values)};`
          : /GlobalBrainstormGuide/.test(args.path) ? shared.guide
            : /DetectDevice/.test(args.path) ? 'export const matchMobile=innerWidth<600,matchPc=!matchMobile,matchTablet=false;'
              : /StoryAutoScroller/.test(args.path) ? media
                : /creationDrafts\/actions/.test(args.path) ? draft : 'export default function Stub(){return null;} export const CropImageModal=Stub;',
        loader: 'jsx', resolveDir: root,
      }));
      builder.onResolve({ filter: /^\/(?:src|server)\// }, args => ({ path: path.join(root, args.path.slice(1)) }));
    } }],
  });
  const css = ['src/DeckOverlay.css', 'src/FeedCreatorLink.css'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  const html = '<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial}</style><style>'
    + css + '</style><div id="root"></div><script>' + bundled.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>';
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const [width, theme] of [[1440, 'light'], [390, 'dark']]) {
      for (const horizontal of [false, true]) {
        const page = await browser.newPage({ viewport: { width, height: 900 } });
        const errors = [];
        page.setDefaultTimeout(10000);
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        await page.route('**/*', route => route.request().isNavigationRequest()
          ? route.fulfill({ status: 200, contentType: 'text/html', body: html }) : route.abort());
        await page.goto(`http://clikb.test/${horizontal ? 'search?q=cars&section=shorts&' : 'feeds?'}theme=${theme}`);
        if (!horizontal) {
          await page.locator('[data-ai-action="clikb.feeds.deck.action.close"]').click();
          await page.locator('[data-deck-overlay]').waitFor({ state: 'hidden' });
        }
        await page.waitForFunction(() => document.querySelectorAll('.feed-creator-link').length === 24).catch(async error => {
          console.error(errors);
          console.error(await page.evaluate(() => ({ route: location.href, requests: window.fixture.requests, body: document.body.innerText.slice(0, 600), errors: window.fixture.snapshot().feeds })));
          throw error;
        });
        await page.waitForTimeout(1000);
        await page.evaluate(horizontal => {
          const container = document.querySelector('[data-feed-post-id]')?.closest('[data-ai-scroll]');
          if (horizontal) container.scrollLeft = 200;
          else if (innerWidth < 600) window.scrollTo(0, 180);
          else container.scrollTop = 180;
        }, horizontal);
        await page.waitForTimeout(250);
        await page.waitForFunction(() => window.fixture.snapshot().feeds.availableActions.some(action => action.actionId.includes('.action.creator.')));
        const actionId = await page.evaluate(() => window.fixture.snapshot().feeds.availableActions.find(action => action.actionId.includes('.action.creator.')).actionId);
        const clickedPostId = Number(actionId.split('.creator.')[1]);
        const link = page.locator(`[data-ai-action="${actionId}"]`);
        const geometry = await link.evaluate(element => {
          const card = element.parentElement;
          const own = element.getBoundingClientRect();
          const badge = card.querySelector('[data-fixture-video-badge]').getBoundingClientRect();
          const draft = card.querySelector('[data-fixture-draft]').getBoundingClientRect();
          return { right: own.right, badgeLeft: badge.left, draftLeft: draft.left, title: element.title,
            clipped: element.scrollWidth > element.clientWidth };
        });
        assert.ok(geometry.right < geometry.badgeLeft && geometry.right < geometry.draftLeft);
        assert.equal(geometry.title, '@creator_with_a_long_name_235');
        assert.equal(await link.evaluate(element => document.elementFromPoint(element.getBoundingClientRect().left + 5, element.getBoundingClientRect().top + 5) === element), true);
        const source = await page.evaluate(() => {
          const container = document.querySelector('[data-feed-post-id]').closest('[data-ai-scroll]');
          return { url: location.href, x: container.scrollLeft, y: container.scrollTop, windowY: window.scrollY };
        });
        await page.screenshot({ path: path.join(root, `.tmp/grid-creators-${horizontal ? 'horizontal' : 'vertical'}-${width}-${theme}.png`) });
        const status = await page.evaluate(async actionId => {
          const requestId = 'grid-creator';
          await window.fixture.run({ requestId, command: 'action', actionId, expectedFeedsContext: window.fixture.context(actionId) });
          return window.fixture.replies[requestId].status;
        }, actionId);
        assert.equal(status, 'observed_change');
        assert.equal(await page.evaluate(() => window.history.state.usr.userId), 235);
        await page.waitForFunction(() => window.fixture.snapshot().feeds.areas['clikb.feeds.deck']?.state.activeCategory === 'page');
        await page.waitForFunction(() => window.history.state.usr?.clikbDeck?.category === 'page' && window.history.state.usr.clikbDeck.collectionReady === true);
        assert.equal(await page.evaluate(() => window.fixture.snapshot().feeds.areas['clikb.feeds.deck'].state.activePostId), clickedPostId);
        assert.equal(await page.locator('.feed-creator-link').count(), 0);
        await page.waitForTimeout(100);
        await page.goBack();
        await page.locator('[data-deck-overlay]').waitFor({ state: 'hidden' }).catch(async error => {
          console.error(await page.evaluate(() => ({ url: location.href, state: window.history.state, requests: window.fixture.requests })));
          throw error;
        });
        await page.goBack();
        await page.waitForFunction(() => document.querySelectorAll('.feed-creator-link').length === 24);
        await page.waitForTimeout(800);
        const returned = await page.evaluate(() => {
          const container = document.querySelector('[data-feed-post-id]').closest('[data-ai-scroll]');
          return { url: location.href, x: container.scrollLeft, y: container.scrollTop, windowY: window.scrollY };
        });
        assert.deepEqual(returned, source);
        assert.equal(await page.locator('[data-deck-overlay]').count(), 0);
        await page.goForward();
        await page.goForward();
        await page.waitForFunction(() => window.fixture.snapshot().feeds.areas['clikb.feeds.deck']?.state.profileOwnerId === 235);
        assert.deepEqual(errors, []);
        console.log(`PASS ${width}px ${theme} ${horizontal ? 'horizontal Search' : 'vertical Grid'} creator link, badge spacing, exact AI target, and history scroll`);
        await page.close();
      }
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.route('**/*', route => route.request().isNavigationRequest()
        ? route.fulfill({ status: 200, contentType: 'text/html', body: html }) : route.abort());
      await page.goto(`http://clikb.test/pages?owner=235&deckOff=1&theme=${theme}`);
      const disabledSnapshot = await page.evaluate(() => window.fixture.snapshot());
      assert.equal(disabledSnapshot.ui.deckEnabled, false);
      assert.equal(Object.hasOwn(disabledSnapshot.ui, 'deckCleanMode'), false);
      assert.equal(disabledSnapshot.feeds?.areas['clikb.feeds.deck'], undefined);
      assert.ok(!disabledSnapshot.feeds?.availableActions.some(action => action.actionId.startsWith('clikb.feeds.deck.')));
      const post = page.locator('[data-feed-post-id="23507"]').getByRole('button', { name: 'Open post' });
      await post.scrollIntoViewIfNeeded();
      const scroll = () => page.locator('[data-feed-post-id="23507"]').evaluate(element => ({
        y: innerWidth < 600 ? window.scrollY : element.closest('[data-ai-scroll]').scrollTop,
        url: location.href,
      }));
      const original = await scroll();
      const selectedPostVisible = () => page.waitForFunction(() => Object.entries(window.fixture.snapshot().feeds.areas)
        .some(([id, area]) => id.startsWith('clikb.feeds.fullscreen.') && area.state.postId === 23507));
      await post.click();
      await selectedPostVisible();
      assert.equal(await page.locator('[data-deck-overlay]').count(), 0);
      await page.goBack();
      await page.locator('[data-fullscreen-stories]').waitFor({ state: 'hidden' });
      await page.waitForTimeout(500);
      assert.deepEqual(await scroll(), original);
      await page.goForward();
      await selectedPostVisible();
      console.log(`PASS ${width}px ${theme} member Grid opens the exact post with Deck Off and Back restores scroll`);
      await page.close();
      const home = await browser.newPage({ viewport: { width, height: 900 } });
      await home.route('**/*', route => route.request().isNavigationRequest()
        ? route.fulfill({ status: 200, contentType: 'text/html', body: html }) : route.abort());
      await home.goto(`http://clikb.test/?paged=1&deckOff=1&theme=${theme}`);
      const firstPage = home.locator('[data-feed-post-id="23524"]');
      await firstPage.scrollIntoViewIfNeeded();
      await home.waitForFunction(() => document.querySelector('[data-feed-post-id="23530"]'));
      const other = home.locator('[data-feed-post-id="23530"] .feed-creator-link');
      const own = home.locator('[data-feed-post-id="23529"] .feed-creator-link');
      assert.equal(await own.getAttribute('aria-label'), 'Visit @creator_with_a_long_name_7');
      assert.equal(await other.getAttribute('aria-label'), 'Visit @creator_with_a_long_name_235');
      await other.scrollIntoViewIfNeeded();
      const scrollFromLink = link => link.evaluate(element => ({
        y: innerWidth < 600 ? window.scrollY : element.closest('[data-ai-scroll]').scrollTop,
        url: location.href,
      }));
      const homeSource = await scrollFromLink(other);
      await other.click();
      await home.waitForFunction(() => location.pathname === '/pages' && window.history.state.usr?.userId === 235);
      // The source collection also contains this post. Wait for the profile
      // layout to commit before inspecting it, rather than matching that old row.
      await home.waitForFunction(() => !document.querySelector('.feed-creator-link'));
      await home.locator('[data-feed-post-id="23530"]').waitFor();
      assert.equal(await home.locator('.feed-creator-link').count(), 0);
      await home.goBack();
      await home.waitForTimeout(1000);
      await other.waitFor();
      await home.waitForTimeout(500);
      assert.deepEqual(await scrollFromLink(other), homeSource);
      await home.goForward();
      await home.waitForFunction(() => location.pathname === '/pages' && window.history.state.usr?.userId === 235);
      console.log(`PASS ${width}px ${theme} paginated Home Grid visits the clicked creator and restores source history`);
      await home.close();
      for (const owner of [7, 999]) {
        const empty = await browser.newPage({ viewport: { width, height: 900 } });
        await empty.route('**/*', route => route.request().isNavigationRequest()
          ? route.fulfill({ status: 200, contentType: 'text/html', body: html }) : route.abort());
        await empty.goto(`http://clikb.test/pages?owner=${owner}&empty=1&deckOff=1&theme=${theme}`);
        await empty.waitForFunction(id => window.fixture.snapshot().navigation.areas['clikb.profile_header']?.state.profileId === id, owner).catch(async error => {
          console.error(await empty.evaluate(() => ({ body: document.body.innerText, state: window.fixture.snapshot().navigation, requests: window.fixture.requests })));
          throw error;
        });
        assert.equal(await empty.locator('[data-feed-post-id]').count(), 0);
        const control = owner === 7 ? 'following' : 'follow';
        await empty.locator(`[data-ai-action="clikb.profile_header.action.${control}"]`).waitFor();
        assert.equal(await empty.locator('.profile-relationships').isVisible(), true);
        await empty.close();
      }
      console.log(`PASS ${width}px ${theme} empty own and visited profile headers remain available with sidebar closed`);
    }
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
