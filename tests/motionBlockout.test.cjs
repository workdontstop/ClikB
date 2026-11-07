const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Module=require('node:module');
function load(file,mocks={},cache=new Map()){const filename=path.resolve(__dirname,'..',file);if(cache.has(filename))return cache.get(filename).exports;const mod=new Module(filename,module);cache.set(filename,mod);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod.require=name=>Object.hasOwn(mocks,name)?mocks[name]:name.startsWith('.')?load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(filename),name+'.ts')),mocks,cache):Module.prototype.require.call(mod,name);mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);return mod.exports;}
const model=load('server/src/motionGuidePlan.ts'),world=load('server/src/spatialWorld.ts'),{createMotionScene}=load('src/motionScene.ts'),THREE=require('three');
const keys=(position,scale=[1,1,1])=>[0,5].map(t=>({t,position:[...position],scale:[...scale],rotation:[0,0,0]}));
const object=(id,position,scale)=>({id,shape:'box',color:'#ff00cc',keys:keys(position,scale)});
function fixture(){return model.validateMotionPlan({version:1,duration:5,background:'#ff0000',objects:[{...object('person',[-1,0,0]),parts:[{id:'upper',shape:'box',color:'#ff0000',keys:[{t:0,span:{start:[0,1.5,0],end:[.4,1,0],width:.2,depth:.2}},{t:5,span:{start:[0,1.5,0],end:[-.3,1.2,.3],width:.2,depth:.2}}]},{id:'lower',shape:'box',color:'#00ff00',keys:[{t:0,span:{start:[.4,1,0],end:[.3,.7,.1],width:.16,depth:.16}},{t:5,span:{start:[-.3,1.2,.3],end:[-.6,1.5,.3],width:.16,depth:.16}}]}]},object('dragon',[2,1,-5],[3,2,4]),{...object('floor',[0,-.1,-3],[20,.2,30]),surface:'ground'}],camera:keys([0,2,7]).map(({t,position})=>({t,position,target:[0,1,-2],fov:48}))});}
test('box joints stay connected at every interpolated frame; persisted state retains endpoints',()=>{
 const plan=fixture(),view=createMotionScene(plan,9/16);
 for(let t=0;t<=5;t+=.05){view.draw(t);const a=model.interpolateBoxSpan(...model.motionSegment(plan.objects[0].parts[0].keys,t)),b=model.interpolateBoxSpan(...model.motionSegment(plan.objects[0].parts[1].keys,t));assert.deepEqual(a.span.end,b.span.start);const center=new THREE.Vector3().applyMatrix4(view.parts.get('person').get('upper').matrixWorld);assert.ok(center.distanceTo(new THREE.Vector3(...a.position).add(new THREE.Vector3(-1,0,0)))<1e-8);}
 const saved=world.newWorldState(plan),end=world.stateAtEnd(plan,saved);const restored=world.planAtState({plan},JSON.parse(JSON.stringify(end)));assert.deepEqual(restored.objects[0].parts[0].keys[0].span,plan.objects[0].parts[0].keys[1].span);view.dispose();
});
test('stable subject materials replace random part colors without mutating plans, and grid lies on physical ground',()=>{
 const plan=fixture(),before=JSON.stringify(plan),view=createMotionScene(plan,1);const colors=new Set();view.scene.traverse(node=>{if(node.isMesh)colors.add(node.material.color.getHexString());});assert.deepEqual([...colors],[load('src/motionScene.ts').subjectColor('person').slice(1).toLowerCase(),'c4cad6','8795af']);assert.equal(JSON.stringify(plan),before);let floor;view.scene.traverse(node=>{if(node.isMesh && node.name==='floor')floor=node;});assert.ok(floor.material.userData.physicalGrid);view.dispose();
});
test('camera fitting reduces composition error without moving geometry, attachments or ground',()=>{
 const {projectedSceneBoxes,fitSourceCamera}=load('server/src/spatialSceneCalibration.ts'),plan=fixture();const layout={camera:'test',landmarks:Object.entries(projectedSceneBoxes(plan,'9:16')).filter(([id])=>id!=='floor').map(([id,box])=>({id,box,description:id,occluded:false}))};const wrong=structuredClone(plan);wrong.camera.forEach(k=>{k.position[0]+=1.5;k.target[0]+=1.5;k.fov=62;});const error=p=>{const boxes=projectedSceneBoxes(p,'9:16');return layout.landmarks.reduce((sum,item)=>sum+item.box.reduce((n,v,i)=>n+(v-boxes[item.id][i])**2,0),0);};const fitted=fitSourceCamera(wrong,layout,'9:16');assert.ok(error(fitted)<error(wrong)*.5,`${error(wrong)} -> ${error(fitted)}`);assert.deepEqual(fitted.objects,wrong.objects);assert.equal(wrong.camera[0].fov,62);
});
test('source projection clips foreground surfaces crossing the camera plane instead of losing the ground',()=>{
 const {projectedSceneBoxes}=load('server/src/spatialSceneCalibration.ts');
 const plan=fixture();plan.objects=[{...object('path',[0,-.1,0],[12,.2,24]),surface:'ground'}];
 plan.camera=[0,5].map(t=>({t,position:[0,2,6],target:[0,1,-2],fov:45}));
 const box=projectedSceneBoxes(plan,'9:16').path;
 assert.equal(box[0],0);assert.equal(box[2],1);assert.ok(Math.abs(box[1]+box[3]-1)<1e-8,'foreground ground must extend to the bottom of the frame');
 assert.ok(box[3]>.45,'the camera stands over the path, not in front of a tiny distant floor');
});
test('source inventory keeps all measured landmarks when a held prop uses dotted owner notation',()=>{
 const {validateSceneLayout}=load('server/src/spatialSceneCalibration.ts');
 const input={camera:'eye level',landmarks:[{id:'actor',description:'person',box:[0,.3,.3,.6],occluded:true},{id:'actor.tool',description:'held tool points down',box:[.2,.5,.1,.3],occluded:false}]};
 const layout=validateSceneLayout(input);assert.deepEqual(layout.landmarks.map(item=>item.id),['actor','actor_tool']);assert.deepEqual(layout.landmarks[1].box,input.landmarks[1].box);assert.equal(input.landmarks[1].id,'actor.tool');
});
test('new flight scene gets physical ground below the subject; legacy loading never inserts geometry',()=>{
 const {prepareMotionBlockout}=load('server/src/motionBlockout.ts');const plan=fixture();plan.objects=plan.objects.filter(o=>o.id==='dragon');plan.objects[0].keys.forEach(k=>k.position[1]=8);const built=prepareMotionBlockout(plan,'16:9');assert.equal(built.objects[0].keys[0].position[1],8);assert.equal(built.objects[1].surface,'ground');assert.equal(built.objects[1].keys[0].position[1],-.1);assert.equal(model.validateMotionPlan(plan).objects.length,1);
});
test('compact arbitrary joint graph compiles to connected boxes without species templates or root double scaling',()=>{
 const {prepareMotionBlockout}=load('server/src/motionBlockout.ts');
 const input={format:'connected-boxes',duration:5,objects:[{id:'imagined_walker',role:'actor',position:[-1,0,0],size:[8,9,7],joints:{base:[0,.4,0],body:[0,1,0],bend:[.5,1.2,0],tip:[.8,1.6,.1]},bones:[{id:'body',from:'base',to:'body',width:.6,depth:.4},{id:'appendage_a',from:'body',to:'bend',width:.2,depth:.2},{id:'appendage_b',from:'bend',to:'tip',width:.15,depth:.15}],parts:[{id:'panel',position:[0,1,.1],size:[.5,.6,.1]}]},{id:'floor',surface:'ground',position:[0,-.1,0],size:[20,.2,20]}],camera:{position:[0,2,6],target:[0,1,0],fov:45}};
 const plan=prepareMotionBlockout(input,'9:16');assert.equal(plan.objects[0].role,'actor');assert.deepEqual(plan.objects[0].keys[0].scale,[1,1,1]);assert.deepEqual(plan.objects[0].parts[2].keys[0].span.end,plan.objects[0].parts[3].keys[0].span.start);
 const view=createMotionScene(plan,9/16),meshes=[];view.scene.traverse(n=>{if(n.isMesh)meshes.push(n);});assert.ok(meshes.some(n=>n.material.color.getHexString()===load('src/motionScene.ts').subjectColor('imagined_walker').slice(1).toLowerCase()));assert.ok(meshes.some(n=>n.material.color.getHexString()==='8795af'));assert.ok(meshes.every(n=>n.children.some(c=>c.isLineSegments)),'environment or actor lacks edges');view.dispose();
});
test('visual review sees source and actual render once, honors original tier and rejects replay/tampering',async()=>{
 const calls=[];const review=load('server/src/motionVisualReview.ts',{openai:class{},'./textGeneration':{createRoutedTextClient:()=>({chat:{completions:{create:async request=>{calls.push(request);return{choices:[{message:{content:'{"accepted":true}'}}]};}}}})},'./aiUsageLedger':{recordOpenAiUsage(){}}});const input={plan:fixture(),image:'https://assets.test/source.jpg',aspect:'9:16',prompt:'Keep the man on the left'};const ticket=review.issueMotionReview('7','luna-fixture',input),body={...input,reviewTicket:ticket,preview:'data:image/jpeg;base64,YWJj'};
 assert.deepEqual(await review.reviewMotionBlockout('8',body),input.plan);assert.equal(calls.length,0);await review.reviewMotionBlockout('7',{...body,prompt:'changed'});assert.equal(calls.length,0);await review.reviewMotionBlockout('7',body);await review.reviewMotionBlockout('7',body);assert.equal(calls.length,1);assert.equal(calls[0].model,'luna-fixture');assert.deepEqual(calls[0].messages[1].content.slice(1).map(p=>p.image_url.url),[input.image,body.preview]);
});
test('invalid correction/provider failure keeps paid first result without another call',async()=>{
 for(const result of [new Error('provider down'),{plan:{version:99}}, {accepted:true}]){let count=0;const review=load('server/src/motionVisualReview.ts',{openai:class{},'./textGeneration':{createRoutedTextClient:()=>({chat:{completions:{create:async()=>{count++;if(result instanceof Error)throw result;return{choices:[{message:{content:JSON.stringify(result)}}]};}}}})},'./aiUsageLedger':{recordOpenAiUsage(){}}});const input={plan:fixture(),image:'https://assets.test/source.jpg',aspect:'9:16',prompt:'test'};assert.deepEqual(await review.reviewMotionBlockout('1',{...input,reviewTicket:review.issueMotionReview('1','luna',input),preview:'data:image/jpeg;base64,YQ=='}),input.plan);assert.equal(count,1);}
});
test('a visual correction keeps its camera and subject scale instead of running calibration a second time',async()=>{
 const plan=fixture();plan.objects[0].role='actor';
 const correctedCamera=plan.camera.map(key=>({...key,position:[0,2.4,8],target:[0,1,-2],fov:50}));
 const correctedKeys=plan.objects[0].keys.map(key=>({...key,scale:[1.1,1.1,1.1]}));
 const review=load('server/src/motionVisualReview.ts',{openai:class{},'./textGeneration':{createRoutedTextClient:()=>({chat:{completions:{create:async()=>({choices:[{message:{content:JSON.stringify({correction:{camera:correctedCamera,objects:[{id:'person',keys:correctedKeys}]}})}}]})}}})},'./aiUsageLedger':{recordOpenAiUsage(){}}});
 const {projectedSceneBoxes}=load('server/src/spatialSceneCalibration.ts');
 const desired={...plan,camera:correctedCamera,objects:plan.objects.map(object=>object.id==='person'?{...object,keys:correctedKeys}:object)};
 const input={plan,image:'https://assets.test/source.jpg',aspect:'9:16',prompt:'Match source',sourceLayout:{camera:'eye level',landmarks:Object.entries(projectedSceneBoxes(desired,'9:16')).filter(([id])=>id!=='floor').map(([id,box])=>({id,description:id,box,occluded:false}))}};
 const result=await review.reviewMotionBlockout('1',{...input,reviewTicket:review.issueMotionReview('1','luna',input),preview:'data:image/jpeg;base64,YQ=='});
 assert.deepEqual(result.camera,correctedCamera);assert.deepEqual(result.objects[0].keys,correctedKeys);
});
test('one visual review keeps the first result when its correction worsens measured actor framing',async()=>{
 let calls=0;const plan=fixture();plan.objects[0].role='actor';
 const {projectedSceneBoxes}=load('server/src/spatialSceneCalibration.ts');
 const sourceLayout={camera:'source view',landmarks:Object.entries(projectedSceneBoxes(plan,'9:16')).filter(([id])=>id!=='floor').map(([id,box])=>({id,description:id,box,occluded:false}))};
 const correction={objects:[{id:'person',keys:plan.objects[0].keys.map(key=>({...key,scale:[12,12,12]}))}]};
 const review=load('server/src/motionVisualReview.ts',{openai:class{},'./textGeneration':{createRoutedTextClient:()=>({chat:{completions:{create:async()=>{calls++;return{choices:[{message:{content:JSON.stringify({correction})}}]};}}}})},'./aiUsageLedger':{recordOpenAiUsage(){}}});
 const input={plan,sourceLayout,image:'https://assets.test/source.jpg',aspect:'9:16',prompt:'Keep the source view'};
 const result=await review.reviewMotionBlockout('1',{...input,reviewTicket:review.issueMotionReview('1','luna',input),preview:'data:image/jpeg;base64,YQ=='});
 assert.deepEqual(result,plan);assert.equal(calls,1);
});


