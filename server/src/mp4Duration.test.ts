import assert from 'node:assert/strict';
import test from 'node:test';
import { mp4MetadataDuration, probeMp4Duration } from './mp4Duration';

function atom(type: string, payload = Buffer.alloc(0), extended = false): Buffer {
  const header = Buffer.alloc(extended ? 16 : 8);
  header.writeUInt32BE(extended ? 1 : header.length + payload.length, 0);
  header.write(type, 4, 'ascii');
  if (extended) header.writeBigUInt64BE(BigInt(header.length + payload.length), 8);
  return Buffer.concat([header, payload]);
}

function timing(type: 'mvhd' | 'mdhd', version: 0 | 1, timescale: number, ticks: bigint): Buffer {
  const offset = version === 1 ? 20 : 12;
  const payload = Buffer.alloc(offset + (version === 1 ? 12 : 8));
  payload[0] = version;
  payload.writeUInt32BE(timescale, offset);
  if (version === 1) payload.writeBigUInt64BE(ticks, offset + 4);
  else payload.writeUInt32BE(Number(ticks), offset + 4);
  return atom(type, payload);
}

const movie = (version: 0 | 1 = 0) => atom('moov', Buffer.concat([
  timing('mvhd', version, 1000, 10000n),
  atom('trak', atom('mdia', timing('mdhd', version, 48000, 481200n))),
]));

test('MP4 movie and track clocks support both header versions and retain the longest measured track', () => {
  for (const version of [0, 1] as const) assert.equal(mp4MetadataDuration(movie(version)), 10.025);
  assert.equal(mp4MetadataDuration(atom('moov', timing('mvhd', 0, 1000, 10000n))), 10);
  assert.equal(mp4MetadataDuration(atom('moov', atom('trak', atom('mdia', timing('mdhd', 1, 48000, 480000n))))), 10);
});

test('MP4 timing ignores unspecified durations and invalid clocks instead of inventing a billable duration', () => {
  assert.equal(mp4MetadataDuration(atom('moov', timing('mvhd', 0, 1000, 0xffffffffn))), 0);
  assert.equal(mp4MetadataDuration(atom('moov', timing('mvhd', 1, 1000, 0xffffffffffffffffn))), 0);
  assert.equal(mp4MetadataDuration(atom('moov', timing('mdhd', 1, 48000, 0xffffffffffffffffn))), 0);
  assert.equal(mp4MetadataDuration(atom('moov', timing('mvhd', 1, 0, 10000n))), 0);
  assert.equal(mp4MetadataDuration(atom('moov', timing('mvhd', 0, 1000, 0n))), 0);
  assert.equal(mp4MetadataDuration(atom('moov', timing('mvhd', 1, 1000, 0xffffffffn))), Number(0xffffffffn) / 1000,
    'The version-0 sentinel remains a valid numeric duration in a version-1 header.');
});

test('MP4 metadata supports extended atom sizes and rejects malformed or incomplete metadata', () => {
  assert.equal(mp4MetadataDuration(atom('moov', timing('mvhd', 1, 1000, 10000n), true)), 10);
  const incomplete = movie().subarray(0, movie().length - 1);
  assert.equal(mp4MetadataDuration(incomplete), 0);
  const malformed = Buffer.alloc(8); malformed.writeUInt32BE(4); malformed.write('moov', 4);
  assert.equal(mp4MetadataDuration(malformed), 0);
  const unknownVersion = timing('mvhd', 0, 1000, 10000n); unknownVersion[8] = 2;
  assert.equal(mp4MetadataDuration(atom('moov', unknownVersion)), 0);
});

type Segment = { at: number; data: Buffer };
/** A virtual large MP4 records actual bytes read without allocating an mdat payload. */
function source(segments: Segment[], total: number, ranged = true) {
  const requests: Array<{ start: number; length: number; readBytes: number; canceled: boolean }> = [];
  const fetcher = (async (_url: string, init?: RequestInit) => {
    const match = /^bytes=(\d+)-(\d+)$/.exec((init?.headers as Record<string, string>).Range);
    assert.ok(match);
    const start = Number(match[1]), length = Number(match[2]) - start + 1;
    const request = { start, length, readBytes: 0, canceled: false }; requests.push(request);
    let at = ranged ? start : 0;
    const end = ranged ? Math.min(start + length, total) : total;
    const cancel = async () => { request.canceled = true; };
    const body = {
      cancel,
      getReader: () => ({
        cancel,
        read: async () => {
          if (at >= end) return { done: true, value: undefined };
          const data = Buffer.alloc(Math.min(8192, end - at));
          for (const segment of segments) {
            const from = Math.max(at, segment.at), to = Math.min(at + data.length, segment.at + segment.data.length);
            if (to > from) segment.data.copy(data, from - at, from - segment.at, to - segment.at);
          }
          at += data.length; request.readBytes += data.length;
          return { done: false, value: data };
        },
      }),
    };
    return { ok: true, status: ranged ? 206 : 200, body } as unknown as Response;
  }) as typeof fetch;
  return { fetcher, requests };
}

