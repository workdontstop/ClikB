import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from './store';

type PromptLayer = { id: string; baseIndex: number };
export const createPromptInputHistoryOwner = () => ({
  owned: { current: null as PromptLayer | null },
  previousOpen: { current: false },
  popupEntry: { current: null as { state: any; url: string } | null },
  manualClose: { current: false },
});
type Options = {
  open: boolean;
  suspended: boolean;
  blockBack: boolean;
  routeKey: string;
  onClose: () => void;
  onReopen: () => void;
  historyOwner?: ReturnType<typeof createPromptInputHistoryOwner>;
};

/** One popup entry above the existing view, preserving its router state. */
export function usePromptInputHistory(options: Options) {
  const deckEnabled = useSelector((state: RootState) => state.settings.deckEnabled !== false);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate); navigateRef.current = navigate;
  const latest = useRef(options); latest.current = options;
  const localOwner = useRef(createPromptInputHistoryOwner());
  const { owned, previousOpen, popupEntry, manualClose } = options.historyOwner ?? localOwner.current;

  useEffect(() => {
    const onPop = () => {
      const layer: PromptLayer | undefined = window.history.state?.clikbPromptInput;
      if (layer) {
        owned.current = layer;
        popupEntry.current = { state: window.history.state, url: window.location.href };
        if (!latest.current.open) latest.current.onReopen();
      } else if (owned.current && (latest.current.open || manualClose.current)
        && (!latest.current.suspended || manualClose.current)) {
        // Keep active generation/results protected without adding more entries
        // or overwriting the router's state and Forward history.
        if (!manualClose.current && latest.current.blockBack) window.history.forward();
        else {
          manualClose.current = false;
          const state = window.history.state;
          const saved = popupEntry.current;
          // A card/category-backdrop change while composing belongs to the
          // same underlying view. Preserve it when removing only the popup.
          // Multi-entry Back must still reach its actual requested destination.
          if (saved && state?.idx === owned.current.baseIndex
            && (window.location.href !== saved.url || JSON.stringify(state.usr) !== JSON.stringify(saved.state.usr))) {
            const url = new URL(saved.url);
            navigateRef.current({ pathname: url.pathname, search: url.search, hash: url.hash },
              { replace: true, state: saved.state.usr });
          }
          if (latest.current.open) latest.current.onClose();
        }
      }
    };
    // Only this popup's own predecessor can be reconciled, never another route.
    window.addEventListener('popstate', onPop, true);
    // A funnel reset can remount this hook between X and the asynchronous Back
    // event. That is still the same close, not a request to reopen the popup.
    if (window.history.state?.clikbPromptInput && !manualClose.current
      && !(!options.open && previousOpen.current)) onPop();
    return () => window.removeEventListener('popstate', onPop, true);
  }, []);

  useEffect(() => {
    const wasOpen = previousOpen.current;
    previousOpen.current = options.open;
    const currentState = window.history.state;
    const currentLayer: PromptLayer | undefined = currentState?.clikbPromptInput;
    if (!options.open) {
      if (currentState?.usr?.socialChat && !currentLayer) {
        // Chat replaced the composer entry. Back now belongs to Chat.
        owned.current = null;
        popupEntry.current = null;
        manualClose.current = false;
        return;
      }
      // The X and browser Back consume the same layer. A Back that already
      // reached the underlying entry must not move history a second time.
      if (wasOpen && owned.current && (currentLayer?.id === owned.current.id
        || currentState?.idx === owned.current.baseIndex + 1)) {
        // A same-frame Deck hydration may have replaced the marker before X.
        // The owned index still identifies this popup, with the newest view.
        popupEntry.current = { state: { ...currentState, clikbPromptInput: owned.current }, url: window.location.href };
        manualClose.current = true;
        // Creation Deck and its workstation are children of this prompt entry.
        // A confirmed close consumes the complete prompt stack at once.
        const distance = Number(currentState?.idx) - owned.current.baseIndex;
        if (currentState?.clikbCreationDeck?.promptId === owned.current.id && distance > 1) window.history.go(-distance);
        else window.history.back();
      }
      return;
    }
    if (options.suspended) return;
    if (!wasOpen && !currentLayer) owned.current = null;
    if (currentLayer) {
      owned.current = currentLayer;
      popupEntry.current = { state: currentState, url: window.location.href };
      return;
    }
    // An existing category/view transition can push a new Deck while the
    // composer stays open. Give that new view its own popup predecessor.
    if (owned.current && currentState?.idx > owned.current.baseIndex + 1) owned.current = null;
    if (owned.current && currentState?.idx === owned.current.baseIndex + 1) {
      window.history.replaceState({ ...currentState, clikbPromptInput: owned.current }, '');
      popupEntry.current = { state: window.history.state, url: window.location.href };
      return;
    }

    let frame = 0;
    const addLayer = () => {
      if (!latest.current.open || latest.current.suspended) return;
      const state = window.history.state;
      // Creation's existing Deck arrival must finish before adding its popup.
      if (deckEnabled && (state?.usr?.clikbDeckEntrance || (!owned.current && state?.usr?.clikbDeckGrid && !state?.usr?.clikbDeck))) {
        frame = requestAnimationFrame(addLayer);
        return;
      }
      if (state?.clikbPromptInput) {
        owned.current = state.clikbPromptInput;
        popupEntry.current = { state, url: window.location.href };
        return;
      }
      if (owned.current) {
        if (state?.idx <= owned.current.baseIndex) return;
        // Deck selection/hydration may replace its current router entry while
        // the popup is open. Keep that entry's data and the same popup layer.
        window.history.replaceState({ ...state, clikbPromptInput: owned.current }, '');
        popupEntry.current = { state: window.history.state, url: window.location.href };
        return;
      }
      const layer = { id: `prompt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        baseIndex: state?.idx ?? 0 };
      owned.current = layer;
      window.history.pushState({ ...state, idx: (state?.idx ?? 0) + 1,
        key: layer.id, clikbPromptInput: layer }, '', window.location.href);
      popupEntry.current = { state: window.history.state, url: window.location.href };
    };
    frame = requestAnimationFrame(addLayer);
    return () => cancelAnimationFrame(frame);
  }, [options.open, options.suspended, options.routeKey, deckEnabled]);

  useEffect(() => {
    if (!options.open || options.suspended) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault(); event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [options.open, options.suspended]);
}
