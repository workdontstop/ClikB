import assert from "node:assert/strict";
import test from "node:test";

/**
 * Stage 6B cache tests.
 *
 * Run separately from test:touch-interactions — those 25 tests cover the
 * navigation/hold model and never touch media loading.
 *
 * The module is imported lazily, AFTER the URL and fetch stubs are installed,
 * because it reads them at load time.
 */

// ── stubs ──────────────────────────────────────────────────────────────────

let objectUrlSeq = 0;
/** Every object URL ever handed out, with how many times it was revoked. */
let revokeCounts = new Map<string, number>();

(URL as any).createObjectURL = (_blob: unknown) => {
    const url = `blob:mock/${++objectUrlSeq}`;
    revokeCounts.set(url, 0);
    return url;
};
(URL as any).revokeObjectURL = (url: string) => {
    revokeCounts.set(url, (revokeCounts.get(url) ?? 0) + 1);
};

interface FinishOptions { ok?: boolean; status?: number; size?: number }

let fetchLog: string[] = [];
/** Size handed to the next completed download unless overridden per-call. */
let nextSize = 1024;
/** When true, downloads hang until released by url. */
let holdMode = false;
/** When true, the stub ignores AbortSignal — used to exercise the stale-generation guard. */
let ignoreAbort = false;
let gates = new Map<string, (opts?: FinishOptions) => void>();

const abortError = () => Object.assign(new Error("aborted"), { name: "AbortError" });

(globalThis as any).fetch = (input: any, init?: any) => {
    const url = String(input);
    fetchLog.push(url);
    const signal: AbortSignal | undefined = init?.signal;
    const sizeAtCall = nextSize;

    return new Promise((resolve, reject) => {
        const finish = (opts: FinishOptions = {}) => {
            const ok = opts.ok !== false;
            resolve({
                ok,
                status: opts.status ?? (ok ? 200 : 404),
                statusText: ok ? "OK" : "Not Found",
                blob: async () => ({ size: opts.size ?? sizeAtCall, type: "video/mp4" }),
            });
        };

        if (signal && !ignoreAbort) {
            if (signal.aborted) { reject(abortError()); return; }
            signal.addEventListener("abort", () => reject(abortError()));
        }

        if (holdMode) gates.set(url, finish);
        else finish();
    });
};

// Loaded after the stubs exist.
import {
    MAX_CACHE_BYTES,
    MAX_CACHE_ENTRIES,
    acquire,
    cacheEntries,
    cacheStats,
    clear,
    load,
    peek,
    __resetForTests,
} from "../src/interactionAssetCache";

// ── helpers ────────────────────────────────────────────────────────────────

const MB = 1024 * 1024;

const reset = () => {
    __resetForTests();
    fetchLog = [];
    gates = new Map();
    revokeCounts = new Map();
    holdMode = false;
    ignoreAbort = false;
    nextSize = 1024;
};

const releaseGate = (url: string, opts?: FinishOptions) => {
    const gate = gates.get(url);
    assert.ok(gate, `no in-flight download for ${url}`);
    gate!(opts);
    gates.delete(url);
};

const urlFor = (n: number) => `https://cdn.test/video-${n}.mp4`;

/** Loads one asset of a given size and waits for it to settle. */
const loadSized = async (n: number, bytes: number) => {
    nextSize = bytes;
    await load(urlFor(n));
    nextSize = 1024;
};

/** Acquires one asset of a given size and waits for its blob. */
const acquireSized = async (n: number, bytes: number) => {
    nextSize = bytes;
    const lease = acquire(urlFor(n));
    await lease.promise;
    nextSize = 1024;
    return lease;
};

/** Fills to exactly MAX_CACHE_ENTRIES with tiny assets — no byte pressure. */
const fillToEntryCapacity = async () => {
    for (let i = 0; i < MAX_CACHE_ENTRIES; i++) await load(urlFor(i));
    assert.equal(cacheStats().entries, MAX_CACHE_ENTRIES);
};

// ── one download per url ───────────────────────────────────────────────────

