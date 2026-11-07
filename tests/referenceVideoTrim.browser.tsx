import React, { useCallback, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { Button } from '@mui/material';
import { alpha, darken } from '@mui/material/styles';
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary';
import axios from 'axios';
import ModalVideoPreview from '/src/ModalVideoPreview.tsx';
import MediaPromptVideo from '/src/MediaPromptVideo.tsx';
import { store } from '/src/store.ts';
import { creationBinding as cb } from '/src/creationControlSnapshot.ts';
import { SaveVideoHelperForDelLater } from '/src/SavepromptHelpersLocal.ts';
import { IMMUTABLE_VIDEO_CACHE_CONTROL } from '/src/mediaCachePolicy.ts';

// The runner replaces the markers with production declarations and JSX from
// EditStory. Video decoding and every Axios request are deterministic local
// doubles: this harness cannot start a provider job or a real transcoder.
const calls: any[] = [];
const errors: any[] = [];
const processingChanges: boolean[] = [];
let uploadNumber = 0;
let failTrim = false;
let holdTrim = false;
let releaseTrim: (() => void) | undefined;
let metadata = { duration: 20, width: 1920, height: 1080 };
const timeline = new WeakMap<HTMLMediaElement, number>();
const sourceUrls = new WeakMap<HTMLMediaElement, string>();
Object.defineProperty(HTMLMediaElement.prototype, 'duration', { configurable: true, get: () => metadata.duration });
Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { configurable: true, get: () => metadata.width });
Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { configurable: true, get: () => metadata.height });
Object.defineProperty(HTMLMediaElement.prototype, 'currentTime', {
    configurable: true,
    get() { return timeline.get(this) || 0; },
    set(value) { timeline.set(this, value); },
});
HTMLMediaElement.prototype.play = () => Promise.resolve();
HTMLMediaElement.prototype.pause = () => {};
HTMLMediaElement.prototype.load = () => {};
Object.defineProperty(HTMLMediaElement.prototype, 'src', {
    configurable: true,
    get() { return sourceUrls.get(this) || this.getAttribute('src') || ''; },
    set(value) {
        sourceUrls.set(this, value);
        setTimeout(() => this.dispatchEvent(new Event('loadedmetadata')), 20);
    },
});
document.addEventListener('error', event => {
    if (event.target instanceof HTMLVideoElement) event.stopImmediatePropagation();
}, true);
const seenVideos = new WeakSet<HTMLVideoElement>();
new MutationObserver(() => {
    document.querySelectorAll('video').forEach(video => {
        if (seenVideos.has(video)) return;
        seenVideos.add(video);
        setTimeout(() => video.dispatchEvent(new Event('loadedmetadata')), 30);
    });
}).observe(document.body, { childList: true, subtree: true });

axios.defaults.adapter = async config => {
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
    const call = { method: config.method, url: config.url, body, headers: config.headers.toJSON() };
    calls.push(call);
    let data: any = {};
    if (config.url?.endsWith('/get_signed_url_video')) {
        uploadNumber++;
        data = { holder: [{ urlVideo: location.origin + `/__upload/raw-${uploadNumber}.mp4?fixture=1` }] };
    } else if (config.method === 'put' && config.url?.includes('/__upload/')) {
        data = {};
    } else if (config.url?.endsWith('/Trim-video')) {
        if (holdTrim) await new Promise<void>(resolve => { releaseTrim = resolve; });
        if (failTrim) {
            failTrim = false;
            throw { response: { data: { error: 'Fixture trim failed; try again.' } } };
        }
        data = { videoUrl: location.origin + `/__media/trimmed-${uploadNumber}.mp4` };
    } else if (!config.url?.endsWith('/del-video')) {
        throw new Error('Unexpected network request blocked: ' + config.url);
    }
    return { data, status: 200, statusText: 'OK', headers: {}, config };
};

const globalErrorEmitter = { emit: (message: string, index: number) => errors.push({ message, index }) };
const query = new URLSearchParams(location.search);
const appColor = query.get('accent') || '#71d5ee', darkMode = query.get('light') !== '1', darkModeReducer = darkMode;
const CLIK_URL = '/api';
const compactGlassButtonSx = {};

