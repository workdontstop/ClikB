// src/PromptConstructorMock.ts

export interface Template {
    id: string;
    name: string;
    basePrompt: string;
    thumbnailUrl: string;
    createdAt: number;
    isCustom: boolean;
    userId?: number;
    artStyle?: string;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'ai' | 'system';
    content: string;
    timestamp: number;
    /** True while this AI message is still being streamed in. */
    streaming?: boolean;
    /** Transient status shown during streaming, e.g. "Searching the webâ€¦". */
    status?: string;
}

export const DEFAULT_TEMPLATES: Template[] = [
    {
        id: 'tpl-001',
        name: 'Style Transfer',
        basePrompt: 'Apply the artistic style of [X] to',
        thumbnailUrl: 'https://clikboy-assets.s3.amazonaws.com/demos/style-transfer-thumb.jpg',
        createdAt: Date.now() - 86400000,
        isCustom: false
    },
    {
        id: 'tpl-002',
        name: 'Consistent Characters',
        basePrompt: 'Always describe [name] with [details] from input image.',
        thumbnailUrl: 'https://clikboy-assets.s3.amazonaws.com/demos/character-thumb.jpg',
        createdAt: Date.now() - 172800000,
        isCustom: false
    },
    {
        id: 'tpl-003',
        name: 'Historical Context',
        basePrompt: 'Recreate [subject] from [era] with authentic [architecture]',
        thumbnailUrl: 'https://clikboy-assets.s3.amazonaws.com/demos/history-thumb.jpg',
        createdAt: Date.now() - 259200000,
        isCustom: false
    },
    {
        id: 'tpl-004',
        name: 'Scene Composition',
        basePrompt: 'Create a [mood] scene with [subject] in [location]',
        thumbnailUrl: 'https://clikboy-assets.s3.amazonaws.com/demos/scene-thumb.jpg',
        createdAt: Date.now() - 345600000,
        isCustom: false
    }
];

export const MOCK_PREVIEW_IMAGES = [
    'https://clikboy-assets.s3.amazonaws.com/demos/preview-01.jpg',
    'https://clikboy-assets.s3.amazonaws.com/demos/preview-02.jpg',
    'https://clikboy-assets.s3.amazonaws.com/demos/preview-03.jpg',
    'https://clikboy-assets.s3.amazonaws.com/demos/preview-04.jpg',
    'https://clikboy-assets.s3.amazonaws.com/demos/preview-05.jpg',
];

export const MOCK_AI_RESPONSES = {
    characterConsistency: "Great! for character consistency, use: 'Always describe [character name] with [hair color/style], [clothing], [features] from input image.'",
    styleTransfer: "Perfect for style transfer: 'Apply stylistic elements of [artist/era] to [subject], focusing on [textures/lighting].'",
    refinement: "Here's a more detailed version: 'Create a highly detailed, cinematic scene of [subject] with [lighting] style, emphasizing [specific details].'",
    generic: "I can help you build that! How about: 'A professional [shot type] of [subject] in [setting], with [lighting] and [mood].'"
};

export const getAIResponse = (userMessage: string): string => {
    const lowerMsg = userMessage.toLowerCase();

    if (lowerMsg.includes('character') || lowerMsg.includes('consistent')) {
        return MOCK_AI_RESPONSES.characterConsistency;
    }
    if (lowerMsg.includes('style') || lowerMsg.includes('transfer')) {
        return MOCK_AI_RESPONSES.styleTransfer;
    }
    if (lowerMsg.includes('refine') || lowerMsg.includes('change')) {
        return MOCK_AI_RESPONSES.refinement;
    }

    return MOCK_AI_RESPONSES.generic;
};

export const getMockImageUrl = (text: string): string => {
    const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return MOCK_PREVIEW_IMAGES[hash % MOCK_PREVIEW_IMAGES.length];
};
