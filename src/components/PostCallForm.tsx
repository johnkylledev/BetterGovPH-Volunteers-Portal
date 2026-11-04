import React, { useState } from 'react';
import { toast } from 'sonner';
import { createVolunteerCall } from '../services/supabase';
import { callTypeOf } from '../constants/community';
import { CallMetaFields, CallTypePicker, EMPTY_CALL_EXTRAS, type CallExtras } from './CallFields';
import { RolesNeededPicker } from './RolesNeededPicker';

const labelClass = 'mb-1.5 block text-[13px] font-medium text-slate-900';

/** Post a call or request. Used in the admin Calls tab so admins can post without leaving the admin panel. */
export const PostCallForm: React.FC<{ idPrefix?: string; onPosted?: () => void; onCancel?: () => void }> = ({ idPrefix = 'pc', onPosted, onCancel }) => {
  const [title, setTitle] = useState('');
  const [projectUrl, setProjectUrl] = useState('');
  const [description, setDescription] = useState('');
  const [rolesNeeded, setRolesNeeded] = useState('');
  const [contact, setContact] = useState('');
  const [extras, setExtras] = useState<CallExtras>(EMPTY_CALL_EXTRAS);
  const [busy, setBusy] = useState(false);
  const type = callTypeOf(extras.callType);
  const isPeople = extras.callType === 'people';

  const reset = () => {
    setTitle(''); setProjectUrl(''); setDescription(''); setRolesNeeded(''); setContact(''); setExtras(EMPTY_CALL_EXTRAS);
  };

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || !description.trim() || (isPeople && !projectUrl.trim())) {
          toast.error(isPeople ? 'Title, project link and details are required.' : 'Title and details are required.');
          return;
        }
        if (isPeople && extras.goodFirst && !contact.trim() && !extras.chatUrl.trim()) {
          toast.error('Good first tasks need a contact or a group chat, so a newcomer knows who to ask.');
          return;
        }
        setBusy(true);
        try {
          await createVolunteerCall({
            title: title.trim(),
            projectUrl: projectUrl.trim(),
            description: description.trim(),
            rolesNeeded: isPeople ? rolesNeeded.trim() || undefined : undefined,
            contact: contact.trim() || undefined,
            callType: extras.callType,
            location: extras.location.trim() || undefined,
            neededBy: extras.neededBy || undefined,
            commitment: isPeople ? extras.commitment || undefined : undefined,
            workMode: isPeople ? extras.workMode || undefined : undefined,
            goodFirst: isPeople && extras.goodFirst,
            chatUrl: extras.chatUrl.trim() || undefined,
          });
          toast.success(isPeople ? 'Call posted' : 'Request posted');
          reset();
          onPosted?.();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Couldn’t post');
        } finally {
          setBusy(false);
        }
      }}
    >
      <CallTypePicker idPrefix={idPrefix} value={extras.callType} onChange={(t) => setExtras({ ...extras, callType: t })} disabled={busy} />
      <div>
        <label htmlFor={`${idPrefix}-title`} className={labelClass}>Title</label>
        <input id={`${idPrefix}-title`} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} className="s-field" placeholder={type.titlePlaceholder} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-url`} className={labelClass}>
          Project link {!isPeople && <span className="font-normal text-slate-400">optional</span>}
        </label>
        <input id={`${idPrefix}-url`} type="url" inputMode="url" value={projectUrl} onChange={(e) => setProjectUrl(e.target.value)} disabled={busy} className="s-field" placeholder="https://…" />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-desc`} className={labelClass}>Details</label>
        <textarea id={`${idPrefix}-desc`} maxLength={4000} value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} className="s-field h-auto min-h-[110px] resize-y py-2.5" placeholder={type.detailsPlaceholder} />
      </div>
      <CallMetaFields idPrefix={idPrefix} value={extras} onChange={setExtras} disabled={busy} />
      {isPeople && (
        <div>
          <label id={`${idPrefix}-roles-label`} htmlFor={`${idPrefix}-roles`} className={labelClass}>
            Roles needed <span className="font-normal text-slate-400">optional</span>
          </label>
          <RolesNeededPicker id={`${idPrefix}-roles`} labelledBy={`${idPrefix}-roles-label`} value={rolesNeeded} onChange={setRolesNeeded} disabled={busy} />
        </div>
      )}
      <div>
        <label htmlFor={`${idPrefix}-contact`} className={labelClass}>
          Contact <span className="font-normal text-slate-400">optional</span>
        </label>
        <input id={`${idPrefix}-contact`} maxLength={200} value={contact} onChange={(e) => setContact(e.target.value)} disabled={busy} className="s-field" placeholder="Discord handle, or a group chat link" />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onCancel && <button type="button" onClick={onCancel} className="s-btn s-btn-plain">Cancel</button>}
        <button type="submit" disabled={busy} className="s-btn s-btn-accent">{busy ? 'Posting…' : isPeople ? 'Post call' : 'Post request'}</button>
      </div>
    </form>
  );
};
