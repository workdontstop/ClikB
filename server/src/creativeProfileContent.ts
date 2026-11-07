import type { TransactionQuery } from './execQuery';

/** Serialize new content with removal of its Creative Profile. */
export async function canWriteCreativeProfileContent(query: TransactionQuery, memberId: string | number): Promise<boolean> {
  try {
    const [profile] = await query('SELECT deleted_at FROM creative_profiles WHERE member_id=? FOR UPDATE', [memberId]);
    return !profile?.deleted_at;
  } catch (error: any) {
    if (error?.code === 'ER_NO_SUCH_TABLE') return true;
    throw error;
  }
}
