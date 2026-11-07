const assert = require('node:assert/strict'), path = require('node:path');
const {chromium} = require('../.tmp/concierge-browser-deps/node_modules/playwright');
(async () => {
 const fixture = `import { createDraftController } from './src/creationDrafts/store';
import { prepareDraftEntry } from './src/creationDrafts/entry';
const base={postId:23,draftId:'draft-overflow',revision:3,digest:'three',published:false,snapshot:{schemaVersion:1,creationProjectId:'overflow-project',creationType:0,sections:{prompt:{prompt:'Cloud base'}}}};
const key='clik-creation-draft:v1:7:overflow-project';
const stale=JSON.stringify({version:1,accountId:'7',snapshot:base.snapshot,revision:3,updatedAt:1});
const storage={getItem:()=>stale,setItem:()=>{throw new Error('Quota exceeded')}};
const draft=createDraftController({accountId:7,creationProjectId:'overflow-project',creationType:0,record:base,storage,protectMedia(){},api:{checkpoint:async()=>{throw new Error('offline')}}});
draft.endHydration();draft.capture('prompt',{prompt:'Already accepted work'});
window.result=(async()=>{
 try{await draft.checkpoint('quiet')}catch{}
 draft.capture('prompt',{prompt:'Newest accepted work'});try{await draft.flush()}catch{}
 // A page/entry restart must prefer the newer IndexedDB envelope to stale Web Storage.
 const calls=[]; const api={read:async()=>base,checkpoint:async req=>{calls.push(req);return {...base,revision:3+calls.length,snapshot:req.snapshot}}};
 const entry=await prepareDraftEntry({accountId:7,postId:23,mode:'resume',storage,api});
 entry.controller.endHydration();draft.dispose();entry.controller.dispose();
 return {prompt:entry.record.snapshot.sections.prompt.prompt,calls:calls.map(r=>({id:r.saveId,revision:r.expectedRevision,prompt:r.snapshot.sections.prompt.prompt})),saved:entry.controller.getState().saved};
})();`;
 const built=await require('esbuild').build({stdin:{contents:fixture,resolveDir:path.resolve(__dirname,'..'),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  const page=await browser.newPage();
  await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<script>'+built.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>'}));
  await page.goto('http://draft-overflow.test');
  const result=await page.evaluate(()=>window.result);
  assert.equal(result.prompt,'Newest accepted work');assert.equal(result.saved,true);
  assert.deepEqual(result.calls.map(r=>r.revision),[3,4]);
  assert.deepEqual(result.calls.map(r=>r.prompt),['Already accepted work','Newest accepted work']);
  console.log('PASS IndexedDB quota fallback, newest local outbox replay, serialized cloud revisions');
 } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
