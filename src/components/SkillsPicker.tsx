import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Check, Plus, Search, Target, X } from 'lucide-react';
import { SkillIcon } from './SkillIcon';
import { SPECIALIZATIONS } from '../constants/specializations';
import { SKILL_CATEGORIES, SkillCategory } from '../constants/skills';
import type { SkillLevel, UserSkill } from '../types';

const SKILL_LEVELS: SkillLevel[] = ['Learner', 'Practitioner', 'Expert'];

const CATEGORY_LABELS: Record<string, string> = {
  'Software Engineering': 'Engineering',
  'Design & Creative': 'Design',
  'Data & AI': 'Data & AI',
  'DevOps & Infrastructure': 'DevOps',
  'Cybersecurity': 'Security',
  'Professional & Others': 'Professional',
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
  const [activeSkillCategory, setActiveSkillCategory] = useState<SkillCategory>(
    Object.keys(SKILL_CATEGORIES)[0] as SkillCategory
  );

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
                  className="flex min-h-[48px] w-full items-center gap-3 px-3.5 py-2.5 text-left"
              >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
                      <SkillIcon skillName={skill} size={16} />
                  </span>
                  <span className="min-w-0 flex-1 break-words text-[14px] font-medium text-slate-900">{skill}</span>
                  <span
                      aria-hidden
                      className={clsx(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] transition-[background-color,box-shadow] duration-150',
                          isSelected ? 'bg-[var(--accent)] text-white' : 'shadow-[inset_0_0_0_1.5px_rgb(148_163_184)]'
                      )}
                  >
                      {isSelected && <Check size={12} strokeWidth={2.5} />}
                  </span>
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
          const verdict = score >= 70 ? 'Strong match' : score >= 40 ? 'Good start' : 'Add a few more';
          return (
              <div className="rounded-[12px] bg-slate-50 p-4 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.06)]">
                  <div className="flex items-center gap-3">
                      <SpecIcon size={18} strokeWidth={1.75} className="shrink-0 text-[var(--accent)]" aria-hidden />
                      <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium text-slate-900">{specialization}</p>
                          <p className="text-[12px] text-slate-500">{verdict} — based on the skills you pick below</p>
                      </div>
                      <span className="num shrink-0 text-[15px] font-semibold text-slate-900">{score}%</span>
                  </div>
                  <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-200" role="meter" aria-label="Role match" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score}>
                      <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500" style={{ width: `${score}%` }} />
                  </div>
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
              <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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

          <div
              className="no-scrollbar -mx-1 mt-3 overflow-x-auto px-1 pb-1"
              role="tablist"
              aria-label="Skill categories"
          >
              <div className="flex w-max gap-1.5">
                  {Object.keys(SKILL_CATEGORIES).map((category) => {
                      const isActive = activeSkillCategory === category;
                      return (
                          <button
                              key={category}
                              type="button"
                              role="tab"
                              aria-selected={isActive}
                              onClick={() => setActiveSkillCategory(category as SkillCategory)}
                              className={clsx(
                                  'min-h-[36px] shrink-0 whitespace-nowrap rounded-full px-3.5 text-[13px] transition-[background-color,color,box-shadow] duration-150',
                                  isActive
                                      ? 'bg-slate-900 font-medium text-white'
                                      : 'bg-white text-slate-600 shadow-[inset_0_0_0_1px_rgb(15_23_42/0.1)] hover:text-slate-900'
                              )}
                          >
                              {CATEGORY_LABELS[category] || category}
                          </button>
                      );
                  })}
              </div>
          </div>

          {(() => {
              const list = SKILL_CATEGORIES[activeSkillCategory as keyof typeof SKILL_CATEGORIES]
                  .filter(skill => skill.toLowerCase().includes(skillSearch.toLowerCase()));
              return list.length > 0 ? (
                  <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
