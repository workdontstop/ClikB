/** Feed queries can intentionally overlap their cursor window; render each post ID once. */
export const appendUnseenFeedPosts = <T extends { id: number | string }>(
  loaded: T[],
  incoming: T[],
): T[] => {
  const seen = new Set(loaded.map(post => String(post.id)));
  const unseen = incoming.filter(post => {
    const id = String(post.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return unseen.length ? [...loaded, ...unseen] : loaded;
};
