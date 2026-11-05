import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { DISCORD_INVITE } from '../site/links';

/**
 * Placeholder until merch is planned. Merch drawings and badge stickers float around "Coming soon",
 * each on its own slow rhythm; grab one and fling it and it springs back. The copy names no items.
 * With reduced motion they simply sit still.
 */

// Simple flat merch drawings (navy / sand / white), sized by the wrapper.
const ITEM_ART = {
  tee: (
    <svg viewBox="0 0 200 180" className="block h-full w-full drop-shadow-[0_10px_14px_rgb(15_23_42/0.25)]">
      <path d="M64 18 L40 28 L8 56 L28 84 L46 72 L46 166 Q46 172 52 172 L148 172 Q154 172 154 166 L154 72 L172 84 L192 56 L160 28 L136 18 Q128 36 100 36 Q72 36 64 18 Z" fill="#1e3a8a" stroke="#14213d" strokeWidth="3" strokeLinejoin="round" />
      <path d="M64 18 Q72 36 100 36 Q128 36 136 18" fill="none" stroke="#14213d" strokeWidth="3" strokeLinecap="round" />
      <circle cx="100" cy="88" r="15" fill="none" stroke="#fbfaf7" strokeWidth="4" />
      <path d="M93 88 l5 5 l9 -10" fill="none" stroke="#fbfaf7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  cap: (
    <svg viewBox="0 0 200 140" className="block h-full w-full drop-shadow-[0_10px_14px_rgb(15_23_42/0.25)]">
      <path d="M30 96 Q30 30 100 26 Q170 30 170 96 Z" fill="#f4e3c1" stroke="#14213d" strokeWidth="3" strokeLinejoin="round" />
      <path d="M100 26 L100 96 M62 34 Q78 60 76 96 M138 34 Q122 60 124 96" fill="none" stroke="#14213d" strokeOpacity="0.35" strokeWidth="2.5" />
      <path d="M22 96 Q100 84 192 104 Q186 120 150 118 Q100 104 26 110 Z" fill="#1e3a8a" stroke="#14213d" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="100" cy="24" r="6" fill="#1e3a8a" stroke="#14213d" strokeWidth="3" />
    </svg>
  ),
  tote: (
    <svg viewBox="0 0 160 190" className="block h-full w-full drop-shadow-[0_10px_14px_rgb(15_23_42/0.25)]">
      <path d="M52 60 Q52 14 80 14 Q108 14 108 60" fill="none" stroke="#14213d" strokeWidth="7" strokeLinecap="round" />
      <path d="M52 60 Q52 14 80 14 Q108 14 108 60" fill="none" stroke="#f4e3c1" strokeWidth="3.5" strokeLinecap="round" />
      <rect x="18" y="56" width="124" height="124" rx="6" fill="#f4e3c1" stroke="#14213d" strokeWidth="3" />
      <rect x="54" y="98" width="52" height="40" rx="6" fill="#1e3a8a" />
      <path d="M66 112 l-7 6 l7 6 M94 112 l7 6 l-7 6 M84 108 l-8 20" fill="none" stroke="#fbfaf7" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  mug: (
    <svg viewBox="0 0 180 170" className="block h-full w-full drop-shadow-[0_10px_14px_rgb(15_23_42/0.25)]">
      <path d="M126 62 Q166 62 166 96 Q166 130 126 128" fill="none" stroke="#14213d" strokeWidth="14" strokeLinecap="round" />
      <path d="M126 62 Q166 62 166 96 Q166 130 126 128" fill="none" stroke="#fbfaf7" strokeWidth="8" strokeLinecap="round" />
      <path d="M22 40 L134 40 L128 150 Q127 160 117 160 L39 160 Q29 160 28 150 Z" fill="#fbfaf7" stroke="#14213d" strokeWidth="3" strokeLinejoin="round" />
      <ellipse cx="78" cy="40" rx="56" ry="9" fill="#e9e4d8" stroke="#14213d" strokeWidth="3" />
      <rect x="50" y="78" width="56" height="44" rx="5" fill="#0d1117" />
      <path d="M60 92 l8 7 l-8 7 M74 108 l14 0" fill="none" stroke="#7aa2ff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
} as const;

type StickerDef = {
  /** A badge sticker image, or one of the drawn items. */
  src?: string;
  item?: keyof typeof ITEM_ART;
  left: string;
  top: string;
  size: number;      // px on desktop
  rotate: number;    // resting tilt, degrees
  drift: number;     // float distance, px
  duration: number;  // seconds per float cycle
  delay: number;
  phoneHidden?: boolean;
};

const STICKERS: StickerDef[] = [
  { item: 'tee',  left: '3%',  top: '8%',  size: 150, rotate: -8,  drift: 14, duration: 7.2, delay: 0 },
  { item: 'cap',  left: '74%', top: '6%',  size: 140, rotate: 9,   drift: 12, duration: 6.6, delay: 0.9 },
  { item: 'tote', left: '80%', top: '52%', size: 110, rotate: -6,  drift: 13, duration: 7.6, delay: 1.7 },
  { item: 'mug',  left: '5%',  top: '60%', size: 112, rotate: 7,   drift: 11, duration: 6.9, delay: 0.5 },
  { src: '/awards/builder-gold.webp',     left: '27%', top: '6%',  size: 64, rotate: -12, drift: 10, duration: 5.8, delay: 1.3, phoneHidden: true },
  { src: '/awards/verified.webp',         left: '24%', top: '70%', size: 58, rotate: 10,  drift: 9,  duration: 6.1, delay: 2.1, phoneHidden: true },
  { src: '/awards/bayanihan-silver.webp', left: '64%', top: '74%', size: 60, rotate: -8,  drift: 10, duration: 6.4, delay: 0.3, phoneHidden: true },
  { src: '/awards/connected.webp',        left: '62%', top: '8%',  size: 50, rotate: 14,  drift: 8,  duration: 5.5, delay: 2.6, phoneHidden: true },
  { src: '/awards/toolkit-gold.webp',     left: '88%', top: '34%', size: 54, rotate: -14, drift: 9,  duration: 6.0, delay: 1.0, phoneHidden: true },
];

const Sticker: React.FC<{ s: StickerDef; live: boolean; bounds: React.RefObject<HTMLDivElement> }> = ({ s, live, bounds }) => (
  <motion.div
    className={`absolute z-0 ${s.phoneHidden ? 'hidden sm:block' : ''}`}
    style={{ left: s.left, top: s.top, width: `clamp(${Math.round(s.size * 0.62)}px, 9vw, ${s.size}px)` }}
    initial={live ? { opacity: 0, scale: 0.6, rotate: s.rotate - 20 } : false}
    animate={{ opacity: 1, scale: 1, rotate: s.rotate }}
    transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 + s.delay * 0.15 }}
    drag={live}
    dragConstraints={bounds}
    dragSnapToOrigin
    dragElastic={0.35}
    dragTransition={{ bounceStiffness: 260, bounceDamping: 16 }}
    whileHover={live ? { scale: 1.06 } : undefined}
    whileDrag={{ scale: 1.12, rotate: s.rotate + 6, cursor: 'grabbing', zIndex: 20 }}
  >
    <motion.div
      className="cursor-grab select-none"
      animate={live ? { y: [0, -s.drift, 0], rotate: [0, s.rotate > 0 ? 3 : -3, 0] } : undefined}
      transition={live ? { duration: s.duration, delay: s.delay, repeat: Infinity, ease: 'easeInOut' } : undefined}
    >
      {s.item ? (
        ITEM_ART[s.item]
      ) : (
        <img
          src={s.src}
          alt=""
          draggable={false}
          className="block w-full select-none rounded-full bg-white p-[4px] shadow-[0_10px_22px_-10px_rgb(15_23_42/0.45),0_0_0_1px_rgb(15_23_42/0.06)]"
        />
      )}
    </motion.div>
  </motion.div>
);

export const MerchTab: React.FC = () => {
  const live = !useReducedMotion();
  const bounds = React.useRef<HTMLDivElement>(null);

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-14">
      <h1 className="text-[28px] sm:text-[32px]">Merch</h1>

      <div ref={bounds} className="s-card relative mt-8 h-[440px] overflow-hidden sm:h-[480px]">
        {STICKERS.map((s) => <Sticker key={s.src ?? s.item} s={s} live={live} bounds={bounds} />)}

        <motion.div
          className="pointer-events-none relative z-10 flex h-full flex-col items-center justify-center px-6 text-center"
          initial={live ? { opacity: 0, y: 12 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <h2 className="text-[44px] font-semibold leading-none tracking-[-0.03em] text-slate-900 sm:text-[64px]">Coming soon</h2>
          <p className="mt-4 max-w-xs text-[15px] leading-relaxed text-slate-600">
            Something good is in the works. Announcements go out on Discord first.
          </p>
          <a href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className="s-btn s-btn-plain pointer-events-auto mt-6 bg-white">
            Follow on Discord
            <ArrowUpRight size={15} strokeWidth={1.75} />
          </a>
        </motion.div>
      </div>
    </main>
  );
};
