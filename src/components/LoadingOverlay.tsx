import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion, type Target, type Transition } from 'framer-motion';
import { Shield } from 'lucide-react';

export const LoadingOverlay = () => {
  const [logoFailed, setLogoFailed] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const t = setTimeout(() => setLogoFailed(true), 800);
    return () => clearTimeout(t);
  }, []);

  const dotAnim: Target | undefined = reduce
    ? { opacity: 0.55 }
    : undefined;
  const dotKeyframes = reduce
    ? undefined
    : { opacity: [0.28, 1, 0.28], y: [0, -5, 0] };
  const dotTransition: Transition | undefined = reduce
    ? undefined
    : { duration: 1.05, ease: [0.23, 1, 0.32, 1] as [number, number, number, number], repeat: Infinity };

  return (
    <div className="fixed inset-0 bg-slate-50 z-[9999] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
        className="flex flex-col items-center"
      >
        {logoFailed ? (
          <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 flex items-center justify-center mb-7 sm:mb-8">
            <Shield className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-blue-900" strokeWidth={1.5} />
          </div>
        ) : (
          <img
            src="/favicon.svg"
            alt="BetterGovPH"
            loading="eager"
            decoding="async"
            className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 object-contain mb-7 sm:mb-8 drop-shadow-[0_6px_18px_rgba(30,58,138,0.12)]"
            onError={(e) => {
              const el = e.currentTarget;
              if (el.src.includes('/favicon.svg')) {
                el.onerror = null;
                el.src = 'https://assets.bettergov.ph/logos/webp/icon-primary.webp';
              } else {
                setLogoFailed(true);
              }
            }}
          />
        )}

        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              animate={reduce ? dotAnim : dotKeyframes}
              transition={reduce ? undefined : { ...dotTransition, delay: i * 0.14 }}
              className="block w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-blue-900"
              style={{ willChange: reduce ? 'opacity' : 'opacity, transform' }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
};

