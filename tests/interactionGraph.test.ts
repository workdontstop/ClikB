import test from "node:test";
import assert from "node:assert/strict";

import {
    createDefaultHotspots,
    normalizeInteractionNode,
    InteractionNode,
} from "../src/TouchInteractionModel";
import {
    compileOrphans,
    compilePlanGraph,
    compileTreeGraph,
    collectTreeMediaUrls,
    layoutGraph,
    parseStoredMediaSlots,
    parsePlanPrefix,
    planThumbsFromSlots,
    pickThumb,
    subNodeId,
    MediaSlot,
} from "../src/interactionGraph";

const node = (raw: any): InteractionNode => normalizeInteractionNode(raw);

/* ------------------------------------------------------------------ *
 * Plan prefix parsing
 * ------------------------------------------------------------------ */

test("parses a root prefix", () => {
    assert.deepEqual(parsePlanPrefix("[NODE 1 - ROOT] Main menu"), { nodeId: "1" });
});

test("parses a branch prefix into id, parent and label", () => {
    assert.deepEqual(parsePlanPrefix("[NODE 5 - BRANCH FROM 2: Attack] The spy shoots"), {
        nodeId: "5",
        parentId: "2",
        label: "Attack",
    });
});

test("prefix parsing is case insensitive", () => {
    assert.deepEqual(parsePlanPrefix("[node 3 - branch from 2: Hack] ..."), {
        nodeId: "3",
        parentId: "2",
        label: "Hack",
    });
});

test("an unprefixed keyPoint yields nothing rather than throwing", () => {
    assert.deepEqual(parsePlanPrefix("The spy faces a choice"), {});
    assert.deepEqual(parsePlanPrefix(undefined), {});
    assert.deepEqual(parsePlanPrefix(42), {});
});

/* ------------------------------------------------------------------ *
 * Plan graph
 * ------------------------------------------------------------------ */

const HEIST = [
    "[NODE 1 - ROOT] Main menu for 'The Heist'",
    "[NODE 2 - BRANCH FROM 1: Engage] The spy faces a choice",
    "[NODE 3 - BRANCH FROM 2: Hack] The spy hacks the terminal",
    "[NODE 4 - BRANCH FROM 3: Enter Vault] VICTORY",
    "[NODE 5 - BRANCH FROM 2: Attack] The spy shoots",
    "[NODE 6 - BRANCH FROM 5: Overwhelmed] FAILURE",
];

test("plan graph builds nodes, edges and depth from the prefixes", () => {
    const graph = compilePlanGraph(HEIST);

    assert.equal(graph.source, "plan");
    assert.equal(graph.nodes.length, 6);
    assert.equal(graph.edges.length, 5);

    const depth = new Map(graph.nodes.map((n) => [n.id, n.depth]));
    assert.equal(depth.get("1"), 0);
    assert.equal(depth.get("2"), 1);
    assert.equal(depth.get("3"), 2);
    assert.equal(depth.get("4"), 3);
    assert.equal(depth.get("6"), 3);
});

test("plan nodes carry the branch label and are all marked planned", () => {
    const graph = compilePlanGraph(HEIST);
    const five = graph.nodes.find((n) => n.id === "5");
    assert.equal(five?.label, "Attack");
    assert.ok(graph.nodes.every((n) => n.isPlanned));
});

test("plan leaves are terminal and interior nodes are not", () => {
    const graph = compilePlanGraph(HEIST);
    const terminal = new Map(graph.nodes.map((n) => [n.id, n.isTerminal]));
    assert.equal(terminal.get("4"), true);
    assert.equal(terminal.get("6"), true);
    assert.equal(terminal.get("2"), false);
});

test("a plan with no prefixes degrades to a flat list rather than an empty map", () => {
    const graph = compilePlanGraph(["scene one", "scene two", "scene three"]);
    assert.equal(graph.nodes.length, 3);
    assert.equal(graph.edges.length, 0);
    assert.deepEqual(graph.nodes.map((n) => n.id), ["1", "2", "3"]);
});

