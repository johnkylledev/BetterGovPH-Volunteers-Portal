export type ApplicationStatus = 'Pending' | 'Approved' | 'Declined';

export type SkillLevel = 'Learner' | 'Practitioner' | 'Expert';
export type ExperienceLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Professional';

export type ProjectSubmissionStatus = 'pending' | 'approved' | 'rejected';
export type VolunteerCallStatus = 'open' | 'closed';

export interface UserSkill {
  name: string;
  level: SkillLevel;
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
}

export interface User {
  id: string;
  uid?: string;
  fullName: string;
  email: string;
  password?: string;
  photoURL?: string;
  specialization?: string;
  role: string;
  discordUsername?: string;
  status: ApplicationStatus;
  memberId?: string;
  adminNotes?: string;
  isAdmin: boolean;
  authProvider?: 'traditional' | 'google';
  yearJoined?: number;
  skills?: UserSkill[];
  experienceLevel?: ExperienceLevel;
  createdAt: string;
  updatedAt?: string;
}
