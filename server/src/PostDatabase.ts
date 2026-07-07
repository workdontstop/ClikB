import execQuery from "./execQuery";
import dotenv from "dotenv";
dotenv.config(); // Load environment variables from .env file

import { Request, Response as ExpressResponse } from "express";
import { deleteRagInstructionFromS3, uploadRagInstructionToS3 } from "./S3Routes";
import { deleteRagInstructionVectors, indexRagInstruction } from "./RagVectorService";
//                     â””â”€â”€â”€â”€â”€ rename to avoid clashing with DOM `Response`

const createpostX = `INSERT INTO posts (sender,post_count,topic,caption,item1,thumb1,time,private,kontext,prompt,model,ratio)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;

const createPostSearch = `
REPLACE INTO post_search
  (post_id, caption, tags, categories)
VALUES
  (?,?,?,?)
`;


const createsong = `INSERT INTO music (sender,song,name)
   VALUES (?,?,?)`;

const callsong = `SELECT id, sender,name, song
                     FROM music
                     ORDER BY id DESC`;

const createpostXStory = `
INSERT INTO posts (
  sender, post_count, topic, caption, item1, thumb1,

  x1,x2,x3,x4,x5,x6,x7,x8,x9,
  x1B,x2B,x3B,x4B,x5B,x6B,x7B,x8B,x9B,

  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,xh9,
  xh1B,xh2B,xh3B,xh4B,xh5B,xh6B,xh7B,xh8B,xh9B,

  xt1,xt2,xt3,xt4,xt5,xt6,xt7,xt8,xt9,
  xt1B,xt2B,xt3B,xt4B,xt5B,xt6B,xt7B,xt8B,xt9B,

  time, private, mode,

  gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,gent9,
  gent1B,gent2B,gent3B,gent4B,gent5B,gent6B,gent7B,gent8B,gent9B,

  kontext, prompt, model, ratio
)
VALUES (
  ?,?,?,?,?,?,

  ?,?,?,?,?,?,?,?,?,
  ?,?,?,?,?,?,?,?,?,

  ?,?,?,?,?,?,?,?,?,
  ?,?,?,?,?,?,?,?,?,

  ?,?,?,?,?,?,?,?,?,
  ?,?,?,?,?,?,?,?,?,

  ?,?,?,

  ?,?,?,?,?,?,?,?,?,
  ?,?,?,?,?,?,?,?,?,

  ?,?,?,?
);
`.trim();

const profilePage = `
  SELECT
    username,
    id,
    email,
    password,
    color1,
    color2,
    color_type,
    profile_image,
    profile_image_thumb,
    first_name,
    sur_name,
    quote,
    reg,
    billboard1,
    billboardthumb1,
    billboard2,
    billboardthumb2,
    biography
  FROM members
  WHERE id = ?
`;

const postRank = `
SELECT core.*, ps.score
FROM (
  /* -----------------------------------------------------------------
     YOUR ORIGINAL FEED QUERY â€”â€” just remove ORDER BY ... LIMIT ...
     ----------------------------------------------------------------- */
  SELECT
    ( SELECT COUNT(*)   FROM fan      WHERE favid = posts.sender AND userid = ? ) AS favCount,
    ( SELECT type       FROM emotions WHERE post  = posts.id     AND user   = ? ) AS EmoIn,
    ( SELECT COUNT(*)   FROM comments WHERE post  = posts.id )                       AS commentCount,
    ( SELECT com        FROM comments WHERE post  = posts.id ORDER BY date DESC LIMIT 1 ) AS commentPost,
    ( SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1 ) AS commentPostUser,

    m.profile_image AS commentorProfileImage,
    m.username      AS commentorUsername,
    m.color1        AS commentorColor,

    ( SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 1 ) AS lovely,
    ( SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 2 ) AS cool,
    ( SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 3 ) AS care,
    ( SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 4 ) AS funny,

    ( SELECT file            FROM audio WHERE post = posts.id ) AS audioData,
    ( SELECT name            FROM audio WHERE post = posts.id ) AS audioDataName,
    ( SELECT backgroudaudio  FROM audio WHERE post = posts.id ) AS backgroudaudio,

    interacttype1, interacttype2, rad1, rad2,
    members.profile_image, members.username, members.color1,
    posts.id, sender, post_count, topic, caption,
    item1, thumb1, itemtype1, interact1a, interact1ax, interact1ay,
    interact1b, interact1bx, interact1by, item2, vid1backup, vid2backup,
    time, videoUrl, mode,
    x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,x9,xt9, captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,xa9,
  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,xh9,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,gent9,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8,xv9,nobgmvideo,kontext,prompt
  ,model,ratio

  FROM posts
  INNER JOIN members       ON posts.sender = members.id
  LEFT  JOIN members AS m  ON m.id = (
        SELECT commented_by
        FROM   comments
        WHERE  post = posts.id
        ORDER  BY date DESC
        LIMIT 1
  )
  WHERE posts.mode = ?                   -- keep your existing filter
) AS core

/* -----------------------------------------------------------------
   FULL-TEXT SEARCH: pull relevance score from post_search
   ----------------------------------------------------------------- */
JOIN (
  SELECT
    post_id,
    MATCH(caption, tags, categories)
      AGAINST (? IN BOOLEAN MODE) AS score      /* placeholder #3 */
  FROM post_search
  WHERE MATCH(caption, tags, categories)
        AGAINST (? IN BOOLEAN MODE)             /* placeholder #4 */
) AS ps  ON ps.post_id = core.id

ORDER BY ps.score DESC, core.id DESC            -- relevance first, then newest
LIMIT 28;
`;

const postRankMore = `
SELECT core.*, ps.score
FROM (
  /* -----------------------------------------------------------------
     YOUR ORIGINAL FEED QUERY â€”â€” just remove ORDER BY ... LIMIT ...
     ----------------------------------------------------------------- */
  SELECT
    ( SELECT COUNT(*)   FROM fan      WHERE favid = posts.sender AND userid = ? ) AS favCount,
    ( SELECT type       FROM emotions WHERE post  = posts.id     AND user   = ? ) AS EmoIn,
    ( SELECT COUNT(*)   FROM comments WHERE post  = posts.id )                       AS commentCount,
    ( SELECT com        FROM comments WHERE post  = posts.id ORDER BY date DESC LIMIT 1 ) AS commentPost,
    ( SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1 ) AS commentPostUser,

    m.profile_image AS commentorProfileImage,
    m.username      AS commentorUsername,
    m.color1        AS commentorColor,

    ( SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 1 ) AS lovely,
    ( SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 2 ) AS cool,
    ( SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 3 ) AS care,
    ( SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 4 ) AS funny,

    ( SELECT file            FROM audio WHERE post = posts.id ) AS audioData,
    ( SELECT name            FROM audio WHERE post = posts.id ) AS audioDataName,
    ( SELECT backgroudaudio  FROM audio WHERE post = posts.id ) AS backgroudaudio,

    interacttype1, interacttype2, rad1, rad2,
    members.profile_image, members.username, members.color1,
    posts.id, sender, post_count, topic, caption,
    item1, thumb1, itemtype1, interact1a, interact1ax, interact1ay,
    interact1b, interact1bx, interact1by, item2, vid1backup, vid2backup,
    time, videoUrl, mode,
    x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,x9,xt9, captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,xa9,
  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,xh9,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,gent9,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8,xv9,nobgmvideo,kontext,prompt
  ,model,ratio

  FROM posts
  INNER JOIN members       ON posts.sender = members.id
  LEFT  JOIN members AS m  ON m.id = (
        SELECT commented_by
        FROM   comments
        WHERE  post = posts.id
        ORDER  BY date DESC
        LIMIT 1
  )
  WHERE posts.mode = ?  and posts.id < ?                    -- keep your existing filter
) AS core

/* -----------------------------------------------------------------
   FULL-TEXT SEARCH: pull relevance score from post_search
   ----------------------------------------------------------------- */
JOIN (
  SELECT
    post_id,
    MATCH(caption, tags, categories)
      AGAINST (? IN BOOLEAN MODE) AS score      /* placeholder #3 */
  FROM post_search
  WHERE MATCH(caption, tags, categories)
        AGAINST (? IN BOOLEAN MODE)             /* placeholder #4 */
) AS ps  ON ps.post_id = core.id

ORDER BY ps.score DESC, core.id DESC            -- relevance first, then newest
LIMIT 28;
`;

// 4 placeholders, bind in this order:  [userId, userId, searchString, searchString]
const postRankHistory = `
SELECT core.*, ps.score
FROM (
  /* -----------------------------------------------------------------
     YOUR ORIGINAL FEED QUERY â€”â€” just remove ORDER BY ... LIMIT ...
     ----------------------------------------------------------------- */
  SELECT
    ( SELECT COUNT(*)   FROM fan      WHERE favid = posts.sender AND userid = ? ) AS favCount,
    ( SELECT type       FROM emotions WHERE post  = posts.id     AND user   = ? ) AS EmoIn,
    ( SELECT COUNT(*)   FROM comments WHERE post  = posts.id )                       AS commentCount,
    ( SELECT com        FROM comments WHERE post  = posts.id ORDER BY date DESC LIMIT 1 ) AS commentPost,
    ( SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1 ) AS commentPostUser,

    m.profile_image AS commentorProfileImage,
    m.username      AS commentorUsername,
    m.color1        AS commentorColor,

    ( SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 1 ) AS lovely,
    ( SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 2 ) AS cool,
    ( SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 3 ) AS care,
    ( SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 4 ) AS funny,

    ( SELECT file            FROM audio WHERE post = posts.id ) AS audioData,
    ( SELECT name            FROM audio WHERE post = posts.id ) AS audioDataName,
    ( SELECT backgroudaudio  FROM audio WHERE post = posts.id ) AS backgroudaudio,

    interacttype1, interacttype2, rad1, rad2,
    members.profile_image, members.username, members.color1,
    posts.id, sender, post_count, topic, caption,
    item1, thumb1, itemtype1, interact1a, interact1ax, interact1ay,
    interact1b, interact1bx, interact1by, item2, vid1backup, vid2backup,
    time, videoUrl, mode,
  x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,x9,xt9, captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,xa9,
  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,xh9,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,gent9,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8,xv9,nobgmvideo,kontext,prompt
  ,model,ratio

  FROM posts
  INNER JOIN members       ON posts.sender = members.id
  LEFT  JOIN members AS m  ON m.id = (
        SELECT commented_by
        FROM   comments
        WHERE  post = posts.id
        ORDER  BY date DESC
        LIMIT 1
  )
  WHERE posts.mode = ?  and posts.id <= ?                   -- keep your existing filter
) AS core

/* -----------------------------------------------------------------
   FULL-TEXT SEARCH: pull relevance score from post_search
   ----------------------------------------------------------------- */
JOIN (
  SELECT
    post_id,
    MATCH(caption, tags, categories)
      AGAINST (? IN BOOLEAN MODE) AS score      /* placeholder #3 */
  FROM post_search
  WHERE MATCH(caption, tags, categories)
        AGAINST (? IN BOOLEAN MODE)             /* placeholder #4 */
) AS ps  ON ps.post_id = core.id

ORDER BY ps.score DESC, core.id DESC            -- relevance first, then newest
LIMIT 28;
`;

const postsxClik = `
SELECT
  (SELECT COUNT(*) FROM fan WHERE favid = posts.sender AND userid = ?) AS favCount,
  (SELECT type FROM emotions WHERE post = posts.id AND user = ?) AS EmoIn,
  (SELECT COUNT(*) FROM comments WHERE post = posts.id) AS commentCount,

  (SELECT com FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPost,
  (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPostUser,

  m.profile_image AS commentorProfileImage,
  m.username AS commentorUsername,
  m.color1 AS commentorColor,

  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 1) AS lovely,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 2) AS cool,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 3) AS care,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 4) AS funny,

  (SELECT file FROM audio WHERE post = posts.id) AS audioData,
  (SELECT name FROM audio WHERE post = posts.id) AS audioDataName,
  (SELECT backgroudaudio FROM audio WHERE post = posts.id) AS backgroudaudio,

  interacttype1, interacttype2, rad1, rad2, members.profile_image, members.username, members.color1,
  posts.id, sender, post_count, topic, caption, item1, thumb1, itemtype1, interact1a,
  interact1ax, interact1ay, interact1b, interact1bx, interact1by, item2, vid1backup, vid2backup, time,videoUrl,
  mode, x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,x9,xt9, captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,xa9,
  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,xh9,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,gent9,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8,xv9,nobgmvideo,kontext,prompt
  ,model,ratio,main, inttype, subl, subr, touchl, touchlx, touchly, touchlr, touchr, touchrx, touchry, touchrr
  ,mainaud,sub1aud,sub2aud,

   interaction_audio_main  AS interactionAudioMain,
  interaction_audio_left  AS interactionAudioLeft,
  interaction_audio_right AS interactionAudioRight,
  touch_config_json       AS touchConfigJson,intbg

FROM posts
INNER JOIN members ON posts.sender = members.id
LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)
WHERE posts.mode = 2
ORDER BY posts.id DESC
LIMIT 28;
`;

const postsxMoreOClik = `
SELECT
  (SELECT COUNT(*) FROM fan WHERE favid = posts.sender AND userid = ?) AS favCount,
  (SELECT type FROM emotions WHERE post = posts.id AND user = ?) AS EmoIn,
  (SELECT COUNT(*) FROM comments WHERE post = posts.id) AS commentCount,

  (SELECT com FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPost,
  (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPostUser,

  m.profile_image AS commentorProfileImage,
  m.username AS commentorUsername,
  m.color1 AS commentorColor,

  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 1) AS lovely,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 2) AS cool,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 3) AS care,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 4) AS funny,

  (SELECT file FROM audio WHERE post = posts.id) AS audioData,
  (SELECT name FROM audio WHERE post = posts.id) AS audioDataName,
  (SELECT backgroudaudio FROM audio WHERE post = posts.id) AS backgroudaudio,

  interacttype1, interacttype2, rad1, rad2, members.profile_image, members.username, members.color1,
  posts.id, sender, post_count, topic, caption, item1, thumb1, itemtype1, interact1a,
  interact1ax, interact1ay, interact1b, interact1bx, interact1by, item2, vid1backup, vid2backup, time,videoUrl,
  mode,x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,x9,xt9, captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,xa9,
  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,xh9,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,gent9,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8,xv9,nobgmvideo,kontext,prompt
  ,model,ratio,main, inttype, subl, subr, touchl, touchlx, touchly, touchlr, touchr, touchrx, touchry, touchrr
  ,mainaud,sub1aud,sub2aud, interaction_audio_main  AS interactionAudioMain,
  interaction_audio_left  AS interactionAudioLeft,
  interaction_audio_right AS interactionAudioRight,
  touch_config_json       AS touchConfigJson,intbg

