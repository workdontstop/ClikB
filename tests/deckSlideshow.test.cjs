const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..');

// Evaluate the entire production component and real settings reducer with a
// deterministic hook/DOM/timer harness. No browser, server, network or provider
// runs here. Browser geometry and native gesture verification remain separate.
function harness({hasMore=true,paginate='next',error=null}={}){
 let now=0,nextTimer=0,currentHook=0,dirty=true,rendering=false,mounted=true,tree;
 const timers=new Map(),hooks=[],pendingEffects=[],modules=new Map(),media=[];
 const listeners=()=>{const events=new Map();return {addEventListener:(type,listener)=>{if(!events.has(type))events.set(type,new Set());events.get(type).add(listener);},removeEventListener:(type,listener)=>events.get(type)?.delete(listener),emit:(type,event)=>{for(const listener of [...(events.get(type)||[])])listener(event);}};};
 const document={hidden:false,...listeners(),elementFromPoint:()=>null};
 const window={...listeners()};
 const depsEqual=(one,two)=>one&&two&&one.length===two.length&&one.every((value,index)=>Object.is(value,two[index]));
 const react={
  useState(initial){const index=currentHook++;if(!hooks[index])hooks[index]={kind:'state',value:typeof initial==='function'?initial():initial};const set=value=>{if(!mounted)return;const next=typeof value==='function'?value(hooks[index].value):value;if(!Object.is(next,hooks[index].value)){hooks[index].value=next;dirty=true;}};return [hooks[index].value,set];},
  useRef(initial){const index=currentHook++;if(!hooks[index])hooks[index]={kind:'ref',value:{current:initial}};return hooks[index].value;},
  useMemo(factory,deps){const index=currentHook++;if(!hooks[index]||!depsEqual(hooks[index].deps,deps))hooks[index]={kind:'memo',value:factory(),deps};return hooks[index].value;},
  useCallback(callback,deps){return react.useMemo(()=>callback,deps);},
  useEffect(effect,deps){const index=currentHook++;const previous=hooks[index];if(!previous||!depsEqual(previous.deps,deps)){hooks[index]={kind:'effect',deps,cleanup:previous?.cleanup};pendingEffects.push({index,effect});}},
 };
 react.useLayoutEffect=react.useEffect;
 const clock={setTimeout(callback,delay=0){const id=++nextTimer;timers.set(id,{due:now+delay,callback});return id;},clearTimeout:id=>timers.delete(id)};
 class FakeDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const elements=new Map(),elementKeys=new Map();
 const element=(name='div')=>{const attributes=new Map();return {tagName:name.toUpperCase(),isConnected:true,...listeners(),querySelectorAll:()=>[],querySelector:()=>null,getBoundingClientRect:()=>({top:0,bottom:800,left:0,right:1200}),getAttribute:key=>attributes.get(key)??null,setAttribute:(key,value)=>attributes.set(key,value),removeAttribute:key=>attributes.delete(key),setPointerCapture:()=>{},hasPointerCapture:()=>false,releasePointerCapture:()=>{},clientWidth:1000,
  ...(name==='video'?{muted:true,volume:1,loop:false,paused:true,play(){this.paused=false;media.push(['play',this.muted]);this.emit('playing',{});return Promise.resolve();},pause(){this.paused=true;media.push(['pause',this.muted]);this.emit('pause',{});},load(){media.push(['load']);}}:{})};};
 const jsx=(type,props,key)=>({type,props:props||{},key});
 let state,snapshot,paginations=0,selected=[],component,settingsModule;
 const dispatch=action=>{if(action.type==='fixture/publish')snapshot=action.payload;else if(action.type==='fixture/remove')snapshot=undefined;else{state={...state,settings:settingsModule.default(state.settings,action)};dirty=true;}};
 const redux={useSelector:selector=>selector(state),useDispatch:()=>dispatch};
 function load(file){
  file=path.resolve(file);if(modules.has(file))return modules.get(file).exports;
  const module={exports:{}};modules.set(file,module);
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const localRequire=name=>{
   if(name==='react')return react;if(name==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:'fragment'};if(name==='react-redux')return redux;
   if(name.endsWith('/brainstormSlice')||name==='./brainstormSlice')return {publishFeedsArea:payload=>({type:'fixture/publish',payload}),removeFeedsArea:payload=>({type:'fixture/remove',payload})};
   if(name.endsWith('.css'))return {};
   if(name==='./AutoControlPill')return {default:()=>null};
   if(name==='./creationDrafts/actions')return {CreationDraftAction:()=>null};
   if(name.startsWith('.')){const target=path.resolve(path.dirname(file),name);return load(fs.existsSync(target+'.ts')?target+'.ts':target+'.tsx');}
   return require(name);
  };
  const context={module,exports:module.exports,require:localRequire,console,document,window,Date:FakeDate,performance:{now:()=>now},setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout,requestAnimationFrame:callback=>clock.setTimeout(callback,16),cancelAnimationFrame:clock.clearTimeout,innerWidth:1200,innerHeight:800};
  vm.runInNewContext(code,context,{filename:file});return module.exports;
 }
 settingsModule=load(path.join(root,'src/settingsSlice.ts'));
 state={settings:settingsModule.default(undefined,{type:'fixture/init'}),profile:{loggedUser:null}};
 component=load(path.join(root,'src/DeckOverlay.tsx')).default;
 const posts=base=>Array.from({length:28},(_,index)=>({id:base+index+1,mode:0,username:'fixture',finalTitle:'Story '+(base+index+1),finalOverview:'Summary '+index,...(index===0?{videoUrl:'/mock.mp4'}:{})}));
 const props={cards:posts(0),activePostId:1,category:'all',loading:false,hasMore,error,onSelectPost:id=>{selected.push(id);props.activePostId=id;dirty=true;},onPlay:()=>{},onCategory:()=>{},onClose:()=>{},onCreate:()=>unmount(),onDockHost:()=>{},isMenuOpen:false,
  onPaginate:()=>{paginations++;props.loading=true;dirty=true;return new Promise((resolve,reject)=>{clock.setTimeout(()=>{if(paginate==='reject'){props.loading=false;props.error='Fixture error';dirty=true;reject(Error('Fixture pagination failed'));return;}if(paginate==='next'){props.cards=posts(28);props.activePostId=29;props.hasMore=false;}props.loading=false;dirty=true;resolve();},80);});}};
 function walk(node,callback){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(child=>walk(child,callback));return;}callback(node);walk(node.props?.children,callback);}
 function detach(ref,target){if(typeof ref==='function')ref(null);else ref.current=null;target.isConnected=false;elements.delete(ref);elementKeys.delete(ref);}
 function attach(){const nodes=[];walk(tree,node=>{if(node.props?.ref)nodes.push(node);});const activeRefs=new Set(nodes.map(node=>node.props.ref));for(const [ref,target]of [...elements])if(!activeRefs.has(ref))detach(ref,target);for(const node of nodes){const ref=node.props.ref;let target=elements.get(ref);if(target&&node.type==='video'&&elementKeys.get(ref)!==node.key){detach(ref,target);target=null;}if(!target){target=element(node.type);elements.set(ref,target);elementKeys.set(ref,node.key);if(node.type==='video'){if(node.props.src)target.setAttribute('src',node.props.src);target.muted=Boolean(node.props.muted);}}if(typeof ref==='function')ref(target);else ref.current=target;}}
 function flush(){if(rendering||!mounted)return;rendering=true;let count=0;while(dirty){assert.ok(count++<80,'Hook harness render loop');dirty=false;currentHook=0;tree=component(props);attach();while(pendingEffects.length){const {index,effect}=pendingEffects.shift();hooks[index].cleanup?.();hooks[index].cleanup=effect();}}rendering=false;}
 async function settle(){for(let index=0;index<8;index++){await Promise.resolve();flush();}}
 async function advance(ms){const target=now+ms;await settle();let count=0;while(true){let next;for(const [id,timer]of timers)if(timer.due<=target&&(!next||timer.due<next[1].due))next=[id,timer];if(!next)break;assert.ok(count++<2000,'Timer harness loop');now=next[1].due;timers.delete(next[0]);next[1].callback();await settle();}now=target;await settle();}
 function action(name){let result;walk(tree,node=>{if(node.props?.['data-ai-action']==='clikb.feeds.deck.action.'+name)result=node;});assert.ok(result,'Mounted action '+name);return result;}
 function click(name){const target=action(name);assert.equal(Boolean(target.props.disabled),false,'Enabled action '+name);const eventTarget={closest:selector=>selector.includes('clikb.feeds.deck.action.'+name)?{}:null};for(const [ref,owner]of elements)if(ref?.current===owner)owner.emit('click',{target:eventTarget});target.props.onClick?.({stopPropagation:()=>{}});flush();}
 function unmount(){if(!mounted)return;mounted=false;for(const hook of hooks)if(hook?.kind==='effect')hook.cleanup?.();for(const owner of elements.values())owner.isConnected=false;}
 flush();return {click,action,advance,settle,unmount,area:()=>snapshot,tree:()=>tree,state:()=>state,video:()=>[...elements.values()].find(node=>node.tagName==='VIDEO'),metrics:()=>({paginations,selected:[...selected],timers:timers.size,media:[...media]}),setProps:patch=>{Object.assign(props,patch);dirty=true;flush();},mute:value=>{state={...state,settings:settingsModule.default(state.settings,settingsModule.setPlaybackMuted(value))};dirty=true;flush();},visibility:hidden=>{document.hidden=hidden;document.emit('visibilitychange',{});flush();}};
}

