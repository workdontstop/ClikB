const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require('../.tmp/concierge-browser-deps/node_modules/playwright');
const shared = require('./deckSearch.browser.cjs');
const root = path.resolve(__dirname, '..');

// Actual feed loading, scoped collection memory, Search's three rows and router.
// Hold API responses independently of the already available image URLs.
let fixture = shared.fixture
  .replace('BrowserRouter,useLocation}', 'BrowserRouter,useLocation,useNavigate}')
  .replace('const location=useLocation(),[callFeeds', 'const location=useLocation(),navigate=useNavigate(),[callFeeds')
  .replace('window.fixture.compose=setminimisePrompt;', 'window.fixture.compose=setminimisePrompt;window.fixture.nav=navigate;window.fixture.reload=()=>setcallFeeds(true);window.fixture.state=()=>({callFeeds,feeds,pathname:location.pathname});')
  .replace('window.fixture={requests:[]', 'window.fixture={pending:[],requests:[]')
  .replace("await new Promise(resolve=>setTimeout(resolve,query==='slow'?250:15));", 'await new Promise(resolve=>window.fixture.hold?window.fixture.pending.push(resolve):setTimeout(resolve,15));')
  .replace('<Feedgate {...props} type={4} vertical={true}/>', '<Feedgate key={location.pathname} {...props} type={location.pathname===\'/pages\'?10:location.pathname===\'/images\'?1:location.pathname===\'/clikit\'?3:location.pathname===\'/kickit\'?2:4} vertical={true}/>');

