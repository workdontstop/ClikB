const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..');

// Exercise the production action controls, real Normal/Clean Deck rendering,
// browser router, and the native creation-history helpers. Provider/storage
// transports are offline fixtures; PromptInput generation is deliberately not
// mounted. Its hydrate/restore behavior has separate stage-specific coverage.
const fixture = `
import React,{useState,useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {BrowserRouter,useLocation,useNavigate} from 'react-router-dom';
import settings,{setDeckEnabled,setDeckCleanMode,setThemePreference} from '/src/settingsSlice.ts';
import {CreationDraftAction,BlueprintRemixAction,BlueprintAllowRemix} from '/src/creationDrafts/actions.tsx';
import {getPendingDraftEntry,usePendingDraftEntry} from '/src/creationDrafts/entry.ts';
import DeckOverlay from '/src/DeckOverlay.tsx';
import {useDeckNavigation,useDeckCreationRequest} from '/src/useDeckNavigation.ts';
import {usePromptInputHistory} from '/src/usePromptInputHistory.ts';
const params=new URLSearchParams(location.search),surface=params.get('surface')||'grid';
const actor=Number(params.get('actor')||7),sourceOwner=Number(params.get('owner')||7),allow=params.get('allow')==='1',dev=params.get('dev')==='1';
const type=Number(params.get('type')||1),postId=surface==='blueprint'?601:501;
const store=configureStore({reducer:{settings,profile:(state={loggedUser:{id:actor}})=>state}});
store.dispatch(setDeckEnabled(params.get('deck')!=='off'));store.dispatch(setDeckCleanMode(params.get('clean')==='1'));store.dispatch(setThemePreference('dark'));
const image='https://draft.test/fixture.png';
const post={id:postId,sender:sourceOwner,publicationVideo:surface==='blueprint'?1:100,caption:'Distinct saved creation',mode:type===1?1:type===3?2:0,x1:image,item1:image};
if(surface==='deck')history.replaceState({idx:0,key:'source-deck',usr:{clikbDeck:{version:1,sessionId:'source-deck',tier:'deck',collectionReady:true,activePostId:postId,collectionIds:[postId],category:'page',scroll:{x:0,y:0},returnTo:{pathname:location.pathname,search:location.search,hash:'',state:null}}}},'',location.href);
const doc={postId:501,draftId:'draft-501',revision:8,digest:'confirmed',published:false,snapshot:{schemaVersion:1,creationProjectId:'creation-501',creationType:type,sections:{prompt:{prompt:'Original saved brief',parsedKeyPoints:['Original scene']},storybook:{TextVideo:['Original saved video prompt']}}}};
window.fixture={requests:[],runtime:{},store,serverAllow:allow};
const capability=()=>{const owner=actor===sourceOwner,isDraft=surface!=='blueprint',guest=actor===1;return{postId,isDraft,draftReady:params.get('ready')!=='0',owner,allowRemix:window.fixture.serverAllow,canResume:isDraft&&owner,canRemix:!isDraft&&(guest?(dev||window.fixture.serverAllow):(owner||window.fixture.serverAllow)),canToggleRemix:!isDraft&&owner&&(!guest||dev)}};
window.fetch=async(url,options={})=>{const path=new URL(String(url),location.origin).pathname;window.fixture.requests.push({path,method:options.method||'GET',body:options.body?JSON.parse(options.body):null,credentials:options.credentials,cache:options.cache});let body;
 if(path.endsWith('/capabilities'))body=capability();
 else if(path.endsWith('/allow-remix')){window.fixture.serverAllow=JSON.parse(options.body).allowRemix;body=capability();}
 else if(path.endsWith('/remix'))body={...doc,postId:777,draftId:'independent-777',snapshot:{...doc.snapshot,creationProjectId:'independent-777'}};
 else if(path==='/creation-drafts/posts/501'){if(params.get('failread')==='1')return new Response(JSON.stringify({message:'Draft read unavailable'}),{status:500,headers:{'Content-Type':'application/json'}});body=doc;}
 else throw new Error('Unexpected network call '+path);
 return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
};
function Fixture(){
 const location=useLocation(),navigate=useNavigate();const [minimise,setMinimise]=useState(true),[fullscreen,setFullscreen]=useState(null);
 const scroll=useRef(null),pending=usePendingDraftEntry(actor);
 const category=location.pathname==='/kickit'?'cinema':location.pathname==='/clikit'?'games':location.pathname==='/images'?'shorts':'page';
 const deck=useDeckNavigation({feeds:[post],category,enabled:true,deckEnabled:store.getState().settings.deckEnabled,loading:false,autoOpen:surface==='deck',minimisePrompt:minimise,
   prepareDeck:()=>setMinimise(true),onFullscreen:setFullscreen,getScroll:()=>({x:0,y:0}),restoreScroll:()=>{},onCreate:()=>setMinimise(false)});
 useDeckCreationRequest(()=>setMinimise(false),store.getState().settings.deckEnabled);
 usePromptInputHistory({open:!minimise,suspended:false,blockBack:false,routeKey:location.key,onClose:()=>setMinimise(true),onReopen:()=>setMinimise(false)});
 window.fixture.runtime={openCreate:()=>setMinimise(false)};
 window.fixture.state=()=>({pathname:location.pathname,search:location.search,history:history.state,pending:getPendingDraftEntry(actor)?.record,minimise,fullscreen,deckOpen:deck.isDeckOpen,deckEnabled:store.getState().settings.deckEnabled});
 window.fixture.close=()=>setMinimise(true);
 return <main ref={scroll}>
  {surface==='grid'&&<div data-source-slot style={{position:'relative',height:300,width:220,background:'#567'}}><CreationDraftAction post={post} surface="grid"/></div>}
  {surface==='fullscreen'&&<div data-source-slot style={{position:'fixed',inset:0,zIndex:9990,background:'#567'}}><CreationDraftAction post={post} surface="fullscreen"/></div>}
  {surface==='deck'&&deck.isDeckOpen&&<DeckOverlay cards={[post]} activePostId={post.id} category={category} loading={false} hasMore={false} error={null}
    onSelectPost={deck.selectPost} onPlay={deck.play} onPaginate={()=>{}} onCategory={()=>{}} onClose={deck.close} onCreate={deck.create} onDockHost={()=>{}} isMenuOpen={false}/>}
  {surface==='blueprint'&&<section data-blueprint><BlueprintRemixAction post={post}/><BlueprintAllowRemix post={post}/></section>}
  {!minimise&&<section data-composer data-creation-id={pending?.record.snapshot.creationProjectId}>Creation ready</section>}
 </main>;
}
createRoot(document.getElementById('root')).render(<Provider store={store}><BrowserRouter><Fixture/></BrowserRouter></Provider>);
`;

