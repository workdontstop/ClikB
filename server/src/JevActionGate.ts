import { consultJev, type JevConsultation, type JevDiagnosticEvent } from './JevDecisionService';
import { CREATION_AUTONOMY_RULES } from './CreationExecutionContext';
import { isFeedsTextAction } from './FeedsExecutionContext';
import { navigationTextLimit } from './NavigationTextActions';

export type JevControlledOperation =
  | { kind: 'click'; actionId: string; controlId: string; targetId?: number | string }
  | { kind: 'text'; actionId: string; controlId: string; text: string }
  | { kind: 'scroll'; scrollId: string; direction: 'forward' | 'backward' };

export type JevProposedOperation = JevControlledOperation | { kind: 'snapshot' };

type JevResult = Awaited<ReturnType<typeof consultJev>>;
type Consult = (input: JevConsultation, snapshot: any) => Promise<JevResult>;

const actionName = (operation: JevControlledOperation) => operation.kind === 'click'
  ? operation.actionId : operation.kind === 'text' ? operation.actionId
    : `scroll:${operation.scrollId}:${operation.direction}`;

const readableName = (id: string) => id.split('.').pop()?.replace(/_/g, ' ') || id;
const physicalScrollDirection = (axis: unknown, direction: 'forward' | 'backward') =>
  axis === 'horizontal' ? (direction === 'forward' ? 'right' : 'left')
    : (direction === 'forward' ? 'down' : 'up');

/** Select the target's state and exact control before broad lists can hit Jev's per-fact bound. */
export const creationJevEvidencePointers = (snapshot: any, actionId: string): string[] => {
  const pointers = ['/autoControl', '/creation/stage', '/creation/mode', '/creation/modeSelectionRequired',
    '/creation/goBlockedReason', '/creation/isGenerating', '/creation/status'];
  for (const [areaId, area] of Object.entries(snapshot?.creation?.controls?.areas || {}) as Array<[string, any]>) {
    const index = (area?.controls || []).findIndex((control: any) => control.actionId === actionId);
    if (index < 0) continue;
    const path = `/creation/controls/areas/${areaId.replace(/~/g, '~0').replace(/\//g, '~1')}`;
    pointers.push(`${path}/state`, `${path}/controls/${index}`);
    break;
  }
  return pointers;
};

/** Give every gate the target's own facts, rather than the first entries in a
 * potentially long navigation/feed list. Person identity and post identity matter. */
export const operationJevEvidencePointers = (snapshot: any, actionId: string): string[] => {
  if (actionId.startsWith('clikb.creation.')) return creationJevEvidencePointers(snapshot, actionId);
  const root = actionId.startsWith('clikb.feeds.') ? 'feeds' : 'navigation';
  const surface = snapshot?.[root];
  const pointers = ['/autoControl', `/${root}/route`, `/${root}/activeAreaIds`];
  const action = surface?.availableActions?.find((item: any) => item.actionId === actionId);
  const index = surface?.visibleControls?.findIndex((item: any) => item.candidateActionId === actionId) ?? -1;
  const control = index >= 0 ? surface.visibleControls[index] : undefined;
  const areaId = control?.areaId || actionId.split(':')[0];
  const area = surface?.areas?.[areaId];
  if (area) {
    const path = `/${root}/areas/${String(areaId).replace(/~/g, '~0').replace(/\//g, '~1')}`;
    pointers.push(`${path}/state`);
    const scrollKey = actionId.split(':')[1];
    if (scrollKey && area.scrolls?.[scrollKey]) pointers.push(`${path}/scrolls/${scrollKey.replace(/~/g, '~0').replace(/\//g, '~1')}`);
    for (const key of ['visiblePosts', 'collectionPosts', 'visiblePostRefs']) {
      const postIndex = area[key]?.findIndex((item: any) => String(item.postId) === String(action?.targetId)) ?? -1;
      if (postIndex >= 0) { pointers.push(`${path}/${key}/${postIndex}`); break; }
    }
  }
  if (index >= 0) pointers.push(`/${root}/visibleControls/${index}`);
  const actionIndex = surface?.availableActions?.findIndex((item: any) => item.actionId === actionId) ?? -1;
  if (actionIndex >= 0) pointers.push(`/${root}/availableActions/${actionIndex}`);
  pointers.push('/lastGuideCall');
  return pointers;
};

