import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Makes a horizontally overflowing row usable with a mouse.
 *
 * These rows (skill categories, filter chips, tab strips) hide their scrollbar, which is fine on a
 * phone where you swipe, but on a desktop there is nothing to grab and the chips past the edge are
 * unreachable. This adds: drag to scroll, a vertical wheel scrolling it sideways, and `atStart` /
 * `atEnd` so the caller can fade the edges to show there is more.
 *
 * A drag only starts after a few pixels of movement, so clicking a chip still works.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [dragging, setDragging] = useState(false);
  const [edges, setEdges] = useState({ atStart: true, atEnd: true });
  const start = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEdges({ atStart: el.scrollLeft <= 1, atEnd: max <= 1 || el.scrollLeft >= max - 1 });
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      el.removeEventListener('scroll', measure);
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  // A plain wheel over the row scrolls it sideways, the way a trackpad swipe already does.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaX !== 0 || e.shiftKey) return; // already horizontal
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 1) return;
      const next = el.scrollLeft + e.deltaY;
      // Only take the gesture while there is somewhere to go, so the page still scrolls at the ends.
      if ((e.deltaY < 0 && el.scrollLeft > 0) || (e.deltaY > 0 && el.scrollLeft < max)) {
        e.preventDefault();
        el.scrollLeft = Math.max(0, Math.min(max, next));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<T>) => {
    if (e.pointerType === 'touch') return; // native swipe is better
    const el = ref.current;
    if (!el || el.scrollWidth - el.clientWidth <= 1) return;
    start.current = { x: e.clientX, left: el.scrollLeft, moved: false };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<T>) => {
    const el = ref.current;
    const s = start.current;
    if (!el || !s) return;
    const dx = e.clientX - s.x;
    if (!s.moved && Math.abs(dx) < 4) return; // let small movements still be a click
    if (!s.moved) {
      s.moved = true;
      setDragging(true);
      el.setPointerCapture?.(e.pointerId);
    }
    el.scrollLeft = s.left - dx;
  }, []);

  const end = useCallback((e: React.PointerEvent<T>) => {
    const el = ref.current;
    if (start.current?.moved) {
      // Swallow the click that would otherwise fire on the chip we dragged over.
      const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      el?.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(() => el?.removeEventListener('click', swallow, { capture: true }), 0);
    }
    el?.releasePointerCapture?.(e.pointerId);
    start.current = null;
    setDragging(false);
  }, []);

  return {
    ref,
    /** Spread onto the scrolling element. */
    dragProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: end,
      onPointerCancel: end,
      onPointerLeave: end,
    },
    dragging,
    ...edges,
  };
}
