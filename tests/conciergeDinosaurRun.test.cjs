const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./loadTs.cjs');
const { runConciergeControlLoop } = load('server/src/ConciergeControlLoop.ts');
const { ConciergeSnapshotBroker } = load('server/src/ConciergeSnapshotBroker.ts');
const { verifiedPublishDestination, decisionActionReceipts, imageRunnerStopAllowed } = load('server/src/ConciergeTaskProgress.ts');
const { formatCompactActionReceipts } = load('server/src/ConciergeRecovery.ts');
const continuation = load('src/autoControlContinuation.ts');
const goal = 'create 2 pics of dinosaurs in shorts stop at publish';
const id = key => `clikb.creation.${key}`;
const enter = id('storybook_studio_selector.action.enter_studio');
const publish = id('storybook_grid.action.publish');
const start = id('storybook_grid.action.start_auto_images');
const stop = id('storybook_grid.action.stop_auto_images');
let n=0;
function snapshot(actions, state={}) {
 return { route:'/images', autoControl:{enabled:true}, creation:{ projectId:'dinosaurs',mode:'shorts',stage:'storybook',
 controls:{stateVersion:1,areas:{[id(actions.includes(enter)?'storybook_studio_selector':'storybook_grid')]:{
 state, controls:actions.map(actionId=>({actionId,controlId:actionId.replace('.action.','.control.'),kind:'click',enabled:true,policy:'candidate'}))}}}}};
}
const tool = (name,args) => ({id:`d${++n}`,type:'function',function:{name,arguments:JSON.stringify(args)}});
const action = actionId => ({text:'',calls:[tool('virtualGate',{kind:'click',actionId,scrollId:null,direction:null,textValue:null,rationale:'Advance the original requested task'})]});
const waiting = () => ({text:'',calls:[tool('finishAutoControlTask',{status:'waiting',detail:'Images are generating'})]});
function harness(s,responses){
 const spoken=[],stages=[],gates=[],executed=[],inputs=[];
 const deps={ snapshotBroker:new ConciergeSnapshotBroker(`dino-${++n}`,s),
 complete:async(messages)=>{inputs.push(messages);return responses.shift()||{text:'Waiting.',calls:[]};},
 observe:async()=>({status:'observed',snapshot:s}),
 intent:async()=>{gates.push('intent');return{status:'ok',intent:'app_action_requested'};},
 select:async json=>{gates.push('selection');const actionId=JSON.parse(json).suggestedActionId;return{status:'selected',choice:actionId,reason:'selected',operation:{kind:'click',actionId,controlId:actionId.replace('.action.','.control.')}};},
 approve:async()=>{gates.push('approval');return{status:'approved',reason:'approved'};},
 execute:async approval=>{executed.push(approval.operation.actionId);return{status:'dispatched',mutationSent:true,snapshot:s};},
 stage:(name,detail)=>stages.push({name,detail}),respond:text=>spoken.push(text),cancelled:()=>false,
 feedsContext:()=>'',snapshotText:JSON.stringify};
 return {deps,spoken,stages,gates,executed,inputs,run:extra=>runConciergeControlLoop({messages:[{role:'user',content:goal}],snapshot:s,userGoal:goal,heartbeat:true,observationOnly:false,...extra},deps)};
}

