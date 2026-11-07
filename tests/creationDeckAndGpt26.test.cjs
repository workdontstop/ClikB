const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');

function loadTsModule(relPath, mocks = {}, cache = new Map()) {
  const filename = path.resolve(__dirname, '..', relPath);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('.')) {
      const base = path.resolve(path.dirname(filename), name);
      const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')];
      const resolved = candidates.find((c) => fs.existsSync(c));
      if (resolved) {
        return loadTsModule(path.relative(path.resolve(__dirname, '..'), resolved), mocks, cache);
      }
    }
    return Module.prototype.require.call(mod, name);
  };
  const code = fs.readFileSync(filename, 'utf8');
  const transpiled = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  mod._compile(transpiled, filename);
  return mod.exports;
}

test('GPT Image 2.6 upgrade preserves internal example-set keys and pixel costs while updating display names and endpoints', () => {
  const imageModels = loadTsModule('src/imageModels.ts');
  const preciseSpec = loadTsModule('server/src/preciseEditSpec.ts');
  const templateModels = loadTsModule('server/src/templateCoverModels.ts');

  // Internal keys remain intact for saved example sets in ModelSelectionModal
  assert.equal(imageModels.GPT_IMAGE_25_FLARE, 'GPT Image 2.5 Flare');
  assert.equal(imageModels.GPT_IMAGE_25_SUNBURST, 'GPT Image 2.5 Sunburst');

  // Display names and creation control snapshot names report 2.6
  assert.equal(imageModels.getImageModelDisplayName(imageModels.GPT_IMAGE_25_FLARE), 'GPT Image 2.6 Flare');
  assert.equal(imageModels.getImageModelDisplayName(imageModels.GPT_IMAGE_25_SUNBURST), 'GPT Image 2.6 Sunburst');
  assert.equal(imageModels.getCreationImageModelName(imageModels.GPT_IMAGE_25_FLARE), 'GPT Image 2.6 Flare');
  assert.equal(imageModels.getCreationImageModelName(imageModels.GPT_IMAGE_25_SUNBURST), 'GPT Image 2.6 Sunburst');

  // Pixel costs remain 6 P (Fast) and 24 P (Pro) for both internal keys and 2.6 display names
  assert.equal(imageModels.getImageModelPixelCost(imageModels.GPT_IMAGE_25_FLARE), 6);
  assert.equal(imageModels.getImageModelPixelCost(imageModels.GPT_IMAGE_25_SUNBURST), 24);
  assert.equal(imageModels.getImageModelPixelCost('GPT Image 2.6 Flare'), 6);
  assert.equal(imageModels.getImageModelPixelCost('GPT Image 2.6 Sunburst'), 24);

  // Precise Edit and Template Covers report 2.6
  assert.deepEqual(preciseSpec.PRECISE_MODEL_NAMES, {
    flare: 'GPT Image 2.6 Flare',
    sunburst: 'GPT Image 2.6 Sunburst',
    krea: 'Krea 3',
  });
  assert.equal(templateModels.TEMPLATE_COVER_MODELS.hd.label, 'GPT Image 2.6');
  assert.equal(templateModels.TEMPLATE_COVER_MODELS.hd.model, 'GPT Image 2.5 Flare');
});

test('CreationDeck locks horizontal touch swipe with pointer capture and preserves vertical scroll', () => {
  const deckGestures = loadTsModule('src/deckGestures.ts');
  const deckCode = fs.readFileSync(path.resolve(__dirname, '../src/CreationDeck.tsx'), 'utf8');
  const deckCss = fs.readFileSync(path.resolve(__dirname, '../src/CreationDeck.css'), 'utf8');

  assert.equal(deckGestures.deckGestureAxis(-48, 6), 'x');
  assert.equal(deckGestures.deckGestureAxis(5, 44), 'y');
  assert.ok(deckCode.includes('onPointerMove={event => {'));
  assert.ok(deckCode.includes('start.owner.setPointerCapture?.(start.id)'));
  assert.ok(deckCss.includes('.creation-deck-card-open'));
  assert.ok(deckCss.includes('touch-action: pan-y pinch-zoom;'));
});

test('PromptInput openCharacterStudio syncs promptDeckVisible with fromDeck without breaking deckEnabled toggle', () => {
  const promptCode = fs.readFileSync(path.resolve(__dirname, '../src/PromptInput.tsx'), 'utf8');
  assert.ok(
    promptCode.includes('const openCharacterStudio = (fromDeck = false) => {\r\n    if (creationDeckEnabled) setPromptDeckVisible(fromDeck);') ||
    promptCode.includes('const openCharacterStudio = (fromDeck = false) => {\n    if (creationDeckEnabled) setPromptDeckVisible(fromDeck);')
  );
  assert.ok(
    promptCode.includes('useEffect(() => { if (creationDeckEnabled) setPromptDeckVisible(true); }, [creationDeckEnabled]);')
  );
});
