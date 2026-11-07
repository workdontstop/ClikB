export const BRANCH_IDS = ["left", "right", "top", "bottom"] as const;

export type BranchId = (typeof BRANCH_IDS)[number];
export type BranchTuple<T> = [T, T, T, T];

export type SpatialControlMode = "stick" | "hold" | "tap";

export interface CameraTrajectory {
    motionType: "dolly" | "pan" | "truck" | "tilt" | "orbit" | "static";
    direction: "forward" | "backward" | "left" | "right" | "up" | "down";
    intensity: number;
    startCoord: [number, number, number];
    endCoord: [number, number, number];
}

export interface SpatialStageHotspot {
    id: string;
    screenCoord: [number, number];
    worldCoord: [number, number, number];
    actionType: "branch" | "payoff" | "loop";
    targetStageId: string;
}

export interface SpatialStageNode {
    id: string;
    stageIndex: number;
    videoUrl: string;
    durationSeconds: number;
    startFrameUrl: string;
    endFrameUrl: string;
    controlMode: SpatialControlMode;
    trajectory: CameraTrajectory;
    contextPrompt: string;
    nextStageId?: string;
    holdResetStageId?: string;
    hotspots: SpatialStageHotspot[];
}

/**
 * Drag & Hold lanes.
 *
 * A lane is NOT a branch. The names overlap with BranchId on purpose — the
 * viewer drags left or right — but they address a completely separate pair of
 * children and must never index into `subs` or `hotspots`. Keeping them in
 * their own type is what stops the four-branch router and the two-lane router
 * from being confused for one another.
 */
export const LANE_IDS = ["left", "right"] as const;
export type LaneId = (typeof LANE_IDS)[number];
export type DragPathId = "dragLeft" | "dragRight";

export const LANE_PATH: Record<LaneId, DragPathId> = {
    left: "dragLeft",
    right: "dragRight",
};

export const DRAG_PATH_IDS: DragPathId[] = ["dragLeft", "dragRight"];

export type PathId = BranchId | "autoPlay" | DragPathId;

export const BRANCH_INDEX: Record<BranchId, 0 | 1 | 2 | 3> = {
    left: 0,
    right: 1,
    top: 2,
    bottom: 3,
};

export interface Hotspot {
    id: BranchId;
    x: number;
    y: number;
    r: number;
    polygon?: [number, number][];
    boundingBox?: { w: number; h: number };
    svgPath?: string;
    maskWidth?: number;
    maskHeight?: number;
    customText?: string;
    isVictory?: boolean;
    /**
     * Loop link. Stores the ID of an existing node in the tree ONLY — never the
     * node object, which would create cycles that cannot be JSON.stringify'd.
     * When set and resolvable, this hotspot navigates to that node in preview
     * instead of using its ordinary child / sub-video. The ordinary media is
     * retained, not deleted, so removing the link restores previous behaviour.
     */
    loopTargetNodeId?: string;
    /**
     * Hold to Play. Off by default and configured per hotspot. Changes only HOW
     * this hotspot is activated — press and hold to advance its destination
     * video, release to pause — never WHERE it routes to.
     *
     * Deliberately absent from isBranchConfigured: a toggle with no media, child
     * or valid loop must not make an empty choice render.
     */
    holdToPlay?: boolean;
}

