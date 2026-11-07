const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
function evaluateInitializers(sourceText,type,music,narration){
 const source=ts.createSourceFile('Storybook.tsx',sourceText,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),statements=[];
 function visit(node){if(ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>['[legacyNarrationEnabled, setLegacyNarrationEnabled]','activatevoicenarration'].includes(d.name.getText(source))||d.name.getText(source)==='narrationRequiresBShots'))statements.push(node);ts.forEachChild(node,visit);}visit(source);
 assert.equal(statements.length,3);statements.sort((a,b)=>a.pos-b.pos);
 const code=ts.transpileModule(statements.map(s=>s.getText(source)).join('\n')+'\nreturn {narrationRequiresBShots,activatevoicenarration};',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const state = initial=>[narration??initial,()=>{}];
 return new Function('useState','type','isStoryMusicVideoMode','cinemaNarrationEnabled','usePersistedCreationState','creationDraft',code)(state,type,music,narration??false,(_controller,_section,_field,initial)=>state(initial),undefined);
}
test('production initialization preserves narration default and readiness across modes/toggle',()=>{
 const source=fs.readFileSync('src/Storybook.tsx','utf8');
 for(const [type,music,narration,required] of [[1,false,undefined,false],[1,false,true,true],[1,false,false,false],[1,true,undefined,false],[0,false,undefined,false],[3,false,undefined,false]]){
  const state=evaluateInitializers(source,type,music,narration);assert.equal(state.narrationRequiresBShots,required);assert.equal(state.activatevoicenarration,narration??(type!==1));
 }
});
