import React, { useEffect, useMemo, useRef, useState, ReactElement } from "react";
import { Box, Typography } from "@mui/material";
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import NotesIcon from '@mui/icons-material/Notes';
import PaletteIcon from '@mui/icons-material/Palette';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CreateIcon from '@mui/icons-material/Create';

type PlanStepsProps = {
    planInfo: number;               // 1, 2, or 3
    parsedKeyPointsx: string[];     // the steps to type out
    darkMode?: boolean;             // whether it's dark mode
};

export default function PlanSteps({
    planInfo,
    parsedKeyPointsx,
    darkMode = true,
}: PlanStepsProps): JSX.Element {
    // --- Step 1 blinking ---
    const [blinkOn, setBlinkOn] = useState(true);

    useEffect(() => {
        if (planInfo !== 1) return;
        const id = setInterval(() => setBlinkOn((b) => !b), 600);
        return () => clearInterval(id);
    }, [planInfo]);

    // --- Step 2 title rotation (ONLY the title changed as requested) ---
    type TitlePhase = { icon: ReactElement; text: string };
    const plan2Titles = useMemo<TitlePhase[]>(
        () => [
            { icon: <NotesIcon fontSize="small" />, text: "Creating a plan Using:" },
            { icon: <PaletteIcon fontSize="small" />, text: "Creating Consistent Style" },
            { icon: <AssignmentTurnedInIcon fontSize="small" />, text: "Applying Content Plan" },
            { icon: <HourglassEmptyIcon fontSize="small" />, text: "Processing..." },
            { icon: <CreateIcon fontSize="small" />, text: "almost there, Creating Content..." },
        ],
        []
    );
    const [titleIndex, setTitleIndex] = useState(0);

    useEffect(() => {
        // reset and run only while planInfo === 2
        setTitleIndex(0);
        if (planInfo !== 2) return;

        const intervalId = window.setInterval(() => {
            setTitleIndex((i) => {
                if (i >= plan2Titles.length - 1) {
                    // keep showing the last title; stop advancing
                    window.clearInterval(intervalId);
                    return i;
                }
                return i + 1;
            });
        }, 4000); // 4 seconds per title

        return () => window.clearInterval(intervalId);
    }, [planInfo, plan2Titles]);

    // --- Step 2 typing state ---
    const [typedSteps, setTypedSteps] = useState<string[]>([]);
    const [currentTyped, setCurrentTyped] = useState("");
    const [showFullPlan, setShowFullPlan] = useState(false);
    const [caretOn, setCaretOn] = useState(true);

    // refs for cleanup
    const typingIntervalRef = useRef<number | null>(null);
    const betweenStepsTimeoutRef = useRef<number | null>(null);
    const caretIntervalRef = useRef<number | null>(null);

    // derived
    const steps = useMemo(() => parsedKeyPointsx ?? [], [parsedKeyPointsx]);

    // start/stop typewriter when planInfo === 2
    useEffect(() => {
        // cleanup helper
        const clearTimers = () => {
            if (typingIntervalRef.current) {
                clearInterval(typingIntervalRef.current);
                typingIntervalRef.current = null;
            }
            if (betweenStepsTimeoutRef.current) {
                clearTimeout(betweenStepsTimeoutRef.current);
                betweenStepsTimeoutRef.current = null;
            }
            if (caretIntervalRef.current) {
                clearInterval(caretIntervalRef.current);
                caretIntervalRef.current = null;
            }
        };

        // reset state any time planInfo changes
        setTypedSteps([]);
        setCurrentTyped("");
        setShowFullPlan(false);

        if (planInfo !== 2 || steps.length === 0) {
            clearTimers();
            return () => clearTimers();
        }

        // caret blink (independent of "Thinking" blink)
        caretIntervalRef.current = window.setInterval(() => {
            setCaretOn((c) => !c);
        }, 500);

        // typewriter over all steps
        let stepIdx = 0;
        let charIdx = 0;

        const TYPE_DELAY = 15;    // ms per char (faster)
        const STEP_PAUSE = 400;   // ms between steps

        const startTypingStep = () => {
            const current = steps[stepIdx] ?? "";
            charIdx = 0;
            setCurrentTyped("");
            // clear any existing interval before starting a new one
            if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);

            typingIntervalRef.current = window.setInterval(() => {
                if (charIdx < current.length) {
                    charIdx += 1;
                    setCurrentTyped(current.slice(0, charIdx));
                } else {
                    // step done
                    if (typingIntervalRef.current) {
                        clearInterval(typingIntervalRef.current);
                        typingIntervalRef.current = null;
                    }
                    setTypedSteps((prev) => [...prev, current]);
                    setCurrentTyped("");

                    stepIdx += 1;
                    if (stepIdx >= steps.length) {
                        // all steps done
                        setShowFullPlan(true);
                        return;
                    }
                    // wait briefly before next step starts
                    betweenStepsTimeoutRef.current = window.setTimeout(startTypingStep, STEP_PAUSE);
                }
            }, TYPE_DELAY);
        };

        // kick off first step
        startTypingStep();

        // cleanup on unmount or planInfo change
        return () => clearTimers();
    }, [planInfo, steps]);

    const monoFontProps = {
        fontFamily: "monospace",
        fontSize: "0.75rem",
        color: darkMode ? "#ccc" : "#000",
    };

    return (
        <Box
            sx={{
                width: "100%",
                height: "auto",
                px: 2,
                py: 1,
                boxSizing: "border-box",
                color: darkMode ? "#e0e0e0" : "#000"
            }}
        >
            {/* Step 1 */}
            {planInfo === 1 && (
                <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TravelExploreIcon fontSize="small" sx={{ opacity: blinkOn ? 1 : 0.35, transition: "opacity 250ms linear" }} />
                    <Typography
                        sx={{
                            ...monoFontProps,
                            opacity: blinkOn ? 1 : 0.35,
                            transition: "opacity 250ms linear",
                            fontWeight: 600
                        }}
                    >
                        Searching the web...
                    </Typography>
                </Box>
            )}

            {/* Step 2 */}
            {planInfo === 2 && (
                <Box sx={{ mb: 1, maxHeight: "30vh", overflow: "auto" }}>
                    {/* UPDATED TITLE ONLY */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                        {plan2Titles[titleIndex].icon}
                        <Typography sx={{ ...monoFontProps, fontWeight: 600 }}>
                            {plan2Titles[titleIndex].text}
                        </Typography>
                    </Box>

                    <Box component="ul" sx={{ pl: 2, m: 0, pt: 1, listStyleType: "none", p: 0 }}>
                        {/* already-typed steps */}
                        {typedSteps.map((t, i) => (
                            <Box
                                component="li"
                                key={`typed-${i}`}
                                sx={{
                                    mb: 1.5,
                                    opacity: 1,
                                    transform: "translateY(0)",
                                    transition: "opacity 250ms ease, transform 250ms ease",
                                }}
                            >
                                <Typography sx={{ ...monoFontProps }}>
                                    {t}
                                </Typography>
                            </Box>
                        ))}

                        {/* the step currently being typed */}
                        {currentTyped && (
                            <Box
                                component="li"
                                key="typing"
                                sx={{
                                    mb: 1.5,
                                    opacity: 1,
                                    transform: "translateY(0)",
                                    transition: "opacity 250ms ease, transform 250ms ease",
                                }}
                            >
                                <Typography component="span" sx={{ ...monoFontProps }}>
                                    {currentTyped}
                                </Typography>
                                {/* caret */}
                                <Typography
                                    component="span"
                                    sx={{
                                        ...monoFontProps,
                                        display: "inline-block",
                                        width: "0.5ch",
                                        ml: 0.5,
                                        opacity: caretOn ? 1 : 0,
                                    }}
                                >
                                    |
                                </Typography>
                            </Box>
                        )}
                    </Box>

                    {/* Full plan revealed after typing completes */}
                    {showFullPlan && (
                        <Box sx={{ pt: 1 }}>
                            <Typography sx={{ ...monoFontProps, fontWeight: 600, mb: 1, mt: 1 }}>
                                Full plan
                            </Typography>
                            <Box component="ul" sx={{ pl: 2, m: 0 }}>
                                {steps.map((point, idx) => (
                                    <Box component="li" key={`full-${idx}`} sx={{ mb: 0.5 }}>
                                        <Typography sx={{ ...monoFontProps }}>
                                            {point}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    )}
                </Box>
            )}

            {/* Step 3 (unchanged logically, updated visually) */}
            {planInfo === 3 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PaletteIcon fontSize="small" />
                    <Typography sx={{ ...monoFontProps, fontWeight: 600 }}>
                        Creating consistent style
                    </Typography>
                </Box>
            )}
        </Box>
    );
}
