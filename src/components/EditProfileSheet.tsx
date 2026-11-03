import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, Plus, Search, Star, X } from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';
import { SKILL_CATEGORIES } from '../constants/skills';
import { SPECIALIZATIONS } from '../constants/specializations';
import { createOrUpdateUserRecord } from '../services/supabase';
import { useStore } from '../store/useStore';
import { SkillIcon } from './SkillIcon';
import type { ExperienceLevel, SkillLevel, User, UserSkill } from '../types';

const LEVELS: SkillLevel[] = ['Learner', 'Practitioner', 'Expert'];
const EXPERIENCE: ExperienceLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Professional'];
const MAX_FEATURED = 3;
const ALL_SKILLS = Array.from(new Set(Object.values(SKILL_CATEGORIES).flat())).sort((a, b) => a.localeCompare(b));

interface Props {
  open: boolean;
  user: User;
  onClose: () => void;
}

/**
 * Lets a member keep their profile current after registration: primary role, experience,
 * and skills. The first three skills are "featured" and shown first everywhere.
 * Name and community role are not editable here — they're tied to the verified card.
 */
export const EditProfileSheet: React.FC<Props> = ({ open, user, onClose }) => {
  const reduce = useReducedMotion();
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const [specialization, setSpecialization] = useState(user.specialization || '');
  const [experience, setExperience] = useState<ExperienceLevel | ''>(user.experienceLevel || '');
  const [skills, setSkills] = useState<UserSkill[]>(user.skills || []);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  // Reset the draft each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setSpecialization(user.specialization || '');
    setExperience(user.experienceLevel || '');
    setSkills(user.skills || []);
    setQuery('');
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const has = (name: string) => skills.some((s) => s.name.toLowerCase() === name.toLowerCase());
  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ALL_SKILLS.filter((s) => s.toLowerCase().includes(q) && !has(s)).slice(0, 6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, skills]);

  const addSkill = (name: string) => {
    const clean = name.trim();
    if (!clean || has(clean) || skills.length >= 100) return;
    setSkills([...skills, { name: clean, level: 'Learner' }]);
    setQuery('');
  };
  const featuredCount = skills.filter((s) => s.featured).length;
  const removeSkill = (i: number) => setSkills(skills.filter((_, j) => j !== i));
  const setLevel = (i: number, level: SkillLevel) => setSkills(skills.map((s, j) => (j === i ? { ...s, level } : s)));
  const toggleFeatured = (i: number) => {
    const target = skills[i];
    if (!target.featured && featuredCount >= MAX_FEATURED) {
      toast.message(`You can feature up to ${MAX_FEATURED} skills.`);
      return;
    }
    setSkills(skills.map((s, j) => (j === i ? { ...s, featured: !s.featured } : s)));
  };

  const dirty =
    specialization !== (user.specialization || '') ||
    experience !== (user.experienceLevel || '') ||
    JSON.stringify(skills) !== JSON.stringify(user.skills || []);

  const save = async () => {
    if (!specialization) return toast.error('Pick a primary role.');
    if (skills.length === 0) return toast.error('Keep at least one skill.');
    setSaving(true);
    try {
      const saved = await createOrUpdateUserRecord({
        uid: user.uid || user.id,
        specialization,
        experienceLevel: experience || undefined,
        // Featured skills are stored first so every view can show them up front.
        skills: [...skills.filter((s) => s.featured), ...skills.filter((s) => !s.featured)],
      });
      if (saved) setCurrentUser(saved);
      toast.success('Profile updated');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t save your profile. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            className="absolute inset-0 bg-slate-900/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
            className="site relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[22px] bg-white shadow-[0_-8px_40px_-12px_rgb(15_23_42/0.35)] sm:max-w-2xl sm:rounded-[22px] sm:shadow-[0_24px_60px_-12px_rgb(15_23_42/0.35),0_0_0_1px_rgb(15_23_42/0.06)]"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300 sm:hidden" aria-hidden />
            <header className="flex items-start justify-between gap-4 border-b border-slate-200/80 px-5 pb-4 pt-4 sm:px-6 sm:pt-5">
              <div>
                <h2 id="edit-profile-title" className="text-[20px]">Edit profile</h2>
                <p className="mt-0.5 text-[13px] text-slate-500">Changes show on your dashboard right away.</p>
              </div>
              <button onClick={onClose} aria-label="Close" className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                <X size={18} strokeWidth={1.75} />
              </button>
            </header>

            <div className="flex-1 space-y-8 overflow-y-auto overscroll-contain px-5 py-6 sm:px-6">
              {/* Role + experience */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ep-role" className="mb-1.5 block text-[13px] font-medium text-slate-900">Primary role</label>
                  <div className="relative">
                    <select id="ep-role" value={specialization} onChange={(e) => setSpecialization(e.target.value)} className="s-field h-11 cursor-pointer appearance-none pr-10 text-[15px]">
                      {!specialization && <option value="">Select a role</option>}
                      {SPECIALIZATIONS.map((s) => (
                        <option key={s.id} value={s.label}>{s.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} strokeWidth={1.75} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
                <div>
                  <label htmlFor="ep-exp" className="mb-1.5 block text-[13px] font-medium text-slate-900">Experience</label>
                  <div className="relative">
                    <select id="ep-exp" value={experience} onChange={(e) => setExperience(e.target.value as ExperienceLevel)} className="s-field h-11 cursor-pointer appearance-none pr-10 text-[15px]">
                      {!experience && <option value="">Select a level</option>}
                      {EXPERIENCE.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} strokeWidth={1.75} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Add skill */}
              <section aria-labelledby="ep-skills-title">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 id="ep-skills-title" className="text-[15px] font-semibold">Skills <span className="num font-normal text-slate-400">{skills.length}</span></h3>
                  <p className="text-[12px] text-slate-500">Star up to {MAX_FEATURED} to feature them</p>
                </div>

                <div className="relative mt-3">
                  <label htmlFor="ep-add" className="sr-only">Add a skill</label>
                  <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="ep-add"
                    type="text"
                    autoComplete="off"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSkill(suggestions[0] ?? query);
                      }
                    }}
                    placeholder="Add a skill — e.g. Figma, Go, Data analysis"
                    className="s-field h-11 pl-10 text-[15px]"
                  />
                </div>
                {query.trim() && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {suggestions.map((s) => (
                      <button key={s} type="button" onClick={() => addSkill(s)} className="inline-flex min-h-[34px] items-center gap-1.5 rounded-full bg-white px-3 text-[13px] text-slate-700 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.12)] hover:shadow-[inset_0_0_0_1px_rgb(15_23_42/0.25)]">
                        <SkillIcon skillName={s} size={13} />
                        {s}
                      </button>
                    ))}
                    {!has(query) && !suggestions.some((s) => s.toLowerCase() === query.trim().toLowerCase()) && (
                      <button type="button" onClick={() => addSkill(query)} className="inline-flex min-h-[34px] items-center gap-1 rounded-full px-3 text-[13px] font-medium text-[var(--accent)] hover:bg-[#f4f7ff]">
                        <Plus size={14} strokeWidth={2} />
                        Add “{query.trim()}”
                      </button>
                    )}
                  </div>
                )}

                {/* Current skills */}
                {skills.length === 0 ? (
                  <p className="mt-4 rounded-[12px] bg-slate-50 px-4 py-6 text-center text-[14px] text-slate-500">No skills yet. Search above to add one.</p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {skills.map((s, i) => {
                      const isFeatured = !!s.featured;
                      return (
                        <li
                          key={s.name}
                          className={clsx(
                            'flex flex-col gap-2.5 rounded-[12px] p-3 sm:flex-row sm:items-center',
                            isFeatured ? 'bg-[#fffbeb] shadow-[inset_0_0_0_1px_rgb(217_119_6/0.3)]' : 'bg-white shadow-[inset_0_0_0_1px_rgb(15_23_42/0.1)]'
                          )}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => toggleFeatured(i)}
                              aria-pressed={isFeatured}
                              aria-label={isFeatured ? `Unfeature ${s.name}` : `Feature ${s.name}`}
                              title={isFeatured ? 'Featured' : 'Feature this skill'}
                              className="-m-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-slate-900/[0.05]"
                            >
                              <Star size={17} strokeWidth={1.75} className={isFeatured ? 'fill-amber-400 text-amber-500' : 'text-slate-300'} />
                            </button>
                            <SkillIcon skillName={s.name} size={16} />
                            <span className="min-w-0 truncate text-[14px] font-medium text-slate-900">{s.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div role="radiogroup" aria-label={`${s.name} level`} className="grid flex-1 grid-cols-[1fr_1.35fr_1fr] gap-1 rounded-[9px] bg-slate-100 p-1 sm:flex-none">
                              {LEVELS.map((lv) => (
                                <button
                                  key={lv}
                                  type="button"
                                  role="radio"
                                  aria-checked={s.level === lv}
                                  onClick={() => setLevel(i, lv)}
                                  className={clsx(
                                    'min-h-[32px] whitespace-nowrap rounded-[7px] px-2 text-[12px] transition-colors',
                                    s.level === lv ? 'bg-white font-medium text-[var(--accent)] shadow-[var(--e1)]' : 'text-slate-500 hover:text-slate-900'
                                  )}
                                >
                                  {lv}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeSkill(i)}
                              aria-label={`Remove ${s.name}`}
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <X size={16} strokeWidth={1.75} />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            <footer className="flex flex-col-reverse gap-2 border-t border-slate-200/80 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="hidden text-[12px] text-slate-500 sm:block">Name and community role are set by your verified card.</p>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button type="button" onClick={onClose} className="s-btn s-btn-plain">Cancel</button>
                <button type="button" onClick={save} disabled={saving || !dirty} className="s-btn s-btn-accent min-w-[130px]">
                  {saving ? 'Saving…' : <><Check size={16} strokeWidth={2} />Save changes</>}
                </button>
              </div>
            </footer>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