test('box bases allow curved appendages, filled outlines and small supported props without losing geometry',()=>{
 const {prepareMotionBlockout}=load('server/src/motionBlockout.ts');
 const input={format:'connected-primitives',duration:5,camera:{position:[0,3,8],target:[0,1,0],fov:45},objects:[
 {id:'walker',role:'actor',position:[-2,0,0],parts:[{id:'body',size:[1,1,1],position:[0,1,0]},{id:'curved_appendage',shape:'tube',geometry:{path:[[0,1,0],[.2,1.5,0],[.5,1.7,0]],radius:.15}},{id:'membrane',shape:'extrude',geometry:{outline:[[0,0],[1,1],[1,0]],depth:.06},position:[0,1,0]}]},
 {id:'table',role:'scenery',position:[0,0,0],parts:[{id:'tabletop',size:[2,.2,2],position:[0,1,0]}]},
 {id:'cup',role:'prop',shape:'cylinder',geometry:{radiusTop:.5,radiusBottom:.35},size:[.3,.4,.3],position:[0,1.8,0]},
 {id:'plane',role:'actor',size:[1,.3,2],position:[4,8,0]},
 ]};
 const plan=prepareMotionBlockout(input,'16:9',undefined,[{from:'cup',to:'table',relation:'rests_on'}]);
 assert.equal(plan.objects[0].parts[1].shape,'tube');assert.deepEqual(plan.objects[0].parts[1].geometry.path,input.objects[0].parts[1].geometry.path);
 assert.equal(plan.objects[0].parts[2].shape,'extrude');assert.equal(plan.objects[2].shape,'cylinder');
 assert.ok(Math.abs(plan.objects[2].keys[0].position[1]-1.3)<1e-8,'cup must touch table');assert.equal(plan.objects[3].keys[0].position[1],8,'flight altitude must survive');
 const view=createMotionScene(plan,16/9);let surfaces=0;view.scene.traverse(n=>{if(n.isMesh && n.material.userData.physicalGrid)surfaces++});assert.ok(surfaces>0);view.dispose();
});

