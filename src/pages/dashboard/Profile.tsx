import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { AlertCircle, ArrowLeft, Briefcase, CheckCircle2, ChevronDown, Github, Link2, Lock, Sparkles, Star, User as UserIcon } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { UserChip } from '../../components/UserChip';
import { SkillsPicker } from '../../components/SkillsPicker';
import { SkillIcon } from '../../components/SkillIcon';
import { SPECIALIZATIONS } from '../../constants/specializations';
import { EXPERIENCE_LEVELS } from '../../constants/experience';
import { connectDiscord, createOrUpdateUserRecord } from '../../services/supabase';
import type { ExperienceLevel, UserSkill } from '../../types';

const TABS = [
  { id: 'personal', label: 'Personal', icon: UserIcon },
  { id: 'role', label: 'Role', icon: Briefcase },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'connections', label: 'Connections', icon: Link2 },
] as const;
type TabId = (typeof TABS)[number]['id'];
const isTabId = (v: string | null): v is TabId => TABS.some((t) => t.id === v);

const MAX_FEATURED = 3;
const labelClass = 'mb-1.5 block text-[13px] font-medium text-slate-900';

// Includes `featured`, so starring or unstarring a skill counts as an unsaved change.
const skillsKey = (skills: UserSkill[]) =>
  skills
    .map((s) => `${s.name.toLowerCase()}:${s.level}:${s.featured ? 1 : 0}`)
    .sort()
    .join('|');

const Card: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({ title, description, children }) => (
  <section className="s-card p-5 sm:p-6">
    <h2 className="text-[16px] font-semibold text-slate-900">{title}</h2>
    {description && <p className="mt-1 text-[14px] text-slate-500">{description}</p>}
    <div className="mt-5">{children}</div>
  </section>
);

