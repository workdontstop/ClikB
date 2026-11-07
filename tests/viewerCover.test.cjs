const test = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { environment, renderFixture, settle, nodes, settingsModule, fullscreenCaptionFixtures } = require('./viewerCoverFixtures.cjs');
const { getVideoControlBounds, shouldHideVideoCaption, videoPlaybackKey } = require('./promptTestBindings.cjs').loadTypeScript('src/videoPlaybackLayout.ts');
const playerProps = extra => ({ index: 0, src: 'portrait.mp4', isActive: true, isUIHidden: true, setUIHidden() {}, matchMobile: false,
  isNineTwelve: true, isMenuOpen: false, item: { id: 21, ratio: 1 }, playvid: true, muted: true, darkMode: true,
  singleMode: false, onRefAssign() {}, ...extra });
const coverProps = extra => ({ image: 'fallback.webp', sceneImages: [{ id: 'scene-a', image: 'first.webp' }, { id: 'scene-b', image: 'second.webp' }],
  PostId: 'fixture-cover', type: 1, prompt: 'Original caption', title: 'Original cover', steps: ['a', 'b'], DummyMode: false,
  setGeneratedImage() {}, closeT() {}, ...extra });

test('contain geometry fits portrait, square, landscape, offset containers and mobile letterboxing', () => {
  const box = { left: 0, top: 0, width: 1200, height: 800 };
  assert.deepEqual(getVideoControlBounds(box, 800, 1080, 1920), { left: 375, bottom: 0, width: 450 });
  assert.deepEqual(getVideoControlBounds(box, 800, 1000, 1000), { left: 200, bottom: 0, width: 800 });
  assert.deepEqual(getVideoControlBounds(box, 800, 1920, 1080), { left: 0, bottom: 62.5, width: 1200 });
  assert.deepEqual(getVideoControlBounds({ left: 20, top: 10, width: 390, height: 844 }, 864, 1920, 1080),
    { left: 20, bottom: 322.3125, width: 390 });
  assert.deepEqual(getVideoControlBounds(box, 800, 0, 0), { left: 0, bottom: 0, width: 1200 });
});

test('actual player measures metadata and resize, keeps controls usable and avoids geometry work on time updates', () => {
  const fixture = renderFixture('src/VideoPlayer.tsx', playerProps());
  fixture.find(x => x.type === 'video').props.onPointerDownCapture(); fixture.render();
  let row = fixture.find(x => x.type === 'div');
  assert.equal(row.props.style.width, 450); assert.equal(row.props.style.left, 375);
  assert.equal(row.props.style.boxSizing, 'border-box');
  assert.equal(fixture.find(x => x.type === 'button').props.style.width, '42px');
  assert.equal(fixture.find(x => x.type === 'input').props.style.minWidth, 0);
  const reads = fixture.env.rectangleReads;
  for (let i = 0; i < 100; i++) { fixture.env.video.currentTime = i / 10; fixture.find(x => x.type === 'video').props.onTimeUpdate(); fixture.render(); }
  assert.equal(fixture.env.rectangleReads, reads);
  fixture.env.video.videoWidth = 1920; fixture.env.video.videoHeight = 1080;
  fixture.find(x => x.type === 'video').props.onLoadedMetadata(); fixture.render();
  row = fixture.find(x => x.type === 'div'); assert.equal(row.props.style.width, 1200); assert.equal(row.props.style.bottom, 62.5);
  fixture.env.rect = { left: 0, top: 0, width: 800, height: 600 }; fixture.env.container.clientHeight = 600;
  const beforeResize = fixture.env.rectangleReads;
  fixture.env.observers.at(-1).callback(); fixture.env.observers.at(-1).callback(); fixture.render();
  assert.equal(fixture.env.rectangleReads, beforeResize + 1);
  assert.equal(fixture.find(x => x.type === 'div').props.style.width, 800);
  fixture.env.video.videoWidth = 0; fixture.env.video.videoHeight = 0;
  fixture.render({ src: 'square.mp4' });
  assert.equal(fixture.env.observers[0].disconnected, true);
  assert.equal(fixture.find(x => x.type === 'div').props.style.width, 800);
  fixture.env.video.videoWidth = 1080; fixture.env.video.videoHeight = 1080;
  fixture.find(x => x.type === 'video').props.onLoadedMetadata(); fixture.render();
  assert.equal(fixture.find(x => x.type === 'div').props.style.width, 600);
  assert.equal(fixture.find(x => x.type === 'div').props.style.left, 100);
  fixture.unmount(); assert.equal(fixture.env.observers.at(-1).disconnected, true); assert.equal(fixture.env.timers.size, 0);
});

