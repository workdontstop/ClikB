import { creationExecutionContext, compareCreationContext, type CreationContext } from '../server/src/creationControlIdentity';
import { store } from './store';
import { feedsActionObserved, feedsExecutionContext, isFeedsTextAction } from '../server/src/FeedsExecutionContext';
import { navigationTextLimit } from '../server/src/NavigationTextActions';
import { patchUserSnapshot, recordNavigationTransition, removeFeedsArea, setFeedsAvailableActions, setNavigationAvailableActions } from './brainstormSlice';
import type { NavigationControl } from './navigationControlSnapshot';
import { getExecutingNavigationAction, getExecutingNavigationScroll, setExecutingNavigationAction, setExecutingNavigationScroll } from './navigationActionProvenance';
import { flushCreationControls, visibleCreationDrafts } from './useCreationControls';
import { creationControlHit, exposedCreationBackdropPoint, isAiControlExcluded } from './creationControlHitTest';
import { logControlDiagnostic } from './conciergeDiagnostics';
import { conciergeVisibleSurface } from './conciergeVisibleSurface';

type BrowserCommand = { expectedCreationContext?: CreationContext; requestId: string; command: 'snapshot' | 'action' | 'scroll' | 'text'; actionId?: string; text?: string; expectedVersion?: number; expectedFeedsContext?: string; scrollId?: string; direction?: 'forward' | 'backward'; confirmedTargetId?: number | string };

/** Activate the actual mapped element. MUI comboboxes open on a mouse press,
 * whereas ordinary buttons and menu items activate on click. */
const activateMappedControl = (element: HTMLElement): void => {
  if (isAiControlExcluded(element)) throw new Error('This editor is user-operated');
  if (element.closest('[data-creation-horizontal-strip="true"]')) {
    element.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'nearest', inline: 'nearest' });
  }
  if (element.dataset.aiActivation === 'pointerdown') {
    // Preserve the owner's deliberate pointer handler. The binding tells the
    // shared executor which event is required; ordinary UI behavior is unchanged.
    const rect = element.getBoundingClientRect();
    const point = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    for (const type of ['pointerdown', 'pointerup']) element.dispatchEvent(new PointerEvent(type,
      { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true,
        button: 0, buttons: type === 'pointerdown' ? 1 : 0, ...point }));
    if (!element.isConnected) return;
  }
  if (element.getAttribute('role') === 'combobox' && element.getAttribute('aria-haspopup') === 'listbox') {
    for (const type of ['mousedown', 'mouseup']) element.dispatchEvent(new MouseEvent(type,
      { bubbles: true, cancelable: true, button: 0, buttons: type === 'mousedown' ? 1 : 0 }));
  }
  element.click();
};

const feedsContextMatches = (message: BrowserCommand, feeds: unknown): boolean =>
  Boolean(message.expectedFeedsContext && message.expectedFeedsContext ===
    feedsExecutionContext(feeds, message.actionId || message.scrollId || ''));

const inRenderedViewport = (element: HTMLElement): boolean => {
  if (isAiControlExcluded(element)) return false;
  if (!element.isConnected || element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true' || element.getAttribute('aria-hidden') === 'true') return false;
  const ownStyle = getComputedStyle(element);
  if (ownStyle.visibility !== 'visible' || ownStyle.pointerEvents === 'none') return false;
  const rect = element.getBoundingClientRect();
  const strip = element.closest<HTMLElement>('[data-creation-horizontal-strip="true"]');
  const stripRect = strip && strip !== element ? strip.getBoundingClientRect() : null;
  const horizLeft = stripRect ? stripRect.left : rect.left;
  const horizRight = stripRect ? stripRect.right : rect.right;
  if (rect.width < 1 || rect.height < 1 || (stripRect && (stripRect.width < 1 || stripRect.height < 1)) || rect.bottom <= 0 || horizRight <= 0 || rect.top >= innerHeight || horizLeft >= innerWidth) return false;
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (style.display === 'none' || style.visibility === 'hidden' || parent.getAttribute('aria-hidden') === 'true') return false;
    if (!/(auto|scroll|hidden)/.test(`${style.overflowX} ${style.overflowY}`)) continue;
    const bounds = parent.getBoundingClientRect();
    const skipHorizClip = parent === strip;
    if (rect.bottom <= bounds.top || rect.top >= bounds.bottom || (!skipHorizClip && (horizRight <= bounds.left || horizLeft >= bounds.right))) return false;
  }
  return true;
};

const mountedTargets = (actionId: string, candidates: Iterable<HTMLElement> = document.querySelectorAll<HTMLElement>('[data-ai-action]')): HTMLElement[] =>
  [...candidates].filter(element =>
    !isAiControlExcluded(element) && element.dataset.aiAction === actionId && ((inRenderedViewport(element) &&
      (actionId.endsWith('.back_to_feed') || creationControlHit(element, element.dataset.creationKind || 'click'))) ||
      // Shared Back represents existing app navigation, not a visible UI button.
      (actionId === 'clikb.navigation.back.action.back' && element.dataset.aiInternalBack === 'true' && element.isConnected) ||
      // Deck clean mode: deck actions remain mounted and functional for Concierge even when visually hidden from the user
      ((actionId.startsWith('clikb.feeds.deck.action.') || ((element.dataset.creationDeckAiOnly === 'true' || (/^clikb\.creation\.deck_view\.action\.(previous_card|next_card|position_\d+)$/.test(actionId) && Boolean(element.closest('.creation-deck--clean')))) && Boolean(element.closest('.creation-deck:not([data-creation-deck-covered="true"])')))) && element.isConnected && !element.matches(':disabled'))));

