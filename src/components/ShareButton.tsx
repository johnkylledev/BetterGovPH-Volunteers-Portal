import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Check, Link2, Share2 } from 'lucide-react';

/**
 * Share a call or project where volunteers actually are: Messenger, Facebook, WhatsApp, Viber.
 * On phones the native share sheet comes first (it includes Messenger). Link previews come from
 * the page's own title and description (see /api/v1/og).
 */
export const ShareButton: React.FC<{ url: string; title: string; className?: string; compact?: boolean }> = ({ url, title, className, compact }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const text = `${title} — BetterGovPH Volunteers`;
  const enc = encodeURIComponent;
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad/i.test(navigator.userAgent);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('touchstart', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  };

  const options = [
    ...(isMobile ? [{ key: 'messenger', label: 'Messenger', href: `fb-messenger://share/?link=${enc(url)}` }] : []),
    { key: 'facebook', label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { key: 'whatsapp', label: 'WhatsApp', href: `https://wa.me/?text=${enc(`${text} ${url}`)}` },
    { key: 'viber', label: 'Viber', href: `viber://forward?text=${enc(`${text} ${url}`)}` },
    { key: 'x', label: 'X', href: `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}` },
  ];

  return (
    <div ref={rootRef} className={clsx('relative', className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={async () => {
          if (isMobile && typeof navigator.share === 'function') {
            try { await navigator.share({ title: text, url }); return; } catch { /* cancelled: fall back to the menu */ }
          }
          setOpen((o) => !o);
        }}
        className={clsx('s-btn s-btn-plain', compact ? 'h-9 px-3 text-[13px]' : 'h-10')}
      >
        <Share2 size={15} strokeWidth={1.75} />
        Share
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-40 w-56 max-w-[calc(100vw-24px)] rounded-[12px] bg-white p-1.5 shadow-[0_0_0_1px_rgb(15_23_42/0.08),0_16px_40px_-12px_rgb(15_23_42/0.3)]">
          <button role="menuitem" type="button" onClick={copy} className="flex min-h-[38px] w-full items-center gap-2.5 rounded-[8px] px-2.5 text-left text-[13.5px] text-slate-800 hover:bg-slate-50">
            {copied ? <Check size={15} strokeWidth={2} className="text-emerald-600" /> : <Link2 size={15} strokeWidth={1.75} className="text-slate-500" />}
            {copied ? 'Link copied' : 'Copy link (for Messenger)'}
          </button>
          {options.map((o) => (
            <a key={o.key} role="menuitem" href={o.href} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className="flex min-h-[38px] items-center rounded-[8px] px-2.5 text-[13.5px] text-slate-800 hover:bg-slate-50">
              {o.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
