import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { AlertCircle, ArrowLeft, CheckCircle2, Github, Link2, Loader2, RefreshCw, Sparkles, User as UserIcon, Briefcase } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { LoadingOverlay } from '../../components/LoadingOverlay';
import { UserChip } from '../../components/UserChip';
import { SkillsPicker } from '../../components/SkillsPicker';
import { SPECIALIZATIONS } from '../../constants/specializations';
import { connectDiscord, createOrUpdateUserRecord } from '../../services/supabase';
import type { ExperienceLevel, UserSkill } from '../../types';

const EXPERIENCE_LEVELS: ExperienceLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Professional'];

const TABS = [
  { id: 'personal', label: 'Personal', icon: UserIcon },
  { id: 'role', label: 'Role', icon: Briefcase },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'connections', label: 'Connections', icon: Link2 },
] as const;
type TabId = (typeof TABS)[number]['id'];
const isTabId = (v: string | null): v is TabId => TABS.some((t) => t.id === v);

const inputClass =
  'w-full rounded-[6px] border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 disabled:bg-slate-50 disabled:text-slate-500';
const labelClass = 'block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5';

const skillsKey = (skills: UserSkill[]) =>
  skills
    .map((s) => `${s.name.toLowerCase()}:${s.level}`)
    .sort()
    .join('|');

