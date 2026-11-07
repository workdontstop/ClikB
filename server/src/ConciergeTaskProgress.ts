import { conciergeForeground } from './ConciergeSnapshotBroker';
import { conciergeBoundaryReached, type ConciergeTaskBoundary } from './ConciergeTaskBoundary';
import { creationWorkRunning, type ConciergeActionEvidence } from './ConciergeRecovery';

/** Main-model projection only. All original receipts remain in Jev/dispatch checks. */
export const decisionActionReceipts = (
  results: ConciergeActionEvidence[],
  sessionReceipts: ConciergeActionEvidence[] = [],
): string => {
  const recentSession = sessionReceipts.slice(-8);
  const recent = results.slice(-6);
  const textEdits = new Map(results.filter(item => (item.operation as any)?.kind === 'text' && item.mutationSent)
    .map(item => [(item.operation as any).actionId, item]));
  const retained = results.filter(item => item.mutationSent && (item.executionScope || ['timeout', 'execution_unknown'].includes(item.status)));
  const combinedSource = [...textEdits.values(), ...retained, ...recentSession, ...recent];
  const unique = new Map(combinedSource.map((item, idx) => [
    item.executionScope || `${idx}:${JSON.stringify(item.operation)}:${item.status}:${item.detail || ''}`,
    item,
  ]));
  const values = [...unique.values()].slice(-10);
  return JSON.stringify(values.map((item, idx) => ({
    operation: (item.operation as any)?.kind === 'text'
      ? { kind: 'text', actionId: (item.operation as any).actionId, characters: String((item.operation as any).text ?? (item.operation as any).textPreview ?? '').length }
      : item.operation,
    status: item.status,
    sent: item.mutationSent === true,
    ...(item.executionScope ? { scope: item.executionScope.slice(0, 12) } : {}),
    ...((item.mutationSent !== true || ['timeout', 'execution_unknown', 'action_blocked', 'jev_declined', 'stale_or_unavailable', 'permission_required', 'rejected'].includes(item.status)) && item.detail
      ? { detail: item.detail.slice(0, 220) } : {}),
    ...(idx === values.length - 1 || item.mutationSent !== true ? { label: item.controlLabel, stage: item.sourceStage } : {}),
  })));
};

export const foregroundCreationAreas = (snapshot: any): any[] => {
  const focus = conciergeForeground(snapshot);
  const measured = snapshot?.conciergeFocus;
  const visible = measured?.kind === 'modal' && Array.isArray(measured.controlIds) ? new Set(measured.controlIds) : undefined;
  return focus.areaIds.filter(id => id.startsWith('clikb.creation.')).map(id => ({ ...focus.groups[id],
    controls: (focus.groups[id].controls || []).filter((control: any) => !visible ||
      [control.actionId, control.candidateActionId, control.controlId].some(key => visible.has(key))) }));
};

/** These native handoffs are decisions, not evidence that a render is running. */
export const readyCreationHandoff = (snapshot: any): boolean => foregroundCreationAreas(snapshot).some(area =>
  (area.controls || []).some((control: any) => control.enabled === true &&
    /^clikb\.creation\.(?:storybook_grid\.action\.(?:start_auto_images|continue_images|next_videos)|storybook_start\.action\.start|storybook_studio_selector\.action\.enter_studio)$/.test(control.actionId)));

export const waitingForCreationChange = (snapshot: any): boolean => creationWorkRunning(snapshot) && !readyCreationHandoff(snapshot);

export const finalCreationHandoff = (actionId: string): boolean =>
  /^clikb\.creation\.(?:storybook_grid\.action\.next_videos|storybook_studio_selector\.action\.enter_studio)$/.test(actionId);

/** Use existing native readiness and foreground controls, never the model's prose. */
export const verifiedPublishDestination = (boundary: ConciergeTaskBoundary | undefined, snapshot: any): boolean => {
  if (!boundary || !conciergeBoundaryReached(boundary, snapshot) || creationWorkRunning(snapshot)) return false;
  const areas = foregroundCreationAreas(snapshot);
  if (areas.some(area => Number(area.state?.remainingPrimaryImages) > 0 ||
      (area.state?.bshotsRequired === true && Number(area.state?.remainingBShotImages) > 0))) return false;
  return areas.some(area => conciergeBoundaryReached(boundary, { creation: { controls: { areas: { current: area } } } }));
};

