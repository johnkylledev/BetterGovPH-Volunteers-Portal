import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowRight, BadgeCheck, FolderKanban, Hand, Inbox, Megaphone, ShieldAlert, Trash2, Upload, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { eraseUser, getAdminOverview } from '../../services/supabase';
import type { AdminOverview as Overview } from '../../types';
import { StatTile } from '../StatTile';
import { timeAgo } from '../RepoHealth';

type Tab = 'applications' | 'members' | 'projects' | 'calls';

interface Props {
  onGo: (tab: Tab) => void;
  onImport: () => void;
  onExportRopa: () => void;
  ropaBusy: boolean;
}

/** Admin home: what needs a decision first, then how the community is doing. */
export const AdminOverview: React.FC<Props> = ({ onGo, onImport, onExportRopa, ropaBusy }) => {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [erasing, setErasing] = useState<{ uid: string; name: string; email: string; typed: string; busy: boolean } | null>(null);

  const load = useCallback(async () => {
    try { setData(await getAdminOverview()); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t load the overview'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) {
    return (
      <div className="s-card px-6 py-10 text-center">
        <p className="text-[15px] font-semibold">Couldn’t load the overview</p>
        <p className="mt-1 text-[14px] text-slate-500">{error}</p>
        <button type="button" onClick={load} className="s-btn s-btn-plain mt-4">Try again</button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="grid gap-4 md:grid-cols-2" aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="s-card h-28" />)}
      </div>
    );
  }

  const { queue, numbers } = data;
  const queueItems: { key: string; label: string; count: number; hint: string; icon: React.ElementType; tone: string; action: () => void }[] = [
    { key: 'apps', label: 'Applications to review', count: queue.pendingApps, hint: 'Approve to issue a Volunteer Card', icon: Inbox, tone: 'amber', action: () => onGo('applications') },
    { key: 'projects', label: 'Projects to review', count: queue.pendingProjects, hint: 'Approve, or send back with a note', icon: FolderKanban, tone: 'amber', action: () => onGo('projects') },
    { key: 'reports', label: 'Open reports', count: queue.openReports, hint: 'Use the Reports button in the header', icon: ShieldAlert, tone: 'red', action: () => document.getElementById('reports-button')?.click() },
    { key: 'deletions', label: 'Deletion requests', count: queue.deletionRequests, hint: 'Members asking to have their data erased', icon: Trash2, tone: 'red', action: () => document.getElementById('deletion-requests')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) },
    { key: 'consent', label: 'Members without consent', count: queue.noConsent, hint: 'They see a prompt on their dashboard', icon: BadgeCheck, tone: 'slate', action: () => onGo('members') },
  ];
  const needsAction = queueItems.filter((q) => q.count > 0);
  const maxRole = Math.max(1, ...data.roles.map((r) => r.count));

  return (
    <div className="space-y-6">
      {/* What needs attention */}
      <section aria-labelledby="queue-title">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="queue-title" className="text-[16px] font-semibold text-slate-900">Needs attention</h2>
          <button type="button" onClick={load} className="text-[13px] text-slate-500 hover:text-slate-900">Refresh</button>
        </div>
        {needsAction.length === 0 ? (
          <div className="s-card flex items-center gap-3 px-5 py-4 text-[14px] text-slate-600">
            <BadgeCheck size={18} strokeWidth={1.75} className="text-emerald-600" />
            All caught up. Nothing is waiting for a decision.
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {needsAction.map((q) => (
              <li key={q.key}>
                <button
                  type="button"
                  onClick={q.action}
                  className={clsx(
                    'group flex w-full items-start gap-3 rounded-[14px] bg-white p-4 text-left shadow-[0_0_0_1px_rgb(15_23_42/0.08),var(--e1)] transition-[box-shadow,transform] duration-150 [@media(hover:hover)]:hover:-translate-y-px [@media(hover:hover)]:hover:shadow-[var(--e2)]'
                  )}
                >
                  <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]',
                    q.tone === 'red' ? 'bg-red-50 text-red-700' : q.tone === 'amber' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-600')}>
                    <q.icon size={19} strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="num block text-[22px] font-semibold leading-none text-slate-900">{q.count}</span>
                    <span className="mt-1 block text-[14px] font-medium text-slate-800">{q.label}</span>
                    <span className="mt-0.5 block text-[12.5px] text-slate-500">{q.hint}</span>
                  </span>
                  <ArrowRight size={16} strokeWidth={1.75} className="mt-1 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Community numbers */}
      <section aria-labelledby="numbers-title">
        <h2 id="numbers-title" className="mb-3 text-[16px] font-semibold text-slate-900">Community</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
          <StatTile label="Members" value={numbers.members} icon={Users} hint={`+${numbers.newMembers7d} this week`} />
          <StatTile label="Live projects" value={numbers.approvedProjects} icon={FolderKanban} hint={numbers.importedProjects ? `${numbers.importedProjects} imported` : 'approved'} />
          <StatTile label="Open calls" value={numbers.openCalls} icon={Megaphone} hint="volunteers & resources" />
          <StatTile label="Hands raised" value={numbers.interests7d} icon={Hand} hint="last 7 days" />
          <StatTile label="New sign-ups" value={numbers.newMembers7d} icon={UserPlus} hint="last 7 days" />
          <StatTile label="To review" value={queue.pendingApps + queue.pendingProjects} icon={Inbox} hint="apps + projects" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Roles */}
        <section className="s-card p-5 sm:p-6" aria-labelledby="roles-title">
          <h2 id="roles-title" className="text-[16px] font-semibold text-slate-900">Members by role</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">Primary role of everyone who finished sign-up. Spot the gaps to recruit for.</p>
          {data.roles.length === 0 ? (
            <p className="mt-4 text-[14px] text-slate-500">No members yet.</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {data.roles.slice(0, 10).map((r) => (
                <li key={r.role} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_2rem] items-center gap-3 text-[13px]">
                  <span className="truncate text-slate-700">{r.role}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <span className="block h-full rounded-full bg-[linear-gradient(90deg,#1e3a8a,#3b5fd0)]" style={{ width: `${(r.count / maxRole) * 100}%` }} />
                  </span>
                  <span className="num text-right text-slate-500">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Activity */}
        <section className="s-card p-5 sm:p-6" aria-labelledby="feed-title">
          <h2 id="feed-title" className="text-[16px] font-semibold text-slate-900">Recent activity</h2>
          {data.feed.length === 0 ? (
            <p className="mt-4 text-[14px] text-slate-500">Nothing yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-200/80">
              {data.feed.map((f, i) => {
                const inner = (
                  <>
                    <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', f.kind === 'member' ? 'bg-sky-500' : f.kind === 'project' ? 'bg-violet-500' : 'bg-emerald-500')} aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-slate-800">{f.text}</span>
                    {f.status && <span className="shrink-0 text-[12px] capitalize text-slate-400">{String(f.status).toLowerCase()}</span>}
                    <span className="num w-14 shrink-0 text-right text-[12px] text-slate-400">{timeAgo(f.at)}</span>
                  </>
                );
                return (
                  <li key={i}>
                    {f.link ? (
                      <Link to={f.link} className="flex items-start gap-3 py-2.5 hover:text-[var(--accent)]">{inner}</Link>
                    ) : (
                      <div className="flex items-start gap-3 py-2.5">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Deletion requests */}
      <section id="deletion-requests" className="s-card p-5 sm:p-6" aria-labelledby="del-title">
        <h2 id="del-title" className="text-[16px] font-semibold text-slate-900">
          Deletion requests <span className="num font-normal text-slate-400">{data.deletions.length}</span>
        </h2>
        <p className="mt-0.5 text-[13px] text-slate-500">
          Data Privacy Act: complete these promptly (we tell members about 15 days). Approved public projects stay listed under you; everything personal is removed.
        </p>
        {data.deletions.length === 0 ? (
          <p className="mt-4 text-[14px] text-slate-500">No pending requests.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-200/80">
            {data.deletions.map((d) => (
              <li key={d.uid} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-slate-900">{d.name || 'Member'} <span className="font-normal text-slate-500">· {d.email}</span></p>
                    <p className="text-[12.5px] text-slate-500">{d.memberId || 'No member ID'} · requested {timeAgo(d.requestedAt)}</p>
                  </div>
                  {erasing?.uid !== d.uid && (
                    <button type="button" onClick={() => setErasing({ uid: d.uid, name: d.name, email: d.email, typed: '', busy: false })} className="s-btn h-9 px-3.5 text-[13px] text-red-700 shadow-[inset_0_0_0_1px_rgb(254_202_202)] hover:bg-red-50">
                      <Trash2 size={14} strokeWidth={1.75} />
                      Erase data
                    </button>
                  )}
                </div>
                {erasing?.uid === d.uid && (
                  <form
                    className="mt-3 space-y-2 rounded-[12px] bg-red-50/70 p-3.5 shadow-[inset_0_0_0_1px_rgb(254_202_202)]"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setErasing({ ...erasing, busy: true });
                      try {
                        const r = await eraseUser(d.uid, erasing.typed);
                        toast.success(`Erased: ${r.removed.join(', ')}`);
                        setErasing(null);
                        load();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Couldn’t erase');
                        setErasing((cur) => (cur ? { ...cur, busy: false } : cur));
                      }
                    }}
                  >
                    <label htmlFor={`erase-${d.uid}`} className="block text-[13px] text-slate-800">
                      This can’t be undone. Type <span className="font-mono font-medium">{d.email}</span> to confirm.
                    </label>
                    <input id={`erase-${d.uid}`} autoComplete="off" value={erasing.typed} onChange={(e) => setErasing({ ...erasing, typed: e.target.value })} className="s-field h-10 text-[14px]" />
                    <div className="flex gap-2">
                      <button type="submit" disabled={erasing.busy || erasing.typed.trim().toLowerCase() !== d.email.toLowerCase()} className="s-btn h-9 bg-red-600 px-3.5 text-[13px] text-white disabled:opacity-50 [@media(hover:hover)]:hover:bg-red-700">
                        {erasing.busy ? 'Erasing…' : 'Erase permanently'}
                      </button>
                      <button type="button" onClick={() => setErasing(null)} className="s-btn s-btn-plain h-9 text-[13px]">Cancel</button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Quick actions */}
      <section aria-labelledby="actions-title">
        <h2 id="actions-title" className="mb-3 text-[16px] font-semibold text-slate-900">Quick actions</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onImport} className="s-btn s-btn-plain"><Upload size={15} strokeWidth={1.75} />Import projects</button>
          <button type="button" onClick={onExportRopa} disabled={ropaBusy} className="s-btn s-btn-plain">{ropaBusy ? 'Preparing…' : 'Privacy records (ROPA)'}</button>
          <Link to="/dashboard?tab=volunteer" className="s-btn s-btn-plain"><Megaphone size={15} strokeWidth={1.75} />Post a call</Link>
          <button type="button" onClick={() => onGo('calls')} className="s-btn s-btn-plain">Moderate calls</button>
        </div>
      </section>
    </div>
  );
};
