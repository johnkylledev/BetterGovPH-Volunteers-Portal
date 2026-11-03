import { motion } from 'framer-motion';

/** Full-screen wait state. Fades in after a short delay so fast loads never flash it; nothing loops. */
export const LoadingOverlay = () => (
  <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#f7f8fa]" role="status" aria-live="polite">
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.25 }}
      className="flex flex-col items-center gap-4"
    >
      <img
        src="/favicon.svg"
        alt=""
        loading="eager"
        decoding="async"
        className="h-12 w-12 object-contain"
        onError={(e) => {
          const el = e.currentTarget;
          if (el.src.includes('/favicon.svg')) {
            el.onerror = null;
            el.src = 'https://assets.bettergov.ph/logos/webp/icon-primary.webp';
          }
        }}
      />
      <p className="text-[14px] text-slate-500">Loading…</p>
    </motion.div>
  </div>
);
