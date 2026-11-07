const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('esbuild');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const fixture = `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider,useSelector} from 'react-redux';
import {BrowserRouter,useNavigate,useLocation} from 'react-router-dom';
import ProfileInfo from './src/ProfileInfo';
import {store} from './src/store';
import {setLoggedUser} from './src/profileSlice';
import {setPixels,setThemePreference} from './src/settingsSlice';
import {observeCurrentAppSnapshot} from './src/navigationBrowserControl';
const image=(color,width=1600,height=1600)=>'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'"><rect width="100%" height="100%" fill="'+color+'"/><circle cx="50%" cy="50%" r="20%" fill="white"/></svg>');
const avatar=image('#126367'),cover=image('#764125',1920,1080),directAvatar=image('#543321'),directCover=image('#345612',1920,1080),oldAvatar=image('#111'),oldCover=image('#222',1920,1080);
const owner={id:7,name:'Owner',username:'owner',image:oldAvatar,imageThumb:oldAvatar,userbillboard1:oldCover,userbillboardthumb1:oldCover};
store.dispatch(setLoggedUser(owner));store.dispatch(setPixels(1000));
store.dispatch(setThemePreference(innerWidth<600?'dark':'light'));
window.fixture={requests:[],snapshot:observeCurrentAppSnapshot,store,avatar,cover,directAvatar,directCover,oldAvatar,oldCover};
window.fixture.api=async(url,body)=>{
  const endpoint=new URL(url).pathname;window.fixture.requests.push({endpoint,body});
  if(endpoint==='/fanList')return {data:{ok:true,userId:body.values.id,limit:50,offset:0,counts:{followers:2,following:3}}};
  if(endpoint==='/fanStatus')return {data:{ok:true,following:false,followedBy:false,relationship:'none'}};
  if(endpoint==='/profileInfo')return {data:{payload:[{id:body.values.memberId,username:'other',profile_image:oldAvatar,billboard1:oldCover}]}};
  if(endpoint==='/profile-image/discard')return {data:{ok:true}};
  if(endpoint==='/profile-image/current'){
    const active=store.getState().profile.loggedUser;
    const imageUrl=body.kind==='cover'?active.userbillboard1:active.image;
    return {data:{memberId:body.memberId,kind:body.kind,imageUrl,profileImageReceipt:imageUrl?'current-'+body.memberId+'-'+body.kind:null}};
  }
  if(endpoint==='/profile-image/remove')return {data:{memberId:body.memberId,kind:body.kind,imageUrl:'',thumbnailUrl:''}};
  if(endpoint==='/profile-image/upload')return {data:{imageUrl:body.kind==='cover'?directCover:directAvatar,profileImageReceipt:'direct-'+body.memberId+'-'+body.kind}};
  if(endpoint==='/profile-image/use'){
    if(window.fixture.holdUse)await new Promise(resolve=>{window.fixture.releaseUse=resolve;});
    return {data:{memberId:body.memberId,kind:body.kind,imageUrl:body.imageUrl,thumbnailUrl:body.imageUrl}};
  }
  if(endpoint==='/GptImageFlare')return {data:{imageUrl:body.profileImage.kind==='cover'?cover:avatar,profileImageReceipt:'receipt-'+body.profileImage.memberId+'-'+body.profileImage.kind}};
  throw Error('Unexpected endpoint '+endpoint);
};
const noop=()=>{};
const feeds=[];
function App(){
  const active=useSelector(state=>state.profile.loggedUser),navigate=useNavigate(),location=useLocation();
  const [profile,setProfile]=useState({id:0,username:''}),[crop,setCrop]=useState(false),[menu,setMenu]=useState(false);
  window.fixture.profile=profile;
  window.fixture.switchChild=()=>{store.dispatch(setLoggedUser({...owner,id:8,ownerId:7,username:'child'}));navigate('/pages',{state:{userId:8,returnMarker:'deck'}});};
  window.fixture.other=()=>navigate('/pages',{state:{userId:9,returnMarker:'deck'}});
  const props={loggedUser:active,feeds,userProfile:profile,setUserProfile:setProfile,isCropOpen:crop,setIsCropOpen:setCrop,
    isMenuOpen:menu,minimise:false,setminimise:noop,setMenuOpenb:noop,setShowThumb:noop,setShowEmotions:noop,setfollowType:noop,setIsFullscreen:noop};
  return <><button onClick={()=>navigate('/pages',{state:{userId:active.id,returnMarker:'deck',deckIndex:3}})}>Own page</button>
    <button onClick={()=>setMenu(!menu)}>Toggle sidebar</button><output data-route={location.pathname} data-marker={location.state?.returnMarker||''}/>
    <div data-mount="sidebar" style={{display:menu&&innerWidth>=600?'block':'none'}}><ProfileInfo {...props} snapshotPlacement="sidebar"/></div>
    <div data-mount="page_top" style={{display:!menu||innerWidth<600?'block':'none'}}><ProfileInfo {...props} snapshotPlacement="page_top"/></div>
  </>;
}
createRoot(document.getElementById('root')).render(<Provider store={store}><BrowserRouter><App/></BrowserRouter></Provider>);
`;

