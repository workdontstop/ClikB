import React, { useMemo } from "react";
import CloseIcon from "@mui/icons-material/Close";
import { useSelector } from "react-redux";

import { InteractionNode, BRANCH_IDS, BranchId } from "./TouchInteractionModel";
import { RootState } from "./store";
import { matchMobile } from "./DetectDevice";
import {
    GraphEdge,
    InteractionGraph,
    LayoutNode,
    LayoutOrphan,
    MediaSlot,
    compileOrphans,
    compileTreeGraph,
    hasAuthoredStructure,
    layoutGraph,
} from "./interactionGraph";

/**
 * The interaction node map.
 *
 * Purely a view. It never writes to the tree, never plays media and never calls
 * play() on anything — hotspot geometry and count are the creator's decisions,
 * and the AI's structure is a suggestion they are free to ignore.
 *
 * Which structure it draws follows one rule: user data overwrites default data.
 * The moment a single branch is wired, the live tree is the map and the plan is
 * demoted to captions on the unlinked tray. Before that, the plan is the map.
 *
 * Videos are mounted but never played. preload="metadata" fetches headers and a
 * first frame rather than the file, which is the thumbnail without a second
 * asset to manage.
 */

/**
 * Vertical on mobile, horizontal on desktop.
 *
 * Depth is the unbounded axis, so it goes on whichever scroll direction the
 * device gives away for free: down on a phone, across on a machine with a
 * trackpad and width to spare.
 */
const SCROLL_CLASS = "clik-node-map-scroll";

/**
 * Thin transparent-track scrollbars. Inline styles cannot express pseudo
 * elements, so this rides along inside the overlay and is scoped to one class.
 */
const SCROLL_CSS = `
.${SCROLL_CLASS} {
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.28) transparent;
}
.${SCROLL_CLASS}::-webkit-scrollbar { width: 10px; height: 10px; }
.${SCROLL_CLASS}::-webkit-scrollbar-track { background: transparent; }
.${SCROLL_CLASS}::-webkit-scrollbar-corner { background: transparent; }
.${SCROLL_CLASS}::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.22);
  background-clip: content-box;
  border: 3px solid transparent;
  border-radius: 999px;
}
.${SCROLL_CLASS}::-webkit-scrollbar-thumb:hover {
  background: rgba(255,255,255,0.42);
  background-clip: content-box;
}
`;

const HORIZONTAL = !matchMobile;
/**
 * Bigger circles, and the gaps raised with them.
 *
 * layoutGraph packs siblings by nodeSize + crossGap and levels by mainGap, so
 * growing the node alone would collide them — every one of these has to move
 * together.
 */
const NODE = matchMobile ? 92 : 148;
const CROSS_GAP = matchMobile ? 30 : 56;
const MAIN_GAP = matchMobile ? 132 : 216;
const PAD = matchMobile ? 32 : 48;

const WHITE = "#ffffff";
const DIM = "rgba(255,255,255,0.45)";
const VICTORY = "#34C759";

/** Heavier lines to match the larger circles — a map, not a wiring diagram. */
const EDGE_WIDTH = matchMobile ? 3 : 4;

/**
 * One glyph per route kind, so the map says HOW a route is taken and not only
 * that it exists. The graph already carries `kind` — this is purely rendering.
 */
const EDGE_GLYPH: Record<GraphEdge["kind"], string> = {
    child: "",       // an ordinary tap needs no explanation
    sub: "",
    loop: "↺",       // history — travels back into the tree
    auto: "▸",       // fires on its own when the scene ends
    drag: "⇆",       // Drag & Hold lane
};

export interface InteractionNodeMapProps {
    open: boolean;
    onClose: () => void;
    /** Live tree. Absent in Storybook, where nothing has been authored yet. */
    treeRoot?: InteractionNode | null;
    /** The planner's graph, as stored by Storybook. */
    planGraph?: InteractionGraph | null;
    /** Generated video slots, for the unlinked tray. */
    slots?: MediaSlot[];
    /** A circle was tapped. Storybook opens that scene; the editor may ignore it. */
    onSelectNode?: (nodeId: string, sceneIndex?: number) => void;
    title?: string;
}

