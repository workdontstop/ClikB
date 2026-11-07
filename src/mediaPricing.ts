import { GPT_IMAGE_25_FLARE_PIXEL_COST, GPT_IMAGE_25_SUNBURST_PIXEL_COST } from "./imageModels";
import { VIDEO_UPSCALE_RATES, videoUpscaleResolution } from '../server/src/videoUpscaleSpec';
import { preciseEditPixels } from '../server/src/preciseEditSpec';

export type ExpectedMediaCharge = { pixels: number; label: string };

const IMAGE_PRICES: Record<string, ExpectedMediaCharge> = {
    "/fluxschnell": { pixels: 1, label: "Preview Image" },
    "/hidream": { pixels: 3, label: "Scene Image" },
    "/fluxdev": { pixels: 9, label: "Scene Image" },
    "/seedream": { pixels: 11, label: "Scene Image" },
    "/minimax2": { pixels: 14, label: "Scene Image" },
    "/imagen2": { pixels: 14, label: "Scene Image" },
    "/bannana2": { pixels: 14, label: "Scene Image" },
    "/fluxultra": { pixels: 17, label: "Scene Image" },
    "/gptimage": { pixels: 17, label: "Scene Image" },
    "/gptimageflare": { pixels: GPT_IMAGE_25_FLARE_PIXEL_COST, label: "Scene Image" },
    "/imagenx": { pixels: 21, label: "Scene Image" },
    "/minimax": { pixels: 23, label: "Scene Image" },
    "/gptimagesunburst": { pixels: GPT_IMAGE_25_SUNBURST_PIXEL_COST, label: "Scene Image" },
    "/imagen": { pixels: 48, label: "Scene Image" },
    "/fluxultra2": { pixels: 56, label: "Scene Image" },
    "/bannana": { pixels: 56, label: "Scene Image" },
    "/upscaleimage": { pixels: 2, label: "Image Upscale" },
    "/denoiseimage": { pixels: 27, label: "Image Denoise" },
    "/sdxlreplicate": { pixels: 1, label: "Style Image" },
    "/sdxlreplicatepro": { pixels: 3, label: "Style Image" },
    "/fluxpro": { pixels: 14, label: "Style Image" },
    "/ideogram": { pixels: 9, label: "Style Image" },
};

const LABELS: Record<string, string> = {
    "preview-image": "Preview Image",
    "scene-image": "Scene Image",
    "image-recreate": "Image Recreate",
    "character-image": "Character Image",
    "environment-image": "Environment Image",
    "brainstorm-image": "Brainstorm Image",
    "style-image": "Style Image",
    "sketch-upgrade": "Sketch Upgrade",
    "visual-guide": "Visual Guide",
    "guide-update": "Guide Update",
    "b-shot-image": "B-Shot Image",
    "image-upscale": "Image Upscale",
    "image-denoise": "Image Denoise",
    "precise-image": "Precise Image",
    "youtube-thumbnail": "YouTube Thumbnail",
    "world-character": "Character Image",
    "scene-video": "Scene Video",
    "forward-video": "Forward Video",
    "return-video": "Return Video",
    "b-shot-video": "B-Shot Video",
    "video-upscale": "Video Upscale",
    "lip-sync-pro": "Lip Sync Pro",
};

const routePath = (url: string): string => {
    try { return new URL(url, window.location.origin).pathname.toLowerCase(); }
    catch { return String(url || "").split("?")[0].toLowerCase(); }
};

const secondsFor = (body: any): number => {
    const value = Number(body?.videoLength ?? body?.duration);
    return Number.isFinite(value) ? Math.max(1, Math.min(60, value)) : 5;
};

const audioFor = (body: any): boolean => {
    const value = body?.generateAudio ?? body?.generate_audio ?? body?.useaudio;
    return typeof value === "boolean" ? value : true;
};

const is480 = (body: any): boolean => String(body?.resolution || "720p").toLowerCase() === "480p";
const pricedSeconds = (seconds: number, rate: number, surcharge = 0): number =>
    Math.max(1, Math.round(((seconds * rate) + surcharge) * 333));

const referenceCount = (body: any): number => new Set([
    body?.startImage,
    ...(Array.isArray(body?.activechracterimages) ? body.activechracterimages : []),
    ...(Array.isArray(body?.sampleImages) ? body.sampleImages : []),
].filter((value) => typeof value === "string" && value.trim()).map((value) => String(value).trim())).size;

