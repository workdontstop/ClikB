/** Read-only current-project context supplied by its mounted owner while cloud sync is pending. */
export function readPendingCreationMemory(snapshot: any, projectId: string, canonicalIds: string[]) {
  if (snapshot?.conciergeMemorySyncPending !== true || !projectId || !Array.isArray(snapshot?.creationMemoryFallback)) return [];
  const prefix = `project:${projectId}:`;
  let remaining = 18000;
  return snapshot.creationMemoryFallback.slice(0, 4).flatMap((card: any) => {
    const key = typeof card?.cardKey === 'string' ? card.cardKey : '';
    const relevant = canonicalIds.some(id => key === id || key.startsWith(`${id}:part:`));
    if (!key.startsWith(prefix) || !relevant || typeof card?.text !== 'string' || !card.text.trim() || remaining <= 0) return [];
    const text = card.text.slice(0, Math.min(12000, remaining));
    remaining -= text.length;
    return [{ id: `pending:${key}`, canonicalId: key, title: String(card.title || key).slice(0, 160),
      text, status: 'current_local_pending_sync', ...(card.sceneNumber ? { sceneNumber: String(card.sceneNumber) } : {}) }];
  });
}
