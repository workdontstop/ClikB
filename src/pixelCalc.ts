// pixelCalc.ts
export type RoundingMode = "round" | "floor" | "ceil" | "none";

export interface CommonInputs {
    seconds: number;              // t
    imagesPerDollar?: number;     // I$ (default 333)
    pixelsPerImage?: number;      // k  (default 1)
    rounding?: RoundingMode;      // default "round"
}

export interface ExactRateInputs extends CommonInputs {
    dollarsPerSecond?: number;    // r   (default 0.036 $/s)
}

export interface ApproxRateInputs extends CommonInputs {
    secondsPerDollar?: number;    // ~27 s/$
}

export interface PixelCalcResult {
    pixels: number;               // p
    images: number;               // n
    costDollars: number;          // d
    imagesPerSecond: number;      // Î±
}

const applyRounding = (x: number, mode: RoundingMode): number => {
    switch (mode) {
        case "floor": return Math.floor(x);
        case "ceil": return Math.ceil(x);
        case "none": return x;
        case "round":
        default: return Math.round(x);
    }
};

export function pixelsFromSecondsExact({
    seconds,
    imagesPerDollar = 333,
    dollarsPerSecond = 0.036,
    pixelsPerImage = 1,
    rounding = "round",
}: ExactRateInputs): PixelCalcResult {
    const alpha = imagesPerDollar * dollarsPerSecond; // images/s
    const imagesRaw = alpha * seconds;                // n
    const pixelsRaw = pixelsPerImage * imagesRaw;     // p
    const cost = dollarsPerSecond * seconds;          // d

    const images = applyRounding(imagesRaw, rounding);
    const pixels = applyRounding(pixelsRaw, rounding);

    return { pixels, images, costDollars: cost, imagesPerSecond: alpha };
}

export function pixelsFromSecondsApprox({
    seconds,
    imagesPerDollar = 333,
    secondsPerDollar = 27,
    pixelsPerImage = 1,
    rounding = "round",
}: ApproxRateInputs): PixelCalcResult {
    const alpha = imagesPerDollar / secondsPerDollar; // images/s
    const imagesRaw = alpha * seconds;                // n
    const pixelsRaw = pixelsPerImage * imagesRaw;     // p
    const cost = seconds / secondsPerDollar;          // d

    const images = applyRounding(imagesRaw, rounding);
    const pixels = applyRounding(pixelsRaw, rounding);

    return { pixels, images, costDollars: cost, imagesPerSecond: alpha };
}
