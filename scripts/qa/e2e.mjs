// Multi-user end-to-end QA for the Volunteers portal.
//
//   node --env-file=.env scripts/qa/e2e.mjs            # against the local API (vercel dev on :3001)
//   QA_API=https://… node --env-file=.env scripts/qa/e2e.mjs
//
// Creates temporary accounts (no emails are sent), walks every main flow as different people,
// checks permissions and privacy, then deletes everything it created — even when a step fails.
// All test content is titled "[QA test]".
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

const API = (process.env.QA_API || 'http://localhost:3001') + '/api/v1';
const URL_ = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
if (!URL_ || !SERVICE || !ANON) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_ANON_KEY'); process.exit(2); }

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const anonDb = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const RUN = `${Date.now().toString(36)}${randomBytes(2).toString('hex')}`;
const T = (s) => `[QA test] ${s}`;
const created = { users: [], calls: [], projects: [] };
const results = [];
let section = '';

// ---------- tiny test harness ----------
const check = (name, ok, detail = '') => {
  results.push({ section, name, ok: !!ok, detail });
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${!ok && detail ? `  — ${detail}` : ''}`);
};
const step = (title) => { section = title; console.log(`\n▶ ${title}`); };

async function api(path, opts = {}, attempt = 0) {
  const { token, method = 'GET', body } = opts;
  const res = await fetch(API + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  // The local dev server rate-limits (100/min per IP). Wait for the window and retry; production has no such limiter.
  if (res.status === 429 && attempt < 4) {
    await new Promise((r) => setTimeout(r, 16_000));
    return api(path, opts, attempt + 1);
  }
  let json = null;
  try { json = await res.json(); } catch { /* not json */ }
  return { status: res.status, json, headers: res.headers };
}

async function makeUser(n, label) {
  const email = `bgph-qa-${RUN}-${n}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error) throw new Error(`createUser ${label}: ${error.message}`);
  created.users.push(data.user.id);
  // The project only allows Google sign-in, so use a server-generated one-time link (no email is sent).
  const { data: link, error: e1 } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (e1) throw new Error(`link ${label}: ${e1.message}`);
  const client = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: s, error: e2 } = await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' });
  if (e2 || !s?.session) throw new Error(`sign-in ${label}: ${e2?.message || 'no session'}`);
  return { id: data.user.id, email, token: s.session.access_token, label };
}

const CONSENT = (extra = []) => ({ version: '2026-11-v1', purposes: ['membership', 'matching', ...extra] });

async function register(u, { name, display, role = 'Member', spec, secondary, directory = false }) {
  // Steps 1–3 save the profile; step 4 sends consent and the code of conduct.
  const r1 = await api('/me', { token: u.token, method: 'POST', body: {
    fullName: name, displayName: display, specialization: spec, secondarySpecialization: secondary || '',
    role, yearJoined: 2026, experienceLevel: 'Intermediate',
    skills: [{ name: 'Writing', level: 'Practitioner' }, { name: 'Research', level: 'Learner' }],
  } });
  const r2 = await api('/me', { token: u.token, method: 'POST', body: { consent: CONSENT(directory ? ['directory'] : []), acceptCoc: true } });
  return { r1, r2 };
}