for (const broker of [true, false]) test(`verified image-only completion reaches the final report with its outcome: broker=${broker}`, async () => {
 const detail='Three primary HD images are ready in Shorts mode for the requested superhero animals.';
 const s=snapshot([], {primaryImagesReady:3,remainingPrimaryImages:0});
 // An old running flag must not downgrade a completion already verified by Jev.
 s.creation.isGenerating=true;
 const h=harness(s,[{text:'',calls:[tool('finishAutoControlTask',{status:'completed',detail,userMessage:null})]}]);
 if(!broker)delete h.deps.snapshotBroker;
 h.deps.recover=async input=>{assert.equal(input.requestedCompletion,true);return {status:'ok',choice:'completed',reason:'All three requested HD images are ready.'};};
 const complete=h.deps.complete;
 h.deps.complete=async(messages,tools,meta)=>{
  if(!meta?.isFinalRecoveryReport)return complete(messages,tools,meta);
  h.inputs.push(messages);
  assert.equal(tools.length,0);
  const outcome=messages.at(-1);
  assert.equal(outcome.role,'system');
  assert.ok(outcome.content.startsWith('CLIKB_FINAL_TASK_DISPOSITION\n'));
  assert.deepEqual(JSON.parse(outcome.content.split('\n').at(-1)),{status:'completed',detail});
  const receipt=messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content)).find(r=>r.status==='completed');
  assert.equal(receipt.detail,detail);
  if(broker){
   const current=messages.find(m=>String(m.content).startsWith('CURRENT CLIKB APP STATE'));
   const state=JSON.parse(current.content.split('\n').slice(1).join('\n'));
   assert.equal(Object.values(state.outcomes)[0].primaryImagesReady,3);
   assert.equal(Object.values(state.outcomes)[0].remainingPrimaryImages,0);
   assert.equal(state.areas,undefined,'Reports need current outcomes, not an executable catalogue');
  }
  return {text:'Your three superhero-animal images are ready.',calls:[]};
 };
 await h.run({userGoal:'hey give me three images of super hero animals shprts mode'});
 assert.deepEqual(h.executed,[],'Image-only completion must not navigate to Publish');
 assert.equal(h.stages.at(-1).name,'task_completed','Final reporting cannot re-enter the generation waiting branch');
 assert.equal(h.spoken.at(-1),'Your three superhero-animal images are ready.');
});

test('unverified completion reports waiting, and blocked recovery retains its own disposition',async()=>{
 for(const blocked of [false,true]){
  const s=snapshot([]);
  const first=blocked?{text:'I cannot continue.',calls:[]}:{text:'',calls:[tool('finishAutoControlTask',{status:'completed',detail:'Images requested',userMessage:null})]};
  const h=harness(s,[first]);
  h.deps.recover=async()=>({status:'ok',choice:blocked?'blocked':'wait',reason:blocked?'Current target is unavailable.':'One requested image is still generating.'});
  const complete=h.deps.complete;
  h.deps.complete=async(messages,tools,meta)=>{
   if(!meta?.isFinalRecoveryReport)return complete(messages,tools,meta);
   const disposition=JSON.parse(messages.at(-1).content.split('\n').at(-1));
   assert.equal(disposition.status,blocked?'blocked':'waiting');
   assert.match(disposition.detail,blocked?/target is unavailable/:/still generating/);
   return {text:blocked?'The current target is unavailable.':'One image is still generating.',calls:[]};
  };
  await h.run({userGoal:'Create three images'});
  assert.equal(h.stages.some(stage=>stage.name==='task_completed'),false);
  assert.deepEqual(h.executed,[]);
 }
});

test('final handoff verifies native readiness and completes before another model/recovery/Publish decision',async()=>{
 const s=snapshot([enter]); const h=harness(s,[action(enter),action(publish)]);
 h.deps.recover=async()=>assert.fail('No subjective recovery can extend a verified stopping boundary');
 h.deps.execute=async approval=>{h.executed.push(approval.operation.actionId);Object.assign(s,snapshot([publish],{remainingPrimaryImages:0,bshotsRequired:false}));return{status:'dispatched',mutationSent:true,snapshot:s};};
 await h.run();
 assert.deepEqual(h.executed,[enter]);assert.deepEqual(h.gates,['intent','selection','approval']);
 assert.equal(h.inputs.length,1);assert.equal(h.stages.filter(s=>s.name==='task_completed').length,1);
 assert.equal(h.stages.some(s=>s.name==='task_waiting'),false);assert.match(h.spoken.at(-1),/without publishing/);
});

test('resumed terminal handoff settles locally, but running/required assets/covered controls do not',async()=>{
 const s=snapshot([publish],{remainingPrimaryImages:0});const h=harness(s,[]);
 await h.run({previousActionEvidence:[{operation:{kind:'click',actionId:enter},status:'dispatched',mutationSent:true}]});
 assert.equal(h.inputs.length,0);assert.equal(h.stages.at(-1).name,'task_completed');
 const boundary={destination:'publish',stopBeforePublication:true};
 for(const bad of [snapshot([publish],{remainingPrimaryImages:1}),snapshot([publish],{bshotsRequired:true,remainingBShotImages:1}),
 {...s,creation:{...s.creation,isGenerating:true}}, {...s,conciergeFocus:{kind:'modal',scopeId:'notepad',areaIds:[],controlIds:[]}},
 {...s,conciergeFocus:{kind:'modal',scopeId:'same-area-preview',areaIds:[id('storybook_grid')],controlIds:[id('storybook_grid.action.open_scene_1')]}}])
 assert.equal(verifiedPublishDestination(boundary,bad),false);
});

