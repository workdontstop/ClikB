const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function loadTypeScript(file) {
  const filename = path.resolve(root, file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const mod = new Module(filename, module);
  cache.set(filename, mod);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = name => name.startsWith('.')
    ? loadTypeScript(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)))
    : Module.prototype.require.call(mod, name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, filename);
  return mod.exports;
}
module.exports = { loadTypeScript, ...loadTypeScript('server/src/promptLiterals.ts'), ...loadTypeScript('server/src/characterVoiceIdentity.ts'), ...loadTypeScript('server/src/imagePromptEditContext.ts'), ...loadTypeScript('server/src/imagePromptPacer.ts') };
