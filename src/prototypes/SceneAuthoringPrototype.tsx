import {useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AuthoringHistory,PerformanceClock,applyAuthoringCommands,evaluateAuthoringDraft,prototypeUnitPose,restoreAuthoringDraft,samplePose,serializeAuthoringDraft,type AuthoringCommand,type PoseTarget,type SceneAuthoringDraft} from '../../server/src/sceneAuthoringPrototype';
import {legTargetCommands,makeSceneAuthoringFixture} from '../../server/src/sceneRigPrototype';
import {describeSceneCamera,type SceneCameraRig} from '../../server/src/sceneCameraPrototype';
import type {MotionKey,MotionVec3} from '../../server/src/motionGuidePlan';
import {worldAtState,type SpatialWorld} from '../../server/src/spatialWorld';
import {creationDriveStep,type CreationRotationMode} from '../spatialCreationDrive';
import SceneAuthoringCanvas from './SceneAuthoringCanvas';
import {exportPrototypeMp4} from './sceneAuthoringStudio';
import './sceneAuthoringPrototype.css';

type Recording={base:SceneAuthoringDraft;draft:SceneAuthoringDraft;commands:AuthoringCommand[]};
function App(){
    const history=useRef(new AuthoringHistory(makeSceneAuthoringFixture())),[draft,setDraft]=useState(history.current.current),[time,setTime]=useState(0),[playing,setPlaying]=useState(false),[recording,setRecording]=useState(false);
    const [selection,setSelection]=useState<PoseTarget>({objectId:'actor'}),[mode,setMode]=useState<'translate'|'rotate'|'scale'>('translate'),[shot,setShot]=useState(false),[move,setMove]=useState<'jump'|'roll'|'crouch'>('roll'),[rotationMode,setRotationMode]=useState<CreationRotationMode>(null),[speed,setSpeed]=useState(1),[follow,setFollow]=useState(true),[message,setMessage]=useState('Local prototype · no model calls'),[exporting,setExporting]=useState(false);
    const clock=useRef(new PerformanceClock(5)),take=useRef<Recording|null>(null),inputs=useRef(new Set<string>()),id=useRef(0),saved=useRef('');
    const latest=useRef({draft,time,playing,selection,rotationMode,speed});latest.current={draft,time,playing,selection,rotationMode,speed};
    const report=(error:unknown)=>setMessage(error instanceof Error?error.message:String(error));
    const commit=(commands:AuthoringCommand[])=>{
        try{
            if(take.current){const next=applyAuthoringCommands(take.current.draft,take.current.draft.revision,commands);take.current.commands.push(...commands);take.current.draft=next;setDraft(next);}
            else setDraft(history.current.commit(commands));
            setMessage('Edit saved to the current draft.');
        }catch(error){report(error);}
    };
    const finishTake=()=>{
        clock.current.pause();setRecording(false);
        const work=take.current;take.current=null;
        if(work){try{setDraft(work.commands.length?history.current.commit(work.commands,work.base.revision):work.base);setMessage(work.commands.length?'Performance retained as one undoable take.':'Timing retained; add a pose, camera change or move to this take.');}catch(error){report(error);}}
    };
    const commitRef=useRef(commit),finishRef=useRef(finishTake);commitRef.current=commit;finishRef.current=finishTake;
    useEffect(()=>{
        const keydown=(event:KeyboardEvent)=>{if((event.target as HTMLElement).closest('input,select,textarea'))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d','q','e'].includes(event.key)){event.preventDefault();inputs.current.add(event.key);}};
        const keyup=(event:KeyboardEvent)=>inputs.current.delete(event.key),clear=()=>inputs.current.clear();
        window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',clear);
        let previous=performance.now(),sampled=0,raf=0;
        const tick=(now:number)=>{
            const delta=Math.min(.05,(now-previous)/1000);previous=now;const c=latest.current;
            if(clock.current.recording){
                const at=clock.current.advance(delta);setTime(at);sampled+=delta;
                const held=inputs.current,x=Number(held.has('ArrowRight')||held.has('d'))-Number(held.has('ArrowLeft')||held.has('a')),y=Number(held.has('ArrowUp')||held.has('w'))-Number(held.has('ArrowDown')||held.has('s')),vertical=Number(held.has('e'))-Number(held.has('q'));
                if((x||y||vertical)&&sampled>=.09&&take.current){
                    try{
                        const live=take.current.draft,frame=evaluateAuthoringDraft(live,at),selected=live.plan.objects.find(o=>o.id===c.selection.objectId&&o.role==='actor')?.id||Object.keys(live.rigs)[0];
                        const rig=live.rigs[selected],world:SpatialWorld={version:2,revision:String(live.revision),sourceImage:'',prompt:'',model:'luna',plan:live.plan,controlledObject:selected,primarySubjectName:selected,drivenName:selected,controlMode:rig?.kind==='wheeled'||rig?.kind==='rotor'?'vehicle':'character',motionStyle:'',walkable:[],obstacles:[],initialState:live.sourceState,approved:true,locomotion:{kind:rig?.kind==='rotor'?'air':'ground',vertical:true,speed:1.4,turnRate:2.5}};
                        const resolved=worldAtState(world,frame.state),object=live.plan.objects.find(o=>o.id===resolved.controlledObject)!;
                        const pose=creationDriveStep(resolved,frame.state,samplePose(object,at),{x,y,active:Boolean(x||y)},sampled,{vertical,speedMultiplier:c.speed,rotationMode:c.rotationMode});
                        commitRef.current([{kind:'pose',target:{objectId:object.id},time:at,pose,holdTail:true}]);
                    }catch(error){report(error);}
                    sampled=0;
                }
                if(!clock.current.recording)finishRef.current();
            }else if(c.playing){const at=Math.min(c.draft.plan.duration,c.time+delta);setTime(at);if(at===c.draft.plan.duration)setPlaying(false);}
            raf=requestAnimationFrame(tick);
        };raf=requestAnimationFrame(tick);
        return()=>{cancelAnimationFrame(raf);window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',clear);};
    },[]);
    // A small read-only diagnostic hook supports independent browser verification.
    useEffect(()=>{Object.assign(window,{clikbAuthoringPrototype:{snapshot:()=>JSON.parse(serializeAuthoringDraft(latest.current.draft)),evaluate:(at:number)=>evaluateAuthoringDraft(latest.current.draft,at),exportMp4:()=>exportPrototypeMp4(latest.current.draft,()=>{})}});return()=>{delete (window as Window&{clikbAuthoringPrototype?:unknown}).clikbAuthoringPrototype;};},[]);

    const chooseFixture=(kind:'state'|'creatures'|'vehicles')=>{if(recording)finishTake();setPlaying(false);const value=makeSceneAuthoringFixture(kind);history.current=new AuthoringHistory(value);setDraft(value);setSelection({objectId:Object.keys(value.rigs)[0]});setTime(0);setMessage('Parametric recipe fixture loaded.');};
    const frame=evaluateAuthoringDraft(draft,time),object=frame.plan.objects.find(o=>o.id===selection.objectId)!,part=selection.partId?object?.parts?.find(p=>p.id===selection.partId):object;
    const pose=part?.keys[0]||prototypeUnitPose(),camera=frame.plan.camera[0],rig=draft.rigs[selection.objectId];
    const editPose=(target:PoseTarget,value:MotionKey)=>commit([{kind:'pose',target,time:latest.current.time,pose:value}]);
    const trigger=()=>commit([{kind:'move',at:time,move:{id:`move_${++id.current}`,objectId:selection.objectId,kind:move,duration:move==='roll'?.8:1}}]);
    const addTravel=()=>{const raw=draft.plan.objects.find(o=>o.id===selection.objectId);if(!raw)return;const end=JSON.parse(JSON.stringify(raw.keys[0]))as MotionKey;end.position[2]+=3;commit([{kind:'pose',target:{objectId:raw.id},time:5,pose:end},{kind:'locomotion',objectId:raw.id,enabled:true}]);};
    const drop=()=>{
        if(!frame.plan.objects.some(o=>o.id==='sword'))return;
        commit([{kind:'event',event:{id:`drop_${++id.current}`,kind:'detach',objectId:'sword',time,landing:{time:Math.min(5,time+.7),position:[-1,.09,1.2]}}}]);
    };
    const mount=()=>commit([{kind:'event',event:{id:`mount_${++id.current}`,kind:'attach',objectId:'actor',time,parent:{objectId:'mount',partId:'saddle'},relation:'riding',localPose:prototypeUnitPose([0,.05,0])}}]);
    const setCameraRig=(kind:string)=>{
        if(kind==='free'){commit([{kind:'cameraRig'}]);return;}
        const target={objectId:selection.objectId,...(selection.partId?{partId:selection.partId}:{...(rig?.controls.chest?{partId:rig.controls.chest}:{})})},focalLengthMm=draft.cameraRig?.focalLengthMm||35;
        let value:SceneCameraRig;
        if(kind==='mounted')value={kind,target,focalLengthMm,offset:[0,.15,1.5],lookOffset:[0,.15,0]};
        else if(kind==='orbit')value={kind,target,focalLengthMm,radius:5,height:1.5,turns:1};
        else if(kind==='overhead')value={kind,target,focalLengthMm,height:7,heading:0};
        else if(kind==='zolly')value={kind,target,focalLengthMm,startDistance:4,endDistance:10,height:0};
        else value={kind:'crash',target,focalLengthMm:24,endFocalLengthMm:135,startTime:1,zoomDuration:.18};
        commit([{kind:'cameraRig',rig:value}]);setShot(true);
    };
    const bindHold=(key:string)=>({onPointerDown:(event:React.PointerEvent<HTMLButtonElement>)=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);inputs.current.add(key);},onPointerUp:()=>inputs.current.delete(key),onPointerCancel:()=>inputs.current.delete(key),onLostPointerCapture:()=>inputs.current.delete(key)});
    const save=()=>{saved.current=serializeAuthoringDraft(draft);localStorage.setItem('clikb.sceneAuthoring.prototype',saved.current);setMessage('Saved locally, including events, locks and the original source state.');};
    const restore=()=>{try{const value=restoreAuthoringDraft(saved.current||localStorage.getItem('clikb.sceneAuthoring.prototype')||'');history.current=new AuthoringHistory(value);setDraft(value);setSelection({objectId:Object.keys(value.rigs)[0]});setTime(0);setPlaying(false);setMessage('Saved authoring document restored.');}catch(error){report(error);}};
    const download=async()=>{setExporting(true);try{const file=await exportPrototypeMp4(draft,p=>setMessage(`Exporting clean MP4 ${p}%`));const url=URL.createObjectURL(file),link=document.createElement('a');link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('Clean MP4 exported with the same timed-state evaluator.');}catch(error){report(error);}finally{setExporting(false);}};
    return <main className="authoring-app">
        <header><div className="brand">clikB<span>SCENE LAB</span></div><div className="header-note"><i/>FOUNDATION PROTOTYPE</div><div className="header-actions"><button onClick={save}>Save draft</button><button disabled={recording} onClick={restore}>Restore</button><button className="primary" disabled={exporting||recording} onClick={()=>void download()}>{exporting?'Exporting…':'Export MP4 ↗'}</button></div></header>
        <div className="workspace-layout">
            <aside className="library"><p className="eyebrow">PARAMETRIC FOUNDATIONS</p><h1>A stage for<br/>every idea.</h1><p className="subtle">Shared forms. Distinct subjects.<br/>Direct control over the performance.</p>
                <div className="fixture-list"><button onClick={()=>chooseFixture('state')}><b>01</b><span>Character & world state<small>Articulated figure · prop · mount</small></span></button><button onClick={()=>chooseFixture('creatures')}><b>02</b><span>Two creature identities<small>One recipe · different scale & color</small></span></button><button onClick={()=>chooseFixture('vehicles')}><b>03</b><span>Mechanical performers<small>Shaped car · helicopter · controls</small></span></button></div>
                <p className="eyebrow">SCENE ENTITIES</p><div className="entity-list">{draft.plan.objects.map(o=><button key={o.id} className={selection.objectId===o.id?'selected':''} onClick={()=>setSelection({objectId:o.id})}><span className="swatch" style={{background:o.subjectColor||'#d8e8f7'}}/>{o.id.replaceAll('_',' ')}<small>{o.role}</small></button>)}</div>
                <div className="library-footer">LOCAL DRAFT · ZERO PROVIDER CALLS<br/>Studio fixtures are authored examples.</div>
            </aside>
            <section className="center-stage"><div className="viewport-toolbar"><div><span className="live-dot"/>SCENE / {draft.sourceKey.split(':').at(-1)?.toUpperCase()}</div><div className="segments">{(['translate','rotate','scale']as const).map(value=><button key={value} className={mode===value?'active':''} onClick={()=>setMode(value)}>{value}</button>)}<button className={shot?'active':''} onClick={()=>setShot(!shot)}>Shot camera</button></div></div>
                <div className="viewport"><SceneAuthoringCanvas draft={draft} time={time} selection={selection} mode={mode} shot={shot} onSelect={setSelection} onPose={editPose} onError={setMessage}/>{shot&&<div className="shot-frame"><span>SHOT CAMERA · CLEAN OUTPUT</span></div>}<div className="viewport-caption">WHITE / ICE BLUE<span>1 m studio grid</span></div><div className="scene-label">{selection.objectId.replaceAll('_',' ')}{selection.partId&&` / ${selection.partId}`}</div></div>
                <div className="transport"><button className={recording?'record active':'record'} onClick={()=>{if(recording)finishTake();else{setPlaying(false);clock.current.start(time>=5?0:time);take.current={base:history.current.current,draft:history.current.current,commands:[]};setRecording(true);setMessage('Recording time, including stationary performance.');}}}>{recording?'■ Finish take':'● Record'}</button><button onClick={()=>{if(recording)finishTake();if(time>=5)setTime(0);setPlaying(!playing);}}>{playing?'Pause':'Play'}</button><button disabled={recording} onClick={()=>setDraft(history.current.undo())}>Undo</button><button disabled={recording} onClick={()=>setDraft(history.current.redo())}>Redo</button><strong data-testid="time">{time.toFixed(2)}<span> / 5.00 s</span></strong></div>
                <label className="timeline"><span>PERFORMANCE TIME</span><input aria-label="Performance time" type="range" min="0" max="5" step=".01" value={time} disabled={recording} onChange={e=>{setPlaying(false);setTime(Number(e.target.value));}}/></label>
                <div className="timeline-events">{draft.moves.map(item=><span key={item.id}>{item.kind} · {item.start.toFixed(2)}s</span>)}{draft.events.map(item=><span key={item.id}>{item.kind} {item.objectId} · {item.time.toFixed(2)}s</span>)}</div>
                <div role="status" className="status-line">{message}</div>
            </section>
            <aside className="inspector"><p className="eyebrow">DIRECT MANIPULATION</p><h2>{selection.objectId.replaceAll('_',' ')}</h2><label>Control<select aria-label="Selected control" value={selection.partId||''} onChange={e=>setSelection({objectId:selection.objectId,...(e.target.value?{partId:e.target.value}:{})})}><option value="">Whole entity</option>{object?.parts?.map(p=><option key={p.id} value={p.id}>{p.id}</option>)}</select></label>
                {(['position','rotation','scale']as const).map(channel=><div className="vector-field" key={channel}><span>{channel}{channel==='rotation'?' (rad)':''}</span><div>{pose[channel].map((value,axis)=><label key={axis}>{['X','Y','Z'][axis]}<input aria-label={`${channel} ${['X','Y','Z'][axis]}`} type="number" step=".05" value={Number(value.toFixed(3))} onChange={e=>{const next=JSON.parse(JSON.stringify(pose))as MotionKey;next[channel][axis]=Number(e.target.value);editPose(selection,next);}}/></label>)}</div></div>)}
                <div className="button-row"><button onClick={()=>commit([{kind:'lock',target:selection,time,channels:['position','rotation','scale']}])}>Pin pose here</button><button onClick={()=>commit([{kind:'unlock',target:selection,time}])}>Unpin</button></div>
                <p className="eyebrow">LIVE PERFORMANCE</p><div className="drive-pad"><button {...bindHold('w')}>↑</button><div><button {...bindHold('a')}>←</button><button {...bindHold('s')}>↓</button><button {...bindHold('d')}>→</button></div></div><div className="button-row"><button {...bindHold('e')}>Rise ↑</button><button {...bindHold('q')}>Descend ↓</button></div><small>Hold controls while recording · WASD / Q E</small>
                <label>Drive axis<select aria-label="Drive axis" value={rotationMode||'travel'} onChange={e=>setRotationMode(e.target.value==='travel'?null:e.target.value as CreationRotationMode)}><option value="travel">Travel</option><option value="horizontal">Horizontal yaw</option><option value="vertical">Pitch / root bend</option><option value="roll">Roll</option></select></label><label>Speed · {speed.toFixed(2)}×<input aria-label="Drive speed" type="range" min=".25" max="3" step=".25" value={speed} onChange={e=>setSpeed(Number(e.target.value))}/></label>
                <div className="button-row"><button disabled={!rig} onClick={addTravel}>Add travel + stride</button><button disabled={!rig} onClick={()=>commit([{kind:'locomotion',objectId:selection.objectId,enabled:!draft.locomotion.includes(selection.objectId)}])}>Toggle live rig</button></div>
                <label>Configurable move<select aria-label="Move binding" value={move} onChange={e=>setMove(e.target.value as typeof move)}><option value="roll">Roll</option><option value="jump">Jump</option><option value="crouch">Crouch</option></select></label><button className="move-button" disabled={!rig} onClick={trigger}>Trigger {move} ↗</button>
                {rig?.legLengths&&<><p className="eyebrow">LOCAL LEG ASSIST</p><label className="check"><input type="checkbox" checked={follow} onChange={e=>setFollow(e.target.checked)}/>Follow limb / counter-swing</label><button onClick={()=>{try{commit(legTargetCommands(draft,selection.objectId,'left',time,[-rig.halfHipWidth!,.25,.35]as MotionVec3,follow));setSelection({objectId:selection.objectId,partId:'left_hip'});}catch(error){report(error);}}}>Solve a forward step</button></>}
                {draft.sourceKey.endsWith(':state')&&<><p className="eyebrow">TIMED WORLD STATE</p><div className="button-row"><button onClick={drop}>Drop sword</button><button onClick={mount}>Mount</button></div><button onClick={()=>commit([{kind:'event',event:{id:`dismount_${++id.current}`,time,kind:'detach',objectId:'actor'}}])}>Release rider · preserve pose</button></>}
                <p className="eyebrow">SHOT CAMERA</p><label>Camera rig<select aria-label="Camera rig" value={draft.cameraRig?.kind||'free'} onChange={e=>setCameraRig(e.target.value)}><option value="free">Authored camera</option><option value="mounted">Body-mounted SnorriCam</option><option value="orbit">360° orbit</option><option value="overhead">Zenith overhead</option><option value="zolly">Dolly zoom</option><option value="crash">Crash zoom</option></select></label>
                <div className="lens-pills">{[9,16,24,35,50,85,135].map(mm=><button key={mm} className={draft.cameraRig?.focalLengthMm===mm?'selected':''} onClick={()=>commit([{kind:'cameraRig',rig:draft.cameraRig?{...draft.cameraRig,focalLengthMm:mm}:{kind:'free',focalLengthMm:mm}}])}>{mm} mm</button>)}</div><small>{camera.fov.toFixed(1)}° vertical · 36 × 24 mm sensor · 16:9 crop</small>
                <label>Field of view<input aria-label="Camera FOV" type="range" min="15" max="100" step="1" value={Math.max(15,Math.min(100,camera.fov))} onChange={e=>commit([{kind:'cameraRig'},{kind:'camera',time,camera:{...draft.plan.camera[0],fov:Number(e.target.value)}}])}/></label><label>Camera roll<input aria-label="Camera roll" type="range" min="-1" max="1" step=".05" value={camera.roll||0} onChange={e=>commit([{kind:'camera',time,camera:{...draft.plan.camera[0],roll:Number(e.target.value)}}])}/></label>
                {draft.cameraRig&&<details><summary>Matching camera direction</summary><p>{describeSceneCamera(draft.cameraRig)}</p></details>}
                <details><summary>Evaluated state · revision {draft.revision}</summary><pre data-testid="state">{JSON.stringify({relationships:frame.state.relationships,attachments:Object.fromEntries(frame.plan.objects.filter(o=>o.attachment).map(o=>[o.id,o.attachment])),moves:draft.moves.length,locks:draft.locks.length},null,2)}</pre></details>
            </aside>
        </div>
    </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
