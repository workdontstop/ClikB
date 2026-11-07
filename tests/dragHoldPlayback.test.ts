import assert from "node:assert/strict";
import test from "node:test";

import {
    InteractionNode,
    createDefaultHotspots,
    isBranchConfigured,
    isDragNode,
    isLaneConfigured,
    laneActionNode,
    lanePayoffNode,
    normalizeInteractionNode,
    normalizeSubs,
} from "../src/TouchInteractionModel";
import {
    buildDragEntryMap,
    buildHoldEntryMap,
    collectInteractionNodes,
    createNodeIndex,
    buildStackForPath,
    resolveBranchDestination,
    resolveLaneDestination,
} from "../src/TouchInteractionNavigation";
import {
    DragState,
    dragAwaitingRelease,
    dragEngaged,
    dragHoldReducer,
    dragIsPlaying,
    dragOwnsMedia,
    laneForOffset,
    stickVisible,
} from "../src/DragHoldModel";

const node = (over: Partial<InteractionNode> = {}): InteractionNode =>
    normalizeInteractionNode({
        id: "root",
        mainSrc: "root.mp4",
        subs: normalizeSubs([]),
        hotspots: createDefaultHotspots(),
        ...over,
    });

/** A drag node with a left lane, its action clip, and optionally a payoff. */
const dragTree = (opts: { payoff?: boolean; right?: boolean } = {}) =>
    node({
        dragHold: true,
        children: {
            dragLeft: {
                id: "root-dragLeft",
                mainSrc: "left-action.mp4",
                ...(opts.payoff
                    ? { autoPlaySrc: "left-payoff.mp4", autoPlayIsVictory: true }
                    : {}),
            },
            ...(opts.right
                ? { dragRight: { id: "root-dragRight", mainSrc: "right-action.mp4" } }
                : {}),
        },
    } as any);

/* ------------------------------------------------------------------ *
 * Data contract
 * ------------------------------------------------------------------ */

test("missing dragHold normalizes to false", () => {
    assert.equal(node().dragHold, false);
});

test("only strict boolean true enables dragHold", () => {
    const cases: unknown[] = ["true", "false", 1, 0, "yes", null, undefined, {}, []];
    for (const value of cases) {
        assert.equal(
            node({ dragHold: value as any }).dragHold,
            false,
            `value ${JSON.stringify(value)} must not enable drag mode`
        );
    }
    assert.equal(node({ dragHold: true }).dragHold, true);
});

test("lane children get path-derived ids, never a second root", () => {
    const tree = normalizeInteractionNode({
        id: "root",
        dragHold: true,
        children: {
            dragLeft: { mainSrc: "a.mp4" },
            dragRight: { mainSrc: "b.mp4" },
        },
    });
    assert.equal(tree.children?.dragLeft?.id, "root-dragLeft");
    assert.equal(tree.children?.dragRight?.id, "root-dragRight");
});

test("a lane payoff is the action node's autoPlay child", () => {
    const tree = dragTree({ payoff: true });
    assert.equal(laneActionNode(tree, "left")?.mainSrc, "left-action.mp4");
    assert.equal(lanePayoffNode(tree, "left")?.mainSrc, "left-payoff.mp4");
    assert.equal(lanePayoffNode(tree, "right"), null);
});

test("isLaneConfigured needs an action clip, not just a child", () => {
    assert.equal(isLaneConfigured(dragTree(), "left"), true);
    assert.equal(isLaneConfigured(dragTree(), "right"), false);
    assert.equal(isLaneConfigured(node(), "left"), false);
});

