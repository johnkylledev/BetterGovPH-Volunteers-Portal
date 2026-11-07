import React, { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { Plus, Search, Trash2, UserMinus, X } from 'lucide-react';
import { toast } from 'sonner';
import type { User } from '../../types';
import { assignAdminRole, deleteAdminRole, getAdminRoles, getAllUsers, saveAdminRole, type AdminRoleRow } from '../../services/supabase';
import { ADMIN_PERMISSIONS, ROLE_PRESETS } from '../../utils/adminAccess';

type Draft = { id?: string; name: string; description: string; permissions: string[] };
const EMPTY: Draft = { name: '', description: '', permissions: [] };
const label = (p: string) => ADMIN_PERMISSIONS.find((x) => x.id === p)?.label ?? p;

/** Create a role with the permission boxes it needs, then add members who should hold it. */
const RoleEditor: React.FC<{ draft: Draft; busy: boolean; onChange: (d: Draft) => void; onSave: () => void; onCancel: () => void }> = ({ draft, busy, onChange, onSave, onCancel }) => {
  const toggle = (p: string) => onChange({ ...draft, permissions: draft.permissions.includes(p) ? draft.permissions.filter((x) => x !== p) : [...draft.permissions, p] });
  return (
    <form
      className="s-card space-y-5 p-5 sm:p-6"
      onSubmit={(e) => { e.preventDefault(); onSave(); }}
      aria-label={draft.id ? `Edit ${draft.name}` : 'New role'}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[16px] font-semibold">{draft.id ? `Edit ${draft.name || 'role'}` : 'New role'}</h3>
        <button type="button" aria-label="Close" onClick={onCancel} className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={17} strokeWidth={1.75} /></button>
      </div>
      {!draft.id && (
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-slate-900">Start from</p>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_PRESETS.map((p) => (
              <button key={p.name} type="button" onClick={() => onChange({ name: p.name, description: p.description, permissions: [...p.permissions] })}
                className="min-h-[32px] rounded-full bg-white px-3 text-[12.5px] text-slate-700 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.12)] hover:text-slate-900">
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="role-name" className="mb-1.5 block text-[13px] font-medium text-slate-900">Name</label>
          <input id="role-name" className="s-field" maxLength={40} value={draft.name} onChange={(e) => onChange({ ...draft, name: e.target.value })} placeholder="Legal" disabled={busy} />
        </div>
        <div>
          <label htmlFor="role-desc" className="mb-1.5 block text-[13px] font-medium text-slate-900">What it’s for <span className="font-normal text-slate-400">optional</span></label>
          <input id="role-desc" className="s-field" maxLength={200} value={draft.description} onChange={(e) => onChange({ ...draft, description: e.target.value })} placeholder="Data privacy requests and complaints" disabled={busy} />
        </div>
      </div>
      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-slate-900">This role can</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ADMIN_PERMISSIONS.map((p) => {
            const on = draft.permissions.includes(p.id);
            return (
              <label key={p.id} className={clsx('flex cursor-pointer items-start gap-3 rounded-[10px] px-3 py-2.5 transition-[background-color,box-shadow] duration-150',
                on ? 'bg-[#f4f7ff] shadow-[inset_0_0_0_1.5px_var(--accent)]' : 'bg-white shadow-[inset_0_0_0_1px_rgb(15_23_42/0.1)] hover:shadow-[inset_0_0_0_1px_rgb(15_23_42/0.22)]')}>
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={on} onChange={() => toggle(p.id)} disabled={busy} />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-medium text-slate-900">{p.label}</span>
                  <span className="block text-[12px] leading-snug text-slate-500">{p.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="mt-2.5 text-[12px] text-slate-500">Managing roles and admin rights always stays with super admins.</p>
      </fieldset>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="s-btn s-btn-plain" disabled={busy}>Cancel</button>
        <button type="submit" className="s-btn s-btn-accent" disabled={busy || draft.name.trim().length < 2 || draft.permissions.length === 0}>
          {busy ? 'Saving…' : draft.id ? 'Save changes' : 'Create role'}
        </button>
      </div>
    </form>
  );
};

/** Search approved members and give them this role. */
const AddMember: React.FC<{ role: AdminRoleRow; onAdded: () => void }> = ({ role, onAdded }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return; }
    const t = window.setTimeout(() => {
      getAllUsers(0, 6, { search: term, status: 'Approved' })
        .then((r) => setResults((r.users ?? []).filter((u) => !u.isAdmin && u.adminRoleId !== role.id)))
        .catch(() => setResults([]));
    }, 250);
    return () => window.clearTimeout(t);
  }, [q, role.id]);

  const add = async (u: User) => {
    setBusy(u.uid);
    try {
      await assignAdminRole(u.uid, role.id);
      toast.success(`${u.fullName} now has the ${role.name} role`);
      setQ(''); setResults([]); onAdded();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Couldn’t add that member'); }
    finally { setBusy(null); }
  };

  return (
    <div className="mt-3">
      <label htmlFor={`add-${role.id}`} className="sr-only">Add a member to {role.name}</label>
      <div className="relative">
        <Search size={15} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
        <input id={`add-${role.id}`} className="s-field pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a member: search name or email" autoComplete="off" />
      </div>
      {results.length > 0 && (
        <ul className="mt-1.5 overflow-hidden rounded-[10px] bg-white shadow-[0_0_0_1px_rgb(15_23_42/0.1),0_8px_20px_-10px_rgb(15_23_42/0.25)]">
          {results.map((u) => (
            <li key={u.uid}>
              <button type="button" disabled={!!busy} onClick={() => add(u)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] font-medium text-slate-900">{u.fullName}</span>
                  <span className="block truncate text-[12px] text-slate-500">{u.email}{u.adminRoleId ? ' · has another role (will be replaced)' : ''}</span>
                </span>
                <span className="shrink-0 text-[12.5px] font-medium text-[var(--accent)]">{busy === u.uid ? 'Adding…' : 'Add'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const AdminRoles: React.FC = () => {
  const [roles, setRoles] = useState<AdminRoleRow[] | null>(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setRoles((await getAdminRoles()).roles); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Couldn’t load roles'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await saveAdminRole({ id: draft.id, name: draft.name.trim(), description: draft.description.trim(), permissions: draft.permissions });
      toast.success(draft.id ? 'Role updated' : 'Role created');
      setDraft(null); load();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Couldn’t save the role'); }
    finally { setSaving(false); }
  };
  const remove = async (role: AdminRoleRow) => {
    try { await deleteAdminRole(role.id); toast.success(`${role.name} deleted`); setConfirmDelete(null); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Couldn’t delete the role'); }
  };
  const unassign = async (role: AdminRoleRow, m: AdminRoleRow['members'][number]) => {
    try { await assignAdminRole(m.uid, null); toast.success(`${m.name} no longer has the ${role.name} role`); load(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Couldn’t remove the role'); }
  };

  if (error) {
    return (
      <div className="s-card px-6 py-10 text-center">
        <p className="text-[15px] font-semibold">Couldn’t load roles</p>
        <p className="mt-1 text-[14px] text-slate-500">{error}</p>
        <button type="button" onClick={load} className="s-btn s-btn-plain mt-4">Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-xl text-[14px] text-slate-600">
          Give people only the admin tools they need. Someone with a role sees just those tabs and actions, and the server refuses everything else.
        </p>
        {!draft && (
          <button type="button" onClick={() => setDraft({ ...EMPTY })} className="s-btn s-btn-accent shrink-0"><Plus size={16} strokeWidth={2} />New role</button>
        )}
      </div>

      {draft && <RoleEditor draft={draft} busy={saving} onChange={setDraft} onSave={save} onCancel={() => setDraft(null)} />}

      {!roles ? (
        <div className="grid gap-4 md:grid-cols-2" aria-busy="true">{[0, 1].map((i) => <div key={i} className="s-card h-40" />)}</div>
      ) : roles.length === 0 ? (
        !draft && (
          <div className="s-card px-6 py-10 text-center">
            <p className="text-[15px] font-semibold">No roles yet</p>
            <p className="mt-1 text-[14px] text-slate-500">Create one, for example Legal, then add the people who should hold it.</p>
          </div>
        )
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {roles.map((r) => (
            <section key={r.id} className="s-card p-5" aria-labelledby={`role-${r.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 id={`role-${r.id}`} className="text-[16px] font-semibold text-slate-900">{r.name}</h3>
                  {r.description && <p className="mt-0.5 text-[13px] text-slate-500">{r.description}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => setDraft({ id: r.id, name: r.name, description: r.description, permissions: [...r.permissions] })} className="s-btn s-btn-plain h-8 px-3 text-[13px]">Edit</button>
                  <button type="button" aria-label={`Delete ${r.name}`} onClick={() => setConfirmDelete(r.id)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} strokeWidth={1.75} /></button>
                </div>
              </div>
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Permissions">
                {r.permissions.map((p) => <li key={p} className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] text-slate-700">{label(p)}</li>)}
              </ul>
              {confirmDelete === r.id && (
                <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-red-50 px-3 py-2.5 text-[13px] text-red-800">
                  <span>Delete {r.name}? {r.members.length ? `${r.members.length} ${r.members.length === 1 ? 'person loses' : 'people lose'} these tools at once.` : ''}</span>
                  <span className="flex gap-1.5">
                    <button type="button" onClick={() => setConfirmDelete(null)} className="s-btn s-btn-plain h-8 px-3 text-[12.5px]">Keep</button>
                    <button type="button" onClick={() => remove(r)} className="s-btn h-8 bg-red-600 px-3 text-[12.5px] text-white hover:bg-red-700">Delete</button>
                  </span>
                </div>
              )}
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-[12.5px] font-medium text-slate-500">{r.members.length ? `${r.members.length} ${r.members.length === 1 ? 'person' : 'people'}` : 'Nobody has this role yet'}</p>
                {r.members.length > 0 && (
                  <ul className="mt-2 divide-y divide-slate-100">
                    {r.members.map((m) => (
                      <li key={m.uid} className="flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-medium text-slate-900">{m.name}</span>
                          <span className="block truncate text-[12px] text-slate-500">{m.email}</span>
                        </span>
                        <button type="button" onClick={() => unassign(r, m)} aria-label={`Remove ${m.name} from ${r.name}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"><UserMinus size={15} strokeWidth={1.75} /></button>
                      </li>
                    ))}
                  </ul>
                )}
                <AddMember role={r} onAdded={load} />
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
