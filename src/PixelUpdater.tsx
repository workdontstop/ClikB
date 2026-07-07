// PixelUpdater.tsx
import React, { useEffect, useMemo } from "react";
import {
    pixelsFromSecondsExact,
    pixelsFromSecondsApprox,
    type PixelCalcResult,
    type RoundingMode,
} from "./pixelCalc";

// 1. Added "pPro" to the type definition
export type PlanName = "Mini" | "Pro" | "Minix" | "Prox" | "Proxx" | "Proxxx" | "pPro" | "Omni";

// Allow 720p, 768p, or 1080p
type Resolution = "720p" | "768p" | "1080p";

// Single flat rate
type SingleRate = {
    dollarsPerSecond: number;
    secondsPerDollar: number;
};

// Pack-based rates (allow 5, 6 or 10 depending on plan)
type PackRates = {
    dollarsPerSecond: Partial<Record<5 | 6 | 10, number>>;
    secondsPerDollar: Partial<Record<5 | 6 | 10, number>>;
};

type PlanConfig =
    | { resolution: Resolution; pricing: SingleRate }
    | { resolution: Resolution; pricing: PackRates };

const isPackRates = (p: SingleRate | PackRates): p is PackRates =>
    (p as any).dollarsPerSecond && typeof (p as any).dollarsPerSecond === "object";

/** Generic nearest helper that preserves literal types */
const chooseNearest = <T extends number>(seconds: number, arr: readonly T[]): T => {
    let best = arr[0];
    let bestDist = Math.abs(seconds - best);
    for (let i = 1; i < arr.length; i++) {
        const k = arr[i];
        const d = Math.abs(seconds - k);
        if (d < bestDist || (d === bestDist && k < best)) {
            best = k;
            bestDist = d;
        }
    }
    return best;
};

// Plan-aware pack chooser
const choosePackKeyForPlan = (seconds: number, plan: PlanName): 5 | 6 | 10 => {
    const available =
        plan === "Prox" ? ([5, 10] as const) :
            plan === "Proxx" ? ([5, 10] as const) :
                ([5, 10] as const); // fallback

    return chooseNearest(seconds, available);
};


export interface PixelUpdaterProps {
    seconds: number; // t
    plan: PlanName;
    method?: "exact" | "approx"; // default "exact"
    imagesPerDollar?: number; // default 333
    pixelsPerImage?: number;  // default 1
    rounding?: RoundingMode;  // default "round"
    /** Called whenever result changes */
    onChange: (result: PixelCalcResult & {
        plan: PlanName;
        method: "exact" | "approx";
        resolution: Resolution;

    }) => void;

    musicKling: any // Treat as boolean
}

/**
 * Headless component: computes pixels/images/cost and pushes result up via onChange().
 * Recomputes whenever seconds / plan / method / other inputs change.
 */
