import assert from "node:assert/strict";
import test from "node:test";
import {
    INTENT_BLUEPRINT_SCHEMA_VERSION,
    bindSceneIntentToImagePrompt,
    createIntentSceneBindings,
    creationTypeToIntentMode,
    hashIntentValue,
    intentSceneBindingsFromBundle,
    parseIntentBlueprintBundle,
    resolveIntentBinding,
    resolveSceneIntent,
    sceneIntentMatchesPrompt,
    stableStringify,
    type IntentBlueprintBundle,
    type SceneIntentBlueprint,
} from "../src/intentBlueprint.js";
import type { SceneTarget } from "../src/sceneTargetArchitecture.js";

/* ------------------------------------------------------------------ */
/*  Hashing                                                            */
/* ------------------------------------------------------------------ */

test("hashIntentValue is deterministic for identical input", () => {
    const prompt = "A foggy dawn field after the battle has ended.";
    assert.equal(hashIntentValue(prompt), hashIntentValue(prompt));
});

test("hashIntentValue ignores object key order but not values", () => {
    const a = { mode: "cinema", scenes: ["one", "two"], planx: { style: "noir" } };
    const b = { planx: { style: "noir" }, scenes: ["one", "two"], mode: "cinema" };
    assert.equal(hashIntentValue(a), hashIntentValue(b));

    const c = { planx: { style: "noir" }, scenes: ["two", "one"], mode: "cinema" };
    assert.notEqual(hashIntentValue(a), hashIntentValue(c));
});

test("hashIntentValue separates whitespace-only prompt edits", () => {
    // The readiness gate compares committed prompts by hash. Trailing whitespace
    // is a real edit to the committed string and must not collide.
    assert.notEqual(hashIntentValue("a knight"), hashIntentValue("a knight "));
});

test("stableStringify drops undefined and sorts keys", () => {
    assert.equal(
        stableStringify({ b: 1, a: undefined, c: { z: 1, y: 2 } }),
        '{"b":1,"c":{"y":2,"z":1}}'
    );
});

test("hashIntentValue carries the version prefix", () => {
    assert.match(hashIntentValue("anything"), /^intent-v1-[0-9a-f]{8}$/);
});

/* ------------------------------------------------------------------ */
/*  Mode + binding construction                                        */
/* ------------------------------------------------------------------ */

test("creationTypeToIntentMode maps the three creation types", () => {
    assert.equal(creationTypeToIntentMode(0), "shorts");
    assert.equal(creationTypeToIntentMode(1), "cinema");
    assert.equal(creationTypeToIntentMode(3), "interactive");
    assert.equal(creationTypeToIntentMode(99), "shorts");
});

test("shorts bindings are flat and one-per-scene", () => {
    const bindings = createIntentSceneBindings(3, 0);
    assert.equal(bindings.length, 3);
    bindings.forEach((binding, index) => {
        assert.equal(binding.orderIndex, index);
        assert.equal(binding.logicalSceneId, undefined);
        assert.equal(binding.stage, undefined);
    });
    assert.equal(new Set(bindings.map((b) => b.sceneId)).size, 3);
});

test("cinema bindings pair Stage A and Stage B under one logical scene", () => {
    const bindings = createIntentSceneBindings(6, 1);
    assert.equal(bindings.length, 6);

    assert.deepEqual(
        bindings.map((b) => b.stage),
        ["A", "B", "A", "B", "A", "B"]
    );
    // Each pair shares a logical scene; different pairs never do.
    assert.equal(bindings[0].logicalSceneId, bindings[1].logicalSceneId);
    assert.equal(bindings[2].logicalSceneId, bindings[3].logicalSceneId);
    assert.notEqual(bindings[0].logicalSceneId, bindings[2].logicalSceneId);

    // Stage A and Stage B are independent snapshots, never the same identity.
    assert.notEqual(bindings[0].sceneId, bindings[1].sceneId);
    assert.equal(new Set(bindings.map((b) => b.sceneId)).size, 6);
});

test("cinema bindings tolerate a trailing unpaired Stage A", () => {
    const bindings = createIntentSceneBindings(5, 1);
    assert.equal(bindings.length, 5);
    assert.equal(bindings[4].stage, "A");
    assert.equal(bindings[4].orderIndex, 4);
    assert.notEqual(bindings[4].logicalSceneId, bindings[2].logicalSceneId);
});