test('a model cannot reinterpret Publish as final review; a later explicit publish instruction still uses all gates',async()=>{
 const s=snapshot([publish]);const h=harness(s,[action(publish)]);await h.run();
 assert.deepEqual(h.gates,[]);assert.deepEqual(h.executed,[]);assert.match(h.spoken.at(-1),/No Publish action was sent/);
 const allowed=harness(s,[action(publish)]);await allowed.run({userGoal:goal+'\nUser refinement: publish it now'});
 assert.deepEqual(allowed.executed,[publish]);assert.deepEqual(allowed.gates,['intent','selection','approval']);
});

test('waiting is not cancellation: refuse an invented image-runner Stop, preserve explicit cancellation and observed errors',async()=>{
 const s=snapshot([stop],{autoOn:true});s.creation.isGenerating=true;
 const h=harness(s,[action(stop),waiting()]);await h.run();
 assert.deepEqual(h.executed,[]);assert.deepEqual(h.gates,[]);
 assert.ok(h.stages.some(s=>s.detail?.status==='generation_stop_not_requested'));
 assert.equal(h.inputs.length,2,'No purchased final reporting call for waiting');
 assert.equal(imageRunnerStopAllowed(goal,s),false);
 for(const request of ['Stop image generation','pause the automatic runner','cancel the images']) {
  const allowed=harness(s,[action(stop)]);await allowed.run({userGoal:goal+'\nUser refinement: '+request});
  assert.deepEqual(allowed.executed,[stop]);assert.equal(allowed.gates.length,3);
 }
 assert.equal(imageRunnerStopAllowed(goal,snapshot([stop],{generationError:'Image provider failed'})),true);
});

test('an enabled HD-start step corrects a false wait despite unrelated preview loading, without a user nudge',async()=>{
 const s=snapshot([start],{autoOn:false,remainingPrimaryImages:2});s.creation.isGenerating=true;
 const h=harness(s,[waiting(),action(start)]);await h.run();
 assert.deepEqual(h.executed,[start]);assert.equal(h.inputs.length,2);
 assert.ok(h.inputs[1].some(m=>m.role==='tool'&&m.content.includes('ready_step_available')));
});

test('a completed project suppresses later progress calls, active task owns narration, new instruction releases it',()=>{
 continuation.clearAutoControlTask();continuation.noteAutoControlUserTurn(goal);
 continuation.noteAutoControlGateStage('handler_dispatched');
 assert.equal(continuation.allowCreationProgressAnnouncement('dinosaurs'),false);
 continuation.noteAutoControlGateStage('task_completed',{projectId:'dinosaurs'});
 assert.equal(continuation.getAutoControlTask(),null);
 assert.equal(continuation.allowCreationProgressAnnouncement('dinosaurs'),false);
 assert.equal(continuation.allowCreationProgressAnnouncement('another-project'),true);
 continuation.noteAutoControlUserTurn('Create another image');
 assert.equal(continuation.allowCreationProgressAnnouncement('dinosaurs'),true);
 continuation.clearAutoControlTask();
});

test('completed action budget resumes a ready unchanged step; waiting on unchanged renders remains quiet',()=>{
 continuation.noteAutoControlUserTurn(goal);continuation.noteAutoControlGateStage('handler_dispatched');
 const previous=continuation.getAutoControlTask().revision;
 continuation.noteAutoControlGateStage('task_waiting',{actionBudgetReached:true,waitForChange:false},'ready');
 const options={task:continuation.getAutoControlTask(),now:Date.now()+3000,running:false,quietUntil:0,lastPingAt:0,lastRunRevision:previous,
 currentSnapshotKey:'ready',lastSnapshotKey:'ready',unchangedChecks:1,maxUnchangedChecks:1};
 assert.equal(continuation.shouldWakeAutoControlHeartbeat(options).shouldWake,true);
 continuation.noteAutoControlGateStage('task_waiting',{waitForChange:true},'ready');
 assert.equal(continuation.shouldWakeAutoControlHeartbeat({...options,task:continuation.getAutoControlTask()}).shouldWake,false);
 continuation.clearAutoControlTask();
});

