// Mira's head, the same drawing as in the phone app: cream shell, dark screen, glowing orange eyes, orange ear-cups.
export default function MiraFace({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.86} viewBox="0 0 120 100" aria-hidden="true" focusable="false" style={{ flex: "none" }}>
      <defs>
        <linearGradient id="mf-shell" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#FFF8EC" />
          <stop offset="1" stopColor="#FFE0BE" />
        </linearGradient>
        <linearGradient id="mf-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3A2218" />
          <stop offset="1" stopColor="#120A07" />
        </linearGradient>
        <radialGradient id="mf-eye" cx="0.5" cy="0.5" r="0.55">
          <stop offset="0" stopColor="#FFF6CF" />
          <stop offset="0.55" stopColor="#FFB347" />
          <stop offset="1" stopColor="#FF6A1F" />
        </radialGradient>
      </defs>
      {[14, 106].map((x) => (
        <g key={x}>
          <circle cx={x} cy="50" r="14" fill="#FF7A2B" />
          <circle cx={x} cy="50" r="9.5" fill="#FFF1DE" />
          <circle cx={x} cy="50" r="5.5" fill="#FF7A2B" />
        </g>
      ))}
      <rect x="14" y="6" width="92" height="86" rx="32" fill="url(#mf-shell)" stroke="#FFC48A" strokeWidth="1.5" />
      <rect x="24" y="19" width="72" height="60" rx="24" fill="url(#mf-screen)" />
      {[45, 75].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy="48" rx="13" ry="17" fill="#FF8A3D" opacity="0.28" />
          <ellipse cx={x} cy="48" rx="9.5" ry="12" fill="url(#mf-eye)" />
          <ellipse cx={x - 2.5} cy="42.5" rx="3.2" ry="4.4" fill="#fff" opacity="0.92" />
        </g>
      ))}
      <path d="M52 64 Q60 70.5 68 64" stroke="#FFD2A0" strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}
