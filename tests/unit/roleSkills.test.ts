import { describe, it, expect } from 'vitest';
import { SPECIALIZATIONS, ROLE_GROUPS } from '../../src/constants/specializations';
import { SKILL_CATEGORIES } from '../../src/constants/skills';

/*
 * The two lists behind the sign-up form: the roles someone can pick, and the skills they back the
 * role up with. Both are hand-edited, both are rendered by several pages, and a mistake in either
 * shows up as a form that cannot be completed rather than as an error — so the invariants that
 * keep them usable are checked here.
 */

const ALL_SKILLS = Object.values(SKILL_CATEGORIES).flat();

describe('skill list', () => {
  it('no skill is listed in two categories', () => {
    const seen = new Map<string, number>();
    for (const skill of ALL_SKILLS) {
      const key = skill.toLowerCase();
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    expect([...seen].filter(([, n]) => n > 1).map(([name]) => name)).toEqual([]);
  });

  it('no category is empty — the picker gives each one a tab', () => {
    const empty = Object.entries(SKILL_CATEGORIES).filter(([, list]) => list.length === 0).map(([name]) => name);
    expect(empty).toEqual([]);
  });
});

describe('role list', () => {
  it('every role sits in a group the picker renders', () => {
    const groups = new Set<string>(ROLE_GROUPS.map((g) => g.id));
    const orphans = SPECIALIZATIONS.filter((s) => !groups.has(s.group ?? 'tech')).map((s) => s.id);
    expect(orphans).toEqual([]);
  });

  it('no group is empty', () => {
    const empty = ROLE_GROUPS.filter((g) => !SPECIALIZATIONS.some((s) => (s.group ?? 'tech') === g.id)).map((g) => g.id);
    expect(empty).toEqual([]);
  });

  it('role labels are unique — the label is what gets stored on the member', () => {
    const labels = SPECIALIZATIONS.map((s) => s.label.toLowerCase());
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('every role can be satisfied — none asks for more skills than it names', () => {
    const impossible = SPECIALIZATIONS
      .filter((s) => s.requiredSkills.length < s.minRequiredCount)
      .map((s) => s.id);
    expect(impossible).toEqual([]);
  });
});
