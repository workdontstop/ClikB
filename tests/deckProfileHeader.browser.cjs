const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const shared = require('./deckSearch.browser.cjs');

const root = path.resolve(__dirname, '..');
const output = path.join(root, '.tmp');
const profileApi = `
window.fixture.profileReplies = [];
window.fixture.releaseProfiles = () => window.fixture.profileReplies.splice(0).forEach(resolve => resolve());
window.auditApi = async (url, values = {}) => {
  const endpoint = url.split('/').pop();
  window.fixture.requests.push({ endpoint, values });
  const owner = Number(values.memberId || values.id || 235);
  if (endpoint === 'profileInfo') {
    if (owner === 235 && new URLSearchParams(location.search).has('slowProfile')) {
      await new Promise(resolve => window.fixture.profileReplies.push(resolve));
    }
    return { data: { payload: [{ id: owner, username: 'profile' + owner,
      profile_image: image + '#portrait-' + owner, profile_image_thumb: image + '#thumb-' + owner }] } };
  }
  const profile = endpoint === 'getProfile' || endpoint === 'getProfileMore';
  const member = profile ? owner : 235;
  const base = profile ? owner * 100 : 100;
  return { data: { hasMore: false, payload: member === 999 ? [] : [1, 2, 3].map(index => ({
    id: values.override ? values.lastId - index + 1 : base + index, caption: 'Post ' + (base + index), finalTitle: 'Profile fixture ' + index,
    sender: member, username: 'card' + member, profile_image: image + '#post-avatar-' + member,
    mode: 0, item1: image, x1: image,
  })) } };
};
const noop=`;

const fixture = shared.fixture
  .replace('BrowserRouter,useLocation}', 'BrowserRouter,useLocation,useNavigate}')
  .replace("import {DeckRuntimeProvider}", "import {deckRouteTransition} from '/src/useDeckNavigation.ts';\nimport {DeckRuntimeProvider}")
  .replace("store.dispatch(setThemePreference('dark'))", "store.dispatch(setThemePreference(new URLSearchParams(location.search).get('theme') || 'light'))")
  .replace(/window\.auditApi=[\s\S]*?\nconst noop=/, profileApi)
  .replace('function App(){const location=useLocation(),', 'function App(){const navigate=useNavigate(),location=useLocation(),')
  .replace('window.fixture.compose=setminimisePrompt;', `
    window.fixture.compose = setminimisePrompt;
    window.fixture.setClean = value => store.dispatch(setDeckCleanMode(value));
    window.fixture.visit = member => {
      const transition = deckRouteTransition(location, '/pages', { userId: member }, { deckEnabled: true });
      navigate(transition.to, { ...transition.options, replace: false });
    };
  `)
  .replace('<Feedgate {...props} type={4} vertical={true}/>', `<Feedgate {...props}
    type={location.pathname === '/pages' ? 10 : 4}
    MyPageId={Number(location.state?.userId || new URLSearchParams(location.search).get('owner') || 7)}
    vertical={true}/>`);

