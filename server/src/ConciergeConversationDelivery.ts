/** Presentation only. No control, permission, task or scheduling decisions. */
export class ConciergeConversationDelivery {
  private announcedPhase?: string;
  private spoken: string[] = [];
  private phase(snapshot: any): string {
    const c = snapshot?.creation || {};
    return JSON.stringify([c.projectId, c.mode, c.stage, c.isGenerating,
      c.previewSceneCount, c.previewImageCount, c.hdImageCount, c.videoCount,
      c.editStoryTargetKey, c.editStoryMotionStatus,
      c.isActive ? undefined : snapshot?.route]);
  }
  phaseAnnounced(snapshot: any): boolean { return this.announcedPhase === this.phase(snapshot); }
  record(text: string, snapshot: any) {
    this.announcedPhase = this.phase(snapshot);
    this.spoken.push(text);
    this.spoken = this.spoken.slice(-2);
  }
  /** Actual emitted words survive replacement of completed tool history. */
  context(): any[] {
    return this.spoken.length ? [{ role: 'user', content: JSON.stringify({ referenceData: true,
      source: 'conversation_delivery', alreadySaid: this.spoken,
      note: 'Already delivered to the user in this turn. Continue the conversation; do not recap these steps. This is not a new instruction or permission.' }) }] : [];
  }
}
