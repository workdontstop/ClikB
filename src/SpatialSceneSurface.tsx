import {useEffect,useLayoutEffect,useRef} from "react";
import * as THREE from "three";
import { loadSpatialImage } from './spatialImageLoader';

/** One renderer per mounted player; changing nodes only replaces the texture. */
export default function SpatialSceneSurface({frameUrl,frameKey,retryKey=0,video,onError,onReady,objectFit="contain"}:{frameUrl:string;frameKey?:string;retryKey?:number;video:HTMLVideoElement|null;onError:(message:string)=>void;onReady?:(frameUrl:string)=>void;objectFit?:"contain"|"cover"}) {
 const host=useRef<HTMLDivElement>(null);
 const displayed=useRef<THREE.Texture|null>(null);
 const engine=useRef<{material:THREE.MeshBasicMaterial;resize:(aspect?:number)=>void;render:()=>void;readyFrameUrl?:string}|null>(null);
 const fit=useRef(objectFit); fit.current=objectFit;
 const report=useRef(onError); report.current=onError;
 const reportReady=useRef(onReady); reportReady.current=onReady;
 useEffect(()=>{
  const element=host.current!;
  let renderer:THREE.WebGLRenderer;
  try {renderer=new THREE.WebGLRenderer({antialias:true});} catch {report.current("WebGL is unavailable on this device.");return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  // A new opaque WebGL canvas has no scene yet. Keep the loading cover visible
  // until a texture has actually been rendered, rather than covering it in black.
  renderer.domElement.style.visibility="hidden";
  element.appendChild(renderer.domElement);
  const world=new THREE.Scene(); const camera=new THREE.OrthographicCamera(-1,1,1,-1,0.1,10);camera.position.z=1;
  const material=new THREE.MeshBasicMaterial({color:0xffffff});
  const geometry=new THREE.PlaneGeometry(2,2);const plane=new THREE.Mesh(geometry,material);plane.visible=false;world.add(plane);
  let aspect=1;
  const resize=(next=aspect)=>{aspect=next;const w=Math.max(1,element.clientWidth),h=Math.max(1,element.clientHeight);renderer.setSize(w,h);const view=w/h;const scale=fit.current==="cover" ? Math.max : Math.min;plane.scale.set(scale(1,aspect/view),scale(1,view/aspect),1);plane.visible=Boolean(material.map);};
  let painted=false;
  const render=()=>{renderer.render(world,camera);if(!painted && material.map){painted=true;renderer.domElement.style.visibility="visible";}};
  engine.current={material,resize,render};
  const observer=new ResizeObserver(()=>resize());observer.observe(element);resize();
  renderer.setAnimationLoop(render);
  return ()=>{observer.disconnect();renderer.setAnimationLoop(null);engine.current=null;displayed.current?.dispose();displayed.current=null;material.dispose();geometry.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
 },[]);
 useEffect(()=>{
  const current=engine.current;if(!current)return;
  let disposed=false;let texture:THREE.Texture|null=null;
  const assign=(next:THREE.Texture,aspect:number)=>{if(disposed){next.dispose();return;}displayed.current?.dispose();displayed.current=next;texture=next;texture.colorSpace=THREE.SRGBColorSpace;current.material.map=texture;current.material.needsUpdate=true;current.resize(aspect);current.render();current.readyFrameUrl=video ? undefined : frameUrl;reportReady.current?.(frameUrl);};
  const ready=()=>{if(!video || disposed)return;assign(new THREE.VideoTexture(video),video.videoWidth/Math.max(1,video.videoHeight));};
  if(video){if(video.readyState>=2)ready();else video.addEventListener("loadeddata",ready,{once:true});}
  else void loadSpatialImage(frameUrl).then(image=>{
    if(disposed)return;
    const next=new THREE.Texture(image);next.needsUpdate=true;
    assign(next,image.naturalWidth/Math.max(1,image.naturalHeight));
  }).catch(()=>{if(!disposed)report.current("The stage image could not load.");});
  return ()=>{disposed=true;video?.removeEventListener("loadeddata",ready);};
 },[frameUrl,video,retryKey]);
 // Different nodes can share the same decoded image. A new arrival still
 // completes its handoff, without loading that image or replacing its texture.
 useLayoutEffect(()=>{
  const current=engine.current;
  if(!video && current?.readyFrameUrl===frameUrl){current.render();reportReady.current?.(frameUrl);}
 },[frameKey,frameUrl,video]);
 useEffect(()=>{engine.current?.resize();},[objectFit]);
 return <div ref={host} data-spatial-appearance-frame={frameUrl} style={{position:"absolute",inset:0}} />;
}
