import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPostSearchQuery, postSearchPage, type PostSearchCursor } from './postSearchQuery';

test('all search modes use the existing full-text index with complete game playback columns', () => {
  for (const mode of [0, 1, 2]) {
    const { sql, params } = buildPostSearchQuery({ id: 7, typex: mode, searchData: 'cars' });
    assert.deepEqual(params, [7, 7, mode, 'cars', 'cars']);
    for (const column of ['main, inttype', 'interaction_audio_main AS interactionAudioMain', 'touch_config_json AS touchConfigJson', 'interaction_format AS interactionFormat', 'spatial_experience_json AS spatialExperienceJson']) assert.ok(sql.includes(column));
    assert.match(sql, /MATCH\(caption, tags, categories\)/);
    assert.match(sql, /LIMIT 29/);
  }
});

test('ranked pages cover high-ID low-relevance matches and score ties without repeats', () => {
  const rows = Array.from({ length: 70 }, (_, i) => ({ id: i + 1, score: i === 0 ? 1000 : i === 69 ? 0.1 : Math.floor(i / 3) }));
  const rank = [...rows].sort((a, b) => b.score - a.score || b.id - a.id);
  const returned: number[] = [];
  let cursor: PostSearchCursor | null = null;
  for (let page = 0; page < 5; page++) {
    const request = buildPostSearchQuery({ id: 7, typex: 2, searchData: 'cars', cursor }, Boolean(cursor));
    const eligible = cursor ? rank.filter(row => row.score < cursor!.score || (row.score === cursor!.score && row.id < cursor!.id)) : rank;
    if (cursor) { assert.match(request.sql, /ps.score < \? OR \(ps.score = \? AND core.id < \?\)/); assert.doesNotMatch(request.sql, /posts.id </); }
    const result = postSearchPage(eligible.slice(0, 29), request.query, request.mode);
    returned.push(...result.payload.map(row => row.id));
    if (!result.hasMore) break;
    cursor = result.nextCursor;
  }
  assert.deepEqual(returned, rank.map(row => row.id));
  assert.equal(new Set(returned).size, rows.length);
  assert.ok(returned.includes(70));
});

test('queries and cursors are bounded, mode/query scoped and parameterized', () => {
  const cursor = { query: 'cars', mode: 2, id: 5, score: 1.25 };
  const result = buildPostSearchQuery({ typex: 2, searchData: 'cars', cursor }, true);
  assert.deepEqual(result.params.slice(-3), [1.25, 1.25, 5]);
  for (const patch of [{ typex: 3 }, { searchData: '' }, { searchData: 'x'.repeat(501) }, { cursor: { ...cursor, mode: 0 } }, { cursor: { ...cursor, query: 'clowns' } }, { cursor: { ...cursor, score: -1 } }]) assert.throws(() => buildPostSearchQuery({ typex: 2, searchData: 'cars', cursor, ...patch }, true));
  const injection = buildPostSearchQuery({ typex: 2, searchData: "cars' OR 1=1" });
  assert.ok(!injection.sql.includes("cars'"));
  assert.equal(postSearchPage([], 'cars', 2).nextCursor, null);
  assert.equal(postSearchPage([{ id: 5, score: 2 }], 'cars', 2).hasMore, false);
});

test('legacy search history requests remain supported for existing clients', () => {
  assert.match(buildPostSearchQuery({ typex: 1, searchData: 'cars', lastId: 99 }, true).sql, /posts.id < \?/);
  assert.match(buildPostSearchQuery({ typex: 1, searchData: 'cars', lastId: 99, override: true }, true).sql, /posts.id <= \?/);
});
