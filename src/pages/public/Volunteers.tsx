import React, { useEffect, useMemo, useState } from 'react';
import { Avatar } from '../../components/Avatar';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, ArrowUpRight, BadgeCheck, Search as SearchIcon, X as XIcon } from 'lucide-react';
import { SiteLayout, PageIntro } from '../../components/site/SiteLayout';
import { SkillIcon } from '../../components/SkillIcon';

interface Volunteer {
  name: string;
  role: string | null;
  secondaryRole?: string | null;
  memberId: string;
  yearJoined: number | null;
  isAdmin: boolean;
  skills: string[];
  skillCount: number;
  avatarUrl: string | null;
}

const CACHE_KEY = 'bgph:volunteers:v2'; // v2: names are redacted server-side
const CACHE_TTL_MS = 5 * 60 * 1000;

const readCache = (): Volunteer[] | null => {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, data } = JSON.parse(raw) as { at: number; data: Volunteer[] };
    return Date.now() - at < CACHE_TTL_MS ? data : null;
  } catch {
    return null;
  }
};

const VolunteerCard: React.FC<{ v: Volunteer }> = ({ v }) => {
  const more = Math.max(0, v.skillCount - Math.min(v.skills.length, 3));
  return (
    <li className="flex flex-col rounded-[16px] bg-[var(--card)] p-5 shadow-[var(--e2)] transition-[box-shadow,transform] duration-200 [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-[0_1px_2px_rgb(15_23_42/0.05),0_12px_28px_-8px_rgb(15_23_42/0.16),0_0_0_1px_rgb(15_23_42/0.08)]">
      <div className="flex items-center gap-3.5">
        <Avatar name={v.name} seed={v.memberId || v.name} photos={[v.avatarUrl]} size={48} />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[15px] font-semibold text-[var(--fg)]">
            <span className="truncate">{v.name}</span>
            <BadgeCheck size={15} strokeWidth={2} className="shrink-0 text-[var(--accent)]" aria-label="Verified member" />
          </p>
          <p className="truncate text-[13px] text-[var(--fg-3)]">
            {v.role || 'Volunteer'}
            {v.secondaryRole ? <> · {v.secondaryRole}</> : null}
            {v.yearJoined ? <span className="num"> · since {v.yearJoined}</span> : null}
          </p>
        </div>
      </div>

      {v.skills.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Skills">
          {v.skills.slice(0, 3).map((s) => (
            <li key={s} className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--bg)] pl-2 pr-2.5 text-[12.5px] text-[var(--fg-2)] shadow-[inset_0_0_0_1px_rgb(15_23_42/0.08)]">
              <SkillIcon skillName={s} size={13} />
              {s}
            </li>
          ))}
          {more > 0 && (
            <li className="inline-flex h-7 items-center rounded-full px-2 text-[12.5px] text-[var(--fg-3)]">+{more}</li>
          )}
        </ul>
      )}

      <div className="flex-1" />
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-3.5">
        <span className="num truncate font-mono text-[12px] text-[var(--fg-3)]">{v.memberId}</span>
        <Link
          to={`/verify/${encodeURIComponent(v.memberId)}`}
          className="group inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-[var(--accent)]"
          aria-label={`View ${v.name}'s Volunteer Card`}
        >
          View card
          <ArrowUpRight size={14} strokeWidth={1.75} className="transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-px" />
        </Link>
      </div>
    </li>
  );
};

