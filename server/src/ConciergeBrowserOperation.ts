import { creationExecutionContext, compareCreationContext, type CreationContext } from './creationControlIdentity';
import { feedsExecutionContext, isFeedsTextAction } from './FeedsExecutionContext';
import { navigationTextLimit } from './NavigationTextActions';
import { creationScrollAllowed, findCreationControl, videoPermissionRequested } from './CreationExecutionContext';
import type { JevControlledOperation } from './JevActionGate';

type BrowserResult = { status: string; snapshot?: any; detail?: string; [key: string]: any };
type Dispatch = (command: 'action' | 'scroll' | 'text', actionId: string | undefined, version: number,
  scrollId?: string, direction?: 'forward' | 'backward', confirmedTargetId?: string | number,
  feedsContext?: string, text?: string, expectedCreationContext?: CreationContext) => Promise<BrowserResult>;

export const conciergeScrollAllowed = (snapshot: any, id: string, direction: 'forward' | 'backward'): boolean => {
  if (id.startsWith('clikb.creation.')) return creationScrollAllowed(snapshot?.creation, id, direction);
  const [areaId, key] = id.split(':');
  if (!id.startsWith('clikb.feeds.')) {
    const viewport = snapshot?.navigation?.areas?.[areaId]?.scrolls?.[key];
    return Boolean(direction === 'forward' ? viewport?.canScrollForward : viewport?.canScrollBackward);
  }
  const state = snapshot?.feeds?.areas?.[areaId]?.state;
  if (!state || state.hiddenByFullscreen || state.hiddenByDeck) return false;
  if (areaId.startsWith('clikb.feeds.viewport.') && key === 'feed') return Boolean(direction === 'forward' ? state.canScrollForward : state.canScrollBackward);
  if (areaId.startsWith('clikb.feeds.fullscreen.') && !state.obscuredByLikes && !state.planOpen && !state.editOpen && !state.deleteConfirmationOpen) {
    if (key === 'posts') return direction === 'forward' ? state.scrollTop < state.scrollMax - 2 : state.scrollTop > 2;
    if (key === 'scenes') return Boolean(direction === 'forward' ? state.canScrollScenesForward : state.canScrollScenesBackward);
    if (key === 'caption' && state.captionExpanded) return direction === 'forward' ? state.captionScrollTop < state.captionScrollMax - 2 : state.captionScrollTop > 2;
  }
  return areaId === 'clikb.feeds.plan' && key === 'body' && !state.zoomOpen &&
    (direction === 'forward' ? state.scrollTop < state.scrollMax - 2 : state.scrollTop > 2);
};

