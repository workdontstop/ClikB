import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const origin = 'https://clikb.com';
const description = 'Start with one text prompt, then direct ClikB’s AI-assisted, human-in-the-loop orchestration to create AI videos, memes, stories, music videos, and hotspot or spatial interactive video experiences.';
const assistedCreationSummary = 'A conversational AI concierge assists throughout creation with planning and refinement. For one-shot video generation, an editable Three.js Motion Guide layer creates choreography and camera-motion reference videos for compatible AI video models.';
const shareImage = `${origin}/clikb-og.png`;
const pages = [
  ['about', 'About ClikB', description, [
    ['What is ClikB?', description],
    ['Conversational AI creation concierge', 'Use ClikB’s conversational AI concierge throughout creation to understand the current project, explore ideas, plan changes and refine the work while you remain in control.'],
    ['What can I create?', 'Use ClikB for stories, explanations, demonstrations, humour, music videos and interactive experiences. Choose Shorts, Cinema or an interactive workflow to fit your idea.'],
    ['Creative control', 'Start with a prompt and optional style, world, character or image references. Review your scenes, edit image prompts and choose which images, videos and audio to generate.'],
    ['AI storyboard creation', 'Develop a prompt into a scene plan and visual storyboard. Review characters, environments and image previews, then refine individual scenes before generating video.'],
    ['Three.js one-shot Motion Guide', 'Create and edit a Three.js motion layer from text to direct subject choreography, relative positions, timing and camera movement for a single shot. Export it as a reference video for a compatible AI video model, alongside scene image references for finished appearance.'],
  ]],
  ['how-it-works', 'How ClikB works', 'From your first prompt to scenes, images, video, audio and interactive playback: learn the ClikB creation workflow.', [
    ['1. Describe your idea', 'Enter a request and select a creation mode. Add details such as style, characters, references or your own scenes when useful.'],
    ['Conversational help during creation', 'A project-aware conversational AI concierge can help you explore ideas, understand the current creation and refine your direction throughout the workflow.'],
    ['2. Review the scene plan', 'ClikB develops your request into scenes and prepares visual direction. Cinema uses paired Stage A and Stage B depictions for each logical scene.'],
    ['3. Create and refine', 'Review scene images and edit prompts. Depending on the workflow, add generated video, narration, music or optional user-directed supporting shots.'],
    ['4. Publish and experience', 'Publish or render your creation, then watch it or interact with it in the player. Interactive workflows can use hotspots, branching scenes or spatial configuration.'],
  ]],
  ['ai-video-creator', 'AI video creation with ClikB', 'Create short videos and cinematic stories from your ideas with ClikB scene planning, image editing, video generation and audio tools.', [
    ['Turn an idea into visual scenes', 'Describe the experience you want to make. ClikB prepares scene content and image prompts that you can review and refine before generating clips.'],
    ['Shorts and Cinema', 'Use Shorts for short-form visual content or Cinema for a sequence of paired Stage A and Stage B scenes. Your prompt can describe a story, recap, explanation, demonstration or music-led idea.'],
    ['Shape the finished video', 'Edit scene images and prompts, generate clips and work with narration and music where supported by your selected workflow. Optional supporting shots are user-directed additions.'],
    ['Visual prompts and Three.js motion references', 'Use a visual image prompt to guide appearance, or build and edit a Three.js Motion Guide for one-shot choreography, subject movement, relative positions, timing and camera direction. Preview and export the guide as a reference video before generating the finished shot with a compatible AI video model.'],
  ]],
  ['playable-ai-video', 'Interactive creation with ClikB', 'Build interactive visual experiences with ClikB using scene nodes, branching choices, hotspots and spatial workflows.', [
    ['Create scenes people can explore', 'Describe an interactive idea and develop it into scene nodes. Branching choices can lead to different outcomes, while hotspots connect interactions to the experience.'],
    ['Spatial interactions', 'Build connected stages and scene nodes with configured movement paths, action clips and links between stages. Viewers use directional controls to move along those paths, trigger available actions and return to previous nodes or stages. A visual map helps viewers explore the connections. Preview the spatial experience before publishing.'],
    ['Swipe and touch hotspots', 'Connect video interactions through swipe or touch hotspots. Configure which interaction leads to which scene or outcome, letting viewers explore a branching experience.'],
    ['An example', 'A character approaches a horse. One branch can show the character reaching and riding it; another can show the horse escaping. The scene images and interaction configuration work together to express those outcomes.'],
    ['Review before publishing', 'Refine the images and configure the interactions for the selected workflow. Preview the experience before publishing it for viewers to explore.'],
  ]],
  ['pricing', 'ClikB generation costs', 'Learn how to check generation costs in ClikB before creating images, video and audio.', [
    ['Check costs in the app', 'ClikB displays a balance in Pixels and generation costs in the creation interface. Check the displayed cost for your selected model and action before starting generation.'],
    ['Choose the generation you need', 'Different media types, models and generation options can have different costs. Open the app to see the currently available options and purchase information.'],
  ]],
  ['examples', 'What you can make with ClikB', 'Explore ideas for ClikB: cinematic stories, visual explanations, short-form content and branching interactive scenes.', [
    ['A visual explanation', 'Example idea: explain the history of the universe using a sequence of distinct visual scenes, then add narration and motion.'],
    ['A cinematic story', 'Example idea: follow a giant robot crossing a desert. Establish the setting, develop the action and refine the images before creating video.'],
    ['An interactive adventure', 'Example idea: an armoured adventurer approaches a white horse in a garden. Let viewers explore different outcomes through branching scenes.'],
    ['Make it your own', 'These are starting ideas, not a gallery of published outputs. Add your own purpose, style and details in the app.'],
  ]],
];
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const nav = pages.map(([slug, title]) => `<a href="/${slug}/">${title}</a>`).join(' · ');
const schema = {
  '@context': 'https://schema.org', '@graph': [
    { '@type': 'Organization', '@id': `${origin}/#organization`, name: 'ClikB', url: `${origin}/` },
    { '@type': 'WebSite', '@id': `${origin}/#website`, name: 'ClikB', url: `${origin}/`, description: `${description} ${assistedCreationSummary}`, publisher: { '@id': `${origin}/#organization` } },
    { '@type': 'SoftwareApplication', name: 'ClikB', url: `${origin}/`, applicationCategory: 'MultimediaApplication', operatingSystem: 'Web browser', description: `${description} ${assistedCreationSummary}` },
  ],
};
function metadata(title, summary, url) {
  return `<title>${escape(title)}</title>
    <meta name="description" content="${escape(summary)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="ClikB" />
    <meta property="og:title" content="${escape(title)}" />
    <meta property="og:description" content="${escape(summary)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${shareImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Create with ClikB" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escape(title)}" />
    <meta name="twitter:description" content="${escape(summary)}" />
    <meta name="twitter:image" content="${shareImage}" />
    <script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}
for (const [slug, title, summary, sections] of pages) {
  mkdirSync(`public/${slug}`, { recursive: true });
  writeFileSync(`public/${slug}/index.html`, `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
${metadata(title, summary, `${origin}/${slug}/`)}
<link rel="icon" href="/2.png"><style>
body{margin:0;background:#11131a;color:#f5f5fa;font:18px/1.65 system-ui,sans-serif}main,header,footer{max-width:850px;margin:auto;padding:28px}a{color:#d5f879}nav{font-size:14px}h1{font-size:clamp(32px,6vw,52px);line-height:1.15}h2{font-size:24px;margin-top:36px}.button{display:inline-block;padding:12px 22px;border-radius:24px;background:#d5f879;color:#141714;text-decoration:none;font-weight:700}footer{border-top:1px solid #343743}
</style></head><body><header><a href="/">ClikB</a><nav aria-label="Public guides">${nav}</nav></header>
<main><h1>${title}</h1><p>${summary}</p>${sections.map(([heading, body]) => `<section><h2>${heading}</h2><p>${body}</p></section>`).join('\n')}<p><a class="button" href="/images">Open ClikB studio</a></p></main>
<footer><a href="/privacy-policy">Privacy policy</a> · <a href="/images">Create with ClikB</a></footer></body></html>\n`);
}
let index = readFileSync('index.html', 'utf8');
const head = `<!-- CLIKB PUBLIC META START -->\n${metadata('ClikB — Create AI Videos, AI Memes, AI Stories, AI Music Videos, Hotspot and Spatial Interactive AI Video Experiences', description, `${origin}/`)}\n<!-- CLIKB PUBLIC META END -->`;
index = index.includes('<!-- CLIKB PUBLIC META START -->')
  ? index.replace(/<!-- CLIKB PUBLIC META START -->[\s\S]*?<!-- CLIKB PUBLIC META END -->/, head)
  : index.replace(/<title>.*?<\/title>/, head);
index = index.replace(/<div id="root">[\s\S]*?<\/div>/, '<div id="root"></div>');
writeFileSync('index.html', index);
writeFileSync('public/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['', ...pages.map(([slug]) => `${slug}/`)].map(path => `  <url><loc>${origin}/${path}</loc></url>`).join('\n')}\n</urlset>\n`);
// Production /sitemap.xml is a server-generated index linking this list and
// the live database post sitemap. Keep the static fallback for static previews.
writeFileSync('public/sitemap-pages.xml', readFileSync('public/sitemap.xml', 'utf8'));
writeFileSync('public/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`);
writeFileSync('public/llms.txt', `# ClikB\n\n> ${description}\n\n${assistedCreationSummary}\n\n## Public guides\n${pages.map(([slug, title, summary]) => `- [${title}](${origin}/${slug}/): ${summary}`).join('\n')}\n\n## Studio\n- [Open ClikB](${origin}/images): JavaScript application for creating and editing.\n\nGeneration options and costs are shown in the app. These guides describe the product; they do not grant access to private projects or account data.\n`);
console.log(`Generated ${pages.length} public pages, homepage metadata, sitemap and crawler files.`);
writeFileSync('public/llms.txt', readFileSync('public/llms.txt', 'utf8') + `\n## Spatial interactions\nCreate connected stages and scene nodes with configured movement paths, action clips and stage links. Viewers navigate using directional controls, trigger available actions, return to previous nodes or stages and explore connections on a visual map. Preview the spatial experience before publishing. Swipe and touch hotspot workflows connect videos to different scenes or outcomes.\n`);
writeFileSync('public/llms.txt', readFileSync('public/llms.txt', 'utf8') + `\n## Public creations and directing tools\n- [Public feed](${origin}/feeds): Published guest-accessible creations, with crawlable links to individual posts.\n- [Live post sitemap](${origin}/sitemap-posts.xml): Public post URLs from the database.\n- AI storyboard creation: prompt to scene plan, characters, environments and image previews.\n- Visual prompts: image-based guidance for individual scenes.\n- Motion Guide: basic Three.js animation from text for camera and subject movement; preview, edit and export as a reference video for compatible models.\n`);