test("a branch from a node the plan never defines is reported, not dropped", () => {
    const graph = compilePlanGraph([
        "[NODE 1 - ROOT] start",
        "[NODE 4 - BRANCH FROM 9: Ghost] orphaned branch",
    ]);
    assert.equal(graph.nodes.length, 2);
    assert.equal(graph.edges.length, 0);
    assert.equal(graph.warnings.length, 1);
});

test("plan thumbs are positional and pass through untouched", () => {
    const graph = compilePlanGraph(HEIST, [
        { url: "a.mp4", kind: "video" },
        null,
        { url: "c.png", kind: "image" },
    ]);
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    assert.deepEqual(byId.get("1")?.thumb, { url: "a.mp4", kind: "video" });
    assert.equal(byId.get("2")?.thumb, null);
    assert.deepEqual(byId.get("3")?.thumb, { url: "c.png", kind: "image" });
});

test("compilePlanGraph on junk returns an empty plan graph", () => {
    assert.equal(compilePlanGraph(null).nodes.length, 0);
    assert.equal(compilePlanGraph([]).source, "plan");
});

/* ------------------------------------------------------------------ *
 * pickThumb — video is the truth, image only stands in
 * ------------------------------------------------------------------ */

test("pickThumb prefers the video over the image", () => {
    assert.deepEqual(pickThumb("v.mp4", "i.png"), { url: "v.mp4", kind: "video" });
});

test("pickThumb falls back to the image only when there is no video", () => {
    assert.deepEqual(pickThumb("", "i.png"), { url: "i.png", kind: "image" });
    assert.deepEqual(pickThumb(null, "i.png"), { url: "i.png", kind: "image" });
    assert.equal(pickThumb(null, null), null);
    assert.equal(pickThumb("   ", "  "), null);
});

test("typed A slots supply plan thumbnails without interleaved B-shot drift", () => {
    const topology = [
        { i: "1" },
        { i: "2", p: "1" },
    ];
    const slots: MediaSlot[] = [
        { url: "a0.mp4", type: "A", sceneIndex: 0 },
        { url: "b0.mp4", type: "B", sceneIndex: 0, bIndex: 0 },
        { url: "a1.mp4", type: "A", sceneIndex: 1 },
    ];
    assert.deepEqual(
        planThumbsFromSlots(topology, slots, ["a0.mp4", "b0.mp4", "a1.mp4"])
            .map((thumb) => thumb?.url),
        ["a0.mp4", "a1.mp4"]
    );
});

test("stored plan slot parsing preserves typed A/B identity", () => {
    const slots = parseStoredMediaSlots(JSON.stringify({
        v: 1,
        t: [{ i: "1" }],
        s: [
            { url: "a0.mp4", type: "A", sceneIndex: 0 },
            { url: "b0.mp4", type: "B", sceneIndex: 0, bIndex: 0 },
            { url: "", type: "B", sceneIndex: 0 },
        ],
    }));
    assert.deepEqual(slots.map((slot) => [slot.type, slot.url]), [
        ["A", "a0.mp4"],
        ["B", "b0.mp4"],
    ]);
});

/* ------------------------------------------------------------------ *
 * Tree graph
 * ------------------------------------------------------------------ */

test("an empty tree yields a single terminal root and a dead-end warning", () => {
    const graph = compileTreeGraph(node({ id: "root", mainSrc: "root.mp4" }));
    assert.equal(graph.nodes.length, 1);
    assert.equal(graph.nodes[0].isTerminal, true);
    assert.equal(graph.warnings.length, 1);
});

test("a child branch produces an edge and a deeper node", () => {
    const graph = compileTreeGraph(
        node({
            id: "root",
            mainSrc: "root.mp4",
            subs: ["left.mp4", "", "", ""],
            children: { left: { id: "root-left", mainSrc: "left.mp4" } },
        })
    );

    assert.deepEqual(graph.nodes.map((n) => n.id).sort(), ["root", "root-left"]);
    assert.equal(graph.edges.length, 1);
    assert.equal(graph.edges[0].kind, "child");
    assert.equal(graph.edges[0].branch, "left");
    assert.equal(graph.nodes.find((n) => n.id === "root-left")?.depth, 1);
});