const PixelUpdater: React.FC<PixelUpdaterProps> = ({
    seconds,
    plan,
    method = "exact",
    imagesPerDollar = 333,
    pixelsPerImage = 1,
    rounding = "round",
    onChange,
    musicKling
}) => {



    const PROXXX_RATES = {
        off: 0.0466666666666667,   // Hailuo 2.3 768p (0.28 / 6)
        on: 0.0466666666666667,    // Hailuo 2.3 768p (no audio supported)
    };

    const PROX_RATES = {
        off: 0.045, // Without Audio ($0.045/s for 720p)
        on: 0.060,  // With Audio ($0.060/s for 720p)
    };


    // Kling 3 Pro pricing from fal.ai.
    const PPRO_RATES = {
        off: 0.112, // Native audio disabled
        on: 0.168,  // Native audio enabled
    };

    const PROXX_RATES = {
        off: 0.026, // Seedance 1.5 Pro (Without Audio)
        on: 0.052,  // Seedance 1.5 Pro (With Audio)
    };

    const PLAN_CONFIG: Record<PlanName, PlanConfig> = {
        // Single-rate plans
        Mini: {
            resolution: "720p",
            pricing: { dollarsPerSecond: 0.08, secondsPerDollar: 12.5 },
        },
        Minix: {
            resolution: "720p",
            pricing: { dollarsPerSecond: 0.10, secondsPerDollar: 1 },
        },
        Pro: {
            resolution: "720p",
            pricing: { dollarsPerSecond: 0.18, secondsPerDollar: 1 / 0.18 },
        },

        // Prox: PixVerse 6 (720p) dynamic rate based on audio
        Prox: {
            resolution: "720p",
            pricing: {
                dollarsPerSecond: musicKling ? PROX_RATES.on : PROX_RATES.off,
                secondsPerDollar: 1 / (musicKling ? PROX_RATES.on : PROX_RATES.off),
            },
        },

        // Proxx: Seedance 1.5 Pro (720p) dynamic rate based on audio
        Proxx: {
            resolution: "720p",
            pricing: {
                dollarsPerSecond: musicKling ? PROXX_RATES.on : PROXX_RATES.off,
                secondsPerDollar: 1 / (musicKling ? PROXX_RATES.on : PROXX_RATES.off),
            },
        },

        // Proxxx: Hailuo 2.3 (768p)
        Proxxx: {
            resolution: "768p",
            pricing: {
                dollarsPerSecond: musicKling ? PROXXX_RATES.on : PROXXX_RATES.off,
                secondsPerDollar: 1 / (musicKling ? PROXXX_RATES.on : PROXXX_RATES.off),
            },
        },

        // --- NEW PLAN pPro ---
        pPro: {
            resolution: "720p", // Defaulting to 720p unless specified otherwise
            pricing: {
                dollarsPerSecond: musicKling ? PPRO_RATES.on : PPRO_RATES.off,
                secondsPerDollar: 1 / (musicKling ? PPRO_RATES.on : PPRO_RATES.off),
            }
        },

        // --- NEW PLAN Omni: bytedance/omni-human-1.5 (720p, audio-driven lip-sync) ---
        // Flat $0.16 per second of output video (audio is always supplied).
        Omni: {
            resolution: "720p",
            pricing: { dollarsPerSecond: 0.16, secondsPerDollar: 1 / 0.16 },
        }
    };

    const cfg = PLAN_CONFIG[plan];

    // Resolve the correct per-second / per-dollar rate
    const { dollarsPerSecond, secondsPerDollar } = useMemo(() => {
        if (isPackRates((cfg as any).pricing)) {
            const key = choosePackKeyForPlan(seconds, plan);
            const p = (cfg as any).pricing as PackRates;
            return {
                dollarsPerSecond: p.dollarsPerSecond[key]!,
                secondsPerDollar: p.secondsPerDollar[key]!,
            };
        }
        const p = (cfg as any).pricing as SingleRate;
        return {
            dollarsPerSecond: p.dollarsPerSecond,
            secondsPerDollar: p.secondsPerDollar,
        };
    }, [cfg, plan, seconds]);

    const result = useMemo(() => {
        return method === "exact"
            ? pixelsFromSecondsExact({
                seconds,
                imagesPerDollar,
                dollarsPerSecond,
                pixelsPerImage,
                rounding,
            })
            : pixelsFromSecondsApprox({
                seconds,
                imagesPerDollar,
                secondsPerDollar,
                pixelsPerImage,
                rounding,
            });
    }, [
        seconds,
        method,
        imagesPerDollar,
        pixelsPerImage,
        rounding,
        dollarsPerSecond,
        secondsPerDollar,
    ]);

    useEffect(() => {
        onChange({
            ...result,
            plan,
            method,
            resolution: (cfg as any).resolution as Resolution,
        });
    }, [result, onChange, plan, method, (cfg as any).resolution]);

    return null;
};

export default PixelUpdater;
