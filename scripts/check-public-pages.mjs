import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(new URL('../server/package.json', import.meta.url));
const express = require('express');
const app = express();
app.use(express.static(resolve('public')));
app.get('*', (_req, res) => res.sendFile(resolve('index.html')));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
try {
  const base = `http://127.0.0.1:${server.address().port}`;
  const sitemap = readFileSync('public/sitemap.xml', 'utf8');
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => new URL(match[1]));
  assert.equal(urls.length, 7);
  const titles = new Set();
  for (const url of urls) {
    assert.equal(url.origin, 'https://clikb.com');
    const response = await fetch(`${base}${url.pathname}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    const html = await response.text();
    assert.ok(html.includes(`rel="canonical" href="${url.href}"`));
    if (url.pathname === '/') {
      assert.match(html, /<div id="root"><\/div>/);
      assert.doesNotMatch(html, /<h1>/, 'Human app shell must not contain a crawler landing page');
    } else assert.match(html, /<h1>/);
    assert.match(html, /name="description"/);
    titles.add(html.match(/<title>(.*?)<\/title>/)[1]);
    const structured = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1];
    assert.equal(JSON.parse(structured)['@graph'][0].name, 'ClikB');
    if (url.pathname !== '/') {
      assert.ok(!html.includes('/src/main.tsx'), 'Guide must not mount the studio');
      const redirect = await fetch(`${base}${url.pathname.slice(0, -1)}`, { redirect: 'manual' });
      assert.equal(redirect.status, 301);
    }
  }
  assert.equal(titles.size, urls.length, 'Public pages need distinct titles');
  for (const path of ['/images', '/kickit', '/clikit']) {
    assert.match(await (await fetch(`${base}${path}`)).text(), /id="root"/);
  }
  for (const file of ['robots.txt', 'llms.txt']) assert.ok(existsSync(`public/${file}`));
  console.log('PASS: 7 public URLs, unique metadata, JSON-LD, clean-path redirects and existing studio fallbacks.');
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
