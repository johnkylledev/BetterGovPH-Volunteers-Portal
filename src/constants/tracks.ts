import type { LucideIcon } from 'lucide-react';
import {
  Clapperboard, FolderGit2, GraduationCap, Landmark, Megaphone,
  Code2, Video, FileText, Image, Mic, Presentation, BookOpen, ScrollText, Scale, FileSearch, CalendarDays, Globe, Database,
  Smartphone, Webhook, Boxes, Sparkles, Users, MessageCircle, Search, Share2, HandHeart,
} from 'lucide-react';
import { SPECIALIZATIONS } from './specializations';
import { DISCORD_INVITE, GITHUB_ORG } from '../components/site/links';
import type { SelectOption } from '../components/SelectMenu';
import { parseRoles } from '../components/RolesNeededPicker';

/**
 * A "track" tailors the dashboard to the kind of work a volunteer does. Every track writes to the
 * same submissions and volunteer calls, so a developer's app and a creator's explainer sit side by
 * side on the public projects page — the wording and shortcuts change, the data doesn't.
 */
export type TrackId = 'build' | 'create' | 'teach' | 'policy' | 'organize';

export interface StartAction {
  title: string;
  desc: string;
  icon: LucideIcon;
  label: string;
  /** A dashboard tab to open, or a link. */
  tab?: 'submit-project' | 'volunteer';
  href?: string;
}

export interface Track {
  id: TrackId;
  /** Dashboard tab label for this track's work. */
  tabLabel: string;
  /** Stat tile label and its icon. */
  statLabel: string;
  icon: LucideIcon;
  intro: string;
  submitTitle: string;
  nameLabel: string;
  namePlaceholder: string;
  linkPlaceholder: string;
  linkHint: string;
  descPlaceholder: string;
  /** Group in WORK_TYPES listed first, and the type picked by default. */
  typeGroup: string;
  defaultType: string;
  /** Words that mark a volunteer call as a fit for this track. */
  keywords: string[];
  starts: StartAction[];
}

/** Every kind of work the community shares. Stored as `proj_type` (free text), so adding one needs no migration. */
export const WORK_TYPES: (SelectOption & { group: string })[] = [
  { value: 'web', label: 'Web app', icon: Globe, group: 'Code' },
  { value: 'api', label: 'API', icon: Webhook, group: 'Code' },
  { value: 'mobile', label: 'Mobile app', icon: Smartphone, group: 'Code' },
  { value: 'data', label: 'Dataset', icon: Database, group: 'Code' },
  { value: 'blockchain', label: 'Blockchain', icon: Boxes, group: 'Code' },
  { value: 'video', label: 'Video', icon: Video, group: 'Content' },
  { value: 'article', label: 'Article or explainer', icon: FileText, group: 'Content' },
  { value: 'infographic', label: 'Infographic', icon: Image, group: 'Content' },
  { value: 'podcast', label: 'Podcast', icon: Mic, group: 'Content' },
  { value: 'workshop', label: 'Workshop or training', icon: Presentation, group: 'Education' },
  { value: 'learning-material', label: 'Learning material', icon: BookOpen, group: 'Education' },
  { value: 'policy', label: 'Policy brief', icon: ScrollText, group: 'Policy & legal' },
  { value: 'legal-analysis', label: 'Legal analysis', icon: Scale, group: 'Policy & legal' },
  { value: 'foi-request', label: 'FOI request', icon: FileSearch, group: 'Policy & legal' },
  { value: 'campaign', label: 'Campaign', icon: Megaphone, group: 'Advocacy' },
  { value: 'event', label: 'Event', icon: CalendarDays, group: 'Advocacy' },
  { value: 'other', label: 'Something else', icon: Sparkles, group: 'Other' },
];

const TYPE_BY_VALUE = new Map(WORK_TYPES.map((t) => [t.value, t]));

/** Human label for a stored type; unknown values (older free text) are shown as typed. */
export const workTypeLabel = (value?: string | null): string => {
  if (!value) return '';
  return TYPE_BY_VALUE.get(value.toLowerCase())?.label ?? value;
};
export const workTypeIcon = (value?: string | null): LucideIcon | undefined =>
  value ? TYPE_BY_VALUE.get(value.toLowerCase())?.icon : undefined;

/** Type options with the track's own group first. */
export const workTypeOptions = (track: Track): SelectOption[] => {
  const mine = WORK_TYPES.filter((t) => t.group === track.typeGroup);
  const rest = WORK_TYPES.filter((t) => t.group !== track.typeGroup);
  return [...mine, ...rest];
};

