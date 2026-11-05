import React from 'react';
import clsx from 'clsx';
import { CalendarClock, Clock3, MapPin, Sprout, Wifi } from 'lucide-react';
import type { CallType, VolunteerCall } from '../types';
import { SelectMenu } from './SelectMenu';
import { CALL_TYPES, COMMITMENTS, WORK_MODES, callTypeOf, commitmentLabel, neededByLabel, workModeLabel } from '../constants/community';

export interface CallExtras {
  callType: CallType;
  location: string;
  neededBy: string;
  commitment: string;
  workMode: string;
  goodFirst: boolean;
  chatUrl: string;
}
export const EMPTY_CALL_EXTRAS: CallExtras = { callType: 'people', location: '', neededBy: '', commitment: '', workMode: '', goodFirst: false, chatUrl: '' };
export const extrasFromCall = (c: VolunteerCall): CallExtras => ({
  callType: c.callType ?? 'people', location: c.location ?? '', neededBy: c.neededBy ?? '',
  commitment: c.commitment ?? '', workMode: c.workMode ?? '', goodFirst: !!c.goodFirst, chatUrl: c.chatUrl ?? '',
});

const labelClass = 'mb-1.5 block text-[13px] font-medium text-slate-900';

/** "What are you asking for?" — volunteers, or a venue, equipment, funding… */
export const CallTypePicker: React.FC<{ value: CallType; onChange: (t: CallType) => void; idPrefix: string; disabled?: boolean }> = ({ value, onChange, idPrefix, disabled }) => (
  <div>
    <p id={`${idPrefix}-type-label`} className={labelClass}>What are you asking for?</p>
    {/* Same language as the call filters: plain pills, the chosen one solid dark. */}
    <div role="radiogroup" aria-labelledby={`${idPrefix}-type-label`} className="flex flex-wrap gap-1.5">
      {CALL_TYPES.map((t) => {
        const on = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(t.id)}
            title={t.label}
            className={clsx(
              'inline-flex min-h-[36px] items-center gap-1.5 rounded-full pl-2.5 pr-3 text-[13px] transition-[background-color,box-shadow,color] duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 disabled:opacity-50',
              on
                ? 'bg-slate-900 font-medium text-white'
                : 'bg-white text-slate-600 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.12)] hover:text-slate-900 hover:shadow-[inset_0_0_0_1px_rgb(15_23_42/0.25)]'
            )}
          >
            <t.icon size={15} strokeWidth={on ? 2 : 1.75} className={on ? 'text-white' : 'text-slate-400'} aria-hidden />
            {t.short}
          </button>
        );
      })}
    </div>
  </div>
);

