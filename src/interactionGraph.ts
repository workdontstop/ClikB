import {
    BRANCH_IDS,
    BranchId,
    InteractionNode,
    LANE_IDS,
    LANE_PATH,
    PathId,
} from "./TouchInteractionModel";
import {
    collectInteractionNodes,
    createNodeIndex,
    resolveBranchDestination,
    resolveLaneDestination,
} from "./TouchInteractionNavigation";

/**
 * The shared graph format behind the interaction node map.
 *
 * Two compilers write into it and one renderer reads out of it:
 *
 *   Storybook keyPoints  --compilePlanGraph()--\
 *                                               >-- InteractionGraph --> <InteractionNodeMap/>
 *   InteractInput treeRoot --compileTreeGraph()-/
 *
 * The renderer never learns which compiler produced its input, so the map's
 * Default (AI plan) and Active (live tree) views are the same component with a
 * different compile call.
 *
 * No React and no DOM, on purpose — the same reason TouchInteractionNavigation
 * and TouchHoldPlaybackModel have none. There is no browser in the sandbox, so
 * anything expressed here can be tested and anything expressed in the component
 * cannot.
 *
 * compileTreeGraph resolves every branch through resolveBranchDestination rather
 * than reading children/subs itself. That is deliberate: the map then shows
 * exactly what the player will do, including loop precedence and stale-link
 * fallthrough, and cannot drift from it.
 */

export type GraphSource = "tree" | "plan";
/**
 * "drag" is its own kind so the map can draw a Drag & Hold lane as the
 * commitment it is rather than as an ordinary choice. The payoff that follows
 * it is an "auto" edge, because that is exactly what it is.
 */
export type GraphEdgeKind = "child" | "sub" | "loop" | "auto" | "drag";
export type ThumbKind = "video" | "image";

/**
 * Where the node's still comes from. The editor holds videos only and Storybook
 * holds images only, so the kind travels with the url and the renderer picks the
 * element. Nothing here fetches, converts or manages media.
 */
export interface GraphThumb {
    url: string;
    kind: ThumbKind;
}

export interface GraphNode {
    id: string;
    /** Human label: "root", a branch name, or the planner's branch label. */
    label: string;
    depth: number;
    thumb: GraphThumb | null;
    /** Which of the four hotspots actually resolve somewhere. Drives the compass dots. */
    branchesUsed: BranchId[];
    /**
     * A Drag & Hold node. Its choices are lanes, not hotspots, so branchesUsed
     * is empty here and the renderer should draw the Stick rather than compass
     * dots.
     */
    isDrag?: boolean;
    /** Reached by a hotspot marked isVictory, or an autoPlay marked autoPlayIsVictory. */
    isVictory: boolean;
    /** Nothing leads onward from here. Terminal AND not victory is a dead end. */
    isTerminal: boolean;
    /** Planned by the AI but not yet built in the tree. Rendered ghosted. */
    isPlanned: boolean;
}

export interface GraphEdge {
    from: string;
    to: string;
    /** null for planner edges, which carry a label instead of a screen direction. */
    branch: PathId | null;
    label?: string;
    kind: GraphEdgeKind;
}

/**
 * A generated video that exists but is not (yet) part of the tree.
 *
 * B-shots are the usual case: the creator can link them manually later, so they
 * are parked in a tray rather than hidden. A video that silently disappears from
 * every view reads as a generation failure.
 */
export interface OrphanNode extends GraphNode {
    slotType: "A" | "B";
    /** For a B-shot this is the A-shot scene it supports. */
    sceneIndex: number;
}

export interface InteractionGraph {
    nodes: GraphNode[];
    edges: GraphEdge[];
    /** Generated media with no place in the tree. Drawn in a tray, not the flow. */
    orphans: OrphanNode[];
    source: GraphSource;
    /** Dead ends and stale loop links — the things drill-down can never show. */
    warnings: string[];
}

const EMPTY_GRAPH = (source: GraphSource): InteractionGraph => ({
    nodes: [],
    edges: [],
    orphans: [],
    source,
    warnings: [],
});

/**
 * One generated video slot, as Storybook wrote it.
 *
 * sceneIndex comes from unifiedIndexMap, where a B-shot's `index` is already its
 * parent A-shot — so a support shot can say which scene it belongs to without
 * any extra bookkeeping.
 */
