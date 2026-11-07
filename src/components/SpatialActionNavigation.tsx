import { Box, IconButton } from '@mui/material';
import { useEffect, useState } from 'react';

/** Tap controls stay reachable over action playback, independent of held drive. */
export default function SpatialActionNavigation(props: {
    mode: 'analog' | 'dpad' | 'hover'; visible: boolean; controllerSize: number;
    canBack: boolean; canForward: boolean; onBack(): void; onForward(): void;
}) {
    const [pulse, setPulse] = useState<'back' | 'forward' | null>(null);
    useEffect(() => {
        if (!props.visible || !pulse) return;
        const timer = setTimeout(() => setPulse(null), 420);
        return () => clearTimeout(timer);
    }, [pulse, props.visible]);
    const step = (direction: 'back' | 'forward') => {
        setPulse(direction);
        (direction === 'back' ? props.onBack : props.onForward)();
    };
    const size = props.controllerSize * .38;
    const surface = 'rgba(8,10,16,.88)', ink = '#fff';
    return <Box data-spatial-action-navigation={props.mode} role="group" aria-label="Action steps"
        sx={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', bottom: `calc(clamp(24px, 5vh, 56px) + ${props.controllerSize * .31}px)`,
            zIndex: 40003, display: props.visible ? 'flex' : 'none', gap: `${props.controllerSize * .5}px`, pointerEvents: 'auto' }}>
        {(['back', 'forward'] as const).map(direction => <IconButton key={direction}
            className="spatial-action-step" data-pulse={props.visible && pulse === direction ? 'true' : 'false'}
            aria-label={direction === 'back' ? 'Previous action step' : 'Next action step'}
            title={direction === 'back' ? 'Back' : 'Forward'}
            disabled={!props.visible || (direction === 'back' ? !props.canBack : !props.canForward)}
            onPointerDown={event => { if (event.isPrimary && event.button === 0) { event.preventDefault(); event.stopPropagation(); step(direction); } }}
            onClick={event => { event.stopPropagation(); if (event.detail === 0) step(direction); }}
            sx={{ width: size, height: size, boxSizing: 'border-box', p: 0, color: ink, touchAction: 'manipulation', background: props.mode === 'analog'
                ? 'linear-gradient(145deg, #222, #050505)' : surface,
                border: '2px solid rgba(255,255,255,.88)',
                borderRadius: props.mode === 'dpad' ? '12px' : '50%', backdropFilter: 'blur(12px)',
                boxShadow: '0 6px 18px rgba(0,0,0,.25)',
                '&:hover, &:active': { borderColor: '#fff', boxShadow: '0 0 0 3px rgba(255,255,255,.22)' },
                '&.Mui-disabled': { color: ink, opacity: .35, background: surface } }}>
            {props.mode === 'hover' && <svg width={size * .35} height={size * .35} viewBox="0 0 24 24" focusable="false" aria-hidden
                style={{ transform: `rotate(${direction === 'back' ? 270 : 90}deg)` }}><path d="M12 3 22 21H2Z" fill="currentColor" /></svg>}
            {props.mode === 'dpad' && <Box component="span" aria-hidden sx={{ fontSize: size * .35 }}>{direction === 'back' ? '◀' : '▶'}</Box>}
        </IconButton>)}
    </Box>;
}
