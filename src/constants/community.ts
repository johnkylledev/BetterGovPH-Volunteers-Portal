import type { LucideIcon } from 'lucide-react';
import { Banknote, Building2, Bus, Coffee, Package, Printer, Shapes, Users } from 'lucide-react';
import type { CallType, ProjectStage, VolunteerCall } from '../types';

// ---------------------------------------------------------------------------
// Calls board: asking for people, or for things a project needs
// ---------------------------------------------------------------------------
export const CALL_TYPES: { id: CallType; label: string; short: string; icon: LucideIcon; titlePlaceholder: string; detailsPlaceholder: string }[] = [
  { id: 'people', label: 'Volunteers', short: 'People', icon: Users, titlePlaceholder: 'Writer or frontend developer for a budget tracker', detailsPlaceholder: 'What needs doing, how long it takes, what someone should know.' },
  { id: 'venue', label: 'Venue', short: 'Venue', icon: Building2, titlePlaceholder: 'Room for 30 people for a data literacy workshop', detailsPlaceholder: 'Date and time, how many people, what the space needs (projector, Wi-Fi, accessibility).' },
  { id: 'equipment', label: 'Equipment', short: 'Equipment', icon: Package, titlePlaceholder: 'Borrow 2 laptops and a projector for a weekend', detailsPlaceholder: 'What you need, for how long, and how it will be returned.' },
  { id: 'funding', label: 'Funding or sponsor', short: 'Funding', icon: Banknote, titlePlaceholder: 'Sponsor for hosting costs (₱1,500/month)', detailsPlaceholder: 'What the money covers, how much, and how you will report back on it.' },
  { id: 'transport', label: 'Transport', short: 'Transport', icon: Bus, titlePlaceholder: 'Van for a barangay visit in Rizal', detailsPlaceholder: 'Route, date, how many people or how much to carry.' },
  { id: 'food', label: 'Food or drinks', short: 'Food', icon: Coffee, titlePlaceholder: 'Snacks for 40 at a hackathon', detailsPlaceholder: 'How many people, when, any dietary needs.' },
  { id: 'printing', label: 'Printing or materials', short: 'Printing', icon: Printer, titlePlaceholder: '200 printed flyers for a voter education drive', detailsPlaceholder: 'Quantity, size, deadline, and where they should be delivered.' },
  { id: 'other', label: 'Something else', short: 'Other', icon: Shapes, titlePlaceholder: 'What do you need?', detailsPlaceholder: 'Describe what would help and by when.' },
];
export const callTypeOf = (id?: string) => CALL_TYPES.find((t) => t.id === id) ?? CALL_TYPES[0];

export const COMMITMENTS = [
  { id: 'one-off', label: 'One-off', hint: 'A single task or event' },
  { id: 'few-hours', label: 'A few hours', hint: 'Under 5 hours in total' },
  { id: 'weekly', label: 'Weekly', hint: 'A few hours each week' },
  { id: 'ongoing', label: 'Ongoing', hint: 'A longer-term role' },
] as const;
export const WORK_MODES = [
  { id: 'remote', label: 'Remote' },
  { id: 'onsite', label: 'On-site' },
  { id: 'hybrid', label: 'Hybrid' },
] as const;
export const commitmentLabel = (id?: string) => COMMITMENTS.find((c) => c.id === id)?.label;
export const workModeLabel = (id?: string) => WORK_MODES.find((m) => m.id === id)?.label;

