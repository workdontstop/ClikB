import React, { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { Button, IconButton } from "@mui/material";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import SuperstarzIconLight from "./s.png";
import CloseIcon from "@mui/icons-material/Close";

import { matchMobile } from "./DetectDevice";

const Home = ({ handleLoginError, handleLoginSuccess, x, setx }: any) => {
    const darkModeReducer = useSelector(
        (state: RootState) => state.settings.darkMode
    );
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

    // New state to manage the expanded/collapsed state of the description
    const [expanded, setExpanded] = useState(false);

    const toggleExpanded = () => {
        setExpanded(!expanded);
    };

    return (
        <div
            // This div is the full-screen overlay
            onClick={() => setx(true)}
            style={{
                height: "100%",
                width: "100%",
                position: "fixed",
                zIndex: "200000",
                top: 0,
                left: 0,
                cursor: "pointer",
                backgroundColor: "rgb(0,0,0,0.1)",

                display:
                    x || (loggedUser && loggedUser.id !== 1) ? "none" : "flex",
                // We use flex so the inner container can be placed at the bottom
                alignItems: "flex-end",
                justifyContent: "center",
            }}
        >
            {/* This container sits at the bottom of the screen */}
            <div
                onClick={(e) => e.stopPropagation()} // Prevent click on inner div from closing
                style={{
                    width: "95%",
                    height: matchMobile ? expanded ? '85%' : "55%" : expanded ? '90%' : "55%",
                    maxWidth: "600px",
                    marginBottom: "0px", // space from bottom edge
                    padding: "20px 20px 24px 20px", // top/right/bottom/left
                    borderRadius: "16px 16px 0 0",
                    boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.2)",
                    position: "relative",
                    backgroundColor: darkModeReducer ? 'rgb(5,5,5,0.25)' : "rgb(205,205,205,0.25)",
                    backdropFilter: darkModeReducer ? matchMobile ? "blur(18px)" : "blur(30px)" : matchMobile ? "blur(12px)" : "blur(18px)",
                    color: darkModeReducer ? "#ffffff" : "#000000",
                    cursor: "default", // override outer cursor: pointer
                }}
            >
                {/* Close button (if you want it visible) */}
                <IconButton
                    onClick={() => setx(true)}
                    style={{
                        position: "absolute",
                        top: "10px",
                        right: "10px",
                        color: darkModeReducer ? "#ffffff" : "#000000",
                    }}
                >
                    <CloseIcon />
                </IconButton>

                {/* Title Section */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: "12px",
                        textAlign: "center",
                        marginRight: matchMobile ? "12vw" : "20px",
                    }}
                >
                    <img
                        src={SuperstarzIconLight}
                        alt="App Icon"
                        style={{
                            width: matchMobile ? "25vw" : "6vw",
                            height: "auto",
                            padding: "0px",
                        }}
                    />
                    <h1
                        style={{
                            margin: 0,
                            fontSize: "2rem",
                            fontWeight: matchMobile ? "bolder" : 800,
                            textAlign: "center",
                        }}
                    >
                        <span
                            style={{
                                opacity: 1,
                            }}
                        >
                            Clik
                        </span>

                        <span
                            style={{
                                color: darkModeReducer ? "#F6BB56" : "#F6BB56",
                                opacity: 1,
                            }}
                        >
                            B
                        </span>
                    </h1>
                </div>

                {/* Description */}
                <p
                    style={{
                        margin: "0 0 20px 0",
                        fontSize: matchMobile ? "1.15rem" : "1.28rem",
                        textAlign: "center",
                        padding: "0px",
                        lineHeight: 1.4,
                    }}
                >
                    <p>
                        <strong>Welcome to ClikB 🎨</strong>
                    </p>
                    <p>
                        An AI-powered social experiment{" "}
                        {!expanded && (
                            <>
                                ...
                                <br />
                                <br />
                            </>
                        )}
                        {expanded && (
                            <>
                                <br></br>
                                <br></br>
                                <br></br>
                                create AI stories 📖.{" "}
                                <span style={{ fontWeight: "bolder" }}>Stories</span>
                                <br></br>
                                remix Images 🖼️ .{" "}
                                <span style={{ fontWeight: "bolder" }}>Memes</span>
                                <br></br>
                                and play AI mini games 🎮 .{" "}
                                <span style={{ fontWeight: "bolder" }}>Interactions</span>
                            </>
                        )}
                    </p>
                    <Button
                        onClick={toggleExpanded}
                        variant="text"
                        style={{
                            color: darkModeReducer ? "#F6BB56" : "#DA8E0B",
                            textTransform: "none",
                            fontSize: "1rem",
                            padding: "0px",
                        }}
                    >
                        {expanded ? "Read Less" : "Read More"}
                    </Button>
                </p>

                {/* Login + Guest Buttons */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        width: "100%",
                        marginTop: matchMobile ? "" : "5vh",
                        padding: "0px",
                    }}
                >
                    <GoogleLogin
                        onSuccess={handleLoginSuccess}
                        onError={handleLoginError}
                        size="medium"
                        width="100%"
                    />

                    <Button
                        variant="contained"
                        onClick={() => setx(true)}
                        style={{
                            width: "100%",
                            padding: "10px",
                            backgroundColor: "#F6BB56",
                            color: "#000000",
                            textTransform: "none",
                            fontSize: "16px",
                        }}
                    >
                        Continue as Guest
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default Home;