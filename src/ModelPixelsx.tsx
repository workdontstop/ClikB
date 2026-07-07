import React from "react";
import { Typography, Box } from "@mui/material";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "./store";

/* -----------------------------------------------------------
*  Model helpers
* ---------------------------------------------------------- */

export type ModelKey =
    | "schnell"
    | "Hi Dream"
    | "minimax"
    | "Gpt Image"
    | "Imagen"
    | "fluxUltra"
    | "seeDream"
    | "fluxDev"
    | "Kontext"
    | "Bannana"
    | "Imagenx"
    | "Bannana2"
    | "fluxUltra2"
    | "minimax2"
    | "Imagen2";


/** Images produced per US $1 for each model */
const MODEL_IPD: Record<ModelKey, number> = {
    schnell: 333,
    "Hi Dream": 120,
    minimax: 25, ///seadream
    /*
    * Text tokens (per 1M): $5.00 input, $1.25 cached, $10.00 output. Image tokens (per 1M): $8.00 input, $2.00 cached, $30.00 output.
    * Changing the quality parameter significantly affects cost; by default we use high. Adjust it to your preference.
    * See the description at the bottom of this page for more details on how much canonical image sizes cost. Token cost is ceiled to the closest cent.
    * (Using Medium quality mode)
    */
    "Gpt Image": 20,
    Imagen: 7,
    Imagenx: 16,
    fluxUltra: 10,
    seeDream: 33,
    fluxDev: 40, ///Reve
    Kontext: 4,
    Bannana: 6,
    Bannana2: 25,
    fluxUltra2: 6,
    minimax2: 33,
    Imagen2: 25,
};

const modelSlug = (label: string) =>
    label.replace(/[^a-z0-9]/gi, "").toLowerCase();

const MODEL_BY_SLUG: Record<string, ModelKey> = {
    schnell: "schnell",
    hidream: "Hi Dream",
    minimax: "minimax",
    gptimage: "Gpt Image",
    imagen: "Imagen",
    fluxultra: "fluxUltra",
    seedream: "seeDream",
    fluxdev: "fluxDev",
    kontext: "Kontext",
    Bannana: 'Bannana',
    Bannana2: 'Bannana2',
    Imagenx: 'Imagenx',
    fluxUltra2: "fluxUltra2",
    minimax2: "minimax2",
    imagen2: "Imagen2",
};
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
    const canonical = MODEL_BY_SLUG[modelSlug(model)] ?? (model as ModelKey);
    const imagesPerDollar = MODEL_IPD[canonical];

    // fallback: 1 pixel if model not found
    return imagesPerDollar
        ? Math.ceil(baseImagesPerDollar / imagesPerDollar)
        : 1;
}

/* -----------------------------------------------------------
*  React component
* ---------------------------------------------------------- */
interface ModelPixelsProps extends ModelPixelsArgs { }

export const ModelPixelsx: React.FC<ModelPixelsProps> = (props) => {
    const pixelsPerImage = calcModelPixels(props);

    /* ---------- dev-only console debug ---------- */
    if (process.env.NODE_ENV !== "production") {
        const canonical = MODEL_BY_SLUG[modelSlug(props.model)] ?? (props
            .model as ModelKey);
        // eslint-disable-next-line no-console
        console.log(
            `[ModelPixelsx] ${canonical}: ${pixelsPerImage} P per image (base=${props.baseImagesPerDollar ?? 333
            })`
        );
    }

    /* ---------- theming ---------- */
    const darkMode = useSelector((state: RootState) => state.settings.darkMode);
    const GRADIENTx = darkMode
        ? "linear-gradient(90deg, #F6BB56 0%, #F6BB56 100%)"
        : "linear-gradient(90deg, #ff8a00 0%, #e52e71 100%)";

    return (
        <Typography
            variant="h5"
            fontWeight={600}
            sx={{
                /// color: "white",
                textAlign: "left",
                fontWeight: 900,

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

export default ModelPixelsx;
