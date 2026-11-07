type BuildProvider = {
    predictions: {
        create: (...args: any[]) => Promise<{ id: string }>;
        cancel: (id: string) => Promise<unknown>;
    };
    stream: (...args: any[]) => AsyncIterable<any>;
};

/** The SDK's stream signal closes SSE only. Also cancel this build's prediction. */
export async function* streamReplicateBuild(provider: BuildProvider, model: string, input: Record<string, any>, signal?: AbortSignal) {
    if (signal?.aborted) throw Object.assign(new Error('Build cancelled before provider submission.'), { name: 'AbortError' });
    const create = provider.predictions.create;
    let predictionId: string | undefined, completed = false, cancellation: Promise<unknown> | undefined;
    const cancel = () => {
        if (!predictionId || completed || cancellation) return;
        cancellation = provider.predictions.cancel(predictionId).catch(() => {
            console.warn('[ThreeJS]', JSON.stringify({ event: 'provider-cancel-failed', predictionId }));
        });
    };
    // The provider instance belongs exclusively to this request. Capture the one
    // ID created by its native stream method, preserving the SDK's SSE handling.
    provider.predictions.create = async (...args) => {
        const prediction = await create.apply(provider.predictions, args);
        predictionId = prediction.id;
        if (signal?.aborted) cancel();
        return prediction;
    };
    signal?.addEventListener('abort', cancel, { once: true });
    try {
        for await (const event of provider.stream(model, { input, signal })) {
            if (signal?.aborted) break;
            if (event.event === 'done') completed = true;
            yield event;
        }
    } finally {
        if (!completed) cancel();
        signal?.removeEventListener('abort', cancel);
        provider.predictions.create = create;
    }
}