test("branchesUsed drives the compass dots and counts only resolvable branches", () => {
    const graph = compileTreeGraph(
        node({
            id: "root",
            mainSrc: "root.mp4",
            subs: ["left.mp4", "right.mp4", "", ""],
            children: { left: { id: "root-left", mainSrc: "left.mp4" } },
        })
    );

    const root = graph.nodes.find((n) => n.id === "root");
    assert.deepEqual(root?.branchesUsed, ["left", "right"]);
});

test("a terminal sub becomes a leaf so the branch does not appear to lead nowhere", () => {
    const graph = compileTreeGraph(
        node({ id: "root", mainSrc: "root.mp4", subs: ["sub-left.mp4", "", "", ""] })
    );

    const leafId = subNodeId("root", "left");
    const leaf = graph.nodes.find((n) => n.id === leafId);
    assert.ok(leaf);
    assert.equal(leaf?.isTerminal, true);
    assert.deepEqual(leaf?.thumb, { url: "sub-left.mp4", kind: "video" });
    assert.equal(graph.edges[0].kind, "sub");
});

test("a resolvable loop link becomes a loop edge and is not traversed", () => {
    const hotspots = createDefaultHotspots();
    hotspots[0] = { ...hotspots[0], loopTargetNodeId: "root" };

    const graph = compileTreeGraph(
        node({
            id: "root",
            mainSrc: "root.mp4",
            subs: ["left.mp4", "", "", ""],
            hotspots,
            children: { left: { id: "root-left", mainSrc: "left.mp4" } },
        })
    );

    const loop = graph.edges.find((e) => e.kind === "loop");
    assert.ok(loop);
    assert.equal(loop?.to, "root");
    // Loop wins over the child, so root-left is never reached.
    assert.equal(graph.nodes.length, 1);
});

test("a stale loop link falls through to the ordinary child rather than dead-ending", () => {
    const hotspots = createDefaultHotspots();
    hotspots[0] = { ...hotspots[0], loopTargetNodeId: "deleted-node" };

    const graph = compileTreeGraph(
        node({
            id: "root",
            mainSrc: "root.mp4",
            subs: ["left.mp4", "", "", ""],
            hotspots,
            children: { left: { id: "root-left", mainSrc: "left.mp4" } },
        })
    );

    assert.equal(graph.edges.length, 1);
    assert.equal(graph.edges[0].kind, "child");
    assert.equal(graph.nodes.length, 2);
});

test("a victory hotspot marks its destination, which suppresses the dead-end warning", () => {
    const hotspots = createDefaultHotspots();
    hotspots[0] = { ...hotspots[0], isVictory: true };

    const graph = compileTreeGraph(
        node({
            id: "root",
            mainSrc: "root.mp4",
            subs: ["win.mp4", "", "", ""],
            hotspots,
            children: { left: { id: "win", mainSrc: "win.mp4" } },
        })
    );

    const win = graph.nodes.find((n) => n.id === "win");
    assert.equal(win?.isVictory, true);
    assert.equal(win?.isTerminal, true);
    assert.equal(graph.warnings.length, 0);
});

test("a terminal non-victory node is reported as a dead end", () => {
    const graph = compileTreeGraph(
        node({
            id: "root",
            mainSrc: "root.mp4",
            subs: ["lose.mp4", "", "", ""],
            children: { left: { id: "lose", mainSrc: "lose.mp4" } },
        })
    );
    assert.ok(graph.warnings.some((w) => w.includes("lose")));
});

test("autoPlay produces an auto edge to the autoPlay child", () => {
    const graph = compileTreeGraph(
        node({ id: "root", mainSrc: "root.mp4", autoPlaySrc: "cont.mp4" })
    );
    const auto = graph.edges.find((e) => e.kind === "auto");
    assert.ok(auto);
    assert.equal(auto?.to, "root-autoPlay");
});

test("a stale auto-loop is reported instead of drawing an edge to nothing", () => {
    const graph = compileTreeGraph(
        node({ id: "root", mainSrc: "root.mp4", autoLoopTargetNodeId: "gone" })
    );
    assert.equal(graph.edges.length, 0);
    assert.ok(graph.warnings.some((w) => w.includes("auto-loop")));
});

