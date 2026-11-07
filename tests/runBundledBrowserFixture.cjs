const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
require('./bundledFixtureServer.cjs').install();
const filename=path.resolve(process.argv[2]);
let source=fs.readFileSync(filename,'utf8');
source=source.replace(/await import\((?:pathToFileURL\(path\.join\(root,\s*['"]node_modules\/vite\/dist\/node\/index\.js['"]\)\)|['"]vite['"])\)/g,"({createServer:opts=>require('./bundledFixtureServer.cjs').createServer(opts,fixture)})");
const mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod._compile(source,filename);
