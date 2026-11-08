import React, { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { User as UserIcon } from 'lucide-react';
import { supabase } from '../services/supabase';

/*
 * One avatar for the whole app, with a fallback chain so nobody ever sees a broken image:
 *   1. The sign-in provider's picture (Google or GitHub), passed in as `photos`
 *   2. Initials on a colour picked from a stable id, so the same person keeps the same colour
 *   3. A person icon when there's no usable name
 * Discord pictures are deliberately not used: the portal shows the account people signed in with.
 * Initials sit underneath while a photo loads, so the circle is never empty. If a photo
 * fails (CDN down, avatar changed, Google 403), it quietly moves on to the next source.
 */

/** White text passes WCAG AA (≥ 4.5:1) on every one of these. */
const PALETTE = ['#1e3a8a', '#4338ca', '#0369a1', '#0f766e', '#15803d', '#b45309', '#be185d', '#7c3aed'];

/** FNV-1a: small, fast and stable across browsers (unlike Math.random or object identity). */
const hash = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** Splits by user-perceived characters, so accented letters and emoji aren't cut in half. */
const firstGrapheme = (word: string) => {
  try {
    const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (s: string) => Iterable<{ segment: string }> } }).Segmenter;
    if (Seg) {
      for (const { segment } of new Seg(undefined, { granularity: 'grapheme' }).segment(word)) return segment;
    }
  } catch { /* fall through */ }
  return Array.from(word)[0] ?? '';
};

export const initialsOf = (name?: string) => {
  const words = (name || '').trim().split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  if (!words.length) return '';
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0]];
  return picked.map((w) => firstGrapheme(w).toLocaleUpperCase()).join('');
};

/** The signed-in person's provider photo from their session; /me is the primary source. */
export const useSessionPhoto = () => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const pick = (meta?: Record<string, unknown>) => {
      const raw = meta?.avatar_url ?? meta?.picture;
      return typeof raw === 'string' && raw.startsWith('https://') ? raw : null;
    };
    supabase.auth.getSession().then(({ data }) => { if (alive) setUrl(pick(data.session?.user?.user_metadata)); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return url;
};

interface AvatarProps {
  name?: string;
  /** Stable id for the colour (uid, member id). Falls back to the name. */
  seed?: string;
  /** Photo sources, tried in order: the sign-in provider's picture. */
  photos?: (string | null | undefined)[];
  /** Diameter in px. */
  size?: number;
  className?: string;
  /** Give it a label only when no name is shown next to it; otherwise it's decorative. */
  label?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name, seed, photos = [], size = 40, className, label,
}) => {
  const sources = useMemo(
    () => photos.filter((u): u is string => !!u),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [photos.join('|')]
  );
  const key = sources.join('|');
  const [failed, setFailed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<string | null>(null);
  // New sources (they linked Discord, changed photo) get a fresh try.
  useEffect(() => { setFailed([]); setLoaded(null); }, [key]);

  const src = sources.find((s) => !failed.includes(s));
  const initials = initialsOf(name);
  const color = PALETTE[hash(seed || name || '?') % PALETTE.length];
  const fontSize = Math.max(10, Math.round(size * (initials.length > 1 ? 0.38 : 0.44)));

  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={clsx('relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold text-white', className)}
      style={{
        width: size,
        height: size,
        fontSize,
        backgroundColor: color,
        backgroundImage: 'linear-gradient(140deg, rgb(255 255 255 / 0.14), rgb(255 255 255 / 0) 60%)',
        boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.15), 0 0 0 1px rgb(15 23 42 / 0.06)',
      }}
    >
      {initials ? (
        <span className="leading-none tracking-[0.01em]">{initials}</span>
      ) : (
        <UserIcon size={Math.round(size * 0.5)} strokeWidth={1.75} />
      )}
      {src && (
        <img
          key={src}
          src={src}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          // Google photos can 403 when a referrer is sent.
          referrerPolicy="no-referrer"
          onLoad={() => setLoaded(src)}
          onError={() => setFailed((f) => [...f, src])}
          className={clsx(
            'absolute inset-0 h-full w-full object-cover transition-opacity duration-200',
            loaded === src ? 'opacity-100' : 'opacity-0'
          )}
        />
      )}
    </span>
  );
};
