const ts=require('typescript'),path=require('node:path'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const root=process.cwd(),ref='696df9c';
const oldPaths=new Set(execFileSync('git',['ls-tree','-r','--name-only',ref],{encoding:'utf8'}).trim().split('\n'));
const replacements=new Map();
for(const file of execFileSync('git',['diff','--name-only',ref,'--','src','server/src'],{encoding:'utf8'}).trim().split('\n')){
 if(/\.tsx?$/.test(file)&&oldPaths.has(file))replacements.set(path.resolve(file).toLowerCase(),execFileSync('git',['show',ref+':'+file],{encoding:'utf8',maxBuffer:20*1024*1024}));
}
const config=ts.readConfigFile('tsconfig.app.json',ts.sys.readFile);const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,root);
function check(baseline){const host=ts.createCompilerHost(parsed.options),read=host.readFile;
 if(baseline)host.readFile=file=>replacements.get(path.resolve(file).toLowerCase())??read(file);
 const program=ts.createProgram(parsed.fileNames.filter(file=>!baseline||oldPaths.has(path.relative(root,file).replaceAll('\\','/'))),{...parsed.options,noEmit:true},host);
 return ts.getPreEmitDiagnostics(program).map(d=>({file:d.file?path.relative(root,d.file.fileName).replaceAll('\\','/'):'config',code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,' ')}));}
const baseline=check(true);fs.writeFileSync('.tmp/concierge-execution/baseline-type-diagnostics.json',JSON.stringify(baseline,null,2));
const current=check(false),keys=new Set(baseline.map(d=>JSON.stringify(d))),introduced=current.filter(d=>!keys.has(JSON.stringify(d)));
const report={baseline:baseline.length,current:current.length,introduced};fs.writeFileSync('.tmp/concierge-execution/type-comparison.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));process.exitCode=introduced.length?1:0;
