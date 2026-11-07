import React, { FC, useCallback, useRef, useState, useEffect } from "react";
import { Box, Button, Stack, IconButton } from "@mui/material";
import UploadIcon from "@mui/icons-material/Upload";
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { matchMobile } from "./DetectDevice";
import InteractTrim from "./InteractTrim";
import axios from "axios"; // Import Axios

/**
 * IntMedia Component
 * 
 * Props:
 * - Inttype: number
 * - videoURL: string
 * - OpenIntMedia: boolean
 * - setOpenIntMedia: (open: boolean) => void
 * - url1, setUrl1, url2, setUrl2: for trimmed URLs
 */
const IntMedia: FC<any> = ({
    Inttype,
    videoURL,
    OpenIntMedia,
    setOpenIntMedia,
    url1,
    setUrl1,
    url2,
    setUrl2,
    setIsImg1,
    setIsImg2,
}) => {
    const [result, setResult] = useState<{ videoURL?: string; file?: File }>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [start, setStart] = useState(false);
    const [isImage, setIsImage] = useState(false);


    const CLIK_URL = import.meta.env.VITE_CLIK_URL;

    const [IntMediaType, setIntMediaType] = useState(0);

    const handleUseUrl = () => {
        setResult({ videoURL });
        setStart(true);
        setIntMediaType(0);
    };





    // Function to generate signed URLs
    const GenerateSignedUrl = useCallback(async (GeneratedImageFluxBlob: any) => {
        if (!GeneratedImageFluxBlob) {
            //  setError("Image blobs are not available for uploading.");
            return;
        }

        try {
            const requestData = {
                values: { count: 2 },
            };

            // Make the POST request to get signed URLs
            const response: any = await axios.post(
                `${CLIK_URL}/get_signed_url_image`,
                requestData,
                { withCredentials: true } // Include if your backend requires credentials
            );

            const holder = response.data.holder;

            if (!holder || holder.length !== 1) {
                throw new Error("Invalid signed URL response.");
            }

            const signedUrls = holder[0];

            if (!signedUrls.urlBase || !signedUrls.urlHD) {
                throw new Error("Missing signed URLs for images.");
            }

            PutImagesInS3WithURL(GeneratedImageFluxBlob, signedUrls);

            console.log("Signed URLs generated successfully:", signedUrls);
        } catch (err: any) {
            console.error("Error generating signed URLs:", err);
            ///  setError(err.message || "An error occurred while generating signed URLs.");
        }
    }, [CLIK_URL, Inttype]);



    // Function to upload images to S3 using signed URLs
    const PutImagesInS3WithURL = useCallback(
        async (GeneratedImageFluxBlob: any, signedUrls: any) => {
            if (!signedUrls.urlBase || !signedUrls.urlHD) {
                // setError("Signed URLs are not available for uploading.");
                return;
            }

            if (!GeneratedImageFluxBlob) {
                // setError("Image blob is not available for uploading.");
                return;
            }

            ///  setError(""); // Clear any existing errors

            try {
                // Upload HD Image
                console.log(`Uploading HD: 10secs Image to ${signedUrls.urlHD}`);
                const uploadHD = await axios.put(signedUrls.urlHD, GeneratedImageFluxBlob, {
                    headers: {
                        "Content-Type": GeneratedImageFluxBlob.type || "application/octet-stream",
                    },
                });

                if (uploadHD.status !== 200 && uploadHD.status !== 204) {
                    throw new Error(`HD image upload failed with status ${uploadHD.status}`);
                }

                console.log("HD image uploaded successfully.");

                // Extract the uploaded image URLs (remove query parameters)
                const uploadedHdUrl = signedUrls.urlHD.split("?")[0];
                console.log('interaction image from cloud', uploadedHdUrl);



                if (Inttype === 1) {

                    setUrl1(uploadedHdUrl); setIsImg1(true);
                } else {

                    setUrl2(uploadedHdUrl); setIsImg2(true);
                }

                setOpenIntMedia(false);


            } catch (err: any) {
                console.error("Error during image upload:", err);
                //  setError(err.message || "An error occurred during the image upload.");
            }
        },
        [Inttype]
    );



    const [mediaCategory, setMediaCategory] = useState<"image" | "other" | null>(null);
    const [processing, setProcessing] = useState(false);

    // Keep track of the current object URL so we can revoke it later
    const previewUrlRef = useRef<string | null>(null);

    // Cleanup on unmount or when previewUrl changes
    useEffect(() => {
        return () => {
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
            }
        };
    }, []);

    const readImageAsBlob = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onloadend = () => {
                const arrayBuffer = reader.result;
                if (!(arrayBuffer instanceof ArrayBuffer)) {
                    return reject(new Error("Unexpected FileReader result"));
                }
                const blob = new Blob([arrayBuffer], { type: file.type });
                const url = URL.createObjectURL(blob);
                previewUrlRef.current = url;
                resolve(url);
            };

            reader.onerror = () => {
                reject(reader.error);
            };

            reader.readAsArrayBuffer(file);
        });
    };

    const handleFileChange = useCallback(
        async (e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (!file) {
                return; // nothing to do
            }

            setProcessing(true);
            setResult({ file });
            const image = file.type.startsWith("image/");
            setIsImage(image);
            setMediaCategory(image ? "image" : "other");

            try {

                setIntMediaType(1);
                if (image) {
                    const previewUrl = await readImageAsBlob(file);
                    // e.g. call your API to get a signed URL
                    await GenerateSignedUrl(file);

                } else {
                    // non-image branch
                    // kick off whatever processing you need

                    setStart(true);
                }
            } catch (error) {
                console.error("Error reading file:", error);
                // Optionally surface to the user
            } finally {
                setProcessing(false);
            }
        },
        []
    );

    // Determine which video source to send
    const sourceUrl = result.file
        ? URL.createObjectURL(result.file)
        : result.videoURL;

    if (!OpenIntMedia) return null;

    return (
        <Box
            position="fixed"
            top="3vh"
            left={matchMobile ? "0%" : "10%"}
            width="100%"
            zIndex={300}
            sx={{
                display: "flex", justifyContent: "center",
                backdropFilter: start ? "blur(30px)" : 'blur(0px)',
                borderRadius: '20px'
            }}
        >
            {!start ? (
                <>
                    <input
                        type="file"
                        accept="image/*,video/*"
                        style={{ display: 'none' }}
                        ref={fileInputRef}
                        onChange={handleFileChange}
                    />
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Button variant="contained" onClick={handleUseUrl}>
                            Use Main
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={result.file ? <CheckIcon /> : <UploadIcon />}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {result.file
                                ? 'Selected'
                                : Inttype === 1
                                    ? 'Upload 1'
                                    : 'Upload 2'}
                        </Button>
                        <IconButton
                            size="small"
                            onClick={() => setOpenIntMedia(false)}
                        >
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                </>
            ) : (
                <InteractTrim
                    setCloudvideoURL={() => { }}
                    IntMediaType={IntMediaType}
                    setIsImg1={setIsImg1}
                    setIsImg2={setIsImg2}
                    isImage={isImage}
                    Inttype={Inttype}
                    type={2}
                    trimmedUrl={Inttype === 1 ? url1 : url2}
                    setTrimmedUrl={Inttype === 1 ? setUrl1 : setUrl2}
                    setShowTrim={() => { }}
                    setOpenIntMedia={setOpenIntMedia}
                    videoURL={sourceUrl}
                />
            )}
        </Box>
    );
};

export default IntMedia;