export const describeClick = (actionId: string, snapshot: any): string => {
  if (actionId.startsWith('clikb.creation.')) {
    const area = Object.values(snapshot?.creation?.controls?.areas || {}).find((item: any) =>
      item?.controls?.some((control: any) => control.actionId === actionId)) as any;
    const control = area?.controls?.find((item: any) => item.actionId === actionId);
    return `Click ${String(control?.label || readableName(actionId)).slice(0, 120)} in ${String(area?.areaId || 'creation').replace(/^clikb\./, '').replace(/\./g, ' ')}.${control?.policy === 'requires_video' ? ` Requires Auto Control and Video permission (Video is ${snapshot?.autoControl?.videoEnabled ? 'On' : 'Off'}).` : control?.policy === 'needs_confirmation' ? ' Requires explicit confirmation.' : ''} Handler: ${String(control?.handlerRef || '').slice(0, 100)}.`;
  }
  const surface = actionId.startsWith('clikb.feeds.') ? snapshot?.feeds : snapshot?.navigation;
  const action = (surface?.availableActions || []).find((item: any) => item.actionId === actionId);
  const control = (surface?.visibleControls || []).find((item: any) =>
    item.controlId === action?.controlId && item.candidateActionId === actionId);
  const name = actionId.startsWith('clikb.feeds.deck.action.jump_to.')
    ? 'bring post to center' : readableName(String(action?.controlId || actionId));
  const area = control?.areaId ? String(control.areaId).replace(/^clikb\./, '').replace(/\./g, ' ') : 'current app';
  const handler = control?.handlerRef ? ` Handler: ${String(control.handlerRef).slice(0, 100)}.` : '';
  const target = action?.targetId != null ? ` Target: ${String(action.targetId).slice(0, 80)}.` : '';
  const confirmation = action?.requiresConfirmation ? ' Requires explicit target confirmation.' : '';
  const owner = surface?.areas?.[control?.areaId];
  const post = [...(owner?.visiblePosts || []),
    ...(snapshot?.autoControl?.enabled === true ? owner?.collectionPosts || [] : [])]
    .find((item: any) => String(item.postId) === String(action?.targetId));
  const ref = owner?.visiblePostRefs?.find((item: any) => String(item.postId) === String(action?.targetId));
  const label = control?.label || post?.metadata?.title || ref?.labelHint || post?.metadata?.captionHint || post?.metadata?.legacyCaptionHint;
  const creator = post?.creator?.username ? ` Creator: @${String(post.creator.username).replace(/^@/, '').slice(0, 48)}.` : '';
  const snippet = post?.metadata?.promptHint || post?.metadata?.captionHint || post?.metadata?.overviewHint || '';
  const extraSnippet = snippet && (!label || !String(label).includes(String(snippet).slice(0, 32)))
    ? ` Content: ${String(snippet).slice(0, 120)}.` : '';
  const content = label ? ` Post: ${String(label).slice(0, 120)}.${creator}${extraSnippet}` : `${creator}${extraSnippet}`;
  // Put meaning before implementation detail: Jev bounds each option description.
  return `Click ${name} in ${area}.${content}${target}${confirmation}${handler}`;
};

