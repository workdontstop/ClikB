import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useSelector } from 'react-redux';
import { PRECISE_MAX_REFERENCES, PRECISE_MAX_REGIONS, PRECISE_MAX_NOTE_LENGTH, type PreciseRegion as RequestRegion } from '../../server/src/preciseEditSpec';
import { assertPreciseRequestSize, preparePreciseImageRequest, type PreciseImageRequestCache } from './preciseImageRequest';
import { preciseFreeRectangle, preciseRegionConflicts } from './preciseRegionGeometry';
import './PreciseImageEditor.css';

const CLIK_URL = import.meta.env.VITE_CLIK_URL;
const MODELS = [{ id: 'flare', name: 'GPT Flare' }, { id: 'sunburst', name: 'GPT Sunburst' }, { id: 'krea', name: 'Krea 3' }] as const;
type Model = typeof MODELS[number]['id'];
export type PreciseRegion = RequestRegion;
type Region = PreciseRegion & { confirmed: boolean };
export type PreciseImageEditorSnapshot = { model: string; pixels: number; regions: number; references: number; status: string };
export type PreciseImageResult = { imageUrl: string; prompt: string; originalImagePrompt?: string; modelName: string };
export type PreciseImageEditorProps = {
    open: boolean;
    imageUrl: string;
    initialPrompt: string;
    originalContext?: unknown;
    references: Array<{ name: string; url: string }>;
    accentColor: string;
    onClose: () => void;
    onSave: (result: PreciseImageResult) => Promise<void>;
    /** Archive without replacing the current image. Retries should be idempotent by imageUrl. */
    onGenerated?: (result: PreciseImageResult) => Promise<void>;
    onSnapshot?: (snapshot: PreciseImageEditorSnapshot | null) => void;
};
type Gesture = {
    pointerId: number; id: string; kind: 'draw' | 'move' | 'resize';
    originX: number; originY: number; before: Region; conflict: boolean;
};
type PendingResult = { imageUrl: string; modelName: string; basePrompt: string; regions: PreciseRegion[]; prompt?: string; originalImagePrompt?: string };
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const toRequestRegion = ({ id, x, y, width, height, note }: Region): PreciseRegion => ({ id, x, y, width, height, note: note.trim() });
function readableError(error: unknown, fallback: string) {
    if (error && typeof error === 'object' && 'response' in error) {
        const data = (error as { response?: { data?: { error?: unknown; message?: unknown } } }).response?.data;
        const detail = data?.error || data?.message;
        if (typeof detail === 'string') return detail;
    }
    return error instanceof Error ? error.message : fallback;
}

