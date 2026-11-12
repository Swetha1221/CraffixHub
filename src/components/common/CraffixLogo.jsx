import React from 'react';

export function CraffixLogo({ variant = 'light', size = 34, showWordmark = false, wordmarkText = 'CraffixHub' }) {
  const src = variant === 'dark' ? '/cw-logo-dark.png' : '/cw-logo-light.png';
  const textColor = variant === 'dark' ? '#FFFFFF' : '#0B1F3B';

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <img
        src={src}
        alt="Craffixweb Logo"
        style={{
          height: size,
          width: 'auto',
          objectFit: 'contain',
          display: 'block',
          flexShrink: 0,
        }}
      />
      {showWordmark && (
        <span
          style={{
            fontWeight: 800,
            fontSize: Math.round(size * 0.58),
            letterSpacing: '-0.025em',
            color: textColor,
            lineHeight: 1,
          }}
        >
          {wordmarkText}
        </span>
      )}
    </span>
  );
}
