/** Keep local generated media with its post when a feed is replaced/reordered. */
export function reindexPostMedia<T>(previous: T[], previousIds: number[], posts: Record<string, any>[], fromPost: (post: Record<string, any>) => T): T[] {
  const byId = new Map(previousIds.map((id, index) => [id, previous[index]]));
  return posts.map(post => {
    const saved = byId.get(Number(post.id));
    return saved && (!Array.isArray(saved) || saved.length > 0) ? saved : fromPost(post);
  });
}
