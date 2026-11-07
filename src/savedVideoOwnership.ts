/** A completed upload may replace only the preview that still owns that result. */
export function replaceSavedVideoPreview<T>(
    previous: T[], index: number, cloudUrl: string,
    localUrl: string, expectedPreview?: T,
): T[] {
    const current = previous?.[index];
    const matchesExpected = expectedPreview !== undefined && (current === expectedPreview || current == null && expectedPreview === null);
    if (current !== (localUrl as T) && !matchesExpected && current !== (cloudUrl as T)) return previous;
    const next = [...(previous || [])];
    next[index] = cloudUrl as T;
    return next;
}

/** Clearing by identity keeps a later generation or a failed save available. */
export function releaseSavedVideoBlob<T>(previous: T[], index: number, savedBlob?: Blob, replacedBlob?: T): T[] {
    if ((savedBlob === undefined || previous?.[index] !== (savedBlob as T)) && (replacedBlob === undefined || previous?.[index] !== replacedBlob)) return previous;
    const next = [...previous];
    next[index] = null as T;
    return next;
}