FROM posts
INNER JOIN members ON posts.sender = members.id
LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)
WHERE posts.mode = 2 and posts.id <= ?
ORDER BY posts.id DESC
LIMIT 28;
`;

const postsxMoreClik = `
SELECT
  (SELECT COUNT(*) FROM fan WHERE favid = posts.sender AND userid = ?) AS favCount,
  (SELECT type FROM emotions WHERE post = posts.id AND user = ?) AS EmoIn,
  (SELECT COUNT(*) FROM comments WHERE post = posts.id) AS commentCount,

  (SELECT com FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPost,
  (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPostUser,

  m.profile_image AS commentorProfileImage,
  m.username AS commentorUsername,
  m.color1 AS commentorColor,

  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 1) AS lovely,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 2) AS cool,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 3) AS care,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 4) AS funny,

  (SELECT file FROM audio WHERE post = posts.id) AS audioData,
  (SELECT name FROM audio WHERE post = posts.id) AS audioDataName,
  (SELECT backgroudaudio FROM audio WHERE post = posts.id) AS backgroudaudio,

  interacttype1, interacttype2, rad1, rad2, members.profile_image, members.username, members.color1,
  posts.id, sender, post_count, topic, caption, item1, thumb1, itemtype1, interact1a,
  interact1ax, interact1ay, interact1b, interact1bx, interact1by, item2, vid1backup, vid2backup, time,videoUrl,
  mode,x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,x9,xt9, captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,xa9,
  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,xh9,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,gent9,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8,xv9,nobgmvideo,kontext,prompt
  ,model,ratio,main, inttype, subl, subr, touchl, touchlx, touchly, touchlr, touchr, touchrx, touchry, touchrr
  ,mainaud,sub1aud,sub2aud, interaction_audio_main  AS interactionAudioMain,
  interaction_audio_left  AS interactionAudioLeft,
  interaction_audio_right AS interactionAudioRight,
  touch_config_json       AS touchConfigJson,intbg

FROM posts
INNER JOIN members ON posts.sender = members.id
LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)
WHERE posts.mode = 2 and posts.id < ?
ORDER BY posts.id DESC
LIMIT 28;
`;

const postsx = `
SELECT
  (SELECT COUNT(*) FROM fan WHERE favid = posts.sender AND userid = ?) AS favCount,
  (SELECT type FROM emotions WHERE post = posts.id AND user = ?) AS EmoIn,
  (SELECT COUNT(*) FROM comments WHERE post = posts.id) AS commentCount,

  (SELECT com FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPost,
  (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPostUser,

  m.profile_image AS commentorProfileImage,
  m.username AS commentorUsername,
  m.color1 AS commentorColor,

  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 1) AS lovely,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 2) AS cool,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 3) AS care,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 4) AS funny,

  (SELECT file FROM audio WHERE post = posts.id) AS audioData,
  (SELECT name FROM audio WHERE post = posts.id) AS audioDataName,
  (SELECT backgroudaudio FROM audio WHERE post = posts.id) AS backgroudaudio,

  interacttype1, interacttype2, rad1, rad2, members.profile_image, members.username, members.color1,
  posts.id, sender, post_count, topic, caption, item1, thumb1, itemtype1, interact1a,
  interact1ax, interact1ay, interact1b, interact1bx, interact1by, item2, vid1backup, vid2backup, time,videoUrl,
  mode, x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,x9,xt9, captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,xa9,
  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,xh9,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,gent9,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8,xv9,nobgmvideo,kontext,prompt
  ,model,ratio

FROM posts
INNER JOIN members ON posts.sender = members.id
LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)
WHERE posts.mode = 0
ORDER BY posts.id DESC
LIMIT 28;
`;

const postsxMoreO = `
SELECT
  (SELECT COUNT(*) FROM fan WHERE favid = posts.sender AND userid = ?) AS favCount,
  (SELECT type FROM emotions WHERE post = posts.id AND user = ?) AS EmoIn,
  (SELECT COUNT(*) FROM comments WHERE post = posts.id) AS commentCount,

  (SELECT com FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPost,
  (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPostUser,

  m.profile_image AS commentorProfileImage,
  m.username AS commentorUsername,
  m.color1 AS commentorColor,

  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 1) AS lovely,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 2) AS cool,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 3) AS care,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 4) AS funny,

  (SELECT file FROM audio WHERE post = posts.id) AS audioData,
  (SELECT name FROM audio WHERE post = posts.id) AS audioDataName,
  (SELECT backgroudaudio FROM audio WHERE post = posts.id) AS backgroudaudio,

  interacttype1, interacttype2, rad1, rad2, members.profile_image, members.username, members.color1,
  posts.id, sender, post_count, topic, caption, item1, thumb1, itemtype1, interact1a,
  interact1ax, interact1ay, interact1b, interact1bx, interact1by, item2, vid1backup, vid2backup, time,videoUrl,
  mode, x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,x9,xt9, captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,xa9,
  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,xh9,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,gent9,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8,xv9,nobgmvideo,kontext,prompt
  ,model,ratio

FROM posts
INNER JOIN members ON posts.sender = members.id
LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)
WHERE posts.mode = 0 and posts.id <= ?
ORDER BY posts.id DESC
LIMIT 28;
`;

const postsxMore = `
SELECT
  (SELECT COUNT(*) FROM fan WHERE favid = posts.sender AND userid = ?) AS favCount,
  (SELECT type FROM emotions WHERE post = posts.id AND user = ?) AS EmoIn,
  (SELECT COUNT(*) FROM comments WHERE post = posts.id) AS commentCount,

  (SELECT com FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPost,
  (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPostUser,

  m.profile_image AS commentorProfileImage,
  m.username AS commentorUsername,
  m.color1 AS commentorColor,

  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 1) AS lovely,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 2) AS cool,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 3) AS care,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 4) AS funny,

  (SELECT file FROM audio WHERE post = posts.id) AS audioData,
  (SELECT name FROM audio WHERE post = posts.id) AS audioDataName,
  (SELECT backgroudaudio FROM audio WHERE post = posts.id) AS backgroudaudio,

  interacttype1, interacttype2, rad1, rad2, members.profile_image, members.username, members.color1,
  posts.id, sender, post_count, topic, caption, item1, thumb1, itemtype1, interact1a,
  interact1ax, interact1ay, interact1b, interact1bx, interact1by, item2, vid1backup, vid2backup, time,videoUrl,
  mode,x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,x9,xt9, captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,xa9,
  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,xh9,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,gent9,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8,xv9,nobgmvideo,kontext,prompt
  ,model,ratio

FROM posts
INNER JOIN members ON posts.sender = members.id
LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)
WHERE posts.mode = 0 and posts.id < ?
ORDER BY posts.id DESC
LIMIT 28;
`;

const postsxStoryClik = `
SELECT

  posts.interacttype1,
  posts.interacttype2,
  posts.rad1,
  posts.rad2,
  members.profile_image,
  members.username,
  members.color1,

  posts.id,
  posts.sender,
  posts.post_count,
  posts.topic,
  posts.caption,
  posts.item1,
  posts.\`mode\`,
  posts.mainint,
  posts.\`int1\`,
  posts.\`inttime1\`,
  posts.\`intx1\`,
  posts.\`inty1\`,
  posts.\`int2\`,
  posts.\`inttime2\`,
  posts.\`intx2\`,
  posts.\`inty2\`

FROM posts
INNER JOIN members
  ON posts.sender = members.id
LEFT JOIN members AS m
  ON m.id = (
    SELECT commented_by
      FROM comments
      WHERE post = posts.id
      ORDER BY date DESC
      LIMIT 1
  )
WHERE posts.mode = 2
ORDER BY posts.id DESC
LIMIT 28;
`;

const postsxStory = `
SELECT
  (SELECT COUNT(*) FROM fan WHERE favid = posts.sender AND userid = ?) AS favCount,
  (SELECT type FROM emotions WHERE post = posts.id AND user = ?) AS EmoIn,
  (SELECT COUNT(*) FROM comments WHERE post = posts.id) AS commentCount,

  (SELECT com FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPost,
  (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPostUser,

  m.profile_image AS commentorProfileImage,
  m.username AS commentorUsername,
  m.color1 AS commentorColor,

  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 1) AS lovely,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 2) AS cool,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 3) AS care,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 4) AS funny,

  (SELECT file FROM audio WHERE post = posts.id) AS audioData,
  (SELECT name FROM audio WHERE post = posts.id) AS audioDataName,
  (SELECT backgroudaudio FROM audio WHERE post = posts.id) AS backgroudaudio,

  interacttype1, interacttype2, rad1, rad2, members.profile_image, members.username, members.color1,
  posts.id, sender, post_count, topic, caption, item1, thumb1, itemtype1, interact1a,
  interact1ax, interact1ay, interact1b, interact1bx, interact1by, item2, vid1backup, vid2backup, time, videoUrl,
  mode, x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,x9,xt9, captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,xa9,
  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,xh9,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,gent9,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8,xv9,nobgmvideo,kontext,prompt
  ,model,ratio,x1B, xt1B, x2B, xt2B, x3B, xt3B, x4B, xt4B, x5B, xt5B, x6B, xt6B, x7B, xt7B, x8B, xt8B, x9B, xt9B,
xa1B, xa2B, xa3B, xa4B, xa5B, xa6B, xa7B, xa8B, xa9B,
xh1B, xh2B, xh3B, xh4B, xh5B, xh6B, xh7B, xh8B, xh9B,
gent1B, gent2B, gent3B, gent4B, gent5B, gent6B, gent7B, gent8B, gent9B,
xv1B, xv2B, xv3B, xv4B, xv5B, xv6B, xv7B, xv8B, xv9B


FROM posts
INNER JOIN members ON posts.sender = members.id
LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)
WHERE posts.mode = 1 and posts.video= 1
ORDER BY posts.id DESC
LIMIT 28;
`;

const postsxMoreStoryO = `
SELECT
  (SELECT COUNT(*) FROM fan WHERE favid = posts.sender AND userid = ?) AS favCount,
  (SELECT type FROM emotions WHERE post = posts.id AND user = ?) AS EmoIn,
  (SELECT COUNT(*) FROM comments WHERE post = posts.id) AS commentCount,

  (SELECT com FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPost,
  (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPostUser,

  m.profile_image AS commentorProfileImage,
  m.username AS commentorUsername,
  m.color1 AS commentorColor,

  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 1) AS lovely,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 2) AS cool,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 3) AS care,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 4) AS funny,

  (SELECT file FROM audio WHERE post = posts.id) AS audioData,
  (SELECT name FROM audio WHERE post = posts.id) AS audioDataName,
  (SELECT backgroudaudio FROM audio WHERE post = posts.id) AS backgroudaudio,

  interacttype1, interacttype2, rad1, rad2, members.profile_image, members.username, members.color1,
  posts.id, sender, post_count, topic, caption, item1, thumb1, itemtype1, interact1a,
  interact1ax, interact1ay, interact1b, interact1bx, interact1by, item2, vid1backup, vid2backup, time,videoUrl ,
  mode, x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,x9,xt9, captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,xa9,
  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,xh9,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,gent9,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8,xv9,nobgmvideo,kontext,prompt
  ,model,ratio,x1B, xt1B, x2B, xt2B, x3B, xt3B, x4B, xt4B, x5B, xt5B, x6B, xt6B, x7B, xt7B, x8B, xt8B, x9B, xt9B,
xa1B, xa2B, xa3B, xa4B, xa5B, xa6B, xa7B, xa8B, xa9B,
xh1B, xh2B, xh3B, xh4B, xh5B, xh6B, xh7B, xh8B, xh9B,
gent1B, gent2B, gent3B, gent4B, gent5B, gent6B, gent7B, gent8B, gent9B,
xv1B, xv2B, xv3B, xv4B, xv5B, xv6B, xv7B, xv8B, xv9B


FROM posts
INNER JOIN members ON posts.sender = members.id
LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)
WHERE posts.mode = 1 and posts.id <= ? and posts.video= 1
ORDER BY posts.id DESC
LIMIT 28;
`;

const postsxMoreStory = `
SELECT
  (SELECT COUNT(*) FROM fan WHERE favid = posts.sender AND userid = ?) AS favCount,
  (SELECT type FROM emotions WHERE post = posts.id AND user = ?) AS EmoIn,
  (SELECT COUNT(*) FROM comments WHERE post = posts.id) AS commentCount,

  (SELECT com FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPost,
  (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPostUser,

  m.profile_image AS commentorProfileImage,
  m.username AS commentorUsername,
  m.color1 AS commentorColor,

  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 1) AS lovely,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 2) AS cool,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 3) AS care,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 4) AS funny,

  (SELECT file FROM audio WHERE post = posts.id) AS audioData,
  (SELECT name FROM audio WHERE post = posts.id) AS audioDataName,
  (SELECT backgroudaudio FROM audio WHERE post = posts.id) AS backgroudaudio,

  interacttype1, interacttype2, rad1, rad2, members.profile_image, members.username, members.color1,
  posts.id, sender, post_count, topic, caption, item1, thumb1, itemtype1, interact1a,
  interact1ax, interact1ay, interact1b, interact1bx, interact1by, item2, vid1backup, vid2backup, time,videoUrl ,
  mode, x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,x9,xt9, captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,xa9,
  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,xh9,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,gent9,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8,xv9,nobgmvideo,kontext,prompt
  ,model,ratio,x1B, xt1B, x2B, xt2B, x3B, xt3B, x4B, xt4B, x5B, xt5B, x6B, xt6B, x7B, xt7B, x8B, xt8B, x9B, xt9B,
xa1B, xa2B, xa3B, xa4B, xa5B, xa6B, xa7B, xa8B, xa9B,
xh1B, xh2B, xh3B, xh4B, xh5B, xh6B, xh7B, xh8B, xh9B,
gent1B, gent2B, gent3B, gent4B, gent5B, gent6B, gent7B, gent8B, gent9B,
xv1B, xv2B, xv3B, xv4B, xv5B, xv6B, xv7B, xv8B, xv9B


FROM posts
INNER JOIN members ON posts.sender = members.id
LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)
WHERE posts.mode = 1 and posts.id < ? and posts.video= 1
ORDER BY posts.id DESC
LIMIT 28;
`;

