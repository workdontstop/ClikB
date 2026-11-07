const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),{execFileSync}=require('node:child_process');
function classifiers(source){const start=source.indexOf('function normalizeTranscript'),end=source.indexOf('function getFrameRms');
 const ast=ts.createSourceFile('voice.ts',source,ts.ScriptTarget.Latest,true);const echo=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='isLikelyEchoTranscript').getText(ast);
 const js=ts.transpileModule(source.slice(start,end)+'\n'+echo,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 return new Function(js+';return {isFillerOnly,isLikelySttKeytermLeak,isImmediateInterruptTranscript,isConfirmedUserSpeechTranscript,isLikelyEchoTranscript,collapseRepeatedShortTranscript};')();}
test('receipt additions preserve baseline filler/noise/echo, interruption and repeated-transcript decisions',()=>{
 const old=classifiers(execFileSync('git',['show','696df9c:src/hooks/useGeminiVoice.ts'],{encoding:'utf8'})),current=classifiers(fs.readFileSync('src/hooks/useGeminiVoice.ts','utf8'));
 for(const text of ['um uh hmm','yeah','the','ClikB, creative AI, brainstorm, magic mirror, shorts','stop','pause now','Please update Alice’s character reference','Hello Guide','continue continue']){
  for(const name of ['isFillerOnly','isLikelySttKeytermLeak','isImmediateInterruptTranscript','collapseRepeatedShortTranscript'])assert.deepEqual(current[name](text),old[name](text),name+': '+text);
  for(const duringTts of [true,false])assert.equal(current.isConfirmedUserSpeechTranscript(text,{final:true,duringTts}),old.isConfirmedUserSpeechTranscript(text,{final:true,duringTts}));
 }
 assert.equal(current.isFillerOnly('um uh hmm'),true);assert.equal(current.isImmediateInterruptTranscript('stop'),true);
 assert.equal(current.isConfirmedUserSpeechTranscript('Please update Alice’s character reference',{final:true}),true);
 assert.equal(current.isLikelyEchoTranscript('The scene is ready','The scene is ready for your review'),true);
 assert.equal(current.isLikelyEchoTranscript('Please change the camera','The scene is ready for your review'),false);
});