async function cleanup() {
  step('Cleanup');
  const ids = created.users;
  const projectIds = created.projects.map(String);
  const callIds = created.calls.map(String);
  try {
    if (callIds.length) await admin.from('call_interests').delete().in('call_id', callIds);
    if (ids.length) {
      for (const t of ['call_interests', 'team_members', 'notifications', 'consent_log']) await admin.from(t).delete().in('user_id', ids);
      await admin.from('reports').delete().in('reporter_id', ids);
      await admin.from('volunteer_calls').delete().in('user_id', ids);
    }
    if (projectIds.length) {
      await admin.from('team_members').delete().in('project_id', projectIds);
      await admin.from('reports').delete().in('target_id', projectIds);
      await admin.from('project_submissions').delete().in('id', projectIds);
    }
    if (callIds.length) await admin.from('reports').delete().in('target_id', callIds);
    if (ids.length) await admin.from('project_submissions').delete().in('user_id', ids);
    // Notifications our test actions sent to real admins (new report, resubmitted project).
    for (const id of [...projectIds, ...callIds]) await admin.from('notifications').delete().like('link', `%${id}%`);
    await admin.from('notifications').delete().like('title', '%[QA test]%');
    if (ids.length) await admin.from('users').delete().in('uid', ids);
    for (const id of ids) { try { await admin.auth.admin.deleteUser(id); } catch { /* already gone */ } }
    const { count: leftUsers } = await admin.from('users').select('*', { count: 'exact', head: true }).in('uid', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    const { count: leftCalls } = await admin.from('volunteer_calls').select('*', { count: 'exact', head: true }).like('title', '%[QA test]%');
    const { count: leftProjects } = await admin.from('project_submissions').select('*', { count: 'exact', head: true }).like('project_name', '%[QA test]%');
    check('no test users left', (leftUsers ?? 0) === 0, String(leftUsers));
    check('no test calls left', (leftCalls ?? 0) === 0, String(leftCalls));
    check('no test projects left', (leftProjects ?? 0) === 0, String(leftProjects));
  } catch (err) {
    check('cleanup ran', false, err.message);
  }
}

async function main() {
  console.log(`QA run ${RUN} against ${API}`);

  // ------------------------------------------------------------------ people
  step('Accounts and sign-up');
  const boss = await makeUser(0, 'QA admin');
  const ana = await makeUser(1, 'Ana (developer, project lead)');
  const ben = await makeUser(2, 'Ben (content creator)');
  const cara = await makeUser(3, 'Cara (lawyer)');
  const dan = await makeUser(4, 'Dan (pending, not approved)');
  const crowd = await Promise.all([5, 6, 7, 8, 9, 10].map((n) => makeUser(n, `Crowd ${n}`)));
  check('11 test accounts created', created.users.length === 11);

  // Admin: give the QA admin rights directly (there is no self-service way, by design)
  await api('/me', { token: boss.token, method: 'POST', body: { fullName: T('Admin'), specialization: 'Project Manager', yearJoined: 2026 } });
  await admin.from('users').update({ is_admin: true }).eq('uid', boss.id);

  const reg = await register(ana, { name: T('Ana Santos'), display: `ana-${RUN}`, role: 'Contributor', spec: 'Full Stack Developer', secondary: 'Educator', directory: true });
  check('profile saved', reg.r1.status === 200, JSON.stringify(reg.r1.json));
  check('display name saved on first save', reg.r1.json?.user?.displayName === `ana-${RUN}`, reg.r1.json?.user?.displayName);
  check('community role saved', reg.r1.json?.user?.role === 'Contributor', reg.r1.json?.user?.role);
  check('secondary role saved', reg.r1.json?.user?.secondarySpecialization === 'Educator');
  check('consent recorded at step 4', !!reg.r2.json?.user?.consentAt);
  check('code of conduct recorded', !!reg.r2.json?.user?.cocAcceptedAt);
  const noConsent = await api('/me', { token: ben.token, method: 'POST', body: { consent: { version: 'x', purposes: ['directory'] } } });
  check('consent without the required purposes is refused', noConsent.status === 400, String(noConsent.status));
  await register(ben, { name: T('Ben Reyes'), display: '', spec: 'Content Creator', directory: false });
  await register(cara, { name: T('Cara Lim'), display: `cara-${RUN}`, spec: 'Lawyer / Policy Expert' });
  await register(dan, { name: T('Dan Cruz'), display: '', spec: 'UI/UX Designer' });
  await Promise.all(crowd.map((u, i) => register(u, { name: T(`Crowd Member ${i}`), display: `crowd${i}-${RUN}`, spec: 'Writer' })));
  const odd = await api('/me', { token: crowd[0].token, method: 'POST', body: { displayName: '<script>x</script>  spaced   name' } });
  check('display name is cleaned (no markup)', !/[<>]/.test(odd.json?.user?.displayName || ''), odd.json?.user?.displayName);

  // ------------------------------------------------------------------ approvals
  step('Admin approves members');
  const notAdmin = await api('/admin?resource=overview', { token: ana.token });
  check('non-admin cannot open the admin overview', notAdmin.status === 403, String(notAdmin.status));
  for (const u of [ana, ben, cara, ...crowd]) {
    const r = await api('/admin?resource=user-status', { token: boss.token, method: 'POST', body: { uid: u.id, status: 'Approved' } });
    if (r.status !== 200) check(`approve ${u.label}`, false, JSON.stringify(r.json));
  }
  const anaMe = await api('/me', { token: ana.token });
  check('approved member has a member ID', /^BGPH-\d{4}-\d{3,4}$/.test(anaMe.json?.user?.memberId || ''), anaMe.json?.user?.memberId);
  const lockedName = await api('/me', { token: ana.token, method: 'POST', body: { fullName: 'Someone Else', role: 'Fellow' } });
  check('approved name stays locked', lockedName.json?.user?.fullName === T('Ana Santos'));
  check('approved role stays locked', lockedName.json?.user?.role === 'Contributor', lockedName.json?.user?.role);
  const bellAna = await api('/notifications', { token: ana.token });
  check('member is notified of approval', (bellAna.json?.items || []).some((n) => n.kind === 'member_approved'));
  const overview = await api('/admin?resource=overview', { token: boss.token });
  check('admin overview loads', overview.status === 200 && typeof overview.json?.queue?.pendingApps === 'number', JSON.stringify(overview.json)?.slice(0, 200));

  // ------------------------------------------------------------------ privacy on public pages
  step('Public pages and privacy');
  const verify = await api(`/verify?id=${encodeURIComponent(anaMe.json.user.memberId)}`);
  check('verify shows the display name, not the legal name', verify.json?.fullName === `ana-${RUN}`, verify.json?.fullName);
  const verifyInj = await api(`/verify?id=${encodeURIComponent(`x,email.eq.${ana.email}`)}`);
  check('verify rejects filter injection', verifyInj.status === 404, String(verifyInj.status));
  const dir = await api('/volunteers');
  const names = (dir.json?.volunteers || []).map((v) => v.name);
  check('directory lists the member who opted in', names.includes(`ana-${RUN}`));
  check('directory hides members who did not opt in', !names.some((n) => /Ben R|crowd\d-/.test(n)));
  check('directory has no emails', !JSON.stringify(dir.json || {}).includes('@example.com'));
  const anonUsers = await anonDb.from('users').select('uid').limit(1);
  check('anonymous key cannot read the users table', !!anonUsers.error);
  const anonInsert = await anonDb.from('project_submissions').insert({ id: crypto.randomUUID(), user_id: ana.id, project_name: 'x', project_url: 'https://x.ph', description: 'x', proj_type: 'web', status: 'approved' });
  check('anonymous key cannot insert approved projects', !!anonInsert.error);

  // ------------------------------------------------------------------ projects
  step('Projects: submit, review, resubmit, approve');
  const badRepo = await api('/submit-project', { token: ana.token, method: 'POST', body: {
    projectName: T('Budget Explainer'), projectUrl: 'https://bettergov.ph', description: 'QA', projType: 'web',
    repoUrl: 'https://github.com/bettergovph/this-repo-does-not-exist-qa',
  } });
  check('a missing repo is refused at submit', badRepo.status === 400, JSON.stringify(badRepo.json));
  const sub = await api('/submit-project', { token: ana.token, method: 'POST', body: {
    projectName: T('Budget Explainer'), projectUrl: 'https://bettergov.ph/qa-budget', description: 'QA project', projType: 'web',
    repoUrl: 'https://github.com/bettergovph/2026-budget', stage: 'building', chatUrl: 'https://chat.whatsapp.com/QaTestInvite',
  } });
  check('project submitted', sub.status === 200 && !!sub.json?.submissionId, JSON.stringify(sub.json));
  const pid = sub.json?.submissionId;
  if (pid) created.projects.push(pid);
  check('repo checked at submit', sub.json?.repo?.ok === true, JSON.stringify(sub.json?.repo)?.slice(0, 120));
  const publicBefore = await api('/projects?source=merged');
  check('pending project is not public', !(publicBefore.json?.projects || []).some((p) => String(p.id) === String(pid)));
  const rejNoNote = await api('/admin?resource=submissions', { token: boss.token, method: 'POST', body: { id: pid, action: 'reject' } });
  check('sending back needs a note', rejNoNote.status === 400, String(rejNoNote.status));
  await api('/admin?resource=submissions', { token: boss.token, method: 'POST', body: { id: pid, action: 'reject', note: T('Please add a README') } });
  const mine = await api('/my-project-submissions', { token: ana.token });
  const mineRow = (mine.json?.submissions || []).find((s) => String(s.id) === String(pid));
  check('submitter sees the reviewer note', mineRow?.adminNote === T('Please add a README'), mineRow?.adminNote);
  check('submitter is notified it needs changes', ((await api('/notifications', { token: ana.token })).json?.items || []).some((n) => n.kind === 'project_changes'));
  const resub = await api('/my-project-submissions', { token: ana.token, method: 'POST', body: { id: pid, description: 'QA project, now with README' } });
  check('rejected project can be resubmitted', resub.status === 200 && resub.json?.status === 'pending', JSON.stringify(resub.json));
  const otherResub = await api('/my-project-submissions', { token: ben.token, method: 'POST', body: { id: pid, description: 'hijack' } });
  check('someone else cannot edit the submission', otherResub.status === 404, String(otherResub.status));
  await api('/admin?resource=submissions', { token: boss.token, method: 'POST', body: { id: pid, action: 'approve', note: 'Looks good' } });
  const publicAfter = await api('/projects?source=merged');
  check('approved project is public right away', (publicAfter.json?.projects || []).some((p) => String(p.id) === String(pid)));
  check('public list has no submitter ids', !JSON.stringify(publicAfter.json || {}).includes(ana.id));

  // ------------------------------------------------------------------ teams
  step('Teams: join, approve, decline, owner, hand-over');
  const teamAnon = await api(`/teams?project=${pid}`);
  check('team page is public', teamAnon.status === 200 && teamAnon.json?.members?.length >= 1, String(teamAnon.status));
  check('team page hides the chat link from visitors', !teamAnon.json?.project?.chatUrl);
  check('team page shows the display name', (teamAnon.json?.members || []).some((m) => m.name === `ana-${RUN}`));
  const dJoin = await api('/teams', { token: dan.token, method: 'POST', body: { projectId: pid, action: 'join' } });
  check('unapproved member cannot join yet', dJoin.status === 403, String(dJoin.status));
  const bJoin = await api('/teams', { token: ben.token, method: 'POST', body: { projectId: pid, action: 'join', teamRole: 'Video editor', message: 'I can cut reels' } });
  check('member can ask to join', bJoin.status === 200 && bJoin.json?.status === 'pending', JSON.stringify(bJoin.json));
  const bAgain = await api('/teams', { token: ben.token, method: 'POST', body: { projectId: pid, action: 'join' } });
  check('duplicate request is refused', bAgain.status === 400);
  const cJoin = await api('/teams', { token: cara.token, method: 'POST', body: { projectId: pid, action: 'join' } });
  check('second member can ask to join', cJoin.status === 200);
  check('head is notified of requests', ((await api('/notifications', { token: ana.token })).json?.items || []).filter((n) => n.kind === 'team_request').length >= 2);
  const asHead = await api(`/teams?project=${pid}`, { token: ana.token });
  const reqB = (asHead.json?.requests || []).find((r) => r.person?.userId === ben.id);
  const reqC = (asHead.json?.requests || []).find((r) => r.person?.userId === cara.id);
  check('head sees both requests', !!reqB && !!reqC);
  check('head sees display names, not legal names', reqC?.person?.name === `cara-${RUN}`, reqC?.person?.name);
  const notHead = await api('/teams', { token: cara.token, method: 'POST', body: { projectId: pid, action: 'decide', requestId: reqB?.id, decision: 'approve' } });
  check('non-head cannot approve requests', notHead.status === 403, String(notHead.status));
  await api('/teams', { token: ana.token, method: 'POST', body: { projectId: pid, action: 'decide', requestId: reqB?.id, decision: 'approve' } });
  await api('/teams', { token: ana.token, method: 'POST', body: { projectId: pid, action: 'decide', requestId: reqC?.id, decision: 'decline' } });
  check('approved member is notified', ((await api('/notifications', { token: ben.token })).json?.items || []).some((n) => n.kind === 'team_approved'));
  check('declined member is notified', ((await api('/notifications', { token: cara.token })).json?.items || []).some((n) => n.kind === 'team_declined'));
  const asMember = await api(`/teams?project=${pid}`, { token: ben.token });
  check('members see the group chat', !!asMember.json?.project?.chatUrl);
  const ownerOrg = await api('/teams', { token: ana.token, method: 'POST', body: { projectId: pid, action: 'set-owner', ownerType: 'org', ownerName: T('Barangay San Isidro') } });
  check('head can set an organisation owner', ownerOrg.status === 200);
  const badChat = await api('/teams', { token: ana.token, method: 'POST', body: { projectId: pid, action: 'set-chat', chatUrl: 'https://evil.example/phish' } });
  check('non-chat links are refused', badChat.status === 400);
  const handOver = await api('/teams', { token: ana.token, method: 'POST', body: { projectId: pid, action: 'transfer-head', userId: ben.id } });
  check('head role can be handed over', handOver.status === 200, JSON.stringify(handOver.json));
  const anaLeaveAfter = await api('/teams', { token: ana.token, method: 'POST', body: { projectId: pid, action: 'leave' } });
  check('former head can now leave', anaLeaveAfter.status === 200, JSON.stringify(anaLeaveAfter.json));
  const benLeave = await api('/teams', { token: ben.token, method: 'POST', body: { projectId: pid, action: 'leave' } });
  check('current head cannot leave without handing over', benLeave.status === 400);

  // ------------------------------------------------------------------ calls and interest
  step('Calls: post, browse, interest (crowd), contact');
  const noLink = await api('/volunteer-calls', { token: ana.token, method: 'POST', body: { title: T('Writer needed'), description: 'QA', call_type: 'people' } });
  check('people call needs a project link', noLink.status === 400);
  const badChatCall = await api('/volunteer-calls', { token: ana.token, method: 'POST', body: { title: T('Writer needed'), project_url: 'https://bettergov.ph', description: 'QA', chat_url: 'https://evil.example/x' } });
  check('call with a bad chat link is refused', badChatCall.status === 400);
  const call = await api('/volunteer-calls', { token: ana.token, method: 'POST', body: {
    title: T('Writer for a budget explainer'), project_url: 'https://bettergov.ph', description: 'QA call', roles_needed: 'Writer, Content Creator',
    call_type: 'people', commitment: 'few-hours', work_mode: 'remote', good_first: true, contact: 'ana on Discord', chat_url: 'https://chat.whatsapp.com/QaCallInvite',
  } });
  check('call posted', call.status === 200 && !!call.json?.id, JSON.stringify(call.json));
  const cid = call.json?.id;
  if (cid) created.calls.push(cid);
  const venue = await api('/volunteer-calls', { token: cara.token, method: 'POST', body: { title: T('Room for 30 people'), description: 'QA venue', call_type: 'venue', location: 'Quezon City', needed_by: '2026-12-01' } });
  check('venue request needs no project link', venue.status === 200, JSON.stringify(venue.json));
  if (venue.json?.id) created.calls.push(venue.json.id);
  const pub = await api(`/volunteer-calls?id=${cid}`);
  const pubCall = pub.json?.calls?.[0];
  check('visitors can browse the call', !!pubCall);
  check('visitors do not see contact or chat', pubCall && !pubCall.contact && !pubCall.chatUrl && pubCall.contactHidden === true);
  check('public response varies by sign-in', (pub.headers.get('vary') || '').toLowerCase().includes('authorization'), pub.headers.get('vary'));
  check('public poster name is the display name', pubCall?.postedBy?.fullName === `ana-${RUN}`, pubCall?.postedBy?.fullName);
  const memberView = await api(`/volunteer-calls?id=${cid}`, { token: ben.token });
  check('members see contact and chat', !!memberView.json?.calls?.[0]?.chatUrl && !!memberView.json?.calls?.[0]?.contact);
  check('members never see the poster email', !JSON.stringify(memberView.json || {}).includes('@example.com'));
  const anonInterest = await api('/call-interests', { method: 'POST', body: { callId: cid } });
  check('visitors must sign in to raise a hand', anonInterest.status === 401);
  const own = await api('/call-interests', { token: ana.token, method: 'POST', body: { callId: cid } });
  check('poster cannot raise a hand on their own call', own.status === 400);
  const crowdRes = await Promise.all(crowd.map((u, i) => api('/call-interests', { token: u.token, method: 'POST', body: { callId: cid, message: `crowd ${i}`, contact: `m.me/crowd${i}` } })));
  check('6 people raise a hand at the same time', crowdRes.every((r) => r.status === 200), crowdRes.map((r) => r.status).join(','));
  await api('/call-interests', { token: crowd[0].token, method: 'POST', body: { callId: cid } }); // repeat: no duplicate
  const list = await api(`/call-interests?call=${cid}`, { token: ana.token });
  check('poster sees exactly 6 interested', (list.json?.interests || []).length === 6, String((list.json?.interests || []).length));
  check('poster sees how to reach them', (list.json?.interests || []).every((i) => i.contact.startsWith('m.me/')));
  const peek = await api(`/call-interests?call=${cid}`, { token: ben.token });
  check('others cannot see who is interested', peek.status === 403);
  const posterNotes = (await api('/notifications', { token: ana.token })).json?.items || [];
  check('poster gets one notification per person (no repeats)', posterNotes.filter((n) => n.kind === 'interest_new').length === 6, String(posterNotes.filter((n) => n.kind === 'interest_new').length));
  const first = list.json?.interests?.[0];
  await api('/call-interests', { token: ana.token, method: 'POST', body: { action: 'mark', interestId: first?.id, status: 'contacted' } });
  const contactedUser = crowd.find((u) => (list.json?.interests?.[0]?.person?.name || '').includes(`-${RUN}`) && true);
  const anyContacted = await Promise.all(crowd.map((u) => api('/notifications', { token: u.token })));
  check('volunteer is told they were contacted', anyContacted.some((r) => (r.json?.items || []).some((n) => n.kind === 'interest_contacted')));
  void contactedUser;
  const withdraw = await api('/call-interests', { token: crowd[5].token, method: 'POST', body: { action: 'withdraw', callId: cid } });
  check('a volunteer can withdraw', withdraw.status === 200);
  const counted = await api(`/volunteer-calls?id=${cid}`, { token: ana.token });
  check('interest count updates after withdrawal', counted.json?.calls?.[0]?.interestCount === 5, String(counted.json?.calls?.[0]?.interestCount));
  const hijackEdit = await api('/volunteer-calls', { token: ben.token, method: 'PATCH', body: { id: cid, title: 'hijacked' } });
  check('others cannot edit the call', hijackEdit.status === 403);
  const removeContact = await api('/volunteer-calls', { token: ana.token, method: 'PATCH', body: { id: cid, contact: '' } });
  const afterRemove = await api(`/volunteer-calls?id=${cid}`, { token: ben.token });
  check('poster can remove the contact', removeContact.status === 200 && !afterRemove.json?.calls?.[0]?.contact);

  // ------------------------------------------------------------------ reports
  step('Reports and moderation');
  const selfReport = await api('/reports', { token: ana.token, method: 'POST', body: { targetType: 'call', targetId: cid, reason: 'spam' } });
  check('you cannot report your own post', selfReport.status === 400);
  const rep = await api('/reports', { token: cara.token, method: 'POST', body: { targetType: 'call', targetId: cid, reason: 'misleading', details: T('looks off') } });
  check('member can report a call', rep.status === 200 && rep.json?.status === 'received', JSON.stringify(rep.json));
  const rep2 = await api('/reports', { token: cara.token, method: 'POST', body: { targetType: 'call', targetId: cid, reason: 'spam' } });
  check('a second report of the same thing is absorbed', rep2.status === 200 && rep2.json?.status === 'already_reported');
  const queueAsMember = await api('/reports', { token: ben.token });
  check('members cannot read the reports queue', queueAsMember.status === 403);
  const queue = await api('/reports', { token: boss.token });
  const myReport = (queue.json?.reports || []).find((r) => r.targetId === cid);
  check('admin sees the report', !!myReport);
  const resolve = await api('/reports', { token: boss.token, method: 'POST', body: { action: 'resolve', id: myReport?.id, status: 'actioned', hide: true, resolution: T('closed by QA') } });
  check('admin can close the reported call', resolve.status === 200);
  const pubClosed = await api(`/volunteer-calls?id=${cid}`);
  check('closed call disappears from public browsing', pubClosed.status === 200 && Array.isArray(pubClosed.json?.calls) && pubClosed.json.calls.length === 0, String(pubClosed.status));

  // ------------------------------------------------------------------ privacy controls
  step('Privacy controls and erasure');
  const hide = await api('/me', { token: ana.token, method: 'POST', body: { showInDirectory: false } });
  check('member can leave the directory', hide.json?.user?.showInDirectory === false);
  const dir2 = await api('/volunteers');
  check('…and is gone from the directory', dir2.status === 200 && Array.isArray(dir2.json?.volunteers) && !dir2.json.volunteers.some((v) => v.name === `ana-${RUN}`), String(dir2.status));
  const delReq = await api('/me', { token: cara.token, method: 'POST', body: { requestDeletion: true } });
  check('member can request deletion', !!delReq.json?.user?.deletionRequestedAt);
  const ov2 = await api('/admin?resource=overview', { token: boss.token });
  check('deletion request shows in the admin overview', (ov2.json?.deletions || []).some((d) => d.uid === cara.id));
  const wrongConfirm = await api('/admin?resource=erase-user', { token: boss.token, method: 'POST', body: { uid: cara.id, confirm: 'nope@example.com' } });
  check('erase needs the typed email', wrongConfirm.status === 400);
  const erase = await api('/admin?resource=erase-user', { token: boss.token, method: 'POST', body: { uid: cara.id, confirm: cara.email } });
  check('admin can erase a member', erase.status === 200 && erase.json?.erased === true, JSON.stringify(erase.json));
  const { data: caraRow } = await admin.from('users').select('uid').eq('uid', cara.id).maybeSingle();
  check('erased profile is gone', !caraRow);
  const { count: caraCalls } = await admin.from('volunteer_calls').select('*', { count: 'exact', head: true }).eq('user_id', cara.id);
  check("erased member's calls are gone", (caraCalls ?? 0) === 0);
}

const started = Date.now();
try {
  await main();
} catch (err) {
  check('run finished without crashing', false, err.stack || err.message);
} finally {
  await cleanup();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(` - [${f.section}] ${f.name}${f.detail ? ` — ${f.detail}` : ''}`);
  }
  process.exit(failed.length ? 1 : 0);
}
