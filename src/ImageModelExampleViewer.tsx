import { useEffect, useId, useRef, useState } from 'react';
import { Box, IconButton, Modal, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

export type ImageModelExamplePreview = { model: string; name: string; url: string };

/** Browsing examples is independent of the model selected for generation. */
export default function ImageModelExampleViewer({ open, items, index, onIndexChange, onClose, overlayZIndex }: {
  open: boolean; items: ImageModelExamplePreview[]; index: number;
  onIndexChange: (index: number) => void; onClose: () => void;
  overlayZIndex?: number;
}) {
  const titleId = useId();
  const [surface, setSurface] = useState<HTMLDivElement | null>(null);
  const image = useRef<HTMLImageElement>(null);
  const backdropGesture = useRef<{ x: number; y: number; onImage: boolean; moved: boolean } | null>(null);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const lastWheel = useRef(0);
  const wheelGesture = useRef({ distance: 0, at: 0 });
  const currentIndex = Math.max(0, Math.min(index, items.length - 1));
  const item = items[currentIndex];
  const move = (direction: number) => {
    if (items.length > 1) onIndexChange((currentIndex + direction + items.length) % items.length);
  };
  const moveRef = useRef(move);
  moveRef.current = move;
  const visible = open && Boolean(item);
  useEffect(() => {
    const node = surface;
    if (!visible || !node) return;
    lastWheel.current = 0;
    wheelGesture.current = { distance: 0, at: 0 };
    // React wheel handlers are passive. Cancel the native horizontal gesture,
    // including its small starting deltas and momentum, before browser history sees it.
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) { wheelGesture.current.distance = 0; return; }
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      const now = Date.now();
      if (now - lastWheel.current < 300) return;
      const dx = event.deltaX * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 300 : 1);
      if (now - wheelGesture.current.at > 250 || wheelGesture.current.distance * dx < 0) wheelGesture.current.distance = 0;
      wheelGesture.current.at = now; wheelGesture.current.distance += dx;
      if (Math.abs(wheelGesture.current.distance) < 50) return;
      lastWheel.current = now; moveRef.current(wheelGesture.current.distance > 0 ? 1 : -1); wheelGesture.current.distance = 0;
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, [visible, surface]);
  const isImagePoint = (x: number, y: number) => {
    const node = image.current;
    if (!node || !node.naturalWidth || !node.naturalHeight) return false;
    const bounds = node.getBoundingClientRect();
    const scale = Math.min(bounds.width / node.naturalWidth, bounds.height / node.naturalHeight);
    const width = node.naturalWidth * scale, height = node.naturalHeight * scale;
    const left = bounds.left + (bounds.width - width) / 2, top = bounds.top + (bounds.height - height) / 2;
    return x >= left && x <= left + width && y >= top && y <= top + height;
  };
  const buttonSx = { color: '#fff', bgcolor: 'rgba(255,255,255,0.14)',
    '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' }, width: 44, height: 44 };
  return <Modal open={visible} onClose={onClose} sx={{ zIndex: overlayZIndex ?? 10000 }}>
    <Box ref={setSurface} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
      data-testid="image-model-example-viewer"
      onPointerDownCapture={event => {
        backdropGesture.current = event.isPrimary && event.button === 0
          ? { x: event.clientX, y: event.clientY, onImage: isImagePoint(event.clientX, event.clientY), moved: false } : null;
      }}
      onPointerMoveCapture={event => {
        const start = backdropGesture.current;
        if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) start.moved = true;
      }}
      onPointerCancel={() => { backdropGesture.current = null; }}
      onClick={event => {
        const start = backdropGesture.current; backdropGesture.current = null;
        if (start && !start.moved && !start.onImage && !isImagePoint(event.clientX, event.clientY)
          && !(event.target as HTMLElement).closest('button, [data-comparison-caption]')) onClose();
      }}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault(); event.stopPropagation(); move(event.key === 'ArrowRight' ? 1 : -1);
        } else if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      }}
      sx={{ position: 'fixed', inset: 0, height: '100dvh', bgcolor: 'rgba(0,0,0,0.94)', color: '#fff',
        display: 'flex', flexDirection: 'column', outline: 'none', pt: 'max(12px, env(safe-area-inset-top))',
        pb: 'max(16px, env(safe-area-inset-bottom))', boxSizing: 'border-box', overflow: 'hidden', overscrollBehaviorX: 'none' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 2, flexShrink: 0 }}>
        <IconButton aria-label="Close image comparison" onClick={onClose} sx={buttonSx}><CloseIcon /></IconButton>
      </Box>
      <Box data-testid="image-model-example-stage"
        onPointerDown={event => {
          if (!event.isPrimary || event.button !== 0) return;
          gesture.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={event => {
          const start = gesture.current; gesture.current = null;
          if (!start) return;
          const dx = event.clientX - start.x, dy = event.clientY - start.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) move(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => { gesture.current = null; }}
        sx={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center', alignItems: 'center',
          px: { xs: 1, sm: 8 }, py: 1, touchAction: 'pan-y pinch-zoom', userSelect: 'none' }}>
        {item && <Box ref={image} key={item.model} component="img" src={item.url} alt={`${item.name} example`} draggable={false}
          sx={{ width: '100%', height: '100%', objectFit: 'contain', minHeight: 0 }} />}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, px: 2, pt: 1, flexShrink: 0 }}>
        <IconButton aria-label="Previous model image" disabled={items.length < 2} onClick={() => move(-1)} sx={buttonSx}><ChevronLeftIcon /></IconButton>
        <Box data-comparison-caption sx={{ textAlign: 'center', minWidth: 0, width: { xs: 230, sm: 320 } }}>
          <Typography id={titleId} sx={{ fontWeight: 700, fontSize: { xs: 16, sm: 19 } }}>{item?.name}</Typography>
          <Typography sx={{ fontSize: 12, opacity: 0.7 }}>{currentIndex + 1} / {items.length}</Typography>
        </Box>
        <IconButton aria-label="Next model image" disabled={items.length < 2} onClick={() => move(1)} sx={buttonSx}><ChevronRightIcon /></IconButton>
      </Box>
    </Box>
  </Modal>;
}
