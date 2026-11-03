import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface StatTileProps {
  label: string;
  value: React.ReactNode;
  /** Short context under the value, e.g. "since Mar 2025". */
  hint?: string;
  /** Small muted glyph beside the label. */
  icon?: LucideIcon;
}

/** One metric on its own card: label, value, and one line of context. */
export const StatTile: React.FC<StatTileProps> = ({ label, value, hint, icon: Icon }) => (
  <div className="s-card flex min-w-0 flex-col p-3.5 sm:p-5">
    <div className="flex items-center justify-between gap-2">
      <p className="truncate text-[13px] text-slate-500">{label}</p>
      {Icon && <Icon size={16} strokeWidth={1.75} className="shrink-0 text-slate-400" aria-hidden />}
    </div>
    <p className="num mt-1.5 text-[24px] font-semibold leading-none tracking-[-0.02em] text-slate-900 sm:text-[30px]">{value}</p>
    {hint && <p className="mt-auto truncate pt-3 text-[12px] text-slate-400">{hint}</p>}
  </div>
);
