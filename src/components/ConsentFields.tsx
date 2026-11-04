import React from 'react';
import clsx from 'clsx';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CONSENT_PURPOSES, type ConsentPurposeId } from '../constants/community';

interface ConsentFieldsProps {
  value: ConsentPurposeId[];
  onChange: (next: ConsentPurposeId[]) => void;
  error?: string;
  idPrefix?: string;
}

/**
 * One unticked box per purpose (RA 10173: consent must be specific and informed; NPC Circular 2023-04
 * rules out pre-ticked boxes). The two required ones are needed to run a membership at all.
 */
export const ConsentFields: React.FC<ConsentFieldsProps> = ({ value, onChange, error, idPrefix = 'consent' }) => {
  const toggle = (id: ConsentPurposeId) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <fieldset aria-describedby={error ? `${idPrefix}-error` : undefined}>
      <legend className="sr-only">How we may use your information</legend>
      <ul className="space-y-2">
        {CONSENT_PURPOSES.map((p) => {
          const checked = value.includes(p.id);
          const id = `${idPrefix}-${p.id}`;
          return (
            <li key={p.id}>
              <label
                htmlFor={id}
                className={clsx(
                  'flex cursor-pointer items-start gap-3 rounded-[12px] p-3 transition-[background-color,box-shadow] duration-150',
                  checked ? 'bg-[#f5f8ff] shadow-[inset_0_0_0_1.5px_rgb(30_58_138/0.3)]' : 'bg-white shadow-[inset_0_0_0_1px_rgb(15_23_42/0.1)] hover:bg-slate-50'
                )}
              >
                <input id={id} type="checkbox" className="peer sr-only" checked={checked} onChange={() => toggle(p.id)} />
                <span
                  aria-hidden
                  className={clsx(
                    'mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--accent)] peer-focus-visible:ring-offset-2',
                    checked ? 'bg-[var(--accent)] text-white' : 'bg-white shadow-[inset_0_0_0_1.5px_rgb(100_116_139/0.6)]'
                  )}
                >
                  {checked && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2 text-[14px] font-medium text-slate-900">
                    {p.label}
                    <span className={clsx('rounded-full px-1.5 py-px text-[10.5px] font-medium', p.required ? 'bg-slate-900/5 text-slate-600' : 'bg-slate-100 text-slate-500')}>
                      {p.required ? 'Required' : 'Optional'}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-slate-500">{p.detail}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {error && <p id={`${idPrefix}-error`} role="alert" className="mt-2 text-[12.5px] text-red-700">{error}</p>}
      <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
        You can change these, download your data or ask us to delete it any time from Profile → Privacy. Details in our{' '}
        <Link to="/privacy" className="s-link">Privacy notice</Link>.
      </p>
    </fieldset>
  );
};

export const requiredConsentMissing = (value: string[]) =>
  CONSENT_PURPOSES.filter((p) => p.required).some((p) => !value.includes(p.id));
