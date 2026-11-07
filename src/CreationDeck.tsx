import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PauseIcon from '@mui/icons-material/Pause';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap';
import { Box } from '@mui/material';
import { resultBadgeSx } from './ImageModelResultPill';
import { useDeckRuntime } from './DeckRuntimeContext';
import { setDeckCleanMode, setDeckCardCount, clearClientSecret } from './settingsSlice';
import { creationBinding } from './creationControlSnapshot';
import { useCreationControls } from './useCreationControls';
import { consumeDeckWheel, createDeckWheelGesture, deckGestureAxis, type DeckGestureAxis } from './deckGestures';
import { useDeckStageFit } from './useDeckStageFit';
import type { RootState } from './store';
import './DeckOverlay.css';
import './CreationDeck.css';

const GlassOverlay = lazy(() => import('./GlassOverlay'));

export type CreationDeckCard = { id: string; title: string; sceneNumber?: number; sceneLabel?: string; sceneRelationships?: string[]; image?: string; video?: string; text?: string; loader?: ReactNode; informationIcon?: ReactNode; showCaptionInClean?: boolean; isPreview?: boolean; workstationAvailable?: boolean };
export type CreationDeckProps = {
  title: string; cards: CreationDeckCard[]; activeId?: string; onSelect?: (id: string) => void;
  onOpen?: (id: string) => void; openBinding?: Record<string, unknown>; onClose: () => void;
  onOpenSceneFromSettings?: (id: string) => void;
  footer?: ReactNode; topControls?: ReactNode; settings?: ReactNode; detail?: ReactNode; onOptions?: () => void; transitionLabel?: string;
  optionsBinding?: Record<string, unknown>; onCloseDetail?: () => void; slideshow?: boolean; zIndex?: number;
  closeBinding?: Record<string, unknown>; closeDetailBinding?: Record<string, unknown>;
  detailScrollBinding?: Record<string, unknown>;
  closeLabel?: string;
  exitCreation?: ReactNode;
  statusText?: string;
  statusBusy?: boolean;
  activeCardAction?: ReactNode;
  cardBottom?: ReactNode;
  foregroundPanel?: boolean;
  closeDisabled?: boolean;
  browsableDetail?: boolean;
  renderCardDetail?: (card: CreationDeckCard) => ReactNode;
};

export const useCreationDeckEnabled = () => useSelector((state: RootState) => state.settings.deckEnabled !== false);

