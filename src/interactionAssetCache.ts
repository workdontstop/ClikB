/**
 * Stage 6B — global RAM asset cache for interaction media.
 *
 * One tab-lifetime cache is the SOLE loading owner for interaction videos,
 * music and audio. An asset downloads once, receives one stable blob URL, and
 * reuses that blob until the entry is deliberately evicted or cleared.
 *
 * Design rules this file exists to enforce:
 *
 *  - One download per URL. Concurrent callers share a single pending promise;
 *    there is no `"pending"` string sentinel and no second fetch.
 *  - A media element NEVER receives the remote URL while a cache fetch for that
 *    same URL is running. Callers await the blob. That removes the dual-owner
 *    remote→blob src swap, which reloaded live elements mid-playback.
 *  - A blob URL assigned to a mounted element cannot be revoked. `acquire()`
 *    returns a lease; the entry is protected until that lease is released.
 *  - `clear()` is safe during playback: unused entries are revoked immediately,
 *    in-use entries are tombstoned and revoked on their final release.
 *  - A late fetch completion cannot repopulate a cleared cache. Every in-flight
 *    load captures the cache generation and discards itself if it is stale.
 *
 * Memory is bounded by two budgets — see MAX_CACHE_ENTRIES / MAX_CACHE_BYTES
 * below. Whichever is breached first drives LRU eviction, and eviction repeats
 * until both are satisfied.
 *
 * Deliberately NOT in this stage: disk caching, service-worker caching,
 * per-file size thresholds, progressive remote fallbacks, priority queues.
 * RAM eviction never touches the browser HTTP cache — an evicted asset can be
 * rehydrated from an ordinary cache-aware `fetch()` without a full transfer.
 */

/**
 * Two budgets. The cache must satisfy BOTH; whichever is exceeded first drives
 * eviction. Videos, music and audio share them.
 *
 * The byte ceiling is the one that prevents a crash: an entry count is only a
 * proxy for memory, and a proxy with a wide error bar. Assets currently measure
 * 5.9–14.0 MB, so 30 entries could mean anything from 180 MB to 420 MB, and an
 * unexpectedly large upscaled file would blow past both. 128 MiB is the real
 * bound; the entry cap just stops a large number of tiny audio clips from
 * accumulating indefinitely under it.
 *
 * At the observed 7.8 MB average this retains roughly 16 assets.
 */
export const MAX_CACHE_ENTRIES = 30;
export const MAX_CACHE_BYTES = 128 * 1024 * 1024;

type EntryState = "pending" | "ready" | "failed";

interface CacheEntry {
    url: string;
    state: EntryState;
    /** Shared by every concurrent caller. Resolves to the blob URL. */
    promise: Promise<string>;
    /** Set once the blob exists. Null while pending or after revocation. */
    blobUrl: string | null;
    /** Bytes. Counted toward MAX_CACHE_BYTES and used for eviction. */
    size: number;
    /** Monotonic counter, not a clock: LRU must not depend on timer resolution. */
    lastUsed: number;
    /** Live leases held by mounted media elements. Non-zero blocks eviction. */
    refs: number;
    /** Tombstoned by clear() while still in use. Revoked on final release. */
    doomed: boolean;
    /** Cancels the network request on clear(). */
    controller: AbortController;
    /** Cache generation at load time. A stale completion discards itself. */
    generation: number;
    /** Guards against double revocation of the same object URL. */
    revoked: boolean;
}

/** Live, discoverable entries. Lookups only ever see this map. */
const entries = new Map<string, CacheEntry>();

/**
 * Entries that `clear()` invalidated while a media element was still using
 * them. They are removed from `entries` so no new lookup can find them — a
 * caller after a clear must get fresh data, which is the entire point of a
 * clear — but the blob URL stays alive so the element already playing it does
 * not lose its source. Their bytes still count against the budget, because
 * they still occupy memory. Each is revoked and dropped on its final release.
 *
 * Keeping them in `entries` instead would be wrong twice over: new callers
 * would be served content that was explicitly invalidated, and because
 * eviction skips tombstoned entries, a re-acquired one could never be evicted
 * and would pin its bytes for the lifetime of the tab.
 */
