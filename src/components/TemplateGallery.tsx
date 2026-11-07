// src/components/TemplateGallery.tsx
import React, { useState, useMemo, useCallback, useRef, useEffect, useLayoutEffect, useImperativeHandle } from 'react';
import {
    Alert,
    Box,
    IconButton,
    Typography,
    Card,
    CardContent,
    CardMedia,
    Grid,
    Button,
    Modal,
    Snackbar,
    Tooltip,
    TextField,
    CircularProgress,
    Chip,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
} from '@mui/material';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import AddIcon from '@mui/icons-material/Add';
import ImageIcon from '@mui/icons-material/Image';
import DeleteIcon from '@mui/icons-material/Delete';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAdded';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import PsychologyIcon from '@mui/icons-material/Psychology';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import EditIcon from '@mui/icons-material/Edit';
import axios from 'axios';
import { ShowcaseMode, Template } from '../PromptConstructorMock';
import { distillCoverArtPromptRuleBased } from '../utils/templatePromptDeduction';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import {
    ASSIGNABLE_TEMPLATE_CATEGORIES,
    TemplateCategory,
    inferTemplateCategory,
    unpackTemplateMeta,
} from '../templateCatalog';
import { creationBinding as cb } from '../creationControlSnapshot';
import { useCreationControls } from '../useCreationControls';
import { createTemplateHistory } from '../templateHistory';
import { TEMPLATE_COVER_MODELS, type TemplateCoverQuality } from '../../server/src/templateCoverModels';
import { getImageModelPixelCost } from '../imageModels';
import { createTemplateOrdering } from '../templateOrdering';

export const TEMPLATE_LIBRARY_Z_INDEX = 2147483000;
const CLIK_URL = import.meta.env.VITE_CLIK_URL;
const templateCoverKey = (template: Template) => template.presetKey || template.id;
const DEFAULT_PLACEHOLDER_THUMB = 'clikbatebucket.s3.us-east-1.amazonaws.com/clik-bg.png';

export function hasRealTemplateImage(url?: string | null): boolean {
    const clean = String(url || '').trim();
    if (!clean) return false;
    if (clean.includes(DEFAULT_PLACEHOLDER_THUMB)) return false;
    return true;
}

interface TemplateGalleryProps {
    templates: Template[];
    viewMode: 'horizontal' | 'vertical';
    setViewMode: (mode: 'horizontal' | 'vertical') => void;
    activeTemplateId: string | null;
    handleTemplateSelect: (template: Template) => void;
    previewImage: string | null;
    handleShowPreview: () => void;
    setMode: (mode: 'template' | 'brainstorm' | 'preview') => void;
    setChatHistory: (history: any[]) => void;
    darkMode: boolean;
    appColor: string;
    appColorHover: string;
    glassStyle: any;
    // PAGINATION
    onFetchMore?: () => void;
    hasMore?: boolean;
    onDeleteTemplate?: (template: Template) => void;
}

export const TemplateGallery = React.memo<TemplateGalleryProps>(({
    templates, viewMode, setViewMode, activeTemplateId, handleTemplateSelect,
    previewImage, handleShowPreview, setMode, darkMode, glassStyle,
    onFetchMore, hasMore, onDeleteTemplate
}) => {
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);
    return (
        <Box sx={{ background: 'transparent', p: 0, height: '100%', boxSizing: 'border-box' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5, position: 'relative', minHeight: '20px' }}>
                <Box sx={{ display: 'flex', gap: 1, position: 'absolute', right: 0 }}>
                    {previewImage && (
                        <IconButton
                            onClick={handleShowPreview}
                            size="small"
                            sx={{
                                width: 32,
                                height: 32,
                                bgcolor: 'rgba(255,255,255,0.15)',
                                color: '#fff',
                                '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
                            }}
                        >
                            <ImageIcon fontSize="small" />
                        </IconButton>
                    )}
                    <IconButton
                        onClick={() => setViewMode(viewMode === 'horizontal' ? 'vertical' : 'horizontal')}
                        size="small"
                        sx={{
                            width: 32,
                            height: 32,
                            bgcolor: 'rgba(255,255,255,0.15)',
                            color: '#fff',
                            '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }
                        }}
                    >
                        {viewMode === 'horizontal' ? <GridViewIcon fontSize="small" /> : <ViewListIcon fontSize="small" />}
                    </IconButton>
                </Box>
            </Box>

            {viewMode === 'horizontal' ? (
                <Box sx={{
                    display: 'flex', overflowX: 'auto', gap: 2, pb: 0.5, pt: 0, px: 0.5,
                    scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
                    alignItems: 'center', height: '125px'
                }}
                    onScroll={(e) => {
                        const target = e.currentTarget;
                        if (target.scrollWidth - target.scrollLeft <= target.clientWidth + 100) {
                            if (hasMore && onFetchMore) onFetchMore();
                        }
                    }}
                >
                    <Card
                        onClick={() => setMode('brainstorm')}
                        sx={{
                            minWidth: 100, width: 100, height: 115, flexShrink: 0, cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            ...glassStyle,
                            border: '2px dashed rgba(255,255,255,0.4)', borderRadius: 3,
                            transition: 'all 0.2s ease',
                            '&:hover': {
                                transform: 'translateY(-4px)',
                                borderColor: '#fff',
                                bgcolor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.3)'
                            }
                        }}
                    >
                        <AddIcon sx={{ fontSize: 32, color: '#fff', mb: 0.5 }} />
                        <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, textAlign: 'center', px: 1, lineHeight: 1.1 }}>
                            Custom / New
                        </Typography>
                    </Card>

                    {templates.map(template => {
                        const isSelected = activeTemplateId === template.id;
                        const canDelete = Boolean(
                            onDeleteTemplate &&
                            !String(template.id).startsWith('seed-') &&
                            ((import.meta.env.DEV) || (loggedUser && Number(loggedUser.id) !== 1 && Number(template.userId) === Number(loggedUser.id)))
                        );
                        return (
                            <Card
                                key={template.id}
                                onClick={() => handleTemplateSelect(template)}
                                sx={{
                                    minWidth: 100, width: 100, height: 115, flexShrink: 0, cursor: 'pointer',
                                    borderRadius: 3, position: 'relative', overflow: 'hidden',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    border: isSelected ? `3px solid #fff` : '1px solid rgba(255,255,255,0.2)',
                                    transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                                    boxShadow: isSelected ? `0 8px 20px rgba(0,0,0,0.4)` : '0 4px 10px rgba(0,0,0,0.15)',
                                    '&:hover': { transform: 'scale(1.05)' }
                                }}
                            >
                                {hasRealTemplateImage(template.thumbnailUrl) ? (
                                    <CardMedia
                                        component="img"
                                        image={template.thumbnailUrl}
                                        alt={template.name}
                                        sx={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.85)' }}
                                    />
                                ) : (
                                    <Box sx={{
                                        width: '100%', height: '100%',
                                        background: 'linear-gradient(145deg, rgba(30,32,42,0.95), rgba(16,18,24,0.98))',
                                    }} />
                                )}
                                {canDelete && (
                                    <IconButton
                                        data-ai-snapshot-ignore="true"
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDeleteTemplate?.(template);
                                        }}
                                        sx={{
                                            position: 'absolute',
                                            top: 4,
                                            right: 4,
                                            bgcolor: 'rgba(0,0,0,0.6)',
                                            color: '#ff4444',
                                            padding: '2px',
                                            '&:hover': { bgcolor: 'rgba(0,0,0,0.8)', color: '#ff0000' }
                                        }}
                                    >
                                        <DeleteIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                )}
                                <Box sx={{
                                    position: 'absolute', bottom: 0, left: 0, right: 0,
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 70%, transparent 100%)',
                                    p: 1, pt: 2, display: 'flex', alignItems: 'flex-end', height: '60%'
                                }}>
                                    <Typography variant="caption" sx={{
                                        color: '#fff', fontWeight: 700, lineHeight: 1.1, fontSize: '0.7rem',
                                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                        textShadow: '0 1px 2px rgba(0,0,0,0.8)'
                                    }}>
                                        {template.name}
                                    </Typography>
                                </Box>
                            </Card>
                        );
                    })}
                </Box>
            ) : (
                <Box sx={{
                    maxHeight: '220px', overflowY: 'auto', pr: 1, pt: 0,
                    scrollbarWidth: 'thin',
                    '&::-webkit-scrollbar': { width: '6px' },
                    '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: '4px' }
                }}
                    onScroll={(e) => {
                        const target = e.currentTarget;
                        if (target.scrollHeight - target.scrollTop <= target.clientHeight + 50) {
                            if (hasMore && onFetchMore) onFetchMore();
                        }
                    }}
                >
                    <Grid container spacing={1.5}>
                        {templates.map(template => {
                            const isSelected = activeTemplateId === template.id;
                            return (
                                <Grid item xs={6} sm={4} key={template.id}>
                                    <Card
                                        onClick={() => handleTemplateSelect(template)}
                                        sx={{
                                            display: 'flex', alignItems: 'center', p: 1, cursor: 'pointer',
                                            borderRadius: 2, height: 64, boxSizing: 'border-box',
                                            ...glassStyle,
                                            bgcolor: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)',
                                            border: isSelected ? `2px solid #fff` : '1px solid rgba(255,255,255,0.15)',
                                            transition: 'all 0.2s', position: 'relative',
                                            '&:hover': { transform: 'translateY(-2px)', bgcolor: 'rgba(255,255,255,0.15)' }
                                        }}
                                    >
                                        <CardContent sx={{ p: '0 !important', pl: 1, overflow: 'hidden', flex: 1 }}>
                                            <Typography variant="body2" noWrap sx={{ fontWeight: 700, color: '#fff', fontSize: '0.8rem' }}>
                                                {template.name}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            );
                        })}
                    </Grid>
                </Box>
            )}
        </Box>
    );
});

export interface TemplateLibraryProps {
    templates: Template[];
    activeTemplateId: string | null;
    handleTemplateSelect: (template: Template) => void;
    darkMode: boolean;
    appColor: string;
    appColorHover: string;
    onClose: () => void;
    onFetchMore?: () => void;
    hasMore?: boolean;
    onDeleteTemplate?: (template: Template) => void;
    onToggleShowcase?: (template: Template, mode: ShowcaseMode) => Promise<void>;
    onTemplateCreated?: () => void;
    onOpenBrainstorm?: (params?: { isAIEnabled?: boolean; view?: 'chat' | 'finalize'; title?: string; prompt?: string; artStyle?: string }) => void;
    standalone?: boolean;
}

/**
 * Clean, professional Template Gallery & Story Seeds Explorer:
 * - Default View: Stacked horizontal category sliders (`Library` at the very top, followed by each category).
 * - Each horizontal slider has left/right navigation arrows and an `Expand` button that switches that category into a full vertical grid (with a `Back to Categories` button to return).
 * - Every card has a direct `Use` button, a `+ Library` / `In Library` database toggle, a readable prompt preview, and `Generate (1p)` / `+` Re-generate `(1p)` using 1p Flux Klein (`/fluxschnell`).
 * - Clicking any card opens the Template Detail View: Image on top (clicking the image opens a Fullscreen Image Zoom modal), full scrollable prompt text below, and a `Use Template` button.
 * - Delete (`🗑️`) is strictly restricted to `import.meta.env.DEV` for official templates (or a logged-in user's own custom templates) with `data-ai-snapshot-ignore="true"`.
 */
export type TemplateLibraryHandle = {
    handleBackOrClose: () => boolean;
};