test("a self-loop terminates rather than recursing forever", () => {
    const hotspots = createDefaultHotspots();
    hotspots[0] = { ...hotspots[0], loopTargetNodeId: "root" };
    const graph = compileTreeGraph(node({ id: "root", mainSrc: "root.mp4", hotspots }));
    assert.equal(graph.nodes.length, 1);
    assert.equal(graph.edges.length, 1);
});

test("compileTreeGraph on a missing tree is empty, not a throw", () => {
    const graph = compileTreeGraph(null);
    assert.equal(graph.nodes.length, 0);
    assert.equal(graph.source, "tree");
});

/* ------------------------------------------------------------------ *
 * Orphans — B-shots and unwired media
 * ------------------------------------------------------------------ */

const SLOTS: MediaSlot[] = [
    { url: "a0.mp4", type: "A", sceneIndex: 0 },
    { url: "b0.mp4", type: "B", sceneIndex: 0, bIndex: 0 },
    { url: "a1.mp4", type: "A", sceneIndex: 1 },
];

test("collectTreeMediaUrls finds main scenes and terminal subs", () => {
    const urls = collectTreeMediaUrls(
        node({
            id: "root",
            mainSrc: "a0.mp4",
            subs: ["sub.mp4", "a1.mp4", "", ""],
            children: { right: { id: "root-right", mainSrc: "a1.mp4" } },
        })
    );
    assert.ok(urls.has("a0.mp4"));
    assert.ok(urls.has("sub.mp4"));
    assert.ok(urls.has("a1.mp4"));
});

test("inactive retained children do not reserve videos from the unlinked tray", () => {
    const root = node({
        id: "root",
        mainSrc: "a0.mp4",
        subs: ["", "", "", ""],
        children: {
            left: {
                mainSrc: "b0.mp4",
                subs: ["a1.mp4", "", "", ""],
            },
        },
    });
    assert.deepEqual(Array.from(collectTreeMediaUrls(root)), ["a0.mp4"]);
    assert.deepEqual(
        compileOrphans(root, SLOTS).map((orphan) => orphan.thumb?.url),
        ["b0.mp4", "a1.mp4"]
    );
});

test("only slots the tree does not use become orphans", () => {
    const root = node({ id: "root", mainSrc: "a0.mp4" });
    const orphans = compileOrphans(root, SLOTS);
    assert.deepEqual(orphans.map((o) => o.thumb?.url), ["b0.mp4", "a1.mp4"]);
});

test("a B-shot orphan is labelled with the scene it supports", () => {
    const orphans = compileOrphans(node({ id: "root", mainSrc: "a0.mp4" }), SLOTS);
    const bShot = orphans.find((o) => o.slotType === "B");
    assert.equal(bShot?.sceneIndex, 0);
    assert.equal(bShot?.label, "support · scene 1");
});

test("linking a B-shot removes it from the tray", () => {
    const root = node({
        id: "root",
        mainSrc: "a0.mp4",
        subs: ["b0.mp4", "", "", ""],
        children: { left: { id: "root-left", mainSrc: "b0.mp4" } },
    });
    const orphans = compileOrphans(root, SLOTS);
    assert.deepEqual(orphans.map((o) => o.thumb?.url), ["a1.mp4"]);
});

test("orphan detection ignores slot order, so interleaved B-shots cannot drift it", () => {
    const root = node({ id: "root", mainSrc: "a1.mp4" });
    const shuffled = [SLOTS[2], SLOTS[0], SLOTS[1]];
    const orphans = compileOrphans(root, shuffled);
    assert.deepEqual(orphans.map((o) => o.thumb?.url).sort(), ["a0.mp4", "b0.mp4"]);
});

test("with no tree there is no tray, because nothing can be unlinked yet", () => {
    // Storybook shows the plan before the interaction tool has ever been opened.
    // Treating every slot as unlinked there just repeats the plan nodes.
    assert.deepEqual(compileOrphans(null, SLOTS), []);
    assert.deepEqual(compileOrphans(undefined, SLOTS), []);
    assert.equal(compileTreeGraph(null, SLOTS).orphans.length, 0);
});

