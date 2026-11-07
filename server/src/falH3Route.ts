import { fal } from '@fal-ai/client';
import fetch from 'node-fetch';
import { falH3Request } from './falH3Spec';

/** Uses the existing billed asynchronous Fal job and poll lifecycle. */
export async function FalH3Route(req: any, res: any) {
    let request: ReturnType<typeof falH3Request>;
    try { request = falH3Request(req.body || {}); }
    catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid Fal H3 input.' }); }
    try {
        const { endpoint, input } = request;
        const meta = { model: 'fal-h3-max', endpoint, duration: input.duration, resolution: input.resolution, native_audio: true,
            reference_images: input.reference_image_urls?.length || 0, reference_videos: input.reference_video_urls?.length || 0, reference_audios: input.reference_audio_urls?.length || 0 };
        if (req.body?.asyncMode) {
            const result = await fal.queue.submit(endpoint, { input });
            return res.json({ status: 'starting', jobId: result.request_id, provider: 'fal', modelEndpoint: endpoint, meta });
        }
        const result: any = await fal.subscribe(endpoint, { input });
        const videoUrl = result?.data?.video?.url;
        if (!videoUrl) throw new Error('Fal H3 returned no video URL.');
        if (req.body?.linkmode) return res.json({ status: 'succeeded', videoUrl, meta });
        const response = await fetch(videoUrl);
        if (!response.ok) throw new Error(`Could not retrieve Fal H3 video (${response.status}).`);
        const videoBase64 = `data:video/mp4;base64,${Buffer.from(await response.arrayBuffer()).toString('base64')}`;
        return res.json({ status: 'succeeded', videoUrl, videoBase64, meta });
    } catch (error: any) {
        return res.status(error?.status || 500).json({ error: error?.body?.detail || error?.message || 'Fal H3 generation failed.' });
    }
}
