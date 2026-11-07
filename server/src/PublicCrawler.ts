import { Router } from "express";

const origin = "https://clikb.com";
// Explicit names only. An ordinary browser (including HeadlessChrome) stays on React.
export const isContentCrawler = (ua: string) => /(?:^|[\s;(])(?:Googlebot(?:-Image|-Video)?|Google-InspectionTool|bingbot|BingPreview|DuckDuckBot|Applebot|YandexBot|Baiduspider|OAI-SearchBot|ChatGPT-User|GPTBot|ClaudeBot|Claude-SearchBot|Claude-User|PerplexityBot|Perplexity-User|Amazonbot|FacebookExternalHit|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot-LinkExpanding|Discordbot|WhatsApp|TelegramBot|SkypeUriPreview|Pinterestbot|redditbot|vkShare|Snapchat)(?:[\/\s;)]|$)/i.test(ua);

export const publicFeatures = [
  ["AI content creation and storyboards", "Turn a text prompt into scene plans, image previews and a storyboard. Review characters and environments, refine scenes and create AI images and videos."],
  ["Shorts and cinematic stories", "Create short-form content with Shorts or build cinematic stories with Cinema. Cinema supports paired Stage A and Stage B scenes, scene images, video clips and narration."],
  ["Scene editing and visual prompts", "Edit individual scenes with text instructions, image references and visual prompts. Adjust camera direction, subject motion, clip duration and supported video models."],
  ["Three.js motion references for AI video", "Motion Guide turns a prompt into a basic Three.js animation showing object movement and camera motion. Preview, enlarge, edit or delete the guide, then use its exported video as a motion reference with a supported reference-video model. Scene images can provide appearance references."],
  ["Interactive stories and games", "Create interactive scenes, branching experiences and video interactions with swipe or touch hotspots. Review the scene structure and connect interactions in the creation workflow."],
  ["Spatial interactions and connected scenes", "Build an interactive experience from connected stages and scene nodes. Configure movement paths, action clips and links between stages. Viewers use directional controls to move along the configured paths, trigger available actions and return to previous nodes or stages. A visual map helps viewers explore the scene connections. Preview the spatial experience before publishing."],
  ["Narration, audio and publishing", "Work with scene narration, music and video audio where supported, then publish creations to the ClikB feed. Guests can browse published images, videos and interactive content."],
];
const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const json = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");
const mediaUrl = (value: unknown): string => {
  if (typeof value !== "string" || !/^(https?:\/\/|\/[^/])/i.test(value)) return "";
  try { const url = new URL(value, origin); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
};
export const positiveId = (value: unknown): number | undefined => {
  if (typeof value !== "string" || !/^[1-9]\d{0,14}$/.test(value)) return undefined;
  const id = Number(value); return Number.isSafeInteger(id) ? id : undefined;
};
type Post = Record<string, any>;
type Reader = (options: { post?: number; before?: number; related?: number[] }) => Promise<Post[]>;
type IdReader = (before?: number) => Promise<Array<{ id: number }>>;
const postUrl = (id: number) => `${origin}/experience/${id}`;
const defaultShareImage = `${origin}/clikb-og.png`;
const isLikelyVideo = (value: string): boolean => {
  try { return /\.(?:mp4|webm|mov|m4v|avi)$/i.test(new URL(value).pathname); } catch { return false; }
};
const postImages = (post: Post): string[] => {
  const stages = Array.from({ length: 9 }, (_, i) => i + 1);
  return [...new Set([
    post.thumb1,
    post.item1,
    ...stages.flatMap(i => [post[`xh${i}`] || post[`x${i}`], post[`xh${i}B`] || post[`x${i}B`]]),
  ].map(mediaUrl).filter(url => !!url && !isLikelyVideo(url)))];
};
const creationKind = (post: Post): string => {
  if (post.spatialExperienceJson || post.spatial_experience_json) return "Spatial interactive AI video";
  if (post.touchConfigJson || post.touch_config_json || post.interactionFormat) return "Hotspot interactive AI video";
  if (post.videoUrl || post.main || post.nobgmvideo) return "AI video";
  return "AI creation";
};

export function renderPublicFeed(posts: Post[], canonical: string, single: boolean, more: boolean) {
  const selected = posts[0] || {};
  const label = String(selected.caption || selected.topic || "ClikB creation").trim();
  const kind = creationKind(selected);
  const title = single ? `${label.slice(0, 120)} — ClikB` : "ClikB — AI content creation, storyboards, videos and interactive stories";
  const summary = single
    ? `${label || "A public creation"} — ${kind} by ${String(selected.username || "a ClikB creator")}.`.slice(0, 280)
    : "Create AI storyboards, images, videos and interactive stories from prompts. Direct camera movement with Three.js motion references and explore public creations.";
  const shareImage = single ? (postImages(selected)[0] || defaultShareImage) : defaultShareImage;
  const selectedHasVideo = !!(selected.videoUrl || selected.main || selected.nobgmvideo || Array.from({ length: 9 }, (_, i) => i + 1).some(i => selected[`xv${i}`] || selected[`xv${i}B`]));
  const articles = posts.map(p => {
    const label = String(p.caption || p.topic || `Creation ${p.id}`);
    const stages = Array.from({ length: 9 }, (_, i) => i + 1);
    const images = postImages(p);
    const videos = [...new Set([p.main, p.videoUrl, p.nobgmvideo, ...stages.flatMap(i => [p[`xv${i}`], p[`xv${i}B`]])].map(mediaUrl).filter(Boolean))];
    const date = p.time ? new Date(p.time) : null;
    const published = date && Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
    const data = { "@type": "CreativeWork", "@id": postUrl(p.id), url: postUrl(p.id), name: label, description: String(p.caption || ""), datePublished: published, author: { "@type": "Person", name: String(p.username || "ClikB creator") }, image: images,
      video: videos.map(url => ({ "@type": "VideoObject", name: label, description: String(label), contentUrl: url, thumbnailUrl: images[0] || undefined, uploadDate: published })),
    };
    return { data, html: `<article><h2><a href="${escape(postUrl(p.id))}">${escape(label)}</a></h2><p>By ${escape(p.username || "ClikB creator")}</p>${images.map(url => `<img src="${escape(url)}" alt="${escape(label)}" loading="lazy">`).join("")}${videos.map(url => `<video controls preload="none" src="${escape(url)}"${images[0] ? ` poster="${escape(images[0])}"` : ""}></video>`).join("")}</article>` };
  });
  const schema = { "@context": "https://schema.org", "@graph": [
    { "@type": "WebSite", "@id": `${origin}/#website`, name: "ClikB", url: origin },
    ...(!single ? [{ "@type": "SoftwareApplication", name: "ClikB", applicationCategory: "MultimediaApplication", operatingSystem: "Web browser", url: origin, description: summary, featureList: publicFeatures.map(([name, text]) => `${name}: ${text}`) }] : []),
    ...articles.map(a => a.data),
  ] };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><meta name="description" content="${escape(summary)}"><link rel="canonical" href="${escape(canonical)}"><meta property="og:site_name" content="ClikB"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(summary)}"><meta property="og:url" content="${escape(canonical)}"><meta property="og:type" content="${single ? (selectedHasVideo ? "video.other" : "article") : "website"}"><meta property="og:image" content="${escape(shareImage)}"><meta property="og:image:alt" content="${escape(single ? label : "Create with ClikB")}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(summary)}"><meta name="twitter:image" content="${escape(shareImage)}"><script type="application/ld+json">${json(schema)}</script></head><body><main><h1>${escape(title)}</h1>${!single ? publicFeatures.map(([name, text]) => `<section><h2>${escape(name)}</h2><p>${escape(text)}</p></section>`).join("") : ""}<nav><a href="/feeds">Public creations</a><a href="/about/">About ClikB</a><a href="/how-it-works/">How ClikB works</a></nav>${articles.map(a => a.html).join("")}${more && posts.length ? `<a rel="next" href="/feeds?before=${posts[posts.length - 1].id}">Older creations</a>` : ""}</main></body></html>`;
}

