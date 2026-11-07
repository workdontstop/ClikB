export type CinemaDialogueStage = {
    stage: 'A' | 'B';
    imageDescription: string;
    context: string;
    duration: number;
    intent?: unknown;
};

export type CinemaNarrationRequest = {
    stage: 'A' | 'B';
    text: string;
    delivery?: string;
    stages: [CinemaDialogueStage, CinemaDialogueStage];
};

export type CinemaDialogueSource = {
    pairIndex: number;
    signature: string;
    narration: CinemaNarrationRequest;
    llmTier?: unknown;
};

export type CinemaDialoguePlan = { stageA: string; stageB: string };
export type CinemaDialoguePlanSnapshot = { version: 1; entries: Array<[string, CinemaDialoguePlan]> };

// Cinema's two stage slots are native A shots. Supplemental B shots use their
// own source image and must not be mistaken for the second Cinema stage.
export const buildCinemaDialogueSource = (options: {
    creationType: unknown;
    target: { type: 'A' | 'B'; index: number };
    narration: unknown;
    duration: unknown;
    resolveIndex: (nativeIndex: number) => number;
    imageDescription: (displayIndex: number) => unknown;
    context: (nativeIndex: number, displayIndex: number) => unknown;
    intent?: (nativeIndex: number) => unknown;
    frame?: (displayIndex: number) => unknown;
    videoContext?: unknown;
    llmTier?: unknown;
}): CinemaDialogueSource | null => {
    if (Number(options.creationType) !== 1 || options.target.type !== 'A' ||
        !Number.isInteger(options.target.index) || options.target.index < 0) return null;
    const raw = options.narration;
    const text = String(raw && typeof raw === 'object' ? (raw as { text?: unknown }).text ?? '' : raw ?? '').trim();
    if (!text) return null;
    const delivery = raw && typeof raw === 'object'
        ? String((raw as { prompt?: unknown }).prompt ?? '').trim() : '';
    const selectedDuration = Number(options.duration);
    const duration = Number.isFinite(selectedDuration) && selectedDuration > 0 ? selectedDuration : 5;
    const pairIndex = Math.floor(options.target.index / 2);
    const firstIndex = pairIndex * 2;
    const firstDisplayIndex = options.resolveIndex(firstIndex);
    const secondDisplayIndex = options.resolveIndex(firstIndex + 1);
    if (firstDisplayIndex < 0 || secondDisplayIndex < 0) return null;
    const stages = [firstIndex, firstIndex + 1].map((nativeIndex, stageIndex) => {
        const displayIndex = stageIndex === 0 ? firstDisplayIndex : secondDisplayIndex;
        return {
            stage: stageIndex === 0 ? 'A' as const : 'B' as const,
            imageDescription: String(options.imageDescription(displayIndex) ?? '').trim(),
            context: String(options.context(nativeIndex, displayIndex) ?? '').trim(),
            duration,
            ...(options.intent ? { intent: options.intent(nativeIndex) ?? null } : {}),
        };
    }) as [CinemaDialogueStage, CinemaDialogueStage];
    // Exclude the requested stage: both stages share the same speech allocation.
    const signature = JSON.stringify({ pairIndex, text, delivery, stages,
        frames: options.frame ? [options.frame(firstDisplayIndex), options.frame(secondDisplayIndex)] : undefined,
        videoContext: options.videoContext ?? null, llmTier: options.llmTier ?? null });
    return {
        pairIndex,
        signature,
        llmTier: options.llmTier,
        narration: { stage: options.target.index % 2 === 0 ? 'A' : 'B', text, ...(delivery ? { delivery } : {}), stages },
    };
};

export const createCinemaDialoguePlanCache = () => {
    let epoch = 0;
    const plans = new Map<string, CinemaDialoguePlan>();
    const pending = new Map<string, { completion: Promise<void>; finish: () => void }>();
    const reset = () => {
        epoch += 1;
        plans.clear();
        const waiting = [...pending.values()];
        pending.clear();
        waiting.forEach(request => request.finish());
    };
    return {
        reset,
        snapshot: (): CinemaDialoguePlanSnapshot => ({ version: 1,
            entries: [...plans].map(([signature, plan]): [string, CinemaDialoguePlan] => [signature, { ...plan }]) }),
        restore: (snapshot: unknown): void => {
            reset();
            const value = snapshot as Partial<CinemaDialoguePlanSnapshot> | null;
            if (value?.version !== 1 || !Array.isArray(value.entries)) return;
            for (const entry of value.entries) {
                if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || !entry[0]
                    || !entry[1] || typeof entry[1] !== 'object') continue;
                const plan = entry[1] as Partial<CinemaDialoguePlan>;
                if (typeof plan.stageA === 'string' && typeof plan.stageB === 'string') {
                    plans.set(entry[0], { stageA: plan.stageA, stageB: plan.stageB });
                }
            }
        },
        epoch: () => epoch,
        isCurrent: (requestEpoch: number) => requestEpoch === epoch,
        get: (signature: string): CinemaDialoguePlan | undefined => plans.get(signature),
        reserve: (signature: string) => {
            const waiting = pending.get(signature);
            if (waiting) return { owner: false, completion: waiting.completion, release: () => {} };
            let finish!: () => void;
            const completion = new Promise<void>(resolve => { finish = resolve; });
            const request = { completion, finish };
            pending.set(signature, request);
            return {
                owner: true,
                completion,
                release: () => {
                    // An older owner's finally must not unlock a new request
                    // that reserved the same source after a project reset.
                    if (pending.get(signature) === request) pending.delete(signature);
                    finish();
                },
            };
        },
        store: (signature: string, value: unknown, requestEpoch: number): boolean => {
            if (requestEpoch !== epoch || !value || typeof value !== 'object') return false;
            const plan = value as Partial<CinemaDialoguePlan>;
            if (typeof plan.stageA !== 'string' || typeof plan.stageB !== 'string') return false;
            plans.set(signature, { stageA: plan.stageA, stageB: plan.stageB });
            return true;
        },
    };
};
