import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { alpha } from "@mui/material/styles";
import "./Plan.css";
import Button from "@mui/material/Button";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { useDispatch, useSelector } from "react-redux";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import ReplyIcon from "@mui/icons-material/Reply";
import CheckIcon from "@mui/icons-material/Check";
import CircularProgress from "@mui/material/CircularProgress";
import { BlueprintAllowRemix, BlueprintRemixAction } from './creationDrafts/actions';

import { RootState } from "./store";
import { matchMobile } from "./DetectDevice";
import { getPlanKontextItems, getPlanKontextPreviewUrl, parsePlanKontext, type PlanKontextMediaItem } from "./planKontextMedia";
import { publishFeedsArea, removeFeedsArea } from "./brainstormSlice";
import { boundedFeedTextHint, type FeedAreaId, type FeedControl } from "./feedsControlSnapshot";

interface PlanBoxProps {
    feeds: Array<Record<string, any>>;
    verticalActiveIndex: number;
    setShowDel: (v: number) => void;
    isMenuOpen: boolean;
    setZoom2x: (v: boolean) => void;
    ty: number;
}

const shotAccent = (shot?: "A" | "B" | string) => {
    if (shot === 'B') return {
        bg: 'var(--blueprint-create-soft)', border: 'var(--blueprint-create-border)', text: 'var(--blueprint-create-text)',
    };
    return {
        bg: "var(--blueprint-accent-soft)",
        border: "var(--blueprint-accent-border)",
        text: "var(--blueprint-accent)",
    };
};

const CollapsiblePlanText: React.FC<{
    text: string;
    shotBadge?: "A" | "B";
    label?: string;
    maxLines?: number;
    dataPlanText?: string;
    style?: React.CSSProperties;
}> = ({ text, shotBadge, label, maxLines = 3, dataPlanText, style }) => {
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);
    const textRef = useRef<HTMLDivElement>(null);
    const cleaned = String(text || "").trim();
    const collapsedDisplay = cleaned.replace(/\r\n/g, "\n").replace(/\n{2,}/g, "\n");
    const lineCount = collapsedDisplay.split("\n").length;
    const charThreshold = maxLines * 78;
    const [isLong, setIsLong] = useState(cleaned.length > charThreshold || lineCount > maxLines);
    useEffect(() => { setExpanded(false); }, [cleaned]);
    useEffect(() => {
        const node = textRef.current;
        if (!node || expanded) return;
        const measure = () => setIsLong(node.scrollHeight > node.clientHeight + 1);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        return () => observer.disconnect();
    }, [cleaned, expanded, maxLines]);
    if (!cleaned) return null;
    const accent = shotAccent(shotBadge);

    const handleCopy = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(cleaned);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1400);
            }
        } catch {
            // ignore clipboard errors
        }
    };

    return (
        <div
            className="blueprint-text-card"
            data-plan-text={dataPlanText}
            style={{
                padding: "10px 12px",
                borderRadius: 12,
                background: "var(--blueprint-soft)",
                border: "1px solid var(--blueprint-border)",
                fontSize: 14,
                lineHeight: 1.6,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                ...style,
            }}
        >
            {(shotBadge || label || isLong) && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        {shotBadge && (
                            <span
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: "1px 8px",
                                    borderRadius: 999,
                                    fontSize: 11,
                                    fontWeight: 800,
                                    letterSpacing: 0.4,
                                    background: accent.bg,
                                    border: `1px solid ${accent.border}`,
                                    color: accent.text,
                                }}
                            >
                                Shot {shotBadge}
                            </span>
                        )}
                        {label && (
                            <span
                                style={{
                                    fontSize: 12,
                                    fontWeight: 850,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                    color: "var(--blueprint-muted)",
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}
                            >
                                {label}
                            </span>
                        )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        <button
                            type="button"
                            onClick={handleCopy}
                            title="Copy text"
                            style={{
                                padding: "2px 7px",
                                borderRadius: 6,
                                border: "1px solid var(--blueprint-border)",
                                background: copied ? "var(--blueprint-accent-soft)" : "var(--blueprint-soft)",
                                color: copied ? "var(--blueprint-accent)" : "var(--blueprint-muted)",
                                fontSize: 10.5,
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            {copied ? "Copied ✓" : "Copy"}
                        </button>
                        {isLong && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setExpanded((prev) => !prev);
                                }}
                                style={{
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    border: "1px solid var(--blueprint-accent-border)",
                                    background: expanded ? "var(--blueprint-accent-soft)" : "var(--blueprint-soft)",
                                    color: expanded ? "var(--blueprint-accent)" : "var(--blueprint-text)",
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                }}
                            >
                                {expanded ? "Collapse ▴" : "Expand ▾"}
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div
                ref={textRef}
                data-blueprint-expandable={isLong || undefined}
                role={isLong ? "button" : undefined}
                tabIndex={isLong ? 0 : undefined}
                aria-expanded={isLong ? expanded : undefined}
                aria-label={isLong ? `${expanded ? 'Collapse' : 'Expand'} ${label || 'text'}` : undefined}
                onClick={(event) => {
                    if (!isLong || window.getSelection()?.toString().trim()) return;
                    event.stopPropagation();
                    setExpanded(value => !value);
                }}
                onKeyDown={(event) => {
                    if (isLong && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault(); event.stopPropagation(); setExpanded(value => !value);
                    }
                }}
                style={{
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                    color: "var(--blueprint-body, var(--blueprint-text))",
                    ...(!expanded
                        ? {
                              display: "-webkit-box",
                              WebkitLineClamp: maxLines,
                              WebkitBoxOrient: "vertical" as const,
                              overflow: "hidden",
                          }
                        : {}),
                }}
            >
                {expanded ? cleaned : collapsedDisplay}
            </div>
        </div>
    );
};

const UrlActionPill: React.FC<{ url: string; label?: string }> = ({ url, label = "Copy URL" }) => {
    const [copied, setCopied] = useState(false);
    if (!url) return null;

    return (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <button
                type="button"
                onClick={async (e) => {
                    e.stopPropagation();
                    try {
                        await navigator.clipboard?.writeText(url);
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1400);
                    } catch {
                        // ignore
                    }
                }}
                style={{
                    padding: "3px 8px",
                    borderRadius: 999,
                    border: "1px solid var(--blueprint-border)",
                    background: copied ? "var(--blueprint-accent-soft)" : "var(--blueprint-soft)",
                    color: copied ? "var(--blueprint-accent)" : "var(--blueprint-text)",
                    fontSize: 10.5,
                    fontWeight: 700,
                    cursor: "pointer",
                }}
            >
                {copied ? "Copied ✓" : label}
            </button>
            <a
                href={url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                    padding: "3px 8px",
                    borderRadius: 999,
                    border: "1px solid var(--blueprint-accent-border)",
                    background: "var(--blueprint-accent-soft)",
                    color: "var(--blueprint-accent)",
                    fontSize: 10.5,
                    fontWeight: 700,
                    textDecoration: "none",
                }}
            >
                Open ↗
            </a>
        </div>
    );
};

