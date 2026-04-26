export type ApplicationStatus = 'Pending' | 'Approved' | 'Declined';

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
  createdAt: string;
  updatedAt?: string;
}
