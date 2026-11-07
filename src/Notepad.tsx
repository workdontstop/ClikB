// Notepad.tsx
import React, { FC, useCallback, useState, useEffect, useRef, useId } from "react";
import { flushSync } from "react-dom";
import axios from "axios";
const CLIK_URL = import.meta.env.VITE_CLIK_URL;
const EMPTY_NOTEPAD_ITEMS: any[] = [];
const EMPTY_TEMPLATE_LIST: Template[] = [];
const NOOP_ASYNC = async (): Promise<void> => {};
import {
    Box,
    IconButton,
    Tooltip,
    Dialog,
    DialogContent,
} from "@mui/material";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import { matchMobile } from "./DetectDevice";
import NotepadEditor, { type NotepadGuideContext } from "./NotepadEditor";
import type { ImageGenCache } from "./components/PromptConstructor";
import { PreviewImageRequests } from './previewImageRequests';
import { ShowcaseMode, Template } from "./PromptConstructorMock";

import { useSelector } from "react-redux";
import { RootState } from "./store";

interface NotepadProps {
    /** Align the initial desktop composer dialog with its menu-offset parent. */
    alignWithInitialComposer?: boolean;
    onSpeak?: () => void;
    type: any;
    GeneratedImage: any;

    hide: boolean;
    size?: "small" | "medium";
    /** Right-side fused panel */
    panel?: boolean;
    /**
     * Optional desktop height override for the fused panel (e.g. "6vh").
     * Defaults to the standard 9vh / 68-90px band when omitted, so existing
     * call sites are unaffected. Mobile keeps its "auto" stretch behaviour.
    */
    panelHeight?: string | number;
    /** Optional mobile height override for the fused panel. */
    panelMobileHeight?: string | number;
    /** Optional mobile flex basis for the fused panel. */
    panelMobileBasis?: string;
    /** Optional mobile-only vertical offset for the fused panel trigger. */
    panelMobileOffset?: string;
    /** Controls the dialog */
    open?: boolean;
    /** Prompt value synced with parent */
    value?: string;
    /** Update prompt in parent */
    onChange?: (value: string) => void;
    /** Display the prompt without allowing edits. */
    readOnly?: boolean;
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
    guideContext?: NotepadGuideContext;
    guideSceneNumber?: number;
    showTemplates?: boolean;
    cachedImageGen?: ImageGenCache;
    onUpdateCachedImageGen?: (data: ImageGenCache) => void;
    templateList?: Template[];
    hasMoreTemplates?: boolean;
    ensureTemplateLibraryLoaded?: () => Promise<void>;
    loadMoreTemplates?: () => Promise<void>;
    onTemplateLibraryChanged?: () => Promise<void>;
    onShowcaseTemplatesChanged?: () => Promise<void>;
    referenceImages?: any[];
    detectedCharacters?: any[];
    SelectedModel?: string;
    zIndex?: number;
    ImagesHdCloud?: string[];
    SavedImagesHdCloud?: string[];
    musicMode?: boolean;
    musicUrl?: string;
    musicName?: string;
    musicBreakerSec?: 5 | 10;
    musicDurationSec?: number;
    onMusicBreakerChange?: (seconds: 5 | 10) => void;
    onMusicDurationChange?: (seconds: number) => void;
    onMusicSceneCountChange?: (count: number) => void;
    onMusicSegmentsChange?: (segments: { index: number; start: number; end: number }[]) => void;
}



