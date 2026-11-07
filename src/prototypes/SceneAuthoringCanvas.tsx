import {useEffect,useRef} from 'react';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {applyAuthoringCommands, type PoseTarget, type SceneAuthoringDraft} from '../../server/src/sceneAuthoringPrototype';
import type {MotionKey} from '../../server/src/motionGuidePlan';
import {createPrototypeStudio} from './sceneAuthoringStudio';

type Props={draft:SceneAuthoringDraft;time:number;selection:PoseTarget;mode:'translate'|'rotate'|'scale';shot:boolean;onSelect:(target:PoseTarget)=>void;onPose:(target:PoseTarget,pose:MotionKey)=>void;onError:(message:string)=>void};
export default function SceneAuthoringCanvas(props:Props){
    const host=useRef<HTMLDivElement>(null),current=useRef(props);current.current=props;
    useEffect(()=>{
        const element=host.current!;const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','Interactive Three.js authoring scene');element.append(canvas);
        const studio=createPrototypeStudio(canvas,current.current.draft,960,540);
        const inspection=new THREE.PerspectiveCamera(43,16/9,.05,500);inspection.position.copy(studio.view.camera.position);
        const orbit=new OrbitControls(inspection,canvas);orbit.target.set(...current.current.draft.plan.camera[0].target);orbit.enableDamping=true;orbit.maxDistance=45;orbit.minDistance=1.5;
        const transform=new TransformControls(inspection,canvas);transform.setSize(.8);
        const helper=transform.getHelper(),proxy=new THREE.Object3D();studio.view.scene.add(proxy,helper);
        const crossGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.16,0,0),new THREE.Vector3(.16,0,0),new THREE.Vector3(0,-.16,0),new THREE.Vector3(0,.16,0),new THREE.Vector3(0,0,-.16),new THREE.Vector3(0,0,.16)]);
        const crossMaterial=new THREE.LineBasicMaterial({color:'#4c9dcb',depthTest:false});const cross=new THREE.LineSegments(crossGeometry,crossMaterial);cross.renderOrder=10;studio.view.scene.add(cross);
        let dragging=false,pending:SceneAuthoringDraft|undefined,lastPose:MotionKey|undefined,raf=0,disposed=false;
        const selectionNode=()=>{const s=current.current.selection;return s.partId?studio.view.parts.get(s.objectId)?.get(s.partId):studio.view.roots.get(s.objectId);};
        transform.addEventListener('dragging-changed',event=>{dragging=Boolean(event.value);orbit.enabled=!dragging&&!current.current.shot;if(dragging){pending=undefined;lastPose=undefined;}else if(lastPose){current.current.onPose(current.current.selection,lastPose);pending=undefined;lastPose=undefined;}});
        transform.addEventListener('objectChange',()=>{
            const c=current.current,node=selectionNode();if(!node)return;
            const parentInverse=node.parent?.matrixWorld.clone().invert()||new THREE.Matrix4();proxy.updateMatrixWorld(true);
            const local=parentInverse.multiply(proxy.matrixWorld),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();local.decompose(position,rotation,scale);
            const euler=new THREE.Euler().setFromQuaternion(rotation);
            lastPose={t:c.time,position:position.toArray(),rotation:[euler.x,euler.y,euler.z],scale:scale.toArray()};
            try{pending=applyAuthoringCommands(c.draft,c.draft.revision,[{kind:'pose',target:c.selection,time:c.time,pose:lastPose}]);}catch(error){lastPose=undefined;pending=undefined;c.onError((error as Error).message);}
        });
        let down={x:0,y:0};canvas.addEventListener('pointerdown',event=>{down={x:event.clientX,y:event.clientY};});
        const pick=(event:PointerEvent)=>{
            if(dragging||transform.axis||Math.hypot(event.clientX-down.x,event.clientY-down.y)>5)return;
            const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),current.current.shot?studio.view.camera:inspection);
            for(const hit of ray.intersectObjects([...studio.view.roots.values()],true)){
                let node:THREE.Object3D|null=hit.object;while(node&&!studio.view.roots.has(node.name))node=node.parent;
                if(!node)continue;const object=current.current.draft.plan.objects.find(o=>o.id===node!.name)!;
                const part=object.parts?.find(p=>p.id===hit.object.name);current.current.onSelect({objectId:object.id,...(part?{partId:part.parentId||part.id}:{})});break;
            }
        };canvas.addEventListener('pointerup',pick);
        let viewportWidth=960,viewportHeight=540;
        const resize=()=>{const w=Math.max(1,element.clientWidth),h=Math.max(1,element.clientHeight);viewportWidth=w;viewportHeight=h;studio.renderer.setSize(w,h,false);studio.view.camera.aspect=w/h;studio.view.camera.updateProjectionMatrix();inspection.aspect=w/h;inspection.updateProjectionMatrix();const fw=Math.min(w*.88,h*.86*16/9),fh=fw*9/16;const parent=element.parentElement!;parent.style.setProperty('--shot-left',`${(w-fw)/2}px`);parent.style.setProperty('--shot-top',`${(h-fh)/2}px`);parent.style.setProperty('--shot-width',`${fw}px`);parent.style.setProperty('--shot-height',`${fh}px`);};
        const observer=new ResizeObserver(resize);observer.observe(element);resize();
        const draw=()=>{
            if(disposed)return;const c=current.current;
            try{
                helper.visible=!c.shot;transform.enabled=!c.shot;cross.visible=!c.shot;
                studio.renderer.setViewport(0,0,viewportWidth,viewportHeight);studio.renderer.setScissorTest(false);
                studio.view.camera.aspect=c.shot?16/9:viewportWidth/viewportHeight;studio.view.camera.updateProjectionMatrix();
                studio.draw(pending||c.draft,c.time,inspection);
                transform.camera=inspection;transform.setMode(c.mode);
                orbit.enabled=!c.shot&&!dragging;orbit.update();
                const node=selectionNode();
                if(node&&!dragging){node.matrixWorld.decompose(proxy.position,proxy.quaternion,proxy.scale);proxy.updateMatrixWorld();if(transform.object!==proxy)transform.attach(proxy);}
                cross.visible=Boolean(node)&&!c.shot;if(node)cross.position.setFromMatrixPosition(node.matrixWorld);
                if(c.shot){const width=Math.min(viewportWidth*.88,viewportHeight*.86*16/9),height=width*9/16,left=(viewportWidth-width)/2,bottom=(viewportHeight-height)/2;studio.renderer.setViewport(left,bottom,width,height);studio.renderer.setScissor(left,bottom,width,height);studio.renderer.setScissorTest(true);studio.renderer.render(studio.view.scene,studio.view.camera);studio.renderer.setScissorTest(false);}else studio.renderer.render(studio.view.scene,inspection);
            }catch(error){c.onError((error as Error).message);}
            raf=requestAnimationFrame(draw);
        };raf=requestAnimationFrame(draw);
        return()=>{disposed=true;cancelAnimationFrame(raf);observer.disconnect();canvas.removeEventListener('pointerup',pick);transform.dispose();orbit.dispose();crossGeometry.dispose();crossMaterial.dispose();studio.dispose();canvas.remove();};
    },[props.draft.sourceKey]);
    return <div className="scene-canvas" ref={host}/>;
}
