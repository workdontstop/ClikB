import React, {
    useCallback,
    useState,
    useEffect,
    useRef,
    useLayoutEffect,
} from "react";


import axios from "axios";


import { keyframes } from "@emotion/react";

import ArrowRightIcon from '@mui/icons-material/ArrowRight';

import SaveIcon from '@mui/icons-material/Save';

import ReportOffIcon from '@mui/icons-material/ReportOff';

import { useSelector } from "react-redux";
import { RootState } from "./store";
import EditIcon from "@mui/icons-material/Edit";
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import { useNavigate } from "react-router-dom";

import VoicePicker from "./VoicePicker";

import AudioPicker from "./AudioPicker";

import Thumbnail from "./Thumbnail";

import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";

import CloseIcon from "@mui/icons-material/Close"; // Import CloseIcon

import MusicNoteIcon from "@mui/icons-material/MusicNote";

import {
    Button,
    Box,
    Typography,
    CircularProgress,
    IconButton,
    Stack,
} from "@mui/material";
import { matchMobile } from "./DetectDevice";

import VolumeUpIcon from "@mui/icons-material/VolumeUp";

import EditStory from "./EditStory";
import { Title } from "@mui/icons-material";

const CLIK_URL = import.meta.env.VITE_CLIK_URL;
const VITE_GOOGLE_TTS = import.meta.env.VITE_GOOGLE_TTS;
const VITE_HUGG = import.meta.env.VITE_HUGG;

const VITE_REPLI_KEY = import.meta.env.VITE_REPLI_KEY;

interface StorybookProps {
    /** Array of steps (short text strings) to display in the horizontal scroller */
    steps: string[];
    /** Additional prompt if needed */
    //typex
    prompt: string;
}

