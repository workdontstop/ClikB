type Receipt = { receiptId?: string; sessionKey?: string; receiptSeq?: number; pendingReconciliation?: boolean };

export const isCurrentMeteredReceipt = (receipt: { userId?: unknown; sessionKey?: string }, currentUserId: unknown): boolean => {
  const owner = receipt.userId ?? receipt.sessionKey?.match(/^(?:concierge|voice|motion|spatial):([^:]+):/)?.[1];
  return owner === undefined || String(owner) === String(currentUserId ?? '');
};

type WalletObservation = { userId: string | null; revision: number };
/** Fresh wallet reads are guarded against later media debits, credits and account switches. */
export class MeteredWalletRefresh {
  private running: Promise<void> | null = null;
  private again = false;
  constructor(private observe: () => WalletObservation, private read: (userId: string) => Promise<number>, private apply: (balance: number) => void) {}
  request(): Promise<void> {
    this.again = true;
    if (this.running) return this.running;
    this.running = (async () => {
      for (let attempt = 0; attempt < 2 && this.again; attempt++) {
        this.again = false;
        const before = this.observe();
        if (!before.userId) return;
        try {
          const balance = await this.read(before.userId);
          const current = this.observe();
          if (current.userId !== before.userId) return;
          if (current.revision !== before.revision) { this.again = true; continue; }
          if (Number.isFinite(balance) && balance >= 0) this.apply(Math.floor(balance));
        } catch { /* Keep the last known balance; retry on the next receipt/poll. */ }
      }
    })().finally(() => { this.running = null; });
    return this.running;
  }
}

/** UI delivery bookkeeping only. It cannot accept usage or authorise a debit. */
export class MeteredReceiptState {
  private seen = new Set<string>();
  private lastSequence = new Map<string, number>();
  private cursors = new Map<string, number>();
  private scheduled = false;
  constructor(private persistence?: { load: () => string | null; save: (value: string) => void }) {
    try {
      const state = JSON.parse(persistence?.load() || 'null');
      if (state?.version === 1) {
        this.seen = new Set((state.seen || []).filter((id: unknown) => typeof id === 'string').slice(-512));
        for (const [source, target] of [[state.sequence, this.lastSequence], [state.cursors, this.cursors]] as const) {
          for (const entry of (Array.isArray(source) ? source.slice(-32) : [])) {
            if (typeof entry?.[0] === 'string' && Number.isSafeInteger(entry[1]) && entry[1] >= 0) target.set(entry[0], entry[1]);
          }
        }
      }
    } catch { /* UI storage is optional, never billing authority. */ }
  }

  private persist(): void {
    if (this.scheduled || !this.persistence) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      try { this.persistence?.save(JSON.stringify({ version: 1, seen: [...this.seen], sequence: [...this.lastSequence], cursors: [...this.cursors] })); }
      catch { /* Private browsing/quota must not interrupt the app. */ }
    });
  }

  accept(receipt: Receipt): { fresh: boolean; updateBalance: boolean } {
    const id = receipt.receiptId;
    const fresh = !id || !this.seen.has(id);
    if (id && fresh) {
      this.seen.add(id);
      while (this.seen.size > 512) this.seen.delete(this.seen.values().next().value!);
    }
    const key = receipt.sessionKey;
    const seq = Number(receipt.receiptSeq);
    let updateBalance = fresh && !receipt.pendingReconciliation;
    if (key && Number.isFinite(seq)) {
      const previous = this.lastSequence.get(key) ?? -1;
      updateBalance = updateBalance && seq > previous;
      if (seq > previous) this.lastSequence.set(key, seq);
      while (this.lastSequence.size > 32) this.lastSequence.delete(this.lastSequence.keys().next().value!);
    }
    this.persist();
    return { fresh, updateBalance };
  }

  cursor(key: string): number { return this.cursors.get(key) || 0; }
  advance(key: string, seq: number): void {
    if (key && Number.isFinite(seq)) {
      this.cursors.set(key, Math.max(this.cursor(key), Math.floor(seq)));
      while (this.cursors.size > 32) this.cursors.delete(this.cursors.keys().next().value!);
      this.persist();
    }
  }
}
