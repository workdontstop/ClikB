import axios from 'axios';
import { IMMUTABLE_VIDEO_CACHE_CONTROL } from './mediaCachePolicy';
import { Saveprompthelperfordellater, SaveVideoHelperForDelLater } from './SavepromptHelpersLocal';

/** Media persistence must work without mounting an individual scene editor. */
export function extractSpatialResultFrame(source: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.preload = 'auto'; video.muted = true; video.playsInline = true;
        let settled = false;
        const finish = (blob?: Blob | null, error?: Error) => {
            if (settled) return; settled = true; clearTimeout(timeout);
            video.onloadedmetadata = null; video.onseeked = null; video.onerror = null;
            video.removeAttribute('src'); video.load();
            if (blob) resolve(blob); else reject(error || new Error('Could not extract the result frame.'));
        };
        const timeout = setTimeout(() => finish(null, new Error('Timed out reading the result frame.')), 30000);
        video.onerror = () => finish(null, new Error('Could not read the generated video.'));
        video.onloadedmetadata = () => { video.currentTime = Math.max(.001, video.duration - .08); };
        video.onseeked = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth; canvas.height = video.videoHeight;
                const context = canvas.getContext('2d');
                if (!context || !canvas.width || !canvas.height) throw new Error('Result frame is empty.');
                context.drawImage(video, 0, 0);
                canvas.toBlob(blob => finish(blob), 'image/jpeg', .92);
            } catch (error) { finish(null, error as Error); }
        };
        video.src = source;
    });
}

export async function persistSpatialResultAssets(api: string, output: string, progress: { endFrame?: string; videoUrl?: string }) {
    if (progress.endFrame && progress.videoUrl) return progress as { endFrame: string; videoUrl: string };
    const response = await fetch(output, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error('Could not download the generated video.');
    const blob = await response.blob();
    const upload = async (asset: Blob, video: boolean) => {
        const signed = await axios.post<any>(`${api}/${video ? 'get_signed_url_video' : 'get_signed_url_imageStory'}`, { values: { count: 1, ...(!video ? { prefix: 'hd' } : {}) } }, { withCredentials: true, timeout: 30000 });
        const url = signed.data?.holder?.[0]?.[video ? 'urlVideo' : 'urlHD'];
        if (!url) throw new Error('Could not prepare the result upload.');
        const result = await axios.put(url, asset, { headers: { 'Content-Type': asset.type || (video ? 'video/mp4' : 'image/jpeg'), ...(video ? { 'Cache-Control': IMMUTABLE_VIDEO_CACHE_CONTROL } : {}) }, timeout: 120000 });
        if (![200, 204].includes(result.status)) throw new Error('Result upload failed.');
        const saved = url.split('?')[0];
        if (video) SaveVideoHelperForDelLater(saved); else Saveprompthelperfordellater(saved);
        return saved;
    };
    if (!progress.endFrame) {
        const local = URL.createObjectURL(blob);
        try { progress.endFrame = await upload(await extractSpatialResultFrame(local), false); }
        finally { URL.revokeObjectURL(local); }
    }
    if (!progress.videoUrl) progress.videoUrl = await upload(blob, true);
    return progress as { endFrame: string; videoUrl: string };
}
