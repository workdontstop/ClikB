// src/components/ImageUploadComponent.tsx

import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";

// Define the types for props
interface ImageUploadProps {
    imageBase: any; // The base image file
    imageHD: any; // The high-definition image file
    triggerUpload: boolean; // State to trigger the upload
    onUploadComplete: (uploadedUrls: { baseUrl: string; hdUrl: string }) => void; // Callback after upload
}

// Define the response types from your API
interface SignedURLResponse {
    holder: Array<{
        urlBase: string;
        urlHD: string;
    }>;
}

const CLIK_URL = import.meta.env.VITE_CLIK_URL;

const ImageUploadComponent: React.FC<ImageUploadProps> = ({
    imageBase,
    imageHD,
    triggerUpload,
    onUploadComplete,
}) => {
    const [error, setError] = useState<string>("");
    const [isUploading, setIsUploading] = useState<boolean>(false);

    // Function to upload a single image
    const uploadSingleImage = useCallback(async (blob: Blob, signedUrl: string, contentType: string) => {
        try {
            const uploadResponse = await axios.put(signedUrl, blob, {
                headers: {
                    "Content-Type": contentType || "application/octet-stream",
                },
            });

            if (uploadResponse.status === 200) {
                // Extract the image URL by removing query parameters
                const imageUrl = signedUrl.split("?")[0];
                return imageUrl;
            } else {
                throw new Error(`Upload failed with status ${uploadResponse.status}`);
            }
        } catch (uploadError) {
            console.error("Error uploading image to S3:", uploadError);
            throw uploadError;
        }
    }, []);

    // Main upload function
    const uploadImagesToS3 = useCallback(async () => {
        if (!imageBase || !imageHD) {
            setError("Both images must be provided.");
            return;
        }

        setIsUploading(true);
        setError("");

        try {
            // Convert images to blobs
            const [blobBase, blobHD] = await Promise.all([
                imageBase && imageBase.size > 0 ? imageBase : Promise.reject(new Error("Base image is invalid.")),
                imageHD && imageHD.size > 0 ? imageHD : Promise.reject(new Error("HD image is invalid.")),
            ]);

            // Prepare the payload to request signed URLs
            const requestData = {
                values: { count: 2 },
            };

            // Request signed URLs from the server
            const signedUrlResponse = await axios.post<SignedURLResponse>(
                `${CLIK_URL}/get_signed_url_4upload_Explain`,
                requestData
            );

            const holder = signedUrlResponse.data.holder;

            if (!holder || holder.length !== 1) {
                throw new Error("Invalid signed URL response.");
            }

            const signedUrls = holder[0]; // Assuming the server returns one holder with both URLs

            if (!signedUrls.urlBase || !signedUrls.urlHD) {
                throw new Error("Missing signed URLs for images.");
            }

            // Upload both images
            const [uploadedBaseUrl, uploadedHdUrl] = await Promise.all([
                uploadSingleImage(blobBase, signedUrls.urlBase, imageBase.type),
                uploadSingleImage(blobHD, signedUrls.urlHD, imageHD.type),
            ]);

            // Notify the parent component with the uploaded URLs
            onUploadComplete({
                baseUrl: uploadedBaseUrl,
                hdUrl: uploadedHdUrl,
            });

            console.log("Both images uploaded successfully.");
        } catch (uploadError: any) {
            console.error("Error during image upload process:", uploadError);
            setError(uploadError.message || "An error occurred during the upload process.");
        } finally {
            setIsUploading(false);
        }
    }, [imageBase, imageHD, onUploadComplete, uploadSingleImage]);

    // Effect to trigger the upload when triggerUpload becomes true
    useEffect(() => {
        if (triggerUpload) {
            uploadImagesToS3();
        }
    }, [triggerUpload, uploadImagesToS3]);

    return (
        <div>
            {isUploading && <p>Uploading images...</p>}
            {error && <p style={{ color: "red" }}>Error: {error}</p>}
        </div>
    );
};

export default ImageUploadComponent;
