import React, { useCallback, useEffect, useRef, useState } from "react";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Button from "@mui/material/Button";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import { InteractionNode, Hotspot } from "./TouchPreviewStageUI"; // Shared types
import { useSelector } from "react-redux";
import { RootState } from "./store";
import { matchMobile } from "./DetectDevice";
import { Box, IconButton, Tooltip, CircularProgress, useTheme } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import axios from "axios";
import { Saveprompthelperfordellater } from "./SavepromptHelpersLocal";

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

interface TouchEditStageProps {
    backToDefault: () => void;
    goToPreview: () => void;

    // Inputs
    videoArray: string[]; // The 0-9 uploaded videos

    // The Tree State (Managed by Parent InteractInput)
    treeRoot: InteractionNode;
    setTreeRoot: React.Dispatch<React.SetStateAction<InteractionNode>>;

    // Legacy Props (synced to root for compatibility)
    hotspots: [Hotspot, Hotspot];
    setHotspots: React.Dispatch<React.SetStateAction<[Hotspot, Hotspot]>>;
    subs: [string, string]; // We use treeRoot for logic, but keep this for type safety

    // Audio props (Now supporting Arrays)
    sub1AudioUrl: any[] | any;
    sub2AudioUrl: any[] | any;
    // âœ… ADDED SETTERS to fix the bug
    setSub1AudioUrl: any;
    setSub2AudioUrl: any;
    setAddVoice: any;
    setIdentifier: any;