test('declared grip joins held asset to named wrist and survives owner movement',()=>{
 const {prepareMotionBlockout}=load('server/src/motionBlockout.ts');
 const input={format:'connected-primitives',duration:5,camera:{position:[0,2,5],target:[0,1,0],fov:45},objects:[
 {id:'owner',role:'actor',position:[1,0,0],joints:{elbow:[.3,1.3,0],right_wrist:[.5,.9,.1]},bones:[{id:'forearm',from:'elbow',to:'right_wrist',width:.2,depth:.2}]},
 {id:'tool',role:'prop',identity:'held tool',attachment:{objectId:'owner',jointId:'right_wrist'},gripPoint:[0,.3,0],position:[4,2,0],rotation:[0,0,-.2],parts:[{id:'grip',position:[0,.3,0],size:[.1,.3,.1]},{id:'blade',position:[0,-.3,0],size:[.1,.9,.05]}]}
 ]};
 const plan=prepareMotionBlockout(input,'9:16');assert.deepEqual(plan.objects[1].attachment,{objectId:'owner',partId:'forearm'});
 const view=createMotionScene(plan,9/16),root=view.roots.get('tool');
 const grip=new THREE.Vector3(0,.3,0).applyMatrix4(root.matrixWorld);assert.ok(grip.distanceTo(new THREE.Vector3(1.5,.9,.1))<1e-6,JSON.stringify(grip));
 plan.objects[0].keys.forEach(k=>k.position[0]+=2);view.draw(0,plan);assert.ok(new THREE.Vector3(0,.3,0).applyMatrix4(root.matrixWorld).distanceTo(new THREE.Vector3(3.5,.9,.1))<1e-6);view.dispose();
});