test("concurrent requests for the same url produce exactly one fetch", async () => {
    reset();
    holdMode = true;

    const a = load(urlFor(1));
    const b = load(urlFor(1));
    const c = acquire(urlFor(1));

    assert.equal(fetchLog.length, 1, "three callers must share one network request");

    releaseGate(urlFor(1));
    await Promise.all([a, b, c.promise]);

    assert.equal(await c.promise, peek(urlFor(1)), "the lease holder gets the live blob URL");
    c.release();
});

test("a ready hit reuses the same blob URL and issues no new fetch", async () => {
    reset();
    await load(urlFor(1));
    const first = peek(urlFor(1));
    assert.equal(fetchLog.length, 1);

    await load(urlFor(1));
    assert.equal(peek(urlFor(1)), first, "same blob URL on the second request");
    assert.equal(fetchLog.length, 1, "a hit must not touch the network");
    assert.equal(cacheStats().hit, 1);
});

// ── failures ───────────────────────────────────────────────────────────────

test("HTTP failures are not cached and can be retried", async () => {
    reset();
    holdMode = true;

    const attempt = load(urlFor(1));
    releaseGate(urlFor(1), { ok: false, status: 403 });
    await assert.rejects(attempt, /HTTP 403/);

    assert.equal(peek(urlFor(1)), null, "a 403 body must never be stored as the asset");
    assert.equal(cacheStats().entries, 0, "failed entries are removed, not retained");

    holdMode = false;
    await load(urlFor(1));
    assert.ok(peek(urlFor(1))?.startsWith("blob:"), "retry produces a real blob");
    assert.equal(fetchLog.length, 2, "the retry is a genuine second request");
});

// ── entry-count eviction ───────────────────────────────────────────────────

test(`entry ${MAX_CACHE_ENTRIES + 1} triggers count eviction while bytes are far below budget`, async () => {
    reset();
    await fillToEntryCapacity();
    assert.ok(cacheStats().bytes < MAX_CACHE_BYTES, "precondition: byte budget is not the constraint");

    await load(urlFor(MAX_CACHE_ENTRIES));

    assert.equal(cacheStats().entries, MAX_CACHE_ENTRIES, "count budget is enforced on its own");
    assert.equal(peek(urlFor(0)), null, "the oldest entry is the one evicted");
    assert.equal(cacheStats().evicted, 1);
});

test("cache hits update recency, so the untouched entry is evicted first", async () => {
    reset();
    await fillToEntryCapacity();

    await load(urlFor(0));                       // touch the oldest
    await load(urlFor(MAX_CACHE_ENTRIES));       // force one eviction

    assert.ok(peek(urlFor(0)), "the re-used entry must survive");
    assert.equal(peek(urlFor(1)), null, "the genuinely least-recently-used entry is evicted");
});

test("peek does not bump recency and does not start a download", async () => {
    reset();
    assert.equal(peek(urlFor(99)), null);
    assert.equal(fetchLog.length, 0, "peek must never hit the network");

    await fillToEntryCapacity();
    peek(urlFor(0));                             // must NOT protect entry 0
    await load(urlFor(MAX_CACHE_ENTRIES));

    assert.equal(peek(urlFor(0)), null, "peek is a probe, not a use");
});

// ── byte-budget eviction ───────────────────────────────────────────────────

test("exactly MAX_CACHE_BYTES is within budget and evicts nothing", async () => {
    reset();
    for (let i = 0; i < 8; i++) await loadSized(i, 16 * MB);   // 8 × 16MiB = 128MiB

    assert.equal(cacheStats().bytes, MAX_CACHE_BYTES, "precondition: sitting exactly on the ceiling");
    assert.equal(cacheStats().evicted, 0, "the limit is inclusive — at budget is not over budget");
    assert.equal(cacheStats().entries, 8);
});

