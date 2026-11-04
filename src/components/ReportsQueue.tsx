import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Flag, X } from 'lucide-react';
import { toast } from 'sonner';
import { getReports, resolveReport } from '../services/supabase';
import type { ReportItem } from '../types';
import { timeAgo } from './RepoHealth';

const REASON_LABEL: Record<string, string> = {
  spam: 'Spam or scam', misleading: 'Misleading', harassment: 'Harassment', privacy: 'Personal information', other: 'Other',
};

/** Admin header button showing open reports; opens the moderation queue. */
export const ReportsQueue: React.FC<{ initiallyOpen?: boolean }> = ({ initiallyOpen }) => {
  const [open, setOpen] = useState(!!initiallyOpen);
  const [reports, setReports] = useState<ReportItem[] | null>(null);
  const [available, setAvailable] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await getReports('open');
      setReports(r.reports);
      setAvailable(r.available !== false);
    } catch {
      setReports([]);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!available) return null;
  const count = reports?.length ?? 0;

  const act = async (r: ReportItem, status: 'dismissed' | 'actioned', hide = false) => {
    setBusy(r.id);
    try {
      await resolveReport(r.id, status, { resolution: notes[r.id]?.trim() || undefined, hide });
      toast.success(status === 'dismissed' ? 'Dismissed' : hide ? (r.targetType === 'call' ? 'Call closed' : 'Project sent back to review') : 'Marked handled');
      // Every open report on the same item is closed together.
      setReports((list) => list?.filter((x) => !(x.targetType === r.targetType && x.targetId === r.targetId)) ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t update');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); load(); }}
        className={clsx('relative inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] transition-colors',
          count ? 'bg-red-50 font-medium text-red-800 shadow-[inset_0_0_0_1px_rgb(254_202_202)] hover:bg-red-100' : 'text-slate-500 hover:bg-slate-900/[0.05] hover:text-slate-900')}
      >
        <Flag size={14} strokeWidth={1.75} />
        <span className="hidden sm:inline">Reports</span>
        {count > 0 && <span className="num">{count}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="reports-title">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-[14px] bg-white shadow-[var(--e2)]">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
              <div>
                <h2 id="reports-title" className="text-[17px] font-semibold text-slate-900">Reports <span className="num font-normal text-slate-400">{count}</span></h2>
                <p className="mt-1 text-[13px] text-slate-500">Reporters stay anonymous to the person reported. Closing one report closes all open reports on the same item.</p>
              </div>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 sm:p-6">
              {!reports ? (
                <p className="text-[13px] text-slate-500" role="status">Loading…</p>
              ) : reports.length === 0 ? (
                <p className="py-8 text-center text-[14px] text-slate-500">Nothing to review.</p>
              ) : (
                <ul className="space-y-4">
                  {reports.map((r) => (
                    <li key={r.id} className="rounded-[12px] p-4 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.1)]">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <p className="min-w-0 text-[14.5px] font-semibold text-slate-900">
                          <span className="mr-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-600">{r.targetType}</span>
                          {r.targetType === 'project'
                            ? <Link to={`/projects/${encodeURIComponent(r.targetId)}`} className="hover:underline" target="_blank">{r.targetTitle}</Link>
                            : <Link to={`/opportunities?call=${encodeURIComponent(r.targetId)}`} className="hover:underline" target="_blank">{r.targetTitle}</Link>}
                        </p>
                        <span className="text-[12px] text-slate-400">{timeAgo(r.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-[13px] text-slate-600">
                        <span className="font-medium text-red-800">{REASON_LABEL[r.reason] ?? r.reason}</span> · reported by {r.reporter}
                        {r.targetStatus ? <> · currently <span className="font-medium">{r.targetStatus}</span></> : null}
                      </p>
                      {r.details && <p className="mt-2 whitespace-pre-wrap break-words rounded-[8px] bg-slate-50 px-3 py-2 text-[13px] text-slate-700">“{r.details}”</p>}
                      <input
                        aria-label="Note (optional)"
                        maxLength={500}
                        value={notes[r.id] ?? ''}
                        onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                        className="s-field mt-3 h-10 text-[13.5px]"
                        placeholder="Note for the record (optional; shown to the poster if the project is sent back)"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" disabled={busy === r.id} onClick={() => act(r, 'actioned', true)} className="s-btn h-9 bg-red-600 px-3.5 text-[13px] text-white [@media(hover:hover)]:hover:bg-red-700">
                          {r.targetType === 'call' ? 'Close the call' : 'Hide: send back to review'}
                        </button>
                        <button type="button" disabled={busy === r.id} onClick={() => act(r, 'actioned')} className="s-btn s-btn-plain h-9 text-[13px]">Handled another way</button>
                        <button type="button" disabled={busy === r.id} onClick={() => act(r, 'dismissed')} className="s-btn s-btn-plain h-9 text-[13px]">Dismiss</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
