export type InitialVideoDialogueRequest = { key: string; version: number; epoch: number };
export type InitialVideoDialogueSnapshot = { version: 1; entries: Array<[string, string]> };

export const normalizeVideoDialogue = (value: string): string => {
    const text = value.trim().replace(/^VOICE\s*&\s*DIALOG\s*:\s*/i, '').trim();
    if (!text || /^(?:no dialogue|none|n\/a)[.!]?$/i.test(text)) return '';
    return `VOICE & DIALOG:\n${text}`;
};

export const insertVideoDialogue = (prompt: string, dialogue: string): string => {
    const block = normalizeVideoDialogue(dialogue);
    // A user may already have written their own dialogue in the Notepad.
    if (!block || /^[\t ]*VOICE\s*&\s*DIALOG\s*:/im.test(prompt)) return prompt;
    const constraints = /^[\t ]*CONSTRAINTS\s*:/im.exec(prompt);
    const before = constraints ? prompt.slice(0, constraints.index).trimEnd() : prompt.trimEnd();
    const after = constraints ? `\n\n${prompt.slice(constraints.index)}` : '';
    return `${before}${before ? '\n\n' : ''}${block}${after}`;
};

// A version is reserved before the initial batch starts, including queued
// scenes. Later user requests invalidate it even if their network call fails.
export const createInitialVideoDialogueCache = () => {
    let epoch = 0;
    const versions = new Map<string, number>();
    const dialogues = new Map<string, string>();
    const invalidate = (key: string) => {
        versions.set(key, (versions.get(key) || 0) + 1);
        dialogues.delete(key);
    };
    const isCurrent = (request: InitialVideoDialogueRequest) =>
        request.epoch === epoch && request.version === versions.get(request.key);
    const reset = () => { epoch += 1; versions.clear(); dialogues.clear(); };
    return {
        invalidate,
        isCurrent,
        reset,
        // Persist creative values only. Request epochs/versions never survive
        // restoration, so a provider response from before restore stays stale.
        snapshot: (): InitialVideoDialogueSnapshot => ({ version: 1, entries: [...dialogues] }),
        restore: (snapshot: unknown): void => {
            reset();
            const value = snapshot as Partial<InitialVideoDialogueSnapshot> | null;
            if (value?.version !== 1 || !Array.isArray(value.entries)) return;
            for (const entry of value.entries) {
                if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string'
                    || typeof entry[1] !== 'string' || !entry[0]) continue;
                const block = normalizeVideoDialogue(entry[1]);
                if (block) dialogues.set(entry[0], block);
            }
        },
        begin: (key: string): InitialVideoDialogueRequest => {
            invalidate(key);
            return { key, version: versions.get(key)!, epoch };
        },
        store: (request: InitialVideoDialogueRequest, value: string): boolean => {
            if (!isCurrent(request)) return false;
            const block = normalizeVideoDialogue(value);
            if (!block) return false;
            dialogues.set(request.key, block);
            return true;
        },
        get: (key: string): string => dialogues.get(key) || '',
        take: (key: string): string => {
            const block = dialogues.get(key) || '';
            invalidate(key);
            return block;
        },
    };
};
