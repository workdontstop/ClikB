const retiredLayers = new WeakMap<Window, Set<string>>();
function retire(win: Window, id: string) {
  let ids = retiredLayers.get(win);
  if (!ids) {
    ids = new Set(); retiredLayers.set(win, ids);
    win.addEventListener('popstate', () => {
      const entry = win.history.state?.clikbTemplateHistory;
      // Native history retains a Forward branch after closing a popup. Skip
      // only our retired entries, so they cannot strand the composer on one.
      if (entry && ids!.has(entry.id)) win.history.go(-entry.depth);
    });
  }
  ids.add(id);
  if (ids.size > 100) ids.delete(ids.values().next().value!);
}

/** A template popup owns only entries above its existing router/composer entry. */
export function createTemplateHistory<T>(win: Window, initial: T, options: {
  restore: (view: T) => void; close: () => void; busy: () => boolean;
}) {
  const id = `templates-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let active = true;
  let closing: (() => void) | undefined;
  let lastIndex = win.history.state?.idx ?? 0;
  const marker = () => win.history.state?.clikbTemplateHistory;
  const push = (view: T) => {
    if (!active || closing) return;
    const state = win.history.state || {};
    const depth = marker()?.id === id ? marker().depth : 0;
    lastIndex = (state.idx ?? lastIndex) + 1;
    win.history.pushState({ ...state, idx: lastIndex,
      clikbTemplateHistory: { id, depth: depth + 1, view } }, '', win.location.href);
    options.restore(view);
  };
  const pop = () => {
    if (!active) return;
    const entry = marker();
    if (entry?.id === id) {
      lastIndex = win.history.state.idx;
      options.restore(entry.view);
      return;
    }
    if (!closing && options.busy()) {
      // Keep generation mounted at the gallery; detail -> gallery is allowed.
      win.history.go(Math.max(1, lastIndex - (win.history.state?.idx ?? lastIndex - 1)));
      return;
    }
    active = false;
    retire(win, id);
    win.removeEventListener('popstate', pop);
    options.close();
    closing?.();
  };
  win.addEventListener('popstate', pop);
  push(initial);
  return {
    push,
    replace(view: T) {
      const entry = marker();
      if (active && !closing && entry?.id === id) win.history.replaceState({ ...win.history.state,
        clikbTemplateHistory: { ...entry, view } }, '', win.location.href);
    },
    back() { if (active) win.history.back(); },
    close(after?: () => void) {
      if (!active || closing || options.busy()) return;
      closing = after || (() => {});
      const entry = marker();
      if (entry?.id === id) win.history.go(-entry.depth);
      else pop();
    },
    dispose() {
      win.removeEventListener('popstate', pop);
      const entry = marker();
      if (active) {
        retire(win, id);
        if (entry?.id === id) win.history.go(-entry.depth);
      }
      active = false;
    },
  };
}
