const assert=require('node:assert/strict');
const {build}=require('esbuild');
const {chromium}=require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root=require('node:path').resolve(__dirname,'..');
const fixture=`
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {BrowserRouter,useLocation} from 'react-router-dom';
import CreativeProfiles from './src/CreativeProfiles';
import {store} from './src/store';
import {setLoggedUser} from './src/profileSlice';
import {setAutoControlVisible,setAutoControl,setConciergeEnabled,setThemePreference} from './src/settingsSlice';
import {handleNavigationBrowserRequest,observeCurrentAppSnapshot} from './src/navigationBrowserControl';
const key=new URLSearchParams(location.search).get('case');
const member=key==='details'?101:7;
const owner=7;
store.dispatch(setLoggedUser({id:member,ownerId:owner,name:'User',biography:'Bio'}));
store.dispatch(setConciergeEnabled(true));store.dispatch(setAutoControlVisible({visible:true,actor:'user'}));store.dispatch(setAutoControl({enabled:true,actor:'user'}));
window.fixture={snapshot:observeCurrentAppSnapshot};
window.fixture.setTheme=theme=>store.dispatch(setThemePreference(theme));
const members=Array.from({length:100},(_,i)=>({id:101+i,username:'Child'+(101+i),image:''}));
window.fetch=async(input,init)=>{
 const url=String(input);
 if(url.includes('/navigation/browser-reply')){window.fixture.reply=JSON.parse(init.body).reply;return Response.json({ok:true});}
 if(url.includes('/catalogue'))return Response.json({main:{id:key==='visit'?8:7,username:'PairedMain',image:''},profiles:members,managed:key!=='settings',canCreate:key!=='visit'});
 if(url.includes('/username')){
  const mode=window.fixture.availabilityMode;
  if(mode==='failure')throw new TypeError('Failed to fetch');
  if(mode==='taken')return Response.json({available:false});
  if(mode==='slow')await new Promise(resolve=>setTimeout(resolve,700));
  return Response.json({available:true});
 }
 if(url.endsWith('/details')){window.fixture.saved=JSON.parse(init.body);return Response.json(window.fixture.saved);}
 if(url.includes('/creative-profiles')){
  window.fixture.mutation={path:url,method:init?.method,body:init?.body};
  if(init?.method==='DELETE' && window.fixture.blockRemoval)return Response.json({message:'Use this Creative Profile and delete its posts and saved drafts before removing it.'},{status:409});
  return new Promise(()=>{});
 }
 throw Error(url);
};
window.fixture.run=async (id,command='action',extras={})=>{
 const snapshot=observeCurrentAppSnapshot();
 await handleNavigationBrowserRequest({requestId:Math.random().toString(),command,[command==='scroll'?'scrollId':'actionId']:id,expectedVersion:snapshot.navigation.stateVersion,...extras},location.origin);
 return window.fixture.reply.status;
};
function App(){
 const [cover,setCover]=useState(null); const location=useLocation(); if(location.state?.userId)return null;
 return <><div ref={setCover}/><div style={{maxWidth:'100%',width:340}}>
 <CreativeProfiles surface={key==='settings'?'settings':'profile'} profileId={key==='settings'?7:101} coverActions={cover} pairedAvatar={cover} coverOnly={key!=='settings'}/></div></>;
}
createRoot(document.getElementById('root')).render(<Provider store={store}><BrowserRouter><App/></BrowserRouter></Provider>);
`;
(async()=>{
 const bundle=await build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'import.meta.env':JSON.stringify({VITE_CLIK_URL:'http://fixture.test'})},plugins:[{name:'draft',setup(b){b.onResolve({filter:/creationDrafts\/entry/},()=>({path:'draft',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const prepareDraftForProfileSwitch=async()=>{}'}));}}]});
 const html='<div id="root"></div><script>'+bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>';
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
 const page=await browser.newPage({viewport:{width:390,height:650}});page.setDefaultTimeout(4000);
 await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:html}));
 const settings='clikb.navigation.creative_profiles_settings';
 const cover='clikb.navigation.creative_profiles_cover';
 const available=async(id)=>page.waitForFunction(id=>window.fixture?.snapshot().navigation.availableActions.some(a=>a.actionId===id),id);
 const click=async(id)=>{await available(id);assert.equal(await page.evaluate(id=>window.fixture.run(id),id),'observed_change',id)};
 const type=async(id,text)=>{await available(id);assert.equal(await page.evaluate(({id,text})=>window.fixture.run(id,'text',{text}),{id,text}),'observed_change',id)};
 await page.goto('http://fixture.test/settings?case=settings');
 await available(settings+'.action.expand');
 assert.equal(await page.evaluate(settings=>window.fixture.snapshot().navigation.availableActions.some(a=>a.actionId===settings+'.action.profile_7'),settings),false);
 await click(settings+'.action.expand');
 assert.equal(await page.locator('[data-ai-action="'+settings+'.action.profile_101"]').count(),1);
 assert.equal(await page.locator('[data-ai-action="'+settings+'.action.delete_101"]').count(),1);
 const removeIcon = page.getByRole('button', {name:'Remove Child101',exact:true}).locator('svg');
 for(const [theme,color] of [['dark','rgb(255, 255, 255)'],['light','rgb(22, 22, 22)']]){
  await page.evaluate(theme=>window.fixture.setTheme(theme),theme);
  await page.waitForFunction(({id,color})=>getComputedStyle(document.querySelector('[data-ai-action="'+id+'"] svg')).color===color,{id:settings+'.action.delete_101',color});
 }
 assert.ok(await removeIcon.isVisible());
 assert.equal(await page.evaluate(settings=>window.fixture.snapshot().navigation.areas[settings].scrolls.list.canScrollForward,settings),true);
 await page.waitForTimeout(250); assert.equal(await page.evaluate(settings=>window.fixture.run(settings+':list','scroll',{direction:'forward'}),settings),'settled'); assert.equal(await page.evaluate(settings=>window.fixture.run(settings+':list','scroll',{direction:'backward'}),settings),'settled');
 await click(settings+'.action.delete_101');
 const removal = await page.evaluate(settings=>window.fixture.snapshot().navigation.availableActions.find(a=>a.actionId===settings+'.action.delete_submit'),settings);
 assert.equal(removal.targetId,101);
 assert.equal(removal.requiresConfirmation,true);
 await page.evaluate(()=>window.fixture.blockRemoval=true);
 await page.getByRole('button',{name:'Remove Creative Profile',exact:true}).click();
 await page.getByRole('alert').getByText(/delete its posts and saved drafts/).waitFor();
 await click(settings+'.action.close_dialog');
 await page.locator('[data-ai-scroll="'+settings+':row"]').evaluate(el=>el.scrollLeft=el.scrollWidth);
 await page.waitForTimeout(250); await click(settings+'.action.create');
 await page.evaluate(()=>window.fixture.availabilityMode='failure');
 await type(settings+'.action.username','journey');
 await page.getByText('The username check is unavailable. Try again.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Create Profile',exact:true}).last().isEnabled(),false);
 await page.evaluate(()=>window.fixture.availabilityMode='taken');
 await click(settings+'.action.retry_username');
 await page.getByText('Username is taken',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Create Profile',exact:true}).last().isEnabled(),false);
 await page.evaluate(()=>window.fixture.availabilityMode='slow');
 await type(settings+'.action.username','journey_new');
 await page.getByText('Checking username…',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Create Profile',exact:true}).last().isEnabled(),false);
 await page.getByText('Username available',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Create Profile',exact:true}).last().isEnabled(),true);
 await page.evaluate(()=>window.fixture.availabilityMode=undefined);
 await type(settings+'.action.username','FixtureNew');
 await available(settings+'.action.create_submit');
 assert.equal(await page.evaluate(settings=>window.fixture.snapshot().navigation.availableActions.find(a=>a.actionId===settings+'.action.create_submit').targetId,settings),'FixtureNew');
 assert.equal(await page.evaluate(settings=>window.fixture.run(settings+'.action.create_submit'),settings),'stale_or_unavailable');
 await click(settings+'.action.close_dialog');
 await page.goto('http://fixture.test/pages?case=visit');
 await available(cover+'.action.visit_main');
 assert.equal(await page.evaluate(cover=>window.fixture.snapshot().navigation.availableActions.find(a=>a.actionId===cover+'.action.visit_main').targetId,cover),8);
 await click(cover+'.action.visit_main');
 assert.equal(await page.evaluate(()=>history.state.usr.userId),8);
 await page.goto('http://fixture.test/pages?case=details');
 await click(cover+'.action.details');
 await type(cover+'.action.profile_name','Edited');
 await type(cover+'.action.profile_bio','Updated bio');
 await click(cover+'.action.save_details');
 assert.deepEqual(await page.evaluate(()=>window.fixture.saved),{name:'Edited',biography:'Updated bio'});
 await available(cover+'.action.main'); assert.equal(await page.evaluate(cover=>window.fixture.run(cover+'.action.main'),cover),'dispatched');
 assert.equal(await page.evaluate(()=>JSON.parse(window.fixture.mutation.body).memberId),7);
 await page.goto('http://fixture.test/pages?case=use');
 await available(cover+'.action.use');
 assert.equal(await page.evaluate(cover=>window.fixture.run(cover+'.action.use'),cover),'dispatched');
 assert.equal(await page.evaluate(()=>JSON.parse(window.fixture.mutation.body).memberId),101);
 await page.goto('http://fixture.test/settings?case=settings');
 await available(settings+'.action.profile_101');
 assert.equal(await page.evaluate(settings=>window.fixture.run(settings+'.action.profile_101'),settings),'dispatched');
 assert.equal(await page.evaluate(()=>JSON.parse(window.fixture.mutation.body).memberId),101);
 await page.goto('http://fixture.test/settings?case=settings');
 await click(settings+'.action.expand'); await click(settings+'.action.delete_101'); await available(settings+'.action.delete_submit');
 assert.equal(await page.evaluate(settings=>window.fixture.run(settings+'.action.delete_submit'),settings),'stale_or_unavailable');
 assert.equal(await page.evaluate(settings=>window.fixture.run(settings+'.action.delete_submit','action',{confirmedTargetId:102}),settings),'stale_or_unavailable');
 assert.equal(await page.evaluate(settings=>window.fixture.run(settings+'.action.delete_submit','action',{confirmedTargetId:101}),settings),'dispatched');
 assert.deepEqual(await page.evaluate(()=>[window.fixture.mutation.method,new URL(window.fixture.mutation.path).pathname]),['DELETE','/creative-profiles/101']);
 await page.goto('http://fixture.test/settings?case=settings');
 await available(settings+'.action.expand'); await page.locator('[data-ai-scroll="'+settings+':row"]').evaluate(el=>el.scrollLeft=el.scrollWidth);
 await page.waitForTimeout(250);
 await click(settings+'.action.create'); await type(settings+'.action.username','FixtureNew'); await available(settings+'.action.create_submit');
 assert.equal(await page.evaluate(settings=>window.fixture.run(settings+'.action.create_submit','action',{confirmedTargetId:'AnotherName'}),settings),'stale_or_unavailable');
 assert.equal(await page.evaluate(settings=>window.fixture.run(settings+'.action.create_submit','action',{confirmedTargetId:'FixtureNew'}),settings),'dispatched');
 assert.equal(await page.evaluate(()=>JSON.parse(window.fixture.mutation.body).username),'FixtureNew');
 console.log('PASS Creative Profile exact bindings, theme contrast, blocked removal, and create/remove confirmation');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
