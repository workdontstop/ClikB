import assert from "node:assert/strict";
import test from "node:test";

import {
    BranchTuple,
    Hotspot,
    InteractionNode,
    createDefaultHotspots,
    isBranchConfigured,
    normalizeHotspots,
    normalizeInteractionNode,
    normalizeSubs,
} from "../src/TouchInteractionModel";
import {
    buildHoldEntryMap,
    collectInteractionNodes,
    createNodeIndex,
    resolveBranchDestination,
} from "../src/TouchInteractionNavigation";
import {
    DEFAULT_CHOICE_WINDOW_MS,
    HOLD_CHOICE_WINDOW_MS,
    HoldPlaybackState,
    choiceWindowMs,
    holdChoicesEnabled,
    holdIsPlaying,
    holdPlaybackReducer,
} from "../src/TouchHoldPlaybackModel";

const node = (over: Partial<InteractionNode> = {}): InteractionNode =>
    normalizeInteractionNode({
        id: "root",
        mainSrc: "root.mp4",
        subs: normalizeSubs([]),
        hotspots: createDefaultHotspots(),
        ...over,
    });

// --- Data contract -------------------------------------------------------

test("missing holdToPlay normalizes to false", () => {
    const [left] = normalizeHotspots([{ id: "left", x: 0.2, y: 0.2, r: 0.1 }]);
    assert.equal(left.holdToPlay, false);
});

test("only strict boolean true enables holdToPlay", () => {
    const cases: unknown[] = ["true", "false", 1, 0, "yes", null, undefined, {}];
    for (const value of cases) {
        const [left] = normalizeHotspots([{ id: "left", holdToPlay: value }]);
        assert.equal(left.holdToPlay, false, `value ${JSON.stringify(value)} must not enable hold`);
    }
    const [enabled] = normalizeHotspots([{ id: "left", holdToPlay: true }]);
    assert.equal(enabled.holdToPlay, true);
});

test("four hotspots keep independent holdToPlay values", () => {
    const hotspots = normalizeHotspots([
        { id: "left", holdToPlay: true },
        { id: "right", holdToPlay: false },
        { id: "top", holdToPlay: true },
        { id: "bottom" },
    ]);
    assert.deepEqual(hotspots.map((h) => h.holdToPlay), [true, false, true, false]);
});

test("mixed values survive a JSON save and reload", () => {
    const saved = JSON.stringify(normalizeHotspots([
        { id: "left", holdToPlay: true },
        { id: "right", holdToPlay: false },
    ]));
    const reloaded = normalizeHotspots(JSON.parse(saved));
    assert.equal(reloaded[0].holdToPlay, true);
    assert.equal(reloaded[1].holdToPlay, false);
});

test("holdToPlay alone does not configure an empty branch", () => {
    const hotspots = normalizeHotspots([{ id: "left", holdToPlay: true }]) as BranchTuple<Hotspot>;
    const empty = node({ hotspots });
    assert.equal(isBranchConfigured(empty, "left"), false);
});

// --- Route precedence ----------------------------------------------------

test("route precedence is loop, child, sub, none", () => {
    const withSub = node({ subs: normalizeSubs(["sub.mp4"]) });
    assert.deepEqual(resolveBranchDestination(createNodeIndex(withSub), withSub, "left"), {
        kind: "sub",
        src: "sub.mp4",
    });

    const withChild = node({
        subs: normalizeSubs(["sub.mp4"]),
        children: { left: normalizeInteractionNode({ id: "root-left", mainSrc: "child.mp4" }) },
    });
    const childResult = resolveBranchDestination(createNodeIndex(withChild), withChild, "left");
    assert.equal(childResult.kind, "child");

    const withLoop = node({
        subs: normalizeSubs(["sub.mp4"]),
        hotspots: normalizeHotspots([{ id: "left", loopTargetNodeId: "root" }]),
        children: { left: normalizeInteractionNode({ id: "root-left", mainSrc: "child.mp4" }) },
    });
    const loopResult = resolveBranchDestination(createNodeIndex(withLoop), withLoop, "left");
    assert.equal(loopResult.kind, "loop");

    const bare = node();
    assert.deepEqual(resolveBranchDestination(createNodeIndex(bare), bare, "right"), { kind: "none" });
});

