import axios from 'axios';

type GameMetadataInput = { postId: number; kind: 'hotspots' | 'spatial'; context: string; title?: string };
type Metadata = { title: string; tags: string[]; categories: string[] };
const generated = new Map<string, Promise<Metadata>>();
const saved = new Map<string, Promise<void>>();

/** Retries a failed index write without paying for the same successful tagger call again. */
export async function ensureGameSearchMetadata(api: string, input: GameMetadataInput): Promise<void> {
  if (!Number.isSafeInteger(input.postId) || input.postId <= 0) throw new Error('A saved game is required before preparing search details.');
  const context = input.context.trim().slice(0, 4000);
  if (!context) throw new Error('The game description is missing.');
  const key = JSON.stringify([api, input.postId, input.kind, context, input.title || '']);
  let write = saved.get(key);
  if (!write) {
    write = (async () => {
      let request = generated.get(key);
      if (!request) {
        const pending = Promise.resolve(axios.post<Metadata>(`${api}/GptTagger`, { caption: context, currentTitle: input.title || '', gameKind: input.kind }, { withCredentials: true }))
          .then(response => {
            const data = response.data as Metadata;
            const title = String(data.title || '').trim();
            if (!title || !Array.isArray(data.tags) || !Array.isArray(data.categories)) throw new Error('The game search details were incomplete.');
            return { title, tags: data.tags, categories: data.categories };
          });
        generated.set(key, pending);
        pending.catch(() => { if (generated.get(key) === pending) generated.delete(key); });
        request = pending;
      }
      const metadata = await request;
      await axios.put(`${api}/InsertPostSearch`, { postId: input.postId, caption: metadata.title, tags: metadata.tags, categories: metadata.categories }, { withCredentials: true });
    })();
    saved.set(key, write);
    write.catch(() => { if (saved.get(key) === write) saved.delete(key); });
  }
  return write;
}
