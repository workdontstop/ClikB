import React from "react";
import { Typography, Box } from "@mui/material";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "./store";
import {
    getImageModelDisplayName,
    getImageModelPixelCost,
    type ImageModelKey,
} from "./imageModels";

/* -----------------------------------------------------------
 *  Model helpers
 * ---------------------------------------------------------- */

export type ModelKey = ImageModelKey;

/* -----------------------------------------------------------
 *  Post-processing costs (flat, per image)
 *
 *  These are charged at TRUE provider cost — no subsidy, no rounding down —
 *  so each button's P figure stays diagnostic about what that one call costs.
 *  Same base as MODEL_IPD above: 1 P = $1/333, cost = ceil(333 * dollars).
 * ---------------------------------------------------------- */

/**
 * Recraft Crisp Upscale (Replicate `recraft-ai/recraft-crisp-upscale`).
 * $0.004 per image -> ceil(333 * 0.004) = 2 P.
 * Charged on EVERY image model's Upscale button.
 */
export const UPSCALE_PIXELS = 2;

/**
 * Topaz denoise on fal (`fal-ai/topaz/upscale/image`, denoise-only config).
 * $0.08 for up to 24MP of OUTPUT. Run at upscale_factor 1 a GPT Image 2 frame is
 * ~2.09 MP out, far inside that first tier, so this is a flat:
 *   ceil(333 * 0.08) = 27 P.
 *
 * GPT Image 2 only. This is a rescue for a frame the user already likes but which
 * carries the model's grain — never an automatic pass.
 *
 * Why Topaz at 27 P over NAFNet at 16 P: NAFNet is trained on camera sensor noise
 * and offers no tuning. Topaz separates `denoise` from `fix_compression`, and this
 * artifact is not purely noise — tested side by side, Topaz was visibly better.
 * Replicate's Topaz build was the cheaper option at 17 P but exposes face
 * enhancement only, with no denoise parameter, so it cannot do this job at all.
 *
 * NOTE: denoise MUST still run before upscale. Topaz bills on OUTPUT megapixels, so
 * denoising an already-2x-upscaled frame pushes ~8.4 MP through and risks the next
 * price tier, for a worse result (upscaling grain bakes it in).
 * See DENOISE_UPSCALE_RESEARCH.md.
 */
export const DENOISE_PIXELS = 27;

/* -----------------------------------------------------------
 *  Pure helper: calculate pixels per image for a model
 * ---------------------------------------------------------- */
export interface ModelPixelsArgs {
    model: string;
    baseImagesPerDollar?: number; // defaults to 333
}

/** Returns the number of pixels that one image costs for the model */
export function calcModelPixels({
    model,
    baseImagesPerDollar = 333,
}: ModelPixelsArgs): number {
    const configuredCost = getImageModelPixelCost(model);
    if (configuredCost == null) return 1;
    return Math.ceil(configuredCost * (baseImagesPerDollar / 333));
}

/* -----------------------------------------------------------
 *  React component
 * ---------------------------------------------------------- */
interface ModelPixelsProps extends ModelPixelsArgs { }

export const ModelPixels: React.FC<ModelPixelsProps> = (props) => {
    const pixelsPerImage = calcModelPixels(props);

    /* ---------- dev-only console debug ---------- */
    if (process.env.NODE_ENV !== "production") {
        const canonical = getImageModelDisplayName(props.model);
        // eslint-disable-next-line no-console
        console.log(
            `[ModelPixels] ${canonical}: ${pixelsPerImage} P per image (base=${props.baseImagesPerDollar ?? 333
            })`
        );
    }

    /* ---------- theming ---------- */
    const darkMode = useSelector((state: RootState) => state.settings.darkMode);
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const appColor = (darkMode ? appColorDark : appColorLight)
        || (darkMode ? "#E8BAFA" : "#0099cc");
    const GRADIENTx = `linear-gradient(90deg, ${appColor} 0%, ${appColor} 100%)`;

    return (
        <Typography
            variant="h5"
            fontWeight={600}
            sx={{
                color: "white",

                fontWeight: 900,
                background: GRADIENTx,
                WebkitBackgroundClip: "text",
                textShadow:
                    "0px 1px 2px rgba(0,0,0,0.12), 0px 2px 4px rgba(0,0,0,0.08)",
                WebkitTextFillColor: "transparent",
            }}
        >
            {pixelsPerImage.toLocaleString()}
            <Box
                component="span"
                sx={{ fontSize: "0.5em", verticalAlign: "baseline" }}
            >
                {" "}
                P
            </Box>
        </Typography>
    );
};

export default ModelPixels;
