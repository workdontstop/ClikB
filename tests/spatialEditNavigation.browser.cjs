const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..'), port = 5206;
const parse = file => ts.createSourceFile(file, fs.readFileSync(path.join(root,file),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const story = parse('src/Storybook.tsx'), edit = parse('src/EditStory.tsx');
const baselineFile='.tmp/creation-control-upgrade-baseline/src/EditStory.tsx';
const baseline = fs.existsSync(path.join(root,baselineFile)) ? parse(baselineFile) : null;
function find(source, predicate) {
  let result;
  function visit(node) { if(!result && predicate(node))result=node; if(!result)ts.forEachChild(node,visit); }
  visit(source); assert.ok(result,'Production node not found'); return result;
}
const declaration = (source,name) => `const ${name} = ${find(source,node=>ts.isVariableDeclaration(node)&&node.name.getText(source)===name).initializer.getText(source)};`;
const effect = (source,fragment) => find(source,node=>ts.isExpressionStatement(node)&&ts.isCallExpression(node.expression)&&node.expression.expression.getText(source)==='useEffect'&&node.expression.arguments[0].getText(source).includes(fragment)).getText(source);
const currentFallback=effect(edit,'startEdit && isBShotGridContext');
// Prefer the saved pre-upgrade source. The guard-free native effect also lets
// a fresh checkout demonstrate why an empty flat slot cannot own Spatial mode.
const oldFallback=baseline ? effect(baseline,'startEdit && isBShotGridContext') : currentFallback.replace(' && !isSpatialInteraction','');
const studioElement=find(edit,node=>ts.isJsxSelfClosingElement(node)&&node.tagName.getText(edit)==='SpatialStudio');
let guardedStudio=studioElement.parent;
while(ts.isParenthesizedExpression(guardedStudio))guardedStudio=guardedStudio.parent;
assert.ok(ts.isBinaryExpression(guardedStudio),'Expected native SpatialStudio rendering guard');
const studioGuard=guardedStudio.left.getText(edit);
const fixture = ts.transpileModule(`
import React,{useState,useMemo,useCallback,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import axios from 'axios';
import SpatialStudio from '/src/components/SpatialStudio.tsx';
import {validateWorld,cloneWorld} from '/server/src/spatialWorld.ts';
const query=new URLSearchParams(location.search), old=query.has('baseline'), flat=query.has('flat');
const frame='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="640"><rect width="400" height="640" fill="#304440"/></svg>');
const makeScene=id=>{
 const plan={version:1,duration:5,background:'#304440',objects:[{id:'ship',shape:'box',color:'#aabbcc',keys:[0,5].map(t=>({t,position:[0,.5,0],rotation:[0,0,0],scale:[1,1,1]}))}],camera:[0,5].map(t=>({t,position:[3,3,5],target:[0,.5,0],fov:45}))};
 const world=validateWorld({version:2,model:'luna',revision:id,sourceImage:frame,aspectRatio:'9:16',plan,controlledObject:'ship',controlMode:'character',walkable:[{min:[-4,0,-4],max:[4,2,4]}],obstacles:[],approved:true});
 return {sceneId:id,activeNodeId:id+'-root',nodes:[{id:id+'-root',label:'Start',frameUrl:frame}],connections:[],draftMovement:null,ledger:{version:2,world,states:{[id+'-root']:world.initialState},routes:{},jobs:[],epoch:0,generationStarted:false,boardOpen:false,view:'three'}};
};
const initialScenes=['a0','a1'].map(makeScene), initialShots=[['a0:b:empty','a0:b:saved'],['a1:b:saved','a1:b:empty']].map(row=>row.map(makeScene));
const documents=Object.fromEntries([...initialScenes,...initialShots.flat()].map(scene=>[scene.sceneId,{scene:cloneWorld(scene),revision:1}]));
const operations=[];
axios.defaults.adapter=async config=>{
 const body=JSON.parse(String(config.data||'{}'));operations.push(body);
 if(!config.url?.includes('/fixture/spatial-world/document')||body.action!=='read')throw Error('No generation or mutation is allowed in navigation test');
 if(body.stageId==='a0:b:saved')await new Promise(resolve=>setTimeout(resolve,160));
 return {data:cloneWorld(documents[body.stageId]),status:200,statusText:'OK',headers:{},config};
};
const store=configureStore({reducer:(state={settings:{appColorDark:'#ffffff',appColorLight:'#101010',spatialControlMode:'dpad',spatialViewerHoverActive:false}})=>state});
const reject=async()=>{throw Error('No uploads in navigation test');};
function Workstation({index,parentSceneIndex,bIndex,startEdit,isBShotGridContext,ImagesHdCloud,spatialScene,updateSpatialScene,narrate,setnarrate,VideMode,PostId,pageType,interactionExperienceMode}) {
 ${declaration(edit,'isSpatialInteraction')}
 ${declaration(edit,'spatialStudioActive')}
 // Both versions run the extracted native effect; the old version reproduces the leak.
 if(old){${oldFallback}}else{${currentFallback}}
 return <main data-workstation data-owner={spatialScene.sceneId} style={{width:'100%',height:640,position:'relative',background:'#304440'}}>
  {${studioGuard}&&<SpatialStudio key={PostId+':'+spatialScene.sceneId} scene={spatialScene} stages={[]} postId={PostId} api="/fixture" appColor="#ffffff" oppositeAppColor="#101010" darkMode={true} prompt={'Video prompt '+spatialScene.sceneId} model="SeedanceMini" resolution="480p" aspect="9:16" audio={false} update={updateSpatialScene} navigate={()=>false} uploadVideo={reject} uploadFrame={reject} extractEnd={reject} dispatch={store.dispatch}/>}
  {!isSpatialInteraction&&<div data-flat-workstation>{narrate===0?'Images':'Videos'}</div>}
 </main>;
}
function Host(){
 const [activeEdit,setactiveEdit]=useState(0),[activeBShotEdit,setActiveBShotEdit]=useState(null);
 const [narrate,setnarrate]=useState(2),[VideMode,setVideMode]=useState(true),[startEdit,setstartEdit]=useState(true);
 const isBShotModeActive=true,isSpatialInteraction=!flat;
 const steps=['A scene zero','A scene one'],bShotPrompts=[['Empty shot','Saved spatial shot'],['Saved spatial shot','Empty shot']];
 const [spatialManifest,setSpatialManifest]=useState({version:1,scenes:cloneWorld(initialScenes)});
 const [bShotSpatialScenes,setBShotSpatialScenes]=useState(cloneWorld(initialShots));
 const bSpatialScenes=Object.fromEntries(bShotSpatialScenes.flat().map(scene=>[scene.sceneId,scene]));
 ${declaration(story,'activeBSpatialKey')}
 ${declaration(story,'activeSpatialScene')}
 ${declaration(story,'setBSpatialScenes')}
 ${declaration(story,'updateActiveSpatialScene')}
 ${declaration(story,'unifiedIndexMap')}
 ${declaration(story,'unifiedActiveEdit')}
 ${declaration(story,'handleSetUnifiedActiveEdit')}
 ${effect(story,'narrate === 2 && !VideMode')}
 const slots=unifiedIndexMap.map(m=>m.type==='A'?spatialManifest.scenes[m.index]:bShotSpatialScenes[m.index][m.bIndex]);
 const before=JSON.stringify([...initialScenes,...initialShots.flat()]);
 window.navigationTest={state:()=>({activeEdit,activeBShotEdit,narrate,VideMode,startEdit,index:unifiedActiveEdit,owner:activeSpatialScene.sceneId,operations,pristine:JSON.stringify([...spatialManifest.scenes,...bShotSpatialScenes.flat()])===before}),snapshot:()=>slots.map(scene=>({id:scene.sceneId,frame:scene.nodes[0].frameUrl,prompt:'Video prompt '+scene.sceneId,world:scene.ledger.world.revision})),go:handleSetUnifiedActiveEdit};
 return <Provider store={store}>
  <nav style={{display:'flex',gap:8,padding:8}}><button onClick={()=>handleSetUnifiedActiveEdit(unifiedActiveEdit-1)} disabled={unifiedActiveEdit===0}>Previous scene</button><button onClick={()=>handleSetUnifiedActiveEdit(unifiedActiveEdit+1)} disabled={unifiedActiveEdit===unifiedIndexMap.length-1}>Next scene</button><button onClick={()=>setnarrate(0)}>Images tab</button><button onClick={()=>setnarrate(2)}>Videos tab</button></nav>
  <output data-selected-scene>{activeSpatialScene.sceneId}</output><output data-mode>{narrate}:{String(VideMode)}</output>
  <Workstation index={unifiedActiveEdit} parentSceneIndex={activeEdit} bIndex={activeBShotEdit} startEdit={startEdit} isBShotGridContext={activeBShotEdit!==null} ImagesHdCloud={[frame,undefined,undefined,frame,undefined,undefined]} spatialScene={activeSpatialScene} updateSpatialScene={updateActiveSpatialScene} narrate={narrate} setnarrate={setnarrate} VideMode={VideMode} PostId={-100} pageType={3} interactionExperienceMode={flat?'tap':'spatial'}/>
 </Provider>;
}
createRoot(document.getElementById('root')).render(<Host/>);
`,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
(async()=>{
 const {createServer}=await import(pathToFileURL(path.join(root,'node_modules/vite/dist/node/index.js')));
 const server=await createServer({root,configFile:false,logLevel:'error',cacheDir:'.tmp/spatial-edit-navigation-vite',esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port,strictPort:true,hmr:false},plugins:[{
  name:'spatial-navigation-test',resolveId:id=>id==='/navigation-fixture.js'?'\0spatial-navigation-fixture':undefined,load:id=>id==='\0spatial-navigation-fixture'?fixture:undefined,
  configureServer(s){s.middlewares.use((req,res,next)=>{if(req.url.startsWith('/__test')){res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#111;color:white}button{padding:8px}</style><div id="root"></div><script type="module" src="/navigation-fixture.js"></script>');}else next();});}
 }]});await server.listen();
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  for(const [width,height] of [[1280,900],[390,844]]){
   const context=await browser.newContext({viewport:{width,height},...(width<500?{isMobile:true,hasTouch:true}:{})}),page=await context.newPage(),errors=[];
   page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(45000);
   await page.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:'+port+'/')||route.request().url().startsWith('data:')?route.continue():route.abort());
   const go=async suffix=>{await page.goto('http://127.0.0.1:'+port+'/__test'+suffix);await page.waitForFunction(()=>window.navigationTest);};
   await go('?baseline');await page.getByLabel('Playable 3D scene proxy').waitFor();
   await page.getByRole('button',{name:'Next scene',exact:true}).click();
   await page.waitForFunction(()=>window.navigationTest.state().narrate===0&&!window.navigationTest.state().VideMode);
   await page.getByRole('button',{name:'Next scene',exact:true}).click();
   assert.equal(await page.locator('[data-selected-scene]').textContent(),'a0:b:saved');
   assert.equal(await page.locator('[data-spatial-authoring]').count(),0,'Old fallback should reproduce the empty Spatial editor');
   console.log('REPRODUCED pre-upgrade empty Spatial B-shot on '+width+'px');
   await go('');await page.getByLabel('Playable 3D scene proxy').waitFor();
   const before=await page.evaluate(()=>window.navigationTest.snapshot());
   const ids=['a0','a0:b:empty','a0:b:saved','a1','a1:b:saved','a1:b:empty'];
   const verify=async index=>{
    await page.waitForFunction(expected=>window.navigationTest.state().owner===expected&&window.navigationTest.state().narrate===2&&window.navigationTest.state().VideMode,ids[index]);
    await page.getByLabel('Playable 3D scene proxy').waitFor();
    assert.equal(await page.locator('[data-workstation]').getAttribute('data-owner'),ids[index]);
    const state=await page.evaluate(()=>window.navigationTest.state());assert.equal(state.index,index);assert.equal(state.startEdit,true);assert.equal(state.pristine,true,'Navigation altered saved scene content');
   };
   for(let index=1;index<ids.length;index++){await page.getByRole('button',{name:'Next scene',exact:true}).click();await verify(index);}
   for(let index=ids.length-2;index>=0;index--){await page.getByRole('button',{name:'Previous scene',exact:true}).click();await verify(index);}
   // Navigate away before a delayed scene read completes; it cannot replace the next owner.
   await page.evaluate(()=>window.navigationTest.go(2));await page.waitForFunction(()=>window.navigationTest.state().owner==='a0:b:saved');
   await page.evaluate(()=>window.navigationTest.go(4));await verify(4);await page.waitForTimeout(250);await verify(4);
   await page.getByRole('button',{name:'Images tab',exact:true}).click();await page.waitForFunction(()=>!window.navigationTest.state().VideMode);
   await page.getByRole('button',{name:'Previous scene',exact:true}).click();
   assert.equal((await page.evaluate(()=>window.navigationTest.state())).narrate,0,'Navigation overrode the intentional Images tab');
   await page.getByRole('button',{name:'Videos tab',exact:true}).click();await verify(3);
   assert.deepEqual(await page.evaluate(()=>window.navigationTest.snapshot()),before);
   assert.ok((await page.evaluate(()=>window.navigationTest.state().operations)).every(op=>op.action==='read'));
   fs.mkdirSync(path.join(root,'.tmp/spatial-edit-navigation'),{recursive:true});await page.screenshot({path:path.join(root,'.tmp/spatial-edit-navigation',width+'-scene.png')});
   await go('?flat');await page.getByRole('button',{name:'Next scene',exact:true}).click();
   await page.waitForFunction(()=>window.navigationTest.state().narrate===0&&!window.navigationTest.state().VideMode);
   assert.equal(await page.locator('[data-flat-workstation]').textContent(),'Images','Ordinary empty non-Spatial B-shot fallback changed');
   assert.deepEqual(errors,[]);console.log('PASS Spatial B-roll A/B navigation both directions, mode/scene ownership, delayed read, manual tab and ordinary fallback on '+width+'px');
   await context.close();
  }
 }finally{await browser.close();await server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
