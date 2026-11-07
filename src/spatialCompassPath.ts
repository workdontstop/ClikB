import { PerspectiveCamera, Vector3 } from "three";
import { spatialArrowGeometry } from "./spatialArrowGeometry";
import type { SpatialCapturedTrail, SpatialMovementSample } from "./spatialStageModel";

// Experimental visual only. Set false to restore the original straight arrow.
export const USE_COMPASS_PATH = true;
export function spatialCompassPath(width:number,height:number,origin:{x:number;y:number},samples:SpatialMovementSample[],returnPath=false,capturedTrail?:SpatialCapturedTrail) {
  const fallback=spatialArrowGeometry(width,height,origin,samples.at(-1) || {x:0,y:0});
  if(!USE_COMPASS_PATH || !samples.length)return {...fallback,points:[fallback.start,fallback.tip]};
  // Same camera, trail height and motion integration as ThreeSpatialOverlay.
  const camera=new PerspectiveCamera(42,width/height,0.1,100);
  camera.position.set(0,3.4,6.8);camera.lookAt(0,0,-1.5);camera.updateMatrixWorld();
  const segments=samples.map((sample,i)=>({sample,seconds:Math.max(0,(sample.elapsedMs-(samples[i-1]?.elapsedMs || 0))/1000)}));
  if(returnPath)segments.reverse();
  const project=(x:number,z:number)=>{
    const point=new Vector3(x,-1.18,z);
    if(point.clone().applyMatrix4(camera.matrixWorldInverse).z>=-0.1)return null;
    point.project(camera);return {x:(point.x+1)*width/2,y:(1-point.y)*height/2};
  };
  const base=project(0,0)!;
  const offsets=[{x:0,y:0}];let x=0,z=0;
  for(const {sample,seconds} of segments){
    x+=sample.x*sample.radius*1.65*seconds;
    z-=sample.y*sample.radius*1.65*seconds;
    const point=project(x,z);if(!point)break;
    offsets.push({x:point.x-base.x,y:point.y-base.y});
  }
  // Uniformly fit the whole trail, preserving its projected bends and origin.
  let scale=1;
  for(const p of offsets){
    if(p.x>0)scale=Math.min(scale,(width-fallback.start.x)/p.x);
    if(p.x<0)scale=Math.min(scale,-fallback.start.x/p.x);
    if(p.y>0)scale=Math.min(scale,(height-fallback.start.y)/p.y);
    if(p.y<0)scale=Math.min(scale,-fallback.start.y/p.y);
  }
  let points=offsets.map(p=>({x:fallback.start.x+p.x*scale,y:fallback.start.y+p.y*scale}));
  if(capturedTrail && capturedTrail.points.length > 1 && !returnPath) {
    // Match the image's contain fit inside the original overlay viewport.
    const fit=Math.min(capturedTrail.width/width,capturedTrail.height/height);
    const left=(capturedTrail.width-width*fit)/2,top=(capturedTrail.height-height*fit)/2;
    const captured=capturedTrail.points.map(p=>({x:(p.x*capturedTrail.width-left)/fit,y:(p.y*capturedTrail.height-top)/fit}));
    // Find the nearest point on the route, then join a short distance ahead.
    // Discard only the obsolete lead-in below/behind the selected character.
    let nearest=0,best=Infinity;
    for(let i=0;i<captured.length;i++) {
      const d=Math.hypot(captured[i].x-origin.x,captured[i].y-origin.y);
      if(d<best){best=d;nearest=i;}
    }
    let join=nearest,advance=0;
    while(join<captured.length-1 && advance<best*0.35) {
      advance+=Math.hypot(captured[join+1].x-captured[join].x,captured[join+1].y-captured[join].y);join++;
    }
    const end=captured[join];
    const before=captured[Math.max(0,join-1)],after=captured[Math.min(captured.length-1,join+1)];
    const tx=after.x-before.x,ty=after.y-before.y,len=Math.hypot(tx,ty)||1;
    const distance=Math.hypot(end.x-origin.x,end.y-origin.y);
    // Limit the tangent handle so it cannot send the connector behind its start.
    const along=((end.x-origin.x)*tx+(end.y-origin.y)*ty)/len;
    const handle=Math.max(0,Math.min(distance/3,along*0.5));
    const c1={x:origin.x+(end.x-origin.x)/3,y:origin.y+(end.y-origin.y)/3};
    const c2={x:end.x-tx/len*handle,y:end.y-ty/len*handle};
    points=Array.from({length:17},(_,i)=>{const t=i/16,u=1-t;return {
      x:u*u*u*origin.x+3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*end.x,
      y:u*u*u*origin.y+3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*end.y
    };}).concat(captured.slice(join+1));
  }

  let previous=points[0];const tip=points.at(-1)!;
  for(let i=points.length-2;i>=0;i--){if(Math.hypot(tip.x-points[i].x,tip.y-points[i].y)>0.01){previous=points[i];break;}}
  const dx=tip.x-previous.x,dy=tip.y-previous.y,magnitude=Math.hypot(dx,dy);
  const length=points.reduce((sum,p,i)=>i ? sum+Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y):sum,0);
  if(length<0.01)return {...fallback,points:[fallback.start,fallback.tip]};
  const ux=magnitude ? dx/magnitude : 0,uy=magnitude ? dy/magnitude : 0;
  const head=Math.min(12*Math.max(width,height)/256,length*0.4);
  return {start:fallback.start,tip,length,points,
    left:{x:tip.x-ux*head-uy*head*0.5,y:tip.y-uy*head+ux*head*0.5},
    right:{x:tip.x-ux*head+uy*head*0.5,y:tip.y-uy*head-ux*head*0.5}};
}
