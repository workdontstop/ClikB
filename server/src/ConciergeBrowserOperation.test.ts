import test from 'node:test';
import assert from 'node:assert/strict';
import { executeApprovedConciergeOperation } from './ConciergeBrowserOperation';
import { creationExecutionContext, creationValueRevision, compareCreationContext } from './creationControlIdentity';

const id = 'clikb.creation.reference_editor.action.update_editor';
const control = {actionId:id,controlId:id.replace('.action.','.control.'),ownerId:'owner-1',kind:'click',policy:'candidate',enabled:true,handlerRef:'open',activation:'click'};
const base = () => ({autoControl:{enabled:true,conciergeEnabled:true,videoEnabled:false},creation:{projectId:'p1',stage:'reference',controls:{stateVersion:1,
  areas:{reference:{areaId:'reference',state:{referenceId:'alice',promptRevision:'r1'},controls:[{...control}]}}}}});
const operation = {kind:'click' as const,actionId:id,controlId:control.controlId};
async function run(current: any, expected: any = creationExecutionContext(base(),id,'click')) {
  let sends=0; let carried: unknown;
  const result=await executeApprovedConciergeOperation({operation,stateVersion:1,feedsContext:'',latestRealUserText:'Update Alice',
    ...(expected === 'legacy' ? {} : {expectedCreationContext:expected}),observe:async()=>({status:'observed',snapshot:current}),cancelled:()=>false,
    dispatch:async(...args)=>{sends++;carried=args[8];return {status:'dispatched'};}});
  return {result,sends,carried};
}
test('approval survives unrelated area churn and carries exact context through browser dispatch',async()=>{
 const current=base();current.creation.controls.stateVersion=10;
 Object.assign(current.creation.controls.areas,{unrelated:{areaId:'other',state:{open:true},controls:[]}});
 const {result,sends,carried}=await run(current);assert.equal(result.status,'dispatched');assert.equal(sends,1);assert.deepEqual(carried,creationExecutionContext(base(),id,'click'));
});
test('changed owner, reference, scene/project, prompt, actual busy and activation reject before dispatch',async()=>{
 for(const change of [(s:any)=>s.creation.controls.areas.reference.controls[0].ownerId='replacement',
  (s:any)=>s.creation.controls.areas.reference.state.referenceId='bob',
  (s:any)=>s.creation.editStoryTargetKey='A:native-two', (s:any)=>s.creation.projectId='p2',
  (s:any)=>s.creation.controls.areas.reference.state.promptRevision='r2',
  (s:any)=>s.creation.controls.areas.reference.controls[0].enabled=false,
  (s:any)=>s.creation.controls.areas.reference.controls[0].activation='mousedown']) {
  const current=structuredClone(base());change(current);const {result,sends}=await run(current);assert.equal(sends,0);assert.equal(result.mutationSent,false);
 }
});
test('permission off and duplicate/missing target reject; malformed contracts never downgrade',async()=>{
 const off=base();off.autoControl.enabled=false;assert.equal((await run(off)).result.status,'permission_required');
 const duplicate=base();duplicate.creation.controls.areas.reference.controls.push({...control});assert.equal((await run(duplicate)).sends,0);
 for(const expected of [null,{},'garbage',{...creationExecutionContext(base(),id,'click'),schema:'v9'}]) assert.equal((await run(base(),expected)).sends,0);
});
test('strict legacy fallback remains and dispatched uncertainty is preserved',async()=>{
 assert.equal((await run(base(),'legacy')).sends,1);const changed=base();changed.creation.controls.stateVersion=2;assert.equal((await run(changed,'legacy')).sends,0);
 const current=base();current.creation.controls.areas.reference.controls[0].policy='requires_video';assert.equal((await run(current,creationExecutionContext(current,id,'click'))).result.status,'permission_required');
});
test('full-value revision notices same length suffix beyond old 160-character hint',()=>{
 assert.notEqual(creationValueRevision('a'.repeat(200)+'x'),creationValueRevision('a'.repeat(200)+'y'));
 assert.equal(compareCreationContext(creationExecutionContext(base(),id,'text'),creationExecutionContext(base(),id,'click'))?.reasonCode,'operation_mismatch');
});
test('an approved action cannot substitute a different control ID',async()=>{
 let sends=0;
 const result=await executeApprovedConciergeOperation({operation:{...operation,controlId:'wrong-control'},stateVersion:1,feedsContext:'',latestRealUserText:'Update Alice',
  expectedCreationContext:creationExecutionContext(base(),id,'click'),observe:async()=>({status:'observed',snapshot:base()}),cancelled:()=>false,
  dispatch:async()=>{sends++;return{status:'dispatched'};}});
 assert.equal(sends,0);assert.equal(result.reasonCode,'operation_mismatch');assert.equal(result.mutationSent,false);
});

test('Chat typing and final profile creation retain separate browser gates', async () => {
  const compose = 'clikb.navigation.social_chat.action.compose';
  const create = 'clikb.navigation.creative_profiles_profile.action.create_submit';
  const controlId = (value: string) => value.replace('.action.', '.control.');
  const current = {
    autoControl: { enabled: true, conciergeEnabled: true },
    navigation: { stateVersion: 5, availableActions: [
      { actionId: compose, controlId: controlId(compose), kind: 'text' },
      { actionId: create, controlId: controlId(create), requiresConfirmation: true, targetId: 'new_world_profile' },
    ] },
  };
  const calls: unknown[][] = [];
  const input = {
    stateVersion: 5, feedsContext: '', latestRealUserText: 'Create the profile new_world_profile',
    observe: async () => ({ status: 'observed', snapshot: current }), cancelled: () => false,
    dispatch: async (...args: unknown[]) => { calls.push(args); return { status: 'dispatched' }; },
  };
  assert.equal((await executeApprovedConciergeOperation({ ...input,
    operation: { kind: 'text', actionId: compose, controlId: controlId(compose), text: 'My reply' },
  })).status, 'dispatched');
  const operation = { kind: 'click' as const, actionId: create, controlId: controlId(create) };
  assert.equal((await executeApprovedConciergeOperation({ ...input, operation })).status, 'confirmation_required');
  assert.equal(calls.length, 1);
  assert.equal((await executeApprovedConciergeOperation({ ...input, operation, confirmedControlId: controlId(create) })).status, 'dispatched');
  assert.equal(calls[1][5], 'new_world_profile');
});
