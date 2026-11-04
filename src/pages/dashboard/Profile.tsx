import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { AlertCircle, BadgeCheck, Briefcase, CheckCircle2, Clock, Link2, Lock, Star, User as UserIcon, Wrench } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { UserChip } from '../../components/UserChip';
import { AppHeader } from '../../components/AppHeader';
import { memberNav, trackForRole } from '../../constants/tracks';
import { ALL_LINK_KEYS, type LinkKey, type ProfileLinks } from '../../constants/socialLinks';
import { LinksFields, LINKS_INTRO, validateLinks } from '../../components/LinksFields';
import { SkillsPicker } from '../../components/SkillsPicker';
import { SkillIcon } from '../../components/SkillIcon';
import { SPECIALIZATIONS, ROLE_GROUPS } from '../../constants/specializations';
import { SelectMenu, type SelectOption } from '../../components/SelectMenu';
import { EXPERIENCE_LEVELS } from '../../constants/experience';
import { connectDiscord, createOrUpdateUserRecord } from '../../services/supabase';
import { DISCORD_AVAILABLE, COMING_SOON_PILL } from '../../constants/integrations';
import { Avatar, useSessionPhoto } from '../../components/Avatar';
import type { ExperienceLevel, UserSkill } from '../../types';

const TABS = [
  { id: 'personal', label: 'Personal', icon: UserIcon },
  { id: 'role', label: 'Role', icon: Briefcase },
  { id: 'skills', label: 'Skills', icon: Wrench },
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

const linksKey = (links?: ProfileLinks) =>
  ALL_LINK_KEYS.map((k) => `${k}=${(links?.[k] || '').trim()}`).join('|');

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
  const sessionPhoto = useSessionPhoto();
  const navigate = useNavigate();

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
  const [links, setLinks] = useState<ProfileLinks>({});
  const [linkErrors, setLinkErrors] = useState<Partial<Record<LinkKey, string>>>({});
  const [showAllLinks, setShowAllLinks] = useState(false);
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
    setLinks({ ...(currentUser.links ?? {}) });
    setLinkErrors({});
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

  // Role choices for the custom select: icon, a few example skills, and the picker's two groups.
  const roleOptions = useMemo<SelectOption[]>(() => {
    const groupLabel = (g?: string) => ROLE_GROUPS.find((x) => x.id === (g ?? 'tech'))?.label;
    const list: SelectOption[] = SPECIALIZATIONS.map((s) => ({
      value: s.label,
      label: s.label,
      icon: s.icon,
      hint: s.suggestedSkills.slice(0, 3).join(' · '),
      group: groupLabel(s.group),
    }));
    // Keep a legacy role someone already has, even if it's no longer offered.
    return specialization && !list.some((o) => o.value === specialization)
      ? [{ value: specialization, label: specialization, group: 'Current' }, ...list]
      : list;
  }, [specialization]);

  // Approved members' names are what the Volunteer Card and /verify vouch for, so they're locked.
  const nameLocked = currentUser?.status === 'Approved';

  const changed = useMemo(() => {
    if (!currentUser) return { personal: false, role: false, skills: false, connections: false };
    return {
      personal: !nameLocked && fullName.trim() !== (currentUser.fullName ?? ''),
      role:
        specialization !== (currentUser.specialization ?? '') ||
        experienceLevel !== (currentUser.experienceLevel ?? ''),
      skills: skillsKey(skills) !== skillsKey(currentUser.skills ?? []),
      connections: linksKey(links) !== linksKey(currentUser.links),
    };
  }, [currentUser, nameLocked, fullName, specialization, experienceLevel, skills, links]);
  const dirty = changed.personal || changed.role || changed.skills || changed.connections;

  if (!currentUser) return <LoadingOverlay />;

  const verified = currentUser.status === 'Approved' || !!currentUser.isAdmin;
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
    // Links: normalize what was typed ("@handle", "youtube.com/…") and stop on a bad one.
    const { clean: cleanLinks, errors } = validateLinks(links);
    setLinkErrors(errors);
    if (Object.keys(errors).length > 0) {
      setActiveTab('connections');
      setShowAllLinks(true);
      setSaveState('error');
      setSaveError('Fix the highlighted link.');
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
        links: cleanLinks,
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
    const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    if (!forward && e.key !== 'ArrowLeft' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const next = (idx + (forward ? 1 : TABS.length - 1)) % TABS.length;
    setActiveTab(TABS[next].id);
    tabRefs.current[TABS[next].id]?.focus();
  };

  const discordLinked = currentUser.discordConnected === true;
  const discordName = currentUser.discordDisplayName || currentUser.discordUsername;
  const showBar = dirty || saveState === 'saved' || saveState === 'error';

  return (
    <div className="site min-h-screen pb-28">
      <AppHeader
        items={currentUser.isAdmin ? [] : memberNav(trackForRole(currentUser.specialization))}
        activeId={null}
        onSelect={(id) => navigate('/dashboard', { state: { tab: id } })}
        mobileNav={false}
        account={
          <UserChip
            name={currentUser.fullName}
            subtitle={currentUser.isAdmin ? 'Administrator' : currentUser.role || 'Member'}
            email={currentUser.email}
            memberId={currentUser.memberId}
            verified={verified}
            isAdmin={!!currentUser.isAdmin}
            discordId={currentUser.discordId}
            discordAvatar={currentUser.discordAvatar}
            onSignOut={logout}
          />
        }
      />

      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-14">
        {/* Who this profile belongs to, at the same scale as the dashboard's welcome */}
        <div className="mb-8 flex items-center gap-4 sm:mb-10 sm:gap-5">
          <Avatar
            name={currentUser.fullName}
            seed={currentUser.uid || currentUser.id}
            discordId={currentUser.discordId}
            discordAvatar={currentUser.discordAvatar}
            photos={[sessionPhoto]}
            size={64}
          />
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-[28px] sm:text-[36px]">
              <span className="truncate">{currentUser.fullName || 'Your profile'}</span>
              {verified && <BadgeCheck size={24} strokeWidth={2} className="shrink-0 text-[var(--accent)]" aria-label="Verified" />}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[14px] text-slate-500">
              <span>{currentUser.isAdmin ? 'Administrator' : currentUser.specialization || currentUser.role || 'Member'}</span>
              {currentUser.memberId && (
                <>
                  <span aria-hidden className="text-slate-300">·</span>
                  <span className="font-mono text-[13px]">{currentUser.memberId}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
          {/* Section menu: a scrolling row on phones, a sticky sidebar on desktop */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <p className="mb-2 hidden px-3 text-[12px] font-medium text-slate-400 lg:block">Profile settings</p>
            <div className="no-scrollbar -mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
              <div role="tablist" aria-label="Profile sections" className="flex w-max gap-1 lg:w-full lg:flex-col">
                {TABS.map((tab, idx) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const hasChanges = changed[tab.id];
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
                        'inline-flex min-h-[40px] shrink-0 items-center gap-2.5 rounded-lg px-3 text-left text-[14px] transition-[background-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgb(30_58_138/0.3)] lg:w-full',
                        isActive
                          ? 'bg-white font-medium text-slate-900 shadow-[0_0_0_1px_rgb(15_23_42/0.1),0_1px_2px_rgb(15_23_42/0.05)]'
                          : 'text-slate-500 hover:bg-slate-900/[0.04] hover:text-slate-900'
                      )}
                    >
                      <Icon size={16} strokeWidth={1.75} className={isActive ? 'text-[var(--accent)]' : ''} aria-hidden />
                      <span className="lg:flex-1">{tab.label}</span>
                      {hasChanges && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-label="Unsaved changes" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <div className="min-w-0 max-w-3xl space-y-6">
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
                  <label id="specialization-label" htmlFor="specialization" className={labelClass}>Primary role</label>
                  <SelectMenu
                    id="specialization"
                    labelledBy="specialization-label"
                    value={specialization}
                    placeholder="Select a role"
                    options={roleOptions}
                    onChange={(v) => { setSpecialization(v); touch(); }}
                  />
                </div>
                <div>
                  <label id="experience-label" htmlFor="experience" className={labelClass}>Experience</label>
                  <SelectMenu
                    id="experience"
                    labelledBy="experience-label"
                    value={experienceLevel}
                    options={[{ value: '', label: 'Not specified' }, ...EXPERIENCE_LEVELS.map((lvl) => ({ value: lvl, label: lvl }))]}
                    onChange={(v) => { setExperienceLevel(v as ExperienceLevel); touch(); }}
                  />
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
                {/* Discord */}
                <div
                  className={clsx(
                    'rounded-[14px] p-4 transition-[box-shadow,background-color] duration-200 sm:p-5',
                    discordLinked
                      ? 'bg-[#f3fbf7] shadow-[0_0_0_1.5px_rgb(16_185_129/0.4)]'
                      : 'bg-white shadow-[0_0_0_1px_rgb(15_23_42/0.12),0_2px_6px_-2px_rgb(15_23_42/0.08)]'
                  )}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3.5">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#5865F2] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(15_23_42/0.2)]">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                        </svg>
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold text-slate-900">
                          Discord
                          {discordLinked ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                              <CheckCircle2 size={12} strokeWidth={2} aria-hidden />
                              Connected
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 shadow-[inset_0_0_0_1px_rgb(245_158_11/0.25)]">Not connected yet</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[13px] leading-snug text-slate-500">
                          {discordLinked ? (
                            <>
                              {discordName ? <>Signed in as <span className="font-medium text-slate-700">{discordName}</span></> : 'Account linked'}
                              {currentUser.discordVerified ? ' · BetterGovPH server member' : ''}
                            </>
                          ) : (
                            DISCORD_AVAILABLE
                              ? 'Connect when you’re ready — it lets the team reach you in the community server. We only read your username.'
                              : 'Linking is coming soon. We’ll let you know when you can connect.'
                          )}
                        </p>
                      </div>
                    </div>
                    {!DISCORD_AVAILABLE ? (
                      <span className={COMING_SOON_PILL}>Coming soon</span>
                    ) : (
                    <button
                      type="button"
                      onClick={handleReconnectDiscord}
                      disabled={discordBusy}
                      className={clsx(
                        'shrink-0',
                        discordLinked
                          ? 's-btn s-btn-plain h-10'
                          : 's-btn h-10 bg-[#5865F2] px-4 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_1px_2px_rgb(15_23_42/0.25)] [@media(hover:hover)]:hover:bg-[#4752C4]'
                      )}
                    >
                      {discordBusy ? 'Connecting…' : discordLinked ? 'Reconnect' : 'Connect Discord'}
                    </button>
                    )}
                  </div>
                </div>
                {discordError && (
                  <p role="alert" className="rounded-[10px] bg-red-50 px-3.5 py-3 text-[14px] text-red-800 shadow-[inset_0_0_0_1px_rgb(254_202_202)]">
                    {discordError}
                  </p>
                )}

                {/* GitHub — not available yet */}
                <div className="rounded-[14px] p-4 shadow-[inset_0_0_0_1.5px_rgb(203_213_225)] [background-image:repeating-linear-gradient(135deg,transparent_0_10px,rgb(241_245_249)_10px_11px)] sm:p-5">
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#24292f] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_2px_rgb(15_23_42/0.2)]">
                      <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                      </svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold text-slate-800">
                        GitHub
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 shadow-[inset_0_0_0_1px_rgb(217_119_6/0.25)]">
                          <Clock size={11} strokeWidth={2} aria-hidden />
                          Coming soon
                        </span>
                      </p>
                      <p className="mt-0.5 text-[13px] leading-snug text-slate-500">
                        Link your GitHub to show your open-source contributions on your profile. Not available yet.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="mt-6">
              {(() => {
                const trackId = trackForRole(specialization || currentUser.specialization).id;
                return (
                  <Card title="Your channels & links" description={LINKS_INTRO[trackId]}>
                    <LinksFields
                      trackId={trackId}
                      links={links}
                      onChange={(next) => { setLinks(next); touch(); }}
                      errors={linkErrors}
                      onClearError={(k) => setLinkErrors((prev) => ({ ...prev, [k]: undefined }))}
                      expanded={showAllLinks}
                    />
                  </Card>
                );
              })()}
            </div>
          </div>
        )}
          </div>
        </div>
      </main>

      {showBar && (
        <div className="fixed inset-x-0 bottom-0 z-50 bg-white/90 shadow-[0_-1px_0_rgb(15_23_42/0.08)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
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
