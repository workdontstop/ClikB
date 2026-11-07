import assert from "node:assert/strict";
import test from "node:test";
import {
    cloneBShotTruth,
    createSerialTaskQueue,
    ensureBShotTruthSlot,
    findSceneTargetIndex,
    isVisualGuideRequestCurrent,
    isVisualGuideSourceCurrent,
    sceneTargetKey,
    selectVisualGuideSourcePrompt,
    type BShotTruth,
    type UnifiedSceneEntry,
} from "../src/sceneTargetArchitecture.js";

test("native B target resolves after flattened positions move", () => {
    const target = { type: "B" as const, index: 1, bIndex: 0 };
    const before: UnifiedSceneEntry[] = [
        { type: "A", index: 0, originalIndex: 0 },
        { type: "A", index: 1, originalIndex: 1 },
        { ...target, originalIndex: 2 },
    ];
    const after: UnifiedSceneEntry[] = [
        { type: "A", index: 0, originalIndex: 0 },
        { type: "B", index: 0, bIndex: 0, originalIndex: 1 },
        { type: "A", index: 1, originalIndex: 2 },
        { ...target, originalIndex: 3 },
    ];

    assert.equal(findSceneTargetIndex(before, target), 2);
    assert.equal(findSceneTargetIndex(after, target), 3);
    assert.equal(sceneTargetKey(target), "B:1:0");
});

test("missing targets fail closed instead of falling back to scene zero", () => {
    const map: UnifiedSceneEntry[] = [
        { type: "A", index: 0, originalIndex: 0 },
    ];

    assert.equal(findSceneTargetIndex(map, { type: "B", index: 0, bIndex: 0 }), -1);
});

test("Visual Guide source follows B image prompt and A video prompt", () => {
    assert.equal(
        selectVisualGuideSourcePrompt(
            { type: "B", index: 2, bIndex: 1 },
            "current B image prompt",
            "old B video prompt",
        ),
        "current B image prompt",
    );
    assert.equal(
        selectVisualGuideSourcePrompt(
            { type: "A", index: 2 },
            "A image prompt",
            "current A motion prompt",
        ),
        "current A motion prompt",
    );
});

test("Visual Guide is rejected when its source prompt or frame changed", () => {
    const target = { type: "B" as const, index: 0, bIndex: 1 };
    const guide = {
        sourcePrompt: "lady beside the dragon",
        sourceFrameUrl: "https://cdn.test/frame.webp?signature=old",
    };

    assert.equal(
        isVisualGuideSourceCurrent(
            target,
            guide,
            "lady beside the dragon",
            "stale video prompt",
            "https://cdn.test/frame.webp?signature=new",
        ),
        true,
    );
    assert.equal(
        isVisualGuideSourceCurrent(
            target,
            guide,
            "dragon alone",
            "stale video prompt",
            "https://cdn.test/frame.webp",
        ),
        false,
    );
    assert.equal(
        isVisualGuideSourceCurrent(
            target,
            guide,
            "lady beside the dragon",
            "stale video prompt",
            "https://cdn.test/other-frame.webp",
        ),
        false,
    );
});

test("Visual Guide accepts the prompt rewritten by its own A-shot request", () => {
    const target = { type: "A" as const, index: 2 };
    const frame = "https://cdn.test/frame.webp";

    assert.equal(
        isVisualGuideRequestCurrent(target, "original motion prompt", "rewritten motion prompt", frame, "image prompt", "original motion prompt", frame),
        true,
    );
    assert.equal(
        isVisualGuideRequestCurrent(target, "original motion prompt", "rewritten motion prompt", frame, "image prompt", "rewritten motion prompt", frame),
        true,
    );
    assert.equal(
        isVisualGuideRequestCurrent(target, "original motion prompt", "rewritten motion prompt", frame, "image prompt", "unrelated user edit", frame),
        false,
    );
});

test("serialized B-shot saves preserve concurrent slot updates", async () => {
    const enqueue = createSerialTaskQueue();
    let truth: BShotTruth = { images: [], videos: [], prompts: [] };
    const persisted: BShotTruth[] = [];

    const save = (
        parentScene: number,
        bShotIndex: number,
        mediaType: "image" | "video",
        url: string,
    ) => enqueue(async () => {
        const next = cloneBShotTruth(truth);
        ensureBShotTruthSlot(next, parentScene);
        if (mediaType === "image") {
            next.images[parentScene][bShotIndex] = url;
        } else {
            next.videos[parentScene][bShotIndex] = url;
        }
        truth = next;
        await new Promise((resolve) => setTimeout(resolve, mediaType === "image" ? 10 : 0));
        persisted.push(cloneBShotTruth(next));
    });

    await Promise.all([
        save(0, 0, "image", "image-a"),
        save(0, 1, "video", "video-b"),
    ]);

    assert.equal(truth.images[0][0], "image-a");
    assert.equal(truth.videos[0][1], "video-b");
    assert.equal(persisted.at(-1)?.images[0][0], "image-a");
    assert.equal(persisted.at(-1)?.videos[0][1], "video-b");
});
