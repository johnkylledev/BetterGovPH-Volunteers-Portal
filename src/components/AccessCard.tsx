import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionTemplate, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';
import { User } from '../types';
import clsx from 'clsx';

interface AccessCardProps {
  user: User;
  isDemo?: boolean;
}

/** Name size steps down with length so long names stay on two lines at most. */
const nameSize = (name: string) => {
  const n = name.length;
  if (n <= 14) return 28;
  if (n <= 20) return 24;
  if (n <= 28) return 21;
  return 18;
};

export const BrandMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" className={className} aria-hidden="true">
                <path d="M156,730.55a14.49,14.49,0,0,0,6.12-4.75,13.69,13.69,0,0,0,2.56-6.55,14.34,14.34,0,0,0-.92-6.94l.53-.24a14.79,14.79,0,0,0,7.34,5.61,12.19,12.19,0,0,0,9.09-.58,13.48,13.48,0,0,0,8-9.16q1.76-6.42-2.32-15.68l-10.09-22.9-54.93,24.18,10.85,24.65a26.49,26.49,0,0,0,6.56,9.47,16.56,16.56,0,0,0,8.34,4.11A15.6,15.6,0,0,0,156,730.55Zm15.6-43.28,3.32,7.57a8.89,8.89,0,0,1,.74,6,5.78,5.78,0,0,1-3.47,3.87,5.87,5.87,0,0,1-5.43-.11,9.33,9.33,0,0,1-4-4.66l-3.24-7.35Zm-30.08,23-3.61-8.21L151,696.34l3.72,8.45a9.83,9.83,0,0,1,.77,6.82,6.87,6.87,0,0,1-4.06,4.4,6,6,0,0,1-5.47,0Q143.46,714.63,141.55,710.31Z" />
                <polygon points="174.59 747.51 187.76 768.99 197.83 762.82 184.65 741.34 195.14 734.9 209.44 758.21 219.49 752.05 197.6 716.37 146.44 747.76 168.32 783.43 178.37 777.27 164.07 753.96 174.59 747.51" />
                <polygon points="244.62 802.1 253.72 794.62 221.51 755.43 212.41 762.91 223.98 776.99 186.72 807.62 195.8 818.67 233.06 788.04 244.62 802.1" />
                <polygon points="284.54 838.75 292.47 830.04 254.94 795.9 247.01 804.62 260.5 816.88 228.04 852.57 238.62 862.19 271.08 826.51 284.54 838.75" />
                <polygon points="308.28 884.26 314.94 874.51 294.13 860.3 301.07 850.13 323.65 865.55 330.3 855.82 295.73 832.22 261.89 881.79 296.45 905.39 303.09 895.66 280.51 880.24 287.47 870.05 308.28 884.26" />
                <path d="M366.82,877.36a26,26,0,0,0-9.33-7.38L335.3,858.9l-26.81,53.7,13,6.48,9.17-18.38,6.67,3.32.62,23.28,14.16,7.07-.93-26a16.93,16.93,0,0,0,9.81-2.47,19.57,19.57,0,0,0,7.17-8.24,20.43,20.43,0,0,0,2.37-10.72A17.81,17.81,0,0,0,366.82,877.36Zm-12.13,13.56q-1.86,3.72-5,4.33t-7.53-1.58l-6.4-3.2,7.31-14.63,6.4,3.2Q358.4,883.5,354.69,890.92Z" />
                <path d="M419,895.85a31.1,31.1,0,0,0-26.07-7.39,26.45,26.45,0,0,0-13.1,6.84Q374.05,900.69,371,910a34.64,34.64,0,0,0-1.6,16.7A25.93,25.93,0,0,0,375.78,940,32.27,32.27,0,0,0,403,949.5,22.7,22.7,0,0,0,414.62,944a26.71,26.71,0,0,0,7.5-12.09l2.45-7.55-24.61-8-3.27,10.06L408,930.11a9.86,9.86,0,0,1-5.48,6.15q-3.9,1.68-9.51-.14-6.4-2.08-8.47-7.78t.6-13.91q2.66-8.17,7.75-11.47a12.6,12.6,0,0,1,11.31-1.29,12.23,12.23,0,0,1,6.25,4.15,9.79,9.79,0,0,1,1.88,6.59l14,4.54a21.36,21.36,0,0,0-.79-11.4A24.14,24.14,0,0,0,419,895.85Z" />
                <path d="M479.26,908.64a31.43,31.43,0,0,0-28.82-4.3,25.88,25.88,0,0,0-11.7,8.81q-4.74,6.24-6.22,16.07t1.27,17.14a25.87,25.87,0,0,0,8.61,11.88,31.4,31.4,0,0,0,28.81,4.31,26,26,0,0,0,11.73-8.83q4.79-6.24,6.25-16t-1.29-17.19A26,26,0,0,0,479.26,908.64Zm-4.74,26.85q-1.31,8.73-5.61,12.77a13.43,13.43,0,0,1-20.1-3q-3-5.14-1.65-13.87t5.63-12.77a13.43,13.43,0,0,1,20.1,3Q475.83,926.76,474.52,935.49Z" />
                <polygon points="524.26 951.64 523.77 951.65 509.75 907.87 493.52 908.09 514.58 967.83 533.89 967.57 553.33 907.28 537.09 907.5 524.26 951.64" />
                <path d="M568,952.68a7.61,7.61,0,0,0-10.65,1.15,7.06,7.06,0,0,0-1.62,5.54,7.19,7.19,0,0,0,2.77,5.12,7.67,7.67,0,0,0,12.37-6.76A7.19,7.19,0,0,0,568,952.68Z" />
                <path d="M617.43,904.94a18.65,18.65,0,0,0-8.93-5.56,24.32,24.32,0,0,0-11.94-.14l-24.25,5.16,12.5,58.7,14.18-3-3.88-18.23,9.64-2.05a25.87,25.87,0,0,0,11.09-5,18.48,18.48,0,0,0,6-8.65A21.12,21.12,0,0,0,622.3,915,21.53,21.53,0,0,0,617.43,904.94Zm-10.94,20.25c-1.32,2-3.57,3.32-6.76,4l-7,1.48-3.8-17.85,7-1.49c3.2-.68,5.79-.4,7.8.84a8.76,8.76,0,0,1,3.87,6A9,9,0,0,1,606.49,925.19Z" />
                <polygon points="657.28 880.42 665.72 902.99 643.56 911.27 635.13 888.71 621.54 893.79 642.56 950.01 656.15 944.92 647.7 922.33 669.85 914.05 678.3 936.64 691.86 931.57 670.84 875.35 657.28 880.42" />
                <path d="M970.43,644.2l28-26.82-28-26.8L727.76,608.05a233.2,233.2,0,0,0-3-29.86L941.2,562.61l-27.47-26.27L721.44,562.17a232.84,232.84,0,0,0-27.8-67.08L847.88,377.37l.84-38-164.05,142a240,240,0,0,0-18.95-23.25L849.63,298.92l.86-38.77-38.77.87L652.5,444.93a238.54,238.54,0,0,0-23.27-19l142-164-38,.84L615.55,417a233.55,233.55,0,0,0-67.07-27.82L574.3,196.91,548,169.45,532.43,385.92a234.14,234.14,0,0,0-29.84-3.05l17.47-242.66-26.82-28-26.8,28,17.47,242.66a235,235,0,0,0-29.86,3.05L438.47,169.45,412.2,196.91,438,389.18A233.44,233.44,0,0,0,371,417L253.22,262.77l-38-.84L357.25,426c-3,2.1-5.86,4.3-8.72,6.55-7.77.46-15.58,1.19-23.42,2.14L174.78,261,136,260.15l.86,38.77L298.08,438.49h0c-12.79,2-25.6,4.25-38.44,6.38h0L137.76,339.37l.87,38,93.93,71.69c-52.71,7.38-104.51,8.36-151-22.12,53.17,68.09,127.1,51,201.31,38.06,12.3-2.15,24.63-4.19,36.86-5.7,33.27-4.08,65.93-4.3,96,7.58,17,6.69,31.3,24.71,39.35,40.39,6.75,13.13,17.66,40.3,7.33,53.85a8.5,8.5,0,0,1-3.2,2.73c-3.68,1.61-7.75-.88-11.06-3.14-34.08-23.22-71.71-29.51-112.07-28.28,20.9,5.69,42,9.67,61.35,19.89a186.34,186.34,0,0,1,30.73,20.3c8.46,6.89,15.49,16.44,25,21.48,23.7,12.54,47.75,9.93,73.3,6.6,153.57-16,201.58,126,213.75,251.43-.55-5.69-32.23-14-37.31-15.34a205.75,205.75,0,0,0-42.52-6.41c-28.68-1.54-57.39,1.61-85.8,5.26-53.76,6.89-113.79,24.75-164.11-5-10.78-6.36-20.9-17-17.64-30.39,43,27,103.22-7.09,102.18-57.82-6.47,20.77-34.88,33.71-55.63,33.27-45.27-5.5,12.11-89.34,17.69-110.41,22.4-87.49-105.37-127.51-172.28-132.46-75.29-7.35-129.66,82.55-203.29,50.24,7.14,83.08,331.24,144.12,315.93,44.56-13.08,18-48.38,11.12-66.66,4.21-10.43-5.76-17.73-19.27-26.22-27.77-50.45-74.19,140.12-7,122.86,49-5.62,18.21-7.35,33.74-17.6,50.89-10.56,17.66-23.67,33.64-34.63,51-24,38.06-25.37,77.76,14.1,107.14,15.38,11.44,35.14,15.05,54.23,16.77,55.8,5,108.06-15.13,164-18.34,26-1.49,52.23-2.46,77.83,2.17,38.83,7,61.15,25.72,84,55.93-2.75-54.27-5.56-108.93-18.88-161.6a267.35,267.35,0,0,0-30.42-79.35s0-.08-.07-.13c.44-1.67,1-3.31,1.38-5l192.29,25.82,27.47-26.26L724.72,656.6a233.2,233.2,0,0,0,3-29.86ZM207.38,633a311.71,311.71,0,0,1-53-16.09c19-8.75,38.2-21,57.29-30.81C210.19,598.83,208.44,615.7,207.38,633Z" />
              </svg>
);