(async () => {
  const bundle = await build({ stdin: { contents: fixture, loader: 'tsx', resolveDir: root }, bundle: true, write: false,
    platform: 'browser', format: 'iife', jsx: 'automatic', logLevel: 'silent', loader: { '.css': 'empty', '.png': 'dataurl', '.webp': 'dataurl' },
    define: { 'import.meta.env': JSON.stringify({ VITE_CLIK_URL: 'http://fixture.test' }) },
    plugins: [{ name: 'profile-image-integration', setup(builder) {
      builder.onResolve({ filter: /^(axios|.*(?:CreativeProfiles|DetectDevice))$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'axios'
        ? 'export default {post:(url,body)=>window.fixture.api(url,body),put:(url,body)=>window.fixture.api(url,body)};'
        : /DetectDevice/.test(args.path) ? 'export const matchMobile=innerWidth<600;'
          : 'export default function Stub(){return null;}', loader: 'js' }));
    } }],
  });
  const css = ['SocialChat.css', 'ProfileImageLauncher.css', 'ProfileInfo.css'].map(file => fs.readFileSync(path.join(root, 'src', file), 'utf8')).join('\n');
  const html = '<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;font-family:system-ui}</style><style>'
    + css + '</style><div id="root"></div><script>' + bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>';
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => route.request().isNavigationRequest() ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort());
      await page.goto('http://fixture.test/feeds');
      await page.getByRole('button', { name: 'Own page', exact: true }).click();
      const visibleHeader = key => page.locator('[data-ai-action="clikb.profile_header.action.' + key + '"]:visible');
      const launcher = page.getByRole('dialog');
      const open = async target => {
        await visibleHeader(target === 'cover' ? 'change_banner' : 'change_avatar').click();
        await launcher.waitFor();
        assert.equal(await launcher.count(), 1);
        await page.waitForFunction(target => window.history.state?.profileImageEditor?.target === target, target);
        assert.equal(await page.evaluate(() => window.fixture.snapshot().navigation.areas['clikb.navigation.profile_image'].state.memberId), 7);
      };
      const generate = async target => {
        await launcher.getByRole('textbox', { name: 'Update with AI', exact: true }).fill('A painted ' + target);
        await launcher.getByRole('button', { name: /^Generate/ }).click();
        await page.waitForFunction(() => window.fixture.snapshot().navigation.areas['clikb.navigation.profile_image']?.state.previewSource === 'generated');
      };
      const closed = async () => {
        await launcher.waitFor({ state: 'hidden' });
        await page.waitForFunction(() => !window.history.state?.profileImageEditor);
        assert.equal(await page.locator('output').getAttribute('data-route'), '/pages');
        assert.equal(await page.locator('output').getAttribute('data-marker'), 'deck');
        assert.equal(await page.evaluate(() => window.history.state.usr.deckIndex), 3);
      };
      const checkInspection = async target => {
        await page.getByRole('button', {name:'Inspect image',exact:true}).click();
        const inspection=page.getByRole('dialog', {name:'Image preview',exact:true});
        await inspection.waitFor();
        for(const size of [{width,height:900},{width:900,height:390},{width:2560,height:1258}]){
          await page.setViewportSize(size);
          await page.waitForFunction(()=>{const img=document.querySelector('.profile-image-inspection img');return img?.complete&&img.naturalWidth>0;});
          const box=await inspection.locator('img').boundingBox(),frame=await inspection.locator('.profile-image-inspection-frame').boundingBox();
          const ratio=target==='cover'?16/9:1;
          assert.ok(Math.abs(box.width/box.height-ratio)<.01, target+' image preserves its aspect ratio');
          assert.ok(Math.abs(frame.width/frame.height-ratio)<.01, target+' frame preserves its aspect ratio');
          assert.ok(box.x>=-.1&&box.y>=-.1&&box.x+box.width<=size.width+.1&&box.y+box.height<=size.height+.1, target+' full image fits within viewport');
          const close=await inspection.getByRole('button',{name:'Close image preview',exact:true}).boundingBox();
          assert.ok(close.x>=0&&close.y>=0&&close.x+close.width<=size.width&&close.y+close.height<=size.height,'inspection close stays on screen');
          if(size.width===width)await page.screenshot({path:path.join(root,'.tmp','profile-inspection-'+target+'-'+width+'.png')});
        }
        await page.setViewportSize({width,height:900});
        await inspection.locator('img').click();
        assert.equal(await inspection.isVisible(),true,'clicking the image keeps inspection open');
        const imageBox=await inspection.locator('img').boundingBox();
        await page.mouse.click(imageBox.x>1?imageBox.x/2:width/2,imageBox.x>1?450:imageBox.y/2);
        await inspection.waitFor({state:'hidden'});
        await page.waitForFunction(()=>!window.history.state?.profileImageInspect);
        assert.equal(await page.evaluate(()=>Boolean(window.history.state?.profileImageEditor)),true,'backdrop close returns only from inspection');
      };
      // Both actual ProfileInfo copies are mounted: only the visible owner publishes and opens one launcher.
      await open('avatar');
      await page.waitForFunction(() => !window.fixture.snapshot().navigation.areas['clikb.navigation.profile_image'].state.loadingCurrent);
      assert.equal(await page.locator('.profile-image-preview').getAttribute('src'), await page.evaluate(() => window.fixture.oldAvatar));
      assert.equal(await page.evaluate(() => window.fixture.snapshot().navigation.areas['clikb.navigation.profile_image'].state.imageMode), 'edit');
      assert.equal(await launcher.getByRole('button', {name:'Use image',exact:true}).isDisabled(), true, 'opening the saved image has no changes to apply');
      await checkInspection('avatar');
      await page.goBack();await closed();
      assert.equal(await page.evaluate(() => window.fixture.requests.filter(r=>/profile-image\/(?:use|discard|remove)$/.test(r.endpoint)).length), 0, 'viewing and closing a saved image must not write or discard it');
      await open('avatar');await generate('avatar');
      assert.ok(await page.evaluate(() => {
        const request=window.fixture.requests.find(r=>r.endpoint==='/GptImageFlare').body;
        return request.sampleImages[0]===window.fixture.oldAvatar && request.profileImage.source.receipt==='current-7-avatar';
      }), 'saved image Edit uses its verified current-image receipt');
      await page.getByRole('button', { name: 'Inspect image', exact: true }).click();
      await page.getByRole('dialog', { name: 'Image preview', exact: true }).waitFor();
      await page.goBack();
      await page.getByRole('dialog', { name: 'Image preview', exact: true }).waitFor({ state: 'hidden' });
      await launcher.waitFor();
      assert.equal(await page.evaluate(() => window.history.state.profileImageEditor.target), 'avatar');
      await launcher.getByRole('button', { name: 'Use image', exact: true }).click();await closed();
      assert.deepEqual(await page.evaluate(() => [window.fixture.profile.profilePic,window.fixture.store.getState().profile.loggedUser.image,
        window.fixture.profile.billboard]), await page.evaluate(() => [window.fixture.avatar,window.fixture.avatar,window.fixture.oldCover]));
      if (width >= 600) await page.getByRole('button', { name: 'Toggle sidebar' }).click();
      await open('cover');await checkInspection('cover');await generate('cover');
      await launcher.getByRole('button', { name: 'Use image', exact: true }).click();await closed();
      assert.deepEqual(await page.evaluate(() => [window.fixture.profile.billboard,window.fixture.store.getState().profile.loggedUser.userbillboard1,
        window.fixture.store.getState().profile.loggedUser.image]), await page.evaluate(() => [window.fixture.cover,window.fixture.cover,window.fixture.avatar]));
      // Direct opens the real native file chooser and existing CropImageModal with the correct aspect.
      for (const target of ['avatar', 'cover']) {
        await open(target);
        await page.waitForFunction(() => !window.fixture.snapshot().navigation.areas['clikb.navigation.profile_image'].state.loadingCurrent);
        assert.equal(await page.locator('.profile-image-preview').getAttribute('src'), await page.evaluate(target => {
          const active=window.fixture.store.getState().profile.loggedUser;
          return target==='cover'?active.userbillboard1:active.image;
        }, target), 'both saved targets preload on reopen');
        const chooserReady = page.waitForEvent('filechooser');
        await launcher.getByRole('button', { name: 'Upload image', exact: true }).click();
        const chooser = await chooserReady;
        await chooser.setFiles({ name: 'profile.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="teal"/></svg>') });
        await page.locator('.reactEasyCrop_CropArea').waitFor();
        assert.equal(await page.getByRole('button', { name: 'Save', exact: true }).count(), 1);
        const crop = await page.locator('.reactEasyCrop_CropArea').boundingBox();
        assert.ok(Math.abs(crop.width / crop.height - (target === 'cover' ? 16/9 : 1)) < .02);
        assert.equal(await page.evaluate(() => Boolean(window.history.state.profileImageCrop)), true);
        if (target === 'avatar') {
          await page.goBack();
          await page.locator('.reactEasyCrop_CropArea').waitFor({state:'hidden'});await launcher.waitFor();
          assert.equal(await page.evaluate(() => window.fixture.requests.filter(r=>r.endpoint==='/profile-image/upload').length), 0);
          assert.equal(await page.evaluate(() => window.history.state.profileImageEditor.target), 'avatar');
          const chooseAgain = page.waitForEvent('filechooser');
          await launcher.getByRole('button', {name:'Upload image',exact:true}).click();
          await (await chooseAgain).setFiles({name:'profile.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="teal"/></svg>')});
          await page.locator('.reactEasyCrop_CropArea').waitFor();
        }
        const before = await page.evaluate(() => window.fixture.store.getState().profile.loggedUser);
        await page.getByRole('button', {name:'Save',exact:true}).click();
        await page.locator('.reactEasyCrop_CropArea').waitFor({ state: 'hidden' });
        await launcher.waitFor();
        assert.deepEqual(await page.evaluate(() => window.fixture.store.getState().profile.loggedUser), before, 'Direct crop must not persist the member');
        assert.equal(await page.evaluate(() => window.fixture.snapshot().navigation.areas['clikb.navigation.profile_image'].state.imageMode), 'edit');
        assert.equal(await page.evaluate(() => window.fixture.snapshot().navigation.areas['clikb.navigation.profile_image'].state.previewSource), 'direct');
        assert.equal(await page.evaluate(() => window.history.state.profileImageEditor.target), target);
        await launcher.getByRole('button', {name:'Use image',exact:true}).click();await closed();
        assert.equal(await page.evaluate(target => {
          const user=window.fixture.store.getState().profile.loggedUser;
          return target==='cover'?user.userbillboard1===window.fixture.directCover:user.image===window.fixture.directAvatar;
        },target),true);
        assert.equal(await page.locator('output').getAttribute('data-route'), '/pages');
      }
      // Discarding an edited result leaves the saved avatar intact; Remove also waits for Use image.
      await open('avatar');await generate('avatar');
      await launcher.getByRole('button', {name:'Close image creator',exact:true}).click();await closed();
      assert.equal(await page.evaluate(()=>window.fixture.store.getState().profile.loggedUser.image), await page.evaluate(()=>window.fixture.directAvatar));
      await open('avatar');
      await page.waitForFunction(() => !window.fixture.snapshot().navigation.areas['clikb.navigation.profile_image'].state.loadingCurrent);
      await launcher.getByRole('button', {name:'Remove image',exact:true}).click();
      assert.equal(await page.locator('.profile-image-preview').count(),0);
      assert.equal(await page.evaluate(()=>window.fixture.store.getState().profile.loggedUser.image), await page.evaluate(()=>window.fixture.directAvatar));
      await launcher.getByRole('button', {name:'Close image creator',exact:true}).click();await closed();
      assert.equal(await page.evaluate(()=>window.fixture.requests.filter(r=>r.endpoint==='/profile-image/remove').length),0);
      await open('cover');
      await page.waitForFunction(() => !window.fixture.snapshot().navigation.areas['clikb.navigation.profile_image'].state.loadingCurrent);
      await launcher.getByRole('button', {name:'Remove image',exact:true}).click();
      await launcher.getByRole('button', {name:'Use image',exact:true}).click();await closed();
      assert.deepEqual(await page.evaluate(()=>{const active=window.fixture.store.getState().profile.loggedUser;
        return [active.image,active.userbillboard1,window.fixture.profile.billboard];}), await page.evaluate(()=>[window.fixture.directAvatar,'','']));
      // A committed Use survives native Back and cannot close the next editor.
      await open('avatar');await generate('avatar');
      await page.evaluate(() => { window.fixture.holdUse = true; });
      await launcher.getByRole('button', { name: 'Use image', exact: true }).click();
      await page.waitForFunction(() => Boolean(window.fixture.releaseUse));
      await page.goBack();await closed();
      await open('cover');
      await page.evaluate(() => { window.fixture.holdUse = false;window.fixture.releaseUse();delete window.fixture.releaseUse; });
      await page.waitForTimeout(150);
      assert.equal(await launcher.count(), 1);
      assert.equal(await page.evaluate(() => window.history.state.profileImageEditor.target), 'cover');
      // An old parent's response must never overwrite the active child's Redux or local header.
      await generate('cover');
      await page.evaluate(() => { window.fixture.holdUse = true; });
      await launcher.getByRole('button', { name: 'Use image', exact: true }).click();
      await page.waitForFunction(() => Boolean(window.fixture.releaseUse));
      await page.evaluate(() => window.fixture.switchChild());
      await launcher.waitFor({ state: 'hidden' });
      await page.evaluate(() => { window.fixture.holdUse=false;window.fixture.releaseUse(); });
      await page.waitForTimeout(150);
      assert.deepEqual(await page.evaluate(() => {const state=window.fixture.store.getState().profile.loggedUser;
        return [state.id,state.ownerId,state.image,state.userbillboard1,window.fixture.profile.id,window.fixture.profile.billboard];}),
      await page.evaluate(() => [8,7,window.fixture.oldAvatar,window.fixture.oldCover,8,window.fixture.oldCover]));
      await page.evaluate(() => window.fixture.other());
      await page.waitForFunction(() => window.fixture.profile.id === 9);
      assert.equal(await visibleHeader('change_avatar').count(), 0);
      assert.equal(await visibleHeader('change_banner').count(), 0);
      assert.deepEqual(errors, []);
      await page.close();
      console.log('PASS '+width+'px actual ProfileInfo: duplicate mounts, avatar/cover, Direct crop, route Back, completed Use and child identity isolation');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
