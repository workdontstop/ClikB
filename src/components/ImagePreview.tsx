import React from 'react';
import { Box, IconButton, Backdrop, Fade } from '@mui/material';
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
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
    previewImage, isGenerating, handleBackToGallery, glassStyle, isExpanded, onToggleExpand, appColor, containerHeight, topAlign
}) => {
    return (
        <>
            <Box
                sx={{
                    ...glassStyle,
                    p: 0,
                    height: { xs: 'auto', md: '100%' },
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {isGenerating ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: { xs: '30vh', md: '100%' } }}>
                    </Box>
                ) : (
                    <Box sx={{ width: '100%', height: { xs: 'auto', md: '100%' }, position: 'relative' }}>
                        <Box
                            onClick={onToggleExpand}
                            sx={{ width: '100%', height: { xs: 'auto', md: '100%' }, display: 'flex', alignItems: topAlign ? 'flex-start' : 'center', justifyContent: 'center' }}
                        >
                            <Box
                                component="img"
                                src={previewImage || ''}
                                alt="Preview"
                                sx={{
                                    width: '100%',
                                    height: { xs: 'auto', md: '100%' },
                                    maxHeight: { xs: '25vh', md: 'none' },
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

            {/* Full Screen Modal */}
            <Backdrop
                sx={{ zIndex: 9999, color: '#fff', backgroundColor: 'rgba(0,0,0,0.9)' }}
                open={isExpanded}
                onClick={onToggleExpand}
            >
                <Fade in={isExpanded}>
                    <Box
                        component="img"
                        src={previewImage || ''}
                        alt="Full Preview"
                        sx={{
                            width: '100%',
                            height: containerHeight ? `${containerHeight}px` : '100vh',
                            objectFit: 'contain',
                            display: 'block'
                        }}
                    />
                </Fade>
            </Backdrop>
        </>
    );
};
