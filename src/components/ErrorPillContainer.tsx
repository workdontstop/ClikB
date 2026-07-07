import React, { useState, useEffect } from "react";
import { Box, Typography } from "@mui/material";
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

export interface ErrorPillData {
    id: number;
    message: string;
    scene: number;
}

let errorIdCounter = 0;

export const globalErrorEmitter = {
    listeners: [] as ((data: ErrorPillData) => void)[],
    emit: (message: string, scene: number) => {
        const id = ++errorIdCounter;
        globalErrorEmitter.listeners.forEach((l) => l({ id, message, scene }));
    },
    subscribe: (listener: (data: ErrorPillData) => void) => {
        globalErrorEmitter.listeners.push(listener);
        return () => {
            globalErrorEmitter.listeners = globalErrorEmitter.listeners.filter(l => l !== listener);
        };
    }
};

export default function ErrorPillContainer({ darkMode }: { darkMode?: boolean }) {
    const [pills, setPills] = useState<ErrorPillData[]>([]);

    useEffect(() => {
        const unsub = globalErrorEmitter.subscribe((data) => {
            setPills((prev) => [...prev, data]);
            setTimeout(() => {
                setPills((prev) => prev.filter(p => p.id !== data.id));
            }, 15000); // Wait 15 seconds before removing completely
        });
        return unsub;
    }, []);

    if (pills.length === 0) return null;

    return (
        <Box
            onClick={() => setPills([])}
            sx={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: "100%",
                height: "100%",
                zIndex: 999999, // extremely high to sit on top of everything
                display: "flex",
                flexDirection: "column",
                gap: 2,
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "auto", // enable clicks on invisible background
                background: "transparent"
            }}
        >
            {pills.map((pill) => (
                <Box
                    key={pill.id}
                    onClick={(e) => {
                        e.stopPropagation();
                        setPills(prev => prev.filter(p => p.id !== pill.id));
                    }}
                    sx={{
                        width: "auto",
                        maxWidth: { xs: "85vw", sm: "40vw" },
                        background: darkMode ? "rgba(10, 10, 10, 0.65)" : "rgba(255, 255, 255, 0.65)",
                        border: `1.5px solid ${darkMode ? "#E8BAFA" : "#0099cc"}`,
                        backdropFilter: "blur(24px) saturate(120%)",
                        borderRadius: "24px",
                        padding: "16px 24px",
                        boxShadow: `0 12px 40px ${darkMode ? "rgba(232, 186, 250, 0.3)" : "rgba(0, 153, 204, 0.3)"}`,
                        color: darkMode ? "#fff" : "#000",
                        cursor: "pointer",
                        animation: "popIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards, slideOut 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards 14.4s",
                        "@keyframes popIn": {
                            "0%": { opacity: 0, transform: "scale(0.9) translateY(20px)" },
                            "100%": { opacity: 1, transform: "scale(1) translateY(0)" },
                        },
                        "@keyframes slideOut": {
                            "0%": { opacity: 1, transform: "scale(1)" },
                            "100%": { opacity: 0, transform: "scale(0.95)" },
                        }
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                        <ErrorOutlineIcon sx={{ color: darkMode ? "#E8BAFA" : "#0099cc", fontSize: "1.2rem", mr: 1 }} />
                        <Typography sx={{
                            fontWeight: 800,
                            fontSize: "0.85rem",
                            opacity: 0.9,
                            textTransform: "uppercase",
                            letterSpacing: "1px",
                            color: darkMode ? "#E8BAFA" : "#0099cc"
                        }}>
                            Scene {pill.scene + 1} Error
                        </Typography>
                    </Box>
                    <Typography sx={{ fontSize: "0.95rem", lineHeight: 1.4, fontWeight: 500 }}>
                        {pill.message}
                    </Typography>
                </Box>
            ))}
        </Box>
    );
}
