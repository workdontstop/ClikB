import { fal } from "@fal-ai/client";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { audioReferencePrompt } from './audioReference';

dotenv.config();

fal.config({
  credentials: process.env.FAL_KEY!,
});

// Fal's H3 resolution tiers and list rates (checked against fal's model pages, 2026-08-25):
//   480P $0.05/s   768P $0.06/s   2K $0.13/s   4K $0.16/s
// Keep the default at 768P. The shared UI can request 480p; this route translates
// that lowercase display value to fal's uppercase enum for all three H3 endpoints.
const H3_DEFAULT_RESOLUTION = "768P";

const H3_TEXT_ENDPOINT = "minimax/h3/text-to-video";
const H3_IMAGE_ENDPOINT = "minimax/h3/image-to-video";
const H3_REFERENCE_ENDPOINT = "minimax/h3/reference-to-video";

type CharacterReference = {
  name: string;
  url: string;
  handleRegex: RegExp | null;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const cleanUrlList = (value: unknown, limit: number): string[] =>
  (Array.isArray(value) ? value : [])
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, limit);

const extractVideoUrl = (result: any): string =>
  result?.data?.video?.url
  || result?.data?.videos?.[0]?.url
  || result?.data?.url
  || result?.video?.url
  || "";

async function fetchAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Fetch H3 video failed: ${response.status} ${details}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return `data:video/mp4;base64,${buffer.toString("base64")}`;
}

function collectCharacterReferences(
  prompt: string,
  names: unknown,
  fallbackImages: unknown,
): CharacterReference[] {
  const nameEntries = Array.isArray(names) ? names : [];
  const imageEntries = cleanUrlList(fallbackImages, 9);
  const references: CharacterReference[] = [];

  nameEntries.forEach((entry: any, index: number) => {
    const name = typeof entry?.name === "string" ? entry.name.trim() : "";
    const urlCandidate = entry?.imageUrl || entry?.url || entry?.image || imageEntries[index];
    const url = typeof urlCandidate === "string" ? urlCandidate.trim() : "";
    if (!url) return;

    const compactName = name.replace(/[^A-Za-z0-9_]/g, "");
    const handleRegex = compactName
      ? new RegExp(`\\s*@${escapeRegExp(compactName)}\\b`, "ig")
      : null;

    // EditStory sends only active references, but retain the prompt check when a
    // named @handle is available so unused character images are not billed.
    if (handleRegex && !handleRegex.test(prompt)) return;
    references.push({ name, url, handleRegex });
  });

  // Backward-compatible fallback for callers that only send an image URL array.
  if (references.length === 0 && nameEntries.length === 0) {
    imageEntries.forEach((url) => references.push({ name: "", url, handleRegex: null }));
  }

  return references.slice(0, 9);
}

