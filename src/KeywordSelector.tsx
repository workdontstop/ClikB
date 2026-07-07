import React, { useState } from "react";
import { Box, Button, IconButton } from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";        //  NEW  âŸµ
import { useSelector } from "react-redux";
import { RootState } from "./store";
import { matchMobile } from "./DetectDevice";

interface KeywordSelectorProps {
    isDesktop: boolean;
    handleSearchB: (kw: string, mode: 1 | 2) => void;
    searchData: any
}

const KeywordSelector: React.FC<KeywordSelectorProps> = ({
    isDesktop,
    handleSearchB,
    searchData
}) => {
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

    const darkModeReducer = useSelector(
        (state: RootState) => state.settings.darkMode
    );

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
        bgcolor: active ? darkModeReducer ? '#E8BAFA' : '#0099cc' : darkModeReducer ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.5)",
        boxShadow: active ? darkModeReducer ? "0 8px 18px rgba(232,186,250,0.22)" : "0 8px 18px rgba(0,153,204,0.2)" : "none",
        fontSize: isDesktop ? "0.92rem" : "0.84rem",
        fontWeight: 700,
        lineHeight: 1,
        whiteSpace: "nowrap",
        transition: "background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 80ms ease",
        "&:hover": {
            bgcolor: active ? darkModeReducer ? '#D9A6F0' : '#0088b8' : darkModeReducer ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.78)",
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
                {/* HOME ICON BUTTON â€” keeps same pill style */}
                <IconButton
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
