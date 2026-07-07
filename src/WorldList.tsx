import React, { useState, useEffect } from "react";
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    CardMedia,
    CircularProgress,
    Pagination,
    Stack
} from "@mui/material";
import axios from "axios";
import { useSelector } from "react-redux";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import { alpha } from '@mui/material/styles';

// IMPORTANT: Import your detail component here
import WorldListOpened from "./WorldListOpened";

// Make sure this path to store is correct in your project
import { RootState } from "./store";

// --- TYPES ---
export interface Character {
    id: number;
    name: string;
    description: string;
    image: string;
    activated?: boolean;
}

export interface World {
    id: number;
    title: string;
    description: string;
    cover: string;
    blueprint: string;
    original_prompt: string;
    planx: any;
    post_id: number;
    selected_style: string;
    characters: Character[];
    activated?: boolean;


}

interface WorldListProps {
    open: boolean;
    mode: number;
    darkMode: boolean;
    PRIMARY_COLOR: any;
    selectedImages: any;
    handleSelection: any;
    setWorldModelsInuse?: any;
    DirectUpload?: any;
    onClose: any;
    setRemixData?: any;
    setWorldCover?: any;
    setWorldStyle?: any;
    Vipcharacters?: any[];
    setVipcharacters?: any;

}

const CLIK_URL = import.meta.env.VITE_CLIK_URL;

