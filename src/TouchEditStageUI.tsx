import React, { useCallback, useEffect, useRef, useState } from "react";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Button from "@mui/material/Button";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import GamepadIcon from "@mui/icons-material/Gamepad";
import {
    BRANCH_IDS,
    BRANCH_INDEX,
    BranchId,
    BranchTuple,
    DRAG_PATH_IDS,
    DragPathId,
    Hotspot,
    InteractionNode,
    LANE_IDS,
    LANE_PATH,
    LaneId,
    PathId,
    createDefaultHotspots,
    isBranchConfigured,
    isDragNode,
    laneActionNode,
    normalizeSubs,
} from "./TouchInteractionModel";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import { matchMobile } from "./DetectDevice";
import { Box, IconButton, CircularProgress, useTheme } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import axios from "axios";
import AddIcon from "@mui/icons-material/Add";
import RepeatIcon from "@mui/icons-material/Repeat";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import TouchAppIcon from "@mui/icons-material/TouchApp";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import { Saveprompthelperfordellater } from "./SavepromptHelpersLocal";
import {
    CollectedNode,
    collectInteractionNodes,
    createNodeIndex,
} from "./TouchInteractionNavigation";

// Constants matching your design
const SUB_MIN = "clamp(64px, 12vw, 100px)"; // Slightly bigger min size

function getDisplayedVideoRect(containerEl: HTMLElement, videoEl: HTMLVideoElement) {
    const rect = containerEl.getBoundingClientRect();
    const cw = rect.width;
    const ch = rect.height;
    const vw = videoEl.videoWidth || 0;
    const vh = videoEl.videoHeight || 0;
    if (!vw || !vh) return { dispW: cw, dispH: ch, offX: 0, offY: 0, cw, ch, vw, vh };
    const videoAR = vw / vh;
    const containerAR = cw / ch;
    let dispW, dispH, offX = 0, offY = 0;
    if (containerAR > videoAR) { dispH = ch; dispW = ch * videoAR; offX = (cw - dispW) / 2; }
    else { dispW = cw; dispH = cw / videoAR; offY = (ch - dispH) / 2; }
    return { dispW, dispH, offX, offY, cw, ch, vw, vh };
}

type HintPlacement = "top" | "bottom" | "left" | "right";

/**
 * Dark label pill for editor controls. Shows on hover with a mouse, and flashes
 * for ~1.6s on touch so mobile users get the same affordance without a hover
 * state. Purely presentational — never intercepts pointer events.
 */
const HintPill: React.FC<{
    label: string;
    placement?: HintPlacement;
    wrapperStyle?: React.CSSProperties;
    children: React.ReactNode;
}> = ({ label, placement = "bottom", wrapperStyle, children }) => {
    const [visible, setVisible] = useState(false);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearHide = () => {
        if (hideTimer.current) {
            clearTimeout(hideTimer.current);
            hideTimer.current = null;
        }
    };

    useEffect(() => clearHide, []);

    const positionStyle: React.CSSProperties =
        placement === "top"
            ? { bottom: "calc(100% + 9px)", left: "50%", transform: "translateX(-50%)" }
            : placement === "bottom"
                ? { top: "calc(100% + 9px)", left: "50%", transform: "translateX(-50%)" }
                : placement === "left"
                    ? { right: "calc(100% + 11px)", top: "50%", transform: "translateY(-50%)" }
                    : { left: "calc(100% + 11px)", top: "50%", transform: "translateY(-50%)" };

    return (
        <div
            style={{ position: "relative", display: "inline-flex", ...wrapperStyle }}
            onMouseEnter={() => { clearHide(); setVisible(true); }}
            onMouseLeave={() => { clearHide(); setVisible(false); }}
            onPointerDown={(event) => {
                if (event.pointerType === "mouse") return;
                clearHide();
                setVisible(true);
                hideTimer.current = setTimeout(() => setVisible(false), 1600);
            }}
        >
            {children}
            <div
                style={{
                    position: "absolute",
                    ...positionStyle,
                    padding: "6px 10px",
                    borderRadius: 9,
                    background: "rgba(10,10,12,0.92)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "rgba(255,255,255,0.94)",
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: "0.6px",
                    textTransform: "uppercase",
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    whiteSpace: "nowrap",
                    boxShadow: "0 8px 22px rgba(0,0,0,0.55)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    opacity: visible ? 1 : 0,
                    transition: "opacity 160ms ease",
                    pointerEvents: "none",
                    zIndex: 40,
                }}
            >
                {label}
            </div>
        </div>
    );
};

interface TouchEditStageProps {
    backToDefault: () => void;
    goToPreview: () => void;

    // Inputs
    videoArray: string[]; // The 0-9 uploaded videos

    // The Tree State (Managed by Parent InteractInput)
    treeRoot: InteractionNode;
    setTreeRoot: React.Dispatch<React.SetStateAction<InteractionNode>>;

    // Legacy Props (synced to root for compatibility)
    hotspots: BranchTuple<Hotspot>;
    setHotspots: React.Dispatch<React.SetStateAction<BranchTuple<Hotspot>>>;
    subs: BranchTuple<string>;

    // Audio props (Now supporting Arrays)
    sub1AudioUrl: any[] | any;
    sub2AudioUrl: any[] | any;
    // ✅ ADDED SETTERS to fix the bug
    topAudioUrl: any[] | any;
    bottomAudioUrl: any[] | any;
    setTopAudioUrl: any;
    setBottomAudioUrl: any;
    setSub1AudioUrl: any;
    setSub2AudioUrl: any;
    setAddVoice: any;
    setIdentifier: any;

    // 🛑 NEW PROP: Pass your loading state here (e.g. isGenerating={isLoading})
    isGenerating: boolean;
    intbg: number
}

/**
 * A child's media source as its PARENT stores it.
 *
 * Branches keep theirs in `subs`, autoPlay in `autoPlaySrc` — but a Drag & Hold
 * lane keeps its action clip on the child node itself, because a lane has no
 * slot in the four-wide tuples. Every path walk needs this distinction or it
 * indexes BRANCH_INDEX with "dragLeft" and reads undefined.
 */
const childSrcFromParent = (parent: InteractionNode, dir: PathId): string => {
    if (dir === "autoPlay") return parent.autoPlaySrc || "";
    if ((DRAG_PATH_IDS as PathId[]).includes(dir)) {
        return parent.children?.[dir as DragPathId]?.mainSrc || "";
    }
    return parent.subs?.[BRANCH_INDEX[dir as BranchId]] || "";
};