const Plan: React.FC<PlanBoxProps> = ({
    feeds,
    verticalActiveIndex,
    setShowDel,
    isMenuOpen,
    setZoom2x,
    ty,
}) => {
    const dispatch = useDispatch();
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);
    const darkMode = useSelector((state: RootState) => state.settings.darkMode);
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const appColor = (darkMode ? appColorDark : appColorLight) || (darkMode ? "#FFFFFF" : "#101010");
    const createColor = darkMode ? 'rgba(255, 0, 0, 0.8)' : '#E69500';
    const [zoomItem, setZoomItem] = useState<{ type: "img" | "video"; src: string } | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);
    const [libraryTab, setLibraryTab] = useState<"all" | "cast" | "refs" | "motion" | "bshots">("all");
    const [showDuplicateCaption, setShowDuplicateCaption] = useState(false);
    const bodyRef = useRef<HTMLDivElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const [viewport, setViewport] = useState({ top: 0, max: 0, visibleScenes: '', activeScene: 0, visibleMedia: '', mediaOverflow: false, visibleText: '' });

    const item = feeds?.[verticalActiveIndex] ?? {};
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        const focused = document.activeElement as HTMLElement | null;
        document.body.style.overflow = 'hidden';
        dialogRef.current?.querySelector<HTMLElement>('[data-ai-action="clikb.feeds.plan.close"]')?.focus({ preventScroll: true });
        return () => { document.body.style.overflow = previousOverflow; focused?.focus({ preventScroll: true }); };
    }, []);
    useEffect(() => {
        bodyRef.current?.scrollTo({ top: 0 });
        setLibraryTab('all'); setShowDuplicateCaption(false); setZoomItem(null);
    }, [item?.id]);
    const planKontext = useMemo(() => parsePlanKontext(item?.kontext), [item?.kontext]);
    const planKontextItems = useMemo(() => getPlanKontextItems(item?.kontext), [item?.kontext]);
    const kontextPreviewUrl = useMemo(() => getPlanKontextPreviewUrl(item?.kontext), [item?.kontext]);
    const inputCharacterItems = planKontext.payload?.inputCharacters ?? [];
    const characterItems = planKontext.payload?.characters ?? [];
    const bshotItems = planKontext.payload?.bshots ?? [];
    const referenceVideoItems = planKontext.payload?.referenceVideos ?? [];
    const motionVideoItems = planKontext.payload?.motionVideos ?? [];
    const savedVideoPrompts = planKontext.payload?.videoPrompts ?? {};
    const APP_STATE = import.meta.env.VITE_APPX_STATE;

    const isMobile =
        matchMobile || (typeof window !== "undefined" && window.innerWidth < 768);

    const close = () => {
        setZoom2x(false);
        setShowDel(0);
    };

    const copyPublicLink = async () => {
        const postId = Number(item?.id);
        if (!Number.isSafeInteger(postId) || postId <= 0) return;

        const publicUrl = `${window.location.origin}/experience/${postId}`;
        const fallbackCopy = () => {
            const textarea = document.createElement("textarea");
            textarea.value = publicUrl;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            const copied = document.execCommand("copy");
            textarea.remove();
            if (!copied) throw new Error("Clipboard copy was rejected");
        };

        try {
            if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(publicUrl);
            else fallbackCopy();
            setLinkCopied(true);
            window.setTimeout(() => setLinkCopied(false), 1800);
        } catch (error) {
            try {
                fallbackCopy();
                setLinkCopied(true);
                window.setTimeout(() => setLinkCopied(false), 1800);
            } catch {
                console.error("Failed to copy public post link", error);
            }
        }
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

    const modelDisplayNames: Record<string, string> = {
        fluxUltra: "Flux 2 Max",
        fluxUltra2: "Flux Dev",
        Imagen: "nano Banana Pro",
        Imagen2: "nano Banana",
        minimax: "SeaDream 4.5",
        minimax2: "SeaDream 4",
    };

    const matchSceneMedia = (
        list: PlanKontextMediaItem[],
        sceneNumber: number,
        isBShot: boolean
    ): PlanKontextMediaItem | undefined => {
        return (list || []).find((entry) => {
            if (!entry?.url) return false;
            const labelLower = String(entry.label || "").toLowerCase();
            const hasExplicitB = entry.bIndex !== undefined || labelLower.includes("b-shot") || labelLower.includes("b shot");
            if (entry.scene === sceneNumber) {
                return isBShot ? hasExplicitB : !hasExplicitB;
            }
            if (isBShot) {
                return labelLower.includes(`b-shot ${sceneNumber}.`) || labelLower.includes(`scene ${sceneNumber} b`);
            }
            return labelLower.includes(`scene ${sceneNumber} `) && !hasExplicitB;
        });
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

            const vpA =
                savedVideoPrompts[`A:${Number(item?.mode) === 1 ? idx * 2 : idx}`] ||
                "";
            const vpB =
                savedVideoPrompts[`B:${idx}:0`] ||
                (Number(item?.mode) === 1 ? savedVideoPrompts[`A:${idx * 2 + 1}`] : "") ||
                "";

            const refVidA = matchSceneMedia(referenceVideoItems, n, false);
            const refVidB = matchSceneMedia(referenceVideoItems, n, true);
            const motionVidA = matchSceneMedia(motionVideoItems, n, false);
            const motionVidB = matchSceneMedia(motionVideoItems, n, true);

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
                xvB ||
                vpA ||
                vpB ||
                refVidA ||
                refVidB ||
                motionVidA ||
                motionVidB
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
                vpA,
                vpB,
                refVidA,
                refVidB,
                motionVidA,
                motionVidB,
            };
        }).filter((s) => s.hasAnything);
    }, [item, savedVideoPrompts, isABMode, referenceVideoItems, motionVideoItems]);

    useEffect(() => {
        const body = bodyRef.current;
        if (!body) return;
        const measure = () => {
            const bodyRect = body.getBoundingClientRect();
            const intersects = (element: Element) => {
                const rect = element.getBoundingClientRect();
                return rect.bottom > bodyRect.top && rect.top < bodyRect.bottom
                    && rect.right > bodyRect.left && rect.left < bodyRect.right;
            };
            const visibleScenes = Array.from(body.querySelectorAll('[data-plan-scene]'))
                .filter(intersects).map(element => element.getAttribute('data-plan-scene')).filter(Boolean).slice(0, 9).join(',');
            const readingLine = bodyRect.top + Math.min(100, body.clientHeight * .18);
            const sceneNodes = Array.from(body.querySelectorAll<HTMLElement>('[data-plan-scene]'));
            const activeNode = sceneNodes.find(node => { const rect = node.getBoundingClientRect(); return rect.top <= readingLine && rect.bottom > readingLine; })
                || sceneNodes.filter(node => { const rect = node.getBoundingClientRect(); return rect.bottom > readingLine && rect.top < bodyRect.bottom; })[0];
            const activeScene = Number(activeNode?.dataset.planScene) || 0;
            const media = Array.from(body.querySelectorAll('[data-plan-media]'))
                .filter(intersects).map(element => element.getAttribute('data-plan-media')).filter(Boolean);
            const text = Array.from(body.querySelectorAll('[data-plan-text]'))
                .filter(intersects).map(element => element.getAttribute('data-plan-text')).filter(Boolean);
            const next = { top: Math.max(0, Math.round(body.scrollTop)),
                max: Math.max(0, Math.round(body.scrollHeight - body.clientHeight)),
                visibleScenes, activeScene, visibleMedia: media.slice(0, 12).join(','), mediaOverflow: media.length > 12,
                visibleText: text.slice(0, 12).join(',') };
            setViewport(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
        };
        measure();
        body.addEventListener('scroll', measure, { passive: true });
        window.addEventListener('resize', measure);
        const observer = new ResizeObserver(measure);
        observer.observe(body);
        for (const child of Array.from(body.children)) observer.observe(child);
        return () => { observer.disconnect(); body.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); };
    }, [item, scenes]);

    useEffect(() => {
        const areaId: FeedAreaId = 'clikb.feeds.plan';
        const postId = Number(item?.id) || 0;
        const visibleSceneNumbers = zoomItem ? [] : viewport.visibleScenes.split(',').map(Number).filter(number => Number.isInteger(number) && number > 0);
        const visibleMediaIds = zoomItem ? [] : viewport.visibleMedia.split(',').filter(Boolean);
        const visibleTextIds = zoomItem ? [] : viewport.visibleText.split(',').filter(Boolean);
        const sceneHints = visibleSceneNumbers.slice(0, 2).flatMap(number => {
            const scene = scenes.find(value => value.n === number);
            return scene ? [{ scene: number,
                A: visibleTextIds.includes(`scene-${number}-A`) ? boundedFeedTextHint(scene.xtA, 100) : '',
                B: isABMode && visibleTextIds.includes(`scene-${number}-B`) ? boundedFeedTextHint(scene.xtB, 100) : '' }] : [];
        });
        const control = (name: string, handlerRef: string, policy: FeedControl['aiPolicy'] = 'candidate'): FeedControl => ({
            controlId: `${areaId}.${name}`, areaId, handlerRef, enabled: true, aiPolicy: policy,
            targetId: postId, ...(policy === 'candidate' ? { candidateActionId: `${areaId}.${name}` } : {}),
        });
        const controls = zoomItem ? [
            control('close_zoom', 'Plan.setZoomItem(null)'),
            ...(zoomItem.type === 'video' ? [control('zoom_media_playback', 'Plan zoom video native controls', 'manual_only')] : []),
        ] : [
            control('close', 'Plan.close'),
            control('backdrop_close', 'Plan.close'),
            control('scroll_body', 'Plan.bodyRef manual scroll', 'manual_only'),
            ...(postId > 0 ? [control('share_public_link', 'Plan.copyPublicLink', 'manual_only')] : []),
            ...(item?.main || item?.videoUrl || item?.nobgmvideo ? [control('download', 'Plan download handler', 'manual_only')] : []),
            ...(canDelete ? [control('request_delete', 'Plan.setShowDel(1): user-operated deletion review', 'manual_only' as const)] : []),
            ...visibleMediaIds.map(id => id.endsWith('-audio')
                ? control(`media_${id}`, 'Plan scene audio native controls', 'manual_only')
                : control(`open_media_${id}`, 'Plan.setZoomItem')),
        ];
        dispatch(publishFeedsArea({ areaId, source: 'Plan', instanceId: 'plan',
            state: {
                postId, mode: isABMode ? 'A+B' : 'normal',
                scrollOwner: 'Plan.bodyRef', scrollTop: viewport.top, scrollMax: viewport.max,
                scrollRegion: viewport.max <= 0 ? 'all' : viewport.top <= 2 ? 'start'
                    : viewport.top >= viewport.max - 2 ? 'end' : 'middle',
                visibleSceneIds: zoomItem ? '' : viewport.visibleScenes,
                visibleMediaIds: zoomItem ? '' : viewport.visibleMedia, mediaControlOverflow: !zoomItem && viewport.mediaOverflow,
                visibleTextIds: zoomItem ? '' : viewport.visibleText,
                visibleSceneHints: JSON.stringify(sceneHints),
                promptHint: visibleTextIds.includes('prompt') ? boundedFeedTextHint(item?.prompt, 120) : '',
                captionHint: visibleTextIds.includes('caption') && (!visibleTextIds.includes('prompt') || item?.caption !== item?.prompt)
                    ? boundedFeedTextHint(item?.caption, 120) : '',
                promptCaptionSameSource: Boolean(item?.prompt && item?.caption && item.prompt === item.caption),
                sceneHintOverflow: visibleSceneNumbers.length > 2,
                zoomOpen: Boolean(zoomItem), zoomKind: zoomItem?.type ?? '',
                downloading: isDownloading, linkCopied, canDelete,
            }, visiblePosts: [], visibleControls: controls,
        }));
    }, [dispatch, item, scenes, isABMode, viewport, zoomItem, isDownloading, linkCopied, canDelete]);
    useEffect(() => () => {
        dispatch(removeFeedsArea({ areaId: 'clikb.feeds.plan', source: 'Plan' }));
    }, [dispatch]);

    // Modal placement
    const modalWidth = isMobile ? "100vw" : "62vw";
    const modalLeft = isMobile ? "50vw" : isMenuOpen ? "60vw" : "50vw";

    // Studio Styles
    const cardBg = "var(--blueprint-card)";
    const cardBorder = "1px solid var(--blueprint-border)";

    const labelPill: React.CSSProperties = {
        display: "inline-flex",
        whiteSpace: "nowrap",
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 800,
        letterSpacing: 0.3,
        border: "1px solid var(--blueprint-border)",
        background: "var(--blueprint-soft)",
        color: "var(--blueprint-text)",
    };

    const sectionTitle: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontWeight: 900,
        fontSize: 13.5,
        textTransform: "uppercase",
        letterSpacing: 0.8,
        color: "var(--blueprint-muted)",
        marginTop: 14,
        marginBottom: 8,
    };

    const mediaGrid: React.CSSProperties = {
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(240px, 1fr))",
        gap: 12,
        marginTop: 6,
    };

    const mediaCard: React.CSSProperties = {
        borderRadius: 14,
        border: "1px solid var(--blueprint-border)",
        background: "var(--blueprint-surface)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 8px 24px rgba(0,0,0,0.28)",
    };

    const mediaHeader: React.CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "8px 12px",
        borderBottom: "1px solid var(--blueprint-border)",
        background: "var(--blueprint-soft)",
    };

    const mediaBox: React.CSSProperties = {
        width: "100%",
        height: "230px",
        background: "var(--blueprint-media)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        position: "relative",
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
        background: "var(--blueprint-media)",
    };

    const scrollToSelector = (selector: string) => {
        const container = bodyRef.current;
        if (!container) return;
        const target = container.querySelector(selector) as HTMLElement | null;
        if (!target) return;
        container.scrollTo({ top: container.scrollTop + target.getBoundingClientRect().top - container.getBoundingClientRect().top, behavior: "smooth" });
    };

    const renderStudioMediaCard = ({
        url,
        kind,
        title,
        shot,
        badgeText,
        badgeColor,
        poster,
        description,
        dataPlanMedia,
        showUrlActions = false,
    }: {
        url: string;
        kind: "img" | "video";
        title: string;
        shot?: "A" | "B";
        badgeText?: string;
        badgeColor?: string;
        poster?: string;
        description?: string;
        dataPlanMedia: string;
        showUrlActions?: boolean;
    }) => {
        const accent = shotAccent(shot);
        return (
            <div style={mediaCard} key={dataPlanMedia + "-" + url}>
                <div style={mediaHeader}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        {shot && (
                            <span
                                style={{
                                    ...labelPill,
                                    padding: "2px 8px",
                                    fontSize: 11,
                                    background: accent.bg,
                                    border: `1px solid ${accent.border}`,
                                    color: accent.text,
                                }}
                            >
                                Shot {shot}
                            </span>
                        )}
                        <span
                            style={{
                                fontSize: 12,
                                fontWeight: 800,
                                color: "var(--blueprint-text)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                            }}
                        >
                            {title}
                        </span>
                        {badgeText && (
                            <span
                                style={{
                                    padding: "2px 7px",
                                    borderRadius: 999,
                                    fontSize: 10,
                                    fontWeight: 800,
                                    background: badgeColor || "var(--blueprint-accent-soft)",
                                    border: "1px solid var(--blueprint-border)",
                                    color: "var(--blueprint-text)",
                                }}
                            >
                                {badgeText}
                            </span>
                        )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                        {showUrlActions && <UrlActionPill url={url} />}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setZoomItem({ type: kind, src: url });
                            }}
                            style={{
                                padding: "3px 8px",
                                borderRadius: 999,
                                border: "1px solid var(--blueprint-border)",
                                background: "var(--blueprint-soft)",
                                color: "var(--blueprint-text)",
                                fontSize: 10.5,
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            Zoom ⤢
                        </button>
                    </div>
                </div>

                <div
                    style={mediaBox}
                    data-plan-media={dataPlanMedia}
                    data-ai-action={`clikb.feeds.plan.open_media_${dataPlanMedia}`}
                    onClick={() => setZoomItem({ type: kind, src: url })}
                >
                    {kind === "video" ? (
                        <video
                            src={url}
                            controls
                            playsInline
                            preload="metadata"
                            poster={poster || undefined}
                            style={videoStyle}
                        />
                    ) : (
                        <img src={url} alt={title} loading="lazy" style={imgStyle} />
                    )}
                </div>

                {description && (
                    <div style={{ padding: "8px 10px", borderTop: "1px solid var(--blueprint-soft)" }}>
                        <CollapsiblePlanText text={description} maxLines={2} />
                    </div>
                )}
            </div>
        );
    };

    const renderPlanMediaSection = (title: string, items: any[], isRefOrMotion = false) => {
        const visibleItems = (items || []).filter((media) => media?.url);
        if (visibleItems.length === 0) return null;

        return (
            <div style={{ marginTop: 10 }}>
                <div style={sectionTitle}>
                    <span>{title}</span>
                    <span style={{ fontSize: 11, opacity: 0.7 }}>{visibleItems.length} item{visibleItems.length === 1 ? "" : "s"}</span>
                </div>
                <div style={mediaGrid}>
                    {visibleItems.map((media, index) =>
                        renderStudioMediaCard({
                            url: media.url,
                            kind: media.kind === "video" ? "video" : "img",
                            title: media.label || media.name || media.role || title,
                            badgeText:
                                media.source === "world"
                                    ? "World"
                                    : media.role === "motion-video"
                                    ? "Three.js 3D"
                                    : media.role === "reference-video"
                                    ? "Video Ref"
                                    : undefined,
                            poster: media.poster || media.thumbnail,
                            description: media.description || media.prompt,
                            dataPlanMedia: `plan-${title.toLowerCase().replace(/\s+/g, "-")}-${index}`,
                            showUrlActions: isRefOrMotion || media.kind === "video",
                        })
                    )}
                </div>
            </div>
        );
    };

    const hasLibraryMedia = Boolean(
        planKontext.payload &&
            (inputCharacterItems.length > 0 ||
                characterItems.length > 0 ||
                bshotItems.length > 0 ||
                referenceVideoItems.length > 0 ||
                motionVideoItems.length > 0)
    );

    const castTotal = inputCharacterItems.length + characterItems.length;
    const promptSameAsCaption = Boolean(
        item?.prompt &&
            item?.caption &&
            String(item.prompt).trim() === String(item.caption).trim()
    );

    const themeStyle = {
        '--blueprint-accent': appColor,
        '--blueprint-accent-soft': alpha(appColor, darkMode ? .12 : .07),
        '--blueprint-accent-border': alpha(appColor, darkMode ? .35 : .24),
        '--blueprint-create': createColor,
        '--blueprint-create-text': darkMode ? '#ff9187' : '#895300',
        '--blueprint-create-soft': alpha(createColor, darkMode ? .13 : .1),
        '--blueprint-create-border': alpha(createColor, .35),
        '--blueprint-media': darkMode ? 'linear-gradient(135deg,#ffffff 0%,#f3f8ff 48%,#dceafb 100%)' : 'radial-gradient(circle at center,#292d36,#101319)',
        '--blueprint-text': darkMode ? '#f3f6fc' : '#111827',
        '--blueprint-body': darkMode ? 'rgba(243,246,252,0.82)' : '#374151',
        '--blueprint-muted': darkMode ? '#b7c3d6' : '#475569',
        '--blueprint-border': darkMode ? 'rgba(188,211,242,.15)' : '#d5e2ef',
        '--blueprint-soft': darkMode ? 'rgba(211,229,255,.045)' : '#edf4fc',
        '--blueprint-surface': darkMode ? '#121a29' : '#ffffff',
        '--blueprint-header': darkMode ? '#111927' : '#f8fbff',
        '--blueprint-card': darkMode ? 'linear-gradient(145deg,#182234,#111927)' : 'linear-gradient(145deg,#ffffff,#f0f6fd)',
        '--blueprint-background': darkMode ? 'linear-gradient(180deg,#0d1422,#090f1a)' : 'linear-gradient(180deg,#f8fbff,#eaf2fc)',
    } as React.CSSProperties;

    return createPortal(
        <div ref={dialogRef} className="blueprint-root" data-blueprint-theme={darkMode ? 'dark' : 'light'} style={themeStyle}
            onWheel={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()}
            onTouchMove={event => event.stopPropagation()} onTouchEnd={event => event.stopPropagation()}
            onPointerDown={event => event.stopPropagation()} onPointerMove={event => event.stopPropagation()}
            onPointerUp={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
            onKeyDown={event => {
                event.stopPropagation();
                if (event.key === 'Escape') { event.preventDefault(); if (zoomItem) setZoomItem(null); else close(); }
                if (event.key === 'Tab') {
                    const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],audio[controls],video[controls],[tabindex="0"]') || [])
                        .filter(node => node.getClientRects().length > 0 && (!zoomItem || Boolean(node.closest('[data-blueprint-zoom]'))));
                    const first = controls[0], last = controls.at(-1);
                    if (first && (event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last)) {
                        event.preventDefault(); (event.shiftKey ? last : first)?.focus();
                    }
                }
            }}>
            {/* Overlay */}
            <div
                data-ai-action="clikb.feeds.plan.backdrop_close"
                onClick={close}
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: 10000,
                    background: "rgba(0,0,0,0.58)",
                    backdropFilter: "blur(4px)",
                }}
            />

            {/* Modal */}
            <div className="blueprint-dialog" role="dialog" aria-modal="true" aria-label="Blueprint"
                style={{
                    position: "fixed",
                    top: isMobile ? 8 : 0,
                    left: modalLeft,
                    transform: "translateX(-50%)",
                    width: modalWidth,
                    maxWidth: "100vw",
                    height: isMobile ? "calc(100dvh - 16px)" : "100dvh",
                    zIndex: 10001,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    borderRadius: isMobile ? 18 : 0,
                    background: "var(--blueprint-background)",
                    color: "var(--blueprint-text)",
                    borderLeft: isMobile ? undefined : "1px solid var(--blueprint-border)",
                    borderRight: isMobile ? undefined : "1px solid var(--blueprint-border)",
                    border: isMobile ? "1px solid var(--blueprint-border)" : undefined,
                    boxShadow: "0 24px 80px rgba(0,0,0,0.75)",
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: "12px 16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderBottom: "1px solid var(--blueprint-border)",
                        background: "var(--blueprint-header)",
                        backdropFilter: "blur(12px)",
                        gap: 12,
                    }}
                >
                    {/* LEFT: title + mode + metadata pills + DELETE */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ fontSize: 21, fontWeight: 950, letterSpacing: 0.3 }}>Blueprint</div>
                            <span
                                style={{
                                    padding: "3px 9px",
                                    borderRadius: 999,
                                    fontSize: 11,
                                    fontWeight: 800,
                                    background: "var(--blueprint-create-soft)",
                                    border: "1px solid var(--blueprint-create-border)",
                                    color: "var(--blueprint-create-text)",
                                }}
                            >
                                {isABMode ? "Story (A + B)" : "Single Track"}
                            </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ ...labelPill, fontSize: 11, opacity: 0.78 }}>
                                Post #{item?.id ?? "—"}
                            </span>
                            {item?.model && (
                                <span
                                    style={{
                                        ...labelPill,
                                        fontSize: 11,
                                        background: "var(--blueprint-accent-soft)",
                                        border: "1px solid var(--blueprint-accent-border)",
                                        color: "var(--blueprint-accent)",
                                    }}
                                >
                                    {modelDisplayNames[item.model] || item.model}
                                </span>
                            )}
                            {scenes.length > 0 && (
                                <span style={{ ...labelPill, fontSize: 11, opacity: 0.8 }}>
                                    {scenes.length} Scene{scenes.length === 1 ? "" : "s"}
                                </span>
                            )}
                        </div>

                        <BlueprintRemixAction post={item} />
                        {canDelete && (
                            <Button
                                variant="outlined"
                                onClick={() => setShowDel(1)}
                                aria-label="Delete"
                                style={{
                                    borderColor: "rgba(248,113,113,0.35)",
                                    background: "rgba(248,113,113,0.08)",
                                    color: "#fca5a5",
                                    minWidth: 38,
                                    height: 38,
                                    padding: "8px",
                                    borderRadius: 10,
                                }}
                            >
                                <DeleteOutlineIcon fontSize="small" />
                            </Button>
                        )}
                    </div>

                    {/* RIGHT: Copy link + Download + Close */}
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        {Number(item?.id) > 0 && (
                            <button
                                onClick={copyPublicLink}
                                aria-label={linkCopied ? "Link copied" : "Share public link"}
                                title={linkCopied ? "Link copied" : "Share link"}
                                style={{
                                    width: 40,
                                    height: 40,
                                    border: "1px solid var(--blueprint-border)",
                                    color: linkCopied ? appColor : "var(--blueprint-text)",
                                    backgroundColor: "var(--blueprint-soft)",
                                    borderRadius: 10,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                {linkCopied
                                    ? <CheckIcon fontSize="small" />
                                    : <ReplyIcon fontSize="small" sx={{ transform: "scaleX(-1)" }} />}
                            </button>
                        )}
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
                                        a.download = `video_${item?.id || "download"}.mp4`;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(blobUrl);
                                    } catch (err) {
                                        console.error("Failed to download video via blob, falling back to standard link", err);
                                        const a = document.createElement("a");
                                        a.href = videoSrc;
                                        a.target = "_blank";
                                        a.download = `video_${item?.id || "download"}.mp4`;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                    } finally {
                                        setIsDownloading(false);
                                    }
                                }}
                                aria-label="Download"
                                style={{
                                    width: 40,
                                    height: 40,
                                    border: "1px solid var(--blueprint-border)",
                                    color: "var(--blueprint-text)",
                                    backgroundColor: "var(--blueprint-soft)",
                                    borderRadius: 10,
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                {isDownloading ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon fontSize="small" />}
                            </button>
                        )}

                        <button
                            data-ai-action="clikb.feeds.plan.close"
                            onClick={close}
                            aria-label="Close"
                            style={{
                                width: 40,
                                height: 40,
                                border: "1px solid var(--blueprint-border)",
                                color: "var(--blueprint-text)",
                                backgroundColor: "var(--blueprint-soft)",
                                borderRadius: 10,
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

                {/* Sticky Quick-Jump Navigation Bar */}
                <div
                    style={{
                        padding: "8px 16px",
                        borderBottom: "1px solid var(--blueprint-soft)",
                        background: "var(--blueprint-header)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        overflowX: "auto",
                        WebkitOverflowScrolling: "touch",
                    }}
                >
                    {(item?.prompt || item?.caption) && (
                        <button
                            type="button"
                            onClick={() => scrollToSelector('[data-plan-prompt="true"]')}
                            style={{
                                padding: "4px 11px",
                                borderRadius: 999,
                                border: "1px solid var(--blueprint-border)",
                                background: "var(--blueprint-soft)",
                                color: "var(--blueprint-text)",
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                            }}
                        >
                            Initial Prompt
                        </button>
                    )}
                    {(kontextPreviewUrl || hasLibraryMedia) && (
                        <button
                            type="button"
                            onClick={() => scrollToSelector('[data-plan-library="true"]')}
                            style={{
                                padding: "4px 11px",
                                borderRadius: 999,
                                border: "1px solid var(--blueprint-border)",
                                background: "var(--blueprint-soft)",
                                color: "var(--blueprint-text)",
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                            }}
                        >
                            Cast & Refs ({planKontextItems.length})
                        </button>
                    )}
                    {scenes.map((s) => {
                        const active = viewport.activeScene === s.n;
                        return (
                            <button
                                key={`jump-scene-${s.n}`}
                                type="button"
                                aria-current={active ? 'location' : undefined}
                                data-blueprint-jump={s.n}
                                onClick={() => scrollToSelector(`[data-plan-scene="${s.n}"]`)}
                                style={{
                                    padding: "4px 11px",
                                    borderRadius: 999,
                                    border: active
                                        ? "1px solid var(--blueprint-create-border)"
                                        : "1px solid var(--blueprint-border)",
                                    background: active
                                        ? "var(--blueprint-create-soft)"
                                        : "var(--blueprint-soft)",
                                    color: active ? "var(--blueprint-create-text)" : "var(--blueprint-text)",
                                    fontSize: 11.5,
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                Scene {s.n}
                            </button>
                        );
                    })}
                </div>

                {/* Body */}
                <div
                    ref={bodyRef}
                    className="blueprint-body"
                    data-ai-scroll="clikb.feeds.plan:body"
                    style={{
                        flex: 1,
                        overflowY: "auto",
                        WebkitOverflowScrolling: "touch",
                        padding: "14px 16px 24px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 14,
                    }}
                >
                    <BlueprintAllowRemix post={item} />
                    {/* 1. Initial Prompt & Caption at TOP for immediate context (minimum 5 lines visible) */}
                    {(item?.prompt || item?.caption) && (
                        <div
                            data-plan-prompt="true"
                            style={{
                                padding: 14,
                                borderRadius: 16,
                                background: cardBg,
                                border: cardBorder,
                                display: "flex",
                                flexDirection: "column",
                                gap: 10,
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 16, fontWeight: 900 }}>Initial Story Prompt</span>
                                    <span style={{ fontSize: 11, opacity: 0.62 }}>(from DB)</span>
                                </div>

                                {promptSameAsCaption && (
                                    <button
                                        type="button"
                                        onClick={() => setShowDuplicateCaption((prev) => !prev)}
                                        style={{
                                            padding: "3px 9px",
                                            borderRadius: 999,
                                            border: "1px solid var(--blueprint-border)",
                                            background: "var(--blueprint-soft)",
                                            color: "var(--blueprint-muted)",
                                            fontSize: 11,
                                            fontWeight: 700,
                                            cursor: "pointer",
                                        }}
                                    >
                                        {showDuplicateCaption ? "Hide identical Caption" : "Caption matches Prompt • Show"}
                                    </button>
                                )}
                            </div>

                            {item?.prompt && (
                                <CollapsiblePlanText
                                    text={item.prompt}
                                    label="Master Prompt"
                                    maxLines={5}
                                    dataPlanText="prompt"
                                />
                            )}

                            {item?.caption && (!promptSameAsCaption || showDuplicateCaption) && (
                                <CollapsiblePlanText
                                    text={item.caption}
                                    label="Caption"
                                    maxLines={4}
                                    dataPlanText="caption"
                                />
                            )}
                        </div>
                    )}

                    {/* 2. Cast, Reference Videos, Three.js 3D Motion & Kontext Library */}
                    {(kontextPreviewUrl || hasLibraryMedia) && (
                        <div
                            data-plan-library="true"
                            style={{
                                padding: 14,
                                borderRadius: 16,
                                background: cardBg,
                                border: cardBorder,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 10,
                                    flexWrap: "wrap",
                                    marginBottom: 10,
                                }}
                            >
                                <div>
                                    <div style={{ fontSize: 16, fontWeight: 900 }}>Cast, References & 3D Motion Library</div>
                                    <div style={{ fontSize: 13, opacity: 0.8 }}>
                                        {planKontextItems.length} saved asset{planKontextItems.length === 1 ? "" : "s"} across characters, video refs, and Three.js motion guides
                                    </div>
                                </div>

                                {/* Filter Tabs */}
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                    {[
                                        { id: "all", label: "All", count: planKontextItems.length },
                                        { id: "cast", label: "Cast & VIPs", count: castTotal },
                                        { id: "refs", label: "Video Refs", count: referenceVideoItems.length },
                                        { id: "motion", label: "3D Motion", count: motionVideoItems.length },
                                        { id: "bshots", label: "B-roll", count: bshotItems.length },
                                    ]
                                        .filter((tab) => tab.id === "all" || tab.count > 0)
                                        .map((tab) => {
                                            const active = libraryTab === tab.id;
                                            return (
                                                <button
                                                    key={tab.id}
                                                    type="button"
                                                    onClick={() => setLibraryTab(tab.id as any)}
                                                    style={{
                                                        padding: "4px 10px",
                                                        borderRadius: 999,
                                                        fontSize: 11,
                                                        fontWeight: 800,
                                                        border: active
                                                            ? "1px solid var(--blueprint-accent-border)"
                                                            : "1px solid var(--blueprint-border)",
                                                        background: active
                                                            ? "var(--blueprint-accent-soft)"
                                                            : "var(--blueprint-soft)",
                                                        color: active ? "var(--blueprint-create-text)" : "var(--blueprint-text)",
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    {tab.label} ({tab.count})
                                                </button>
                                            );
                                        })}
                                </div>
                            </div>

                            {libraryTab === "all" && kontextPreviewUrl && (
                                <div style={{ marginBottom: 10 }}>
                                    {renderStudioMediaCard({
                                        url: kontextPreviewUrl,
                                        kind: "img",
                                        title: "Kontext Cover Frame",
                                        badgeText: "Cover",
                                        dataPlanMedia: "kontext-preview",
                                    })}
                                </div>
                            )}

                            {(libraryTab === "all" || libraryTab === "cast") && (
                                <>
                                    {renderPlanMediaSection("Input Characters", inputCharacterItems)}
                                    {renderPlanMediaSection("Generated Characters", characterItems)}
                                </>
                            )}
                            {(libraryTab === "all" || libraryTab === "refs") &&
                                renderPlanMediaSection("Reference Videos", referenceVideoItems, true)}
                            {(libraryTab === "all" || libraryTab === "motion") &&
                                renderPlanMediaSection("3D Motion Videos", motionVideoItems, true)}
                            {(libraryTab === "all" || libraryTab === "bshots") &&
                                renderPlanMediaSection("B-roll", bshotItems)}
                        </div>
                    )}

                    {/* 3. Scene-by-Scene Studio Breakdown */}
                    {scenes.map((s) => {
                        const hasB =
                            !!(s.xB || s.xtB || s.xaB || s.gentB || s.xvB || s.vpB || s.refVidB || s.motionVidB) &&
                            isABMode;

                        const dualPromptGrid: React.CSSProperties = {
                            display: "grid",
                            gridTemplateColumns: !isMobile && isABMode && hasB ? "1fr 1fr" : "1fr",
                            gap: 10,
                        };

                        const hasSceneRefOrMotion = !!(s.refVidA || s.refVidB || s.motionVidA || s.motionVidB);

                        return (
                            <div
                                key={`scene-${s.n}`}
                                data-plan-scene={s.n}
                                style={{
                                    padding: 16,
                                    borderRadius: 18,
                                    background: cardBg,
                                    border: "1px solid var(--blueprint-border)",
                                    boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
                                }}
                            >
                                {/* Scene Header */}
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        flexWrap: "wrap",
                                        gap: 10,
                                        paddingBottom: 10,
                                        borderBottom: "1px solid var(--blueprint-border)",
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                        <span
                                            style={{
                                                padding: "4px 11px",
                                                borderRadius: 10,
                                                fontSize: 13,
                                                fontWeight: 900,
                                                letterSpacing: 0.4,
                                                background: "var(--blueprint-accent-soft)",
                                                border: "1px solid var(--blueprint-accent-border)",
                                                color: "var(--blueprint-accent)",
                                            }}
                                        >
                                            SCENE {s.n}
                                        </span>
                                        <span style={{ fontSize: 12.5, fontWeight: 700, opacity: 0.72 }}>
                                            {isABMode ? "Dual Track (Shot A + Shot B)" : "Single Track"}
                                        </span>
                                    </div>

                                    {/* Asset Badges for quick scanning */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                        {(s.xA || s.xB) && <span style={{ ...labelPill, fontSize: 10.5 }}>Image</span>}
                                        {(s.xvA || s.xvB) && <span style={{ ...labelPill, fontSize: 10.5 }}>Video</span>}
                                        {(s.refVidA || s.refVidB) && (
                                            <span
                                                style={{
                                                    ...labelPill,
                                                    fontSize: 10.5,
                                                    background: "var(--blueprint-accent-soft)",
                                                    border: "1px solid var(--blueprint-accent-border)",
                                                    color: "var(--blueprint-accent)",
                                                }}
                                            >
                                                Video Ref
                                            </span>
                                        )}
                                        {(s.motionVidA || s.motionVidB) && (
                                            <span
                                                style={{
                                                    ...labelPill,
                                                    fontSize: 10.5,
                                                    background: "var(--blueprint-accent-soft)",
                                                    border: "1px solid var(--blueprint-accent-border)",
                                                    color: "var(--blueprint-accent)",
                                                }}
                                            >
                                                Three.js 3D
                                            </span>
                                        )}
                                        {isABMode && (
                                            <>
                                                <span
                                                    style={{
                                                        ...labelPill,
                                                        background: shotAccent("A").bg,
                                                        border: `1px solid ${shotAccent("A").border}`,
                                                        color: shotAccent("A").text,
                                                    }}
                                                >
                                                    A
                                                </span>
                                                <span
                                                    style={{
                                                        ...labelPill,
                                                        background: shotAccent("B").bg,
                                                        border: `1px solid ${shotAccent("B").border}`,
                                                        color: shotAccent("B").text,
                                                        opacity: hasB ? 1 : 0.35,
                                                    }}
                                                >
                                                    B
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Step Text (Side-by-Side for A & B) */}
                                {(s.xtA || (isABMode && s.xtB)) && (
                                    <>
                                        <div style={sectionTitle}>
                                            <span>Scene Direction / Step Text</span>
                                        </div>
                                        <div style={dualPromptGrid}>
                                            {s.xtA && (
                                                <CollapsiblePlanText
                                                    text={s.xtA}
                                                    shotBadge={isABMode ? "A" : undefined}
                                                    label="Step Text"
                                                    maxLines={3}
                                                    dataPlanText={`scene-${s.n}-A`}
                                                />
                                            )}
                                            {isABMode && s.xtB && (
                                                <CollapsiblePlanText
                                                    text={s.xtB}
                                                    shotBadge="B"
                                                    label="Step Text"
                                                    maxLines={3}
                                                    dataPlanText={`scene-${s.n}-B`}
                                                />
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* Generated Image Prompt */}
                                {(s.gentA || (isABMode && s.gentB)) && (
                                    <>
                                        <div style={sectionTitle}>
                                            <span>Generated Image Prompt</span>
                                        </div>
                                        <div style={dualPromptGrid}>
                                            {s.gentA && (
                                                <CollapsiblePlanText
                                                    text={s.gentA}
                                                    shotBadge={isABMode ? "A" : undefined}
                                                    label="Image Prompt"
                                                    maxLines={3}
                                                />
                                            )}
                                            {isABMode && s.gentB && (
                                                <CollapsiblePlanText
                                                    text={s.gentB}
                                                    shotBadge="B"
                                                    label="Image Prompt"
                                                    maxLines={3}
                                                />
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* Video Prompt */}
                                {(s.vpA || (isABMode && s.vpB)) && (
                                    <>
                                        <div style={sectionTitle}>
                                            <span>Video Motion Prompt</span>
                                        </div>
                                        <div style={dualPromptGrid}>
                                            {s.vpA && (
                                                <CollapsiblePlanText
                                                    text={s.vpA}
                                                    shotBadge={isABMode ? "A" : undefined}
                                                    label="Video Prompt"
                                                    maxLines={3}
                                                />
                                            )}
                                            {isABMode && s.vpB && (
                                                <CollapsiblePlanText
                                                    text={s.vpB}
                                                    shotBadge="B"
                                                    label="Video Prompt"
                                                    maxLines={3}
                                                />
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* Scene Images */}
                                {(s.xA || (isABMode && s.xB)) && (
                                    <>
                                        <div style={sectionTitle}>
                                            <span>Scene Frames</span>
                                        </div>
                                        <div style={mediaGrid}>
                                            {s.xA &&
                                                renderStudioMediaCard({
                                                    url: s.xA,
                                                    kind: "img",
                                                    title: "First Frame",
                                                    shot: isABMode ? "A" : undefined,
                                                    dataPlanMedia: `scene-${s.n}-A-image`, /* data-plan-media={`scene-${s.n}-A-image`} */
                                                })}
                                            {isABMode &&
                                                s.xB &&
                                                renderStudioMediaCard({
                                                    url: s.xB,
                                                    kind: "img",
                                                    title: "First Frame",
                                                    shot: "B",
                                                    dataPlanMedia: `scene-${s.n}-B-image`,
                                                })}
                                        </div>
                                    </>
                                )}

                                {/* Scene Videos */}
                                {(s.xvA || (isABMode && s.xvB)) && (
                                    <>
                                        <div style={sectionTitle}>
                                            <span>Generated Scene Videos</span>
                                        </div>
                                        <div style={mediaGrid}>
                                            {s.xvA &&
                                                renderStudioMediaCard({
                                                    url: s.xvA,
                                                    kind: "video",
                                                    title: "Scene Video",
                                                    shot: isABMode ? "A" : undefined,
                                                    poster: s.xA || undefined,
                                                    dataPlanMedia: `scene-${s.n}-A-video`,
                                                    showUrlActions: true,
                                                })}
                                            {isABMode &&
                                                s.xvB &&
                                                renderStudioMediaCard({
                                                    url: s.xvB,
                                                    kind: "video",
                                                    title: "Scene Video",
                                                    shot: "B",
                                                    poster: s.xB || undefined,
                                                    dataPlanMedia: `scene-${s.n}-B-video`, /* data-plan-media={`scene-${s.n}-B-video`} */
                                                    showUrlActions: true,
                                                })}
                                        </div>
                                    </>
                                )}

                                {/* Per-Scene Video Reference & Three.js 3D Motion Reference */}
                                {hasSceneRefOrMotion && (
                                    <>
                                        <div style={sectionTitle}>
                                            <span>Video Reference & Three.js 3D Motion Guides</span>
                                        </div>
                                        <div style={mediaGrid}>
                                            {s.refVidA &&
                                                renderStudioMediaCard({
                                                    url: s.refVidA.url,
                                                    kind: "video",
                                                    title: "Reference Video",
                                                    shot: isABMode ? "A" : undefined,
                                                    badgeText: "Video Ref",
                                                    badgeColor: "var(--blueprint-accent-soft)",
                                                    description: s.refVidA.description,
                                                    dataPlanMedia: `scene-${s.n}-A-ref-video`,
                                                    showUrlActions: true,
                                                })}
                                            {isABMode &&
                                                s.refVidB &&
                                                renderStudioMediaCard({
                                                    url: s.refVidB.url,
                                                    kind: "video",
                                                    title: "Reference Video",
                                                    shot: "B",
                                                    badgeText: "Video Ref",
                                                    badgeColor: "var(--blueprint-accent-soft)",
                                                    description: s.refVidB.description,
                                                    dataPlanMedia: `scene-${s.n}-B-ref-video`,
                                                    showUrlActions: true,
                                                })}
                                            {s.motionVidA &&
                                                renderStudioMediaCard({
                                                    url: s.motionVidA.url,
                                                    kind: "video",
                                                    title: "3D Motion Guide",
                                                    shot: isABMode ? "A" : undefined,
                                                    badgeText: "Three.js 3D",
                                                    badgeColor: "var(--blueprint-accent-soft)",
                                                    description: s.motionVidA.description,
                                                    dataPlanMedia: `scene-${s.n}-A-motion-video`,
                                                    showUrlActions: true,
                                                })}
                                            {isABMode &&
                                                s.motionVidB &&
                                                renderStudioMediaCard({
                                                    url: s.motionVidB.url,
                                                    kind: "video",
                                                    title: "3D Motion Guide",
                                                    shot: "B",
                                                    badgeText: "Three.js 3D",
                                                    badgeColor: "var(--blueprint-accent-soft)",
                                                    description: s.motionVidB.description,
                                                    dataPlanMedia: `scene-${s.n}-B-motion-video`,
                                                    showUrlActions: true,
                                                })}
                                        </div>
                                    </>
                                )}

                                {/* Scene Audio (Dark-themed compact audio players) */}
                                {(s.xaA || (isABMode && s.xaB)) && (
                                    <>
                                        <div style={sectionTitle}>
                                            <span>Voice / Scene Audio</span>
                                        </div>
                                        <div style={dualPromptGrid}>
                                            {s.xaA && (
                                                <div
                                                    style={{
                                                        padding: "8px 12px",
                                                        borderRadius: 12,
                                                        background: "var(--blueprint-soft)",
                                                        border: "1px solid var(--blueprint-border)",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 10,
                                                    }}
                                                >
                                                    {isABMode && (
                                                        <span
                                                            style={{
                                                                ...labelPill,
                                                                background: shotAccent("A").bg,
                                                                border: `1px solid ${shotAccent("A").border}`,
                                                                color: shotAccent("A").text,
                                                            }}
                                                        >
                                                            Shot A
                                                        </span>
                                                    )}
                                                    <audio
                                                        src={s.xaA}
                                                        controls
                                                        data-plan-media={`scene-${s.n}-A-audio`}
                                                        style={{
                                                            width: "100%",
                                                            height: 36,
                                                            colorScheme: darkMode ? "dark" : "light",
                                                            filter: "none",
                                                            borderRadius: 8,
                                                        }}
                                                    />
                                                </div>
                                            )}

                                            {isABMode && s.xaB && (
                                                <div
                                                    style={{
                                                        padding: "8px 12px",
                                                        borderRadius: 12,
                                                        background: "var(--blueprint-soft)",
                                                        border: "1px solid var(--blueprint-border)",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 10,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            ...labelPill,
                                                            background: shotAccent("B").bg,
                                                            border: `1px solid ${shotAccent("B").border}`,
                                                            color: shotAccent("B").text,
                                                        }}
                                                    >
                                                        Shot B
                                                    </span>
                                                    <audio
                                                        src={s.xaB}
                                                        controls
                                                        data-plan-media={`scene-${s.n}-B-audio`}
                                                        style={{
                                                            width: "100%",
                                                            height: 36,
                                                            colorScheme: darkMode ? "dark" : "light",
                                                            filter: "none",
                                                            borderRadius: 8,
                                                        }}
                                                    />
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
                <div data-blueprint-zoom role="dialog" aria-modal="true" aria-label="Media preview"
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
                            data-ai-action="clikb.feeds.plan.close_zoom"
                            onClick={() => setZoomItem(null)}
                            style={{
                                position: "absolute",
                                top: -50,
                                right: 0,
                                color: "white",
                                background: "transparent",
                                border: "1px solid var(--blueprint-border)",
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

                        {/* Media Container */}
                        <div
                            style={{
                                flex: 1,
                                borderRadius: 18,
                                overflow: "hidden",
                                border: "1px solid var(--blueprint-border)",
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
        </div>, document.body
    );
};

export default Plan;
