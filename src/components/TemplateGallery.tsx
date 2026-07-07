// src/components/TemplateGallery.tsx
import React from 'react';
import { Box, IconButton, Typography, Card, CardContent, CardMedia, Grid, Button, Tooltip } from '@mui/material';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewListIcon from '@mui/icons-material/ViewList';
import AddIcon from '@mui/icons-material/Add';
import ImageIcon from '@mui/icons-material/Image';
import DeleteIcon from '@mui/icons-material/Delete';
import { Template } from '../PromptConstructorMock';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import PsychologyIcon from '@mui/icons-material/Psychology';

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
    previewImage, handleShowPreview, setMode, setChatHistory, darkMode, appColor, appColorHover, glassStyle,
    onFetchMore, hasMore, onDeleteTemplate
}) => {
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);
    return (
        <Box sx={{ background: 'transparent', p: 0, height: '100%', boxSizing: 'border-box' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5, position: 'relative', minHeight: '20px' }}>
                {/* Templates label hidden as requested */}
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
                        sx={{ width: 32, height: 32, color: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}
                    >
                        {viewMode === 'horizontal' ? <GridViewIcon fontSize="small" /> : <ViewListIcon fontSize="small" />}
                    </IconButton>
                </Box>
            </Box>

            {viewMode === 'horizontal' ? (
                <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
                    <Box
                        onClick={() => { setMode('brainstorm'); }}
                        sx={{
                            ...glassStyle,
                            minWidth: 80,
                            height: 70,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            border: `1px dashed rgba(255,255,255,0.4)`,
                            opacity: 0.8,
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            '&:hover': { transform: 'scale(1.02)', opacity: 1, background: 'rgba(255,255,255,0.05)' }
                        }}
                    >
                        <PsychologyIcon sx={{ fontSize: 24, color: '#fff', mb: 0.5 }} />
                        <Typography variant="caption" sx={{ color: darkMode ? '#fff' : '#000', fontWeight: 600, fontSize: 9 }}>
                            BrainStorm
                        </Typography>
                    </Box>

                    {templates.map(t => (
                        <Card
                            key={t.id}
                            onClick={() => handleTemplateSelect(t)}
                            sx={{
                                ...glassStyle,
                                minWidth: 80,
                                height: 70,
                                cursor: 'pointer',
                                transition: 'all 0.25s ease',
                                border: activeTemplateId === t.id
                                    ? `1px solid rgba(255,255,255,0.8)`
                                    : glassStyle.border,
                                '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 8px 24px rgba(0,0,0,0.2)` }
                            }}
                        >
                            <Box sx={{ position: 'relative' }}>
                                <CardMedia
                                    component="img"
                                    image={t.thumbnailUrl}
                                    alt={t.name}
                                    sx={{
                                        height: 48, objectFit: 'cover', objectPosition: '50% 30%',
                                    }}
                                />
                                {loggedUser && t.userId === loggedUser.id && (
                                    <Tooltip title="Delete Template">
                                        <IconButton
                                            size="small"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteTemplate?.(t);
                                            }}
                                            sx={{
                                                position: 'absolute',
                                                top: 2,
                                                right: 2,
                                                padding: 0.5,
                                                bgcolor: 'rgba(0,0,0,0.5)',
                                                color: '#fff',
                                                '&:hover': { bgcolor: 'rgba(211, 47, 47, 0.9)' }
                                            }}
                                        >
                                            <DeleteIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Box>
                            <CardContent sx={{ p: 0.25, textAlign: 'center' }}>
                                <Typography variant="caption" sx={{ fontSize: 8.5, lineHeight: 1, fontWeight: 700, color: darkMode ? '#fff' : '#000', textTransform: 'uppercase' }}>
                                    {t.name}
                                </Typography>
                            </CardContent>
                        </Card>
                    ))}

                    {hasMore && (
                        <Button
                            onClick={onFetchMore}
                            sx={{ minWidth: 60, height: 70, color: '#fff', fontWeight: 700, fontSize: 10 }}
                        >
                            More...
                        </Button>
                    )}
                </Box>
            ) : (
                <Box sx={{ height: 'calc(100% - 40px)', overflowY: 'auto', pr: 1 }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <Box
                                onClick={() => { setMode('brainstorm'); }}
                                sx={{
                                    ...glassStyle,
                                    p: 1.5,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    cursor: 'pointer',
                                    border: `1px dashed rgba(255,255,255,0.4)`,
                                    transition: 'all 0.2s',
                                    '&:hover': { background: 'rgba(255,255,255,0.05)' }
                                }}
                            >
                                <AddIcon sx={{ color: '#fff' }} />
                                <Typography sx={{ fontWeight: 600 }}>New AI Template</Typography>
                            </Box>
                        </Grid>
                        {templates.map(t => (
                            <Grid item xs={12} key={t.id}>
                                <Card
                                    onClick={() => handleTemplateSelect(t)}
                                    sx={{
                                        ...glassStyle,
                                        display: 'flex',
                                        p: 1,
                                        cursor: 'pointer',
                                        border: activeTemplateId === t.id
                                            ? `1px solid rgba(255,255,255,0.8)`
                                            : glassStyle.border,
                                        '&:hover': { background: 'rgba(255,255,255,0.03)' }
                                    }}
                                >
                                    <Box sx={{ position: 'relative' }}>
                                        <CardMedia
                                            component="img"
                                            image={t.thumbnailUrl}
                                            alt={t.name}
                                            sx={{ width: 80, height: 60, objectFit: 'cover', objectPosition: 'top', borderRadius: 2 }}
                                        />
                                        {loggedUser && t.userId === loggedUser.id && (
                                            <Tooltip title="Delete Template">
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeleteTemplate?.(t);
                                                    }}
                                                    sx={{
                                                        position: 'absolute',
                                                        top: -2,
                                                        right: -2,
                                                        padding: 0.25,
                                                        bgcolor: 'rgba(0,0,0,0.5)',
                                                        color: '#fff',
                                                        '&:hover': { bgcolor: 'rgba(211, 47, 47, 0.9)' }
                                                    }}
                                                >
                                                    <DeleteIcon sx={{ fontSize: 12 }} />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Box>
                                    <CardContent sx={{ flex: 1, p: 0, pl: 2 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700, color: darkMode ? '#fff' : '#000' }}>
                                            {t.name}
                                        </Typography>
                                        <Typography variant="caption" sx={{ fontSize: 11, color: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {t.basePrompt}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                        {hasMore && (
                            <Grid item xs={12}>
                                <Button
                                    fullWidth
                                    onClick={onFetchMore}
                                    sx={{ color: '#fff', fontWeight: 700, mt: 1 }}
                                >
                                    Load More Templates
                                </Button>
                            </Grid>
                        )}
                    </Grid>
                </Box>

            )}
        </Box>
    );
});

interface TemplateLibraryProps {
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
}

/**
 * Full Notepad overlay for saved BrainStorm results. The caller places this
 * inside the Notepad's positioned root, so it never becomes a separate modal.
 */
export const TemplateLibrary = React.memo<TemplateLibraryProps>(({
    templates,
    activeTemplateId,
    handleTemplateSelect,
    darkMode,
    appColor,
    appColorHover,
    onClose,
    onFetchMore,
    hasMore,
    onDeleteTemplate,
}) => {
    const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);
    const [pendingDeleteTemplateId, setPendingDeleteTemplateId] = React.useState<string | null>(null);
    const surface = darkMode ? 'rgba(18, 18, 22, 0.98)' : 'rgba(250, 250, 252, 0.98)';
    const textColor = darkMode ? '#fff' : '#111';
    const mutedTextColor = darkMode ? 'rgba(255,255,255,0.62)' : 'rgba(0,0,0,0.58)';

    return (
        <Box
            sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 20,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                height: '100%',
                overflow: 'hidden',
                p: { xs: 1.5, sm: 2 },
                background: surface,
                backdropFilter: 'blur(28px)',
                border: `1px solid ${appColor}`,
                borderRadius: 3,
                boxShadow: '0 18px 52px rgba(0,0,0,0.38)',
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1.5, flexShrink: 0 }}>
                <Box>
                    <Typography sx={{ color: textColor, fontWeight: 900, fontSize: '1rem', letterSpacing: '0.03em' }}>
                        Templates
                    </Typography>
                    <Typography variant="caption" sx={{ color: mutedTextColor }}>
                        Saved BrainStorm results
                    </Typography>
                </Box>
                <IconButton
                    aria-label="Close templates"
                    onClick={onClose}
                    sx={{
                        width: 38,
                        height: 38,
                        border: `1px solid ${appColor}`,
                        borderRadius: 2,
                        color: textColor,
                        fontSize: 28,
                        lineHeight: 1,
                        '&:hover': { borderColor: appColorHover, bgcolor: `${appColor}14` },
                    }}
                >
                    X
                </IconButton>
            </Box>

            <Box
                sx={{
                    display: 'grid',
                    flex: 1,
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: { xs: 1, sm: 1.5 },
                    overflowY: 'auto',
                    minHeight: 0,
                    pr: 0.5,
                    '&::-webkit-scrollbar': { width: 5 },
                    '&::-webkit-scrollbar-thumb': { borderRadius: 8, background: darkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' },
                }}
            >
                {templates.length === 0 && (
                    <Box sx={{ gridColumn: '1 / -1', py: 6, textAlign: 'center', color: mutedTextColor }}>
                        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>No saved templates yet</Typography>
                        <Typography variant="body2">Create one in BrainStorm, then save the result here.</Typography>
                    </Box>
                )}

                {templates.map((template) => (
                    <Card
                        key={template.id}
                        onClick={() => handleTemplateSelect(template)}
                        sx={{
                            cursor: 'pointer',
                            position: 'relative',
                            overflow: 'hidden',
                            background: darkMode ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.035)',
                            border: activeTemplateId === template.id
                                ? `2px solid ${appColor}`
                                : `1px solid ${darkMode ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
                            borderRadius: 2.5,
                            transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
                            '&:hover': {
                                transform: 'translateY(-2px)',
                                borderColor: appColorHover,
                                boxShadow: '0 10px 24px rgba(0,0,0,0.2)',
                            },
                        }}
                    >
                        <Box sx={{ position: 'relative' }}>
                            <CardMedia
                                component="img"
                                image={template.thumbnailUrl}
                                alt={template.name}
                                sx={{
                                    width: '100%',
                                    height: { xs: 200, sm: 280 },
                                    objectFit: 'contain',
                                    objectPosition: 'center top',
                                    display: 'block',
                                }}
                            />
                            {loggedUser && template.userId === loggedUser.id && (
                                <>
                                    <Tooltip title="Delete template">
                                    <IconButton
                                        size="small"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setPendingDeleteTemplateId(template.id);
                                        }}
                                        sx={{
                                            position: 'absolute',
                                            top: 6,
                                            right: 6,
                                            width: 28,
                                            height: 28,
                                            bgcolor: 'rgba(0,0,0,0.58)',
                                            color: '#fff',
                                            '&:hover': { bgcolor: 'rgba(211,47,47,0.94)' },
                                        }}
                                    >
                                        <DeleteIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </Tooltip>
                                    {pendingDeleteTemplateId === template.id && (
                                        <Box onClick={(event) => event.stopPropagation()} sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.75, p: 1, bgcolor: 'rgba(8,8,10,0.86)' }}>
                                            <Typography sx={{ color: '#fff', fontSize: '0.72rem', fontWeight: 800 }}>Delete template?</Typography>
                                            <Box sx={{ display: 'flex', gap: 0.75 }}>
                                                <Button size="small" onClick={() => setPendingDeleteTemplateId(null)} sx={{ minWidth: 0, px: 1, color: '#fff', border: '1px solid rgba(255,255,255,0.6)' }}>No</Button>
                                                <Button size="small" onClick={() => { onDeleteTemplate?.(template); setPendingDeleteTemplateId(null); }} sx={{ minWidth: 0, px: 1, color: '#fff', bgcolor: 'rgba(211,47,47,0.92)' }}>Yes</Button>
                                            </Box>
                                        </Box>
                                    )}
                                </>
                            )}
                        </Box>
                        <Typography noWrap sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2, px: 1.25, py: 0.8, bgcolor: 'rgba(12,12,15,0.92)', color: '#fff', fontWeight: 800, fontSize: { xs: '0.73rem', sm: '0.82rem' }, textTransform: 'uppercase' }}>
                            {template.name}
                        </Typography>
                    </Card>
                ))}

                {hasMore && (
                    <Button
                        onClick={onFetchMore}
                        variant="outlined"
                        sx={{
                            gridColumn: '1 / -1',
                            borderColor: appColor,
                            color: textColor,
                            fontWeight: 800,
                            '&:hover': { borderColor: appColorHover, bgcolor: `${appColor}14` },
                        }}
                    >
                        Load more templates
                    </Button>
                )}
            </Box>
        </Box>
    );
});