test("an empty tree still lists its slots, unlike no tree at all", () => {
    const empty = node({ id: "root", mainSrc: "" });
    assert.equal(compileOrphans(empty, SLOTS).length, 3);
});

test("before anything is wired the tray is B-shots only, since A-shots are the plan's own nodes", () => {
    // What the map does while the plan is the structure: A-shots are already
    // drawn as scene nodes, so listing them as unlinked would repeat them.
    const empty = node({ id: "root", mainSrc: "" });
    const bShotsOnly = SLOTS.filter((slot) => slot.type === "B");
    const tray = compileOrphans(empty, bShotsOnly);

    assert.equal(tray.length, 1);
    assert.equal(tray[0].slotType, "B");
    assert.equal(tray[0].sceneIndex, 0);
});

test("once a tree is authored an unused A-shot is genuinely unlinked", () => {
    const authored = node({
        id: "root",
        mainSrc: "a0.mp4",
        subs: ["b0.mp4", "", "", ""],
        children: { left: { id: "root-left", mainSrc: "b0.mp4" } },
    });
    // a1.mp4 exists but the tree never references it.
    assert.deepEqual(
        compileOrphans(authored, SLOTS).map((o) => o.thumb?.url),
        ["a1.mp4"]
    );
});

test("compileTreeGraph attaches orphans for the slots it was given", () => {
    const graph = compileTreeGraph(node({ id: "root", mainSrc: "a0.mp4" }), SLOTS);
    assert.equal(graph.orphans.length, 2);
});

/* ------------------------------------------------------------------ *
 * Vertical layout
 * ------------------------------------------------------------------ */

test("depth runs down the screen", () => {
    const graph = compilePlanGraph(HEIST);
    const layout = layoutGraph(graph);
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    assert.ok((byId.get("2")?.y ?? 0) > (byId.get("1")?.y ?? 0));
    assert.ok((byId.get("4")?.y ?? 0) > (byId.get("3")?.y ?? 0));
});

test("siblings are packed across, only where occupied", () => {
    const graph = compilePlanGraph(HEIST);
    const layout = layoutGraph(graph, { nodeSize: 72, crossGap: 24 });
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));

    // Nodes 3 and 5 are the only two siblings at depth 2, so they sit one step
    // apart — not four slots apart, which is what reserving a slot per branch
    // would produce and what would force a horizontal scroll.
    const gap = Math.abs((byId.get("5")?.x ?? 0) - (byId.get("3")?.x ?? 0));
    assert.equal(gap, 96);
});

test("a parent is centred over the span its children occupy", () => {
    const graph = compilePlanGraph(HEIST);
    const layout = layoutGraph(graph);
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    const two = byId.get("2")?.x ?? 0;
    const three = byId.get("3")?.x ?? 0;
    const five = byId.get("5")?.x ?? 0;
    assert.equal(two, (three + five) / 2);
});

test("width stays bounded by sibling count, not by depth", () => {
    const deep = compilePlanGraph([
        "[NODE 1 - ROOT] a",
        "[NODE 2 - BRANCH FROM 1: x] b",
        "[NODE 3 - BRANCH FROM 2: x] c",
        "[NODE 4 - BRANCH FROM 3: x] d",
        "[NODE 5 - BRANCH FROM 4: x] e",
        "[NODE 6 - BRANCH FROM 5: x] f",
        "[NODE 7 - BRANCH FROM 6: x] g",
    ]);
    const layout = layoutGraph(deep, { nodeSize: 72, crossGap: 24, padding: 32 });
    assert.equal(layout.width, 72 + 32 * 2);
    assert.ok(layout.height > layout.width);
});

test("loop edges do not drive layout", () => {
    const hotspots = createDefaultHotspots();
    hotspots[0] = { ...hotspots[0], loopTargetNodeId: "root" };
    const graph = compileTreeGraph(node({ id: "root", mainSrc: "root.mp4", hotspots }));
    const layout = layoutGraph(graph);
    assert.equal(layout.nodes.length, 1);
    assert.equal(layout.edges.filter((e) => e.kind === "loop").length, 1);
});

