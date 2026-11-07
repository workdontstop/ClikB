import Replicate from 'replicate';
import { fal } from '@fal-ai/client';
import { isSpatialVideoModel, spatialVideoModels, spatialVideoInput } from './spatialVideoSpec';
import type { SpatialJob } from './spatialWorld';

export async function submitSpatialVideo(req: any, res: any) {
    const body = req.body;
    const model: unknown = body.model;
    if (!isSpatialVideoModel(model)) return res.status(400).json({ message: 'Unsupported spatial video model.' });
    const spec = spatialVideoModels[model];
    const input = spatialVideoInput(model, body.job, body.resolution, body.aspect, body.audio, body.music);
    try {
        const jobId = spec.provider === 'replicate'
            ? (await new Replicate({ auth: process.env.REPLI_KEY || process.env.REPLICATE_API_TOKEN }).predictions.create({ model: spec.endpoint, input })).id
            : (await fal.queue.submit(spec.endpoint, { input })).request_id;
        return res.json({ status: 'starting', jobId, provider: spec.provider, modelEndpoint: spec.endpoint });
    } catch (error) {
        const failure = error as { status?: number; statusCode?: number; response?: { status?: number } };
        const status = Number(failure?.response?.status ?? failure?.status ?? failure?.statusCode);
        // Explicit validation/auth/rate-limit rejections did not create a job.
        // Transport errors and server failures may have: preserve recovery for those.
        const rejected = [400, 401, 403, 404, 413, 422, 429].includes(status);
        return res.status(rejected ? status : 502).json({ message: error instanceof Error ? error.message : 'Provider submission was not acknowledged.', ambiguous: !rejected });
    }
}
export async function cancelSpatialVideo(job: SpatialJob) {
    if (!job.providerJobId) return;
    if (job.provider === 'replicate') await new Replicate({ auth: process.env.REPLI_KEY || process.env.REPLICATE_API_TOKEN }).predictions.cancel(job.providerJobId);
    else if (job.provider === 'fal' && job.endpoint) await fal.queue.cancel(job.endpoint, { requestId: job.providerJobId });
}
