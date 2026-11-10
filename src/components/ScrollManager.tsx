import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Puts the page where it should be after every navigation.
 *
 * A single-page app keeps whatever scroll position it had, so opening a project from halfway down
 * a long list used to drop you halfway down the project. What happens now depends on how you got
 * there, the way a browser behaves:
 *
 *  - a new page (a link, a tab, a redirect) starts at the top;
 *  - back and forward return you to where you were on that page, so a long directory does not lose
 *    your place;
 *  - a link with a #hash goes to that section instead;
 *  - changing only the query string — a filter, an open call — leaves the page exactly where it is,
 *    because jumping while someone is narrowing a list is maddening.
 *
 * Jumps are instant: an animated scroll on a route change just delays the page you asked for.
 */
const positions = new Map<string, number>();

export const ScrollManager = () => {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  const frames = useRef<number[]>([]);

  // Ours to manage, so the browser must not also try to restore a position.
  useEffect(() => {
    if (typeof history === 'undefined' || !('scrollRestoration' in history)) return;
    const previous = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    return () => { history.scrollRestoration = previous; };
  }, []);

  // Keep a running note of where this page is, so going back can return to it.
  useEffect(() => {
    const remember = () => positions.set(pathname, window.scrollY);
    window.addEventListener('scroll', remember, { passive: true });
    return () => {
      remember(); // one last reading before the page changes
      window.removeEventListener('scroll', remember);
    };
  }, [pathname]);

  useEffect(() => {
    // Every page here is lazy-loaded and most then fetch, so at the moment of navigation the new
    // page is usually an empty shell: too short to scroll, and with no anchor to find. So each of
    // these keeps trying until it takes or the budget runs out, rather than once on arrival.
    const cancel = () => { frames.current.forEach(cancelAnimationFrame); frames.current = []; };
    const attempt = (act: () => boolean, budgetMs = 1200) => {
      cancel();
      const until = performance.now() + budgetMs;
      const run = () => {
        if (act() || performance.now() > until) return;
        frames.current.push(requestAnimationFrame(run));
      };
      run();
    };

    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      attempt(() => {
        const el = document.getElementById(id);
        if (!el) return false;
        el.scrollIntoView({ block: 'start' });
        return true;
      });
      return cancel;
    }

    if (navigationType === 'POP') {
      const target = positions.get(pathname) ?? 0;
      if (target <= 0) { window.scrollTo(0, 0); return cancel; }
      attempt(() => {
        if (document.documentElement.scrollHeight < target + window.innerHeight) return false;
        window.scrollTo(0, target);
        return true;
      });
      return cancel;
    }

    // Top, and stay there: content arriving late (a lazy chunk, images, a fetch) can otherwise
    // shift the page under us after the first jump. Give up as soon as a reader scrolls themselves.
    let settled = window.scrollY;
    window.scrollTo(0, 0);
    attempt(() => {
      if (window.scrollY > settled) return true; // they have started reading; leave them alone
      if (window.scrollY === 0) { settled = 0; return false; }
      window.scrollTo(0, 0);
      settled = 0;
      return false;
    }, 600);
    return cancel;
  }, [pathname, hash, navigationType]);

  return null;
};
