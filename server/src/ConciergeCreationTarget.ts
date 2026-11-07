/** Memory reads use the app's existing one-based native scene cards.
 * Cinema Stage B is an even native scene, not an extra B-shot. */
export function resolveConciergeCreationTarget(snapshot: any, query: string): {
  status: 'resolved' | 'ambiguous_target' | 'not_found'; detail: string; explicit?: boolean;
  nativeSceneNumber?: number; bShotNumber?: number; logicalSceneNumber?: number; stage?: string;
  displaySceneNumber?: number; slotKey?: string;
} {
  const c = snapshot?.creation || {};
  const numbered = query.match(/\bscene\s*(\d+)\b/i);
  const stage = query.match(/\bstage\s*([ab])\b/i)?.[1].toUpperCase();
  const logical = /\b(?:logical|cinema)\s+scene\s*\d+/i.test(query);
  const cinema = String(c.mode).toLowerCase() === 'cinema';
  const explicitBShot = Number(query.match(/\bb[- ]?(?:shot|roll)\s*(\d+)\b/i)?.[1]) || undefined;
  // Plain scene numbers belong to the current displayed grid. Parent/stage
  // requests keep their explicit native address, and legacy clients keep theirs.
  if (numbered && c.sceneDisplayRevision && !logical && !explicitBShot) {
    const slot = (Array.isArray(c.sceneSlots) ? c.sceneSlots : []).find((item: any) => item.displaySceneNumber === Number(numbered[1]));
    if (!slot) return { status: 'not_found', explicit: true, detail: 'The requested scene is not numbered in the current grid.' };
    const parentStage = slot.parentCinemaStage || slot.cinemaStage;
    if (stage && parentStage !== `Stage ${stage}`) return { status: 'ambiguous_target', explicit: true,
      detail: 'The displayed scene and stated Cinema stage disagree. Read the current scene index.' };
    return { status: 'resolved', explicit: true, nativeSceneNumber: slot.nativeSlotNumber,
      displaySceneNumber: slot.displaySceneNumber, slotKey: slot.slotKey,
      ...(slot.role === 'b-shot' ? { bShotNumber: slot.bShotNumber } : {}),
      ...(cinema ? { logicalSceneNumber: Math.ceil(slot.nativeSlotNumber / 2), stage: String(parentStage || '').replace('Stage ', '') } : {}),
      detail: 'The displayed scene resolves to this native A-roll or supporting B-roll slot in the current layout.' };
  }
  let nativeSceneNumber = numbered ? Number(numbered[1]) : c.editStoryIsOpen
    ? Number(c.editStoryIsBShot ? c.editStoryParentSceneIndex : c.editStoryNativeSceneIndex || c.editStoryCurrentSceneNumber)
    : Number(c.storybookSceneIndex);
  if (numbered && cinema && logical) {
    if (!stage) return { status: 'ambiguous_target', detail: 'A logical Cinema scene has stages A and B. Specify the stage or request the scene index.' };
    nativeSceneNumber = 2 * nativeSceneNumber - (stage === 'A' ? 1 : 0);
  } else if (numbered && cinema && stage && (nativeSceneNumber % 2 === 1 ? 'A' : 'B') !== stage) {
    return { status: 'ambiguous_target', detail: 'The stated native scene number and Cinema stage disagree. Clarify native numbering versus logical scene/stage; do not return a different scene as the requested one.' };
  }
  if (numbered && (!nativeSceneNumber || nativeSceneNumber < 1 || (Number(c.previewSceneCount) > 0 && nativeSceneNumber > Number(c.previewSceneCount)))) {
    return { status: 'not_found', detail: 'The requested scene is outside the current project scene index.' };
  }
  return { status: 'resolved', explicit: Boolean(numbered),
    nativeSceneNumber: nativeSceneNumber > 0 ? nativeSceneNumber : undefined,
    bShotNumber: explicitBShot || (!numbered && c.editStoryIsBShot ? c.editStoryBShotIndex : undefined),
    ...(cinema && nativeSceneNumber > 0 ? { logicalSceneNumber: Math.ceil(nativeSceneNumber / 2), stage: nativeSceneNumber % 2 === 1 ? 'A' : 'B' } : {}),
    detail: 'Extra B-roll are stored within their parent native scene cards; preserve the selected B-roll number and current revision.' };
}
