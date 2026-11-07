import {
    BRANCH_IDS,
    BRANCH_INDEX,
    BranchId,
    DRAG_PATH_IDS,
    Hotspot,
    InteractionNode,
    LANE_IDS,
    LANE_PATH,
    LaneId,
    PathId,
} from "./TouchInteractionModel";

/**
 * Node discovery / destination resolution for Touch loop hotspots.
 *
 * Kept out of the two large UI components on purpose. Nothing in here ever
 * reads `loopTargetNodeId` while walking the tree — following loop links during
 * traversal would make a link back to root non-terminating.
 */

/**
 * Adding the two drag segments here is what gives Drag & Hold full support in
 * collectInteractionNodes, createNodeIndex, buildStackForPath and every
 * consumer of them — the node picker, the node map, loop targeting and ENTER —
 * without any of those learning what a lane is.
 */
const NAV_ORDER: PathId[] = [...BRANCH_IDS, "autoPlay", ...DRAG_PATH_IDS];

const SEGMENT_LABEL: Record<PathId, string> = {
    left: "Left",
    right: "Right",
    top: "Top",
    bottom: "Bottom",
    autoPlay: "Auto",
    dragLeft: "Drag Left",
    dragRight: "Drag Right",
};

/**
 * Whether the real tree connection from a parent to one of its children is
 * currently active.
 *
 * This deliberately reads the same source that activates each editor control:
 * hotspot children use the parent's selected sub, autoplay uses autoPlaySrc,
 * and a drag lane uses its action child's mainSrc. Retained child objects do
 * not activate themselves after that source has been removed.
 */
export const isActiveChildConnection = (
    parent: InteractionNode,
    segment: PathId
): boolean => {
    const child = parent.children?.[segment];
    if (!child) return false;

    if (segment === "autoPlay") return Boolean(parent.autoPlaySrc);
    if ((DRAG_PATH_IDS as PathId[]).includes(segment)) {
        return Boolean(child.mainSrc);
    }

    return Boolean(parent.subs?.[BRANCH_INDEX[segment as BranchId]]);
};

export interface CollectedNode {
    id: string;
    node: InteractionNode;
    path: PathId[];
    label: string;
    mainSrc: string;
    depth: number;
}

export interface NodeIndexEntry {
    node: InteractionNode;
    path: PathId[];
    label: string;
}

export type NodeIndex = Map<string, NodeIndexEntry>;

/** A node that should behave as a hold scene, and the control that leads to it. */
export interface HoldEntry {
    sourceNodeId: string;
    branch: BranchId;
    controller: {
        id: BranchId;
        x: number;
        y: number;
        r: number;
        customText?: string;
    };
}

export const pathLabel = (path: PathId[]): string =>
    path.length === 0
        ? "Root"
        : ["Root", ...path.map((segment) => SEGMENT_LABEL[segment])].join(" → ");

/**
 * Walks the REAL, currently active children tree only. Returns every reachable
 * authored node once, in depth-first order, with its canonical path and a
 * human-readable label. Retained work below an inactive connection is left in
 * the data but is not exposed as a live node.
 */
export const collectInteractionNodes = (
    root?: InteractionNode | null
): CollectedNode[] => {
    const collected: CollectedNode[] = [];
    if (!root) return collected;

    // Guards against a shared object reference appearing twice in the tree.
    const seen = new Set<InteractionNode>();

    const walk = (node: InteractionNode, path: PathId[]) => {
        if (!node || seen.has(node)) return;
        seen.add(node);

        collected.push({
            id: node.id,
            node,
            path: [...path],
            label: pathLabel(path),
            mainSrc: node.mainSrc || "",
            depth: path.length,
        });

        NAV_ORDER.forEach((segment) => {
            const child = node.children?.[segment];
            // Because walk can only be reached through an active parent, this
            // one check dynamically validates the complete history from Root.
            // If any connection is off, this child and its entire subtree stop
            // here while their authored data remains available for restoration.
            if (child && isActiveChildConnection(node, segment)) {
                walk(child, [...path, segment]);
            }
        });
    };

    walk(root, []);
    return collected;
};

/**
 * nodeId -> { node, path, label }.
 *
 * Never overwrites an existing entry. Duplicate IDs are dropped and reported
 * rather than silently winning, because a duplicate would make a loop resolve
 * to the wrong destination.
 */
export const createNodeIndex = (root?: InteractionNode | null): NodeIndex => {
    const index: NodeIndex = new Map();
    const duplicates: string[] = [];

    collectInteractionNodes(root).forEach((entry) => {
        if (!entry.id) return;
        if (index.has(entry.id)) {
            duplicates.push(entry.id);
            return;
        }
        index.set(entry.id, {
            node: entry.node,
            path: entry.path,
            label: entry.label,
        });
    });

    if (duplicates.length) {
        console.warn(
            "[TouchNav] Duplicate node IDs found — loop targets for these are ambiguous and the first occurrence wins:",
            Array.from(new Set(duplicates))
        );
    }

    return index;
};

