import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Award, Check, Clock3, X } from 'lucide-react';
import { toast } from 'sonner';
import type { HoursEntry, MyTeam, VolunteerCall } from '../types';
import { decideHours, deleteHours, getHoursToConfirm, getMyHours, logHours } from '../services/supabase';
import { SelectMenu } from './SelectMenu';

const today = () => new Date().toISOString().slice(0, 10);
const fmtHours = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
const STATUS = {
  confirmed: { label: 'Confirmed', cls: 'bg-emerald-50 text-emerald-800' },
  pending: { label: 'Waiting', cls: 'bg-amber-50 text-amber-800' },
  declined: { label: 'Not confirmed', cls: 'bg-slate-100 text-slate-500' },
} as const;

/** Log hours against a project team or a call. Fixed target when `projectId`/`callId` is given. */
export const LogHoursForm: React.FC<{
  idPrefix: string;
  targets?: { value: string; label: string; hint?: string }[];
  projectId?: string;
  onLogged: () => void;
  onCancel?: () => void;
}> = ({ idPrefix, targets = [], projectId, onLogged, onCancel }) => {
  const [target, setTarget] = useState(projectId ? `p:${projectId}` : targets[0]?.value ?? '');
  const [hours, setHours] = useState('2');
  const [activity, setActivity] = useState('');
  const [day, setDay] = useState(today());
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!target) { toast.error('Pick where you helped'); return; }
        setBusy(true);
        try {
          const [kind, id] = [target.slice(0, 1), target.slice(2)];
          await logHours({ ...(kind === 'p' ? { projectId: id } : { callId: id }), hours: Number(hours), activity: activity.trim(), workedOn: day });
          toast.success('Logged. The team head or poster will confirm it.');
          setActivity('');
          onLogged();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Couldn’t log hours');
        } finally {
          setBusy(false);
        }
      }}
    >
      {!projectId && (
        <div>
          <label id={`${idPrefix}-where-label`} htmlFor={`${idPrefix}-where`} className="mb-1.5 block text-[13px] font-medium text-slate-900">Where you helped</label>
          <SelectMenu id={`${idPrefix}-where`} labelledBy={`${idPrefix}-where-label`} value={target} onChange={setTarget} placeholder="Choose a team or call" options={targets} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${idPrefix}-hours`} className="mb-1.5 block text-[13px] font-medium text-slate-900">Hours</label>
          <input id={`${idPrefix}-hours`} type="number" min={0.5} max={24} step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} className="s-field" required />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-day`} className="mb-1.5 block text-[13px] font-medium text-slate-900">Day</label>
          <input id={`${idPrefix}-day`} type="date" max={today()} value={day} onChange={(e) => setDay(e.target.value)} className="s-field" required />
        </div>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-what`} className="mb-1.5 block text-[13px] font-medium text-slate-900">What you did</label>
        <input id={`${idPrefix}-what`} maxLength={200} value={activity} onChange={(e) => setActivity(e.target.value)} className="s-field" placeholder="Edited two reels, reviewed the FOI draft…" required />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="s-btn s-btn-accent h-10 flex-1">{busy ? 'Logging…' : 'Log hours'}</button>
        {onCancel && <button type="button" onClick={onCancel} className="s-btn s-btn-plain h-10">Cancel</button>}
      </div>
    </form>
  );
};

/** Dashboard card: total confirmed hours, recent entries, log more, and the certificate link. */
export const MyHoursCard: React.FC<{ teams: MyTeam[] | null; calls: VolunteerCall[]; approved: boolean }> = ({ teams, calls, approved }) => {
  const [data, setData] = useState<{ entries: HoursEntry[]; totals: { confirmed: number; pending: number }; available?: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => { getMyHours().then(setData).catch(() => setData(null)); }, []);
  useEffect(() => { load(); }, [load]);

  const targets = useMemo(() => [
    ...(teams ?? []).filter((t) => t.status === 'approved').map((t) => ({ value: `p:${t.projectId}`, label: t.projectName, hint: t.role === 'head' ? 'Your team (you lead it; an admin confirms)' : 'Your team' })),
    ...calls.filter((c) => c.myInterest && c.myInterest !== 'withdrawn').map((c) => ({ value: `c:${c.id}`, label: c.title, hint: 'Call you answered' })),
  ], [teams, calls]);

  if (!data || data.available === false) return null;
  const recent = data.entries.slice(0, 4);

  return (
    <section className="s-card p-5 sm:p-6" aria-labelledby="hours-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="hours-title" className="text-[16px] font-semibold text-slate-900">Volunteer hours</h2>
          <p className="mt-0.5 text-[13px] text-slate-500">Confirmed hours go on your certificate of volunteer service.</p>
        </div>
        <div className="text-right">
          <p className="num text-[24px] font-semibold leading-none text-slate-900">{fmtHours(data.totals.confirmed)}</p>
          {data.totals.pending > 0 && <p className="num mt-1 text-[12px] text-amber-700">{fmtHours(data.totals.pending)} waiting</p>}
        </div>
      </div>

      {recent.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-200/80">
          {recent.map((e) => (
            <li key={e.id} className="flex items-center gap-3 py-2.5 text-[13.5px]">
              <span className="num w-12 shrink-0 font-semibold text-slate-900">{fmtHours(e.hours)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-slate-800">{e.activity}</span>
                <span className="block truncate text-[12px] text-slate-500">{e.where} · {new Date(`${e.workedOn}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              </span>
              <span className={clsx('shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-medium', STATUS[e.status].cls)}>{STATUS[e.status].label}</span>
              {e.status === 'pending' && (
                <button type="button" aria-label="Remove this entry" onClick={async () => { try { await deleteHours(e.id); load(); } catch { toast.error('Couldn’t remove'); } }} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <X size={14} strokeWidth={1.75} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        {open ? (
          targets.length ? (
            <LogHoursForm idPrefix="dash-hours" targets={targets} onLogged={() => { setOpen(false); load(); }} onCancel={() => setOpen(false)} />
          ) : (
            <p className="rounded-[10px] bg-slate-50 px-3.5 py-3 text-[13px] text-slate-600">Join a project team or say you’re interested in a call first. Then you can log hours there.</p>
          )
        ) : (
          <div className={clsx('grid gap-2', approved ? 'grid-cols-2' : 'grid-cols-1 sm:max-w-[200px]')}>
            <button type="button" onClick={() => setOpen(true)} className="s-btn s-btn-plain h-10 w-full justify-center"><Clock3 size={15} strokeWidth={1.75} />Log hours</button>
            {approved && (
              <Link to="/certificate" aria-label="Certificate of service" className="s-btn s-btn-plain h-10 w-full justify-center"><Award size={15} strokeWidth={1.75} />Certificate</Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

/** For team heads, call posters and admins: hours other people logged, to confirm or decline. */
export const HoursToConfirm: React.FC<{ projectId?: string; title?: string }> = ({ projectId, title = 'Hours to confirm' }) => {
  const [entries, setEntries] = useState<HoursEntry[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => { getHoursToConfirm().then((r) => setEntries(r.entries)).catch(() => setEntries([])); }, []);
  useEffect(() => { load(); }, [load]);
  const shown = (entries ?? []).filter((e) => !projectId || String(e.projectId) === String(projectId));
  if (!shown.length) return null;

  const decide = async (e: HoursEntry, decision: 'confirm' | 'decline') => {
    setBusy(e.id);
    try { await decideHours(e.id, decision); setEntries((l) => l?.filter((x) => x.id !== e.id) ?? null); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Couldn’t save'); }
    finally { setBusy(null); }
  };

  return (
    <section className="s-card p-5 sm:p-6" aria-labelledby={`htc-${projectId ?? 'all'}`}>
      <h2 id={`htc-${projectId ?? 'all'}`} className="text-[16px] font-semibold text-slate-900">
        {title} <span className="num font-normal text-slate-400">{shown.length}</span>
      </h2>
      <p className="mt-0.5 text-[13px] text-slate-500">Confirm what you saw them do. Confirmed hours appear on their certificate and can be checked on their verify page.</p>
      <ul className="mt-4 divide-y divide-slate-200/80">
        {shown.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className="num w-12 shrink-0 text-[15px] font-semibold text-slate-900">{fmtHours(e.hours)}</span>
            <span className="min-w-0 flex-1 basis-48">
              <span className="block text-[14px] text-slate-900">{e.person.name} <span className="text-slate-500">· {e.activity}</span></span>
              <span className="block text-[12px] text-slate-500">{e.where} · {new Date(`${e.workedOn}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
            </span>
            <span className="flex gap-2">
              <button type="button" disabled={busy === e.id} onClick={() => decide(e, 'confirm')} className="s-btn s-btn-accent h-9 px-3 text-[13px]"><Check size={14} strokeWidth={2.25} />Confirm</button>
              <button type="button" disabled={busy === e.id} onClick={() => decide(e, 'decline')} className="s-btn s-btn-plain h-9 px-3 text-[13px]">Decline</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};
