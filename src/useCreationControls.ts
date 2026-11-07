import { useEffect, useId, useRef, type RefObject } from 'react';
import { useDispatch } from 'react-redux';
import { publishCreationArea, removeCreationArea } from './brainstormSlice';
import type { CreationArea, CreationControl } from './creationControlSnapshot';
import { PRECISE_CREATION_AREA_ID, preciseCreationState } from './creationControlSnapshot';
import { creationControlHit } from './creationControlHitTest';
import { getAutoControlTask } from './autoControlContinuation';
import { store } from './store';
import { effectiveCreationArea } from './creationControlRegistry';
import { creationValueRevision } from '../server/src/creationControlIdentity';

const publishers = new Set<() => void>();
const measurements = new Map<string, CreationArea>();
let collecting = false;
function commitArea(areaId: string, dispatch = store.dispatch) {
  const current = store.getState().brainstorm.userSnapshot.creation.controls?.areas[areaId];
  const next = effectiveCreationArea(areaId, [...measurements.values()].filter(item => item.areaId === areaId));
  if (next) {
    if (JSON.stringify(current) !== JSON.stringify(next)) dispatch(publishCreationArea(next));
  } else if (current?.source === `registry:${areaId}`) dispatch(removeCreationArea({ areaId, source: current.source }));
}
/** Refresh after React commits, independently of the cosmetic click cue. */
export function flushCreationControls(): void {
  const areas = new Set([...measurements.values()].map(item => item.areaId));
  collecting = true;
  try { publishers.forEach(publish => publish()); } finally { collecting = false; }
  measurements.forEach(item => areas.add(item.areaId));
  areas.forEach(areaId => commitArea(areaId));
}

/** Read only mapped, currently visible editors at observation time. This does
 * not publish the draft to the large host screen or run generation actions. */
export function visibleCreationDrafts(areas: Record<string, CreationArea>) {
  let remaining = 30000;
  return Object.values(areas).flatMap(area => area.controls).filter(control => control.kind === 'text' &&
    control.controlId.startsWith('clikb.creation.notepad.control.') && !control.controlId.endsWith('.ask_text')).flatMap(control => {
    const field = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-creation-control]'))
      .find(element => element.dataset.creationControl === control.controlId && element.getBoundingClientRect().height > 0
        && element.getAttribute('aria-hidden') !== 'true' && creationControlHit(element, 'text'));
    if (!field || remaining <= 0) return [];
    const value = field.value.slice(0, remaining); remaining -= value.length;
    return [{ controlId: control.controlId, label: control.label, value, state: 'uncommitted-editor-draft' as const }];
  });
}