test('composition fitting cannot move a standing actor off its raised support',()=>{
 const {prepareMotionBlockout}=load('server/src/motionBlockout.ts');const plan=fixture();plan.objects=[{...object('actor',[1,4,-3],[1,2,1]),role:'actor'},{...object('landing',[1,1,-3],[4,.4,4]),surface:'ground'}];
 const layout={camera:'test',landmarks:[{id:'actor',description:'actor',box:[.6,.2,.3,.5],occluded:false}]};
 const built=prepareMotionBlockout(plan,'9:16',layout,[{from:'actor',to:'landing',relation:'stands_on'}]);const pose=built.objects[0].keys[0];
 assert.ok(Math.abs(pose.position[1]-pose.scale[1]/2-1.2)<1e-8);
 const {sceneWorldCorners}=load('server/src/spatialSceneCalibration.ts');const feet=sceneWorldCorners(built).actor.filter(point=>Math.abs(point[1]-1.2)<1e-6);
 assert.ok(feet.every(point=>point[0]>=-1-1e-6 && point[0]<=3+1e-6 && point[2]>=-5-1e-6 && point[2]<=-1+1e-6),'framing changes must keep the feet on the landing');
});
test('source fitting stays inside rotated parent-local support and authored navigation bounds',()=>{
 const {fitSourceSubjects,projectedSceneBoxes,sceneWorldCorners}=load('server/src/spatialSceneCalibration.ts');
 const plan=fixture();plan.objects=[{...object('actor',[.7,1.25,-.2],[.3,2,.3]),role:'actor'},
 {...object('deck',[.7,0,-.2]),parts:[{...object('top',[.1,.15,.2],[2.3,.2,1.4]),surface:'ground'}]}];
 plan.objects[1].keys.forEach(key=>key.rotation[1]=.2);plan.objects[1].parts[0].keys.forEach(key=>key.rotation[1]=Math.PI/4);
 const view=createMotionScene(plan,9/16),top=view.parts.get('deck').get('top').matrixWorld.clone();
 const center=new THREE.Vector3(0,.5,0).applyMatrix4(top);view.dispose();
 plan.objects[0].keys.forEach(key=>key.position=[center.x,1.25,center.z]);
 const desired=structuredClone(plan);desired.objects[0].keys.forEach(key=>{key.position[0]+=.8;key.position[2]-=.8;});
 const layout={camera:'source view',landmarks:[{id:'actor',description:'standing actor',box:projectedSceneBoxes(desired,'9:16').actor,occluded:false}]};
 const areas=[{min:[center.x-.35,.24,center.z-.35],max:[center.x+.35,.26,center.z+.35]}],relations=[{from:'actor',to:'deck',relation:'stands_on'}];
 const fitted=fitSourceSubjects(plan,layout,'9:16',relations,areas),corners=sceneWorldCorners(fitted).actor;
 const bottom=Math.min(...corners.map(point=>point[1]));assert.ok(Math.abs(bottom-.25)<1e-8);
 for(const point of corners.filter(point=>Math.abs(point[1]-bottom)<1e-6)){
  const local=new THREE.Vector3(...point).applyMatrix4(top.clone().invert());assert.ok(Math.abs(local.x)<=.500001 && Math.abs(local.z)<=.500001);
  assert.ok(point[0]>=areas[0].min[0]-1e-6 && point[0]<=areas[0].max[0]+1e-6 && point[2]>=areas[0].min[2]-1e-6 && point[2]<=areas[0].max[2]+1e-6);
 }
 assert.notDeepEqual(fitted.objects[0].keys,plan.objects[0].keys,'bounded fitting should improve placement where it safely can');
 const wrongHeight=[{min:[center.x-.35,2,center.z-.35],max:[center.x+.35,3,center.z+.35]}];
 assert.deepEqual(fitSourceSubjects(plan,layout,'9:16',relations,wrongHeight).objects[0].keys,plan.objects[0].keys);
});

test('moving vehicles stay solid alongside skeletal people and retain their body, cabin and wheels in saved motion',()=>{
 const {prepareMotionBlockout}=load('server/src/motionBlockout.ts');
 const carParts=[{id:'body',size:[2,.45,1],position:[0,.55,0]},{id:'cabin',size:[.9,.4,.8],position:[0,.95,0]},...[-.65,.65].flatMap((x,i)=>[-.55,.55].map((z,j)=>({id:`wheel_${i}_${j}`,shape:'cylinder',size:[.4,.16,.4],position:[x,.25,z],rotation:[Math.PI/2,0,0]})))];
 const input={format:'skeleton-scene',duration:5,camera:{position:[0,2,6],target:[0,.7,0],fov:45},objects:[
 {id:'person',role:'actor',representation:'skeleton',joints:{hip:[0,.6,0],head:[0,1.5,0]},bones:[{id:'spine',from:'hip',to:'head'}]},
 {id:'car',role:'actor',representation:'solid',identity:'same car',position:[2,0,0],parts:carParts},
 {id:'unannotated_car',role:'actor',position:[-2,0,0],parts:carParts},
 {id:'aircraft',role:'actor',representation:'solid',shape:'cylinder',size:[.3,2,.3],position:[0,5,-3],rotation:[Math.PI/2,0,0],parts:[{id:'wings',size:[3,.1,.4]}]},
 ]};
 const plan=prepareMotionBlockout(input,'16:9');assert.equal(plan.objects[0].parts[0].shape,'bone');
 for(const id of ['car','unannotated_car']){const car=plan.objects.find(object=>object.id===id);assert.equal(car.role,'actor');assert.equal(car.parts.length,6);assert.equal(car.parts[0].shape,'box');assert.equal(car.parts[1].id,'cabin');assert.equal(car.parts.filter(part=>part.shape==='cylinder').length,4);assert.ok(car.parts.every(part=>part.shape!=='bone'));assert.deepEqual(car.keys[0].scale,[1,1,1]);}
 assert.equal(plan.objects[3].parts[0].shape,'cylinder');assert.equal(plan.objects[3].parts[1].id,'wings');
 const saved=model.validateMotionPlan(JSON.parse(JSON.stringify(plan)));saved.objects.find(object=>object.id==='car').keys[1].position[0]+=3;
 const view=createMotionScene(saved,16/9);const cabin=view.parts.get('car').get('cabin'),start=cabin.getWorldPosition(new THREE.Vector3());view.draw(5);
 assert.ok(Math.abs(cabin.getWorldPosition(new THREE.Vector3()).x-start.x-3)<1e-7);assert.equal(saved.objects.find(object=>object.id==='car').identity,'same car');view.dispose();
});

