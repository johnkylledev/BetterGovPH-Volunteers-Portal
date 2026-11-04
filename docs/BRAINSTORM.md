# What more can the Volunteers portal do?

A brainstorm drawn from the 4 Nov meeting, the g0v *Civic Tech Project & Community Handbook*, and how other communities work (Code for America brigades, DemocracyLab, Catchafire, Idealist, Open Collective, CHAOSS, the Civic Tech Field Guide).

**Legend:** ✅ built · 🔨 being built now · ⭐ recommended next · ⚖️ needs a team or legal decision first
**Effort:** S = a day or less · M = a few days · L = a week or more

---

## 1. Matching people to work

| Idea | Why | Effort | |
|---|---|---|---|
| Availability: hours per week, weekdays or weekends | Posters can see who can realistically help; calls already have a time commitment | S | ⭐ |
| Region (not exact address) and languages spoken (Filipino, Cebuano, Ilocano, Hiligaynon…) | Many civic projects are local or need a dialect; region and language aren't sensitive personal information | S | ⭐ |
| "Why this fits you" on calls ("matches your Writer role and Canva skill") | Makes matching visible and trusted | S | |
| Weekly "calls for you" digest | Brings people back without them having to check; needs the "communications" consent | M | ⚖️ |
| Mentor flag: experienced members offer office hours | g0v and Code for America pair newcomers with experienced people | M | |
| GitHub `good first issue` sync: labelled issues show up as good first tasks | Uses work that already exists in repos | M | |

## 2. New volunteers (journey 2)

| Idea | Why | Effort | |
|---|---|---|---|
| Getting-started checklist on the dashboard | A short path: profile → privacy → browse → raise a hand → join a team | S | 🔨 |
| Orientation sessions as an event type | Code for Denver and Code for Boston run separate newbie nights because onboarding during project night drains people | M | |
| Buddy for the first task | Good first tasks fail when nobody is there to help (FSE 2020 study) | S | |
| Plain-language guides: "civic tech for non-techies", glossary | g0v Sch001 turns community experience into short lessons | M | |

## 3. Teams and communication

| Idea | Why | Effort | |
|---|---|---|---|
| In-app notifications (bell): interest raised, join requests, decisions, reviews | Right now people must check the dashboard; the meeting stressed communication | M | 🔨 |
| Project updates feed: short progress posts by the team | g0v's "release early, release often"; non-code projects have no repo to track | M | ⭐ |
| Lightweight task list per project (to do / doing / done) | Lets non-tech teams track work without GitHub | M | |
| Decisions and meeting-notes log per project | g0v documents everything openly so people can join or leave without losing context | M | |
| "Looking for a new lead" and "Completed" project stages | g0v: projects end, restart, or get taken over when a founder leaves | S | ⭐ |
| Email or Messenger notifications | Reaches people who don't log in often | M | ⚖️ (needs a sender, and legal review of what's sent) |

## 4. Events

| Idea | Why | Effort | |
|---|---|---|---|
| Events calendar with RSVP (hackathons, orientations, workshops) | g0v's bi-monthly hackathon rhythm keeps the community alive | M | ⭐ |
| Pitch slots: sign up to pitch a project for 3 minutes | How g0v teams form at hackathons | S | |
| Link venue and food requests to an event | Ties the new request types to real events | S | |
| Check-in at events, feeding attendance awards | Recognition and an impact count | M | |

## 5. Recognition and keeping people

| Idea | Why | Effort | |
|---|---|---|---|
| Log volunteer hours on calls and teams | Catchafire-style impact numbers; feeds awards | M | ⭐ |
| **Certificate of volunteer service** (PDF with member ID and a verify link) | Very valued in the PH by students (NSTP, scholarships) and young professionals; reuses the Volunteer Card verification | M | ⭐ |
| Contributor credits on project pages, monthly thank-you posts | g0v has a thank-you ritual for every project and event | S | |
| Gentle "we miss you" nudge after 60 days inactive | Retention; only with communications consent | S | ⚖️ |

