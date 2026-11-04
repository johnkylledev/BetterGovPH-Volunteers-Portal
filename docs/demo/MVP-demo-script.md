# Internal MVP demo: Volunteers portal

**Goal (from the 4 Nov meeting):** show journey 1, existing volunteers finding existing projects and calls, and saying they want to help, without needing Discord.

**Time:** about 15 minutes, plus questions.
**Site:** https://volunteers.bettergov.ph

---

## 1. Setup (the day before)

- [ ] **Vercel environment variables** (Project → Settings → Environment Variables), then redeploy:
  - `GITHUB_TOKEN`: a GitHub token with public read access. Without it, repo progress uses GitHub's anonymous limit (60 checks an hour) and shows less detail.
  - `CRON_SECRET`: any long random string. Turns on the daily repo refresh.
- [ ] **Import the projects.** Sign in as admin → Admin → Projects → **Import from Discord**. Paste the contents of [`bettergov-projects-import.csv`](./bettergov-projects-import.csv) (18 BetterGov projects, 14 with GitHub repos), check the preview, then Import. Add any Discord-only projects as extra lines: name and link are enough.
- [ ] **Open the Projects page once.** Repo progress fills in over a few seconds. Open a couple of project pages to confirm.
- [ ] **Post 3 real calls** from the dashboard (Volunteer calls → Post a call or request). Mix the types:
  - a **Volunteers** call marked **Good first task**, with a contact or group chat link
  - a **Venue** request, with a place and a "needed by" date
  - a call for a **non-tech role** (content creator, writer, lawyer)
- [ ] **Two browsers:**
  - **A:** your admin account, which posted the calls.
  - **B:** a private window, signed out. You'll sign up as a test volunteer during the demo, using a test Google account rather than a real member's.
- [ ] Optional: set a **group chat link** on one imported project (project page → Team group chat) to show the Messenger/WhatsApp path.

---

## 2. Demo flow

### A. Anyone can browse (browser B, signed out), about 3 min
1. Open **/opportunities**. No login needed.
2. Filter **Good first tasks**, then **Venues & resources**. Search for a skill.
3. Point out what visitors *don't* see: contact details and chat links ("Sign in to see how to reach the team").
4. Click **I'm interested** → sign-in page.

### B. Sign up and land back on the call (browser B), about 4 min
1. Sign in with Google and go through the 4 steps:
   - **Display name** (optional pseudonym).
   - **Primary and secondary role**, including non-tech roles.
   - **Skills**.
   - **Consent**: one unticked box per purpose; two are required.
   - Discord is **optional**.
2. After **Submit application**, you're back on the same call, highlighted at the top.
3. Click **I'm interested**, add "How can they reach you?" (e.g. a Messenger link) and a short note → **Send**. Now the contact and group chat are visible.

### C. The poster sees it (browser A), about 2 min
1. Dashboard → **Volunteer calls**. The call shows "1 person is interested" → **See who**.
2. Their display name, role, skills and how to reach them are shown, and the email is not → **Mark contacted**.

### D. Projects and teams, about 3 min
1. Open **/projects**. Imported projects show stage and repo activity ("Active · updated 2d ago · 40% done").
2. Open a project page: **Progress** panel (commits, issues, PRs, milestone, README/license/CI checks) and the **Team** list.
3. In browser B: **Ask to join**. In browser A: the request shows under **Requests to join** → Approve. Mention **hand over head role** for when the real project lead joins.

### E. Privacy and admin, about 3 min
1. Browser B → Profile → **Privacy**:
   - What the public sees ("Juan D****", or the display name).
   - Directory and full-name switches.
   - **Download my data**, and **Delete my account**.
2. Browser A → Admin:
   - **Privacy records (ROPA)** export for the legal team.
   - Project **review notes**: a note is required when sending a project back, and the submitter sees it.

---

## 3. How it maps to the meeting

| Meeting point | In the portal |
|---|---|
| Browse without logging in | /opportunities, /projects, project and team pages are public |
| Apply button → registration/dashboard | "I'm interested" → sign in → back to the same call |
| Discord is hard for non-tech volunteers | Discord optional; Messenger/WhatsApp/Viber/Telegram links on calls and projects |
| Real names, usernames or pseudonyms | Display name everywhere public; legal name only for admins and the card |
| Avoid sensitive personal information | No religion, civil status, health or ID fields collected |
| Team leads manage their teams | Project team head approves joiners, sets the owner and chat, hands over the role |
| Volunteers post calls without admin approval | Calls go live immediately; projects still need review (open question below) |
| Integrate existing Discord projects | Admin import (paste a spreadsheet, up to 100 at a time) |
| Legal: ROPA / PIA | Processing register and consent log export; privacy notice under RA 10173 |

---

## 4. Open questions for the group

1. **Project approval:** keep admin review, or publish straight away and moderate afterwards (Christopher's decentralisation point)?
2. **Moderator role:** who coordinates teams and can hide posts without being a full admin?
3. **Sign-up options:** email/password next (cheapest), then GitHub? Facebook needs organisation verification.
4. **Notifications:** an in-app bell first, or email (needs a sender like Resend)?
5. **Legal (Attorney Dada):** the controller name in the privacy notice while there's no juridical entity, the retention periods, and whether NPC registration is needed.
6. **Database (Jason):** who owns the Supabase project. Before moving it, export a baseline schema so the new database can be rebuilt from the repo.

## 5. Known limits (say these up front)

- No notifications yet: people check their dashboard for interest and join requests.
- Sign-in is Google only for now.
- Imported projects list the admin as team head until the real leads join and take over.
- The `bettergovph/bettergov` repo isn't publicly reachable, so the portal project shows no progress panel.
