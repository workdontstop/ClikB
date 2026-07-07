import React, { FC, useState, useEffect, useRef, useCallback } from "react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Typography } from "@mui/material";

import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";

import TogglePromptButton from "./TogglePromptButton";

import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
import CelebrationIcon from "@mui/icons-material/Celebration";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import ImageIcon from "@mui/icons-material/Image";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import KeywordSelector from "./KeywordSelector";

import IconButton from "@mui/material/IconButton";

import FilledInput from "@mui/material/FilledInput"; // ðŸ‘ˆ weâ€™ll use this as the input slot

import Feedgate from "./FeedsGate";



import ClikbaeIcon from './s.png';

import ClikbaeIcon2 from './s2.png';

import { RootState } from "./store";
import { matchMobile } from "./DetectDevice";

interface HomepageProps {
    isMenuOpen: boolean;
    callFeeds: boolean;
    setcallFeeds: React.Dispatch<React.SetStateAction<boolean>>;
    AllowPing: boolean;
    setAllowPing: React.Dispatch<React.SetStateAction<boolean>>;
    feedContainerRef: React.RefObject<HTMLDivElement>;
    LastId: any;
    setLastId: any;
    feeds: unknown[];
    setFeeds: any;
    setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
    isFullscreen: boolean;
    setFluxLoaded: React.Dispatch<React.SetStateAction<boolean>>;
    fluxLoaded: boolean;
    isSubmittingKick: boolean;
    setIsSubmittingKick: React.Dispatch<React.SetStateAction<boolean>>;
    setIsSubmitting: React.Dispatch<React.SetStateAction<boolean>>;
    isSubmitting: boolean;
    setIsMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
    minimisePrompt: boolean;
    setminimisePrompt: React.Dispatch<React.SetStateAction<boolean>>;
    MenuOpenb: boolean;
    setMenuOpenb: React.Dispatch<React.SetStateAction<boolean>>;
    allowUploadText: boolean;
    setallowUploadText: React.Dispatch<React.SetStateAction<boolean>>;
    setHideBottom: React.Dispatch<React.SetStateAction<boolean>>;
    setShowThumb: any;
    showEmotions: any;


    setIsFullscreen1: React.Dispatch<React.SetStateAction<boolean>>;
    isFullscreen1: boolean;

    setIsFullscreen2: React.Dispatch<React.SetStateAction<boolean>>;
    isFullscreen2: boolean;

    setIsFullscreen3: React.Dispatch<React.SetStateAction<boolean>>;
    isFullscreen3: boolean;

    setLikesPostid: any;
    setLikes: any;
    setShowEmotions: any;

    setsearchDataNav: any;
    setMyPageIdNav: any;
    setfeedLastIdNav: any;
    setfeedScrollPosNav: any




}