export const AccessCard: React.FC<AccessCardProps> = ({ user, isDemo }) => {
  const navigate = useNavigate();
  const boundingRef = useRef<HTMLDivElement>(null);
  // The card is designed at 300px. When its container is narrower (small phones), scale it
  // down uniformly instead of letting it push the page wider than the screen.
  const fitRef = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  useEffect(() => {
    const el = fitRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setFit(Math.min(1, entry.contentRect.width / 300)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const reduceMotion = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const tiltX = useSpring(rawX, { stiffness: 260, damping: 32 });
  const tiltY = useSpring(rawY, { stiffness: 260, damping: 32 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion || !boundingRef.current) return;
    const { left, top, width, height } = boundingRef.current.getBoundingClientRect();
    rawX.set((e.clientX - left - width / 2) / 45);
    rawY.set(-(e.clientY - top - height / 2) / 45);
  };

  const handleMouseLeave = () => {
    rawX.set(0);
    rawY.set(0);
  };

  const transform = useMotionTemplate`rotateX(${tiltY}deg) rotateY(${tiltX}deg)`;
  const glossX = useMotionTemplate`calc(50% + ${tiltX} * 18px)`;
  const glossY = useMotionTemplate`calc(30% + ${tiltY} * -14px)`;
  const sheen = useMotionTemplate`radial-gradient(90% 60% at ${glossX} ${glossY}, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.03) 40%, rgba(255,255,255,0) 70%)`;
  const holo = useMotionTemplate`conic-gradient(from calc(${tiltX} * 40deg), #e2e8f0, #c7d2fe, #fde68a, #a5f3fc, #e2e8f0)`;

  const name = (user.fullName || '').trim() || 'Member';
  const memberId = user.memberId || 'Pending';
  const verifyPath = `/verify/${user.memberId || user.id}`;
  const publicUrl = typeof window !== 'undefined' ? `${window.location.origin}${verifyPath}` : verifyPath;

  const fields: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: 'Member ID', value: memberId, mono: true },
    { label: 'Since', value: user.yearJoined || '—' },
    { label: 'Role', value: user.role || 'Member' },
  ];

  return (
    <div ref={fitRef} className="w-full max-w-[300px]" style={{ perspective: '1000px' }}>
      <motion.div
        id="access-card-container"
        ref={boundingRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        whileTap={isDemo ? undefined : { scale: 0.98 }}
        onClick={() => !isDemo && navigate(verifyPath)}
        role={isDemo ? undefined : 'link'}
        aria-label={isDemo ? undefined : `Open verification page for ${name}`}
        style={{
          transform: reduceMotion ? undefined : transform,
          transformStyle: 'preserve-3d',
          zoom: fit < 1 ? fit : undefined,
          background: 'linear-gradient(165deg, #1d4ea8 0%, #143c8c 42%, #0d2c6e 100%)',
          fontFamily: '"Open Runde", Inter, system-ui, sans-serif',
        }}
        className={clsx(
          'relative flex w-[300px] aspect-[2/3] flex-col overflow-hidden rounded-[18px] p-6 text-white select-none',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.25),0_0_0_1px_rgba(13,44,110,0.6),0_2px_4px_rgba(15,23,42,0.12),0_24px_48px_-16px_rgba(13,44,110,0.55)]',
          isDemo ? 'cursor-default' : 'cursor-pointer'
        )}
      >
        {/* Smooth card finish: soft light from the top corner and a gentle shade at the bottom, no pattern */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(120% 70% at 0% 0%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 55%), linear-gradient(to bottom, rgba(255,255,255,0) 60%, rgba(5,20,60,0.28) 100%)',
          }}
        />
        {/* Embossed seal, cropped by the right edge */}
        <BrandMark className="pointer-events-none absolute -right-20 top-14 h-72 w-72 fill-white opacity-[0.07]" />

        {!reduceMotion && (
          <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-20" style={{ backgroundImage: sheen }} />
        )}

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-10 w-10 fill-white" />
            <div className="leading-tight">
              <p className="text-[14px] font-semibold tracking-[-0.01em]">BetterGovPH</p>
              <p className="text-[10px] font-medium tracking-[0.04em] text-blue-200/80">Volunteers</p>
            </div>
          </div>
          <span className="rounded-full px-2 py-[3px] text-[9px] font-semibold uppercase tracking-[0.12em] text-blue-100 shadow-[inset_0_0_0_1px_rgba(191,219,254,0.3)]">
            Member
          </span>
        </div>

        {/* Name */}
        <div className="relative z-10 mt-auto">
          <h2
            className="font-semibold leading-[1.08] tracking-[-0.02em] text-white"
            style={{ fontSize: nameSize(name), textWrap: 'balance', wordBreak: 'break-word', fontFamily: 'inherit' }}
          >
            {name}
          </h2>
          {user.specialization && (
            <p className="mt-2 text-[13.5px] font-medium text-blue-100/90">{user.specialization}</p>
          )}
        </div>

        {/* Fields */}
        <dl className="relative z-10 mt-6 grid grid-cols-[1.5fr_0.8fr_1fr] gap-3 border-t border-white/15 pt-4">
          {fields.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-[9px] font-medium uppercase tracking-[0.1em] text-blue-200/75">{f.label}</dt>
              <dd
                className={clsx('mt-1 truncate text-[12px] font-semibold', f.mono && 'card-mono tracking-[0.02em]')}
                style={f.mono ? { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontVariantNumeric: 'tabular-nums' } : undefined}
              >
                {f.value}
              </dd>
            </div>
          ))}
        </dl>

        {/* Verify band — recessed footer holding the code, link and foil seal */}
        <div className="relative z-10 -mx-6 -mb-6 mt-6 flex items-center gap-3.5 border-t border-white/10 bg-[#081f52]/45 px-6 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="shrink-0 rounded-[8px] bg-white p-[5px] shadow-[inset_0_0_0_1px_rgba(13,44,110,0.08),0_1px_2px_rgba(0,0,0,0.3)]">
            {/* Logo cut into the centre; level H keeps it scannable with ~30% of modules covered */}
            <QRCodeSVG
              value={publicUrl}
              size={58}
              bgColor="#ffffff"
              fgColor="#0d2c6e"
              level="H"
              includeMargin={false}
              imageSettings={{ src: '/logo.svg', height: 15, width: 15, excavate: true }}
            />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[12px] font-semibold">Scan to verify</p>
            <p className="mt-1 text-[9.5px] text-blue-200/70">bettergov.ph/verify/</p>
            <p
              className="card-mono truncate text-[10.5px] text-blue-100/90"
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontVariantNumeric: 'tabular-nums' }}
            >
              {user.memberId || 'pending'}
            </p>
          </div>
          {/* Holographic foil seal — colour shifts with tilt, never animates on its own */}
          <motion.div
            aria-hidden
            className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55),0_1px_2px_rgba(0,0,0,0.35)]"
            style={{ backgroundImage: reduceMotion ? 'conic-gradient(#e2e8f0, #c7d2fe, #fde68a, #a5f3fc, #e2e8f0)' : holo }}
          >
            <span
              className="absolute inset-0 rounded-full"
              style={{ backgroundImage: 'repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.35) 0 0.6px, transparent 0.6px 2.4px)' }}
            />
            <span className="absolute inset-[3px] rounded-full shadow-[inset_0_0_0_1px_rgba(13,44,110,0.25)]" />
            <BrandMark className="absolute inset-[7px] fill-[#0d2c6e] opacity-75" />
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};
