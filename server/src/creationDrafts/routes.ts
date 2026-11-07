import type { Express, Request, Response } from 'express';
import execQuery, { withTransaction } from '../execQuery';
import { authenticatedOwnerId, authenticatedUserId } from '../requestAuth';
import { copyCreationMediaObject, postMediaStorageUrl } from '../S3Routes';
import { createDraftRepository, DraftError, type DraftActor } from './repository';
import { draftsNotInstalled } from './retention';
import { creationGuestScope } from './auth';

const repository = createDraftRepository({ query: execQuery, transaction: withTransaction, canonicalMedia: postMediaStorageUrl, copyMedia: copyCreationMediaObject });
export function draftRequestActor(req: Request, res: Response, createScope = false): DraftActor {
  const id = authenticatedUserId(req);
  if (!id) throw new DraftError(401, 'SIGN_IN_REQUIRED', 'Please sign in.');
  const development = process.env.APP_STATE === 'dev';
  return { id, ownerId: authenticatedOwnerId(req), development, guestScope: id === '1' ? creationGuestScope(req, res, createScope) : null };
}
function fail(res: Response, error: unknown) {
  if (draftsNotInstalled(error)) return res.status(503).json({ code: 'DRAFTS_NOT_INSTALLED', error: 'Creation drafts are not available on this server yet.' });
  if (error instanceof DraftError) return res.status(error.status).json({ code: error.code, error: error.message });
  if (error instanceof SyntaxError || (error instanceof Error && /Invalid|Unsupported|snapshot|Draft|draft|Creation identity|creation type|nesting/.test(error.message))) return res.status(400).json({ code: 'INVALID_DRAFT', error: error.message });
  console.error('Creation draft operation failed.');
  return res.status(500).json({ code: 'DRAFT_OPERATION_FAILED', error: 'Creation could not be saved. Please retry.' });
}
const handler = (run: (req: Request, res: Response) => Promise<any>) => async (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'private, no-store');
  try { await run(req, res); } catch (error) { fail(res, error); }
};
export function registerCreationDraftRoutes(app: Express) {
  app.get('/creation-drafts/posts/:postId/capabilities', handler(async (req, res) => {
    res.json(await repository.capabilities(draftRequestActor(req, res), Number(req.params.postId)));
  }));
  app.get('/creation-drafts/posts/:postId', handler(async (req, res) => {
    res.json(await repository.read(draftRequestActor(req, res), Number(req.params.postId)));
  }));
  app.post('/creation-drafts/checkpoint', handler(async (req, res) => {
    const actor = draftRequestActor(req, res, true);
    for (let attempt = 0; ; attempt++) {
      try { res.json(await repository.checkpoint(actor, req.body)); return; }
      catch (error: any) { if (attempt < 2 && ['ER_DUP_ENTRY','ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error?.code)) continue; throw error; }
    }
  }));
  app.put('/posts/:postId/allow-remix', handler(async (req, res) => {
    if (typeof req.body?.allowRemix !== 'boolean') throw new DraftError(400, 'INVALID_PERMISSION', 'A boolean remix permission is required.');
    res.json(await repository.allowRemix(draftRequestActor(req, res), Number(req.params.postId), req.body.allowRemix));
  }));
  app.post('/posts/:postId/remix', handler(async (req, res) => {
    const actor = draftRequestActor(req, res, true);
    let job;
    for (let attempt = 0; ; attempt++) {
      try { job = await repository.prepareRemix(actor, Number(req.params.postId), req.body?.requestId); break; }
      catch (error: any) { if (attempt < 2 && ['ER_DUP_ENTRY','ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error?.code)) continue; throw error; }
    }
    // Do not hold a browser request or SQL transaction open for all media copies.
    void repository.finishRemix(actor, job.job_id).catch(() => {});
    res.status(202).json({ jobId: job.job_id, status: 'preparing', state: 'preparing' });
  }));
  app.get('/creation-remix-jobs/:jobId', handler(async (req, res) => {
    const actor = draftRequestActor(req, res);
    const job = (await execQuery('SELECT job_id,status,guest_scope FROM creation_remix_jobs WHERE job_id=? AND user_id=?', [req.params.jobId, actor.id]))[0];
    if (!job || (actor.id === '1' && !actor.development && job.guest_scope !== actor.guestScope)) throw new DraftError(404, 'REMIX_NOT_FOUND', 'Remix preparation not found.');
    if (job.status === 'ready') { res.json(await repository.finishRemix(actor, job.job_id)); return; }
    if (job.status === 'failed') { res.status(502).json({ jobId: job.job_id, status: 'failed', state: 'failed', code: 'COPY_RETRY_REQUIRED', error: 'Remix preparation was interrupted. Retry Remix to continue the same copy.' }); return; }
    void repository.finishRemix(actor, job.job_id).catch(() => {});
    res.json({ jobId: job.job_id, status: 'preparing', state: 'preparing' });
  }));
}
