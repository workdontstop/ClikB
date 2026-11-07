import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useMediaQuery } from '@mui/material';
import { darken, lighten } from '@mui/material/styles';
import type { AppDispatch, RootState } from './store';
import { setAutoControl, setAutoControlVisible, setVideoControl } from './settingsSlice';
import { creationBinding as cb } from './creationControlSnapshot';
import { useCreationControls } from './useCreationControls';
import { isPaidConversationTier } from './conversationModels';

/** One app-wide permission pill, shown only after a concierge/chat entry reveals it. */
export default function AutoControlPill({
  placement = 'floating',
  hidden = false,
  isMenuOpen = false,
  MenuOpenb = false,
  small = false,
}: {
  placement?: 'floating' | 'embedded';
  hidden?: boolean;
  isMenuOpen?: boolean;
  MenuOpenb?: boolean;
  small?: boolean;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const enabled = useSelector((state: RootState) => state.settings.autoControlEnabled);
  const visible = useSelector((state: RootState) => state.settings.autoControlVisible);
  const videoEnabled = useSelector((state: RootState) => state.settings.videoControlEnabled);
  const conversationModel = useSelector((state: RootState) => state.settings.conversationModel);
  const paidConcierge = isPaidConversationTier(conversationModel);
  const [deduction, setDeduction] = useState<{ id: string; pixels: number } | null>(null);
  const lastReceipt = useRef('');
  useEffect(() => {
    setDeduction(null);
    if (!paidConcierge) return;
    let hideTimer: number | undefined;
    const onBilling = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      const pixels = Math.floor(Number(detail?.pixelsCharged) || 0);
      if (!isPaidConversationTier(detail?.tier || conversationModel) || !Number.isFinite(pixels) || pixels <= 0) return;
      const id = String(detail?.receiptId || '');
      if (!id || lastReceipt.current === id) return;
      lastReceipt.current = id;
      setDeduction({ id, pixels });
      if (hideTimer) window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setDeduction(null), 4600);
    };
    window.addEventListener('clikb:concierge-metered-billing', onBilling);
    return () => {
      if (hideTimer) window.clearTimeout(hideTimer);
      window.removeEventListener('clikb:concierge-metered-billing', onBilling);
    };
  }, [conversationModel, paidConcierge]);
  const videoSurfaceActive = useSelector((state: RootState) => {
    const areas = state.brainstorm.userSnapshot.creation.controls?.areas ?? {};
    // These areas contain measured, currently exposed controls and are removed
    // on close/unmount. Historical storybook/editStory fields intentionally
    // survive in creation memory and cannot establish which screen is open.
    return Object.values(areas).some(area => {
      if (area.areaId === 'clikb.creation.video_permission') return false;
      if (area.controls.some(control => control.policy === 'requires_video')) return true;
      if (area.areaId === 'clikb.creation.storybook_grid') {
        return area.state.stage === 'video_grid' || area.state.stage === 'bshot_grid';
      }
      // Nested prompt/context/reference/GPU surfaces can cover the parent
      // workstation. Include their own live areas while retaining permissions.
      if (area.areaId === 'clikb.creation.notepad') {
        return area.state.guideContext === 'editstory-video-prompt' ||
          area.state.guideContext === 'editstory-video-update-instruction' ||
          area.state.guideContext === 'editstory-motion-prompt';
      }
      return area.areaId.startsWith('clikb.creation.workstation_video') ||
        area.areaId.startsWith('clikb.creation.workstation_motion_') ||
        area.areaId.startsWith('clikb.creation.workstation_gpu') ||
        area.areaId === 'clikb.creation.workstation_visual_guide' ||
        area.areaId === 'clikb.creation.workstation_action_image' ||
        area.areaId === 'clikb.creation.workstation_storyboard_image' ||
        area.areaId === 'clikb.creation.workstation_action_image_viewer';
    });
  });
  const darkMode = useSelector((state: RootState) => state.settings.darkMode);
  const appColor = useSelector((state: RootState) => darkMode ? state.settings.appColorDark : state.settings.appColorLight);
  const compact = useMediaQuery('(max-width:599.95px)');
  const activeEdge = darkMode ? lighten(appColor, 0.15) : darken(appColor, 0.13);
  const textColor = darkMode ? '#f3f3f3' : '#242424';
  const activeTextColor = darkMode ? '#161616' : '#ffffff';
  const activeBackground = darkMode
    ? `linear-gradient(135deg, ${lighten(appColor, 0.08)}, #35bfa3)`
    : `linear-gradient(135deg, ${darken(appColor, 0.12)}, #7657d8)`;
  const activeShadow = darkMode
    ? `0 6px 18px ${appColor}38, 0 3px 10px rgba(0,0,0,.24)`
    : `0 6px 18px ${appColor}2e, 0 3px 10px rgba(45,25,48,.18)`;
  const panelBackground = darkMode ? 'rgba(24,26,30,.96)' : 'rgba(255,255,255,.98)';
  const embedded = placement === 'embedded';
  const deckCleanMode = useSelector((state: RootState) => state.settings.deckCleanMode);
  const showOnTop = embedded || deckCleanMode;
  const [showPingStatus, setShowPingStatus] = useState(false);
  const previousEnabled = useRef(enabled);
  useEffect(() => {
    if (previousEnabled.current === enabled) return;
    previousEnabled.current = enabled;
    if (!enabled) { setShowPingStatus(false); return; }
    setShowPingStatus(true);
    const timer = window.setTimeout(() => setShowPingStatus(false), 2000);
    return () => window.clearTimeout(timer);
  }, [enabled]);
  useCreationControls('video_permission', 'AutoControlPill', visible && !hidden && videoSurfaceActive, {
    videoEnabled, autoControlEnabled: enabled,
  });
  if (hidden || (!visible && !(paidConcierge && deduction))) return null;

  return (
    <div
      data-auto-control={visible ? 'true' : undefined}
      style={{
        position: embedded ? 'relative' : 'fixed',
        left: embedded ? 'auto' : (!compact && (isMenuOpen || MenuOpenb) ? '60%' : '50%'),
        top: 'auto',
        bottom: embedded ? 'auto' : 'calc(78px + env(safe-area-inset-bottom, 0px))',
        transform: embedded ? 'none' : 'translateX(-50%)',
        zIndex: embedded ? 1 : 2147483601,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: small ? 4 : compact ? 6 : 9,
        pointerEvents: 'auto',
        transition: embedded ? undefined : 'left 180ms ease',
      }}
    >
      <style>{`@keyframes clikbPixelPill { 0% { opacity: 0; transform: scale(.9) } 8%, 88% { opacity: 1; transform: scale(1) } 100% { opacity: 0; transform: scale(.9) } } @media (prefers-reduced-motion: reduce) { [data-concierge-pixel-deduction] { animation: none !important; } }`}</style>
      {!visible && paidConcierge && deduction && <div
        key={deduction.id}
        data-concierge-pixel-deduction="true"
        role="status"
        aria-live="polite"
        aria-label={`${deduction.pixels} Pixels deducted`}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxSizing: 'border-box', minHeight: small ? 40 : compact ? 52 : 60,
          padding: small ? '6px 12px' : '9px 17px', borderRadius: 999,
          background: activeBackground, color: activeTextColor, border: `1px solid ${activeEdge}`,
          boxShadow: activeShadow, whiteSpace: 'nowrap', pointerEvents: 'none',
          font: `800 ${small ? 13 : compact ? 14 : 16}px/1 Arial, sans-serif`,
          animation: 'clikbPixelPill 4.6s ease both',
        }}
      >
        -{deduction.pixels} P
      </div>}
      {visible && <div
        role="group"
        aria-label="Auto Control"
        style={{
          display: 'flex', alignItems: 'center', gap: small ? 3 : compact ? 4 : 8,
          minWidth: small ? 160 : compact ? 182 : 228,
          minHeight: small ? 34 : compact ? 42 : 48,
          padding: small ? '2px 4px 2px 9px' : compact ? '4px 6px 4px 12px' : '5px 8px 5px 17px',
          borderRadius: 999,
          background: enabled ? activeBackground : panelBackground,
          color: enabled ? activeTextColor : textColor,
          border: `1px solid ${enabled ? activeEdge : (darkMode ? 'rgba(255,255,255,.24)' : 'rgba(0,0,0,.16)')}`,
          boxShadow: enabled ? activeShadow : '0 5px 22px rgba(0,0,0,.23)',
          whiteSpace: 'nowrap', font: `700 ${small ? 11 : compact ? 12 : 14}px/1 Arial, sans-serif`,
        }}
      >
        <button type="button" className="auto-control-pill-button" aria-pressed={enabled} aria-label={`Auto Control ${enabled ? 'on' : 'off'}. Turn ${enabled ? 'off' : 'on'}`}
          data-ai-action="clikb.global.auto_control.control.toggle"
          onClick={() => dispatch(setAutoControl({ enabled: !enabled, actor: 'user' }))}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: small ? 5 : compact ? 7 : 10, border: 0, outline: 'none', background: 'transparent', color: enabled ? activeTextColor : textColor, cursor: 'pointer', font: 'inherit', padding: small ? '3px 1px' : '5px 2px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: small ? 32 : compact ? 36 : 42, height: 18 }}>
            {paidConcierge && deduction ? <span key={deduction.id}
              data-concierge-pixel-deduction="true" role="status" aria-live="polite"
              aria-label={`${deduction.pixels} Pixels deducted`}
              style={{ fontSize: small ? 10 : compact ? 11 : 12, fontWeight: 800, fontVariantNumeric: 'tabular-nums', animation: 'clikbPixelPill 4.6s ease both' }}>
              -{deduction.pixels} P
            </span> : <span aria-hidden="true" style={{ width: small ? 7 : compact ? 8 : 10, height: small ? 7 : compact ? 8 : 10, borderRadius: '50%', background: enabled ? activeTextColor : '#92989d' }} />}
          </span>
          Auto Control <span style={{ opacity: .8 }}>{enabled ? 'On' : 'Off'}</span>
        </button>
        {videoSurfaceActive && <button type="button" className="auto-control-pill-button"
          {...cb('video_permission', videoEnabled ? 'disable' : 'enable', `${videoEnabled ? 'Disable' : 'Enable'} Video permission for paid video and Motion Guide operations`, 'setVideoControl')}
          aria-pressed={videoEnabled} aria-label={`Video permission ${videoEnabled ? 'on' : 'off'}. Turn ${videoEnabled ? 'off' : 'on'}`}
          title={`Video ${videoEnabled ? 'On' : 'Off'}: paid video and Motion Guide operations`}
          onClick={() => dispatch(setVideoControl(!videoEnabled))}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 3,
            border: 0, borderLeft: '1px solid currentColor', background: videoEnabled ? 'rgba(127,127,127,.25)' : 'transparent',
            color: 'inherit', font: 'inherit', cursor: 'pointer', borderRadius: '0 999px 999px 0', padding: small ? '5px' : '7px', opacity: videoEnabled ? 1 : .65 }}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width={small ? 16 : 20} height={small ? 16 : 20} fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="6" width="12" height="12" rx="2"/><path d="M15 10l6-3v10l-6-3z"/></svg>
          <span>{videoEnabled ? 'On' : 'Off'}</span>
        </button>}
        <button type="button" className="auto-control-pill-button" aria-label="Hide Auto Control and turn it off" data-ai-action="clikb.global.auto_control.control.hide"
          onClick={() => dispatch(setAutoControlVisible({ visible: false, actor: 'user' }))}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0, border: 0, outline: 'none', borderRadius: '50%', background: enabled ? 'rgba(0,0,0,.08)' : 'transparent', color: enabled ? activeTextColor : textColor, width: small ? 22 : compact ? 27 : 30, height: small ? 22 : compact ? 27 : 30, cursor: 'pointer' }}>
          <svg aria-hidden="true" viewBox="0 0 24 24" width={small ? 14 : 17} height={small ? 14 : 17} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>}
      {visible && showPingStatus && <div role="status" aria-live="polite"
        style={{
          position: 'absolute',
          top: showOnTop ? 'auto' : 'calc(100% + 8px)',
          bottom: showOnTop ? 'calc(100% + 8px)' : 'auto',
          left: '50%', transform: 'translateX(-50%)',
          width: 'max-content', maxWidth: 'calc(100vw - 24px)', boxSizing: 'border-box',
          padding: '8px 14px', borderRadius: 999,
          background: panelBackground, color: textColor,
          border: `2px solid ${appColor}`,
          boxShadow: '0 8px 24px rgba(0,0,0,.18)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          font: `600 ${compact ? 12 : 13}px/1.25 Arial, sans-serif`, textAlign: 'center',
          whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
        <svg aria-hidden="true" viewBox="0 0 20 20" width="17" height="17"
          fill="none" stroke={appColor} strokeWidth="1.7" strokeLinecap="round">
          <circle cx="10" cy="10" r="1.8" fill={appColor} stroke="none" />
          <path d="M6.8 6.8a4.5 4.5 0 0 0 0 6.4m6.4-6.4a4.5 4.5 0 0 1 0 6.4M4.2 4.2a8.2 8.2 0 0 0 0 11.6m11.6-11.6a8.2 8.2 0 0 1 0 11.6" />
        </svg>
        Pings every 2s
      </div>}
    </div>
  );
}
