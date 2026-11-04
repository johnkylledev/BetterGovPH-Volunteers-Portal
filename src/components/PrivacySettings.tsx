import React, { useState } from 'react';
import clsx from 'clsx';
import { Download, Eye, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { User } from '../types';
import { createOrUpdateUserRecord, exportMyData } from '../services/supabase';
import { CONSENT_VERSION, type ConsentPurposeId } from '../constants/community';
import { ConsentFields, requiredConsentMissing } from './ConsentFields';

/** Mirrors the server's redaction so members see exactly what the public sees. */
export const redactName = (full: string) => {
  const [first, ...rest] = full.trim().split(/\s+/).filter(Boolean);
  if (!first) return 'Member';
  return [first, ...rest.map((w) => `${(Array.from(w)[0] || '').toUpperCase()}****`)].join(' ');
};

const Switch: React.FC<{ id: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string; hint: string }> = ({
  id, checked, onChange, disabled, label, hint,
}) => (
  <div className="flex items-start justify-between gap-4 py-3.5">
    <div className="min-w-0">
      <label htmlFor={id} className="text-[14px] font-medium text-slate-900">{label}</label>
      <p id={`${id}-hint`} className="mt-0.5 text-[12.5px] leading-snug text-slate-500">{hint}</p>
    </div>
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={`${id}-hint`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:opacity-50',
        checked ? 'bg-[var(--accent)]' : 'bg-slate-300'
      )}
    >
      <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgb(15_23_42/0.3)] transition-[left] duration-200', checked ? 'left-[18px]' : 'left-0.5')} />
    </button>
  </div>
);

