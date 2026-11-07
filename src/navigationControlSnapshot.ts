/** Shared vocabulary for live navigation contributions to the existing userSnapshot. */
export const NAVIGATION_SURFACE_ID = 'clikb.navigation.shell';
export const NAVIGATION_SURFACE_TITLE = 'ClikB navigation, profile header, and settings';
export const NAVIGATION_RAG_DOC_ID = 'clikb_navigation_shell';
export const NAVIGATION_SCHEMA_VERSION = 4;

export type NavigationAreaId =
  | 'clikb.navigation.back'
  | 'clikb.navigation.menu'
  | 'clikb.navigation.sidebar'
  | 'clikb.navigation.menu_backdrop'
  | 'clikb.navigation.bottom_menu'
  | 'clikb.navigation.toggle'
  | 'clikb.navigation.quick_create'
  | 'clikb.navigation.social_chat'
  | 'clikb.navigation.profile_image'
  | 'clikb.profile_header'
  | 'clikb.navigation.creative_profiles_settings'
  | 'clikb.navigation.creative_profiles_profile'
  | 'clikb.navigation.creative_profiles_cover'
  | 'clikb.navigation.relationships'
  | `clikb.navigation.relationship_row.${number}`
  | 'clikb.settings'
  | 'clikb.navigation.privacy_policy';

export type NavigationControl = {
  controlId: string;
  areaId: NavigationAreaId;
  enabled: boolean;
  disabledReason?: string;
  targetId?: number | string;
  kind?: 'text';
  /** Future selector key, never permission to execute by itself. */
  candidateActionId?: string;
  handlerRef: string;
  aiPolicy: 'candidate' | 'manual_only' | 'needs_handoff' | 'needs_confirmation';
};

export type NavigationAreaSnapshot = {
  areaId: NavigationAreaId;
  /** The component that owns this state and renders these controls. */
  source: string;
  state: Record<string, string | number | boolean | null>;
  visibleControls: NavigationControl[];
  /** Distinct component-owned scroll surfaces; e.g. Settings page and model strip. */
  scrolls?: Record<string, NavigationViewport>;
};

export type NavigationViewport = {
  axis: 'vertical' | 'horizontal';
  region: 'all' | 'start' | 'middle' | 'end';
  canScrollBackward: boolean;
  canScrollForward: boolean;
  /** IDs are rendered and intersect this viewport, not all possible server results. */
  visibleIds: string[];
  offsetBucketPx: number;
  isScrolling: boolean;
  settledAt: number | null;
};

export type NavigationTransitionActor = 'manual' | 'ai' | 'unknown';
export type NavigationTransitionKind = 'route' | 'area' | 'control' | 'entity';
export type NavigationTransitionOutcome = 'succeeded' | 'failed' | 'cancelled' | 'unknown';

export type NavigationTransitionState = {
  route?: string;
  areaId?: NavigationAreaId;
  controlId?: string;
  entityId?: number | string;
  state?: Record<string, string | number | boolean | null>;
};

export type NavigationTransition = {
  eventId: string;
  sequence: number;
  timestamp: number;
  actor: NavigationTransitionActor;
  kind: NavigationTransitionKind;
  before: NavigationTransitionState;
  after: NavigationTransitionState;
  outcome: NavigationTransitionOutcome;
  /** Component/router/API signal that established the outcome. */
  authoritativeSource: string;
  detail?: string;
};

export type NavigationTransitionInput = Omit<NavigationTransition, 'eventId' | 'sequence' | 'timestamp'> & {
  timestamp?: number;
};

export const NAVIGATION_TRANSITION_LIMIT = 30;

