const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const source = ts.createSourceFile('index.mjs', fs.readFileSync(path.join(root,
  'server/lambda/advanced_ffmpeg_lambda/index.mjs'), 'utf8'), ts.ScriptTarget.Latest, true);
const quiet = { log() {}, warn() {} };
function functions(names, bindings = {}) {
  const declarations = names.map(name => {
    const node = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.ok(node, `Missing Lambda function ${name}`);
    return node.getText(source);
  }).join('\n');
  return new Function(...Object.keys(bindings), `${declarations}\nreturn {${names.join(',')}};`)(...Object.values(bindings));
}
function layoutFor(random = .5) {
  const math = Object.create(Math);
  math.random = () => random;
  return functions(['getBrandingLayout', 'isFinitePositiveNumber'], { Math: math }).getBrandingLayout;
}

test('branding stays within the finished timeline, including very short videos and random extremes', () => {
  for (const random of [0, .5, .99999999]) {
    for (const duration of [.04, .3, 5, 10, 10.001, 16, 180]) {
      const layout = layoutFor(random)({ width: 1080, height: 1920, duration });
      assert.equal(layout.durationSec, Math.min(10, duration));
      assert.ok(layout.startSec >= 0 && layout.endSec <= duration + 1e-9);
      assert.ok(layout.logoFadeSec > 0 && layout.logoFadeSec * 2 < layout.durationSec);
      if (duration <= 10) assert.equal(layout.startSec, 0);
      if (duration > 11 && random > 0 && random < .9) assert.ok(layout.startSec > 0);
    }
  }
  for (const duration of [0, -1, NaN, Infinity]) {
    assert.throws(() => layoutFor()({ width: 1080, height: 1920, duration }), /Invalid completed video/);
  }
});

test('branding scales with resolution and leaves a compact, bounded group in every orientation', () => {
  const layout = layoutFor();
  for (const [width, height] of [[1080, 1920], [720, 1280], [1920, 1080], [1080, 1080], [320, 568], [2160, 3840]]) {
    const result = layout({ width, height, duration: 16 });
    assert.ok(result.logoX > 0 && result.logoY > 0);
    assert.ok(result.textX + result.textWidth < width);
    assert.ok(result.logoY + result.logoSize < height);
    assert.ok(result.textWidth <= result.logoSize * 1.25);
  }
  const sd = layout({ width: 1080, height: 1920, duration: 16 });
  const hd = layout({ width: 2160, height: 3840, duration: 16 });
  assert.equal(hd.logoSize, sd.logoSize * 2);
  assert.equal(hd.logoX, sd.logoX * 2);
});

test('metadata comes from the completed file, accepts fractional FPS, and rejects unreadable output', () => {
  let entries;
  const probe = metadata => functions(['getBrandingVideoInfo', 'isFinitePositiveNumber'], {
    FFPROBE_PATH: 'ffprobe', DEFAULT_FPS: 24,
    execFileSync: (exe, args) => { assert.equal(exe, 'ffprobe'); entries = args; return JSON.stringify(metadata); },
  }).getBrandingVideoInfo;
  assert.deepEqual(probe({ streams: [{ width: 720, height: 1280, avg_frame_rate: '30000/1001' }], format: { duration: '37.125' } })('finished.mp4'),
    { width: 720, height: 1280, duration: 37.125, fps: 30000 / 1001 });
  assert.equal(entries.at(-1), 'finished.mp4');
  assert.equal(probe({ streams: [{ width: 320, height: 320, avg_frame_rate: '0/0' }], format: { duration: '1' } })('finished.mp4').fps, 24);
  for (const metadata of [{}, { streams: [], format: { duration: '12' } }, { streams: [{ width: 0, height: 1080 }], format: { duration: '12' } }]) {
    assert.throws(() => probe(metadata)('broken.mp4'), /Could not read completed video/);
  }
});

function renderHarness({ chunked, musicVideo, failBranding = false }) {
  const events = [], statuses = [];
  const record = name => async data => { events.push({ name, data }); };
  const bindings = {
    path, WORK_DIR: '/tmp/branding-test', REGION: 'test-region', console: quiet,
    getOutputConfig: () => ({ bucket: 'output', key: 'result.mp4' }),
    resetWorkspace: () => {}, getRenderSettings: () => ({ fps: 24 }),
    renderScenesToStitchedVideo: record('scenes'), stitchRenderedClipsToOutput: record('stitch'),
    downloadUrlToFile: record('download-segment'), isUsableUrl: value => !!value, getDuration: () => 16,
    pruneWorkspaceForFinalRender: data => events.push({ name: 'prune', data }),
    isMusicVideoMode: () => musicVideo,
    applyBackgroundMusic: record('audio'),
    applyFinalBranding: async data => { events.push({ name: 'brand', data }); if (failBranding) throw Error('Branding failed'); },
    uploadFinalVideo: record('upload'), cleanupChunkedArtifacts: record('cleanup'),
    writeStatus: async (recipe, status) => { statuses.push(status); events.push({ name: 'status', data: status }); },
    jsonResponse: (statusCode, body) => ({ statusCode, body }),
  };
  const renderer = functions([chunked ? 'finalizeChunkedRender' : 'renderFullRecipe'], bindings);
  const recipe = { scenes: [{ visuals: [{}] }], mode: musicVideo ? 'music-video' : 'story' };
  const manifest = { segments: [{ complete: true, url: 's3://temp/one.mp4', duration: 8 }, { complete: true, url: 's3://temp/two.mp4', duration: 8 }] };
  return { events, statuses, run: () => chunked ? renderer.finalizeChunkedRender(recipe, manifest) : renderer.renderFullRecipe(recipe) };
}

