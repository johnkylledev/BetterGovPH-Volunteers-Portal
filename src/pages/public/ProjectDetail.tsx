import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, ArrowUpRight, Building2, Crown, MessageCircle, UserMinus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { SiteLayout } from '../../components/site/SiteLayout';
import { Avatar } from '../../components/Avatar';
import { RepoPanel } from '../../components/RepoHealth';
import { ReportButton } from '../../components/ReportButton';
import { SelectMenu } from '../../components/SelectMenu';
import { setReturnTo } from '../../utils/returnTo';
import { ShareButton } from '../../components/ShareButton';
import { ProjectUpdates } from '../../components/ProjectUpdates';
import { HoursToConfirm, LogHoursForm } from '../../components/VolunteerHours';
import { STAGES } from '../../constants/community';
import { availabilitySummary } from '../../constants/community';
import { getRepoStats, getTeam, teamAction, type TeamAction } from '../../services/supabase';
import { useStore } from '../../store/useStore';
import { stageLabel } from '../../constants/community';
import { workTypeLabel } from '../../constants/tracks';
import type { TeamInfo } from '../../types';

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

export default function ProjectDetail() {
  const { id = '' } = useParams();
  const sessionUserId = useStore((s) => s.sessionUserId);
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [busy, setBusy] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinRole, setJoinRole] = useState('');
  const [joinMessage, setJoinMessage] = useState('');
  const [ownerMode, setOwnerMode] = useState<'member' | 'org'>('member');
  const [ownerUserId, setOwnerUserId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [chatDraft, setChatDraft] = useState('');

  const load = useCallback(async () => {
    try {
      const t = await getTeam(id);
      setTeam(t);
      setState('ready');
      setOwnerMode(t.owner?.type === 'org' ? 'org' : 'member');
      setOwnerName(t.owner?.type === 'org' ? t.owner.name : '');
      setOwnerUserId(t.owner?.userId || '');
      setChatDraft(t.project.chatUrl || '');
      // No stats yet, or older than 6 hours: ask the tracker (it refreshes from GitHub and stores them).
      const repo = t.project.repo;
      const stale = !repo || Date.now() - new Date(repo.checkedAt).getTime() > 6 * 3600 * 1000;
      if (t.project.repoUrl && t.project.status.toLowerCase() === 'approved' && stale) {
        getRepoStats([String(t.project.id)]).then((map) => {
          const fresh = map[String(t.project.id)];
          if (fresh) setTeam((cur) => (cur ? { ...cur, project: { ...cur.project, repo: fresh } } : cur));
        }).catch(() => {});
      }
    } catch (err) {
      setState(err instanceof Error && /not found/i.test(err.message) ? 'missing' : 'error');
    }
  }, [id]);

  useEffect(() => { load(); }, [load, sessionUserId]);

  const act = async (key: string, body: TeamAction, ok: string) => {
    setBusy(key);
    try {
      await teamAction(id, body);
      toast.success(ok);
      await load();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (state === 'loading') {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-5xl px-4 pb-20 pt-14 sm:px-6" aria-busy="true">
          <div className="h-8 w-1/2 rounded bg-slate-100" />
          <div className="mt-3 h-4 w-2/3 rounded bg-slate-100" />
          <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="s-card h-64" />
            <div className="s-card h-64" />
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (state !== 'ready' || !team) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-xl px-4 pb-20 pt-20 text-center sm:px-6">
          <h1 className="text-[24px]">{state === 'missing' ? 'Project not found' : 'Couldn’t load this project'}</h1>
          <p className="mt-2 text-[15px] text-[var(--fg-3)]">
            {state === 'missing' ? 'It may still be in review, or the link is wrong.' : 'Check your connection and try again.'}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            {state === 'error' && <button type="button" onClick={() => { setState('loading'); load(); }} className="s-btn s-btn-plain">Try again</button>}
            <Link to="/projects" className="s-btn s-btn-accent">All projects</Link>
          </div>
        </div>
      </SiteLayout>
    );
  }

  const { project, members, me, requests, owner } = team;
  const canManage = !!me?.canManage;
  const approved = project.status.toLowerCase() === 'approved';
  const onTeam = !!me && (me.isHead || me.status === 'approved');
  const shareUrl = `${window.location.origin}/projects/${encodeURIComponent(String(project.id))}`;
  const myStatus = me?.status ?? null;

  const joinBox = (() => {
    if (!team.available) return <p className="text-[13px] text-slate-500">Team sign-ups open soon.</p>;
    if (!approved) return <p className="text-[13px] text-slate-500">This project is still in review. Team sign-ups open once it’s approved.</p>;
    if (!sessionUserId) {
      return (
        <Link to="/login" onClick={() => setReturnTo(`/projects/${encodeURIComponent(id)}`)} className="s-btn s-btn-accent h-11 w-full">
          Sign in to join the team
        </Link>
      );
    }
    if (me?.isHead) return <p className="text-[13px] text-slate-600">You lead this team. Requests to join show up below.</p>;
    if (myStatus === 'approved') {
      return (
        <button type="button" disabled={busy !== null} onClick={() => act('leave', { action: 'leave' }, 'You left the team')} className="s-btn s-btn-plain h-10 w-full">
          Leave team
        </button>
      );
    }
    if (myStatus === 'pending') {
      return (
        <div>
          <p className="flex items-center gap-2 text-[14px] font-medium text-slate-900">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
            Request sent
          </p>
          <p className="mt-0.5 text-[13px] text-slate-500">The team head will review it. You’ll see the result here and on your dashboard.</p>
          <button type="button" disabled={busy !== null} onClick={() => act('cancel', { action: 'cancel' }, 'Request withdrawn')} className="s-btn s-btn-plain mt-3 h-9 text-[13px]">
            Withdraw request
          </button>
        </div>
      );
    }
    if (!me?.approvedMember) {
      return <p className="text-[13px] text-slate-500">You can join teams once your membership is approved.</p>;
    }
    if (!joinOpen) {
      return (
        <button type="button" onClick={() => setJoinOpen(true)} className="s-btn s-btn-accent h-11 w-full">
          <Users size={16} strokeWidth={1.75} />
          {myStatus === 'declined' ? 'Ask again to join' : 'Ask to join'}
        </button>
      );
    }
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const ok = await act('join', { action: 'join', teamRole: joinRole.trim() || undefined, message: joinMessage.trim() || undefined }, 'Request sent to the team head');
          if (ok) { setJoinOpen(false); setJoinMessage(''); setJoinRole(''); }
        }}
        className="space-y-3"
      >
        <div>
          <label htmlFor="join-role" className="mb-1.5 block text-[13px] font-medium text-slate-900">What would you do? <span className="font-normal text-slate-400">optional</span></label>
          <input id="join-role" maxLength={80} value={joinRole} onChange={(e) => setJoinRole(e.target.value)} className="s-field" placeholder="Frontend, video editing, research…" />
        </div>
        <div>
          <label htmlFor="join-msg" className="mb-1.5 block text-[13px] font-medium text-slate-900">Note to the team head <span className="font-normal text-slate-400">optional</span></label>
          <textarea id="join-msg" maxLength={500} value={joinMessage} onChange={(e) => setJoinMessage(e.target.value)} className="s-field h-auto min-h-[84px] resize-y py-2.5" placeholder="A line about you and how much time you have." />
          <p className="mt-1 text-[12px] text-slate-500">The head sees your name, roles, skills and Discord. Not your email.</p>
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={busy !== null} className="s-btn s-btn-accent h-10 flex-1">{busy === 'join' ? 'Sending…' : 'Send request'}</button>
          <button type="button" onClick={() => setJoinOpen(false)} className="s-btn s-btn-plain h-10">Cancel</button>
        </div>
      </form>
    );
  })();

  return (
    <SiteLayout>
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <Link to="/projects" className="inline-flex items-center gap-1.5 text-[14px] text-[var(--fg-3)] hover:text-[var(--fg)]">
          <ArrowLeft size={15} strokeWidth={1.75} />
          All projects
        </Link>

        <header className="mt-5">
          <div className="flex flex-wrap items-center gap-2">
            {project.stage && (
              <span className="rounded-full bg-[#eef3ff] px-2.5 py-0.5 text-[12px] font-medium text-[var(--accent)] shadow-[inset_0_0_0_1px_rgb(30_58_138/0.18)]">
                {stageLabel(project.stage)}
              </span>
            )}
            {project.projType && <span className="text-[13px] text-[var(--fg-3)]">{workTypeLabel(project.projType)}</span>}
            {!approved && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[12px] font-medium text-amber-800 shadow-[inset_0_0_0_1px_rgb(245_158_11/0.3)]">In review</span>}
          </div>
          <h1 className="mt-2 text-[30px] sm:text-[38px]">{project.name}</h1>
          {owner && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[14px] text-[var(--fg-2)]">
              {owner.type === 'org' ? <Building2 size={15} strokeWidth={1.75} className="text-slate-400" aria-hidden /> : <Crown size={15} strokeWidth={1.75} className="text-slate-400" aria-hidden />}
              Owned by <span className="font-medium text-[var(--fg)]">{owner.name}</span>
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {project.url && (
              <a href={project.url} target="_blank" rel="noreferrer" className="s-btn s-btn-plain h-10">
                {hostOf(project.url)}
                <ArrowUpRight size={15} strokeWidth={1.75} />
              </a>
            )}
            {approved && <ShareButton url={shareUrl} title={project.name} />}
            {project.chatUrl && (
              <a href={project.chatUrl} target="_blank" rel="noreferrer" className="s-btn s-btn-plain h-10">
                <MessageCircle size={15} strokeWidth={1.75} />
                Team group chat
              </a>
            )}
            {!sessionUserId && (
              <span className="self-center text-[12.5px] text-[var(--fg-3)]">Sign in to see the team’s group chat.</span>
            )}
          </div>
        </header>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8">
          <div className="min-w-0 space-y-6">
            {project.stage === 'needs-lead' && (
              <div className="rounded-[14px] bg-amber-50 p-4 shadow-[inset_0_0_0_1px_rgb(245_158_11/0.3)] sm:p-5">
                <p className="text-[15px] font-semibold text-slate-900">Looking for a new lead</p>
                <p className="mt-0.5 text-[13.5px] text-slate-700">The founder stepped back. If you’d like to take this on, ask to join and say so in your note.</p>
              </div>
            )}
            {project.stage === 'completed' && (
              <div className="rounded-[14px] bg-emerald-50 p-4 shadow-[inset_0_0_0_1px_rgb(16_185_129/0.25)] sm:p-5">
                <p className="text-[15px] font-semibold text-slate-900">Completed</p>
                <p className="mt-0.5 text-[13.5px] text-slate-700">This project reached its goal. It stays here for reference, and can be restarted or forked.</p>
              </div>
            )}
            <section className="s-card p-5 sm:p-6" aria-labelledby="about-title">
              <h2 id="about-title" className="text-[16px] font-semibold">About</h2>
              <p className="mt-2 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[var(--fg-2)]">{project.description}</p>
            </section>

            {project.repo ? (
              <section aria-labelledby="progress-title">
                <h2 id="progress-title" className="mb-3 text-[16px] font-semibold">Progress</h2>
                <RepoPanel repo={project.repo} />
                <p className="mt-2 text-[12px] text-[var(--fg-3)]">From GitHub, refreshed every few hours.</p>
              </section>
            ) : project.repoUrl ? null : (
              canManage && (
                <p className="rounded-[12px] bg-slate-50 px-4 py-3 text-[13px] text-slate-600 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.05)]">
                  Add a GitHub repository to this project to track its progress here. Ask an admin to set it.
                </p>
              )
            )}

            {approved && <ProjectUpdates projectId={String(project.id)} canPost={onTeam} canModerate={canManage} />}

            {onTeam && approved && (
              <section className="s-card p-5 sm:p-6" aria-labelledby="loghours-title">
                <h2 id="loghours-title" className="text-[16px] font-semibold">Log your hours</h2>
                <p className="mt-1 mb-4 text-[13px] text-slate-500">
                  {me?.isHead ? 'An admin confirms hours for team heads.' : 'The team head confirms them; confirmed hours go on your certificate.'}
                </p>
                <LogHoursForm idPrefix="proj-hours" projectId={String(project.id)} onLogged={() => {}} />
              </section>
            )}

            {canManage && <HoursToConfirm projectId={String(project.id)} title="Team hours to confirm" />}

            {canManage && requests && (
              <section className="s-card p-5 sm:p-6" aria-labelledby="requests-title">
                <h2 id="requests-title" className="text-[16px] font-semibold">
                  Requests to join <span className="num font-normal text-slate-400">{requests.length}</span>
                </h2>
                {requests.length === 0 ? (
                  <p className="mt-2 text-[14px] text-slate-500">No one is waiting right now.</p>
                ) : (
                  <ul className="mt-4 divide-y divide-slate-200/80">
                    {requests.map((r) => (
                      <li key={r.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-start gap-3">
                          <Avatar name={r.person.name} seed={r.person.userId} photos={[r.person.avatarUrl]} size={40} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-semibold text-slate-900">{r.person.name}</p>
                            <p className="text-[13px] text-slate-500">
                              {[r.person.role, r.teamRole && `wants to do ${r.teamRole}`, r.person.discordUsername && `@${r.person.discordUsername}`].filter(Boolean).join(' · ')}
                            </p>
                            {availabilitySummary(r.person) && <p className="text-[12.5px] text-slate-500">{availabilitySummary(r.person)}</p>}
                            {r.person.skills && r.person.skills.length > 0 && (
                              <p className="mt-1.5 flex flex-wrap gap-1">
                                {r.person.skills.map((s) => <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-[12px] text-slate-700">{s}</span>)}
                              </p>
                            )}
                            {r.message && <p className="mt-2 whitespace-pre-wrap break-words text-[14px] text-slate-700">“{r.message}”</p>}
                          </div>
                          <div className="flex w-full gap-2 sm:w-auto">
                            <button type="button" disabled={busy !== null} onClick={() => act(`a-${r.id}`, { action: 'decide', requestId: r.id, decision: 'approve' }, `${r.person.name} joined the team`)} className="s-btn s-btn-accent h-9 flex-1 px-3.5 text-[13px] sm:flex-none">
                              Approve
                            </button>
                            <button type="button" disabled={busy !== null} onClick={() => act(`d-${r.id}`, { action: 'decide', requestId: r.id, decision: 'decline' }, 'Request declined')} className="s-btn s-btn-plain h-9 flex-1 px-3.5 text-[13px] sm:flex-none">
                              Decline
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {canManage && (
              <section className="s-card p-5 sm:p-6" aria-labelledby="chat-title">
                <h2 id="chat-title" className="text-[16px] font-semibold">Team group chat</h2>
                <p className="mt-1 text-[14px] text-slate-500">Where the team talks. Messenger, WhatsApp, Viber, Telegram or Discord. Signed-in members see it.</p>
                <form
                  className="mt-4 flex flex-col gap-2 sm:flex-row"
                  onSubmit={(e) => { e.preventDefault(); act('chat', { action: 'set-chat', chatUrl: chatDraft.trim() }, chatDraft.trim() ? 'Chat link saved' : 'Chat link removed'); }}
                >
                  <input aria-label="Group chat link" type="url" inputMode="url" maxLength={300} value={chatDraft} onChange={(e) => setChatDraft(e.target.value)} className="s-field sm:flex-1" placeholder="https://chat.whatsapp.com/…" />
                  <button type="submit" disabled={busy !== null} className="s-btn s-btn-accent h-11">{busy === 'chat' ? 'Saving…' : 'Save link'}</button>
                </form>
              </section>
            )}

            {canManage && (
              <section className="s-card p-5 sm:p-6" aria-labelledby="owner-title">
                <div className="mb-5 border-b border-slate-200/80 pb-5">
                  <h2 id="stage-title" className="text-[16px] font-semibold">Stage</h2>
                  <p className="mt-1 text-[14px] text-slate-500">Mark it “Looking for a new lead” if you’re stepping back, or “Completed” when the goal is reached.</p>
                  <SelectMenu
                    id="project-stage"
                    labelledBy="stage-title"
                    className="mt-3 sm:max-w-sm"
                    value={project.stage || ''}
                    placeholder="Choose a stage"
                    onChange={(v) => act('stage', { action: 'set-stage', stage: v as never }, 'Stage updated')}
                    options={STAGES.map((st) => ({ value: st.id, label: st.label, hint: st.hint }))}
                  />
                </div>
                <h2 id="owner-title" className="text-[16px] font-semibold">Project owner</h2>
                <p className="mt-1 text-[14px] text-slate-500">Who the project belongs to: someone on the team, or the organisation or agency it’s for.</p>
                <div className="mt-4 inline-flex rounded-[10px] bg-slate-200/60 p-1" role="radiogroup" aria-label="Owner type">
                  {(['member', 'org'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={ownerMode === m}
                      onClick={() => setOwnerMode(m)}
                      className={clsx('min-h-[36px] rounded-[8px] px-3.5 text-[13px]', ownerMode === m ? 'bg-white font-medium text-slate-900 shadow-[var(--e1)]' : 'text-slate-500 hover:text-slate-900')}
                    >
                      {m === 'member' ? 'A team member' : 'An organisation'}
                    </button>
                  ))}
                </div>
                <form
                  className="mt-4 flex flex-col gap-2 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (ownerMode === 'member') {
                      if (!ownerUserId) { toast.error('Pick someone from the team'); return; }
                      act('owner', { action: 'set-owner', ownerType: 'member', ownerUserId }, 'Owner updated');
                    } else {
                      if (!ownerName.trim()) { toast.error('Enter the organisation name'); return; }
                      act('owner', { action: 'set-owner', ownerType: 'org', ownerName: ownerName.trim() }, 'Owner updated');
                    }
                  }}
                >
                  {ownerMode === 'member' ? (
                    <SelectMenu
                      id="owner-member"
                      ariaLabel="Owner"
                      className="sm:flex-1"
                      value={ownerUserId}
                      onChange={setOwnerUserId}
                      placeholder="Choose a team member"
                      options={members.filter((m) => m.userId).map((m) => ({ value: m.userId!, label: m.name, hint: m.isHead ? 'Team head' : m.teamRole || m.role || undefined }))}
                    />
                  ) : (
                    <input aria-label="Organisation name" maxLength={120} value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="s-field sm:flex-1" placeholder="e.g. Barangay San Isidro, DICT, a school or NGO" />
                  )}
                  <button type="submit" disabled={busy !== null} className="s-btn s-btn-accent h-11">{busy === 'owner' ? 'Saving…' : 'Save owner'}</button>
                </form>
              </section>
            )}
          </div>

          <aside className="min-w-0 space-y-6">
            <section className="s-card p-5" aria-labelledby="team-title">
              <h2 id="team-title" className="flex items-center justify-between text-[16px] font-semibold">
                Team
                <span className="num text-[13px] font-normal text-slate-400">{members.length}</span>
              </h2>
              <ul className="mt-4 space-y-3">
                {members.map((m, i) => (
                  <li key={m.userId || `${m.name}-${i}`} className="flex items-center gap-3">
                    <Avatar name={m.name} seed={m.memberId || m.userId || m.name} photos={[m.avatarUrl]} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-[14px] font-medium text-slate-900">
                        {m.name}
                        {m.isHead && <span className="rounded-full bg-amber-50 px-1.5 py-px text-[10.5px] font-semibold text-amber-800 shadow-[inset_0_0_0_1px_rgb(217_119_6/0.3)]">Head</span>}
                      </p>
                      <p className="truncate text-[12.5px] text-slate-500">{m.teamRole || m.role || 'Member'}</p>
                    </div>
                    {canManage && !m.isHead && m.userId && (
                      <div className="flex shrink-0 gap-1">
                        <button type="button" title="Make team head" aria-label={`Make ${m.name} team head`} disabled={busy !== null}
                          onClick={() => act(`h-${m.userId}`, { action: 'transfer-head', userId: m.userId! }, `${m.name} now leads the team`)}
                          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                          <Crown size={15} strokeWidth={1.75} />
                        </button>
                        <button type="button" title="Remove from team" aria-label={`Remove ${m.name}`} disabled={busy !== null}
                          onClick={() => act(`r-${m.userId}`, { action: 'remove', userId: m.userId! }, `${m.name} was removed`)}
                          className="flex h-8 w-8 items-center justify-center rounded-[8px] text-slate-400 hover:bg-red-50 hover:text-red-700">
                          <UserMinus size={15} strokeWidth={1.75} />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-5 border-t border-slate-200/80 pt-4">{joinBox}</div>
            </section>
            <p className="px-1 text-[12px] leading-relaxed text-[var(--fg-3)]">
              Names are shortened on public pages unless a member chooses to show their full name.
            </p>
            {sessionUserId && !canManage && approved && <ReportButton targetType="project" targetId={String(project.id)} className="px-1" />}
          </aside>
        </div>
      </div>
    </SiteLayout>
  );
}
