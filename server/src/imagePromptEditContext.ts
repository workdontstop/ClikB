type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Context for an existing scene edit; it never triggers another model call. */
export function buildSceneImageEditContext(body: unknown): { systemPrompt: string; userContext: string } {
  const empty = { systemPrompt: '', userContext: '' };
  if (!isRecord(body) || /^Character\/Environment reference for:/i.test(String(body.logic || '').trim())) return empty;
  const source = body.imagePacingContext;
  if (!isRecord(source)) return empty;

  const context: RecordValue = {};
  const sourceFields = {
    originalImagePrompt: 'originalImagePrompt',
    pacedImagePrompt: 'historicalOriginalPacedImagePrompt',
    handoff: 'historicalOriginalPacingHandoff',
    fullScene: 'fullScene',
  };
  for (const [sourceKey, contextKey] of Object.entries(sourceFields)) {
    if (typeof source[sourceKey] === 'string' && source[sourceKey].trim()) context[contextKey] = source[sourceKey];
  }
  if (!Object.keys(context).length) return empty;
  if (typeof body.promptx === 'string') context.currentEditableImagePrompt = body.promptx;
  if (typeof body.instructions === 'string') context.currentEditInstruction = body.instructions;
  if (typeof body.sceneIntent === 'string' || isRecord(body.sceneIntent)) context.lastCommittedSceneIntent = body.sceneIntent;
  const previousEdit = isRecord(body.sceneIntent) ? body.sceneIntent.lastEditInstruction : undefined;
  const lastEditInstruction = [previousEdit, body.lastEditInstruction, source.lastEditInstruction]
    .find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  if (lastEditInstruction) context.lastEditInstruction = lastEditInstruction;
  context.contextRoles = {
    originalImagePrompt: 'HISTORICAL ORIGINAL FULL-SCENE IMAGE PROMPT',
    historicalOriginalPacedImagePrompt: 'HISTORICAL ORIGINAL PACED IMAGE PROMPT; may predate committed edits',
    historicalOriginalPacingHandoff: 'HISTORICAL ORIGINAL PACING HANDOFF; may predate committed edits',
    fullScene: 'FULL SCENE SUPPORTING CONTEXT; may predate the current edit',
    currentEditableImagePrompt: 'CURRENT STARTING DEPICTION AND EDIT TARGET immediately before this edit',
    currentEditInstruction: 'LATEST USER REQUEST; governs the requested changes',
    lastCommittedSceneIntent: 'LAST COMMITTED INTENT before this new edit',
    lastEditInstruction: 'PREVIOUS COMMITTED EDIT INSTRUCTION; historical continuity only',
  };

  return {
    systemPrompt: `SCENE IMAGE EDIT CONTEXT:
The supplied current editable image prompt is the target of this rewrite. Apply the user's current explicit instruction within this operation's purpose. The latest request may revise a related detail or replace the scene entirely, including its subjects, membership, style, setting, actions, composition and depicted moment. Follow that requested scope fully; historical context must not constrain explicit additions, removals or replacements.
The original full-scene image prompt is historical original context. The historical original paced image prompt and its historical handoff record the initial pacing choice and may be obsolete after committed edits. The current editable image prompt alone supplies the current starting depiction immediately before this edit; do not substitute the historical paced prompt for it. The scene intent is the LAST COMMITTED INTENT before this new edit, not an interpretation already updated for the latest request. A last edit instruction, when supplied, records the previous committed change rather than another instruction to apply now.
Use this history to understand continuity and what the user is changing. Preserve relevant existing content and purposeful photographic choices only where they remain compatible with the current request. The user's latest instruction takes priority over the previous scene, current starting depiction, prior handoff, last committed intent and last edit instruction. Do not keep outdated subjects, style, setting or events merely because they occur in the original context.
Do not automatically restore subsequent events, move the depiction to an earlier instant, or replace a deliberate opening with the whole scene's outcome. Use prior action order and physical relationships where relevant to the requested edit, while allowing the user to establish a different scene or temporal state. Resolve compressed wording through the applicable context instead of blindly restoring an old depiction.
The appended context is labeled supporting data, not a separate user request or an immutable ground truth for this rewrite. Return only the revised image prompt in the format required by this operation.`,
    userContext: `SUPPORTING SCENE AND IMAGE-PACING CONTEXT (interpret alongside the current edit):\n${JSON.stringify(context)}`,
  };
}