const postsxFeeds = `
SELECT
  (SELECT COUNT(*) FROM fan WHERE favid = posts.sender AND userid = ?) AS favCount,
  (SELECT type FROM emotions WHERE post = posts.id AND user = ?) AS EmoIn,
  (SELECT COUNT(*) FROM comments WHERE post = posts.id) AS commentCount,

  (SELECT com FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPost,
  (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPostUser,

  m.profile_image AS commentorProfileImage,
  m.username AS commentorUsername,
  m.color1 AS commentorColor,

  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 1) AS lovely,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 2) AS cool,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 3) AS care,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 4) AS funny,

  (SELECT file FROM audio WHERE post = posts.id) AS audioData,
  (SELECT name FROM audio WHERE post = posts.id) AS audioDataName,
  (SELECT backgroudaudio FROM audio WHERE post = posts.id) AS backgroudaudio,

  interacttype1, interacttype2, rad1, rad2, members.profile_image, members.username, members.color1,
  posts.id, sender, post_count, topic, caption, item1, thumb1, itemtype1, interact1a,
  interact1ax, interact1ay, interact1b, interact1bx, interact1by, item2, vid1backup, vid2backup, time, videoUrl,
  mode,x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,x9,xt9, captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,xa9,
  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,xh9,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,gent9,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8,xv9,nobgmvideo,kontext,prompt
  ,model,ratio,main, inttype, subl, subr, touchl, touchlx, touchly, touchlr, touchr, touchrx, touchry, touchrr
  ,mainaud,sub1aud,sub2aud, interaction_audio_main  AS interactionAudioMain,
  interaction_audio_left  AS interactionAudioLeft,
  interaction_audio_right AS interactionAudioRight,
  touch_config_json       AS touchConfigJson,x1B, xt1B, x2B, xt2B, x3B, xt3B, x4B, xt4B, x5B, xt5B, x6B, xt6B, x7B, xt7B, x8B, xt8B, x9B, xt9B,
xa1B, xa2B, xa3B, xa4B, xa5B, xa6B, xa7B, xa8B, xa9B,
xh1B, xh2B, xh3B, xh4B, xh5B, xh6B, xh7B, xh8B, xh9B,
gent1B, gent2B, gent3B, gent4B, gent5B, gent6B, gent7B, gent8B, gent9B,
xv1B, xv2B, xv3B, xv4B, xv5B, xv6B, xv7B, xv8B, xv9B,intbg




FROM posts
INNER JOIN members ON posts.sender = members.id
LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)

ORDER BY posts.id DESC
LIMIT 28;
`;

const postsxMoreFeedsO = `
SELECT
  (SELECT COUNT(*) FROM fan WHERE favid = posts.sender AND userid = ?) AS favCount,
  (SELECT type FROM emotions WHERE post = posts.id AND user = ?) AS EmoIn,
  (SELECT COUNT(*) FROM comments WHERE post = posts.id) AS commentCount,

  (SELECT com FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPost,
  (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPostUser,

  m.profile_image AS commentorProfileImage,
  m.username AS commentorUsername,
  m.color1 AS commentorColor,

  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 1) AS lovely,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 2) AS cool,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 3) AS care,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 4) AS funny,

  (SELECT file FROM audio WHERE post = posts.id) AS audioData,
  (SELECT name FROM audio WHERE post = posts.id) AS audioDataName,
  (SELECT backgroudaudio FROM audio WHERE post = posts.id) AS backgroudaudio,

  interacttype1, interacttype2, rad1, rad2, members.profile_image, members.username, members.color1,
  posts.id, sender, post_count, topic, caption, item1, thumb1, itemtype1, interact1a,
  interact1ax, interact1ay, interact1b, interact1bx, interact1by, item2, vid1backup, vid2backup, time,videoUrl ,
  mode, x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,x9,xt9, captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,xa9,
  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,xh9,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,gent9,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8,xv9,nobgmvideo,kontext,prompt
  ,model,ratio,main, inttype, subl, subr, touchl, touchlx, touchly, touchlr, touchr, touchrx, touchry, touchrr
  ,mainaud,sub1aud,sub2aud, interaction_audio_main  AS interactionAudioMain,
  interaction_audio_left  AS interactionAudioLeft,
  interaction_audio_right AS interactionAudioRight,
  touch_config_json       AS touchConfigJson,x1B, xt1B, x2B, xt2B, x3B, xt3B, x4B, xt4B, x5B, xt5B, x6B, xt6B, x7B, xt7B, x8B, xt8B, x9B, xt9B,
xa1B, xa2B, xa3B, xa4B, xa5B, xa6B, xa7B, xa8B, xa9B,
xh1B, xh2B, xh3B, xh4B, xh5B, xh6B, xh7B, xh8B, xh9B,
gent1B, gent2B, gent3B, gent4B, gent5B, gent6B, gent7B, gent8B, gent9B,
xv1B, xv2B, xv3B, xv4B, xv5B, xv6B, xv7B, xv8B, xv9B,intbg


FROM posts
INNER JOIN members ON posts.sender = members.id
LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)
WHERE posts.id <= ?
ORDER BY posts.id DESC
LIMIT 28;
`;

const postsxMoreFeeds = `
SELECT
  (SELECT COUNT(*) FROM fan WHERE favid = posts.sender AND userid = ?) AS favCount,
  (SELECT type FROM emotions WHERE post = posts.id AND user = ?) AS EmoIn,
  (SELECT COUNT(*) FROM comments WHERE post = posts.id) AS commentCount,

  (SELECT com FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPost,
  (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPostUser,

  m.profile_image AS commentorProfileImage,
  m.username AS commentorUsername,
  m.color1 AS commentorColor,

  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 1) AS lovely,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 2) AS cool,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 3) AS care,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 4) AS funny,

  (SELECT file FROM audio WHERE post = posts.id) AS audioData,
  (SELECT name FROM audio WHERE post = posts.id) AS audioDataName,
  (SELECT backgroudaudio FROM audio WHERE post = posts.id) AS backgroudaudio,

  interacttype1, interacttype2, rad1, rad2, members.profile_image, members.username, members.color1,
  posts.id, sender, post_count, topic, caption, item1, thumb1, itemtype1, interact1a,
  interact1ax, interact1ay, interact1b, interact1bx, interact1by, item2, vid1backup, vid2backup, time,videoUrl ,
  mode, x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,x9,xt9, captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,xa9,
  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,xh9,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,gent9,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8,xv9,nobgmvideo,kontext,prompt
  ,model,ratio,main, inttype, subl, subr, touchl, touchlx, touchly, touchlr, touchr, touchrx, touchry, touchrr
  ,mainaud,sub1aud,sub2aud, interaction_audio_main  AS interactionAudioMain,
  interaction_audio_left  AS interactionAudioLeft,
  interaction_audio_right AS interactionAudioRight,
  touch_config_json       AS touchConfigJson,x1B, xt1B, x2B, xt2B, x3B, xt3B, x4B, xt4B, x5B, xt5B, x6B, xt6B, x7B, xt7B, x8B, xt8B, x9B, xt9B,
xa1B, xa2B, xa3B, xa4B, xa5B, xa6B, xa7B, xa8B, xa9B,
xh1B, xh2B, xh3B, xh4B, xh5B, xh6B, xh7B, xh8B, xh9B,
gent1B, gent2B, gent3B, gent4B, gent5B, gent6B, gent7B, gent8B, gent9B,
xv1B, xv2B, xv3B, xv4B, xv5B, xv6B, xv7B, xv8B, xv9B,intbg



FROM posts
INNER JOIN members ON posts.sender = members.id
LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)
WHERE  posts.id < ?
ORDER BY posts.id DESC
LIMIT 28;
`;

const profile = `

SELECT
  (SELECT COUNT(*) FROM fan WHERE favid = posts.sender AND userid = ?) AS favCount,
  (SELECT type FROM emotions WHERE post = posts.id AND user = ?) AS EmoIn,
  (SELECT COUNT(*) FROM comments WHERE post = posts.id) AS commentCount,

  (SELECT com FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPost,
  (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPostUser,

  m.profile_image AS commentorProfileImage,
  m.username AS commentorUsername,
  m.color1 AS commentorColor,


  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 1) AS lovely,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 2) AS cool,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 3) AS care,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 4) AS funny,

  (SELECT file FROM audio WHERE post = posts.id) AS audioData,
   (SELECT name FROM audio WHERE post = posts.id) AS audioDataName,
  (SELECT backgroudaudio FROM audio WHERE post = posts.id) AS backgroudaudio,

  interacttype1, interacttype2, rad1, rad2, members.profile_image, members.username, members.color1,
  posts.id, sender, post_count, topic, caption, item1, thumb1, itemtype1, interact1a,
  interact1ax, interact1ay, interact1b, interact1bx, interact1by, item2, vid1backup, vid2backup, time,videoUrl,
    mode, x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,x9,xt9, captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,xa9,
  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,xh9,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,gent9,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8,xv9,nobgmvideo,kontext,prompt
    ,model,ratio,main, inttype, subl, subr, touchl, touchlx, touchly, touchlr, touchr, touchrx, touchry, touchrr
    ,mainaud,sub1aud,sub2aud, interaction_audio_main  AS interactionAudioMain,
  interaction_audio_left  AS interactionAudioLeft,
  interaction_audio_right AS interactionAudioRight,
  touch_config_json       AS touchConfigJson,intbg


FROM posts

INNER JOIN members ON posts.sender = members.id

LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)

WHERE posts.sender = ?
ORDER BY posts.id DESC
LIMIT 28;


`;

const profile_moreO = `SELECT
  (SELECT COUNT(*) FROM fan WHERE favid = posts.sender AND userid = ?) AS favCount,
  (SELECT type FROM emotions WHERE post = posts.id AND user = ?) AS EmoIn,
  (SELECT COUNT(*) FROM comments WHERE post = posts.id) AS commentCount,

  (SELECT com FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPost,
  (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPostUser,

  m.profile_image AS commentorProfileImage,
  m.username AS commentorUsername,
  m.color1 AS commentorColor,

  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 1) AS lovely,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 2) AS cool,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 3) AS care,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 4) AS funny,

  (SELECT file FROM audio WHERE post = posts.id) AS audioData,
   (SELECT name FROM audio WHERE post = posts.id) AS audioDataName,
  (SELECT backgroudaudio FROM audio WHERE post = posts.id) AS backgroudaudio,

  interacttype1, interacttype2, rad1, rad2, members.profile_image, members.username, members.color1,
  posts.id, sender, post_count, topic, caption, item1, thumb1, itemtype1, interact1a,
  interact1ax, interact1ay, interact1b, interact1bx, interact1by, item2, vid1backup, vid2backup, time,videoUrl,
    mode,x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,x9,xt9, captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,xa9,
  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,xh9,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,gent9,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8,xv9,nobgmvideo,kontext,prompt
    ,model,ratio,main, inttype, subl, subr, touchl, touchlx, touchly, touchlr, touchr, touchrx, touchry, touchrr
    ,mainaud,sub1aud,sub2aud, interaction_audio_main  AS interactionAudioMain,
  interaction_audio_left  AS interactionAudioLeft,
  interaction_audio_right AS interactionAudioRight,
  touch_config_json       AS touchConfigJson,intbg



FROM posts

INNER JOIN members ON posts.sender = members.id

LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)

WHERE  posts.sender = ? AND posts.id <= ?

ORDER BY posts.id DESC
LIMIT 28;



`;

const profile_more = `SELECT
  (SELECT COUNT(*) FROM fan WHERE favid = posts.sender AND userid = ?) AS favCount,
  (SELECT type FROM emotions WHERE post = posts.id AND user = ?) AS EmoIn,
  (SELECT COUNT(*) FROM comments WHERE post = posts.id) AS commentCount,

  (SELECT com FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPost,
  (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1) AS commentPostUser,

  m.profile_image AS commentorProfileImage,
  m.username AS commentorUsername,
  m.color1 AS commentorColor,

  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 1) AS lovely,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 2) AS cool,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 3) AS care,
  (SELECT COUNT(*) FROM emotions WHERE post = posts.id AND type = 4) AS funny,

  (SELECT file FROM audio WHERE post = posts.id) AS audioData,
   (SELECT name FROM audio WHERE post = posts.id) AS audioDataName,
  (SELECT backgroudaudio FROM audio WHERE post = posts.id) AS backgroudaudio,

  interacttype1, interacttype2, rad1, rad2, members.profile_image, members.username, members.color1,
  posts.id, sender, post_count, topic, caption, item1, thumb1, itemtype1, interact1a,
  interact1ax, interact1ay, interact1b, interact1bx, interact1by, item2, vid1backup, vid2backup, time,videoUrl,
    mode,x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,x9,xt9, captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,xa9,
  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,xh9,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,gent9,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8,xv9,nobgmvideo,kontext,prompt
    ,model,ratio,main, inttype, subl, subr, touchl, touchlx, touchly, touchlr, touchr, touchrx, touchry, touchrr
    ,mainaud,sub1aud,sub2aud, interaction_audio_main  AS interactionAudioMain,
  interaction_audio_left  AS interactionAudioLeft,
  interaction_audio_right AS interactionAudioRight,
  touch_config_json       AS touchConfigJson,intbg


FROM posts

INNER JOIN members ON posts.sender = members.id

LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)

WHERE  posts.sender = ? AND posts.id < ?

ORDER BY posts.id DESC
LIMIT 28;



`;