test('compact mirrored outlines normalize into valid geometry without changing their world silhouette',()=>{
 const {prepareMotionBlockout}=load('server/src/motionBlockout.ts');
 const outline=[[0,0],[3,0],[0,2.5]],input={format:'connected-primitives',duration:5,camera:{position:[0,2,6],target:[0,1,0],fov:45},objects:[
  {id:'solid_unit',role:'actor',representation:'solid',position:[1,0,0],parts:[{id:'wing',shape:'extrude',position:[0,1,0],size:[-2,1,1],geometry:{outline,depth:.12}}]},
 ]},before=JSON.stringify(input);
 const plan=prepareMotionBlockout(input,'9:16'),part=plan.objects[0].parts[0];assert.ok(part.geometry.outline.flat().every(n=>Math.abs(n)<=2));assert.ok(part.keys[0].scale.every(n=>n>0));assert.equal(JSON.stringify(input),before);
 for(let i=0;i<outline.length;i++)for(let axis=0;axis<2;axis++)assert.ok(Math.abs(part.geometry.outline[i][axis]*part.keys[0].scale[axis]-outline[i][axis]*input.objects[0].parts[0].size[axis])<1e-8);
 const view=createMotionScene(plan,9/16);assert.equal(view.parts.get('solid_unit').get('wing').geometry.type,'ExtrudeGeometry');view.dispose();
});

test('held endpoint primitives keep their tip direction and exact length on an animated solid joint',()=>{
 const {prepareMotionBlockout}=load('server/src/motionBlockout.ts');
 for(const shape of ['box','cylinder','cone']){
  const wrist=[.5,.8,.1],tip=[.85,-.15,.35];
  const input={format:'connected-primitives',duration:5,camera:{position:[0,2,6],target:[0,1,0],fov:45},objects:[
   {id:'owner',role:'actor',representation:'solid',position:[1,0,-1],rotation:[.2,.6,-.1],joints:{elbow:[.2,1.2,0],wrist},bones:[{id:'forearm',from:'elbow',to:'wrist',width:.2,depth:.16}]},
   {id:'tool',role:'prop',shape,size:[.06,9,.07],rotation:[0,0,2],attachment:{objectId:'owner',jointId:'wrist'},tipPosition:tip},
  ]};
  const plan=prepareMotionBlockout(input,'9:16'),view=createMotionScene(plan,9/16),prop=view.roots.get('tool'),root=view.roots.get('owner');
  assert.equal(plan.objects[1].attachment.partId,'forearm_grip_anchor');
  const localPoint=y=>new THREE.Vector3(0,y,0).applyMatrix4(prop.matrixWorld);
  assert.ok(localPoint(-.5).distanceTo(new THREE.Vector3(...wrist).applyMatrix4(root.matrixWorld))<1e-6);
  assert.ok(localPoint(.5).distanceTo(new THREE.Vector3(...tip).applyMatrix4(root.matrixWorld))<1e-6,'the far tip follows the supplied direction, not the guessed Euler angle');
  const length=localPoint(-.5).distanceTo(localPoint(.5));
  const forearm=plan.objects[0].parts.find(part=>part.id==='forearm');forearm.keys[1]=model.boxSpanKey(5,{start:[.1,1.3,.2],end:[.7,1.05,.4],width:.2,depth:.16});
  const animated=model.validateMotionPlan(JSON.parse(JSON.stringify(plan)));
  for(const time of [0,1,2.5,4,5]){view.draw(time,animated);const span=model.interpolateBoxSpan(...model.motionSegment(animated.objects[0].parts.find(part=>part.id==='forearm').keys,time)).span;
   assert.ok(localPoint(-.5).distanceTo(new THREE.Vector3(...span.end).applyMatrix4(root.matrixWorld))<1e-6);
   assert.ok(Math.abs(localPoint(-.5).distanceTo(localPoint(.5))-length)<1e-6,'solid limb animation must not stretch the held prop');
  }view.dispose();
 }
});

