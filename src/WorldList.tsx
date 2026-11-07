import React, { useState, useEffect, useRef } from "react";
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    CardMedia,
    CircularProgress,
    Pagination,
    PaginationItem,
    Stack,
    IconButton,
    Button
} from "@mui/material";
import axios from "axios";
import { useSelector } from "react-redux";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { alpha } from '@mui/material/styles';

// IMPORTANT: Import your detail component here
import WorldListOpened from "./WorldListOpened";
import WorldCreation, { type WorldAssetKind } from "./WorldCreation";

// Make sure this path to store is correct in your project
import { RootState } from "./store";

// --- TYPES ---
export interface Character {
    id: number;
    name: string;
    description: string;
    image: string;
    activated?: boolean;
    kind?: WorldAssetKind;
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
    userid?: number | string;
    characters: Character[];
    catalog_revision?: number;
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
    selectedWorldId?: string | number | null;
    setSelectedWorldId?: any;
    Vipcharacters?: any[];
    setVipcharacters?: any;

}

const CLIK_URL = import.meta.env.VITE_CLIK_URL;

const WorldList: React.FC<WorldListProps> = ({
    open, mode, darkMode, PRIMARY_COLOR, selectedImages, setWorldModelsInuse, handleSelection,
    DirectUpload, onClose, setRemixData,
    setWorldCover, setWorldStyle, selectedWorldId, setSelectedWorldId,
    Vipcharacters, setVipcharacters }) => {
    // --- REDUX USER ---
    const loggedUser = useSelector((state: any) => state.profile.loggedUser);

    const darkModeReducer = useSelector((state: RootState) => state.settings.darkMode);
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    // --- STATE ---
    const [worlds, setWorlds] = useState<World[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const worldRequest = useRef(0);

    // Pagination State
    const [page, setPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const itemsPerPage = 8;

    // Selected World State (Master-Detail logic)
    const [editingWorld, setEditingWorld] = useState(false);
    const [selectedWorld, setSelectedWorld] = useState<World | null>(null);
    const [confirmDeleteWorldId, setConfirmDeleteWorldId] = useState<number | null>(null);
    const [deletingWorldId, setDeletingWorldId] = useState<number | null>(null);
    const [deleteError, setDeleteError] = useState<string>("");

    var COLORB = darkModeReducer ? '#000' : '#fff';

    // Define Active Color logic
    const activeColor = (darkModeReducer ? (appColorDark || "#FFD52A") : (appColorLight || "#A16900")) || PRIMARY_COLOR;

    // --- EFFECT: GLOBAL STATE CHECKER ---
    useEffect(() => {
        if (!setWorldModelsInuse) return;
        const isAnyModelInUse = worlds.some(world =>
            world.characters && world.characters.some(char =>
                selectedImages && selectedImages.includes(char.image)
            )
        );
        setWorldModelsInuse(isAnyModelInUse);
    }, [worlds, selectedImages, setWorldModelsInuse]);

    // --- API CALL ---
    const fetchWorlds = async (pageNum: number) => {
        const userId = loggedUser?.id;
        if (!userId) return;

        const request = ++worldRequest.current;
        setLoading(true);
        try {
            const response: any = await axios.get(`${CLIK_URL}/worlds`, {
                params: {
                    page: pageNum,
                    limit: itemsPerPage,
                    userid: userId
                }
            });

            if (request !== worldRequest.current) return;
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
            if (request === worldRequest.current) setLoading(false);
        }
    };

    // --- EFFECT: Fetch Worlds ---
    useEffect(() => {
        if (open && (mode === 0 || mode === 2) && !selectedWorld) {
            fetchWorlds(page);
        }
        return () => { worldRequest.current += 1; };
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
                    const isSelectedWorld = selectedWorldId !== null
                        && selectedWorldId !== undefined
                        && String(world.id) === String(selectedWorldId);
                    const isActive = isSelectedWorld || isAnyCharSelected;

                    if (world.activated !== isActive) {
                        return { ...world, activated: isActive };
                    }
                    return world;
                })
            );
        }
    }, [selectedImages, selectedWorldId]);

    const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
        setConfirmDeleteWorldId(null);
        setDeleteError("");
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

    const loggedUserId = Number(loggedUser?.id || 0);

    const canDeleteWorld = (world: World) => {
        if (loggedUserId <= 0) return false;
        if (Number(world.userid) !== loggedUserId) return false;
        // In PROD mode, disable deletion for Guest account (id 1) so public users cannot delete guest worlds
        if (import.meta.env.PROD && loggedUserId === 1) return false;
        return true;
    };

    const handleOpenDeleteConfirm = (event: React.MouseEvent, world: World) => {
        event.stopPropagation();
        setDeleteError("");
        setConfirmDeleteWorldId((current) => current === world.id ? null : world.id);
    };

    const handleCancelDelete = (event: React.MouseEvent) => {
        event.stopPropagation();
        setDeleteError("");
        setConfirmDeleteWorldId(null);
    };

    const handleDeleteWorld = async (event: React.MouseEvent, world: World) => {
        event.stopPropagation();

        if (!canDeleteWorld(world) || deletingWorldId) return;

        setDeletingWorldId(world.id);
        setDeleteError("");

        try {
            await axios.post(`${CLIK_URL}/delete_world_model`, {
                worldId: world.id,
                userid: loggedUserId
            }, { withCredentials: true });

            setWorlds((prevWorlds) => prevWorlds.filter((item) => item.id !== world.id));
            setConfirmDeleteWorldId(null);
            await fetchWorlds(page);
        } catch (error: any) {
            console.error("Error deleting world:", error);
            setDeleteError(error?.response?.data?.message || "World delete failed");
        } finally {
            setDeletingWorldId(null);
        }
    };

    useCreationControls('worlds', 'WorldList', open && (mode === 0 || mode === 2), { page, totalPages, loading,
        openedWorldId: selectedWorld?.id ?? null, activeWorldId: selectedWorldId == null ? null : String(selectedWorldId),
        deleteError, deletingWorldId, confirmDeleteWorldId });
    if (!open || (mode !== 0 && mode !== 2)) {
        return null;
    }

    // --- RENDER LOGIC ---

    // 1. If a world is selected, show the Detail View (WorldListOpened)
    if (selectedWorld && editingWorld && canDeleteWorld(selectedWorld)) {
        return <WorldCreation key={selectedWorld.id} open world={selectedWorld} darkMode={darkMode} PRIMARY_COLOR={activeColor}
            onClose={() => setEditingWorld(false)} setCreationDone={() => { setEditingWorld(false); setSelectedWorld(null); }} />;
    }
    if (selectedWorld) {
        return (
            <WorldListOpened
                setWorldStyle={setWorldStyle}
                setRemixData={setRemixData}
                setWorldCover={setWorldCover}
                selectedWorldId={selectedWorldId}
                setSelectedWorldId={setSelectedWorldId}

                DirectUpload={DirectUpload}
                onClose={onClose}
                selectedImages={selectedImages}
                handleSelection={handleSelection}

                mode={mode}
                world={selectedWorld}
                onEdit={canDeleteWorld(selectedWorld) ? () => setEditingWorld(true) : undefined}
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
            {...cb('worlds', 'scroll', 'Scroll Worlds', 'worldList.scrollBy', 'scroll')}
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
                            const hasSelectedCharacter = world.characters && world.characters.length > 0
                                ? world.characters.some(char => selectedImages && selectedImages.includes(char.image))
                                : false;
                            const isSelectedWorld = selectedWorldId !== null
                                && selectedWorldId !== undefined
                                && String(world.id) === String(selectedWorldId);
                            const activeState = isSelectedWorld || hasSelectedCharacter;
                            const ownerCanDelete = canDeleteWorld(world);
                            const isConfirmingDelete = confirmDeleteWorldId === world.id;
                            const isDeletingWorld = deletingWorldId === world.id;

                            return (
                                <Grid item xs={12} sm={6} md={4} lg={3} key={world.id}>
                                    <Card
                                        onClick={() => handleCardClick(world)}
                                        {...cb('worlds', `open_${world.id}`, world.title, 'handleCardClick')}
                                        sx={{
                                            // USE activeState variable, NOT world.activated state
                                            bgcolor: activeState ? activeColor : (darkMode ? 'rgba(255,255,255,0.05)' : '#fff'),
                                            color: activeState ? COLORB : (darkMode ? '#fff' : '#000'),
                                            borderRadius: 3,
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                                            transition: 'transform 0.2s',
                                            cursor: 'pointer',
                                            height: '100%',
                                            position: 'relative',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            '&:hover': { transform: 'translateY(-4px)' }
                                        }}
                                    >
                                        {ownerCanDelete && (
                                            <Box
                                                onClick={(event) => event.stopPropagation()}
                                                sx={{
                                                    position: 'absolute',
                                                    top: 10,
                                                    right: 10,
                                                    zIndex: 4,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.5,
                                                    bgcolor: isConfirmingDelete ? 'rgba(0,0,0,0.72)' : 'transparent',
                                                    borderRadius: 999,
                                                    p: isConfirmingDelete ? 0.5 : 0
                                                }}
                                            >
                                                {isConfirmingDelete ? (
                                                    <>
                                                        <Button
                                                            size="small"
                                                            disabled={isDeletingWorld}
                                                            onClick={(event) => handleDeleteWorld(event, world)}
                                                            {...cb('worlds', `delete_${world.id}`, `Delete ${world.title}`, 'handleDeleteWorld', 'click', 'needs_confirmation')}
                                                            sx={{
                                                                minWidth: 44,
                                                                px: 1,
                                                                color: '#fff',
                                                                fontWeight: 900,
                                                                fontSize: 12
                                                            }}
                                                        >
                                                            {isDeletingWorld ? '...' : 'YES'}
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            disabled={isDeletingWorld}
                                                            onClick={handleCancelDelete}
                                                            {...cb('worlds', `cancel_delete_${world.id}`, 'Cancel world deletion', 'handleCancelDelete')}
                                                            sx={{
                                                                minWidth: 36,
                                                                px: 1,
                                                                color: '#fff',
                                                                fontWeight: 900,
                                                                fontSize: 12
                                                            }}
                                                        >
                                                            NO
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <IconButton
                                                        aria-label="Delete world"
                                                        onClick={(event) => handleOpenDeleteConfirm(event, world)}
                                                        {...cb('worlds', `request_delete_${world.id}`, `Review deleting ${world.title}`, 'handleOpenDeleteConfirm')}
                                                        sx={{
                                                            width: 36,
                                                            height: 36,
                                                            color: '#fff',
                                                            bgcolor: 'rgba(0,0,0,0.58)',
                                                            backdropFilter: 'blur(8px)',
                                                            '&:hover': { bgcolor: 'rgba(180,0,0,0.72)' }
                                                        }}
                                                    >
                                                        <DeleteOutlineIcon sx={{ fontSize: 21 }} />
                                                    </IconButton>
                                                )}
                                            </Box>
                                        )}
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
                                                    <CheckCircleIcon sx={{ fontSize: 18, color: COLORB }} />
                                                    <Typography variant="caption" sx={{ fontWeight: 800, color: COLORB, textTransform: 'uppercase' }}>
                                                        IN USE
                                                    </Typography>
                                                </Box>
                                            )}

                                            {isConfirmingDelete && deleteError && (
                                                <Typography variant="caption" sx={{ display: 'block', color: '#ff5a5a', fontWeight: 800, mb: 1 }}>
                                                    {deleteError}
                                                </Typography>
                                            )}

                                            <Typography gutterBottom variant="h6" component="div" sx={{ fontWeight: 700 }}>
                                                {world.title}
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                // Uses activeState
                                                color={activeState ? (darkModeReducer ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.8)") : (darkMode ? "rgba(255,255,255,0.7)" : "text.secondary")}
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
                                renderItem={item => <PaginationItem {...item} {...(typeof item.page === 'number'
                                    ? cb('worlds', `page_${item.type}_${item.page}`, `Go to Worlds page ${item.page}`, 'handlePageChange') : {})} />}
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
import { creationBinding as cb } from './creationControlSnapshot';
import { useCreationControls } from './useCreationControls';
