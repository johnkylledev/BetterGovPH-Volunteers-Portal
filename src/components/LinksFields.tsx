import React, { useState } from 'react';
import clsx from 'clsx';
import { Globe, Lock, Plus } from 'lucide-react';
import { LINK_PLATFORMS, LINKS_BY_TRACK, ALL_LINK_KEYS, normalizeLink, type LinkKey, type ProfileLinks } from '../constants/socialLinks';
import type { TrackId } from '../constants/tracks';

/** What the links section asks for, by kind of work. */
export const LINKS_INTRO: Record<TrackId, string> = {
  create: 'Where people can watch and read your work. Add the channels you post on.',
  build: 'Where people can see your code and past work.',
  teach: 'Where your talks, lessons or trainings live.',
  policy: 'Where your research, writing or professional profile lives.',
  organize: 'The pages and accounts you run campaigns and events from.',
};

/** Validates every link; returns cleaned https URLs, or per-field errors. */
export const validateLinks = (links: ProfileLinks): { clean: ProfileLinks; errors: Partial<Record<LinkKey, string>> } => {
  const clean: ProfileLinks = {};
  const errors: Partial<Record<LinkKey, string>> = {};
  ALL_LINK_KEYS.forEach((k) => {
    const r = normalizeLink(k, links[k] || '');
    if ('error' in r) errors[k] = r.error;
    else if (r.url) clean[k] = r.url;
  });
  return { clean, errors };
};

interface LinksFieldsProps {
  trackId: TrackId;
  links: ProfileLinks;
  onChange: (links: ProfileLinks) => void;
  errors?: Partial<Record<LinkKey, string>>;
  onClearError?: (key: LinkKey) => void;
  /** Show every platform, e.g. after a validation error in a collapsed one. */
  expanded?: boolean;
  idPrefix?: string;
}

/**
 * Link fields for a volunteer's channels. The platforms shown first depend on the kind of work they
 * do (a vlogger sees YouTube and TikTok, a developer sees GitHub); the rest sit behind "More links".
 */
export const LinksFields: React.FC<LinksFieldsProps> = ({
  trackId, links, onChange, errors = {}, onClearError, expanded, idPrefix = 'link',
}) => {
  const [showAll, setShowAll] = useState(false);
  const featured = LINKS_BY_TRACK[trackId];
  const others = ALL_LINK_KEYS.filter((k) => !featured.includes(k));
  const open = showAll || expanded;
  const shown: LinkKey[] = open ? [...featured, ...others] : [...featured, ...others.filter((k) => links[k] || errors[k])];
  const hiddenCount = ALL_LINK_KEYS.length - shown.length;

  return (
    <div>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
        {shown.map((k) => {
          const p = LINK_PLATFORMS[k];
          const err = errors[k];
          const id = `${idPrefix}-${k}`;
          const filled = !!(links[k] || '').trim();
          return (
            <li key={k} className="min-w-0">
              <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-slate-900">{p.label}</label>
              <div className="relative">
                {/* Logo sits inside the field, so label, logo and text line up */}
                <span
                  aria-hidden
                  className={clsx(
                    'pointer-events-none absolute left-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center transition-[filter,opacity] duration-150',
                    !filled && 'opacity-60 grayscale'
                  )}
                >
                  {p.icon ? (
                    <img src={p.icon} alt="" width={18} height={18} className="h-[18px] w-[18px] object-contain" />
                  ) : (
                    <Globe size={18} strokeWidth={1.75} className="text-[var(--accent)]" />
                  )}
                </span>
                <input
                    id={id}
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    value={links[k] || ''}
                    placeholder={p.placeholder}
                    aria-invalid={!!err || undefined}
                    aria-describedby={err ? `${id}-error` : undefined}
                    onChange={(e) => {
                      onChange({ ...links, [k]: e.target.value });
                      if (err) onClearError?.(k);
                    }}
                    onBlur={(e) => {
                      // Tidy "youtube.com/@me" or "@me" into a full link as soon as they leave the field.
                      const r = normalizeLink(k, e.target.value);
                      if ('url' in r && r.url && r.url !== e.target.value) onChange({ ...links, [k]: r.url });
                    }}
                    className={clsx('s-field h-11 pl-10 text-[14px]', err && 'shadow-[0_0_0_1.5px_rgb(220_38_38/0.6)]')}
                  />
              </div>
              {err && <p id={`${id}-error`} className="mt-1 text-[12px] text-red-700">{err}</p>}
            </li>
          );
        })}
      </ul>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-4 inline-flex min-h-[36px] items-center gap-1.5 text-[14px] font-medium text-[var(--accent)]"
        >
          <Plus size={15} strokeWidth={2} />
          More links <span className="num font-normal text-slate-400">{hiddenCount}</span>
        </button>
      )}
      <p className="mt-4 flex items-start gap-2 rounded-[10px] bg-slate-50 px-3.5 py-2.5 text-[12.5px] leading-snug text-slate-500 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.05)]">
        <Lock size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
        Optional. Only you and BetterGovPH admins see these. They’re never shown on your public card or the Volunteers page.
      </p>
    </div>
  );
};