test("isDragNode is derived from the LANES, never from dragHold", () => {
    // dragHold is editor panel state — which controls the creator is currently
    // authoring. It must not decide what the viewer sees, or closing the panel
    // to place a hotspot would silently remove the DRAG circle from a scene
    // that still has both lanes.
    assert.equal(isDragNode(dragTree()), true);
    assert.equal(
        isDragNode(node({ dragHold: true })), false,
        "panel open but nothing authored — there is nothing to drag"
    );
    assert.equal(
        isDragNode(node({
            dragHold: false,
            children: { dragLeft: { id: "root-dragLeft", mainSrc: "a.mp4" } },
        } as any)),
        true,
        "panel closed but a lane exists — the drag is still live"
    );
    assert.equal(isDragNode(node()), false);
    assert.equal(isDragNode(null), false);
});

test("drag mode does not make the four branches render", () => {
    const tree = dragTree({ right: true });
    for (const branch of ["left", "right", "top", "bottom"] as const) {
        assert.equal(
            isBranchConfigured(tree, branch),
            false,
            `${branch} must stay unconfigured — lanes are not branches`
        );
    }
});

test("a drag tree stays JSON-serializable and survives a round trip", () => {
    const tree = dragTree({ payoff: true, right: true });
    const reloaded = normalizeInteractionNode(JSON.parse(JSON.stringify(tree)));
    assert.equal(reloaded.dragHold, true);
    assert.equal(reloaded.children?.dragLeft?.mainSrc, "left-action.mp4");
    assert.equal(reloaded.children?.dragLeft?.children?.autoPlay?.mainSrc, "left-payoff.mp4");
    assert.equal(reloaded.children?.dragRight?.mainSrc, "right-action.mp4");
});

test("a tree saved before this feature loads unchanged", () => {
    const legacy = normalizeInteractionNode({ id: "root", mainSrc: "r.mp4" });
    assert.equal(legacy.dragHold, false);
    assert.equal(legacy.children?.dragLeft, undefined);
});

/* ------------------------------------------------------------------ *
 * Navigation
 * ------------------------------------------------------------------ */

test("collectInteractionNodes finds lane and payoff nodes exactly once", () => {
    const found = collectInteractionNodes(dragTree({ payoff: true, right: true }));
    const ids = found.map((entry) => entry.id);
    assert.deepEqual(ids.sort(), [
        "root",
        "root-dragLeft",
        "root-dragLeft-autoPlay",
        "root-dragRight",
    ].sort());
});

test("lane nodes carry readable path labels", () => {
    const found = collectInteractionNodes(dragTree({ payoff: true }));
    const action = found.find((entry) => entry.id === "root-dragLeft");
    const payoff = found.find((entry) => entry.id === "root-dragLeft-autoPlay");
    assert.equal(action?.label, "Root → Drag Left");
    assert.equal(payoff?.label, "Root → Drag Left → Auto");
});

test("buildStackForPath resolves a lane path", () => {
    const tree = dragTree({ payoff: true });
    assert.deepEqual(
        buildStackForPath(tree, ["dragLeft"]).map((n) => n.id),
        ["root-dragLeft"]
    );
    assert.deepEqual(
        buildStackForPath(tree, ["dragLeft", "autoPlay"]).map((n) => n.id),
        ["root-dragLeft", "root-dragLeft-autoPlay"]
    );
});

test("lane nodes are reachable as loop targets through the index", () => {
    const index = createNodeIndex(dragTree({ payoff: true }));
    assert.equal(index.has("root-dragLeft"), true);
    assert.equal(index.has("root-dragLeft-autoPlay"), true);
});

test("a retained autoplay child is inactive when autoplay is removed", () => {
    const tree = node({
        autoPlaySrc: "",
        children: {
            autoPlay: { id: "root-autoPlay", mainSrc: "old-auto.mp4" } as InteractionNode,
        },
    });
    assert.deepEqual(
        collectInteractionNodes(tree).map((entry) => entry.id),
        ["root"]
    );
});

