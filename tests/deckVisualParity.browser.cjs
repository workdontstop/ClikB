const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const fixture = `
import {useState} from 'react';import {createRoot} from 'react-dom/client';import {Provider} from 'react-redux';import {BrowserRouter} from 'react-router-dom';
import {store} from './src/store';import {setDeckCleanMode,setThemePreference} from './src/settingsSlice';
import CreationDeck from './src/CreationDeck';import DeckOverlay from './src/DeckOverlay';
const noop=()=>{};
store.dispatch(setDeckCleanMode(true));store.dispatch(setThemePreference(innerWidth<600?'dark':'light'));
window.fixture={normal:()=>store.dispatch(setDeckCleanMode(false)),clean:()=>store.dispatch(setDeckCleanMode(true))};
function App(){const [id,select]=useState(2);const [single,setSingle]=useState(false);const creation=new URLSearchParams(location.search).has('creation');
window.fixture.single=setSingle;
return creation?<CreationDeck title="Images" cards={(single?[2]:[1,2,3]).map(n=>({id:String(n),title:'Scene '+n,text:'Scene response',image:single?undefined:'/preview.svg'}))}
 activeId={String(id)} onSelect={n=>select(Number(n))} onOpen={noop} onClose={noop} slideshow onOptions={noop}/>
 :<DeckOverlay cards={[1,2,3].map(n=>({id:n,caption:'Post '+n,mode:0,username:'creator',sender:7}))}
 activePostId={id} onSelectPost={select} category="all" loading={false} hasMore={false} error={null}
 onPlay={noop} onPaginate={noop} onCategory={noop} onClose={noop} onCreate={noop} onDockHost={noop} isMenuOpen={false}/>;
}
createRoot(document.getElementById('root')).render(<Provider store={store}><BrowserRouter><App/></BrowserRouter></Provider>);`;
(async()=>{
 const bundled=await build({stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,jsx:'automatic',platform:'browser',format:'iife',
 loader:{'.css':'empty','.png':'dataurl','.jpg':'dataurl','.webp':'dataurl','.svg':'dataurl'},define:{'import.meta.env':'{}'},
 plugins:[{name:'isolated-deck-runtime',setup(b){
 b.onResolve({filter:/DeckRuntimeContext$/},()=>({path:'runtime',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'const noop=()=>{};export const useDeckRuntime=()=>({setCreationDockHost:noop});'}));
 }}]});
 const css=['DeckOverlay.css','CreationDeck.css'].map(f=>fs.readFileSync(path.join(root,'src',f),'utf8')).join('\n');
 const html='<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:system-ui}</style><style>'+css+'</style><div id="root"></div><script>'+bundled.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>';
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
 const cleanSizes = new Map(), normalSizes = new Map();
 for(const width of [1440,390])for(const creation of [false,true]){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:html}):r.abort());
 await page.goto('http://fixture.test/deck'+(creation?'?creation=1':''));
 const deck=page.locator('.deck-overlay');await deck.waitFor();
 await page.waitForTimeout(350);
 const cleanCard=await deck.locator('.deck-card--active').boundingBox();
 assert.ok(Math.abs(cleanCard.width/cleanCard.height-9/16)<.002,'both Clean surfaces retain the9:16 portrait shape');
 if(creation){
   const feedsCard=cleanSizes.get(width);
   assert.ok(Math.abs(cleanCard.width-feedsCard.width)<1 && Math.abs(cleanCard.height-feedsCard.height)<1,'Feeds and Creation use identical Clean card dimensions');
   await page.evaluate(()=>window.fixture.single(true));
   const infoCard=await deck.locator('.deck-card--active').boundingBox();
   assert.equal(await deck.locator('.deck-card').count(),1);
   assert.deepEqual([infoCard.width,infoCard.height],[cleanCard.width,cleanCard.height]);
   await page.evaluate(()=>window.fixture.single(false));
 }else cleanSizes.set(width,cleanCard);
 assert.equal(await deck.locator('.deck-arrow:visible').count(),0,'Clean mode hides horizontal arrows');
 assert.equal(await deck.getByRole('button',{name:'Restore deck view',exact:true}).count(),1,'Clean view retains circle restore');
 const close=deck.locator('.deck-close-cue:visible');
 assert.equal(await close.count(),width<769?1:2);
 for(const element of await close.all()){
 const pill=element.locator('.deck-close-cue-pill');
 assert.equal(await pill.evaluate(el=>getComputedStyle(el).color),width<600?'rgb(255, 255, 255)':'rgb(0, 0, 0)');
 assert.ok((await pill.boundingBox()).height<28,'shared close pill remains compact');
 }
 await page.waitForTimeout(3700);
 assert.equal(await deck.locator('.deck-close-cue:visible').count(),0,'close hints expire');
 await deck.locator('.deck-more-cue').waitFor();
 await deck.locator('.deck-more-cue').click();
 await deck.locator('.deck-arrow').first().waitFor({state:'visible',timeout:3000}).catch(async error=>{
   console.error(await deck.evaluate(root=>({className:root.className,arrows:[...root.querySelectorAll('.deck-arrow')].map(el=>({style:getComputedStyle(el).display,box:el.getBoundingClientRect().toJSON()}))})));
   throw error;
 });
 assert.equal(await deck.locator('.deck-arrow:visible').count(),2,'Normal view restores arrows');
 const normalCard=await deck.locator('.deck-card--active').boundingBox();
 if(creation){
   const feedsCard=normalSizes.get(width);
   assert.deepEqual([normalCard.width,normalCard.height],[feedsCard.width,feedsCard.height]);
   await page.evaluate(()=>window.fixture.single(true));
   const infoCard=await deck.locator('.deck-card--active').boundingBox();
   assert.deepEqual([infoCard.width,infoCard.height],[feedsCard.width,feedsCard.height]);
   await page.evaluate(()=>window.fixture.single(false));
 }else normalSizes.set(width,normalCard);
 const round=deck.locator('.deck-arrow:visible').first();
 const box=await round.boundingBox();assert.ok(Math.abs(box.width-box.height)<1,'bottom/card controls retain round design');
 if(creation) for(const button of await deck.locator('.deck-close, .deck-arrow:visible').all()){
   const circle=await button.boundingBox(), icon=await button.locator('svg').boundingBox();
   assert.ok(icon.width>=18 && Math.abs(circle.x+circle.width/2-icon.x-icon.width/2)<1
     && Math.abs(circle.y+circle.height/2-icon.y-icon.height/2)<1,'round controls have a centered, readable icon');
 }
 await page.screenshot({path:path.join(root,'.tmp','deck-parity-'+(creation?'creation':'feeds')+'-'+width+'.png')});
 assert.deepEqual(errors,[]);
 console.log('PASS '+width+'px '+(creation?'Creation':'Feeds')+' shared Clean/Normal controls, pill styling and timed hints');
 await page.close();
 }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
