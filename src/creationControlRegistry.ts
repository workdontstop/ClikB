import type { CreationArea, CreationControl } from './creationControlSnapshot';
import { PRECISE_CREATION_AREA_ID, preciseCreationState } from './creationControlSnapshot';

const OWNER_SCOPED_EQUIVALENT_ACTIONS = new Set([
  'clikb.creation.storybook_start.action.start',
]);

export function isOwnerScopedEquivalentControlGroup(items: CreationControl[]): boolean {
  const first = items[0];
  if (!first || items.length < 2) return false;
  if (!OWNER_SCOPED_EQUIVALENT_ACTIONS.has(first.actionId)) return false;
  if (!first.ownerId) return false;
  return items.every(item =>
    item.ownerId === first.ownerId &&
    item.controlId === first.controlId &&
    item.actionId === first.actionId &&
    item.kind === first.kind &&
    item.handlerRef === first.handlerRef &&
    item.policy === first.policy &&
    item.label === first.label &&
    item.enabled === first.enabled &&
    item.disabledReason === first.disabledReason
  );
}

/** Compose measurements before publishing. Publisher source is lifecycle metadata;
 * executable owner identity is semantic and stays on the control. */
export function effectiveCreationArea(areaId: string, contributions: CreationArea[]): CreationArea | undefined {
  const visible = contributions.filter(item => item.controls.length || areaId === PRECISE_CREATION_AREA_ID).sort((a, b) => a.source.localeCompare(b.source));
  if (!visible.length) return undefined;
  if (areaId === PRECISE_CREATION_AREA_ID) return {
    areaId, source: `registry:${areaId}`, controls: [],
    state: preciseCreationState(visible.length === 1 ? visible[0].state : { status: 'unavailable' }),
  };
  const groups = new Map<string, CreationControl[]>();
  for (const contribution of visible) for (const control of contribution.controls) {
    const items = groups.get(control.controlId) || []; items.push(control); groups.set(control.controlId, items);
  }
  let conflicts = 0;
  const controls = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, items]) => {
    const first = items[0];
    const alias = items.every(item => item.policy === 'information_only' && item.actionId === first.actionId
      && item.kind === first.kind && item.handlerRef === first.handlerRef && item.label === first.label);
    const ownerEquivalent = !alias && isOwnerScopedEquivalentControlGroup(items);
    if (items.length > 1 && !alias && !ownerEquivalent) {
      conflicts++;
      return { ...first, enabled: false, disabledReason: 'target_ambiguous: multiple mounted owners', ownerId: items.map(item => item.ownerId || '').sort().join('|') };
    }
    if (alias) { const { ownerId: _owner, ...information } = first; return information; }
    return first;
  });
  const informational = visible.every(item => item.controls.every(control => control.policy === 'information_only'));
  // Only the repeated entry area declares aggregate informational state.
  const state = areaId === 'clikb.creation.notepad_entry' && informational
    ? { visibleEntryCount: visible.length, anyEditorOpen: visible.some(item => item.state.open === true) }
    : visible.length === 1 ? visible[0].state
    : { registryDiagnostic: 'multiple_authoritative_owners', ownerCount: visible.length };
  const authoritativeConflict = visible.length > 1 && !informational;
  const actionCounts = new Map<string, number>();
  controls.forEach(control => actionCounts.set(control.actionId, (actionCounts.get(control.actionId) || 0) + 1));
  return { areaId, source: `registry:${areaId}`, state: { ...state, visibleControlCount: controls.length,
    controlLimitReached: controls.length > 80, ...(conflicts || authoritativeConflict ? { registryConflicts: conflicts || visible.length } : {}) },
    controls: controls.slice(0, 80).map(control => authoritativeConflict || (actionCounts.get(control.actionId) || 0) > 1 ? { ...control, enabled: false,
      disabledReason: 'target_ambiguous: multiple authoritative owners' } : control) };
}
