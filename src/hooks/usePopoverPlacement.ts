import { useCallback, useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

const GAP = 8;
const EDGE = 12;
const MIN = 200;

export interface PopoverPlacement {
  side: 'down' | 'up';
  maxHeight: number;
  /** The trigger's position on screen, for a menu drawn over the page (fixed, in a portal). */
  anchor: { top: number; bottom: number; left: number; right: number; width: number };
}

/**
 * Opens a dropdown below its trigger when there's room, otherwise above, and caps its height to the
 * space actually available so it never runs off the bottom of the screen. `anchor` is the trigger's
 * viewport rect: menus render in a portal with fixed positioning, so a card with `overflow-hidden`
 * or a blurred header can never clip them.
 */
export function usePopoverPlacement(anchorRef: RefObject<HTMLElement>, open: boolean, preferred = 360): PopoverPlacement {
  const [state, setState] = useState<PopoverPlacement>({
    side: 'down', maxHeight: preferred, anchor: { top: 0, bottom: 0, left: 0, right: 0, width: 0 },
  });

  const measure = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE - 56; // keep clear of the sticky header
    const side = below >= Math.min(preferred, 280) || below >= above ? 'down' : 'up';
    const room = side === 'down' ? below : above;
    setState({
      side,
      maxHeight: Math.max(MIN, Math.min(preferred, Math.floor(room))),
      anchor: { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width },
    });
  }, [anchorRef, preferred]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, measure]);

  return state;
}
