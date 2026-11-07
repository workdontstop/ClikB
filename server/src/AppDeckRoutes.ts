import type { Request, Response } from 'express';
import execQuery from './execQuery';
import { authenticatedUserId } from './requestAuth';

export async function readMemberDeckEnabled(userId: number): Promise<boolean> {
  try {
    const rows: any = await execQuery('SELECT deck_enabled FROM members WHERE id = ?', [userId]);
    return Number(rows[0]?.deck_enabled ?? 1) !== 0;
  } catch (error: any) {
    // A rolling deployment must not break login before its additive migration.
    if (error?.code === 'ER_BAD_FIELD_ERROR') return true;
    throw error;
  }
}

export async function saveMemberDeckEnabled(req: Request, res: Response): Promise<void> {
  const userId = authenticatedUserId(req);
  if (!userId) { res.status(401).json({ message: 'Please sign in again to save your Deck setting.' }); return; }
  if (typeof req.body?.enabled !== 'boolean') { res.status(400).json({ message: 'Choose On or Off.' }); return; }
  try {
    await execQuery('UPDATE members SET deck_enabled = ? WHERE id = ?', [req.body.enabled ? 1 : 0, userId]);
    res.status(200).json({ enabled: req.body.enabled });
  } catch {
    res.status(500).json({ message: 'Your Deck setting could not be saved. Please try again.' });
  }
}
