import React from 'react';
import { ChevronRight, LogOut } from 'lucide-react';

interface UserChipProps {
  name: string;
  subtitle: string;
  discordId?: string;
  discordAvatar?: string;
  /** What tapping the chip does, e.g. open the Volunteer Card. */
  onOpen?: () => void;
  openLabel?: string;
  onSignOut: () => void;
}

/** Header identity: avatar + name + role in one pill, with a compact sign-out beside it. */
export const UserChip: React.FC<UserChipProps> = ({ name, subtitle, discordId, discordAvatar, onOpen, openLabel, onSignOut }) => {
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const avatarUrl = discordId && discordAvatar ? `https://cdn.discordapp.com/avatars/${discordId}/${discordAvatar}.png?size=64` : null;

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={onOpen}
        title={openLabel}
        aria-label={openLabel ? `${name} — ${openLabel}` : name}
        className="group flex min-h-[40px] items-center gap-2.5 rounded-full bg-white py-1 pl-1 pr-1 shadow-[0_0_0_1px_rgb(15_23_42/0.1),0_1px_2px_rgb(15_23_42/0.05)] transition-[box-shadow] duration-150 sm:pr-3 [@media(hover:hover)]:hover:shadow-[0_0_0_1px_rgb(15_23_42/0.18),0_2px_6px_-2px_rgb(15_23_42/0.12)]"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[12px] font-semibold text-white">
            {initials}
          </span>
        )}
        <span className="hidden min-w-0 text-left leading-tight sm:block">
          <span className="block max-w-[150px] truncate text-[13px] font-semibold text-slate-900">{name}</span>
          <span className="block text-[11.5px] text-slate-500">{subtitle}</span>
        </span>
        {onOpen && (
          <ChevronRight
            size={14}
            strokeWidth={1.75}
            className="hidden text-slate-400 transition-transform duration-200 group-hover:translate-x-0.5 sm:block"
            aria-hidden
          />
        )}
      </button>
      <button
        type="button"
        onClick={onSignOut}
        aria-label="Sign out"
        title="Sign out"
        className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-900/[0.05] hover:text-slate-900"
      >
        <LogOut size={17} strokeWidth={1.75} />
      </button>
    </div>
  );
};