const Homepage: FC<HomepageProps> = ({
    isMenuOpen,
    callFeeds,
    setcallFeeds,
    AllowPing,
    setAllowPing,
    feedContainerRef,
    LastId,
    setLastId,
    feeds,
    setFeeds,
    setIsFullscreen,
    isFullscreen,
    setFluxLoaded,
    fluxLoaded,
    isSubmittingKick,
    setIsSubmittingKick,
    setIsSubmitting,
    isSubmitting,
    setIsMenuOpen,
    minimisePrompt,
    setminimisePrompt,
    MenuOpenb,
    setMenuOpenb,
    allowUploadText,
    setallowUploadText,
    setHideBottom,
    setShowThumb,
    showEmotions,
    setIsFullscreen1,
    isFullscreen1,
    setIsFullscreen2,
    isFullscreen2,
    setIsFullscreen3,
    isFullscreen3,
    setLikesPostid,
    setLikes,
    setShowEmotions,

    setsearchDataNav,
    setMyPageIdNav,
    setfeedLastIdNav,
    setfeedScrollPosNav

}) => {
    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);

    const darkMode = darkModeReducer;

    const location = useLocation();
    const navigate = useNavigate();
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

    const [error, setError] = useState<string>("");
    const [text, setText] = useState<string>("");

    const [searchData, setSearchData] = useState<any>("");




    const [visible, setVisible] = useState(false);

    const [PlayGround, setPlayGround] = useState(true);

    const [showFreePixels, setShowFreePixels] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowFreePixels(false);
        }, 10000);
        return () => clearTimeout(timer);
    }, []);

    const [IsMobileBackActive, setIsMobileBackActive] = useState(false);



    const [textActive, settextActive] = useState(false);


    // Run right after first paint so the transition is smooth
    useEffect(() => {
        const id = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(id);
    }, []);

    const minipromptRefx2 = useRef<NodeJS.Timeout | null>(null);



    // TODO: add real prompt suggestions here
    const suggestions: string[] = [];

    /* Re-run feeds when the route changes */
    useEffect(() => {
        setcallFeeds(true);
        setHideBottom(false);
        setminimisePrompt(true);
    }, [location.pathname, setcallFeeds, setHideBottom]);

    const { routeScrollPos, routelastId, userId, feedtype, search } = location.state || {};
    // Now these will be `undefined` if no state was passed

    // console.log('typefee', feedtype)

    const [feeds1, setFeeds1] = useState<any[]>([]);
    const [feeds2, setFeeds2] = useState<any[]>([]);
    const [feeds3, setFeeds3] = useState<any[]>([]);


    const feedContainerRef1 = useRef<HTMLDivElement | null>(null);
    const feedContainerRef2 = useRef<HTMLDivElement | null>(null);
    const feedContainerRef3 = useRef<HTMLDivElement | null>(null);



    const GRADIENT = "linear-gradient(135deg, #0099cc  0%, #E8BAFA 100%)";

    const GRADIENTx = "linear-gradient(135deg, #E8BAFA 0%, #0099cc 100%)";


    useEffect(() => {

        if (search) {

            setSearchData(search);
            setText(search);
        } else {


        }

    }, [search]);

    useEffect(() => {

        if (isFullscreen1 || isFullscreen2 || isFullscreen3) {

            setHideBottom(true)
        } else {
            setHideBottom(false)

        }

    }, [isFullscreen1, isFullscreen2, isFullscreen3]);




    /* submit handler */
    const handleSearch = useCallback(() => {
        // â€¦do something with `text`

        setSearchData(text);
        setcallFeeds(false);


        setcallFeeds(true);
        setText("");
    }, [text]);


    const handleSearchB = useCallback((t: any, ty: number) => {
        // â€¦do something with `text`

        if (ty === 1) {
            setSearchData(t);

        } else {
            setSearchData('');
        }


        setcallFeeds(false);
        setcallFeeds(true);


    }, []);

    const handleSearchHome = useCallback(() => {
        setText("");
        handleSearchB("", 2);
        (document.activeElement as HTMLElement | null)?.blur();
    }, [handleSearchB]);

    return (
        <>
            {/* ---------- Search field ---------- */}
            <div style={{
                position: 'fixed', top: '0.4vh', zIndex: 3,

                backgroundColor: 'transparent',
                backdropFilter: 'none',

                border: '0px solid',
                borderColor: 'transparent',
                borderRadius: '0px',
                borderBottomLeftRadius: '0px',
                borderBottomRightRadius: '0px',
                display: isFullscreen1 || isFullscreen2 || isFullscreen3 || (matchMobile && isMenuOpen) || (!matchMobile && MenuOpenb) ? 'none' : 'block',

                left: matchMobile ? '0px' : isMenuOpen ? '20%' : '0px',
                paddingBottom: minimisePrompt ? '0px' : IsMobileBackActive ? (matchMobile ? '1vh' : '1vh') : (matchMobile ? '0.8vh' : '0.9vh'),
                paddingTop: minimisePrompt ? '0px' : matchMobile ? '1vh' : '0.9vh',
                paddingLeft: matchMobile ? '3vw' : '1vw',
                paddingRight: matchMobile ? '3vw' : '1vw',
                boxSizing: 'border-box',

                width: matchMobile ? '100%' : isMenuOpen ? '40%' : '50%',
                maxWidth: matchMobile ? '100%' : 'none',
                transition: 'left 220ms ease, width 220ms ease, background-color 180ms ease'
            }}>




                <Autocomplete
                    freeSolo
                    disableClearable
                    forcePopupIcon={false}
                    sx={{
                        width: '100%',
                        maxWidth: 'none',
                        display: 'block',
                        boxSizing: 'border-box',
                    }}
                    options={suggestions}
                    inputValue={text}

                    onFocus={() => {
                        ///  setclikt(true);
                        if (minipromptRefx2.current) {
                            clearTimeout(minipromptRefx2.current);
                        }

                        setIsMobileBackActive(true);
                        settextActive(true);

                    }}
                    onBlur={() => {
                        /// setclikt(false);
                        setIsMobileBackActive(false);
                        settextActive(false)
                    }}

                    onInputChange={(_, value) => setText(value)} /* keeps text state in sync */
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            variant="filled"
                            fullWidth

                            minRows={2}
                            placeholder={matchMobile ?
                                isMenuOpen ? '' : "Search" :
                                MenuOpenb && !isMenuOpen ? '' : "Search"}
                            /* use FilledInput so we can decorate it */
                            slots={{ input: FilledInput }}
                            slotProps={{
                                /* MUI <FilledInput /> props */


                                input: {
                                    ...params.InputProps,
                                    disableUnderline: true,
                                    /* accent submit button */
                                    endAdornment: (
                                        <>
                                            <InputAdornment position="end">
                                                <IconButton
                                                    onClick={handleSearch}
                                                    aria-label="Run search"
                                                    sx={{
                                                        width: matchMobile ? 42 : 40,
                                                        height: matchMobile ? 42 : 40,
                                                        mr: 0,
                                                        flexShrink: 0,
                                                        bgcolor: darkModeReducer ? "#E8BAFA" : "#0099cc",
                                                        color: darkModeReducer ? "#000" : "#fff",
                                                        boxShadow: darkModeReducer ? "0 10px 24px rgba(232,186,250,0.25)" : "0 10px 24px rgba(0,153,204,0.22)",
                                                        transition: "background-color .2s ease, box-shadow .2s ease, transform .1s ease",
                                                        "&:hover": {
                                                            bgcolor: darkModeReducer ? "#D9A6F0" : "#0088b8",
                                                            boxShadow: darkModeReducer ? "0 12px 28px rgba(232,186,250,0.33)" : "0 12px 28px rgba(0,153,204,0.3)",
                                                        },
                                                        "&:active": { transform: "scale(0.94)" },
                                                    }}
                                                >
                                                    <SearchIcon fontSize="small" />
                                                </IconButton>
                                            </InputAdornment>
                                        </>
                                    ),
                                },
                                /* native <input> attrs */
                                htmlInput: {
                                    ...params.inputProps,
                                    "aria-label": "Search field",
                                    autoCorrect: "on",
                                    spellCheck: true,
                                    autoCapitalize: "sentences",
                                    autoComplete: "off",
                                    name: "clikb-search-no-autofill",
                                    /* âŽ fires handleSearch */
                                    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleSearch();
                                        }
                                    },
                                },
                            }}
                            sx={{

                                "& .MuiInputBase-root:focus": {
                                    outline: "none", // Remove focus outline on the input root
                                },
                                "& .MuiInputBase-input:focus-visible": {
                                    outline: "none", // Remove focus outline on the input
                                },
                                "& .Mui-focused": {
                                    outline: "none", // Remove Material-UI's focus outline
                                },
                                "& .MuiInputBase-input": {
                                    color: darkMode ? "#ffffff" : "#000000", // Text color
                                    fontSize: matchMobile ? '1.05rem' : '1.18rem',
                                    fontWeight: 600,
                                    lineHeight: 1.2,
                                    padding: '0 !important',
                                    caretColor: 'auto !important',
                                    "&::placeholder": {
                                        color: darkModeReducer ? "rgba(255,255,255,0.68)" : "rgba(0,0,0,0.5)",
                                        opacity: 1,
                                    },
                                },

                                "& .MuiInputLabel-root": {
                                    color: darkMode ? "#ffffff" : "#000000", // Label color
                                },
                                "& .MuiFormHelperText-root": {
                                    color: error ? "#f44336" : darkMode ? "#ffffff" : "#000000",
                                },



                                /* cohesive rounded search bar */
                                '& .MuiFilledInput-root': {
                                    width: '100%',
                                    minHeight: matchMobile ? '56px' : '54px',
                                    borderRadius: matchMobile ? '22px' : '20px',
                                    backgroundColor: darkModeReducer ? 'rgba(12,10,16,0.78)' : 'rgba(255,255,255,0.78)',
                                    border: `1px solid ${darkModeReducer ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.1)'}`,
                                    boxShadow: darkModeReducer ? '0 14px 34px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.08)' : '0 14px 34px rgba(0,0,0,0.11), inset 0 1px 0 rgba(255,255,255,0.72)',
                                    padding: matchMobile ? '6px 8px 6px 16px' : '6px 7px 6px 18px',
                                    boxSizing: 'border-box',
                                    transition: 'border-color .2s ease, background-color .2s ease, box-shadow .2s ease',
                                },
                                '& .MuiFilledInput-root:hover': {
                                    backgroundColor: darkModeReducer ? 'rgba(18,15,24,0.88)' : 'rgba(255,255,255,0.9)',
                                },
                                '& .MuiFilledInput-root.Mui-focused': {
                                    borderColor: darkModeReducer ? '#E8BAFA' : '#0099cc',
                                    backgroundColor: darkModeReducer ? 'rgba(20,16,28,0.92)' : 'rgba(255,255,255,0.96)',
                                    boxShadow: `0 0 0 3px ${darkModeReducer ? 'rgba(232,186,250,0.2)' : 'rgba(0,153,204,0.16)'}, ${darkModeReducer ? '0 18px 38px rgba(0,0,0,0.3)' : '0 18px 38px rgba(0,0,0,0.13)'}`,
                                },
                                '& .MuiInputAdornment-root': {
                                    marginTop: '0 !important',
                                },





                                "&::-webkit-scrollbar": {
                                    width: "8px",
                                },
                                "&::-webkit-scrollbar-track": {
                                    background: "rgb(255,255,255,0)",
                                },
                                "&::-webkit-scrollbar-thumb": {
                                    background: "rgb(255,255,255,0)",
                                    borderRadius: "4px",
                                },
                                "&::-webkit-scrollbar-thumb:hover": {
                                    background: "rgb(255,255,255,0)",
                                },

                                backgroundColor: "rgb(255,255,255,0)",
                                height: "auto",
                                overflow: "visible",
                            }}
                        />
                    )}
                />

                {error && <p style={{ color: "#f44336", marginTop: 8 }}>{error}</p>}


                {

                    isFullscreen1 || isFullscreen2 || isFullscreen3 ?
                        null
                        :


                        IsMobileBackActive ? <KeywordSelector isDesktop={!matchMobile} handleSearchB={handleSearchB}
                            searchData={searchData} /> : null


                }

            </div>











            {/* ---------- Feedgates (vertical scroll) ---------- */}
            <Box
                ref={feedContainerRef}
                sx={{
                    flex: 1,
                    overflowY: matchMobile ? "visible" : "auto",
                    display: "flex",
                    flexDirection: "column",

                    py: matchMobile ? IsMobileBackActive ? '27vh' : "19vh" : IsMobileBackActive ? "17vh" : "15vh",

                    gap: matchMobile ? "3vh" : isMenuOpen ? '2vh' : "1.5vh",

                    mt: matchMobile ? "0vh" : "0vh",

                    pb: matchMobile ? "" : isMenuOpen ? "" : '',

                    px: matchMobile ? "" : isMenuOpen ? "0.5vw" : '9vw',


                    maxHeight: matchMobile ? "none" : "100vh",

                    overscrollBehavior: matchMobile ? "none" : "contain",
                    WebkitOverflowScrolling: "touch",
                    "&::-webkit-scrollbar": {
                        width: "5px",
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

                {IsMobileBackActive && matchMobile ?

                    <Box onClick={() => {
                        setIsMobileBackActive(false);
                    }}

                        sx={{
                            backgroundColor: 'rgb(100,100,100,0.3)',
                            height: '80vh', width: '100%', position: 'fixed', bottom: '0vh', zIndex: '1',
                            cursor: 'pointer'
                        }} >



                    </Box >
                    : null}




                {/* --- Interactions PlayGround --- */}

                {searchData ? null :
                    <Box sx={{


                        py: matchMobile ? IsMobileBackActive ? '0vh' : "0px" : IsMobileBackActive ? '6vh' : '0vh',


                    }}>
                        {/* Landing CTA for Guests â€” disabled (free pixels banner removed) */}
                        {false && loggedUser?.id === 1 && showFreePixels && (
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    px: matchMobile ? "4vw" : "2vw",
                                    mb: "2vh",
                                    gap: 2,
                                    pt: "2vh",
                                }}
                            >
                                <style>{`
      @keyframes flowingGradientCTA {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }

      @keyframes glowingCTA {
        0%, 100% {
          box-shadow:
            0 0 10px ${darkMode ? "rgba(232, 186, 250, 0.35)" : "rgba(0, 153, 204, 0.35)"},
            0 4px 15px rgba(0,0,0,0.2);
        }
        50% {
          box-shadow:
            0 0 22px ${darkMode ? "rgba(208, 144, 230, 0.60)" : "rgba(51, 204, 255, 0.55)"},
            0 6px 22px rgba(0,0,0,0.28);
        }
      }

      @keyframes textShine {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }

      @keyframes confettiFall {
        0% { transform: translateY(-30px); opacity: 0.0; }
        10% { opacity: 1; }
        100% { transform: translateY(140px); opacity: 0.0; }
      }

      @keyframes popIn {
        0% { transform: scale(0.96); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
      }

      @keyframes sparklePulse {
        0%, 100% { filter: drop-shadow(0 0 0 rgba(255,255,255,0)); opacity: 0.85; }
        50% { filter: drop-shadow(0 0 12px rgba(255,255,255,0.55)); opacity: 1; }
      }
    `}</style>

                                {/* Celebration banner */}
                                <Box
                                    sx={{
                                        position: "relative",
                                        flex: 1,
                                        minWidth: 0,
                                        py: matchMobile ? "10px" : "12px",
                                        px: matchMobile ? "12px" : "16px",
                                        borderRadius: "16px",
                                        overflow: "hidden",
                                        background: darkMode
                                            ? "linear-gradient(180deg, rgba(232,186,250,0.14), rgba(0,0,0,0.10))"
                                            : "linear-gradient(180deg, rgba(0,153,204,0.12), rgba(255,255,255,0.65))",
                                        border: `1px solid ${darkMode ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
                                        backdropFilter: "blur(10px)",
                                        animation: "popIn 320ms ease-out",
                                        "&::before": {
                                            content: '""',
                                            position: "absolute",
                                            inset: 0,
                                            opacity: 0.85,
                                            pointerEvents: "none",
                                            // Confetti dots (pure CSS)
                                            backgroundImage: `
            radial-gradient(circle at 10% 20%, rgba(232, 186, 250, .95) 0 3px, transparent 4px),
            radial-gradient(circle at 25% 10%, rgba(0, 153, 204, .95) 0 3px, transparent 4px),
            radial-gradient(circle at 40% 25%, rgba(255, 255, 255, .85) 0 3px, transparent 4px),
            radial-gradient(circle at 55% 12%, rgba(208, 144, 230, .85) 0 3px, transparent 4px),
            radial-gradient(circle at 70% 22%, rgba(51, 204, 255, .85) 0 3px, transparent 4px),
            radial-gradient(circle at 85% 8%, rgba(255, 255, 255, .75) 0 3px, transparent 4px),
            radial-gradient(circle at 15% 70%, rgba(232, 186, 250, .85) 0 3px, transparent 4px),
            radial-gradient(circle at 35% 78%, rgba(0, 153, 204, .80) 0 3px, transparent 4px),
            radial-gradient(circle at 60% 74%, rgba(255, 255, 255, .70) 0 3px, transparent 4px),
            radial-gradient(circle at 82% 82%, rgba(208, 144, 230, .70) 0 3px, transparent 4px)
          `,
                                            animation: "confettiFall 1.4s ease-in-out infinite",
                                        },
                                        "&::after": {
                                            content: '""',
                                            position: "absolute",
                                            inset: 0,
                                            pointerEvents: "none",
                                            background: darkMode
                                                ? "radial-gradient(circle at 20% 10%, rgba(232,186,250,0.25), transparent 55%)"
                                                : "radial-gradient(circle at 20% 10%, rgba(0,153,204,0.18), transparent 55%)",
                                            mixBlendMode: "screen",
                                            animation: "sparklePulse 1.8s ease-in-out infinite",
                                        },
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            position: "relative",
                                            zIndex: 1,
                                            fontSize: matchMobile ? "0.92rem" : "1.05rem",
                                            fontWeight: 900,
                                            letterSpacing: "0.02em",
                                            lineHeight: 1.2,
                                            // Shimmering text
                                            background: darkMode
                                                ? "linear-gradient(90deg, #fff, #E8BAFA, #fff, #F3D9FA)"
                                                : "linear-gradient(90deg, #0059b3, #0099cc, #33ccff, #0059b3)",
                                            backgroundSize: "250% 250%",
                                            WebkitBackgroundClip: "text",
                                            WebkitTextFillColor: "transparent",
                                            animation: "textShine 3.2s ease-in-out infinite",
                                            textShadow: darkMode
                                                ? "0 0 18px rgba(232,186,250,0.18)"
                                                : "0 0 18px rgba(0,153,204,0.14)",
                                            // keep it readable if it wraps
                                            wordBreak: "break-word",
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                            <CelebrationIcon fontSize="inherit" />
                                            <span>Congratulations, You Just Won Free Image Generation Pixels</span>
                                            <AutoAwesomeIcon fontSize="inherit" />
                                        </Box>
                                    </Typography>
                                </Box>

                                {/* CTA Button */}
                                <Button
                                    onClick={() => navigate("/MagicMirror", { state: { userId: loggedUser?.id } })}
                                    sx={{
                                        background: darkMode
                                            ? "linear-gradient(45deg, #E8BAFA, #D090E6, #F3D9FA, #B966D3, #8A2BE2, #E8BAFA)"
                                            : "linear-gradient(45deg, #0059b3, #0099cc, #33ccff, #0077b3, #0099cc, #0059b3)",
                                        backgroundSize: "300% 300%",
                                        animation: "flowingGradientCTA 6s ease infinite, glowingCTA 3s ease-in-out infinite",
                                        color: darkMode ? "black" : "white",
                                        fontWeight: 900,
                                        textTransform: "none",
                                        borderRadius: "16px",
                                        px: matchMobile ? "18px" : "28px",
                                        py: "10px",
                                        fontSize: matchMobile ? "0.9rem" : "1rem",
                                        border: `1px solid ${darkMode ? "rgba(0,0,0,0.18)" : "rgba(255, 255, 255, 0.35)"}`,
                                        backdropFilter: "blur(10px)",
                                        whiteSpace: "nowrap",
                                        transition: "transform 0.2s",
                                        "&:hover": {
                                            transform: "scale(1.05)",
                                            background: darkMode
                                                ? "linear-gradient(45deg, #E8BAFA, #D090E6, #F3D9FA, #B966D3, #8A2BE2, #E8BAFA)"
                                                : "linear-gradient(45deg, #0059b3, #0099cc, #33ccff, #0077b3, #0099cc, #0059b3)",
                                            backgroundSize: "300% 300%",
                                        },
                                        "&:active": {
                                            transform: "scale(0.98)",
                                        },
                                    }}
                                >
                                    Use Pixels
                                </Button>
                            </Box>
                        )}


                        <Box
                            sx={{
                                mb: matchMobile ? "1vh" : "0.1vh",
                                pl: "0.5vw",
                                textAlign: matchMobile ? "left" : 'center',
                                display: feeds3.length > 0 ? 'block' : 'none'

                            }}
                        >
                            <span
                                style={{
                                    marginLeft: '0.5rem',
                                    fontSize: matchMobile ? '0.8rem' : '1rem',
                                    fontWeight: 700,
                                    WebkitBackgroundClip: 'initial',
                                    WebkitTextFillColor: 'initial',
                                    background: 'none',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    //  color: darkModeReducer ? 'yellow' : 'red',
                                    /* â”€â”€ fade-in tweaks â”€â”€ */
                                    opacity: visible ? 0.8 : 0,
                                    transition: "opacity 10s ease-in-out",
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <SportsEsportsIcon fontSize="small" />
                                <span>Games</span>
                            </span>
                        </Box>

                        <Feedgate

                            setsearchDataNav={setsearchDataNav}
                            setMyPageIdNav={setMyPageIdNav}
                            setfeedLastIdNav={setfeedLastIdNav}
                            setfeedScrollPosNav={setfeedScrollPosNav}

                            setShowEmotions={setShowEmotions}
                            setLikesPostid={setLikesPostid}
                            setLikes={setLikes}

                            showEmotions={showEmotions}
                            searchData={searchData}
                            feedtypeForHorizontalBackNavigate={feedtype}
                            vertical={false}
                            minimisePrompt={minimisePrompt}
                            MenuOpenb={MenuOpenb}
                            setMenuOpenb={setMenuOpenb}
                            routelastId={feedtype === 3 ? routelastId : null}
                            setIsMenuOpen={setIsMenuOpen}
                            setIsFullscreen={setIsFullscreen3}
                            isFullscreen={isFullscreen3}
                            type={3}
                            feedContainerRef={feedContainerRef3}
                            isMenuOpen={isMenuOpen}
                            callFeeds={callFeeds}
                            setcallFeeds={setcallFeeds}
                            LastId={LastId}
                            setLastId={setLastId}
                            feeds={feeds3}
                            setFeeds={setFeeds3}
                        />
                    </Box>
                }

                <Box sx={{ flexShrink: 0, height: matchMobile ? '1vh' : '5vh', display: 'block' }} />

                <Box

                    onClick={() => {
                        setPlayGround(true);
                    }}
                    sx={{
                        display: "none",

                        width: matchMobile ? '37vw' : '10vw',
                        left: '10vw',
                        alignItems: "left",

                        px: matchMobile ? "4.5vw" : "1.8vw",
                        py: matchMobile ? "2.2vh" : "1.5vh",
                        borderRadius: "999px",
                        backgroundColor: darkModeReducer ? '#333' : "#fff",
                        color: darkModeReducer ? '#000' : "#000",
                        fontWeight: 600,
                        fontSize: matchMobile ? "0.8rem" : "0.75rem",
                        lineHeight: 1.1,
                        border: "1px solid rgba(0,0,0,0.08)",
                        boxShadow:
                            darkModeReducer
                                ? "0 8px 24px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.4)"
                                : "0 8px 24px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
                        cursor: "pointer",
                        userSelect: "none",
                        transition: "all .15s ease",

                        // fade in same as your text blocks
                        opacity: visible ? 0.8 : 0,
                        // keep your long fade if you like that slow reveal
                        transitionProperty: "opacity, box-shadow, transform, background-color",
                        transitionDuration: visible ? "10s, .15s, .15s, .15s" : ".15s",

                        // hover / active states
                        "&:hover": {
                            boxShadow:
                                darkModeReducer
                                    ? "0 12px 32px rgba(0,0,0,0.8), 0 2px 4px rgba(0,0,0,0.6)"
                                    : "0 12px 32px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.06)",
                            transform: "translateY(-1px)",
                        },
                        "&:active": {
                            transform: "translateY(0)",
                            boxShadow:
                                darkModeReducer
                                    ? "0 4px 12px rgba(0,0,0,0.7)"
                                    : "0 4px 12px rgba(0,0,0,0.1)",
                        },

                        // optional: hide like your section is display:'none'

                    }}
                >
                    PlayGround
                </Box>


                {/* --- Images / Memes --- */}
                <Box sx={{

                    py: matchMobile ? "1.5vh" : "0vh", display: PlayGround ? 'block' : 'none'
                }}>
                    <Box
                        sx={{
                            mt: searchData ? (matchMobile ? '-7vh' : '-8vh') : 0,
                            mb: matchMobile ? "1vh" : "0.1vh",
                            pl: "0.5vw",
                            textAlign: matchMobile ? 'center' : 'left',


                        }}
                    >


                        {searchData ? (
                            <Box
                                component="button"
                                type="button"
                                onClick={handleSearchHome}
                                aria-label="Back to Home"
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: matchMobile ? 'center' : 'flex-start',
                                    gap: matchMobile ? 0.8 : 1,
                                    maxWidth: '100%',
                                    border: 0,
                                    m: 0,
                                    p: 0,
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    opacity: visible ? 0.86 : 0,
                                    transition: 'opacity 10s ease-in-out, transform 120ms ease',
                                    '&:hover .searchBackText': {
                                        opacity: 1,
                                    },
                                    '&:active': {
                                        transform: 'scale(0.98)',
                                    },
                                }}
                            >
                                <Box
                                    component="span"
                                    aria-hidden="true"
                                    sx={{
                                        background: darkModeReducer ? GRADIENTx : GRADIENT,
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        color: 'transparent',
                                        flex: '0 0 auto',
                                        fontSize: matchMobile ? '1.7rem' : '2rem',
                                        fontWeight: 900,
                                        lineHeight: 1,
                                    }}
                                >
                                    &#8592;
                                </Box>
                                <Box
                                    component="span"
                                    className="searchBackText"
                                    sx={{
                                        background: darkModeReducer ? GRADIENTx : GRADIENT,
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        color: 'transparent',
                                        display: 'block',
                                        maxWidth: matchMobile ? '78vw' : '42vw',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        fontWeight: 700,
                                        fontSize: matchMobile ? '1.4rem' : '1.8rem',
                                        letterSpacing: '0.03em',
                                        opacity: 0.9,
                                    }}
                                >
                                    {searchData}
                                </Box>
                            </Box>
                        ) : null}

                        {feeds1.length > 0 ?
                            <span
                                style={{
                                    marginTop: matchMobile ? '2.5vh' : '3vh',
                                    fontSize: matchMobile ? '0.85rem' : '1.05rem',
                                    fontWeight: 700,
                                    WebkitBackgroundClip: 'initial',
                                    WebkitTextFillColor: 'initial',
                                    background: 'none',
                                    letterSpacing: '0.04em',
                                    textTransform: 'uppercase',
                                    opacity: visible ? 0.75 : 0,
                                    transition: "opacity 10s ease-in-out",
                                    display: 'flex',
                                    justifyContent: matchMobile ? 'flex-start' : 'center',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <ImageIcon fontSize="small" />
                                <span>Shorts</span>
                            </span>
                            : null}



                    </Box>


                    <Box
                        sx={{
                            mb: matchMobile ? "1vh" : "0.1vh",
                            pl: "0.5vw",
                            textAlign: matchMobile ? "left" : 'center',
                            padding: '0px',
                            marginTop: matchMobile ? '-8vh' : '-6vh',
                            display: matchMobile ? 'block' : isMenuOpen ? 'none' : 'block'

                        }}
                    >


                        <img


                            src={darkModeReducer ? ClikbaeIcon2 : ClikbaeIcon}
                            alt="ClikBae icon"
                            style={{
                                width: matchMobile ? "2.5rem" : "2.5rem",
                                height: matchMobile ? "2.5rem" : "2.5rem",
                                marginRight: "0.5rem",
                                position: "relative",
                                top: "2vh",
                                opacity: 0,
                                left: matchMobile ? '88vw' : '39vw',


                            }}
                        />
                    </Box>



                    <Feedgate
                        setsearchDataNav={setsearchDataNav}
                        setMyPageIdNav={setMyPageIdNav}
                        setfeedLastIdNav={setfeedLastIdNav}
                        setfeedScrollPosNav={setfeedScrollPosNav}

                        setShowEmotions={setShowEmotions}
                        setLikesPostid={setLikesPostid}
                        setLikes={setLikes}

                        showEmotions={showEmotions}
                        searchData={searchData}
                        feedtypeForHorizontalBackNavigate={feedtype}
                        vertical={false}
                        minimisePrompt={minimisePrompt}
                        MenuOpenb={MenuOpenb}
                        setMenuOpenb={setMenuOpenb}
                        routelastId={feedtype === 1 ? routelastId : null}
                        setIsMenuOpen={setIsMenuOpen}
                        setIsFullscreen={setIsFullscreen1}
                        isFullscreen={isFullscreen1}
                        type={1}
                        feedContainerRef={feedContainerRef1}
                        isMenuOpen={isMenuOpen}
                        callFeeds={callFeeds}
                        setcallFeeds={setcallFeeds}
                        LastId={LastId}
                        setLastId={setLastId}
                        feeds={feeds1}
                        setFeeds={setFeeds1}
                    />
                </Box>


                <Box sx={{ flexShrink: 0, height: matchMobile ? '1vh' : '5vh', display: 'block' }} />

                {/* --- Stories --- */}
                <Box sx={{ py: matchMobile ? "1vh" : IsMobileBackActive ? '6vh' : "2vh", display: PlayGround ? 'block' : 'none' }}>
                    <Box
                        sx={{
                            mb: matchMobile ? "1vh" : "0.1vh",
                            pl: "0.5vw",
                            textAlign: matchMobile ? "left" : 'center',

                        }}
                    >


                        {feeds2.length > 0 ?
                            <span
                                style={{
                                    marginLeft: '0.5rem',
                                    fontSize: matchMobile ? '0.8rem' : '1rem',
                                    fontWeight: 700,
                                    WebkitBackgroundClip: 'initial',
                                    WebkitTextFillColor: 'initial',
                                    background: 'none',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    /// color: darkModeReducer ? 'yellow' : 'red',


                                    /* â”€â”€ fade-in tweaks â”€â”€ */
                                    opacity: visible ? 0.8 : 0,
                                    transition: "opacity 10s ease-in-out",
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                }}
                            >
                                <MenuBookIcon fontSize="small" />
                                <span>Cinema</span>
                            </span>
                            : null}
                    </Box>

                    <Feedgate
                        setsearchDataNav={setsearchDataNav}
                        setMyPageIdNav={setMyPageIdNav}
                        setfeedLastIdNav={setfeedLastIdNav}
                        setfeedScrollPosNav={setfeedScrollPosNav}

                        setShowEmotions={setShowEmotions}
                        setLikesPostid={setLikesPostid}
                        setLikes={setLikes}


                        showEmotions={showEmotions}
                        searchData={searchData}
                        feedtypeForHorizontalBackNavigate={feedtype}
                        vertical={false}
                        minimisePrompt={minimisePrompt}
                        MenuOpenb={MenuOpenb}
                        setMenuOpenb={setMenuOpenb}
                        routelastId={feedtype === 2 ? routelastId : null}
                        setIsMenuOpen={setIsMenuOpen}
                        setIsFullscreen={setIsFullscreen2}
                        isFullscreen={isFullscreen2}
                        type={2}
                        feedContainerRef={feedContainerRef2}
                        isMenuOpen={isMenuOpen}
                        callFeeds={callFeeds}
                        setcallFeeds={setcallFeeds}
                        LastId={LastId}
                        setLastId={setLastId}
                        feeds={feeds2}
                        setFeeds={setFeeds2}
                    />
                </Box>


                <Box sx={{ paddingBottom: matchMobile ? '35vh' : isMenuOpen ? '35vh' : '20vh' }}></Box>
            </Box>



        </>

    );
};

export default Homepage;
