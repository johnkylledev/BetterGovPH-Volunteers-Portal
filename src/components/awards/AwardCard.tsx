import React from 'react';
import { Medal } from './Medal';
import { TIER_LABEL, type AwardState } from './awards';

const TIER_TEXT = { bronze: 'text-[#8a4f22]', silver: 'text-slate-600', gold: 'text-[#8a5d05]' } as const;

/** One award: medal, name, tier, what it's for, and progress toward the next tier. */
export const AwardCard: React.FC<{ award: AwardState; compact?: boolean }> = ({ award, compact }) => {
  const { def, earned, tier, value, next, progress } = award;
  const tiered = def.kind === 'tiered';

  return (
    <div className={compact ? 'flex items-center gap-4' : 's-card flex items-center gap-4 p-4'}>
      <Medal icon={def.icon} tier={tier} pips={tiered} size={compact ? 52 : 60} title={`${def.name}${tier && tiered ? ` — ${TIER_LABEL[tier]}` : ''}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className={earned ? 'text-[15px] font-semibold text-slate-900' : 'text-[15px] font-semibold text-slate-500'}>{def.name}</p>
          {tier && tiered && <span className={`text-[12px] font-medium ${TIER_TEXT[tier]}`}>{TIER_LABEL[tier]}</span>}
          {!earned && <span className="text-[12px] text-slate-400">Locked</span>}
        </div>
        <p className="mt-0.5 text-[13px] leading-snug text-slate-500">{def.description}</p>

        {tiered && next && (
          <div className="mt-2.5">
            <div
              className="h-1 overflow-hidden rounded-full bg-slate-100"
              role="meter"
              aria-label={`${def.name} progress`}
              aria-valuemin={0}
              aria-valuemax={next.target}
              aria-valuenow={value}
            >
              <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="num mt-1.5 text-[12px] text-slate-500">
              {value} / {next.target} · {next.label}
            </p>
          </div>
        )}
        {tiered && !next && <p className="mt-1.5 text-[12px] text-slate-500">Highest tier reached</p>}
        {!tiered && !earned && def.kind === 'single' && <p className="mt-1.5 text-[12px] text-slate-400">{def.how}</p>}
      </div>
    </div>
  );
};
