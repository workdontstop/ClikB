import type { SpatialConnection, SpatialSceneState } from "./spatialStageModel";

export const SPATIAL_VIDEO_CACHE_RADIUS = 5;
export const SPATIAL_SPECULATIVE_ASSETS = 20;
const MAX_SHARED_ASSETS = 40;
const MAX_SHARED_LOADS = 4;
const MAX_OWNER_LOADS = 2;

export interface SpatialVideoCacheAsset {
    url: string;
    connectionId: string;
    assetDirection: "forward" | "backward";
    slotDirection: "forward" | "backward";
    distance: number;
}

export interface SpatialVideoCachePlan {
    sceneId: string;
    sceneIndex: number;
    activeNodeId: string;
    forwardConnectionIds: string[];
    backwardConnectionIds: string[];
    assets: SpatialVideoCacheAsset[];
}

export type SpatialForwardRouteSelections = Record<string, string>;

export function uniqueSpatialVideoAssets(assets: SpatialVideoCacheAsset[]) {
    const unique = new Map<string, SpatialVideoCacheAsset>();
    for (const asset of assets) if (!unique.has(asset.url)) unique.set(asset.url, asset);
    return [...unique.values()];
}

const readyOutgoing = (scene: SpatialSceneState, nodeId: string) => (
    scene.connections.filter((connection) => (
        connection.sourceNodeId === nodeId
        && Boolean(connection.forward?.videoUrl)
        && (!scene.ledger || connection.kind === 'action' || Boolean(connection.backward?.videoUrl))
        && scene.nodes.some(node => node.id === connection.targetNodeId && node.frameUrl)
    ))
);

const selectForwardConnection = (
    outgoing: SpatialConnection[],
    nodeId: string,
    routeSelections: SpatialForwardRouteSelections,
): SpatialConnection | null => {
    if (!outgoing.length) return null;
    const selectedId = routeSelections[nodeId];
    const selected = selectedId ? outgoing.find((connection) => connection.id === selectedId) : null;
    // A newly generated or most recently traversed branch is at the end of the
    // manifest connection list. Explicit traversal preferences win thereafter.
    return selected || outgoing[outgoing.length - 1];
};

const assetsForConnection = (
    connection: SpatialConnection,
    slotDirection: "forward" | "backward",
    distance: number,
): SpatialVideoCacheAsset[] => {
    const assets: SpatialVideoCacheAsset[] = [];
    if (connection.forward?.videoUrl) {
        assets.push({
            url: connection.forward.videoUrl,
            connectionId: connection.id,
            assetDirection: "forward",
            slotDirection,
            distance,
        });
    }
    if (connection.backward?.videoUrl) {
        assets.push({
            url: connection.backward.videoUrl,
            connectionId: connection.id,
            assetDirection: "backward",
            slotDirection,
            distance,
        });
    }
    return assets;
};