test('shared Redux mute persists between cards and actual snapshot follows fullscreen preference',async()=>{
 const app=harness();await app.settle();assert.equal(app.area().state.muted,true);const initialVideo=app.video();app.click('toggle_mute');assert.equal(app.state().settings.fullscreenMute,false);assert.equal(app.area().state.muted,false);assert.equal(initialVideo.muted,false);assert.equal(initialVideo.paused,false);
 app.click('cycle_next');assert.equal(initialVideo.paused,true);assert.equal(initialVideo.muted,true);assert.equal(initialVideo.getAttribute('src'),null);app.click('cycle_prev');await app.settle();assert.equal(app.state().settings.fullscreenMute,false);assert.equal(app.area().state.muted,false);assert.equal(app.video().muted,false);assert.equal(app.video().paused,false);
 app.mute(true);assert.equal(app.area().state.muted,true);assert.equal(app.state().settings.fullscreenMute,true);app.unmount();
});
test('slideshow defaults off, advances after twelve seconds, manual controls stop until restarted',async()=>{
 const app=harness();assert.equal(app.area().state.slideshowActive,false);await app.advance(12000);assert.equal(app.area().state.activePostId,1);
 app.click('select_category');app.click('toggle_slideshow');assert.equal(app.area().state.slideshowActive,true);await app.advance(11999);assert.equal(app.area().state.activePostId,1);await app.advance(1);assert.equal(app.area().state.activePostId,2);
 app.click('cycle_next');assert.equal(app.area().state.activePostId,3);assert.equal(app.area().state.slideshowActive,false);await app.advance(24000);assert.equal(app.area().state.activePostId,3);
 app.click('select_category');app.click('toggle_slideshow');await app.advance(12000);assert.equal(app.area().state.activePostId,4);app.unmount();
});
test('last card paginates once, resumes new collection then loops when exhausted',async()=>{
 const app=harness();app.setProps({activePostId:28});app.click('select_category');app.click('toggle_slideshow');await app.advance(12000);assert.equal(app.metrics().paginations,1);assert.equal(app.area().state.loading,true);
 await app.advance(80);assert.equal(app.area().state.activePostId,29);assert.equal(app.area().state.slideshowActive,true);await app.advance(12000);assert.equal(app.area().state.activePostId,30);
 app.setProps({activePostId:56});await app.advance(12000);assert.equal(app.area().state.activePostId,29);assert.equal(app.metrics().paginations,1);assert.equal(app.area().state.slideshowActive,true);app.unmount();
});
test('failed or unchanged pagination stops safely without request spam',async()=>{
 for(const paginate of ['reject','unchanged']){const app=harness({paginate});app.setProps({activePostId:28});app.click('select_category');app.click('toggle_slideshow');await app.advance(12000);await app.advance(80);await app.advance(1500);assert.equal(app.area().state.slideshowActive,false);await app.advance(48000);assert.equal(app.metrics().paginations,1);app.unmount();}
});
test('hidden Deck pauses, visible Deck restarts full delay; Create disposes pending slideshow callbacks',async()=>{
 const app=harness();app.click('select_category');app.click('toggle_slideshow');await app.advance(6000);app.visibility(true);await app.advance(24000);assert.equal(app.area().state.activePostId,1);assert.equal(app.area().state.slideshowActive,true);app.visibility(false);await app.advance(11999);assert.equal(app.area().state.activePostId,1);await app.advance(1);assert.equal(app.area().state.activePostId,2);
 app.setProps({activePostId:28});await app.advance(12000);assert.equal(app.metrics().paginations,1);app.click('open_create');await app.advance(24000);assert.equal(app.area(),undefined);assert.equal(app.metrics().paginations,1);assert.equal(app.metrics().timers,0);
});
test('Start closes selector; compact Slideshow label and capsule toggles preserve running dwell until explicit Pause',async()=>{
 const app=harness();const text=node=>Array.isArray(node)?node.map(text).join(''):typeof node==='string'||typeof node==='number'?String(node):node&&typeof node==='object'?text(node.props?.children):'';
 app.click('select_category');assert.equal(app.area().state.selectorOpen,true);app.click('toggle_slideshow');assert.equal(app.area().state.selectorOpen,false);assert.equal(app.area().state.slideshowActive,true);assert.equal(text(app.action('select_category')),'Slideshow');
 await app.advance(6000);app.click('select_category');assert.equal(app.area().state.selectorOpen,true);assert.equal(app.area().state.slideshowActive,true);await app.advance(3000);assert.equal(app.area().state.activePostId,1);app.click('select_category');assert.equal(app.area().state.selectorOpen,false);assert.equal(app.area().state.slideshowActive,true);assert.equal(text(app.action('select_category')),'Slideshow');
 await app.advance(3000);assert.equal(app.area().state.activePostId,2);app.click('select_category');app.click('toggle_slideshow');assert.equal(app.area().state.slideshowActive,false);assert.match(text(app.action('select_category')),/All Feeds/);await app.advance(24000);assert.equal(app.area().state.activePostId,2);app.unmount();
});
