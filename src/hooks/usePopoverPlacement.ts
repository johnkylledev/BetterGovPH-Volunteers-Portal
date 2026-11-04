import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

const GAP = 8;
const EDGE = 12;
const MIN = 200;

/**
 * Opens a dropdown below its trigger when there's room, otherwise above, and caps its height to the
 * space actually available so it never runs off the bottom of the screen.
 */
export function usePopoverPlacement(anchorRef: RefObject<HTMLElement>, open: boolean, preferred = 360) {
  const [state, setState] = useState<{ side: 'down' | 'up'; maxHeight: number }>({ side: 'down', maxHeight: preferred });

  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - GAP - EDGE;
      const above = r.top - GAP - EDGE - 56; // keep clear of the sticky header
      const side = below >= Math.min(preferred, 280) || below >= above ? 'down' : 'up';
      const room = side === 'down' ? below : above;
      setState({ side, maxHeight: Math.max(MIN, Math.min(preferred, Math.floor(room))) });
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [anchorRef, open, preferred]);

  return state;
}
