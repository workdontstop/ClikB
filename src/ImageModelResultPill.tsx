import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { Box } from '@mui/material';
import { useSelector } from 'react-redux';
import type { RootState } from './store';
import { getCreationImageModelName } from './imageModels';
import { getVideoModelDisplayName } from './videoModelCapabilities';

export const resultBadgeSx = {
  bgcolor: 'rgba(0,0,0,0.76)', backdropFilter: 'blur(8px)', color: '#fff',
  fontFamily: 'inherit', fontSize: '0.7rem', fontWeight: 850, letterSpacing: '0.03em',
  border: '1px solid rgba(255,255,255,0.25)', boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
} as const;

export function SceneNumberBadge({ number }: { number?: number }) {
  return number ? <Box component="span" className="creation-scene-count" data-scene-number={number}
    aria-label={`Scene ${number}`} sx={{ ...resultBadgeSx, position: 'absolute', top: 6, left: 6, zIndex: 15,
      width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center',
      pointerEvents: 'none', opacity: 0 }} >{number}</Box> : null;
}

/** A result's attribution never follows the next selected generation model. */
export default function ImageModelResultPill({ source, active, visitKey, onAddSet, sceneNumber, mediaKind = 'image', videoModel }: {
  source: string; active: boolean; visitKey: string; onAddSet: () => void;
  sceneNumber?: number; mediaKind?: 'image' | 'video'; videoModel?: string;
}) {
  const model = useSelector((state: RootState) => state.imageModelExamples.results[source]?.model);
  const [phase, setPhase] = useState<'scene' | 'model' | 'hidden'>(sceneNumber ? 'scene' : 'model');
  useEffect(() => {
    setPhase(sceneNumber ? 'scene' : 'model');
    if (!active) return;
    const modelTimer = sceneNumber ? window.setTimeout(() => setPhase('model'), 4000) : undefined;
    const hideTimer = window.setTimeout(() => setPhase('hidden'), sceneNumber ? 8000 : 4000);
    return () => { window.clearTimeout(modelTimer); window.clearTimeout(hideTimer); };
  }, [active, visitKey, source, model, videoModel, sceneNumber, mediaKind]);
  if (!active || phase === 'hidden' || (!source && phase === 'model')) return null;
  const dev = phase === 'model' && mediaKind === 'image' && import.meta.env.VITE_APPX_STATE === 'dev';
  const label = phase === 'scene' ? String(sceneNumber) : mediaKind === 'video'
    ? videoModel === 'uploaded' ? 'Uploaded video' : videoModel === 'gpu' ? 'GPU video' : videoModel ? getVideoModelDisplayName(videoModel) : 'Video model unavailable'
    : model === 'uploaded' ? 'Uploaded image' : model === 'video-frame' ? 'Video frame'
    : model ? getCreationImageModelName(model) : 'Model unavailable';
  return <Box component={dev ? 'button' : 'span'} type={dev ? 'button' : undefined}
    data-testid={phase === 'scene' ? 'scene-result-number' : mediaKind === 'video' ? 'video-model-result-pill' : 'image-model-result-pill'}
    aria-label={phase === 'scene' ? `Scene ${sceneNumber}` : dev ? `${label}. Add image model example set` : label}
    onClick={dev ? (event: MouseEvent) => { event.stopPropagation(); onAddSet(); } : undefined}
    sx={{ ...resultBadgeSx, position: 'absolute', bottom: '5%', left: '5%', zIndex: 10,
      px: phase === 'scene' ? 0 : 1.2, py: phase === 'scene' ? 0 : 0.3, borderRadius: phase === 'scene' ? '50%' : '6px',
      ...(phase === 'scene' ? { width: 28, height: 28, display: 'grid', placeItems: 'center' } : {}),
      cursor: dev ? 'pointer' : 'default', pointerEvents: dev ? 'auto' : 'none' }}>
    {label}
  </Box>;
}
