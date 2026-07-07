import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import {
    Box,
    Slider,
    TextField,
    Button,
    IconButton,
    useTheme,
    useMediaQuery,
    Typography,
    Tooltip
} from "@mui/material";

// Icons
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
// FormatItalicIcon removed
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'; // Shine
import TextFormatIcon from '@mui/icons-material/TextFormat'; // Outline
import LayersIcon from '@mui/icons-material/Layers'; // Shadow
import BrandingWatermarkIcon from '@mui/icons-material/BrandingWatermark'; // Bg/Padding
import FormatPaintIcon from '@mui/icons-material/FormatPaint';

import { matchMobile } from "./DetectDevice";
import { useSelector, useDispatch } from "react-redux";
import { setArtstyle, setModel, setPromptRed } from "./settingsSlice";
import { RootState, AppDispatch } from "./store";

interface ThumbnailCreatorProps {
    image: string | Blob;
    title?: string;
    PostId?: any;
    isMenuOpen?: boolean;
    closeT?: any;
    type: number;
    prompt: any;
    setGeneratedImage: any
    steps: any;
    DummyMode: any;
    minimizeMode?: number;
}

// --- EXPANDED FONT LIST ---
const FONT_FAMILIES_PRO = [
    "Anton",          // Heavy Display
    "Bebas Neue",     // Tall Condensed
    "Bangers",        // Comic/YouTuber
    "Oswald",         // Standard Clean
    "DynaPuff",       // Fun/Round
    "Roboto Slab",    // Modern Serif
    "Permanent Marker", // Marker
    "Lobster",        // Fancy Script
    "Abril Fatface",  // Elegant
    "Montserrat",     // Clean Geometric
];

const FONT_FAMILIES = matchMobile ? FONT_FAMILIES_PRO : FONT_FAMILIES_PRO;

const rgbToHex = (r: number, g: number, b: number) =>
    "#" +
    [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }).join("");

// Helper for gradient generation (Shine effect)
const shadeColor = (color: string, percent: number) => {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = Math.floor(R * (100 + percent) / 100);
    G = Math.floor(G * (100 + percent) / 100);
    B = Math.floor(B * (100 + percent) / 100);

    return "#" +
        ((R < 255 ? R : 255).toString(16).padStart(2, '0')) +
        ((G < 255 ? G : 255).toString(16).padStart(2, '0')) +
        ((B < 255 ? B : 255).toString(16).padStart(2, '0'));
};

