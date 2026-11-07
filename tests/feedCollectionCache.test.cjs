const test = require('node:test');
const assert = require('node:assert/strict');
const { loadTypeScript } = require('./promptTestBindings.cjs');
const { rememberFeedCollection, cachedFeedCollection, requestFeedCollection } = loadTypeScript('src/feedCollectionCache.ts');

test('overlapping remount requests share one response, isolate scopes and retry failures', async () => {
  let calls = 0, finish;
  const request = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
  const first = requestFeedCollection('overlap', request);
  assert.equal(requestFeedCollection('overlap', request), first);
  assert.equal(calls, 1);
  finish({ payload: [1] });
  assert.deepEqual(await first, { payload: [1] });
  await requestFeedCollection('overlap', async () => { calls++; return []; });
  assert.equal(calls, 2, 'a settled request does not intercept a later refresh');
  const failed = requestFeedCollection('failed', async () => { throw Error('offline'); });
  await assert.rejects(failed, /offline/);
  assert.deepEqual(await requestFeedCollection('failed', async () => [2]), [2]);
  assert.deepEqual(await requestFeedCollection('different-viewer', async () => [3]), [3]);
});

test('feed re-entry keeps posts and pagination, with separate viewer, query and layout scopes', () => {
  const collection = { feeds: [{ id: 25, item1: 'image.webp', videoUrl: '' }], hasMore: false, fetchCount: 2 };
  rememberFeedCollection('games:viewer:3:layout:true', collection);
  assert.equal(cachedFeedCollection('games:viewer:3:layout:true'), collection);
  for (const scope of ['games:viewer:4:layout:true', 'games:viewer:3:layout:false', 'search:cars:viewer:3']) {
    assert.equal(cachedFeedCollection(scope), undefined);
  }
  const updated = { feeds: [{ id: 26 }], hasMore: true, fetchCount: 1 };
  rememberFeedCollection('games:viewer:3:layout:true', updated);
  assert.equal(cachedFeedCollection('games:viewer:3:layout:true'), updated);
});

test('route memory is bounded, retains recently revisited feeds, and expires without extending freshness on reads', () => {
  const collection = { feeds: [], hasMore: false, fetchCount: 1 };
  for (let i = 0; i < 16; i++) rememberFeedCollection('bounded:' + i, collection);
  cachedFeedCollection('bounded:0');
  rememberFeedCollection('overflow', collection);
  assert.equal(cachedFeedCollection('bounded:1'), undefined);
  assert.equal(cachedFeedCollection('bounded:0'), collection);
  const originalNow = Date.now;
  let time = 1000;
  Date.now = () => time;
  try {
    rememberFeedCollection('expiry', collection);
    time += 4 * 60_000;
    assert.equal(cachedFeedCollection('expiry'), collection);
    rememberFeedCollection('expiry', { ...collection });
    time += 60_001;
    assert.equal(cachedFeedCollection('expiry'), undefined);
    assert.equal(cachedFeedCollection('expiry', { allowStale: true }).feeds, collection.feeds,
      'expired cards remain available while a refresh is pending');
    assert.equal(cachedFeedCollection('expiry'), undefined, 'displaying old cards does not extend freshness');
  } finally { Date.now = originalNow; }
});
