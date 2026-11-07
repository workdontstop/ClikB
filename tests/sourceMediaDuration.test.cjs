const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

// Execute the complete production middleware module with only AWS/MP4 I/O and
// dotenv isolated. No network requests, credentials or provider calls occur.
function harness({ results, probeError, mp4Duration = 10.1, mp4Error } = {}) {
    const probes = [], fallback = [], warnings = [];
    class ProbeCommand { constructor(input) { this.input = input; } }
    class MediaConvertClient {
        async send(command) {
            probes.push(command.input);
            if (probeError) throw probeError;
            return { ProbeResults: results };
        }
    }
    const mocks = {
        '@aws-sdk/client-mediaconvert': { MediaConvertClient, ProbeCommand },
        dotenv: { config() {} },
        './mp4Duration': { probeMp4Duration: async url => {
            fallback.push(url);
            if (mp4Error) throw mp4Error;
            return mp4Duration;
        } },
    };
    const source = fs.readFileSync(path.join(root, 'server/src/sourceMediaDuration.ts'), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    const mod = { exports: {} };
    const requireMock = name => { assert.ok(Object.hasOwn(mocks, name), `Unexpected production dependency ${name}`); return mocks[name]; };
    new Function('module', 'exports', 'require', 'console', code)(mod, mod.exports, requireMock, { warn: (...values) => warnings.push(values) });
    return { ...mod.exports, probes, fallback, warnings };
}
const result = (duration, tracks = []) => ({ Container: { Duration: duration, Tracks: tracks.map(Duration => ({ Duration })) } });
const videoUrl = 'https://media.invalid/original.mp4';
const audioUrl = 'https://media.invalid/speech.wav';

test('An unavailable MediaConvert Probe falls back to MP4 metadata only for video upscale', async () => {
    const failure = Object.assign(new Error('Fixture Probe unavailable'), { name: 'AccessDeniedException' });
    const upscale = harness({ probeError: failure });
    const body = { video: videoUrl, duration: 1, [upscale.SERVER_MEASURED_DURATION_FIELD]: 1 };
    await upscale.attachMeasuredSourceDuration('/upscaleVideo?source=test', body);
    assert.deepEqual(upscale.probes, [{ InputFiles: [{ FileUrl: videoUrl }] }]);
    assert.deepEqual(upscale.fallback, [videoUrl]);
    assert.equal(body[upscale.SERVER_MEASURED_DURATION_FIELD], 10);
    assert.equal(body.duration, 1, 'Client duration is ignored for authoritative measurement, not promoted into billing.');
    assert.equal(upscale.warnings.length, 1);
    for (const [route, input] of [
        ['/omnihuman', { lipSyncUrl: videoUrl }],
        ['/dreamactorroute', { video: videoUrl }],
        ['/lipsync2pro', { videoUrl, audioUrl }],
    ]) {
        const fixture = harness({ probeError: failure });
        input[fixture.SERVER_MEASURED_DURATION_FIELD] = .01;
        await assert.rejects(fixture.attachMeasuredSourceDuration(route, input), /could not measure/);
        assert.deepEqual(fixture.fallback, [], `${route} must retain its original Probe requirement.`);
        assert.equal(Object.hasOwn(input, fixture.SERVER_MEASURED_DURATION_FIELD), false);
    }
});

test('Successful Probe measurement uses the longest movie/track clock and never invokes the fallback', async () => {
    const fixture = harness({ results: [result(9, [8, 10.1])] });
    const body = { url: videoUrl, duration: 999, [fixture.SERVER_MEASURED_DURATION_FIELD]: .01 };
    await fixture.attachMeasuredSourceDuration('/upscalevideo', body);
    assert.deepEqual(fixture.fallback, []);
    assert.equal(body[fixture.SERVER_MEASURED_DURATION_FIELD], 10, 'A nominal ten-second clip with container timing is billed at the ten-second cap.');
    const descriptor = Object.getOwnPropertyDescriptor(body, fixture.SERVER_MEASURED_DURATION_FIELD);
    assert.equal(descriptor.enumerable, false); assert.equal(descriptor.writable, false); assert.equal(descriptor.configurable, true);
    assert.equal(Object.keys(body).includes(fixture.SERVER_MEASURED_DURATION_FIELD), false);
    assert.deepEqual(JSON.parse(JSON.stringify(body)), { url: videoUrl, duration: 999 });
});

test('Real measured duration rejects clips above the limit regardless of a spoofed client value', async () => {
    for (const useFallback of [false, true]) {
        const fixture = harness(useFallback ? { probeError: Error('Probe unavailable'), mp4Duration: 11 } : { results: [result(11)] });
        const body = { video: videoUrl, duration: 1, [fixture.SERVER_MEASURED_DURATION_FIELD]: 1 };
        await assert.rejects(fixture.attachMeasuredSourceDuration('/upscalevideo', body), /cannot exceed 10 seconds/);
        assert.equal(Object.hasOwn(body, fixture.SERVER_MEASURED_DURATION_FIELD), false);
        assert.equal(fixture.fallback.length, useFallback ? 1 : 0);
    }
});

test('Unknown Probe duration tries MP4 metadata, but missing selected duration remains blocked', async () => {
    for (const duration of [0, -1, NaN, Infinity, undefined]) {
        const fixture = harness({ results: [result(duration)], mp4Error: Error('No measurable metadata') });
        const body = { video: videoUrl, [fixture.SERVER_MEASURED_DURATION_FIELD]: 1 };
        await assert.rejects(fixture.attachMeasuredSourceDuration('/upscalevideo', body), /could not measure/);
        assert.deepEqual(fixture.fallback, [videoUrl]);
        assert.equal(Object.hasOwn(body, fixture.SERVER_MEASURED_DURATION_FIELD), false);
    }
    for (const results of [undefined, [], [result(0)], [result(5), result(6)]]) {
        const fixture = harness({ results, mp4Duration: 0 });
        await assert.rejects(fixture.attachMeasuredSourceDuration('/upscalevideo', { video: videoUrl }), /could not measure/);
        assert.equal(fixture.fallback.length, 1);
    }
});

test('Upscale uses the selected app duration when both source measurement methods fail', async () => {
    for (const duration of [5, 10]) {
        for (const probeFailure of [{ probeError: Error('Probe unavailable') }, { results: [result(0)] }]) {
            for (const metadataFailure of [{ mp4Error: Error('Metadata unavailable') }, { mp4Duration: 0 }]) {
                const fixture = harness({ ...probeFailure, ...metadataFailure });
                const body = { video: videoUrl, duration, [fixture.SERVER_MEASURED_DURATION_FIELD]: 999 };
                await fixture.attachMeasuredSourceDuration('/upscaleVideo', body);
                assert.equal(body[fixture.SERVER_MEASURED_DURATION_FIELD], duration);
                assert.deepEqual(fixture.fallback, [videoUrl]);
                assert.equal(Object.getOwnPropertyDescriptor(body, fixture.SERVER_MEASURED_DURATION_FIELD).enumerable, false);
            }
        }
    }
});

test('Unavailable source measurement cannot use an invalid selected duration or bypass other route measurement', async () => {
    for (const duration of [undefined, null, '', 0, -1, 11, NaN, Infinity, 'invalid']) {
        const fixture = harness({ probeError: Error('Probe unavailable'), mp4Duration: 0 });
        const body = { video: videoUrl, duration };
        await assert.rejects(fixture.attachMeasuredSourceDuration('/upscalevideo', body), /could not measure/);
        assert.equal(Object.hasOwn(body, fixture.SERVER_MEASURED_DURATION_FIELD), false);
    }
    for (const [route, body] of [
        ['/omnihuman', { lipSyncUrl: videoUrl, duration: 5 }],
        ['/dreamactorroute', { video: videoUrl, duration: 5 }],
        ['/lipsync2pro', { videoUrl, audioUrl, duration: 5 }],
    ]) {
        const fixture = harness({ probeError: Error('Probe unavailable'), mp4Duration: 0 });
        await assert.rejects(fixture.attachMeasuredSourceDuration(route, body), /could not measure/);
        assert.deepEqual(fixture.fallback, []);
    }
});

test('Invalid input removes the forged authoritative field before failing and makes no measurement call', async () => {
    for (const value of ['', 'broken-url', 'file:///video.mp4', 'data:video/mp4,example']) {
        const fixture = harness({ results: [result(5)] });
        const body = { video: value, [fixture.SERVER_MEASURED_DURATION_FIELD]: 1 };
        await assert.rejects(fixture.attachMeasuredSourceDuration('/upscalevideo', body), /source media/i);
        assert.equal(Object.hasOwn(body, fixture.SERVER_MEASURED_DURATION_FIELD), false);
        assert.deepEqual(fixture.probes, []); assert.deepEqual(fixture.fallback, []);
    }
});

test('Other source-media routes retain exact input mapping and authoritative Probe billing', async () => {
    for (const [route, body, expectedUrls] of [
        ['/omnihuman', { lipSyncUrl: videoUrl }, [videoUrl]],
        ['/dreamactorroute', { video: videoUrl }, [videoUrl]],
        ['/lipsync2pro', { videoUrl, audioUrl }, [videoUrl, audioUrl]],
    ]) {
        const fixture = harness({ results: expectedUrls.map((_, index) => result(index === 0 ? 4.1 : 7.1)) });
        body[fixture.SERVER_MEASURED_DURATION_FIELD] = 999;
        await fixture.attachMeasuredSourceDuration(route, body);
        assert.deepEqual(fixture.probes, [{ InputFiles: expectedUrls.map(FileUrl => ({ FileUrl })) }]);
        assert.deepEqual(fixture.fallback, []);
        assert.equal(body[fixture.SERVER_MEASURED_DURATION_FIELD], expectedUrls.length === 1 ? 5 : 8);
    }
    const paired = harness({ results: [result(5)] });
    await assert.rejects(paired.attachMeasuredSourceDuration('/lipsync2pro', { videoUrl, audioUrl }), /could not measure/);
    assert.deepEqual(paired.fallback, []);
    const unrelated = harness();
    const body = { video: 'not-a-valid-url', duration: 3 };
    await unrelated.attachMeasuredSourceDuration('/another-route', body);
    assert.deepEqual(body, { video: 'not-a-valid-url', duration: 3 }); assert.deepEqual(unrelated.probes, []);
});