test("a retained drag subtree is inactive when its action video is removed", () => {
    const tree = node({
        children: {
            dragLeft: {
                id: "root-dragLeft",
                mainSrc: "",
                autoPlaySrc: "old-payoff.mp4",
                children: {
                    autoPlay: {
                        id: "root-dragLeft-autoPlay",
                        mainSrc: "old-payoff.mp4",
                    },
                },
            } as InteractionNode,
        },
    });
    assert.deepEqual(
        collectInteractionNodes(tree).map((entry) => entry.id),
        ["root"]
    );
});

test("resolveLaneDestination returns fallback for an unauthored lane", () => {
    const tree = dragTree();
    assert.deepEqual(resolveLaneDestination(tree, "left"), {
        kind: "lane",
        node: tree.children!.dragLeft!,
    });
    assert.equal(resolveLaneDestination(tree, "right").kind, "fallback");
    assert.equal(resolveLaneDestination(null, "left").kind, "fallback");
});

test("a lane child with no mainSrc is a fallback, not a lane", () => {
    const tree = normalizeInteractionNode({
        id: "root",
        dragHold: true,
        children: { dragLeft: { mainSrc: "" } },
    });
    assert.equal(resolveLaneDestination(tree, "left").kind, "fallback");
});

test("resolveBranchDestination is untouched by drag mode", () => {
    const plain = node({ subs: normalizeSubs(["a.mp4", "", "", ""]) });
    const before = resolveBranchDestination(createNodeIndex(plain), plain, "left");
    assert.deepEqual(before, { kind: "sub", src: "a.mp4" });

    // Same tree, drag mode on: the four-branch router must not notice.
    const dragged = node({ dragHold: true, subs: normalizeSubs(["a.mp4", "", "", ""]) });
    const after = resolveBranchDestination(createNodeIndex(dragged), dragged, "left");
    assert.deepEqual(after, before);
});

test("buildDragEntryMap maps action nodes to their parent and lane", () => {
    const map = buildDragEntryMap(dragTree({ payoff: true, right: true }));
    assert.deepEqual(map.get("root-dragLeft"), { parentNodeId: "root", lane: "left" });
    assert.deepEqual(map.get("root-dragRight"), { parentNodeId: "root", lane: "right" });
    assert.equal(map.has("root-dragLeft-autoPlay"), false, "a payoff is an ordinary node");
    assert.equal(map.has("root"), false);
});

test("buildDragEntryMap honours lanes with the editor panel closed", () => {
    const tree = node({
        dragHold: false,
        children: { dragLeft: { id: "root-dragLeft", mainSrc: "x.mp4" } },
    } as any);
    assert.deepEqual(buildDragEntryMap(tree).get("root-dragLeft"), {
        parentNodeId: "root",
        lane: "left",
    });
});

test("buildDragEntryMap terminates on a lane that loops back to its parent", () => {
    const tree = normalizeInteractionNode({
        id: "root",
        dragHold: true,
        children: {
            dragLeft: {
                mainSrc: "a.mp4",
                hotspots: [{ id: "left", loopTargetNodeId: "root" }],
            },
        },
    });
    const map = buildDragEntryMap(tree);
    assert.equal(map.size, 1);
});

/* ------------------------------------------------------------------ *
 * State machine — hold to the end, release to abandon
 * ------------------------------------------------------------------ */

const engage = (pointerId: number | null = 7): DragState =>
    dragHoldReducer(null, {
        type: "ENGAGE",
        sessionId: 1,
        lane: "left",
        pointerId,
        originNodeId: "root",
        actionNodeId: "root-dragLeft",
        expectedVisitKey: "root-dragLeft#1",
    });

const won = (): DragState =>
    dragHoldReducer(engage(), { type: "MEDIA_ENDED", sessionId: 1 });

test("ENGAGE opens an engaged session that owns media", () => {
    const state = engage();
    assert.equal(state?.phase, "engaged");
    assert.equal(state?.lane, "left");
    assert.equal(dragOwnsMedia(state), true);
    assert.equal(dragIsPlaying(state), true);
    assert.equal(dragEngaged(state), true);
    assert.equal(state?.hasStartedAtZero, false);
});