test("a stale loop link falls back to ordinary media instead of dead-ending", () => {
    const stale = node({
        subs: normalizeSubs(["sub.mp4"]),
        hotspots: normalizeHotspots([{ id: "left", loopTargetNodeId: "node-that-was-deleted" }]),
    });
    assert.deepEqual(resolveBranchDestination(createNodeIndex(stale), stale, "left"), {
        kind: "sub",
        src: "sub.mp4",
    });
});

test("a retained child is inactive after its hotspot video is removed", () => {
    const tree = node({
        subs: normalizeSubs([]),
        children: {
            left: normalizeInteractionNode({
                id: "root-left",
                mainSrc: "old-left.mp4",
            }),
        },
    });

    assert.deepEqual(
        collectInteractionNodes(tree).map((entry) => entry.id),
        ["root"],
        "the stored child must not activate itself"
    );
    assert.deepEqual(
        resolveBranchDestination(createNodeIndex(tree), tree, "left"),
        { kind: "none" }
    );
});

test("node activation checks the complete parent history back to root", () => {
    const deepest = normalizeInteractionNode({
        id: "root-left-right-top-bottom",
        mainSrc: "f.mp4",
    });
    const levelE = normalizeInteractionNode({
        id: "root-left-right-top",
        mainSrc: "e.mp4",
        subs: normalizeSubs(["", "", "f.mp4", ""]),
        children: { top: deepest },
    });
    const levelD = normalizeInteractionNode({
        id: "root-left-right",
        mainSrc: "d.mp4",
        // This removed selection breaks the chain. The retained E and F nodes
        // below it must both become inactive.
        subs: normalizeSubs([]),
        children: { top: levelE },
    });
    const levelB = normalizeInteractionNode({
        id: "root-left",
        mainSrc: "b.mp4",
        subs: normalizeSubs(["", "d.mp4", "", ""]),
        children: { right: levelD },
    });
    const tree = node({
        subs: normalizeSubs(["b.mp4", "", "", ""]),
        children: { left: levelB },
    });

    assert.deepEqual(
        collectInteractionNodes(tree).map((entry) => entry.id),
        ["root", "root-left", "root-left-right"],
        "the walk must stop at the first inactive parent connection"
    );
    const index = createNodeIndex(tree);
    assert.equal(index.has("root-left-right-top"), false);
    assert.equal(index.has("root-left-right-top-bottom"), false);
});

// --- Reducer -------------------------------------------------------------

const start = (pointerId: number | null = 1, expectedVisitKey: string | null = "root#0"): HoldPlaybackState =>
    holdPlaybackReducer(null, {
        type: "START_SESSION",
        sessionId: 1,
        sourceNodeId: "root",
        branch: "left",
        targetKind: "sub",
        pointerId,
        controller: { id: "left", x: 0.5, y: 0.5, r: 0.15 },
        expectedVisitKey,
    });

test("first activation starts at zero and a resume does not re-seek", () => {
    let state = start();
    assert.equal(state?.hasStartedAtZero, false);
    state = holdPlaybackReducer(state, { type: "MEDIA_READY", sessionId: 1, visitKey: "root#0" });
    assert.equal(state?.hasStartedAtZero, true);
    assert.equal(holdIsPlaying(state), true);

    state = holdPlaybackReducer(state, { type: "RELEASE", pointerId: 1 });
    state = holdPlaybackReducer(state, { type: "PRESS", sessionId: 1, pointerId: 1 });
    assert.equal(state?.phase, "playing");
    assert.equal(state?.hasStartedAtZero, true, "resume must not request another seek");
});

test("a second pointer cannot drive an existing session", () => {
    let state = start(1);
    state = holdPlaybackReducer(state, { type: "MEDIA_READY", sessionId: 1, visitKey: "root#0" });
    const before = state;
    state = holdPlaybackReducer(state, { type: "RELEASE", pointerId: 99 });
    assert.deepEqual(state, before, "a different pointer must be ignored");
});

