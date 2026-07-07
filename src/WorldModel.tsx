import React, { useState } from "react";
import { Box, Typography, Backdrop, Fade, IconButton, Button } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PublicIcon from "@mui/icons-material/Public";
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import GridViewIcon from '@mui/icons-material/GridView';
import { keyframes } from "@emotion/react";
import WorldCreation from "./WorldCreation";
import WorldList from "./WorldList"; // Import the separated component

interface WorldModelProps {
    open: boolean;
    onClose: () => void;
    mode?: number;
    steps: string[];
    ImagesHdCloud: string[];
    GeneratedText: string[];
    Planx: any;
    handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    darkMode: boolean;
    matchMobile: boolean;
    isMenuOpen?: boolean;
    modelz?: string;
    GeneratedImageFlux?: any;
    parsedKeyPoints?: any[];
    GeneratedImageFirst?: string;
    prompt?: any;
    Seed: any;
    PostId: any;
    selectedStyle: any;
    selectedImages: any;
    handleSelection: any;
    setWorldModelsInuse?: any;
    DirectUpload?: any;
    setRemixData?: any;
    setWorldCover?: any;
    setWorldStyle?: any;
    Vipcharacters?: any[];
    setVipcharacters?: any;
    referenceImages?: any[];
}

const WorldModel: React.FC<WorldModelProps> = ({
    open,
    onClose,
    mode,
    steps,
    ImagesHdCloud,
    GeneratedText,
    Planx,
    handleFileChange,
    darkMode,
    matchMobile,
    GeneratedImageFirst,
    prompt,
    modelz,
    Seed,
    PostId,
    selectedStyle,
    selectedImages,
    handleSelection,
    setWorldModelsInuse,
    DirectUpload,
    setRemixData,
    setWorldCover,
    setWorldStyle,
    Vipcharacters,
    setVipcharacters,
    referenceImages

}) => {
    const [creationDone, setCreationDone] = useState(false);

    var k: any = 2;


    const PRIMARY_COLOR = darkMode ? '#E8BAFA' : '#0099cc';
    const BG_COLOR = darkMode
        ? "linear-gradient(145deg, rgba(30,30,30,0.98), rgba(10,10,10,0.99))"
        : "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(240,240,240,0.98))";

    const glassSweep = keyframes`
      from { transform: translateX(-150%) rotate(20deg); }
      to   { transform: translateX(150%)  rotate(20deg); }
    `;

    const glassButtonSx = {
        borderRadius: 2,
        background: darkMode ? "rgba(25,25,25,0.25)" : "rgba(255,255,255,0.25)",
        color: darkMode ? '#E8BAFA' : '#000',
        border: "none",
        boxShadow: darkMode ? "0 8px 32px rgba(0,0,0,.55)" : "0 8px 32px rgba(0,0,0,.15)",
        transform: "translateY(-2px)",
        transition: "background .25s ease, box-shadow .25s ease, transform .12s ease",
        position: "relative",
        overflow: "hidden",
        "&::before": {
            content: '""',
            position: "absolute",
            top: "-40%",
            left: 0,
            width: "60%",
            height: "180%",
            background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)",
            opacity: 0,
            pointerEvents: "none",
        },
        "&:hover": {
            background: darkMode ? "rgba(25,25,25,0.35)" : "rgba(255,255,255,0.35)",
            transform: "translateY(0)",
            "&::before": { opacity: 0.8, animation: `${glassSweep} 1.8s ease-out forwards` },
        },
        "&:active": {
            background: darkMode ? "rgba(25,25,25,0.45)" : "rgba(255,255,255,0.45)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.30)",
            transform: "translateY(0)",
            "&::before": { opacity: 0.9, animation: `${glassSweep} 1.1s ease-out forwards` },
        },
        minWidth: matchMobile ? "140px" : "200px",
        px: 3,
        py: 1.5,
        fontSize: matchMobile ? "0.9rem" : "1.1rem",
        fontWeight: "bold",
        textTransform: "none" as const,
        display: "flex",
        alignItems: "center",
        gap: 1,
    };

    return (
        <Backdrop
            sx={{
                zIndex: 9999,
                color: "#fff",
                backdropFilter: "blur(12px)",
                backgroundColor: "rgba(40,40,40,0.95)",
                position: "fixed",
                top: 0,
                left: 0,
                width: "100%",
                height: "100vh",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                pt: matchMobile ? 0 : "2vh"
            }}
            open={open}
            onClick={onClose}
        >
            <Fade in={open}>
                <Box
                    onClick={(e) => e.stopPropagation()}
                    sx={{
                        position: "relative",
                        width: matchMobile ? "100%" : "95%",
                        maxWidth: "1400px",
                        height: "90vh",
                        maxHeight: "90vh",
                        borderRadius: matchMobile ? "0px" : "20px",
                        background: BG_COLOR,
                        borderTop: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                        borderBottom: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                        boxShadow: "0 0 50px rgba(0,0,0,0.8)",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                    }}
                >
                    {/* --- HEADER --- */}
                    <Box sx={{
                        width: "100%",
                        p: 2,
                        px: matchMobile ? 2 : 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderBottom: `1px solid ${darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}`,
                        gap: 2,
                        flex: "0 0 auto",
                        zIndex: 10,
                        background: "inherit"
                    }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 2, minWidth: "fit-content", order: 1 }}>
                            {mode === 0 ? (
                                <GridViewIcon sx={{ fontSize: matchMobile ? 28 : 32, color: PRIMARY_COLOR }} />
                            ) : mode === 2 ? (
                                <AssignmentIndIcon sx={{ fontSize: matchMobile ? 28 : 32, color: PRIMARY_COLOR }} />

                            ) : (
                                <PublicIcon sx={{ fontSize: matchMobile ? 28 : 32, color: PRIMARY_COLOR }} />
                            )}

                            {!matchMobile && (
                                <Typography variant="h5" sx={{ fontWeight: 900, fontSize: "1.5rem", background: `linear-gradient(45deg, ${PRIMARY_COLOR}, ${darkMode ? "#FFF" : PRIMARY_COLOR})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: 1 }}>
                                    {mode === 0 ? "My Worlds" : mode === 2 ? "Select a Persona" : "World Creation"}
                                </Typography>
                            )}
                        </Box>

                        <Box sx={{ flex: 1, display: "flex", justifyContent: "center", order: matchMobile ? 3 : 2, width: matchMobile ? "100%" : "auto" }}>
                            {/* Only show Upload button in Creation Mode (1) */}
                            {mode === 0 || mode === 2 ? (
                                <Button variant="contained" component="label" disableRipple disableFocusRipple sx={{ ...glassButtonSx, display: "flex" }}>
                                    <ArrowForwardIcon sx={{ fontSize: matchMobile ? "1.3rem" : "1.6rem" }} />
                                    {matchMobile ? "Upload" : "Direct Upload"}
                                    <input hidden type="file" accept="image/*" onChange={(e) => {
                                        handleFileChange(e);

                                        onClose();
                                    }} />
                                </Button>
                            ) : null}
                        </Box>

                        <Box sx={{ order: matchMobile ? 2 : 3 }}>
                            <IconButton onClick={onClose} sx={{ color: darkMode ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.7)", "&:hover": { color: darkMode ? "#fff" : "#000" } }}>
                                <CloseIcon fontSize="medium" />
                            </IconButton>
                        </Box>
                    </Box>

                    {/* --- BODY --- */}
                    <Box
                        sx={{
                            flex: 1,
                            width: "100%",
                            position: "relative",
                            overflowY: matchMobile ? "auto" : "hidden",
                            overflowX: "hidden",
                            p: matchMobile ? 2 : 1,
                        }}
                    >
                        {/* MODE 0: LIST VIEW */}

                        {mode === 0 || mode === 2 || creationDone ?

                            <>
                                <WorldList
                                    setWorldStyle={setWorldStyle}
                                    setRemixData={setRemixData}
                                    setWorldCover={setWorldCover}

                                    onClose={onClose}
                                    DirectUpload={DirectUpload}
                                    setWorldModelsInuse={setWorldModelsInuse}
                                    selectedImages={selectedImages}
                                    handleSelection={handleSelection}
                                    Vipcharacters={Vipcharacters}
                                    setVipcharacters={setVipcharacters}

                                    open={open}
                                    mode={creationDone ? k : mode}
                                    darkMode={darkMode}
                                    PRIMARY_COLOR={PRIMARY_COLOR} />

                            </> : null}

                        {/* MODE 1: CREATION VIEW */}
                        {mode === 1 && open && !creationDone && (
                            <WorldCreation
                                onClose={onClose}
                                setCreationDone={setCreationDone}
                                PostId={PostId}
                                selectedStyle={selectedStyle}
                                Seed={Seed}
                                modelz={modelz}
                                ImagesHdCloud={ImagesHdCloud}
                                open={open}
                                prompt={prompt}
                                matchMobile={matchMobile}
                                darkMode={darkMode}
                                PRIMARY_COLOR={PRIMARY_COLOR}
                                Planx={Planx}
                                GeneratedText={GeneratedText}
                                steps={steps}
                                GeneratedImageFirst={GeneratedImageFirst}
                                Vipcharacters={Vipcharacters}
                                referenceImages={referenceImages}
                            />
                        )}

                        {/* Fallback / Other Modes */}
                        {mode === 2 && <Typography sx={{ color: darkMode ? "#fff" : "#000", textAlign: "center", mt: 4 }}>Edit Mode Placeholder</Typography>}


                    </Box>
                </Box>
            </Fade>
        </Backdrop>
    );
};

export default WorldModel;
