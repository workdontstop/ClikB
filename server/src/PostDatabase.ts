import { publishPostLike } from './SocialChatRoutes';
import { pushSocialChange } from './SocialChatSocket';
import { mergeSavedVideoPlanMedia, recordSceneVideoPlanMedia } from './planVideoMedia';
import { DRAFT_POST_VIDEO, PUBLIC_POST_SQL, profilePublicationSql } from './postPublication';
import { buildPostSearchQuery, postSearchPage } from './postSearchQuery';
import { appendVideoHistory, mergeVideoHistory, normalizeVideoHistory, parseVideoHistoryContext } from './videoHistory';
import execQuery, { withTransaction } from "./execQuery";
import { canWriteCreativeProfileContent } from './creativeProfileContent';
import { normalizeImageModels } from './imageModelExamples';
import { retainActionLabels } from './spatialLabelMetadata';
import { recordPixelCharge, setUsageAction, setUsageUserId } from "./aiUsageLedger";
import { authenticatedUserId, rejectMismatchedUserId } from "./requestAuth";
import { creationGuestScope } from './creationDrafts/auth';
import { draftsNotInstalled } from './creationDrafts/retention';
import dotenv from "dotenv";
dotenv.config(); // Load environment variables from .env file

import { Request, Response as ExpressResponse } from "express";
import {
  deleteCloudAudioUrl,
  copyPublicWorldImage,
  postMediaStorageUrl,
  assertStoredTemplateImage,
  deleteRagInstructionFromS3,
  uploadRagInstructionToS3,
} from "./S3Routes";
import {
  deleteRagInstructionVectors,
  indexRagInstruction,
} from "./RagVectorService";
import { listBrainstormSessionMemoryDevRows } from "./BrainstormSessionMemoryService";
import {
  categorizeTemplateWithMiniModel,
  inferTemplateCategoryServerFallback,
  TEMPLATE_ASSIGNABLE_CATEGORIES,
} from "./GptApi";
import { verifyTemplateCoverReceipt } from './templateCoverReceipt';
import { queueTemplateAssetCleanup, drainTemplateAssetCleanup } from './templateAssetCleanup';
import { SERVER_DERIVATIVE_TEMPLATES } from "./templateSeeds";
//                     └───── rename to avoid clashing with DOM `Response`

const createpostX = `INSERT INTO posts (sender,post_count,topic,caption,item1,thumb1,time,private,kontext,intent_blueprint_json,prompt,model,ratio,video)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,${DRAFT_POST_VIDEO})`;

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

const getsongbyid = `SELECT id, sender, name, song
                     FROM music
                     WHERE id = ?
                     LIMIT 1`;

const getsongbyurl = `SELECT id, sender, name, song
                     FROM music
                     WHERE song = ?
                     LIMIT 1`;

const deletesong = `DELETE FROM music
                     WHERE id = ?
                     LIMIT 1`;

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

  kontext, intent_blueprint_json, prompt, model, ratio, video
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

  ?,?,?,?,?,${DRAFT_POST_VIDEO}
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
  touch_config_json       AS touchConfigJson,intbg,
  CASE WHEN interaction_format IS NOT NULL AND interaction_format <> '' THEN interaction_format WHEN spatial_experience_json IS NOT NULL THEN 'spatial-v1' ELSE NULL END AS interactionFormat

FROM posts
INNER JOIN members ON posts.sender = members.id
LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)
WHERE posts.mode = 2
AND ${PUBLIC_POST_SQL}
ORDER BY posts.id DESC
LIMIT 29;
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
  touch_config_json       AS touchConfigJson,intbg,
  CASE WHEN interaction_format IS NOT NULL AND interaction_format <> '' THEN interaction_format WHEN spatial_experience_json IS NOT NULL THEN 'spatial-v1' ELSE NULL END AS interactionFormat

FROM posts
INNER JOIN members ON posts.sender = members.id
LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)
WHERE posts.mode = 2 and posts.id <= ?
AND ${PUBLIC_POST_SQL}
ORDER BY posts.id DESC
LIMIT 29;
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
  touch_config_json       AS touchConfigJson,intbg,
  CASE WHEN interaction_format IS NOT NULL AND interaction_format <> '' THEN interaction_format WHEN spatial_experience_json IS NOT NULL THEN 'spatial-v1' ELSE NULL END AS interactionFormat

FROM posts
INNER JOIN members ON posts.sender = members.id
LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)
WHERE posts.mode = 2 and posts.id < ?
AND ${PUBLIC_POST_SQL}
ORDER BY posts.id DESC
LIMIT 29;
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
AND ${PUBLIC_POST_SQL}
ORDER BY posts.id DESC
LIMIT 29;
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
AND ${PUBLIC_POST_SQL}
ORDER BY posts.id DESC
LIMIT 29;
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
AND ${PUBLIC_POST_SQL}
ORDER BY posts.id DESC
LIMIT 29;
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
AND ${PUBLIC_POST_SQL}
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
LIMIT 29;
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
LIMIT 29;
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
LIMIT 29;
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
	xv1B, xv2B, xv3B, xv4B, xv5B, xv6B, xv7B, xv8B, xv9B,intbg,
	CASE WHEN interaction_format IS NOT NULL AND interaction_format <> '' THEN interaction_format WHEN spatial_experience_json IS NOT NULL THEN 'spatial-v1' ELSE NULL END AS interactionFormat




FROM posts
INNER JOIN members ON posts.sender = members.id
LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)

WHERE ${PUBLIC_POST_SQL}
ORDER BY posts.id DESC
LIMIT 29;
`;

// Reuse the guest All Feeds selection, including its membership/media semantics.
// Do not interpret `private`: existing post creation writes 1 for published posts.
export const readGuestPublicPosts = async (options: { before?: number; post?: number; related?: number[] } = {}) => {
  const ids = options.post ? [...new Set([options.post, ...(options.related || [])])].slice(0, 28) : [];
  const condition = ids.length ? `AND posts.id IN (${ids.map(() => '?').join(',')})` : options.before ? "AND posts.id < ?" : "";
  const baseSql = options.post
    ? postsxFeeds.replace("AS interactionFormat", "AS interactionFormat,\n  spatial_experience_json AS spatialExperienceJson")
    : postsxFeeds;
  const sql = baseSql.replace("ORDER BY posts.id DESC", `${condition}\nORDER BY posts.id DESC`);
  const rows: any[] = await execQuery(sql, [1, 1, ...(ids.length ? ids : options.before ? [options.before] : [])]);
  if (ids.length) {
    const byId = new Map(rows.map(row => [Number(row.id), row]));
    if (!byId.has(ids[0])) return [];
    return ids.flatMap(id => byId.has(id) ? [byId.get(id)] : []);
  }
  return Array.isArray(rows) ? rows.slice(0, 28) : rows;
};

export const readGuestPostIds = async (before?: number): Promise<Array<{ id: number }>> =>
  execQuery(`SELECT posts.id FROM posts INNER JOIN members ON posts.sender = members.id
    WHERE ${PUBLIC_POST_SQL} ${before ? "AND posts.id < ?" : ""} ORDER BY posts.id DESC LIMIT 1001`, before ? [before] : []);

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
	xv1B, xv2B, xv3B, xv4B, xv5B, xv6B, xv7B, xv8B, xv9B,intbg,
	CASE WHEN interaction_format IS NOT NULL AND interaction_format <> '' THEN interaction_format WHEN spatial_experience_json IS NOT NULL THEN 'spatial-v1' ELSE NULL END AS interactionFormat


FROM posts
INNER JOIN members ON posts.sender = members.id
LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)
WHERE posts.id <= ? 
AND ${PUBLIC_POST_SQL}
ORDER BY posts.id DESC
LIMIT 29;
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
	xv1B, xv2B, xv3B, xv4B, xv5B, xv6B, xv7B, xv8B, xv9B,intbg,
	CASE WHEN interaction_format IS NOT NULL AND interaction_format <> '' THEN interaction_format WHEN spatial_experience_json IS NOT NULL THEN 'spatial-v1' ELSE NULL END AS interactionFormat



FROM posts
INNER JOIN members ON posts.sender = members.id
LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)
WHERE  posts.id < ? 
AND ${PUBLIC_POST_SQL}
ORDER BY posts.id DESC
LIMIT 29;
`;

const profile = `

SELECT posts.video AS publicationVideo,
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
  touch_config_json       AS touchConfigJson,intbg,
  	CASE WHEN interaction_format IS NOT NULL AND interaction_format <> '' THEN interaction_format WHEN spatial_experience_json IS NOT NULL THEN 'spatial-v1' ELSE NULL END AS interactionFormat


FROM posts

INNER JOIN members ON posts.sender = members.id 

LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)

WHERE posts.sender = ? 
ORDER BY posts.id DESC
LIMIT 29;


`;

const profile_moreO = `SELECT
posts.video AS publicationVideo,
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
  touch_config_json       AS touchConfigJson,intbg,
  	CASE WHEN interaction_format IS NOT NULL AND interaction_format <> '' THEN interaction_format WHEN spatial_experience_json IS NOT NULL THEN 'spatial-v1' ELSE NULL END AS interactionFormat


    
FROM posts

INNER JOIN members ON posts.sender = members.id 

LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)

WHERE  posts.sender = ? AND posts.id <= ?  

ORDER BY posts.id DESC
LIMIT 29;



`;

