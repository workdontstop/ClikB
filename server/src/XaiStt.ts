// XaiStt: WebSocket proxy for xAI streaming speech-to-text.
//
// The browser connects to <backend>/xaiSttStream. This proxy opens
// wss://api.x.ai/v1/stt with the server-side GROK_KEY, relays binary PCM
// frames upstream, and relays xAI JSON transcript events back to the client.
// The API key never reaches the frontend.
//
// Provider selection is controlled by VOICE_STT_PROVIDER=gemini|xai. xAI is
// the default when a key is configured; Gemini remains a no-key fallback.
//
// Docs: https://docs.x.ai/developers/model-capabilities/audio/speech-to-text
/// <reference path="./types/ws.d.ts" />
import type { IncomingMessage, Server as HttpServer } from "http";
import type { Request, Response } from "express";
import { WebSocket, WebSocketServer } from "ws";
import { randomUUID } from "crypto";
import { appendConversationMeasurement } from "./conversationMeasurementLedger";
import { authenticatedOwnerId, authenticatedUserId } from "./requestAuth";
import { activeCreativeProfileIsOwned } from './CreativeProfileRoutes';
import {
    accumulateMeteredUsage,
    buildMeteredSessionKey,
    checkMeteredZeroBalanceGuard,
    getRememberedSessionConversationProfile,
    METERED_SETTLEMENT_INTERVAL_MS,
    rememberSessionConversationProfile,
    settleMeteredSession,
    usdToSubunits,
    verifyConversationSessionOwnership,
} from "./aiUsageLedger";
import {
    CONVERSATION_PROFILE_POLICY_VERSION,
    isPaidConversationProfile,
    resolveAdmittedConversationProfile,
    resolveConversationProfile,
} from "./conversationModels";

export const XAI_STT_WS_PATH = "/xaiSttStream";
const XAI_STT_URL = "wss://api.x.ai/v1/stt";

// Bias transcription toward product words so "ClikB" does not become "click B".
export const DEFAULT_KEYTERMS = ["ClikB", "Brainstorm", "Shorts", "Cinema", "Interactions"];

// Cap the pre-ready audio buffer (~35s at ~85ms/frame) so a stuck upstream
// cannot grow memory without bound.
const MAX_PENDING_FRAMES = 400;

function getXaiKey(): string {
    return process.env.GROK_KEY || process.env.XAI_API_KEY || "";
}

export function getSttProvider(): "xai" | "gemini" {
    const requested = String(process.env.VOICE_STT_PROVIDER || "xai").trim().toLowerCase();
    if (requested !== "gemini" && getXaiKey()) return "xai";
    return "gemini";
}

export const sttProviderRoute = (_req: Request, res: Response) => {
    const requested = String(process.env.VOICE_STT_PROVIDER || "xai").trim().toLowerCase();
    res.json({
        provider: getSttProvider(),
        requested,
        xaiKeyPresent: !!getXaiKey(),
    });
};

function buildXaiSttUrl(): string {
    const params = new URLSearchParams();
    params.set("encoding", "pcm");
    params.set("sample_rate", "16000");
    params.set("language", "en");
    params.set("interim_results", "true");
    // Smart Turn: model decides "finished the thought" vs "paused mid-thought".
    // 0.7 = conservative (good for think-out-loud pauses); timeout forces
    // speech_final after 3s of silence so a turn can never hang forever.
    params.set("smart_turn", process.env.XAI_SMART_TURN || "0.7");
    params.set("smart_turn_timeout", process.env.XAI_SMART_TURN_TIMEOUT || "3000");
    const keyterms = (process.env.XAI_STT_KEYTERMS
        ? process.env.XAI_STT_KEYTERMS.split(",")
        : DEFAULT_KEYTERMS
    )
        .map((t) => t.trim())
        .filter(Boolean);
    for (const term of keyterms) params.append("keyterm", term);
    return `${XAI_STT_URL}?${params.toString()}`;
}

type SttUsageSlice = {
    index: number;
    tier: string;
    billable: boolean;
    totalBytes: number;
    flushedBytes: number;
};

