import { isOpenAiConversationProfile } from './conversationModels';
import React, { useEffect } from 'react';
import { creationBinding as cb } from './creationControlSnapshot';
import { useCreationControls } from './useCreationControls';
import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useDispatch, useSelector } from 'react-redux';
import { CONVERSATION_MODELS } from './conversationModels';
import { notifyOpenAiSelected } from './openAiSelection';
import { setConversationModel } from './settingsSlice';
import type { RootState } from './store';
import { recordNavigationTransition } from './brainstormSlice';
import type { NavigationViewport } from './navigationControlSnapshot';
import { useNavigationViewport } from './useNavigationViewport';

interface ConversationModelPickerProps {
    darkMode: boolean;
    matchMobile: boolean;
    appColor: string;
    showImages?: boolean;
    navigationAreaId?: 'clikb.settings';
    onViewportChange?: (viewport: NavigationViewport | null) => void;
}

/** The same conversation-only choice in creation and Settings. */
const ConversationModelPicker: React.FC<ConversationModelPickerProps> = ({ darkMode, matchMobile, appColor, showImages = true, navigationAreaId, onViewportChange }) => {
    const dispatch = useDispatch();
    const conversationModel = useSelector((state: RootState) => state.settings.conversationModel);
    const modelViewport = useNavigationViewport('horizontal', matchMobile);
    useCreationControls('conversation_model', 'ConversationModelPicker', !navigationAreaId, { conversationModel });
    useEffect(() => { onViewportChange?.(modelViewport.viewport); }, [onViewportChange, modelViewport.viewport]);

    return (
        <Box sx={{ px: 2, pt: 1, pb: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: darkMode ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.7)' }}>
                    Conversation AI
                </Typography>
            </Box>
            <Box className="social-picker-scroll" ref={modelViewport.ref} onScroll={modelViewport.onScroll} data-ai-scroll={navigationAreaId ? `${navigationAreaId}:model_strip` : undefined} sx={{ display: 'flex', gap: 1.25, overflowX: 'auto', overflowY: 'hidden', pb: 0.5, WebkitOverflowScrolling: 'touch', scrollSnapType: 'x proximity', '&::-webkit-scrollbar': { height: 4 }, '&::-webkit-scrollbar-thumb': { background: alpha(appColor, 0.4), borderRadius: 2 } }}>
                {CONVERSATION_MODELS.map((model) => {
                    const isActive = model.id === conversationModel;
                    return (
                        <Box
                        key={model.id}
                        data-navigation-scroll-id={navigationAreaId ? `${navigationAreaId}.control.conversation_${model.id}` : undefined}
                        data-ai-action={navigationAreaId ? `${navigationAreaId}.action.conversation_${model.id}` : undefined}
                        {...(!navigationAreaId ? cb('conversation_model', model.id, model.name, 'setConversationModel') : {})}
                            component="button"
                            type="button"
                            aria-label={`Use ${model.name} for conversation`}
                            aria-pressed={isActive}
                            onClick={async (event: React.MouseEvent) => {
                                event.stopPropagation();
                                if (isOpenAiConversationProfile(model.id)) await notifyOpenAiSelected();
                                dispatch(setConversationModel(model.id));
                                if (navigationAreaId && model.id !== conversationModel) dispatch(recordNavigationTransition({
                                    actor: 'manual', kind: 'control',
                                    before: { areaId: navigationAreaId, state: { conversationModel } },
                                    after: { areaId: navigationAreaId, controlId: `${navigationAreaId}.control.conversation_${model.id}`, state: { conversationModel: model.id } },
                                    outcome: 'succeeded', authoritativeSource: 'settings conversation-model Redux reducer',
                                }));
                            }}
                            sx={{
                                flex: '0 0 auto', width: matchMobile ? 130 : 148, scrollSnapAlign: 'start', cursor: 'pointer', textAlign: 'left', p: 0, borderRadius: 2, overflow: 'hidden', font: 'inherit', color: 'inherit',
                                border: `2px solid ${isActive ? appColor : 'transparent'}`,
                                background: isActive ? alpha(appColor, 0.14) : darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                boxShadow: isActive ? `0 0 12px ${alpha(appColor, 0.45)}` : 'none',
                                transition: 'border-color .15s, background .15s, box-shadow .15s',
                                '&:hover': { background: isActive ? alpha(appColor, 0.2) : darkMode ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)' },
                                '&:focus-visible': { outline: `2px solid ${appColor}`, outlineOffset: 2 },
                            }}
                        >
                            {showImages && <Box component="img" src={model.image} alt={`${model.name} conversation robot`} sx={{ display: 'block', width: '100%', height: 88, objectFit: 'cover', objectPosition: 'center 18%' }} />}
                            <Box sx={{ p: 0.75 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                    <Typography sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, lineHeight: 1.15, fontWeight: 700, color: darkMode ? '#fff' : '#000' }}>
                                        {model.name}
                                    </Typography>
                                    <Box sx={{ width: 10, height: 10, flex: '0 0 auto', borderRadius: '50%', border: `2px solid ${isActive ? appColor : darkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)'}`, background: isActive ? appColor : 'transparent' }} />
                                </Box>
                                <Typography sx={{ fontSize: 9, lineHeight: 1.2, mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}>
                                    {model.summary}
                                </Typography>
                            </Box>
                        </Box>
                    );
                })}
            </Box>
        </Box>
    );
};

export default ConversationModelPicker;
