import React, { useState } from "react";
import {
    AppBar,
    Toolbar,
    Box,
    Button,
    Typography,
    CircularProgress,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    List,
    ListItemButton,
    TextField,
} from "@mui/material";



import { keyframes } from "@emotion/react";

import { matchMobile } from "./DetectDevice";

import CloseIcon from "@mui/icons-material/Close";
import CancelPresentationIcon from "@mui/icons-material/CancelPresentation";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import axios from "axios"; // Import Axios



interface PromptToolbarProps {
    /** click handler for the close (x) icon */
    onClose: () => void;
    allowSpin: boolean;
    parsedKeyPoints: any;
    GeneratedImageFlux: any;
    handleCloseOverlay: any;
    selectedStyle: any;
    setSelectedStyle: any;
    setPrompt: any;
    Manual: any
    type: any
}

const PromptToolbar: React.FC<PromptToolbarProps> = ({
    onClose,
    allowSpin,
    parsedKeyPoints,
    GeneratedImageFlux,
    handleCloseOverlay,
    selectedStyle,
    setSelectedStyle,
    setPrompt,
    Manual,
    type
}) => {


    const CLIK_URL = import.meta.env.VITE_CLIK_URL;



    const darkModeReducer = useSelector(
        (state: RootState) => state.settings.darkMode
    );
    const darkMode = darkModeReducer;


    const isDarkMode = darkModeReducer;

    /* ------ palette helpers ------ */
    const bgDialog = isDarkMode ? "#121212" : "#ffffff";
    const bgList = isDarkMode ? "#1e1e1e" : "#fafafa";
    const textPrimary = isDarkMode ? "#ffffff" : "#ffffff";
    const dividerColor = isDarkMode ? "rgba(255,255,255,0.12)" : "#e0e0e0";

    const selectedItemStyle = {
        backgroundColor: "#F6BB56",
        color: "#000000",
    };

    const defaultItemStyle = {
        color: textPrimary,
    };


    const glassSweep = keyframes`
      from { transform: translateX(-150%) rotate(20deg); }
      to   { transform: translateX(150%)  rotate(20deg); }
    `;


    // Customize padding for both buttons here.
    const buttonPadding = { px: 3, py: 1.5 } as const;

    // ---------------- Art‑style picker state ----------------
    const [styleModalOpen, setStyleModalOpen] = useState(false);

    const [customStyleInput, setCustomStyleInput] = useState<string>("");

    /* ---------------- Allowed art styles ---------------- */
    const artStyles: string[] = [
        "Pixar",
        "PhotoRealistic",
        "Anime",
        "Comic Book",
        "Final Fantasy",
        "MineCraft",
        "3D Render",
        "Fantasy Art",
        "Sci-Fi",
        "Pop Art",
        "Chibi",
    ];


    const handleSelectStyle = (style: string) => {
        setSelectedStyle(style);
        setStyleModalOpen(false);
        // any other side‑effects (e.g., dispatch) can be added here
    };

    const handleSaveCustom = () => {
        if (customStyleInput.trim()) {
            handleSelectStyle(customStyleInput.trim());
            setCustomStyleInput("");
        }
    };




    // Define the EnhanceText function
    const StartSample = async (pp: any, prompt: any) => {

        try {
            // Prepare the request payload
            const requestData: any = { pp, prompt };

            // Make the POST request to the server
            const response = await axios.post<any>(
                `${CLIK_URL}/examplestory`,
                requestData,
                { withCredentials: true }
            );

            // Extract data from the response
            const data = response.data;


            console.log("example data", data);


            const parsed: any = data.initialSteps;



            console.log("example ", data.initialSteps.keyPoints[0]);

            setPrompt(data.initialSteps.keyPoints[0]);

        } catch (error: any) {


        } finally {
            ///setIsLoading(false);
        }
    }




    return (
        <>
            <AppBar
                position="static"
                elevation={1}
                color="transparent"
                sx={{ width: "100%", mb: 1 }}
            >
                <Toolbar
                    disableGutters
                    sx={{
                        px: 2,
                        py: 1,
                        display: "flex",
                        alignItems: "center",
                        borderRadius: 1,
                        boxShadow: 1,
                    }}
                >
                    {/* 30% – Art Style button */}
                    <Box sx={{ flexBasis: "30%", pr: 1 }}>
                        <Button
                            variant="contained"
                            size="small"
                            onClick={() => setStyleModalOpen(true)}
                            disableRipple
                            disableFocusRipple
                            sx={{
                                /* layout */
                                width: "100%",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",

                                /* glass skin */
                                background: darkMode
                                    ? "rgba(25,25,25,0.25)"
                                    : "rgba(255,255,255,0.25)",
                                color: darkMode ? "#ffffff" : "#000000",
                                ...buttonPadding,

                                border: "none",
                                borderRadius: 12,
                                boxShadow: darkMode
                                    ? "0 12px 32px rgba(0,0,0,0.8)"
                                    : "0 12px 32px rgba(160,160,160,0.8)",
                                transform: "translateY(-2px)",

                                transition:
                                    "background 250ms ease, box-shadow 250ms ease, transform 120ms ease",
                                display: "flex",

                                /* —— sweep overlay (hidden until hover/press) —— */
                                position: "relative",
                                overflow: "hidden",
                                "&::before": {
                                    content: '""',
                                    position: "absolute",
                                    top: "-40%",
                                    left: 0,
                                    width: "60%",
                                    height: "180%",
                                    background:
                                        "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)",
                                    backgroundSize: "200% 200%",
                                    transform: "translateX(-150%) rotate(20deg)",
                                    opacity: 0,
                                    pointerEvents: "none",
                                },

                                /* hover */
                                "&:hover": {
                                    background: darkMode
                                        ? "rgba(25,25,25,0.35)"
                                        : "rgba(255,255,255,0.35)",
                                    boxShadow: darkMode
                                        ? "0 12px 32px rgba(0,0,0,0.8)"
                                        : "0 12px 32px rgba(0,0,0,0.3)",
                                    transform: "translateY(0)",
                                    "&::before": {
                                        opacity: 0.8,
                                        animation: `${glassSweep} 1.8s ease-out forwards`,
                                    },
                                },

                                /* active */
                                "&:active": {
                                    background: darkMode
                                        ? "rgba(25,25,25,0.45)"
                                        : "rgba(255,255,255,0.45)",
                                    boxShadow: "0 4px 16px rgba(0,0,0,0.30)",
                                    transform: "translateY(0)",
                                    "&::before": {
                                        opacity: 0.8,
                                        animation: `${glassSweep} 1.2s ease-out forwards`,
                                    },
                                },

                                /* focus tidy */
                                "&:focus, &:focus-visible, &.Mui-focusVisible": {
                                    outline: "none",
                                    boxShadow: "none",
                                    backgroundColor: "rgba(255,255,255,0.10)",
                                },
                                WebkitTapHighlightColor: "transparent",
                                "::-moz-focus-inner": { border: 0 },
                            }}
                        >
                            <Typography variant="button" sx={{ lineHeight: 1 }}>
                                Style
                            </Typography>

                            <Typography
                                variant="caption"
                                sx={{
                                    lineHeight: 1,
                                    fontSize: "0.6rem",
                                    mt: 0.75,
                                    color: darkMode ? "#F6BB56" : "#ffffff",
                                }}
                            >
                                {selectedStyle.length > 8 ? `${selectedStyle.slice(0, 8)}…` : selectedStyle}
                            </Typography>
                        </Button>
                    </Box>


                    {/* 30% – Credits button (hidden caption for consistent size) */}
                    <Box sx={{ flexBasis: "30%", pr: 1 }}>
                        <Button
                            variant="contained"
                            size="small"
                            disableRipple
                            disableFocusRipple
                            sx={{
                                /* layout (unchanged) */
                                width: "100%",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",

                                /* glass design */
                                background: darkMode
                                    ? "rgba(25,25,25,0.25)"
                                    : "rgba(255,255,255,0.25)",
                                color: darkMode ? "#ffffff" : "#000000",
                                ...buttonPadding,

                                border: "none",
                                borderRadius: 12,
                                boxShadow: darkMode
                                    ? "0 12px 32px rgba(0,0,0,0.8)"
                                    : "0 12px 32px rgba(160,160,160,0.8)",
                                transform: "translateY(-2px)",

                                transition:
                                    "background 250ms ease, box-shadow 250ms ease, transform 120ms ease",
                                display: "flex",

                                /* ── sweep overlay base (hidden) ── */
                                position: "relative",
                                overflow: "hidden",
                                "&::before": {
                                    content: '""',
                                    position: "absolute",
                                    top: "-40%",
                                    left: 0,
                                    width: "60%",
                                    height: "180%",
                                    background:
                                        "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)",
                                    backgroundSize: "200% 200%",
                                    transform: "translateX(-150%) rotate(20deg)",
                                    opacity: 0,
                                    pointerEvents: "none",
                                },

                                /* hover */
                                "&:hover": {
                                    background: darkMode
                                        ? "rgba(25,25,25,0.35)"
                                        : "rgba(255,255,255,0.35)",
                                    boxShadow: darkMode
                                        ? "0 12px 32px rgba(0,0,0,0.8)"
                                        : "0 12px 32px rgba(0,0,0,0.3)",
                                    transform: "translateY(0)",
                                    "&::before": {
                                        opacity: 0.8,
                                        animation: `${glassSweep} 1.8s ease-out forwards`,
                                    },
                                },

                                /* active */
                                "&:active": {
                                    background: darkMode
                                        ? "rgba(25,25,25,0.45)"
                                        : "rgba(255,255,255,0.45)",
                                    boxShadow: "0 4px 16px rgba(0,0,0,0.30)",
                                    transform: "translateY(0)",
                                    "&::before": {
                                        opacity: 0.8,
                                        animation: `${glassSweep} 1.2s ease-out forwards`,
                                    },
                                },

                                /* custom focus tint (no blue outline) */
                                "&:focus, &:focus-visible, &.Mui-focusVisible": {
                                    outline: "none",
                                    boxShadow: "none",
                                    backgroundColor: "rgba(255,255,255,0.10)",
                                },
                                WebkitTapHighlightColor: "transparent",
                                "::-moz-focus-inner": { border: 0 },
                            }}
                        >
                            <Typography variant="button" sx={{ lineHeight: 1 }}>
                                Unlimited
                            </Typography>

                            <Typography
                                variant="caption"
                                sx={{
                                    visibility: "hidden",
                                    lineHeight: 1,
                                    fontSize: "0.55rem",
                                    mt: 0.75,
                                }}
                            >
                                Automatic
                            </Typography>
                        </Button>

                    </Box>

                    {/* 20% – Spinner */}
                    <Box
                        sx={{
                            flexBasis: "20%",
                            display: "flex",
                            justifyContent: "center",
                        }}
                    >
                        <CircularProgress
                            size={24}

                            style={{
                                color: "#F6BB56",
                                filter: "drop-shadow(0 0 4px rgba(0,0,0,.8))", // halo
                                display: allowSpin ? "block" : "none",
                            }}
                        />
                    </Box>

                    {/* 20% – Close icon */}

                    {GeneratedImageFlux || parsedKeyPoints.length > 0 ? (
                        /* ——— CANCEL / CLOSE ICON ——— */
                        <Box sx={{ flexBasis: "20%", display: "flex", justifyContent: "flex-end" }}>
                            <IconButton
                                edge="end"
                                onClick={handleCloseOverlay}
                                aria-label="close"
                                disableRipple
                                disableFocusRipple
                                sx={{
                                    /* glass skin */
                                    background: darkMode
                                        ? "rgba(25,25,25,0.05)"
                                        : "rgba(200,200,200,0.06)",
                                    ...buttonPadding,
                                    border: "none",
                                    borderRadius: 12,
                                    boxShadow: "0 12px 32px rgba(0,0,0,0.1)",
                                    transform: "translateY(-2px)",

                                    transition:
                                        "background 250ms ease, box-shadow 250ms ease, transform 120ms ease",

                                    /* ── sweep overlay (hidden until hover/press) ── */
                                    position: "relative",
                                    overflow: "hidden",
                                    "&::before": {
                                        content: '""',
                                        position: "absolute",
                                        top: "-40%",
                                        left: 0,
                                        width: "60%",
                                        height: "180%",
                                        background:
                                            "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)",
                                        backgroundSize: "200% 200%",
                                        transform: "translateX(-150%) rotate(20deg)",
                                        opacity: 0,
                                        pointerEvents: "none",
                                    },

                                    /* hover / press */
                                    "&:hover": {
                                        background: darkMode
                                            ? "rgba(25,25,25,0.35)"
                                            : "rgba(255,255,255,0.05)",
                                        transform: "translateY(0)",
                                        "&::before": {
                                            opacity: 0.8,
                                            animation: `${glassSweep} 1.8s ease-out forwards`,
                                        },
                                    },
                                    "&:active": {
                                        background: darkMode
                                            ? "rgba(25,25,25,0.05)"
                                            : "rgba(255,255,255,0.05)",
                                        boxShadow: "0 4px 16px rgba(0,0,0,0.00)",
                                        transform: "translateY(0)",
                                        "&::before": {
                                            opacity: 0.8,
                                            animation: `${glassSweep} 1.2s ease-out forwards`,
                                        },
                                    },

                                    /* custom focus tint */
                                    "&:focus, &:focus-visible, &.Mui-focusVisible": {
                                        outline: "none",
                                        boxShadow: "none",
                                        backgroundColor: "rgba(255,255,255,0.0070)",
                                    },
                                    WebkitTapHighlightColor: "transparent",
                                    "::-moz-focus-inner": { border: 0 },
                                }}
                            >
                                <CancelPresentationIcon
                                    sx={{
                                        fontSize: "2.5rem",
                                        color: "#F6BB56",
                                        visibility:
                                            GeneratedImageFlux || parsedKeyPoints.length > 0
                                                ? "visible"
                                                : "hidden",
                                    }}
                                />
                            </IconButton>
                        </Box>
                    ) : (
                        /* ——— MANUAL / EXAMPLES BUTTON ——— */
                        <Box
                            onClick={() => {
                                if (type === 0) Manual();
                                else StartSample("", "");
                            }}
                            sx={{ flexBasis: "40%", pr: 1, display: allowSpin ? "none" : "block" }}
                        >
                            <Button
                                variant="contained"
                                size="small"
                                disableRipple
                                disableFocusRipple
                                sx={{
                                    width: "100%",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    justifyContent: "center",

                                    background: darkMode
                                        ? "rgba(25,25,25,0.25)"
                                        : "rgba(255,255,255,0.25)",
                                    color: darkMode ? "#ffffff" : "#000000",
                                    ...buttonPadding,
                                    border: "none",
                                    borderRadius: 12,

                                    transform: "translateY(-2px)",

                                    transition:
                                        "background 250ms ease, box-shadow 250ms ease, transform 120ms ease",
                                    display: "flex",

                                    /* ─── sweep overlay: hidden base ─── */
                                    position: "relative",
                                    overflow: "hidden",
                                    "&::before": {
                                        content: '""',
                                        position: "absolute",
                                        top: "-40%",
                                        left: 0,
                                        width: "60%",
                                        height: "180%",
                                        background:
                                            "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)",
                                        backgroundSize: "200% 200%",
                                        transform: "translateX(-150%) rotate(20deg)",
                                        opacity: 0,
                                        pointerEvents: "none",
                                    },

                                    /* hover / press */
                                    "&:hover": {
                                        background: darkMode
                                            ? "rgba(25,25,25,0.35)"
                                            : "rgba(255,255,255,0.35)",
                                        transform: "translateY(0)",
                                        "&::before": {
                                            opacity: 0.8,
                                            animation: `${glassSweep} 1.8s ease-out forwards`,
                                        },
                                    },
                                    "&:active": {
                                        background: darkMode
                                            ? "rgba(25,25,25,0.45)"
                                            : "rgba(255,255,255,0.45)",
                                        boxShadow: "0 4px 16px rgba(0,0,0,0.30)",
                                        transform: "translateY(0)",
                                        "&::before": {
                                            opacity: 0.8,
                                            animation: `${glassSweep} 1.2s ease-out forwards`,
                                        },
                                    },

                                    /* custom focus tint */
                                    "&:focus, &:focus-visible, &.Mui-focusVisible": {
                                        outline: "none",
                                        boxShadow: "none",
                                        backgroundColor: "rgba(255,255,255,0.10)",
                                    },
                                    WebkitTapHighlightColor: "transparent",
                                    "::-moz-focus-inner": { border: 0 },
                                }}
                            >
                                <Typography variant="button" sx={{ lineHeight: 1 }}>
                                    {type === 0 ? "Upload" : "Examples"}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        visibility: "hidden",
                                        lineHeight: 1,
                                        fontSize: "0.55rem",
                                        mt: 0.75,
                                    }}
                                >
                                    Examples
                                </Typography>
                            </Button>
                        </Box>
                    )}


                </Toolbar>
            </AppBar >



            <Dialog
                open={styleModalOpen}
                onClose={() => setStyleModalOpen(false)}
                fullWidth
                maxWidth="sm"
                PaperProps={{
                    style: {
                        backgroundColor: darkModeReducer ? 'rgb(5,5,5,0.25)' : "rgb(205,205,205,0.25)",
                        backdropFilter: darkModeReducer ? matchMobile ? "blur(18px)" : "blur(30px)" : matchMobile ? "blur(12px)" : "blur(18px)",

                    }
                }}
                style={{ position: "fixed", zIndex: 6000 }}
            >
                <DialogTitle style={{ paddingBottom: 0, color: textPrimary }}>
                    Select Art Style
                </DialogTitle>

                <DialogContent style={{ paddingTop: 8 }}>
                    {/* --- ALWAYS-VISIBLE “Auto” OPTION --- */}
                    <List style={{ paddingTop: 0 }}>
                        <ListItemButton
                            selected={selectedStyle === "Auto"}
                            onClick={() => handleSelectStyle("Auto")}
                            style={
                                selectedStyle === "Auto" ? selectedItemStyle : defaultItemStyle
                            }
                        >
                            <Typography variant="body1">Auto</Typography>
                        </ListItemButton>
                    </List>

                    {/* --- SCROLLABLE LIST OF PREDEFINED STYLES --- */}
                    <List
                        style={{
                            maxHeight: matchMobile ? "46vh" : "50vh",
                            overflow: "auto",
                            marginTop: 8,
                            borderTop: `1px solid ${dividerColor}`,
                            ///backgroundColor: bgList,
                        }}
                    >
                        {artStyles.map((style) => (
                            <ListItemButton
                                key={style}
                                selected={selectedStyle === style}
                                onClick={() => handleSelectStyle(style)}
                                style={
                                    selectedStyle === style ? selectedItemStyle : defaultItemStyle
                                }
                            >
                                <Typography variant="body1">{style}</Typography>
                            </ListItemButton>
                        ))}
                    </List>

                    {/* --- CUSTOM STYLE INPUT (BOTTOM) --- */}
                    <Box style={{ marginTop: 16 }}>
                        <TextField
                            label="Custom style"
                            variant="outlined"
                            fullWidth
                            value={customStyleInput}
                            onChange={(e) => setCustomStyleInput(e.target.value)}
                            onBlur={handleSaveCustom}
                            placeholder="Enter custom style (press Enter)"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSaveCustom();
                                }
                            }}
                            InputLabelProps={{ style: { color: textPrimary } }}
                            InputProps={{ style: { color: textPrimary } }}
                        />
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button onClick={() => setStyleModalOpen(false)}>Done</Button>
                </DialogActions>
            </Dialog>




        </>
    );
};

export default PromptToolbar;