const TouchEditStageUI: React.FC<TouchEditStageProps> = ({
    backToDefault,
    goToPreview,
    videoArray,
    treeRoot,
    setTreeRoot,
    setHotspots, // Used to sync root changes back to parent state
    setAddVoice,
    setIdentifier,
    sub1AudioUrl,
    sub2AudioUrl,
    // ✅ DESTRUCTURED SETTERS
    setSub1AudioUrl,
    topAudioUrl,
    bottomAudioUrl,
    setSub2AudioUrl,
    // 🛑 NEW PROP
    isGenerating,
    intbg,
    setTopAudioUrl,
    setBottomAudioUrl,
}) => {
    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);
    
    // Dynamic Theme Colors
    const LEFT_COLOR = darkModeReducer ? "#E8BAFA" : "#0099cc";
    const LEFT_FILL = darkModeReducer ? "rgba(232, 186, 250, 0.28)" : "rgba(0, 153, 204, 0.28)";
    const RIGHT_COLOR = darkModeReducer ? "#b3eefc" : "#ff9933";
    const RIGHT_FILL = darkModeReducer ? "rgba(179, 238, 252, 0.28)" : "rgba(255, 153, 51, 0.28)";

    // Navigation Path: [] = root, ['left'] = left child, ['left', 'right'] = ...
    const [path, setPath] = useState<PathId[]>([]);

    const TOP_COLOR = darkModeReducer ? "#9ff5c8" : "#00a86b";
    const TOP_FILL = darkModeReducer ? "rgba(159, 245, 200, 0.28)" : "rgba(0, 168, 107, 0.28)";
    const BOTTOM_COLOR = darkModeReducer ? "#ffe08a" : "#d97706";
    const BOTTOM_FILL = darkModeReducer ? "rgba(255, 224, 138, 0.28)" : "rgba(217, 119, 6, 0.28)";
    const branchColors: Record<BranchId, string> = { left: LEFT_COLOR, right: RIGHT_COLOR, top: TOP_COLOR, bottom: BOTTOM_COLOR };
    const branchFills: Record<BranchId, string> = { left: LEFT_FILL, right: RIGHT_FILL, top: TOP_FILL, bottom: BOTTOM_FILL };

    // Drag State
    const [isDragging, setIsDragging] = useState(false);

    // 🔒 HOTSPOT POSITION LOCK — editor convenience, session only.
    //
    // This stores the AXIS, not a boolean. Clicking a padlock records that
    // hotspot's coordinates, and from then on every eligible hotspot ADOPTS
    // those coordinates: the others in this node, the ones in every node drilled
    // into, and any revealed with +. They are then frozen there.
    //
    // Freezing alone would be pointless — the whole purpose is that a hotspot
    // occupies the SAME screen position all the way down a branch, so drilling
    // in never makes a circle jump under the thumb, and a hold-to-play node can
    // sit exactly where its parent's hotspot was.
    //
    // Eligibility, and why: a hotspot that already has a video is skipped, since
    // it is placed and confirmed work that must not be dragged onto the axis.
    // The root node is skipped too, having nothing above it to align with.
    //
    // null = unlocked. Session only — a working mode, not a property of the
    // story, so it resets on mount like any other editor UI state. Unlocking
    // leaves every hotspot where the axis put it; it does not revert anything.
    const [lockedAxis, setLockedAxis] = useState<{ x: number; y: number } | null>(null);
    const hotspotsLocked = lockedAxis !== null;

    // Custom Text Edit State
    const [editingTextSide, setEditingTextSide] = useState<BranchId | null>(null);
    const [editingTextValue, setEditingTextValue] = useState("");

    // UI State
    // "laneAction:left" / "lanePayoff:right" address a Drag & Hold circle. They
    // reuse the ONE existing video picker, which already carries victory and
    // everything else, rather than introducing a second one.
    type LaneSlot = `laneAction:${LaneId}` | `lanePayoff:${LaneId}`;
    const [pickerOpenSide, setPickerOpenSide] = useState<
        BranchId | "main" | "autoPlay" | LaneSlot | null
    >(null);
    const [activeDragId, setActiveDragId] = useState<BranchId>("left");

    // ✅ EXPLICIT selection, separate from activeDragId.
    // activeDragId cannot drive the loop button: it initialises to "left" and is
    // force-reset to a branch on every node change, so some circle is always
    // "active" and the button could never be hidden by default.
    const [selectedHotspot, setSelectedHotspot] = useState<BranchId | null>(null);

    // One node picker serves both destinations:
    //  "hotspot"  → the selected circle's loopTargetNodeId (viewer clicks to travel)
    //  "autoLoop" → the node's autoLoopTargetNodeId (fires when the video ends)
    const [nodePickerMode, setNodePickerMode] = useState<"hotspot" | "autoLoop" | null>(null);
    const loopPickerOpen = nodePickerMode !== null;

    // ✅ Once a picker has been opened its <video> elements stay mounted and are
    // hidden with CSS instead of unmounted. Unmounting threw away the loaded
    // metadata, so every reopen showed empty circles while each file was fetched
    // again. Mounted-but-hidden videos are paused, so this costs memory, not CPU.
    const [mediaPickerMounted, setMediaPickerMounted] = useState(false);
    const [loopPickerMounted, setLoopPickerMounted] = useState(false);

    useEffect(() => {
        if (pickerOpenSide) setMediaPickerMounted(true);
    }, [pickerOpenSide]);

    useEffect(() => {
        if (loopPickerOpen) setLoopPickerMounted(true);
    }, [loopPickerOpen]);

    const layerRef = useRef<HTMLDivElement | null>(null);
    const mainVideoRef = useRef<HTMLVideoElement | null>(null);
    const lensRefs = useRef<Record<BranchId, HTMLVideoElement | null>>({
        left: null,
        right: null,
        top: null,
        bottom: null,
    });

    // --- TRAVERSAL HELPERS ---

    // Get the node at the current path
    const getCurrentNode = () => {
        let node = treeRoot;
        for (const dir of path) {
            // Safety check: if path is invalid, return root (should not happen)
            if (!node.children?.[dir]) return node;
            node = node.children[dir]!;
        }
        return node;
    };

    const currentNode = getCurrentNode();
    const isRoot = path.length === 0;
    const isMaxDepth = path.length >= 7; // Level 0 -> 1 -> 2 (Max 3 levels)

    /* --- DRAG & HOLD (node-level mode) ------------------------------------ */

    /**
     * Whether the lane panel is open.
     *
     * `dragHold` is now PANEL STATE ONLY — it decides which controls the creator
     * is editing, never what the viewer sees. The player derives the Stick from
     * the lanes themselves (isDragNode), so closing this panel to go and place a
     * hotspot leaves the drag fully live.
     *
     * Pure panel state, deliberately: deriving it from the lanes would trap the
     * creator, because a node with lanes authored could never close the panel to
     * get its hotspots back.
     */
    const dragModeOn = currentNode.dragHold === true;

    /** This node has live lanes, whether or not the panel is currently open. */
    const hasLanes = isDragNode(currentNode);

    /**
     * This node IS a lane's action clip.
     *
     * The viewer's finger is busy here and the node's end frame is already
     * spoken for by its payoff, so it may hold neither the four hotspots, nor
     * autoplay, nor a Joystick of its own. Only the history link is offered —
     * which is what catches the viewer when a lane has no payoff.
     */
    const isLaneActionNode = path.length > 0
        && (DRAG_PATH_IDS as PathId[]).includes(path[path.length - 1]);

    /**
     * Toggling the mode NEVER destroys authored work.
     *
     * The four hotspots, their subs, autoPlaySrc and any auto-loop are all
     * retained and simply go inert — the same principle that lets a loop link
     * override media without deleting it. Toggling back restores the node
     * exactly as it was.
     */
    const toggleDragMode = () => {
        if (isGenerating) return;
        setSelectedHotspot(null);
        setNodePickerMode(null);
        setPickerOpenSide(null);
        updateCurrentNode({ dragHold: !dragModeOn });
    };

    const blankNode = (id: string, mainSrc: string): InteractionNode => ({
        id,
        mainSrc,
        subs: normalizeSubs([]),
        hotspots: createDefaultHotspots(),
        audio: { main: [], left: [], right: [], top: [], bottom: [] },
        children: {},
    });

    /**
     * The action clip — the video that plays under the finger.
     *
     * Clearing it does NOT delete the node. The payoff, any history link and
     * anything authored inside it survive, so re-picking a video restores the
     * lane rather than rebuilding it.
     */
    const setLaneActionSrc = (lane: LaneId, vidUrl: string) => {
        const segment = LANE_PATH[lane];
        const actionId = `${currentNode.id}-${segment}`;
        const existing = currentNode.children?.[segment];
        const nextSrc = existing?.mainSrc === vidUrl ? "" : vidUrl;

        const children = { ...(currentNode.children || {}) };
        children[segment] = existing
            ? { ...existing, mainSrc: nextSrc }
            : blankNode(actionId, nextSrc);

        updateCurrentNode({ children });
    };

    /**
     * The payoff — what the action clip cuts to on its exact end frame.
     *
     * This writes the action node's autoPlay slot, because that IS what a
     * payoff is. Both autoPlaySrc and children.autoPlay are written here rather
     * than relying on the normalizer to synthesise the child, so the node is
     * immediately enterable and immediately loop-targetable.
     */
    const setLanePayoffSrc = (lane: LaneId, vidUrl: string) => {
        const segment = LANE_PATH[lane];
        const actionId = `${currentNode.id}-${segment}`;
        const action = currentNode.children?.[segment] ?? blankNode(actionId, "");
        const nextSrc = action.autoPlaySrc === vidUrl ? "" : vidUrl;

        const actionChildren = { ...(action.children || {}) };
        if (nextSrc) {
            const payoffId = `${action.id}-autoPlay`;
            actionChildren.autoPlay = actionChildren.autoPlay
                ? { ...actionChildren.autoPlay, mainSrc: nextSrc }
                : blankNode(payoffId, nextSrc);
        }
        // Clearing only deactivates the cut. The subtree stays editable and
        // loop-targetable, exactly as clearing an ordinary autoPlaySrc does.

        const children = { ...(currentNode.children || {}) };
        children[segment] = { ...action, autoPlaySrc: nextSrc, children: actionChildren };

        updateCurrentNode({ children });
    };


    const [revealedBranches, setRevealedBranches] = useState<BranchId[]>(["left"]);
    // ✅ Note the unconditional `branch === "left"`: the list can never be empty,
    // so drag mode and lane action nodes have to suppress it here rather than by
    // clearing revealedBranches.
    const visibleBranches = (dragModeOn || isLaneActionNode)
        ? []
        : BRANCH_IDS.filter(
            (branch) =>
                branch === "left" ||
                revealedBranches.includes(branch) ||
                isBranchConfigured(currentNode, branch)
        );

    useEffect(() => {
        const configured = BRANCH_IDS.filter(
            (branch) => branch === "left" || isBranchConfigured(currentNode, branch)
        );
        setRevealedBranches(configured);
        setActiveDragId(configured[0] || "left");
        // ✅ Selection is cleared on node change, so the loop button starts hidden
        // in every node.
        setSelectedHotspot(null);
        setNodePickerMode(null);
    }, [currentNode.id]);

    // --- LOOP LINK STATE ---
    const nodeIndex = React.useMemo(() => createNodeIndex(treeRoot), [treeRoot]);
    const allNodes: CollectedNode[] = React.useMemo(
        () => collectInteractionNodes(treeRoot),
        [treeRoot]
    );

    const selectedIndex = selectedHotspot === null ? null : BRANCH_INDEX[selectedHotspot];
    const selectedHotspotData =
        selectedIndex === null ? null : currentNode.hotspots[selectedIndex];
    const selectedLoopTargetId = selectedHotspotData?.loopTargetNodeId || null;

    // The loop button appears under exactly the same condition as the hotspot's
    // floating control cluster — which is shown for ANY selected circle, whether
    // it currently offers ADD MEDIA (no video yet) or ENTER + SCAN SHAPE / RESET.
    // A hotspot can therefore be linked before it has any media of its own.
    const showLoopButton = selectedHotspot !== null;

    const setLoopTargetForSelected = (targetId: string | null) => {
        if (selectedHotspot === null) return;
        const idx = BRANCH_INDEX[selectedHotspot];
        const newHotspots = [...currentNode.hotspots] as BranchTuple<Hotspot>;
        const updated: Hotspot = { ...newHotspots[idx] };
        if (targetId) updated.loopTargetNodeId = targetId;
        else delete updated.loopTargetNodeId;
        newHotspots[idx] = updated;
        updateCurrentNode({ hotspots: newHotspots });
        setNodePickerMode(null);
    };

    // --- AUTO-LOOP (node level) ---
    const autoLoopTargetId = currentNode.autoLoopTargetNodeId || null;
    const autoLoopEntry = autoLoopTargetId ? nodeIndex.get(autoLoopTargetId) : undefined;
    const autoLoopIsBroken = Boolean(autoLoopTargetId && !autoLoopEntry);

    const setAutoLoopTarget = (targetId: string | null) => {
        if (targetId) {
            // Mutual override: an auto-loop and an autoPlay video are both "what
            // happens when this scene ends", so only one can be live. Clearing
            // autoPlaySrc deactivates the cut WITHOUT deleting children.autoPlay —
            // that subtree stays in the node list, editable and loop-targetable.
            updateCurrentNode({ autoLoopTargetNodeId: targetId, autoPlaySrc: "" });
        } else {
            updateCurrentNode({ autoLoopTargetNodeId: undefined });
        }
        setNodePickerMode(null);
    };

    const pickerIsAutoLoop = nodePickerMode === "autoLoop";
    const pickerAccent = pickerIsAutoLoop
        ? "#4caf50"
        : (selectedHotspot ? branchColors[selectedHotspot] : "#ffffff");
    const pickerLinkedId = pickerIsAutoLoop ? autoLoopTargetId : selectedLoopTargetId;
    const assignNodePickerTarget = (targetId: string | null) => {
        if (pickerIsAutoLoop) setAutoLoopTarget(targetId);
        else setLoopTargetForSelected(targetId);
    };

    /**
     * Per-hotspot Hold to Play toggle. Independent of media, loop link, victory,
     * custom text and shape scanning — replacing any of those must not silently
     * clear it, which is why it is written on its own and never as a side effect
     * of the media handlers.
     */
    const toggleHoldToPlay = (side: BranchId) => {
        const idx = BRANCH_INDEX[side];
        const newHotspots = [...currentNode.hotspots] as BranchTuple<Hotspot>;
        newHotspots[idx] = {
            ...newHotspots[idx],
            holdToPlay: newHotspots[idx].holdToPlay !== true,
        };
        updateCurrentNode({ hotspots: newHotspots });
    };

    // Jump the EDITOR to a linked destination. ENTER deliberately still edits the
    // hotspot's own child subtree — making ENTER follow the loop would move the
    // creator upward for ancestor targets and orphan the retained subtree.
    const openLoopTargetInEditor = (targetId?: string) => {
        if (!targetId) return;
        const entry = nodeIndex.get(targetId);
        if (!entry) return;
        setSub1AudioUrl([]);
        setSub2AudioUrl([]);
        setTopAudioUrl([]);
        setBottomAudioUrl([]);
        setPath(entry.path);
    };

    const revealNextHotspot = () => {
        const next = BRANCH_IDS.find((branch) => !visibleBranches.includes(branch));
        if (!next) return;

        // ➕ Position is deliberately left alone — a reveal lands on the hotspot's
        // own default slot, exactly as it always has. Reachability is handled by
        // z-order instead (see renderLens): the newest circle draws ABOVE the
        // others, so even in the rare case where an earlier hotspot has been
        // dragged onto this slot, the one the creator just added is the one their
        // finger lands on. Moving it instead would be the surprising choice, and
        // burying it would be a trap — adding a hotspot always means unlocking to
        // place it, so it must be grabbable the moment it appears.
        setRevealedBranches((branches) => [...branches, next]);
        setActiveDragId(next);
    };

    const canAddHotspot = visibleBranches.length < BRANCH_IDS.length;

    // Update the current node in the tree structure
    const updateCurrentNode = useCallback((updates: Partial<InteractionNode>) => {
        setTreeRoot((prevRoot) => {
            const newRoot = { ...prevRoot }; // Shallow copy root
            let ptr = newRoot;

            // Traverse down to find the node to update
            for (const dir of path) {
                if (!ptr.children) ptr.children = {};
                // Ensure child exists (deep clone along path)
                if (!ptr.children[dir]) {
                    // Fallback init if missing
                    ptr.children[dir] = {
                        id: `${ptr.id}-${dir}`,
                        mainSrc: childSrcFromParent(ptr, dir),
                        subs: normalizeSubs([]),
                        hotspots: createDefaultHotspots(),
                        // ✅ INITIALIZE AUDIO AS ARRAYS
                        audio: { main: [], left: [], right: [], top: [], bottom: [] }
                    } as InteractionNode;
                }
                ptr.children[dir] = { ...ptr.children[dir]! };
                ptr = ptr.children[dir]!;
            }

            // Apply updates
            Object.assign(ptr, updates);

            // ✅ SYNC: If we are at Root, update the parent flat state for saving compatibility
            if (path.length === 0) {
                if (updates.hotspots) {
                    setHotspots(updates.hotspots);
                }
            }
            return newRoot;
        });
    }, [path, setHotspots, setTreeRoot]);

    // --- AUDIO SYNC LOOP (FIXED) ---
    // ✅ Watches for changes in props (from TextToSpeech modal) and saves them to the Tree Node as Arrays
    useEffect(() => {
        if (!currentNode) return;

        const newAudioState = { ...currentNode.audio };
        let hasChange = false;

        // Helper to normalize to array
        const toArray = (val: any) => (Array.isArray(val) ? val : val ? [val] : []);

        const incomingLeft = toArray(sub1AudioUrl);
        const incomingRight = toArray(sub2AudioUrl);
        const incomingTop = toArray(topAudioUrl);
        const incomingBottom = toArray(bottomAudioUrl);

        // 🛑 SAFETY GUARD:
        // If BOTH inputs are empty, we assume we just navigated/reset.
        // We do NOT wipe the node's audio in this case.
        if (incomingLeft.length === 0 && incomingRight.length === 0 && incomingTop.length === 0 && incomingBottom.length === 0) {
            return;
        }

        // Check Left Audio Prop
        if (JSON.stringify(incomingLeft) !== JSON.stringify(newAudioState.left)) {
            newAudioState.left = incomingLeft;
            hasChange = true;
        }

        // Check Right Audio Prop
        if (JSON.stringify(incomingRight) !== JSON.stringify(newAudioState.right)) {
            newAudioState.right = incomingRight;
            hasChange = true;
        }


        if (JSON.stringify(incomingTop) !== JSON.stringify(newAudioState.top)) {
            newAudioState.top = incomingTop;
            hasChange = true;
        }

        if (JSON.stringify(incomingBottom) !== JSON.stringify(newAudioState.bottom)) {
            newAudioState.bottom = incomingBottom;
            hasChange = true;
        }
        if (hasChange) {
            updateCurrentNode({ audio: newAudioState });
        }
    }, [sub1AudioUrl, sub2AudioUrl, topAudioUrl, bottomAudioUrl, updateCurrentNode, currentNode]);
    const lastNodeIdRef = useRef<string | null>(null);

    // --- VIDEO SYNC LOOP ---
    useEffect(() => {
        const main = document.getElementById("main-video") as HTMLVideoElement;
        if (!main) return;
        mainVideoRef.current = main;

        const isNewNode = lastNodeIdRef.current !== currentNode.id;
        lastNodeIdRef.current = currentNode.id;

        // Force Main Video Source to match current Node context
        const desiredSrc = currentNode.mainSrc;
        
        // 🛑 FIX: If we navigated to a new node, or the desired src changed, we MUST force the video to restart.
        // If the user selects the EXACT SAME video for the downstream node, it previously ignored it and just continued playing.
        if (isNewNode || main.getAttribute("src") !== desiredSrc) {
            main.src = desiredSrc;
            main.currentTime = 0; // Force restart from beginning
            main.load();
            main.play().catch(() => { });
        }

        let rafId: number;
        const sync = () => {
            // 🛑 FIX: React's parent component (InteractInput) can sometimes re-render and overwrite the src with the root vid1.
            // We detect this by checking if the attribute was reverted to treeRoot.mainSrc, and if so, we safely force it back to desiredSrc.
            if (desiredSrc !== treeRoot.mainSrc && main.getAttribute("src") === treeRoot.mainSrc) {
                main.src = desiredSrc;
                main.load();
                main.play().catch(() => { });
            }

            const t = main.currentTime;
            // Force play if paused unintentionally
            BRANCH_IDS.forEach((branch) => {
                const lens = lensRefs.current[branch];
                if (!lens) return;
                if (lens.paused) lens.play().catch(() => { });
                lens.currentTime = t;
            });
            rafId = requestAnimationFrame(sync);
        };
        rafId = requestAnimationFrame(sync);
        return () => cancelAnimationFrame(rafId);
    }, [currentNode.mainSrc]); // Only re-run if the main video source changes (navigation)

    // --- OPTION 1.5: AI SHAPE DETECTION (SAM) ---
    const [isScanningShape, setIsScanningShape] = useState<BranchId | null>(null);

    const captureFrameAndSegment = async (side: BranchId) => {
        const main = mainVideoRef.current;
        if (!main) return;
        
        setIsScanningShape(side);
        
        try {
            // 1. Bypass CORS by creating a temporary cross-origin video element and capture a Blob
            const imageBlob = await new Promise<Blob>((resolve, reject) => {
                const tempVid = document.createElement("video");
                tempVid.crossOrigin = "anonymous";
                tempVid.src = main.currentSrc + (main.currentSrc.includes("?") ? "&" : "?") + "nocache=" + Date.now();
                tempVid.currentTime = main.currentTime || 0;
                tempVid.muted = true;
                tempVid.playsInline = true;
                tempVid.preload = "auto";

                tempVid.addEventListener("seeked", () => {
                    try {
                        const canvas = document.createElement("canvas");
                        canvas.width = tempVid.videoWidth;
                        canvas.height = tempVid.videoHeight;
                        const ctx = canvas.getContext("2d");
                        if (!ctx) return reject(new Error("No 2d context"));
                        ctx.drawImage(tempVid, 0, 0, canvas.width, canvas.height);
                        
                        canvas.toBlob((blob) => {
                            if (blob) resolve(blob);
                            else reject(new Error("Failed to convert canvas to blob"));
                        }, "image/jpeg", 0.9);
                    } catch (err) {
                        reject(err);
                    }
                }, { once: true });

                tempVid.addEventListener("error", () => reject(new Error("Failed to load cross-origin video for capture.")), { once: true });
            });

            const CLIK_URL = import.meta.env.VITE_CLIK_URL;

            // 2. Request Signed URL from Backend
            const signedRes = await axios.post(
                `${CLIK_URL}/get_signed_url_imageStory`,
                { values: { count: 1 } },
                { withCredentials: true }
            );
            const signedUrls = signedRes.data.holder?.[0];
            if (!signedUrls || !signedUrls.urlHD) throw new Error("Failed to get signed URL for S3 upload.");

            // 3. Upload Blob to S3
            await axios.put(signedUrls.urlHD, imageBlob, {
                headers: { "Content-Type": "image/jpeg" },
            });
            const s3Url = signedUrls.urlHD.split("?")[0];
            
            // 4. Register S3 URL for automatic garbage collection (6 hours)
            Saveprompthelperfordellater(s3Url);

            // 5. Get accurate pixel coords for SAM handling object-fit: cover cropping
            const hs = currentNode.hotspots[BRANCH_INDEX[side]];
            
            const rect = main.getBoundingClientRect();
            const containerAspect = rect.width / rect.height;
            const videoAspect = main.videoWidth / main.videoHeight;

            let videoDisplayWidth, videoDisplayHeight;
            if (videoAspect > containerAspect) {
                videoDisplayHeight = rect.height;
                videoDisplayWidth = rect.height * videoAspect;
            } else {
                videoDisplayWidth = rect.width;
                videoDisplayHeight = rect.width / videoAspect;
            }

            const xOffset = (videoDisplayWidth - rect.width) / 2;
            const yOffset = (videoDisplayHeight - rect.height) / 2;

            const clickXInContainer = hs.x * rect.width;
            const clickYInContainer = hs.y * rect.height;

            const pixelX = Math.round(((clickXInContainer + xOffset) / videoDisplayWidth) * main.videoWidth);
            const pixelY = Math.round(((clickYInContainer + yOffset) / videoDisplayHeight) * main.videoHeight);

            // 6. API Call to Fal.ai Backend with the public S3 URL
            const res = await axios.post(`${CLIK_URL}/api/segment`, {
                imageUrl: s3Url,
                x: pixelX,
                y: pixelY
            });

            if (res.data.success && res.data.svgPath) {
                const { svgPath, maskWidth, maskHeight } = res.data;
                
                // 5. Update Hotspot
                const newHotspots = [...currentNode.hotspots] as BranchTuple<Hotspot>;
                const idx = BRANCH_INDEX[side];
                newHotspots[idx] = { 
                    ...newHotspots[idx], 
                    svgPath, maskWidth, maskHeight
                };
                updateCurrentNode({ hotspots: newHotspots });
                
                // alert("Shape detected successfully!");
            } else {
                throw new Error("No shape detected by SAM.");
            }
        } catch (e: any) {
            console.error("Shape detection failed:", e);
            alert("Shape detection failed. " + (e.message || ""));
        } finally {
            setIsScanningShape(null);
        }
    };

    // --- HANDLERS ---

    /**
     * Swap this node's main video.
     *
     * Must also write the new URL into the PARENT's slot that produced this node —
     * its branch sub, or autoPlaySrc. handleDrillDown re-forces a child's mainSrc
     * from that slot on every entry, so updating only the child made the swap
     * revert the next time the creator walked back into the node. Both writes
     * happen in one setTreeRoot pass so the second doesn't read stale state.
     */
    const swapCurrentNodeMain = useCallback((vidUrl: string) => {
        setTreeRoot((prevRoot) => {
            const newRoot = { ...prevRoot };
            let ptr = newRoot;
            const chain: InteractionNode[] = [newRoot];

            for (const dir of path) {
                if (!ptr.children) ptr.children = {};
                if (!ptr.children[dir]) {
                    ptr.children[dir] = {
                        id: `${ptr.id}-${dir}`,
                        mainSrc: childSrcFromParent(ptr, dir),
                        subs: normalizeSubs([]),
                        hotspots: createDefaultHotspots(),
                        audio: { main: [], left: [], right: [], top: [], bottom: [] }
                    } as InteractionNode;
                }
                ptr.children[dir] = { ...ptr.children[dir]! };
                ptr = ptr.children[dir]!;
                chain.push(ptr);
            }

            const nextSrc = ptr.mainSrc === vidUrl ? "" : vidUrl;
            ptr.mainSrc = nextSrc;

            if (path.length > 0) {
                const parent = chain[chain.length - 2];
                const segment = path[path.length - 1];
                if (segment === "autoPlay") {
                    parent.autoPlaySrc = nextSrc;
                } else if (!(DRAG_PATH_IDS as PathId[]).includes(segment)) {
                    const parentSubs = [...parent.subs] as BranchTuple<string>;
                    parentSubs[BRANCH_INDEX[segment as BranchId]] = nextSrc;
                    parent.subs = parentSubs;
                }
                // A lane has no mirror in the parent — the action clip lives on
                // the child alone, and ptr.mainSrc above already wrote it.
            }

            return newRoot;
        });
    }, [path, setTreeRoot]);

    const handleVideoSelect = (vidUrl: string) => {
        if (!pickerOpenSide) return;

        // Drag & Hold circles come through the same picker as everything else,
        // so victory and every other property behave identically here.
        if (pickerOpenSide.startsWith("laneAction:")) {
            setLaneActionSrc(pickerOpenSide.split(":")[1] as LaneId, vidUrl);
            return;
        }
        if (pickerOpenSide.startsWith("lanePayoff:")) {
            setLanePayoffSrc(pickerOpenSide.split(":")[1] as LaneId, vidUrl);
            return;
        }

        if (pickerOpenSide === "main") {
            swapCurrentNodeMain(vidUrl);
        } else if (pickerOpenSide === "autoPlay") {
            // Mutual override with the auto-loop: choosing an autoPlay video makes
            // the video the live end-of-scene route and drops the node link.
            if (currentNode.autoPlaySrc === vidUrl) updateCurrentNode({ autoPlaySrc: "" });
            else updateCurrentNode({ autoPlaySrc: vidUrl, autoLoopTargetNodeId: undefined });
        } else {
            // Lane slots returned above, so only the four branches reach here.
            const idx = BRANCH_INDEX[pickerOpenSide as BranchId];
            const newSubs = [...currentNode.subs] as BranchTuple<string>;
            const newHotspots = [...currentNode.hotspots] as BranchTuple<Hotspot>;
            const hotspot: Hotspot = { ...newHotspots[idx] };
            const hadLoop = Boolean(hotspot.loopTargetNodeId);

            if (newSubs[idx] === vidUrl) {
                // ✅ Same video re-selected. Normally this toggles the video off.
                // While a loop is active it instead means "use this normal video
                // again instead of the loop" — so keep the media and drop the link.
                // Without this the hotspot could end up with neither.
                if (!hadLoop) newSubs[idx] = "";
            } else {
                newSubs[idx] = vidUrl;
            }

            // Choosing normal media always clears the loop link.
            if (hadLoop) delete hotspot.loopTargetNodeId;
            newHotspots[idx] = hotspot;

            updateCurrentNode({ subs: newSubs, hotspots: newHotspots });
        }
    };

    const handleDrillDown = (side: PathId) => {
        // 🛑 RACE PREVENTION: Do not allow drill down if generating
        if (isGenerating) return;

        // A lane's media lives on its child node, not in this node's subs, so
        // the ordinary lookup below would read subs[undefined] and bail.
        const isDragSegment = (DRAG_PATH_IDS as PathId[]).includes(side);
        const subUrl = isDragSegment
            ? currentNode.children?.[side as DragPathId]?.mainSrc
            : side === "autoPlay"
                ? currentNode.autoPlaySrc
                : currentNode.subs[BRANCH_INDEX[side as BranchId]];
        if (!subUrl) return;

        // 1. Capture the audio we want to pass down (INHERITANCE).
        //
        // Filtered to REAL tracks only. An empty or malformed entry used to be
        // inherited as though it were audio, which made the child think it had its
        // own track — the player then muted the video to play nothing, and the
        // scene went silent. Nothing usable means the child keeps no main audio and
        // simply plays its video's own sound.
        const usableAudio = (value: unknown): any[] => {
            const list = Array.isArray(value) ? value : value ? [value] : [];
            return list.filter((entry) => typeof entry === "string" && entry.trim().length > 0);
        };
        // A lane child inherits NOTHING, exactly like autoPlay. There is no
        // audio.dragLeft slot to inherit from — and that absence is load-bearing:
        // seeding an action clip with a track would mute its video, and the
        // video's own sound IS the feedback for the drag gesture.
        const inheritedAudio =
            side === "autoPlay" || isDragSegment
                ? []
                : usableAudio(currentNode.audio?.[side as BranchId]);

        // 🛑 FIX: Clear props immediately so old audio doesn't "stick" to new node
        setSub1AudioUrl([]);
        setSub2AudioUrl([]);
        setTopAudioUrl([]);
        setBottomAudioUrl([]);

        setTreeRoot((prevRoot) => {
            const newRoot = { ...prevRoot };
            let ptr = newRoot;

            // Traverse to current node
            for (const dir of path) {
                if (!ptr.children) ptr.children = {};
                // Ensure child exists (deep clone along path)
                if (!ptr.children[dir]) {
                    ptr.children[dir] = {
                        id: `${ptr.id}-${dir}`,
                        mainSrc: childSrcFromParent(ptr, dir),
                        subs: normalizeSubs([]),
                        hotspots: createDefaultHotspots(),
                        audio: { main: [], left: [], right: [], top: [], bottom: [] }
                    } as InteractionNode;
                }
                ptr.children[dir] = { ...ptr.children[dir]! }; // DEEP CLONE
                ptr = ptr.children[dir]!;
            }

            if (!ptr.children) ptr.children = {};

            // 2. CHECK: Does the child already exist?
            if (!ptr.children[side]) {
                // CASE A: NEW NODE (Create it)
                ptr.children[side] = {
                    id: `${currentNode.id}-${side}`,
                    mainSrc: subUrl,
                    subs: normalizeSubs([]),
                    hotspots: createDefaultHotspots(),
                    audio: {
                        main: inheritedAudio, // seeded from the branch that leads here
                        left: [],
                        right: [],
                        top: [],
                        bottom: []
                    }
                };
            } else {
                // CASE B: EXISTING NODE.
                //
                // Its OWN audio wins. This previously overwrote the child's main
                // audio with the parent's branch audio on every entry, so a track
                // authored on the child was replaced by the parent's — or by
                // nothing — each time the creator walked back into it.
                // Inheritance now only seeds a child that has none.
                const existingMain = usableAudio(ptr.children[side]!.audio?.main);
                ptr.children[side] = {
                    ...ptr.children[side],
                    mainSrc: subUrl, // Force update video
                    audio: {
                        ...ptr.children[side].audio,
                        main: existingMain.length > 0 ? existingMain : inheritedAudio
                    }
                };
            }
            return newRoot;
        });

        setPath([...path, side]);
    };

    const handleBackUp = () => {
        // 🛑 RACE PREVENTION: Do not allow back nav if generating
        if (isGenerating) return;

        // 🛑 FIX: Clear props immediately on back too
        setSub1AudioUrl([]);
        setSub2AudioUrl([]);

        setTopAudioUrl([]);
        setBottomAudioUrl([]);
        if (path.length > 0) {
            setPath(path.slice(0, -1));
        } else {
            backToDefault();
        }
    };

    // --- HUD Auto-Hide Logic ---
    const [isHUDHidden, setIsHUDHidden] = useState(false);
    const hudTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const hideHUDTemporarily = useCallback(() => {
        setIsHUDHidden(true);
        if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
        hudTimeoutRef.current = setTimeout(() => {
            setIsHUDHidden(false);
        }, 1000);
    }, []);

    // --- Control Bar Flip Logic ---
    const [flippedControls, setFlippedControls] = useState<Record<BranchId, boolean>>({ left: false, right: false, top: false, bottom: false });

    // Hotspot Dragging Logic
    const dragStartRef = useRef<{ x: number, y: number, wasActive: boolean } | null>(null);

    /**
     * 🔒 The single rule for whether a hotspot may be repositioned.
     *
     *   hotspot          | lock on | lock off
     *   -----------------|---------|---------
     *   has video        | never   | never
     *   no video, root   | moves   | moves
     *   no video, other  | frozen  | moves
     *
     * A hotspot that has a video is already placed and confirmed, so it is
     * permanently immovable — the lock "skips" it in both directions. That is
     * what stops an accidental touch shifting finished work during the unlocked
     * moment when a new hotspot is being placed.
     *
     * The root node is exempt because there is nothing above it to stay aligned
     * with; freezing it would only prevent the first placement.
     *
     * svgPath keeps its existing meaning (scanned shapes never drag) and is
     * folded in here so all three call sites ask one question instead of two.
     */
    const canMoveHotspot = (side: BranchId) => {
        const idx = BRANCH_INDEX[side];
        const hs = currentNode.hotspots[idx];
        if (hs.svgPath) return false;          // scanned shape — existing rule
        if (currentNode.subs[idx]) return false; // has video — never moves
        if (isRoot) return true;               // root is exempt from the lock
        return !hotspotsLocked;
    };

    /**
     * 🔒 Pull every eligible hotspot in the CURRENT node onto the locked axis.
     *
     * This is the half that makes the lock worth having. Freezing hotspots where
     * they happen to sit would leave each node showing its own defaults; adopting
     * one axis is what makes a circle occupy the same screen position all the way
     * down a branch.
     *
     * Skips, and why each one matters:
     *   - has video  — placed, confirmed work. Dragging it onto the axis would
     *                  destroy a deliberate placement. This is the exclusion the
     *                  whole design was built around.
     *   - svgPath    — a scanned shape's geometry is not a point and cannot be
     *                  meaningfully moved to one.
     *   - root node  — nothing above it to align with.
     *
     * Runs on lock, and again on every navigation, so drilling into a node that
     * has never been visited pulls its hotspots onto the axis on arrival.
     *
     * Terminates because it writes only when a coordinate actually differs: the
     * write re-renders, this runs again, finds everything already on the axis,
     * and writes nothing.
     */
    const applyLockedAxis = useCallback(() => {
        if (!lockedAxis || isRoot) return;
        let changed = false;
        const next = currentNode.hotspots.map((hs, idx) => {
            if (currentNode.subs[idx]) return hs;
            if (hs.svgPath) return hs;
            if (hs.x === lockedAxis.x && hs.y === lockedAxis.y) return hs;
            changed = true;
            return { ...hs, x: lockedAxis.x, y: lockedAxis.y };
        }) as BranchTuple<Hotspot>;
        if (changed) updateCurrentNode({ hotspots: next });
    }, [lockedAxis, isRoot, currentNode, updateCurrentNode]);

    // visibleBranches.length is a dependency so revealing a hotspot with + while
    // locked snaps the new circle onto the axis immediately, rather than leaving
    // it at its default slot until the next navigation.
    useEffect(() => {
        applyLockedAxis();
    }, [applyLockedAxis, path, visibleBranches.length]);

    const onPlace = (e: React.MouseEvent<HTMLDivElement>) => {
        hideHUDTemporarily();
        // Prefer the explicitly selected circle; fall back to activeDragId so
        // click-to-place keeps working exactly as before when nothing is selected.
        const idx = BRANCH_INDEX[selectedHotspot ?? activeDragId];
        // 🔒 Covers the old svgPath check (teleportation if scanned) plus the
        // position lock and the has-video rule.
        if (!canMoveHotspot(selectedHotspot ?? activeDragId)) return;

        const el = layerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        // Clamp to 0-1
        const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

        const newHotspots = [...currentNode.hotspots] as BranchTuple<Hotspot>;
        newHotspots[idx] = { ...newHotspots[idx], x: nx, y: ny, svgPath: undefined };
        updateCurrentNode({ hotspots: newHotspots });
    };

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, side: BranchId) => {
        hideHUDTemporarily();
        const hs = currentNode.hotspots[BRANCH_INDEX[side]];
        if (hs.svgPath) return; // Prevent drag if scanned
        e.stopPropagation();
        // wasActive drives whether a click opens the media picker. It must track the
        // EXPLICIT selection, not activeDragId — activeDragId is auto-assigned on
        // node change, so a first click on an unselected circle used to open the
        // picker before its controls were even showing.
        dragStartRef.current = { x: e.clientX, y: e.clientY, wasActive: selectedHotspot === side };
        setActiveDragId(side);
        setSelectedHotspot(side);
        // 🔒 Selection happens ABOVE this line on purpose. A locked hotspot must
        // still be selectable and still open its picker on a second click — the
        // lock freezes POSITION, not the hotspot itself. Only the drag is armed
        // conditionally.
        if (!canMoveHotspot(side)) return;
        setIsDragging(true);
        (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>, side: BranchId) => {
        // 🔒 isDragging is never armed for a locked hotspot, so this is belt and
        // braces — it also covers the lock being switched ON mid-drag.
        if (!canMoveHotspot(side)) return;
        if (!isDragging || activeDragId !== side) return;
        const el = layerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

        const newHotspots = [...currentNode.hotspots] as BranchTuple<Hotspot>;
        const idx = BRANCH_INDEX[side];
        newHotspots[idx] = { ...newHotspots[idx], x: nx, y: ny, svgPath: undefined };
        updateCurrentNode({ hotspots: newHotspots });
    };

    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        setIsDragging(false);
        try {
            (e.target as HTMLDivElement).releasePointerCapture(e.pointerId);
        } catch (e) {}
    };

    // No getLensStyle needed anymore, circles are pure transparent placement markers

    // --- RENDERERS ---

    const renderLens = (hs: Hotspot, side: BranchId) => {
        const color = branchColors[side];
        // Controls follow the EXPLICIT selection so they cannot disagree with the
        // loop button. activeDragId keeps its drag/placement role.
        const isActive = selectedHotspot === side;
        const diameterPct = hs.r * 100;
        const idx = BRANCH_INDEX[side];
        const hasVideo = !!currentNode.subs[idx];
        const loopTargetId = hs.loopTargetNodeId;
        const loopEntry = loopTargetId ? nodeIndex.get(loopTargetId) : undefined;
        const loopIsBroken = Boolean(loopTargetId && !loopEntry);
        const isHold = hs.holdToPlay === true;

        return (
            <div
                key={side}
                onClick={(e) => {
                    e.stopPropagation();
                    const wasActive = dragStartRef.current ? dragStartRef.current.wasActive : (selectedHotspot === side);
                    setActiveDragId(side);
                    setSelectedHotspot(side);
                    // Open picker only if it was a simple click (not a drag)
                    if (dragStartRef.current) {
                        const dist = Math.hypot(e.clientX - dragStartRef.current.x, e.clientY - dragStartRef.current.y);
                        if (dist > 10) return; // Was a drag
                    }
                    // Only open the picker if the circle was already active BEFORE this click started (second click)
                    if (wasActive) {
                        setPickerOpenSide(side);
                    }
                }}
                onPointerDown={(e) => onPointerDown(e, side)}
                onPointerMove={(e) => onPointerMove(e, side)}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                style={{
                    position: "absolute",
                    left: `${hs.x * 100}%`, top: `${hs.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    width: `max(${diameterPct}%, ${SUB_MIN})`, aspectRatio: "1 / 1",
                    borderRadius: "50%",
                    border: "none",
                    background: hs.svgPath ? "transparent" : (isActive ? branchFills[side] : "rgba(0,0,0,0.1)"),
                    boxShadow: hs.svgPath ? "none" : "0 8px 24px rgba(0,0,0,0.45)",
                    // ➕ The most recently revealed circle draws above the rest, so a
                    // freshly added hotspot is always the one the finger lands on
                    // even if it happens to appear under an existing one. Adding a
                    // hotspot always means unlocking to place it, so it can never be
                    // allowed to spawn buried and ungrabbable.
                    // 🔒 The cursor is the only always-visible signal that a circle
                    // is pinned, since the padlock is hidden on has-video hotspots.
                    zIndex: revealedBranches[revealedBranches.length - 1] === side ? 8 : 6,
                    cursor: canMoveHotspot(side) ? "grab" : "default",
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
            >
                {/* BRANDING SIGNAL: Spinning Dashed Border */}
                <div style={{
                    position: "absolute", inset: -2, borderRadius: "50%",
                    border: hs.svgPath ? `2px dashed rgba(255,255,255,0.4)` : `3px dashed ${color}`,
                    animation: "clikSpin 10s linear infinite",
                    pointerEvents: "none", zIndex: 1
                }} />

                {/* HOLD BADGE — editor only, top-LEFT so it can never overlap the
                    loop badge on the right. Informational: pointer-events none so
                    it cannot intercept drag, selection or shape scanning. */}
                {isHold && (
                    <div
                        style={{
                            position: "absolute",
                            top: -6,
                            left: -6,
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            background: "rgba(0,0,0,0.82)",
                            border: `2px solid ${color}`,
                            color: color,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.6)",
                            pointerEvents: "none",
                            zIndex: 12,
                        }}
                    >
                        <TouchAppIcon style={{ fontSize: 15 }} />
                    </div>
                )}

                {/* LOOP BADGE — editor only. Persists while the circle is deselected
                    so the creator can see which hotspots route elsewhere. Anchored to
                    the hotspot coords so it survives AI-scanned shapes. */}
                {loopTargetId && (
                    <div
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!loopIsBroken && !isGenerating) openLoopTargetInEditor(loopTargetId);
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            style={{
                                position: "absolute",
                                top: -6,
                                right: -6,
                                zIndex: 12,
                                width: 26,
                                height: 26,
                                borderRadius: "50%",
                                background: loopIsBroken ? "rgba(60,0,0,0.9)" : "rgba(0,0,0,0.82)",
                                border: `2px solid ${loopIsBroken ? "#f44336" : color}`,
                                color: loopIsBroken ? "#f44336" : color,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.6)",
                                cursor: loopIsBroken ? "not-allowed" : "pointer",
                            }}
                        >
                            <RepeatIcon style={{ fontSize: 15 }} />
                        </div>
                )}

                {/* 🔒 POSITION LOCK PADLOCK — editor only.
                    Hidden on hotspots that already have a video: those never move
                    in either state, so offering them a lock would imply a control
                    that does nothing.

                    Sits on the circle's LEFT or RIGHT edge, whichever has room:
                    a circle past the halfway mark puts its padlock on the inward
                    side so it cannot be clipped by the frame. Vertically centred,
                    which keeps it clear of the hold badge (top-left) and the loop
                    badge (top-right).

                    The control is GLOBAL despite being drawn per circle — tapping
                    any padlock toggles every hotspot in every node at once. That
                    is the intended design, not a shortcut: the creator locks,
                    drills down, and everything stays where they left it. */}
                {!hasVideo && (
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            // Locking records THIS circle's coordinates as the axis —
                            // "the exact calculation of the hotspot the padlock was
                            // clicked on". Everything eligible then adopts them, so
                            // the circle you locked from never moves; the others come
                            // to it. Unlocking clears the axis and frees everything,
                            // leaving each hotspot where the axis put it.
                            setLockedAxis((current) => current ? null : { x: hs.x, y: hs.y });
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        title={hotspotsLocked
                            ? "Hotspot positions locked — tap to unlock all"
                            : "Tap to lock all hotspot positions"}
                        style={{
                            position: "absolute",
                            top: "50%",
                            ...(hs.x > 0.5 ? { left: -14 } : { right: -14 }),
                            transform: "translateY(-50%)",
                            width: 26,
                            height: 26,
                            borderRadius: "50%",
                            background: hotspotsLocked ? color : "rgba(0,0,0,0.82)",
                            border: `2px solid ${color}`,
                            color: hotspotsLocked ? "#000" : color,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.6)",
                            cursor: "pointer",
                            zIndex: 12,
                        }}
                    >
                        {hotspotsLocked
                            ? <LockIcon style={{ fontSize: 15 }} />
                            : <LockOpenIcon style={{ fontSize: 15 }} />}
                    </div>
                )}

                {/* Embedded Video Thumbnail */}
                {hasVideo ? (
                    <>
                        <video
                            src={currentNode.subs[idx]}
                            ref={(element) => { lensRefs.current[side] = element; }}
                            autoPlay muted loop playsInline
                            style={{ position: 'absolute', inset: 0, width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", opacity: hs.svgPath ? 0.3 : 0.8, pointerEvents: 'none' }}
                        />
                        {!hs.svgPath && (
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    borderRadius: "50%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "rgba(255, 255, 255, 0.9)",
                                    fontWeight: 800,
                                    fontSize: "1.1rem",
                                    letterSpacing: "1.5px",
                                    fontFamily: "system-ui, -apple-system, sans-serif",
                                    textTransform: "uppercase",
                                    background: "rgba(0, 0, 0, 0.45)",
                                    backdropFilter: "blur(6px)",
                                    WebkitBackdropFilter: "blur(6px)",
                                    pointerEvents: "none",
                                    zIndex: 5
                                }}
                            >
                                {hs.customText || "CLIK"}
                            </div>
                        )}
                    </>
                ) : loopTargetId && !hs.svgPath ? (
                    // Loop-only hotspot: no media of its own, but in preview it still
                    // renders as a normal labelled circle (TouchPreviewOverlay reads
                    // customText off the hotspot regardless of sub video). Show the
                    // same label here so the editor matches what the viewer sees.
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "rgba(255, 255, 255, 0.9)",
                            fontWeight: 800,
                            fontSize: "1.1rem",
                            letterSpacing: "1.5px",
                            fontFamily: "system-ui, -apple-system, sans-serif",
                            textTransform: "uppercase",
                            background: "rgba(0, 0, 0, 0.45)",
                            backdropFilter: "blur(6px)",
                            WebkitBackdropFilter: "blur(6px)",
                            pointerEvents: "none",
                            zIndex: 5
                        }}
                    >
                        {hs.customText || "CLIK"}
                    </div>
                ) : (
                    <span style={{ fontSize: 32, color: color, opacity: 0.8, pointerEvents: 'none' }}>+</span>
                )}

                {/* Floating Controls Bar (Only shows on active lens) */}
                {isActive && (
                    <>
                        <div style={{
                            position: "absolute",
                            top: flippedControls[side] ? undefined : -85,
                            bottom: flippedControls[side] ? -85 : undefined,
                            display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 8,
                        zIndex: 10
                    }}>
                        {/* TOP ROW: Audio & Edit */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {/* Audio Button */}
                            {intbg === 0 && (
                                <div
                                    onClick={(e) => { e.stopPropagation(); setIdentifier(idx + 1); setAddVoice(true); }}
                                    style={{
                                        width: 32, height: 32, borderRadius: "50%",
                                        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)",
                                        border: `1px solid ${color}`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        cursor: "pointer", color: color
                                    }}
                                >
                                    <MusicNoteIcon style={{ fontSize: 16 }} />
                                </div>
                            )}

                            {/* Edit Node Button */}
                            {hasVideo && !isMaxDepth && (
                                <div
                                    onClick={(e) => { e.stopPropagation(); !isGenerating && handleDrillDown(side); }}
                                    style={{
                                        padding: "8px 16px", borderRadius: 20, background: color,
                                        color: darkModeReducer ? "#000" : "#fff", fontSize: 11, fontWeight: 700,
                                        cursor: isGenerating ? 'not-allowed' : "pointer",
                                        boxShadow: "0 4px 12px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", gap: 4,
                                        opacity: isGenerating ? 0.5 : 1
                                    }}
                                >
                                    ENTER <ArrowForwardIosIcon style={{ fontSize: 10 }} />
                                </div>
                            )}
                        </div>

                        {/* BOTTOM ROW: ADD MEDIA / SCAN / RESET Button */}
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                if (!hasVideo) {
                                    setPickerOpenSide(side);
                                } else if (hs.svgPath) {
                                    const newHotspots = [...currentNode.hotspots] as BranchTuple<Hotspot>;
                                    newHotspots[idx] = { ...newHotspots[idx], svgPath: undefined };
                                    updateCurrentNode({ hotspots: newHotspots });
                                } else {
                                    if (!isScanningShape) captureFrameAndSegment(side);
                                }
                            }}
                            style={{
                                background: "rgba(0,0,0,0.75)",
                                backdropFilter: "blur(4px)",
                                border: `1px solid ${color}`,
                                borderRadius: 20,
                                padding: "8px 16px",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                color: "#fff",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: isScanningShape === side ? "wait" : "pointer",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                                whiteSpace: "nowrap",
                                opacity: isScanningShape === side ? 0.6 : 1
                            }}
                        >
                            {isScanningShape === side ? (
                                <CircularProgress size={12} style={{ color: "#fff" }} />
                            ) : hs.svgPath ? (
                                <CloseIcon style={{ fontSize: 14, color: "#f44336" }} />
                            ) : !hasVideo ? (
                                <span style={{ fontSize: 16, color, lineHeight: 1, marginTop: -2 }}>+</span>
                            ) : (
                                <AutoAwesomeIcon style={{ fontSize: 14, color }} />
                            )}
                            {isScanningShape === side ? "SCANNING..." : !hasVideo ? "ADD MEDIA" : hs.svgPath ? "RESET" : "SCAN SHAPE"}
                        </div>

                        {/* HOLD TO PLAY — contextual, scoped to this hotspot, and
                            available before or after media is assigned. */}
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                if (isGenerating || isScanningShape) return;
                                toggleHoldToPlay(side);
                            }}
                            style={{
                                background: isHold ? color : "rgba(0,0,0,0.75)",
                                backdropFilter: "blur(4px)",
                                border: isHold ? `1px solid ${color}` : "1px dashed rgba(255,255,255,0.55)",
                                borderRadius: 20,
                                padding: "7px 14px",
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                color: isHold ? (darkModeReducer ? "#000" : "#fff") : "rgba(255,255,255,0.85)",
                                fontSize: 10,
                                fontWeight: 800,
                                letterSpacing: "0.4px",
                                cursor: (isGenerating || isScanningShape) ? "not-allowed" : "pointer",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                                whiteSpace: "nowrap",
                                opacity: (isGenerating || isScanningShape) ? 0.5 : 1,
                            }}
                        >
                            <TouchAppIcon style={{ fontSize: 13 }} />
                            {isHold ? "HOLD ON" : "HOLD TO PLAY"}
                        </div>
                    </div>

                        {/* Flip Position Dot */}
                        <div
                            className="flip-dot"
                            onClick={(e) => {
                                e.stopPropagation();
                                setFlippedControls(prev => ({ ...prev, [side]: !prev[side] }));
                            }}
                            style={{
                                position: "absolute",
                                top: flippedControls[side] ? -40 : undefined,
                                bottom: flippedControls[side] ? undefined : -40,
                                zIndex: 10,
                                width: 18,
                                height: 18,
                                borderRadius: "50%",
                                backgroundColor: color,
                                cursor: "pointer",
                                boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                                border: "2px solid rgba(255,255,255,0.8)"
                            }}
                        />
                    </>
                )}
            </div>
        );
    };

    // Get list of videos to show in picker — full pool, no 9-item cap, so
    // B-shot videos beyond slot 9 are selectable.
    const videosForPicker = videoArray.filter(v => v);
    const pickerBranch =
        pickerOpenSide && BRANCH_IDS.includes(pickerOpenSide as BranchId)
            ? pickerOpenSide as BranchId
            : null;
    const pickerBranchIndex = pickerBranch === null ? null : BRANCH_INDEX[pickerBranch];
    const pickerBranchHotspot = pickerBranchIndex === null ? null : currentNode.hotspots[pickerBranchIndex];

    /* --- Drag & Hold lanes in the picker ---------------------------------
       Lane slots go through the SAME picker as everything else, so they need
       the same selection state, victory control and toggle-off. Without this
       the creator cannot tell what is chosen and therefore cannot remove it. */
    const pickerLane: LaneId | null =
        pickerOpenSide?.startsWith("laneAction:") || pickerOpenSide?.startsWith("lanePayoff:")
            ? pickerOpenSide.split(":")[1] as LaneId
            : null;
    const pickerLaneIsPayoff = Boolean(pickerOpenSide?.startsWith("lanePayoff:"));
    const pickerLaneAction = pickerLane ? laneActionNode(currentNode, pickerLane) : null;

    const pickerIsVictory =
        pickerLane
            ? (pickerLaneIsPayoff
                // The payoff is the action node's autoPlay, so its victory flag
                // is that node's autoPlayIsVictory — nothing new.
                ? Boolean(pickerLaneAction?.autoPlayIsVictory)
                // On the action clip the flag sits where the lane edge is read.
                : Boolean(pickerLaneAction?.hotspots?.[BRANCH_INDEX[pickerLane]]?.isVictory))
            : pickerOpenSide === "autoPlay"
                ? Boolean(currentNode.autoPlayIsVictory)
                : Boolean(pickerBranchHotspot?.isVictory);

    /** Victory toggle for a lane slot, written back through the lane helpers. */
    const toggleLaneVictory = () => {
        if (!pickerLane || !pickerLaneAction) return;
        const segment = LANE_PATH[pickerLane];
        const children = { ...(currentNode.children || {}) };
        if (pickerLaneIsPayoff) {
            children[segment] = {
                ...pickerLaneAction,
                autoPlayIsVictory: !pickerLaneAction.autoPlayIsVictory,
            };
        } else {
            const idx = BRANCH_INDEX[pickerLane];
            const hotspots = [...pickerLaneAction.hotspots] as BranchTuple<Hotspot>;
            hotspots[idx] = { ...hotspots[idx], isVictory: !hotspots[idx].isVictory };
            children[segment] = { ...pickerLaneAction, hotspots };
        }
        updateCurrentNode({ children });
    };

    return (
        <>
            <style>
                {`
                .flip-dot {
                    transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.2s ease;
                }
                .flip-dot:hover, .flip-dot:active {
                    transform: scale(1.6);
                    box-shadow: 0 4px 16px rgba(0,0,0,0.8) !important;
                }
                `}
            </style>
            {/* --- TOUCH LAYER --- */}
            <div ref={layerRef} onClick={onPlace} style={{ position: "absolute", inset: 0, zIndex: 5, cursor: "crosshair" }} />

            {/* --- AUTO-PLAY / LINEAR NODE CONTROLS (Top Right) --- */}
            <div style={{
                position: "absolute", top: 16, right: 16, zIndex: 11, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end",
                opacity: isHUDHidden ? 0 : 1, transition: "opacity 0.3s ease", pointerEvents: isHUDHidden ? "none" : "auto"
            }}>
              <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 10 }}>

                {/* --- LOOP LINK BUTTON (left of the autoplay circle) ---
                    Hidden until a hotspot is explicitly selected AND its control
                    cluster is showing, so it always operates on that one circle. */}
                {showLoopButton && (
                    <HintPill label="Hotspot from history" placement="bottom">
                        <div
                            onClick={(e) => { e.stopPropagation(); if (!isGenerating) setNodePickerMode("hotspot"); }}
                            style={{
                                width: 56, height: 56, borderRadius: "50%",
                                // Unlinked: dashed border takes the selected circle's
                                // colour so it reads as belonging to that hotspot,
                                // while the icon stays neutral. Linked: the colour
                                // takes over border, fill and icon.
                                border: selectedLoopTargetId
                                    ? `2px solid ${branchColors[selectedHotspot as BranchId]}`
                                    : `2px dashed ${branchColors[selectedHotspot as BranchId]}`,
                                background: selectedLoopTargetId
                                    ? branchFills[selectedHotspot as BranchId]
                                    : "rgba(0,0,0,0.4)",
                                backdropFilter: "blur(4px)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                cursor: isGenerating ? "not-allowed" : "pointer",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                                color: selectedLoopTargetId ? branchColors[selectedHotspot as BranchId] : "#fff",
                                opacity: isGenerating ? 0.5 : 1,
                            }}
                        >
                            <RepeatIcon style={{ fontSize: 26 }} />
                        </div>
                    </HintPill>
                )}

                {/* --- AUTO-LOOP BUTTON (between loop and play) ---
                    Node-level, so always visible: when this scene's video ends the
                    interaction travels to the chosen node automatically, with no
                    click. Mutually exclusive with the autoPlay video beside it. */}
                <HintPill
                    label={
                        autoLoopIsBroken
                            ? "Auto loop target missing"
                            : autoLoopEntry
                                ? `Autoplay history · ${autoLoopEntry.label}`
                                : "Autoplay history"
                    }
                    placement="bottom"
                >
                    <div
                        onClick={(e) => { e.stopPropagation(); if (!isGenerating) setNodePickerMode("autoLoop"); }}
                        style={{
                            width: 56, height: 56, borderRadius: "50%",
                            border: autoLoopIsBroken
                                ? "2px solid #f44336"
                                : autoLoopTargetId ? "2px solid #4caf50" : "2px dashed rgba(255,255,255,0.7)",
                            background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: isGenerating ? "not-allowed" : "pointer",
                            overflow: "hidden", position: "relative",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                            color: autoLoopIsBroken ? "#f44336" : autoLoopTargetId ? "#4caf50" : "#fff",
                            opacity: isGenerating ? 0.5 : 1,
                        }}
                    >
                        {autoLoopEntry?.node.mainSrc ? (
                            <>
                                <video
                                    src={`${autoLoopEntry.node.mainSrc}#t=0.001`}
                                    muted playsInline loop autoPlay
                                    style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.55 }}
                                />
                                <SkipNextIcon style={{ fontSize: 26, position: "absolute", color: "#4caf50" }} />
                            </>
                        ) : (
                            <SkipNextIcon style={{ fontSize: 28 }} />
                        )}
                    </div>
                </HintPill>

                <HintPill label="Auto play new node" placement="bottom">
                <div
                    onClick={(e) => { e.stopPropagation(); setPickerOpenSide("autoPlay"); }}
                    style={{
                        width: 56, height: 56, borderRadius: "50%",
                        border: currentNode.autoPlaySrc ? `2px solid #4caf50` : "2px dashed rgba(255,255,255,0.7)",
                        background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", overflow: "hidden", position: "relative",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                    }}
                >
                    {currentNode.autoPlaySrc ? (
                        <video
                            src={`${currentNode.autoPlaySrc}#t=0.001`}
                            muted playsInline loop autoPlay
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                    ) : (
                        <div style={{
                            width: 0, height: 0,
                            borderTop: "8px solid transparent",
                            borderBottom: "8px solid transparent",
                            borderLeft: "14px solid #fff",
                            marginLeft: 4
                        }} />
                    )}
                </div>
                </HintPill>
              </div>
                {currentNode.autoPlaySrc && !isMaxDepth && (
                    <HintPill label="Edit autoplay node" placement="bottom">
                    <div
                        onClick={(e) => { e.stopPropagation(); !isGenerating && handleDrillDown("autoPlay"); }}
                        style={{
                            padding: "6px 12px", borderRadius: 20, background: "#4caf50",
                            color: "#fff", fontSize: 10, fontWeight: 700,
                            cursor: isGenerating ? 'not-allowed' : "pointer",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.4)", display: "flex", alignItems: "center", gap: 4,
                            opacity: isGenerating ? 0.5 : 1
                        }}
                    >
                        ENTER <ArrowForwardIosIcon style={{ fontSize: 10 }} />
                    </div>
                    </HintPill>
                )}
            </div>

            {/* --- BACK / CONTEXT BUTTON --- */}
            <div style={{ 
                position: "absolute", top: 16, left: 16, zIndex: 11, display: "flex", flexDirection: "column", gap: 8,
                opacity: isHUDHidden ? 0 : 1, transition: "opacity 0.3s ease", pointerEvents: isHUDHidden ? "none" : "auto"
            }}>
                <HintPill label={isRoot ? "Exit editor" : "Back to parent node"} placement="right">
                <button
                    onClick={() => !isGenerating && handleBackUp()}
                    style={{
                        width: 44, height: 44, borderRadius: 12,
                        border: "2px solid rgba(255,255,255,0.9)",
                        background: "rgba(0,0,0,0.35)", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: isGenerating ? 'not-allowed' : "pointer",
                        backdropFilter: "blur(2px)",
                        opacity: isGenerating ? 0.5 : 1 // 🛑 VISUAL CUE
                    }}
                >
                    <ArrowBackIosNewIcon style={{ fontSize: 20 }} />
                </button>
                </HintPill>

                {/* Level Indicator / Main Swapper (Middle Left) */}
                {path.length > 0 && (
                    <HintPill label="Swap scene video" placement="right">
                    <div
                        onClick={() => setPickerOpenSide("main")}
                        style={{
                            width: 44, height: 44, borderRadius: "50%",
                            border: "1px solid rgba(255,255,255,0.5)",
                            background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", marginTop: 12
                        }}
                    >
                        <video
                            src={`${currentNode.mainSrc}#t=0.001`}
                            muted playsInline
                            style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", opacity: 0.7 }}
                        />
                    </div>
                    </HintPill>
                )}
            </div>

            {/* --- VIDEO PICKER BACKDROP --- */}
            {pickerOpenSide && (
                <div 
                    onClick={() => setPickerOpenSide(null)}
                    style={{ 
                        position: matchMobile ? 'absolute' : 'fixed', 
                        inset: 0, 
                        zIndex: 19, 
                        cursor: "pointer",
                        background: "rgba(0,0,0,0.3)",
                        backdropFilter: "blur(4px)"
                    }}
                />
            )}

            {/* --- VIDEO PICKER CONTAINER --- */}
            {mediaPickerMounted && (
                <div
                    className="hide-scrollbar"
                    style={{
                        // Hidden, not unmounted — see mediaPickerMounted above.
                        visibility: pickerOpenSide ? "visible" : "hidden",
                        pointerEvents: pickerOpenSide ? "auto" : "none",
                        position: matchMobile ? "absolute" : "fixed",
                        ...(matchMobile 
                            ? { top: 0, right: 0, bottom: 0, width: "50%", flexDirection: "column", overflowY: "auto", borderLeft: "1px solid rgba(255,255,255,0.2)" }
                            : { top: 0, left: 0, right: 0, height: "55vh", flexDirection: "row", overflowX: "auto", borderBottom: "1px solid rgba(255,255,255,0.2)" }
                        ),
                        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)",
                        zIndex: 20, display: "flex", gap: 16,
                        padding: matchMobile ? "60px 0 20px 0" : "0 20px",
                        alignItems: "center"
                    }}
                >



                    <div style={{ 
                        textAlign: "center", color: "#fff", fontSize: 12, fontWeight: 700, 
                        marginBottom: matchMobile ? 4 : 0,
                        marginRight: matchMobile ? 0 : 16,
                        whiteSpace: "nowrap"
                    }}>
                        {pickerLane
                            ? (pickerLaneIsPayoff
                                ? `${pickerLane.toUpperCase()} Result`
                                : `${pickerLane.toUpperCase()} Hold`)
                            : pickerOpenSide === "main" ? "Set Main" : "Select Sub"}
                    </div>

                    {videosForPicker.map((vid, idx) => {
                        const isSelected =
                            pickerLane
                                ? (pickerLaneIsPayoff
                                    // autoPlaySrc, not children.autoPlay.mainSrc —
                                    // clearing a payoff keeps the child node but
                                    // deactivates the cut, and only the live value
                                    // should read as selected.
                                    ? pickerLaneAction?.autoPlaySrc === vid
                                    : pickerLaneAction?.mainSrc === vid)
                                : pickerOpenSide === "main"
                                    ? currentNode.mainSrc === vid
                                    : pickerOpenSide === "autoPlay"
                                        ? currentNode.autoPlaySrc === vid
                                        : pickerBranchIndex !== null && currentNode.subs[pickerBranchIndex] === vid;

                        return (
                            <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flexShrink: 0 }}>
                                <div
                                    onClick={() => handleVideoSelect(vid)}
                                    style={{
                                        width: matchMobile ? "35vw" : "28vh",
                                        height: matchMobile ? "35vw" : "28vh",
                                        aspectRatio: "1:1",
                                        borderRadius: "50%",
                                        overflow: "hidden",
                                        border: isSelected ? `2px solid ${pickerBranch ? branchColors[pickerBranch] : "#4caf50"}` : "1px solid rgba(255,255,255,0.3)",
                                        transform: isSelected ? "scale(1.2)" : "scale(1)",
                                        transition: "transform 0.2s ease, border 0.2s ease",
                                        cursor: "pointer", position: "relative",
                                    }}
                                >
                                    <video
                                        ref={(el) => {
                                            if (el) {
                                                // Only autoplay while the picker is actually visible.
                                                if (isSelected && pickerOpenSide) {
                                                    if (el.paused) el.play().catch(() => {});
                                                } else {
                                                    if (!el.paused && !el.matches(":hover")) {
                                                        el.pause();
                                                        el.currentTime = 0;
                                                    }
                                                }
                                            }
                                        }}
                                        src={`${vid}#t=0.001`}
                                        preload="metadata"
                                        muted loop playsInline
                                        onMouseEnter={(e) => {
                                            const v = e.target as HTMLVideoElement;
                                            v.play().catch(() => {});
                                        }}
                                        onMouseLeave={(e) => {
                                            if (isSelected) return;
                                            const v = e.target as HTMLVideoElement;
                                            v.pause();
                                            v.currentTime = 0;
                                        }}
                                        style={{ width: "100%", height: "100%", objectFit: 'cover', display: "block" }}
                                    />
                                </div>
                                
                                {/* NEW: Edit Custom Text Button below the selected sub-video (Hotspots only) */}
                                {isSelected && pickerBranch && pickerBranchHotspot && (
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const activeHs = currentNode.hotspots[BRANCH_INDEX[pickerBranch]];
                                            setEditingTextSide(pickerBranch);
                                            setEditingTextValue(activeHs.customText || "CLIK");
                                        }}
                                        style={{
                                            color: "#fff", fontWeight: 700, fontSize: "14px", cursor: "pointer",
                                            background: "rgba(255, 255, 255, 0.15)", padding: "8px 16px", borderRadius: 20,
                                            textTransform: "uppercase",
                                            border: `1px solid ${branchColors[pickerBranch]}`,
                                            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                                            marginTop: matchMobile ? 24 : 32
                                        }}
                                    >
                                        {pickerBranchHotspot.customText || "CLIK"}
                                    </div>
                                )}

                                {/* VICTORY BUTTON (Hotspots & AutoPlay) */}
                                {isSelected && (pickerBranch || pickerOpenSide === "autoPlay" || pickerLane) && (
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (pickerLane) {
                                                toggleLaneVictory();
                                            } else if (pickerOpenSide === "autoPlay") {
                                                updateCurrentNode({ autoPlayIsVictory: !currentNode.autoPlayIsVictory });
                                            } else {
                                                const idx = BRANCH_INDEX[pickerBranch!];
                                                const newHotspots = [...currentNode.hotspots] as BranchTuple<Hotspot>;
                                                newHotspots[idx] = { ...newHotspots[idx], isVictory: !newHotspots[idx].isVictory };
                                                updateCurrentNode({ hotspots: newHotspots });
                                            }
                                        }}
                                        style={{
                                            color: "#fff", fontWeight: 700, fontSize: "12px", cursor: "pointer",
                                            background: pickerIsVictory ? (darkModeReducer ? "#E8BAFA" : "#0099cc") : "transparent",
                                            padding: "6px 14px", borderRadius: 16,
                                            textTransform: "uppercase",
                                            border: `1px dashed ${pickerIsVictory ? "transparent" : "rgba(255,255,255,0.6)"}`,
                                            boxShadow: pickerIsVictory ? "0 4px 12px rgba(0,0,0,0.5)" : "none",
                                            marginTop: (pickerOpenSide === "autoPlay") ? (matchMobile ? 24 : 32) : 8
                                        }}
                                    >
                                        {pickerIsVictory ? "🏆 VICTORY" : "MAKE VICTORY"}
                                    </div>
                                )}

                                {/* Victory on the ACTION clip silently stops abandoned
                                    drags counting as failures — consumeFailedRouteIfNeeded
                                    self-gates on victory and would read the route as good.
                                    It belongs on RESULT. */}
                                {isSelected && pickerLane && !pickerLaneIsPayoff && pickerIsVictory && (
                                    <div style={{
                                        maxWidth: 150, textAlign: "center", fontSize: 9, lineHeight: 1.3,
                                        color: "#ffb300", marginTop: 6,
                                    }}>
                                        ⚠ victory here stops fumbles counting — put it on RESULT
                                    </div>
                                )}

                                {/* ENTER a lane node straight from the picker, matching
                                    the autoPlay shortcut below. */}
                                {isSelected && pickerLane && !pickerLaneIsPayoff && !isMaxDepth && (
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (isGenerating) return;
                                            setPickerOpenSide(null);
                                            handleDrillDown(LANE_PATH[pickerLane]);
                                        }}
                                        style={{
                                            padding: "8px 16px", borderRadius: 20,
                                            background: pickerLane === "left" ? LEFT_COLOR : RIGHT_COLOR,
                                            color: darkModeReducer ? "#000" : "#fff", fontSize: 11, fontWeight: 700,
                                            cursor: isGenerating ? "not-allowed" : "pointer",
                                            marginTop: 8, display: "flex", alignItems: "center", gap: 4,
                                        }}
                                    >
                                        ENTER <ArrowForwardIosIcon style={{ fontSize: 10 }} />
                                    </div>
                                )}

                                {/* ENTER for the autoplay node, here as well as under
                                    the play circle — the picker sits above those
                                    controls, so this saves closing it first. */}
                                {isSelected && pickerOpenSide === "autoPlay" && !isMaxDepth && (
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (isGenerating) return;
                                            setPickerOpenSide(null);
                                            handleDrillDown("autoPlay");
                                        }}
                                        style={{
                                            padding: "8px 16px", borderRadius: 20, background: "#4caf50",
                                            color: "#fff", fontSize: 11, fontWeight: 700,
                                            cursor: isGenerating ? "not-allowed" : "pointer",
                                            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                                            display: "flex", alignItems: "center", gap: 4,
                                            opacity: isGenerating ? 0.5 : 1,
                                            marginTop: 8
                                        }}
                                    >
                                        ENTER <ArrowForwardIosIcon style={{ fontSize: 10 }} />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* --- LOOP NODE PICKER --- */}
            {loopPickerMounted && (pickerIsAutoLoop || selectedHotspot) && (
                <>
                    {loopPickerOpen && (
                        <div
                            onClick={() => setNodePickerMode(null)}
                            style={{
                                position: matchMobile ? "absolute" : "fixed",
                                inset: 0, zIndex: 19, cursor: "pointer",
                                background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)"
                            }}
                        />
                    )}
                    <div
                        className="hide-scrollbar"
                        style={{
                            // Hidden, not unmounted — keeps thumbnails loaded.
                            visibility: loopPickerOpen ? "visible" : "hidden",
                            pointerEvents: loopPickerOpen ? "auto" : "none",
                            position: matchMobile ? "absolute" : "fixed",
                            ...(matchMobile
                                ? { top: 0, right: 0, bottom: 0, width: "50%", flexDirection: "column", overflowY: "auto", borderLeft: "1px solid rgba(255,255,255,0.2)" }
                                : { top: 0, left: 0, right: 0, height: "55vh", flexDirection: "row", overflowX: "auto", borderBottom: "1px solid rgba(255,255,255,0.2)" }
                            ),
                            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)",
                            zIndex: 20, display: "flex", gap: 16,
                            padding: matchMobile ? "60px 0 20px 0" : "0 20px",
                            alignItems: "center"
                        }}
                    >
                        <div style={{
                            textAlign: "center", color: "#fff", fontSize: 12, fontWeight: 700,
                            marginBottom: matchMobile ? 4 : 0,
                            marginRight: matchMobile ? 0 : 16,
                            whiteSpace: "nowrap"
                        }}>
                            {pickerIsAutoLoop ? "Auto Loop To Node" : "Loop To Node"}
                        </div>

                        {allNodes.map((option) => {
                            const isLinked = pickerLinkedId === option.id;
                            const isCurrent = option.id === currentNode.id;
                            return (
                                <div key={option.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flexShrink: 0 }}>
                                    <div
                                        onClick={() => assignNodePickerTarget(isLinked ? null : option.id)}
                                        style={{
                                            width: matchMobile ? "35vw" : "28vh",
                                            height: matchMobile ? "35vw" : "28vh",
                                            borderRadius: "50%",
                                            overflow: "hidden",
                                            border: isLinked
                                                ? `2px solid ${pickerAccent}`
                                                : "1px solid rgba(255,255,255,0.3)",
                                            transform: isLinked ? "scale(1.2)" : "scale(1)",
                                            transition: "transform 0.2s ease, border 0.2s ease",
                                            cursor: "pointer", position: "relative",
                                        }}
                                    >
                                        {option.mainSrc ? (
                                            <video
                                                src={`${option.mainSrc}#t=0.001`}
                                                preload="metadata"
                                                muted loop playsInline
                                                onMouseEnter={(e) => { (e.target as HTMLVideoElement).play().catch(() => { }); }}
                                                onMouseLeave={(e) => {
                                                    if (isLinked) return;
                                                    const v = e.target as HTMLVideoElement;
                                                    v.pause(); v.currentTime = 0;
                                                }}
                                                ref={(el) => {
                                                    if (!el) return;
                                                    if (isLinked && loopPickerOpen) {
                                                        if (el.paused) el.play().catch(() => { });
                                                    } else if (!el.paused && !el.matches(":hover")) {
                                                        el.pause(); el.currentTime = 0;
                                                    }
                                                }}
                                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                                            />
                                        ) : (
                                            <div style={{ width: "100%", height: "100%", background: "rgba(255,255,255,0.08)" }} />
                                        )}
                                    </div>

                                    <div style={{
                                        color: "#fff", fontWeight: 700, fontSize: 12,
                                        textAlign: "center", whiteSpace: "nowrap",
                                        opacity: isCurrent ? 0.75 : 1
                                    }}>
                                        {option.label}
                                        {isCurrent && (
                                            <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.8 }}>
                                                current — replay
                                            </div>
                                        )}
                                        {isLinked && (
                                            <div style={{ fontSize: 10, fontWeight: 800, color: pickerAccent }}>
                                                {pickerIsAutoLoop ? "AUTO" : "LINKED"}
                                            </div>
                                        )}
                                    </div>

                                    {/* Custom circle text. A loop-only hotspot has no
                                        selected video in the media picker, so this is
                                        its only route to the CLIK label editor.
                                        Auto-loop has no circle, so no label. */}
                                    {isLinked && !pickerIsAutoLoop && selectedHotspot && (
                                        <div
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const hs = currentNode.hotspots[BRANCH_INDEX[selectedHotspot]];
                                                setEditingTextSide(selectedHotspot);
                                                setEditingTextValue(hs.customText || "CLIK");
                                            }}
                                            style={{
                                                color: "#fff", fontWeight: 700, fontSize: "14px", cursor: "pointer",
                                                background: "rgba(255, 255, 255, 0.15)", padding: "8px 16px", borderRadius: 20,
                                                textTransform: "uppercase",
                                                border: `1px solid ${pickerAccent}`,
                                                boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                                                marginTop: 4
                                            }}
                                        >
                                            {currentNode.hotspots[BRANCH_INDEX[selectedHotspot]].customText || "CLIK"}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {pickerLinkedId && (
                            <div
                                onClick={() => assignNodePickerTarget(null)}
                                style={{
                                    flexShrink: 0, color: "#fff", fontWeight: 700, fontSize: 12,
                                    padding: "10px 18px", borderRadius: 20, cursor: "pointer",
                                    border: "1px dashed rgba(255,255,255,0.6)", whiteSpace: "nowrap",
                                    marginLeft: 8
                                }}
                            >
                                REMOVE LOOP
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* --- SVG CLIP PATHS --- */}
            <svg width="0" height="0" style={{ position: 'absolute' }}>
                {visibleBranches.map((branch) => {
                    const hotspot = currentNode.hotspots[BRANCH_INDEX[branch]];
                    return hotspot.svgPath ? (
                        <clipPath key={branch} id={`ai-mask-${branch}`} clipPathUnits="objectBoundingBox">
                            <path transform={`scale(${1 / (hotspot.maskWidth || 1080)}, ${1 / (hotspot.maskHeight || 1920)})`} d={hotspot.svgPath} />
                        </clipPath>
                    ) : null;
                })}
            </svg>

            {/* --- AI MASKS (Neon Outlines) --- */}
            {visibleBranches.map((branch) => {
                const hotspot = currentNode.hotspots[BRANCH_INDEX[branch]];
                return hotspot.svgPath ? (
                    <svg key={branch} preserveAspectRatio="xMidYMid slice" viewBox={`0 0 ${hotspot.maskWidth || 1080} ${hotspot.maskHeight || 1920}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 5 }}>
                        <path d={hotspot.svgPath} fill={branchFills[branch]} stroke={branchColors[branch]} strokeWidth="4" />
                    </svg>
                ) : null;
            })}

            {/* --- LENSES (Anchor Points) --- */}
            {visibleBranches.map((branch) => renderLens(currentNode.hotspots[BRANCH_INDEX[branch]], branch))}

            {/* --- DRAG & HOLD LANE PANEL ---
                Two panels, four circles. Per lane the ACTION clip is the large
                circle (what the viewer drives) and the PAYOFF sits smaller above
                it, reading upward as "this leads to that" — a destination
                diagram, not a timeline. */}
            {dragModeOn && !isHUDHidden && (
                <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: "absolute",
                        left: 0, right: 0, bottom: 96,
                        display: "flex", justifyContent: "center", gap: matchMobile ? 18 : 48,
                        zIndex: 9, pointerEvents: "auto",
                    }}
                >
                    {LANE_IDS.map((lane) => {
                        const action = laneActionNode(currentNode, lane);
                        const color = lane === "left" ? LEFT_COLOR : RIGHT_COLOR;
                        const fill = lane === "left" ? LEFT_FILL : RIGHT_FILL;
                        const actionSrc = action?.mainSrc || "";
                        // ✅ autoPlaySrc ONLY. Clearing a payoff deactivates the cut
                        // but deliberately keeps children.autoPlay — the subtree stays
                        // editable and loop-targetable, exactly as an ordinary autoPlay
                        // does. Falling back to payoff.mainSrc therefore kept showing a
                        // video the creator had just removed from inside the node.
                        const payoffSrc = action?.autoPlaySrc || "";
                        const bigSize = matchMobile ? 104 : 128;
                        const smallSize = Math.round(bigSize * 0.8);

                        const circle = (
                            src: string,
                            size: number,
                            slot: LaneSlot,
                            caption: string
                        ) => (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                <div
                                    onClick={(e) => { e.stopPropagation(); setPickerOpenSide(slot); }}
                                    style={{
                                        width: size, height: size, borderRadius: "50%",
                                        border: src ? `3px solid ${color}` : `3px dashed ${color}`,
                                        background: src ? "rgba(0,0,0,0.6)" : fill,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        cursor: isGenerating ? "not-allowed" : "pointer",
                                        overflow: "hidden", position: "relative",
                                        boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                                    }}
                                >
                                    {src ? (
                                        <video
                                            src={src}
                                            muted
                                            playsInline
                                            preload="metadata"
                                            onMouseEnter={(e) => { void (e.currentTarget as HTMLVideoElement).play().catch(() => { }); }}
                                            onMouseLeave={(e) => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                        />
                                    ) : (
                                        <span style={{ fontSize: 30, color, opacity: 0.85 }}>+</span>
                                    )}
                                </div>
                                <span style={{
                                    fontSize: 9, fontWeight: 800, letterSpacing: 0.6,
                                    color, textShadow: "0 1px 4px rgba(0,0,0,0.8)",
                                }}>
                                    {caption}
                                </span>
                            </div>
                        );

                        return (
                            <div key={lane} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                                {circle(payoffSrc, smallSize, `lanePayoff:${lane}`, "RESULT")}
                                <span style={{ color, opacity: 0.75, fontSize: 14, lineHeight: 1 }}>▲</span>
                                {circle(actionSrc, bigSize, `laneAction:${lane}`, `${lane.toUpperCase()} · HOLD`)}

                                {/* ENTER the action node. Its payoff is entered from inside it. */}
                                {actionSrc && !isMaxDepth && (
                                    <div
                                        onClick={(e) => { e.stopPropagation(); !isGenerating && handleDrillDown(LANE_PATH[lane]); }}
                                        style={{
                                            marginTop: 2, padding: "6px 14px", borderRadius: 20, background: color,
                                            color: darkModeReducer ? "#000" : "#fff", fontSize: 10, fontWeight: 700,
                                            cursor: isGenerating ? "not-allowed" : "pointer",
                                            display: "flex", alignItems: "center", gap: 4,
                                            opacity: isGenerating ? 0.5 : 1,
                                        }}
                                    >
                                        ENTER <ArrowForwardIosIcon style={{ fontSize: 9 }} />
                                    </div>
                                )}

                                {/* An empty lane is not broken — it replays this node. Say so. */}
                                {!actionSrc && (
                                    <span style={{
                                        fontSize: 8, maxWidth: 118, textAlign: "center", lineHeight: 1.3,
                                        color: "rgba(255,255,255,0.75)", textShadow: "0 1px 4px rgba(0,0,0,0.9)",
                                    }}>
                                        empty — replays this scene
                                    </span>
                                )}

                                {/* Victory belongs on the payoff. On the action clip it
                                    silently stops abandoned drags counting as failures,
                                    because the failure detector self-gates on victory. */}
                                {actionSrc && action?.hotspots?.[BRANCH_INDEX[lane]]?.isVictory && (
                                    <span style={{
                                        fontSize: 8, maxWidth: 118, textAlign: "center", lineHeight: 1.3,
                                        color: "#ffb300", textShadow: "0 1px 4px rgba(0,0,0,0.9)",
                                    }}>
                                        ⚠ victory on the action clip stops fumbles counting — put it on RESULT
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* --- AUDIO BUTTONS MOVED TO LENS CONTROLS --- */}


            {/* --- PREVIEW BUTTON --- */}
            <HintPill
                label="Preview interaction"
                placement="top"
                wrapperStyle={{ position: "absolute", bottom: 16, right: 16, zIndex: 11 }}
            >
            <button
                onClick={goToPreview}
                style={{
                    width: 44, height: 44, borderRadius: 12,
                    border: "2px solid rgba(255,255,255,0.9)",
                    background: "rgba(0,0,0,0.35)", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", backdropFilter: "blur(2px)",
                    opacity: isHUDHidden ? 0 : 1, transition: "opacity 0.3s ease", pointerEvents: isHUDHidden ? "none" : "auto",
                    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                }}
            >
                <VisibilityIcon style={{ fontSize: 20 }} />
            </button>
            </HintPill>

            {/* --- JOYSTICK TOGGLE (Drag & Hold mode) ---
                Bottom-left, stacked ABOVE the Add-hotspot +. They only compete
                in one state — mode off with hotspots left to reveal — because
                turning the Joystick on takes the + away with everything else.
                Hidden inside a lane action node: a drag cannot contain a drag. */}
            {!isLaneActionNode && (
                <HintPill
                    label={dragModeOn
                        ? "Back to hotspots"
                        : hasLanes ? "Drag & Hold — live on this scene" : "Drag & Hold"}
                    placement="right"
                    wrapperStyle={{
                        position: "absolute",
                        bottom: canAddHotspot && !dragModeOn ? 86 : 16,
                        left: 16,
                        zIndex: 11,
                    }}
                >
                    <IconButton
                        aria-label="Toggle Drag and Hold mode"
                        onClick={(event) => {
                            event.stopPropagation();
                            toggleDragMode();
                        }}
                        style={{
                            width: 58,
                            height: 58,
                            borderRadius: "50%",
                            // Solid while the panel is open. Solid-but-dimmer when
                            // the panel is closed and lanes are still live — the
                            // viewer gets a DRAG circle on this scene either way,
                            // so a plain dashed button would misrepresent it.
                            border: dragModeOn
                                ? `3px solid ${LEFT_COLOR}`
                                : hasLanes
                                    ? `3px solid ${LEFT_COLOR}88`
                                    : "3px dashed rgba(255,255,255,0.92)",
                            background: dragModeOn || hasLanes ? LEFT_FILL : "rgba(0,0,0,0.38)",
                            color: dragModeOn || hasLanes ? LEFT_COLOR : "#fff",
                            backdropFilter: "blur(4px)",
                            boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                            opacity: isHUDHidden ? 0 : 1,
                            pointerEvents: isHUDHidden || isGenerating ? "none" : "auto",
                        }}
                    >
                        <GamepadIcon style={{ fontSize: 30 }} />
                    </IconButton>
                </HintPill>
            )}

            {canAddHotspot && !dragModeOn && !isLaneActionNode && (
                <HintPill
                    label="Add hotspot"
                    placement="top"
                    wrapperStyle={{ position: "absolute", bottom: 16, left: 16, zIndex: 11 }}
                >
                    <IconButton
                        aria-label="Add hotspot"
                        onClick={(event) => {
                            event.stopPropagation();
                            revealNextHotspot();
                        }}
                        style={{
                            width: 58,
                            height: 58,
                            borderRadius: "50%",
                            border: "3px dashed rgba(255,255,255,0.92)",
                            background: "rgba(0,0,0,0.38)",
                            color: "#fff",
                            backdropFilter: "blur(4px)",
                            boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                            opacity: isHUDHidden ? 0 : 1,
                            pointerEvents: isHUDHidden ? "none" : "auto",
                        }}
                    >
                        <AddIcon style={{ fontSize: 30 }} />
                    </IconButton>
                </HintPill>
            )}

            {/* --- CUSTOM TEXT EDITOR MODAL --- */}
            {editingTextSide && (
                <div
                    onClick={() => setEditingTextSide(null)}
                    style={{
                        position: "fixed", inset: 0, zIndex: 99999,
                        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
                        display: "flex", alignItems: "center", justifyContent: "center"
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: darkModeReducer ? "#222" : "#fff",
                            padding: 24, borderRadius: 16, width: "80%", maxWidth: 320,
                            display: "flex", flexDirection: "column", gap: 16,
                            boxShadow: "0 8px 32px rgba(0,0,0,0.5)"
                        }}
                    >
                        <div style={{ color: darkModeReducer ? "#fff" : "#000", fontWeight: 700, fontSize: 18, textAlign: "center" }}>
                            Customize Circle Text
                        </div>
                        <input
                            value={editingTextValue}
                            onChange={(e) => {
                                const val = e.target.value;
                                const words = val.split(/\s+/).filter(Boolean);
                                if (words.length <= 2) setEditingTextValue(val);
                                else setEditingTextValue(words.slice(0,2).join(" ") + " ");
                            }}
                            maxLength={15}
                            autoFocus
                            placeholder="CLIK"
                            style={{
                                padding: "12px 16px", borderRadius: 12, 
                                border: `2px solid ${darkModeReducer ? "#444" : "#ddd"}`,
                                background: darkModeReducer ? "#111" : "#fafafa",
                                color: darkModeReducer ? "#fff" : "#000",
                                fontSize: 16, outline: "none",
                                textAlign: "center", fontWeight: "bold", textTransform: "uppercase"
                            }}
                        />
                        <Button
                            variant="contained"
                            onClick={() => {
                                const newHotspots = [...currentNode.hotspots] as BranchTuple<Hotspot>;
                                const idx = BRANCH_INDEX[editingTextSide];
                                newHotspots[idx] = { ...newHotspots[idx], customText: editingTextValue.trim().toUpperCase() || "CLIK" };
                                updateCurrentNode({ hotspots: newHotspots });
                                setEditingTextSide(null);
                            }}
                            style={{
                                background: darkModeReducer ? "#4caf50" : "#2e7d32", 
                                color: "#fff", fontWeight: 800, padding: "10px 0", borderRadius: 12
                            }}
                        >
                            GO
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
};

export default TouchEditStageUI;