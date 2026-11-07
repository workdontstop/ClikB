/** Manual editors and their launchers are excluded even if a binding is added accidentally. */
export function isAiControlExcluded(element: Element | null): boolean {
  return Boolean(element?.closest('[data-ai-control-excluded="true"], [data-creation-deck-covered="true"], [data-precise-editor="true"], [data-precise-launch="true"]'));
}

/** Existing dialog backdrops require an exposed point on the container itself,
 * never on the dialog paper or a child control. Other controls use the shared
 * exposed-owner sampling below. */
export function exposedCreationBackdropPoint(element: HTMLElement): { x: number; y: number } | null {
  if (isAiControlExcluded(element)) return null;
  if (element.dataset.creationHitRegion !== 'self') return null;
  const rect = element.getBoundingClientRect();
  const left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right);
  const top = Math.max(0, rect.top), bottom = Math.min(innerHeight, rect.bottom);
  if (right - left < 2 || bottom - top < 2) return null;
  const xs = [left + 1, left + (right - left) / 2, right - 1];
  const ys = [top + 1, top + (bottom - top) / 2, bottom - 1];
  for (const y of ys) for (const x of xs) {
    if (document.elementFromPoint(x, y) === element) return { x, y };
  }
  return null;
}

/** Observation and execution must agree on the exposed part of a mapped owner.
 * A button may cover the centre of its parent; an editor may be partly scrolled.
 * Never substitute a nested mapped button for the requested control. */
export function creationControlHit(element: HTMLElement, kind: string, disabled = false): Element | null {
  if (isAiControlExcluded(element)) return null;
  if (element.dataset.creationHitRegion === 'self') return exposedCreationBackdropPoint(element) ? element : null;
  const rect = element.getBoundingClientRect();
  const strip = element.closest<HTMLElement>('[data-creation-horizontal-strip="true"]');
  const left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right);
  const top = Math.max(0, rect.top), bottom = Math.min(innerHeight, rect.bottom);
  const ownerSelector = element.hasAttribute('data-creation-control') ? '[data-creation-control]' : '[data-ai-action]';
  if (right > left && bottom > top) {
    const xs = [(left + right) / 2, left + Math.min(8, (right - left) / 4), right - Math.min(8, (right - left) / 4)];
    const ys = [(top + bottom) / 2, top + Math.min(8, (bottom - top) / 4), bottom - Math.min(8, (bottom - top) / 4)];
    for (const y of ys) for (const x of xs) {
      const hit = document.elementFromPoint(x, y);
      if (!hit || isAiControlExcluded(hit)) continue;
      if (disabled && hit.contains(element)) return hit;
      if (element.contains(hit) && (kind === 'scroll' || hit.closest(ownerSelector) === element)) return hit;
    }
  }
  if (strip && strip !== element && bottom > top) {
    const stripRect = strip.getBoundingClientRect();
    const sLeft = Math.max(0, stripRect.left), sRight = Math.min(innerWidth, stripRect.right);
    const sTop = Math.max(0, Math.max(stripRect.top, rect.top)), sBottom = Math.min(innerHeight, Math.min(stripRect.bottom, rect.bottom));
    if (sRight > sLeft && sBottom > sTop) {
      const sxs = [(sLeft + sRight) / 2, sLeft + Math.min(12, (sRight - sLeft) / 4), sRight - Math.min(12, (sRight - sLeft) / 4)];
      const sys = [(sTop + sBottom) / 2];
      for (const y of sys) for (const x of sxs) {
        const stripHit = document.elementFromPoint(x, y);
        if (stripHit && !isAiControlExcluded(stripHit) && strip.contains(stripHit)) return element;
      }
    }
  }
  return null;
}
