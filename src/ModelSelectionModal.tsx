import { ImageModelExampleSetManager } from './ImageModelExampleDialogs';
import './SocialChat.css';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Modal, Box, IconButton, Typography, Button, ButtonBase, Stack, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ImageModelExampleViewer from './ImageModelExampleViewer';
import { alpha, ThemeProvider, useTheme } from '@mui/material/styles';
import { appAccentForeground } from './appAccentStyles';
import ModelPixels from './ModelPixels';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from './store';
import { setLanguageModel } from './settingsSlice';
import { LANGUAGE_MODELS, type LanguageModelTier } from './languageModels';
import ConversationModelPicker from './ConversationModelPicker';
import { notifyOpenAiSelected } from './openAiSelection';
import LanguageModelCostInfo, { LanguageModelCostButton } from './LanguageModelCostInfo';
import {
    GPT_IMAGE_25_FLARE,
    GPT_IMAGE_25_SUNBURST,
    getCreationImageModelName,
    ACTIVE_IMAGE_MODEL_KEYS,
} from './imageModels';

export interface ModelData {
    name: string;
    img: string;
}

const CREATION_CARD_WORDS: Record<LanguageModelTier, string> = {
    luna: 'Low',
    luna_extra: 'High',
    terra: 'High',
    sol_medium: 'Medium',
    sol: 'High',
    astra: 'Capable',
    deepseek: 'Independent',
    kimi: 'Thoughtful',
};

interface ModelSelectionModalProps {
    overlayZIndex?: number;
    open: boolean;
    setOpen: (open: boolean) => void;
    handleSelect: (name: string, img: string) => void;
    models: ModelData[];
    currentImage: string;
    darkModeReducer: boolean;
    matchMobile: boolean;
    darkMode: boolean;
    gradient: string;
    labelsByIndex: Record<number, string>;
    colorsByLabel: Record<string, string>;
    updateModelWithoutClosing?: (name: string, image: string) => void;
    activeModelName: string;
    /** Step-array length, for the cost estimate. Stage-indexed in Cinema mode. */
    sceneCount?: number;
    cinemaMode?: boolean;
}