const tombstones = new Set<CacheEntry>();

let generation = 0;
let useCounter = 0;

const stats = {
    miss: 0, pendingJoin: 0, hit: 0, ready: 0,
    failed: 0, httpNotOk: 0, evicted: 0, evictDeferred: 0,
    cleared: 0, revoked: 0, bytes: 0,
};

// ── diagnostics ────────────────────────────────────────────────────────────
// Kept from the Stage 6B investigation: these logs are what proved the old RAM
// path never executed. Silence with `window.__assetCacheDebug = false`.

const debugOn = () =>
    typeof window !== "undefined" && (window as any).__assetCacheDebug !== false;

export const shortUrl = (u: string) => {
    if (!u) return "(empty)";
    if (u.startsWith("blob:")) return `blob:…${u.slice(-12)}`;
    try {
        const name = new URL(u, window.location.href).pathname.split("/").pop() || u;
        return name.length > 42 ? `${name.slice(0, 39)}…` : name;
    } catch {
        return u.length > 42 ? `…${u.slice(-39)}` : u;
    }
};

const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)}MB`;
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

const log = (...args: any[]) => { if (debugOn()) console.log("%c[assetcache]", "color:#4bb3d4;font-weight:bold", ...args); };
const warn = (...args: any[]) => { if (debugOn()) console.warn("[assetcache]", ...args); };

// ── internals ──────────────────────────────────────────────────────────────

/** Revokes an entry's object URL at most once, whatever path gets here. */
function revoke(entry: CacheEntry, reason: string) {
    if (entry.revoked || !entry.blobUrl) return;
    entry.revoked = true;
    stats.revoked += 1;
    stats.bytes -= entry.size;
    try { URL.revokeObjectURL(entry.blobUrl); } catch { /* already gone */ }
    entry.blobUrl = null;
    log(`REVOKE   ${shortUrl(entry.url)} — ${mb(entry.size)} freed (${reason}).`);
}

/** Bumps recency. Called on genuine use only — `peek` deliberately does not. */
function touch(entry: CacheEntry) {
    entry.lastUsed = ++useCounter;
}

function startLoad(url: string): CacheEntry {
    const controller = new AbortController();
    const bornAt = generation;
    const startedAt = now();

    const entry: CacheEntry = {
        url,
        state: "pending",
        promise: null as unknown as Promise<string>,
        blobUrl: null,
        size: 0,
        lastUsed: ++useCounter,
        refs: 0,
        doomed: false,
        controller,
        generation: bornAt,
        revoked: false,
    };

    stats.miss += 1;
    log(`MISS     ${shortUrl(url)} — fetching whole file into RAM.`);

    entry.promise = (async () => {
        const response = await fetch(url, { signal: controller.signal });

        // The old path never checked this, so a 403/404 body was stored and
        // served as if it were the video — permanently, since a "successful"
        // entry is never retried.
        if (!response.ok) {
            stats.httpNotOk += 1;
            throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`);
        }

        const blob = await response.blob();

        // A clear() (or an abort that raced past the signal check) happened while
        // we were downloading. Do not resurrect the entry, and do not leak the
        // object URL — never create one at all.
        if (bornAt !== generation) {
            log(`STALE    ${shortUrl(url)} — completed after clear #${generation}; discarded, no object URL created.`);
            throw new Error("cache cleared during load");
        }

        const blobUrl = URL.createObjectURL(blob);
        entry.blobUrl = blobUrl;
        entry.size = blob.size;
        entry.state = "ready";
        stats.ready += 1;
        stats.bytes += blob.size;
        touch(entry);

        log(
            `READY    ${shortUrl(url)} — ${mb(blob.size)} ${blob.type || "unknown type"} ` +
            `in ${Math.round(now() - startedAt)}ms · ${entries.size}/${MAX_CACHE_ENTRIES} entries · ` +
            `${mb(readyBytes())}/${mb(MAX_CACHE_BYTES)}.`
        );

        evictIfNeeded();
        return blobUrl;
    })();

    // A failed download must not be cached: drop it so the next request retries.
    // Only remove the entry if it is still THIS one — a later load may already
    // have replaced it.
    entry.promise.catch((err) => {
        entry.state = "failed";
        stats.failed += 1;
        if (entries.get(url) === entry) entries.delete(url);
        const aborted = (err as any)?.name === "AbortError";
        warn(`FAILED   ${shortUrl(url)} — ${aborted ? "aborted" : String(err)}. Entry removed; next request will retry.`);
    });

    entries.set(url, entry);
    return entry;
}

