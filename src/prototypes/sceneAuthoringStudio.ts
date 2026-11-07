import * as THREE from 'three';
import { createMotionScene } from '../motionScene';
import { evaluateAuthoringDraft, type SceneAuthoringDraft } from '../../server/src/sceneAuthoringPrototype';
import type { MotionPlan } from '../motionGuide';

/** Isolated presentation. No production palette or renderer defaults change. */
export function createPrototypeStudio(canvas:HTMLCanvasElement,draft:SceneAuthoringDraft,width:number,height:number,initialize=true){
    const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
    renderer.setPixelRatio(1);renderer.setSize(width,height,false);renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
    const view=createMotionScene(draft.plan,width/height,false);
    const materials=new Map<THREE.Material,THREE.MeshStandardMaterial>();
    const rim=new THREE.DirectionalLight(0xb5dbff,1.4);rim.position.set(5,5,-6);view.scene.add(rim);
    view.scene.traverse(node=>{
        if(node instanceof THREE.HemisphereLight)node.intensity=1.6;
        if(node instanceof THREE.DirectionalLight&&node!==rim){node.intensity=3;node.castShadow=true;node.shadow.mapSize.set(1024,1024);node.shadow.camera.left=-14;node.shadow.camera.right=14;node.shadow.camera.top=14;node.shadow.camera.bottom=-14;node.shadow.normalBias=.035;}
    });
    const decorate=()=>{
        view.scene.background=new THREE.Color('#edf5fc');
        for(const root of view.roots.values())root.traverse(node=>{
            if(node instanceof THREE.LineSegments){const material=node.material as THREE.LineBasicMaterial;material.opacity=.12;}
            if(!(node instanceof THREE.Mesh))return;
            node.castShadow=node.name!=='ground';node.receiveShadow=true;
            const old=node.material as THREE.MeshLambertMaterial;
            if(old instanceof THREE.MeshStandardMaterial)return;
            if(!materials.has(old)){
                const material=new THREE.MeshStandardMaterial({color:old.color||'#edf5fc',roughness:.72,metalness:.025});
                if(old.userData.physicalGrid){
                    material.color.set('#eef5ff');
                    material.onBeforeCompile=shader=>{
                        shader.vertexShader='varying vec3 studioWorld; varying vec3 studioNormal;\n'+shader.vertexShader;
                        shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nstudioWorld=(modelMatrix*vec4(transformed,1.0)).xyz;studioNormal=normalize(mat3(modelMatrix)*normal);');
                        shader.fragmentShader='varying vec3 studioWorld; varying vec3 studioNormal;\n'+shader.fragmentShader;
                        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
                            float tile=mod(floor(studioWorld.x)+floor(studioWorld.z),2.0);
                            vec3 tileColor=mix(vec3(0.955,0.975,1.0),vec3(0.40,0.65,0.90),tile);
                            vec2 p=studioWorld.xz*5.0;
                            vec2 edge=abs(fract(p-0.5)-0.5)/max(fwidth(p),vec2(0.0001));
                            float line=1.0-min(1.0,min(edge.x,edge.y));
                            float fade=1.0-smoothstep(8.0,24.0,distance(studioWorld.xz,cameraPosition.xz));
                            float top=smoothstep(0.7,0.95,studioNormal.y);
                            diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(0.92,0.96,1.0),tileColor,fade)*mix(1.0,0.83,line*fade),top);`);
                    };
                    material.customProgramCacheKey=()=> 'clikb-prototype-white-blue-grid-v1';
                }
                materials.set(old,material);
            }
            node.material=materials.get(old)!;
        });
    };
    const draw=(current:SceneAuthoringDraft,time:number,camera?:THREE.Camera)=>{
        const frame=evaluateAuthoringDraft(current,time);view.draw(0,frame.plan);
        const shot=frame.plan.camera[0]as typeof frame.plan.camera[number]&{up?:[number,number,number]};
        view.camera.up.set(...(shot.up||[0,1,0]));view.camera.lookAt(...shot.target);if(shot.roll)view.camera.rotateZ(shot.roll);
        view.camera.fov=shot.fov;view.camera.updateProjectionMatrix();decorate();renderer.render(view.scene,camera||view.camera);return frame;
    };
    const drawLegacy=(time:number,plan:MotionPlan=draft.plan)=>{view.draw(time,plan);decorate();renderer.render(view.scene,view.camera);};
    if(initialize)draw(draft,0);
    let disposed=false;
    return{renderer,view,draw,drawLegacy,dispose(){if(disposed)return;disposed=true;materials.forEach(material=>material.dispose());view.dispose();renderer.dispose();renderer.forceContextLoss();}};
}

export async function exportPrototypeMp4(draft:SceneAuthoringDraft,onProgress:(value:number)=>void,aspect:'16:9'|'9:16'|'1:1'='16:9'):Promise<File>{
    const {Output,Mp4OutputFormat,BufferTarget,CanvasSource,Quality,canEncodeVideo}=await import('mediabunny');
    const [width,height]=aspect==='9:16'?[540,960]:aspect==='1:1'?[720,720]:[960,540],fps=30,quality=new Quality({bitrate:3_000_000});
    const exportDraft=draft.cameraRig?{...draft,cameraRig:{...draft.cameraRig,aspect:width/height}}:draft;
    if(!await canEncodeVideo('avc',{width,height,frameRate:fps,quality}))throw new Error('This prototype requires browser AVC encoding for MP4 export; the draft is retained.');
    const canvas=document.createElement('canvas'),studio=createPrototypeStudio(canvas,exportDraft,width,height);
    const output=new Output({format:new Mp4OutputFormat(),target:new BufferTarget()});
    try{
        const source=new CanvasSource(canvas,{codec:'avc',quality});output.addVideoTrack(source,{frameRate:fps});await output.start();
        const count=Math.round(draft.plan.duration*fps);
        for(let i=0;i<count;i++){studio.draw(exportDraft,i===count-1?draft.plan.duration:i/fps);await source.add(i/fps,1/fps,{keyFrame:i%fps===0});onProgress(Math.round((i+1)/count*100));if(i%6===0)await new Promise<void>(resolve=>setTimeout(resolve,0));}
        await output.finalize();return new File([output.target.buffer!],'clikb-scene-prototype.mp4',{type:'video/mp4'});
    }finally{if(output.state!=='finalized'&&output.state!=='canceled')await output.cancel();studio.dispose();}
}
