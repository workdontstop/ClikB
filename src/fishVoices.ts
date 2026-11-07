import { useEffect, useState } from 'react';
import { FISH_VOICES, type FishVoice } from '../server/src/fishVoiceCatalog';

export type ListedFishVoice = FishVoice & { savedPreview?: boolean; s3Url?: string };

export const GEMINI_VOICE_OPTIONS = [
  { id: 'Zephyr', label: 'Zephyr', tone: 'Bright', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-eef20480b0b0285f2de0195ddc50ebc5.mp3' },
  { id: 'Puck', label: 'Puck', tone: 'Upbeat', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-1f5b099f09a4b39c38e669bd0460d9dd.mp3' },
  { id: 'Kore', label: 'Kore', tone: 'Firm', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-89665cf8e9418f0e9fa27bda9f511755.mp3' },
  { id: 'Charon', label: 'Charon', tone: 'Informative', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-4c77fed3ffcccb0e44553c918542ca17.mp3' },
  { id: 'Leda', label: 'Leda', tone: 'Youthful', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-5bcde8e7737ee8eab3f64ac428b3a778.mp3' },
  { id: 'Fenrir', label: 'Fenrir', tone: 'Excitable', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-0ecd2a46802b6054b7069f6deda884b2.mp3' },
  { id: 'Aoede', label: 'Aoede', tone: 'Breezy', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-45ac4df46ff7b180416793679ca26e9c.mp3' },
  { id: 'Orus', label: 'Orus', tone: 'Firm', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-6806f2b96a741dfa2fab55840ebcf532.mp3' },
  { id: 'Callirrhoe', label: 'Callirrhoe', tone: 'Easy-going', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-59c6c900223d2dfdf200a28fce986c00.mp3' },
  { id: 'Enceladus', label: 'Enceladus', tone: 'Breathy', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-9f7fcff725015f515d19983e986e0485.mp3' },
  { id: 'Autonoe', label: 'Autonoe', tone: 'Bright', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-5fd4e7f22f0b63f3e0dcf31430eefed8.mp3' },
  { id: 'Iapetus', label: 'Iapetus', tone: 'Clear', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-62a997c00eb23deba3188a6e2a9a61b4.mp3' },
  { id: 'Despina', label: 'Despina', tone: 'Smooth', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-e95c82d61222e9f151aec43d954b860a.mp3' },
  { id: 'Umbriel', label: 'Umbriel', tone: 'Easy-going', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-08dc0816df6f93b541843364a93b923b.mp3' },
  { id: 'Erinome', label: 'Erinome', tone: 'Clear', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-5c41fe35b90a9a9c1dc0ed46aba21393.mp3' },
  { id: 'Algenib', label: 'Algenib', tone: 'Gravelly', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-a4dac817bd9f810d13ce008d97a00916.mp3' },
  { id: 'Laomedeia', label: 'Laomedeia', tone: 'Upbeat', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-a5180c8d80b7c9dd114ac7493eb119aa.mp3' },
  { id: 'Algieba', label: 'Algieba', tone: 'Smooth', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-ebdb2dc65ce2d0d7e3051e1ba98a134c.mp3' },
  { id: 'Achernar', label: 'Achernar', tone: 'Soft', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-b7878ff88d4fc0c6421fc040f49436e3.mp3' },
  { id: 'Schedar', label: 'Schedar', tone: 'Even', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-2ac36f8cff57f429d503180239f37b9c.mp3' },
  { id: 'Gacrux', label: 'Gacrux', tone: 'Mature', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-39331a00bcd6d316ff4a7342e62183c4.mp3' },
  { id: 'Achird', label: 'Achird', tone: 'Friendly', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-815bed4b849bbf8cb4f7af1a5146e644.mp3' },
  { id: 'Pulcherrima', label: 'Pulcherrima', tone: 'Forward', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-553c0e7d8029a59f36ed1c1577eb59c2.mp3' },
  { id: 'Zubenelgenubi', label: 'Zubenelgenubi', tone: 'Casual', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-e2c65131bb1c8eb7ccdee21aa4adcb4d.mp3' },
  { id: 'Vindemiatrix', label: 'Vindemiatrix', tone: 'Gentle', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-93769a11bedaefc18634f6c993b34dc1.mp3' },
  { id: 'Sadachbia', label: 'Sadachbia', tone: 'Lively', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-3735d96a71296b6609ac55edfff4750e.mp3' },
  { id: 'Sulafat', label: 'Sulafat', tone: 'Warm', gender: 'Female', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-dd8a98f506e9b5f73e823720210c1063.mp3' },
  { id: 'Sadaltager', label: 'Sadaltager', tone: 'Knowledgeable', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-68ab6b7ecd5565bbf48e021c2d8ceb8f.mp3' },
  { id: 'Alnilam', label: 'Alnilam', tone: 'Firm', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-71bcdb0e8d53747465f37ffe94dee36b.mp3' },
  { id: 'Rasalgethi', label: 'Rasalgethi', tone: 'Informative', gender: 'Male', previewUrl: 'https://clikbatebucket.s3.us-east-1.amazonaws.com/audio-5b2295c0d657ac304fd01319188e78db.mp3' },
] as const;

const base = [...FISH_VOICES];
let cache: ListedFishVoice[] = base, fetchedAt = 0, pending: Promise<void> | undefined;
const listeners = new Set<() => void>();
const api = String(import.meta.env.VITE_CLIK_URL || '').replace(/\/$/, '');
export function refreshFishVoices(force = false): Promise<void> {
  if (pending) return pending;
  if (!force && Date.now() - fetchedAt < 5 * 60_000) return Promise.resolve();
  pending = (async () => {
    try {
      const response = await fetch(`${api}/api/fish-voices`, { credentials: 'include', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Voice catalogue unavailable');
      const data = await response.json();
      if (!Array.isArray(data.voices)) throw new Error('Invalid voice catalogue');
      cache = base.map(voice => {
        const stored = data.voices.find((item: ListedFishVoice) => item.id === voice.id);
        return stored ? { ...voice, previewUrl: typeof stored.previewUrl === 'string' && (stored.previewUrl === '' || /^https:\/\//.test(stored.previewUrl))
          ? stored.previewUrl : voice.previewUrl, savedPreview: stored.savedPreview === true, s3Url: stored.s3Url } : voice;
      });
    } catch { /* Offline and first use keep selectable voices and provider samples. */ }
    fetchedAt = Date.now();
    listeners.forEach(listener => listener());
  })().finally(() => { pending = undefined; });
  return pending;
}
export function useFishVoices(active: boolean): ListedFishVoice[] {
  const [voices, setVoices] = useState(cache);
  useEffect(() => {
    const update = () => setVoices(cache);
    listeners.add(update); update();
    if (active) void refreshFishVoices();
    // Saved private S3 samples use expiring signed URLs. Refresh only while a
    // picker is open; this reads metadata and never synthesizes audio.
    const timer = active ? setInterval(() => { void refreshFishVoices(); }, 5 * 60_000) : undefined;
    return () => { listeners.delete(update); if (timer) clearInterval(timer); };
  }, [active]);
  return voices;
}
