import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, IdCard, LogOut, UserCog } from 'lucide-react';

interface UserChipProps {
  name: string;
  subtitle: string;
  discordId?: string;
  discordAvatar?: string;
  /** Menu entry that opens the Volunteer Card (hidden when not provided). */
  onOpen?: () => void;
  openLabel?: string;
  onSignOut: () => void;
}

/** Header identity: avatar + name + role in one pill that opens an account menu, with a compact sign-out beside it. */
export const UserChip: React.FC<UserChipProps> = ({ name, subtitle, discordId, discordAvatar, onOpen, openLabel, onSignOut }) => {
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const itemClass =
    'flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13.5px] text-slate-700 transition-colors hover:bg-slate-900/[0.04] hover:text-slate-900';
  const avatarUrl = discordId && discordAvatar ? `https://cdn.discordapp.com/avatars/${discordId}/${discordAvatar}.png?size=64` : null;

  return (
    <div ref={rootRef} className="relative flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${name} — account menu`}
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
        <ChevronDown
          size={14}
          strokeWidth={1.75}
          className={`hidden text-slate-400 transition-transform duration-200 sm:block ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl bg-white py-1 shadow-[0_0_0_1px_rgb(15_23_42/0.1),0_12px_28px_-8px_rgb(15_23_42/0.2)]"
        >
          {onOpen && (
            <button type="button" role="menuitem" className={itemClass} onClick={() => { setOpen(false); onOpen(); }}>
              <IdCard size={16} strokeWidth={1.75} className="text-slate-400" aria-hidden />
              {openLabel || 'View my card'}
            </button>
          )}
          <button type="button" role="menuitem" className={itemClass} onClick={() => { setOpen(false); navigate('/profile'); }}>
            <UserCog size={16} strokeWidth={1.75} className="text-slate-400" aria-hidden />
            Profile settings
          </button>
        </div>
      )}
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
