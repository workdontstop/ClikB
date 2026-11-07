export type SceneTarget = {
    type: "A" | "B";
    index: number;
    bIndex?: number;
};

export type UnifiedSceneEntry = SceneTarget & {
    originalIndex: number;
};

export const sceneTargetKey = (target: SceneTarget): string => (
    target.type === "B"
        ? `B:${target.index}:${target.bIndex ?? 0}`
        : `A:${target.index}`
);

export const sameSceneTarget = (left: SceneTarget, right: SceneTarget): boolean => (
    left.type === right.type
    && left.index === right.index
    && (left.type === "A" || (left.bIndex ?? 0) === (right.bIndex ?? 0))
);

export const findSceneTargetIndex = (
    map: readonly UnifiedSceneEntry[] | undefined,
    target: SceneTarget,
): number => {
    if (!Array.isArray(map)) return target.index;
    return map.findIndex((entry) => sameSceneTarget(entry, target));
};

export const selectVisualGuideSourcePrompt = (
    target: SceneTarget,
    imagePrompt: unknown,
    videoPrompt: unknown,
): string => {
    const image = String(imagePrompt || "").trim();
    const video = String(videoPrompt || "").trim();

    // A video guide directs an A-shot video prompt. A B-shot guide must follow
    // the B image prompt because that image is the B-shot's source of truth.
    return target.type === "B" ? (image || video) : (video || image);
};

const normalizeMediaUrl = (value: unknown): string => (
    String(value || "").trim().split("?")[0]
);

export const isVisualGuideSourceCurrent = (
    target: SceneTarget,
    guide: { sourcePrompt?: unknown; sourceFrameUrl?: unknown } | null | undefined,
    currentImagePrompt: unknown,
    currentVideoPrompt: unknown,
    currentFrameUrl: unknown,
): boolean => {
    if (!guide) return false;

    const expectedPrompt = selectVisualGuideSourcePrompt(
        target,
        currentImagePrompt,
        currentVideoPrompt,
    );
    const guidePrompt = String(guide.sourcePrompt || "").trim();
    const expectedFrame = normalizeMediaUrl(currentFrameUrl);
    const guideFrame = normalizeMediaUrl(guide.sourceFrameUrl);

    if (guidePrompt && guidePrompt !== expectedPrompt) return false;
    if (guideFrame && guideFrame !== expectedFrame) return false;
    return true;
};

export const isVisualGuideRequestCurrent = (
    target: SceneTarget,
    originalPrompt: unknown,
    rewrittenPrompt: unknown,
    sourceFrameUrl: unknown,
    currentImagePrompt: unknown,
    currentVideoPrompt: unknown,
    currentFrameUrl: unknown,
): boolean => {
    const allowedSourcePrompts = target.type === "A"
        ? [originalPrompt, rewrittenPrompt]
        : [originalPrompt];

    return allowedSourcePrompts.some((sourcePrompt) => (
        isVisualGuideSourceCurrent(
            target,
            { sourcePrompt, sourceFrameUrl },
            currentImagePrompt,
            currentVideoPrompt,
            currentFrameUrl,
        )
    ));
};

export type BShotTruth = {
    images: any[][];
    videos: any[][];
    prompts: any[][];
};

export const cloneBShotTruth = (truth: BShotTruth): BShotTruth => ({
    images: (truth.images || []).map((scene) => [...(scene || [])]),
    videos: (truth.videos || []).map((scene) => [...(scene || [])]),
    prompts: (truth.prompts || []).map((scene) => [...(scene || [])]),
});

export const ensureBShotTruthSlot = (
    truth: BShotTruth,
    parentScene: number,
): void => {
    while (truth.images.length <= parentScene) truth.images.push([]);
    while (truth.videos.length <= parentScene) truth.videos.push([]);
    while (truth.prompts.length <= parentScene) truth.prompts.push([]);
};

export type SerialTaskQueue = <T>(task: () => Promise<T>) => Promise<T>;

export const createSerialTaskQueue = (): SerialTaskQueue => {
    let tail: Promise<unknown> = Promise.resolve();

    return <T>(task: () => Promise<T>): Promise<T> => {
        const result = tail.catch(() => undefined).then(task);
        tail = result.then(
            () => undefined,
            () => undefined,
        );
        return result;
    };
};
