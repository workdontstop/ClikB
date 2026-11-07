export type ConciergeMilestoneKind =
  | 'scene_preview_ready'
  | 'scene_hd_ready'
  | 'scene_hd_updated'
  | 'scene_video_ready'
  | 'scene_video_updated'
  | 'character_images_ready'
  | 'generation_all_settled'
  | 'generation_failed'
  | 'manual_navigation'
  | 'creation_stage_transition';

export type ConciergeMilestoneStatus = 'pending' | 'in_flight' | 'acknowledged';

export interface ConciergeMilestoneEvent {
  id: string;
  kind: ConciergeMilestoneKind;
  status: ConciergeMilestoneStatus;
  detectedAt: number;
  commentaryWorthy: boolean;
  projectId: string | null;
  slotKey?: string;
  targetKey?: string;
  sceneNumber?: number;
  bShotNumber?: number | null;
  cinemaStage?: string;
  role?: string;
  intendedBrief?: string;
  mediaKind?: string;
  version?: string | null;
  attemptId?: string;
  failureId?: string;
  errorMessage?: string;
  fromRoute?: string | null;
  toRoute?: string | null;
  surfaceLabel?: string | null;
  stage?: string | null;
  failureCount?: number;
  retryNotBefore?: number;
  summary: string;
}

export interface ConciergeMilestoneBatch {
  batchId: string;
  events: ConciergeMilestoneEvent[];
  interruptedPrefixes: string[];
  createdAt: number;
}

export interface ConciergePacingInput {
  voiceOutputOrInputBusy: boolean;
  streaming: boolean;
  chatOpen?: boolean;
  guideEnabled?: boolean;
  automaticEnabled?: boolean;
  autoControlEnabled?: boolean;
  activeTaskDrivingUi?: boolean;
}

export interface ConciergeBatchResolution {
  deliveredText: string;
  speechStarted?: boolean;
  completedCleanly: boolean;
  suppressedNoUpdate?: boolean;
  failed?: boolean;
  now?: number;
}

interface TrackedSlotState {
  hasPreviewImage: boolean;
  hasHdImage: boolean;
  hasVideo: boolean;
  previewVersion: string | null;
  hdVersion: string | null;
  videoVersion: string | null;
}

const ORDINAL_WORDS: Record<number, string[]> = {
  1: ['one', 'first'],
  2: ['two', 'second'],
  3: ['three', 'third'],
  4: ['four', 'fourth'],
  5: ['five', 'fifth'],
  6: ['six', 'sixth'],
  7: ['seven', 'seventh'],
  8: ['eight', 'eighth'],
  9: ['nine', 'ninth'],
  10: ['ten', 'tenth'],
  11: ['eleven', 'eleventh'],
  12: ['twelve', 'twelfth'],
};

export const CONCIERGE_SETTLE_MS = 300;
export const CONCIERGE_MAX_BATCH_WAIT_MS = 900;
export const CONCIERGE_MID_RUN_COOLDOWN_MS = 8000;
export const CONCIERGE_NAVIGATION_COOLDOWN_MS = 2500;
export const CONCIERGE_RETRY_BACKOFF_MS = [2000, 5000, 12000] as const;
export const CONCIERGE_MAX_RETRY_ATTEMPTS = 3;

function slotDisplayLabel(sceneNumber?: number, bShotNumber?: number | null): string {
  if (typeof sceneNumber === 'number' && sceneNumber > 0) {
    if (typeof bShotNumber === 'number' && bShotNumber > 0) {
      return `Scene ${sceneNumber} B-shot ${bShotNumber}`;
    }
    return `Scene ${sceneNumber}`;
  }
  return 'Creation media';
}

