import React from "react";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import SwipeLayer from "./SwipeLayer";
import Button from "@mui/material/Button";
import MusicNoteIcon from "@mui/icons-material/MusicNote";


interface SwipeEditStageProps {
    backToDefault: () => void;
    onSwipe?: (dir: "left" | "right") => void;
    subs: [string, string];                 // <â€” from parent (left, right)
    setSubs: React.Dispatch<React.SetStateAction<[string, string]>>;
    goToPreview: () => void;
    sub1AudioUrl: any;
    sub2AudioUrl: any;
    setSub1AudioUrl: any;
    setSub2AudioUrl: any;
    setAddVoice: any;
    setIdentifier: any;
}

/** Stage 1 UI (swipe edit): back arrow + swipe layer + two sub circles + Preview button */
const SwipeEditStageUI: React.FC<SwipeEditStageProps> = ({
    backToDefault,
    onSwipe,
    subs,
    setSubs,
    goToPreview,
    sub1AudioUrl,
    sub2AudioUrl,
    setSub1AudioUrl,
    setSub2AudioUrl,
    setAddVoice,
    setIdentifier,
}) => {
    const swapSubs = () => setSubs(([l, r]) => [r, l]);

    return (
        <>
            {/* Transparent layer that captures swipes over the video/frame */}


            {/* Back arrow */}
            <button
                onClick={backToDefault}
                aria-label="Back"
                style={{
                    position: "absolute",
                    top: 16,
                    left: 16,
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    border: "2px solid rgba(255,255,255,0.9)",
                    background: "rgba(0,0,0,0.35)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    zIndex: 7,
                    boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                    backdropFilter: "blur(2px)",
                }}
            >
                <ArrowBackIosNewIcon style={{ fontSize: 20 }} />
            </button>

            {/* Left small circular sub preview @ 30% from bottom */}
            {/* Left sub + music note */}
            <div
                style={{
                    position: "absolute",
                    left: 16,
                    bottom: "30%",
                    transform: "translateY(50%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    zIndex: 6,
                }}
            >
                <button
                    onClick={swapSubs}
                    aria-label="Swap sub videos (left)"
                    style={{
                        width: "clamp(56px, 8vw, 88px)",
                        height: "clamp(56px, 8vw, 88px)",
                        borderRadius: "50%",
                        overflow: "hidden",
                        border: "2px solid rgba(255,255,255,0.9)",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                        background: "rgba(0,0,0,0.35)",
                        cursor: "pointer",
                        padding: 0,
                    }}
                >
                    <video
                        src={subs[0]}
                        playsInline
                        muted
                        loop
                        autoPlay
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                </button>

                {/* Music note badge */}
                <div

                    onClick={() => {
                        setIdentifier(1);
                        setAddVoice(true);
                    }}

                    aria-hidden="true"
                    style={{
                        width: 55,
                        height: 55,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(0,0,0,0.45)",
                        border: "2px solid rgba(255,255,255,0.9)",
                        boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                        backdropFilter: "blur(2px)",
                        cursor: 'pointer'
                    }}
                >
                    <MusicNoteIcon style={{ fontSize: 18, color: "#fff" }} />
                </div>
            </div>

            {/* Right sub + music note */}
            <div
                style={{
                    position: "absolute",
                    right: 16,
                    bottom: "30%",
                    transform: "translateY(50%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    zIndex: 6,
                }}
            >
                <button
                    onClick={swapSubs}
                    aria-label="Swap sub videos (right)"
                    style={{
                        width: "clamp(56px, 8vw, 88px)",
                        height: "clamp(56px, 8vw, 88px)",
                        borderRadius: "50%",
                        overflow: "hidden",
                        border: "2px solid rgba(255,255,255,0.9)",
                        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                        background: "rgba(0,0,0,0.35)",
                        cursor: "pointer",
                        padding: 0,
                    }}
                >
                    <video
                        src={subs[1]}
                        playsInline
                        muted
                        loop
                        autoPlay
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                </button>

                {/* Music note badge */}
                <div

                    onClick={() => {
                        setIdentifier(2);
                        setAddVoice(true);
                    }}


                    aria-hidden="true"
                    style={{
                        width: 55,
                        height: 55,
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "rgba(0,0,0,0.45)",
                        border: "2px solid rgba(255,255,255,0.9)",
                        boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
                        backdropFilter: "blur(2px)",
                        cursor: 'pointer'
                    }}
                >
                    <MusicNoteIcon style={{ fontSize: 18, color: "#fff" }} />
                </div>
            </div>


            {/* Bottom full-width PREVIEW button */}
            <div
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    padding: 12,
                    zIndex: 7,
                }}
            >
                <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    onClick={goToPreview}
                    sx={{ py: 1.5, fontWeight: 700, borderRadius: 2 }}
                >
                    Preview
                </Button>
            </div>
        </>
    );
};

export default SwipeEditStageUI;