const Notepad: FC<NotepadProps> = ({
    alignWithInitialComposer = false,
    onSpeak,
    type,
    panel = false,
    panelHeight,
    panelMobileHeight,
    panelMobileBasis,
    panelMobileOffset,
    open = false,
    value = "",
    onChange,
    readOnly = false,
    onClose,
    setIsNotepadOpen,
    hide,
    GeneratedImage,
    placeholder,
    setTextFieldactive,
    handleKeyDown,
    Caret,
    mode,
    guideContext,
    guideSceneNumber,
    showTemplates,
    cachedImageGen,
    onUpdateCachedImageGen,
    templateList = EMPTY_TEMPLATE_LIST,
    hasMoreTemplates = false,
    ensureTemplateLibraryLoaded,
    loadMoreTemplates = NOOP_ASYNC,
    onTemplateLibraryChanged,
    onShowcaseTemplatesChanged,
    referenceImages = EMPTY_NOTEPAD_ITEMS,
    detectedCharacters = EMPTY_NOTEPAD_ITEMS,
    SelectedModel,
    zIndex,
    ImagesHdCloud,
    SavedImagesHdCloud,
    musicMode = false,
    musicUrl = "",
    musicName = "",
    musicBreakerSec = 5,
    musicDurationSec = 0,
    onMusicBreakerChange,
    onMusicDurationChange,
    onMusicSceneCountChange,
    onMusicSegmentsChange,
}) => {
    const previewRequests = useRef(new PreviewImageRequests<{ data: any }>());
    previewRequests.current.setEnabled(Boolean(open));
    // Keep keystrokes local and immediate. Commit to the large host screen only
    // when the editor closes or Enter needs to run the host action.
    const [editorValue, setEditorValue] = useState(value);
    const pendingValueRef = useRef<string | null>(null);
    const editorRenderTimerRef = useRef<ReturnType<typeof setTimeout>>();
    const lastPublishedValueRef = useRef<string | null>(null);
    const entryOwner = useRef<HTMLDivElement>(null);
    const entryOwnerId = useId();
    useCreationControls('notepad_entry', 'Notepad', true, { open: Boolean(open) }, entryOwner);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const handleKeyDownRef = useRef(handleKeyDown);
    handleKeyDownRef.current = handleKeyDown;

    const publishPendingChange = useCallback((synchronous = false) => {
        const pendingValue = pendingValueRef.current;
        if (pendingValue === null) return;

        pendingValueRef.current = null;
        lastPublishedValueRef.current = pendingValue;
        const publish = () => onChangeRef.current?.(pendingValue);
        if (synchronous) {
            flushSync(publish);
        } else {
            publish();
        }
    }, []);

    const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        if (readOnly) return;

        const nextValue = event.target.value;
        pendingValueRef.current = nextValue;
        clearTimeout(editorRenderTimerRef.current);
        // The field paints its own draft. Reconcile scene parsing, reference
        // badges and the rest of the workspace only after a typing pause.
        if ((event as any).notepadTyping) {
            editorRenderTimerRef.current = setTimeout(() => setEditorValue(nextValue), 180);
        } else {
            setEditorValue(nextValue);
        }
    }, [readOnly]);

    // Accept real external changes while the editor has no uncommitted draft.
    // Typing stays local until Close or Enter, so the large host screen never
    // rerenders underneath the active textarea.
    useEffect(() => {
        if (value === lastPublishedValueRef.current) {
            lastPublishedValueRef.current = null;
            return;
        }

        if (pendingValueRef.current !== null) return;

        setEditorValue((current) => current === value ? current : value);
    }, [value]);

    // Route changes/unmounts must never discard the final buffered characters.
    useEffect(() => () => {
        clearTimeout(editorRenderTimerRef.current);
        const pendingValue = pendingValueRef.current;
        pendingValueRef.current = null;
        if (pendingValue !== null) onChangeRef.current?.(pendingValue);
    }, []);

    const darkMode = useSelector((state: RootState) => state.settings.darkMode);
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);

    // The app uses document scrolling on several mobile routes. While this
    // bottom sheet is open, keep that outer document still and leave scrolling
    // to NotepadEditor's own body/text fields.
    useEffect(() => {
        if (!open || !matchMobile) return;

        const root = document.documentElement;
        const body = document.body;
        root.classList.add("mobile-notepad-scroll-lock");
        body.classList.add("mobile-notepad-scroll-lock");

        return () => {
            root.classList.remove("mobile-notepad-scroll-lock");
            body.classList.remove("mobile-notepad-scroll-lock");
        };
    }, [open]);

    // True while the brainstorm chat is open — grows the dialog and guards close.
    // Declared before handleDialogClose because that callback reads it.
    const [isBrainstormOpen, setIsBrainstormOpen] = useState(false);
    // True while the template list is open — grows the dialog (height only).
    const [isTemplateLibraryOpen, setIsTemplateLibraryOpen] = useState(false);
    // Either expanded view should fill the dialog.
    const isTallView = isBrainstormOpen || isTemplateLibraryOpen;

    const closeWithFlush = useCallback(() => {
        clearTimeout(editorRenderTimerRef.current);
        if (pendingValueRef.current !== null) setEditorValue(pendingValueRef.current);
        publishPendingChange(true);
        previewRequests.current.setEnabled(false);
        onClose?.();
    }, [onClose, publishPendingChange]);

    const handleEditorKeyDown = useCallback((event: any) => {
        if (event?.key === "Enter") publishPendingChange(true);
        // flushSync above lets the parent rerender and replace this ref before
        // the action runs, so Enter sees the text that was just committed.
        handleKeyDownRef.current?.(event);
    }, [publishPendingChange]);

    // Brainstorm stays guarded; regular mobile Notepad can close from the exposed backdrop.
    const handleDialogClose = useCallback(
        (
            _e?: object,
            reason?: "backdropClick" | "escapeKeyDown"
        ) => {
            // While templates modal is open, NEVER let a stray backdrop/Esc wipe Notepad or abort template work
            if (isTemplateLibraryOpen) {
                return;
            }

            // While brainstorming, never let a stray backdrop/Esc wipe the chat —
            // the user must use the X (which confirms) to leave.
            if (
                isBrainstormOpen &&
                (reason === "backdropClick" || reason === "escapeKeyDown")
            ) {
                if (typeof window !== "undefined") {
                    window.dispatchEvent(new CustomEvent("clikb-request-brainstorm-leave-confirm"));
                }
                return;
            }

            closeWithFlush();
        },
        [closeWithFlush, isBrainstormOpen, isTemplateLibraryOpen]
    );

    const appColor = darkMode ? "yellow" : "red";

    // The full saved-template library is intentionally lazy. Opening the
    // Notepad alone must not fetch it. App owns the revision-aware cache, so
    // repeated opens call this guard but do not produce another GET.
    useEffect(() => {
        if (open && showTemplates && isTemplateLibraryOpen) {
            void ensureTemplateLibraryLoaded?.();
        }
    }, [open, showTemplates, isTemplateLibraryOpen, ensureTemplateLibraryLoaded]);

    const handleDeleteTemplate = useCallback(async (template: Template) => {
        if (!loggedUser) return;
        const isOwner = Number(loggedUser.id) !== 1 && Number(template.userId) === Number(loggedUser.id);
        if (!import.meta.env.DEV && !isOwner) return;

        try {
            // The server removes the record, Library references and unused cover together.

            // 2. Delete from database
            await axios.post(`${CLIK_URL}/delete_template_prompt`, { id: template.id, userid: loggedUser.id }, { withCredentials: true });

            // 3. Invalidate App's cache and refresh because the library is open.
            await onTemplateLibraryChanged?.();
            await ensureTemplateLibraryLoaded?.();
        } catch (err) {
            console.error("Failed to delete template:", err);
        }
    }, [loggedUser, onTemplateLibraryChanged, ensureTemplateLibraryLoaded]);

    const handleToggleTemplateShowcase = useCallback(async (template: Template, mode: ShowcaseMode) => {
        if (!import.meta.env.DEV) return;

        const useForShowcase = !(Number(template.showcaseOrders?.[mode]) > 0);
        await axios.post(
            `${CLIK_URL}/update_template_showcase`,
            { id: template.id, mode, useforshowcase: useForShowcase },
            { withCredentials: true },
        );

        await onTemplateLibraryChanged?.();
        await Promise.all([
            ensureTemplateLibraryLoaded?.(),
            onShowcaseTemplatesChanged?.(),
        ]);
    }, [ensureTemplateLibraryLoaded, onShowcaseTemplatesChanged, onTemplateLibraryChanged]);

    const handleTemplateCreated = useCallback(() => {
        void onTemplateLibraryChanged?.();
    }, [onTemplateLibraryChanged]);

    const panelNode = panel ? (
        <Box ref={entryOwner} data-creation-owner={entryOwnerId}
            onClick={() => {
                setIsNotepadOpen(true);
            }}
            sx={{
                position: "relative",
                transform: matchMobile && panelMobileOffset
                    ? `translateY(${panelMobileOffset})`
                    : undefined,
                flex: matchMobile
                    ? panelMobileBasis
                        ? `0 0 ${panelMobileBasis}`
                        : type > 10
                            ? "0 0 19%"
                            : "0 0 20%"
                    : type > 10
                        ? "0 0 5%"
                        : "0 0 6%",
                display: hide ? "none" : "flex",
                alignItems: "stretch",
                borderRadius: "15%",
                left: matchMobile ? "0vw" : "0px",
                alignSelf: matchMobile && panelMobileHeight === undefined ? "stretch" : "center",
                height: matchMobile ? (panelMobileHeight ?? "auto") : (panelHeight ?? "9vh"),
                // When a caller supplies panelHeight it owns the sizing outright, so the
                // default 68-90px band is dropped rather than fighting the override.
                minHeight: matchMobile || panelHeight !== undefined ? undefined : 68,
                maxHeight: matchMobile || panelHeight !== undefined ? undefined : 90,
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
                        {...cb('notepad_entry', 'voice', 'Voice/text workspace (user operated)', 'onSpeak', 'click', 'information_only')}
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
                // The global Guide is intentionally usable alongside this modal.
                // Let its textarea retain focus while the Notepad stays open.
                disableEnforceFocus
                // Fade forwards these attributes to the existing dialog
                // container: clicking outside saves/closes normal Notepad.
                // Brainstorm owns its own guarded close while it is open.
                TransitionProps={{
                    appear: true,
                    ...(!isBrainstormOpen ? {
                        ...cb('notepad', 'close', 'Click outside to close Notepad', 'handleDialogClose'),
                        'data-creation-hit-region': 'self',
                    } : {}),
                }}
                // On mobile we also disable Esc entirely (backdrop handled in onClose)
                disableEscapeKeyDown={matchMobile || isBrainstormOpen || isTemplateLibraryOpen}
                sx={{
                    zIndex: zIndex !== undefined ? zIndex : (matchMobile && isTallView ? 2147482995 : 1300),
                    ...(!matchMobile && alignWithInitialComposer ? {
                        '& .MuiDialog-container': {
                            paddingLeft: '20vw',
                            boxSizing: 'border-box',
                        },
                    } : {}),
                }}
                BackdropProps={{
                    sx: {
                        backgroundColor: isBrainstormOpen ? 'rgba(0, 0, 0, 0.76)' : 'rgba(0, 0, 0, 0.5)'
                    }
                }}
                PaperProps={{
                    sx: {
                        width: matchMobile ? "100vw" : "60vw",
                        maxWidth: matchMobile ? "100vw" : "60vw",
                        margin: matchMobile ? 0 : undefined,
                        marginLeft: matchMobile ? 0 : undefined,
                        marginRight: matchMobile ? 0 : undefined,
                        marginTop: matchMobile ? "auto" : 0,
                        marginBottom: matchMobile ? 0 : undefined,
                        position: matchMobile ? "fixed" : undefined,
                        top: matchMobile && isBrainstormOpen ? 0 : undefined,
                        left: matchMobile ? 0 : undefined,
                        right: matchMobile ? 0 : undefined,
                        bottom: matchMobile ? 0 : undefined,
                        // Normal mobile editing gets 5dvh more working room while
                        // preserving a 15dvh backdrop target above the sheet.
                        height: matchMobile
                            ? (isBrainstormOpen ? "100dvh" : "85dvh")
                            : (isTallView ? "90vh" : "auto"),
                        maxHeight: matchMobile
                            ? (isBrainstormOpen ? "100dvh" : "85dvh")
                            : "90vh",
                        minHeight: matchMobile
                            ? (isBrainstormOpen ? "100dvh" : "85dvh")
                            : (isTallView ? "90vh" : "50vh"),
                        borderRadius: matchMobile ? (isBrainstormOpen ? 0 : "18px 18px 0 0") : 3,
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
                        transformOrigin: matchMobile ? "center bottom" : "center",
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
                        onclose={closeWithFlush}
                        handleKeyDownx={handleEditorKeyDown}
                        setTextFieldactive={setTextFieldactive}
                        placeholder={placeholder}
                        GeneratedImage={GeneratedImage}
                        type={type}
                        value={editorValue}
                        onChange={handleChange}
                        disabled={readOnly}
                        darkMode={darkMode}
                        appColor={appColor}
                        mode={mode}
                        guideContext={guideContext}
                        guideSceneNumber={guideSceneNumber}
                        showTemplates={readOnly ? false : showTemplates}
                        onBrainstormOpenChange={setIsBrainstormOpen}
                        onTemplateLibraryOpenChange={setIsTemplateLibraryOpen}
                        cachedImageGen={cachedImageGen}
                        previewRequests={previewRequests.current}
                        onUpdateCachedImageGen={onUpdateCachedImageGen}
                        // LIFTED TEMPLATE PROPS
                        templateList={templateList}
                        onFetchTemplates={loadMoreTemplates}
                        hasMoreTemplates={hasMoreTemplates}
                        onTemplateCreated={handleTemplateCreated}
                        onDeleteTemplate={handleDeleteTemplate}
                        onToggleTemplateShowcase={handleToggleTemplateShowcase}
                        referenceImages={referenceImages}
                        detectedCharacters={detectedCharacters}
                        SelectedModel={SelectedModel}
                        ImagesHdCloud={ImagesHdCloud}
                        SavedImagesHdCloud={SavedImagesHdCloud}
                        musicMode={musicMode}
                        musicUrl={musicUrl}
                        musicName={musicName}
                        musicBreakerSec={musicBreakerSec}
                        musicDurationSec={musicDurationSec}
                        onMusicBreakerChange={onMusicBreakerChange}
                        onMusicDurationChange={onMusicDurationChange}
                        onMusicSceneCountChange={onMusicSceneCountChange}
                        onMusicSegmentsChange={onMusicSegmentsChange}
                    />
                </DialogContent>
            </Dialog>
        </>
    );
};

export default Notepad;
import { creationBinding as cb } from './creationControlSnapshot';
import { useCreationControls } from './useCreationControls';