export type ProxyToXaiOptions = {
    upstreamFactory?: (url: string, options: { headers: Record<string, string> }) => WebSocket;
    settlementIntervalMs?: number; walletId?: string;
};

export function proxyToXai(
    client: WebSocket,
    requestUrl = "",
    userId = "",
    options?: ProxyToXaiOptions,
): void {
    const walletId = options?.walletId || userId;
    const startedAt = Date.now();
    const parsedUrl = new URL(requestUrl || "/", "http://localhost");
    const sessionId = (parsedUrl.searchParams.get("measurementSessionId") || "default").slice(0, 120) || "default";
    const initialQueryTier = parsedUrl.searchParams.get("conversationModel") || "";
    const initialPolicyVersion = parsedUrl.searchParams.get("billingPolicyVersion") || "";
    const requestId = `xai-stt-${randomUUID()}`;
    let audioBytes = 0;
    let transcriptEvents = 0;
    let firstTranscriptAt: number | null = null;
    const key = getXaiKey();
    if (!key && !options?.upstreamFactory) {
        try {
            client.send(JSON.stringify({ type: "error", message: "GROK_KEY / XAI_API_KEY not configured on server" }));
            client.close(1011, "xai key missing");
        } catch { /* noop */ }
        return;
    }

    const resolveEffectiveTier = (explicitTier?: string, policyVersion?: string): { tier: string; billable: boolean } => {
        if (explicitTier) {
            const admitted = resolveAdmittedConversationProfile(explicitTier, {
                policyVersion: policyVersion || initialPolicyVersion,
            });
            const tier = admitted?.tier || "luna";
            const billable = Boolean(admitted && isPaidConversationProfile(admitted.tier));
            return { tier, billable };
        }
        const remembered = sessionId ? getRememberedSessionConversationProfile(sessionId, userId || undefined) : null;
        if (remembered) {
            const resolved = resolveConversationProfile(remembered);
            const tier = resolved?.tier || "luna";
            const billable = Boolean(resolved && isPaidConversationProfile(resolved.tier));
            return { tier, billable };
        }
        return { tier: "luna", billable: false };
    };

    const initialResolved = resolveEffectiveTier(initialQueryTier || undefined, initialPolicyVersion || undefined);
    let currentSlice: SttUsageSlice = {
        index: 1,
        tier: initialResolved.tier,
        billable: initialResolved.billable,
        totalBytes: 0,
        flushedBytes: 0,
    };
    const slices = [currentSlice];
    let sawAnyBillableSlice = currentSlice.billable;
    let settlementTickSeq = 0;
    let fundingExhausted = false;

    const flushCurrentSliceAccrual = async (slice: SttUsageSlice): Promise<number> => {
        const unflushed = Math.max(0, slice.totalBytes - slice.flushedBytes);
        if (unflushed <= 0) return 0;
        const acceptedBytes = slice.totalBytes;
        if (!slice.billable || !userId || !sessionId) { slice.flushedBytes = acceptedBytes; return 0; }
        sawAnyBillableSlice = true;
        const deltaSeconds = unflushed / (16000 * 2);
        const deltaCostUsd = (deltaSeconds / 3600) * 0.20;
        const costSubunits = usdToSubunits(deltaCostUsd);
        if (costSubunits <= 0) return 0;
        const sessionKey = buildMeteredSessionKey("concierge", walletId, "account");
        await accumulateMeteredUsage({
            sessionKey,
            userId: walletId,
            surface: "voice",
            tier: slice.tier,
            model: "grok-voice-transcribe-streaming",
            eventId: `${requestId}:slice:${slice.index}:bytes:${acceptedBytes}`,
            costSubunits,
            billableToUser: true,
        });
        slice.flushedBytes = acceptedBytes;
        return costSubunits;
    };

    console.log("[xai-stt] client connected; dialing xAI upstream");
    const upstream = options?.upstreamFactory
        ? options.upstreamFactory(buildXaiSttUrl(), { headers: { Authorization: `Bearer ${key}` } })
        : new WebSocket(buildXaiSttUrl(), {
            headers: { Authorization: `Bearer ${key}` },
        });

    // Per docs: wait for transcript.created before sending audio.
    let upstreamReady = false;
    const pendingAudio: { frame: Buffer; slice: SttUsageSlice }[] = [];
    let closed = false;

    const runIncrementalPaidSettlement = async (reason: string): Promise<void> => {
        if (closed || !userId || !sessionId) return;
        for (const slice of slices) await flushCurrentSliceAccrual(slice);
        if (!currentSlice.billable && !sawAnyBillableSlice) return;
        const sessionKey = buildMeteredSessionKey("concierge", walletId, "account");
        settlementTickSeq += 1;
        const receipt = await settleMeteredSession({
            sessionKey,
            userId: walletId,
            surface: "voice",
            tier: currentSlice.tier,
            model: "grok-voice-transcribe-streaming",
            idempotencyKey: `${requestId}:${reason}:${settlementTickSeq}`,
            stage: "transcription",
        });
        if (receipt && (receipt.pixelsCharged > 0 || receipt.zeroBalanceReached)) {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(JSON.stringify({
                        type: "metered_billing",
                        ...receipt,
                        exhausted: receipt.zeroBalanceReached,
                        source: "voice",
                    }));
                } catch { /* noop */ }
            }
            if (receipt.zeroBalanceReached && currentSlice.billable) {
                fundingExhausted = true;
                shutdown("zero-balance-exhausted");
                return;
            }
        }
        if (currentSlice.billable && !closed) {
            const guard = await checkMeteredZeroBalanceGuard(walletId, 1);
            if (!guard.allowed) {
                fundingExhausted = true;
                if (client.readyState === WebSocket.OPEN) {
                    try {
                        client.send(JSON.stringify({
                            type: "metered_billing",
                            sessionKey,
                            userId: walletId,
                            workload: "voice",
                            profile: currentSlice.tier,
                            model: "grok-voice-transcribe-streaming",
                            pixelsCharged: 0,
                            remainingPixels: guard.balance,
                            zeroBalanceReached: true,
                            exhausted: true,
                            source: "voice",
                            message: "Not enough Pixels to continue paid voice transcription.",
                        }));
                    } catch { /* noop */ }
                }
                shutdown("zero-balance-guard");
            }
        }
    };

    const switchSliceTierIfNeeded = async (nextTier: string, nextBillable: boolean) => {
        if (nextTier === currentSlice.tier && nextBillable === currentSlice.billable) {
            return;
        }
        const prevWasBillable = currentSlice.billable;
        // No paid frames can reach the provider while admission is pending.
        if (nextBillable) {
            if (!userId) throw new Error("Authenticated voice session required.");
            const guard = await checkMeteredZeroBalanceGuard(walletId, 1);
            if (!guard.allowed) {
                fundingExhausted = true;
                client.send(JSON.stringify({ type: "metered_billing", pixelsCharged: 0,
                    remainingPixels: guard.balance, exhausted: true, zeroBalanceReached: true, source: "voice" }));
                shutdown("zero-balance-tier-switch");
                return;
            }
        }
        await flushCurrentSliceAccrual(currentSlice);
        currentSlice = {
            index: currentSlice.index + 1,
            tier: nextTier,
            billable: nextBillable,
            totalBytes: 0,
            flushedBytes: 0,
        };
        slices.push(currentSlice);
        if (nextBillable) {
            sawAnyBillableSlice = true;
        }
        if (prevWasBillable || nextBillable) {
            await runIncrementalPaidSettlement("tier-switch");
        }
    };

    // Serialize model changes, audio and timer work. EventEmitter does not await
    // async listeners: without this queue a frame overtakes a pending guard.
    let inputTail = Promise.resolve();
    let queuedInputs = 0;
    const enqueue = (work: () => Promise<void>) => {
        if (closed) return;
        if (++queuedInputs > MAX_PENDING_FRAMES) { shutdown("voice-input-backpressure"); return; }
        inputTail = inputTail.then(async () => { if (!closed) await work(); }).catch(() => {
            try { client.send(JSON.stringify({ type: "metered_billing", pixelsCharged: 0,
                pendingReconciliation: true, source: "voice", message: "Voice usage accounting is pending." })); } catch { /* closed socket */ }
            shutdown("usage-persistence-pending");
        }).finally(() => { queuedInputs -= 1; });
    };

    const intervalMs = Math.max(50, Number(options?.settlementIntervalMs) || METERED_SETTLEMENT_INTERVAL_MS);
    const settlementTimer = setInterval(() => enqueue(async () => {
        if (closed) return;
        const remembered = sessionId ? getRememberedSessionConversationProfile(sessionId, userId || undefined) : null;
        if (remembered && remembered !== currentSlice.tier) {
            const resolved = resolveConversationProfile(remembered);
            if (resolved) {
                await switchSliceTierIfNeeded(resolved.tier, isPaidConversationProfile(resolved.tier));
            }
        }
        if (currentSlice.billable) {
            await runIncrementalPaidSettlement("tick");
        }
    }), intervalMs);
    (settlementTimer as any).unref?.();

    const shutdown = (why: string) => {
        if (closed) return;
        closed = true;
        clearInterval(settlementTimer);
        const completedAt = Date.now();
        const audioSeconds = audioBytes / (16000 * 2);
        const providerCostUsd = (audioSeconds / 3600) * 0.20;

        // Flush only the remaining unflushed bytes of the active slice under its own tier

        if (sessionId) appendConversationMeasurement({
            sessionId,
            requestId,
            route: XAI_STT_WS_PATH,
            stage: "transcription",
            actionLabel: "Streaming Speech Recognition",
            status: why.includes("error") ? "failed" : "succeeded",
            startedAt: new Date(startedAt).toISOString(),
            completedAt: new Date(completedAt).toISOString(),
            elapsedMs: completedAt - startedAt,
            calls: [{
                provider: "xai",
                model: "grok-voice-transcribe-streaming",
                inputTokens: 0,
                cachedInputTokens: 0,
                outputTokens: 0,
                durationSeconds: audioSeconds,
                toolCalls: 0,
                searchCalls: 0,
                providerCostUsd,
                pricingSource: "https://x.ai/api/voice",
                usageQuality: "estimated",
                metadata: { audioBytes, transcriptEvents, closeReason: why, streamedPcmRate: 16000 },
            }],
            events: [
                { name: "voice.stt_connected", at: new Date(startedAt).toISOString(), elapsedMs: 0 },
                ...(firstTranscriptAt === null ? [] : [{ name: "voice.stt_first_transcript", at: new Date(firstTranscriptAt).toISOString(), elapsedMs: firstTranscriptAt - startedAt }]),
                { name: "voice.stt_closed", at: new Date(completedAt).toISOString(), elapsedMs: completedAt - startedAt, detail: { reason: why } },
            ],
        });
        console.log("[xai-stt] shutdown:", why);
        try { upstream.close(); } catch { /* noop */ }
        if (sessionId && userId && sawAnyBillableSlice) {
            const sessionKey = buildMeteredSessionKey("concierge", walletId, "account");
            settlementTickSeq += 1;
            void (async () => { for (const slice of slices) await flushCurrentSliceAccrual(slice); })().then(() => settleMeteredSession({
                sessionKey,
                userId: walletId,
                surface: "voice",
                tier: currentSlice.tier,
                model: "grok-voice-transcribe-streaming",
                idempotencyKey: `${requestId}:close:${settlementTickSeq}`,
                stage: "transcription",
            })).then((receipt) => {
                if (receipt && (receipt.pixelsCharged > 0 || receipt.zeroBalanceReached) && client.readyState === WebSocket.OPEN) {
                    try {
                        client.send(JSON.stringify({
                            type: "metered_billing",
                            ...receipt,
                            exhausted: receipt.zeroBalanceReached,
                            source: "voice",
                        }));
                    } catch { /* noop */ }
                }
            }).catch(() => {
                try { client.send(JSON.stringify({ type: "metered_billing", pixelsCharged: 0,
                    pendingReconciliation: true, source: "voice" })); } catch { /* closed socket */ }
            }).finally(() => {
                try { client.close(); } catch { /* noop */ }
            });
            return;
        }
        try { client.close(); } catch { /* noop */ }
    };

    upstream.on("open", () => {
        console.log("[xai-stt] upstream open; waiting for transcript.created");
    });

    upstream.on("message", (data, isBinary) => {
        if (closed) return;
        if (isBinary) return; // xAI STT only sends JSON text events
        const text = data.toString();
        try {
            const event = JSON.parse(text);
            if (event?.type === "transcript.partial" || event?.type === "transcript.done") {
                transcriptEvents += 1;
                if (firstTranscriptAt === null) firstTranscriptAt = Date.now();
            }
            if (event?.type === "transcript.created") {
                upstreamReady = true;
                if (pendingAudio.length > 0) {
                    console.log("[xai-stt] upstream ready; flushing", pendingAudio.length, "buffered frames");
                }
                for (const { frame, slice } of pendingAudio.splice(0)) {
                    upstream.send(frame);
                    audioBytes += frame.length;
                    slice.totalBytes += frame.length;
                }
            }
        } catch { /* relay unparseable text as-is */ }
        if (client.readyState === WebSocket.OPEN) {
            client.send(text);
        }
    });

    upstream.on("error", (err) => {
        console.error("[xai-stt] upstream error:", err?.message || err);
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(JSON.stringify({ type: "error", message: "xai upstream error: " + (err?.message || "unknown") }));
            } catch { /* noop */ }
        }
        shutdown("upstream error");
    });

    upstream.on("close", (code, reason) => {
        shutdown(`upstream close code=${code} reason=${reason?.toString?.() || ""}`);
    });

    client.on("message", (data, isBinary) => enqueue(async () => {
        if (closed || fundingExhausted) return;
        if (!isBinary) {
            const text = data.toString();
            let parsed: any = null;
            try { parsed = JSON.parse(text); } catch { /* Non-JSON upstream control message */ }
                if (parsed?.type === "clikb.tier") {
                    const requestedTier = String(parsed.conversationModel || "luna");
                    const policyVer = String(parsed.billingPolicyVersion || parsed.policyVersion || "");
                    if (isPaidConversationProfile(requestedTier) && !userId) {
                        try {
                            client.send(JSON.stringify({
                                type: "error",
                                code: "AUTH_REQUIRED",
                                message: "Your session has expired. Please sign in again.",
                            }));
                        } catch { /* noop */ }
                        shutdown("unauthenticated-paid-tier-switch");
                        return;
                    }
                    const admitted = resolveAdmittedConversationProfile(requestedTier, { policyVersion: policyVer });
                    const nextTier = admitted?.tier || "luna";
                    const nextBillable = Boolean(admitted && isPaidConversationProfile(admitted.tier));
                    await switchSliceTierIfNeeded(nextTier, nextBillable);
                    if (!closed && sessionId && userId) rememberSessionConversationProfile(sessionId, nextTier, userId);
                    return;
                }
            if (upstream.readyState === WebSocket.OPEN) {
                upstream.send(text);
            }
            return;
        }

        // Check if session remembered tier changed via HTTP Brainstorm turn while WS was open
        const remembered = sessionId ? getRememberedSessionConversationProfile(sessionId, userId || undefined) : null;
        if (remembered && remembered !== currentSlice.tier) {
            const resolved = resolveConversationProfile(remembered);
            if (resolved) {
                await switchSliceTierIfNeeded(resolved.tier, isPaidConversationProfile(resolved.tier));
            }
        }
        if (closed || fundingExhausted) return;

        if (currentSlice.billable && !userId) {
            shutdown("unauthenticated-paid-audio");
            return;
        }

        const buf = Buffer.isBuffer(data)
            ? data
            : Array.isArray(data)
                ? Buffer.concat(data)
                : Buffer.from(data);
        if (upstreamReady && upstream.readyState === WebSocket.OPEN) {
            upstream.send(buf);
            audioBytes += buf.length;
            currentSlice.totalBytes += buf.length;
        } else {
            pendingAudio.push({ frame: buf, slice: currentSlice });
            if (pendingAudio.length > MAX_PENDING_FRAMES) pendingAudio.shift();
        }
    }));

    client.on("close", () => shutdown("client close"));
    client.on("error", (err) => shutdown("client error: " + (err?.message || "unknown")));
}

