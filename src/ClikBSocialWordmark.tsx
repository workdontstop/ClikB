import type { CSSProperties } from 'react';

export default function ClikBSocialWordmark({ fontSize = '1.25rem' }: { fontSize?: CSSProperties['fontSize'] }) {
  return <span style={{ fontSize, fontFamily: 'Righteous, sans-serif', fontWeight: 400, fontStyle: 'normal', letterSpacing: 0, lineHeight: 1, whiteSpace: 'nowrap' }}>
    C<span style={{ fontFamily: '"Exo 2", sans-serif', fontWeight: 700 }}>l</span>ikBSocial
  </span>;
}
