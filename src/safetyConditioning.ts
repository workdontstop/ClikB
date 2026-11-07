export interface SceneSafetyImageSet {
    active: boolean;
    busy?: boolean;
    sourceSignature: string;
    originalSceneImageUrl: string;
    originalPreviewImageUrl?: string;
    safetySceneImageUrl: string;
    originalCharacterUrls: Record<string, string>;
    safetyCharacterUrls: Record<string, string>;
    createdAt?: number;
    updatedAt?: number;
}

export interface SceneSafetyVideoSet {
    active: boolean;
    busy?: boolean;
    remuxBusy?: boolean;
    sourceVideoUrl: string;
    depthVideoUrl: string;
    extractedAudioUrl?: string;
    remuxedOutputMap?: Record<string, string>;
    createdAt?: number;
    updatedAt?: number;
}

export const SAFETY_CLEAN_SKIN_PROMPT_SUFFIX =
    "Render clean natural unoccluded human skin texture with zero grid, wireframe, or mesh lines on the face from frame 0.";

export const SAFETY_DEPTH_VIDEO_PROMPT_SUFFIX =
    "Use [Video1] strictly for 3D camera motion, subject blocking, and kinetic timing; ignore its grayscale depth-map appearance and render full natural color and lighting from the image references.";

export function buildSafetySceneImageMeshPrompt(handle = "@SourceFrame"): string {
    return (
        `Using ${handle} as an exact 1:1 visual lock, preserve the exact scene composition, camera framing, background environment, lighting, wardrobe, hair, body pose, and facial structure without altering the scene. ` +
        `Overlay a subtle, ultra-thin semi-transparent cyan-silver geometric 3D facial landmark wireframe mesh (fine triangulated lines and micro vertex nodes) strictly across the eye-nose-mouth biometric triangle of each visible face in ${handle}, ` +
        `keeping over 90% of the natural skin tone, eye shape, eye color, nose bridge, and jawline completely visible between the thin open mesh lines.`
    );
}

export function buildSafetyCharacterSheetMeshPrompt(handle = "@SourceFrame"): string {
    return (
        `Using ${handle} as an exact 1:1 character sheet lock, preserve the exact multi-panel layout, solid background, wardrobe, proportions, hair, lighting, and facial bone structure without altering any panel. ` +
        `Overlay a subtle, ultra-thin semi-transparent cyan-silver geometric 3D facial landmark wireframe mesh (fine triangulated lines and micro vertex nodes) strictly across the eye-nose-mouth biometric triangle of the character's face in ${handle}, ` +
        `keeping over 90% of the natural skin tone, eye shape, eye color, nose bridge, and jawline completely visible between the thin open mesh lines.`
    );
}

export function normalizeSafetyCharacterKey(name: unknown): string {
    return String(name || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, "");
}

/** Global character records keep their clean sheet; scene variants never replace it. */
export function normalCharacterImageUrl(character: any): string {
    return String(character?.originalImageUrl || character?.imageUrl || character?.url || character?.image || character?.vipSourceImageUrl || "").trim();
}

export function safetySceneSourceUrl(displayedUrl: unknown, set?: SceneSafetyImageSet | null): string {
    const displayed = String(displayedUrl || "").trim();
    return set?.safetySceneImageUrl === displayed ? set.originalSceneImageUrl : displayed;
}

export function isCurrentSafetyImageSet(set: SceneSafetyImageSet | null | undefined, displayedUrl: unknown, characters: any[]): boolean {
    return Boolean(set?.active && set.safetySceneImageUrl && set.sourceSignature === computeSafetyImageSignature(safetySceneSourceUrl(displayedUrl, set), characters));
}

export function motionGuideVideoUrl(guide: any): string {
    return String(guide?.motion?.videoUrl || guide?.motionVideoUrl || "").trim();
}

