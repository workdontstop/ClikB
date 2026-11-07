import { useEffect, useMemo, useState } from 'react';
import { Box, Collapse, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { spatialNoticeDuration } from '../spatialNoticeTiming';

/** One inline message at a time; no modal, toast stack, or document mutations. */
export default function SpatialInfoPill({ messages, noticeKey, darkMode, accent, paused = false }: {
    messages: string[]; noticeKey: string; darkMode: boolean; accent?: string; paused?: boolean;
}) {
    const signature = JSON.stringify([noticeKey, messages]);
    const queue = useMemo<string[]>(() => [...new Set(JSON.parse(signature)[1] as string[])].filter(Boolean), [signature]);
    const [index, setIndex] = useState(0), [open, setOpen] = useState(true), [hovered, setHovered] = useState(false);
    useEffect(() => { setIndex(0); setOpen(true); setHovered(false); }, [signature]);
    const message = queue[index];
    useEffect(() => {
        if (!message || !open || paused || hovered) return;
        const timer = setTimeout(() => setOpen(false), spatialNoticeDuration(message));
        return () => clearTimeout(timer);
    }, [message, index, open, paused, hovered]);
    return <Collapse in={Boolean(message && open)} timeout={220} sx={{ width: '100%' }} onExited={() => { setIndex(value => value + 1); setOpen(true); setHovered(false); }}>
        <Box data-spatial-info-pill role="status" aria-live="polite" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)} sx={{ display: 'flex', alignItems: 'flex-start', gap: .75, px: 1.25, py: .9, borderRadius: 4,
            background: darkMode ? 'rgba(12,15,20,.94)' : 'rgba(255,255,255,.96)', color: darkMode ? '#fff' : '#111',
            border: `1px solid ${accent || (darkMode ? 'rgba(255,255,255,.18)' : 'rgba(0,0,0,.12)')}`, backdropFilter: 'blur(18px)',
            boxShadow: '0 4px 14px rgba(0,0,0,.12)', transform: open ? 'translateX(0)' : 'translateX(-12px)', transition: 'transform 220ms ease' }}>
            <InfoOutlinedIcon sx={{ fontSize: 18, mt: .2 }} />
            <Typography variant="caption" sx={{ flex: 1, lineHeight: 1.5 }}>{message}</Typography>
            <IconButton size="small" aria-label="Dismiss motion notice" onClick={() => setOpen(false)} sx={{ color: 'inherit', p: .25 }}><CloseIcon sx={{ fontSize: 16 }} /></IconButton>
        </Box>
    </Collapse>;
}