async function run() {
  const bundled = await build({ stdin: { contents: fixture, loader: 'tsx', resolveDir: root }, bundle: true, write: false,
    format: 'iife', platform: 'browser', jsx: 'automatic', logLevel: 'silent',
    loader: { '.css': 'empty', '.png': 'dataurl', '.jpg': 'dataurl', '.webp': 'dataurl' },
    define: { 'import.meta.env': JSON.stringify({ VITE_CLIK_URL: 'http://draft.test', DEV: true, PROD: false }) },
    plugins: [{ name: 'offline-draft-fixture', setup(build) {
      build.onResolve({ filter: /(?:^|\/)(DeckRuntimeContext|AutoControlPill|SharedBackControl)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents:
        /DeckRuntimeContext/.test(args.path) ? 'export const useDeckRuntime=()=>window.fixture.runtime;'
          : /SharedBackControl/.test(args.path) ? 'export const registerSharedBack=()=>()=>{};'
          : 'export default function Stub(){return null;}', loader: 'jsx' }));
      build.onResolve({ filter: /^\/(src|server)\// }, args => ({ path: path.join(root, args.path.slice(1)) }));
    } }] });
  const html = '<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#111;color:white}'
    + fs.readFileSync(path.join(root, 'src/DeckOverlay.css'), 'utf8') + '</style><div id="root"></div><script>'
    + bundled.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>';
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  let passed = 0;
  try {
    async function open(query, width = 1280, pathname = '/pages') {
      const page = await browser.newPage({ viewport: { width, height: 844 } }); page.setDefaultTimeout(10000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => route.request().isNavigationRequest() ? route.fulfill({ contentType: 'text/html', body: html })
        : route.request().url().endsWith('fixture.png') ? route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aT3sAAAAASUVORK5CYII=', 'base64') }) : route.abort());
      await page.goto(`http://draft.test${pathname}?${query}`);
      return { page, errors };
    }
    for (const width of [1280, 390]) for (const surface of ['grid', 'deck', 'fullscreen']) for (const deck of ['on', 'off']) {
      if (surface === 'deck' && deck === 'off') continue;
      const { page, errors } = await open(`surface=${surface}&deck=${deck}&type=1`, width);
      const control = page.locator(`[data-creation-draft-action="${surface}"]`); await control.waitFor().catch(async error => {
        console.error('Fixture failure', { surface, deck, width, errors }, await page.evaluate(() => JSON.stringify({ state: window.fixture.state?.(), requests: window.fixture.requests, text: document.body.innerText.slice(0, 1000) })));
        throw error;
      });
      const before = await page.evaluate(() => ({ url: location.href, state: history.state, count: history.length }));
      await control.click(); await page.getByRole('dialog', { name: 'Continue creation?' }).waitFor();
      assert.equal((await page.evaluate(() => window.fixture.requests)).filter(request => /^\/creation-drafts\/posts\/\d+$/.test(request.path)).length, 0, 'Opening confirmation must not fetch draft');
      await page.getByRole('button', { name: 'No', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      assert.deepEqual(await page.evaluate(() => ({ url: location.href, state: history.state, count: history.length })), before, 'No preserves exact history');
      await control.click(); await page.getByRole('button', { name: 'Yes', exact: true }).click();
      await page.locator('[data-composer][data-creation-id="creation-501"]').waitFor();
      await page.waitForFunction(() => !!history.state.clikbPromptInput);
      const state = await page.evaluate(() => window.fixture.state());
      assert.equal(state.pathname, '/kickit', 'Saved Cinema enters its own native composer');
      assert.equal(state.pending.postId, 501); assert.equal(state.pending.snapshot.sections.storybook.TextVideo[0], 'Original saved video prompt');
      if (deck === 'off') assert.equal(state.history.usr?.clikbDeck, undefined, 'Deck Off does not insert hidden Deck tier');
      assert.equal((await page.evaluate(() => window.fixture.requests)).filter(request => request.path === '/creation-drafts/posts/501').length, 1, 'Resume fetches cloud snapshot once');
      await page.goBack(); await page.locator('[data-composer]').waitFor({ state: 'hidden' });
      await page.goForward(); await page.locator('[data-composer]').waitFor({ state: 'visible' });
      assert.deepEqual(errors, []); await page.close(); passed++;
    }
    for (const width of [1280, 390]) {
      const { page, errors } = await open('surface=deck&clean=1', width);
      await page.locator('[data-deck-overlay]').waitFor();
      assert.equal(await page.locator('[data-creation-draft-action]').count(), 0, 'Clean Deck stays free of draft icon');
      assert.deepEqual(errors, []); await page.close(); passed++;
    }
    for (const type of [0, 3]) for (const deck of ['on', 'off']) {
      const { page, errors } = await open(`surface=grid&deck=${deck}&type=${type}`, 1280, '/search');
      await page.locator('[data-creation-draft-action="grid"]').click();
      await page.getByRole('button', { name: 'Yes', exact: true }).click();
      await page.locator('[data-composer]').waitFor();
      const state = await page.evaluate(() => window.fixture.state());
      assert.equal(state.pathname, type === 3 ? '/clikit' : '/images');
      assert.equal(state.pending.snapshot.creationType, type);
      const read = (await page.evaluate(() => window.fixture.requests)).find(request => request.path === '/creation-drafts/posts/501');
      assert.equal(read.credentials, 'include'); assert.equal(read.cache, 'no-store');
      assert.deepEqual(errors, []); await page.close(); passed++;
    }
    for (const query of ['surface=grid&owner=8', 'surface=grid&ready=0']) {
      const { page, errors } = await open(query);
      await page.waitForTimeout(120);
      assert.equal(await page.locator('[data-creation-draft-action]').count(), 0, 'Foreign or unsupported draft has no resume action');
      assert.deepEqual(errors, []); await page.close(); passed++;
    }
    {
      const { page, errors } = await open('surface=grid&failread=1');
      await page.locator('[data-creation-draft-action="grid"]').click();
      const before = await page.evaluate(() => ({ url: location.href, state: history.state, count: history.length }));
      await page.getByRole('button', { name: 'Yes', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Draft read unavailable' }).waitFor();
      assert.deepEqual(await page.evaluate(() => ({ url: location.href, state: history.state, count: history.length })), before);
      assert.equal(await page.locator('[data-composer]').count(), 0, 'Failed cloud read does not activate incomplete creation');
      assert.deepEqual(errors, []); await page.close(); passed++;
    }
    const matrix = [
      { actor: 7, owner: 7, allow: 0, dev: 0, remix: true, toggle: true },
      { actor: 7, owner: 8, allow: 0, dev: 0, remix: false, toggle: false },
      { actor: 7, owner: 8, allow: 1, dev: 0, remix: true, toggle: false },
      { actor: 1, owner: 1, allow: 0, dev: 0, remix: false, toggle: false },
      { actor: 1, owner: 1, allow: 1, dev: 0, remix: true, toggle: false },
      { actor: 1, owner: 1, allow: 0, dev: 1, remix: true, toggle: true },
      { actor: 1, owner: 8, allow: 0, dev: 1, remix: true, toggle: false },
    ];
    for (const row of matrix) {
      const { page, errors } = await open('surface=blueprint&' + new URLSearchParams(row));
      await page.waitForFunction(() => window.fixture.requests.some(request => request.path.endsWith('/capabilities')));
      await page.waitForTimeout(70);
      assert.equal(await page.getByRole('button', { name: 'Remix', exact: true }).count(), Number(row.remix));
      assert.equal(await page.getByRole('checkbox', { name: 'Allow remix' }).count(), Number(row.toggle));
      if (row.toggle) {
        await page.getByRole('checkbox', { name: 'Allow remix' }).check();
        await page.waitForFunction(() => window.fixture.requests.some(request => request.path.endsWith('/allow-remix') && request.body.allowRemix));
      }
      if (row.remix) {
        await page.getByRole('button', { name: 'Remix', exact: true }).click();
        await page.getByRole('button', { name: 'Yes', exact: true }).click();
        await page.locator('[data-composer][data-creation-id="independent-777"]').waitFor();
        assert.equal((await page.evaluate(() => window.fixture.state())).pending.postId, 777);
      }
      assert.deepEqual(errors, []); await page.close(); passed++;
    }
    console.log(`Creation draft controls: ${passed} browser scenarios passed.`);
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
