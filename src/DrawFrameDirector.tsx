import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, CircularProgress, IconButton, Slider, TextField, Typography } from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import CloseIcon from "@mui/icons-material/Close";
import BrushIcon from "@mui/icons-material/Brush";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import DrawIcon from "@mui/icons-material/Draw";
import ImageIcon from "@mui/icons-material/Image";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import UndoIcon from "@mui/icons-material/Undo";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import RotateRightIcon from "@mui/icons-material/RotateRight";
import OpenWithIcon from "@mui/icons-material/OpenWith";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import { alpha, getContrastRatio } from '@mui/material/styles';

export type DrawFrameSource = "default" | "drawn" | "ai";

export type DrawFrameArrowSettings = {
    size: number;
    rotation: number;
    textFontSize: number;
    textRotation: number;
    brushSize: number;
    brushColor: string;
};

export type DrawFrameData = {
    baseImageUrl?: string;
    drawnImageUrl?: string;
    aiImageUrl?: string;
    selectedSource?: DrawFrameSource;
    arrowSettings?: Partial<DrawFrameArrowSettings>;
    note?: string;
    updatedAt?: number;
};

type DrawFrameDirectorProps = {
    baseImageUrl?: string;
    data?: DrawFrameData;
    darkMode?: boolean;
    accentColor?: string;
    matchMobile?: boolean;
    isSaving?: boolean;
    isUpgrading?: boolean;
    onSaveDrawing: (blob: Blob, note: string) => Promise<void> | void;
    onUpgradeDrawing: (note: string) => Promise<void> | void;
    onUseSource: (source: DrawFrameSource) => void;
    onUpdateArrowSettings?: (settings: DrawFrameArrowSettings) => void;
    onReset: () => void;
};

type ToolMode = "arrow" | "brush" | "text";
type InteractionMode = "draw" | "drag";
type SliderMode = "size" | "rotate";
type Point = { x: number; y: number };
type BrushStroke = { id: string; color: string; size: number; points: Point[] };
type ArrowObject = { id: string; type: "arrow"; x: number; y: number; size: number; rotation: number; flipped?: boolean };
type TextObject = { id: string; type: "text"; x: number; y: number; text: string; fontSize: number; rotation: number; color: string };
type DrawObject = ArrowObject | TextObject;
type HistoryEntry = { strokes: BrushStroke[]; objects: DrawObject[]; selectedId: string | null };
type ActiveInteraction =
    | { type: "brush"; strokeId: string }
    | { type: "move"; id: string; offsetX: number; offsetY: number }
    | { type: "rotate"; id: string; startAngle: number; startRotation: number }
    | null;
type ObjectBox = { width: number; height: number; padding?: number; lines?: string[]; lineHeight?: number };

const fallbackAccent = "#39DDF5";
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const normalizeRotation = (rotation: number) => ((rotation % 360) + 360) % 360;
const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const normalizeArrowSettings = (settings?: Partial<DrawFrameArrowSettings>, accentColor = fallbackAccent): DrawFrameArrowSettings => {
    const rawSize = Number(settings?.size);
    const rawRotation = Number(settings?.rotation);
    const rawTextFontSize = Number(settings?.textFontSize);
    const rawTextRotation = Number(settings?.textRotation);
    const rawBrushSize = Number(settings?.brushSize);
    return {
        size: Math.min(620, Math.max(110, Number.isFinite(rawSize) ? rawSize : 260)),
        rotation: normalizeRotation(Number.isFinite(rawRotation) ? rawRotation : 0),
        textFontSize: Math.min(170, Math.max(24, Number.isFinite(rawTextFontSize) ? rawTextFontSize : 54)),
        textRotation: normalizeRotation(Number.isFinite(rawTextRotation) ? rawTextRotation : 0),
        brushSize: Math.min(42, Math.max(3, Number.isFinite(rawBrushSize) ? rawBrushSize : 10)),
        brushColor: typeof settings?.brushColor === "string" && settings.brushColor.trim() ? settings.brushColor : accentColor,
    };
};

const cloneStrokes = (strokes: BrushStroke[]) => strokes.map((stroke) => ({ ...stroke, points: stroke.points.map((point) => ({ ...point })) }));
const cloneObjects = (objects: DrawObject[]) => objects.map((object) => ({ ...object }));
const pointDistance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

const toLocalPoint = (point: Point, object: DrawObject): Point => {
    const rad = (-object.rotation * Math.PI) / 180;
    const dx = point.x - object.x;
    const dy = point.y - object.y;
    return { x: dx * Math.cos(rad) - dy * Math.sin(rad), y: dx * Math.sin(rad) + dy * Math.cos(rad) };
};

const toWorldPoint = (local: Point, object: DrawObject): Point => {
    const rad = (object.rotation * Math.PI) / 180;
    return { x: object.x + local.x * Math.cos(rad) - local.y * Math.sin(rad), y: object.y + local.x * Math.sin(rad) + local.y * Math.cos(rad) };
};

const lazyBrushPoint = (last: Point, next: Point, radius: number): Point | null => {
    const distance = pointDistance(last, next);
    if (distance < radius) return null;
    const pull = (distance - radius) / distance;
    return { x: last.x + (next.x - last.x) * pull, y: last.y + (next.y - last.y) * pull };
};

const drawArrowPath = (ctx: CanvasRenderingContext2D, length: number) => {
    const shaftHalf = length * 0.085;
    const headHalf = length * 0.255;
    const headStart = length * 0.16;
    ctx.beginPath();
    ctx.moveTo(-length * 0.5, -shaftHalf);
    ctx.lineTo(headStart, -shaftHalf);
    ctx.lineTo(headStart, -headHalf);
    ctx.lineTo(length * 0.5, 0);
    ctx.lineTo(headStart, headHalf);
    ctx.lineTo(headStart, shaftHalf);
    ctx.lineTo(-length * 0.5, shaftHalf);
    ctx.closePath();
};

