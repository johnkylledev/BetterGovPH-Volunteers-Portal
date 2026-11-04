import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { Plus, Search as SearchIcon, X as XIcon } from 'lucide-react';
import { SiteLayout, PageIntro } from '../../components/site/SiteLayout';
import { CallMeta } from '../../components/CallFields';
import { CallContact, InterestButton } from '../../components/CallInterest';
import { ReportButton } from '../../components/ReportButton';
import { parseRoles } from '../../components/RolesNeededPicker';
import { getOpenCalls } from '../../services/supabase';
import { useStore } from '../../store/useStore';
import type { VolunteerCall } from '../../types';
import { formatExternalUrl } from '../../utils/skillUtils';
import { setReturnTo } from '../../utils/returnTo';

type Kind = 'all' | 'people' | 'things' | 'first';
const KINDS: [Kind, string][] = [['all', 'Everything'], ['people', 'Volunteers'], ['things', 'Venues & resources'], ['first', 'Good first tasks']];

/** Public board of open calls (MVP): anyone can browse; "I'm interested" asks visitors to sign in and brings them back. */
export default function Opportunities() {
  const sessionUserId = useStore((s) => s.sessionUserId);
  const currentUser = useStore((s) => s.currentUser);
  const [params, setParams] = useSearchParams();
  const focusId = params.get('call');
  const [calls, setCalls] = useState<VolunteerCall[] | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [kind, setKind] = useState<Kind>('all');
  const [query, setQuery] = useState('');
  const focusRef = useRef<HTMLLIElement | null>(null);

  const load = useCallback(async () => {
    try {
      const { calls: list } = await getOpenCalls();
      setCalls(list.filter((c) => c.status !== 'closed'));
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  // Reload when someone signs in, so contact details and their own interest show up.
  useEffect(() => { load(); }, [load, sessionUserId]);

  // Coming back from sign-in: bring the call they clicked into view.
  useEffect(() => {
    if (state === 'ready' && focusId && focusRef.current) {
      focusRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [state, focusId]);

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => (calls ?? []).filter((c) => {
    const k = c.callType ?? 'people';
    if (kind === 'people' && k !== 'people') return false;
    if (kind === 'things' && k === 'people') return false;
    if (kind === 'first' && !c.goodFirst) return false;
    if (!q) return true;
    return [c.title, c.description, c.rolesNeeded, c.location, c.postedBy?.fullName].some((v) => (v || '').toLowerCase().includes(q));
  }).sort((a, b) => Number(b.id === focusId) - Number(a.id === focusId) || Number(!!b.goodFirst) - Number(!!a.goodFirst)), [calls, kind, q, focusId]);

  const signedIn = !!sessionUserId;
  const myId = currentUser?.uid || currentUser?.id;

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-14 sm:px-6 sm:pt-20">
        <PageIntro
          title="Find something to help with."
          lede="Open calls from BetterGovPH projects: roles that need people, and venues, equipment or support a project is looking for. Browse freely; say you’re interested and the team gets in touch."
          actions={
            signedIn ? (
              <Link to="/dashboard" state={{ tab: 'volunteer' }} className="s-btn s-btn-plain">
                <Plus size={16} strokeWidth={1.75} />
                Post a call
              </Link>
            ) : (
              <Link to="/login" onClick={() => setReturnTo('/opportunities')} className="s-btn s-btn-plain">
                <Plus size={16} strokeWidth={1.75} />
                Post a call
              </Link>
            )
          }
        />

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-sm">
            <span className="sr-only">Search calls</span>
            <SearchIcon size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by role, skill, place…"
              className="s-field pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
            />
            {q && (
              <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <XIcon size={14} strokeWidth={1.75} />
              </button>
            )}
          </label>
          {state === 'ready' && <p className="num text-[13px] text-[var(--fg-3)]" aria-live="polite">{shown.length} open {shown.length === 1 ? 'call' : 'calls'}</p>}
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5" role="group" aria-label="Show">
          {KINDS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}
              className={clsx('min-h-[34px] rounded-full px-3.5 text-[13px] transition-[background-color,box-shadow,color] duration-150',
                kind === k ? 'bg-slate-900 font-medium text-white' : 'bg-white text-slate-600 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.12)] hover:text-slate-900')}>
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {state === 'loading' ? (
            <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="s-card p-5">
                  <div className="h-4 w-2/3 rounded bg-slate-100" />
                  <div className="mt-2 h-3 w-1/3 rounded bg-slate-100" />
                  <div className="mt-5 h-3 w-full rounded bg-slate-100" />
                  <div className="mt-2 h-3 w-4/5 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : state === 'error' ? (
            <div className="s-card px-6 py-10 text-center">
              <h2 className="text-[16px] font-semibold">Couldn’t load the calls</h2>
              <p className="mt-1.5 text-[14px] text-[var(--fg-3)]">Check your connection and try again.</p>
              <button type="button" onClick={() => { setState('loading'); load(); }} className="s-btn s-btn-plain mt-5">Try again</button>
            </div>
          ) : shown.length === 0 ? (
            <div className="s-card px-6 py-12 text-center">
              <h2 className="text-[16px] font-semibold">{q || kind !== 'all' ? 'Nothing matches yet' : 'No open calls right now'}</h2>
              <p className="mx-auto mt-1.5 max-w-sm text-[14px] text-[var(--fg-3)]">
                Browse the <Link to="/projects" className="s-link">projects</Link> and ask to join a team, or check back soon.
              </p>
            </div>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {shown.map((c) => {
                const focused = c.id === focusId;
                const roles = (c.callType ?? 'people') === 'people' ? parseRoles(c.rolesNeeded || '') : [];
                return (
                  <li
                    key={c.id}
                    ref={focused ? focusRef : undefined}
                    className={clsx('s-card flex flex-col p-5 transition-[box-shadow] duration-300', focused && 'shadow-[0_0_0_2px_var(--accent),var(--e2)]')}
                  >
                    <h2 className="break-words text-[16px] font-semibold tracking-[-0.012em]">{c.title}</h2>
                    <p className="mt-0.5 text-[13px] text-[var(--fg-3)]">
                      {c.postedBy?.fullName ? <>Posted by {c.postedBy.fullName}</> : 'Posted by a member'}
                      {c.createdAt && <> · <time dateTime={c.createdAt}>{new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></>}
                    </p>
                    <CallMeta call={c} />
                    {c.description && <p className="mt-3 flex-1 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[var(--fg-2)] line-clamp-6">{c.description}</p>}
                    {roles.length > 0 && (
                      <p className="mt-3 flex flex-wrap gap-1">
                        {roles.map((r) => {
                          const mine = !!currentUser && [currentUser.specialization, currentUser.secondarySpecialization].some((x) => x && x.toLowerCase() === r.toLowerCase());
                          return <span key={r} className={clsx('rounded-full px-2 py-0.5 text-[12px]', mine ? 'bg-[#eef3ff] font-medium text-[var(--accent)]' : 'bg-slate-100 text-slate-700')}>{r}</span>;
                        })}
                      </p>
                    )}
                    {c.projectUrl && (
                      <a href={formatExternalUrl(c.projectUrl)} target="_blank" rel="noreferrer" className="mt-3 block truncate text-[13px] text-[var(--accent)] hover:underline">
                        {c.projectUrl}
                      </a>
                    )}
                    <div className="mt-4 space-y-3 border-t border-[var(--line)] pt-4">
                      <InterestButton
                        call={c}
                        signedIn={signedIn}
                        isOwner={!!myId && c.userId === myId}
                        returnPath={`/opportunities?call=${encodeURIComponent(c.id)}`}
                        onChanged={(status) => setCalls((list) => list?.map((x) => (x.id === c.id ? { ...x, myInterest: status } : x)) ?? null)}
                      />
                      {signedIn ? (
                        <>
                          <CallContact call={c} />
                          {!(myId && c.userId === myId) && <ReportButton targetType="call" targetId={c.id} />}
                        </>
                      ) : c.contactHidden ? (
                        <p className="text-[12.5px] text-[var(--fg-3)]">Sign in to see how to reach the team.</p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {focusId && params.get('call') && (
          <p className="mt-6 text-center">
            <button type="button" className="text-[13px] text-[var(--fg-3)] hover:text-[var(--fg)]" onClick={() => setParams({}, { replace: true })}>Clear highlight</button>
          </p>
        )}
      </div>
    </SiteLayout>
  );
}
