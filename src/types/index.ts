export type ApplicationStatus = 'Pending' | 'Approved' | 'Declined';

export type SkillLevel = 'Learner' | 'Practitioner' | 'Expert';
export type ExperienceLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Professional';

export type ProjectSubmissionStatus = 'pending' | 'approved' | 'rejected';
export type VolunteerCallStatus = 'open' | 'closed';

export interface UserSkill {
  name: string;
  level: SkillLevel;
  /** Pinned by the member; shown first on their profile. */
  featured?: boolean;
}

export interface ProjectSubmission {
  id: string;
  userId: string;
  projectName: string;
  projectUrl: string;
  description: string;
  projType?: string;
  status: ProjectSubmissionStatus;
  createdAt: string;
  repoUrl?: string;
  stage?: ProjectStage;
  ownerType?: 'member' | 'org';
  ownerName?: string;
  /** Message from the reviewing admin, shown to the submitter. */
  adminNote?: string;
  reviewedAt?: string;
  repo?: RepoStats | null;
  submittedBy?: {
    fullName: string;
    email: string;
  };
}

export interface VolunteerCall {
  id: string;
  userId: string;
  title: string;
  projectUrl: string;
  description: string;
  rolesNeeded?: string;
  contact?: string;
  callType?: CallType;
  location?: string;
  neededBy?: string;
  commitment?: 'one-off' | 'few-hours' | 'weekly' | 'ongoing';
  workMode?: 'remote' | 'onsite' | 'hybrid';
  /** Small, well-described task a newcomer can pick up. */
  goodFirst?: boolean;
  /** Messenger / WhatsApp / Viber / Telegram / Discord invite. Members only. */
  chatUrl?: string;
  /** Signed-in member's own "I'm interested" status on this call. */
  myInterest?: 'new' | 'contacted' | 'withdrawn' | null;
  /** On calls you posted: how many people raised a hand. */
  interestCount?: number;
  /** Public view: contact details exist but are shown after signing in. */
  contactHidden?: boolean;
  status: VolunteerCallStatus;
  createdAt: string;
  postedBy?: {
    fullName: string;
    email: string;
  };
}

export interface Project {
  id: string;
  title: string;
  description: string;
  url: string;
  projType?: string;
  createdAt?: string;
  repoUrl?: string;
  stage?: ProjectStage;
  ownerName?: string;
  repo?: RepoStats | null;
  /** 'local' for portal projects (they have a team page); anything else comes from bettergov.ph */
  source?: string;
}

export interface User {
  id: string;
  uid?: string;
  fullName: string;
  email: string;
  photoURL?: string;
  specialization?: string;
  role: string;
  discordUsername?: string;
  status: ApplicationStatus;
  memberId?: string;
  adminNotes?: string;
  isAdmin: boolean;
  /** Custom admin role (role-based access). Super admins have isAdmin instead. */
  adminRoleId?: string | null;
  /** The admin role this person holds: "Super admin" or a custom role's name. */
  adminRoleName?: string;
  /** Profile picture from the sign-in provider (Google or GitHub). */
  photoUrl?: string;
  adminPermissions?: string[];
  authProvider?: 'traditional' | 'google' | 'github';
  yearJoined?: number;
  skills?: UserSkill[];
  experienceLevel?: ExperienceLevel;
  createdAt: string;
  updatedAt?: string;
  discordId?: string;
  discordConnected?: boolean;
  discordVerified?: boolean;
  discordDisplayName?: string;
  discordAvatar?: string;
  /** Optional profile links keyed by platform (youtube, github, …). Private to the member and admins. */
  links?: Partial<Record<'youtube' | 'tiktok' | 'facebook' | 'instagram' | 'x' | 'linkedin' | 'github' | 'portfolio', string>>;
  /** Optional second role, e.g. a developer who also makes videos. */
  secondarySpecialization?: string;
  /** Listed in the public Volunteers directory. */
  showInDirectory?: boolean;
  /** Show the full name publicly instead of "John K****". */
  showFullName?: boolean;
  consentVersion?: string;
  consentAt?: string;
  consentPurposes?: string[];
  deletionRequestedAt?: string;
  /** Optional username or pseudonym shown instead of the legal name. */
  displayName?: string;
  /** When they agreed to the code of conduct. */
  cocAcceptedAt?: string;
  availability?: string[];
  hoursPerWeek?: string;
  region?: string;
  languages?: string[];
}

