import React, { useState } from 'react';
import clsx from 'clsx';
import { Flag } from 'lucide-react';
import { toast } from 'sonner';
import { reportItem } from '../services/supabase';
import type { ReportReason } from '../types';

const REASONS: { id: ReportReason; label: string }[] = [
  { id: 'spam', label: 'Spam or a scam' },
  { id: 'misleading', label: 'Misleading or not a real project' },
  { id: 'harassment', label: 'Harassment or hateful content' },
  { id: 'privacy', label: 'Shares someone’s personal information' },
  { id: 'other', label: 'Something else' },
];

/** Quiet "Report" link that opens a short form. Admins see the report; the poster never learns who sent it. */
export const ReportButton: React.FC<{ targetType: 'call' | 'project'; targetId: string; className?: string }> = ({ targetType, targetId, className }) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) return <p className={clsx('text-[12.5px] text-slate-500', className)} role="status">Thanks — an admin will look at it.</p>;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={clsx('inline-flex items-center gap-1.5 text-[12.5px] text-slate-400 hover:text-slate-700', className)}>
        <Flag size={13} strokeWidth={1.75} />
        Report
      </button>
    );
  }

  return (
    <form
      className={clsx('w-full space-y-3 rounded-[12px] bg-slate-50 p-3.5 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.06)]', className)}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!reason) { toast.error('Pick a reason'); return; }
        setBusy(true);
        try {
          await reportItem({ targetType, targetId, reason, details: details.trim() || undefined });
          setSent(true);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Couldn’t send the report');
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-medium text-slate-900">What’s wrong?</legend>
        <div className="space-y-1">
          {REASONS.map((r) => (
            <label key={r.id} className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-700">
              <input type="radio" name={`report-${targetId}`} value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} className="accent-[var(--accent)]" />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>
      <textarea
        aria-label="Details (optional)"
        maxLength={1000}
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        className="s-field h-auto min-h-[64px] resize-y py-2 text-[13.5px]"
        placeholder="Anything that helps an admin understand (optional)"
      />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="s-btn h-9 bg-slate-900 px-3.5 text-[13px] text-white [@media(hover:hover)]:hover:bg-slate-800">{busy ? 'Sending…' : 'Send report'}</button>
        <button type="button" onClick={() => setOpen(false)} className="s-btn s-btn-plain h-9 text-[13px]">Cancel</button>
      </div>
    </form>
  );
};
