import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import SpatialSceneSurface from '../src/SpatialSceneSurface';
const image = (color: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${color}"/></svg>`)}`;
function Host() {
 const [frame, setFrame] = useState({ color: '#ff0000', key: 'root' });
 (window as any).surfaceTest = { setFrame, events: (window as any).surfaceTest?.events || [] };
 return <div style={{ position: 'relative', width: 320, height: 320 }}>
  <SpatialSceneSurface frameUrl={image(frame.color)} frameKey={frame.key} video={null} onError={message => { throw new Error(message); }} onReady={() => {
   const canvas=document.querySelector('canvas')!, gl=canvas.getContext('webgl2')!, rgba=new Uint8Array(4);
   gl.readPixels(canvas.width/2,canvas.height/2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
   (window as any).surfaceTest.events.push({ key: frame.key, color: frame.color, rgba: [...rgba] });
  }} />
 </div>;
}
createRoot(document.getElementById('root')!).render(<Host />);