test("interactive bindings are flat", () => {
    const bindings = createIntentSceneBindings(4, 3);
    assert.equal(bindings.length, 4);
    assert.ok(bindings.every((b) => b.stage === undefined));
});

/* ------------------------------------------------------------------ */
/*  Target resolution                                                  */
/* ------------------------------------------------------------------ */

test("editor B-shots resolve to null and never borrow a scene blueprint", () => {
    const bindings = createIntentSceneBindings(4, 1);
    const editorBShot: SceneTarget = { type: "B", index: 1, bIndex: 0 };
    assert.equal(resolveIntentBinding(editorBShot, bindings), null);
    assert.equal(resolveSceneIntent(editorBShot, bindings, makeBundle(bindings)), null);
});

test("cinema Stage B is an A-target at an odd raw index and still resolves", () => {
    const bindings = createIntentSceneBindings(4, 1);
    const stageB: SceneTarget = { type: "A", index: 1 };
    const binding = resolveIntentBinding(stageB, bindings);
    assert.equal(binding?.stage, "B");
    assert.equal(binding?.sceneId, bindings[1].sceneId);
});

test("resolveIntentBinding returns null past the end of the binding list", () => {
    const bindings = createIntentSceneBindings(2, 0);
    assert.equal(resolveIntentBinding({ type: "A", index: 7 }, bindings), null);
});

test("bindings rebuilt from a bundle preserve cinema stage identity", () => {
    const bindings = createIntentSceneBindings(4, 1);
    const rebuilt = intentSceneBindingsFromBundle(makeBundle(bindings));
    assert.deepEqual(
        rebuilt.map((b) => [b.sceneId, b.stage, b.logicalSceneId]),
        bindings.map((b) => [b.sceneId, b.stage, b.logicalSceneId])
    );
});

/* ------------------------------------------------------------------ */
/*  Readiness gate                                                     */
/* ------------------------------------------------------------------ */

test("a scene is not ready until it is bound to the committed prompt", () => {
    const bindings = createIntentSceneBindings(2, 0);
    const bundle = makeBundle(bindings, { syncStatus: "syncing" });
    const scene = bundle.scenes[bindings[0].sceneId];
    assert.equal(sceneIntentMatchesPrompt(scene, "a knight in the rain"), false);
});

test("binding to a prompt marks the scene ready and bumps bundle revision", () => {
    const bindings = createIntentSceneBindings(2, 0);
    const bundle = makeBundle(bindings, { syncStatus: "syncing" });
    const prompt = "a knight in the rain";
    const next = bindSceneIntentToImagePrompt(bundle, bindings[0].sceneId, prompt);

    assert.equal(next.revision, bundle.revision + 1);
    assert.equal(sceneIntentMatchesPrompt(next.scenes[bindings[0].sceneId], prompt), true);
    // Untouched scenes are not mutated.
    assert.equal(
        next.scenes[bindings[1].sceneId],
        bundle.scenes[bindings[1].sceneId]
    );
});

test("readiness fails once the committed prompt changes", () => {
    const bindings = createIntentSceneBindings(1, 0);
    const bound = bindSceneIntentToImagePrompt(
        makeBundle(bindings, { syncStatus: "syncing" }),
        bindings[0].sceneId,
        "a knight in the rain"
    );
    const scene = bound.scenes[bindings[0].sceneId];
    assert.equal(sceneIntentMatchesPrompt(scene, "a knight in the rain"), true);
    assert.equal(sceneIntentMatchesPrompt(scene, "a knight in the snow"), false);
});

test("a failed scene is never ready even when the hash matches", () => {
    const bindings = createIntentSceneBindings(1, 0);
    const prompt = "a knight in the rain";
    const bundle = makeBundle(bindings, {
        syncStatus: "failed",
        boundImagePromptHash: hashIntentValue(prompt),
    });
    assert.equal(sceneIntentMatchesPrompt(bundle.scenes[bindings[0].sceneId], prompt), false);
});