// routes/fanPeople.ts
// routes/fanPeople.ts

export const fanpeople = async (req: any, res: any) => {
  try {
    const { values } = req.body ?? {};

    const ownerId = Number(
      values?.ownerId ?? req.body?.ownerId ?? req.params?.id ?? req.query?.id
    );
    const viewerId = Number(
      values?.viewerId ?? req.body?.viewerId ?? req.query?.viewerId ?? 0
    );

    const limit = Number(
      values?.limit ?? req.body?.limit ?? req.query?.limit ?? 50
    );

    // keep offset for response compatibility (not used in keyset queries)
    const offset = Number(
      values?.offset ?? req.body?.offset ?? req.query?.offset ?? 0
    );

    // cursor: 0/null = first page; otherwise load rows with f.id < lastId
    const lastId = Number(
      values?.lastIdFromArray ??
        req.body?.lastIdFromArray ??
        req.body?.lastId ??
        0
    );

    if (!Number.isFinite(ownerId)) {
      return res
        .status(400)
        .json({ ok: false, error: "ownerId must be a number" });
    }

    // Followers of ownerId (f.favid = ownerId; u is the follower)
    const followersSQL = `
  SELECT
    f.id AS fanid,
    u.id,
    u.username,
    u.profile_image,
    u.color1,
    f.time AS followed_at,
    p.item1 AS last_item1,
    p.id    AS pid,
    (vf.id IS NOT NULL) AS viewer_follows_user,   -- viewerId -> u.id
    (fv.id IS NOT NULL) AS user_follows_viewer    -- u.id     -> viewerId
  FROM fan f
  JOIN members u ON u.id = f.userid
  LEFT JOIN fan vf ON vf.userid = ? AND vf.favid = u.id
  LEFT JOIN fan fv ON fv.userid = u.id AND fv.favid = ?
  LEFT JOIN posts p
    ON p.sender = u.id
   AND p.id = (SELECT MAX(p2.id) FROM posts p2 WHERE p2.sender = u.id)
  WHERE f.favid = ?
    AND (? = 0 OR f.id < ?)
  ORDER BY f.id DESC
  LIMIT ?`;

    // People ownerId is following (f.userid = ownerId; u is the target)
    const followingSQL = `
  SELECT
    f.id AS fanid,               -- <-- cursor column
    u.id,
    u.username,
    u.profile_image,
    u.color1,
    f.time AS followed_at,
    p.item1 AS last_item1,
    p.id    AS pid,
    (vf.id IS NOT NULL) AS viewer_follows_user,   -- viewerId -> u.id
    (fv.id IS NOT NULL) AS user_follows_viewer    -- u.id     -> viewerId
  FROM fan f
  JOIN members u ON u.id = f.favid
  LEFT JOIN fan vf ON vf.userid = ? AND vf.favid = u.id
  LEFT JOIN fan fv ON fv.userid = u.id AND fv.favid = ?
  LEFT JOIN posts p
    ON p.sender = u.id
   AND p.id = (SELECT MAX(p2.id) FROM posts p2 WHERE p2.sender = u.id)
  WHERE f.userid = ?
    AND (? = 0 OR f.id < ?)
  ORDER BY f.id DESC
  LIMIT ?`;

    const countFollowersSQL = `SELECT COUNT(*) AS c FROM fan WHERE favid  = ?`;
    const countFollowingSQL = `SELECT COUNT(*) AS c FROM fan WHERE userid = ?`;

    const [
      followersRows,
      followingRows,
      followersCountRow,
      followingCountRow,
    ] = await Promise.all([
      execQuery(followersSQL, [
        viewerId,
        viewerId,
        ownerId,
        lastId,
        lastId,
        limit,
      ]),
      execQuery(followingSQL, [
        viewerId,
        viewerId,
        ownerId,
        lastId,
        lastId,
        limit,
      ]),
      execQuery(countFollowersSQL, [ownerId]),
      execQuery(countFollowingSQL, [ownerId]),
    ]);

    const classify = (
      vf: any,
      fv: any
    ): "mutual" | "one_way_out" | "one_way_in" | "none" => {
      const following = !!vf;
      const followedBy = !!fv;
      if (following && followedBy) return "mutual";
      if (following) return "one_way_out";
      if (followedBy) return "one_way_in";
      return "none";
    };

    const followers = ((followersRows as any[]) ?? []).map((r) => ({
      fan_id: r.fanid, // <-- include cursor in JSON
      id: r.id,
      username: r.username,
      profile_image: r.profile_image,
      color1: r.color1,
      last_item1: r.last_item1 ?? null,
      followed_at: r.followed_at,
      viewerFollows: !!r.viewer_follows_user,
      followsViewer: !!r.user_follows_viewer,
      relationship: classify(r.viewer_follows_user, r.user_follows_viewer),
    }));

    const following = ((followingRows as any[]) ?? []).map((r) => ({
      fan_id: r.fanid, // <-- include cursor in JSON
      id: r.id,
      username: r.username,
      profile_image: r.profile_image,
      color1: r.color1,
      last_item1: r.last_item1 ?? null,
      followed_at: r.followed_at,
      viewerFollows: !!r.viewer_follows_user,
      followsViewer: !!r.user_follows_viewer,
      relationship: classify(r.viewer_follows_user, r.user_follows_viewer),
    }));

    const counts = {
      followers: (followersCountRow as any[])?.[0]?.c ?? 0,
      following: (followingCountRow as any[])?.[0]?.c ?? 0,
    };

    return res.json({
      ok: true,
      ownerId,
      viewerId: Number.isFinite(viewerId) ? viewerId : null,
      limit,
      offset, // compatibility only
      counts,
      followers,
      following,
    });
  } catch (err) {
    console.error("fan/people error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to fetch fan people" });
  }
};

// POST /emotion/like
// body/query/params: { postid: number, userid: number, liked?: boolean }
// - liked=true  -> ensure like exists (idempotent)
// - liked=false -> ensure like removed (idempotent)
// - liked omitted -> toggle
export const addLikes = async (req: any, res: any) => {
  try {
    const { values } = req.body ?? {};
    const userid = Number(
      values?.userid ??
        req.body?.userid ??
        req.params?.userid ??
        req.query?.userid
    );
    const postid = Number(
      values?.postid ??
        req.body?.postid ??
        req.params?.postid ??
        req.query?.postid
    );

    // liked can be true/false/"true"/"false"/1/0 etc.
    const likedRaw =
      values?.liked ?? req.body?.liked ?? req.params?.liked ?? req.query?.liked;
    const likedProvided = likedRaw !== undefined;
    const likedDesired =
      typeof likedRaw === "boolean"
        ? likedRaw
        : typeof likedRaw === "string"
        ? ["1", "true", "yes", "y"].includes(likedRaw.toLowerCase())
        : !!likedRaw;

    if (!Number.isFinite(userid) || !Number.isFinite(postid)) {
      return res
        .status(400)
        .json({ ok: false, error: "userid and postid must be numbers" });
    }
    if (userid <= 0 || postid <= 0) {
      return res
        .status(400)
        .json({ ok: false, error: "userid and postid must be positive" });
    }

    // 1) Do we already have a LIKE (type=1)?
    const [
      existing,
    ] = (await execQuery(
      "SELECT id FROM emotions WHERE post = ? AND user = ? AND type = 1 LIMIT 1",
      [postid, userid]
    )) as Array<{ id: number }>;

    let likedNow = !!existing;

    // 2) Decide operation (always enforce type=1 for 'like')
    if (likedProvided) {
      if (likedDesired && !likedNow) {
        // Use UPSERT so if a legacy row exists (different type) under a unique (post,user), it becomes type=1.
        await execQuery(
          "INSERT INTO emotions (post, user, type, time) VALUES (?, ?, 1, NOW()) " +
            "ON DUPLICATE KEY UPDATE type = 1, time = NOW()",
          [postid, userid]
        );
        likedNow = true;
      } else if (!likedDesired && likedNow) {
        await execQuery(
          "DELETE FROM emotions WHERE post = ? AND user = ? AND type = 1 LIMIT 1",
          [postid, userid]
        );
        likedNow = false;
      }
    } else {
      // toggle (only for type=1)
      if (likedNow) {
        await execQuery(
          "DELETE FROM emotions WHERE post = ? AND user = ? AND type = 1 LIMIT 1",
          [postid, userid]
        );
        likedNow = false;
      } else {
        await execQuery(
          "INSERT INTO emotions (post, user, type, time) VALUES (?, ?, 1, NOW()) " +
            "ON DUPLICATE KEY UPDATE type = 1, time = NOW()",
          [postid, userid]
        );
        likedNow = true;
      }
    }

    // 3) Fresh like count (type=1 only)
    const [
      countRow,
    ] = (await execQuery(
      "SELECT COUNT(*) AS likes FROM emotions WHERE post = ? AND type = 1",
      [postid]
    )) as Array<{ likes: number }>;

    return res.json({
      ok: true,
      postid,
      userid,
      liked: likedNow,
      likes: countRow?.likes ?? 0,
    });
  } catch (e: any) {
    // Duplicate insert race safety: treat as liked and return fresh count
    const msg = String(e?.message || e);
    if (msg.includes("Duplicate") || msg.includes("ER_DUP_ENTRY")) {
      try {
        const postid = Number(
          req.body?.postid ??
            req.query?.postid ??
            req.params?.postid ??
            req.body?.values?.postid
        );
        const userid = Number(
          req.body?.userid ??
            req.query?.userid ??
            req.params?.userid ??
            req.body?.values?.userid
        );

        const [
          countRow,
        ] = (await execQuery(
          "SELECT COUNT(*) AS likes FROM emotions WHERE post = ? AND type = 1",
          [postid]
        )) as Array<{ likes: number }>;

        return res.json({
          ok: true,
          postid,
          userid,
          liked: true,
          likes: countRow?.likes ?? 0,
        });
      } catch {}
    }

    console.error("emotion/like error:", e);
    return res.status(500).json({ ok: false, error: "Failed to set like" });
  }
};

// GET or POST /fan/list or /fan/list/:id
// body can be { values: { id, limit, offset } } or { id, limit, offset }
// query params also work (?limit=..., ?offset=...)

// GET or POST /fan/status  (also supports /fan/status/:userid/:favid)
export const fanStatus = async (req: any, res: any) => {
  try {
    const { values } = req.body ?? {};
    const userid = Number(
      values?.userid ??
        req.body?.userid ??
        req.params?.userid ??
        req.query?.userid
    );
    const favid = Number(
      values?.favid ?? req.body?.favid ?? req.params?.favid ?? req.query?.favid
    );

    if (!Number.isFinite(userid) || !Number.isFinite(favid)) {
      return res
        .status(400)
        .json({ ok: false, error: "userid and favid must be numbers" });
    }
    if (userid === favid) {
      return res.json({ ok: true, following: false, relationship: "self" });
    }

    const sql = `SELECT 1 AS x FROM fan WHERE fanlock = CONCAT(?, ':', ?) LIMIT 1`;
    const [a] = (await execQuery(sql, [userid, favid])) as Array<{ x: 1 }>;
    const [b] = (await execQuery(sql, [favid, userid])) as Array<{ x: 1 }>; // optional back check

    const following = !!a;
    const followedBy = !!b;
    const relationship =
      following && followedBy
        ? "mutual"
        : following
        ? "one_way_out"
        : followedBy
        ? "one_way_in"
        : "none";

    return res.json({ ok: true, following, followedBy, relationship });
  } catch (e) {
    console.error("fan/status error:", e);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to check follow status" });
  }
};

// POST /likespeople  â€” list users who liked a post (type=1) in the same shape as fanpeople
export const likesList = async (req: any, res: any) => {
  try {
    const { values } = req.body ?? {};

    const postid = Number(
      values?.postid ??
        req.body?.postid ??
        req.params?.postid ??
        req.query?.postid
    );
    const viewerId = Number(
      values?.viewerId ?? req.body?.viewerId ?? req.query?.viewerId ?? 0
    );
    const limit = Number(
      values?.limit ?? req.body?.limit ?? req.query?.limit ?? 50
    );
    const offset = Number(
      values?.offset ?? req.body?.offset ?? req.query?.offset ?? 0
    ); // kept for compatibility

    // keyset cursor: 0/null = first page; otherwise emo.id < lastId
    const lastId = Number(
      values?.lastIdFromArray ??
        req.body?.lastIdFromArray ??
        req.body?.lastId ??
        0
    );

    if (!Number.isFinite(postid)) {
      return res
        .status(400)
        .json({ ok: false, error: "postid must be a number" });
    }

    // Users who liked this post (emotions.type = 1)
    // u = liker (members); emo.id is our cursor
    const likesSQL = `
      SELECT
        emo.id AS fanid,             -- cursor column (like fanpeople.fanid)
        u.id,
        u.username,
        u.profile_image,
        u.color1,
        emo.time AS followed_at,     -- reuse same alias
        p.item1 AS last_item1,
        p.id    AS pid,
        (vf.id IS NOT NULL) AS viewer_follows_user,   -- viewerId -> liker
        (fv.id IS NOT NULL) AS user_follows_viewer    -- liker    -> viewerId
      FROM emotions emo
      JOIN members u ON u.id = emo.user
      LEFT JOIN fan vf ON vf.userid = ? AND vf.favid = u.id
      LEFT JOIN fan fv ON fv.userid = u.id AND fv.favid = ?
      LEFT JOIN posts p
        ON p.sender = u.id
       AND p.id = (
            SELECT MAX(p2.id)
            FROM posts p2
            WHERE p2.sender = u.id
          )
      WHERE emo.post = ?
        AND emo.type = 1
        AND (? = 0 OR emo.id < ?)
      ORDER BY emo.id DESC
      LIMIT ?`;

    const countLikesSQL = `SELECT COUNT(*) AS c FROM emotions WHERE post = ? AND type = 1`;

    const [likesRows, [countRow]] = await Promise.all([
      execQuery(likesSQL, [viewerId, viewerId, postid, lastId, lastId, limit]),
      execQuery(countLikesSQL, [postid]) as Promise<Array<{ c: number }>>,
    ]);

    const classify = (
      vf: any,
      fv: any
    ): "mutual" | "one_way_out" | "one_way_in" | "none" => {
      const following = !!vf;
      const followedBy = !!fv;
      if (following && followedBy) return "mutual";
      if (following) return "one_way_out";
      if (followedBy) return "one_way_in";
      return "none";
    };

    // Map rows to the same object shape used by EmotionsRow (FanRow-like)
    const likes = ((likesRows as any[]) ?? []).map((r) => ({
      fan_id: r.fanid, // cursor id
      id: r.id, // liker user id
      username: r.username,
      profile_image: r.profile_image,
      color1: r.color1,
      last_item1: r.last_item1 ?? null,
      followed_at: r.followed_at,
      viewerFollows: !!r.viewer_follows_user,
      followsViewer: !!r.user_follows_viewer,
      relationship: classify(r.viewer_follows_user, r.user_follows_viewer),
    }));

    return res.json({
      ok: true,
      postid,
      viewerId: Number.isFinite(viewerId) ? viewerId : null,
      limit,
      offset, // compatibility only
      counts: { likes: (countRow as any)?.c ?? 0 },
      likes, // your UI will read this when Likes mode is on
    });
  } catch (err) {
    console.error("likespeople error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to fetch likes list" });
  }
};

