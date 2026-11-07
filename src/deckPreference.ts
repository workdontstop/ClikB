import axios from 'axios';
import type { Store } from '@reduxjs/toolkit';
import { updateProfileDeckEnabled } from './profileSlice';
import { setDeckEnabled } from './settingsSlice';
import type { RootState } from './store';

const pendingByStore = new WeakMap<Store<RootState>, Set<number>>();

/** Settings and Guide share the same account preference and save lock. */
export async function saveDeckPreference(store: Store<RootState>, baseUrl: string, enabled: boolean) {
    const userId = store.getState().profile.loggedUser?.id;
    if (!userId) return false;

    let pending = pendingByStore.get(store);
    if (!pending) {
        pending = new Set();
        pendingByStore.set(store, pending);
    }
    if (pending.has(userId)) return false;
    pending.add(userId);

    const previous = store.getState().settings.deckEnabled;
    store.dispatch(setDeckEnabled(enabled));
    try {
        await axios.post(`${baseUrl}/settings/deck`, { enabled }, { withCredentials: true });
        if (store.getState().profile.loggedUser?.id !== userId) return false;
        store.dispatch(updateProfileDeckEnabled({ userId, enabled }));
        return true;
    } catch (error) {
        if (store.getState().profile.loggedUser?.id !== userId) return false;
        store.dispatch(setDeckEnabled(previous));
        throw error;
    } finally {
        pending.delete(userId);
    }
}