for (const chunked of [false, true]) for (const musicVideo of [false, true]) {
  const label = `${chunked ? 'chunked' : 'normal'} ${musicVideo ? 'music-video' : 'story'}`;
  test(`${label}: audio then one branding pass, branded upload, and monotonic completion feedback`, async () => {
    const harness = renderHarness({ chunked, musicVideo });
    const result = await harness.run();
    const names = harness.events.map(event => event.name);
    assert.equal(names.filter(name => name === 'brand').length, 1);
    assert.ok(names.indexOf('audio') < names.indexOf('brand'));
    assert.ok(names.indexOf('brand') < names.indexOf('upload'));
    const brand = harness.events.find(event => event.name === 'brand').data;
    const upload = harness.events.find(event => event.name === 'upload').data;
    assert.equal(upload.localPath, brand.outputPath);
    assert.notEqual(upload.localPath, brand.inputPath);
    const stages = harness.statuses.map(status => status.stage);
    assert.ok(stages.indexOf('background-music') < stages.indexOf('branding'));
    assert.ok(stages.indexOf('branding') < stages.indexOf('uploading'));
    assert.equal(stages.at(-1), 'complete');
    assert.equal(harness.statuses.find(status => status.stage === 'branding').state, 'processing');
    for (let i = 1; i < harness.statuses.length; i++) assert.ok(harness.statuses[i].progress >= harness.statuses[i - 1].progress);
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.finalVideoUrl, 'https://output.s3.test-region.amazonaws.com/result.mp4');
    const brandIndex = names.indexOf('brand');
    const lastPrune = harness.events.slice(0, brandIndex).filter(event => event.name === 'prune').at(-1);
    assert.deepEqual(lastPrune.data.keepPaths, [brand.inputPath]);
    if (chunked) assert.ok(names.indexOf('cleanup') > names.indexOf('upload'));
  });
}

for (const chunked of [false, true]) {
  test(`${chunked ? 'chunked' : 'normal'}: failed branding never uploads or reports completion`, async () => {
    const harness = renderHarness({ chunked, musicVideo: false, failBranding: true });
    await assert.rejects(harness.run(), /Branding failed/);
    assert.ok(!harness.events.some(event => event.name === 'upload'));
    assert.ok(!harness.statuses.some(status => status.stage === 'complete' || status.stage === 'uploading'));
  });
}

test('branding assets use the existing S3 objects with decoded keys', async () => {
  const urls = [];
  const bindings = {
    path, WORK_DIR: '/tmp/branding-test', console: quiet,
    BRANDING_LOGO_URL: 's3://clikbatebucket/ChatGPT Image Apr 25, 2026, 09_28_40 PM.png',
    BRANDING_TEXT_URL: 's3://clikbatebucket/hd-cb15400a7ecfabe08640af35d6ca66aa.png',
    getBrandingVideoInfo: () => ({ width: 1080, height: 1920, duration: 16, fps: 24 }),
    getBrandingLayout: layoutFor(), downloadUrlToFile: async url => urls.push(url),
    runFfmpeg: () => {},
  };
  await functions(['applyFinalBranding'], bindings).applyFinalBranding({ inputPath: 'done.mp4', outputPath: 'branded.mp4' });
  assert.equal(urls.length, 2);
  const sourceText = source.getFullText();
  for (const url of urls) assert.ok(sourceText.includes(`"${url}"`));
});

