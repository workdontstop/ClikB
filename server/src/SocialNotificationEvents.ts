import type { TransactionQuery } from './execQuery';

/** Record the notifications in the same transaction as the new member's wallet. */
export async function recordSignupNotifications(query: TransactionQuery, memberId: number, pixels: number): Promise<void> {
  if (!Number.isSafeInteger(memberId) || memberId <= 1 || !Number.isSafeInteger(pixels) || pixels < 0) {
    throw new Error('Invalid new-member notification identity or credit.');
  }
  await query(`INSERT INTO social_notifications (recipient_id,actor_id,kind,event_key,body)
    VALUES (?,?, 'welcome', ?, ?), (?,?, 'credit', ?, ?)`, [
    memberId, memberId, `welcome:${memberId}`,
    'Welcome to ClikBSocial. Create, share, and explore with your creative identities.',
    memberId, memberId, `signup-pixels:${memberId}`,
    `${pixels.toLocaleString('en-US')} P added to your Main account as your welcome credit. Your Creative Profiles share these Pixels.`,
  ]);
}