function getOrStart(url: string): CacheEntry {
    const existing = entries.get(url);
    // `doomed` should be unreachable here — clear() removes tombstones from the
    // map — but the check is kept so a future change cannot silently start
    // serving invalidated blobs to new callers.
    if (existing && existing.state !== "failed" && !existing.doomed) {
        if (existing.state === "ready") {
            stats.hit += 1;
            log(`HIT      ${shortUrl(url)} — ${mb(existing.size)}, no network.`);
        } else {
            stats.pendingJoin += 1;
            log(`PENDING  ${shortUrl(url)} — joining the in-flight download, no second fetch.`);
        }
        touch(existing);
        return existing;
    }
    return startLoad(url);
}

// ── public API ─────────────────────────────────────────────────────────────

export interface AssetLease {
    url: string;
    /** Resolves to the blob URL. Rejects if the download failed or was cleared. */
    promise: Promise<string>;
    /** Idempotent. Safe to call after clear(), eviction, or failure. */
    release: () => void;
}

/**
 * Starts (or joins) a download without taking ownership. Used for branch and
 * loop-destination lookahead: warm the cache, but stay evictable, because a
 * destination the user never chooses must not pin RAM.
 */
export function load(url: string): Promise<void> {
    if (!url) return Promise.reject(new Error("load() called with empty url"));
    // Deliberately resolves to void. Under the byte budget a lookahead asset can
    // be revoked the instant it becomes ready — if it cannot fit alongside what
    // is already mounted, it is dropped and left to the browser HTTP cache. A
    // blob URL returned from here could therefore already be dead. Only
    // `acquire()`, which holds a lease, can promise a usable URL.
    return getOrStart(String(url)).promise.then(() => undefined);
}

/**
 * Takes ownership for a mounted media element. The reference count is raised
 * SYNCHRONOUSLY, before any await, so an entry cannot be evicted in the window
 * between requesting it and receiving the blob.
 *
 * The caller must call `release()` exactly once — on unmount, or when the
 * element changes source — regardless of whether the promise resolved.
 */
export function acquire(url: string): AssetLease {
    const key = String(url);
    const entry = getOrStart(key);
    entry.refs += 1;

    let released = false;
    return {
        url: key,
        promise: entry.promise,
        release() {
            if (released) return;      // idempotent by contract
            released = true;
            entry.refs = Math.max(0, entry.refs - 1);

            // Held only to keep a live element alive through clear(). Now unused.
            if (entry.doomed && entry.refs === 0) {
                revoke(entry, "final release of a tombstoned entry");
                tombstones.delete(entry);
                // Defensive: a tombstone is not in `entries`, but never leave a
                // revoked blob reachable if that invariant is ever broken.
                if (entries.get(key) === entry) entries.delete(key);
                // Freeing these bytes may unblock a deferred eviction.
                evictIfNeeded();
                return;
            }
            // An eviction may have been postponed while this lease was active.
            if (entry.refs === 0) evictIfNeeded();
        },
    };
}

/** Read-only probe. Does NOT bump recency and does NOT start a download. */
export function peek(url?: string | null): string | null {
    if (!url) return null;
    const entry = entries.get(String(url));
    // A tombstoned asset is absent as far as lookups are concerned: it belongs
    // to the element already playing it, not to whoever asks next.
    return entry && entry.state === "ready" && !entry.doomed ? entry.blobUrl : null;
}

/**
 * Trims to MAX_CACHE_ENTRIES, least-recently-used first.
 *
 * Only ready, unreferenced, non-tombstoned entries are candidates. Pending
 * downloads are never evicted — dropping one leaves it unreachable and
 * un-retryable, which is exactly the leak the old implementation had. If every
 * candidate is in use the cache temporarily exceeds the cap and retries on the
 * next release.
 */
