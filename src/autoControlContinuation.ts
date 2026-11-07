/** A continuation wake-up carries the user's existing task; it is never a new instruction. */
export const AUTO_CONTROL_PING_INTERVAL = 2000;

type ActiveTask = {
  goal: string;
  latestUserText: string;
  revision: number;
  lastActionAt: number;
  waitStartedAt: number;
  pending: boolean;
  paused: boolean;
  waiting: boolean;
  recoverOnStateChange: boolean;
  blockedSnapshotKey: string;
  waitForChange?: boolean;
  waitingSnapshotKey?: string;
  continueAfterAction?: boolean;
  operationHistory: Array<{ operation?: unknown; status: string; detail?: string; mutationSent?: boolean; executionScope: string; sourceStage?: string; controlLabel?: string }>;
  generationRevision: number;
};

type SessionActionReceipt = {
  operation?: unknown;
  status: string;
  detail?: string;
  mutationSent?: boolean;
  executionScope?: string;
  sourceStage?: string;
  controlLabel?: string;
};

let task: ActiveTask | null = null;
let pendingUserTurn: string | null = null;
let completedProjectId: unknown;
let recentSessionReceipts: SessionActionReceipt[] = [];
let lastTriggeredOperation: unknown = undefined;

/** Task execution owns progress while active; a completed project stays quiet
 * until a real new instruction. This does not suppress user conversation. */
export const allowCreationProgressAnnouncement = (projectId: unknown): boolean =>
  !(task && !task.paused) && !(completedProjectId !== undefined && completedProjectId === projectId);

const continuation = /^(?:ok(?:ay)?(?: go)?|go(?: ahead)?|continue|proceed|carry on|keep going|next|try again|retry|resume)[.!\s]*$/i;
const stop = /^(?:stop|cancel|never mind|nevermind|pause)(?: now)?[.!\s]*$/i;
const replacement = /^(?:new task|instead|forget (?:that|the previous)|start over|cancel that)\b/i;

const VOLATILE_SNAPSHOT_KEYS = new Set([
  'pixels', 'pixelBalance', 'balance', 'meteredDeduction', 'lastMeteredDebit', 'settledPixels',
  'ttsPlaying', 'isSpeaking', 'voiceActive', 'speaking', 'audioLevel',
  'timestamp', 'updatedAt', 'stateVersion', 'elapsedMs',
  'observedAt', 'settledAt', 'elapsedSeconds', 'progressPercent', 'progressPercentage',
  'currentTime', 'currentSecond', 'duration', 'durationSeconds', 'progress', 'playbackProgress',
  'audioTime', 'audioProgress', 'scrollTop', 'scrollLeft', 'sceneScrollLeft', 'captionScrollTop',
  'gpuTimeSeconds', 'gpuStartupSeconds', 'gpuElapsedSeconds',
]);

const sanitizeAreaStateForContinuation = (state: any): any => {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return state;
  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(state)) {
    if (VOLATILE_SNAPSHOT_KEYS.has(k)) continue;
    cleaned[k] = v;
  }
  return cleaned;
};

const isCosmeticOrBillingControl = (control: any): boolean => {
  if (!control || typeof control !== 'object') return false;
  if (control.policy === 'information_only' || control.informationOnly === true) return true;
  const id = String(control.actionId || control.controlId || '');
  return /\.(?:pixels_balance|status|voice|record|stop_record|slideshow)$/.test(id);
};

/**
 * Distinguish pure read-only status/pricing questions and social banter from task refinements
 * so side-questions during an active run never overwrite the creative brief or bump generationRevision.
 */
