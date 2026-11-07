import React, { useEffect, useRef, useState } from "react";
import { Box, Button, IconButton } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";        //  NEW  ⟵
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "./store";
import { matchMobile } from "./DetectDevice";
import { alpha, darken } from "@mui/material/styles";
import { publishFeedsArea, removeFeedsArea } from "./brainstormSlice";
import { boundedFeedTextHint, type FeedAreaId, type FeedControl } from "./feedsControlSnapshot";

interface KeywordSelectorProps {
    isDesktop: boolean;
    obscured?: boolean;
    handleSearchB: (kw: string, mode: 1 | 2) => void;
    searchData: any
}

const KeywordSelector: React.FC<KeywordSelectorProps> = ({
    isDesktop,
    obscured = false,
    handleSearchB,
    searchData
}) => {
    const dispatch = useDispatch();
    const keywords = [
        "Education",
        "space",
        "movies",
        "science",
        "news",
        "History",
        "funny",
        "anime",
        "story",
        "animals",
    ];

    const [selectedKeyword, setSelectedKeyword] = useState<string>("");
    const stripRef = useRef<HTMLDivElement>(null);
    const [stripScroll, setStripScroll] = useState({ left: 0, max: 0, visibleKeywords: '' });
    useEffect(() => {
        const strip = stripRef.current;
        if (!strip) return;
        const measure = () => {
            const bounds = strip.getBoundingClientRect();
            const visibleKeywords = Array.from(strip.querySelectorAll<HTMLElement>('[data-feed-keyword]'))
                .filter(element => {
                    const rect = element.getBoundingClientRect();
                    return rect.right > bounds.left && rect.left < bounds.right;
                }).map(element => element.dataset.feedKeyword || '').filter(Boolean).join(',');
            const next = { left: Math.round(strip.scrollLeft),
                max: Math.max(0, Math.round(strip.scrollWidth - strip.clientWidth)), visibleKeywords };
            setStripScroll(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
        };
        measure();
        strip.addEventListener('scroll', measure, { passive: true });
        window.addEventListener('resize', measure);
        return () => { strip.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); };
    }, []);
    useEffect(() => {
        const areaId: FeedAreaId = 'clikb.feeds.search_keywords';
        const control = (name: string, policy: FeedControl['aiPolicy'] = 'candidate', handlerRef = 'KeywordSelector.handleClick'): FeedControl => ({
            controlId: `${areaId}.${name}`, areaId, handlerRef,
            enabled: true, aiPolicy: policy,
            ...(policy === 'candidate' ? { candidateActionId: `${areaId}.${name}` } : {}),
        });
        dispatch(publishFeedsArea({ areaId, source: 'KeywordSelector', instanceId: 'search',
            state: {
                selectedKeyword: boundedFeedTextHint(selectedKeyword, 40),
                query: boundedFeedTextHint(searchData, 120),
                scrollOwner: 'KeywordSelector.stripRef',
                scrollLeft: stripScroll.left, scrollMax: stripScroll.max,
                canScrollLeft: stripScroll.left > 2,
                canScrollRight: stripScroll.left < stripScroll.max - 2,
                visibleKeywordIds: stripScroll.visibleKeywords,
            }, visiblePosts: [], visibleControls: obscured ? [] : [
                ...(stripScroll.visibleKeywords.split(',').includes('home') ? [control('home')] : []),
                ...keywords.filter(keyword => stripScroll.visibleKeywords.split(',').includes(`keyword_${keyword.toLowerCase()}`))
                    .map(keyword => control(`keyword_${keyword.toLowerCase()}`)),
                ...(stripScroll.max > 0 ? [control('scroll_keywords', 'manual_only', 'KeywordSelector.stripRef manual scroll')] : []),
            ],
        }));
    }, [dispatch, selectedKeyword, searchData, stripScroll, obscured]);
    useEffect(() => () => {
        dispatch(removeFeedsArea({ areaId: 'clikb.feeds.search_keywords', source: 'KeywordSelector' }));
    }, [dispatch]);

    const darkModeReducer = useSelector(
        (state: RootState) => state.settings.darkMode
    );
    const appColorDark = useSelector(
        (state: RootState) => state.settings.appColorDark
    );
    const appColorLight = useSelector(
        (state: RootState) => state.settings.appColorLight
    );
    const appColor = (darkModeReducer ? appColorDark : appColorLight)
        || (darkModeReducer ? "#E8BAFA" : "#0099cc");

    /** shared button styles (keeps the pill shape) */
    const pillStyles = (active: boolean) => ({
        borderRadius: "999px",
        flex: "0 0 auto",
        textTransform: "none",
        minWidth: isDesktop ? 104 : 88,
        height: isDesktop ? 38 : 36,
        px: isDesktop ? 2.2 : 1.7,
        border: `1px solid ${active ? "transparent" : darkModeReducer ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.16)"}`,
        color: active ? (darkModeReducer ? "#08050b" : "#ffffff") : darkModeReducer ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.78)",
        bgcolor: active ? appColor : darkModeReducer ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.5)",
        boxShadow: active ? `0 8px 18px ${alpha(appColor, darkModeReducer ? 0.22 : 0.2)}` : "none",
        fontSize: isDesktop ? "0.92rem" : "0.84rem",
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: "nowrap",
        transition: "background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 80ms ease",
        "&:hover": {
            bgcolor: active ? darken(appColor, 0.1) : darkModeReducer ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.78)",
            borderColor: active ? "transparent" : darkModeReducer ? "rgba(255,255,255,0.42)" : "rgba(0,0,0,0.22)",
        },
        "&:active": {
            transform: "scale(0.96)",
        },
    });

    const pillStyles2 = (active: boolean) => ({
        ...pillStyles(active),
        minWidth: isDesktop ? 52 : 44,
        width: isDesktop ? 52 : 44,
        px: 0,
        "& svg": {
            fontSize: isDesktop ? 24 : 22,
        },
    });

    /** click handler for both keyword-text and Home icon */
    const handleClick = (kw: string) => {
        if (selectedKeyword === kw) {
            setSelectedKeyword("");
            handleSearchB(kw, 2); // toggle off
        } else {
            setSelectedKeyword(kw);
            handleSearchB(kw, 1); // toggle on
        }
    };

    return (
        <Box
            sx={{
                width: "100%",
                px: 0,
                py: matchMobile ? 0.75 : 0.6,
                borderRadius: "0vh",
                backdropFilter: "blur(12px)",
                alignItems: "center",
                boxSizing: "border-box",

            }}
        >
            <Box
                ref={stripRef}
                sx={{
                    width: "100%",
                    display: "flex",
                    gap: isDesktop ? 0.75 : 0.7,
                    height: "auto",
                    minHeight: isDesktop ? 40 : 38,
                    paddingTop: 0,
                    paddingBottom: 0,
                    overflowX: "auto",
                    touchAction: "pan-x",
                    WebkitOverflowScrolling: "touch",
                    flexWrap: "nowrap",
                    pr: 0,
                    "&::-webkit-scrollbar": { display: "none" },
                }}
            >
                {/* HOME ICON BUTTON — keeps same pill style */}
                <IconButton
                    data-feed-keyword="home"
                    data-ai-action="clikb.feeds.search_keywords.home"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { handleClick(""); (document.activeElement as HTMLElement | null)?.blur(); }}
                    disableRipple
                    sx={pillStyles2(!searchData)}
                >
                    <HomeIcon />
                </IconButton>

                {/* TEXT KEYWORDS */}
                {keywords.map((kw) => (
                    <Button
                        data-feed-keyword={`keyword_${kw.toLowerCase()}`}
                        data-ai-action={`clikb.feeds.search_keywords.keyword_${kw.toLowerCase()}`}
                        key={kw}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { handleClick(kw); (document.activeElement as HTMLElement | null)?.blur(); }}
                        variant={selectedKeyword === kw ? "contained" : "outlined"}
                        disableElevation
                        disableRipple
                        sx={pillStyles(searchData === kw)}
                    >
                        {kw}
                    </Button>
                ))}
            </Box>
        </Box>
    );
};

export default KeywordSelector;
