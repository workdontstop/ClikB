const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { build } = require('esbuild');
const { chromium } = require(process.env.SPATIAL_PLAYWRIGHT_MODULE || '../.tmp/concierge-browser-deps/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const baseline = process.argv.includes('--baseline');
const fixture = `
import React,{useState,useRef,useMemo,useEffect} from 'react';import {createRoot} from 'react-dom/client';
import {Provider} from 'react-redux';import {BrowserRouter,useLocation} from 'react-router-dom';
import FullScreenStories from './src/FullScreenStories';import {useDeckNavigation} from './src/useDeckNavigation';import {store} from './src/store';
import {ChatProvider,useSocialChat} from './src/SocialChat';import {setLoggedUser} from './src/profileSlice';
import {setThemePreference,setAutoControlVisible,setAutoControl,setConciergeEnabled} from './src/settingsSlice';
import {handleNavigationBrowserRequest,observeCurrentAppSnapshot} from './src/navigationBrowserControl';
import {feedsExecutionContext} from './server/src/FeedsExecutionContext';
function OpenMenuChat(){const {open}=useSocialChat();return <button onClick={()=>open()} style={{position:'fixed',top:5,left:5,zIndex:10030}}>Menu Chat</button>;}
const noop=()=>{};window.fixture={delay:new URLSearchParams(location.search).has('delay')};
const chatFixture=new URLSearchParams(location.search).has('chatFixture');
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="540" height="960"><rect width="540" height="960" fill="#35597a"/></svg>');
function App(){
 const location=useLocation(),owner=location.pathname==='/pages'?Number(location.state?.userId||235):0;
 const source=useMemo(()=>[0,1,2].map(i=>({id:owner*100+101+i,sender:owner===235?236:235,username:'author',caption:'Post '+(owner*100+101+i),profile_image:image,item1:image,x1:image,mode:0,ratio:0,...(chatFixture&&!owner&&i===1?{videoUrl:'/fixture-video.mp4'}:{})})),[owner]);
 const [collection,setCollection]=useState({owner:-1,feeds:[]});
 useEffect(()=>{const timer=setTimeout(()=>setCollection({owner,feeds:source}),window.fixture.delay?220:0);return()=>clearTimeout(timer);},[owner,source]);
 const loading=collection.owner!==owner,feeds=loading?[]:collection.feeds;
 const [index,setIndex]=useState(0),[active,setActive]=useState(null),[fullscreen,setFullscreen]=useState(false),[horizontal,setHorizontal]=useState(0),[videos,setVideos]=useState([]),[audio,setAudio]=useState([]),[generated,setGenerated]=useState([]),[liked,setLiked]=useState([]),[counts,setCounts]=useState([]);
 const refs=useRef([]),container=useRef(null),audioRef=useRef(null),feedRef=useRef(null);
 const deck=useDeckNavigation({feeds,category:owner?'page':'games',enabled:!location.state?.fullscreen,loading,collectionScope:'owner:'+owner,minimisePrompt:true,autoOpen:false,
 fullscreenPostId:fullscreen?feeds[index]?.id:null,getScroll:()=>({x:0,y:0}),restoreScroll:noop,prepareDeck:noop,onCreate:noop,
 onFullscreen:id=>{const next=feeds.findIndex(post=>post.id===id);setFullscreen(next>=0);setActive(next>=0?next:null);if(next>=0)setIndex(next);}});
 window.fixture.state=()=>({owner,loading,fullscreen,post:feeds[index]?.id,tier:location.state?.clikbDeck?.tier,search:location.search});
 return <>{fullscreen&&<OpenMenuChat/>}<section data-grid={owner}>{feeds.map(post=><button key={post.id} onClick={()=>deck.openPost(post.id)}>{post.caption}</button>)}</section>
 {deck.isDeckOpen&&<section data-deck={owner}><button onClick={deck.play}>Play</button><button onClick={deck.close}>Close Deck</button></section>}
 {fullscreen&&feeds.length>0&&<FullScreenStories feeds={feeds} activeIndex={active} setActiveIndex={setActive} verticalActiveIndex={index} setverticalActiveIndex={setIndex}
 IsFullscreen={fullscreen} setIsFullscreen={setFullscreen} fullscreenRefsX={refs} fullScreenContainerRef={container} feedContainerRef={feedRef}
 audioPlaying={false} setAudioPlaying={noop} horizontalActiveIndex={horizontal} setHorizontalActiveIndex={setHorizontal}
 generatedAudios={generated} setGeneratedAudios={setGenerated} AudioArray={audio} setAudioArray={setAudio} audioElementRef={audioRef}
 videoArray={videos} setVideoArray={setVideos} storyVidArray={[]} setStoryVidArray={noop} LastId={null} setLastId={noop}
 isMenuOpen={false} type={owner?10:chatFixture?4:3} closePop={deck.close} searchData="" MyPageId={owner||null} likedArray={liked} setLikedArray={setLiked}
 likeCountArray={counts} setLikeCountArray={setCounts} setLikesPostid={noop} setLikes={noop} setShowEmotions={noop} showEmotions={false}
 setsearchDataNav={noop} setMyPageIdNav={noop} setfeedLastIdNav={noop} setfeedScrollPosNav={noop}/>}</>;
}
if(chatFixture){
 store.dispatch(setThemePreference(innerWidth<600?'dark':'light'));
 store.dispatch(setConciergeEnabled(true));
 store.dispatch(setAutoControlVisible({visible:true,actor:'user'}));
 store.dispatch(setAutoControl({enabled:true,actor:'user'}));
 store.dispatch(setLoggedUser({id:7,name:'Owner',username:'owner',image:'',imageThumb:''}));
 window.fixture.snapshot=observeCurrentAppSnapshot;
 window.fixture.feedsContext=feedsExecutionContext;
 window.fixture.execute=handleNavigationBrowserRequest;
 window.fixture.theme=mode=>store.dispatch(setThemePreference(mode));
 window.fixture.control=enabled=>store.dispatch(setAutoControl({enabled,actor:'user'}));
 const playing=new WeakSet();
 Object.defineProperty(HTMLMediaElement.prototype,'paused',{get(){return !playing.has(this)}});
 HTMLMediaElement.prototype.play=function(){playing.add(this);this.dispatchEvent(new Event('play'));return Promise.resolve()};
 HTMLMediaElement.prototype.pause=function(){if(playing.delete(this))this.dispatchEvent(new Event('pause'))};
 const originalFetch=window.fetch;
 window.fetch=(input,options)=>{
  const url=String(input);
  const json=data=>Promise.resolve(Response.json(data));
  if(url.includes('/navigation/browser-reply')){window.fixture.reply=JSON.parse(options.body).reply;return json({ok:true});}
  if(url.includes('/social/post-activity?'))return json({hasMessages:new URL(url,location.origin).searchParams.get('postId')==='102'});
  if(!url.includes('/social/'))return originalFetch(input,options);
  if(url.endsWith('/social/messages')&&options?.method==='POST'){
   window.fixture.sent=JSON.parse(options.body);return json({id:35});
  }
  if(url.endsWith('/social/rooms'))return json(options?.method==='POST'?{id:73}:{rooms:[{id:72,authorId:8,username:'reader'}]});
  if(url.includes('/social/members?'))return json({members:[{authorId:72,username:'other-member'}]});
  if(url.includes('notifications?'))return json({notifications:[{id:12,kind:'reply',postId:102,postTitle:'Post 102',username:'reply-author'},{id:13,kind:'like',postId:101,postTitle:'Post 101',username:'like-author'}],unread:2,hasMore:false});
  return json({messages:[{id:34,authorId:8,username:'reader',body:'First sentence. Second sentence. Third sentence is expanded.',postId:102,postThumb:image}],legacy:[],hasMore:false});
 };
 window.fixture.socketTimes=[];
 window.WebSocket=class {
  constructor(){setTimeout(()=>this.onopen?.(),0);}
  send(subscription){if(JSON.parse(subscription).scope!=='notifications'||history.state?.usr?.socialChat)window.fixture.socketTimes.push(performance.now());setTimeout(()=>this.onmessage?.({data:'{"scope":"ready"}'}),0);}
  close(){}
 };
}
createRoot(document.getElementById('root')).render(<Provider store={store}><BrowserRouter><ChatProvider><App/></ChatProvider></BrowserRouter></Provider>);
`;
(async () => {
 const bundle = await build({ stdin:{contents:fixture,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',
 loader:{'.css':'empty','.png':'dataurl','.jpg':'dataurl','.webp':'dataurl','.svg':'dataurl'},logLevel:'silent',define:{'import.meta.env':JSON.stringify({VITE_CLIK_URL:'http://fixture.test',PROD:false,DEV:true})},
 plugins:[{name:'profile-return',setup(b){
  if(baseline)b.onLoad({filter:/[\\/]FullScreenStories\.tsx$/},()=>({contents:execFileSync('git',['show','c71bed9:src/FullScreenStories.tsx'],{cwd:root,encoding:'utf8'}),loader:'tsx',resolveDir:path.join(root,'src')}));
  b.onResolve({filter:/^(axios|.*\/(Sandbox|InteractInput|SpatialExperiencePlayer|FollowPanel|EditPost|Plan|DetectDevice))$/},args=>({path:args.path,namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='axios'?`export default {post:async()=>({data:{payload:[],holder:[]}}),put:async()=>({data:{}})};`:/DetectDevice/.test(args.path)?`export const matchMobile=innerWidth<600,matchPc=!matchMobile,matchTablet=false;`:`export default function Stub(){return null;}`,loader:'js'}));
 }}]});
 const html='<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}'+fs.readFileSync(path.join(root,'src/SocialChat.css'),'utf8')+'</style><div id="root"></div><script>'+bundle.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script>';
 const browser=await chromium.launch({headless:true,executablePath:process.env.SPATIAL_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try {
  for(const width of baseline?[1440]:[1440,390]) for(const delayed of baseline?[false]:[false,true]) for(const nested of baseline?[false]:[false,true]){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',r=>r.request().isNavigationRequest()?r.fulfill({contentType:'text/html',body:html}):r.abort());
   await page.goto('http://fixture.test/clikit?keep=source'+(delayed?'&delay=1':'')+(!baseline&&!delayed&&!nested?'&chatFixture=1':'')+'#saved');
   await page.getByText('Post 101',{exact:true}).click();
   await page.locator('[data-deck="0"]').waitFor().catch(async error=>{console.error({errors,state:await page.evaluate(()=>({url:location.href,history:history.state,fixture:window.fixture?.state?.(),body:document.body.innerText.slice(0,500)}))});throw error;});await page.getByText('Play',{exact:true}).click();
   await page.locator('[data-fullscreen-stories]').waitFor();
   if(!baseline&&!delayed&&!nested){
    const firstPostChat=page.locator('[data-fullscreen-actions]').getByRole('button',{name:'Post chat',exact:true});
    await firstPostChat.waitFor();
    assert.equal(await firstPostChat.locator('[data-post-chat-indicator]').count(),0);
   }
   await page.evaluate(()=>{const scroller=document.querySelector('[data-fullscreen-stories]');scroller.scrollTo({top:scroller.clientHeight,behavior:'instant'});});
   await page.waitForFunction(()=>history.state?.usr?.clikbDeck?.activePostId===102);
   const original=await page.evaluate(()=>({url:location.href,state:history.state.usr,idx:history.state.idx}));
   if(!baseline && !delayed && !nested){
    const postChat=page.locator('[data-fullscreen-actions]').getByRole('button',{name:'Post chat',exact:true});
    await postChat.locator('[data-post-chat-indicator]').waitFor();
    assert.equal(await postChat.getAttribute('title'),'Post chat · Has messages');
    const activeVideo=page.locator('[data-playback-post-id="102"] video');
    await activeVideo.waitFor({state:'attached'});
    await activeVideo.evaluate(video=>video.play());
    for(const [theme,ink] of [['dark','rgb(255, 255, 255)'],['light','rgb(0, 0, 0)']]){
      await page.evaluate(mode=>window.fixture.theme(mode),theme);
      assert.equal(await postChat.evaluate(el=>getComputedStyle(el).color),ink);
    }
    await page.waitForFunction(()=>window.fixture.snapshot().feeds?.availableActions.some(a=>a.actionId.endsWith('.open_post_chat')&&a.targetId===102));
    const dispatchStatus=await page.evaluate(async()=>{
      const {feeds}=window.fixture.snapshot();
      const {actionId}=feeds.availableActions.find(a=>a.actionId.endsWith('.open_post_chat')&&a.targetId===102);
      const expectedFeedsContext=window.fixture.feedsContext(feeds,actionId);
      const oldContext=JSON.stringify({...JSON.parse(expectedFeedsContext),targetId:101});
      const command={command:'action',actionId,expectedVersion:feeds.stateVersion};
      await window.fixture.execute({...command,requestId:'test-stale-post-chat',expectedFeedsContext:oldContext},'http://fixture.test');
      const stale=window.fixture.reply.status;
      await window.fixture.execute({...command,requestId:'test-exact-post-chat',expectedFeedsContext},'http://fixture.test');
      return [stale,window.fixture.reply.status];
    });
    assert.deepEqual(dispatchStatus,['stale_or_unavailable','observed_change']);
    await page.getByRole('dialog',{name:'Chat'}).waitFor();
    assert.equal(await activeVideo.evaluate(video=>video.paused),true);
    await activeVideo.evaluate(video=>{
      window.fixture.control(false);
      video.dispatchEvent(new Event('ended'));
    });
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(()=>window.fixture.state().post),102);
    await page.evaluate(()=>window.fixture.control(true));
    for(const [theme,ink] of [['dark','rgb(248, 248, 251)'],['light','rgb(24, 32, 42)']]){
      await page.evaluate(mode=>window.fixture.theme(mode),theme);
      assert.equal(await page.getByRole('dialog',{name:'Chat'}).evaluate(el=>getComputedStyle(el).color),ink);
    }
    assert.equal(await page.evaluate(()=>history.state.usr.socialChat.postId),102);
    assert.equal(await page.getByRole('button',{name:'Post',exact:true}).getAttribute('aria-pressed'),'true');
    const chatAction = async name => {
      const actionId = `clikb.navigation.social_chat.action.${name}`;
      await page.waitForFunction(id=>window.fixture.snapshot().navigation?.availableActions.some(a=>a.actionId===id),actionId);
      const result = await page.evaluate(async id=>{
        const snapshot=window.fixture.snapshot();
        await window.fixture.execute({requestId:`test-${id}`,command:'action',actionId:id,
          expectedVersion:snapshot.navigation.stateVersion},'http://fixture.test');
        return window.fixture.reply.status;
      },actionId);
      assert.equal(result,'observed_change',name);
    };
    await page.getByRole('button',{name:'Read more',exact:true}).waitFor();
    await page.waitForFunction(()=>window.fixture.snapshot().navigation?.availableActions.some(a=>a.actionId==='clikb.navigation.social_chat.action.compose'));
    await page.waitForFunction(()=>window.fixture.snapshot().navigation.areas['clikb.navigation.social_chat'].state.messagePreview1);
    const initialPreview=await page.evaluate(()=>window.fixture.snapshot().navigation.areas['clikb.navigation.social_chat'].state.messagePreview1);
    assert.match(initialPreview,/Second sentence/);
    assert.doesNotMatch(initialPreview,/Third sentence/);
    await chatAction('expand_34');
    await page.waitForFunction(()=>window.fixture.snapshot().navigation.areas['clikb.navigation.social_chat'].state.expandedMessagePart1?.includes('Third sentence'));
    await chatAction('options_34');
    assert.equal(await page.getByRole('button',{name:'Report',exact:true}).count(),1);
    await chatAction('options_34');
    await chatAction('reply_34');
    await chatAction('remove_reference');
    const write=await page.evaluate(async()=>{
      const snapshot=window.fixture.snapshot();
      await window.fixture.execute({requestId:'test-chat-text',command:'text',actionId:'clikb.navigation.social_chat.action.compose',
       text:'A reply from the user',expectedVersion:snapshot.navigation.stateVersion},'http://fixture.test');
      return window.fixture.reply.status;
    });
    assert.equal(write,'observed_change');
    assert.equal(await page.getByRole('textbox',{name:'Message'}).inputValue(),'A reply from the user');
    await chatAction('send');
    assert.deepEqual(await page.evaluate(()=>window.fixture.sent),{channel:'post',body:'A reply from the user',postId:102});
    await chatAction('tab_rooms');
    await chatAction('room_open_72');
    await page.waitForFunction(()=>history.state.usr.socialChat.roomId===72);
    await chatAction('room_list');
    await chatAction('new_room');
    await page.getByRole('textbox',{name:'Find a member by username'}).fill('other');
    await chatAction('room_member_72');
    await page.waitForFunction(()=>history.state.usr.socialChat.roomId===73);
    await page.getByRole('button',{name:'Close Chat',exact:true}).click();
    await page.getByRole('dialog',{name:'Chat'}).waitFor({state:'hidden'});
    assert.equal(await activeVideo.evaluate(video=>video.paused),false);
    await activeVideo.evaluate(video=>video.pause());
    assert.deepEqual(await page.evaluate(()=>({url:location.href,state:history.state.usr,idx:history.state.idx})),original);
    await page.getByRole('button',{name:'Menu Chat'}).click();
    await page.getByRole('dialog',{name:'Chat'}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Post',exact:true}).getAttribute('aria-pressed'),'true');
    assert.equal(await page.evaluate(()=>history.state.usr.socialChat.postId),102);
    await chatAction('tab_notifications');
    await page.getByRole('button',{name:/reply-author replied to you/}).waitFor();
    await page.waitForFunction(()=>Object.entries(window.fixture.snapshot().navigation?.areas['clikb.navigation.social_chat']?.state||{})
      .some(([key,value])=>key.startsWith('notificationPreview')&&String(value).includes('reply-author')));
    assert.doesNotMatch(await page.evaluate(()=>JSON.stringify(window.fixture.snapshot().conciergeFocus)),/reply-author|like-author/);
    await chatAction('notification_12');
    await page.waitForURL('**/experience/102');
    assert.deepEqual(await page.evaluate(()=>history.state.usr.socialChatPostIds),[102,101]);
    const liveReturn = await page.evaluate(()=>({count:window.fixture.socketTimes.length,time:performance.now()}));
    await page.goBack();
    assert.equal(await page.getByRole('button',{name:'Notifications',exact:true}).getAttribute('aria-pressed'),'true');
    assert.equal(await page.evaluate(()=>window.fixture.socketTimes.length),liveReturn.count);
    await page.waitForFunction(count=>window.fixture.socketTimes.length>count,liveReturn.count,{timeout:5000});
    assert.ok(await page.evaluate(({count,time})=>window.fixture.socketTimes[count]-time>=1900,liveReturn));
    await page.getByRole('button',{name:'Feeds',exact:true}).click();
    await page.getByRole('button',{name:'Pause live messages'}).click();
    const pausedCount = await page.evaluate(()=>window.fixture.socketTimes.length);
    await page.locator('.social-chat-post-thumb img').waitFor();
    await chatAction('post_34');
    await page.waitForURL('**/experience/102');
    await page.goBack();
    assert.equal(await page.getByRole('button',{name:'Feeds',exact:true}).getAttribute('aria-pressed'),'true');
    await page.getByRole('button',{name:'Resume live messages'}).waitFor();
    await page.waitForTimeout(2200);
    assert.equal(await page.evaluate(()=>window.fixture.socketTimes.length),pausedCount);
    await page.getByRole('button',{name:'Resume live messages'}).click();
    await page.waitForFunction(count=>window.fixture.socketTimes.length>count,pausedCount);
    await page.getByRole('button',{name:'Close Chat',exact:true}).click();
    await page.getByRole('dialog',{name:'Chat'}).waitFor({state:'hidden'});
    assert.equal(await activeVideo.evaluate(video=>video.paused),true);
    assert.deepEqual(await page.evaluate(()=>({url:location.href,state:history.state.usr,idx:history.state.idx})),original);
    console.log('PASS '+width+'px Post Chat opens above the active fullscreen post and returns to the exact viewer entry');
   }
   await page.locator('[data-fullscreen-stories] [data-ai-action$=".creator_profile"]').first().click();
   await page.getByText('Post 23601',{exact:true}).click();
   await page.locator('[data-deck="235"]').waitFor();await page.getByText('Play',{exact:true}).click();
   await page.waitForFunction(()=>window.fixture.state().owner===235&&window.fixture.state().fullscreen);
   await page.evaluate(()=>{const scroller=document.querySelector('[data-fullscreen-stories]');scroller.scrollTo({top:scroller.clientHeight,behavior:'instant'});});
   await page.waitForFunction(()=>history.state?.usr?.clikbDeck?.activePostId===23602);
   if(nested){
    const parent=await page.evaluate(()=>({url:location.href,state:history.state.usr,idx:history.state.idx}));
    await page.locator('[data-fullscreen-stories] [data-ai-action$=".creator_profile"]').first().click();
    await page.getByText('Post 23701',{exact:true}).click();await page.locator('[data-deck="236"]').waitFor();
    await page.getByText('Play',{exact:true}).click();await page.waitForFunction(()=>window.fixture.state().owner===236&&window.fixture.state().fullscreen);
    await page.goBack();await page.locator('[data-deck="236"]').waitFor();
    await page.goBack();await page.waitForFunction(()=>window.fixture.state().owner===236&&!window.fixture.state().tier);
    await page.goBack();await page.waitForFunction(()=>window.fixture.state().owner===235&&window.fixture.state().fullscreen&&window.fixture.state().post===23602);
    assert.deepEqual(await page.evaluate(()=>({url:location.href,state:history.state.usr,idx:history.state.idx})),parent,'Nested user navigation preserves its own fullscreen predecessor');
   }
   await page.goBack();await page.locator('[data-deck="235"]').waitFor();
   await page.goBack();await page.waitForFunction(()=>window.fixture.state().owner===235&&!window.fixture.state().tier&&!window.fixture.state().fullscreen);
   await page.goBack();
   if(baseline){await page.waitForTimeout(700);const state=await page.evaluate(()=>({url:location.href,state:history.state.usr}));assert.notEqual(state.state?.clikbDeck?.tier,'story');assert.notEqual(state.url,original.url);console.log('PASS reproduced baseline: other-user Grid Back loses original fullscreen state and URL');await page.close();continue;}
   await page.waitForFunction(()=>window.fixture.state().owner===0&&window.fixture.state().fullscreen&&window.fixture.state().post===102);
   assert.deepEqual(await page.evaluate(()=>({url:location.href,state:history.state.usr,idx:history.state.idx})),original,'Profile round trip must restore the exact original fullscreen entry');
   for(let repeat=0;repeat<2;repeat++){
    await page.goForward();await page.waitForFunction(()=>window.fixture.state().owner===235&&!window.fixture.state().tier);
    await page.goBack();await page.waitForFunction(()=>window.fixture.state().owner===0&&window.fixture.state().fullscreen&&window.fixture.state().post===102);
   }
   await page.goBack();await page.locator('[data-deck="0"]').waitFor();
   await page.goBack();await page.waitForFunction(()=>!window.fixture.state().tier&&!window.fixture.state().fullscreen);
   await page.goForward();await page.locator('[data-deck="0"]').waitFor();
   await page.goForward();await page.waitForFunction(()=>window.fixture.state().fullscreen&&window.fixture.state().post===102);
   assert.deepEqual(errors,[]);console.log('PASS '+width+'px delayed='+delayed+' nested='+nested+': fullscreen -> profile Deck -> fullscreen/scroll -> Deck -> Grid -> original fullscreen; Back/Forward retained');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
