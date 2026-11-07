const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process'),ts=require('typescript');
const baseline='df3830f',read=f=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n'),before=f=>cp.execFileSync('git',['show',baseline+':'+f],{encoding:'utf8',maxBuffer:1e7}).replace(/\r\n/g,'\n');
const files=['src/Storybook.tsx','src/EditStory.tsx','src/PromptInput.tsx','src/NotepadEditor.tsx','src/Plan.tsx','src/PublishLoader.tsx','src/PublishLoader2.tsx'];
function bindingIds(text){
 const source=ts.createSourceFile('x.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),result=new Set();
 const args=node=>node.arguments.map(arg=>arg.getText(source));
 function visit(node){
  if(ts.isCallExpression(node)){
   const callee=node.expression.getText(source);
   if(callee==='cb'){
    const [area,key,,handler,kind="'click'",policy="'candidate'"]=args(node);
    result.add([area,key,handler,kind,policy].join('|'));
   } else if(callee==='gridSceneEntryBinding'){
    const [key]=args(node);
    result.add(["'storybook_grid'",key,"'setstartEdit'","'click'","'candidate'"].join('|'));
   }
  }
  ts.forEachChild(node,visit);
 }
 visit(source);
 return result;
}
test('native control IDs, handlers, operation and permission policy are retained from the pre-Deck baseline',()=>{
 for(const file of files){
  const current=read(file),currentBindings=bindingIds(current);
  if(file==='src/Storybook.tsx'&&current.includes('const gridSceneEntryBinding')){
   assert.match(current,/const gridSceneEntryBinding[\s\S]{0,480}\? 'enterSceneFromGrid\/openDeck' : 'setstartEdit'/);
  }
  assert.deepEqual([...bindingIds(before(file))].filter(binding=>!currentBindings.has(binding)),[],file);
 }
});
test('active RAG packets retain all exact action/control identifiers and document identities',()=>{
 const folder='docs/apps live rag fro app control/';for(const name of ['01_clikb_app_overview.rag.txt','01_navigation_profile_settings.rag.txt','02_feeds_usage.rag.txt','03_creation_intro.rag.txt','04_deck_overlay.rag.txt']){
  const file=folder+name;const ids=text=>new Set(text.match(/\bclikb\.[\w.:<>/-]+/g)||[]);const currentIds=ids(read(file));
  assert.deepEqual([...ids(before(file))].filter(id=>!currentIds.has(id)),[],file);
  assert.equal(read(file).match(/\bdocId:\s*"([^"]+)"/)?.[1],before(file).match(/\bdocId:\s*"([^"]+)"/)?.[1]);
 }
});
test('Lambda entry and Concierge system-prompt literals are unchanged',()=>{
 const file='server/lambda/advanced_ffmpeg_lambda/index.mjs';assert.equal(read(file),before(file));
 function literals(text){const source=ts.createSourceFile('GptApi.ts',text,ts.ScriptTarget.Latest,true),result=[];
 function visit(n){if((ts.isVariableDeclaration(n)||ts.isPropertyAssignment(n))&&/system.?prompt|concierge.*prompt|prompt.*concierge/i.test(n.name?.getText(source)||''))result.push(n.getText(source));ts.forEachChild(n,visit);}visit(source);return result;}
 assert.deepEqual(literals(read('server/src/GptApi.ts')),literals(before('server/src/GptApi.ts')));
});
