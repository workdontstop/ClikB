export type VideoModelCapability =
    | "imageReferences"
    | "videoReferences"
    | "audioReferences"
    | "soundReferences"
    | "lipSyncReference"
    | "visualGuideReferences"
    | "hardStartFrame"
    | "nativeAudio"
    | "audioToggle";

type VideoModelCapabilities = Partial<Record<VideoModelCapability, boolean>>;

// Frontend model values are stable identifiers. Provider model names and routes
// can change independently without duplicating capability checks across editors.
const VIDEO_MODEL_CAPABILITIES: Record<string, VideoModelCapabilities> = {
    Pro: {
        soundReferences: true,
        imageReferences: true,
        videoReferences: true,
        audioReferences: true,
        lipSyncReference: true,
        visualGuideReferences: true,
        audioToggle: true,
    },
    Minix: {
        soundReferences: true,
        imageReferences: true,
        videoReferences: true,
        audioReferences: true,
        lipSyncReference: true,
        visualGuideReferences: true,
        audioToggle: true,
    },
    SeedanceMini: {
        soundReferences: true,
        imageReferences: true,
        videoReferences: true,
        audioReferences: true,
        lipSyncReference: true,
        visualGuideReferences: true,
        audioToggle: true,
    },
    Proxxx: {
        soundReferences: true,
        imageReferences: true,
        videoReferences: true,
        audioReferences: true,
        lipSyncReference: true,
        visualGuideReferences: true,
        hardStartFrame: true,
        nativeAudio: true,
    },
    FalH3: {
        soundReferences: true,
        imageReferences: true,
        videoReferences: true,
        audioReferences: true,
        lipSyncReference: true,
        visualGuideReferences: true,
        hardStartFrame: true,
        nativeAudio: true,
    },
    // Seedance 2.5 (bytedance/seedance-2.5). Full Seedance-family reference support:
    // multi-character reference images, reference video, and audio-driven lip-sync.
    pPro: {
        soundReferences: true,
        imageReferences: true,
        videoReferences: true,
        audioReferences: true,
        lipSyncReference: true,
        visualGuideReferences: true,
        audioToggle: true,
    },
    Omni: {
        imageReferences: true,
        audioReferences: true,
        lipSyncReference: true,
        nativeAudio: true,
    },
    // Google Gemini Omni Flash uses character stills and an optional first frame.
    // It does not accept ClikB's reference-video or music/lip-sync inputs.
    GeminiOmni: {
        imageReferences: true,
        hardStartFrame: true,
    },
    Prox: { audioToggle: true },
    Proxx: { audioToggle: true },
};

export const VIDEO_MODEL_DISPLAY_NAMES: Record<string, string> = {
    Proxx: "Seedance 1.5",
    Prox: "PixVerse 6",
    GeminiOmni: "Omni-Flash",
    Mini: "Grok",
    Proxxx: "MiniMax H3",
    FalH3: "Fal H3",
    SeedanceMini: "Seedance 2.0 Mini",
    Minix: "Seedance 2.0 Fast",
    Pro: "Seedance 2.0",
    pPro: "Seedance 2.5",
    Omni: "OmniHuman 1.5",
};

export const getVideoModelDisplayName = (model: string | null | undefined): string =>
    (model && VIDEO_MODEL_DISPLAY_NAMES[model]) || String(model || "");

export const hasVideoModelCapability = (
    model: string | null | undefined,
    capability: VideoModelCapability,
): boolean => Boolean(model && VIDEO_MODEL_CAPABILITIES[model]?.[capability]);