/** When, where, how much time — and whether a newcomer could take it. */
export const CallMetaFields: React.FC<{ value: CallExtras; onChange: (v: CallExtras) => void; idPrefix: string; disabled?: boolean }> = ({ value, onChange, idPrefix, disabled }) => {
  const set = (patch: Partial<CallExtras>) => onChange({ ...value, ...patch });
  const people = value.callType === 'people';
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor={`${idPrefix}-location`} className={labelClass}>Where <span className="font-normal text-slate-400">optional</span></label>
          <input id={`${idPrefix}-location`} maxLength={160} value={value.location} disabled={disabled} onChange={(e) => set({ location: e.target.value })} className="s-field" placeholder={people ? 'Online, or a city' : 'City or barangay'} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor={`${idPrefix}-needed`} className={labelClass}>Needed by <span className="font-normal text-slate-400">optional</span></label>
          <input id={`${idPrefix}-needed`} type="date" value={value.neededBy} disabled={disabled} onChange={(e) => set({ neededBy: e.target.value })} className="s-field" />
        </div>
      </div>
      {people && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label id={`${idPrefix}-commit-label`} htmlFor={`${idPrefix}-commit`} className={labelClass}>Time</label>
            <SelectMenu
              id={`${idPrefix}-commit`}
              labelledBy={`${idPrefix}-commit-label`}
              value={value.commitment}
              disabled={disabled}
              onChange={(v) => set({ commitment: v })}
              placeholder="Not sure"
              options={[{ value: '', label: 'Not sure' }, ...COMMITMENTS.map((c) => ({ value: c.id, label: c.label, hint: c.hint }))]}
            />
          </div>
          <div>
            <label id={`${idPrefix}-mode-label`} htmlFor={`${idPrefix}-mode`} className={labelClass}>Format</label>
            <SelectMenu
              id={`${idPrefix}-mode`}
              labelledBy={`${idPrefix}-mode-label`}
              value={value.workMode}
              disabled={disabled}
              onChange={(v) => set({ workMode: v })}
              placeholder="Any"
              align="right"
              options={[{ value: '', label: 'Any' }, ...WORK_MODES.map((m) => ({ value: m.id, label: m.label }))]}
            />
          </div>
        </div>
      )}
      <div>
        <label htmlFor={`${idPrefix}-chat`} className={labelClass}>Group chat link <span className="font-normal text-slate-400">optional</span></label>
        <input id={`${idPrefix}-chat`} type="url" inputMode="url" maxLength={300} value={value.chatUrl} disabled={disabled} onChange={(e) => set({ chatUrl: e.target.value })} className="s-field" placeholder="Messenger, WhatsApp, Viber, Telegram or Discord invite" />
        <p className="mt-1 text-[12px] text-slate-500">Signed-in members see it, so people can join without Discord.</p>
      </div>
      {people && (
        <label htmlFor={`${idPrefix}-first`} className="flex cursor-pointer items-start gap-3 rounded-[12px] bg-emerald-50/60 p-3 shadow-[inset_0_0_0_1px_rgb(16_185_129/0.2)]">
          <input id={`${idPrefix}-first`} type="checkbox" checked={value.goodFirst} disabled={disabled} onChange={(e) => set({ goodFirst: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
          <span className="min-w-0">
            <span className="block text-[13.5px] font-medium text-slate-900">Good first task</span>
            <span className="block text-[12.5px] leading-snug text-slate-600">Small, clearly described, and someone is there to help. Newcomers see these first — add a contact below.</span>
          </span>
        </label>
      )}
    </div>
  );
};

/** Badges on a call card: type (when it isn't people), newcomer-friendly, time, format, place, date. */
export const CallMeta: React.FC<{ call: VolunteerCall }> = ({ call }) => {
  const type = callTypeOf(call.callType);
  const due = neededByLabel(call);
  const items: { key: string; icon: React.ElementType; text: string }[] = [];
  if (call.commitment) items.push({ key: 'c', icon: Clock3, text: commitmentLabel(call.commitment) || '' });
  if (call.workMode) items.push({ key: 'm', icon: Wifi, text: workModeLabel(call.workMode) || '' });
  if (call.location) items.push({ key: 'l', icon: MapPin, text: call.location });
  if (due) items.push({ key: 'd', icon: CalendarClock, text: due });
  if (call.callType === 'people' && !call.goodFirst && !items.length) return null;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-1.5">
      {call.callType && call.callType !== 'people' && (
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[12px] font-medium text-violet-800 shadow-[inset_0_0_0_1px_rgb(124_58_237/0.18)]">
          <type.icon size={12} strokeWidth={2} aria-hidden />
          {type.label}
        </span>
      )}
      {call.goodFirst && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[12px] font-medium text-emerald-800 shadow-[inset_0_0_0_1px_rgb(16_185_129/0.25)]">
          <Sprout size={12} strokeWidth={2} aria-hidden />
          Good first task
        </span>
      )}
      {items.map((i) => (
        <span key={i.key} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[12px] text-slate-700">
          <i.icon size={12} strokeWidth={1.75} aria-hidden />
          {i.text}
        </span>
      ))}
    </p>
  );
};
