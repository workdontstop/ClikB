import {createServer} from 'vite';
import {sceneAuthoringPreviewPlugin} from './scene-authoring-preview-config.mjs';
const server=await createServer({root:process.cwd(),configFile:false,plugins:[sceneAuthoringPreviewPlugin],cacheDir:'.tmp/scene-authoring-prototype/vite-integration',optimizeDeps:{entries:['scene-authoring-integration.html','scene-authoring-prototype.html']},esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port:5212,strictPort:true},logLevel:'warn'});
await server.listen();
console.log('Existing SpatialStudio integration preview: http://127.0.0.1:5212/scene-authoring-integration.html');
console.log('Engine diagnostics: http://127.0.0.1:5212/scene-authoring-prototype.html');
