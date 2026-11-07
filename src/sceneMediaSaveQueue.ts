/** Serialize writes to one scene so a slower old request cannot land last. */
export class SceneMediaSaveQueue {
    private pending = new Map<string, Promise<unknown>>();
    run<T>(key: string, write: () => Promise<T>): Promise<T> {
        const previous = this.pending.get(key) || Promise.resolve();
        const current = previous.catch(() => undefined).then(write);
        this.pending.set(key, current);
        const release = () => { if (this.pending.get(key) === current) this.pending.delete(key); };
        void current.then(release, release);
        return current;
    }
}
