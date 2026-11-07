/** A direct, target-specific latest user turn is required for relationship writes. */
export const confirmedRelationshipTarget = (
  latestUserMessage: string,
  snapshot: any,
  action: { actionId?: string; controlId?: string; targetId?: number | string; requiresConfirmation?: boolean },
): number | string | null => {
  if (!action?.requiresConfirmation || action.targetId == null) return null;
  const kind = String(action.actionId).endsWith('.action.unfollow') ? 'unfollow'
    : String(action.actionId).endsWith('.action.follow') ? 'follow' : null;
  if (!kind) return null;
  const match = /^(?:yes[, ]+)?(?:i\s+)?confirm\s+(follow|unfollow)\s+@?([\w.-]+)[.!]?$/i.exec(String(latestUserMessage || '').trim());
  if (!match || match[1].toLowerCase() !== kind) return null;
  const areaId = String(action.controlId).split('.control.')[0];
  const area = snapshot?.navigation?.areas?.[areaId];
  const namedTarget = String(area?.state?.username || area?.state?.profileName || '').toLowerCase();
  const statedTarget = match[2].toLowerCase().replace(/[.!]$/, '');
  return statedTarget === namedTarget || statedTarget === String(action.targetId) ? action.targetId : null;
};
