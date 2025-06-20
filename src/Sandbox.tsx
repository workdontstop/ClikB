import React, { FC, useEffect, useRef, useState, useCallback } from "react";
import {
    Box,
    Button,
    Stack,
    CircularProgress,
    Fab,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import UploadIcon from "@mui/icons-material/Upload";
import { matchMobile } from "./DetectDevice";

import CloseIcon from '@mui/icons-material/Close';
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "./store";

import axios from "axios"; // Import Axios

import IntMedia from "./IntMedia";

import ThumbnailMaker from "./ThumbnailMaker";

const CLIK_URL = import.meta.env.VITE_CLIK_URL;

import CheckIcon from '@mui/icons-material/Check';
import { Margin, Padding } from "@mui/icons-material";
import zIndex from "@mui/material/styles/zIndex";

/* ── types ── */
interface SandboxProps {

    item: any;
    type: number;
    videoURL: string;
    CloudvideoURL: any;
    setcloseInteractionx: any
    closeInteractionx: boolean

}


interface Magnify { cx: number; cy: number; ts: number }
type Mode = "main" | "interact1" | "interact2"

/* ── component ── */
const Sandbox: FC<SandboxProps> = ({ videoURL, CloudvideoURL, type, item, setcloseInteractionx, closeInteractionx }) => {
    /* refs */
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const offCanvasRef = useRef<HTMLCanvasElement | null>(null); // rotated frames

    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

    const needRotateRef = useRef(false);

    const [ShowThumb, setShowThumb] = useState(false);

    const [Thumbnail, setThumbnail] = useState('');

    /* ui state */
    const [isPlaying, setIsPlaying] = useState(false);
    const [mode, setMode] = useState<Mode>("main");
    const modeRef = useRef<Mode>("main");
    useEffect(() => { modeRef.current = mode; }, [mode]);

    const [isBusy, setIsBusy] = useState(false);
    const busyRef = useRef(false);


    const [Inttype, setIntType] = useState(0);
    const [OpenIntMedia, setOpenIntMedia] = useState(false);

    /* interactions */
    const [save1, setSave1] = useState(true);
    const [save2, setSave2] = useState(true);
    const [url1, setUrl1] = useState<string | null>(null);
    const [url2, setUrl2] = useState<string | null>(null);
    const [isImg1, setIsImg1] = useState(false);
    const [isImg2, setIsImg2] = useState(false);

    const mag1 = useRef<Magnify | null>(null);
    const mag2 = useRef<Magnify | null>(null);
    const vis1 = useRef(true);
    const vis2 = useRef(true);
    const effect1 = useRef<number | null>(null);
    const effect2 = useRef<number | null>(null);

    /* bookkeeping */
    const wasPlayingRef = useRef(false);
    const lastTime = useRef(0);
    const loopRef = useRef(0);          // counts completed loops
    const lastLoop1 = useRef(-1);       // loop when lens‑1 last fired
    const lastLoop2 = useRef(-1);       // loop when lens‑2 last fired

    /* constants */
    const BASE = 125, MAG_MIN = 1, MAG_MAX = 1.5, MAX_SCALE = 1.4;
    const BREATH_HALF = 500, EFFECT_MS = 4000;
    const LENS_BACK_OFFSET = 1; // seconds to rewind before lens show



    const [isPortrait, setIsPortrait] = useState(false);

    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;

        const handleLoadedMeta = () => {
            // if height exceeds width, it’s portrait
            setIsPortrait(v.videoHeight > v.videoWidth);
        };

        v.addEventListener("loadedmetadata", handleLoadedMeta);
        // if metadata is already loaded (cache hit), run immediately
        if (v.readyState >= 1) handleLoadedMeta();

        return () => {
            v.removeEventListener("loadedmetadata", handleLoadedMeta);
        };
    }, [videoURL]);



    // 1) helper to clear canvas + reset lenses
    const clearCanvasAndLenses = useCallback(() => {
        const c = canvasRef.current;
        if (!c) return;
        const ctx = c.getContext("2d");
        ctx?.clearRect(0, 0, c.width, c.height);

        // reset all interaction state
        mag1.current = mag2.current = null;
        vis1.current = vis2.current = true;
        effect1.current = effect2.current = null;
        setUrl1(null);
        setUrl2(null);
        setIsImg1(false);
        setIsImg2(false);
    }, [setUrl1, setUrl2]);

    // 2) clear whenever you close an interaction
    useEffect(() => {
        if (closeInteractionx) {
            clearCanvasAndLenses();
        }
    }, [closeInteractionx, clearCanvasAndLenses]);



    // Hydration effect when type === 1
    useEffect(() => {
        if (type !== 1) return;

        // wipe out old stuff before we load fresh
        clearCanvasAndLenses();

        // 1) Load main video URL saved on the item
        if (item.mainint) {
            loadSource(item.mainint, true);
        }

        // 2) Wait until metadata is loaded so fitCanvas() knows the real size
        const onLoaded = () => {
            fitCanvas();
            const c = canvasRef.current!;
            // reconstruct lens 1
            if (
                item.int1 &&
                typeof item.inttime1 === "number" &&
                typeof item.intx1 === "number" &&
                typeof item.inty1 === "number"
            ) {
                const cx1 = item.intx1 * c.width;
                const cy1 = item.inty1 * c.height;
                mag1.current = { cx: cx1, cy: cy1, ts: item.inttime1 };
                setUrl1(item.int1);
                setIsImg1(/\.(png|jpe?g|gif)$/i.test(item.int1));
            }
            // reconstruct lens 2
            if (
                item.int2 &&
                typeof item.inttime2 === "number" &&
                typeof item.intx2 === "number" &&
                typeof item.inty2 === "number"
            ) {
                const cx2 = item.intx2 * c.width;
                const cy2 = item.inty2 * c.height;
                mag2.current = { cx: cx2, cy: cy2, ts: item.inttime2 };
                setUrl2(item.int2);
                setIsImg2(/\.(png|jpe?g|gif)$/i.test(item.int2));
            }
        };

        videoRef.current?.addEventListener("loadedmetadata", onLoaded, { once: true });
        return () => {
            videoRef.current?.removeEventListener("loadedmetadata", onLoaded);
        };
    }, [
        type,
        item.mainint,
        item.int1, item.inttime1, item.intx1, item.inty1,
        item.int2, item.inttime2, item.intx2, item.inty2,
    ]);



    /* helpers -----------------------------------------------------------------*/
    const pauseForEffect = () => {
        const v = videoRef.current!; if (!v.paused) { wasPlayingRef.current = true; v.pause(); }
    };
    const seekSafely = (v: HTMLVideoElement, t: number, cb: () => void) => {
        const f = () => { v.removeEventListener("seeked", f); v.removeEventListener("timeupdate", f); cb(); };
        v.addEventListener("seeked", f, { once: true });
        v.addEventListener("timeupdate", f, { once: true });
        v.currentTime = t;
    };
    const fitCanvas = () => {
        const v = videoRef.current, c = canvasRef.current; if (!v || !c) return;
        const asp = needRotateRef.current ? v.videoHeight / v.videoWidth : v.videoWidth / v.videoHeight || 16 / 9;
        let w = window.innerWidth * 0.95, h = w / asp;
        if (h > window.innerHeight * 0.95) { h = window.innerHeight * 0.95; w = h * asp; }
        c.width = w; c.height = h; c.style.width = `${w}px`; c.style.height = `${h}px`;
        if (imgRef.current) { imgRef.current.style.width = `${w}px`; imgRef.current.style.height = `${h}px`; }
    };
    const loadSource = (src: string, loop: boolean, seek?: number, onReady?: () => void) => {
        const v = videoRef.current!; v.loop = loop; v.src = src; v.playsInline = true; v.load();
        v.onloadedmetadata = () => {
            fitCanvas();
            const start = () => { onReady?.(); v.play().catch(() => { }); };
            seek !== undefined ? seekSafely(v, seek, start) : start();
        };
    };

    /* breath start/stop */
    const startBreath1 = () => { effect1.current = performance.now(); pauseForEffect(); };
    const startBreath2 = () => { effect2.current = performance.now(); pauseForEffect(); };
    const stopAllBreathing = () => { effect1.current = effect2.current = null; vis1.current = vis2.current = false; };
    const restoreLenses = () => { vis1.current = vis2.current = true; };

    /* draw helpers (unchanged aside from naming) */
    const drawLens = (ctx: CanvasRenderingContext2D, mag: Magnify, elapsed: number, key: "_b1" | "_b2") => {
        const c = canvasRef.current!, src = needRotateRef.current && offCanvasRef.current ? offCanvasRef.current : videoRef.current!;
        const srcW = src instanceof HTMLVideoElement ? (needRotateRef.current ? src.videoHeight : src.videoWidth) : src.width;
        const srcH = src instanceof HTMLVideoElement ? (needRotateRef.current ? src.videoWidth : src.videoHeight) : src.height;

        const phase = (elapsed % (BREATH_HALF * 2)) / BREATH_HALF, t = phase < 1 ? phase : 2 - phase;
        const scale = 1 + (MAX_SCALE - 1) * t, magCur = MAG_MIN + (MAG_MAX - MAG_MIN) * t;
        const dst = BASE * scale, r = dst / 2, srcC = dst / magCur, sh = srcC / 2;
        const sx = srcW / c.width, sy = srcH / c.height;
        const srcX = Math.max(0, Math.min(srcW - srcC * sx, (mag.cx - sh) * sx));
        const srcY = Math.max(0, Math.min(srcH - srcC * sy, (mag.cy - sh) * sy));
        const dx = Math.max(r, Math.min(c.width - r, mag.cx));
        const dy = Math.max(r, Math.min(c.height - r, mag.cy));

        ctx.save();
        ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.001)";
        ctx.shadowColor = "rgba(0,0,0,0.85)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 12; ctx.fill(); ctx.restore();

        ctx.save(); ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(src, srcX, srcY, srcC * sx, srcC * sy, dx - r, dy - r, dst, dst); ctx.restore();

        ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(5,5,5,0)";
        ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();

        (window as any)[key] = { x: dx - r, y: dy - r, size: dst };
    };
    const drawIfActive = (ctx: CanvasRenderingContext2D, magRef: React.MutableRefObject<Magnify | null>, visRef: React.MutableRefObject<boolean>, effRef: React.MutableRefObject<number | null>, key: "_b1" | "_b2") => {
        if (modeRef.current !== "main" || !visRef.current) return;
        if (effRef.current !== null && magRef.current) {
            const el = performance.now() - effRef.current;
            if (el < EFFECT_MS) drawLens(ctx, magRef.current, el, key); else effRef.current = null;
        } else if (magRef.current) drawLens(ctx, magRef.current, EFFECT_MS, key);
    };

    /* render loop */
    const renderLoop = () => {
        const v = videoRef.current, c = canvasRef.current; if (!v || !c) return;
        const ctx = c.getContext("2d")!; ctx.clearRect(0, 0, c.width, c.height);

        let src: HTMLVideoElement | HTMLCanvasElement = v;
        if (needRotateRef.current) {
            if (!offCanvasRef.current) offCanvasRef.current = document.createElement("canvas");
            const off = offCanvasRef.current;
            if (off.width !== v.videoHeight || off.height !== v.videoWidth) { off.width = v.videoHeight; off.height = v.videoWidth; }
            const o = off.getContext("2d")!; o.save(); o.clearRect(0, 0, off.width, off.height);
            o.translate(off.width, 0); o.rotate(Math.PI / 2); o.drawImage(v, 0, 0); o.restore();
            src = off;
        }

        ctx.drawImage(src, 0, 0, c.width, c.height);
        drawIfActive(ctx, mag1, vis1, effect1, "_b1");
        drawIfActive(ctx, mag2, vis2, effect2, "_b2");

        const active = effect1.current !== null || effect2.current !== null;
        if (active !== busyRef.current) { busyRef.current = active; setIsBusy(active); }
        if (modeRef.current === "main") {
            if (active && !v.paused) { wasPlayingRef.current = true; v.pause(); }
            if (!active && v.paused && wasPlayingRef.current) { v.play().catch(() => { }); wasPlayingRef.current = false; }
        } else if (v.paused) v.play().catch(() => { });

        requestAnimationFrame(renderLoop);
    };

    /* lifecycle */
    useEffect(() => {
        loadSource(videoURL, true);
        const v = videoRef.current!;

        const onTime = () => {
            if (modeRef.current !== "main") { lastTime.current = v.currentTime; return; }

            /* loop detection */
            if (v.currentTime < lastTime.current - 0.05) { loopRef.current += 1; }

            /* lens‑1 fire check */
            if (mag1.current && loopRef.current > lastLoop1.current && v.currentTime >= mag1.current.ts) {
                startBreath1(); lastLoop1.current = loopRef.current;
            }
            /* lens‑2 fire check */
            if (mag2.current && loopRef.current > lastLoop2.current && v.currentTime >= mag2.current.ts) {
                startBreath2(); lastLoop2.current = loopRef.current;
            }
            lastTime.current = v.currentTime;
        };

        v.addEventListener("timeupdate", onTime);
        v.addEventListener("play", () => setIsPlaying(true));
        v.addEventListener("pause", () => setIsPlaying(false));
        window.addEventListener("resize", fitCanvas);
        requestAnimationFrame(renderLoop);

        return () => { v.pause(); v.removeEventListener("timeupdate", onTime); window.removeEventListener("resize", fitCanvas); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* pointer handling --------------------------------------------------*/
    useEffect(() => {
        const c = canvasRef.current!, v = videoRef.current!;
        const toCanvas = (x: number, y: number) => { const r = c.getBoundingClientRect(); return { cx: x - r.left, cy: y - r.top }; };

        const setPoint = (n: 1 | 2, cx: number, cy: number) => {
            const ref = n === 1 ? mag1 : mag2, vis = n === 1 ? vis1 : vis2, start = n === 1 ? startBreath1 : startBreath2,
                loop = n === 1 ? lastLoop1 : lastLoop2;
            const ts = Math.max(v.currentTime, 0.05);            // never 0 s
            ref.current = { cx, cy, ts }; vis.current = true; start();
            loop.current = loopRef.current;                   // fire once this loop
        };

        const handle = (x: number, y: number) => {
            const { cx, cy } = toCanvas(x, y);
            if (modeRef.current === "interact1") return closeInteraction(1);
            if (modeRef.current === "interact2") return closeInteraction(2);
            if (!save1) return setPoint(1, cx, cy);
            if (!save2) return setPoint(2, cx, cy);

            const b1 = (window as any)._b1, b2 = (window as any)._b2;
            if (b1 && effect1.current !== null && cx >= b1.x && cx <= b1.x + b1.size && cy >= b1.y && cy <= b1.y + b1.size) return openInteraction(1);
            if (b2 && effect2.current !== null && cx >= b2.x && cx <= b2.x + b2.size && cy >= b2.y && cy <= b2.y + b2.size) return openInteraction(2);
        };

        const down = (e: PointerEvent) => { if (e.pointerType === "touch") e.preventDefault(); handle(e.clientX, e.clientY); };
        c.addEventListener("pointerdown", down, { passive: false });
        return () => c.removeEventListener("pointerdown", down);
    }, [save1, save2, url1, url2]);

    /* open / close interactions -----------------------------------------*/
    const openInteraction = (n: 1 | 2) => {
        const url = n === 1 ? url1 : url2, isImg = n === 1 ? isImg1 : isImg2;
        if (!url) return alert(`Select Interaction ${n} asset first.`);
        stopAllBreathing(); setMode(n === 1 ? "interact1" : "interact2");
        if (isImg) { videoRef.current!.pause(); fitCanvas(); }
        else { loadSource(url, false); }
    };

    /**
     * Close the active interaction and resume the main video from two seconds
     * *before* the relevant lens show timestamp so the lens can trigger again.
     */
    const closeInteraction = (n: 1 | 2) => {
        const mag = n === 1 ? mag1.current : mag2.current;
        const lastLoop = n === 1 ? lastLoop1 : lastLoop2;

        /** Compute the time to resume: rewind two seconds before the lens show, never below 0. */
        let seekTo = videoRef.current!.currentTime;
        if (mag) {
            seekTo = Math.max(0, mag.ts - LENS_BACK_OFFSET);
            /* Reset loop gate so the lens can fire again in the *current* loop. */
            lastLoop.current = loopRef.current - 1;
        }

        setMode("main");
        if (imgRef.current) imgRef.current.src = "";
        loadSource(videoURL, true, seekTo, restoreLenses);
    };

    useEffect(() => {
        const v = videoRef.current!, onEnd = () => {
            if (modeRef.current === "interact1" && !isImg1) closeInteraction(1);
            if (modeRef.current === "interact2" && !isImg2) closeInteraction(2);
        };
        v.addEventListener("ended", onEnd); return () => v.removeEventListener("ended", onEnd);
    }, [isImg1, isImg2]);

    /* file pickers */
    const pick1 = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) { setUrl1(URL.createObjectURL(f)); setIsImg1(f.type.startsWith("image/")); } };
    const pick2 = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) { setUrl2(URL.createObjectURL(f)); setIsImg2(f.type.startsWith("image/")); } };



    // ask the backend for a presigned DELETE URL, then call it
    const DeleteVideoFromS3 = useCallback(
        async (uploadedVideoUrl: string) => {
            //setIsProcessingx(true);

            try {
                // 1. extract the S3 key from the public URL you kept after upload
                //    e.g. https://my‑bucket.s3.eu‑west‑1.amazonaws.com/video‑abcdef.mp4
                //    ──────────────────────────────────────────────^^ the “key”
                ///  const key = uploadedVideoUrl.split("/").slice(3).join("/"); // crude but works

                const url = new URL(uploadedVideoUrl);
                const keyx = url.pathname.slice(1);          // e.g. "videos/abc123.mp4"
                const key = `${keyx}`
                console.log("CLIENT → deleting S3 key:", key);

                // 2. ask your server for a signed DELETE url
                const { data } = await axios.post<any>(
                    `${CLIK_URL}/get_signed_delete_url_video`,
                    { key },                        // body
                    { withCredentials: true }
                );

                const holder = data.holder;
                if (!holder || holder.length !== 1 || !holder[0].deleteUrl) {
                    throw new Error("Invalid signed‑delete response");
                }
                const { deleteUrl } = holder[0];

                // 3. call the signed URL – Axios maps DELETE nicely
                const resp = await axios.delete(deleteUrl);

                if (resp.status !== 200 && resp.status !== 204) {
                    throw new Error(`Delete failed with status ${resp.status}`);
                }

                console.log("Video deleted from S3 ✅");
            } catch (err: any) {
                console.error("Error deleting video:", err);
            } finally {
                // setIsProcessingx(false);
                setOpenIntMedia(false);
            }
        },
        []
    );

    useEffect(() => {

        if (Thumbnail) {



            console.log(' Delete the original video url MAIN', CloudvideoURL);
            DeleteVideoFromS3(CloudvideoURL);

            saveToDatabase();
        }


    }, [Thumbnail])


    // ── NEW: saveToDatabase ─────────────────────────────────────────────
    const saveToDatabase = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const { width, height } = canvas;
        const interactions: Array<{
            slot: 1 | 2;
            ts: number;
            normX: number;
            normY: number;
            assetUrl: string;
        }> = [];

        // slot 1
        if (mag1.current && url1) {
            const { cx, cy, ts } = mag1.current;
            interactions.push({
                slot: 1,
                ts,
                normX: cx / width,
                normY: cy / height,
                assetUrl: url1,
            });
        }

        // slot 2
        if (mag2.current && url2) {
            const { cx, cy, ts } = mag2.current;
            interactions.push({
                slot: 2,
                ts,
                normX: cx / width,
                normY: cy / height,
                assetUrl: url2,
            });
        }

        const payload = {
            Thumbnail: Thumbnail,
            mainVideoUrl: videoURL,
            interactions,
            id: loggedUser ? loggedUser.id : 0
        };

        console.log(payload);

        try {
            // adjust your endpoint as needed:
            await axios.post(`${CLIK_URL}/saveInteractiveVideo`, payload, {
                withCredentials: true,
            });
            console.log("🎉 Saved to database:", payload);
        } catch (err) {
            console.error("❌ Save failed:", err);
        }



    }, [videoURL, url1, url2, Thumbnail, loggedUser]);

    /* ── UI ── */
    return (
        <>


            {OpenIntMedia ?
                <IntMedia Inttype={Inttype}

                    videoURL={CloudvideoURL}

                    OpenIntMedia={OpenIntMedia} setOpenIntMedia={setOpenIntMedia}

                    url1={url1} setUrl1={setUrl1} url2={url2} setUrl2={setUrl2}

                    setIsImg1={setIsImg1} setIsImg2={setIsImg2} />
                :


                < Box position="fixed" top="3vh" left={matchMobile ? "0%" : "10%"}

                    width="100%" zIndex={300}
                    sx={{ display: "flex", justifyContent: "center", pointerEvents: "none" }}>

                    <Stack direction="row" spacing={2} sx={{ pointerEvents: "auto" }} alignItems="center">
                        { /*<Button component="label" variant="outlined" startIcon={<UploadIcon />}>
                       File 1<input hidden type="file" accept="video/*,image/*" onChange={pick1} />
                    </Button>
                    <Button component="label" variant="outlined" startIcon={<UploadIcon />}>
                        File 2<input hidden type="file" accept="video/*,image/*" onChange={pick2} />
                    </Button>*/
                        }

                        <Button component="label" variant="outlined" style={{ visibility: type === 1 ? 'hidden' : 'visible' }}
                            onClick={() => {

                                setIntType(1);
                                setOpenIntMedia(true);
                            }} startIcon={<UploadIcon />}>
                            File 1
                        </Button>
                        <Button style={{ visibility: type === 1 ? 'hidden' : 'visible' }} onClick={() => {

                            setIntType(2);
                            setOpenIntMedia(true);
                        }}
                            component="label" variant="outlined" startIcon={<UploadIcon />}>
                            File 2
                        </Button>

                        <Button variant="contained" color={"success"} disabled={isBusy}
                            onClick={() => { if (isBusy) return; const v = videoRef.current!; v.paused ? v.play() : v.pause(); }}>
                            {isBusy ? <CircularProgress size={24} /> : isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                        </Button>
                    </Stack>
                </Box >


            }


            < Box position="fixed" bottom="6vh" left={matchMobile ? "0%" : "10%"} width="100%" zIndex={300}
                sx={{ display: "flex", justifyContent: "center", pointerEvents: "none" }}>

                <Stack direction="row" spacing={2} sx={{ pointerEvents: "auto" }} alignItems="center">
                    { /*<Button component="label" variant="outlined" startIcon={<UploadIcon />}>
                       File 1<input hidden type="file" accept="video/*,image/*" onChange={pick1} />
                    </Button>
                    <Button component="label" variant="outlined" startIcon={<UploadIcon />}>
                        File 2<input hidden type="file" accept="video/*,image/*" onChange={pick2} />
                    </Button>*/
                    }

                    <Button component="label" variant="outlined" style={{ visibility: 'hidden' }}
                        startIcon={<UploadIcon />}>
                        File 2
                    </Button>
                    <Button style={{ visibility: 'hidden' }}
                        component="label" variant="outlined" startIcon={<UploadIcon />}>
                        File 2
                    </Button>


                    <Button style={{ visibility: type === 0 ? 'hidden' : 'visible' }} onClick={() => {

                        setcloseInteractionx(true);
                    }} variant="contained"
                    >
                        {<CloseIcon fontSize="small" />}
                    </Button>
                </Stack>
            </Box >




            {/* canvas */}
            {/* ── Centered sandbox overlay ───────────────────────────────────────────── */}
            <Box
                position="fixed"
                top={matchMobile ? '-28%' : '0px'}
                left={matchMobile ? '-5vw' :

                    isPortrait ? '40.7%' : '-18%'}
                right={0}
                bottom={0}
                zIndex={10}
                sx={{

                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    pointerEvents: OpenIntMedia ? "none" : "auto",
                    backgroundColor: OpenIntMedia ? "rgba(0,0,0,0)" : "transparent",
                }}
            >
                <Box
                    position="relative"
                    className="border rounded-2xl shadow-md"
                    sx={{
                        width: { xs: "95vw", sm: "75vw", md: "60vw" },
                        maxWidth: "800px",
                        aspectRatio: "16/9",
                        /// backgroundColor: "#000",      // in case video has letterbox
                    }}
                >
                    <canvas
                        ref={canvasRef}
                        style={{
                            width: "100%",
                            height: "100%",
                            cursor: "crosshair",
                            touchAction: "none",
                        }}
                    />
                    {mode === "interact1" && isImg1 && url1 && (
                        <img
                            ref={imgRef}
                            src={url1}
                            alt="I1"
                            style={{
                                position: "absolute",
                                inset: 0,
                                width: "100%",
                                height: "100%",
                                left: matchMobile ? '' : '-10vw',
                                objectFit: "contain",
                                pointerEvents: "none",
                                zIndex: 10,
                            }}
                        />
                    )}
                    {mode === "interact2" && isImg2 && url2 && (
                        <img
                            ref={imgRef}
                            src={url2}
                            alt="I2"
                            style={{
                                position: "absolute",
                                inset: 0,
                                width: "100%",
                                height: "100%",
                                left: matchMobile ? '' : '-10vw',
                                objectFit: "contain",
                                pointerEvents: "none",
                                zIndex: 10,
                            }}
                        />
                    )}
                </Box>
            </Box >


            {/* bottom buttons */}
            < Box position="fixed" bottom={matchMobile ? "4vh" : "5vh"} left={matchMobile ? "50%" : "60%"}
                sx={{
                    transform: "translateX(-50%)",
                    display: OpenIntMedia ? 'none' : type === 1 ? 'none' : "flex",

                    flexDirection: "column", alignItems: "center", zIndex: 30
                }
                }>
                <Stack direction="row" spacing={7} sx={{ mb: 1, pb: "4vh" }}>
                    <Fab color={save1 ? "primary" : "success"} size="medium" onClick={() => setSave1(!save1)}

                        style={{ display: !save2 ? 'none' : 'block' }}
                    >


                        {save1 ? '1' : <CheckIcon fontSize="small" />}


                    </Fab>
                    <Fab color={save2 ? "primary" : "success"} size="medium" onClick={() => setSave2(!save2)}
                        style={{ display: !save1 ? 'none' : 'block' }}
                    >

                        {save2 ? '2' : <CheckIcon fontSize="small" />}

                    </Fab>
                </Stack>

                {
                    videoURL && (url1 || url2) && (mag1.current || mag2.current) ?
                        <Button color='success'

                            onClick={() => {


                                setShowThumb(true);
                            }}

                            variant="contained">Save</Button > :

                        null

                }



            </Box >

            {ShowThumb ? <ThumbnailMaker videoURL={videoURL} setThumbnail={setThumbnail} setShowThumb={setShowThumb} /> : null}


            {/* hidden video */}
            < video ref={videoRef} playsInline disablePictureInPicture style={{ visibility: "hidden" }
            } />
        </>
    );
};

export default Sandbox;