export interface MediaSlot {
    url: string;
    type: "A" | "B";
    sceneIndex: number;
    bIndex?: number;
    /**
     * The planner's label for this scene, attached by Storybook where both the
     * plan and the slot table are in hand. Carrying it here means the editor
     * needs no copy of the plan to caption an unlinked video.
     */
    label?: string;
}

/**
 * The plan's SHAPE ONLY — node id, parent, branch label. Nothing else.
 *
 * This is what travels from Storybook to the interaction tool, and it is
 * deliberately tiny: a 9-node plan is well under 1KB, because the scene text,
 * the prompts and the media are all left behind. Thumbnails come from videoArray,
 * which the editor already receives as a prop.
 *
 * Small on purpose. The previous version stored the whole compiled graph inside
 * the video-save function, which put a second consumer of localStorage quota
 * right next to the code that rewrites every video slot. This one is a few
 * hundred bytes and is written from its own effect, nowhere near that path.
 */
export interface PlanTopologyEntry {
    /** Planner node id, e.g. "3". */
    i: string;
    /** Parent node id. Absent on the root. */
    p?: string;
    /** Branch label, e.g. "Attack". */
    l?: string;
}

export interface StoredInteractionPlan {
    v: 1;
    t: PlanTopologyEntry[];
    /** Typed generated-video slots. Optional so existing saved plans still load. */
    s?: MediaSlot[];
}

export const STORED_PLAN_KEY = "localInteractionPlan";

/** keyPoints -> the compact shape, ready to serialise. */
export const compilePlanTopology = (keyPoints: unknown): PlanTopologyEntry[] => {
    const points = Array.isArray(keyPoints) ? keyPoints : [];
    return points.map((text, index) => {
        const prefix = parsePlanPrefix(text);
        const entry: PlanTopologyEntry = { i: prefix.nodeId ?? String(index + 1) };
        if (prefix.parentId) entry.p = prefix.parentId;
        if (prefix.label) entry.l = prefix.label;
        return entry;
    });
};

/** Tolerant read: a malformed or absent payload yields null, never a throw. */
export const parseStoredPlan = (raw: unknown): PlanTopologyEntry[] | null => {
    if (typeof raw !== "string" || raw.trim().length === 0) return null;
    try {
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed?.t) ? parsed.t : null;
        if (!list) return null;
        return list.filter(
            (entry: any) => entry && typeof entry.i === "string"
        ) as PlanTopologyEntry[];
    } catch {
        return null;
    }
};

/** Reads the typed A/B slot table stored beside the plan topology. */
export const parseStoredMediaSlots = (raw: unknown): MediaSlot[] => {
    if (typeof raw !== "string" || raw.trim().length === 0) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed?.s)) return [];
        return parsed.s.filter((slot: any): slot is MediaSlot =>
            slot &&
            usable(slot.url) &&
            (slot.type === "A" || slot.type === "B") &&
            Number.isInteger(slot.sceneIndex) &&
            slot.sceneIndex >= 0
        );
    } catch {
        return [];
    }
};

/**
 * Whether the creator has authored anything yet.
 *
 * Decides which graph the map draws: user data overwrites default data, so as
 * soon as a single branch is wired the live tree becomes the structure and the
 * plan is demoted to captions on the unlinked tray.
 */
export const hasAuthoredStructure = (graph: InteractionGraph): boolean =>
    graph.edges.length > 0;

/**
 * Every video the tree currently references, as main scenes and as terminal subs.
 *
 * Orphan detection is set membership on this, never index arithmetic. B-shots
 * interleave into the slot numbering, so any index-based join would drift the
 * moment a B-shot is added — a URL either appears in the tree or it does not.
 */
export const collectTreeMediaUrls = (root?: InteractionNode | null): Set<string> => {
    const urls = new Set<string>();
    if (!root) return urls;

    const index = createNodeIndex(root);
    collectInteractionNodes(root).forEach(({ node }) => {
        if (usable(node.mainSrc)) urls.add(node.mainSrc);

        // Only terminal subs are separate media. A materialised child, loop or
        // inactive retained branch must not reserve its old raw sub URL.
        BRANCH_IDS.forEach((branch) => {
            const destination = resolveBranchDestination(index, node, branch);
            if (destination.kind === "sub" && usable(destination.src)) {
                urls.add(destination.src);
            }
        });

        // Before normalization materialises children.autoPlay, autoPlaySrc is
        // still a real active route and must count as used media.
        if (usable(node.autoPlaySrc) && !node.children?.autoPlay) {
            urls.add(node.autoPlaySrc);
        }
    });
    return urls;
};

