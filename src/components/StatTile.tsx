import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { useCountUp } from '../hooks/useCountUp';

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  /** Short context under the value, e.g. "since Mar 2025". */
  hint?: string;
  /** Small muted glyph beside the label. */
  icon?: LucideIcon;
  /** No number yet: show a placeholder instead of a 0 that then jumps. */
  loading?: boolean;
}

/** Counts up once when the number arrives or changes; plain text is shown as-is. */
const Value: React.FC<{ value: React.ReactNode }> = ({ value }) => {
  const numeric = typeof value === 'number' && Number.isFinite(value);
  const shown = useCountUp(numeric ? (value as number) : 0);
  return <>{numeric ? shown.toLocaleString() : value}</>;
};

/** One metric on its own card: label, value, and one line of context. */
export const StatTile: React.FC<StatTileProps> = ({ label, value, hint, icon: Icon, loading }) => (
  <div className="s-card flex min-w-0 flex-col p-3.5 sm:p-5">
    <div className="flex items-center justify-between gap-2">
      <p className="truncate text-[13px] text-slate-500">{label}</p>
      {Icon && <Icon size={16} strokeWidth={1.75} className="shrink-0 text-slate-400" aria-hidden />}
    </div>
    <p className="num mt-1.5 text-[24px] font-semibold leading-none tracking-[-0.02em] text-slate-900 sm:text-[30px]">
      {loading ? <span className="inline-block h-[0.7em] w-10 rounded bg-slate-100 align-middle" aria-hidden /> : <Value value={value} />}
    </p>
    {hint && <p className="mt-auto pt-3 text-[12px] leading-snug text-slate-400 [overflow-wrap:anywhere]">{hint}</p>}
  </div>
);
