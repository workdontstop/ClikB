// NotepadEditor.tsx — Production Grade: Smart Perms + Clean Hardware Release + Smart Scenes + Glass Loader
import React, { FC, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import TextField from "@mui/material/TextField";
import type { TextFieldProps } from "@mui/material/TextField";
import {
    Box,
    Button,
    Typography,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Stack,
    Avatar,
    IconButton,
    Tooltip,
    Portal,
} from "@mui/material";
import { alpha, darken } from "@mui/material/styles";
// Icons
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import EmojiPeopleIcon from "@mui/icons-material/EmojiPeople";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import CloseIcon from "@mui/icons-material/Close";
import AccessibilityIcon from "@mui/icons-material/Accessibility";
import PsychologyIcon from "@mui/icons-material/Psychology";
import ImageIcon from "@mui/icons-material/Image";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import { matchMobile } from "./DetectDevice";
import axios from "axios";

import { useCaretInsert } from "./useCaretInsert";
import PromptConstructor from "./components/PromptConstructor";
import MusicScenePanel, {
    computeMusicSceneCount,
    computeMusicSegments,
} from "./components/MusicScenePanel";
import { GlobalBrainstormGuide } from "./components/GlobalBrainstormGuide";
import { ImagePreview } from "./components/ImagePreview";
import type { ImageGenCache } from "./components/PromptConstructor";
import { ShowcaseMode, Template } from "./PromptConstructorMock";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "./store";
import { setNotepadPreviewActive } from "./settingsSlice";
import type { PreviewImageRequests } from './previewImageRequests';
import { useBrainstormSession } from "./components/BrainstormSessionProvider";
import { hasVideoModelCapability } from "./videoModelCapabilities";

const LOG = "[NotepadEditor]";
const EMPTY_EDITOR_ITEMS: any[] = [];
const MUSIC_PANEL_SX = { mb: 1.5 } as const;
const IMAGE_PREVIEW_GLASS_STYLE = {
    background: "transparent",
    backdropFilter: "none",
    border: "none",
    borderRadius: "0px",
    boxShadow: "none",
} as const;
const warn = (...a: any[]) => console.warn(LOG, ...a);
const err = (...a: any[]) => console.error(LOG, ...a);

const CLIK_URL = import.meta.env.VITE_CLIK_URL;

const DETECT = {
    START_DELAY_MS: 0,
    SILENCE_HOLD_MS: 5000,
    THRESHOLD_LEVEL: 0.2,
};

const MAX_LOGICAL_SCENES = 9;
const STAGE_SLOTS_PER_SCENE = 2;
const MAX_STORY_STAGE_SLOTS = MAX_LOGICAL_SCENES * STAGE_SLOTS_PER_SCENE;

export type NotepadGuideContext =
    | "original-prompt"
    | "editstory-image-prompt"
    | "editstory-video-prompt"
    | "editstory-motion-prompt"
    | "character-image-prompt"
    | "editstory-image-update-instruction"
    | "editstory-video-update-instruction"
    | "character-update-instruction"
    | "editstory-narration"
    | "editstory-narration-update-instruction";

const NOTEPAD_GUIDE_CONTEXT_LABELS: Record<NotepadGuideContext, string> = {
    "original-prompt": "Original Prompt",
    "editstory-image-prompt": "EditStory image prompt",
    "editstory-video-prompt": "EditStory video prompt",
    "editstory-motion-prompt": "Motion Guide prompt draft",
    "character-image-prompt": "character image prompt",
    "editstory-image-update-instruction": "EditStory image Update-with-AI instruction",
    "editstory-video-update-instruction": "EditStory video Update-with-AI instruction",
    "character-update-instruction": "character Update-with-AI instruction",
    "editstory-narration": "EditStory narration",
    "editstory-narration-update-instruction": "EditStory narration Update-with-AI instruction",
};

// Every supported host must declare its own field identity. Adding a host to
// the context union cannot silently fall through to the main creation prompt.
const NOTEPAD_CONTROL_FIELDS: Record<NotepadGuideContext, { key: string; label: string }> = {
    'original-prompt': { key: 'prompt', label: 'Main creation prompt' },
    'character-update-instruction': { key: 'character_update_instruction', label: 'Character Update with AI instruction' },
    'character-image-prompt': { key: 'character_image_prompt', label: 'Character reference image prompt' },
    'editstory-image-update-instruction': { key: 'workstation_image_update_instruction', label: 'Workstation image Update with AI instruction' },
    'editstory-image-prompt': { key: 'workstation_image_prompt', label: 'Workstation scene image prompt' },
    'editstory-video-update-instruction': { key: 'workstation_video_update_instruction', label: 'Workstation video Update with AI instruction' },
    'editstory-video-prompt': { key: 'workstation_video_prompt', label: 'Workstation scene video prompt' },
    'editstory-motion-prompt': { key: 'workstation_motion_prompt', label: 'Motion Guide prompt draft; saving does not rebuild' },
    'editstory-narration': { key: 'workstation_narration', label: 'Workstation scene narration' },
    'editstory-narration-update-instruction': { key: 'workstation_narration_update_instruction', label: 'Workstation narration Update with AI instruction' },
};

function getSceneSlotLabel(slotIndex: number, usesStageSlots: boolean): string {
    if (!usesStageSlots) return `Scene ${slotIndex + 1}`;
    const logicalScene = Math.floor(slotIndex / STAGE_SLOTS_PER_SCENE) + 1;
    return slotIndex % STAGE_SLOTS_PER_SCENE === 0
        ? `Scene ${logicalScene}`
        : `Scene ${logicalScene}B`;
}

function getSceneSlotDisplayLabel(slotIndex: number, usesStageSlots: boolean): string {
    if (!usesStageSlots) return getSceneSlotLabel(slotIndex, false);
    return `Scene ${slotIndex + 1} · A-roll · Stage ${slotIndex % STAGE_SLOTS_PER_SCENE === 0 ? 'A' : 'B'}`;
}


// Helpers
function getSceneSlotIndex(sceneNumber: number, stageLetter: string, usesStageSlots: boolean): number {
    if (!usesStageSlots) return sceneNumber - 1;
    return (sceneNumber - 1) * STAGE_SLOTS_PER_SCENE + (stageLetter === "B" ? 1 : 0);
}

function splitCombinedPrompt(value: string, usesStageSlots = false): { base: string; scenes: string[] } {
    const scenes = Array(usesStageSlots ? MAX_STORY_STAGE_SLOTS : MAX_LOGICAL_SCENES).fill("");
    if (!value) return { base: "", scenes };

    // Once a prompt has been split, makeCombinedPrompt emits canonical
    // line-start labels such as `Scene 1:`. Parse only those labels during
    // normal editing so scene-like words inside a field cannot repartition the
    // controlled editor and move its caret. Loose matching remains available
    // for importing an unsplit pasted document.
    const usesCanonicalMarkers = /^[\t ]*scene[\t ]*\d+(?:[ab])?[\t ]*:/im.test(value);
    const markerRegex = usesCanonicalMarkers
        ? /^[\t ]*scene[\t ]*(\d+)(?:([ab])\b|(?:[\t ]*[-_][\t ]*([ab])\b)|(?:[\t ]+stage[\t ]*([ab])\b))?[\t ]*:[\t ]*/gim
        : /\bscene\s*(\d+)(?:([a-z])\b|(?:\s*[-_]\s*([a-z])\b)|(?:\s+stage\s*([a-z])\b))?/gi;
    const markers: Array<{ sceneNumber: number; stageLetter: string; labelStart: number; contentStart: number }> = [];
    let match: RegExpExecArray | null;

    while ((match = markerRegex.exec(value)) !== null) {
        const sceneNumber = parseInt(match[1], 10);
        const stageLetter = String(match[2] || match[3] || match[4] || "A").toUpperCase();

        // If a marker is the only meaningful thing before `scene` on its line
        // (Markdown heading, bullet, quote, etc.), remove that decoration with
        // the marker instead of leaving a dangling `#` in the base prompt.
        const lineStart = value.lastIndexOf("\n", match.index - 1) + 1;
        const beforeMarkerOnLine = value.slice(lineStart, match.index);
        const labelStart = /^[\t #>*+\-]*$/.test(beforeMarkerOnLine) ? lineStart : match.index;

        // Consume common separators after the label while keeping all actual
        // scene prose verbatim.
        const markerSuffix = value.slice(markerRegex.lastIndex);
        const separatorLength = markerSuffix.match(/^[\t ]*(?:(?::|[-–—])[\t ]*)?(?:\r?\n)?/)?.[0].length || 0;
        markers.push({
            sceneNumber,
            stageLetter,
            labelStart,
            contentStart: markerRegex.lastIndex + separatorLength,
        });
    }

    if (markers.length === 0) return { base: value, scenes };

    // A single loose mention of "scene 1" is ordinary prose, not enough
    // evidence to restructure the user's prompt. A single exact stored label
    // is safe because makeCombinedPrompt emits that format itself.
    if (markers.length === 1 && !usesCanonicalMarkers) {
        return { base: value, scenes };
    }

    // Flexible imports must begin at Scene 1. Exact stored labels may begin at
    // a later slot when the user intentionally filled only that scene field.
    if (markers.length > 1 && markers[0].sceneNumber !== 1 && !usesCanonicalMarkers) {
        return { base: value, scenes };
    }

    const removeBoundaryNewlines = (text: string) => text.replace(/[\r\n]+$/, "");
    let previousSlotIndex = -1;

    for (let index = 0; index < markers.length; index += 1) {
        const marker = markers[index];
        const nextMarker = markers[index + 1];
        const contentEnd = nextMarker ? nextMarker.labelStart : value.length;
        const sceneText = removeBoundaryNewlines(value.slice(marker.contentStart, contentEnd));
        const sceneSlotIndex = getSceneSlotIndex(marker.sceneNumber, marker.stageLetter, usesStageSlots);

        const invalidMarker =
            marker.sceneNumber < 1 ||
            marker.sceneNumber > MAX_LOGICAL_SCENES ||
            (usesStageSlots ? !["A", "B"].includes(marker.stageLetter) : marker.stageLetter !== "A") ||
            sceneSlotIndex < 0 ||
            sceneSlotIndex >= scenes.length ||
            sceneSlotIndex <= previousSlotIndex ||
            !sceneText.trim();

        if (invalidMarker) {
            return { base: value, scenes: Array(scenes.length).fill("") };
        }

        scenes[sceneSlotIndex] = sceneText;
        previousSlotIndex = sceneSlotIndex;
    }

    return {
        base: removeBoundaryNewlines(value.slice(0, markers[0].labelStart)),
        scenes,
    };
}
function makeCombinedPrompt(base: string, scenes: string[], usesStageSlots = false): string {
    const parts: string[] = [];
    if (base && base.trim()) parts.push(base);
    scenes.forEach((s, i) => {
        if (s && s.trim()) {
            parts.push(`${getSceneSlotLabel(i, usesStageSlots)}: ${s}`);
        }
    });
    return parts.join("\n");
}

function normalizeScenesForVisibleSlots(scenes: string[], isMusicPromptMode: boolean, musicDurationSec: number, visibleSceneSlotCount: number): string[] {
    if (!isMusicPromptMode || musicDurationSec <= 0) return scenes;
    return scenes.map((scene, index) => index < visibleSceneSlotCount ? scene : "");
}

export interface NotepadEditorProps
    extends Omit<
        TextFieldProps,
        "value" | "onChange" | "variant" | "multiline" | "fullWidth"
    > {
    value: string;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    darkMode?: boolean;
    appColor: string;
    placeholder?: string;
    type: any;
    GeneratedImage: any;
    setTextFieldactive: any;
    handleKeyDownx: any;
    onclose: any;
    Caret: any;
    open: any;
    mode?: any;
    guideContext?: NotepadGuideContext;
    guideSceneNumber?: number;
    showTemplates?: boolean;
    onBrainstormOpenChange?: (open: boolean) => void;
    onTemplateLibraryOpenChange?: (open: boolean) => void;
    cachedImageGen?: ImageGenCache;
    previewRequests?: PreviewImageRequests<{ data: any }>;
    onUpdateCachedImageGen?: (data: ImageGenCache) => void;
    // LIFTED TEMPLATE PROPS
    templateList: Template[];
    onFetchTemplates: (reset?: boolean) => void;
    hasMoreTemplates: boolean;
    onTemplateCreated: () => void;
    onDeleteTemplate: (template: Template) => void;
    onToggleTemplateShowcase: (template: Template, mode: ShowcaseMode) => Promise<void>;
    referenceImages?: any[];
    detectedCharacters?: any[];
    SelectedModel?: string;
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

function pickBestMime(): { mime: string; ext: string } {
    const MR: any = (window as any).MediaRecorder;
    const candidates = [
        { mime: "audio/webm;codecs=opus", ext: "webm" },
        { mime: "audio/webm", ext: "webm" },
        { mime: "audio/ogg;codecs=opus", ext: "ogg" },
        { mime: "audio/ogg", ext: "ogg" },
        { mime: "audio/mp4;codecs=mp4a.40.2", ext: "m4a" },
        { mime: "audio/mp4", ext: "m4a" },
    ];
    if (!MR || typeof MR.isTypeSupported !== "function") {
        return { mime: "audio/webm;codecs=opus", ext: "webm" };
    }
    for (const c of candidates) {
        if (MR.isTypeSupported(c.mime)) return c;
    }
    return { mime: "audio/webm", ext: "webm" };
}

type ResponsiveTextFieldProps = Omit<TextFieldProps, "value" | "onChange"> & {
    value: string;
    onValueChange: (value: string, typing?: boolean) => void;
};

/**
 * Only the active field renders per keystroke. Live callbacks update the draft
 * synchronously; Notepad delays the surrounding UI, never the text or saving.
 */
const ResponsiveTextField = React.memo(function ResponsiveTextField({
    value,
    onValueChange,
    ...props
}: ResponsiveTextFieldProps) {
    const [draft, setDraft] = useState(value);
    useLayoutEffect(() => { setDraft(value); }, [value]);
    const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setDraft(event.target.value);
        onValueChange(event.target.value, true);
    }, [onValueChange]);

    return <TextField {...props} value={draft} onChange={handleChange} />;
});

type OpeningCaretScrollTarget = {
    position: number;
    value: string;
};

const CARET_MIRROR_STYLE_PROPERTIES = [
    "boxSizing",
    "width",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontStyle",
    "fontVariant",
    "fontWeight",
    "fontStretch",
    "fontSize",
    "fontSizeAdjust",
    "lineHeight",
    "fontFamily",
    "fontKerning",
    "fontFeatureSettings",
    "fontVariationSettings",
    "direction",
    "textAlign",
    "textTransform",
    "textIndent",
    "textDecoration",
    "letterSpacing",
    "wordSpacing",
    "tabSize",
] as const;

/**
 * Scroll an already-positioned textarea caret into view without touching
 * focus or selection. A textarea cannot expose a DOM Range for its text, so a
 * temporary mirror is used only to measure the caret's wrapped line.
 */
function scrollTextareaToExistingCaret(
    textarea: HTMLTextAreaElement,
    position: number,
): boolean {
    let mirror: HTMLDivElement | null = null;

    try {
        if (textarea.clientHeight <= 0 || textarea.clientWidth <= 0) return false;
        if (textarea.scrollHeight <= textarea.clientHeight) return true;

        const styles = window.getComputedStyle(textarea);
        mirror = document.createElement("div");

        CARET_MIRROR_STYLE_PROPERTIES.forEach((property) => {
            mirror!.style[property] = styles[property];
        });

        Object.assign(mirror.style, {
            position: "absolute",
            top: "0",
            left: "-100000px",
            height: "auto",
            minHeight: "0",
            maxHeight: "none",
            // The live textarea has a vertical scrollbar once maxRows is
            // reached. Reserve the same gutter so wrapped lines match.
            overflowX: "hidden",
            overflowY: "scroll",
            visibility: "hidden",
            pointerEvents: "none",
            whiteSpace: "pre-wrap",
            overflowWrap: "break-word",
            wordBreak: styles.wordBreak,
        });

        const beforeCaret = textarea.value.slice(0, position);
        // Preserve a caret immediately after a newline as a measurable line.
        mirror.textContent = beforeCaret.replace(/\n$/g, "\n\u200b");

        const marker = document.createElement("span");
        marker.textContent = textarea.value.slice(position) || ".";
        mirror.appendChild(marker);
        document.body.appendChild(mirror);

        const lineHeight = Number.parseFloat(styles.lineHeight)
            || Number.parseFloat(styles.fontSize)
            || 16;
        const maxScrollTop = Math.max(0, textarea.scrollHeight - textarea.clientHeight);
        const centeredScrollTop = marker.offsetTop - ((textarea.clientHeight - lineHeight) / 2);

        textarea.scrollTop = Math.max(0, Math.min(centeredScrollTop, maxScrollTop));
        return true;
    } catch (error) {
        console.warn(LOG, "opening caret scroll failed", error);
        return false;
    } finally {
        mirror?.remove();
    }
}

const MemoSceneField = React.memo(({
    idx, sceneText, isThisSceneBusy, handleSceneChange, onclose, handleKeyDownx,
    setTextFieldactive, setActiveField, isActive, bindRef, bindOnSelect, bindOnKeyUp, bindOnClick,
    darkMode, glassOverlaySx, placeholderLabel, controlLabel, controlBlocked
}: any) => {
    const fieldLabel = placeholderLabel || `Scene ${idx + 1}`;
    const hasSceneText = String(sceneText || "").trim().length > 0;
    const isBShotSlot = fieldLabel.endsWith('Stage B');
    const askAiFieldBackground = darkMode ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.14)";
    const bShotFieldBackground = darkMode ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.32)";
    const sceneFieldBackground = isBShotSlot ? bShotFieldBackground : askAiFieldBackground;

    return (
        <ResponsiveTextField
            key={idx}
            multiline fullWidth minRows={1} maxRows={matchMobile ? 6 : 5} variant="outlined"
            value={sceneText}
            label={hasSceneText ? fieldLabel : undefined}
            placeholder={hasSceneText || isBShotSlot ? "" : fieldLabel}
            InputLabelProps={hasSceneText ? {
                shrink: true,
                sx: { fontSize: "0.9rem", fontWeight: 400 },
            } : undefined}
            onValueChange={(nextValue, typing) => handleSceneChange(idx, nextValue, typing)}
            onKeyDown={(e: any) => { if (e.key === "Enter") onclose(); handleKeyDownx(e); }}
            onFocus={() => { setTextFieldactive(true); setActiveField(idx + 1); }}
            inputRef={isActive ? bindRef : undefined}
            inputProps={{
                ...cb('notepad', `scene_${idx + 1}`, controlLabel || fieldLabel, 'handleSceneChange', 'text'),
                'data-creation-blocked': controlBlocked ? 'true' : undefined,
                style: {
                    color: darkMode ? "#fff" : "#000",
                    WebkitOverflowScrolling: "touch",
                    fontSize: "1rem",
                    fontWeight: 400,
                },
                autoCorrect: "on", spellCheck: true, autoCapitalize: "sentences", autoComplete: "on",
                onSelect: isActive ? bindOnSelect : undefined,
                onKeyUp: isActive ? bindOnKeyUp : undefined,
                onClick: isActive ? bindOnClick : undefined,
            }}
            InputProps={{
                sx: {
                    mb: 0.5,
                    "& .MuiInputBase-input": {
                        caretColor: "auto !important",
                    },
                    "& .MuiInputBase-input::placeholder": {
                        fontSize: "inherit",
                        opacity: 1,
                    },
                    backgroundColor: sceneFieldBackground,
                    alignItems: "flex-start",
                    "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: darkMode ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.4)",
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.6)",
                    },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: darkMode ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.8)",
                    },
                    position: "relative",
                    ...(isThisSceneBusy ? glassOverlaySx : {}),
                }
            }}
            sx={{
                mb: 0.5,
                scrollMarginBottom: "190px",
            }}
        />
    );
}, (prev: any, next: any) => {
    return prev.sceneText === next.sceneText &&
           prev.isActive === next.isActive &&
           prev.isThisSceneBusy === next.isThisSceneBusy &&
           prev.darkMode === next.darkMode &&
           prev.placeholderLabel === next.placeholderLabel &&
           prev.controlLabel === next.controlLabel && prev.controlBlocked === next.controlBlocked;
});

