import React, { useEffect, useState, useRef, useCallback } from "react";
import { Box, IconButton, TextField, Typography, Button, CircularProgress } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ImageIcon from "@mui/icons-material/Image";

import { RootState } from "./store";

import { useSelector, useDispatch } from "react-redux";

import { matchMobile } from "./DetectDevice";
import axios from "axios";
import FilePicker from './FilePicker';
import { setShowmenuToggle } from "./settingsSlice";
///import { setTimeout } from "timers/promises";


interface EditStoryProps {
    /** 0 = array mode, 1 = single mode */
    type?: number;

    // ----------- For type=0 (Arrays) -----------
    generatedImagesFlux?: string[] | any;
    setGeneratedImagesFlux?: React.Dispatch<React.SetStateAction<string[]>> | any;
    setGeneratedImagesFluxBlob?: React.Dispatch<React.SetStateAction<Blob[]>> | any;
    GeneratedImage?: string | any;
    GeneratedText?: string[] | any;

    // ----------- For type=1 (Single) -----------
    FluxIm?: string | any;
    setFluxIm?: React.Dispatch<React.SetStateAction<string>> | any;
    setFluxImBlob?: React.Dispatch<React.SetStateAction<Blob>> | any;
    Im?: string | any;              // Usually the "GeneratedImage" for single mode
    prompt?: string | any;          // Usually the "GeneratedText" for single mode

    // ----------- Common Props -----------
    base: string[]; // can still be used for both, just treat index=0 in single mode
    setbase: React.Dispatch<React.SetStateAction<string[]>> | any;
    convertToHDWebpOrJpegByDevice: (blob: Blob, modelz: any) => Promise<Blob> | any;

    convertToHDWebpOrJpegByDeviceHd: (blob: Blob, modelz: any) => Promise<Blob> | any;

    index: number;
    startEdit?: boolean;
    setstartEdit?: (value: boolean) => void;
    fallbackImage?: string;
    defaultText?: string;
    GotIm: boolean;


    narrate: number;
    setnarrate: any;

    setGeneratedText: any;
    steps: any;
    setSteps: any;
    setGeneratedImagesFluxBlobHd: any;
    modelz: any;
    setIndex: any;
    setMemeMusic: any;
    Seed: any;
    setmusic: any;
    TextVideo: any
    setTextVideo: any;
    setVideoArray: any;
    VideoArray: any;
    VideMode: any;
    ImagesHdCloud: any;
    setVideoArrayBlob: any;
    VideoArrayBlob: any;
    PostId: any;
    setVideoArrayCloud: any


}

