export type ManualCharacterRatioKey = 1 | 2 | 3;

export type PreparedManualCharacterImage = {
  blob: Blob;
  previewUrl: string;
  ratioKey: ManualCharacterRatioKey;
  width: number;
  height: number;
};

export type ManualCharacterInput = {
  name: string;
  description: string;
  imageBlob: Blob;
};

export const normalizeManualCharacterName = (value: unknown): string =>
  String(value || "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^(the|an|a)\s+/, "");

export const toManualCharacterRatioKey = (ratioKey: unknown): ManualCharacterRatioKey => {
  const numericRatio = Number(ratioKey);
  if (numericRatio === 2) return 2;
  if (numericRatio === 3) return 3;
  return 1;
};

export const getManualCharacterDimensions = (ratioKey: unknown): {
  ratioKey: ManualCharacterRatioKey;
  width: number;
  height: number;
} => {
  const normalizedRatioKey = toManualCharacterRatioKey(ratioKey);

  if (normalizedRatioKey === 2) {
    return { ratioKey: normalizedRatioKey, width: 1080, height: 1080 };
  }

  if (normalizedRatioKey === 3) {
    return { ratioKey: normalizedRatioKey, width: 1920, height: 1080 };
  }

  return { ratioKey: normalizedRatioKey, width: 1080, height: 1920 };
};

const loadImageFromObjectUrl = (objectUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load the selected image."));
    img.src = objectUrl;
  });

const canvasToJpegBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to prepare the selected image."));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      0.9
    );
  });

export const prepareManualCharacterImage = async (
  file: File,
  ratioKey: unknown
): Promise<PreparedManualCharacterImage> => {
  if (!file) {
    throw new Error("No image file was selected.");
  }

  const sourceUrl = URL.createObjectURL(file);

  try {
    const img = await loadImageFromObjectUrl(sourceUrl);
    const dimensions = getManualCharacterDimensions(ratioKey);
    const canvas = document.createElement("canvas");
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Unable to prepare the selected image.");
    }

    const originalAspect = img.width / img.height;
    const desiredAspect = dimensions.width / dimensions.height;

    let drawWidth: number;
    let drawHeight: number;
    let offsetX = 0;
    let offsetY = 0;

    if (originalAspect > desiredAspect) {
      drawHeight = dimensions.height;
      drawWidth = drawHeight * originalAspect;
      offsetX = (dimensions.width - drawWidth) * 0.5;
    } else {
      drawWidth = dimensions.width;
      drawHeight = drawWidth / originalAspect;
      offsetY = (dimensions.height - drawHeight) * 0.5;
    }

    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

    const blob = await canvasToJpegBlob(canvas);
    const previewUrl = URL.createObjectURL(blob);

    return {
      blob,
      previewUrl,
      ratioKey: dimensions.ratioKey,
      width: dimensions.width,
      height: dimensions.height,
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
};