/**
 * Bytes of RAM currently held as ready blobs.
 *
 * Tombstoned and leased entries ARE counted: they occupy memory whether or not
 * we are allowed to reclaim them. Excluding them would let the cache report
 * compliance while sitting well over budget.
 */
function readyBytes(): number {
    let total = 0;
    for (const entry of entries.values()) if (entry.state === "ready") total += entry.size;
    // Tombstones are unreachable but not yet freed — they must still be paid for.
    for (const entry of tombstones) if (entry.state === "ready") total += entry.size;
    return total;
}

function budgetBreach(): { entries: boolean; bytes: boolean; over: boolean } {
    const overEntries = entries.size > MAX_CACHE_ENTRIES;
    const overBytes = readyBytes() > MAX_CACHE_BYTES;
    return { entries: overEntries, bytes: overBytes, over: overEntries || overBytes };
}

const breachReason = (b: { entries: boolean; bytes: boolean }) =>
    b.entries && b.bytes ? "entry limit + byte limit" : b.entries ? "entry limit" : "byte limit";

/**
 * Trims until BOTH budgets are satisfied, least-recently-used first.
 *
 * Only ready, unreferenced, non-tombstoned entries are eligible. Pending
 * downloads are never evicted — dropping one leaves it unreachable and
 * un-retryable, which is exactly the leak the original implementation had.
 *
 * The most-recently-used entry is evicted only as a last resort. It is normally
 * the asset that just finished downloading and the one most likely to be needed
 * next, so throwing it away first would guarantee an immediate re-download. But
 * it is NOT exempt: if it is the only thing standing between the cache and the
 * byte ceiling — a lookahead asset too large to fit alongside what is already
 * mounted — it goes. Its response may still be served from the browser HTTP
 * cache on the next request, which this function never touches.
 *
 * If leases block compliance the cache stays temporarily over budget and retries
 * on the next release, rather than revoking a source out from under a playing
 * element.
 */
export function evictIfNeeded(): void {
    let breach = budgetBreach();
    if (!breach.over) return;

    const reason = breachReason(breach);
    const startedBytes = readyBytes();
    let freed = 0;
    let removed = 0;

    const evict = (entry: CacheEntry) => {
        const size = entry.size;
        revoke(entry, `LRU eviction (${reason})`);
        entries.delete(entry.url);
        stats.evicted += 1;
        freed += size;
        removed += 1;
    };

    // Pass 1 — everything except the most-recently-used entry.
    // Pass 2 — allow the newest as well, so no single entry can sit above the
    // byte ceiling indefinitely just by being recent.
    for (const allowNewest of [false, true]) {
        while (breach.over) {
            const all = [...entries.values()];
            const newest = Math.max(...all.map((e) => e.lastUsed));

            const candidate = all
                .filter((e) =>
                    e.state === "ready" && e.refs === 0 && !e.doomed &&
                    (allowNewest || e.lastUsed !== newest))
                .sort((a, b) => a.lastUsed - b.lastUsed)[0];

            if (!candidate) break;
            evict(candidate);
            breach = budgetBreach();
        }
        if (!breach.over) break;
    }

    if (removed) {
        log(
            `EVICT    ${removed} entr${removed === 1 ? "y" : "ies"} — ${reason} · ${mb(freed)} freed · ` +
            `${entries.size}/${MAX_CACHE_ENTRIES} entries · ${mb(readyBytes())}/${mb(MAX_CACHE_BYTES)}.`
        );
    }

    if (breach.over) {
        stats.evictDeferred += 1;
        warn(
            `EVICT DEFERRED — still over ${breachReason(breach)} at ${entries.size}/${MAX_CACHE_ENTRIES} entries and ` +
            `${mb(readyBytes())}/${mb(MAX_CACHE_BYTES)} (freed ${mb(startedBytes - readyBytes())} so far). ` +
            `Every remaining entry is mounted or still downloading, so nothing is revoked out from under a live ` +
            `element. Retrying on the next release.`
        );
    }
}

