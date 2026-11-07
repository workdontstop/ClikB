const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const jsx = (type, props) => ({ type, props: props || {} });
function nodes(tree, predicate) {
  const found = [];
  const visit = value => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object' || !value.props) return;
    if (predicate(value)) found.push(value);
    visit(value.props.children);
  };
  visit(tree); return found;
}
function compile(file, requireMock, globals = {}, sourceOverride) {
  const source = (sourceOverride || fs.readFileSync(path.join(root, file), 'utf8')).replaceAll('import.meta.env.VITE_CLIK_URL', "'https://fixture.invalid'");
  const output = ts.transpileModule(source, { fileName: file, compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, require: requireMock, console: { log() {}, error() {} },
    Blob, Map, Set, Promise, Date, ...globals }, { filename: file });
  return module.exports;
}
function settingsModule() {
  const values = {
    './themeSchedule': { isScheduledDarkMode: () => true },
    './imageModels': { DEFAULT_IMAGE_MODEL: 'fixture' },
    './profileSlice': { setLoggedUser: { type: 'profile/setLoggedUser' }, clearLoggedUser: { type: 'profile/clearLoggedUser' } },
    './appAccentColors': { DEFAULT_APP_ACCENT_COLORS: { dark: '#aa33cc', light: '#0099cc' }, savedAppAccentColor: () => '#aa33cc' },
  };
  return compile('src/settingsSlice.ts', name => values[name] || require(name));
}
function environment(settings = settingsModule()) {
  const env = { settings, state: { settings: settings.default(undefined, { type: 'init' }) }, actions: [],
    frames: new Map(), timers: new Map(), observers: [], images: [], owned: [], revoked: [], calls: [], draws: [],
    rectangleReads: 0, colorReads: 0, nextId: 1, clock: 1000, listeners: new Map() };
  env.dispatch = action => { env.actions.push(action); env.state.settings = settings.default(env.state.settings, action); };
  env.canvas = { width: 600, height: 1067, parentElement: { clientHeight: 640 },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 360, height: 640 }),
    getContext: () => ({ clearRect() {}, drawImage(img, x) { env.draws.push({ source: img.src, x }); },
      getImageData() { env.colorReads++; return { data: new Uint8ClampedArray([50, 60, 70, 255]) }; } }),
    toBlob(callback, format) { callback(new Blob([JSON.stringify(env.draws.at(-1))], { type: format })); },
  };
  env.container = { clientLeft: 0, clientTop: 0, clientHeight: 800,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: env.container.clientHeight }) };
  env.rect = { left: 0, top: 0, width: 1200, height: 800 };
  env.video = { offsetParent: env.container, parentElement: env.container, paused: true, muted: true, volume: 1,
    isConnected: true, src: '', onended: null, mediaListeners: new Map(),
    addEventListener(name, listener) { if (!this.mediaListeners.has(name)) this.mediaListeners.set(name, new Set()); this.mediaListeners.get(name).add(listener); },
    removeEventListener(name, listener) { this.mediaListeners.get(name)?.delete(listener); },
    removeAttribute(name) { if (name === 'src') this.src = ''; },
    load() { this.paused = true; },
    duration: 20, currentTime: 0, videoWidth: 1080, videoHeight: 1920,
    getBoundingClientRect() { env.rectangleReads++; return env.rect; },
    async play() { env.video.paused = false; }, pause() { env.video.paused = true; } };
  env.axios = {
    async post(url, body) { env.calls.push({ method: 'post', url, body });
      return url.endsWith('/GptTagger') ? { data: { title: 'Fixture title', tags: ['tag'], categories: ['category'] } }
        : { data: { holder: [{ urlBase: 'https://fixture.invalid/base', urlHD: 'https://fixture.invalid/chosen.webp?signature=fixture' }] } }; },
    async put(url, body) { env.calls.push({ method: 'put', url, body, ...(body instanceof Blob ? { blobText: await body.text() } : {}) });
      return { status: 200, data: {} }; },
  };
  env.globals = {
    window: { addEventListener(name, fn) { env.listeners.set(name, fn); }, removeEventListener(name) { env.listeners.delete(name); } },
    navigator: { userAgent: 'fixture desktop' }, document: { createElement: () => env.canvas },
    URL: { createObjectURL(blob) { const url = `blob:fixture-${env.nextId++}`; env.owned.push({ url, blob }); return url; },
      revokeObjectURL(url) { env.revoked.push(url); } },
    Image: class { constructor() { this.naturalWidth = 1600; this.naturalHeight = 900; env.images.push(this); } },
    ResizeObserver: class { constructor(callback) { this.callback = callback; this.targets = []; env.observers.push(this); }
      observe(target) { this.targets.push(target); } disconnect() { this.disconnected = true; } },
    requestAnimationFrame(fn) { const id = env.nextId++; env.frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { env.frames.delete(id); },
    setTimeout(fn) { const id = env.nextId++; env.timers.set(id, fn); return id; }, clearTimeout(id) { env.timers.delete(id); },
    Date: class extends Date { static now() { return env.clock; } },
  };
  return env;
}
function renderFixture(file, props, env = environment()) {
  const slots = []; let cursor = 0, pending = [], dirty = true, tree;
  const different = (a, b) => !a || !b || a.length !== b.length || a.some((x, index) => !Object.is(x, b[index]));
  const react = {
    useState(initial) { const at = cursor++; if (!slots[at]) slots[at] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[at].value, update => { const value = typeof update === 'function' ? update(slots[at].value) : update;
        if (!Object.is(value, slots[at].value)) { slots[at].value = value; dirty = true; } }]; },
    useRef(initial) { const at = cursor++; if (!slots[at]) slots[at] = { current: initial }; return slots[at]; },
    useMemo(factory, deps) { const at = cursor++; if (!slots[at] || different(slots[at].deps, deps)) slots[at] = { deps, value: factory() }; return slots[at].value; },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(fn, deps) { const at = cursor++; if (!slots[at]) slots[at] = {};
      if (different(slots[at].deps, deps)) { slots[at].deps = deps; pending.push(() => { slots[at].cleanup?.(); slots[at].cleanup = fn(); }); } },
  };
  const mui = new Proxy({ useTheme: () => ({ breakpoints: { up: () => 'md' }, spacing: n => `${n * 8}px`, shape: { borderRadius: 8 } }),
    useMediaQuery: () => true }, { get: (target, name) => target[name] || String(name) });
  const imports = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, '@mui/material': mui,
    'framer-motion': { motion: { div: 'motion.div' }, AnimatePresence: 'AnimatePresence' }, axios: env.axios,
    'react-redux': { useSelector: selector => selector(env.state), useDispatch: () => env.dispatch },
    './settingsSlice': env.settings,
    './videoPlaybackLayout': require('./promptTestBindings.cjs').loadTypeScript('src/videoPlaybackLayout.ts'),
    './ownedMediaLifecycle': require('./promptTestBindings.cjs').loadTypeScript('src/ownedMediaLifecycle.ts'),
    './brainstormSlice': { publishFeedsArea: payload => ({ type: 'snapshot', payload }), removeFeedsArea: payload => ({ type: 'remove', payload }) },
    './DetectDevice': { matchMobile: false }, './useCreationControls': { useCreationControls() {} },
    './creationControlSnapshot': { creationBinding: (_area, key) => ({ 'data-fixture-control': key }) },
  };
  const component = compile(file, name => imports[name] || (name.startsWith('@mui/icons-material/') ? name : require(name)), env.globals).default;
  const fixture = {
    env, props, get tree() { return tree; },
    render(nextProps) { if (nextProps) fixture.props = { ...fixture.props, ...nextProps }; dirty = true; let passes = 0;
      while (dirty || pending.length || env.frames.size) {
        if (++passes > 40) throw new Error(`Render did not settle: ${file}`);
        if (dirty) { dirty = false; cursor = 0; tree = component(fixture.props);
          for (const node of nodes(tree, x => x.type === 'video' || x.type === 'canvas')) {
            if (node.type === 'video') {
              if (env.video.fixtureSource && env.video.fixtureSource !== node.props.src) env.video.paused = true;
              env.video.fixtureSource = node.props.src;
              env.video.src = node.props.src;
            }
            if (typeof node.props.ref === 'function') node.props.ref(node.type === 'video' ? env.video : env.canvas);
            else if (node.props.ref) node.props.ref.current = node.type === 'video' ? env.video : env.canvas;
          }
        }
        const effects = pending; pending = []; effects.forEach(fn => fn());
        const frames = [...env.frames.values()]; env.frames.clear(); frames.forEach(fn => fn());
      }
      return tree;
    },
    findControl(key) { return nodes(tree, x => x.props['data-fixture-control'] === key)[0]; },
    find(predicate) { return nodes(tree, predicate)[0]; },
    loadCurrentImage() { env.images.at(-1).onload(); fixture.render(); },
    unmount() {
      for (const node of nodes(tree, x => x.type === 'video')) {
        if (typeof node.props.ref === 'function') node.props.ref(null);
        else if (node.props.ref) node.props.ref.current = null;
      }
      env.video.isConnected = false;
      slots.forEach(slot => slot.cleanup?.());
    },
  };
  fixture.render(); return fixture;
}
async function settle(fixture) { for (let i = 0; i < 8; i++) { await Promise.resolve(); fixture.render(); } }
function fullscreenCaptionFixtures() {
  const source = ts.createSourceFile('src/FullScreenStories.tsx', fs.readFileSync(path.join(root, 'src/FullScreenStories.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const captions = [], playback = [];
  const visit = node => {
    if (ts.isJsxElement(node)) {
      const start = node.openingElement;
      if (start.tagName.getText(source) === 'Typography' && start.attributes.properties.some(prop => prop.name?.getText(source) === 'data-feeds-caption-scroll')) captions.push(node);
    }
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'VideoPlayer') {
      const prop = node.attributes.properties.find(prop => prop.name?.getText(source) === 'onPlaybackChange');
      if (prop) playback.push(prop.initializer.expression);
    }
    ts.forEachChild(node, visit);
  }; visit(source);
  return { captions: captions.map(node => {
    const code = `export default function Caption(props) { const {index,verticalActiveIndex,captionExpanded,hidePlayingCaption,fullscreenAreaId,type,matchMobile,item,feeds,setActiveCap,setHideT,GotoProfile,darkModeReducer}=props;return (${node.getText(source)}); }`;
    return compile('caption-fixture.tsx', () => ({ jsx, jsxs: jsx, Fragment: 'Fragment' }),
      { Typography: 'Typography', IconButton: 'IconButton', CloseIcon: 'CloseIcon' }, code).default;
  }), playback: playback.map(node => bindings => {
    const code = ts.transpileModule(`const callback = ${node.getText(source)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    return new Function(...Object.keys(bindings), code + 'return callback;')(...Object.values(bindings));
  }) };
}
module.exports = { environment, renderFixture, settle, nodes, settingsModule, fullscreenCaptionFixtures };
