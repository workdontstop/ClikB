import { PUBLIC_POST_SQL } from './postPublication';
export const SEARCH_PAGE_SIZE = 28;
export type PostSearchCursor = { query: string; mode: number; score: number; id: number };

/** Rank and pagination share the same (score, id) order for every content mode. */
export function buildPostSearchQuery(values: any, more = false): { sql: string; params: unknown[]; query: string; mode: number } {
  const query = typeof values?.searchData === 'string' ? values.searchData.trim() : '';
  const mode = Number(values?.typex);
  if (!query || query.length > 500 || ![0, 1, 2].includes(mode)) throw new Error('A search term (maximum 500 characters) and valid content mode are required.');
  const cursor = more ? values?.cursor as PostSearchCursor | undefined : undefined;
  if (cursor && (cursor.query !== query || Number(cursor.mode) !== mode || !Number.isFinite(cursor.score)
      || cursor.score < 0 || !Number.isSafeInteger(cursor.id) || cursor.id <= 0)) throw new Error('The search cursor does not match this query and mode.');
  const beforeId = more && !cursor ? Number(values?.lastId) : 0;
  if (more && !cursor && (!Number.isSafeInteger(beforeId) || beforeId <= 0)) throw new Error('A valid search cursor is required.');
  const viewer = Number(values?.id) || 0;
  const params: unknown[] = [viewer, viewer, mode];
  // Retain old clients' history/ID requests; updated Deck clients send a ranked cursor.
  const legacyBoundary = beforeId ? ` AND posts.id ${values?.override ? '<=' : '<'} ?` : '';
  if (beforeId) params.push(beforeId);
  params.push(query, query);
  const rankBoundary = cursor ? 'WHERE (ps.score < ? OR (ps.score = ? AND core.id < ?))' : '';
  if (cursor) params.push(cursor.score, cursor.score, cursor.id);
  const sql = `
SELECT core.*, ps.score
FROM (
  SELECT
    (SELECT COUNT(*) FROM fan WHERE favid = posts.sender AND userid = ?) AS favCount,
    (SELECT type FROM emotions WHERE post = posts.id AND user = ?) AS EmoIn,
    (SELECT COUNT(*) FROM comments WHERE post = posts.id) AS commentCount,
    (SELECT com FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPost,
    (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPostUser,
    m.profile_image AS commentorProfileImage, m.username AS commentorUsername, m.color1 AS commentorColor,
    (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 1) AS lovely,
    (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 2) AS cool,
    (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 3) AS care,
    (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 4) AS funny,
    (SELECT file FROM audio WHERE post = posts.id) AS audioData,
    (SELECT name FROM audio WHERE post = posts.id) AS audioDataName,
    (SELECT backgroudaudio FROM audio WHERE post = posts.id) AS backgroudaudio,
    interacttype1, interacttype2, rad1, rad2,
    members.profile_image, members.username, members.color1,
    posts.id, sender, post_count, topic, caption,
    item1, thumb1, itemtype1, interact1a, interact1ax, interact1ay,
    interact1b, interact1bx, interact1by, item2, vid1backup, vid2backup,
    time, videoUrl, mode,
    x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8, x9, xt9,
    captionSummary, captionAudio, xa1, xa2, xa3, xa4, xa5, xa6, xa7, xa8, xa9,
    xh1, xh2, xh3, xh4, xh5, xh6, xh7, xh8, xh9,
    gent1, gent2, gent3, gent4, gent5, gent6, gent7, gent8, gent9,
    xv1, xv2, xv3, xv4, xv5, xv6, xv7, xv8, xv9,
    nobgmvideo, kontext, intent_blueprint_json AS intentBlueprintJson, prompt, model, ratio,
    main, inttype, subl, subr, touchl, touchlx, touchly, touchlr, touchr, touchrx, touchry, touchrr,
    mainaud, sub1aud, sub2aud, intbg,
    interaction_audio_main AS interactionAudioMain,
    interaction_audio_left AS interactionAudioLeft,
    interaction_audio_right AS interactionAudioRight,
    touch_config_json AS touchConfigJson,
    interaction_format AS interactionFormat,
    spatial_experience_json AS spatialExperienceJson
  FROM posts
  INNER JOIN members ON posts.sender = members.id
  LEFT JOIN members AS m ON m.id = (
    SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1
  )
  WHERE posts.mode = ? AND ${PUBLIC_POST_SQL}${legacyBoundary}
) AS core
JOIN (
  SELECT post_id, MATCH(caption, tags, categories) AGAINST (? IN BOOLEAN MODE) AS score
  FROM post_search
  WHERE MATCH(caption, tags, categories) AGAINST (? IN BOOLEAN MODE)
) AS ps ON ps.post_id = core.id
${rankBoundary}
ORDER BY ps.score DESC, core.id DESC
LIMIT ${SEARCH_PAGE_SIZE + 1};`;
  return { sql, params, query, mode };
}

export function postSearchPage(rows: any[], query: string, mode: number) {
  const payload = rows.slice(0, SEARCH_PAGE_SIZE);
  const last = payload.at(-1);
  return { payload, hasMore: rows.length > SEARCH_PAGE_SIZE,
    nextCursor: last ? { query, mode, id: Number(last.id), score: Number(last.score) } satisfies PostSearchCursor : null };
}
