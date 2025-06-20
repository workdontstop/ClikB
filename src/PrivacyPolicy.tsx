import React from "react";
import {
    Box,
    Container,
    Stack,
    Paper,
    Typography,
    List,
    ListItem,
    ListItemText,
} from "@mui/material";

const PrivacyPolicy = () => {
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                height: "100vh", // Full viewport height
                overflowY: "auto", // Enables vertical scrolling
                py: 3,
                bgcolor: "#f9f9f9", // Light background color
            }}
        >
            <Container maxWidth="md">
                <Stack spacing={4}>

                    {/* Privacy Policy Title & Date */}
                    <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
                        <Typography variant="h4" fontWeight="bold" align="center" sx={{ mb: 2 }}>
                            Privacy Policy
                        </Typography>
                        <Typography variant="body1" align="center" color="text.secondary">
                            Effective Date:{" "}
                            <Typography component="span" fontWeight="bold" color="error.main">
                                January 6, 2025
                            </Typography>
                        </Typography>
                    </Paper>

                    {/* Introduction */}
                    <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                            Introduction
                        </Typography>
                        <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.8 }}>
                            At{" "}
                            <Typography component="span" color="error.main">
                                ClikB
                            </Typography>
                            , operated by{" "}
                            <Typography component="span" color="success.main">
                                ClikBase (Startup)
                            </Typography>
                            , we value your privacy and are committed to protecting your personal data.
                            This Privacy Policy outlines how we collect, use, and safeguard your information
                            when you use{" "}
                            <Typography component="span" color="primary.main">
                                www.clikb.com
                            </Typography>
                            (the “App”) and related services. By accessing or using the App,
                            you agree to the terms of this Privacy Policy.
                        </Typography>
                    </Paper>

                    {/* 1. Data We Collect */}
                    <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                            1. Data We Collect
                        </Typography>
                        <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.8 }} paragraph>
                            We only collect the following personal data:
                        </Typography>
                        <List dense>
                            <ListItem sx={{ pl: 0 }}>
                                <ListItemText
                                    primary="Email Address:"
                                    secondary={
                                        <Typography component="span" color="warning.main">
                                            example@example.com
                                        </Typography>
                                    }
                                    primaryTypographyProps={{ color: "text.primary" }}
                                    secondaryTypographyProps={{ color: "text.secondary" }}
                                />
                            </ListItem>
                            <ListItem sx={{ pl: 0 }}>
                                <ListItemText
                                    primary="Name:"
                                    secondary={
                                        <Typography component="span" color="secondary.main">
                                            John Doe
                                        </Typography>
                                    }
                                    primaryTypographyProps={{ color: "text.primary" }}
                                    secondaryTypographyProps={{ color: "text.secondary" }}
                                />
                            </ListItem>
                        </List>
                        <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.8 }}>
                            We do not collect any device-specific information such as IP addresses, device types,
                            operating systems, or browser types.
                        </Typography>
                    </Paper>

                    {/* 2. How We Use Your Data */}
                    <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                            2. How We Use Your Data
                        </Typography>
                        <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.8 }} paragraph>
                            We use your personal data to:
                        </Typography>
                        <List dense>
                            <ListItem sx={{ pl: 0 }}>
                                <ListItemText
                                    primary="Authenticate your account and manage your session securely using JWT-encrypted cookies."
                                    primaryTypographyProps={{ color: "text.primary" }}
                                />
                            </ListItem>
                            <ListItem sx={{ pl: 0 }}>
                                <ListItemText
                                    primary="Provide app services, interactive features, and facilitate AI-generated content for sale."
                                    primaryTypographyProps={{ color: "text.primary" }}
                                />
                            </ListItem>
                            <ListItem sx={{ pl: 0 }}>
                                <ListItemText
                                    primary="Communicate with you about updates, services, and other notifications relevant to your use of the App."
                                    primaryTypographyProps={{ color: "text.primary" }}
                                />
                            </ListItem>
                        </List>
                    </Paper>

                    {/* 3. Community Flagging and Content Moderation */}
                    <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                            3. Community Flagging and Content Moderation
                        </Typography>
                        <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.8 }}>
                            We employ a community-based system where users can flag high-risk, illegal, or
                            sensitive content. This system is supplemented by an internal flagging system,
                            which serves as an initial checkpoint (
                            <Typography component="span" color="error.main">
                                icebreaker
                            </Typography>
                            ) to filter out inappropriate content. Paid community moderators may review flagged
                            content for accuracy.
                        </Typography>
                    </Paper>

                    {/* 4. Contact Information */}
                    <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                        <Typography variant="h6" fontWeight="bold" gutterBottom>
                            4. Contact Information
                        </Typography>
                        <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.8 }} paragraph>
                            If you have any questions or concerns about this Privacy Policy, please contact us at:
                        </Typography>
                        <List dense>
                            <ListItem sx={{ pl: 0 }}>
                                <ListItemText
                                    primary="Email:"
                                    secondary={
                                        <Typography component="span" color="error.main">
                                            clikbateskywalker@gmail.com
                                        </Typography>
                                    }
                                    primaryTypographyProps={{ color: "text.primary" }}
                                    secondaryTypographyProps={{ color: "text.secondary" }}
                                />
                            </ListItem>
                            <ListItem sx={{ pl: 0 }}>
                                <ListItemText
                                    primary="Parent Company:"
                                    secondary={
                                        <Typography component="span" color="success.main">
                                            ClikBase (Startup)
                                        </Typography>
                                    }
                                    primaryTypographyProps={{ color: "text.primary" }}
                                    secondaryTypographyProps={{ color: "text.secondary" }}
                                />
                            </ListItem>
                        </List>
                    </Paper>
                </Stack>
            </Container>
        </Box>
    );
};

export default PrivacyPolicy;