const Thumbnail: React.FC<ThumbnailCreatorProps> = ({
    image, title, isMenuOpen, PostId, closeT, type, prompt, setGeneratedImage, steps, DummyMode, minimizeMode
}) => {
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

    const [load, setload] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);

    // --- TEXT STYLING STATE ---
    const [fontSize, setFontSize] = useState(85);
    const [fontIndex, setFontIndex] = useState(0);

    // Toggles
    const [hasShadow, setHasShadow] = useState(true);
    const [hasOutline, setHasOutline] = useState(true);

    // Shine: 0=Off, 1=Light, 2=Dark, 3=Glossy, 4=Chrome, 5=Deep
    const [shineMode, setShineMode] = useState(0);

    // BG: 0=Off, 1=Black, 2=White, 3=BlackGlass, 4=WhiteGlass
    const [bgMode, setBgMode] = useState(0);

    const [textEx, settextEx] = useState<string>('');
    const [text, setText] = useState(type === 0 ? '' : title || "");
    const [text2, setText2] = useState(title || "");

    const [clickPos, setClickPos] = useState({ x: 0.5, y: 0.5 });
    const [isDragging, setIsDragging] = useState(false);

    const dispatch = useDispatch();

    // S3 upload states
    const [error, setError] = useState<string | null>(null);
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

    // Color picker
    const [APPCOLOR, SetAPPCOLOR] = useState("#F6BB56");
    const [showPicker, setShowPicker] = useState(false);
    const [textColor, setTextColor] = useState("#ffffff");

    // Sync APPCOLOR with textColor
    useEffect(() => { SetAPPCOLOR(textColor); }, [textColor]);

    // Pan/Crop State
    const [cropMode, setCropMode] = useState(false);
    const [canCrop, setCanCrop] = useState(false);
    const [showCropBtn, setShowCropBtn] = useState(false);
    const [panX, setPanX] = useState(0);
    const panLimits = useRef({ min: 0, max: 0 });
    const lastTouchX = useRef<number | null>(null);
    const lastMouseX = useRef<number | null>(null);

    const clampPan = useCallback((x: number) => {
        const { min, max } = panLimits.current;
        return Math.max(min, Math.min(max, x));
    }, []);

    // Load Image
    useEffect(() => {
        if (!image) { setLoadedImage(null); return; }
        const img = new Image();
        let url: string | null = null;
        if (image instanceof Blob) {
            url = URL.createObjectURL(image);
            img.src = url;
        } else {
            if (!image.startsWith("data:")) img.crossOrigin = "anonymous";
            img.src = image;
        }
        img.onload = () => setLoadedImage(img);
        img.onerror = () => setLoadedImage(null);
        return () => { if (url) URL.revokeObjectURL(url); };
    }, [image]);

    // 1) Position text near bottom once image loads
    useEffect(() => {
        const c = canvasRef.current;
        if (loadedImage && c) {
            const cssH = c.parentElement!.clientHeight;
            setClickPos({ x: 0.5, y: (cssH - 350) / cssH });
        }
    }, [loadedImage]);

    // 2) RESTORED AUTO-COLOR PICKER
    useEffect(() => {
        if (!loadedImage) return;
        const off = document.createElement("canvas");
        off.width = loadedImage.naturalWidth;
        off.height = loadedImage.naturalHeight;
        const ctx = off.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(loadedImage, 0, 0);
        const { data } = ctx.getImageData(0, 0, off.width, off.height);
        const arr: { lum: number; r: number; g: number; b: number }[] = [];
        const step = 4 * 10;
        for (let i = 0; i < data.length; i += step) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (lum < 230) arr.push({ lum, r, g, b });
        }
        if (!arr.length) { setTextColor("#ffffff"); return; }
        arr.sort((a, b) => b.lum - a.lum);
        const top = Math.max(1, Math.floor(arr.length * 0.1));
        let sumR = 0, sumG = 0, sumB = 0;
        for (let i = 0; i < top; i++) { sumR += arr[i].r; sumG += arr[i].g; sumB += arr[i].b; }
        setTextColor(rgbToHex(
            Math.round(sumR / top),
            Math.round(sumG / top),
            Math.round(sumB / top)
        ));
    }, [loadedImage]);

    const TARGET_W = 600;
    const TARGET_H = 1067;
    const [fontVersion, setFontVersion] = useState(0);
    const [fontReady, setFontReady] = useState(true);

    // --- MAIN RENDER LOOP ---
    useEffect(() => {
        const c = canvasRef.current;
        if (!c || !loadedImage) return;

        const ctx = c.getContext("2d")!;
        const PREVIEW_WIDTH = 600;
        const rect = c.getBoundingClientRect();

        const visualAspect = (rect.height > 0)
            ? rect.width / rect.height
            : loadedImage.naturalWidth / loadedImage.naturalHeight;

        c.width = PREVIEW_WIDTH;
        c.height = PREVIEW_WIDTH / visualAspect;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";

        const W = c.width;
        const H = c.height;

        // 1. Draw Image
        ctx.clearRect(0, 0, W, H);
        const imgW = loadedImage.naturalWidth;
        const imgH = loadedImage.naturalHeight;
        const scale = Math.max(W / imgW, H / imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const offsetX = (W - drawW) / 2;
        const offsetY = (H - drawH) / 2;

        const extraW = drawW - W;
        const canCropNow = extraW > 4;
        if (canCrop !== canCropNow) setCanCrop(canCropNow);
        if (showCropBtn !== canCropNow) setShowCropBtn(canCropNow);

        if (canCropNow) {
            const min = -(extraW / 2);
            const max = (extraW / 2);
            panLimits.current = { min, max };
            if (panX < min || panX > max) setPanX(clampPan(panX));
        } else if (panX !== 0) {
            setPanX(0);
        }

        ctx.drawImage(loadedImage, offsetX + panX, offsetY, drawW, drawH);

        // --- 2. Text Rendering (HIDDEN - AI now generates text on image) ---
        if (false && type !== 0) {
            const content = text;
            if (!content || !fontReady) return;

            const sz = Math.round((fontSize * W) / TARGET_W);
            const famName = FONT_FAMILIES[fontIndex];
            const weight = "900";

            // Removed Italics Logic here
            ctx.font = `normal ${weight} ${sz}px "${famName}"`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            const maxW = W * 0.9;
            const words = content.trim().split(/\s+/);
            const lines: string[] = [];
            let curr = "";

            for (const w of words) {
                const test = curr ? curr + " " + w : w;
                if (ctx.measureText(test).width > maxW && curr) {
                    lines.push(curr);
                    curr = w;
                } else {
                    curr = test;
                }
            }
            if (curr) lines.push(curr);

            const lh = sz * 1.15;
            const blockH = lines.length * lh;

            let yCenter = clickPos.y * H;
            if (yCenter - blockH / 2 < 0) yCenter = blockH / 2;
            if (yCenter + blockH / 2 > H) yCenter = H - blockH / 2;

            const startY = yCenter - (blockH / 2) + (lh / 2);

            lines.forEach((line, i) => {
                const y = startY + (i * lh);
                const x = W / 2;

                ctx.save();

                // A. Background Box Logic (Multi-state)
                if (bgMode !== 0) {
                    const metrics = ctx.measureText(line);
                    const bgPadding = sz * 0.2;
                    // INCREASED PADDING HERE: Multiplier raised from 0.9 to 1.3
                    const bgH = sz * 1.3;

                    let fillStyle = "rgba(0,0,0,1)";
                    if (bgMode === 1) fillStyle = "rgba(0,0,0,1)"; // Black
                    else if (bgMode === 2) fillStyle = "rgba(255,255,255,1)"; // White
                    else if (bgMode === 3) fillStyle = "rgba(0,0,0,0.5)"; // Black Glass
                    else if (bgMode === 4) fillStyle = "rgba(255,255,255,0.5)"; // White Glass

                    ctx.fillStyle = fillStyle;
                    const bgW = metrics.width + (bgPadding * 4);
                    ctx.fillRect(x - bgW / 2, y - bgH / 2, bgW, bgH);
                }

                // B. Shadow
                if (hasShadow) {
                    ctx.shadowColor = "rgba(0,0,0,0.75)";
                    ctx.shadowBlur = 15;
                    ctx.shadowOffsetX = 4;
                    ctx.shadowOffsetY = 8;
                } else {
                    ctx.shadowColor = "transparent";
                }

                // C. Outline
                if (hasOutline) {
                    ctx.lineJoin = "round";
                    ctx.miterLimit = 2;
                    ctx.lineWidth = sz * 0.08;
                    ctx.strokeStyle = "black";
                    ctx.strokeText(line, x, y);
                }

                // D. Fill & Shine (Multi-state)
                if (shineMode !== 0) {
                    const grad = ctx.createLinearGradient(0, y - sz / 2, 0, y + sz / 2);

                    if (shineMode === 1) {
                        // Light Shine
                        grad.addColorStop(0, "white");
                        grad.addColorStop(0.3, textColor);
                        grad.addColorStop(0.6, shadeColor(textColor, -20));
                        grad.addColorStop(1, shadeColor(textColor, -40));
                    } else if (shineMode === 2) {
                        // Dark Shine
                        grad.addColorStop(0, shadeColor(textColor, -60));
                        grad.addColorStop(0.3, textColor);
                        grad.addColorStop(0.6, shadeColor(textColor, 40));
                        grad.addColorStop(1, "white");
                    } else if (shineMode === 3) {
                        // Glossy (Hard Edge)
                        grad.addColorStop(0, "white");
                        grad.addColorStop(0.49, textColor);
                        grad.addColorStop(0.5, shadeColor(textColor, -30));
                        grad.addColorStop(1, shadeColor(textColor, -50));
                    } else if (shineMode === 4) {
                        // Chrome/Metallic
                        grad.addColorStop(0, shadeColor(textColor, 50));
                        grad.addColorStop(0.2, shadeColor(textColor, -20));
                        grad.addColorStop(0.5, "white");
                        grad.addColorStop(0.8, shadeColor(textColor, -20));
                        grad.addColorStop(1, shadeColor(textColor, 50));
                    } else if (shineMode === 5) {
                        // Deep Fade
                        grad.addColorStop(0, textColor);
                        grad.addColorStop(1, shadeColor(textColor, -80));
                    }

                    ctx.fillStyle = grad;
                } else {
                    ctx.fillStyle = textColor;
                }

                ctx.fillText(line, x, y);
                ctx.restore();
            });
        }

    }, [
        loadedImage, text, text2, type, fontSize, clickPos, fontIndex,
        textColor, fontReady, fontVersion, panX, hasShadow,
        hasOutline, shineMode, bgMode, canCrop, showCropBtn, clampPan
    ]);

    // --- INTERACTION HANDLERS ---
    const updatePos = (cx: number, cy: number) => {
        const c = canvasRef.current; if (!c) return;
        const rect = c.getBoundingClientRect();
        setClickPos({
            x: Math.min(Math.max((cx - rect.left) / rect.width, 0), 1),
            y: Math.min(Math.max((cy - rect.top) / rect.height, 0), 1)
        });
    };

    const onDown = (e: React.MouseEvent) => {
        if (cropMode) { lastMouseX.current = e.clientX; }
        else if (type !== 0) { updatePos(e.clientX, e.clientY); }
        setIsDragging(true);
    };

    const onMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        if (cropMode) {
            if (lastMouseX.current == null) lastMouseX.current = e.clientX;
            const dx = e.clientX - lastMouseX.current;
            lastMouseX.current = e.clientX;
            setPanX(prev => clampPan(prev + dx));
        } else if (type !== 0) { updatePos(e.clientX, e.clientY); }
    };

    const onUp = () => { setIsDragging(false); lastMouseX.current = null; };

    const onTouch = (e: React.TouchEvent, end = false) => {
        if (end) { setIsDragging(false); lastTouchX.current = null; return; }
        if (!e.touches.length) return;

        if (isDragging || cropMode) e.preventDefault();

        const t = e.touches[0];
        if (cropMode) {
            if (lastTouchX.current == null) lastTouchX.current = t.clientX;
            const dx = t.clientX - lastTouchX.current;
            lastTouchX.current = t.clientX;
            setIsDragging(true);
            setPanX(prev => clampPan(prev + dx));
        } else if (type !== 0) {
            updatePos(t.clientX, t.clientY);
            setIsDragging(true);
        }
    };

    // --- S3 & SAVE LOGIC ---
    const CLIK_URL = import.meta.env.VITE_CLIK_URL;

    // 1. Generate Signed URL
    const GenerateSignedUrl = useCallback(async (
        blob: Blob,
        enhancedTextData: any,
        type: any
    ) => {
        if (!blob) { setError("Image blob missing."); return; }
        try {
            setload(true);
            const resp: any = await axios.post(
                `${CLIK_URL}/get_signed_url_image`,
                { values: { count: 2 } },
                { withCredentials: true }
            );
            const holder = resp.data.holder;
            if (!holder || holder.length !== 1) throw new Error("Invalid signed URL");
            const signed = holder[0];
            if (!signed.urlBase || !signed.urlHD) throw new Error("Missing URLs");
            await PutImagesInS3WithURL(blob, signed, enhancedTextData, type);
        } catch (err: any) {
            setload(false);
            setError(err.message || "Error generating signed URL");
        }
    }, [CLIK_URL, PostId, prompt, textEx, text2, DummyMode, text]);

    // 2. Put Image to S3
    const PutImagesInS3WithURL = useCallback(async (
        blob: Blob,
        signedUrls: any,
        enhancedTextData: any,
        type: any
    ) => {
        if (!signedUrls.urlHD) { setError("Signed URL not available"); return; }
        try {
            setload(true);
            const up = await axios.put(signedUrls.urlHD, blob, {
                headers: { "Content-Type": blob.type || "application/octet-stream" }
            });
            if (![200, 204].includes(up.status)) {
                throw new Error(`Upload failed: ${up.status}`);
            }
            const finalUrl = signedUrls.urlHD.split("?")[0];
            setUploadedUrl(finalUrl);

            var Data = ({
                postId: PostId,
                finalUrl: finalUrl,
                caption: type === 0 ? text2 : prompt,
            });

            saveToDatabase(Data);
            console.log("Uploaded to S3 thumbnail:", finalUrl);
        } catch (err: any) {
            setload(false);
            setError(err.message || "Upload error");
        }
    }, [PostId, prompt, textEx, text2, DummyMode, text]);

    // 4. Classify (Tags)
    const [tags, setTags] = useState<string[]>([]);
    const [categories, setCategories] = useState<string[]>([]);

    // 3. Save to DB
    const saveToDatabase = useCallback((Data: any) => {
        setload(true);
        axios.put(`${CLIK_URL}/UpdatePostThumb`, { values: Data })
            .then((response) => {
                if (response) {
                    dispatch(setPromptRed(''));
                    Classify();
                }
            })
            .catch((error) => {
                setload(false);
                console.log(error);
            });
    }, [PostId, prompt, tags, categories, textEx, text2, text, DummyMode]);



    const Classify = useCallback(async () => {
        setError("");
        try {
            const fallbackCaption = type === 0 ? text2 : text;
            const captionToSend = DummyMode ? textEx : fallbackCaption;

            //alert(captionToSend);

            const requestData = { caption: captionToSend };
            const url = "GptTagger";
            const { data }: { data: { tags: string[]; categories: string[] } } =
                await axios.post(`${CLIK_URL}/${url}`, requestData, { withCredentials: true });

            console.log("Tags âžœ", data.tags);
            console.log("Categories âžœ", data.categories);
            setTags(data.tags);
            setCategories(data.categories);
            saveClassify(data.tags, data.categories, captionToSend);
        } catch (err: any) {
            setload(false);
            if (err.response) {
                console.error("Server Error:", err.response.data);
                setError(err.response.data.message || "Server Error");
            } else if (err.request) {
                console.error("No response received:", err.request);
                setError("Network Error: No response received from server.");
            } else {
                console.error("Error:", err.message);
                setError(err.message);
            }
        }
    }, [PostId, prompt, tags, categories, textEx, text2, text, DummyMode]);

    // 5. Save Caption Only
    const saveCaption = useCallback((Data: any) => {
        setload(true);
        axios.put(`${CLIK_URL}/UpdatePostCaption`, { values: Data })
            .then((response) => {
                if (response) {
                    Classify();
                }
            })
            .catch((error) => {
                setload(false);
                console.log(error);
            });
    }, [PostId, prompt, tags, categories, textEx, text2, text, DummyMode]);

    // 6. Save Classification
    const saveClassify = useCallback((tagsx: any, categoriesx: any, sentCaption: string) => {
        axios.put(`${CLIK_URL}/InsertPostSearch`, {
            postId: PostId,
            caption: sentCaption,
            tags: tagsx,
            categories: categoriesx
        }, { withCredentials: true })
            .then((response) => {
                console.log("Saved search data:", response.data);
                setGeneratedImage([]);
                closeT();
            })
            .catch((error) => {
                setload(false);
                console.error("Save error:", error);
                setError("Failed to save search data");
            });
    }, [PostId]);

    // utility to detect iPhone
    function isIphone(): boolean {
        return /iPhone/i.test(navigator.userAgent);
    }

    // --- MAIN UPLOAD HANDLER ---
    const handleUpload = (type: any, textVal: any, PostId: any, prompt: any) => {
        const contentToSave = type === 0 ? text2 : text;

        if (steps.length === 1) {
            const Data = {
                postId: PostId,
                caption: contentToSave,
            };
            saveCaption(Data);
        } else {
            const c = canvasRef.current;
            if (!c) return setError("Canvas not ready");

            const format = isIphone() ? "image/jpeg" : "image/webp";
            const quality = isIphone() ? 0.8 : undefined;

            c.toBlob(
                blob => {
                    if (!blob) return setError("Failed to get blob");
                    GenerateSignedUrl(blob, { text: contentToSave }, type);
                },
                format,
                quality
            );
        }
    };

    const handleFontSelect = (index: number) => {
        setFontReady(false);
        const fam = FONT_FAMILIES[index];
        document.fonts.load(`900 1em "${fam}"`).then(() => {
            setFontIndex(index);
            setFontReady(true);
            setFontVersion(v => v + 1);
        }).catch(() => {
            setFontIndex(index);
            setFontReady(true);
        });
    };

    const gutter = theme.spacing(1);
    const desktopWidth = "100%";
    const mobileWidth = `calc(100% - ${theme.spacing(2)})`;

    return (
        <Box sx={{
            position: "relative", width: "100vw", height: "100vh",
            backgroundColor: "rgba(0,0,0,0.9)", display: "flex",
            justifyContent: "center", alignItems: "center",
        }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                    position: "relative",
                    top: matchMobile ? "-5vh" : isMenuOpen ? "" : "-4vh",
                    left: matchMobile ? "" : (isMenuOpen && minimizeMode !== 0) ? "-10vw" : "",
                    height: "90vh", width: isDesktop ? "auto" : "90vw",
                }}
            >
                <div style={{
                    position: 'relative', height: isDesktop ? '90vh' : '80vh',
                    aspectRatio: '9 / 16', maxWidth: 'calc(90vh * 9 / 16)',
                }}>
                    <canvas
                        ref={canvasRef}
                        onMouseDown={onDown} onMouseMove={onMove}
                        onMouseUp={onUp} onMouseLeave={onUp}
                        onTouchStart={e => onTouch(e)} onTouchMove={e => onTouch(e)}
                        onTouchEnd={e => onTouch(e, true)}
                        style={{
                            display: "block", width: "100%", height: "100%",
                            borderRadius: theme.shape.borderRadius,
                            cursor: cropMode ? "ew-resize" : (type === 0 ? "default" : "grab"),
                            filter: load ? "blur(4px)" : "none",
                            border: `1px solid ${APPCOLOR}`,
                            touchAction: "none"
                        }}
                    />
                </div>

                {/* --- COLOR PICKER (HIDDEN) --- */}
                <AnimatePresence>
                    {false && showPicker && type !== 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            style={{
                                position: "absolute", top: gutter, left: gutter,
                                zIndex: 20, background: "rgba(20,20,20,0.95)",
                                padding: "10px", borderRadius: "12px", border: "1px solid #333"
                            }}
                        >
                            <Box sx={{ position: "relative" }}>
                                <input
                                    type="color"
                                    value={textColor}
                                    onChange={e => setTextColor(e.target.value)}
                                    style={{ width: "60px", height: "60px", border: "none", cursor: "pointer", background: "none" }}
                                />
                                <IconButton
                                    size="small" onClick={() => setShowPicker(false)}
                                    sx={{ position: "absolute", top: -8, right: -8, color: "#fff", background: "#000" }}
                                >
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* --- TOP TOOLBAR (Crop + Font Wheel) - HIDDEN --- */}
                {false && type !== 0 && (
                    <Box sx={{
                        position: "absolute", top: -60, left: 0, right: 0,
                        display: "flex", flexDirection: "column", gap: 1
                    }}>
                        <Box sx={{
                            display: "flex", overflowX: "auto", gap: 2, p: 1,
                            "&::-webkit-scrollbar": { display: "none" },
                            maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)"
                        }}>
                            {FONT_FAMILIES.map((font, i) => (
                                <Button
                                    key={font}
                                    onClick={() => handleFontSelect(i)}
                                    sx={{
                                        minWidth: "auto",
                                        color: fontIndex === i ? APPCOLOR : "#888",
                                        fontFamily: font,
                                        fontSize: "1.2rem",
                                        textTransform: "none",
                                        fontWeight: 900,
                                        whiteSpace: "nowrap",
                                        transform: fontIndex === i ? "scale(1.1)" : "scale(1)",
                                        transition: "all 0.2s"
                                    }}
                                >
                                    {font || "Default"}
                                </Button>
                            ))}
                        </Box>
                    </Box>
                )}

                {/* --- SIDE TOOLBAR (Desktop) - HIDDEN --- */}
                {false && type !== 0 && (
                    <Box sx={{
                        position: "absolute", top: 20, right: -60,
                        display: isDesktop ? "flex" : "none",
                        flexDirection: "column", gap: 1,
                        bgcolor: "rgba(0,0,0,0.6)", p: 1, borderRadius: 2,
                        backdropFilter: "blur(10px)"
                    }}>
                        <Tooltip title="Text Color" placement="left">
                            <IconButton onClick={() => setShowPicker(!showPicker)} sx={{ color: textColor, border: `2px solid ${textColor}` }}>
                                <FormatPaintIcon />
                            </IconButton>
                        </Tooltip>

                        {/* Italics Removed */}

                        <Tooltip title="Shadow" placement="left">
                            <IconButton onClick={() => setHasShadow(!hasShadow)} sx={{ color: hasShadow ? APPCOLOR : "#fff" }}>
                                <LayersIcon />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Outline" placement="left">
                            <IconButton onClick={() => setHasOutline(!hasOutline)} sx={{ color: hasOutline ? APPCOLOR : "#fff" }}>
                                <TextFormatIcon />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Shine Effect (Off/Light/Dark/Glossy/Chrome/Deep)" placement="left">
                            <IconButton onClick={() => setShineMode(prev => (prev + 1) % 6)} sx={{ color: shineMode !== 0 ? APPCOLOR : "#fff" }}>
                                <AutoFixHighIcon />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Background Box (Off/Black/White/BlackGlass/WhiteGlass)" placement="left">
                            <IconButton onClick={() => setBgMode(prev => (prev + 1) % 5)} sx={{ color: bgMode !== 0 ? APPCOLOR : "#fff" }}>
                                <BrandingWatermarkIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}

                {/* --- MOBILE STYLE BAR (Right Side - Snapchat Style) - HIDDEN --- */}
                {false && !isDesktop && type !== 0 && (
                    <Box sx={{
                        position: "absolute", top: "20%", right: theme.spacing(2),
                        display: "flex", flexDirection: "column", gap: 2,
                        pointerEvents: "none"
                    }}>
                        <Box sx={{ pointerEvents: "auto", display: "flex", flexDirection: "column", gap: 2, bgcolor: "rgba(0,0,0,0.5)", borderRadius: 3, p: 1 }}>
                            <IconButton size="small" onClick={() => setShowPicker(!showPicker)} sx={{ color: textColor, border: `1px solid ${textColor}` }}><FormatPaintIcon /></IconButton>

                            {/* Italics Removed */}

                            <IconButton size="small" onClick={() => setHasShadow(!hasShadow)} sx={{ color: hasShadow ? APPCOLOR : "#fff" }}><LayersIcon /></IconButton>
                            <IconButton size="small" onClick={() => setHasOutline(!hasOutline)} sx={{ color: hasOutline ? APPCOLOR : "#fff" }}><TextFormatIcon /></IconButton>
                            <IconButton size="small" onClick={() => setShineMode(prev => (prev + 1) % 6)} sx={{ color: shineMode !== 0 ? APPCOLOR : "#fff" }}><AutoFixHighIcon /></IconButton>
                            <IconButton size="small" onClick={() => setBgMode(prev => (prev + 1) % 5)} sx={{ color: bgMode !== 0 ? APPCOLOR : "#fff" }}><BrandingWatermarkIcon /></IconButton>
                        </Box>
                    </Box>
                )}

                {/* --- BOTTOM CONTROLS --- */}
                <Box sx={{
                    position: "absolute", bottom: gutter, left: isDesktop ? "50%" : gutter,
                    width: isDesktop ? desktopWidth : mobileWidth,
                    transform: isDesktop ? "translateX(-50%)" : "none",
                    p: 2, borderRadius: 2,
                    bgcolor: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex", flexDirection: "column", gap: 2
                }}>
                    {/* Size Slider - Hide if type 0, BUT allow Crop if showCropBtn is true */}
                    {(type !== 0 || showCropBtn) && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                            {/* Text Sizing only if Text Mode active */}
                            {false && type !== 0 && (
                                <>
                                    <Typography variant="caption" sx={{ color: "#aaa" }}>Size</Typography>
                                    <Slider
                                        value={fontSize}
                                        onChange={(_, v) => setFontSize(v as number)}
                                        min={70} max={110} size="small"
                                        sx={{ color: APPCOLOR }}
                                    />
                                </>
                            )}
                            {/* Crop Button always visible if valid */}
                            {showCropBtn && (
                                <Button variant="outlined" size="small" onClick={() => setCropMode(!cropMode)} sx={{ color: "#fff", borderColor: "#fff" }}>
                                    {cropMode ? "Done" : "Crop"}
                                </Button>
                            )}
                        </Box>
                    )}

                    {/* Text Inputs & Confirm */}
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>

                        {/* 1. MANUAL MODE DESCRIBER (Visible if prompt is missing) */}
                        {DummyMode && (
                            <TextField
                                variant="outlined" size="small" fullWidth
                                placeholder="Describe context for AI..."
                                value={textEx}
                                onChange={(e) => settextEx(e.target.value)}
                                sx={{
                                    bgcolor: "rgba(255,255,255,0.05)",
                                    borderRadius: 1,
                                    "& .MuiInputBase-input": { color: "#ccc" },
                                    "& fieldset": { borderColor: "rgba(255,255,255,0.1)" }
                                }}
                            />
                        )}

                        {/* 2. CAPTION / COVER TEXT INPUT */}
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <TextField
                                variant="outlined" size="small" fullWidth
                                placeholder={type === 0 ? "Caption..." : "Cover Text..."}
                                value={type === 0 ? text2 : text}
                                onChange={(e) => type === 0 ? setText2(e.target.value) : setText(e.target.value)}
                                sx={{
                                    bgcolor: "rgba(255,255,255,0.1)", borderRadius: 1,
                                    "& .MuiInputBase-input": {
                                        color: "#fff",
                                        textAlign: "center",
                                        fontWeight: "bold",
                                        caretColor: `${APPCOLOR} !important`,
                                    },
                                    "& fieldset": { border: "none" }
                                }}
                            />
                            <IconButton
                                onClick={() => !load && handleUpload(type, text2, PostId, prompt)}
                                sx={{
                                    bgcolor: APPCOLOR, color: "#000",
                                    "&:hover": { bgcolor: "#fff" },
                                    width: 40, height: 40
                                }}
                            >
                                {load ? <Typography variant="caption">...</Typography> : <CheckIcon />}
                            </IconButton>
                        </Box>
                    </Box>
                </Box>

                {/* Messages */}
                {error && <Box sx={{ position: "absolute", top: "50%", left: 0, right: 0, textAlign: "center", color: "salmon", bgcolor: "rgba(0,0,0,0.8)", p: 1 }}>{error}</Box>}

            </motion.div>
        </Box>
    );
};

export default Thumbnail;
