const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(relative) {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const mod = { exports: {} };
    new Function('module', 'exports', code)(mod, mod.exports);
    return mod.exports;
}
const { videoWorkstationAction } = load('src/workstationActions.ts');
const { isSupportedVideoUploadDuration, VIDEO_UPLOAD_MAX_SECONDS, VIDEO_UPLOAD_FRAME_TOLERANCE_SECONDS } = load('src/videoUploadDuration.ts');
const base = {
    update: false, promptPixels: 5, spatialStudio: false, spatialAction: false, spatialPixels: 10,
    motion: false, motionReady: false, motionDraft: false, paidMotionPlan: false, motionPixels: 30,
    visual: false, visualReady: false, gpuRunning: false, model: 'Seedance', imagePixels: 22, videoPixels: 333,
};
const action = overrides => videoWorkstationAction({ ...base, ...overrides });
const expected = (key, label, pixels, policy) => ({ key, label, pixels, policy });

test('Pending AI instructions label the prompt update and its cost even with an existing guide and selected GPU', () => {
    assert.deepEqual(action({ update: true, spatialStudio: true, spatialAction: true, motion: true, motionDraft: true, paidMotionPlan: true, visual: true, gpuRunning: true }),
        expected('update_prompt', 'Update Prompt', 5, 'candidate'));
});
test('Spatial studio resolves to its ordinary 3D action before guide or video branches', () => {
    assert.deepEqual(action({ spatialStudio: true, motion: true, paidMotionPlan: true, visual: true }), expected('create_spatial_action', 'Create 3D action', 10, 'candidate'));
});
test('Initial Motion builds show selected planning prices while a ready reference always uses the video price', () => {
    for (const motionPixels of [10, 20, 30]) {
        assert.deepEqual(action({ motion: true, motionPixels }), expected('build_motion_guide', 'Build Motion Guide', motionPixels, 'requires_video'));
        assert.deepEqual(action({ motion: true, motionReady: true, motionDraft: true, motionPixels }), expected('generate_video', 'Generate Video', 333, 'requires_video'));
    }
});
test('An already-paid plan retries export for free only when no usable reference exists', () => {
    assert.deepEqual(action({ motion: true, motionReady: true, paidMotionPlan: true }), expected('generate_video', 'Generate Video', 333, 'requires_video'));
    assert.deepEqual(action({ motion: true, motionReady: false, paidMotionPlan: true }), expected('retry_motion_export', 'Retry Motion Export', 0, 'candidate'));
    assert.deepEqual(action({ motion: true, motionReady: false, motionDraft: true, paidMotionPlan: true }), expected('retry_motion_export', 'Retry Motion Export', 0, 'candidate'));
    assert.deepEqual(action({ motion: true, motionReady: true }), expected('generate_video', 'Generate Video', 333, 'requires_video'));
});
test('failed replacement plus edited wording labels the actual Generate video callback and its current price', () => {
    for (const motionPixels of [10, 20, 30]) for (const paidMotionPlan of [false, true]) {
        assert.deepEqual(action({ motion: true, motionReady: true, motionDraft: true, paidMotionPlan, motionPixels, videoPixels: 57 }),
            expected('generate_video', 'Generate Video', 57, 'requires_video'));
    }
    assert.deepEqual(action({ motion: true, motionReady: true, motionDraft: true, paidMotionPlan: true, gpuRunning: true }),
        expected('generate_video', 'Generate Video', 0, 'requires_video'));
});
test('Missing visual reference generates an image guide with its own ordinary cost before paid video', () => {
    assert.deepEqual(action({ visual: true, spatialAction: true }), expected('create_visual_guide', 'Generate Visual Guide', 22, 'candidate'));
    assert.deepEqual(action({ visual: true, visualReady: true }), expected('generate_video', 'Generate Video', 333, 'requires_video'));
    assert.deepEqual(action({ visual: true, model: 'GeminiOmni' }), expected('generate_video', 'Generate Video', 333, 'requires_video'));
});
test('Legacy spatial action generation uses paid video permission and cost after reference preparation', () => {
    assert.deepEqual(action({ spatialAction: true, visual: true, visualReady: true }), expected('generate_video', 'Generate Action Video', 333, 'requires_video'));
    assert.deepEqual(action({ spatialAction: true, gpuRunning: true }), expected('generate_video', 'Generate Action Video', 0, 'requires_video'));
});
test('Allocated GPU generation shows zero additional points but still requires Video permission', () => {
    assert.deepEqual(action({ gpuRunning: true, visual: true }), expected('generate_video', 'Generate Video', 0, 'requires_video'));
    assert.deepEqual(action({ motion: true, motionReady: true, gpuRunning: true }), expected('generate_video', 'Generate Video', 0, 'requires_video'));
});
test('stored video metadata retry costs zero and takes precedence over ordinary paid creation', () => {
    assert.deepEqual(action({ retryVideoSave: true, update: true, motion: true, paidMotionPlan: true, visual: true }),
        expected('retry_video_save', 'Retry save', 0, 'candidate'));
    assert.deepEqual(action({ retryVideoSave: true, spatialStudio: true }), expected('create_spatial_action', 'Create 3D action', 10, 'candidate'));
    assert.deepEqual(action({ retryVideoSave: true, spatialStudio: true, update: true }), expected('update_prompt', 'Update Prompt', 5, 'candidate'));
});
test('Upload accepts nominal ten-second clips and extra container/frame timing through the exact shared boundary', () => {
    assert.equal(VIDEO_UPLOAD_MAX_SECONDS, 10);
    assert.equal(VIDEO_UPLOAD_FRAME_TOLERANCE_SECONDS, 0.25);
    for (const duration of [0.001, 5, 10, 10.000001, 10.025, 10.25]) assert.equal(isSupportedVideoUploadDuration(duration), true, String(duration));
    for (const duration of [10.250001, 10.3, 11, 0, -1, NaN, Infinity, -Infinity]) assert.equal(isSupportedVideoUploadDuration(duration), false, String(duration));
});