async function main() {
  const bundle = await build({
    stdin: { contents: fixture, loader: 'tsx', resolveDir: root }, bundle: true, write: false,
    format: 'iife', platform: 'browser', jsx: 'automatic', logLevel: 'silent',
    loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.webp': 'dataurl', '.css': 'empty' },
    define: { 'import.meta.env': JSON.stringify({ VITE_CLIK_URL: 'http://clikb.test', PROD: false }) },
    plugins: [{ name: 'offline-feeds', setup(b) {
      b.onResolve({ filter: /^(axios|.*(?:FeedLayoutHorizontal|FeedLayout|GlobalBrainstormGuide|KeywordSelector|TogglePromptButton|Footer|ProfileInfo|FullScreenStories|StoryAutoScroller|DetectDevice))$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
        contents: args.path === 'axios' ? 'export default {post:(url,body)=>window.auditApi(url,body?.values),get:url=>window.auditApi(url)};'
          : /FeedLayout/.test(args.path) ? shared.layout : /GlobalBrainstormGuide/.test(args.path) ? shared.guide
          : /DetectDevice/.test(args.path) ? 'export const matchMobile=innerWidth<600,matchPc=!matchMobile,matchTablet=false;'
          : 'export default function Stub(){return null;}', loader: 'jsx', resolveDir: root,
      }));
      b.onResolve({ filter: /^\/(?:src|server)\// }, args => ({ path: path.join(root, args.path.slice(1)) }));
    } }],
  });
  const html = '<div id="root"></div><script>' + bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>';
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  async function open(route) {
    const page = await browser.newPage(); page.setDefaultTimeout(8000);
    await page.addInitScript(() => {
      const now = Date.now; window.age = 0; Date.now = () => now() + window.age;
      // Existing Grid entry after creation was dismissed: no Deck session cache.
      history.replaceState({ usr: { deckCreate: true }, idx: 0, key: 'default' }, '');
    });
    await page.route('**/*', r => r.request().isNavigationRequest()
      ? r.fulfill({ status: 200, contentType: 'text/html', body: html }) : r.abort());
    await page.goto('http://clikb.test' + route);
    await page.waitForFunction(() => window.fixture?.state().feeds.length === 28 && !window.fixture.state().callFeeds);
    return page;
  }
  const release = page => page.evaluate(() => { window.fixture.hold = false; window.fixture.pending.splice(0).forEach(resolve => resolve()); });
  try {
    for (const route of ['/feeds', '/images', '/kickit', '/clikit', '/pages']) {
      const page = await open(route);
      const calls = await page.evaluate(() => window.fixture.requests.length);
      await page.evaluate(() => window.fixture.reload()); await page.waitForTimeout(50);
      assert.equal(await page.evaluate(() => window.fixture.requests.length), calls, 'fresh re-entry reuses the collection');
      await page.evaluate(() => { window.age += 301000; window.fixture.hold = true; window.fixture.reload(); });
      await page.waitForFunction(() => window.fixture.pending.length === 1);
      assert.equal(await page.locator('[data-grid-post]').count(), 28, route + ': a refresh must retain the current posts');
      await page.evaluate(() => window.fixture.reload()); await page.waitForTimeout(50);
      assert.equal(await page.evaluate(() => window.fixture.requests.length), calls + 1, 'one request owns the pending refresh');
      await release(page); await page.waitForFunction(() => !window.fixture.state().callFeeds);
      assert.equal(await page.locator('[data-grid-post]').count(), 28);
      console.log('PASS ' + route + ': repeated callFeeds, expired data and delayed response retain Grid');
      await page.close();
    }

    const revisit = await open('/images');
    await revisit.evaluate(() => window.fixture.nav('/clikit', { state: { deckCreate: true } }));
    await revisit.waitForFunction(() => window.fixture.state().feeds[0]?.mode === 2 && !window.fixture.state().callFeeds);
    await revisit.evaluate(() => { window.age += 301000; window.fixture.hold = true; window.fixture.nav('/images', { state: { deckCreate: true } }); });
    await revisit.waitForFunction(() => window.fixture.pending.length === 1);
    assert.equal(await revisit.locator('[data-grid-post]').count(), 28, 'expired route re-entry restores existing cards before the response');
    assert.equal(await revisit.evaluate(() => window.fixture.state().feeds[0]?.mode), 0, 'Shorts must not show the previous Games collection');
    await release(revisit);await revisit.waitForFunction(() => !window.fixture.state().callFeeds);
    console.log('PASS expired route re-entry displays its own collection during refresh');
    await revisit.close();

    const page = await open('/images');
    await page.evaluate(() => { window.age += 301000; window.fixture.hold = true; window.fixture.reload(); });
    await page.waitForFunction(() => window.fixture.pending.length === 1);
    await page.evaluate(() => { window.fixture.hold = false; window.fixture.nav('/clikit', { state: { deckCreate: true } }); });
    await page.waitForFunction(() => window.fixture.state().pathname === '/clikit' && window.fixture.state().feeds[0]?.mode === 2);
    await release(page); await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => window.fixture.state().feeds[0].mode), 2, 'late Shorts response cannot replace Games');
    console.log('PASS late response after route change cannot overwrite the next feed');
    await page.close();

    const failure = await open('/images');
    await failure.evaluate(() => {
      window.age+=301000;window.fixture.failed=0;
      window.auditApi=async()=>{window.fixture.failed++;return {data:{message:'Collection unavailable'}};};
      window.fixture.reload();
    });
    await failure.waitForFunction(()=>window.fixture.failed===1&&!window.fixture.state().callFeeds);
    assert.equal(await failure.locator('[data-grid-post]').count(),28,'an invalid/error response must not erase usable posts');
    await failure.evaluate(()=>{window.auditApi=async()=>({data:{payload:[],hasMore:false}});window.fixture.reload();});
    await failure.waitForFunction(()=>window.fixture.state().feeds.length===0&&!window.fixture.state().callFeeds);
    assert.equal(await failure.locator('[data-grid-post]').count(),0,'a valid empty collection must replace the old posts');
    console.log('PASS failed refresh retains posts and a valid empty response replaces them');
    await failure.close();

    const search = await browser.newPage();search.setDefaultTimeout(8000);
    await search.addInitScript(() => { const now=Date.now;window.age=0;Date.now=()=>now()+window.age;history.replaceState({usr:{deckCreate:true},idx:0,key:'default'},''); });
    await search.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
    await search.goto('http://clikb.test/search?q=cars&section=shorts');
    await search.waitForFunction(()=>window.fixture.requests.length===3&&!window.fixture.state().callFeeds&&document.querySelectorAll('[data-grid-post]').length===84);
    await search.evaluate(()=>{window.age+=301000;window.fixture.hold=true;window.fixture.reload();});
    await search.waitForFunction(()=>window.fixture.pending.length===3);
    assert.equal(await search.locator('[data-grid-post]').count(),84,'three Search rows retain their own posts while sharing callFeeds');
    await release(search);await search.waitForFunction(()=>!window.fixture.state().callFeeds);
    console.log('PASS Search shares callFeeds without clearing its three existing rows');
    await search.close();
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