// Cosmetic only: click dispatch and its existing decisions never wait for this cue.
const aiClickCueTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
const blinkAiClick = (element: HTMLElement): void => {
  try {
    const settings = store.getState().settings;
    clearTimeout(aiClickCueTimers.get(element));
    element.style.setProperty('--ai-click-color', settings.darkMode ? settings.appColorDark : settings.appColorLight);
    element.dataset.aiClickHighlight = 'true';
    aiClickCueTimers.set(element, setTimeout(() => {
      element.removeAttribute('data-ai-click-highlight');
      element.style.removeProperty('--ai-click-color');
      aiClickCueTimers.delete(element);
    }, 900));
  } catch {
    // A visual effect must never interrupt the existing control flow.
  }
};

const eligible = (control: NavigationControl, targetsFor: (actionId: string) => HTMLElement[]): boolean => {
  if ((control.aiPolicy !== 'candidate' && control.aiPolicy !== 'needs_confirmation') || !control.enabled || !control.candidateActionId) return false;
  const area = store.getState().brainstorm.userSnapshot.navigation?.areas[control.areaId];
  if (control.areaId === 'clikb.settings' && control.controlId === `clikb.settings.control.theme_${area?.state.themePreference}`) return false;
  if (control.areaId === 'clikb.settings' && control.controlId === `clikb.settings.control.conversation_${area?.state.conversationModel}`) return false;
  if (control.controlId === 'clikb.navigation.menu.control.create' && store.getState().brainstorm.userSnapshot.ui.minimisePrompt === false && store.getState().brainstorm.userSnapshot.creation.isActive !== false) return false;
  return targetsFor(control.candidateActionId).length === 1;
};

export const refreshNavigationActions = () => {
  const state = store.getState();
  if (state.settings.deckEnabled === false && state.brainstorm.userSnapshot.feeds?.areas['clikb.feeds.deck']) {
    store.dispatch(removeFeedsArea({ areaId: 'clikb.feeds.deck', source: 'DeckOverlay' }));
  }
  // A snapshot owns one DOM index. Re-querying every mounted action for every
  // candidate made background observation scale with the whole page twice.
  // Never retain these nodes across snapshots or action execution.
  const byAction = new Map<string, HTMLElement[]>();
  document.querySelectorAll<HTMLElement>('[data-ai-action]').forEach(element => {
    const id = element.dataset.aiAction!;
    const group = byAction.get(id);
    if (group) group.push(element); else byAction.set(id, [element]);
  });
  const resolved = new Map<string, HTMLElement[]>();
  const targetsFor = (id: string) => {
    let targets = resolved.get(id);
    if (!targets) { targets = mountedTargets(id, byAction.get(id) || []); resolved.set(id, targets); }
    return targets;
  };
  const navigation = store.getState().brainstorm.userSnapshot.navigation;
  if (navigation) {
    const next = navigation.visibleControls.filter(control => eligible(control, targetsFor)).map(control => ({
      actionId: control.candidateActionId!, controlId: control.controlId,
      ...(control.aiPolicy === 'needs_confirmation' ? { requiresConfirmation: true } : {}),
      ...(control.kind === 'text' ? { kind: 'text' as const } : {}),
      ...(control.targetId != null ? { targetId: control.targetId } : {}),
    }));
    if (JSON.stringify(next) !== JSON.stringify(navigation.availableActions)) store.dispatch(setNavigationAvailableActions(next));
  }
  const feeds = store.getState().brainstorm.userSnapshot.feeds;
  if (!feeds) return;
  const feedActions = feeds.visibleControls.filter(control =>
    control.aiPolicy === 'candidate' && control.enabled && !!control.candidateActionId &&
    targetsFor(control.candidateActionId).length === 1,
  ).map(control => ({ actionId: control.candidateActionId!, controlId: control.controlId,
    ...(control.kind === 'text' ? { kind: 'text' as const } : {}),
    ...(control.label ? { label: control.label } : {}), ...(control.targetId != null ? { targetId: control.targetId } : {}) }));
  if (JSON.stringify(feedActions) !== JSON.stringify(feeds.availableActions)) store.dispatch(setFeedsAvailableActions(feedActions));
};

