import { useLayoutEffect, type RefObject } from 'react';

/** Size cards from the space left by the real header, Guide and footer. */
export function useDeckStageFit(stageRef: RefObject<HTMLElement | null>, layoutKey: unknown) {
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const root = stage?.closest<HTMLElement>('.deck-overlay');
    if (!stage || !root) return;
    let previous = -1;
    const measure = () => {
      const height = Math.max(0, stage.getBoundingClientRect().height);
      if (Math.abs(height - previous) < .5) return;
      previous = height;
      root.style.setProperty('--deck-stage-height', `${height}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--deck-stage-height');
    };
  }, [stageRef, layoutKey]);
}