/**
 * Canonical path -> the exact nodeStack shape Touch preview uses.
 * Root is NOT included in the stack, so a root target yields [].
 */
export const buildStackForPath = (
    root: InteractionNode | null | undefined,
    path: PathId[]
): InteractionNode[] => {
    const stack: InteractionNode[] = [];
    let pointer = root;

    for (const segment of path) {
        const child = pointer?.children?.[segment];
        if (!child) return stack; // best effort; caller treats short stacks as valid
        stack.push(child);
        pointer = child;
    }

    return stack;
};

export type LoopResolution =
    | { status: "none" }
    | { status: "missing"; targetId: string }
    | {
          status: "ok";
          targetId: string;
          node: InteractionNode;
          path: PathId[];
          label: string;
          stack: InteractionNode[];
          isSelf: boolean;
      };

/**
 * Resolves a hotspot's loop link. A stale link returns "missing" so the caller
 * can fall back to the hotspot's retained ordinary media instead of throwing.
 */
export const resolveLoopTarget = (
    root: InteractionNode | null | undefined,
    index: NodeIndex,
    hotspot: Hotspot | null | undefined,
    currentNodeId?: string
): LoopResolution => {
    const targetId = hotspot?.loopTargetNodeId;
    if (!targetId) return { status: "none" };

    const entry = index.get(targetId);
    if (!entry) return { status: "missing", targetId };

    return {
        status: "ok",
        targetId,
        node: entry.node,
        path: entry.path,
        label: entry.label,
        stack: buildStackForPath(root, entry.path),
        isSelf: Boolean(currentNodeId) && entry.node.id === currentNodeId,
    };
};

/** True when the hotspot has a link that actually resolves. */
export const hasValidLoopTarget = (
    index: NodeIndex,
    hotspot: Hotspot | null | undefined
): boolean => Boolean(hotspot?.loopTargetNodeId && index.has(hotspot.loopTargetNodeId));

/**
 * Where a branch goes when activated. Tap and Hold to Play must both resolve
 * through this, or their route precedence can silently drift apart.
 *
 * The resolver decides WHERE a hotspot goes; holdToPlay decides HOW playback is
 * controlled once it gets there.
 */
export type BranchDestination =
    | { kind: "loop"; entry: NodeIndexEntry }
    | { kind: "child"; node: InteractionNode }
    | { kind: "sub"; src: string }
    | { kind: "none" };

export const resolveBranchDestination = (
    index: NodeIndex,
    node: InteractionNode | null | undefined,
    branch: BranchId
): BranchDestination => {
    if (!node) return { kind: "none" };

    // 1. A resolvable loop link wins over the ordinary media, which is retained
    //    rather than deleted so removing the link restores previous behaviour.
    const targetId = node.hotspots?.[BRANCH_INDEX[branch]]?.loopTargetNodeId;
    if (targetId) {
        const entry = index.get(targetId);
        if (entry) return { kind: "loop", entry };
        // 2-3. Stale link falls through to ordinary behaviour rather than
        //      dead-ending the viewer.
    }

    const src = node.subs?.[BRANCH_INDEX[branch]];
    const child = node.children?.[branch];
    // The selected sub is the existing activation source for this hotspot.
    // A retained child object alone must not keep the route alive after that
    // selection is removed.
    if (child && src) return { kind: "child", node: child };

    if (src) return { kind: "sub", src };

    return { kind: "none" };
};

/** Per-branch map of resolvable loop destinations for a node. */
export const loopTargetsForNode = (
    index: NodeIndex,
    hotspots: InteractionNode["hotspots"] | null | undefined
): Record<BranchId, InteractionNode | null> => {
    const map = {} as Record<BranchId, InteractionNode | null>;
    BRANCH_IDS.forEach((branch) => {
        const targetId = hotspots?.[BRANCH_INDEX[branch]]?.loopTargetNodeId;
        map[branch] = targetId ? index.get(targetId)?.node ?? null : null;
    });
    return map;
};

/* ------------------------------------------------------------------ *
 * Drag & Hold
 * ------------------------------------------------------------------ */

export type LaneDestination =
    | { kind: "lane"; node: InteractionNode }
    /** No action clip authored. The caller loops back to the drag node. */
    | { kind: "fallback" };

