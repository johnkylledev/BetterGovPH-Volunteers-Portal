import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { initialsOf } from '../Avatar';

/**
 * The mark of a website, on a lit plate.
 *
 * Unlike a person's avatar, a site's logo is artwork: it is contained, never cropped to a circle.
 * Sources are tried in order and nothing is stored on our side — every url points at the site's own
 * logo or icon, so a portal that changes its mark changes here too. When none of them load, the
 * plate keeps the site's initials rather than going blank.
 */
export const SiteMark: React.FC<{
  /** Used for the initials and the alt text. */
  name: string;
  /** Icon urls, best first; nulls are skipped. */
  sources?: (string | null | undefined)[];
  size?: number;
  className?: string;
}> = ({ name, sources = [], size = 44, className }) => {
  const list = useMemo(() => sources.filter((s): s is string => !!s), [sources]);
  const [failed, setFailed] = useState(0);
  const src = list[failed];
  const initials = initialsOf(name).slice(0, 2);

  return (
    <span
      className={clsx('s-mark', className)}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}
      aria-hidden
    >
      {src ? (
        <img
          // Remounting on each failure restarts the load with the next source in the list.
          key={src}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed((n) => n + 1)}
        />
      ) : (
        <span
          className="font-semibold text-[var(--fg-3)]"
          style={{ fontSize: Math.max(11, Math.round(size * 0.3)) }}
        >
          {initials}
        </span>
      )}
    </span>
  );
};

/** Live icon for any site, resolved from its domain. Our last resort before initials. */
export const iconForDomain = (domain: string): string | null =>
  domain ? `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico` : null;
