export type VideoUpscaleResolution = "1080p" | "2k";
export const VIDEO_UPSCALE_RATES: Record<VideoUpscaleResolution, number> = {
  "1080p": 0.013773,
  "2k": 0.027548,
};
export function videoUpscaleResolution(value: unknown): VideoUpscaleResolution {
  const resolution = String(value ?? "1080p").toLowerCase();
  if (resolution !== "1080p" && resolution !== "2k") {
    throw new Error("Choose 1080p or 2K video upscale.");
  }
  return resolution;
}
export function videoUpscalePixels(seconds: number, resolution: VideoUpscaleResolution): number {
  return Math.max(1, Math.round(Math.min(10, Math.max(1, Math.ceil(seconds))) * VIDEO_UPSCALE_RATES[resolution] * 333));
}
