import React, { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';

const COMPACT_QUERY = '(max-width: 1023px)';

/** True below the lg breakpoint, where side-column forms turn into bottom sheets. */
export const useCompactLayout = () => {
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.matchMedia(COMPACT_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(COMPACT_QUERY);
    const on = () => setCompact(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return compact;
};

interface FormSheetProps {
  /** Phone/tablet layout: floating button + bottom sheet. Otherwise an inline card. */
  compact: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Label on the floating button. */
  actionLabel: string;
  /** Classes for the inline (desktop) section. */
  className?: string;
  children: React.ReactNode;
}

/**
 * A form that sits in a sticky side card on desktop and, on smaller screens, opens from a floating
 * button as a bottom sheet, so the list it belongs to comes first.
 */
export const FormSheet: React.FC<FormSheetProps> = ({ compact, open, onOpenChange, title, actionLabel, className, children }) => {
  const titleId = useId();

  useEffect(() => {
    if (!compact && open) onOpenChange(false);
  }, [compact, open, onOpenChange]);

  useEffect(() => {
    if (!compact || !open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [compact, open, onOpenChange]);

  if (!compact) {
    return (
      <section className={className} aria-labelledby={titleId}>
        <div className="s-card p-5 sm:p-6 lg:sticky lg:top-24">
          <h2 id={titleId} className="text-[16px] font-semibold">{title}</h2>
          {children}
        </div>
      </section>
    );
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="s-btn s-btn-accent fixed bottom-[max(16px,env(safe-area-inset-bottom))] right-4 z-40 h-12 rounded-full px-5 shadow-[0_10px_28px_-8px_rgb(30_58_138/0.55)]"
        >
          <Plus size={18} strokeWidth={2} />
          {actionLabel}
        </button>
      )}
      {open && createPortal(
        // `.site` carries the design tokens; the portal escapes the header's backdrop-filter containing block.
        <div className="site" style={{ background: 'transparent' }}>
          <div className="fixed inset-0 z-[55] bg-slate-900/40" aria-hidden onClick={() => onOpenChange(false)} />
          <section role="dialog" aria-modal="true" aria-labelledby={titleId} className="fixed inset-x-0 bottom-0 z-[60] flex max-h-[90dvh] flex-col">
            <div className="thin-scroll overflow-y-auto overscroll-contain rounded-t-[20px] bg-white px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_-12px_rgb(15_23_42/0.35)]">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" aria-hidden />
              <div className="flex items-center justify-between gap-3">
                <h2 id={titleId} className="text-[16px] font-semibold">{title}</h2>
                <button type="button" aria-label="Close" onClick={() => onOpenChange(false)} className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <X size={18} strokeWidth={1.75} />
                </button>
              </div>
              {children}
            </div>
          </section>
        </div>,
        document.body
      )}
    </>
  );
};