/** Jev reads the concierge proposal as context and chooses from live browser actions. */
export const chooseJevProposedOperation = async (
  input: { userGoal: string; proposal: string; snapshot: any; onDiagnostic?: (event: JevDiagnosticEvent) => void },
  consult: Consult = consultJev,
): Promise<{ status: 'selected' | 'declined' | 'unavailable'; choice?: string; operation?: JevProposedOperation; reason: string }> => {
  const liveChoices = new Map<string, JevProposedOperation>();
  const descriptions: Record<string, string> = {};
  let proposal: any = null;
  try { proposal = JSON.parse(input.proposal); } catch { /* A prose proposal is still valid context. */ }
  const suggestedId = typeof proposal?.suggestedActionId === 'string'
    ? proposal.suggestedActionId
    : /^(?:scroll:)?clikb\./.test(input.proposal.trim()) ? input.proposal.trim() : '';
  for (const action of [...(input.snapshot?.navigation?.availableActions || []), ...(input.snapshot?.feeds?.availableActions || [])]) {
    const id = String(action?.actionId || '');
    if (!id || liveChoices.has(id)) continue;
    if (action.kind === 'text') {
      const limit = isFeedsTextAction(id) ? 500 : navigationTextLimit(id);
      if (id === suggestedId && limit && typeof proposal?.textValue === 'string' && proposal.textValue.length <= limit) {
        liveChoices.set(id, { kind: 'text', actionId: id, controlId: String(action.controlId || ''), text: proposal.textValue });
        descriptions[id] = `Replace the mapped field with ${JSON.stringify(proposal.textValue)}. This types only; submitting is a separate action.`;
      }
      continue;
    }
    liveChoices.set(id, { kind: 'click', actionId: id, controlId: String(action.controlId || ''), targetId: action.targetId });
    descriptions[id] = describeClick(id, input.snapshot);
  }
  for (const [areaId, area] of Object.entries(input.snapshot?.navigation?.areas || {}) as Array<[string, any]>) {
    for (const [key, viewport] of Object.entries(area?.scrolls || {}) as Array<[string, any]>) {
      for (const direction of ['forward', 'backward'] as const) {
        if (!(direction === 'forward' ? viewport?.canScrollForward : viewport?.canScrollBackward)) continue;
        const scrollId = `${areaId}:${key}`;
        const choice = `scroll:${scrollId}:${direction}`;
        liveChoices.set(choice, { kind: 'scroll', scrollId, direction });
        descriptions[choice] = `Scroll ${physicalScrollDirection(viewport.axis, direction)} (${direction}) in ${areaId.replace(/^clikb\./, '').replace(/\./g, ' ')} (${key}).`;
      }
    }
  }
  for (const [areaId, area] of Object.entries(input.snapshot?.feeds?.areas || {}) as Array<[string, any]>) {
    if (!areaId.startsWith('clikb.feeds.viewport.') || area?.state?.hiddenByFullscreen || area?.state?.hiddenByDeck) continue;
    for (const direction of ['forward', 'backward'] as const) {
      if (!(direction === 'forward' ? area?.state?.canScrollForward : area?.state?.canScrollBackward)) continue;
      const scrollId = `${areaId}:feed`;
      const choice = `scroll:${scrollId}:${direction}`;
      liveChoices.set(choice, { kind: 'scroll', scrollId, direction });
      descriptions[choice] = `Scroll ${physicalScrollDirection(area.state.axis, direction)} (${direction}) in the currently visible ${areaId.replace('clikb.feeds.viewport.', '')} feed.`;
    }
  }
  for (const [areaId, area] of Object.entries(input.snapshot?.feeds?.areas || {}) as Array<[string, any]>) {
    const state = area?.state || {};
    const owners = areaId.startsWith('clikb.feeds.fullscreen.') && !state.obscuredByLikes && !state.planOpen && !state.editOpen && !state.deleteConfirmationOpen
      ? [
          { key: 'posts', backward: state.scrollTop > 2, forward: state.scrollTop < state.scrollMax - 2 },
          { key: 'scenes', backward: state.canScrollScenesBackward, forward: state.canScrollScenesForward },
          ...(state.captionExpanded ? [{ key: 'caption', backward: state.captionScrollTop > 2,
            forward: state.captionScrollTop < state.captionScrollMax - 2 }] : []),
        ]
      : areaId === 'clikb.feeds.plan' && !state.zoomOpen
        ? [{ key: 'body', backward: state.scrollTop > 2, forward: state.scrollTop < state.scrollMax - 2 }]
        : [];
    for (const owner of owners) for (const direction of ['forward', 'backward'] as const) {
      if (!(direction === 'forward' ? owner.forward : owner.backward)) continue;
      const scrollId = `${areaId}:${owner.key}`;
      const choice = `scroll:${scrollId}:${direction}`;
      liveChoices.set(choice, { kind: 'scroll', scrollId, direction });
      descriptions[choice] = `Scroll ${physicalScrollDirection(owner.key === 'scenes' ? 'horizontal' : 'vertical', direction)} (${direction}) in the visible ${owner.key} area of ${areaId.replace('clikb.feeds.', '')}.`;
    }
  }
  for (const area of Object.values(input.snapshot?.creation?.controls?.areas || {}) as any[]) {
    for (const control of area?.controls || []) {
      const id = String(control?.actionId || '');
      if (!id.startsWith('clikb.creation.') || !control.enabled || liveChoices.has(id) ||
          control.policy === 'information_only' || control.policy === 'needs_handoff') continue;
      if (control.kind === 'click') {
        liveChoices.set(id, { kind: 'click', actionId: id, controlId: String(control.controlId || '') });
        descriptions[id] = describeClick(id, input.snapshot);
      } else if (control.kind === 'text' && id === suggestedId && typeof proposal?.textValue === 'string' && proposal.textValue.length <= 30000) {
        liveChoices.set(id, { kind: 'text', actionId: id, controlId: String(control.controlId || ''), text: proposal.textValue });
        descriptions[id] = `Set ${String(control.label || readableName(id)).slice(0, 120)} in ${String(area.areaId || 'creation').replace(/^clikb\./, '').replace(/\./g, ' ')} to the proposed text (${proposal.textValue.length} characters; preview: ${JSON.stringify(proposal.textValue.slice(0, 160))}). Handler: ${String(control.handlerRef || '').slice(0, 100)}.`;
      } else if (control.kind === 'scroll') {
        for (const direction of ['forward', 'backward'] as const) {
          if (!(direction === 'forward' ? control.canScrollForward : control.canScrollBackward)) continue;
          const choice = `scroll:${id}:${direction}`;
          liveChoices.set(choice, { kind: 'scroll', scrollId: id, direction });
          descriptions[choice] = `Scroll ${physicalScrollDirection(control.axis, direction)} (${direction}) in ${String(control.label || readableName(id)).slice(0, 120)}.`;
        }
      }
    }
  }
  liveChoices.set('snapshot', { kind: 'snapshot' });
  descriptions.snapshot = 'Observe current app state without changing it.';
  descriptions.no_action = 'No live operation matches the user request and concierge proposal; do not change the app.';
  const listedChoices = [...liveChoices.keys()];
  const orderedChoices = suggestedId && liveChoices.has(suggestedId)
    ? [suggestedId, ...listedChoices.filter(choice => choice !== suggestedId)] : listedChoices;
  const result = await consult({
    question: 'Choose the single live operation that best matches the latest user request and concierge action proposal. Choose no_action only if none matches.',
    kind: 'choice', options: [...orderedChoices.slice(0, 63), 'no_action'], optionDescriptions: descriptions,
    context: JSON.stringify({
      latestUserGoal: input.userGoal,
      conciergeActionProposal: input.proposal,
      currentRoute: input.snapshot?.navigation?.route ?? input.snapshot?.route ?? null,
    }),
    snapshotPointers: operationJevEvidencePointers(input.snapshot, suggestedId.replace(/^scroll:/, '').replace(/:(?:forward|backward)$/, '')),
    controlFrame: { goal: input.userGoal, relevantRagRule: CREATION_AUTONOMY_RULES },
    onDiagnostic: input.onDiagnostic,
  }, input.snapshot);
  if (result.status !== 'ok' || !result.answer || typeof result.answer !== 'object' || !('choice' in result.answer)) {
    return { status: 'unavailable', reason: result.reason || 'Jev action choice was unavailable' };
  }
  const choice = String(result.answer.choice);
  if (choice === 'no_action') return { status: 'declined', choice, reason: 'Jev found no matching live operation' };
  const operation = liveChoices.get(choice);
  return operation ? { status: 'selected', choice, operation, reason: 'Jev selected a live operation' }
    : { status: 'unavailable', reason: 'Jev returned an unknown operation' };
};

