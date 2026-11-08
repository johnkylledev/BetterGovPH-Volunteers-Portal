import { useEffect, useRef, useState } from 'react';

/**
 * Counts a number up to its value once, when it first appears or changes.
 *
 * Deliberately a one-shot: it settles on the real number and stops. Nothing loops.
 * With reduced motion, or for a change too small to be worth animating, the number
 * simply appears.
 */
const easeOut = (t: number) => 1 - (1 - t) ** 3;

export function useCountUp(value: number, duration = 600) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef(0);

  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0;
    const start = from.current;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Not worth animating a step of one, or a change nobody asked to watch.
    if (reduce || Math.abs(target - start) < 2) {
      from.current = target;
      setShown(target);
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setShown(Math.round(start + (target - start) * easeOut(p)));
      if (p < 1) frame.current = requestAnimationFrame(tick);
      else from.current = target;
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration]);

  return shown;
}