/**
 * Slots whose video the tree does not use anywhere.
 *
 * "Unlinked" only means something relative to a tree. With no tree at all —
 * Storybook, where the plan is being shown before the interaction tool has ever
 * been opened — every video would qualify, and the tray would simply repeat the
 * nodes already drawn above it. An empty tree is different from no tree: there
 * the tray correctly reads "these exist, none are wired yet".
 */
export const compileOrphans = (
    root: InteractionNode | null | undefined,
    slots: MediaSlot[] = []
): OrphanNode[] => {
    if (!root) return [];

    const used = collectTreeMediaUrls(root);

    return slots
        .filter((slot) => usable(slot.url) && !used.has(slot.url))
        .map((slot) => ({
            id: `orphan::${slot.url}`,
            // The planner's label when Storybook supplied one; a positional
            // caption otherwise, so a hand-built tree still reads sensibly.
            label:
                slot.label?.trim() ||
                (slot.type === "B"
                    ? `support · scene ${slot.sceneIndex + 1}`
                    : `scene ${slot.sceneIndex + 1}`),
            depth: 0,
            thumb: { url: slot.url, kind: "video" as ThumbKind },
            branchesUsed: [],
            isVictory: false,
            isTerminal: true,
            isPlanned: false,
            slotType: slot.type,
            sceneIndex: slot.sceneIndex,
        }));
};

/** Synthetic id for a terminal sub video, which is an outcome but not a node. */
export const subNodeId = (nodeId: string, branch: BranchId): string =>
    `${nodeId}::sub:${branch}`;

const videoThumb = (url?: string | null): GraphThumb | null =>
    typeof url === "string" && url.trim().length > 0
        ? { url, kind: "video" }
        : null;

const usable = (url?: string | null): url is string =>
    typeof url === "string" && url.trim().length > 0;

/**
 * Video first, image only as a stand-in.
 *
 * The video is the final truth: the creator can regenerate or swap it, and can
 * choose not to keep the first-frame image at all, so the image is never assumed
 * to represent what actually plays. It fills the slot while the video does not
 * exist yet — which in Storybook is most of the time the map is useful.
 */
export const pickThumb = (
    videoUrl?: string | null,
    imageUrl?: string | null
): GraphThumb | null => {
    if (usable(videoUrl)) return { url: videoUrl, kind: "video" };
    if (usable(imageUrl)) return { url: imageUrl, kind: "image" };
    return null;
};

/**
 * Resolves A-shot plan thumbnails without positional joins against an A+B list.
 * The fallback exists only for v1 stored plans that predate typed slots.
 */
export const planThumbsFromSlots = (
    topology: PlanTopologyEntry[] | null | undefined,
    slots: MediaSlot[],
    legacyVideos: Array<string | null | undefined> = []
): Array<GraphThumb | null> => {
    const entries = Array.isArray(topology) ? topology : [];
    return entries.map((_, sceneIndex) => {
        const aShot = slots.find(
            (slot) => slot.type === "A" && slot.sceneIndex === sceneIndex
        );
        return pickThumb(
            aShot?.url ?? (slots.length === 0 ? legacyVideos[sceneIndex] : undefined)
        );
    });
};

/* ------------------------------------------------------------------ *
 * Live tree
 * ------------------------------------------------------------------ */

