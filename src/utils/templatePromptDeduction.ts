/**
 * Template Cover Art Prompt Deduction Helper
 *
 * Synthesizes long multi-scene scripts, branching games, or conversational prompts
 * into a clean, unified, single-shot 16:9 cinematic master key-art prompt.
 *
 * This strictly prevents image models (Flux Schnell, GPT Image 2.5) from rendering
 * multi-panel collages, comic strips, or storyboard grids.
 */

export function distillCoverArtPromptRuleBased(
    basePrompt: string,
    title?: string,
    artStyle?: string
): string {
    if (!basePrompt && !title) return '';

    const raw = String(basePrompt || '').trim();

    // 1. Remove introductory conversational lines or intro sentences
    let cleaned = raw
        .replace(/^.*?here'?s a full official \d+[- ]scene script[^\n.:]*[:.]?\s*/i, '')
        .replace(/\b(?:create|write|show|build|design)\s+an?\s+(?:\w+\s+)?\d+[- ]scene\b[^\n.:]*[:.]?/gi, '')
        .replace(/\b\d+[- ]scene\b/gi, '')
        .replace(/\bScene\s*\d+\s*(?:\([^)]*\))?\s*[:\-–]?/gi, '')
        .replace(/\b(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\s+scene\b/gi, '')
        .replace(/\b(?:fail|success|victory|decision point)\s+branch[^\n.:]*[:.]?/gi, '')
        .replace(/\bScene\s*\d+\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    // 2. Extract establishing narrative core (first 1-2 sentences, max 320 chars)
    const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
    let coreNarrative = sentences.slice(0, 2).join(' ').trim();
    if (coreNarrative.length > 340) {
        coreNarrative = coreNarrative.slice(0, 337).trim() + '...';
    }
    if (!coreNarrative) {
        coreNarrative = cleaned.slice(0, 300);
    }

    const cleanTitle = String(title || '').trim();
    const titleTag = cleanTitle ? ` for "${cleanTitle}"` : '';
    const styleTag = artStyle ? ` in ${artStyle} art style` : '';

    return `Single unified 16:9 cinematic master key-art shot${titleTag}${styleTag}: ${coreNarrative}. Epic single composition, establishing shot, rich depth, cinematic atmospheric lighting. Strictly single image, no split screen, no collage, no panels, no storyboard grid, no borders, no text overlay.`;
}