/** Measure only explicitly mapped controls belonging to this component, including portals. */
export function useCreationControls(area: string, source: string, active: boolean,
  state: CreationArea['state'] = {}, ownerRef?: RefObject<HTMLElement | null>) {
  const dispatch = useDispatch();
  const instanceId = useId();
  const publisherSource = `${source}:${instanceId}`;
  const stateKey = JSON.stringify(state);
  const latestStateKey = useRef(stateKey);
  const scheduleRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    latestStateKey.current = stateKey;
    scheduleRef.current?.();
  }, [stateKey]);
  useEffect(() => {
    const areaId = `clikb.creation.${area}`;
    if (!active) return;
    let frame = 0;
    let idle = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const publish = () => {
      frame = idle = 0;
      const controls: CreationControl[] = [];
      const deckEnabled = store.getState().settings.deckEnabled !== false;
      // Controls share most ancestors. Read each ancestor's geometry/style
      // once in this synchronous observation, never across observations.
      const rectangles = new WeakMap<Element, DOMRect>();
      const styles = new WeakMap<Element, CSSStyleDeclaration>();
      const boundsOf = (element: Element) => {
        let value = rectangles.get(element);
        if (!value) { value = element.getBoundingClientRect(); rectangles.set(element, value); }
        return value;
      };
      const styleOf = (element: Element) => {
        let value = styles.get(element);
        if (!value) { value = getComputedStyle(element); styles.set(element, value); }
        return value;
      };
      document.querySelectorAll<HTMLElement>(`[data-creation-control][data-creation-area="${areaId}"]`).forEach(element => {
        if (areaId === PRECISE_CREATION_AREA_ID || element.dataset.creationArea !== areaId) return;
        if (!deckEnabled && (
          element.closest('[data-creation-owner="creation-deck"]') || element.dataset.creationControl?.endsWith('.open_creation_deck')
          || element.dataset.creationControl === 'clikb.creation.storybook_grid.control.open_deck'
          || element.dataset.creationControl?.startsWith('clikb.creation.storybook_grid.control.deck_mode_'))) return;
        // Repeated editor hosts must not publish another host's controls with
        // their own state. The enclosing dialog container owns outside Close.
        if (ownerRef && (!ownerRef.current || (!ownerRef.current.contains(element)
          && !(element.dataset.creationHitRegion === 'self' && element.contains(ownerRef.current))
          && !(ownerRef.current.dataset.creationOwner && element.closest<HTMLElement>('[data-creation-owner]')?.dataset.creationOwner === ownerRef.current.dataset.creationOwner)))) return;
        const rect = boundsOf(element);
        const strip = element.closest<HTMLElement>('[data-creation-horizontal-strip="true"]');
        const stripRect = strip && strip !== element ? boundsOf(strip) : null;
        const horizLeft = stripRect ? stripRect.left : rect.left;
        const horizRight = stripRect ? stripRect.right : rect.right;
        const cleanDeck = (element.dataset.creationDeckAiOnly === 'true' || (/^clikb\.creation\.deck_view\.control\.(previous_card|next_card|position_\d+)$/.test(element.dataset.creationControl || '') && Boolean(element.closest('.creation-deck--clean')))) ? element.closest<HTMLElement>('.creation-deck:not([data-creation-deck-covered="true"])') : null;
        const cleanDeckHit = cleanDeck && element.closest<HTMLElement>('.creation-deck-collection')?.style.visibility !== 'hidden' ? document.elementFromPoint(innerWidth / 2, innerHeight / 2) : null;
        const cleanDeckNav = Boolean(cleanDeck && cleanDeckHit && cleanDeck.contains(cleanDeckHit) && !cleanDeckHit.closest('.creation-deck-foreground, .creation-deck-settings, .creation-deck-menu'));
        if (!cleanDeckNav && (!element.isConnected || !rect.width || !rect.height || (stripRect && (!stripRect.width || !stripRect.height)) || rect.bottom <= 0 || horizRight <= 0 || rect.top >= innerHeight || horizLeft >= innerWidth)) return;
        let visible = true;
        for (let node: HTMLElement | null = element; node; node = node.parentElement) {
          const style = styleOf(node);
          if (style.display === 'none' || style.visibility === 'hidden' || node.getAttribute('aria-hidden') === 'true') { visible = false; break; }
          if (node !== element && /(auto|scroll|hidden)/.test(style.overflow + style.overflowX + style.overflowY)) {
            const bounds = boundsOf(node);
            const skipHorizClip = node === strip;
            if (rect.bottom <= bounds.top || rect.top >= bounds.bottom || (!skipHorizClip && (horizRight <= bounds.left || horizLeft >= bounds.right))) { visible = false; break; }
          }
        }
        if (!cleanDeckNav && !visible) return;
        const kind = element.dataset.creationKind as CreationControl['kind'];
        const field = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element :
          kind === 'text' ? element.querySelector<HTMLInputElement | HTMLTextAreaElement>('input:not([type=hidden]),textarea:not([aria-hidden=true])') : null;
        const disabled = element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true'
          || element.dataset.creationBlocked === 'true' || (!cleanDeckNav && styleOf(element).pointerEvents === 'none')
          || Boolean(field?.readOnly || field?.disabled);
        const hit = cleanDeckNav ? element : creationControlHit(element, kind, disabled);
        // MUI disabled buttons use pointer-events:none, so their uncovered parent
        // receives the hit. Keep their disabled reason in the observed snapshot.
        const disabledOwnerHit = disabled && Boolean(hit?.contains(element));
        if (!hit || (!element.contains(hit) && !disabledOwnerHit) ||
          (!disabledOwnerHit && kind !== 'scroll' && hit.closest('[data-creation-control]') && hit.closest('[data-creation-control]') !== element)) return;
        controls.push({ ownerId: element.closest<HTMLElement>('[data-creation-owner]')?.dataset.creationOwner || publisherSource, controlId: element.dataset.creationControl!, actionId: element.dataset.aiAction!,
          activation: element.dataset.aiActivation === 'pointerdown' ? 'pointerdown'
            : element.getAttribute('role') === 'combobox' ? 'mousedown' : 'click',
          label: (element.dataset.creationLabel || '').slice(0, 120), handlerRef: element.dataset.creationHandler!,
          ...(element.dataset.creationDescription ? { description: element.dataset.creationDescription.slice(0, 180) } : {}),
          kind, policy: element.dataset.creationPolicy as CreationControl['policy'], enabled: !disabled,
          ...(disabled ? { disabledReason: element.dataset.creationDisabledReason || 'Mounted control is disabled or read-only' } : {}),
          ...(field ? { valueLength: field.value.length, valueHint: field.value.slice(0, 160), valueRevision: creationValueRevision(field.value) } : {}),
          ...(field instanceof HTMLInputElement && ['range', 'number'].includes(field.type) ? {
            inputType: field.type, step: field.step || '1',
            ...((field.getAttribute('aria-valuemin') ?? field.getAttribute('min')) != null ? { minimum: Number(field.getAttribute('aria-valuemin') ?? field.min) } : {}),
            ...((field.getAttribute('aria-valuemax') ?? field.getAttribute('max')) != null ? { maximum: Number(field.getAttribute('aria-valuemax') ?? field.max) } : {}),
          } : {}),
          ...(element.hasAttribute('aria-pressed') ? { selected: element.getAttribute('aria-pressed') === 'true' } : {}),
          ...(kind === 'scroll' ? { axis: element.scrollHeight > element.clientHeight + 1 ? 'vertical' as const : 'horizontal' as const,
            canScrollBackward: element.scrollTop > 1 || element.scrollLeft > 1,
            canScrollForward: element.scrollTop + element.clientHeight < element.scrollHeight - 1 || element.scrollLeft + element.clientWidth < element.scrollWidth - 1 } : {}),
        });
      });
      const boundedState = Object.fromEntries(Object.entries(JSON.parse(latestStateKey.current))
        .filter(([key]) => deckEnabled || !['storyboardView', 'deckSceneKey', 'deckModeDestination'].includes(key))
        .map(([key, value]) => [key,
        typeof value === 'string' ? value.slice(0, 160) : value])) as CreationArea['state'];
      if (controls.length || areaId === PRECISE_CREATION_AREA_ID) measurements.set(publisherSource, { areaId, source: publisherSource,
        state: areaId === PRECISE_CREATION_AREA_ID ? preciseCreationState(boundedState)
          : { ...boundedState, stateRevision: creationValueRevision(JSON.parse(latestStateKey.current)) }, controls });
      else measurements.delete(publisherSource);
      if (!collecting) commitArea(areaId, dispatch);
    };
    // Geometry reads and Redux snapshots are background metadata, not part of
    // typing. All mounted trackers wait for a pause, including mutations caused
    // by textarea autosizing. Never unregister the area on a text-state change.
    const schedule = () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      if (idle) cancelIdleCallback(idle);
      frame = idle = 0;
      timer = setTimeout(() => {
        timer = undefined;
        // Background bookkeeping must not occupy a frame needed for input or
        // paint. AI observations below still measure and publish immediately.
        if (typeof requestIdleCallback === 'function') idle = requestIdleCallback(publish, { timeout: 500 });
        else frame = requestAnimationFrame(publish);
      }, 180);
    };
    scheduleRef.current = schedule;
    const selector = `[data-creation-control][data-creation-area="${areaId}"]`;
    const relevantNode = (node: Node) => {
      const element = node instanceof Element ? node : node.parentElement;
      return Boolean(element && (element.matches(selector) || element.closest(selector) || element.querySelector(selector)));
    };
    const scheduleMutation = (records: MutationRecord[]) => {
      if (timer !== undefined || frame || idle) return;
      // A moving WebGL canvas, unrelated text, and another area's animations
      // do not change this area's controls. Ancestor/portal changes still do.
      if (records.some(record => relevantNode(record.target) || [...record.removedNodes].some(relevantNode))) schedule();
    };
    const flush = () => { clearTimeout(timer); timer = undefined; cancelAnimationFrame(frame); if (idle) cancelIdleCallback(idle); idle = 0; publish(); };
    publishers.add(flush);
    const observer = new MutationObserver(scheduleMutation);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    // Scrolling changes the visible snapshot, not the editor's render state.
    // AI requests/actions call flushCreationControls for current hit/scroll
    // facts; do not turn normal scrolling into background Redux publications.
    // Exception: while a Concierge Auto Control task is active, its two-second
    // gate compares the CACHED snapshot key (visible controls, canScroll*).
    // Keep that cache fresh after scrolls only during such a task.
    const scheduleScroll = () => {
      const settings = store.getState().settings;
      if (settings.autoControlEnabled && settings.conciergeEnabled && getAutoControlTask()) schedule();
    };
    document.addEventListener('scroll', scheduleScroll, { capture: true, passive: true });
    document.addEventListener('input', schedule, true);
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      publishers.delete(flush);
      scheduleRef.current = null;
      observer.disconnect(); clearTimeout(timer); cancelAnimationFrame(frame); if (idle) cancelIdleCallback(idle);
      document.removeEventListener('scroll', scheduleScroll, true);
      document.removeEventListener('input', schedule, true);
      window.removeEventListener('resize', schedule);
      measurements.delete(publisherSource);
      commitArea(areaId, dispatch);
    };
  }, [dispatch, area, publisherSource, active, ownerRef]);
}
