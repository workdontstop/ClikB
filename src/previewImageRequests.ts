/** A balance refresh, StrictMode restart or reopening a preview cannot create
 * another paid request for inputs that this editor has already submitted. */
export class PreviewImageRequests<T> {
    private requests = new Map<string, Promise<T>>();
    private enabled = true;
    setEnabled(enabled: boolean) { this.enabled = enabled; }
    has(key: string) { return this.requests.has(key); }
    run(key: string, work: () => Promise<T>): Promise<T> {
        const existing = this.requests.get(key); if (existing) return existing;
        const result = Promise.resolve().then(() => {
            // Dialog transitions can retain children with old props. Check the
            // persistent owner's current state at the actual submission point.
            if (!this.enabled) {
                if (this.requests.get(key) === result) this.requests.delete(key);
                const error = new Error('The preview editor is closed.'); error.name = 'AbortError'; throw error;
            }
            return work();
        }); this.requests.set(key, result);
        // Keep failed attempts too: UI rerenders must not silently bill retries.
        if (this.requests.size > 32) this.requests.delete(this.requests.keys().next().value!);
        return result;
    }
}