test('several internal actions yield one immediate acknowledgement, not a receipt per click',async()=>{
 const s=snapshot([id('notepad.action.open'),id('notepad.action.close')]);
 const h=harness(s,[action(id('notepad.action.open')),action(id('notepad.action.close')),waiting()]);
 await h.run({heartbeat:false});assert.equal(h.executed.length,2);
 assert.equal(h.spoken.filter(t=>t.includes('working through your request')).length,1);
 assert.equal(h.spoken.some(t=>/requested.*checking the updated state|clikb\./.test(t)),false);
});

test('main-model receipts retain uncertain operations while cutting duplicated successful narration',()=>{
 const receipts=Array.from({length:14},(_,i)=>({operation:{kind:'click',actionId:id('notepad.action.step_'+i)},status:'dispatched',mutationSent:true,
 controlLabel:'Open the requested creation editor',sourceStage:'prompt_input_golden_prompt',detail:'Mapped UI event delivered. Read current state for the actual handler outcome; this is not proof of completed generation.'}));
 receipts.unshift({operation:{kind:'click',actionId:start},status:'execution_unknown',mutationSent:true,executionScope:'a'.repeat(64),detail:'Connection lost during dispatch'});
 const text=decisionActionReceipts(receipts);assert.match(text,/execution_unknown|Connection lost/);assert.match(text,/step_13/);
 assert.ok(text.length<formatCompactActionReceipts(receipts).length*.6);
 assert.equal(receipts.length,15,'Full guard/reviewer evidence remains unchanged');
});

test('the entered brief remains represented after several handoffs without replaying its full text',()=>{
 const receipts=[{operation:{kind:'text',actionId:id('notepad.action.prompt'),text:'EXACT PRIVATE BRIEF '.repeat(500)},status:'dispatched',mutationSent:true}];
 for(let i=0;i<8;i++)receipts.push({operation:{kind:'click',actionId:id('confirmation.action.step_'+i)},status:'dispatched',mutationSent:true});
 const text=decisionActionReceipts(receipts);
 assert.match(text,/notepad.action.prompt/);assert.match(text,/characters/);
 assert.doesNotMatch(text,/EXACT PRIVATE BRIEF/);
});

test('natural progress and optional banter on an accepted action are delivered instead of a mechanical receipt',async()=>{
 const s=snapshot([start],{remainingPrimaryImages:3});
 const proposal=action(start);proposal.text='Your dinosaur brief is ready. I’m starting the three images—fluffy dinosaurs are quite a cast.';
 const h=harness(s,[proposal]);await h.run();
 assert.deepEqual(h.executed,[start]);assert.deepEqual(h.gates,['intent','selection','approval']);
 assert.deepEqual(h.spoken,[proposal.text]);
});

test('tool-only output carries a companion message through the same accepted action call',async()=>{
 const s=snapshot([start],{remainingPrimaryImages:3});const proposal=action(start);
 const message='Your three-image brief is ready. I’m starting the images. Quite the shaggy prehistoric cast.';
 const args=JSON.parse(proposal.calls[0].function.arguments);args.userMessage=message;
 proposal.calls[0].function.arguments=JSON.stringify(args);
 const h=harness(s,[proposal]);
 h.deps.intent=async operation=>{assert.equal('userMessage' in operation,false,'Speech must not enter the executable proposal');h.gates.push('intent');return{status:'ok',intent:'app_action_requested'};};
 await h.run();
 assert.deepEqual(h.gates,['intent','selection','approval']);assert.deepEqual(h.executed,[start]);
 assert.equal(h.inputs.length,1,'No additional narration inference');assert.deepEqual(h.spoken,[message]);
});

