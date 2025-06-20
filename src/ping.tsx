import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import axios from 'axios';

export interface PingLoaderProps {
    isMenuOpen?: boolean;
    AllowPing: boolean;
}

const PingLoader: React.FC<any> = ({ isMenuOpen = false, AllowPing,
    setFluxLoaded,
    fluxLoaded,
    isSubmittingKick,
    setIsSubmittingKick,

    setIsSubmitting,
    isSubmitting }) => {
    // --------------------------------------------------------------------------
    // 1) CONFIG & STATE
    // --------------------------------------------------------------------------
    const fluxEndpoint = 'https://t92wbteumg002h7z.us-east-1.aws.endpoints.huggingface.cloud';
    const HF_TOKEN = import.meta.env.VITE_HUGG;

    // 12 minutes = 12 * 60 * 1000 ms
    const MAX_DURATION = 12 * 60 * 1000;


    const [hidePing, setHidePing] = useState(false);
    const [elapsedMs, setElapsedMs] = useState(0);

    const dummyPrompt = 'ping-test';

    useEffect(() => {
        if (AllowPing) {
            setHidePing(false);
            setElapsedMs(0);
            ///  setFluxLoaded(false);
        } else {
            setHidePing(true);
        }
    }, [AllowPing]);

    // --------------------------------------------------------------------------
    // 2) DUMMY IMAGE GENERATION FUNCTION (Flux only)
    // --------------------------------------------------------------------------
    const pingFlux = useCallback(async () => {

        setFluxLoaded(false);

        try {
            const response = await axios.post(
                fluxEndpoint,
                {
                    inputs: dummyPrompt,
                    parameters: {
                        height: 64,
                        width: 64,
                        num_inference_steps: 1,
                        guidance_scale: 1.0,
                    },
                },
                {
                    headers: {
                        Accept: 'image/png',
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${HF_TOKEN}`,
                    },
                    responseType: 'blob',
                    timeout: 30000, // 30 seconds
                }
            );
            if (response.status === 200 && response.data) {
                setFluxLoaded(true);
            }
        } catch (err) {
            console.warn('Flux still not up:', err);
        }
    }, [fluxEndpoint, HF_TOKEN]);

    // --------------------------------------------------------------------------
    // 3) REFS FOR INTERVALS
    // --------------------------------------------------------------------------
    const pingTimerRef = useRef<NodeJS.Timeout | null>(null);
    const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number>(Date.now());

    // --------------------------------------------------------------------------
    // 4) useEffect: Start intervals on mount
    // --------------------------------------------------------------------------
    useEffect(() => {
        if (AllowPing) {
            setHidePing(false);
            ///  setFluxLoaded(false);
            // Immediately ping Flux
            pingFlux();

            pingTimerRef.current = setInterval(() => {
                const now = Date.now();
                const diff = now - startTimeRef.current;

                // If time's up, stop the pings
                if (diff >= MAX_DURATION) {
                    if (pingTimerRef.current) clearInterval(pingTimerRef.current);
                    pingTimerRef.current = null;
                } else {
                    if (!fluxLoaded) pingFlux();
                }
            }, 10000);

            // Update the progress every 10 seconds
            progressTimerRef.current = setInterval(() => {
                setElapsedMs(() => {
                    const now = Date.now();
                    const diff = now - startTimeRef.current;
                    if (diff >= MAX_DURATION) {
                        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
                        return MAX_DURATION;
                    }
                    return diff;
                });
            }, 10000);

            return () => {
                if (pingTimerRef.current) clearInterval(pingTimerRef.current);
                if (progressTimerRef.current) clearInterval(progressTimerRef.current);
            };
        } else {
            setHidePing(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [AllowPing, pingFlux,]);

    // --------------------------------------------------------------------------
    // 5) Clear intervals once Flux is loaded
    // --------------------------------------------------------------------------
    useEffect(() => {
        if (fluxLoaded) {
            if (pingTimerRef.current) clearInterval(pingTimerRef.current);
            if (progressTimerRef.current) clearInterval(progressTimerRef.current);
            // Snap progress to 100%
            setElapsedMs(MAX_DURATION);

            setTimeout(() => {
                setHidePing(true);
            }, 600000);
        }
    }, [fluxLoaded, MAX_DURATION]);

    const formatTime = useCallback(
        (ms: number) => {
            const clampedMs = Math.min(ms, MAX_DURATION);
            const totalSeconds = Math.floor(clampedMs / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        },
        [MAX_DURATION]
    );

    // --------------------------------------------------------------------------
    // 6) CALCULATE PROGRESS
    // --------------------------------------------------------------------------
    const progressPercent = useMemo(() => {
        if (elapsedMs >= MAX_DURATION) return 100;
        return Math.floor((elapsedMs / MAX_DURATION) * 100);
    }, [elapsedMs, MAX_DURATION]);

    const timerLabel = useMemo(() => {
        const current = formatTime(elapsedMs);
        const total = formatTime(MAX_DURATION);
        return `${current} / ${total}`;
    }, [elapsedMs, formatTime, MAX_DURATION]);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // A small badge component for the "0" indicator.
    const Badge = ({ bgColor }: { bgColor: string }) => (
        <Box
            sx={{
                backgroundColor: bgColor,
                color: '#fff',
                borderRadius: '50%',
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
            }}
        >
            G
        </Box>
    );


    // A small badge component for the "0" indicator.
    const Badge2 = ({ bgColor }: { bgColor: string }) => (
        <Box
            sx={{
                backgroundColor: bgColor,
                color: '#fff',
                borderRadius: '50%',
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
            }}
        >
            G
        </Box>
    );

    // --- MOBILE LAYOUT WITH HORIZONTAL SCROLL ---
    const mobileLayout = (
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
            <Box
                // Adjust minWidth to be larger than the viewport width when needed
                sx={{
                    minWidth: '400px',
                    padding: '8px 1px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                }}
            >
                {/* Left Section: Labels & Badges */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                    <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 'bolder', color: '#333', whiteSpace: 'nowrap' }}
                    >
                        {/* Optionally add a label here */}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Badge2 bgColor="#1976d2" />
                        <Typography
                            variant="subtitle1"
                            className={isSubmittingKick || isSubmitting ? fluxLoaded ? '' : 'blink' : ''}
                            sx={{ fontWeight: 700, color: '#1976d2', whiteSpace: 'nowrap' }}
                        >
                            {isSubmittingKick || isSubmitting ? fluxLoaded ? ' Slow Cpu' : 'Processing' : ' Slow Cpu'}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Badge bgColor={fluxLoaded ? '#1976d2' : '#f44336'} />
                        <Typography
                            variant="subtitle1"
                            className={fluxLoaded ? isSubmittingKick || isSubmitting ? 'blink' : '' : 'blink'}
                            /// className={fluxLoaded ? isSubmittingKick || isSubmitting ? 'blink' : '' : ''}
                            sx={{
                                fontWeight: 700,
                                color: fluxLoaded ? '#1976d2' : '#f44336',
                                whiteSpace: 'nowrap',
                            }}
                        >


                            {fluxLoaded ? isSubmittingKick || isSubmitting ? 'Processing' : 'GPU Loaded' : 'Starting Fast GPU '}



                        </Typography>
                    </Box>
                </Box>

                {/* Center: Progress Loader */}
                <Box
                    sx={{
                        width: '100px',
                        height: '8px',
                        backgroundColor: '#e0e0e0',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        flexShrink: 0,
                    }}
                >
                    <Box
                        sx={{
                            width: `${progressPercent}%`,
                            height: '100%',
                            backgroundColor: '#1976d2',
                            transition: 'width 0.3s linear',
                        }}
                    />
                </Box>

                {/* Right: Timer Label */}
                <Typography
                    variant="body2"
                    sx={{ color: '#555', fontWeight: 500, whiteSpace: 'nowrap' }}
                >
                    {timerLabel}
                </Typography>
            </Box>
        </Box>
    );



    // --- PC LAYOUT ---
    const pcLayout = (
        <Box
            sx={{
                width: { xs: '100%', sm: '80%' },
                margin: 'auto',
                padding: '8px 1px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 7,
            }}
        >
            {/* Left Section: Labels & Badges */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 16, flexGrow: 1 }}>
                <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 'bolder', color: '#555', whiteSpace: 'nowrap' }}
                >
                    {fluxLoaded ? 'Using GPU' : 'Using CPU'}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Badge2 bgColor="#1976d2" />
                    <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 700, color: '#1976d2', whiteSpace: 'nowrap' }}
                    >

                    </Typography>

                    <Typography
                        variant="subtitle1"
                        className={isSubmittingKick || isSubmitting ? fluxLoaded ? '' : 'blink' : ''}
                        sx={{
                            fontWeight: 700,
                            color: fluxLoaded ? '#bbbbbb' : '#1976d2',
                            whiteSpace: 'nowrap',

                        }}
                    >
                        {isSubmittingKick || isSubmitting ? fluxLoaded ? ' Slow Cpu' : 'Processing' : ' Slow Cpu'}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Badge bgColor={fluxLoaded ? '#1976d2' : '#f44336'} />
                    <Typography
                        variant="subtitle1"
                        className={fluxLoaded ? isSubmittingKick || isSubmitting ? 'blink' : '' : 'blink'}
                        /// className={fluxLoaded ? isSubmittingKick || isSubmitting ? 'blink' : '' : ''}
                        sx={{
                            fontWeight: 700,
                            color: fluxLoaded ? '#1976d2' : '#f44336',
                            whiteSpace: 'nowrap',
                        }}
                    >

                        {fluxLoaded ? isSubmittingKick || isSubmitting ? 'Processing' : 'GPU Loaded' : 'Starting Fast GPU'}
                    </Typography>
                </Box>
            </Box>

            {/* Center: Progress Loader */}
            <Box
                sx={{
                    width: '200px',
                    height: '8px',
                    backgroundColor: '#e0e0e0',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    flexShrink: 0,
                }}
            >
                <Box
                    sx={{
                        width: `${progressPercent}%`,
                        height: '100%',
                        backgroundColor: '#1976d2',
                        transition: 'width 0.3s linear',
                    }}
                />
            </Box>

            {/* Right: Timer Label */}
            <Typography
                variant="body2"
                sx={{ color: '#555', fontWeight: 500, whiteSpace: 'nowrap' }}
            >
                {timerLabel}
            </Typography>
        </Box>
    );

    return hidePing ? null : isMobile ? mobileLayout : pcLayout;
};

export default PingLoader;
