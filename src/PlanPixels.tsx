import React from "react";
import { Typography, Box } from "@mui/material";

import { useSelector } from "react-redux";
import { RootState } from "./store";






/**
 * Supported plan identifiers
 */
export type PlanKey = "Kick-Start" | "Boost" | "Lite" | "Standard" | "Pro";

/**
 * Multipliers that convert the baseline Flux‑Schnell pixel allotment (e.g. 333 P)
 * to the pixel credits for each plan. Derived from your latest pricing table.
 *
 *  - Kick‑Start : 333  px  → multiplier  1
 *  - Boost      : 960  px  → multiplier ≈2.88
 *  - Lite       : 1 840 px → multiplier ≈5.52
 *  - Standard   : 3 520 px → multiplier ≈10.56
 *  - Pro        : 6 720 px → multiplier ≈20.16
 */
const PLAN_MULTIPLIER: Record<any, number> = {
    "Kick-Start": 1,
    Boost: 2.88,
    Lite: 5.52,
    Standard: 10.56,
    Pro: 20.16,
};



export interface PlanPixelsProps {
    /**
     * Plan name – must be one of the defined keys.
     */
    name: PlanKey;
    /**
     * Baseline pixel allowance for Kick‑Start (Flux‑Schnell images).
     * Example: 333 means the $1 (or $2.30) tier grants 333 images/credits.
     * Defaults to 333 if omitted.
     */
    fluxPixels?: number;
}

/**
 * Displays pixel credits in the current accent on the neutral pricing panel.
 */
const PlanPixels: React.FC<any> = ({
    name,
    fluxPixels,
}) => {
    // Fall back to 1× if an unknown plan name slips through
    const multiplier = PLAN_MULTIPLIER[name] ?? 1;

    // Final pixel count, rounded down to the nearest whole credit
    const pixels = Math.floor(fluxPixels * multiplier);

    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);



    /** Gradient used in the text fill */


    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const primaryAccent = darkModeReducer ? appColorDark : appColorLight;
    return (
        <>

            {/* Pixel credits */}
            <Typography
                variant="h4"
                fontWeight={700}
                style={{
                    color: primaryAccent,
                }}
            >
                {pixels.toLocaleString()}
                <Box component="span" sx={{ fontSize: "0.5em", verticalAlign: "baseline" }}>
                    {' '}Pixels
                </Box>
            </Typography>
        </>
    );
};

export default PlanPixels;