test("exceeding the byte budget evicts as many old entries as it takes", async () => {
    reset();
    for (let i = 0; i < 8; i++) await loadSized(i, 16 * MB);   // exactly at budget
    await loadSized(8, 48 * MB);                               // 176MiB — 48MiB over

    assert.ok(cacheStats().bytes <= MAX_CACHE_BYTES, "back under the ceiling");
    assert.equal(cacheStats().evicted, 3, "three 16MiB entries freed to fit 48MiB");
    assert.equal(peek(urlFor(0)), null);
    assert.equal(peek(urlFor(1)), null);
    assert.equal(peek(urlFor(2)), null);
    assert.ok(peek(urlFor(3)), "eviction stops as soon as the budget is satisfied");
    assert.ok(peek(urlFor(8)), "the newly completed asset is kept when older ones can pay for it");
});

test("byte accounting stays correct across eviction and clear", async () => {
    reset();
    for (let i = 0; i < 4; i++) await loadSized(i, 16 * MB);
    assert.equal(cacheStats().bytes, 64 * MB);

    await loadSized(4, 80 * MB);                               // 144MiB — 16MiB over
    assert.equal(cacheStats().bytes, 128 * MB, "one 16MiB eviction lands exactly on budget");

    clear();
    assert.equal(cacheStats().bytes, 0, "clear zeroes the byte total");
    assert.equal(cacheStats().entries, 0);
});

// ── active protection ──────────────────────────────────────────────────────

test("mounted entries are skipped by eviction, unused ones go instead", async () => {
    reset();
    await fillToEntryCapacity();
    const lease = acquire(urlFor(0));            // oldest, but mounted
    await lease.promise;

    await load(urlFor(MAX_CACHE_ENTRIES));

    assert.ok(peek(urlFor(0)), "an actively mounted entry is never evicted");
    assert.equal(peek(urlFor(1)), null, "the oldest UNUSED entry goes instead");
    lease.release();
});

test("when every entry is mounted, an unmounted lookahead is dropped rather than overflowing", async () => {
    reset();
    await fillToEntryCapacity();

    const leases = [];
    for (let i = 0; i < MAX_CACHE_ENTRIES; i++) {
        const lease = acquire(urlFor(i));
        await lease.promise;
        leases.push(lease);
    }

    await load(urlFor(MAX_CACHE_ENTRIES));       // warm-only, nothing else can be freed

    assert.equal(cacheStats().entries, MAX_CACHE_ENTRIES, "the budget is held, not exceeded");
    assert.equal(peek(urlFor(MAX_CACHE_ENTRIES)), null, "the unmounted newcomer loses to mounted media");
    for (let i = 0; i < MAX_CACHE_ENTRIES; i++) assert.ok(peek(urlFor(i)), "nothing mounted was disturbed");

    leases.forEach((l) => l.release());
});

test("deferred overflow is trimmed when a lease releases", async () => {
    reset();
    await fillToEntryCapacity();

    const leases = [];
    for (let i = 0; i < MAX_CACHE_ENTRIES; i++) {
        const lease = acquire(urlFor(i));
        await lease.promise;
        leases.push(lease);
    }

    // The newcomer is MOUNTED too, so it cannot be dropped either — the only
    // remaining option is to sit over budget until something is released.
    const newcomer = acquire(urlFor(MAX_CACHE_ENTRIES));
    await newcomer.promise;

    assert.equal(cacheStats().entries, MAX_CACHE_ENTRIES + 1, "temporarily over budget by design");
    assert.equal(cacheStats().evicted, 0, "nothing was revoked out from under a mounted element");
    assert.ok(cacheStats().evictDeferred > 0, "the overflow is reported, not silent");

    leases[0].release();
    assert.equal(cacheStats().entries, MAX_CACHE_ENTRIES, "eviction resumes on release");

    leases.slice(1).forEach((l) => l.release());
    newcomer.release();
});

test("an oversized ACTIVE asset is allowed temporarily and revoked after its final release", async () => {
    reset();
    const lease = await acquireSized(1, 200 * MB);             // alone exceeds the ceiling
    const blobUrl = peek(urlFor(1));

    assert.ok(blobUrl, "a mounted element still gets its source, budget or not");
    assert.ok(cacheStats().bytes > MAX_CACHE_BYTES, "the overflow is real and reported");
    assert.ok(cacheStats().evictDeferred > 0);

    lease.release();

    assert.equal(peek(urlFor(1)), null, "reclaimed the moment nothing is using it");
    assert.equal(cacheStats().bytes, 0);
    assert.equal(revokeCounts.get(blobUrl!), 1);
});