export const compileTreeGraph = (
    root?: InteractionNode | null,
    slots: MediaSlot[] = []
): InteractionGraph => {
    if (!root) return { ...EMPTY_GRAPH("tree"), orphans: compileOrphans(null, slots) };

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const warnings: string[] = [];
    const index = createNodeIndex(root);
    const seen = new Set<string>();

    const walk = (
        node: InteractionNode,
        depth: number,
        isVictory: boolean,
        /**
         * This node is a drag lane's action clip. It is never a dead end even
         * with nothing after it, because finishing one returns the viewer to
         * the drag node it came from.
         */
        isLaneAction = false
    ) => {
        // Guards a self-loop and any node a loop link points back at. Loop edges
        // are still recorded below; they are simply not traversed, exactly as
        // collectInteractionNodes refuses to follow them.
        if (seen.has(node.id)) return;
        seen.add(node.id);

        // ✅ NO VIDEO, NO NODE — and nothing below it either.
        //
        // This is a hard invalidity check, not a cosmetic one. It comes straight
        // from the player: a node with no mainSrc has nothing to play, so it can
        // never reach its end, so its hotspots never appear, so every route below
        // it is unreachable. Drawing that subtree advertises journeys the viewer
        // cannot take.
        //
        // It is also what makes a removed video actually disappear. Clearing the
        // media leaves the node in the tree with mainSrc: "" — deliberately, so
        // the subtree survives and can be restored — and the map used to keep
        // drawing it as an empty circle.
        //
        // Returning here prunes the whole branch: no node, no edge into it, and
        // the recursion stops so nothing under it is emitted.
        if (!usable(node.mainSrc)) {
            warnings.push(
                `${node.id}: no video — this scene and everything under it is unreachable`
            );
            return;
        }

        const branchesUsed: BranchId[] = [];
        const onward: Array<() => void> = [];
        // Lane-derived, matching the player. `dragHold` is editor panel state
        // and must not decide what the map draws.
        const isDrag = LANE_IDS.some((lane) => Boolean(node.children?.[LANE_PATH[lane]]?.mainSrc));

        // ✅ Lanes are drawn IN ADDITION to the four hotspots, not instead of
        // them. A capture node can offer both — drag left, drag right, tap a
        // hotspot, or wait out the auto-continuation — so a map that showed
        // only lanes would hide half the routes the viewer actually has.
        let lanesUsed = 0;
        if (isDrag) {
            LANE_IDS.forEach((lane) => {
                const destination = resolveLaneDestination(node, lane);
                if (destination.kind === "fallback") return;
                lanesUsed += 1;

                const action = destination.node;
                edges.push({
                    from: node.id,
                    to: action.id,
                    branch: LANE_PATH[lane],
                    label: lane,
                    kind: "drag",
                });
                onward.push(() =>
                    // Victory for a lane comes from the clicked edge like any
                    // other route; the payoff carries its own via
                    // autoPlayIsVictory when the walk reaches it.
                    walk(action, depth + 1, false, true)
                );

                if (!usable(action.autoPlaySrc) && !usable(action.children?.autoPlay?.mainSrc)) {
                    // Legal and deliberate — the engine returns the viewer to
                    // the drag node — but the creator should be able to see
                    // that this lane resolves to nothing.
                    warnings.push(
                        `${action.id}: drag lane has no payoff — it plays out and returns to ${node.id}`
                    );
                }
            });

            // No "neither lane authored" warning: isDrag is derived from the
            // lanes, so reaching here guarantees at least one exists.
        }

        BRANCH_IDS.forEach((branch) => {
            const destination = resolveBranchDestination(index, node, branch);
            if (destination.kind === "none") return;

            const hotspot = node.hotspots?.[BRANCH_IDS.indexOf(branch)];
            const routeIsVictory = hotspot?.isVictory === true;
            const label = hotspot?.customText?.trim() || branch;

            if (destination.kind === "loop") {
                // A link to a node with no video leads nowhere the viewer can
                // go, so it is not a route and must not draw a compass dot.
                if (!usable(destination.entry.node.mainSrc)) {
                    warnings.push(
                        `${node.id}: ${branch} links to ${destination.entry.node.id}, which has no video`
                    );
                    return;
                }
                branchesUsed.push(branch);
                edges.push({
                    from: node.id,
                    to: destination.entry.node.id,
                    branch,
                    label,
                    kind: "loop",
                });
                return;
            }

            if (destination.kind === "child") {
                const child = destination.node;
                // Same rule as the walk guard: no video, no route. Emitting the
                // edge here anyway would leave it pointing at a node the prune
                // never creates. Warned here rather than in walk, because the
                // whole point is that walk is never reached.
                if (!usable(child.mainSrc)) {
                    warnings.push(
                        `${child.id}: no video — this scene and everything under it is unreachable`
                    );
                    return;
                }
                branchesUsed.push(branch);
                edges.push({ from: node.id, to: child.id, branch, label, kind: "child" });
                onward.push(() => walk(child, depth + 1, routeIsVictory));
                return;
            }

            branchesUsed.push(branch);

            // A terminal sub plays in place and is not a node you can navigate
            // back into, but it IS an outcome — omitting it would draw a branch
            // that appears to lead nowhere.
            const id = subNodeId(node.id, branch);
            edges.push({ from: node.id, to: id, branch, label, kind: "sub" });
            onward.push(() => {
                if (seen.has(id)) return;
                seen.add(id);
                nodes.push({
                    id,
                    label,
                    depth: depth + 1,
                    thumb: videoThumb(destination.src),
                    branchesUsed: [],
                    isVictory: routeIsVictory,
                    isTerminal: true,
                    isPlanned: false,
                });
            });
        });

        // Node-level continuations. The editor keeps these mutually exclusive.
        const autoLoopId = node.autoLoopTargetNodeId;
        const autoChild = node.children?.autoPlay;
        let hasAuto = false;

        if (autoLoopId) {
            const target = index.get(autoLoopId)?.node;
            if (target && usable(target.mainSrc)) {
                hasAuto = true;
                edges.push({
                    from: node.id,
                    to: autoLoopId,
                    branch: "autoPlay",
                    label: "auto",
                    kind: "loop",
                });
            } else {
                warnings.push(
                    target
                        ? `${node.id}: auto-loop points at ${autoLoopId}, which has no video`
                        : `${node.id}: auto-loop points at a node that no longer exists`
                );
            }
        } else if (usable(node.autoPlaySrc)) {
            // ✅ Drawn from autoPlaySrc, NOT from the materialised child.
            //
            // The editor writes autoPlaySrc the instant a video is chosen, but
            // children.autoPlay is created later, by the normalizer. Requiring
            // the child meant an autoplay stayed invisible on the map until
            // something else touched the tree and triggered normalization —
            // which is why it only appeared after hotspots were added.
            //
            // The synthetic id matches what the normalizer will create, so the
            // node does not jump or duplicate once it materialises.
            const autoId = autoChild?.id ?? `${node.id}-autoPlay`;
            const autoSrc = autoChild?.mainSrc || node.autoPlaySrc || "";

            if (usable(autoSrc)) {
                hasAuto = true;
                edges.push({
                    from: node.id,
                    to: autoId,
                    branch: "autoPlay",
                    label: "auto",
                    kind: "auto",
                });

                if (autoChild) {
                    onward.push(() =>
                        walk(autoChild, depth + 1, node.autoPlayIsVictory === true)
                    );
                } else {
                    // No child node yet, so nothing to recurse into — emit the
                    // destination itself so the edge has somewhere to land.
                    onward.push(() => {
                        if (seen.has(autoId)) return;
                        seen.add(autoId);
                        nodes.push({
                            id: autoId,
                            label: "auto",
                            depth: depth + 1,
                            thumb: videoThumb(autoSrc),
                            branchesUsed: [],
                            isVictory: node.autoPlayIsVictory === true,
                            isTerminal: true,
                            isPlanned: false,
                        });
                    });
                }
            }
        }

        // Never terminal if it carries a Stick: even an unauthored lane returns
        // the viewer to this node, so a capture node cannot dead-end. A lane
        // action clip always leads somewhere too — its payoff if it has one, and
        // the drag node it came from if it does not.
        const isTerminal =
            branchesUsed.length === 0 && !hasAuto && !isLaneAction && !isDrag;

        nodes.push({
            id: node.id,
            label: depth === 0 ? "root" : node.id,
            depth,
            thumb: videoThumb(node.mainSrc),
            branchesUsed,
            isVictory,
            isTerminal,
            isPlanned: false,
            ...(isDrag ? { isDrag: true } : {}),
        });

        if (isTerminal && !isVictory) {
            warnings.push(`${node.id}: dead end — nothing leads onward and it is not a victory`);
        }

        onward.forEach((run) => run());
    };

    walk(root, 0, false);

    return {
        nodes,
        edges,
        orphans: compileOrphans(root, slots),
        source: "tree",
        warnings,
    };
};

