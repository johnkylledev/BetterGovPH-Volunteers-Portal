import { create } from 'zustand';
import { User, ApplicationStatus } from '../types';
import * as supabaseService from '../services/supabase';

interface AuthState {
  users: User[];
  currentUser: User | null;
  sessionUserId: string | null;
  register: (user: Omit<User, 'id' | 'uid' | 'status' | 'isAdmin' | 'createdAt' | 'updatedAt'> & { authProvider?: 'traditional' | 'google' }) => Promise<{ success: boolean; message: string }>;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  updateUserStatus: (id: string, status: ApplicationStatus, notes?: string) => Promise<{ success: boolean; message?: string }>;
  generateMemberId: (userId: string) => void;
  setUsers: (users: User[]) => void;
  setCurrentUser: (user: User | null) => void;
  setSessionUserId: (uid: string | null) => void;
  updateCurrentUserFromSupabase: (uid: string) => Promise<void>;
  authInitialized: boolean;
  setAuthInitialized: (val: boolean) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);
const generateMemberCode = () => `BGPH-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

export const useStore = create<AuthState>()((set, get) => ({
  users: [],
  currentUser: null,
      sessionUserId: null,
      authInitialized: false,
      setAuthInitialized: (val: boolean) => set({ authInitialized: val }),
      setSessionUserId: (uid: string | null) => set({ sessionUserId: uid }),

      register: async (userData) => {
        try {
          const authUser = await supabaseService.getUserData(userData.email);
          if (authUser) {
            set({ currentUser: authUser });
            return { success: true, message: 'Registration complete.' };
          }
          return { success: false, message: 'Registration requires Google OAuth.' };
        } catch (err: any) {
          return { success: false, message: err.message || 'Registration failed.' };
        }
      },

      login: async (email, password) => {
        try {
          const authUser = await supabaseService.getUserByEmail(email);
          if (authUser) {
            set({ currentUser: authUser });
            return { success: true, message: 'Login successful.' };
          }
          return { success: false, message: 'Please sign in with Google.' };
        } catch (err: any) {
          return { success: false, message: err.message || 'Login failed.' };
        }
      },

      logout: async () => {
        try {
          await supabaseService.signOut();
          set({ currentUser: null, users: [], sessionUserId: null, authInitialized: false });
          window.location.href = '/login';
        } catch {
          set({ currentUser: null, sessionUserId: null, authInitialized: false });
          window.location.href = '/login';
        }
      },

      setCurrentUser: (user: User | null) => {
        set({ currentUser: user });
      },

      updateCurrentUserFromSupabase: async (uid: string) => {
        try {
          console.log('Running security checks for user:', uid);
          let supabaseUserData = await supabaseService.getUserData(uid);

          // Retry logic if user data is not found (prevents race condition during registration)
          if (!supabaseUserData) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            supabaseUserData = await supabaseService.getUserData(uid);
          }

          if (supabaseUserData) {
            const user: User = {
              id: uid,
              uid: uid,
              fullName: supabaseUserData.fullName || '',
              email: supabaseUserData.email || '',
              photoURL: supabaseUserData.photoURL || '',
              role: supabaseUserData.role || 'Member',
              status: supabaseUserData.status || 'Pending',
              isAdmin: supabaseUserData.isAdmin || false,
              specialization: supabaseUserData.specialization || '',
              discordUsername: supabaseUserData.discordUsername || '',
              memberId: supabaseUserData.memberId || undefined,
              yearJoined: supabaseUserData.yearJoined,
              skills: supabaseUserData.skills || [],
              experienceLevel: supabaseUserData.experienceLevel,
              createdAt: supabaseUserData.createdAt,
              updatedAt: supabaseUserData.updatedAt,
            };

            set({ currentUser: user });
          } else {
          }
        } catch {
        }
      },

      updateUserStatus: async (id, status, notes) => {
        try {
          const generatedMemberId = await supabaseService.updateUserStatus(id, status, notes);

          set((state) => {
            const isCurrentUser = state.currentUser?.id === id;
            
            // Update users array
            const updatedUsers = state.users.map((u) => {
              if (u.id === id) {
                const updated = { ...u, status, adminNotes: notes || u.adminNotes };
                if (status === 'Approved' && !updated.memberId) {
                  updated.memberId = generatedMemberId || generateMemberCode();
                }
                return updated;
              }
              return u;
            });

            // Update currentUser directly if it's the one being updated
            let updatedCurrentUser = state.currentUser;
            if (isCurrentUser && state.currentUser) {
              updatedCurrentUser = { 
                ...state.currentUser, 
                status, 
                adminNotes: notes || state.currentUser.adminNotes 
              };
              if (status === 'Approved' && !updatedCurrentUser.memberId) {
                updatedCurrentUser.memberId = generatedMemberId || generateMemberCode();
              }
            }

            return {
              users: updatedUsers,
              currentUser: updatedCurrentUser,
            };
          });
          return { success: true };
        } catch (err: any) {
          return { success: false, message: err.message };
        }
      },

      generateMemberId: (userId) => {
        set((state) => {
          const updatedUsers = state.users.map((u) =>
            u.id === userId && !u.memberId ? { ...u, memberId: generateMemberCode() } : u
          );
          return { users: updatedUsers };
        });
      },

      setUsers: (users) => set({ users }),
    }));
