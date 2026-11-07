import { keyframes } from '@emotion/react';

export const appColorPillFloatAndFade = keyframes`
  0% { opacity: 0; transform: translate3d(-50%, 10px, 0) scale(.97); }
  12% { opacity: 1; transform: translate3d(-50%, 0, 0) scale(1); }
  78% { opacity: 1; transform: translate3d(-50%, 0, 0) scale(1); }
  100% { opacity: 0; transform: translate3d(-50%, -8px, 0) scale(.99); }
`;

/** The app's existing charge/hint pill, shared by creation save feedback. */
export const appColorHintPillSx = (appColor: string, darkMode: boolean) => ({
  position: 'fixed', left: '50%', top: '48%', zIndex: 20000, pointerEvents: 'none',
  width: 'max-content', maxWidth: 'calc(100vw - 24px)', boxSizing: 'border-box',
  px: { xs: 1.5, sm: 2.25 }, py: { xs: .9, sm: 1.1 }, borderRadius: 999,
  color: darkMode ? '#fff' : '#111', fontWeight: 900,
  fontSize: { xs: '.78rem', sm: '.92rem' }, lineHeight: 1.25, textAlign: 'center',
  whiteSpace: 'normal', overflowWrap: 'anywhere', letterSpacing: '.02em',
  background: darkMode ? 'rgba(16,16,18,.84)' : 'rgba(255,255,255,.9)',
  border: `1px solid ${appColor}`,
  boxShadow: `0 12px 40px color-mix(in srgb, ${appColor} 30%, transparent)`,
  backdropFilter: 'blur(18px) saturate(150%)', willChange: 'transform, opacity',
  animation: `${appColorPillFloatAndFade} 2.55s cubic-bezier(.22,.8,.28,1) forwards`,
  '@media (prefers-reduced-motion: reduce)': { animation: 'none', opacity: 1 },
});