export const buildSpatialVideoCachePlan = (
    scene: SpatialSceneState,
    sceneIndex: number,
    routeSelections: SpatialForwardRouteSelections = {},
    radius = SPATIAL_VIDEO_CACHE_RADIUS,
    destinationNodeId?: string,
): SpatialVideoCachePlan => {
    const forwardConnections: SpatialConnection[] = [];
    const backwardConnections: SpatialConnection[] = [];

    let forwardNodeId = scene.activeNodeId;
    const visitedForwardNodes = new Set<string>([forwardNodeId]);
    for (let distance = 1; distance <= radius; distance += 1) {
        const connection = selectForwardConnection(
            readyOutgoing(scene, forwardNodeId),
            forwardNodeId,
            routeSelections,
        );
        if (!connection || visitedForwardNodes.has(connection.targetNodeId)) break;
        forwardConnections.push(connection);
        forwardNodeId = connection.targetNodeId;
        visitedForwardNodes.add(forwardNodeId);
    }

    let backwardNodeId = scene.activeNodeId;
    const visitedBackwardNodes = new Set<string>([backwardNodeId]);
    for (let distance = 1; distance <= radius; distance += 1) {
        // Generated spatial nodes normally have exactly one incoming connection.
        // Reverse iteration makes restored duplicate data deterministic and keeps
        // the newest manifest truth if malformed data contains more than one.
        const connection = [...scene.connections].reverse().find((candidate) => (
            candidate.targetNodeId === backwardNodeId
            && Boolean(candidate.forward?.videoUrl)
        ));
        if (!connection || visitedBackwardNodes.has(connection.sourceNodeId)) break;
        backwardConnections.push(connection);
        backwardNodeId = connection.sourceNodeId;
        visitedBackwardNodes.add(backwardNodeId);
    }

    const immediate = [scene.activeNodeId, ...(destinationNodeId ? [destinationNodeId] : [])]
        .flatMap(nodeId => {
            const outgoing = readyOutgoing(scene, nodeId);
            const selected = selectForwardConnection(outgoing, nodeId, routeSelections);
            return [...(selected ? [selected] : []), ...outgoing.filter(edge => edge !== selected)]
                .flatMap(edge => assetsForConnection(edge, 'forward', 1));
        });
    const candidates = [
        ...immediate,
        ...backwardConnections.slice(0, 1).flatMap(connection => assetsForConnection(connection, 'backward', 1)),
        ...forwardConnections.flatMap((connection, index) => assetsForConnection(connection, "forward", index + 1)),
        ...backwardConnections.flatMap((connection, index) => assetsForConnection(connection, "backward", index + 1)),
    ];
    const assets = uniqueSpatialVideoAssets(candidates).slice(0, SPATIAL_SPECULATIVE_ASSETS);

    return {
        sceneId: scene.sceneId,
        sceneIndex,
        activeNodeId: scene.activeNodeId,
        forwardConnectionIds: forwardConnections.map((connection) => connection.id),
        backwardConnectionIds: backwardConnections.map((connection) => connection.id),
        assets,
    };
};

type CacheEntryStatus = "queued" | "loading" | "ready" | "error";

interface SpatialVideoCacheEntry {
    url: string;
    video: HTMLVideoElement;
    status: CacheEntryStatus;
    requestedByScenes: Set<number>;
    lastUsedAt: number;
    retryCount: number;
    retryTimer: ReturnType<typeof setTimeout> | null;
    loadTimer: ReturnType<typeof setTimeout> | null;
    loading: boolean;
}

const MAX_PRELOAD_RETRIES = 2;

const shortUrl = (url: string) => {
    try {
        const parsed = new URL(url, globalThis.location?.href);
        const tail = parsed.pathname.split("/").filter(Boolean).slice(-2).join("/");
        return `${parsed.host}/${tail}`;
    } catch {
        return url.length > 96 ? `${url.slice(0, 93)}...` : url;
    }
};

class SpatialVideoRamCache {
    private entries = new Map<string, SpatialVideoCacheEntry>();
    private plansByScene = new Map<number, SpatialVideoCachePlan>();
    private listeners = new Set<() => void>();
    private playbackLeases = new Set<HTMLVideoElement>();
    private playbackEntries = new Map<HTMLVideoElement, SpatialVideoCacheEntry>();
    private pumping = false;

    private createEntry(url: string) {
        const video = document.createElement('video');
        video.preload = 'auto'; video.muted = true; video.playsInline = true;
        const entry: SpatialVideoCacheEntry = { url, video, status: 'queued', requestedByScenes: new Set(),
            lastUsedAt: Date.now(), retryCount: 0, retryTimer: null, loadTimer: null, loading: false };
        this.entries.set(url, entry);
        return entry;
    }

    /** Preview can be open while creation is paused. Never attach two drivers to one element. */
    acquirePlayback(url: string): { video: HTMLVideoElement; release: () => void } | null {
        if (typeof document === 'undefined') return null;
        const entry = this.entries.get(url) || this.createEntry(url);
        // Explicit playback bypasses speculative admission and joins a loading
        // entry without replacing its source or restarting a ready element.
        if (entry.status === 'queued' || entry.status === 'error') this.load(entry, -1);
        const cloned = this.playbackLeases.has(entry.video);
        const video = cloned ? entry.video.cloneNode(true) as HTMLVideoElement : entry.video;
        this.playbackLeases.add(video);
        this.playbackEntries.set(video, entry);
        let released = false;
        return { video, release: () => {
            if (released) return;
            released = true; this.playbackLeases.delete(video); this.playbackEntries.delete(video);
            video.pause(); video.remove();
            if (cloned) { video.removeAttribute("src"); video.load(); }
            this.evictUnused();
            this.pump();
        } };
    }

