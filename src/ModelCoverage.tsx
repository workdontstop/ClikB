import React from "react";
import PlanPixels from "./PlanPixels";

import { matchMobile } from "./DetectDevice";
import { dark } from "@mui/material/styles/createPalette";
import { DarkMode } from "@mui/icons-material";

import { useDispatch, useSelector } from "react-redux";
import { RootState } from "./store";

/* ========================================= CONSTANTS */


const PLAN_MULTIPLIER = {
  "Kick-Start": 1,
  Boost: 2.88,
  Lite: 5.52,
  Standard: 10.56,
  Pro: 20.16,
} as const;
type PlanKey = keyof typeof PLAN_MULTIPLIER;

const MODEL_IPD = {
  Schnell: 333,
  "Hi Dream": 120,
  minimax: 25,
  "Gpt Image 1.5": 20,
  Imagen: 24,
  FluxMax: 10,
  seeDream: 25,
  BananaPro: 6,
  FluxFlex: 4,
} as const;
type ModelKey = keyof typeof MODEL_IPD;

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



const pixelsPerImage = (m: ModelKey, base: number) => Math.ceil(base / MODEL_IPD[m]);

/* ========================================= COMPONENT */
interface Props {
  name: string;              // plan label (any variant)
  fluxPixels?: number;       // baseline credits for Kickâ€‘Start (defaults 333)
  baseImagesPerDollar?: number; // default 333
}

const ModelCoverage: React.FC<Props> = ({
  name,
  fluxPixels = 333,
  baseImagesPerDollar = 333,
}) => {
  const planKey = normalizePlan(name);
  const totalPixels = PLAN_MULTIPLIER[planKey] * fluxPixels;

  const modelsxxx: ModelKey[] = [
    "Schnell",
    "Hi Dream",
    "minimax",
    "seeDream",
    "FluxFlex",
    "FluxMax",
    "Imagen",
    "Gpt Image 1.5",
  ];



  const models: ModelKey[] = [
    "Schnell",
    "minimax",
    "Gpt Image 1.5",
    "FluxMax",
    "BananaPro",
    "FluxFlex",

  ];


  const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);


  const GRADIENTx =

    darkModeReducer ? 'linear-gradient(90deg,#F6BB56 0%,#e52e71 100%)' :
      "linear-gradient(90deg,#ff8a00 10%,#ffffff 80%)";





  /* ---------- RETURN (inline, autoâ€‘height, 100% text width) ---------- */
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
      {/* vertical scrollable list max-height 20 vh */}
      <span
        style={{
          display: "inline-flex",
          flexDirection: "column",
          overflowX: "auto",
          maxHeight: "14.5vh",
          gap: 6,
          width: "100%",
          scrollbarWidth: "none", // Firefox
        }}
      >
        {/* hide scrollbar in WebKit */}
        <style>{`::-webkit-scrollbar{display:none}`}</style>

        {models.map((m) => {
          const imgCount = Math.floor(
            totalPixels / pixelsPerImage(m, baseImagesPerDollar)
          );
          return (
            <span
              key={m}
              style={{
                background: darkModeReducer ? "rgba(255,255,255,0.10)" : "rgba(5,5,5,0.9)",
                borderRadius: 9999,
                padding: "6px 60px",
                whiteSpace: "nowrap",
                fontSize: 16,
                fontWeight: 700,
                color: darkModeReducer ? '#ffffff' : '#ffffff',
                //lineHeight: 1.2,
              }}
            >
              {m === 'minimax' ?
                <span>
                  SeaDream:&nbsp;
                </span> :
                m === 'Imagen' ?
                  <span>
                    Flash:&nbsp;
                  </span> :

                  <span>
                    {m}:&nbsp;
                  </span>}



              <span
                style={{
                  background: GRADIENTx,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  fontWeight: 700,
                }}
              >
                {imgCount.toLocaleString()} images
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );

};

export default ModelCoverage;
