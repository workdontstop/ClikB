/** Server-side checks for one component-owned Creation control from a fresh browser observation. */
export const findCreationControl = (creation: any, actionId: string): any | undefined => {
  if (!actionId.startsWith('clikb.creation.')) return undefined;
  const matches = Object.values(creation?.controls?.areas || {}).flatMap((area: any) => area?.controls || [])
    .filter((control: any) => control?.actionId === actionId && control.enabled === true &&
      control.policy !== 'information_only' && control.policy !== 'needs_handoff');
  return matches.length === 1 ? matches[0] : undefined;
};

const normal = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

/** Destructive/publication controls use natural, target-specific consent, including an open Yes/No dialog. */
export const confirmedCreationControl = (latestUserText: string, control: any): string | undefined => {
  if (control?.policy !== 'needs_confirmation') return undefined;
  const user = normal(latestUserText);
  if (/\b(?:do not|dont|don t|never|not yet|cancel|keep)\b/.test(user)) return undefined;
  if (/\b(?:stop|pause|wait|hold)\b.{0,60}\b(?:at|before|until)\b/.test(user)) return undefined;
  if (/^(?:what|why|how|can i|could i|should i|would it)\b/.test(user)) return undefined;
  const label = normal(String(control.label || ''));
  const key = normal(decodeURIComponent(String(control.actionId || '').split('.action.').pop() || ''));
  if (/^(?:publish|publish music video|process video|save post|publish spatial)$/.test(key)) {
    const publishNow = /^(?:yes )?(?:please )?(?:confirm(?: and)? )?(?:publish|post)(?: (?:it|this|the video|the post|my video|my post|now|please))*$/.test(user);
    return publishNow || user === label || user === `confirm ${label}` ? String(control.controlId) : undefined;
  }
  if (/^(?:yes|yes please|confirm|do it|go ahead)$/.test(user) && key.startsWith('confirm ')) return String(control.controlId);
  const exactLabel = label && (user.includes(`confirm ${label}`) || user.includes(label));
  const exactKey = key.length > 4 && user.includes(`confirm ${key}`);
  const creationGo = key === 'go' && /\bconfirm (?:and )?(?:create|creation|generate)\b/.test(user);
  return exactLabel || exactKey || creationGo ? String(control.controlId) : undefined;
};

/** A question or a synthetic continuation is never permission to enable the video toggle. */
export const videoPermissionRequested = (text: string): boolean => {
  const user = normal(text);
  if (/\b(?:do not|dont|don t|never|not yet|disable|turn off|switch off)\b/.test(user) || /\bvideo\b.{0,50}\boff\b/.test(user)) return false;
  if (/\b(?:can i|could i|how|what|why|should i|is it|would it)\b/.test(user)) return false;
  return /\b(?:enable|allow|activate|turn on|switch on|click|clik|press|tap)\b.{0,70}\bvideo\b/.test(user)
    || /\bvideo\b.{0,50}\b(?:enable|on|permission granted)\b/.test(user);
};

/** Runtime control facts supersede obsolete restrictions in older uploaded packets. */
export const CREATION_AUTONOMY_RULES = `Current Creation policy: candidate controls (setup Go, Skip, Start, Continue, image generation, prompt edits, scene opening, safe child Close, and clikb.creation.toolbar.action.close_composer while the initial composer is idle before generation starts) use ordinary Auto Control under the user's active task. They do not require a magic confirmation or manual handoff. Once generation is armed/running or output exists, close_composer becomes needs_confirmation. requires_video controls additionally require autoControl.videoEnabled=true. The user may explicitly ask to enable Video; the AI cannot enable it on its own. The Video toggle is visible only in Storybook Video/B-shot grids or EditStory's video tab. needs_confirmation controls require target-specific consent; Yes applies to the current confirm_* dialog. Publication and deletion/discard remain separate boundaries. Never use shared/browser Back to exit active Creation. Preserve explicit model choices, the complete brief and stop-before-publishing constraints. Questions about videos or Worlds are not permission to generate them.`;

export const creationScrollAllowed = (creation: any, scrollId: string, direction: 'forward' | 'backward') => {
  const control = findCreationControl(creation, scrollId);
  return control?.kind === 'scroll' && (direction === 'forward' ? control.canScrollForward === true : control.canScrollBackward === true);
};