test("readiness from a stale mount is ignored", () => {
    let state = start(1, "root-left#3");
    state = holdPlaybackReducer(state, { type: "MEDIA_READY", sessionId: 1, visitKey: "root#0" });
    assert.equal(state?.phase, "buffering", "an element from a destroyed mount must not start playback");
    state = holdPlaybackReducer(state, { type: "MEDIA_READY", sessionId: 1, visitKey: "root-left#3" });
    assert.equal(state?.phase, "playing");
});

test("releasing while media loads leaves the route paused rather than playing", () => {
    let state = start(1);
    state = holdPlaybackReducer(state, { type: "RELEASE", pointerId: 1 });
    state = holdPlaybackReducer(state, { type: "MEDIA_READY", sessionId: 1, visitKey: "root#0" });
    assert.equal(state?.phase, "paused");
});

test("release, cancel and backgrounding all produce a paused session", () => {
    for (const event of [
        { type: "RELEASE", pointerId: 1 } as const,
        { type: "PAUSE_EXTERNAL" } as const,
    ]) {
        let state = start(1);
        state = holdPlaybackReducer(state, { type: "MEDIA_READY", sessionId: 1, visitKey: "root#0" });
        state = holdPlaybackReducer(state, event);
        assert.equal(state?.phase, "paused");
        assert.notEqual(state, null, "the session survives so the controller stays on screen");
    }
});

test("ownership survives the end of the video until the release is consumed", () => {
    let state = start(1);
    state = holdPlaybackReducer(state, { type: "MEDIA_READY", sessionId: 1, visitKey: "root#0" });
    state = holdPlaybackReducer(state, { type: "MEDIA_ENDED", sessionId: 1 });

    // Ending the session here would drop every guard while the physical pointerup
    // is still pending, and that release then restarts the video.
    assert.notEqual(state, null, "the session must outlive the video");
    assert.equal(state?.phase, "completed-awaiting-release");
    assert.equal(holdChoicesEnabled(state), false, "a held finger must not pick a choice that just appeared");

    state = holdPlaybackReducer(state, { type: "COMPLETE_RELEASED", pointerId: 42 });
    assert.equal(state, null);
    assert.equal(holdChoicesEnabled(state), true);
});

test("a video that ends after release needs no completion phase", () => {
    let state = start(1);
    state = holdPlaybackReducer(state, { type: "MEDIA_READY", sessionId: 1, visitKey: "root#0" });
    state = holdPlaybackReducer(state, { type: "RELEASE", pointerId: 1 });
    state = holdPlaybackReducer(state, { type: "MEDIA_ENDED", sessionId: 1 });
    assert.equal(state, null, "no pending pointerup to protect against");
});

test("nothing disturbs a route that is awaiting its release", () => {
    let ended = start(1);
    ended = holdPlaybackReducer(ended, { type: "MEDIA_READY", sessionId: 1, visitKey: "root#0" });
    ended = holdPlaybackReducer(ended, { type: "MEDIA_ENDED", sessionId: 1 });

    for (const event of [
        { type: "RELEASE", pointerId: 1 } as const,
        { type: "PAUSE_EXTERNAL" } as const,
        { type: "PRESS", sessionId: 1, pointerId: 1 } as const,
        { type: "MEDIA_ENDED", sessionId: 1 } as const,
    ]) {
        assert.deepEqual(holdPlaybackReducer(ended, event), ended, `${event.type} must not disturb the completed phase`);
    }
});


test("abort clears the session", () => {
    let state = start(1);
    state = holdPlaybackReducer(state, { type: "ABORT" });
    assert.equal(state, null);
});

// --- Timing --------------------------------------------------------------

test("the choice window is 5000 normally and 2000 only after a hold route", () => {
    assert.equal(choiceWindowMs(false), DEFAULT_CHOICE_WINDOW_MS);
    assert.equal(choiceWindowMs(false), 5000);
    assert.equal(choiceWindowMs(true), HOLD_CHOICE_WINDOW_MS);
    assert.equal(choiceWindowMs(true), 2000);
});

// --- Regressions from live testing ---------------------------------------