var timerbc: any = null;
export const Storybook: React.FC<any> = ({
    steps,
    prompt,
    isSubmittingKick,
    setIsSubmittingKick,
    handleCloseOverlay,
    setcallFeeds,
    setSteps,
    GeneratedImage,
    setStopText,
    GotIm,
    generatedImagesFlux,
    setGeneratedImagesFlux,
    modelz,
    Planx,
    isMenuOpen,
    type,
    GenerateSignedUrl,
    PostId,
    setPostId,
    Seed,
    DummyMode
}) => {
    const loggedUser = useSelector(
        (state: RootState) => state.profile.loggedUser
    );

    const navigate = useNavigate();


    const [HaltPublish, setHaltPublish] = useState(false);

    useEffect(() => {

        if (HaltPublish) {

            setTimeout(() => {
                setHaltPublish(false);
            }, 9000);
        }

    }, [

        HaltPublish
    ])


    const [Continue, setContinue] = useState(false);


    const glassSweep = keyframes`
          from { transform: translateX(-150%) rotate(20deg); }
          to   { transform: translateX(150%)  rotate(20deg); }
        `;


    const [HideSave, setHideSave] = useState(false);

    // alert  This state will hold the generated image URLs for each step
    const [generatedImages, setGeneratedImages] = useState<string[]>(
        Array(steps.length).fill("")
    );

    const [MemeMusic, setMemeMusic] = useState(true);

    const [ImagesHdCloud, setImagesHdCloud] = useState<string[]>([]);

    const [generatedImagesBlob, setGeneratedImageBlob] = useState<Blob[]>(
        Array(steps.length).fill(null) as Blob[]
    );

    const [GeneratedText, setGeneratedText] = useState<string[]>([]);

    const [TextVideo, setTextVideo] = useState<string[]>([]);

    const [VideoArray, setVideoArray] = useState<string[]>([]);
    const [VideoArrayBlob, setVideoArrayBlob] = useState<string[]>([]);

    const [VideoArrayCloud, setVideoArrayCloud] = useState<string[]>([]);



    const [base, setbase] = useState<string[]>([]);

    const [Name, setName] = useState("Voices");

    const [musicname, setmusicname] = useState("Music");

    const [music, setmusic] = useState(
        MemeMusic && type === 0 ? 'https://clikbatebucket.s3.us-east-1.amazonaws.com/videos/audio-b50013a478814b136194434fe19576d7-trim-1749103536560.mp3'
            : "https://clikbatebucket.s3.us-east-1.amazonaws.com/videos/audio-96c7d18ac1609b81b25616be0a56cdb5-trim-1749230077880.mp3");

    const [generatedImagesFluxBlob, setGeneratedImagesFluxBlob] = useState<
        Blob[]
    >(Array(steps.length).fill(null) as Blob[]);

    const [generatedImagesFluxBlobHd, setGeneratedImagesFluxBlobHd] = useState<
        Blob[]
    >(Array(steps.length).fill(null) as Blob[]);

    // Whenever `steps` changes, re-initialize generatedImages
    useEffect(() => {
        setDone(false);
        /// setDonex(false);
        setGeneratedImages(Array(steps.length).fill(""));
    }, [steps]);

    const [narrate, setnarrate] = useState(0);

    const darkModeReducer = useSelector(
        (state: RootState) => state.settings.darkMode
    );

    const darkMode = darkModeReducer;

    const [startEdit, setstartEdit] = useState(false);

    const [activeEdit, setactiveEdit] = useState(0);

    const [flip, setflip] = useState(false);

    const [generatedAudios, setGeneratedAudios] = useState<string[]>([]);
    const [generatedAudiosCloud, setGeneratedAudiosCloud] = useState<string[]>(
        []
    );

    const [showVoices, setShowVoices] = useState(false);
    const [voice, setVoice] = useState("en-US-Chirp-HD-O");

    const [loaders, setLoaders] = useState<number[]>(
        () => Array(steps.length).fill(0) // first render
    );


    const [VideMode, setVideMode] = useState(false);

    useEffect(() => {
        if (ImagesHdCloud.length === generatedImages.length) {

            setVideMode(true);
            setnarrate(2);
        } else {
            setVideMode(false);
            setnarrate(0);

        }

    }, [ImagesHdCloud, generatedImages]);

    // 2) Using filter()
    const removeFromStep = (index: number) => {
        // Remove from the “low-res” blobs
        setGeneratedImagesFluxBlob((prev: any) =>
            prev.filter((_: any, i: any) => i !== index)
        );

        // Remove from the “HD” blobs
        setGeneratedImagesFluxBlobHd((prev: any) =>
            prev.filter((_: any, i: any) => i !== index)
        );

        // Remove from the URL/previews
        setGeneratedImagesFlux((prev: any) =>
            prev.filter((_: any, i: any) => i !== index)
        );

        setSteps((prev: any) =>
            prev.filter((_: any, i: any) => i !== index)  // keep all but the one at `index`
        );
    };


    useEffect(() => {
        setLoaders((prev) => {
            /* if the length is already correct, keep existing values */
            if (prev.length === steps.length) return prev;

            const next = [...prev];

            /* pad with zeros when steps grow */
            while (next.length < steps.length) next.push(0);

            /* trim extras when steps shrink */
            if (next.length > steps.length) next.length = steps.length;

            return next;
        });
    }, [steps.length]);

    /* 2️⃣ one timer handle per tile */
    const loaderTimers = useRef<Record<number, NodeJS.Timeout>>({});

    /* ------------------------------------------------------------------ */
    /* startLoader(idx)                                                   */
    /* ------------------------------------------------------------------ */
    function startLoader(idx: number) {
        /* clear any previous timer on this slot */
        clearInterval(loaderTimers.current[idx]);

        /* ensure loaders[] is long enough and set to 1 % immediately */
        setLoaders((prev) => {
            const next = [...prev];
            while (next.length <= idx) next.push(0); // pad if needed
            next[idx] = 1; // show tiny slice
            return next;
        });

        const begun = Date.now();
        const DURATION = 3 * 60 * 1000; // 5 min
        const CAP = 95; // synthetic max %

        loaderTimers.current[idx] = setInterval(() => {
            const t = Math.min((Date.now() - begun) / DURATION, 1); // 0–1
            const eased = 1 - Math.pow(1 - t, 3); // ease-out
            const pct = Math.max(1, Math.round(eased * CAP)); // ≥1 %

            /* update state */
            setLoaders((prev) => {
                const next = [...prev];
                if (pct > (next[idx] ?? 0)) next[idx] = pct; // never go backwards
                return next;
            });
        }, 200);
    }

    /* ------------------------------------------------------------------ */
    /* finishLoader(idx)                                                  */
    /* ------------------------------------------------------------------ */
    function finishLoader(idx: number) {
        clearInterval(loaderTimers.current[idx]);

        /* snap to 100 % */
        setLoaders((prev) => {
            const next = [...prev];
            if (next.length > idx) next[idx] = 100;
            return next;
        });

        /* hold for 1 s then hide overlay */
        setTimeout(() => {
            setLoaders((prev) => {
                const next = [...prev];
                if (next.length > idx) next[idx] = 0; // 0 signals overlay off
                return next;
            });
        }, 7000);
    }

    useEffect(() => {
        //  console.log('loaders', loaders);
    }, loaders);



    /**
     * 1. Call your backend to get a “visualPromptText.”
     * 2. Then call the huggingface SDXL endpoint with that text to generate an image.
     */
    // Define the sleep function
    const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

    const [dbLoad, setdbLoad] = useState(false);

    const [ThumbGo, setThumbGo] = useState(false);

    const Close = () => {
        setIsSubmittingKick(false);
        setSteps([]);
        handleCloseOverlay();
        setGeneratedImagesFlux([]);
        setGeneratedImagesFluxBlob([]);
    };

    const [isLoading, setisLoading] = useState<boolean>(false);

    const [LoadData, setLoadData] = useState("Processing..");

    const [saveBlob, setsaveBlob] = useState<any>(null);

    const [Done, setDone] = useState<boolean>(false);

    const [Donex, setDonex] = useState<boolean>(true);

    const [EnhanceCaption, setEnhanceCaption] = useState("");

    const [EnhanceTitle, setEnhanceTitle] = useState("");




    /* 1️⃣  NEW STATE  –– lives with your other useState hooks            */
    const [firstImageDims, setFirstImageDims] = useState<{
        width: number;
        height: number;
    } | null>(null);

    const firstImageRef = useRef<HTMLImageElement | null>(null);

    /* --- effect: whenever the first image URL changes, read its size ---------- */
    useEffect(() => {
        const imgEl = firstImageRef.current;
        if (!imgEl) return; // the element isn’t in the DOM yet

        // If the image has already loaded (cached), read dimensions right away.
        if (imgEl.complete) {
            setFirstImageDims({
                width: imgEl.naturalWidth,
                height: imgEl.naturalHeight,
            });
        }

        // Otherwise wait for the load event.
        const handleLoad = () => {
            setFirstImageDims({
                width: imgEl.naturalWidth,
                height: imgEl.naturalHeight,
            });
        };

        imgEl.addEventListener("load", handleLoad);

        return () => imgEl.removeEventListener("load", handleLoad);
    }, [generatedImagesFlux?.[0]]); // fires when the first URL changes



    const saveToDastabase = useCallback(
        (blobs: any, HdFluxArray: any) => {
            setImagesHdCloud(HdFluxArray);

            setisLoading(true);
            setLoadData("Saving..");

            const dataToSave = {
                id: loggedUser ? loggedUser.id : null,
                topic: "",
                mode: type === 0 ? 0 : 1,
                caption: prompt,
                // Map each generated image into its respective field (up to 8).
                image1: blobs[0] || null,
                image2: blobs[1] || null,
                image3: blobs[2] || null,
                image4: blobs[3] || null,
                image5: blobs[4] || null,
                image6: blobs[5] || null,
                image7: blobs[6] || null,
                image8: blobs[7] || null,

                imageHd1: HdFluxArray[0] || null,
                imageHd2: HdFluxArray[1] || null,
                imageHd3: HdFluxArray[2] || null,
                imageHd4: HdFluxArray[3] || null,
                imageHd5: HdFluxArray[4] || null,
                imageHd6: HdFluxArray[5] || null,
                imageHd7: HdFluxArray[6] || null,
                imageHd8: HdFluxArray[7] || null,

                txt1: steps[0] || null,
                txt2: steps[1] || null,
                txt3: steps[2] || null,
                txt4: steps[3] || null,
                txt5: steps[4] || null,
                txt6: steps[5] || null,
                txt7: steps[6] || null,
                txt8: steps[7] || null,

                GeneratedText1: GeneratedText[0] || null,
                GeneratedText2: GeneratedText[1] || null,
                GeneratedText3: GeneratedText[2] || null,
                GeneratedText4: GeneratedText[3] || null,
                GeneratedText5: GeneratedText[4] || null,
                GeneratedText6: GeneratedText[5] || null,
                GeneratedText7: GeneratedText[6] || null,
                GeneratedText8: GeneratedText[7] || null,
            };

            axios
                .post(`${CLIK_URL}/PostStory`, {
                    values: dataToSave,
                })
                .then((response: any) => {
                    console.log(response.data);

                    const newRowId = response.data.go;
                    console.log("Inserted row ID:", newRowId);

                    setStopText(false);

                    setdbLoad(false);
                    setHideSave(false);
                    setisLoading(false);

                    //setdbLoad(false);

                    ///setTimeout(() => { setcallFeeds(true); }, 500);

                    ///setTimeout(() => { Close(); }, 1000);

                    setPostId(newRowId);




                })
                .catch((error) => {
                    setHideSave(false);
                    setdbLoad(false);
                    setisLoading(false);
                    //  handleCloseOverlay();
                    setHideSave(false);
                    Close();
                    console.log(error);
                });
        },
        [
            loggedUser,
            prompt,
            generatedImagesFlux,
            steps,
            GeneratedText,
            voice,
            type,
            PostId,
            ImagesHdCloud,
            MemeMusic,
            music
        ]
    );



    const GenerateSignedUrlForSingleImage = async (blob: Blob) => {
        if (!blob) throw new Error("No image Blob to generate a signed URL.");

        // Example request body:
        const requestData = { values: { count: 1 } };

        const response: any = await axios.post(
            `${CLIK_URL}/get_signed_url_imageStory`,
            requestData,
            {
                withCredentials: true,
            }
        );

        // Suppose the response structure is { holder: [ { urlBase, urlHD } ] }
        const holder = response.data.holder;
        if (!holder || holder.length !== 1) {
            throw new Error("Invalid signed URL response.");
        }

        const signedUrls = holder[0];
        if (!signedUrls.urlHD) {
            throw new Error("Missing signed URLs for images.");
        }

        return signedUrls;
    };

    const PutSingleImageInS3WithURL = async (blob: Blob, signedUrls: any) => {
        if (!signedUrls.urlHD) {
            throw new Error("Signed URL is not available for uploading.");
        }
        if (!blob) {
            throw new Error("Image blob is not available for uploading.");
        }

        // Upload HD Image
        const uploadHD = await axios.put(signedUrls.urlHD, blob, {
            headers: {
                "Content-Type": blob.type || "application/octet-stream",
            },
        });

        if (uploadHD.status !== 200 && uploadHD.status !== 204) {
            throw new Error(`HD image upload failed with status ${uploadHD.status}`);
        }

        console.log("HD image uploaded successfully.");
        // Extract the S3 URL (remove query params)
        const uploadedHdUrl = signedUrls.urlHD.split("?")[0];
        return uploadedHdUrl;
    };

    const uploadAllImagesToS3 = useCallback(async () => {
        setisLoading(true);
        setLoadData("Uploading Images..");

        setdbLoad(true);


        // setdbLoad(true);

        try {
            // We’ll store the final S3 URLs here
            const s3Urls: string[] = [];

            // Loop through each generated Blob
            for (let i = 0; i < generatedImagesFluxBlobHd.length; i++) {
                const blob = generatedImagesFluxBlobHd[i];
                if (!blob) {
                    s3Urls.push(""); // or null
                    continue;
                }

                // 1) Call your existing function to get a signed URL
                const signedUrls = await GenerateSignedUrlForSingleImage(blob);

                // 2) Call the actual "put" operation, uploading to S3
                const uploadedHdUrl = await PutSingleImageInS3WithURL(blob, signedUrls);

                // 3) Push the final HD S3 URL into our array
                s3Urls.push(uploadedHdUrl);
            }

            // Now that all images are uploaded, call saveToDastabase with final URLs

            ///setDone(true);
            uploadAllImagesToS3Default(s3Urls);
        } catch (err) {
            setisLoading(false);
            setHideSave(false);
            Close();
            console.error("Error uploading all images to S3  HDss:", err);
        }
    }, [
        generatedImagesFlux,
        saveToDastabase,
        steps,
        generatedImagesFluxBlobHd,
        GeneratedText,
        voice,
        type,
        PostId,
        ImagesHdCloud,
        MemeMusic,
        music
    ]);

    const uploadAllImagesToS3Default = useCallback(
        async (HdFluxArray: any) => {
            setdbLoad(true);

            // setdbLoad(true);

            try {
                // We’ll store the final S3 URLs here
                const s3Urls: string[] = [];

                // Loop through each generated Blob
                for (let i = 0; i < generatedImagesFluxBlob.length; i++) {
                    const blob = generatedImagesFluxBlob[i];
                    if (!blob) {
                        s3Urls.push(""); // or null
                        continue;
                    }

                    // 1) Call your existing function to get a signed URL
                    const signedUrls = await GenerateSignedUrlForSingleImage(blob);

                    // 2) Call the actual "put" operation, uploading to S3
                    const uploadedHdUrl = await PutSingleImageInS3WithURL(
                        blob,
                        signedUrls
                    );

                    // 3) Push the final HD S3 URL into our array
                    s3Urls.push(uploadedHdUrl);
                }

                // Now that all images are uploaded, call saveToDastabase with final URLs

                ///setDone(true);
                saveToDastabase(s3Urls, HdFluxArray);
            } catch (err) {
                setHideSave(false);
                Close();
                console.error("Error uploading all images to S3:", err);
            }
        },
        [
            generatedImagesFlux,
            saveToDastabase,
            steps,
            generatedImagesFluxBlob,
            GeneratedText,
            voice,
            type,
            PostId,
            ImagesHdCloud,
            MemeMusic,
            music
        ]
    );

    useEffect(() => {
        // Check if all items are not empty strings
        const allItemsFilled = generatedImagesFluxBlob.every(
            (item) => item instanceof Blob
        );

        // Alternatively, if you want to check for non-null and non-empty:
        // const allItemsFilled = generatedImagesFlux.every(item => item != null && item.trim() !== "");

        // Check if the number of filled items equals the number of steps
        if (allItemsFilled && generatedImagesFluxBlob.length === steps.length) {
            //saveToDastabase();

            setDone(true);
            /// uploadAllImagesToS3();
        }
    }, [generatedImagesFluxBlob, steps, generatedImagesFlux]);

    // Add a new piece of state to track poll status
    const [pollStatus, setPollStatus] = useState<string>("");

    // Example updated handleSubmitFluxImage
    const handleSubmitSdxlRepli = useCallback(
        async (
            imageUrlFromSdxl: any,
            enhancedPrompt: any,
            loggedUserx: any,
            index: any
        ) => {
            setPollStatus("Polling Replicate...");

            try {
                let base64Image = "";

                // If we have an image URL from SDXL (or anywhere)
                if (imageUrlFromSdxl && imageUrlFromSdxl.trim() !== "") {
                    const imageResponse = await fetch(imageUrlFromSdxl);
                    if (!imageResponse.ok) {
                        throw new Error(
                            `Failed to fetch image: ${imageResponse.statusText}`
                        );
                    }
                    const imageBlob = await imageResponse.blob();

                    // Convert Blob -> base64
                    base64Image = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(imageBlob);
                    });
                }

                // Build the payload
                const payload: any = {
                    inputs: enhancedPrompt,
                    // any extra parameters you need
                    width: 1080,
                    height: 1920,
                    guidance: 7.5,
                    num_inference_steps: 35,
                };

                // Conditionally include the image if available
                var url = "sdxlReplicatePro";

                if (base64Image) {
                    payload.image = base64Image;
                    url = "sdxlReplicate";
                }

                // Make the POST request
                const response: any = await axios.post(`${CLIK_URL}/${url}`, payload, {
                    withCredentials: true,
                });

                if (response.status !== 200) {
                    throw new Error(`FluxSchnell route error: ${response.status}`);
                }

                // Extract final base64 from server
                const { imageBase64 } = response.data;
                if (!imageBase64) {
                    throw new Error("No imageBase64 returned from server");
                }

                // Convert the returned base64 back to a Blob
                const fluxImageBlobx = await (async () => {
                    const fetchRes = await fetch(imageBase64);
                    return await fetchRes.blob();
                })();

                // Convert the blob to HD WebP
                const ImageBlob = await convertToHDWebpOrJpegByDevice(
                    fluxImageBlobx,
                    ""
                );

                ///setGeneratedImageFluxBlob(fluxImageBlob);

                /// GenerateSignedUrl(fluxImageBlob, enhancedPrompt, loggedUserx);

                const ImageUrl = URL.createObjectURL(ImageBlob);

                setGeneratedImageBlob((prev) => {
                    const next = [...prev];
                    next[index] = ImageBlob;
                    return next;
                });

                setGeneratedImages((prev) => {
                    const next = [...prev];
                    next[index] = ImageUrl;
                    return next;
                });

                await handleSubmitFluxImageNew(
                    ImageUrl,
                    enhancedPrompt,
                    loggedUser,
                    index
                );

                /// setGeneratedImageFlux(fluxImageUrl);
            } catch (err) {
                console.error("Error calling Flux Inference Endpoint:", err);
                setPollStatus("Failed!");
            }
        },
        [prompt, generatedImages, generatedImagesFlux, modelz, Planx]
    );

    const [anyVideoReady, setAnyVideoReady] = useState(false);


    useEffect(() => {
        const ready =
            // walk every index in `steps`, and succeed if *any* VideoArray[i] is a real, non-blank string
            steps.some((_: any, i: any) => {
                const v = VideoArray[i];
                return (
                    v != null &&                // not null or undefined
                    typeof v === "string" &&
                    v.trim().length > 0         // not empty or just whitespace
                );
            });

        setAnyVideoReady(ready);
    }, [VideoArray, steps]);


    const [allVideosReady, setAllVideosReady] = useState(false);

    // 2) effect to recompute whenever VideoArray or steps change
    useEffect(() => {
        const ready =
            VideoArray.length === steps.length &&                // same length
            steps.every((_: any, i: any) => {                              // for each position…
                const v = VideoArray[i];
                return (
                    v != null &&                                    // not null or undefined
                    typeof v === 'string' &&
                    v.trim().length > 0                             // non-blank
                );
            });

        setAllVideosReady(ready);
    }, [VideoArray, steps]);



    const ContinueGen = () => {





        fetchAndGenerateImage(
            steps[1], // next prompt
            1, // next index
            '',/// lastBlob, // last blob as input
            1 // image-to-image mode, for example
        );

        setContinue(false);

    }






    // Example updated handleSubmitFluxImage
    const handleSubmitFluxImageNew = useCallback(
        async (
            imageUrlFromSdxl: any,
            enhancedPrompt: any,
            loggedUserx: any,
            index: any
        ) => {
            startLoader(index);
            setPollStatus("Polling Replicate...");
            if (index === 0) {
                setContinue(false);
            }
            try {
                let base64Image = "";

                // If we have an image URL from SDXL (or anywhere)
                if (imageUrlFromSdxl && imageUrlFromSdxl.trim() !== "") {
                    const imageResponse = await fetch(imageUrlFromSdxl);
                    if (!imageResponse.ok) {
                        throw new Error(
                            `Failed to fetch image: ${imageResponse.statusText}`
                        );
                    }
                    const imageBlob = await imageResponse.blob();

                    // Convert Blob -> base64
                    base64Image = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(imageBlob);
                    });
                }

                // Build the payload
                const payload: any = {
                    inputs: enhancedPrompt,
                    // any extra parameters you need
                    width: 1080,
                    height: 1920,
                    guidance: 7.5,
                    num_inference_steps: 35,
                };

                // Conditionally include the image if available
                var url = "fluxDev";

                if (modelz === 'Flux Pro') {
                    ///  url = 'fluxPro';

                    if (base64Image) {
                        payload.image = base64Image;
                        url = 'fluxDev';
                    }
                } else if (modelz === 'Schnell') {
                    url = 'fluxschnell';

                } else if (modelz === 'Hi Dream') {

                    url = 'HiDream';
                }
                else if (modelz === 'Ideogram') {

                    url = 'Ideogram';
                }
                else if (modelz === 'Imagen') {

                    url = 'Imagen';
                }
                else if (modelz === 'Gpt Image') {

                    url = 'GptImage';
                } else {

                    url = 'fluxschnell';


                }
                // Make the POST request
                const response: any = await axios.post(`${CLIK_URL}/${url}`, payload, {
                    withCredentials: true,
                });

                if (response.status !== 200) {
                    throw new Error(`FluxSchnell route error: ${response.status}`);
                }

                finishLoader(index);

                setTimeout(async () => {
                    // Extract final base64 from server
                    const { imageBase64 } = response.data;
                    if (!imageBase64) {
                        throw new Error("No imageBase64 returned from server");
                    }

                    // Convert the returned base64 back to a Blob
                    const fluxImageBlobx = await (async () => {
                        const fetchRes = await fetch(imageBase64);
                        return await fetchRes.blob();
                    })();

                    // Convert the blob to HD WebP
                    const fluxImageBlob = await convertToHDWebpOrJpegByDevice(
                        fluxImageBlobx,
                        modelz
                    );

                    const fluxImageBlobHd = await convertToHDWebpOrJpegByDeviceHd(
                        fluxImageBlobx,
                        modelz
                    );

                    if (index === 0) {
                        setsaveBlob(fluxImageBlob);
                    }

                    ///setGeneratedImageFluxBlob(fluxImageBlob);

                    /// GenerateSignedUrl(fluxImageBlob, enhancedPrompt, loggedUserx);

                    const fluxImageUrl = URL.createObjectURL(fluxImageBlob);

                    setGeneratedImagesFluxBlob((prev) => {
                        const next = [...prev];
                        next[index] = fluxImageBlob;
                        return next;
                    });

                    setGeneratedImagesFluxBlobHd((prev) => {
                        const next = [...prev];
                        next[index] = fluxImageBlobHd;
                        return next;
                    });

                    // Update the generated image for this particular step
                    setGeneratedImagesFlux((prev: any) => {
                        const next = [...prev];
                        next[index] = fluxImageUrl;
                        return next;
                    });

                    if (type === 0) {
                        setSteps((prev: any) => {
                            const next = [...prev];
                            next[index] = "Enter Text to Generate AI Voice";
                            return next;
                        });
                    }


                    if (index === 0) {
                        setContinue(true);
                    } else {
                        // Stop if we've generated as many images as we have steps
                        if (index === steps.length - 1) {
                            //    setDonex(true);
                        } else {
                            /// alert('nn');
                            // Grab the last generated blob in the array

                            var lastBlob: any = fluxImageBlob;

                            if (saveBlob) {
                                lastBlob = saveBlob;
                            }

                            fetchAndGenerateImage(
                                steps[index + 1], // next prompt
                                index + 1, // next index
                                '',/// lastBlob, // last blob as input
                                1 // image-to-image mode, for example
                            );
                        }
                    }
                }, 5000);

                /// setGeneratedImageFlux(fluxImageUrl);
            } catch (err) {
                finishLoader(index);

                // Stop if we've generated as many images as we have steps
                if (index === steps.length - 1) {
                    setDonex(true);
                } else {
                    /// alert('nn');
                    // Grab the last generated blob in the array

                    var lastBlob: any = imageUrlFromSdxl;

                    if (saveBlob) {
                        lastBlob = saveBlob;
                    }

                    fetchAndGenerateImage(
                        steps[index + 1], // next prompt
                        index + 1, // next index
                        lastBlob, // last blob as input
                        1 // image-to-image mode, for example
                    );
                }

                console.error("Error calling Flux Inference Endpoint:", err);
                setPollStatus("Failed!");
            }
        },
        [prompt, generatedImages, generatedImagesFlux, modelz, Planx]
    );



    const stripRef = useRef<HTMLDivElement | null>(null);

    /* clamp on every native scroll event */
    useEffect(() => {
        const node = stripRef.current;
        if (!node) return;

        const MIN = 10;
        const clamp = () => {
            const max = node.scrollWidth - node.clientWidth - MIN;
            if (node.scrollLeft < MIN) node.scrollLeft = MIN;
            else if (node.scrollLeft > max) node.scrollLeft = max;
        };

        /* start slightly away from 0 so history-swipe can’t kick in */
        node.scrollLeft = MIN;

        node.addEventListener("scroll", clamp, { passive: true });
        return () => node.removeEventListener("scroll", clamp);
    }, []);




    const handleSubmitFluxImageNewn = useCallback(
        async (
            imageUrlFromSdxl: any,
            enhancedPrompt: any,
            loggedUserx: any,
            index: any
        ) => {
            console.log("Endpoint");
            try {
                // Variable to hold the Base64-encoded image (if available)
                let base64Image = "";

                // Only fetch and convert the image if a non-empty URL is provided.
                if (imageUrlFromSdxl && imageUrlFromSdxl.trim() !== "") {
                    // Fetch the image blob from SDXL's image URL
                    const imageResponse = await fetch(imageUrlFromSdxl);
                    if (!imageResponse.ok) {
                        throw new Error(
                            `Failed to fetch image: ${imageResponse.statusText}`
                        );
                    }
                    const imageBlob = await imageResponse.blob();

                    // Convert the blob to a Base64-encoded string
                    base64Image = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(imageBlob);
                    });
                }

                // Construct the payload.
                // Conditionally add the "image" field only if base64Image is non-empty.
                const payload: any = {
                    inputs: enhancedPrompt,
                    parameters: {
                        width: 1080,
                        height: 1920,
                    },
                    prompt_strength: 0.1,
                };

                if (base64Image) {
                    console.log("Endpoint with image");
                    payload.image = base64Image;
                }

                const link =
                    "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions";

                // Make the API request
                const response = await fetch(link, {
                    headers: {
                        Accept: "image/png",
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${VITE_REPLI_KEY}`,
                    },
                    method: "POST",
                    body: JSON.stringify(payload),
                });

                // Handle response errors.
                if (!response.ok) {
                    await handleSubmitFluxImageApi("", enhancedPrompt, loggedUser, index);

                    ///  alert('jjj');

                    const errorData = await response.text();
                    throw new Error(`Flux API Error: ${response.status} - ${errorData}`);
                }

                const fluxImageBlobx = await response.blob();

                // Convert the blob to HD WebP
                const fluxImageBlob = await convertToHDWebpOrJpegByDevice(
                    fluxImageBlobx,
                    ""
                );

                if (index === 0) {
                    setsaveBlob(fluxImageBlob);
                }

                ///setGeneratedImageFluxBlob(fluxImageBlob);

                /// GenerateSignedUrl(fluxImageBlob, enhancedPrompt, loggedUserx);

                const fluxImageUrl = URL.createObjectURL(fluxImageBlob);

                setGeneratedImagesFluxBlob((prev) => {
                    const next = [...prev];
                    next[index] = fluxImageBlob;
                    return next;
                });

                // Update the generated image for this particular step
                setGeneratedImagesFlux((prev: any) => {
                    const next = [...prev];
                    next[index] = fluxImageUrl;
                    return next;
                });

                // Stop if we've generated as many images as we have steps
                if (index === steps.length - 1) {
                } else {
                    /// alert('nn');
                    // Grab the last generated blob in the array

                    var lastBlob: any = fluxImageBlob;

                    if (saveBlob) {
                        lastBlob = saveBlob;
                    }

                    fetchAndGenerateImage(
                        steps[index + 1], // next prompt
                        index + 1, // next index
                        lastBlob, // last blob as input
                        1 // image-to-image mode, for example
                    );
                }

                /// setGeneratedImageFlux(fluxImageUrl);
            } catch (err) {
                handleCloseOverlay();
                console.error("Error calling Flux Inference Endpoint:", err);
            }
        },
        [prompt]
    );

    const handleSubmitFluxImageApi = useCallback(
        async (
            imageUrlFromSdxl: any,
            enhancedPrompt: any,
            loggedUserx: any,
            index: any
        ) => {
            console.log("serverless");
            try {
                // Variable to hold the Base64-encoded image (if available)
                let base64Image = "";

                // Only fetch and convert the image if a non-empty URL is provided.
                if (imageUrlFromSdxl && imageUrlFromSdxl.trim() !== "") {
                    // Fetch the image blob from SDXL's image URL
                    const imageResponse = await fetch(imageUrlFromSdxl);
                    if (!imageResponse.ok) {
                        throw new Error(
                            `Failed to fetch image: ${imageResponse.statusText}`
                        );
                    }
                    const imageBlob = await imageResponse.blob();

                    // Convert the blob to a Base64-encoded string
                    base64Image = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(imageBlob);
                    });
                }

                // Construct the payload.
                // Conditionally add the "image" field only if base64Image is non-empty.
                const payload: any = {
                    inputs: enhancedPrompt,
                    parameters: {
                        width: 1080,
                        height: 1920,
                    },
                    prompt_strength: 0.1,
                };

                if (base64Image) {
                    payload.image = base64Image;
                }

                const link =
                    "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev";

                // Make the API request
                const response = await fetch(link, {
                    headers: {
                        Accept: "image/png",
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${VITE_HUGG}`,
                    },
                    method: "POST",
                    body: JSON.stringify(payload),
                });

                if (response.ok) {
                    // Handle success if needed
                } else {
                    /// handleSubmitFluxServerless();
                }

                if (!response.ok) {
                    const errorData = await response.text();
                    throw new Error(`Flux API Error: ${response.status} - ${errorData}`);
                }

                const fluxImageBlobx = await response.blob();

                // Convert the blob to HD WebP
                const fluxImageBlob = await convertToHDWebpOrJpegByDevice(
                    fluxImageBlobx,
                    ""
                );

                if (index === 0) {
                    setsaveBlob(fluxImageBlob);
                }

                ///setGeneratedImageFluxBlob(fluxImageBlob);

                /// GenerateSignedUrl(fluxImageBlob, enhancedPrompt, loggedUserx);

                const fluxImageUrl = URL.createObjectURL(fluxImageBlob);

                setGeneratedImagesFluxBlob((prev) => {
                    const next = [...prev];
                    next[index] = fluxImageBlob;
                    return next;
                });

                // Update the generated image for this particular step
                setGeneratedImagesFlux((prev: any) => {
                    const next = [...prev];
                    next[index] = fluxImageUrl;
                    return next;
                });

                // Stop if we've generated as many images as we have steps
                if (index === steps.length - 1) {
                } else {
                    /// alert('nn');
                    // Grab the last generated blob in the array

                    var lastBlob: any = fluxImageBlob;

                    if (saveBlob) {
                        lastBlob = saveBlob;
                    }

                    fetchAndGenerateImage(
                        steps[index + 1], // next prompt
                        index + 1, // next index
                        lastBlob, // last blob as input
                        1 // image-to-image mode, for example
                    );
                }

                /// setGeneratedImageFlux(fluxImageUrl);
            } catch (err) {
                Close();
                console.error("Error calling Flux Inference Endpoint:", err);
            }
        },
        [prompt]
    );

    const fetchAndGenerateImage = async (
        stepText: string,
        stepIndex: number,
        imageBlobx: any,
        typex: number
    ) => {
        try {
            // 1) Ask backend for the visual prompt
            const requestData = { text: stepText, prompt, Planx };
            const response = await axios.post<any>(
                `${CLIK_URL}/ImageDesignStory`,
                requestData,
                { withCredentials: true }
            );
            const datax = response.data;

            const visualPromptText = datax.visualPrompt;

            // 2) Use the visualPromptText to call Hugging Face SDXL
            //    with a delay based on stepIndex
            if (visualPromptText) {
                // Calculate the delay time
                const delayTime = 100; // in milliseconds

                // Wait for the specified delay
                await sleep(delayTime);

                console.log(visualPromptText);

                setGeneratedText((prev) => {
                    const next = [...prev];
                    next[stepIndex] = visualPromptText;
                    return next;
                });

                // Proceed with the API call after the delay

                if (modelz === "Flux Pro") {
                    if (GotIm) {
                        ///await handleSubmitFluxImageApi('', visualPromptText, loggedUser, stepIndex);
                        if (stepIndex === 0) {
                            await handleSubmitSdxlRepli(
                                GeneratedImage,
                                visualPromptText,
                                loggedUser,
                                stepIndex
                            );
                        } else {
                            ///  alert(generatedImagesFlux)
                            await handleSubmitFluxImageNew(
                                generatedImagesFlux[stepIndex - 1],
                                visualPromptText,
                                loggedUser,
                                stepIndex
                            );
                        }
                    } else {
                        await handleSubmitFluxImageNew(
                            "",
                            visualPromptText,
                            loggedUser,
                            stepIndex
                        );
                    }
                } else {
                    await handleSubmitFluxImageNew(
                        "",
                        visualPromptText,
                        loggedUser,
                        stepIndex
                    );
                }
            }
        } catch (error: any) {
            Close();
            if (error.response) {
                console.error("Server Error:", error.response.data);
            } else if (error.request) {
                console.error("No response received:", error.request);
            } else {
                console.error("Error:", error.message);
            }
        }
    };

    /**
     * Detects if the user agent is an iPhone.
     * (Very simple check; can be refined if needed.)
     */
    function isIphone(): boolean {
        return /iPhone/i.test(navigator.userAgent);
    }

    /**
     * Converts an input Blob (PNG/JPEG/etc.) into a resized image Blob at 1080×1920.
     * On iPhone, always use JPEG. On other devices, use WebP.
     *
     * @param inputBlob - The original image as a Blob
     * @returns A Promise resolving to the converted image as a Blob
     */
    async function convertToHDWebpOrJpegByDevice(
        inputBlob: Blob,
        modelx: any
    ): Promise<Blob> {
        return new Promise<Blob>((resolve, reject) => {
            // Step 1: Read the Blob into a Data URL
            const reader = new FileReader();
            reader.readAsDataURL(inputBlob);

            reader.onload = () => {
                const imageUrl = reader.result as string;
                const img = new Image();

                // Step 2: When the image loads, draw it onto a 1080×1920 canvas
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    if (modelx === "Gpt Image") {
                        canvas.width = 1024;
                        canvas.height = 1536;
                    } else {
                        canvas.width = 1080;
                        canvas.height = 1920;
                    }

                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        return reject(new Error("Unable to get 2D context from canvas."));
                    }

                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    // Decide the format based on iPhone detection
                    /// const format = isIphone() ? "image/png" : "image/png";

                    const format = isIphone() ? "image/jpeg" : "image/webp";
                    console.log(
                        "Detected iPhone?",
                        isIphone(),
                        "| Using format:",
                        format
                    );

                    // Step 3: Convert the canvas to a Blob
                    canvas.toBlob(
                        (outputBlob) => {
                            if (outputBlob) {
                                resolve(outputBlob);
                            } else {
                                reject(new Error("Canvas toBlob returned null."));
                            }
                        },
                        format,
                        0.8 // 80% quality
                    );
                };

                // Handle errors while loading the image
                img.onerror = (error) => {
                    reject(error);
                };

                // Begin loading the image
                img.src = imageUrl;
            };

            // Handle file-reading errors
            reader.onerror = (error) => {
                reject(error);
            };
        });
    }

    async function convertToHDWebpOrJpegByDeviceHd(
        inputBlob: Blob,
        modelx: any
    ): Promise<Blob> {
        return new Promise<Blob>((resolve, reject) => {
            // Step 1: Read the Blob into a Data URL
            const reader = new FileReader();
            reader.readAsDataURL(inputBlob);

            reader.onload = () => {
                const imageUrl = reader.result as string;
                const img = new Image();

                // Step 2: When the image loads, draw it onto a 1080×1920 canvas
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    if (modelx === "Gpt Image") {
                        canvas.width = 1024;
                        canvas.height = 1536;
                    } else {
                        canvas.width = 1080;
                        canvas.height = 1920;
                    }

                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        return reject(new Error("Unable to get 2D context from canvas."));
                    }

                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    // Decide the format based on iPhone detection

                    const format = isIphone() ? "image/png" : "image/png";

                    console.log(
                        "Detected iPhone?",
                        isIphone(),
                        "| Using format:",
                        format
                    );

                    // Step 3: Convert the canvas to a Blob
                    canvas.toBlob(
                        (outputBlob) => {
                            if (outputBlob) {
                                resolve(outputBlob);
                            } else {
                                reject(new Error("Canvas toBlob returned null."));
                            }
                        },
                        format,
                        0.8 // 80% quality
                    );
                };

                // Handle errors while loading the image
                img.onerror = (error) => {
                    reject(error);
                };

                // Begin loading the image
                img.src = imageUrl;
            };

            // Handle file-reading errors
            reader.onerror = (error) => {
                reject(error);
            };
        });
    }

    // Example usage:
    async function exampleUsage() {
        // Suppose you have a file input or some Blob
        const inputBlob = new Blob(); // Placeholder

        try {
            const convertedBlob = await convertToHDWebpOrJpegByDevice(inputBlob, "");
            console.log("Successfully converted image. Blob:", convertedBlob);
            // Do something with the converted Blob (e.g., upload, display, etc.)
        } catch (e) {
            console.error("Failed to convert image:", e);
        }
    }

    const handleSubmitFluxImage = useCallback(
        async (
            imageBlob: Blob,
            enhancedPrompt: any,
            loggedUserx: any,
            index: any
        ) => {
            ///alert('flux');

            try {
                const base64Image = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(imageBlob);
                });

                // Construct the payload
                const payload = {
                    /// inputs: prompt.trim(),
                    inputs: enhancedPrompt,
                    parameters: {
                        seed: 80, // Replace with your desired seed value
                        width: 1080,
                        height: 1920,
                    },
                    image: base64Image, // Assuming the API supports Base64 for the image
                    prompt_strength: 0.1, // Control the balance between text and image
                };

                var link =
                    "https://slll6h6mzbbr88gv.us-east-1.aws.endpoints.huggingface.cloud";

                // Make the API request
                const response = await fetch(link, {
                    headers: {
                        Accept: "image/png",
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${VITE_HUGG}`,
                    },
                    method: "POST",
                    body: JSON.stringify(payload),
                });

                if (response.ok) {
                    // Handle success if needed
                } else {
                    /// handleSubmitFluxServerless();
                }

                if (!response.ok) {
                    const errorData = await response.text();
                    throw new Error(`Flux API Error: ${response.status} - ${errorData}`);
                }

                const fluxImageBlobx = await response.blob();

                // Convert the blob to HD WebP
                const fluxImageBlob = await convertToHDWebpOrJpegByDevice(
                    fluxImageBlobx,
                    ""
                );

                if (index === 0) {
                    setsaveBlob(fluxImageBlob);
                }

                ///setGeneratedImageFluxBlob(fluxImageBlob);

                /// GenerateSignedUrl(fluxImageBlob, enhancedPrompt, loggedUserx);

                const fluxImageUrl = URL.createObjectURL(fluxImageBlob);

                setGeneratedImagesFluxBlob((prev) => {
                    const next = [...prev];
                    next[index] = fluxImageBlob;
                    return next;
                });

                // Update the generated image for this particular step
                setGeneratedImagesFlux((prev: any) => {
                    const next = [...prev];
                    next[index] = fluxImageUrl;
                    return next;
                });

                // Stop if we've generated as many images as we have steps
                if (index === steps.length - 1) {
                } else {
                    /// alert('nn');
                    // Grab the last generated blob in the array

                    var lastBlob: any = fluxImageBlob;

                    if (saveBlob) {
                        lastBlob = saveBlob;
                    }

                    fetchAndGenerateImage(
                        steps[index + 1], // next prompt
                        index + 1, // next index
                        lastBlob, // last blob as input
                        1 // image-to-image mode, for example
                    );
                }

                /// setGeneratedImageFlux(fluxImageUrl);
            } catch (err) {
                Close();
                /// handleCloseOverlay();

                console.error("Error calling Flux Inference Endpoint:", err);
            }
        },
        [prompt, generatedImagesFluxBlob, saveBlob, GeneratedImage, modelz]
    );

    /**
     *  Minimal SDXL call to huggingface using the "visualPromptText."
     *  Replaces the local image for this step once it's generated.
     */
    const handleSubmitSdxl = useCallback(
        async (enhancedText: string, index: number, loggedUserx: any) => {
            try {
                const response = await fetch(
                    "https://mjuutqlkaw0l3v21.us-east-1.aws.endpoints.huggingface.cloud",
                    {
                        method: "POST",
                        headers: {
                            Accept: "image/png",
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${VITE_HUGG}`,
                        },
                        body: JSON.stringify({
                            inputs: enhancedText,
                            parameters: {
                                height: 1024,
                                width: 1024,
                                /// seed: 80,
                                num_inference_steps: 35,
                                guidance_scale: 7.5,
                            },
                        }),
                    }
                );

                if (response.ok) {
                    const imageBlob = await response.blob();
                    const imageUrl = URL.createObjectURL(imageBlob);

                    // Update the generated image for this particular step
                    setGeneratedImages((prev) => {
                        const next = [...prev];
                        next[index] = imageUrl;
                        return next;
                    });

                    handleSubmitFluxImage(imageBlob, enhancedText, loggedUserx, index);
                } else {
                    console.error("Hugging Face Inference Endpoint Error");
                }
            } catch (err) {
                Close();
                console.error("Error calling Hugging Face Inference Endpoint:", err);
            }
        },
        []
    );

    /**
     * Whenever steps change (or on mount), fetch visual prompts + generate images.
     */
    const hasFetchedRef = useRef(false);

    // Customize padding for both buttons here.
    const buttonPadding = { px: 3, py: 1.5 };

    useEffect(() => {
        // If we already fetched, do nothing
        if (hasFetchedRef.current) return;
        if (!steps || steps.length === 0) return;

        hasFetchedRef.current = true;
        if (DummyMode) { } else {
            fetchAndGenerateImage(steps[0], 0, null, 0);
        }
    }, [steps, fetchAndGenerateImage,]);

    ///Done

    // Whenever `steps` changes, re-initialize generatedImages
    useEffect(() => {
        if (generatedImagesFluxBlob[0]) {
            /////hdimage  1 with 0
        } else {
        }
    }, [generatedImagesFluxBlob]);

    if (!steps || steps.length === 0) {
        return <div>No steps to display.</div>;
    }

    // Define the EnhanceText function
    const EnhanceCaptionx = useCallback(
        async (voice: any) => {
            setisLoading(true);
            setLoadData("Creating Summary..");

            var pp: any = prompt;

            /// setLoadingAudio(true);
            try {
                console.log(pp);
                // Prepare the request payload
                const requestData: any = { pp };

                // Make the POST request to the server
                const response = await axios.post<any>(
                    `${CLIK_URL}/summary`,
                    requestData,
                    { withCredentials: true }
                );

                // Extract data from the response
                const data = response.data;

                // 1. Log both:
                console.log("sum:", data.summary);

                console.log("title done:", data.title);

                // 2. Put the title into your caption state:
                setEnhanceCaption(data.summary);

                setEnhanceTitle(data.title);

                // 3. Kick off your TTS with the summary:
                /// setisLoading(false);

                handleGenerateAudio(data.summary, voice);
                ////Starts Generating Voice
                // callvoice(data.initialSteps);
            } catch (error: any) {
                setisLoading(false);
                // setLoadingAudio(false);

                // Handle different error scenarios
                if (error.response) {
                    // Server responded with a status other than 2xx
                    console.error("Server Error:", error.response.data);
                    //  setError(error.response.data.message || "Server Error");
                } else if (error.request) {
                    // Request was made but no response received
                    console.error("No response received:", error.request);
                    /// setError("Network Error: No response received from server.");
                } else {
                    // Other errors
                    console.error("Error:", error.message);
                    /// setError(error.message);
                }
            } finally {
                ///setIsLoading(false);
            }
        },
        [prompt, steps, music, VideoArrayCloud]
    );

    const handleGenerateAudio = useCallback(
        (captionx: any, voice: any) => {
            const storyT: any = [
                steps[0],
                steps[1],
                steps[2],
                steps[3],
                steps[4],
                steps[5],
                steps[6],
                steps[7],
            ].filter(Boolean);

            callvoice(captionx, storyT, voice);
        },
        [steps, music, VideoArrayCloud]
    );

    const sleepx = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

    /**
     * Example of calling Google Text-to-Speech instead of ElevenLabs.
     *
     * @param stepText - The text you want to synthesize
     * @param stepIndex - The index of the current step (to store in 'generatedAudios')
     * @param voiceName - The voice name (e.g., "en-US-Chirp-HD-F"), or whichever voice you prefer
     *
     * Note: you will need valid Google TTS credentials or an API key.
     *       (If you have an API Key, you can pass it as a query param:  ?key=YOUR_API_KEY)
     *       If you’re using an OAuth token, you’ll need an Authorization header with a Bearer token.
     */
    const fetchAndGenerateSpeech = useCallback(
        async (
            stepText: string,
            stepIndex: number,
            voiceName: string,
            voiceId: any
        ) => {
            setisLoading(true);
            setLoadData("Generating Audio..");

            try {
                // (Optional) delay between requests
                await sleepx(100);

                // Build the request payload for Google TTS
                const requestData = {
                    input: {
                        text: stepText,
                    },
                    voice: {
                        languageCode: "en-US",
                        name: voiceName,
                        // e.g. "en-US-Chirp-HD-F"
                        // or "en-US-Wavenet-D", etc.
                        /// en-US-Chirp3-HD-Fenrir
                    },
                    audioConfig: {
                        audioEncoding: "LINEAR16", // or "MP3", "OGG_OPUS", etc.
                        pitch: 0,
                        speakingRate: 1,
                        effectsProfileId: ["small-bluetooth-speaker-class-device"],
                    },
                };

                // Make the call to Google TTS
                // Replace <YOUR_GOOGLE_TTS_API_KEY_OR_TOKEN> with your key or a Bearer token
                const response: any = await axios.post(
                    `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${VITE_GOOGLE_TTS}`,
                    requestData,
                    {
                        headers: {
                            "Content-Type": "application/json",
                        },
                        // Google returns a JSON object containing base64 audio in 'audioContent'
                        // so no need for "responseType": "arraybuffer" in this case
                    }
                );

                // 1) Extract the base64 encoded audio
                const audioContent = response.data?.audioContent;
                if (!audioContent) {
                    throw new Error("No audioContent in response");
                }

                // 2) Convert the base64 string to a UInt8Array
                const audioBuffer = Uint8Array.from(atob(audioContent), (char) =>
                    char.charCodeAt(0)
                );

                // 3) Build a Blob from the binary data
                //    For LINEAR16, "audio/wav" is a common container.
                //    If you used "MP3" in audioConfig, set type to "audio/mpeg".
                const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });

                // 4) Convert the Blob into an object URL so we can play it in the browser
                const audioUrl = URL.createObjectURL(audioBlob);

                /// setisLoading(false);

                // 5) Update your 'generatedAudios' array in state
                setGeneratedAudios((prev: any) => {
                    const next = [...prev];
                    next[stepIndex] = audioUrl;
                    return next;
                });

                console.log("done with audio");
            } catch (error: any) {
                setisLoading(false);
                ///setLoadingAudio(false);
                console.error("TTS Error:", error.message || error);
            }
        },
        []
    );

    // 4) The function that generates audio first for the caption, then for each plot
    const callvoice = useCallback(
        async (caption: string, plots: string[], voiceId: string) => {
            // Optional: initialize state array to correct length
            // Index 0 for the caption, plus one for each plot
            setGeneratedAudios(Array(1 + plots.length).fill(""));

            // Generate audio for the caption (index = 0)
            await fetchAndGenerateSpeech(caption, 0, voiceId, "");

            // Generate audio for each plot (indices = 1..plots.length)
            for (let i = 0; i < plots.length; i++) {
                await fetchAndGenerateSpeech(plots[i], i + 1, voiceId, "");
            }
        },
        [fetchAndGenerateSpeech, music]
    );

    useEffect(() => {
        if (steps.length === 0) return;

        const postId = PostId;

        const storyT: any = [
            steps[0],
            steps[1],
            steps[2],
            steps[3],
            steps[4],
            steps[5],
            steps[6],
            steps[7],
        ].filter(Boolean);

        // limit = number of valid text entries + 1
        const limit = storyT.length + 1;

        // Make sure we have exactly `limit` audios
        // AND every audio element is non-empty (truthy)
        if (
            generatedAudios.length === limit &&
            generatedAudios.every((audioUrl: any) => Boolean(audioUrl))
        ) {
            // Fire off the upload
            uploadAllAudiosToS3(postId, EnhanceCaption);
        }
    }, [steps, PostId, generatedAudios, EnhanceCaption, ImagesHdCloud, type, VideoArrayCloud]);

    const GenerateSignedUrlForSingleAudio = async (audioBlob: Blob) => {
        if (!audioBlob) {
            throw new Error("No audio Blob to generate a signed URL.");
        }

        // Example request body
        const requestData = { values: { count: 1 } };

        // Post to your backend route that generates signed URLs for audio
        const response: any = await axios.post(
            `${CLIK_URL}/get_signed_url_audioStory`,
            requestData,
            { withCredentials: true }
        );

        // Assume the server returns something like: { holder: [ { urlAudio } ] }
        const holder = response.data.holder;
        if (!holder || !Array.isArray(holder) || holder.length !== 1) {
            throw new Error("Invalid response from signed URL endpoint.");
        }

        const signedUrls = holder[0];
        if (!signedUrls.urlAudio) {
            throw new Error("Missing signed URL for audio.");
        }

        // Return the object containing the audio URL
        return signedUrls; // e.g. { urlAudio: "https://..." }
    };

    const uploadAllAudiosToS3 = useCallback(
        async (postId: any, EnhanceCaption: any) => {
            setisLoading(true);
            setLoadData("Uploading Audio..");

            try {
                const s3AudioUrls: string[] = [];

                // Loop through each local audio URL in generatedAudios
                for (const audioUrl of generatedAudios) {
                    // 1) Convert the local URL to a Blob
                    const audioBlob = await fetch(audioUrl).then((r) => r.blob());

                    // 2) Get a pre-signed upload URL from your API
                    //    e.g., call GenerateSignedUrlForSingleAudio(audioBlob)
                    const { urlAudio } = await GenerateSignedUrlForSingleAudio(audioBlob);

                    // 3) Upload the Blob to S3 using that signed URL
                    await axios.put(urlAudio, audioBlob, {
                        headers: {
                            "Content-Type": audioBlob.type || "audio/mpeg",
                        },
                    });

                    // 4) The final S3 path is the URL without query params
                    const finalAudioUrl = urlAudio.split("?")[0];
                    s3AudioUrls.push(finalAudioUrl);
                }

                // Once done, log them (or store them in state, or send to DB)
                console.log("Uploaded all audio to S3:", s3AudioUrls);

                var Data = {
                    postId: postId,
                    captionSummary: EnhanceCaption,
                    captionAudio: s3AudioUrls[0] ? s3AudioUrls[0] : null,
                    x1: s3AudioUrls[1] ? s3AudioUrls[1] : null,
                    x2: s3AudioUrls[2] ? s3AudioUrls[2] : null,
                    x3: s3AudioUrls[3] ? s3AudioUrls[3] : null,
                    x4: s3AudioUrls[4] ? s3AudioUrls[4] : null,
                    x5: s3AudioUrls[5] ? s3AudioUrls[5] : null,
                    x6: s3AudioUrls[6] ? s3AudioUrls[6] : null,
                    x7: s3AudioUrls[7] ? s3AudioUrls[7] : null,
                    x8: s3AudioUrls[8] ? s3AudioUrls[8] : null,
                    typex: 1,
                };

                var Datax = {
                    captionSummary: EnhanceCaption,
                    captionAudio: s3AudioUrls[0] ? s3AudioUrls[0] : null,
                    xa1: s3AudioUrls[1] ? s3AudioUrls[1] : null,
                    xa2: s3AudioUrls[2] ? s3AudioUrls[2] : null,
                    xa3: s3AudioUrls[3] ? s3AudioUrls[3] : null,
                    xa4: s3AudioUrls[4] ? s3AudioUrls[4] : null,
                    xa5: s3AudioUrls[5] ? s3AudioUrls[5] : null,
                    xa6: s3AudioUrls[6] ? s3AudioUrls[6] : null,
                    xa7: s3AudioUrls[7] ? s3AudioUrls[7] : null,
                    xa8: s3AudioUrls[8] ? s3AudioUrls[8] : null,
                };

                ///ClikStory(verticalActiveIndex, 0, '');

                /// setisLoading(false);

                callCreateMp4(Datax, Data, s3AudioUrls);
            } catch (error) {
                setisLoading(false);
                console.error("Error uploading all audios to S3:", error);
            }
        },
        [steps, generatedAudios, ImagesHdCloud, type, VideoArrayCloud]
    );

    /**
     * Helper: Load metadata for a single audio URL and return duration (seconds).
     */
    const getAudioDuration = (url: any) => {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.crossOrigin = "anonymous"; // helps if your S3 or server sets CORS headers
            audio.preload = "metadata"; // ensure metadata is loaded
            audio.src = url;

            audio.addEventListener("loadedmetadata", () => {
                // audio.duration is in seconds
                resolve(audio.duration);
            });

            // Handle load errors (e.g., 404, CORS issues)
            audio.addEventListener("error", (err) => {
                reject(err);
            });
        });
    };


    const getVideoDuration = (url: any) => {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.crossOrigin = "anonymous"; // handle CORS if needed
            video.preload = "metadata";
            video.src = url;

            video.addEventListener("loadedmetadata", () => {
                resolve(video.duration); // duration in seconds
            });

            video.addEventListener("error", (err) => {
                reject(err);
            });
        });
    };


    /* ------------------------------------------------------------------ */
    /* Helper: poll backend until MediaConvert job finishes                */
    /* ------------------------------------------------------------------ */
    const pollJobUntilComplete = async (
        jobId: string,
        intervalMs = 5_000,          // 5-second polling cadence
        timeoutMs = 10 * 60_000     // 10-minute cap
    ) => {
        const start = Date.now();
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

        while (true) {
            const { data }: any = await axios.get(`${CLIK_URL}/job-status/${jobId}`);
            const status = data.status as string;

            if (status === "COMPLETE") return;          // ✅ ready!
            if (status === "ERROR") throw new Error("MediaConvert job failed");

            if (Date.now() - start > timeoutMs) {
                throw new Error("Timed-out waiting for MediaConvert");
            }
            await sleep(intervalMs);
        }
    };

    /* ------------------------------------------------------------------ */
    /* Your unchanged create-MP4 hook, plus the polling step               */
    /* ------------------------------------------------------------------ */
    const callCreateMp4 = useCallback(
        async (Datax: any, Data: any, s3AudioUrls: any) => {
            setisLoading(true);
            setLoadData("Creating Mp4..");
            console.log("cloud", ImagesHdCloud);

            /* ---------- 2) Gather all possible images (UNCHANGED) ---------- */
            const imagesForVideo2 = [
                Datax[0], Datax[1], Datax[2], Datax[3],
                Datax[4], Datax[5], Datax[6], Datax[7],
            ].filter(Boolean);

            const imagesForVideox = [
                ImagesHdCloud[0], ImagesHdCloud[1], ImagesHdCloud[2], ImagesHdCloud[3],
                ImagesHdCloud[4], ImagesHdCloud[5], ImagesHdCloud[6], ImagesHdCloud[7],
            ].filter(Boolean);

            var imagesForVideo = MemeMusic ? imagesForVideo2 : imagesForVideox;

            /* ---------- 3) Gather all possible audios (UNCHANGED) ---------- */
            var audioForVideo = [
                s3AudioUrls ? s3AudioUrls[1] : null,
                s3AudioUrls ? s3AudioUrls[2] : null,
                s3AudioUrls ? s3AudioUrls[3] : null,
                s3AudioUrls ? s3AudioUrls[4] : null,
                s3AudioUrls ? s3AudioUrls[5] : null,
                s3AudioUrls ? s3AudioUrls[6] : null,
                s3AudioUrls ? s3AudioUrls[7] : null,
                s3AudioUrls ? s3AudioUrls[8] : null,
            ].filter(Boolean);

            /* ---------- 4) Gather all possible ai videos (UNCHANGED) ------- */


            const clipsForVideo = [
                VideoArrayCloud[0], VideoArrayCloud[1], VideoArrayCloud[2], VideoArrayCloud[3],
                VideoArrayCloud[4], VideoArrayCloud[5], VideoArrayCloud[6], VideoArrayCloud[7],
            ].filter(Boolean);


            const audioUrl = music;

            try {
                const firstImageSize = firstImageDims
                    ? `${firstImageDims.width}x${firstImageDims.height}`
                    : "";

                /* 4) durations (UNCHANGED) */
                const audioDurations = await Promise.all(
                    audioForVideo.map((audioUrl) => getAudioDuration(audioUrl))
                );

                console.log("Audio Durations:", audioDurations);

                var usevid = 0;
                var x = "create-videoimg";

                if (clipsForVideo.length === imagesForVideo.length) {

                    usevid = 1;
                }

                console.log('vid length', clipsForVideo.length);
                console.log('img length', imagesForVideo.length);
                console.log('vid cloud length', VideoArrayCloud.length);

                if (usevid === 1) {


                    x = "create-video";

                    if (MemeMusic && type === 0) {

                        /// alert('using wrong music');

                        x = "create-memevid";
                    }
                }

                else {
                    x = "create-videoimg";

                    if (MemeMusic && type === 0) {

                        /// alert('using wrong music');

                        x = "create-memeimg";
                    }
                }



                /* 5) POST to backend (UNCHANGED) */
                const response: any = await axios.post(`${CLIK_URL}/${x}`, {
                    audioUrls: audioForVideo,
                    imageUrls: imagesForVideo,
                    videoUrls: usevid ? clipsForVideo : null,                // mp4type === 1 ? clipsForVideo : null,
                    audioDurations: MemeMusic && type === 0 ? 20 : audioDurations,
                    audioUrl: audioUrl,
                    outputResolution: firstImageSize,
                    outputBucket: "s3://clikbatebucket/videos/",
                });

                console.log("MediaConvert response:", response.data);

                const { jobId, videoUrl, videoLength } = response.data;   // backend reply alert


                if (MemeMusic && type === 0) {



                    // 7) Now `outputVideo` is your final MP4 with music mixed in
                    console.log("Final MP4 with music no voice:", videoUrl);
                    setLoadData("Done! Your Music video is ready.");
                    setisLoading(false);

                    // 8) Save to database or update your UI
                    Data.videourl = videoUrl;
                    saveToDatabase(Data);
                    setGeneratedAudios([]);







                } else {

                    /* ---------- NEW: wait until job is COMPLETE ---------- */
                    setLoadData("Rendering video…");             // optional UI message
                    await pollJobUntilComplete(jobId);            // ⏳ blocks here
                    console.log("MediaConvert job completed:", jobId);
                    /// alert(videoLength);
                    /* ---------- Continue exactly as before --------------- */

                    ///   const videoLengthx = await getVideoDuration(videoUrl);
                    ///  console.log(`Video Length calculated: ${videoLengthx} seconds`);
                    console.log(`Video Length: ${videoLength} seconds`);

                    setTimeout(async () => {

                        const addBgResponse: any = await axios.post(
                            `${CLIK_URL}/addbackgroundmusic`,
                            {
                                videoUrlx: videoUrl, // the MP4 we just created
                                audioUrlx: audioUrl, // the same MP3 (or any other MP3 you want)
                                videoLength: videoLength, // must match the MP4’s length in seconds


                                audioLength: 219,
                            }
                        );
                        console.log("Second MediaConvert (add background) response:", addBgResponse.data);

                        const { jobId: bgJobId, outputVideo } = addBgResponse.data;
                        // outputVideo will look like: https://clikbatebucket.s3.amazonaws.com/videos-with-music/whatever_with_music.mp4


                        // 7) Now `outputVideo` is your final MP4 with music mixed in
                        console.log("Final MP4 with background music:", outputVideo);
                        setLoadData("Done! Your video is ready.");
                        setisLoading(false);
                        // 8) Save to database or update your UI
                        Data.videourl = outputVideo;
                        saveToDatabase(Data);
                        setGeneratedAudios([]);



                        // 6) Poll until the “addbackgroundmusic” job completes
                        ////   await pollJobUntilComplete(bgJobId);
                        //console.log("✅ Background‐music job completed:", bgJobId);







                    }, 500)


                }




            } catch (error: any) {
                if (error.response) {
                    console.error("Status:", error.response.status);
                    console.error("Response body:", error.response.data);
                } else {
                    console.error(error);
                }
                ///   alert(error.message || "Error making MP4");
            } finally {

            }
        },
        [ImagesHdCloud, firstImageDims, type, MemeMusic, music, VideoArrayCloud]
    );





    const ContinueUpload = useCallback(() => {

        if (MemeMusic) {
            ///////THIS CODE TYPE 1000000000 REDUNDANT LEFT IT HERE SO YOU UNDERSTAND DATA STRUCTURE
            var Data = {
                postId: PostId,
                captionSummary: "cool",
                captionAudio: "",
                x1: "",
                x2: "",
                x3: "",
                x4: "",
                x5: "",
                x6: "",
                x7: "",
                x8: "",
                typex: 0,
            };







            callCreateMp4(ImagesHdCloud, Data, null);
        } else {
            EnhanceCaptionx(voice);
        }

    }, [PostId, MemeMusic, EnhanceCaptionx, callCreateMp4, voice, ImagesHdCloud, VideoArrayCloud])


    const closeT = () => {
        setTimeout(() => {
            setcallFeeds(true);
        }, 500);

        setTimeout(() => {
            Close();
        }, 1000);

        setTimeout(() => {
            // Save the current scroll position and last ID from your feed container
            const feedScrollPos = 0;
            const feedLastId = 0;

            // Prepare state to persist the feed's scroll position and last ID
            const routeState = {
                userId: loggedUser?.id,
            };

            console.log(
                `Navigating from ${location.pathname} with ScrollPos: ${feedScrollPos} and PageNum: ${feedLastId}  to profile `
            );

            navigate(`/pages`, {
                state: routeState,
            });

            /// Close();
        }, 500);
    };

    const saveToDatabase = useCallback((Data: any) => {
        setisLoading(true);
        setLoadData("Saving..");

        console.log(Data);
        axios
            .put(`${CLIK_URL}/UpdatePostAudioMp4`, {
                values: Data,
            })
            .then((response) => {
                if (response) {
                    setisLoading(false);

                    setdbLoad(false);

                    setThumbGo(true);

                    ///closeT();

                    //alert('Load Thumbnail');
                }
            })
            .catch((error) => {
                setisLoading(false);

                console.log(error);
            });
    }, []);

    return (
        <>
            {isLoading ? (
                <div
                    style={{
                        position: "fixed",
                        top: "0vh",
                        zIndex: 9999,

                        width: matchMobile ? "100%" : "100%",
                        left: matchMobile ? "0px" : "-0vw",
                        height: "100vh",
                        textAlign: "center",
                        color: "#ffffff",
                        backgroundColor: "rgb(0,0,0,0.45)",
                        /// display: 'none'
                    }}
                >
                    {" "}
                    <div
                        style={{
                            marginTop: "30vh",
                        }}
                    >
                        {" "}
                        {LoadData}{" "}
                    </div>{" "}
                </div>
            ) : null}

            <div
                ref={stripRef}
                style={{
                    display: "flex",
                    overflowX: "auto",
                    gap: "1rem",
                    width: "100%",
                    padding: "1rem",
                    overscrollBehaviorX: "contain" /* <-- extra guard */,
                }}
            >
                {steps.map((step: any, index: any) => {
                    // Fallback image if generation not completed
                    const fallbackImage = loggedUser
                        ? `${loggedUser.image}`
                        : "https://via.placeholder.com/400x250.png?text=No+User+Image";

                    return (
                        <div
                            key={index}
                            style={{
                                flex: "0 0 auto", // ensure each item doesn’t shrink
                                /// width: matchMobile ? '20%' : "10%", // fixed width for each “card”
                                width: Donex
                                    ? matchMobile
                                        ? "62%"
                                        : isMenuOpen
                                            ? "23%"
                                            : "17%"
                                    : matchMobile
                                        ? "30%"
                                        : "12%",
                                height: "auto",
                                position: "relative",
                                borderRadius: "4px",
                                overflow: "hidden",
                            }}
                        >
                            {generatedImagesFlux[index] ? (



                                narrate === 2 && VideoArray[index] ?
                                    <video
                                        src={VideoArray[index]}
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                            cursor: "pointer",
                                        }}
                                        autoPlay
                                        playsInline   // especially needed on iOS to allow inline autoplay VideoArrayCloud
                                        muted         // browsers only allow autoplay if muted
                                        loop
                                        controls
                                        onClick={() => {
                                            if (Donex) {
                                                setstartEdit(true);
                                                setactiveEdit(index);
                                            }
                                        }}
                                    />
                                    :
                                    <img
                                        ref={index === 0 ? firstImageRef : null}
                                        onClick={() => {


                                            if (Donex) {
                                                if (type === 0 && steps.length === 1) {

                                                } else {

                                                    setstartEdit(true);
                                                    setactiveEdit(index);
                                                }


                                            }

                                        }}
                                        src={generatedImagesFlux[index] || fallbackImage}
                                        alt={`Step ${index + 1}`}
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                            cursor: "pointer",
                                        }}
                                    />


                            ) : (
                                <img
                                    onClick={() => {


                                        if (Continue) {

                                            ContinueGen();

                                        } else {
                                            if (Donex) {

                                                if (type === 0 && steps.length === 1) {

                                                } else {

                                                    setstartEdit(true);
                                                    setactiveEdit(index);
                                                }


                                            }
                                        }
                                    }}
                                    src={generatedImages[index] || fallbackImage}
                                    alt={`Step ${index + 1}`}
                                    style={{
                                        width: "100%", height: "100%", objectFit: "cover",
                                        cursor: "pointer",
                                    }}
                                />
                            )}

                            {!generatedImagesFlux[index] && (
                                <Box
                                    sx={{
                                        position: "absolute",
                                        top: "47%",
                                        left: 0,
                                        width: "100%",
                                        height: 0,
                                        display: Continue ? 'none' : "flex",
                                        flexDirection: "column", // spinner ⬆ text ⬇
                                        alignItems: "center",
                                        justifyContent: "center",
                                        zIndex: 300,
                                    }}
                                >
                                    {/* wrapper lets us stack “track” + progress */}
                                    <Box sx={{ position: "relative" }}>
                                        {/* dark track (always 100 %) */}
                                        <CircularProgress
                                            variant="determinate"
                                            value={100}
                                            size={matchMobile ? 50 : 80}
                                            thickness={4}
                                            sx={{
                                                color: "rgba(0,0,0,0.4)", // dark grey ring underneath
                                            }}
                                        />

                                        {/* yellow progress arc on top */}
                                        <CircularProgress
                                            variant="determinate"
                                            value={loaders[index]}
                                            size={matchMobile ? 50 : 80}
                                            thickness={4}
                                            sx={{
                                                position: "absolute",
                                                left: 0,
                                                top: 0,
                                                color: "#F6BB56", // your yellow
                                                filter: "drop-shadow(0 0 4px rgba(0,0,0,.8))", // halo
                                            }}
                                        />
                                    </Box>

                                    {/* percentage label */}
                                    <Typography
                                        sx={{
                                            mt: 1,
                                            fontSize: 18,
                                            fontWeight: 600,
                                            color: "#fff",
                                            textShadow: "0 1px 3px rgba(0,0,0,.85)",
                                            fontFamily: "sans-serif",
                                        }}
                                    >
                                        {loaders[index]}%
                                    </Typography>
                                </Box>
                            )}

                            {!generatedImages[index] && (
                                <Box
                                    sx={{
                                        position: "absolute",
                                        top: "40%",
                                        left: "0px",
                                        width: "100%",
                                        height: "0px",
                                        /// backgroundColor: "rgba(255, 255, 255, 0.6)", // Semi-transparent background
                                        display: "none",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        zIndex: 300, // Above overlay and images
                                        borderRadius: 2,
                                    }}
                                >
                                    <CircularProgress sx={{
                                        color: "#F6BB56", // your yellow
                                        filter: "drop-shadow(0 0 4px rgba(0,0,0,.8))", // halo
                                    }} />
                                </Box>
                            )}

                            {dbLoad && (
                                <Box
                                    sx={{
                                        position: "absolute",
                                        top: "40%",
                                        left: "0px",
                                        width: "100%",
                                        height: "0px",
                                        /// backgroundColor: "rgba(255, 255, 255, 0.6)", // Semi-transparent background
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        zIndex: 300, // Above overlay and images
                                        borderRadius: 2,
                                    }}
                                >
                                    <CircularProgress
                                        sx={{
                                            color: "#F6BB56", // your yellow
                                            filter: "drop-shadow(0 0 4px rgba(0,0,0,.8))", // halo
                                        }}
                                    />
                                </Box>
                            )}

                            {
                                Donex && (
                                    <Box
                                        onClick={() => {
                                            setstartEdit(true);
                                            setactiveEdit(index);
                                        }}
                                        sx={{
                                            cursor: "pointer",
                                            position: "absolute",
                                            top: "12%",
                                            left: "0px",
                                            width: "100%",
                                            height: "0px",
                                            backgroundColor: "rgba(255, 255, 255, 0.6)", // Semi-transparent background
                                            display: Continue && index !== 0 ? 'none' : "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            zIndex: 3, // Above overlay and images
                                            borderRadius: 2,
                                            fontSize: "3vh",
                                            fontWeight: "bold",
                                            color: "#ffffff", // Text color
                                            textShadow: "2px 2px 4px rgba(0, 0, 0, 0.6)", // Text shadow for visibility
                                        }}
                                    >
                                        <EditIcon sx={{ mr: 1, fontSize: "inherit" }} />
                                        Edit
                                    </Box>
                                )}

                            {Continue && (
                                <Box
                                    onClick={() => {
                                        ContinueGen();
                                    }}
                                    sx={{
                                        cursor: "pointer",
                                        position: "absolute",
                                        top: "35%",
                                        left: "0px",
                                        width: "100%",
                                        height: "0px",
                                        backgroundColor: "rgba(255, 255, 255, 0.6)", // Semi-transparent background
                                        display: index === 0 ? 'none' : "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        zIndex: 3, // Above overlay and images
                                        borderRadius: 2,
                                        fontSize: "3vh",
                                        fontWeight: "bold",
                                        color: "#ffffff", // Text color
                                        textShadow: "2px 2px 4px rgba(0, 0, 0, 0.6)", // Text shadow for visibility
                                    }}
                                >

                                    <ArrowRightIcon sx={{ mr: 1, fontSize: "inherit" }} />
                                    Click to Create All
                                </Box>
                            )}

                            {generatedImagesFlux[index] || type === 1 ? null :
                                <Box
                                    onClick={() => {
                                        removeFromStep(index);

                                    }}
                                    sx={{
                                        cursor: "pointer",
                                        position: "absolute",
                                        top: "82%",
                                        left: "0px",
                                        width: "100%",
                                        height: "0px",
                                        backgroundColor: "rgba(255, 255, 255, 0.6)", // Semi-transparent background
                                        display: "flex",
                                        alignItems: "right",
                                        justifyContent: "right",
                                        zIndex: 3, // Above overlay and images
                                        borderRadius: 2,
                                        fontSize: "5vh",
                                        fontWeight: "bold",
                                        color: "#ffffff", // Text color
                                        textShadow: "2px 2px 4px rgba(0, 0, 0, 0.6)", // Text shadow for visibility
                                    }}
                                >
                                    <DeleteForeverIcon sx={{ mr: 1, fontSize: "inherit" }} />

                                </Box>
                            }

                            <Box
                                onClick={() => {
                                    if (type === 0 && steps.length > 1) {


                                        if (VideMode) {
                                            setstartEdit(true);
                                            setactiveEdit(index);
                                            setnarrate(2);

                                        } else {
                                            setstartEdit(true);
                                            setactiveEdit(index);
                                            setnarrate(1);
                                        }
                                    }
                                }}
                                sx={{
                                    fontSize: matchMobile ? "1.18rem" : "1.35rem",
                                    position: "absolute",
                                    bottom: "10px",
                                    left: "10px",
                                    backgroundColor: "rgba(0,0,0,0.5)",
                                    color: "#fff",
                                    borderRadius: "4px",
                                    cursor: type === 0 ? "pointer" : "default",
                                    padding: type === 0 ? "1.5rem" : "0.5rem",
                                    maxWidth: "90%",
                                    overflow: "auto",
                                    maxHeight: "30%",
                                    visibility:
                                        steps.length === 1 && type === 0 ? "hidden" : "visible",
                                    display: Donex ? "flex" : "none",
                                    "&::-webkit-scrollbar": {
                                        width: "8px",
                                    },
                                    "&::-webkit-scrollbar-track": {
                                        background: "#f1f1f1",
                                    },
                                    "&::-webkit-scrollbar-thumb": {
                                        background: "#888",
                                        borderRadius: "4px",
                                    },
                                    "&::-webkit-scrollbar-thumb:hover": {
                                        background: "#555",
                                    },
                                }}
                            >
                                {VideMode ? 'Generate video Here' : step}
                            </Box>
                        </div>
                    );
                })}
            </div>

            <Box
                sx={{
                    // display: showButton && !minimisePrompt ? 'flex' : 'none',
                    width: "100%",
                    gap: 1, // Adds spacing between the two buttons
                    alignItems: "center",
                    px: 1, // Optional: padding on the container so buttons don't touch the screen edges
                    paddingBottom: "1vh",
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        width: "100%",
                        marginTop: "3px",
                        gap: "8px", // space between the two buttons
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            width: "100%",
                            marginTop: "3px",
                            gap: "8px", // space between the two buttons
                        }}
                    >
                        <Button
                            onClick={() => {


                                if (VideMode) {


                                    if (HaltPublish) {

                                        /// alert('publish 1');////use images(button) shows just go use pics

                                        ContinueUpload();
                                    } else {
                                        if (allVideosReady) {

                                            /// alert('publish 2');////all video defined use videos
                                            ContinueUpload();

                                        } else {
                                            if (anyVideoReady) {

                                                setHaltPublish(true);/// at least one video is generated so stop user and ask for all

                                            } else {

                                                /// alert('publish 3');/// Zero videos generated
                                                ContinueUpload();
                                            }

                                        }

                                    }

                                }

                                else {
                                    if (type === 0) {
                                        if (generatedImagesFlux.length > 1) {
                                            if (MemeMusic) {
                                                /// alert("use muisc");


                                                uploadAllImagesToS3();
                                                setHideSave(true);

                                            } else {
                                                // alert("use voice");


                                                /*   */
                                                setGeneratedAudios([]);
                                                uploadAllImagesToS3();
                                                setHideSave(true);

                                            }
                                        } else {
                                            GenerateSignedUrl(
                                                generatedImagesFluxBlob[0],
                                                steps[0],
                                                loggedUser
                                            );

                                            setThumbGo(true);

                                            /// alert('1')  https://clikbatebucket.s3.us-east-1.amazonaws.com/cartoon-intro-13087.mp3
                                        }
                                    } else {
                                        setGeneratedAudios([]);
                                        uploadAllImagesToS3();
                                        setHideSave(true);
                                    }
                                }
                            }
                            }
                            variant="contained"
                            color="inherit"
                            disableRipple
                            disableFocusRipple
                            sx={{
                                /* layout (unchanged) */
                                flex: 1,
                                mt: "3px",

                                /* glass skin */
                                background: darkMode
                                    ? "rgba(25,25,25,0.25)"
                                    : "rgba(255,255,255,0.25)",
                                color: HaltPublish
                                    ? "red"
                                    : VideMode
                                        ? "green"
                                        : darkMode
                                            ? "#F6BB56"
                                            : "#000000",
                                ...buttonPadding,

                                border: "none",
                                borderRadius: 12,
                                boxShadow: darkMode
                                    ? "0 12px 32px rgba(0,0,0,0.8)"
                                    : "0 12px 32px rgba(130,130,130,0.8)",
                                transform: "translateY(-2px)",

                                transition:
                                    "background 250ms ease, box-shadow 250ms ease, transform 120ms ease",

                                display: Done ? (HideSave ? "none" : "block") : "none",

                                /* ── sweep overlay (hidden until hover/press) ── */
                                position: "relative",
                                overflow: "hidden",
                                "&::before": {
                                    content: '""',
                                    position: "absolute",
                                    top: "-40%",
                                    left: 0,
                                    width: "60%",
                                    height: "180%",
                                    background:
                                        "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)",
                                    backgroundSize: "200% 200%",
                                    transform: "translateX(-150%) rotate(20deg)",
                                    opacity: 0,
                                    pointerEvents: "none",
                                },

                                /* hover */
                                "&:hover": {
                                    outline: "none",
                                    background: darkMode
                                        ? "rgba(25,25,25,0.35)"
                                        : "rgba(255,255,255,0.35)",
                                    boxShadow: darkMode
                                        ? "0 12px 32px rgba(0,0,0,0.8)"
                                        : "0 12px 32px rgba(0,0,0,0.3)",
                                    transform: "translateY(0)",
                                    border: "2px solid #F6BB56",
                                    color: HaltPublish
                                        ? "red"
                                        : VideMode
                                            ? "green"
                                            : darkMode
                                                ? "#F6BB56"
                                                : "#DA8E0B",
                                    "&::before": {
                                        opacity: 0.8,
                                        animation: `${glassSweep} 1.8s ease-out forwards`,
                                    },
                                },

                                /* active */
                                "&:active": {
                                    background: darkMode
                                        ? "rgba(25,25,25,0.45)"
                                        : "rgba(255,255,255,0.45)",
                                    boxShadow: darkMode
                                        ? "0 12px 32px rgba(0,0,0,0.8)"
                                        : "0 12px 32px rgba(0,0,0,0.3)",
                                    transform: "translateY(0)",
                                    border: "2px solid #F6BB56",
                                    color: HaltPublish
                                        ? "red"
                                        : VideMode
                                            ? "green"
                                            : darkMode
                                                ? "#F6BB56"
                                                : "#DA8E0B",
                                    "&::before": {
                                        opacity: 0.8,
                                        animation: `${glassSweep} 1.2s ease-out forwards`,
                                    },
                                },

                                /* focus tidy */
                                "&:focus, &:focus-visible, &.Mui-focusVisible": {
                                    outline: "none",
                                    boxShadow: "none",
                                    backgroundColor: "rgba(255,255,255,0.10)",
                                },
                                WebkitTapHighlightColor: "transparent",
                                "::-moz-focus-inner": { border: 0 },
                            }}
                        >
                            {HaltPublish ? "Use Images" : VideMode ? "Publish" : "Save"}
                        </Button>

                        <Button
                            onClick={() => {
                                if (VideMode) return;
                                if (!(steps.length === 1 && type === 0)) setShowVoices(true);
                            }}
                            variant="contained"
                            color="inherit"
                            disableRipple
                            disableFocusRipple
                            sx={{
                                flex: 0.6,
                                opacity: steps.length === 1 && type === 0 ? 0.3 : 1,

                                background: darkMode
                                    ? "rgba(25,25,25,0.25)"
                                    : "rgba(255,255,255,0.25)",
                                color: darkMode ? "#F6BB56" : "#000000",
                                ...buttonPadding,

                                border: "2px solid #F6BB56",
                                borderRadius: 12,
                                boxShadow: darkMode
                                    ? "0 12px 32px rgba(0,0,0,0.8)"
                                    : "0 12px 32px rgba(130,130,130,0.8)",
                                transform: "translateY(-2px)",

                                transition:
                                    "background .25s ease, box-shadow .25s ease, transform .12s ease",

                                display: Done ? (HideSave ? "none" : "block") : "none",

                                /* ── glass sweep overlay (new) ── */
                                position: "relative",
                                overflow: "hidden",
                                "&::before": {
                                    content: '""',
                                    position: "absolute",
                                    top: "-40%",
                                    left: 0,
                                    width: "60%",
                                    height: "180%",
                                    background:
                                        "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)",
                                    backgroundSize: "200% 200%",
                                    transform: "translateX(-150%) rotate(20deg)",
                                    opacity: 0,
                                    pointerEvents: "none",
                                },

                                "&:focus, &:focus-visible, &.Mui-focusVisible": {
                                    outline: "none",
                                    boxShadow: "none",
                                    backgroundColor: "rgba(255,255,255,0.10)",
                                },

                                "&:hover": {
                                    outline: "none",
                                    background: darkMode
                                        ? "rgba(25,25,25,0.35)"
                                        : "rgba(255,255,255,0.35)",
                                    boxShadow: darkMode
                                        ? "0 12px 32px rgba(0,0,0,0.8)"
                                        : "0 12px 32px rgba(0,0,0,0.3)",
                                    transform: "translateY(0)",
                                    border: "2px solid #F6BB56",
                                    "&::before": {
                                        opacity: 0.8,
                                        animation: `${glassSweep} 1.8s ease-out forwards`,
                                    },
                                },

                                "&:active": {
                                    background: darkMode
                                        ? "rgba(25,25,25,0.45)"
                                        : "rgba(255,255,255,0.45)",
                                    boxShadow: "0 4px 16px rgba(0,0,0,.30)",
                                    transform: "translateY(0)",
                                    border: "2px solid #F6BB56",
                                    "&::before": {
                                        opacity: 0.8,
                                        animation: `${glassSweep} 1.2s ease-out forwards`,
                                    },
                                },

                                WebkitTapHighlightColor: "rgba(25,25,25,0.5)",
                                "::-moz-focus-inner": { border: 0 },
                            }}
                        >
                            {/* icon + text row (unchanged) */}
                            <Stack direction="row" alignItems="center" spacing={1}>
                                {MemeMusic ? (
                                    <>
                                        {VideMode ? (
                                            HaltPublish ? (
                                                <ReportOffIcon fontSize="small" sx={{ color: "red", transform: "scale(1.6)" }} />
                                            ) : (
                                                <SaveIcon fontSize="small" />
                                            )
                                        ) : (
                                            <MusicNoteIcon fontSize="small" sx={{ color: darkMode ? "#F6BB56" : "#ffffff", p: 0 }} />
                                        )}
                                        <Typography variant="button">
                                            {VideMode
                                                ? HaltPublish
                                                    ? "need All Videos"
                                                    : "Saved"
                                                : musicname}
                                        </Typography>
                                    </>
                                ) : (
                                    <>
                                        {VideMode ? (
                                            HaltPublish ? (
                                                <ReportOffIcon fontSize="small" sx={{ color: "red", transform: "scale(1.6)" }} />
                                            ) : (
                                                <SaveIcon fontSize="small" />
                                            )
                                        ) : (
                                            <VolumeUpIcon fontSize="small" />
                                        )}
                                        <Typography variant="button">
                                            {VideMode
                                                ? HaltPublish
                                                    ? "need All Videos"
                                                    : "Saved"
                                                : Name}
                                        </Typography>
                                    </>
                                )}
                            </Stack>
                        </Button>

                    </Box>

                    {MemeMusic ?

                        <AudioPicker
                            type={type}
                            music={music}
                            setmusicname={setmusicname}
                            setmusic={setmusic}
                            MemeMusic={MemeMusic}
                            setMemeMusic={() => {

                            }}
                            setName={setName}
                            showVoicesList={showVoices}
                            selectedVoice={voice}
                            onClose={() => setShowVoices(false)}
                            onSelectVoice={(id) => {
                                setVoice(id);
                                setShowVoices(false);
                            }}
                        /> :
                        <VoicePicker
                            type={type}
                            setMemeMusic={() => {

                            }}
                            setName={setName}
                            showVoicesList={showVoices}
                            selectedVoice={voice}
                            onClose={() => setShowVoices(false)}
                            onSelectVoice={(id) => {
                                setVoice(id);
                                setShowVoices(false);
                            }}
                        />}
                </Box>



                <EditStory
                    setVideoArrayCloud={setVideoArrayCloud}
                    PostId={PostId}
                    ImagesHdCloud={ImagesHdCloud}
                    VideMode={VideMode}
                    setVideoArray={setVideoArray}
                    setVideoArrayBlob={setVideoArrayBlob}
                    VideoArrayBlob={VideoArrayBlob}
                    VideoArray={VideoArray}
                    TextVideo={TextVideo}
                    setTextVideo={setTextVideo}
                    setmusic={setmusic}
                    Seed={Seed}
                    setMemeMusic={setMemeMusic}
                    setIndex={setactiveEdit}
                    modelz={modelz}
                    convertToHDWebpOrJpegByDeviceHd={convertToHDWebpOrJpegByDeviceHd}
                    steps={steps}
                    setSteps={setSteps}
                    narrate={narrate}
                    setnarrate={setnarrate}
                    setGeneratedText={setGeneratedText}
                    type={0}
                    GotIm={GotIm}
                    /* Array-based props */
                    setGeneratedImagesFlux={setGeneratedImagesFlux}
                    setGeneratedImagesFluxBlob={setGeneratedImagesFluxBlob}
                    generatedImagesFlux={generatedImagesFlux}
                    GeneratedImage={generatedImages[activeEdit]}
                    GeneratedText={GeneratedText}
                    /* Single-based props become null or undefined */
                    setFluxIm={null}
                    setFluxImBlob={null}
                    FluxIm={null}
                    Im={null}
                    prompt={null}
                    /* Common props */
                    convertToHDWebpOrJpegByDevice={convertToHDWebpOrJpegByDevice}
                    setbase={setbase}
                    base={base}
                    index={activeEdit}
                    startEdit={startEdit}
                    setGeneratedImagesFluxBlobHd={setGeneratedImagesFluxBlobHd}
                    setstartEdit={setstartEdit}
                    fallbackImage={loggedUser
                        ? `${loggedUser.image}` : ''}
                    defaultText=""
                />

                {/* CLOSE ICON */}
                <IconButton
                    onClick={() => {
                        Close();
                        setflip(false);
                    }}
                    sx={{
                        display: generatedImagesFlux ? "none" : "none",
                        position: "fixed",
                        top: matchMobile ? "7vh" : "12vh",
                        right: "0",
                        color: darkModeReducer ? "#ffffff" : "#000000", // Always white
                        zIndex: 300,
                        filter: darkModeReducer
                            ? "drop-shadow(2px 2px 4px rgba(0,0,0,0.7))"
                            : "drop-shadow(2px 2px 4px rgba(230,230,230,0.7))",
                    }}
                >
                    <CloseIcon style={{ fontSize: "2rem", opacity: 0.3 }} />
                </IconButton>
            </Box>

            {ThumbGo ? (
                <div
                    style={{
                        position: "fixed",
                        top: "0vh",
                        zIndex: 9999,
                        width: matchMobile ? "100%" : "100%",
                        height: "100vh",
                        margin: "auto",
                        /// display: 'none'
                        ///  backgroundColor: 'red',
                    }}
                >
                    <Thumbnail
                        type={type}
                        closeT={closeT}
                        isMenuOpen={isMenuOpen}
                        image={generatedImagesFluxBlob[0]}
                        PostId={PostId}
                        title={EnhanceTitle}
                    />
                </div>
            ) : null}
        </>
    );
};

export default Storybook;