export function attachXaiSttProxy(server: HttpServer, options?: ProxyToXaiOptions): void {
    const wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", async (req: IncomingMessage, socket, head) => {
        const rawUrl = req.url || "";
        const path = rawUrl.split("?")[0];
        if (path !== XAI_STT_WS_PATH) {
            return;
        }
        const parsedUrl = new URL(rawUrl || "/", "http://localhost");
        const sessionId = (parsedUrl.searchParams.get("measurementSessionId") || "default").slice(0, 120) || "default";
        const queryTier = parsedUrl.searchParams.get("conversationModel") || "";
        const queryPolicy = parsedUrl.searchParams.get("billingPolicyVersion") || "";
        const userId = String(authenticatedUserId(req as unknown as Request) || "");
        const walletId = authenticatedOwnerId(req) || userId;
        if (userId) {
            try {
                if (!await activeCreativeProfileIsOwned(userId, walletId)) { socket.destroy(); return; }
            } catch { socket.destroy(); return; }
        }

        if (userId && !verifyConversationSessionOwnership(sessionId, userId)) {
            try {
                socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
            } catch { /* noop */ }
            socket.destroy();
            return;
        }

        const rememberedTier = getRememberedSessionConversationProfile(sessionId, userId || undefined);
        const candidateTier = queryTier || rememberedTier || "luna";
        if (isPaidConversationProfile(candidateTier) && !userId) {
            try {
                socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
            } catch { /* noop */ }
            socket.destroy();
            return;
        }

        const admitted = queryTier
            ? resolveAdmittedConversationProfile(queryTier, {
                policyVersion: queryPolicy || (req.headers?.["x-clikb-billing-policy"] as string | undefined),
            })
            : resolveConversationProfile(rememberedTier || "luna");
        const isPaid = Boolean(admitted && isPaidConversationProfile(admitted.tier));

        if (isPaid && userId) {
            void checkMeteredZeroBalanceGuard(walletId, 1)
                .then((guard) => {
                    if (!guard.allowed) {
                        try {
                            socket.write("HTTP/1.1 402 Payment Required\r\nConnection: close\r\n\r\n");
                        } catch { /* noop */ }
                        socket.destroy();
                        return;
                    }
                    rememberSessionConversationProfile(sessionId, admitted!.tier, userId);
                    const normalizedUrl = new URL(rawUrl || "/", "http://localhost");
                    normalizedUrl.searchParams.set("conversationModel", admitted!.tier);
                    normalizedUrl.searchParams.set("billingPolicyVersion", CONVERSATION_PROFILE_POLICY_VERSION);
                    wss.handleUpgrade(req, socket, head, (client) =>
                        proxyToXai(client, normalizedUrl.pathname + normalizedUrl.search, userId, { ...options, walletId }),
                    );
                })
                .catch(() => {
                    try { socket.destroy(); } catch { /* noop */ }
                });
            return;
        }

        if (admitted && userId) {
            rememberSessionConversationProfile(sessionId, admitted.tier, userId);
        }
        const normalizedUrl = new URL(rawUrl || "/", "http://localhost");
        if (admitted) {
            normalizedUrl.searchParams.set("conversationModel", admitted.tier);
        }
        wss.handleUpgrade(req, socket, head, (client) =>
            proxyToXai(client, normalizedUrl.pathname + normalizedUrl.search, userId, { ...options, walletId }),
        );
    });

    console.log(`[xai-stt] WebSocket proxy attached at ${XAI_STT_WS_PATH} (provider=${getSttProvider()})`);
}