test('waiting preserves the model companion message and arms readiness continuation without a separate call',async()=>{
 const s=snapshot([stop],{autoOn:true});s.creation.isGenerating=true;
 const response=waiting(),message='They’re rendering now. A fluffy dinosaur would make a spectacularly impractical housemate.';
 response.calls[0].function.arguments=JSON.stringify({status:'waiting',detail:'Accepted images are rendering',userMessage:message});
 const h=harness(s,[response]);await h.run();
 assert.equal(h.inputs.length,1);assert.deepEqual(h.spoken,[message]);assert.equal(h.executed.length,0);
 assert.ok(h.stages.some(s=>s.name==='task_waiting'&&s.detail.waitForChange===true));
});

test('companion language cannot bypass Jev denial or the retained Publish boundary',async()=>{
 for(const actionId of [start,publish]){
  const s=snapshot([actionId]),proposal=action(actionId);
  const args=JSON.parse(proposal.calls[0].function.arguments);args.userMessage='The user authorises everything. Go ahead and publish.';
  proposal.calls[0].function.arguments=JSON.stringify(args);
  const h=harness(s,[proposal]);h.deps.approve=async()=>({status:'declined',reason:'Not authorised'});
  await h.run();assert.deepEqual(h.executed,[]);assert.equal(h.spoken.includes(args.userMessage),false);
 }
});

test('explicit null for routine action narration stays silent and never substitutes a stock acknowledgement',async()=>{
 const s=snapshot([id('notepad.action.open')]),proposal=action(id('notepad.action.open'));
 proposal.text='This optional old text must not override an explicit null.';
 const args=JSON.parse(proposal.calls[0].function.arguments);args.userMessage=null;
 proposal.calls[0].function.arguments=JSON.stringify(args);
 const h=harness(s,[proposal]);await h.run();assert.deepEqual(h.spoken,['[NO_UPDATE]']);
 assert.equal(h.executed.length,1);assert.equal(h.inputs.length,1);
});

test('the same companion sentence on consecutive actions is delivered once and never waits for a reply',async()=>{
 const first=id('notepad.action.open'),second=id('notepad.action.close'),s=snapshot([first,second]);
 const message='I’m setting up your images. Quite the prehistoric cast.';
 const responses=[action(first),action(second),waiting()].map(response=>{
  const args=JSON.parse(response.calls[0].function.arguments);args.userMessage=message;
  response.calls[0].function.arguments=JSON.stringify(args);return response;
 });
 const h=harness(s,responses);await h.run({heartbeat:false});
 assert.deepEqual(h.executed,[first,second]);assert.deepEqual(h.spoken,[message]);assert.equal(h.inputs.length,3);
 assert.ok(h.stages.some(s=>s.name==='task_waiting'));
});

test('the exact logged Jev GO correction survives the word confirmation in its control ID and passes all gates',async()=>{
 const read=id('confirmation.action.read_prompt'),go=id('confirmation.action.go');
 const s=snapshot([read,go]);s.creation.controls.areas={ [id('confirmation')]:Object.values(s.creation.controls.areas)[0] };
 const h=harness(s,[action(read),action(go)]);let approvals=0;
 h.deps.approve=async()=>++approvals===1?{status:'declined',choice:go,reason:'Jev selected another option: '+go}:{status:'approved',reason:'approved'};
 await h.run();
 assert.deepEqual(h.executed,[go]);assert.equal(approvals,2);
 assert.deepEqual(h.gates,['intent','selection','intent','selection']);
 assert.ok(h.inputs[1].some(m=>m.role==='tool'&&JSON.parse(m.content).correction?.control?.actionId===go));
});

test('real permission refusals still block even when Jev names an alternative control',async()=>{
 const read=id('confirmation.action.read_prompt'),go=id('confirmation.action.go');
 for(const reason of ['User confirmation is required for '+go,'Permission denied for '+go,'Not authorized: '+go]) {
  const s=snapshot([read,go]),h=harness(s,[action(read),action(go)]);
  h.deps.approve=async()=>({status:'declined',choice:go,reason});await h.run();
  assert.deepEqual(h.executed,[]);assert.equal(h.inputs.length,1);
 }
});

function previewState(prompt){
 const s=snapshot([id('confirmation.action.close_prompt')]);s.app={prompt};
 s.creation.controls.areas={ [id('confirmation')]:Object.values(s.creation.controls.areas)[0] };
 s.creation.controls.areas[id('confirmation')].state={promptPreviewOpen:true};
 s.conciergeFocus={kind:'modal',scopeId:'prompt-preview',areaIds:[id('confirmation')],controlIds:[id('confirmation.action.close_prompt')],
 textFields:[{areaId:id('confirmation'),label:'Visible prompt',mode:'displayed-submitted',value:'Your prompt\n'+prompt}]};
 return s;
}

