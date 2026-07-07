import React, { useEffect, useMemo, useRef, useState } from "react";

type PlanStepsProps = {
    planInfo: number;               // 1, 2, or 3
    parsedKeyPointsx: string[];     // the steps to type out
};

export default function PlanSteps({
    planInfo,
    parsedKeyPointsx,
}: PlanStepsProps): JSX.Element {
    // --- Step 1 blinking ---
    const [blinkOn, setBlinkOn] = useState(true);

    useEffect(() => {
        if (planInfo !== 1) return;
        const id = setInterval(() => setBlinkOn((b) => !b), 600);
        return () => clearInterval(id);
    }, [planInfo]);

    // --- Step 2 title rotation (ONLY the title changed as requested) ---
    type TitlePhase = { emoji: string; text: string };
    const plan2Titles = useMemo<TitlePhase[]>(
        () => [
            { emoji: "ðŸ“", text: "Creating a plan Using:" },
            { emoji: "ðŸŽ¨", text: "Creating Consistent Style" },
            { emoji: "ðŸŽ’", text: "Applying Content Plan" },
            { emoji: "â³", text: "Processing..." },
            { emoji: "âœï¸", text: "almost there, Creating Content..." },
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

        const TYPE_DELAY = 30;    // ms per char (medium speed)
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

    return (
        <div
            style={{
                width: "100%",
                height: "auto",
                padding: "1vh 2px 0 2px",
                boxSizing: "border-box",
            }}
        >
            {/* Step 1 */}
            {planInfo === 1 && (
                <div style={{ marginBottom: "1vh" }}>
                    <h3
                        style={{
                            opacity: blinkOn ? 1 : 0.35,
                            transition: "opacity 250ms linear",
                        }}
                    >
                        ðŸŒ Searching the webâ€¦
                    </h3>
                </div>
            )}

            {/* Step 2 */}
            {planInfo === 2 && (
                <div style={{ marginBottom: "1vh", maxHeight: "20vh", overflow: "auto" }}>
                    {/* UPDATED TITLE ONLY */}
                    <h3>
                        {plan2Titles[titleIndex].emoji} {plan2Titles[titleIndex].text}
                    </h3>

                    <ul style={{ paddingLeft: "15px", margin: 0, paddingTop: "1vh" }}>
                        {/* already-typed steps */}
                        {typedSteps.map((t, i) => (
                            <li
                                key={`typed-${i}`}
                                style={{
                                    // gentle "animate into view"
                                    opacity: 1,
                                    transform: "translateY(0)",
                                    transition: "opacity 250ms ease, transform 250ms ease",
                                }}
                            >
                                {t}
                            </li>
                        ))}

                        {/* the step currently being typed */}
                        {currentTyped && (
                            <li
                                key="typing"
                                style={{
                                    opacity: 1,
                                    transform: "translateY(0)",
                                    transition: "opacity 250ms ease, transform 250ms ease",
                                }}
                            >
                                {currentTyped}
                                {/* caret */}
                                <span
                                    style={{
                                        display: "inline-block",
                                        width: "0.5ch",
                                        marginLeft: 2,
                                        opacity: caretOn ? 1 : 0,
                                    }}
                                >
                                    |
                                </span>
                            </li>
                        )}
                    </ul>

                    {/* Full plan revealed after typing completes */}
                    {showFullPlan && (
                        <div style={{ paddingTop: "1vh" }}>
                            <h4 style={{ margin: "8px 0" }}>Full plan</h4>
                            <ul style={{ paddingLeft: "15px", margin: 0 }}>
                                {steps.map((point, idx) => (
                                    <li key={`full-${idx}`}>{point}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Step 3 (unchanged) */}
            {planInfo === 3 && (
                <div>
                    <h3>Creating consistent style</h3>
                </div>
            )}
        </div>
    );
}