export async function MiniMaxH3Route(req: any, res: any) {
  try {
    const {
      prompt,
      inputs,
      startImage,
      lastFrame,
      endImageUrl,
      videoLength,
      duration,
      resolution,
      ty,
      asyncMode,
      activechracterimages = [],
      activechracternames = [],
      lipSyncUrl,
      referenceAudioUrls,
      referenceImageUrls,
      spatialMovementReferenceImageUrl,
      referenceVideoUrl,
      referenceVideos: referenceVideoInputs,
    } = req.body ?? {};

    const textPrompt = (typeof prompt === "string"
      ? prompt
      : typeof inputs === "string"
        ? inputs
        : ""
    ).trim();
    if (!textPrompt) {
      return res.status(400).json({ error: "Missing 'prompt' (or 'inputs') string" });
    }

    const requestedDuration = Number(videoLength ?? duration ?? 5);
    const finalDuration = clamp(
      Number.isFinite(requestedDuration) ? Math.round(requestedDuration) : 5,
      5,
      15,
    );
    const aspectRatioMap: Record<number, string> = { 1: "9:16", 2: "1:1", 3: "16:9" };
    const aspectRatio = aspectRatioMap[Number(ty)] || "16:9";
    const finalResolution = String(resolution || H3_DEFAULT_RESOLUTION).toLowerCase() === "480p"
      ? "480P"
      : H3_DEFAULT_RESOLUTION;
    const startImageUrl = typeof startImage === "string" ? startImage.trim() : "";
    const endImageCandidate = endImageUrl || lastFrame;
    const endImage = typeof endImageCandidate === "string" ? endImageCandidate.trim() : "";
    const spatialMovementReference = typeof spatialMovementReferenceImageUrl === "string"
      ? spatialMovementReferenceImageUrl.trim()
      : "";

    const characterReferences = collectCharacterReferences(
      textPrompt,
      activechracternames,
      activechracterimages,
    );
    const directImageReferences = cleanUrlList(referenceImageUrls, 9);
    const requestedVideos = cleanUrlList(
      Array.isArray(referenceVideoInputs)
        ? referenceVideoInputs
        : referenceVideoUrl
          ? [referenceVideoUrl]
          : [],
      3,
    );
    const requestedAudios = cleanUrlList(
      Array.isArray(referenceAudioUrls)
        ? referenceAudioUrls
        : req.body?.audioReferenceUrl || lipSyncUrl
          ? [req.body.audioReferenceUrl || lipSyncUrl]
          : [],
      3,
    );

    const wantsReferenceMode = characterReferences.length > 0
      || directImageReferences.length > 0
      || spatialMovementReference.length > 0
      || requestedVideos.length > 0
      || requestedAudios.length > 0;

    let endpoint = H3_TEXT_ENDPOINT;
    let translatedPrompt = textPrompt;
    const input: Record<string, any> = {
      prompt: translatedPrompt,
      duration: finalDuration,
      resolution: finalResolution,
    };

    let referenceImages: string[] = [];
    let referenceVideos: string[] = [];
    let referenceAudios: string[] = [];
    let spatialEndReferenceIndex: number | null = null;
    let spatialMovementReferenceIndex: number | null = null;

    if (wantsReferenceMode) {
      endpoint = H3_REFERENCE_ENDPOINT;

      const addReferenceImage = (url: string): number | null => {
        const existingIndex = referenceImages.indexOf(url);
        if (existingIndex >= 0) return existingIndex + 1;
        if (referenceImages.length >= 9) return null;
        referenceImages.push(url);
        return referenceImages.length;
      };

      if (startImageUrl) {
        const startIndex = addReferenceImage(startImageUrl);
        if (startIndex) {
          translatedPrompt += spatialMovementReference
            ? ` Reconstruct Image ${startIndex} as the exact opening composition and visual state.`
            : ` Use Image ${startIndex} as the opening composition.`;
        }
      }

      if (spatialMovementReference && endImage) {
        spatialEndReferenceIndex = addReferenceImage(endImage);
        if (spatialEndReferenceIndex) {
          translatedPrompt += ` Transition continuously until Image ${spatialEndReferenceIndex} is reconstructed as the exact required ending composition and visual state.`;
        }
      }
      if (spatialMovementReference) {
        spatialMovementReferenceIndex = addReferenceImage(spatialMovementReference);
        if (spatialMovementReferenceIndex) {
          translatedPrompt += ` Use Image ${spatialMovementReferenceIndex} only as a spatial movement plan: its arrow, dots, labels, and overlays indicate the intended screen/depth direction and must never appear in the generated video. The annotated subject is the SAME subject already in the opening frame, not another person. Preserve the opening subject count and identity; never add a clone or foreground replacement. If the reference is unannotated, use it as the current scene only and follow the physical movement instruction toward the ending reference. Infer realistic scene geometry, contacts, obstacles, and subject reactions while following that route.`;
        }
      }

      characterReferences.forEach((reference) => {
        const imageIndex = addReferenceImage(reference.url);
        if (!imageIndex) return;
        const imageLabel = `Image ${imageIndex}`;
        if (reference.handleRegex) {
          translatedPrompt = translatedPrompt.replace(reference.handleRegex, ` ${imageLabel}`);
        }
        translatedPrompt += reference.name
          ? ` Use ${imageLabel} as the strict identity and silhouette reference for ${reference.name}.`
          : ` Use ${imageLabel} as a subject and style reference.`;
      });
      directImageReferences.forEach((url) => {
        const imageIndex = addReferenceImage(url);
        if (!imageIndex) return;
        translatedPrompt += ` Use Image ${imageIndex} as a subject or style reference.`;
      });

      // H3 permits at most 12 total reference files. Preserve images first,
      // followed by motion video and then optional lip-sync/music audio.
      const remainingAfterImages = Math.max(0, 12 - referenceImages.length);
      referenceVideos = requestedVideos.slice(0, Math.min(3, remainingAfterImages));
      const remainingAfterVideos = Math.max(0, remainingAfterImages - referenceVideos.length);
      referenceAudios = requestedAudios.slice(0, Math.min(3, remainingAfterVideos));
      if (req.body?.audioReferenceUrl && referenceAudios.length !== requestedAudios.length) return res.status(400).json({ error: 'Remove a reference to make room for audio within the 12-file limit.' });

      if (referenceVideos.length > 0) {
        const labels = referenceVideos.map((_, index) => `Video ${index + 1}`).join(", ");
        translatedPrompt += ` Use ${labels} as motion, camera, and editing references.`;
      }
      if (referenceAudios.length > 0) {
        const labels = referenceAudios.map((_, index) => `Audio ${index + 1}`).join(", ");
        translatedPrompt += req.body?.audioReferenceUrl ? ` ${audioReferencePrompt(labels)}` : ` Use ${labels} as driving audio for lip-sync, rhythm, and timing.`;
      }

      if (referenceAudios.length > 0 && referenceImages.length === 0 && referenceVideos.length === 0) {
        return res.status(400).json({
          error: "MiniMax H3 audio references require at least one image or video reference.",
        });
      }

      input.prompt = translatedPrompt;
      input.aspect_ratio = aspectRatio;
      if (referenceImages.length > 0) input.reference_image_urls = referenceImages;
      if (referenceVideos.length > 0) input.reference_video_urls = referenceVideos;
      if (referenceAudios.length > 0) input.reference_audio_urls = referenceAudios;
    } else if (startImageUrl) {
      endpoint = H3_IMAGE_ENDPOINT;
      input.image_url = startImageUrl;
      if (endImage) input.end_image_url = endImage;
    } else {
      input.aspect_ratio = aspectRatio;
    }

    console.log(
      `[MiniMax H3] Calling ${endpoint} (Resolution: ${finalResolution}, Duration: ${finalDuration}s, Strict last frame: ${Boolean(endpoint === H3_IMAGE_ENDPOINT && startImageUrl && endImage)}, Reference end: ${Boolean(spatialEndReferenceIndex)}, Spatial ref: ${Boolean(spatialMovementReferenceIndex)}, Images: ${referenceImages.length}, Videos: ${referenceVideos.length}, Audio: ${referenceAudios.length})`,
    );

    const meta = {
      model: "minimax-h3",
      endpoint,
      duration: finalDuration,
      resolution: finalResolution,
      aspect_ratio: endpoint === H3_IMAGE_ENDPOINT ? "match_input" : aspectRatio,
      used_i2v: Boolean(startImageUrl),
      used_last_frame: Boolean(endpoint === H3_IMAGE_ENDPOINT && startImageUrl && endImage),
      used_reference_end_frame: Boolean(spatialEndReferenceIndex),
      used_spatial_movement_reference: Boolean(spatialMovementReferenceIndex),
      native_audio: true,
      reference_images: referenceImages.length,
      reference_videos: referenceVideos.length,
      reference_audios: referenceAudios.length,
    };

    if (asyncMode) {
      const response = await fal.queue.submit(endpoint, { input: input as any });
      return res.status(200).json({
        status: "starting",
        jobId: response.request_id,
        provider: "fal",
        modelEndpoint: endpoint,
        meta,
      });
    }

    const result: any = await fal.subscribe(endpoint, { input: input as any });
    const videoUrl = extractVideoUrl(result);
    if (!videoUrl) throw new Error("MiniMax H3 returned no video URL.");

    return res.status(200).json({
      status: "succeeded",
      videoBase64: await fetchAsBase64(videoUrl),
      videoUrl,
      meta,
    });
  } catch (error: any) {
    const status = error?.status || 500;
    const details = error?.body || error?.response?.data;
    console.error("MiniMax H3 route error:", {
      status,
      details,
      message: error?.message,
    });
    return res.status(status).json({
      error: details?.detail || error?.message || "MiniMax H3 generation failed.",
      details,
    });
  }
}
