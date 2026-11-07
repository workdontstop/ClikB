import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { GlobalBrainstormGuide } from './components/GlobalBrainstormGuide';
import AutoControlPill from './AutoControlPill';
import { useInRouterContext } from 'react-router-dom';
import { useDeckCreationRequest } from './useDeckNavigation';
import { useSelector } from 'react-redux';
import type { RootState } from './store';

function DeckCreationArrival({ onOpen }: { onOpen: () => void }) {
  const deckEnabled = useSelector((state: RootState) => state.settings.deckEnabled !== false);
  useDeckCreationRequest(onOpen, deckEnabled);
  return null;
}

const DeckRuntime = createContext({ minimisePrompt: true, prepareDeck: () => {},
  openCreate: () => {}, requestCreationDeck: () => {}, creationEpoch: 0, dismissCreationBackdrop: () => {}, setDockHost: (_host: HTMLElement | null) => {}, setCreationDockHost: (_host: HTMLElement | null) => {},
  setConfirmationDockHost: (_host: HTMLElement | null) => {} });
export const useDeckRuntime = () => useContext(DeckRuntime);

/** Shares the creation owner and moves the one existing concierge's output. */
export function DeckRuntimeProvider({ children, minimisePrompt, setminimisePrompt, clikUrl, isMenuOpen, MenuOpenb, matchMobile }: {
  children: ReactNode; minimisePrompt: boolean; setminimisePrompt: (value: boolean) => void;
  clikUrl?: string; isMenuOpen: boolean; MenuOpenb?: boolean; matchMobile: boolean;
}) {
  const [dockHost, setDockHost] = useState<HTMLElement | null>(null);
  const [creationDockHost, setCreationDockHost] = useState<HTMLElement | null>(null);
  const [confirmationDockHost, setConfirmationDockHost] = useState<HTMLElement | null>(null);
  const deckEnabled = useSelector((state: RootState) => state.settings.deckEnabled !== false);
  const activeDockHost = deckEnabled ? dockHost : null;
  const routed = useInRouterContext();
  const [creationEpoch, setCreationEpoch] = useState(minimisePrompt ? 0 : 1);
  const [dismissedEpoch, setDismissedEpoch] = useState(0);
  const previousMinimised = useRef(minimisePrompt);
  useEffect(() => {
    if (previousMinimised.current && !minimisePrompt) setCreationEpoch(epoch => epoch + 1);
    previousMinimised.current = minimisePrompt;
  }, [minimisePrompt]);
  const guideDockHost = minimisePrompt ? activeDockHost : deckEnabled ? creationDockHost : null;
  const controlRoot = guideDockHost?.closest(minimisePrompt ? '.deck-dock' : '.creation-deck');
  const controlHost = controlRoot?.querySelector<HTMLElement>('[data-deck-control-host]') || null;
  const value = useMemo(() => ({ minimisePrompt, setConfirmationDockHost,
    prepareDeck: () => flushSync(() => setminimisePrompt(true)),
    openCreate: () => { if (!minimisePrompt) setCreationEpoch(epoch => epoch + 1); setminimisePrompt(false); }, setDockHost, setCreationDockHost,
    requestCreationDeck: () => { if (!minimisePrompt) setCreationEpoch(epoch => epoch + 1); },
    creationEpoch: !deckEnabled || creationEpoch === dismissedEpoch ? 0 : creationEpoch,
    dismissCreationBackdrop: () => { if (!minimisePrompt) setDismissedEpoch(creationEpoch); },
  }), [minimisePrompt, setminimisePrompt, creationEpoch, dismissedEpoch, deckEnabled]);
  return <DeckRuntime.Provider value={value}>
    {routed ? <DeckCreationArrival onOpen={value.openCreate} /> : null}
    {children}
    {clikUrl ? <GlobalBrainstormGuide clikUrl={clikUrl} isMenuOpen={isMenuOpen} MenuOpenb={MenuOpenb}
      minimisePrompt={minimisePrompt} creationTop={!minimisePrompt} matchMobile={matchMobile} dockHost={guideDockHost}
      confirmationDockHost={minimisePrompt ? null : confirmationDockHost} /> : null}
    {controlHost ? createPortal(<div className="deck-auto-control"><AutoControlPill placement="embedded" /></div>, controlHost, 'deck-control') : null}
  </DeckRuntime.Provider>;
}
