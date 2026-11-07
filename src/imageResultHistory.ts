import { hashIntentValue, type SceneIntentBlueprint } from './intentBlueprint';
import type { ImagePromptPacing } from './imagePromptPacing';

export type ImageResultHistory = {
    resultHistory: Record<string, string[]>;
    resultImagePrompt: Record<string, string[]>;
    resultIntent: Record<string, (SceneIntentBlueprint | null)[]>;
};

/** Keep a scene's URL, prompt and intent at the same position on insert or retry. */
export function upsertImageResultHistory(
    current: ImageResultHistory,
    key: string,
    url: string,
    prompt: string,
    intent: SceneIntentBlueprint | null,
    { newest = true }: { newest?: boolean } = {},
): ImageResultHistory {
    const seen = new Set<string>();
    const rows = (current.resultHistory[key] || []).flatMap((imageUrl, index) => {
        if (seen.has(imageUrl)) return [];
        seen.add(imageUrl);
        return [{ url: imageUrl, prompt: current.resultImagePrompt[key]?.[index] ?? '',
            intent: current.resultIntent[key]?.[index] ?? null }];
    });
    const position = rows.findIndex(row => row.url === url);
    const row = { url, prompt, intent };
    if (position >= 0) {
        rows[position] = row;
        if (newest) { rows.splice(position, 1); rows.unshift(row); }
    } else if (newest) rows.unshift(row);
    else rows.push(row);
    return {
        resultHistory: { ...current.resultHistory, [key]: rows.map(item => item.url) },
        resultImagePrompt: { ...current.resultImagePrompt, [key]: rows.map(item => item.prompt) },
        resultIntent: { ...current.resultIntent, [key]: rows.map(item => item.intent) },
    };
}

/** Archive the edited frame's depiction while keeping the original scene meaning. */
export function preciseImageResultIntent(
    existing: SceneIntentBlueprint | null,
    prompt: string,
    originalImagePrompt?: string,
): SceneIntentBlueprint | null {
    if (!existing) return null;
    const pacingForResult = (pacing: ImagePromptPacing): ImagePromptPacing => ({
        ...pacing,
        originalImagePrompt: (typeof originalImagePrompt === 'string' && originalImagePrompt.trim())
            ? originalImagePrompt.trim()
            : pacing.originalImagePrompt,
        pacedImagePrompt: prompt,
        handoff: '',
    });
    const pacing = existing.imagePacing || existing.imagePacingContext;
    return {
        ...existing,
        ...(existing.kind === 'interactive-node' ? { node: { ...existing.node } } : {}),
        boundImagePromptHash: hashIntentValue(prompt),
        syncStatus: 'ready',
        ...(pacing ? { imagePacing: pacingForResult(pacing) } : {}),
        ...(existing.imagePacingContext ? { imagePacingContext: pacingForResult(existing.imagePacingContext) } : {}),
    };
}
