import { useEffect } from 'react';
import { Button, Tooltip } from '@mui/material';
import TouchAppRoundedIcon from '@mui/icons-material/TouchAppRounded';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './store';
import { setAutoControlEntryPoint, setAutoControlVisible } from './settingsSlice';

/** Shared entry used by the expanded Guide and the full chat; not an On switch. */
export default function AutoControlRevealButton({ entry, compact = false, onEnableGuide }: { entry: 'guide' | 'chat'; compact?: boolean; onEnableGuide?: () => void }) {
  const dispatch = useDispatch<AppDispatch>();
  const visible = useSelector((state: RootState) => state.settings.autoControlVisible);
  const conciergeEnabled = useSelector((state: RootState) => state.settings.conciergeEnabled);
  const darkMode = useSelector((state: RootState) => state.settings.darkMode);
  const appColor = useSelector((state: RootState) => darkMode ? state.settings.appColorDark : state.settings.appColorLight);

  useEffect(() => {
    dispatch(setAutoControlEntryPoint({ entry, visible: true }));
    return () => { dispatch(setAutoControlEntryPoint({ entry, visible: false })); };
  }, [dispatch, entry]);

  const label = visible ? 'Hide Auto Control' : 'Show Auto Control';
  const toggleVisible = () => {
    if (!visible && !conciergeEnabled) onEnableGuide?.();
    dispatch(setAutoControlVisible({ visible: !visible, actor: 'user' }));
  };
  return (
    <Tooltip title={!conciergeEnabled && !onEnableGuide ? 'Turn Guide Mode on before using Auto Control' : visible ? 'Hide pill and turn Auto Control off' : 'Show the Auto Control pill without turning it on'}>
      <Button
        size="small"
        type="button"
        aria-label={label}
        aria-pressed={visible}
        disabled={!conciergeEnabled && !onEnableGuide}
        data-ai-action="clikb.global.auto_control.control.reveal"
        data-ai-activation="pointerdown"
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          event.preventDefault();
          toggleVisible();
        }}
        onClick={(event) => {
          if (event.detail === 0) toggleVisible();
        }}
        startIcon={<TouchAppRoundedIcon sx={{ fontSize: compact ? 15 : 18 }} />}
        sx={{
          minWidth: compact ? 72 : 0, minHeight: compact ? 34 : undefined, ml: 0, px: compact ? 1 : 1.1, py: compact ? 0.35 : 0.5,
          borderRadius: 999, color: appColor, border: `1px solid ${appColor}77`,
          textTransform: 'none', fontSize: compact ? 10 : 12, fontWeight: 800,
          lineHeight: 1.5, whiteSpace: 'nowrap',
          '& .MuiButton-startIcon': { mr: compact ? 0.3 : 0.6 },
          '&:hover': { background: `${appColor}18`, borderColor: appColor },
        }}
      >
        Control
      </Button>
    </Tooltip>
  );
}