function App() {
    const standalone = new URLSearchParams(location.search).get('surface') === 'modal';
    const context = new URLSearchParams(location.search).get('surface') === 'context';
    const [index, setIndex] = useState(0);
    const [time, setTime] = useState(5);
    const [referenceVideoUrls, setReferenceVideoUrls] = useState(['', '']);
    const [referenceVideoActiveList, setReferenceVideoActiveList] = useState([false, false]);
    const captureSceneTarget = useCallback((sceneIndex: number) => ({ id: `scene-${sceneIndex}` }), []);
    const resolveSceneTargetIndex = useCallback((target: any) => Number(target.id.split('-')[1]), []);

    /* EDIT_STORY_DECLARATIONS */

    const standaloneFile = useMemo(() => new File(['fixture'], 'reference.mp4', { type: 'video/mp4' }), []);
    const [standaloneOpen, setStandaloneOpen] = useState(true);
    const [standaloneMounted, setStandaloneMounted] = useState(true);
    const [standaloneMode, setStandaloneMode] = useState<'reference' | undefined>('reference');
    const [callbackVersion, setCallbackVersion] = useState(0);
    const [successes, setSuccesses] = useState<any[]>([]);
    const [currentimage, setCurrentimage] = useState('');
    const [standaloneMin, setStandaloneMin] = useState(2);
    const [contextDirect, setContextDirect] = useState(false);
    const contextCalls = useRef<string[]>([]);
    const frameImage = useMemo(() => {
        const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 96;
        canvas.getContext('2d')!.fillStyle = '#5975a0'; canvas.getContext('2d')!.fillRect(0, 0, 64, 96);
        return canvas.toDataURL();
    }, []);
    (window as any).test = {
        state: () => ({ index, time, referenceVideoUrls, referenceVideoActiveList,
            pending: pendingReferenceVideo ? { durationCap: pendingReferenceVideo.durationCap, target: pendingReferenceVideo.target } : null,
            uploading: isRefVideoUploading, calls, errors, processingChanges, successes,
            queued: JSON.parse(localStorage.getItem('helpervideosprompt') || '[]'), contextDirect, contextCalls: contextCalls.current }),
        metadata: (next: any) => {
            metadata = next;
            document.querySelectorAll('.MuiDialog-root video').forEach(video => video.dispatchEvent(new Event('loadedmetadata')));
        },
        time: setTime,
        navigate: setIndex,
        failTrim: () => { failTrim = true; },
        holdTrim: () => { holdTrim = true; },
        releaseTrim: () => { holdTrim = false; releaseTrim?.(); },
        unmountModal: () => setStandaloneMounted(false),
        mountModal: () => { setStandaloneMounted(true); setStandaloneOpen(true); },
        updateCallback: () => setCallbackVersion(value => value + 1),
        motion: () => {
            const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 800;
            setCurrentimage(canvas.toDataURL()); setStandaloneMode(undefined); setStandaloneMin(0);
        },
    };
    return <main style={{ padding: 24, minHeight: 760, background: '#14181d', color: '#fff' }}>
        <p data-scene>Scene {index + 1}</p>
        {!standalone && !context && <>
            {/* EDIT_STORY_PICKER */}
            {/* EDIT_STORY_BUTTON */}
            {/* EDIT_STORY_MODAL */}
        </>}
        {standalone && standaloneMounted && <ModalVideoPreview
            appColor={appColor} darkMode={darkMode} open={standaloneOpen}
            file={standaloneFile} videoDurationCap={time} mode={standaloneMode}
            maxFileSizeBytes={100 * 1024 * 1024} minSegmentSeconds={standaloneMin}
            currentimage={currentimage} onClose={() => setStandaloneOpen(false)}
            onProcessingChange={processing => processingChanges.push(processing)}
            onUploadSuccess={url => setSuccesses(previous => [...previous, { url, callbackVersion }])}
        />}
        {context && <MediaPromptVideo index={0} VideoArrayCloud={[location.origin + '/__media/history-1.mp4']}
            currentImage={frameImage} onSelectStepback={() => contextCalls.current.push('stepback')}
            onToggleContext={setContextDirect} isDirectMode={contextDirect} darkMode={darkMode}
            appColor={appColor} matchMobile={innerWidth < 600} CreationMode="Video"
            onResetToDefault={() => contextCalls.current.push('default')}
            onSaveDrawnFrame={() => contextCalls.current.push('save-draw')}
            onUpgradeDrawnFrame={() => contextCalls.current.push('upgrade-draw')}
            onUseDrawFrameSource={() => contextCalls.current.push('use-draw-source')}
            onResetDrawFrame={() => contextCalls.current.push('reset-draw')}
        />}
    </main>;
}
createRoot(document.getElementById('root')!).render(<Provider store={store}><App /></Provider>);