test("MEDIA_READY marks the seek-to-zero as spent", () => {
    const ready = dragHoldReducer(engage(), {
        type: "MEDIA_READY", sessionId: 1, visitKey: "root-dragLeft#1",
    });
    assert.equal(ready?.hasStartedAtZero, true);
});

test("MEDIA_READY from a destroyed element is ignored", () => {
    const stale = dragHoldReducer(engage(), {
        type: "MEDIA_READY", sessionId: 1, visitKey: "root-dragLeft#9",
    });
    assert.equal(stale?.hasStartedAtZero, false);
});

test("MEDIA_READY for another session is ignored", () => {
    const other = dragHoldReducer(engage(), {
        type: "MEDIA_READY", sessionId: 2, visitKey: "root-dragLeft#1",
    });
    assert.equal(other?.hasStartedAtZero, false);
});

test("releasing before the clip ends abandons the attempt", () => {
    assert.equal(dragHoldReducer(engage(), { type: "RELEASE", pointerId: 7 }), null);
});

test("a release from another pointer does not abandon it", () => {
    const state = dragHoldReducer(engage(), { type: "RELEASE", pointerId: 99 });
    assert.equal(state?.phase, "engaged");
});

test("holding to the end wins the route and RELEASES ownership", () => {
    const state = won();
    assert.equal(state?.phase, "completed-awaiting-release");
    assert.equal(dragAwaitingRelease(state), true);
    assert.equal(dragEngaged(state), false);
    assert.equal(dragIsPlaying(state), false, "the clip is over; nothing should advance");
    // Ownership must end with the effort. Holding it through this phase gated
    // every one of TouchPreviewMedia's play paths, so the payoff mounted,
    // reported ready, and then sat on a frozen frame until the session cleared.
    assert.equal(dragOwnsMedia(state), false);
});

test("the won phase exists to swallow the release, not to hold the video", () => {
    // Its only job: the pointerup that arrives AFTER navigation must not read as
    // a fresh tap on the destination. Media is already free by then.
    const state = won();
    assert.equal(dragOwnsMedia(state), false);
    assert.equal(dragHoldReducer(state, { type: "RELEASE", pointerId: 7 }), null);
});

test("the release after a win discharges the session", () => {
    assert.equal(dragHoldReducer(won(), { type: "RELEASE", pointerId: 7 }), null);
});

test("a won route is discharged by ANY release, not only the original pointer", () => {
    // Pointer-matching here left the state undischargeable when a release was
    // missed, which locked Hold up entirely.
    assert.equal(dragHoldReducer(won(), { type: "RELEASE", pointerId: 999 }), null);
    assert.equal(dragHoldReducer(won(), { type: "RELEASE", pointerId: null }), null);
});

test("MEDIA_ENDED is inert once won, or for another session", () => {
    assert.deepEqual(dragHoldReducer(won(), { type: "MEDIA_ENDED", sessionId: 1 }), won());
    assert.equal(dragHoldReducer(engage(), { type: "MEDIA_ENDED", sessionId: 2 })?.phase, "engaged");
});

test("ABORT clears from any phase", () => {
    assert.equal(dragHoldReducer(engage(), { type: "ABORT" }), null);
    assert.equal(dragHoldReducer(won(), { type: "ABORT" }), null);
});

test("re-engaging after an abandoned attempt starts fresh", () => {
    const abandoned = dragHoldReducer(engage(), { type: "RELEASE", pointerId: 7 });
    assert.equal(abandoned, null);
    const again = dragHoldReducer(abandoned, {
        type: "ENGAGE",
        sessionId: 2,
        lane: "right",
        pointerId: 8,
        originNodeId: "root",
        actionNodeId: "root-dragRight",
        expectedVisitKey: "root-dragRight#2",
    });
    assert.equal(again?.hasStartedAtZero, false);
    assert.equal(again?.lane, "right");
});

