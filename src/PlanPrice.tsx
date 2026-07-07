import React from "react";
import { Typography } from "@mui/material";

/** Gradient used in the text fill */
const GRADIENTx =
    "linear-gradient(90deg, #ff8a00 0%, #e52e71 100%)";

/** Plan identifiers */
export type PlanKey = "Kick-Start" | "Boost" | "Lite" | "Standard" | "Pro";

/** Slug helper (e.g. "Kick Start" â†’ "kickstart") */
const slug = (label: string) => label.replace(/[^a-z0-9]/gi, "").toLowerCase();

/** Canonical plan map */
const PLAN_BY_SLUG: Record<string, PlanKey> = {
    kickstart: "Kick-Start",
    boost: "Boost",
    lite: "Lite",
    standard: "Standard",
    pro: "Pro",
};

/** Pixel multipliers */
const PLAN_MULTIPLIER: Record<PlanKey, number> = {
    "Kick-Start": 1,
    Boost: 2.88,
    Lite: 5.52,
    Standard: 10.56,
    Pro: 20.16,
};

/** ----------------------  PixelCredits  ---------------------- */
interface PixelCreditsProps {
    /** Userâ€‘facing plan name (any variant, case or punctuation) */
    name: string;
    /** Baseline pixels for Kickâ€‘Start (defaults 333) */
    fluxPixels?: number;
}

/**
 * *PixelCredits* renders **only the credit count** with the gradient style.
 */
export const PixelCredits: React.FC<PixelCreditsProps> = ({
    name,
    fluxPixels = 333,
}) => {
    const canonical = PLAN_BY_SLUG[slug(name)] ?? (name as PlanKey);
    const multiplier = PLAN_MULTIPLIER[canonical] ?? 1;
    const pixels = Math.floor(fluxPixels * multiplier).toLocaleString();

    return (
        <span
            style={{
                background: GRADIENTx,
                WebkitBackgroundClip: "text",
                textShadow:
                    "0px 1px 2px rgba(0,0,0,0.12), 0px 2px 4px rgba(0,0,0,0.08)",
                WebkitTextFillColor: "transparent",
                fontWeight: 700,
                fontSize: "inherit",
            }}
        >
            {pixels} {" ."}P
        </span>
    );
};

/** ----------------------  PlanPrice  ---------------------- */
export interface PlanPriceProps {
    name: string;
    fluxPixels?: number;   // default 333
    fluxUnitCost?: number; // default $0.003
}

// profit curve coefficients
const PROFIT_A = 0.5;
const PROFIT_EXP = 0.135;

export const PlanPrice: React.FC<PlanPriceProps> = ({
    name,
    fluxPixels = 333,
    fluxUnitCost = 0.003,
}) => {
    const canonical = PLAN_BY_SLUG[slug(name)] ?? (name as PlanKey);
    const multiplier = PLAN_MULTIPLIER[canonical] ?? 1;

    const pixels = fluxPixels * multiplier;
    const cost = pixels * fluxUnitCost;
    const profit = PROFIT_A * Math.pow(multiplier, PROFIT_EXP);
    const price = cost + profit;

    if (process.env.NODE_ENV !== "production") {
        const tax = 0.3;
        const netProfit = profit - tax;

        const revenue = cost;            // Simplified: assuming revenue equals cost (you can also use `price`)
        const operatingCosts = 100;      // Estimated expenses (e.g., salaries, infra, etc.)
        const depreciation = 10;         // Depreciation of assets
        const interest = 5;              // Financing or interest expenses
        ///  const ebitda = revenue - operatingCosts;   // Earnings before interest, tax, depreciation, amortization
        const ebitda = cost;
        ///  const ebit = ebitda - depreciation;        // EBIT = operational earnings after depreciation
        const ebit = cost;
        const profitBeforeTax = ebit - interest;   // EBT = profit before tax

        console.log(`[Pricing Debug] ${canonical} â†’

â†’ Revenue           : $${revenue.toFixed(2)} â€” Total earnings before deductions (simplified as cost here)
â†’ Cost              : $${cost.toFixed(2)} â€” Total base cost to deliver the product (pixels Ã— unit cost)
â†’ EBITDA            : $${ebitda.toFixed(2)} â€” Profit before interest, tax, depreciation, and amortization
â†’ EBIT              : $${ebit.toFixed(2)} â€” EBITDA minus depreciation (reflects operational efficiency)
â†’ Profit Before Tax : $${profit.toFixed(2)} â€” Custom model profit (not directly from EBIT)
â†’ Tax               : $${tax.toFixed(2)} â€” Fixed placeholder tax used for estimation
â†’ Net Profit        : $${netProfit.toFixed(2)} â€” Final profit after tax
â†’ Final Price       : $${price.toFixed(2)} â€” What the customer is charged (cost + profit)

-----------------------------`);
    }


    return <span style={{ fontSize: '1.2rem' }}>{`$${price.toFixed(2)} `}</span>;
};

export default PixelCredits;
