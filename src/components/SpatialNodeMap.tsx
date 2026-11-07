import CloseIcon from "@mui/icons-material/Close";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { Box, Button, IconButton, Modal, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { authoringLocked } from '../../server/src/spatialWorld';
import {
    cutSpatialNodeThread,
    sameSpatialSceneLink,
    type SpatialConnection,
    type SpatialNode,
    type SpatialSceneState,
    type SpatialSceneLinkOption,
} from "../spatialStageModel";

type MapPoint = { x: number; y: number };

interface SpatialNodeMapProps {
    scene: SpatialSceneState;
    sceneIndex: number;
    appColor: string;
    connectorColor: string;
    darkMode: boolean;
    frameAspectRatio?: number;
    readOnly?: boolean;
    resetDisabled?: boolean;
    linkOptions?: SpatialSceneLinkOption[];
    onResetNavigation?: (sceneIndex: number, nodeId: string) => void;
    onResetNode?: (sceneIndex: number, nodeId: string) => void;
    onResetRequiresDeletion?: () => void;
    onSaveStagePreset?: () => void;
    onSaveNodePreset?: (nodeId: string) => void;
    stagePresets?: Array<{ presetId: string; title: string }>;
    onApplyStagePreset?: (presetId: string) => void;
}

const NODE_RADIUS = 7;
const MOVEMENT_DISTANCE = 62;

const movementOffset = (connection: SpatialConnection): MapPoint => {
    if (connection.kind === "action") {
        return connection.actionMapOffset || { x: -42, y: -54 };
    }
    const sample = connection.movement.samples.at(-1);
    const length = Math.hypot(sample?.x || 0, sample?.y || 0);
    if (!sample || length < 0.08) return { x: MOVEMENT_DISTANCE, y: 0 };
    const distance = MOVEMENT_DISTANCE * (0.82 + Math.min(1, sample.radius || length) * 0.28);
    return {
        x: (sample.x / length) * distance,
        // Positive joystick Y is forward in ThreeSpatialOverlay (negative Z),
        // so forward is drawn upward on the two-dimensional map.
        y: -(sample.y / length) * distance,
    };
};

export const buildSpatialNodeMapLayout = (scene: SpatialSceneState): Map<string, MapPoint> => {
    const points = new Map<string, MapPoint>();
    const rootNode = scene.nodes[0];
    if (!rootNode) return points;
    const existingNodeIds = new Set(scene.nodes.map((node) => node.id));
    points.set(rootNode.id, { x: 0, y: 0 });

    // Connections are the spatial truth. Repeated passes also tolerate a
    // restored manifest whose connections are not stored parent-first.
    for (let pass = 0; pass < scene.nodes.length; pass += 1) {
        let changed = false;
        for (const connection of scene.connections) {
            const source = points.get(connection.sourceNodeId);
            if (!source || !existingNodeIds.has(connection.targetNodeId) || points.has(connection.targetNodeId)) continue;
            const offset = movementOffset(connection);
            const candidate = {
                x: source.x + offset.x,
                y: source.y + offset.y,
            };
            // Separate overlapping branches while retaining their directional layout.
            const originalX = candidate.x, originalY = candidate.y;
            for (let lane = 1; [...points.values()].some(p => Math.hypot(p.x - candidate.x, p.y - candidate.y) < 24) && lane < 30; lane++) {
                const spread = Math.ceil(lane / 2) * 28 * (lane % 2 ? 1 : -1);
                const length = Math.hypot(offset.x, offset.y) || 1;
                candidate.x = originalX - offset.y / length * spread;
                candidate.y = originalY + offset.x / length * spread;
            }
            points.set(connection.targetNodeId, candidate);
            changed = true;
        }
        if (!changed) break;
    }

    // Disconnected restored nodes remain visible without being mistaken for a
    // spatially connected thread.
    let orphanIndex = 0;
    for (const node of scene.nodes) {
        if (points.has(node.id)) continue;
        points.set(node.id, { x: 145 + (orphanIndex % 3) * 64, y: -64 + Math.floor(orphanIndex / 3) * 64 });
        orphanIndex += 1;
    }
    return points;
};

export const buildSpatialNodeMapBounds = (points: Map<string, MapPoint>, viewportAspectRatio = 1) => {
    const values = [...points.values()];
    if (!values.length) return { x: -90, y: -90, width: 180, height: 180 };
    const xs = values.map((point) => point.x);
    const ys = values.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const horizontalPadding = 54;
    const topPadding = 54;
    const bottomPadding = 24;
    let width = Math.max(180, maxX - minX + horizontalPadding * 2);
    let height = Math.max(180, maxY - minY + topPadding + bottomPadding);
    const safeAspectRatio = Number.isFinite(viewportAspectRatio) && viewportAspectRatio > 0
        ? viewportAspectRatio
        : 1;

    // Match the bounds to the actual map/video shape. This removes SVG
    // letterboxing, keeps every direction visible, and lets the complete graph
    // shrink uniformly as its spatial footprint grows.
    if (width / height > safeAspectRatio) height = width / safeAspectRatio;
    else width = height * safeAspectRatio;
    return {
        // Lateral progression stays centred, while the furthest-down graph
        // position sits near the bottom so Start grows naturally upward.
        x: (minX + maxX) / 2 - width / 2,
        y: maxY + bottomPadding - height,
        width,
        height,
    };
};

/** Map graph truth into the exact `xMidYMid meet` viewport used by the SVG. */
export const spatialNodePointInFrame = (
    scene: SpatialSceneState,
    nodeId: string,
    frameWidth: number,
    frameHeight: number,
): MapPoint => {
    const points = buildSpatialNodeMapLayout(scene);
    const point = points.get(nodeId) || points.get(scene.nodes[0]?.id) || { x: 0, y: 0 };
    const bounds = buildSpatialNodeMapBounds(points, frameWidth / Math.max(1, frameHeight));
    const scale = Math.min(frameWidth / bounds.width, frameHeight / bounds.height);
    const renderedWidth = bounds.width * scale;
    const renderedHeight = bounds.height * scale;
    return {
        x: (frameWidth - renderedWidth) / 2 + (point.x - bounds.x) * scale,
        y: (frameHeight - renderedHeight) / 2 + (point.y - bounds.y) * scale,
    };
};

const incomingConnectionForNode = (scene: SpatialSceneState, node: SpatialNode) => (
    scene.connections.find((connection) => connection.targetNodeId === node.id && connection.forward?.videoUrl) || null
);

const SpatialNodeMap: React.FC<SpatialNodeMapProps> = ({
    scene,
    sceneIndex,
    readOnly = false,
    appColor: suppliedAppColor,
    connectorColor: suppliedConnectorColor,
    darkMode,
    frameAspectRatio = 1,
    resetDisabled = false,
    onResetNode,
    onResetRequiresDeletion,
    linkOptions = [],
    onResetNavigation,
    onSaveStagePreset,
    onSaveNodePreset,
    stagePresets = [],
    onApplyStagePreset,
}) => {
    const themeColors = useSelector((state: RootState) => state.settings);
    const appColor = (darkMode ? themeColors.appColorDark : themeColors.appColorLight) || suppliedAppColor;
    const connectorColor = (darkMode ? themeColors.appColorLight : themeColors.appColorDark) || suppliedConnectorColor;
    const accentText = darkMode ? '#000' : '#fff';
    const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
    const [previewDirection, setPreviewDirection] = useState<"movement" | "return">("movement");
    const [navigationNodeId, setNavigationNodeId] = useState<string | null>(null);
    const [resetArmed, setResetArmed] = useState(false);
    const [presetNotice, setPresetNotice] = useState<string>('');
    const points = useMemo(() => buildSpatialNodeMapLayout(scene), [scene]);
    const previewNode = scene.nodes.find((node) => node.id === previewNodeId) || null;
    const previewConnection = previewNode ? incomingConnectionForNode(scene, previewNode) : null;
    const previewMovementUrl = previewConnection?.forward?.videoUrl || "";
    const previewReturnUrl = previewConnection?.backward?.videoUrl || "";
    const previewVideoUrl = previewDirection === "return" ? previewReturnUrl : previewMovementUrl;
    const previewIsRoot = previewNode?.id === scene.nodes[0]?.id;
    const resetImpact = useMemo(() => (
        previewNode ? cutSpatialNodeThread(scene, previewNode.id) : null
    ), [previewNode, scene]);
    const resetConnectionIds = useMemo(() => new Set(resetImpact?.removedConnectionIds || []), [resetImpact]);
    const resetActionCount = useMemo(() => scene.connections.reduce((count, connection) => (
        resetConnectionIds.has(connection.id) && connection.kind === "action" ? count + 1 : count
    ), 0), [resetConnectionIds, scene.connections]);
    const resetMovementCount = (resetImpact?.removedConnectionIds.length || 0) - resetActionCount;
    const resetNodeCount = resetImpact?.removedNodeIds.length || 0;
    const resetVideoCount = useMemo(() => scene.connections.reduce((count, connection) => {
        if (!resetConnectionIds.has(connection.id)) return count;
        return count + (connection.forward?.videoUrl ? 1 : 0) + (connection.backward?.videoUrl ? 1 : 0);
    }, 0), [resetConnectionIds, scene.connections]);
    const resetHasContent = resetNodeCount > 0 || resetMovementCount > 0 || resetVideoCount > 0;
    const resetRequiresDeletion = authoringLocked(scene.ledger) && Boolean(onResetRequiresDeletion);
    const resetAdoptsPendingBase = Boolean(
        scene.pendingRootFrameUrl && resetImpact && !resetImpact.scene.pendingRootFrameUrl
    );
    const actionCount = scene.connections.filter((connection) => connection.kind === "action").length;
    const movementCount = scene.connections.length - actionCount;
    const navigationNodes = scene.nodes.filter(node => node.actionLink || node.actionBacktrack);
    const navigationNode = navigationNodes.find(node => node.id === navigationNodeId);
    const navigationLabel = (node: SpatialNode) => {
        if (node.actionBacktrack) return scene.nodes.find(target => target.id === node.actionBacktrack?.targetNodeId)?.label || "Unavailable node";
        const link = node.actionLink;
        return linkOptions.find(option => link && sameSpatialSceneLink(option, link))?.label
            || (link?.bShotIndex !== undefined ? `B-shot ${link.bShotIndex + 1}` : "Linked scene");
    };
    // Navigation is an action slot, not a generated frame or a change in ancestry.
    const navigationPoints = navigationNodes.map(node => {
        const source = points.get(node.id) || { x: 0, y: 0 };
        return { node, source, x: source.x + 34, y: source.y - 26 };
    });
    const previewIsAction = previewConnection?.kind === "action" || previewNode?.kind === "action";

    useEffect(() => {
        if (previewNodeId && !scene.nodes.some((node) => node.id === previewNodeId)) setPreviewNodeId(null);
    }, [previewNodeId, scene.nodes]);

    useEffect(() => {
        setResetArmed(false);
        setPreviewDirection("movement");
    }, [previewNodeId]);

    useEffect(() => {
        if (previewDirection === "return" && !previewReturnUrl) setPreviewDirection("movement");
    }, [previewDirection, previewReturnUrl]);

    const bounds = useMemo(
        () => {
            const visiblePoints = new Map(points);
            navigationPoints.forEach(({x, y}, index) => visiblePoints.set(`navigation-${index}`, {x, y}));
            return buildSpatialNodeMapBounds(visiblePoints, frameAspectRatio);
        },
        [frameAspectRatio, points, scene.nodes],
    );

    const openNode = (nodeId: string) => setPreviewNodeId(nodeId);
    const closePreview = () => setPreviewNodeId(null);
    const resetPreviewNode = () => {
        if (readOnly || !previewNode || resetDisabled) return;
        if (resetRequiresDeletion) { onResetRequiresDeletion?.(); closePreview(); return; }
        setResetArmed(true);
    };
    const confirmResetPreviewNode = () => {
        if (readOnly || !previewNode || resetDisabled || !resetImpact) return;
        onResetNode?.(sceneIndex, previewNode.id);
        setResetArmed(false);
        closePreview();
    };

    return (
        <>
            <Box
                role="region"
                aria-label="Spatial node map"
                sx={{
                    width: frameAspectRatio < 0.8 ? { xs: 218, sm: 270 } : { xs: 286, sm: 360 },
                    maxWidth: "calc(100vw - 82px)",
                    p: 1.75,
                    borderRadius: 3,
                    color: darkMode ? "#fff" : "#111",
                    background: `linear-gradient(145deg, ${alpha(appColor, darkMode ? 0.30 : 0.22)}, ${alpha(connectorColor, darkMode ? 0.18 : 0.12)})`,
                    backdropFilter: "blur(22px) saturate(180%)",
                    WebkitBackdropFilter: "blur(22px) saturate(180%)",
                    border: `1px solid ${alpha(appColor, 0.62)}`,
                    boxShadow: `0 14px 34px rgba(0,0,0,0.30), inset 0 1px 0 ${alpha("#fff", 0.18)}`,
                }}
            >
                <Typography sx={{ fontSize: "0.76rem", fontWeight: 800, letterSpacing: "0.1em" }}>
                    SPATIAL MAP
                </Typography>
                <Typography sx={{ mt: .5, mb: 1.5, fontSize: "0.7rem", lineHeight: 1.6, opacity: .7 }}>
                    Scene {sceneIndex + 1} · {scene.nodes.length} nodes · {movementCount} movements · {actionCount} actions · {navigationNodes.filter(node => node.actionLink).length} links · {navigationNodes.filter(node => node.actionBacktrack).length} backtracks
                </Typography>
                {!readOnly && scene.pendingRootFrameUrl && (
                    <Box
                        sx={{
                            mb: 0.8,
                            px: 0.9,
                            py: 0.65,
                            borderRadius: 1.8,
                            color: darkMode ? "#fff" : "#111",
                            bgcolor: alpha(appColor, darkMode ? 0.18 : 0.24),
                            border: `1px solid ${alpha(appColor, 0.62)}`,
                        }}
                    >
                        <Typography sx={{ fontSize: "0.58rem", lineHeight: 1.35, fontWeight: 900 }}>
                            NEW BASE IMAGE READY
                        </Typography>
                        <Typography sx={{ mt: 0.15, fontSize: "0.54rem", lineHeight: 1.35, opacity: 0.76 }}>
                            Reset Start—or remove the final remaining movement—to rebuild this stage from it.
                        </Typography>
                    </Box>
                )}

                <Box
                    sx={{
                        position: "relative",
                        width: "100%",
                        aspectRatio: String(frameAspectRatio),
                        height: "auto",
                        overflow: "hidden",
                        borderRadius: 2.4,
                        background: darkMode
                            ? "linear-gradient(145deg, rgba(2,7,12,0.58), rgba(16,22,30,0.30))"
                            : "linear-gradient(145deg, rgba(255,255,255,0.56), rgba(240,247,252,0.26))",
                        border: `1px solid ${alpha(appColor, 0.34)}`,
                    }}
                >
                    <svg
                        width="100%"
                        height="100%"
                        viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}
                        preserveAspectRatio="xMidYMid meet"
                        aria-label="Directional map of spatial video nodes"
                    >
                        <defs><pattern id={`spatial-grid-${sceneIndex}`} width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".6" fill={connectorColor} opacity=".18" /></pattern></defs>
                        <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} fill={`url(#spatial-grid-${sceneIndex})`} />
                        {scene.connections.map((connection) => {
                            const source = points.get(connection.sourceNodeId);
                            const target = points.get(connection.targetNodeId);
                            if (!source || !target) return null;
                            const dx = target.x - source.x;
                            const dy = target.y - source.y;
                            const length = Math.max(1, Math.hypot(dx, dy));
                            const startX = source.x + (dx / length) * NODE_RADIUS;
                            const startY = source.y + (dy / length) * NODE_RADIUS;
                            const endX = target.x - (dx / length) * NODE_RADIUS;
                            const endY = target.y - (dy / length) * NODE_RADIUS;
                            return (
                                <line
                                    key={connection.id}
                                    x1={startX}
                                    y1={startY}
                                    x2={endX}
                                    y2={endY}
                                    stroke={connectorColor}
                                    strokeWidth="2.5"
                                    strokeDasharray={connection.kind === 'action' ? '3 4' : undefined}
                                    strokeLinecap="round"
                                    opacity={connection.status === "failed" && !connection.forward ? 0.42 : 0.96}
                                />
                            );
                        })}

                        {navigationPoints.map(({node, source, x, y}) => <g key={`navigation-${node.id}`}>
                            <line x1={source.x} y1={source.y} x2={x} y2={y} stroke={connectorColor} strokeWidth="3" />
                            <g transform={`translate(${x} ${y})`} role="button" tabIndex={0} aria-label={`${node.actionLink ? "Link" : "Backtrack"} from ${node.label || "node"} to ${navigationLabel(node)}`}
                                onClick={() => setNavigationNodeId(node.id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setNavigationNodeId(node.id); } }} style={{ cursor: "pointer" }}>
                                <rect x={-10} y={-8} width={20} height={16} rx={2} fill={darkMode ? "#151515" : "#fff"} stroke={appColor} strokeWidth={2} />
                                <text y={2.5} textAnchor="middle" fill={darkMode ? "#fff" : "#111"} fontSize={6} fontWeight={900}>{node.actionLink ? "LINK" : "BACK"}</text>
                            </g>
                        </g>)}
                        {scene.nodes.map((node, nodeIndex) => {
                            const point = points.get(node.id);
                            if (!point) return null;
                            const active = node.id === scene.activeNodeId;
                            return (
                                <g
                                    key={node.id}
                                    transform={`translate(${point.x} ${point.y})`}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`Open ${node.label || `node ${nodeIndex + 1}`}`}
                                    onClick={() => openNode(node.id)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter" || event.key === " ") openNode(node.id);
                                    }}
                                    style={{ cursor: "pointer", outline: "none" }}
                                >
                                    {active && (node.kind === "action"
                                        ? <path d="M 0 -13 L 12 9 L -12 9 Z" fill="none" stroke={appColor} strokeWidth="2.5" opacity="0.9" />
                                        : <circle r={NODE_RADIUS + 5} fill="none" stroke={appColor} strokeWidth="2.5" opacity="0.9" />)}
                                    {node.kind === "action" ? (
                                        <path
                                            d="M 0 -8 L 8 6 L -8 6 Z"
                                            fill={active ? appColor : (darkMode ? "rgba(13,18,25,0.94)" : "rgba(255,255,255,0.94)")}
                                            stroke={active ? appColor : connectorColor}
                                            strokeWidth="3"
                                            strokeLinejoin="round"
                                        />
                                    ) : (
                                        <circle
                                            r={NODE_RADIUS}
                                            fill={active ? appColor : (darkMode ? "rgba(13,18,25,0.94)" : "rgba(255,255,255,0.94)")}
                                            stroke={active ? appColor : connectorColor}
                                            strokeWidth="3"
                                        />
                                    )}
                                    <text
                                        y={NODE_RADIUS + 11}
                                        textAnchor="middle"
                                        fill={darkMode ? "#fff" : "#111"}
                                        fontSize="7"
                                        fontWeight="800"
                                    >
                                        {node.label || `Node ${nodeIndex + 1}`}
                                    </text>
                                </g>
                            );
                        })}
                    </svg>
                </Box>
                <Typography sx={{ mt: 0.65, fontSize: "0.56rem", opacity: 0.62, textAlign: "center" }}>
                    {readOnly ? "Select a node to inspect its videos" : "Select a node to preview its video or reset its forward thread"}
                </Typography>
                {!readOnly && (onSaveStagePreset || stagePresets.length > 0) && (
                    <Box sx={{ mt: 0.75, display: "flex", flexWrap: "wrap", gap: 0.5, justifyContent: "center" }}>
                        {onSaveStagePreset && (
                            <Button
                                size="small"
                                onClick={() => {
                                    onSaveStagePreset();
                                    setPresetNotice('Saved stage preset');
                                    setTimeout(() => setPresetNotice(''), 2500);
                                }}
                                sx={{ fontSize: "0.62rem", py: 0.25, px: 0.9, borderRadius: 99, border: `1px solid ${appColor}`, color: darkMode ? "#fff" : "#111", textTransform: "none", fontWeight: 700 }}
                            >
                                + Save Stage Preset
                            </Button>
                        )}
                        {onApplyStagePreset && stagePresets.map((sp) => (
                            <Button
                                key={sp.presetId}
                                size="small"
                                onClick={() => {
                                    onApplyStagePreset(sp.presetId);
                                    setPresetNotice(`Applied ${sp.title}`);
                                    setTimeout(() => setPresetNotice(''), 2500);
                                }}
                                sx={{ fontSize: "0.62rem", py: 0.25, px: 0.85, borderRadius: 99, bgcolor: alpha(appColor, 0.14), color: darkMode ? "#fff" : "#111", textTransform: "none", fontWeight: 600 }}
                            >
                                Apply: {sp.title}
                            </Button>
                        ))}
                    </Box>
                )}
                {presetNotice && (
                    <Typography sx={{ mt: 0.4, fontSize: "0.58rem", color: appColor, fontWeight: 700, textAlign: "center" }}>
                        {presetNotice}
                    </Typography>
                )}
                <Typography sx={{ display: "none" }}>
                </Typography>
            </Box>

            <Modal open={Boolean(navigationNode)} onClose={() => setNavigationNodeId(null)} sx={{ zIndex: 2147483003 }}>
                <Box sx={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(90vw, 380px)", p: 2.5, borderRadius: 3, bgcolor: darkMode ? "#171717" : "#fff", color: darkMode ? "#fff" : "#111", border: `2px solid ${appColor}` }}>
                    <IconButton aria-label="Close navigation details" onClick={() => setNavigationNodeId(null)} sx={{ float: "right", color: "inherit" }}><CloseIcon /></IconButton>
                    <Typography variant="h6">{navigationNode?.actionLink ? "Link" : "Backtrack"}</Typography>
                    <Typography sx={{ my: 2 }}>{navigationNode?.label} → {navigationNode && navigationLabel(navigationNode)}</Typography>
                    {!readOnly && onResetNavigation && <>
                        <Typography sx={{ mb: 2, fontSize: "0.8rem" }}>Reset clears this connection. The node, movement and videos stay.</Typography>
                        <Button startIcon={<RestartAltIcon />} disabled={resetDisabled} onClick={() => { if (!navigationNode || resetDisabled) return; onResetNavigation(sceneIndex, navigationNode.id); setNavigationNodeId(null); }} sx={{ color: darkMode ? "#121212" : "#fff", bgcolor: appColor, borderRadius: 99, "&:hover": { bgcolor: appColor } }}>Reset {navigationNode?.actionLink ? "link" : "backtrack"}</Button>
                    </>}
                </Box>
            </Modal>
            <Modal
                open={Boolean(previewNode)}
                onClose={closePreview}
                disableRestoreFocus
                sx={{ zIndex: 2147483002 }}
            >
                <Box
                    onClick={(event) => event.stopPropagation()}
                    sx={{
                        position: "relative",
                        width: "100vw",
                        height: "100dvh",
                        overflow: "hidden",
                        display: "grid",
                        gridTemplateRows: "10dvh 90dvh",
                        color: darkMode ? "#fff" : "#111",
                        bgcolor: "#000",
                    }}
                >
                    <Box
                        sx={{
                            position: "relative",
                            zIndex: 1,
                            minWidth: 0,
                            display: "grid",
                            gridTemplateColumns: { xs: "auto minmax(0, 1fr) auto", sm: "minmax(150px, 1fr) minmax(260px, 2fr) minmax(56px, 1fr)" },
                            alignItems: "center",
                            px: { xs: 0.75, sm: 2 },
                            gap: { xs: 0.5, sm: 1.5 },
                            color: "#fff",
                            background: "linear-gradient(180deg, rgba(14,16,21,0.99) 0%, rgba(6,8,12,0.99) 100%)",
                            borderTop: `3px solid ${appColor}`,
                            borderBottom: `2px solid ${appColor}`,
                            boxShadow: `0 8px 30px rgba(0,0,0,0.56), inset 0 -1px 0 ${alpha(appColor, 0.28)}`,
                        }}
                    >
                        {readOnly ? <Box /> : (
                        <Button
                            startIcon={<RestartAltIcon />}
                            disabled={resetDisabled || !resetHasContent && !resetRequiresDeletion}
                            onClick={resetPreviewNode}
                            sx={{
                                justifySelf: "start",
                                minWidth: 0,
                                px: { xs: 0.7, sm: 1.4 },
                                color: "#fff",
                                minHeight: { xs: 38, sm: 42 },
                                border: `1.5px solid ${appColor}`,
                                borderRadius: 999,
                                background: alpha(appColor, 0.10),
                                fontWeight: 900,
                                fontSize: { xs: "0.66rem", sm: "0.8rem" },
                                whiteSpace: "nowrap",
                                textShadow: "0 2px 5px #000",
                                "&:hover": { background: alpha(appColor, 0.20) },
                                "&.Mui-disabled": {
                                    color: "rgba(255,255,255,0.48)",
                                    borderColor: alpha(appColor, 0.34),
                                    background: "rgba(255,255,255,0.035)",
                                },
                            }}
                        >
                            {previewIsRoot ? "RESET STAGE" : "RESET NODE"}
                        </Button>
                        )}
                        <Box sx={{ minWidth: 0, display: "grid", justifyItems: "center", alignContent: "center" }}>
                            {!readOnly && previewNode && (previewIsRoot ? onSaveStagePreset : onSaveNodePreset) && (
                                <Button
                                    onClick={() => {
                                        if (previewIsRoot) onSaveStagePreset?.();
                                        else onSaveNodePreset?.(previewNode.id);
                                        setPresetNotice(previewIsRoot ? 'Saved stage preset' : `Saved ${previewNode.label || 'node'} preset`);
                                        setTimeout(() => setPresetNotice(''), 2500);
                                    }}
                                    sx={{
                                        position: "absolute",
                                        left: { xs: 112, sm: 162 },
                                        minWidth: 0,
                                        px: { xs: 0.7, sm: 1.2 },
                                        color: "#fff",
                                        minHeight: { xs: 34, sm: 38 },
                                        border: `1.5px solid ${appColor}`,
                                        borderRadius: 999,
                                        background: alpha(appColor, 0.18),
                                        fontWeight: 800,
                                        fontSize: { xs: "0.6rem", sm: "0.74rem" },
                                        whiteSpace: "nowrap",
                                        textShadow: "0 2px 5px #000",
                                        "&:hover": { background: alpha(appColor, 0.28) },
                                    }}
                                >
                                    {previewIsRoot ? "SAVE STAGE PRESET" : "SAVE NODE PRESET"}
                                </Button>
                            )}
                            <Typography noWrap sx={{ color: "#fff", fontWeight: 950, fontSize: { xs: "0.86rem", sm: "1.08rem" }, letterSpacing: "0.02em", textShadow: "0 2px 7px #000" }}>
                                {previewNode?.label || "Spatial node"}
                            </Typography>
                            {previewMovementUrl ? (
                                <Box sx={{ mt: 0.55, display: "flex", alignItems: "center", gap: 0.45 }}>
                                    <Button
                                        size="small"
                                        onClick={() => setPreviewDirection("movement")}
                                        sx={{
                                            minWidth: 0,
                                            minHeight: 30,
                                            px: { xs: 1, sm: 1.5 },
                                            py: 0.4,
                                            borderRadius: 999,
                                            color: previewDirection === "movement" ? (darkMode ? "#090b0f" : "#fff") : "rgba(255,255,255,0.88)",
                                            bgcolor: previewDirection === "movement" ? appColor : "rgba(255,255,255,0.08)",
                                            border: `1px solid ${previewDirection === "movement" ? appColor : "rgba(255,255,255,0.20)"}`,
                                            fontSize: { xs: "0.62rem", sm: "0.7rem" },
                                            fontWeight: 950,
                                            "&:hover": { bgcolor: previewDirection === "movement" ? appColor : "rgba(255,255,255,0.14)" },
                                        }}
                                    >
                                        {previewIsAction ? "Action" : "Movement"}
                                    </Button>
                                    {!previewIsAction && <SwapHorizIcon sx={{ fontSize: 18, color: alpha("#fff", 0.82) }} />}
                                    {!previewIsAction && <Button
                                        size="small"
                                        disabled={!previewReturnUrl}
                                        onClick={() => setPreviewDirection("return")}
                                        title={previewReturnUrl ? "Play the authentic generated return video" : "No authentic return video is available"}
                                        sx={{
                                            minWidth: 0,
                                            minHeight: 30,
                                            px: { xs: 1, sm: 1.5 },
                                            py: 0.4,
                                            borderRadius: 999,
                                            color: previewDirection === "return" ? (darkMode ? "#090b0f" : "#fff") : "rgba(255,255,255,0.88)",
                                            bgcolor: previewDirection === "return" ? appColor : "rgba(255,255,255,0.08)",
                                            border: `1px solid ${previewDirection === "return" ? appColor : "rgba(255,255,255,0.20)"}`,
                                            fontSize: { xs: "0.62rem", sm: "0.7rem" },
                                            fontWeight: 950,
                                            "&:hover": { bgcolor: previewDirection === "return" ? appColor : "rgba(255,255,255,0.14)" },
                                            "&.Mui-disabled": { color: "rgba(255,255,255,0.48)", bgcolor: "rgba(255,255,255,0.045)", borderColor: "rgba(255,255,255,0.12)" },
                                        }}
                                    >
                                        Return
                                    </Button>}
                                </Box>
                            ) : (
                                <Typography noWrap sx={{ mt: 0.2, color: alpha("#fff", 0.56), fontSize: { xs: "0.5rem", sm: "0.6rem" } }}>
                                    {previewIsRoot ? "Original spatial registration point" : "No movement video available"}
                                </Typography>
                            )}
                        </Box>
                        <IconButton
                            aria-label="Close spatial node preview"
                            onClick={closePreview}
                            sx={{
                                justifySelf: "end",
                                width: { xs: 40, sm: 48 },
                                height: { xs: 40, sm: 48 },
                                color: "#fff",
                                border: `1.5px solid ${alpha(appColor, 0.64)}`,
                                bgcolor: "rgba(255,255,255,0.055)",
                                "&:hover": { bgcolor: alpha(appColor, 0.18), borderColor: appColor },
                            }}
                        >
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    <Box
                        sx={{
                            position: "relative",
                            width: "100%",
                            height: "100%",
                            display: "grid",
                            placeItems: "center",
                            bgcolor: "#000",
                            overflow: "hidden",
                        }}
                    >
                        {previewVideoUrl ? (
                            <video
                                key={previewVideoUrl}
                                src={previewVideoUrl}
                                controls
                                autoPlay
                                playsInline
                                style={{
                                    display: "block",
                                    width: "100%",
                                    height: "90dvh",
                                    maxWidth: "100vw",
                                    maxHeight: "90dvh",
                                    aspectRatio: "auto",
                                    objectFit: "contain",
                                    objectPosition: "center",
                                    background: "#000",
                                }}
                            />
                        ) : previewNode?.frameUrl ? (
                            <img
                                src={previewNode.frameUrl}
                                alt={`${previewNode.label || "Spatial node"} frame`}
                                style={{
                                    display: "block",
                                    width: "100%",
                                    height: "90dvh",
                                    maxWidth: "100vw",
                                    maxHeight: "90dvh",
                                    aspectRatio: "auto",
                                    objectFit: "contain",
                                    objectPosition: "center",
                                    background: "#000",
                                }}
                            />
                        ) : (
                            <Typography sx={{ color: "rgba(255,255,255,0.68)", fontWeight: 800 }}>
                                No preview is available for this node yet.
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Modal>

            <Modal
                open={!readOnly && resetArmed && Boolean(previewNode)}
                onClose={() => setResetArmed(false)}
                disableRestoreFocus
                sx={{ zIndex: 2147483004 }}
            >
                <Box
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="spatial-reset-title"
                    onClick={(event) => event.stopPropagation()}
                    sx={{
                        position: "fixed",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "min(92vw, 520px)",
                        p: { xs: 2.2, sm: 3 },
                        borderRadius: 4,
                        color: "#fff",
                        background: `linear-gradient(155deg, ${alpha(appColor, .22)}, rgba(15,15,15,.99)), #111`,
                        border: `1.5px solid ${alpha(appColor, .72)}`,
                        boxShadow: "0 28px 90px rgba(0,0,0,0.72), inset 0 1px 0 rgba(255,255,255,0.08)",
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                        <Box
                            sx={{
                                width: 42,
                                height: 42,
                                flex: "0 0 42px",
                                display: "grid",
                                placeItems: "center",
                                borderRadius: "50%",
                                color: appColor,
                                bgcolor: alpha(appColor, .13),
                                border: `1px solid ${alpha(appColor, .42)}`,
                            }}
                        >
                            <WarningAmberRoundedIcon />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                            <Typography id="spatial-reset-title" sx={{ fontSize: { xs: "1rem", sm: "1.15rem" }, fontWeight: 950 }}>
                                {resetAdoptsPendingBase
                                    ? "Use the new base image and reset this spatial stage?"
                                    : previewIsRoot
                                        ? "Reset this entire spatial stage?"
                                        : `Reset ${previewNode?.label || "this node"} and everything ahead?`}
                            </Typography>
                            <Typography sx={{ mt: 0.25, fontSize: "0.74rem", color: "rgba(255,255,255,0.66)" }}>
                                This branch cut cannot be undone.
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ mt: 2.2, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0.8 }}>
                        {[
                            { value: resetNodeCount, label: resetNodeCount === 1 ? "node" : "nodes" },
                            { value: resetMovementCount, label: resetMovementCount === 1 ? "movement" : "movements" },
                            { value: resetActionCount, label: resetActionCount === 1 ? "action" : "actions" },
                            { value: resetVideoCount, label: resetVideoCount === 1 ? "video" : "videos" },
                        ].map((item) => (
                            <Box
                                key={item.label}
                                sx={{
                                    py: 1.15,
                                    px: 0.7,
                                    textAlign: "center",
                                    borderRadius: 2.5,
                                    bgcolor: "rgba(255,255,255,0.055)",
                                    border: "1px solid rgba(255,255,255,0.11)",
                                }}
                            >
                                <Typography sx={{ color: appColor, fontSize: { xs: "1.25rem", sm: "1.5rem" }, lineHeight: 1, fontWeight: 950 }}>
                                    {item.value}
                                </Typography>
                                <Typography sx={{ mt: 0.35, fontSize: "0.65rem", fontWeight: 850, textTransform: "uppercase", letterSpacing: "0.06em", opacity: 0.72 }}>
                                    {item.label}
                                </Typography>
                            </Box>
                        ))}
                    </Box>

                    <Typography sx={{ mt: 1.7, fontSize: "0.82rem", lineHeight: 1.5, color: "rgba(255,255,255,0.78)" }}>
                        {resetAdoptsPendingBase
                            ? "The listed nodes, movements, actions, and videos will be removed. Start will switch to your new HD base image, and its intelligent movement state will be rebuilt before the next generation."
                            : previewIsRoot
                            ? "The Start node will stay, but every connected movement, action, node, and video after it will be removed from this stage."
                            : "This node and every future node connected after it on the same thread will be removed, together with their movement, action, and return videos."}
                    </Typography>

                    <Box sx={{ mt: 2.3, display: "flex", justifyContent: "flex-end", gap: 1 }}>
                        <Button
                            onClick={() => setResetArmed(false)}
                            sx={{ color: "#fff", px: 2, borderRadius: 999, fontWeight: 900 }}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            disableElevation
                            onClick={confirmResetPreviewNode}
                            sx={{
                                px: 2.2,
                                borderRadius: 999,
                                color: accentText,
                                bgcolor: appColor,
                                fontWeight: 950,
                                "&:hover": { bgcolor: alpha(appColor, .85) },
                            }}
                        >
                            {resetAdoptsPendingBase
                                ? "Use new base and reset"
                                : previewIsRoot
                                    ? "Reset stage"
                                    : "Remove branch"}
                        </Button>
                    </Box>
                </Box>
            </Modal>
        </>
    );
};

export default SpatialNodeMap;