test('MP4 range probing reads a leading moov and leaves the video payload unread', async () => {
  const ftyp = atom('ftyp', Buffer.from('isom'));
  const moov = movie();
  const fixture = source([{ at: 0, data: ftyp }, { at: ftyp.length, data: moov }], 50 * 1024 * 1024);
  assert.equal(await probeMp4Duration('https://media.invalid/clip.mp4', fixture.fetcher), 10.025);
  assert.deepEqual(fixture.requests.map(({ start, length }) => [start, length]), [[0, 16], [ftyp.length, 16], [ftyp.length, moov.length]]);
  assert.equal(fixture.requests.reduce((sum, request) => sum + request.readBytes, 0), 32 + moov.length);
  assert.ok(fixture.requests.every(request => request.canceled));
});

test('MP4 range probing skips a large extended mdat directly to trailing metadata', async () => {
  const size = 64 * 1024 * 1024;
  const mdat = Buffer.alloc(16); mdat.writeUInt32BE(1); mdat.write('mdat', 4); mdat.writeBigUInt64BE(BigInt(size), 8);
  const moov = movie(1);
  const fixture = source([{ at: 0, data: mdat }, { at: size, data: moov }], size + moov.length);
  assert.equal(await probeMp4Duration('https://media.invalid/clip.mp4', fixture.fetcher), 10.025);
  assert.deepEqual(fixture.requests.map(({ start, length }) => [start, length]), [[0, 16], [size, 16], [size, moov.length]]);
  assert.ok(fixture.requests.reduce((sum, request) => sum + request.readBytes, 0) < 1024);
});

test('A source ignoring Range still supports leading metadata through a bounded prefix read', async () => {
  const ftyp = atom('ftyp', Buffer.from('isom')), moov = movie();
  const fixture = source([{ at: 0, data: ftyp }, { at: ftyp.length, data: moov }], 50 * 1024 * 1024, false);
  assert.equal(await probeMp4Duration('https://media.invalid/clip.mp4', fixture.fetcher), 10.025);
  assert.ok(fixture.requests.every(request => request.canceled));
  assert.ok(fixture.requests.reduce((sum, request) => sum + request.readBytes, 0) <= 3 * 8192);
});

test('A source ignoring Range is canceled before scanning a distant mdat payload', async () => {
  const size = 64 * 1024 * 1024, mdat = Buffer.alloc(8); mdat.writeUInt32BE(size); mdat.write('mdat', 4);
  const fixture = source([{ at: 0, data: mdat }, { at: size, data: movie() }], size + movie().length, false);
  await assert.rejects(probeMp4Duration('https://media.invalid/clip.mp4', fixture.fetcher), /does not support metadata range reads/);
  assert.equal(fixture.requests.length, 2);
  assert.equal(fixture.requests[1].readBytes, 0);
  assert.ok(fixture.requests.every(request => request.canceled));
  assert.equal(fixture.requests[0].readBytes, 8192);
});

test('MP4 probing refuses unavailable, unknown and oversized metadata with bounded work', async () => {
  const rejected = (async () => new Response(null, { status: 403 })) as typeof fetch;
  await assert.rejects(probeMp4Duration('https://media.invalid/clip.mp4', rejected), /metadata is unavailable/);
  const unknown = atom('moov', timing('mvhd', 0, 1000, 0xffffffffn));
  const unknownSource = source([{ at: 0, data: unknown }], unknown.length);
  await assert.rejects(probeMp4Duration('https://media.invalid/clip.mp4', unknownSource.fetcher), /no measurable movie duration/);
  const oversized = Buffer.alloc(8); oversized.writeUInt32BE(2 * 1024 * 1024 + 1); oversized.write('moov', 4);
  const oversizedSource = source([{ at: 0, data: oversized }], 3 * 1024 * 1024);
  await assert.rejects(probeMp4Duration('https://media.invalid/clip.mp4', oversizedSource.fetcher), /exceeds the read limit/);
  assert.equal(oversizedSource.requests.length, 1);
  const freeAtoms = Buffer.concat(Array.from({ length: 33 }, () => atom('free')));
  const bounded = source([{ at: 0, data: freeAtoms }], freeAtoms.length);
  await assert.rejects(probeMp4Duration('https://media.invalid/clip.mp4', bounded.fetcher), /no measurable movie duration/);
  assert.equal(bounded.requests.length, 32);
  let called = false;
  const unused = (async () => { called = true; throw new Error('must not fetch'); }) as typeof fetch;
  await assert.rejects(probeMp4Duration('file:///clip.mp4', unused), /HTTP\(S\)/);
  assert.equal(called, false);
});