const WorldList: React.FC<WorldListProps> = ({
    open, mode, darkMode, PRIMARY_COLOR, selectedImages, setWorldModelsInuse, handleSelection,
    DirectUpload, onClose, setRemixData,
    setWorldCover, setWorldStyle, Vipcharacters, setVipcharacters }) => {
    // --- REDUX USER ---
    const loggedUser = useSelector((state: any) => state.profile.loggedUser);

    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);
    // --- STATE ---
    const [worlds, setWorlds] = useState<World[]>([]);
    const [loading, setLoading] = useState<boolean>(false);

    // Pagination State
    const [page, setPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const itemsPerPage = 8;

    // Selected World State (Master-Detail logic)
    const [selectedWorld, setSelectedWorld] = useState<World | null>(null);

    var COLORB = darkModeReducer ? '#000' : '#fff';

    // Define Active Color logic
    const activeColor = PRIMARY_COLOR || (darkModeReducer ? "#E8BAFA" : "#0099cc");


    // --- EFFECT: GLOBAL STATE CHECKER ---
    // Checks if ANY character across ALL fetched worlds is currently selected.
    useEffect(() => {
        // 1. Safety Check: If the parent didn't provide the setter, stop.
        if (!setWorldModelsInuse) return;

        // 2. The Logic: Loop through all worlds -> all characters -> check if in selectedImages
        const isAnyModelInUse = worlds.some(world =>
            world.characters && world.characters.some(char =>
                selectedImages && selectedImages.includes(char.image)
            )
        );

        // 3. Send the result (true/false) to the parent
        setWorldModelsInuse(isAnyModelInUse);

    }, [worlds, selectedImages, setWorldModelsInuse]);

    // --- API CALL ---
    const fetchWorlds = async (pageNum: number) => {
        const userId = loggedUser?.id;
        if (!userId) return;

        setLoading(true);
        try {
            const response: any = await axios.get(`${CLIK_URL}/worlds`, {
                params: {
                    page: pageNum,
                    limit: itemsPerPage,
                    userid: userId
                }
            });

            const { data, pagination } = response.data;

            // Initialize default state
            const processedData = data.map((w: World) => ({
                ...w,
                activated: false,
                characters: w.characters.map((c: Character) => ({
                    ...c,
                    activated: false
                }))
            }));

            setWorlds(processedData);
            setTotalPages(pagination.totalPages);
        } catch (error) {
            console.error("Error fetching worlds:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- EFFECT: Fetch Worlds ---
    useEffect(() => {
        if (open && (mode === 0 || mode === 2) && !selectedWorld) {
            fetchWorlds(page);
        }
    }, [open, mode, page, loggedUser, selectedWorld]);

    // Note: I kept this useEffect to update the internal state object,
    // but the VISUALS are now handled directly in the render map below to ensure it works.
    useEffect(() => {
        if (worlds.length > 0) {
            setWorlds(prevWorlds =>
                prevWorlds.map(world => {
                    const isAnyCharSelected = world.characters && world.characters.length > 0
                        ? world.characters.some(char => selectedImages && selectedImages.includes(char.image))
                        : false;

                    if (world.activated !== isAnyCharSelected) {
                        return { ...world, activated: isAnyCharSelected };
                    }
                    return world;
                })
            );
        }
    }, [selectedImages]);

    const handlePageChange = (event: React.ChangeEvent<unknown>, value: number) => {
        setPage(value);
    };

    // Handle opening the details view
    const handleCardClick = (world: World) => {
        console.log("Opening World:", world.title);
        setSelectedWorld(world);
    };

    // Handle going back to the list
    const handleBackToList = () => {
        setSelectedWorld(null);
    };

    if (!open || (mode !== 0 && mode !== 2)) {
        return null;
    }

    // --- RENDER LOGIC ---

    // 1. If a world is selected, show the Detail View (WorldListOpened)
    if (selectedWorld) {
        return (
            <WorldListOpened
                setWorldStyle={setWorldStyle}
                setRemixData={setRemixData}
                setWorldCover={setWorldCover}

                DirectUpload={DirectUpload}
                onClose={onClose}
                selectedImages={selectedImages}
                handleSelection={handleSelection}

                mode={mode}
                world={selectedWorld}
                onBack={handleBackToList}

                Vipcharacters={Vipcharacters}
                setVipcharacters={setVipcharacters}

                PRIMARY_COLOR={PRIMARY_COLOR}
            />
        );
    }

    // 2. Otherwise, show the List View
    return (
        <Box
            sx={{
                width: '100%',
                height: '100%',
                overflowY: 'auto',
                p: 1,
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <Typography variant="h6" sx={{ color: darkMode ? '#fff' : '#000', mb: 3, fontWeight: 700, pl: 1 }}>
                {mode === 0 ? '' : 'My Worlds'}
            </Typography>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
                    <CircularProgress color="inherit" />
                </Box>
            ) : (
                <>
                    <Grid container spacing={3} sx={{ flexGrow: 1 }}>
                        {worlds.map((world) => {
                            // --- LIVE CHECKER ---
                            // We calculate this right here in the render loop.
                            // This guarantees it is visually correct even if state lags.
                            const activeState = world.characters && world.characters.length > 0
                                ? world.characters.some(char => selectedImages && selectedImages.includes(char.image))
                                : false;

                            return (
                                <Grid item xs={12} sm={6} md={4} lg={3} key={world.id}>
                                    <Card
                                        onClick={() => handleCardClick(world)}
                                        sx={{
                                            // USE activeState variable, NOT world.activated state
                                            bgcolor: activeState ? activeColor : (darkMode ? 'rgba(255,255,255,0.05)' : '#fff'),
                                            color: activeState ? '#000000' : (darkMode ? '#fff' : '#000'),
                                            borderRadius: 3,
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                                            transition: 'transform 0.2s',
                                            cursor: 'pointer',
                                            height: '100%',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            '&:hover': { transform: 'translateY(-4px)' }
                                        }}
                                    >
                                        <CardMedia
                                            component="img"
                                            height="240"
                                            image={world.cover}
                                            alt={world.title}
                                            sx={{
                                                objectFit: 'cover',
                                                objectPosition: '50% 28%'
                                            }}
                                        />
                                        <CardContent sx={{ flexGrow: 1 }}>
                                            {/* IN USE INDICATOR - Uses activeState */}
                                            {activeState && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                                                    <CheckCircleIcon sx={{ fontSize: 18, color: '#000000' }} />
                                                    <Typography variant="caption" sx={{ fontWeight: 800, color: '#000000', textTransform: 'uppercase' }}>
                                                        IN USE
                                                    </Typography>
                                                </Box>
                                            )}

                                            <Typography gutterBottom variant="h6" component="div" sx={{ fontWeight: 700 }}>
                                                {world.title}
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                // Uses activeState
                                                color={activeState ? "rgba(0,0,0,0.8)" : (darkMode ? "rgba(255,255,255,0.7)" : "text.secondary")}
                                                sx={{
                                                    display: '-webkit-box',
                                                    overflow: 'hidden',
                                                    WebkitBoxOrient: 'vertical',
                                                    WebkitLineClamp: 3,
                                                }}
                                            >
                                                {world.description}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            );
                        })}
                    </Grid>

                    {/* Pagination */}

                    <div
                        style={{
                            paddingBottom: '20vh',
                        }}
                    ></div>

                    <Box
                        sx={{
                            position: 'absolute',
                            bottom: '2vh',
                            width: '90vw',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            display: 'flex',
                            justifyContent: 'center',
                            py: 4,
                            mt: 'auto',
                            zIndex: 100
                        }}
                    >
                        <Stack spacing={2}>
                            <Pagination
                                count={totalPages}
                                page={page}
                                onChange={handlePageChange}
                                color="primary"
                                shape="rounded"
                                size="large"
                                sx={(theme) => ({
                                    '& .MuiPaginationItem-root': {
                                        color: darkModeReducer ? '#fff' : '#000',
                                        backgroundColor: alpha(COLORB, 0.65),
                                        backdropFilter: 'blur(10px)',
                                        WebkitBackdropFilter: 'blur(10px)',
                                        border: `1px solid ${alpha(COLORB, 0.3)}`,
                                        boxShadow: '0 4px 6px rgba(5, 4, 4, 0.2)',
                                        transition: 'all 0.3s ease',
                                        '&:hover': {
                                            backgroundColor: alpha(COLORB, 0.85),
                                            color: darkModeReducer ? '#fff' : '#000'
                                        }
                                    },
                                    '& .Mui-selected': {
                                        backgroundColor: `${COLORB} !important`,
                                        fontWeight: 'bold',
                                        border: '1px solid rgba(255,255,255,0.5)',
                                        transform: 'scale(1.1)',
                                        color: COLORB
                                    }
                                })}

                            />
                        </Stack>
                    </Box>
                </>
            )}
        </Box>
    );
};

export default WorldList;