const getTextLayout = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, object: TextObject): ObjectBox => {
    const fontSize = clamp(object.fontSize, 22, 180);
    const padding = Math.round(fontSize * 0.36);
    const lineHeight = Math.round(fontSize * 1.22);
    const maxTextWidth = Math.max(fontSize * 4, Math.min(canvas.width * 0.72, canvas.width - padding * 4));
    ctx.save();
    ctx.font = `800 ${fontSize}px Inter, Arial, sans-serif`;
    const words = (object.text || "Camera move").trim().split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    words.forEach((word) => {
        const candidate = current ? `${current} ${word}` : word;
        if (ctx.measureText(candidate).width <= maxTextWidth || !current) current = candidate;
        else {
            lines.push(current);
            current = word;
        }
    });
    if (current) lines.push(current);
    if (!lines.length) lines.push("Camera move");
    const widest = lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0);
    ctx.restore();
    return { width: Math.min(widest + padding * 2, maxTextWidth + padding * 2), height: lineHeight * lines.length + padding * 2, padding, lines, lineHeight };
};

const getObjectBox = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, object: DrawObject): ObjectBox => {
    if (object.type === "arrow") return { width: object.size * 1.26, height: object.size * 0.68 };
    return getTextLayout(ctx, canvas, object);
};

const drawStroke = (ctx: CanvasRenderingContext2D, stroke: BrushStroke) => {
    if (!stroke.points.length) return;
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
    ctx.lineWidth = stroke.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = stroke.size * 0.45;

    if (stroke.points.length === 1) {
        const point = stroke.points[0];
        ctx.beginPath();
        ctx.arc(point.x, point.y, stroke.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
    }

    if (stroke.points.length === 2) {
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
        ctx.lineTo(stroke.points[1].x, stroke.points[1].y);
        ctx.stroke();
        ctx.restore();
        return;
    }

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let index = 1; index < stroke.points.length - 2; index += 1) {
        const point = stroke.points[index];
        const next = stroke.points[index + 1];
        const mid = { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2 };
        ctx.quadraticCurveTo(point.x, point.y, mid.x, mid.y);
    }
    const beforeLast = stroke.points[stroke.points.length - 2];
    const last = stroke.points[stroke.points.length - 1];
    ctx.quadraticCurveTo(beforeLast.x, beforeLast.y, last.x, last.y);
    ctx.stroke();
    ctx.restore();
};

const drawArrowObject = (ctx: CanvasRenderingContext2D, object: ArrowObject) => {
    const length = object.size;
    const bgHeight = length * 0.68;
    const bgWidth = length * 1.26;
    ctx.save();
    ctx.translate(object.x, object.y);
    ctx.rotate((object.rotation * Math.PI) / 180);
    if (object.flipped) ctx.scale(-1, 1);
    ctx.shadowColor = "rgba(0,0,0,0.62)";
    ctx.shadowBlur = length * 0.12;
    ctx.shadowOffsetY = length * 0.045;
    ctx.fillStyle = "rgba(0,0,0,0.76)";
    ctx.beginPath();
    ctx.roundRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, bgHeight * 0.4);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(0,0,0,0.95)";
    ctx.lineWidth = Math.max(5, length * 0.055);
    drawArrowPath(ctx, length);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    drawArrowPath(ctx, length);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.68)";
    ctx.lineWidth = Math.max(1.5, length * 0.012);
    drawArrowPath(ctx, length);
    ctx.stroke();
    ctx.restore();
};

const drawTextObject = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, object: TextObject) => {
    const layout = getTextLayout(ctx, canvas, object);
    const fontSize = clamp(object.fontSize, 22, 180);
    ctx.save();
    ctx.translate(object.x, object.y);
    ctx.rotate((object.rotation * Math.PI) / 180);
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = fontSize * 0.42;
    ctx.fillStyle = "rgba(0,0,0,0.64)";
    ctx.strokeStyle = object.color || fallbackAccent;
    ctx.lineWidth = Math.max(3, fontSize * 0.08);
    ctx.beginPath();
    ctx.roundRect(-layout.width / 2, -layout.height / 2, layout.width, layout.height, fontSize * 0.36);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "top";
    ctx.font = `800 ${fontSize}px Inter, Arial, sans-serif`;
    layout.lines?.forEach((line, index) => {
        ctx.fillText(line, -layout.width / 2 + (layout.padding || 0), -layout.height / 2 + (layout.padding || 0) + index * (layout.lineHeight || fontSize * 1.2));
    });
    ctx.restore();
};

const drawRotateGlyph = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) => {
    const arcRadius = radius * 0.42;
    const start = -Math.PI * 0.75;
    const end = Math.PI * 0.78;
    ctx.save();
    ctx.strokeStyle = "#111";
    ctx.lineWidth = Math.max(2, radius * 0.12);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(x, y, arcRadius, start, end);
    ctx.stroke();
    const tip = { x: x + Math.cos(end) * arcRadius, y: y + Math.sin(end) * arcRadius };
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.lineTo(tip.x - radius * 0.1, tip.y - radius * 0.35);
    ctx.lineTo(tip.x + radius * 0.34, tip.y - radius * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
};

const getRotateHandlePositions = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, object: DrawObject) => {
    const box = getObjectBox(ctx, canvas, object);
    const gap = Math.max(48, Math.min(box.width, box.height) * 0.26);
    const radius = Math.max(24, Math.min(42, Math.min(canvas.width, canvas.height) * 0.035));
    const localPoints: Point[] = [
        { x: 0, y: -box.height / 2 - gap },
        { x: box.width / 2 + gap, y: 0 },
        { x: 0, y: box.height / 2 + gap },
        { x: -box.width / 2 - gap, y: 0 },
    ];
    return localPoints.map((point) => ({ ...toWorldPoint(point, object), radius }));
};

