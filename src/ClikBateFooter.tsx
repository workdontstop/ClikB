import React, { useEffect, useState, FC } from "react";
import { Box, Typography, Stack, useTheme } from "@mui/material";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import { matchMobile } from "./DetectDevice";
import { useNavigate, useLocation } from "react-router-dom";


const ClikBateFooter: FC<any> = ({ isMenuOpen, setIsMenuOpen,
    setIsFullscreen,
    isFullscreen,
}) => {
    // Pull from Redux or however you manage dark mode
    const [Zoom1x, setZoom1x] = useState(false);
    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);
    const location = useLocation();
    const { userId } = location.state || {};

    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);



    return (
        <Box

            onClick={() => {






                setZoom1x(true); // Trigger bounce on click
                setTimeout(() => setZoom1x(false), 300); // Reset after animation duration

                if (isFullscreen) {
                    setIsFullscreen(false);
                } else {
                    setIsMenuOpen(!isMenuOpen);
                }
            }}


            sx={{
                cursor: 'pointer',
                position: "absolute",
                bottom: 0,
                width: matchMobile ? "100%" :
                    isMenuOpen ? '80%' : "100%",

                left: matchMobile ? "-2vw" :
                    '0px',

                textAlign: "center",
                // Optional: If you want a subtle background to separate it
                /// backgroundColor: darkModeReducer ? "#121212" : "#ffffff",
                py: 0.5, // vertical padding
                zIndex: 1000,
                fontWeight: 'bold',
                fontFamily: "Arial, Helvetica, sans-serif",

                display: isMenuOpen ? 'none' : 'block'

            }}
        >
            <>

                <Typography
                    variant="body1"
                    noWrap
                    sx={{
                        fontSize: matchMobile ? "1.1rem" : "1.3rem",
                        color: darkModeReducer ? "#ffffff" : "#000000",

                        paddingTop: '1vh',
                        ml: '20px',
                        fontWeight: 900,




                        // <-- NEW: strong text shadow
                    }}
                >

                    <span style={{

                        background: "linear-gradient(90deg, #ffbe0b, #0aff99, #9b5de5)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}>
                        {location.pathname === '/pages' ?

                            loggedUser ? loggedUser.id === userId ? 'My page' : 'Clik Bate' : null :


                            null}

                        {location.pathname === '/' ?

                            'Stories' :


                            null}


                        {location.pathname === '/images' ?

                            'Memes' :


                            null}


                        {location.pathname === '/clikit' ?

                            'Interactions' :


                            null}

                    </span>
                </Typography>





            </>
        </Box >
    );
};

export default ClikBateFooter;