/** "Needed by 12 Nov", or "Overdue" once the date has passed. */
export const neededByLabel = (c: Pick<VolunteerCall, 'neededBy'>) => {
  if (!c.neededBy) return null;
  const d = new Date(`${c.neededBy}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return d < today ? 'Date passed' : `By ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
};

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
export const STAGES: { id: ProjectStage; label: string; hint: string }[] = [
  { id: 'idea', label: 'Idea', hint: 'Still shaping it; looking for people' },
  { id: 'building', label: 'Building', hint: 'Work has started' },
  { id: 'beta', label: 'Beta', hint: 'Usable, being tested' },
  { id: 'live', label: 'Live', hint: 'Out and being used' },
  { id: 'needs-lead', label: 'Looking for a new lead', hint: 'The founder stepped back; someone can take over' },
  { id: 'completed', label: 'Completed', hint: 'Goal reached; kept for reference' },
];

// When, where and in which languages members can help (shown to posters and team heads, not public).
export const PH_REGIONS = ['NCR', 'CAR', 'Ilocos Region', 'Cagayan Valley', 'Central Luzon', 'CALABARZON', 'MIMAROPA', 'Bicol Region',
  'Western Visayas', 'Central Visayas', 'Eastern Visayas', 'Zamboanga Peninsula', 'Northern Mindanao', 'Davao Region',
  'SOCCSKSARGEN', 'Caraga', 'BARMM', 'Abroad'] as const;
export const LANGUAGES = ['Filipino', 'English', 'Cebuano', 'Ilocano', 'Hiligaynon', 'Bikol', 'Waray', 'Kapampangan', 'Pangasinan',
  'Maranao', 'Maguindanaon', 'Tausug', 'Chavacano', 'Kinaray-a', 'Surigaonon', 'Other'] as const;
export const AVAILABILITY = [
  { id: 'weekdays', label: 'Weekdays' },
  { id: 'weeknights', label: 'Weeknights' },
  { id: 'weekends', label: 'Weekends' },
] as const;
export const HOURS_PER_WEEK = [
  { id: '1-2', label: '1–2 hours a week' },
  { id: '3-5', label: '3–5 hours a week' },
  { id: '6-10', label: '6–10 hours a week' },
  { id: '10+', label: 'More than 10 hours a week' },
] as const;
export const availabilitySummary = (p: { availability?: string[]; hoursPerWeek?: string | null; region?: string | null; languages?: string[] }) =>
  [
    (p.availability ?? []).map((a) => AVAILABILITY.find((x) => x.id === a)?.label ?? a).join(', '),
    p.hoursPerWeek ? HOURS_PER_WEEK.find((h) => h.id === p.hoursPerWeek)?.label : '',
    p.region ?? '',
    (p.languages ?? []).join(', '),
  ].filter(Boolean).join(' · ');
export const stageLabel = (id?: string | null) => STAGES.find((s) => s.id === id)?.label;

// ---------------------------------------------------------------------------
// Data Privacy Act of 2012 (RA 10173): consent and the Record of Processing Activities
// ---------------------------------------------------------------------------
export const CONSENT_VERSION = '2026-11-v1';

export const CONSENT_PURPOSES = [
  {
    id: 'membership', required: true, label: 'Run my membership',
    detail: 'Review my application, issue my Volunteer Card and member ID, and let anyone check that the card is real.',
  },
  {
    id: 'matching', required: true, label: 'Match me with projects',
    detail: 'Use my roles, skills and experience to suggest calls and teams, and show them to team heads I ask to join.',
  },
  {
    id: 'directory', required: false, label: 'List me in the public Volunteers directory',
    detail: 'Show my redacted name (for example “Juan D****”), roles and top skills, and my profile picture if I switch that on. Never my email or links.',
  },
  {
    id: 'communications', required: false, label: 'Contact me about projects and events',
    detail: 'Occasional messages about calls that fit me, events and community updates.',
  },
] as const;
export type ConsentPurposeId = (typeof CONSENT_PURPOSES)[number]['id'];

/** What we process, why, who sees it and how long we keep it. Shown on /privacy and exported by admins. */
export const ROPA_REGISTER = [
  {
    activity: 'Member registration and Volunteer Card',
    purpose: 'Admit volunteers, issue member IDs, verify cards',
    subjects: 'Applicants and members',
    data: 'Name, sign-in email (Google or GitHub), primary and secondary role, experience level, year joined, member ID, status',
    basis: 'Consent (RA 10173 Sec. 12(a))',
    recipients: 'BetterGovPH admins; public verify page shows redacted name, role and status only',
    retention: 'While a member; declined applications deleted after 12 months',
  },
  {
    activity: 'Project matching and teams',
    purpose: 'Suggest calls, form project teams, show team heads who asked to join',
    subjects: 'Members',
    data: 'Skills and levels, roles, team memberships and join messages',
    basis: 'Consent',
    recipients: 'Admins; heads of teams the member asks to join; public team pages show redacted names',
    retention: 'While a member; join requests deleted 12 months after a decision',
  },
  {
    activity: 'Public Volunteers directory',
    purpose: 'Show who volunteers, by choice',
    subjects: 'Approved members who opt in',
    data: 'Redacted name (full name only if chosen), roles, top skills, member ID, Discord avatar, and the Google or GitHub profile picture only if switched on (read from the provider, never stored by us)',
    basis: 'Consent (separate, optional)',
    recipients: 'Public',
    retention: 'Removed as soon as the member switches it off',
  },
  {
    activity: 'Channels and links',
    purpose: 'Let admins and team heads see a member’s work',
    subjects: 'Members who add links',
    data: 'Profile links (YouTube, GitHub, LinkedIn, …)',
    basis: 'Consent',
    recipients: 'The member and admins only',
    retention: 'Until removed by the member',
  },
  {
    activity: 'Discord connection',
    purpose: 'Confirm community-server membership, show avatar',
    subjects: 'Members who connect Discord',
    data: 'Discord user ID, username, display name, avatar hash',
    basis: 'Consent',
    recipients: 'Admins; avatar shown publicly where the member appears',
    retention: 'Until disconnected or the account is deleted',
  },
  {
    activity: 'Project submissions, calls and requests',
    purpose: 'Review and publish civic projects; coordinate help, venues and resources',
    subjects: 'Members who post',
    data: 'Project details, repository statistics, call details and contact text the poster writes',
    basis: 'Consent',
    recipients: 'Admins; approved projects are public; calls are visible to signed-in members',
    retention: 'While the project or call is listed; closed calls deleted after 24 months',
  },
  {
    activity: 'Consent records',
    purpose: 'Prove when and to what each member agreed (accountability)',
    subjects: 'Members',
    data: 'Consent version, purposes, timestamp, browser user agent',
    basis: 'Legal obligation (RA 10173 Sec. 21, accountability)',
    recipients: 'Admins and the Data Protection Officer',
    retention: '3 years after the membership ends',
  },
] as const;

/**
 * Data Protection Officer (RA 10173 IRR Sec. 26). Fill these in once the DPO is designated and registered with the NPC;
 * the privacy notice shows them as soon as they're set and points to the admins on Discord until then.
 */
export const DPO_CONTACT: { name: string; email: string; npcRegistration: string } = {
  name: '',
  email: '',
  npcRegistration: '',
};

/** Who handles personal data for us (personal information processors) and where. Shown on /privacy. */
export const PROCESSORS = [
  { name: 'Supabase', role: 'Database and sign-in sessions', data: 'All portal data', location: 'Tokyo, Japan (AWS ap-northeast-1)' },
  { name: 'Vercel', role: 'Website hosting and the portal API', data: 'Requests in transit and short-lived logs (IP address, path)', location: 'United States, with a global edge network' },
  { name: 'Google', role: 'Sign-in with your Google account', data: 'Name, email and profile photo you allow at sign-in', location: 'Google data centres worldwide' },
  { name: 'GitHub', role: 'Sign-in with your GitHub account, and public repository statistics for submitted projects', data: 'Your GitHub name, username, email and avatar at sign-in; public repository data for projects', location: 'United States' },
  { name: 'Discord', role: 'Optional community verification', data: 'Discord user ID, username and avatar', location: 'United States' },
] as const;