const displayLabel = (body: any, fallback: string): string => {
    const base = LABELS[String(body?.billingAction || "")] || fallback;
    const scene = Math.floor(Number(body?.billingScene));
    const reference = String(body?.billingReference || "").replace(/[\r\n]+/g, " ").trim().slice(0, 48);
    if (Number.isFinite(scene) && scene > 0 && scene <= 10000) return `${base} · Scene ${scene}`;
    if (reference && /^(Character Image|Environment Image)$/.test(base)) return `${base} · ${reference}`;
    return base;
};

export const expectedMediaCharge = (url: string, body: any): ExpectedMediaCharge | null => {
    const route = routePath(url);
    if (route === '/preciseimage') return {
        pixels: preciseEditPixels(body?.model, body?.width, body?.height, Array.isArray(body?.references) ? body.references.length : 0),
        label: displayLabel(body, 'Precise Image'),
    };
    const image = IMAGE_PRICES[route];
    if (image) return { ...image, label: displayLabel(body, image.label) };

    let seconds = secondsFor(body);
    const audio = audioFor(body);
    const low = is480(body);
    let rate: number | null = null;
    let label = "Scene Video";
    let surcharge = 0;

    switch (route) {
        case "/veo3fast": seconds = Math.max(1, Math.min(15, Number(body?.videoLength) || 5)); rate = 0.08; break;
        case "/sora2": seconds = Math.max(2, Math.min(12, Number(body?.videoLength) || 5)); rate = low ? 0.07 : 0.15; break;
        case "/seedance2mini": seconds = Math.max(2, Math.min(12, Number(body?.videoLength) || 5)); rate = low ? 0.04 : 0.09; break;
        case "/klingpro": {
            const requested = body?.videoLength;
            seconds = requested && requested !== "auto" ? Math.max(4, Math.min(15, Number(requested) || 5)) : 5;
            rate = low ? 0.08 : 0.18;
            break;
        }
        case "/minimax23route": seconds = Math.max(2, Math.min(12, Number(body?.videoLength) || 5)); rate = low ? (audio ? 0.025 : 0.013) : (audio ? 0.052 : 0.026); break;
        case "/minimax23routex": {
            seconds = Math.max(2, Math.min(10, Number(body?.videoLength) || 5));
            const is540 = String(body?.resolution || "720p").toLowerCase() === "540p";
            rate = is540 ? (audio ? 0.045 : 0.035) : (audio ? 0.06 : 0.045);
            break;
        }
        case "/seedance2": seconds = Math.max(4, Math.min(30, Number(body?.videoLength) || 5)); rate = low ? 0.1028 : 0.2312; break;
        case "/klingrouteo1":
            seconds = Math.round(Math.max(5, Math.min(15, Number(body?.videoLength ?? body?.duration) || 5)));
            rate = low ? 0.05 : 0.06;
            surcharge = Math.max(0, Math.min(9, referenceCount(body)) - 5) * 0.08;
            break;
        case "/geminiomniflash": seconds = Math.round(Math.max(3, Math.min(10, Number(body?.videoLength ?? body?.duration) || 5))); rate = 0.13; break;
        case "/wan25fastroute": seconds = [5, 10].includes(Number(body?.videoLength)) ? Number(body.videoLength) : 5; rate = String(body?.resolution || "720p").toLowerCase() === "1080p" ? 0.102 : 0.068; break;
        case "/flux3videofast": seconds = Math.max(5, Math.min(20, Number(body?.videoLength) || 5)); rate = 0.06; break;
        case "/flux3video": seconds = Math.max(5, Math.min(20, Number(body?.videoLength) || 5)); rate = String(body?.resolution || "720p").toLowerCase() === "1080p" ? 0.29 : 0.17; break;
        case "/klingprol": seconds = [5, 10].includes(Number(body?.videoLength)) ? Number(body.videoLength) : 5; rate = 0.036; break;
        case "/omnihuman": rate = 0.16; break;
        case "/dreamactorroute": rate = 0.252; break;
        case "/wananimateroute":
        case "/wananimaterouterep": seconds = Number(body?.duration) >= 10 ? 10 : 5; rate = 0.252; break;
        case "/lipsync2pro": rate = 0.08325; label = "Lip Sync Pro"; break;
        case "/upscalevideo": seconds = Math.min(10, Math.max(1, Math.ceil(Number(body?.duration) || seconds))); rate = VIDEO_UPSCALE_RATES[videoUpscaleResolution(body?.targetResolution)]; label = "Video Upscale"; break;
        default: return null;
    }

    return { pixels: pricedSeconds(seconds, rate, surcharge), label: displayLabel(body, label) };
};