export const TRACKS: Record<TrackId, Track> = {
  build: {
    id: 'build',
    tabLabel: 'Projects',
    statLabel: 'Projects',
    icon: FolderGit2,
    intro: 'Share something you built for the community. An admin reviews it before it appears on the public projects page.',
    submitTitle: 'Submit a project',
    nameLabel: 'Project name',
    namePlaceholder: 'BetterGovPH Tracker',
    linkPlaceholder: 'https://github.com/…',
    linkHint: 'GitHub repo, live demo, or docs.',
    descPlaceholder: 'What does it do, and who is it for?',
    typeGroup: 'Code',
    defaultType: '',
    keywords: ['developer', 'frontend', 'backend', 'full stack', 'fullstack', 'engineer', 'devops', 'data', 'designer', 'ui', 'ux', 'security', 'code'],
    starts: [
      { title: 'Pick an open issue', desc: 'Good first issues across BetterGovPH repos.', icon: Code2, label: 'Browse issues', href: `${GITHUB_ORG}/issues?q=is%3Aopen+label%3A%22good+first+issue%22` },
      { title: 'Join a team', desc: 'Projects asking for developers right now.', icon: Users, label: 'See calls', tab: 'volunteer' },
      { title: 'Share what you built', desc: 'Get it listed on the public projects page.', icon: FolderGit2, label: 'Submit a project', tab: 'submit-project' },
    ],
  },
  create: {
    id: 'create',
    tabLabel: 'Content',
    statLabel: 'Content',
    icon: Clapperboard,
    intro: 'Share videos, articles and graphics that explain public data. Approved pieces appear on the public projects page next to the tools they explain.',
    submitTitle: 'Share your content',
    nameLabel: 'Title',
    namePlaceholder: 'Where the 2026 budget goes, in 60 seconds',
    linkPlaceholder: 'https://youtube.com/… or https://tiktok.com/…',
    linkHint: 'YouTube, TikTok, Facebook, a blog post, or a Drive folder.',
    descPlaceholder: 'What it explains, which data it uses, and who it’s for.',
    typeGroup: 'Content',
    defaultType: 'video',
    keywords: ['content', 'creator', 'video', 'writer', 'writing', 'journalist', 'editor', 'social', 'media', 'graphic', 'storyteller', 'copy'],
    starts: [
      { title: 'Explain a project', desc: 'Pick a live tool and make a short explainer for it.', icon: Video, label: 'Browse projects', href: '/projects' },
      { title: 'Answer a call for content', desc: 'Teams looking for writers and creators.', icon: Megaphone, label: 'See calls', tab: 'volunteer' },
      { title: 'Share your piece', desc: 'Post a video or article for review.', icon: Share2, label: 'Share content', tab: 'submit-project' },
    ],
  },
  teach: {
    id: 'teach',
    tabLabel: 'Workshops',
    statLabel: 'Sessions',
    icon: GraduationCap,
    intro: 'Share workshops, trainings and learning material that help people use public data and civic tools.',
    submitTitle: 'Share a workshop or material',
    nameLabel: 'Title',
    namePlaceholder: 'Reading your barangay budget: a 1-hour workshop',
    linkPlaceholder: 'https://docs.google.com/… or an event page',
    linkHint: 'Slides, a recording, a lesson plan, or the event page.',
    descPlaceholder: 'Who it’s for, what they’ll learn, and how long it runs.',
    typeGroup: 'Education',
    defaultType: 'workshop',
    keywords: ['educator', 'teacher', 'teaching', 'trainer', 'training', 'workshop', 'mentor', 'facilitator', 'literacy'],
    starts: [
      { title: 'Teach a tool', desc: 'Turn a live project into a short how-to session.', icon: Presentation, label: 'Browse projects', href: '/projects' },
      { title: 'Find a team that needs a trainer', desc: 'Calls asking for educators and facilitators.', icon: Users, label: 'See calls', tab: 'volunteer' },
      { title: 'Share your material', desc: 'Slides, lesson plans and recordings.', icon: BookOpen, label: 'Share material', tab: 'submit-project' },
    ],
  },
  policy: {
    id: 'policy',
    tabLabel: 'Briefs',
    statLabel: 'Briefs',
    icon: Landmark,
    intro: 'Share policy briefs, legal analysis, research and FOI requests that keep our tools accurate and accountable.',
    submitTitle: 'Share a brief or analysis',
    nameLabel: 'Title',
    namePlaceholder: 'What the Data Privacy Act means for open budget data',
    linkPlaceholder: 'https://docs.google.com/… or https://foi.gov.ph/…',
    linkHint: 'A document, a published paper, or an FOI request page.',
    descPlaceholder: 'The question it answers and what you found.',
    typeGroup: 'Policy & legal',
    defaultType: 'policy',
    keywords: ['lawyer', 'legal', 'law', 'policy', 'research', 'researcher', 'analyst', 'foi', 'privacy', 'compliance', 'budget'],
    starts: [
      { title: 'Review a project', desc: 'Check a live tool for privacy and legal issues.', icon: Scale, label: 'Browse projects', href: '/projects' },
      { title: 'Help with research', desc: 'Calls asking for researchers and policy experts.', icon: Search, label: 'See calls', tab: 'volunteer' },
      { title: 'Share your analysis', desc: 'Briefs, legal notes and FOI requests.', icon: ScrollText, label: 'Share a brief', tab: 'submit-project' },
    ],
  },
  organize: {
    id: 'organize',
    tabLabel: 'Campaigns',
    statLabel: 'Campaigns',
    icon: Megaphone,
    intro: 'Share campaigns, events and outreach that bring more Filipinos to the tools we build.',
    submitTitle: 'Share a campaign or event',
    nameLabel: 'Name',
    namePlaceholder: 'Open budget week in Cebu',
    linkPlaceholder: 'https://facebook.com/events/… or a campaign page',
    linkHint: 'An event page, a campaign post, or a sign-up form.',
    descPlaceholder: 'What it is, where it happens, and how people can join.',
    typeGroup: 'Advocacy',
    defaultType: 'campaign',
    keywords: ['advocate', 'advocacy', 'organizer', 'organizing', 'community', 'volunteer', 'outreach', 'event', 'campaign', 'social', 'translator', 'translation'],
    starts: [
      { title: 'Say hi on Discord', desc: 'Meet the organizers and see what’s planned.', icon: MessageCircle, label: 'Open Discord', href: DISCORD_INVITE },
      { title: 'Help a team find people', desc: 'Calls that need outreach and coordination.', icon: HandHeart, label: 'See calls', tab: 'volunteer' },
      { title: 'Share your campaign', desc: 'Events, drives and outreach you ran.', icon: Megaphone, label: 'Share a campaign', tab: 'submit-project' },
    ],
  },
};

