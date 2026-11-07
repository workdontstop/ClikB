import { creationValueRevision } from '../server/src/creationControlIdentity';
/** Only the latest automatic observation may speak once user playback releases ownership. */
export class AutomaticSpeechQueue {
  private pending: { text: string; current: () => boolean; epoch: number } | null = null;
  private epoch = 0;
  private draining = false;
  offer(text: string, current: () => boolean) { this.pending = { text, current, epoch: this.epoch }; }
  cancel() { this.epoch++; this.pending = null; }
  async flush(speak: (text: string, current: () => boolean) => Promise<boolean>) {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.pending) {
        const item = this.pending;
        const current = () => item.epoch === this.epoch && this.pending === item && item.current();
        if (!current()) { if (this.pending === item) this.pending = null; continue; }
        const accepted = await speak(item.text, current);
        if (this.pending === item) {
          if (accepted || !current()) this.pending = null;
          else break; // Playback/input owns the channel; its completion retries the queue.
        }
      }
    } finally { this.draining = false; }
  }
}
export const CONCIERGE_ACKNOWLEDGMENT_MS = 1000;
export class AnnouncementLedger {
  private entries = new Map<string, 'pending' | 'emitted'>();
  begin(key: string): boolean { if (this.entries.has(key)) return false; this.entries.set(key,'pending'); return true; }
  finish(key: string, emitted: boolean) { if (emitted) this.entries.set(key,'emitted'); else this.entries.delete(key);
    if (this.entries.size > 128) for (const [old, status] of this.entries) { if (status === 'emitted') { this.entries.delete(old); break; } } }
  clear() { this.entries.clear(); }
}
export function announcementKey(snapshot: any, family: string, result?: string): string {
 const creation=snapshot?.creation || {};
 return creationValueRevision([creation.projectId || snapshot?.route, creation.editStoryTargetKey || creation.selectedReferenceId,
   family === 'creation-progress' ? 'creation-milestone' : family, creation.stage, creation.status,
   creation.previewSceneCount, creation.previewImageCount, creation.hdImageCount, creation.videoCount, creation.mediaRevision,
   creation.referenceEditEvidence, creation.referenceDraftPrompt, creation.referenceAiInstruction,
   creation.editStoryCurrentImagePrompt, creation.editStoryCurrentVideoPrompt, creation.editStoryMotionDraftPrompt,
   family === 'creation-progress' ? undefined : result]);
}
/** Identity deduplication accepts repeated words in distinct legitimate chunks. */
export function acceptConciergeDelta(seen: Set<string>, event: {eventId?: unknown}): boolean {
 if (typeof event.eventId !== 'string') return true;
 if (seen.has(event.eventId)) return false;
 seen.add(event.eventId); return true;
}
/** Keep factual action feedback even if a background stream ends before narration. */
export function interruptedConciergeFeedback(raw: string, actionLabel: string | null, automatic: boolean): string | null {
    if (automatic && !raw.trim() && !actionLabel) return null;
    const notice = actionLabel
        ? `I requested ${actionLabel.toLowerCase()}. The connection was interrupted; its outcome still needs checking before any retry.`
        : 'That response was interrupted. Any requested app changes remain; I’ll check the current state before continuing.';
    return `${raw.trim() ? raw + ' ' : ''}${notice}`;
}
