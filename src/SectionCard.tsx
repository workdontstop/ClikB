// SectionCard.tsx
import React, { memo } from "react";
import { Box, Typography, Button, Fade, CircularProgress } from "@mui/material";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import EditIcon from "@mui/icons-material/Edit";

export interface SectionCardProps {
    // original props
    label: string;
    value?: string;
    placeholder?: string;
    isCharacter?: boolean;
    charIndex?: number;
    charImage?: string | null;

    // NEW: pass in what the old inline component was closing over
    expandedSection: string | null;
    loadingIndices: number[];
    handleToggle: (label: string) => void;
    handleOpenImageModal: (index: number) => void;

    // UI deps
    matchMobile: boolean;
    darkMode: boolean;
    PRIMARY_COLOR: string;
}

const SectionCard: React.FC<SectionCardProps> = ({
    label,
    value,
    placeholder,
    isCharacter = false,
    charIndex = -1,
    charImage = null,

    expandedSection,
    loadingIndices,
    handleToggle,
    handleOpenImageModal,

    matchMobile,
    darkMode,
    PRIMARY_COLOR,
}) => {
    const isExpanded = expandedSection === label;
    const isThisCharLoading = isCharacter && loadingIndices.includes(charIndex);

    return (
        <Box
            onClick={() => handleToggle(label)}
            sx={{
                p: matchMobile ? 2 : 2.5,
                borderRadius: 3,
                background: darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                border: `1px solid ${isExpanded
                        ? PRIMARY_COLOR
                        : darkMode
                            ? "rgba(255,255,255,0.10)"
                            : "rgba(0,0,0,0.08)"
                    }`,
                width: "100%",
                flexShrink: 0,
                cursor: "pointer",
                position: "relative",
                transition: "all 0.2s ease-in-out",
                "&:hover": {
                    background: darkMode ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.06)",
                },
            }}
        >
            {/* --- Header: Icon + Label --- */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 1,
                    minHeight: "32px",
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    {isCharacter && (
                        <AssignmentIndIcon sx={{ color: PRIMARY_COLOR, fontSize: "1.2rem" }} />
                    )}

                    <Typography
                        variant="caption"
                        sx={{
                            color: PRIMARY_COLOR,
                            fontWeight: 900,
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            display: "block",
                        }}
                    >
                        {label}
                    </Typography>

                    {isThisCharLoading && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <CircularProgress size={14} sx={{ color: PRIMARY_COLOR }} />
                            <Typography variant="caption" sx={{ color: PRIMARY_COLOR, opacity: 0.8 }}>
                                Generating...
                            </Typography>
                        </Box>
                    )}
                </Box>

                {/* Collapsed "Gen Photo" Button */}
                {isCharacter && !charImage && !isExpanded && !isThisCharLoading && (
                    <Fade in={true}>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AddPhotoAlternateIcon sx={{ fontSize: "1rem !important" }} />}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOpenImageModal(charIndex);
                            }}
                            sx={{
                                fontSize: "0.75rem",
                                fontWeight: 700,
                                py: 0.5,
                                px: 2,
                                minWidth: "auto",
                                borderRadius: 4,
                                borderWidth: "1px",
                                borderColor: darkMode ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
                                color: darkMode ? "#fff" : "#000",
                                zIndex: 5,
                                "&:hover": {
                                    borderColor: PRIMARY_COLOR,
                                    color: PRIMARY_COLOR,
                                    background: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                                },
                            }}
                        >
                            Gen Photo
                        </Button>
                    </Fade>
                )}
            </Box>

            {/* --- IMAGE SECTION (EXPANDED) --- */}
            {isCharacter && (
                <Box sx={{ mb: 2, mt: 2, width: "100%", display: "flex", justifyContent: "center" }}>
                    {isThisCharLoading ? (
                        <Box
                            sx={{
                                width: "100%",
                                height: "150px",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 2,
                                border: `1px dashed ${PRIMARY_COLOR}`,
                                borderRadius: 3,
                                bgcolor: darkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
                            }}
                        >
                            <CircularProgress size={30} sx={{ color: PRIMARY_COLOR }} />
                            <Typography variant="caption">Creating Character...</Typography>
                        </Box>
                    ) : charImage ? (
                        <Box
                            sx={{
                                width: "100%",
                                maxWidth: "100%",
                                height: isExpanded ? { xs: "45vh", md: "47vh" } : { xs: "25vh", md: "27vh" },
                                minHeight: isExpanded ? { xs: "45vh", md: "47vh" } : { xs: "25vh", md: "27vh" },
                                borderRadius: 3,
                                overflow: "hidden",
                                flexShrink: 0,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: darkMode ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.6)",
                                position: "relative",
                                border: `1px solid ${darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"
                                    }`,
                            }}
                        >
                            <Box
                                component="img"
                                src={charImage}
                                alt={`Character ${charIndex}`}
                                sx={{
                                    width: "100%",
                                    height: "100%",
                                    display: "block",
                                    objectFit: "contain",
                                    objectPosition: "center",
                                }}
                            />

                            <Button
                                variant="contained"
                                size="small"
                                startIcon={<EditIcon />}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenImageModal(charIndex);
                                }}
                                sx={{
                                    position: "absolute",
                                    bottom: 16,
                                    right: 16,
                                    bgcolor: "rgba(0,0,0,0.6)",
                                    backdropFilter: "blur(4px)",
                                    color: "#fff",
                                    textTransform: "none",
                                    fontWeight: 700,
                                    borderRadius: 2,
                                    "&:hover": { bgcolor: PRIMARY_COLOR, color: "#000" },
                                }}
                            >
                                Edit Photo
                            </Button>
                        </Box>
                    ) : (
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<AddPhotoAlternateIcon />}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOpenImageModal(charIndex);
                            }}
                            sx={{
                                height: "100px",
                                borderStyle: "dashed",
                                borderWidth: "2px",
                                borderRadius: 3,
                                color: darkMode ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)",
                                borderColor: darkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)",
                                textTransform: "none",
                                fontSize: "0.95rem",
                                fontWeight: 700,
                                gap: 1,
                                "&:hover": {
                                    borderColor: PRIMARY_COLOR,
                                    color: PRIMARY_COLOR,
                                    backgroundColor: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
                                },
                            }}
                        >
                            Generate Character Photo
                        </Button>
                    )}
                </Box>
            )}

            {/* --- Description Text --- */}
            <Typography
                variant="body2"
                sx={{
                    whiteSpace: isExpanded ? "pre-wrap" : "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "block",
                    fontFamily:
                        label === "Plan Summary" || label === "Prompt"
                            ? "ui-monospace, SFMono-Regular, monospace"
                            : "inherit",
                    fontSize: matchMobile ? "0.85rem" : "0.95rem",
                    lineHeight: 1.55,
                    color: darkMode ? "rgba(255,255,255,0.86)" : "rgba(0,0,0,0.82)",
                    opacity: value ? 1 : 0.6,
                }}
            >
                {value?.trim() ? value : placeholder || "Placeholder..."}
            </Typography>
        </Box>
    );
};

export default memo(SectionCard);
