import { useCallback, useEffect, useRef, useState } from 'react';
import type { NavigationViewport } from './navigationControlSnapshot';

const sameViewport = (a: NavigationViewport | null, b: NavigationViewport) =>
  a != null && JSON.stringify(a) === JSON.stringify(b);

/** Observe one owning container. IDs come only from rendered descendants. */
export const useNavigationViewport = (axis: NavigationViewport['axis'], refreshKey: unknown) => {
  const ref = useRef<HTMLElement | null>(null);
  const [viewport, setViewport] = useState<NavigationViewport | null>(null);
  const frameRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);

  const measure = useCallback((settled = false, initial = false) => {
    const element = ref.current;
    if (!element) return;
    const offset = axis === 'vertical' ? element.scrollTop : element.scrollLeft;
    const extent = axis === 'vertical' ? element.scrollHeight : element.scrollWidth;
    const viewportSize = axis === 'vertical' ? element.clientHeight : element.clientWidth;
    const maxOffset = Math.max(0, extent - viewportSize);
    const canScrollBackward = offset > 2;
    const canScrollForward = offset < maxOffset - 2;
    const region = maxOffset <= 2 ? 'all' : !canScrollBackward ? 'start' : !canScrollForward ? 'end' : 'middle';
    const bounds = element.getBoundingClientRect();
    const visibleIds = [...element.querySelectorAll<HTMLElement>('[data-navigation-scroll-id]')]
      .filter(child => {
        const rect = child.getBoundingClientRect();
        return axis === 'vertical'
          ? rect.bottom > bounds.top && rect.top < bounds.bottom
          : rect.right > bounds.left && rect.left < bounds.right;
      })
      .map(child => child.dataset.navigationScrollId || '')
      .filter(Boolean)
      .slice(0, 20);
    setViewport(previous => {
      const next: NavigationViewport = {
        axis, region, canScrollBackward, canScrollForward, visibleIds,
        offsetBucketPx: Math.floor(offset / 100) * 100,
        isScrolling: !settled && !initial,
        settledAt: settled ? Date.now() : previous?.settledAt ?? null,
      };
      return sameViewport(previous, next) ? previous : next;
    });
  }, [axis]);

  const onScroll = useCallback(() => {
    if (frameRef.current == null) frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      measure(false);
    });
    if (settleTimerRef.current != null) window.clearTimeout(settleTimerRef.current);
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      measure(true);
    }, 180);
  }, [measure]);

  useEffect(() => {
    setViewport(null);
    const frame = window.requestAnimationFrame(() => measure(false, true));
    const onResize = () => measure(false, true);
    window.addEventListener('resize', onResize);
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize);
    if (ref.current && resizeObserver) {
      resizeObserver.observe(ref.current);
      ref.current.querySelectorAll<HTMLElement>('[data-navigation-scroll-id]').forEach(child => resizeObserver.observe(child));
    }
    return () => {
      window.cancelAnimationFrame(frame);
      if (frameRef.current != null) window.cancelAnimationFrame(frameRef.current);
      if (settleTimerRef.current != null) window.clearTimeout(settleTimerRef.current);
      frameRef.current = null;
      settleTimerRef.current = null;
      window.removeEventListener('resize', onResize);
      resizeObserver?.disconnect();
    };
  }, [measure, refreshKey]);

  return { ref, viewport, onScroll };
};