const profile_more = `SELECT
posts.video AS publicationVideo,
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
  touch_config_json       AS touchConfigJson,intbg,
  	CASE WHEN interaction_format IS NOT NULL AND interaction_format <> '' THEN interaction_format WHEN spatial_experience_json IS NOT NULL THEN 'spatial-v1' ELSE NULL END AS interactionFormat

    
FROM posts

INNER JOIN members ON posts.sender = members.id 

LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)

WHERE  posts.sender = ? AND posts.id < ?  

ORDER BY posts.id DESC
LIMIT 29;



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
   AND p.id = (SELECT MAX(p2.id) FROM posts p2 WHERE p2.sender = u.id AND COALESCE(p2.video, 0) <> 100)
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
   AND p.id = (SELECT MAX(p2.id) FROM posts p2 WHERE p2.sender = u.id AND COALESCE(p2.video, 0) <> 100)
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
  const userid = Number(authenticatedUserId(req));
  if (!userid) return res.status(401).json({ ok: false, error: 'Sign in to like a post.' });
  const values = req.body?.values;
  const postid = Number(values?.postid ?? req.body?.postid ?? req.params?.postid ?? req.query?.postid);
  if (!Number.isSafeInteger(postid) || postid <= 0)
    return res.status(400).json({ ok: false, error: 'Choose a valid post.' });
  const likedRaw = values?.liked ?? req.body?.liked ?? req.params?.liked ?? req.query?.liked;
  const desired = typeof likedRaw === 'string' ? ['1','true','yes','y'].includes(likedRaw.toLowerCase()) : !!likedRaw;
  try {
    const result = await withTransaction(async query => {
      const [post] = await query(`SELECT sender FROM posts WHERE id=? AND ${PUBLIC_POST_SQL} FOR UPDATE`, [postid]);
      if (!post) return null;
      const [existing] = await query('SELECT id FROM emotions WHERE post=? AND user=? AND type=1 LIMIT 1', [postid, userid]);
      const liked = likedRaw === undefined ? !existing : desired;
      if (liked !== !!existing) {
        if (liked) await query(`INSERT INTO emotions (post,user,type,time) VALUES (?,?,1,NOW())
          ON DUPLICATE KEY UPDATE type=1,time=NOW()`, [postid, userid]);
        else await query('DELETE FROM emotions WHERE post=? AND user=? AND type=1 LIMIT 1', [postid, userid]);
        await publishPostLike(query, postid, userid, Number(post.sender), liked);
      }
      const [count] = await query('SELECT COUNT(*) AS likes FROM emotions WHERE post=? AND type=1', [postid]);
      return { liked, likes: count?.likes ?? 0, recipient: Number(post.sender), changed: liked !== !!existing };
    });
    if (!result) return res.status(404).json({ ok: false, error: 'Post unavailable.' });
    if (result.changed && result.recipient !== userid) pushSocialChange('notifications', { members: [result.recipient] });
    return res.json({ ok: true, postid, userid, liked: result.liked, likes: result.likes });
  } catch {
    return res.status(500).json({ ok: false, error: 'Failed to set like.' });
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

// POST /likespeople  — list users who liked a post (type=1) in the same shape as fanpeople
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
            WHERE p2.sender = u.id AND COALESCE(p2.video, 0) <> 100
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
    const userid = Number(authenticatedUserId(req));
    if (!userid) return res.status(401).json({ ok: false, error: 'Please sign in.' });
    const expectedViewer = values?.userid ?? req.body?.userid;
    if (expectedViewer != null && Number(expectedViewer) !== userid) {
      return res.status(409).json({ ok: false, error: 'Your active profile changed. Refresh before changing who you follow.' });
    }
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
  const authenticatedId = rejectMismatchedUserId(req, res, values?.userid);
  if (!authenticatedId) return;
  const memberId = Number(authenticatedId);
  const amount = Number(values?.amount);
  const billingLabel = String(values?.billingLabel || "Media Generation").slice(0, 120);
  const requestedStage = String(values?.billingStage || "other");
  const billingStage = (["image_generation", "video_generation", "other"] as const)
    .includes(requestedStage as any) ? requestedStage as any : "other";

  /* ----- basic validation ----- */
  if (!Number.isInteger(memberId) || memberId <= 0) {
    return res.status(400).json({ error: "Invalid user id" });
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: "Amount must be positive" });
  }

  try {
    // Debit only when the authenticated member has the full amount. This is a
    // single atomic statement, so concurrent generations cannot overspend.
    const result = await execQuery(
      `UPDATE members
       SET pixels = COALESCE(pixels,0) - ?
       WHERE id = ? AND COALESCE(pixels,0) >= ?`,
      [amount, memberId, amount]
    );
    const [row] = await execQuery("SELECT pixels FROM members WHERE id = ?", [
      memberId,
    ]);

    if (!row) {
      return res.status(404).json({ error: "Member not found" });
    }
    if (Number(result?.affectedRows) !== 1) {
      return res.status(402).json({
        error: "Not enough pixels",
        pixels: Number(row.pixels) || 0,
        required: amount,
      });
    }

    // Keep the authenticated legacy media debit visible in the same per-user
    // ledger while media pricing is moved fully behind provider routes.
    setUsageUserId(memberId);
    setUsageAction(billingStage, billingLabel);
    recordPixelCharge(amount, String(values?.billingSource || "existing-media-billing"));

    res.setHeader("X-ClikB-Pixels-Charged", String(amount));
    res.setHeader("X-ClikB-Pixels-Balance", String(row.pixels));
    res.setHeader("X-ClikB-Billing-Label", encodeURIComponent(billingLabel));
    res.setHeader("X-ClikB-Billing-Stage", billingStage);
    res.json({
      userid: memberId,
      pixels: row.pixels,
      billing: { pixelsCharged: amount, pixels: row.pixels, label: billingLabel, stage: billingStage },
    });
  } catch (err) {
    console.error("Error spending pixels:", err);
    res.status(500).json({ error: "Failed to spend pixels" });
  }
};

// controller --------------------------
export const getPixels = async (req: any, res: any) => {
  // read from the body, not query
  const { values } = req.body ?? {};
  const authenticatedId = rejectMismatchedUserId(req, res, values?.userid);
  if (!authenticatedId) return;
  const memberId = Number(authenticatedId);

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

const searchPosts = async (req: Request, res: any, more: boolean): Promise<any> => {
  let request: ReturnType<typeof buildPostSearchQuery>;
  try { request = buildPostSearchQuery(req.body?.values, more); }
  catch (error: any) { return res.status(400).json({ message: error.message }); }
  try {
    const rows = await execQuery(request.sql, request.params);
    return res.json({ message: 'feeds fetched', ...postSearchPage(rows, request.query, request.mode), postPageLimit: req.body?.values?.lastId || 0 });
  } catch {
    return res.status(500).json({ message: 'Search could not load. Try again.' });
  }
};
export const getSearchMore = (req: Request, res: any): Promise<any> => searchPosts(req, res, true);
export const getSearch = (req: Request, res: any): Promise<any> => searchPosts(req, res, false);

const finalizeFeedPage = (rows: any, pageSize = 28) => {
  const list = Array.isArray(rows) ? rows : [];
  const hasMore = list.length > pageSize;
  const page = (hasMore ? list.slice(0, pageSize) : list).map((row) => ({
    ...row,
    has_more_data: hasMore,
  }));
  return { payload: page, hasMore };
};

export const getPostSpatial = async (req: Request, res: any): Promise<any> => {
  const rawId = req.body?.postId ?? req.body?.values?.postId ?? req.query?.postId;
  const postId = Number(rawId);
  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ message: "Valid postId is required" });
  }
  try {
    const rows: any[] = await execQuery(
      `SELECT id, sender, video, interaction_format AS interactionFormat, spatial_experience_json AS spatialExperienceJson FROM posts WHERE id = ? LIMIT 1`,
      [postId]
    );
    const row = rows[0] || null;
    if (!row) {
      return res.status(404).json({ message: "Post not found" });
    }
    if (Number(row.video) === DRAFT_POST_VIDEO) {
      const owner = authenticatedUserId(req);
      if (!owner || owner !== String(row.sender)) return res.status(404).json({ message: 'Post not found' });
      if (owner === '1' && process.env.APP_STATE !== 'dev') {
        const scope = creationGuestScope(req);
        const drafts = scope ? await execQuery('SELECT draft_id FROM creation_drafts WHERE post_id=? AND guest_scope=?', [postId, scope]) : [];
        if (!drafts.length) return res.status(404).json({ message: 'Post not found' });
      }
    }
    return res.json({
      id: row.id,
      interactionFormat: row.interactionFormat || (row.spatialExperienceJson ? "spatial-v1" : null),
      spatialExperienceJson: row.spatialExperienceJson || null,
    });
  } catch (err) {
    console.error("getPostSpatial error:", err);
    return res.status(500).json({ message: "Error loading spatial experience" });
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

      const { payload, hasMore } = finalizeFeedPage(chronologicaldata);
      return res.send({
        message: "feeds fetched",
        payload,
        hasMore,
        postPageLimit: values.lastId,
      });
    } catch (e: any) {
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

      const { payload, hasMore } = finalizeFeedPage(chronologicaldata);
      return res.send({
        message: "feeds fetched",
        payload,
        hasMore,
        postPageLimit: values.lastId,
      });
    } catch (e: any) {
      return res.send({ message: "error in fetching feeds" });
    }
  }
};

// SQL to insert a Character
const insertWorldModelSQL = `
    INSERT INTO world_models (post_id, selected_style,userid, title,cover, description, blueprint, original_prompt, planx)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const deleteWorldCharactersSQL = `
    DELETE FROM characters
    WHERE world_id = ?
`;

const deleteWorldModelSQL = `
    DELETE FROM world_models
    WHERE id = ? AND userid = ?
    LIMIT 1
`;

