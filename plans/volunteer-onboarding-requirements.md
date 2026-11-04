# Volunteer Onboarding: Requirements (What and Why)

Status: proposed. Technical approach: see the implementation plan.

## Background
BetterGov.ph exists to make Philippine government information and services easier to find, understand and use, through open-source work done by volunteers. Our volunteers are not only programmers. They are also researchers, designers, writers, data checkers, translators, community organizers, lawyers, trainers and more.

Today our sign-up asks everyone to describe themselves as a developer. A researcher or community organizer has to pick a tech role and list tech skills just to join. That turns away people we want, and it gives us inaccurate information about who our volunteers really are.

## Goal
Anyone who wants to help can join and describe how they can contribute, whether or not they write code. "Everyone can contribute, even if they don't code."

## Objectives
1. **Welcome non-developers.** A researcher, writer or organizer can finish sign-up without pretending to be a developer.
2. **Know our volunteers better.** Capture what kind of work people do, what they are good at, which public issues they care about, how they want to help, and how much time they have.
3. **Make matching possible.** When a project or volunteer call needs, say, a budget analyst interested in public spending, we can find the right people instead of guessing.
4. **Keep sign-up short.** Required steps stay few; extra details are optional and can be added later.
5. **Don't disrupt existing members.** Current volunteers keep their access and records, and can enrich their profiles whenever they like.

## What we want to capture
- **Type of work (role family).** One of 12 areas, for example Software Engineering, Data & AI, Design & UX, Research & Public Policy, Open Data & Transparency, Product & Project Management, Content & Communications, Community & Advocacy, Digital Public Services, Legal & Governance, Education & Digital Literacy, Operations & Partnerships.
- **Skills and how strong they are.** Pick from a short curated list (roughly 60 to 80), each rated as learner, practitioner or expert.
- **Causes they care about.** For example good governance, open data, public spending, education, healthcare, digital inclusion. (12 in total.)
- **How they want to help.** Builder, Researcher, Contributor, Advocate, Organizer, Mentor, Supporter. People can be more than one.
- **Experience and weekly time.** Beginner to professional, and roughly 1 to 2, 3 to 5, 5 to 10 or 10+ hours a week.
- **Optional extras.** Location, languages, and links to social profiles (Facebook, Instagram, TikTok, YouTube, X, GitHub, Discord) or a portfolio.

## The experience we want
- Sign-up is a few short steps: who you are, how you want to help, your skills and interests, then connecting Discord.
- People see themselves in the choices. Non-coding roles are shown clearly as valid ("No coding required").
- Developers still get the extra checks that help us confirm tech skills; other roles are asked only for what makes sense for them.
- Optional details never block anyone from finishing.
- Existing members see a gentle reminder to complete their profile, not a forced redo.

## Why this approach
- It reflects BetterGov's actual work (datasets, budgets, public services, accountability), not a generic volunteer list.
- Work type, skills, causes and style of help are separate, because they vary independently. A developer may care most about education; a lawyer may want to mentor.
- It is deliberately simpler than international standards, but is designed so it can be mapped to them later.

## Tradeoffs we accept
- More choices at sign-up (12 areas) can feel like a lot; we mitigate with clear descriptions and optional extras.
- Skill levels are self-reported and cannot be verified automatically; admins remain the quality check.
- Social links are optional, kept private from the public verification page, and need care around privacy.
- We keep today's developer roles and add the new areas on top, which means two lists to maintain for a while.
- Tracking real contributions (who fixed what, who verified which dataset) is a later phase. This work only captures the profile.

## Success looks like
- Non-developers can sign up and finish without help.
- A growing share of members have a role area, skills, causes and availability filled in.
- Admins can filter and export volunteers by area, skill and cause.
- No existing member loses access or is forced back through sign-up.

## Out of scope (for now)
- Recording individual contributions and impact.
- Automatic matching of volunteers to projects.
- Verifying social or GitHub accounts (covered by the GitHub account linking plan).
- Formal mapping to ESCO/ISCO or other standards.

## Open questions
- Final wording of the curated skills list.
- Whether to confirm data and privacy handling for social links with the Supabase/admin owners before launch.