/** A Jev approval is bound to the exact operation and observed version/context. */
export async function executeApprovedConciergeOperation(input: {
  expectedCreationContext?: CreationContext; operation: JevControlledOperation; stateVersion: number; feedsContext: string; latestRealUserText: string; confirmedControlId?: string;
  observe: () => Promise<BrowserResult>; dispatch: Dispatch; cancelled: () => boolean;
}): Promise<BrowserResult> {
  const observation = await input.observe();
  const snapshot = observation.snapshot;
  const reject = (status: string, detail: string, reasonCode = status, diagnostics?: unknown) => ({ status, detail, reasonCode, rejectionPhase: 'server_before_dispatch', diagnostics, snapshot, mutationSent: false });
  if (input.cancelled()) return reject('stopped', 'User interrupted the request');
  if (observation.status !== 'observed') return reject('snapshot_unavailable', 'Execution observation unavailable');
  if (!snapshot?.autoControl?.enabled || snapshot?.autoControl?.conciergeEnabled === false) return reject('permission_required', 'Auto Control or Concierge is Off');
  const operation = input.operation;
  const id = operation.kind === 'scroll' ? operation.scrollId : operation.actionId;
  const creation = id.startsWith('clikb.creation.');
  const feeds = id.startsWith('clikb.feeds.');
  if (id === 'clikb.navigation.back.action.back' && snapshot?.creation?.isActive)
    return reject('rejected', 'Shared Back cannot exit active Creation. Use the exact child Close control.');
  const surface = creation ? snapshot?.creation?.controls : feeds ? snapshot?.feeds : snapshot?.navigation;
  if (creation && input.expectedCreationContext !== undefined) {
    const current = creationExecutionContext(snapshot, id, operation.kind);
    const mismatch = compareCreationContext(input.expectedCreationContext, current);
    if (mismatch) return reject('stale_or_unavailable', 'Relevant Creation context changed after approval; no command sent', mismatch.reasonCode,
      {...mismatch, expected:input.expectedCreationContext, current});
  } else if (feeds ? !input.feedsContext || input.feedsContext !== feedsExecutionContext(surface, id) : surface?.stateVersion !== input.stateVersion)
    return reject('stale_or_unavailable', 'State changed after Jev approval; no command sent', 'version_changed');
  let confirmedTargetId: string | number | undefined;
  if (operation.kind === 'scroll') {
    if (!conciergeScrollAllowed(snapshot, id, operation.direction)) return reject('stale_or_unavailable', 'Scroll owner/direction is no longer available');
  } else {
    const control = creation ? findCreationControl(snapshot?.creation, id) : surface?.availableActions?.find((item: any) => item.actionId === id);
    if (!control || (creation && control.kind !== operation.kind)
      || (creation && operation.controlId !== control.controlId)
      || (!creation && (control.kind ?? 'click') !== operation.kind)
      || (operation.kind === 'text' && !(creation ? operation.text.length <= 30000 :
        feeds ? isFeedsTextAction(id) && operation.text.length <= 500 :
          navigationTextLimit(id) > 0 && operation.text.length <= navigationTextLimit(id))))
      return reject('stale_or_unavailable', 'Exact live control is unavailable', !control ? 'target_missing' : 'operation_mismatch');
    if (creation && control.policy === 'requires_video' && snapshot?.autoControl?.videoEnabled !== true)
      return reject('permission_required', 'Video permission is Off. The user may enable the Video segment or ask Concierge to enable it.');
    if (id === 'clikb.creation.video_permission.action.enable') {
      if (!videoPermissionRequested(input.latestRealUserText)) return reject('permission_required', 'The user must request enabling Video; Concierge cannot enable it to advance its own plan.');
      confirmedTargetId = control.controlId;
    }
    const needsConfirmation = creation ? control.policy === 'needs_confirmation' : control.requiresConfirmation;
    // This target-specific consent is produced by the server's mandatory Jev
    // approval, never by model tool arguments or browser/client input.
    confirmedTargetId ??= creation ? (input.confirmedControlId === control.controlId ? control.controlId : undefined)
      : needsConfirmation && input.confirmedControlId === control.controlId ? control.targetId : undefined;
    if (needsConfirmation && confirmedTargetId == null) return reject('confirmation_required', 'Latest real user turn must explicitly confirm this exact target/action');
  }
  if (input.cancelled()) return reject('stopped', 'User interrupted before dispatch');
  const result = operation.kind === 'scroll'
    ? await input.dispatch('scroll', undefined, surface.stateVersion, id, operation.direction, undefined, input.feedsContext || undefined, undefined, input.expectedCreationContext)
    : await input.dispatch(operation.kind === 'text' ? 'text' : 'action', id, surface.stateVersion, undefined, undefined,
      confirmedTargetId, input.feedsContext || undefined, operation.kind === 'text' ? operation.text : undefined, input.expectedCreationContext);
  // Browser stale/rejected outcomes are before dispatch; timeouts/errors may be after it.
  return { ...result, mutationSent: typeof result.mutationSent === 'boolean' ? result.mutationSent
    : !['stale_or_unavailable', 'rejected', 'stopped', 'permission_required', 'confirmation_required'].includes(result.status) };
}