export const startNavigationActionRegistry = () => {
  let frame: number | null = null;
  let idle: number | null = null;
  let scrollTimer: ReturnType<typeof setTimeout> | undefined;
  // Background registry refresh is page-wide (style reads + hit tests). Run it
  // in idle time, never inside a rendering frame needed for scroll/WebGL paint.
  // The 500ms timeout bounds staleness for the 2s Concierge gate; explicit AI
  // observations still refresh synchronously via observeCurrentAppSnapshot.
  const cancelPending = () => {
    if (frame != null) { cancelAnimationFrame(frame); frame = null; }
    if (idle != null) { cancelIdleCallback(idle); idle = null; }
  };
  const refreshSoon = () => {
    if (frame != null || idle != null || scrollTimer !== undefined) return;
    if (typeof requestIdleCallback === 'function') idle = requestIdleCallback(() => { idle = null; refreshNavigationActions(); }, { timeout: 500 });
    else frame = requestAnimationFrame(() => { frame = null; refreshNavigationActions(); });
  };
  // This is observation metadata, not scrolling UI. Keep layout reads and hit
  // tests out of a moving scroll frame. Explicit AI snapshots still refresh
  // synchronously through observeCurrentAppSnapshot below.
  const scrolled = () => {
    cancelPending();
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => { scrollTimer = undefined; refreshSoon(); }, 180);
  };
  const observer = new MutationObserver(refreshSoon);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ai-action', 'style', 'hidden', 'disabled', 'aria-disabled', 'aria-hidden', 'class'] });
  const unsubscribe = store.subscribe(refreshSoon);
  const userTakeover = (event: Event) => { if (event.isTrusted) { setExecutingNavigationAction(null); setExecutingNavigationScroll(null); } };
  document.addEventListener('pointerdown', userTakeover, true);
  document.addEventListener('keydown', userTakeover, true);
  document.addEventListener('scroll', scrolled, { capture: true, passive: true });
  window.addEventListener('resize', refreshSoon);
  refreshSoon();
  return () => {
    observer.disconnect(); unsubscribe();
    cancelPending();
    clearTimeout(scrollTimer);
    document.removeEventListener('pointerdown', userTakeover, true);
    document.removeEventListener('keydown', userTakeover, true);
    document.removeEventListener('scroll', scrolled, true);
    window.removeEventListener('resize', refreshSoon);
  };
};

export const observeCurrentAppSnapshot = () => {
  flushCreationControls();
  const state = store.getState();
  const settings = state.settings;
  const entryPoints = settings.autoControlEntryPoints;
  const { deckCleanMode: _previousDeckMode, ...ui } = state.brainstorm.userSnapshot.ui;
  const deckEnabled = settings.deckEnabled !== false;
  store.dispatch(patchUserSnapshot({ ui: { ...ui, deckEnabled, ...(deckEnabled ? { deckCleanMode: settings.deckCleanMode } : {}), guideShortcuts: 'text-input: voice, model, deck' }, creation: { visibleDrafts: visibleCreationDrafts(state.brainstorm.userSnapshot.creation.controls?.areas || {}) }, app: { ...state.brainstorm.userSnapshot.app, appearance: {
    themePreference: settings.themePreference, effectiveDarkMode: settings.darkMode,
    appColor: settings.darkMode ? settings.appColorDark : settings.appColorLight,
    appColorDark: settings.appColorDark, appColorLight: settings.appColorLight,
  } }, autoControl: {
    surfaceId: 'clikb.global.auto_control', conciergeEnabled: settings.conciergeEnabled,
    enabled: settings.autoControlEnabled, visible: settings.autoControlVisible,
    videoEnabled: settings.videoControlEnabled,
    visibleEntryPoints: entryPoints,
    visibleControlIds: [
      ...(entryPoints.length ? ['clikb.global.auto_control.control.reveal'] : []),
      ...(settings.autoControlVisible ? ['clikb.global.auto_control.control.toggle', 'clikb.global.auto_control.control.hide'] : []),
    ],
    changedAt: settings.autoControlChangedAt, changedBy: settings.autoControlChangedBy,
  } }));
  refreshNavigationActions();
  const snapshot = store.getState().brainstorm.userSnapshot;
  return { ...snapshot, conciergeFocus: conciergeVisibleSurface(snapshot) };
};

const observed = observeCurrentAppSnapshot;

const actionStateSignature = () => {
  const snapshot = store.getState().brainstorm.userSnapshot;
  return JSON.stringify({ route: snapshot.navigation?.route, areas: Object.fromEntries(Object.entries(snapshot.navigation?.areas || {}).map(([id, area]) => [id, area?.state])), ui: snapshot.ui, creationPromptOpen: snapshot.creation.promptOpen });
};

const waitForChange = (beforeSignature: string, beforeSequence: number, actionId: string): Promise<'changed' | 'dispatched' | 'failed' | 'timeout' | 'stopped'> =>
  new Promise(resolve => {
    let done = false;
    const finish = (status: 'changed' | 'dispatched' | 'failed' | 'timeout' | 'stopped') => {
      if (done) return;
      done = true; clearTimeout(timer); unsubscribe(); resolve(status);
    };
    const check = () => {
      const state = store.getState();
      if (!state.settings.autoControlEnabled) return finish('stopped');
      if (getExecutingNavigationAction() !== actionId) return finish('stopped');
      const navigation = state.brainstorm.userSnapshot.navigation;
      if (actionId === 'clikb.navigation.back.action.back' && navigation) {
        const previous = JSON.parse(beforeSignature);
        if (navigation.route !== previous.route || navigation.areas['clikb.navigation.back']?.state.destination !== previous.areas?.['clikb.navigation.back']?.destination)
          return finish('changed');
      }
      const controlId = actionId.replace('.action.', '.control.');
      const matchingTransition = [...(navigation?.recentTransitions || [])].reverse().find(event => event.sequence > beforeSequence && (event.after.controlId === controlId || event.before.controlId === controlId));
      if (matchingTransition?.outcome === 'failed') return finish('failed');
      // Profile mutations finish with a new session and document reload. A busy
      // state before that response only proves the owning handler accepted it.
      if (matchingTransition?.outcome === 'unknown' && matchingTransition.authoritativeSource === 'CreativeProfiles' &&
          /^clikb\.navigation\.creative_profiles_(?:profile|settings|cover)\.action\.(?:create_submit|delete_submit|main|use|profile_\d+)$/.test(actionId)) {
        return finish('dispatched');
      }
      const pendingRoute = matchingTransition?.outcome === 'unknown' && matchingTransition.after.route && matchingTransition.after.route.toLowerCase() !== navigation?.route.toLowerCase();
      if (navigation && matchingTransition && !pendingRoute && actionStateSignature() !== beforeSignature) {
        const scrolling = Object.values(navigation.areas).some(area => Object.values(area?.scrolls || {}).some(viewport => viewport.isScrolling));
        if (!scrolling) finish('changed');
      }
    };
    const unsubscribe = store.subscribe(check);
    const timer = setTimeout(() => finish('timeout'), 10000);
    check();
  });