const requiredRagId = (operation: JevControlledOperation): string | null => {
  const id = operation.kind === 'scroll' ? operation.scrollId : operation.actionId;
  return id.startsWith('clikb.creation.') ? 'clikb_creation'
    : id.startsWith('clikb.feeds.deck.') || id.startsWith('clikb.feeds.deck:') ? 'clikb_deck'
      : id.startsWith('clikb.feeds.') ? 'clikb_feeds' : 'clikb_navigation_shell';
};

const exactModeSection = (ragContext: string): string => ragContext.split('RAG_TRAINING_MEMORY_STATUS:')[0];
const hasActiveRag = (ragContext: string, ragId: string): boolean =>
  exactModeSection(ragContext).split('\n').some(line => line.trim() === `ACTIVE_SNAPSHOT_MODE_RAG_ID: ${ragId}`);

export const activeRagExcerpt = (ragContext: string, operation: JevControlledOperation): string => {
  const ragId = requiredRagId(operation);
  if (!ragId) return '';
  const marker = `ACTIVE_SNAPSHOT_MODE_RAG_ID: ${ragId}`;
  const activeSection = exactModeSection(ragContext);
  const start = activeSection.indexOf(marker);
  if (start < 0) return '';
  const tail = activeSection.slice(start + marker.length);
  const nextMode = tail.indexOf('ACTIVE_SNAPSHOT_MODE_RAG_ID:');
  const memory = tail.indexOf('RAG_TRAINING_MEMORY_STATUS:');
  const end = [nextMode, memory].filter(index => index >= 0).reduce((min, index) => Math.min(min, index), tail.length);
  const packet = tail.slice(0, end);
  const actionId = operation.kind === 'scroll' ? operation.scrollId : operation.actionId;
  const controlId = operation.kind === 'scroll' ? '' : (operation.controlId || actionId.replace('.action.', '.control.'));
  const lines = packet.split('\n');
  if (!actionId.startsWith('clikb.creation.')) {
    const lowerControl = controlId.toLowerCase();
    const lowerAction = actionId.toLowerCase();
    const rawNeedles = [
      ...(lowerAction === 'clikb.navigation.back.action.back' ? ['shared back: clikb.navigation.back.action.back'] : []),
      ...(lowerAction === 'clikb.feeds.deck.action.cycle_prev' || lowerControl === 'clikb.feeds.deck.control.cycle_prev'
        ? ['clikb.feeds.deck.control.cycle_next / cycle_prev'] : []),
      ...(/^clikb\.feeds\.deck\.(?:control|action)\.(?:run_search|select_search_section|search_section\..+)$/.test(lowerAction)
        ? ['clikb.feeds.deck.control.search_text'] : []),
      lowerControl,
      lowerAction,
      lowerAction.replace(/^(clikb\.navigation\.social_chat\.action\.(?:notification|dismiss|room_open|room_member|reply|post|share|expand|options|start_room|report|block)_)(?:legacy-)?\d+$/, '$1<id>'),
      lowerAction.replace(/^(clikb\.navigation\.creative_profiles_(?:profile|settings|cover)\.action\.(?:profile|delete)_)\d+$/, '$1<id>'),
      lowerAction.replace(/^clikb\.navigation\.creative_profiles_(?:profile|settings|cover)([.:])/, 'clikb.navigation.creative_profiles_<surface>$1').replace(/\.(profile|delete)_\d+$/, '.$1_<id>'),
      lowerControl.replace(/^clikb\.navigation\.relationship_row\.[^.]+\./, 'clikb.navigation.relationship_row.<personid>.'),
      lowerControl.replace(/^clikb\.settings\.(?:control|action)\.(?:accent|color)_(?:dark|light)_[^.]+$/, 'clikb.settings.control.accent_<effectivemode>_<lowercasecolorname>'),
      lowerControl.replace(/^clikb\.feeds\.viewport\.(?:[^.]+\.[^.]+|[^.]+)\.(?:control|action)\.open\.[^.]+$/, 'clikb.feeds.viewport.<instanceid>.control.open.<postid>'),
      lowerAction.replace(/^clikb\.feeds\.viewport\.(?:[^.]+\.[^.]+|[^.]+)\.(?:control|action)\.open\.[^.]+$/, 'clikb.feeds.viewport.<instanceid>.control.open.<postid>'),
      lowerControl.replace(/^clikb\.feeds\.viewport\.(?:[^.]+\.[^.]+|[^.]+)\.(?:control|action)\.creator\.[^.]+$/, 'clikb.feeds.viewport.<instanceid>.control.creator.<postid>'),
      lowerAction.replace(/^clikb\.feeds\.viewport\.(?:[^.]+\.[^.]+|[^.]+)\.(?:control|action)\.creator\.[^.]+$/, 'clikb.feeds.viewport.<instanceid>.control.creator.<postid>'),
      lowerAction.replace(/^clikb\.feeds\.context\.(?:[^.]+\.[^.]+|[^.]+)\./, 'clikb.feeds.context.<instanceid>.'),
      lowerAction.replace(/^clikb\.feeds\.fullscreen\.(?:[^.]+\.[^.]+|[^.]+):posts$/, 'clikb.feeds.fullscreen.<instanceid>.scroll_posts'),
      lowerAction.replace(/^clikb\.feeds\.fullscreen\.(?:[^.]+\.[^.]+|[^.]+):scenes$/, 'clikb.feeds.fullscreen.<instanceid>.scroll_scenes'),
      lowerAction.replace(/^clikb\.feeds\.fullscreen\.(?:[^.]+\.[^.]+|[^.]+):caption$/, 'clikb.feeds.fullscreen.<instanceid>.expand_caption'),
      lowerAction.replace(/^clikb\.feeds\.plan:body$/, 'clikb.feeds.plan.close'),
      lowerAction.replace(/^clikb\.feeds\.fullscreen\.(?:[^.]+\.[^.]+|[^.]+)\.(?:like_post|open_likes|open_likes_count|cancel_delete|close_deleted)$/, 'clikb.feeds.fullscreen.<instanceid>.open_plan'),
      lowerAction.replace(/^clikb\.feeds\.fullscreen\.(?:[^.]+\.[^.]+|[^.]+)\.(?:collapse_caption|creator_profile)$/, 'clikb.feeds.fullscreen.<instanceid>.expand_caption'),
      lowerAction.replace(/^clikb\.feeds\.fullscreen\.(?:[^.]+\.[^.]+|[^.]+)\./, 'clikb.feeds.fullscreen.<instanceid>.'),
      lowerControl.replace(/^clikb\.feeds\.deck\.(?:control|action)\.jump_to\.[^.]+$/, 'clikb.feeds.deck.control.jump_to.<postid>'),
      lowerAction.replace(/^clikb\.feeds\.deck\.(?:control|action)\.jump_to\.[^.]+$/, 'clikb.feeds.deck.control.jump_to.<postid>'),
      lowerControl.replace(/^clikb\.feeds\.deck\.(?:control|action)\.category\.[^.]+$/, 'clikb.feeds.deck.control.category.'),
      lowerControl.replace(/^clikb\.feeds\.deck\.(?:control|action)\.search_section\.[^.]+$/, 'clikb.feeds.deck.control.search_text'),
      lowerAction.replace(/^clikb\.feeds\.video\.[^.]+$/, 'clikb.feeds.video.toggle_play_pause'),
      lowerAction.replace(/^clikb\.feeds\.likes\.[^.]+$/, 'clikb.feeds.likes.close'),
      lowerAction.replace(/^clikb\.feeds\.plan\.(?:open_media_[^.]+|close_zoom)$/, 'clikb.feeds.plan.open_media_<id>'),
      lowerAction.replace(/^clikb\.feeds\.plan\.[^.]+$/, 'clikb.feeds.plan.close'),
      lowerAction.replace(/^clikb\.feeds\.search\.[^.]+$/, 'clikb.feeds.search.search_field'),
      lowerAction.replace(/^clikb\.feeds\.search_keywords\.[^.]+$/, 'clikb.feeds.search_keywords.home'),
      lowerAction.replace(/^clikb\.feeds\.hotspot\.[^.]+$/, 'clikb.feeds.hotspot.tap_<branch>'),
      lowerAction.replace(/^clikb\.feeds\.swipe\.[^.]+$/, 'clikb.feeds.swipe.swipe_left'),
      lowerAction.replace(/^clikb\.feeds\.spatial\.[^.]+$/, 'clikb.feeds.spatial.open_settings'),
      lowerAction.replace(/^clikb\.feeds\.viewport\.[^:]+:feed$/, 'clikb.feeds.viewport.<instanceid>:feed'),
      ...(operation.kind === 'scroll' && !lowerAction.startsWith('clikb.feeds.')
        ? ['an area may publish scrolls keyed by its actual owner surface', 'scroll']
        : operation.kind === 'scroll' ? ['scroll'] : []),
    ].filter(Boolean);
    for (const candidateNeedle of rawNeedles) {
      const exact = lines.find(line => line.toLowerCase().includes(candidateNeedle));
      if (exact) return exact.trim().slice(0, 650);
    }
  } else if (operation.kind !== 'scroll' && controlId) {
    const exact = lines.find(line => line.toLowerCase().includes(controlId.toLowerCase()));
    if (exact) return exact.trim().slice(0, 650);
  }
  const area = actionId.match(/^clikb\.creation\.(.+?)\.action\./)?.[1];
  const rawKey = decodeURIComponent(actionId.split('.action.').pop() || '').toLowerCase();
  const key = area === 'world_detail' ? rawKey.replace(/_world_\d+(?=_|$)/, '_world_<worldid>')
    .replace(/_character_\d+$/, '_character_<assetid>')
    : area === 'worlds' ? rawKey.replace(/^((?:open|request_delete|cancel_delete|delete)_)\d+$/, '$1<worldid>')
      .replace(/^page_[a-z]+_\d+$/, 'page_<itemtype>_<pagenumber>')
    : area === 'storybook_world' ? rawKey.replace(/^add_(?:character|environment|object)$/, 'add_<kind>')
      .replace(/^((?:asset|remove)_)(?:\d+|[0-9a-f-]{36})$/, '$1<assetid>')
      .replace(/^reference_\d+$/, 'reference_<index>')
    : rawKey;
  const keyParts = key.split('_');
  const keyPrefixes = keyParts.length > 1
    ? keyParts.slice(0, -1).map((_, i) => `${keyParts.slice(0, keyParts.length - 1 - i).join('_')}_<`)
    : [];
  const proseArea = !area ? ''
    : ['workstation_action_image', 'workstation_storyboard_image', 'workstation_action_image_viewer'].includes(area) ? 'workstation_video_references'
    : area === 'workstation_gpu_time' ? 'workstation_gpu'
    : area === 'workstation_visual_guide' ? 'workstation_video_guides'
    : area === 'workstation_video_context' && (/frame_history|video_history|restore_video|use_frame|close_frame_preview/.test(key)) ? 'workstation_video_frame_history'
    : area === 'workstation_video' && (/^(?:model_|select_resolution|resolution_|open_generation_mode)/.test(key)) ? 'workstation_video_models'
    : area === 'workstation_video' && (/^(?:mode_|auto_prompt|toggle_duration|toggle_audio)/.test(key)) ? 'workstation_video_guides'
    : area === 'workstation_video' && (/^(?:open_action_image|open_storyboard|show_first_frames|show_canon_scenes|hide_scene_references|first_frame_|canon_scene_)/.test(key)) ? 'workstation_video_references'
    : area === 'workstation_video' && (/^(?:character_|reference_|add_character)/.test(key)) ? 'workstation_video_characters'
    : area === 'workstation_video' && (/^(?:generate_|create_|build_motion_guide|rebuild_motion_guide|retry_motion_export|update_prompt)/.test(key)) ? 'workstation_video_generate_sequence'
    : area;
  const areaLines = area ? lines.filter(line => {
    const trimmed = line.trimStart();
    return trimmed.startsWith(`${area}:`) || (proseArea && trimmed.startsWith(`${proseArea}:`))
      || (area === 'workstation_video' && trimmed.startsWith('workstation_video_'));
  }) : [];
  const exactAreaLines = area ? areaLines.filter(line => line.trimStart().startsWith(`${area}:`)) : [];
  const matchingLine = exactAreaLines.find(line => line.toLowerCase().includes(key))
    || areaLines.find(line => line.toLowerCase().includes(key))
    || exactAreaLines.find(line => keyPrefixes.some(prefix => line.toLowerCase().includes(prefix)))
    || areaLines.find(line => keyPrefixes.some(prefix => line.toLowerCase().includes(prefix)))
    || exactAreaLines.at(-1)
    || areaLines.at(-1)
    || lines.find(line => line.toLowerCase().includes(key.split('.')[0]) && line.trim().length > 0);
  if (!matchingLine) return '';
  // Large control inventories must not lose the requested control's meaning
  // merely because it appears late on the line.
  const lowerLine = matchingLine.toLowerCase();
  const exactPos = lowerLine.indexOf(key);
  const prefixMatch = keyPrefixes.find(prefix => lowerLine.includes(prefix));
  const position = exactPos >= 0 ? exactPos : (prefixMatch ? lowerLine.indexOf(prefixMatch) : -1);
  const offset = position > 250 ? position - 250 : 0;
  const primaryExcerpt = matchingLine.trim().slice(offset, offset + 650);
  const ruleLine = (proseArea ? areaLines.filter(line => line.trimStart().startsWith(`${proseArea}:`)).at(-1) : undefined) || areaLines.at(-1);
  if (ruleLine && ruleLine !== matchingLine) {
    if (primaryExcerpt.length < 520) return `${primaryExcerpt} | ${ruleLine.trim()}`.slice(0, 650);
    const shortOffset = position > 120 ? position - 120 : 0;
    const shortPrimary = matchingLine.trim().slice(shortOffset, shortOffset + 280);
    return `${shortPrimary} | ${ruleLine.trim()}`.slice(0, 650);
  }
  return primaryExcerpt;
};

