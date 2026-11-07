export type MediaKind = "image" | "video";
import { spatialVideoPixels } from './spatialVideoSpec';
import { VIDEO_UPSCALE_RATES, videoUpscaleResolution } from './videoUpscaleSpec';
import { falH3Request, falH3InputDollars } from './falH3Spec';
import { preciseEditPixels } from './preciseEditSpec';

export type MediaCharge = {
  pixels: number;
  kind: MediaKind;
  defaultLabel: string;
};

import {
  SERVER_MEASURED_DURATION_FIELD,
  SOURCE_MEDIA_MAX_SECONDS,
} from "./sourceMediaDuration";

// Matches the frontend registry, using 1440x1440 output estimates:
// Flare medium $0.0177 -> ceil(333 * cost) = 6 P; Sunburst high $0.0705 -> 24 P.
// Flat per-model pricing; no reference/text input surcharge.
const GPT_IMAGE_25_FLARE_PIXEL_COST = 6;
const GPT_IMAGE_25_SUNBURST_PIXEL_COST = 24;

const IMAGE_CHARGES: Record<string, Omit<MediaCharge, "kind">> = {
  "/fluxschnell": { pixels: 1, defaultLabel: "Preview Image" },
  "/hidream": { pixels: 3, defaultLabel: "Scene Image" },
  "/fluxdev": { pixels: 9, defaultLabel: "Scene Image" },
  "/seedream": { pixels: 11, defaultLabel: "Scene Image" },
  "/minimax2": { pixels: 14, defaultLabel: "Scene Image" },
  "/imagen2": { pixels: 14, defaultLabel: "Scene Image" },
  "/bannana2": { pixels: 14, defaultLabel: "Scene Image" },
  "/fluxultra": { pixels: 17, defaultLabel: "Scene Image" },
  "/gptimage": { pixels: 17, defaultLabel: "Scene Image" },
  "/gptimageflare": { pixels: GPT_IMAGE_25_FLARE_PIXEL_COST, defaultLabel: "Scene Image" },
  "/imagenx": { pixels: 21, defaultLabel: "Scene Image" },
  "/minimax": { pixels: 23, defaultLabel: "Scene Image" },
  "/gptimagesunburst": { pixels: GPT_IMAGE_25_SUNBURST_PIXEL_COST, defaultLabel: "Scene Image" },
  "/imagen": { pixels: 48, defaultLabel: "Scene Image" },
  "/fluxultra2": { pixels: 56, defaultLabel: "Scene Image" },
  "/bannana": { pixels: 56, defaultLabel: "Scene Image" },
  "/upscaleimage": { pixels: 2, defaultLabel: "Image Upscale" },
  "/denoiseimage": { pixels: 27, defaultLabel: "Image Denoise" },
  "/sdxlreplicate": { pixels: 1, defaultLabel: "Style Image" },
  "/sdxlreplicatepro": { pixels: 3, defaultLabel: "Style Image" },
  "/fluxpro": { pixels: 14, defaultLabel: "Style Image" },
  "/ideogram": { pixels: 9, defaultLabel: "Style Image" },
};

const numberInRange = (value: unknown, fallback: number, minimum = 1, maximum = 60): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
};

const boolValue = (body: any, fallback = true): boolean => {
  const value = body?.generateAudio ?? body?.generate_audio ?? body?.useaudio;
  return typeof value === "boolean" ? value : fallback;
};

const resolution = (body: any): "480p" | "720p" =>
  String(body?.resolution || "720p").toLowerCase() === "480p" ? "480p" : "720p";

const pixelsForRate = (seconds: number, dollarsPerSecond: number, surchargeDollars = 0): number =>
  Math.max(1, Math.round(((seconds * dollarsPerSecond) + surchargeDollars) * 333));

const referenceImageCount = (body: any): number => {
  const values = [
    body?.startImage,
    body?.endImage,
    ...(Array.isArray(body?.referenceImageUrls) ? body.referenceImageUrls : []),
    ...(Array.isArray(body?.activechracterimages) ? body.activechracterimages : []),
    ...(Array.isArray(body?.sampleImages) ? body.sampleImages : []),
  ].filter((value) => typeof value === "string" && value.trim());
  return new Set(values.map((value) => String(value).trim())).size;
};

