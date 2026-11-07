import type { CreationContext } from './creationControlIdentity';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';

type Reply = { status: string; snapshot?: unknown; actionId?: string; detail?: string };
type Pending = { resolve: (reply: Reply) => void; timer: ReturnType<typeof setTimeout> };
const pending = new Map<string, Pending>();

/** One-shot reply to a command carried by an active Brainstorm SSE stream. */
export const navigationBrowserReply = (req: Request, res: Response) => {
  const id = String(req.body?.requestId || '');
  const entry = pending.get(id);
  if (!entry) { res.status(410).json({ status: 'expired' }); return; }
  pending.delete(id);
  clearTimeout(entry.timer);
  entry.resolve(req.body?.reply && typeof req.body.reply === 'object' ? req.body.reply : { status: 'invalid_reply' });
  res.json({ status: 'received' });
};

export const requestNavigationBrowser = (
  send: (message: unknown) => void,
  command: 'snapshot' | 'action' | 'scroll' | 'text',
  actionId?: string,
  expectedVersion?: number,
  scrollId?: string,
  direction?: 'forward' | 'backward',
  confirmedTargetId?: number | string,
  expectedFeedsContext?: string,
  text?: string,
  expectedCreationContext?: CreationContext,
): Promise<Reply> => {
  if (pending.size >= 100) return Promise.resolve({ status: 'unavailable', detail: 'Too many pending browser requests' });
  const requestId = randomUUID();
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      pending.delete(requestId);
      resolve({ status: 'timeout', detail: 'Browser did not return an observation' });
    }, 20000);
    pending.set(requestId, { resolve, timer });
    send({ type: 'navigation_browser_request', requestId, command, actionId, expectedVersion, scrollId, direction, confirmedTargetId, expectedFeedsContext, text, expectedCreationContext });
  });
};
