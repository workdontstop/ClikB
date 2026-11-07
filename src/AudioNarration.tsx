import React, { useState, useRef, useEffect } from 'react';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import PauseIcon from '@mui/icons-material/Pause';
import { matchMobile } from './DetectDevice';

/**
 * AudioNarration Component
 *
 * Props:
 * - text: The full text narration to be spoken.
 *
 * Functionality:
 * - Uses SpeechSynthesisUtterance to read the provided text.
 * - Highlights the word that is currently being narrated.
 * - Clicking on any word restarts narration from that word.
 * - Provides a single pause/resume toggle button.
 * - Automatically starts narration when new text is loaded (if non-empty).
 * - Automatically stops narration if the user navigates away or if the text is removed.
 * - Includes a vertical slider that scrolls along with the narration.
 */
const AudioNarration = ({ text }: { text: string }) => {
    // Filter the text when it changes: remove any leading "Ah" (case-insensitive) and following spaces or commas.
    const filteredText = text.trim().replace(/^ah[\s,]*/i, "");

    const [isPlaying, setIsPlaying] = useState(false);
    const [audioPaused, setAudioPaused] = useState(false);
    const [currentCharIndex, setCurrentCharIndex] = useState(0);
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const [showPause, setShowPause] = useState(true);
    const [showHint, setShowHint] = useState(false);
    const textContainerRef = useRef<HTMLDivElement>(null);

    /**
     * Start narration from a given character index.
     */
    const startReading = (startIndex = 0) => {
        window.speechSynthesis.cancel();

        const offset = startIndex;
        const slicedText = filteredText.slice(startIndex);
        const utterance = new SpeechSynthesisUtterance(slicedText);
        utterance.lang = 'en-US';

        utterance.onboundary = (event) => {
            setCurrentCharIndex(offset + event.charIndex);
            // Scroll to the active word
            scrollToActiveWord(offset + event.charIndex);
        };

        utterance.onend = () => {
            setIsPlaying(false);
            setAudioPaused(false);
            setCurrentCharIndex(filteredText.length);
        };

        utterance.onerror = () => {
            setIsPlaying(false);
            setAudioPaused(false);
        };

        utteranceRef.current = utterance;
        setIsPlaying(true);
        setAudioPaused(false);
        window.speechSynthesis.speak(utterance);
    };

    /**
     * Stop narration.
     */
    const stopReading = () => {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
        setAudioPaused(false);
    };

    /**
     * Toggle pause/resume of narration.
     */
    const togglePauseResume = () => {
        if (audioPaused) {
            window.speechSynthesis.resume();
            setAudioPaused(false);
        } else {
            window.speechSynthesis.pause();
            setAudioPaused(true);
        }
        setShowPause(!showPause);
    };

    /**
     * Prepare the text for rendering.
     */
    const words: { word: string; start: number }[] = [];
    let cumulative = 0;
    filteredText.split(' ').forEach((word) => {
        words.push({ word, start: cumulative });
        cumulative += word.length + 1; // +1 for the space character.
    });

    /**
     * Handle a click on a word: restart narration from that word's start index.
     */
    const handleWordClick = (start: number) => {
        startReading(start);
        setShowPause(true);
    };

    /**
     * Automatically start narration when new text is loaded (if non-empty).
     */
    useEffect(() => {
        if (filteredText && filteredText.trim().length > 0) {
            startReading(0);
        } else {
            window.speechSynthesis.cancel();
            setIsPlaying(false);
            setAudioPaused(false);
        }
        // Show the hint for 10 seconds after new text loads.
        setShowHint(true);
        const timer = setTimeout(() => {
            setShowHint(false);
        }, 10000);
        return () => {
            window.speechSynthesis.cancel();
            clearTimeout(timer);
        };
    }, [filteredText]);

    /**
     * Stop narration if the user navigates away from the page.
     */
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopReading();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    /**
     * Scroll to the active word in the text container.
     */
    const scrollToActiveWord = (charIndex: number) => {
        const container = textContainerRef.current;
        if (container) {
            const activeWordElement = container.querySelector(`span[data-index="${charIndex}"]`);
            if (activeWordElement) {
                activeWordElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };

    return (
        <Box
            sx={{
                p: 3,
                borderRadius: 2,
                width: '100%',
                margin: 'auto',
                minHeight: '35vh',

            }}
        >
            {/* Narration Text Box with Vertical Slider */}
            <Box
                ref={textContainerRef}
                sx={{
                    mb: 3,
                    p: 2,
                    cursor: 'pointer',
                    lineHeight: 1.8,
                    fontSize: matchMobile ? '2.5vh' : '3vh',
                    fontWeight: 'bold',
                    textAlign: 'justify',
                    overflowY: 'auto',
                    height: '30vh',
                    "&::-webkit-scrollbar": {
                        width: "8px",
                    },
                    "&::-webkit-scrollbar-track": {
                        background: "#f1f1f1",
                    },
                    "&::-webkit-scrollbar-thumb": {
                        background: "#888",
                        borderRadius: "4px",
                    },
                    "&::-webkit-scrollbar-thumb:hover": {
                        background: "#555",
                    },
                }}
            >
                <Typography component="div">
                    {words.map((item, index) => {
                        const isActive =
                            currentCharIndex >= item.start &&
                            currentCharIndex < item.start + item.word.length;
                        return (
                            <span
                                key={index}
                                data-index={item.start}
                                onClick={() => handleWordClick(item.start)}
                                style={{
                                    backgroundColor: isActive ? 'rgba(255,235,59,0.8)' : 'transparent',
                                    marginRight: '6px',
                                    padding: '4px 6px',
                                    borderRadius: '6px',
                                    transition: 'background-color 0.3s ease',
                                }}
                            >
                                {item.word}
                            </span>
                        );
                    })}
                </Typography>
            </Box>

            {/* Controls and Hint */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                    variant="contained"
                    color="secondary"
                    onClick={togglePauseResume}
                    sx={{
                        borderRadius: '90vw',
                        backgroundColor: audioPaused ? '#4caf50' : '#f44336',
                        '&:hover': {
                            backgroundColor: audioPaused ? '#388e3c' : '#d32f2f',
                        },
                    }}
                >
                    {audioPaused ? <PauseIcon /> : <StopCircleIcon />}
                </Button>
                {showHint && (
                    <Typography
                        sx={{
                            fontSize: matchMobile ? '1.2rem' : '1.6rem',
                            fontWeight: 'bold',
                            opacity: '0.6',
                        }}
                    >
                        Hint: Click on words to start narration
                    </Typography>
                )}
            </Box>
        </Box>
    );
};

export default AudioNarration;