import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { publishFeedsArea, removeFeedsArea } from './brainstormSlice';
import { FEEDS_MAX_VISIBLE_CARDS, FEEDS_MAX_VISIBLE_REFS, applyFeedCardOcclusion, detailedVisibleIds, feedInstanceId, feedScrollAvailability, measureFeedCardVisibility, summariseVisiblePostRefs, summariseVisiblePosts, type FeedAreaId, type FeedControl, type FeedVisibleCard } from './feedsControlSnapshot';

/** The layout measures the cards it rendered; FeedsGate only knows what it loaded. */
export const useFeedCardSnapshot = (
  feedContainerRef: React.RefObject<HTMLElement>,
  feeds: Record<string, unknown>[],
  type: number,
  vertical: boolean,
  mobileDocumentScroll: boolean,
  isFullscreen: boolean,
  horizontalMobile = false,
  hiddenByDeck = false,
) => {
  const dispatch = useDispatch();
  const instanceId = feedInstanceId(type, vertical);
  const areaId: FeedAreaId = `clikb.feeds.viewport.${instanceId}`;

  useEffect(() => {
    let frame = 0;
    let settleTimer = 0;
    let settledAt: number | null = null;
    const container = feedContainerRef.current;
    const owner = mobileDocumentScroll ? window : container;
    if (!container || !owner) return;
    const measure = (isScrolling = false) => {
      const root = mobileDocumentScroll ? document.documentElement : container;
      const axis = vertical ? 'vertical' : 'horizontal';
      const offset = vertical ? (mobileDocumentScroll ? window.scrollY : container.scrollTop) : container.scrollLeft;
      const size = vertical ? (mobileDocumentScroll ? window.innerHeight : container.clientHeight) : container.clientWidth;
      const extent = vertical ? root.scrollHeight : root.scrollWidth;
      const maxOffset = Math.max(0, extent - size);
      const containerBounds = container.getBoundingClientRect();
      const bounds = mobileDocumentScroll
        ? { top: 0, bottom: innerHeight, left: 0, right: innerWidth }
        : { top: Math.max(0, containerBounds.top), bottom: Math.min(innerHeight, containerBounds.bottom),
          left: Math.max(0, containerBounds.left), right: Math.min(innerWidth, containerBounds.right) };
      const allVisibleCards: FeedVisibleCard[] = isFullscreen || hiddenByDeck ? [] : [...container.querySelectorAll<HTMLElement>('[data-feed-post-id]')]
        .map(card => {
          const rect = card.getBoundingClientRect();
          const geometry = measureFeedCardVisibility(rect, bounds);
          if (!geometry.visiblePercent) return { id: card.dataset.feedPostId || '', ...geometry, occluded: false };
          const left = Math.max(rect.left, bounds.left, 0);
          const right = Math.min(rect.right, bounds.right, innerWidth);
          const top = Math.max(rect.top, bounds.top, 0);
          const bottom = Math.min(rect.bottom, bounds.bottom, innerHeight);
          let clearSamples = 0;
          let sampleCount = 0;
          if (right > left && bottom > top) {
            for (const yPart of [0.15, 0.5, 0.85]) for (const xPart of [0.15, 0.5, 0.85]) {
              const hit = document.elementFromPoint(left + (right - left) * xPart, top + (bottom - top) * yPart);
              sampleCount++;
              if (hit && card.contains(hit)) clearSamples++;
            }
          }
          return { id: card.dataset.feedPostId || '', ...applyFeedCardOcclusion(geometry, clearSamples, sampleCount) };
        })
        .filter(card => card.id && card.visiblePercent > 0);
      const visibleIds = detailedVisibleIds(allVisibleCards);
      const visiblePosts = summariseVisiblePosts(feeds, visibleIds);
      const visiblePostRefs = summariseVisiblePostRefs(feeds, allVisibleCards);
      const visibleControls = visiblePostRefs.flatMap<FeedControl>(ref => {
        const post = feeds.find(post => Number(post.id) === ref.postId);
        const memberId = Number(post?.sender);
        const username = typeof post?.username === 'string' ? post.username.replace(/^@/, '').trim().slice(0, 48) : '';
        const controls: FeedControl[] = [{
          areaId, controlId: `${areaId}.control.open.${ref.postId}`,
          handlerRef: 'StoryAutoScroller.onClick → FeedsGate.handleOpenPostId',
          candidateActionId: `${areaId}.action.open.${ref.postId}`,
          label: ref.labelHint || `Post ${ref.postId}`,
          enabled: ref.fullyVisible,
          aiPolicy: 'candidate', targetId: ref.postId,
          ...(!ref.fullyVisible
            ? { disabledReason: 'Card is only partly visible; scroll until it is fully in view' } : {}),
        }];
        if (type !== 10 && Number.isSafeInteger(memberId) && memberId > 0 && username) controls.push({
          areaId, controlId: `${areaId}.control.creator.${ref.postId}`,
          handlerRef: 'FeedCreatorLink.onClick → FeedsGate.visitCreatorFromGrid',
          candidateActionId: `${areaId}.action.creator.${ref.postId}`,
          label: `Visit @${username}`, enabled: ref.fullyVisible,
          aiPolicy: 'candidate', targetId: memberId,
          ...(!ref.fullyVisible ? { disabledReason: 'Scroll until the creator link is fully visible' } : {}),
        });
        return controls;
      });
      const { canScrollBackward, canScrollForward, region } = feedScrollAvailability(offset, maxOffset, vertical, horizontalMobile);
      dispatch(publishFeedsArea({
        areaId, source: vertical ? 'FeedLayout' : 'FeedLayoutHorizontal', instanceId,
        state: {
          axis, scrollOwner: mobileDocumentScroll ? 'document' : 'feedContainerRef',
          region,
          canScrollBackward, canScrollForward, offsetBucketPx: Math.floor(offset / 100) * 100,
          isScrolling, settledAt, loadedCount: feeds.length, hiddenByFullscreen: isFullscreen,
          visibleCardCount: allVisibleCards.length, fullyVisibleCardCount: allVisibleCards.filter(card => card.fullyVisible).length,
          hiddenByDeck,
          visibleCardLimitReached: allVisibleCards.length > FEEDS_MAX_VISIBLE_CARDS,
          visibleRefLimitReached: allVisibleCards.length > FEEDS_MAX_VISIBLE_REFS,
        },
        visiblePosts, visiblePostRefs, visibleControls,
      }));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(true); });
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => { settleTimer = 0; settledAt = Date.now(); measure(false); }, 180);
    };
    const onOverlayChange = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(false); });
    };
    frame = requestAnimationFrame(() => { frame = 0; measure(false); });
    owner.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onScroll);
    resizeObserver?.observe(container);
    // Guide, menus and modals may cover a card without moving the scroll owner.
    const overlayObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(onOverlayChange);
    overlayObserver?.observe(document.body, { subtree: true, childList: true, attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'] });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (settleTimer) clearTimeout(settleTimer);
      owner.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      resizeObserver?.disconnect();
      overlayObserver?.disconnect();
      dispatch(removeFeedsArea({ areaId, source: vertical ? 'FeedLayout' : 'FeedLayoutHorizontal' }));
    };
  }, [dispatch, feedContainerRef, feeds, areaId, instanceId, vertical, mobileDocumentScroll, isFullscreen, horizontalMobile, hiddenByDeck]);
};