    // ðŸ›‘ NEW PROP: Pass your loading state here (e.g. isGenerating={isLoading})
    isGenerating: boolean;
    intbg: number
}

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
    // âœ… DESTRUCTURED SETTERS
    setSub1AudioUrl,
    setSub2AudioUrl,
    // ðŸ›‘ NEW PROP
    isGenerating,
    intbg
}) => {
    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);

    // Dynamic Theme Colors
    const LEFT_COLOR = darkModeReducer ? "#E8BAFA" : "#0099cc";
    const LEFT_FILL = darkModeReducer ? "rgba(232, 186, 250, 0.28)" : "rgba(0, 153, 204, 0.28)";
    const RIGHT_COLOR = darkModeReducer ? "#b3eefc" : "#ff9933";
    const RIGHT_FILL = darkModeReducer ? "rgba(179, 238, 252, 0.28)" : "rgba(255, 153, 51, 0.28)";

    // Navigation Path: [] = root, ['left'] = left child, ['left', 'right'] = ...
    const [path, setPath] = useState<Array<"left" | "right" | "autoPlay">>([]);

    // Drag State
    const [isDragging, setIsDragging] = useState(false);

    // Custom Text Edit State
    const [editingTextSide, setEditingTextSide] = useState<"left" | "right" | null>(null);
    const [editingTextValue, setEditingTextValue] = useState("");

    // UI State
    const [pickerOpenSide, setPickerOpenSide] = useState<"left" | "right" | "main" | "autoPlay" | null>(null);
    const [activeDragId, setActiveDragId] = useState<"left" | "right">("left");

    const layerRef = useRef<HTMLDivElement | null>(null);
    const mainVideoRef = useRef<HTMLVideoElement | null>(null);
    const leftLensRef = useRef<HTMLVideoElement | null>(null);
    const rightLensRef = useRef<HTMLVideoElement | null>(null);

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
                        mainSrc: dir === "autoPlay" ? ptr.autoPlaySrc || "" : ptr.subs[dir === "left" ? 0 : 1],
                        subs: ["", ""],
                        hotspots: [{ id: "left", x: 0.25, y: 0.5, r: 0.15 }, { id: "right", x: 0.75, y: 0.5, r: 0.15 }],
                        // âœ… INITIALIZE AUDIO AS ARRAYS
                        audio: { main: [], left: [], right: [] }
                    } as InteractionNode;
                }
                ptr.children[dir] = { ...ptr.children[dir]! };
                ptr = ptr.children[dir]!;
            }

            // Apply updates
            Object.assign(ptr, updates);

            // âœ… SYNC: If we are at Root, update the parent flat state for saving compatibility
            if (path.length === 0) {
                if (updates.hotspots) {
                    setHotspots(updates.hotspots as [Hotspot, Hotspot]);
                }
            }
            return newRoot;
        });
    }, [path, setHotspots, setTreeRoot]);

    // --- AUDIO SYNC LOOP (FIXED) ---
    // âœ… Watches for changes in props (from TextToSpeech modal) and saves them to the Tree Node as Arrays
    useEffect(() => {
        if (!currentNode) return;

        const newAudioState = { ...currentNode.audio };
        let hasChange = false;

        // Helper to normalize to array
        const toArray = (val: any) => (Array.isArray(val) ? val : val ? [val] : []);

        const incomingLeft = toArray(sub1AudioUrl);
        const incomingRight = toArray(sub2AudioUrl);

        // ðŸ›‘ SAFETY GUARD:
        // If BOTH inputs are empty, we assume we just navigated/reset.
        // We do NOT wipe the node's audio in this case.
        if (incomingLeft.length === 0 && incomingRight.length === 0) {
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

        if (hasChange) {
            updateCurrentNode({ audio: newAudioState });
        }
    }, [sub1AudioUrl, sub2AudioUrl, updateCurrentNode, currentNode]);
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

        // ðŸ›‘ FIX: If we navigated to a new node, or the desired src changed, we MUST force the video to restart.
        // If the user selects the EXACT SAME video for the downstream node, it previously ignored it and just continued playing.
        if (isNewNode || main.getAttribute("src") !== desiredSrc) {
            main.src = desiredSrc;
            main.currentTime = 0; // Force restart from beginning
            main.load();
            main.play().catch(() => { });
        }

        let rafId: number;
        const sync = () => {
            // ðŸ›‘ FIX: React's parent component (InteractInput) can sometimes re-render and overwrite the src with the root vid1.
            // We detect this by checking if the attribute was reverted to treeRoot.mainSrc, and if so, we safely force it back to desiredSrc.
            if (desiredSrc !== treeRoot.mainSrc && main.getAttribute("src") === treeRoot.mainSrc) {
                main.src = desiredSrc;
                main.load();
                main.play().catch(() => { });
            }

            const t = main.currentTime;
            // Force play if paused unintentionally
            if (leftLensRef.current && leftLensRef.current.paused) leftLensRef.current.play().catch(() => { });
            if (rightLensRef.current && rightLensRef.current.paused) rightLensRef.current.play().catch(() => { });

            if (leftLensRef.current) leftLensRef.current.currentTime = t;
            if (rightLensRef.current) rightLensRef.current.currentTime = t;
            rafId = requestAnimationFrame(sync);
        };
        rafId = requestAnimationFrame(sync);
        return () => cancelAnimationFrame(rafId);
    }, [currentNode.mainSrc]); // Only re-run if the main video source changes (navigation)

    // --- OPTION 1.5: AI SHAPE DETECTION (SAM) ---
    const [isScanningShape, setIsScanningShape] = useState<"left" | "right" | null>(null);

    const captureFrameAndSegment = async (side: "left" | "right") => {
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
            const hs = currentNode.hotspots[side === "left" ? 0 : 1];

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
                const newHotspots = [...currentNode.hotspots] as [Hotspot, Hotspot];
                const idx = side === "left" ? 0 : 1;
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

    const handleVideoSelect = (vidUrl: string) => {
        if (!pickerOpenSide) return;

        if (pickerOpenSide === "main") {
            if (currentNode.mainSrc === vidUrl) updateCurrentNode({ mainSrc: "" });
            else updateCurrentNode({ mainSrc: vidUrl });
        } else if (pickerOpenSide === "autoPlay") {
            if (currentNode.autoPlaySrc === vidUrl) updateCurrentNode({ autoPlaySrc: "" });
            else updateCurrentNode({ autoPlaySrc: vidUrl });
        } else {
            const idx = pickerOpenSide === "left" ? 0 : 1;
            const newSubs = [...currentNode.subs] as [string, string];
            if (newSubs[idx] === vidUrl) newSubs[idx] = "";
            else newSubs[idx] = vidUrl;
            updateCurrentNode({ subs: newSubs });
        }
    };

    const handleDrillDown = (side: "left" | "right" | "autoPlay") => {
        // ðŸ›‘ RACE PREVENTION: Do not allow drill down if generating
        if (isGenerating) return;

        const subUrl = side === "autoPlay" ? currentNode.autoPlaySrc : currentNode.subs[side === "left" ? 0 : 1];
        if (!subUrl) return;

        // 1. Capture the audio we want to pass down (INHERITANCE)
        const inheritedAudio = side === "left"
            ? currentNode.audio?.left
            : (side === "right" ? currentNode.audio?.right : undefined);

        // ðŸ›‘ FIX: Clear props immediately so old audio doesn't "stick" to new node
        setSub1AudioUrl([]);
        setSub2AudioUrl([]);

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
                        mainSrc: dir === "autoPlay" ? ptr.autoPlaySrc || "" : ptr.subs[dir === "left" ? 0 : 1],
                        subs: ["", ""],
                        hotspots: [{ id: "left", x: 0.25, y: 0.5, r: 0.15 }, { id: "right", x: 0.75, y: 0.5, r: 0.15 }],
                        audio: { main: [], left: [], right: [] }
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
                    subs: ["", ""],
                    hotspots: [{ id: "left", x: 0.25, y: 0.5, r: 0.15 }, { id: "right", x: 0.75, y: 0.5, r: 0.15 }],
                    audio: {
                        main: inheritedAudio || [], // <--- Set Audio Here (Inheritance)
                        left: [],
                        right: []
                    }
                };
            } else {
                // CASE B: EXISTING NODE (Update it!)
                ptr.children[side] = {
                    ...ptr.children[side],
                    mainSrc: subUrl, // Force update video
                    audio: {
                        ...ptr.children[side].audio,
                        // Force update Main audio (keep existing left/right)
                        main: inheritedAudio || []
                    }
                };
            }
            return newRoot;
        });

        setPath([...path, side]);
    };

    const handleBackUp = () => {
        // ðŸ›‘ RACE PREVENTION: Do not allow back nav if generating
        if (isGenerating) return;

        // ðŸ›‘ FIX: Clear props immediately on back too
        setSub1AudioUrl([]);
        setSub2AudioUrl([]);

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
    const [flippedControls, setFlippedControls] = useState({ left: false, right: false });

    // Hotspot Dragging Logic
    const dragStartRef = useRef<{ x: number, y: number, wasActive: boolean } | null>(null);

    const onPlace = (e: React.MouseEvent<HTMLDivElement>) => {
        hideHUDTemporarily();
        const idx = activeDragId === "left" ? 0 : 1;
        const activeHs = currentNode.hotspots[idx];
        if (activeHs.svgPath) return; // Prevent teleportation if scanned

        const el = layerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        // Clamp to 0-1
        const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

        const newHotspots = [...currentNode.hotspots] as [Hotspot, Hotspot];
        newHotspots[idx] = { ...newHotspots[idx], x: nx, y: ny, svgPath: undefined };
        updateCurrentNode({ hotspots: newHotspots });
    };

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, side: "left" | "right") => {
        hideHUDTemporarily();
        const hs = currentNode.hotspots[side === "left" ? 0 : 1];
        if (hs.svgPath) return; // Prevent drag if scanned
        e.stopPropagation();
        dragStartRef.current = { x: e.clientX, y: e.clientY, wasActive: activeDragId === side };
        setActiveDragId(side);
        setIsDragging(true);
        (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>, side: "left" | "right") => {
        const hs = currentNode.hotspots[side === "left" ? 0 : 1];
        if (hs.svgPath) return; // Prevent drag if scanned
        if (!isDragging || activeDragId !== side) return;
        const el = layerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

        const newHotspots = [...currentNode.hotspots] as [Hotspot, Hotspot];
        const idx = side === "left" ? 0 : 1;
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

    const renderLens = (hs: Hotspot, side: "left" | "right") => {
        const color = side === "left" ? LEFT_COLOR : RIGHT_COLOR;
        const isActive = activeDragId === side;
        const diameterPct = hs.r * 100;
        const idx = side === "left" ? 0 : 1;
        const hasVideo = !!currentNode.subs[idx];

        return (
            <div
                key={side}
                onClick={(e) => {
                    e.stopPropagation();
                    const wasActive = dragStartRef.current ? dragStartRef.current.wasActive : (activeDragId === side);
                    setActiveDragId(side);
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
                    background: hs.svgPath ? "transparent" : (isActive ? (side === "left" ? LEFT_FILL : RIGHT_FILL) : "rgba(0,0,0,0.1)"),
                    boxShadow: hs.svgPath ? "none" : "0 8px 24px rgba(0,0,0,0.45)",
                    zIndex: 6, cursor: hs.svgPath ? "default" : "grab",
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

                {/* Embedded Video Thumbnail */}
                {hasVideo ? (
                    <>
                        <video
                            src={currentNode.subs[idx]}
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
                                    const newHotspots = [...currentNode.hotspots] as [Hotspot, Hotspot];
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
                                width: 18,
                                height: 18,
                                borderRadius: "50%",
                                backgroundColor: color,
                                cursor: "pointer",
                                boxShadow: "0 2px 6px rgba(0,0,0,0.5)",
                                zIndex: 10,
                                border: "2px solid rgba(255,255,255,0.8)"
                            }}
                        />
                    </>
                )}
            </div>
        );
    };

    // Get list of videos to show in picker
    const videosForPicker = videoArray.slice(0, 9).filter(v => v);

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
                position: "absolute", top: 16, right: 16, zIndex: 11, display: "flex", flexDirection: "column", gap: 8, alignItems: "center",
                opacity: isHUDHidden ? 0 : 1, transition: "opacity 0.3s ease", pointerEvents: isHUDHidden ? "none" : "auto"
            }}>
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
                {currentNode.autoPlaySrc && !isMaxDepth && (
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
                )}
            </div>

            {/* --- BACK / CONTEXT BUTTON --- */}
            <div style={{
                position: "absolute", top: 16, left: 16, zIndex: 11, display: "flex", flexDirection: "column", gap: 8,
                opacity: isHUDHidden ? 0 : 1, transition: "opacity 0.3s ease", pointerEvents: isHUDHidden ? "none" : "auto"
            }}>
                <button
                    onClick={() => !isGenerating && handleBackUp()}
                    style={{
                        width: 44, height: 44, borderRadius: 12,
                        border: "2px solid rgba(255,255,255,0.9)",
                        background: "rgba(0,0,0,0.35)", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: isGenerating ? 'not-allowed' : "pointer",
                        backdropFilter: "blur(2px)",
                        opacity: isGenerating ? 0.5 : 1 // ðŸ›‘ VISUAL CUE
                    }}
                >
                    <ArrowBackIosNewIcon style={{ fontSize: 20 }} />
                </button>

                {/* Level Indicator / Main Swapper (Middle Left) */}
                {path.length > 0 && (
                    <div
                        onClick={() => setPickerOpenSide("main")}
                        style={{
                            width: 44, height: 44, borderRadius: "50%",
                            border: "1px solid rgba(255,255,255,0.5)",
                            background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            cursor: "pointer", marginTop: 12
                        }}
                        title="Swap Main Video for this Node"
                    >
                        <video
                            src={`${currentNode.mainSrc}#t=0.001`}
                            muted playsInline
                            style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", opacity: 0.7 }}
                        />
                    </div>
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
            {pickerOpenSide && (
                <div
                    className="hide-scrollbar"
                    style={{
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
                        {pickerOpenSide === "main" ? "Set Main" : "Select Sub"}
                    </div>

                    {videosForPicker.map((vid, idx) => {
                        const isSelected = pickerOpenSide === "main"
                            ? currentNode.mainSrc === vid
                            : (pickerOpenSide === "autoPlay"
                                ? currentNode.autoPlaySrc === vid
                                : (pickerOpenSide === "left" ? currentNode.subs[0] === vid : currentNode.subs[1] === vid));

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
                                        border: isSelected ? `2px solid ${pickerOpenSide === "right" ? RIGHT_COLOR : LEFT_COLOR}` : "1px solid rgba(255,255,255,0.3)",
                                        transform: isSelected ? "scale(1.2)" : "scale(1)",
                                        transition: "transform 0.2s ease, border 0.2s ease",
                                        cursor: "pointer", position: "relative",
                                    }}
                                >
                                    <video
                                        ref={(el) => {
                                            if (el) {
                                                if (isSelected) {
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
                                {isSelected && (pickerOpenSide === "left" || pickerOpenSide === "right") && (
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const activeHs = pickerOpenSide === "left" ? currentNode.hotspots[0] : currentNode.hotspots[1];
                                            setEditingTextSide(pickerOpenSide as "left" | "right");
                                            setEditingTextValue(activeHs.customText || "CLIK");
                                        }}
                                        style={{
                                            color: "#fff", fontWeight: 700, fontSize: "14px", cursor: "pointer",
                                            background: "rgba(255, 255, 255, 0.15)", padding: "8px 16px", borderRadius: 20,
                                            textTransform: "uppercase",
                                            border: `1px solid ${pickerOpenSide === "right" ? RIGHT_COLOR : LEFT_COLOR}`,
                                            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
                                            marginTop: matchMobile ? 24 : 32
                                        }}
                                    >
                                        { (pickerOpenSide === "left" ? currentNode.hotspots[0].customText : currentNode.hotspots[1].customText) || "CLIK" }
                                    </div>
                                )}

                                {/* VICTORY BUTTON (Hotspots & AutoPlay) */}
                                {isSelected && (pickerOpenSide === "left" || pickerOpenSide === "right" || pickerOpenSide === "autoPlay") && (
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (pickerOpenSide === "autoPlay") {
                                                updateCurrentNode({ autoPlayIsVictory: !currentNode.autoPlayIsVictory });
                                            } else {
                                                const idx = pickerOpenSide === "left" ? 0 : 1;
                                                const newHotspots = [...currentNode.hotspots] as [Hotspot, Hotspot];
                                                newHotspots[idx] = { ...newHotspots[idx], isVictory: !newHotspots[idx].isVictory };
                                                updateCurrentNode({ hotspots: newHotspots });
                                            }
                                        }}
                                        style={{
                                            color: "#fff", fontWeight: 700, fontSize: "12px", cursor: "pointer",
                                            background: (pickerOpenSide === "autoPlay" ? currentNode.autoPlayIsVictory : (pickerOpenSide === "left" ? currentNode.hotspots[0].isVictory : currentNode.hotspots[1].isVictory)) ? (darkModeReducer ? "#E8BAFA" : "#0099cc") : "transparent",
                                            padding: "6px 14px", borderRadius: 16,
                                            textTransform: "uppercase",
                                            border: `1px dashed ${(pickerOpenSide === "autoPlay" ? currentNode.autoPlayIsVictory : (pickerOpenSide === "left" ? currentNode.hotspots[0].isVictory : currentNode.hotspots[1].isVictory)) ? "transparent" : "rgba(255,255,255,0.6)"}`,
                                            boxShadow: (pickerOpenSide === "autoPlay" ? currentNode.autoPlayIsVictory : (pickerOpenSide === "left" ? currentNode.hotspots[0].isVictory : currentNode.hotspots[1].isVictory)) ? "0 4px 12px rgba(0,0,0,0.5)" : "none",
                                            marginTop: (pickerOpenSide === "autoPlay") ? (matchMobile ? 24 : 32) : 8
                                        }}
                                    >
                                        {(pickerOpenSide === "autoPlay" ? currentNode.autoPlayIsVictory : (pickerOpenSide === "left" ? currentNode.hotspots[0].isVictory : currentNode.hotspots[1].isVictory)) ? "ðŸ† VICTORY" : "MAKE VICTORY"}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* --- SVG CLIP PATHS --- */}
            <svg width="0" height="0" style={{ position: 'absolute' }}>
                {currentNode.hotspots[0].svgPath && (
                    <clipPath id="ai-mask-left" clipPathUnits="objectBoundingBox">
                        <path transform={`scale(${1 / (currentNode.hotspots[0].maskWidth || 1080)}, ${1 / (currentNode.hotspots[0].maskHeight || 1920)})`} d={currentNode.hotspots[0].svgPath} />
                    </clipPath>
                )}
                {currentNode.hotspots[1].svgPath && (
                    <clipPath id="ai-mask-right" clipPathUnits="objectBoundingBox">
                        <path transform={`scale(${1 / (currentNode.hotspots[1].maskWidth || 1080)}, ${1 / (currentNode.hotspots[1].maskHeight || 1920)})`} d={currentNode.hotspots[1].svgPath} />
                    </clipPath>
                )}
            </svg>

            {/* --- AI MASKS (Neon Outlines) --- */}
            {currentNode.hotspots[0].svgPath && (
                <svg preserveAspectRatio="xMidYMid slice" viewBox={`0 0 ${currentNode.hotspots[0].maskWidth || 1080} ${currentNode.hotspots[0].maskHeight || 1920}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 5 }}>
                    <path d={currentNode.hotspots[0].svgPath} fill={LEFT_FILL} stroke={LEFT_COLOR} strokeWidth="4" />
                </svg>
            )}
            {currentNode.hotspots[1].svgPath && (
                <svg preserveAspectRatio="xMidYMid slice" viewBox={`0 0 ${currentNode.hotspots[1].maskWidth || 1080} ${currentNode.hotspots[1].maskHeight || 1920}`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 5 }}>
                    <path d={currentNode.hotspots[1].svgPath} fill={RIGHT_FILL} stroke={RIGHT_COLOR} strokeWidth="4" />
                </svg>
            )}

            {/* --- LENSES (Anchor Points) --- */}
            {renderLens(currentNode.hotspots[0], "left")}
            {renderLens(currentNode.hotspots[1], "right")}

            {/* --- AUDIO BUTTONS MOVED TO LENS CONTROLS --- */}


            {/* --- PREVIEW BUTTON --- */}
            <button
                onClick={goToPreview}
                style={{
                    position: "absolute", bottom: 16, right: 16, zIndex: 11,
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
                                const newHotspots = [...currentNode.hotspots] as [Hotspot, Hotspot];
                                const idx = editingTextSide === "left" ? 0 : 1;
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
