import type { DeckCategory, DeckSearchSection } from './deckControlSnapshot';

export type DeckGestureAxis = 'x' | 'y';
export const deckGestureAxis = (x: number, y: number): DeckGestureAxis | null => {
  if (Math.max(Math.abs(x), Math.abs(y)) < 10) return null;
  if (Math.abs(x) > Math.abs(y) * 1.2) return 'x';
  if (Math.abs(y) > Math.abs(x) * 1.2) return 'y';
  return null;
};

/** Search stays inside its query; ordinary browsing never enters Search or My Page. */
export function deckVerticalTarget(category: DeckCategory, section: DeckSearchSection | undefined, direction: number) {
  const ring: readonly DeckCategory[] = section ? ['games', 'shorts', 'cinema'] : ['games', 'shorts', 'cinema', 'all'];
  const index = ring.indexOf(section || category);
  return index < 0 ? null : ring[(index + (direction > 0 ? 1 : -1) + ring.length) % ring.length];
}

export type DeckWheelGesture = { axis: DeckGestureAxis | null; distance: number; lastEvent: number; fired: boolean };
export const createDeckWheelGesture = (): DeckWheelGesture => ({ axis: null, distance: 0, lastEvent: -Infinity, fired: false });

/** Momentum belongs to the gesture that produced it, even across a route remount. */
export function consumeDeckWheel(state: DeckWheelGesture, x: number, y: number, now: number) {
  if (now - state.lastEvent > 200) Object.assign(state, createDeckWheelGesture());
  state.lastEvent = now;
  state.axis ||= deckGestureAxis(x, y);
  if (!state.axis || state.fired) return null;
  state.distance += state.axis === 'x' ? x : y;
  if (Math.abs(state.distance) < 60) return null;
  state.fired = true;
  return { axis: state.axis, direction: state.distance > 0 ? 1 : -1 };
}
