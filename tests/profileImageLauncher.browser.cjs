const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const fixture = `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {BrowserRouter} from 'react-router-dom';
import ProfileImageLauncher from './src/ProfileImageLauncher';
import {store} from './src/store';
import {setLoggedUser} from './src/profileSlice';
import {setPixels,setThemePreference,setAutoControl,setAutoControlVisible,setConciergeEnabled} from './src/settingsSlice';
import {observeCurrentAppSnapshot,handleNavigationBrowserRequest} from './src/navigationBrowserControl';
store.dispatch(setLoggedUser({id:7,name:'Owner',username:'owner',image:'',imageThumb:''}));
store.dispatch(setPixels(1000));
store.dispatch(setThemePreference(innerWidth < 600 ? 'dark' : 'light'));
store.dispatch(setAutoControlVisible({visible:true,actor:'user'}));store.dispatch(setAutoControl({enabled:true,actor:'user'}));store.dispatch(setConciergeEnabled(true));
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="#42636d"/></svg>');
window.fixture={requests:[],uploads:0,snapshot:observeCurrentAppSnapshot,image};
window.fixture.api=async(url,body)=>{
  window.fixture.requests.push({path:new URL(url).pathname,body});
  if(url.endsWith('/profile-image/prompt'))return {data:{imagePrompt:'A softly lit painted profile portrait'}};
  if(url.endsWith('/profile-image/current'))return {data:{memberId:body.memberId,kind:body.kind,imageUrl:'',profileImageReceipt:null}};
  if(url.endsWith('/profile-image/discard'))return {data:{ok:true}};
  if(url.endsWith('/profile-image/upload')){
    window.fixture.uploads++;
    if(window.fixture.holdUpload)await new Promise(resolve=>{window.fixture.releaseUpload=resolve;});
    return {data:{imageUrl:image,profileImageReceipt:'direct-'+body.memberId+'-'+body.kind}};
  }
  if(url.endsWith('/profile-image/use'))return {data:{imageUrl:image,thumbnailUrl:image,memberId:body.memberId,kind:body.kind}};
  await new Promise(resolve=>setTimeout(resolve,window.fixture.delay?300:10));
  return {data:{imageUrl:image,profileImageReceipt:'receipt-for-'+body.profileImage.memberId+'-'+body.profileImage.kind}};
};
window.fetch=async(input,options)=>{
  if(String(input).endsWith('/navigation/browser-reply')){window.fixture.reply=JSON.parse(options.body).reply;return Response.json({ok:true});}
  throw Error('Unexpected request');
};
window.fixture.run=async(name,command='action',text)=>{
  const snapshot=observeCurrentAppSnapshot();
  await handleNavigationBrowserRequest({requestId:Math.random().toString(),command,actionId:'clikb.navigation.profile_image.action.'+name,
    expectedVersion:snapshot.navigation.stateVersion,text},location.origin);
  return window.fixture.reply.status;
};
function App(){
  const [open,setOpen]=useState(true);const [target,setTarget]=useState('avatar');
  window.fixture.reopen=value=>{setTarget(value);setOpen(true);};
  return <ProfileImageLauncher open={open} memberId={7} target={target} onClose={()=>setOpen(false)}
    onGenerated={url=>{window.fixture.applied=url;}}/>;
}
createRoot(document.getElementById('root')).render(<Provider store={store}><BrowserRouter><App/></BrowserRouter></Provider>);
`;