/**
 * Explicit teardown. Not called on component unmount by design — the cache is
 * meant to survive node changes, keyed remounts, preview open/close and
 * FeedsGate state updates for the lifetime of the tab.
 *
 * In-flight downloads are aborted and invalidated by generation bump. Entries
 * still assigned to mounted elements are tombstoned rather than revoked, so
 * nothing loses its source mid-playback.
 */
export function clear(): void {
    generation += 1;
    stats.cleared += 1;

    let revokedNow = 0;
    let tombstoned = 0;
    let aborted = 0;

    for (const entry of [...entries.values()]) {
        if (entry.state === "pending") {
            try { entry.controller.abort(); } catch { /* ignore */ }
            aborted += 1;
            entries.delete(entry.url);
            continue;
        }
        if (entry.refs > 0) {
            // Invalidated, but still on screen. Move it out of the lookup map so
            // no new caller can be served this stale blob, and keep it alive for
            // the element that is already playing it.
            entry.doomed = true;
            tombstones.add(entry);
            entries.delete(entry.url);
            tombstoned += 1;
            continue;
        }
        revoke(entry, `clear #${stats.cleared}`);
        entries.delete(entry.url);
        revokedNow += 1;
    }

    warn(
        `CLEAR #${stats.cleared} — revoked ${revokedNow}, aborted ${aborted} in-flight, ` +
        `tombstoned ${tombstoned} still mounted. Tombstones keep playing but are no longer ` +
        `discoverable: a new request for the same url downloads a fresh copy. They stay ` +
        `byte-accounted (${mb(readyBytes())} total) until their final release.`
    );
}

/** Diagnostics only. */
export function cacheStats() {
    const bytes = readyBytes();
    return {
        ...stats,
        bytes,
        totalBytes: mb(bytes),
        maxBytes: MAX_CACHE_BYTES,
        budget: `${mb(bytes)} / ${mb(MAX_CACHE_BYTES)}`,
        entries: entries.size,
        max: MAX_CACHE_ENTRIES,
        // Invalidated but still mounted. Not discoverable, not evictable, but
        // included in `bytes` above because they still occupy memory.
        tombstoned: tombstones.size,
        generation,
    };
}

/** Diagnostics only. LRU order, oldest first. */
export function cacheEntries() {
    return [...entries.values(), ...tombstones]
        .sort((a, b) => a.lastUsed - b.lastUsed)
        .map((e, i) => ({
            lru: i === 0 ? "0 (next evicted)" : String(i),
            file: shortUrl(e.url),
            state: e.doomed ? `${e.state} (tombstoned)` : e.state,
            size: e.size ? mb(e.size) : "-",
            refs: e.refs,
            url: e.url,
        }));
}

/** Test-only reset. Drops everything without the tombstone courtesy. */
export function __resetForTests() {
    generation += 1;
    for (const entry of [...entries.values(), ...tombstones]) {
        try { entry.controller.abort(); } catch { /* ignore */ }
        if (entry.blobUrl && !entry.revoked) {
            entry.revoked = true;
            try { URL.revokeObjectURL(entry.blobUrl); } catch { /* ignore */ }
        }
    }
    entries.clear();
    tombstones.clear();
    useCounter = 0;
    Object.keys(stats).forEach((k) => { (stats as any)[k] = 0; });
}

if (typeof window !== "undefined") {
    (window as any).__assetCache = {
        stats: cacheStats,
        entries: cacheEntries,
        peek,
        clear,
        elements: () => Array.from(document.querySelectorAll("video,audio")).map((el: any) => ({
            tag: el.tagName.toLowerCase(),
            source: !el.currentSrc ? "EMPTY"
                : el.currentSrc.startsWith("blob:") ? "BLOB (cached)"
                    : "REMOTE (streaming)",
            readyState: el.readyState,
            paused: el.paused,
            file: shortUrl(el.currentSrc || ""),
        })),
    };
    log(
        `ready · budget ${MAX_CACHE_ENTRIES} entries / ${mb(MAX_CACHE_BYTES)} · ` +
        `try __assetCache.stats() · console.table(__assetCache.entries()) · console.table(__assetCache.elements())`
    );
}