test('compound endpoint cores preserve child parts, grip contact and exact length on rotated animated owners',()=>{
 const {prepareMotionBlockout}=load('server/src/motionBlockout.ts');
 for(const representation of ['solid','skeleton'])for(const shape of ['box','cylinder','cone']){
  const wrist=[.5,.8,.1],tip=[.85,-.15,.35],feature={id:'feature',shape:'box',position:[0,.2,0],size:[.2,.05,.05]};
  const input={format:'connected-primitives',duration:5,camera:{position:[0,2,6],target:[0,1,0],fov:45},objects:[
   {id:'owner',role:'actor',representation,position:[1,.2,-1],rotation:[.2,.6,-.1],joints:{elbow:[.2,1.2,0],wrist},bones:[{id:'forearm',from:'elbow',to:'wrist',width:.2,depth:.16}]},
   {id:'tool',role:'prop',identity:'same held asset',shape,size:[.06,9,.07],position:[15,15,15],rotation:[0,0,2],attachment:{objectId:'owner',jointId:'wrist'},tipPosition:tip,parts:[feature]},
  ]},before=JSON.stringify(input);
  const plan=prepareMotionBlockout(input,'9:16'),tool=plan.objects.find(object=>object.id==='tool');
  assert.equal(JSON.stringify(input),before);assert.equal(tool.identity,'same held asset');assert.deepEqual(tool.keys[0].scale,[1,1,1]);
  assert.deepEqual(tool.parts.find(part=>part.id==='feature').keys,keys(feature.position,feature.size));
  const corePart=tool.parts.find(part=>part.id==='solid_core');assert.equal(corePart.shape,shape);
  assert.ok(Math.abs(corePart.keys[0].scale[1]-Math.hypot(...tip.map((n,i)=>n-wrist[i])))<1e-8);
  const view=createMotionScene(plan,9/16),core=view.parts.get('tool').get('solid_core'),root=view.roots.get('owner');
  const point=y=>new THREE.Vector3(0,y,0).applyMatrix4(core.matrixWorld),length=point(-.5).distanceTo(point(.5));
  assert.ok(point(-.5).distanceTo(new THREE.Vector3(...wrist).applyMatrix4(root.matrixWorld))<1e-6);
  assert.ok(point(.5).distanceTo(new THREE.Vector3(...tip).applyMatrix4(root.matrixWorld))<1e-6,'compound tips must ignore guessed root position/rotation');
  plan.objects[0].parts.find(part=>part.id==='forearm').keys[1]=model.boxSpanKey(5,{start:[.1,1.3,.2],end:[.7,1.05,.4],width:.2,depth:.16});
  const animated=model.validateMotionPlan(JSON.parse(JSON.stringify(plan)));
  for(const time of [0,1,2.5,4,5]){view.draw(time,animated);const span=model.interpolateBoxSpan(...model.motionSegment(animated.objects[0].parts.find(part=>part.id==='forearm').keys,time)).span;
   assert.ok(point(-.5).distanceTo(new THREE.Vector3(...span.end).applyMatrix4(root.matrixWorld))<1e-6,'the held core starts at the animated wrist');
   assert.ok(Math.abs(point(-.5).distanceTo(point(.5))-length)<1e-6,'compound equipment must not stretch with the owner limb');
  }view.dispose();
 }
});

test('full authored extrusion normalization preserves animated world geometry and rejects changing mirror signs',()=>{
 const {normalizeBlockoutGeometry,expandBlockoutAuthoring}=load('server/src/motionBlockoutAuthoring.ts');
 const input=fixture();input.objects=[{...object('rigid_unit',[1,.5,-1]),role:'actor',parts:[{
  id:'wing',shape:'extrude',color:'#C4CAD6',geometry:{outline:[[0,0],[3,0],[.7,2.5]],depth:.12},
  keys:[{t:0,position:[.2,1,-.3],rotation:[.2,.3,.4],scale:[-2,1,-1]},{t:5,position:[.5,1.4,-.1],rotation:[.1,.5,.2],scale:[-3,1.5,-.8]}],
 }]}];input.objects[0].keys[1].position[0]+=2;input.objects[0].keys.forEach(key=>key.rotation=[.15,-.4,.1]);
 const before=JSON.stringify(input),normalized=normalizeBlockoutGeometry(input),validated=model.validateMotionPlan(normalized);
 assert.equal(JSON.stringify(input),before);assert.notEqual(normalized,input);
 assert.equal(normalizeBlockoutGeometry(validated),validated,'valid full saved plans must retain their reference');
 assert.equal(expandBlockoutAuthoring(validated),validated,'the full wire format must not be recompiled');
 const part=validated.objects[0].parts[0];assert.ok(part.geometry.outline.flat().every(n=>Math.abs(n)<=2));assert.ok(part.keys.every(key=>key.scale.every(n=>n>0)));
 const view=createMotionScene(validated,9/16),mesh=view.parts.get('rigid_unit').get('wing'),root=view.roots.get('rigid_unit');
 for(const time of [0,1,2.5,4,5]){view.draw(time);const [a,b,t]=model.motionSegment(input.objects[0].parts[0].keys,time),lerp=field=>a[field].map((n,i)=>n+(b[field][i]-n)*t);
  const originalMatrix=new THREE.Matrix4().compose(new THREE.Vector3(...lerp('position')),new THREE.Quaternion().setFromEuler(new THREE.Euler(...lerp('rotation'))),new THREE.Vector3(...lerp('scale'))).premultiply(root.matrixWorld);
  for(let i=0;i<part.geometry.outline.length;i++)for(const sign of [-1,1]){
   const original=new THREE.Vector3(...input.objects[0].parts[0].geometry.outline[i],sign*.06).applyMatrix4(originalMatrix);
   const actual=new THREE.Vector3(...part.geometry.outline[i],-sign*.06).applyMatrix4(mesh.matrixWorld);
   assert.ok(actual.distanceTo(original)<1e-6,'normalization must preserve the animated extrusion volume, including reflected centered depth');
  }
 }view.dispose();
 const signFlip=structuredClone(input);signFlip.objects[0].parts[0].keys[1].scale[0]=3;
 assert.equal(normalizeBlockoutGeometry(signFlip),signFlip);assert.throws(()=>model.validateMotionPlan(expandBlockoutAuthoring(signFlip)),/range/);
});