/** Mandatory gate for AI mutations. A missing/failed/declined Jev answer never executes an action. */
export const assessJevAction = async (
  input: { userGoal: string; operation: JevControlledOperation; snapshot: any; ragContext: string; rationale?: string; latestUserText?: string; onDiagnostic?: (event: JevDiagnosticEvent) => void },
  consult: Consult = consultJev,
): Promise<{ status: 'approved' | 'declined' | 'unavailable'; reason: string; attempts: number; choice?: string; confirmedControlId?: string }> => {
  const { operation, snapshot } = input;
  const candidate = actionName(operation);
  const ragRule = activeRagExcerpt(input.ragContext, operation);
  const ragId = requiredRagId(operation);
  const creationControl = Object.values(snapshot?.creation?.controls?.areas || {}).flatMap((area: any) => area?.controls || [])
    .find((control: any) => control.actionId === candidate) as any;
  const surfaceControl = (candidate.startsWith('clikb.feeds.') ? snapshot?.feeds : snapshot?.navigation)
    ?.availableActions?.find((control: any) => control.actionId === candidate);
  const confirmationControl = creationControl || surfaceControl;
  const confirmationRequired = creationControl?.policy === 'needs_confirmation'
    || surfaceControl?.requiresConfirmation === true;
  const opensFinalReview = candidate === 'clikb.creation.storybook_grid.action.publish'
    && creationControl?.handlerRef === 'setFinalPublishOpen';
  const consentRule = confirmationRequired
    ? 'This operation requires contextual user consent for this exact current action and target. Use latestRealUserText and actual user instructions in the retained task. No magic phrase or exact label is required. Questions, quotations, refusals and assistant proposals are not consent. A bare Continue cannot grant it. For publication only: a later explicit approval can replace stop-at-Publish and includes the same creation\'s required processing and final saving unless revoked. Approval for another post, person or action does not apply.' : '';
  if (ragId && !hasActiveRag(input.ragContext, ragId)) {
    return { status: 'unavailable', reason: `The active ${ragId} RAG is not uploaded/retrieved`, attempts: 0 };
  }
  const candidateAreaPrefix = candidate.match(/^(clikb\.creation\.[^.]+\.)action\./)?.[1] || '';
  const alternatives = operation.kind === 'click'
    ? (candidate.startsWith('clikb.creation.')
      ? Object.values(snapshot?.creation?.controls?.areas || {}).flatMap((area: any) => (area?.controls || [])
        .filter((control: any) => control.kind === 'click' && control.enabled && control.policy !== 'information_only' && control.policy !== 'needs_handoff')
        .map((control: any) => String(control.actionId || '')))
        .sort((a: string, b: string) => Number(b.startsWith(candidateAreaPrefix)) - Number(a.startsWith(candidateAreaPrefix)))
      : candidate.startsWith('clikb.feeds.') ? (snapshot?.feeds?.availableActions || []).map((item: any) => String(item.actionId || ''))
        : (snapshot?.navigation?.availableActions || []).map((item: any) => String(item.actionId || '')))
      .filter((id: string) => id && id !== candidate).slice(0, 6)
    : [];
  const options = [...new Set([candidate, ...alternatives, 'no_action'])].slice(0, 8);
  const optionDescriptions = Object.fromEntries(options.map(option => {
    if (option === 'no_action') return [option, 'Do not perform an app action; the proposed operation is unsupported, unsafe, or does not match the user request.'];
    if (operation.kind === 'click') return [option, describeClick(option, snapshot)];
    if (operation.kind === 'text') return [option, `Replace the text in the mapped field ${operation.controlId}.`];
    return [option, `Scroll ${operation.direction} in ${operation.scrollId}.`];
  }));
  const context = JSON.stringify({
    latestUserGoal: String(input.userGoal || ''),
    proposedOperation: operation,
    rationale: String(input.rationale || '').slice(0, 450),
    currentRoute: snapshot?.navigation?.route ?? snapshot?.route ?? null,
    latestRealUserText: input.latestUserText || '',
    confirmationRequired,
    ...(opensFinalReview ? { actionEffect: 'Opens final publish review only via setFinalPublishOpen. Does not render, upload or publish. An explicit request to click Publish then stop authorizes only opening this review; retain all later processing/save consent checks.' } : {}),
  });
  const consultation: JevConsultation = {
    question: 'Which operation advances the real task in current state? Confirmation controls require contextual user approval for this exact action and target. Stop-at-Publish and bare Continue do not grant it; preserve applicable explicit approval unless revoked. Choose no_action for unsupported action or missing consent.',
    kind: 'choice', options, optionDescriptions, context, onDiagnostic: input.onDiagnostic,
    snapshotPointers: operationJevEvidencePointers(snapshot, candidate.replace(/^scroll:/, '').replace(/:(?:forward|backward)$/, '')),
    controlFrame: {
      goal: String(input.userGoal || ''),
      tentativeActionId: candidate,
      ...(operation.kind === 'click' ? { alternativeActionIds: alternatives } : {}),
      relevantRagRule: `${consentRule}\n${CREATION_AUTONOMY_RULES}\nRetrieved control meaning: ${ragRule}`,
    },
  };
  const result = await consult(consultation, snapshot);
  if (result.status === 'ok' && result.answer && typeof result.answer === 'object' && 'choice' in result.answer) {
    const choice = String(result.answer.choice);
    return choice === candidate
      ? { status: 'approved', reason: 'Jev selected the proposed operation', attempts: 1, choice,
        ...(confirmationRequired ? { confirmedControlId: String(confirmationControl.controlId) } : {}) }
      : { status: 'declined', reason: choice === 'no_action' ? 'Jev selected no_action' : `Jev selected another option: ${choice}`, attempts: 1, choice };
  }
  return { status: 'unavailable', reason: result.reason || 'missing or invalid typed choice', attempts: 1 };
};