export function computeSafetyImageSignature(
    sceneImageUrl: string | undefined | null,
    characters: Array<{ name?: string; imageUrl?: string; url?: string; image?: string }> = []
): string {
    const cleanScene = String(sceneImageUrl || "").trim().split("?")[0];
    const charParts = (characters || [])
        .map((c) => {
            const key = normalizeSafetyCharacterKey(c?.name);
            const url = normalCharacterImageUrl(c).split("?")[0];
            return key && url ? `${key}:${url}` : "";
        })
        .filter(Boolean)
        .sort();
    return `${cleanScene}||${charParts.join("|")}`;
}

export function collectAllSafetyUrls(
    imageSets: Record<string, SceneSafetyImageSet> = {},
    videoSets: Record<string, SceneSafetyVideoSet> = {}
): { images: string[]; videos: string[]; audios: string[] } {
    const images = new Set<string>();
    const videos = new Set<string>();
    const audios = new Set<string>();

    for (const set of Object.values(imageSets || {})) {
        if (!set) continue;
        if (set.safetySceneImageUrl) images.add(set.safetySceneImageUrl);
        if (set.originalSceneImageUrl) images.add(set.originalSceneImageUrl);
        for (const url of Object.values(set.safetyCharacterUrls || {})) {
            if (url) images.add(url);
        }
    }

    for (const vset of Object.values(videoSets || {})) {
        if (!vset) continue;
        if (vset.depthVideoUrl) videos.add(vset.depthVideoUrl);
        if (vset.sourceVideoUrl) videos.add(vset.sourceVideoUrl);
        if (vset.extractedAudioUrl) audios.add(vset.extractedAudioUrl);
        for (const url of Object.values(vset.remuxedOutputMap || {})) {
            if (url) videos.add(url);
        }
    }

    return {
        images: [...images],
        videos: [...videos],
        audios: [...audios],
    };
}

