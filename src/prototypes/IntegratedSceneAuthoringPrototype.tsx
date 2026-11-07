/** Actual production SpatialStudio, hosted locally with fixture data and no provider calls. */
import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import axios from 'axios';
import SpatialStudio from '../components/SpatialStudio';
import type {SpatialSceneState} from '../spatialStageModel';
import {cloneWorld,validateWorld} from '../../server/src/spatialWorld';
import {makeSceneAuthoringFixture} from '../../server/src/sceneRigPrototype';

const query=new URLSearchParams(location.search);
const aspect=query.get('aspect')==='16:9'?'16:9':query.get('aspect')==='1:1'?'1:1':'9:16';
const kind=query.get('fixture')==='creatures'?'creatures':query.get('fixture')==='vehicles'?'vehicles':'state';
const draft=makeSceneAuthoringFixture(kind),plan=cloneWorld(draft.plan);
if(aspect==='9:16')for(const camera of plan.camera){camera.position=[8,6,14];camera.target=[.8,1,0];camera.fov=43;}
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960"><rect width="540" height="960" fill="#edf5fc"/></svg>');
const world=validateWorld({version:2,model:'luna',revision:'isolated-native-preview',sourceImage:image,aspectRatio:aspect,plan,controlledObject:draft.sourceState.controlledObject,controlMode:draft.sourceState.controlMode,walkable:[{min:[-12,0,-12],max:[12,3,12]}],obstacles:[],approved:true});
const initial:SpatialSceneState={sceneId:'native-authoring-preview',activeNodeId:'root',nodes:[{id:'root',label:'Start',frameUrl:image}],connections:[],draftMovement:null,ledger:{version:2,world,states:{root:world.initialState},routes:{},jobs:[],epoch:0,generationStarted:false,boardOpen:false,view:'three'}};
let saved={scene:initial,revision:1};
axios.defaults.adapter=async config=>{
    if(!config.url?.includes('/local-preview/spatial-world/document'))throw new Error('This local preview has no generation service.');
    const body=JSON.parse(String(config.data||'{}'));
    if(body.action==='save')saved={scene:body.scene,revision:saved.revision+1};
    else if(body.action==='view')Object.assign(saved.scene.ledger!,body.view?{view:body.view}:{},body.boardOpen!==undefined?{boardOpen:body.boardOpen}:{});
    else if(body.action!=='read')throw new Error('Provider operations are disabled in this local preview.');
    return{data:cloneWorld(saved),status:200,statusText:'OK',headers:{},config};
};
const store=configureStore({reducer:(state={settings:{appColorDark:'#c5d83e',appColorLight:'#4059cc',spatialControlMode:'dpad',spatialViewerHoverActive:false},profile:{loggedUser:{id:1}}})=>state});
const reject=async()=>{throw new Error('Uploads are disabled in the local integration preview.');};

function IntegratedPreview(){
    const [scene,setScene]=useState(initial),[expanded,setExpanded]=useState(false);
    const [model,setModel]=useState('SeedanceMini'),[resolution,setResolution]=useState('480p');
    return <Provider store={store}>
        <style>{`*{box-sizing:border-box}html,body,#root{margin:0;min-height:100%;font-family:Arial,sans-serif;background:#0e1116;color:#f1f4f9}main{min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:18px;gap:14px}header{width:min(1040px,100%);display:flex;align-items:center;gap:12px;font-size:13px}header strong{font-size:22px}header span{color:#a9b7ca;margin-right:auto}header a,header button{font:inherit;color:inherit;background:#202834;border:1px solid #435064;border-radius:999px;padding:9px 13px;text-decoration:none;cursor:pointer}.native-media{position:relative;overflow:hidden;border-radius:22px;flex:none;background:#edf5fc;box-shadow:0 14px 65px #0005}.native-media.expanded{position:fixed;inset:0;margin:auto;border-radius:0;z-index:100}.exit-expand{position:absolute;top:15px;right:15px;z-index:40000;width:40px;height:40px;border:2px solid #fff;border-radius:50%;background:#19202cc9;color:#fff;cursor:pointer;font-size:20px}.preview-note{font-size:12px;color:#a9b7ca;max-width:620px;text-align:center;line-height:1.5}@media(max-width:600px){main{padding:8px;gap:9px}header{flex-wrap:wrap}header span{font-size:11px}.preview-note{margin:0}}`}</style>
        <main>
            <header><strong>clikB</strong><span>Existing SpatialStudio · local integration preview</span><a href="?aspect=9:16">9:16</a><a href="?aspect=16:9">16:9</a><a href="?aspect=1:1">1:1</a><button onClick={()=>setExpanded(true)}>Expand</button></header>
            <section data-native-preview data-aspect={aspect} className={'native-media'+(expanded?' expanded':'')} style={{width:expanded?`min(100vw, calc(100vh * ${aspect.replace(':',' / ')}))`:aspect==='9:16'?'min(100%, 420px, calc((100vh - 130px) * 9 / 16))':aspect==='1:1'?'min(100%, 760px, calc(100vh - 130px))':'min(100%, 1040px, calc((100vh - 130px) * 16 / 9))',aspectRatio:aspect.replace(':',' / '),...(expanded?{top:'50%',left:'50%',right:'auto',bottom:'auto',transform:'translate(-50%,-50%)'}:{})}}>
                {expanded&&<button className="exit-expand" aria-label="Close expanded preview" onClick={()=>setExpanded(false)}>×</button>}
                <SpatialStudio scene={scene} stages={[]} postId={-500} api="/local-preview" appColor="#c5d83e" oppositeAppColor="#4059cc" darkMode prompt="Rehearse the scene" duration={5} model={model} resolution={resolution} onModelChange={setModel} onResolutionChange={setResolution} aspect={aspect} audio={false} update={updater=>setScene(updater)} navigate={()=>false} uploadVideo={reject} uploadFrame={reject} extractEnd={reject} dispatch={store.dispatch}/>
            </section>
            <p className="preview-note">The viewport, pills, movement controls and settings below come from the existing SpatialStudio component. This fixture previews the new scene presentation; the new authoring commands are still in the separate engine harness.</p>
        </main>
    </Provider>;
}
createRoot(document.getElementById('root')!).render(<IntegratedPreview/>);
