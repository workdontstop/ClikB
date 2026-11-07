const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

function rendererHarness(failure = '', encoded = true, controller = new AbortController()) {
    const counts = { sceneDisposed: 0, rendererDisposed: 0, contextLost: 0, canceled: 0, tracksStopped: 0, listeners: 0 };
    class Renderer {
        setPixelRatio() {}
        setSize() { if (failure === 'size') throw new Error('size failed'); }
        render() {}
        dispose() { counts.rendererDisposed++; }
        forceContextLoss() { counts.contextLost++; }
    }
    class Output {
        state = 'pending';
        addVideoTrack() { if (failure === 'track') throw new Error('track failed'); }
        async start() { this.state = 'started'; }
        async cancel() { counts.canceled++; this.state = 'canceled'; if (failure === 'cancel') throw new Error('cancel failed'); }
    }
    class CanvasSource {
        constructor() { if (failure === 'source') throw new Error('source failed'); }
        async add() { if (failure === 'cancel') throw new Error('encoding failed'); controller.abort(); }
    }
    const mocks = {
        three: { WebGLRenderer: Renderer },
        './motionGuide': { validateMotionPlan: value => value },
        './motionScene': { createMotionScene() {
            if (failure === 'scene') throw new Error('scene failed');
            return { draw() {}, dispose() { counts.sceneDisposed++; } };
        } },
        './motionExportTiming': { motionExportComplete: () => true, readMotionExportDuration: async () => 2 },
        mediabunny: { Output, CanvasSource, Mp4OutputFormat: class {}, BufferTarget: class {}, Quality: class {}, canEncodeVideo: async () => encoded },
    };
    const filename = path.resolve(__dirname, '../src/motionGuideRenderer.ts'), mod = new Module(filename, module);
    mod.require = name => { assert.ok(Object.hasOwn(mocks, name), name); return mocks[name]; };
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText, filename);
    return { ...mod.exports, counts, controller };
}

async function canvasHarness(run, failure = '') {
    const names = ['document', 'HTMLCanvasElement', 'MediaRecorder', 'requestAnimationFrame', 'cancelAnimationFrame'];
    const previous = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(global, name)]));
    let stopped = 0;
    class Canvas { captureStream() { if (failure === 'capture') throw new Error('capture failed'); return { getTracks: () => [{ stop: () => stopped++ }] }; } }
    const document = new EventTarget(); document.hidden = false; document.createElement = () => new Canvas();
    global.document = document; global.HTMLCanvasElement = Canvas;
    global.MediaRecorder = class { static isTypeSupported() { return true; } start() { throw new Error('recorder failed'); } };
    global.requestAnimationFrame = () => 1; global.cancelAnimationFrame = () => {};
    try { await run(() => stopped); }
    finally { for (const name of names) { const descriptor = previous.get(name); if (descriptor) Object.defineProperty(global, name, descriptor); else delete global[name]; } }
}

test('renderer setup failure and repeated disposal release each owned WebGL context once', () => {
    for (const failure of ['size', 'scene']) {
        const h = rendererHarness(failure);
        assert.throws(() => h.createMotionRenderer({}, {}, 720, 720), /failed/);
        assert.equal(h.counts.rendererDisposed, 1); assert.equal(h.counts.contextLost, 1);
    }
    const h = rendererHarness(), view = h.createMotionRenderer({}, {}, 720, 720);
    view.dispose(); view.dispose();
    assert.equal(h.counts.sceneDisposed, 1); assert.equal(h.counts.rendererDisposed, 1); assert.equal(h.counts.contextLost, 1);
});

test('encoding setup, cancellation and failed cancel still release the recording renderer', async () => canvasHarness(async () => {
    for (const failure of ['source', 'track', 'cancel', '']) {
        const h = rendererHarness(failure);
        await assert.rejects(h.recordMotionGuide({ duration: 2 }, '1:1', h.controller.signal, () => {}));
        assert.equal(h.counts.canceled, 1, failure);
        assert.equal(h.counts.sceneDisposed, 1, failure); assert.equal(h.counts.rendererDisposed, 1, failure); assert.equal(h.counts.contextLost, 1, failure);
    }
}));

test('native capture and recorder startup failures stop streams and remove abort listeners', async () => {
    await canvasHarness(async () => {
        const h = rendererHarness('', false);
        await assert.rejects(h.recordMotionGuide({ duration: 2 }, '1:1', h.controller.signal, () => {}), /capture failed/);
        assert.equal(h.counts.sceneDisposed, 1); assert.equal(h.counts.contextLost, 1);
    }, 'capture');
    await canvasHarness(async stopped => {
        const h = rendererHarness('', false), signal = h.controller.signal;
        const add = signal.addEventListener.bind(signal), remove = signal.removeEventListener.bind(signal);
        signal.addEventListener = (...args) => { h.counts.listeners++; return add(...args); };
        signal.removeEventListener = (...args) => { h.counts.listeners--; return remove(...args); };
        await assert.rejects(h.recordMotionGuide({ duration: 2 }, '1:1', signal, () => {}), /recorder failed/);
        assert.equal(stopped(), 1); assert.equal(h.counts.listeners, 0); assert.equal(h.counts.sceneDisposed, 1); assert.equal(h.counts.contextLost, 1);
    });
});