test('actual playback events drive both fullscreen caption branches and seeker pause wins while username actions remain', () => {
  const branches = fullscreenCaptionFixtures(); assert.equal(branches.captions.length, 2); assert.equal(branches.playback.length, 2);
  for (let branch = 0; branch < 2; branch++) {
    const state = {}; const key = videoPlaybackKey(21, branch ? 'single.mp4' : 'scene.mp4');
    const onPlaybackChange = branches.playback[branch]({ item: { id: 21, xv1: 'single.mp4' }, index: 0, videoArray: ['scene.mp4'],
      reportVideoPlayback(id, source, playing) { state[videoPlaybackKey(id, source)] = playing; } });
    let seekerOpen = false;
    const fixture = renderFixture('src/VideoPlayer.tsx', playerProps({ onPlaybackChange, isUIHidden: false,
      setUIHidden(hidden) { seekerOpen = hidden; } }));
    const profile = [];
    function caption(seeker = false, normalVideo = true, expanded = false) {
      const hidden = shouldHideVideoCaption(normalVideo, Boolean(state[key]), seeker);
      const element = branches.captions[branch]({ index: 0, verticalActiveIndex: 0, captionExpanded: expanded && !hidden,
        hidePlayingCaption: hidden, fullscreenAreaId: 'fixture', type: 1, matchMobile: false, item: { mode: 0 },
        feeds: [{ username: 'author', sender: 7, caption: 'Saved caption' }], setActiveCap() {}, setHideT() {},
        GotoProfile(...args) { profile.push(args); }, darkModeReducer: true });
      return { element, caption: nodes(element, x => x.type === 'span' && x.props.children === ' Saved caption')[0],
        username: nodes(element, x => x.type === 'span' && x.props.children === '@author')[0] };
    }
    fixture.env.video.paused = false;
    fixture.find(x => x.type === 'video').props.onPlay(); fixture.render();
    assert.equal(state[key], true); assert.equal(caption().caption.props.style.display, 'none');
    caption().username.props.onClick({ stopPropagation() {} }); assert.equal(profile[0][0], 7);
    fixture.env.video.paused = true;
    fixture.find(x => x.type === 'video').props.onPause(); fixture.render();
    assert.equal(caption().caption.props.style.display, 'inline');
    fixture.find(x => x.type === 'video').props.onClick(); fixture.env.clock += 100;
    fixture.find(x => x.type === 'video').props.onClick(); fixture.render({ isUIHidden: seekerOpen });
    assert.equal(seekerOpen, true); assert.equal(caption(seekerOpen).caption.props.style.display, 'none');
    fixture.find(x => x.type === 'input').props.onChange({ target: { value: '8' }, stopPropagation() {} });
    assert.equal(fixture.env.video.currentTime, 8);
    assert.equal(caption(seekerOpen).caption.props.style.display, 'none');
    fixture.env.clock += 400; fixture.find(x => x.type === 'video').props.onClick(); fixture.env.clock += 100;
    fixture.find(x => x.type === 'video').props.onClick(); fixture.render({ isUIHidden: seekerOpen });
    assert.equal(seekerOpen, false);
    assert.equal(caption(false, false, true).element.props.sx.height, '70vh');
    assert.equal(caption(false).caption.props.style.display, 'inline');
    const replacementKey = videoPlaybackKey(22, 'replacement.mp4');
    const replacementCallback = branches.playback[branch]({ item: { id: 22, xv1: 'replacement.mp4' }, index: 0, videoArray: ['replacement.mp4'],
      reportVideoPlayback(id, source, playing) { state[videoPlaybackKey(id, source)] = playing; } });
    fixture.render({ src: 'replacement.mp4', onPlaybackChange: replacementCallback });
    assert.equal(state[key], false); assert.equal(state[replacementKey], false);
    fixture.env.video.paused = false;
    fixture.find(x => x.type === 'video').props.onPlay(); fixture.render();
    assert.equal(state[replacementKey], true); assert.equal(state[key], false);
    fixture.unmount(); assert.equal(state[replacementKey], false);
  }
});