export const fanList = async (req: any, res: any) => {
  try {
    const { values } = req.body ?? {};
    const id = Number(values?.id ?? req.body?.id ?? req.params?.id);
    const limit = Number(
      values?.limit ?? req.body?.limit ?? req.query?.limit ?? 50
    );
    const offset = Number(
      values?.offset ?? req.body?.offset ?? req.query?.offset ?? 0
    );

    if (!Number.isFinite(id)) {
      return res.status(400).json({ ok: false, error: "id must be a number" });
    }

    // Followers of this user: rows where favid = id (userid is the follower)
    const followersSQL = `
      SELECT f.userid    AS id,
             f.time      AS followed_at,
             m.username,
             m.profile_image,
             m.color1
      FROM fan f
      JOIN members m ON m.id = f.userid
      WHERE f.favid = ?
      ORDER BY f.time DESC
      LIMIT ? OFFSET ?
    `;

    // People this user is following: rows where userid = id (favid is the target)
    const followingSQL = `
      SELECT f.favid     AS id,
             f.time      AS followed_at,
             m.username,
             m.profile_image,
             m.color1
      FROM fan f
      JOIN members m ON m.id = f.favid
      WHERE f.userid = ?
      ORDER BY f.time DESC
      LIMIT ? OFFSET ?
    `;

    const countFollowersSQL = `SELECT COUNT(*) AS c FROM fan WHERE favid  = ?`;
    const countFollowingSQL = `SELECT COUNT(*) AS c FROM fan WHERE userid = ?`;

    const [
      followersRows,
      followingRows,
      followersCountRow,
      followingCountRow,
    ] = await Promise.all([
      execQuery(followersSQL, [id, limit, offset]),
      execQuery(followingSQL, [id, limit, offset]),
      execQuery(countFollowersSQL, [id]),
      execQuery(countFollowingSQL, [id]),
    ]);

    const followers = ((followersRows as any[]) ?? []).map((r) => ({
      id: r.id,
      username: r.username,
      profile_image: r.profile_image,
      color1: r.color1,
      followed_at: r.followed_at,
    }));

    const following = ((followingRows as any[]) ?? []).map((r) => ({
      id: r.id,
      username: r.username,
      profile_image: r.profile_image,
      color1: r.color1,
      followed_at: r.followed_at,
    }));

    const counts = {
      followers: (followersCountRow as any[])?.[0]?.c ?? 0,
      following: (followingCountRow as any[])?.[0]?.c ?? 0,
    };

    return res.json({
      ok: true,
      userId: id,
      limit,
      offset,
      counts,
      followers, // users who follow `id`
      following, // users `id` follows
    });
  } catch (err) {
    console.error("fan/list error:", err);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to fetch followers/following" });
  }
};

export type ToggleResult =
  | { ok: true; following: true; state: "followed"; countDelta: 1 }
  | { ok: true; following: false; state: "unfollowed"; countDelta: -1 }
  | { ok: true; following: true; state: "already_following"; countDelta: 0 }
  | {
      ok: true;
      following: false;
      state: "already_not_following";
      countDelta: 0;
    };

export const fantoggle = async (req: any, res: any) => {
  try {
    // Accept both { values: { ... } } and flat body { ... }
    const { values } = req.body ?? {};
    const userid = Number(values?.userid ?? req.body?.userid);
    const favid = Number(values?.favid ?? req.body?.favid);
    const action = (values?.action ?? req.body?.action) as
      | "follow"
      | "unfollow"
      | undefined;

    console.log("kjhg");

    if (userid === favid) {
      // block self-follow
      const payload: ToggleResult = {
        ok: true,
        following: false,
        state: "already_not_following",
        countDelta: 0,
      };
      return res.json(payload);
    }

    // Check existence via string fanlock "userid:favid"
    const existsSQL = `SELECT 1 AS x FROM fan WHERE fanlock = CONCAT(?, ':', ?) LIMIT 1`;
    const rows = (await execQuery(existsSQL, [userid, favid])) as Array<{
      x: 1;
    }>;
    const exists = !!rows?.[0];

    // If no explicit action, toggle based on current existence
    const intent: "follow" | "unfollow" =
      action ?? (exists ? "unfollow" : "follow");

    if (intent === "follow") {
      if (exists) {
        const payload: ToggleResult = {
          ok: true,
          following: true,
          state: "already_following",
          countDelta: 0,
        };
        return res.json(payload);
      }

      // Insert only if not exists (atomic at statement level)
      const followSQL = `
        INSERT INTO fan (userid, favid, fanlock, time)
        SELECT ?, ?, CONCAT(?, ':', ?), NOW()
        FROM DUAL
        WHERE NOT EXISTS (
          SELECT 1 FROM fan WHERE fanlock = CONCAT(?, ':', ?)
        )
      `;
      const params = [userid, favid, userid, favid, userid, favid];
      const result: any = await execQuery(followSQL, params);
      const affected = (result?.affectedRows ?? 0) as number;

      if (affected > 0) {
        const payload: ToggleResult = {
          ok: true,
          following: true,
          state: "followed",
          countDelta: 1,
        };
        return res.json(payload);
      }
      // race: someone else inserted
      const payload: ToggleResult = {
        ok: true,
        following: true,
        state: "already_following",
        countDelta: 0,
      };
      return res.json(payload);
    }

    // intent === "unfollow"
    if (!exists) {
      const payload: ToggleResult = {
        ok: true,
        following: false,
        state: "already_not_following",
        countDelta: 0,
      };
      return res.json(payload);
    }

    const unfollowSQL = `DELETE FROM fan WHERE fanlock = CONCAT(?, ':', ?) LIMIT 1`;
    const delResult: any = await execQuery(unfollowSQL, [userid, favid]);
    const delAffected = (delResult?.affectedRows ?? 0) as number;

    if (delAffected > 0) {
      const payload: ToggleResult = {
        ok: true,
        following: false,
        state: "unfollowed",
        countDelta: -1,
      };
      return res.json(payload);
    }

    const payload: ToggleResult = {
      ok: true,
      following: false,
      state: "already_not_following",
      countDelta: 0,
    };
    return res.json(payload);
  } catch (error) {
    console.error("fan/toggle error:", error);
    return res
      .status(500)
      .json({ ok: false, error: "Failed to toggle follow" });
  }
};

export const spendPixels = async (req: any, res: any) => {
  const { values } = req.body ?? {};
  const memberId = Number(values?.userid);
  const amount = Number(values?.amount);

  /* ----- basic validation ----- */
  if (!Number.isInteger(memberId) || memberId <= 0) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: "Amount must be positive" });
  }

  try {
    /* ----- atomic update + fetch ----- */
    // MySQL 8.0.19+ supports RETURNING; use it if available: PostImage
    // const sql = `
    //   UPDATE members
    //   SET pixels = GREATEST(COALESCE(pixels,0) - ?, 0)
    //   WHERE id = ?
    //   RETURNING pixels
    // `;
    // const rows = await execQuery(sql, [amount, memberId]);

    // Portable two-statement version:
    await execQuery("START TRANSACTION");
    await execQuery(
      `UPDATE members
       SET pixels = GREATEST(COALESCE(pixels,0) - ?, 0)
       WHERE id = ?`,
      [amount, memberId]
    );
    const [row] = await execQuery("SELECT pixels FROM members WHERE id = ?", [
      memberId,
    ]);
    await execQuery("COMMIT");

    if (!row) {
      return res.status(404).json({ error: "Member not found" });
    }

    res.json({ userid: memberId, pixels: row.pixels });
  } catch (err) {
    await execQuery("ROLLBACK");
    console.error("Error spending pixels:", err);
    res.status(500).json({ error: "Failed to spend pixels" });
  }
};

// controller --------------------------
export const getPixels = async (req: any, res: any) => {
  // read from the body, not query
  const { values } = req.body;
  const memberId = Number(values?.userid);

  if (!Number.isInteger(memberId) || memberId <= 0) {
    return res.status(400).json({ error: "Invalid member id" });
  }

  try {
    const rows = (await execQuery("SELECT pixels FROM members WHERE id = ?", [
      memberId,
    ])) as { pixels: number }[];

    if (rows.length === 0) {
      return res.status(404).json({ error: "Member not found" });
    }

    res.json({ userid: memberId, pixels: rows[0].pixels ?? 0 });
  } catch (err) {
    console.error("Error fetching pixels:", err);
    res.status(500).json({ error: "Failed to fetch pixels" });
  }
};

export const addpixels = async (req: Request, res: any): Promise<void> => {
  const { values } = req.body;
  const { userid, pixels } = values; // pixels = amount to add (e.g. 200)

  try {
    // â¬‡ï¸ increment, donâ€™t overwrite
    const sql = `
      UPDATE members
      SET pixels = COALESCE(pixels, 0) + ?     -- add the incoming amount
      WHERE id = ?
    `;

    const params = [pixels, userid]; // [amountToAdd, memberId]

    await execQuery(sql, params);
    res.json({ message: "Pixels added successfully" });
  } catch (error) {
    console.error("Error adding pixels:", error);
    res.status(500).json({ error: "Failed to add pixels" });
  }
};

export const addpixelsx = async (
  userid: string,
  pixels: number
): Promise<void> => {
  try {
    // â¬‡ï¸ increment, donâ€™t overwrite
    const sql = `
      UPDATE members
      SET pixels = COALESCE(pixels, 0) + ?     -- add the incoming amount
      WHERE id = ?
    `;

    const params = [pixels, userid]; // [amountToAdd, memberId]

    await execQuery(sql, params);
    /// res.json({ message: "Pixels added successfully" });
  } catch (error) {
    console.error("Error adding pixels:", error);
    ///  res.status(500).json({ error: "Failed to add pixels" });
  }
};

export const getSearchMore = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  console.log(values.lastId);

  if (values) {
    try {
      var chronologicaldata: any = null;

      if (values.override) {
        chronologicaldata = await execQuery(postRankHistory, [
          values.id,
          values.id2,
          values.typex,
          values.lastId,
          values.searchData,
          values.searchData,
        ]);
      } else {
        chronologicaldata = await execQuery(postRankMore, [
          values.id,
          values.id2,
          values.typex,
          values.lastId,
          values.searchData,
          values.searchData,
        ]);
      }

      ///console.log(chronologicaldata[7].favCount);
      return res.send({
        ///gettingcookie: userSessionData,
        message: "feeds fetched",
        payload: chronologicaldata,
        postPageLimit: values.lastId,
      });
    } catch (e: any) {
      //console.log(e)
      return res.send({ message: "error in fetching feeds" });
    }
  }
};
export const getSearch = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  //console.log(values);

  if (values) {
    try {
      const chronologicaldata = await execQuery(postRank, [
        values.id,
        values.id2,
        values.typex,
        values.searchData,
        values.searchData,
      ]);

      ///console.log(chronologicaldata[7].favCount);
      return res.send({
        ///gettingcookie: userSessionData,
        message: "feeds fetched",
        payload: chronologicaldata,
        postPageLimit: 0,
      });
    } catch (e: any) {
      //console.log(e)
      return res.send({ message: "error in fetching feeds" });
    }
  }
};

export const getFeedsMore = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  console.log(values.lastId);

  if (values) {
    try {
      var chronologicaldata: any = null;

      if (values.override) {
        chronologicaldata = await execQuery(postsxMoreO, [
          values.id,
          values.id,
          values.lastId,
        ]);
      } else {
        chronologicaldata = await execQuery(postsxMore, [
          values.id,
          values.id,
          values.lastId,
        ]);
      }

      ///console.log(chronologicaldata[7].favCount);
      return res.send({
        ///gettingcookie: userSessionData,
        message: "feeds fetched",
        payload: chronologicaldata,
        postPageLimit: values.lastId,
      });
    } catch (e: any) {
      //console.log(e)
      return res.send({ message: "error in fetching feeds" });
    }
  }
};

export const getFeedClikmore = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  console.log(values.lastId);

  if (values) {
    try {
      var chronologicaldata: any = null;

      if (values.override) {
        chronologicaldata = await execQuery(postsxMoreOClik, [
          values.id,
          values.id2,
          values.lastId,
        ]);
      } else {
        chronologicaldata = await execQuery(postsxMoreClik, [
          values.id,
          values.id2,
          values.lastId,
        ]);
      }

      ///console.log(chronologicaldata[7].favCount);
      return res.send({
        ///gettingcookie: userSessionData,
        message: "feeds fetched",
        payload: chronologicaldata,
        postPageLimit: values.lastId,
      });
    } catch (e: any) {
      //console.log(e)
      return res.send({ message: "error in fetching feeds" });
    }
  }
};

// SQL to insert a Character
const insertCharacterSQL = `
    INSERT INTO characters (world_id, name, description, image)
    VALUES (?, ?, ?, ?)
`;

