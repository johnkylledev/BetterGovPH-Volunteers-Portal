import { describe, it, expect } from 'vitest';
import {
  SPECIALIZATIONS, ROLE_GROUPS, CATCH_ALL_ROLE_ID, roleMatchingSkills,
} from '../../src/constants/specializations';
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

/*
 * Researcher & Analyst is the role an accountant or auditor signs up as, so it recommends finance
 * and mapping skills as well as research ones. That has a catch worth holding still: the browse
 * list opens on whichever category holds most of the role's skills, so a few more finance skills
 * here would quietly move every researcher's starting tab off research.
 */
describe('Researcher & Analyst', () => {
  const spec = SPECIALIZATIONS.find((s) => s.id === 'researcher')!;

  /** Mirrors categoryForRole in SkillsPicker: most overlap wins, earliest category breaks a tie. */
  const openingCategory = (): string => {
    const wanted = new Set([...spec.suggestedSkills, ...spec.requiredSkills].map((s) => s.toLowerCase()));
    let best = '';
    let bestScore = 0;
    for (const [name, list] of Object.entries(SKILL_CATEGORIES)) {
      const score = list.filter((sk) => wanted.has(sk.toLowerCase())).length;
      if (score > bestScore) { best = name; bestScore = score; }
    }
    return best;
  };

  it('recommends the finance and mapping skills', () => {
    for (const skill of ['Auditing', 'Accounting', 'Government Procurement', 'GIS & Mapping']) {
      expect(spec.suggestedSkills).toContain(skill);
    }
  });

  it('every recommended skill can also be found by browsing', () => {
    const missing = spec.suggestedSkills.filter((s) => !ALL_SKILLS.some((sk) => sk.toLowerCase() === s.toLowerCase()));
    expect(missing).toEqual([]);
  });

  it('still opens the browse list on research, not on finance', () => {
    expect(openingCategory()).toBe('Writing & Research');
  });

  it('two planning skills are enough to confirm the role', () => {
    const picked = [{ name: 'Urban & Regional Planning' }, { name: 'Environmental Planning' }];
    expect(roleMatchingSkills(spec, picked).length).toBeGreaterThanOrEqual(spec.minRequiredCount);
  });
});

/*
 * Sign-up refuses to go on until the volunteer holds `minRequiredCount` of their role's required
 * skills (Register.tsx, step 3). The skill list is wider than the role list — more than half of the
 * skills belong to no role's list — so without a role that accepts anything, someone whose
 * profession the roles do not cover picks the skills they have and is told to "select at least 1
 * relevant skills", with nothing on screen saying which ones would count. These hold the way out
 * open.
 */
describe('a volunteer the roles do not describe', () => {
  const catchAll = SPECIALIZATIONS.find((s) => s.id === CATCH_ALL_ROLE_ID)!;

  it('the catch-all role exists and asks for one skill', () => {
    expect(catchAll).toBeDefined();
    expect(catchAll.minRequiredCount).toBe(1);
  });

  it('can register under it with any single skill — every one in the list', () => {
    const refused = Object.values(SKILL_CATEGORIES).flat()
      .filter((skill) => roleMatchingSkills(catchAll, [{ name: skill }]).length < catchAll.minRequiredCount);
    expect(refused).toEqual([]);
  });

  it('can register with an engineering skill alone', () => {
    for (const skill of ['Civil Engineering', 'Structural Engineering', 'CAD / BIM', 'Occupational Safety']) {
      expect(roleMatchingSkills(catchAll, [{ name: skill }])).toHaveLength(1);
    }
  });

  it('can register with a skill the list has never heard of', () => {
    expect(roleMatchingSkills(catchAll, [{ name: 'Marine Biology' }])).toHaveLength(1);
  });

  it('no other role accepts a skill it does not name', () => {
    const wrong = SPECIALIZATIONS
      .filter((s) => s.id !== CATCH_ALL_ROLE_ID)
      .filter((s) => roleMatchingSkills(s, [{ name: 'Marine Biology' }]).length > 0)
      .map((s) => s.id);
    expect(wrong).toEqual([]);
  });
});

/*
 * The browse list opens on whichever category holds most of a role's skills, so editing any role's
 * skills can move a different role's starting tab without anyone touching that role. This is where
 * each one opens today; a change here is either deliberate or a bug.
 */
describe('opening browse tab per role', () => {
  const EXPECTED: Record<string, string> = {
    frontend: 'Software Engineering',
    backend: 'Software Engineering',
    fullstack: 'Software Engineering',
    design: 'Design & Creative',
    devops: 'DevOps & Infrastructure',
    data: 'Data & AI',
    security: 'Cybersecurity',
    pm: 'Professional & Others',
    content: 'Content & Media',
    writer: 'Writing & Research',
    educator: 'Education & Training',
    legal: 'Law & Policy',
    advocate: 'Advocacy & Community',
    researcher: 'Writing & Research',
    general: 'Advocacy & Community',
  };

  it('covers every role', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(SPECIALIZATIONS.map((s) => s.id).sort());
  });

  for (const spec of SPECIALIZATIONS) {
    it(`${spec.id} opens on ${EXPECTED[spec.id]}`, () => {
      const wanted = new Set([...spec.suggestedSkills, ...spec.requiredSkills].map((s) => s.toLowerCase()));
      let best = '';
      let bestScore = 0;
      for (const [name, list] of Object.entries(SKILL_CATEGORIES)) {
        const score = list.filter((sk) => wanted.has(sk.toLowerCase())).length;
        if (score > bestScore) { best = name; bestScore = score; }
      }
      expect(best).toBe(EXPECTED[spec.id]);
    });
  }
});
