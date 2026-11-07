import axios from "axios";

const CLIK_URL = import.meta.env.VITE_CLIK_URL;

type NormalizeImageToS3Response = {
  imageUrl?: string;
  url?: string;
};

const uploadBlobUrlToS3 = async (sourceUrl: string): Promise<string> => {
  const blobResponse = await fetch(sourceUrl);
  if (!blobResponse.ok) {
    throw new Error("Failed to read local image blob.");
  }

  const blob = await blobResponse.blob();
  const signedResponse: any = await axios.post(
    `${CLIK_URL}/get_signed_url_imageStory`,
    { values: { count: 1 } },
    { withCredentials: true }
  );

  const signedUrl = signedResponse.data?.holder?.[0]?.urlHD;
  if (!signedUrl) {
    throw new Error("Failed to create image upload URL.");
  }

  await axios.put(signedUrl, blob, {
    headers: { "Content-Type": blob.type || "application/octet-stream" },
  });

  return signedUrl.split("?")[0];
};

export const normalizeImageUrlToS3 = async (
  sourceUrl: string,
  purpose = "downloaded-image"
): Promise<string> => {
  const trimmedSourceUrl = String(sourceUrl || "").trim();
  if (!trimmedSourceUrl) {
    throw new Error("Missing image URL.");
  }

  if (!CLIK_URL) {
    throw new Error("Missing API URL configuration.");
  }

  if (trimmedSourceUrl.startsWith("blob:")) {
    return uploadBlobUrlToS3(trimmedSourceUrl);
  }

  const response = await axios.post<NormalizeImageToS3Response>(
    `${CLIK_URL}/normalize-image-to-s3`,
    { sourceUrl: trimmedSourceUrl, purpose },
    { withCredentials: true, timeout: 120000 }
  );

  const normalizedUrl = response.data?.imageUrl || response.data?.url;
  if (!normalizedUrl) {
    throw new Error("Image download manager did not return a URL.");
  }

  return normalizedUrl;
};

export const downloadImageUrlAsBlob = async (sourceUrl: string): Promise<Blob> => {
  const trimmedSourceUrl = String(sourceUrl || "").trim();
  if (!trimmedSourceUrl) {
    throw new Error("Missing image URL.");
  }

  if (trimmedSourceUrl.startsWith("blob:") || trimmedSourceUrl.startsWith("data:")) {
    const response = await fetch(trimmedSourceUrl);
    if (!response.ok) {
      throw new Error("Failed to read local image data.");
    }
    return response.blob();
  }

  if (!CLIK_URL) {
    throw new Error("Missing API URL configuration.");
  }

  const response = await axios.post<Blob>(
    `${CLIK_URL}/download-image-for-client`,
    { sourceUrl: trimmedSourceUrl },
    { withCredentials: true, responseType: "blob", timeout: 120000 }
  );

  const contentType = String(response.headers["content-type"] || response.data?.type || "");
  const imageBlob = response.data instanceof Blob
    ? response.data
    : new Blob([response.data], { type: contentType });

  if (!imageBlob.size || !String(imageBlob.type || contentType).startsWith("image/")) {
    throw new Error("Image download manager did not return valid image data.");
  }

  return imageBlob;
};
