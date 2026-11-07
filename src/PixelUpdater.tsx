// PixelUpdater.tsx
import React, { useEffect, useMemo } from "react";
import { VIDEO_UPSCALE_RATES, type VideoUpscaleResolution } from '../server/src/videoUpscaleSpec';
import { falH3Dollars } from '../server/src/falH3Spec';
import {
    pixelsFromSecondsExact,
    pixelsFromSecondsApprox,
    type PixelCalcResult,
    type RoundingMode,
} from "./pixelCalc";

export type PlanName = "Mini" | "Pro" | "Minix" | "SeedanceMini" | "Prox" | "Proxx" | "Proxxx" | "FalH3" | "pPro" | "Omni" | "GeminiOmni" | "ByteDanceUpscale";

// Provider output resolution used for the selected plan.
type Resolution = "480p" | "540p" | "720p" | "768p" | "1080p" | "2K";

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

    musicKling: any; // Treat as boolean
    referenceImageCount?: number;
    referenceVideoActive?: boolean;
    quotedDollars?: number;
    resolution?: "480p" | "720p";
    upscaleResolution?: VideoUpscaleResolution;
}

/**
 * Headless component: computes pixels/images/cost and pushes result up via onChange().
 * Recomputes whenever seconds / plan / method / other inputs change.
 */
