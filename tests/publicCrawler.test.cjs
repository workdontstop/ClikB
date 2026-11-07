const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const serverRequire = Module.createRequire(path.resolve('server/package.json'));
const express = serverRequire('express');
const filename = path.resolve('server/src/PublicCrawler.ts');
const mod = new Module(filename, module);
mod.paths = Module._nodeModulePaths(path.dirname(filename));
mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { createPublicCrawlerRouter, renderPublicFeed, isContentCrawler } = mod.exports;
const browser = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36';
const bot = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
async function fixture(run, read = async () => [{ id: 45, caption: 'Racing cars', username: 'Creator' }], ids = async () => [{ id: 45 }]) {
  const app = express();
  app.use(createPublicCrawlerRouter(read, ids));
  app.use(express.static(path.resolve('public')));
  app.get('*', (_req, res) => res.sendFile(path.resolve('index.html'), { cacheControl: false }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const fetchAs = (url, ua = bot, options = {}) => fetch(`http://127.0.0.1:${server.address().port}${url}`, { ...options, headers: { 'User-Agent': ua, ...options.headers } });
  try { await run(fetchAs); } finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
}
test('ordinary browsers, empty UA and unknown crawlers never select crawler HTML', async () => {
  for (const ua of [browser, '', 'HeadlessChrome/130', 'UnknownBot/1.0', 'MyGooglebot/1.0']) assert.equal(isContentCrawler(ua), false);
  for (const ua of [bot, 'bingbot/2.0', 'OAI-SearchBot/1.3', 'ChatGPT-User/1.0', 'Claude-SearchBot/1.0', 'PerplexityBot/1.0', 'Twitterbot/1.0', 'WhatsApp/2.0', 'TelegramBot/1.0', 'LinkedInBot/1.0', 'Slackbot-LinkExpanding/1.0']) assert.equal(isContentCrawler(ua), true);
  let reads = 0;
  await fixture(async get => {
    for (const ua of [browser, '', 'UnknownBot/1.0']) for (const url of ['/', '/feeds', '/FEEDS', '/feeds/', '/experience/45', '/feeds?post=45', '/feeds?bot=true']) {
      const r = await get(url, ua, { headers: { Cookie: 'crawler=true' } });
      const html = await r.text();
      assert.equal(r.status, 200); assert.match(html, /<div id="root"><\/div>/);
      assert.doesNotMatch(html, /<article>/); assert.match(r.headers.get('cache-control'), /no-store/);
      assert.match(r.headers.get('vary'), /User-Agent/);
    }
    assert.equal(reads, 0);
  }, async () => { reads++; return []; });
});
test('bot then browser then bot responses stay separate, fresh, and uncached', async () => {
  let caption = 'First publication';
  await fixture(async get => {
    let r = await get('/feeds'); assert.match(await r.text(), /First publication/);
    assert.match(r.headers.get('cache-control'), /no-store/); assert.equal(r.headers.get('cdn-cache-control'), 'no-store');
    assert.match(await (await get('/feeds', browser)).text(), /id="root"/);
    caption = 'Edited publication';
    assert.match(await (await get('/feeds')).text(), /Edited publication/);
    assert.equal((await get('/feeds', bot, { method: 'HEAD' })).status, 200);
  }, async () => [{ id: 45, caption }]);
});
test('post and pagination URLs resolve with validated IDs, missing posts 404, failures 503', async () => {
  const calls = [];
  await fixture(async get => {
    let r = await get('/feeds?post=45'); assert.equal(r.status, 200);
    const postHtml = await r.text();
    assert.match(postHtml, /canonical" href="https:\/\/clikb.com\/experience\/45/);
    assert.match(postHtml, /twitter:card" content="summary_large_image/);
    assert.match(postHtml, /property="og:image"/);
    r = await get('/experience/45'); assert.equal(r.status, 200);
    assert.match(await r.text(), /Racing cars|Public post/);
    await get('/feeds?before=45'); assert.equal(calls.at(-1).before, 45);
    for (const url of ['/feeds?post=0', '/feeds?before=1%20OR%201', '/feeds?post=1&post=2']) assert.equal((await get(url)).status, 400);
    assert.equal((await get('/feeds?post=99')).status, 404);
    r = await get('/api/public-post/45', browser); assert.equal((await r.json()).payload[0].id, 45);
    assert.equal((await get('/api/public-post/abc', browser)).status, 400);
  }, async options => { calls.push(options); return options.post === 99 ? [] : [{ id: 45, caption: 'Public post' }]; });
  await fixture(async get => {
    const r = await get('/feeds'); assert.equal(r.status, 503); assert.equal(r.headers.get('retry-after'), '60');
    assert.doesNotMatch(await r.text(), /id="root"/);
    assert.equal((await get('/feeds', browser)).status, 200);
  }, async () => { throw Error('DB down'); });
});
test('HTML escapes posts, rejects unsafe media URLs and omits internal generation data', () => {
  const html = renderPublicFeed([{ id: 1, caption: '</script><script>alert(1)</script>', username: '<img onerror=x>', item1: 'javascript:alert(1)', thumb1: 'https://cdn.example/img.jpg', videoUrl: 'https://cdn.example/video.mp4', prompt: 'SECRET_PROMPT', intentBlueprintJson: 'SECRET_PLAN' }], 'https://clikb.com/', false, false);
  assert.doesNotMatch(html, /<script>alert|<img[^>]*onerror=|javascript:|SECRET_/);
  assert.match(html, /Three.js/); assert.match(html, /storyboard/i); assert.match(html, /<video controls/);
  const schema = JSON.parse(html.match(/application\/ld\+json">(.*?)<\/script>/)[1]);
  assert.equal(schema['@graph'].at(-1).name, '</script><script>alert(1)</script>');
});
test('pagination discovers older content and sitemap uses database IDs', async () => {
  await fixture(async get => {
    const html = await (await get('/feeds')).text();
    assert.match(html, /rel="next" href="\/feeds\?before=73"/);
    const index = await (await get('/sitemap.xml', browser)).text(); assert.match(index, /sitemap-pages.xml/); assert.match(index, /sitemap-posts.xml/);
    const sitemap = await (await get('/sitemap-posts.xml')).text();
    assert.match(sitemap, /experience\/2000/); assert.match(sitemap, /feeds\?before=1001/);
    assert.equal((await get('/sitemap-posts.xml?before=bad')).status, 400);
  }, async () => Array.from({ length: 28 }, (_, i) => ({ id: 100 - i, caption: 'Post' })), async () => Array.from({ length: 1001 }, (_, i) => ({ id: 2000 - i })));
});

test('database reader preserves the real guest query and binds post/cursor values', async () => {
  const source = fs.readFileSync('server/src/PostDatabase.ts', 'utf8');
  const ast = ts.createSourceFile('PostDatabase.ts', source, ts.ScriptTarget.ES2022, true);
  const names = new Set(['postsxFeeds', 'readGuestPublicPosts', 'readGuestPostIds']);
  const selected = ast.statements.filter(s => ts.isVariableStatement(s) && s.declarationList.declarations.some(d => names.has(d.name.getText(ast)))).map(s => s.getText(ast)).join('\n');
  const code = ts.transpileModule(selected, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const calls = [], exports = {};
  new Function('exports', 'execQuery', code)(exports, async (sql, params) => { calls.push({ sql, params }); return []; });
  await exports.readGuestPublicPosts({});
  assert.deepEqual(calls.at(-1).params, [1, 1]);
  assert.match(calls.at(-1).sql, /INNER JOIN members ON posts.sender = members.id/);
  await exports.readGuestPublicPosts({ post: 45 });
  assert.match(calls.at(-1).sql, /WHERE posts.id = \?\s+ORDER BY posts.id DESC/);
  assert.deepEqual(calls.at(-1).params, [1, 1, 45]);
  await exports.readGuestPublicPosts({ before: 73 });
  assert.match(calls.at(-1).sql, /WHERE posts.id < \?\s+ORDER BY posts.id DESC/);
  assert.deepEqual(calls.at(-1).params, [1, 1, 73]);
  await exports.readGuestPostIds(73);
  assert.deepEqual(calls.at(-1).params, [73]); assert.match(calls.at(-1).sql, /LIMIT 1001/);
});

test('production static index keeps no-store and contains no crawler articles', async () => {
  const app = express();
  app.use(createPublicCrawlerRouter(async () => [{ id: 1, caption: 'Crawler-only rendering' }], async () => []));
  app.use(express.static(path.resolve('dist'), {
    setHeaders(res, file) {
      if (path.basename(file) === 'index.html' && res.getHeader('Vary')?.toString().includes('User-Agent')) res.setHeader('Cache-Control', 'private, no-store');
    },
  }));
  app.get('*', (_req, res) => res.sendFile(path.resolve('dist/index.html'), { cacheControl: false }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const url of ['/', '/feeds', '/FEEDS', '/feeds?post=1', '/experience/1']) {
      const crawler = await fetch(base + url, { headers: { 'User-Agent': bot } });
      assert.match(await crawler.text(), /Crawler-only rendering/);
      const human = await fetch(base + url, { headers: { 'User-Agent': browser } });
      const html = await human.text();
      assert.match(html, /id="root"/); assert.doesNotMatch(html, /<article>|Crawler-only rendering/);
      assert.equal(human.headers.get('cache-control'), 'private, no-store');
      assert.equal(human.headers.get('cdn-cache-control'), 'no-store');
    }
  } finally { server.closeAllConnections(); await new Promise(r => server.close(r)); }
});