const Card: React.FC<{ title: string; description?: string; children: React.ReactNode }> = ({
  title,
  description,
  children,
}) => (
  <section className="bg-white border border-slate-200 rounded-[8px] p-5 sm:p-6">
    <h2 className="text-base font-semibold text-slate-900">{title}</h2>
    {description && <p className="text-sm text-slate-500 mt-1">{description}</p>}
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
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const seedFromUser = useCallback(() => {
    if (!currentUser) return;
    setFullName(currentUser.fullName ?? '');
    setSpecialization(currentUser.specialization ?? '');
    setExperienceLevel((currentUser.experienceLevel as ExperienceLevel) ?? '');
    setSkills((currentUser.skills ?? []).map((s) => ({ name: s.name, level: s.level })));
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || initialized) return;
    seedFromUser();
    setInitialized(true);
  }, [currentUser, initialized, seedFromUser]);

  // Surface an error left behind by a failed Discord callback and jump to the right tab.
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

  const specializationOptions = useMemo(() => {
    const labels = SPECIALIZATIONS.map((s) => s.label);
    return specialization && !labels.includes(specialization) ? [specialization, ...labels] : labels;
  }, [specialization]);

  const changed = useMemo(() => {
    if (!currentUser) return { personal: false, role: false, skills: false };
    return {
      personal: fullName.trim() !== (currentUser.fullName ?? ''),
      role:
        specialization !== (currentUser.specialization ?? '') ||
        experienceLevel !== (currentUser.experienceLevel ?? ''),
      skills: skillsKey(skills) !== skillsKey(currentUser.skills ?? []),
    };
  }, [currentUser, fullName, specialization, experienceLevel, skills]);
  const dirty = changed.personal || changed.role || changed.skills;

  if (!currentUser) return <LoadingOverlay />;

  const backPath = currentUser.isAdmin ? '/admin' : '/dashboard';
  const touch = () => setSaveState('idle');

  const handleSave = async () => {
    if (!fullName.trim()) {
      setActiveTab('personal');
      setSaveState('error');
      setSaveError('Full name is required.');
      return;
    }
    if (!specialization) {
      setActiveTab('role');
      setSaveState('error');
      setSaveError('Please choose a primary role.');
      return;
    }
    setSaveState('saving');
    setSaveError('');
    try {
      const updated = await createOrUpdateUserRecord({
        fullName: fullName.trim(),
        specialization,
        experienceLevel: experienceLevel || undefined,
        skills,
        yearJoined: currentUser.yearJoined,
        role: currentUser.role,
      });
      if (updated) setCurrentUser(updated);
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setSaveError(err instanceof Error && err.message ? err.message : 'Could not save your profile. Please try again.');
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
      setDiscordBusy(false);
      setDiscordError(err instanceof Error && err.message ? err.message : 'Could not start Discord connection.');
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

  return (
    <div className="site min-h-screen pb-24">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <Link
            to={backPath}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-blue-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to {currentUser.isAdmin ? 'admin portal' : 'dashboard'}</span>
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
      </nav>

      <div className="bg-white border-b border-slate-200 sticky top-14 sm:top-16 z-40 overflow-x-auto no-scrollbar">
        <div className="max-w-3xl mx-auto px-3 sm:px-6 min-w-max sm:min-w-0">
          <div role="tablist" aria-label="Profile sections" className="flex gap-6 sm:gap-8">
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
                    'inline-flex items-center gap-2 py-3.5 sm:py-4 text-xs sm:text-sm font-bold border-b-2 px-1 whitespace-nowrap transition-colors',
                    isActive
                      ? 'border-blue-900 text-blue-900'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {hasChanges && <span aria-label="Unsaved changes" className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
        <header>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900">Profile settings</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your details, skills and connected accounts.</p>
        </header>

        {activeTab === 'personal' && (
          <div role="tabpanel" id="panel-personal" aria-labelledby="tab-personal">
            <Card title="Personal information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label htmlFor="fullName" className={labelClass}>Full name</label>
                  <input
                    id="fullName"
                    className={inputClass}
                    value={fullName}
                    maxLength={200}
                    onChange={(e) => { setFullName(e.target.value); touch(); }}
                  />
                </div>
                <div>
                  <label htmlFor="email" className={labelClass}>Email</label>
                  <input id="email" className={inputClass} value={currentUser.email ?? ''} disabled readOnly />
                </div>
                <div>
                  <label htmlFor="memberId" className={labelClass}>Member ID</label>
                  <input id="memberId" className={inputClass} value={currentUser.memberId ?? 'Not issued yet'} disabled readOnly />
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'role' && (
          <div role="tabpanel" id="panel-role" aria-labelledby="tab-role">
            <Card title="Role & experience" description="Your primary role drives skill recommendations and your access card.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="specialization" className={labelClass}>Primary role</label>
                  <select
                    id="specialization"
                    className={inputClass}
                    value={specialization}
                    onChange={(e) => { setSpecialization(e.target.value); touch(); }}
                  >
                    <option value="" disabled>Select a role</option>
                    {specializationOptions.map((label) => (
                      <option key={label} value={label}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="experience" className={labelClass}>Experience level</label>
                  <select
                    id="experience"
                    className={inputClass}
                    value={experienceLevel}
                    onChange={(e) => { setExperienceLevel(e.target.value as ExperienceLevel); touch(); }}
                  >
                    <option value="">Not specified</option>
                    {EXPERIENCE_LEVELS.map((lvl) => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'skills' && (
          <div role="tabpanel" id="panel-skills" aria-labelledby="tab-skills">
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
                <div className="rounded-[6px] border border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">Discord</p>
                    <p className="text-xs text-slate-500 truncate">
                      {discordLinked ? (
                        <>
                          Connected{discordName ? <> as <span className="font-semibold text-slate-700">{discordName}</span></> : null}
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
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-[6px] bg-[#5865F2] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {discordBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    {discordLinked ? 'Reconnect' : 'Connect'}
                  </button>
                </div>
                {discordError && (
                  <p role="alert" className="text-sm font-medium text-red-700 bg-red-50 border border-red-100 rounded-[6px] px-3 py-2">
                    {discordError}
                  </p>
                )}

                <div className="rounded-[6px] border border-dashed border-slate-200 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Github className="w-5 h-5 text-slate-400 shrink-0" />
                    <p className="text-sm font-bold text-slate-700">
                      GitHub
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-[4px] bg-slate-100 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                        Soon
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="shrink-0 rounded-[6px] bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-400 cursor-not-allowed"
                  >
                    Connect
                  </button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>

      {(dirty || saveState === 'saved' || saveState === 'error') && (
        <div className="fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur border-t border-slate-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0 text-sm">
              {saveState === 'error' ? (
                <span role="alert" className="inline-flex items-center gap-1.5 font-semibold text-red-600">
                  <AlertCircle className="w-4 h-4 shrink-0" /> <span className="truncate">{saveError}</span>
                </span>
              ) : saveState === 'saved' && !dirty ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" /> Saved
                </span>
              ) : (
                <span className="font-semibold text-slate-600">You have unsaved changes</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {dirty && (
                <button
                  type="button"
                  onClick={() => { seedFromUser(); setSaveState('idle'); setSaveError(''); }}
                  disabled={saveState === 'saving'}
                  className="rounded-[6px] border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  Discard
                </button>
              )}
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty || saveState === 'saving'}
                className="inline-flex items-center gap-2 rounded-[6px] bg-blue-900 px-5 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-40 transition-colors"
              >
                {saveState === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