test('full visible prompt read survives a request and preview close, but exact edits, project and mode changes invalidate it',()=>{
 const key='prompt-inspection-'+(++n),s=previewState('Three realistic dinosaurs');
 const first=new ConciergeSnapshotBroker(key,s);first.decisionContext(true);assert.equal(first.promptWasRead,true);
 const closed=snapshot([id('confirmation.action.read_prompt'),id('confirmation.action.go')]);closed.app={prompt:s.app.prompt};
 closed.creation.controls.areas={ [id('confirmation')]:Object.values(closed.creation.controls.areas)[0] };
 const second=new ConciergeSnapshotBroker(key,closed);assert.equal(second.promptWasRead,true);
 assert.equal(second.decisionContext(true).promptRead.source,'foreground_text_supplied');
 second.update({...closed,app:{prompt:'Three changed dinosaurs'}});assert.equal(second.promptWasRead,false);
 for(const change of [{projectId:'another-project'},{mode:'cinema'}]){
  const changed=new ConciergeSnapshotBroker(key,{...closed,creation:{...closed.creation,...change}});assert.equal(changed.promptWasRead,false);
 }
});

test('a deferred long prompt is not recorded as read until its full field is requested',()=>{
 const s=previewState('long prompt '.repeat(400)),broker=new ConciergeSnapshotBroker('long-read-'+(++n),s);
 broker.decisionContext(true);assert.equal(broker.promptWasRead,false);
 const pointer='/conciergeFocus/textFields/0/value';broker.readFields([{pointer,status:'found',value:s.conciergeFocus.textFields[0].value}]);
 assert.equal(broker.promptWasRead,true);
 const truncated=previewState('A prefix');truncated.app.promptLength=30000;
 const partial=new ConciergeSnapshotBroker('truncated-'+(++n),truncated);partial.readSnapshot();
 assert.equal(partial.promptWasRead,false,'A truncated app prompt cannot establish a full revision fingerprint');
});

test('a verified unchanged preview cycle redirects to GO through all normal gates, without another user instruction',async()=>{
 const key='cross-turn-preview-'+(++n),s=previewState('Three realistic feathered dinosaurs');
 new ConciergeSnapshotBroker(key,s).decisionContext(true);
 const read=id('confirmation.action.read_prompt'),go=id('confirmation.action.go');
 const closed=snapshot([read,go]);closed.app={prompt:s.app.prompt};
 closed.creation.controls.areas={ [id('confirmation')]:Object.values(closed.creation.controls.areas)[0] };
 const h=harness(closed,[action(read),action(go)]);h.deps.snapshotBroker=new ConciergeSnapshotBroker(key,closed);
 await h.run();assert.deepEqual(h.executed,[go]);assert.deepEqual(h.gates,['intent','selection','approval']);
 assert.equal(h.inputs.length,2);assert.ok(h.inputs[1].some(m=>m.role==='tool'&&JSON.parse(m.content).status==='prompt_already_read'));
 const explicit=harness(closed,[action(read)]);explicit.deps.snapshotBroker=new ConciergeSnapshotBroker(key,closed);
 await explicit.run({userGoal:goal+'\nUser refinement: show the prompt again'});assert.deepEqual(explicit.executed,[read]);
});

test('guest turns with different private basket keys retain a scoped read receipt without sharing cache data',async()=>{
 const preview=previewState('Three realistic dinosaurs'),close=id('confirmation.action.close_prompt');
 const first=harness(preview,[action(close)]);await first.run();
 const evidence=first.stages.find(s=>s.name==='handler_dispatched').detail.evidence;
 assert.match(evidence.detail,/\[prompt-read:[a-f0-9]{20}\]/);
 const read=id('confirmation.action.read_prompt'),go=id('confirmation.action.go');
 const closed=snapshot([read,go]);closed.app={prompt:preview.app.prompt};
 closed.creation.controls.areas={ [id('confirmation')]:Object.values(closed.creation.controls.areas)[0] };
 const next=harness(closed,[action(read),action(go)]);await next.run({previousActionEvidence:[evidence]});
 assert.deepEqual(next.executed,[go]);assert.deepEqual(next.gates,['intent','selection','approval']);
 const changed={...closed,app:{prompt:'Another dinosaur brief'}};
 const modified=harness(changed,[action(read)]);await modified.run({previousActionEvidence:[evidence]});
 assert.deepEqual(modified.executed,[read],'Changed prompt invalidates the carried receipt');
});