const isWorldOwnedImage = (value: unknown): value is string => {
  const canonical = postMediaStorageUrl(value);
  return Boolean(canonical && /^s3:\/\/[^/]+\/world-(?:cover|character(?:-\d+)?|environment|object)-[a-f\d]{32}\.[a-z0-9]+$/i.test(canonical));
};
const isWorldImageSource = (value: string): boolean => value.length <= 4096 &&
  (/^https?:\/\//i.test(value.trim()) || Boolean(postMediaStorageUrl(value)));

function readWorldPlan(plan: unknown): unknown {
  if (typeof plan !== 'string') return plan;
  try { return JSON.parse(plan); }
  catch { return plan; }
}
/** Save the World and its complete reviewed catalogue in one transaction. */
export const createWorldModel = async (req: Request, res: ExpressResponse): Promise<any> => {
  const actor = authenticatedUserId(req);
  if (!actor) return res.status(401).json({ error: "Please sign in." });
  const { PostId, selectedStyle, title, description, blueprint, originalPrompt, planx, cover, assets, worldId, revision } = req.body || {};
  if (actor === '1' && process.env.APP_STATE !== 'dev') return res.status(403).json({ error: "Sign in with your own account to save a World." });
  if (typeof title !== 'string' || !title.trim() || title.length > 200 || typeof description !== 'string' ||
      typeof blueprint !== 'string' || description.length > 10000 || blueprint.length > 20000 ||
      !Array.isArray(assets) || assets.length > 200 || (cover && typeof cover !== 'string')) {
    return res.status(400).json({ error: "Check the World title, blueprint and assets." });
  }
  if (assets.some(asset => !asset || !['character', 'environment', 'object'].includes(asset.kind) ||
      typeof asset.name !== 'string' || !asset.name.trim() || asset.name.length > 200 ||
      typeof asset.description !== 'string' || asset.description.length > 10000 || typeof asset.image !== 'string' ||
      (asset.id != null && (!Number.isSafeInteger(asset.id) || asset.id < 1 || worldId == null)))) {
    return res.status(400).json({ error: "Each asset needs a category, name and saved image." });
  }
  if (worldId != null && (!Number.isSafeInteger(worldId) || worldId < 1 || !Number.isSafeInteger(revision) || revision < 0)) {
    return res.status(400).json({ error: "Reopen this World before saving changes." });
  }
  const newCopies: string[] = [];
  const copyAsset = async (url: string, purpose: string) => {
    const copy = await copyPublicWorldImage(url, purpose);
    newCopies.push(copy);
    return copy;
  };
  const discardCopies = () => Promise.allSettled(newCopies.map(url => queueTemplateAssetCleanup(url)));
  try {
    // Check both additive columns before making storage copies on an unmigrated deployment.
    await execQuery('SELECT catalog_revision FROM world_models LIMIT 0', []);
    await execQuery('SELECT asset_type FROM characters LIMIT 0', []);
    const currentAssets: { id: number | string; image: string | null }[] = worldId == null ? [] : await execQuery(
      'SELECT c.id, c.image FROM characters c JOIN world_models w ON w.id=c.world_id WHERE w.id=? AND w.userid=?',
      [worldId, actor]);
    if (worldId != null) {
      const owned = await execQuery('SELECT id, catalog_revision FROM world_models WHERE id=? AND userid=?', [worldId, actor]);
      if (!owned.length) return res.status(404).json({ error: "World not found." });
      if (Number(owned[0].catalog_revision) !== revision) return res.status(409).json({ error: "This World changed. Reopen it and try again." });
    }
    const ids = assets.flatMap(asset => asset.id == null ? [] : [asset.id]);
    if (new Set(ids).size !== ids.length || ids.some(id => !currentAssets.some(item => Number(item.id) === id))) {
      return res.status(409).json({ error: "This World changed. Reopen it and try again." });
    }
    const unchangedImage = (asset: { id?: number; image: string }) => currentAssets.find(
      item => Number(item.id) === asset.id && String(item.image ?? '') === asset.image
    );
    if ((worldId == null && cover && !isWorldImageSource(cover)) ||
        assets.some(asset => !unchangedImage(asset) && !isWorldImageSource(asset.image))) {
      return res.status(400).json({ error: "Choose an image for each new or changed World asset." });
    }
    const storedCover = worldId == null && cover ? await copyAsset(cover, 'world-cover') : null;
    const storedAssets: { id?: number; name: string; description: string; kind: string; image: string | null }[] = [];
    for (const asset of assets) {
      const existing = unchangedImage(asset);
      const image = existing ? existing.image : await copyAsset(asset.image, 'world-' + asset.kind);
      storedAssets.push({ ...asset, image });
    }
    const result = await withTransaction(async query => {
      let id = worldId;
      if (worldId != null) {
        const [world] = await query('SELECT id, catalog_revision FROM world_models WHERE id=? AND userid=? FOR UPDATE', [worldId, actor]);
        if (!world) return { status: 404 };
        if (Number(world.catalog_revision) !== revision) return { status: 409 };
        const previous = await query('SELECT id, image FROM characters WHERE world_id=? FOR UPDATE', [worldId]);
        const previousIds = new Set(previous.map((asset: any) => Number(asset.id)));
        const retainedIds = storedAssets.flatMap(asset => asset.id == null ? [] : [asset.id]);
        if (retainedIds.some(id => !previousIds.has(id)) || new Set(retainedIds).size !== retainedIds.length) return { status: 409 };
        await query('UPDATE world_models SET title=?, description=?, blueprint=?, catalog_revision=catalog_revision+1 WHERE id=?', [title.trim(), description, blueprint, worldId]);
        for (const old of previous) {
          const retained = storedAssets.find(asset => asset.id === Number(old.id));
          if (!retained) await query('DELETE FROM characters WHERE id=? AND world_id=?', [old.id, worldId]);
          if (retained?.image !== old.image && isWorldOwnedImage(old.image)) await queueTemplateAssetCleanup(old.image, query);
        }
      } else {
        const planData = typeof planx === 'object' ? JSON.stringify(planx) : planx;
        const created = await query(insertWorldModelSQL, [PostId || null, selectedStyle || '', actor,
          title.trim(), storedCover, description, blueprint, originalPrompt || '', planData || null]);
        id = created.insertId;
      }
      for (const asset of storedAssets) {
        if (worldId != null && asset.id != null) {
          await query('UPDATE characters SET name=?, description=?, image=?, asset_type=? WHERE id=? AND world_id=?',
            [asset.name.trim(), asset.description, asset.image, asset.kind, asset.id, id]);
        } else {
          await query('INSERT INTO characters (world_id, name, description, image, asset_type) VALUES (?, ?, ?, ?, ?)',
            [id, asset.name.trim(), asset.description, asset.image, asset.kind]);
        }
      }
      return { status: 200, id };
    });
    if (result.status !== 200) {
      await discardCopies();
      return res.status(result.status).json({ error: result.status === 404 ? "World not found." : "This World changed. Reopen it and try again." });
    }
    void drainTemplateAssetCleanup();
    return res.json({ id: result.id });
  } catch (error: any) {
    await discardCopies();
    if (error?.code === 'ER_BAD_FIELD_ERROR') return res.status(503).json({ error: "The World catalogue migration is required before saving." });
    console.error("World catalogue save failed.");
    return res.status(500).json({ error: "World could not be saved. Please retry." });
  }
};

export const createCharacter = async (_req: Request, res: ExpressResponse): Promise<any> => {
  return res.status(410).json({ error: "Save assets through the World editor." });
};

export const deleteWorldModel = async (req: Request, res: ExpressResponse): Promise<any> => {
  const userid = authenticatedUserId(req);
  if (!userid) return res.status(401).json({ error: "Please sign in." });
  if (userid === '1' && process.env.APP_STATE !== 'dev') return res.status(403).json({ error: "Sign in with your own account to delete a World." });
  const payload = req.body?.values || req.body || {};
  const worldId = Number(payload.worldId ?? payload.id);
  if (!Number.isSafeInteger(worldId) || worldId <= 0) return res.status(400).json({ error: "A World ID is required." });
  try {
    const deleted = await withTransaction(async query => {
      const [world] = await query('SELECT cover FROM world_models WHERE id=? AND userid=? FOR UPDATE', [worldId, userid]);
      if (!world) return false;
      const assets = await query('SELECT image FROM characters WHERE world_id=? FOR UPDATE', [worldId]);
      for (const url of new Set<string>([world.cover, ...assets.map((asset: any) => asset.image)].filter(isWorldOwnedImage))) {
        await queueTemplateAssetCleanup(url, query);
      }
      await query(deleteWorldCharactersSQL, [worldId]);
      await query(deleteWorldModelSQL, [worldId, userid]);
      return true;
    });
    if (!deleted) return res.status(404).json({ error: "World not found." });
    void drainTemplateAssetCleanup();
    return res.json({ message: "World deleted." });
  } catch {
    console.error("World deletion failed.");
    return res.status(500).json({ error: "World could not be deleted. Please retry." });
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
  char_type?: string;
  catalog_revision?: number;
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
        c.image as char_image, c.asset_type as char_type
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
      execQuery(sql, [limit, offset]).catch(error => {
        if (error?.code !== "ER_BAD_FIELD_ERROR") throw error;
        return execQuery(sql.replace(", c.asset_type as char_type", ""), [limit, offset]);
      }), // Params updated: no userid
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
          planx: readWorldPlan(row.planx),
          created_at: row.created_at,
          post_id: row.post_id,
          selected_style: row.selected_style,
          catalog_revision: Number(row.catalog_revision || 0),
          characters: [],
        });
      }

      if (row.char_id) {
        worldsMap.get(row.id).characters.push({
          id: row.char_id,
          name: row.char_name,
          description: row.char_description,
          image: row.char_image,
          kind: row.char_type || "character",
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
        c.image as char_image, c.asset_type as char_type
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
      execQuery(sql, [userid, limit, offset]).catch(error => {
        if (error?.code !== "ER_BAD_FIELD_ERROR") throw error;
        return execQuery(sql.replace(", c.asset_type as char_type", ""), [userid, limit, offset]);
      }),
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
          planx: readWorldPlan(row.planx),
          created_at: row.created_at,
          post_id: row.post_id,
          selected_style: row.selected_style,
          catalog_revision: Number(row.catalog_revision || 0),
          characters: [],
        });
      }

      if (row.char_id) {
        worldsMap.get(row.id).characters.push({
          id: row.char_id,
          name: row.char_name,
          description: row.char_description,
          image: row.char_image,
          kind: row.char_type || "character",
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

  if (values) {
    try {
      const chronologicaldata = await execQuery(postsxClik, [
        values.id,
        values.id2,
      ]);

      const { payload, hasMore } = finalizeFeedPage(chronologicaldata);
      return res.send({
        message: "feeds fetched",
        payload,
        hasMore,
        postPageLimit: 0,
      });
    } catch (e: any) {
      return res.send({ message: "error in fetching feeds" });
    }
  }
};
export const getFeeds = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  if (values) {
    try {
      const chronologicaldata = await execQuery(postsx, [values.id, values.id]);

      const { payload, hasMore } = finalizeFeedPage(chronologicaldata);
      return res.send({
        message: "feeds fetched",
        payload,
        hasMore,
        postPageLimit: 0,
      });
    } catch (e: any) {
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

      const { payload, hasMore } = finalizeFeedPage(chronologicaldata);
      return res.send({
        message: "feeds fetched",
        payload,
        hasMore,
        postPageLimit: values.lastId,
      });
    } catch (e: any) {
      return res.send({ message: "error in fetching feeds" });
    }
  }
};

export const getFeedsFeeds = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  if (values) {
    try {
      const chronologicaldata = await execQuery(postsxFeeds, [
        values.id,
        values.id2,
      ]);

      const { payload, hasMore } = finalizeFeedPage(chronologicaldata);
      return res.send({
        message: "feeds fetched",
        payload,
        hasMore,
        postPageLimit: 0,
      });
    } catch (e: any) {
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

      const { payload, hasMore } = finalizeFeedPage(chronologicaldata);
      return res.send({
        message: "feeds fetched",
        payload,
        hasMore,
        postPageLimit: values.lastId,
      });
    } catch (e: any) {
      return res.send({ message: "error in fetching feeds" });
    }
  }
};

export const getFeedsStory = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  if (values) {
    try {
      const chronologicaldata = await execQuery(postsxStory, [
        values.id,
        values.id,
      ]);

      const { payload, hasMore } = finalizeFeedPage(chronologicaldata);
      return res.send({
        message: "feeds fetched",
        payload,
        hasMore,
        postPageLimit: 0,
      });
    } catch (e: any) {
      return res.send({ message: "error in fetching feeds" });
    }
  }
};

// -----------------------------------------------------------------------------
//  Controller:  POST /InsertPostSearch
// -----------------------------------------------------------------------------
export const InsertPostSearch = async (req: any, res: any): Promise<any> => {
  const userId = authenticatedUserId(req);
  if (!userId) return res.status(401).json({ message: 'Please sign in.' });
  const { postId, caption, tags, categories } = (req.body || {}) as {
    postId: number;
    caption: string;
    tags: any; // ← arrays coming from front end
    categories: any;
  };

  /* ---------- basic validation -------------------------------- */
  if (!Number.isSafeInteger(Number(postId)) || Number(postId) <= 0 || typeof caption !== 'string' || !caption.trim()) {
    return res
      .status(400)
      .json({ message: "Body must contain { postId, caption }" });
  }

  /* ---------- flatten arrays --------------------------------- */
  const tagStr = Array.isArray(tags) ? tags.filter((tag: unknown) => typeof tag === 'string').slice(0, 30).map(tag => tag.trim().slice(0, 80)).join(' ') : '';
  const catStr = Array.isArray(categories) ? categories.filter((category: unknown) => typeof category === 'string').slice(0, 10).map(category => category.trim().slice(0, 80)).join(' ') : '';

  try {
    const saved = await withTransaction(async query => {
      const owner = await query('SELECT id, mode FROM posts WHERE id = ? AND sender = ? FOR UPDATE', [Number(postId), userId]);
      if (!owner.length) return false;
      await query(createPostSearch, [Number(postId), caption.trim().slice(0, 4000), tagStr, catStr]);
      // This endpoint is Thumbnail's final save for Shorts/Cinema. Games index
      // before their creator/publication and remain drafts until their own save.
      if ([0, 1].includes(Number(owner[0].mode))) await query('UPDATE posts SET video = 1 WHERE id = ? AND sender = ?', [Number(postId), userId]);
      return true;
    });
    if (!saved) return res.status(404).json({ message: 'Post not found or not owned by you.' });
    return res.json({ message: "post_search row saved", postId });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: "post_search insert failed" });
  }
};

const insertPostForProfile = (sql: string, params: any[]) => withTransaction(async query => {
  if (!await canWriteCreativeProfileContent(query, params[0])) return null;
  return query(sql, params);
});

