/** A bounded, optional second opinion for the concierge; never an app executor. */
import { recordJevUsage } from './aiUsageLedger';

export type JevDiagnosticEvent = { consultation: string; stage: string; elapsedMs: number; [key: string]: unknown };

export type JevConsultation = {
  question: string;
  kind: 'choice' | 'boolean' | 'score';
  options?: string[];
  optionDescriptions?: Record<string, string>;
  snapshotPointers?: string[];
  context?: string;
  onDiagnostic?: (event: JevDiagnosticEvent) => void;
  controlFrame?: {
    goal?: string;
    tentativeActionId?: string;
    alternativeActionIds?: string[];
    relevantRagRule?: string;
  };
};

const allowedRoots = new Set(['autoControl', 'route', 'pageName', 'ui', 'app', 'creation', 'navigation', 'feeds', 'lastAction', 'lastActions', 'recentActions', 'lastGuideCall']);
const decodePointer = (pointer: string): string[] | null => {
  if (!pointer.startsWith('/') || pointer.length > 180) return null;
  const parts = pointer.slice(1).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  if (!allowedRoots.has(parts[0]) || parts.some(part => part === '__proto__' || part === 'prototype' || part === 'constructor')) return null;
  return parts;
};

export const selectJevSnapshotFacts = (snapshot: unknown, pointers: unknown): Array<{ pointer: string; value: unknown; status: 'found' | 'unknown' }> => {
  if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(pointers)) return [];
  return [...new Set(pointers.filter((pointer): pointer is string => typeof pointer === 'string'))]
    .slice(0, 12)
    .flatMap(pointer => {
      const parts = decodePointer(pointer);
      if (!parts) return [];
      let value: any = snapshot;
      for (const part of parts) {
        if (!value || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, part)) {
          value = undefined;
          break;
        }
        value = value[part];
      }
      const serialized = value === undefined ? '' : JSON.stringify(value);
      return [{ pointer, value: serialized.length > 1800 ? `${serialized.slice(0, 1800)}...[truncated]` : value ?? null, status: value === undefined ? 'unknown' as const : 'found' as const }];
    });
};

// The provider bounds criterion keys. Truncating a long mapped action ID changes
// its identity and may collide with another control. Alias only on the wire.
const jevOptions = (input: JevConsultation) => {
  const originals = [...new Set((input.options || []).filter(value => typeof value === 'string').map(value => value.trim()).filter(Boolean))].slice(0, 64);
  const reserved = new Set(originals);
  return originals.map((original, index) => {
    let wire = original;
    if (wire.length > 90) {
      wire = `jev_option_${index}`;
      while (reserved.has(wire)) wire += '_';
    }
    reserved.add(wire);
    return { original, wire };
  });
};

export const buildJevDecisionBody = (input: JevConsultation, snapshot: any) => {
  const question = String(input.question || '').trim().slice(0, 350);
  const context = String(input.context || '').trim().slice(0, input.controlFrame ? 64000 : 32000);
  const mappedOptions = jevOptions(input);
  const options = mappedOptions.map(option => option.wire);
  if (!question) throw new Error('Jev question is required');
  if ((input.kind === 'choice' || input.kind === 'score') && options.length < 2) throw new Error('Jev choice/score requires at least two options');
  if (!['choice', 'boolean', 'score'].includes(input.kind)) throw new Error('Unsupported Jev question kind');
  const criteria = input.kind === 'choice'
    ? Object.fromEntries(mappedOptions.map(({ original, wire }) => [wire, String(input.optionDescriptions?.[original] || original).trim().slice(0, 350) || original]))
    : input.kind === 'score' ? options : undefined;
  const questionSpec = {
    type: input.kind === 'boolean' ? 'noul' : input.kind,
    instructions: question,
    ...(criteria ? { criteria } : {}),
  };
  const state = {
    context,
    snapshotObservedAt: typeof snapshot?.timestamp === 'number' ? snapshot.timestamp : null,
    navigationStateVersion: typeof snapshot?.navigation?.stateVersion === 'number' ? snapshot.navigation.stateVersion : null,
    selectedFacts: selectJevSnapshotFacts(snapshot, input.snapshotPointers),
    ...(input.controlFrame ? { controlFrame: (() => {
      const available = Array.isArray(snapshot?.navigation?.availableActions) ? snapshot.navigation.availableActions : [];
      const creationActions = Object.values(snapshot?.creation?.controls?.areas || {}).flatMap((area: any) => area?.controls || []);
      const validIds = new Set([...available, ...(snapshot?.feeds?.availableActions || []), ...creationActions].map((action: any) => String(action.actionId || '')));
      const tentative = String(input.controlFrame?.tentativeActionId || '');
      const strippedScroll = tentative.startsWith('scroll:') ? tentative.replace(/^scroll:/, '').replace(/:(?:forward|backward)$/, '') : '';
      const isValidTentative = validIds.has(tentative)
        || (Boolean(strippedScroll) && (validIds.has(strippedScroll)
          || strippedScroll.startsWith('clikb.navigation.')
          || strippedScroll.startsWith('clikb.feeds.')));
      const alternatives = Array.isArray(input.controlFrame?.alternativeActionIds)
        ? input.controlFrame.alternativeActionIds.filter((id): id is string => typeof id === 'string' && validIds.has(id)).slice(0, 8) : [];
      return {
        goal: String(input.controlFrame?.goal || '').slice(0, 30000),
        tentativeActionId: isValidTentative ? tentative : null,
        alternativeActionIds: alternatives,
        relevantRagRule: String(input.controlFrame?.relevantRagRule || '').slice(0, 2400),
        current: { route: snapshot?.navigation?.route || null, surfaceId: snapshot?.navigation?.surfaceId || null, stateVersion: snapshot?.navigation?.stateVersion ?? null },
        recentTransitions: Array.isArray(snapshot?.navigation?.recentTransitions)
          ? snapshot.navigation.recentTransitions.slice(-6).map((event: any) => ({ sequence: event.sequence, actor: event.actor, before: event.before, after: event.after, outcome: event.outcome })) : [],
      };
    })() } : {}),
  };
  const body = { model: 'typesafe/jev-1.13', state, questions: { consultation: questionSpec } };
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > (input.controlFrame ? 128_000 : 64_000)) throw new Error('Jev consultation is too large');
  return body;
};

