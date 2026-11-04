# Implementation Plan: Inclusive onboarding (dev + non-dev volunteers)

Status: approved, not started. Product requirements (what and why): [volunteer-onboarding-requirements.md](volunteer-onboarding-requirements.md). This document is the how.

## Context
Register (`src/pages/auth/Register.tsx`, 4 steps) is developer-centric: 8 tech "specializations", a tech-only skill catalog, and step-3 validation that requires role-specific skill names (`minRequiredCount`, full-stack balance). Non-devs (researchers, writers, organizers, lawyers…) can't express themselves. Goal: adopt the BetterGov Civic Tech taxonomy (12 role families, ~70 skills, 12 causes, 7 contribution types, availability) with "Everyone can contribute, even if you don't code."

Decisions (from user): keep the 8 specializations and layer families on top; store causes, contribution types, availability, and optional links/location/languages as first-class data; keep skill-gate validation for Software Engineering family only; add optional social URLs (Facebook, Instagram, TikTok, YouTube, X, GitHub, Discord).

Key findings that shape the design
- `users.skills` is jsonb `[{name, level}]`, `specialization` is free text, no CHECK constraints → additive migration is safe.
- `isProfileComplete` is triplicated (`src/App.tsx:19`, `src/components/Navbar.tsx:9`, `Register.tsx:186/213`); requires fullName, specialization, yearJoined, discordConnected. Non-devs must still end with a non-empty `specialization`.
- `handler_me` (`api/[...path].ts:499-579`) doesn't validate skills/levels/enum values, and silently drops `role` on update (bug; fix while here).
- `mapUserRow` (`api/[...path].ts:128`), `mapToAppUser`/`mapToDbUser` (`src/services/supabase.ts:158-203`) and `updateCurrentUserFromSupabase` (`src/store/useStore.ts:86`) must all learn new fields (the store one already drops Discord fields).
- Specialization `requiredSkills` names ("React") don't match catalog names ("React / Next.js"), so catalog picks don't count today. Fix by normalizing.
- GitHub linking plan (`plans/github-account-linking.md`) owns `github_*` columns/OAuth linking. Here we only add a *self-reported, optional* GitHub URL; no collision with `github_username`.
- Admin filter on `specialization` (`api/[...path].ts:646`), AccessCard, Verify all read `specialization` — keep it populated.

## Framework: Civic Tech & Digital Volunteer Taxonomy
An application-layer taxonomy (not an official standard) built for BetterGov's mission: making PH government information and services accessible, transparent and usable through open-source, volunteer-led tech. Five independent dimensions, each captured separately so they can be combined for matching:

| Dimension | What it answers | Size | Cardinality |
|---|---|---|---|
| Role family (+ specific role) | What kind of work do you do? | 12 families | 1 primary family, 1 specific role |
| Skills (+ level) | What can you do? | ~60–80 curated, 6 groups | many, each with Learner/Practitioner/Expert |
| Civic causes | What do you care about? | 12 | many |
| Contribution types | How do you want to help? | 7 (Builder, Researcher, Contributor, Advocate, Organizer, Mentor, Supporter) | many |
| Experience + availability | How much / how deep? | 4 levels, 4 time bands | 1 each |

Families: Software Engineering; Data & AI; Design & UX; Research & Public Policy; Open Data & Transparency; Product & Project Mgmt; Content & Communications; Community & Advocacy; Digital Public Services; Legal, Governance & Compliance; Education & Digital Literacy; Operations & Partnerships.
Causes: Good Governance, Open Data, Public Spending, Democracy & Elections, Digital Government, Education, Healthcare, Infrastructure, Environment & Energy, Justice & Human Rights, Local Communities, Digital Inclusion.
Conceptual model: `Volunteer → Roles → Skills → Causes → Projects → Contributions` (roles/skills many-to-many). Contribution records (who fixed bugs, verified datasets, wrote docs, mentored) are a later phase; this plan only captures the profile side and leaves room for it (see GitHub contribution scoring in `api/_lib/contributionScoring.ts`).
Standards alignment (reference only, no hard dependency): skills vocabulary ↔ ESCO, roles ↔ ISCO-08/ESCO occupations, volunteering concepts ↔ UNV, causes ↔ UN SDGs adapted. We keep our own short vocabulary and store stable ids so an ESCO mapping can be added later without re-collecting data.

## Rationale
- **Mission fit over generic nonprofit categories.** BetterGov's existing opportunities already span developers, data engineers, researchers, designers and community amplifiers, and its fellowship work covers datasets, APIs, budget transparency and service delivery. A civic-tech vocabulary maps directly to those projects; a generic volunteer taxonomy ("Admin", "Events") would not.
- **Principle: "Everyone can contribute, even if they don't code."** Today a non-dev cannot finish onboarding without pretending to be a developer (tech-only specializations, skill gate). That both excludes people and pollutes the registry with inaccurate skill data.
- **Separate dimensions beat one big role list.** Role (work), skills (ability), causes (motivation) and contribution type (mode of help) vary independently: a backend dev may want to work only on education transparency; a lawyer may want to mentor, not build. Splitting them enables volunteer-to-project/call matching later (volunteer calls today only have free-text `rolesNeeded`).
- **Fit with the current code.** Additive columns, stable ids, `specialization` kept populated → admin filters, AccessCard, Verify and the completeness guard keep working; existing members are not forced back through onboarding.
- **Right size.** 12/70/12/7 gives enough resolution for matching without a long skills inventory at signup.

