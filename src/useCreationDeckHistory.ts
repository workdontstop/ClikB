import { useEffect, useLayoutEffect, useRef, useState } from 'react';

type Layer = {
  promptId: string;
  view: 'deck' | 'workstation';
  sceneKey: string | null;
};

type Options = {
  enabled: boolean;
  active: boolean;
  initiallyOpen?: boolean;
  escapeBlocked?: boolean;
  onRestoreWorkstation?: (sceneKey: string) => void;
  onCloseWorkstation?: () => void;
  onRevealGrid?: (sceneKey: string | null) => void;
};

const currentLayer = (): Layer | null => {
  const state = window.history.state;
  const layer = state?.clikbCreationDeck;
  return typeof layer?.promptId === 'string' && (layer.view === 'deck' || layer.view === 'workstation') &&
    layer.promptId === state?.clikbPromptInput?.id ? layer : null;
};

/** Storyboard views are children of the protected PromptInput history entry. */
export function useCreationDeckHistory(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const [layer, setLayer] = useState<Layer | null>(null);
  const live = useRef<Layer | null>(null);
  const initialized = useRef(false);
  const pendingBack = useRef(false);
  const workstationScene = useRef<string | null>(null);

  const applyLayer = (next: Layer | null) => {
    const previous = live.current;
    if (previous?.view === 'workstation' && next?.view === 'deck' && workstationScene.current && next.sceneKey !== workstationScene.current) {
      next = { ...next, sceneKey: workstationScene.current };
      window.history.replaceState({ ...window.history.state, clikbCreationDeck: next }, '');
    }
    if (next?.view !== 'workstation') workstationScene.current = null;
    live.current = next;
    setLayer(next);
    if (previous?.view === 'workstation' && next?.view !== 'workstation') latest.current.onCloseWorkstation?.();
    if (next?.view === 'workstation' && next.sceneKey &&
      (previous?.view !== 'workstation' || previous.sceneKey !== next.sceneKey)) {
      latest.current.onRestoreWorkstation?.(next.sceneKey);
    }
    if (previous && !next) latest.current.onRevealGrid?.(previous.sceneKey);
  };

  const pushLayer = (view: Layer['view'], sceneKey: string | null) => {
    const state = window.history.state;
    const promptId = state?.clikbPromptInput?.id;
    // Never create history above an unprotected URL or a different composer.
    if (!promptId || pendingBack.current || !latest.current.enabled || !latest.current.active) return false;
    const next: Layer = { promptId, view, sceneKey };
    window.history.pushState({ ...state, idx: (state.idx ?? 0) + 1, clikbCreationDeck: next }, '');
    applyLayer(next);
    return true;
  };

  const openDeck = (sceneKey?: string) => live.current || currentLayer() ? false : pushLayer('deck', sceneKey ?? null);
  const selectScene = (sceneKey: string) => {
    const current = currentLayer();
    if (!latest.current.enabled || !latest.current.active || pendingBack.current ||
      !current || current.sceneKey === sceneKey) return;
    if (current.view === 'workstation') workstationScene.current = sceneKey;
    const next = { ...current, sceneKey };
    window.history.replaceState({ ...window.history.state, clikbCreationDeck: next }, '');
    live.current = next;
    setLayer(next);
  };
  const openWorkstation = (sceneKey: string, preserveDeckSelection = false) => {
    if (live.current?.view !== 'deck' || currentLayer()?.view !== 'deck') return false;
    workstationScene.current = null;
    if (!preserveDeckSelection) selectScene(sceneKey);
    return pushLayer('workstation', sceneKey);
  };
  const closeLayer = (view: Layer['view']) => {
    if (pendingBack.current || live.current?.view !== view || currentLayer()?.view !== view) return false;
    pendingBack.current = true;
    window.history.back();
    return true;
  };
  const closeDeck = () => closeLayer('deck');
  const closeWorkstation = () => closeLayer('workstation');

  useEffect(() => {
    const onPop = () => {
      pendingBack.current = false;
      if (!window.history.state?.clikbPromptInput) initialized.current = false;
      // Preference changes hide Deck, while its owned editor entry still needs
      // to unwind through the same Back/Close lifecycle.
      applyLayer(currentLayer());
    };
    const onKey = (event: KeyboardEvent) => {
      const options = latest.current;
      if (event.key !== 'Escape' || event.defaultPrevented || !options.enabled || !options.active ||
        options.escapeBlocked || live.current?.view !== 'deck') return;
      // The caller tells us when a foreground popup owns Escape.
      if (closeDeck()) event.preventDefault();
    };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useLayoutEffect(() => {
    if (!options.enabled || !options.active || initialized.current) return;
    let frame = 0;
    const initialize = () => {
      const existing = currentLayer();
      if (existing) {
        initialized.current = true;
        applyLayer(existing);
      } else if (options.initiallyOpen === false || openDeck()) {
        initialized.current = true;
      } else {
        // PromptInput adds its guarded entry after the browsing backdrop settles.
        frame = requestAnimationFrame(initialize);
      }
    };
    initialize();
    return () => cancelAnimationFrame(frame);
  }, [options.enabled, options.active, options.initiallyOpen]);

  return {
    deckOpen: options.enabled && layer !== null,
    workstationOpen: layer?.view === 'workstation',
    sceneKey: options.enabled ? layer?.sceneKey ?? null : null,
    openDeck,
    selectScene,
    closeDeck,
    openWorkstation,
    closeWorkstation,
  };
}
