import React from "react";
import { Typography, Box } from "@mui/material";

import { useDispatch, useSelector } from "react-redux";
import { RootState } from "./store";






/**
 * Supported plan identifiers
 */
export type PlanKey = "Kick-Start" | "Boost" | "Lite" | "Standard" | "Pro";

/**
 * Multipliers that convert the baseline Fluxâ€‘Schnell pixel allotment (e.g. 333â€¯P)
 * to the pixel credits for each plan. Derived from your latest pricing table.
 *
 *  - Kickâ€‘Start : 333  px  â†’ multiplier  1
 *  - Boost      : 960  px  â†’ multiplier â‰ˆ2.88
 *  - Lite       : 1â€¯840 px â†’ multiplier â‰ˆ5.52
 *  - Standard   : 3â€¯520 px â†’ multiplier â‰ˆ10.56
 *  - Pro        : 6â€¯720 px â†’ multiplier â‰ˆ20.16
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
     * Plan name â€“ must be one of the defined keys.
     */
    name: PlanKey;
    /**
     * Baseline pixel allowance for Kickâ€‘Start (Fluxâ€‘Schnell images).
     * Example: 333 means the $1 (or $2.30) tier grants 333 images/credits.
     * Defaults to 333 if omitted.
     */
    fluxPixels?: number;
}

/**
 * Displays the plan label and the computed pixel credits using your gradient style.
 */
const PlanPixels: React.FC<any> = ({
    name,
    fluxPixels,
}) => {
    // Fall back to 1Ã— if an unknown plan name slips through
    const multiplier = PLAN_MULTIPLIER[name] ?? 1;

    // Final pixel count, rounded down to the nearest whole credit
    const pixels = Math.floor(fluxPixels * multiplier);

    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);



    /** Gradient used in the text fill */


    const GRADIENTx =
        darkModeReducer ?
            "linear-gradient(90deg, #F6BB56 0%, #F6BB56 100%)" :
            "linear-gradient(90deg, #ff8a00 0%, #e52e71 100%)";

    return (
        <>

            {/* Pixel credits */}
            <Typography
                variant="h4"
                fontWeight={700}
                style={{
                    background: GRADIENTx,
                    WebkitBackgroundClip: "text",
                    textShadow: darkModeReducer ? '0px 1px 2px rgba(0, 0, 0, 0), 0px 2px 4px rgba(0, 0, 0, 0)' :
                        `0px 1px 2px rgba(0, 0, 0, 0.12), 0px 2px 4px rgba(0, 0, 0, 0.08)`,
                    WebkitTextFillColor: "transparent",
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
