/** Stable meanings live in the Creation RAG; owners publish only current UI facts. */
export const CREATION_SURFACE_ID = 'clikb.creation';
export const CREATION_RAG_DOC_ID = 'clikb_creation';
export const PRECISE_CREATION_AREA_ID = 'clikb.creation.workstation_precise';
export type CreationControl = {
  controlId: string; actionId: string; label: string; handlerRef: string;
  description?: string;
  ownerId?: string;
  valueRevision?: string;
  kind: 'click' | 'text' | 'scroll'; policy: 'candidate' | 'requires_video' | 'needs_confirmation' | 'needs_handoff' | 'information_only';
  enabled: boolean; disabledReason?: string; valueLength?: number; valueHint?: string;
  selected?: boolean; axis?: 'vertical' | 'horizontal'; canScrollForward?: boolean; canScrollBackward?: boolean;
  activation?: 'click' | 'pointerdown' | 'mousedown';
  inputType?: string; minimum?: number; maximum?: number; step?: string;
};
export type CreationArea = {
  areaId: string; source: string; state: Record<string, string | number | boolean | null>;
  controls: CreationControl[];
};
/** Precise is a manual editor. Publish only these compact current facts. */
export function preciseCreationState(state: CreationArea['state']): CreationArea['state'] {
  const count = (value: unknown, maximum: number) => typeof value === 'number' && Number.isFinite(value)
    ? Math.min(maximum, Math.max(0, Math.floor(value))) : 0;
  return {
    model: typeof state.model === 'string' ? state.model.slice(0, 60) : '',
    pixels: typeof state.pixels === 'number' && Number.isFinite(state.pixels) ? count(state.pixels, 1000000000) : null,
    regions: count(state.regions, 80),
    references: count(state.references, 80),
    status: typeof state.status === 'string' ? state.status.slice(0, 40) : 'idle',
  };
}
export type CreationControls = {
  surfaceId: typeof CREATION_SURFACE_ID; surfaceTitle: 'ClikB Creation';
  ragDocId: typeof CREATION_RAG_DOC_ID; schemaVersion: 1; stateVersion: number;
  areas: Record<string, CreationArea>;
};
export const emptyCreationControls = (): CreationControls => ({
  surfaceId: CREATION_SURFACE_ID, surfaceTitle: 'ClikB Creation', ragDocId: CREATION_RAG_DOC_ID,
  schemaVersion: 1, stateVersion: 0, areas: {},
});
/** Put this on the actual button/input/scroll owner, never a synthetic click target. */
export const creationBinding = (area: string, key: string, label: string, handler: string,
  kind: CreationControl['kind'] = 'click', policy: CreationControl['policy'] = 'candidate', description?: string) => ({
  'data-creation-area': `clikb.creation.${area}`,
  'data-creation-control': `clikb.creation.${area}.control.${encodeURIComponent(key)}`,
  'data-ai-action': `clikb.creation.${area}.action.${encodeURIComponent(key)}`,
  'data-creation-label': label,
  ...(description ? { 'data-creation-description': description.slice(0, 180) } : {}),
  'data-creation-handler': handler,
  'data-creation-kind': kind,
  'data-creation-policy': policy,
});
