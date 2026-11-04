import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Check, ChevronRight, X } from 'lucide-react';
import type { MyTeam, User, VolunteerCall } from '../types';

interface Step { id: string; label: string; hint: string; done: boolean; to: string; state?: Record<string, unknown> }

const DISMISS_KEY = 'bgph:getting-started-dismissed';

/**
 * A short first path for new volunteers (meeting journey 2; g0v and Code for America both give
 * newcomers a guided start). Disappears when everything is done, or when dismissed on this device.
 */
export const GettingStarted: React.FC<{ user: User; calls: VolunteerCall[]; teams: MyTeam[] | null }> = ({ user, calls, teams }) => {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  const steps: Step[] = [
    { id: 'privacy', label: 'Choose what the public sees', hint: 'Review consent, your display name and the directory switch.', done: !!user.consentAt, to: '/profile?tab=privacy' },
    { id: 'coc', label: 'Agree to the code of conduct', hint: 'How we work together: respect, open collaboration, no harassment.', done: !!user.cocAcceptedAt, to: '/code-of-conduct' },
    { id: 'skills', label: 'Add a few skills', hint: 'Calls that fit your skills show up under “For you”.', done: (user.skills?.length ?? 0) >= 2, to: '/profile?tab=skills' },
    { id: 'interest', label: 'Raise your hand on a call', hint: 'Say “I’m interested” and the poster gets in touch.', done: calls.some((c) => c.myInterest && c.myInterest !== 'withdrawn'), to: '/opportunities' },
    { id: 'team', label: 'Join a project team', hint: 'Open a project and ask to join.', done: !!teams?.some((t) => t.status === 'approved'), to: '/projects' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (dismissed || doneCount === steps.length) return null;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <section className="s-card p-5 sm:p-6" aria-labelledby="gs-title">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="gs-title" className="text-[16px] font-semibold text-slate-900">Getting started</h2>
          <p className="mt-0.5 text-[13px] text-slate-500"><span className="num">{doneCount}</span> of {steps.length} done</p>
        </div>
        <button
          type="button"
          aria-label="Hide getting started"
          onClick={() => { setDismissed(true); try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* noop */ } }}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={16} strokeWidth={1.75} />
        </button>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Getting started progress">
        <div className="h-full rounded-full bg-[linear-gradient(90deg,#1e3a8a,#3b5fd0)] transition-[width] duration-500" style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
      <ol className="mt-4 divide-y divide-slate-200/80">
        {steps.map((s, i) => (
          <li key={s.id}>
            <Link to={s.to} state={s.state} className={clsx('group flex items-center gap-3 py-3', s.done && 'pointer-events-none')} aria-disabled={s.done || undefined}>
              <span
                className={clsx(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold',
                  s.done ? 'bg-emerald-500 text-white' : 'bg-white text-slate-500 shadow-[inset_0_0_0_1.5px_rgb(148_163_184)]'
                )}
                aria-hidden
              >
                {s.done ? <Check size={13} strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={clsx('block text-[14px]', s.done ? 'text-slate-400 line-through decoration-slate-300' : 'font-medium text-slate-900')}>{s.label}</span>
                {!s.done && <span className="block text-[12.5px] leading-snug text-slate-500">{s.hint}</span>}
              </span>
              {!s.done && <ChevronRight size={16} strokeWidth={1.75} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500" />}
              <span className="sr-only">{s.done ? 'Done' : 'Not done yet'}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
};
