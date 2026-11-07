// In-process transport for existing production-component fixtures. It runs their
// source transforms and mock middleware, with no localhost or external network.
const fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events');
let current;
exports.createServer=async(options,fixture)=>{
 const root=options.root,plugins=options.plugins||[],middleware=[];
 const server={middlewares:{use:fn=>middleware.push(fn)},httpServer:{address:()=>({port:options.server.port})},listen:async()=>{},close:async()=>{}};
 for(const plugin of plugins)plugin.configureServer?.(server);
 const result=await require('esbuild').build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',
  loader:{'.css':'empty','.png':'dataurl','.svg':'dataurl','.jpg':'dataurl','.jpeg':'dataurl','.webp':'dataurl','.mp3':'dataurl','.mp4':'dataurl','.gif':'dataurl'},
  define:{'import.meta.env':'{}','import.meta.env.DEV':'true','import.meta.env.VITE_CLIK_URL':JSON.stringify('http://127.0.0.1:'+options.server.port),'import.meta.env.VITE_APPX_STATE':'"dev"','process.env.NODE_ENV':'"production"',...options.define},
  plugins:[{name:'fixture-source',setup(build){
   build.onResolve({filter:/.*/},args=>{
    for(const plugin of plugins){const value=plugin.resolveId?.(args.path,args.importer);if(typeof value==='string')return{path:value,namespace:'fixture-virtual'};}
    if(args.path.startsWith('/src/'))return{path:path.join(root,args.path)};
   });
   build.onLoad({filter:/.*/,namespace:'fixture-virtual'},args=>{for(const plugin of plugins){const contents=plugin.load?.(args.path);if(typeof contents==='string')return{contents,loader:'tsx',resolveDir:root};}});
   build.onLoad({filter:/\.[cm]?[jt]sx?$/},args=>{
    if(args.path.includes('node_modules'))return;
    let code=fs.readFileSync(args.path,'utf8');for(const plugin of plugins){const next=plugin.transform?.(code,args.path.replaceAll('\\','/'));if(typeof next==='string')code=next;}
    return{contents:code,loader:args.path.endsWith('x')?'tsx':'ts',resolveDir:path.dirname(args.path)};
   });
  }}],logLevel:'silent'});
 const script='<script>'+result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>';
 server.handle=async(request)=>{
  const req=new EventEmitter();req.resume=()=>{};Object.assign(req,{url:new URL(request.url()).pathname+new URL(request.url()).search,method:request.method(),headers:request.headers()});
  let headers={};let completed=false;
  return new Promise((resolve,reject)=>{
   const res={setHeader:(key,value)=>headers[key.toLowerCase()]=value,end:body=>{
    completed=true;let content=String(body||'');if(headers['content-type']?.includes('html'))content=content.replace(/<script\b[^>]*src=["'][^"']+["'][^>]*><\/script>/g,()=>script);
    resolve({status:200,headers,body:content});},statusCode:200};
   let index=0;const next=()=>{const fn=middleware[index++];if(!fn){completed=true;return resolve({status:404,contentType:'application/json',body:'{}'});}try{fn(req,res,next);}catch(e){reject(e);}};next();
   if(!completed)queueMicrotask(()=>{const body=request.postData();if(body)req.emit('data',body);req.emit('end');});
  });
 };
 current=server;return server;
};
exports.install=()=>{
 const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE||'../.tmp/concierge-browser-deps/node_modules/playwright');
 const launch=chromium.launch.bind(chromium);
 const patch=page=>{const register=page.route.bind(page);page.route=(pattern,handler,...rest)=>register(pattern,route=>{
  const proceed=route.continue.bind(route);route.continue=options=>/https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(route.request().url())?current.handle(route.request()).then(response=>route.fulfill(response)):proceed(options);
  return handler(route);
 },...rest);return page;};
 chromium.launch=async options=>{const browser=await launch({...options,executablePath:options?.executablePath||process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'}),newPage=browser.newPage.bind(browser),newContext=browser.newContext.bind(browser);
  browser.newPage=async options=>patch(await newPage(options));browser.newContext=async options=>{const context=await newContext(options),create=context.newPage.bind(context);context.newPage=async()=>patch(await create());return context;};return browser;};
};
