/** Both descriptions are preserved; only the paced description is rendered. */
export type ImagePromptPacing = {
    version: 1;
    originalImagePrompt: string;
    pacedImagePrompt: string;
    handoff: string;
    fullScene: string;
};

// Automatic reference tagging can add @handles without changing the depiction.
const comparablePrompt = (value: string): string => value
    .replace(/["'](@[\p{L}\p{N}_-]+)["']/gu, '$1')
    .replace(/@(?=[\p{L}\p{N}_])/gu, '')
    .replace(/\s+/g, ' ').trim();

export function readImagePromptPacing(value: unknown, _currentImagePrompt: string): ImagePromptPacing | null {
    if (!value || typeof value !== 'object') return null;
    const data = value as Partial<ImagePromptPacing>;
    if (data.version !== 1 || typeof data.originalImagePrompt !== 'string' || !data.originalImagePrompt.trim()
        || typeof data.pacedImagePrompt !== 'string' || !data.pacedImagePrompt.trim()
        || typeof data.handoff !== 'string' || typeof data.fullScene !== 'string') return null;
    return data as ImagePromptPacing;
}

/** Frame edits preserve the story; only an unchanged depiction inherits its handoff. */
export function videoImagePromptContext(currentImagePrompt: string, value: unknown): {
    imageDescription: string; startingImagePrompt?: string; imagePacingHandoff?: string; fullScene?: string;
} {
    const pacing = readImagePromptPacing(value, currentImagePrompt);
    return pacing ? {
        imageDescription: pacing.originalImagePrompt,
        startingImagePrompt: currentImagePrompt,
        imagePacingHandoff: comparablePrompt(currentImagePrompt) === comparablePrompt(pacing.pacedImagePrompt) ? pacing.handoff : '',
        fullScene: pacing.fullScene,
    } : { imageDescription: currentImagePrompt };
}
