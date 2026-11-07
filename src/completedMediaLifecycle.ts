export type ImageMediaSources = {
    sdBlob?: Blob | null;
    hdBlob?: Blob | null;
    previewUrl?: string;
};

/** URLs in this receipt have completed the application's storage upload. */
export type StoredImageMedia = ImageMediaSources & {
    sdUrl: string;
    hdUrl: string;
    persisted?: boolean;
    quality?: 'preview' | 'final';
};

export const isHttpMediaUrl = (value: unknown): value is string => (
    typeof value === 'string' && /^https?:\/\//i.test(value.trim())
);

export const imageMediaReceiptMatches = (receipt: StoredImageMedia | undefined, sources: ImageMediaSources): boolean => {
    if (!receipt || !isHttpMediaUrl(receipt.sdUrl) || !isHttpMediaUrl(receipt.hdUrl)) return false;
    if (sources.sdBlob && sources.sdBlob !== receipt.sdBlob) return false;
    if (sources.hdBlob && sources.hdBlob !== receipt.hdBlob) return false;
    return Boolean(sources.previewUrl) && [receipt.previewUrl, receipt.sdUrl, receipt.hdUrl].includes(sources.previewUrl);
};

/** A late save must never clear a newer scene result's file or preview. */
export function replaceMatchingMediaEntry<T>(previous: readonly T[], index: number, expected: T, replacement: T): T[] | readonly T[] {
    if (!Object.is(previous[index], expected)) return previous;
    const next = [...previous]; next[index] = replacement; return next;
}

/** Release only a caller-owned object URL after its last visible/reference owner ends. */
export const revokeUnusedOwnedObjectUrl = (
    ownedUrl: string,
    liveSources: Iterable<unknown>,
    revoke: (url: string) => void = url => URL.revokeObjectURL(url),
): boolean => {
    if (!ownedUrl.startsWith('blob:')) return false;
    for (const source of liveSources) if (source === ownedUrl) return false;
    revoke(ownedUrl); return true;
};

export const storedImageReceipt = (receipt: StoredImageMedia): StoredImageMedia => ({
    sdUrl: receipt.sdUrl, hdUrl: receipt.hdUrl, previewUrl: receipt.sdUrl, persisted: receipt.persisted,
    ...(receipt.quality ? { quality: receipt.quality } : {}),
});

export const persistedImageReceipt = (receipt: StoredImageMedia): StoredImageMedia => ({ ...storedImageReceipt(receipt), persisted: true });

/** A successful upload is reusable for this exact File/Blob, including save retries. */
export class StoredBinaryUploads {
    private requests = new WeakMap<Blob, Promise<string>>();
    run(blob: Blob, upload: () => Promise<string>): Promise<string> {
        const existing = this.requests.get(blob);
        if (existing) return existing;
        const request = Promise.resolve().then(upload).then(url => {
            if (!isHttpMediaUrl(url)) throw new Error('Storage upload returned no usable media URL.');
            return url;
        });
        this.requests.set(blob, request);
        void request.catch(() => { if (this.requests.get(blob) === request) this.requests.delete(blob); });
        return request;
    }
}
