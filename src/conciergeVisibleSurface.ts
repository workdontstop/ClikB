import { PRECISE_CREATION_AREA_ID } from './creationControlSnapshot';
import { isAiControlExcluded } from './creationControlHitTest';

/** Model-only foreground metadata. Existing snapshot producers and execution evidence stay intact. */
const identities = new WeakMap<Element, string>();
let sequence = 0;
export function conciergeVisibleSurface(snapshot: any, doc: Document = document) {
  const view = doc.defaultView;
  if (!view) return undefined;
  const candidates = Array.from(doc.querySelectorAll<HTMLElement>('[role="dialog"], [role="alertdialog"], [aria-modal="true"], .MuiModal-root, [data-creation-owner]'))
    .filter(element => {
      const style = view.getComputedStyle(element);
      const box = element.getBoundingClientRect();
      if (element.matches?.('[data-creation-owner]') && !element.matches('[role="dialog"], [role="alertdialog"], [aria-modal="true"], .MuiModal-root')
          && (style.position !== 'fixed' || !element.querySelector('[data-creation-control]'))) return false;
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0
        && !element.closest('[aria-hidden="true"], [data-ai-snapshot-ignore="true"], [data-guide-ui="true"], [data-brainstorm-ui="true"]');
    });
  const z = (element: HTMLElement) => {
    let level = 0;
    for (let node: HTMLElement | null = element; node; node = node.parentElement) {
      level = Math.max(level, Number(view.getComputedStyle(node).zIndex) || 0);
    }
    return level;
  };
  const modal = candidates.map((element, index) => ({ element, index, z: z(element) }))
    .sort((a, b) => a.z - b.z || a.index - b.index).at(-1)?.element;
  if (modal && !identities.has(modal)) identities.set(modal, `modal-${++sequence}`);
  const host = modal || doc;
  // A Dialog's registered dismissal can live on its transition/container,
  // outside the inner role=dialog paper. Include ancestor bindings themselves,
  // never the ancestors' descendants (which could expose covered controls).
  const owners: HTMLElement[] = [];
  if (modal) {
    for (let node: HTMLElement | null = modal; node; node = node.parentElement) {
      if (node !== modal && node.matches?.('[role="dialog"], [role="alertdialog"], [aria-modal="true"]')) break;
      owners.push(node);
      if (node.matches?.('.MuiModal-root')) break;
    }
  }
  const bindingsInScope = (selector: string) => [...new Set([
    ...Array.from(host.querySelectorAll<HTMLElement>(selector)), ...owners.filter(node => node.matches?.(selector)),
  ])].filter(element => !isAiControlExcluded(element));
  const scrollIds = bindingsInScope('[data-ai-scroll]').map(element => element.dataset.aiScroll).filter(Boolean);
  const ids = new Set(bindingsInScope('[data-ai-action], [data-creation-control]')
    .flatMap(element => [element.dataset.aiAction, element.dataset.creationControl]).filter(Boolean));
  const groups: Record<string, any> = { ...(snapshot.navigation?.areas || {}), ...(snapshot.feeds?.areas || {}), ...(snapshot.creation?.controls?.areas || {}) };
  const areaIds = Object.entries<any>(groups).filter(([, area]) => (area.controls || area.visibleControls || [])
    .some((control: any) => [control.actionId, control.candidateActionId, control.controlId].some(id => ids.has(id))))
    .map(([id]) => id);
  if (modal && groups[PRECISE_CREATION_AREA_ID] && (modal.closest('[data-precise-editor="true"]') || modal.querySelector('[data-precise-editor="true"]')))
    areaIds.push(PRECISE_CREATION_AREA_ID);
  const bindings = Object.entries<any>(groups).flatMap(([areaId, area]) => (area.controls || area.visibleControls || [])
    .map((control: any) => ({ ...control, areaId })));
  const textFields: Array<{ areaId?: string; controlId?: string; actionId?: string; label?: string; value: string; mode: string }> = bindingsInScope('[data-template-creator="true"] [data-creation-kind="text"], input[data-ai-action], textarea[data-ai-action], input[data-creation-control], textarea[data-creation-control]')
    .flatMap(owner => {
      const element = typeof (owner as HTMLInputElement).value === 'string'
        ? owner as HTMLInputElement | HTMLTextAreaElement
        : owner.querySelector<HTMLInputElement | HTMLTextAreaElement>('input:not([type=hidden]),textarea:not([aria-hidden=true])');
      if (!element) return [];
      const id = owner.dataset.aiAction || owner.dataset.creationControl;
      const binding = bindings.find((control: any) => [control.actionId, control.candidateActionId, control.controlId].includes(id));
      const rect = element.getBoundingClientRect(), style = view.getComputedStyle(element);
      if (!binding || /ask_text|chat_input/i.test(String(id)) || (/brainstorm/i.test(String(id)) && !owner.closest('[data-template-creator="true"]')) || element.type === 'password'
          || rect.width <= 0 || rect.height <= 0 || style.display === 'none' || style.visibility === 'hidden'
          || element.closest('[aria-hidden="true"]')) return [];
      const hit = doc.elementFromPoint?.(Math.max(0, Math.min(view.innerWidth - 1, rect.left + rect.width / 2)),
        Math.max(0, Math.min(view.innerHeight - 1, rect.top + rect.height / 2)));
      if (hit && hit !== element && !element.contains(hit)) return [];
      return [{ areaId: binding.areaId, controlId: binding.controlId, actionId: binding.actionId || binding.candidateActionId,
        label: binding.label, value: element.value,
        mode: !element.readOnly && !element.disabled && binding.kind === 'text' ? 'editing-draft' : 'displayed-submitted' }];
    });
  // Explicitly mapped read-only detail text is included even alongside editable
  // guidance fields. Catalog cards do not carry this attribute.
  for (const element of Array.from(host.querySelectorAll<HTMLElement>('[data-template-readable]'))) {
    if (!element.dataset.templateReadable || isAiControlExcluded(element)) continue;
    const control = bindings.find(item => item.controlId === element.dataset.creationControl);
    const rect = element.getBoundingClientRect();
    if (!control || !areaIds.includes(control.areaId) || !rect.width || !rect.height ||
        element.closest('[aria-hidden="true"], [data-ai-snapshot-ignore="true"]')) continue;
    textFields.push({ areaId: control.areaId, controlId: control.controlId, actionId: control.actionId,
      label: control.label, value: element.textContent || '', mode: 'displayed-submitted' });
  }
  // Submitted previews often render Typography rather than an input. Read only
  // this foreground modal's displayed text; never scrape the covered page.
  // Chat already publishes bounded, visible message previews and explicitly expanded rows.
  if (modal && !textFields.length && !areaIds.includes('clikb.navigation.social_chat')) {
    const parts: string[] = [];
    const walker = doc.createTreeWalker(modal, 4 /* SHOW_TEXT */);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const element = node.parentElement;
      if (!element || isAiControlExcluded(element) || element.closest('button, input, textarea, select, script, style, svg, [role="button"], [aria-hidden="true"], [data-ai-snapshot-ignore="true"], [data-guide-ui="true"], [data-brainstorm-ui="true"]')) continue;
      const style = view.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || !element.getClientRects().length) continue;
      const value = node.textContent?.trim();
      if (value) parts.push(value);
    }
    if (parts.length) textFields.push({ areaId: areaIds[0], label: 'Visible dialog text (read-only)',
      value: parts.join('\n'), mode: 'displayed-submitted' });
  }
  return { kind: modal ? 'modal' as const : 'page' as const, scopeId: modal ? identities.get(modal)! : 'page', areaIds,
    ...(modal ? { controlIds: [...ids], scrollIds } : {}), textFields };
}
