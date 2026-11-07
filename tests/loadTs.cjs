const fs = require('node:fs'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
module.exports = function loadTs(file, mocks = {}, cache = new Map()) {
 const filename = path.resolve(file);
 if (cache.has(filename)) return cache.get(filename).exports;
 const mod = new Module(filename, module); cache.set(filename, mod); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
 mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.')
  ? module.exports(path.resolve(path.dirname(filename), name + '.ts'), mocks, cache) : Module.prototype.require.call(mod, name);
 mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText, filename);
 return mod.exports;
};