test('prompt-only guide updates retain the preview context; plan replacement and unmount release it', () => {
    const previousDocument = global.document, previousRaf = global.requestAnimationFrame, previousCancel = global.cancelAnimationFrame;
    let effectDeps, cleanup, created = 0, disposed = 0, removed = 0;
    const host = { current: { replaceChildren() {} } };
    const react = {
        useRef: () => host, useState: () => ['', () => {}],
        useEffect(run, deps) {
            if (!effectDeps || deps.some((value, i) => value !== effectDeps[i])) {
                cleanup?.(); cleanup = run(); effectDeps = deps;
            }
        },
    };
    global.document = { createElement: () => ({ style: {}, remove() { removed++; } }) };
    global.requestAnimationFrame = () => 1; global.cancelAnimationFrame = () => {};
    const filename = path.resolve(__dirname, '../src/components/MotionGuidePreview.tsx'), mod = new Module(filename, module);
    mod.require = name => name === 'react' ? react : name === 'react/jsx-runtime' ? { jsx: () => null, jsxs: () => null }
        : name === '../motionGuideRenderer' ? { createMotionRenderer() { created++; return { draw() {}, dispose() { disposed++; } }; } } : {};
    try {
        mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
            module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
        } }).outputText + '\nexports.MotionCanvas = MotionCanvas;', filename);
        const guide = { plan: { duration: 5 }, aspectRatio: '16:9' };
        mod.exports.MotionCanvas({ guide, expanded: false });
        mod.exports.MotionCanvas({ guide: { ...guide, draftPrompt: 'New prompt only' }, expanded: false });
        assert.equal(created, 1); assert.equal(disposed, 0);
        mod.exports.MotionCanvas({ guide: { ...guide, plan: { duration: 5 } }, expanded: false });
        assert.equal(created, 2); assert.equal(disposed, 1);
        cleanup(); assert.equal(disposed, 2); assert.equal(removed, 2);
    } finally {
        if (previousDocument === undefined) delete global.document; else global.document = previousDocument;
        if (previousRaf === undefined) delete global.requestAnimationFrame; else global.requestAnimationFrame = previousRaf;
        if (previousCancel === undefined) delete global.cancelAnimationFrame; else global.cancelAnimationFrame = previousCancel;
    }
});

test('a paid replacement with changed wording exposes distinct free retry and deliberate rebuild controls', () => {
    const filename = path.resolve(__dirname, '../src/components/MotionGuidePreview.tsx'), mod = new Module(filename, module);
    const retry = () => {}, rebuild = () => {};
    mod.require = name => name === 'react' ? { useRef: () => ({ current: null }), useState: value => [value, () => {}], useEffect() {} }
        : name === 'react/jsx-runtime' ? { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
        : name === '@mui/material' ? Object.fromEntries(['Alert', 'Box', 'Button', 'Dialog', 'DialogContent', 'DialogTitle', 'IconButton', 'LinearProgress', 'TextField', 'Tooltip', 'Typography'].map(name => [name, name]))
        : name === '@mui/material/styles' ? { alpha: () => '' }
        : name === '../appAccentStyles' ? { appAccentButtonSx: () => ({}) }
        : name === '../motionGuide' ? { motionGuidePrice: () => 35 }
        : name === '../useCreationControls' ? { useCreationControls() {} }
        : name === '../creationControlSnapshot' ? { creationBinding: (_area, control, _description, handler) => ({ control, handler }) } : {};
    mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } }).outputText, filename);
    const guide = { videoUrl: 'old.mp4', sourcePrompt: 'old reference', draftPrompt: 'new wording', pendingReplacement: { sourcePrompt: 'paid replacement' } };
    const tree = mod.exports.default({ guide, planningTier: 'sol', onRetry: retry, onRebuild: rebuild });
    const controls = new Map();
    const walk = value => {
        if (!value || typeof value !== 'object') return;
        if (Array.isArray(value)) return value.forEach(walk);
        if (value.props?.control) controls.set(value.props.control, value.props);
        walk(value.props?.children);
    };
    walk(tree);
    assert.equal(controls.get('retry_export').onClick, retry); assert.equal(controls.get('retry_export').children, 'Retry export · 0 P');
    assert.equal(controls.get('rebuild_prompt').onClick, rebuild); assert.equal(controls.get('rebuild_prompt').handler, 'onRebuild');
});
