import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { toast } from 'sonner';
import { deleteVolunteerCall, getAdminVolunteerCalls, updateVolunteerCall } from '../../services/supabase';
import type { VolunteerCall } from '../../types';
import { callTypeOf } from '../../constants/community';
import { CallMeta } from '../CallFields';
import { InterestList } from '../CallInterest';
import { timeAgo } from '../RepoHealth';

/** Admin moderation for calls and requests: every call, any status. */
export const AdminCalls: React.FC = () => {
  const [filter, setFilter] = useState<'All' | 'open' | 'closed'>('open');
  const [calls, setCalls] = useState<VolunteerCall[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [openList, setOpenList] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    try { setCalls((await getAdminVolunteerCalls({ status: filter })).calls); }
    catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t load calls'); setCalls([]); }
  }, [filter]);
  useEffect(() => { setCalls(null); load(); }, [load]);

  const toggle = async (c: VolunteerCall) => {
    setBusy(c.id);
    try {
      await updateVolunteerCall(c.id, { status: c.status === 'closed' ? 'open' : 'closed' });
      toast.success(c.status === 'closed' ? 'Reopened' : 'Closed');
      load();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Couldn’t update'); }
    finally { setBusy(null); }
  };
  const remove = async (c: VolunteerCall) => {
    setBusy(c.id);
    try { await deleteVolunteerCall(c.id); toast.success('Deleted'); setConfirmDelete(null); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Couldn’t delete'); }
    finally { setBusy(null); }
  };

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Calls & requests</h2>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">Calls go live without approval. Close anything off-topic or out of date.</p>
        </div>
        <div className="flex gap-1 rounded-[10px] bg-slate-100 p-1">
          {(['open', 'closed', 'All'] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFilter(f)}
              className={clsx('rounded-[8px] px-3 py-1.5 text-xs font-semibold capitalize transition-colors', filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700')}>
              {f === 'All' ? 'All' : f}
            </button>
          ))}
        </div>
      </div>

      {calls === null ? (
        <p className="p-6 text-[14px] text-slate-500" role="status">Loading…</p>
      ) : error ? (
        <p className="p-6 text-[14px] text-red-700">{error}</p>
      ) : calls.length === 0 ? (
        <p className="p-10 text-center text-[14px] text-slate-500">No {filter === 'All' ? '' : filter} calls.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {calls.map((c) => {
            const type = callTypeOf(c.callType);
            return (
              <li key={c.id} className="p-4 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 basis-72">
                    <p className="flex flex-wrap items-center gap-2">
                      <Link to={`/opportunities?call=${encodeURIComponent(c.id)}`} target="_blank" className="break-words text-[15px] font-semibold text-slate-900 hover:underline">{c.title}</Link>
                      <span className={clsx('inline-flex items-center gap-1.5 text-[12px]', c.status === 'closed' ? 'text-slate-500' : 'text-emerald-700')}>
                        <span className={clsx('h-1.5 w-1.5 rounded-full', c.status === 'closed' ? 'bg-slate-400' : 'bg-emerald-500')} aria-hidden />
                        {c.status === 'closed' ? 'Closed' : 'Open'}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-slate-500">
                      {type.label} · {c.postedBy?.fullName || 'Member'}{c.postedBy?.email ? ` (${c.postedBy.email})` : ''} · {timeAgo(c.createdAt)}
                    </p>
                    <CallMeta call={c} />
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {typeof c.interestCount === 'number' && (
                      <button type="button" onClick={() => setOpenList(openList === c.id ? null : c.id)} className="s-btn s-btn-plain h-8 px-2.5 text-[12px]">
                        {c.interestCount} interested
                      </button>
                    )}
                    <button type="button" disabled={busy === c.id} onClick={() => toggle(c)} className="s-btn s-btn-plain h-8 px-2.5 text-[12px]">
                      {c.status === 'closed' ? 'Reopen' : 'Close'}
                    </button>
                    {confirmDelete === c.id ? (
                      <>
                        <button type="button" disabled={busy === c.id} onClick={() => remove(c)} className="s-btn h-8 bg-red-600 px-2.5 text-[12px] text-white">Delete for good</button>
                        <button type="button" onClick={() => setConfirmDelete(null)} className="s-btn s-btn-plain h-8 px-2.5 text-[12px]">Cancel</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConfirmDelete(c.id)} className="s-btn h-8 px-2.5 text-[12px] text-red-700 hover:bg-red-50">Delete</button>
                    )}
                  </div>
                </div>
                {openList === c.id && (
                  <div className="mt-3 rounded-[12px] bg-slate-50 p-3.5 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.05)]">
                    <InterestList callId={c.id} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
