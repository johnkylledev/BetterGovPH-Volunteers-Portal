import React, { useState } from 'react';
import { toast } from 'sonner';
import type { ProjectSubmission } from '../types';
import { resubmitProject } from '../services/supabase';

/** Inline "edit and resubmit" for a project an admin sent back. */
export const ResubmitProject: React.FC<{ submission: ProjectSubmission; onDone: () => void }> = ({ submission, onDone }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    projectName: submission.projectName, projectUrl: submission.projectUrl,
    description: submission.description, repoUrl: submission.repoUrl || '',
  });
  const id = `resub-${submission.id}`;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="s-btn s-btn-accent mt-3 h-9 px-3.5 text-[13px]">
        Edit and resubmit
      </button>
    );
  }
  return (
    <form
      className="mt-3 space-y-3 rounded-[12px] bg-slate-50 p-3.5 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.06)]"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!f.projectName.trim() || !f.projectUrl.trim() || !f.description.trim()) { toast.error('Name, link and description are required.'); return; }
        setBusy(true);
        try {
          await resubmitProject(submission.id, { ...f, repoUrl: f.repoUrl.trim() });
          toast.success('Sent back for review');
          setOpen(false);
          onDone();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Couldn’t resubmit');
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <label htmlFor={`${id}-name`} className="mb-1 block text-[12.5px] font-medium text-slate-800">Name</label>
        <input id={`${id}-name`} maxLength={160} value={f.projectName} onChange={(e) => setF({ ...f, projectName: e.target.value })} className="s-field h-10 text-[14px]" />
      </div>
      <div>
        <label htmlFor={`${id}-url`} className="mb-1 block text-[12.5px] font-medium text-slate-800">Link</label>
        <input id={`${id}-url`} type="url" inputMode="url" value={f.projectUrl} onChange={(e) => setF({ ...f, projectUrl: e.target.value })} className="s-field h-10 text-[14px]" />
      </div>
      <div>
        <label htmlFor={`${id}-repo`} className="mb-1 block text-[12.5px] font-medium text-slate-800">GitHub repository <span className="font-normal text-slate-400">optional</span></label>
        <input id={`${id}-repo`} type="url" inputMode="url" value={f.repoUrl} onChange={(e) => setF({ ...f, repoUrl: e.target.value })} className="s-field h-10 text-[14px]" placeholder="https://github.com/owner/repo" />
      </div>
      <div>
        <label htmlFor={`${id}-desc`} className="mb-1 block text-[12.5px] font-medium text-slate-800">Description</label>
        <textarea id={`${id}-desc`} maxLength={4000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="s-field h-auto min-h-[100px] resize-y py-2 text-[14px]" />
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="s-btn s-btn-accent h-9 flex-1 text-[13px]">{busy ? 'Sending…' : 'Resubmit for review'}</button>
        <button type="button" onClick={() => setOpen(false)} className="s-btn s-btn-plain h-9 text-[13px]">Cancel</button>
      </div>
    </form>
  );
};
