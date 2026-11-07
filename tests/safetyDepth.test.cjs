const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {SAFETY_DEPTH_MODEL,safetyDepthInput,resolveSafetyDepthOutput}=require('../server/src/safetyDepth.ts');
test('verified depth provider uses actual published input schema',()=>{
 assert.match(SAFETY_DEPTH_MODEL,/^chenxwh\/depth-any-video:[a-f0-9]{64}$/);
 assert.deepEqual(safetyDepthInput('https://example.com/clip.mp4'),{input_image_or_video:'https://example.com/clip.mp4',input_is_video:true});
 for(const invalid of[{},undefined,'s3://bucket/key','file:///tmp/video','https://user:secret@example.com/clip'])assert.throws(()=>safetyDepthInput(invalid));
});
test('provider video strings/FileOutput objects are normalized without leaking objects to UI',()=>{
 for(const output of['https://example.com/depth.mp4',{url:()=>new URL('https://example.com/depth.mp4')},[{bad:true},{url:'https://example.com/depth.mp4'}],{depth_video:'https://example.com/depth.mp4'}])assert.equal(resolveSafetyDepthOutput(output),'https://example.com/depth.mp4');
 assert.throws(()=>resolveSafetyDepthOutput({url:'javascript:alert(1)'}));
});