/** All edits stay local until Save. This surface deliberately exposes no AI app actions. */
export default function PreciseImageEditor(props: PreciseImageEditorProps) {
    const { open, imageUrl, initialPrompt, originalContext, references, accentColor, onClose, onSave, onGenerated, onSnapshot } = props;
    const darkMode = useSelector((state: { settings: { darkMode: boolean } }) => state.settings.darkMode);
    const [model, setModel] = useState<Model>('krea');
    const [working, setWorking] = useState({ imageUrl, modelName: '' });
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [regions, setRegions] = useState<Region[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const [referencePicker, setReferencePicker] = useState(false);
    const [referenceUrls, setReferenceUrls] = useState<string[]>([]);
    const [quote, setQuote] = useState<{ key: string; pixels: number } | null>(null);
    const [quoteError, setQuoteError] = useState('');
    const [quoteRetry, setQuoteRetry] = useState(0);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState<'preparing' | 'generating' | 'reconciling' | 'archiving' | 'saving' | null>(null);
    const [imageLoading, setImageLoading] = useState(true);
    const [imageError, setImageError] = useState(false);
    const stageRef = useRef<HTMLDivElement>(null);
    const wellRef = useRef<HTMLDivElement>(null);
    const [wellSize, setWellSize] = useState({ width: 0, height: 0 });
    const [visibleViewport, setVisibleViewport] = useState<{ height: number; top: number } | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const noteRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
    const gestureRef = useRef<Gesture | null>(null);
    const regionsRef = useRef<Region[]>([]);
    const busyRef = useRef(false);
    const reconciledPromptRef = useRef(initialPrompt);
    const pendingResultRef = useRef<PendingResult | null>(null);
    const saveCacheRef = useRef<PreciseImageResult | null>(null);
    const requestCacheRef = useRef<PreciseImageRequestCache>(new Map());
    const sessionRef = useRef(0);
    const wasOpenRef = useRef(false);
    const nextRegionRef = useRef(1);
    const callbacksRef = useRef({ onClose, onSnapshot });
    callbacksRef.current = { onClose, onSnapshot };
    regionsRef.current = regions;

    const availableReferences = references.filter((reference, index, all) => !!reference.url && all.findIndex(item => item.url === reference.url) === index);
    const selectedReferences = availableReferences.filter(reference => referenceUrls.includes(reference.url)).slice(0, PRECISE_MAX_REFERENCES);
    const quoteKey = `${model}:${dimensions.width}:${dimensions.height}:${selectedReferences.length}`;
    const pixels = quote?.key === quoteKey && !imageLoading && !imageError ? quote.pixels : null;
    const referenceKey = selectedReferences.map(reference => reference.url).join('\n');
    const setRegionList = useCallback((update: (current: Region[]) => Region[]) => {
        setRegions(current => { const next = update(current); regionsRef.current = next; return next; });
    }, []);

    useEffect(() => {
        if (open && !wasOpenRef.current) {
            sessionRef.current += 1;
            setModel('krea'); setWorking({ imageUrl, modelName: '' }); setDimensions({ width: 0, height: 0 });
            setRegions([]); regionsRef.current = []; setSelected(null); setReferencePicker(false); setReferenceUrls([]);
            setQuote(null); setError(''); setQuoteError(''); setBusy(null); setImageLoading(true); setImageError(false);
            busyRef.current = false; reconciledPromptRef.current = initialPrompt; pendingResultRef.current = null; saveCacheRef.current = null; nextRegionRef.current = 1;
            requestCacheRef.current.clear();
        }
        if (!open && wasOpenRef.current) {
            sessionRef.current += 1;
            requestCacheRef.current.clear();
            callbacksRef.current.onSnapshot?.(null);
        }
        wasOpenRef.current = open;
    }, [open, imageUrl]);

    useEffect(() => {
        if (!open) return;
        const previousFocus = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        dialogRef.current?.focus();
        // Escape cannot cancel work in flight; Tab stays inside the full-screen dialog.
        const isolateKeyboard = (event: KeyboardEvent) => {
            event.stopImmediatePropagation();
            if (event.key === 'Escape') {
                event.preventDefault();
                if (!busyRef.current && !pendingResultRef.current) callbacksRef.current.onClose();
            }
            if (event.key === 'Tab') {
                const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]') || [])
                    .filter(element => element.offsetParent !== null);
                const first = focusable[0]; const last = focusable[focusable.length - 1];
                if (!first) { event.preventDefault(); return; }
                if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
                else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
            }
        };
        // React's delegated handlers need the event to reach the modal. Bubble isolation below
        // handles ordinary shortcuts; window capture only handles Escape and focus trapping.
        const keyboardCapture = (event: KeyboardEvent) => {
            if (event.key === 'Escape' || event.key === 'Tab') isolateKeyboard(event);
        };
        window.addEventListener('keydown', keyboardCapture, true);
        return () => {
            window.removeEventListener('keydown', keyboardCapture, true);
            document.body.style.overflow = previousOverflow;
            previousFocus?.focus();
        };
    }, [open]);

    useEffect(() => () => { callbacksRef.current.onSnapshot?.(null); sessionRef.current += 1; requestCacheRef.current.clear(); }, []);
    useEffect(() => {
        if (!open || !window.visualViewport) return;
        const viewport = window.visualViewport;
        const update = () => setVisibleViewport({ height: viewport.height, top: viewport.offsetTop });
        update(); viewport.addEventListener('resize', update); viewport.addEventListener('scroll', update);
        return () => { viewport.removeEventListener('resize', update); viewport.removeEventListener('scroll', update); };
    }, [open]);
    useEffect(() => {
        if (!open || !wellRef.current) return;
        const observer = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            setWellSize({ width, height });
        });
        observer.observe(wellRef.current);
        return () => observer.disconnect();
    }, [open]);
    useEffect(() => {
        if (!open) return;
        onSnapshot?.({ model, pixels: pixels ?? 0, regions: regions.length, references: selectedReferences.length,
            status: busy || (imageLoading ? 'loading' : imageError ? 'image-error' : quoteError ? 'quote-error' : 'ready') });
    }, [open, model, pixels, regions.length, selectedReferences.length, busy, imageLoading, imageError, quoteError, onSnapshot]);

    useEffect(() => {
        setQuote(null); setQuoteError('');
        if (!open || !dimensions.width || !dimensions.height || imageLoading || imageError) return;
        const controller = new AbortController();
        const options = { withCredentials: true, signal: controller.signal };
        void axios.post<{ pixels?: unknown }>(`${CLIK_URL}/preciseImage/quote`, { model, ...dimensions, referenceCount: selectedReferences.length }, options)
            .then(response => {
                if (controller.signal.aborted) return;
                const value = Number(response.data?.pixels);
                if (!Number.isFinite(value) || value <= 0) throw new Error('A price could not be loaded.');
                setQuote({ key: quoteKey, pixels: value });
            }).catch(reason => {
                if (!controller.signal.aborted) setQuoteError(readableError(reason, 'A price could not be loaded.'));
            });
        return () => controller.abort();
    }, [open, model, dimensions.width, dimensions.height, referenceKey, selectedReferences.length, imageLoading, imageError, quoteRetry, quoteKey]);

    const point = (event: React.PointerEvent) => {
        const bounds = stageRef.current!.getBoundingClientRect();
        return { x: clamp((event.clientX - bounds.left) / bounds.width), y: clamp((event.clientY - bounds.top) / bounds.height) };
    };
    const startGesture = (event: React.PointerEvent, region?: Region, kind: Gesture['kind'] = 'draw') => {
        if (busyRef.current || pendingResultRef.current || imageLoading || imageError || event.button !== 0 || gestureRef.current) return;
        if (!region && regionsRef.current.length >= PRECISE_MAX_REGIONS) { setError('You can add up to 8 regions per generation.'); return; }
        event.preventDefault(); event.stopPropagation();
        const origin = point(event);
        const next = region || { id: `region-${nextRegionRef.current++}`, x: origin.x, y: origin.y, width: 0, height: 0, note: '', confirmed: false };
        if (!region) setRegionList(current => [...current, next]);
        setSelected(next.id); setError('');
        gestureRef.current = { pointerId: event.pointerId, id: next.id, kind, originX: origin.x, originY: origin.y, before: { ...next }, conflict: false };
        stageRef.current?.setPointerCapture(event.pointerId);
    };
    const moveGesture = (event: React.PointerEvent) => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        event.preventDefault(); event.stopPropagation();
        const position = point(event); const { before } = gesture;
        let geometry: Pick<Region, 'x' | 'y' | 'width' | 'height'>;
        if (gesture.kind === 'draw') geometry = { x: Math.min(gesture.originX, position.x), y: Math.min(gesture.originY, position.y), width: Math.abs(position.x - gesture.originX), height: Math.abs(position.y - gesture.originY) };
        else if (gesture.kind === 'move') geometry = { ...before, x: clamp(before.x + position.x - gesture.originX, 0, 1 - before.width), y: clamp(before.y + position.y - gesture.originY, 0, 1 - before.height) };
        else geometry = { ...before, width: clamp(before.width + position.x - gesture.originX, .025, 1 - before.x), height: clamp(before.height + position.y - gesture.originY, .025, 1 - before.y) };
        const candidate = { ...before, ...geometry };
        gesture.conflict = preciseRegionConflicts(candidate, regionsRef.current);
        if (gesture.conflict) { setError('Regions cannot overlap.'); return; }
        setError('');
        setRegionList(current => current.map(item => item.id === gesture.id ? { ...item, ...geometry } : item));
    };
    const endGesture = (event: React.PointerEvent, cancelled = false) => {
        const gesture = gestureRef.current;
        if (!gesture || gesture.pointerId !== event.pointerId) return;
        event.stopPropagation(); gestureRef.current = null;
        if (stageRef.current?.hasPointerCapture(event.pointerId)) stageRef.current.releasePointerCapture(event.pointerId);
        const region = regionsRef.current.find(item => item.id === gesture.id);
        if (cancelled || gesture.conflict) setRegionList(current => gesture.kind === 'draw' ? current.filter(item => item.id !== gesture.id) : current.map(item => item.id === gesture.id ? gesture.before : item));
        else if (gesture.kind === 'draw' && (!region || region.width < .015 || region.height < .015)) {
            const geometry = preciseFreeRectangle(regionsRef.current.filter(item => item.id !== gesture.id), { x: gesture.originX, y: gesture.originY });
            if (geometry) setRegionList(current => current.map(item => item.id === gesture.id ? { ...item, ...geometry } : item));
            else { setRegionList(current => current.filter(item => item.id !== gesture.id)); setError('Regions cannot overlap.'); }
        }
    };

    const addRegion = () => {
        if (busyRef.current || pendingResultRef.current || regions.length >= PRECISE_MAX_REGIONS || imageLoading || imageError) return;
        const geometry = preciseFreeRectangle(regionsRef.current);
        if (!geometry) { setError('There is no room for another region.'); return; }
        const id = `region-${nextRegionRef.current++}`;
        setRegionList(current => [...current, { id, ...geometry, note: '', confirmed: false }]);
        setSelected(id); window.setTimeout(() => noteRefs.current[id]?.focus(), 0);
    };
    const changeRegion = (id: string, changes: Partial<Region>) => {
        const original = regionsRef.current.find(region => region.id === id);
        if (!original) return;
        const candidate = { ...original, ...changes };
        if (preciseRegionConflicts(candidate, regionsRef.current)) { setError('Regions cannot overlap.'); return; }
        setError(''); setRegionList(current => current.map(region => region.id === id ? candidate : region));
    };
    const removeRegion = (id: string) => { setRegionList(current => current.filter(region => region.id !== id)); setSelected(current => current === id ? null : current); };

    const processPendingResult = async (session: number): Promise<PreciseImageResult | null> => {
        const pending = pendingResultRef.current;
        if (!pending) return saveCacheRef.current;
        if (!pending.prompt) {
            setBusy('reconciling');
            const response = await axios.post<{ prompt: string; originalImagePrompt?: string }>(`${CLIK_URL}/reconcilePreciseImagePrompt`, { prompt: pending.basePrompt, originalContext, imageUrl: pending.imageUrl, edits: [{ regions: pending.regions }] }, { withCredentials: true, timeout: 180000 });
            if (session !== sessionRef.current) return null;
            if (typeof response.data?.prompt !== 'string' || !response.data.prompt.trim()) throw new Error('The updated prompt could not be prepared. Press Save to retry.');
            pending.prompt = response.data.prompt;
            if (typeof response.data?.originalImagePrompt === 'string' && response.data.originalImagePrompt.trim()) {
                pending.originalImagePrompt = response.data.originalImagePrompt.trim();
            }
        }
        const result: PreciseImageResult = {
            imageUrl: pending.imageUrl,
            prompt: pending.prompt,
            originalImagePrompt: pending.originalImagePrompt,
            modelName: pending.modelName,
        };
        saveCacheRef.current = result;
        if (onGenerated) {
            setBusy('archiving');
            await onGenerated(result);
            if (session !== sessionRef.current) return null;
        }
        reconciledPromptRef.current = pending.prompt;
        pendingResultRef.current = null;
        return result;
    };

    const generate = async () => {
        if (busyRef.current || pendingResultRef.current || !pixels || !regions.length || regions.some(region => !region.confirmed || !region.note.trim()) || imageLoading || imageError) return;
        busyRef.current = true; setBusy('preparing'); setError('');
        const session = sessionRef.current;
        const batch = regions.map(toRequestRegion);
        try {
            const prepared = await preparePreciseImageRequest(working.imageUrl, dimensions, selectedReferences, requestCacheRef.current);
            if (session !== sessionRef.current) return;
            const requestBody = { model, ...prepared, ...dimensions, regions: batch, billingAction: 'precise-image' };
            assertPreciseRequestSize(requestBody);
            setBusy('generating');
            const response = await axios.post<{ imageUrl: string; modelName?: string }>(`${CLIK_URL}/preciseImage`, requestBody, { withCredentials: true, timeout: 540000 });
            if (session !== sessionRef.current) return;
            if (typeof response.data?.imageUrl !== 'string' || !response.data.imageUrl) throw new Error('The edited image was not returned. Please try again.');
            saveCacheRef.current = null;
            setImageLoading(true); setImageError(false);
            const generated = { imageUrl: response.data.imageUrl, modelName: response.data.modelName || MODELS.find(item => item.id === model)!.name };
            setWorking(generated);
            pendingResultRef.current = { ...generated, basePrompt: reconciledPromptRef.current, regions: batch };
            setRegionList(() => []); setSelected(null);
            await processPendingResult(session);
        } catch (reason) {
            if (session === sessionRef.current) setError(pendingResultRef.current
                ? `Your generated image is retained. ${readableError(reason, 'Its history could not be saved.')} Press Save to retry.`
                : readableError(reason, 'The image could not be edited. Your regions are still here.'));
        } finally {
            if (session === sessionRef.current) { busyRef.current = false; setBusy(null); }
        }
    };
    const save = async () => {
        if (busyRef.current || !working.modelName || regions.length || imageLoading || imageError) return;
        busyRef.current = true; setBusy(pendingResultRef.current ? (pendingResultRef.current.prompt ? 'archiving' : 'reconciling') : 'saving'); setError('');
        const session = sessionRef.current;
        try {
            const completed = await processPendingResult(session);
            if (session !== sessionRef.current || !completed) return;
            setBusy('saving');
            await onSave(completed);
            if (session === sessionRef.current) onClose();
        } catch (reason) {
            if (session === sessionRef.current) setError(readableError(reason, 'The image could not be saved. Please try Save again.'));
        } finally {
            if (session === sessionRef.current) { busyRef.current = false; setBusy(null); }
        }
    };

    if (!open) return null;
    const canGenerate = !busy && !pendingResultRef.current && !!pixels && regions.length > 0 && regions.every(region => region.confirmed && !!region.note.trim()) && !imageLoading && !imageError;
    const status = busy === 'preparing' ? 'Preparing images…' : busy === 'generating' ? 'Generating…' : busy === 'reconciling' ? 'Updating prompt…' : busy === 'archiving' ? 'Saving to history…' : busy === 'saving' ? 'Saving…' : imageLoading ? 'Loading image…' : '';
    const cssVars = { '--precise-accent': accentColor || '#b8a1ff', ...(visibleViewport ? { height: visibleViewport.height, top: visibleViewport.top } : {}) } as React.CSSProperties;
    const ratio = dimensions.width && dimensions.height ? dimensions.width / dimensions.height : 1;
    const stageWidth = Math.min(wellSize.width, wellSize.height * ratio);
    const stageHeight = stageWidth / ratio;
    const active = regions.find(region => region.id === selected);
    const activeIndex = active ? regions.indexOf(active) + 1 : 0;
    const anchorX = active ? (wellSize.width - stageWidth) / 2 + (active.x + active.width) * stageWidth + 10 : 0;
    const noteLeft = anchorX + 304 < wellSize.width ? anchorX : Math.max(8, anchorX - (active?.width || 0) * stageWidth - 322);
    const noteTop = active ? clamp((wellSize.height - stageHeight) / 2 + active.y * stageHeight, 8, Math.max(8, wellSize.height - 206)) : 0;
    const regionKeyboard = (event: React.KeyboardEvent, region: Region, resize = false) => {
        if (!event.key.startsWith('Arrow') || busy) return;
        event.preventDefault(); event.stopPropagation();
        const step = event.shiftKey ? .05 : .01;
        const dx = event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0;
        const dy = event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0;
        changeRegion(region.id, resize
            ? { width: clamp(region.width + dx, .025, 1 - region.x), height: clamp(region.height + dy, .025, 1 - region.y) }
            : { x: clamp(region.x + dx, 0, 1 - region.width), y: clamp(region.y + dy, 0, 1 - region.height) });
    };
    return createPortal(<div className={['precise-editor', darkMode ? 'precise-editor--dark' : '', active ? 'precise-editor--has-note' : ''].join(' ')} style={cssVars}
        data-precise-editor="true" data-editstory-gesture-guard="true" data-ai-control-excluded="true"
        role="dialog" aria-modal="true" aria-labelledby="precise-title" aria-busy={!!busy} tabIndex={-1} ref={dialogRef}
        onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()} onKeyPress={event => event.stopPropagation()}>
        <header className="precise-header"><h1 id="precise-title">Precise</h1>
            <button className="precise-close" type="button" disabled={!!busy || !!pendingResultRef.current} onClick={onClose} aria-label="Close precise editing">×</button>
        </header>
        <main className="precise-canvas-area" aria-label="Image editing canvas">
            <div className="precise-image-well" ref={wellRef}>
                <div className={['precise-image-stage', busy ? 'precise-image-stage--busy' : ''].join(' ')} ref={stageRef}
                    role="application" aria-label="Precise image canvas. Drag or tap to add a region. Press Enter to add a region, arrow keys to move it." tabIndex={0}
                    style={{ width: stageWidth || '100%', height: stageWidth ? stageHeight : '100%' }}
                    onKeyDown={event => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === 'Enter') { event.preventDefault(); addRegion(); }
                        else if (active && (event.key === 'Delete' || event.key === 'Backspace')) { event.preventDefault(); removeRegion(active.id); }
                        else if (active) regionKeyboard(event, active);
                    }}
                    onPointerDown={event => startGesture(event)} onPointerMove={moveGesture} onPointerUp={event => endGesture(event)} onPointerCancel={event => endGesture(event, true)}>
                    <img className="precise-image" key={working.imageUrl} src={working.imageUrl} alt="Image being precisely edited" draggable={false}
                        onLoad={event => { setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }); setImageLoading(false); setImageError(false); }}
                        onError={() => { setImageLoading(false); setImageError(true); setDimensions({ width: 0, height: 0 }); }} />
                    {!imageLoading && !imageError && regions.map((region, index) => <div key={region.id}
                        className={['precise-region', selected === region.id ? 'precise-region--selected' : '', region.confirmed ? 'precise-region--confirmed' : ''].join(' ')}
                        data-region-id={region.id} style={{ left: region.x * 100 + '%', top: region.y * 100 + '%', width: region.width * 100 + '%', height: region.height * 100 + '%' }}
                        onPointerDown={event => startGesture(event, region, 'move')}>
                        <button type="button" className="precise-region-label" aria-label={'Select region ' + (index + 1)} disabled={!!busy}
                            onPointerDown={event => event.stopPropagation()} onKeyDown={event => regionKeyboard(event, region)}
                            onClick={() => { setSelected(region.id); setReferencePicker(false); }}>{index + 1}{region.confirmed ? ' ✓' : ''}</button>
                        <button type="button" className="precise-resize" aria-label={'Resize region ' + (index + 1)} disabled={!!busy}
                            onPointerDown={event => startGesture(event, region, 'resize')} onClick={event => event.stopPropagation()}
                            onKeyDown={event => regionKeyboard(event, region, true)}><span aria-hidden="true">↘</span></button>
                    </div>)}
                    {(imageLoading || imageError) && <div className="precise-image-message" role="status">{imageError ? 'This image could not be loaded.' : 'Loading image…'}</div>}
                </div>
            </div>
            {active && <section className="precise-note" aria-label={'Edit region ' + activeIndex} style={{ left: noteLeft, top: noteTop }}>
                <div className="precise-note-heading"><label htmlFor={'precise-note-' + active.id}>Region {activeIndex}</label>
                    <div><button type="button" className="precise-icon-button" aria-label={'Delete region ' + activeIndex} disabled={!!busy} onClick={() => removeRegion(active.id)} title="Delete region"><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M9 6V4h6v2M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg></button>
                    <button type="button" className="precise-icon-button" aria-label="Hide region note" onClick={() => { setSelected(null); setReferencePicker(false); }} disabled={!!busy}>×</button></div>
                </div>
                <textarea id={'precise-note-' + active.id} ref={element => { noteRefs.current[active.id] = element; }}
                    aria-label={'Region ' + activeIndex + ' instruction'} rows={2} maxLength={PRECISE_MAX_NOTE_LENGTH} disabled={!!busy} value={active.note}
                    placeholder="What should change here?" onChange={event => changeRegion(active.id, { note: event.target.value, confirmed: false })} />
                <div className="precise-note-actions">
                    <button className="precise-reference-button" type="button" aria-expanded={referencePicker} disabled={!!busy} onClick={() => setReferencePicker(value => !value)}>References{selectedReferences.length ? ' (' + selectedReferences.length + ')' : ''} ▾</button>
                    <button type="button" className={['precise-confirm', active.confirmed ? 'precise-confirm--done' : ''].join(' ')}
                        aria-label={active.confirmed ? 'Region ' + activeIndex + ' note confirmed' : 'Confirm region ' + activeIndex + ' note, free'}
                        title="Confirm note · Free" disabled={!!busy || !active.note.trim()} onClick={() => { changeRegion(active.id, { confirmed: true }); setSelected(null); setReferencePicker(false); }}><span aria-hidden="true">✓</span></button>
                </div>
                {referencePicker && <div className="precise-reference-picker" aria-label="Character references">
                    <div className="precise-reference-caption">Character References <span>{selectedReferences.length}/7</span></div>
                    {availableReferences.length === 0 && <p>No character references.</p>}
                    <div className="precise-reference-grid">{availableReferences.map(reference => {
                        const checked = referenceUrls.includes(reference.url);
                        return <label key={reference.url} className={['precise-reference', checked ? 'precise-reference--selected' : ''].join(' ')}>
                            <img src={reference.url} alt="" /><span>{reference.name}</span>
                            <input type="checkbox" checked={checked} disabled={!!busy || (!checked && selectedReferences.length >= PRECISE_MAX_REFERENCES)}
                                aria-label={'Use reference ' + reference.name} onChange={() => setReferenceUrls(current => checked ? current.filter(url => url !== reference.url) : [...current.filter(url => availableReferences.some(item => item.url === url)), reference.url])} />
                        </label>;
                    })}</div>
                </div>}
            </section>}
            {(error || quoteError) && <div className="precise-error" role="alert"><span>{error || quoteError}</span>{quoteError && <button type="button" disabled={!!busy} onClick={() => setQuoteRetry(value => value + 1)}>Retry price</button>}<button type="button" aria-label="Dismiss error" onClick={() => setError('')}>×</button></div>}
            {status && <div className="precise-status" role="status" aria-live="polite">{status}</div>}
            {!regions.length && !busy && !imageLoading && <div className="precise-canvas-hint">Draw or tap to mark a region</div>}
        </main>
        <footer className="precise-toolbar" aria-label="Precise editing controls">
            <span className="precise-count" aria-label={regions.length + ' of 8 regions'}>{regions.length}/8</span>
            <select aria-label="Editing model" value={model} disabled={!!busy} onChange={event => setModel(event.target.value as Model)}>{MODELS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            <button type="button" className="precise-generate" title={'Image edit: ' + (pixels === null ? 'loading' : pixels.toLocaleString()) + ' P. Prompt reconciliation uses normal text billing.'} disabled={!canGenerate} onClick={() => void generate()}>{busy === 'preparing' ? 'Preparing…' : busy === 'generating' ? 'Generating…' : 'Generate' + (pixels ? ' · ' + pixels.toLocaleString() + ' P' : '')}</button>
            <button type="button" className="precise-save" disabled={!!busy || !working.modelName || !!regions.length || imageLoading || imageError} onClick={() => void save()}>{busy === 'reconciling' || busy === 'saving' ? 'Saving…' : 'Save'}</button>
        </footer>
    </div>, document.body);
}