test("horizontal orientation swaps the axes: depth runs across, siblings down", () => {
    const graph = compilePlanGraph(HEIST);
    const layout = layoutGraph(graph, { orientation: "horizontal" });
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));

    // Depth on X.
    assert.ok((byId.get("2")?.x ?? 0) > (byId.get("1")?.x ?? 0));
    assert.ok((byId.get("4")?.x ?? 0) > (byId.get("3")?.x ?? 0));
    // Same depth means the same column.
    assert.equal(byId.get("3")?.x, byId.get("5")?.x);
    // Siblings separate on Y.
    assert.notEqual(byId.get("3")?.y, byId.get("5")?.y);
});

test("horizontal is wider than tall, vertical is taller than wide", () => {
    const graph = compilePlanGraph(HEIST);
    const across = layoutGraph(graph, { orientation: "horizontal" });
    const down = layoutGraph(graph, { orientation: "vertical" });

    assert.ok(across.width > across.height);
    assert.ok(down.height > down.width);
    // Same graph either way — only the placement differs.
    assert.equal(across.nodes.length, down.nodes.length);
});

test("a parent is still centred over its children when horizontal", () => {
    const layout = layoutGraph(compilePlanGraph(HEIST), { orientation: "horizontal" });
    const byId = new Map(layout.nodes.map((n) => [n.id, n]));
    const two = byId.get("2")?.y ?? 0;
    const three = byId.get("3")?.y ?? 0;
    const five = byId.get("5")?.y ?? 0;
    assert.equal(two, (three + five) / 2);
});

test("the tray stays below the tree in both orientations", () => {
    const graph = compileTreeGraph(node({ id: "root", mainSrc: "a0.mp4" }), SLOTS);
    const across = layoutGraph(graph, { orientation: "horizontal" });
    const down = layoutGraph(graph, { orientation: "vertical" });

    assert.ok(across.orphans.every((o) => o.y >= across.trayY));
    assert.ok(down.orphans.every((o) => o.y >= down.trayY));
    assert.equal(across.orphans[0].x, down.orphans[0].x);
});

test("orphans land in a tray below the tree, starting at the left edge", () => {
    const graph = compileTreeGraph(node({ id: "root", mainSrc: "a0.mp4" }), SLOTS);
    const layout = layoutGraph(graph, { padding: 32 });
    assert.equal(layout.orphans.length, 2);
    assert.ok(layout.trayY > (layout.nodes[0]?.y ?? 0));
    assert.equal(layout.orphans[0].x, 32);
    assert.ok(layout.orphans.every((o) => o.y >= layout.trayY));
});

/* ------------------------------------------------------------------ *
 * Drag & Hold lanes
 * ------------------------------------------------------------------ */

const dragNode = (opts: { payoff?: boolean; right?: boolean } = {}) =>
    node({
        id: "root",
        mainSrc: "root.mp4",
        dragHold: true,
        hotspots: createDefaultHotspots(),
        children: {
            dragLeft: {
                mainSrc: "left-action.mp4",
                ...(opts.payoff ? { autoPlaySrc: "left-payoff.mp4" } : {}),
            },
            ...(opts.right ? { dragRight: { mainSrc: "right-action.mp4" } } : {}),
        },
    });

test("a drag node compiles lane edges, not branch edges", () => {
    const graph = compileTreeGraph(dragNode({ right: true }));
    const kinds = graph.edges.map((e) => e.kind);
    assert.deepEqual(kinds, ["drag", "drag"]);
    assert.deepEqual(
        graph.edges.map((e) => e.to),
        ["root-dragLeft", "root-dragRight"]
    );
    assert.deepEqual(graph.edges.map((e) => e.branch), ["dragLeft", "dragRight"]);
});

test("a drag node is marked and draws no compass dots", () => {
    const graph = compileTreeGraph(dragNode());
    const root = graph.nodes.find((n) => n.id === "root");
    assert.equal(root?.isDrag, true);
    assert.deepEqual(root?.branchesUsed, []);
});

test("a node with a lane is never terminal — an empty lane returns the viewer here", () => {
    const graph = compileTreeGraph(dragNode());
    const root = graph.nodes.find((n) => n.id === "root");
    assert.equal(root?.isTerminal, false);
    assert.equal(root?.isDrag, true);
});

