/** Read MP4 movie/track timing without decoding or downloading the video payload. */
export function mp4MetadataDuration(data: Buffer): number {
  const durations: number[] = [];
  const walk = (start: number, end: number, depth: number) => {
    if (depth > 6) return;
    for (let at = start; at + 8 <= end;) {
      let size = data.readUInt32BE(at), header = 8;
      const type = data.toString('ascii', at + 4, at + 8);
      if (size === 1) {
        if (at + 16 > end) return;
        size = Number(data.readBigUInt64BE(at + 8)); header = 16;
      }
      if (size === 0) size = end - at;
      if (!Number.isSafeInteger(size) || size < header || at + size > end) return;
      const payload = at + header;
      if (['moov', 'trak', 'mdia'].includes(type)) walk(payload, at + size, depth + 1);
      if (type === 'mvhd' || type === 'mdhd') {
        const version = data[payload];
        const offset = version === 1 ? 20 : version === 0 ? 12 : -1;
        if (offset >= 0 && payload + offset + (version === 1 ? 12 : 8) <= at + size) {
          const timescale = data.readUInt32BE(payload + offset);
          const rawTicks = version === 1 ? data.readBigUInt64BE(payload + offset + 4) : BigInt(data.readUInt32BE(payload + offset + 4));
          const unknown = version === 1 ? 0xffffffffffffffffn : 0xffffffffn;
          const ticks = Number(rawTicks);
          const seconds = ticks / timescale;
          if (timescale && ticks && rawTicks !== unknown && Number.isFinite(seconds)) durations.push(seconds);
        }
      }
      at += size;
    }
  };
  walk(0, data.length, 0);
  return durations.length ? Math.max(...durations) : 0;
}

export async function probeMp4Duration(url: string, fetcher: typeof fetch = fetch): Promise<number> {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('MP4 metadata requires an HTTP(S) source.');
  const read = async (start: number, length: number): Promise<Buffer> => {
    const response = await fetcher(url, { headers: { Range: `bytes=${start}-${start + length - 1}` }, signal: AbortSignal.timeout(15000) });
    if (!response.ok || !response.body) throw new Error('Source video metadata is unavailable.');
    // A server may ignore Range. Read only the required prefix then cancel.
    const skip = response.status === 206 ? 0 : start;
    if (skip > 2 * 1024 * 1024) { await response.body.cancel(); throw new Error('Source server does not support metadata range reads.'); }
    const reader = response.body.getReader();
    const chunks: Buffer[] = []; let received = 0;
    try {
      while (received < skip + length) {
        const part = await reader.read();
        if (part.done) break;
        const bytes = Buffer.from(part.value).subarray(0, skip + length - received);
        chunks.push(bytes); received += bytes.length;
      }
    } finally { await reader.cancel(); }
    return Buffer.concat(chunks).subarray(skip, skip + length);
  };
  let at = 0;
  for (let count = 0; count < 32; count++) {
    const header = await read(at, 16);
    if (header.length < 8) break;
    let size = header.readUInt32BE(0);
    if (size === 1) { if (header.length < 16) break; size = Number(header.readBigUInt64BE(8)); }
    if (!Number.isSafeInteger(size) || size < 8) break;
    if (header.toString('ascii', 4, 8) === 'moov') {
      if (size > 2 * 1024 * 1024) throw new Error('Source video metadata exceeds the read limit.');
      const duration = mp4MetadataDuration(await read(at, size));
      if (duration > 0) return duration;
      break;
    }
    at += size;
  }
  throw new Error('Source MP4 has no measurable movie duration.');
}