test('actual mobile landscape controls use displayed width and bottom after letterboxing', () => {
  const env = environment(); env.rect = { left: 0, top: 0, width: 390, height: 844 }; env.container.clientHeight = 844;
  env.video.videoWidth = 1920; env.video.videoHeight = 1080;
  const fixture = renderFixture('src/VideoPlayer.tsx', playerProps({ matchMobile: true, mobileViewportHeight: '844px' }), env);
  fixture.find(x => x.type === 'video').props.onPointerDownCapture(); fixture.render();
  const style = fixture.find(x => x.type === 'div').props.style;
  assert.equal(style.width, 390); assert.equal(style.bottom, 312.3125);
  assert.equal(fixture.find(x => x.type === 'button').props.style.width, '42px');
  assert.equal(fixture.find(x => x.type === 'input').props.style.height, '28px');
  fixture.unmount();
});

test('entry and viewer visibility transitions read already-playing media even without another play event', () => {
  const env = environment(), states = []; env.video.paused = false;
  const fixture = renderFixture('src/VideoPlayer.tsx', playerProps({ playvid: false, onPlaybackChange: playing => states.push(playing) }), env);
  assert.equal(states.at(-1), true, 'Entry must report an already-playing cached node');
  fixture.render({ playvid: true }); assert.equal(states.at(-1), true);
  fixture.render({ playvid: false }); assert.equal(states.at(-1), true, 'The UI flag must not fabricate a paused state');
  fixture.render({ playvid: true }); assert.equal(states.at(-1), true);
  env.video.paused = true; fixture.find(x => x.type === 'video').props.onCanPlay(); fixture.render();
  assert.equal(states.at(-1), false, 'Blocked/paused media must retain its caption');
  fixture.unmount();
});

test('shared reducer mute/volume propagate between actual players and reject invalid levels', () => {
  const settings = settingsModule(); const env = environment(settings);
  const first = renderFixture('src/VideoPlayer.tsx', playerProps(), env);
  first.find(x => x.type === 'video').props.onPointerDownCapture(); first.render();
  first.find(x => x.type === 'button').props.onClick({ stopPropagation() {} }); first.render();
  assert.equal(env.state.settings.fullscreenMute, false);
  env.video.volume = 0.35; first.find(x => x.type === 'video').props.onVolumeChange(); first.render();
  assert.equal(env.state.settings.playbackVolume, 0.35);
  const secondEnv = environment(settings); secondEnv.state = env.state;
  const second = renderFixture('src/VideoPlayer.tsx', playerProps({ src: 'other.mp4', muted: true }), secondEnv);
  assert.equal(secondEnv.video.muted, false); assert.equal(secondEnv.video.volume, 0.35);
  env.dispatch(settings.setPlaybackVolume(4)); assert.equal(env.state.settings.playbackVolume, 1);
  env.dispatch(settings.setPlaybackVolume(-1)); assert.equal(env.state.settings.playbackVolume, 0);
  env.dispatch(settings.setPlaybackVolume(NaN)); assert.equal(env.state.settings.playbackVolume, 0);
  first.unmount(); second.unmount();
});