test("dragHold with nothing authored is just an ordinary node", () => {
    // The panel being open is not a route. Nothing to drag means no Stick, and
    // the map should not pretend otherwise.
    const bare = compileTreeGraph(node({ id: "root", mainSrc: "r.mp4", dragHold: true }));
    const root = bare.nodes.find((n) => n.id === "root");
    assert.equal(root?.isDrag, undefined);
    assert.equal(root?.isTerminal, true, "genuinely a dead end — it offers nothing");
});

test("a lane action clip is not a dead end without a payoff", () => {
    const graph = compileTreeGraph(dragNode());
    const action = graph.nodes.find((n) => n.id === "root-dragLeft");
    assert.equal(action?.isTerminal, false);
    assert.equal(
        graph.warnings.some((w) => w.includes("dead end")),
        false,
        "returning to the drag node is a real route, not a dead end"
    );
    assert.ok(graph.warnings.some((w) => w.includes("no payoff")));
});

test("a payoff compiles as the action node's auto edge", () => {
    const graph = compileTreeGraph(dragNode({ payoff: true }));
    const auto = graph.edges.find((e) => e.kind === "auto");
    assert.equal(auto?.from, "root-dragLeft");
    assert.equal(auto?.to, "root-dragLeft-autoPlay");
    assert.equal(graph.warnings.some((w) => w.includes("no payoff")), false);
});

test("a capture node draws its hotspots AND its lanes", () => {
    // Drag mode does not replace the hotspots. The viewer can drag left, drag
    // right, or tap a choice — a map showing only lanes would hide half the
    // routes that actually exist.
    const graph = compileTreeGraph(
        node({
            id: "root",
            mainSrc: "root.mp4",
            dragHold: true,
            subs: ["tap-me.mp4", "", "", ""],
            children: { dragLeft: { mainSrc: "left-action.mp4" } },
        })
    );
    const kinds = graph.edges.map((e) => e.kind).sort();
    assert.deepEqual(kinds, ["drag", "sub"]);

    const root = graph.nodes.find((n) => n.id === "root");
    assert.equal(root?.isDrag, true);
    assert.deepEqual(root?.branchesUsed, ["left"], "the tap route still counts");
});

test("a capture node with hotspots and an autoplay is still not terminal", () => {
    const graph = compileTreeGraph(
        node({
            id: "root",
            mainSrc: "root.mp4",
            dragHold: true,
            autoPlaySrc: "continue.mp4",
            children: { dragRight: { mainSrc: "right-action.mp4" } },
        })
    );
    const root = graph.nodes.find((n) => n.id === "root");
    assert.equal(root?.isTerminal, false);
    assert.ok(graph.edges.some((e) => e.kind === "drag"));
    assert.ok(graph.edges.some((e) => e.kind === "auto"));
});

test("lane videos are not mistaken for orphans", () => {
    const urls = collectTreeMediaUrls(dragNode({ payoff: true, right: true }));
    assert.ok(urls.has("left-action.mp4"));
    assert.ok(urls.has("left-payoff.mp4"));
    assert.ok(urls.has("right-action.mp4"));
});

test("layout terminates on a lane that loops back to its drag node", () => {
    const graph = compileTreeGraph(
        node({
            id: "root",
            mainSrc: "root.mp4",
            dragHold: true,
            children: {
                dragLeft: {
                    mainSrc: "a.mp4",
                    hotspots: [{ id: "left", loopTargetNodeId: "root" }],
                },
            },
        })
    );
    const layout = layoutGraph(graph);
    assert.ok(layout.nodes.length >= 2);
});

/* ------------------------------------------------------------------ *
 * No video means invalid — and takes the subtree with it
 * ------------------------------------------------------------------ */