## 6. Trust, safety and governance

| Idea | Why | Effort | |
|---|---|---|---|
| Code of conduct, agreed at sign-up | g0v's manifesto and code of conduct are the base of consensus | S | 🔨 |
| "Report" on calls and projects, admin queue | Needed if projects stop requiring approval before going live | M | 🔨 |
| Moderator role (between member and admin) | Proposed in the meeting | M | ⚖️ |
| Publish projects straight away, moderate afterwards | Christopher's decentralisation point | S | ⚖️ |
| Admin action log (who approved, changed or exported what) | Accountability under the Data Privacy Act; protects admins too | M | ⭐ |
| Rate limits on interests, reports and posts | Stops spam; Upstash Redis is already wired in | S | ⭐ |

## 7. Privacy and compliance

| Idea | Why | Effort | |
|---|---|---|---|
| Automatic retention clean-up (scheduled job) | The privacy notice promises it | S | ⭐ |
| Deletion-request queue in admin | Requests exist; admins need a list to act on | S | ⭐ |
| Re-ask for consent when the notice version changes | Consent must match the current notice | S | |
| Breach-response runbook (72-hour NPC notice) | Required by law; better written before it's needed | S | ⚖️ |
| Field review against legal's sensitive-information list | Action item from the meeting (Attorney Dada) | S | ⚖️ |

## 8. Access and inclusion

| Idea | Why | Effort | |
|---|---|---|---|
| Email/password and magic-link sign-in | Not everyone uses Google | M | ⚖️ (legal review of integrations first) |
| Filipino / Taglish language toggle | Reaches far more volunteers | L | |
| "Share to Messenger" and link previews for calls | How the comms plan will actually spread calls | M | ⭐ |
| Installable app (PWA), lighter pages on slow connections | Mobile-first audience | M | |
| Accessibility audit (screen readers, contrast, keyboard) | Public-interest tech should be usable by everyone | M | |

## 9. Transparency and impact

| Idea | Why | Effort | |
|---|---|---|---|
| Public impact page: volunteers by role, calls filled, active projects (no personal data) | Funders, partners and the comms plan need numbers | M | ⭐ |
| Monthly newsletter drafted from portal activity | g0v Jothon's monthly recap | M | |
| Funding ledger per project | Open Collective-style transparency for the new funding requests | L | ⚖️ (needs a fiscal host) |
| Public projects API for other directories | The Civic Tech Field Guide and the Brigade project index mirror projects this way | S | |

## 10. Partners: CSOs, LGUs and schools

| Idea | Why | Effort | |
|---|---|---|---|
| Organisation profiles that can post needs | The meeting's user-story mapping named CSOs and partner organisations | L | ⚖️ |
| "Request help" intake form for CSOs and LGUs, which becomes a project idea or call | Brings real problems in | M | |
| Partner verification | Trust when organisations post | M | |

## 11. Platform health

| Idea | Why | Effort | |
|---|---|---|---|
| Baseline schema in `supabase/migrations`, plus a staging database | Needed before the database moves (Jason's action item) | S | ⭐ |
| API tests and CI on pull requests | Protects the privacy fixes | M | ⭐ |
| Error monitoring and uptime alerts | Know about breakages before users do | S | |
| Fix the dashboard's hooks-after-return bug; split the bundle | Stability and first-load speed on phones | S | ⭐ |

---

## Suggested order

1. **Now (🔨):** notifications, getting-started checklist, code of conduct with reporting.
2. **Next (⭐), after the MVP demo:** availability, region and languages; project updates; new project stages; certificates of service; the events calendar; the retention job and deletion queue; Messenger sharing; the baseline schema; tests.
3. **After decisions (⚖️):** moderator role, publishing without approval, email sign-up, organisation accounts, email digests.