export type NavigationControlSnapshot = {
  surfaceId: typeof NAVIGATION_SURFACE_ID;
  surfaceTitle: typeof NAVIGATION_SURFACE_TITLE;
  ragDocId: typeof NAVIGATION_RAG_DOC_ID;
  schemaVersion: typeof NAVIGATION_SCHEMA_VERSION;
  stateVersion: number;
  route: string;
  presentation: 'desktop_open' | 'compact';
  activeAreaIds: NavigationAreaId[];
  areas: Partial<Record<NavigationAreaId, NavigationAreaSnapshot>>;
  visibleControls: NavigationControl[];
  /** Ordered past evidence. Current fields above remain authoritative for now. */
  recentTransitions: NavigationTransition[];
  transitionSequence: number;
  /** Only mounted, enabled, browser-bound controls; never inferred from RAG. */
  availableActions: Array<{ actionId: string; controlId: string; targetId?: number | string; requiresConfirmation?: boolean; kind?: 'text' }>;
};

export const navigationControl = (
  areaId: NavigationAreaId,
  name: string,
  handlerRef: string,
  aiPolicy: NavigationControl['aiPolicy'] = 'candidate',
  enabled = true,
  targetId?: number | string,
  disabledReason?: string,
): NavigationControl => {
  const controlId = `${areaId}.control.${name}`;
  return {
    controlId, areaId, handlerRef, aiPolicy, enabled,
    ...(aiPolicy === 'candidate' || aiPolicy === 'needs_confirmation'
      ? { candidateActionId: `${areaId}.action.${name}` } : {}),
    ...(targetId != null ? { targetId } : {}),
    ...(disabledReason ? { disabledReason } : {}),
  };
};

export const emptyNavigationSnapshot = (): NavigationControlSnapshot => ({
  surfaceId: NAVIGATION_SURFACE_ID,
  surfaceTitle: NAVIGATION_SURFACE_TITLE,
  ragDocId: NAVIGATION_RAG_DOC_ID,
  schemaVersion: NAVIGATION_SCHEMA_VERSION,
  stateVersion: 0,
  route: '/',
  presentation: 'compact',
  activeAreaIds: [],
  areas: {},
  visibleControls: [],
  recentTransitions: [],
  transitionSequence: 0,
  availableActions: [],
});

export const appendNavigationTransition = (
  current: NavigationControlSnapshot,
  input: NavigationTransitionInput,
): NavigationControlSnapshot => {
  const sequence = current.transitionSequence + 1;
  const timestamp = input.timestamp ?? Date.now();
  const event: NavigationTransition = {
    ...input,
    eventId: `${NAVIGATION_SURFACE_ID}:${sequence}:${timestamp}`,
    sequence,
    timestamp,
    before: { ...input.before, state: input.before.state ? { ...input.before.state } : undefined },
    after: { ...input.after, state: input.after.state ? { ...input.after.state } : undefined },
  };
  return {
    ...current,
    transitionSequence: sequence,
    recentTransitions: [...current.recentTransitions, event].slice(-NAVIGATION_TRANSITION_LIMIT),
  };
};

/** Assemble component-owned slices; the coordinator never guesses their controls. */
export const assembleNavigationSnapshot = (
  current: NavigationControlSnapshot,
  context?: Partial<Pick<NavigationControlSnapshot, 'route' | 'presentation'>>,
  area?: NavigationAreaSnapshot,
  removeAreaId?: NavigationAreaId,
): NavigationControlSnapshot => {
  const areas = { ...current.areas };
  if (removeAreaId) delete areas[removeAreaId];
  if (area) areas[area.areaId] = area;
  const activeAreaIds = Object.keys(areas) as NavigationAreaId[];
  const visibleControls = activeAreaIds.flatMap(id => areas[id]?.visibleControls ?? []);
  const next = {
    ...current,
    ...context,
    areas,
    activeAreaIds,
    visibleControls,
    availableActions: current.availableActions.filter(action => visibleControls.some(control =>
      control.controlId === action.controlId && control.candidateActionId === action.actionId && control.enabled && (control.aiPolicy === 'candidate' || control.aiPolicy === 'needs_confirmation'))),
  };
  const comparable = (value: NavigationControlSnapshot) => JSON.stringify({ ...value, stateVersion: 0 });
  return comparable(next) === comparable(current)
    ? current
    : { ...next, stateVersion: current.stateVersion + 1 };
};