/* ------------------------------------------------------------------ *
 * Planner blueprint
 * ------------------------------------------------------------------ */

/**
 * Parses the prefix GptInt is instructed to emit on every keyPoint:
 *
 *   [NODE 1 - ROOT] ...
 *   [NODE 5 - BRANCH FROM 2: Attack] ...
 *
 * Server-side IntentBlueprint already reads the same prefix for prompting. This
 * is the client-side read for drawing, kept separate so the map works on any
 * saved keyPoints array without a server round-trip.
 */
export interface PlanPrefix {
    nodeId?: string;
    parentId?: string;
    label?: string;
}

export const parsePlanPrefix = (text: unknown): PlanPrefix => {
    if (typeof text !== "string") return {};
    const match = text.match(/^\s*\[NODE\s+([^\]]+)\]/i);
    if (!match) return {};

    const inside = match[1].trim();

    const root = inside.match(/^(\d+)\s*-\s*ROOT$/i);
    if (root) return { nodeId: root[1] };

    const branch = inside.match(/^(\d+)\s*-\s*BRANCH\s+FROM\s+(\d+)\s*:\s*(.+)$/i);
    if (branch) {
        return {
            nodeId: branch[1],
            parentId: branch[2],
            label: branch[3].trim(),
        };
    }

    // Numbered but unparseable tail — still worth placing on the map.
    const bare = inside.match(/^(\d+)/);
    return bare ? { nodeId: bare[1] } : {};
};

