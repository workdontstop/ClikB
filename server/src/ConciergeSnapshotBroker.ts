import { createHash } from 'node:crypto';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value) ?? 'null').digest('hex').slice(0, 20);
const escape = (s: string) => s.replace(/~/g, '~0').replace(/\//g, '~1');
const content = /prompt|blueprint|narration|canon|instruction|draft|originalRequest|synopsis|caption|description|sceneText|planText|reference.*text/i;
const metadata = /(?:Length|Count|Revision|Ready|Status|Mode|Model|Busy|Open|Available|Selected|Active|Field|Key|Id|Number|Index|Role|Error|Reason|Permission|Enabled|Duration|Resolution|Armed|Supports|Locked|Axis|Forward|Backward|Limit)$/;
const volatile = /^(?:timestamp|updatedAt|observedAt|settledAt|stateVersion|stateRevision|elapsedMs|audioLevel|offsetBucketPx|progressPercent|progressPercentage|currentTime|currentSecond|duration|durationSeconds|progress|playbackProgress|audioTime|scrollTop|scrollLeft|sceneScrollLeft|captionScrollTop|gpuTimeSeconds|gpuStartupSeconds|gpuElapsedSeconds)$/;
const safeFeedStateKey = /(?:Hint|Title|Username)$/;
const safeState = (state: any, allowFeedHints = false) => Object.fromEntries(Object.entries(state || {}).filter(([key, value]) =>
  !volatile.test(key) && (!content.test(key) || metadata.test(key) || (allowFeedHints && safeFeedStateKey.test(key))) &&
  (value === null || typeof value === 'boolean' || typeof value === 'number' || (typeof value === 'string' && value.length <= 200))))
  ;

export type ConciergeSurfaceMode =
  | 'modal_foreground'
  | 'layered_composer_over_page'
  | 'creation_workstation'
  | 'browsing_page';

export type ConciergeAreaLayer = 'modal' | 'floating_overlay' | 'foreground' | 'backdrop' | 'shell';

export function conciergeSurfaceLayers(snapshot: any): {
  mode: ConciergeSurfaceMode;
  areaIds: string[];
  areaLayers: Record<string, ConciergeAreaLayer>;
  groups: Record<string, any>;
} {
  const navAreas = snapshot?.navigation?.areas || {};
  const feedAreas = snapshot?.feeds?.areas || {};
  const creationAreas = snapshot?.creation?.controls?.areas || {};
  const groups: Record<string, any> = {
    ...navAreas, ...feedAreas, ...creationAreas,
  };
  const measured = snapshot?.conciergeFocus;
  const areaLayers: Record<string, ConciergeAreaLayer> = {};
  const creationHidden = snapshot?.ui?.minimisePrompt === true || snapshot?.creation?.isActive === false;
  const creationIds = creationHidden ? [] : Object.keys(creationAreas);
  const navIds = Object.keys(navAreas);
  const feedIds = (Array.isArray(snapshot?.feeds?.activeAreaIds)
    ? snapshot.feeds.activeAreaIds
    : Object.keys(feedAreas).filter((id: string) => !id.startsWith('clikb.feeds.context.')))
    .filter((id: string) => groups[id]);

  let mode: ConciergeSurfaceMode;
  let ids: string[];
  if (measured?.kind === 'modal' && Array.isArray(measured.areaIds)) {
    mode = 'modal_foreground';
    ids = measured.areaIds.filter((id: string) => groups[id]);
    for (const id of ids) areaLayers[id] = 'modal';
  } else if (groups['clikb.navigation.privacy_policy']) {
    mode = 'modal_foreground';
    ids = ['clikb.navigation.privacy_policy'];
    areaLayers['clikb.navigation.privacy_policy'] = 'modal';
  } else if (groups['clikb.settings']) {
    mode = 'browsing_page';
    for (const id of navIds) {
      areaLayers[id] = id === 'clikb.settings' ? 'foreground' : 'shell';
    }
    ids = [...navIds];
  } else if (navAreas['clikb.navigation.relationships']?.state?.listType) {
    mode = 'modal_foreground';
    ids = Object.keys(groups).filter(id => id.startsWith('clikb.navigation.relationship'));
    for (const id of ids) areaLayers[id] = 'modal';
  } else if (creationIds.length > 0) {
    if (creationIds.includes('clikb.creation.notepad')) {
      mode = 'creation_workstation';
      ids = creationIds.filter(id => /\.notepad$|\.assistant$/.test(id));
      for (const id of ids) areaLayers[id] = 'foreground';
    } else if (snapshot?.creation?.isInitialComposer === true || snapshot?.creation?.isCompactOverlay === true) {
      mode = 'layered_composer_over_page';
      for (const id of creationIds) areaLayers[id] = 'floating_overlay';
      for (const id of feedIds) areaLayers[id] = 'backdrop';
      for (const id of navIds) areaLayers[id] = 'shell';
      ids = [...creationIds, ...feedIds, ...navIds];
    } else {
      mode = 'creation_workstation';
      for (const id of creationIds) areaLayers[id] = 'foreground';
      const manuallyMinimised = snapshot?.creation?.minimizeMode === 1 || snapshot?.creation?.minimizeMode === 2;
      if (manuallyMinimised) {
        for (const id of navIds) areaLayers[id] = 'shell';
        ids = [...creationIds, ...navIds];
      } else {
        ids = [...creationIds];
      }
    }
  } else {
    mode = 'browsing_page';
    for (const id of navIds) areaLayers[id] = 'shell';
    for (const id of feedIds) areaLayers[id] = 'foreground';
    ids = [...navIds, ...feedIds];
  }

  ids = [...new Set(ids)].sort();
  return { mode, areaIds: ids, areaLayers, groups };
}

export function conciergeForeground(snapshot: any) {
  const layers = conciergeSurfaceLayers(snapshot);
  const { groups, areaIds: ids, mode, areaLayers } = layers;
  const measured = snapshot?.conciergeFocus;
  const c = snapshot?.creation || {};
  const identity = [snapshot?.route || snapshot?.navigation?.route, mode, ids, measured?.scopeId,
    ids.map(id => { const s = groups[id]?.state || {}; return [s.projectId, s.targetKey, s.field, s.fieldKey, s.guideContext, s.sceneNumber, s.activeField, s.referenceId, s.selectedReferenceId,
      id.startsWith('clikb.navigation.') ? [s.activeMemberId, s.viewedMemberId, s.tab, s.postId, s.roomId] : null]; }),
    ids.map(id => [...new Set((groups[id]?.controls || groups[id]?.visibleControls || []).map((control: any) => control.ownerId).filter(Boolean))].sort()),
    ids.some(id => id.startsWith('clikb.creation.')) ? [c.projectId, c.mode, c.stage, c.editStoryIsOpen,
      c.editStoryTab, c.editStoryNativeSceneIndex, c.editStoryParentSceneIndex, c.editStoryIsBShot, c.editStoryBShotIndex,
      c.editStoryTargetKey, c.editStorySceneId, c.editStoryShotId, c.editStorySceneIndex, c.selectedReferenceName, c.selectedReferenceId] : null];
  return { scopeRef: hash(identity), areaIds: ids, kind: measured?.kind || 'page', surfaceMode: mode, areaLayers, groups };
}

function compactControl(control: any) {
  const result: any = {};
  for (const key of ['actionId', 'candidateActionId', 'controlId', 'scrollId', 'label', 'kind', 'policy', 'aiPolicy', 'enabled',
    'selected', 'activation', 'inputType', 'minimum', 'maximum', 'step', 'axis', 'canScrollForward', 'canScrollBackward',
    'requiresConfirmation', 'targetId', 'ownerId', 'valueRevision', 'valueLength']) if (control[key] !== undefined) result[key] = control[key];
  if (result.kind === 'scroll') { result.scrollId ??= result.actionId; delete result.actionId; delete result.activation; }
  if (typeof result.label === 'string') result.label = result.label.slice(0, 160);
  if (control.description) result.description = String(control.description).slice(0, 180);
  if (control.disabledReason) result.disabledReason = String(control.disabledReason).slice(0, 240);
  return result;
}

function compactVisiblePost(post: any) {
  const postId = Number(post?.postId);
  if (!Number.isSafeInteger(postId) || postId <= 0) return null;
  const str = (v: unknown, max: number) => typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;
  const title = str(post?.metadata?.title ?? post?.title, 80);
  const creatorUsername = str(post?.creator?.username ?? post?.creatorUsername, 48);
  const captionHint = str(post?.metadata?.captionHint ?? post?.metadata?.legacyCaptionHint ?? post?.captionHint, 140);
  const promptHint = str(post?.metadata?.promptHint ?? post?.promptHint, 140);
  const overviewHint = str(post?.metadata?.overviewHint ?? post?.overviewHint, 140);
  const categories = Array.isArray(post?.metadata?.categories) ? post.metadata.categories.slice(0, 4).map((c: any) => str(c, 32)).filter(Boolean) : [];
  const tags = Array.isArray(post?.metadata?.tags) ? post.metadata.tags.slice(0, 4).map((t: any) => str(t, 32)).filter(Boolean) : [];
  return {
    postId,
    ...(typeof post?.contentKind === 'string' ? { contentKind: post.contentKind } : {}),
    ...(creatorUsername ? { creator: `@${creatorUsername.replace(/^@/, '')}` } : {}),
    ...(title ? { title } : {}),
    ...(captionHint ? { captionHint } : {}),
    ...(promptHint ? { promptHint } : {}),
    ...(overviewHint && overviewHint !== captionHint && overviewHint !== promptHint ? { overviewHint } : {}),
    ...(categories.length ? { categories } : {}),
    ...(tags.length ? { tags } : {}),
    ...(post?.capabilities && typeof post.capabilities === 'object' ? { capabilities: post.capabilities } : {}),
  };
}

/** Derive model data from existing sources. Never mutates the raw snapshot or a producer. */
export function conciergeVisibleView(snapshot: any) {
  const focus = conciergeForeground(snapshot);
  const areas: Record<string, any> = {};
  for (const id of focus.areaIds) {
    const area = focus.groups[id];
    const isFeedArea = id.startsWith('clikb.feeds.');
    const controls = (area.controls || area.visibleControls || []).map(compactControl);
    // Navigation/Feeds expose executable IDs separately from descriptive controls.
    for (const action of [...(snapshot?.navigation?.availableActions || []), ...(snapshot?.feeds?.availableActions || [])]) {
      if (action.actionId?.startsWith(`${id}.`) || controls.some((c: any) => c.controlId === action.controlId)) {
        const existing = controls.find((c: any) => c.controlId === action.controlId);
        if (existing) Object.assign(existing, compactControl(action)); else controls.push(compactControl(action));
      }
    }
    const modalIds = snapshot?.conciergeFocus?.kind === 'modal' && Array.isArray(snapshot.conciergeFocus.controlIds)
      ? new Set(snapshot.conciergeFocus.controlIds) : null;
    const visiblePosts = !modalIds && Array.isArray(area.visiblePosts)
      ? area.visiblePosts.slice(0, 6).map(compactVisiblePost).filter(Boolean) : [];
    const collectionPosts = !modalIds && id === 'clikb.feeds.deck' && snapshot?.autoControl?.enabled === true && Array.isArray(area.collectionPosts)
      ? area.collectionPosts.slice(0, 28).map(compactVisiblePost).filter(Boolean) : [];
    areas[id] = { ...(focus.surfaceMode === 'layered_composer_over_page' && focus.areaLayers[id] ? { layer: focus.areaLayers[id] } : {}),
      state: safeState(area.state, isFeedArea), controls: modalIds ? controls.filter((control: any) =>
      [control.actionId, control.candidateActionId, control.controlId, control.scrollId].some(value => modalIds.has(value))) : controls,
      ...(visiblePosts.length > 0 ? { visiblePosts } : {}),
      ...(collectionPosts.length > 0 ? { collectionPosts } : {}),
      ...(area.scrolls ? { scrolls: Object.fromEntries(Object.entries<any>(area.scrolls).filter(([key]) =>
        !modalIds || snapshot.conciergeFocus.scrollIds?.includes(`${id}:${key}`)).map(([key, value]) => [key,
        { ...safeState(value, isFeedArea), ...(Array.isArray(value.visibleIds) ? { visibleIds: value.visibleIds } : {}) }])) } : {}) };
  }
  const c = snapshot?.creation || {};
  const liveFields: any[] = [];
  for (const [index, field] of (snapshot?.conciergeFocus?.textFields || []).entries()) {
    if (field && typeof field.value === 'string' && focus.areaIds.includes(field.areaId)) liveFields.push({
      areaId: field.areaId, controlId: field.controlId, actionId: field.actionId,
      label: typeof field.label === 'string' ? field.label.slice(0, 160) : undefined, value: field.value,
      mode: field.mode === 'editing-draft' ? 'editing-draft' : 'displayed-submitted',
      readPointer: `/conciergeFocus/textFields/${index}/value` });
  }
  if (liveFields.length) { /* Prefer complete centrally measured current fields, including unsaved values. */ }
  else if (focus.areaIds.includes('clikb.creation.notepad')) {
    for (const [index, draft] of (c.visibleDrafts || []).entries()) {
      if (typeof draft.value === 'string') liveFields.push({ controlId: draft.controlId, label: draft.label,
        value: draft.value, mode: 'editing-draft', readPointer: `/creation/visibleDrafts/${index}/value` });
    }
  } else if (c.editStoryIsOpen && !focus.areaIds.includes('clikb.creation.workstation_precise')
      && focus.areaIds.some(id => id.startsWith('clikb.creation.workstation_'))) {
    const key = c.editStoryTab === 'video' ? 'editStoryCurrentVideoPrompt'
      : c.editStoryTab === 'narration' ? 'editStoryCurrentNarration' : 'editStoryCurrentImagePrompt';
    if (typeof c[key] === 'string') liveFields.push({ value: c[key], mode: 'displayed-submitted', readPointer: `/creation/${key}`,
      note: 'Display is not an editable binding. Use the registered control to open its editor before changing it.' });
  } else if (focus.areaIds.includes('clikb.creation.setup') && c.isInitialComposer === true && typeof snapshot?.app?.prompt === 'string') {
    liveFields.push({ value: snapshot.app.prompt, mode: 'editing-draft', readPointer: '/app/prompt' });
  }
  return { scopeRef: focus.scopeRef, kind: focus.kind, surfaceMode: focus.surfaceMode, areaIds: focus.areaIds,
    ...(focus.surfaceMode === 'layered_composer_over_page' ? { surfaceLayout: {
      mode: focus.surfaceMode,
      creationPanelVisible: snapshot?.ui?.minimisePrompt !== true,
      deckBackdropActive: Boolean(snapshot?.feeds?.areas?.['clikb.feeds.deck']?.state?.creationBackdrop),
      navigationSidebarOpen: Boolean(snapshot?.navigation?.areas?.['clikb.navigation.sidebar'] || snapshot?.navigation?.areas?.['clikb.navigation.menu']),
      areaLayers: focus.areaLayers,
    } } : {}),
    route: snapshot?.route || snapshot?.navigation?.route, permissions: {
      enabled: snapshot?.autoControl?.enabled, videoEnabled: snapshot?.autoControl?.videoEnabled,
      conciergeEnabled: snapshot?.autoControl?.conciergeEnabled,
      ...(typeof snapshot?.ui?.deckEnabled === 'boolean' ? { deckEnabled: snapshot.ui.deckEnabled } : {}),
      ...(typeof snapshot?.ui?.guideShortcuts === 'string' ? { guideShortcuts: snapshot.ui.guideShortcuts } : {}),
    }, location: { projectId: c.projectId, mode: c.mode, stage: c.stage, editorOpen: c.editStoryIsOpen,
      displayedSceneNumber: c.editStoryDisplaySceneNumber ?? c.editStoryCurrentSceneNumber, nativeSceneIndex: c.editStoryNativeSceneIndex,
      displayRole: c.editStoryDisplayRole, sceneDisplayRevision: c.sceneDisplayRevision,
      displaySceneCount: c.displaySceneCount,
      isBShot: c.editStoryIsBShot, parentSceneIndex: c.editStoryParentSceneIndex, bShotIndex: c.editStoryBShotIndex,
      memorySyncPending: snapshot?.conciergeMemorySyncPending === true },
    progress: { ...Object.fromEntries(Object.entries(c).filter(([key, value]) =>
      /^(?:status|isGenerating|promptCharacterCount|modeSelectionRequired|goBlockedReason|mediaRevision|previewSceneCount|previewImageCount|hdImageCount|videoCount|editStoryHasImage|editStoryHasVideo|editStoryHasNarration|editStoryMotionStatus|editStoryMotionVideoReady|editStoryMotionError|imageError|videoError|characterBranchStage|canCreateCharacters|canGenerateCharacterImages|referenceImageReadyCount|referenceImageMissingCount)$/.test(key)
      && (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string'))),
      ...(c.confirmedFailuresByTarget && Object.keys(c.confirmedFailuresByTarget).length > 0
        ? { confirmedFailures: Object.values(c.confirmedFailuresByTarget).slice(-8) } : {}),
      ...(String(c.mode).toLowerCase() === 'cinema' && Number.isSafeInteger(c.previewSceneCount)
        ? { logicalSceneCount: Math.ceil(c.previewSceneCount / 2), primaryShotCount: c.previewSceneCount,
          sceneCountMeaning: 'Cinema A/B primary slots; previews are not finished HD images. Supporting B-roll are separate.' } : {}) }, areas, liveFields };
}

type PromptRead = { revision: string; characters: number; source: 'foreground_text_supplied' };
type Basket = { at: number; ref: string; view: any; promptRead?: PromptRead };
export const conciergeSnapshotRevision = (snapshot: any): string => hash(conciergeVisibleView(snapshot));
const baskets = new Map<string, Basket>();
const MAX_BASKETS = 64;
const TTL = 20 * 60 * 1000;

function diff(before: any, after: any, path = ''): any[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (Array.isArray(before) && Array.isArray(after)) {
    const identity = (value: any) => value?.actionId || value?.candidateActionId || value?.controlId || value?.readPointer
      || (typeof value?.postId === 'number' ? `post:${value.postId}` : undefined);
    if ([...before, ...after].every(value => typeof identity(value) === 'string')) {
      const a = Object.fromEntries(before.map(value => [identity(value), value]));
      const b = Object.fromEntries(after.map(value => [identity(value), value]));
      return diff(a, b, `${path}/byId`);
    }
  }
  if (before && after && !Array.isArray(before) && !Array.isArray(after) && typeof before === 'object' && typeof after === 'object') {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key =>
      diff(before[key], after[key], `${path}/${escape(key)}`));
  }
  return [{ pointer: path || '/', ...(after === undefined ? { removed: true } : { value: after }) }];
}

export class ConciergeSnapshotBroker {
  private view: any;
  private base?: Basket;
  // Keep changes until an explicit read acknowledges them. Replacing the automatic
  // notice on a later provider call must not discard facts the model still needs.
  private acknowledged?: Basket;
  private fullReadRef?: string;
  private checkedScope?: string;
  private knownIds = new Set<string>();
  private rawPrompt = '';
  private promptRevision = '';
  private hasCompletePrompt = false;
  private promptRead?: PromptRead;
  constructor(private readonly ownerKey: string, snapshot: any) {
    const now = Date.now();
    for (const [key, entry] of baskets) if (now - entry.at > TTL) baskets.delete(key);
    this.base = baskets.get(ownerKey);
    this.promptRead = this.base?.promptRead;
    this.update(snapshot);
  }
  update(snapshot: any) {
    this.rawPrompt = typeof snapshot?.app?.prompt === 'string' ? snapshot.app.prompt : '';
    const promptLength = snapshot?.creation?.promptCharacterCount ?? snapshot?.app?.promptLength;
    this.hasCompletePrompt = typeof promptLength !== 'number' || promptLength === this.rawPrompt.length;
    this.promptRevision = hash([snapshot?.creation?.projectId, snapshot?.creation?.mode, this.rawPrompt]);
    if (!this.hasCompletePrompt || this.promptRead?.revision !== this.promptRevision) this.promptRead = undefined;
    const next = conciergeVisibleView(snapshot);
    if (this.view?.scopeRef !== next.scopeRef) { this.checkedScope = undefined; this.knownIds.clear(); }
    this.view = next;
  }
  private current(): Basket { return { at: Date.now(), ref: hash(this.view), view: this.view, promptRead: this.promptRead }; }
  private notePromptRead(full: boolean, pointer?: string) {
    if (!this.hasCompletePrompt || !this.rawPrompt.trim() || !this.view.areaIds.includes('clikb.creation.confirmation')) return;
    const supplied = this.view.liveFields.some((field: any) => field.mode === 'displayed-submitted'
      && (!pointer || field.readPointer === pointer) && (full || field.value.length <= 2000) && field.value.includes(this.rawPrompt));
    if (supplied) this.promptRead = { revision: this.promptRevision, characters: this.rawPrompt.length, source: 'foreground_text_supplied' };
  }
  get promptWasRead(): boolean { return this.promptRead?.revision === this.promptRevision; }
  get promptReadRevision(): string | undefined { return this.promptWasRead ? this.promptRead?.revision : undefined; }
  /** A retained receipt is a reading hint only; it grants no action authority.
   * Guest requests deliberately do not share private cross-request baskets. */
  restorePromptRead(revision: string) {
    if (this.hasCompletePrompt && this.rawPrompt.trim() && revision === this.promptRevision)
      this.promptRead = { revision, characters: this.rawPrompt.length, source: 'foreground_text_supplied' };
  }
  private save(current: Basket) {
    baskets.delete(this.ownerKey);
    // Bound private cache size; large live text remains available to this request's reads.
    if (JSON.stringify(current).length < 150000) baskets.set(this.ownerKey, current);
    while (baskets.size > MAX_BASKETS) baskets.delete(baskets.keys().next().value!);
  }
  automatic() {
    const current = this.current();
    const previous = this.acknowledged || this.base;
    const sameScope = previous?.view.scopeRef === current.view.scopeRef;
    let changes = sameScope ? diff(previous!.view, current.view) : [];
    const detailsChanged = changes.length > 30 || JSON.stringify(changes).length > 6000;
    if (detailsChanged) {
      changes = changes.filter(change => /^\/(progress|permissions|location)\//.test(change.pointer));
      this.checkedScope = undefined;
      this.knownIds.clear();
    }
    const notice = { scopeRef: this.view.scopeRef, snapshotRef: current.ref, baseRef: sameScope ? previous?.ref : null,
      kind: this.view.kind, surfaceMode: this.view.surfaceMode,
      ...(this.view.surfaceLayout ? { surfaceLayout: this.view.surfaceLayout } : {}),
      route: this.view.route, areaIds: this.view.areaIds, permissions: this.view.permissions,
      location: this.view.location, scopeChanged: !sameScope, unchanged: sameScope && !changes.length && !detailsChanged,
      ...(this.promptWasRead ? { promptRead: this.promptRead } : {}),
      changes, detailsChanged, ...(!sameScope ? { progress: this.view.progress, liveFields: this.view.liveFields.map((field: any) =>
        field.value.length <= 2000 ? field : { ...field, value: undefined, characters: field.value.length, deferred: true }) } : {}),
      readRequiredForDetails: this.checkedScope !== this.view.scopeRef,
      note: 'Only foreground changes are supplied. A previous-request reference is not unseen model memory. Read current controls/details with getCurrentSnapshot or queryLiveSnapshot when needed.' };
    this.save(current);
    return notice;
  }
  readSnapshot() {
    this.notePromptRead(true);
    const current = this.current();
    if (this.fullReadRef === current.ref && this.checkedScope === this.view.scopeRef) return {
      status: 'unchanged', kind: 'concierge_snapshot', scopeRef: this.view.scopeRef, snapshotRef: current.ref,
      detail: 'Full foreground data is already present in this request tool history; reuse that result.' };
    this.checkedScope = this.view.scopeRef;
    for (const [id, area] of Object.entries<any>(this.view.areas)) this.markRead(id, area);
    this.acknowledged = current;
    this.fullReadRef = current.ref;
    this.save(current);
    return { ...this.view, surfaceKind: this.view.kind, kind: 'concierge_snapshot', status: 'observed', snapshotRef: current.ref };
  }
  knows(id: string) {
    if (this.checkedScope !== this.view.scopeRef) return false;
    return this.knownIds.has(id);
  }
  hasForegroundControl(id: string): boolean {
    for (const [areaId, area] of Object.entries<any>(this.view.areas || {})) {
      for (const control of area.controls || []) {
        if ([control.actionId, control.candidateActionId, control.scrollId].includes(id)) return true;
      }
      for (const [key, scroll] of Object.entries<any>(area.scrolls || {})) {
        if ([`${areaId}:${key}`, scroll?.scrollId, scroll?.actionId].includes(id)) return true;
      }
    }
    return false;
  }
  acknowledgeForegroundControls(): void {
    this.knownIds.clear();
    for (const [id, area] of Object.entries<any>(this.view.areas || {})) this.markRead(id, area);
    this.acknowledged = this.current();
  }
  private markRead(areaId: string, area: any) {
    this.checkedScope = this.view.scopeRef;
    for (const control of area.controls || []) for (const id of [control.actionId, control.candidateActionId, control.scrollId]) {
      if (typeof id === 'string') this.knownIds.add(id);
    }
    for (const [key, scroll] of Object.entries<any>(area.scrolls || {})) {
      for (const id of [`${areaId}:${key}`, scroll.scrollId, scroll.actionId]) if (typeof id === 'string') this.knownIds.add(id);
    }
  }
  get scopeRef(): string { return this.view.scopeRef; }
  get revision(): string { return this.current().ref; }
  /** Supplying controls with a decision counts as observing them; a second
   * model call is unnecessary. This does not grant execution permission. */
  decisionContext(includeControls: boolean) {
    if (includeControls) this.notePromptRead(false);
    const notice = this.automatic();
    // A cross-request reference is not model memory. Reports and direct questions
    // have no reason to re-read a control catalogue, but still need today's facts.
    // Keep native readiness/counts explicit even when no fields changed.
    if (!includeControls) {
      const visiblePostsByArea = Object.fromEntries(
        Object.entries<any>(this.view.areas)
          .filter(([, area]) => Array.isArray(area.visiblePosts) && area.visiblePosts.length > 0)
          .map(([id, area]) => [id, area.visiblePosts]),
      );
      return { ...notice, progress: this.view.progress,
        outcomes: Object.fromEntries(Object.entries<any>(this.view.areas).map(([id, area]) => [id,
          Object.fromEntries(Object.entries(area.state || {}).filter(([key]) =>
            /ready|remaining|count|generat|loading|status|error|complete|pending|slideshow|view|stage|centered|meshShield|safetyVideo|safetyAudio|referenceVideo/i.test(key))) ])),
        ...(Object.keys(visiblePostsByArea).length > 0 ? { visiblePostsByArea } : {}),
        note: `${notice.note} Current progress and native outcome counts are included even when unchanged; missing image pixels does not mean missing completed media.` };
    }
    this.knownIds.clear();
    for (const [id, area] of Object.entries<any>(this.view.areas)) this.markRead(id, area);
    this.acknowledged = this.current();
    return { ...notice, changes: notice.changes.filter(change => !/^\/(?:areas|liveFields)(?:\/|$)/.test(change.pointer)),
      progress: this.view.progress, areas: this.view.areas,
      liveFields: this.view.liveFields.map((field: any) => field.value.length <= 2000 ? field
        : { ...field, value: undefined, characters: field.value.length, deferred: true }),
      readRequiredForDetails: false,
      note: 'These foreground controls were supplied for this decision. Use exact IDs; full text is available via its readPointer. Fresh Jev/browser checks still apply.' };
  }
  correction(id: string) {
    const control = Object.values<any>(this.view.areas).flatMap(area => area.controls || [])
      .find(control => control.actionId === id || control.candidateActionId === id || control.scrollId === id);
    return control ? { scopeRef: this.view.scopeRef, control, requiresNewApproval: true }
      : { scopeRef: this.view.scopeRef, suggestedActionId: id, status: 'outside_current_foreground', requiresFreshObservation: true };
  }
  readFields(fields: any[]) {
    return fields.map(field => {
      const p = field.pointer;
      if (p === '/autoControl' || p.startsWith('/autoControl/') || p === '/route' || p === '/pageName') return field;
      if (this.view.liveFields.some((live: any) => live.readPointer === p)) {
        if (field.status === 'found') { this.notePromptRead(true, p); this.save(this.current()); }
        return field;
      }
      const key = p.split('/').at(-1) || '';
      if (!p.startsWith('/feeds/') && content.test(key) && !metadata.test(key)) return { pointer: p, status: 'retrieval_required', tool: 'searchCreationMemory' };
      const activeArea = this.view.areaIds.find((id: string) => [
        `/creation/controls/areas/${escape(id)}`, `/navigation/areas/${escape(id)}`, `/feeds/areas/${escape(id)}`,
      ].some(prefix => p === prefix || p.startsWith(prefix + '/')));
      if (activeArea) {
        const area = this.view.areas[activeArea];
        if (/\/(?:controls|visibleControls)$/.test(p)) { this.markRead(activeArea, area); return { pointer: p, status: 'found', value: area.controls }; }
        if (p.endsWith(`/${escape(activeArea)}`)) { this.markRead(activeArea, area); return { pointer: p, status: 'found', value: area }; }
        // Never return a raw nested object: it may contain saved prompts or
        // descriptions removed by the model projection (including array leaves).
        const root = [`/creation/controls/areas/${escape(activeArea)}`, `/navigation/areas/${escape(activeArea)}`,
          `/feeds/areas/${escape(activeArea)}`].find(prefix => p.startsWith(prefix + '/'))!;
        const parts = p.slice(root.length + 1).split('/').map((part: string) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
        if (parts[0] === 'visibleControls') parts[0] = 'controls';
        let value: any = area;
        for (const part of parts) value = value && Object.hasOwn(value, part) ? value[part] : undefined;
        return { pointer: p, status: value === undefined ? 'not_in_model_view' : 'found', ...(value === undefined ? {} : { value }) };
      }
      if (p === '/creation' || p === '/navigation' || p === '/feeds' || p === '/creation/controls') {
        this.checkedScope = this.view.scopeRef;
        return { pointer: p, status: 'found', value: this.readSnapshot() };
      }
      if (content.test(key)) return { pointer: p, status: 'retrieval_required', tool: 'searchCreationMemory',
        detail: 'Stored project content is retrieved on demand. Only text in the visible editor is live UI context.' };
      if (p === '/creation/confirmedFailuresByTarget') return field;
      if (p === '/creation/sceneSlots' && Array.isArray(field.value)) {
        return { ...field, value: field.value.map(({ brief: _brief, ...slot }: any) => slot) };
      }
      if (p.startsWith('/creation/') && Object.hasOwn(this.view.progress, key)) return field;
      return { pointer: p, status: 'outside_foreground', detail: 'Read the visible foreground surface; background controls are not active.' };
    });
  }
  retireHistory(messages: any[]) {
    const newerFullReads = new Set<string>();
    return [...messages].reverse().map(message => {
      if (message.role !== 'tool') return message;
      try {
        const data = JSON.parse(message.content);
        if (data.kind === 'concierge_snapshot') {
          const stale = data.scopeRef !== this.view.scopeRef || (data.areas && newerFullReads.has(data.scopeRef));
          if (data.areas) newerFullReads.add(data.scopeRef);
          if (stale) return { ...message, content: JSON.stringify({ status: 'superseded', kind: data.kind,
            scopeRef: data.scopeRef, snapshotRef: data.snapshotRef, readRequired: data.scopeRef !== this.view.scopeRef }) };
        }
      } catch { /* Keep ordinary tool data and paired call IDs intact. */ }
      return message;
    }).reverse();
  }
}
