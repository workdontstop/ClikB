export const FULLSCREEN_PING_INTERVAL = 4000;
export const FULLSCREEN_SLIDESHOW_GUIDANCE =
  'For a user-requested fullscreen slideshow, acknowledge once: "I’ll advance roughly every four seconds." '
  + 'Substitute the interval the user requested (for example eight seconds). Do not append a response-delay disclaimer. '
  + 'When Auto Control is enabled and a fullscreen slideshow task is active, advance one loaded post by calling virtualGate through Jev, then on later continuation checks '
  + 'compare current time with the timestamp of the last successful post advance. Advance once only when the requested interval has elapsed; '
  + 'otherwise return [NO_UPDATE] on heartbeat turns. Failed attempts do not reset the last-success time. '
  + 'Never count pings as elapsed time, never burst through missed intervals, and never repeat the acknowledgement on each ping. '
  + 'Stop or changed user instructions override the slideshow. If Auto Control is off, do not promise continued advances.';
/** A view of existing evidence, not a second history store. */
export function formatNavigationHistory(events: readonly { timestamp: number; outcome: string; actor?: string; after?: { route?: string; areaId?: string; controlId?: string; entityId?: string | number } }[], now: number): string {
  const lines = events.filter(event => Number.isFinite(event.timestamp)).slice(-5).map(event => {
    const destination = event.after || {};
    const target = [destination.controlId || destination.areaId || destination.route || 'navigation',
      destination.entityId != null ? `target ${destination.entityId}` : ''].filter(Boolean).join(' · ').slice(0, 150);
    return `${Math.max(0, Math.floor((now - event.timestamp) / 1000))}s ago · ${event.actor || 'unknown'} · ${target} · ${event.outcome}`;
  });
  return `Navigation history (past evidence; live snapshot wins):\n${lines.length ? lines.join('\n') : 'No recent transitions recorded.'}`;
}
export function canPingFullscreen(settings: { autoControlEnabled?: boolean; conciergeEnabled?: boolean }, areaIds: readonly string[]): boolean {
  return !!settings.autoControlEnabled && !!settings.conciergeEnabled
    && areaIds.some(id => id.startsWith('clikb.feeds.fullscreen.'));
}
export function fullscreenPingMessage(now: number, startedAt: number): string {
  return `[Fullscreen heartbeat — not a new user instruction] Current time: ${new Date(now).toISOString()} (${now} ms). `
    + `Heartbeat interval: 4000 ms; elapsed since activation: ${now - startedAt} ms. `
    + 'Use the current snapshot and timestamped transition history. Continue only an unfinished instruction the user actually gave; do not invent a task. '
    + 'For timed actions compare current time with the last successful action timestamp, not the number of pings. Never catch up by issuing a burst of actions. '
    + 'Call virtualGate for at most one due Jev-approved action. If nothing is due and there is no useful alert, reply exactly [NO_UPDATE]. Stop instructions cancel the earlier task. '
    + FULLSCREEN_SLIDESHOW_GUIDANCE;
}
