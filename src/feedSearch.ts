/** Feed UI types differ from posts.mode, especially Games (3 -> 2). */
export function searchFeedMode(type: number): number {
  if (![1, 2, 3].includes(type)) throw new Error('Unsupported search collection.');
  return type - 1;
}

export function searchFeedCursor(query: string, type: number, lastPost: any) {
  const score = Number(lastPost?.score), id = Number(lastPost?.id);
  if (lastPost?.score == null || !Number.isFinite(score) || score < 0 || !Number.isSafeInteger(id) || id <= 0) return undefined;
  return { query: query.trim(), mode: searchFeedMode(type), score, id };
}
