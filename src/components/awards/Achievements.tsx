import React from 'react';
import { Medal } from './Medal';
import { TIER_LABEL, type AwardState } from './awards';

/**
 * Achievements, the way GitHub shows them on a profile: only what's been earned, one badge and a
 * name each, the tier as a small pill on the badge. No progress bars, no locked placeholders.
 */
export const Achievements: React.FC<{ awards: AwardState[]; size?: number }> = ({ awards, size = 72 }) => {
  const earned = awards.filter((a) => a.earned);
  if (earned.length === 0) {
    return <p className="text-[13px] text-slate-500">Achievements show up here as you volunteer: posting calls, shipping projects, joining teams.</p>;
  }
  return (
    <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4">
      {earned.map((a) => {
        const tiered = a.def.kind === 'tiered';
        const showTier = tiered && a.tier && a.tier !== 'bronze';
        const label = `${a.def.name}${tiered && a.tier ? ` (${TIER_LABEL[a.tier]})` : ''}: ${a.def.description}`;
        return (
          <li key={a.def.id} className="flex flex-col items-center text-center" title={label}>
            <span className="relative">
              <Medal artId={a.def.id} icon={a.def.icon} tier={a.tier} pips={tiered} size={size} title={label} />
              {showTier && (
                <span
                  className={
                    'absolute -bottom-1 -right-1 rounded-full px-1.5 py-px text-[10.5px] font-semibold leading-[16px] shadow-[0_0_0_2px_white] ' +
                    (a.tier === 'gold' ? 'bg-[#f6e3a8] text-[#6b4a06]' : 'bg-[#e4e8ee] text-slate-700')
                  }
                >
                  {TIER_LABEL[a.tier!]}
                </span>
              )}
            </span>
            <span className="mt-2 text-[12.5px] font-medium leading-tight text-slate-800">{a.def.name}</span>
          </li>
        );
      })}
    </ul>
  );
};