export interface RepoStats {
  slug: string; url: string; ok: boolean; error?: string;
  description?: string | null; language?: string | null; stars?: number; forks?: number;
  openIssues?: number; closedIssues?: number; openPrs?: number; mergedPrs?: number;
  commits30d?: number; lastCommitAt?: string | null; lastCommitMessage?: string | null;
  ci?: 'passing' | 'failing' | 'pending' | null; archived?: boolean; isPrivate?: boolean;
  hasReadme?: boolean; license?: string | null;
  release?: { tag: string; at: string } | null;
  milestone?: { title: string; dueOn: string | null; percent: number } | null;
  activity?: 'active' | 'quiet' | 'stale' | 'archived';
  progress?: { percent: number; basis: 'milestone' | 'issues' } | null;
  checks?: { key: string; label: string; ok: boolean }[];
  checkedAt: string;
}

export type ProjectStage = 'idea' | 'building' | 'beta' | 'live' | 'completed' | 'needs-lead';
export type CallType = 'people' | 'venue' | 'equipment' | 'funding' | 'transport' | 'food' | 'printing' | 'other';

export interface TeamPerson {
  userId?: string; name: string; role: string | null; memberId: string | null; avatarUrl: string | null;
  discordUsername?: string | null; skills?: string[];
  availability?: string[]; hoursPerWeek?: string | null; region?: string | null; languages?: string[];
}
export interface TeamInfo {
  available: boolean;
  project: { id: string; name: string; status: string; url: string; repoUrl: string | null; description: string; stage: ProjectStage | null; projType: string | null; repo?: RepoStats | null; chatUrl?: string | null; imported?: boolean };
  owner: { type: 'member' | 'org'; name: string; userId?: string } | null;
  members: (TeamPerson & { isHead: boolean; teamRole: string | null })[];
  me: { status: 'pending' | 'approved' | 'declined' | 'left' | null; isHead: boolean; canManage: boolean; approvedMember: boolean } | null;
  requests?: { id: string; message: string; teamRole: string | null; createdAt: string; person: TeamPerson }[];
}
export interface MyTeam {
  projectId: string; projectName: string; projectStatus: string; role: 'head' | 'member';
  status: 'pending' | 'approved' | 'declined' | 'left'; teamRole: string | null; requestedAt: string; decidedAt: string | null;
}

export interface CallInterest {
  id: string; status: 'new' | 'contacted' | 'withdrawn'; message: string; contact: string; createdAt: string;
  person: {
    name: string; role: string | null; secondaryRole: string | null; memberId: string | null; approved: boolean;
    avatarUrl: string | null; discordUsername: string | null; skills: string[];
    availability?: string[]; hoursPerWeek?: string | null; region?: string | null; languages?: string[];
  };
}

export interface ImportProjectRow {
  name: string; url: string; description?: string; type?: string; repoUrl?: string; chatUrl?: string; stage?: ProjectStage; ownerName?: string;
}

export interface AppNotification {
  id: string; kind: string; title: string; body: string | null; link: string | null; read: boolean; createdAt: string;
}

export type ReportReason = 'spam' | 'harassment' | 'misleading' | 'privacy' | 'other';
export interface ReportItem {
  id: string; targetType: 'call' | 'project'; targetId: string; targetTitle: string; targetStatus: string | null;
  reason: ReportReason; details: string; status: 'open' | 'dismissed' | 'actioned'; resolution: string; createdAt: string; reporter: string;
}

export interface AdminOverview {
  // Counts your role doesn't cover are left out by the server.
  queue: { pendingApps?: number; pendingProjects?: number; openReports?: number; deletionRequests?: number; noConsent?: number };
  numbers: { members: number; approvedProjects: number; importedProjects: number; openCalls: number; interests7d: number; newMembers7d: number };
  roles: { role: string; count: number }[];
  deletions: { uid: string; name: string; email: string; memberId: string | null; status: string; requestedAt: string }[];
  feed: { kind: 'member' | 'project' | 'call'; text: string; status?: string; at: string; link?: string }[];
}

export interface HoursEntry {
  id: string; hours: number; activity: string; workedOn: string; status: 'pending' | 'confirmed' | 'declined'; createdAt: string;
  projectId: string | null; callId: string | null; where: string; person: { name: string; memberId: string | null };
}
export interface CertificateData {
  name: string; memberId: string | null; role: string | null; secondaryRole: string | null; communityRole: string;
  yearJoined: number | null; totalHours: number; items: { name: string; hours: number; from: string; to: string }[]; teams: number; issuedAt: string;
}
export interface ProjectUpdate { id: string; body: string; createdAt: string; mine: boolean; author: string; avatarUrl: string | null }
