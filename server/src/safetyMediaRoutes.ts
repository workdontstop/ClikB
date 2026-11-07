import { Request, Response, Router } from 'express';
import { randomUUID } from 'crypto';
import { MediaConvertClient, CreateJobCommand, GetJobCommand, type CreateJobCommandInput } from '@aws-sdk/client-mediaconvert';
import dotenv from 'dotenv';
import { normalizeSafetyMediaInput, safetyAudioExtractionJob, safetyAudioRemuxJob, safetyOutputLocation } from './safetyMediaJobs';

dotenv.config();
const mediaConvertClient = new MediaConvertClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID || '', secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '' },
  endpoint: process.env.MEDIA_CONVERT_ENDPOINT,
});
const audioFolder = process.env.AUDIO_OUTPUT_BUCKET || 's3://clikbatebucket/extracted-audio/';
const videoFolder = process.env.OUTPUT_BUCKET || 's3://clikbatebucket/videos-with-music/';
const role = process.env.MEDIA_CONVERT_ROLE || 'arn:aws:iam::469269069267:role/MediaConvertRole';
type Dependencies = {
  send(command: CreateJobCommand | GetJobCommand): Promise<any>;
  region(): Promise<string>;
  pause(milliseconds: number): Promise<void>;
  id(): string;
};
/** Local regression checks inject fake job responses, never a paid provider. */
export function createSafetyMediaHandlers(deps: Dependencies) {
  const submit = async (params: CreateJobCommandInput) => {
    const response = await deps.send(new CreateJobCommand(params)), jobId = response.Job?.Id;
    if (!jobId) throw new Error('MediaConvert did not return a job ID.');
    for (let attempt = 0; attempt < 110; attempt++) {
      const result = await deps.send(new GetJobCommand({ Id: jobId })), job = result.Job;
      if (job?.Status === 'COMPLETE') return String(jobId);
      if (job?.Status === 'ERROR' || job?.Status === 'CANCELED') throw new Error(`MediaConvert job ${jobId}: ${job.ErrorMessage || job.Status}`);
      await deps.pause(2500);
    }
    throw new Error(`MediaConvert job ${jobId} is still processing. Its source files are retained.`);
  };
  const extract = async (req: Request, res: Response) => {
    let input: string;
    try { input = normalizeSafetyMediaInput(req.body?.videoUrl); }
    catch (error: any) { return res.status(400).json({ error: error.message }); }
    try {
      const output = safetyOutputLocation(audioFolder, `reference-audio-${deps.id()}`, 'mp3', await deps.region());
      const jobId = await submit(safetyAudioExtractionJob(input, output.destination, role));
      return res.json({ message: 'Reference audio extracted successfully.', jobId, outputAudio: output.url });
    } catch (error: any) {
      return res.status(500).json({ error: 'Failed to extract audio from reference video', details: error.message });
    }
  };
  const remux = async (req: Request, res: Response) => {
    let video: string, audio: string;
    try { video = normalizeSafetyMediaInput(req.body?.videoUrlx); audio = normalizeSafetyMediaInput(req.body?.audioSourceUrl); }
    catch (error: any) { return res.status(400).json({ error: error.message }); }
    try {
      const output = safetyOutputLocation(videoFolder, `reference-remux-${deps.id()}`, 'mp4', await deps.region());
      const jobId = await submit(safetyAudioRemuxJob(video, audio, output.destination, role));
      return res.json({ message: 'Original reference audio remuxed onto scene video.', jobId, outputVideo: output.url });
    } catch (error: any) {
      return res.status(500).json({ error: 'Failed to remux original reference audio', details: error.message });
    }
  };
  return { extract, remux };
}
const handlers = createSafetyMediaHandlers({
  send: command => mediaConvertClient.send(command as any),
  region: () => mediaConvertClient.config.region(),
  pause: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
  id: randomUUID,
});
export const extractReferenceAudioHandler = handlers.extract;
export const remuxReferenceAudioRoute = handlers.remux;
const router: any = Router();
router.post('/extract-reference-audio', extractReferenceAudioHandler);
router.post('/remux-reference-audio', remuxReferenceAudioRoute);
export default router;