export const TemplateLibrary = React.memo(
    React.forwardRef<TemplateLibraryHandle, TemplateLibraryProps>((props, ref) => {
        const {
            templates,
            activeTemplateId,
            handleTemplateSelect,
            darkMode,
            appColor,
            appColorHover,
            onClose,
            onDeleteTemplate,
            onTemplateCreated,
            onOpenBrainstorm,
            standalone = false,
        } = props;
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);
    const currentArtStyle = useSelector((state: RootState) => state.settings.artstyle);

    const surfaceBg = darkMode
        ? standalone
            ? 'rgba(14, 15, 20, 0.97)'
            : 'rgba(18, 18, 22, 0.94)'
        : standalone
        ? 'rgba(248, 249, 252, 0.98)'
        : 'rgba(245, 246, 250, 0.95)';
    const textColor = darkMode ? '#ffffff' : '#111318';
    const mutedTextColor = darkMode ? 'rgba(255,255,255,0.68)' : 'rgba(17,19,24,0.64)';
    const subtleBorder = darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(17,19,24,0.1)';
    const accentButtonTextColor = darkMode ? '#000000' : '#ffffff';

    // Category changing & inline prompt editing states
    const [categoryMenuAnchor, setCategoryMenuAnchor] = useState<HTMLElement | null>(null);
    const [isChangingCategory, setIsChangingCategory] = useState(false);
    const [isEditingPrompt, setIsEditingPrompt] = useState(false);
    const [editingTitle, setEditingTitle] = useState('');
    const [editingPromptText, setEditingPromptText] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // Null = stacked horizontal category sliders; non-null = expanded vertical grid for that category
    const [expandedCategory, setExpandedCategory] = useState<TemplateCategory | null>(null);
    // Detail View state when a user clicks a card to inspect its image & full prompt text
    const [detailTemplateId, setDetailTemplateId] = useState<string | null>(null);
    useEffect(() => {
        setIsEditingPrompt(false);
        setCategoryMenuAnchor(null);
    }, [detailTemplateId]);
    // Fullscreen image zoom modal state
    const [fullScreenImage, setFullScreenImage] = useState<{ url: string; title: string } | null>(null);
    // Card image re-generate anchor menu (HD 6p / SD 1p) for zoomed detail view
    const [cardMenuAnchor, setCardMenuAnchor] = useState<{ el: HTMLElement; template: Template } | null>(null);

    // Inside-card overlays state
    const [cardDeleteConfirmId, setCardDeleteConfirmId] = useState<string | null>(null);
    const [cardGenerateOptionId, setCardGenerateOptionId] = useState<string | null>(null);

    const cardDeleteConfirmIdRef = useRef<string | null>(cardDeleteConfirmId);
    useEffect(() => {
        cardDeleteConfirmIdRef.current = cardDeleteConfirmId;
    }, [cardDeleteConfirmId]);

    const cardGenerateOptionIdRef = useRef<string | null>(cardGenerateOptionId);
    useEffect(() => {
        cardGenerateOptionIdRef.current = cardGenerateOptionId;
    }, [cardGenerateOptionId]);

    // AI Auto Template generation state & inspection modal
    const [aiGeneratedTemplate, setAiGeneratedTemplate] = useState<{
        id: string;
        title: string;
        prompt: string;
        artStyle: string;
        category: TemplateCategory;
        isSaved?: boolean;
        sourceTemplateName?: string;
    } | null>(null);
    const [isGeneratingAiTemplate, setIsGeneratingAiTemplate] = useState(false);
    const [isSavingAiTemplate, setIsSavingAiTemplate] = useState(false);
    const [libraryAiGuidance, setLibraryAiGuidance] = useState('');
    const [detailRemixGuidance, setDetailRemixGuidance] = useState('');
    const [isRemixingDetail, setIsRemixingDetail] = useState(false);
    const [isFetchingMore, setIsFetchingMore] = useState(false);

    // Detail View scroll container ref to enforce starting from top
    const detailScrollRef = useRef<HTMLDivElement | null>(null);

    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const generatingTemplateIdsRef = useRef(new Set<string>());
    const coverBatchChangedRef = useRef(false);
    const coverIntervalsRef = useRef(new Map<string, number>());
    const busyRef = useRef(false);
    busyRef.current = Boolean(generatingTemplateIdsRef.current.size || isGeneratingAiTemplate || isRemixingDetail || isSavingAiTemplate);
    type LibraryView = {
        expandedCategory: TemplateCategory | null;
        detailTemplateId: string | null;
        fullScreenImage: { url: string; title: string } | null;
        aiGeneratedTemplate: typeof aiGeneratedTemplate;
    };
    const viewRef = useRef<LibraryView>({ expandedCategory, detailTemplateId, fullScreenImage, aiGeneratedTemplate });
    const historyRef = useRef<ReturnType<typeof createTemplateHistory<LibraryView>> | null>(null);
    const restoreView = useCallback((view: LibraryView) => {
        viewRef.current = view;
        setExpandedCategory(view.expandedCategory);
        setDetailTemplateId(view.detailTemplateId);
        setFullScreenImage(view.fullScreenImage);
        setAiGeneratedTemplate(view.aiGeneratedTemplate);
    }, []);
    useLayoutEffect(() => {
        let cancelled = false;
        // StrictMode's discarded first mount must not push a phantom entry.
        queueMicrotask(() => {
            if (!cancelled) historyRef.current = createTemplateHistory(window, viewRef.current, {
                restore: restoreView, close: () => onCloseRef.current(), busy: () => busyRef.current,
            });
        });
        return () => { cancelled = true; historyRef.current?.dispose(); historyRef.current = null; };
    }, [restoreView]);
    const pushView = useCallback((patch: Partial<LibraryView>) => {
        historyRef.current?.push({ ...viewRef.current, ...patch });
    }, []);
    useLayoutEffect(() => {
        viewRef.current = { expandedCategory, detailTemplateId, fullScreenImage, aiGeneratedTemplate };
        historyRef.current?.replace(viewRef.current);
    }, [expandedCategory, detailTemplateId, fullScreenImage, aiGeneratedTemplate]);
    useLayoutEffect(() => {
        if (detailTemplateId && detailScrollRef.current) detailScrollRef.current.scrollTop = 0;
        setIsEditingPrompt(false);
        setCategoryMenuAnchor(null);
    }, [detailTemplateId]);
    const handleUiBack = useCallback(() => {
        if (cardDeleteConfirmIdRef.current) { setCardDeleteConfirmId(null); return; }
        if (cardGenerateOptionIdRef.current) { setCardGenerateOptionId(null); return; }
        historyRef.current?.back();
    }, []);
    const handleUiClose = useCallback((after?: () => void) => { historyRef.current?.close(after); }, []);
    useImperativeHandle(ref, () => ({ handleBackOrClose: () => { handleUiBack(); return true; } }), [handleUiBack]);
    useEffect(() => {
        const keydown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); handleUiBack(); }
        };
        window.addEventListener('keydown', keydown, true);
        return () => window.removeEventListener('keydown', keydown, true);
    }, [handleUiBack]);
    const openExpandedCategory = useCallback((cat: TemplateCategory) => pushView({ expandedCategory: cat }), [pushView]);
    const openDetailView = useCallback((id: string) => pushView({ detailTemplateId: id }), [pushView]);
    const openFullScreenImage = useCallback((image: { url: string; title: string }) => pushView({ fullScreenImage: image }), [pushView]);
    const applyTemplate = useCallback((template: Template) => {
        handleUiClose(() => handleTemplateSelect(template));
    }, [handleTemplateSelect, handleUiClose]);

    // Local overrides for newly generated 1p images, Library toggles, or newly created templates
    const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<Template>>>({});
    const [locallyCreatedTemplates, setLocallyCreatedTemplates] = useState<Template[]>([]);
    const [coverProgress, setCoverProgress] = useState<Record<string, number>>({});
    useEffect(() => () => {
        coverIntervalsRef.current.forEach(interval => window.clearInterval(interval));
        coverIntervalsRef.current.clear();
    }, []);
    const [togglingLibraryIds, setTogglingLibraryIds] = useState<Record<string, boolean>>({});

    const [feedback, setFeedback] = useState<{
        message: string;
        severity: 'success' | 'error' | 'info';
    } | null>(null);

    // Refs for each horizontal category row slider so left/right arrows scroll smoothly
    const rowSliderRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const rowPositionsRef = useRef<Record<string, number>>({});
    const rowCallbacksRef = useRef<Record<string, (node: HTMLDivElement | null) => void>>({});
    const rowRef = (category: string) => {
        if (!rowCallbacksRef.current[category]) rowCallbacksRef.current[category] = node => {
            const previous = rowSliderRefs.current[category];
            if (previous) rowPositionsRef.current[category] = previous.scrollLeft;
            rowSliderRefs.current[category] = node;
            if (node) node.scrollLeft = rowPositionsRef.current[category] || 0;
        };
        return rowCallbacksRef.current[category];
    };
    const baseScrollPositionRef = useRef(0);
    const baseScrollerNodeRef = useRef<HTMLDivElement | null>(null);
    const baseScrollerRef = useCallback((node: HTMLDivElement | null) => {
        if (baseScrollerNodeRef.current) baseScrollPositionRef.current = baseScrollerNodeRef.current.scrollTop;
        baseScrollerNodeRef.current = node;
        if (node) node.scrollTop = baseScrollPositionRef.current;
    }, []);
    const [rowScrollableMap, setRowScrollableMap] = useState<Record<string, boolean>>({});

    const updateRowScrollability = useCallback(() => {
        const nextMap: Record<string, boolean> = {};
        Object.entries(rowSliderRefs.current).forEach(([cat, el]) => {
            if (el) {
                nextMap[cat] = el.scrollWidth > el.clientWidth + 6;
            }
        });
        setRowScrollableMap((prev) => {
            const keys = Object.keys(nextMap);
            const changed = keys.some((k) => prev[k] !== nextMap[k]);
            return changed ? { ...prev, ...nextMap } : prev;
        });
    }, []);

    useLayoutEffect(() => {
        updateRowScrollability();
        const observers: ResizeObserver[] = [];
        Object.values(rowSliderRefs.current).forEach((el) => {
            if (el) {
                const ro = new ResizeObserver(() => updateRowScrollability());
                ro.observe(el);
                observers.push(ro);
            }
        });
        window.addEventListener('resize', updateRowScrollability);
        return () => {
            observers.forEach((o) => o.disconnect());
            window.removeEventListener('resize', updateRowScrollability);
        };
    }, [updateRowScrollability, locallyCreatedTemplates, localOverrides]);

    const scrollCategoryRow = useCallback((catKey: string, direction: 'left' | 'right') => {
        const el = rowSliderRefs.current[catKey];
        if (!el) return;
        const amount = Math.max(320, Math.round(el.clientWidth * 0.72));
        el.scrollBy({
            left: direction === 'left' ? -amount : amount,
            behavior: 'smooth',
        });
    }, []);

    // Prevent PC browser trackpad/wheel horizontal swipe from triggering browser history back/forward
    useEffect(() => {
        const handleSliderWheel = (e: WheelEvent) => {
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                const target = e.currentTarget as HTMLElement | null;
                if (!target) return;
                const atLeft = target.scrollLeft <= 0;
                const atRight = target.scrollLeft + target.clientWidth >= target.scrollWidth - 1;
                if ((atLeft && e.deltaX < 0) || (atRight && e.deltaX > 0)) {
                    e.preventDefault();
                } else {
                    target.scrollLeft += e.deltaX;
                    e.preventDefault();
                }
            }
        };

        const elements = Object.values(rowSliderRefs.current).filter(Boolean) as HTMLElement[];
        elements.forEach((el) => {
            el.addEventListener('wheel', handleSliderWheel, { passive: false });
        });

        return () => {
            elements.forEach((el) => {
                el.removeEventListener('wheel', handleSliderWheel);
            });
        };
    });

    // Normalize and merge all templates with local overrides
    const orderTemplatesRef = useRef<ReturnType<typeof createTemplateOrdering> | null>(null);
    if (!orderTemplatesRef.current) orderTemplatesRef.current = createTemplateOrdering(hasRealTemplateImage);
    const enrichedTemplates = useMemo<Template[]>(() => {
        const combined = [...locallyCreatedTemplates, ...templates];
        const seenIds = new Set<string>();
        const result: Template[] = [];

        for (const raw of combined) {
            if (!raw || seenIds.has(raw.id)) continue;
            seenIds.add(raw.id);

            const override = localOverrides[raw.id] || {};
            const unpacked = unpackTemplateMeta(
                raw.artStyle,
                raw.name || '',
                raw.basePrompt || ''
            );

            const resolvedCategory =
                (override.category as TemplateCategory) ||
                (raw.category as TemplateCategory) ||
                unpacked.category ||
                inferTemplateCategory(raw.name || '', raw.basePrompt || '', unpacked.artStyle);

            const resolvedInLibrary =
                typeof override.inLibrary === 'boolean'
                    ? override.inLibrary
                    : typeof raw.inLibrary === 'boolean'
                    ? raw.inLibrary
                    : false;

            const resolvedThumb =
                override.thumbnailUrl !== undefined
                    ? override.thumbnailUrl
                    : raw.thumbnailUrl || '';

            result.push({
                ...raw,
                ...override,
                artStyle: override.artStyle ?? (unpacked.artStyle || raw.artStyle || ''),
                category: resolvedCategory,
                inLibrary: resolvedInLibrary,
                thumbnailUrl: resolvedThumb,
                presetKey: override.presetKey || raw.presetKey || unpacked.presetKey,
            });
        }

        return orderTemplatesRef.current!(result);
    }, [templates, locallyCreatedTemplates, localOverrides]);

    const detailTemplate = useMemo(
        () => enrichedTemplates.find((t) => t.id === detailTemplateId) || null,
        [enrichedTemplates, detailTemplateId]
    );

    const libraryTemplates = useMemo(
        () => enrichedTemplates.filter((t) => Boolean(t.inLibrary)),
        [enrichedTemplates]
    );

    const templatesByCategory = useMemo(() => {
        const map: Record<string, Template[]> = {
            Library: libraryTemplates,
        };
        for (const cat of ASSIGNABLE_TEMPLATE_CATEGORIES) {
            map[cat] = enrichedTemplates.filter((t) => t.category === cat);
        }
        return map;
    }, [enrichedTemplates, libraryTemplates]);

    // ───────────────────────── TEMPLATE COVER ART GENERATOR (HD 6p / SD 1p) ─────────────────────────
    const handleGenerateTemplatePreview = useCallback(
        async (e: React.MouseEvent, template: Template, quality: TemplateCoverQuality = 'hd') => {
            e.stopPropagation();
            if (!loggedUser?.id) {
                setFeedback({ message: 'Please sign in first to generate a preview.', severity: 'error' });
                return;
            }
            const jobKey = templateCoverKey(template);
            if (generatingTemplateIdsRef.current.has(jobKey)) return;
            const isOwner = Boolean(import.meta.env.DEV) || (Number(loggedUser.id) !== 1 && Number(template.userId) === Number(loggedUser.id));
            if (quality === 'sd' && !isOwner) {
                setFeedback({ message: 'Shared cover contributions use HD or SD2. Only the author can choose SD.', severity: 'info' });
                return;
            }
            generatingTemplateIdsRef.current.add(jobKey);
            busyRef.current = true;

            const config = TEMPLATE_COVER_MODELS[quality];
            const cost = getImageModelPixelCost(config.model) ?? 1;
            const route = config.route;
            const modelName = config.label;

            setCoverProgress(prev => ({ ...prev, [jobKey]: 4 }));

            const interval = window.setInterval(() => {
                setCoverProgress(prev => {
                    const progress = prev[jobKey];
                    if (progress === undefined) return prev;
                    const next = progress < 35 ? progress + 4 : progress < 75 ? progress + 2 : Math.min(94, progress + 0.5);
                    return next === progress ? prev : { ...prev, [jobKey]: next };
                });
            }, 140);
            coverIntervalsRef.current.set(jobKey, interval);

            try {
                const previewPrompt = distillCoverArtPromptRuleBased(
                    template.basePrompt,
                    template.name,
                    template.artStyle
                );

                const payload = {
                    inputs: previewPrompt, width: 1920, height: 1080, size: '2K',
                    guidance: 7.5, num_inference_steps: config.steps,
                    seed: Math.floor(Math.random() * 10000000), ty: 3,
                    Png: true, linkmode: true, billingAction: 'brainstorm-image', model: config.model,
                };

                const imageRes = await axios.post<any>(
                    `${CLIK_URL}/${route}`,
                    { ...payload, templateCover: true, templateCoverTarget: template.presetKey || template.id },
                    { withCredentials: true }
                );

                const generatedUrl =
                    imageRes.data?.imageUrl ||
                    imageRes.data?.imageBase64 ||
                    imageRes.data?.image;

                if (!generatedUrl) {
                    throw new Error(`No image returned from ${modelName}`);
                }

                const finalPermanentUrl = generatedUrl;
                if (!imageRes.data?.coverReceipt) throw new Error('No verified cover receipt returned.');

                // Save image to templates4prompt in DB
                const numericId = Number(template.id);
                const saveRes = await axios.post<any>(
                    `${CLIK_URL}/update_template_image`,
                    {
                        id: Number.isInteger(numericId) && numericId > 0 ? numericId : undefined,
                        presetKey: template.presetKey,
                        userid: loggedUser.id,
                        title: template.name,
                        template_prompt: template.basePrompt,
                        template_image: finalPermanentUrl,
                        coverReceipt: imageRes.data.coverReceipt,
                        artstyle: template.artStyle || 'PhotoRealistic',
                        category: template.category,
                        inLibrary: Boolean(template.inLibrary),
                    },
                    { withCredentials: true }
                );

                window.clearInterval(interval);


                const persistedId = saveRes.data?.id ? String(saveRes.data.id) : template.id;
                setLocalOverrides((prev) => ({
                    ...prev,
                    [template.id]: {
                        ...prev[template.id],
                        id: persistedId,
                        thumbnailUrl: finalPermanentUrl,
                        coverQuality: quality,
                    },
                    [persistedId]: {
                        ...prev[persistedId],
                        id: persistedId,
                        thumbnailUrl: finalPermanentUrl,
                        coverQuality: quality,
                    },
                }));

                coverBatchChangedRef.current = true;
                setFeedback({
                    message: `${template.name}: cover generated (${cost}p)!`,
                    severity: 'success',
                });
            } catch (err: any) {
                window.clearInterval(interval);
                console.error('Template image generation error:', err);
                const msg = err?.response?.data?.message || err?.message || 'Preview generation failed.';
                setFeedback({ message: `${template.name}: ${msg}`, severity: 'error' });
            } finally {
                window.clearInterval(interval);
                coverIntervalsRef.current.delete(jobKey);
                generatingTemplateIdsRef.current.delete(jobKey);
                setCoverProgress(prev => {
                    const next = { ...prev }; delete next[jobKey]; return next;
                });
                // Successful covers update immediately through local overrides.
                // Refresh the shared cache once after the concurrent batch settles.
                if (!generatingTemplateIdsRef.current.size && coverBatchChangedRef.current) {
                    coverBatchChangedRef.current = false;
                    onTemplateCreated?.();
                }
            }
        },
        [loggedUser?.id, onTemplateCreated]
    );

    // ───────────────────────── PER-USER LIBRARY TOGGLE (DB-BACKED) ─────────────────────────
    const handleToggleInLibrary = useCallback(
        async (e: React.MouseEvent, template: Template) => {
            e.stopPropagation();
            if (!loggedUser?.id) return;

            const nextInLibrary = !template.inLibrary;
            setTogglingLibraryIds((prev) => ({ ...prev, [template.id]: true }));
            setLocalOverrides((prev) => ({
                ...prev,
                [template.id]: {
                    ...prev[template.id],
                    inLibrary: nextInLibrary,
                },
            }));

            try {
                let numericId = Number(template.id);
                // If this template was a local fallback seed not yet assigned a numeric DB id, ensure it exists in DB first
                if (!Number.isInteger(numericId) || numericId <= 0) {
                    const ensureRes = await axios.post<any>(
                        `${CLIK_URL}/update_template_image_prompt`,
                        {
                            presetKey: template.presetKey,
                            userid: loggedUser.id,
                            title: template.name,
                            template_prompt: template.basePrompt,
                            template_image: template.thumbnailUrl || '',
                            artstyle: template.artStyle || 'PhotoRealistic',
                            category: template.category,
                            inLibrary: false,
                        },
                        { withCredentials: true }
                    );
                    numericId = Number(ensureRes.data?.id);
                }

                if (Number.isInteger(numericId) && numericId > 0) {
                    await axios.post<any>(
                        `${CLIK_URL}/toggle_template_library`,
                        {
                            userid: loggedUser.id,
                            templateId: numericId,
                            inLibrary: nextInLibrary,
                        },
                        { withCredentials: true }
                    );
                }

                onTemplateCreated?.();
                setFeedback({
                    message: nextInLibrary
                        ? `Added "${template.name}" to your Library`
                        : `Removed "${template.name}" from your Library`,
                    severity: 'success',
                });
            } catch (err) {
                console.error('Failed to update Library status:', err);
                setLocalOverrides((prev) => ({
                    ...prev,
                    [template.id]: {
                        ...prev[template.id],
                        inLibrary: !nextInLibrary,
                    },
                }));
                setFeedback({
                    message: 'Could not update Library status',
                    severity: 'error',
                });
            } finally {
                setTogglingLibraryIds((prev) => ({ ...prev, [template.id]: false }));
            }
        },
        [loggedUser?.id, onTemplateCreated]
    );

    // ───────────────────────── AI AUTOMATIC TEMPLATE GENERATION (ON THE FLY) ─────────────────────────
    const handleGenerateAiTemplate = useCallback(async (customGuidance?: string) => {
        if (isGeneratingAiTemplate) return;
        setIsGeneratingAiTemplate(true);
        try {
            const guidanceToSend = typeof customGuidance === 'string'
                ? customGuidance.trim()
                : libraryAiGuidance.trim();
            const lowerGuidance = guidanceToSend.toLowerCase();

            // Explicit user guidance takes primary precedence over everything!
            let chosenMode: 'shorts' | 'games' | 'cinema' = 'shorts';
            if (lowerGuidance.includes('short') || lowerGuidance.includes('viral') || lowerGuidance.includes('reel') || lowerGuidance.includes('meme')) {
                chosenMode = 'shorts';
            } else if (lowerGuidance.includes('game') || lowerGuidance.includes('interactive') || lowerGuidance.includes('spatial') || lowerGuidance.includes('hotspot')) {
                chosenMode = 'games';
            } else if (lowerGuidance.includes('cinema') || lowerGuidance.includes('movie') || lowerGuidance.includes('film') || lowerGuidance.includes('lore')) {
                chosenMode = 'cinema';
            } else {
                const modes: Array<'shorts' | 'games' | 'cinema'> = ['shorts', 'games', 'cinema'];
                chosenMode = modes[Math.floor(Math.random() * modes.length)];
            }

            // Cost & token optimization: Send titles and categories ONLY (never full script prompts)
            const candidatePool = libraryTemplates.length > 0 ? libraryTemplates : enrichedTemplates;
            const shuffled = [...candidatePool].sort(() => 0.5 - Math.random());
            const sampleExamples = shuffled.slice(0, 8).map((t) => ({
                name: t.name,
                category: t.category,
            }));

            const res = await axios.post<any>(
                `${CLIK_URL}/examplestory`,
                {
                    mode: chosenMode,
                    templates: sampleExamples,
                    userText: guidanceToSend,
                },
                { withCredentials: true }
            );

            const promptText = res.data?.initialSteps?.keyPoints?.[0];
            if (typeof promptText !== 'string' || !promptText.trim()) {
                throw new Error('AI returned an empty story seed.');
            }

            const cleanPrompt = promptText.trim();
            // Synthesize short title from first sentence
            const firstSentence = cleanPrompt.split(/[.\n]/)[0].trim();
            const shortTitle = firstSentence.length > 50
                ? firstSentence.slice(0, 48) + '...'
                : firstSentence || 'AI Creative Seed';

            const categoryMap: Record<'shorts' | 'games' | 'cinema', TemplateCategory> = {
                shorts: 'Shorts & Viral',
                games: 'Interactive Games',
                cinema: 'Cinema & Lore',
            };

            const generated = {
                id: `ai-gen-${Date.now()}`,
                title: shortTitle,
                prompt: cleanPrompt,
                artStyle: currentArtStyle || 'PhotoRealistic',
                category: categoryMap[chosenMode] || 'Shorts & Viral',
                isSaved: false,
                sourceTemplateName: libraryTemplates.length > 0 ? 'Your Library Favorites' : undefined,
            };

            pushView({ aiGeneratedTemplate: generated });
        } catch (err: any) {
            setFeedback({
                message: err?.response?.data?.message || err?.message || 'Failed to generate AI template.',
                severity: 'error',
            });
        } finally {
            setIsGeneratingAiTemplate(false);
        }
    }, [isGeneratingAiTemplate, libraryTemplates, enrichedTemplates, libraryAiGuidance, currentArtStyle, pushView]);

    // ───────────────────────── CATEGORY CHANGER & SCRIPT EDITING ─────────────────────────
    const isDev = Boolean(import.meta.env.DEV);
    const isOwner = Boolean(loggedUser && Number(loggedUser.id) !== 1 && Number(detailTemplate?.userId) === Number(loggedUser.id));
    const canModifyDetail = Boolean(detailTemplate && (isDev || isOwner));

    const handleChangeCategory = async (newCat: TemplateCategory) => {
        if (!detailTemplate || isChangingCategory) return;
        setCategoryMenuAnchor(null);
        if (detailTemplate.category === newCat) return;
        setIsChangingCategory(true);
        try {
            await axios.post(
                `${CLIK_URL}/update_template_details`,
                { id: detailTemplate.id, category: newCat },
                { withCredentials: true }
            );
            setLocalOverrides((prev) => ({
                ...prev,
                [detailTemplate.id]: {
                    ...prev[detailTemplate.id],
                    category: newCat,
                },
            }));
            onTemplateCreated?.();
            setFeedback({ message: `Moved to "${newCat}"!`, severity: 'success' });
        } catch (err: any) {
            setFeedback({ message: err?.response?.data?.message || 'Failed to update category.', severity: 'error' });
        } finally {
            setIsChangingCategory(false);
        }
    };

    const handleStartEditing = () => {
        if (!detailTemplate) return;
        setEditingTitle(detailTemplate.name);
        setEditingPromptText(detailTemplate.basePrompt);
        setIsEditingPrompt(true);
    };

    const handleCancelEditing = () => {
        setIsEditingPrompt(false);
    };

    const handleSavePromptEdit = async () => {
        if (!detailTemplate || isSavingEdit) return;
        const cleanTitle = editingTitle.trim();
        const cleanPrompt = editingPromptText.trim();
        if (!cleanTitle) { setFeedback({ message: 'Title cannot be empty.', severity: 'error' }); return; }
        if (!cleanPrompt) { setFeedback({ message: 'Prompt cannot be empty.', severity: 'error' }); return; }
        setIsSavingEdit(true);
        try {
            await axios.post(
                `${CLIK_URL}/update_template_details`,
                { id: detailTemplate.id, title: cleanTitle, prompt: cleanPrompt },
                { withCredentials: true }
            );
            setLocalOverrides((prev) => ({
                ...prev,
                [detailTemplate.id]: {
                    ...prev[detailTemplate.id],
                    name: cleanTitle,
                    basePrompt: cleanPrompt,
                },
            }));
            onTemplateCreated?.();
            setIsEditingPrompt(false);
            setFeedback({ message: 'Template script updated successfully!', severity: 'success' });
        } catch (err: any) {
            setFeedback({ message: err?.response?.data?.message || 'Failed to update template.', severity: 'error' });
        } finally {
            setIsSavingEdit(false);
        }
    };

    // ───────────────────────── ASK AI REMIX FOR ZOOMED TEMPLATE (DETAIL VIEW) ─────────────────────────
    const handleRemixDetailTemplate = useCallback(
        async (template: Template, customGuidance?: string) => {
            if (isRemixingDetail) return;
            setIsRemixingDetail(true);
            try {
                const catLower = String(template.category || '').toLowerCase();
                const mode: 'shorts' | 'games' | 'cinema' = catLower.includes('game')
                    ? 'games'
                    : catLower.includes('cinema')
                    ? 'cinema'
                    : 'shorts';

                const guidanceToSend = typeof customGuidance === 'string'
                    ? customGuidance.trim()
                    : detailRemixGuidance.trim();

                const res = await axios.post<any>(
                    `${CLIK_URL}/examplestory`,
                    {
                        mode,
                        sourceTemplate: {
                            name: template.name,
                            prompt: template.basePrompt,
                        },
                        userText: guidanceToSend,
                    },
                    { withCredentials: true }
                );

                const promptText = res.data?.initialSteps?.keyPoints?.[0];
                if (typeof promptText !== 'string' || !promptText.trim()) {
                    throw new Error('AI returned an empty remix script.');
                }

                const cleanPrompt = promptText.trim();
                const firstSentence = cleanPrompt.split(/[.\n]/)[0].trim();
                const shortTitle = firstSentence.length > 50
                    ? firstSentence.slice(0, 48) + '...'
                    : firstSentence || `${template.name} (Remix)`;

                const generated = {
                    id: `ai-gen-${Date.now()}`,
                    title: shortTitle,
                    prompt: cleanPrompt,
                    artStyle: template.artStyle || currentArtStyle || 'PhotoRealistic',
                    category: inferTemplateCategory(template.name, template.basePrompt, template.artStyle),
                    isSaved: false,
                    sourceTemplateName: template.name,
                };

                pushView({ aiGeneratedTemplate: generated });
            } catch (err: any) {
                setFeedback({
                    message: err?.response?.data?.message || err?.message || 'Failed to remix template.',
                    severity: 'error',
                });
            } finally {
                setIsRemixingDetail(false);
            }
        },
        [isRemixingDetail, detailRemixGuidance, currentArtStyle, pushView]
    );

    const handleSaveAiTemplateToLibrary = useCallback(async () => {
        if (!aiGeneratedTemplate || aiGeneratedTemplate.isSaved || isSavingAiTemplate) return;
        setIsSavingAiTemplate(true);
        try {
            const res = await axios.post<any>(
                `${CLIK_URL}/create_template_prompt`,
                {
                    userid: loggedUser?.id || 1,
                    title: aiGeneratedTemplate.title,
                    template_prompt: aiGeneratedTemplate.prompt,
                    template_image: '',
                    artstyle: aiGeneratedTemplate.artStyle || 'PhotoRealistic',
                    inLibrary: true,
                    category: aiGeneratedTemplate.category,
                },
                { withCredentials: true }
            );

            if (!res.data?.id) throw new Error('Template save returned no identifier.');
            const createdId = String(res.data.id);
            const assignedCategory: TemplateCategory =
                res.data?.category || aiGeneratedTemplate.category;

            const newT: Template = {
                id: createdId,
                name: aiGeneratedTemplate.title,
                basePrompt: aiGeneratedTemplate.prompt,
                thumbnailUrl: '',
                createdAt: Date.now(),
                isCustom: true,
                userId: Number(loggedUser?.id || 1),
                artStyle: aiGeneratedTemplate.artStyle || 'PhotoRealistic',
                category: assignedCategory,
                inLibrary: true,
            };

            setLocallyCreatedTemplates((prev) => [newT, ...prev]);
            setAiGeneratedTemplate((prev) => (prev ? { ...prev, isSaved: true } : null));
            onTemplateCreated?.();

            setFeedback({
                message: `Saved "${aiGeneratedTemplate.title}" to your Library!`,
                severity: 'success',
            });
        } catch (err: any) {
            setFeedback({
                message: err?.response?.data?.message || err?.message || 'Could not save template to library.',
                severity: 'error',
            });
        } finally {
            setIsSavingAiTemplate(false);
        }
    }, [aiGeneratedTemplate, isSavingAiTemplate, loggedUser?.id, onTemplateCreated]);

    const handleUseAiGeneratedTemplate = useCallback(() => {
        if (!aiGeneratedTemplate) return;
        const temp: Template = {
            id: aiGeneratedTemplate.id,
            name: aiGeneratedTemplate.title,
            basePrompt: aiGeneratedTemplate.prompt,
            thumbnailUrl: '',
            createdAt: Date.now(),
            isCustom: true,
            userId: Number(loggedUser?.id || 1),
            artStyle: aiGeneratedTemplate.artStyle || 'PhotoRealistic',
            category: aiGeneratedTemplate.category,
            inLibrary: Boolean(aiGeneratedTemplate.isSaved),
        };
        applyTemplate(temp);
    }, [aiGeneratedTemplate, applyTemplate, loggedUser?.id]);

    const renderAiAutoTemplateCard = useCallback(
        (isRowSlider: boolean) => (
            <Box
                key="ai-auto-template-first-card"
                {...cb('templates', 'ask_ai_library', 'Ask AI to write prompt from library', 'handleGenerateAiTemplate', 'click', 'information_only', 'Generates a fresh idea for 1p using optional guidance and Library inspiration. Concierge can write an idea directly in New Template.')}
                onClick={() => void handleGenerateAiTemplate()}
                sx={{
                    width: isRowSlider ? { xs: 260, sm: 290, md: 310 } : '100%',
                    flexShrink: 0,
                    minHeight: { xs: 180, sm: 195 },
                    borderRadius: 2.5,
                    border: `1.5px dashed ${appColor}`,
                    bgcolor: darkMode
                        ? 'rgba(255, 255, 255, 0.04)'
                        : 'rgba(255, 255, 255, 0.72)',
                    backdropFilter: 'blur(16px)',
                    p: 2,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    '&:hover': {
                        borderColor: appColorHover,
                        bgcolor: darkMode
                            ? 'rgba(255, 255, 255, 0.08)'
                            : 'rgba(255, 255, 255, 0.95)',
                        transform: 'translateY(-2px)',
                        boxShadow: `0 8px 24px ${appColor}28`,
                    },
                }}
            >
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Chip
                            icon={<AutoAwesomeIcon sx={{ fontSize: '13px !important', color: `${appColor} !important` }} />}
                            label="ASK AI FOR PROMPT"
                            size="small"
                            sx={{
                                fontWeight: 900,
                                fontSize: '0.66rem',
                                letterSpacing: 0.5,
                                bgcolor: `${appColor}18`,
                                color: appColor,
                                border: `1px solid ${appColor}44`,
                            }}
                        />
                        <Chip
                            label="1P"
                            size="small"
                            sx={{
                                height: 20,
                                fontSize: '0.62rem',
                                fontWeight: 900,
                                bgcolor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                                color: mutedTextColor,
                            }}
                        />
                    </Box>

                    {/* Optional User Guidance TextField */}
                    <TextField
                        size="small"
                        fullWidth
                        placeholder="Add topic / twist (optional)..."
                        value={libraryAiGuidance}
                        onChange={(e) => setLibraryAiGuidance(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                                void handleGenerateAiTemplate();
                            }
                        }}
                        sx={{
                            my: 0.6,
                            '& .MuiInputBase-root': {
                                fontSize: '0.74rem',
                                height: 32,
                                bgcolor: darkMode ? 'rgba(0,0,0,0.32)' : 'rgba(255,255,255,0.9)',
                                color: textColor,
                                borderRadius: 2,
                                border: `1px solid ${subtleBorder}`,
                            },
                            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                        }}
                    />

                    <Typography sx={{ color: mutedTextColor, fontSize: '0.7rem', lineHeight: 1.35 }}>
                        {libraryTemplates.length > 0
                            ? `Inspired by ${Math.min(6, libraryTemplates.length)} seeds in your library.`
                            : 'Generates an original prompt inspired by template seeds.'}
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.25, pt: 1, borderTop: `1px solid ${subtleBorder}` }}>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: appColor }}>
                        {isGeneratingAiTemplate ? 'Crafting idea...' : 'Ask AI ✨'}
                    </Typography>
                    <Button
                        size="small"
                        variant="contained"
                        disabled={isGeneratingAiTemplate}
                        onClick={(e) => {
                            e.stopPropagation();
                            void handleGenerateAiTemplate();
                        }}
                        sx={{
                            borderRadius: 999,
                            textTransform: 'none',
                            fontWeight: 800,
                            fontSize: '0.72rem',
                            px: 1.5,
                            bgcolor: appColor,
                            color: accentButtonTextColor,
                            '&:hover': { bgcolor: appColorHover },
                        }}
                    >
                        {isGeneratingAiTemplate ? (
                            <CircularProgress size={14} sx={{ color: '#fff' }} />
                        ) : (
                            'Generate (1p)'
                        )}
                    </Button>
                </Box>
            </Box>
        ),
        [
            handleGenerateAiTemplate,
            libraryAiGuidance,
            libraryTemplates.length,
            appColor,
            appColorHover,
            darkMode,
            subtleBorder,
            textColor,
            mutedTextColor,
            isGeneratingAiTemplate,
        ]
    );

    const catalogOverview = useMemo(() => {
        return ASSIGNABLE_TEMPLATE_CATEGORIES.map(cat => {
            const items = templatesByCategory[cat] || [];
            if (!items.length) return null;
            return `${cat} (${items.length}): ${items.map(t => t.name).join(', ')}`;
        }).filter(Boolean).join(' | ');
    }, [templatesByCategory]);

    useCreationControls('templates', 'TemplateLibrary', true, {
        catalogOverview,
        expandedCategory, detailTemplateId, libraryCount: libraryTemplates.length,
        totalCount: enrichedTemplates.length,
        detailTitle: detailTemplate?.name || null,
        detailCategory: detailTemplate?.category || null,
        detailArtStyle: detailTemplate?.artStyle || null,
        isDetailOpen: Boolean(detailTemplate), isAiInspectionOpen: Boolean(aiGeneratedTemplate),
        aiResultTitle: aiGeneratedTemplate?.title || null,
        aiResultCategory: aiGeneratedTemplate?.category || null,
        aiResultArtStyle: aiGeneratedTemplate?.artStyle || null,
        coverGenerationBusy: Object.keys(coverProgress).length > 0,
        coverGenerationCount: Object.keys(coverProgress).length,
        templateWorkflow: 'Inspect a title to read the full script. New Template opens editable name/script, then Finalize for style, cover and Save. Ask AI/Remix offer optional 1p ideas.',
    });

    // Block PC browser Back/Forward swipe gesture when trackpad-scrolling horizontal sliders
    const dialogRootRef = useRef<HTMLDivElement | null>(null);
    React.useEffect(() => {
        const root = dialogRootRef.current;
        if (!root) return;
        const onWheel = (e: WheelEvent) => {
            if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
            const target = e.target as HTMLElement | null;
            const slider = target?.closest('[data-template-row-slider="true"]') as HTMLElement | null;
            if (!slider) {
                e.preventDefault();
                return;
            }
            const atLeft = slider.scrollLeft <= 0 && e.deltaX < 0;
            const atRight =
                slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 1 && e.deltaX > 0;
            if (atLeft || atRight) {
                e.preventDefault();
            }
        };
        root.addEventListener('wheel', onWheel, { passive: false });
        return () => root.removeEventListener('wheel', onWheel);
    }, []);

    // ───────────────────────── SINGLE CARD RENDERER ─────────────────────────
    const renderTemplateCard = (template: Template, isHorizontalSlide: boolean, rowScope?: string) => {
        const controlKey = rowScope && rowScope !== 'Library' ? `${template.id}:${rowScope}` : template.id;
        const isSelected = activeTemplateId === template.id;
        const hasImage = hasRealTemplateImage(template.thumbnailUrl);
        const progress = coverProgress[templateCoverKey(template)];
        const isGeneratingThis = progress !== undefined;
        const isRealDbRow = !String(template.id).startsWith('seed-');
        const isDev = Boolean(import.meta.env.DEV);
        const isOwner = Boolean(loggedUser && Number(loggedUser.id) !== 1 && Number(template.userId) === Number(loggedUser.id));
        // Delete is strictly DEV mode only for official templates, or allowed for a user's own created templates
        const canDeleteThis = Boolean(
            onDeleteTemplate &&
            isRealDbRow &&
            (isDev || isOwner)
        );

        return (
            <Card
                {...cb('templates', `open_detail_${controlKey}`, `Inspect ${template.name}`, 'openDetailView', 'click', 'candidate', `${template.category || ''}: ${template.basePrompt.replace(/\s+/g, ' ').slice(0, 140)}`)}
                key={templateCoverKey(template)}
                onClick={() => openDetailView(template.id)}
                sx={{
                    width: isHorizontalSlide ? { xs: 265, sm: 295 } : '100%',
                    minWidth: isHorizontalSlide ? { xs: 265, sm: 295 } : undefined,
                    height: 192,
                    flexShrink: 0,
                    cursor: 'pointer',
                    borderRadius: 2.5,
                    position: 'relative',
                    overflow: 'hidden',
                    border: isSelected
                        ? `2px solid ${appColor}`
                        : `1px solid ${subtleBorder}`,
                    boxShadow: isSelected
                        ? `0 10px 26px rgba(0,0,0,0.32)`
                        : darkMode
                        ? '0 6px 18px rgba(0,0,0,0.35)'
                        : '0 6px 18px rgba(15,23,42,0.07)',
                    transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
                    '&:hover': {
                        transform: 'translateY(-3px)',
                        borderColor: appColor,
                        boxShadow: darkMode
                            ? '0 12px 28px rgba(0,0,0,0.55)'
                            : '0 12px 26px rgba(15,23,42,0.15)',
                    },
                }}
            >
                {hasImage ? (
                    <>
                        <CardMedia
                            component="img"
                            image={template.thumbnailUrl}
                            alt={template.name}
                            sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                            }}
                        />
                        {/* Clean slim bottom gradient so the artwork stays 100% unobstructed */}
                        <Box
                            sx={{
                                position: 'absolute',
                                left: 0,
                                right: 0,
                                bottom: 0,
                                height: '34%',
                                background:
                                    'linear-gradient(to top, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.36) 65%, transparent 100%)',
                                pointerEvents: 'none',
                            }}
                        />
                    </>
                ) : (
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            background: darkMode
                                ? 'linear-gradient(145deg, rgba(26,28,36,0.98) 0%, rgba(17,19,25,0.99) 100%)'
                                : 'linear-gradient(145deg, #ffffff 0%, #f3f5f9 100%)',
                        }}
                    />
                )}

                {/* Top Action Bar on Card */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        right: 8,
                        zIndex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 0.5,
                    }}
                >
                    <Tooltip title={template.category || 'Template'}>
                    <Chip
                        size="small"
                        label={template.category || 'Template'}
                        sx={{
                            height: 22,
                            minWidth: 0,
                            flexShrink: 1,
                            overflow: 'hidden',
                            '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', px: 1 },
                            fontSize: '0.64rem',
                            fontWeight: 800,
                            bgcolor: hasImage
                                ? 'rgba(0,0,0,0.64)'
                                : darkMode
                                ? 'rgba(255,255,255,0.09)'
                                : 'rgba(0,0,0,0.06)',
                            color: hasImage ? '#fff' : textColor,
                            backdropFilter: 'blur(6px)',
                        }}
                    />
                    </Tooltip>

                    <Box data-template-card-actions="true" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                        {/* Library Bookmark Toggle */}
                        <Tooltip title={template.inLibrary ? 'Remove from your Library' : 'Add to your Library'}>
                            <IconButton
                                {...cb('templates', `toggle_lib_${controlKey}`, `Toggle Library for ${template.name}`, 'handleToggleInLibrary')}
                                size="small"
                                disabled={Boolean(togglingLibraryIds[template.id])}
                                onClick={(e) => void handleToggleInLibrary(e, template)}
                                sx={{
                                    width: 30,
                                    height: 30,
                                    bgcolor: template.inLibrary
                                        ? `${appColor}dd`
                                        : hasImage
                                        ? 'rgba(0,0,0,0.64)'
                                        : darkMode
                                        ? 'rgba(255,255,255,0.12)'
                                        : 'rgba(0,0,0,0.08)',
                                    color: template.inLibrary ? '#fff' : hasImage ? '#fff' : textColor,
                                    '&:hover': {
                                        bgcolor: template.inLibrary ? appColor : `${appColor}33`,
                                    },
                                }}
                            >
                                {template.inLibrary ? (
                                    <BookmarkAddedIcon sx={{ fontSize: 16 }} />
                                ) : (
                                    <BookmarkBorderIcon sx={{ fontSize: 16 }} />
                                )}
                            </IconButton>
                        </Tooltip>

                        {/* When NO image: Clean [ 🪄 Generate ] button */}
                        {!hasImage && (
                            <Button
                                {...cb('templates', `gen_open_${controlKey}`, `Generate cover art for ${template.name}`, 'openGenerateMenu')}
                                size="small"
                                disabled={isGeneratingThis}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCardGenerateOptionId(template.id);
                                }}
                                sx={{
                                    height: 30,
                                    px: 1.4,
                                    borderRadius: 999,
                                    textTransform: 'none',
                                    fontWeight: 800,
                                    fontSize: '0.74rem',
                                    letterSpacing: '0.01em',
                                    whiteSpace: 'nowrap',
                                    bgcolor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                                    color: textColor,
                                    border: `1px solid ${subtleBorder}`,
                                    boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                                    transition: 'all 160ms ease',
                                    '&:hover': {
                                        borderColor: appColor,
                                        bgcolor: `${appColor}18`,
                                        color: appColor,
                                    },
                                }}
                            >
                                <AutoFixHighIcon sx={{ fontSize: 14, mr: 0.5, color: appColor }} />
                                Generate
                            </Button>
                        )}

                        {/* Delete Button: DEV only for official templates, or user's own custom templates */}
                        {canDeleteThis && (
                            <Tooltip title="Delete template">
                                <IconButton
                                    data-ai-snapshot-ignore="true"
                                    size="small"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCardDeleteConfirmId(template.id);
                                    }}
                                    sx={{
                                        width: 30,
                                        height: 30,
                                        bgcolor: 'rgba(0,0,0,0.64)',
                                        color: '#ff5252',
                                        '&:hover': { bgcolor: 'rgba(0,0,0,0.85)', color: '#ff1744' },
                                    }}
                                >
                                    <DeleteIcon sx={{ fontSize: 16 }} />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                </Box>

                {/* IN-CARD DELETE CONFIRMATION OVERLAY (Tapping dark area dismisses) */}
                {cardDeleteConfirmId === template.id && (
                    <Box
                        onClick={(e) => {
                            e.stopPropagation();
                            setCardDeleteConfirmId(null);
                        }}
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            zIndex: 10,
                            bgcolor: 'rgba(12, 13, 18, 0.94)',
                            backdropFilter: 'blur(10px)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            p: 2,
                            textAlign: 'center',
                            cursor: 'pointer',
                        }}
                    >
                        <DeleteIcon sx={{ fontSize: 28, color: '#ff4d4f', mb: 0.75, pointerEvents: 'none' }} />
                        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.9rem', mb: 1.5, pointerEvents: 'none' }}>
                            Delete this template?
                        </Typography>
                        <Box
                            onClick={(e) => e.stopPropagation()}
                            sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}
                        >
                            <Button
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCardDeleteConfirmId(null);
                                }}
                                sx={{
                                    bgcolor: 'rgba(255,255,255,0.16)',
                                    color: '#fff',
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    minWidth: 72,
                                    py: 0.6,
                                    px: 2,
                                    borderRadius: 999,
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.26)' }
                                }}
                            >
                                No
                            </Button>
                            <Button
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCardDeleteConfirmId(null);
                                    onDeleteTemplate?.(template);
                                }}
                                sx={{
                                    bgcolor: '#ff3b30',
                                    color: '#fff',
                                    textTransform: 'none',
                                    fontWeight: 800,
                                    fontSize: '0.8rem',
                                    minWidth: 72,
                                    py: 0.6,
                                    px: 2,
                                    borderRadius: 999,
                                    boxShadow: '0 2px 10px rgba(255,59,48,0.45)',
                                    '&:hover': { bgcolor: '#d32f2f' }
                                }}
                            >
                                Yes
                            </Button>
                        </Box>
                    </Box>
                )}

                {/* IN-CARD GENERATE COVER ART OPTIONS OVERLAY (Tapping dark area dismisses) */}
                {cardGenerateOptionId === template.id && (
                    <Box
                        onClick={(e) => {
                            e.stopPropagation();
                            setCardGenerateOptionId(null);
                        }}
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            zIndex: 10,
                            bgcolor: 'rgba(12, 13, 18, 0.94)',
                            backdropFilter: 'blur(10px)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            p: 1.25,
                            pr: 7,
                            textAlign: 'center',
                            cursor: 'pointer',
                        }}
                    >
                        <IconButton
                            aria-label="Close cover model choices"
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                setCardGenerateOptionId(null);
                            }}
                            sx={{
                                position: 'absolute',
                                top: 6,
                                right: 6,
                                width: 44,
                                height: 44,
                                color: 'rgba(255,255,255,0.75)',
                                '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.15)' },
                            }}
                        >
                            <CloseIcon sx={{ fontSize: 18 }} />
                        </IconButton>

                        <Box onClick={(e) => e.stopPropagation()}
                            sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, width: '100%', maxWidth: 220 }}>
                            {(['hd', 'sd2', 'sd'] as TemplateCoverQuality[]).map(quality => {
                                const config = TEMPLATE_COVER_MODELS[quality];
                                const cost = getImageModelPixelCost(config.model) ?? 1;
                                return <Button key={quality} fullWidth
                                    disabled={quality === 'sd' && !import.meta.env.DEV && !isOwner}
                                    {...cb('templates', `cover_${quality}_${controlKey}`, `${quality.toUpperCase()} ${config.label} cover (${cost}p)`, `handleGenerateTemplatePreview(${quality})`)}
                                    onClick={event => {
                                        event.stopPropagation(); setCardGenerateOptionId(null);
                                        void handleGenerateTemplatePreview(event, template, quality);
                                    }}
                                    sx={{ minHeight: 44, height: 44, flexShrink: 0, minWidth: 0, px: 1.1, bgcolor: quality !== 'sd' ? `${appColor}28` : 'rgba(255,255,255,0.08)',
                                        border: `1.5px solid ${quality !== 'sd' ? appColor : 'rgba(255,255,255,0.22)'}`,
                                        color: '#fff', borderRadius: 2.2, textTransform: 'none', display: 'flex',
                                        alignItems: 'center', justifyContent: 'space-between', '&:hover': { bgcolor: `${appColor}45` } }}>
                                    <Typography sx={{ fontWeight: 800, fontSize: '0.78rem', color: '#fff' }}>
                                        {quality.toUpperCase()} ({cost}p)
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.63rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
                                        {config.label}
                                    </Typography>
                                </Button>;
                            })}
                        </Box>
                    </Box>
                )}

                {/* IN-CARD LIVE PROGRESS OVERLAY */}
                {isGeneratingThis && (
                    <Box
                        onClick={(e) => e.stopPropagation()}
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            zIndex: 11,
                            bgcolor: 'rgba(12, 13, 18, 0.92)',
                            backdropFilter: 'blur(8px)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            p: 2,
                            textAlign: 'center',
                        }}
                    >
                        <CircularProgress size={30} sx={{ color: appColor, mb: 1.25 }} />
                        <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.86rem' }}>
                            Generating Cover Art...
                        </Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.75rem', mt: 0.4, fontWeight: 700 }}>
                            {Math.round(progress ?? 0)}%
                        </Typography>
                    </Box>
                )}

                {/* Card Content:
                    - Image cards: clean artwork; single-line title + direct Use button in bottom bar.
                    - Text cards: trimmed title on top, spacious clean middle, style + direct Use button. */}
                {hasImage ? (
                    <Box
                        sx={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            px: 1.4,
                            py: 1.1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 1,
                            zIndex: 1,
                        }}
                    >
                        <Box sx={{ minWidth: 0, flex: 1, mr: 0.5 }}>
                            <Typography
                                noWrap
                                sx={{
                                    color: '#fff',
                                    fontWeight: 800,
                                    fontSize: '0.86rem',
                                    lineHeight: 1.2,
                                    textShadow: '0 1px 4px rgba(0,0,0,0.92)',
                                }}
                            >
                                {template.name}
                            </Typography>
                        </Box>

                        <Button
                            {...cb('templates', `use_${controlKey}`, `Use ${template.name} template`, 'handleTemplateSelect')}
                            size="small"
                            variant="contained"
                            onClick={(e) => {
                                e.stopPropagation();
                                applyTemplate(template);
                            }}
                            sx={{
                                flexShrink: 0,
                                minWidth: 62,
                                height: 26,
                                px: 1.5,
                                py: 0,
                                borderRadius: 999,
                                textTransform: 'none',
                                fontWeight: 800,
                                fontSize: '0.72rem',
                                bgcolor: appColor,
                                color: accentButtonTextColor,
                                boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                                '&:hover': { bgcolor: appColorHover },
                            }}
                        >
                            Use
                        </Button>
                    </Box>
                ) : (
                    <Box
                        sx={{
                            position: 'absolute',
                            left: 0,
                            right: 0,
                            bottom: 0,
                            top: 42,
                            p: 1.5,
                            pt: 0.75,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            zIndex: 1,
                        }}
                    >
                        {/* Trimmed Title on top with spacious clean middle */}
                        <Box sx={{ overflow: 'hidden' }}>
                            <Typography
                                sx={{
                                    color: textColor,
                                    fontWeight: 800,
                                    fontSize: '0.88rem',
                                    lineHeight: 1.25,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                }}
                            >
                                {template.name}
                            </Typography>
                        </Box>

                        {/* Bottom Row: Style info & direct Use button */}
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                pt: 0.75,
                                borderTop: `1px solid ${subtleBorder}`,
                            }}
                        >
                            <Typography
                                noWrap
                                sx={{
                                    color: mutedTextColor,
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    maxWidth: '60%',
                                }}
                            >
                                {template.artStyle ? `Style: ${template.artStyle}` : ''}
                            </Typography>

                            <Button
                                {...cb('templates', `use_${controlKey}`, `Use ${template.name} template`, 'handleTemplateSelect')}
                                size="small"
                                variant="contained"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    applyTemplate(template);
                                }}
                                sx={{
                                    minWidth: 64,
                                    height: 26,
                                    px: 1.5,
                                    py: 0,
                                    borderRadius: 999,
                                    textTransform: 'none',
                                    fontWeight: 800,
                                    fontSize: '0.72rem',
                                    bgcolor: appColor,
                                    color: accentButtonTextColor,
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
                                    '&:hover': { bgcolor: appColorHover },
                                }}
                            >
                                Use
                            </Button>
                        </Box>
                    </Box>
                )}
            </Card>
        );
    };

    const orderedCategories: TemplateCategory[] = useMemo(
        () => ['Library', ...ASSIGNABLE_TEMPLATE_CATEGORIES],
        []
    );

        // Mobile edge swipe-to-close / swipe-to-back (swiping right from left edge)
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);
    const handleTouchSwipeStart = useCallback((e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    }, []);
    const handleTouchSwipeEnd = useCallback((e: React.TouchEvent) => {
        if (!touchStartRef.current || e.changedTouches.length === 0) return;
        const startX = touchStartRef.current.x;
        const startY = touchStartRef.current.y;
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        touchStartRef.current = null;
        const deltaX = endX - startX;
        const deltaY = Math.abs(endY - startY);
        // Swiped right from left edge (< 70px) by > 65px with minimal vertical slope
        if (startX <= 70 && deltaX > 65 && deltaY < 60) {
            if (fullScreenImage || aiGeneratedTemplate || detailTemplate || expandedCategory) {
                handleUiBack();
            } else {
                handleUiClose();
            }
        }
    }, [fullScreenImage, aiGeneratedTemplate, detailTemplate, expandedCategory, handleUiBack, handleUiClose]);

    const isGalleryHome = !detailTemplate && !expandedCategory;

    return (
        <Box
            ref={dialogRootRef}
            data-template-gallery="true"
            onTouchStart={handleTouchSwipeStart}
            onTouchEnd={handleTouchSwipeEnd}
            role="dialog"
            aria-label="Prompt templates library"
            onClick={(e) => e.stopPropagation()}
            sx={{
                width: '100%',
                height: '100%',
                boxSizing: 'border-box',
                p: { xs: 1.5, sm: 2.25 },
                borderRadius: standalone ? { xs: 0, sm: 3 } : 3,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                bgcolor: surfaceBg,
                backdropFilter: 'blur(24px)',
                border: `1px solid ${subtleBorder}`,
                boxShadow: standalone ? '0 24px 70px rgba(0,0,0,0.55)' : 'none',
                overflow: 'hidden',
                overscrollBehavior: 'contain',
                position: 'relative',
            }}
        >
            {/* ───────────────────────── TOP HEADER BAR ───────────────────────── */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: isGalleryHome ? { xs: 0.5, sm: 1 } : 1,
                    ...(isGalleryHome && { flexWrap: { xs: 'wrap', sm: 'nowrap' } }),
                    flexShrink: 0,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    {(detailTemplate || expandedCategory) && (
                        <Button
                            size="small"
                            {...cb('templates', 'back', 'Back one template view', 'handleUiBack')}
                            startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
                            onClick={handleUiBack}
                            sx={{
                                borderRadius: 999,
                                textTransform: 'none',
                                fontWeight: 800,
                                fontSize: '0.75rem',
                                px: 1.4,
                                py: 0.45,
                                color: textColor,
                                border: `1px solid ${subtleBorder}`,
                                bgcolor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                '&:hover': { borderColor: appColor },
                            }}
                        >
                            {detailTemplate ? 'Back' : 'All Categories'}
                        </Button>
                    )}
                    <Box sx={{ minWidth: 0 }}>
                        <Typography
                            sx={{
                                color: textColor,
                                fontWeight: 900,
                                fontSize: { xs: '0.96rem', sm: '1.08rem' },
                                letterSpacing: 0.2,
                                lineHeight: 1.2,
                            }}
                        >
                            {detailTemplate
                                ? detailTemplate.name
                                : expandedCategory
                                ? `${expandedCategory} (${(templatesByCategory[expandedCategory] || []).length})`
                                : (
                                    <>
                                        <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' }, whiteSpace: 'nowrap' }}>
                                            Templates
                                        </Box>
                                        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                                            Prompt Templates &amp; Story Seeds
                                        </Box>
                                    </>
                                )}
                        </Typography>
                        {(detailTemplate || expandedCategory) && (
                            <Typography sx={{ color: mutedTextColor, fontSize: '0.72rem', fontWeight: 600 }}>
                                {detailTemplate
                                    ? 'Click image for fullscreen • Review full prompt below or click Use'
                                    : 'Vertical view • Click any card to inspect full prompt or click Use'}
                            </Typography>
                        )}
                    </Box>
                </Box>

                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isGalleryHome ? { xs: 0.5, sm: 0.75 } : 0.75,
                    flexShrink: 0,
                    ...(isGalleryHome && {
                        ml: { xs: 'auto', sm: 0 },
                        '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } },
                    }),
                }}>
                    {onOpenBrainstorm && !detailTemplate && (
                        <Button
                            {...cb('templates', 'open_brainstorm', 'Open BrainStorm template builder', 'onOpenBrainstorm')}
                            size="small"
                            onClick={() => handleUiClose(() => onOpenBrainstorm?.({ isAIEnabled: true, view: 'chat' }))}
                            startIcon={<PsychologyIcon sx={{ fontSize: 16 }} />}
                            sx={{
                                borderRadius: 999,
                                textTransform: 'none',
                                fontWeight: 800,
                                fontSize: isGalleryHome ? { xs: '0.68rem', sm: '0.73rem' } : '0.73rem',
                                px: isGalleryHome ? { xs: 0.625, sm: 1.4 } : 1.4,
                                py: 0.5,
                                color: textColor,
                                border: `1px solid ${subtleBorder}`,
                                bgcolor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                '&:hover': {
                                    bgcolor: `${appColor}18`,
                                    borderColor: appColor,
                                },
                            }}
                        >
                            BrainStorm
                        </Button>
                    )}

                    {onOpenBrainstorm && !detailTemplate && (
                        <Button
                            {...cb('templates', 'create_new_template', 'Create a new template in BrainStorm', 'onOpenBrainstorm')}
                            size="small"
                            variant="contained"
                            onClick={() => {
                                handleUiClose(() => onOpenBrainstorm?.({ isAIEnabled: false, view: 'chat', title: '', prompt: '', artStyle: '' }));
                            }}
                            startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                            sx={{
                                borderRadius: 999,
                                textTransform: 'none',
                                fontWeight: 800,
                                fontSize: isGalleryHome ? { xs: '0.68rem', sm: '0.73rem' } : '0.73rem',
                                px: isGalleryHome ? { xs: 0.625, sm: 1.6 } : 1.6,
                                py: 0.5,
                                bgcolor: appColor,
                                color: accentButtonTextColor,
                                '&:hover': {
                                    bgcolor: appColorHover,
                                },
                            }}
                        >
                            New Template
                        </Button>
                    )}

                    <IconButton
                        {...cb('templates', 'close', 'Close or go back', 'handleUiCloseOrBack')}
                        size="medium"
                        onClick={() => {
                            if (fullScreenImage || aiGeneratedTemplate || detailTemplate || expandedCategory) {
                                handleUiBack();
                            } else {
                                handleUiClose();
                            }
                        }}
                        aria-label="Close or back"
                        sx={{
                            width: { xs: 44, sm: 36 },
                            height: { xs: 44, sm: 36 },
                            minWidth: { xs: 44, sm: 36 },
                            p: { xs: 1, sm: 0.75 },
                            color: textColor,
                            border: `1px solid ${subtleBorder}`,
                            borderRadius: { xs: '50%', sm: 2 },
                            bgcolor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                            '&:hover': {
                                bgcolor: `${appColor}22`,
                                borderColor: appColor,
                            },
                        }}
                    >
                        <CloseIcon sx={{ fontSize: { xs: 22, sm: 18 } }} />
                    </IconButton>
                </Box>
            </Box>

            {/* ───────────────────────── INLINE NEW TEMPLATE CREATOR ───────────────────────── */}


            {/* ───────────────────────── MAIN BODY: DETAIL VIEW OR CATEGORY SLIDERS / EXPANDED GRID ───────────────────────── */}
            {detailTemplate ? (
                /* 1️⃣ TEMPLATE DETAIL VIEW: Image on Top (Click to Zoom Fullscreen) + Full Prompt Text Below + Use Button */
                <Box
                    ref={detailScrollRef}
                    key={`detail-${detailTemplate.id}`}
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1.5,
                        pr: 0.5,
                    }}
                >
                    {/* Top Image Section */}
                    {hasRealTemplateImage(detailTemplate.thumbnailUrl) ? (
                        <Box
                            onClick={() =>
                                openFullScreenImage({
                                    url: detailTemplate.thumbnailUrl,
                                    title: detailTemplate.name,
                                })
                            }
                            sx={{
                                position: 'relative',
                                width: '100%',
                                height: { xs: 230, sm: 320, md: 360 },
                                borderRadius: 3,
                                overflow: 'hidden',
                                cursor: 'zoom-in',
                                border: `1px solid ${subtleBorder}`,
                                flexShrink: 0,
                                bgcolor: '#060709',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Box
                                component="img"
                                src={detailTemplate.thumbnailUrl}
                                alt={detailTemplate.name}
                                sx={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    display: 'block',
                                }}
                            />

                            {/* Active generation overlay on image banner */}
                            {coverProgress[templateCoverKey(detailTemplate)] !== undefined && (
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        inset: 0,
                                        bgcolor: 'rgba(0,0,0,0.65)',
                                        backdropFilter: 'blur(8px)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        zIndex: 3,
                                        gap: 1.25,
                                    }}
                                >
                                    <CircularProgress size={42} thickness={4.5} sx={{ color: appColor }} />
                                    <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: '0.92rem' }}>
                                        Generating Cover Art... {Math.round(coverProgress[templateCoverKey(detailTemplate)] ?? 0)}%
                                    </Typography>
                                </Box>
                            )}

                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: 10,
                                    right: 10,
                                    display: 'flex',
                                    gap: 0.75,
                                    zIndex: 4,
                                }}
                            >
                                <Button
                                    size="small"
                                    startIcon={<ZoomInIcon sx={{ fontSize: 16 }} />}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openFullScreenImage({
                                            url: detailTemplate.thumbnailUrl,
                                            title: detailTemplate.name,
                                        });
                                    }}
                                    sx={{
                                        borderRadius: 999,
                                        textTransform: 'none',
                                        fontWeight: 800,
                                        fontSize: '0.74rem',
                                        bgcolor: 'rgba(0,0,0,0.72)',
                                        color: '#fff',
                                        px: 1.35,
                                        py: 0.4,
                                        border: '1px solid rgba(255,255,255,0.25)',
                                        '&:hover': { bgcolor: 'rgba(0,0,0,0.92)' },
                                    }}
                                >
                                    Full Screen
                                </Button>
                                <Button
                                    size="small"
                                    {...cb('templates', `detail_cover_menu_${detailTemplate.id}`, 'Choose cover generation quality', 'setCardMenuAnchor')}
                                    disabled={coverProgress[templateCoverKey(detailTemplate)] !== undefined}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCardMenuAnchor({ el: e.currentTarget, template: detailTemplate });
                                    }}
                                    sx={{
                                        borderRadius: 999,
                                        textTransform: 'none',
                                        fontWeight: 800,
                                        fontSize: '0.74rem',
                                        bgcolor: coverProgress[templateCoverKey(detailTemplate)] !== undefined ? `${appColor} !important` : 'rgba(0,0,0,0.72)',
                                        color: '#ffffff !important',
                                        px: 1.5,
                                        py: 0.4,
                                        border: '1px solid rgba(255,255,255,0.25)',
                                        '&:hover': { bgcolor: appColor },
                                        '&.Mui-disabled': {
                                            color: '#ffffff !important',
                                            bgcolor: `${appColor} !important`,
                                            opacity: 0.95,
                                        },
                                    }}
                                >
                                    {coverProgress[templateCoverKey(detailTemplate)] !== undefined ? (
                                        <>
                                            <CircularProgress size={14} sx={{ color: '#fff', mr: 0.75 }} />
                                            {`Generating ${Math.round(coverProgress[templateCoverKey(detailTemplate)] ?? 0)}%`}
                                        </>
                                    ) : (
                                        <>
                                            <AutoFixHighIcon sx={{ fontSize: 15, mr: 0.5, color: '#fff' }} />
                                            Re-generate Cover
                                        </>
                                    )}
                                </Button>
                            </Box>
                        </Box>
                    ) : (
                        <Box
                            sx={{
                                width: '100%',
                                py: 2.5,
                                px: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            }}
                        >
                            <Button
                                size="medium"
                                variant="contained"
                                {...cb('templates', `detail_cover_menu_${detailTemplate.id}`, 'Choose cover generation quality', 'setCardMenuAnchor')}
                                    disabled={coverProgress[templateCoverKey(detailTemplate)] !== undefined}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setCardMenuAnchor({ el: e.currentTarget, template: detailTemplate });
                                }}
                                sx={{
                                    borderRadius: 999,
                                    textTransform: 'none',
                                    fontWeight: 800,
                                    fontSize: '0.82rem',
                                    bgcolor: appColor,
                                    color: '#fff !important',
                                    px: 3,
                                    py: 0.85,
                                    boxShadow: '0 3px 12px rgba(0,0,0,0.22)',
                                    '&:hover': { bgcolor: appColorHover },
                                    '&.Mui-disabled': {
                                        color: '#ffffff !important',
                                        bgcolor: `${appColor} !important`,
                                        opacity: 0.95,
                                    },
                                }}
                            >
                                {coverProgress[templateCoverKey(detailTemplate)] !== undefined ? (
                                    <>
                                        <CircularProgress size={16} sx={{ color: '#fff', mr: 1 }} />
                                        {`Generating Cover Art (${Math.round(coverProgress[templateCoverKey(detailTemplate)] ?? 0)}%)`}
                                    </>
                                ) : (
                                    <>
                                        <AutoFixHighIcon sx={{ fontSize: 17, mr: 0.8 }} />
                                        Generate Cover Art
                                    </>
                                )}
                            </Button>
                        </Box>
                    )}

                    {/* Metadata Chips + Actions Row */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 1,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                            <Chip
                                size="small"
                                label={detailTemplate.category || 'Template'}
                                {...(canModifyDetail ? {
                                    deleteIcon: <ArrowDropDownIcon sx={{ fontSize: '18px !important', color: `${textColor} !important` }} />,
                                    onDelete: (e: any) => {
                                        e.stopPropagation();
                                        setCategoryMenuAnchor(e.currentTarget.closest('.MuiChip-root') || e.currentTarget);
                                    },
                                    onClick: (e: any) => {
                                        e.stopPropagation();
                                        setCategoryMenuAnchor(e.currentTarget);
                                    },
                                } : {})}
                                sx={{
                                    fontWeight: 800,
                                    fontSize: '0.7rem',
                                    bgcolor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                                    color: textColor,
                                    ...(canModifyDetail ? {
                                        cursor: 'pointer',
                                        border: `1px solid ${subtleBorder}`,
                                        '&:hover': {
                                            bgcolor: darkMode ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)',
                                            borderColor: appColor,
                                        },
                                    } : {}),
                                }}
                            />
                            {canModifyDetail && (
                                <Menu
                                    anchorEl={categoryMenuAnchor}
                                    open={Boolean(categoryMenuAnchor)}
                                    onClose={() => setCategoryMenuAnchor(null)}
                                    sx={{ zIndex: TEMPLATE_LIBRARY_Z_INDEX + 30 }}
                                    slotProps={{
                                        root: {
                                            sx: { zIndex: TEMPLATE_LIBRARY_Z_INDEX + 30 },
                                        },
                                        paper: {
                                            sx: {
                                                zIndex: TEMPLATE_LIBRARY_Z_INDEX + 30,
                                                maxHeight: 340,
                                                width: 230,
                                                borderRadius: 2,
                                                bgcolor: darkMode ? '#18191f' : '#ffffff',
                                                color: textColor,
                                                border: `1px solid ${subtleBorder}`,
                                                boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
                                            },
                                        },
                                    }}
                                    PopoverProps={{
                                        sx: { zIndex: TEMPLATE_LIBRARY_Z_INDEX + 30 },
                                    }}
                                >
                                    <Box sx={{ px: 2, py: 1, borderBottom: `1px solid ${subtleBorder}` }}>
                                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: mutedTextColor, letterSpacing: 0.5 }}>
                                            Move to Category
                                        </Typography>
                                    </Box>
                                    {ASSIGNABLE_TEMPLATE_CATEGORIES.map((cat) => (
                                        <MenuItem
                                            key={cat}
                                            selected={cat === detailTemplate.category}
                                            onClick={() => void handleChangeCategory(cat)}
                                            sx={{
                                                fontSize: '0.8rem',
                                                fontWeight: cat === detailTemplate.category ? 800 : 500,
                                                color: cat === detailTemplate.category ? appColor : textColor,
                                                py: 0.85,
                                                '&:hover': { bgcolor: `${appColor}14` },
                                            }}
                                        >
                                            {cat}
                                        </MenuItem>
                                    ))}
                                </Menu>
                            )}
                            {detailTemplate.artStyle && (
                                <Chip
                                    size="small"
                                    label={`Art Style: ${detailTemplate.artStyle}`}
                                    sx={{
                                        fontWeight: 700,
                                        fontSize: '0.7rem',
                                        bgcolor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                        color: mutedTextColor,
                                    }}
                                />
                            )}
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Button
                                size="small"
                                startIcon={
                                    detailTemplate.inLibrary ? (
                                        <BookmarkAddedIcon sx={{ fontSize: 16 }} />
                                    ) : (
                                        <BookmarkBorderIcon sx={{ fontSize: 16 }} />
                                    )
                                }
                                {...cb('templates', `detail_library_${detailTemplate.id}`, 'Toggle this template in your Library', 'handleToggleInLibrary')}
                                onClick={(e) => void handleToggleInLibrary(e, detailTemplate)}
                                sx={{
                                    borderRadius: 999,
                                    textTransform: 'none',
                                    fontWeight: 800,
                                    fontSize: '0.76rem',
                                    px: 1.5,
                                    border: `1px solid ${detailTemplate.inLibrary ? appColor : subtleBorder}`,
                                    bgcolor: detailTemplate.inLibrary ? `${appColor}22` : 'transparent',
                                    color: textColor,
                                }}
                            >
                                {detailTemplate.inLibrary ? 'Saved in Library' : 'Add to Library'}
                            </Button>

                            <Button
                                size="small"
                                variant="contained"
                                startIcon={<CheckCircleOutlineIcon sx={{ fontSize: 17 }} />}
                                {...cb('templates', `detail_use_${detailTemplate.id}`, 'Use this template in the prompt', 'applyTemplate')}
                                onClick={() => applyTemplate(detailTemplate)}
                                sx={{
                                    borderRadius: 999,
                                    textTransform: 'none',
                                    fontWeight: 900,
                                    fontSize: '0.8rem',
                                    px: 2.2,
                                    py: 0.6,
                                    bgcolor: appColor,
                                    color: accentButtonTextColor,
                                    '&:hover': { bgcolor: appColorHover },
                                }}
                            >
                                Use Template
                            </Button>
                        </Box>
                    </Box>

                    {/* Ask AI to Remix / Expand This Story (1p) */}
                    <Box
                        sx={{
                            width: { xs: '100%', md: '50%' },
                            mx: { xs: 0, md: 'auto' },
                            p: { xs: 1.25, sm: 1.5 },
                            borderRadius: 2.5,
                            border: `1px solid ${subtleBorder}`,
                            bgcolor: darkMode ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.7)',
                            backdropFilter: 'blur(16px)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.2,
                            flexWrap: { xs: 'wrap', sm: 'nowrap' },
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                            <AutoAwesomeIcon sx={{ fontSize: 18, color: appColor }} />
                            <Typography sx={{ fontWeight: 800, fontSize: '0.78rem', color: textColor, whiteSpace: 'nowrap' }}>
                                Ask AI to Remix
                            </Typography>
                        </Box>
                        <TextField
                            size="small"
                            fullWidth
                            placeholder="Add a twist or direction (optional, e.g. cyberpunk, darker tone, comedy)..."
                            value={detailRemixGuidance}
                            onChange={(e) => setDetailRemixGuidance(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void handleRemixDetailTemplate(detailTemplate);
                                }
                            }}
                            sx={{
                                flex: 1,
                                '& .MuiInputBase-root': {
                                    fontSize: '0.78rem',
                                    bgcolor: darkMode ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.9)',
                                    color: textColor,
                                    borderRadius: 2,
                                },
                            }}
                        />
                        <Button
                            {...cb('templates', `remix_${detailTemplate.id}`, `Ask AI to remix ${detailTemplate.name}`, 'handleRemixDetailTemplate', 'click', 'information_only', 'Generates a new variation of this template for 1p using an optional requested twist.')}
                            size="small"
                            variant="contained"
                            disabled={isRemixingDetail}
                            onClick={() => void handleRemixDetailTemplate(detailTemplate)}
                            sx={{
                                borderRadius: 999,
                                textTransform: 'none',
                                fontWeight: 800,
                                fontSize: '0.74rem',
                                px: 1.8,
                                py: 0.55,
                                bgcolor: appColor,
                                color: accentButtonTextColor,
                                flexShrink: 0,
                                boxShadow: `0 2px 10px ${appColor}33`,
                                '&:hover': { bgcolor: appColorHover },
                            }}
                        >
                            {isRemixingDetail ? (
                                <CircularProgress size={14} sx={{ color: '#fff' }} />
                            ) : (
                                'Remix (1p)'
                            )}
                        </Button>
                    </Box>

                    {/* Full Scrollable Prompt Text Box */}
                    <Box
                        sx={{
                            p: { xs: 2, sm: 2.75 },
                            borderRadius: 2.5,
                            border: `1px solid ${subtleBorder}`,
                            bgcolor: darkMode ? 'rgba(0,0,0,0.32)' : '#ffffff',
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1.25,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                            <Typography
                                sx={{
                                    color: mutedTextColor,
                                    fontSize: '0.74rem',
                                    fontWeight: 800,
                                    textTransform: 'uppercase',
                                    letterSpacing: 0.8,
                                }}
                            >
                                {isEditingPrompt ? 'Edit Template Script' : 'Full Prompt Text'}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {canModifyDetail && !isEditingPrompt && (
                                    <Button
                                        size="small"
                                        startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                                        onClick={handleStartEditing}
                                        sx={{
                                            textTransform: 'none',
                                            fontSize: '0.74rem',
                                            fontWeight: 700,
                                            color: textColor,
                                            bgcolor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                            borderRadius: 999,
                                            px: 1.5,
                                            py: 0.25,
                                            '&:hover': { bgcolor: `${appColor}22`, color: appColor },
                                        }}
                                    >
                                        Edit Template
                                    </Button>
                                )}
                                <Button
                                    size="small"
                                    startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
                                    onClick={() => {
                                        if (detailTemplate?.basePrompt) {
                                            void navigator.clipboard.writeText(detailTemplate.basePrompt);
                                            setFeedback({ message: 'Prompt copied to clipboard!', severity: 'success' });
                                        }
                                    }}
                                    sx={{
                                        textTransform: 'none',
                                        fontSize: '0.74rem',
                                        fontWeight: 700,
                                        color: textColor,
                                        bgcolor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                        borderRadius: 999,
                                        px: 1.5,
                                        py: 0.25,
                                        '&:hover': { bgcolor: `${appColor}22` },
                                    }}
                                >
                                    Copy Prompt
                                </Button>
                            </Box>
                        </Box>

                        {isEditingPrompt ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 0.5 }}>
                                <TextField
                                    label="Template Title"
                                    size="small"
                                    fullWidth
                                    value={editingTitle}
                                    onChange={(e) => setEditingTitle(e.target.value)}
                                    sx={{
                                        '& .MuiInputBase-root': {
                                            bgcolor: darkMode ? 'rgba(0,0,0,0.3)' : '#f8f9fa',
                                            color: textColor,
                                            fontWeight: 700,
                                        },
                                        '& .MuiInputLabel-root': {
                                            color: mutedTextColor,
                                        },
                                    }}
                                />
                                <TextField
                                    label="Template Prompt / Script"
                                    multiline
                                    minRows={4}
                                    maxRows={12}
                                    fullWidth
                                    value={editingPromptText}
                                    onChange={(e) => setEditingPromptText(e.target.value)}
                                    sx={{
                                        '& .MuiInputBase-root': {
                                            bgcolor: darkMode ? 'rgba(0,0,0,0.3)' : '#f8f9fa',
                                            color: textColor,
                                            fontSize: { xs: '0.95rem', sm: '1.05rem' },
                                            lineHeight: 1.6,
                                        },
                                        '& .MuiInputLabel-root': {
                                            color: mutedTextColor,
                                        },
                                    }}
                                />
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, mt: 0.5 }}>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        disabled={isSavingEdit}
                                        onClick={handleCancelEditing}
                                        sx={{
                                            borderRadius: 999,
                                            textTransform: 'none',
                                            fontWeight: 700,
                                            fontSize: '0.78rem',
                                            px: 2,
                                            color: textColor,
                                            borderColor: subtleBorder,
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        disabled={isSavingEdit}
                                        onClick={() => void handleSavePromptEdit()}
                                        sx={{
                                            borderRadius: 999,
                                            textTransform: 'none',
                                            fontWeight: 800,
                                            fontSize: '0.78rem',
                                            px: 2.2,
                                            bgcolor: appColor,
                                            color: accentButtonTextColor,
                                            boxShadow: `0 2px 10px ${appColor}33`,
                                            '&:hover': { bgcolor: appColorHover },
                                        }}
                                    >
                                        {isSavingEdit ? <CircularProgress size={16} sx={{ color: accentButtonTextColor }} /> : 'Save Changes'}
                                    </Button>
                                </Box>
                            </Box>
                        ) : (
                            <Typography
                                data-template-readable="template-script"
                                {...cb('templates', 'zoomed_template_script', `Full script for ${detailTemplate.name}`, 'TemplateLibrary.detailText', 'click', 'information_only')}
                                sx={{
                                    color: textColor,
                                    fontSize: { xs: '1.05rem', sm: '1.18rem', md: '1.24rem' },
                                    lineHeight: { xs: 1.68, sm: 1.76 },
                                    fontWeight: 500,
                                    letterSpacing: '0.01em',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    userSelect: 'text',
                                }}
                            >
                                {detailTemplate.basePrompt}
                            </Typography>
                        )}
                    </Box>
                </Box>
            ) : expandedCategory ? (
                /* 2️⃣ EXPANDED VERTICAL GRID FOR A SINGLE CATEGORY */
                <Box
                    key={`expanded-${expandedCategory}`}
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: 'auto',
                        pr: 0.5,
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: '1fr',
                            sm: 'repeat(2, minmax(0, 1fr))',
                            md: 'repeat(3, minmax(0, 1fr))',
                        },
                        gap: 1.5,
                        alignContent: 'start',
                    }}
                >
                    {expandedCategory === 'Library' ? (
                        <>
                            {renderAiAutoTemplateCard(false)}
                            {(templatesByCategory[expandedCategory] || []).map((t) =>
                                renderTemplateCard(t, false)
                            )}
                        </>
                    ) : (templatesByCategory[expandedCategory] || []).length === 0 ? (
                        <Box
                            sx={{
                                gridColumn: '1 / -1',
                                py: 6,
                                textAlign: 'center',
                                color: mutedTextColor,
                            }}
                        >
                            <Typography sx={{ fontWeight: 800, fontSize: '0.92rem', color: textColor, mb: 0.5 }}>
                                {`No templates in ${expandedCategory}`}
                            </Typography>
                            <Typography sx={{ fontSize: '0.78rem' }}>
                                Create a new template above to populate this category.
                            </Typography>
                        </Box>
                    ) : (
                        (templatesByCategory[expandedCategory] || []).map((t) =>
                            renderTemplateCard(t, false)
                        )
                    )}
                </Box>
            ) : (
                /* 3️⃣ DEFAULT VIEW: STACKED HORIZONTAL CATEGORY SLIDERS (LIBRARY ON TOP) */
                <Box
                    key="template-base-page-scroller"
                    ref={baseScrollerRef}
                    onScroll={event => { baseScrollPositionRef.current = event.currentTarget.scrollTop; }}
                    {...cb('templates', 'scroll', 'Scroll template categories', 'TemplateLibrary.scrollBy', 'scroll')}
                    sx={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: 'auto',
                        pr: 0.5,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6.5, // 52px generous separation between category slider rows
                        pb: 6,
                        pt: 1,
                    }}
                >
                    {orderedCategories.map((cat) => {
                        const rowItems = templatesByCategory[cat] || [];
                        if (cat !== 'Library' && rowItems.length === 0) return null;
                        const canScrollThisRow = rowScrollableMap[cat] ?? (cat === 'Library' ? true : rowItems.length > 3);

                        return (
                            <Box
                                key={cat}
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1.5,
                                    mb: 2, // Extra bottom margin so each horizontal slider row has distinct separation
                                    flexShrink: 0,
                                }}
                            >
                                {/* Category Row Header */}
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        px: 0.5,
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography
                                            sx={{
                                                color: textColor,
                                                fontWeight: 800,
                                                fontSize: '1.05rem',
                                                letterSpacing: '0.01em',
                                            }}
                                        >
                                            {cat === 'Library' ? 'My Library' : cat}
                                        </Typography>
                                        <Chip
                                            size="small"
                                            label={rowItems.length}
                                            sx={{
                                                height: 20,
                                                fontSize: '0.68rem',
                                                fontWeight: 800,
                                                bgcolor:
                                                    cat === 'Library'
                                                        ? `${appColor}25`
                                                        : darkMode
                                                        ? 'rgba(255,255,255,0.08)'
                                                        : 'rgba(0,0,0,0.06)',
                                                color: cat === 'Library' ? appColor : mutedTextColor,
                                            }}
                                        />
                                    </Box>

                                    {(rowItems.length > 0 || cat === 'Library') && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            {canScrollThisRow && (
                                                <>
                                                    <IconButton
                                                        size="small"
                                                        {...cb('templates', `row_left_${cat}`, `Previous ${cat} templates`, 'scrollCategoryRow(left)')}
                                                        onClick={() => scrollCategoryRow(cat, 'left')}
                                                        sx={{
                                                            width: 26,
                                                            height: 26,
                                                            color: textColor,
                                                            border: `1px solid ${subtleBorder}`,
                                                        }}
                                                    >
                                                        <ChevronLeftIcon sx={{ fontSize: 17 }} />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        {...cb('templates', `row_right_${cat}`, `Next ${cat} templates`, 'scrollCategoryRow(right)')}
                                                        onClick={() => scrollCategoryRow(cat, 'right')}
                                                        sx={{
                                                            width: 26,
                                                            height: 26,
                                                            color: textColor,
                                                            border: `1px solid ${subtleBorder}`,
                                                        }}
                                                    >
                                                        <ChevronRightIcon sx={{ fontSize: 17 }} />
                                                    </IconButton>
                                                </>
                                            )}
                                            <Button
                                                {...cb('templates', `expand_${cat}`, `Expand ${cat} category`, 'openExpandedCategory')}
                                                size="small"
                                                endIcon={<OpenInFullIcon sx={{ fontSize: 13 }} />}
                                                onClick={() => openExpandedCategory(cat)}
                                                sx={{
                                                    ml: 0.25,
                                                    borderRadius: 999,
                                                    textTransform: 'none',
                                                    fontWeight: 800,
                                                    fontSize: '0.72rem',
                                                    px: 1.25,
                                                    py: 0.3,
                                                    color: textColor,
                                                    border: `1px solid ${subtleBorder}`,
                                                    '&:hover': {
                                                        borderColor: appColor,
                                                        bgcolor: `${appColor}14`,
                                                    },
                                                }}
                                            >
                                                Expand
                                            </Button>
                                        </Box>
                                    )}
                                </Box>

                                {/* Horizontal Slider Track */}
                                {cat === 'Library' ? (
                                    <Box
                                        data-template-row-slider="true"
                                        data-template-category={cat}
                                        data-creation-horizontal-strip="true"
                                        ref={rowRef(cat)}
                                        onScroll={event => { rowPositionsRef.current[cat] = event.currentTarget.scrollLeft; }}
                                        sx={{
                                            display: 'flex',
                                            gap: 1.75,
                                            overflowX: 'auto',
                                            overflowY: 'hidden',
                                            overscrollBehaviorX: 'contain',
                                            pb: 1,
                                            pt: 0.5,
                                            px: 0.25,
                                            scrollbarWidth: 'none !important' as any,
                                            msOverflowStyle: 'none !important' as any,
                                            '&::-webkit-scrollbar': {
                                                display: 'none !important',
                                                width: '0px !important',
                                                height: '0px !important',
                                            },
                                        }}
                                    >
                                        {/* FIRST CARD: AI AUTO TEMPLATE */}
                                        {renderAiAutoTemplateCard(true)}
                                        {rowItems.map((t) => renderTemplateCard(t, true, cat))}
                                    </Box>
                                ) : rowItems.length === 0 ? (
                                    <Box
                                        sx={{
                                            py: 2,
                                            px: 2.5,
                                            borderRadius: 2.5,
                                            border: `1px dashed ${subtleBorder}`,
                                            bgcolor: darkMode
                                                ? 'rgba(255,255,255,0.02)'
                                                : 'rgba(0,0,0,0.02)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                        }}
                                    >
                                        <Typography sx={{ color: mutedTextColor, fontSize: '0.78rem', fontWeight: 600 }}>
                                            No templates in this category yet.
                                        </Typography>
                                    </Box>
                                ) : (
                                    <Box
                                        data-template-row-slider="true"
                                        data-template-category={cat}
                                        data-creation-horizontal-strip="true"
                                        ref={rowRef(cat)}
                                        onScroll={event => { rowPositionsRef.current[cat] = event.currentTarget.scrollLeft; }}
                                        sx={{
                                            display: 'flex',
                                            gap: 1.75,
                                            overflowX: 'auto',
                                            overflowY: 'hidden',
                                            overscrollBehaviorX: 'contain',
                                            pb: 1,
                                            pt: 0.5,
                                            px: 0.25,
                                            scrollbarWidth: 'none !important' as any,
                                            msOverflowStyle: 'none !important' as any,
                                            '&::-webkit-scrollbar': {
                                                display: 'none !important',
                                                width: '0px !important',
                                                height: '0px !important',
                                            },
                                        }}
                                    >
                                        {rowItems.map((t) => renderTemplateCard(t, true, cat))}
                                    </Box>
                                )}
                            </Box>
                        );
                    })}
                </Box>
            )}

            {props.hasMore && props.onFetchMore && (
                <Button {...cb('templates', 'load_more', 'Load more saved templates', 'onFetchMore')}
                    disabled={isFetchingMore} onClick={async () => {
                        setIsFetchingMore(true);
                        try { await props.onFetchMore?.(); }
                        finally { setIsFetchingMore(false); }
                    }} sx={{ flexShrink: 0, color: textColor }}>
                    {isFetchingMore ? 'Loading...' : 'Load more templates'}
                </Button>
            )}

            {/* ───────────────────────── FULLSCREEN IMAGE POP-UP MODAL ───────────────────────── */}
            <Modal
                container={typeof document !== 'undefined' ? document.body : undefined}
                disablePortal={false}
                disableEnforceFocus
                disableAutoFocus
                disableRestoreFocus
                open={Boolean(fullScreenImage)}
                onClose={handleUiBack}
                sx={{
                    zIndex: TEMPLATE_LIBRARY_Z_INDEX + 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: { xs: 1, sm: 2 },
                    bgcolor: 'rgba(0,0,0,0.88)',
                    backdropFilter: 'blur(12px)',
                }}
            >
                <Box
                    onClick={handleUiBack}
                    sx={{
                        position: 'relative',
                        maxWidth: '96vw',
                        maxHeight: '94vh',
                        outline: 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <IconButton
                        onClick={(e) => {
                            e.stopPropagation();
                            handleUiBack();
                        }}
                        sx={{
                            position: 'absolute',
                            top: { xs: -12, sm: -16 },
                            right: { xs: -12, sm: -16 },
                            bgcolor: 'rgba(0,0,0,0.85)',
                            color: '#fff',
                            border: '1px solid rgba(255,255,255,0.3)',
                            '&:hover': { bgcolor: '#000' },
                            zIndex: 10,
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                    {fullScreenImage && (
                        <Box
                            component="img"
                            src={fullScreenImage.url}
                            alt={fullScreenImage.title}
                            onClick={(e) => e.stopPropagation()}
                            sx={{
                                maxWidth: '96vw',
                                maxHeight: '92vh',
                                width: 'auto',
                                height: 'auto',
                                objectFit: 'contain',
                                borderRadius: 2,
                                boxShadow: '0 24px 80px rgba(0,0,0,0.95)',
                                display: 'block',
                            }}
                        />
                    )}
                </Box>
            </Modal>

            {/* ───────────────────────── CARD IMAGE GENERATE / RE-GENERATE MENU (HD 6p / SD 1p) ───────────────────────── */}
            <Menu
                anchorEl={cardMenuAnchor?.el}
                open={Boolean(cardMenuAnchor)}
                onClose={() => setCardMenuAnchor(null)}
                sx={{ zIndex: TEMPLATE_LIBRARY_Z_INDEX + 10 }}
                slotProps={{
                    root: {
                        sx: { zIndex: TEMPLATE_LIBRARY_Z_INDEX + 10 },
                    },
                    paper: {
                        sx: {
                            zIndex: TEMPLATE_LIBRARY_Z_INDEX + 10,
                            bgcolor: darkMode ? '#181a20' : '#ffffff',
                            border: `1px solid ${subtleBorder}`,
                            boxShadow: darkMode ? '0 16px 40px rgba(0,0,0,0.85)' : '0 12px 36px rgba(0,0,0,0.18)',
                            borderRadius: 3,
                            minWidth: 260,
                            py: 0.75,
                        },
                    },
                }}
            >
                <Box sx={{ px: 2, pt: 1, pb: 0.5 }}>
                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: mutedTextColor }}>
                        {cardMenuAnchor?.template && hasRealTemplateImage(cardMenuAnchor.template.thumbnailUrl)
                            ? 'Re-generate Cover Art'
                            : 'Generate Cover Art'}
                    </Typography>
                </Box>
                {(['hd', 'sd2', 'sd'] as TemplateCoverQuality[]).map(quality => {
                    const config = TEMPLATE_COVER_MODELS[quality];
                    const cost = getImageModelPixelCost(config.model) ?? 1;
                    const template = cardMenuAnchor?.template;
                    const owner = Boolean(import.meta.env.DEV) || (Number(loggedUser?.id) !== 1 && Number(template?.userId) === Number(loggedUser?.id));
                    return <MenuItem key={quality}
                        disabled={!template || coverProgress[templateCoverKey(template)] !== undefined || (quality === 'sd' && !owner)}
                        {...cb('templates', `detail_cover_${quality}`, `${quality.toUpperCase()} ${config.label} cover (${cost}p)`, `handleGenerateTemplatePreview(${quality})`)}
                        onClick={event => {
                            if (!template) return; setCardMenuAnchor(null);
                            void handleGenerateTemplatePreview(event, template, quality);
                        }} sx={{ py: 1.25, px: 2, borderRadius: 1.5, mx: 0.5, '&:hover': { bgcolor: `${appColor}15` } }}>
                        <ListItemIcon sx={{ color: quality === 'sd' ? mutedTextColor : appColor, minWidth: 34 }}>
                            <AutoFixHighIcon sx={{ fontSize: 19 }} />
                        </ListItemIcon>
                        <ListItemText primary={`${hasRealTemplateImage(template?.thumbnailUrl) ? 'Re-generate' : 'Generate'} ${quality.toUpperCase()} (${cost}p)`}
                            secondary={`${config.label} · 16:9 Landscape`}
                            primaryTypographyProps={{ fontWeight: 800, fontSize: '0.84rem', color: textColor }}
                            secondaryTypographyProps={{ fontSize: '0.7rem', color: mutedTextColor }} />
                    </MenuItem>;
                })}
            </Menu>

            {/* ───────────────────────── AI AUTO TEMPLATE INSPECTION POP-UP MODAL ───────────────────────── */}
            <Modal
                container={typeof document !== 'undefined' ? document.body : undefined}
                disablePortal={false}
                disableEnforceFocus
                disableAutoFocus
                disableRestoreFocus
                open={Boolean(aiGeneratedTemplate)}
                onClose={handleUiBack}
                sx={{
                    zIndex: TEMPLATE_LIBRARY_Z_INDEX + 5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: { xs: 1.5, sm: 3 },
                    backdropFilter: 'blur(16px)',
                    bgcolor: 'rgba(0,0,0,0.72)',
                }}
            >
                <Box
                    onClick={(e) => e.stopPropagation()}
                    sx={{
                        width: { xs: '96vw', sm: '88vw', md: '760px' },
                        maxHeight: '90vh',
                        bgcolor: darkMode ? '#12141a' : '#ffffff',
                        borderRadius: 3.5,
                        border: `1px solid ${subtleBorder}`,
                        boxShadow: darkMode
                            ? '0 24px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.08)'
                            : '0 24px 80px rgba(0,0,0,0.22)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        outline: 'none',
                    }}
                >
                    {/* Header */}
                    <Box
                        sx={{
                            px: 2.5,
                            py: 1.8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: `1px solid ${subtleBorder}`,
                            bgcolor: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                            <Chip
                                icon={<AutoAwesomeIcon sx={{ fontSize: '13px !important', color: `${appColor} !important` }} />}
                                label="AI Auto Template"
                                size="small"
                                sx={{
                                    fontWeight: 900,
                                    fontSize: '0.7rem',
                                    bgcolor: `${appColor}18`,
                                    color: appColor,
                                    border: `1px solid ${appColor}33`,
                                }}
                            />
                            <Typography
                                sx={{
                                    color: textColor,
                                    fontWeight: 900,
                                    fontSize: { xs: '0.9rem', sm: '1.02rem' },
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {aiGeneratedTemplate?.title || 'Creative Story Seed'}
                            </Typography>
                        </Box>

                        <IconButton
                            size="small"
                            {...cb('templates', 'result_back', 'Back to template gallery', 'handleUiBack')}
                            onClick={handleUiBack}
                            sx={{
                                width: 32,
                                height: 32,
                                color: textColor,
                                border: `1px solid ${subtleBorder}`,
                                borderRadius: 2,
                            }}
                        >
                            <CloseIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </Box>

                    {/* Content Body: Large Prominent Typography */}
                    <Box
                        sx={{
                            p: { xs: 2.2, sm: 3.2 },
                            flex: 1,
                            overflowY: 'auto',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1.8,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                            <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                                <Chip
                                    size="small"
                                    label={aiGeneratedTemplate?.category || 'Shorts & Viral'}
                                    sx={{
                                        fontWeight: 800,
                                        fontSize: '0.68rem',
                                        bgcolor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                                        color: textColor,
                                    }}
                                />
                                <Chip
                                    size="small"
                                    label={`Art Style: ${aiGeneratedTemplate?.artStyle || 'PhotoRealistic'}`}
                                    sx={{
                                        fontWeight: 700,
                                        fontSize: '0.68rem',
                                        bgcolor: darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                                        color: textColor,
                                    }}
                                />
                                {aiGeneratedTemplate?.sourceTemplateName && (
                                    <Chip
                                        size="small"
                                        icon={<AutoAwesomeIcon sx={{ fontSize: '12px !important', color: `${appColor} !important` }} />}
                                        label={`Remixed: ${aiGeneratedTemplate.sourceTemplateName}`}
                                        sx={{
                                            fontWeight: 800,
                                            fontSize: '0.68rem',
                                            bgcolor: `${appColor}18`,
                                            color: appColor,
                                            border: `1px solid ${appColor}33`,
                                        }}
                                    />
                                )}
                            </Box>
                            <Button
                                size="small"
                                startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
                                onClick={() => {
                                    if (aiGeneratedTemplate?.prompt) {
                                        navigator.clipboard.writeText(aiGeneratedTemplate.prompt);
                                        setFeedback({ message: 'Prompt copied to clipboard!', severity: 'success' });
                                    }
                                }}
                                sx={{
                                    textTransform: 'none',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    color: mutedTextColor,
                                    border: `1px solid ${subtleBorder}`,
                                    borderRadius: 999,
                                    px: 1.2,
                                    '&:hover': { color: textColor, borderColor: appColor },
                                }}
                            >
                                Copy Prompt
                            </Button>
                        </Box>

                        {/* Large prompt typography */}
                        <Box
                            sx={{
                                p: { xs: 2, sm: 2.5 },
                                borderRadius: 3,
                                bgcolor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
                                border: `1px solid ${subtleBorder}`,
                            }}
                        >
                            <Typography data-template-readable="template-idea"
                            {...cb('templates', 'ai_result_script', 'Full generated template idea', 'TemplateLibrary.aiResultText', 'click', 'information_only')}
                                sx={{
                                    color: textColor,
                                    fontSize: { xs: '1.05rem', sm: '1.18rem', md: '1.24rem' },
                                    lineHeight: 1.76,
                                    fontWeight: 500,
                                    letterSpacing: '0.01em',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    userSelect: 'text',
                                }}
                            >
                                {aiGeneratedTemplate?.prompt}
                            </Typography>
                        </Box>
                    </Box>

                    {/* Footer Actions */}
                    <Box
                        sx={{
                            px: 2.5,
                            py: 1.8,
                            borderTop: `1px solid ${subtleBorder}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 1.25,
                            bgcolor: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                        }}
                    >
                        <Button
                            size="small"
                            startIcon={<RefreshIcon sx={{ fontSize: 15 }} />}
                            disabled={isGeneratingAiTemplate || isRemixingDetail}
                            onClick={() => {
                                if (detailTemplate && aiGeneratedTemplate?.sourceTemplateName === detailTemplate.name) {
                                    void handleRemixDetailTemplate(detailTemplate);
                                } else {
                                    void handleGenerateAiTemplate();
                                }
                            }}
                            sx={{
                                borderRadius: 999,
                                textTransform: 'none',
                                fontWeight: 800,
                                fontSize: '0.75rem',
                                px: 1.6,
                                py: 0.55,
                                color: textColor,
                                border: `1px solid ${subtleBorder}`,
                                bgcolor: darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                                '&:hover': { borderColor: appColor, color: appColor },
                            }}
                        >
                            {isGeneratingAiTemplate || isRemixingDetail ? 'Generating...' : 'Re-roll ✨'}
                        </Button>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {onOpenBrainstorm && (
                                <Button
                                    size="small"
                                    startIcon={<AutoFixHighIcon sx={{ fontSize: 16 }} />}
                                    {...cb('templates', 'ai_create_template', 'Create an editable template from this idea', 'onOpenBrainstorm(manual)')}
                                    onClick={() => {
                                        if (!aiGeneratedTemplate) return;
                                        const p = aiGeneratedTemplate.prompt;
                                        const t = aiGeneratedTemplate.title;
                                        const a = aiGeneratedTemplate.artStyle;
                                        handleUiClose(() => onOpenBrainstorm?.({
                                            isAIEnabled: false,
                                            view: 'chat',
                                            title: t,
                                            prompt: p,
                                            artStyle: a,
                                        }));
                                    }}
                                    sx={{
                                        borderRadius: 999,
                                        textTransform: 'none',
                                        fontWeight: 800,
                                        fontSize: '0.75rem',
                                        px: 1.8,
                                        py: 0.55,
                                        color: accentButtonTextColor,
                                        bgcolor: appColor,
                                        boxShadow: `0 4px 14px ${appColor}33`,
                                        '&:hover': { bgcolor: appColorHover },
                                    }}
                                >
                                    Create Template ✨
                                </Button>
                            )}
                            <Button
                                size="small"
                                startIcon={aiGeneratedTemplate?.isSaved ? <BookmarkAddedIcon sx={{ fontSize: 16 }} /> : <BookmarkBorderIcon sx={{ fontSize: 16 }} />}
                                disabled={isSavingAiTemplate || Boolean(aiGeneratedTemplate?.isSaved)}
                                {...cb('templates', 'ai_save_library', 'Save idea to Library', 'handleSaveAiTemplateToLibrary', 'click', 'needs_confirmation')}
                                onClick={handleSaveAiTemplateToLibrary}
                                sx={{
                                    borderRadius: 999,
                                    textTransform: 'none',
                                    fontWeight: 800,
                                    fontSize: '0.75rem',
                                    px: 1.6,
                                    py: 0.55,
                                    color: aiGeneratedTemplate?.isSaved ? appColor : textColor,
                                    border: `1px solid ${aiGeneratedTemplate?.isSaved ? appColor : subtleBorder}`,
                                    bgcolor: aiGeneratedTemplate?.isSaved ? `${appColor}18` : 'transparent',
                                    '&:hover': { borderColor: appColor },
                                }}
                            >
                                {isSavingAiTemplate ? (
                                    <CircularProgress size={14} sx={{ color: appColor }} />
                                ) : aiGeneratedTemplate?.isSaved ? (
                                    'Saved in Library'
                                ) : (
                                    'Save to Library'
                                )}
                            </Button>

                            <Button
                                size="small"
                                variant="contained"
                                startIcon={<CheckCircleOutlineIcon sx={{ fontSize: 16 }} />}
                                {...cb('templates', 'ai_use_template', 'Use this idea in the prompt', 'handleUseAiGeneratedTemplate')}
                                onClick={handleUseAiGeneratedTemplate}
                                sx={{
                                    borderRadius: 999,
                                    textTransform: 'none',
                                    fontWeight: 900,
                                    fontSize: '0.78rem',
                                    px: 2.2,
                                    py: 0.65,
                                    bgcolor: appColor,
                                    color: accentButtonTextColor,
                                    boxShadow: `0 4px 16px ${appColor}44`,
                                    '&:hover': { bgcolor: appColorHover },
                                }}
                            >
                                Use Template
                            </Button>
                        </Box>
                    </Box>
                </Box>
            </Modal>

            <Snackbar
                open={feedback !== null}
                autoHideDuration={2600}
                onClose={() => setFeedback(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                sx={{ position: 'absolute', zIndex: TEMPLATE_LIBRARY_Z_INDEX + 20 }}
            >
                <Alert
                    severity={feedback?.severity || 'success'}
                    variant="filled"
                    onClose={() => setFeedback(null)}
                    sx={{ fontWeight: 800 }}
                >
                    {feedback?.message || ''}
                </Alert>
            </Snackbar>
        </Box>
    );
}));
