import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { store } from './store';
import { publishNavigationArea, removeNavigationArea } from './brainstormSlice';
import { navigationControl } from './navigationControlSnapshot';

/** Owners may register a return handler, including their own unsaved-work guard. */
const owners = new Map<string, { priority: number; label: string; back: () => void }>();
export function registerSharedBack(id: string, owner: { priority: number; label: string; back: () => void }) {
  owners.set(id, owner);
  window.dispatchEvent(new Event('clikb-back-owner'));
  return () => { owners.delete(id); window.dispatchEvent(new Event('clikb-back-owner')); };
}

function target() {
  const custom = [...owners.entries()].sort((a, b) => b[1].priority - a[1].priority)[0];
  if (custom) return { id: custom[0], label: custom[1].label, run: custom[1].back };
  const priorities = ['clikb.feeds.plan.close_zoom', 'clikb.feeds.likes.close',
    'clikb.navigation.relationships.action.close', 'clikb.feeds.plan.close'];
  const controls = [...document.querySelectorAll<HTMLElement>('[data-ai-action]')];
  for (const id of [...priorities, ...controls.map(el => el.dataset.aiAction || '').filter(id => /\.(close_shared|back_to_feed)$/.test(id))]) {
    const element = controls.find(el => el.dataset.aiAction === id && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
    if (element) return { id, label: `Close active view: ${id}`, run: () => {
      if (id.endsWith('.back_to_feed')) window.history.back();
      else element.click();
    } };
  }
  return null;
}

export default function SharedBackControl() {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const [destination, setDestination] = useState('');
  useEffect(() => {
    let frame = 0;
    const update = () => {
      if (store.getState().brainstorm.userSnapshot.creation.isActive) {
        setDestination('');
        dispatch(removeNavigationArea({ areaId: 'clikb.navigation.back', source: 'SharedBackControl' }));
        return;
      }
      const owner = target();
      // Only known browsing routes use the history fallback. Creation registers its guarded handler.
      const browsing = /^\/(feeds|images|kickit|clikit|pages|search|experience|settings)(\/|$)/i.test(location.pathname) || location.pathname === '/';
      const id = owner?.id || (browsing ? Number(window.history.state?.idx) > 0 ? 'app_history' : location.pathname.toLowerCase() !== '/feeds' ? 'feeds_home' : '' : '');
      setDestination(id);
      dispatch(publishNavigationArea({ areaId: 'clikb.navigation.back', source: 'SharedBackControl',
        state: { destination: id, label: owner?.label || (id === 'app_history' ? 'Previous app view' : 'All Feeds') },
        visibleControls: [navigationControl('clikb.navigation.back', 'back', 'SharedBackControl existing owner or app history', 'candidate', !!id, id)],
      }));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; update(); }); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ai-action', 'hidden'] });
    window.addEventListener('clikb-back-owner', schedule);
    let creationActive = store.getState().brainstorm.userSnapshot.creation.isActive;
    const unsubscribe = store.subscribe(() => {
      const active = store.getState().brainstorm.userSnapshot.creation.isActive;
      if (active !== creationActive) { creationActive = active; schedule(); }
    });
    update();
    return () => { unsubscribe(); observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('clikb-back-owner', schedule); dispatch(removeNavigationArea({ areaId: 'clikb.navigation.back', source: 'SharedBackControl' })); };
  }, [dispatch, location.key, location.pathname]);
  if (!destination) return null;
  // Internal command binding, not an additional user-facing navigation button.
  return <button type="button" hidden tabIndex={-1} aria-hidden="true"
    data-ai-internal-back="true" data-ai-action="clikb.navigation.back.action.back"
    onClick={() => {
      if (store.getState().brainstorm.userSnapshot.creation.isActive) return;
      const owner = target();
      if (owner) owner.run();
      else if (store.getState().brainstorm.userSnapshot.navigation?.areas['clikb.navigation.back']?.state.destination === 'app_history') navigate(-1);
      else navigate('/feeds');
    }} />;
}
