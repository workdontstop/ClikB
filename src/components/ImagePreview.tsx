import React from 'react';
import { Box, IconButton, Backdrop, Fade, Portal } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface ImagePreviewProps {
    previewImage: string | null;
    isGenerating: boolean;
    handleBackToGallery: () => void;
    darkMode: boolean;
    appColor: string;
    glassStyle: any;
    ratioKey?: number;
    isExpanded: boolean;
    onToggleExpand: () => void;
    containerHeight?: number;
    topAlign?: boolean;
    stabilizeLayout?: boolean;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
    previewImage, isGenerating, handleBackToGallery, glassStyle, isExpanded, onToggleExpand, appColor, topAlign, stabilizeLayout = false
}) => {
    return (
        <>
            <Box
                sx={{
                    ...glassStyle,
                    p: 0,
                    height: stabilizeLayout ? '100%' : { xs: 'auto', md: '100%' },
                    minWidth: 0,
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    transition: stabilizeLayout ? 'opacity 0.2s ease' : 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden',
                    contain: stabilizeLayout ? 'layout paint' : undefined
                }}
            >
                {isGenerating ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: stabilizeLayout ? '100%' : { xs: '30vh', md: '100%' } }}>
                    </Box>
                ) : (
                    <Box sx={{ width: '100%', height: stabilizeLayout ? '100%' : { xs: 'auto', md: '100%' }, position: 'relative', minWidth: 0 }}>
                        <Box
                            onClick={onToggleExpand}
                            sx={{ width: '100%', height: stabilizeLayout ? '100%' : { xs: 'auto', md: '100%' }, display: 'flex', alignItems: topAlign ? 'flex-start' : 'center', justifyContent: 'center', minWidth: 0 }}
                        >
                            <Box
                                component="img"
                                src={previewImage || ''}
                                alt="Preview"
                                sx={{
                                    width: '100%',
                                    height: stabilizeLayout ? '100%' : { xs: 'auto', md: '100%' },
                                    maxWidth: '100%',
                                    maxHeight: stabilizeLayout ? '100%' : { xs: '25vh', md: 'none' },
                                    objectFit: 'contain',
                                    objectPosition: topAlign ? 'top' : 'center',
                                    display: 'block'
                                }}
                            />
                        </Box>

                        {/* Navigation Close Icon at Bottom */}
                        <IconButton
                            onClick={(e) => {
                                e.stopPropagation();
                                handleBackToGallery();
                            }}
                            sx={{
                                position: 'absolute',
                                bottom: 12,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                bgcolor: 'rgba(0,0,0,0.5)',
                                color: '#fff',
                                '&:hover': {
                                    bgcolor: appColor,
                                    color: '#000'
                                },
                                zIndex: 10
                            }}
                            size="small"
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>
                )}
            </Box>

            {/* Portal escapes every Notepad host dialog and stacking context. */}
            <Portal>
                <Backdrop
                    sx={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 2147483000,
                        color: '#fff',
                        backgroundColor: 'rgba(0,0,0,0.94)'
                    }}
                    open={isExpanded}
                    onClick={onToggleExpand}
                >
                    <IconButton
                        aria-label="Close full-screen preview"
                        onClick={(event) => {
                            event.stopPropagation();
                            onToggleExpand();
                        }}
                        sx={{
                            position: 'fixed',
                            top: 'max(18px, env(safe-area-inset-top))',
                            right: 'max(18px, env(safe-area-inset-right))',
                            zIndex: 2,
                            width: 56,
                            height: 56,
                            p: 1.5,
                            color: '#fff',
                            bgcolor: 'rgba(10,10,10,0.72)',
                            border: '1px solid rgba(255,255,255,0.18)',
                            backdropFilter: 'blur(12px)',
                            boxShadow: '0 8px 28px rgba(0,0,0,0.38)',
                            '&:hover': {
                                color: '#000',
                                bgcolor: appColor,
                            }
                        }}
                    >
                        <CloseIcon sx={{ fontSize: 30 }} />
                    </IconButton>
                    <Fade in={isExpanded}>
                        <Box
                            component="img"
                            src={previewImage || ''}
                            alt="Full Preview"
                            sx={{
                                width: '100vw',
                                height: '100dvh',
                                maxWidth: '100vw',
                                maxHeight: '100dvh',
                                objectFit: 'contain',
                                display: 'block'
                            }}
                        />
                    </Fade>
                </Backdrop>
            </Portal>
        </>
    );
};
