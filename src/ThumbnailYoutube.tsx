import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import axios from "axios";

import { useDispatch, useSelector } from "react-redux";
import { RootState } from "./store";

import { setPixels, incrementPixels } from "./settingsSlice";

import { calcModelPixels } from "./ModelPixels";   // adjust path

import { Typography } from "@mui/material";

import ModelPixelsx from './ModelPixelsx'


import {
    Box,
    Slider,
    TextField,
    Button,
    IconButton,
    Snackbar,
    useTheme,
    useMediaQuery,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardBackspaceIcon from '@mui/icons-material/KeyboardBackspace';
import EastIcon from '@mui/icons-material/East';

import { matchMobile } from "./DetectDevice";

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

// â€¦


interface ThumbnailCreatorProps {
    imagex: string | Blob;
    title?: string;
    PostId?: any;
    isMenuOpen?: boolean;
    closeT?: any;
    type: number;
    showThumb: any
}

const FONT_FAMILIESP = [
    '',
    "Bebas Neue",
    "Anton",
];

const FONT_FAMILIESM = [
    '',
    "Bebas Neue",
    "Anton",
];

const FONT_FAMILIES = matchMobile ? FONT_FAMILIESM : FONT_FAMILIESP;

const rgbToHex = (r: number, g: number, b: number) =>
    "#" +
    [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    }).join("");




const type = 1;

