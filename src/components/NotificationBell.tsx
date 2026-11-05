import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { BellIcon } from './icons';
import { getNotifications, markNotificationsRead } from '../services/supabase';
import type { AppNotification } from '../types';
import { timeAgo } from './RepoHealth';

const POLL_MS = 90_000;

/**
 * Header bell: who raised a hand on your call, team requests and decisions, project reviews.
 * Polls every 90 s and when the tab regains focus (no realtime channel: the table is API-only).
 */
export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [available, setAvailable] = useState(true);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Where the panel goes. It renders in a portal: the header's backdrop blur would otherwise clip it.
  const [pos, setPos] = useState<{ top: number; right: number; mobile: boolean }>({ top: 64, right: 12, mobile: true });
  const place = useCallback(() => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) return;
    const mobile = window.innerWidth < 640;
    setPos({ top: Math.round(r.bottom + 8), right: Math.max(12, Math.round(window.innerWidth - r.right)), mobile });
  }, []);
  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, place]);

  const load = useCallback(async () => {
    try {
      const r = await getNotifications();
      setItems(r.items);
      setUnread(r.unread);
      setAvailable(r.available !== false);
    } catch { /* offline or signed out: keep what we have */ }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') load(); }, POLL_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); buttonRef.current?.focus(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!available) return null;

  const markAll = async () => {
    setItems((list) => list.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try { await markNotificationsRead(); } catch { /* retry on next poll */ }
  };

  const openItem = async (n: AppNotification) => {
    setOpen(false);
    if (!n.read) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      markNotificationsRead([n.id]).catch(() => {});
    }
    if (n.link && n.link.startsWith('/')) navigate(n.link);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => { if (!open) { place(); load(); } setOpen((o) => !o); }}
        className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-900/[0.05] hover:text-slate-900"
      >
        <BellIcon unread={unread > 0} />
        {unread > 0 && (
          <span className="num absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10.5px] font-semibold text-white shadow-[0_0_0_2px_white]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && createPortal(
        <div className="site" style={{ background: 'transparent' }}>
        {/* Phones: dim the page and give the panel the full width under the header */}
        {pos.mobile && <div className="fixed inset-0 z-[55] bg-slate-900/25" aria-hidden onClick={() => setOpen(false)} />}
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          style={pos.mobile ? { top: pos.top, left: 12, right: 12 } : { top: pos.top, right: pos.right, width: 380 }}
          className="fixed z-[60] flex max-h-[min(75vh,560px)] flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_0_0_1px_rgb(15_23_42/0.08),0_16px_40px_-12px_rgb(15_23_42/0.3)]"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-[14px] font-semibold text-slate-900">Notifications</p>
            <span className="flex items-center gap-1">
              {unread > 0 && (
                <button type="button" onClick={markAll} className="min-h-[36px] rounded-full px-2.5 text-[12.5px] font-medium text-[var(--accent)] hover:bg-slate-50">Mark all read</button>
              )}
              <button type="button" aria-label="Close notifications" onClick={() => { setOpen(false); buttonRef.current?.focus(); }} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <X size={16} strokeWidth={1.75} />
              </button>
            </span>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-slate-500">Nothing yet. When someone answers your call or your team request, it shows up here.</p>
          ) : (
            <ul className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => openItem(n)}
                    className={clsx('flex min-h-[56px] w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100', !n.read && 'bg-[#f5f8ff]')}
                  >
                    <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-[var(--accent)]')} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className={clsx('block text-[13.5px] leading-snug', n.read ? 'text-slate-700' : 'font-medium text-slate-900')}>{n.title}</span>
                      {n.body && <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-500 line-clamp-2">{n.body}</span>}
                      <span className="mt-1 block text-[11.5px] text-slate-400">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        </div>,
        document.body
      )}
    </div>
  );
};
