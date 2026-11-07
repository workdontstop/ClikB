const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const load=require('./loadTs.cjs');
const {AnnouncementLedger,announcementKey,acceptConciergeDelta}=load('src/conciergeAnnouncements.ts');
test('automatic event lifecycle deduplicates pending/emitted but retries cancelled events',()=>{
 const ledger=new AnnouncementLedger(),snapshot={creation:{projectId:'p',stage:'images',mediaRevision:1}};
 const key=announcementKey(snapshot,'creation-progress');assert.equal(ledger.begin(key),true);assert.equal(ledger.begin(key),false);
 ledger.finish(key,false);assert.equal(ledger.begin(key),true);ledger.finish(key,true);assert.equal(ledger.begin(key),false);
 assert.equal(ledger.begin(announcementKey({...snapshot,creation:{...snapshot.creation,mediaRevision:2}},'creation-progress')),true);
 ledger.clear();assert.equal(ledger.begin(key),true);
});
test('delta identity deduplicates repeated delivery, preserving legitimate repeated text chunks',()=>{
 const seen=new Set();assert.equal(acceptConciergeDelta(seen,{eventId:'one'}),true);assert.equal(acceptConciergeDelta(seen,{eventId:'one'}),false);
 assert.equal(acceptConciergeDelta(seen,{eventId:'two'}),true);assert.equal(acceptConciergeDelta(seen,{}),true);
});
test('production automatic scheduler finishes control bookkeeping without awaiting deferred TTS',async()=>{
 const source=ts.createSourceFile('provider.tsx',fs.readFileSync('src/components/BrainstormSessionProvider.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let callback;
 function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='runAutomaticGuideCall')callback=node.initializer.arguments[0].getText(source);ts.forEachChild(node,visit);}visit(source);
 const actions=[],calls=[],speech=[],controllers=new Map(),inflight=new Set();
 let allowProgress=true;
 const bindings={allowCreationProgressAnnouncement:()=>allowProgress,automaticGuide:{enabled:true,callOverrides:{},calls:{}},store:{getState:()=>({settings:{autoControlEnabled:true,autoControlVisible:true},brainstorm:{userSnapshot:{creation:{projectId:"p"}}}})},guideEnabled:true,isChatOpen:false,voiceBusyRef:{current:false},chatHistoryRef:{current:[]},automaticGuideControllersRef:{current:controllers},automaticGuideInFlightRef:{current:inflight},heartbeatAbortRef:{current:null},heartbeatQuietUntilRef:{current:0},AUTO_CONTROL_PING_INTERVAL:2000,dispatch:a=>actions.push(a),automaticGuideCallStarted:x=>({started:x}),automaticGuideCallSucceeded:x=>({succeeded:x}),automaticGuideCallFailed:x=>({failed:x}),automaticGuideCallCancelled:x=>({cancelled:x}),fullAppVoiceAsk:async text=>{calls.push(text);return 'The scene is ready.';},guidePlayModeRef:{current:true},voiceActiveRef:{current:false},guidePlayModeSpeakTextRef:{current:text=>{speech.push(text);return new Promise(()=>{});}},setChatHistory(){},resumeAutoControlTask(){}};
 const js=ts.transpileModule('const fn='+callback,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 bindings.queueAutomaticAnnouncement=text=>speech.push(text);
 const run=new Function(...Object.keys(bindings),js+';return fn;')(...Object.values(bindings));
 const reply=await Promise.race([run({callId:'creation-progress',message:'Scene ready'}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Control waited for TTS')),250))]);
 assert.equal(reply,'The scene is ready.');assert.equal(inflight.size,0);assert.equal(controllers.size,0);assert.equal(actions.some(a=>a.failed),false);
 await run({callId:'creation-progress',message:'Next scene ready'});assert.equal(calls.length,2);assert.equal(speech.length,2);
 allowProgress=false;
 assert.equal(await run({callId:'creation-progress',message:'Duplicate progress while task owns execution'}),'');
 assert.equal(calls.length,2,'Active/completed task does not buy another progress call');
});
