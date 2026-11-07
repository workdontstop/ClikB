const assert = require('node:assert/strict');
const path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const fixture = `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {BrowserRouter,useNavigate,useLocation} from 'react-router-dom';
import ProfileInfo from './src/ProfileInfo';
import {store} from './src/store';
import {setLoggedUser} from './src/profileSlice';
const follow = new Set();
const viewer = { id: 7, name: 'Viewer', username: 'viewer', image: '', imageThumb: '' };
store.dispatch(setLoggedUser(viewer));
const noop = () => {};
window.calls = [];
window.api = async (url, {values}) => {
  const endpoint = url.split('/').pop();
  window.calls.push({ endpoint, ...values });
  const key = values.userid + ':' + values.favid;
  if (endpoint === 'profileInfo') return {data:{payload:[{id:values.memberId,username:'member'+values.memberId}]}};
  if (endpoint === 'fanList') return {data:{ok:true,userId:values.id,limit:50,offset:0,counts:{followers:follow.has('7:'+values.id)?23:22,following:8}}};
  if (endpoint === 'fanStatus') return {data:{ok:true,following:follow.has(key),followedBy:false,relationship:follow.has(key)?'one_way_out':'none'}};
  if (endpoint === 'fantoggle') {
    if (window.holdFollow) await new Promise(resolve => { window.releaseFollow = resolve; });
    follow.add(key);
    return {data:{ok:true,state:'followed',countDelta:1}};
  }
  throw new Error('Unexpected API ' + url);
};
function App(){
  const navigate = useNavigate(), location = useLocation();
  const [profile,setProfile] = useState({id:0,username:'',profilePic:'',profilePicThumb:''});
  const [activeViewer,setActiveViewer] = useState(viewer);
  const [feeds] = useState([]);
  const memberId = location.state?.userId || 235;
  return <><button onClick={()=>navigate('/pages',{state:{userId:235}})}>First profile</button>
    <button onClick={()=>navigate('/pages',{state:{userId:236}})}>Second profile</button>
    <button onClick={()=>navigate('/pages',{state:{userId:237}})}>Third profile</button>
    <button onClick={()=>{ const next = {...viewer,id:8}; store.dispatch(setLoggedUser(next)); setActiveViewer(next); }}>Switch viewer</button>
    <output data-viewed={memberId}/>
    <ProfileInfo loggedUser={activeViewer} feeds={feeds} userProfile={profile} setUserProfile={setProfile}
      snapshotPlacement="page_top" isMenuOpen={false} setIsCropOpen={noop} setminimise={noop} setMenuOpenb={noop}
      setShowThumb={noop} setShowEmotions={noop} setfollowType={noop} setIsFullscreen={noop}/>
  </>;
}
createRoot(document.getElementById('root')).render(<Provider store={store}><BrowserRouter><App/></BrowserRouter></Provider>);
`;

async function main() {
  const bundle = await build({ stdin: { contents: fixture, loader: 'tsx', resolveDir: root }, bundle: true, write: false,
    platform: 'browser', format: 'iife', jsx: 'automatic', logLevel: 'silent', loader: { '.css': 'empty', '.png': 'dataurl', '.webp': 'dataurl' },
    define: { 'import.meta.env': JSON.stringify({ VITE_CLIK_URL: 'http://fixture.test' }) },
    plugins: [{ name: 'profile-follow-fixture', setup(builder) {
      builder.onResolve({ filter: /^(axios|.*(?:CreativeProfiles|CropImageModal|DetectDevice))$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({
        contents: args.path === 'axios' ? 'export default { post:(...args)=>window.api(...args) };'
          : /DetectDevice/.test(args.path) ? 'export const matchMobile=innerWidth<600;'
            : 'export default function Stub(){return null;} export const CropImageModal=Stub;', loader: 'js',
      }));
    } }],
  });
  const html = '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script>'
    + bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>';
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => route.request().isNavigationRequest()
      ? route.fulfill({ status: 200, contentType: 'text/html', body: html }) : route.abort());
    await page.goto('http://fixture.test/pages');
    await page.getByRole('button', { name: 'First profile' }).click();
    const follow = page.locator('[data-ai-action="clikb.profile_header.action.follow"]');
    const following = page.locator('[data-ai-action="clikb.profile_header.action.following"]');
    const followers = page.locator('[data-ai-action="clikb.profile_header.action.followers"]');
    await follow.click();
    const done = page.getByRole('button', { name: 'Follow complete' });
    await done.waitFor();
    assert.equal(await done.isDisabled(), true);
    assert.equal(await done.getAttribute('aria-busy'), 'true');
    assert.equal(await done.locator('[role="progressbar"]').count(), 1);
    assert.equal(await following.count(), 0);
    await following.waitFor({ timeout: 5000 });
    assert.equal(await followers.isVisible(), true);
    await page.waitForFunction(() => document.querySelector('[data-ai-action="clikb.profile_header.action.following"]')?.textContent.includes('8')
      && document.querySelector('[data-ai-action="clikb.profile_header.action.followers"]')?.textContent.includes('23'));
    assert.match(await following.innerText(), /8/);
    assert.match(await followers.innerText(), /23/);
    assert.deepEqual(await page.evaluate(() => window.calls.filter(call => call.endpoint === 'fantoggle')), [
      { endpoint: 'fantoggle', userid: 7, favid: 235, action: 'follow' },
    ]);
    assert.ok(await page.evaluate(() => window.calls.filter(call => call.endpoint === 'fanStatus' && call.favid === 235).length >= 2));
    await page.getByRole('button', { name: 'Second profile' }).click();
    await follow.click();
    await done.waitFor();
    await page.getByRole('button', { name: 'Third profile' }).click();
    await follow.waitFor();
    await page.waitForTimeout(2200);
    assert.equal(await following.count(), 0);
    assert.equal(await followers.count(), 0);
    assert.equal(await done.count(), 0);
    await page.evaluate(() => { window.holdFollow = true; });
    await follow.click();
    await page.waitForFunction(() => Boolean(window.releaseFollow));
    await page.getByRole('button', { name: 'Switch viewer' }).click();
    await follow.waitFor();
    await page.evaluate(() => window.releaseFollow());
    await page.waitForFunction(() => window.calls.some(call => call.endpoint === 'fanStatus' && call.userid === 8 && call.favid === 237));
    assert.equal(await done.count(), 0);
    assert.equal(await following.count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS Follow completion spinner, live counts, exact status refresh, and identity change during Done');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
