import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Check, Plus, Search, Target, X } from 'lucide-react';
import { SkillIcon } from './SkillIcon';
import { SPECIALIZATIONS } from '../constants/specializations';
import { SKILL_CATEGORIES, SkillCategory } from '../constants/skills';
import { useDragScroll } from '../hooks/useDragScroll';
import type { SkillLevel, UserSkill } from '../types';

const SKILL_LEVELS: SkillLevel[] = ['Learner', 'Practitioner', 'Expert'];

const CATEGORY_LABELS: Record<string, string> = {
  'Software Engineering': 'Engineering',
  'Design & Creative': 'Design',
  'Data & AI': 'Data & AI',
  'DevOps & Infrastructure': 'DevOps',
  'Cybersecurity': 'Security',
  'Content & Media': 'Content',
  'Writing & Research': 'Writing',
  'Education & Training': 'Education',
  'Law & Policy': 'Law & Policy',
  'Advocacy & Community': 'Advocacy',
  'Professional & Others': 'Professional',
};

const CATEGORY_KEYS = Object.keys(SKILL_CATEGORIES) as SkillCategory[];
const lower = (v: string) => v.toLowerCase();

/** The category holding most of a role's skills, so browsing opens where that role's skills live. */
const categoryForRole = (label: string): SkillCategory => {
  const spec = SPECIALIZATIONS.find((s) => s.label === label);
  if (!spec) return CATEGORY_KEYS[0];
  const wanted = new Set([...spec.suggestedSkills, ...spec.requiredSkills].map(lower));
  let best = CATEGORY_KEYS[0];
  let bestScore = 0;
  CATEGORY_KEYS.forEach((cat) => {
    const score = SKILL_CATEGORIES[cat].filter((sk) => wanted.has(lower(sk))).length;
    if (score > bestScore) { best = cat; bestScore = score; }
  });
  return best;
};

export interface SkillsPickerProps {
  skills: UserSkill[];
  onChange: (skills: UserSkill[]) => void;
  /** Currently selected primary role (a SPECIALIZATIONS label). Drives recommendations and role match. */
  specialization: string;
  onSpecializationChange: (label: string) => void;
  /** Marks the search input invalid (used by the onboarding validator). */
  invalid?: boolean;
  /** id of an element describing the current error. */
  describedBy?: string;
}

/**
 * The skills selection UI shared by onboarding (Register step 3) and the profile page,
 * so both screens look and behave identically.
 */