/** A navigation stopping boundary does not authorise cancelling accepted renders. */
export const imageRunnerStopAllowed = (goal: string, snapshot: any): boolean => {
  const turns = goal.split(/\n(?=(?:User refinement|Current user turn):\s*)/i);
  const explicit = turns.some(turn => /\b(?:stop|cancel|pause|halt|abort)\s+(?:(?:the|all|any|further|new|auto|automatic|current|ongoing|image|video|hd)\s+)*(?:images?|videos?|renders?|rendering|generation|generating|runner|run|queue)\b/i.test(turn)
    || /^(?:(?:User refinement|Current user turn):\s*)?(?:please\s+)?(?:stop|cancel|pause)(?:\s+now)?[.!\s]*$/i.test(turn));
  return explicit || foregroundCreationAreas(snapshot).some(area =>
    ['error', 'generationError', 'autoImageError'].some(key => typeof area.state?.[key] === 'string' && area.state[key].trim()));
};

const INTERMEDIATE_NAVIGATION_OPENER_RE = /^(?:clikb\.navigation\.(?:toggle\.action\.toggle_sidebar|bottom_menu\.action\.menu)|clikb\.feeds\.deck\.action\.(?:select_category|select_search_section))$/;

/**
 * Determine whether a single-step UI/navigation user goal has already arrived at its target
 * in `snapshot`. Crucially decoupled from `creationWorkRunning`: unrelated background rendering
 * must never keep a settled route/Deck/overlay transition stuck in `task_waiting`, while
 * intermediate menu/selector opens must never prematurely complete before reaching the destination.
 */
