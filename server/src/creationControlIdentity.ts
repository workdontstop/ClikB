/** Browser-safe, deterministic context; never includes prompt text in diagnostics. */
const canonical = (value: any): string => JSON.stringify(value && typeof value === 'object'
  ? Array.isArray(value) ? value.map(item => JSON.parse(canonical(item)))
    : Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, JSON.parse(canonical(value[key]))]))
  : value ?? null);
export function creationValueRevision(value: unknown): string {
  const text = canonical(value); let a = 2166136261, b = 3339675911;
  for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822519); }
  return `${text.length}:${(a >>> 0).toString(16)}${(b >>> 0).toString(16)}`;
}
export type CreationContext = { schema: 'clikb.creation-context.v1'; actionId: string; controlId: string; areaId: string;
  ownerId: string; operation: string; areaRevision: string; scopeRevision: string };
export function creationExecutionContext(snapshot: any, actionId: string, operation: string): CreationContext | undefined {
  const areas = Object.values(snapshot?.creation?.controls?.areas || {}) as any[];
  const matches = areas.flatMap(area => (area.controls || []).filter((c: any) => c.actionId === actionId).map((control: any) => ({area, control})));
  if (matches.length !== 1) return undefined;
  const {area, control} = matches[0];
  if (!control.ownerId) return undefined; // Older clients retain strict version checks.
  const scope = snapshot.creation || {};
  const identity = Object.fromEntries(['projectId','creationProjectId','postId','mode','modeType','stage','isActive','editStoryIsOpen',
    'editStoryTargetKey','editStorySceneId','editStoryShotId','editStorySceneIndex','editStoryIsBShot','editStoryTab','selectedReferenceId','sceneDisplayRevision'].map(key => [key, scope[key]]));
  const volatileCreationStateKeys = /^(?:timestamp|updatedAt|observedAt|currentTime|currentSecond|duration|durationSeconds|progress|playbackProgress|audioTime|scrollLeft|scrollTop|elapsedMs|gpuTimeSeconds|gpuStartupSeconds|gpuElapsedSeconds)$/;
  const structuralState = Object.fromEntries(Object.entries(area.state || {}).filter(([k]) => !volatileCreationStateKeys.test(k)));
  return {schema:'clikb.creation-context.v1', actionId, controlId:control.controlId, areaId:area.areaId,
    ownerId:control.ownerId, operation, areaRevision:creationValueRevision({state:structuralState,
      controls:area.controls.map((c: any) => { const {valueHint: _hint, ...redacted} = c; return redacted; })}), scopeRevision:creationValueRevision(identity)};
}
export function compareCreationContext(expected: unknown, current: CreationContext | undefined): {reasonCode: string; changedFields: string[]} | undefined {
  const value = expected as CreationContext;
  const keys = ['schema','actionId','controlId','areaId','ownerId','operation','areaRevision','scopeRevision'] as const;
  if (!value || value.schema !== 'clikb.creation-context.v1' || Object.keys(value).length !== keys.length
    || keys.some(key => typeof value[key] !== 'string' || !value[key] || value[key].length > 500))
    return {reasonCode:'operation_mismatch',changedFields:['malformed_context']};
  if (!current) return {reasonCode:'target_missing',changedFields:['target']};
  const changedFields = keys.filter(key => value[key] !== current[key]);
  if (!changedFields.length) return undefined;
  return {reasonCode:changedFields.includes('ownerId') ? 'owner_changed' : changedFields.includes('operation') ? 'operation_mismatch' : 'version_changed',changedFields};
}