const MemoGlobalBrainstormGuide = React.memo(GlobalBrainstormGuide);
const MemoMusicScenePanel = React.memo(MusicScenePanel);
const MemoImagePreview = React.memo(ImagePreview);
type GuideUseTargetRegistrarProps = {
    open: boolean;
    disabled: boolean;
    targetId: string;
    label: string;
    append: (text: string) => void;
    contextLabel: string;
    getContextText: () => string;
};

const GuideUseTargetRegistrar = React.memo(function GuideUseTargetRegistrar({
    open,
    disabled,
    targetId,
    label,
    append,
    contextLabel,
    getContextText,
}: GuideUseTargetRegistrarProps) {
    const { registerGuideUseTarget } = useBrainstormSession();

    useEffect(() => {
        if (!open || disabled) return;
        return registerGuideUseTarget({ id: targetId, label, append, contextLabel, getContextText });
    }, [append, contextLabel, disabled, getContextText, label, open, registerGuideUseTarget, targetId]);

    return null;
});

const NotepadEditor: FC<NotepadEditorProps> = ({
    value,
    onChange,
    darkMode,
    appColor,
    type,
    GeneratedImage,
    placeholder,
    setTextFieldactive,
    handleKeyDownx,
    onclose,
    Caret,
    open,
    mode,
    guideContext,
    guideSceneNumber,
    showTemplates,
    onBrainstormOpenChange,
    onTemplateLibraryOpenChange,
    cachedImageGen,
    previewRequests,
    onUpdateCachedImageGen,
    templateList,
    onFetchTemplates,
    hasMoreTemplates,
    onTemplateCreated,
    onDeleteTemplate,
    onToggleTemplateShowcase,
    referenceImages = EMPTY_EDITOR_ITEMS,
    detectedCharacters = EMPTY_EDITOR_ITEMS,
    SelectedModel,
    ImagesHdCloud,
    SavedImagesHdCloud = EMPTY_EDITOR_ITEMS,
    musicMode = false,
    musicUrl = "",
    musicName = "",
    musicBreakerSec = 5,
    musicDurationSec = 0,
    onMusicBreakerChange,
    onMusicDurationChange,
    onMusicSceneCountChange,
    onMusicSegmentsChange,
    ...rest
}) => {
    const dispatch = useDispatch<AppDispatch>();
    const controlOwnerId = useId();
    const ratioKey = useSelector((state: RootState) => state.settings.aspectRatio);
    const notepadPreviewActive = useSelector((state: RootState) => state.settings.notepadPreviewActive);
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const reduxAppColor = (darkMode ? appColorDark : appColorLight)
        || (darkMode ? "#E8BAFA" : "#0099cc");
    const reduxAppColorHover = darken(reduxAppColor, 0.08);
    const {
        textAsk,
        setGuideEnabled,
        setGuidePanelState,
    } = useBrainstormSession();

    const usesStageSlots = mode === 1 && Number(type) === 1;
    // Mode 1 Split
    const { base: basePrompt, scenes: sceneValues } = useMemo(
        () => mode === 1
            ? splitCombinedPrompt(value || "", usesStageSlots)
            : { base: value || "", scenes: Array(MAX_LOGICAL_SCENES).fill("") },
        [mode, usesStageSlots, value]
    );
    const isMusicPromptMode = Boolean(musicMode && musicUrl && mode === 1);
    const [localMusicBreakerSec, setLocalMusicBreakerSec] = useState<5 | 10>(musicBreakerSec);

    const activeMusicBreakerSec = onMusicBreakerChange ? musicBreakerSec : localMusicBreakerSec;
    const musicSceneCount = isMusicPromptMode
        ? computeMusicSceneCount(musicDurationSec, activeMusicBreakerSec)
        : 9;
    const musicSegments = useMemo(
        () => computeMusicSegments(musicDurationSec, activeMusicBreakerSec),
        [musicDurationSec, activeMusicBreakerSec],
    );
    // Breaker changes are shared by every host of MusicScenePanel (the notepad
    // panel and the brainstorm one), so they all flow through this handler.
    const handleMusicBreakerChange = useCallback((nextBreaker: 5 | 10) => {
        setLocalMusicBreakerSec(nextBreaker);
        onMusicBreakerChange?.(nextBreaker);
    }, [onMusicBreakerChange]);
    const visibleSceneSlotCount = mode === 1
        ? usesStageSlots
            ? (isMusicPromptMode ? musicSceneCount * STAGE_SLOTS_PER_SCENE : MAX_STORY_STAGE_SLOTS)
            : (isMusicPromptMode ? musicSceneCount : MAX_LOGICAL_SCENES)
        : MAX_LOGICAL_SCENES;

    // 🔹 FIX B: Scenes Auto-Open Logic
    const [showScenes, setShowScenes] = useState(false);
    const userToggledScenesRef = useRef(false);
    const scenesSectionRef = useRef<HTMLDivElement>(null);
    const scrollToFirstSceneOnMobile = useCallback(() => {
        if (!matchMobile) return;

        // Wait until the revealed list is laid out, then scroll the Notepad's
        // internal body to Scene 1 without moving the locked app document.
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                scenesSectionRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                    inline: "nearest",
                });
            });
        });
    }, []);
    const [showSceneAvatarsOnly, setShowSceneAvatarsOnly] = useState(false);
    const [showSavedAvatarsOnly, setShowSavedAvatarsOnly] = useState(false);
    const [zoomImage, setZoomImage] = useState<{ name: string; imageUrl: string } | null>(null);

    // Outside-click collapse logic for Notepad Scenes Mode
    useEffect(() => {
        if (!showSceneAvatarsOnly && !showSavedAvatarsOnly) return;
        const handleOutsideClick = () => {
            setShowSceneAvatarsOnly(false);
            setShowSavedAvatarsOnly(false);
        };
        const timer = setTimeout(() => {
            document.addEventListener("click", handleOutsideClick);
        }, 0);
        return () => {
            clearTimeout(timer);
            document.removeEventListener("click", handleOutsideClick);
        };
    }, [showSceneAvatarsOnly, showSavedAvatarsOnly]);

    // Reset Scenes Mode when the editor is closed
    useEffect(() => {
        if (!open) {
            setShowSceneAvatarsOnly(false);
            setShowSavedAvatarsOnly(false);
        }
    }, [open]);

    useEffect(() => {
        if (!isMusicPromptMode) return;

        setShowScenes(true);
        userToggledScenesRef.current = false;
    }, [isMusicPromptMode, musicUrl]);

    useEffect(() => {
        setLocalMusicBreakerSec(musicBreakerSec);
    }, [musicBreakerSec]);

    useEffect(() => {
        if (!isMusicPromptMode || musicDurationSec <= 0 || visibleSceneSlotCount >= sceneValues.length) return;

        const trimmedScenes = [...sceneValues];
        let changed = false;
        for (let i = visibleSceneSlotCount; i < trimmedScenes.length; i++) {
            if (trimmedScenes[i]) {
                trimmedScenes[i] = "";
                changed = true;
            }
        }

        if (changed) {
            onChange({ target: { value: makeCombinedPrompt(basePrompt, trimmedScenes, usesStageSlots) } } as any);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMusicPromptMode, musicDurationSec, visibleSceneSlotCount, usesStageSlots]);

    useEffect(() => {
        if (!isMusicPromptMode) return;
        onMusicSceneCountChange?.(musicSceneCount);
    }, [isMusicPromptMode, musicSceneCount, onMusicSceneCountChange]);

    useEffect(() => {
        if (!isMusicPromptMode) {
            onMusicSegmentsChange?.([]);
            return;
        }
        onMusicSegmentsChange?.(musicSegments);
    }, [isMusicPromptMode, musicSegments, onMusicSegmentsChange]);

    // Effect 1: On open/mode change, check if we should show scenes immediately
    useEffect(() => {
        if (!open) return;
        // Reset toggle memory on fresh open
        userToggledScenesRef.current = false;

        if (mode !== 1) {
            setShowScenes(false);
            return;
        }

        if (isMusicPromptMode) {
            setShowScenes(true);
            return;
        }

        const hasScenes = sceneValues.some((s) => (s ?? "").trim().length > 0);
        setShowScenes(hasScenes);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, mode, isMusicPromptMode]);

    // Effect 2: If data hydrates later, auto-open unless user explicitly closed it
    useEffect(() => {
        if (!open) return;
        if (mode !== 1) return;
        if (isMusicPromptMode) {
            setShowScenes(true);
            return;
        }
        if (userToggledScenesRef.current) return; // Respect user choice

        const hasScenes = sceneValues.some((s) => (s ?? "").trim().length > 0);
        if (hasScenes) setShowScenes(true);
    }, [sceneValues, open, mode, isMusicPromptMode]);

    const [isCarouselExpanded, setIsCarouselExpanded] = useState(false);
    const hasNotepadCharacterReferences = (referenceImages?.length || 0) > 0;
    const hasNotepadSceneImages = Boolean(ImagesHdCloud?.some((url: string) => !!url));
    const hasNotepadSavedImages = Boolean(SavedImagesHdCloud?.some((url: string) => !!url));
    const supportsNotepadCharacterControls =
        placeholder === "Enter a Prompt To Recreate The Image"
        || placeholder === "Enter Video Prompt"
        || placeholder === "Use Auto Prompt / Enter Video Prompt"
        || guideContext === "editstory-image-update-instruction"
        || guideContext === "editstory-video-update-instruction";
    const useExpandedNotepadCharacterControls = hasNotepadCharacterReferences && isCarouselExpanded;
    const carouselTimerRef = useRef<number | null>(null);
    const ignoreBlurRef = useRef<boolean>(false);

    const kickCarouselTimer = () => {
        if (carouselTimerRef.current) window.clearTimeout(carouselTimerRef.current);
        carouselTimerRef.current = window.setTimeout(() => {
            setIsCarouselExpanded(false);
        }, 20000);
    };

    useEffect(() => {
        if (isCarouselExpanded) {
            kickCarouselTimer();
        } else {
            if (carouselTimerRef.current) window.clearTimeout(carouselTimerRef.current);
        }
        return () => {
            if (carouselTimerRef.current) window.clearTimeout(carouselTimerRef.current);
        };
    }, [isCarouselExpanded]);

    // Compile reference matchers only when the references change. Typing then
    // performs cheap regex tests without rebuilding every expression or causing
    // a follow-up state render.
    const activeCharacterMatchers = useMemo<Array<{ name: string; regex: RegExp }>>(() => {
        const allChars = [...(referenceImages || [])];
        if (ImagesHdCloud) {
            ImagesHdCloud.forEach((url, index) => {
                if (url) allChars.push({ name: `Scene ${index + 1}`, imageUrl: url });
            });
        }
        SavedImagesHdCloud.forEach((url, index) => {
            if (url) {
                allChars.push({ name: "Saved " + (index + 1), imageUrl: url });
            }
        });

        const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return allChars.flatMap((ref: any) => {
            if (!ref.name) return [];
            const name = String(ref.name);
            const rawName = name.trim();
            const handle = "@" + rawName.replace(/[^A-Za-z0-9_]/g, "");
            const words = rawName.split(/[\s\-]+/);
            const flexibleNamePattern = words.map((word) => escapeRegExp(word)).join('[\\s\\-]*');
            const compactHandlePattern = `${escapeRegExp(handle)}(?![A-Za-z0-9_])`;
            const flexibleHandlePattern = `@\\b${flexibleNamePattern}\\b`;
            return [{
                name,
                regex: new RegExp(`(${compactHandlePattern}|${flexibleHandlePattern})`, "i"),
            }];
        });
    }, [ImagesHdCloud, SavedImagesHdCloud, referenceImages]);

    const activeCharTags = useMemo(() => {
        const currentValue = value || "";
        // Every supported character matcher begins with @, so ordinary prompt
        // typing can skip all reference regex work without changing matches.
        if (!currentValue.includes("@")) return [];
        return activeCharacterMatchers
            .filter(({ regex }) => regex.test(currentValue))
            .map(({ name }) => name);
    }, [activeCharacterMatchers, value]);
    const [isRecording, setIsRecording] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [recordMs, setRecordMs] = useState(0);

    const [audioUrl, setAudioUrl] = useState<string | null>(null);

    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

    const [level, setLevel] = useState(0);

    const [noInputWarning, setNoInputWarning] = useState(false);
    const [showDetectionBanner, setShowDetectionBanner] = useState<boolean>(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const streamRef = useRef<MediaStream | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const meterRAF = useRef<number | null>(null);

    const [isUploading, setIsUploading] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isClearConfirming, setIsClearConfirming] = useState(false);
    const clearConfirmTimerRef = useRef<number | null>(null);

    const isBusy = isUploading || isTranscribing;

    const { bind, insertAtCaret, setCaretPosition, focusInput } = useCaretInsert();
    const primaryEditorTextareaRef = useRef<HTMLTextAreaElement | null>(null);
    const openingCaretScrollTargetRef = useRef<OpeningCaretScrollTarget | null>(null);
    const setPrimaryEditorInputRef = useCallback((
        element: HTMLTextAreaElement | HTMLInputElement | null,
    ) => {
        primaryEditorTextareaRef.current = element?.tagName === "TEXTAREA"
            ? element as HTMLTextAreaElement
            : null;
        bind.inputRef(element);
    }, [bind.inputRef]);
    const timerRef = useRef<number | null>(null);
    const detectionTimerRef = useRef<number | null>(null);
    const isRecordingRef = useRef(false);

    // 0 = base, 1..9 = Scene index
    const [activeField, setActiveField] = useState<number>(0);
    const [isGuideAskMode, setIsGuideAskMode] = useState(false);
    const [guideAskDraft, setGuideAskDraft] = useState("");
    const [guideAskBusy, setGuideAskBusy] = useState(false);
    const [guideAskError, setGuideAskError] = useState<string | null>(null);

    const guideTargetIdRef = useRef(`notepad-editor-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const guideAppendContextRef = useRef({
        value,
        basePrompt,
        sceneValues,
        activeField,
        mode,
        usesStageSlots,
        isMusicPromptMode,
        musicDurationSec,
        visibleSceneSlotCount,
        onChange,
    });

    const lastRenderedDraftRef = useRef(value);
    const renderedDraftChanged = lastRenderedDraftRef.current !== value;
    lastRenderedDraftRef.current = value;
    guideAppendContextRef.current = {
        value,
        basePrompt,
        sceneValues,
        activeField,
        mode,
        usesStageSlots,
        isMusicPromptMode,
        musicDurationSec,
        visibleSceneSlotCount,
        onChange,
        // Focus, meters and host updates can render before the delayed draft
        // arrives. They must not replace the live text with the old props.
        ...(!renderedDraftChanged ? {
            value: guideAppendContextRef.current.value,
            basePrompt: guideAppendContextRef.current.basePrompt,
            sceneValues: guideAppendContextRef.current.sceneValues,
        } : {}),
    };

    const appendGuideText = useCallback((guideText: string) => {
        const context = guideAppendContextRef.current;
        const appendTo = (existing: string) => {
            const current = String(existing || '').trimEnd();
            return current ? `${current}\n\n${guideText}` : guideText;
        };

        if (context.mode !== 1) {
            context.onChange({ target: { value: appendTo(context.value) } } as any);
            return;
        }

        let nextBase = context.basePrompt;
        const nextScenes = [...context.sceneValues];
        if (context.activeField === 0) {
            nextBase = appendTo(nextBase);
        } else if (context.activeField >= 1 && context.activeField <= context.visibleSceneSlotCount) {
            const sceneIndex = context.activeField - 1;
            nextScenes[sceneIndex] = appendTo(nextScenes[sceneIndex] || '');
        } else {
            return;
        }

        if (context.isMusicPromptMode && context.musicDurationSec > 0) {
            for (let index = context.visibleSceneSlotCount; index < nextScenes.length; index += 1) {
                nextScenes[index] = '';
            }
        }

        const combined = makeCombinedPrompt(nextBase, nextScenes, context.usesStageSlots);
        context.onChange({ target: { value: combined } } as any);
    }, []);

    const getGuideContextText = useCallback(() => {
        const context = guideAppendContextRef.current;
        if (context.mode !== 1) return String(context.value || "").trim();
        if (context.activeField === 0) return String(context.basePrompt || "").trim();
        if (context.activeField >= 1 && context.activeField <= context.visibleSceneSlotCount) {
            return String(context.sceneValues[context.activeField - 1] || "").trim();
        }
        return "";
    }, []);

    const guideTargetLabel = mode === 1
        ? activeField === 0
            ? 'base prompt'
            : getSceneSlotLabel(activeField - 1, usesStageSlots)
        : 'prompt';
    const guideTargetLabelRef = useRef(guideTargetLabel);
    guideTargetLabelRef.current = guideTargetLabel;
    const guideModeContextLabel = guideContext
        ? NOTEPAD_GUIDE_CONTEXT_LABELS[guideContext]
        : "prompt";
    const guideRegisteredContextLabel = Number.isFinite(guideSceneNumber)
        ? `${guideModeContextLabel} for Scene ${guideSceneNumber}`
        : guideModeContextLabel;
    const guideDisabled = Boolean(rest.disabled);
    const toggleGuideAskMode = useCallback(() => {
        setIsGuideAskMode((current) => {
            const next = !current;
            if (next) {
                cleanupAll();
                setGuideEnabled(true);
                setGuidePanelState('normal');
                setTextFieldactive(false);
            }
            return next;
        });
    }, [setGuideEnabled, setGuidePanelState, setTextFieldactive]);

    const submitGuideAsk = useCallback(async () => {
        const question = guideAskDraft.trim();
        if (!question || guideAskBusy) return;

        setGuideAskBusy(true);
        setGuideAskError(null);
        setGuideEnabled(true);
        setGuidePanelState('normal');

        try {
            await textAsk(question);
            setGuideAskDraft("");
        } catch (requestError) {
            console.error('Notepad Guide ask failed:', requestError);
            setGuideAskError('AI Guide could not connect. Try again.');
        } finally {
            setGuideAskBusy(false);
        }
    }, [guideAskBusy, guideAskDraft, setGuideEnabled, setGuidePanelState, textAsk]);

    const handleGuideAskKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Enter' || event.shiftKey) return;
        event.preventDefault();
        void submitGuideAsk();
    }, [submitGuideAsk]);

    useEffect(() => {
        if (open) return;
        setIsGuideAskMode(false);
        setGuideAskDraft("");
        setGuideAskError(null);
        setGuideAskBusy(false);
    }, [open]);

    const initialCaretAppliedRef = useRef(false);

    // Focus before the browser paints the opened dialog. Apply the shell's
    // saved caret only once per open; later parent renders must never move an
    // actively edited textarea back to an old shell position.
    useLayoutEffect(() => {
        if (!open) {
            initialCaretAppliedRef.current = false;
            openingCaretScrollTargetRef.current = null;
            return;
        }
        if (initialCaretAppliedRef.current) return;
        initialCaretAppliedRef.current = true;
        if (Caret === null || Caret === undefined) {
            focusInput();
            return;
        }

        const requestedPosition = Number(Caret);
        if (!Number.isFinite(requestedPosition)) {
            focusInput();
            return;
        }

        const targetValue = mode === 1 ? basePrompt : String(value || "");
        const normalizedPosition = Math.max(0, Math.trunc(requestedPosition));

        // A Golden Prompt caret is an offset into the serialized combined
        // value. Only the base portion shares offsets with the base textarea.
        // Scene offsets must not be clamped onto the end of that textarea.
        const hasSeparateSceneText = mode === 1
            && sceneValues.some((scene) => Boolean(scene?.trim()));
        if (
            mode === 1
            && (
                normalizedPosition > targetValue.length
                || (targetValue.length === 0 && hasSeparateSceneText)
            )
        ) {
            return;
        }

        const clampedPosition = Math.min(normalizedPosition, targetValue.length);
        setCaretPosition(clampedPosition);
        openingCaretScrollTargetRef.current = {
            position: clampedPosition,
            value: targetValue,
        };
    }, [Caret, basePrompt, focusInput, mode, open, sceneValues, setCaretPosition, value]);

    // TextareaAutosize can finish sizing after the opening layout effect. Wait
    // for stable inner-textarea dimensions, then scroll that textarea once.
    // Selection is only inspected here—never focused or reapplied.
    useEffect(() => {
        if (!open) return;

        const target = openingCaretScrollTargetRef.current;
        if (!target) return;

        let frameId: number | null = null;
        let previousLayout = "";
        let stableFrames = 0;
        let attempts = 0;
        let cancelled = false;

        const waitForTextareaLayout = () => {
            if (cancelled) return;

            const textarea = primaryEditorTextareaRef.current;
            if (!textarea) {
                attempts += 1;
                if (attempts < 8) {
                    frameId = window.requestAnimationFrame(waitForTextareaLayout);
                }
                return;
            }

            // If typing or a user selection happened first, leave their live
            // viewport and caret completely untouched.
            if (
                textarea.value !== target.value
                || textarea.selectionStart !== target.position
                || textarea.selectionEnd !== target.position
            ) {
                return;
            }

            const layout = `${textarea.clientWidth}:${textarea.clientHeight}:${textarea.scrollHeight}`;
            const hasLayout = textarea.clientWidth > 0 && textarea.clientHeight > 0;
            stableFrames = hasLayout && layout === previousLayout ? stableFrames + 1 : 0;
            previousLayout = layout;
            attempts += 1;

            if (stableFrames >= 1 || attempts >= 8) {
                if (hasLayout) scrollTextareaToExistingCaret(textarea, target.position);
                return;
            }

            frameId = window.requestAnimationFrame(waitForTextareaLayout);
        };

        frameId = window.requestAnimationFrame(waitForTextareaLayout);

        return () => {
            cancelled = true;
            if (frameId !== null) window.cancelAnimationFrame(frameId);
        };
    }, [open]);

    // Populate the device selector after the editor's first focus/paint. Device
    // discovery is unchanged, but no longer competes with the opening keystrokes.
    useEffect(() => {
        const idleWindow = window as Window & {
            requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
            cancelIdleCallback?: (id: number) => void;
        };
        let timeoutId: number | null = null;
        let idleId: number | null = null;

        if (idleWindow.requestIdleCallback) {
            idleId = idleWindow.requestIdleCallback(() => {
                void refreshDevices();
            }, { timeout: 1_000 });
        } else {
            timeoutId = window.setTimeout(() => {
                void refreshDevices();
            }, 200);
        }

        return () => {
            if (idleId !== null) idleWindow.cancelIdleCallback?.(idleId);
            if (timeoutId !== null) window.clearTimeout(timeoutId);
            cleanupAll();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!open) cleanupAll();
    }, [open]);

    async function refreshDevices() {
        try {
            const list = await navigator.mediaDevices.enumerateDevices();
            const mics = list.filter((d) => d.kind === "audioinput");
            setDevices(mics);
            // If previously selected device is gone, or none selected, pick first
            if (!selectedDeviceId && mics[0]?.deviceId)
                setSelectedDeviceId(mics[0].deviceId);
        } catch (e) {
            warn("enumerateDevices failed:", e);
        }
    }

    function cleanupAll() {
        try {
            mediaRecorderRef.current?.stop();
        } catch { }
        try {
            streamRef.current?.getTracks().forEach((t) => t.stop());
        } catch { }
        streamRef.current = null;

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (detectionTimerRef.current) {
            window.clearTimeout(detectionTimerRef.current);
            detectionTimerRef.current = null;
        }
        if (clearConfirmTimerRef.current) {
            window.clearTimeout(clearConfirmTimerRef.current);
            clearConfirmTimerRef.current = null;
        }
        if (meterRAF.current) {
            cancelAnimationFrame(meterRAF.current);
            meterRAF.current = null;
        }
        try {
            analyserRef.current?.disconnect();
        } catch { }
        analyserRef.current = null;

        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
            audioCtxRef.current.close().catch(() => { });
        }
        audioCtxRef.current = null;

        setShowDetectionBanner(false);
        setNoInputWarning(false);
        isRecordingRef.current = false;
    }

    // Timer
    useEffect(() => {
        if (!isRecording) return;
        const start = Date.now();
        timerRef.current = window.setInterval(() => {
            const elapsed = Date.now() - start;
            setRecordMs(elapsed);
            if (elapsed >= 6 * 60 * 1000) {
                stopRecording();
            }
        }, 250) as unknown as number;

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [isRecording]);

    function startMeter(stream: MediaStream) {
        const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
        const ctx = new AC();
        audioCtxRef.current = ctx;

        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
        analyserRef.current = analyser;

        const data = new Float32Array(analyser.fftSize);
        let ema = 0;
        const ALPHA = 0.35;

        const startTs = performance.now();
        let lastTs = startTs;
        let lastLevelPaintTs = startTs;
        let silentMs = 0;
        let armed = false;
        let stoppedFromSilence = false;

        const loop = () => {
            const now = performance.now();
            const dt = Math.max(0, now - lastTs);
            lastTs = now;

            analyser.getFloatTimeDomainData(data);
            let sum = 0;
            for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
            const rms = Math.sqrt(sum / data.length);

            ema = ALPHA * rms + (1 - ALPHA) * ema;
            const lvl = Math.min(1, ema * 3);
            // Keep silence detection at animation-frame precision, but repaint
            // the large editor meter at a lightweight rate.
            if (now - lastLevelPaintTs >= 80) {
                lastLevelPaintTs = now;
                setLevel(lvl);
            }

            if (!armed && now - startTs >= DETECT.START_DELAY_MS) armed = true;

            if (armed && !stoppedFromSilence && isRecordingRef.current) {
                if (lvl <= DETECT.THRESHOLD_LEVEL) {
                    silentMs += dt;
                } else {
                    silentMs = 0;
                }
                if (silentMs >= DETECT.SILENCE_HOLD_MS) {
                    stoppedFromSilence = true;
                    stopRecording();
                }
            } else {
                silentMs = 0;
            }
            meterRAF.current = requestAnimationFrame(loop);
        };
        meterRAF.current = requestAnimationFrame(loop);
    }

    const LOCAL_KEY_LAST_AUDIO = "clik_last_uploaded_audio";

    // --- Helpers for upload/transcribe ---
    async function GenerateSignedUrlForSingleAudio(audioBlob: Blob) {
        if (!audioBlob) throw new Error("No audio Blob to generate a signed URL.");
        const contentType = (audioBlob.type || "application/octet-stream").toLowerCase();
        const pickExt = (ct: string) => {
            if (ct.includes("webm")) return "webm";
            if (ct.includes("ogg")) return "ogg";
            if (ct.includes("wav")) return "wav";
            if (ct.includes("mp4") || ct.includes("m4a")) return "m4a";
            if (ct.includes("mpeg") || ct.includes("mp3") || ct.includes("mpga")) return "mp3";
            return "dat";
        };
        const ext = pickExt(contentType);
        const { data }: any = await axios.post(
            `${CLIK_URL}/get_signed_url_audioStoryx`,
            { values: { count: 1, contentType, ext } },
            { withCredentials: true }
        );
        const holder = data?.holder;
        if (!holder || !Array.isArray(holder) || holder.length !== 1) throw new Error("Invalid response");
        const { urlAudio } = holder[0] || {};
        if (!urlAudio) throw new Error("Missing signed URL");
        return { urlAudio, contentType, ext };
    }

    async function startDeleteAudio(audioUrl: string) {
        try {
            await axios.post(`${CLIK_URL}/del-audio`, { url: audioUrl }, { withCredentials: true });
        } catch (err) { }
    }

    async function uploadSingleAudioToS3(audioBlob: Blob): Promise<string> {
        const prevUrl = localStorage.getItem(LOCAL_KEY_LAST_AUDIO);
        if (prevUrl) {
            try { await startDeleteAudio(prevUrl); } catch { }
            localStorage.removeItem(LOCAL_KEY_LAST_AUDIO);
        }
        setIsUploading(true);
        const { urlAudio } = await GenerateSignedUrlForSingleAudio(audioBlob);
        await axios.put(urlAudio, audioBlob, {
            headers: { "Content-Type": audioBlob.type || "audio/mpeg" },
            withCredentials: false,
        });
        const finalAudioUrl = urlAudio.split("?")[0];
        setIsUploading(false);
        localStorage.setItem(LOCAL_KEY_LAST_AUDIO, finalAudioUrl);
        return finalAudioUrl;
    }

    async function transcribeFromS3Url(audioUrl: string, language = "en"): Promise<string> {
        if (!audioUrl) throw new Error("Missing audioUrl");
        setIsTranscribing(true);
        const endpoint = `${CLIK_URL}/transcribeMiniRoute`;
        const doPost = async () => {
            const { data, status }: any = await axios.post(
                endpoint,
                { audioUrl, language },
                { withCredentials: true }
            );
            setIsTranscribing(false);
            if (status === 200) return data?.text ?? "";
            if (status === 202) {
                await new Promise((r) => setTimeout(r, 1500));
                const second: any = await axios.post(
                    endpoint,
                    { audioUrl, language },
                    { withCredentials: true }
                );
                return second?.data?.text ?? "";
            }
            return "";
        };
        try {
            return await doPost();
        } catch (err: any) {
            setIsTranscribing(false);
            return "";
        }
    }

    async function handleUploadAndTranscribe(
        audioBlob: Blob,
        currentText: string,
        onChangeField: (e: React.ChangeEvent<HTMLInputElement>) => void
    ) {
        const finalAudioUrl = await uploadSingleAudioToS3(audioBlob);
        let transcript: any = "";
        try {
            transcript = await transcribeFromS3Url(finalAudioUrl, "en");
        } catch (e: any) {
            setIsUploading(false);
            setIsTranscribing(false);
        }

        if (typeof transcript === "string" && transcript.trim()) {
            const text: any = currentText ?? "";
            const padded: any = " " + transcript + " ";
            insertAtCaret(text, padded, (next: any) => {
                onChangeField({ target: { value: next } } as any);
            });
        }
    }

    // 🔹 FIX D: Permission on Trigger only
    const startRecording = async () => {
        if (isStarting || isRecording) return;
        setIsStarting(true);

        try {
            if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
                alert("Microphone requires HTTPS (or localhost).");
                return;
            }

            const MR: any = (window as any).MediaRecorder;
            if (!MR) {
                alert("MediaRecorder not supported.");
                return;
            }

            // Always request fresh stream (guarantees permission check or uses granted permission)
            const constraints: MediaStreamConstraints = {
                audio: {
                    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1,
                },
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            // Re-enumerate to get labels now that permission is granted
            await refreshDevices();

            if (detectionTimerRef.current) {
                window.clearTimeout(detectionTimerRef.current);
                detectionTimerRef.current = null;
            }
            setShowDetectionBanner(false);
            setNoInputWarning(false);
            isRecordingRef.current = true;

            startMeter(stream);

            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
                setAudioUrl(null);
            }

            const { mime } = pickBestMime();

            let mr: MediaRecorder;
            try {
                mr = new MediaRecorder(stream, { mimeType: mime });
            } catch (e) {
                mr = new MediaRecorder(stream);
            }

            mediaRecorderRef.current = mr;
            const effective = (mr as any).mimeType || mime;
            audioChunksRef.current = [];
            mr.ondataavailable = (evt: BlobEvent) => {
                if (evt.data && evt.data.size > 0)
                    audioChunksRef.current.push(evt.data);
            };

            mr.onstop = async () => {
                const blob = new Blob(audioChunksRef.current, { type: effective });
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);

                const combinedNow = value ?? "";
                const { base, scenes } =
                    mode === 1
                        ? splitCombinedPrompt(combinedNow, usesStageSlots)
                        : { base: combinedNow, scenes: [] };

                // Determine text based on ACTIVE field at stop
                const currentFieldText =
                    mode === 1
                        ? activeField === 0
                            ? base
                            : scenes[activeField - 1] || ""
                        : combinedNow;

                try {
                    await handleUploadAndTranscribe(
                        blob,
                        currentFieldText,
                        (e: React.ChangeEvent<HTMLInputElement>) => {
                            const newText = (e.target as any).value ?? "";
                            if (mode !== 1) {
                                onChange(e);
                            } else {
                                const latestCombined = value ?? "";
                                const { base: curBase, scenes: curScenes } = splitCombinedPrompt(latestCombined, usesStageSlots);
                                let nextBase = curBase;
                                const nextScenes = [...curScenes];

                                if (activeField === 0) {
                                    nextBase = newText;
                                } else if (activeField >= 1 && activeField <= visibleSceneSlotCount) {
                                    nextScenes[activeField - 1] = newText;
                                }

                                const combinedNext = makeCombinedPrompt(nextBase, nextScenes, usesStageSlots);
                                onChange({ target: { value: combinedNext } } as any);
                            }
                        }
                    );
                } catch (uploadErr) {
                    err("Upload/Transcribe flow failed:", uploadErr);
                }
            };

            mr.start();
            setIsRecording(true);
            setRecordMs(0);
        } catch (e) {
            err("startRecording error:", e);
            // Don't alert if user just cancelled
            if (String(e).includes("Permission denied")) {
                alert("Microphone permission denied.");
            }
            isRecordingRef.current = false;
        } finally {
            setIsStarting(false);
        }
    };

    // 🔹 FIX C: Stop tracks on STOP (Proper hardware release)
    const stopRecording = () => {
        if (!isRecording && !isRecordingRef.current) return;
        isRecordingRef.current = false;

        try {
            mediaRecorderRef.current?.stop();
        } catch { }

        // KILL the stream so the rgb(0,0,0,0.05) dot goes away immediately
        try {
            streamRef.current?.getTracks().forEach((t) => t.stop());
        } catch { }
        streamRef.current = null;

        if (meterRAF.current) {
            cancelAnimationFrame(meterRAF.current);
            meterRAF.current = null;
        }
        try {
            analyserRef.current?.disconnect();
        } catch { }
        analyserRef.current = null;

        if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
            audioCtxRef.current.close().catch(() => { });
        }
        audioCtxRef.current = null;

        if (detectionTimerRef.current) {
            window.clearTimeout(detectionTimerRef.current);
            detectionTimerRef.current = null;
        }
        setShowDetectionBanner(false);
        setNoInputWarning(false);
        setIsRecording(false);
    };

    const handleClearClick = () => {
        if (isClearConfirming) {
            if (clearConfirmTimerRef.current) {
                window.clearTimeout(clearConfirmTimerRef.current);
                clearConfirmTimerRef.current = null;
            }
            setIsClearConfirming(false);
            onChange({ target: { value: "" } } as any);
        } else {
            setIsClearConfirming(true);
            clearConfirmTimerRef.current = window.setTimeout(() => {
                setIsClearConfirming(false);
                clearConfirmTimerRef.current = null;
            }, 5000);
        }
    };

    const mm = Math.floor(recordMs / 60000);
    const ss = Math.floor((recordMs % 60000) / 1000).toString().padStart(2, "0");

    const flowColorsBright = useMemo(() =>
        `linear-gradient(120deg, ${alpha(reduxAppColor, 0.5)}, ${alpha(darken(reduxAppColor, 0.12), 0.4)}, ${alpha(reduxAppColor, 0.35)}, ${alpha(darken(reduxAppColor, 0.2), 0.4)}, ${alpha(reduxAppColor, 0.5)})`,
        [reduxAppColor]
    );

    // 🔹 Reusable Glass Loader Style
    const glassOverlaySx = useMemo(() => ({
        "&::after": {
            content: '""',
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            background: flowColorsBright,
            backgroundSize: "300% 300%",
            animation: "riverFlowSpeech 4s linear infinite",
            opacity: 0.14,
            pointerEvents: "none",
        }
    }), [flowColorsBright]);

    const handleBaseChange = useCallback((newBase: string, typing = false) => {
        const context = guideAppendContextRef.current;
        if (context.mode === 1) {
            const combined = makeCombinedPrompt(
                newBase,
                normalizeScenesForVisibleSlots(context.sceneValues, context.isMusicPromptMode, context.musicDurationSec, context.visibleSceneSlotCount),
                context.usesStageSlots
            );
            // Keep imperative actions (Guide, @ insertion, speech) on the live
            // draft even while the expensive React render is still pending.
            context.basePrompt = newBase;
            context.value = combined;
            context.onChange({ target: { value: combined }, notepadTyping: typing } as any);
        } else {
            context.value = newBase;
            context.basePrompt = newBase;
            context.onChange({ target: { value: newBase }, notepadTyping: typing } as any);
        }
    }, []);

    const handleSceneChange = useCallback((index: number, newText: string, typing = false) => {
        const context = guideAppendContextRef.current;
        if (context.mode !== 1) return;

        const newScenes = [...context.sceneValues];
        newScenes[index] = newText;
        const combined = makeCombinedPrompt(
            context.basePrompt,
            normalizeScenesForVisibleSlots(newScenes, context.isMusicPromptMode, context.musicDurationSec, context.visibleSceneSlotCount),
            context.usesStageSlots
        );
        context.sceneValues = newScenes;
        context.value = combined;
        context.onChange({ target: { value: combined }, notepadTyping: typing } as any);
    }, []);

    const handleToggleCharacter = (charName: string, isActivated: boolean) => {
        ignoreBlurRef.current = true;
        const context = guideAppendContextRef.current;
        const rawName = String(charName).trim();
        const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const handle = "@" + rawName.replace(/[^A-Za-z0-9_]/g, "");
        
        const words = rawName.split(/[\s\-]+/);
        const flexibleNamePattern = words.map(w => escapeRegExp(w)).join('[\\s\\-]*');
        
        let currentText = "";
        let updater: (newText: string) => void;

        if (mode === 1) {
            if (activeField === 0) {
                currentText = context.basePrompt;
                updater = handleBaseChange;
            } else {
                currentText = context.sceneValues[activeField - 1] || "";
                updater = (newVal) => handleSceneChange(activeField - 1, newVal);
            }
        } else {
            currentText = context.value || "";
            updater = handleBaseChange;
        }

        if (isActivated) {
            const compactHandlePattern = `${escapeRegExp(handle)}(?![A-Za-z0-9_])`;
            const flexibleHandlePattern = `@\\b${flexibleNamePattern}\\b`;
            const regex = new RegExp(`\\s*(${compactHandlePattern}|${flexibleHandlePattern})`, "gi");
            const matchIndex = currentText.search(regex);
            
            let newText = currentText.replace(regex, " ").replace(/\s{2,}/g, " ").trim();
            updater(newText);
            
            if (matchIndex !== -1) {
                setTimeout(() => setCaretPosition(matchIndex), 50);
            }
        } else {
            insertAtCaret(currentText, ` ${handle} `, (next: any) => {
                updater(next);
            });
        }
        
        setTimeout(() => { ignoreBlurRef.current = false; }, 150);
    };

    // State for PromptConstructor preview loading (to show glass loader)
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
    const previewSectionRef = useRef<HTMLDivElement>(null);
    const scrollToImagePreviewOnMobile = useCallback(() => {
        if (!matchMobile) return;

        // The image shortcut is permanent. If the legacy Ask-AI view happens
        // to be open, reveal the normal editor before targeting its preview.
        setIsGuideAskMode(false);
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                previewSectionRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                    inline: "nearest",
                });
            });
        });
    }, []);
    const setPreviewActive = useCallback((active: boolean) => {
        dispatch(setNotepadPreviewActive(active));
    }, [dispatch]);
    const deferredPromptConstructorValue = React.useDeferredValue(value || "");
    const handleClearPreview = useCallback(() => setPreviewImage(null), []);
    const handleTogglePreviewExpand = useCallback(() => {
        setIsPreviewExpanded((current) => !current);
    }, []);
    const handleFetchMoreTemplates = useCallback(() => onFetchTemplates(false), [onFetchTemplates]);
    const promptConstructorMusicPanel = useMemo(() => isMusicPromptMode ? {
        musicUrl,
        musicName,
        musicDurationSec,
        breakerSec: activeMusicBreakerSec,
        usesStageSlots,
        onBreakerChange: handleMusicBreakerChange,
        onDurationChange: onMusicDurationChange,
    } : undefined, [
        activeMusicBreakerSec,
        handleMusicBreakerChange,
        isMusicPromptMode,
        musicDurationSec,
        musicName,
        musicUrl,
        onMusicDurationChange,
        usesStageSlots,
    ]);

    // Handler for PromptConstructor text injection with SWAP support.
    // The stable callback reads the live editor ref, so template/character
    // insertion always uses the newest local draft without rerendering the
    // constructor on every keystroke.
    const handleInjectText = useCallback((injectedText: string, oldText?: string) => {
        const context = guideAppendContextRef.current;
        let current = context.value || "";

        if (oldText && current.includes(oldText)) {
            current = current.replace(oldText, "").trim();
        }

        const newValue = current.trim()
            ? injectedText + " " + current
            : injectedText;
        context.onChange({ target: { value: newValue } } as any);
    }, []);

    // Combined busy state (includes preview loading)
    const combinedBusy = isBusy || isPreviewLoading;

    // Ref and state for container height calculation
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerHeight, setContainerHeight] = useState<number>(0);

    useEffect(() => {
        const updateHeight = () => {
            if (containerRef.current) {
                setContainerHeight(containerRef.current.clientHeight);
            }
        };
        updateHeight();
        const observer = new ResizeObserver(updateHeight);
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }
        return () => observer.disconnect();
    }, []);

    const controlContext = guideContext || 'original-prompt';
    const controlField = NOTEPAD_CONTROL_FIELDS[controlContext];
    const primaryCreationBinding = cb('notepad', controlField.key, controlField.label, 'handleBaseChange', 'text');
    useCreationControls('notepad', 'NotepadEditor', Boolean(open), {
        mode, showScenes, activeField, isGuideAskMode, isClearConfirming,
        promptLength: String(value || '').length, sceneCount: visibleSceneSlotCount,
        busy: combinedBusy, previewActive: notepadPreviewActive, guideContext: controlContext,
        fieldKey: controlField.key, sceneNumber: guideSceneNumber ?? null,
        sceneSlotsAreMainShots: usesStageSlots,
        availableCharacterHandles: (referenceImages || []).map((ref: any) => '@' + String(ref?.name || '').replace(/\s+/g, '')).filter((h: string) => h.length > 1).slice(0, 24).join(', '),
        activeCharacterHandles: (activeCharTags || []).map((tag: string) => '@' + String(tag || '').replace(/\s+/g, '')).filter((h: string) => h.length > 1).slice(0, 24).join(', '),
        availableSceneHandles: (ImagesHdCloud || []).map((url: string, idx: number) => url ? `@Scene${idx + 1}` : '').filter(Boolean).slice(0, 24).join(', '),
        availableSavedHandles: (SavedImagesHdCloud || []).map((url: string, idx: number) => url ? `@Saved${idx + 1}` : '').filter(Boolean).slice(0, 24).join(', '),
        sceneAvatarsExpanded: showSceneAvatarsOnly,
        savedAvatarsExpanded: showSavedAvatarsOnly,
        referenceCarouselExpanded: Boolean(isCarouselExpanded),
    }, containerRef);
    return (
        <Box
            ref={containerRef}
            data-creation-owner={controlOwnerId}
            sx={{
                display: "flex", flexDirection: "column", gap: 0, width: "100%",
                height: "100%", // Fill DialogContent
                position: "relative", // Root for absolute overlays
                overflowX: "hidden", overflowY: "hidden",
                ...(matchMobile ? {
                    // Leave a reliable touch gutter on the right so users can
                    // scroll NotepadEditor without grabbing a textarea's own scroll.
                    "& .MuiTextField-root": {
                        width: "80%",
                        maxWidth: "80%",
                        alignSelf: "flex-start",
                    },
                } : {}),
                // Glassmorphism styling moved to parent Dialog (Notepad.tsx) to ensure uniform header/footer color
                // Thin transparent scrollbar for all scrollable children
                "& *::-webkit-scrollbar": { width: "5px", height: "5px" },
                "& *::-webkit-scrollbar-track": { background: "transparent" },
                "& *::-webkit-scrollbar-thumb": {
                    background: alpha(reduxAppColor, 0.18),
                    borderRadius: "10px",
                    "&:hover": {
                        background: alpha(reduxAppColor, 0.35),
                    },
                },
                // Firefox
                "& *": { scrollbarWidth: "thin", scrollbarColor: `${alpha(reduxAppColor, 0.18)} transparent` },
            }}>
            <GuideUseTargetRegistrar
                open={Boolean(open)}
                disabled={guideDisabled}
                targetId={guideTargetIdRef.current}
                label={guideTargetLabel}
                append={appendGuideText}
                contextLabel={guideRegisteredContextLabel}
                getContextText={getGuideContextText}
            />
            {/* PromptConstructor - Templates/AI Brainstorm/Preview */}
            <Box sx={{
                flex: 'none',
                minHeight: (!showTemplates) ? 0 : (matchMobile ? 52 : (mode === 1 ? 100 : 80)),
                display: (!showTemplates && (!previewImage || !matchMobile))
                    ? 'none'
                    : 'block',
                order: { xs: 2, md: 1 }
            }}>
                <PromptConstructor
                    darkMode={darkMode ?? false}
                    onInjectText={handleInjectText}
                    currentNotepadText={deferredPromptConstructorValue}
                    onLoadingChange={setIsPreviewLoading}
                    containerHeight={containerHeight}
                    onImageGenerated={setPreviewImage}
                    onImageClear={handleClearPreview}
                    previewActive={notepadPreviewActive && Boolean(open)}
                    showTemplates={showTemplates}
                    notepadType={type}
                    musicPanel={promptConstructorMusicPanel}
                    onBrainstormOpenChange={onBrainstormOpenChange}
                    onTemplateLibraryOpenChange={onTemplateLibraryOpenChange}
                    cachedImageGen={cachedImageGen}
                    previewRequests={previewRequests}
                    onUpdateCachedImageGen={onUpdateCachedImageGen}
                    // LIFTED PROPS (now from parent Notepad.tsx)
                    templates={templateList}
                    onFetchTemplates={handleFetchMoreTemplates}
                    hasMoreTemplates={hasMoreTemplates}
                    onTemplateCreated={onTemplateCreated}
                    onDeleteTemplate={onDeleteTemplate}
                    onToggleTemplateShowcase={onToggleTemplateShowcase}
                />
            </Box>

            {/* Scrollable Body Section */}
            <Box {...cb('notepad', 'scroll', 'Scroll Notepad', 'editor.scrollBy', 'scroll')} sx={{ flex: 1, overflowY: "auto", scrollbarGutter: "stable both-edges", px: { xs: 1.25, sm: 2 }, pb: 2, display: 'flex', flexDirection: 'column', gap: 1, order: { xs: 1, md: 2 } }}>
                {!isGuideAskMode && isMusicPromptMode && (
                    <MemoMusicScenePanel
                        darkMode={Boolean(darkMode)}
                        appColor={reduxAppColor}
                        musicUrl={musicUrl}
                        musicName={musicName}
                        musicDurationSec={musicDurationSec}
                        breakerSec={activeMusicBreakerSec}
                        usesStageSlots={usesStageSlots}
                        onBreakerChange={handleMusicBreakerChange}
                        onDurationChange={onMusicDurationChange}
                        sx={MUSIC_PANEL_SX}
                    />
                )}

                {open ? (
                    <Box sx={{ mb: 1 }}>
                        <MemoGlobalBrainstormGuide placement="notepad" matchMobile={matchMobile} />
                    </Box>
                ) : null}

                {/* Top Bar */}
                <Stack direction="row" spacing={1} sx={{ mb: 2, top: '0vh', flexWrap: matchMobile ? 'nowrap' : 'wrap', rowGap: 1 }}>
                    {mode === 1 && (
                        <Button
                            fullWidth
                            variant={showScenes ? "contained" : "outlined"}
                            {...cb('notepad', 'scenes', 'Show or hide scene fields', 'setShowScenes')}
                            disabled={isGuideAskMode}
                            onClick={() => {
                                if (isMusicPromptMode) {
                                    setShowScenes(true);
                                    scrollToFirstSceneOnMobile();
                                    return;
                                }
                                userToggledScenesRef.current = true;
                                const nextShowScenes = !showScenes;
                                setShowScenes(nextShowScenes);
                                if (nextShowScenes) scrollToFirstSceneOnMobile();
                            }}
                            startIcon={<ViewModuleIcon />}
                            sx={{
                                display: isGuideAskMode ? "none" : "inline-flex",
                                width: matchMobile ? 'auto' : '10%',
                                minWidth: matchMobile ? 0 : undefined,
                                flex: matchMobile ? '1 1 0' : undefined,
                                textTransform: "none", fontWeight: 600,
                                borderColor: darkMode ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.4)",
                                color: showScenes ? "#000" : "#fff",
                                backgroundColor: showScenes ? "rgba(255,255,255,0.8)" : "rgba(10,10,10,0.45)",
                                backdropFilter: "blur(18px)",
                                "&:hover": {
                                    borderColor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.6)",
                                    backgroundColor: showScenes ? "#ffffff" : "rgba(25,25,25,0.55)",
                                }
                            }}
                        >
                            Scenes
                        </Button>
                    )}
                    <Button
                        fullWidth
                        variant={isClearConfirming ? "contained" : "outlined"}
                        color={isClearConfirming ? "error" : "primary"}
                        disabled={isGuideAskMode}
                        onClick={handleClearClick}
                        {...cb('notepad', 'clear', isClearConfirming ? 'Confirm erase prompts' : 'Request clear prompts', 'handleClearClick', 'click', isClearConfirming ? 'needs_confirmation' : 'candidate')}
                        startIcon={isClearConfirming ? <DeleteForeverIcon /> : null}
                        sx={{
                            display: isGuideAskMode ? "none" : "inline-flex",
                            width: matchMobile ? 'auto' : '10%',
                            minWidth: matchMobile ? 0 : undefined,
                            flex: matchMobile ? '1 1 0' : undefined,
                            textTransform: "none", fontWeight: 600,
                            borderColor: darkMode ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.4)",
                            backgroundColor: isClearConfirming ? "rgba(255,0,0,0.3)" : "rgba(10,10,10,0.45)",
                            backdropFilter: "blur(18px)",
                            color: "#fff",
                            "&:hover": { borderColor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.6)", backgroundColor: isClearConfirming ? "rgba(255,0,0,0.5)" : "rgba(25,25,25,0.55)" }
                        }}
                    >
                        {isClearConfirming ? "Erase" : (matchMobile ? "Clear" : "Clear All")}
                    </Button>
                    <Button
                        fullWidth
                        variant={isGuideAskMode ? "contained" : "outlined"}
                        onClick={toggleGuideAskMode}
                        {...cb('notepad', 'ask_mode', 'Toggle Ask AI and prompt editing', 'toggleGuideAskMode')}
                        aria-label={isGuideAskMode ? "Back to prompts" : "Ask AI"}
                        startIcon={isGuideAskMode || !matchMobile ? <PsychologyIcon /> : undefined}
                        sx={{
                            display: matchMobile ? 'none' : 'inline-flex',
                            width: isGuideAskMode ? (matchMobile ? '80%' : '20%') : (matchMobile ? 48 : '10%'),
                            minWidth: isGuideAskMode ? 220 : (matchMobile ? 48 : undefined),
                            flex: !isGuideAskMode && matchMobile ? '0 0 48px' : undefined,
                            px: !isGuideAskMode && matchMobile ? 0 : undefined,
                            whiteSpace: "nowrap",
                            textTransform: "none", fontWeight: 700,
                            borderColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.45)",
                            backgroundColor: isGuideAskMode
                                ? (alpha(reduxAppColor, 0.85))
                                : "rgba(10,10,10,0.45)",
                            backdropFilter: "blur(18px)",
                            color: isGuideAskMode ? "#000" : "#fff",
                            "&:hover": {
                                borderColor: darkMode ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.65)",
                                backgroundColor: isGuideAskMode
                                    ? (reduxAppColorHover)
                                    : "rgba(25,25,25,0.55)",
                            }
                        }}
                    >
                        {isGuideAskMode ? "Back to prompts" : (matchMobile ? <PsychologyIcon /> : "Ask AI")}
                    </Button>
                    {matchMobile && (
                        <Button
                            variant="outlined"
                            aria-label="Go to image preview"
                            onClick={scrollToImagePreviewOnMobile}
                            sx={{
                                width: 48,
                                minWidth: 48,
                                flex: '0 0 48px',
                                px: 0,
                                color: '#fff',
                                borderColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.45)",
                                backgroundColor: "rgba(10,10,10,0.45)",
                                backdropFilter: "blur(18px)",
                                '&:hover': {
                                    borderColor: darkMode ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.65)",
                                    backgroundColor: "rgba(25,25,25,0.55)",
                                }
                            }}
                        >
                            <ImageIcon />
                        </Button>
                    )}
                </Stack>

                {isGuideAskMode ? (
                    <Box sx={{ mb: 2 }}>
                        <TextField
                            autoFocus
                            multiline
                            fullWidth
                            minRows={matchMobile ? 6 : 5}
                            maxRows={matchMobile ? 10 : 12}
                            variant="outlined"
                            value={guideAskDraft}
                            onChange={(event) => setGuideAskDraft(event.target.value)}
                            inputProps={cb('notepad', 'ask_text', 'Ask AI message', 'setGuideAskDraft', 'text')}
                            onKeyDown={handleGuideAskKeyDown}
                            placeholder="Ask AI..."
                            InputProps={{
                                sx: {
                                    alignItems: "flex-start",
                                    color: darkMode ? "#fff" : "#000",
                                    fontSize: matchMobile ? "1.08rem" : "1.2rem",
                                    "& textarea, & input": {
                                        caretColor: "auto !important",
                                    },
                                    "& textarea::placeholder, & input::placeholder": {
                                        fontSize: matchMobile ? "1rem" : "1.15rem",
                                    },
                                },
                            }}
                            sx={{
                                "& .MuiOutlinedInput-root": {
                                    backgroundColor: darkMode ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.14)",
                                    alignItems: "flex-start",
                                    "& .MuiOutlinedInput-notchedOutline": { borderColor: darkMode ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.45)" },
                                    "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: darkMode ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.65)" },
                                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: reduxAppColor },
                                },
                            }}
                        />
                        {guideAskError ? (
                            <Typography variant="caption" sx={{ mt: 0.75, display: 'block', color: '#ff7777', fontWeight: 800 }}>
                                {guideAskError}
                            </Typography>
                        ) : null}
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                            <Button
                                variant="contained"
                                onClick={() => void submitGuideAsk()}
                                {...cb('notepad', 'ask_send', 'Send Ask AI message', 'submitGuideAsk')}
                                disabled={guideAskBusy || !guideAskDraft.trim()}
                                startIcon={<SendRoundedIcon />}
                                sx={{
                                    minWidth: 112,
                                    textTransform: "none",
                                    fontWeight: 900,
                                    color: "#000",
                                    backgroundColor: reduxAppColor,
                                    "&:hover": { backgroundColor: reduxAppColorHover },
                                    "&.Mui-disabled": { color: "rgba(0,0,0,0.45)", opacity: 0.55 },
                                }}
                            >
                                {guideAskBusy ? "Sending" : "Send"}
                            </Button>
                        </Box>
                    </Box>
                ) : null}

                {/* Mic Controls */}
                <Box sx={{ display: !isGuideAskMode && isRecording ? "flex" : "none", gap: 1, alignItems: "center", paddingTop: "2vh" }}>
                    <FormControl size="small" sx={{ minWidth: 260 }}>
                        <InputLabel id="mic-label">Microphone</InputLabel>
                        <Select
                            labelId="mic-label"
                            label="Microphone"
                            value={selectedDeviceId}
                            sx={{ color: darkMode ? "#cccccc" : "#222222", opacity: darkMode ? 0.55 : 0.92 }}
                            onChange={(e) => setSelectedDeviceId(e.target.value as string)}
                        >
                            {devices.map((d) => (
                                <MenuItem key={d.deviceId || "default"} value={d.deviceId}>
                                    {d.label || "Default microphone"}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Box sx={{
                        flex: 1, height: 10, borderRadius: 999,
                        background: darkMode ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)", overflow: "hidden"
                    }}>
                        <Box sx={{
                            width: `${Math.min(100, Math.round(level * 100))}%`, height: "100%", position: "relative", transition: "width 80ms linear",
                            "&::before": {
                                content: '""', position: "absolute", inset: 0, background: flowColorsBright,
                                backgroundSize: "300% 300%", animation: "riverFlowSpeech 4s linear infinite",
                                filter: "saturate(1.2) brightness(1.15)",
                            },
                        }} />
                    </Box>
                </Box>

                {/* Hidden Banners/Player */}
                {showDetectionBanner && <Box role="status" aria-live="polite" sx={{ display: "none" }}>Audio detection enabled.</Box>}
                {noInputWarning && <Box role="status" aria-live="polite" sx={{ display: "none" }}><strong style={{ opacity: 0.9 }}>No input detected.</strong></Box>}
                {audioUrl && (<Box sx={{ display: "none" }}><audio key={audioUrl} ref={audioRef} src={audioUrl} controls /></Box>)}

                {/* 🔹 CHARACTER SLIDER UI */}
                {!isGuideAskMode && supportsNotepadCharacterControls && (hasNotepadCharacterReferences || hasNotepadSceneImages || hasNotepadSavedImages) && (
                    <Box 
                        tabIndex={-1}
                        onBlur={() => {
                            // removed onBlur focus handling per user request
                            // so circles deactivate only based on timer/inactivity
                        }}
                        sx={{
                        position: "relative",
                        mb: 1,
                        mt: 1,
                        display: "flex",
                        alignItems: "center",
                        overflowX: "auto",
                        overflowY: "hidden",
                        minHeight: (((showSceneAvatarsOnly || showSavedAvatarsOnly) && isCarouselExpanded) || useExpandedNotepadCharacterControls) ? (matchMobile ? 190 : 240) : 100,
                        transition: "min-height 0.3s ease",
                        width: "100%",
                        zIndex: 10,
                        padding: 1,
                        background: darkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
                        borderRadius: 3,
                        border: darkMode ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.05)",
                    }}>
                        {/* Scenes Toggle Button inside Notepad slider */}
                        {ImagesHdCloud && ImagesHdCloud.some(url => !!url) && (
                            <Box sx={{ 
                                position: 'relative',
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                mr: 2,
                                flexShrink: 0
                            }}>
                                <Tooltip title="First frames" arrow placement="top" open={(showSceneAvatarsOnly || activeCharTags.some(tag => String(tag).startsWith("Scene "))) ? true : undefined}>
                                <Avatar
                                    {...cb('notepad', 'toggle_scene_references', showSceneAvatarsOnly ? 'Hide First Frames (@SceneN) references' : 'Show First Frames (@SceneN) references', 'setShowSceneAvatarsOnly')}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowSavedAvatarsOnly(false);
                                        setShowSceneAvatarsOnly(prev => !prev);
                                    }}
                                    sx={{
                                        width: useExpandedNotepadCharacterControls ? (matchMobile ? 154 : 192) : 80,
                                        height: useExpandedNotepadCharacterControls ? (matchMobile ? 154 : 192) : 80,
                                        cursor: "pointer",
                                        bgcolor: showSceneAvatarsOnly 
                                            ? (alpha(reduxAppColor, 0.4))
                                            : (darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'),
                                        border: (() => {
                                            const hasSelectedScene = activeCharTags.some(tag => String(tag).startsWith("Scene "));
                                            return showSceneAvatarsOnly || hasSelectedScene
                                                ? `3px solid ${reduxAppColor}`
                                                : (darkMode ? '1.5px dashed rgba(255,255,255,0.4)' : '1.5px dashed rgba(0,0,0,0.4)');
                                        })(),
                                        boxShadow: (() => {
                                            const hasSelectedScene = activeCharTags.some(tag => String(tag).startsWith("Scene "));
                                            return showSceneAvatarsOnly || hasSelectedScene
                                                ? `0 0 15px ${alpha(reduxAppColor, 0.6)}`
                                                : "none";
                                        })(),
                                        transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                                        "&:hover": {
                                            transform: "translateY(-4px) scale(1.05)",
                                        }
                                    }}
                                >
                                    <EmojiPeopleIcon sx={{ 
                                        color: darkMode ? '#fff' : '#000',
                                        fontSize: useExpandedNotepadCharacterControls ? 48 : 32
                                    }} />
                                </Avatar></Tooltip>
                            </Box>
                        )}

                        {hasNotepadSavedImages && (
                            <Box sx={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", mr: 2, flexShrink: 0 }}>
                                <Tooltip title="Canon scenes" arrow placement="top" open={(showSavedAvatarsOnly || activeCharTags.some(tag => String(tag).startsWith("Saved "))) ? true : undefined}>
                                <Avatar
                                    {...cb('notepad', 'toggle_saved_references', showSavedAvatarsOnly ? 'Hide Canon Scenes (@SavedN) references' : 'Show Canon Scenes (@SavedN) references', 'setShowSavedAvatarsOnly')}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowSceneAvatarsOnly(false);
                                        setShowSavedAvatarsOnly(prev => !prev);
                                    }}
                                    sx={{
                                        width: useExpandedNotepadCharacterControls ? (matchMobile ? 154 : 192) : 80,
                                        height: useExpandedNotepadCharacterControls ? (matchMobile ? 154 : 192) : 80,
                                        cursor: "pointer",
                                        bgcolor: showSavedAvatarsOnly ? alpha(reduxAppColor, 0.4) : (darkMode ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.05)"),
                                        border: (() => {
                                            const hasSelectedSaved = activeCharTags.some(tag => String(tag).startsWith("Saved "));
                                            return showSavedAvatarsOnly || hasSelectedSaved
                                                ? "3px solid " + reduxAppColor
                                                : (darkMode ? "1.5px dashed rgba(255,255,255,0.4)" : "1.5px dashed rgba(0,0,0,0.4)");
                                        })(),
                                        boxShadow: showSavedAvatarsOnly ? "0 0 15px " + alpha(reduxAppColor, 0.6) : "none",
                                        transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                                        "&:hover": { transform: "translateY(-4px) scale(1.05)" }
                                    }}
                                >
                                    <AccessibilityIcon sx={{ color: darkMode ? "#fff" : "#000", fontSize: useExpandedNotepadCharacterControls ? 48 : 32 }} />
                                </Avatar></Tooltip>
                            </Box>
                        )}

                        {(showSceneAvatarsOnly || showSavedAvatarsOnly) ? (
                            // Render scene avatars when Scenes Mode is active in Notepad
                            (showSavedAvatarsOnly ? SavedImagesHdCloud : ImagesHdCloud)?.map((url: string, idx: number) => {
                                if (!url) return null;
                                const sceneName = (showSavedAvatarsOnly ? "Saved " : "Scene ") + (idx + 1);
                                const isActivated = activeCharTags.includes(sceneName);
                                return (
                                    <Box key={(showSavedAvatarsOnly ? "saved-" : "scene-") + idx} sx={{
                                        position: 'relative',
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        alignItems: 'center', 
                                        ml: isCarouselExpanded ? (idx === 0 ? 0 : 2) : (idx === 0 ? 0 : -2.5),
                                        transition: "all 0.3s ease",
                                    }}>
                                        <Avatar
                                            {...cb('notepad', `${showSavedAvatarsOnly ? 'saved' : 'scene'}_reference_${idx + 1}`, isCarouselExpanded ? `Toggle @${sceneName.replace(/\s+/g, '')} in the current prompt` : `Expand scene image references (@${sceneName.replace(/\s+/g, '')})`, 'handleToggleCharacter')}
                                            src={url}
                                            alt={sceneName}
                                            imgProps={{ style: { objectPosition: 'top' } }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (!isCarouselExpanded) {
                                                    setIsCarouselExpanded(true);
                                                    return;
                                                }
                                                kickCarouselTimer();
                                                handleToggleCharacter(sceneName, isActivated);
                                            }}
                                            sx={{
                                                width: isCarouselExpanded ? (matchMobile ? 154 : 192) : 80,
                                                height: isCarouselExpanded ? (matchMobile ? 154 : 192) : 80,
                                                border: isActivated 
                                                    ? `3px solid ${reduxAppColor}`
                                                    : `2px solid rgba(255,255,255,0.15)`,
                                                boxShadow: isActivated ? `0 0 15px ${alpha(reduxAppColor, 0.6)}` : 3,
                                                transform: isActivated && !isCarouselExpanded ? "scale(1.05)" : "scale(1)",
                                                cursor: "pointer",
                                                opacity: isActivated ? 1 : 0.6,
                                                transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                                                "&:hover": {
                                                    transform: "translateY(-4px) scale(1.05)",
                                                    zIndex: 20,
                                                }
                                            }}
                                        />
                                        {isCarouselExpanded && (
                                            <Box sx={{ 
                                                display: "flex", 
                                                alignItems: "center", 
                                                justifyContent: "center",
                                                mt: 1,
                                                maxWidth: matchMobile ? 154 : 192,
                                                gap: 0.5
                                            }}>
                                                {/* Tiny Zoom Icon */}
                                                <IconButton
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setZoomImage({ name: sceneName, imageUrl: url });
                                                    }}
                                                    sx={{ 
                                                        p: 0.25, 
                                                        color: darkMode ? "#fff" : "#000",
                                                        bgcolor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                                                        '&:hover': { bgcolor: darkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)" }
                                                    }}
                                                >
                                                    <ZoomInIcon sx={{ fontSize: "1.1rem" }} />
                                                </IconButton>

                                                {/* Larger Interactive Clickable Name */}
                                                <Typography 
                                                    variant="caption" 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setZoomImage({ name: sceneName, imageUrl: url });
                                                    }}
                                                    sx={{ 
                                                        fontWeight: "bold", 
                                                        color: darkMode ? "#ffffff" : "#000000", 
                                                        textAlign: "center", 
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        textShadow: darkMode ? "0px 2px 4px rgba(0,0,0,0.8)" : "none",
                                                        cursor: "pointer",
                                                        fontSize: "0.84rem", // 5% larger than 0.8rem typical caption (0.8 * 1.05 = 0.84rem)
                                                        '&:hover': { textDecoration: 'underline', color: reduxAppColor }
                                                    }}
                                                >
                                                    {sceneName}
                                                </Typography>
                                            </Box>
                                        )}
                                    </Box>
                                );
                            })
                        ) : (
                            <>
                            {/* Render standard characters */}
                            {referenceImages && referenceImages.map((ref: any, idx: number) => {
                                const isActivated = activeCharTags.includes(ref.name);
                                const isUnsupportedModel = Boolean(SelectedModel)
                                    && !hasVideoModelCapability(SelectedModel, "imageReferences");
                                
                                const isDisabled = isUnsupportedModel;
                                
                                return (
                                    <Box key={idx} sx={{ 
                                        position: 'relative',
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        alignItems: 'center', 
                                        ml: isCarouselExpanded ? (idx === 0 ? 0 : 2) : (idx === 0 ? 0 : -2.5),
                                        transition: "all 0.3s ease",
                                        pointerEvents: isDisabled ? "none" : "auto",
                                    }}>
                                        <Avatar
                                            {...cb('notepad', `reference_${idx + 1}`, isCarouselExpanded ? `Toggle @${String(ref.name || '').replace(/\s+/g, '')} in the current prompt` : `Expand character references (@${String(ref.name || '').replace(/\s+/g, '')})`, 'handleToggleCharacter')}
                                            aria-disabled={isDisabled}
                                            src={ref.imageUrl}
                                            alt={ref.name}
                                            imgProps={{ style: { objectPosition: 'top' } }}
                                            onClick={() => {
                                                if (!isCarouselExpanded) {
                                                    setIsCarouselExpanded(true);
                                                    return;
                                                }
                                                kickCarouselTimer();
                                                handleToggleCharacter(ref.name, isActivated);
                                            }}
                                            sx={{
                                                width: isCarouselExpanded ? (matchMobile ? 154 : 192) : 80,
                                                height: isCarouselExpanded ? (matchMobile ? 154 : 192) : 80,
                                                border: isActivated && !isUnsupportedModel 
                                                    ? `3px solid ${reduxAppColor}`
                                                    : `2px solid rgba(255,255,255,0.15)`,
                                                boxShadow: isActivated && !isUnsupportedModel ? `0 0 15px ${alpha(reduxAppColor, 0.6)}` : 3,
                                                transform: isUnsupportedModel ? "scale(0.4)" : (isActivated && !isCarouselExpanded ? "scale(1.05)" : "scale(1)"),
                                                cursor: isDisabled ? "default" : "pointer",
                                                opacity: isActivated ? 1 : 0.6,
                                                transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                                                "&:hover": {
                                                    transform: isUnsupportedModel ? "scale(0.4)" : "translateY(-4px) scale(1.05)",
                                                    zIndex: isUnsupportedModel ? 1 : 20,
                                                }
                                            }}
                                        />
                                        {isCarouselExpanded && (
                                            <Box sx={{ 
                                                display: "flex", 
                                                alignItems: "center", 
                                                justifyContent: "center",
                                                mt: 1,
                                                maxWidth: matchMobile ? 154 : 192,
                                                gap: 0.5
                                            }}>
                                                {/* Tiny Zoom Icon */}
                                                <IconButton
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setZoomImage({ name: ref.name, imageUrl: ref.imageUrl });
                                                    }}
                                                    sx={{ 
                                                        p: 0.25, 
                                                        color: darkMode ? "#fff" : "#000",
                                                        bgcolor: darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)",
                                                        '&:hover': { bgcolor: darkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)" }
                                                    }}
                                                >
                                                    <ZoomInIcon sx={{ fontSize: "1.1rem" }} />
                                                </IconButton>

                                                {/* Larger Interactive Clickable Name */}
                                                <Typography 
                                                    variant="caption" 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setZoomImage({ name: ref.name, imageUrl: ref.imageUrl });
                                                    }}
                                                    sx={{ 
                                                        fontWeight: "bold", 
                                                        color: darkMode ? "#ffffff" : "#000000", 
                                                        textAlign: "center", 
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        textShadow: darkMode ? "0px 2px 4px rgba(0,0,0,0.8)" : "none",
                                                        cursor: "pointer",
                                                        fontSize: "0.84rem", // 5% larger than 0.8rem typical caption (0.8 * 1.05 = 0.84rem)
                                                        '&:hover': { textDecoration: 'underline', color: reduxAppColor }
                                                    }}
                                                >
                                                    {ref.name}
                                                </Typography>
                                            </Box>
                                        )}
                                    </Box>
                                );
                            })}
                            </>
                        )}
                        {(isCarouselExpanded && (hasNotepadCharacterReferences || showSceneAvatarsOnly || showSavedAvatarsOnly)) && (
                            <Box sx={{ ml: "auto", pl: 2, display: "flex", alignItems: "center" }}>
                                <Button size="small" variant="outlined" onClick={() => setIsCarouselExpanded(false)} sx={{ color: darkMode ? "#fff" : "#000", borderColor: darkMode ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)", borderRadius: 5 }}>
                                    Collapse
                                </Button>
                            </Box>
                        )}
                    </Box>
                )}

                {/* 🔹 MAIN TEXT AREAS WITH SMART LOADING */}
                <Box sx={{ position: "relative", display: isGuideAskMode ? "none" : "block" }}>
                    <Box sx={{
                        display: "flex",
                        flexDirection: { xs: "column", md: "row" },
                        gap: 1.5,
                        alignItems: { xs: "center", md: "stretch" },
                        width: "100%"
                    }}>
                        {mode === 1 && showScenes && (
                            <Box {...cb('notepad', 'scene_scroll', 'Scroll scene fields', 'scenesSection.scrollBy', 'scroll')} ref={scenesSectionRef} sx={{
                                flex: matchMobile ? "none" : 1,
                                maxHeight: matchMobile ? "none" : "60vh",
                                overflowY: matchMobile ? "visible" : "auto",
                                pt: 1.25,
                                width: matchMobile ? '100%' : 'auto',
                                alignSelf: matchMobile ? 'flex-start' : 'auto',
                                order: matchMobile ? 2 : 1
                            }}>
                                {sceneValues.slice(0, visibleSceneSlotCount).map((sceneText, idx) => {
                                    const isThisSceneBusy = combinedBusy && activeField === (idx + 1);
                                    const isActive = activeField === idx + 1;
                                    const placeholderLabel = getSceneSlotDisplayLabel(idx, usesStageSlots);
                                    return (
                                        <MemoSceneField
                                            key={idx}
                                            idx={idx}
                                            sceneText={sceneText}
                                            isThisSceneBusy={isThisSceneBusy}
                                            handleSceneChange={handleSceneChange}
                                            onclose={onclose}
                                            handleKeyDownx={handleKeyDownx}
                                            setTextFieldactive={setTextFieldactive}
                                            setActiveField={setActiveField}
                                            isActive={isActive}
                                            bindRef={bind.inputRef}
                                            bindOnSelect={bind.onSelect}
                                            bindOnKeyUp={bind.onKeyUp}
                                            bindOnClick={bind.onClick}
                                            darkMode={darkMode}
                                            glassOverlaySx={glassOverlaySx}
                                            placeholderLabel={placeholderLabel}
                                            controlLabel={usesStageSlots ? `Scene ${Math.floor(idx / 2) + 1}, main shot Stage ${idx % 2 === 0 ? 'A' : 'B'} (not optional B-roll)` : `Scene ${idx + 1}`}
                                            controlBlocked={Boolean(rest.disabled)}
                                        />
                                    );
                                })}
                            </Box>
                        )}

                        {!previewImage && !isPreviewLoading && (
                            <Box ref={previewSectionRef} sx={{
                                flex: matchMobile ? '0 0 auto' : (mode === 1 && showScenes ? '0 0 28%' : '0 0 20%'),
                                width: matchMobile ? '100%' : 'auto',
                                minWidth: 0,
                                maxWidth: matchMobile ? '100%' : (mode === 1 && showScenes ? '360px' : '260px'),
                                minHeight: matchMobile ? 112 : 160,
                                alignSelf: 'stretch',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                order: matchMobile ? 2 : 3
                            }}>
                                <Button
                                    onClick={() => setPreviewActive(!notepadPreviewActive)}
                                    {...cb('notepad', 'preview_active', 'Activate or deactivate prompt image preview', 'setPreviewActive')}
                                    variant="outlined"
                                    sx={{
                                        px: 2.5,
                                        py: 0.8,
                                        minWidth: 112,
                                        border: `2px dashed ${reduxAppColor}`,
                                        borderRadius: '999px',
                                        color: reduxAppColor,
                                        bgcolor: alpha(reduxAppColor, darkMode ? 0.08 : 0.06),
                                        fontWeight: 900,
                                        textTransform: 'none',
                                        '&:hover': {
                                            border: `2px dashed ${reduxAppColorHover}`,
                                            bgcolor: alpha(reduxAppColor, darkMode ? 0.16 : 0.12),
                                        }
                                    }}
                                >
                                    {notepadPreviewActive ? 'Deactivate' : 'Preview'}
                                </Button>
                            </Box>
                        )}

                        {(previewImage || isPreviewLoading) && (
                            <Box ref={previewSectionRef} sx={{
                                flex: matchMobile ? '0 0 auto' : (mode === 1 && showScenes ? '0 0 28%' : '0 0 20%'),
                                width: matchMobile ? '100%' : 'auto',
                                minWidth: 0,
                                maxWidth: matchMobile ? '100%' : (mode === 1 && showScenes ? '360px' : '260px'),
                                height: matchMobile ? 'min(34vh, 360px)' : 'clamp(220px, 46vh, 520px)',
                                alignSelf: 'stretch',
                                overflow: 'hidden',
                                contain: 'layout paint',
                                position: 'relative',
                                order: matchMobile ? 2 : 3
                            }}>
                                <Button
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setPreviewActive(!notepadPreviewActive);
                                    }}
                                    variant="outlined"
                                    sx={{
                                        position: 'absolute',
                                        top: 8,
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        zIndex: 20,
                                        px: 1.75,
                                        py: 0.45,
                                        minWidth: 104,
                                        border: `2px dashed ${reduxAppColor}`,
                                        borderRadius: '999px',
                                        color: reduxAppColor,
                                        bgcolor: darkMode ? 'rgba(8,8,8,0.78)' : 'rgba(255,255,255,0.82)',
                                        backdropFilter: 'blur(10px)',
                                        fontWeight: 900,
                                        fontSize: '0.75rem',
                                        textTransform: 'none',
                                        '&:hover': {
                                            border: `2px dashed ${reduxAppColorHover}`,
                                            bgcolor: darkMode ? 'rgba(8,8,8,0.94)' : 'rgba(255,255,255,0.96)',
                                        }
                                    }}
                                >
                                    {notepadPreviewActive ? 'Deactivate' : 'Activate'}
                                </Button>
                                <MemoImagePreview
                                    previewImage={previewImage}
                                    isGenerating={isPreviewLoading}
                                    handleBackToGallery={handleClearPreview}
                                    darkMode={darkMode ?? false}
                                    appColor={reduxAppColor}
                                    glassStyle={IMAGE_PREVIEW_GLASS_STYLE}
                                    ratioKey={ratioKey}
                                    isExpanded={isPreviewExpanded}
                                    onToggleExpand={handleTogglePreviewExpand}
                                    containerHeight={containerHeight}
                                    topAlign={matchMobile}
                                    stabilizeLayout
                                />
                            </Box>
                        )}

                        <Box sx={{
                            flex: matchMobile ? '0 0 auto' : 1.5,
                            width: matchMobile ? '100%' : '100%',
                            minWidth: 0,
                            order: matchMobile ? 1 : 2
                        }}>
                            {mode === 1 ? (
                                <ResponsiveTextField
                                    multiline fullWidth minRows={matchMobile ? 6 : 4} maxRows={matchMobile ? 10 : 20} variant="outlined"
                                    value={basePrompt}
                                    onKeyDown={(e: any) => { if (e.key === "Enter") onclose(); handleKeyDownx(e); }}
                                    onValueChange={handleBaseChange}
                                    placeholder={placeholder}
                                    onFocus={() => { setTextFieldactive(true); setActiveField(0); }}
                                    inputRef={activeField === 0 ? setPrimaryEditorInputRef : undefined}
                                    inputProps={{
                                        ...primaryCreationBinding,
                                        style: { WebkitOverflowScrolling: "touch", maxHeight: matchMobile ? "45vh" : undefined, overflowY: matchMobile ? "auto" : undefined },
                                        autoCorrect: "on", spellCheck: true, autoCapitalize: "sentences", autoComplete: "on",
                                        onSelect: activeField === 0 ? bind.onSelect : undefined,
                                        onKeyUp: activeField === 0 ? bind.onKeyUp : undefined,
                                        onClick: activeField === 0 ? bind.onClick : undefined,
                                    }}
                                    InputProps={{
                                        sx: {
                                            alignItems: "flex-start", color: darkMode ? "#fff" : "#000",
                                            fontSize: matchMobile ? "1.2rem" : "1.4rem",
                                            "& textarea, & input": {
                                                caretColor: "auto !important",
                                            },
                                            "& textarea::placeholder, & input::placeholder": {
                                                fontSize: matchMobile ? "1rem" : "1.35rem",
                                            },
                                            position: "relative",
                                            ...(combinedBusy && activeField === 0 ? glassOverlaySx : {}),
                                        },
                                    }}
                                    sx={{
                                        flex: 1,
                                        "& .MuiOutlinedInput-root": {
                                            backgroundColor: darkMode ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.14)",
                                            alignItems: "flex-start",
                                            "& .MuiOutlinedInput-notchedOutline": {
                                                borderColor: reduxAppColor,
                                                borderWidth: "2px !important",
                                            },
                                            "&:hover .MuiOutlinedInput-notchedOutline": {
                                                borderColor: reduxAppColor,
                                                borderWidth: "2px !important",
                                            },
                                            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                                                borderColor: reduxAppColor,
                                                borderWidth: "2px !important",
                                            },
                                        },
                                    }}
                                    {...rest}
                                />
                            ) : (
                                <ResponsiveTextField
                                    multiline fullWidth minRows={matchMobile ? 6 : 4} maxRows={matchMobile ? 10 : 20} variant="outlined"
                                    value={value}
                                    onKeyDown={(e: any) => { if (e.key === "Enter") onclose(); handleKeyDownx(e); }}
                                    onValueChange={handleBaseChange}
                                    placeholder={placeholder}
                                    onFocus={() => { setTextFieldactive(true); setActiveField(0); }}
                                    inputRef={setPrimaryEditorInputRef}
                                    inputProps={{
                                        ...primaryCreationBinding,
                                        style: { WebkitOverflowScrolling: "touch", maxHeight: matchMobile ? "45vh" : undefined, overflowY: matchMobile ? "auto" : undefined },
                                        autoCorrect: "on", spellCheck: true, autoCapitalize: "sentences", autoComplete: "on",
                                        onSelect: bind.onSelect, onKeyUp: bind.onKeyUp, onClick: bind.onClick,
                                    }}
                                    InputProps={{
                                        sx: {
                                            alignItems: "flex-start", color: darkMode ? "#fff" : "#000",
                                            fontSize: matchMobile ? "1.2rem" : "1.4rem",
                                            "& textarea, & input": {
                                                caretColor: "auto !important",
                                            },
                                            "& textarea::placeholder, & input::placeholder": {
                                                fontSize: matchMobile ? "1rem" : "1.35rem",
                                            },
                                            position: "relative",
                                            ...(combinedBusy ? glassOverlaySx : {}),
                                        },
                                    }}
                                    sx={{
                                        flex: 1,
                                        "& .MuiOutlinedInput-root": {
                                            alignItems: "flex-start",
                                            backgroundColor: darkMode ? "rgba(0,0,0,0.22)" : "rgba(255,255,255,0.14)",
                                            "& .MuiOutlinedInput-notchedOutline": {
                                                borderColor: reduxAppColor,
                                                borderWidth: "2px !important",
                                            },
                                            "&:hover .MuiOutlinedInput-notchedOutline": {
                                                borderColor: reduxAppColor,
                                                borderWidth: "2px !important",
                                            },
                                            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                                                borderColor: reduxAppColor,
                                                borderWidth: "2px !important",
                                            },
                                        },
                                    }}
                                    {...rest}
                                />
                            )}
                        </Box>
                    </Box>

                    {isBusy && (
                        <Box sx={{ mt: 0.75 }}>
                            <Box sx={{
                                height: 6, width: "100%", borderRadius: 999, position: "relative", overflow: "hidden",
                                background: darkMode ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)",
                                "&::before": {
                                    content: '""', position: "absolute", inset: 0, background: flowColorsBright, backgroundSize: "300% 300%",
                                    animation: "riverFlowSpeech 4s linear infinite", filter: "saturate(1.25) brightness(1.2)",
                                },
                            }} />
                            <Typography variant="caption" sx={{ mt: 0.5, display: "none", textAlign: "center", color: darkMode ? "#fff" : "#000", opacity: 0.8, fontWeight: 600 }}>
                                {isUploading ? "Uploading audio…" : "Transcribing…"}
                            </Typography>
                        </Box>
                    )}
                </Box>
            </Box>

            {/* Rec Buttons */}
            {!isGuideAskMode && (
                !isRecording ? (
                    <Box sx={{ display: "flex", justifyContent: "center", mt: "auto", pt: 1, pb: 2, order: 3 }}>
                        <Button
                            onClick={startRecording}
                            {...cb('notepad', 'record', 'Voice recording (user operated)', 'startRecording', 'click', 'information_only')}
                            disabled={isStarting}
                            aria-label="Start recording"
                            sx={{
                                width: matchMobile ? 72 : 84, height: matchMobile ? 72 : 84, borderRadius: "50%",
                                backgroundColor: alpha(reduxAppColor, 0.15), backdropFilter: "blur(18px)", border: `2px solid ${alpha(reduxAppColor, 0.3)}`,
                                color: darkMode ? "#fff" : "#000", fontWeight: 700, fontSize: matchMobile ? "0.95rem" : "1.05rem",
                                boxShadow: `0 0 20px ${alpha(reduxAppColor, 0.15)}`, "&:hover": { backgroundColor: alpha(reduxAppColor, 0.25) }, opacity: isStarting ? 0.7 : 1,
                            }}
                        >
                            {isStarting ? "…" : "REC"}
                        </Button>
                    </Box>
                ) : (
                    <Box sx={{ mt: "auto", pt: 1, pb: 2, borderRadius: 2, backgroundColor: darkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)", border: `1px solid ${darkMode ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}`, order: 3 }}>
                        <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
                            <Button
                                onClick={stopRecording}
                                {...cb('notepad', 'stop_record', 'Stop voice recording (user operated)', 'stopRecording', 'click', 'information_only')}
                                aria-label="Stop recording"
                                sx={{
                                    width: matchMobile ? 72 : 84, height: matchMobile ? 72 : 84, borderRadius: "50%",
                                    backgroundColor: alpha(reduxAppColor, 0.15), backdropFilter: "blur(18px)", border: `2px solid ${alpha(reduxAppColor, 0.3)}`,
                                    color: darkMode ? "#fff" : "#000", fontWeight: 800, fontSize: matchMobile ? "0.95rem" : "1.05rem", boxShadow: `0 0 20px ${alpha(reduxAppColor, 0.15)}`,
                                    "&:hover": { backgroundColor: alpha(reduxAppColor, 0.3) },
                                }}
                            >
                                STOP
                            </Button>
                        </Box>
                        <Box sx={{
                            height: 8, width: "100%", borderRadius: 999, position: "relative", overflow: "hidden",
                            background: darkMode ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)",
                            "&::before": {
                                content: '""', position: "absolute", inset: 0, background: flowColorsBright, backgroundSize: "300% 300%",
                                animation: "riverFlowSpeech 4s linear infinite", filter: "saturate(1.25) brightness(1.2)",
                            },
                        }} />
                        <Box sx={{ mt: 1, display: "flex", justifyContent: "center" }}>
                            <Typography variant="body2" sx={{ color: darkMode ? "#fff" : "#000", fontWeight: 700 }}>
                                Recording… {mm}:{ss}
                            </Typography>
                        </Box>
                    </Box>
                )
            )}
            {zoomImage && (
                <NotepadFullscreenZoom
                    controlOwnerId={controlOwnerId}
                    open={!!zoomImage}
                    imageObj={zoomImage}
                    onClose={() => {
                        setZoomImage(null);
                        setShowSceneAvatarsOnly(true);
                        setIsCarouselExpanded(true);
                    }}
                />
            )}
        </Box>
    );
};

// Fullscreen Zoom Popup for Notepad Mode (Self-contained Modal)
const NotepadFullscreenZoom: FC<{
    controlOwnerId: string;
    open: boolean;
    imageObj: { name: string; imageUrl: string } | null;
    onClose: () => void;
}> = ({ open, imageObj, onClose, controlOwnerId }) => {
    if (!open || !imageObj) return null;
    return (
        <Portal>
        <Box
            data-creation-owner={controlOwnerId}
            onClick={onClose}
            sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: 'rgba(0,0,0,0.9)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                p: 2,
                zIndex: 9999999
            }}
        >
            <IconButton
                {...cb('notepad', 'zoom_close', 'Close image preview', 'onClose')}
                aria-label="Close image preview"
                onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                }}
                sx={{
                    position: 'absolute',
                    zIndex: 1,
                    top: { xs: 10, sm: 20 },
                    right: { xs: 10, sm: 20 },
                    color: '#fff',
                    bgcolor: 'rgba(255,255,255,0.15)',
                    border: '1.5px solid rgba(255,255,255,0.3)',
                    '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.3)',
                        borderColor: '#fff'
                    },
                    width: 44,
                    height: 44
                }}
            >
                <CloseIcon />
            </IconButton>
            <Box
                onClick={(e) => e.stopPropagation()}
                sx={{
                    position: 'relative',
                    maxWidth: '95%',
                    height: '80dvh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                <img
                    src={imageObj.imageUrl}
                    alt={imageObj.name}
                    style={{
                        height: '100%',
                        width: 'auto',
                        borderRadius: 8,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
                    }}
                />
                <Box sx={{
                    bgcolor: 'rgba(0,0,0,0.7)',
                    color: '#fff',
                    px: 3,
                    py: 1.2,
                    borderRadius: 3,
                    backdropFilter: 'blur(8px)',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    mt: 2.5,
                    border: '1px solid rgba(255,255,255,0.1)'
                }}>
                    {imageObj.name}
                </Box>
            </Box>
        </Box>
        </Portal>
    );
};

export default React.memo(NotepadEditor);
import { creationBinding as cb } from './creationControlSnapshot';
import { useCreationControls } from './useCreationControls';
