import type { DraftController } from './store';

/** Bounded development evidence; contains identities/revisions, never prompts or media. */
export function observeCreationDraft(controller: DraftController, enabled: boolean): () => void {
  if (!enabled || typeof window === 'undefined') return () => {};
  const host = window as any;
  const events: unknown[] = host.__clikbCreationDraftLog || (host.__clikbCreationDraftLog = []);
  const record = () => {
    const value = controller.getState();
    const event = { time: new Date().toISOString(), creationId: controller.creationProjectId,
      postId: value.postId, revision: value.revision, localVersion: value.version,
      hydrating: value.hydrating, saved: value.saved, saving: value.isSaving, pending: value.pending,
      closed: value.closed, conflict: value.conflicted, error: Boolean(value.error || value.localError) };
    events.push(event);
    if (events.length > 250) events.splice(0, events.length - 250);
    console.debug('[CreationDraft]', JSON.stringify(event));
  };
  record();
  return controller.subscribe(record);
}