// SQL to insert the World Model
const insertWorldModelSQL = `
    INSERT INTO world_models (post_id, selected_style,userid, title,cover, description, blueprint, original_prompt, planx)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export const createWorldModel = async (
  req: Request,
  res: any
): Promise<any> => {
  // Destructure the payload sent from frontend "worldPayload"
  const {
    PostId,
    selectedStyle,
    title,
    description,
    blueprint,
    originalPrompt,
    planx,
    cover,
    userid,
  } = req.body;

  try {
    // Ensure planx is a string for the JSON column if your driver requires it
    const planxData = typeof planx === "object" ? JSON.stringify(planx) : planx;

    const result: any = await execQuery(insertWorldModelSQL, [
      PostId, // Inserted as INT
      selectedStyle, // Inserted as VARCHAR
      userid,
      title,
      cover,
      description,
      blueprint,
      originalPrompt,
      planxData,
    ]);

    // Retrieve the new Auto-Increment ID
    const newId = result.insertId;

    return res.send({
      message: "World model created successfully",
      id: newId,
      insertId: newId,
    });
  } catch (e: any) {
    console.error("Create World Error:", e);
    return res.status(500).send({ message: "Error creating world model" });
  }
};

export const createCharacter = async (req: Request, res: any): Promise<any> => {
  // Destructure the payload sent from frontend inside the loop
  const { world_id, name, description, image } = req.body;

  if (!world_id) {
    return res.status(400).send({ message: "Missing world_id" });
  }

  try {
    await execQuery(insertCharacterSQL, [world_id, name, description, image]);

    return res.send({
      message: "Character created successfully",
    });
  } catch (e: any) {
    console.error("Create Character Error:", e);
    return res.status(500).send({ message: "Error creating character" });
  }
};

interface WorldRow {
  id: number;
  userid: number;
  title: string;
  description: string;
  cover: string | null;
  blueprint: string;
  original_prompt: string;
  planx: any;
  created_at: Date;
  updated_at: Date;
  post_id: number;
  selected_style: string;
  // Character columns
  char_id: number | null;
  char_name: string | null;
  char_description: string | null;
  char_image: string | null;
}
export const getAllWorldsWithCharacters = async (
  req: Request,
  res: any
): Promise<any> => {
  // 1. Get Params
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const offset = (page - 1) * limit;

  // REMOVED: UserID check. We now want ALL users.

  try {
    // 2. The Optimized SQL Query
    // We select ALL world_models in the subquery first to handle pagination correctly.
    // Then we join the characters to those specific worlds.
    const sql = `
      SELECT
        w.*,
        c.id as char_id,
        c.name as char_name,
        c.description as char_description,
        c.image as char_image
      FROM (
        SELECT * FROM world_models
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      ) as w
      LEFT JOIN characters c ON w.id = c.world_id
      ORDER BY w.created_at DESC, c.id ASC;
    `;

    // 3. Count Total (Global count, not per user)
    const countSql = `SELECT COUNT(*) as total FROM world_models`;

    const [rows, countResult] = await Promise.all([
      execQuery(sql, [limit, offset]), // Params updated: no userid
      execQuery(countSql, []), // Params updated: no userid
    ]);

    // 4. Grouping Logic
    const worldsMap = new Map<number, any>();

    (rows as WorldRow[]).forEach((row) => {
      if (!worldsMap.has(row.id)) {
        worldsMap.set(row.id, {
          id: row.id,
          userid: row.userid, // This will now vary per row
          title: row.title,
          description: row.description,
          cover: row.cover,
          blueprint: row.blueprint,
          original_prompt: row.original_prompt,
          planx:
            typeof row.planx === "string" ? JSON.parse(row.planx) : row.planx,
          created_at: row.created_at,
          post_id: row.post_id,
          selected_style: row.selected_style,
          characters: [],
        });
      }

      if (row.char_id) {
        worldsMap.get(row.id).characters.push({
          id: row.char_id,
          name: row.char_name,
          description: row.char_description,
          image: row.char_image,
        });
      }
    });

    const data = Array.from(worldsMap.values());
    const total = countResult[0]?.total || 0;

    return res.send({
      message: "All worlds fetched successfully",
      data: data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e: any) {
    console.error("Get All Worlds Error:", e);
    return res.status(500).send({ message: "Error fetching worlds" });
  }
};

export const getAllWorldsWithCharactersUser = async (
  req: Request,
  res: any
): Promise<any> => {
  // 1. Get Params
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const userid = parseInt(req.query.userid as string); // Get userid from query
  const offset = (page - 1) * limit;

  if (!userid) {
    return res.status(400).send({ message: "Missing userid" });
  }

  try {
    // 2. The Optimized SQL Query
    // We filter by userid inside the subquery to ensure pagination is correct for THIS user.
    const sql = `
      SELECT
        w.*,
        c.id as char_id,
        c.name as char_name,
        c.description as char_description,
        c.image as char_image
      FROM (
        SELECT * FROM world_models
        WHERE userid = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      ) as w
      LEFT JOIN characters c ON w.id = c.world_id
      ORDER BY w.created_at DESC, c.id ASC;
    `;

    // 3. Count Total for User
    const countSql = `SELECT COUNT(*) as total FROM world_models WHERE userid = ?`;

    const [rows, countResult] = await Promise.all([
      execQuery(sql, [userid, limit, offset]),
      execQuery(countSql, [userid]),
    ]);

    // 4. Grouping Logic
    const worldsMap = new Map<number, any>();

    (rows as WorldRow[]).forEach((row) => {
      if (!worldsMap.has(row.id)) {
        worldsMap.set(row.id, {
          id: row.id,
          userid: row.userid,
          title: row.title,
          description: row.description,
          cover: row.cover, // Ensure this column exists in DB
          blueprint: row.blueprint,
          original_prompt: row.original_prompt,
          planx:
            typeof row.planx === "string" ? JSON.parse(row.planx) : row.planx,
          created_at: row.created_at,
          post_id: row.post_id,
          selected_style: row.selected_style,
          characters: [],
        });
      }

      if (row.char_id) {
        worldsMap.get(row.id).characters.push({
          id: row.char_id,
          name: row.char_name,
          description: row.char_description,
          image: row.char_image,
        });
      }
    });

    const data = Array.from(worldsMap.values());
    const total = countResult[0]?.total || 0;

    return res.send({
      message: "Worlds fetched successfully",
      data: data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e: any) {
    console.error("Get All Worlds Error:", e);
    return res.status(500).send({ message: "Error fetching worlds" });
  }
};

export const getFeedClik = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  //console.log(values);

  if (values) {
    try {
      const chronologicaldata = await execQuery(postsxClik, [
        values.id,
        values.id2,
      ]);

      ///console.log(chronologicaldata[7].favCount);
      return res.send({
        ///gettingcookie: userSessionData,
        message: "feeds fetched",
        payload: chronologicaldata,
        postPageLimit: 0,
      });
    } catch (e: any) {
      //console.log(e)
      return res.send({ message: "error in fetching feeds" });
    }
  }
};
export const getFeeds = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  //console.log(values);

  if (values) {
    try {
      const chronologicaldata = await execQuery(postsx, [values.id, values.id]);

      ///console.log(chronologicaldata[7].favCount);
      return res.send({
        ///gettingcookie: userSessionData,
        message: "feeds fetched",
        payload: chronologicaldata,
        postPageLimit: 0,
      });
    } catch (e: any) {
      //console.log(e)
      return res.send({ message: "error in fetching feeds" });
    }
  }
};

export const getFeedsMoreStory = async (
  req: Request,
  res: any
): Promise<any> => {
  const { values } = req.body;

  console.log(values.lastId);

  if (values) {
    try {
      var chronologicaldata: any = null;

      if (values.override) {
        chronologicaldata = await execQuery(postsxMoreStoryO, [
          values.id,
          values.id,
          values.lastId,
        ]);
      } else {
        chronologicaldata = await execQuery(postsxMoreStory, [
          values.id,
          values.id,
          values.lastId,
        ]);
      }

      ///console.log(chronologicaldata[7].favCount);
      return res.send({
        ///gettingcookie: userSessionData,
        message: "feeds fetched",
        payload: chronologicaldata,
        postPageLimit: values.lastId,
      });
    } catch (e: any) {
      //console.log(e)
      return res.send({ message: "error in fetching feeds" });
    }
  }
};

export const getFeedsFeeds = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  //console.log(values);

  if (values) {
    try {
      const chronologicaldata = await execQuery(postsxFeeds, [
        values.id,
        values.id2,
      ]);

      ///console.log(chronologicaldata[7].favCount);
      return res.send({
        ///gettingcookie: userSessionData,
        message: "feeds fetched",
        payload: chronologicaldata,
        postPageLimit: 0,
      });
    } catch (e: any) {
      //console.log(e)
      return res.send({ message: "error in fetching feeds" });
    }
  }
};

export const getFeedsMoreFeeds = async (
  req: Request,
  res: any
): Promise<any> => {
  const { values } = req.body;

  console.log(values.lastId);

  if (values) {
    try {
      var chronologicaldata: any = null;

      if (values.override) {
        chronologicaldata = await execQuery(postsxMoreFeedsO, [
          values.id,
          values.id2,
          values.lastId,
        ]);
      } else {
        chronologicaldata = await execQuery(postsxMoreFeeds, [
          values.id,
          values.id2,
          values.lastId,
        ]);
      }

      ///console.log(chronologicaldata[7].favCount);
      return res.send({
        ///gettingcookie: userSessionData,
        message: "feeds fetched",
        payload: chronologicaldata,
        postPageLimit: values.lastId,
      });
    } catch (e: any) {
      //console.log(e)
      return res.send({ message: "error in fetching feeds" });
    }
  }
};

export const getFeedsStory = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  //console.log(values);

  if (values) {
    try {
      const chronologicaldata = await execQuery(postsxStory, [
        values.id,
        values.id,
      ]);

      ///console.log(chronologicaldata[7].favCount);
      return res.send({
        ///gettingcookie: userSessionData,
        message: "feeds fetched",
        payload: chronologicaldata,
        postPageLimit: 0,
      });
    } catch (e: any) {
      //console.log(e)
      return res.send({ message: "error in fetching feeds" });
    }
  }
};

// -----------------------------------------------------------------------------
//  Controller:  POST /InsertPostSearch
// -----------------------------------------------------------------------------
export const InsertPostSearch = async (req: any, res: any): Promise<any> => {
  const { postId, caption, tags, categories } = req.body as {
    postId: number;
    caption: string;
    tags: any; // â† arrays coming from front end
    categories: any;
  };

  /* ---------- basic validation -------------------------------- */
  if (!postId || !caption) {
    return res
      .status(400)
      .json({ message: "Body must contain { postId, caption }" });
  }

  /* ---------- flatten arrays --------------------------------- */
  const tagStr = Array.isArray(tags) ? tags.join(" ") : "";
  const catStr = Array.isArray(categories) ? categories.join(" ") : "";

  try {
    await execQuery(createPostSearch, [postId, caption, tagStr, catStr]);
    return res.json({ message: "post_search row saved", postId });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: "post_search insert failed" });
  }
};

export const PostImage = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  var currentTime = new Date();

  ///console.log(values.rad1);
  try {
    const result = await execQuery(createpostX, [
      values.id,
      1,
      "", ////topic
      values.caption,
      values.imagehd,
      "",
      currentTime,
      1,
      values.kontext,
      values.prompt,
      values.model,
      values.ratio,
    ]);

    const insertedId = result.insertId;

    return res.send({ go: insertedId, message: "images uploaded" });
  } catch (e: any) {
    console.log(e);
    return res.send({ message: "images upload failed" });
  }

  console.log(values);
};

export const callmusic = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  ///console.log(values.rad1);
  try {
    const result = await execQuery(callsong);

    return res.send({ allsongs: result, message: "images uploaded" });
  } catch (e: any) {
    console.log(e);
    return res.send({ message: "images upload failed" });
  }

  console.log(values);
};

export const SaveMusic = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  ///console.log(values.rad1);
  try {
    const result = await execQuery(createsong, [
      values.id,
      values.audio,
      values.AudioName,
    ]);

    const insertedId = result.insertId;

    return res.send({ go: insertedId, message: "images uploaded" });
  } catch (e: any) {
    console.log(e);
    return res.send({ message: "images upload failed" });
  }

  console.log(values);
};
export const PostStory = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;
  const currentTime = new Date();

  const isStoryMode = Number(values?.mode) === 1;

  const SCENES = 9;
  const INPUT_MAX = isStoryMode ? SCENES * 2 : SCENES; // 18 in story mode, 9 otherwise

  const buildStageArrays = (prefix: string) => {
    const normal = Array(SCENES).fill(null);
    const B = Array(SCENES).fill(null);

    for (let i = 1; i <= INPUT_MAX; i++) {
      const v = values?.[`${prefix}${i}`] ?? null;
      if (!v) continue;

      if (!isStoryMode) {
        // non-story: 1..9 -> scene 1..9
        normal[i - 1] = v;
        continue;
      }

      // story: (1,2)->scene1 ; (3,4)->scene2 ; ... (17,18)->scene9
      const sceneIdx = Math.ceil(i / 2) - 1; // 0..8
      const isStage2 = i % 2 === 0; // 2,4,6...18 -> B

      if (!isStage2) normal[sceneIdx] = v;
      // stage1
      else B[sceneIdx] = v; // stage2
    }

    return { normal, B };
  };

  const { normal: images, B: imagesB } = buildStageArrays("image");
  const { normal: imagesHd, B: imagesHdB } = buildStageArrays("imageHd");
  const { normal: txts, B: txtsB } = buildStageArrays("txt");
  const { normal: gent, B: gentB } = buildStageArrays("GeneratedText");

  try {
    const result = await execQuery(createpostXStory, [
      values.id || null,
      1,
      values.topic || "",
      values.caption || "",
      values.image1,
      "",

      // IMPORTANT: createpostXStory INSERT must match this exact order:
      ...images,
      ...imagesB,

      ...imagesHd,
      ...imagesHdB,

      ...txts,
      ...txtsB,

      currentTime,
      1,
      values.mode || 0,

      ...gent,
      ...gentB,

      values.kontext,
      values.prompt,
      values.model,
      values.ratio,
    ]);

    return res.send({ go: result.insertId, message: "images uploaded" });
  } catch (error) {
    console.error(error);
    return res.send({ message: "images upload failed" });
  }
};

export const getProfile = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  //console.log(values);

  if (values) {
    try {
      const chronologicaldata = await execQuery(profile, [
        values.id3,
        values.id3,
        values.id,
      ]);

      ///console.log(chronologicaldata[7].favCount);
      return res.send({
        ///gettingcookie: userSessionData,
        message: "feeds fetched",
        payload: chronologicaldata,
        postPageLimit: 0,
      });
    } catch (e: any) {
      //console.log(e)
      return res.send({ message: "error in fetching feeds" });
    }
  }
};

export const getProfileMore = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  //console.log(values);

  if (values) {
    try {
      var chronologicaldata: any = null;

      if (values.override) {
        chronologicaldata = await execQuery(profile_moreO, [
          values.id3,
          values.id3,
          values.id,
          values.lastId,
        ]);
      } else {
        chronologicaldata = await execQuery(profile_more, [
          values.id3,
          values.id3,
          values.id,
          values.lastId,
        ]);
      }

      ///console.log(chronologicaldata[7].favCount);
      return res.send({
        ///gettingcookie: userSessionData,
        message: "feeds fetched",
        payload: chronologicaldata,
        postPageLimit: 0,
      });
    } catch (e: any) {
      //console.log(e)
      return res.send({ message: "error in fetching feeds" });
    }
  }
};

/**
 * POST /interactionsave
 * Body: { values: { id, mode, mainSrc, subs:{left,right}, touchConfig:{hotspots[]}, userId? } }
 */

export const audioSave = async (req: any, res: any): Promise<void> => {
  const { values } = req.body || {};
  const { id, identifier, audioUrl } = values || {};

  // Basic validation
  if (!id) {
    res.status(400).json({ error: "`id` is required" });
    return;
  }
  if (![0, 1, 2].includes(Number(identifier))) {
    res.status(400).json({ error: "`identifier` must be 0 | 1 | 2" });
    return;
  }
  // Allow null to clear column (optional). If you want to forbid, check for string.
  const urlValue = audioUrl ?? null;

  // Whitelist column name based on identifier to avoid SQL injection
  const column =
    Number(identifier) === 0
      ? "mainaud"
      : Number(identifier) === 1
      ? "sub1aud"
      : "sub2aud";

  const sql = `
    UPDATE posts
    SET ${column} = ?
    WHERE id = ?
  `;

  try {
    await execQuery(sql, [urlValue, id]);
    res.json({ message: "Audio URL saved", id, column, audioUrl: urlValue });
  } catch (err) {
    console.error("âŒ audioSave failed:", err);
    res.status(500).json({ error: "DB update failed" });
  }
};

export const interactionSave = async (req: any, res: any): Promise<void> => {
  const { values } = req.body;

  if (!values?.id) {
    res.status(400).json({ error: "`id` is required" });
    return;
  }

  const {
    id, // post id
    mode, // 1 touch / 2 swipe (from frontend)
    mainSrc,
    intbg,
    subs = {}, // { left, right }
    audio = {}, // { main, left, right }  â† can be string | array | nested
    touchConfig = {}, // { hotspots, tree }  â† full config
  } = values;

  // ---- helper: normalize audio to a single URL or null --------------------
  const normalizeAudioField = (field: any): string | null => {
    if (!field) return null;

    // If it's already a string
    if (typeof field === "string") {
      const trimmed = field.trim();
      return trimmed.length ? trimmed : null;
    }

    // If it's an array (possibly nested: [[], ["url"], ["a","b"]...])
    if (Array.isArray(field)) {
      // Flatten deeply & pick first non-empty string
      const flat = field
        .flat(Infinity)
        .filter((v: any) => typeof v === "string" && v.trim().length > 0);
      return flat.length ? flat[0] : null;
    }

    // Anything else -> ignore
    return null;
  };

  // ---- 1. Resolve left / right hotspots (still used for legacy columns) ---
  const hotspotL =
    touchConfig?.hotspots?.find((h: any) => h?.id === "left") || {};
  const hotspotR =
    touchConfig?.hotspots?.find((h: any) => h?.id === "right") || {};

  // ---- 2. Flatten / JSONify new data --------------------------------------

  // flat root audio (strings or null) â€“ **now safely normalized**
  const audioMain = normalizeAudioField(audio.main);
  const audioLeft = normalizeAudioField(audio.left);
  const audioRight = normalizeAudioField(audio.right);

  // full touch config (hotspots + tree) as JSON
  const touchConfigJson =
    touchConfig && Object.keys(touchConfig).length > 0
      ? JSON.stringify(touchConfig)
      : null;

  // ---- 3. Build UPDATE (parameterized â€“ no raw string interpolation) ------
  const sql = `
    UPDATE posts
    SET
      mode     = ?,               -- 1/2 from FE (here you're forcing 2)
      main     = ?,               -- main video
      inttype  = ?,               -- store "swipe"/"touch" or whatever you're using
      subl     = ?,               -- left sub-video
      subr     = ?,               -- right sub-video

      touchl   = 'left',
      touchlx  = ?,               -- left hotspot x
      touchly  = ?,               -- y
      touchlr  = ?,               -- r

      touchr   = 'right',
      touchrx  = ?,               -- right hotspot x
      touchry  = ?,               -- y
      touchrr  = ?,               -- r


      interaction_audio_main  = ?, -- NEW
      interaction_audio_left  = ?, -- NEW
      interaction_audio_right = ?, -- NEW
      touch_config_json       = ?,  -- NEW (full tree)
      intbg = ?

    WHERE id = ?
  `;

  const params = [
    2, // mode column (youâ€™re forcing mode=2 here)
    mainSrc || null, // main
    mode || null, // inttype (1/2 from FE)
    subs.left || null, // subl
    subs.right || null, // subr

    hotspotL.x ?? null,
    hotspotL.y ?? null,
    hotspotL.r ?? null,

    hotspotR.x ?? null,
    hotspotR.y ?? null,
    hotspotR.r ?? null,

    audioMain, // normalized string | null
    audioLeft, // normalized string | null
    audioRight, // normalized string | null
    touchConfigJson,
    intbg,

    id,
  ];

  try {
    await execQuery(sql, params);
    res.json({ message: "Interaction saved" });
  } catch (err) {
    console.error("âŒ interactionSave failed:", err);
    res.status(500).json({ error: "DB update failed" });
  }
};

export const AudioDb = async (req: Request, res: any): Promise<void> => {
  const { values } = req.body;

  // Extract needed fields from the incoming 'values'
  const {
    postId,
    captionSummary,
    captionAudio, // note the front-end calls it "cationAudio"; we map that to "captionAudio" in DB
    x1,
    x2,
    x3,
    x4,
    x5, // optional: if you have a fifth audio, otherwise pass null
    x6,
    x7,
    x8,
    videourl,
    vidoriginal,
  } = values;

  ///console.log("video uuurl", postId);

  try {
    // Construct the UPDATE statement for the columns we want to change
    // We assume the table's primary key is 'id', so we match WHERE id = ?
    const sql = `
      UPDATE posts
      SET
        captionSummary = ?,
        captionAudio   = ?,
        xa1 = ?,
        xa2 = ?,
        xa3 = ?,
        xa4 = ?,
        xa5 = ?,
        xa6 = ?,
        xa7 = ?,
        xa8 = ?,
        video = 1,
        videoUrl = ?,
       nobgmvideo = ?
      WHERE id = ?
    `;

    // We'll pass x1 -> xa1, x2 -> xa2, etc.
    const params = [
      captionSummary,
      captionAudio,
      x1, // goes to xa1
      x2, // goes to xa2
      x3, // goes to xa3
      x4, // goes to xa4
      x5, // If you don't have x5, pass null
      x6, // goes to xa6
      x7, // goes to xa7
      x8, // goes to xa8
      videourl,
      vidoriginal,
      postId, // condition in WHERE clause
    ];

    await execQuery(sql, params);

    res.json({ message: "Audio data updated successfully" });
  } catch (error) {
    console.error("Error updating audio data:", error);
    res.status(500).json({ error: "Failed to update audio data" });
  }
};

export const profileInfo = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  //console.log(values);

  if (values) {
    try {
      const chronologicaldata = await execQuery(profilePage, [values.memberId]);

      ///console.log(chronologicaldata[7].favCount);
      return res.send({
        ///gettingcookie: userSessionData,
        message: "profile fetched",
        payload: chronologicaldata,
        postPageLimit: 0,
      });
    } catch (e: any) {
      //console.log(e)
      return res.send({ message: "error in fetching feeds" });
    }
  }
};

export const ProfilePic = async (req: Request, res: any): Promise<void> => {
  const { values } = req.body;

  // Extract needed fields from the incoming 'values'
  const { id, images, imagesT } = values;

  try {
    const sql = `
      UPDATE members
      SET
    profile_image = ?,
    profile_image_thumb   = ?
      WHERE id = ?
    `;

    // We'll pass x1 -> xa1, x2 -> xa2, etc.
    const params = [
      images,
      imagesT,
      id, // condition in WHERE clause
    ];

    await execQuery(sql, params);

    res.json({ message: "profile pic updated successfully" });
  } catch (error) {
    console.error("Error updating audio data:", error);
    res.status(500).json({ error: "Failed to update audio data" });
  }
};

export const billPic = async (req: Request, res: any): Promise<void> => {
  const { values } = req.body;

  // Extract needed fields from the incoming 'values'
  const { id, images, imagesT } = values;

  try {
    const sql = `
      UPDATE members
      SET
    billboard1= ?,
    billboardthumb1   = ?
      WHERE id = ?
    `;

    // We'll pass x1 -> xa1, x2 -> xa2, etc.
    const params = [
      images,
      imagesT,
      id, // condition in WHERE clause
    ];

    await execQuery(sql, params);

    res.json({ message: "bill pic updated successfully" });
  } catch (error) {
    console.error("Error updating audio data:", error);
    res.status(500).json({ error: "Failed to update audio data" });
  }
};

export const VideoDb = async (req: Request, res: any): Promise<void> => {
  const { values } = req.body;

  const postId = values?.postId;
  const vid = values?.vid;

  // type can be 0..8 (normal) OR 0..17 (story doubled)
  const typeRaw = Number(values?.type);

  // mode === 1 means story (based on your PostStory logic)
  const mode = Number(values?.mode);

  try {
    if (!postId || typeof vid !== "string") {
      return res.status(400).json({ error: "Missing postId or vid" });
    }

    if (!Number.isFinite(typeRaw) || typeRaw < 0) {
      return res.status(400).json({ error: "Invalid type" });
    }

    const colsA = [
      "xv1",
      "xv2",
      "xv3",
      "xv4",
      "xv5",
      "xv6",
      "xv7",
      "xv8",
      "xv9",
    ] as const;
    const colsB = [
      "xv1B",
      "xv2B",
      "xv3B",
      "xv4B",
      "xv5B",
      "xv6B",
      "xv7B",
      "xv8B",
      "xv9B",
    ] as const;

    let idx = 0; // 0..8
    let useB = false; // stage2 in story => B

    if (mode === 1) {
      // story doubled: 0..17 => scene is floor(type/2), stage2 is odd => B
      idx = Math.floor(typeRaw / 2);
      useB = typeRaw % 2 === 1;

      if (idx < 0 || idx > 8 || typeRaw > 17) {
        return res
          .status(400)
          .json({ error: "Invalid type for story mode (expected 0..17)" });
      }
    } else {
      // normal: expect 0..8
      idx = typeRaw;

      if (idx < 0 || idx > 8) {
        return res
          .status(400)
          .json({ error: "Invalid type for normal mode (expected 0..8)" });
      }
    }

    const col = useB ? colsB[idx] : colsA[idx];

    const sql = `UPDATE posts SET ${col}=? WHERE id=?`;
    await execQuery(sql, [vid, postId]);

    return res.json({
      message: "Video updated successfully",
      column: col,
      scene: idx + 1,
      stage: mode === 1 ? (useB ? 2 : 1) : 1,
    });
  } catch (error) {
    console.error("Error updating video:", error);
    return res.status(500).json({ error: "Failed to update video" });
  }
};

export const ImageDb = async (req: Request, res: any): Promise<void> => {
  const { values } = req.body;

  const postId = values?.postId;
  const img = values?.img;

  // type can be 0..8 (normal) OR 0..17 (story doubled)
  const typeRaw = Number(values?.type);

  // mode === 1 means story (based on your PostStory logic)
  const mode = Number(values?.mode);

  try {
    if (!postId || typeof img !== "string") {
      return res.status(400).json({ error: "Missing postId or img" });
    }

    if (!Number.isFinite(typeRaw) || typeRaw < 0) {
      return res.status(400).json({ error: "Invalid type" });
    }

    const colsA = [
      "xh1",
      "xh2",
      "xh3",
      "xh4",
      "xh5",
      "xh6",
      "xh7",
      "xh8",
      "xh9",
    ] as const;
    const colsB = [
      "xh1B",
      "xh2B",
      "xh3B",
      "xh4B",
      "xh5B",
      "xh6B",
      "xh7B",
      "xh8B",
      "xh9B",
    ] as const;

    let idx = 0; // 0..8
    let useB = false; // stage2 in story => B

    if (mode === 1) {
      // story doubled: 0..17 => scene is floor(type/2), stage2 is odd => B
      idx = Math.floor(typeRaw / 2);
      useB = typeRaw % 2 === 1;

      if (idx < 0 || idx > 8 || typeRaw > 17) {
        return res
          .status(400)
          .json({ error: "Invalid type for story mode (expected 0..17)" });
      }
    } else {
      // normal: expect 0..8
      idx = typeRaw;

      if (idx < 0 || idx > 8) {
        return res
          .status(400)
          .json({ error: "Invalid type for normal mode (expected 0..8)" });
      }
    }

    const col = useB ? colsB[idx] : colsA[idx];

    const sql = `UPDATE posts SET ${col}=? WHERE id=?`;
    await execQuery(sql, [img, postId]);

    return res.json({
      message: "Image updated successfully",
      column: col,
      scene: idx + 1,
      stage: mode === 1 ? (useB ? 2 : 1) : 1,
    });
  } catch (error) {
    console.error("Error updating image:", error);
    return res.status(500).json({ error: "Failed to update image" });
  }
};

export const BShotTruthDb = async (req: Request, res: any): Promise<void> => {
  const { values } = req.body;
  const postId = values?.postId;
  const bshot = values?.bshot;

  try {
    if (!postId || typeof bshot !== "string") {
      return res.status(400).json({ error: "Missing postId or bshot" });
    }

    const sql = `UPDATE posts SET bshot=? WHERE id=?`;
    await execQuery(sql, [bshot, postId]);

    return res.json({ message: "BShot truth updated successfully" });
  } catch (error) {
    console.error("Error updating bshot truth:", error);
    return res.status(500).json({ error: "Failed to update bshot truth" });
  }
};

export const saveInteractiveVideo = async (
  req: any,
  res: any
): Promise<void> => {
  console.log("â–¶ï¸ saveInteractiveVideo payload:", req.body);
  try {
    const { Thumbnail, mainVideoUrl, interactions = [], id: sender } = req.body;

    const slot1 = interactions.find((i: any) => i.slot === 1) || {};
    const slot2 = interactions.find((i: any) => i.slot === 2) || {};

    const params = [
      sender, // `sender`
      1, // `post_count`
      "", // `topic`
      "", // `caption`
      Thumbnail || "", // `item1`
      new Date(), // `time`
      mainVideoUrl || "", // `mainint`
      slot1.assetUrl || "", // `int1`
      slot1.ts || 0, // `inttime1`
      slot1.normX || 0, // `intx1`
      slot1.normY || 0, // `inty1`
      slot2.assetUrl || "", // `int2`
      slot2.ts || 0, // `inttime2`
      slot2.normX || 0, // `intx2`
      slot2.normY || 0, // `inty2`
      2,
    ];

    const sql = `
      INSERT INTO posts (
        \`sender\`,
        \`post_count\`,
        \`topic\`,
        \`caption\`,
        \`item1\`,
        \`time\`,
        \`mainint\`,
        \`int1\`,
        \`inttime1\`,
        \`intx1\`,
        \`inty1\`,
        \`int2\`,
        \`inttime2\`,
        \`intx2\`,
        \`inty2\`,
        \`mode\`
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;

    await execQuery(sql, params);

    res.json({ message: "Interactive video saved successfully" });
  } catch (error: any) {
    console.error("âŒ saveInteractiveVideo error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

export const getFeedClikx = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  //console.log(values);

  if (values) {
    try {
      const chronologicaldata = await execQuery(postsxStoryClik, [
        values.id,
        values.id2,
      ]);

      ///console.log(chronologicaldata[7].favCount);
      return res.send({
        ///gettingcookie: userSessionData,
        message: "feeds fetched",
        payload: chronologicaldata,
        postPageLimit: 0,
      });
    } catch (e: any) {
      //console.log(e)
      return res.send({ message: "error in fetching feeds" });
    }
  }
};

export const Thumb = async (req: Request, res: any): Promise<void> => {
  const { values } = req.body;

  // Extract needed fields from the incoming 'values'
  const { postId, finalUrl, caption } = values;

  try {
    // Construct the UPDATE statement for the columns we want to change
    // We assume the table's primary key is 'id', so we match WHERE id = ?
    const sql = `
      UPDATE posts
      SET
       x1=?,
        caption=?
      WHERE id = ?
    `;

    // We'll pass x1 -> xa1, x2 -> xa2, etc.
    const params = [
      finalUrl,
      caption,
      postId, // condition in WHERE clause
    ];

    await execQuery(sql, params);

    res.json({ message: "thumbnail updated successfully" });
  } catch (error) {
    console.error("Error updating audio data:", error);
    res.status(500).json({ error: "Failed to update audio data" });
  }
};

export const Cap = async (req: Request, res: any): Promise<void> => {
  const { values } = req.body;

  // Extract needed fields from the incoming 'values'
  const { postId, caption } = values;

  try {
    // Construct the UPDATE statement for the columns we want to change
    // We assume the table's primary key is 'id', so we match WHERE id = ?
    const sql = `
      UPDATE posts
      SET
       caption=?
      WHERE id = ?
    `;

    // We'll pass x1 -> xa1, x2 -> xa2, etc.
    const params = [
      caption,
      postId, // condition in WHERE clause
    ];

    await execQuery(sql, params);

    res.json({ message: "caption updated successfully" });
  } catch (error) {
    console.error("Error updating audio data:", error);
    res.status(500).json({ error: "Failed to update audio data" });
  }
};

const deletePostQuery = `
  DELETE FROM posts
  WHERE id = ?
`;

export const deletePost = async (
  req: Request<{}, {}, { postId?: number }>,
  res: ExpressResponse // <- now the right type
): Promise<void> => {
  const { postId } = req.body;
  if (!postId) {
    res.status(400).json({ error: "Missing `postId` in request body." });
    return;
  }

  try {
    const result: any = await execQuery(deletePostQuery, [postId]);

    if (result.affectedRows === 0) {
      res.status(404).json({ message: "Post not found." });
      return;
    }

    console.log(`Deleted post id=${postId}`);
    res.json({ message: "Post deleted.", postId });
  } catch (err: any) {
    console.error("deletePost error:", err);
    res.status(500).json({ error: "Failed to delete post." });
  }
};

const deletePostQueryx = `
UPDATE posts
SET nobgmvideo = NULL
WHERE id = ?;

`;

export const deletePostnobg = async (
  req: Request<{}, {}, { postId?: number }>,
  res: ExpressResponse // <- now the right type
): Promise<void> => {
  const { postId } = req.body;
  if (!postId) {
    res.status(400).json({ error: "Missing `postId` in request body." });
    return;
  }

  try {
    const result: any = await execQuery(deletePostQueryx, [postId]);

    if (result.affectedRows === 0) {
      res.status(404).json({ message: "Post not found." });
      return;
    }

    console.log(`Deleted post id=${postId}`);
    res.json({ message: "Post deleted.", postId });
  } catch (err: any) {
    console.error("deletePost error:", err);
    res.status(500).json({ error: "Failed to delete post." });
  }
};

// SQL for templates4prompt
const insertTemplatePromptSQL = `
    INSERT INTO templates4prompt (userid, title, template_prompt, template_image, artstyle, time)
    VALUES (?, ?, ?, ?, ?, NOW())
`;

export const createTemplatePrompt = async (req: Request, res: any): Promise<any> => {
  const { userid, title, template_prompt, template_image, artstyle } = req.body;
  console.log("Create Template Payload:", { userid, title, template_prompt, template_image, artstyle });

  if (!userid || !template_prompt) {
      return res.status(400).send({ message: "Missing required fields (userid, prompt)" });
  }

  try {
    const result: any = await execQuery(insertTemplatePromptSQL, [
      userid,
      title || "",
      template_prompt,
      template_image || "",
      artstyle || ""
    ]);
    console.log("Create Template Result:", result);

    const newId = result.insertId;

    return res.send({
      message: "Template prompt created successfully",
      id: newId,
    });
  } catch (e: any) {
    console.error("Create Template Prompt Error:", e);
    return res.status(500).send({ message: "Error creating template prompt" });
  }
};

// SQL for getting templates
const getTemplatesPromptSQL = `
    SELECT * FROM templates4prompt
    ORDER BY time DESC
    LIMIT ? OFFSET ?
`;

export const getTemplatesPrompt = async (req: Request, res: any): Promise<any> => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const results: any[] = await execQuery(getTemplatesPromptSQL, [limit, offset]);
    console.log("Get Templates Results (First 1):", results[0]);
    return res.json({ templates: results });
  } catch (e: any) {
    console.error("Get Templates Prompt Error:", e);
    return res.status(500).send({ message: "Error fetching template prompts" });
  }
};


type RagInstructionPacketMeta = {
  ragId: string;
  title: string;
};

const createBadRagRequest = (message: string): Error => {
  const error = new Error(message);
  (error as any).statusCode = 400;
  return error;
};

const normalizeRagId = (value: string): string => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

const parseRagInstructionPacket = (instructions: string): RagInstructionPacketMeta => {
  const text = String(instructions || "");
  const packetHeaderMatch = text.match(/\[RAG[^\]]*\]\s+([a-zA-Z0-9_-]+)\s+Object\s*\{/);
  const docIdMatch =
    text.match(/metadata:\s*\{[\s\S]*?docId:\s*"([^"]+)"/) ||
    packetHeaderMatch;
  const topicMatch = text.match(/topic:\s*"([^"]+)"/);
  const ragId = normalizeRagId(docIdMatch?.[1] || "");
  const title = String(topicMatch?.[1] || "").trim();

  if (!packetHeaderMatch) {
    throw createBadRagRequest("RAG instruction has an invalid packet header");
  }
  if (!ragId) {
    throw createBadRagRequest("RAG instruction is missing metadata.docId");
  }
  if (!title) {
    throw createBadRagRequest("RAG instruction is missing topic");
  }

  return { ragId, title };
};

const upsertRagInstructionSQL = `
    INSERT INTO rag_instructions (rag_id, title, instructions)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      instructions = VALUES(instructions)
`;

const getRagInstructionByIdSQL = `
    SELECT id, rag_id, title, instructions
    FROM rag_instructions
    WHERE rag_id = ?
    LIMIT 1
`;

const getRagInstructionsSQL = `
    SELECT id, rag_id, title, instructions
    FROM rag_instructions
    ORDER BY id DESC
`;

const deleteRagInstructionSQL = `
    DELETE FROM rag_instructions
    WHERE rag_id = ?
`;

export const uploadRagInstruction = async (req: Request, res: any): Promise<any> => {
  const { instructions } = req.body || {};

  if (!instructions || typeof instructions !== "string") {
    return res.status(400).send({ message: "Missing RAG instructions text" });
  }

  try {
    const { ragId, title } = parseRagInstructionPacket(instructions);

    await uploadRagInstructionToS3(ragId, instructions);

    const ragIndex = await indexRagInstruction({
      dbId: 0,
      ragId,
      title,
      instructions,
    });

    await execQuery(upsertRagInstructionSQL, [ragId, title, instructions]);

    const rows: any[] = await execQuery(getRagInstructionByIdSQL, [ragId]);
    const ragInstruction = rows[0] || { id: 0, rag_id: ragId, title, instructions };

    return res.send({
      message: "RAG instruction uploaded, indexed, and saved successfully",
      ragInstruction,
      ragIndex,
    });
  } catch (e: any) {
    console.error("Upload RAG Instruction Error:", e);
    const statusCode = e?.statusCode || 500;
    return res.status(statusCode).send({ message: e?.message || "Error uploading RAG instruction" });
  }
};

export const getRagInstructions = async (_req: Request, res: any): Promise<any> => {
  try {
    const results: any[] = await execQuery(getRagInstructionsSQL);
    return res.json({ ragInstructions: results });
  } catch (e: any) {
    console.error("Get RAG Instructions Error:", e);
    return res.status(500).send({ message: "Error fetching RAG instructions" });
  }
};

export const deleteRagInstruction = async (req: Request, res: any): Promise<any> => {
  const { ragId, confirmation } = req.body || {};
  const normalizedRagId = normalizeRagId(ragId || "");

  if (!normalizedRagId) {
    return res.status(400).send({ message: "Missing RAG id" });
  }

  if (confirmation !== "delete") {
    return res.status(400).send({ message: "Type delete to confirm RAG deletion" });
  }

  try {
    const rows: any[] = await execQuery(getRagInstructionByIdSQL, [normalizedRagId]);
    const ragInstruction = rows[0];

    if (!ragInstruction) {
      return res.status(404).send({ message: "RAG instruction not found" });
    }

    const vectorDelete = await deleteRagInstructionVectors({
      ragId: normalizedRagId,
      instructions: ragInstruction.instructions,
    });
    const s3Delete = await deleteRagInstructionFromS3(normalizedRagId);
    await execQuery(deleteRagInstructionSQL, [normalizedRagId]);

    return res.send({
      message: "RAG instruction deleted successfully",
      ragId: normalizedRagId,
      vectorDelete,
      s3Delete,
    });
  } catch (e: any) {
    console.error("Delete RAG Instruction Error:", e);
    const statusCode = e?.statusCode || 500;
    return res.status(statusCode).send({ message: e?.message || "Error deleting RAG instruction" });
  }
};

const deleteTemplatePromptSQL = `
    DELETE FROM templates4prompt
    WHERE id = ? AND userid = ?
`;

export const deleteTemplatePrompt = async (req: Request, res: any): Promise<any> => {
  const { id, userid } = req.body;
  if (!id || !userid) {
    return res.status(400).send({ message: "Missing required fields (id, userid)" });
  }
  try {
    const result: any = await execQuery(deleteTemplatePromptSQL, [id, userid]);
    if (result.affectedRows === 0) {
      return res.status(404).send({ message: "Template not found or unauthorized" });
    }
    return res.send({ message: "Template deleted successfully" });
  } catch (e: any) {
    console.error("Delete Template Error:", e);
    return res.status(500).send({ message: "Error deleting template" });
  }
};

const getArtstyleImagesSQL = `
    SELECT artstyle_name, image_url
    FROM artstyle_images
`;

export const getArtstyleImages = async (_req: Request, res: any): Promise<any> => {
  try {
    const results: any[] = await execQuery(getArtstyleImagesSQL, []);
    return res.json({ images: results });
  } catch (e: any) {
    console.error("Get Artstyle Images Error:", e);
    return res.status(500).send({ message: "Error fetching art style images" });
  }
};

const saveArtstyleImageSQL = `
    INSERT INTO artstyle_images (artstyle_name, image_url, userid)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      image_url = VALUES(image_url),
      userid = VALUES(userid)
`;

export const saveArtstyleImage = async (req: Request, res: any): Promise<any> => {
  const { artstyle_name, image_url, userid } = req.body;
  if (!artstyle_name || !image_url || !userid) {
    return res.status(400).send({ message: "Missing required fields" });
  }
  try {
    await execQuery(saveArtstyleImageSQL, [artstyle_name, image_url, userid]);
    return res.send({ message: "Art style image saved successfully" });
  } catch (e: any) {
    console.error("Save Artstyle Image Error:", e);
    return res.status(500).send({ message: "Error saving art style image" });
  }
};