export const SkillsPicker: React.FC<SkillsPickerProps> = ({
  skills,
  onChange,
  specialization,
  onSpecializationChange,
  invalid,
  describedBy,
}) => {
  const [skillSearch, setSkillSearch] = useState('');
  const [otherSkill, setOtherSkill] = useState('');
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [activeSkillCategory, setActiveSkillCategory] = useState<SkillCategory>(() => categoryForRole(specialization));
  // The category row hides its scrollbar; on a desktop it needs drag and wheel to be reachable.
  const tabs = useDragScroll<HTMLDivElement>();
  const tabsScrollRef = tabs.ref;
  const tabRefs = useRef<Partial<Record<SkillCategory, HTMLButtonElement | null>>>({});

  // Changing the primary role jumps the browser to that role's category.
  useEffect(() => {
    if (specialization) setActiveSkillCategory(categoryForRole(specialization));
  }, [specialization]);

  // Searching follows the results: if this category has no match, move to the first one that does.
  useEffect(() => {
    const q = lower(skillSearch.trim());
    if (!q) return;
    const hasHere = SKILL_CATEGORIES[activeSkillCategory].some((sk) => lower(sk).includes(q));
    if (hasHere) return;
    const next = CATEGORY_KEYS.find((cat) => SKILL_CATEGORIES[cat].some((sk) => lower(sk).includes(q)));
    if (next) setActiveSkillCategory(next);
  }, [skillSearch, activeSkillCategory]);

  // Keep the active category chip visible in the horizontal row (without scrolling the page).
  useEffect(() => {
    const row = tabsScrollRef.current;
    const tab = tabRefs.current[activeSkillCategory];
    if (!row || !tab) return;
    const target = tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [activeSkillCategory]);

  // How many picked skills sit in each category, shown on its chip.
  const pickedPerCategory = useMemo(() => {
    const picked = new Set(skills.map((sk) => lower(sk.name)));
    const out: Partial<Record<SkillCategory, number>> = {};
    CATEGORY_KEYS.forEach((cat) => {
      const n = SKILL_CATEGORIES[cat].filter((sk) => picked.has(lower(sk))).length;
      if (n) out[cat] = n;
    });
    return out;
  }, [skills]);

  const { roleScores, betterRoleSuggestion } = useMemo(() => {
    const scores: Record<string, number> = {};
    if (skills.length === 0) return { roleScores: scores, betterRoleSuggestion: null as string | null };
    SPECIALIZATIONS.forEach((spec) => {
      const matching = skills.filter((s) => spec.requiredSkills.some((rs) => rs.toLowerCase() === s.name.toLowerCase()));
      scores[spec.label] = Math.min(100, Math.round((matching.length / spec.minRequiredCount) * 100));
    });
    const current = scores[specialization] || 0;
    const best = Object.entries(scores).reduce((a, b) => (a[1] > b[1] ? a : b));
    return {
      roleScores: scores,
      betterRoleSuggestion: best[0] !== specialization && best[1] > current + 20 ? best[0] : null,
    };
  }, [skills, specialization]);

  const renderSkillItem = (skill: string, sectionContext: string = 'default') => {
      const selectedSkill = skills.find(s => s.name === skill);
      const isSelected = !!selectedSkill;
      const toggle = () => {
          onChange(isSelected
                  ? skills.filter(s => s.name !== skill)
                  : [...skills, { name: skill, level: 'Learner' }]);
      };
      const setLevel = (level: SkillLevel) => {
          onChange(skills.map(s => (s.name === skill ? { ...s, level } : s)));
      };

      return (
          <div
              key={`${sectionContext}-${skill}`}
              className={clsx(
                  'rounded-[12px] transition-[box-shadow,background-color] duration-150',
                  isSelected
                      ? 'bg-[#f4f7ff] shadow-[0_0_0_2px_var(--accent)]'
                      : 'bg-white shadow-[0_0_0_1px_rgb(15_23_42/0.12),0_1px_2px_rgb(15_23_42/0.04)] [@media(hover:hover)]:hover:shadow-[0_0_0_1px_rgb(15_23_42/0.2),0_4px_12px_-4px_rgb(15_23_42/0.12)]'
              )}
          >
              <button
                  type="button"
                  onClick={toggle}
                  aria-pressed={isSelected}
                  className="group flex min-h-[52px] w-full items-center gap-3 rounded-[12px] px-3.5 py-2.5 text-left focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgb(30_58_138/0.3)]"
              >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
                      <SkillIcon skillName={skill} size={16} />
                  </span>
                  <span className="min-w-0 flex-1 break-words text-[14px] font-medium text-slate-900">{skill}</span>
                  {isSelected ? (
                      <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-white">
                          <Check size={13} strokeWidth={2.75} />
                      </span>
                  ) : (
                      <span
                          aria-hidden
                          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full pl-2 pr-2.5 text-[12.5px] font-medium text-slate-500 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.12)] transition-[color,box-shadow,background-color] duration-150 group-hover:bg-[#f4f7ff] group-hover:text-[var(--accent)] group-hover:shadow-[inset_0_0_0_1px_rgb(30_58_138/0.35)]"
                      >
                          <Plus size={13} strokeWidth={2.25} />
                          Add
                      </span>
                  )}
              </button>

              {isSelected && (
                  <div className="px-3.5 pb-3">
                      <div role="radiogroup" aria-label={`${skill} level`} className="grid grid-cols-[1fr_1.35fr_1fr] gap-1 rounded-[9px] bg-white p-1 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.08)]">
                          {SKILL_LEVELS.map((level) => {
                              const isActive = selectedSkill?.level === level;
                              return (
                                  <button
                                      key={level}
                                      type="button"
                                      role="radio"
                                      aria-checked={isActive}
                                      onClick={() => setLevel(level)}
                                      className={clsx(
                                          'min-h-[34px] min-w-0 whitespace-nowrap rounded-[7px] px-1.5 text-[12px] transition-[background-color,color] duration-150 focus-visible:outline-offset-0',
                                          isActive ? 'bg-[var(--accent)] font-medium text-white' : 'text-slate-500 hover:text-slate-900'
                                      )}
                                  >
                                      {level}
                                  </button>
                              );
                          })}
                      </div>
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="space-y-9">
      {specialization && (() => {
          const spec = SPECIALIZATIONS.find(s => s.label === specialization);
          const SpecIcon = spec?.icon || Target;
          const score = roleScores[specialization] || 0;
          const needed = spec?.minRequiredCount ?? 3;
          const matched = skills.filter((s) => spec?.requiredSkills.some((rs) => rs.toLowerCase() === s.name.toLowerCase()));
          const remaining = Math.max(0, needed - matched.length);
          const verdict =
              score >= 70
                  ? { word: 'Strong match', tone: 'bg-emerald-50 text-emerald-800 shadow-[inset_0_0_0_1px_rgb(16_185_129/0.3)]' }
                  : score >= 40
                    ? { word: 'Good start', tone: 'bg-[#eef3ff] text-[var(--accent)] shadow-[inset_0_0_0_1px_rgb(30_58_138/0.2)]' }
                    : { word: 'Getting started', tone: 'bg-slate-100 text-slate-600' };
          return (
              <div className="s-card p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                      <SpecIcon size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden />
                      <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] font-semibold text-slate-900">
                              {specialization}
                              <span className={clsx('rounded-full px-2 py-0.5 text-[11.5px] font-medium', verdict.tone)}>{verdict.word}</span>
                          </p>
                          <p className="mt-0.5 text-[13px] text-slate-500">
                              {remaining > 0
                                  ? `Pick ${remaining} more ${remaining === 1 ? 'skill' : 'skills'} used in this role.`
                                  : 'You have the core skills for this role.'}
                          </p>
                      </div>
                      <span className="num shrink-0 text-[15px] font-semibold text-slate-900" aria-label={`${Math.min(matched.length, needed)} of ${needed} core skills`}>
                          {Math.min(matched.length, needed)}<span className="font-normal text-slate-400">/{needed}</span>
                      </span>
                  </div>

                  {/* Core-skill slots: filled by matching picks, dashed while empty */}
                  <ul className="mt-4 flex flex-wrap gap-2" aria-label="Core skills for this role">
                      {matched.slice(0, needed).map((s) => (
                          <li key={s.name} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white pl-2 pr-3 text-[13px] font-medium text-slate-800 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.12)]">
                              <SkillIcon skillName={s.name} size={14} />
                              {s.name}
                          </li>
                      ))}
                      {Array.from({ length: remaining }).map((_, i) => (
                          <li key={`slot-${i}`} className="inline-flex h-8 items-center gap-1 rounded-full border-[1.5px] border-dashed border-slate-300 px-3 text-[13px] text-slate-400">
                              <Plus size={13} strokeWidth={2} aria-hidden />
                              Open slot
                          </li>
                      ))}
                      {matched.length > needed && (
                          <li className="inline-flex h-8 items-center rounded-full bg-slate-100 px-3 text-[13px] text-slate-600">
                              +{matched.length - needed} more
                          </li>
                      )}
                  </ul>
                  <AnimatePresence initial={false}>
                      {betterRoleSuggestion && (
                          <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                              className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3"
                          >
                              <p className="text-[13px] text-slate-600">
                                  Your skills fit <span className="font-medium text-slate-900">{betterRoleSuggestion}</span> better.
                              </p>
                              <button
                                  type="button"
                                  onClick={() => onSpecializationChange(betterRoleSuggestion)}
                                  className="s-btn s-btn-plain h-8 px-3 text-[13px]"
                              >
                                  Switch role
                              </button>
                          </motion.div>
                      )}
                  </AnimatePresence>
              </div>
          );
      })()}

      {specialization && (
          <section aria-labelledby="rec-title">
              <h3 id="rec-title" className="text-[15px] font-semibold text-slate-900">Recommended for {specialization}</h3>
              <p className="mt-1 text-[13px] text-slate-500">Tap the ones you use, then set how comfortable you are.</p>
              <div className="mt-4 grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2">
                  {SPECIALIZATIONS.find(s => s.label === specialization)?.suggestedSkills.map(skill => (
                      renderSkillItem(skill, 'recommended')
                  ))}
              </div>
          </section>
      )}

      <section aria-labelledby="browse-title">
          <div className="flex items-baseline justify-between gap-3">
              <h3 id="browse-title" className="text-[15px] font-semibold text-slate-900">Browse all skills</h3>
              <span className="text-[12px] text-slate-400">optional</span>
          </div>
          <div className="relative mt-4">
              <label htmlFor="field-skill-search" className="sr-only">Search skills</label>
              <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                  id="field-skill-search"
                  type="search"
                  placeholder="Search skills"
                  value={skillSearch}
                  onChange={(e) => setSkillSearch(e.target.value)}
                  aria-invalid={invalid || undefined}
                  aria-describedby={describedBy}
                  className="s-field h-11 pl-10 text-[15px]"
              />
          </div>

          <div className="relative -mx-1">
          {/* Edge fades hint that the row keeps going. */}
          {!tabs.atStart && <span aria-hidden className="pointer-events-none absolute left-0 top-0 z-10 h-full w-8 bg-gradient-to-r from-[var(--card)] to-transparent" />}
          {!tabs.atEnd && <span aria-hidden className="pointer-events-none absolute right-0 top-0 z-10 h-full w-8 bg-gradient-to-l from-[var(--card)] to-transparent" />}
          <div
              ref={tabsScrollRef}
              {...tabs.dragProps}
              className={clsx('no-scrollbar mt-3 overflow-x-auto px-1 pb-1', tabs.dragging ? 'cursor-grabbing select-none' : 'sm:cursor-grab')}
              role="tablist"
              aria-label="Skill categories"
          >
              <div className="flex w-max gap-1.5">
                  {Object.keys(SKILL_CATEGORIES).map((category) => {
                      const isActive = activeSkillCategory === category;
                      const picked = pickedPerCategory[category as SkillCategory] ?? 0;
                      return (
                          <button
                              key={category}
                              ref={(el) => { tabRefs.current[category as SkillCategory] = el; }}
                              type="button"
                              role="tab"
                              aria-selected={isActive}
                              onClick={() => setActiveSkillCategory(category as SkillCategory)}
                              className={clsx(
                                  'inline-flex min-h-[36px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] transition-[background-color,color,box-shadow] duration-150',
                                  isActive
                                      ? 'bg-slate-900 font-medium text-white'
                                      : 'bg-white text-slate-600 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.1)] hover:text-slate-900'
                              )}
                          >
                              {CATEGORY_LABELS[category] || category}
                              {picked > 0 && (
                                  <span
                                      className={clsx(
                                          'num flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold',
                                          isActive ? 'bg-white/20 text-white' : 'bg-[var(--accent)] text-white'
                                      )}
                                      aria-label={`${picked} picked`}
                                  >
                                      {picked}
                                  </span>
                              )}
                          </button>
                      );
                  })}
              </div>
          </div>
          </div>

          {(() => {
              const list = SKILL_CATEGORIES[activeSkillCategory as keyof typeof SKILL_CATEGORIES]
                  .filter(skill => skill.toLowerCase().includes(skillSearch.toLowerCase()));
              return list.length > 0 ? (
                  <div className="mt-4 grid grid-cols-1 items-start gap-2.5 sm:grid-cols-2">
                      {list.map((skill) => renderSkillItem(skill, 'explore'))}
                  </div>
              ) : (
                  <p className="mt-4 rounded-[12px] bg-slate-50 px-4 py-6 text-center text-[14px] text-slate-500">
                      No “{skillSearch}” in {CATEGORY_LABELS[activeSkillCategory] || activeSkillCategory}. Try another category or add it below.
                  </p>
              );
          })()}

          <div className="mt-4">
              {!showOtherInput ? (
                  <button
                      type="button"
                      onClick={() => setShowOtherInput(true)}
                      className="inline-flex min-h-[40px] items-center gap-1.5 text-[14px] font-medium text-[var(--accent)]"
                  >
                      <Plus size={16} strokeWidth={1.75} />
                      Add a skill that isn’t listed
                  </button>
              ) : (
                  <div className="flex flex-col gap-2 sm:flex-row">
                      <label htmlFor="field-other-skill" className="sr-only">Skill name</label>
                      <input
                          id="field-other-skill"
                          type="text"
                          placeholder="Skill name"
                          autoFocus
                          value={otherSkill}
                          onChange={(e) => setOtherSkill(e.target.value)}
                          className="s-field h-11 flex-1 text-[15px]"
                          onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (otherSkill.trim() && !skills.some(s => s.name.toLowerCase() === otherSkill.trim().toLowerCase())) {
                                      onChange([...skills, { name: otherSkill.trim(), level: 'Learner' }]);
                                      setOtherSkill('');
                                      setShowOtherInput(false);
                                  }
                              }
                              if (e.key === 'Escape') setShowOtherInput(false);
                          }}
                      />
                      <div className="grid grid-cols-2 gap-2 sm:flex">
                          <button
                              type="button"
                              onClick={() => {
                                  if (otherSkill.trim() && !skills.some(s => s.name.toLowerCase() === otherSkill.trim().toLowerCase())) {
                                      onChange([...skills, { name: otherSkill.trim(), level: 'Learner' }]);
                                      setOtherSkill('');
                                      setShowOtherInput(false);
                                  }
                              }}
                              className="s-btn s-btn-accent h-11"
                          >
                              Add
                          </button>
                          <button type="button" onClick={() => setShowOtherInput(false)} className="s-btn s-btn-plain h-11">
                              Cancel
                          </button>
                      </div>
                  </div>
              )}
          </div>
      </section>

      <section aria-labelledby="picked-title" className="border-t border-slate-200/80 pt-6">
          <div className="flex items-center justify-between gap-3">
              <h3 id="picked-title" className="text-[15px] font-semibold text-slate-900">
                  Your skills <span className="num font-normal text-slate-400">{skills.length}</span>
              </h3>
              {skills.length > 0 && (
                  <button
                      type="button"
                      onClick={() => onChange([])}
                      className="min-h-[36px] text-[13px] text-slate-500 hover:text-red-600"
                  >
                      Clear all
                  </button>
              )}
          </div>
          {skills.length === 0 ? (
              <p className="mt-3 text-[14px] text-slate-500">Nothing picked yet. Choose at least one skill to continue.</p>
          ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                  {skills.map((skill) => (
                      <li
                          key={skill.name}
                          className="inline-flex items-center gap-2 rounded-full bg-white py-1 pl-2.5 pr-1 text-[13px] shadow-[inset_0_0_0_1px_rgb(15_23_42/0.1)]"
                      >
                          <SkillIcon skillName={skill.name} size={13} />
                          <span className="font-medium text-slate-800">{skill.name}</span>
                          <span className="text-[12px] text-slate-400">{skill.level}</span>
                          <button
                              type="button"
                              aria-label={`Remove ${skill.name}`}
                              onClick={() => onChange(skills.filter(s => s.name !== skill.name))}
                              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          >
                              <X size={13} strokeWidth={2} />
                          </button>
                      </li>
                  ))}
              </ul>
          )}
      </section>
    </div>
  );
};