const TRACK_BY_ROLE: Record<string, TrackId> = {
  content: 'create',
  writer: 'create',
  educator: 'teach',
  legal: 'policy',
  researcher: 'policy',
  advocate: 'organize',
  general: 'organize',
  // Their contribution is reading what the state publishes and saying what it means — a reviewed
  // dataset, a budget that does not add up — which is the brief track, not the build one.
  engineer: 'policy',
  architect: 'policy',
  accountant: 'policy',
};

/** The track for a member's primary role (a SPECIALIZATIONS label). Tech roles and unknown labels build. */
export const trackForRole = (specialization?: string | null): Track => {
  const spec = SPECIALIZATIONS.find((s) => s.label === specialization);
  return TRACKS[(spec && TRACK_BY_ROLE[spec.id]) || 'build'];
};

/** Whether a volunteer call reads like it wants this track's kind of help. */
export const callFitsTrack = (track: Track, text: string): boolean => {
  const t = ` ${text.toLowerCase()} `;
  return track.keywords.some((k) => new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t));
};

/**
 * Whether a volunteer call is a fit for a member. Calls now list roles from the same picker members
 * use at sign-up, so the member's exact role (or another role in their track) is the strong signal;
 * older free-text calls fall back to keyword matching.
 */
export const callFitsMember = (
  track: Track,
  specialization: string | null | undefined,
  call: { rolesNeeded?: string | null; title?: string | null; description?: string | null }
): boolean => {
  const roles = parseRoles(call.rolesNeeded);
  const known = roles.map((r) => SPECIALIZATIONS.find((s) => s.label.toLowerCase() === r.toLowerCase())).filter(Boolean);
  if (specialization && roles.some((r) => r.toLowerCase() === specialization.toLowerCase())) return true;
  if (known.some((s) => trackForRole(s!.label).id === track.id)) return true;
  if (known.length > 0) return false;
  return callFitsTrack(track, `${call.rolesNeeded || ''} ${call.title || ''} ${call.description || ''}`);
};

/** Member nav for a track: same four sections, the work tab named for the track. */
export const memberNav = (track: Track) => [
  { id: 'dashboard', label: 'Overview' },
  { id: 'submit-project', label: track.tabLabel },
  { id: 'volunteer', label: 'Volunteer calls' },
  { id: 'merch', label: 'Merch', soon: true },
];