export interface InteractionNode {
    id: string;
    mainSrc: string;
    subs: BranchTuple<string>;
    hotspots: BranchTuple<Hotspot>;
    audio?: { main?: any[] } & Partial<Record<BranchId, any[]>>;
    autoPlaySrc?: string;
    autoPlayIsVictory?: boolean;
    /**
     * Auto-loop. Same destination-by-ID idea as Hotspot.loopTargetNodeId, but it
     * fires like autoPlay instead of needing a click: when this node's main video
     * ends the interaction navigates to that node. Mutually exclusive with
     * autoPlaySrc — the editor clears one when the other is set.
     */
    autoLoopTargetNodeId?: string;
    /**
     * Drag & Hold mode. Node-level, not per hotspot.
     *
     * When true this node presents a single Stick instead of its four hotspots.
     * The viewer drags it sideways; locking a lane pushes that lane's action
     * node IMMEDIATELY and the 2.5s hold is a probation period on a navigation
     * that has already happened.
     *
     * The four hotspots are retained and inert while this is on, exactly as a
     * loop link retains the media it overrides, so toggling the mode off
     * restores previous authoring rather than destroying it.
     *
     * A lane's two videos are two ordinary nodes:
     *   action clip = children.dragLeft.mainSrc
     *   payoff      = children.dragLeft.autoPlaySrc + .children.autoPlay
     * which is why ENTER, the node index, loop targeting and the node map all
     * work here with no code of their own.
     */
    dragHold?: boolean;
    children?: Partial<Record<PathId, InteractionNode>>;
}

export const DEFAULT_HOTSPOTS: BranchTuple<Hotspot> = [
    { id: "left", x: 0.25, y: 0.55, r: 0.15, holdToPlay: false },
    { id: "right", x: 0.75, y: 0.55, r: 0.15, holdToPlay: false },
    { id: "top", x: 0.5, y: 0.28, r: 0.15, holdToPlay: false },
    { id: "bottom", x: 0.5, y: 0.78, r: 0.15, holdToPlay: false },
];

export const createDefaultHotspots = (): BranchTuple<Hotspot> =>
    DEFAULT_HOTSPOTS.map((hotspot) => ({ ...hotspot })) as BranchTuple<Hotspot>;

export const normalizeSubs = (raw: unknown): BranchTuple<string> => {
    const values = Array.isArray(raw) ? raw : [];
    return BRANCH_IDS.map((_, index) =>
        typeof values[index] === "string" ? values[index] : ""
    ) as BranchTuple<string>;
};

export const normalizeHotspots = (raw: unknown): BranchTuple<Hotspot> => {
    const values = Array.isArray(raw) ? raw : [];
    const byId = new Map<BranchId, Partial<Hotspot>>();

    values.forEach((value, index) => {
        if (!value || typeof value !== "object") return;
        const candidate = value as Partial<Hotspot>;
        const fallbackId = BRANCH_IDS[index];
        const id = BRANCH_IDS.includes(candidate.id as BranchId)
            ? candidate.id as BranchId
            : fallbackId;
        if (id) byId.set(id, candidate);
    });

    return BRANCH_IDS.map((id) => {
        const fallback = DEFAULT_HOTSPOTS[BRANCH_INDEX[id]];
        const candidate = byId.get(id) || {};
        return {
            ...fallback,
            ...candidate,
            id,
            // Strict coercion, not truthiness — "false", 1 and malformed JSON must
            // not enable the feature, and a missing value must resolve to false.
            holdToPlay: (candidate as Partial<Hotspot>).holdToPlay === true,
        };
    }) as BranchTuple<Hotspot>;
};

const toAudioArray = (value: unknown): any[] => {
    const list = Array.isArray(value) ? value : value ? [value] : [];
    // Only real, non-empty URLs count as audio. A blank or malformed entry makes a
    // node look like it owns a separate track, which mutes its video to play
    // silence — so those are dropped here, on load, for already-saved trees too.
    return list.filter((entry) => typeof entry === "string" && entry.trim().length > 0);
};

