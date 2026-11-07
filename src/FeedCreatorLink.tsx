import './FeedCreatorLink.css';

export function FeedCreatorLink({ post, instanceId, onVisitProfile }: {
  post: { id: number | string; sender?: number | string; username?: string };
  instanceId: string;
  onVisitProfile?: (memberId: number, postId: number) => void;
}) {
  const memberId = Number(post.sender);
  const username = typeof post.username === 'string' ? post.username.replace(/^@/, '').trim() : '';
  if (!onVisitProfile || !Number.isSafeInteger(memberId) || memberId <= 0 || !username) return null;
  return <button type="button" className="feed-creator-link"
    data-ai-action={`clikb.feeds.viewport.${instanceId}.action.creator.${post.id}`}
    aria-label={`Visit @${username}`} title={`@${username}`}
    onPointerDown={event => event.stopPropagation()}
    onClick={event => { event.stopPropagation(); onVisitProfile(memberId, Number(post.id)); }}>
    @{username}
  </button>;
}