export default function Profile() {
  const currentUser = useStore((s) => s.currentUser);
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const logout = useStore((s) => s.logout);
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get('tab');
  const activeTab: TabId = isTabId(tabParam) ? tabParam : 'personal';
  const setActiveTab = useCallback(
    (id: TabId) => setSearchParams(id === 'personal' ? {} : { tab: id }, { replace: true }),
    [setSearchParams]
  );

  const [fullName, setFullName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | ''>('');
  const [skills, setSkills] = useState<UserSkill[]>([]);
  const [initialized, setInitialized] = useState(false);

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [discordBusy, setDiscordBusy] = useState(false);
  const [discordError, setDiscordError] = useState('');
  const [featuredNote, setFeaturedNote] = useState('');
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const seedFromUser = useCallback(() => {
    if (!currentUser) return;
    setFullName(currentUser.fullName ?? '');
    setSpecialization(currentUser.specialization ?? '');
    setExperienceLevel((currentUser.experienceLevel as ExperienceLevel) ?? '');
    // Copy whole skill objects so `featured` (and any future fields) survive a save.
    setSkills((currentUser.skills ?? []).map((s) => ({ ...s })));
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || initialized) return;
    seedFromUser();
    setInitialized(true);
  }, [currentUser, initialized, seedFromUser]);

  // Surface an error left behind by a failed Discord callback.
  useEffect(() => {
    try {
      const msg = sessionStorage.getItem('discord_connect_error');
      if (msg) {
        setDiscordError(msg);
        sessionStorage.removeItem('discord_connect_error');
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  // The "Saved" confirmation clears itself instead of pinning the bar to the screen.
  useEffect(() => {
    if (saveState !== 'saved') return;
    const t = window.setTimeout(() => setSaveState('idle'), 2500);
    return () => window.clearTimeout(t);
  }, [saveState]);

  const specializationOptions = useMemo(() => {
    const labels = SPECIALIZATIONS.map((s) => s.label);
    return specialization && !labels.includes(specialization) ? [specialization, ...labels] : labels;
  }, [specialization]);

  // Approved members' names are what the Volunteer Card and /verify vouch for, so they're locked.
  const nameLocked = currentUser?.status === 'Approved';

  const changed = useMemo(() => {
    if (!currentUser) return { personal: false, role: false, skills: false };
    return {
      personal: !nameLocked && fullName.trim() !== (currentUser.fullName ?? ''),
      role:
        specialization !== (currentUser.specialization ?? '') ||
        experienceLevel !== (currentUser.experienceLevel ?? ''),
      skills: skillsKey(skills) !== skillsKey(currentUser.skills ?? []),
    };
  }, [currentUser, nameLocked, fullName, specialization, experienceLevel, skills]);
  const dirty = changed.personal || changed.role || changed.skills;

  if (!currentUser) return <LoadingOverlay />;

  const backPath = currentUser.isAdmin ? '/admin' : '/dashboard';
  const touch = () => setSaveState('idle');
  const featuredCount = skills.filter((s) => s.featured).length;

  const toggleFeatured = (name: string) => {
    const target = skills.find((s) => s.name === name);
    if (!target) return;
    if (!target.featured && featuredCount >= MAX_FEATURED) {
      setFeaturedNote(`You can feature up to ${MAX_FEATURED} skills. Unstar one first.`);
      return;
    }
    setFeaturedNote('');
    setSkills(skills.map((s) => (s.name === name ? { ...s, featured: !s.featured } : s)));
    touch();
  };

  const handleSave = async () => {
    if (!nameLocked && !fullName.trim()) {
      setActiveTab('personal');
      setSaveState('error');
      setSaveError('Full name is required.');
      return;
    }
    if (!specialization) {
      setActiveTab('role');
      setSaveState('error');
      setSaveError('Choose a primary role.');
      return;
    }
    setSaveState('saving');
    setSaveError('');
    try {
      const updated = await createOrUpdateUserRecord({
        ...(nameLocked ? {} : { fullName: fullName.trim() }),
        specialization,
        experienceLevel: experienceLevel || undefined,
        // Featured skills are stored first so every view can show them up front.
        skills: [...skills.filter((s) => s.featured), ...skills.filter((s) => !s.featured)],
        yearJoined: currentUser.yearJoined,
      });
      if (updated) setCurrentUser(updated);
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setSaveError(err instanceof Error && err.message ? err.message : 'Couldn’t save your profile. Try again.');
    }
  };

  const handleReconnectDiscord = async () => {
    setDiscordBusy(true);
    setDiscordError('');
    try {
      try {
        sessionStorage.setItem('discord_return_to', '/profile');
      } catch {
        /* storage unavailable: callback falls back to its default */
      }
      const { url } = await connectDiscord();
      if (!url) throw new Error('No Discord authorization URL returned.');
      window.location.href = url;
    } catch (err) {
      // Don't leave a return address behind for a connect that never started.
      try { sessionStorage.removeItem('discord_return_to'); } catch { /* noop */ }
      setDiscordBusy(false);
      setDiscordError(err instanceof Error && err.message ? err.message : 'Couldn’t start the Discord connection.');
    }
  };

  const onTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (idx + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
    setActiveTab(TABS[next].id);
    tabRefs.current[TABS[next].id]?.focus();
  };

  const discordLinked = currentUser.discordConnected === true;
  const discordName = currentUser.discordDisplayName || currentUser.discordUsername;
  const showBar = dirty || saveState === 'saved' || saveState === 'error';

  return (
    <div className="site min-h-screen pb-28">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl backdrop-saturate-150 shadow-[0_1px_0_rgb(15_23_42/0.08)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to={backPath} className="group inline-flex items-center gap-1.5 text-[14px] text-slate-500 hover:text-slate-900">
            <ArrowLeft size={16} strokeWidth={1.75} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline">Back to {currentUser.isAdmin ? 'admin' : 'dashboard'}</span>
            <span className="sm:hidden">Back</span>
          </Link>
          <UserChip
            name={currentUser.fullName}
            subtitle={currentUser.isAdmin ? 'Administrator' : currentUser.role || 'Member'}
            discordId={currentUser.discordId}
            discordAvatar={currentUser.discordAvatar}
            onSignOut={logout}
          />
        </div>
        <div className="no-scrollbar mx-auto max-w-3xl overflow-x-auto border-t border-slate-200/70 px-3 py-1.5 sm:px-5">
          <div role="tablist" aria-label="Profile sections" className="flex w-max gap-1">
            {TABS.map((tab, idx) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const hasChanges = tab.id !== 'connections' && changed[tab.id];
              return (
                <button
                  key={tab.id}
                  ref={(el) => { tabRefs.current[tab.id] = el; }}
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  tabIndex={isActive ? 0 : -1}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(e) => onTabKeyDown(e, idx)}
                  className={clsx(
                    'inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-3 text-[14px] transition-colors duration-150',
                    isActive ? 'bg-slate-900/[0.06] font-medium text-slate-900' : 'text-slate-500 hover:text-slate-900'
                  )}
                >
                  <Icon size={15} strokeWidth={1.75} aria-hidden />
                  {tab.label}
                  {hasChanges && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-label="Unsaved changes" />}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 pt-8 sm:pt-10">
        <div>
          <h1 className="text-[28px] sm:text-[32px]">Profile settings</h1>
          <p className="mt-1 text-[15px] text-slate-600">Manage your details, skills and connected accounts.</p>
        </div>

        {activeTab === 'personal' && (
          <div role="tabpanel" id="panel-personal" aria-labelledby="tab-personal">
            <Card title="Personal information">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="fullName" className={labelClass}>Full name</label>
                  <div className="relative">
                    <input
                      id="fullName"
                      className={clsx('s-field h-11 text-[15px]', nameLocked && 'pr-10 text-slate-500')}
                      value={fullName}
                      maxLength={200}
                      readOnly={nameLocked}
                      aria-describedby="fullName-hint"
                      onChange={(e) => { setFullName(e.target.value); touch(); }}
                    />
                    {nameLocked && (
                      <Lock size={15} strokeWidth={1.75} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
                    )}
                  </div>
                  <p id="fullName-hint" className="mt-1.5 text-[12px] text-slate-500">
                    {nameLocked
                      ? 'This name is on your verified Volunteer Card. Ask an admin on Discord if it needs changing.'
                      : 'This is printed on your Volunteer Card exactly as typed.'}
                  </p>
                </div>
                <div>
                  <label htmlFor="email" className={labelClass}>Email</label>
                  <input id="email" className="s-field h-11 text-[15px] text-slate-500" value={currentUser.email ?? ''} readOnly />
                </div>
                <div>
                  <label htmlFor="memberId" className={labelClass}>Member ID</label>
                  <input id="memberId" className="s-field h-11 font-mono text-[14px] text-slate-500" value={currentUser.memberId ?? 'Not issued yet'} readOnly />
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'role' && (
          <div role="tabpanel" id="panel-role" aria-labelledby="tab-role">
            <Card title="Role & experience" description="Your primary role drives skill recommendations and shows on your Volunteer Card.">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="specialization" className={labelClass}>Primary role</label>
                  <div className="relative">
                    <select
                      id="specialization"
                      className="s-field h-11 cursor-pointer appearance-none pr-10 text-[15px]"
                      value={specialization}
                      onChange={(e) => { setSpecialization(e.target.value); touch(); }}
                    >
                      <option value="" disabled>Select a role</option>
                      {specializationOptions.map((label) => (
                        <option key={label} value={label}>{label}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} strokeWidth={1.75} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
                <div>
                  <label htmlFor="experience" className={labelClass}>Experience</label>
                  <div className="relative">
                    <select
                      id="experience"
                      className="s-field h-11 cursor-pointer appearance-none pr-10 text-[15px]"
                      value={experienceLevel}
                      onChange={(e) => { setExperienceLevel(e.target.value as ExperienceLevel); touch(); }}
                    >
                      <option value="">Not specified</option>
                      {EXPERIENCE_LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>{lvl}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} strokeWidth={1.75} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'skills' && (
          <div role="tabpanel" id="panel-skills" aria-labelledby="tab-skills" className="space-y-6">
            {skills.length > 0 && (
              <Card title="Featured skills" description={`Star up to ${MAX_FEATURED}. They show first on your dashboard.`}>
                <ul className="flex flex-wrap gap-2">
                  {skills.map((s) => (
                    <li key={s.name}>
                      <button
                        type="button"
                        onClick={() => toggleFeatured(s.name)}
                        aria-pressed={!!s.featured}
                        className={clsx(
                          'inline-flex min-h-[36px] items-center gap-2 rounded-full py-1 pl-2.5 pr-3 text-[13px] transition-[background-color,box-shadow] duration-150',
                          s.featured
                            ? 'bg-[#fffbeb] text-slate-900 shadow-[inset_0_0_0_1px_rgb(217_119_6/0.35)]'
                            : 'bg-white text-slate-700 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.12)] hover:shadow-[inset_0_0_0_1px_rgb(15_23_42/0.25)]'
                        )}
                      >
                        <Star size={14} strokeWidth={1.75} className={s.featured ? 'fill-amber-400 text-amber-500' : 'text-slate-300'} aria-hidden />
                        <SkillIcon skillName={s.name} size={13} />
                        <span className="font-medium">{s.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {featuredNote && <p className="mt-3 text-[13px] text-amber-800" role="status">{featuredNote}</p>}
              </Card>
            )}
            <SkillsPicker
              skills={skills}
              onChange={(next) => { setSkills(next); touch(); }}
              specialization={specialization}
              onSpecializationChange={(label) => { setSpecialization(label); touch(); }}
            />
          </div>
        )}

        {activeTab === 'connections' && (
          <div role="tabpanel" id="panel-connections" aria-labelledby="tab-connections">
            <Card title="Connected accounts">
              <div className="space-y-3">
                <div className="flex flex-col gap-3 rounded-[12px] bg-white p-4 shadow-[0_0_0_1px_rgb(15_23_42/0.12)] sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-slate-900">Discord</p>
                    <p className="truncate text-[13px] text-slate-500">
                      {discordLinked ? (
                        <>
                          Connected{discordName ? <> as <span className="font-medium text-slate-700">{discordName}</span></> : null}
                          {currentUser.discordVerified ? ' · server member verified' : ''}
                        </>
                      ) : (
                        'Not connected'
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleReconnectDiscord}
                    disabled={discordBusy}
                    className="s-btn h-10 shrink-0 bg-[#5865F2] px-4 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(15_23_42/0.25)] [@media(hover:hover)]:hover:bg-[#4752C4]"
                  >
                    {discordBusy ? 'Connecting…' : discordLinked ? 'Reconnect Discord' : 'Connect Discord'}
                  </button>
                </div>
                {discordError && (
                  <p role="alert" className="rounded-[10px] bg-red-50 px-3.5 py-3 text-[14px] text-red-800 shadow-[inset_0_0_0_1px_rgb(254_202_202)]">
                    {discordError}
                  </p>
                )}

                <div className="flex items-center gap-3 rounded-[12px] p-4 shadow-[inset_0_0_0_1.5px_rgb(203_213_225)]">
                  <Github size={20} strokeWidth={1.75} className="shrink-0 text-slate-400" />
                  <p className="text-[15px] font-semibold text-slate-700">
                    GitHub
                    <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Coming soon</span>
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>

      {showBar && (
        <div className="fixed inset-x-0 bottom-0 z-50 bg-white/90 shadow-[0_-1px_0_rgb(15_23_42/0.08)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <div className="min-w-0 text-[14px]">
              {saveState === 'error' ? (
                <span role="alert" className="inline-flex items-center gap-1.5 font-medium text-red-700">
                  <AlertCircle size={16} strokeWidth={1.75} className="shrink-0" /> <span className="truncate">{saveError}</span>
                </span>
              ) : saveState === 'saved' && !dirty ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700" role="status">
                  <CheckCircle2 size={16} strokeWidth={1.75} /> Saved
                </span>
              ) : (
                <span className="text-slate-600">You have unsaved changes</span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {dirty && (
                <button
                  type="button"
                  onClick={() => { seedFromUser(); setSaveState('idle'); setSaveError(''); setFeaturedNote(''); }}
                  disabled={saveState === 'saving'}
                  className="s-btn s-btn-plain"
                >
                  Discard
                </button>
              )}
              <button type="button" onClick={handleSave} disabled={!dirty || saveState === 'saving'} className="s-btn s-btn-accent min-w-[120px]">
                {saveState === 'saving' ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