export const PrivacySettings: React.FC<{ user: User; onSaved: (u: User) => void }> = ({ user, onSaved }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [consentDraft, setConsentDraft] = useState<ConsentPurposeId[]>(['membership', 'matching']);
  const [consentError, setConsentError] = useState('');
  const [confirm, setConfirm] = useState<'withdraw' | 'delete' | null>(null);

  const purposes = (user.consentPurposes ?? []) as ConsentPurposeId[];
  const hasConsent = !!user.consentAt && purposes.includes('membership');
  const inDirectory = user.showInDirectory !== false;
  const fullName = user.showFullName === true;
  const publicName = user.displayName?.trim() || (fullName ? user.fullName : redactName(user.fullName || ''));

  const save = async (key: string, patch: Record<string, unknown>, ok: string) => {
    setBusy(key);
    try {
      const saved = await createOrUpdateUserRecord(patch);
      if (saved) onSaved({ ...user, ...saved });
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t save that change');
    } finally {
      setBusy(null);
    }
  };

  const downloadMyData = async () => {
    setBusy('export');
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bettergovph-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Couldn’t prepare your data. Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {!hasConsent && (
        <div className="rounded-[14px] bg-amber-50/70 p-4 shadow-[inset_0_0_0_1px_rgb(245_158_11/0.3)] sm:p-5">
          <p className="text-[15px] font-semibold text-slate-900">Review how we use your information</p>
          <p className="mb-4 mt-0.5 text-[13px] text-slate-600">We need your go-ahead under the Data Privacy Act to keep running your membership.</p>
          <ConsentFields value={consentDraft} onChange={(v) => { setConsentDraft(v); setConsentError(''); }} error={consentError} idPrefix="profile-consent" />
          <button
            type="button"
            className="s-btn s-btn-accent mt-4"
            disabled={busy === 'consent'}
            onClick={() => {
              if (requiredConsentMissing(consentDraft)) { setConsentError('The two required items are needed to stay a member.'); return; }
              save('consent', { consent: { version: CONSENT_VERSION, purposes: consentDraft } }, 'Thanks — your choices are saved');
            }}
          >
            {busy === 'consent' ? 'Saving…' : 'Save my choices'}
          </button>
        </div>
      )}

      <div>
        <div className="mb-1 flex items-center gap-2 rounded-[12px] bg-slate-50 px-3.5 py-3 text-[13px] text-slate-600 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.05)]">
          <Eye size={15} strokeWidth={1.75} className="shrink-0 text-slate-400" aria-hidden />
          <span className="min-w-0">
            The public sees you as <span className="font-semibold text-slate-900">{inDirectory || user.memberId ? publicName : '—'}</span>
            {!inDirectory && <span className="text-slate-500"> on your card only (not listed in the directory)</span>}
          </span>
        </div>
        <div className="divide-y divide-slate-200/80">
          <Switch
            id="pv-directory"
            checked={inDirectory}
            disabled={busy !== null || !hasConsent}
            onChange={(v) => save('directory', { showInDirectory: v }, v ? 'You’re listed in the directory' : 'You’re hidden from the directory')}
            label="List me in the Volunteers directory"
            hint="Your roles and top skills, with the name shown above. Never your email or links."
          />
          <Switch
            id="pv-fullname"
            checked={fullName}
            disabled={busy !== null}
            onChange={(v) => save('fullname', { showFullName: v }, v ? 'Your full name is now public' : 'Your name is redacted publicly')}
            label="Show my full name publicly"
            hint={user.displayName ? 'You use a display name, so this only matters if you clear it. Admins always see your full name.' : 'Off: “Juan D****” on the directory, your card’s verify page and team pages. Admins always see your full name.'}
          />
          <Switch
            id="pv-comms"
            checked={purposes.includes('communications')}
            disabled={busy !== null || !hasConsent}
            onChange={(v) => save('comms', {
              consent: { version: CONSENT_VERSION, purposes: v ? Array.from(new Set([...purposes, 'communications'])) : purposes.filter((p) => p !== 'communications') },
            }, 'Saved')}
            label="Contact me about projects and events"
            hint="Occasional messages about calls that fit you and community events."
          />
        </div>
      </div>

      <div className="rounded-[14px] bg-white p-4 shadow-[0_0_0_1px_rgb(15_23_42/0.1)] sm:p-5">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-slate-900">
          <ShieldCheck size={16} strokeWidth={1.75} className="text-[var(--accent)]" aria-hidden />
          Your data rights
        </p>
        <p className="mt-1 text-[12.5px] leading-snug text-slate-500">
          {hasConsent
            ? <>Consent given {new Date(user.consentAt!).toLocaleDateString(undefined, { dateStyle: 'medium' })} (notice {user.consentVersion}).</>
            : 'No consent on record yet.'}{' '}
          Under the Data Privacy Act you can access, correct, download or erase your data, and complain to the National Privacy Commission.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={downloadMyData} disabled={busy !== null} className="s-btn s-btn-plain h-10">
            <Download size={15} strokeWidth={1.75} />
            {busy === 'export' ? 'Preparing…' : 'Download my data'}
          </button>
          {hasConsent && (
            <button type="button" onClick={() => setConfirm('withdraw')} disabled={busy !== null} className="s-btn s-btn-plain h-10">
              Withdraw consent
            </button>
          )}
          {user.deletionRequestedAt ? (
            <button type="button" disabled={busy !== null} onClick={() => save('delete', { requestDeletion: false }, 'Deletion request cancelled')} className="s-btn s-btn-plain h-10">
              Cancel deletion request
            </button>
          ) : (
            <button type="button" onClick={() => setConfirm('delete')} disabled={busy !== null} className="s-btn s-btn-plain h-10 text-red-700">
              <Trash2 size={15} strokeWidth={1.75} />
              Delete my account
            </button>
          )}
        </div>
        {user.deletionRequestedAt && (
          <p className="mt-3 text-[12.5px] text-amber-800">
            Deletion requested {new Date(user.deletionRequestedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}. An admin will remove your data, usually within 15 days, and you’re already hidden from the directory.
          </p>
        )}

        {confirm && (
          <div role="alertdialog" aria-labelledby="pv-confirm-title" className="mt-4 rounded-[12px] bg-red-50/70 p-4 shadow-[inset_0_0_0_1px_rgb(254_202_202)]">
            <p id="pv-confirm-title" className="text-[14px] font-semibold text-slate-900">
              {confirm === 'withdraw' ? 'Withdraw your consent?' : 'Ask us to delete your account?'}
            </p>
            <p className="mt-1 text-[13px] text-slate-600">
              {confirm === 'withdraw'
                ? 'We’ll stop using your information for matching and hide you everywhere public. Without consent we can’t keep your membership active.'
                : 'Your profile, links, calls, team memberships and Volunteer Card will be removed. Projects already published may stay under the team.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="s-btn h-9 bg-red-600 px-3.5 text-white [@media(hover:hover)]:hover:bg-red-700"
                disabled={busy !== null}
                onClick={async () => {
                  const which = confirm;
                  setConfirm(null);
                  if (which === 'withdraw') await save('withdraw', { consent: { withdraw: true } }, 'Consent withdrawn');
                  else await save('delete', { requestDeletion: true }, 'Deletion requested');
                }}
              >
                {confirm === 'withdraw' ? 'Withdraw' : 'Request deletion'}
              </button>
              <button type="button" className="s-btn s-btn-plain h-9" onClick={() => setConfirm(null)}>Keep my account</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
