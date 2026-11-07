import { consultJev, type JevConsultation, type JevDiagnosticEvent } from './JevDecisionService';
import { activeRagExcerpt, operationJevEvidencePointers, describeClick, type JevControlledOperation } from './JevActionGate';
import { CREATION_AUTONOMY_RULES } from './CreationExecutionContext';

export type VirtualGateIntent = 'app_action_requested' | 'content_or_conversation' | 'clarify';

/** A heartbeat is transport, not a new user instruction. Give Jev the latest
 * real user turn so it can distinguish an active task from a stop or new goal. */
export const activeFullscreenHeartbeatGoal = (messages: unknown): string | null => {
  if (!Array.isArray(messages)) return null;
  const latest = [...messages].reverse().find(message =>
    String(message?.role || '').toLowerCase() === 'user'
    && !String(message?.content || '').trim().startsWith('[Fullscreen heartbeat'));
  const goal = String(latest?.content || '').trim();
  return goal || null;
};

type Consult = typeof consultJev;

/** A structured function call wakes this decision; it never grants permission. */
export const detectVirtualGateIntent = async (
  input: {
    latestUserText: string;
    assistantText: string;
    snapshot: any;
    rationale?: string;
    recentConversation?: Array<{ role: string; content: string }>;
    ongoingAutoControlTask?: boolean;
    operation?: JevControlledOperation;
    ragContext?: string;
    onDiagnostic?: (event: JevDiagnosticEvent) => void;
  },
  consult: Consult = consultJev,
): Promise<{ status: 'ok' | 'unavailable'; intent?: VirtualGateIntent; reason?: string }> => {
  const options: VirtualGateIntent[] = ['app_action_requested', 'content_or_conversation', 'clarify'];
  let operation = input.operation;
  if (!operation) {
    try { operation = JSON.parse(input.assistantText); } catch { /* Older conversational callers have no structured proposal. */ }
  }
  const target = operation?.kind === 'scroll' ? operation.scrollId : operation?.actionId || '';
  const meaning = operation?.kind === 'click' ? describeClick(target, input.snapshot)
    : operation?.kind === 'text' ? `Set the mapped text field ${target}; this does not submit or generate.`
      : operation?.kind === 'scroll' ? `Scroll ${operation.direction} in ${target}.` : input.assistantText.slice(0, 700);
  const consultation: JevConsultation = {
    question: 'Does this operation advance the real user task? Include ordinary intermediate steps such as saving/closing its editor or choosing its model. Use the supplied live control meaning and RAG. A function call is not permission. Respect explicit refusals and publication boundaries; clarify only a genuinely unresolved target.',
    kind: 'choice', options,
    optionDescriptions: {
      app_action_requested: 'The latest real user goal calls for this single concrete app operation now, including the next due step in an active task or question-shaped wording with one clear destination.',
      content_or_conversation: 'The reply only discusses VirtualGate, capability, fictional or quoted actions, or an operation unrelated to the latest real user goal; do not act.',
      clarify: 'The action target is unclear or the reply offers competing destinations; ask the user which one before acting.',
    },
    onDiagnostic: input.onDiagnostic,
    context: JSON.stringify({ proposedOperation: operation?.kind === 'text'
      ? { kind: operation.kind, actionId: operation.actionId, controlId: operation.controlId,
        textLength: operation.text.length, textPreview: operation.text.slice(0, 500) }
      : operation || input.assistantText.slice(0, 700), controlMeaning: meaning,
      ...(input.rationale ? { rationale: String(input.rationale).slice(0, 450) } : {}),
      operationalRules: target.startsWith('clikb.creation.') ? CREATION_AUTONOMY_RULES : undefined,
      retrievedControlMeaning: operation ? activeRagExcerpt(input.ragContext || '', operation) : '',
      latestRealUserGoal: input.latestUserText, ongoingAutoControlTask: input.ongoingAutoControlTask === true,
      recentConversation: input.recentConversation?.slice(-4), currentRoute: input.snapshot?.navigation?.route ?? input.snapshot?.route ?? null }),
    snapshotPointers: operationJevEvidencePointers(input.snapshot, target),
  };
  const decision = await consult(consultation, input.snapshot);
  if (decision.status !== 'ok' || !decision.answer || typeof decision.answer !== 'object' || !('choice' in decision.answer)) {
    return { status: 'unavailable', reason: decision.reason || 'Jev action-intent answer was unavailable' };
  }
  const intent = String(decision.answer.choice) as VirtualGateIntent;
  return options.includes(intent) ? { status: 'ok', intent } : { status: 'unavailable', reason: 'Unknown Jev action intent' };
};