test('one visual review preserves omitted rigid components and removes only explicitly named erroneous fragments',async()=>{
 const {prepareMotionBlockout}=load('server/src/motionBlockout.ts'),plan=fixture();
 plan.objects=[{...object('vehicle',[0,.4,0]),role:'actor',identity:'same vehicle',parts:[
  object('body',[0,.4,0],[2,.6,1]),object('cabin',[0,.9,0],[.8,.5,.8]),object('wheel',[-.6,.1,.5],[.4,.4,.2]),object('fragment',[.9,.7,0],[.1,.1,.1]),
 ]},plan.objects[2]];
 const original=prepareMotionBlockout(plan,'9:16'),cabinKeys=original.objects[0].parts.find(part=>part.id==='cabin').keys.map(key=>({...key,position:[0,1.05,0]}));
 const dropped=structuredClone(original);dropped.objects[0].parts=dropped.objects[0].parts.filter(part=>part.id!=='wheel');
 for(const [mode,response] of [
  ['full_drop',{plan:dropped}],
  ['sparse_update',{correction:{objects:[{id:'vehicle',parts:[{id:'cabin',keys:cabinKeys}]}]}}],
  ['explicit_remove',{correction:{objects:[{id:'vehicle',parts:[],removePartIds:['fragment']}]}}],
  ['removal_only',{correction:{objects:[{id:'vehicle',removePartIds:['fragment']}]}}],
 ]){
  let calls=0;const review=load('server/src/motionVisualReview.ts',{openai:class{},'./textGeneration':{createRoutedTextClient:()=>({chat:{completions:{create:async()=>{calls++;return{choices:[{message:{content:JSON.stringify(response)}}]};}}}})},'./aiUsageLedger':{recordOpenAiUsage(){}}});
  const input={plan:original,image:'https://assets.test/source.jpg',aspect:'9:16',prompt:'Preserve vehicle components'};
  const result=await review.reviewMotionBlockout('1',{...input,reviewTicket:review.issueMotionReview('1','luna-fixture',input),preview:'data:image/jpeg;base64,YQ=='});
  assert.equal(calls,1);assert.equal(result.objects[0].identity,'same vehicle');
  if(mode==='full_drop')assert.deepEqual(result,original,'a full response cannot silently drop a rigid component');
  else if(mode==='sparse_update'){
   assert.deepEqual(result.objects[0].parts.find(part=>part.id==='cabin').keys,cabinKeys);
   for(const id of ['body','wheel','fragment'])assert.deepEqual(result.objects[0].parts.find(part=>part.id===id),original.objects[0].parts.find(part=>part.id===id));
  }else assert.deepEqual(result.objects[0].parts.map(part=>part.id),['body','cabin','wheel']);
 }
});

test('legacy moving solids receive actor shading without ground lines on their roof',()=>{
 const plan=fixture();plan.objects=[{...object('legacy_unit',[0,.3,0],[2,.6,1]),parts:[object('upper_block',[0,.4,0],[1,.4,.8])]},plan.objects[2]];
 const view=createMotionScene(plan,16/9);assert.equal(view.parts.get('legacy_unit').get('upper_block').material.userData.physicalGrid,true);
 plan.objects[0].keys[1].position[0]=2;view.draw(2.5,plan);
 const roof=view.parts.get('legacy_unit').get('upper_block');assert.equal(roof.material.color.getHexString(),load('src/motionScene.ts').subjectColor('legacy_unit').slice(1).toLowerCase());assert.equal(roof.material.userData.physicalGrid,undefined);assert.equal(roof.geometry.type,'BoxGeometry');view.dispose();
});

test('supported framing jointly adjusts position and size instead of shrinking a subject to repair one overhanging foot',()=>{
 const {fitSourceSubjects,projectedSceneBoxes,sceneWorldCorners}=load('server/src/spatialSceneCalibration.ts');
 const plan=fixture();plan.objects=[{...object('actor',[.9,1,1.35],[.8,2,.8]),role:'actor'},{...object('landing',[0,-.1,0],[4,.2,3]),surface:'ground'}];
 const desired=structuredClone(plan);desired.objects[0].keys.forEach(key=>{key.position=[.6,1.2,.8];key.scale=[.96,2.4,.96]});
 const box=projectedSceneBoxes(desired,'9:16').actor;
 const layout={camera:'source view',landmarks:[{id:'actor',description:'full size actor on the platform',box,occluded:false}]};
 const fitted=fitSourceSubjects(plan,layout,'9:16',[{from:'actor',to:'landing',relation:'stands_on'}],[{min:[-2,-.01,-1.5],max:[2,.01,1.5]}]);
 assert.ok(fitted.objects[0].keys[0].scale[1]>2.1,'a feasible full-size fit must not collapse the subject');
 const corners=sceneWorldCorners(fitted).actor,bottom=Math.min(...corners.map(point=>point[1]));assert.ok(Math.abs(bottom)<1e-8);
 assert.ok(corners.filter(point=>Math.abs(point[1]-bottom)<1e-6).every(point=>Math.abs(point[0])<=2.000001 && Math.abs(point[2])<=1.500001),'all feet remain on the landing and in navigation');
 const fittedBox=projectedSceneBoxes(fitted,'9:16').actor;assert.ok(fittedBox.reduce((n,v,i)=>n+(v-box[i])**2,0)<.003);
});