## User experience
Design goals: short, progressive, no one is told they are in the wrong place.
- **Required path stays 4 steps** (identity → how you want to help → skills & interests → connect Discord). Everything beyond the minimum is optional and collapsed.
- **Non-dev first-class:** family cards show example roles and a "No coding required" tag where applicable; the stack/role-match panel and skill-count gate only appear for Software Engineering-type families; a non-dev with 1 skill and levels can finish.
- **Cause-first motivation:** the reference prototype leads with "What civic cause interests you?" (chip grid) and finishes with experience + weekly availability. We adopt this tone: causes are tappable chips with one-line descriptions; availability and experience are simple segmented buttons. (We keep identity first because Google sign-in/name/year already live there.)
- **Skills are filtered, not hidden:** picker defaults to the chosen family's groups, with search across all groups and custom skills, so a designer who also knows SQL can add it.
- **Optional "Links & about you":** location, languages and social URLs (Facebook, Instagram, TikTok, YouTube, X, GitHub, Discord handle, portfolio), collapsed by default, never blocking.
- **Existing members:** dismissible dashboard banner to enrich their profile; no forced redirect.
- **Drafts and errors:** session draft extended to new fields; inline validation messages that say what is missing in plain language.

## Tradeoffs
| Decision | Gain | Cost / risk | Mitigation |
|---|---|---|---|
| Layer families over the 8 specializations (user's choice) instead of replacing | No migration of existing labels, admin filter/AccessCard/Verify untouched, low risk | Two vocabularies to maintain; `specialization` semantics become "specific role" and overlap with family | Single `roleFamilies.ts` as source of truth mapping specializations → families; backfill `role_family` |
| 12 families (granular) vs fewer | Better matching and clearer self-identification | More cards = more choice overload; some overlap (Research vs Open Data vs Digital Public Services) | Group visually, short descriptions, allow one primary only, revisit after usage data |
| Skill gate only for Software Engineering | Preserves quality signal for devs; unblocks others | Non-dev skill claims are unverified; inconsistent rules across families | Soft hints, admin review remains the quality gate; levels are self-reported |
| First-class columns (jsonb arrays) vs join tables | Fast to ship, matches existing `skills jsonb`, simple API | Harder to query/aggregate and enforce referential integrity; no per-contribution history | Stable ids + validation in `handler_me`; add `contributions` table in a later phase |
| Store ids, validate against enums server-side | Prevents junk and enables future ESCO mapping | Server and client constants must stay in sync | Share constants between `src/` and `api/_lib` where practical, unit-test validators |
| Custom 4/3-level rubrics vs ESCO/ISCO adoption | Simple, readable, mission-specific | Not interoperable out of the box; subjective levels | Keep ids stable; map to ESCO later if needed |
| Optional social links | Richer profile, portfolio signal, outreach channels | PII/privacy and spam/XSS risk, more fields to maintain | Optional, https/handle sanitization, never shown publicly (Verify/AccessCard), explicit consent copy |
| Self-reported GitHub URL vs OAuth linking | Works now for any volunteer | Unverified; may diverge from the verified `github_username` in the linking plan | Label as "profile link"; defer verification to `plans/github-account-linking.md` |
| Soft completeness (no new required fields) | Existing members unaffected, no onboarding regressions | Low fill rate of new fields | Banner/nudges, admin export to monitor adoption |
| Larger Register changes in a 1,735-line file | Delivers the UX | Regression risk in the only onboarding path | Extract step components, phase 1 is backend-only, manual QA matrix for dev/non-dev paths |

## Data model
New migration `supabase/migrations/<ts>_add_volunteer_profile.sql` (additive, all nullable/defaulted):
- `role_family text` (id of one of 12 families)
- `contribution_types jsonb default '[]'` (ids: builder, researcher, contributor, advocate, organizer, mentor, supporter)
- `causes jsonb default '[]'` (12 ids)
- `weekly_availability text` (`1-2`,`3-5`,`5-10`,`10+`)
- `location text`, `languages jsonb default '[]'`
- `links jsonb default '{}'` keys: `facebook, instagram, tiktok, youtube, x, github, discord, portfolio` (URLs/handles)
- Backfill: map existing `specialization` labels → `role_family` (Frontend/Backend/Full Stack/DevOps/Security → software-engineering; Data & AI → data-ai; UI/UX → design-ux; Project Manager → product-pm). No data loss.
- Skills stay `[{name, level}]`; add optional `id` later if ESCO mapping is wanted (out of scope).

Semantics: `specialization` = the specific role label. Tech families: one of the existing 8 labels (unchanged). Other families: a role from the taxonomy (e.g. "Policy Researcher") or the family label. Always non-empty → completeness and admin filters unchanged.

## Constants (new, in `src/constants/`)
- `roleFamilies.ts`: 12 families `{id, label, icon, description, roles[], skillCategories[], gated: boolean}`; `gated` true only for software-engineering (keeps `minRequiredCount`/full-stack rules from `specializations.ts`). Map the 8 existing specializations into their families by `familyId`.
- `skills.ts`: extend `SKILL_CATEGORIES` to the 6 taxonomy groups (Software Eng, Data & AI, Design & UX, Research & Governance, Communications & Community, Management & Professional), keeping existing tech names and adding the ~60-80 curated skills; add a per-family `suggestedSkills`. Normalize name matching (lowercase, alias map e.g. "React" ↔ "React / Next.js") in a shared `matchesSkill()` util.
- `causes.ts` (12), `contributionTypes.ts` (7), `availability.ts` (4), `socialLinks.ts` (platform → label, icon, URL/handle validator).
- Types in `src/types/index.ts`: `RoleFamilyId`, `ContributionType`, `CauseId`, `WeeklyAvailability`, `SocialLinks`; extend `User`.

## Frontend: Register flow (progressive disclosure, still ≤4 required steps)
1. **Who you are** — unchanged (name, year).
2. **How you want to help** — pick role family (12 cards, "No coding required" badges on non-dev), then specific role (tech families: the existing 8 cards; others: role chips + "Other"), contribution types (multi-select), experience level, weekly availability.
3. **Skills & interests** — skill picker filtered to the family's categories (all categories still searchable), per-skill level; causes (multi-select chips). Validation: ≥1 skill + levels for everyone; skill-gate rules only when `gated`; role-match panel shown only for gated families.
4. **Connect** — Discord required (unchanged); optional "Links & about you": location, languages, social URLs (Facebook, Instagram, TikTok, YouTube, X, GitHub, Discord handle, portfolio) collapsed by default; replace GitHub "Soon" placeholder reference but leave OAuth linking to the GitHub plan.
- Extend draft persistence (`bgph-register-draft`) with new fields. Extract Register sub-sections into components to keep file manageable (file is 1735 lines) — only as needed for the new steps.
- Dedupe `isProfileComplete` into `src/utils/profile.ts`; use in App, Navbar, Register. Rule unchanged (family/other fields optional so existing users aren't forced back to /register); prompt existing users via a dismissible dashboard banner "Complete your volunteer profile".

## Backend
- `handler_me` POST: validate against enums (role_family, contribution_types, causes, availability), cap array sizes/string lengths, validate skills `{name<=80, level in enum}`, sanitize links (https URL or handle per platform; reject `javascript:`), persist `role` correctly (fix the dropped-role bug).
- `mapUserRow`, `mapToAppUser`, `mapToDbUser`, `updateCurrentUserFromSupabase`, `createOrUpdateUserRecord`: add fields (and Discord fields in the store).
- Admin: add `role_family` filter + skills search; show family, contribution types, causes, availability in detail modals and CSV export (`AdminDashboard.tsx` ~324, 543, 1065-1109, 1307-1346).
- UserDashboard: add a profile-editing surface (currently view-only) so non-devs and existing users can fill new fields; show family/causes/availability; badges unaffected.
- Public Verify/AccessCard: show role family label only; do not expose links/availability publicly.
- Landing/Contribute role cards: source from `roleFamilies.ts` instead of hardcoded lists, with "Everyone can contribute" copy.

## Phasing
1. Constants + types + migration + API/mappers (no UI change; backwards compatible).
2. Register redesign + shared `isProfileComplete`.
3. Dashboard profile editor + banner for existing users.
4. Admin filters/export; Landing/Contribute copy.

## Verification
- `npm run check`, `npm run lint`, `npm run build`, `npm test`.
- Add vitest unit tests (node env, `tests/unit/`): skill-name matching/aliases, gated-vs-ungated validation, link sanitizer, `handler_me` payload validation extracted into a pure function.
- Apply migration to local Supabase (`supabase/migrations`); confirm existing rows backfill `role_family`.
- `npm run dev:full`, then manually via `/browse`: register as (a) Frontend dev (gate still enforced), (b) Policy researcher with no coding skills (passes with 1 skill), (c) Content/Comms volunteer; verify draft restore, Discord step, optional links saving, dashboard display, admin filter/CSV, Verify page unchanged, existing complete users not redirected to /register.

## Open items / risks
- Production schema and RLS aren't in the repo; confirm column additions with the Supabase owner before applying (see `plans/supabase-github-setup.md`).
- Skill taxonomy exact list (~60-80) to be finalized from the pasted proposal during phase 1.
- Coordinate with `plans/github-account-linking.md` so `links.github` (self-reported) and `github_username` (verified) don't diverge in the UI.
