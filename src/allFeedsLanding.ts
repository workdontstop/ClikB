export function isAllFeedsLanding(pathname: string, search: string): boolean {
  const path = pathname.replace(/\/+$/, '').toLowerCase();
  const params = new URLSearchParams(search);
  return (path === '' || path === '/feeds') && !params.has('post') && !params.has('before');
}

type Arrival = { pathname: string; search: string; state: any };
export function shouldOpenAllFeedsComposer(arrival: Arrival, deckEnabled: boolean): boolean {
  if (!isAllFeedsLanding(arrival.pathname, arrival.search)) return false;
  const params = new URLSearchParams(arrival.search), state = arrival.state;
  if (params.has('story') || state?.fullscreen || state?.clikbDeck?.tier === 'story') return false;
  if (!deckEnabled) return true;
  if (state?.clikbDeck?.tier === 'deck' || state?.clikbDeckEntrance || params.has('deck')) return true;
  return !state?.clikbDeckGrid;
}

/** Resolve the original arrival once, after login supplies the saved preference. */
export function useInitialAllFeedsComposer(arrival: Arrival, accountReady: boolean, deckEnabled: boolean,
  setMinimised: (value: boolean) => void) {
  const initial = useRef(arrival), handled = useRef(false);
  useLayoutEffect(() => {
    if (!accountReady || handled.current) return;
    handled.current = true;
    setMinimised(!shouldOpenAllFeedsComposer(initial.current, deckEnabled));
  }, [accountReady, deckEnabled, setMinimised]);
}
import { useLayoutEffect, useRef } from 'react';