export const mediaChargeFor = (route: string, body: any): MediaCharge | null => {
  const normalized = String(route || "").split("?")[0].toLowerCase();
  if (normalized === '/preciseimage') return {
    pixels: preciseEditPixels(body?.model, body?.width, body?.height, Array.isArray(body?.references) ? body.references.length : 0),
    kind: 'image', defaultLabel: 'Precise Image',
  };
  if (normalized === '/spatial-video') return { pixels: spatialVideoPixels(body?.model, body?.resolution, Number(body?.duration ?? 5), body?.job, body?.audio), kind: 'video', defaultLabel: 'Spatial Video' };
  if (normalized === '/falh3') return { pixels: Math.max(1, Math.round(falH3InputDollars(falH3Request(body || {}).input) * 333)), kind: 'video', defaultLabel: 'Scene Video' };
  const image = IMAGE_CHARGES[normalized];
  if (image) return { ...image, kind: "image" };

  let seconds = numberInRange(body?.videoLength ?? body?.duration, 5, 1, 60);
  const outputResolution = resolution(body);
  const audio = boolValue(body);
  const referenceVideo = Boolean(body?.referenceVideoUrl || Array.isArray(body?.referenceVideos) && body.referenceVideos.length || Array.isArray(body?.reference_videos) && body.reference_videos.length);
  let rate: number | null = null;
  let label = "Scene Video";
  let surcharge = 0;
  const measuredSourceSeconds = Number(body?.[SERVER_MEASURED_DURATION_FIELD]);

  switch (normalized) {
    case "/veo3fast":
      seconds = numberInRange(Number(body?.videoLength) || 5, 5, 1, 15);
      rate = 0.08;
      break;
    case "/sora2":
      seconds = numberInRange(body?.videoLength, 5, 2, 12);
      rate = referenceVideo ? (outputResolution === '480p' ? .08 : .17) : (outputResolution === "480p" ? 0.07 : 0.15);
      break;
    case "/seedance2mini":
      seconds = numberInRange(body?.videoLength, 5, 2, 12);
      rate = referenceVideo ? (outputResolution === '480p' ? .05 : .11) : (outputResolution === "480p" ? 0.04 : 0.09);
      break;
    case "/klingpro": {
      const requested = body?.videoLength;
      seconds = requested && requested !== "auto"
        ? numberInRange(requested, 5, 4, 15)
        : 5;
      rate = referenceVideo ? (outputResolution === '480p' ? .10 : .22) : (outputResolution === "480p" ? 0.08 : 0.18);
      break;
    }
    case "/minimax23route":
      seconds = numberInRange(body?.videoLength, 5, 2, 12);
      rate = outputResolution === "480p" ? (audio ? 0.025 : 0.013) : (audio ? 0.052 : 0.026);
      break;
    case "/minimax23routex": {
      seconds = numberInRange(body?.videoLength, 5, 2, 10);
      const is540 = String(body?.resolution || "720p").toLowerCase() === "540p";
      rate = is540 ? (audio ? 0.045 : 0.035) : (audio ? 0.06 : 0.045);
      break;
    }
    case "/seedance2":
      seconds = numberInRange(body?.videoLength, 5, 4, 30);
      rate = referenceVideo ? (outputResolution === '480p' ? .4304 : .9676) : (outputResolution === "480p" ? 0.1028 : 0.2312);
      break;
    case "/klingrouteo1":
      seconds = Math.round(numberInRange(body?.videoLength ?? body?.duration, 5, 5, 15));
      rate = outputResolution === "480p" ? 0.05 : 0.06;
      surcharge = Math.max(0, Math.min(9, referenceImageCount(body)) - 5) * 0.08;
      break;
    case "/geminiomniflash":
      seconds = Math.round(numberInRange(body?.videoLength ?? body?.duration, 5, 3, 10));
      rate = 0.13;
      break;
    case "/wan25fastroute":
      seconds = [5, 10].includes(Number(body?.videoLength)) ? Number(body.videoLength) : 5;
      rate = String(body?.resolution || "720p").toLowerCase() === "1080p" ? 0.102 : 0.068;
      break;
    case "/flux3videofast":
      seconds = numberInRange(body?.videoLength, 5, 5, 20);
      rate = 0.06;
      break;
    case "/flux3video":
      seconds = numberInRange(body?.videoLength, 5, 5, 20);
      rate = String(body?.resolution || "720p").toLowerCase() === "1080p" ? 0.29 : 0.17;
      break;
    case "/klingprol":
      seconds = [5, 10].includes(Number(body?.videoLength)) ? Number(body.videoLength) : 5;
      rate = 0.036;
      break;
    case "/omnihuman":
      if (!Number.isFinite(measuredSourceSeconds)) return null;
      seconds = numberInRange(measuredSourceSeconds, SOURCE_MEDIA_MAX_SECONDS, 1, SOURCE_MEDIA_MAX_SECONDS);
      rate = 0.16;
      break;
    case "/dreamactorroute":
      if (!Number.isFinite(measuredSourceSeconds)) return null;
      seconds = numberInRange(measuredSourceSeconds, SOURCE_MEDIA_MAX_SECONDS, 1, SOURCE_MEDIA_MAX_SECONDS);
      rate = 0.252;
      break;
    case "/wananimateroute":
    case "/wananimaterouterep":
      seconds = Number(body?.duration) >= 10 ? 10 : 5;
      rate = 0.252;
      break;
    case "/lipsync2pro":
      if (!Number.isFinite(measuredSourceSeconds)) return null;
      seconds = numberInRange(measuredSourceSeconds, SOURCE_MEDIA_MAX_SECONDS, 1, SOURCE_MEDIA_MAX_SECONDS);
      rate = 0.08325;
      label = "Lip Sync Pro";
      break;
    case "/upscalevideo":
      if (!Number.isFinite(measuredSourceSeconds)) return null;
      seconds = numberInRange(measuredSourceSeconds, SOURCE_MEDIA_MAX_SECONDS, 1, SOURCE_MEDIA_MAX_SECONDS);
      rate = VIDEO_UPSCALE_RATES[videoUpscaleResolution(body?.targetResolution)];
      label = "Video Upscale";
      break;
    default: return null;
  }

  return { pixels: pixelsForRate(seconds, rate, surcharge), kind: "video", defaultLabel: label };
};