/**
 * The planner designs a graph; this draws it. Nothing here writes into treeRoot.
 * The map is a reference, because hotspot geometry and count are user decisions
 * and the AI's structure is a suggestion the creator is free to ignore.
 *
 * thumbs are positional: thumbs[i] belongs to keyPoints[i]. The caller resolves
 * them with pickThumb, so the video/image precedence lives at the call site that
 * actually holds both, not in here.
 */
export const compilePlanGraph = (
    keyPoints: unknown,
    thumbs: Array<GraphThumb | null | undefined> = []
): InteractionGraph => graphFromTopology(compilePlanTopology(keyPoints), thumbs);

/**
 * The compact topology plus positional thumbnails, drawn as a graph.
 *
 * Storybook reaches this through compilePlanGraph with keyPoints in hand; the
 * interaction tool reaches it with the stored topology and videoArray. Same
 * output either way, so both surfaces draw an identical plan.
 */
export const graphFromTopology = (
    topology: PlanTopologyEntry[] | null | undefined,
    thumbs: Array<GraphThumb | null | undefined> = []
): InteractionGraph => {
    const entries = Array.isArray(topology) ? topology : [];
    if (entries.length === 0) return EMPTY_GRAPH("plan");

    const parsed = entries.map((entry, i) => ({
        // Unprefixed keyPoints still get a stable id from position, so a plan
        // the model returned without prefixes degrades to a flat list rather
        // than an empty map.
        id: entry.i || String(i + 1),
        parentId: entry.p,
        label: entry.l,
        thumb: thumbs[i] ?? null,
    }));

    const byId = new Map(parsed.map((entry) => [entry.id, entry]));
    const childCount = new Map<string, number>();
    parsed.forEach((entry) => {
        if (!entry.parentId || !byId.has(entry.parentId)) return;
        childCount.set(entry.parentId, (childCount.get(entry.parentId) ?? 0) + 1);
    });

    const depthOf = (id: string, guard = 0): number => {
        const entry = byId.get(id);
        if (!entry || !entry.parentId || guard > 32) return 0;
        return byId.has(entry.parentId) ? depthOf(entry.parentId, guard + 1) + 1 : 0;
    };

    const nodes: GraphNode[] = parsed.map((entry) => ({
        id: entry.id,
        label: entry.label ?? (entry.parentId ? entry.id : "root"),
        depth: depthOf(entry.id),
        thumb: entry.thumb,
        branchesUsed: [],
        isVictory: false,
        isTerminal: (childCount.get(entry.id) ?? 0) === 0,
        isPlanned: true,
    }));

    const edges: GraphEdge[] = parsed
        .filter((entry) => entry.parentId && byId.has(entry.parentId))
        .map((entry) => ({
            from: entry.parentId as string,
            to: entry.id,
            branch: null,
            label: entry.label,
            kind: "child" as GraphEdgeKind,
        }));

    const warnings = parsed
        .filter((entry) => entry.parentId && !byId.has(entry.parentId))
        .map((entry) => `node ${entry.id}: branches from ${entry.parentId}, which the plan never defines`);

    return { nodes, edges, orphans: [], source: "plan", warnings };
};

/* ------------------------------------------------------------------ *
 * Vertical layout
 * ------------------------------------------------------------------ */

/**
 * "vertical" puts depth on the Y axis and siblings on X; "horizontal" swaps them.
 *
 * Mobile takes vertical because depth is the unbounded axis — the editor allows
 * 7 levels — and vertical scroll is the one gesture that is free on a phone, so
 * a pan surface never competes with the interaction's own gesture handling.
 * Desktop has width to spare and reads a left-to-right flow more naturally.
 */
export type GraphOrientation = "vertical" | "horizontal";

