const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { build } = require('esbuild');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const fixture = `
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';
import {BrowserRouter} from 'react-router-dom';
import {ChatProvider,useSocialChat} from './src/SocialChat';
import BottomMenu from './src/BottomMenu';
import MenuSlider from './src/MenuSlider';
import {matchMobile} from './src/DetectDevice';
import EmotionsGate from './src/EmotionsGate';
import {store} from './src/store';
import {setLoggedUser} from './src/profileSlice';
import {setThemePreference,setAutoControl,setAutoControlVisible,setConciergeEnabled} from './src/settingsSlice';
import {observeCurrentAppSnapshot,handleNavigationBrowserRequest} from './src/navigationBrowserControl';
store.dispatch(setLoggedUser({id:7,username:'owner',name:'Owner',image:'',imageThumb:''}));
store.dispatch(setThemePreference(innerWidth < 600 ? 'dark' : 'light'));
store.dispatch(setAutoControlVisible({visible:true,actor:'user'}));
store.dispatch(setAutoControl({enabled:true,actor:'user'}));
store.dispatch(setConciergeEnabled(true));
const makeTime = id => new Date(1700000000000 + id * 1000).toISOString();
const notifications = Array.from({length:500},(_,index)=>({
  id:500-index,authorId:8,username:'reader',kind:index===0?'welcome':'reply',
  ...(index===0?{body:'Welcome to ClikBSocial.'}:{postId:102,postTitle:'Post 102'}),
  createdAt:makeTime(500-index)
}));
const legacy = Array.from({length:95},(_,index)=>({id:'legacy-'+(95-index),authorId:8,username:'reader',body:'Legacy '+(95-index),createdAt:makeTime(95-index),postId:102}));
const rooms = Array.from({length:85},(_,index)=>({id:85-index,authorId:185-index,username:'room'+(85-index),unread:0,lastMessageId:850-index}));
const sockets = new Set();
window.fixture = {snapshot:observeCurrentAppSnapshot,requests:[],notifications,legacy,rooms,badgeCount:0,emit:event=>sockets.forEach(socket=>socket.onmessage?.({data:JSON.stringify(event)}))};
window.WebSocket = class {
  constructor(){sockets.add(this);setTimeout(()=>this.onopen?.(),0);}
  send(){setTimeout(()=>this.onmessage?.({data:'{"scope":"ready"}'}),0);}
  close(){sockets.delete(this);}
};
window.fetch = async (input,options={})=>{
  const url = new URL(String(input),location.origin);
  if(url.pathname.endsWith('/navigation/browser-reply')){
    window.fixture.reply=JSON.parse(options.body).reply;
    return Response.json({ok:true});
  }
  window.fixture.requests.push(url.pathname+url.search);
  const before = Number(url.searchParams.get('before')) || Infinity;
  if(url.pathname.endsWith('/notifications/delete')){
    const {id}=JSON.parse(options.body);
    const index=notifications.findIndex(row=>row.id===id);
    if(index>=0)notifications.splice(index,1);
    return Response.json({deleted:index>=0});
  }
  if(url.pathname.endsWith('/notifications/read'))return Response.json({ok:true});
  if(url.pathname.endsWith('/notifications')){
    if(url.searchParams.get('unreadOnly')==='1')return Response.json({unread:window.fixture.badgeCount});
    const rows=notifications.filter(row=>row.id<before);
    return Response.json({notifications:rows.slice(0,40),unread:notifications.length,hasMore:rows.length>40});
  }
  if(url.pathname.endsWith('/messages')){
    const beforeLegacy=Number(url.searchParams.get('legacyBefore')) || Infinity;
    const rows=url.searchParams.get('skipLegacy')==='1'?[]:legacy.filter(row=>Number(row.id.slice(7))<beforeLegacy);
    const page=rows.slice(0,40);
    return Response.json({messages:[],legacy:page,hasMore:false,legacyHasMore:rows.length>40,legacyBefore:page.length?Number(page.at(-1).id.slice(7)):null});
  }
  if(url.pathname.endsWith('/rooms')){
    const room=Number(url.searchParams.get('beforeRoom')) || Infinity;
    const rows=rooms.filter(row=>row.id<room);
    const page=rows.slice(0,40);
    const last=page.at(-1);
    return Response.json({rooms:page,hasMore:rows.length>40,nextCursor:last?{lastMessageId:last.lastMessageId,roomId:last.id}:null});
  }
  throw Error('Unexpected fixture request '+url.pathname);
};
window.fixture.click=async actionId=>{
  const snapshot=observeCurrentAppSnapshot();
  await handleNavigationBrowserRequest({requestId:Math.random().toString(),command:'action',actionId,expectedVersion:snapshot.navigation.stateVersion},location.origin);
  return window.fixture.reply.status;
};
function App(){
  const {open}=useSocialChat();
  const [panel,setPanel]=useState('');
  const [isMenuOpen,setIsMenuOpen]=useState(false);
  const [MenuOpenb,setMenuOpenb]=useState(false);
  const menuProps={isMenuOpen,setIsMenuOpen,MenuOpenb,setMenuOpenb,activeIndex:-1,feedContainerRef:{current:null}};
  return <><button onClick={()=>open()}>Open Chat</button><button onClick={()=>setPanel('following')}>Open Following</button>
    <button onClick={()=>setPanel('likes')}>Open Likes</button>
    <BottomMenu {...menuProps}/>
    {(isMenuOpen||MenuOpenb) && <div data-testid="menu-drawer" style={{position:'fixed',inset:'40px auto 0 0',width:270,zIndex:500}}>
      <MenuSlider {...menuProps} type={matchMobile?1:0} isMenuOpen={matchMobile?false:MenuOpenb}/>
    </div>}
    {panel && <EmotionsGate showEmotions ownerId={7} onClose={()=>setPanel('')} defaultView="following"
      initiallastidfan={0} setlastid={()=>{}} Likes={panel==='likes'} Postid={102} />}
  </>;
}
createRoot(document.getElementById('root')).render(<Provider store={store}><BrowserRouter><ChatProvider><App/></ChatProvider></BrowserRouter></Provider>);
`;

