import { useMemo, useState } from 'react';
import InteractInput from './InteractInput';
import type { Hotspot, BranchTuple } from './TouchInteractionModel';

export interface FullscreenInteractionItem {
    id: number;
    inttype?: number;
    intbg?: number;
    main?: string;
    subl?: string;
    subr?: string;
    mainaud?: string;
    sub1aud?: string;
    sub2aud?: string;
    touchConfigJson?: string;
    touchlx?: unknown; touchly?: unknown; touchlr?: unknown;
    touchrx?: unknown; touchry?: unknown; touchrr?: unknown;
}

function initialHotspots(item: FullscreenInteractionItem): BranchTuple<Hotspot> {
    const defaults: BranchTuple<Hotspot> = [
        { id: 'left', x: .3, y: .6, r: .12 }, { id: 'right', x: .7, y: .6, r: .12 },
        { id: 'top', x: .5, y: .28, r: .12 }, { id: 'bottom', x: .5, y: .78, r: .12 },
    ];
    const values = [item.touchlx, item.touchly, item.touchlr, item.touchrx, item.touchry, item.touchrr].map(Number);
    if (item.inttype === 1 && values.every(Number.isFinite)) {
        defaults[0] = { id: 'left', x: values[0], y: values[1], r: values[2] };
        defaults[1] = { id: 'right', x: values[3], y: values[4], r: values[5] };
    }
    return defaults;
}

/** Key by post ID at the call site. No media state is copied from the old active row. */
type PlayerProps = {
    item: FullscreenInteractionItem; setActiveStory: (value: boolean) => void; snapshotObscured: boolean;
};
export default function FullscreenInteractionPlayer(props: PlayerProps) {
    const { item } = props;
    // Saved media edits to the SAME post also establish a new session. Likes,
    // caption visibility and other feed updates do not reset a running game.
    const version = useMemo(() => JSON.stringify([item.id, item.inttype, item.intbg, item.main, item.subl, item.subr,
        item.mainaud, item.sub1aud, item.sub2aud, item.touchConfigJson,
        item.touchlx, item.touchly, item.touchlr, item.touchrx, item.touchry, item.touchrr]),
    [item.id, item.inttype, item.intbg, item.main, item.subl, item.subr, item.mainaud, item.sub1aud, item.sub2aud,
        item.touchConfigJson, item.touchlx, item.touchly, item.touchlr, item.touchrx, item.touchry, item.touchrr]);
    return <InteractionSession key={version} {...props} />;
}

function InteractionSession({ item, setActiveStory, snapshotObscured }: PlayerProps) {
    const [mode, setMode] = useState<'swipe' | 'touch'>(() => item.inttype === 1 ? 'touch' : 'swipe');
    const [stage, setStage] = useState(2);
    const [hotspots, setHotspots] = useState(() => initialHotspots(item));
    const [mainAudio, setMainAudio] = useState(item.mainaud ?? '');
    const [leftAudio, setLeftAudio] = useState(item.sub1aud ?? '');
    const [rightAudio, setRightAudio] = useState(item.sub2aud ?? '');
    const [mainAudioX, setMainAudioX] = useState('');
    const [leftAudioX, setLeftAudioX] = useState('');
    const [rightAudioX, setRightAudioX] = useState('');
    const videos: [string, string, string] = [item.main ?? '', item.subl ?? '', item.subr ?? ''];
    return <InteractInput
        intbg={item.intbg} setActiveStory={setActiveStory} feedData={item} interactionPostId={item.id}
        videoArray={videos} vid1={videos[0]} vid2={videos[1]} vid3={videos[2]}
        mode={mode} setmode={setMode} stage={stage} setStage={setStage}
        mainAudioUrl={mainAudio} sub1AudioUrl={leftAudio} sub2AudioUrl={rightAudio}
        setMainAudioUrl={setMainAudio} setSub1AudioUrl={setLeftAudio} setSub2AudioUrl={setRightAudio}
        mainAudioUrlx={mainAudioX} sub1AudioUrlx={leftAudioX} sub2AudioUrlx={rightAudioX}
        setMainAudioUrlx={setMainAudioX} setSub1AudioUrlx={setLeftAudioX} setSub2AudioUrlx={setRightAudioX}
        touchHotspots={hotspots} setTouchHotspots={setHotspots}
        wipeInteractionState={() => {}} feeds={true} snapshotObscured={snapshotObscured}
    />;
}
