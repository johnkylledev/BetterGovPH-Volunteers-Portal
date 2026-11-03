import React, { useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { Tier } from './awards';

type Finish = Tier | 'locked';

/** Metal stops run highlight → body → shadow → rim light, lit from the top-left. */
const METAL: Record<Finish, { stops: [string, string, string, string]; line: string; glyph: string; enamel: [string, string] }> = {
  gold: { stops: ['#fff3c4', '#e9b93a', '#9c6b08', '#f8d978'], line: '#7a5306', glyph: '#fde68a', enamel: ['#2c4fa3', '#0d2c6e'] },
  silver: { stops: ['#ffffff', '#cfd6df', '#8b96a5', '#eef2f6'], line: '#5f6b7a', glyph: '#e8edf4', enamel: ['#2c4fa3', '#0d2c6e'] },
  bronze: { stops: ['#f6d3ae', '#c8844a', '#7c4519', '#e3a46d'], line: '#5e3010', glyph: '#fbd2a7', enamel: ['#2c4fa3', '#0d2c6e'] },
  locked: { stops: ['#eef2f6', '#e2e7ee', '#d3dae3', '#e9edf2'], line: '#b6c0cc', glyph: '#ffffff', enamel: ['#d8dee6', '#c5cdd8'] },
};

const PIPS: Record<Tier, number> = { bronze: 1, silver: 2, gold: 3 };

/** Scalloped rim: radius ripples around the circle like a struck medal's milled edge. */
const rimPath = (() => {
  const lobes = 20;
  const pts: string[] = [];
  for (let i = 0; i <= 360; i += 3) {
    const a = (i * Math.PI) / 180;
    const r = 46 + 2.2 * Math.cos(lobes * a);
    pts.push(`${(50 + Math.cos(a) * r).toFixed(2)},${(50 + Math.sin(a) * r).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
})();

interface MedalProps {
  icon: LucideIcon;
  tier: Tier | null;
  /** Show tier pips (tiered awards only). */
  pips?: boolean;
  size?: number;
  title?: string;
}

export const Medal: React.FC<MedalProps> = ({ icon: Icon, tier, pips = true, size = 64, title }) => {
  const uid = useId().replace(/:/g, '');
  const finish: Finish = tier ?? 'locked';
  const m = METAL[finish];
  const metal = `metal-${uid}`;
  const metalRev = `metalr-${uid}`;
  const enamel = `enamel-${uid}`;
  const clip = `clip-${uid}`;
  const pipCount = tier && pips ? PIPS[tier] : 0;

  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        filter: tier ? 'drop-shadow(0 1px 1px rgb(15 23 42 / 0.25)) drop-shadow(0 4px 8px rgb(15 23 42 / 0.12))' : 'none',
        opacity: tier ? 1 : 0.8,
      }}
      role="img"
      aria-label={title}
      title={title}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
        <defs>
          <linearGradient id={metal} x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor={m.stops[0]} />
            <stop offset="0.35" stopColor={m.stops[1]} />
            <stop offset="0.75" stopColor={m.stops[2]} />
            <stop offset="1" stopColor={m.stops[3]} />
          </linearGradient>
          <linearGradient id={metalRev} x1="0.85" y1="1" x2="0.15" y2="0">
            <stop offset="0" stopColor={m.stops[0]} />
            <stop offset="0.4" stopColor={m.stops[1]} />
            <stop offset="0.8" stopColor={m.stops[2]} />
            <stop offset="1" stopColor={m.stops[3]} />
          </linearGradient>
          <radialGradient id={enamel} cx="0.42" cy="0.35" r="0.75">
            <stop offset="0" stopColor={m.enamel[0]} />
            <stop offset="1" stopColor={m.enamel[1]} />
          </radialGradient>
          <clipPath id={clip}>
            <circle cx="50" cy="50" r="31" />
          </clipPath>
        </defs>

        {/* Milled rim */}
        <path d={rimPath} fill={`url(#${metal})`} stroke={m.line} strokeOpacity="0.35" strokeWidth="0.6" />
        {/* Bevel: same metal lit from the opposite side reads as a raised ring */}
        <circle cx="50" cy="50" r="38.5" fill={`url(#${metalRev})`} />
        <circle cx="50" cy="50" r="35.6" fill="none" stroke={m.line} strokeOpacity="0.45" strokeWidth="0.7" />
        <circle cx="50" cy="50" r="34.2" fill={`url(#${metal})`} />
        {/* Enamel face */}
        <circle cx="50" cy="50" r="31" fill={`url(#${enamel})`} />
        <g clipPath={`url(#${clip})`}>
          <ellipse cx="46" cy="30" rx="30" ry="16" fill="#ffffff" opacity={tier ? 0.12 : 0.18} />
        </g>
        <circle cx="50" cy="50" r="31" fill="none" stroke="#000" strokeOpacity="0.18" strokeWidth="0.8" />
        {/* Tier pips */}
        {Array.from({ length: pipCount }, (_, i) => {
          const spread = 6;
          const x = 50 + (i - (pipCount - 1) / 2) * spread;
          return <circle key={i} cx={x} cy="72" r="1.7" fill={m.glyph} opacity="0.9" />;
        })}
      </svg>
      <Icon
        size={Math.round(size * 0.3)}
        strokeWidth={2}
        className="absolute"
        style={{ color: m.glyph, transform: `translateY(${pipCount ? -size * 0.03 : 0}px)` }}
        aria-hidden
      />
    </span>
  );
};