/** Leaves the parent on the depth axis and enters the child on the same axis. */
const edgePath = (from: LayoutNode, to: LayoutNode): string => {
    if (HORIZONTAL) {
        const x1 = from.x + NODE;
        const y1 = from.y + NODE / 2;
        const x2 = to.x;
        const y2 = to.y + NODE / 2;
        const mid = (x1 + x2) / 2;
        return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
    }
    const x1 = from.x + NODE / 2;
    const y1 = from.y + NODE;
    const x2 = to.x + NODE / 2;
    const y2 = to.y;
    const mid = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
};

/** Loop links bulge out on the cross axis, so they never trace a branch. */
const loopPath = (from: LayoutNode, to: LayoutNode): string => {
    if (HORIZONTAL) {
        const x1 = from.x + NODE / 2;
        const y1 = from.y + NODE;
        const x2 = to.x + NODE / 2;
        const y2 = to.y + NODE;
        const bulge = Math.max(y1, y2) + 56;
        return `M ${x1} ${y1} C ${x1} ${bulge}, ${x2} ${bulge}, ${x2} ${y2}`;
    }
    const x1 = from.x + NODE;
    const y1 = from.y + NODE / 2;
    const x2 = to.x + NODE;
    const y2 = to.y + NODE / 2;
    const bulge = Math.max(x1, x2) + 56;
    return `M ${x1} ${y1} C ${bulge} ${y1}, ${bulge} ${y2}, ${x2} ${y2}`;
};

const Thumb: React.FC<{ node: LayoutNode | LayoutOrphan }> = ({ node }) => {
    if (!node.thumb) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: DIM,
                    fontSize: 11,
                }}
            >
                no media
            </div>
        );
    }

    if (node.thumb.kind === "image") {
        return (
            <img
                src={node.thumb.url}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
        );
    }

    return (
        <video
            src={node.thumb.url}
            // Never played. Metadata is enough for a first frame and avoids
            // pulling whole files for every node on a phone.
            preload="metadata"
            muted
            playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
    );
};

const CompassDots: React.FC<{ used: BranchId[] }> = ({ used }) => {
    const at: Record<BranchId, React.CSSProperties> = {
        top: { top: -5, left: NODE / 2 - 4 },
        bottom: { bottom: -5, left: NODE / 2 - 4 },
        left: { left: -5, top: NODE / 2 - 4 },
        right: { right: -5, top: NODE / 2 - 4 },
    };

    return (
        <>
            {BRANCH_IDS.map((branch) => (
                <span
                    key={branch}
                    style={{
                        position: "absolute",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        border: `1.5px solid ${WHITE}`,
                        background: used.includes(branch) ? WHITE : "transparent",
                        ...at[branch],
                    }}
                />
            ))}
        </>
    );
};

const Circle: React.FC<{
    node: LayoutNode | LayoutOrphan;
    onSelect?: () => void;
    /**
     * Only dim a planned node when a live tree is on screen to contrast it
     * against. When the plan IS the structure — Storybook, or an interaction
     * nothing has been wired in yet — every node is planned, so ghosting them
     * all just makes the whole map look faded.
     */
    ghosted?: boolean;
    /** Resolved app colour, passed down so the circle need not read Redux. */
    appColor?: string;
    /** The AI plan is the structure, so every node is one colour. */
    planIsStructure?: boolean;
}> = ({ node, onSelect, ghosted = false, appColor = WHITE, planIsStructure = false }) => {
    // A capture node wears the app colour, because the Stick is the thing you
    // cannot see from a thumbnail. Victory still wins — it is the rarer signal.
    //
    // In the AI map every node is app-coloured: there is nothing to distinguish
    // yet, and one flat colour is the honest way to say so.
    const border = node.isVictory
        ? VICTORY
        : ghosted
            ? DIM
            : (node.isDrag || planIsStructure)
                ? appColor
                : WHITE;

    return (
        <div
            style={{
                position: "absolute",
                left: node.x,
                top: node.y,
                width: NODE,
                height: NODE,
            }}
        >
            <div
                onClick={onSelect}
                role={onSelect ? "button" : undefined}
                aria-label={onSelect ? `Open ${node.label}` : undefined}
                style={{
                    width: NODE,
                    height: NODE,
                    borderRadius: "50%",
                    overflow: "hidden",
                    background: "rgba(0,0,0,0.45)",
                    // Unbuilt nodes are marked by a dashed rim only. Fading the
                    // media too made every circle hard to read, and the point of
                    // the map is recognising which scene is which.
                    border: `${node.isDrag ? 4 : 3}px ${ghosted ? "dashed" : "solid"} ${border}`,
                    boxShadow: node.isDrag
                        ? `0 6px 18px rgba(0,0,0,0.5), 0 0 0 3px ${border}33`
                        : "0 6px 18px rgba(0,0,0,0.5)",
                    cursor: onSelect ? "pointer" : "default",
                }}
            >
                <Thumb node={node} />
            </div>

            {/* A scene with a Stick reads no differently from any other in a
                thumbnail, so it is badged. */}
            {node.isDrag && (
                <div
                    style={{
                        position: "absolute",
                        top: -6,
                        left: -6,
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: border,
                        color: "#000",
                        fontSize: 14,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.6)",
                        pointerEvents: "none",
                    }}
                >
                    ⇆
                </div>
            )}

            <CompassDots used={node.branchesUsed} />

            <div
                style={{
                    position: "absolute",
                    top: NODE + 8,
                    left: -NODE / 2,
                    width: NODE * 2,
                    textAlign: "center",
                    color: WHITE,
                    fontSize: 11,
                    lineHeight: 1.3,
                    textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                    pointerEvents: "none",
                }}
            >
                {node.label}
            </div>
        </div>
    );
};