(async () => {
  const bundle = await build({ stdin: { contents: fixture, resolveDir: root, loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', loader: { '.css': 'empty' },
    define: { 'import.meta.env': JSON.stringify({ VITE_CLIK_URL: 'http://fixture.test' }) },
    plugins: [{ name: 'offline-axios', setup(builder) {
      builder.onResolve({ filter: /^axios$/ }, () => ({ path: 'axios', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export default {post:(url,body)=>window.fixture.api(url,body),isAxiosError:()=>false};' }));
    } }],
  });
  const css = ['SocialChat.css', 'ProfileImageLauncher.css'].map(file => fs.readFileSync(path.join(root, 'src', file), 'utf8')).join('\n');
  const html = '<style>body{margin:0;font-family:system-ui}</style><style>' + css + '</style><div id="root"></div><script>' + bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>';
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => route.request().isNavigationRequest() ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort());
      await page.goto('http://fixture.test/pages');
      const available = name => page.waitForFunction(name => window.fixture.snapshot().navigation?.availableActions.some(action => action.actionId.endsWith('.' + name)), name);
      const action = async name => {
        await available(name);
        await page.waitForTimeout(250);
        assert.equal(await page.evaluate(name => window.fixture.run(name), name), 'observed_change', name);
      };
      await available('ai_prompt');
      assert.equal(await page.evaluate(() => window.fixture.run('ai_prompt', 'text', 'Make a painted profile portrait')), 'observed_change');
      assert.ok(await page.evaluate(() => window.fixture.snapshot().conciergeFocus.textFields.some(field => field.value === 'Make a painted profile portrait')));
      assert.equal(await page.getByRole('textbox', { name: 'Image prompt', exact: true }).count(), 0);
      const compact = await page.locator('.profile-image-launcher').boundingBox();
      assert.ok(compact.height < 450, 'empty launcher should fit its content');
      await action('toggle_prompt');
      await action('generate');
      assert.ok(await page.evaluate(() => {
        const body=window.fixture.requests.find(request=>request.path==='/profile-image/prompt').body;
        return body.llmTier==='luna' && typeof body.promptOperationId==='string' && body.promptOperationId.length>0;
      }));
      assert.equal(await page.getByRole('textbox', { name: 'Image prompt', exact: true }).inputValue(), 'A softly lit painted profile portrait');
      assert.equal(await page.getByRole('textbox', { name: 'Update with AI', exact: true }).inputValue(), '');
      assert.equal(await page.locator('.profile-image-preview').count(), 0, 'expanded AI update stops after rewriting');
      await action('generate');
      assert.deepEqual(await page.evaluate(() => {
        const body=window.fixture.requests.find(request=>request.path==='/GptImageFlare').body;
        return [body.profileImage,body.ty,body.width,body.height];
      }), [{ memberId: 7, kind: 'avatar' }, 2, 1024, 1024]);
      await action('mode_edit');
      await action('generate');
      assert.ok(await page.evaluate(() => {
        const body=window.fixture.requests.filter(request=>request.path==='/GptImageFlare').at(-1).body;
        return body.sampleImages[0]===window.fixture.image && body.profileImage.source.imageUrl===window.fixture.image
          && body.profileImage.source.receipt==='receipt-for-7-avatar';
      }));
      assert.equal(await page.evaluate(() => window.fixture.snapshot().navigation.areas['clikb.navigation.profile_image'].state.imageMode), 'recreate');
      await action('inspect');
      await page.getByRole('dialog', { name: 'Image preview', exact: true }).waitFor();
      await page.goBack();
      await page.getByRole('dialog', { name: 'Image preview', exact: true }).waitFor({ state: 'hidden' });
      await page.getByRole('dialog', { name: 'Profile picture', exact: true }).waitFor();
      await page.getByRole('textbox', { name: 'Image prompt', exact: true }).fill('Another softly lit portrait');
      assert.equal(await page.locator('.profile-image-preview').count(), 1);
      await action('quality_sd2');
      assert.equal(await page.locator('.profile-image-preview').count(), 1);
      await action('generate');
      assert.ok(await page.evaluate(() => window.fixture.requests.some(request => request.path === '/minimax2')));
      await action('quality_sd');
      await action('generate');
      assert.ok(await page.evaluate(() => window.fixture.requests.some(request => request.path === '/fluxschnell')));
      await action('use');
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => window.fixture.applied), await page.evaluate(() => window.fixture.image));
      await page.evaluate(() => window.fixture.reopen('cover'));
      await page.getByRole('textbox', { name: 'Update with AI', exact: true }).fill('A wide painted landscape');
      await action('generate');
      assert.deepEqual(await page.evaluate(() => {
        const body=window.fixture.requests.filter(request=>request.path==='/GptImageFlare').at(-1).body;
        return [body.profileImage,body.ty,body.width,body.height];
      }), [{ memberId: 7, kind: 'cover' }, 3, 1920, 1080]);
      const chooserReady = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Upload image', exact: true }).click();
      const chooser = await chooserReady;
      await chooser.setFiles({name:'cover.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="teal"/></svg>')});
      await page.locator('.reactEasyCrop_CropArea').waitFor();
      await page.getByRole('button', {name:'Save',exact:true}).click();
      await page.locator('.reactEasyCrop_CropArea').waitFor({state:'hidden'});
      await page.getByRole('dialog').waitFor();
      assert.equal(await page.evaluate(() => window.fixture.uploads), 1);
      assert.equal(await page.evaluate(() => window.fixture.snapshot().navigation.areas['clikb.navigation.profile_image'].state.imageMode), 'edit');
      const uploadBody = await page.evaluate(() => window.fixture.requests.find(request=>request.path==='/profile-image/upload').body);
      assert.equal(uploadBody.kind, 'cover');assert.equal(uploadBody.memberId,7);assert.match(uploadBody.imageBase64,/^data:image\/jpeg;base64,/);
      await action('mode_recreate');
      await action('generate');
      assert.ok(await page.evaluate(() => {
        const body=window.fixture.requests.filter(request=>request.path==='/GptImageFlare').at(-1).body;
        return !body.sampleImages && !body.profileImage.source;
      }));
      await action('use');
      await page.getByRole('dialog').waitFor({state:'hidden'});
      assert.ok(await page.evaluate(() => window.fixture.requests.filter(request => request.path === '/profile-image/discard').length >= 3));
      await page.evaluate(() => { window.fixture.delay=true; window.fixture.reopen('avatar'); });
      await page.getByRole('textbox', { name: 'Update with AI', exact: true }).fill('An abandoned portrait');
      await page.getByRole('button', { name: /^Generate/ }).click();
      await page.getByRole('button', { name: 'Close image creator', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
      await page.evaluate(() => window.fixture.reopen('cover'));
      await page.waitForTimeout(350);
      assert.equal(await page.locator('.profile-image-preview').count(), 0);
      // Back while the temporary upload is still in flight must not consume the launcher entry later.
      await page.evaluate(() => { window.fixture.holdUpload=true; });
      const cancelledChooser = page.waitForEvent('filechooser');
      await page.getByRole('button', {name:'Upload image',exact:true}).click();
      await (await cancelledChooser).setFiles({name:'cancel.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="teal"/></svg>')});
      await page.locator('.reactEasyCrop_CropArea').waitFor();
      await page.getByRole('button', {name:'Save',exact:true}).click();
      await page.waitForFunction(()=>Boolean(window.fixture.releaseUpload));
      await page.goBack();
      await page.locator('.reactEasyCrop_CropArea').waitFor({state:'hidden'});
      await page.evaluate(()=>{window.fixture.holdUpload=false;window.fixture.releaseUpload();});
      await page.waitForTimeout(100);
      await page.getByRole('dialog', {name:'Cover image',exact:true}).waitFor();
      assert.equal(await page.locator('.profile-image-preview').count(),0);
      assert.deepEqual(errors, []);
      await page.close();
      console.log('PASS '+width+'px image launcher uses scoped avatar/cover shapes, exact template models, receipt application and preview cleanup');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