async function main() {
  const bundled = await build({
    stdin: { contents: fixture, loader: 'tsx', resolveDir: root },
    bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic', logLevel: 'silent',
    loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.webp': 'dataurl', '.css': 'empty' },
    define: { 'import.meta.env': JSON.stringify({ VITE_CLIK_URL: 'http://clikb.test', PROD: false }) },
    plugins: [{
      name: 'deck-profile-fixture',
      setup(builder) {
        builder.onResolve({ filter: /^(axios|.*(?:FeedLayoutHorizontal|FeedLayout|GlobalBrainstormGuide|KeywordSelector|TogglePromptButton|Footer|ProfileInfo|FullScreenStories|StoryAutoScroller|DetectDevice))$/ }, args => ({ path: args.path, namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
          contents: args.path === 'axios'
            ? `export default {post:(url,body)=>window.auditApi(url,body?.values),get:url=>window.auditApi(url),put:(url,body)=>window.auditApi(url,body?.values)};`
            : /FeedLayout/.test(args.path) ? shared.layout
              : /GlobalBrainstormGuide/.test(args.path) ? shared.guide
                : /DetectDevice/.test(args.path) ? 'export const matchMobile=innerWidth<600,matchPc=!matchMobile,matchTablet=false;'
                  : 'export default function Stub(){return null;}',
          loader: 'jsx', resolveDir: root,
        }));
        builder.onResolve({ filter: /^\/(?:src|server)\// }, args => ({ path: path.join(root, args.path.slice(1)) }));
      },
    }],
  });
  const css = fs.readFileSync(path.join(root, 'src/DeckOverlay.css'), 'utf8');
  const html = '<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:Arial}</style><style>'
    + css + '</style><div id="root"></div><script>' + bundled.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>';
  const browser = await chromium.launch({ headless: true,
    executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const [width, theme] of [[1440, 'light'], [390, 'dark']]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.setDefaultTimeout(10000);
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => route.request().isNavigationRequest()
        ? route.fulfill({ status: 200, contentType: 'text/html', body: html }) : route.abort());
      const area = () => page.evaluate(() => window.fixture.snapshot().feeds?.areas['clikb.feeds.deck']);
      const ready = () => page.waitForFunction(() => ['ready', 'empty'].includes(window.fixture?.snapshot().feeds?.areas['clikb.feeds.deck']?.state.status));
      const header = page.locator('.deck-category').first();
      const visit = member => page.evaluate(member => window.fixture.visit(member), member);
      const history = () => page.evaluate(() => ({ url: location.href, state: window.history.state.usr, idx: window.history.state.idx }));

      await page.goto(`http://clikb.test/pages?owner=235&theme=${theme}`);
      await ready();
      await page.waitForFunction(() => document.querySelector('.deck-category small')?.textContent === '@profile235');
      assert.match(await header.locator('.deck-category-text').innerText(), /^Page\s+@profile235/);
      assert.ok((await header.locator('img').getAttribute('src')).endsWith('#thumb-235'));
      const sizes = await header.evaluate(element => ({
        title: parseFloat(getComputedStyle(element.querySelector('.deck-category-text > span')).fontSize),
        name: parseFloat(getComputedStyle(element.querySelector('small')).fontSize),
      }));
      assert.ok(sizes.name < sizes.title);
      assert.equal((await area()).state.profileOwnerId, 235);
      await page.screenshot({ path: path.join(output, `deck-profile-${width}-${theme}.png`) });

      await page.goto(`http://clikb.test/pages?owner=7&theme=${theme}`);
      await ready();
      assert.match(await header.locator('.deck-category-text').innerText(), /^My Page\s+@owner/);
      assert.equal((await area()).state.pageIsOwn, true);

      await page.goto(`http://clikb.test/pages?owner=235&theme=${theme}&slowProfile=1`);
      await ready();
      await page.waitForFunction(() => window.fixture.profileReplies.length > 0);
      await visit(236);
      await page.waitForFunction(() => document.querySelector('.deck-category small')?.textContent === '@profile236');
      await page.evaluate(() => window.fixture.releaseProfiles());
      await page.waitForTimeout(120);
      assert.match(await header.locator('.deck-category-text').innerText(), /^Page\s+@profile236/);
      assert.ok((await header.locator('img').getAttribute('src')).endsWith('#thumb-236'));
      assert.equal((await area()).state.profileOwnerId, 236);

      await page.goto(`http://clikb.test/pages?owner=999&theme=${theme}`);
      await ready();
      await page.waitForFunction(() => document.querySelector('.deck-category small')?.textContent === '@profile999');
      assert.match(await header.locator('.deck-category-text').innerText(), /^Page\s+@profile999/);
      assert.equal((await area()).state.totalCardsInBatch, 0);
      assert.ok((await header.locator('img').getAttribute('src')).endsWith('#thumb-999'));

      for (const clean of [false, true]) {
        await page.goto(`http://clikb.test/feeds?theme=${theme}`);
        await ready();
        await page.locator('[data-ai-action="clikb.feeds.deck.action.cycle_next"]').click();
        await page.waitForFunction(() => window.fixture.snapshot().feeds.areas['clikb.feeds.deck'].state.activePostId === 102);
        await page.evaluate(value => window.fixture.setClean(value), clean);
        const creator = page.locator('.deck-card--active [data-ai-action="clikb.feeds.deck.action.creator_profile"]');
        await creator.waitFor({ state: 'visible' });
        assert.equal(await creator.innerText(), '@card235');
        assert.equal(await creator.evaluate(element => element.classList.contains('deck-creator--clean')), clean);
        const original = await history();
        await creator.click();
        await page.waitForFunction(() => location.pathname === '/pages' && window.history.state.usr?.userId === 235);
        await ready();
        assert.equal((await area()).state.activeCategory, 'page');
        assert.equal((await area()).state.activePostId, 102);
        assert.equal(await page.locator('[data-fullscreen]').count(), 0);
        await page.goBack();
        await page.locator('[data-deck-overlay]').waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => window.history.state.usr.userId), 235);
        await page.goBack();
        await ready();
        assert.deepEqual(await history(), original);
        assert.equal((await area()).state.activePostId, 102);
        await page.goForward();
        await page.locator('[data-deck-overlay]').waitFor({ state: 'hidden' });
        await page.goForward();
        await ready();
        assert.equal((await area()).state.profileOwnerId, 235);
      }
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px ${theme} Deck profile header, stale/empty/own identity, and Normal/Clean creator history`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
