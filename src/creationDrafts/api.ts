import type { DraftCapabilities, DraftCheckpointRequest, DraftRecord } from '../../server/src/creationDrafts/schema';

export class DraftApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly body?: any) {
    super(message); this.name = 'DraftApiError';
  }
}
export interface DraftApi {
  read(postId: number): Promise<DraftRecord>;
  checkpoint(request: DraftCheckpointRequest): Promise<DraftRecord>;
  capabilities(postId: number): Promise<DraftCapabilities>;
  allowRemix(postId: number, allowRemix: boolean): Promise<DraftCapabilities>;
  remix(postId: number, requestId: string): Promise<any>;
  remixJob(jobId: string): Promise<any>;
}

export function createDraftApi(baseUrl = '', request: typeof fetch = (input, init) => fetch(input, init)): DraftApi {
  const base = baseUrl.replace(/\/$/, '');
  const json = async <T>(path: string, method = 'GET', body?: unknown): Promise<T> => {
    const response = await request(`${base}${path}`, {
      method, credentials: 'include', cache: 'no-store',
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new DraftApiError(data.error || data.message || 'Creation draft could not be saved.', response.status, data.code, data);
    return data as T;
  };
  return {
    read: postId => json(`/creation-drafts/posts/${postId}`),
    checkpoint: request => json('/creation-drafts/checkpoint', 'POST', request),
    capabilities: postId => json(`/creation-drafts/posts/${postId}/capabilities`),
    allowRemix: (postId, allowRemix) => json(`/posts/${postId}/allow-remix`, 'PUT', { allowRemix }),
    remix: (postId, requestId) => json(`/posts/${postId}/remix`, 'POST', { requestId }),
    remixJob: jobId => json(`/creation-remix-jobs/${encodeURIComponent(jobId)}`),
  };
}
