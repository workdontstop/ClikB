/** Shared image-space arrow for the editor overlay and model reference images. */
export function spatialArrowGeometry(width: number, height: number, origin: {x:number;y:number}, direction: {x:number;y:number}) {
  const magnitude = Math.hypot(direction.x, direction.y);
  const x = Math.max(0, Math.min(width, origin.x));
  const y = Math.max(0, Math.min(height, origin.y));
  const ux = magnitude ? direction.x / magnitude : 0;
  const uy = magnitude ? -direction.y / magnitude : 0;
  const limitX = ux > 0 ? (width-x)/ux : ux < 0 ? -x/ux : Infinity;
  const limitY = uy > 0 ? (height-y)/uy : uy < 0 ? -y/uy : Infinity;
  const length = magnitude ? Math.max(0, Math.min(Math.min(width,height)*0.34,limitX,limitY)) : 0;
  const tip = {x:x+ux*length,y:y+uy*length};
  const head = Math.min(12*Math.max(width,height)/256,length*0.4);
  return {start:{x,y},tip,length,
    left:{x:tip.x-ux*head-uy*head*0.5,y:tip.y-uy*head+ux*head*0.5},
    right:{x:tip.x-ux*head+uy*head*0.5,y:tip.y-uy*head-ux*head*0.5}};
}