export const consultJev = async (input: JevConsultation, snapshot: any): Promise<{ status: 'ok' | 'unavailable'; answer?: unknown; reason?: string }> => {
  const consultation = input.controlFrame ? 'action_approval' : 'action_intent';
  const startedAt = Date.now();
  const log = (stage: string, detail: Record<string, unknown> = {}) => {
    const event = { consultation, stage, elapsedMs: Date.now() - startedAt, ...detail };
    console.info('[JevDecision]', JSON.stringify(event));
    try { input.onDiagnostic?.(event); } catch { /* Diagnostics must not interrupt the Jev request. */ }
  };
  const key = process.env.JEV_API_KEY;
  if (!key) {
    log('unavailable', { reason: 'missing_api_key' });
    return { status: 'unavailable', reason: 'Jev is not configured' };
  }
  let body: ReturnType<typeof buildJevDecisionBody>;
  try { body = buildJevDecisionBody(input, snapshot); }
  catch {
    log('unavailable', { reason: 'invalid_consultation' });
    return { status: 'unavailable', reason: 'Invalid bounded consultation' };
  }
  try {
    const endpoint = 'https://openrouter.ai/api/alpha/decisions';
    log('request_shape', {
      model: body.model,
      questionType: body.questions.consultation.type,
      optionCount: input.options?.length || 0,
      selectedFactCount: body.state.selectedFacts.length,
      payloadBytes: Buffer.byteLength(JSON.stringify(body), 'utf8'),
      requestBody: body,
    });
    log('request_started', { attempt: 1 });
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const header = (name: string) => response.headers.get(name)?.slice(0, 120) || null;
    log('http_response', {
      attempt: 1,
      status: response.status,
      retryAfter: header('retry-after'),
      requestId: header('x-request-id') || header('x-vercel-id'),
    });
    if (!response.ok) {
      let errorCode: string | null = null;
      let errorType: string | null = null;
      let errorMessage: string | null = null;
      try {
        const errorBody = await response.json() as any;
        const safeToken = (value: unknown) => typeof value === 'string' && /^[a-zA-Z0-9_.-]{1,80}$/.test(value) ? value : null;
        errorCode = safeToken(errorBody?.error?.code ?? errorBody?.code);
        errorType = safeToken(errorBody?.error?.type ?? errorBody?.type);
        errorMessage = typeof (errorBody?.error?.message ?? errorBody?.message) === 'string'
          ? String(errorBody?.error?.message ?? errorBody?.message).slice(0, 500) : null;
      } catch { /* Gateway may return non-JSON errors; never log its raw body. */ }
      log('unavailable', { reason: 'http_error', status: response.status, errorCode, errorType, errorMessage });
      return { status: 'unavailable', reason: `Jev HTTP ${response.status}` };
    }
    const result: any = await response.json();
    const answer = result?.answers?.consultation ?? result?.result?.answers?.consultation;
    recordJevUsage(result, {
      consultation,
      elapsedMs: Date.now() - startedAt,
      payloadBytes: Buffer.byteLength(JSON.stringify(body), 'utf8'),
      estimatedInputTokens: Math.ceil(Buffer.byteLength(JSON.stringify(body), 'utf8') / 4),
      provider: result?.provider ?? 'openrouter',
    });
    log('response_received', {
      responseId: result?.id ?? null,
      model: result?.model ?? null,
      provider: result?.provider ?? null,
      answer: answer ?? null,
      usage: result?.usage ?? null,
    });
    if (!answer || typeof answer !== 'object') {
      log('unavailable', { reason: 'answer_missing' });
      return { status: 'unavailable', reason: 'Jev answer was missing' };
    }
    if (input.kind === 'choice') {
      const rawChoice = String(answer.choice || '');
      const chosen = jevOptions(input).find(option => option.wire === rawChoice)?.original || rawChoice;
      if (!(input.options || []).includes(chosen)) {
        log('unavailable', { reason: 'unknown_choice' });
        return { status: 'unavailable', reason: 'Jev returned an unknown choice' };
      }
      log('answered', { choice: chosen });
      return { status: 'ok', answer: { type: 'choice', choice: chosen, confidence: Number.isFinite(answer.confidence) ? answer.confidence : null, probabilities: answer.probabilities || null } };
    }
    if (input.kind === 'boolean' && typeof answer.noul === 'number' && answer.noul >= 0 && answer.noul <= 1) {
      log('answered', { answerType: 'boolean' });
      return { status: 'ok', answer: { type: 'boolean', probability: answer.noul } };
    }
    if (input.kind === 'score' && typeof answer.score === 'number') {
      log('answered', { answerType: 'score' });
      return { status: 'ok', answer: { type: 'score', score: answer.score, confidence: Number.isFinite(answer.confidence) ? answer.confidence : null, legend: answer.legend || null } };
    }
    log('unavailable', { reason: 'invalid_typed_answer' });
    return { status: 'unavailable', reason: 'Jev returned an invalid typed answer' };
  } catch (error: any) {
    log('unavailable', { reason: 'request_failed_or_timed_out', errorName: String(error?.name || 'Error') });
    return { status: 'unavailable', reason: 'Jev request failed or timed out' };
  }
};
