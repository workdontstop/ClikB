/** A retained stop at Publish is a destination, never publication consent. */
export type ConciergeTaskBoundary = { destination: 'publish'; stopBeforePublication: true };

const PUBLISH_STOP_WORD = '(?:publish(?:ing)?|pub+l+i*s+i*h(?:ing)?|pulbish(?:ing)?|pubish(?:ing)?|publsh(?:ing)?|publis(?:ing)?|post(?:ing)?)';

export function conciergeTaskBoundary(goal: string): ConciergeTaskBoundary | undefined {
  let boundary: ConciergeTaskBoundary | undefined;
  // Refinements are appended in user-turn order. Bare Continue preserves the
  // boundary; a later explicit publication instruction can replace it.
  for (const rawTurn of goal.split(/\n(?=(?:User refinement|Current user turn):\s*)/i)) {
    const turn = rawTurn.replace(/^(?:User refinement|Current user turn):\s*/i, '');
    const text = turn.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\ba t\b/g, 'at');
    if (new RegExp(`\\b(?:stop|pause|wait|hold|leave(?:\\s+it)?|let\\s+me\\s+know|ask(?:\\s+me)?)\\b.{0,50}\\b(?:at|before|until|when(?:\\s+ready\\s+to)?)\\b.{0,40}\\b${PUBLISH_STOP_WORD}\\b`).test(text)
        || new RegExp(`\\b(?:do not|dont|don t|never)\\s+${PUBLISH_STOP_WORD}\\b`).test(text)
        || new RegExp(`\\bwithout\\s+${PUBLISH_STOP_WORD}\\b`).test(text)) {
      boundary = { destination: 'publish', stopBeforePublication: true };
    } else if (!/\b(?:later|not yet|do not|dont|don t|never|stop|wait|hold|pause|without)\b/.test(text)
        && !/^(?:what|why|how|when|where|can i|could i|should i|is it|would it)\b/.test(text)
        && (/\b(?:publish|post)\s+(?:it|this|now|the\s+(?:video|story|post|creation|project|scenes?))\b/.test(text)
          || /^(?:(?:yes|ok|okay|sure|please)\s+)*(?:publish|post)(?:\s+(?:it|this|now))?$/.test(text)
          || /\b(?:confirm|execute|run|start|go ahead|proceed)\b.{0,40}\b(?:publish(?:ing)?|post(?:ing)?|process(?:ing)?|save(?:\s+post)?)\b/.test(text))) {
      boundary = undefined;
    }
  }
  return boundary;
}

const publicationActions = new Set([
  'clikb.creation.storybook_grid.action.publish',
  'clikb.creation.storybook_studio_selector.action.publish_music_video',
  'clikb.creation.storybook_publish.action.process_video',
  'clikb.creation.storybook_publish.action.publish_spatial',
  'clikb.creation.storybook_publish.action.start_hotspot_setup',
]);

export function crossesConciergeTaskBoundary(boundary: ConciergeTaskBoundary | undefined, operation: any): boolean {
  return Boolean(boundary && operation?.kind === 'click' && (publicationActions.has(operation.actionId)
    || /^clikb\.creation\.[^.]+\.action\.(?:save_post|publish|process_video|publish_spatial|publish_music_video)$/.test(operation.actionId || '')));
}

export function conciergeBoundaryReached(boundary: ConciergeTaskBoundary | undefined, snapshot: any): boolean {
  if (!boundary) return true;
  const areas = snapshot?.creation?.controls?.areas || {};
  return Object.values(areas).some((area: any) => (area.controls || []).some((control: any) =>
    control.enabled === true && publicationActions.has(control.actionId)));
}

export const PUBLISH_BOUNDARY_RULE = 'Stop at Publish means reach the live storyboard Publish button, or the music-video direct Publish button, without clicking it. Completed images, the video grid and ordinary Enter Studio are intermediate steps. Complete the requested assets and required narrated-Cinema B-shots first. If already inside final review, stop before processing/saving. Continue alone preserves this boundary; a later explicit publish instruction may replace it. Images-only describes source media: Shorts/Cinema still assemble it into a final FFmpeg video with the selected audio/music.';