const waitForScrollSettlement = (areaId: string, key: string, previousSettledAt: number | null): Promise<'settled' | 'timeout' | 'stopped'> =>
  new Promise(resolve => {
    let done = false;
    const finish = (status: 'settled' | 'timeout' | 'stopped') => {
      if (done) return;
      done = true; clearTimeout(timer); unsubscribe(); resolve(status);
    };
    const check = () => {
      const state = store.getState();
      if (!state.settings.autoControlEnabled) return finish('stopped');
      if (getExecutingNavigationScroll() !== areaId) return finish('stopped');
      const viewport = state.brainstorm.userSnapshot.navigation?.areas[areaId as keyof NonNullable<typeof state.brainstorm.userSnapshot.navigation>['areas']]?.scrolls?.[key];
      if (viewport && !viewport.isScrolling && viewport.settledAt && viewport.settledAt !== previousSettledAt) finish('settled');
    };
    const unsubscribe = store.subscribe(check);
    const timer = setTimeout(() => finish('timeout'), 5000);
    check();
  });

const waitForFeedsChange = (before: unknown, actionId: string): Promise<'changed' | 'timeout' | 'stopped'> =>
  new Promise(resolve => {
    let done = false;
    const finish = (status: 'changed' | 'timeout' | 'stopped') => {
      if (done) return;
      done = true; clearTimeout(timer); unsubscribe(); resolve(status);
    };
    const check = () => {
      const state = store.getState();
      if (!state.settings.autoControlEnabled || getExecutingNavigationAction() !== actionId) return finish('stopped');
      const feeds = state.brainstorm.userSnapshot.feeds;
      if (feedsActionObserved(before, feeds, actionId, store.getState().brainstorm.userSnapshot)) finish('changed');
    };
    const unsubscribe = store.subscribe(check);
    const timer = setTimeout(() => finish('timeout'), 10000);
    check();
  });

const waitForFeedsScroll = (areaId: string, previousSettledAt: number | null): Promise<'settled' | 'timeout' | 'stopped'> =>
  new Promise(resolve => {
    let done = false;
    const finish = (status: 'settled' | 'timeout' | 'stopped') => {
      if (done) return;
      done = true; clearTimeout(timer); unsubscribe(); resolve(status);
    };
    const check = () => {
      const state = store.getState();
      if (!state.settings.autoControlEnabled || getExecutingNavigationScroll() !== areaId) return finish('stopped');
      const area = state.brainstorm.userSnapshot.feeds?.areas[areaId];
      const settledAt = area?.state?.settledAt;
      if (area && !area.state.isScrolling && typeof settledAt === 'number' && settledAt !== previousSettledAt) finish('settled');
    };
    const unsubscribe = store.subscribe(check);
    const timer = setTimeout(() => finish('timeout'), 5000);
    check();
  });

const waitForElementScroll = (element: HTMLElement, areaId: string, horizontal: boolean): Promise<'settled' | 'timeout' | 'stopped'> =>
  new Promise(resolve => {
    const initial = horizontal ? element.scrollLeft : element.scrollTop;
    let last = initial, lastMove = performance.now();
    const started = performance.now();
    const poll = () => {
      if (!store.getState().settings.autoControlEnabled || getExecutingNavigationScroll() !== areaId) return resolve('stopped');
      const now = performance.now();
      const current = horizontal ? element.scrollLeft : element.scrollTop;
      if (Math.abs(current - last) > 1) { last = current; lastMove = now; }
      if (Math.abs(current - initial) > 1 && now - lastMove >= 200) return resolve('settled');
      if (now - started >= 5000) return resolve('timeout');
      requestAnimationFrame(poll);
    };
    requestAnimationFrame(poll);
  });

