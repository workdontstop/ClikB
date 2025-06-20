// Settings.jsx
import React, { useEffect, FC } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { Box, Button, Typography, Container, Stack, Paper, List, ListItem, ListItemText } from "@mui/material";



const CLIK_URL = import.meta.env.VITE_CLIK_URL;

interface SettingsProps {
    isMenuOpen: boolean;
    callFeeds: boolean;
    setcallFeeds: React.Dispatch<React.SetStateAction<boolean>>;
    AllowPing: boolean;
    setAllowPing: React.Dispatch<React.SetStateAction<boolean>>;
    darkmode?: boolean;
}

const Settings: FC<SettingsProps> = ({ isMenuOpen, callFeeds, setcallFeeds, AllowPing, setAllowPing, darkmode = false }) => {
    const location = useLocation();
    const navigate = useNavigate();


    useEffect(() => {
        setcallFeeds(true);
    }, [location.pathname, setcallFeeds]);

    const handleLogout = async () => {
        try {
            await axios.post(`${CLIK_URL}/logout`, {}, { withCredentials: true });
            console.log("Logged out successfully");
            /// window.location.reload();
            window.location.replace('/');


        } catch (error) {
            console.error("Error during logout:", error);
        }
    };

    // Handler for the Privacy Policy button
    const handlePrivacyPolicy = () => {
        navigate("/privacy-policy");
    };

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                height: "100vh",

            }}
        >
            {/* Top Bar */}
            <Box
                sx={{
                    py: 2,
                    px: 3,
                    borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                    display: "flex",
                    justifyContent: "space-between", // Adjusted to include both Logout and Privacy Policy buttons
                }}
            >
                <Button variant="contained" color="primary" onClick={handlePrivacyPolicy}>
                    Privacy Policy
                </Button>
                <Button variant="contained" color="error" onClick={handleLogout}>
                    Logout
                </Button>
            </Box>

            {/* Scrollable Content */}
            <Box sx={{ flex: 1, overflowY: "auto", py: 3 }}>
                <Container maxWidth="md">
                    {/* Your settings page content goes here */}
                    <Typography variant="h5">Settings Content</Typography>
                    {/* ... */}
                </Container>
            </Box>
        </Box>
    );
};

export default Settings;
