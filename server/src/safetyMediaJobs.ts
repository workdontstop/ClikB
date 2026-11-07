import type { CreateJobCommandInput } from '@aws-sdk/client-mediaconvert';

/** Translate actual S3 URLs only. MediaConvert also supports HTTPS inputs. */
export function normalizeSafetyMediaInput(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 16_000) throw new Error('A valid media URL is required.');
  const raw = value.trim();
  if (raw.startsWith('s3://')) {
    if (!/^s3:\/\/[^/\s?#]+\/[^\s?#]+/.test(raw) || /[?#]/.test(raw)) throw new Error('Invalid S3 media URI.');
    return raw;
  }
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('A valid media URL is required.'); }
  if (url.protocol !== 'https:' || url.username || url.password || !url.pathname || url.pathname === '/') throw new Error('Use an HTTPS media file URL.');
  const virtual = url.hostname.match(/^(.+)\.s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com(?:\.cn)?$/i);
  const pathStyle = /^s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com(?:\.cn)?$/i.test(url.hostname);
  if (virtual) return `s3://${virtual[1]}/${decodeURIComponent(url.pathname.slice(1))}`;
  if (pathStyle) {
    const path = decodeURIComponent(url.pathname.slice(1));
    if (!path.includes('/') || path.endsWith('/')) throw new Error('S3 URL must identify a media file.');
    return `s3://${path}`;
  }
  return raw;
}

export function safetyOutputLocation(folder: string, basename: string, extension: 'mp3' | 'mp4', region: string) {
  const prefix = folder.trim().replace(/\/+$/, '') + '/';
  const match = prefix.match(/^s3:\/\/([^/\s?#]+)\/(.*)$/);
  if (!match || !/^[\w-]+$/.test(basename)) throw new Error('Invalid media output destination.');
  const key = `${match[2]}${basename}.${extension}`;
  return { destination: `${prefix}${basename}`,
    url: `https://${match[1]}.s3.${region}.amazonaws.com/${key.split('/').map(encodeURIComponent).join('/')}` };
}

export function safetyAudioExtractionJob(input: string, destination: string, role: string): CreateJobCommandInput {
  return { Role: role, Settings: {
    TimecodeConfig: { Source: 'ZEROBASED' },
    Inputs: [{ FileInput: input, TimecodeSource: 'ZEROBASED', AudioSelectors: { 'Reference audio': { DefaultSelection: 'DEFAULT' } } }],
    OutputGroups: [{ Name: 'Reference audio', OutputGroupSettings: { Type: 'FILE_GROUP_SETTINGS', FileGroupSettings: { Destination: destination } },
      Outputs: [{ ContainerSettings: { Container: 'RAW' }, Extension: 'mp3', AudioDescriptions: [{ AudioSourceName: 'Reference audio',
        CodecSettings: { Codec: 'MP3', Mp3Settings: { Bitrate: 192000, Channels: 2, RateControlMode: 'CBR', SampleRate: 48000 } } }] }] }],
  } };
}

export function safetyAudioRemuxJob(video: string, audio: string, destination: string, role: string): CreateJobCommandInput {
  return { Role: role, Settings: {
    TimecodeConfig: { Source: 'ZEROBASED' },
    Inputs: [{ FileInput: video, TimecodeSource: 'ZEROBASED', VideoSelector: {},
      AudioSelectors: { 'Original reference audio': { ExternalAudioFileInput: audio, DefaultSelection: 'DEFAULT', Offset: 0 } } }],
    OutputGroups: [{ Name: 'Original reference audio', OutputGroupSettings: { Type: 'FILE_GROUP_SETTINGS', FileGroupSettings: { Destination: destination } },
      Outputs: [{ ContainerSettings: { Container: 'MP4' }, Extension: 'mp4', VideoDescription: {
        CodecSettings: { Codec: 'H_264', H264Settings: { RateControlMode: 'QVBR', SceneChangeDetect: 'TRANSITION_DETECTION',
          QualityTuningLevel: 'SINGLE_PASS', QvbrSettings: { QvbrQualityLevel: 8 }, MaxBitrate: 8000000 } },
      }, AudioDescriptions: [{ AudioSourceName: 'Original reference audio', CodecSettings: { Codec: 'AAC',
        AacSettings: { Bitrate: 192000, CodingMode: 'CODING_MODE_2_0', SampleRate: 48000 } } }] }] }],
  } };
}
