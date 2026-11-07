type Entry = {time:string;event:string;details:Record<string,unknown>};
const entries:Entry[]=[];
export function spatialLog(event:string,details:Record<string,unknown>={}) {
 const entry={time:new Date().toISOString(),event,details};entries.push(entry);if(entries.length>400)entries.shift();
 console.info("[Spatial] "+JSON.stringify(entry));
}
export function mediaUrlLabel(url:string) {try {const u=new URL(url,location.href);return u.protocol==="blob:" ? "blob:local" : u.origin+u.pathname;}catch{return "invalid-url";}}
if(typeof window!=="undefined") (window as any).__spatialDiagnostics={entries:()=>entries.slice(),export:()=>JSON.stringify(entries,null,2)};
