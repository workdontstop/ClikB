const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const crypto = require('node:crypto');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const sourcePath = 'docs/apps live rag fro app control/03_creation_intro.rag.txt';
const outputPath = 'server/src/imagePacerWorkflowSnapshot.ts';

function loadTypeScript(file) {
  const filename = path.resolve(root, file);
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod.require = name => name.startsWith('.')
    ? loadTypeScript(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)))
    : Module.prototype.require.call(mod, name);
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return mod.exports;
}

function buildWorkflowSnapshot() {
  const source = fs.readFileSync(path.join(root, sourcePath), 'utf8').replace(/\r\n/g, '\n');
  const selection = loadTypeScript('server/src/ConciergeKnowledge.ts').selectImagePacerWorkflowKnowledge({
    ragId: 'clikb_creation', title: 'ClikB Creation', instructions: source,
  });
  if (selection.fallback) throw new Error('Local Creation RAG does not supply the complete image-pacing workflow contract.');
  const version = Number(source.match(/\bversion:\s*(\d+)/)?.[1]);
  const hash = crypto.createHash('sha256').update(source).digest('hex');
  return '// Generated from ' + sourcePath + '; run node scripts/sync-image-pacer-workflow.cjs.\n'
    + '// Selects source workflow fields through the shared non-executable literal parser.\n'
    + 'export const BUNDLED_IMAGE_PACER_WORKFLOW_VERSION = ' + version + ';\n'
    + 'export const BUNDLED_IMAGE_PACER_WORKFLOW_SOURCE_SHA256 = ' + JSON.stringify(hash) + ';\n'
    + 'export const BUNDLED_IMAGE_PACER_WORKFLOW_KNOWLEDGE = ' + JSON.stringify(selection.instructions) + ';\n';
}

if (require.main === module) {
  const expected = buildWorkflowSnapshot();
  const destination = path.join(root, outputPath);
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(destination) || fs.readFileSync(destination, 'utf8').replace(/\r\n/g, '\n') !== expected) {
      throw new Error('Image-pacer workflow snapshot is out of sync; run node scripts/sync-image-pacer-workflow.cjs.');
    }
    process.stdout.write('Image-pacer workflow snapshot matches local Creation RAG.\n');
  } else {
    fs.writeFileSync(destination, expected, 'utf8');
    process.stdout.write('Updated ' + outputPath + '.\n');
  }
}

module.exports = { buildWorkflowSnapshot };