(async () => {
  const bundle = await build({
    stdin: { contents: fixture, loader: 'tsx', resolveDir: root },
    bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
    define: { 'import.meta.env': JSON.stringify({ VITE_CLIK_URL: 'http://fixture.test' }) },
    loader: { '.css': 'empty', '.png': 'dataurl', '.webp': 'dataurl' },
  });
  const html = '<style>body{margin:0;font-family:system-ui}</style><style>' + fs.readFileSync(path.join(root, 'src/SocialChat.css'), 'utf8') + '</style><div id="root"></div><script>' + bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script') + '</script>';
  const browser = await chromium.launch({ headless: true, executablePath: process.env.SPATIAL_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, ...(width === 390 ? {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
        hasTouch: true,
      } : {}) });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/*', route => route.request().isNavigationRequest() ? route.fulfill({ contentType: 'text/html', body: html }) : route.abort());
      let following = true;
      const relationshipRequests = [];
      await page.route('**/fanpeople', route => {
        const { ownerId, viewerId } = route.request().postDataJSON().values;
        assert.deepEqual([ownerId, viewerId], [7, 7]);
        const row = { id: 8, username: 'reader', fan_id: 1, viewer_follows_user: following, user_follows_viewer: true };
        return route.fulfill({ json: { counts: { following: Number(following), followers: 1 },
          followers: [row], following: following ? [row] : [] } });
      });
      await page.route('**/fantoggle', route => {
        const request = route.request().postDataJSON().values;
        relationshipRequests.push(request);
        following = request.action === 'follow';
        return route.fulfill({ json: { state: following ? 'followed' : 'unfollowed', following, countDelta: following ? 1 : -1 } });
      });
      await page.route('**/likesx', route => route.fulfill({ json: { likes: [], counts: { likes: 0 } } }));
      await page.goto('http://fixture.test/feeds');
      const menu = page.getByRole('button', { name: 'Menu', exact: true });
      const dot = '.social-unread-dot';
      await menu.waitFor();
      assert.equal(await menu.locator(dot).count(), 0);
      const menuIconColor = await menu.locator('svg').evaluate(icon => getComputedStyle(icon).color);
      await page.evaluate(() => { window.fixture.badgeCount = 1; window.fixture.emit({scope:'notifications'}); });
      await menu.locator(dot).waitFor();
      assert.equal(await menu.locator('svg').evaluate(icon => getComputedStyle(icon).color), menuIconColor);
      await menu.click();
      const chatAction = page.locator('[data-ai-action="clikb.navigation.menu.action.chat"]');
      await chatAction.locator(dot).waitFor();
      assert.equal(await menu.locator(dot).count(), 0);
      if (width === 390) {
        await chatAction.click();
        await page.getByRole('dialog', { name: 'Chat' }).waitFor();
        await page.getByTestId('menu-drawer').waitFor({ state: 'hidden' });
        await page.getByRole('button', { name: 'Close Chat' }).click();
        await page.getByRole('dialog', { name: 'Chat' }).waitFor({ state: 'hidden' });
        await menu.locator(dot).waitFor();
        await page.evaluate(() => { window.fixture.badgeCount = 0; window.fixture.emit({scope:'notifications'}); });
        await menu.locator(dot).waitFor({ state: 'hidden' });
      }
      await page.getByRole('button', { name: 'Open Chat', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Feeds', exact: true }).getAttribute('aria-pressed'), 'true');
      const panel = await page.getByRole('dialog', { name: 'Chat' }).boundingBox();
      const glass = await page.locator('.social-panel').evaluate(element => getComputedStyle(element).backgroundImage);
      assert.equal(panel.width, width === 390 ? 390 : 640);
      assert.equal(panel.height, width === 390 ? 810 : 720);
      if (width === 390) assert.equal(panel.y, 90);
      await page.mouse.click(width / 2, 10);
      await page.getByRole('dialog', { name: 'Chat' }).waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'Open Following', exact: true }).click();
      assert.deepEqual(await page.locator('.social-panel').boundingBox(), panel);
      assert.equal(await page.locator('.social-panel').evaluate(element => getComputedStyle(element).backgroundImage), glass);
      await page.getByRole('button', { name: 'Unfollow', exact: true }).click();
      await page.getByText('No following yet', { exact: true }).waitFor();
      assert.deepEqual(relationshipRequests, [{ userid: 7, favid: 8, action: 'unfollow' }]);
      await page.getByRole('button', { name: 'Following', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Followers (1)', exact: true }).click();
      await page.getByRole('dialog', { name: 'Followers', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Follow', exact: true }).click();
      await page.getByRole('button', { name: 'Following (1)', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Unfollow', exact: true }).click();
      await page.getByRole('button', { name: 'Following', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Follow', exact: true }).waitFor();
      assert.deepEqual(relationshipRequests.map(({ userid, favid, action }) => [userid, favid, action]),
        [[7, 8, 'unfollow'], [7, 8, 'follow'], [7, 8, 'unfollow']]);
      await page.mouse.click(width / 2, 10);
      await page.getByRole('dialog', { name: 'Followers', exact: true }).waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'Open Likes', exact: true }).click();
      assert.deepEqual(await page.locator('.social-panel').boundingBox(), panel);
      await page.mouse.click(width / 2, 10);
      await page.getByRole('dialog', { name: 'Likes', exact: true }).waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'Open Chat', exact: true }).click();
      await page.getByRole('button', { name: 'Notifications', exact: true }).click();
      await page.waitForFunction(() => window.fixture.snapshot().navigation?.areas['clikb.navigation.social_chat']?.state.loadedNotificationCount === 40);
      assert.equal(await page.getByRole('button', { name: 'Notifications', exact: true }).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.getByText('Welcome to ClikBSocial.', { exact: true }).count(), 1);
      const load = async () => {
        const button = page.getByRole('button', { name: 'Load older activity', exact: true });
        await button.scrollIntoViewIfNeeded();
        await button.click();
        await page.waitForFunction(() => !window.fixture.snapshot().navigation.areas['clikb.navigation.social_chat'].state.busy);
      };
      for (let index = 0; index < 10; index += 1) await load();
      await page.waitForFunction(() => window.fixture.snapshot().navigation.areas['clikb.navigation.social_chat'].state.loadedNotificationCount === 440);
      await page.evaluate(() => window.fixture.emit({ scope: 'notifications' }));
      await page.waitForTimeout(150);
      assert.equal(await page.locator('.social-chat-notification').count(), 440);
      await page.locator('[data-navigation-scroll-id="notification_500"]').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => window.fixture.snapshot().navigation.availableActions.some(action => action.actionId.endsWith('.dismiss_500')));
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => window.fixture.click('clikb.navigation.social_chat.action.dismiss_500')), 'observed_change');
      await page.waitForFunction(() => !document.querySelector('[data-navigation-scroll-id="notification_500"]'));
      assert.equal(await page.evaluate(() => window.fixture.notifications.some(row => row.id === 500)), false);
      assert.equal(await page.evaluate(() => location.pathname), '/feeds');
      await page.getByRole('button', { name: 'Feeds', exact: true }).click();
      await page.waitForFunction(() => window.fixture.snapshot().navigation.areas['clikb.navigation.social_chat'].state.loadedMessageCount === 40);
      await load(); await load();
      await page.waitForFunction(() => window.fixture.snapshot().navigation.areas['clikb.navigation.social_chat'].state.loadedMessageCount === 95);
      assert.equal(await page.getByRole('button', { name: 'Load older activity', exact: true }).count(), 0);
      assert.ok(await page.evaluate(() => window.fixture.requests.some(url => url.includes('legacyBefore=56') && url.includes('skipMessages=1'))));
      await page.getByRole('button', { name: 'Rooms', exact: true }).click();
      await page.waitForFunction(() => window.fixture.snapshot().navigation.areas['clikb.navigation.social_chat'].state.loadedRoomCount === 40);
      await load(); await load();
      await page.waitForFunction(() => window.fixture.snapshot().navigation.areas['clikb.navigation.social_chat'].state.loadedRoomCount === 85);
      await page.evaluate(() => window.fixture.emit({ scope: 'rooms' }));
      await page.waitForTimeout(150);
      assert.equal(await page.locator('[data-navigation-scroll-id^="room_"]').count(), 85);
      assert.equal(await page.getByRole('button', { name: 'Load older activity', exact: true }).count(), 0);
      assert.deepEqual(errors, []);
      await page.close();
      console.log('PASS '+width+'px Feeds default, shared panels, Following and Followers updates, scoped dismissal, 440 retained notifications, legacy paging and 85 Rooms');
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