test('skeletal actors omit cosmetic panels, keep solid equipment and connect rounded joints through motion',()=>{
 const {prepareMotionBlockout}=load('server/src/motionBlockout.ts');
 const input={format:'skeleton-scene',duration:5,camera:{position:[0,2,6],target:[0,1,0],fov:45},objects:[
 {id:'actor',role:'actor',boneWidth:.1,position:[0,0,0],joints:{hip:[0,.6,0],shoulder:[0,1.4,0],right_wrist:[.5,1,.1]},bones:[{id:'body',from:'hip',to:'shoulder'},{id:'arm',from:'shoulder',to:'right_wrist'}],parts:[{id:'cape',size:[1,2,.1]}]},
 {id:'sword',role:'prop',identity:'sword',shape:'cone',size:[.08,.8,.08],attachment:{objectId:'actor',jointId:'right_wrist'},gripPoint:[0,-.4,0]}
 ]};
 const plan=prepareMotionBlockout(input,'9:16');assert.deepEqual(plan.objects[0].parts.map(p=>p.shape),['bone','bone','anchor']);assert.ok(!plan.objects[0].parts.some(p=>p.id==='cape'));assert.equal(plan.objects[1].shape,'cone');assert.equal(plan.objects[1].identity,'sword');
 const saved=JSON.parse(JSON.stringify(plan));const validated=model.validateMotionPlan(saved);assert.deepEqual(validated.objects[0].parts[0].keys[0].span,plan.objects[0].parts[0].keys[0].span);
 plan.objects[0].parts[0].keys[1]=model.boxSpanKey(5,{start:[0,.6,0],end:[.2,1.2,.3],width:.1,depth:.1});
 plan.objects[0].parts[1].keys[1]=model.boxSpanKey(5,{start:[.2,1.2,.3],end:[.7,1.4,.4],width:.1,depth:.1});
 const view=createMotionScene(model.validateMotionPlan(plan),9/16);
 for(const t of [0,1,2.5,4,5]){view.draw(t);const a=view.parts.get('actor').get('body'),b=view.parts.get('actor').get('arm');
 const end=a.children.find(c=>c.userData.boneEnd===1),start=b.children.find(c=>c.userData.boneEnd===-1);
 assert.ok(end.getWorldPosition(new THREE.Vector3()).distanceTo(start.getWorldPosition(new THREE.Vector3()))<1e-7);
 const scale=end.getWorldScale(new THREE.Vector3());assert.ok(Math.abs(scale.x-scale.y)<1e-7 && Math.abs(scale.y-scale.z)<1e-7,'joints must remain spherical');assert.equal(end.material.color.getHexString(),'8de5ff');
 const prop=view.roots.get('sword');const tip=new THREE.Vector3(0,.5,0).applyMatrix4(prop.matrixWorld),base=new THREE.Vector3(0,-.5,0).applyMatrix4(prop.matrixWorld);assert.ok(Math.abs(tip.distanceTo(base)-.8)<1e-6,'bone animation must not stretch equipment');
 }
 view.dispose();
});

 test('static authoring accepts a redundant trailing Euler zero and single-key tracks locally',()=>{
 const {normalizeAuthoredScene}=load('server/src/motionBlockoutAuthoring.ts');
 const original=fixture();const input=structuredClone(original);
 input.objects[0].keys=[{...input.objects[0].keys[0],rotation:[0,0,-.2,0]}];
 input.camera=[input.camera[0]];
 const normalized=normalizeAuthoredScene(input);const result=model.validateMotionPlan(normalized);
 assert.deepEqual(result.objects[0].keys.map(k=>k.t),[0,5]);
 assert.deepEqual(result.objects[0].keys[0].rotation,[0,0,-.2]);
 assert.equal(result.camera.length,2);assert.equal(input.objects[0].keys.length,1);
 assert.strictEqual(normalizeAuthoredScene(original),original);
 });

test('new generated scene repairs missing camera and incomplete tracks without another AI turn',()=>{
 const {expandBlockoutAuthoring}=load('server/src/motionBlockoutAuthoring.ts');
 const input=fixture();delete input.camera;input.objects[0].keys=[{t:2,position:[1,2,3]}];
 const result=model.validateMotionPlan(expandBlockoutAuthoring(input));
 assert.equal(result.objects.length,input.objects.length);
 assert.deepEqual(result.objects[0].keys.map(k=>k.t),[0,2,5]);
 assert.deepEqual(result.objects[0].keys[0].position,[1,2,3]);
 assert.equal(result.camera.length,2);assert.ok(result.camera[0].fov);
 assert.throws(()=>model.validateMotionPlan(input),'saved data validation remains strict');
});

test('subject colors survive motion, reordering, edits and renderer recreation without changing scene geometry',()=>{
 const plan=fixture();plan.objects[0].role='actor';plan.objects[1].role='actor';
 const before=JSON.stringify(plan),view=createMotionScene(plan,1);
 const colors=v=>Object.fromEntries(['person','dragon'].map(id=>{let color;v.roots.get(id).traverse(n=>{if(n.isMesh && n.name!=='') color=n.material.color.getHexString();});return[id,color];}));
 const initial=colors(view);assert.notEqual(initial.person,initial.dragon);
 const frame=structuredClone(plan);frame.objects.reverse();frame.objects.find(o=>o.id==='person').parts[0].color='#abcdef';
 view.draw(3,frame);assert.deepEqual(colors(view),initial);
 const recreated=createMotionScene(frame,1);assert.deepEqual(colors(recreated),initial);
 assert.equal(JSON.stringify(plan),before);
 const floor=recreated.roots.get('floor').children[0];assert.equal(floor.material.color.getHexString(),'8795af');assert.ok(floor.material.userData.physicalGrid);
 const materials=new Set();view.scene.traverse(n=>{if(n.isMesh)materials.add(n.material);});let disposed=0;materials.forEach(m=>m.addEventListener('dispose',()=>disposed++));
 view.dispose();assert.equal(disposed,materials.size);recreated.dispose();
});

test('initial portrait framing includes offscreen controlled body without changing any geometry',()=>{
 const {frameSceneSubjects,projectedSceneBoxes}=load('server/src/spatialSceneCalibration.ts');
 const plan=fixture();plan.objects[0].role='actor';plan.objects[0].keys.forEach(k=>k.position[0]=-5);
 const original=JSON.stringify(plan);const result=frameSceneSubjects(plan,'9:16','person');
 const box=projectedSceneBoxes(result,'9:16').person;
 assert.ok(box[0]>=.049 && box[1]>=.049 && box[0]+box[2]<=.951 && box[1]+box[3]<=.951,JSON.stringify(box));
 assert.deepEqual(result.objects,plan.objects);assert.equal(JSON.stringify(plan),original);
});
test('source-image subject color persists in wire data and colors every body part consistently',()=>{
 const plan=fixture();plan.objects[0].role='actor';plan.objects[0].subjectColor='#3A3632';
 const saved=model.validateMotionPlan(JSON.parse(JSON.stringify(plan)));assert.equal(saved.objects[0].subjectColor,'#3A3632');
 const view=createMotionScene(saved,1);for(const part of view.parts.get('person').values())assert.equal(part.material.color.getHexString(),'3a3632');view.dispose();
});
