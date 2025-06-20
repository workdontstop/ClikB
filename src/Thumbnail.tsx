import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import {
    Box,
    Slider,
    TextField,
    Button,
    IconButton,
    useTheme,
    useMediaQuery,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";

import { matchMobile } from "./DetectDevice";

interface ThumbnailCreatorProps {
    image: string | Blob;
    title?: string;
    PostId?: any;
    isMenuOpen?: boolean;
    closeT?: any;
    type: number
}

const FONT_FAMILIESP = [
    "DynaPuff", "Oregano", "Barriecito", "Bangers", "Oswald",
    "Honk", "Bungee Spice", "Pacifico", "Princess Sofia",
];
const FONT_FAMILIESM = [
    "DynaPuff", "Oregano", "Barriecito", "Bangers", "Oswald",
    "Honk", "Pacifico", "Princess Sofia",
];
const FONT_FAMILIES = matchMobile ? FONT_FAMILIESM : FONT_FAMILIESP;

const rgbToHex = (r: number, g: number, b: number) =>
    "#" +
    [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }).join("");

const Thumbnail: React.FC<ThumbnailCreatorProps> = ({
    image, title, isMenuOpen, PostId, closeT, type
}) => {
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

    const [load, setload] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
    const [fontSize, setFontSize] = useState(110);
    const [text, setText] = useState(type === 0 ? '' : title || "");

    const [text2, setText2] = useState(title || "");

    const [fontIndex, setFontIndex] = useState(2);
    const [clickPos, setClickPos] = useState({ x: 0.5, y: 0.15 });
    const [isDragging, setIsDragging] = useState(false);

    // S3 upload states
    const [error, setError] = useState<string | null>(null);
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

    // color picker
    const [APPCOLOR, SetAPPCOLOR] = useState("#F6BB56");
    const [showPicker, setShowPicker] = useState(false);
    const [textColor, setTextColor] = useState("#ffffff");
    useEffect(() => { SetAPPCOLOR(textColor); }, [textColor]);

    // 1) position text near bottom once image loads
    useEffect(() => {
        const c = canvasRef.current;
        if (loadedImage && c) {
            const cssH = c.parentElement!.clientHeight;
            setClickPos({ x: 0.5, y: (cssH - 250) / cssH });
        }
    }, [loadedImage]);

    // 2) load image (URL or Blob)
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

    // 3) pick a good initial text color
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
        if (!arr.length) { setTextColor("#000000"); return; }
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

    // 4) size canvas buffer + CSS
    const resizeCanvas = useCallback(() => {
        const c = canvasRef.current;
        if (!c || !loadedImage) return;
        c.width = loadedImage.naturalWidth;
        c.height = loadedImage.naturalHeight;
        const parent = c.parentElement!;
        c.style.width = parent.clientWidth + "px";
        c.style.height = parent.clientHeight + "px";
        const ctx = c.getContext("2d")!;
        ctx.scale(1, 1);
        ctx.imageSmoothingEnabled = false;
    }, [loadedImage]);
    useEffect(() => {
        if (loadedImage) resizeCanvas();
        window.addEventListener("resize", resizeCanvas);
        return () => window.removeEventListener("resize", resizeCanvas);
    }, [loadedImage, resizeCanvas]);

    // 5) draw image + wrapped text
    useEffect(() => {
        const c = canvasRef.current;
        if (!c || !loadedImage) return;
        const ctx = c.getContext("2d")!;
        const W = c.width, H = c.height;
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(loadedImage, 0, 0, W, H);
        if (!text) return;
        const sz = Math.round((fontSize * W) / loadedImage.naturalWidth);
        const fam = `"${FONT_FAMILIES[fontIndex]}", sans-serif`;
        ctx.font = `${sz}px ${fam}`;
        ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
        // wrap at 90%
        const maxW = W * 0.9, words = text.split(" "), lines: string[] = [], lh = sz * 1.2;
        let curr = "";
        for (let w of words) {
            const test = curr ? curr + " " + w : w;
            if (ctx.measureText(test).width > maxW && curr) {
                lines.push(curr);
                curr = w;
            } else {
                curr = test;
            }
        }
        if (curr) lines.push(curr);
        const bh = lines.length * lh;
        let y0 = clickPos.y * H - bh / 2;
        if (y0 + bh > H) y0 = H - bh;
        if (y0 < 0) y0 = 0;
        ctx.fillStyle = textColor;
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.7)";
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        lines.forEach((line, i) => {
            const y = y0 + lh * (i + 0.8);
            ctx.fillText(line, W / 2, y);
        });
        ctx.restore();
    }, [loadedImage, text, fontSize, clickPos, fontIndex, textColor, type]);

    // pointer dragging
    const updatePos = (cx: number, cy: number) => {
        const c = canvasRef.current; if (!c) return;
        const rect = c.getBoundingClientRect();
        let nx = (cx - rect.left) / rect.width;
        let ny = (cy - rect.top) / rect.height;
        nx = Math.min(Math.max(nx, 0), 1); ny = Math.min(Math.max(ny, 0), 1);
        setClickPos({ x: nx, y: ny });
    };
    const onDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        updatePos(e.clientX, e.clientY); setIsDragging(true);
    };
    const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => isDragging && updatePos(e.clientX, e.clientY);
    const onUp = () => setIsDragging(false);
    const onTouch = (e: React.TouchEvent<HTMLCanvasElement>, end = false) => {
        if (!end && e.touches.length) {
            e.preventDefault();
            updatePos(e.touches[0].clientX, e.touches[0].clientY);
            setIsDragging(true);
        } else setIsDragging(false);
    };

    // S3 helpers
    const CLIK_URL = import.meta.env.VITE_CLIK_URL;
    const promptx = ""; // ← fill me if needed

    const GenerateSignedUrl = useCallback(async (
        blob: Blob,
        enhancedTextData: any,
        loggedUserx: any
    ) => {
        if (!blob) {
            setError("Image blob missing.");
            return;
        }
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
            await PutImagesInS3WithURL(blob, signed, enhancedTextData, loggedUserx);
        } catch (err: any) {
            setload(false);
            setError(err.message || "Error generating signed URL");
        }
    }, [CLIK_URL, promptx, PostId]);

    const PutImagesInS3WithURL = useCallback(async (
        blob: Blob,
        signedUrls: any,
        enhancedTextData: any,
        loggedUserx: any
    ) => {
        if (!signedUrls.urlHD) {
            setError("Signed URL not available");
            return;
        }
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


            });


            saveToDatabase(Data);


            // you can now call your DB saving here...
            console.log("Uploaded to S3 thumbnail:", finalUrl);
        } catch (err: any) {
            setload(false);
            setError(err.message || "Upload error");
        }
    }, [PostId]);


    const saveToDatabase = useCallback((Data: any) => {

        //  setisLoading(true);
        /// setLoadData('Saving..');
        setload(true);

        axios.put(`${CLIK_URL}/UpdatePostThumb`, {
            values: Data,
        })
            .then((response) => {

                if (response) {

                    ///setisLoading(false);

                    /// setdbLoad(false);


                    ///   setThumbGo(true);

                    //alert('Load Thumbnail');

                    //  setload(false);

                    closeT();



                }
            })
            .catch((error) => {
                setload(false);
                /// setisLoading(false);

                console.log(error);
            });

    }, [])



    const saveCaption = useCallback((Data: any) => {

        setload(true);

        axios.put(`${CLIK_URL}/UpdatePostCaption`, {
            values: Data,
        })
            .then((response) => {

                if (response) {


                    // setload(false);

                    closeT();



                }
            })
            .catch((error) => {
                setload(false);

                console.log(error);
            });

    }, [])


    // utility to detect iPhone
    function isIphone(): boolean {
        return /iPhone/i.test(navigator.userAgent);
    }

    // capture & upload
    const handleUpload = (type: any, text: any, PostId: any) => {
        if (type === 0) {
            const Data = {
                postId: PostId,
                caption: text,
            };
            saveCaption(Data);
        } else {
            const c = canvasRef.current;
            if (!c) return setError("Canvas not ready");

            // choose format: JPEG on iPhone, WebP elsewhere
            const format = isIphone() ? "image/jpeg" : "image/webp";
            // optional quality control for JPEG (0.0–1.0); ignored for WebP
            const quality = isIphone() ? 0.8 : undefined;

            c.toBlob(
                blob => {
                    if (!blob) return setError("Failed to get blob");
                    // pass whatever enhancedTextData & user you need:
                    GenerateSignedUrl(blob, { text }, /* loggedUserx= */ null);
                },
                format,
                quality
            );
        }
    };


    const handleFont = () => setFontIndex(i => (i + 1) % FONT_FAMILIES.length);
    const confirm = () => console.log("confirmed");

    const gutter = theme.spacing(1);
    const desktopWidth = "100%";
    const mobileWidth = `calc(100% - ${theme.spacing(2)})`;

    return (
        <Box
            sx={{
                position: "relative",
                width: "100vw",
                height: "100vh",
                backgroundColor: "rgba(0,0,0,0.85)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                style={{
                    position: "relative",
                    top: matchMobile ? "-5vh" : isMenuOpen ? "" : "-4vh",
                    left: matchMobile ? "" : isMenuOpen ? "-10vw" : "",
                    height: "90vh",
                    width: isDesktop ? "auto" : "90vw",
                }}
            >
                <canvas
                    ref={canvasRef}
                    onMouseDown={onDown}
                    onMouseMove={onMove}
                    onMouseUp={onUp}
                    onMouseLeave={onUp}
                    onTouchStart={e => onTouch(e)}
                    onTouchMove={e => onTouch(e)}
                    onTouchEnd={e => onTouch(e, true)}
                    style={{

                        display: "block",
                        width: "100%",
                        height: "100%",
                        borderRadius: theme.shape.borderRadius,
                        cursor: isDragging ? "grabbing" : "grab",
                        filter: load ? "blur(4px)" : "blur(0px)",
                        border: loadedImage
                            ? `1px solid ${APPCOLOR}`
                            : `1px dashed ${APPCOLOR}`,
                    }}
                />

                {/* color picker */}
                {showPicker && (
                    <Box
                        sx={{
                            position: "absolute",
                            top: gutter,
                            left: gutter,
                            width: "96%",
                            zIndex: 10,
                            bgcolor: "rgba(0,0,0,0.9)",
                            p: 1,
                            borderRadius: 1,
                        }}
                    >
                        <Box sx={{ position: "relative", width: "100%" }}>
                            <input
                                type="color"
                                value={textColor}
                                onChange={e => setTextColor(e.target.value)}
                                style={{
                                    width: "60px",
                                    height: "60px",
                                    border: "none",
                                    padding: 3,
                                    cursor: "pointer",
                                }}
                            />
                            <IconButton
                                size="small"
                                onClick={() => setShowPicker(false)}
                                sx={{
                                    position: "absolute", top: 8, right: 8,
                                    color: "#fff", bgcolor: "rgba(0,0,0,0.4)",
                                    p: 0.5,
                                    "&:hover": { bgcolor: "rgba(0,0,0,0.6)" }
                                }}
                            >
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    </Box>
                )}

                {/* TOP BAR */}

                {type === 0 ? null :
                    <Box
                        sx={{
                            position: "absolute",
                            top: gutter,
                            left: isDesktop ? "50%" : gutter,
                            width: isDesktop ? desktopWidth : mobileWidth,
                            transform: isDesktop ? "translateX(-50%)" : "none",
                            p: 1,
                            borderRadius: 1,
                            bgcolor: "rgba(0,0,0,0.4)",
                            backdropFilter: "blur(4px)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >

                        <Slider
                            value={fontSize}
                            onChange={(_, v) => setFontSize(v as number)}
                            min={100} max={150} size="small"
                            sx={{ flex: 0.5, minWidth: 120, color: APPCOLOR }}
                        />
                        <Button onClick={() => setShowPicker(true)} sx={{ flex: 0.2, color: "#fff", border: "1px solid #fff" }}>
                            Color
                        </Button>
                        <Button onClick={handleFont} sx={{ flex: 0.2, color: "#fff", border: "1px solid #fff" }}>
                            Font
                        </Button>


                    </Box>}


                {/* BOTTOM BAR */}
                <Box
                    sx={{
                        position: "absolute",
                        bottom: gutter,
                        left: isDesktop ? "50%" : gutter,
                        width: isDesktop ? desktopWidth : mobileWidth,
                        transform: isDesktop ? "translateX(-50%)" : "none",
                        p: 1,
                        borderRadius: 1,
                        bgcolor: "rgba(0,0,0,0.4)",
                        backdropFilter: "blur(4px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >
                    <Box sx={{ width: "90%" }}>
                        <TextField
                            label={type === 0 ? 'Add a Caption' : "Cover"}
                            variant="filled"
                            size="small"
                            fullWidth
                            value={type === 0 ? text2 : text}
                            onChange={(e) => {

                                if (type === 0) {
                                    setText2(e.target.value)

                                } else {
                                    setText(e.target.value)

                                }
                            }}
                            slotProps={{ input: { sx: { color: "#fff" } } }}
                            sx={{
                                "& .MuiInputLabel-root": { color: "#ccc" },
                                "& .MuiFilledInput-underline:after": {
                                    borderBottomColor: APPCOLOR
                                },
                                "& .MuiFilledInput-root.Mui-focused:after": {
                                    borderBottomColor: APPCOLOR
                                }
                            }}
                        />
                    </Box>
                    <Box sx={{ width: "10%", textAlign: "center" }}>
                        <IconButton
                            onClick={() => {


                                handleUpload(type, text2, PostId);
                            }}
                            sx={{
                                color: APPCOLOR,
                                border: `1px solid ${APPCOLOR}`,
                                borderRadius: "50%",
                                p: 1,
                                filter: "drop-shadow(0 0 4px rgba(0,0,0,.8))", // halo
                            }}
                        >
                            <CheckIcon />
                        </IconButton>
                    </Box>
                </Box>

                {/* error or success */}
                {
                    error && (
                        <Box sx={{
                            position: "absolute", bottom: "calc(100% + 8px)", left: 0, right: 0,
                            textAlign: "center", color: "salmon"
                        }}>
                            {error}
                        </Box>
                    )
                }
                {
                    uploadedUrl && (
                        <Box sx={{
                            position: "absolute", bottom: "calc(100% + 8px)", left: 0, right: 0,
                            textAlign: "center", color: "lightgreen", wordBreak: "break-all", display: 'none'
                        }}>
                            Uploaded: {uploadedUrl}
                        </Box>
                    )
                }
            </motion.div >
        </Box >
    );
};

export default Thumbnail;
