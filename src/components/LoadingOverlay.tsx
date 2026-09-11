import React from 'react';
import { motion } from 'framer-motion';

export const LoadingOverlay = () => {
  return (
    <div className="fixed inset-0 bg-slate-50 z-[9999] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
        className="flex flex-col items-center"
      >
        <img
          src="https://assets.bettergov.ph/logos/webp/icon-primary.webp"
          alt="BetterGovPH"
          className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 object-contain mb-6 sm:mb-7 drop-shadow-[0_6px_18px_rgba(30,58,138,0.12)]"
        />

        <div className="w-56 sm:w-64 h-[2px] rounded-full bg-slate-200 overflow-hidden mb-3 sm:mb-4">
          <motion.div
            className="h-full w-full bg-blue-900 rounded-full origin-left"
            initial={{ scaleX: 0.1 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 2.4, ease: [0.77, 0, 0.175, 1], repeat: Infinity }}
          />
        </div>

        <p className="text-[11px] sm:text-xs font-semibold text-slate-500 uppercase tracking-[0.18em]">
          Loading
        </p>
      </motion.div>
    </div>
  );
};