const drawSelectionChrome = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, object: DrawObject, themeColor: string) => {
    const box = getObjectBox(ctx, canvas, object);
    ctx.save();
    ctx.translate(object.x, object.y);
    ctx.rotate((object.rotation * Math.PI) / 180);
    ctx.strokeStyle = themeColor;
    ctx.lineWidth = Math.max(4, Math.min(canvas.width, canvas.height) * 0.006);
    ctx.setLineDash([18, 11]);
    ctx.beginPath();
    ctx.roundRect(-box.width / 2 - 10, -box.height / 2 - 10, box.width + 20, box.height + 20, 20);
    ctx.stroke();
    ctx.restore();

    getRotateHandlePositions(ctx, canvas, object).forEach((handle) => {
        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = Math.max(2, handle.radius * 0.08);
        ctx.shadowColor = "rgba(0,0,0,0.38)";
        ctx.shadowBlur = handle.radius * 0.5;
        ctx.beginPath();
        ctx.arc(handle.x, handle.y, handle.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.stroke();
        drawRotateGlyph(ctx, handle.x, handle.y, handle.radius);
        ctx.restore();
    });
};

const drawFullScene = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, baseImage: HTMLImageElement | null, strokes: BrushStroke[], objects: DrawObject[], selectedId: string | null, themeColor: string, includeChrome: boolean) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (baseImage) ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);
    else {
        ctx.fillStyle = "#111";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    strokes.forEach((stroke) => drawStroke(ctx, stroke));
    objects.forEach((object) => object.type === "arrow" ? drawArrowObject(ctx, object) : drawTextObject(ctx, canvas, object));
    if (includeChrome && selectedId) {
        const selected = objects.find((object) => object.id === selectedId);
        if (selected) drawSelectionChrome(ctx, canvas, selected, themeColor);
    }
};

const objectContainsPoint = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, object: DrawObject, point: Point) => {
    const box = getObjectBox(ctx, canvas, object);
    const local = toLocalPoint(point, object);
    return Math.abs(local.x) <= box.width / 2 + 18 && Math.abs(local.y) <= box.height / 2 + 18;
};

const pointHitsRotateHandle = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, object: DrawObject, point: Point) =>
    getRotateHandlePositions(ctx, canvas, object).some((handle) => pointDistance(point, handle) <= handle.radius * 1.35);

