// XaiStt: WebSocket proxy for xAI streaming speech-to-text.
//
// The browser connects to <backend>/xaiSttStream. This proxy opens
// wss://api.x.ai/v1/stt with the server-side GROK_KEY, relays binary PCM
// frames upstream, and relays xAI JSON transcript events back to the client.
// The API key never reaches the frontend.
//
// Provider selection is controlled by VOICE_STT_PROVIDER=gemini|xai (default
// gemini). The frontend asks GET /sttProvider at voice start, so switching
// providers is a backend env change + restart, no frontend rebuild needed.
//
// Docs: https://docs.x.ai/developers/model-capabilities/audio/speech-to-text
/// <reference path="./types/ws.d.ts" />
import type { IncomingMessage, Server as HttpServer } from "http";
import type { Request, Response } from "express";
import { WebSocket, WebSocketServer } from "ws";

export const XAI_STT_WS_PATH = "/xaiSttStream";
const XAI_STT_URL = "wss://api.x.ai/v1/stt";

// Bias transcription toward product words so "ClikB" does not become "click B".
const DEFAULT_KEYTERMS = ["ClikB", "ClickB", "Clik B", "Click B", "ClikBee", "ClickBee", "ClikB app", "ClikB creative AI app", "Brainstorm", "Magic Mirror", "Shorts", "Cinema", "Interactions"];

// Cap the pre-ready audio buffer (~35s at ~85ms/frame) so a stuck upstream
// cannot grow memory without bound.
const MAX_PENDING_FRAMES = 400;

function getXaiKey(): string {
    return process.env.GROK_KEY || process.env.XAI_API_KEY || "";
}

export function getSttProvider(): "xai" | "gemini" {
    const requested = String(process.env.VOICE_STT_PROVIDER || "gemini").trim().toLowerCase();
    // Fall back to gemini if xai is requested but no key is configured.
    if (requested === "xai" && getXaiKey()) return "xai";
    return "gemini";
}

export const sttProviderRoute = (_req: Request, res: Response) => {
    const requested = String(process.env.VOICE_STT_PROVIDER || "gemini").trim().toLowerCase();
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

function proxyToXai(client: WebSocket): void {
    const key = getXaiKey();
    if (!key) {
        try {
            client.send(JSON.stringify({ type: "error", message: "GROK_KEY / XAI_API_KEY not configured on server" }));
            client.close(1011, "xai key missing");
        } catch { /* noop */ }
        return;
    }

    console.log("[xai-stt] client connected; dialing xAI upstream");
    const upstream = new WebSocket(buildXaiSttUrl(), {
        headers: { Authorization: `Bearer ${key}` },
    });

    // Per docs: wait for transcript.created before sending audio.
    let upstreamReady = false;
    const pendingAudio: Buffer[] = [];
    let closed = false;

    const shutdown = (why: string) => {
        if (closed) return;
        closed = true;
        console.log("[xai-stt] shutdown:", why);
        try { upstream.close(); } catch { /* noop */ }
        try { client.close(); } catch { /* noop */ }
    };

    upstream.on("open", () => {
        console.log("[xai-stt] upstream open; waiting for transcript.created");
    });

    upstream.on("message", (data, isBinary) => {
        if (isBinary) return; // xAI STT only sends JSON text events
        const text = data.toString();
        try {
            const event = JSON.parse(text);
            if (event?.type === "transcript.created") {
                upstreamReady = true;
                if (pendingAudio.length > 0) {
                    console.log("[xai-stt] upstream ready; flushing", pendingAudio.length, "buffered frames");
                }
                for (const frame of pendingAudio.splice(0)) {
                    upstream.send(frame);
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

    client.on("message", (data, isBinary) => {
        if (isBinary) {
            const buf = Buffer.isBuffer(data)
                ? data
                : Array.isArray(data)
                    ? Buffer.concat(data)
                    : Buffer.from(data);
            if (upstreamReady && upstream.readyState === WebSocket.OPEN) {
                upstream.send(buf);
            } else {
                pendingAudio.push(buf);
                if (pendingAudio.length > MAX_PENDING_FRAMES) pendingAudio.shift();
            }
            return;
        }
        // Text frames are control messages (e.g. {"type":"audio.done"}); relay verbatim.
        if (upstream.readyState === WebSocket.OPEN) {
            upstream.send(data.toString());
        }
    });

    client.on("close", () => shutdown("client close"));
    client.on("error", (err) => shutdown("client error: " + (err?.message || "unknown")));
}

export function attachXaiSttProxy(server: HttpServer): void {
    const wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (req: IncomingMessage, socket, head) => {
        const path = (req.url || "").split("?")[0];
        if (path !== XAI_STT_WS_PATH) {
            socket.destroy();
            return;
        }
        wss.handleUpgrade(req, socket, head, (client) => proxyToXai(client));
    });

    console.log(`[xai-stt] WebSocket proxy attached at ${XAI_STT_WS_PATH} (provider=${getSttProvider()})`);
}
