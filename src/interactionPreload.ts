import { cacheStats, load, peek } from './interactionAssetCache';

// Background work only. Mounted/selected media continues to acquire directly
// from the single-flight cache, so this queue never delays a user's choice.
const owners = new Map<symbol, string[]>();
const pending = new Set<string>();
let retry: ReturnType<typeof setTimeout> | undefined;

function pump() {
    if (retry !== undefined) { clearTimeout(retry); retry = undefined; }
    for (const [owner, urls] of owners) {
        while (urls.length && pending.size < 2) {
            const stats = cacheStats();
            if (stats.bytes >= stats.maxBytes * .85 || stats.entries >= stats.max - 2) {
                retry = setTimeout(pump, 1000);
                return;
            }
            const url = urls.shift()!;
            if (peek(url) || pending.has(url)) continue;
            pending.add(url);
            void load(url).catch(() => { /* cache records failure; selection can retry */ }).finally(() => {
                pending.delete(url);
                pump();
            });
        }
        if (!urls.length) owners.delete(owner);
        if (pending.size >= 2) return;
    }
}

export function preloadInteractionAssets(urls: string[]) {
    const owner = Symbol('interaction-lookahead');
    owners.set(owner, [...new Set(urls.filter(url => Boolean(url) && !peek(url)))].slice(0, 24));
    pump();
    return () => {
        // Do not abort shared in-flight downloads: another mounted consumer may
        // have acquired them since they entered the queue.
        owners.delete(owner);
        if (!owners.size && retry !== undefined) { clearTimeout(retry); retry = undefined; }
    };
}
