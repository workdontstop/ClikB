const test=require('node:test'),assert=require('node:assert/strict');
const {effectiveCreationArea:compose}=require('./loadTs.cjs')('src/creationControlRegistry.ts');
const control={controlId:'id',actionId:'action',handlerRef:'handler',kind:'click',label:'Voice',policy:'information_only',enabled:true};
const entry=(source,open=false,c=control)=>({source,areaId:'area',state:{open},controls:[{...c,ownerId:source}]});
test('declared informational entries aggregate independent of collector order and lifecycle source',()=>{
 const a=entry('a'),b=entry('b',true),area='clikb.creation.notepad_entry';
 assert.deepEqual(compose(area,[a,b]),compose(area,[b,a]));
 assert.equal(compose(area,[a,b]).state.anyEditorOpen,true);
 assert.equal(compose(area,[a,b]).controls.length,1);
 assert.equal(compose(area,[a]).state.visibleEntryCount,1);
 assert.equal(compose(area,[]),undefined);
});
test('duplicate executable targets and competing authoritative owners fail closed',()=>{
 const a=entry('a',false,{...control,policy:'candidate'}),b=entry('b',false,{...control,policy:'candidate'});
 const result=compose('area',[a,b]);assert.equal(result.controls[0].enabled,false);assert.equal(result.state.registryConflicts,1);
 assert.deepEqual(result,compose('area',[b,a]));
});
test('actual owner and semantic state changes remain observable',()=>{
 const a=entry('a',false,{...control,policy:'candidate'});
 assert.notDeepEqual(compose('area',[a]),compose('area',[{...a,controls:[{...a.controls[0],ownerId:'replacement'}]}]));
 assert.notDeepEqual(compose('area',[a]),compose('area',[{...a,state:{open:true}}]));
});
test('different control IDs cannot alias the same executable action',()=>{
 const a=entry('a',false,{...control,policy:'candidate'});
 a.controls.push({...a.controls[0],controlId:'other'});
 assert.ok(compose('area',[a]).controls.every(item=>!item.enabled));
});

test('Precise stays observable without controls and bounds only its five current facts',()=>{
 const area='clikb.creation.workstation_precise';
 const precise={source:'Precise:1',areaId:area,state:{model:'Flare'.repeat(100),pixels:6,regions:3,references:2,status:'ready',prompt:'private',imageUrl:'private',regionNotes:'private'},controls:[]};
 const result=compose(area,[precise]);
 assert.deepEqual(result.controls,[]);
 assert.deepEqual(Object.keys(result.state),['model','pixels','regions','references','status']);
 assert.equal(result.state.model.length,60);
 assert.equal(result.state.pixels,6);assert.equal(result.state.regions,3);assert.equal(result.state.references,2);
 assert.ok(JSON.stringify(result).length<350,'manual popup state remains compact');
 assert.equal(compose(area,[]),undefined,'closing unregisters the state-only area');
 const accidental=compose(area,[{...precise,controls:[{...control,policy:'candidate'}],state:{pixels:Infinity,regions:1000000,references:-1,status:'x'.repeat(500)}}]);
 assert.deepEqual(accidental.controls,[],'an accidental binding can never expose a Precise action');
 assert.equal(accidental.state.pixels,null);assert.equal(accidental.state.regions,80);assert.equal(accidental.state.references,0);assert.equal(accidental.state.status.length,40);
});
test('repeated storybook_start copies from the same owner coalesce to one enabled action while conflicting owners or callbacks fail closed',()=>{
 const startControl={
  ownerId:'Storybook:owner',
  controlId:'clikb.creation.storybook_start.control.start',
  actionId:'clikb.creation.storybook_start.action.start',
  handlerRef:'ContinueGen',
  kind:'click',
  label:'Enter storyboard; estimated full-story image cost 78 pixels (Start itself does not deduct pixels)',
  policy:'candidate',
  enabled:true,
 };
 const sameOwnerArea={
  source:'Storybook:owner',
  areaId:'clikb.creation.storybook_start',
  state:{stage:'image_start',estimatedPixels:78},
  controls:[{...startControl},{...startControl}],
 };
 const composed=compose('clikb.creation.storybook_start',[sameOwnerArea]);
 assert.equal(composed.controls.length,1);
 assert.equal(composed.controls[0].enabled,true);
 assert.equal(composed.controls[0].ownerId,'Storybook:owner');
 assert.equal(composed.state.registryConflicts,undefined);

 const conflictingOwnerArea={
  ...sameOwnerArea,
  controls:[{...startControl,ownerId:'Storybook:owner-1'},{...startControl,ownerId:'Storybook:owner-2'}],
 };
 const conflictResult=compose('clikb.creation.storybook_start',[conflictingOwnerArea]);
 assert.equal(conflictResult.controls[0].enabled,false);
 assert.equal(conflictResult.state.registryConflicts,1);
 assert.match(conflictResult.controls[0].disabledReason,/target_ambiguous/);
});
