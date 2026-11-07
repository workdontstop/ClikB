import OpenAI from 'openai';
import nodeFetch from 'node-fetch';

export const LIVE_SCENE_REQUEST_TIMEOUT_MS = 600_000;

/** Keep the existing ten-minute first-response deadline, without native
 * fetch's separate five-minute header/body inactivity cutoffs. node-fetch's
 * default transport timeouts are zero. After headers, the streamed body remains
 * cancellable through the same AbortSignal used by Pause/Stop. This SDK reads
 * its Node readable stream directly. No global fetch configuration changes. */
export function createLiveSceneModelClient(apiKey = process.env.DALLE_KEY) {
    return new OpenAI({
        apiKey,
        timeout: LIVE_SCENE_REQUEST_TIMEOUT_MS,
        maxRetries: 0,
        fetch: nodeFetch as unknown as typeof globalThis.fetch,
    });
}