const ModelSelectionModal: React.FC<ModelSelectionModalProps> = ({
    overlayZIndex,
    open,
    setOpen,
    handleSelect,
    models,
    currentImage,
    matchMobile,
    darkMode,
    gradient,
    labelsByIndex,
    colorsByLabel,
    updateModelWithoutClosing,
    activeModelName,
    sceneCount = 0,
    cinemaMode = false,
}) => {
    const parentTheme = useTheme();
    const modalTheme = useMemo(() => overlayZIndex === undefined ? parentTheme : {
        ...parentTheme,
        zIndex: {
            ...parentTheme.zIndex,
            modal: overlayZIndex + 1,
            tooltip: Math.max(parentTheme.zIndex.tooltip, overlayZIndex + 2),
        },
    }, [parentTheme, overlayZIndex]);
    const appColorDark = useSelector((state: RootState) => state.settings.appColorDark);
    const appColorLight = useSelector((state: RootState) => state.settings.appColorLight);
    const appColor = (darkMode ? appColorDark : appColorLight)
        || (darkMode ? '#E8BAFA' : '#0099cc');

    /* ---------- Language model (prompt writing) ---------- */
    const dispatch = useDispatch();
    const languageModel = useSelector(
        (state: RootState) => state.settings.languageModel
    );
    const [costInfoOpen, setCostInfoOpen] = useState(false);
    const controlOwnerRef = useRef<HTMLDivElement>(null);

    const [activeModes, setActiveModes] = useState<Record<string, string>>({
        'minimax': 'minimax2',   // Seedream 4.5
        'Imagen': 'Imagen2',     // Nano Banana
        'fluxUltra': 'Imagen',   // Nano Banana 2.1
        'Gpt Image': activeModelName === GPT_IMAGE_25_SUNBURST
            ? GPT_IMAGE_25_SUNBURST
            : GPT_IMAGE_25_FLARE,
    });

    useEffect(() => {
        if (
            activeModelName === GPT_IMAGE_25_SUNBURST ||
            activeModelName === GPT_IMAGE_25_FLARE
        ) {
            setActiveModes((previous) =>
                previous['Gpt Image'] === activeModelName
                    ? previous
                    : { ...previous, 'Gpt Image': activeModelName }
            );
        }
    }, [activeModelName]);

    const sets = useSelector((state: RootState) => state.imageModelExamples.sets);
    const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
    const [exampleManagerOpen, setExampleManagerOpen] = useState(false);
    const [examplePreviewIndex, setExamplePreviewIndex] = useState<number | null>(null);
    const wasOpen = useRef(false);
    useEffect(() => {
        if (!open) { wasOpen.current = false; setExampleManagerOpen(false); return; }
        const chooseNew = !wasOpen.current;
        wasOpen.current = true;
        setSelectedSetId(previous => chooseNew || !sets.some(set => set.id === previous)
            ? sets.length ? sets[Math.floor(Math.random() * sets.length)].id : null
            : previous);
    }, [open, sets]);
    const showAnotherExampleSet = () => {
        setSelectedSetId(previous => {
            const alternatives = sets.filter(set => set.id !== previous);
            return alternatives.length
                ? alternatives[Math.floor(Math.random() * alternatives.length)].id
                : previous;
        });
    };
    const modelImageMap = sets.find(set => set.id === selectedSetId)?.model_images || {};
    const examplePreviews = useMemo(() => {
        const images = sets.find(set => set.id === selectedSetId)?.model_images || {};
        return ACTIVE_IMAGE_MODEL_KEYS.filter(model => images[model]).map(model => ({
            model, name: getCreationImageModelName(model), url: images[model],
        }));
    }, [sets, selectedSetId]);
    useEffect(() => { setExamplePreviewIndex(null); }, [open, selectedSetId]);

    /**
     * Paired model cards. `top` is the headline option, `lite` the cheaper one.
     *
     * Internal model keys are UNCHANGED — only their grouping in the UI moved.
     * Nano Banana 2.1 (`Imagen`) is now displayed on the `fluxUltra` card next to
     * Nano Banana 2 Lite (`fluxUltra`), while Nano Banana Pro (`fluxUltra2`) and
     * Nano Banana (`Imagen2`) stay on the `Imagen` card. Routing and pricing
     * still key off the model name, so saved nodes are unaffected.
     *
     * This replaces the old "card name + 2" convention, which could not express
     * the mapping (the `fluxUltra` card's lite option is `fluxUltra`, not
     * `fluxUltra2` — that key is Nano Banana Pro).
     */
    /** Pro tier marker. Red in dark mode, vibrant yellow #E69500 in light mode. */
    const PRO_COLOR = darkMode ? "#e53935" : "#E69500";

    const FAMILY: Record<string, { top: string; lite: string; topLabel: string; liteLabel?: string }> = {
        'Imagen': { top: 'fluxUltra2', lite: 'Imagen2', topLabel: 'Pro' },   // Nano Banana Pro / Nano Banana
        'Gpt Image': { top: GPT_IMAGE_25_SUNBURST, lite: GPT_IMAGE_25_FLARE, topLabel: 'Pro', liteLabel: 'Fast' },
        'fluxUltra': { top: 'Imagen', lite: 'fluxUltra', topLabel: 'HD' },   // Nano Banana 2.1 / Nano Banana 2 Lite
        'minimax': { top: 'minimax', lite: 'minimax2', topLabel: 'Pro' },    // Seedream 5 Pro / Seedream 4.5
    };

    /** Internal model key -> label shown to the user. */
    const DISPLAY_NAME: Record<string, string> = {
        fluxUltra2: 'Nano Banana Pro',
        Imagen2: 'Nano Banana',
        Imagen: 'Nano Banana 2.1',
        fluxUltra: 'Nano Banana 2 Lite',
        'Gpt Image': 'GPT Image',
        [GPT_IMAGE_25_SUNBURST]: 'GPT Image 2.6',
        [GPT_IMAGE_25_FLARE]: 'GPT Image 2.6',
        minimax: 'Seedream 5 Pro',
        minimax2: 'Seedream 4.5',
        Schnell: 'Klein',
    };

    const isLiteCapable = (name: string) => name in FAMILY;
    const getModelImage = (name: string) => modelImageMap[name] || '';

    useCreationControls('models', 'ModelSelectionModal', open, { languageModel,
        activeModelDisplayName: getCreationImageModelName(activeModelName || ''), costInfoOpen }, controlOwnerRef);
    return (
        <ThemeProvider theme={modalTheme}>
        <Modal
            ref={controlOwnerRef}
            className="social-panel-container"
            sx={overlayZIndex === undefined ? undefined : { zIndex: overlayZIndex }}
            open={open}
            onClose={() => setOpen(false)}
            disableEnforceFocus
            closeAfterTransition
            BackdropProps={{
                className: 'social-panel-backdrop',
                ...cb('models', 'dismiss', 'Dismiss model picker', 'Modal.onClose'),
                ...{ 'data-creation-hit-region': 'self' },
                'aria-hidden': false,
            }}
        >
            <Box className={`social-panel ${darkMode ? 'social-panel-dark' : ''}`}
                role="dialog" aria-modal="true" aria-labelledby="creation-model-picker-heading"
                style={{ '--chat-accent': appColor } as React.CSSProperties} sx={{ outline: 'none' }}>
                <header className="social-chat-header social-picker-header">
                    <h2 id="creation-model-picker-heading">Models</h2>
                    <IconButton
                        onClick={() => setOpen(false)}
                        {...cb('models', 'close', 'Close model picker', 'setOpen(false)')}
                        aria-label="Close model picker"
                    >
                        <CloseIcon />
                    </IconButton>
                </header>
                <Box {...cb('models', 'scroll', 'Scroll model picker', 'modelPicker.scrollBy', 'scroll')}
                    sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>

                <ConversationModelPicker darkMode={darkMode} matchMobile={matchMobile} appColor={appColor} showImages={false} />

                {/* ============================================================
                    CREATION AI — the model that WRITES the prompts.
                    Separate from the image models below; picking one here never
                    changes the image model and never closes this modal.
                   ============================================================ */}
                <Box sx={{ px: 2, pt: 2, pb: 1 }}>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            mb: 1,
                        }}
                    >
                        <Typography
                            sx={{
                                fontSize: 13,
                                fontWeight: 700,
                                letterSpacing: 0.5,
                                textTransform: 'uppercase',
                                color: darkMode ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.7)',
                            }}
                        >
                            Creation AI
                        </Typography>
                        <LanguageModelCostButton
                            appColor={appColor}
                            onClick={(event) => {
                                event.stopPropagation();
                                setCostInfoOpen(true);
                            }}
                        />
                    </Box>

                    <Box
                        className="social-picker-scroll"
                        {...cb('models', 'creation_scroll', 'Scroll Creation AI models', 'creationModels.scrollBy', 'scroll')}
                        sx={{
                            display: 'flex',
                            gap: 1.25,
                            overflowX: 'auto',
                            overflowY: 'hidden',
                            pb: 1,
                            WebkitOverflowScrolling: 'touch',
                            scrollSnapType: 'x proximity',
                        }}
                    >
                        {LANGUAGE_MODELS.filter((lm) => lm.id !== 'astra').map((lm) => {
                            const isActive = lm.id === languageModel;
                            return (
                                <Box
                                    key={lm.id}
                                    {...cb('models', `creation_${lm.id}`, `Creation AI ${lm.name}`, 'setLanguageModel')}
                                    component="button"
                                    type="button"
                                    aria-pressed={isActive}
                                    onClick={async (event: React.MouseEvent) => {
                                        // Must not bubble into the image-model
                                        // handlers and must not close the modal.
                                        event.stopPropagation();
                                        if (lm.id === 'luna' || lm.id === 'luna_extra' || lm.id === 'terra' || lm.id === 'sol_medium' || lm.id === 'sol' || lm.id === 'astra') {
                                            await notifyOpenAiSelected();
                                        }
                                        dispatch(setLanguageModel(lm.id as LanguageModelTier));
                                    }}
                                    sx={{
                                        flex: '0 0 auto',
                                        width: matchMobile ? 110 : 120,
                                        scrollSnapAlign: 'start',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        p: 0,
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        font: 'inherit',
                                        color: 'inherit',
                                        border: `2px solid ${isActive ? appColor : 'transparent'}`,
                                        background: isActive
                                            ? alpha(appColor, 0.14)
                                            : darkMode
                                                ? 'rgba(255,255,255,0.05)'
                                                : 'rgba(0,0,0,0.04)',
                                        boxShadow: isActive
                                            ? `0 0 12px ${alpha(appColor, 0.45)}`
                                            : 'none',
                                        transition: 'border-color .15s, background .15s, box-shadow .15s',
                                        '&:hover': {
                                            background: isActive
                                                ? alpha(appColor, 0.2)
                                                : darkMode
                                                    ? 'rgba(255,255,255,0.09)'
                                                    : 'rgba(0,0,0,0.07)',
                                        },
                                        '&:focus-visible': {
                                            outline: `2px solid ${appColor}`,
                                            outlineOffset: 2,
                                        },
                                    }}
                                >
                                    <Box
                                        component="img"
                                        src={lm.image}
                                        alt=""
                                        sx={{
                                            display: 'block',
                                            width: '100%',
                                            height: 57.6,
                                            objectFit: 'cover',
                                            filter: lm.imageFilter,
                                        }}
                                    />
                                    <Box sx={{ p: 0.75 }}>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                gap: 1,
                                            }}
                                        >
                                            <Typography
                                                sx={{
                                                    minWidth: 0,
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    fontSize: 11,
                                                    lineHeight: 1.15,
                                                    fontWeight: 700,
                                                    color: darkMode ? '#fff' : '#000',
                                                }}
                                            >
                                                {lm.name}
                                            </Typography>
                                            <Box
                                                sx={{
                                                    width: 10,
                                                    height: 10,
                                                    flex: '0 0 auto',
                                                    borderRadius: '50%',
                                                    border: `2px solid ${isActive
                                                        ? appColor
                                                        : darkMode
                                                            ? 'rgba(255,255,255,0.4)'
                                                            : 'rgba(0,0,0,0.3)'}`,
                                                    background: isActive ? appColor : 'transparent',
                                                }}
                                            />
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mt: 0.25, minWidth: 0 }}>
                                            <Typography sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, whiteSpace: 'nowrap', color: appColor }}>
                                                {lm.pixels}p
                                            </Typography>
                                            <Typography sx={{
                                                minWidth: 0,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                fontSize: 9,
                                                lineHeight: 1.2,
                                                color: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                                            }}>
                                                · {CREATION_CARD_WORDS[lm.id]}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>

                <Box sx={{ px: 2, pt: 1.5, pb: 0.5, display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    <Tooltip placement="top-start" title={sets.length > 1 ? 'Show another image set' : sets.length ? 'Only one image set available' : 'No image sets available'}>
                        <span style={{ display: 'inline-flex', cursor: 'pointer' }}>
                            <ButtonBase aria-label="Show another image set"
                                disabled={sets.length < 2} onClick={showAnotherExampleSet}
                                sx={{ color: appColor, py: 0.5, gap: 0.5, borderRadius: 1, cursor: 'pointer',
                                    '&:focus': { outline: 'none' },
                                    '&:focus-visible': { outline: `2px solid ${appColor}`, outlineOffset: 2 } }}>
                                <Typography component="span" sx={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    letterSpacing: 0.5,
                                    textTransform: 'uppercase',
                                    color: darkMode ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.7)',
                                }}>
                                    Image model
                                </Typography>
                                <AutoFixHighIcon sx={{ fontSize: 18 }} />
                            </ButtonBase>
                        </span>
                    </Tooltip>
                    {import.meta.env.VITE_APPX_STATE === 'dev' && <Button size="small" onClick={() => setExampleManagerOpen(true)} sx={{ ml: 1 }}>Example sets</Button>}
                </Box>

                <LanguageModelCostInfo
                    open={costInfoOpen}
                    onClose={() => setCostInfoOpen(false)}
                    tier={languageModel}
                    sceneCount={sceneCount}
                    cinemaMode={cinemaMode}
                    darkMode={darkMode}
                />

                {models.map((m, index) => {
                    const hasToggle = isLiteCapable(m.name);
                    const selectedModelName = hasToggle ? activeModes[m.name] : m.name;

                    return (
                        <Box
                            key={m.name}
                            {...cb('models', `image_${m.name}`, `Image model ${getCreationImageModelName(selectedModelName)}`, 'handleSelect')}
                            onClick={() => handleSelect(selectedModelName, getModelImage(selectedModelName))}
                            sx={{
                                display: 'flex',
                                width: 'auto',
                                p: matchMobile ? 1 : 1,
                                flex: 1,
                                alignItems: 'center',
                                cursor: 'pointer',

                                paddingLeft: matchMobile ? '12px' : '32px',
                                paddingTop: index === 0 ? '24px' : '8px',
                                paddingBottom: '24px',
                            }}
                        >
                            <Box sx={{ position: 'relative', flexShrink: 0, width: matchMobile ? 'min(31vw, 13dvh)' : 'min(18dvh, 150px)',
                                '@media (hover: hover)': { '&:hover .model-example-zoom-icon': { opacity: 1 } } }}>
                            <Box
                                component={getModelImage(selectedModelName) ? "img" : "div"}
                                src={getModelImage(selectedModelName) || undefined}
                                alt={m.name}
                                sx={{
                                    borderRadius: 2,
                                    height: "auto",
                                    aspectRatio: getModelImage(selectedModelName) ? undefined : "9 / 16",
                                    width: '100%',
                                    display: 'block',
                                    boxSizing: 'border-box',
                                    objectFit: "cover",
                                    objectPosition: "top",
                                    flexShrink: 0,
                                    border: activeModelName === selectedModelName
                                        ? `3px solid ${appColor}`
                                        : "3px solid transparent",
                                    boxShadow: activeModelName === selectedModelName
                                        ? `0 0 0 2px ${alpha(appColor, 0.24)}`
                                        : "none",
                                }}
                            />
                            {getModelImage(selectedModelName) && <Box component="button" type="button"
                                aria-label={`Zoom ${getCreationImageModelName(selectedModelName)} example`}
                                onClick={event => {
                                    event.stopPropagation();
                                    const previewIndex = examplePreviews.findIndex(item => item.model === selectedModelName);
                                    if (previewIndex >= 0) setExamplePreviewIndex(previewIndex);
                                }}
                                sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '30%', minHeight: 44,
                                    border: 0, p: 0, background: 'transparent', borderRadius: '8px 8px 0 0', cursor: 'zoom-in',
                                    '&:focus': { outline: 'none' },
                                    '&:focus-visible': { outline: `2px solid ${appColor}`, outlineOffset: 2 },
                                    '&:focus-visible .model-example-zoom-icon, &:active .model-example-zoom-icon': { opacity: 1 } }}>
                                <Box className="model-example-zoom-icon" sx={{ position: 'absolute', top: 8, right: 8,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34,
                                    borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', opacity: 0,
                                    transition: 'opacity 140ms ease', pointerEvents: 'none' }}>
                                    <ZoomInIcon fontSize="small" />
                                </Box>
                            </Box>}
                            </Box>

                            <Typography
                                component="div"
                                variant={matchMobile ? "body1" : "h6"}
                                sx={{
                                    ml: 2,
                                    fontWeight: matchMobile ? 450 : 300,
                                    flexGrow: 1,
                                    // "capitalize" would render "GPT Image" as "Gpt Image".
                                    textTransform: "none",
                                    color: darkMode ? "#fff" : "#111",
                                    textAlign: 'center',
                                }}
                            >
                                <span>
                                    {DISPLAY_NAME[selectedModelName] ?? m.name}

                                    <span style={{ opacity: 1 }}>
                                        {' '}
                                        {index === 40 ? "🌙" :
                                            index === 30 ? "🌙" :
                                                index === 20 ? "🌤️" :
                                                    index === 10 ? "☀️" :
                                                        index === 6000 ? "💥" : " "}
                                    </span>

                                    <span style={{ background: gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                                        {labelsByIndex[index] ? (
                                            <span style={{
                                                opacity: 1,
                                                color: colorsByLabel[labelsByIndex[index]],
                                                textShadow: `0px 1px 2px rgba(0, 0, 0, 0.52), 0px 2px 4px rgba(0, 0, 0, 0.38)`,
                                                WebkitTextFillColor: "currentColor",
                                                fontSize: "0.85em",
                                            }}>
                                                {" "}{labelsByIndex[index]}
                                            </span>
                                        ) : null}
                                    </span>

                                    <Typography
                                        variant="h5"
                                        sx={{
                                            color: 'white',
                                            fontWeight: '900',
                                            textAlign: 'center',
                                            WebkitBackgroundClip: "text",
                                            textShadow: `0px 1px 2px rgba(0, 0, 0, 0.12), 0px 2px 4px rgba(0, 0, 0, 0.08)`,
                                            WebkitTextFillColor: "transparent",
                                        }}
                                    >
                                        <ModelPixels model={selectedModelName} baseImagesPerDollar={333} />
                                    </Typography>

                                    {/* --- PRO / LITE SWITCHER (optimized sizing mobile + desktop, exact props kept) --- */}
                                    {hasToggle && (
                                        <Stack
                                            direction="row"
                                            spacing={matchMobile ? 0.75 : 1}
                                            justifyContent="center"
                                            sx={{ mt: 0.5 }}
                                        >
                                            <Button
                                                size="small"
                                                variant={activeModes[m.name] === FAMILY[m.name].top ? "contained" : "outlined"}
                                                {...cb('models', `pro_${m.name}`, `Select ${getCreationImageModelName(FAMILY[m.name].top)}`, 'updateModelWithoutClosing')}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveModes(prev => ({ ...prev, [m.name]: FAMILY[m.name].top }));
                                                    updateModelWithoutClosing?.(FAMILY[m.name].top, getModelImage(FAMILY[m.name].top));
                                                }}
                                                sx={{
                                                    fontSize: matchMobile ? '0.7rem' : '0.8rem',
                                                    padding: matchMobile ? '6px 10px' : '6px 12px',
                                                    minWidth: matchMobile ? '56px' : '72px',
                                                    height: matchMobile ? '32px' : '34px',
                                                    lineHeight: 1,
                                                    fontWeight: 800,
                                                    borderRadius: '10px',
                                                    // Pro reads as red in dark mode and vibrant yellow in light mode
                                                    backgroundColor: activeModes[m.name] === FAMILY[m.name].top
                                                        ? PRO_COLOR
                                                        : "transparent",
                                                    color: activeModes[m.name] === FAMILY[m.name].top
                                                        ? "#fff"
                                                        : (darkMode ? PRO_COLOR : "rgba(0,0,0,0.7)"),
                                                    borderColor: activeModes[m.name] === FAMILY[m.name].top
                                                        ? PRO_COLOR
                                                        : (darkMode ? PRO_COLOR : "rgba(0,0,0,0.25)"),
                                                    '&:hover': {
                                                        borderColor: PRO_COLOR,
                                                        backgroundColor:
                                                            activeModes[m.name] === FAMILY[m.name].top
                                                                ? PRO_COLOR
                                                                : alpha(PRO_COLOR, 0.12)
                                                    }
                                                }}
                                            >
                                                {FAMILY[m.name].topLabel}
                                            </Button>

                                            <Button
                                                size="small"
                                                variant={activeModes[m.name] === FAMILY[m.name].lite ? "contained" : "outlined"}
                                                {...cb('models', `lite_${m.name}`, `Select ${getCreationImageModelName(FAMILY[m.name].lite)}`, 'updateModelWithoutClosing')}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveModes(prev => ({ ...prev, [m.name]: FAMILY[m.name].lite }));
                                                    updateModelWithoutClosing?.(FAMILY[m.name].lite, getModelImage(FAMILY[m.name].lite));
                                                }}
                                                sx={{
                                                    fontSize: matchMobile ? '0.7rem' : '0.8rem',
                                                    padding: matchMobile ? '6px 10px' : '6px 12px',
                                                    minWidth: matchMobile ? '56px' : '72px',
                                                    height: matchMobile ? '32px' : '34px',
                                                    lineHeight: 1,
                                                    fontWeight: 800,
                                                    borderRadius: '10px',
                                                    backgroundColor: activeModes[m.name] === FAMILY[m.name].lite
                                                        ? appColor
                                                        : "transparent",
                                                    color: activeModes[m.name] === FAMILY[m.name].lite
                                                        ? appAccentForeground(darkMode)
                                                        : (darkMode ? appColor : "rgba(0,0,0,0.7)"),
                                                    borderColor: activeModes[m.name] === FAMILY[m.name].lite
                                                        ? appColor
                                                        : (darkMode ? appColor : "rgba(0,0,0,0.25)"),
                                                    '&:hover': {
                                                        borderColor: appColor,
                                                        backgroundColor:
                                                            activeModes[m.name] === FAMILY[m.name].lite
                                                                ? appColor
                                                                : alpha(appColor, 0.12)
                                                    }
                                                }}
                                            >
                                                {FAMILY[m.name].liteLabel ?? 'Lite'}
                                            </Button>
                                        </Stack>
                                    )}
                                </span>
                            </Typography>
                        </Box>
                    );
                })}
                </Box>
            </Box>
        </Modal >
        <ImageModelExampleViewer overlayZIndex={overlayZIndex === undefined ? undefined : overlayZIndex + 1} open={open && examplePreviewIndex !== null} items={examplePreviews}
            index={examplePreviewIndex ?? 0} onIndexChange={setExamplePreviewIndex} onClose={() => setExamplePreviewIndex(null)} />
        {import.meta.env.VITE_APPX_STATE === 'dev' && <ImageModelExampleSetManager open={exampleManagerOpen && open} onClose={() => setExampleManagerOpen(false)} darkMode={darkMode} />}
        </ThemeProvider>
    );
};

export default ModelSelectionModal;
import { creationBinding as cb } from './creationControlSnapshot';
import { useCreationControls } from './useCreationControls';