const PixelUpdater: React.FC<PixelUpdaterProps> = ({
    upscaleResolution = "1080p",
    seconds,
    plan,
    method = "exact",
    imagesPerDollar = 333,
    pixelsPerImage = 1,
    rounding = "round",
    onChange,
    musicKling,
    referenceImageCount = 0,
    referenceVideoActive = false,
    quotedDollars,
    resolution = "720p",
}) => {



    // MiniMax H3 on fal. Published tiers (checked 2026-08-25):
    //   480P $0.05/s   768P $0.06/s   2K $0.13/s   4K $0.16/s
    // The backend translates the standardized lowercase UI value to fal's 480P/768P
    // enum for every H3 mode (text, image, and reference).
    const H3_DOLLARS_PER_SECOND = resolution === "480p" ? 0.05 : 0.06;

    // PixVerse V6 has no native 480p tier. The standardized 480p UI choice maps
    // to its nearest cost-saving tier, 540p.
    const PROX_RATES = resolution === "480p"
        ? { off: 0.035, on: 0.045 }
        : { off: 0.045, on: 0.060 };


    // Seedance 2.5 (bytedance/seedance-2.5 on Replicate), 480p/720p non_video_in variant.
    // Verified 2026-08-10 from replicate.com/bytedance/seedance-2.5.
    // Replicate prices this model by input variant and resolution, NOT by audio, so there
    // is no audio-dependent pair here — the audio toggle stays functional but no longer
    // moves the price.
    //   480p non_video_in $0.1028   |  720p non_video_in $0.2312
    //   480p video_in     $0.4304   |  720p video_in     $0.9676
    // Attaching a reference video moves the provider to the `video_in` variant. That
    // variant is included in the quote for both standard and spatial generation.
    const PPRO_DOLLARS_PER_SECOND = referenceVideoActive ? (resolution === '480p' ? 0.4304 : 0.9676) : (resolution === "480p" ? 0.1028 : 0.2312);

    // Replicate Seedance 2.0 family rates include the selected reference-video variant.
    const SEEDANCE_2_RATES = {
        mini: referenceVideoActive ? (resolution === '480p' ? .05 : .11) : (resolution === "480p" ? 0.04 : 0.09),
        fast: referenceVideoActive ? (resolution === '480p' ? .08 : .17) : (resolution === "480p" ? 0.07 : 0.15),
        standard: referenceVideoActive ? (resolution === '480p' ? .10 : .22) : (resolution === "480p" ? 0.08 : 0.18),
    };

    // FLUX 3 (black-forest-labs/flux-3 on Replicate), 720p image-to-video.
    // Published rates key on quality tier and resolution only — there is no audio axis,
    // so these apply whether the user leaves audio on or off.

    // Replicate Seedance 1.5 Pro rates, priced per output second.
    const PROXX_RATES = resolution === "480p"
        ? { off: 0.013, on: 0.025 }
        : { off: 0.026, on: 0.052 };


    const PLAN_CONFIG: Record<PlanName, PlanConfig> = {
        // Single-rate plans
        Mini: {
            // Replicate charges the same rate for Grok 1.5 at 480p and 720p,
            // so the standardized low-resolution UI choice still renders 720p.
            resolution: "720p",
            pricing: { dollarsPerSecond: 0.08, secondsPerDollar: 12.5 },
        },
        Minix: {
            resolution,
            pricing: { dollarsPerSecond: SEEDANCE_2_RATES.fast, secondsPerDollar: 1 / SEEDANCE_2_RATES.fast },
        },
        SeedanceMini: {
            resolution,
            pricing: { dollarsPerSecond: SEEDANCE_2_RATES.mini, secondsPerDollar: 1 / SEEDANCE_2_RATES.mini },
        },
        Pro: {
            resolution,
            pricing: { dollarsPerSecond: SEEDANCE_2_RATES.standard, secondsPerDollar: 1 / SEEDANCE_2_RATES.standard },
        },

        // Prox: PixVerse 6. UI 480p maps to the provider's supported 540p tier.
        Prox: {
            resolution: resolution === "480p" ? "540p" : "720p",
            pricing: {
                dollarsPerSecond: musicKling ? PROX_RATES.on : PROX_RATES.off,
                secondsPerDollar: 1 / (musicKling ? PROX_RATES.on : PROX_RATES.off),
            },
        },

        // Proxx: Seedance 1.5 Pro dynamic rate based on resolution and audio.
        Proxx: {
            resolution,
            pricing: {
                dollarsPerSecond: musicKling ? PROXX_RATES.on : PROXX_RATES.off,
                secondsPerDollar: 1 / (musicKling ? PROXX_RATES.on : PROXX_RATES.off),
            },
        },

        // Proxxx: MiniMax H3 (480p/768p, native stereo audio included)
        Proxxx: {
            resolution: resolution === "480p" ? "480p" : "768p",
            pricing: { dollarsPerSecond: H3_DOLLARS_PER_SECOND, secondsPerDollar: 1 / H3_DOLLARS_PER_SECOND },
        },
        FalH3: {
            resolution: resolution === '480p' ? '480p' : '768p',
            pricing: { dollarsPerSecond: resolution === '480p' ? .05 : .08, secondsPerDollar: 1 / (resolution === '480p' ? .05 : .08) },
        },

        // pPro: Seedance 2.5 (480p/720p). Replicate does not price this model on audio.
        pPro: {
            resolution,
            pricing: {
                dollarsPerSecond: PPRO_DOLLARS_PER_SECOND,
                secondsPerDollar: 1 / PPRO_DOLLARS_PER_SECOND,
            }
        },

        // --- NEW PLAN Omni: bytedance/omni-human-1.5 (720p, audio-driven lip-sync) ---
        // Flat $0.16 per second of output video (audio is always supplied).
        Omni: {
            resolution: "720p",
            pricing: { dollarsPerSecond: 0.16, secondsPerDollar: 1 / 0.16 },
        },

        // Google Gemini Omni Flash reference-to-video. FAL currently exposes
        // 720p output only and estimates approximately $0.13 per output second.
        GeminiOmni: {
            resolution: "720p",
            pricing: {
                dollarsPerSecond: 0.13,
                secondsPerDollar: 1 / 0.13,
            },
        },

        // ByteDance Standard video upscale: 1080p at 60 FPS.
        // Replicate charges $0.013773 per output second for these settings.
        ByteDanceUpscale: {
            resolution: upscaleResolution === "2k" ? "2K" : "1080p",
            pricing: {
                dollarsPerSecond: VIDEO_UPSCALE_RATES[upscaleResolution],
                secondsPerDollar: 1 / VIDEO_UPSCALE_RATES[upscaleResolution],
            },
        },
    };

    const cfg = PLAN_CONFIG[plan];

    // Resolve the provider's base per-second rate.
    const dollarsPerSecond = useMemo(() => {
        if (isPackRates((cfg as any).pricing)) {
            const key = choosePackKeyForPlan(seconds, plan);
            const p = (cfg as any).pricing as PackRates;
            return p.dollarsPerSecond[key]!;
        }
        const p = (cfg as any).pricing as SingleRate;
        return p.dollarsPerSecond;
    }, [cfg, plan, seconds]);

    // Fal H3 reference pricing: the first five reference images are free, then $0.08 each
    // — fal's own figure, and it does not move with resolution.
    //
    // Base H3 publishes no separate reference-video surcharge. Do not apply H3 Max's
    // token-based input pricing to this different model.
    const h3ReferenceSurchargeDollars = plan === "Proxxx"
        ? Math.max(0, Math.min(9, Number(referenceImageCount) || 0) - 5) * 0.08
        : 0;
    const effectiveDollarsPerSecond = plan === 'FalH3' ? (quotedDollars ?? falH3Dollars(seconds, resolution, referenceImageCount, Number(referenceVideoActive))) / Math.max(.92, seconds) : dollarsPerSecond
        + (seconds > 0 ? h3ReferenceSurchargeDollars / seconds : 0);
    const effectiveSecondsPerDollar = 1 / effectiveDollarsPerSecond;

    const result = useMemo(() => {
        return method === "exact"
            ? pixelsFromSecondsExact({
                seconds,
                imagesPerDollar,
                dollarsPerSecond: effectiveDollarsPerSecond,
                pixelsPerImage,
                rounding,
            })
            : pixelsFromSecondsApprox({
                seconds,
                imagesPerDollar,
                secondsPerDollar: effectiveSecondsPerDollar,
                pixelsPerImage,
                rounding,
            });
    }, [
        seconds,
        method,
        imagesPerDollar,
        pixelsPerImage,
        rounding,
        effectiveDollarsPerSecond,
        effectiveSecondsPerDollar,
    ]);

    useEffect(() => {
        onChange({
            ...result,
            plan,
            method,
            resolution: (cfg as any).resolution as Resolution,
        });
    }, [result, onChange, plan, method, (cfg as any).resolution, seconds]);

    return null;
};

export default PixelUpdater;