export const PostImage = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;
  const member = authenticatedUserId(req);
  if (!member) return res.status(401).json({ message: 'Please sign in.' });

  var currentTime = new Date();

  ///console.log(values.rad1);
  try {
    const result = await insertPostForProfile(createpostX, [
      member,
      1,
      "", ////topic
      values.caption,
      values.imagehd,
      "",
      currentTime,
      1,
      values.kontext,
      values.intentBlueprintJson || null,
      values.prompt,
      values.model,
      values.ratio,
    ]);

    if (!result) return res.status(409).json({ message: 'This Creative Profile has been removed.' });
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
export const DeleteMusic = async (req: Request, res: any): Promise<any> => {
  const payload: any =
    req.body && typeof req.body.values === "object"
      ? req.body.values
      : req.body || {};

  const songId = Number(payload.musicId ?? payload.id);
  const hasSongId = Number.isFinite(songId) && songId > 0;
  const songUrl =
    typeof payload.song === "string"
      ? payload.song.trim()
      : typeof payload.url === "string"
      ? payload.url.trim()
      : typeof payload.audio === "string"
      ? payload.audio.trim()
      : "";

  if (!hasSongId && !songUrl) {
    return res.status(400).send({ message: "Missing music id or song URL" });
  }

  try {
    const rows: any = await execQuery(
      hasSongId ? getsongbyid : getsongbyurl,
      hasSongId ? [songId] : [songUrl]
    );
    const songRow = Array.isArray(rows) ? rows[0] : null;

    if (!songRow) {
      return res.status(404).send({ message: "Music not found" });
    }

    await deleteCloudAudioUrl(songRow.song);
    await execQuery(deletesong, [songRow.id]);

    return res.send({ go: songRow.id, message: "music deleted" });
  } catch (e: any) {
    console.log(e);
    return res
      .status(500)
      .send({ message: "music delete failed", error: e?.message });
  }
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
    const existingPostId = Number(values?.postId);
    if (Number.isInteger(existingPostId) && existingPostId > 0) {
      const owner = authenticatedUserId(req);
      if (!owner) return res.status(401).send({ message: "Please sign in." });
      const updated = await withTransaction(async query => {
        const rows = await query("SELECT sender, kontext FROM posts WHERE id = ? FOR UPDATE", [existingPostId]);
        if (!rows[0] || String(rows[0].sender) !== owner) return false;
        const columns: string[] = [];
        const params: any[] = [];
        const add = (column: string, value: any) => { columns.push(`${column} = ?`); params.push(value); };
        // Image navigation only updates image-owned columns. Video, audio,
        // prompts, cover and publication identity remain on the same post.
        const groups = [
          ["x", images, imagesB], ["xh", imagesHd, imagesHdB],
          ["xt", txts, txtsB], ["gent", gent, gentB],
        ] as const;
        for (const [prefix, normal, stageB] of groups) {
          normal.forEach((value, idx) => { if (value != null) add(`${prefix}${idx + 1}`, value); });
          stageB.forEach((value, idx) => { if (value != null) add(`${prefix}${idx + 1}B`, value); });
        }
        if (values.kontext) {
          let context = values.kontext;
          try {
            const oldContext = parseVideoHistoryContext(rows[0].kontext);
            const nextContext = parseVideoHistoryContext(values.kontext);
            context = JSON.stringify({ ...oldContext, ...mergeSavedVideoPlanMedia(oldContext, nextContext),
              retainedMedia: oldContext.retainedMedia || [],
              upscales: oldContext.upscales || {},
              bshotUpscales: oldContext.bshotUpscales || {},
              videoHistory: mergeVideoHistory(oldContext.videoHistory, nextContext.videoHistory),
              imageModels: { ...normalizeImageModels(oldContext.imageModels), ...normalizeImageModels(nextContext.imageModels) },
            });
          } catch { /* Legacy plain-string context remains supported. */ }
          add("kontext", context);
        }
        if (typeof values.intentBlueprintJson === "string" && values.intentBlueprintJson.trim()) add("intent_blueprint_json", values.intentBlueprintJson);
        if (columns.length) await query(`UPDATE posts SET ${columns.join(", ")} WHERE id = ?`, [...params, existingPostId]);
        return true;
      });
      if (!updated) return res.status(403).send({ message: "Post not found or not owned by this account." });
      return res.send({ go: existingPostId, message: "images updated" });
    }
    const member = authenticatedUserId(req);
    if (!member) return res.status(401).json({ message: 'Please sign in.' });
    const result = await insertPostForProfile(createpostXStory, [
      member,
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
      // Must stay between kontext and prompt: createpostXStory lists
      // `kontext, intent_blueprint_json, prompt, model, ratio` and every
      // placeholder is positional. Omitting it shifts prompt/model/ratio by one
      // and leaves the statement one value short of its 86 placeholders.
      typeof values.intentBlueprintJson === "string" &&
      values.intentBlueprintJson.trim()
        ? values.intentBlueprintJson
        : null,
      values.prompt,
      values.model,
      values.ratio,
    ]);

    if (!result) return res.status(409).json({ message: 'This Creative Profile has been removed.' });
    return res.send({ go: result.insertId, message: "images uploaded" });
  } catch (error) {
    console.error(error);
    return res.send({ message: "images upload failed" });
  }
};

export const UpdateIntentBlueprint = async (
  req: Request,
  res: any
): Promise<any> => {
  const postId = Number(req.body?.postId);
  const intentBlueprintJson = req.body?.intentBlueprintJson;
  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).send({ message: "A valid postId is required" });
  }
  if (typeof intentBlueprintJson !== "string" || !intentBlueprintJson.trim()) {
    return res.status(400).send({ message: "intentBlueprintJson is required" });
  }
  if (Buffer.byteLength(intentBlueprintJson, "utf8") > 2_000_000) {
    return res.status(413).send({ message: "Intent blueprint is too large" });
  }

  try {
    const parsed = JSON.parse(intentBlueprintJson) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      (parsed as { schemaVersion?: unknown }).schemaVersion !== 1
    ) {
      return res
        .status(400)
        .send({ message: "Invalid intent blueprint schema" });
    }
    console.log("[IntentBlueprint][persistence][request]", {
      postId,
      blueprintId: (parsed as { blueprintId?: unknown }).blueprintId,
      revision: (parsed as { revision?: unknown }).revision,
    });
    await execQuery(
      "UPDATE posts SET intent_blueprint_json = ? WHERE id = ? LIMIT 1",
      [intentBlueprintJson, postId]
    );
    console.log("[IntentBlueprint][persistence][saved]", {
      postId,
      blueprintId: (parsed as { blueprintId?: unknown }).blueprintId,
      revision: (parsed as { revision?: unknown }).revision,
    });
    return res.send({ message: "Intent blueprint saved" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Intent blueprint save failed:", message);
    return res.status(500).send({ message: "Intent blueprint save failed" });
  }
};

/**
 * Spatial creation publishes into its own versioned JSON column. The legacy
 * interaction columns remain readable and editable through interactionSave,
 * but new creation-mode type-3 publishing never writes them.
 */
export const SaveSpatialExperience = async (
  req: Request,
  res: any
): Promise<any> => {
  const userId = authenticatedUserId(req);
  if (!userId) return res.status(401).send({ message: "Please sign in." });
  const postId = Number(req.body?.postId);
  const spatialExperienceJson = req.body?.spatialExperienceJson;
  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).send({ message: "A valid postId is required" });
  }
  if (
    typeof spatialExperienceJson !== "string" ||
    !spatialExperienceJson.trim()
  ) {
    return res
      .status(400)
      .send({ message: "spatialExperienceJson is required" });
  }
  if (Buffer.byteLength(spatialExperienceJson, "utf8") > 4_000_000) {
    return res.status(413).send({ message: "Spatial experience is too large" });
  }

  try {
    const parsed = JSON.parse(spatialExperienceJson) as any;
    if (
      parsed?.version !== 1 ||
      !Array.isArray(parsed?.stages) ||
      parsed.stages.length === 0 ||
      !parsed?.entry
    ) {
      return res
        .status(400)
        .send({ message: "Invalid spatial experience schema" });
    }
    const stageIds = new Set<string>();
    const nodeIdsByStage = new Map<string, Set<string>>();
    for (const stage of parsed.stages) {
      if (
        !stage ||
        typeof stage.id !== "string" ||
        !stage.id ||
        stageIds.has(stage.id) ||
        !Array.isArray(stage.scene?.nodes) ||
        stage.scene.nodes.length === 0
      ) {
        return res.status(400).send({ message: "Invalid spatial stage graph" });
      }
      stageIds.add(stage.id);
      const nodeIds = new Set<string>();
      for (const node of stage.scene.nodes) {
        if (
          !node ||
          typeof node.id !== "string" ||
          !node.id ||
          nodeIds.has(node.id)
        ) {
          return res
            .status(400)
            .send({ message: "Invalid spatial node graph" });
        }
        nodeIds.add(node.id);
      }
      nodeIdsByStage.set(stage.id, nodeIds);
    }
    if (
      !stageIds.has(parsed.entry.stageId) ||
      !nodeIdsByStage.get(parsed.entry.stageId)?.has(parsed.entry.nodeId)
    ) {
      return res.status(400).send({ message: "Invalid spatial entry point" });
    }

    const result: any = await withTransaction(async query => {
      const rows = await query("SELECT spatial_experience_json FROM posts WHERE id = ? AND sender = ? AND mode = 2 FOR UPDATE", [postId, userId]);
      if (!rows.length) return null;
      let previous = {};
      try { const stored = rows[0].spatial_experience_json; previous = typeof stored === 'string' ? JSON.parse(stored) : stored || {}; }
      catch { /* A valid new publication can replace a malformed old document. */ }
      const document = retainActionLabels(parsed, previous);
      const json = JSON.stringify(document);
      if (Buffer.byteLength(json, 'utf8') > 4_000_000) throw new Error('Spatial experience is too large');
      return query("UPDATE posts SET interaction_format = ?, spatial_experience_json = ?, video = 1 WHERE id = ? AND sender = ? AND mode = 2 LIMIT 1",
        ["spatial-v1", json, postId, userId]);
    });
    if (!result?.affectedRows)
      return res.status(404).send({ message: "Spatial post was not found" });
    return res.send({
      message: "Spatial experience published",
      interactionFormat: "spatial-v1",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof SyntaxError)
      return res
        .status(400)
        .send({ message: "Spatial experience JSON is invalid" });
    console.error("Spatial experience save failed:", message);
    return res.status(500).send({ message: "Spatial experience save failed" });
  }
};

async function scopedGuestProfile(sql: string, values: any[], req: Request) {
  const scope = creationGuestScope(req);
  const predicate = `AND (${PUBLIC_POST_SQL} OR EXISTS (SELECT 1 FROM creation_drafts gd WHERE gd.post_id=posts.id AND gd.user_id=1 AND gd.guest_scope=? AND gd.preparation_state='ready'))\nORDER BY posts.id DESC`;
  try { return await execQuery(sql.replace('ORDER BY posts.id DESC', predicate), [...values, scope || '']); }
  catch (error) {
    if (!draftsNotInstalled(error)) throw error;
    // Before the additive migration, never expose a shared Guest's private drafts.
    return execQuery(sql.replace('ORDER BY posts.id DESC', `AND ${PUBLIC_POST_SQL}\nORDER BY posts.id DESC`), values);
  }
}

export const getProfile = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  if (values) {
    try {
      const profileQuery = profilePublicationSql(profile, values.id, authenticatedUserId(req));
      const queryProfile = authenticatedUserId(req) === '1' && process.env.APP_STATE !== 'dev'
        ? (sql: string, parameters: any[]) => scopedGuestProfile(sql, parameters, req) : execQuery;
      const chronologicaldata = await queryProfile(profileQuery, [
        values.id3,
        values.id3,
        values.id,
      ]);

      const { payload, hasMore } = finalizeFeedPage(chronologicaldata);
      return res.send({
        message: "feeds fetched",
        payload,
        hasMore,
        postPageLimit: 0,
      });
    } catch (e: any) {
      return res.send({ message: "error in fetching feeds" });
    }
  }
};

export const getProfileMore = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  if (values) {
    try {
      var chronologicaldata: any = null;
      const queryProfile = authenticatedUserId(req) === '1' && process.env.APP_STATE !== 'dev'
        ? (sql: string, parameters: any[]) => scopedGuestProfile(sql, parameters, req) : execQuery;

      if (values.override) {
        chronologicaldata = await queryProfile(profilePublicationSql(profile_moreO, values.id, authenticatedUserId(req)), [
          values.id3,
          values.id3,
          values.id,
          values.lastId,
        ]);
      } else {
        chronologicaldata = await queryProfile(profilePublicationSql(profile_more, values.id, authenticatedUserId(req)), [
          values.id3,
          values.id3,
          values.id,
          values.lastId,
        ]);
      }

      const { payload, hasMore } = finalizeFeedPage(chronologicaldata);
      return res.send({
        message: "feeds fetched",
        payload,
        hasMore,
        postPageLimit: 0,
      });
    } catch (e: any) {
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
    console.error("❌ audioSave failed:", err);
    res.status(500).json({ error: "DB update failed" });
  }
};

