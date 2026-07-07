import React from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
    Typography,
    useMediaQuery,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import { useTheme } from "@mui/material/styles";

type StepsDialogProps = {
    open: boolean;
    onClose: () => void;
    title: string;                 // long prompt supported
    steps: string[];               // all texts
    activeIndex: number;           // show ONLY this one in the dialog
    onEdit?: (index: number, text: string) => void; // -1 = edit prompt/title
    darkMode?: boolean;
};

export default function StepsDialog({
    open,
    onClose,
    title,
    steps,
    activeIndex,
    onEdit,
    darkMode = false,
}: StepsDialogProps) {
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

    const safeIndex = Math.min(Math.max(activeIndex ?? 0, 0), Math.max(steps.length - 1, 0));
    const activeText = steps[safeIndex] ?? "";

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="lg"

            PaperProps={{
                sx: {
                    // glass + smaller corner radius (clean)
                    backdropFilter: "blur(14px) saturate(120%)",
                    WebkitBackdropFilter: "blur(14px) saturate(120%)",
                    backgroundColor: darkMode ? "rgba(18,18,18,0.78)" : "rgba(255,255,255,0.6)",
                    border: "1px solid rgba(255,255,255,0.22)",
                    boxShadow: "0 18px 50px rgba(0,0,0,0.32)",
                    borderRadius: 12,
                    width: fullScreen ? "90vw" : "min(92vw, 1040px)",
                    height: fullScreen ? "80vh" : undefined,
                    maxHeight: fullScreen ? "80vh" : undefined,
                    mx: "auto",
                },
            }}
            scroll="paper"
        >
            {/* Title row â€” prompt with Edit + Close */}
            <DialogTitle
                sx={{
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    pr: 10, // room for close
                    background: "transparent",
                    pb: 1.25,
                }}
            >
                <Typography
                    component="h2"
                    sx={{
                        fontWeight: 800,
                        fontSize: "clamp(18px, 2.2vw, 28px)",
                        lineHeight: 1.25,
                        wordBreak: "break-word",
                        whiteSpace: "pre-wrap",
                        color: darkMode ? "#fff" : "#111",
                        textShadow: darkMode ? "0 1px 2px rgba(0,0,0,0.35)" : "none",
                        flex: 1,
                    }}
                >
                    {title}
                </Typography>

                {/* Edit PROMPT button */}
                <IconButton
                    aria-label="Edit prompt"
                    onClick={() => onEdit?.(-1, title)}
                    sx={{
                        color: darkMode ? "#fff" : "#111",
                        mr: 1,
                        backgroundColor: "rgba(0,0,0,0.08)",
                        "&:hover": { backgroundColor: "rgba(0,0,0,0.16)" },
                    }}
                >
                    <EditIcon />
                </IconButton>

                {/* Close */}
                <IconButton
                    aria-label="Close"
                    onClick={onClose}
                    sx={{
                        color: darkMode ? "#fff" : "#111",
                        backgroundColor: "rgba(0,0,0,0.08)",
                        "&:hover": { backgroundColor: "rgba(0,0,0,0.16)" },
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            {/* Content â€” show ONLY the active text, big & very legible */}
            <DialogContent
                dividers
                onClick={onClose}
                sx={{
                    pt: 2,
                    pb: 3,
                    display: "flex",
                    justifyContent: "center",
                }}
            >
                <Typography
                    component="article"
                    sx={{
                        // large, comfortable reading
                        fontSize: "clamp(18px, 2.1vw, 26px)",
                        lineHeight: 1.85,
                        letterSpacing: "0.005em",
                        color: darkMode ? "#fff" : "#111",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        // keep a readable line length
                        maxWidth: "85ch",
                        // gentle padding inside the reading column
                        px: fullScreen ? 0 : 1,
                    }}
                >
                    {activeText}
                </Typography>
            </DialogContent>
        </Dialog>
    );
}