const bundledFfmpeg = path.join(root, '.video-review-deps/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe');
const ffmpeg = process.env.LAMBDA_BRANDING_FFMPEG || (fs.existsSync(bundledFfmpeg) ? bundledFfmpeg : null);
test('real FFmpeg: timed fades, centred compact text, unchanged audio/dimensions/duration, and silent short output',
  { skip: !ffmpeg && 'Set LAMBDA_BRANDING_FFMPEG to run the local render checks', timeout: 120000 }, async () => {
    const { Input, BufferSource, ALL_FORMATS } = require('mediabunny');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clikb-branding-'));
    const run = (args, encoding = 'utf8') => {
      const result = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args], { encoding, maxBuffer: 16 * 1024 * 1024 });
      assert.equal(result.status, 0, String(result.stderr || result.error));
      return result.stdout;
    };
    const logo = process.env.LAMBDA_BRANDING_LOGO_FIXTURE || path.join(dir, 'logo.png');
    const text = process.env.LAMBDA_BRANDING_TEXT_FIXTURE || path.join(dir, 'text.png');
    if (!process.env.LAMBDA_BRANDING_LOGO_FIXTURE) run(['-y', '-f', 'lavfi', '-i', 'color=c=black:s=96x96', '-frames:v', '1', logo]);
    if (!process.env.LAMBDA_BRANDING_TEXT_FIXTURE) run(['-y', '-f', 'lavfi', '-i', 'color=c=white:s=240x52', '-frames:v', '1', text]);
    const reports = [];
    try {
      for (const [width, height, duration, audio] of [[360, 640, 16, true], [640, 360, 16, true], [360, 360, 16, true], [360, 640, .4, false]]) {
        const stem = `${width}x${height}-${duration}`;
        const inputPath = path.join(dir, `${stem}-input.mp4`), outputPath = path.join(dir, `${stem}-branded.mp4`);
        run(['-y', '-f', 'lavfi', '-i', `color=c=0x6ca6ce:s=${width}x${height}:r=10:d=${duration}`,
          ...(audio ? ['-f', 'lavfi', '-i', `sine=frequency=440:sample_rate=48000:duration=${duration}`] : []),
          '-c:v', 'libx264', '-pix_fmt', 'yuv420p', ...(audio ? ['-c:a', 'aac'] : []), inputPath]);
        const media = { width, height, duration, fps: 10 };
        let actualLayout;
        const apply = functions(['applyFinalBranding'], {
          path, WORK_DIR: dir, console: quiet, BRANDING_LOGO_URL: 'logo', BRANDING_TEXT_URL: 'text',
          getBrandingVideoInfo: () => media,
          getBrandingLayout: metadata => { actualLayout = layoutFor()(metadata); return actualLayout; },
          downloadUrlToFile: async (url, dest) => fs.copyFileSync(url === 'logo' ? logo : text, dest),
          runFfmpeg: args => run(args),
        }).applyFinalBranding;
        await apply({ inputPath, outputPath });
        const input = new Input({ source: new BufferSource(fs.readFileSync(outputPath)), formats: ALL_FORMATS });
        try {
          const track = await input.getPrimaryVideoTrack();
          assert.equal(track.displayWidth, width); assert.equal(track.displayHeight, height);
          assert.ok(Math.abs(await track.computeDuration() - duration) < .101);
          assert.equal(!!await input.getPrimaryAudioTrack(), audio);
        } finally { input.dispose(); }
        if (audio) {
          const hash = file => run(['-i', file, '-map', '0:a:0', '-c:a', 'copy', '-f', 'hash', '-']);
          assert.equal(hash(outputPath), hash(inputPath), 'AAC packets must be unchanged');
        }
        const frame = (file, time) => run(['-ss', String(time), '-i', file, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], null);
        const boxDelta = (before, after, x, y, w, h) => {
          let sum = 0;
          for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) {
            const offset = (py * width + px) * 3;
            for (let channel = 0; channel < 3; channel++) sum += Math.abs(before[offset + channel] - after[offset + channel]);
          }
          return sum / (w * h * 3);
        };
        if (duration > 10) {
          const deltaAt = time => boxDelta(frame(inputPath, time), frame(outputPath, time),
            actualLayout.logoX, actualLayout.logoY, actualLayout.logoSize, actualLayout.logoSize);
          assert.ok(deltaAt(1) < 4, 'No logo before its random window');
          assert.ok(deltaAt(4) > 10, 'Logo visible during its window');
          assert.ok(deltaAt(14) < 4, 'No logo after its window');
          assert.ok(deltaAt(3.1) < deltaAt(4), 'Logo fades in');
          assert.ok(deltaAt(12.9) < deltaAt(4), 'Logo fades out');
          const before = frame(inputPath, 4), after = frame(outputPath, 4);
          const { textX, textWidth, logoY, logoSize } = actualLayout;
          const changedRows = [];
          for (let y = logoY; y < logoY + logoSize; y++) {
            if (boxDelta(before, after, textX, y, textWidth, 1) > 4) changedRows.push(y);
          }
          assert.ok(changedRows.length > 0, 'Text is present');
          const centre = (changedRows[0] + changedRows.at(-1)) / 2;
          assert.ok(Math.abs(centre - (logoY + logoSize / 2)) <= 3, 'Visible text is vertically centred');
          assert.ok(changedRows.length < logoSize * .5, 'Text remains smaller than the icon');
          assert.ok(boxDelta(before, after, width - 50, height - 50, 40, 40) < 4, 'Other picture regions stay intact');
          if (width === 360 && height === 640 && process.env.LAMBDA_BRANDING_PREVIEW_DIR) {
            fs.mkdirSync(process.env.LAMBDA_BRANDING_PREVIEW_DIR, { recursive: true });
            run(['-y', '-ss', '4', '-i', outputPath, '-frames:v', '1', path.join(process.env.LAMBDA_BRANDING_PREVIEW_DIR, 'portrait.png')]);
          }
        }
        reports.push({ width, height, duration, audio, ...actualLayout });
      }
      if (process.env.LAMBDA_BRANDING_PREVIEW_DIR) fs.writeFileSync(path.join(process.env.LAMBDA_BRANDING_PREVIEW_DIR, 'render-report.json'), JSON.stringify(reports, null, 2));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