test("rebinding an already-bound ready scene is a no-op", () => {
    const bindings = createIntentSceneBindings(1, 0);
    const prompt = "a knight in the rain";
    const bound = bindSceneIntentToImagePrompt(
        makeBundle(bindings, { syncStatus: "syncing" }),
        bindings[0].sceneId,
        prompt
    );
    assert.equal(bindSceneIntentToImagePrompt(bound, bindings[0].sceneId, prompt), bound);
});

test("binding an unknown sceneId leaves the bundle untouched", () => {
    const bindings = createIntentSceneBindings(1, 0);
    const bundle = makeBundle(bindings);
    assert.equal(bindSceneIntentToImagePrompt(bundle, "no-such-scene", "x"), bundle);
});

test("sceneIntentMatchesPrompt is false for a missing scene", () => {
    assert.equal(sceneIntentMatchesPrompt(null, "anything"), false);
});

/* ------------------------------------------------------------------ */
/*  Bundle parsing                                                     */
/* ------------------------------------------------------------------ */

test("parseIntentBlueprintBundle accepts objects and JSON strings", () => {
    const bundle = makeBundle(createIntentSceneBindings(1, 0));
    assert.equal(parseIntentBlueprintBundle(bundle)?.blueprintId, bundle.blueprintId);
    assert.equal(
        parseIntentBlueprintBundle(JSON.stringify(bundle))?.blueprintId,
        bundle.blueprintId
    );
});

test("parseIntentBlueprintBundle rejects unusable payloads", () => {
    const bundle = makeBundle(createIntentSceneBindings(1, 0));
    assert.equal(parseIntentBlueprintBundle(null), null);
    assert.equal(parseIntentBlueprintBundle(""), null);
    assert.equal(parseIntentBlueprintBundle("   "), null);
    assert.equal(parseIntentBlueprintBundle("{not json"), null);
    assert.equal(parseIntentBlueprintBundle({ ...bundle, schemaVersion: 2 }), null);
    assert.equal(parseIntentBlueprintBundle({ ...bundle, sceneOrder: "nope" }), null);
    assert.equal(parseIntentBlueprintBundle({ ...bundle, scenes: undefined }), null);
});

/* ------------------------------------------------------------------ */
/*  Fixtures                                                           */
/* ------------------------------------------------------------------ */

type SceneOverrides = Partial<
    Pick<SceneIntentBlueprint, "syncStatus" | "boundImagePromptHash">
>;

function makeBundle(
    bindings: ReturnType<typeof createIntentSceneBindings>,
    overrides: SceneOverrides = {}
): IntentBlueprintBundle {
    const scenes: Record<string, SceneIntentBlueprint> = {};
    bindings.forEach((binding) => {
        const base = {
            sceneId: binding.sceneId,
            revision: 1,
            sourceContextHash: "intent-v1-00000000",
            boundImagePromptHash: null,
            syncStatus: "ready" as const,
            derivedFrom: "initial-compile" as const,
            mustPreserve: [],
            mustAvoid: [],
            localExceptions: [],
            text: "A plain-text passage describing this scene.",
            ...overrides,
        };

        scenes[binding.sceneId] = binding.stage
            ? {
                  ...base,
                  kind: "cinema-stage",
                  mode: "cinema",
                  logicalSceneId: binding.logicalSceneId as string,
                  stage: binding.stage,
              }
            : { ...base, kind: "shorts-scene", mode: "shorts" };
    });

    return {
        schemaVersion: INTENT_BLUEPRINT_SCHEMA_VERSION,
        blueprintId: "blueprint-test",
        revision: 1,
        mode: bindings[0]?.stage ? "cinema" : "shorts",
        sourceContextHash: "intent-v1-00000000",
        global: {
            title: "Test Piece",
            overview: "A short overview shown to the user while images generate.",
            experienceType: "test",
            premise: "",
            userGoal: "",
            audienceExpectation: "",
            canon: { characters: [], locations: [], props: [], worldRules: [] },
            visualLanguage: { artStyle: "" },
            globalMustPreserve: [],
            globalMustAvoid: [],
            modeProfile: {
                kind: "shorts",
                hook: "",
                payoff: "",
                beatMap: [],
            },
            audit: { status: "valid", issues: [] },
        },
        modeStructure: { kind: "shorts" },
        sceneOrder: bindings.map((binding) => binding.sceneId),
        scenes,
        audit: { status: "valid", issues: [] },
    };
}
