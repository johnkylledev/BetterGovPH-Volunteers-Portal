import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { usePopoverPlacement } from '../hooks/usePopoverPlacement';

export interface SelectOption {
  value: string;
  label: string;
  icon?: LucideIcon;
  /** Short secondary line under the label. */
  hint?: string;
  /** Options sharing a group are listed under that heading, in first-seen order. */
  group?: string;
}

interface SelectMenuProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  /** id of the visible <label>, for the listbox's accessible name. */
  labelledBy?: string;
  className?: string;
  disabled?: boolean;
  /** sm: compact trigger for filter bars. */
  size?: 'sm' | 'md';
  /** Which edge the menu lines up with; use right for controls near the right edge. */
  align?: 'left' | 'right';
  /** Accessible name when there is no visible label. */
  ariaLabel?: string;
}

/** A styled replacement for <select>: grouped options with icons and hints, full keyboard support. */
export const SelectMenu: React.FC<SelectMenuProps> = ({
  id, value, onChange, options, placeholder = 'Select…', labelledBy, className, disabled, size = 'md', align = 'left', ariaLabel,
}) => {
  const reduce = useReducedMotion();
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const place = usePopoverPlacement(triggerRef, open);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  // Group headings appear before the first option of each group.
  const rows = useMemo(() => {
    const out: ({ kind: 'group'; label: string } | { kind: 'option'; option: SelectOption; index: number })[] = [];
    let last: string | undefined;
    options.forEach((option, index) => {
      if (option.group && option.group !== last) out.push({ kind: 'group', label: option.group });
      last = option.group;
      out.push({ kind: 'option', option, index });
    });
    return out;
  }, [options]);

  const openMenu = () => {
    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };
  const choose = (i: number) => {
    const o = options[i];
    if (!o) return;
    onChange(o.value);
    close();
  };

  useEffect(() => {
    if (!open) return;
    document.getElementById(listId)?.focus();
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open, listId]);

  // Keep the highlighted option in view while moving with the keyboard.
  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(listId)?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, listId]);

  const onListKeyDown = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(last, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(last); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { setOpen(false); }
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      // Type-ahead: jump to the first option starting with what's been typed.
      const now = Date.now();
      typed.current.text = (now - typed.current.at > 600 ? '' : typed.current.text) + e.key.toLowerCase();
      typed.current.at = now;
      const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    }
  };

  const SelectedIcon = selected?.icon;

  return (
    <div ref={rootRef} className={clsx('relative', className)}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openMenu(); }
        }}
        className={clsx(
          's-field flex w-full items-center gap-2.5 text-left disabled:cursor-not-allowed disabled:opacity-60',
          size === 'sm' ? 'h-9 text-[13px]' : 'h-11 text-[15px]',
          open && 'shadow-[0_0_0_3px_rgb(30_58_138/0.15)]'
        )}
      >
        {SelectedIcon && <SelectedIcon size={17} strokeWidth={1.75} className="shrink-0 text-[var(--accent)]" aria-hidden />}
        <span className={clsx('min-w-0 flex-1 truncate', !selected && 'text-slate-400')}>{selected?.label ?? placeholder}</span>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className={clsx('shrink-0 text-slate-400 transition-transform duration-200', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={labelledBy}
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            onKeyDown={onListKeyDown}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: place.side === 'down' ? -4 : 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: place.side === 'down' ? -2 : 2, scale: 0.99 }}
            transition={{ duration: 0.14, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: place.side === 'down' ? 'top center' : 'bottom center', maxHeight: place.maxHeight }}
            className={clsx(
              align === 'right' ? 'right-0' : 'left-0',
              'thin-scroll absolute z-50 w-full min-w-[260px] overflow-y-auto overscroll-contain rounded-[14px] bg-white p-1.5 shadow-[0_0_0_1px_rgb(15_23_42/0.08),0_16px_40px_-12px_rgb(15_23_42/0.3)] focus:outline-none',
              place.side === 'down' ? 'top-full mt-2' : 'bottom-full mb-2'
            )}
          >
            {rows.map((row) =>
              row.kind === 'group' ? (
                <li
                  key={`g-${row.label}`}
                  role="presentation"
                  className="sticky top-[-6px] z-10 -mx-1.5 bg-white/95 px-4 pb-1.5 pt-3 text-[11.5px] font-medium text-slate-400 backdrop-blur first:pt-1.5"
                >
                  {row.label}
                </li>
              ) : (
                (() => {
                  const { option: o, index: i } = row;
                  const isSelected = o.value === value;
                  const isActive = i === active;
                  const Icon = o.icon;
                  return (
                    <li
                      key={o.value}
                      id={`${listId}-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={isSelected}
                      onMouseMove={() => active !== i && setActive(i)}
                      onClick={() => choose(i)}
                      className={clsx(
                        'flex min-h-[40px] cursor-pointer items-center gap-3 rounded-[10px] px-2.5 py-1.5 transition-colors duration-100',
                        isActive ? 'bg-slate-900/[0.05]' : '',
                        isSelected && 'bg-[#f4f7ff]'
                      )}
                    >
                      {Icon && (
                        <Icon
                          size={17}
                          strokeWidth={1.75}
                          className={clsx('shrink-0', isSelected ? 'text-[var(--accent)]' : 'text-slate-400')}
                          aria-hidden
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className={clsx('block truncate text-[14px]', isSelected ? 'font-medium text-slate-900' : 'text-slate-700')}>
                          {o.label}
                        </span>
                        {o.hint && <span className="block truncate text-[12px] text-slate-400">{o.hint}</span>}
                      </span>
                      {isSelected && <Check size={16} strokeWidth={2.25} className="shrink-0 text-[var(--accent)]" aria-hidden />}
                    </li>
                  );
                })()
              )
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};
