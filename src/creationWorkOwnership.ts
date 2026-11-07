export class CreationWorkPaused extends Error {
    constructor() { super('Creation work is paused.'); this.name = 'CreationWorkPaused'; }
}

/** Paid requests retain their owner and successful result through UI pauses. */
export class OwnedCreationRequests<T> {
    private active = new Map<string, Promise<T>>();
    private retained = new Map<string, T>();
    hasActive(key: string) { return this.active.has(key); }
    result(key: string) { return this.retained.get(key); }
    run(key: string, allowed: () => boolean, submit: () => Promise<T>): Promise<T> {
        const active = this.active.get(key);
        if (active) return active;
        if (this.retained.has(key)) return Promise.resolve(this.retained.get(key)!);
        const request = Promise.resolve().then(() => {
            if (!allowed()) throw new CreationWorkPaused();
            return submit();
        }).then(result => {
            this.retained.set(key, result);
            return result;
        });
        this.active.set(key, request);
        void request.finally(() => {
            if (this.active.get(key) === request) this.active.delete(key);
        }).catch(() => {});
        return request;
    }
}

/** One persistent queue owner; every next operation reads current state. */
export class SerialCreationWorker {
    private active: Promise<void> | null = null;
    run(allowed: () => boolean, next: () => Promise<boolean>): Promise<void> {
        if (this.active) return this.active;
        const work = Promise.resolve().then(async () => {
            while (allowed()) {
                if (!await next()) break;
            }
        });
        this.active = work;
        void work.finally(() => {
            if (this.active === work) this.active = null;
        }).catch(() => {});
        return work;
    }
}

export function narrationContentKey(item: any, voice: string): string {
    return JSON.stringify({
        text: typeof item === 'object' && item !== null ? String(item.text || '') : String(item || ''),
        voice,
        prompt: typeof item === 'object' && item !== null && item.prompt
            ? String(item.prompt) : "DIRECTOR'S NOTES: Clear and expressive delivery.",
        language_code: 'en-US',
    });
}

export function isCompletedCreationMedia(value: unknown): value is string {
    return typeof value === 'string' && Boolean(value.trim())
        && !['EMPTY', 'EMPTY_BSHOT', 'ERROR', 'undefined', 'null'].includes(value.trim());
}

export type BShotCreationStage = { index: number; shot: number; prompt: string; pending: boolean; key: string };
export function nextBShotCreationStage(live: {
    prompts: string[][]; images: string[][]; videos: string[][]; nanoImages: string[][];
    GeneratedText: string[]; topology: number;
}, failed: ReadonlySet<string>): BShotCreationStage | null {
    for (let index = 0; index < live.prompts.length; index++) {
        for (let shot = 0; shot < (live.prompts[index] || []).length; shot++) {
            if (isCompletedCreationMedia(live.images[index]?.[shot]) || isCompletedCreationMedia(live.videos[index]?.[shot])) continue;
            const prompt = String(live.prompts[index][shot] || '');
            const pending = prompt.includes('[B-Shot-Pending');
            if (!prompt || (pending && !live.GeneratedText[index])) continue;
            if (!pending && isCompletedCreationMedia(live.nanoImages[index]?.[shot])) continue;
            const key = JSON.stringify([live.topology, index, shot, pending ? 'prompt' : 'nano', prompt]);
            if (!failed.has(key)) return { index, shot, prompt, pending, key };
        }
    }
    return null;
}