export const handleNavigationBrowserRequest = async (message: BrowserCommand, baseUrl: string, signal?: AbortSignal) => {
  if (signal?.aborted) return;
  if (!message || typeof message.requestId !== 'string') return;
  let reply: Record<string, unknown>;
  try {
    if (message.command === 'snapshot') {
      reply = { status: 'observed', snapshot: observed() };
    } else if (message.actionId === 'clikb.navigation.back.action.back' && observed().creation.isActive) {
      reply = { status: 'rejected', detail: 'Use the active Creation child Close control; shared Back cannot exit Creation.', snapshot: observed() };
    } else if ((message.actionId || message.scrollId || '').startsWith('clikb.creation.')) {
      // Jev has selected and approved this live Creation control; the browser still rechecks it.
      const before = observed();
      const controls = before.creation.controls;
      const actionId = message.actionId || message.scrollId;
      const control = Object.values(controls?.areas || {}).flatMap(area => area.controls).find(item => item.actionId === actionId);
      const targets = control ? mountedTargets(control.actionId) : [];
      const settings = store.getState().settings;
      const expectedKind = message.command === 'action' ? 'click' : message.command;
      const ownerEquivalentTargets = control?.actionId === 'clikb.creation.storybook_start.action.start' && targets.length > 1 && getExecutingNavigationAction() !== control.actionId && targets.every(el => (el.closest<HTMLElement>('[data-creation-owner]')?.dataset.creationOwner || '') === (targets[0].closest<HTMLElement>('[data-creation-owner]')?.dataset.creationOwner || '') && el.dataset.creationControl === control.controlId && el.dataset.aiAction === control.actionId && el.dataset.creationHandler === control.handlerRef && el.dataset.creationKind === control.kind && el.dataset.creationPolicy === control.policy && (el.dataset.creationLabel || '').slice(0, 120) === control.label);
      const target = targets.length === 1 ? targets[0] : ownerEquivalentTargets ? targets[0] : null;
      const contextMismatch = message.expectedCreationContext !== undefined
        ? compareCreationContext(message.expectedCreationContext, creationExecutionContext(before, actionId || '', expectedKind))
        : controls?.stateVersion === message.expectedVersion ? undefined : {reasonCode:'version_changed',changedFields:['stateVersion']};
      const selfHitRegion = target?.dataset.creationHitRegion === 'self';
      const backdropPoint = selfHitRegion && target ? exposedCreationBackdropPoint(target) : null;
      const cleanDeck = target && (target.dataset.creationDeckAiOnly === 'true' || (/^clikb\.creation\.deck_view\.action\.(previous_card|next_card|position_\d+)$/.test(actionId || '') && Boolean(target.closest('.creation-deck--clean')))) ? target.closest<HTMLElement>('.creation-deck:not([data-creation-deck-covered="true"])') : null;
      const cleanDeckHit = cleanDeck ? document.elementFromPoint(innerWidth / 2, innerHeight / 2) : null;
      const hit = cleanDeck && cleanDeckHit && cleanDeck.contains(cleanDeckHit) && !cleanDeckHit.closest('.creation-deck-foreground, .creation-deck-settings, .creation-deck-menu') ? target : target && control ? creationControlHit(target, control.kind) : null;
      if (!settings.autoControlEnabled || !settings.conciergeEnabled || signal?.aborted) {
        reply = { status: 'rejected', detail: 'Auto Control is off or request stopped', snapshot: before };
      } else if (!controls || contextMismatch || !control?.enabled || !target ||
          control.kind !== expectedKind || !hit || !target.contains(hit) ||
          (control.kind !== 'scroll' && hit.closest('[data-creation-control]') && hit.closest('[data-creation-control]') !== target)) {
        reply = { status: 'stale_or_unavailable', reasonCode: contextMismatch?.reasonCode || (targets.length > 1 ? 'target_ambiguous' : !target ? 'target_missing' : !control?.enabled ? 'control_disabled' : control.kind !== expectedKind ? 'operation_mismatch' : 'target_occluded'),
          changedFields: contextMismatch?.changedFields, rejectionPhase:'browser_before_dispatch', mutationSent:false,
          eligibleTargetCount:targets.length, detail: 'Creation target, relevant context, visibility or operation changed', snapshot: before };
      } else if (control.policy === 'information_only' || control.policy === 'needs_handoff' || (control.policy === 'needs_confirmation' && message.confirmedTargetId !== control.controlId)) {
        reply = { status: 'rejected', detail: 'This control requires user handoff or explicit target confirmation', snapshot: before };
      } else if (control.policy === 'requires_video' && !settings.videoControlEnabled) {
        reply = { status: 'rejected', detail: 'Video permission is off. Enable the Video segment for paid video or Motion Guide operations.', snapshot: before };
      } else if (control.actionId === 'clikb.creation.video_permission.action.enable' && message.confirmedTargetId !== control.controlId) {
        reply = { status: 'rejected', detail: 'Enabling Video requires the user request to operate this toggle.', snapshot: before };
      } else {
        setExecutingNavigationAction(control.actionId);
        try {
          if (control.kind === 'text') {
            const field = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target : target.querySelector<HTMLInputElement | HTMLTextAreaElement>('input:not([type=hidden]),textarea:not([aria-hidden=true])');
            if (!field || field.readOnly || field.disabled || typeof message.text !== 'string' || message.text.length > (field.maxLength > 0 ? Math.min(30000, field.maxLength) : 30000)) throw new Error('Creation text target or input length is invalid');
            if (field instanceof HTMLInputElement && ['range', 'number'].includes(field.type)) {
              const value = Number(message.text);
              const minimum = field.getAttribute('aria-valuemin') ?? field.getAttribute('min');
              const maximum = field.getAttribute('aria-valuemax') ?? field.getAttribute('max');
              if (!message.text.trim() || !Number.isFinite(value) || (minimum != null && value < Number(minimum)) || (maximum != null && value > Number(maximum)))
                throw new Error('Requested numeric value is outside the live control range');
            }
            field.focus();
            const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(field, message.text);
            field.dispatchEvent(new Event('input', { bubbles: true }));
            // Let the owner's onChange state commit before its onBlur reads it.
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
            // Commit through existing onBlur behavior (including the custom art-style field).
            field.blur();
          } else if (control.kind === 'scroll') {
            if (!['forward', 'backward'].includes(String(message.direction))) throw new Error('Missing scroll direction');
            const forward = message.direction === 'forward';
            if (!(forward ? control.canScrollForward : control.canScrollBackward)) throw new Error('Scroll boundary reached');
            const vertical = target.scrollHeight > target.clientHeight + 1;
            const delta = Math.max(100, (vertical ? target.clientHeight : target.clientWidth) * 0.8) * (forward ? 1 : -1);
            target.scrollBy(vertical ? { top: delta, behavior: 'instant' } : { left: delta, behavior: 'instant' });
          } else if (backdropPoint) {
            // MUI's existing outside-click close requires a press that starts
            // and ends on the exposed container. Do not invoke close directly.
            for (const type of ['mousedown', 'mouseup', 'click']) {
              target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true,
                clientX: backdropPoint.x, clientY: backdropPoint.y, button: 0, buttons: type === 'mousedown' ? 1 : 0 }));
            }
            blinkAiClick(target);
          } else {
            activateMappedControl(target);
            blinkAiClick(target);
          }
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          if (control.kind === 'click') {
            const beforeCreationKey = JSON.stringify([
              before.creation.stage,
              before.creation.status,
              before.creation.isGenerating,
              before.creation.editStoryIsOpen,
              before.creation.editStorySceneIndex,
              before.creation.editStoryTab,
              before.creation.controls?.stateVersion,
              Object.keys(before.creation.controls?.areas || {}),
            ]);
            const deadline = performance.now() + 260;
            while (performance.now() < deadline) {
              await new Promise<void>(resolve => setTimeout(resolve, 45));
              const current = observed();
              const currentKey = JSON.stringify([
                current.creation.stage,
                current.creation.status,
                current.creation.isGenerating,
                current.creation.editStoryIsOpen,
                current.creation.editStorySceneIndex,
                current.creation.editStoryTab,
                current.creation.controls?.stateVersion,
                Object.keys(current.creation.controls?.areas || {}),
              ]);
              if (currentKey !== beforeCreationKey) {
                await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
                break;
              }
            }
          }
          const afterCreation = observed();
          store.dispatch(recordNavigationTransition({ actor: 'ai', kind: 'control', before: { controlId: control.controlId },
            after: { controlId: control.controlId }, outcome: 'unknown', authoritativeSource: control.handlerRef,
            detail: 'Creation UI operation dispatched; inspect current state for outcome. No generated content or typed text logged.' }));
          reply = { status: 'dispatched', actionId: control.actionId, detail: 'Mapped UI event delivered. Read current state for the actual handler outcome; this is not proof of completed generation.', snapshot: afterCreation };
        } finally { setExecutingNavigationAction(null); }
      }
    } else if (message.command === 'text' && navigationTextLimit(message.actionId || '')) {
      const before = observed();
      const action = before.navigation?.availableActions.find(candidate => candidate.actionId === message.actionId && candidate.kind === 'text');
      const targets = action ? mountedTargets(action.actionId) : [];
      const field = targets.length === 1 ? targets[0] : null;
      if (!store.getState().settings.autoControlEnabled || !store.getState().settings.conciergeEnabled || signal?.aborted) {
        reply = { status: 'rejected', detail: 'Auto Control is off or request stopped', snapshot: before };
      } else if (!action || before.navigation?.stateVersion !== message.expectedVersion ||
          !(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) || field.disabled || field.readOnly ||
          creationControlHit(field, 'text') !== field || typeof message.text !== 'string' ||
          message.text.length > navigationTextLimit(action.actionId)) {
        reply = { status: 'stale_or_unavailable', detail: 'Text field or its execution context changed', snapshot: before };
      } else {
        const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        setExecutingNavigationAction(action.actionId);
        try {
          Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(field, message.text);
          field.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          reply = { status: field.value === message.text ? 'observed_change' : 'dispatched', actionId: action.actionId, snapshot: observed() };
          blinkAiClick(field);
        } finally { setExecutingNavigationAction(null); }
      }
    } else if (message.command === 'text' && isFeedsTextAction(message.actionId || '')) {
      const before = observed();
      const action = before.feeds?.availableActions.find(candidate => candidate.actionId === message.actionId && candidate.kind === 'text');
      const targets = action ? mountedTargets(action.actionId) : [];
      const field = targets.length === 1 && targets[0] instanceof HTMLInputElement ? targets[0] : null;
      const hit = field ? creationControlHit(field, 'text') : null;
      if (!store.getState().settings.autoControlEnabled || !store.getState().settings.conciergeEnabled || signal?.aborted) {
        reply = { status: 'rejected', detail: 'Auto Control is off or request stopped', snapshot: before };
      } else if (!action || !feedsContextMatches(message, before.feeds) || !field || field.disabled || field.readOnly
        || (hit !== field && !action.actionId.startsWith('clikb.feeds.deck.action.')) || typeof message.text !== 'string' || message.text.length > 500) {
        reply = { status: 'stale_or_unavailable', detail: 'Search field or its execution context changed', snapshot: before };
      } else {
        setExecutingNavigationAction(action.actionId);
        try {
          field.focus();
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, message.text);
          field.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          field.blur();
          await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
          const snapshot = observed();
          reply = { status: snapshot.feeds?.areas['clikb.feeds.deck']?.state.searchInput === message.text ? 'observed_change' : 'dispatched',
            actionId: action.actionId, snapshot };
          blinkAiClick(field);
        } finally { setExecutingNavigationAction(null); }
      }
    } else if (message.command === 'scroll') {
      const before = observed();
      if (message.scrollId?.startsWith('clikb.feeds.')) {
        const feeds = before.feeds;
        const [areaId, key] = message.scrollId.split(':');
        const area = feeds?.areas[areaId];
        const targets = [...document.querySelectorAll<HTMLElement>('[data-ai-scroll]')].filter(element =>
          element.dataset.aiScroll === message.scrollId && inRenderedViewport(element));
        const direction = message.direction;
        const state = area?.state;
        const allowed = key === 'feed' && areaId.startsWith('clikb.feeds.viewport.')
          ? (direction === 'forward' ? state?.canScrollForward : direction === 'backward' ? state?.canScrollBackward : false)
          : state && areaId.startsWith('clikb.feeds.fullscreen.') && !state.obscuredByLikes && !state.planOpen && !state.editOpen && !state.deleteConfirmationOpen
            ? key === 'posts' && typeof state.scrollTop === 'number' && typeof state.scrollMax === 'number' ? (direction === 'forward' ? state.scrollTop < state.scrollMax - 2 : state.scrollTop > 2)
              : key === 'scenes' ? (direction === 'forward' ? state.canScrollScenesForward : state.canScrollScenesBackward)
              : key === 'caption' && state.captionExpanded && typeof state.captionScrollTop === 'number' && typeof state.captionScrollMax === 'number'
                ? (direction === 'forward' ? state.captionScrollTop < state.captionScrollMax - 2 : state.captionScrollTop > 2) : false
            : state && areaId === 'clikb.feeds.plan' && key === 'body' && !state.zoomOpen && typeof state.scrollTop === 'number' && typeof state.scrollMax === 'number'
              ? (direction === 'forward' ? state.scrollTop < state.scrollMax - 2 : state.scrollTop > 2) : false;
        if (!store.getState().settings.autoControlEnabled || !store.getState().settings.conciergeEnabled) {
          reply = { status: 'rejected', detail: 'Auto Control is off', snapshot: before };
        } else if (!feeds || !feedsContextMatches(message, feeds) || !area ||
            area.state.hiddenByFullscreen || area.state.hiddenByDeck || !allowed || targets.length !== 1) {
          reply = { status: 'stale_or_unavailable', detail: 'Feeds scroll owner, direction or version changed', snapshot: before };
        } else {
          setExecutingNavigationScroll(areaId);
          try {
            const target = targets[0];
            const vertical = key !== 'scenes' && (key !== 'feed' || area.state.axis === 'vertical');
            const documentOwner = key === 'feed' && area.state.scrollOwner === 'document';
            const amount = Math.max(100, (vertical ? (documentOwner ? innerHeight : target.clientHeight) : target.clientWidth) * 0.8)
              * (direction === 'forward' ? 1 : -1);
            if (documentOwner) window.scrollBy({ top: amount, behavior: 'smooth' });
            else target.scrollBy(vertical ? { top: amount, behavior: 'smooth' } : { left: amount, behavior: 'smooth' });
            const result = key === 'feed'
              ? await waitForFeedsScroll(areaId, typeof area.state.settledAt === 'number' ? area.state.settledAt : null)
              : await waitForElementScroll(target, areaId, !vertical);
            reply = { status: result, scrollId: message.scrollId, snapshot: observed() };
          } finally {
            setExecutingNavigationScroll(null);
          }
        }
      } else {
      const navigation = before.navigation;
      const [areaId, key] = String(message.scrollId || '').split(':');
      const viewport = navigation?.areas[areaId as keyof typeof navigation.areas]?.scrolls?.[key];
      const targets = [...document.querySelectorAll<HTMLElement>('[data-ai-scroll]')].filter(element => element.dataset.aiScroll === message.scrollId && inRenderedViewport(element));
      if (!store.getState().settings.autoControlEnabled || !store.getState().settings.conciergeEnabled) {
        reply = { status: 'rejected', detail: 'Auto Control is off', snapshot: before };
      } else if (!navigation || message.expectedVersion !== navigation.stateVersion || !viewport || targets.length !== 1 || !['forward', 'backward'].includes(String(message.direction)) || !(message.direction === 'forward' ? viewport.canScrollForward : viewport.canScrollBackward)) {
        reply = { status: 'stale_or_unavailable', detail: 'Scroll owner, direction or snapshot version no longer matches', snapshot: before };
      } else {
        setExecutingNavigationScroll(areaId);
        const amount = Math.max(100, (viewport.axis === 'vertical' ? targets[0].clientHeight : targets[0].clientWidth) * 0.8) * (message.direction === 'forward' ? 1 : -1);
        targets[0].scrollBy(viewport.axis === 'vertical' ? { top: amount, behavior: 'smooth' } : { left: amount, behavior: 'smooth' });
        const result = await waitForScrollSettlement(areaId, key, viewport.settledAt);
        setExecutingNavigationScroll(null);
        reply = { status: result, scrollId: message.scrollId, snapshot: observed() };
      }
      }
    } else if (message.command === 'action') {
      const before = observed();
      if (message.actionId?.startsWith('clikb.feeds.')) {
        const feeds = before.feeds;
        const action = feeds?.availableActions.find(candidate => candidate.actionId === message.actionId);
        const targets = action ? mountedTargets(action.actionId) : [];
        if (!store.getState().settings.autoControlEnabled || !store.getState().settings.conciergeEnabled) {
          reply = { status: 'rejected', detail: 'Auto Control is off', snapshot: before };
        } else if (!feeds || !feedsContextMatches(message, feeds) || !action || action.kind === 'text' || targets.length !== 1 ||
            (action.actionId.endsWith('.back_to_feed') &&
              (!action.actionId.startsWith('clikb.feeds.fullscreen.') ||
                feeds.areas[action.controlId.replace(/\.back_to_feed$/, '')]?.state?.sharedLink !== false))) {
          reply = { status: 'stale_or_unavailable', detail: 'Feeds control/version no longer matches', snapshot: before };
        } else {
          const element = targets[0];
          const signature = feeds;
          const settings = store.getState().settings;
          element.style.setProperty('--ai-action-color', settings.darkMode ? settings.appColorDark : settings.appColorLight);
          element.dataset.aiExecuting = 'true';
          try {
            await new Promise(resolve => setTimeout(resolve, 350));
            const fresh = observed();
            if (!store.getState().settings.autoControlEnabled || !store.getState().settings.conciergeEnabled ||
                signal?.aborted || !feedsContextMatches(message, fresh.feeds) || mountedTargets(action.actionId)[0] !== element) {
              reply = { status: 'stale_or_unavailable', detail: 'Feeds control changed while highlighting', snapshot: fresh };
            } else {
              setExecutingNavigationAction(action.actionId);
              if (action.actionId.endsWith('.back_to_feed')) {
                // Ordinary fullscreen already closes on popstate. Reuse the same
                // browser Back path as its existing user interaction.
                window.history.back();
              } else {
                activateMappedControl(element);
              }
              const result = await waitForFeedsChange(signature, action.actionId);
              reply = { status: result === 'changed' ? 'observed_change' : result, actionId: action.actionId, snapshot: observed() };
            }
          } finally {
            if (getExecutingNavigationAction() === action.actionId) setExecutingNavigationAction(null);
            element.removeAttribute('data-ai-executing');
            element.style.removeProperty('--ai-action-color');
          }
        }
      } else {
      const navigation = before.navigation;
      const action = navigation?.availableActions.find(candidate => candidate.actionId === message.actionId);
      const target = action && mountedTargets(action.actionId);
      if (!store.getState().settings.autoControlEnabled || !store.getState().settings.conciergeEnabled) {
        reply = { status: 'rejected', detail: 'Auto Control is off', snapshot: before };
      } else if (!navigation || message.expectedVersion !== navigation.stateVersion || !action || action.kind === 'text' || !target || target.length !== 1 || (action.requiresConfirmation && String(message.confirmedTargetId) !== String(action.targetId))) {
        reply = { status: 'stale_or_unavailable', detail: 'Current control/version no longer matches', snapshot: before };
      } else {
        const beforeSignature = actionStateSignature();
        const element = target[0];
        const settings = store.getState().settings;
        element.style.setProperty('--ai-action-color', settings.darkMode ? settings.appColorDark : settings.appColorLight);
        element.dataset.aiExecuting = 'true';
        try {
          // Give the person time to see the selected target before a route or
          // overlay click can unmount it. Revalidate after this brief cue.
          await new Promise(resolve => setTimeout(resolve, 350));
          const fresh = observed();
          if (!store.getState().settings.autoControlEnabled || !store.getState().settings.conciergeEnabled ||
              signal?.aborted || fresh.navigation?.stateVersion !== message.expectedVersion || mountedTargets(action.actionId)[0] !== element) {
            reply = { status: 'stale_or_unavailable', detail: 'Control changed while highlighting it', snapshot: fresh };
          } else {
            setExecutingNavigationAction(action.actionId);
            activateMappedControl(element);
            const result = await waitForChange(beforeSignature, navigation.transitionSequence, action.actionId);
            reply = { status: result === 'changed' ? 'observed_change' : result, actionId: action.actionId, snapshot: observed() };
          }
        } finally {
          if (getExecutingNavigationAction() === action.actionId) setExecutingNavigationAction(null);
          element.removeAttribute('data-ai-executing');
          element.style.removeProperty('--ai-action-color');
        }
      }
      }
    } else {
      reply = { status: 'invalid_command' };
    }
  } catch (error) {
    setExecutingNavigationAction(null);
    setExecutingNavigationScroll(null);
    reply = { status: 'error', detail: String(error), snapshot: observed() };
  }
  const operationId = message.actionId || message.scrollId || '';
  if (operationId.startsWith('clikb.feeds.') && ['observed_change', 'settled', 'timeout', 'error'].includes(String(reply.status))) {
    const snapshot = store.getState().brainstorm.userSnapshot;
    const fullscreen = Object.values(snapshot.feeds?.areas || {}).find(area => area.areaId.startsWith('clikb.feeds.fullscreen.'));
    store.dispatch(recordNavigationTransition({ actor: 'ai', kind: 'control',
      before: { controlId: operationId },
      after: { route: snapshot.route, controlId: operationId, entityId: typeof fullscreen?.state.postId === 'number' ? fullscreen.state.postId : undefined },
      outcome: ['observed_change', 'settled'].includes(String(reply.status)) ? 'succeeded' : 'failed',
      authoritativeSource: 'VirtualGate browser observed result',
    }));
    reply.snapshot = observed();
  }
  logControlDiagnostic('VirtualGate browser', {
    requestId: message.requestId,
    command: message.command,
    actionId: message.actionId,
    scrollId: message.scrollId,
    expectedVersion: message.expectedVersion,
    direction: message.direction,
    confirmedTargetId: message.confirmedTargetId,
    reply,
  });
  const response = await fetch(`${baseUrl}/navigation/browser-reply`, {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId: message.requestId, reply }),
  });
  if (!response.ok) console.warn('[VirtualGate browser] reply delivery failed', { requestId: message.requestId, httpStatus: response.status });
};