const ThumbnailYoutube: React.FC<any> = ({
    setShowThumb,

    userProfile,
    imagex,

    minimisePrompt,

    isMenuOpen,
    showThumb

}) => {
    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up("md"));




    const [Planx, setPlanx] = useState<any>(null);

    const [Stage, setStage] = useState<number>(0);

    const [title, setTitle] = useState<any>('');

    const [ThumbDesign, setThumbDesign] = useState<any>('');

    const [description, setDescription] = useState<any>('');
    const [tags, setTags] = useState<any>([]);

    const [load, setload] = useState(false);

    /// alert(imagex)


    const dispatch = useDispatch();

    /* Replace the balance after fetching it */


    const CLIK_URL = import.meta.env.VITE_CLIK_URL;


    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);



    const GRADIENTx =
        darkModeReducer ?
            "linear-gradient(90deg, #F6BB56 0%, #F6BB56 100%)" :
            "linear-gradient(90deg, #ff8a00 0%, #e52e71 100%)";



    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);




    const pixels = useSelector((state: RootState) => state.settings.pixels);

    const getPixel = async () => {
        try {
            const response = await axios.post(
                `${CLIK_URL}/getPixels`,                   // <-- POST endpoint
                { values: { userid: loggedUser?.id ?? 0 } }  // <-- request body
            );
            const { pixels } = response.data as any;   // â† pick out the primitive

            /// setPixels(pixels);

            dispatch(setPixels(pixels));

        } catch (err) {
            console.error("Error fetching pixels:", err);
        }
    };


    useEffect(() => {

        if (showThumb) {

            getPixel();
        }

    }, [loggedUser, showThumb])



    const [sampleImage, setSampleImage] = useState<any>(null);

    const modelsx: ModelName[] =

        sampleImage ?


            [
                'pixels',
                "Kontext",
                'banana',

            ]

            :

            [
                'pixels',
                "Schnell",
                "Hi Dream",
                'banana',
                "minimax",
                'fluxDev',
                'seeDream',
                'fluxUltra',
                "Imagenx",
                "Gpt Image",
            ];

    type ModelName = "Schnell" | 'banana' | "Hi Dream" | "minimax" | "Gpt Image" | "Imagenx" | 'fluxUltra' | 'seeDream' | 'fluxDev' | 'pixels' | 'Kontext';
    const models: ModelName[] =

        sampleImage ?


            [
                'pixels',
                "Kontext",
                'banana'

            ]

            :

            [
                'pixels',
                'banana',
                "minimax",
                'fluxUltra',
                "Gpt Image"


            ];


    const [model, setModel] = useState<ModelName>("Schnell");


    const [image, setimage] = useState<any>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
    const [fontSize, setFontSize] = useState(140);
    const [text, setText] = useState("");

    const [text2, setText2] = useState("");


    /// const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);


    const [hideUI, setHideUI] = useState(false);   // ðŸ‘ˆ NEW

    const [text3, setText3] = useState("");

    const [fontIndex, setFontIndex] = useState(2);
    const [clickPos, setClickPos] = useState({ x: 0.5, y: 0.15 });
    const [isDragging, setIsDragging] = useState(false);

    // S3 upload states
    const [error, setError] = useState<string | null>(null);
    const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

    const [Loading, setLoading] = useState(false);

    // color picker
    const [APPCOLOR, SetAPPCOLOR] = useState("#F6BB56");
    const [showPicker, setShowPicker] = useState(false);
    const [textColor, setTextColor] = useState("#ffffff");
    useEffect(() => { SetAPPCOLOR(textColor); }, [textColor]);

    //const textColorx = "#ffffff";


    /*  top-level inside the component (after other hooks) */
    const [finalUrl, setFinalUrl] = useState<string | null>(null);



    const [copySuccess, setCopySuccess] = useState('');

    const copyToClipboard = (text: any) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(
                () => setCopySuccess('Copied!'),
                (err) => setCopySuccess('Failed to copy!')
            );
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopySuccess('Copied!');
        }
    };





    const removePixel = async (amount: number): Promise<any> => {
        /* ---------- input-level validation ---------- */
        if (!Number.isFinite(amount) || amount <= 0) {
            throw new Error("Amount must be a positive integer");
        }

        try {
            const { data } = await axios.post<{ userid: number; pixels: number }>(
                `${CLIK_URL}/spendPixels`,
                {
                    values: {
                        userid: loggedUser?.id ?? 0,
                        amount,
                    },
                }
            );





            dispatch(setPixels(data.pixels));


        } catch (err) {
            console.error("Error spending pixels:", err);
            throw new Error("Failed to spend pixels");  // bubble up a friendly error
        }
    };




    /**
    * Props:
    *   title: string
    *   tags:  string[]          // plain strings, e.g. ['react', 'mui']
    *   description: string
    *   matchMobile: boolean     // whatever break-point flag you were using
    */

    const [snack, setSnack] = useState({ open: false, msg: '' });

    const clickPosRef = useRef(clickPos);
    useEffect(() => { clickPosRef.current = clickPos; }, [clickPos, Stage, text]);

    const copy = useCallback(async (val: any) => {
        if (!val) return;

        try {
            // Prefer the modern Clipboard API (works on localhost + https)
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(val);
            } else {
                // Fallback: hidden textarea + execCommand
                const ta = document.createElement('textarea');
                ta.value = val;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            setSnack({ open: true, msg: 'Copied!' });
        } catch (err) {
            console.error(err);
            setSnack({ open: true, msg: 'Copy failed â€“ please copy manually.' });
        }
    }, []);








    /* canvas â†’ PNG whenever we enter Stage 2 */
    useEffect(() => {
        if (Stage !== 2) return;
        const c = canvasRef.current;
        if (c) setFinalUrl(c.toDataURL("image/png"));
    }, [Stage]);



    const inputRef = useRef<HTMLInputElement>(null);


    // When the file input changes, read the file as a data URL
    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

    const [uploadPreview, setUploadPreview] = useState<any>(null); // local blob for <img>

    /* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ HELPERS & HANDLERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */


    /**
     * STEP 2 â€” ask backend for a signed PUT URL, then upload the blob
     *   â€¢ on success, derive the public URL (signed.urlHD w/o query)
     *   â€¢ store it in uploadedUrl + sampleImage
     */



    const startDelete = async (imageUrl: any) => {
        try {
            ///  setLoadingDatabase(true);
            //del-
            await axios.post(
                `${CLIK_URL}/del-image`,
                { url: imageUrl },          // <-- body
                { withCredentials: true }   // <-- config
            );
            console.log("Deleted from s3:", imageUrl);
            // success: update UI, toast, etc.
        } catch (err) {
            console.error("Delete failed:", err);
        } finally {
            /// setLoadingDatabase(false);
        }
    };


    const generateSignedUrlAndUpload = useCallback(
        async (blob: Blob, promptLine: any,) => {
            try {
                setload(true);
                setError("");

                /* A. Get signed PUT URL */
                const { data }: any = await axios.post(
                    `${CLIK_URL}/get_signed_url_image`,
                    { values: { count: 2 } },
                    { withCredentials: true }
                );

                const signed = data.holder?.[0];
                if (!signed?.urlHD) throw new Error("Bad signed-URL response");

                /* B. Upload file to S3 */
                const putRes = await axios.put(signed.urlHD, blob, {
                    headers: { "Content-Type": blob.type || "application/octet-stream" }
                });
                if (![200, 204].includes(putRes.status)) {
                    throw new Error(`Upload failed: ${putRes.status}`);
                }

                /* C. Save the public URL */
                const publicUrl = signed.urlHD.split("?")[0];
                setUploadedUrl(publicUrl);   // keep for later delete
                setSampleImage(publicUrl);   // to be sent to /kontext
                console.log("Uploaded to S3:", publicUrl);



                handleSubmitImage(promptLine, publicUrl);

                // startDelete(publicUrl);

            } catch (err: any) {
                console.error(err);
                setError(err.message || "S3 upload error");
            } finally {
                setload(false);
            }
        },
        [Planx, model, sampleImage, pixels]
    );





    /**
     * STEP 1 â€” user picks a file
     *   â€¢ show an instant preview via URL.createObjectURL
     *   â€¢ call generateSignedUrlAndUpload to push the file to S3
     */
    const handleFileChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) return;

            // local preview for immediate feedback
            const localUrl = URL.createObjectURL(file);
            setUploadPreview(file);
            setSampleImage(localUrl);
            setimage('');

            // revoke the preview blob when we switch files or unmount
            return () => URL.revokeObjectURL(localUrl);

        },
        []
    );



    const DesignThumb = useCallback(
        async (titlex: string) => {
            setError("");
            setLoading(true);
            try {
                /* ---------- Build request ---------- */
                const requestData = { title: titlex, imagelook: text2 };

                var url = 'startDesignYou';

                if (sampleImage) {

                    url = 'startDesignYouK'
                }

                /* ---------- Hit the endpoint ---------- */
                const { data }: any = await axios.post(
                    `${CLIK_URL}/${url}`,
                    requestData,
                    { withCredentials: true }
                );

                /* ---------- NEW: read data.prompt ---------- */
                const promptLine: string = data.prompt;   // plain string
                console.log("Thumbnail prompt âžœ", promptLine);

                setThumbDesign(promptLine);

                if (sampleImage) {


                    try {
                        await generateSignedUrlAndUpload(uploadPreview, promptLine);
                    } finally {

                    }


                } else {
                    handleSubmitImage(promptLine, '');
                }

                /// setLoading(false);

                // ðŸ”† optional: immediately call your image generator
                // const img = await axios.post(IMG_API, { prompt: promptLine });
                // setThumbUrl(img.data.url);

                // or stash the prompt in state so the user can tweak it
                // setThumbPrompt(promptLine);

            } catch (error: any) {
                setLoading(false);
                /* ---------- Same error handling ---------- */
                if (error.response) {
                    console.error("Server Error:", error.response.data);
                    setError(error.response.data.message || "Server Error");
                } else if (error.request) {
                    console.error("No response received:", error.request);
                    setError("Network Error: No response received from server.");
                } else {
                    console.error("Error:", error.message);
                    setError(error.message);
                }
            }
        },
        [text2, model, sampleImage, uploadPreview, pixels]           // â¬…ï¸  text3 removed; we only depend on imagelook (text2)
    );


    const downloadThumb = async () => {
        const src = canvasRef.current;
        if (!src) return;

        const MAX_SIZE = 2_000_000;        // 2 MB
        let divisor = 1.0;                 // start at original size
        let blob: Blob | null = null;

        /* helper: draw & export at given divisor */
        const makeBlob = (d: number): Promise<Blob> => {
            const w = Math.round(src.width / d);
            const h = Math.round(src.height / d);
            const off = document.createElement("canvas");
            off.width = w;
            off.height = h;
            off.getContext("2d")!.drawImage(src, 0, 0, w, h);
            return new Promise((res) =>
                off.toBlob((b) => res(b as Blob), "image/png")
            );
        };

        /* progressive down-scale */
        while (divisor <= 2.0) {
            blob = await makeBlob(divisor);
            if (blob.size <= MAX_SIZE) break;   // success
            divisor = parseFloat((divisor + 0.1).toFixed(1)); // 1.1, 1.2, ...
        }

        if (!blob || blob.size > MAX_SIZE) {
            alert(
                `Still ${(blob?.size ?? 0 / 1024).toFixed(0)} KB at half-size.\n` +
                "Try JPEG or reduce complexity."
            );
            return;
        }

        /* trigger download */
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "thumbnail.png";
        a.click();
        URL.revokeObjectURL(url);
    };


    const Submit = useCallback(async () => {


        var modelPricex = calcModelPixels({
            model: model,          // or m.name, however you store the model label
            baseImagesPerDollar: 333       // keep in sync with what you pass the component
        });
        if (sampleImage) {

            modelPricex = calcModelPixels({
                model: 'Kontext',          // or m.name, however you store the model label
                baseImagesPerDollar: 333       // keep in sync with what you pass the component
            });
        }

        if (pixels >= modelPricex) {

            /// alert(modelPrice);




            setLoading(true);
            const selectedStyle = 'Auto';
            setError('');
            try {
                // Prepare the request payload

                const idea = text3;
                const image = text2;
                const requestData: any = { idea, image };

                // Make the POST request to the server
                const { data } = await axios.post<any>(
                    `${CLIK_URL}/startPlanYou`,
                    requestData,
                    { withCredentials: true }
                );


                const meta = data.meta;                   // { title, tags, description }
                console.log("YouTube Meta:", meta);

                setTitle(meta.title);
                setDescription(meta.description);
                setTags(meta.tags);
                setPlanx(meta);                      // store it in stat


                DesignThumb(meta.title);

                /// setLoading(false);

            } catch (error: any) {
                setLoading(false);
                // Handle different error scenarios
                if (error.response) {
                    // Server responded with a status other than 2xx
                    console.error("Server Error:", error.response.data);
                    setError(error.response.data.message || "Server Error");
                } else if (error.request) {
                    // Request was made but no response received
                    console.error("No response received:", error.request);
                    setError("Network Error: No response received from server.");
                } else {
                    // Other errors
                    console.error("Error:", error.message);
                    setError(error.message);
                }
            } finally {
                ///setIsLoading(false);
            }

        } else {

            const requiredPixels = modelPricex;      // e.g. 100000
            const currentBalance = pixels;      // your userâ€™s pixel balance

            alert(`ðŸ˜¢ Youâ€™ve run out of pixels!
This image generation needs at least ${requiredPixels} pixels, but your balance is ${currentBalance} pixels.`);


        }

    }, [text2, text3, model, sampleImage, uploadPreview, pixels]);




    /**
    * applyMetaStyle
    * -------------
    * For YouTube-metadata objects only.
    * - If style === "Auto" â†’ return as-is.
    * - Otherwise you could drop extra mutations in the switch block.
    */
    const applyMetaStyle = <T extends { title: string; tags: string[]; description: string }>(
        meta: T,
        style: string
    ): T => {
        if (style === "Auto") return meta;

        // ðŸ”§  place for future tweaks  ðŸ”§
        // e.g. if you decide â€œUppercaseâ€, â€œEmojiâ€, â€œHashtagifyâ€, etc.
        switch (style) {
            default:
                return meta; // no-op for now
        }
    };



    useEffect(() => {

        if (sampleImage) {


            if (model === 'banana') {

            } else {

                setModel('Kontext');
            }
        }

    }, [sampleImage, model])


    // Example updated handleSubmitFluxImage
    const handleSubmitImage = useCallback(
        async (
            enhancedPrompt: any, publicUrl: String,
        ) => {
            // startLoader(index);
            // setPollStatus("Polling Replicate...");
            ///modelx








            setLoading(true);
            try {

                var payload: any = {
                    inputs: enhancedPrompt,
                    // YouTube thumbnail recommended dimensions (16:9 aspect ratio)
                    width: 1280,   // px
                    height: 720,   // px
                    guidance: 7.5,
                    num_inference_steps: 35,
                    ty: 3
                };

                var url = 'fluxschnell';

                if (sampleImage) {



                    payload = {
                        inputs: enhancedPrompt,
                        // YouTube thumbnail recommended dimensions (16:9 aspect ratio)
                        width: 1280,   // px
                        height: 720,   // px
                        sampleImage: publicUrl,
                        guidance: 7.5,
                        num_inference_steps: 35,
                        ty: 3
                    };


                    if (model === 'banana') {

                        url = 'bannana';
                    } else {
                        url = 'kontext';
                    }

                } else {

                    if (model === 'Schnell') {
                        url = 'fluxschnell';

                    } else if (model === 'Hi Dream') {

                        url = 'HiDream';
                    }
                    else if (model === 'minimax') {

                        url = 'minimax';
                    }
                    else if (model === 'banana') {

                        url = 'Imagen';
                    }
                    else if (model === 'Imagenx') {

                        url = 'Imagenx';
                    }
                    else if (model === 'Gpt Image') {

                        url = 'GptImage';
                    } else {

                        url = 'fluxschnell';
                    }
                }

                // Axios configuration adjusted so we wait *indefinitely* for the GPU to finish.
                // timeout: 0 disables the abort that was happening when the model was still warming up.
                // maxContentLength / maxBodyLength guards against large base64 payloads.
                const axiosConfig = {
                    withCredentials: true,
                    timeout: 280000,               // wait as long as necessary
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                };

                // Make the POST request
                const response = await axios.post<any>(`${CLIK_URL}/${url}`, payload, axiosConfig);

                if (response.status !== 200) {
                    throw new Error(`FluxSchnell route error: ${response.status}`);
                }

                // Extract final base64 from server
                const { imageBase64 } = response.data;
                if (!imageBase64) {
                    throw new Error("No imageBase64 returned from server");
                }

                setimage(imageBase64);
                setStage(1);

                if (sampleImage) {

                    const modelPrice = calcModelPixels({
                        model: 'Kontext',          // or m.name, however you store the model label
                        baseImagesPerDollar: 333       // keep in sync with what you pass the component
                    });

                    removePixel(modelPrice);
                } else {


                    const modelPrice = calcModelPixels({
                        model: model,          // or m.name, however you store the model label
                        baseImagesPerDollar: 333       // keep in sync with what you pass the component
                    });

                    removePixel(modelPrice);
                }



                if (sampleImage) {
                    startDelete(publicUrl)

                }
                setLoading(false);
            } catch (err: any) {
                console.error("Flux Kontext error:", err);

                // 1ï¸âƒ£  pull whatever text is available
                let serverMsg = "";
                if (err.response?.data) {
                    if (typeof err.response.data === "string") {
                        serverMsg = err.response.data;            // raw text
                    } else if (typeof err.response.data.error === "string") {
                        serverMsg = err.response.data.error;      // { error: "â€¦" }
                    }
                }
                if (!serverMsg) serverMsg = err.message || "";

                // 2ï¸âƒ£  now do simple substring tests
                if (serverMsg.includes("Symbol(Request internals)")) {
                    alert(
                        "Your prompt was blocked by the content-safety filter. " +
                        "Please rephrase to remove any disallowed content."
                    );
                } else if (
                    /safety|sensitive|content policy/i.test(serverMsg)
                ) {
                    alert(
                        "Your prompt was blocked by the content-safety filter. " +
                        "Please rephrase to remove any disallowed content."
                    );
                } else {
                    console.log("Unexpected error: " + serverMsg);
                }

                if (publicUrl) startDelete(publicUrl);
                setLoading(false);
            }


        },
        [Planx, model, sampleImage, pixels]
    );




    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            Submit(); // your custom function
        }
    };

    useEffect(() => {
        if (loadedImage) drawRef.current();
    }, [text, loadedImage]);

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
        img.crossOrigin = 'anonymous';
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
    const CANVAS_W = 1280; // 16:9
    const CANVAS_H = 720;

    const resizeCanvas = useCallback(() => {
        const c = canvasRef.current;
        if (!c) return;

        // Make the internal pixel buffer 16:9
        c.width = CANVAS_W;
        c.height = CANVAS_H;

        // Fit the canvas element to its parent box
        const parent = c.parentElement!;
        c.style.width = parent.clientWidth + "px";
        c.style.height = parent.clientHeight + "px";

        // Reset any prior transforms and keep smoothing on
        const ctx = c.getContext("2d")!;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = true;

        // Redraw with your cover logic (drawRef should use drawImageCover)
        if (loadedImage) drawRef.current?.();
    }, [loadedImage]);

    useEffect(() => {
        if (loadedImage) resizeCanvas();
        window.addEventListener("resize", resizeCanvas);
        return () => window.removeEventListener("resize", resizeCanvas);
    }, [loadedImage, resizeCanvas]);

    // 5) draw image + ONE-LINE text (no wrapping)


    const [fontVersion, setFontVersion] = useState(0);
    const [fontReady, setFontReady] = useState(true);



    // 5) draw image + ONE-LINE text â€” performant version --------------------
    // 5) draw image + ONE-LINE text â€” performant + font loading aware
    const drawRef = useRef<() => void>(() => { });
    const rafHandle = useRef<number>();

    useEffect(() => {
        const c = canvasRef.current;
        if (!c || !loadedImage) return;

        const ctx = c.getContext("2d")!;
        const W = c.width;
        const H = c.height;

        drawRef.current = () => {
            ctx.clearRect(0, 0, W, H);

            // ---- cover crop using the image's real resolution ----
            const iw = loadedImage.naturalWidth;
            const ih = loadedImage.naturalHeight;
            const targetAR = W / H;
            const imageAR = iw / ih;

            let sx = 0, sy = 0, sW = iw, sH = ih;
            if (imageAR > targetAR) {
                // source is wider than 16:9 target -> crop left/right
                sW = ih * targetAR;
                sx = (iw - sW) / 2;
            } else {
                // source is taller -> crop top/bottom
                sH = iw / targetAR;
                sy = (ih - sH) / 2;
            }

            // ---- draw background ----
            if (model === "Gpt Image") {
                // subtle horizontal squeeze to make it look taller
                const SQUEEZE_X = 0.92; // tweak 0.90â€“0.97 to taste
                ctx.save();
                ctx.scale(SQUEEZE_X, 1);
                ctx.drawImage(loadedImage, sx, sy, sW, sH, 0, 0, W / SQUEEZE_X, H);
                ctx.restore();
            } else {
                ctx.drawImage(loadedImage, sx, sy, sW, sH, 0, 0, W, H);
            }

            if (!fontReady) return;

            const famName = FONT_FAMILIES[fontIndex] || '';
            const fam = famName ? `"${famName}", sans-serif` : 'sans-serif';

            // base size proportional to original width
            let sz = Math.round((fontSize * W) / loadedImage.naturalWidth);
            ctx.font = `${sz}px ${fam}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "alphabetic";

            // shrink if too wide
            const maxW = W * 0.9;
            const wTxt = ctx.measureText(text).width;
            if (wTxt > maxW) {
                sz = Math.floor(sz * (maxW / wTxt));
                ctx.font = `${sz}px ${fam}`;
            }

            const x = clickPosRef.current.x * W;
            const y = clickPosRef.current.y * H;

            ctx.save();
            ctx.fillStyle = textColor;
            ctx.shadowColor = "rgba(0,0,0,0.7)";
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            ctx.fillText(text, x, y);
            ctx.restore();
        };

        drawRef.current();
    }, [
        loadedImage,
        text,
        clickPosRef,
        fontSize,
        fontIndex,
        textColor,
        fontReady,
        fontVersion,
        Stage,
        model // â† important so it redraws when switching models
    ]);


    const handleFont = () => {
        setFontReady(false);
        setFontIndex(prev => {
            const next = (prev + 1) % FONT_FAMILIES.length;
            const fam = FONT_FAMILIES[next];
            if (fam) {
                // request that face; 1em is arbitrary
                document.fonts.load(`1em "${fam}"`).then(() => {
                    setFontReady(true);
                    setFontVersion(v => v + 1);   // trigger redraw with loaded font
                }).catch(() => {
                    // even if it fails, re-enable so UI doesn't hang
                    setFontReady(true);
                    setFontVersion(v => v + 1);
                });
            } else {
                // empty string entry (""), treat as default system fallback
                setFontReady(true);
                setFontVersion(v => v + 1);
            }
            return next;
        });
    };



    // keep clickPos in a ref to avoid re-render loops


    // pointer dragging (rAF throttled)
    const scheduleDraw = () => {
        if (rafHandle.current) cancelAnimationFrame(rafHandle.current);
        rafHandle.current = requestAnimationFrame(() => drawRef.current());
    };

    const updatePos = (cx: number, cy: number) => {
        const c = canvasRef.current;
        if (!c) return;
        const r = c.getBoundingClientRect();
        clickPosRef.current = {
            x: Math.min(Math.max((cx - r.left) / r.width, 0), 1),
            y: Math.min(Math.max((cy - r.top) / r.height, 0), 1)
        };
        scheduleDraw();                 // redraw outside React
    };

    /* ------------ pointer + touch handlers ------------ */
    const onDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        updatePos(e.clientX, e.clientY);
        setIsDragging(true);
        setHideUI(true);                // hide toolbars while dragging
    };

    const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isDragging) updatePos(e.clientX, e.clientY);
    };

    const endDrag = () => {
        setIsDragging(false);
        setHideUI(false);               // show toolbars again
    };

    const onUp = endDrag;
    const onLeave = endDrag;      // optional: handle pointer leaving canvas

    const onTouch = (e: React.TouchEvent<HTMLCanvasElement>, end = false) => {
        if (!end && e.touches.length) {
            e.preventDefault();
            updatePos(e.touches[0].clientX, e.touches[0].clientY);
            setIsDragging(true);
            setHideUI(true);
        } else {
            endDrag();
        }
    };








    // utility to detect iPhone
    function isIphone(): boolean {
        return /iPhone/i.test(navigator.userAgent);
    }




    const confirm = () => console.log("confirmed");

    const gutter = theme.spacing(0);
    const desktopWidth = "100%";
    const mobileWidth = `calc(100% - ${theme.spacing(0)})`;
    const textColorx = theme.palette.getContrastText(APPCOLOR);

    return (
        <Box
            sx={{
                position: "relative",
                width: "100vw",
                height: "100vh",
                backgroundColor: matchMobile ? "rgba(80,80,80,0.93)" : "rgba(80,80,80,0.93)",
                display: "flex",

                justifyContent: "center",
                alignItems: "center",
                padding: '0px',

            }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                style={{
                    position: "relative",
                    top: matchMobile ? "-5vh" : isMenuOpen ? "" : "-4vh",
                    left: matchMobile ? "" : isMenuOpen ? "0vw" : "",
                    /* NEW â†“â†“â†“ */
                    width: isDesktop ? "auto" : "90vw",
                    aspectRatio: "16/9",          // <â€” the key line
                    maxHeight: "90vh",              // keep it inside the viewport
                    textAlign: "center",
                    margin: "auto", padding: '0px',
                }}
            >
                {image ? (
                    /* ===== when we have an editable image: canvas ===== */
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
                ) :
                    /* ===== before upload: plain image from imagex ===== */

                    sampleImage ?

                        <img

                            onClick={() => {

                                setHideUI(!hideUI)
                            }}

                            src={sampleImage}

                            alt="thumbnail"
                            style={{
                                display: "block",
                                width: "100%",
                                height: "100%",
                                borderRadius: '5vh',
                                objectFit: "cover",
                                cursor: isDragging ? "grabbing" : "grab",
                                border: imagex
                                    ? `1px solid ${APPCOLOR}`
                                    : `1px dashed ${APPCOLOR}`,
                            }}
                        /> :
                        <img
                            src={imagex}

                            onClick={() => {

                                setHideUI(!hideUI)
                            }}

                            alt="thumbnail"
                            style={{
                                display: "block",
                                width: "100%",
                                height: "100%",
                                borderRadius: '5vh',
                                objectFit: "cover",
                                cursor: isDragging ? "grabbing" : "grab",
                                filter: load ? "blur(4px)" : matchMobile ? 'blur(1px)' : "blur(1px)",
                                border: imagex
                                    ? `1px solid ${APPCOLOR}`
                                    : `1px dashed ${APPCOLOR}`,
                            }}
                        />
                }


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
                                onClick={() => {

                                    ///setShowThumb(false);




                                    if (sampleImage) {
                                        startDelete(sampleImage);

                                    }

                                    setShowPicker(false);

                                }}
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

                {
                    <Box
                        sx={{
                            position: "absolute",
                            top: isDesktop ? image || sampleImage ? '0vh' : '-10vh' : '-27vh',
                            left: isDesktop ? "50%" : gutter,
                            width: isDesktop ? desktopWidth : mobileWidth,
                            transform: isDesktop ? "translateX(-50%)" : "none",
                            p: 1,
                            borderRadius: 1,
                            bgcolor: "rgba(50,50,50,0.9)",
                            backdropFilter: "blur(12px)",
                            display: hideUI ? 'none' : "flex",
                            alignItems: "center",
                            justifyContent: "space-between",

                        }}
                    >
                        {Stage === 0 ?

                            matchMobile ? <h4 style={{ color: '#ffffff' }}>
                                Thumbnail Creator
                            </h4> : <h3 style={{ color: '#ffffff' }}>
                                Thumbnail Creator
                            </h3>
                            :
                            <Slider
                                value={fontSize}
                                onChange={(_, v) => setFontSize(v as number)}
                                min={100} max={200} size="small"
                                sx={{
                                    flex: 0.4, minWidth: 120, color: APPCOLOR,
                                    visibility: Stage === 1 ? 'visible' : 'hidden'
                                }}
                            />

                        }

                        {Stage === 0 ?

                            sampleImage ?

                                <Button
                                    variant='contained'
                                    onClick={() => inputRef.current?.click()}
                                    sx={{
                                        flex: 0.8,
                                        color: "#fff",
                                        border: "1px solid #fff",
                                        textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                                    }}
                                >
                                    Image
                                </Button> :

                                <Button
                                    variant='outlined'
                                    onClick={() => inputRef.current?.click()}
                                    sx={{
                                        flex: 0.8,
                                        color: "#fff",
                                        border: "1px solid #fff",
                                        textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                                    }}
                                >
                                    Upload
                                </Button>


                            :

                            <>
                                <Button onClick={() => setShowPicker(true)} sx={{
                                    flex: 0.2, color: "#fff", border: "1px solid #fff",
                                    visibility: Stage === 1 ? 'visible' : 'hidden'
                                }}>
                                    Color
                                </Button>


                                <Button onClick={handleFont} sx={{
                                    flex: 0.2, color: "#fff", border: "1px solid #fff",
                                    visibility: Stage === 1 ? 'visible' : 'hidden'
                                }}>
                                    Font
                                </Button>

                            </>}






                        <IconButton
                            onClick={() => {

                                setShowThumb(false);

                                setShowPicker(false)
                            }}
                            sx={{
                                color: "#fff", flex: 0.1, textAlign: 'right',
                                display: Stage === 0 || Stage === 2 ? 'flex' : 'none'
                            }}
                        >
                            <CloseIcon />
                        </IconButton>


                    </Box>}


                <Box
                    sx={{
                        position: "absolute",
                        bottom: isDesktop ? image ? '67.5vh' : '40vh' : "31.5vh",
                        /// visibility: sampleImage ? 'hidden' : 'visible',


                        left: isDesktop ? "50%" : gutter,
                        width: isDesktop ? image ? '60%' : "100%" : mobileWidth,
                        transform: isDesktop ? "translateX(-50%)" : "none",
                        p: 1,

                        bgcolor: "rgba(50,50,50,0.9)",
                        borderRadius: '20vh',
                        backdropFilter: "blur(12px)",
                        display: hideUI ? 'none' : Stage === 0 ? "flex" : 'none',
                        alignItems: "center",
                    }}
                >
                    {/* scrolling button rail */}
                    <Box
                        sx={{

                            width: "100%",
                            display: "flex",
                            gap: 1,
                            height: '10vh',
                            paddingTop: '0.5vh',
                            paddingBottom: '0.5vh',
                            overflowX: "auto",
                            flexWrap: "nowrap",
                            pr: 1,
                            "&::-webkit-scrollbar": { display: "none" }, // hide scrollbar on WebKit
                        }}
                    >
                        {models.map((m, i) => (


                            i === 0 ?


                                <Typography
                                    variant="button"
                                    sx={{
                                        fontSize: matchMobile ? '1.9rem' : '2em',
                                        marginTop: '2.2vh',
                                        paddingLeft: '1vw',
                                        paddingRight: '1vw',
                                        lineHeight: 1,
                                        fontWeight: 700,
                                        background: GRADIENTx,
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        textShadow: darkModeReducer
                                            ? '0px 1px 2px rgba(0, 0, 0, 0), 0px 2px 4px rgba(0, 0, 0, 0)'
                                            : '0px 1px 2px rgba(0, 0, 0, 0.12), 0px 2px 4px rgba(0, 0, 0, 0.08)',
                                    }}
                                >
                                    {pixels.toLocaleString()}
                                    <Box component="span" sx={{ fontSize: '0.5em', visibility: 'hidden' }}>
                                        .
                                    </Box>
                                    <Box component="span" sx={{ fontSize: '0.5em', verticalAlign: 'baseline', }}>
                                        P
                                    </Box>
                                </Typography>
                                :
                                <Button
                                    key={m}
                                    onMouseDown={() => setModel(m)}
                                    onClick={() => setModel(m)}
                                    variant={model === m ? "contained" : "outlined"}
                                    disableElevation
                                    disableRipple
                                    sx={{
                                        borderRadius: "20vh",
                                        flex: "0 0 auto",
                                        textTransform: "none",
                                        width: matchMobile ? "38%" : "14%",
                                        border: model === m ? "none" : "1px solid #fff",
                                        color: model === m ? "#000" : "#fff",
                                        bgcolor:
                                            model === m
                                                ? darkModeReducer
                                                    ? "#F6BB56"
                                                    : "#ff8a00"
                                                : "transparent",
                                        transition: "background 150ms ease, border 150ms ease, transform 80ms ease",

                                        "&:hover": {
                                            bgcolor:
                                                model === m
                                                    ? darkModeReducer
                                                        ? "#F6BB56"
                                                        : "#ff8a00"
                                                    : "rgba(255,255,255,0.12)",
                                            border: model === m ? "none" : "1px solid #fff",
                                        },
                                        "&:active": {
                                            transform: "scale(0.75)",
                                            bgcolor:
                                                model === m ? "#E6A548" : "rgba(255,255,255,0.20)",
                                            border: model === m ? "none" : "1px solid #fff",
                                        },
                                    }}
                                >
                                    {/* stack label + pixel cost */}
                                    <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>

                                        {
                                            m === 'Gpt Image' ? 'GPT iMAGE' :
                                                m === 'minimax' ? 'SEA DREAM' :
                                                    m === 'Schnell' ? 'SCHNELL' :
                                                        m === 'fluxUltra' ? 'FLUX MAX' :
                                                            m === 'fluxDev' ? 'Reve' :
                                                                m === 'Imagenx' ? 'IMAGEN' :
                                                                    m === 'banana' ? 'BANANA' : m

                                        }
                                        <ModelPixelsx model={m === 'banana' ? 'Imagen' : m} baseImagesPerDollar={333} />
                                    </span>
                                </Button>





                        ))}
                    </Box>
                </Box>





                <Box
                    sx={{
                        position: "absolute",
                        bottom: matchMobile ? '-17vh' : '27vh',
                        left: isDesktop ? "50%" : gutter,
                        width: isDesktop ? '100%' : mobileWidth,
                        transform: isDesktop ? "translateX(-50%)" : "none",
                        p: matchMobile ? 2 : 2,
                        borderRadius: isDesktop ? 0 : 1,
                        bgcolor: "rgba(50,50,50,0.9)",
                        backdropFilter: "blur(18px)",
                        display: hideUI ? 'none' : Stage === 0 ? "flex" : 'none',
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >

                    <Box sx={{ width: "90%" }}>

                        <TextField
                            onKeyDown={handleKeyDown}
                            label={"Explain Your Youtube Video"}
                            variant="filled"
                            size="small"
                            fullWidth
                            value={text3}
                            onChange={(e) => {


                                setText3(e.target.value)


                            }}
                            slotProps={{ input: { sx: { color: "#fff" } } }}
                            sx={{


                                "& .MuiInputBase-input": {

                                    caretColor: 'auto !important',
                                    /// outline: 'auto !important',
                                },

                                "& .MuiInputLabel-root": { color: "#ccc" },
                                "& .MuiFilledInput-underline:after": {
                                    borderBottomColor: 'RED'
                                },
                                "& .MuiFilledInput-root.Mui-focused:after": {
                                    borderBottomColor: 'RED'
                                }
                            }}
                        />
                    </Box>
                    <Box sx={{ width: "10%", textAlign: "center", display: image ? 'block' : 'none' }}>
                        {Loading ? null : <IconButton
                            onClick={() => {

                                setStage(1);

                            }}
                            sx={{
                                color: APPCOLOR,
                                border: `1px solid ${APPCOLOR}`,
                                borderRadius: "50%",
                                p: 1,
                                filter: "drop-shadow(0 0 4px rgba(0,0,0,.8))", // halo
                            }}
                        >
                            <EastIcon />
                        </IconButton>}
                    </Box>

                </Box>
                {/* BOTTOM BAR */}
                <Box
                    sx={{
                        position: "absolute",
                        bottom: matchMobile ? '-30vh' : '17.5vh',
                        left: isDesktop ? "50%" : gutter,
                        width: isDesktop ? desktopWidth : mobileWidth,
                        transform: isDesktop ? "translateX(-50%)" : "none",
                        p: matchMobile ? 2 : 2,
                        borderRadius: isDesktop ? 0 : 1,
                        bgcolor: "rgba(50,50,50,0.9)",
                        backdropFilter: "blur(18px)",
                        display: hideUI ? 'none' : Stage === 0 ? "flex" : 'none',
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >

                    <Box sx={{ width: "90%" }}>

                        <TextField
                            onKeyDown={handleKeyDown}
                            label={
                                sampleImage
                                    ? 'Describe the desired edits on your image'
                                    : 'Describe the desired thumbnail appearance and art style'
                            }

                            variant="filled"
                            size="small"
                            fullWidth
                            value={text2}
                            onChange={(e) => {


                                setText2(e.target.value)


                            }}
                            slotProps={{ input: { sx: { color: "#fff" } } }}
                            sx={{


                                "& .MuiInputBase-input": {

                                    caretColor: 'auto !important',
                                    /// outline: 'auto !important',
                                },

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
                        {Loading ? null : <IconButton
                            onClick={() => {

                                Submit();

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
                        </IconButton>}
                    </Box>
                </Box>


                <Box
                    sx={{
                        position: "absolute",
                        bottom: matchMobile ? '-30vh' : '11vh',
                        left: isDesktop ? "50%" : gutter,
                        width: isDesktop ? desktopWidth : mobileWidth,
                        transform: isDesktop ? "translateX(-50%)" : "none",
                        p: matchMobile ? 2 : 2,
                        borderRadius: 1,
                        bgcolor: "rgba(0,0,0,0.6)",
                        backdropFilter: "blur(18px)",
                        display: hideUI ? 'none' : Stage === 1 ? "flex" : 'none',
                        alignItems: "center",
                        justifyContent: "space-between",
                    }}
                >

                    <Box sx={{ width: "10%", textAlign: "center", marginLeft: '-2vw' }}>
                        <IconButton
                            onClick={() => {

                                setStage(0);

                            }}
                            sx={{
                                color: APPCOLOR,
                                border: `1px solid ${APPCOLOR}`,
                                borderRadius: "50%",
                                p: 1,
                                filter: "drop-shadow(0 0 4px rgba(0,0,0,.8))", // halo
                            }}
                        >


                            <KeyboardBackspaceIcon />
                        </IconButton>
                    </Box>

                    <Box sx={{ width: "60%" }}>

                        <TextField
                            /// onKeyDown={handleKeyDown}
                            label={"Add Text"}
                            variant="filled"
                            size="small"
                            fullWidth
                            value={text}
                            onChange={(e) => {


                                setText(e.target.value)


                            }}
                            slotProps={{ input: { sx: { color: "#fff" } } }}
                            sx={{


                                "& .MuiInputBase-input": {

                                    caretColor: 'auto !important',
                                    /// outline: 'auto !important',
                                },

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

                                setStage(2);

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

                {
                    Stage === 2 && (
                        <Box
                            sx={{
                                position: "absolute",
                                height: '90vh',
                                top: isDesktop ? '0vh' : '-27vh',
                                left: isDesktop ? "50%" : gutter,
                                width: isDesktop ? desktopWidth : mobileWidth,
                                transform: isDesktop ? "translateX(-50%)" : "none",
                                p: 2,
                                borderRadius: 1,
                                bgcolor: "rgba(50,50,50,0.9)",

                                backdropFilter: "blur(12px)",
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                                zIndex: '20000',
                                alignItems: "center",
                            }}
                        >
                            {/* back button */}
                            <IconButton
                                onClick={() => setStage(1)}
                                sx={{
                                    alignSelf: "flex-start",
                                    color: "#fff",
                                }}
                            >
                                <ArrowBackIcon />
                            </IconButton>

                            <IconButton
                                onClick={() => setShowThumb(false)}
                                sx={{
                                    alignSelf: "flex-end",
                                    color: "#fff",
                                    position: 'absolute'
                                }}
                            >
                                <CloseIcon />
                            </IconButton>



                            {/* final image preview */}
                            {finalUrl && (
                                <img
                                    src={finalUrl}
                                    alt="thumbnail preview"
                                    style={{
                                        width: matchMobile ? '100%' : "30%",
                                        borderRadius: theme.shape.borderRadius,
                                        border: `1px solid ${APPCOLOR}`,
                                    }}
                                />
                            )}

                            {/* download button */}
                            <Button
                                variant="contained"
                                onClick={downloadThumb}
                                sx={{
                                    bgcolor: APPCOLOR,
                                    width: "60%",
                                    color: textColorx,
                                    /// textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                                    borderRadius: 2,
                                    fontWeight: 600,
                                    transition: "box-shadow 200ms ease, transform 100ms ease",
                                    "&:hover": {
                                        boxShadow: "0 6px 10px rgba(0,0,0,0.15)",
                                        transform: "translateY(-1px)",
                                        bgcolor: APPCOLOR,
                                    },
                                    "&:active": {
                                        boxShadow: "0 3px 4px rgba(0,0,0,0.2)",
                                        transform: "translateY(0)",
                                    },
                                }}
                            >
                                Download PNG
                            </Button>


                            {/* metadata fields */}



                            <><Box
                                sx={{
                                    width: '100%',
                                    maxHeight: matchMobile ? '60vh' : '50vh',
                                    overflowY: 'auto',
                                    pr: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    bgcolor: 'rgba(0,0,0,0.76)',
                                    borderRadius: '5px',
                                    gap: 6,
                                    '& .MuiInputBase-input, & .MuiInputLabel-root, & .MuiFilledInput-root': {
                                        color: '#ffffff',
                                    },
                                    '& .MuiInputLabel-root': { color: '#cccccc' },
                                    '&::-webkit-scrollbar': { width: 0, height: 0 },
                                }}
                            >
                                {/* Title */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <TextField
                                        fullWidth
                                        label="Title"
                                        value={title}
                                        InputProps={{ readOnly: true }}
                                        size="small"
                                        variant="filled"
                                        sx={{
                                            flex: 1,

                                            "& .MuiInputBase-input": {

                                                caretColor: 'auto !important',
                                                /// outline: 'auto !important',
                                            },
                                        }}
                                    />
                                    <IconButton onClick={() => copy(title)} sx={{ color: '#ffffff' }}>
                                        <ContentCopyIcon fontSize="small" />
                                    </IconButton>
                                </Box>


                                {/* Description */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <TextField
                                        fullWidth
                                        multiline
                                        minRows={3}
                                        label="Description"
                                        value={description}
                                        InputProps={{ readOnly: true }}
                                        size="small"
                                        variant="filled"
                                        sx={{
                                            flex: 1,
                                            "& .MuiInputBase-input": {

                                                caretColor: 'auto !important',
                                                /// outline: 'auto !important',
                                            },
                                        }}
                                    />
                                    <IconButton onClick={() => copy(description)} sx={{ color: '#ffffff' }}>
                                        <ContentCopyIcon fontSize="small" />
                                    </IconButton>
                                </Box>


                                {/* Tags */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <TextField
                                        fullWidth
                                        label="Tags"
                                        value={tags.join(', ')}
                                        InputProps={{ readOnly: true }}
                                        size="small"
                                        variant="filled"
                                        sx={{
                                            flex: 1,
                                            "& .MuiInputBase-input": {

                                                caretColor: 'auto !important',
                                                /// outline: 'auto !important',
                                            },
                                        }}
                                    />
                                    <IconButton onClick={() => copy(tags.join(', '))} sx={{ color: '#ffffff' }}>
                                        <ContentCopyIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            </Box>

                                {/* tiny â€œCopied!â€ toast */}
                                <Snackbar
                                    open={snack.open}
                                    autoHideDuration={2000}
                                    onClose={() => setSnack({ open: false, msg: '' })}
                                    message={snack.msg}
                                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                                />
                            </>

                        </Box>
                    )
                }


                {
                    Loading ? <Box
                        sx={{
                            position: "absolute",
                            top: "-1vh",
                            left: isDesktop ? "50%" : '0px',
                            width: '100%',
                            height: '105%',
                            transform: isDesktop ? "translateX(-50%)" : "none",
                            p: 1,
                            borderRadius: 1,
                            bgcolor: "rgba(0,0,0,0.3)",
                            backdropFilter: "blur(12px)",
                            display: hideUI ? 'none' : Stage === 0 ? "flex" : 'none',
                            alignItems: "center",
                        }}
                    >

                        <span style={{ color: '#ffffff' }}> Loading...</span>


                    </Box> : null
                }


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

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                />


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

export default ThumbnailYoutube;