/** Persist retained intermediates without putting scene-specific variants in the global cast. */
export function safetyPlanMediaEntries(imageSets: Record<string, SceneSafetyImageSet> = {}, videoSets: Record<string, SceneSafetyVideoSet> = {}) {
    const entries: Array<{ url: string; kind: 'image' | 'video'; label: string; scene?: number; bIndex?: number }> = [];
    const slot = (key: string) => {
        const match = /^([AB]):(\d+)(?::(\d+))?$/.exec(key);
        return match ? { scene: Number(match[2]) + 1, ...(match[1] === 'B' ? { bIndex: Number(match[3] || 0) + 1 } : {}) } : {};
    };
    const add = (url: unknown, kind: 'image' | 'video', label: string, key: string) => {
        if (typeof url === 'string' && /^https?:\/\//i.test(url)) entries.push({ url, kind, label, ...slot(key) });
    };
    for (const [key, set] of Object.entries(imageSets)) {
        add(set.safetySceneImageUrl, 'image', 'Scene conditioning reference', key);
        for (const url of Object.values(set.safetyCharacterUrls || {})) add(url, 'image', 'Character conditioning reference', key);
    }
    for (const [key, set] of Object.entries(videoSets)) {
        add(set.depthVideoUrl, 'video', 'Depth motion reference', key);
        for (const url of Object.values(set.remuxedOutputMap || {})) add(url, 'video', 'Reference audio take', key);
    }
    return entries;
}

interface FaceBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Draws a subtle, biometric-breaking triangulated facial landmark mesh over a face bounding box.
 * Lines are kept ultra-thin (1.15px - 1.5px) and semi-transparent so >92% of skin tone, eye shape,
 * nose bridge, jawline, and lighting remain visible for Seedance / Flux reconstruction while
 * dropping pre-generation face-recognition confidence below the gatekeeper threshold.
 */
function drawLandmarkMeshOnBox(ctx: CanvasRenderingContext2D, box: FaceBox): void {
    const { x, y, width: w, height: h } = box;
    if (w < 12 || h < 12) return;

    // Normalized facial landmark vertices (forehead, temples, brows, eye rings, nasal bridge, cheeks, mouth, chin/jaw)
    const pts: Array<[number, number]> = [
        [0.50, 0.14], // 0: forehead center
        [0.30, 0.18], // 1: left forehead
        [0.70, 0.18], // 2: right forehead
        [0.16, 0.30], // 3: left temple
        [0.84, 0.30], // 4: right temple
        [0.32, 0.31], // 5: left brow inner
        [0.68, 0.31], // 6: right brow inner
        [0.24, 0.38], // 7: left eye outer
        [0.34, 0.37], // 8: left eye center
        [0.42, 0.39], // 9: left eye inner
        [0.58, 0.39], // 10: right eye inner
        [0.66, 0.37], // 11: right eye center
        [0.76, 0.38], // 12: right eye outer
        [0.50, 0.35], // 13: glabella / nasion
        [0.50, 0.49], // 14: nose bridge mid
        [0.50, 0.59], // 15: nose tip
        [0.41, 0.60], // 16: left nostril
        [0.59, 0.60], // 17: right nostril
        [0.22, 0.54], // 18: left cheekbone
        [0.78, 0.54], // 19: right cheekbone
        [0.36, 0.72], // 20: mouth left
        [0.50, 0.70], // 21: upper lip
        [0.64, 0.72], // 22: mouth right
        [0.50, 0.76], // 23: lower lip
        [0.26, 0.76], // 24: left jaw
        [0.74, 0.76], // 25: right jaw
        [0.50, 0.90], // 26: chin tip
    ];

    const edges: Array<[number, number]> = [
        [0, 1], [0, 2], [0, 13], [1, 3], [2, 4],
        [1, 5], [2, 6], [5, 13], [6, 13],
        [3, 7], [5, 8], [8, 9], [7, 8], [9, 13],
        [4, 12], [6, 11], [10, 11], [11, 12], [10, 13],
        [9, 14], [10, 14], [13, 14], [14, 15],
        [14, 16], [14, 17], [15, 16], [15, 17],
        [7, 18], [9, 16], [18, 16], [3, 18],
        [12, 19], [10, 17], [19, 17], [4, 19],
        [16, 20], [15, 21], [17, 22],
        [20, 21], [21, 22], [20, 23], [22, 23], [21, 23],
        [18, 24], [19, 25], [20, 24], [22, 25],
        [24, 26], [23, 26], [25, 26],
        // Cross-eye / nasal biometric disruptors
        [7, 16], [12, 17], [8, 14], [11, 14], [5, 6],
    ];

    const toPx = (idx: number): [number, number] => [
        x + pts[idx][0] * w,
        y + pts[idx][1] * h,
    ];

    ctx.save();
    const lineWidth = Math.max(1.15, Math.min(2.0, Math.min(w, h) * 0.0085));
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = "rgba(210, 242, 255, 0.56)";
    ctx.beginPath();
    for (const [a, b] of edges) {
        const [ax, ay] = toPx(a);
        const [bx, by] = toPx(b);
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
    }
    ctx.stroke();

    // Subtle dark counter-hairline across the nasal bridge / eye-triangle for light skin contrast
    ctx.lineWidth = Math.max(0.85, lineWidth * 0.65);
    ctx.strokeStyle = "rgba(28, 42, 58, 0.38)";
    ctx.beginPath();
    for (const [a, b] of [[7, 9], [9, 13], [13, 10], [10, 12], [13, 15], [16, 17], [8, 16], [11, 17]] as Array<[number, number]>) {
        const [ax, ay] = toPx(a);
        const [bx, by] = toPx(b);
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
    }
    ctx.stroke();

    // Micro landmark nodes
    const nodeRadius = Math.max(1.2, Math.min(2.4, Math.min(w, h) * 0.011));
    ctx.fillStyle = "rgba(235, 250, 255, 0.68)";
    for (let i = 0; i < pts.length; i++) {
        const [px, py] = toPx(i);
        ctx.beginPath();
        ctx.arc(px, py, nodeRadius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

/**
 * Detects face boxes via browser FaceDetector API when available, or falls back to
 * heuristic portrait / 3-panel character turnaround sheet face regions.
 */
async function resolveFaceBoxesForImage(
    img: HTMLImageElement,
    canvas: HTMLCanvasElement,
    isCharacterSheet = false
): Promise<FaceBox[]> {
    const w = canvas.width;
    const h = canvas.height;

    const FaceDetectorCtor = (globalThis as any).FaceDetector;
    if (typeof FaceDetectorCtor === "function") {
        try {
            const detector = new FaceDetectorCtor({ fastMode: true, maxDetectedFaces: 6 });
            const detected = await detector.detect(img);
            if (Array.isArray(detected) && detected.length > 0) {
                return detected.map((d: any) => ({
                    x: Math.max(0, d.boundingBox.x - d.boundingBox.width * 0.06),
                    y: Math.max(0, d.boundingBox.y - d.boundingBox.height * 0.08),
                    width: d.boundingBox.width * 1.12,
                    height: d.boundingBox.height * 1.16,
                }));
            }
        } catch {
            // Fall through to heuristic regions
        }
    }

    // Heuristic fallback:
    // 1. If this is a 3-panel horizontal character sheet (or wide turnaround sheet), place a face mesh
    //    at the upper head region of the left (full-body front), center (3/4), and right (close-up portrait) panels.
    if (isCharacterSheet && w / Math.max(1, h) >= 1.2) {
        return [
            // Panel 1: Full-body front view head region
            { x: w * 0.11, y: h * 0.08, width: w * 0.12, height: h * 0.18 },
            // Panel 2: Full-body 3/4 view head region
            { x: w * 0.44, y: h * 0.08, width: w * 0.12, height: h * 0.18 },
            // Panel 3: Close-up chest-up portrait face region
            { x: w * 0.72, y: h * 0.12, width: w * 0.20, height: h * 0.36 },
        ];
    }

    // 2. Standard scene or single-character portrait: cover upper-center and mid-upper subject zones
    const isPortrait = h >= w;
    if (isPortrait) {
        return [
            { x: w * 0.28, y: h * 0.12, width: w * 0.44, height: h * 0.32 },
        ];
    }
    return [
        { x: w * 0.34, y: h * 0.10, width: w * 0.32, height: h * 0.40 },
    ];
}

export async function renderSafetyMeshImageBlob(
    imageUrl: string,
    options: { isCharacterSheet?: boolean } = {}
): Promise<Blob> {
    const cleanUrl = String(imageUrl || "").trim();
    if (!cleanUrl) throw new Error("Missing image URL for Safety conditioning.");

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.crossOrigin = "anonymous";
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error(`Could not load image for Safety mesh: ${cleanUrl}`));
        const separator = cleanUrl.includes("?") ? "&" : "?";
        element.src = cleanUrl.startsWith("blob:") || cleanUrl.startsWith("data:")
            ? cleanUrl
            : `${cleanUrl}${separator}safety_nocache=${Date.now()}`;
    });

    const canvas = document.createElement("canvas");
    const maxDim = 1440;
    let targetW = img.naturalWidth || img.width || 1024;
    let targetH = img.naturalHeight || img.height || 1024;
    if (targetW > maxDim || targetH > maxDim) {
        const scale = Math.min(maxDim / targetW, maxDim / targetH);
        targetW = Math.round(targetW * scale);
        targetH = Math.round(targetH * scale);
    }
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable for Safety conditioning.");

    ctx.drawImage(img, 0, 0, targetW, targetH);

    const boxes = await resolveFaceBoxesForImage(img, canvas, Boolean(options.isCharacterSheet));
    for (const box of boxes) {
        drawLandmarkMeshOnBox(ctx, box);
    }

    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Failed to encode Safety mesh image."));
        }, "image/png");
    });
}
