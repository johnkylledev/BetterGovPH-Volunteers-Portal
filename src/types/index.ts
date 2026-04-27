export type ApplicationStatus = 'Pending' | 'Approved' | 'Declined';

export type SkillLevel = 'Learner' | 'Practitioner' | 'Expert';
export type ExperienceLevel = 'Beginner' | 'Intermediate' | 'Advanced' | 'Professional';

export interface UserSkill {
  name: string;
  level: SkillLevel;
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