export interface LayoutOptions {
    nodeSize?: number;
    /** Between siblings. */
    crossGap?: number;
    /** Between depth levels. */
    mainGap?: number;
    padding?: number;
    orientation?: GraphOrientation;
}

export interface LayoutNode extends GraphNode {
    x: number;
    y: number;
}

export interface LayoutOrphan extends OrphanNode {
    x: number;
    y: number;
}

export interface GraphLayout {
    nodes: LayoutNode[];
    edges: GraphEdge[];
    /** Tray below the tree, bottom-left. Laid out in rows, never in the flow. */
    orphans: LayoutOrphan[];
    /** Top of the tray, so the renderer can draw a divider and a caption. */
    trayY: number;
    width: number;
    height: number;
    warnings: string[];
}

const DEFAULTS: Required<LayoutOptions> = {
    nodeSize: 72,
    crossGap: 24,
    mainGap: 108,
    padding: 32,
    orientation: "vertical",
};

/**
 * Places every node on two axes: depth along the main axis, siblings across it.
 *
 * Only OCCUPIED siblings are packed. Reserving a slot per branch would multiply
 * the cross axis by four per level and force a pan surface on the very device
 * that can least afford one.
 */
export const layoutGraph = (
    graph: InteractionGraph,
    options: LayoutOptions = {}
): GraphLayout => {
    const { nodeSize, crossGap, mainGap, padding, orientation } = {
        ...DEFAULTS,
        ...options,
    };
    const step = nodeSize + crossGap;
    const horizontal = orientation === "horizontal";

    const byId = new Map(graph.nodes.map((node) => [node.id, node]));
    // Loop edges are cross-links, not structure — following them would make the
    // layout non-terminating for a link back to root.
    const structural = graph.edges.filter((edge) => edge.kind !== "loop");
    const childIds = new Map<string, string[]>();
    const hasParent = new Set<string>();

    structural.forEach((edge) => {
        if (!byId.has(edge.from) || !byId.has(edge.to)) return;
        const list = childIds.get(edge.from) ?? [];
        list.push(edge.to);
        childIds.set(edge.from, list);
        hasParent.add(edge.to);
    });

    const roots = graph.nodes.filter((node) => !hasParent.has(node.id));
    const x = new Map<string, number>();
    const placed = new Set<string>();
    let cursor = 0;

    const assign = (id: string): number => {
        if (placed.has(id)) return x.get(id) ?? 0;
        placed.add(id);

        const children = (childIds.get(id) ?? []).filter((child) => !placed.has(child));
        if (children.length === 0) {
            const own = cursor;
            cursor += step;
            x.set(id, own);
            return own;
        }

        const positions = children.map(assign);
        // Centre the parent over the span its children actually occupy.
        const centre = (positions[0] + positions[positions.length - 1]) / 2;
        x.set(id, centre);
        return centre;
    };

    roots.forEach((root) => assign(root.id));
    // Anything unreachable from a root still gets drawn rather than vanishing.
    graph.nodes.forEach((node) => assign(node.id));

    const nodes: LayoutNode[] = graph.nodes.map((node) => {
        const cross = padding + (x.get(node.id) ?? 0);
        const main = padding + node.depth * mainGap;
        return horizontal
            ? { ...node, x: main, y: cross }
            : { ...node, x: cross, y: main };
    });

    const treeMaxX = nodes.reduce((acc, node) => Math.max(acc, node.x), 0);
    const treeMaxY = nodes.reduce((acc, node) => Math.max(acc, node.y), 0);

    // Unlinked media sits in its own band under the tree in both orientations,
    // starting at the left edge, so it reads as a holding area rather than part
    // of the structure.
    const perRow = Math.max(1, Math.floor((treeMaxX + nodeSize) / step) || 1);
    const trayY = nodes.length > 0 ? treeMaxY + nodeSize + mainGap : padding;

    const orphans: LayoutOrphan[] = graph.orphans.map((orphan, i) => ({
        ...orphan,
        x: padding + (i % perRow) * step,
        y: trayY + Math.floor(i / perRow) * (nodeSize + mainGap / 2),
    }));

    const maxX = orphans.reduce((acc, o) => Math.max(acc, o.x), treeMaxX);
    const maxY = orphans.reduce((acc, o) => Math.max(acc, o.y), treeMaxY);

    return {
        nodes,
        edges: graph.edges,
        orphans,
        trayY,
        width: maxX + nodeSize + padding,
        height: maxY + nodeSize + padding,
        warnings: graph.warnings,
    };
};