test("there is no commit threshold — clip length never decides the outcome", () => {
    // The only success signal is the clip's own end, so a 5s and a 10s action
    // clip behave identically. Nothing in this model reads a duration or a clock.
    assert.equal(dragEngaged(engage()), true);
    assert.equal(dragEngaged(won()), false);
});

/* ------------------------------------------------------------------ *
 * Stick visibility and lane selection
 * ------------------------------------------------------------------ */

test("the Stick survives the navigation that locking a lane triggers", () => {
    assert.equal(stickVisible(null, true), true);
    // Load-bearing: unmounting here destroys the pointer capture, the browser
    // fires pointercancel, and the release handler reads it as the viewer
    // letting go — every drag abandoned before the finger had moved.
    assert.equal(
        stickVisible(engage(), false), true,
        "stays mounted on the action node, which is not itself a drag node"
    );
});

test("the Stick hides the moment the route is won", () => {
    assert.equal(stickVisible(won(), true), false);
    assert.equal(stickVisible(won(), false), false);
    assert.equal(stickVisible(null, false), false, "never on an ordinary node");
});

test("lane selection ignores vertical travel", () => {
    assert.equal(laneForOffset(-100, 400), "left");
    assert.equal(laneForOffset(100, 400), "right");
});

test("travel under the threshold locks nothing", () => {
    assert.equal(laneForOffset(-40, 400), null, "0.1 of width is a nudge, not a choice");
    assert.equal(laneForOffset(0, 400), null);
    assert.equal(laneForOffset(40, 400), null);
});

test("the threshold is exact and symmetric", () => {
    assert.equal(laneForOffset(-72, 400), "left");
    assert.equal(laneForOffset(72, 400), "right");
    assert.equal(laneForOffset(-71.9, 400), null);
    assert.equal(laneForOffset(71.9, 400), null);
});

test("a zero-width stage cannot lock a lane", () => {
    assert.equal(laneForOffset(500, 0), null);
});

/* ------------------------------------------------------------------ *
 * Mixing Hold to Play with a capture node
 * ------------------------------------------------------------------ */

const holdIntoCapture = () => normalizeInteractionNode({
    id: "root",
    mainSrc: "root.mp4",
    subs: ["capture.mp4", "", "", ""],
    hotspots: [{ id: "left", holdToPlay: true }],
    children: {
        left: {
            mainSrc: "capture.mp4",
            dragHold: true,
            children: { dragLeft: { mainSrc: "action.mp4" } },
        },
    },
});

test("a capture node CAN be a hold scene — the two are layers in time", () => {
    // Hold to Play is a property of a HOTSPOT and always routes elsewhere; the
    // Stick only appears once a video has ENDED. So arriving here by any route
    // means hold to get through the scene, then drag to choose what happens
    // next. They are sequential and never compete for the same finger.
    //
    // This was briefly blocked on the theory that they would fight. They do not.
    const map = buildHoldEntryMap(holdIntoCapture());
    assert.equal(map.get("root-left")?.branch, "left");
    assert.equal(map.get("root-left")?.sourceNodeId, "root");
});

test("a capture node is a hold scene AND a drag node at the same time", () => {
    const tree = holdIntoCapture();
    assert.equal(buildHoldEntryMap(tree).has("root-left"), true, "arms a hold on arrival");
    assert.equal(
        buildDragEntryMap(tree).has("root-left-dragLeft"), true,
        "and still owns its lane"
    );
});

test("an ordinary hold destination still arms", () => {
    const tree = normalizeInteractionNode({
        id: "root",
        mainSrc: "root.mp4",
        subs: ["hold-scene.mp4", "", "", ""],
        hotspots: [{ id: "left", holdToPlay: true }],
        children: { left: { mainSrc: "hold-scene.mp4" } },
    });
    assert.equal(buildHoldEntryMap(tree).has("root-left"), true);
});