    /** Use the already loaded media element; callers retain their scene plan until playback ends. */
    playbackElement(url: string): HTMLVideoElement | null {
        return this.entries.get(url)?.video || null;
    }

    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    isReady(url: string | null | undefined) {
        if (!url || typeof HTMLMediaElement === "undefined") return false;
        const entry = this.entries.get(url);
        return Boolean(entry && entry.status !== 'queued' && entry.video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA);
    }

    reconcile(plan: SpatialVideoCachePlan) {
        if (typeof document === "undefined") return;

        const desiredUrls = new Set(plan.assets.map((asset) => asset.url).filter(Boolean));
        this.plansByScene.set(plan.sceneIndex, plan);
        console.groupCollapsed(
            `[SpatialVideoCache] scene=${plan.sceneIndex} node=${plan.activeNodeId} `
            + `forward=${plan.forwardConnectionIds.length}/5 backward=${plan.backwardConnectionIds.length}/5 assets=${desiredUrls.size}`,
        );
        console.log("forward slots", plan.forwardConnectionIds);
        console.log("backward slots", plan.backwardConnectionIds);

        for (const entry of this.entries.values()) entry.requestedByScenes.delete(plan.sceneIndex);

        for (const asset of uniqueSpatialVideoAssets(plan.assets)) {
            if (!asset.url) continue;
            const existing = this.entries.get(asset.url);
            if (existing) {
                existing.requestedByScenes.add(plan.sceneIndex);
                existing.lastUsedAt = Date.now();
                if (existing.status !== 'queued' && existing.video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
                    existing.status = "ready";
                    existing.loading = false;
                    if (existing.loadTimer !== null) clearTimeout(existing.loadTimer);
                    existing.loadTimer = null;
                    console.log(
                        `RAM HIT ${asset.slotDirection}[${asset.distance}] ${asset.assetDirection}`,
                        shortUrl(asset.url),
                    );
                } else if (existing.status === "loading" || existing.status === 'queued' || existing.retryTimer !== null) {
                    console.log(
                        `LOAD IN PROGRESS ${asset.slotDirection}[${asset.distance}] ${asset.assetDirection}`,
                        shortUrl(asset.url),
                    );
                } else {
                    console.log(
                        `RELOAD ${asset.slotDirection}[${asset.distance}] ${asset.assetDirection}`,
                        shortUrl(asset.url),
                    );
                    if (![...this.playbackEntries.values()].includes(existing)) existing.status = 'queued';
                }
                continue;
            }

            this.evictUnused(desiredUrls);
            if (this.entries.size >= MAX_SHARED_ASSETS && asset.distance > 0) continue;
            const entry = this.createEntry(asset.url);
            entry.requestedByScenes.add(plan.sceneIndex);
            console.log(
                `CACHE MISS ${asset.slotDirection}[${asset.distance}] ${asset.assetDirection}; requesting (HTTP cache may satisfy)`,
                shortUrl(asset.url),
            );
        }

        this.evictUnused();
        this.pump();
        console.log("snapshot", this.snapshot());
        console.groupEnd();
        this.notify();
    }

    releaseScene(sceneIndex: number) {
        this.plansByScene.delete(sceneIndex);
        for (const entry of this.entries.values()) entry.requestedByScenes.delete(sceneIndex);
        console.log(`[SpatialVideoCache] release scene=${sceneIndex}`);
        this.evictUnused();
        this.pump();
        this.notify();
    }

    snapshot() {
        return {
            loading: [...this.entries.values()].filter(entry => entry.loading).length,
            queued: [...this.entries.values()].filter(entry => entry.status === 'queued').length,
            playbackLeases: this.playbackLeases.size,
            plans: [...this.plansByScene.values()].map((plan) => ({
                sceneIndex: plan.sceneIndex,
                sceneId: plan.sceneId,
                activeNodeId: plan.activeNodeId,
                forwardSlots: plan.forwardConnectionIds,
                backwardSlots: plan.backwardConnectionIds,
                uniqueAssetUrls: new Set(plan.assets.map((asset) => asset.url)).size,
            })),
            entries: [...this.entries.values()].map((entry) => ({
                url: shortUrl(entry.url),
                status: entry.status !== 'queued' && entry.video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA ? "ready" : entry.status,
                readyState: entry.video.readyState,
                bufferedRanges: entry.video.buffered.length,
                scenes: [...entry.requestedByScenes],
            })),
        };
    }

