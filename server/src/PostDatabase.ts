import { Request } from "express";
import execQuery from "./execQuery";
import dotenv from "dotenv";
dotenv.config(); // Load environment variables from .env file

const createpostX = `INSERT INTO posts (sender,post_count,topic,caption,item1,thumb1,time,private)
   VALUES (?,?,?,?,?,?,?,?)`;

const createsong = `INSERT INTO music (sender,song,name)
   VALUES (?,?,?)`;

const callsong = `SELECT id, sender,name, song
                     FROM music
                     ORDER BY id DESC`;

const createpostXStory = `INSERT INTO posts (sender,post_count,topic,caption,item1,thumb1,x1,x2,x3,x4,x5,x6,x7,x8,xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,
xt1,xt2,xt3,xt4,xt5,xt6,xt7,xt8,time,private,mode,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?  )`;

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
  mode, x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8
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
  mode, x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8
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
  mode, x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8
FROM posts
INNER JOIN members ON posts.sender = members.id
LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)
WHERE posts.mode = 0 and posts.id < ?
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
  mode, x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8, captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,
  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8
  
FROM posts
INNER JOIN members ON posts.sender = members.id
LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)
WHERE posts.mode = 1 and posts.video= 1
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
  mode, x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,
  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8
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
  mode, x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,
  xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8
FROM posts
INNER JOIN members ON posts.sender = members.id
LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)
WHERE posts.mode = 1 and posts.id < ? and posts.video= 1
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
    mode, x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,private ,captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,
    xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8

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
    mode,x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,private ,captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,
    xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8
    
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
    mode,x1, xt1, x2, xt2, x3, xt3, x4, xt4, x5, xt5, x6, xt6, x7, xt7, x8, xt8,private ,captionSummary,captionAudio,xa1,xa2,xa3,xa4,xa5,xa6,xa7,xa8,
    xh1,xh2,xh3,xh4,xh5,xh6,xh7,xh8,gent1,gent2,gent3,gent4,gent5,gent6,gent7,gent8,xv1,xv2,xv3,xv4,xv5,xv6,xv7,xv8
    
FROM posts

INNER JOIN members ON posts.sender = members.id 

LEFT JOIN members AS m ON m.id = (SELECT commented_by FROM comments WHERE post = posts.id ORDER BY date DESC LIMIT 1)

WHERE  posts.sender = ? AND posts.id < ?  

ORDER BY posts.id DESC
LIMIT 28;



`;

export const getFeedsMore = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  console.log(values.lastId);

  if (values) {
    try {
      var chronologicaldata: any = null;

      if (values.override) {
        chronologicaldata = await execQuery(postsxMoreO, [
          values.id,
          values.id2,
          values.lastId,
        ]);
      } else {
        chronologicaldata = await execQuery(postsxMore, [
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

export const getFeeds = async (req: Request, res: any): Promise<any> => {
  const { values } = req.body;

  //console.log(values);

  if (values) {
    try {
      const chronologicaldata = await execQuery(postsx, [
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
          values.id2,
          values.lastId,
        ]);
      } else {
        chronologicaldata = await execQuery(postsxMoreStory, [
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

  // Collect up to 8 images, defaulting to null if not present.
  const images = [];

  const imagesHd = [];

  const txts = [];

  const gent = [];

  for (let i = 1; i <= 8; i++) {
    images.push(values[`image${i}`] ? values[`image${i}`] : null);
  }

  for (let i = 1; i <= 8; i++) {
    imagesHd.push(values[`imageHd${i}`] ? values[`imageHd${i}`] : null);
  }

  for (let i = 1; i <= 8; i++) {
    txts.push(values[`txt${i}`] ? values[`txt${i}`] : null);
  }

  for (let i = 1; i <= 8; i++) {
    gent.push(values[`GeneratedText${i}`] ? values[`GeneratedText${i}`] : null);
  }

  try {
    const result = await execQuery(createpostXStory, [
      values.id || null, // user ID
      1, // some hardcoded value from original code
      values.topic || "", // topic field (or empty if none provided)
      values.caption || "", // caption
      values.image1,
      "",
      ...images, // image1..image8 (up to 8 placeholders)
      ...imagesHd,
      ...txts,
      currentTime, // timestamp
      1, // possibly a status/flag field
      values.mode || 0,
      ...gent,
    ]);

    const insertedId = result.insertId;
    return res.send({ go: insertedId, message: "images uploaded" });
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
        values.id,
        values.id2,
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
          values.id,
          values.id2,
          values.id,
          values.lastId,
        ]);
      } else {
        chronologicaldata = await execQuery(profile_more, [
          values.id,
          values.id2,
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
        videoUrl = ?
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

  // Extract needed fields from the incoming 'values'
  const { postId, type, vid } = values;

  try {
    // Construct the UPDATE statement for the columns we want to change
    // We assume the table's primary key is 'id', so we match WHERE id = ?

    var vidx = "";

    const queries = [
      ` UPDATE posts SET xv1=? WHERE id = ? `,
      ` UPDATE posts SET xv2=? WHERE id = ? `,
      ` UPDATE posts SET xv3=? WHERE id = ? `,
      ` UPDATE posts SET xv4=? WHERE id = ? `,
      ` UPDATE posts SET xv5=? WHERE id = ? `,
      ` UPDATE posts SET xv6=? WHERE id = ? `,
      ` UPDATE posts SET xv7=? WHERE id = ? `,
      ` UPDATE posts SET xv8=? WHERE id = ? `,
    ];

    // example type number (1 through 8)
    vidx = queries[type]; // adjust for zero-based indexing

    // We'll pass x1 -> xa1, x2 -> xa2, etc.
    const params = [
      vid,
      postId, // condition in WHERE clause
    ];

    await execQuery(vidx, params);

    res.json({ message: "Audio data updated successfully" });
  } catch (error) {
    console.error("Error updating audio data:", error);
    res.status(500).json({ error: "Failed to update audio data" });
  }
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
        \`mode\`
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;

    await execQuery(sql, params);

    res.json({ message: "Interactive video saved successfully" });
  } catch (error: any) {
    console.error("❌ saveInteractiveVideo error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

export const getFeedClik = async (req: Request, res: any): Promise<any> => {
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
  const { postId, finalUrl } = values;

  try {
    // Construct the UPDATE statement for the columns we want to change
    // We assume the table's primary key is 'id', so we match WHERE id = ?
    const sql = `
      UPDATE posts
      SET 
       x1=?
      WHERE id = ?
    `;

    // We'll pass x1 -> xa1, x2 -> xa2, etc.
    const params = [
      finalUrl,
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