export const interactionSave = async (req: any, res: any): Promise<void> => {
  const userId = authenticatedUserId(req);
  if (!userId) { res.status(401).json({ error: 'Please sign in.' }); return; }
  const { values } = req.body || {};

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
    audio = {}, // { main, left, right }  ← can be string | array | nested
    touchConfig = {}, // { hotspots, tree }  ← full config
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

  // flat root audio (strings or null) – **now safely normalized**
  const audioMain = normalizeAudioField(audio.main);
  const audioLeft = normalizeAudioField(audio.left);
  const audioRight = normalizeAudioField(audio.right);

  // full touch config (hotspots + tree) as JSON
  const touchConfigJson =
    touchConfig && Object.keys(touchConfig).length > 0
      ? JSON.stringify(touchConfig)
      : null;

  // ---- 3. Build UPDATE (parameterized – no raw string interpolation) ------
  const sql = `
    UPDATE posts
    SET
      video    = 1,               -- completed Hotspots publication
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

    WHERE id = ? AND sender = ? AND mode = 2
  `;

  const params = [
    2, // mode column (you’re forcing mode=2 here)
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

    id, userId,
  ];

  try {
    const saved = await execQuery(sql, params);
    if (!saved.affectedRows) { res.status(404).json({ error: 'Game not found or not owned by you.' }); return; }
    res.json({ message: "Interaction saved" });
  } catch (err) {
    console.error("❌ interactionSave failed:", err);
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
        video = CASE WHEN video = ${DRAFT_POST_VIDEO} THEN ${DRAFT_POST_VIDEO} ELSE 1 END,
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
  if (authenticatedUserId(req) !== String(id)) {
    res.status(403).json({ message: 'Switch to this profile before changing its picture.' });
    return;
  }

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
  if (authenticatedUserId(req) !== String(id)) {
    res.status(403).json({ message: 'Switch to this profile before changing its cover.' });
    return;
  }

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
  let promoted = true;

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

    if (!Number.isInteger(typeRaw) || typeRaw < 0) {
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

    const owner = authenticatedUserId(req);
    if (!owner) return res.status(401).json({ error: "Please sign in." });
    const saved = await withTransaction(async query => {
      const rows = await query(`SELECT sender, kontext, ${col} AS previousVideo FROM posts WHERE id=? FOR UPDATE`, [postId]);
      if (!rows[0] || String(rows[0].sender) !== owner) return false;
      const context = parseVideoHistoryContext(rows[0].kontext);
      const previous = rows[0].previousVideo;
      const key = `A:${typeRaw}`;
      context.videoHistory = mergeVideoHistory(context.videoHistory, values.videoHistory);
      if (typeof values.upscale?.sourceUrl === 'string') context.videoHistory = appendVideoHistory(context.videoHistory, key, { videoUrl: values.upscale.sourceUrl, createdAt: 0 });
      if (typeof previous === 'string') context.videoHistory = appendVideoHistory(context.videoHistory, key, { videoUrl: previous, createdAt: 0 });
      context.videoHistory = appendVideoHistory(context.videoHistory, key, { videoUrl: vid,
        createdAt: Number(values.videoHistoryEntry?.createdAt) || Date.now(),
        prompt: typeof values.videoHistoryEntry?.prompt === 'string' ? values.videoHistoryEntry.prompt : undefined,
        model: typeof values.videoHistoryEntry?.model === 'string' ? values.videoHistoryEntry.model : undefined });
      const retained = Array.isArray(context.retainedMedia) ? context.retainedMedia : [];
      for (const entries of Object.values(normalizeVideoHistory(context.videoHistory))) {
        for (const entry of entries) if (!retained.some((item: any) => item.url === entry.videoUrl)) {
          retained.push({ url: entry.videoUrl, kind: 'video', role: 'video-history', deleteOnPostDelete: true });
        }
      }
      context.retainedMedia = retained;
      recordSceneVideoPlanMedia(context, values, { promptKey: key, scene: idx + 1, ...(useB ? { bIndex: 1 } : {}) });
      if (values.upscale) {
        const metadata = values.upscale;
        const resolution = String(metadata.resolution || "").toLowerCase();
        if (!["1080p", "2k"].includes(resolution)) throw new Error("Invalid upscale resolution");
        promoted = metadata.promote !== false && previous === metadata.sourceUrl;
        if (typeof metadata.sourceUrl === 'string' && /^https?:\/\//.test(metadata.sourceUrl) && !retained.some((item: any) => item.url === metadata.sourceUrl)) {
          retained.push({ url: metadata.sourceUrl, kind: "video", role: "previous-upscale-source", deleteOnPostDelete: true });
        }
        const history = Array.isArray(context.upscales?.[col]) ? context.upscales[col] : [];
        history.push({ videoUrl: vid, sourceUrl: String(metadata.sourceUrl || ""), resolution,
          fps: 60, predictionId: String(metadata.predictionId || ""),
          duration: Number(metadata.duration) || null, savedAt: new Date().toISOString() });
        context.upscales = { ...context.upscales, [col]: history };
      }
      if (promoted) await query(`UPDATE posts SET ${col}=?, kontext=? WHERE id=?`, [vid, JSON.stringify(context), postId]);
      else await query("UPDATE posts SET kontext=? WHERE id=?", [JSON.stringify(context), postId]);
      return true;
    });
    if (!saved) return res.status(403).json({ error: "Post not found or not owned by this account." });

    return res.json({
      message: "Video updated successfully",
      promoted,
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

    const imageModel = typeof values?.imageModel === 'string' ? values.imageModel.trim().slice(0, 100) : '';
    if (imageModel) {
      await withTransaction(async query => {
        const rows = await query('SELECT kontext FROM posts WHERE id=? FOR UPDATE', [postId]);
        const context = parseVideoHistoryContext(rows[0]?.kontext);
        context.imageModels = { ...normalizeImageModels(context.imageModels), [img]: imageModel };
        await query(`UPDATE posts SET ${col}=?, kontext=? WHERE id=?`, [img, JSON.stringify(context), postId]);
      });
    } else {
      const sql = `UPDATE posts SET ${col}=? WHERE id=?`;
      await execQuery(sql, [img, postId]);
    }

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
  let promoted = true;

  try {
    if (!postId || typeof bshot !== "string") {
      return res.status(400).json({ error: "Missing postId or bshot" });
    }

    if (values?.upscale) {
      const owner = authenticatedUserId(req);
      if (!owner) return res.status(401).json({ error: "Please sign in." });
      const saved = await withTransaction(async query => {
        const rows = await query("SELECT sender, kontext, bshot FROM posts WHERE id=? FOR UPDATE", [postId]);
        if (!rows[0] || String(rows[0].sender) !== owner) return false;
        const context = parseVideoHistoryContext(rows[0].kontext);
        const metadata = values.upscale;
        const resolution = String(metadata.resolution || "").toLowerCase();
        const scene = Number(metadata.parentScene), shot = Number(metadata.bShotIndex);
        if (!["1080p", "2k"].includes(resolution) || !Number.isInteger(scene) || scene < 0 || !Number.isInteger(shot) || shot < 0) throw new Error("Invalid B-shot upscale metadata");
        const key = `B:${scene}:${shot}`;
        let truth: any = {};
        try { truth = JSON.parse(rows[0].bshot || "{}"); } catch { /* Missing original slot cannot be promoted. */ }
        promoted = metadata.promote !== false && truth?.videoarray?.[scene]?.[shot] === metadata.sourceUrl;
        const history = Array.isArray(context.bshotUpscales?.[key]) ? context.bshotUpscales[key] : [];
        history.push({ videoUrl: String(metadata.videoUrl), sourceUrl: String(metadata.sourceUrl), resolution,
          fps: 60, duration: Number(metadata.duration) || null, predictionId: String(metadata.predictionId || ""), savedAt: new Date().toISOString() });
        context.bshotUpscales = { ...context.bshotUpscales, [key]: history };
        context.imageModels = { ...normalizeImageModels(context.imageModels), ...normalizeImageModels(values.imageModels) };
        context.videoHistory = mergeVideoHistory(context.videoHistory, values.videoHistory);
        if (typeof truth?.videoarray?.[scene]?.[shot] === 'string') context.videoHistory = appendVideoHistory(context.videoHistory, key, { videoUrl: truth.videoarray[scene][shot], createdAt: 0 });
        context.videoHistory = appendVideoHistory(context.videoHistory, key, { videoUrl: metadata.sourceUrl, createdAt: 0 });
        context.videoHistory = appendVideoHistory(context.videoHistory, key, { videoUrl: metadata.videoUrl, createdAt: Date.now() });
        const retained = Array.isArray(context.retainedMedia) ? context.retainedMedia : [];
        for (const entries of Object.values(normalizeVideoHistory(context.videoHistory))) for (const entry of entries) {
          if (!retained.some((item: any) => item.url === entry.videoUrl)) retained.push({ url: entry.videoUrl, kind: 'video', role: 'video-history', deleteOnPostDelete: true });
        }
        if (/^https?:\/\//.test(metadata.sourceUrl) && !retained.some((item: any) => item.url === metadata.sourceUrl)) retained.push({ url: metadata.sourceUrl, kind: "video", role: "previous-upscale-source", deleteOnPostDelete: true });
        context.retainedMedia = retained;
        if (promoted) {
          truth.videoarray[scene][shot] = metadata.videoUrl;
          await query("UPDATE posts SET bshot=?, kontext=? WHERE id=?", [JSON.stringify(truth), JSON.stringify(context), postId]);
        } else {
          retained.push({ url: metadata.videoUrl, kind: "video", role: "completed-upscale", deleteOnPostDelete: true });
          await query("UPDATE posts SET kontext=? WHERE id=?", [JSON.stringify(context), postId]);
        }
        return true;
      });
      if (!saved) return res.status(403).json({ error: "Post not found or not owned by this account." });
    } else {
      const owner = authenticatedUserId(req);
      if (!owner) return res.status(401).json({ error: "Please sign in." });
      const saved = await withTransaction(async query => {
        const rows = await query("SELECT sender, kontext, bshot FROM posts WHERE id=? FOR UPDATE", [postId]);
        if (!rows[0] || String(rows[0].sender) !== owner) return false;
        const context = parseVideoHistoryContext(rows[0].kontext);
        context.videoHistory = mergeVideoHistory(context.videoHistory, values.videoHistory);
        context.imageModels = { ...normalizeImageModels(context.imageModels), ...normalizeImageModels(values.imageModels) };
        let previous: any = {};
        try { previous = JSON.parse(rows[0].bshot || '{}'); } catch { /* legacy empty B truth */ }
        const next = JSON.parse(bshot);
        if (!next || typeof next !== 'object' || Array.isArray(next)) throw new Error('Invalid B-shot truth');
        for (const truth of [previous, next]) {
          if (!Array.isArray(truth?.videoarray)) continue;
          truth.videoarray.forEach((clips: unknown, scene: number) => {
            if (!Array.isArray(clips)) return;
            clips.forEach((videoUrl: unknown, shot: number) => {
              if (typeof videoUrl !== 'string') return;
              context.videoHistory = appendVideoHistory(context.videoHistory, `B:${scene}:${shot}`, { videoUrl, createdAt: truth === previous ? 0 : Date.now() });
            });
          });
        }
        const retained = Array.isArray(context.retainedMedia) ? context.retainedMedia : [];
        for (const entries of Object.values(normalizeVideoHistory(context.videoHistory))) for (const entry of entries) {
          if (!retained.some((item: any) => item.url === entry.videoUrl)) retained.push({ url: entry.videoUrl, kind: 'video', role: 'video-history', deleteOnPostDelete: true });
        }
        context.retainedMedia = retained;
        if (next && typeof next === "object") {
          const nextVideoPrompts: Record<string, string> = { ...(context.videoPrompts || {}) };
          if (Array.isArray(next.textvideo)) {
            next.textvideo.forEach((scenePrompts: unknown, sIdx: number) => {
              if (!Array.isArray(scenePrompts)) return;
              scenePrompts.forEach((p: unknown, bIdx: number) => {
                if (typeof p === "string" && p.trim()) {
                  nextVideoPrompts[`B:${sIdx}:${bIdx}`] = p.trim();
                }
              });
            });
          }
          if (typeof values.videoPrompt === "string" && values.videoPrompt.trim() && values.targetKey) {
            nextVideoPrompts[String(values.targetKey)] = values.videoPrompt.trim();
          }
          context.videoPrompts = nextVideoPrompts;
        }
        const targetKey = typeof values.targetKey === 'string' ? values.targetKey : '';
        const boundTarget = /^B:(\d+):(\d+)$/.exec(targetKey);
        if (boundTarget) recordSceneVideoPlanMedia(context, values, {
          promptKey: targetKey, scene: Number(boundTarget[1]) + 1, bIndex: Number(boundTarget[2]) + 1,
        });
        else if (values.referenceUsageCaptured || values.usedReferenceVideoUrl || values.usedMotionVideoUrl) throw new Error('Video reference is missing its B-shot target.');
        await query("UPDATE posts SET bshot=?, kontext=? WHERE id=?", [bshot, JSON.stringify(context), postId]);
        return true;
      });
      if (!saved) return res.status(403).json({ error: "Post not found or not owned by this account." });
    }

    return res.json({ message: "BShot truth updated successfully", promoted });
  } catch (error) {
    console.error("Error updating bshot truth:", error);
    return res.status(500).json({ error: "Failed to update bshot truth" });
  }
};

export const SavedVideoUpscales = async (req: Request, res: any): Promise<any> => {
  const owner = authenticatedUserId(req);
  if (!owner) return res.status(401).json({ error: "Please sign in." });
  const postId = Number(req.query.postId);
  if (!Number.isInteger(postId) || postId <= 0) return res.status(400).json({ error: "Invalid postId." });
  try {
    const videoColumns = Array.from({ length: 9 }, (_, i) => `xv${i + 1}, xv${i + 1}B`).join(", ");
    const rows = await execQuery(`SELECT sender, mode, kontext, bshot, ${videoColumns} FROM posts WHERE id=?`, [postId]);
    if (!rows[0] || String(rows[0].sender) !== owner) return res.status(403).json({ error: "Post not found or not owned by this account." });
    let context: any = {};
    try { context = JSON.parse(rows[0].kontext || "{}"); } catch { /* Legacy context has no upscale metadata. */ }
    if (!context || typeof context !== "object" || Array.isArray(context)) context = {};
    let bshot: any = {};
    try { bshot = JSON.parse(rows[0].bshot || "{}"); } catch { /* Legacy B truth has no current upscale slot. */ }
    const retainedMediaUrls = new Set<string>();
    const retain = (value: unknown) => { if (typeof value === "string" && value.trim()) retainedMediaUrls.add(value.trim()); };
    const retainHistory = (history: unknown) => {
      if (Array.isArray(history)) for (const receipt of history) { retain(receipt?.sourceUrl); retain(receipt?.videoUrl); }
    };
    if (Array.isArray(context.retainedMedia)) for (const item of context.retainedMedia) if (item?.kind === "video") retain(item.url);
    const upscales: Record<string, any> = {};
    let videoHistory = normalizeVideoHistory(context.videoHistory);
    for (const [column, history] of Object.entries(context.upscales || {})) {
      retainHistory(history);
      const match = /^xv([1-9])(B?)$/.exec(column);
      if (!match || !Array.isArray(history) || !history.length) continue;
      const idx = Number(match[1]) - 1;
      const nativeIndex = Number(rows[0].mode) === 1 ? idx * 2 + (match[2] ? 1 : 0) : idx;
      for (const item of history) {
        videoHistory = appendVideoHistory(videoHistory, `A:${nativeIndex}`, { videoUrl: item?.sourceUrl, createdAt: 0 });
        videoHistory = appendVideoHistory(videoHistory, `A:${nativeIndex}`, { videoUrl: item?.videoUrl, createdAt: Number(item?.createdAt) || 0 });
      }
      const receipt = [...history].reverse().find(item => typeof item?.videoUrl === "string" && item.videoUrl === rows[0][column]);
      if (receipt) upscales[`A:${nativeIndex}`] = receipt;
    }
    for (const [key, history] of Object.entries(context.bshotUpscales || {})) {
      retainHistory(history);
      const match = /^B:(\d+):(\d+)$/.exec(key);
      if (!match || !Array.isArray(history) || !history.length) continue;
      for (const item of history) {
        videoHistory = appendVideoHistory(videoHistory, key, { videoUrl: item?.sourceUrl, createdAt: 0 });
        videoHistory = appendVideoHistory(videoHistory, key, { videoUrl: item?.videoUrl, createdAt: Number(item?.createdAt) || 0 });
      }
      const current = bshot?.videoarray?.[Number(match[1])]?.[Number(match[2])];
      const receipt = [...history].reverse().find(item => typeof item?.videoUrl === "string" && item.videoUrl === current);
      if (receipt) upscales[key] = receipt;
    }
    for (let index = 0; index < 9; index++) {
      const native = Number(rows[0].mode) === 1 ? index * 2 : index;
      for (const [column, nativeIndex] of [[`xv${index + 1}`, native], ...(Number(rows[0].mode) === 1 ? [[`xv${index + 1}B`, native + 1]] : [])] as Array<[string, number]>) {
        if (typeof rows[0][column] === 'string') videoHistory = appendVideoHistory(videoHistory, `A:${nativeIndex}`, { videoUrl: rows[0][column], createdAt: 0 });
      }
    }
    if (Array.isArray(bshot?.videoarray)) bshot.videoarray.forEach((clips: unknown, scene: number) => {
      if (Array.isArray(clips)) clips.forEach((videoUrl: unknown, shot: number) => {
        if (typeof videoUrl === 'string') videoHistory = appendVideoHistory(videoHistory, `B:${scene}:${shot}`, { videoUrl, createdAt: 0 });
      });
    });
    for (const entries of Object.values(videoHistory)) for (const entry of entries) retain(entry.videoUrl);
    return res.json({ upscales, videoHistory, retainedMediaUrls: [...retainedMediaUrls], imageModels: normalizeImageModels(context.imageModels) });
  } catch { return res.status(500).json({ error: "Could not load video upscale metadata." }); }
};

export const saveInteractiveVideo = async (
  req: any,
  res: any
): Promise<void> => {
  console.log("▶️ saveInteractiveVideo payload:", req.body);
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
        \`mode\`, \`video\`
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)
    `;

    const result = await insertPostForProfile(sql, params);
    if (!result) {
      res.status(409).json({ message: 'This Creative Profile has been removed.' });
      return;
    }
    res.json({ message: "Interactive video saved successfully" });
  } catch (error: any) {
    console.error("❌ saveInteractiveVideo error:", error);
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

export { deletePost } from './PostDeletion';

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

function packTemplateMetaServer(meta: {
  artStyle?: string;
  category?: string;
  inLibrary?: boolean;
  presetKey?: string;
  coverQuality?: 'sd' | 'hd' | 'sd2';
}): string {
  const cleanStyle = String(meta.artStyle || "").trim().slice(0, 80);
  const cleanCat = String(meta.category || "").trim().slice(0, 48);
  const cleanKey = String(meta.presetKey || "").trim().slice(0, 48);
  const inLib = meta.inLibrary === false ? 0 : 1;

  const payload: Record<string, any> = {};
  if (cleanStyle) payload.s = cleanStyle;
  if (cleanCat) payload.c = cleanCat;
  payload.l = inLib;
  if (cleanKey) payload.k = cleanKey;
  if (meta.coverQuality) payload.q = meta.coverQuality;

  const serialized = JSON.stringify(payload);
  if (serialized.length <= 250) {
    return serialized;
  }
  return JSON.stringify({
    s: cleanStyle.slice(0, 45),
    c: cleanCat.slice(0, 35),
    l: inLib,
    q: meta.coverQuality,
  });
}

function unpackTemplateMetaServer(
  rawArtStyle: unknown,
  title = "",
  prompt = ""
): {
  artStyle: string;
  category: string;
  inLibrary: boolean;
  presetKey?: string;
  coverQuality?: 'sd' | 'hd' | 'sd2';
} {
  const raw = String(rawArtStyle ?? "").trim();
  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      const parsed = JSON.parse(raw);
      const artStyle = typeof parsed?.s === "string" ? parsed.s.trim() : "";
      const rawCat = typeof parsed?.c === "string" ? parsed.c.trim() : "";
      const validCat = TEMPLATE_ASSIGNABLE_CATEGORIES.find(
        (c) => c.toLowerCase() === rawCat.toLowerCase()
      );
      return {
        artStyle,
        category:
          validCat || inferTemplateCategoryServerFallback(title, prompt, artStyle),
        inLibrary: parsed?.l !== 0,
        coverQuality: ['sd', 'hd', 'sd2'].includes(parsed?.q) ? parsed.q : undefined,
        presetKey:
          typeof parsed?.k === "string" && parsed.k.trim()
            ? parsed.k.trim()
            : undefined,
      };
    } catch {
      // Fall through to legacy plain string handling
    }
  }
  return {
    artStyle: raw,
    category: inferTemplateCategoryServerFallback(title, prompt, raw),
    inLibrary: true,
  };
}

function enrichTemplateRow(row: any): any {
  if (!row || typeof row !== "object") return row;
  const meta = unpackTemplateMetaServer(
    row.artstyle,
    row.title || "",
    row.template_prompt || ""
  );
  return {
    ...row,
    artstyle: meta.artStyle,
    category: meta.category,
    inLibrary: meta.inLibrary,
    presetKey: meta.presetKey,
    coverQuality: meta.coverQuality,
  };
}

function templateRequestUser(req: Request, res: any): number | null {
  const identity = authenticatedUserId(req);
  if (!identity) { res.status(401).json({ message: 'Please sign in to manage templates.' }); return null; }
  if (req.body?.userid != null && Number(req.body.userid) !== Number(identity)) {
    res.status(403).json({ message: 'You cannot change another member’s template library.' }); return null;
  }
  return Number(identity);
}

export const createTemplatePrompt = async (req: Request, res: any): Promise<any> => {
  const userId = templateRequestUser(req, res);
  if (!userId) return;
  const { title, template_prompt, template_image, artstyle, category, inLibrary } = req.body || {};
  if (!String(title || '').trim() || !String(template_prompt || '').trim() || String(title).startsWith('__CLIKB_')) {
    return res.status(400).json({ message: 'Template name and prompt are required.' });
  }
  const image = String(template_image || '').trim();
  let verifiedCover = false;
  let quality: 'sd' | 'hd' | 'sd2' | undefined;
  try {
    if (image) {
      const receipt = verifyTemplateCoverReceipt(req.body.coverReceipt, String(userId), image, 'new');
      verifiedCover = true; quality = receipt.quality;
      await assertStoredTemplateImage(image);
    }
    const style = unpackTemplateMetaServer(artstyle, title, template_prompt).artStyle;
    const resolvedCategory = TEMPLATE_ASSIGNABLE_CATEGORIES.find(c => c === category) ||
      await categorizeTemplateWithMiniModel(title, template_prompt, style);
    const packed = packTemplateMetaServer({ artStyle: style, category: resolvedCategory, inLibrary: inLibrary !== false,
      coverQuality: quality });
    const id = await withTransaction(async query => {
      await query('SELECT id FROM members WHERE id = ? FOR UPDATE', [userId]);
      const result: any = await query(insertTemplatePromptSQL, [userId, title.trim(), template_prompt, image, packed]);
      if (inLibrary !== false) {
        const ids = await getUserLibrarySet(userId, query); ids.add(Number(result.insertId));
        await saveUserLibrarySet(userId, ids, query);
      }
      return result.insertId;
    });
    return res.json({ message: 'Template prompt created successfully', id, category: resolvedCategory, artstyle: style, inLibrary: inLibrary !== false });
  } catch (error: any) {
    if (verifiedCover) await queueTemplateAssetCleanup(image).catch(() => {});
    void drainTemplateAssetCleanup();
    console.error('Create Template Prompt Error:', error);
    return res.status(500).json({ message: 'Could not save template. Your draft is still available.' });
  }
};

/** Shared cover contributions change only the cover, never another author's script or metadata. */
export const updateTemplateImagePrompt = async (req: Request, res: any): Promise<any> => {
  const userId = templateRequestUser(req, res);
  if (!userId) return;
  const { id, presetKey, template_image } = req.body || {};
  const image = String(template_image || '').trim();
  const key = String(presetKey || '').trim();
  let verifiedCover = false;
  try {
    if (image) await assertStoredTemplateImage(image);
    const saved = await withTransaction(async query => {
      const rows: any[] = Number(id) > 0
        ? await query('SELECT * FROM templates4prompt WHERE id = ? FOR UPDATE', [Number(id)])
        : key ? await query('SELECT * FROM templates4prompt WHERE artstyle LIKE ? LIMIT 1 FOR UPDATE', [`%"k":"${key.replace(/["%_\\]/g, '\\$&')}"%`]) : [];
      let row = rows[0];
      if (!row && key) {
        const seed = SERVER_DERIVATIVE_TEMPLATES.find(seed => seed.presetKey === key);
        if (seed) {
          const packed = packTemplateMetaServer({ artStyle: seed.artStyle, category: seed.category, inLibrary: false, presetKey: key });
          const result: any = await query(insertTemplatePromptSQL, [1, seed.name, seed.prompt, '', packed]);
          row = { id: result.insertId, userid: 1, title: seed.name, template_prompt: seed.prompt, template_image: '', artstyle: packed };
        }
      }
      if (!row || String(row.title).startsWith('__CLIKB_')) throw Object.assign(new Error('Template not found.'), { status: 404 });
      const meta = unpackTemplateMetaServer(row.artstyle, row.title, row.template_prompt);
      if (!image || image === row.template_image) return { id: row.id, template_image: row.template_image, ...meta };
      let receipt;
      try { receipt = verifyTemplateCoverReceipt(req.body.coverReceipt, String(userId), image, meta.presetKey || String(row.id)); }
      catch { throw Object.assign(new Error('Generate this cover again before saving it.'), { status: 403 }); }
      verifiedCover = true;
      const owner = process.env.APP_STATE === 'dev' || (userId !== 1 && Number(row.userid) === userId);
      if (!owner && receipt.quality === 'sd') throw Object.assign(new Error('Only the author can generate an SD cover. Shared contributions must use HD or SD2.'), { status: 403 });
      const packed = packTemplateMetaServer({ ...meta, coverQuality: receipt.quality });
      await query('UPDATE templates4prompt SET template_image = ?, artstyle = ? WHERE id = ?', [image, packed, row.id]);
      if (row.template_image) await queueTemplateAssetCleanup(row.template_image, query);
      return { id: row.id, template_image: image, ...meta, coverQuality: receipt.quality };
    });
    void drainTemplateAssetCleanup();
    return res.json({ message: 'Template saved successfully', ...saved });
  } catch (error: any) {
    if (verifiedCover) await queueTemplateAssetCleanup(image).catch(() => {});
    void drainTemplateAssetCleanup();
    return res.status(error?.status || 500).json({ message: error?.message || 'Could not save the new cover. The previous cover is unchanged.' });
  }
};


/** Update an existing template's prompt text, title, or category. Owner or dev-mode only. */
export const updateTemplateDetails = async (req: Request, res: any): Promise<any> => {
  const isDev = process.env.APP_STATE === 'dev';
  let userId = authenticatedUserId(req) ? Number(authenticatedUserId(req)) : null;
  if (!userId && isDev) {
    userId = 1; // dev mode allows guest testing
  }
  if (!userId) {
    return res.status(401).json({ message: 'Please sign in to manage templates.' });
  }
  const { id, title, prompt, category } = req.body || {};
  const templateId = Number(id);
  if (!Number.isInteger(templateId) || templateId <= 0) {
    return res.status(400).json({ message: 'Valid template id is required.' });
  }

  try {
    const updated = await withTransaction(async query => {
      const rows: any[] = await query('SELECT * FROM templates4prompt WHERE id = ? FOR UPDATE', [templateId]);
      const row = rows[0];
      if (!row || String(row.title).startsWith('__CLIKB_')) {
        throw Object.assign(new Error('Template not found.'), { status: 404 });
      }

      const isDev = process.env.APP_STATE === 'dev';
      const isOwner = userId !== 1 && Number(row.userid) === userId;
      if (!isDev && !isOwner) {
        throw Object.assign(new Error('Only the author can edit this template.'), { status: 403 });
      }

      let newTitle = row.title;
      if (typeof title === 'string' && title.trim()) {
        newTitle = title.trim().slice(0, 200);
      }

      let newPrompt = row.template_prompt;
      if (typeof prompt === 'string' && prompt.trim()) {
        newPrompt = prompt.trim();
      }

      const meta = unpackTemplateMetaServer(row.artstyle, newTitle, newPrompt);
      let newCategory = meta.category;
      if (typeof category === 'string' && category.trim()) {
        const cleanCat = category.trim();
        const validCat = TEMPLATE_ASSIGNABLE_CATEGORIES.find(
          c => c.toLowerCase() === cleanCat.toLowerCase()
        );
        if (validCat) {
          newCategory = validCat;
        }
      }

      const packed = packTemplateMetaServer({
        ...meta,
        category: newCategory,
      });

      await query(
        'UPDATE templates4prompt SET title = ?, template_prompt = ?, artstyle = ? WHERE id = ?',
        [newTitle, newPrompt, packed, templateId]
      );

      return {
        id: templateId,
        title: newTitle,
        name: newTitle,
        template_prompt: newPrompt,
        basePrompt: newPrompt,
        category: newCategory,
        artstyle: meta.artStyle,
        artStyle: meta.artStyle,
      };
    });

    return res.json({ message: 'Template updated successfully', template: updated });
  } catch (error: any) {
    console.error('Update Template Details Error:', error);
    return res.status(error?.status || 500).json({
      message: error?.message || 'Could not update template details.',
    });
  }
};

const USER_LIBRARY_ROW_TITLE = "__CLIKB_USER_LIBRARY__";
let derivativeTemplatesSeeded: Promise<void> | undefined;

async function getUserLibrarySet(userId: number, query = execQuery): Promise<Set<number>> {
  const safeUser = Number.isInteger(userId) && userId > 0 ? userId : 1;
  try {
    const rows: any[] = await query(
      `SELECT template_prompt FROM templates4prompt WHERE userid = ? AND title = ? ORDER BY id DESC LIMIT 1`,
      [safeUser, USER_LIBRARY_ROW_TITLE]
    );
    if (!rows.length) return new Set<number>();
    const parsed = JSON.parse(String(rows[0]?.template_prompt || "[]"));
    if (!Array.isArray(parsed)) return new Set<number>();
    return new Set<number>(
      parsed.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
    );
  } catch (error) { throw error; }
}

async function saveUserLibrarySet(userId: number, ids: Set<number>, query = execQuery): Promise<number[]> {
  const safeUser = Number.isInteger(userId) && userId > 0 ? userId : 1;
  const cleanList = Array.from(ids).filter((n) => Number.isInteger(n) && n > 0);
  const serialized = JSON.stringify(cleanList);
  const rows: any[] = await query(
    `SELECT id FROM templates4prompt WHERE userid = ? AND title = ? ORDER BY id DESC LIMIT 1`,
    [safeUser, USER_LIBRARY_ROW_TITLE]
  );
  if (rows.length > 0) {
    await query(
      `UPDATE templates4prompt SET template_prompt = ? WHERE id = ?`,
      [serialized, rows[0].id]
    );
  } else {
    await query(insertTemplatePromptSQL, [
      safeUser,
      USER_LIBRARY_ROW_TITLE,
      serialized,
      "",
      "{}",
    ]);
  }
  return cleanList;
}

async function ensureDerivativeTemplatesSeeded(): Promise<void> {
  if (derivativeTemplatesSeeded) return derivativeTemplatesSeeded;
  derivativeTemplatesSeeded = (async () => {
    const existingRows: any[] = await execQuery(
      `SELECT id, title, artstyle FROM templates4prompt WHERE title <> ?`,
      [USER_LIBRARY_ROW_TITLE]
    );
    const existingKeys = new Set<string>();
    const existingTitles = new Set<string>();
    for (const r of existingRows) {
      existingTitles.add(String(r.title || "").trim().toLowerCase());
      const meta = unpackTemplateMetaServer(r.artstyle, r.title || "", "");
      if (meta.presetKey) existingKeys.add(meta.presetKey);
    }

    for (const seed of SERVER_DERIVATIVE_TEMPLATES) {
      if (
        existingKeys.has(seed.presetKey) ||
        existingTitles.has(seed.name.trim().toLowerCase())
      ) {
        continue;
      }
      const packed = packTemplateMetaServer({
        artStyle: seed.artStyle,
        category: seed.category,
        inLibrary: false,
        presetKey: seed.presetKey,
      });
      await execQuery(insertTemplatePromptSQL, [
        1,
        seed.name,
        seed.prompt,
        "",
        packed,
      ]);
    }
  })().catch(error => { derivativeTemplatesSeeded = undefined; throw error; });
  return derivativeTemplatesSeeded;
}

export const toggleTemplateLibraryPrompt = async (req: Request, res: any): Promise<any> => {
  const userId = templateRequestUser(req, res);
  if (!userId) return;
  const id = Number(req.body?.templateId);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Valid templateId is required.' });
  try {
    const result = await withTransaction(async query => {
      const rows: any[] = await query('SELECT id,title FROM templates4prompt WHERE id = ? FOR UPDATE', [id]);
      if (!rows.length || String(rows[0].title).startsWith('__CLIKB_')) throw Object.assign(new Error('Template not found.'), { status: 404 });
      await query('SELECT id FROM members WHERE id = ? FOR UPDATE', [userId]);
      const ids = await getUserLibrarySet(userId, query);
      const inLibrary = typeof req.body.inLibrary === 'boolean' ? req.body.inLibrary : !ids.has(id);
      if (inLibrary) ids.add(id); else ids.delete(id);
      return { id, inLibrary, favoriteIds: await saveUserLibrarySet(userId, ids, query) };
    });
    return res.json(result);
  } catch (error: any) { return res.status(error?.status || 500).json({ message: error?.message || 'Could not update your Library.' }); }
};

// SQL for getting templates
const getTemplatesPromptSQL = `
    SELECT * FROM templates4prompt
    WHERE LEFT(title,8) <> '__CLIKB_'
    ORDER BY (CASE WHEN template_image IS NOT NULL AND template_image <> '' THEN 0 ELSE 1 END) ASC, time DESC, id DESC
    LIMIT ? OFFSET ?
`;

export const getTemplatesPrompt = async (
  req: Request,
  res: any
): Promise<any> => {
  try {
    await ensureDerivativeTemplatesSeeded();
    const limit = parseInt(req.query.limit as string) || 250;
    const offset = parseInt(req.query.offset as string) || 0;
    const reqUserId = Number(authenticatedUserId(req)) || 1;
    if (req.query.userid != null && Number(req.query.userid) !== reqUserId) return res.status(403).json({ message: 'You can only read your own Library.' });
    void drainTemplateAssetCleanup();

    const [results, userLibSet]: [any[], Set<number>] = await Promise.all([
      execQuery(getTemplatesPromptSQL, [limit, offset]),
      getUserLibrarySet(reqUserId),
    ]);
    const enriched = results.map((row) => {
      const base = enrichTemplateRow(row);
      return {
        ...base,
        inLibrary: userLibSet.has(Number(row.id)),
      };
    });
    return res.json({ templates: enriched });
  } catch (e: any) {
    console.error("Get Templates Prompt Error:", e);
    return res.status(500).send({ message: "Error fetching template prompts" });
  }
};

type TemplateShowcaseMode = "shorts" | "cinema" | "games";

const templateShowcaseColumns: Record<TemplateShowcaseMode, string> = {
  shorts: "useforshowcase",
  cinema: "useforshowcase2",
  games: "useforshowcase3",
};

const templateShowcaseModes: TemplateShowcaseMode[] = [
  "shorts",
  "cinema",
  "games",
];

const getShowcaseTemplatesPromptSQL = (
  mode: TemplateShowcaseMode,
  column: string
): string => `
    SELECT id, userid, title, template_prompt, template_image, artstyle, time,
           useforshowcase, useforshowcase2, useforshowcase3,
           '${mode}' AS showcase_mode,
           ${column} AS showcase_order
    FROM templates4prompt
    WHERE ${column} > 0
    ORDER BY ${column} ASC, time DESC
    LIMIT ?
`;

export const getShowcaseTemplatesPrompt = async (
  req: Request,
  res: any
): Promise<any> => {
  const requestedLimit = Number.parseInt(String(req.query.limit || ""), 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(20, Math.max(1, requestedLimit))
    : 12;

  try {
    const modeResults = await Promise.all(
      templateShowcaseModes.map((mode) =>
        execQuery(
          getShowcaseTemplatesPromptSQL(mode, templateShowcaseColumns[mode]),
          [limit]
        )
      )
    );
    return res.json({ templates: modeResults.flat().map(enrichTemplateRow) });
  } catch (e: any) {
    console.error("Get Showcase Templates Prompt Error:", e);
    return res
      .status(500)
      .send({ message: "Error fetching showcase templates" });
  }
};

const getTemplateShowcasePositionSQL = (column: string): string => `
    SELECT ${column} AS showcase_order
    FROM templates4prompt
    WHERE id = ?
    LIMIT 1
`;

const getNextTemplateShowcasePositionSQL = (column: string): string => `
    SELECT COALESCE(MAX(${column}), 0) + 1 AS nextPosition
    FROM templates4prompt
`;

const updateTemplateShowcasePositionSQL = (column: string): string => `
    UPDATE templates4prompt
    SET ${column} = ?
    WHERE id = ?
`;

const compactTemplateShowcasePositionsSQL = (column: string): string => `
    UPDATE templates4prompt
    SET ${column} = ${column} - 1
    WHERE ${column} > ?
`;

const getOrderedTemplateShowcasePositionsSQL = (column: string): string => `
    SELECT id, ${column} AS showcase_order
    FROM templates4prompt
    WHERE ${column} > 0
    ORDER BY ${column} ASC, time DESC, id DESC
`;

const normalizeTemplateShowcasePositions = async (
  column: string
): Promise<void> => {
  const activeRows: any[] = await execQuery(
    getOrderedTemplateShowcasePositionsSQL(column),
    []
  );

  for (let index = 0; index < activeRows.length; index += 1) {
    const expectedPosition = index + 1;
    if (Number(activeRows[index]?.showcase_order) === expectedPosition)
      continue;
    await execQuery(updateTemplateShowcasePositionSQL(column), [
      expectedPosition,
      activeRows[index].id,
    ]);
  }
};

export const updateTemplateShowcase = async (
  req: Request,
  res: any
): Promise<any> => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).send({ message: "Route not found" });
  }

  const id = Number(req.body?.id);
  const requestedMode = String(
    req.body?.mode || "shorts"
  ).toLowerCase() as TemplateShowcaseMode;
  const requestedValue = req.body?.useforshowcase;
  const isValidMode = templateShowcaseModes.includes(requestedMode);
  const isValidValue =
    requestedValue === true ||
    requestedValue === false ||
    requestedValue === 1 ||
    requestedValue === 0;

  if (!Number.isInteger(id) || id <= 0 || !isValidMode || !isValidValue) {
    return res.status(400).send({
      message:
        "A valid template id, showcase mode, and boolean useforshowcase value are required",
    });
  }

  const shouldUseForShowcase = requestedValue === true || requestedValue === 1;
  const showcaseColumn = templateShowcaseColumns[requestedMode];

  try {
    // Upgrades legacy boolean rows (where every active template was `1`) only
    // when a developer next edits the showcase, preserving the current order.
    await normalizeTemplateShowcasePositions(showcaseColumn);

    const existingRows: any[] = await execQuery(
      getTemplateShowcasePositionSQL(showcaseColumn),
      [id]
    );
    if (!existingRows.length) {
      return res.status(404).send({ message: "Template not found" });
    }

    const currentPosition = Math.max(
      0,
      Number(existingRows[0]?.showcase_order) || 0
    );
    let nextPosition = currentPosition;

    if (shouldUseForShowcase && currentPosition === 0) {
      const positionRows: any[] = await execQuery(
        getNextTemplateShowcasePositionSQL(showcaseColumn),
        []
      );
      nextPosition = Math.max(1, Number(positionRows[0]?.nextPosition) || 1);
      await execQuery(updateTemplateShowcasePositionSQL(showcaseColumn), [
        nextPosition,
        id,
      ]);
    } else if (!shouldUseForShowcase && currentPosition > 0) {
      await execQuery(updateTemplateShowcasePositionSQL(showcaseColumn), [
        0,
        id,
      ]);
      await execQuery(compactTemplateShowcasePositionsSQL(showcaseColumn), [
        currentPosition,
      ]);
      nextPosition = 0;
    }

    return res.send({
      message:
        nextPosition > 0
          ? `Template added to showcase at position ${nextPosition}`
          : "Template removed from showcase",
      id,
      mode: requestedMode,
      useforshowcase: nextPosition,
    });
  } catch (e: any) {
    console.error("Update Template Showcase Error:", e);
    return res
      .status(500)
      .send({ message: "Error updating template showcase status" });
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

const parseRagInstructionPacket = (
  instructions: string
): RagInstructionPacketMeta => {
  const text = String(instructions || "");
  const packetHeaderMatch = text.match(
    /\[RAG[^\]]*\]\s+([a-zA-Z0-9_-]+)\s+Object\s*\{/
  );
  const docIdMatch =
    text.match(/metadata:\s*\{[\s\S]*?docId:\s*"([^"]+)"/) || packetHeaderMatch;
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

/** Internal exact lookup for a live snapshot mode; no user-provided SQL identifiers. */
export const findUploadedRagInstructionById = async (ragId: string): Promise<{
  ragId: string;
  title: string;
  instructions: string;
} | null> => {
  const normalized = normalizeRagId(ragId);
  if (!normalized) return null;
  const rows: any[] = await execQuery(getRagInstructionByIdSQL, [normalized]);
  const row = rows[0];
  return row ? {
    ragId: String(row.rag_id),
    title: String(row.title),
    instructions: String(row.instructions),
  } : null;
};

const getRagInstructionsSQL = `
    SELECT id, rag_id, title, instructions
    FROM rag_instructions
    ORDER BY id DESC
`;

const deleteRagInstructionSQL = `
    DELETE FROM rag_instructions
    WHERE rag_id = ?
`;

export const uploadRagInstruction = async (
  req: Request,
  res: any
): Promise<any> => {
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
    const ragInstruction = rows[0] || {
      id: 0,
      rag_id: ragId,
      title,
      instructions,
    };

    return res.send({
      message: "RAG instruction uploaded, indexed, and saved successfully",
      ragInstruction,
      ragIndex,
    });
  } catch (e: any) {
    console.error("Upload RAG Instruction Error:", e);
    const statusCode = e?.statusCode || 500;
    return res
      .status(statusCode)
      .send({ message: e?.message || "Error uploading RAG instruction" });
  }
};

export const getRagInstructions = async (
  req: Request,
  res: any
): Promise<any> => {
  try {
    const results: any[] = await execQuery(getRagInstructionsSQL);
    let sessionMemoryRows: any[] = [];

    const includeSessionMemory =
      String(req.query?.includeSessionMemory || "") === "1";
    if (process.env.APP_STATE === "dev" && includeSessionMemory) {
      sessionMemoryRows = await listBrainstormSessionMemoryDevRows({
        userId: String(req.query?.userId || ""),
        username: String(req.query?.username || ""),
        sessionId: String(req.query?.sessionId || ""),
        deviceId: String(req.query?.deviceId || ""),
      });
    }

    return res.json({ ragInstructions: [...sessionMemoryRows, ...results] });
  } catch (e: any) {
    console.error("Get RAG Instructions Error:", e);
    return res.status(500).send({ message: "Error fetching RAG instructions" });
  }
};

export const deleteRagInstruction = async (
  req: Request,
  res: any
): Promise<any> => {
  const { ragId, confirmation } = req.body || {};
  const normalizedRagId = normalizeRagId(ragId || "");

  if (!normalizedRagId) {
    return res.status(400).send({ message: "Missing RAG id" });
  }

  if (confirmation !== "delete") {
    return res
      .status(400)
      .send({ message: "Type delete to confirm RAG deletion" });
  }

  try {
    const rows: any[] = await execQuery(getRagInstructionByIdSQL, [
      normalizedRagId,
    ]);
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
    return res
      .status(statusCode)
      .send({ message: e?.message || "Error deleting RAG instruction" });
  }
};

export const deleteTemplatePrompt = async (req: Request, res: any): Promise<any> => {
  const userId = templateRequestUser(req, res);
  if (!userId) return;
  const id = Number(req.body?.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Valid template id is required.' });
  try {
    await withTransaction(async query => {
      const rows: any[] = await query('SELECT userid,title,template_image FROM templates4prompt WHERE id = ? FOR UPDATE', [id]);
      const row = rows[0];
      if (!row || (process.env.APP_STATE !== 'dev' && (Number(row.userid) !== userId || userId === 1)) || String(row.title).startsWith('__CLIKB_')) throw Object.assign(new Error('Only the author can delete this template.'), { status: 403 });
      await query('DELETE FROM templates4prompt WHERE id = ? AND userid = ?', [id, Number(row.userid)]);
      const libraries: any[] = await query('SELECT id,template_prompt FROM templates4prompt WHERE title = ? ORDER BY id FOR UPDATE', [USER_LIBRARY_ROW_TITLE]);
      for (const library of libraries) {
        const ids: unknown = JSON.parse(library.template_prompt);
        if (!Array.isArray(ids)) throw new Error('Library data could not be read.');
        if (ids.some(value => Number(value) === id)) await query('UPDATE templates4prompt SET template_prompt = ? WHERE id = ?', [JSON.stringify(ids.filter(value => Number(value) !== id)), library.id]);
      }
      if (row.template_image) await queueTemplateAssetCleanup(row.template_image, query);
    });
    void drainTemplateAssetCleanup();
    return res.json({ message: 'Template deleted successfully' });
  } catch (error: any) { return res.status(error?.status || 500).json({ message: error?.message || 'Could not delete template.' }); }
};

const getArtstyleImagesSQL = `
    SELECT artstyle_name, image_url 
    FROM artstyle_images
`;

export const getArtstyleImages = async (
  _req: Request,
  res: any
): Promise<any> => {
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

export const saveArtstyleImage = async (
  req: Request,
  res: any
): Promise<any> => {
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
