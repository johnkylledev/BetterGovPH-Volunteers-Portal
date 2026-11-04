import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, X } from 'lucide-react';
import { SPECIALIZATIONS, ROLE_GROUPS } from '../constants/specializations';
import { usePopoverPlacement } from '../hooks/usePopoverPlacement';

/** Roles are stored as a comma-separated string in `rolesNeeded`, the same column old free-text calls use. */
export const parseRoles = (value?: string | null): string[] =>
  (value || '').split(',').map((r) => r.trim()).filter(Boolean);
const joinRoles = (roles: string[]) => roles.join(', ');

interface RolesNeededPickerProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  labelledBy?: string;
  disabled?: boolean;
}

const OPTIONS = ROLE_GROUPS.flatMap((g) =>
  SPECIALIZATIONS.filter((s) => (s.group ?? 'tech') === g.id).map((s) => ({ label: s.label, icon: s.icon, group: g.label }))
);

/** Multi-select of the same roles members pick at sign-up, so a call can be matched to the right people. */
export const RolesNeededPicker: React.FC<RolesNeededPickerProps> = ({ id, value, onChange, labelledBy, disabled }) => {
  const reduce = useReducedMotion();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const place = usePopoverPlacement(triggerRef, open, 340);

  const selected = parseRoles(value);
  const selectedSet = new Set(selected.map((r) => r.toLowerCase()));
  // Free-text roles from older calls stay visible and removable.
  const legacy = selected.filter((r) => !OPTIONS.some((o) => o.label.toLowerCase() === r.toLowerCase()));

  const rows = useMemo(() => {
    const out: ({ kind: 'group'; label: string } | { kind: 'option'; index: number })[] = [];
    let last = '';
    OPTIONS.forEach((o, index) => {
      if (o.group !== last) out.push({ kind: 'group', label: o.group });
      last = o.group;
      out.push({ kind: 'option', index });
    });
    return out;
  }, []);

  const toggle = (label: string) => {
    const has = selectedSet.has(label.toLowerCase());
    onChange(joinRoles(has ? selected.filter((r) => r.toLowerCase() !== label.toLowerCase()) : [...selected, label]));
  };

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const close = () => { setOpen(false); triggerRef.current?.focus(); };

  const onListKeyDown = (e: React.KeyboardEvent) => {
    const last = OPTIONS.length - 1;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(last, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(last); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(OPTIONS[active].label); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); } }}
        className={clsx('s-field flex h-11 w-full items-center gap-2 text-left text-[15px]', open && 'shadow-[0_0_0_3px_rgb(30_58_138/0.15)]')}
      >
        <span className={clsx('min-w-0 flex-1 truncate', selected.length === 0 && 'text-slate-400')}>
          {selected.length === 0 ? 'Any role' : `${selected.length} ${selected.length === 1 ? 'role' : 'roles'} selected`}
        </span>
        <ChevronDown size={16} strokeWidth={1.75} className={clsx('shrink-0 text-slate-400 transition-transform duration-200', open && 'rotate-180')} aria-hidden />
      </button>

      {selected.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Selected roles">
          {selected.map((r) => {
            const Icon = OPTIONS.find((o) => o.label.toLowerCase() === r.toLowerCase())?.icon;
            return (
              <li key={r} className="inline-flex h-7 items-center gap-1 rounded-full bg-[#eef3ff] pl-2 pr-1 text-[12.5px] font-medium text-[var(--accent)] shadow-[inset_0_0_0_1px_rgb(30_58_138/0.18)]">
                {Icon && <Icon size={13} strokeWidth={1.75} aria-hidden />}
                <span className={clsx(legacy.includes(r) && 'italic')}>{r}</span>
                <button
                  type="button"
                  onClick={() => toggle(r)}
                  disabled={disabled}
                  aria-label={`Remove ${r}`}
                  className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-[var(--accent)]/10"
                >
                  <X size={12} strokeWidth={2} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <AnimatePresence>
        {open && (
          <motion.ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-multiselectable="true"
            aria-labelledby={labelledBy}
            tabIndex={-1}
            aria-activedescendant={`${listId}-${active}`}
            onKeyDown={onListKeyDown}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: place.side === 'down' ? -4 : 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: place.side === 'down' ? -2 : 2, scale: 0.99 }}
            transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: place.side === 'down' ? 'top center' : 'bottom center', maxHeight: place.maxHeight }}
            className={clsx(
              'thin-scroll absolute left-0 right-0 z-50 min-w-[260px] overflow-y-auto overscroll-contain rounded-[14px] bg-white p-1.5 shadow-[0_0_0_1px_rgb(15_23_42/0.08),0_16px_40px_-12px_rgb(15_23_42/0.3)] focus:outline-none',
              place.side === 'down' ? 'top-[52px]' : 'bottom-[calc(100%+8px)]'
            )}
          >
            {rows.map((row) => {
              if (row.kind === 'group') {
                return (
                  <li key={`g-${row.label}`} role="presentation" className="sticky top-[-6px] z-10 -mx-1.5 bg-white/95 px-4 pb-1.5 pt-3 text-[11.5px] font-medium text-slate-400 backdrop-blur first:pt-1.5">
                    {row.label}
                  </li>
                );
              }
              const o = OPTIONS[row.index];
              const isOn = selectedSet.has(o.label.toLowerCase());
              const Icon = o.icon;
              return (
                <li
                  key={o.label}
                  id={`${listId}-${row.index}`}
                  data-index={row.index}
                  role="option"
                  aria-selected={isOn}
                  onMouseMove={() => active !== row.index && setActive(row.index)}
                  onClick={() => toggle(o.label)}
                  className={clsx(
                    'flex min-h-[38px] cursor-pointer items-center gap-3 rounded-[10px] px-2.5 transition-colors duration-100',
                    row.index === active && 'bg-slate-900/[0.05]'
                  )}
                >
                  <span
                    aria-hidden
                    className={clsx(
                      'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] transition-[background-color,box-shadow] duration-150',
                      isOn ? 'bg-[var(--accent)] text-white' : 'shadow-[inset_0_0_0_1.5px_rgb(148_163_184)]'
                    )}
                  >
                    {isOn && <Check size={12} strokeWidth={2.75} />}
                  </span>
                  <Icon size={16} strokeWidth={1.75} className={isOn ? 'text-[var(--accent)]' : 'text-slate-400'} aria-hidden />
                  <span className={clsx('min-w-0 flex-1 truncate text-[14px]', isOn ? 'font-medium text-slate-900' : 'text-slate-700')}>{o.label}</span>
                </li>
              );
            })}
            <li role="presentation" className="sticky bottom-[-6px] -mx-1.5 mt-1 flex justify-end border-t border-slate-100 bg-white px-2.5 pb-1.5 pt-2">
              <button type="button" onClick={close} className="s-btn s-btn-accent h-8 px-3 text-[13px]">Done</button>
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};
