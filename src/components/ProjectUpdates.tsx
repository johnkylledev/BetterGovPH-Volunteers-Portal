import React, { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteProjectUpdate, getProjectUpdates, postProjectUpdate } from '../services/supabase';
import type { ProjectUpdate } from '../types';
import { Avatar } from './Avatar';
import { timeAgo } from './RepoHealth';

/**
 * Short progress posts by the team (g0v: release early, release often). Most useful for projects with
 * no repository to track: a campaign, a research brief, a workshop series.
 */
export const ProjectUpdates: React.FC<{ projectId: string; canPost: boolean; canModerate: boolean }> = ({ projectId, canPost, canModerate }) => {
  const [updates, setUpdates] = useState<ProjectUpdate[] | null>(null);
  const [available, setAvailable] = useState(true);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getProjectUpdates(projectId)
      .then((r) => { setUpdates(r.updates); setAvailable(r.available !== false); })
      .catch(() => setUpdates([]));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  if (!available) return null;
  if (!canPost && updates && updates.length === 0) return null;

  return (
    <section className="s-card p-5 sm:p-6" aria-labelledby="updates-title">
      <h2 id="updates-title" className="text-[16px] font-semibold">Updates</h2>
      {canPost && (
        <form
          className="mt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (draft.trim().length < 2) return;
            setBusy(true);
            try { await postProjectUpdate(projectId, draft.trim()); setDraft(''); load(); }
            catch (err) { toast.error(err instanceof Error ? err.message : 'Couldn’t post'); }
            finally { setBusy(false); }
          }}
        >
          <label htmlFor={`upd-${projectId}`} className="sr-only">Post an update</label>
          <textarea
            id={`upd-${projectId}`}
            maxLength={2000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="s-field h-auto min-h-[84px] resize-y py-2.5 text-[14px]"
            placeholder="What moved this week? A milestone, a decision, what you need next…"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-[12px] text-slate-500">Public on this page. Keep personal details out.</p>
            <button type="submit" disabled={busy || draft.trim().length < 2} className="s-btn s-btn-accent h-9 px-3.5 text-[13px]">{busy ? 'Posting…' : 'Post update'}</button>
          </div>
        </form>
      )}
      {!updates ? (
        <p className="mt-4 text-[13px] text-slate-500" role="status">Loading…</p>
      ) : updates.length === 0 ? (
        <p className="mt-4 text-[13px] text-slate-500">No updates yet. The first one helps newcomers see where things stand.</p>
      ) : (
        <ol className="mt-4 space-y-4">
          {updates.map((u) => (
            <li key={u.id} className="flex gap-3">
              <Avatar name={u.author} seed={u.author} photos={[u.avatarUrl]} size={32} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[13px]">
                  <span className="font-medium text-slate-900">{u.author}</span>
                  <span className="text-slate-400">{timeAgo(u.createdAt)}</span>
                  {(u.mine || canModerate) && (
                    <button type="button" aria-label="Delete update" onClick={async () => { try { await deleteProjectUpdate(u.id); load(); } catch { toast.error('Couldn’t delete'); } }} className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-slate-300 hover:bg-slate-100 hover:text-slate-600">
                      <Trash2 size={13} strokeWidth={1.75} />
                    </button>
                  )}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-slate-700">{u.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
