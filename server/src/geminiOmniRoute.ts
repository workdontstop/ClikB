import { fal } from "@fal-ai/client";
import fetch from "node-fetch";

fal.config({ credentials: process.env.FAL_KEY! });

const OMNI_TEXT_ENDPOINT = "google/gemini-omni-flash/v1.1/text-to-video";
const OMNI_IMAGE_ENDPOINT = "google/gemini-omni-flash/v1.1/image-to-video";
const OMNI_V11_IMAGE_ENDPOINT = "google/gemini-omni-flash/v1.1/image-to-video";
const OMNI_REFERENCE_ENDPOINT = "google/gemini-omni-flash/v1.1/reference-to-video";
const OMNI_MAX_IMAGES = 6;

type OmniCharacterReference = {
  name: string;
  url: string;
  handleRegex: RegExp;
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const cleanUrl = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const buildCharacterHandleRegex = (name: string): RegExp => {
  const compact = `@${name.replace(/[^A-Za-z0-9_]/g, "")}`;
  const parts = name.split(/[\s\-]+/).filter(Boolean);
  const flexible = parts.length > 0
    ? `@${parts.map(escapeRegExp).join("[\\s\\-]*")}`
    : escapeRegExp(compact);
  const alternatives = [escapeRegExp(compact), flexible]
    .filter((value, index, list) => Boolean(value) && list.indexOf(value) === index)
    .sort((a, b) => b.length - a.length);
  return new RegExp(`(?:${alternatives.join("|")})(?![A-Za-z0-9_])`, "gi");
};

const collectCharacterReferences = (
  prompt: string,
  rawNames: unknown,
  rawUrls: unknown,
): OmniCharacterReference[] => {
  const names = Array.isArray(rawNames) ? rawNames : [];
  const urls = Array.isArray(rawUrls) ? rawUrls : [];
  const references: OmniCharacterReference[] = [];
  const seen = new Set<string>();

  names.forEach((entry: any, index: number) => {
    const name = String(entry?.name || "").trim();
    const url = cleanUrl(entry?.imageUrl || entry?.url || entry?.image || urls[index]);
    if (!name || !url) return;

    const handleRegex = buildCharacterHandleRegex(name);
    handleRegex.lastIndex = 0;
    if (!handleRegex.test(prompt)) return;
    handleRegex.lastIndex = 0;

    const key = `${name.toLowerCase()}|${url.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    references.push({ name, url, handleRegex });
  });

  return references;
};

export function compileGeminiOmniInput(body: any) {
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) throw new Error("Enter or generate a video prompt first.");
  if (/<(?:FIRST_FRAME|IMAGE_REF_\d+)>|@Image\d+/i.test(prompt)) {
    throw new Error("Omni reference tags are reserved and are added automatically.");
  }

  const resolution = String(body?.resolution || "720p").toLowerCase();
  if (resolution === "480p") {
    throw new Error("480p is not supported by Omni-Flash. Select 720p.");
  }

  const ratioKey = Number(body?.ty);
  if (ratioKey === 2) {
    throw new Error("1:1 is not supported by Omni-Flash. Select 16:9 or 9:16.");
  }
  const aspectRatio = ratioKey === 1 ? "9:16" : "16:9";
  const requestedDuration = Number(body?.videoLength ?? body?.duration ?? 5);
  const duration = Math.min(10, Math.max(3, Math.round(Number.isFinite(requestedDuration) ? requestedDuration : 5)));
  const startImage = cleanUrl(body?.startImage);
  const endImage = cleanUrl(body?.endImageUrl || body?.lastFrame);
  if (endImage && !startImage) {
    throw new Error("Omni-Flash requires a first frame when an ending frame is supplied.");
  }

  // Spatial API returns provide both fields. Route only that case through
  // Omni 1.1 interpolation; all existing regular Omni modes stay unchanged.
  if (startImage && endImage) {
    return {
      endpoint: OMNI_V11_IMAGE_ENDPOINT,
      input: {
        prompt: `${prompt} Use the supplied images as the exact first and last frames, in that order.`.trim(),
        image_url: startImage,
        end_image_url: endImage,
        aspect_ratio: aspectRatio,
        resolution: "720p",
        duration,
      },
      meta: {
        mode: "first-last-frame-interpolation",
        imageCount: 2,
        characterCount: 0,
        used_last_frame: true,
      },
    };
  }

  const characters = collectCharacterReferences(
    prompt,
    body?.activechracternames,
    body?.activechracterimages,
  );

  const imageUrls: string[] = [];
  const addImage = (url: string): number => {
    const existingIndex = imageUrls.indexOf(url);
    if (existingIndex >= 0) return existingIndex + 1;
    imageUrls.push(url);
    return imageUrls.length;
  };

  const firstFrameImageNumber = startImage ? addImage(startImage) : 0;
  let translatedPrompt = prompt;
  const bindings = characters.map((character, referenceIndex) => {
    const imageNumber = addImage(character.url);
    const tag = `<IMAGE_REF_${referenceIndex}>`;
    translatedPrompt = translatedPrompt.replace(character.handleRegex, ` ${tag}`);
    return { ...character, tag, imageNumber };
  });

  if (imageUrls.length > OMNI_MAX_IMAGES) {
    throw new Error("Omni-Flash supports up to 6 total images, including the first frame.");
  }

  if (bindings.length > 0) {
    const declarations: string[] = [];
    if (firstFrameImageNumber) {
      declarations.push(`[# Sources <FIRST_FRAME>@Image${firstFrameImageNumber}]`);
    }
    declarations.push(
      `[# References ${bindings.map((binding) => `${binding.tag}@Image${binding.imageNumber}`).join(" ")}]`,
    );

    const identityInstructions = bindings
      .map((binding) => `Preserve ${binding.tag} as the strict identity, face, hairstyle, body proportions, and outfit reference for ${binding.name}.`)
      .join(" ");
    const roleInstructions = firstFrameImageNumber
      ? `Use Image${firstFrameImageNumber} as the starting frame. Use the other declared images only as subject references, not as literal initial frames.`
      : "Use the declared images only as subject references, not as literal initial frames.";

    translatedPrompt = `${declarations.join(" ")} ${translatedPrompt} ${identityInstructions} ${roleInstructions}`.trim();
    return {
      endpoint: OMNI_REFERENCE_ENDPOINT,
      input: {
        prompt: translatedPrompt,
        image_urls: imageUrls,
        aspect_ratio: aspectRatio,
        duration,
      },
      meta: { mode: "reference-to-video", imageCount: imageUrls.length, characterCount: bindings.length },
    };
  }

  if (firstFrameImageNumber) {
    return {
      endpoint: OMNI_IMAGE_ENDPOINT,
      input: {
        prompt: `${translatedPrompt} Use the supplied image as the exact starting frame.`.trim(),
        image_url: startImage,
        aspect_ratio: aspectRatio,
        duration,
      },
      meta: { mode: "image-to-video", imageCount: 1, characterCount: 0 },
    };
  }

  return {
    endpoint: OMNI_TEXT_ENDPOINT,
    input: { prompt: translatedPrompt, aspect_ratio: aspectRatio, duration },
    meta: { mode: "text-to-video", imageCount: 0, characterCount: 0 },
  };
}

async function fetchVideoAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download Omni-Flash output (${response.status}).`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "video/mp4";
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

export async function geminiOmniFlash(req: any, res: any) {
  try {
    const compiled = compileGeminiOmniInput(req.body || {});

    console.log("[Gemini Omni Flash] Calling", compiled.endpoint, {
      duration: compiled.input.duration,
      aspectRatio: compiled.input.aspect_ratio,
      ...compiled.meta,
    });

    if (req.body?.asyncMode) {
      const queued = await fal.queue.submit(compiled.endpoint, { input: compiled.input as any });
      return res.status(200).json({
        status: "starting",
        jobId: queued.request_id,
        provider: "fal",
        modelEndpoint: compiled.endpoint,
        meta: compiled.meta,
      });
    }

    const result: any = await fal.subscribe(compiled.endpoint, {
      input: compiled.input as any,
      logs: true,
    });
    const videoUrl = result?.data?.video?.url || result?.data?.url;
    if (!videoUrl) throw new Error("Omni-Flash returned no video URL.");
    if (req.body?.linkmode === true) {
      return res.status(200).json({ videoUrl, meta: compiled.meta });
    }
    return res.status(200).json({
      videoUrl,
      videoBase64: await fetchVideoAsBase64(videoUrl),
      meta: compiled.meta,
    });
  } catch (error: any) {
    const providerDetails = error?.body || error?.response?.data;
    const message = providerDetails?.detail || error?.message || "Omni-Flash generation failed.";
    console.error("Gemini Omni Flash route error:", { message, providerDetails });
    return res.status(error?.status || 400).json({ error: message, details: providerDetails });
  }
}