const InteractionNodeMap: React.FC<InteractionNodeMapProps> = ({
    open,
    onClose,
    treeRoot,
    planGraph,
    slots = [],
    onSelectNode,
    title = "Interaction map",
}) => {
    // The map is the one place the whole interaction is visible at once, so it
    // wears the app's colour rather than generic white.
    const darkMode = useSelector((state: RootState) => state.settings.darkMode);
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const APP = darkMode ? appColorDark : appColorLight;

    const { layout, planIsStructure } = useMemo(() => {
        // Recompiled on every render of the open map, so a hotspot placed in the
        // editor is reflected the next time React renders — no syncing, no cache.
        const tree = compileTreeGraph(treeRoot ?? null);
        const authored = hasAuthoredStructure(tree) || !planGraph;

        // While the plan is the structure, every A-shot is already on screen as
        // its own scene node — an A-shot is linked by definition at that point.
        // Only B-shots are support footage with nowhere else to appear, so they
        // are the whole tray until the creator wires something. Once a tree
        // exists it governs, and anything it does not use is genuinely unlinked.
        const trayFrom = authored ? slots : slots.filter((slot) => slot.type === "B");
        const orphans = compileOrphans(treeRoot ?? null, trayFrom);

        const structure = authored
            ? { ...tree, orphans }
            : { ...planGraph, orphans };

        return {
            planIsStructure: !authored,
            layout: layoutGraph(structure, {
                nodeSize: NODE,
                crossGap: CROSS_GAP,
                mainGap: MAIN_GAP,
                padding: PAD,
                orientation: HORIZONTAL ? "horizontal" : "vertical",
            }),
        };
    }, [treeRoot, planGraph, slots]);

    if (!open) return null;

    const byId = new Map(layout.nodes.map((node) => [node.id, node]));
    const drawable = layout.edges.filter(
        (edge: GraphEdge) => byId.has(edge.from) && byId.has(edge.to)
    );

    return (
        <div
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                background: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(8px)",
                display: "flex",
                flexDirection: "column",
            }}
        >
            <style>{SCROLL_CSS}</style>

            <div
                style={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 16px 8px 16px",
                    color: WHITE,
                }}
            >
                <span style={{ fontSize: 14, fontWeight: 600 }}>{title}</span>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                    }}
                    aria-label="Close map"
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        border: "2px solid rgba(255,255,255,0.9)",
                        background: "rgba(0,0,0,0.35)",
                        color: WHITE,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                    }}
                >
                    <CloseIcon style={{ fontSize: 22 }} />
                </button>
            </div>

            <div
                className={SCROLL_CLASS}
                onClick={(e) => e.stopPropagation()}
                style={{
                    // Both axes on both platforms. Orientation decides which one
                    // usually overflows, but a wide tree on a phone or a deep one
                    // on a laptop must still be reachable rather than clipped.
                    flex: 1,
                    minHeight: 0,
                    overflow: "auto",
                    WebkitOverflowScrolling: "touch",
                    touchAction: "pan-x pan-y",
                    overscrollBehavior: "contain",
                }}
            >
                <div
                    style={{
                        position: "relative",
                        // True content size, stretched to fill when it is smaller
                        // than the viewport so the map stays centred-feeling
                        // rather than hugging the corner.
                        width: layout.width,
                        minWidth: "100%",
                        height: layout.height,
                        minHeight: "100%",
                        // Labels sit below each circle and the last row needs room
                        // for them, or the bottom caption is cut off mid-scroll.
                        paddingBottom: 32,
                        paddingRight: 32,
                        boxSizing: "content-box",
                    }}
                >
                    <svg
                        width={layout.width}
                        height={layout.height}
                        style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
                    >
                        {drawable.map((edge, i) => {
                            const from = byId.get(edge.from) as LayoutNode;
                            const to = byId.get(edge.to) as LayoutNode;
                            const isLoop = edge.kind === "loop";
                            const d = isLoop ? loopPath(from, to) : edgePath(from, to);
                            const glyph = EDGE_GLYPH[edge.kind];

                            // Each mechanism reads differently at a glance:
                            // history dashed and receding, drag and auto in app
                            // colour because they are the two the creator most
                            // often forgets are there.
                            // The AI plan emits every edge as "child", so it
                            // comes out one flat app colour — correct, because
                            // in a plan every route genuinely IS the same kind.
                            // The manual map varies by mechanism because its
                            // routes actually differ.
                            const stroke =
                                planIsStructure
                                    ? APP
                                    : edge.kind === "drag" || edge.kind === "auto"
                                        ? APP
                                        : isLoop
                                            ? DIM
                                            : "rgba(255,255,255,0.75)";

                            return (
                                <g key={`${edge.from}-${edge.to}-${i}`}>
                                    <path
                                        d={d}
                                        fill="none"
                                        stroke={stroke}
                                        strokeWidth={EDGE_WIDTH}
                                        strokeLinecap="round"
                                        strokeDasharray={isLoop ? "7 7" : undefined}
                                    />
                                    {glyph && (
                                        <text
                                            // Placed at the midpoint of the two
                                            // endpoints rather than along the
                                            // curve — close enough to read as
                                            // belonging to the line, and it
                                            // needs no path measurement.
                                            x={(from.x + to.x) / 2 + NODE / 2}
                                            y={(from.y + to.y) / 2 + NODE / 2}
                                            fill={stroke}
                                            fontSize={matchMobile ? 15 : 19}
                                            fontWeight={700}
                                            textAnchor="middle"
                                            dominantBaseline="middle"
                                            style={{ paintOrder: "stroke" }}
                                            stroke="rgba(0,0,0,0.75)"
                                            strokeWidth={3}
                                        >
                                            {glyph}
                                        </text>
                                    )}
                                </g>
                            );
                        })}
                    </svg>

                    {layout.nodes.map((node) => (
                        <Circle
                            key={node.id}
                            node={node}
                            ghosted={node.isPlanned && !planIsStructure}
                            appColor={APP}
                            planIsStructure={planIsStructure}
                            onSelect={
                                onSelectNode ? () => onSelectNode(node.id) : undefined
                            }
                        />
                    ))}

                    {layout.orphans.length > 0 && (
                        <>
                            <div
                                style={{
                                    position: "absolute",
                                    left: PAD,
                                    top: layout.trayY - 28,
                                    color: DIM,
                                    fontSize: 11,
                                    letterSpacing: 0.4,
                                }}
                            >
                                Not linked yet
                            </div>
                            {layout.orphans.map((orphan) => (
                                <Circle
                                    key={orphan.id}
                                    node={orphan}
                                    onSelect={
                                        onSelectNode
                                            ? () => onSelectNode(orphan.id, orphan.sceneIndex)
                                            : undefined
                                    }
                                />
                            ))}
                        </>
                    )}
                </div>
            </div>

            {layout.warnings.length > 0 && (
                <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        flexShrink: 0,
                        padding: "8px 16px 16px 16px",
                        color: DIM,
                        fontSize: 11,
                        lineHeight: 1.5,
                    }}
                >
                    {layout.warnings.slice(0, 3).map((warning) => (
                        <div key={warning}>{warning}</div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default InteractionNodeMap;