test("abort clears a session in every phase so the media gate cannot stick", () => {
    const phases: HoldPlaybackState[] = [];
    let s1 = start(1);
    phases.push(s1);
    s1 = holdPlaybackReducer(s1, { type: "MEDIA_READY", sessionId: 1, visitKey: "root#0" });
    phases.push(s1);
    phases.push(holdPlaybackReducer(s1, { type: "RELEASE", pointerId: 1 }));
    phases.push(holdPlaybackReducer(s1, { type: "MEDIA_ENDED", sessionId: 1 }));

    for (const phase of phases) {
        assert.equal(holdPlaybackReducer(phase, { type: "ABORT" }), null);
    }
});

// --- Hold scenes derived from the tree -----------------------------------

test("a node reached by a hold hotspot is recorded as a hold scene with its control", () => {
    const tree = node({
        subs: normalizeSubs(["left.mp4"]),
        hotspots: normalizeHotspots([
            { id: "left", x: 0.2, y: 0.7, r: 0.12, customText: "ANIMATE", holdToPlay: true },
        ]),
        children: { left: normalizeInteractionNode({ id: "root-left", mainSrc: "left.mp4" }) },
    });

    const entries = buildHoldEntryMap(tree);
    const entry = entries.get("root-left");

    assert.ok(entry, "the destination must be known as a hold scene before anyone plays it");
    assert.equal(entry?.branch, "left");
    // The control is the hotspot that leads there, so Back shows the same circle
    // in the same place with the same label.
    assert.deepEqual(entry?.controller, { id: "left", x: 0.2, y: 0.7, r: 0.12, customText: "ANIMATE" });
});

test("an ordinary tap hotspot creates no hold scene", () => {
    const tree = node({
        subs: normalizeSubs(["left.mp4"]),
        children: { left: normalizeInteractionNode({ id: "root-left", mainSrc: "left.mp4" }) },
    });
    assert.equal(buildHoldEntryMap(tree).size, 0);
});

test("a hold hotspot that loops records the loop destination", () => {
    const tree = node({
        // The right node is a live loop destination because its real parent
        // hotspot still has a selected video.
        subs: normalizeSubs(["", "right.mp4", "", ""]),
        hotspots: normalizeHotspots([
            { id: "left", holdToPlay: true, loopTargetNodeId: "root-right" },
        ]),
        children: {
            left: normalizeInteractionNode({ id: "root-left", mainSrc: "left.mp4" }),
            right: normalizeInteractionNode({ id: "root-right", mainSrc: "right.mp4" }),
        },
    });

    const entries = buildHoldEntryMap(tree);
    assert.ok(entries.get("root-right"), "the loop target is where the viewer lands");
    assert.equal(entries.has("root-left"), false, "the overridden child is not the destination");
});

test("a terminal sub creates no hold scene", () => {
    // A sub plays in place; it is not a node anyone can navigate back into.
    const tree = node({
        subs: normalizeSubs(["left.mp4"]),
        hotspots: normalizeHotspots([{ id: "left", holdToPlay: true }]),
    });
    assert.equal(buildHoldEntryMap(tree).size, 0);
});

// --- Audio data cleanliness ----------------------------------------------

test("blank and malformed audio entries are dropped on load", () => {
    // A node that "has" audio like this used to mute its own video to play
    // nothing, which is how a scene went silent.
    const dirty = normalizeInteractionNode({
        id: "root",
        mainSrc: "root.mp4",
        audio: { main: ["", "   ", null, undefined, 0, {}], left: "" },
    });

    assert.deepEqual(dirty.audio?.main, [], "nothing usable means no separate track");
    assert.deepEqual(dirty.audio?.left, []);
});

test("real audio urls survive cleaning", () => {
    const clean = normalizeInteractionNode({
        id: "root",
        mainSrc: "root.mp4",
        audio: { main: ["https://example.com/voice.mp3", ""] },
    });
    assert.deepEqual(clean.audio?.main, ["https://example.com/voice.mp3"]);
});

test("a node with no usable audio is not treated as configured by audio alone", () => {
    const empty = normalizeInteractionNode({
        id: "root",
        mainSrc: "root.mp4",
        audio: { left: ["", "  "] },
    });
    assert.equal(isBranchConfigured(empty, "left"), false);
});