function inferSurfaceLabel(snapshot: any): string {
  const route = String(snapshot?.navigation?.route || snapshot?.route || '').trim();
  const deckState = snapshot?.feeds?.areas?.['clikb.feeds.deck']?.state;
  const activeDeck = String(
    deckState?.activeCategory || deckState?.selectedMode || deckState?.activeTab || deckState?.mode || '',
  ).trim();
  if (activeDeck) return activeDeck;
  if (/game|interact/i.test(route)) return 'Interactions';
  if (/short/i.test(route)) return 'Shorts';
  if (/cinema|movie|film/i.test(route)) return 'Cinema';
  if (/character|world/i.test(route)) return 'Characters';
  if (/setting/i.test(route)) return 'Settings';
  if (/profile/i.test(route)) return 'Profile';
  if (route === '/' || /feed|home/i.test(route)) return 'Feed';
  return route || 'app surface';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function mentionsSceneRangeContaining(text: string, sceneNumber: number): boolean {
  const rangePattern = /\b(?:scenes?|panels?|images?|shots?)\s*(\d+)\s*(?:-|–|—|to|through)\s*(\d+)\b/gi;
  for (const match of text.matchAll(rangePattern)) {
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (Number.isFinite(start) && Number.isFinite(end) && sceneNumber >= Math.min(start, end) && sceneNumber <= Math.max(start, end)) {
      return true;
    }
  }
  const listPattern = /\b(?:scenes?|panels?|images?|shots?)\s*((?:\d+\s*(?:,\s*|\s+and\s+|\s*&\s*))+(\d+))/gi;
  for (const match of text.matchAll(listPattern)) {
    const nums = (match[1].match(/\d+/g) || []).map(Number);
    if (nums.includes(sceneNumber)) return true;
  }
  return false;
}

function mentionsSpecificScene(text: string, sceneNumber?: number, bShotNumber?: number | null): boolean {
  if (typeof sceneNumber !== 'number' || sceneNumber <= 0) return false;
  const clean = text.toLowerCase();
  if (typeof bShotNumber === 'number' && bShotNumber > 0) {
    const hasScene = new RegExp(`\\bscene\\s*#?\\s*${sceneNumber}\\b`, 'i').test(clean);
    const bWords = ORDINAL_WORDS[bShotNumber] || [];
    const bToken = [String(bShotNumber), ...bWords.map(escapeRegExp)].join('|');
    const hasBShot = new RegExp(`\\b(?:b[-\\s]*shot|extra\\s+shot|shot)\\s*#?\\s*(?:${bToken})\\b`, 'i').test(clean);
    return hasScene && hasBShot;
  }

  if (mentionsSceneRangeContaining(clean, sceneNumber)) return true;

  const words = ORDINAL_WORDS[sceneNumber] || [];
  const numberTokens = [String(sceneNumber), ...words.map(escapeRegExp)].join('|');
  if (new RegExp(`\\b(?:scene|panel|image|shot|card)\\s*#?\\s*(?:${numberTokens})\\b`, 'i').test(clean)) {
    return true;
  }
  for (const word of words) {
    if (new RegExp(`\\b${escapeRegExp(word)}\\s+(?:scene|panel|image|shot|card)\\b`, 'i').test(clean)) {
      return true;
    }
  }
  return false;
}

function hasCollectiveCompletionStatement(text: string): boolean {
  const clean = text.trim();
  if (!clean) return false;
  const hasCollectiveNoun =
    /\b(?:all\s+(?:of\s+)?(?:the\s+|your\s+)?(?:\d+\s+|two\s+|three\s+|four\s+|five\s+|six\s+|seven\s+|eight\s+|nine\s+|ten\s+|twelve\s+)?(?:scenes?|images?|shots?|panels?|videos?|frames?)|every\s+(?:single\s+)?(?:scene|image|shot|panel|video))\b/i.test(clean)
    || /\b(?:scenes?|images?|shots?|panels?|videos?)\s+are\s+all\s+(?:ready|done|finished|complete|completed|updated|replaced|generated|in)\b/i.test(clean);
  const hasCompletionPredicate =
    /\b(?:ready|done|finished|complete|completed|updated|replaced|generated|landed|settled|good to go)\b/i.test(clean);
  return hasCollectiveNoun && hasCompletionPredicate;
}

export function isMilestoneCoveredByDeliveredText(
  event: ConciergeMilestoneEvent,
  deliveredText: string,
  batchEvents: ConciergeMilestoneEvent[],
): boolean {
  const clean = String(deliveredText || '').trim();
  if (!clean) return false;

  switch (event.kind) {
    case 'scene_preview_ready':
    case 'scene_hd_ready':
    case 'scene_hd_updated':
    case 'scene_video_ready':
    case 'scene_video_updated': {
      if (mentionsSpecificScene(clean, event.sceneNumber, event.bShotNumber)) {
        return true;
      }
      if (!event.bShotNumber && hasCollectiveCompletionStatement(clean)) {
        return true;
      }
      return false;
    }
    case 'generation_all_settled': {
      return hasCollectiveCompletionStatement(clean)
        || /\b(?:everything(?:'s|\s+is)\s+(?:ready|done|finished|complete)|generation\s+is\s+(?:complete|done|finished))\b/i.test(clean);
    }
    case 'generation_failed': {
      const mentionsError = /\b(?:fail|failed|failure|error|issue|couldn't|could not|unable|snag|problem)\b/i.test(clean);
      if (!mentionsError) return false;
      if (typeof event.sceneNumber === 'number' && event.sceneNumber > 0) {
        const failureEvents = batchEvents.filter((item) => item.kind === 'generation_failed');
        if (failureEvents.length === 1 && !/\bscene\s*\d+\b/i.test(clean)) return true;
        return mentionsSpecificScene(clean, event.sceneNumber, event.bShotNumber);
      }
      return true;
    }
    case 'character_images_ready': {
      return /\b(?:character|characters|portrait|portraits|reference|references|cast)\b/i.test(clean)
        && /\b(?:ready|done|finished|generated|complete|in)\b/i.test(clean);
    }
    case 'manual_navigation':
    case 'creation_stage_transition': {
      const label = String(event.surfaceLabel || event.stage || event.toRoute || '').trim();
      if (label && label.length >= 3) {
        const token = label.replace(/^\/+/, '').split(/[\/_\-\s]+/).filter((part) => part.length >= 3);
        if (token.some((part) => new RegExp(`\\b${escapeRegExp(part)}`, 'i').test(clean))) {
          return true;
        }
      }
      if (event.stage === 'characters' && /\b(?:character|cast|studio)\b/i.test(clean)) return true;
      if (event.stage === 'closed' && /\b(?:closed|left|back\s+to|stepped\s+out|browsing)\b/i.test(clean)) return true;
      return false;
    }
    default:
      return false;
  }
}

export class ConciergeEventQueue {
  private initialized = false;
  private sequence = 0;
  private batchSequence = 0;
  private events: ConciergeMilestoneEvent[] = [];
  private activeBatches = new Map<string, { eventIds: string[]; createdAt: number }>();
  private interruptedPrefixes: string[] = [];

  private currentProjectId: string | null = null;
  private hadRecentCreationActivity = false;
  private wasCreationActive = false;
  private wasMinimised = false;
  private wasGenerating = false;
  private lastCharacterBranchStage: string | null = null;
  private lastEditStoryOpen = false;
  private lastReferenceReadyCount = 0;
  private lastRoute: string | null = null;
  private lastSurfaceLabel: string | null = null;
  private lastTransitionSeq = 0;

  private slotStates = new Map<string, TrackedSlotState>();
  private seenFallbackChangeKeys = new Set<string>();
  private seenFailureIds = new Set<string>();

  private lastArrivalAt = 0;
  private lastCommentaryCompletedAt = 0;
  private lastNavigationCommentaryAt = 0;

  constructor(initialSnapshot?: any) {
    if (initialSnapshot !== undefined) {
      this.seedBaseline(initialSnapshot);
    }
  }

  public seedBaseline(snapshot: any): void {
    const creation = snapshot?.creation || {};
    this.currentProjectId = creation.projectId ? String(creation.projectId) : null;
    this.wasCreationActive = Boolean(creation.isActive);
    this.hadRecentCreationActivity = Boolean(
      creation.isActive
      || (Number(creation.previewImageCount) || 0) > 0
      || (Number(creation.hdImageCount) || 0) > 0
      || (Number(creation.videoCount) || 0) > 0,
    );
    this.wasMinimised = snapshot?.ui?.minimisePrompt === true;
    this.wasGenerating = this.isSnapshotGenerating(snapshot);
    this.lastCharacterBranchStage = creation.characterBranchStage ? String(creation.characterBranchStage) : null;
    this.lastEditStoryOpen = Boolean(creation.editStoryIsOpen);
    this.lastReferenceReadyCount = Number(creation.referenceImageReadyCount) || 0;
    this.lastRoute = snapshot?.navigation?.route || snapshot?.route || null;
    this.lastSurfaceLabel = inferSurfaceLabel(snapshot);

    const transitions = Array.isArray(snapshot?.navigation?.recentTransitions)
      ? snapshot.navigation.recentTransitions
      : [];
    this.lastTransitionSeq = transitions.reduce(
      (max: number, item: any) => Math.max(max, Number(item?.sequence) || 0),
      0,
    );

    this.slotStates.clear();
    if (Array.isArray(creation.sceneSlots)) {
      for (const slot of creation.sceneSlots) {
        if (!slot?.slotKey) continue;
        this.slotStates.set(this.scopedSlotKey(this.currentProjectId, slot.slotKey), {
          hasPreviewImage: Boolean(slot.hasPreviewImage),
          hasHdImage: Boolean(slot.hasHdImage),
          hasVideo: Boolean(slot.hasVideo),
          previewVersion: slot.previewVersion ? String(slot.previewVersion) : null,
          hdVersion: slot.hdVersion ? String(slot.hdVersion) : null,
          videoVersion: slot.videoVersion ? String(slot.videoVersion) : null,
        });
      }
    }

    this.seenFallbackChangeKeys.clear();
    if (Array.isArray(creation.recentMediaChanges)) {
      for (const change of creation.recentMediaChanges) {
        this.seenFallbackChangeKeys.add(this.fallbackChangeKey(this.currentProjectId, change));
      }
    }

    this.seenFailureIds.clear();
    if (creation.confirmedFailuresByTarget && typeof creation.confirmedFailuresByTarget === 'object') {
      for (const failure of Object.values<any>(creation.confirmedFailuresByTarget)) {
        if (failure?.failureId) this.seenFailureIds.add(String(failure.failureId));
      }
    }

    this.initialized = true;
  }

  public clear(): void {
    this.events = [];
    this.activeBatches.clear();
    this.interruptedPrefixes = [];
    this.slotStates.clear();
    this.seenFallbackChangeKeys.clear();
    this.seenFailureIds.clear();
    this.initialized = false;
  }

  private isSnapshotGenerating(snapshot: any): boolean {
    const creation = snapshot?.creation || {};
    return Boolean(
      creation.isGenerating
      || creation.editStoryMotionStatus === 'generating'
      || (creation.activeAttemptsByTarget && Object.keys(creation.activeAttemptsByTarget).length > 0),
    );
  }

  private scopedSlotKey(projectId: string | null, slotKey: string): string {
    return `${projectId || 'default'}:${slotKey}`;
  }

  private fallbackChangeKey(projectId: string | null, change: any): string {
    return `${projectId || 'default'}:${change?.kind || ''}:${change?.targetKey || ''}:${change?.version || change?.at || ''}`;
  }

  private nextEventId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${this.sequence}`;
  }

  private pushEvent(event: Omit<ConciergeMilestoneEvent, 'id' | 'status'>): ConciergeMilestoneEvent {
    const created: ConciergeMilestoneEvent = {
      ...event,
      id: this.nextEventId(event.kind),
      status: 'pending',
    };
    this.events.push(created);
    this.lastArrivalAt = created.detectedAt;
    if (this.events.length > 256) {
      this.events = this.events.filter((item, idx) => item.status !== 'acknowledged' || idx >= this.events.length - 128);
    }
    return created;
  }

  public observe(snapshot: any, now: number = Date.now()): ConciergeMilestoneEvent[] {
    if (!this.initialized) {
      this.seedBaseline(snapshot);
      return [];
    }

    const added: ConciergeMilestoneEvent[] = [];
    const creation = snapshot?.creation || {};
    const projectId = creation.projectId ? String(creation.projectId) : null;
    const isGenerating = this.isSnapshotGenerating(snapshot);

    if (projectId !== this.currentProjectId) {
      this.currentProjectId = projectId;
      this.lastReferenceReadyCount = 0;
      // Start a new project's mid-run cooldown fresh so the first milestone is prompt.
      this.lastCommentaryCompletedAt = 0;
    }

    if (
      creation.isActive
      || isGenerating
      || (Number(creation.previewImageCount) || 0) > 0
      || (Number(creation.hdImageCount) || 0) > 0
      || (Number(creation.videoCount) || 0) > 0
    ) {
      this.hadRecentCreationActivity = true;
    }

    // 1. Per-slot media readiness & revision reconciliation (>8 burst safe)
    if (Array.isArray(creation.sceneSlots)) {
      for (const slot of creation.sceneSlots) {
        if (!slot?.slotKey) continue;
        const mapKey = this.scopedSlotKey(projectId, String(slot.slotKey));
        const prev: TrackedSlotState = this.slotStates.get(mapKey) || {
          hasPreviewImage: false,
          hasHdImage: false,
          hasVideo: false,
          previewVersion: null,
          hdVersion: null,
          videoVersion: null,
        };
        const next: TrackedSlotState = {
          hasPreviewImage: Boolean(slot.hasPreviewImage),
          hasHdImage: Boolean(slot.hasHdImage),
          hasVideo: Boolean(slot.hasVideo),
          previewVersion: slot.previewVersion ? String(slot.previewVersion) : null,
          hdVersion: slot.hdVersion ? String(slot.hdVersion) : null,
          videoVersion: slot.videoVersion ? String(slot.videoVersion) : null,
        };
        const sceneNumber = Number(slot.sceneNumber) || undefined;
        const bShotNumber = slot.bShotNumber != null ? Number(slot.bShotNumber) : null;
        const cinemaStage = typeof slot.cinemaStage === 'string' && slot.cinemaStage.trim() ? slot.cinemaStage.trim() : undefined;
        const role = typeof slot.role === 'string' && slot.role.trim() ? slot.role.trim() : undefined;
        const intendedBrief = typeof slot.brief === 'string' && slot.brief.trim()
          ? slot.brief.replace(/\s+/g, ' ').trim().slice(0, 220)
          : undefined;
        const slotMeta = {
          ...(cinemaStage ? { cinemaStage } : {}),
          ...(role ? { role } : {}),
          ...(intendedBrief ? { intendedBrief } : {}),
        };
        const label = slotDisplayLabel(sceneNumber, bShotNumber);

        if (!prev.hasPreviewImage && next.hasPreviewImage && !next.hasHdImage) {
          added.push(this.pushEvent({
            kind: 'scene_preview_ready',
            detectedAt: now,
            commentaryWorthy: true,
            projectId,
            slotKey: String(slot.slotKey),
            targetKey: String(slot.slotKey),
            sceneNumber,
            bShotNumber,
            ...slotMeta,
            mediaKind: 'preview_image',
            version: next.previewVersion,
            summary: `${label} preview image is ready.`,
          }));
        }

        if (!prev.hasHdImage && next.hasHdImage) {
          // Coalesce unspoken preview event for this exact slot when HD arrives before speech.
          this.events = this.events.filter(
            (existing) => !(
              existing.status === 'pending'
              && existing.kind === 'scene_preview_ready'
              && existing.projectId === projectId
              && existing.slotKey === String(slot.slotKey)
            ),
          );
          added.push(this.pushEvent({
            kind: 'scene_hd_ready',
            detectedAt: now,
            commentaryWorthy: true,
            projectId,
            slotKey: String(slot.slotKey),
            targetKey: String(slot.slotKey),
            sceneNumber,
            bShotNumber,
            ...slotMeta,
            mediaKind: 'hd_image',
            version: next.hdVersion,
            summary: `${label} image is ready.`,
          }));
        } else if (
          prev.hasHdImage
          && next.hasHdImage
          && next.hdVersion
          && prev.hdVersion
          && next.hdVersion !== prev.hdVersion
        ) {
          // Coalesce any unspoken earlier update on the same slot to the newest version.
          this.events = this.events.filter(
            (existing) => !(
              existing.status === 'pending'
              && existing.kind === 'scene_hd_updated'
              && existing.projectId === projectId
              && existing.slotKey === String(slot.slotKey)
            ),
          );
          added.push(this.pushEvent({
            kind: 'scene_hd_updated',
            detectedAt: now,
            commentaryWorthy: true,
            projectId,
            slotKey: String(slot.slotKey),
            targetKey: String(slot.slotKey),
            sceneNumber,
            bShotNumber,
            ...slotMeta,
            mediaKind: 'hd_image',
            version: next.hdVersion,
            summary: `${label} image was updated with a new render.`,
          }));
        }

        if (!prev.hasVideo && next.hasVideo) {
          added.push(this.pushEvent({
            kind: 'scene_video_ready',
            detectedAt: now,
            commentaryWorthy: true,
            projectId,
            slotKey: String(slot.slotKey),
            targetKey: String(slot.slotKey),
            sceneNumber,
            bShotNumber,
            ...slotMeta,
            mediaKind: 'video',
            version: next.videoVersion,
            summary: `${label} video is ready.`,
          }));
        } else if (
          prev.hasVideo
          && next.hasVideo
          && next.videoVersion
          && prev.videoVersion
          && next.videoVersion !== prev.videoVersion
        ) {
          this.events = this.events.filter(
            (existing) => !(
              existing.status === 'pending'
              && existing.kind === 'scene_video_updated'
              && existing.projectId === projectId
              && existing.slotKey === String(slot.slotKey)
            ),
          );
          added.push(this.pushEvent({
            kind: 'scene_video_updated',
            detectedAt: now,
            commentaryWorthy: true,
            projectId,
            slotKey: String(slot.slotKey),
            targetKey: String(slot.slotKey),
            sceneNumber,
            bShotNumber,
            ...slotMeta,
            mediaKind: 'video',
            version: next.videoVersion,
            summary: `${label} video was updated.`,
          }));
        }

        this.slotStates.set(mapKey, next);
      }
    } else if (Array.isArray(creation.recentMediaChanges)) {
      // Fallback when sceneSlots is not populated on synthetic snapshots
      for (const change of creation.recentMediaChanges) {
        const key = this.fallbackChangeKey(projectId, change);
        if (this.seenFallbackChangeKeys.has(key)) continue;
        this.seenFallbackChangeKeys.add(key);
        const sceneMatch = String(change?.targetKey || '').match(/scene:(\d+)/);
        const bShotMatch = String(change?.targetKey || '').match(/bshot:(\d+)/);
        const sceneNumber = sceneMatch ? Number(sceneMatch[1]) : undefined;
        const bShotNumber = bShotMatch ? Number(bShotMatch[1]) : null;
        const label = slotDisplayLabel(sceneNumber, bShotNumber);
        const isVideo = /video/i.test(String(change?.kind || ''));
        const isPreview = /preview/i.test(String(change?.kind || ''));
        added.push(this.pushEvent({
          kind: isVideo ? 'scene_video_ready' : isPreview ? 'scene_preview_ready' : 'scene_hd_ready',
          detectedAt: now,
          commentaryWorthy: true,
          projectId,
          slotKey: change?.targetKey ? String(change.targetKey) : undefined,
          targetKey: change?.targetKey ? String(change.targetKey) : undefined,
          sceneNumber,
          bShotNumber,
          mediaKind: String(change?.kind || 'media'),
          summary: `${label} ${isVideo ? 'video' : isPreview ? 'preview' : 'image'} is ready.`,
        }));
      }
    }

    // 2. Character portrait readiness
    const refReady = Number(creation.referenceImageReadyCount) || 0;
    if (refReady > this.lastReferenceReadyCount) {
      const delta = refReady - this.lastReferenceReadyCount;
      const missing = Number(creation.referenceImageMissingCount) || 0;
      this.events = this.events.filter(
        (existing) => !(existing.status === 'pending' && existing.kind === 'character_images_ready' && existing.projectId === projectId),
      );
      added.push(this.pushEvent({
        kind: 'character_images_ready',
        detectedAt: now,
        commentaryWorthy: true,
        projectId,
        mediaKind: 'character_image',
        summary: missing === 0
          ? `Character reference images are ready (${refReady} ready).`
          : `${delta} new character reference ${delta === 1 ? 'image is' : 'images are'} ready (${refReady} ready, ${missing} still generating).`,
      }));
    }
    this.lastReferenceReadyCount = refReady;

    // 3. Attempt-owned confirmed failures (never stale global error strings)
    if (creation.confirmedFailuresByTarget && typeof creation.confirmedFailuresByTarget === 'object') {
      for (const failure of Object.values<any>(creation.confirmedFailuresByTarget)) {
        if (!failure?.failureId || !failure?.attemptId) continue;
        const failureId = String(failure.failureId);
        if (this.seenFailureIds.has(failureId)) continue;
        this.seenFailureIds.add(failureId);
        const sceneNumber = typeof failure.sceneNumber === 'number' ? failure.sceneNumber : undefined;
        const bShotNumber = failure.bShotNumber != null ? Number(failure.bShotNumber) : null;
        const label = slotDisplayLabel(sceneNumber, bShotNumber);
        added.push(this.pushEvent({
          kind: 'generation_failed',
          detectedAt: now,
          commentaryWorthy: true,
          projectId: failure.projectId ? String(failure.projectId) : projectId,
          slotKey: failure.targetKey ? String(failure.targetKey) : undefined,
          targetKey: failure.targetKey ? String(failure.targetKey) : undefined,
          sceneNumber,
          bShotNumber,
          mediaKind: failure.mediaKind ? String(failure.mediaKind) : undefined,
          attemptId: String(failure.attemptId),
          failureId,
          errorMessage: String(failure.message || 'Generation failed'),
          summary: `${label} (${failure.mediaKind || 'generation'}) failed on attempt ${failure.attemptId}: ${failure.message || 'error'}.`,
        }));
      }
    }

    // 4. Generation settled transition (true -> false)
    if (this.wasGenerating && !isGenerating) {
      const hasPendingSlotMilestone = this.events.some(
        (item) => item.status === 'pending' && (
          item.kind === 'scene_hd_ready'
          || item.kind === 'scene_hd_updated'
          || item.kind === 'scene_video_ready'
          || item.kind === 'scene_video_updated'
          || item.kind === 'character_images_ready'
          || item.kind === 'generation_failed'
        ),
      );
      if (!hasPendingSlotMilestone && ((Number(creation.hdImageCount) || 0) > 0 || (Number(creation.videoCount) || 0) > 0)) {
        added.push(this.pushEvent({
          kind: 'generation_all_settled',
          detectedAt: now,
          commentaryWorthy: true,
          projectId,
          summary: 'Active generation finished settling.',
        }));
      }
    }
    this.wasGenerating = isGenerating;

    // 5. Post-task & background-aware Creation stage transitions (observation never authorizes mutations)
    const charStage = creation.characterBranchStage ? String(creation.characterBranchStage) : null;
    if (charStage && charStage !== 'none' && charStage !== this.lastCharacterBranchStage) {
      if (charStage === 'characters' || charStage === 'review') {
        this.events = this.events.filter(
          (existing) => !(existing.status === 'pending' && existing.kind === 'creation_stage_transition'),
        );
        added.push(this.pushEvent({
          kind: 'creation_stage_transition',
          detectedAt: now,
          commentaryWorthy: this.hadRecentCreationActivity || isGenerating,
          projectId,
          stage: 'characters',
          surfaceLabel: 'Character Studio',
          summary: isGenerating
            ? 'User opened Character Studio while creation generation is still running.'
            : 'User opened Character Studio after recent creation work.',
        }));
      }
    }
    this.lastCharacterBranchStage = charStage;

    const editStoryOpen = Boolean(creation.editStoryIsOpen);
    if (!this.lastEditStoryOpen && editStoryOpen) {
      const editScene = Number(creation.editStoryCurrentSceneNumber) || undefined;
      added.push(this.pushEvent({
        kind: 'creation_stage_transition',
        detectedAt: now,
        // Passive observation unless background work is running; user opening scene editor is kept in context.
        commentaryWorthy: isGenerating,
        projectId,
        sceneNumber: editScene,
        stage: 'edit_story',
        surfaceLabel: editScene ? `Edit Story (Scene ${editScene})` : 'Edit Story',
        summary: editScene
          ? `User opened Edit Story for Scene ${editScene}.`
          : 'User opened Edit Story.',
      }));
    }
    this.lastEditStoryOpen = editStoryOpen;

    const isCreationActive = Boolean(creation.isActive);
    const isMinimised = snapshot?.ui?.minimisePrompt === true;
    const surfaceLabel = inferSurfaceLabel(snapshot);
    if ((this.wasCreationActive && !isCreationActive) || (!this.wasMinimised && isMinimised && isCreationActive)) {
      this.events = this.events.filter(
        (existing) => !(existing.status === 'pending' && existing.kind === 'creation_stage_transition' && existing.stage === 'closed'),
      );
      added.push(this.pushEvent({
        kind: 'creation_stage_transition',
        detectedAt: now,
        commentaryWorthy: isGenerating || (this.hadRecentCreationActivity && now - this.lastNavigationCommentaryAt >= CONCIERGE_NAVIGATION_COOLDOWN_MS),
        projectId,
        stage: 'closed',
        surfaceLabel,
        summary: !isCreationActive
          ? `User closed Creation and is now on ${surfaceLabel}.`
          : `User minimised Creation to browse ${surfaceLabel}${isGenerating ? ' while generation continues in the background' : ''}.`,
      }));
    }
    this.wasCreationActive = isCreationActive;
    this.wasMinimised = isMinimised;

    // 6. Manual navigation transitions (independent of Auto Control or active task)
    const transitions = Array.isArray(snapshot?.navigation?.recentTransitions)
      ? snapshot.navigation.recentTransitions
      : [];
    const currentRoute = snapshot?.navigation?.route || snapshot?.route || null;

    let manualMoved = false;
    let manualFromRoute = this.lastRoute;
    let manualToRoute = currentRoute;

    for (const transition of transitions) {
      const seq = Number(transition?.sequence) || 0;
      if (seq <= this.lastTransitionSeq) continue;
      this.lastTransitionSeq = seq;
      if (transition?.actor === 'manual' && transition?.outcome !== 'failed') {
        manualMoved = true;
        manualFromRoute = transition?.before?.route || manualFromRoute;
        manualToRoute = transition?.after?.route || manualToRoute;
      }
    }

    if (
      !manualMoved
      && currentRoute !== this.lastRoute
      && currentRoute
      && this.lastRoute
    ) {
      const latestTransition = transitions[transitions.length - 1];
      if (!latestTransition || latestTransition.actor !== 'ai') {
        manualMoved = true;
        manualFromRoute = this.lastRoute;
        manualToRoute = currentRoute;
      }
    }

    if (
      !manualMoved
      && surfaceLabel !== this.lastSurfaceLabel
      && /^(?:Shorts|Cinema|Interactions|Games|Characters)$/i.test(surfaceLabel)
    ) {
      const latestTransition = transitions[transitions.length - 1];
      if (!latestTransition || latestTransition.actor !== 'ai') {
        manualMoved = true;
      }
    }

    if (manualMoved) {
      // Coalesce rapid manual hops so only the user's current destination remains pending.
      this.events = this.events.filter(
        (existing) => !(existing.status === 'pending' && existing.kind === 'manual_navigation'),
      );
      const majorSurface = /^(?:Shorts|Cinema|Interactions|Games|Characters)$/i.test(surfaceLabel)
        || manualFromRoute !== manualToRoute;
      const commentaryUseful =
        (isGenerating || (this.hadRecentCreationActivity && majorSurface))
        && (now - this.lastNavigationCommentaryAt >= CONCIERGE_NAVIGATION_COOLDOWN_MS);
      added.push(this.pushEvent({
        kind: 'manual_navigation',
        detectedAt: now,
        commentaryWorthy: commentaryUseful,
        projectId,
        fromRoute: manualFromRoute,
        toRoute: manualToRoute,
        surfaceLabel,
        summary: isGenerating
          ? `User manually navigated to ${surfaceLabel} (${manualToRoute || 'current view'}) while creation generation continues in the background.`
          : `User manually navigated to ${surfaceLabel} (${manualToRoute || 'current view'})${this.hadRecentCreationActivity ? ' after creation activity' : ''}.`,
      }));
    }

    this.lastRoute = currentRoute;
    this.lastSurfaceLabel = surfaceLabel;
    return added;
  }

  public getPendingEvents(): ConciergeMilestoneEvent[] {
    return this.events.filter((item) => item.status === 'pending').map((item) => ({ ...item }));
  }

  public hasPendingCommentary(): boolean {
    return this.events.some((item) => item.status === 'pending' && item.commentaryWorthy);
  }

  public takeDueBatch(now: number, pacing: ConciergePacingInput): ConciergeMilestoneBatch | null {
    if (
      this.activeBatches.size > 0
      || pacing.voiceOutputOrInputBusy
      || pacing.streaming
      || pacing.chatOpen
      || pacing.guideEnabled === false
      || pacing.automaticEnabled === false
      || pacing.autoControlEnabled === false
      || pacing.activeTaskDrivingUi
    ) {
      return null;
    }

    const commentaryEvents = this.events.filter(
      (item) => item.status === 'pending'
        && item.commentaryWorthy
        && (item.kind !== 'manual_navigation' || now - item.detectedAt <= CONCIERGE_NAVIGATION_COOLDOWN_MS * 4)
        && (item.retryNotBefore === undefined || now >= item.retryNotBefore),
    );
    if (!commentaryEvents.length) return null;

    const earliestAt = commentaryEvents.reduce((min, item) => Math.min(min, item.detectedAt), commentaryEvents[0].detectedAt);
    const settledBurst = now - this.lastArrivalAt >= CONCIERGE_SETTLE_MS || now - earliestAt >= CONCIERGE_MAX_BATCH_WAIT_MS;
    if (!settledBurst) return null;

    const hasUrgentEvent = commentaryEvents.some((item) => (
      item.kind === 'generation_failed'
      || item.kind === 'generation_all_settled'
      || item.kind === 'creation_stage_transition'
    ));

    if (
      this.wasGenerating
      && !hasUrgentEvent
      && this.lastCommentaryCompletedAt > 0
      && now - this.lastCommentaryCompletedAt < CONCIERGE_MID_RUN_COOLDOWN_MS
    ) {
      return null;
    }

    // Include any passive awareness events alongside the due commentary batch so context stays unified.
    const batchCandidates = this.events.filter(
      (item) => item.status === 'pending' && (item.retryNotBefore === undefined || now >= item.retryNotBefore),
    );
    const batchId = `milestone-batch-${++this.batchSequence}`;
    for (const item of batchCandidates) {
      item.status = 'in_flight';
    }
    this.activeBatches.set(batchId, {
      eventIds: batchCandidates.map((item) => item.id),
      createdAt: now,
    });

    return {
      batchId,
      events: batchCandidates.map((item) => ({ ...item })),
      interruptedPrefixes: [...this.interruptedPrefixes],
      createdAt: now,
    };
  }

  /**
   * Attaches pending milestone awareness to a direct user turn so the companion
   * naturally knows what finished or changed without firing a redundant post-turn blurt (REC 74 -> 75).
   */
  public takeForUserTurn(now: number = Date.now()): ConciergeMilestoneBatch | null {
    const pending = this.events.filter((item) => item.status === 'pending');
    if (!pending.length) return null;
    const batchId = `user-turn-batch-${++this.batchSequence}`;
    for (const item of pending) {
      item.status = 'in_flight';
    }
    this.activeBatches.set(batchId, {
      eventIds: pending.map((item) => item.id),
      createdAt: now,
    });
    return {
      batchId,
      events: pending.map((item) => ({ ...item })),
      interruptedPrefixes: [...this.interruptedPrefixes],
      createdAt: now,
    };
  }

  public resolveBatch(batchId: string, resolution: ConciergeBatchResolution): {
    acknowledgedIds: string[];
    requeuedIds: string[];
  } {
    const batch = this.activeBatches.get(batchId);
    if (!batch) return { acknowledgedIds: [], requeuedIds: [] };
    this.activeBatches.delete(batchId);

    const now = resolution.now ?? Date.now();
    const batchEvents = this.events.filter((item) => batch.eventIds.includes(item.id));
    const acknowledgedIds: string[] = [];
    const requeuedIds: string[] = [];

    if (resolution.completedCleanly || resolution.suppressedNoUpdate) {
      for (const item of batchEvents) {
        item.status = 'acknowledged';
        acknowledgedIds.push(item.id);
        if (item.kind === 'manual_navigation' || item.kind === 'creation_stage_transition') {
          this.lastNavigationCommentaryAt = now;
        }
      }
      this.interruptedPrefixes = [];
      this.lastCommentaryCompletedAt = now;
      return { acknowledgedIds, requeuedIds };
    }

    const delivered = String(resolution.deliveredText || '').trim();
    if (!delivered) {
      for (const item of batchEvents) {
        if (resolution.failed) {
          const nextFailures = (item.failureCount ?? 0) + 1;
          item.failureCount = nextFailures;
          if (nextFailures >= CONCIERGE_MAX_RETRY_ATTEMPTS) {
            item.status = 'acknowledged';
            acknowledgedIds.push(item.id);
          } else {
            const delay = CONCIERGE_RETRY_BACKOFF_MS[Math.min(nextFailures - 1, CONCIERGE_RETRY_BACKOFF_MS.length - 1)];
            item.retryNotBefore = now + delay;
            item.status = 'pending';
            requeuedIds.push(item.id);
          }
        } else {
          item.status = 'pending';
          requeuedIds.push(item.id);
        }
      }
      return { acknowledgedIds, requeuedIds };
    }

    // Interrupted mid-stream or mid-playback: retire ONLY events actually covered by deliveredText.
    this.interruptedPrefixes = [...this.interruptedPrefixes.slice(-3), delivered.slice(0, 240)];
    for (const item of batchEvents) {
      if (isMilestoneCoveredByDeliveredText(item, delivered, batchEvents)) {
        item.status = 'acknowledged';
        acknowledgedIds.push(item.id);
        if (item.kind === 'manual_navigation' || item.kind === 'creation_stage_transition') {
          this.lastNavigationCommentaryAt = now;
        }
      } else {
        item.status = 'pending';
        requeuedIds.push(item.id);
      }
    }
    return { acknowledgedIds, requeuedIds };
  }
}

export function buildMilestoneObservationPrompt(batch: ConciergeMilestoneBatch): string {
  const lines = [
    '[Companion milestone observation — read-only, no app actions]',
    'Share a brief, natural companion reaction or check-in for the unhandled app events below only if genuinely helpful; if silence is better, reply [NO_UPDATE].',
    'Never treat user silence or manual navigation as authorization to change or cancel a plan, and only report failures explicitly listed below.',
  ];
  const slotCompletions = batch.events.filter((event) => (
    event.kind === 'scene_preview_ready'
    || event.kind === 'scene_hd_ready'
    || event.kind === 'scene_hd_updated'
    || event.kind === 'scene_video_ready'
    || event.kind === 'scene_video_updated'
  ));
  const briefHighlights = slotCompletions
    .filter((event) => Boolean(event.intendedBrief))
    .slice(0, 2)
    .map((event) => `${slotDisplayLabel(event.sceneNumber, event.bShotNumber)}: "${event.intendedBrief}"`);
  if (briefHighlights.length > 0) {
    const additionalCount = Math.max(0, slotCompletions.length - briefHighlights.length);
    lines.push(
      `Intended prompt briefs (from scene prompt text, NOT visual inspection of rendered pixels): ${briefHighlights.join('; ')}${additionalCount > 0 ? ` (+${additionalCount} additional completed ${additionalCount === 1 ? 'slot' : 'slots'} in this batch — summarize naturally instead of listing every slot)` : ''}.`,
    );
  }
  if (batch.interruptedPrefixes.length > 0) {
    const latestPrefix = batch.interruptedPrefixes[batch.interruptedPrefixes.length - 1];
    lines.push(
      `Earlier commentary was interrupted after "${latestPrefix}" — do NOT repeat that phrase verbatim; pick up naturally with only the remaining unhandled events.`,
    );
  }
  return lines.join(' ');
}
