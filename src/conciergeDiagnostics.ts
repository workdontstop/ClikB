const verboseEnabled = (): boolean => {
  try { return typeof window !== 'undefined' && window.localStorage?.getItem('clikb:verbose-ai-diagnostics') === '1'; }
  catch { return false; }
};

/** A diagnostic view only: never replace the full state used by the controller/gate. */
export const boundedConciergeDiagnostic = (input: unknown): unknown => {
  let visited = 0;
  const seen = new WeakSet<object>();
  const visit = (value: any, depth: number): any => {
    if (++visited > 80) return '[bounded]';
    if (typeof value === 'string') return value.slice(0, 160);
    if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value !== 'object') return String(value).slice(0, 80);
    if (depth >= 3 || seen.has(value)) return '[bounded]';
    seen.add(value);
    if (Array.isArray(value)) return value.slice(0, 8).map(item => visit(item, depth + 1));
    return Object.fromEntries(Object.keys(value).slice(0, 16).map(key => [key, visit(value[key], depth + 1)]));
  };
  return visit(input, 0);
};

export const logControlDiagnostic = (label: string, value: any): void => {
  const result = value?.reply || value?.detail?.result || value?.detail || {};
  const operation = value?.detail?.operation || {};
  const text = (item: unknown) => typeof item === 'string' ? item.slice(0, 160) : undefined;
  const summary = {
    taskId: text(value?.taskId), requestId: text(value?.requestId), stage: text(value?.stage),
    actionId: text(value?.actionId || operation.actionId), command: text(value?.command),
    stateVersion: typeof value?.stateVersion === 'number' ? value.stateVersion : text(value?.stateVersion),
    expectedVersion: typeof value?.expectedVersion === 'number' ? value.expectedVersion : text(value?.expectedVersion),
    status: text(result?.status), reason: text(result?.reason), route: text(result?.snapshot?.route),
  };
  console.info(`[${label}] ${JSON.stringify(summary)}`);
  if (verboseEnabled()) console.debug(`[${label} bounded detail] ${JSON.stringify(boundedConciergeDiagnostic(value)).slice(0, 4000)}`);
};

export const logVoiceDiagnostic = (...args: unknown[]): void => {
  if (verboseEnabled()) console.debug(`[voice] ${JSON.stringify(boundedConciergeDiagnostic(args)).slice(0, 4000)}`);
};
