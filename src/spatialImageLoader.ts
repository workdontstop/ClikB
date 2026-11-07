import {spatialLog,mediaUrlLabel} from "./spatialDiagnostics";
const images=new Map<string,Promise<HTMLImageElement>>();
/** Decode an origin-clean frame once, with bounded retries and actual fetch diagnostics. */
export function loadSpatialImage(url:string):Promise<HTMLImageElement> {
 const existing=images.get(url);if(existing)return existing;
 const promise=(async()=>{
  for(let attempt=1;attempt<=3;attempt++) {
   const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),20000);
   let blobUrl="";
   try {
    spatialLog("frame.load",{url:mediaUrlLabel(url),attempt});
    const response=await fetch(url,{signal:controller.signal,mode:"cors",cache:attempt===1 ? "default":"reload"});
    spatialLog("frame.response",{url:mediaUrlLabel(url),attempt,status:response.status,type:response.type,contentType:response.headers.get("content-type")});
    if(!response.ok)throw new Error(`Frame HTTP ${response.status}`);
    const blob=await response.blob();if(!blob.size)throw new Error("Empty frame response");
    blobUrl=URL.createObjectURL(blob);const image=new Image();image.src=blobUrl;await image.decode();
    spatialLog("frame.ready",{url:mediaUrlLabel(url),width:image.naturalWidth,height:image.naturalHeight,attempt});return image;
   } catch(error) {
    spatialLog("frame.failed",{url:mediaUrlLabel(url),attempt,name:(error as Error).name,message:(error as Error).message});
    if(attempt===3)throw error;
    await new Promise(resolve=>setTimeout(resolve,attempt*400));
   } finally {clearTimeout(timeout);if(blobUrl)URL.revokeObjectURL(blobUrl);}
  }
  throw new Error("Frame unavailable");
 })();images.set(url,promise);void promise.catch(()=>{if(images.get(url)===promise)images.delete(url);});
 if(images.size>16)images.delete(images.keys().next().value!);
 return promise;
}
