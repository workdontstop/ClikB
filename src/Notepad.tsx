// Notepad.tsx
import React, { FC, useCallback, useState, useEffect } from "react";
import axios from "axios";
const CLIK_URL = import.meta.env.VITE_CLIK_URL;
import {
    Box,
    IconButton,
    Tooltip,
    Dialog,
    DialogContent,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import { matchMobile } from "./DetectDevice";
import NotepadEditor from "./NotepadEditor";
import type { ImageGenCache } from "./components/PromptConstructor";
import { Template } from "./PromptConstructorMock";

import { useSelector } from "react-redux";
import { RootState } from "./store";

interface NotepadProps {
    onSpeak?: () => void;
    type: any;
    GeneratedImage: any;

    hide: boolean;
    size?: "small" | "medium";
    /** Right-side fused panel */
    panel?: boolean;
    /** Controls the dialog */
    open?: boolean;
    /** Prompt value synced with parent */
    value?: string;
    /** Update prompt in parent */
    onChange?: (value: string) => void;
    /** Close dialog */
    onClose?: () => void;
    setIsNotepadOpen: any;
    /** App color switch: yellow in dark, red in light */
    darkMode?: boolean;
    placeholder: any;
    handleKeyDown: any;
    TextFieldactive: any;
    setTextFieldactive: any;
    Caret?: any;
    mode?: any;
    showTemplates?: boolean;
    cachedImageGen?: ImageGenCache;
    onUpdateCachedImageGen?: (data: ImageGenCache) => void;
    referenceImages?: any[];
    detectedCharacters?: any[];
    SelectedModel?: string;
    zIndex?: number;
    ImagesHdCloud?: string[];
    musicMode?: boolean;
    musicUrl?: string;
    musicName?: string;
    musicBreakerSec?: 5 | 10;
    onMusicBreakerChange?: (seconds: 5 | 10) => void;
    onMusicSceneCountChange?: (count: number) => void;
    onMusicSegmentsChange?: (segments: { index: number; start: number; end: number }[]) => void;
}



const Notepad: FC<NotepadProps> = ({
    onSpeak,
    type,
    panel = false,
    open = false,
    value = "",
    onChange,
    onClose,
    setIsNotepadOpen,
    hide,
    GeneratedImage,
    placeholder,
    TextFieldactive,
    setTextFieldactive,
    handleKeyDown,
    Caret,
    mode,
    showTemplates,
    cachedImageGen,
    onUpdateCachedImageGen,
    referenceImages = [],
    detectedCharacters = [],
    SelectedModel,
    zIndex,
    ImagesHdCloud,
    musicMode = false,
    musicUrl = "",
    musicName = "",
    musicBreakerSec = 10,
    onMusicBreakerChange,
    onMusicSceneCountChange,
    onMusicSegmentsChange,
}) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        onChange?.(event.target.value);
    };

    const darkMode = useSelector((state: RootState) => state.settings.darkMode);
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

    // True while the brainstorm chat is open â€” grows the dialog and guards close.
    // Declared before handleDialogClose because that callback reads it.
    const [isBrainstormOpen, setIsBrainstormOpen] = useState(false);
    // True while the template list is open â€” grows the dialog (height only).
    const [isTemplateLibraryOpen, setIsTemplateLibraryOpen] = useState(false);
    // Either expanded view should fill the dialog.
    const isTallView = isBrainstormOpen || isTemplateLibraryOpen;

    // On mobile: only Close button should dismiss (ignore backdrop & Esc)
    const handleDialogClose = useCallback(
        (
            _e?: object,
            reason?: "backdropClick" | "escapeKeyDown"
        ) => {
            // While brainstorming, never let a stray backdrop/Esc wipe the chat â€”
            // the user must use the X (which confirms) to leave.
            if (
                isBrainstormOpen &&
                (reason === "backdropClick" || reason === "escapeKeyDown")
            ) {
                return;
            }
            if (
                TextFieldactive &&
                matchMobile &&
                (reason === "backdropClick" || reason === "escapeKeyDown")
            ) {
                setTextFieldactive(false);
                return;
            }
            onClose?.();
        },
        [TextFieldactive, matchMobile, isBrainstormOpen]
    );

    const appColor = darkMode ? "yellow" : "red";

    // --- Template List State (LIFTED to Notepad for Persistence) ---
    const [templateList, setTemplateList] = useState<Template[]>([]);
    const [hasMoreTemplates, setHasMoreTemplates] = useState(true);
    const [isFetchingTemplates, setIsFetchingTemplates] = useState(false);

    const fetchTemplates = useCallback(async (reset = false) => {
        if (isFetchingTemplates) return;
        setIsFetchingTemplates(true);

        const limit = 20;
        const offset = reset ? 0 : templateList.length;

        try {
            const { data } = await axios.get<{ templates: any[] }>(`${CLIK_URL}/get_templates_prompt`, {
                params: { limit, offset },
                withCredentials: true
            });

            if (data && data.templates) {
                const newTemplates = data.templates.map((t: any) => ({
                    id: String(t.id),
                    name: t.title,
                    basePrompt: t.template_prompt,
                    thumbnailUrl: t.template_image || "https://clikbatebucket.s3.us-east-1.amazonaws.com/clik-bg.png",
                    createdAt: new Date(t.time).getTime(),
                    isCustom: true,
                    userId: t.userid,
                    artStyle: t.artstyle || t.artStyle || ""
                }));
                console.log("Mapped Templates (First 1):", newTemplates[0]);

                setTemplateList(prev => reset ? newTemplates : [...prev, ...newTemplates]);
                if (newTemplates.length < limit) setHasMoreTemplates(false);
                else setHasMoreTemplates(true);

            }
        } catch (err) {
            console.error("Failed to fetch templates:", err);
        } finally {
            setIsFetchingTemplates(false);
        }
    }, [templateList.length, isFetchingTemplates]);

    // Initial load if empty when opened
    useEffect(() => {
        if (open && showTemplates && templateList.length === 0) {
            fetchTemplates(true);
        }
    }, [open, showTemplates, templateList.length, fetchTemplates]);

    const handleDeleteTemplate = useCallback(async (template: Template) => {
        if (!loggedUser || template.userId !== loggedUser.id) return;

        try {
            // 1. Delete image from S3 if it's not the default
            if (template.thumbnailUrl && !template.thumbnailUrl.includes("clikbatebucket.s3.us-east-1.amazonaws.com/clik-bg.png")) {
                await axios.post(`${CLIK_URL}/del-image`, { url: template.thumbnailUrl }, { withCredentials: true });
            }

            // 2. Delete from database
            await axios.post(`${CLIK_URL}/delete_template_prompt`, { id: template.id, userid: loggedUser.id }, { withCredentials: true });

            // 3. Update local state
            setTemplateList(prev => prev.filter(t => t.id !== template.id));
        } catch (err) {
            console.error("Failed to delete template:", err);
        }
    }, [loggedUser]);

    const handleTemplateCreated = () => {
        setTemplateList([]); // Wipe - effect will refetch
    };

    const panelNode = panel ? (
        <Box
            onClick={() => {
                setIsNotepadOpen(true);
            }}
            sx={{
                position: "relative",
                flex: matchMobile
                    ? type > 10
                        ? "0 0 19%"
                        : "0 0 20%"
                    : type > 10
                        ? "0 0 6%"
                        : "0 0 8%",
                display: hide ? "none" : "flex",
                alignItems: "stretch",
                borderRadius: "15%",
                left: matchMobile ? "0vw" : "0px",
                alignSelf: "stretch",
                background: darkMode
                    ? "rgba(255,255,255,0.04)"
                    : "rgba(0,0,0,0.03)",
                borderLeft: `1px solid ${darkMode
                    ? "rgba(255,255,255,0.14)"
                    : "rgba(0,0,0,0.14)"
                    }`,
                "&::after": {
                    content: '""',
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    background: !darkMode
                        ? "linear-gradient(120deg, rgba(255,0,122,0.14), rgba(255,154,0,0.09), rgba(255,255,0,0.07), rgba(0,255,0,0.07), rgba(0,180,255,0.09), rgba(132,0,255,0.14))"
                        : "linear-gradient(120deg, rgba(255,0,122,0.10), rgba(255,154,0,0.06), rgba(255,255,0,0.04), rgba(0,255,0,0.04), rgba(0,180,255,0.06), rgba(132,0,255,0.10))",
                    backgroundSize: "300% 300%",
                    animation: "riverFlow 3s linear infinite",
                    mixBlendMode: "normal",
                },
                "@keyframes riverFlow": {
                    "0%": { backgroundPosition: "0% 50%" },
                    "50%": { backgroundPosition: "100% 50%" },
                    "100%": { backgroundPosition: "0% 50%" },
                },
            }}
        >
            <Box
                sx={{
                    boxSizing: "border-box",
                    p: "28%",
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Tooltip title="Open voice workspace">
                    <IconButton
                        onClick={onSpeak}
                        disableRipple
                        disableFocusRipple
                        sx={{
                            m: 0,
                            p: 0,
                            width: "100%",
                            height: "100%",
                            borderRadius: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: darkMode ? "#fff" : "#000",
                            "&:hover": {
                                opacity: 0.95,
                                backgroundColor: "transparent",
                            },
                        }}
                    >
                        <Box
                            sx={{
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            <RecordVoiceOverIcon
                                sx={{
                                    width: "100%",
                                    height: "100%",
                                    maxWidth: "100%",
                                    maxHeight: "100%",
                                }}
                            />
                        </Box>
                    </IconButton>
                </Tooltip>
            </Box>
        </Box>
    ) : null;

    return (
        <>
            {panelNode}

            {/* Centered Notepad dialog for actual editing */}
            <Dialog
                open={open}
                onClose={handleDialogClose}
                maxWidth={false}
                // Keep focus from snapping back to shell TF
                disableRestoreFocus
                // On mobile we also disable Esc entirely (backdrop handled in onClose)
                disableEscapeKeyDown={matchMobile}
                sx={{
                    zIndex: zIndex !== undefined ? zIndex : 1300
                }}
                BackdropProps={{
                    sx: {
                        backgroundColor: isBrainstormOpen ? 'rgba(0, 0, 0, 0.76)' : 'rgba(0, 0, 0, 0.5)'
                    }
                }}
                PaperProps={{
                    sx: {
                        width: matchMobile ? "79vw" : "60vw",
                        maxWidth: matchMobile ? "79vw" : "60vw",
                        margin: matchMobile ? 0 : undefined,
                        marginLeft: matchMobile ? 0 : undefined,
                        marginRight: matchMobile ? "auto" : undefined,
                        marginTop: 0,
                        // Brainstorm and the template list need room â€” fill ~90vh when open.
                        height: isTallView ? "90vh" : "auto",
                        maxHeight: "90vh",
                        minHeight: isTallView ? "90vh" : (matchMobile ? "60vh" : "50vh"),
                        borderRadius: 3,
                        display: hide ? "none" : "flex",
                        flexDirection: "column",
                        bgcolor: matchMobile
                            ? (darkMode ? 'rgba(10, 10, 10, 0.85)' : 'rgba(255, 255, 255, 0.95)')
                            : (darkMode ? 'rgba(30, 30, 30, 0.45)' : 'rgba(255, 255, 255, 0.95)'),
                        color: darkMode ? '#ffffff' : '#000000',
                        backdropFilter: "blur(40px) saturate(120%)",
                        border: darkMode ? "1px solid rgba(255, 255, 255, 0.05)" : "1px solid rgba(255, 255, 255, 0.4)",
                        boxShadow: darkMode ? "0 8px 32px 0 rgba(0, 0, 0, 0.6)" : "0 8px 32px 0 rgba(0, 0, 0, 0.1)",
                        transition: "all 0.3s ease-in-out",

                        // Animate from 10% size to full over 0.5s on each open
                        transformOrigin: "center",
                        transform: open ? "scale(0.1)" : "scale(1)",
                        animation: open
                            ? "popGrow 0.5s ease forwards"
                            : "none",

                        "@keyframes popGrow": {
                            "0%": { transform: "scale(0.1)" },
                            "100%": { transform: "scale(1)" },
                        },
                    },
                }}
            >
                {/* Content */}
                <DialogContent
                    sx={{
                        pt: 0,
                        pb: 0,
                        px: 0,
                        display: "flex",
                        flexDirection: "column",
                        height: "100%",
                        overflow: "hidden"
                    }}
                >
                    {/* NotepadEditor now supports mode 0 / 1 */}
                    <NotepadEditor
                        open={open}
                        Caret={Caret}
                        onclose={() => onClose?.()}
                        handleKeyDownx={handleKeyDown}
                        setTextFieldactive={setTextFieldactive}
                        placeholder={placeholder}
                        GeneratedImage={GeneratedImage}
                        type={type}
                        value={value}
                        onChange={handleChange}
                        darkMode={darkMode}
                        appColor={appColor}
                        mode={mode}
                        showTemplates={showTemplates}
                        onBrainstormOpenChange={setIsBrainstormOpen}
                        onTemplateLibraryOpenChange={setIsTemplateLibraryOpen}
                        cachedImageGen={cachedImageGen}
                        onUpdateCachedImageGen={onUpdateCachedImageGen}
                        // LIFTED TEMPLATE PROPS
                        templateList={templateList}
                        onFetchTemplates={fetchTemplates}
                        hasMoreTemplates={hasMoreTemplates}
                        onTemplateCreated={handleTemplateCreated}
                        onDeleteTemplate={handleDeleteTemplate}
                        referenceImages={referenceImages}
                        detectedCharacters={detectedCharacters}
                        SelectedModel={SelectedModel}
                        ImagesHdCloud={ImagesHdCloud}
                        musicMode={musicMode}
                        musicUrl={musicUrl}
                        musicName={musicName}
                        musicBreakerSec={musicBreakerSec}
                        onMusicBreakerChange={onMusicBreakerChange}
                        onMusicSceneCountChange={onMusicSceneCountChange}
                        onMusicSegmentsChange={onMusicSegmentsChange}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
};

export default Notepad;
