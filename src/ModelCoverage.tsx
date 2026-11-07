import React, { useId } from "react";
import { ButtonBase } from "@mui/material";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import { ACTIVE_IMAGE_MODEL_KEYS, IMAGE_MODEL_REGISTRY } from "./imageModels";
import { pricingAccentStyle } from './pricingAccentStyles';

/* ========================================= CONSTANTS */


const PLAN_MULTIPLIER = {
  "Kick-Start": 1,
  Boost: 2.88,
  Lite: 5.52,
  Standard: 10.56,
  Pro: 20.16,
} as const;
type PlanKey = keyof typeof PLAN_MULTIPLIER;

/* ========================================= HELPERS */
const normalizePlan = (label: string): PlanKey => {
  const s = label.replace(/[^a-z0-9]/gi, "").toLowerCase();
  switch (s) {
    case "kickstart":
      return "Kick-Start";
    case "boost":
      return "Boost";
    case "lite":
      return "Lite";
    case "standard":
      return "Standard";
    default:
      return "Pro";
  }
};



/* ========================================= COMPONENT */
interface Props {
  name: string;              // plan label (any variant)
  fluxPixels?: number;       // baseline credits for Kick‑Start (defaults 333)
  baseImagesPerDollar?: number; // default 333
  expanded: boolean;
  onToggle: () => void;
}

const ModelCoverage: React.FC<Props> = ({
  name,
  fluxPixels = 333,
  baseImagesPerDollar = 333,
  expanded,
  onToggle,
}) => {
  const planKey = normalizePlan(name);
  const totalPixels = PLAN_MULTIPLIER[planKey] * fluxPixels;
  const listId = useId();

  const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);


    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const primaryAccent = darkModeReducer ? appColorDark : appColorLight;
  const accentFill = pricingAccentStyle(primaryAccent, darkModeReducer);





  /* ---------- RETURN (inline, auto‑height, 100% text width) ---------- */
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 6, width: '100%' }}>
      <span
        id={listId}
        role="region"
        aria-label={`${planKey} model coverage`}
        tabIndex={0}
        style={{
          display: "inline-flex",
          flexDirection: "column",
          overflowX: "hidden",
          overflowY: "auto",
          maxHeight: expanded ? "min(50vh, 30rem)" : "14.5vh",
          gap: 6,
          width: "100%",
          scrollbarWidth: "thin",
        }}
      >
        {ACTIVE_IMAGE_MODEL_KEYS.map((modelKey) => {
          const model = IMAGE_MODEL_REGISTRY[modelKey];
          const scaledPixelCost = Math.ceil(model.pixelCost * (baseImagesPerDollar / 333));
          const imgCount = Math.floor(totalPixels / scaledPixelCost);
          return (
            <ButtonBase
              key={modelKey}
              type="button"
              data-model-pill={modelKey}
              aria-expanded={expanded}
              aria-controls={listId}
              title={`${expanded ? 'Compact' : 'Expand'} all model lists`}
              onClick={onToggle}
              sx={{ '&.Mui-focusVisible': { outline: '2px solid currentColor', outlineOffset: -3 } }}
              style={{
                ...accentFill,
                borderRadius: 9999,
                padding: expanded ? "12px 16px" : "8px 16px",
                whiteSpace: "normal",
                overflowWrap: "anywhere",
                fontSize: expanded ? 18 : 14,
                fontWeight: 700,
                flexShrink: 0,
                display: 'block',
                textAlign: 'inherit',
                fontFamily: 'inherit',
                lineHeight: 'inherit',
              }}
            >
              <span>{model.displayName}:&nbsp;</span>



              <span
                style={{
                  color: 'inherit',
                  fontWeight: 700,
                }}
              >
                {imgCount.toLocaleString()} images
              </span>
            </ButtonBase>
          );
        })}
      </span>
    </span>
  );

};

export default ModelCoverage;
