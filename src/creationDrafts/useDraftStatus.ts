import { useSyncExternalStore } from 'react';
import type { DraftController, DraftState } from './store';
const empty = { saved: false, isSaving: false, pending: false, hydrating: false, error: null, localError: null, closed: false, conflicted: false } as DraftState;
const noSubscribe = () => () => {};
const getEmpty = () => empty;
export const useDraftStatus = (controller: DraftController | null | undefined): DraftState =>
  useSyncExternalStore(controller?.subscribe || noSubscribe, controller?.getState || getEmpty, controller?.getState || getEmpty);