export const isPureInformationalOrBanterTurn = (text: string): boolean => {
  const clean = String(text || '').trim();
  if (!clean) return true;
  const hasDirectiveOrContrastClause = /\b(can you|could you|please|change|make|set|use|select|switch|update|edit|add|remove|delete|create|generate|animate|open|close|enable|disable|try|give me|redo|another|replace|turn on|turn off|start|stop|continue|publish|skip|keep|only|instead|also|and then|after that|but|except|without|no\s+\w+|not\s+\w+|don't|do not|never|actually|wait|hold on)\b/i.test(clean);
  if (hasDirectiveOrContrastClause) return false;
  if (/^(?:what (?:is|are|does|do)|how (?:much|many|are you|is your)|why (?:is|are|can|did|does)|who (?:is|are))\b/i.test(clean)) {
    return true;
  }
  if (/^(?:haha(?:\s+awesome(?:\s+thanks)?)?|lol|nice|cool|awesome(?:\s+thanks)?|great|thanks(?:\s+a\s+lot|\s+so\s+much)?|thank you(?:\s+so\s+much|\s+very\s+much)?|hello(?:\s+there)?|hi(?:\s+there)?|hey(?:\s+there)?|sounds good|got it|sweet|dope|i (?:really )?(?:like|love|enjoy)(?:\s+(?:it|that|this|talking(?:\s+to\s+you)?))?)[.!,?\s]*$/i.test(clean)) {
    return true;
  }
  return false;
};

/** Ignore timestamp/version/billing/TTS churn; wake on facts that change the next available step. */
export const autoControlSnapshotKey = (snapshot: any): string => JSON.stringify([
  snapshot?.route, snapshot?.navigation?.activeAreaIds, snapshot?.navigation?.availableActions?.map((item: any) => item.actionId),
  snapshot?.feeds?.activeAreaIds,
  Object.entries(snapshot?.feeds?.areas || {}).map(([id, area]: [string, any]) => [id, sanitizeAreaStateForContinuation(area?.state)]),
  snapshot?.creation?.projectId, snapshot?.creation?.stage, snapshot?.creation?.mode,
  snapshot?.creation?.modeSelectionRequired, snapshot?.creation?.goBlockedReason,
  snapshot?.creation?.status, snapshot?.creation?.isGenerating, snapshot?.creation?.previewSceneCount,
  snapshot?.creation?.previewImageCount, snapshot?.creation?.hdImageCount, snapshot?.creation?.videoCount,
  snapshot?.creation?.mediaRevision,
  snapshot?.creation?.editStoryMotionStatus, snapshot?.creation?.editStoryMotionVideoReady, snapshot?.creation?.editStoryMotionError,
  snapshot?.creation?.characterBranchStage, snapshot?.creation?.referenceImageReadyCount, snapshot?.creation?.referenceImageMissingCount, snapshot?.creation?.imageError, snapshot?.creation?.videoError,
  snapshot?.ui?.minimisePrompt, Object.keys(snapshot?.creation?.confirmedFailuresByTarget || {}).sort(),
  Object.entries(snapshot?.creation?.controls?.areas || {}).map(([id, area]: [string, any]) => [id, sanitizeAreaStateForContinuation(area?.state),
    (area?.controls || []).filter((control: any) => !isCosmeticOrBillingControl(control)).map((control: any) => [
      control.actionId, control.enabled, control.selected, control.valueLength,
      control.valueHint, control.canScrollForward, control.canScrollBackward,
    ])]),
]);

export const getAutoControlTask = (): ActiveTask | null => task && { ...task, operationHistory: [...task.operationHistory] };

/** Guide, full chat and voice serialize the same retained control task. */
export const autoControlRequestContext = (fallbackText: string) => {
  const isSideTurn = Boolean(task && pendingUserTurn && isPureInformationalOrBanterTurn(pendingUserTurn));
  return {
    activeAutoControlGoal: pendingUserTurn
      ? (!task || replacement.test(pendingUserTurn)
        ? pendingUserTurn
        : (isSideTurn || task.goal.includes(pendingUserTurn)) ? task.goal : `${task.goal}\nCurrent user turn: ${pendingUserTurn}`)
      : (task?.goal || null),
    activeAutoControlEvidence: task && (!pendingUserTurn || !replacement.test(pendingUserTurn)) ? task.operationHistory : [],
    recentSessionActionReceipts: [...recentSessionReceipts],
    activeGenerationRevision: task
      ? (pendingUserTurn && replacement.test(pendingUserTurn) ? 0
        : task.generationRevision + (pendingUserTurn && !isSideTurn && task.operationHistory.length > 0 ? 1 : 0))
      : 0,
    latestRealControlInstruction: pendingUserTurn || task?.latestUserText || fallbackText,
  };
};

export const noteAutoControlUserTurn = (text: string): void => {
  const userText = text.trim();
  if (!userText) return;
  if (!isPureInformationalOrBanterTurn(userText)) completedProjectId = undefined;
  if (task) task.waitForChange = false; // A real instruction can require same-screen reasoning.
  if (stop.test(userText)) { task = null; pendingUserTurn = null; return; }
  if (task && continuation.test(userText)) {
    pendingUserTurn = null;
    if (/^(?:try again|retry)[.!\s]*$/i.test(userText) && task.operationHistory.length > 0) {
      task.generationRevision += 1;
    }
    task.latestUserText = userText;
    task.paused = false;
    task.recoverOnStateChange = false;
    task.pending = true;
    task.revision += 1;
    return;
  }
  const combinedUserText = pendingUserTurn && !replacement.test(userText) && !isPureInformationalOrBanterTurn(pendingUserTurn) && !isPureInformationalOrBanterTurn(userText) && pendingUserTurn.toLowerCase() !== userText.toLowerCase() && !userText.toLowerCase().startsWith(pendingUserTurn.toLowerCase()) ? `${pendingUserTurn} ${userText}`.replace(/\s+/g, ' ').trim() : userText;
  pendingUserTurn = combinedUserText;
  if (task) task.latestUserText = combinedUserText;
};

const commitPendingUserTurn = (): void => {
  if (!pendingUserTurn) return;
  const userText = pendingUserTurn;
  pendingUserTurn = null;
  if (!task || replacement.test(userText)) {
    task = { goal: userText, latestUserText: userText, revision: 0, lastActionAt: 0, waitStartedAt: 0, pending: false, paused: false, waiting: false,
      recoverOnStateChange: false, blockedSnapshotKey: '', operationHistory: [], generationRevision: 0 };
    return;
  }
  if (isPureInformationalOrBanterTurn(userText)) {
    task.latestUserText = userText;
    return;
  }
  if (task.operationHistory.length > 0) task.generationRevision += 1;
  task.latestUserText = userText;
  if (!task.goal.includes(userText)) task.goal += `\nUser refinement: ${userText}`;
};

/** Observed changes or explicit waiting/recovery feedback arm continuation. Proposals do not. */
export const noteAutoControlGateStage = (stage: string, detail?: any, snapshotKey = ''): void => {
  if (stage === 'content_or_conversation' || (stage === 'action_blocked' && detail?.reason === 'content_or_conversation')) {
    pendingUserTurn = null;
    lastTriggeredOperation = undefined;
    return;
  }
  if (stage === 'triggered') {
    if (detail?.operation) lastTriggeredOperation = detail.operation;
    return;
  }
  if (stage === 'jev_diagnostic') {
    return;
  }
  const commitsTurn = stage === 'app_action_requested' || stage === 'jev_action_selected'
    || stage === 'jev_action_approved_by_gate' || stage === 'observed_success' || stage === 'handler_dispatched'
    || stage === 'recoverable_failure' || stage === 'action_blocked' || stage === 'permission_required'
    || stage === 'confirmation_required' || stage === 'task_completed' || stage === 'intent_unavailable'
    || stage === 'snapshot_unavailable' || stage === 'observed_failure' || stage === 'proposal_action_id_mismatch'
    || stage.startsWith('jev_declined') || stage.startsWith('jev_unavailable')
    || stage === 'jev_action_declined' || stage === 'jev_action_unavailable'
    || (stage === 'task_waiting' && !task);
  if (commitsTurn) {
    commitPendingUserTurn();
  }
  if (!task) return;
  if (detail?.evidence && (detail.evidence.executionScope || detail.evidence.operation)) {
    if (detail.evidence.mutationSent === true) {
      task.operationHistory = [...task.operationHistory, detail.evidence].slice(-64);
    }
    recentSessionReceipts = [...recentSessionReceipts, detail.evidence].slice(-12);
    lastTriggeredOperation = undefined;
  } else if (
    (stage === 'action_blocked' || stage === 'permission_required' || stage === 'confirmation_required'
      || stage.startsWith('jev_declined') || stage === 'jev_action_declined')
    && (detail?.operation || lastTriggeredOperation)
  ) {
    recentSessionReceipts = [
      ...recentSessionReceipts,
      {
        operation: detail?.operation || lastTriggeredOperation,
        status: String(detail?.status || stage),
        detail: String(
          detail?.detail
          || detail?.reason
          || (stage === 'permission_required' ? 'Auto Control is Off; the user must enable it manually' : ''),
        ).slice(0, 260),
        mutationSent: false,
        ...(typeof detail?.controlLabel === 'string' ? { controlLabel: detail.controlLabel } : {}),
      },
    ].slice(-12);
    lastTriggeredOperation = undefined;
  }
  if (stage === 'task_completed') { completedProjectId = detail?.projectId; task = null; pendingUserTurn = null; return; }
  if (stage === 'task_waiting' || stage === 'recoverable_failure') {
    const now = Date.now();
    task.revision += 1;
    task.pending = true;
    task.paused = false;
    task.recoverOnStateChange = false;
    if (stage === 'task_waiting') {
      task.waitForChange = detail?.waitForChange === true;
      task.continueAfterAction = detail?.actionBudgetReached === true && !task.waitForChange;
      task.waitingSnapshotKey = snapshotKey;
      const intervalMs = requestedAutoControlIntervalMs(task.goal) ?? AUTO_CONTROL_PING_INTERVAL;
      if (!task.waiting || !task.waitStartedAt) {
        task.waitStartedAt = task.lastActionAt || now;
      } else if (now - task.waitStartedAt >= intervalMs) {
        task.waitStartedAt = now;
      }
    }
    if (stage !== 'task_waiting') task.waitStartedAt = 0;
    task.waiting = stage === 'task_waiting';
    task.lastActionAt = now;
  } else if (stage === 'observed_success' || stage === 'handler_dispatched') {
    const now = Date.now();
    task.revision += 1;
    task.lastActionAt = now;
    task.pending = true;
    task.paused = false;
    task.recoverOnStateChange = false;
    if (stage === 'handler_dispatched') {
      if (!task.waiting) task.waitStartedAt = now;
      task.waiting = true;
    } else {
      task.waiting = false;
      task.waitStartedAt = 0;
    }
  } else if (stage === 'action_blocked' || stage === 'permission_required' || stage === 'confirmation_required'
      || stage === 'observed_failure' || stage === 'proposal_action_id_mismatch'
      || stage === 'snapshot_unavailable' || stage === 'intent_unavailable'
      || stage.startsWith('jev_declined') || stage.startsWith('jev_unavailable')
      || stage === 'jev_action_declined' || stage === 'jev_action_unavailable') {
    task.pending = false;
    task.paused = true;
    task.waiting = false;
    task.waitStartedAt = 0;
    task.recoverOnStateChange = detail?.recovery === 'state_change'
      || detail?.status === 'state_blocked' || detail?.status === 'execution_unknown';
    task.blockedSnapshotKey = snapshotKey;
  }
};

export const pauseAutoControlTask = (): void => {
  if (task) { task.pending = false; task.paused = true; task.recoverOnStateChange = false; }
};

export const idleAutoControlTask = (): void => {
  if (task && !task.paused) task.pending = false;
};

export const resumeAutoControlTask = (changedSnapshotKey?: string): void => {
  if (task?.paused && (!task.recoverOnStateChange || !changedSnapshotKey || changedSnapshotKey === task.blockedSnapshotKey)) return;
  if (task && (task.lastActionAt || changedSnapshotKey)) {
    task.paused = false;
    task.recoverOnStateChange = false;
    if (changedSnapshotKey) task.waitStartedAt = 0;
    task.revision += 1;
    task.pending = true;
  }
};

export const clearAutoControlTask = (): void => { task = null; pendingUserTurn = null; lastTriggeredOperation = undefined; };

export const clearAutoControlSessionReceipts = (): void => {
  recentSessionReceipts = [];
  lastTriggeredOperation = undefined;
};

export const clearPendingAutoControlUserTurn = (): void => {
  pendingUserTurn = null;
};

const SPOKEN_INTERVAL_NUMBERS: Record<string, number> = {
  a: 1, an: 1, zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const INTERVAL_WORD = `(?:${Object.keys(SPOKEN_INTERVAL_NUMBERS).join('|')}|half|quarter|hundred|and|point)\\b`;
const INTERVAL_NUMBER = `(?:\\d+(?:\\.\\d+)?|${INTERVAL_WORD}(?:[ -]${INTERVAL_WORD}){0,7})`;

const intervalNumber = (text: string): number => {
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);
  const words = text.toLowerCase().split(/[ -]+/).filter(word => word !== 'and');
  const point = words.indexOf('point');
  if (point >= 0) {
    const whole = intervalNumber(words.slice(0, point).join(' '));
    const digits = words.slice(point + 1).map(word => SPOKEN_INTERVAL_NUMBERS[word]);
    return Number.isFinite(whole) && digits.length > 0 && digits.every(n => n >= 0 && n <= 9)
      ? whole + Number(`0.${digits.join('')}`) : NaN;
  }
  let value = 0;
  for (const word of words) {
    if (word === 'hundred') value = (value || 1) * 100;
    else if (word === 'half' || word === 'quarter') value += word === 'half' ? 0.5 : 0.25;
    else if (word === 'a' && words.some(w => w === 'half' || w === 'quarter')) continue;
    else if (SPOKEN_INTERVAL_NUMBERS[word] !== undefined) value += SPOKEN_INTERVAL_NUMBERS[word];
    else return NaN;
  }
  return words.length ? value : NaN;
};

/** A duration must have a time unit; "every image" must never turn generation into polling. */
export const requestedAutoControlIntervalMs = (goal: string, fullscreen = false): number | null => {
  const clean = String(goal || '').trim();
  if (!clean) return null;
  const duration = `(${INTERVAL_NUMBER})[\\s-]*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)\\b`;
  const expressions = [
    new RegExp(`\\b(?:every|each|wait(?: for)?|after|in)\\s+${duration}`, 'gi'),
    new RegExp(`\\b${duration}\\s+(?:intervals?|apart|slideshow|each|per)\\b`, 'gi'),
  ];
  let latest: { index: number; ms: number } | undefined;
  for (const expression of expressions) {
    for (const match of clean.matchAll(expression)) {
      const unit = match[2].toLowerCase();
      const milliseconds = intervalNumber(match[1]) * (unit.startsWith('d') ? 86_400_000 : unit.startsWith('h') ? 3_600_000 : unit.startsWith('m') ? 60_000 : 1000);
      if (Number.isFinite(milliseconds) && milliseconds > 0 && Number.isSafeInteger(Math.round(milliseconds))
          && (!latest || match.index! > latest.index)) {
        latest = { index: match.index!, ms: Math.max(AUTO_CONTROL_PING_INTERVAL, Math.round(milliseconds)) };
      }
    }
  }
  if (latest) return latest.ms;
  // The documented slideshow default is four seconds. A one-off Next/Scroll or a
  // generic "automatically continue" creation brief is not a recurring task.
  if (fullscreen && /\b(slideshow|keep (?:scrolling|going|advancing)|continuously (?:scroll|advance)|automatically advance)\b/i.test(clean)) {
    return 4000;
  }
  return null;
};

export const shouldWakeAutoControlHeartbeat = (input: {
  task: ActiveTask | null;
  now: number;
  running: boolean;
  quietUntil: number;
  lastPingAt: number;
  lastRunRevision: number;
  currentSnapshotKey: string;
  lastSnapshotKey: string;
  unchangedChecks: number;
  maxUnchangedChecks: number;
  fullscreen?: boolean;
  streaming?: boolean;
}): { shouldWake: boolean; shouldResumeOnSnapshotChange: boolean; resetUnchangedChecks: boolean; effectiveIntervalMs: number; isTimedTask: boolean } => {
  const {
    task: activeTask,
    now,
    running,
    quietUntil,
    lastPingAt,
    lastRunRevision,
    currentSnapshotKey,
    lastSnapshotKey,
    unchangedChecks,
    maxUnchangedChecks,
    fullscreen = false,
    streaming = false,
  } = input;
  const timedIntervalMs = activeTask ? requestedAutoControlIntervalMs(activeTask.goal, fullscreen) : null;
  const isTimedTask = timedIntervalMs !== null;
  const effectiveIntervalMs = timedIntervalMs ?? AUTO_CONTROL_PING_INTERVAL;
  const snapshotChanged = currentSnapshotKey !== lastSnapshotKey;
  const effectiveUnchangedChecks = snapshotChanged ? 0 : unchangedChecks;
  if (activeTask?.waiting && activeTask.waitForChange && !isTimedTask
      && activeTask.waitingSnapshotKey === currentSnapshotKey) {
    return { shouldWake: false, shouldResumeOnSnapshotChange: false, resetUnchangedChecks: snapshotChanged, effectiveIntervalMs, isTimedTask };
  }
  if (!activeTask || activeTask.paused) {
    return { shouldWake: false, shouldResumeOnSnapshotChange: false, resetUnchangedChecks: snapshotChanged, effectiveIntervalMs, isTimedTask };
  }
  if (!activeTask.pending && activeTask.lastActionAt && snapshotChanged) {
    return { shouldWake: false, shouldResumeOnSnapshotChange: true, resetUnchangedChecks: true, effectiveIntervalMs, isTimedTask };
  }
  if (!activeTask.pending && !isTimedTask && !(activeTask.waiting && effectiveUnchangedChecks < maxUnchangedChecks)) {
    return { shouldWake: false, shouldResumeOnSnapshotChange: false, resetUnchangedChecks: snapshotChanged, effectiveIntervalMs, isTimedTask };
  }
  if (!isTimedTask && activeTask.waiting && effectiveUnchangedChecks >= maxUnchangedChecks && !snapshotChanged
      && !(activeTask.continueAfterAction && activeTask.revision !== lastRunRevision)) {
    return { shouldWake: false, shouldResumeOnSnapshotChange: false, resetUnchangedChecks: snapshotChanged, effectiveIntervalMs, isTimedTask };
  }
  const anchorAt = isTimedTask && activeTask.waitStartedAt ? activeTask.waitStartedAt : activeTask.lastActionAt;
  if (
    running
    || now < quietUntil
    || now - anchorAt < effectiveIntervalMs
    || now - lastPingAt < AUTO_CONTROL_PING_INTERVAL
    || streaming
    || (!isTimedTask && !activeTask.waiting && activeTask.revision === lastRunRevision)
  ) {
    return { shouldWake: false, shouldResumeOnSnapshotChange: false, resetUnchangedChecks: snapshotChanged, effectiveIntervalMs, isTimedTask };
  }
  return { shouldWake: true, shouldResumeOnSnapshotChange: false, resetUnchangedChecks: snapshotChanged, effectiveIntervalMs, isTimedTask };
};

export const autoControlPingMessage = (now: number): string => {
  pendingUserTurn = null;
  return '[App state updated] Observe the live app state and the active task toward activeAutoControlGoal. If a step completed or an error occurred, provide natural feedback and call virtualGate with the next operation. If state is unchanged, reply [NO_UPDATE].';
};
