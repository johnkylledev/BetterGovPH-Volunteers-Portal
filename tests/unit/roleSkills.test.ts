import { describe, it, expect } from 'vitest';
import { SPECIALIZATIONS, ROLE_GROUPS } from '../../src/constants/specializations';
import { SKILL_CATEGORIES } from '../../src/constants/skills';

/*
 * A role is only usable if the skills it asks for can actually be picked.
 *
 * Registration will not let someone through until they hold `minRequiredCount` of their role's
 * `requiredSkills`, and the only place to get a skill is the skill picker, which lists
 * SKILL_CATEGORIES. Name a skill in one file that does not exist in the other and the role looks
 * fine in the picker but can never be completed — a dead end nobody would think to test by hand.
 *
 * The older roles predate the skill list and name a few things loosely ('React' where the category
 * says 'React / Next.js'), so this holds the newer professions to the stricter rule rather than
 * rewriting history.
 */

const ALL_SKILLS = new Set(Object.values(SKILL_CATEGORIES).flat().map((s) => s.toLowerCase()));
const STRICT = ['engineer', 'architect', 'accountant'];

describe('role skill lists', () => {
  for (const id of STRICT) {
    const spec = SPECIALIZATIONS.find((s) => s.id === id);

    it(`${id} is a role`, () => {
      expect(spec).toBeDefined();
    });

    it(`every skill ${id} requires can be picked`, () => {
      const missing = (spec?.requiredSkills ?? []).filter((s) => !ALL_SKILLS.has(s.toLowerCase()));
      expect(missing).toEqual([]);
    });

    it(`every skill ${id} suggests can be picked`, () => {
      const missing = (spec?.suggestedSkills ?? []).filter((s) => !ALL_SKILLS.has(s.toLowerCase()));
      expect(missing).toEqual([]);
    });

    it(`${id} can be satisfied — it asks for no more skills than it names`, () => {
      expect(spec!.requiredSkills.length).toBeGreaterThanOrEqual(spec!.minRequiredCount);
    });
  }
});

describe('role groups', () => {
  it('every role sits in a group the picker renders', () => {
    const groups = new Set<string>(ROLE_GROUPS.map((g) => g.id));
    const orphans = SPECIALIZATIONS.filter((s) => !groups.has(s.group ?? 'tech')).map((s) => s.id);
    expect(orphans).toEqual([]);
  });

  it('no group is empty', () => {
    const empty = ROLE_GROUPS.filter((g) => !SPECIALIZATIONS.some((s) => (s.group ?? 'tech') === g.id)).map((g) => g.id);
    expect(empty).toEqual([]);
  });

  it('role labels are unique — they are what gets stored on the member', () => {
    const labels = SPECIALIZATIONS.map((s) => s.label.toLowerCase());
    expect(new Set(labels).size).toBe(labels.length);
  });
});