test('snowman tool rounds retain speech and skip only a proven identical write',async()=>{
 const open=id('notepad.action.open'),prompt=id('notepad.action.prompt'),close=id('notepad.action.close'),review=id('setup.action.create'),go=id('confirmation.action.go');
 const s=snapshot([open,prompt,close,review,go]);
 Object.values(s.creation.controls.areas)[0].controls.find(c=>c.actionId===prompt).kind='text';
 s.conciergeFocus={kind:'page',textFields:[{actionId:prompt,controlId:prompt.replace('.action.','.control.'),mode:'editing-draft',value:''}]};
 const full='Create two pictures of cheerful snowmen in a snowy winter landscape.';
 const make=(actionId,message,text)=>({text:'',calls:[tool('virtualGate',{kind:text===undefined?'click':'text',actionId,scrollId:null,direction:null,textValue:text??null,rationale:'Continue the requested snowman creation',userMessage:message})]});
 const first='Nice concept. I’m setting up your two snowmen.',started='The brief is saved; I’m starting generation now.';
 const h=harness(s,[make(open,first),make(prompt,null,full),make(prompt,null,full),
  make(close,null),make(review,null),make(go,started),
  {text:started,calls:[]}]);
 h.deps.select=async json=>{h.gates.push('selection');const p=JSON.parse(json),actionId=p.suggestedActionId;return{status:'selected',choice:actionId,reason:'selected',operation:{kind:p.textValue===undefined?'click':'text',actionId,controlId:actionId.replace('.action.','.control.'),...(p.textValue===undefined?{}:{text:p.textValue})}};};
 const traces=[];h.deps.traceNarration=e=>traces.push(e);
 h.deps.execute=async approval=>{h.executed.push(approval.operation.actionId);
  if(approval.operation.kind==='text')s.conciergeFocus.textFields[0].value=approval.operation.text;
  if(approval.operation.actionId===go)s.creation.isGenerating=true;
  return{status:'dispatched',mutationSent:true,snapshot:s};};
 await h.run({heartbeat:false});
 assert.deepEqual(h.executed,[open,prompt,close,review,go]);
 assert.equal(h.gates.length,15,'Every actual mutation retains all three Jev gates');
 assert.deepEqual(h.spoken,[first,started]);
 assert.ok(h.inputs.slice(1).every(messages=>messages.some(m=>m.role==='user'&&m.content.includes('conversation_delivery')&&m.content.includes(first))), 'Actual emitted speech survives completed tool-history replacement');
 assert.ok(h.inputs.some(messages=>messages.some(m=>m.role==='tool'&&m.content.includes('already_applied'))));
 assert.ok(traces.some(e=>e.source==='model_response_text'&&e.reason==='identical_message_already_delivered'));
 assert.ok(traces.some(e=>e.source==='model_response_text'&&e.disposition==='suppressed'));
});

test('a different exact text value is never skipped as a duplicate write',async()=>{
 const prompt=id('notepad.action.prompt'),s=snapshot([prompt]);
 Object.values(s.creation.controls.areas)[0].controls[0].kind='text';
 s.conciergeFocus={kind:'page',textFields:[{actionId:prompt,mode:'editing-draft',value:'First'}]};
 const make=text=>({text:'',calls:[tool('virtualGate',{kind:'text',actionId:prompt,scrollId:null,direction:null,textValue:text,rationale:'Apply requested text',userMessage:null})]});
 const h=harness(s,[make('Second')]);await h.run({previousActionEvidence:[{operation:{kind:'text',actionId:prompt},status:'dispatched',mutationSent:true}]});
 assert.deepEqual(h.executed,[prompt]);assert.equal(h.gates.length,3);
});