    private pump() {
        if (this.pumping) return;
        this.pumping = true;
        try {
            const priority = (entry: SpatialVideoCacheEntry) => Math.min(...[...entry.requestedByScenes].map(owner =>
                this.plansByScene.get(owner)?.assets.findIndex(asset => asset.url === entry.url) ?? Infinity));
            for (const entry of [...this.entries.values()].filter(entry => entry.status === 'queued').sort((a, b) => priority(a) - priority(b))) {
                const loading = [...this.entries.values()].filter(item => item.loading);
                if (loading.length >= MAX_SHARED_LOADS) break;
                const owner = [...entry.requestedByScenes].find(owner => loading.filter(item => item.requestedByScenes.has(owner)).length < MAX_OWNER_LOADS);
                if (owner !== undefined) this.load(entry, owner);
            }
        } finally { this.pumping = false; }
    }

    private load(entry: SpatialVideoCacheEntry, sceneIndex: number) {
        if (entry.loading) return;
        if (entry.retryTimer !== null) clearTimeout(entry.retryTimer);
        entry.retryTimer = null;
        entry.status = "loading";
        entry.loading = true;
        const complete = () => {
            entry.loading = false;
            if (entry.loadTimer !== null) clearTimeout(entry.loadTimer);
            entry.loadTimer = null;
        };
        const onReady = () => {
            if (entry.video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return;
            if (entry.status === "ready") return;
            entry.status = "ready";
            complete();
            entry.lastUsedAt = Date.now();
            entry.retryCount = 0;
            console.log(
                `[SpatialVideoCache] READY scene=${sceneIndex} readyState=${entry.video.readyState}`,
                shortUrl(entry.url),
            );
            this.notify();
            this.pump();
        };
        entry.video.onloadeddata = onReady;
        entry.video.oncanplay = onReady;
        entry.video.oncanplaythrough = onReady;
        entry.video.onerror = () => {
            complete();
            entry.status = "error";
            console.warn(
                `[SpatialVideoCache] ERROR scene=${sceneIndex} code=${entry.video.error?.code || "unknown"}`,
                shortUrl(entry.url),
            );
            this.notify();
            if (entry.requestedByScenes.size > 0 && entry.retryCount < MAX_PRELOAD_RETRIES) {
                entry.retryCount += 1;
                const delayMs = entry.retryCount * 1500;
                console.log(
                    `[SpatialVideoCache] RETRY ${entry.retryCount}/${MAX_PRELOAD_RETRIES} in ${delayMs}ms`,
                    shortUrl(entry.url),
                );
                entry.retryTimer = setTimeout(() => {
                    entry.retryTimer = null;
                    if (entry.requestedByScenes.size > 0 && this.entries.get(entry.url) === entry) {
                        entry.status = 'queued'; this.pump();
                    }
                }, delayMs);
            }
            this.pump();
        };
        entry.loadTimer = setTimeout(() => {
            complete();
            if (entry.status === 'loading') entry.status = 'error';
            this.pump(); this.notify();
        }, 15000);
        if (entry.video.src !== entry.url) entry.video.src = entry.url;
        entry.video.load();
        onReady();
    }

    private evictUnused(protectedUrls?: Set<string>) {
        for (const [url, entry] of this.entries) {
            if (protectedUrls?.has(url) || entry.requestedByScenes.size > 0 || [...this.playbackEntries.values()].includes(entry)) continue;
            if (entry.retryTimer !== null) clearTimeout(entry.retryTimer);
            if (entry.loadTimer !== null) clearTimeout(entry.loadTimer);
            entry.retryTimer = null;
            entry.video.pause();
            entry.video.onloadeddata = null;
            entry.video.oncanplay = null;
            entry.video.oncanplaythrough = null;
            entry.video.onerror = null;
            entry.video.removeAttribute("src");
            entry.video.load();
            this.entries.delete(url);
            console.log("[SpatialVideoCache] EVICT outside all 5+5 windows", shortUrl(url));
        }
    }

    private notify() {
        for (const listener of this.listeners) listener();
    }
}

export const spatialVideoRamCache = new SpatialVideoRamCache();

if (typeof window !== "undefined") {
    (window as any).__spatialVideoCache = {
        snapshot: () => spatialVideoRamCache.snapshot(),
    };
}