export default function DrawFrameDirector({
    baseImageUrl,
    data,
    darkMode = true,
    accentColor,
    matchMobile = false,
    isSaving = false,
    isUpgrading = false,
    onSaveDrawing,
    onUpgradeDrawing,
    onUseSource,
    onUpdateArrowSettings,
    onReset,
}: DrawFrameDirectorProps) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const baseImageRef = useRef<HTMLImageElement | null>(null);
    const activeInteractionRef = useRef<ActiveInteraction>(null);
    const historyRef = useRef<HistoryEntry[]>([]);
    const lastTapRef = useRef<{ time: number; point: Point } | null>(null);

    const [tool, setTool] = useState<ToolMode>("arrow");
    const [interactionMode, setInteractionMode] = useState<InteractionMode>("draw");
    const [sliderMode, setSliderMode] = useState<SliderMode>("size");
    const themeColor = accentColor || fallbackAccent;
    const [brushColor, setBrushColor] = useState(() => normalizeArrowSettings(data?.arrowSettings, themeColor).brushColor);
    const [brushSize, setBrushSize] = useState(() => normalizeArrowSettings(data?.arrowSettings).brushSize);
    const [arrowDefaults, setArrowDefaults] = useState<DrawFrameArrowSettings>(() => normalizeArrowSettings(data?.arrowSettings, themeColor));
    const [textDefaults, setTextDefaults] = useState(() => {
        const settings = normalizeArrowSettings(data?.arrowSettings);
        return { fontSize: settings.textFontSize, rotation: settings.textRotation };
    });
    const [note, setNote] = useState(data?.note || "");
    const [stampText, setStampText] = useState(data?.note || "Camera moves here");
    const [localError, setLocalError] = useState("");
    const [previewSource, setPreviewSource] = useState<DrawFrameSource | null>(null);
    const [objects, setObjects] = useState<DrawObject[]>([]);
    const [strokes, setStrokes] = useState<BrushStroke[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [uiHidden, setUiHidden] = useState(false);
    const [imageVersion, setImageVersion] = useState(0);

    const selectedSource = data?.selectedSource || "default";
    const selectedObject = useMemo(() => objects.find((object) => object.id === selectedId) || null, [objects, selectedId]);
    const stageBg = darkMode ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.04)";
    const panelBg = darkMode ? "rgba(15,15,18,0.92)" : "rgba(255,255,255,0.94)";
    const borderColor = darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
    const mutedText = darkMode ? "rgba(255,255,255,0.68)" : "rgba(0,0,0,0.62)";
    const primaryText = darkMode ? "#fff" : "#111";
    const accentText = getContrastRatio(themeColor, '#111') >= 4.5 ? '#111' : '#fff';
    const swatches = [themeColor, "#ffffff", "#111111", "#5fcda7", "#ffda62", "#f85e78"];

    useEffect(() => {
        setNote(data?.note || "");
        if (data?.note) setStampText(data.note);
    }, [data?.note]);

    useEffect(() => {
        const settings = normalizeArrowSettings(data?.arrowSettings, themeColor);
        setArrowDefaults(settings);
        setTextDefaults({ fontSize: settings.textFontSize, rotation: settings.textRotation });
        setBrushSize(settings.brushSize);
        setBrushColor(settings.brushColor);
    }, [data?.arrowSettings?.size, data?.arrowSettings?.rotation, data?.arrowSettings?.textFontSize, data?.arrowSettings?.textRotation, data?.arrowSettings?.brushSize, data?.arrowSettings?.brushColor, themeColor]);

    useEffect(() => {
        if (selectedObject?.type === "text") setStampText(selectedObject.text);
    }, [selectedObject?.id]);

    const pushHistory = useCallback(() => {
        historyRef.current = [...historyRef.current.slice(-20), { strokes: cloneStrokes(strokes), objects: cloneObjects(objects), selectedId }];
    }, [objects, selectedId, strokes]);

    const updateObject = useCallback((id: string, updater: (object: DrawObject) => DrawObject) => {
        setObjects((prev) => prev.map((object) => object.id === id ? updater(object) : object));
    }, []);

    const ensureCanvasDimensions = useCallback(() => {
        const canvas = canvasRef.current;
        const img = baseImageRef.current;
        if (!canvas || !img) return;
        const width = img.naturalWidth || 1080;
        const height = img.naturalHeight || 1920;
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
    }, []);

    const drawScene = useCallback((includeChrome = true) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        ensureCanvasDimensions();
        drawFullScene(ctx, canvas, baseImageRef.current, strokes, objects, selectedId, themeColor, includeChrome);
    }, [ensureCanvasDimensions, objects, selectedId, strokes, themeColor]);

    useEffect(() => {
        if (!baseImageUrl) return;
        setLocalError("");
        setObjects([]);
        setStrokes([]);
        setSelectedId(null);
        historyRef.current = [];

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = canvasRef.current;
            if (canvas) {
                canvas.width = img.naturalWidth || 1080;
                canvas.height = img.naturalHeight || 1920;
            }
            baseImageRef.current = img;
            setImageVersion((value) => value + 1);
        };
        img.onerror = () => setLocalError("Could not load this first-frame image for drawing.");
        const separator = baseImageUrl.includes("?") ? "&" : "?";
        img.src = `${baseImageUrl}${separator}drawcache=${Date.now()}`;
    }, [baseImageUrl]);

    useEffect(() => {
        const frame = requestAnimationFrame(() => drawScene(true));
        return () => cancelAnimationFrame(frame);
    }, [drawScene, imageVersion, previewSource]);

    const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
    };

    const findTopObjectAt = (point: Point) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return null;
        for (let index = objects.length - 1; index >= 0; index -= 1) {
            const object = objects[index];
            if (objectContainsPoint(ctx, canvas, object, point)) return object;
        }
        return null;
    };

    const selectTool = (nextTool: ToolMode) => {
        setTool(nextTool);
        setInteractionMode("draw");
        if (nextTool !== "brush") setSliderMode("size");
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const point = getCanvasPoint(event);
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!point || !canvas || !ctx) return;
        event.preventDefault();
        event.stopPropagation();

        const now = Date.now();
        const lastTap = lastTapRef.current;
        const isDoubleTap = Boolean(lastTap && now - lastTap.time < 320 && pointDistance(lastTap.point, point) < 34);
        lastTapRef.current = { time: now, point };
        if (isDoubleTap) {
            activeInteractionRef.current = null;
            setInteractionMode("draw");
            setUiHidden(false);
            return;
        }

        event.currentTarget.setPointerCapture(event.pointerId);

        if (interactionMode === "draw") {
            if (tool === "brush") {
                pushHistory();
                const stroke: BrushStroke = { id: createId(), color: brushColor, size: brushSize, points: [point] };
                activeInteractionRef.current = { type: "brush", strokeId: stroke.id };
                setStrokes((prev) => [...prev, stroke]);
                setSelectedId(null);
                setUiHidden(true);
                return;
            }

            pushHistory();
            if (tool === "arrow") {
                const arrow: ArrowObject = { id: createId(), type: "arrow", x: point.x, y: point.y, size: arrowDefaults.size, rotation: arrowDefaults.rotation };
                setObjects((prev) => [...prev, arrow]);
                setSelectedId(arrow.id);
                setInteractionMode("drag");
                setSliderMode("size");
                return;
            }

            const textObject: TextObject = { id: createId(), type: "text", x: point.x, y: point.y, text: (stampText || note || "Camera move").trim(), fontSize: textDefaults.fontSize, rotation: textDefaults.rotation, color: brushColor };
            setObjects((prev) => [...prev, textObject]);
            setSelectedId(textObject.id);
            setInteractionMode("drag");
            setSliderMode("size");
            return;
        }

        if (selectedObject && pointHitsRotateHandle(ctx, canvas, selectedObject, point)) {
            pushHistory();
            activeInteractionRef.current = { type: "rotate", id: selectedObject.id, startAngle: Math.atan2(point.y - selectedObject.y, point.x - selectedObject.x), startRotation: selectedObject.rotation };
            setUiHidden(true);
            return;
        }

        const hitObject = findTopObjectAt(point);
        if (hitObject) {
            pushHistory();
            setSelectedId(hitObject.id);
            if (hitObject.type === "text") setStampText(hitObject.text);
            activeInteractionRef.current = { type: "move", id: hitObject.id, offsetX: point.x - hitObject.x, offsetY: point.y - hitObject.y };
            setUiHidden(true);
            return;
        }

        setSelectedId(null);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const active = activeInteractionRef.current;
        if (!active) return;
        const point = getCanvasPoint(event);
        const canvas = canvasRef.current;
        if (!point || !canvas) return;
        event.preventDefault();
        event.stopPropagation();

        if (active.type === "brush") {
            setStrokes((prev) => prev.map((stroke) => {
                if (stroke.id !== active.strokeId) return stroke;
                const last = stroke.points[stroke.points.length - 1];
                const stabilized = lazyBrushPoint(last, point, Math.max(8, stroke.size * 0.85));
                return stabilized ? { ...stroke, points: [...stroke.points, stabilized] } : stroke;
            }));
            return;
        }

        if (active.type === "move") {
            setObjects((prev) => prev.map((object) => object.id === active.id ? { ...object, x: clamp(point.x - active.offsetX, 0, canvas.width), y: clamp(point.y - active.offsetY, 0, canvas.height) } : object));
            return;
        }

        setObjects((prev) => prev.map((object) => {
            if (object.id !== active.id) return object;
            const angle = Math.atan2(point.y - object.y, point.x - object.x);
            return { ...object, rotation: normalizeRotation(active.startRotation + ((angle - active.startAngle) * 180) / Math.PI) };
        }));
    };

    const stopPointerInteraction = (event?: React.PointerEvent<HTMLCanvasElement>) => {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
            try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* browser may already release capture */ }
        }
        activeInteractionRef.current = null;
        setUiHidden(false);
    };

    const handleUndo = () => {
        const previous = historyRef.current.pop();
        if (!previous) return;
        setStrokes(previous.strokes);
        setObjects(previous.objects);
        setSelectedId(previous.selectedId);
        setUiHidden(false);
    };

    const handleClear = () => {
        pushHistory();
        setStrokes([]);
        setObjects([]);
        setSelectedId(null);
    };

    const exportCanvasBlob = async () => {
        const sourceCanvas = canvasRef.current;
        const baseImage = baseImageRef.current;
        if (!sourceCanvas || !baseImage) throw new Error("Draw canvas is not ready.");
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = sourceCanvas.width;
        exportCanvas.height = sourceCanvas.height;
        const ctx = exportCanvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context is not available.");
        drawFullScene(ctx, exportCanvas, baseImage, strokes, objects, null, themeColor, false);
        return await new Promise<Blob>((resolve, reject) => {
            try {
                exportCanvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not export draw image.")), "image/png", 0.98);
            } catch (error) {
                reject(error);
            }
        });
    };

    const handleSave = async () => {
        setLocalError("");
        try {
            const blob = await exportCanvasBlob();
            await onSaveDrawing(blob, note);
        } catch (error: any) {
            setLocalError(error?.message || "Could not save the drawing.");
        }
    };

    const handleResetAll = () => {
        pushHistory();
        setStrokes([]);
        setObjects([]);
        setSelectedId(null);
        onReset();
    };

    const persistToolSettings = (updates: Partial<DrawFrameArrowSettings>) => {
        const next = normalizeArrowSettings({
            ...arrowDefaults,
            textFontSize: textDefaults.fontSize,
            textRotation: textDefaults.rotation,
            brushSize,
            brushColor,
            ...updates,
        });
        onUpdateArrowSettings?.(next);
        return next;
    };

    const handleStampTextChange = (value: string) => {
        setStampText(value);
        if (selectedObject?.type === "text") updateObject(selectedObject.id, (object) => object.type === "text" ? { ...object, text: value } : object);
    };

    const handleBrushColorChange = (color: string) => {
        setBrushColor(color);
        persistToolSettings({ brushColor: color });
        if (selectedObject?.type === "text") updateObject(selectedObject.id, (object) => object.type === "text" ? { ...object, color } : object);
    };

    const updateArrowDefaults = (updates: Partial<DrawFrameArrowSettings>) => {
        const next = persistToolSettings(updates);
        setArrowDefaults(next);
    };

    const updateSliderValue = (value: number) => {
        if (selectedObject?.type === "arrow") {
            const updates = sliderMode === "size" ? { size: value } : { rotation: normalizeRotation(value) };
            updateObject(selectedObject.id, (object) => object.type === "arrow" ? { ...object, ...updates } : object);
            updateArrowDefaults(updates);
            return;
        }
        if (selectedObject?.type === "text") {
            const nextTextDefaults = {
                fontSize: sliderMode === "size" ? value : textDefaults.fontSize,
                rotation: sliderMode === "rotate" ? normalizeRotation(value) : textDefaults.rotation,
            };
            updateObject(selectedObject.id, (object) => object.type === "text" ? { ...object, fontSize: nextTextDefaults.fontSize, rotation: nextTextDefaults.rotation } : object);
            setTextDefaults(nextTextDefaults);
            persistToolSettings({ textFontSize: nextTextDefaults.fontSize, textRotation: nextTextDefaults.rotation });
            return;
        }
        if (tool === "brush") {
            setBrushSize(value);
            persistToolSettings({ brushSize: value });
            return;
        }
        if (tool === "arrow") {
            updateArrowDefaults(sliderMode === "size" ? { size: value } : { rotation: normalizeRotation(value) });
            return;
        }
        const nextTextDefaults = {
            fontSize: sliderMode === "size" ? value : textDefaults.fontSize,
            rotation: sliderMode === "rotate" ? normalizeRotation(value) : textDefaults.rotation,
        };
        setTextDefaults(nextTextDefaults);
        persistToolSettings({ textFontSize: nextTextDefaults.fontSize, textRotation: nextTextDefaults.rotation });
    };

    const sliderConfig = useMemo(() => {
        if (selectedObject?.type === "arrow") return sliderMode === "rotate" ? { label: "Rotate", value: selectedObject.rotation, min: 0, max: 360, step: 1, icon: <RotateRightIcon /> } : { label: "Size", value: selectedObject.size, min: 90, max: 720, step: 1, icon: <ArrowForwardIcon /> };
        if (selectedObject?.type === "text") return sliderMode === "rotate" ? { label: "Rotate", value: selectedObject.rotation, min: 0, max: 360, step: 1, icon: <RotateRightIcon /> } : { label: "Text", value: selectedObject.fontSize, min: 24, max: 170, step: 1, icon: <TextFieldsIcon /> };
        if (tool === "brush") return { label: "Brush", value: brushSize, min: 3, max: 42, step: 1, icon: <BrushIcon /> };
        if (tool === "arrow") return sliderMode === "rotate" ? { label: "Rotate", value: arrowDefaults.rotation, min: 0, max: 360, step: 1, icon: <RotateRightIcon /> } : { label: "Arrow", value: arrowDefaults.size, min: 110, max: 620, step: 1, icon: <ArrowForwardIcon /> };
        return sliderMode === "rotate" ? { label: "Rotate", value: textDefaults.rotation, min: 0, max: 360, step: 1, icon: <RotateRightIcon /> } : { label: "Text", value: textDefaults.fontSize, min: 24, max: 170, step: 1, icon: <TextFieldsIcon /> };
    }, [arrowDefaults.rotation, arrowDefaults.size, brushSize, selectedObject, sliderMode, textDefaults.fontSize, textDefaults.rotation, tool]);

    const canSwitchSliderMode = Boolean(selectedObject?.type === "arrow" || selectedObject?.type === "text" || tool !== "brush");
    const showFlipControl = selectedObject?.type === "arrow";
    const sourceCards: Array<{ source: DrawFrameSource; title: string; url?: string; icon: React.ReactNode; helper: string }> = [
        { source: "default", title: "Default", url: baseImageUrl, icon: <ImageIcon fontSize="small" />, helper: "Clean first frame" },
        { source: "drawn", title: "Drawn", url: data?.drawnImageUrl, icon: <DrawIcon fontSize="small" />, helper: "Your marked direction" },
        { source: "ai", title: "AI Upgrade", url: data?.aiImageUrl, icon: <AutoFixHighIcon fontSize="small" />, helper: "Polished director frame" },
    ];
    const previewCard = sourceCards.find((card) => card.source === previewSource && card.url);

    const toolButtonSx = (active: boolean) => ({ minHeight: matchMobile ? 38 : 40, px: matchMobile ? 1.2 : 1.8, borderRadius: 999, bgcolor: active ? themeColor : "rgba(255,255,255,0.08)", color: active ? accentText : primaryText, border: active ? "1px solid transparent" : `1px solid ${borderColor}`, fontWeight: 900, flexShrink: 0, textTransform: "none", "&:hover": { bgcolor: active ? themeColor : "rgba(255,255,255,0.14)" } });
    const actionButtonSx = { borderRadius: 2, py: 1.25, fontWeight: 900, letterSpacing: 0.1, textTransform: "none" };
    const hideableSx = { opacity: uiHidden ? 0 : 1, pointerEvents: uiHidden ? "none" : "auto", transform: uiHidden ? "translateY(8px)" : "translateY(0)", transition: "opacity 150ms ease, transform 150ms ease" };
    const canvasCursor = interactionMode === "drag" ? (uiHidden ? "grabbing" : "grab") : tool === "text" ? "text" : tool === "arrow" ? "copy" : "crosshair";
    const canUpgradeDrawing = Boolean(data?.drawnImageUrl);
    const upgradeGradient = `linear-gradient(110deg, ${alpha(themeColor, 0.88)}, ${themeColor}, ${alpha(themeColor, 0.88)})`;
    const upgradeLoadingSx = isUpgrading
        ? { background: upgradeGradient, backgroundSize: "220% 100%", animation: "drawUpgradePulse 1.15s linear infinite", color: accentText, boxShadow: `0 0 0 1px ${themeColor}, 0 16px 42px ${alpha(themeColor, 0.22)}` }
        : {};

    if (previewCard?.url) {
        const isUsingPreview = selectedSource === previewCard.source;
        return (
            <Box sx={{ width: "100%", maxWidth: "100%", minWidth: 0, flex: 1, alignSelf: "stretch", height: "100%", minHeight: 0, position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: matchMobile ? 0 : 4, bgcolor: darkMode ? "#030304" : "#f7f8fb" }}>
                <IconButton aria-label="Close image preview" onClick={() => setPreviewSource(null)} sx={{ position: "absolute", top: matchMobile ? 12 : 18, right: matchMobile ? 12 : 18, zIndex: 3, color: darkMode ? "#fff" : "#111", bgcolor: darkMode ? "rgba(0,0,0,0.58)" : "rgba(255,255,255,0.82)", border: `1px solid ${borderColor}`, backdropFilter: "blur(18px)", width: matchMobile ? 42 : 48, height: matchMobile ? 42 : 48 }}><CloseIcon /></IconButton>
                <Box sx={{ position: "absolute", left: matchMobile ? 12 : 22, top: matchMobile ? 12 : 20, right: matchMobile ? 64 : 84, zIndex: 2, display: "flex", alignItems: "center", gap: 1, minWidth: 0, color: darkMode ? "#fff" : "#111" }}>
                    {previewCard.icon}
                    <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 950, fontSize: matchMobile ? "0.95rem" : "1.05rem", lineHeight: 1.05 }}>{previewCard.title}</Typography>
                        <Typography sx={{ color: mutedText, fontWeight: 800, fontSize: "0.75rem" }}>{previewCard.helper}</Typography>
                    </Box>
                </Box>
                <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", p: matchMobile ? "70px 10px 96px" : "76px 32px 104px" }}>
                    <img src={previewCard.url} alt={previewCard.title} style={{ width: "auto", height: "auto", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: matchMobile ? 14 : 20, boxShadow: "0 28px 90px rgba(0,0,0,0.58)" }} />
                </Box>
                <Box sx={{ position: "absolute", left: "50%", bottom: matchMobile ? "calc(16px + env(safe-area-inset-bottom))" : 24, transform: "translateX(-50%)", zIndex: 2, display: "flex", gap: 1, width: matchMobile ? "calc(100% - 28px)" : "auto", justifyContent: "center" }}>
                    <Button disabled={isUsingPreview} onClick={() => onUseSource(previewCard.source)} startIcon={isUsingPreview ? <CheckCircleIcon /> : undefined} sx={{ minWidth: matchMobile ? 0 : 170, flex: matchMobile ? 1 : "0 0 auto", bgcolor: isUsingPreview ? themeColor : panelBg, color: isUsingPreview ? accentText : primaryText, border: `1px solid ${isUsingPreview ? themeColor : borderColor}`, borderRadius: 999, px: 2.5, py: 1.1, fontWeight: 950, backdropFilter: "blur(18px)", textTransform: "none" }}>{isUsingPreview ? "Using This" : "Use This Frame"}</Button>
                </Box>
            </Box>
        );
    }

    return (
        <Box data-draw-frame-director="true" sx={{ width: "100%", maxWidth: "100%", minWidth: 0, flex: 1, alignSelf: "stretch", height: "100%", minHeight: 0, display: "grid", gridTemplateColumns: matchMobile ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(286px, 340px)", gap: matchMobile ? 1.2 : 1.5, overflow: matchMobile ? "visible" : "hidden", pb: matchMobile ? "calc(14px + env(safe-area-inset-bottom))" : 0, "@keyframes drawUpgradePulse": { "0%": { backgroundPosition: "0% 50%" }, "100%": { backgroundPosition: "220% 50%" } } }}>
            <Box sx={{ minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column", gap: matchMobile ? 1 : 1.15 }}>
                <Box sx={{ position: "relative", flex: matchMobile ? "0 0 auto" : 1, minHeight: matchMobile ? "min(44dvh, 480px)" : 0, height: matchMobile ? "auto" : "100%", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: matchMobile ? 3 : 4, bgcolor: stageBg, border: `1px solid ${borderColor}`, overflow: "hidden", p: matchMobile ? 1 : 2, boxShadow: darkMode ? "inset 0 1px 0 rgba(255,255,255,0.04), 0 24px 70px rgba(0,0,0,0.34)" : "0 24px 70px rgba(0,0,0,0.08)" }}>
                    {baseImageUrl ? (
                        <canvas
                            ref={canvasRef}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={stopPointerInteraction}
                            onPointerCancel={stopPointerInteraction}
                            onPointerLeave={() => { if (activeInteractionRef.current?.type === "brush") stopPointerInteraction(); }}
                            style={{ display: "block", maxWidth: "100%", maxHeight: matchMobile ? "44dvh" : "calc(100dvh - 218px)", width: "auto", height: "auto", touchAction: "none", borderRadius: matchMobile ? 14 : 18, boxShadow: "0 22px 70px rgba(0,0,0,0.5)", cursor: canvasCursor, background: "#111" }}
                        />
                    ) : <Typography sx={{ color: mutedText, fontWeight: 800 }}>No first-frame image available.</Typography>}

                    {baseImageUrl && (
                        <Box data-draw-frame-director="true" onPointerDown={(event) => event.stopPropagation()} sx={{ position: "absolute", left: matchMobile ? 10 : 14, top: "50%", transform: uiHidden ? "translate(-8px, -50%)" : "translate(0, -50%)", zIndex: 5, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.75, p: 0.75, borderRadius: 999, bgcolor: darkMode ? "rgba(8,8,10,0.58)" : "rgba(255,255,255,0.68)", border: `1px solid ${borderColor}`, backdropFilter: "blur(22px)", boxShadow: "0 18px 48px rgba(0,0,0,0.26)", opacity: uiHidden ? 0 : 1, pointerEvents: uiHidden ? "none" : "auto", transition: "opacity 150ms ease, transform 150ms ease" }}>
                            <IconButton aria-label="Switch draw control" disabled={!canSwitchSliderMode} onClick={() => setSliderMode((mode) => mode === "size" ? "rotate" : "size")} sx={{ width: 42, height: 42, color: accentText, bgcolor: themeColor, opacity: canSwitchSliderMode ? 1 : 0.72, "&:hover": { bgcolor: themeColor } }}>{sliderMode === "rotate" ? <RotateRightIcon /> : sliderConfig.icon}</IconButton>
                            <Slider orientation="vertical" min={sliderConfig.min} max={sliderConfig.max} step={sliderConfig.step} value={sliderConfig.value} onChange={(_, value) => updateSliderValue(value as number)} sx={{ color: themeColor, height: matchMobile ? 168 : 220, py: 1, "& .MuiSlider-thumb": { width: 24, height: 24, border: "3px solid rgba(0,0,0,0.35)" }, "& .MuiSlider-track": { width: 8 }, "& .MuiSlider-rail": { width: 8, opacity: 0.3 } }} />
                            <Typography sx={{ color: primaryText, fontSize: 10, lineHeight: 1, fontWeight: 950, writingMode: "vertical-rl", textTransform: "uppercase", letterSpacing: 0.5 }}>{sliderConfig.label}</Typography>
                            {showFlipControl && <IconButton aria-label="Flip arrow" onClick={() => { if (selectedObject) updateObject(selectedObject.id, (object) => object.type === "arrow" ? { ...object, flipped: !object.flipped } : object); }} sx={{ width: 38, height: 38, color: primaryText, bgcolor: "rgba(255,255,255,0.11)", border: `1px solid ${borderColor}` }}><SwapHorizIcon /></IconButton>}
                        </Box>
                    )}
                </Box>

                {localError && <Typography sx={{ color: "#ff8b8b", fontWeight: 900, fontSize: 13 }}>{localError}</Typography>}
                <Box sx={{
                    ...hideableSx,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: matchMobile ? "center" : "flex-start",
                    flexWrap: matchMobile ? "wrap" : "nowrap",
                    gap: 0.8,
                    overflowX: matchMobile ? "visible" : "auto",
                    overflowY: "visible",
                    scrollbarWidth: "none",
                    position: matchMobile ? "sticky" : "static",
                    bottom: matchMobile ? "max(8px, env(safe-area-inset-bottom))" : "auto",
                    zIndex: matchMobile ? 7 : "auto",
                    py: matchMobile ? 1 : 0.5,
                    px: matchMobile ? 0.75 : 0,
                    bgcolor: matchMobile ? panelBg : "transparent",
                    border: matchMobile ? `1px solid ${borderColor}` : "none",
                    borderRadius: matchMobile ? 2.5 : 0,
                    boxShadow: matchMobile ? "0 16px 42px rgba(0,0,0,0.28)" : "none",
                    "&::-webkit-scrollbar": { display: "none" },
                }}>
                    <Button onClick={() => setInteractionMode("draw")} startIcon={<DrawIcon />} sx={toolButtonSx(interactionMode === "draw")}>Draw</Button>
                    <Button onClick={() => setInteractionMode("drag")} startIcon={<OpenWithIcon />} sx={toolButtonSx(interactionMode === "drag")}>Drag</Button>
                    <Button onClick={() => selectTool("arrow")} startIcon={<ArrowForwardIcon />} sx={toolButtonSx(tool === "arrow" && interactionMode === "draw")}>Arrow</Button>
                    <Button onClick={() => selectTool("brush")} startIcon={<BrushIcon />} sx={toolButtonSx(tool === "brush" && interactionMode === "draw")}>Brush</Button>
                    <Button onClick={() => selectTool("text")} startIcon={<TextFieldsIcon />} sx={toolButtonSx(tool === "text" && interactionMode === "draw")}>Text</Button>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.65, flexShrink: 0, px: 0.3 }}>
                        {swatches.map((color) => <IconButton key={color} aria-label={`Use ${color} brush`} onClick={() => handleBrushColorChange(color)} sx={{ width: matchMobile ? 32 : 34, height: matchMobile ? 32 : 34, bgcolor: color, border: brushColor === color ? `3px solid ${themeColor}` : "2px solid rgba(255,255,255,0.48)", boxShadow: brushColor === color ? "0 0 0 2px rgba(0,0,0,0.55)" : "none", flexShrink: 0, "&:hover": { bgcolor: color } }} />)}
                    </Box>
                    <IconButton aria-label="Undo" onClick={handleUndo} sx={{ color: primaryText, bgcolor: "rgba(255,255,255,0.09)", border: `1px solid ${borderColor}`, flexShrink: 0 }}><UndoIcon /></IconButton>
                    <IconButton aria-label="Clear marks" onClick={handleClear} sx={{ color: primaryText, bgcolor: "rgba(255,255,255,0.09)", border: `1px solid ${borderColor}`, flexShrink: 0 }}><DeleteSweepIcon /></IconButton>
                </Box>
            </Box>

            <Box sx={{ ...hideableSx, minHeight: 0, overflowY: matchMobile ? "visible" : "auto", display: "flex", flexDirection: "column", gap: 1.35, pr: matchMobile ? 0 : 0.5, pb: matchMobile ? 1 : 0, scrollbarWidth: "thin" }}>
                <Box sx={{ bgcolor: panelBg, border: `1px solid ${borderColor}`, borderRadius: 3, p: matchMobile ? 1.5 : 1.75, backdropFilter: "blur(22px)", boxShadow: darkMode ? "0 18px 50px rgba(0,0,0,0.22)" : "0 18px 50px rgba(0,0,0,0.08)" }}>
                    <Typography sx={{ fontWeight: 900, color: themeColor, letterSpacing: 0.8, textTransform: "uppercase", fontSize: 12, mb: 1 }}>Director Notes</Typography>
                    <TextField multiline minRows={matchMobile ? 2 : 4} fullWidth value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add camera direction: slow push in, pan right, reveal window, hold on subject..." sx={{ mb: 1, "& .MuiOutlinedInput-root": { color: primaryText, bgcolor: darkMode ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.04)", borderRadius: 2, fontWeight: 700 }, "& fieldset": { borderColor } }} />
                    <TextField size="small" fullWidth value={stampText} onChange={(event) => handleStampTextChange(event.target.value)} placeholder="Text to stamp on image" sx={{ "& .MuiOutlinedInput-root": { color: primaryText, bgcolor: darkMode ? "rgba(255,255,255,0.055)" : "rgba(0,0,0,0.04)", borderRadius: 2, fontWeight: 800 }, "& fieldset": { borderColor } }} />
                    <Button fullWidth disabled={!baseImageUrl || isSaving} onClick={handleSave} startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <DrawIcon />} sx={{ mt: 1.25, bgcolor: themeColor, color: accentText, ...actionButtonSx, "&:hover": { bgcolor: themeColor, opacity: 0.92 } }}>{isSaving ? "Saving Drawing" : "Save Drawn Image"}</Button>
                    <Button
                        fullWidth
                        disabled={!canUpgradeDrawing}
                        aria-disabled={!canUpgradeDrawing || isUpgrading}
                        onClick={() => { if (!isUpgrading && canUpgradeDrawing) onUpgradeDrawing(note); }}
                        startIcon={isUpgrading ? <CircularProgress size={16} color="inherit" /> : <AutoFixHighIcon />}
                        sx={{
                            mt: 1,
                            bgcolor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)",
                            color: primaryText,
                            pointerEvents: isUpgrading ? "none" : "auto",
                            ...actionButtonSx,
                            ...upgradeLoadingSx,
                            "&:hover": { bgcolor: darkMode ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.1)", ...upgradeLoadingSx },
                            "&.Mui-disabled": {
                                bgcolor: darkMode ? "rgba(255,255,255,0.075)" : "rgba(0,0,0,0.05)",
                                color: darkMode ? "rgba(255,255,255,0.48)" : "rgba(0,0,0,0.42)",
                                opacity: 1,
                            },
                        }}
                    >
                        {isUpgrading ? "Upgrading Drawing" : "AI Upgrade Drawing"}
                    </Button>
                </Box>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 1, overflowX: "visible", pb: matchMobile ? 1.5 : 0, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
                    {sourceCards.map((card) => {
                        const isAvailable = Boolean(card.url);
                        const isUsing = selectedSource === card.source;
                        const isAiCard = card.source === "ai";
                        return (
                            <Box key={card.source} sx={{ bgcolor: panelBg, border: `1px solid ${isAiCard && isUpgrading ? themeColor : isUsing ? themeColor : borderColor}`, borderRadius: 3, overflow: "hidden", backdropFilter: "blur(22px)", boxShadow: isAiCard && isUpgrading ? `0 0 0 1px ${themeColor}, 0 16px 42px ${alpha(themeColor, 0.2)}` : isUsing ? `0 0 0 1px ${themeColor}, 0 16px 42px ${alpha(themeColor, darkMode ? 0.16 : 0.14)}` : "none", ...(isAiCard && isUpgrading ? { background: upgradeGradient, backgroundSize: "220% 100%", animation: "drawUpgradePulse 1.15s linear infinite" } : {}) }}>
                                <Box sx={{ display: "grid", gridTemplateColumns: "74px 1fr", gap: 1, p: 1 }}>
                                    <Box onClick={() => { if (isAvailable) setPreviewSource(card.source); }} sx={{ position: "relative", width: 74, aspectRatio: "9/16", borderRadius: 2, overflow: "hidden", bgcolor: "rgba(255,255,255,0.065)", display: "flex", alignItems: "center", justifyContent: "center", color: mutedText, cursor: isAvailable ? "zoom-in" : "default" }}>
                                        {card.url ? <><img src={card.url} alt={card.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /><Box sx={{ position: "absolute", top: 5, right: 5, width: 24, height: 24, borderRadius: "50%", bgcolor: "rgba(0,0,0,0.62)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)" }}><OpenInFullIcon sx={{ fontSize: 14 }} /></Box></> : card.icon}
                                    </Box>
                                    <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                        <Box>
                                            <Typography sx={{ fontWeight: 950, color: primaryText, display: "flex", alignItems: "center", gap: 0.75 }}>{card.icon}{card.title}</Typography>
                                            <Typography sx={{ fontSize: 12, color: mutedText, mt: 0.25, fontWeight: 700 }}>{card.helper}</Typography>
                                        </Box>
                                        <Button disabled={!isAvailable || isUsing} onClick={() => onUseSource(card.source)} startIcon={isUsing ? <CheckCircleIcon /> : undefined} sx={{ alignSelf: "flex-start", mt: 1, px: 1.6, py: 0.65, minHeight: 30, borderRadius: 999, bgcolor: isUsing ? themeColor : "rgba(255,255,255,0.08)", color: isUsing ? accentText : primaryText, fontWeight: 900, textTransform: "none" }}>{isUsing ? "Using" : "Use"}</Button>
                                    </Box>
                                </Box>
                            </Box>
                        );
                    })}
                </Box>

                <Button onClick={handleResetAll} sx={{ color: darkMode ? "#ffb3b3" : "#9b1c1c", borderRadius: 2, fontWeight: 900, alignSelf: matchMobile ? "stretch" : "flex-start", px: 2, textTransform: "none" }}>Reset Draw Mode</Button>
            </Box>
        </Box>
    );
}









