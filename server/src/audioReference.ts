/** An uploaded sound reference, independent of music-video lyric timing. */
export type AudioReference = { url: string; sourceUrl?: string; start?: number; name: string; duration: number; enabled: boolean };
export function validateAudioReference(value: unknown, clipDuration: number): AudioReference | undefined {
    if (value == null) return undefined;
    const input = value as AudioReference;
    const validUrl = (url: unknown) => typeof url === 'string' && /^https:\/\//i.test(url) && url.length <= 2048;
    if (!validUrl(input.url) || input.sourceUrl !== undefined && !validUrl(input.sourceUrl)
        || !Number.isFinite(input.duration) || input.duration < 2 || input.duration > Math.min(15, clipDuration) + .15
        || input.start !== undefined && (!Number.isFinite(input.start) || input.start < 0)
        || typeof input.enabled !== 'boolean') throw new Error('Choose an audio reference of 2 seconds up to the clip duration. Trim it again if the duration changed.');
    return { url: input.url, ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {}), ...(input.start !== undefined ? { start: input.start } : {}), name: String(input.name || 'Audio').slice(0, 160), duration: input.duration, enabled: input.enabled };
}
export function audioReferencePrompt(label: string): string {
    return `Use ${label} as the reference for sound character, effects, ambience and timing as requested in the prompt. Preserve the requested visual action. Do not infer dialogue or force lip-sync from this reference.`;
}
