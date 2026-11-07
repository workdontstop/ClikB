/** Verify once per 10-second window, giving the database ample time while bounding deadlocks. */
export const LIVE_SECURITY_INTERVAL_MS = 10_000;
export const LIVE_SECURITY_VERIFY_BUDGET_MS = 6_000;
export function guardLiveBuild(
    verify: () => Promise<number>,
    heartbeat: (pixels: number) => void,
    halt: (error: Error) => void,
): () => void {
    let stopped = false;
    let check: ReturnType<typeof setTimeout>;
    let deadline: ReturnType<typeof setTimeout>;
    const stop = () => { stopped = true; clearTimeout(check); clearTimeout(deadline); };
    const fail = (error: unknown) => {
        if (stopped) return;
        stop();
        halt(error instanceof Error ? error : new Error('The build security check failed.'));
    };
    const window = () => {
        let balance: number | undefined;
        // Start the check with ample time to complete across multi-table accounting and scene saves.
        check = setTimeout(() => {
            void Promise.resolve().then(verify).then(pixels => {
                if (!stopped) balance = pixels;
            }, fail);
        }, LIVE_SECURITY_INTERVAL_MS - LIVE_SECURITY_VERIFY_BUDGET_MS);
        deadline = setTimeout(() => {
            if (stopped) return;
            if (balance === undefined) { fail(new Error('The 10-second security check timed out. The draft is retained.')); return; }
            heartbeat(balance);
            window();
        }, LIVE_SECURITY_INTERVAL_MS);
    };
    window();
    return stop;
}
