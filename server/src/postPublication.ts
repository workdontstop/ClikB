/** Existing video=1 completes Cinema; reserve 100 for newly created, unpublished posts. */
export const DRAFT_POST_VIDEO = 100;
// Preserve older public rows (0/1/NULL). Only explicitly marked new drafts are hidden.
export const PUBLIC_POST_SQL = 'COALESCE(posts.video, 0) <> 100';

export function profilePublicationSql(sql: string, profileId: unknown, authenticatedId: string | null): string {
  const ownProfile = authenticatedId != null && Number(profileId) === Number(authenticatedId);
  return ownProfile ? sql : sql.replace('ORDER BY posts.id DESC', `AND ${PUBLIC_POST_SQL}\nORDER BY posts.id DESC`);
}
