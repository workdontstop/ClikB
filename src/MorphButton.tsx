// MorphButton.tsx
import React, { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { motion, LayoutGroup, AnimatePresence } from "framer-motion";
import GlassOverlay from "./GlassOverlay";
import { matchMobile } from "./DetectDevice";
import CloseIcon from "@mui/icons-material/Close";

import { setClientSecret, clearClientSecret } from "./settingsSlice";

import { setPixels, incrementPixels } from "./settingsSlice";

import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "./store";



import { setLogin } from "./settingsSlice";

import axios from "axios";



const compactPadding = matchMobile ? { height: '38px', px: 3, minWidth: '94px' } : { height: '44px', px: 3, minWidth: '100px' } as const;
const MotionBox = motion(Box);

interface Props {
    darkMode: boolean;
    isMenuOpen: any,
    minimisePrompt: any,
    buttonTheme?: { bg: string; text: string; hoverBg: string; hoverText: string }
}

const MorphButton: React.FC<Props> = ({
    darkMode,
    isMenuOpen,
    minimisePrompt,
    buttonTheme = {
        bg: "rgba(10, 10, 10, 0.45)",
        text: "#ffffff",
        hoverBg: "rgba(15, 15, 15, 0.65)",
        hoverText: "#ffffff",
    }
}) => {
    const [expanded, setExpanded] = useState(false);

    const darkModeReducer = darkMode;

    const [zoom2x, setZoom2x] = useState(false);

    const dispatch = useDispatch();

    /* Replace the balance after fetching it */





    const CLIK_URL = import.meta.env.VITE_CLIK_URL;

    const APP_STATE = import.meta.env.VITE_APPX_STATE;


    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

    const clientSecret = useSelector((s: RootState) => s.settings.clientSecret);

    const pixels = useSelector((state: RootState) => state.settings.pixels);

    const getPixel = async () => {
        try {
            const response = await axios.post(
                `${CLIK_URL}/getPixels`,                   // <-- POST endpoint
                { values: { userid: loggedUser?.id ?? 0 } }  // <-- request body
            );
            const { pixels } = response.data as any;   // â† pick out the primitive

            /// setPixels(pixels);

            dispatch(setPixels(pixels));

        } catch (err) {
            console.error("Error fetching pixels:", err);
        }
    };


    const GRADIENTx = "none";


    useEffect(() => {

        if (minimisePrompt) { } else {
            getPixel();

        }

    }, [minimisePrompt, loggedUser, expanded])


    // show â€œGet Pixelsâ€ for 4 s on mount, and again any time pixels === 0
    const [showGetPixels, setShowGetPixels] = React.useState(true);



    React.useEffect(() => {
        if (pixels === 0) {
            setShowGetPixels(true);
            // const t = setTimeout(() => setShowGetPixels(false), 4000);
            // return () => clearTimeout(t);
        } else {
            // always flash for 4 s on first render
            const first = setTimeout(() => setShowGetPixels(false), 2000);
            return () => clearTimeout(first);

        }
    }, [pixels]);

    return (
        <LayoutGroup id="glass-morph">
            {/* --------- ONE of these two branches is mounted at any time --------- */}
            <AnimatePresence mode="wait" initial={false}>
                {expanded ? (
                    /* â”€â”€ Overlay branch â”€â”€ */

                    <>

                        <Box


                            onClick={() => {

                                if (clientSecret) {

                                    setTimeout(() => {

                                        dispatch(setClientSecret(null));
                                    }, 500)


                                } else {
                                    setZoom2x(true);


                                    setTimeout(() => setZoom2x(false), 300);

                                    setExpanded(false)
                                }

                            }}
                            sx={{
                                position: 'fixed',
                                top: '4vh',
                                right: matchMobile ? '6vw' : '4vw',
                                zIndex: 1000000,
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}
                        >


                            <Box
                                className={`toggle-image ${clientSecret ? '' : zoom2x ? 'bounce' : ''}`}
                                /// onClick={() => }
                                sx={{
                                    alignItems: 'center',
                                    gap: 0,
                                    width: 55,
                                    height: 55,
                                    px: 0,
                                    py: 0.4,
                                    borderRadius: '50%',
                                    bgcolor: darkModeReducer ? 'rgba(0,0,0,0.65)' : 'rgb(250,250,250)',
                                    backdropFilter: 'blur(4px)',
                                    boxShadow: 3,
                                    opacity: 0.7,
                                    cursor: 'pointer',
                                    '&:hover': {
                                        bgcolor: darkModeReducer
                                            ? 'rgba(100,100,100,0.3)'
                                            : 'rgba(250,250,250,0.3)',
                                    },
                                    display: 'inline-flex',
                                    transition: 'width 250ms ease, border-radius 250ms ease',
                                }}
                            >
                                <CloseIcon
                                    sx={{
                                        fontSize: matchMobile ? '1.8rem' : '1.7rem',
                                        color: darkModeReducer ? '#fff' : '#000',
                                        textAlign: 'center',
                                        margin: 'auto',
                                    }}
                                />

                            </Box>
                        </Box>
                        <GlassOverlay

                            expanded={expanded}

                            key="overlay"
                            darkMode={darkMode}
                            onClose={() => setExpanded(false)}
                        />

                    </>
                ) : (
                    /* â”€â”€ Compact-button branch â”€â”€ */
                    <MotionBox
                        id="morph-button-trigger"
                        key="compact"
                        layoutId="glass"
                        onClick={() => {
                            if (loggedUser) {
                                if (loggedUser.id === 1 && APP_STATE === 'prod') {


                                    dispatch(setLogin(true));
                                } else {

                                    setExpanded(true)
                                }

                            }

                        }}
                        initial={{ borderRadius: '8vh' }}
                        animate={{ borderRadius: '8vh', }}      // keeps the rounder corners
                        exit={{ borderRadius: '8vh' }}         // when morphing to overlay
                        transition={{ duration: 0 }}        // no extra tween needed
                        sx={{
                            cursor: "pointer",
                            width: "100%",
                            flexBasis: "30%",
                            pr: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",

                            /* professional glass skin (strictly Dark Glassmorphism) */
                            background: buttonTheme.bg,
                            backdropFilter: "blur(24px) saturate(120%)",
                            color: buttonTheme.text,
                            ...compactPadding,

                            border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                            borderRadius: 12,
                            boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.6)" : "0 8px 32px 0 rgba(0, 0, 0, 0.1)",
                            transform: "translateY(-2px)",
                            position: "relative",
                            overflow: "hidden",
                            transition:
                                "background 250ms ease, box-shadow 250ms ease, transform 120ms ease, border 250ms ease",
                        }}
                    >

                        <Typography
                            sx={{
                                fontSize: matchMobile ? '0.9rem' : '1.1rem',
                                color: buttonTheme.text,
                                textAlign: 'left',
                                fontWeight: 800,
                                background: 'transparent',
                                display: loggedUser
                                    ? loggedUser.id === 1 && APP_STATE === 'prod'
                                        ? 'none'
                                        : 'block'
                                    : 'none',
                                textShadow: darkModeReducer ? '0px 2px 8px rgba(0,200,83,0.5)' : '0px 2px 8px rgba(0,150,136,0.5)',
                                WebkitTextFillColor: buttonTheme.text,
                            }}
                        >
                            {/* âŸ²  text swaps based on state */}
                            {showGetPixels ?
                                matchMobile ?
                                    'Get'
                                    :
                                    'Get'

                                : pixels.toLocaleString()}

                            {/* âŸ²  dot keeps spacing but only when showing the number */}
                            {!showGetPixels && (
                                <Box component="span" sx={{ fontSize: '0.6em', visibility: 'hidden' }}>
                                    .
                                </Box>
                            )}

                            {/* âŸ²  â€œPâ€ suffix only when showing the number */}
                            {!showGetPixels && (
                                <Box
                                    component="span"
                                    sx={{ fontSize: '0.5em', verticalAlign: 'baseline' }}
                                >
                                    P
                                </Box>
                            )}
                        </Typography>



                        <Typography

                            sx={{
                                // visibility: "hidden",
                                lineHeight: 1,
                                fontSize: "0.95rem",
                                mt: 0.75,
                                display: loggedUser ? loggedUser.id === 1 && APP_STATE === 'prod' ? 'block' : 'none' : 'none',
                            }}
                        >
                            LOGIN
                        </Typography>


                        <Typography
                            variant="caption"
                            sx={{
                                visibility: "hidden",
                                lineHeight: 1,
                                fontSize: "0.2rem",
                                mt: 0.75,
                                display: loggedUser ? loggedUser.id === 1 && APP_STATE === 'prod' ? 'block' : 'none' : 'none',
                            }}
                        >
                            Examples
                        </Typography>



                    </MotionBox>
                )}
            </AnimatePresence>
        </LayoutGroup>
    );
};

export default MorphButton;