export const singleStepUiGoalSettled = (
  userGoal: string,
  turnResults: ConciergeActionEvidence[],
  snapshot: any,
): boolean => {
  const goal = String(userGoal || '').trim();
  if (!goal || !Array.isArray(turnResults) || turnResults.length === 0) return false;
  // Never auto-complete a stacked multi-turn creation goal or compound build workflow.
  if (/\n(?:Current user turn|User refinement):/i.test(goal)) return false;
  if (/\b(?:and then|then\s+(?:create|make|generate|build|open|click|select|write|type|search|go|switch|close)|create\s+a\b|make\s+a\b|build\s+a\b|generate\b|render\b|recreate\b|animate\b|stop\s+(?:at|before))\b/i.test(goal)) {
    return false;
  }
  const allValidUiSteps = turnResults.every(item => {
    if (!item.mutationSent || item.executionScope) return false;
    if (!['observed_change', 'settled'].includes(item.status)) return false;
    const op: any = item.operation;
    if (op?.kind === 'scroll') return true;
    const actionId = String(op?.actionId || '');
    if (actionId.startsWith('clikb.navigation.') || actionId.startsWith('clikb.feeds.') || actionId.startsWith('clikb.settings.')) {
      return true;
    }
    if (actionId === 'clikb.creation.styles.action.close_composer' || actionId === 'clikb.creation.toolbar.action.close_composer') {
      return snapshot?.ui?.minimisePrompt === true || snapshot?.creation?.isActive === false;
    }
    if (/^clikb\.creation\.[^.]+\.action\.close$/.test(actionId) && /^\s*(?:please\s+)?(?:close|dismiss|hide|exit)\b/i.test(goal)) {
      return true;
    }
    return false;
  });
  if (!allValidUiSteps) return false;

  const lastOp: any = turnResults.at(-1)?.operation;
  const lastActionId = String(lastOp?.actionId || '');
  if (
    INTERMEDIATE_NAVIGATION_OPENER_RE.test(lastActionId)
    && !/^\s*(?:please\s+)?(?:open|show|toggle|close|hide)\s+(?:the\s+)?(?:menu|sidebar|navigation|categories(?:\s+menu|\s+list)?|search\s+section)\s*[.!?]*$/i.test(goal)
  ) {
    return false;
  }

  const currentRoute = String(snapshot?.route || snapshot?.navigation?.route || '').toLowerCase();
  const deckState = snapshot?.feeds?.areas?.['clikb.feeds.deck']?.state;
  const deckOpen = deckState?.isOpen === true;
  const deckCategory = String(deckState?.activeCategory || '').toLowerCase();
  const actionIds = turnResults.map(item => String((item.operation as any)?.actionId || ''));

  if (
    lastActionId === 'clikb.creation.styles.action.close_composer'
    || lastActionId === 'clikb.creation.toolbar.action.close_composer'
    || /\b(?:close|minimise|minimize|hide|dismiss)\s+(?:the\s+)?(?:composer|prompt|create(?:\s+box|\s+panel)?)\b/i.test(goal)
  ) {
    return (
      actionIds.some(id => id === 'clikb.creation.styles.action.close_composer' || id === 'clikb.creation.toolbar.action.close_composer')
      && (snapshot?.ui?.minimisePrompt === true || snapshot?.creation?.isActive === false)
    );
  }
  if (/\b(?:dark\s*mode|light\s*mode|automatic\s+theme|theme|accent|color|colour|conversation\s+model|switch\s+(?:model\s+)?to\s+(?:luna|sol))\b/i.test(goal)) {
    return actionIds.some(id => id.startsWith('clikb.settings.action.'));
  }
  if (/\b(?:close|exit|leave|dismiss|back\s+from)\b.*\bsettings?\b/i.test(goal)) {
    return currentRoute !== '/settings' && !snapshot?.navigation?.areas?.['clikb.settings'];
  }
  if (/\bsettings?\b/i.test(goal)) {
    return currentRoute === '/settings' || Boolean(snapshot?.navigation?.areas?.['clikb.settings']);
  }
  if (/\b(?:search\s+for|find\s+(?:videos?|shorts?|cinema|games?|posts?))\s+\S+/i.test(goal)) {
    return actionIds.includes('clikb.feeds.deck.action.run_search');
  }
  if (/\bsearch\b/i.test(goal)) {
    return (deckOpen && deckCategory === 'search') || currentRoute === '/search';
  }
  if (/\b(?:games?|interactions?|clikit)\b/i.test(goal)) {
    return currentRoute === '/clikit' || currentRoute.startsWith('/clikit/')
      || (deckOpen && deckCategory === 'games' && deckState?.status !== 'loading');
  }
  if (/\b(?:cinema|kickit)\b/i.test(goal)) {
    return currentRoute === '/kickit' || currentRoute.startsWith('/kickit/')
      || (deckOpen && deckCategory === 'cinema' && deckState?.status !== 'loading');
  }
  if (/\bshorts?\b/i.test(goal)) {
    return currentRoute === '/images' || currentRoute.startsWith('/images/')
      || (deckOpen && deckCategory === 'shorts' && deckState?.status !== 'loading');
  }
  if (/\b(?:all\s+feeds?|home(?:page)?|main\s+feed)\b/i.test(goal)) {
    return (currentRoute === '/' || currentRoute === '/feeds')
      && (!deckOpen || deckCategory === 'all')
      && !snapshot?.navigation?.areas?.['clikb.settings'];
  }
  if (/\b(?:my\s+(?:page|profile)|own\s+profile)\b/i.test(goal)) {
    return currentRoute === '/pages' || currentRoute.startsWith('/pages/');
  }
  if (/\bprivacy(?:\s+policy)?\b/i.test(goal)) {
    return /\b(?:close|dismiss|exit)\b/i.test(goal)
      ? !snapshot?.navigation?.areas?.['clikb.navigation.privacy_policy']
      : Boolean(snapshot?.navigation?.areas?.['clikb.navigation.privacy_policy']);
  }
  if (/\b(?:followers?|following)\b/i.test(goal)) {
    return /\b(?:close|dismiss|exit)\b/i.test(goal)
      ? !snapshot?.navigation?.areas?.['clikb.navigation.relationships']?.state?.listType
      : Boolean(snapshot?.navigation?.areas?.['clikb.navigation.relationships']?.state?.listType);
  }
  if (/\b(?:open\s+create|go\s+to\s+create|open\s+(?:the\s+)?composer)\b/i.test(goal)) {
    return snapshot?.ui?.minimisePrompt === false || snapshot?.creation?.promptOpen === true || snapshot?.creation?.isActive === true;
  }

  return true;
};