test('cover defaults to first scene, preserves caption/text/crops through selection/collapse and saves chosen source', async () => {
  const fixture = renderFixture('src/Thumbnail.tsx', coverProps()); fixture.loadCurrentImage(); await settle(fixture);
  assert.equal(fixture.env.draws.at(-1).source, 'first.webp');
  fixture.findControl('caption').props.onChange({ target: { value: 'Authored caption' } });
  fixture.findControl('cover_text').props.onChange({ target: { value: 'Authored cover' } }); fixture.render();
  fixture.findControl('toggle_crop').props.onClick(); fixture.render();
  const canvas = fixture.find(x => x.type === 'canvas'); canvas.props.onMouseDown({ clientX: 0, clientY: 0 }); fixture.render();
  fixture.find(x => x.type === 'canvas').props.onMouseMove({ clientX: 100, clientY: 0 }); fixture.render();
  fixture.find(x => x.type === 'canvas').props.onMouseUp(); fixture.render();
  const firstCrop = fixture.env.draws.at(-1).x;
  fixture.findControl('cover_scene_scene-b').props.onClick(); fixture.render();
  assert.equal(fixture.findControl('save_post').props.disabled, true); fixture.loadCurrentImage();
  fixture.findControl('toggle_scene_list').props.onClick(); fixture.render();
  assert.equal(fixture.findControl('cover_scene_scene-b'), undefined);
  assert.equal(fixture.findControl('toggle_scene_list').props.sx.color, '#aa33cc');
  assert.equal(fixture.findControl('caption').props.value, 'Authored caption');
  assert.equal(fixture.findControl('cover_text').props.value, 'Authored cover');
  fixture.findControl('toggle_scene_list').props.onClick(); fixture.render();
  fixture.findControl('cover_scene_scene-a').props.onClick(); fixture.render(); fixture.loadCurrentImage();
  assert.equal(fixture.env.draws.at(-1).x, firstCrop);
  fixture.findControl('cover_scene_scene-b').props.onClick(); fixture.render(); fixture.loadCurrentImage();
  const selectionStarted = performance.now();
  for (let i = 0; i < 40; i++) { fixture.findControl('toggle_scene_list').props.onClick(); fixture.render(); }
  assert.ok(performance.now() - selectionStarted < 1000, 'local collapse fixture should settle promptly');
  assert.equal(fixture.env.calls.filter(call => call.url.endsWith('/GptTagger')).length, 1);
  assert.equal(fixture.env.calls.length, 1, 'selection/collapse must make no generation or save calls');
  assert.equal(fixture.env.colorReads, 1, 'selection must not repeat expensive text colour sampling');
  fixture.findControl('save_post').props.onClick(); await settle(fixture);
  const upload = fixture.env.calls.find(call => call.blobText);
  assert.equal(JSON.parse(upload.blobText).source, 'second.webp');
  const saved = fixture.env.calls.find(call => call.url.endsWith('/UpdatePostThumb'));
  assert.equal(saved.body.values.caption, 'Authored caption'); assert.equal(saved.body.values.finalUrl, 'https://fixture.invalid/chosen.webp');
  fixture.unmount();
});

test('Blob previews retain stable URLs on parent renders, ignore late image loads and revoke only owned URLs', async () => {
  const a = new Blob(['a']), b = new Blob(['b']);
  const props = coverProps({ PostId: 'blob-fixture', prompt: '', sceneImages: [{ id: 'a', image: a }, { id: 'b', image: b }] });
  const fixture = renderFixture('src/Thumbnail.tsx', props);
  const lateImage = fixture.env.images.at(-1); fixture.loadCurrentImage();
  const ownedBefore = fixture.env.owned.length;
  fixture.render({ sceneImages: props.sceneImages.map(scene => ({ ...scene })) });
  assert.equal(fixture.env.owned.length, ownedBefore);
  fixture.findControl('cover_scene_b').props.onClick(); fixture.render(); fixture.loadCurrentImage();
  const chosen = fixture.env.draws.at(-1).source; lateImage.onload(); fixture.render();
  assert.equal(fixture.env.draws.at(-1).source, chosen);
  fixture.unmount();
  assert.equal(new Set(fixture.env.revoked).size, fixture.env.owned.length);
  assert.ok(fixture.env.revoked.every(url => url.startsWith('blob:fixture-')));
});
