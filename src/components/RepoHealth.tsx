import React from 'react';
import clsx from 'clsx';
import { Check, CircleDot, GitMerge, GitPullRequest, Minus, Star, Tag } from 'lucide-react';
import type { RepoStats } from '../types';

const ACTIVITY = {
  active: { label: 'Active', dot: 'bg-emerald-500', text: 'text-emerald-800', hint: 'Commits in the last 2 weeks' },
  quiet: { label: 'Quiet', dot: 'bg-amber-500', text: 'text-amber-800', hint: 'No commits for 2+ weeks' },
  stale: { label: 'Stale', dot: 'bg-slate-400', text: 'text-slate-600', hint: 'No commits for 2+ months' },
  archived: { label: 'Archived', dot: 'bg-slate-400', text: 'text-slate-600', hint: 'Read-only on GitHub' },
} as const;

export const timeAgo = (iso?: string | null) => {
  if (!iso) return null;
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (Number.isNaN(s)) return null;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  if (s < 86400 * 365) return `${Math.round(s / (86400 * 30))}mo ago`;
  return `${Math.round(s / (86400 * 365))}y ago`;
};

/** One-line status for cards and lists. */
export const RepoChip: React.FC<{ repo?: RepoStats | null; className?: string }> = ({ repo, className }) => {
  if (!repo?.ok || !repo.activity) return null;
  const a = ACTIVITY[repo.activity];
  return (
    <span className={clsx('inline-flex items-center gap-1.5 text-[12px]', a.text, className)} title={a.hint}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', a.dot)} aria-hidden />
      {a.label}
      {repo.lastCommitAt && <span className="text-slate-500">· updated {timeAgo(repo.lastCommitAt)}</span>}
      {repo.progress && <span className="num text-slate-500">· {repo.progress.percent}% done</span>}
    </span>
  );
};

const Stat: React.FC<{ icon: React.ElementType; label: string; value: React.ReactNode }> = ({ icon: Icon, label, value }) => (
  <div className="min-w-0">
    <dt className="flex items-center gap-1.5 text-[12px] text-slate-500">
      <Icon size={13} strokeWidth={1.75} aria-hidden />
      {label}
    </dt>
    <dd className="num mt-0.5 text-[15px] font-semibold text-slate-900">{value}</dd>
  </div>
);

/** Full tracker: activity, progress toward the next milestone, numbers and quality checks. */
export const RepoPanel: React.FC<{ repo: RepoStats; showChecks?: boolean; compact?: boolean }> = ({ repo, showChecks = true, compact }) => {
  if (!repo.ok) {
    return (
      <p role="alert" className="rounded-[10px] bg-red-50 px-3.5 py-3 text-[13px] text-red-800 shadow-[inset_0_0_0_1px_rgb(254_202_202)]">
        {repo.error || 'Couldn’t read that repository.'}
      </p>
    );
  }
  const a = repo.activity ? ACTIVITY[repo.activity] : null;
  return (
    <div className={clsx('rounded-[14px] bg-white shadow-[0_0_0_1px_rgb(15_23_42/0.1),0_1px_2px_rgb(15_23_42/0.05)]', compact ? 'p-4' : 'p-4 sm:p-5')}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <a href={repo.url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-2 text-[14px] font-semibold text-slate-900 hover:underline">
          <img src="/link-icons/github.svg" alt="" width={16} height={16} className="h-4 w-4 shrink-0" />
          <span className="truncate">{repo.slug}</span>
        </a>
        {a && (
          <span className={clsx('inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-0.5 text-[12px] font-medium shadow-[inset_0_0_0_1px_rgb(15_23_42/0.06)]', a.text)} title={a.hint}>
            <span className={clsx('h-1.5 w-1.5 rounded-full', a.dot)} aria-hidden />
            {a.label}
          </span>
        )}
      </div>
      {repo.lastCommitAt && (
        <p className="mt-1 truncate text-[12.5px] text-slate-500">
          Last commit {timeAgo(repo.lastCommitAt)}
          {repo.lastCommitMessage ? <> · <span className="text-slate-600">{repo.lastCommitMessage}</span></> : null}
        </p>
      )}

      {repo.progress && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
            <span className="min-w-0 truncate font-medium text-slate-700">
              {repo.progress.basis === 'milestone' && repo.milestone ? `Milestone: ${repo.milestone.title}` : 'Issues resolved'}
            </span>
            <span className="num shrink-0 text-slate-600">{repo.progress.percent}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={repo.progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
            <div className="h-full rounded-full bg-[linear-gradient(90deg,#1e3a8a,#3b5fd0)]" style={{ width: `${Math.min(100, Math.max(2, repo.progress.percent))}%` }} />
          </div>
          {repo.milestone?.dueOn && (
            <p className="mt-1 text-[12px] text-slate-500">Due {new Date(repo.milestone.dueOn).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
          )}
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-200/80 pt-3 sm:grid-cols-4">
        <Stat icon={GitMerge} label="Commits, 30 days" value={repo.commits30d ?? '—'} />
        <Stat icon={CircleDot} label="Open issues" value={repo.openIssues ?? '—'} />
        <Stat icon={GitPullRequest} label="Open PRs" value={repo.openPrs ?? '—'} />
        <Stat icon={Star} label="Stars" value={repo.stars ?? '—'} />
      </dl>
      {repo.release && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-slate-600">
          <Tag size={13} strokeWidth={1.75} aria-hidden />
          Latest release <span className="font-medium text-slate-800">{repo.release.tag}</span> · {timeAgo(repo.release.at)}
        </p>
      )}

      {showChecks && repo.checks && (
        <ul className="mt-4 grid grid-cols-1 gap-1.5 border-t border-slate-200/80 pt-3 sm:grid-cols-2">
          {repo.checks.map((c) => (
            <li key={c.key} className={clsx('flex items-center gap-2 text-[12.5px]', c.ok ? 'text-slate-700' : 'text-slate-500')}>
              <span className={clsx('flex h-4 w-4 shrink-0 items-center justify-center rounded-full', c.ok ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400')}>
                {c.ok ? <Check size={11} strokeWidth={2.5} /> : <Minus size={11} strokeWidth={2.5} />}
              </span>
              {c.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