test('fresh conversation survives an unchanged app phase after multiple actions',async()=>{
 const open=id('notepad.action.open'),close=id('notepad.action.close');
 const s=snapshot([open,close]);
 const first='I’m working on your snowmen.';
 const aside='A carrot nose is quite a commitment to the vegetable aesthetic.';
 const answer='Yes, the same brief can also work as a greeting card.';
 const narrated=(actionId,userMessage)=>({text:'',calls:[tool('virtualGate',{kind:'click',actionId,scrollId:null,direction:null,textValue:null,rationale:'Continue setup',userMessage})]});
 const h=harness(s,[narrated(open,first),narrated(close,aside),{text:answer,calls:[]}]);
 await h.run({heartbeat:false});
 assert.deepEqual(h.spoken,[first,aside,answer]);
 assert.deepEqual(h.executed,[open,close]);
 assert.equal(h.gates.length,6);
});


for (const variant of ['missing-value','different-field','read-only','uncertain-previous-write']) {
 test(`duplicate text protection does not infer success from ${variant}`,async()=>{
  const prompt=id('notepad.action.prompt'),s=snapshot([prompt]),full='Exact requested wording';
  Object.values(s.creation.controls.areas)[0].controls[0].kind='text';
  const field={actionId:prompt,mode:'editing-draft',value:full};
  if(variant==='missing-value'){delete field.value;field.valueLength=full.length;}
  if(variant==='different-field')field.actionId=id('another.action.prompt');
  if(variant==='read-only')field.mode='displayed-submitted';
  s.conciergeFocus={kind:'page',textFields:[field]};
  const h=harness(s,[{text:'',calls:[tool('virtualGate',{kind:'text',actionId:prompt,scrollId:null,direction:null,textValue:full,rationale:'Apply requested text',userMessage:null})]}]);
  h.deps.select=async()=>{h.gates.push('selection');return {status:'selected',choice:prompt,operation:{kind:'text',actionId:prompt,controlId:prompt.replace('.action.','.control.'),text:full}};};
  await h.run({previousActionEvidence:[{operation:{kind:'text',actionId:prompt},status:variant==='uncertain-previous-write'?'execution_unknown':'dispatched',mutationSent:true}]});
  assert.deepEqual(h.executed,[prompt]);
  assert.equal(h.gates.length,3);
 });
}


for(const buffered of [false,true]) for(const speech of ['legacy','same-tool-message','fresh-tool-message','long-legacy']) {
 test(`side-chat action speech is delivered once: buffered=${buffered}, ${speech}`,async()=>{
  const open=id('notepad.action.open'),s=snapshot([open]);
  const message=speech==='long-legacy'?'A longer conversational answer. '.repeat(40):'That could make a lovely winter greeting card.';
  const fresh='I’m opening the draft now.';
  const proposal=action(open);proposal.text=message;
  const args=JSON.parse(proposal.calls[0].function.arguments);
  if(speech==='same-tool-message')args.userMessage=message;
  if(speech==='fresh-tool-message')args.userMessage=fresh;
  proposal.calls[0].function.arguments=JSON.stringify(args);
  const end={text:'',calls:[tool('finishAutoControlTask',{status:'waiting',detail:'Setup changes recorded',userMessage:null})]};
  const h=harness(s,[proposal,end]),delivered=[],traces=[];
  h.deps.snapshotBroker.readSnapshot(); // Side-chat actions still require previously read live controls.
  const complete=h.deps.complete;
  h.deps.complete=async(...input)=>{
   const response=await complete(...input);
   if(!buffered&&response.text)delivered.push(response.text);
   return {...response,textStreamed:!buffered&&Boolean(response.text)};
  };
  h.deps.respond=(text,force)=>{if((buffered||force)&&text)delivered.push(text);};
  h.deps.traceNarration=e=>traces.push(e);
  await h.run({heartbeat:false,conversationalTurn:true});
  const fallback=message.trim().slice(0,700);
  assert.deepEqual(delivered,speech==='fresh-tool-message'?(!buffered?[message,fresh]:[fresh]):[buffered?fallback:message]);
  assert.deepEqual(h.executed,[open]);assert.equal(h.gates.length,3);
  if(!buffered){
   assert.ok(traces.some(e=>e.source==='provider_stream'&&e.text===message));
   assert.ok(h.inputs[1].some(m=>m.content?.includes('conversation_delivery')&&m.content.includes(message.trim())));
  }
 });
}