export default function CreationDeck(props: CreationDeckProps) {
  const enabled = useCreationDeckEnabled();
  const dispatch = useDispatch();
  const { setCreationDockHost } = useDeckRuntime();
  const { darkMode, appColorLight, appColorDark, deckCleanMode, deckCardCount, pixels, pixelChargeNotice, aiProviderNotice, clientSecret } =
    useSelector((state: RootState) => state.settings);
  const loggedUser = useSelector((state: RootState) => state.profile.loggedUser);
  const [pixelVaultOpen, setPixelVaultOpen] = useState(false);
  const pixelButton = useRef<HTMLButtonElement>(null);
  const vaultClose = useRef<HTMLButtonElement>(null);
  const closePixelVault = useCallback(() => {
    if (clientSecret) dispatch(clearClientSecret());
    else {
      setPixelVaultOpen(false);
      requestAnimationFrame(() => pixelButton.current?.focus());
    }
  }, [clientSecret, dispatch]);
  useEffect(() => {
    if (!pixelVaultOpen) return;
    vaultClose.current?.focus();
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closePixelVault();
    };
    window.addEventListener('keydown', onEscape, true);
    return () => window.removeEventListener('keydown', onEscape, true);
  }, [pixelVaultOpen, closePixelVault]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sceneNumber, setSceneNumber] = useState('');
  const [playing, setPlaying] = useState(false);
  const [closeHint, setCloseHint] = useState(true);
  const [modeHint, setModeHint] = useState(false);
  const [localId, setLocalId] = useState<string>();
  const swipeStart = useRef<{ id: number; x: number; y: number; axis: DeckGestureAxis | null; captured: boolean; owner: HTMLElement } | null>(null);
  const releaseSwipePointer = useCallback(() => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (start?.captured && start.owner.hasPointerCapture?.(start.id)) start.owner.releasePointerCapture(start.id);
  }, []);
  useEffect(() => () => { releaseSwipePointer(); }, [releaseSwipePointer]);
  const ignoreClick = useRef(0);
  const stage = useRef<HTMLDivElement>(null);
  useDeckStageFit(stage, `${enabled}:${deckCleanMode}:${props.title}:${Boolean(props.topControls)}:${Boolean(props.footer)}:${Boolean(props.detail)}`);
  const active = Math.max(0, props.cards.findIndex(card => card.id === (props.activeId ?? localId)));
  const card = props.cards[active];
  const canJump = Boolean(props.onSelect && !props.detail && !props.foregroundPanel && props.cards.some(entry => entry.sceneNumber !== undefined));
  const jumpIndex = canJump && sceneNumber !== '' ? props.cards.findIndex(entry => entry.sceneNumber === Number(sceneNumber)) : -1;
  const jumpCard = props.cards[jumpIndex];
  useCreationControls('deck_view', 'CreationDeck', enabled, {
    view: deckCleanMode ? 'clean' : 'normal', stage: props.title, centeredCardId: card?.id ?? null,
    centeredCardTitle: card?.title ?? null, cardCount: props.cards.length,
    detailOpen: Boolean(props.detail), settingsOpen, slideshowPlaying: playing, slideshowIntervalSeconds: 4,
    ...(canJump && settingsOpen && jumpCard ? { sceneJumpTarget: jumpCard.id } : {}),
    ...(props.statusText ? { status: props.statusText, busy: Boolean(props.statusBusy) } : {}),
  });
  const locked = (Boolean(props.detail) && !props.browsableDetail) || settingsOpen;
  const select = (index: number) => {
    const next = props.cards[index];
    if (!next) return;
    setLocalId(next.id);
    props.onSelect?.(next.id);
  };
  const browse = (direction: number) => {
    setPlaying(false);
    if (!locked) select(active + direction);
  };
  const browseRef = useRef(browse);
  browseRef.current = browse;
  const selectRef = useRef(select);
  selectRef.current = select;
  useEffect(() => {
    const timer = setTimeout(() => setCloseHint(false), 3000);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    setModeHint(!deckCleanMode);
    let hide: ReturnType<typeof setTimeout>;
    const timer = setTimeout(() => {
      if (deckCleanMode) {
        setModeHint(true);
        hide = setTimeout(() => setModeHint(false), 2000);
      } else setModeHint(false);
    }, deckCleanMode ? 3500 : 6000);
    return () => { clearTimeout(timer); clearTimeout(hide); };
  }, [deckCleanMode]);
  useEffect(() => {
    if (props.detail || !props.slideshow) setPlaying(false);
    if (!props.slideshow || !playing || locked) return;
    if (props.cards.length < 2) { setPlaying(false); return; }
    const timer = setTimeout(() => selectRef.current((active + 1) % props.cards.length), 4000);
    return () => clearTimeout(timer);
  }, [playing, active, locked, props.cards.length, props.detail, props.slideshow]);
  useEffect(() => {
    const surface = stage.current;
    if (!enabled || !surface) return;
    const gesture = createDeckWheelGesture();
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || event.ctrlKey) return;
      if (event.cancelable) event.preventDefault();
      const movement = consumeDeckWheel(gesture, event.deltaX, event.deltaY, performance.now());
      if (movement?.axis === 'x') browseRef.current(movement.direction);
    };
    surface.addEventListener('wheel', wheel, { passive: false });
    return () => surface.removeEventListener('wheel', wheel);
  }, [enabled]);
  useEffect(() => {
    if (!settingsOpen) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      setSettingsOpen(false);
    };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [settingsOpen]);
  if (!enabled) return null;
  const offsets = locked && props.detail ? [0] : deckCardCount > 3 ? [-2, -1, 0, 1, ...(deckCardCount === 5 ? [2] : [])] : [-1, 0, 1];
  const positions = ['prev2', 'prev', 'active', 'next', 'next2'];
  const accent = darkMode ? appColorDark : appColorLight;
  const closeLabel = props.closeLabel ?? 'Close Creation Deck to Grid';
  const closeCue = (position: 'left' | 'right' | 'bottom') => <button key={position} type="button"
    className={`deck-close-cue deck-close-cue--${position}`} aria-label={closeLabel} onClick={props.onClose}>
    <span className="deck-close-cue-pill"><span aria-hidden="true">✦</span> close <span aria-hidden="true">✦</span></span>
  </button>;
  return createPortal(<><section className={`deck-overlay creation-deck${darkMode ? ' deck-overlay--dark' : ''}${deckCleanMode ? ' creation-deck--clean' : ''}`}
    data-creation-owner="creation-deck"
    data-creation-deck-view={deckCleanMode ? 'clean' : 'normal'} data-creation-deck-scene={card?.id}
    data-creation-deck-workflow-card={Boolean(props.cardBottom || props.foregroundPanel) || undefined}
    aria-label={props.title} aria-hidden={pixelVaultOpen || undefined} data-creation-deck-covered={pixelVaultOpen || undefined}
    style={{ '--deck-accent': accent, zIndex: props.zIndex ?? 1000000 } as CSSProperties}
    onClick={event => {
      if (performance.now() < ignoreClick.current) return;
      const target = event.target as Element;
      if (target === event.currentTarget || target === stage.current || target.classList.contains('deck-scrim')) props.onClose();
    }}>
    <div className="deck-scrim" />
    <header className="deck-topbar creation-deck-topbar">
      <div className="creation-deck-settings" style={props.foregroundPanel ? { visibility: 'hidden' } : undefined}>
        <button type="button" className="deck-glass-button deck-category creation-deck-selector" aria-expanded={settingsOpen} title={props.title}
          {...creationBinding('deck_view', 'settings', settingsOpen ? 'Close Creation Deck settings' : 'Open Creation Deck settings', 'CreationDeck.setSettingsOpen')}
          aria-label={playing ? `Slideshow running, ${props.title}` : undefined}
          onClick={() => { setSceneNumber(''); setSettingsOpen(!settingsOpen); }}>
          {playing && <span className="deck-category-mark" aria-hidden="true"><PauseIcon /></span>}
          <span className="creation-deck-selector-label" {...(playing ? { 'data-deck-slideshow-status': 'running' } : {})}>
            {playing ? 'Slideshow' : props.title}
          </span>
          {playing && <span className="deck-activity-dot" aria-hidden="true" />}
          <svg className="creation-deck-selector-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </button>
        <button type="button" ref={pixelButton} className="deck-glass-button creation-deck-balance"
          {...creationBinding('storybook_toolbar', 'pixels_balance', 'Pixel balance and purchase control (information only)', 'GlassOverlay', 'click', 'information_only')}
          aria-label={`${pixels.toLocaleString()} Pixels. Open Pixel Vault`} aria-haspopup="dialog" aria-expanded={pixelVaultOpen}
          disabled={!loggedUser} onClick={() => { setSettingsOpen(false); setPlaying(false); setPixelVaultOpen(true); }}>
          {pixels.toLocaleString()} <span>P</span>
        </button>
        {settingsOpen && !props.foregroundPanel && <div className="creation-deck-menu"
          {...creationBinding('deck_view', 'settings_scroll', 'Scroll Creation Deck settings', 'CreationDeck.settings', 'scroll')}
          onClick={event => {
          const button = (event.target as HTMLElement).closest('button:not(:disabled)');
          if (!event.defaultPrevented && button && !button.closest('.creation-deck-scene-jump')) {
            if (!button.hasAttribute('data-deck-slideshow-control')) setPlaying(false);
            setSettingsOpen(false);
          }
        }}>{props.settings}
          {canJump && <form className="creation-deck-scene-jump" onSubmit={event => {
            event.preventDefault();
            if (!jumpCard) return;
            setPlaying(false);
            select(jumpIndex);
            setSettingsOpen(false);
          }}>
            <input type="number" min={1} step={1} inputMode="numeric" placeholder="Scene #" aria-label="Storyboard scene number"
              {...creationBinding('deck_view', 'scene_number', 'Set the Storyboard scene number for Show or Open', 'CreationDeck.setSceneNumber', 'text')}
              value={sceneNumber} onChange={event => setSceneNumber(event.target.value)} />
            <button type="submit" disabled={!jumpCard}
              {...creationBinding('deck_view', 'show_scene', `Show ${jumpCard?.title ?? 'scene'} in Creation Deck`, 'selectScene')}>Show</button>
            {props.onOpenSceneFromSettings && <button type="button" disabled={!jumpCard?.workstationAvailable}
              {...creationBinding('deck_view', 'open_scene', `Open ${jumpCard?.title ?? 'scene'} in the workstation`, 'openWorkstation')}
              onClick={() => {
                if (!jumpCard?.workstationAvailable) return;
                setPlaying(false);
                setSettingsOpen(false);
                props.onOpenSceneFromSettings?.(jumpCard.id);
              }}>Open</button>}
          </form>}
          {props.slideshow && props.cards.length > 1 && !props.detail && <button type="button" className="creation-deck-slideshow"
            data-deck-slideshow-control="true" aria-label={playing ? 'Pause slideshow' : 'Play slideshow'} aria-pressed={playing}
            {...creationBinding('deck_view', 'slideshow', playing ? 'Pause scene slideshow' : 'Play scene slideshow', 'CreationDeck.setPlaying')}
            onClick={() => setPlaying(!playing)}>
            <span>Slideshow</span><span>{playing ? 'Pause' : 'Play'}</span>
          </button>}
          <button type="button" {...creationBinding('deck_view', 'toggle_mode', 'Switch Creation Deck presentation', 'setDeckCleanMode')}
            onClick={() => dispatch(setDeckCleanMode(!deckCleanMode))}>{deckCleanMode ? 'Normal view' : 'Clean view'}</button>
          {props.exitCreation}
        </div>}
      </div>
      {props.topControls && <div className="creation-deck-top-controls">{props.topControls}</div>}
      {deckCleanMode && !props.topControls && <div className="creation-deck-concierge creation-deck-concierge--header" ref={setCreationDockHost} />}
      <button type="button" className="deck-glass-button deck-close" aria-label={closeLabel} disabled={props.closeDisabled}
        {...(props.closeBinding ?? creationBinding('deck_view', 'close', 'Show Creation Grid', 'CreationDeck.onClose'))} onClick={props.onClose}><CloseIcon /></button>
    </header>
    {deckCleanMode && props.topControls && <div className="creation-deck-concierge creation-deck-concierge--top" ref={setCreationDockHost} />}
    {deckCleanMode && closeHint && (['left', 'right'] as const).map(closeCue)}
    <div className="deck-stage creation-deck-stage" ref={stage}
      onPointerDown={event => {
        if (locked || !event.isPrimary || event.button !== 0 || (event.pointerType === 'touch' && event.clientX < 24)
          || (event.target as HTMLElement).closest('input,textarea,video,[data-deck-no-drag]')) { releaseSwipePointer(); return; }
        swipeStart.current = { id: event.pointerId, x: event.clientX, y: event.clientY, axis: null, captured: false, owner: event.currentTarget };
      }}
      onPointerMove={event => {
        const start = swipeStart.current;
        if (!start || start.id !== event.pointerId || locked) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        start.axis ||= deckGestureAxis(dx, dy);
        if (!start.captured && start.axis === 'x') {
          start.owner.setPointerCapture?.(start.id);
          start.captured = true;
        }
        if (start.captured && event.cancelable) event.preventDefault();
      }}
      onPointerCancel={() => {
        if (swipeStart.current?.captured) ignoreClick.current = performance.now() + 400;
        releaseSwipePointer();
      }}
      onLostPointerCapture={event => {
        if (event.target !== event.currentTarget || swipeStart.current?.id !== event.pointerId) return;
        if (swipeStart.current?.captured) ignoreClick.current = performance.now() + 400;
        releaseSwipePointer();
      }}
      onPointerUp={event => {
        const start = swipeStart.current;
        releaseSwipePointer();
        if (!start || start.id !== event.pointerId || locked) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (start.captured) ignoreClick.current = performance.now() + 400;
        if (start.axis === 'y' || Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy)) return;
        ignoreClick.current = performance.now() + 400;
        browse(dx < 0 ? 1 : -1);
      }}
      onDragStart={event => event.preventDefault()}
      onKeyDown={event => {
        if (event.target !== event.currentTarget || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
        event.preventDefault();
        browse(event.key === 'ArrowLeft' ? -1 : 1);
      }} tabIndex={0}>
      {props.transitionLabel && <output key={props.transitionLabel} className="creation-deck-mode-transition">{props.transitionLabel}</output>}
      {!locked && props.cards.length >= 3 && <button type="button" className="deck-card-count-toggle" data-deck-no-drag="true"
        aria-label={`Showing ${deckCardCount ?? 3} cards. Change card count.`}
        onClick={() => dispatch(setDeckCardCount(deckCardCount === 3 ? 4 : deckCardCount === 4 ? 5 : 3))}>
        <span className="deck-card-count-indicator" /><span className="deck-card-count-label">{deckCardCount ?? 3} cards</span>
      </button>}
      {offsets.map(offset => {
        const entry = props.cards[active + offset];
        if (!entry && offset !== 0 && props.cards.length > 0) return null;
        return <article key={offset === 0 ? 'active' : offset} className={`deck-card deck-card--${positions[offset + 2]} creation-deck-card`}
          aria-hidden={offset !== 0 || undefined}
          onClick={offset !== 0 && entry ? event => {
            event.stopPropagation();
            if (performance.now() < ignoreClick.current || locked) return;
            setPlaying(false);
            select(active + offset);
          } : undefined}>
          {entry?.image && <img className="creation-deck-media" src={entry.image} alt="" draggable={false} />}
          {offset === 0 && entry?.video && (!props.detail || props.foregroundPanel || !entry.image) && <video className="creation-deck-media" src={entry.video} poster={entry.image}
            muted playsInline autoPlay loop preload="metadata" />}
          {offset === 0 && props.detail ? <div {...props.detailScrollBinding} className={`creation-deck-detail${entry?.image || entry?.video ? ' creation-deck-detail--frosted' : ''}${props.foregroundPanel ? ' creation-deck-detail--panel' : ''}`}>
            {props.onCloseDetail && <button type="button" className="deck-glass-button creation-deck-circle creation-deck-detail-close"
              aria-label="Close details" {...props.closeDetailBinding} onClick={props.onCloseDetail}><CloseIcon /></button>}{props.detail}
          </div> : offset !== 0 && props.browsableDetail && props.detail && entry && props.renderCardDetail ? <div className="creation-deck-detail-side">
            {props.renderCardDetail(entry)}
          </div> : entry ? <>
            {entry.loader}
            {(entry.image || entry.video) && (!deckCleanMode || entry.showCaptionInClean) && <span className="deck-card-shade" aria-hidden="true" />}
            {entry.image && entry.isPreview && !entry.video && <Box component="span" data-scene-preview
              className={`creation-deck-preview-label${entry.loader ? ' creation-deck-preview-label--loading' : ''}`}
              sx={{ ...resultBadgeSx, px: 1.1, py: .28, borderRadius: '5px' }}>Preview</Box>}
            {offset === 0 && !settingsOpen && props.activeCardAction && <div className={`creation-deck-card-action${entry.loader ? ' creation-deck-card-action--loading' : ''}`}
              data-deck-no-drag="true">{props.activeCardAction}</div>}
            <div {...(offset === 0 && !entry.image && !entry.video ? creationBinding('deck_view', 'scroll_card', 'Scroll the current card text', 'CreationDeck.card.scrollBy', 'scroll') : {})} className={entry.image || entry.video
              ? `creation-deck-caption${entry.showCaptionInClean ? ' creation-deck-caption--live' : ''}`
              : `creation-deck-text${entry.informationIcon ? ' creation-deck-text--feature' : ''}`}>
              {entry.informationIcon && !entry.image && !entry.video && <span className="creation-deck-info-icon" aria-hidden="true">{entry.informationIcon}</span>}
              <div className="creation-deck-card-heading">
              <h2 key={entry.id} data-deck-no-drag="true" onClick={event => {
                if (offset !== 0 || deckCleanMode) return;
                event.stopPropagation();
                setPlaying(false);
                dispatch(setDeckCleanMode(true));
              }}>{!deckCleanMode && offset === 0 && entry.sceneLabel && <span aria-hidden="true"
                className={`deck-caption-zoom-cue${modeHint ? ' deck-caption-zoom-cue--visible' : ''}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 4h6v6M4 14v6h6m3-9 7-7M4 20l7-7" />
                  </svg>
                </span>}{entry.sceneLabel || entry.title}</h2>
              {!deckCleanMode && Boolean(entry.sceneRelationships?.length) && <div className="creation-deck-scene-relationships">
                {entry.sceneRelationships?.map(label => <span key={label}>{label}</span>)}
              </div>}
              </div>
              {entry.text && <p key={entry.id} {...(offset === 0 && (entry.image || entry.video) ? creationBinding('deck_view', 'scroll_card', 'Scroll the current card text', 'CreationDeck.card.scrollBy', 'scroll') : {})} className={offset === 0 && !deckCleanMode && entry.sceneLabel ? 'creation-deck-scene-copy' : undefined}
                data-deck-no-drag={offset === 0 && !deckCleanMode && entry.sceneLabel ? 'true' : undefined}
                tabIndex={offset === 0 && !deckCleanMode && entry.sceneLabel && (entry.image || entry.video) ? 0 : undefined}
                onClick={offset === 0 && !deckCleanMode && entry.sceneLabel ? () => {
                  if (performance.now() < ignoreClick.current) return;
                  setPlaying(false);
                  dispatch(setDeckCleanMode(true));
                } : undefined}>{entry.text}</p>}
            </div>
            {offset === 0 && props.onOpen && !settingsOpen && <button type="button" className={`creation-deck-card-open${deckCleanMode ? ' creation-deck-card-open--clean' : ''}`}
              aria-label={`Open ${entry.title} in workstation`} {...props.openBinding}
              onClick={() => { if (performance.now() >= ignoreClick.current) { setPlaying(false); props.onOpen?.(entry.id); } }} />}
            {offset === 0 && deckCleanMode && !settingsOpen && <button type="button" className="creation-deck-restore-zone"
              aria-label={entry.sceneLabel ? `${entry.sceneLabel}, restore Normal Deck` : 'Restore Normal Deck from card'}
              onClick={() => { if (performance.now() >= ignoreClick.current) dispatch(setDeckCleanMode(false)); }}>
              {entry.sceneLabel && <span className="deck-creator--clean creation-deck-scene-label">{entry.sceneLabel}</span>}
            </button>}
            {offset === 0 && props.onOptions && !deckCleanMode && !settingsOpen && <button type="button" className="deck-creator creation-deck-options"
              data-deck-no-drag="true" {...props.optionsBinding} onClick={() => { setPlaying(false); props.onOptions?.(); }}>Options</button>}
            {offset === 0 && deckCleanMode && !entry.showCaptionInClean && modeHint && <button type="button" className="deck-glass-button deck-more-cue"
              data-deck-no-drag="true" onClick={() => dispatch(setDeckCleanMode(false))}>More</button>}
            {offset === 0 && deckCleanMode && !entry.showCaptionInClean && !settingsOpen && <button type="button" className="deck-zoom-out deck-glass-button"
              data-deck-no-drag="true" aria-label="Restore deck view"
              {...creationBinding('deck_view', 'toggle_mode', 'Switch Creation Deck presentation', 'setDeckCleanMode')}
              onClick={() => dispatch(setDeckCleanMode(false))}>
              <ZoomInMapIcon />
            </button>}
            {offset === 0 && props.onOptions && deckCleanMode && !entry.showCaptionInClean && !settingsOpen && <button type="button" className="deck-zoom-out creation-deck-clean-options deck-glass-button"
              data-deck-no-drag="true" aria-label="Options" {...props.optionsBinding} onClick={() => { setPlaying(false); props.onOptions?.(); }}>
              <MoreVertIcon />
            </button>}
            {offset === 0 && props.cardBottom && <div className="creation-deck-card-bottom" data-deck-no-drag="true">{props.cardBottom}</div>}
          </> : <div className="deck-card-back deck-card-back--loading" />}
        </article>;
      })}
      {!locked && active > 0 && <button type="button" className="deck-arrow deck-arrow--prev deck-glass-button"
        {...creationBinding('deck_view', 'previous_card', `Show previous card: ${props.cards[active - 1]?.title}`, 'CreationDeck.browse(-1)')}
        data-deck-no-drag="true" aria-label="Previous card" onClick={() => browse(-1)}><ChevronLeftIcon /></button>}
      {!locked && active < props.cards.length - 1 && <button type="button" className="deck-arrow deck-arrow--next deck-glass-button"
        {...creationBinding('deck_view', 'next_card', `Show next card: ${props.cards[active + 1]?.title}`, 'CreationDeck.browse(1)')}
        data-deck-no-drag="true" aria-label="Next card" onClick={() => browse(1)}><ChevronRightIcon /></button>}
      {(pixelChargeNotice || aiProviderNotice || props.statusText) && <div className="creation-deck-notices">
        {pixelChargeNotice && <output key={pixelChargeNotice.id} className="creation-deck-charge" role="status" aria-live="polite">
          −{pixelChargeNotice.pixels.toLocaleString()}P · {pixelChargeNotice.label}
        </output>}
        {aiProviderNotice && <output key={aiProviderNotice.id} className="creation-deck-provider-notice" role="status" aria-live="polite">
          {aiProviderNotice.message}
        </output>}
        {props.statusText && <div className="creation-deck-status" role="status">
          {props.statusBusy && <span className="creation-deck-status-spinner" aria-hidden="true" />}
          {props.statusText}
        </div>}
      </div>}
    </div>
    <div className="creation-deck-close-row">{deckCleanMode && closeHint && closeCue('bottom')}</div>
    {props.cards.length > 1 && <div className="deck-collection creation-deck-collection"
      style={(props.detail && !props.browsableDetail) || props.foregroundPanel ? { visibility: 'hidden' } : undefined}>
      <div className="deck-positions" aria-label="Cards in current collection">{props.cards.map((entry, position) => <button key={entry.id} type="button"
        className={`deck-position${position === active ? ' deck-position--active' : ''}`}
        aria-label={`Show card ${position + 1}: ${entry.sceneLabel || entry.title}`} aria-current={position === active ? 'true' : undefined}
        title={entry.sceneLabel || entry.title} disabled={position === active || locked}
        {...creationBinding('deck_view', `position_${position + 1}`, `Show card ${position + 1}: ${entry.sceneLabel || entry.title}`, 'CreationDeck.select')} onClick={() => { setPlaying(false); select(position); }}><span>{position + 1}</span></button>)}</div>
      <span className="deck-count" aria-live="polite">{active + 1} / {props.cards.length}</span>
    </div>}
    <div className="creation-deck-bottom">
      {deckCleanMode && <div className="deck-control-host creation-deck-clean-control" data-deck-control-host="true" />}
      {!deckCleanMode && <div className="deck-dock creation-deck-dock">
        <div className="deck-circle-host" data-deck-circle-host="true" data-ai-snapshot-ignore="true" />
        <div className="deck-concierge-host creation-deck-concierge" ref={setCreationDockHost} />
        <div className="deck-control-host" data-deck-control-host="true" />
      </div>}
      {(props.footer || deckCleanMode) && <footer className="creation-deck-footer" style={(props.detail && !props.browsableDetail) || !props.footer ? { visibility: 'hidden' } : undefined}>{props.footer}</footer>}
    </div>
    {!settingsOpen && !props.foregroundPanel && props.slideshow && props.cards.length > 1 && !props.detail && <button type="button" data-creation-deck-ai-only="true" data-deck-no-drag="true" aria-label={playing ? 'Pause slideshow' : 'Play slideshow'} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1, overflow: 'hidden' }} tabIndex={-1} {...creationBinding('deck_view', 'slideshow', playing ? 'Pause scene slideshow' : 'Play scene slideshow', 'CreationDeck.setPlaying')} onClick={() => setPlaying(!playing)} />}
    {!settingsOpen && !props.foregroundPanel && (!deckCleanMode || Boolean(card?.showCaptionInClean)) && <button type="button" data-creation-deck-ai-only="true" data-deck-no-drag="true" aria-label={deckCleanMode ? 'Normal view' : 'Clean view'} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1, overflow: 'hidden' }} tabIndex={-1} {...creationBinding('deck_view', 'toggle_mode', 'Switch Creation Deck presentation', 'setDeckCleanMode')} onClick={() => dispatch(setDeckCleanMode(!deckCleanMode))} />}
  </section>{pixelVaultOpen && <div className={`creation-deck-vault deck-overlay${darkMode ? ' deck-overlay--dark' : ''}`}
    style={{ zIndex: (props.zIndex ?? 1000000) + 100 }} role="dialog" aria-modal="true" aria-label="Pixel Vault">
    <Suspense fallback={null}><GlassOverlay expanded darkMode={darkMode} onClose={closePixelVault} /></Suspense>
    <button type="button" ref={vaultClose} className="deck-glass-button deck-close creation-deck-vault-close" aria-label="Close Pixel Vault"
      onClick={closePixelVault}><CloseIcon /></button>
  </div>}</>, document.body);
}
