// CropImageModal.tsx
import { useState, useCallback, useEffect, CSSProperties } from "react";
import Cropper from "react-easy-crop";
import CloseIcon from "@mui/icons-material/Close";

import { Button, IconButton } from "@mui/material";
import { matchMobile } from "./DetectDevice";
import axios from "axios";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "./store";
import { updateProfilePic, updateBillboard } from "./profileSlice";
import {
    Box,
    Typography,
    CircularProgress,
    Card,
} from "@mui/material";
import zIndex from "@mui/material/styles/zIndex";

/**
 * Helper to crop the image using HTML canvas.
 * This returns a base64 string of the cropped area.
 */
async function getCroppedImg(
    imageSrc: string,
    pixelCrop: { x: number; y: number; width: number; height: number },
    typeVal: number
): Promise<string> {
    // Create the image






    const createImage = (url: string): Promise<HTMLImageElement> =>
        new Promise((resolve, reject) => {
            const image = new Image();
            // If your server or images require CORS:
            image.setAttribute("crossOrigin", "anonymous");
            image.src = url;
            image.onload = () => resolve(image);
            image.onerror = (err) => reject(err);
        });

    const image = await createImage(imageSrc);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No 2D context found.");

    /**
     * If typeVal == 1, override the final canvas to 729×540.
     * Otherwise, match the cropped area (the default).
     */
    if (typeVal === 1) {


        canvas.width = 960;
        canvas.height = 540;
    } else {
        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;
    }

    // Move the image so the top-left of the cropping area is (0,0)
    ctx.translate(-pixelCrop.x, -pixelCrop.y);
    ctx.drawImage(image, 0, 0);

    return canvas.toDataURL("image/jpeg");
}

interface CropImageModalProps {
    /** Whether the modal is open or not */
    isOpen: boolean;
    /** The full-size image (or object URL) to crop */
    imageUrl: string | null;
    /** Called when user clicks Save. Receives the final base64-cropped image. */
    setUserProfile: any;
    onClose: () => void;
    /** 0 => Square 1:1, 1 => 729x540 final resolution */
    typeVal?: number;
}

/**
 * A fullscreen overlay for cropping the image. 
 * The zoom/Save/Cancel area is partially hidden by style, 
 * but the core logic is unchanged.
 */
