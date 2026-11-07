type Claim = { token: symbol; owner: 'manual' | 'automatic'; settled: Promise<boolean>; resolve: (success: boolean) => void };

/** Synchronous ownership before any prompt refinement/network await. */
export class ReferenceRenderClaims {
    private active = new Map<string, Claim>();
    private completed = new Set<string>();
    begin(id: string, owner: Claim['owner']): symbol | undefined {
        if (!id || this.active.has(id)) return undefined;
        let resolve!: Claim['resolve'];
        const settled = new Promise<boolean>(done => { resolve = done; });
        const token = Symbol(id);
        this.active.set(id, { token, owner, settled, resolve });
        return token;
    }
    working(id: string | null | undefined) { return Boolean(id && this.active.has(id)); }
    owns(id: string, token: symbol) { return this.active.get(id)?.token === token; }
    done(id: string | null | undefined) { return Boolean(id && this.completed.has(id)); }
    wait(id: string) { return this.active.get(id)?.settled || Promise.resolve(this.done(id)); }
    finish(id: string, token: symbol, success: boolean) {
        const claim = this.active.get(id);
        if (claim?.token !== token) return;
        if (success) this.completed.add(id);
        this.active.delete(id); claim.resolve(success);
    }
}

export async function runReferenceWorkers<T>(items: T[], render: (item: T) => Promise<void>, current = () => true) {
    let next = 0;
    const worker = async () => {
        while (current() && next < items.length) { const item = items[next++]; await render(item); }
    };
    const results = await Promise.allSettled([worker(), worker()]);
    const failed = results.find(result => result.status === 'rejected');
    if (failed?.status === 'rejected') throw failed.reason;
}

/** Detection can finish after a user starts/finishes a manual render. */
export function preserveOwnedReferences<T extends { name: string; clientReferenceId?: string; imageGenerationMode?: 'recreate' | 'edit' }>(
    incoming: T[], current: T[], owned: (id: string | undefined) => boolean,
    sameName: (left: string, right: string) => boolean,
): T[] {
    return incoming.map(item => {
        const previous = current.find(ref => sameName(ref.name, item.name));
        if (!previous) return item;
        return owned(previous.clientReferenceId)
            ? { ...item, ...previous, name: item.name }
            : { ...item, clientReferenceId: previous.clientReferenceId,
                ...(previous.imageGenerationMode ? { imageGenerationMode: previous.imageGenerationMode } : {}) };
    });
}