export default function Volunteers() {
  const [volunteers, setVolunteers] = useState<Volunteer[] | null>(() => readCache());
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(() => (readCache() ? 'ready' : 'loading'));
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<string>('All');

  useEffect(() => {
    if (volunteers) return;
    const ctrl = new AbortController();
    fetch('/api/v1/volunteers', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: { volunteers: Volunteer[] }) => {
        const list = Array.isArray(json?.volunteers) ? json.volunteers : [];
        setVolunteers(list);
        setStatus('ready');
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: list }));
        } catch {
          /* storage unavailable */
        }
      })
      .catch((err) => {
        if ((err as Error)?.name !== 'AbortError') setStatus('error');
      });
    return () => ctrl.abort();
  }, [volunteers]);

  // Role chips come from the roles people actually have, most common first.
  const roles = useMemo(() => {
    const counts = new Map<string, number>();
    (volunteers ?? []).forEach((v) => v.role && counts.set(v.role, (counts.get(v.role) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => ({ role: r, n }));
  }, [volunteers]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (volunteers ?? []).filter((v) => {
      if (role !== 'All' && v.role !== role && v.secondaryRole !== role) return false;
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        (v.role ?? '').toLowerCase().includes(q) ||
        (v.secondaryRole ?? '').toLowerCase().includes(q) ||
        v.skills.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [volunteers, query, role]);

  const total = volunteers?.length ?? 0;

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-14 pb-20 sm:pt-20">
        <PageIntro
          title="The people building BetterGovPH."
          lede={
            status === 'ready' && total > 0 ? (
              <>
                <span className="num font-semibold text-[var(--fg)]">{total.toLocaleString()}</span> verified{' '}
                {total === 1 ? 'volunteer' : 'volunteers'}: developers, designers, writers, educators, lawyers and advocates.
                Every card here can be checked.
              </>
            ) : (
              'Verified volunteers: developers, designers, writers, educators, lawyers and advocates. Every card here can be checked.'
            )
          }
          actions={
            <Link to="/register" className="s-btn s-btn-accent">
              Join them
              <ArrowRight size={16} strokeWidth={1.75} />
            </Link>
          }
        />

        {/* Search + role filter */}
        <div className="mt-10 space-y-3">
          <div className="relative max-w-md">
            <label htmlFor="volunteer-search" className="sr-only">Search volunteers</label>
            <SearchIcon size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--fg-3)]" />
            <input
              id="volunteer-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, role or skill"
              className="s-field h-11 pl-10 pr-10 text-[15px]"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--fg-3)] hover:bg-[var(--muted)]"
              >
                <XIcon size={14} strokeWidth={2} />
              </button>
            )}
          </div>

          {roles.length > 1 && (
            <div className="no-scrollbar -mx-4 -mt-1 overflow-x-auto px-4 pb-1 pt-1" role="group" aria-label="Filter by role">
              <div className="flex w-max gap-1.5">
                {[{ role: 'All', n: total }, ...roles].map((r) => {
                  const active = role === r.role;
                  return (
                    <button
                      key={r.role}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setRole(r.role)}
                      className={clsx(
                        'inline-flex min-h-[36px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] transition-[background-color,color,box-shadow] duration-150',
                        active
                          ? 'bg-[var(--fg)] font-medium text-white'
                          : 'bg-[var(--card)] text-[var(--fg-2)] shadow-[inset_0_0_0_1px_rgb(15_23_42/0.1)] hover:text-[var(--fg)]'
                      )}
                    >
                      {r.role}
                      <span className={clsx('num text-[12px]', active ? 'text-white/60' : 'text-[var(--fg-3)]')}>{r.n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="mt-8">
          {status === 'loading' ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading volunteers">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="h-[168px] rounded-[16px] bg-[var(--card)] shadow-[var(--e1)]">
                  <div className="flex items-center gap-3.5 p-5">
                    <span className="h-12 w-12 rounded-full bg-[var(--muted)]" />
                    <span className="flex-1 space-y-2">
                      <span className="block h-3.5 w-2/3 rounded bg-[var(--muted)]" />
                      <span className="block h-3 w-1/3 rounded bg-[var(--muted)]" />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : status === 'error' ? (
            <div className="rounded-[16px] bg-[var(--card)] px-6 py-12 text-center shadow-[var(--e1)]">
              <p className="text-[15px] font-medium text-[var(--fg)]">Couldn’t load the directory.</p>
              <p className="mt-1 text-[14px] text-[var(--fg-3)]">Check your connection and try again.</p>
              <button
                type="button"
                onClick={() => { setStatus('loading'); setVolunteers(null); }}
                className="s-btn s-btn-plain mt-5"
              >
                Try again
              </button>
            </div>
          ) : shown.length === 0 ? (
            <div className="rounded-[16px] bg-[var(--card)] px-6 py-12 text-center shadow-[var(--e1)]">
              <p className="text-[15px] font-medium text-[var(--fg)]">
                {total === 0 ? 'No verified volunteers yet.' : 'No one matches that.'}
              </p>
              <p className="mt-1 text-[14px] text-[var(--fg-3)]">
                {total === 0 ? 'Be the first. Apply and get your Volunteer Card.' : 'Try another name, role or skill.'}
              </p>
              {total > 0 && (
                <button type="button" onClick={() => { setQuery(''); setRole('All'); }} className="s-btn s-btn-plain mt-5">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              {(query || role !== 'All') && (
                <p className="mb-4 text-[13px] text-[var(--fg-3)]" role="status">
                  Showing <span className="num">{shown.length}</span> of <span className="num">{total}</span>
                </p>
              )}
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((v) => <VolunteerCard key={v.memberId} v={v} />)}
              </ul>
            </>
          )}
        </div>
      </div>
    </SiteLayout>
  );
}