export function createPublicCrawlerRouter(readPosts: Reader, readIds: IdReader) {
  const router = Router();
  // Applied to BOTH variants before express.static; no shared cached bot HTML.
  router.use((req, res, next) => {
    if (["/", "/feeds", "/feeds/"].includes(req.path.toLowerCase()) || /^\/experience\/[1-9]\d{0,14}\/?$/i.test(req.path)) {
      res.vary("User-Agent"); res.set("Cache-Control", "private, no-store");
      res.set("CDN-Cache-Control", "no-store"); res.set("Surrogate-Control", "no-store");
    }
    next();
  });
  router.get("/api/public-post/:id", async (req, res) => {
    const post = positiveId(req.params.id);
    res.set("Cache-Control", "no-store");
    if (!post) { res.status(400).json({ message: "Invalid post" }); return; }
    const related = typeof req.query.related === 'string' && req.query.related.length < 500
      ? req.query.related.split(',').map(positiveId).filter((id): id is number => id !== undefined).slice(0, 27)
      : undefined;
    try { const rows = await readPosts({ post, related }); res.status(rows.length ? 200 : 404).json({ payload: rows }); }
    catch { res.status(503).json({ message: "Public content temporarily unavailable" }); }
  });
  // Preserve old shared links while establishing one stable canonical URL.
  router.get(["/feeds", "/feeds/"], (req, res, next) => {
    if (req.query.post === undefined) { next(); return; }
    const post = positiveId(req.query.post);
    if (!post) { res.status(400).type("text").send("Invalid content URL"); return; }
    res.redirect(301, `/experience/${post}`);
  });
  router.get("/sitemap.xml", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${origin}/sitemap-pages.xml</loc></sitemap><sitemap><loc>${origin}/sitemap-posts.xml</loc></sitemap></sitemapindex>`);
  });
  router.get("/sitemap-posts.xml", async (req, res) => {
    const before = positiveId(req.query.before);
    res.set("Cache-Control", "no-store");
    if (req.query.before !== undefined && !before) { res.status(400).end(); return; }
    try {
      const rows = await readIds(before);
      // The first 1,000 posts are listed directly; a crawlable cursor page
      // leads to every older post without an unbounded sitemap DB query.
      const entries = rows.slice(0, 1000).map(p => postUrl(p.id));
      if (rows.length > 1000) entries.push(`${origin}/feeds?before=${rows[999].id}`);
      res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map(url => `<url><loc>${escape(url)}</loc></url>`).join("")}</urlset>`);
    } catch { res.set("Retry-After", "60").status(503).end(); }
  });
  router.get("/experience/:id", async (req, res, next) => {
    const post = positiveId(req.params.id);
    if (!post) { res.status(400).type("text").send("Invalid content URL"); return; }
    if (!isContentCrawler(req.get("user-agent") || "")) { next(); return; }
    try {
      const rows = await readPosts({ post });
      if (!rows.length) { res.status(404).type("text").send("Creation not found"); return; }
      res.type("html").send(renderPublicFeed(rows, postUrl(post), true, false));
    } catch { res.set("Retry-After", "60").status(503).type("text").send("Public content temporarily unavailable"); }
  });
  router.get(["/", "/feeds", "/feeds/"], async (req, res, next) => {
    if (!isContentCrawler(req.get("user-agent") || "")) { next(); return; }
    const post = positiveId(req.query.post), before = positiveId(req.query.before);
    if ((req.query.post !== undefined && !post) || (req.query.before !== undefined && !before)) { res.status(400).type("text").send("Invalid content URL"); return; }
    try {
      const rows = await readPosts({ post, before });
      if (post && !rows.length) { res.status(404).type("text").send("Creation not found"); return; }
      const canonical = post ? postUrl(post) : before ? `${origin}/feeds?before=${before}` : `${origin}/`;
      res.type("html").send(renderPublicFeed(rows, canonical, !!post, !post && rows.length === 28));
    } catch { res.set("Retry-After", "60").status(503).type("text").send("Public content temporarily unavailable"); }
  });
  return router;
}
