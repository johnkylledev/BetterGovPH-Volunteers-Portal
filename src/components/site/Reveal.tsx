import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

const EASE = [0.23, 1, 0.32, 1] as const;

/** Fades content in once as it scrolls into view. Marketing pages only. */
export const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({
  children,
  delay = 0,
  className,
}) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      transition={{ duration: reduce ? 0.2 : 0.5, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
};