export const normalizeInteractionNode = (
    raw: any,
    fallback: Partial<InteractionNode> = {}
): InteractionNode => {
    const source = raw && typeof raw === "object" ? raw : {};
    const fallbackAudio = fallback.audio || {};
    const sourceAudio = source.audio || {};
    const node: InteractionNode = {
        id: source.id ?? fallback.id ?? "root",
        mainSrc: source.mainSrc ?? fallback.mainSrc ?? "",
        subs: normalizeSubs(source.subs ?? fallback.subs),
        hotspots: normalizeHotspots(source.hotspots ?? fallback.hotspots),
        autoPlaySrc: source.autoPlaySrc || "",
        autoPlayIsVictory: Boolean(source.autoPlayIsVictory),
        autoLoopTargetNodeId: source.autoLoopTargetNodeId || undefined,
        // Strict coercion, exactly as holdToPlay. A mode that hides the entire
        // hotspot UI must not be switched on by "false", 1, or malformed JSON.
        dragHold: source.dragHold === true,
        audio: {
            main: toAudioArray(sourceAudio.main ?? fallbackAudio.main),
            left: toAudioArray(sourceAudio.left ?? fallbackAudio.left),
            right: toAudioArray(sourceAudio.right ?? fallbackAudio.right),
            top: toAudioArray(sourceAudio.top ?? fallbackAudio.top),
            bottom: toAudioArray(sourceAudio.bottom ?? fallbackAudio.bottom),
        },
        children: {},
    };

    const rawChildren = source.children || {};
    ([...BRANCH_IDS, "autoPlay", ...DRAG_PATH_IDS] as PathId[]).forEach((pathId) => {
        if (rawChildren[pathId]) {
            // ✅ Path-derived fallback id. Previously this passed no fallback, so any
            // child arriving without an id became a SECOND node called "root".
            // Harmless while navigation followed nested objects, fatal now that IDs
            // are loop destinations resolved through an index.
            node.children![pathId] = normalizeInteractionNode(rawChildren[pathId], {
                id: `${node.id}-${pathId}`,
            });
        }
    });

    if (node.autoPlaySrc && !node.children!.autoPlay) {
        node.children!.autoPlay = {
            id: `${node.id}-autoPlay`,
            mainSrc: node.autoPlaySrc,
            subs: normalizeSubs([]),
            hotspots: createDefaultHotspots(),
            audio: {
                main: [],
                left: [],
                right: [],
                top: [],
                bottom: [],
            },
            children: {},
        };
    }

    return node;
};

/**
 * Whether a Drag & Hold lane has an action clip.
 *
 * Deliberately NOT folded into isBranchConfigured: drag mode is node-level and
 * the four branches are inert inside it, so teaching that function about lanes
 * would make empty hotspots render on a drag node.
 */
export const isLaneConfigured = (
    node: InteractionNode | null | undefined,
    lane: LaneId
): boolean => Boolean(node?.children?.[LANE_PATH[lane]]?.mainSrc);

/**
 * Whether this node presents a Stick to the viewer.
 *
 * Derived from the LANES, not from `dragHold`.
 *
 * `dragHold` is an editor concern only — it remembers which panel the creator
 * was last working in, so the Joystick button can toggle between authoring
 * hotspots and authoring lanes. It must never decide what the viewer sees:
 * turning the panel off to go and place a hotspot would otherwise silently
 * remove the DRAG circle from a node that still has both lanes authored.
 *
 * Authored media is the truth; UI state is not.
 */
export const isDragNode = (node: InteractionNode | null | undefined): boolean =>
    LANE_IDS.some((lane) => isLaneConfigured(node, lane));

/**
 * The payoff for a lane, if the creator authored one.
 *
 * The payoff IS the action node's autoPlay slot — that is why an action node
 * can hold neither its own autoplay nor hotspots, and why the seamless cut on
 * the exact end frame needs no new routing code.
 */
export const laneActionNode = (
    node: InteractionNode | null | undefined,
    lane: LaneId
): InteractionNode | null => node?.children?.[LANE_PATH[lane]] ?? null;

export const lanePayoffNode = (
    node: InteractionNode | null | undefined,
    lane: LaneId
): InteractionNode | null => laneActionNode(node, lane)?.children?.autoPlay ?? null;

export const isBranchConfigured = (node: InteractionNode, branch: BranchId): boolean => {
    const index = BRANCH_INDEX[branch];
    const hotspot = node.hotspots[index];
    const audio = node.audio?.[branch];
    const child = node.children?.[branch];

    return Boolean(
        node.subs[index] ||
        child?.mainSrc ||
        audio?.some(Boolean) ||
        hotspot?.svgPath ||
        hotspot?.polygon?.length ||
        hotspot?.customText ||
        hotspot?.isVictory ||
        hotspot?.loopTargetNodeId
    );
};