test("an oversized LOOKAHEAD asset is dropped rather than retained in RAM", async () => {
    reset();
    const leases = [];
    for (let i = 0; i < 8; i++) leases.push(await acquireSized(i, 16 * MB));  // 128MiB, all mounted

    await loadSized(99, 16 * MB);                              // warm-only, cannot fit

    assert.equal(peek(urlFor(99)), null, "unmounted lookahead loses to mounted media");
    assert.equal(cacheStats().bytes, MAX_CACHE_BYTES, "budget restored, mounted assets untouched");
    for (let i = 0; i < 8; i++) assert.ok(peek(urlFor(i)), "nothing mounted was disturbed");

    leases.forEach((l) => l.release());
});

test("pending downloads are never evicted", async () => {
    reset();
    await fillToEntryCapacity();

    holdMode = true;
    const pending = load(urlFor(MAX_CACHE_ENTRIES + 1));       // in flight, pushes count over

    assert.ok(gates.has(urlFor(MAX_CACHE_ENTRIES + 1)), "the in-flight request still exists");

    holdMode = false;
    await load(urlFor(MAX_CACHE_ENTRIES + 2));                 // completes, forcing an eviction pass

    assert.ok(gates.has(urlFor(MAX_CACHE_ENTRIES + 1)), "the pending download survived that pass");

    releaseGate(urlFor(MAX_CACHE_ENTRIES + 1));
    await pending;
    assert.ok(peek(urlFor(MAX_CACHE_ENTRIES + 1)), "it completed normally rather than being dropped mid-flight");
});

test("release is idempotent", async () => {
    reset();
    const lease = acquire(urlFor(1));
    await lease.promise;

    lease.release();
    lease.release();
    lease.release();

    const second = acquire(urlFor(1));
    await second.promise;
    for (let i = 2; i < MAX_CACHE_ENTRIES + 3; i++) await load(urlFor(i));

    assert.ok(peek(urlFor(1)), "the entry is still protected by its one live lease");
    second.release();
});

// ── clear ──────────────────────────────────────────────────────────────────

test("clear aborts pending requests", async () => {
    reset();
    holdMode = true;

    const pending = load(urlFor(1));
    assert.equal(cacheStats().entries, 1);

    clear();

    await assert.rejects(pending, (err: any) => err.name === "AbortError" || /clear/.test(String(err)));
    assert.equal(cacheStats().entries, 0);
});

test("a late completion cannot repopulate a cleared cache or leak an object URL", async () => {
    reset();
    holdMode = true;
    ignoreAbort = true;                          // fetch already past the abort point

    const pending = load(urlFor(1));
    const urlsBefore = objectUrlSeq;

    clear();
    releaseGate(urlFor(1));                      // completes AFTER the clear

    await assert.rejects(pending, /cleared/);

    assert.equal(peek(urlFor(1)), null, "the cleared cache must not be repopulated");
    assert.equal(cacheStats().entries, 0);
    assert.equal(objectUrlSeq, urlsBefore, "no object URL is created for a stale completion");
});

test("clear defers revocation of a blob still assigned to a mounted element", async () => {
    reset();
    const lease = acquire(urlFor(1));
    const blobUrl = await lease.promise;

    clear();

    assert.equal(revokeCounts.get(blobUrl), 0, "a mounted element must not lose its source");
    lease.release();
    assert.equal(revokeCounts.get(blobUrl), 1, "revoked on final release instead");
});