const EditStory: React.FC<EditStoryProps> = ({
    // Which mode we are in: 0 = arrays, 1 = single
    type = 0,

    // ----------- Arrays -----------
    generatedImagesFlux = [],
    setGeneratedImagesFlux,
    setGeneratedImagesFluxBlob,
    GeneratedImage = "",
    GeneratedText = [],

    // ----------- Single -----------
    FluxIm = "",
    setFluxIm,
    setFluxImBlob,
    Im = "",
    prompt = "",

    // ----------- Common -----------
    base,
    setbase,
    convertToHDWebpOrJpegByDevice,
    index,
    startEdit,
    setstartEdit,
    fallbackImage = "",
    defaultText = "",
    GotIm,
    setGeneratedText,
    narrate,
    setnarrate,
    steps,
    setSteps,
    setGeneratedImagesFluxBlobHd,
    convertToHDWebpOrJpegByDeviceHd,
    modelz,
    setIndex,
    setMemeMusic,
    Seed,
    setmusic,
    TextVideo,
    setTextVideo,
    setVideoArray,
    VideoArray,
    VideMode,
    ImagesHdCloud,
    setVideoArrayBlob,
    VideoArrayBlob,
    PostId,
    setVideoArrayCloud

}) => {
    const [textValue, setTextValue] = useState("");

    const [textValueT, setTextValueT] = useState("");

    const [textValuex, setTextValuex] = useState("");


    const dispatch = useDispatch();

    const [show, setShow] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);

    const CLIK_URL = import.meta.env.VITE_CLIK_URL;

    const darkMode = useSelector((state: RootState) => state.settings.darkMode);

    /* ---------- slider index sync ---------- */
    const sliderRef = useRef<HTMLDivElement | null>(null);

    const handleScroll = () => {
        if (!sliderRef.current || stopObserve) return;
        const { scrollLeft, clientWidth } = sliderRef.current;
        const newIdx = Math.round(scrollLeft / clientWidth); // snap points are 100 % wide
        if (newIdx !== index) setIndex?.(newIdx);
    };

    const [videotxt, setvideotxt] = useState('');



    /* keep slider aligned when parent changes index */
    useEffect(() => {



        if (!sliderRef.current) return;
        sliderRef.current.scrollTo({
            left: index * (sliderRef.current.clientWidth || 1),
            behavior: "auto",
        });

    }, [index, startEdit]);

    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);


    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Helper: Are we in array-based mode?
    const isArrayMode = type === 0;

    // Helper: get the “current” displayed image (either from the arrays or from the single props)
    const currentDisplayedImage = isArrayMode
        ? generatedImagesFlux[index] || fallbackImage
        : FluxIm || fallbackImage;

    // Helper: get the “base” image for the current index (array-mode) or for single mode (index=0)
    const currentBaseImage = isArrayMode
        ? base[index]
        : base[0]; // in single mode, we just store at base[0]
    ///Typex
    // Push a history state so the user can close this with back button
    useEffect(() => {

        if (!startEdit) return;

        window.history.pushState(null, "", window.location.href);

        const handlePopState = () => {
            if (setstartEdit) setstartEdit(false);
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape" && setstartEdit) {
                setstartEdit(false);
                window.history.back();
            }
        };

        window.addEventListener("popstate", handlePopState);
        window.addEventListener("keydown", handleEscape);

        return () => {
            window.removeEventListener("popstate", handlePopState);
            window.removeEventListener("keydown", handleEscape);
        };
    }, [startEdit, setstartEdit]);

    useEffect(() => {

        if (startEdit) {

            dispatch(setShowmenuToggle(false));

        } else {

            dispatch(setShowmenuToggle(true));

        }



    }, [startEdit, setstartEdit]);


    const [stopObserve, setstopObserve] = useState(false);


    const go = useCallback(() => {
        setstopObserve(true);
        setTimeout(() => {

            if (sliderRef.current) {
                sliderRef.current.scrollTo({
                    left: index * (sliderRef.current.clientWidth),
                    behavior: "smooth",        // <-- smooth rather than 'auto'
                });

            }

            setTimeout(() => {
                setstopObserve(false);

            }, 3000)

        }, 500)


    }, [index, sliderRef.current])


    // scroll whenever index or startEdit changes
    useEffect(() => {
        if (startEdit) {

            go();
        }
    }, [startEdit, sliderRef.current]);




    const [Once, setOnce] = useState(false);

    useEffect(() => {
        setTextValuex('');

    }, [startEdit, narrate])

    // Initialize text value, and base array item
    useEffect(() => {
        if (!startEdit) return;


        setvideotxt(TextVideo[index] ? TextVideo[index] : '');



        // In array mode, we read from GeneratedText[index], else single uses prompt
        if (isArrayMode) {
            setTextValue(GeneratedText[index] || defaultText);
            setTextValueT(steps[index]);
        } else {
            setTextValue(prompt || defaultText);
        }



        // If there's no base image stored yet, set it with the “GeneratedImage” in array mode or single mode
        // (In single mode, we store the base in base[0].)
        if (!currentBaseImage) {
            setbase((prev: any) => {
                const next = [...prev];
                const targetIndex = isArrayMode ? index : 0;
                next[targetIndex] = isArrayMode ? GeneratedImage : Im;
                return next;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startEdit, index, GeneratedImage, Im, GeneratedText, prompt, steps, TextVideo]);




    function isIphone(): boolean {
        return /iPhone/i.test(navigator.userAgent);
    }

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setTextValue(event.target.value);
    };
    const handleChangeT = (event: React.ChangeEvent<HTMLInputElement>) => {
        setTextValueT(event.target.value);
    };

    const handleChangex = (event: React.ChangeEvent<HTMLInputElement>) => {
        setTextValuex(event.target.value);
    };





    const fetchAndGenerateImage = useCallback(
        async (indexv: any) => {
            try {
                // 1) Ask backend for the visual prompt
                const requestData = {
                    imageDescription: GeneratedText[indexv],
                    question: steps[indexv]
                };


                const response = await axios.post<any>(
                    `${CLIK_URL}/VideoDesign`,
                    requestData,
                    { withCredentials: true }
                );
                const datax = response.data;

                const visualPromptText = datax.visualPrompt;

                /// alert(visualPromptText);



                setTextVideo((prev: any) => {
                    const next = [...prev];
                    next[indexv] = visualPromptText;
                    return next;
                });



            } catch (error: any) {

                if (error.response) {
                    console.error("Server Error:", error.response.data);
                } else if (error.request) {
                    console.error("No response received:", error.request);
                } else {
                    console.error("Error:", error.message);
                }
            }
        },
        [prompt, GeneratedText, steps]
    );



    async function convertToHDWebpOrJpegByDevicex(
        inputBlob: Blob,
        modelx: any
    ): Promise<Blob> {
        const reader = new FileReader();
        return new Promise<Blob>((resolve, reject) => {
            reader.onerror = e => reject(e);
            reader.onload = () => {
                const imageUrl = reader.result as string;
                const img = new Image();
                img.onerror = e => reject(e);
                img.onload = () => {
                    // 1) pick target dims
                    const [tW, tH] =
                        modelx === "Gpt Image"
                            ? [1024, 1536]
                            : [1080, 1920];

                    // 2) compute crop box in source to match target aspect ratio
                    const srcW = img.width;
                    const srcH = img.height;
                    const srcRatio = srcW / srcH;
                    const tgtRatio = tW / tH;

                    let sx: number, sy: number, sW: number, sH: number;
                    if (srcRatio > tgtRatio) {
                        // source is wider -> crop sides
                        sH = srcH;
                        sW = srcH * tgtRatio;
                        sx = (srcW - sW) / 2;
                        sy = 0;
                    } else {
                        // source is taller -> crop top/bottom
                        sW = srcW;
                        sH = srcW / tgtRatio;
                        sx = 0;
                        sy = (srcH - sH) / 2;
                    }

                    // 3) draw into canvas
                    const canvas = document.createElement("canvas");
                    canvas.width = tW;
                    canvas.height = tH;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        return reject(new Error("Canvas 2D context unavailable."));
                    }
                    ctx.drawImage(
                        img,
                        sx, sy, sW, sH,     // source crop
                        0, 0, tW, tH        // destination
                    );

                    // 4) choose format
                    const format = isIphone() ? "image/jpeg" : "image/webp";

                    // 5) export
                    canvas.toBlob(
                        blobOut => {
                            if (blobOut) resolve(blobOut);
                            else reject(new Error("toBlob returned null"));
                        },
                        format,
                        0.8
                    );
                };
                img.src = imageUrl;
            };
            reader.readAsDataURL(inputBlob);
        });
    }

    async function convertToHDWebpOrJpegByDeviceHdx(
        inputBlob: Blob,
        modelx: any
    ): Promise<Blob> {
        const reader = new FileReader();
        return new Promise<Blob>((resolve, reject) => {
            reader.onerror = e => reject(e);
            reader.onload = () => {
                const imageUrl = reader.result as string;
                const img = new Image();
                img.onerror = e => reject(e);
                img.onload = () => {
                    const [tW, tH] =
                        modelx === "Gpt Image"
                            ? [1024, 1536]
                            : [1080, 1920];

                    const srcW = img.width;
                    const srcH = img.height;
                    const srcRatio = srcW / srcH;
                    const tgtRatio = tW / tH;

                    let sx: number, sy: number, sW: number, sH: number;
                    if (srcRatio > tgtRatio) {
                        sH = srcH;
                        sW = srcH * tgtRatio;
                        sx = (srcW - sW) / 2;
                        sy = 0;
                    } else {
                        sW = srcW;
                        sH = srcW / tgtRatio;
                        sx = 0;
                        sy = (srcH - sH) / 2;
                    }

                    const canvas = document.createElement("canvas");
                    canvas.width = tW;
                    canvas.height = tH;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        return reject(new Error("Canvas 2D context unavailable."));
                    }
                    ctx.drawImage(img, sx, sy, sW, sH, 0, 0, tW, tH);

                    // HD version you wanted as PNG on all devices
                    const format = "image/png";

                    canvas.toBlob(
                        blobOut => {
                            if (blobOut) resolve(blobOut);
                            else reject(new Error("toBlob returned null"));
                        },
                        format,
                        0.8
                    );
                };
                img.src = imageUrl;
            };
            reader.readAsDataURL(inputBlob);
        });
    }


    const onFileChange = async (e: any) => {
        const file = e.target.files?.[0]
        if (!file) return

        // 1) load original blob
        const originalBlob = file

        // 2) convert low-res
        const blob = await convertToHDWebpOrJpegByDevicex(originalBlob, modelz)
        // create a preview URL
        const url = URL.createObjectURL(blob)

        // 3) convert high-res
        const blobHd = await convertToHDWebpOrJpegByDeviceHdx(originalBlob, modelz)

        // 4) delegate to your updater
        handleUpdateFluxImage(blob, url, blobHd)

        // if you need to manage state yourself (array mode) you can also:
        if (isArrayMode) {
            setGeneratedImagesFluxBlob?.((prev: any) => {
                const next = [...prev]
                next[index] = blob
                return next
            })
            setGeneratedImagesFluxBlobHd?.((prev: any) => {
                const next = [...prev]
                next[index] = blobHd
                return next
            })
            setGeneratedImagesFlux?.((prev: any) => {
                const next = [...prev]
                next[index] = url
                return next
            })
        } else {
            setFluxImBlob?.(blob)
            setFluxIm?.(url)
        }
    }



    // inside your component
    useEffect(() => {
        // check for any null/empty/default‐placeholder steps
        const hasInvalidStep = steps.some((step: any) =>
            step === null ||
            step === '' ||
            step === 'Enter Text to Generate AI Voice'
        );

        // only update state if it would actually change
        setMemeMusic((current: boolean) => {
            const shouldBeOn = !hasInvalidStep;
            return current === shouldBeOn ? current : shouldBeOn;
        });


        setmusic(hasInvalidStep ? 'https://clikbatebucket.s3.us-east-1.amazonaws.com/videos/audio-b50013a478814b136194434fe19576d7-trim-1749103536560.mp3' :
            "https://clikbatebucket.s3.us-east-1.amazonaws.com/videos/audio-96c7d18ac1609b81b25616be0a56cdb5-trim-1749230077880.mp3"
        )

    }, [steps]);







    // Helper to convert a base64 data-URI to a Blob
    async function base64ToBlob(base64Data: string): Promise<Blob> {
        // base64Data should look like: "data:video/mp4;base64,AAAA..."
        const res = await fetch(base64Data);
        return res.blob();
    }




    const GenerateVideo = useCallback(
        async (i: number) => {
            ///alert(index)

            setIsGenerating(true);

            setTextVideo((prev: any) => {
                const next = [...prev];
                next[i] = videotxt;
                return next;
            });



            try {
                ///   setIsSubmitting(true);
                ///  setPollStatus("Generating Kling video. This can take up to 3 minutes...");

                // Prepare the payload.
                const payload = {
                    prompt: videotxt,
                    startImage: ImagesHdCloud[i],
                    videoLength: 5,

                };


                console.log(payload);


                // Make a POST to your backend route (/klingPro) with an extended timeout of 5 minutes (300000 ms)
                const response = await axios.post<{ videoBase64: string }>(
                    `${CLIK_URL}/klingPro`,
                    payload,
                    { timeout: 400000 } // 5 minute timeout for long-running video generation
                );

                if (response.status !== 200) {
                    throw new Error(`Error from server: ${response.status}`);
                }

                // Extract the videoBase64 from the server’s response.
                const { videoBase64 } = response.data;
                if (!videoBase64) {
                    throw new Error("No videoBase64 returned from server");
                }

                // Convert the base64 string into a Blob and then create an Object URL.
                const blob = await base64ToBlob(videoBase64);
                const videoObjectUrl = URL.createObjectURL(blob);

                // Save the object URL so that the video can be displayed.

                console.log('vid', videoObjectUrl);

                setVideoArray((prev: any) => {
                    const next = [...prev];
                    next[index] = videoObjectUrl;
                    return next;
                });

                setVideoArrayBlob((prev: any) => {
                    const nextx = [...prev];
                    nextx[index] = blob;
                    return nextx;
                });




                setShow(false);
                /// setPollStatus("Success!");

                // Optionally, generate a signed URL for the video if needed.
                GenerateSignedUrlForVideo(blob, i);
            } catch (err) {
                // Reset loader state when an error occurs.
                setIsGenerating(false);
                console.error("Error generating Kling Pro video:", err);
                // setPollStatus("Failed");
            } finally {
                ///  setIsSubmitting(false);
            }
        },
        [ImagesHdCloud, videotxt, PostId]
    );



    // 1) Generate S3 signed URL
    const GenerateSignedUrlForVideo = useCallback(
        async (videoBlob: Blob, i: number) => {
            if (!videoBlob) {
                /// setError("No video blob for upload.");
                return;
            }

            try {
                // Example: pass any needed metadata or parameters in requestData

                const requestData = {
                    values: { count: 1 },
                };

                // Request a signed URL from your server
                const response = await axios.post<any>(
                    `${CLIK_URL}/get_signed_url_video`,
                    requestData,
                    { withCredentials: true } // If your server requires credentials/cookies
                );

                // Expect the server to respond with { signedUrl: "...", ... }

                const holder = response.data.holder;

                if (!holder || holder.length !== 1) {
                    throw new Error("Invalid signed URL response.");
                }

                const signedUrl = holder[0];


                if (!signedUrl) {
                    throw new Error("No signedUrl returned from server");
                }

                const { urlVideo } = signedUrl;

                // 2) Once we have a signed URL, PUT the video blob to S3
                await PutVideoInS3WithURL(videoBlob, urlVideo, i);

                console.log("signed URL:", signedUrl);
            } catch (err: any) {



                console.error("Error generating video signed URL:", err);
                ///setError(err.message || "Error generating video signed URL");
            }
        },
        [PostId]
    );




    // 2) Upload video to S3 using the signed URL
    const PutVideoInS3WithURL = useCallback(
        async (videoBlob: Blob, signedUrl: string, i: number) => {
            try {
                const uploadResponse = await axios.put(signedUrl, videoBlob, {
                    headers: {
                        "Content-Type": videoBlob.type || "video/mp4",
                    },
                });

                if (uploadResponse.status !== 200 && uploadResponse.status !== 204) {
                    throw new Error(`Video upload failed with status ${uploadResponse.status}`);
                }

                console.log("Video uploaded successfully to S3.");

                // The final S3 link is the signedUrl minus the query parameters
                const uploadedVideoUrl = signedUrl.split("?")[0];
                console.log("Uploaded video URL:", uploadedVideoUrl);



                setVideoArrayCloud((prev: any) => {
                    const nextx = [...prev];
                    nextx[i] = uploadedVideoUrl;
                    return nextx;
                });

                saveToDatabase(uploadedVideoUrl, i);

                // (Optional) Save the final URL to your database
                // e.g.: await saveToDatabase(uploadedVideoUrl, promptData, userData);
            } catch (err: any) {



                console.error("Error uploading video to S3:", err);
                /// setError(err.message || "Error uploading video to S3");
            }
        },
        [PostId]
    );




    const saveToDatabase = useCallback((vid: any, i: number) => {
        const Data = {
            postId: PostId,
            type: i,
            vid: vid,
        };

        axios.put(`${CLIK_URL}/UpdatePostAIVideo`, { values: Data })
            .then((response) => {
                if (response) {

                    // Update loader state
                    //  alert('video database')

                    // Update the storyVidArray state by setting the 'vid' in the appropriate index.

                }
            })
            .catch((error) => {
                alert('!Important Error: You can see Video But It is not saved on Database,pls generate again for use');
                console.log(error);
            });
    }, [PostId]);






    // This now updates either the array or the single item
    const handleUpdateFluxImage = (fluxImageBlob: Blob, fluxImageUrl: string, fluxImageBlobHd: Blob) => {
        if (isArrayMode) {
            // Array-based update
            setGeneratedImagesFluxBlob?.((prev: Blob[]) => {
                const next = [...prev];
                next[index] = fluxImageBlob;
                return next;
            });
            setGeneratedImagesFluxBlobHd?.((prev: Blob[]) => {
                const next = [...prev];
                next[index] = fluxImageBlobHd;
                return next;
            });

            setGeneratedImagesFlux?.((prev: string[]) => {
                const next = [...prev];
                next[index] = fluxImageUrl;
                return next;
            });
        } else {
            // Single-based update
            setFluxImBlob?.(fluxImageBlob);
            setFluxIm?.(fluxImageUrl);
        }
    };




    // Helper that calls the server, converts the returned image, then updates either the arrays or single
    const handleSubmitFluxImageNew = async (
        imageUrlFromSdxl: string, // base image
        enhancedPrompt: string,
        Seed: number
    ) => {
        setIsGenerating(true); // show the loader

        try {
            let base64Image = "";

            // Convert existing image to base64
            if (imageUrlFromSdxl.trim() !== "") {
                const imageResponse = await fetch(imageUrlFromSdxl);
                if (!imageResponse.ok) {
                    throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
                }
                const imageBlob = await imageResponse.blob();
                base64Image = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(imageBlob);
                });
            }

            // Prepare payload
            const payload: any = {
                inputs: enhancedPrompt,
                width: 1080,
                height: 1920,
                guidance: 7.5,
                num_inference_steps: 35,
                seed: Seed
            };

            // Conditionally include the image if available
            var url = 'fluxPro';

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


            // Post to your backend
            const response: any = await axios.post(`${CLIK_URL}/${url}`, payload, {
                withCredentials: true,
            });

            if (response.status !== 200) {
                throw new Error(`FluxSchnell route error: ${response.status}`);
            }

            const { imageBase64 } = response.data;
            if (!imageBase64) {
                throw new Error("No imageBase64 returned from server");
            }

            // Convert the returned base64 to a Blob
            const fluxImageBlobx = await (async () => {
                const fetchRes = await fetch(imageBase64);
                return await fetchRes.blob();
            })();

            // Convert the blob to HD WebP or JPEG
            const fluxImageBlob = await convertToHDWebpOrJpegByDevice(fluxImageBlobx, modelz);
            const fluxImageBlobHd = await convertToHDWebpOrJpegByDeviceHd(fluxImageBlobx, modelz);

            // Create a blob URL for preview
            const fluxImageUrl = URL.createObjectURL(fluxImageBlob);

            setLoader(100);


            setTimeout(async () => {

                setIsGenerating(false); // hide the loader

                if (type === 1) {

                    setGeneratedText(enhancedPrompt);
                }

                else {
                    setGeneratedText((prev: any) => {
                        const next = [...prev];
                        next[index] = enhancedPrompt;
                        return next;
                    });
                }
                setTextValuex('');
                // Update local arrays or single
                handleUpdateFluxImage(fluxImageBlob, fluxImageUrl, fluxImageBlobHd);

                console.log("New flux image ready:", fluxImageUrl);

            }, 1000)

        } catch (err) {
            console.error("Error calling Flux Inference Endpoint:", err);
        } finally {

        }
    };


    const callRemake = async (textValuex: any, textValue: any, prompt: any) => {

        setIsGenerating(true); // show the loader
        try {
            // Prepare the request payload

            var instructions = textValuex;
            var promptx = textValue;
            var logic = prompt;
            const requestData: any = { promptx, instructions, logic };

            // Make the POST request to the server
            const response = await axios.post<any>(
                `${CLIK_URL}/GptRemake`,
                requestData,
                { withCredentials: true }
            );

            // Extract data from the response
            const data = response.data;

            console.log("remake:", data.payload);

            // Update state with the enhanced text
            //setEnhancedText(data.initialSteps);
            //setPrompt(data.initialSteps);

            handleDraw(data.payload);

        } catch (error: any) {


            setIsGenerating(false); // show the loader

            // Handle different error scenarios
            if (error.response) {
                // Server responded with a status other than 2xx
                console.error("Server Error:", error.response.data);
                /// setError(error.response.data.message || "Server Error");
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
    }



    const callRemakeText = async (textValuex: any, textValue: any) => {

        setIsGenerating(true); // show the loader
        try {
            // Prepare the request payload

            var instructions = textValuex;
            var promptx = textValue;
            const requestData: any = { promptx, instructions };

            // Make the POST request to the server
            const response = await axios.post<any>(
                `${CLIK_URL}/GptRemakeText`,
                requestData,
                { withCredentials: true }
            );

            // Extract data from the response
            const data = response.data;

            console.log("remakeText:", data.payload);

            // Update state with the enhanced text
            //setEnhancedText(data.initialSteps);
            //setPrompt(data.initialSteps);


            setIsGenerating(false); // show the loader

            setSteps((prev: any) => {
                const next = [...prev];
                next[index] = data.payload;
                return next;
            });

            if (setstartEdit) setstartEdit(false);

        } catch (error: any) {


            setIsGenerating(false); // show the loader

            // Handle different error scenarios
            if (error.response) {
                // Server responded with a status other than 2xx
                console.error("Server Error:", error.response.data);
                /// setError(error.response.data.message || "Server Error");
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
    }



    const handleKeyDown = (e: any) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (textValuex) {
                callRemake(textValuex, textValue, prompt);

            } else {
                handleDraw(textValue);
            }
        }

    }

    // handler factory: given an index, returns an onChange handler
    const handleChangeTextVid = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {

        const newValue = e.target.value;



        setvideotxt(newValue);

    }, [index])



    const handleKeyDownT = (e: any) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (textValuex) {

                callRemakeText(textValuex, textValue);
            } else {
                setSteps((prev: any) => {
                    const next = [...prev];
                    next[index] = textValueT;
                    return next;
                });

                if (setstartEdit) setstartEdit(false);
            }
        }
    };


    const handleKeyDownvid = (e: any) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();

            GenerateVideo(index);

        }
    }


    useEffect(() => {
        // Check if any step is exactly " " or exactly "Enter Text to Generate AI Voice"
        const hasInvalid =
            steps.some(
                (item: any) =>
                    item === " " || item === "" || item === "Enter Text to Generate AI Voice"
            );

        if (hasInvalid) {

            setMemeMusic(true);
        } else {
            setMemeMusic(false);
        }
    }, [steps]);

    // The "Draw" button calls the above function
    const handleDraw = (newValue: any) => {
        // In array mode, we use base[index], in single mode base[0]
        const baseToSend = isArrayMode ? base[index] : base[0] || "";
        handleSubmitFluxImageNew('', newValue, Seed);
    };






    // 2) For an existing image URL: fetch => create File => call handleFileChange
    const handleExistingUrl = async (
        url: string,
        onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    ) => {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Failed to fetch image for resizing");

            const blob = await response.blob();
            const file = new File([blob], "selectedImage.jpg", { type: blob.type });

            // Synthetic event
            const fakeInputEvent = {
                target: { files: [file] },
                currentTarget: { files: [file] },
                preventDefault: () => { },
                stopPropagation: () => { },
            } as unknown as React.ChangeEvent<HTMLInputElement>;

            onFileChange(fakeInputEvent);
        } catch (err) {
            console.error(err);
        }
    };


    // The file upload logic is shared. We store the result in array mode at base[index], in single mode at base[0].
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const imageUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = async () => {
            const desiredWidth = 1080;
            const desiredHeight = 1920;

            const canvas = document.createElement("canvas");
            canvas.width = desiredWidth;
            canvas.height = desiredHeight;

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            const originalWidth = img.width;
            const originalHeight = img.height;
            const originalAspect = originalWidth / originalHeight;
            const desiredAspect = desiredWidth / desiredHeight;

            let drawWidth, drawHeight;
            let offsetX = 0;
            let offsetY = 0;

            // Letterbox or pillarbox to fill 1080x1920 exactly
            if (originalAspect > desiredAspect) {
                drawHeight = desiredHeight;
                drawWidth = drawHeight * originalAspect;
                offsetX = (desiredWidth - drawWidth) * 0.5;
            } else {
                drawWidth = desiredWidth;
                drawHeight = drawWidth / originalAspect;
                offsetY = (desiredHeight - drawHeight) * 0.5;
            }

            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

            const resizedBlob = await new Promise<Blob | null>((resolve) => {
                canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.9);
            });
            if (!resizedBlob) return;

            const resizedImageUrl = URL.createObjectURL(resizedBlob);

            // Store the new base image in either base[index] or base[0]
            setbase((prev: any) => {
                const next = [...prev];
                const targetIndex = isArrayMode ? index : 0;
                next[targetIndex] = resizedImageUrl;
                return next;
            });

            URL.revokeObjectURL(imageUrl);
        };

        img.src = imageUrl;
        event.target.value = "";

    };

    const handleClickBasePicker = () => {
        fileInputRef.current?.click();
    };



    /* ------------------------------------------------------------------ */
    const [loader, setLoader] = useState(0);          // 0 – 100 %

    /* ------------------------------------------------------------------ */
    /* Kick off / reset when isSubmitting flips                           */
    /* ------------------------------------------------------------------ */
    useEffect(() => {
        let timer: NodeJS.Timeout | null = null;

        if (isGenerating) {
            const start = Date.now();                 // ms
            const DURATION = VideMode ? 5 * 60 * 1000 : 3 * 60 * 1000;           // 5 minutes in ms
            const CAP = 95;                           // never exceed 95 %

            // reset immediately
            setLoader(0);

            timer = setInterval(() => {
                const elapsed = Date.now() - start;     // ms since start
                const t = Math.min(elapsed / DURATION, 1); // 0 – 1 timeline

                /* cubic-easing curve  → fast start, slow finish              *
                 *   easeOutCubic(t) = 1 – (1 – t)^3                          */
                const eased = 1 - Math.pow(1 - t, 3);

                const pct = Math.round(eased * CAP);   // 0 → 95 % non-linear
                setLoader(prev => (pct > prev ? pct : prev));
            }, 200);                                  // update every 0.2 s
        }

        /* cleanup on unmount / when isSubmitting flips to false */
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [isGenerating]);
    /* ------------------------------------------------------------------ */
    /* When the generation completes, bump to 100 % then hide overlay     */
    /* ------------------------------------------------------------------ */
    useEffect(() => {
        if (!isGenerating && loader < 100) {
            // when you set isGenerating  = false, bump to 100 first
            setLoader(100);
            // overlay will disappear because isGenerating  === false
        }
    }, [isGenerating]);                                // runs once on finish





    return (
        <Box
            sx={{
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100vh",
                zIndex: 2000,
                overflow: "hidden",
                display: startEdit ? "block" : "none",
            }}
        >



            <input
                accept="image/*"
                type="file"
                id="flux-image-input"
                style={{ display: 'none' }}
                onChange={onFileChange}
            />

            <label htmlFor="flux-image-input">
                <IconButton
                    component="span" // needed so IconButton renders as <span>
                    sx={{
                        borderRadius: '50%',
                        position: 'fixed',
                        top: '10vh',
                        left: '2.5vw',
                        zIndex: 30000,
                        width: matchMobile ? 56 : 56,
                        height: matchMobile ? 56 : 56,
                        bgcolor: darkModeReducer ? 'rgb(100,100,100,1)' : 'rgb(250,250,250,1)',
                        '&:hover': {
                            bgcolor: darkModeReducer
                                ? 'rgb(100,100,100,0.3)'
                                : 'rgb(250,250,250,0.3)',
                        },
                        opacity: 0.7,
                        display: 'inline-flex',
                        m: 'auto',
                        boxShadow: 3,
                    }}
                >
                    <ImageIcon
                        sx={{
                            fontSize: matchMobile ? '1.8rem' : '1.7rem',
                            color: darkModeReducer ? 'white' : 'black',
                        }}
                    />
                </IconButton>
            </label>




            {/* ADDED: Two clickable texts at the very top */}
            {show && <Box
                sx={{
                    position: "fixed",
                    top: "1vh",
                    left: "50%",
                    transform: "translateX(-50%)",
                    gap: "2rem",
                    color: "#fff",
                    textShadow: "0 0 5px rgba(0, 0, 0, 0.9)",
                    zIndex: 3000,
                    cursor: "pointer",
                    fontSize: matchMobile ? '1.5rem' : '1.8rem',
                    fontWeight: 'bold',
                    display: type == 0 ? 'flex' : 'none'
                }}
            >



                <Box onClick={() => {

                    setnarrate(0);

                }} style={{
                    paddingRight: '2vw', opacity: narrate === 0 ? 0.3 : 1,

                    display: VideMode ? 'none' : 'block'
                }}>
                    Images
                </Box>
                <Box onClick={() => {

                    setnarrate(1);
                }} style={{ paddingLeft: '2vw', opacity: narrate === 1 ? 0.3 : 1, display: VideMode ? 'none' : 'block' }}>
                    Narration
                </Box>
                <Box onClick={() => {

                    setnarrate(2);
                }} style={{
                    paddingLeft: '2vw', opacity: narrate === 2 ? 0.3 : 1,
                    display: VideMode ? 'block' : 'none'
                }}>
                    Videos
                </Box>
            </Box>}
            {/* END ADDED */}

            {/* MAIN IMAGE CONTAINER */}
            <Box
                className={darkMode ? "contentdarkColor" : "contentColor"}
                sx={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1,
                }}
            >
                {type === 1 ? (
                    /* ---------- SINGLE MODE: keep your original element ---------- */
                    <img
                        onClick={() => setShow((prev) => !prev)}
                        src={currentDisplayedImage}
                        alt={`Step ${index + 1}`}
                        style={{
                            height: "100%",
                            width: "auto",
                            objectFit: "cover",
                            cursor: "pointer",
                        }}
                    />
                ) : (
                    /* ---------- ARRAY MODE: self-contained, snap-scroll slider ---------- */
                    <Box
                        ref={sliderRef}          // ← new
                        onScroll={handleScroll}  // ← new
                        sx={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            overflowX: "auto",
                            scrollSnapType: "x mandatory",
                            WebkitOverflowScrolling: "touch",
                            scrollBehavior: "smooth",
                        }}
                    >

                        {steps.map((img: string, i: number) => (
                            <Box
                                key={i}
                                sx={{
                                    flex: "0 0 100%",
                                    height: "100%",
                                    scrollSnapAlign: "center",
                                    position: "relative",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >

                                {narrate === 2 && VideoArray[i] ?
                                    <video
                                        src={VideoArray[i]}
                                        style={{
                                            height: "100%",
                                            width: "auto",
                                            objectFit: "cover",
                                            cursor: "pointer",
                                        }}
                                        autoPlay
                                        playsInline   // especially needed on iOS to allow inline autoplay
                                        muted         // browsers only allow autoplay if muted
                                        loop
                                        controls
                                        onClick={() => setShow(prev => !prev)}
                                    />
                                    :

                                    <img
                                        onClick={() => setShow((prev) => !prev)}
                                        src={generatedImagesFlux[i] || fallbackImage}
                                        alt={`Step ${i + 1}`}
                                        style={{
                                            height: "100%",
                                            width: "auto",
                                            objectFit: "cover",
                                            cursor: "pointer",
                                        }}
                                    />}

                            </Box>
                        ))}
                    </Box>
                )}


                {isGenerating && (


                    <Box
                        sx={{
                            position: "absolute",
                            top: "35%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            width: "100%",
                            height: "0px",
                            background: "rgba(0,0,0,.35)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: 2,
                            zIndex: 2,

                        }}
                    >
                        <CircularProgress
                            variant="determinate"
                            value={loader}
                            size={60}
                            thickness={5}
                            sx={{ color: '#F6BB56' }} // or any custom color you prefer
                        />

                        {/* numeric label (optional) */}


                        <Typography
                            sx={{
                                mt: 1,
                                fontSize: 14,
                                fontWeight: 600,
                                color: "#fff",
                                fontFamily: "sans-serif",
                                textShadow: "0 1px 3px rgba(0, 0, 0, 0.8)", // strong shadow for contrast
                            }}
                        >
                            {loader}%
                        </Typography>

                    </Box>
                )}
            </Box>

            {/* CLOSE ICON */}
            <IconButton
                onClick={() => {
                    if (setstartEdit) setstartEdit(false);
                }}
                sx={{
                    position: "fixed",
                    top: 12,
                    right: 12,
                    color: darkMode ? "#ffffff" : "#000000",
                    zIndex: 300,
                    display: matchMobile ? 'none' : 'block'
                }}
            >
                <CloseIcon style={{ fontSize: "2rem", opacity: 0.1 }} />
            </IconButton>
            e.stopPropagation();
            handleClickBasePicker();
            {/* BASE PICKER THUMBNAIL */}


            {

                modelz === 'Flux Pro' ? show && narrate !== 1 ? (
                    <FilePicker
                        Once={Once}
                        setOnce={setOnce}
                        startEdit={startEdit}
                        type={type}
                        generatedImagesFlux={generatedImagesFlux}
                        GeneratedImage={GeneratedImage}
                        FluxIm={FluxIm}
                        base={base}
                        setbase={setbase}
                        handleExistingUrl={handleExistingUrl}
                        handleFileChange={handleFileChange}
                        index={index}
                        fallbackImage={fallbackImage}
                        show={show} // So it shows/hides the "thumbnail" when user toggles

                    />
                ) : null

                    : null}

            {/* TEXT PROMPT AND DRAW BUTTON */}
            <Box
                sx={{
                    position: "absolute",
                    bottom: matchMobile ? "10vh" : "0",
                    left: 0,
                    width: "100%",
                    p: 2,
                    color: darkMode ? "#fff" : "#000",
                    backgroundColor: darkMode
                        ? "rgba(0, 0, 0, 0.9)"
                        : "rgba(255, 255, 255, 0.9)",
                    zIndex: 2,
                    display: show && narrate === 0 ? "block" : "none",
                }}
            >
                <TextField
                    variant="filled"
                    fullWidth
                    multiline
                    minRows={2}
                    onKeyDown={handleKeyDown}
                    value={textValuex}
                    onChange={handleChangex}
                    placeholder="Describe Change To Gpt"
                    sx={{
                        "& .MuiInputBase-root:focus": { outline: "none" },
                        "& .MuiInputBase-input:focus-visible": { outline: "none" },
                        "& .Mui-focused": { outline: "none" },
                        "& .MuiInputBase-input": {
                            color: darkMode ? "#ffffff" : "#000000",
                            fontSize: matchMobile ? '1.05rem' : '1.2rem',
                            lineHeight: matchMobile ? '1.8' : '2'
                        },
                        "& .MuiInputLabel-root": {
                            color: darkMode ? "#ffffff" : "#000000",
                            fontSize: matchMobile ? '1.05rem' : '1.2rem',
                            lineHeight: matchMobile ? '1.8' : '2'
                        },

                        "& .MuiFormHelperText-root": {
                            color: darkMode ? "#ffffff" : "#000000",
                        },

                        '& .MuiFilledInput-underline:after': {
                            borderBottomColor: '#F6BB56', // focused underline color
                        },
                        '& .Mui-focused .MuiFilledInput-underline:after': {
                            borderBottomColor: '#F6BB56', // explicitly force color when focused
                        },

                        mb: 1,
                        maxHeight: matchMobile ? '11.5vh' : '13vh',
                        overflow: 'auto',

                    }}
                />

                <TextField
                    variant="filled"
                    fullWidth
                    multiline
                    minRows={2}
                    onKeyDown={handleKeyDown}
                    value={textValue}
                    onChange={handleChange}
                    placeholder="Enter Image Prompt"
                    sx={{
                        "& .MuiInputBase-root:focus": { outline: "none" },
                        "& .MuiInputBase-input:focus-visible": { outline: "none" },
                        "& .Mui-focused": { outline: "none" },
                        "& .MuiInputBase-input": {
                            color: darkMode ? "#ffffff" : "#000000",
                            fontSize: matchMobile ? '1.05rem' : '1.2rem',
                            lineHeight: matchMobile ? '1.8' : '2'
                        },
                        "& .MuiInputLabel-root": {
                            color: darkMode ? "#ffffff" : "#000000",
                            fontSize: matchMobile ? '1.05rem' : '1.2rem',
                            lineHeight: matchMobile ? '1.8' : '2'
                        },
                        "& .MuiFormHelperText-root": {
                            color: darkMode ? "#ffffff" : "#000000",
                        },

                        '& .MuiFilledInput-underline:after': {
                            borderBottomColor: '#F6BB56', // focused underline color
                        },
                        '& .Mui-focused .MuiFilledInput-underline:after': {
                            borderBottomColor: '#F6BB56', // explicitly force color when focused
                        },

                        mb: 1,
                        maxHeight: matchMobile ? '20vh' : '22vh',
                        overflow: 'auto',
                    }}
                />

                <Button
                    variant="contained"
                    color="primary"
                    onClick={() => {
                        if (textValuex) {
                            callRemake(textValuex, textValue, prompt);
                        } else {
                            handleDraw(textValue);
                        }
                    }}
                    sx={{
                        width: "100%",
                        borderRadius: 2,
                        backgroundColor: darkMode ? "#1e1e1e" : "#f5f5f5",
                        color: darkMode ? "#ffffff" : "#000000",
                        boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.3)",
                        "&:hover": {
                            backgroundColor: darkMode ? "#bbbbbb" : "#555555",
                            color: darkMode ? "#000000" : "#ffffff",
                            boxShadow: "0px 6px 8px rgba(0, 0, 0, 0.2)",
                        },
                        px: 3,
                        py: 1.5,
                    }}
                >
                    Draw
                </Button>
            </Box>

            <Box
                sx={{
                    position: "absolute",
                    bottom: matchMobile ? "10vh" : "0",
                    left: 0,
                    width: "100%",
                    p: 2,
                    color: darkMode ? "#fff" : "#000",
                    backgroundColor: darkMode
                        ? "rgba(0, 0, 0, 0.9)"
                        : "rgba(255, 255, 255, 0.9)",
                    zIndex: 2,
                    display: show && narrate === 1 ? "block" : "none",
                }}
            >

                <TextField
                    variant="filled"
                    fullWidth
                    multiline
                    minRows={2}
                    onKeyDown={handleKeyDownT}
                    value={textValuex}
                    onChange={handleChangex}
                    placeholder="Use Gpt"
                    sx={{
                        "& .MuiInputBase-root:focus": { outline: "none" },
                        "& .MuiInputBase-input:focus-visible": { outline: "none" },
                        "& .Mui-focused": { outline: "none" },
                        "& .MuiInputBase-input": {
                            color: darkMode ? "#ffffff" : "#000000",
                            fontSize: matchMobile ? '1.05rem' : '1.2rem',
                            lineHeight: matchMobile ? '1.8' : '2'
                        },
                        "& .MuiInputLabel-root": {
                            color: darkMode ? "#ffffff" : "#000000",
                            fontSize: matchMobile ? '1.05rem' : '1.2rem',
                            lineHeight: matchMobile ? '1.8' : '2'
                        },
                        mb: 1,
                        maxHeight: matchMobile ? '11.5vh' : '13vh',
                        overflow: 'auto',
                    }}
                />

                <TextField
                    variant="filled"
                    fullWidth
                    multiline
                    minRows={2}
                    onKeyDown={handleKeyDownT}
                    value={textValueT}
                    onChange={handleChangeT}
                    placeholder="Enter Narration Text"
                    sx={{
                        "& .MuiInputBase-root:focus": { outline: "none" },
                        "& .MuiInputBase-input:focus-visible": { outline: "none" },
                        "& .Mui-focused": { outline: "none" },
                        "& .MuiInputBase-input": {
                            color: darkMode ? "#ffffff" : "#000000",
                            fontSize: matchMobile ? '1.05rem' : '1.2rem',
                            lineHeight: matchMobile ? '1.8' : '2'
                        },
                        "& .MuiInputLabel-root": {
                            color: darkMode ? "#ffffff" : "#000000",
                            fontSize: matchMobile ? '1.05rem' : '1.2rem',
                            lineHeight: matchMobile ? '1.8' : '2'
                        },
                        mb: 1,
                        maxHeight: matchMobile ? '25vh' : '28vh',

                        overflow: 'auto',
                    }}
                />
                <Button
                    variant="contained"
                    color="primary"
                    onClick={() => {

                        if (textValuex) {

                            callRemakeText(textValuex, textValue);
                        } else {
                            setSteps((prev: any) => {
                                const next = [...prev];
                                next[index] = textValueT;
                                return next;
                            });

                            if (setstartEdit) setstartEdit(false);
                        }

                    }}
                    sx={{
                        width: "100%",
                        borderRadius: 2,
                        backgroundColor: darkMode ? "#1e1e1e" : "#f5f5f5",
                        color: darkMode ? "#ffffff" : "#000000",
                        boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.3)",
                        "&:hover": {
                            backgroundColor: darkMode ? "#bbbbbb" : "#555555",
                            color: darkMode ? "#000000" : "#ffffff",
                            boxShadow: "0px 6px 8px rgba(0, 0, 0, 0.2)",
                        },
                        px: 3,
                        py: 1.5,
                    }}
                >
                    Update
                </Button>

            </Box>


            <Box
                sx={{
                    position: "absolute",
                    bottom: matchMobile ? "10vh" : "0",
                    left: 0,
                    width: "100%",
                    p: 2,
                    color: darkMode ? "#fff" : "#000",
                    backgroundColor: darkMode
                        ? "rgba(0, 0, 0, 0.9)"
                        : "rgba(255, 255, 255, 0.9)",
                    zIndex: 2,
                    display: show && narrate === 2 ? "block" : "none",
                }}
            >


                <Button
                    variant="contained"
                    color="primary"
                    onClick={() => {

                        fetchAndGenerateImage(index);

                    }}
                    sx={{
                        width: "100%",
                        borderRadius: 2,
                        backgroundColor: darkMode ? "#1e1e1e" : "#f5f5f5",
                        color: darkMode ? "#ffffff" : "#000000",
                        boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.3)",
                        "&:hover": {
                            backgroundColor: darkMode ? "#bbbbbb" : "#555555",
                            color: darkMode ? "#000000" : "#ffffff",
                            boxShadow: "0px 6px 8px rgba(0, 0, 0, 0.2)",
                        },
                        px: 3,
                        py: 1.5,
                    }}
                >
                    Auto  Generate Prompt
                </Button>

                <TextField
                    variant="filled"
                    fullWidth
                    multiline
                    minRows={2}
                    onKeyDown={handleKeyDownvid}
                    value={videotxt}
                    onChange={handleChangeTextVid}
                    placeholder="Enter Video Prompt"
                    sx={{
                        "& .MuiInputBase-root:focus": { outline: "none" },
                        "& .MuiInputBase-input:focus-visible": { outline: "none" },
                        "& .Mui-focused": { outline: "none" },
                        "& .MuiInputBase-input": {
                            color: darkMode ? "#ffffff" : "#000000",
                            fontSize: matchMobile ? '1.05rem' : '1.2rem',
                            lineHeight: matchMobile ? '1.8' : '2'
                        },
                        "& .MuiInputLabel-root": {
                            color: darkMode ? "#ffffff" : "#000000",
                            fontSize: matchMobile ? '1.05rem' : '1.2rem',
                            lineHeight: matchMobile ? '1.8' : '2'
                        },
                        '& .MuiFilledInput-underline:after': {
                            borderBottomColor: 'red', // focused underline color
                        },
                        '& .Mui-focused .MuiFilledInput-underline:after': {
                            borderBottomColor: 'red', // explicitly force color when focused
                        },

                        mb: 1,
                        maxHeight: matchMobile ? '25vh' : '28vh',

                        overflow: 'auto',
                    }}
                />
                <Button
                    variant="contained"
                    color="primary"
                    onClick={() => {

                        GenerateVideo(index);

                    }}
                    sx={{
                        width: "100%",
                        borderRadius: 2,
                        backgroundColor: darkMode ? "#1e1e1e" : "#f5f5f5",
                        color: darkMode ? "#ffffff" : "#000000",
                        boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.3)",
                        "&:hover": {
                            backgroundColor: darkMode ? "#bbbbbb" : "#555555",
                            color: darkMode ? "#000000" : "#ffffff",
                            boxShadow: "0px 6px 8px rgba(0, 0, 0, 0.2)",
                        },
                        px: 3,
                        py: 1.5,
                    }}
                >
                    Generate
                </Button>

            </Box>
        </Box>
    );

};

export default EditStory;