test("a node with no video is dropped, and so is everything under it", () => {
    // Removing a video leaves the node in the tree with mainSrc: "" so the
    // subtree survives and can be restored. The map must not keep drawing it —
    // and must not draw its children either, because a scene that cannot play
    // never reveals its hotspots, so nothing below it is reachable.
    const graph = compileTreeGraph(
        node({
            id: "root",
            mainSrc: "root.mp4",
            subs: ["", "", "", ""],
            children: {
                left: {
                    mainSrc: "",                       // video removed
                    subs: ["grandchild.mp4", "", "", ""],
                },
            },
        })
    );
    assert.deepEqual(graph.nodes.map((n) => n.id), ["root"]);
    assert.deepEqual(graph.edges, [], "no edge into a scene that cannot play");
    assert.equal(graph.warnings.some((w) => w.includes("root-left")), false,
        "an inactive retained subtree is not part of the live graph");
});

test("a live sibling survives while the empty one is pruned", () => {
    const graph = compileTreeGraph(
        node({
            id: "root",
            mainSrc: "root.mp4",
            subs: ["", "right.mp4", "", ""],
            children: {
                left: { mainSrc: "" },
                right: { mainSrc: "right.mp4" },
            },
        })
    );
    const ids = graph.nodes.map((n) => n.id).sort();
    assert.deepEqual(ids, ["root", "root-right"]);
    const root = graph.nodes.find((n) => n.id === "root");
    assert.deepEqual(root?.branchesUsed, ["right"], "no compass dot for a dead branch");
});

test("a history link to a videoless node is not a route", () => {
    const graph = compileTreeGraph(
        node({
            id: "root",
            mainSrc: "root.mp4",
            hotspots: [{ id: "left", loopTargetNodeId: "root-right" }],
            children: { right: { mainSrc: "" } },
        })
    );
    assert.equal(graph.edges.some((e) => e.kind === "loop"), false);
    assert.equal(graph.nodes.some((n) => n.id === "root-right"), false);
});

/* ------------------------------------------------------------------ *
 * Autoplay is drawn from autoPlaySrc, not the materialised child
 * ------------------------------------------------------------------ */

test("autoplay draws immediately, before its child node exists", () => {
    // The editor writes autoPlaySrc the moment a video is chosen; the child is
    // created later by the normalizer. Requiring the child left autoplay
    // invisible on the map until something else touched the tree.
    const graph = compileTreeGraph({
        id: "root",
        mainSrc: "root.mp4",
        subs: ["", "", "", ""],
        hotspots: createDefaultHotspots(),
        autoPlaySrc: "continue.mp4",
        children: {},
    } as any);

    const auto = graph.edges.find((e) => e.kind === "auto");
    assert.equal(auto?.from, "root");
    assert.equal(auto?.to, "root-autoPlay", "id matches what the normalizer will create");
    assert.ok(graph.nodes.some((n) => n.id === "root-autoPlay"));
    assert.equal(graph.nodes.find((n) => n.id === "root")?.isTerminal, false);
});

test("autoplay does not duplicate once the child materialises", () => {
    const graph = compileTreeGraph(
        node({
            id: "root",
            mainSrc: "root.mp4",
            autoPlaySrc: "continue.mp4",
            children: { autoPlay: { mainSrc: "continue.mp4" } },
        })
    );
    assert.equal(graph.edges.filter((e) => e.kind === "auto").length, 1);
    assert.equal(graph.nodes.filter((n) => n.id === "root-autoPlay").length, 1);
});

test("a retained autoplay child is absent after autoplay is removed", () => {
    const root = node({
        id: "root",
        mainSrc: "root.mp4",
        autoPlaySrc: "",
        children: { autoPlay: { mainSrc: "old-auto.mp4" } },
    });
    const graph = compileTreeGraph(root);
    assert.deepEqual(graph.nodes.map((entry) => entry.id), ["root"]);
    assert.equal(graph.edges.some((edge) => edge.kind === "auto"), false);
    assert.equal(collectTreeMediaUrls(root).has("old-auto.mp4"), false);
});

test("an auto-loop to a videoless node warns instead of drawing", () => {
    const graph = compileTreeGraph(
        node({
            id: "root",
            mainSrc: "root.mp4",
            autoLoopTargetNodeId: "root-left",
            children: { left: { mainSrc: "" } },
        })
    );
    assert.equal(graph.edges.length, 0);
    assert.ok(graph.warnings.some((w) => w.includes("no longer exists")));
});