/**
 * Where a Drag & Hold lane goes.
 *
 * A deliberate SIBLING of resolveBranchDestination rather than a widening of
 * it. Lanes are not branches: they have no sub video, no loop link of their
 * own and no hotspot, so folding them in would add cases to the four-branch
 * precedence that can never fire there — and that precedence is shared by tap
 * and hold, where drift is expensive.
 *
 * There is no "none" outcome. An unconfigured lane is not dead, it returns the
 * viewer to the drag node, which is what makes a Drag & Hold node incapable of
 * dead-ending under any authoring at all.
 */
export const resolveLaneDestination = (
    node: InteractionNode | null | undefined,
    lane: LaneId
): LaneDestination => {
    const action = node?.children?.[LANE_PATH[lane]];
    return action?.mainSrc ? { kind: "lane", node: action } : { kind: "fallback" };
};

/** A node that is the destination of a drag lane, and where that lane came from. */
export interface DragEntry {
    parentNodeId: string;
    lane: LaneId;
}

/**
 * Which nodes are action clips, and which lane leads into each.
 *
 * Same problem as buildHoldEntryMap and the same answer. A lane's action clip
 * only means something when you arrive by dragging into it; reaching it any
 * other way — Back from its payoff, Home, a history link pointing at it —
 * would otherwise leave the player holding nothing, waiting for a finger that
 * was never on the control.
 *
 * Derived from the tree rather than recorded at runtime, so it is identical for
 * every viewer, correct on the FIRST arrival however they got there, and
 * unaffected by reloads. A node found here is entered already committed and
 * plays hands-free into its payoff.
 */
export const buildDragEntryMap = (
    root: InteractionNode | null | undefined
): Map<string, DragEntry> => {
    const entries = new Map<string, DragEntry>();
    if (!root) return entries;

    collectInteractionNodes(root).forEach((source) => {
        // Lane-derived, matching the player: an authored lane is a lane whether
        // or not the creator left the editor's Joystick panel open.
        LANE_IDS.forEach((lane) => {
            const action = source.node.children?.[LANE_PATH[lane]];
            if (!action?.mainSrc) return;
            // First in tree order wins, matching buildHoldEntryMap. Two drag
            // nodes can point at the same action node only through hand-edited
            // data, but the choice still has to be deterministic.
            if (entries.has(action.id)) return;
            entries.set(action.id, { parentNodeId: source.node.id, lane });
        });
    });

    return entries;
};

/**
 * Which nodes are "hold scenes", and where their control sits.
 *
 * Hold to Play is authored on a hotspot, so by default a scene only behaves as a
 * hold when you arrive by pressing that hotspot. Reaching it any other way — Back,
 * Home, a loop, an auto-loop — plays it normally, which breaks the illusion for a
 * scene whose whole point is that the viewer drives it.
 *
 * This derives the answer from the tree instead of recording it at runtime: for
 * every node, find a hold hotspot that routes into it and keep that hotspot's
 * geometry. The control the viewer sees on re-entry is therefore the very control
 * that leads there, in the same place, with the same label.
 *
 * Derived rather than remembered so it is identical for every viewer, correct on
 * the FIRST arrival however they got there, and unaffected by reloads.
 *
 * Only child and loop destinations produce an entry. A terminal sub plays in place
 * and is not a node you can navigate back into.
 */
export const buildHoldEntryMap = (
    root: InteractionNode | null | undefined
): Map<string, HoldEntry> => {
    const entries = new Map<string, HoldEntry>();
    if (!root) return entries;

    const index = createNodeIndex(root);

    collectInteractionNodes(root).forEach((source) => {
        BRANCH_IDS.forEach((branch) => {
            const hotspot = source.node.hotspots?.[BRANCH_INDEX[branch]];
            if (!hotspot || hotspot.holdToPlay !== true) return;

            const destination = resolveBranchDestination(index, source.node, branch);
            const targetId =
                destination.kind === "loop" ? destination.entry.node.id
                    : destination.kind === "child" ? destination.node.id
                        : null;
            if (!targetId) return;

            // NOTE: a Drag & Hold capture node IS allowed to be a hold scene.
            //
            // This once skipped them, on the theory that a hold and a Stick
            // would fight over the same finger. They cannot: Hold to Play is a
            // property of a HOTSPOT and always routes elsewhere, and the Stick
            // only appears once a video has ENDED. So they are layers in time —
            // hold to get through the scene, then drag to decide what happens
            // next — and never share the screen.

            // First in tree order wins. Two hold hotspots can point at one node and
            // they sit in different places on screen, so one has to be chosen — this
            // keeps the choice deterministic rather than dependent on the route taken.
            if (entries.has(targetId)) return;

            entries.set(targetId, {
                sourceNodeId: source.node.id,
                branch,
                controller: {
                    id: hotspot.id,
                    x: hotspot.x,
                    y: hotspot.y,
                    r: hotspot.r,
                    customText: hotspot.customText,
                },
            });
        });
    });

    return entries;
};
