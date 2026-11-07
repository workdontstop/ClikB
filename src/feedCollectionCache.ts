/** Route re-entry memory. Browser HTTP caching alone cannot restore a POST feed. */
type Collection<T> = { feeds: T[]; hasMore: boolean; fetchCount: number };
const collections = new Map<string, { value: Collection<any>; savedAt: number }>();
const deletedPostIds = new Set<number>();
const MAX_COLLECTIONS = 16;
const MAX_AGE_MS = 5 * 60_000;
const pendingRequests = new Map<string, Promise<unknown>>();

export function isDeletedFeedPost(postId: unknown): boolean {
  const id = Number(postId);
  return Number.isSafeInteger(id) && id > 0 && deletedPostIds.has(id);
}

export function evictFeedPost(postId: unknown): void {
  const id = Number(postId);
  if (!Number.isSafeInteger(id) || id <= 0) return;
  deletedPostIds.add(id);
  for (const [scope, entry] of collections) {
    const feeds = Array.isArray(entry.value?.feeds)
      ? entry.value.feeds.filter((item: any) => Number(item?.id) !== id)
      : entry.value?.feeds;
    if (Array.isArray(feeds) && feeds.length !== entry.value.feeds.length) {
      if (feeds.length > 0) collections.set(scope, { ...entry, value: { ...entry.value, feeds } });
      else collections.delete(scope);
    }
  }
}

/** StrictMode/remounts may ask twice before the first request has settled. */
export function requestFeedCollection<T>(scope: string, request: () => Promise<T>): Promise<T> {
  const pending = pendingRequests.get(scope);
  if (pending) return pending as Promise<T>;
  const promise = request();
  pendingRequests.set(scope, promise);
  const release = () => { if (pendingRequests.get(scope) === promise) pendingRequests.delete(scope); };
  promise.then(release, release);
  return promise;
}

export function rememberFeedCollection<T>(scope: string, value: Collection<T>): void {
  const filteredFeeds = Array.isArray(value.feeds) && deletedPostIds.size > 0
    ? value.feeds.filter((item: any) => !isDeletedFeedPost(item?.id))
    : value.feeds;
  const nextValue = filteredFeeds === value.feeds ? value : { ...value, feeds: filteredFeeds };
  const previous = collections.get(scope);
  // Restoring the same array is a read, not a fresh server response.
  const unchanged = previous?.value.feeds === nextValue.feeds && previous.value.hasMore === nextValue.hasMore
    && previous.value.fetchCount === nextValue.fetchCount;
  collections.delete(scope);
  collections.set(scope, { value: nextValue, savedAt: unchanged ? previous.savedAt : Date.now() });
  if (collections.size > MAX_COLLECTIONS) collections.delete(collections.keys().next().value!);
}

export function cachedFeedCollection<T>(scope: string, options: { allowStale?: boolean } = {}): Collection<T> | undefined {
  const saved = collections.get(scope);
  if (!saved) return;
  // Expiration requires a refresh, not removal of usable cards while it runs.
  // The existing size bound still limits retained collections.
  if (!options.allowStale && Date.now() - saved.savedAt > MAX_AGE_MS) return;
  collections.delete(scope);
  collections.set(scope, saved);
  return saved.value;
}