export function CropImageModal({
    isOpen,
    imageUrl,
    setUserProfile,
    onClose,
    typeVal = 0 // Default to 0 if not passed
}: CropImageModalProps) {



    const [loading, setLoading] = useState(false);

    const dispatch = useDispatch();

    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

    const CLIK_URL = import.meta.env.VITE_CLIK_URL;



    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
        x: number;
        y: number;
        width: number;
        height: number;
    } | null>(null);

    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);

    // Called whenever the user changes the crop/zoom
    const onCropComplete = useCallback((_croppedArea: any, croppedPixels: any) => {
        setCroppedAreaPixels(croppedPixels);
    }, []);

    // Called when user clicks "Save"
    const handleSave = useCallback(async (typeVal: any) => {
        if (!imageUrl || !croppedAreaPixels) return;
        try {
            // Pass typeVal along so getCroppedImg knows which resolution to use
            const croppedBase64 = await getCroppedImg(imageUrl, croppedAreaPixels, typeVal);
            ///onSave(croppedBase64);

            uploadCroppedImageToS3AndDb(croppedBase64, 0, typeVal);


        } catch (error) {
            console.error("Error cropping image:", error);
        }
    }, [imageUrl, croppedAreaPixels, typeVal]);

    /**
     * HISTORY BACK SUPPORT
     */
    useEffect(() => {
        const handlePopState = () => {
            onClose();
        };
        window.addEventListener("popstate", handlePopState);

        return () => {
            window.removeEventListener("popstate", handlePopState);
            if (isOpen) {
                // If you want, you can handle forward/back cleanup here
                // window.history.go(1);
            }
        };
    }, [isOpen, onClose]);

    /**
     * ESC KEY DETECTION
     */
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                window.history.back();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    // If the modal isn't open, don't render anything
    if (!isOpen) return null;

    function dataURLtoBlob(dataUrl: string): Blob {
        const parts = dataUrl.split(",");
        const mime = parts[0].match(/:(.*?);/)?.[1] || "image/jpeg";
        const binary = atob(parts[1]);
        const array = [];
        for (let i = 0; i < binary.length; i++) {
            array.push(binary.charCodeAt(i));
        }
        return new Blob([new Uint8Array(array)], { type: mime });
    }




    const GenerateSignedUrlForSingleImage = async (blob: Blob) => {
        if (!blob) throw new Error("No image Blob to generate a signed URL.");

        // Example request body:
        const requestData = { values: { count: 1 } };

        setLoading(true);

        const response: any = await axios.post(`${CLIK_URL}/get_signed_url_imageStory`, requestData, {
            withCredentials: true,
        });

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





    /**
   * Upload a cropped image to S3 + DB.
   * - If type=0 (default):
   *     1) Upload original cropped image -> S3 URL
   *     2) Create a thumbnail -> upload -> S3 URL (thumb)
   *     3) Save both to DB
   *
   * - If type=1:
   *     1) Upload the given image -> S3 URL (e.g. the thumbnail)
   *     2) Return S3 path
   */


    function createThumbnailBase64(base64: string, maxWidth: number): string {
        // Convert base64 -> Image in an offscreen canvas
        const img = new Image();
        img.src = base64;

        // We'll do this synchronously – you may want to wrap in a Promise if needed
        // so that you can wait for image.onload if the base64 isn't pre-decoded yet:
        // but usually the base64 is instantly decodable by the browser.

        // Determine new dimensions preserving aspect ratio
        const originalWidth = img.width;
        const originalHeight = img.height;

        if (originalWidth <= maxWidth) {
            // No need to scale if it's already smaller than maxWidth
            return base64;
        }

        const ratio = maxWidth / originalWidth;
        const newWidth = maxWidth;
        const newHeight = Math.round(originalHeight * ratio);

        const canvas = document.createElement("canvas");
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context not available.");

        // Draw scaled image
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        // Return new base64
        // Quality ~0.8 as an example – adjust to your taste
        return canvas.toDataURL("image/jpeg", 0.8);
    }



    async function uploadCroppedImageToS3AndDb(
        base64Image: string,
        type: number = 0, typeVal: any
    ): Promise<string> {
        try {
            // Convert base64 -> Blob
            const blob = dataURLtoBlob(base64Image);

            // Fetch a presigned URL for upload
            const signedUrls = await GenerateSignedUrlForSingleImage(blob);

            // Put the file to S3
            const s3Url = await PutSingleImageInS3WithURL(blob, signedUrls);

            console.log("Successfully uploaded type:", type, "URL:", s3Url);

            // If we're in type=1, we just return the final S3 URL (this might be a thumbnail)
            if (type === 1) {
                return s3Url;
            }

            // Otherwise, type=0 (original).
            // Next, create a thumbnail from the same base64
            const thumbBase64: any = createThumbnailBase64(base64Image, 200); // e.g. 200 px wide
            // Upload that as type=1
            const thumbS3Url: any = await uploadCroppedImageToS3AndDb(thumbBase64, 1, typeVal);

            // Now we have:
            //   - s3Url  (full-sized)
            //   - thumbS3Url (thumbnail)

            // Save both to DB:
            const result = await saveToDatabase(s3Url, thumbS3Url, typeVal);
            console.log("DB save result:", result);

            // Return the full-size S3 URL
            return s3Url;
        } catch (error) {
            setLoading(false);
            console.error("Error uploading single cropped image:", error);
            throw error;
        }
    }


    async function saveToDatabase(s3Url: string, s3UrlT: string, typeVal: any) {



        const dataToSave = {
            id: loggedUser ? loggedUser.id : null,
            images: s3Url,
            imagesT: s3UrlT,
        }

        var x = 'UpdateProfilePic';
        if (typeVal === 1) { x = 'UpdateBillboardPic' }


        axios.put(`${CLIK_URL}/${x}`, {
            values: dataToSave,
        })
            .then((response) => {
                console.log(response);


                if (typeVal === 1) {

                    setUserProfile((prev: any) => ({
                        ...prev,
                        billboardThumb: s3UrlT,
                        billboard: s3Url
                    }));

                    // 3) Dispatch the updated user back into Redux
                    dispatch(updateBillboard({ userbillboard1: s3Url, userbillboardthumb1: s3UrlT }));

                }

                else {
                    setUserProfile((prev: any) => ({
                        ...prev,
                        profilePic: s3Url,
                        profilePicThumb: s3UrlT,
                    }));

                    // 3) Dispatch the updated user back into Redux
                    dispatch(updateProfilePic({ image: s3Url, imageThumb: s3UrlT }));


                }

                setLoading(false);

                setTimeout(() => {

                    window.history.back();

                }, 500)


                ///   setStopText(false);

                //setdbLoad(false);

                ///setTimeout(() => { setcallFeeds(true); }, 500);

                ///setTimeout(() => { Close(); }, 1000);





            })
            .catch((error) => {
                //  handleCloseOverlay();
                setLoading(false);
                console.log(error);
            });

    }


    return (
        <div style={styles.overlay}>


            {loading && (
                <div
                    style={{
                        position: "fixed",
                        top: "0vh",
                        zIndex: 9999,

                        width: matchMobile ? "100%" : '100%',
                        left: matchMobile ? "0px" : '-0vw',
                        height: "100vh",
                        textAlign: "center",
                        color: '#ffffff',
                        backgroundColor: 'rgb(0,0,0,0.45)'
                    }}
                > <div
                    style={{

                        marginTop: "20vh",

                    }}
                >  Saving</div>  </div>
            )}



            {/* Close Icon in top-right */}
            <IconButton
                onClick={() => window.history.back()}
                sx={{
                    position: "fixed",
                    top: "2vh",
                    right: "4vw",
                    color: darkModeReducer ? "#ffffff" : "#000000",
                    zIndex: 300,
                    filter: darkModeReducer
                        ? "drop-shadow(2px 2px 4px rgba(0,0,0,0.7))"
                        : "drop-shadow(2px 2px 4px rgba(230,230,230,0.7))"
                }}
            >





                <CloseIcon style={{ fontSize: matchMobile ? "2rem" : "3rem", opacity: 0.3 }} />
            </IconButton>

            {/* Cropper area */}
            <div style={styles.cropperWrapper}>
                {imageUrl && (
                    <Cropper
                        image={imageUrl}
                        crop={crop}
                        zoom={zoom}
                        /**
                         * If typeVal == 1, let's use 729/540 => ~1.35 aspect
                         * Otherwise, default to 1:1
                         */
                        aspect={typeVal === 1 ? 960 / 540 : 1}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                        restrictPosition={false}
                        objectFit="contain"
                    />
                )}
            </div>

            {/* Save Button at the bottom */}
            <Button
                onClick={() => { handleSave(typeVal) }}
                variant="contained"
                color="primary"
                sx={{
                    width: "100%",
                    zIndex: 40,
                    bottom: matchMobile ? typeVal === 1 ? '4vh' : "7vh" : "0vh",
                    position: "fixed",
                    marginTop: "3px",
                    backgroundColor: darkModeReducer ? "#1e1e1e" : "#f5f5f5",
                    color: darkModeReducer ? "#ffffff" : "#000000",
                    px: 3,
                    py: 1.5,
                    borderRadius: 0,
                    boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.3)",
                    "&:hover": {
                        backgroundColor: darkModeReducer ? "#bbbbbb" : "#555555",
                        color: darkModeReducer ? "#000000" : "#ffffff",
                        boxShadow: "0px 6px 8px rgba(0, 0, 0, 0.2)"
                    }
                }}
            >
                Save
            </Button>

            {/* Hidden bottom bar (Zoom, Cancel, Save) */}
            <div style={{ display: "none" }}>
                <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    style={styles.slider}
                />

                <div style={styles.buttonRow}>
                    <button style={styles.cancelBtn} onClick={onClose}>
                        Cancel
                    </button>
                    <button style={styles.saveBtn} onClick={handleSave}>
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
}

const styles: { [key: string]: CSSProperties } = {
    overlay: {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0,0,0,0.9)",
        zIndex: 9999999,
        display: "flex",
        flexDirection: "column"
    },
    cropperWrapper: {
        flex: 1,
        position: "relative",
        width: "100%"
    },
    slider: {
        width: "200px",
        marginBottom: "0.5rem"
    },
    buttonRow: {
        display: "flex",
        gap: "1rem",
        justifyContent: "center"
    },
    cancelBtn: {
        backgroundColor: "#999",
        color: "#fff",
        padding: "0.5rem 1rem",
        border: "none",
        cursor: "pointer"
    },
    saveBtn: {
        backgroundColor: "#007bff",
        color: "#fff",
        padding: "0.5rem 1rem",
        border: "none",
        cursor: "pointer"
    }
};