test("after clear, a tombstoned asset serves its existing element but is invisible to new lookups", async () => {
    reset();
    const mounted = acquire(urlFor(1));
    const oldBlob = await mounted.promise;
    assert.equal(fetchLog.length, 1);

    clear();

    // The element already playing it keeps a working source...
    assert.equal(revokeCounts.get(oldBlob), 0, "the mounted element must not lose its source");
    assert.equal(cacheStats().tombstoned, 1);
    assert.ok(cacheStats().bytes > 0, "a tombstone still occupies memory and is still counted");

    // ...but nobody else can find it. A clear means "this data is invalid".
    assert.equal(peek(urlFor(1)), null, "peek must not surface an invalidated blob");

    const fresh = acquire(urlFor(1));
    const newBlob = await fresh.promise;

    assert.equal(fetchLog.length, 2, "a new caller downloads a fresh copy");
    assert.notEqual(newBlob, oldBlob, "and gets its own blob, not the tombstone");
    assert.equal(peek(urlFor(1)), newBlob, "the fresh entry is the discoverable one");

    // Both lifetimes end cleanly and independently.
    mounted.release();
    assert.equal(revokeCounts.get(oldBlob), 1, "the tombstone is freed on its final release");
    assert.equal(cacheStats().tombstoned, 0, "and stops being byte-accounted");
    assert.equal(revokeCounts.get(newBlob), 0, "the replacement is unaffected");

    fresh.release();
    assert.equal(revokeCounts.get(oldBlob), 1, "revoked exactly once");
    assert.equal(revokeCounts.get(newBlob), 0, "still cached and reusable");
});

test("a re-acquired tombstone cannot pin memory forever", async () => {
    reset();
    const mounted = await acquireSized(1, 40 * MB);
    clear();

    // Re-request the same url: this must NOT resurrect the tombstone, because a
    // tombstone is skipped by eviction and would otherwise be unreclaimable.
    const fresh = await acquireSized(1, 40 * MB);

    assert.equal(cacheStats().tombstoned, 1);
    assert.equal(cacheStats().entries, 1);
    assert.equal(cacheStats().bytes, 80 * MB, "both copies are paid for while both are live");

    mounted.release();
    assert.equal(cacheStats().tombstoned, 0, "the tombstone is reclaimable and reclaimed");
    assert.equal(cacheStats().bytes, 40 * MB);

    fresh.release();
});

test("clear revokes unused entries immediately", async () => {
    reset();
    await load(urlFor(1));
    const blobUrl = peek(urlFor(1))!;
    assert.equal(revokeCounts.get(blobUrl), 0);

    clear();
    assert.equal(revokeCounts.get(blobUrl), 1);
    assert.equal(cacheStats().entries, 0);
});

// ── revocation accounting ──────────────────────────────────────────────────

test("every object URL is revoked exactly once across eviction, clear and release", async () => {
    reset();

    const issued: string[] = [];
    for (let i = 0; i < MAX_CACHE_ENTRIES + 5; i++) {
        await load(urlFor(i));
        issued.push(peek(urlFor(i))!);
    }
    // Force byte-driven eviction too, so both paths are exercised.
    await loadSized(500, 100 * MB);
    issued.push(peek(urlFor(500))!);

    const lease = acquire(urlFor(500));
    await lease.promise;

    clear();
    lease.release();

    for (const blobUrl of issued) {
        assert.equal(
            revokeCounts.get(blobUrl), 1,
            `${blobUrl} must be revoked exactly once (was ${revokeCounts.get(blobUrl)})`,
        );
    }
});

// ── StrictMode shape ───────────────────────────────────────────────────────

test("a StrictMode-style double acquire/release leaves the entry usable and unleaked", async () => {
    reset();

    const first = acquire(urlFor(1));
    first.release();
    const second = acquire(urlFor(1));

    assert.equal(fetchLog.length, 1, "the remount joins the existing entry, no second download");

    const blobUrl = await second.promise;
    assert.equal(peek(urlFor(1)), blobUrl, "the entry survives the double invoke");

    second.release();
    assert.equal(cacheStats().entries, 1, "still cached and evictable, not leaked");
});

test("diagnostics report both budgets", async () => {
    reset();
    await loadSized(1, 2 * MB);
    await loadSized(2, 3 * MB);

    const stats = cacheStats();
    assert.equal(stats.entries, 2);
    assert.equal(stats.bytes, 5 * MB, "byte telemetry drives the post-Topaz decision");
    assert.equal(stats.max, MAX_CACHE_ENTRIES);
    assert.equal(stats.maxBytes, MAX_CACHE_BYTES);
    assert.equal(cacheEntries().length, 2);
});
