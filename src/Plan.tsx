import React, { useMemo, useState } from "react";
import Button from "@mui/material/Button";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useSelector } from "react-redux";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import CircularProgress from "@mui/material/CircularProgress";

import { RootState } from "./store";
import { matchMobile } from "./DetectDevice";

interface PlanBoxProps {
    feeds: Array<Record<string, any>>;
    verticalActiveIndex: number;
    setShowDel: (v: number) => void;
    isMenuOpen: boolean;
    setZoom2x: (v: boolean) => void;
    ty: number;
}

const Plan: React.FC<PlanBoxProps> = ({
    feeds,
    verticalActiveIndex,
    setShowDel,
    isMenuOpen,
    setZoom2x,
    ty,
}) => {
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);
    const [zoomItem, setZoomItem] = useState<{ type: "img" | "video"; src: string } | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const item = feeds?.[verticalActiveIndex] ?? {};
    const APP_STATE = import.meta.env.VITE_APPX_STATE;

    const isMobile =
        matchMobile || (typeof window !== "undefined" && window.innerWidth < 768);

    const close = () => {
        setZoom2x(false);
        setShowDel(0);
    };

    const canDelete =
        !!loggedUser &&
        !(loggedUser.id === 1 && APP_STATE === "prod") &&
        loggedUser.id === item?.sender;

    const get = (k: string) => (item?.[k] ? String(item[k]) : "");

    const hasAnyB = useMemo(() => {
        for (let n = 1; n <= 9; n++) {
            if (
                item?.[`x${n}B`] ||
                item?.[`xt${n}B`] ||
                item?.[`xa${n}B`] ||
                item?.[`gent${n}B`] ||
                item?.[`xv${n}B`]
            ) {
                return true;
            }
        }
        return false;
    }, [item]);

    const isABMode = hasAnyB || Number(item?.mode) === 1;

    const modelDisplayNames: any = {
        fluxUltra: "Flux 2 Max",
        fluxUltra2: "Flux Dev",
        Imagen: "nano Banana Pro",
        Imagen2: "nano Banana",
        minimax: "SeaDream 4.5",
        minimax2: "SeaDream 4",
    };

    const scenes = useMemo(() => {
        const max = 9;
        return Array.from({ length: max }, (_, idx) => {
            const n = idx + 1;

            const xA = idx === 0 ? get(`item1`) : get(`x${n}`);
            const xB = get(`x${n}B`);

            const xtA = get(`xt${n}`);
            const xtB = get(`xt${n}B`);

            const xaA = get(`xa${n}`);
            const xaB = get(`xa${n}B`);

            const gentA = get(`gent${n}`);
            const gentB = get(`gent${n}B`);

            const xvA = get(`xv${n}`);
            const xvB = get(`xv${n}B`);

            const hasAnything = !!(
                xA ||
                xB ||
                xtA ||
                xtB ||
                xaA ||
                xaB ||
                gentA ||
                gentB ||
                xvA ||
                xvB
            );

            return {
                n,
                hasAnything,
                xA,
                xB,
                xtA,
                xtB,
                xaA,
                xaB,
                gentA,
                gentB,
                xvA,
                xvB,
            };
        }).filter((s) => s.hasAnything);
    }, [item]);

    // Modal placement
    const modalWidth = isMobile ? "100vw" : "56vw";
    const modalLeft = isMobile ? "50vw" : isMenuOpen ? "60vw" : "50vw";

    // Styles
    const cardBg = "rgba(255,255,255,0.06)";
    const cardBorder = "1px solid rgba(255,255,255,0.10)";

    const labelPill: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 0.3,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "rgba(255,255,255,0.06)",
        opacity: 0.95,
    };

    const sectionTitle: React.CSSProperties = {
        fontWeight: 900,
        fontSize: 14,
        marginTop: 10,
        marginBottom: 8,
        opacity: 0.95,
    };

    const textBlock: React.CSSProperties = {
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
        lineHeight: 1.4,
        opacity: 0.95,
    };

    const mediaGrid: React.CSSProperties = {
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
        gap: 12,
        marginTop: 8,
    };

    const mediaCard: React.CSSProperties = {
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(0,0,0,0.28)",
        overflow: "hidden",
    };

    const mediaHeader: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.04)",
    };

    // 30% height limitation for list view
    const mediaBox: React.CSSProperties = {
        width: "100%",
        height: "30vh",
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer", // Added cursor pointer
    };

    const imgStyle: React.CSSProperties = {
        width: "100%",
        height: "100%",
        objectFit: "contain",
        display: "block",
    };

    const videoStyle: React.CSSProperties = {
        width: "100%",
        height: "100%",
        objectFit: "contain",
        display: "block",
        background: "rgba(0,0,0,0.65)",
    };


    return (
        <>
            {/* Overlay */}
            <div
                onClick={close}
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 10000,
                    background: "rgba(0,0,0,0.45)",
                }}
            />

            {/* Modal */}
            <div
                style={{
                    position: "fixed",
                    top: isMobile ? 10 : 0,
                    left: modalLeft,
                    transform: "translateX(-50%)",
                    width: modalWidth,
                    maxWidth: "100vw",
                    height: isMobile ? "92vh" : "100vh",
                    zIndex: 10001,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    borderRadius: isMobile ? 16 : 0,
                    background: "rgba(0,0,0,0.90)",
                    color: "#fff",
                    border: isMobile ? "1px solid rgba(255,255,255,0.10)" : undefined,
                    backdropFilter: "blur(8px)",
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderBottom: "1px solid rgba(255,255,255,0.10)",
                        gap: 12,
                    }}
                >
                    {/* LEFT: title + mode + DELETE */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                            <div style={{ fontSize: 18, fontWeight: 900 }}>Plan</div>
                            <div style={{ fontSize: 12, opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                Mode: {isABMode ? "Story (A+B)" : "Normal"} â€¢ Post #{item?.id ?? "â€”"}
                            </div>
                        </div>

                        {canDelete && (
                            <Button
                                variant="outlined"
                                onClick={() => setShowDel(1)}
                                aria-label="Delete"
                                style={{
                                    borderColor: "rgba(255,255,255,0.22)",
                                    color: "#fff",
                                    minWidth: 44,
                                    padding: "12px",
                                    borderRadius: 12,
                                }}
                            >
                                <DeleteOutlineIcon fontSize="small" />
                            </Button>
                        )}
                    </div>

                    {/* RIGHT: Download + Close */}
                    <div style={{ display: "flex", gap: 12 }}>
                        {(item?.main || item?.videoUrl || item?.nobgmvideo) && (
                            <button
                                onClick={async () => {
                                    if (isDownloading) return;
                                    const videoSrc = item?.main || item?.videoUrl || item?.nobgmvideo;
                                    if (!videoSrc) return;

                                    try {
                                        setIsDownloading(true);
                                        const response = await fetch(videoSrc);
                                        if (!response.ok) throw new Error("Network response was not ok");
                                        const blob = await response.blob();
                                        const blobUrl = URL.createObjectURL(blob);
                                        const a = document.createElement("a");
                                        a.href = blobUrl;
                                        a.download = `video_${item?.id || 'download'}.mp4`;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(blobUrl);
                                    } catch (err) {
                                        console.error("Failed to download video via blob, falling back to standard link", err);
                                        const a = document.createElement("a");
                                        a.href = videoSrc;
                                        a.target = "_blank";
                                        a.download = `video_${item?.id || 'download'}.mp4`;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                    } finally {
                                        setIsDownloading(false);
                                    }
                                }}
                                aria-label="Download"
                                style={{
                                    width: 44,
                                    height: 44,
                                    border: "1px solid rgba(255,255,255,0.22)",
                                    color: "#fff",
                                    backgroundColor: "rgba(255,255,255,0.1)",
                                    minWidth: 44,
                                    padding: "12px",
                                    borderRadius: 12,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                {isDownloading ? <CircularProgress size={20} color="inherit" /> : <DownloadIcon fontSize="small" />}
                            </button>
                        )}

                        <button
                            onClick={close}
                            aria-label="Close"
                            style={{
                                width: 44,
                                height: 44,
                                border: "1px solid rgba(255,255,255,0.22)",
                                color: "#fff",
                                backgroundColor: "rgba(255,255,255,0.1)",
                                minWidth: 44,
                                padding: "12px",
                                borderRadius: 12,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <CloseIcon fontSize="small" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div
                    style={{
                        flex: 1,
                        overflowY: "auto",
                        WebkitOverflowScrolling: "touch",
                        padding: "12px 14px 18px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                    }}
                >
                    {/* Kontext at TOP */}
                    {item?.kontext && (
                        <div
                            style={{
                                padding: 12,
                                borderRadius: 16,
                                background: cardBg,
                                border: cardBorder,
                            }}
                        >
                            <div style={{ fontWeight: 900, marginBottom: 10 }}>Kontext</div>
                            <div style={mediaCard}>
                                <div style={mediaBox} onClick={() => setZoomItem({ type: "img", src: item.kontext })}>
                                    <img src={item.kontext} alt="kontext" style={imgStyle} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Prompt / caption */}
                    {(item?.prompt || item?.caption) && (
                        <div
                            style={{
                                padding: 12,
                                borderRadius: 16,
                                background: cardBg,
                                border: cardBorder,
                            }}
                        >
                            {item?.prompt && (
                                <>
                                    <div style={{ fontWeight: 900, marginBottom: 6 }}>
                                        Prompt{" "}
                                        <span style={{ fontWeight: 500, opacity: 0.7 }}>(from DB)</span>
                                    </div>
                                    <div style={textBlock}>{item.prompt}</div>
                                </>
                            )}

                            {item?.caption && (
                                <>
                                    <div style={{ fontWeight: 900, marginTop: 12, marginBottom: 6 }}>
                                        Caption
                                    </div>
                                    <div style={textBlock}>{item.caption}</div>
                                </>
                            )}

                            {item?.model && (
                                <>
                                    <div style={{ fontWeight: 900, marginTop: 12, marginBottom: 6 }}>
                                        Image Model
                                    </div>
                                    <div style={textBlock}>
                                        {modelDisplayNames[item.model] || item.model}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Scenes */}
                    {scenes.map((s) => {
                        const hasB = !!(s.xB || s.xtB || s.xaB || s.gentB || s.xvB) && isABMode;

                        return (
                            <div
                                key={`scene-${s.n}`}
                                style={{
                                    padding: 14,
                                    borderRadius: 18,
                                    background: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.10)",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 10,
                                        marginBottom: 8,
                                    }}
                                >
                                    <div style={{ fontSize: 16, fontWeight: 900 }}>
                                        Scene {s.n}{" "}
                                        <span style={{ fontWeight: 700, opacity: 0.75 }}>
                                            {isABMode ? "(A + B)" : "(single)"}
                                        </span>
                                    </div>

                                    {isABMode && (
                                        <div style={{ display: "flex", gap: 8 }}>
                                            <span style={labelPill}>A</span>
                                            <span style={{ ...labelPill, opacity: hasB ? 0.95 : 0.30 }}>
                                                B
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {(s.xtA || s.xtB) && (
                                    <>
                                        <div style={sectionTitle}>Step text</div>
                                        {s.xtA && (
                                            <div style={textBlock}>
                                                <strong>A:</strong> {s.xtA}
                                            </div>
                                        )}
                                        {isABMode && s.xtB && (
                                            <div style={{ ...textBlock, marginTop: 8 }}>
                                                <strong>B:</strong> {s.xtB}
                                            </div>
                                        )}
                                    </>
                                )}

                                {(s.gentA || s.gentB) && (
                                    <>
                                        <div style={sectionTitle}>Generated prompt</div>
                                        {s.gentA && (
                                            <div style={textBlock}>
                                                <strong>A:</strong> {s.gentA}
                                            </div>
                                        )}
                                        {isABMode && s.gentB && (
                                            <div style={{ ...textBlock, marginTop: 8 }}>
                                                <strong>B:</strong> {s.gentB}
                                            </div>
                                        )}
                                    </>
                                )}

                                {(s.xA || (isABMode && s.xB)) && (
                                    <>
                                        <div style={sectionTitle}>Images</div>
                                        <div style={mediaGrid}>
                                            {s.xA && (
                                                <div style={mediaCard}>
                                                    {isABMode && (
                                                        <div style={mediaHeader}>
                                                            <span style={labelPill}>A</span>
                                                        </div>
                                                    )}
                                                    <div style={mediaBox} onClick={() => setZoomItem({ type: "img", src: s.xA })}>
                                                        <img src={s.xA} alt={`scene-${s.n}-A`} style={imgStyle} />
                                                    </div>
                                                </div>
                                            )}

                                            {isABMode && s.xB && (
                                                <div style={mediaCard}>
                                                    <div style={mediaHeader}>
                                                        <span style={labelPill}>B</span>
                                                    </div>
                                                    <div style={mediaBox} onClick={() => setZoomItem({ type: "img", src: s.xB })}>
                                                        <img src={s.xB} alt={`scene-${s.n}-B`} style={imgStyle} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {(s.xvA || (isABMode && s.xvB)) && (
                                    <>
                                        <div style={sectionTitle}>Videos</div>
                                        <div style={mediaGrid}>
                                            {s.xvA && (
                                                <div style={mediaCard}>
                                                    {isABMode && (
                                                        <div style={mediaHeader}>
                                                            <span style={labelPill}>A</span>
                                                        </div>
                                                    )}
                                                    <div style={mediaBox} onClick={() => setZoomItem({ type: "video", src: s.xvA })}>
                                                        <video src={s.xvA} controls playsInline style={videoStyle} />
                                                    </div>
                                                </div>
                                            )}

                                            {isABMode && s.xvB && (
                                                <div style={mediaCard}>
                                                    <div style={mediaHeader}>
                                                        <span style={labelPill}>B</span>
                                                    </div>
                                                    <div style={mediaBox} onClick={() => setZoomItem({ type: "video", src: s.xvB })}>
                                                        <video src={s.xvB} controls playsInline style={videoStyle} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {(s.xaA || (isABMode && s.xaB)) && (
                                    <>
                                        <div style={sectionTitle}>Audio</div>
                                        <div style={{ display: "grid", gap: 10 }}>
                                            {s.xaA && (
                                                <div
                                                    style={{
                                                        padding: 10,
                                                        borderRadius: 14,
                                                        background: "rgba(255,255,255,0.04)",
                                                        border: cardBorder,
                                                    }}
                                                >
                                                    {isABMode && (
                                                        <div style={{ marginBottom: 6 }}>
                                                            <span style={labelPill}>A</span>
                                                        </div>
                                                    )}
                                                    <audio src={s.xaA} controls style={{ width: "100%" }} />
                                                </div>
                                            )}

                                            {isABMode && s.xaB && (
                                                <div
                                                    style={{
                                                        padding: 10,
                                                        borderRadius: 14,
                                                        background: "rgba(255,255,255,0.04)",
                                                        border: cardBorder,
                                                    }}
                                                >
                                                    <div style={{ marginBottom: 6 }}>
                                                        <span style={labelPill}>B</span>
                                                    </div>
                                                    <audio src={s.xaB} controls style={{ width: "100%" }} />
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ZOOM OVERLAY */}
            {zoomItem && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 11000,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    {/* Backdrop to close */}
                    <div
                        onClick={() => setZoomItem(null)}
                        style={{
                            position: "absolute",
                            inset: 0,
                            background: "rgba(0,0,0,0.85)",
                            backdropFilter: "blur(5px)",
                        }}
                    />

                    {/* Content Box (80% width/height) */}
                    <div
                        style={{
                            position: "relative",
                            width: "80vw",
                            height: "80vh",
                            zIndex: 11001,
                            display: "flex",
                            flexDirection: "column",
                        }}
                    >
                        {/* Close Icon (Top Right) */}
                        <button
                            onClick={() => setZoomItem(null)}
                            style={{
                                position: "absolute",
                                top: -50,
                                right: 0,
                                color: "white",
                                background: "transparent",
                                border: "1px solid rgba(255,255,255,0.3)",
                                borderRadius: "50%",
                                width: 44,
                                height: 44,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <CloseIcon />
                        </button>

                        {/* Media Container (Reusing style similar to components) */}
                        <div
                            style={{
                                flex: 1,
                                borderRadius: 18,
                                overflow: "hidden",
                                border: "1px solid rgba(255,255,255,0.1)",
                                background: "rgba(0,0,0,0.5)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            {zoomItem.type === "img" ? (
                                <img
                                    src={zoomItem.src}
                                    alt="zoomed"
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "contain",
                                    }}
                                />
                            ) : (
                                <video
                                    src={zoomItem.src}
                                    controls
                                    playsInline
                                    autoPlay
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "contain",
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Plan;
