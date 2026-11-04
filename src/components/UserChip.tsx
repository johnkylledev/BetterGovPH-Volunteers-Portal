import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, BadgeCheck, Check, ChevronDown, IdCard, LayoutDashboard, Link2, LogOut, MessageCircle, UserCog } from 'lucide-react';
import { DISCORD_INVITE } from './site/links';
import { Avatar, useSessionPhoto } from './Avatar';

interface UserChipProps {
  name: string;
  subtitle: string;
  email?: string;
  memberId?: string;
  /** Approved members get a Verified badge and a shareable card link. */
  verified?: boolean;
  isAdmin?: boolean;
  discordId?: string;
  discordAvatar?: string;
  /** Stable id that keeps the fallback colour the same everywhere. */
  seed?: string;
  /** Opens the Volunteer Card in place; without it the menu links to the public card page. */
  onOpen?: () => void;
  openLabel?: string;
  onSignOut: () => void;
}

/** Header identity pill that opens an account menu: who you are, quick actions, sign out. */
export const UserChip: React.FC<UserChipProps> = ({
  name, subtitle, email, memberId, verified, isAdmin, discordId, discordAvatar, seed, onOpen, openLabel, onSignOut,
}) => {
  const sessionPhoto = useSessionPhoto();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Only keyboard opens move focus into the menu; a mouse click shouldn't pre-highlight an item.
  const openedByKeyboard = useRef(false);

  // Menu keyboard pattern: focus the first item on open, arrows move, Escape returns focus.
  useEffect(() => {
    if (!open) return;
    if (openedByKeyboard.current) menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
      if (!items.length) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next =
        e.key === 'Home' ? 0
        : e.key === 'End' ? items.length - 1
        : e.key === 'ArrowDown' ? (i + 1) % items.length
        : (i - 1 + items.length) % items.length;
      items[next].focus();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(t);
  }, [copied]);

  const avatar = (px: number) => (
    <Avatar name={name} seed={seed || memberId || email} discordId={discordId} discordAvatar={discordAvatar} photos={[sessionPhoto]} size={px} />
  );

  const go = (path: string) => { setOpen(false); navigate(path); };
  const homePath = isAdmin ? '/admin' : '/dashboard';
  const onProfile = pathname.startsWith('/profile');
  const cardUrl = memberId && typeof window !== 'undefined' ? `${window.location.origin}/verify/${memberId}` : '';

  const copyCardLink = async () => {
    if (!cardUrl) return;
    try {
      await navigator.clipboard.writeText(cardUrl);
      setCopied(true);
    } catch {
      /* clipboard unavailable */
    }
  };

  const item =
    'flex w-full min-h-[40px] items-center gap-3 rounded-lg px-2.5 text-left text-[14px] text-slate-700 transition-colors hover:bg-slate-900/[0.04] hover:text-slate-900 focus-visible:bg-slate-900/[0.05] focus-visible:outline-none';
  const icon = 'shrink-0 text-slate-400';

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          openedByKeyboard.current = e.detail === 0;
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${name} — account menu`}
        className="group flex min-h-[40px] items-center gap-2.5 rounded-full bg-white py-1 pl-1 pr-1 shadow-[0_0_0_1px_rgb(15_23_42/0.1),0_1px_2px_rgb(15_23_42/0.05)] transition-[box-shadow] duration-150 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgb(30_58_138/0.35)] sm:pr-3 [@media(hover:hover)]:hover:shadow-[0_0_0_1px_rgb(15_23_42/0.18),0_2px_6px_-2px_rgb(15_23_42/0.12)]"
      >
        {avatar(32)}
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

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            role="menu"
            aria-label="Account"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -2 }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: 'top right' }}
            className="absolute right-0 top-full z-50 mt-2 w-[272px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgb(15_23_42/0.08),0_16px_40px_-12px_rgb(15_23_42/0.28)]"
          >
            {/* Who you're signed in as */}
            <div className="flex items-center gap-3 border-b border-slate-200/80 bg-slate-50/70 px-4 py-3.5">
              {avatar(40)}
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-900">
                  <span className="truncate">{name}</span>
                  {verified && <BadgeCheck size={15} strokeWidth={2} className="shrink-0 text-[var(--accent)]" aria-label="Verified" />}
                </p>
                {email && <p className="truncate text-[12.5px] text-slate-500">{email}</p>}
                {memberId && <p className="mt-0.5 truncate font-mono text-[11.5px] text-slate-400">{memberId}</p>}
              </div>
            </div>

            <div className="p-1.5">
              {onProfile && (
                <button type="button" role="menuitem" className={item} onClick={() => go(homePath)}>
                  <LayoutDashboard size={16} strokeWidth={1.75} className={icon} aria-hidden />
                  {isAdmin ? 'Admin dashboard' : 'Dashboard'}
                </button>
              )}
              {(onOpen || (memberId && verified)) && (
                <button
                  type="button"
                  role="menuitem"
                  className={item}
                  onClick={() => {
                    setOpen(false);
                    if (onOpen) onOpen();
                    else if (memberId) navigate(`/verify/${memberId}`);
                  }}
                >
                  <IdCard size={16} strokeWidth={1.75} className={icon} aria-hidden />
                  {openLabel || 'View my card'}
                </button>
              )}
              {verified && cardUrl && (
                <button type="button" role="menuitem" className={item} onClick={copyCardLink}>
                  {copied ? (
                    <Check size={16} strokeWidth={2} className="shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <Link2 size={16} strokeWidth={1.75} className={icon} aria-hidden />
                  )}
                  <span aria-live="polite">{copied ? 'Link copied' : 'Copy verification link'}</span>
                </button>
              )}
              {!onProfile && (
                <button type="button" role="menuitem" className={item} onClick={() => go('/profile')}>
                  <UserCog size={16} strokeWidth={1.75} className={icon} aria-hidden />
                  Profile settings
                </button>
              )}
              <a role="menuitem" href={DISCORD_INVITE} target="_blank" rel="noopener noreferrer" className={item} onClick={() => setOpen(false)}>
                <MessageCircle size={16} strokeWidth={1.75} className={icon} aria-hidden />
                <span className="flex-1">Community Discord</span>
                <ArrowUpRight size={14} strokeWidth={1.75} className="text-slate-300" aria-hidden />
              </a>
            </div>

            <div className="border-t border-slate-200/80 p-1.5">
              <button
                type="button"
                role="menuitem"
                className={`${item} text-red-600 hover:bg-red-50 hover:text-red-700 focus-visible:bg-red-50`}
                onClick={() => { setOpen(false); onSignOut(); }}
              >
                <LogOut size={16} strokeWidth={1.75} className="shrink-0" aria-hidden />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
