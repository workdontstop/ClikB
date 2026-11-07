/** Compact observation identity only; never sent to a provider as creative input. */
const blobVersions = new WeakMap<Blob, string>();
let nextBlobVersion = 0;
export function observedMediaVersion(value: unknown): string {
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    if (!value.size) return '';
    let version = blobVersions.get(value);
    if (!version) { version = `blob-${++nextBlobVersion}`; blobVersions.set(value, version); }
    return version;
  }
  if (typeof value !== 'string' || !value.trim() || /^(?:EMPTY(?:_BSHOT)?|null|undefined)$/i.test(value.trim())) return '';
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return `source-${value.length}-${(hash >>> 0).toString(36)}`;
}

export type CreationMediaChange = {
  sceneNumber: number; nativeSlotNumber: number; role: 'a-shot' | 'b-shot';
  bShotNumber?: number; kind: 'image' | 'video'; change: 'ready' | 'updated' | 'removed'; revision: number;
};
