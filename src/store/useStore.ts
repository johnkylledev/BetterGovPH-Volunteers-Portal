import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, ApplicationStatus } from '../types';
import * as supabaseService from '../services/supabase';

interface AuthState {
  users: User[];
  currentUser: User | null;
  register: (user: Omit<User, 'id' | 'uid' | 'status' | 'isAdmin' | 'createdAt' | 'updatedAt'> & { authProvider?: 'traditional' | 'google' }) => Promise<{ success: boolean; message: string }>;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  updateUserStatus: (id: string, status: ApplicationStatus, notes?: string) => Promise<{ success: boolean; message?: string }>;
  generateMemberId: (userId: string) => void;
  setUsers: (users: User[]) => void;
  setCurrentUser: (user: User | null) => void;
  updateCurrentUserFromSupabase: (uid: string) => Promise<void>;
  authInitialized: boolean;
  setAuthInitialized: (val: boolean) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 9);
const generateMemberCode = () => `BGPH-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

export const useStore = create<AuthState>()(
  persist(
    (set, get) => ({
      users: [],
      currentUser: null,
      authInitialized: false,
      setAuthInitialized: (val: boolean) => set({ authInitialized: val }),

      register: async (userData) => {
        const { users } = get();
        if (users.find((u) => u.email === userData.email)) {
          return { success: false, message: 'Email already registered.' };
        }
        if (userData.discordUsername && users.find((u) => u.discordUsername === userData.discordUsername)) {
          return { success: false, message: 'Discord username already registered.' };
        }

        try {
          const authUser = await supabaseService.registerWithEmailPassword(userData);
          const newUser: User = {
            ...userData,
            id: authUser.uid,
            uid: authUser.uid,
            yearJoined: userData.yearJoined,
            status: 'Pending',
            isAdmin: false,
            authProvider: userData.authProvider || 'traditional',
            createdAt: new Date().toISOString(),
          };

          set({ users: [...users, newUser], currentUser: newUser });
          return { success: true, message: 'Registration successful.' };
        } catch (error: any) {
          console.error('Registration error:', error);
          return { success: false, message: error.message || 'Registration failed.' };
        }
      },

      login: async (email, password) => {
        try {
          const authUser = await supabaseService.signInWithEmailPassword(email, password);
          if (authUser) {
            await get().updateCurrentUserFromSupabase(authUser.id);
            return { success: true, message: 'Login successful.' };
          }
          return { success: false, message: 'Invalid credentials.' };
        } catch (error: any) {
          console.error('Login error:', error);
          return { success: false, message: error.message || 'Invalid credentials.' };
        }
      },

      logout: async () => {
        try {
          await supabaseService.signOut();
          set({ currentUser: null, users: [] });
        } catch (error) {
          console.error('Logout error:', error);
          set({ currentUser: null });
        }
      },

      setCurrentUser: (user: User | null) => {
        set({ currentUser: user });
      },

      updateCurrentUserFromSupabase: async (uid: string) => {
        try {
          let supabaseUserData = await supabaseService.getUserData(uid);
          if (supabaseUserData) {
            if (supabaseUserData.isAdmin && !supabaseUserData.memberId) {
              supabaseUserData.memberId = await supabaseService.ensureUserHasMemberId(uid);
            }
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
              createdAt: supabaseUserData.createdAt,
              updatedAt: supabaseUserData.updatedAt,
            };
            set({ currentUser: user });
          }
        } catch (error) {
          console.error('Error updating current user:', error);
        }
      },

      updateUserStatus: async (id, status, notes) => {
        try {
          const generatedMemberId = await supabaseService.updateUserStatus(id, status, notes);

          set((state) => {
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
            const isCurrentUser = state.currentUser?.id === id;
            return {
              users: updatedUsers,
              currentUser: isCurrentUser ? updatedUsers.find((u) => u.id === id) : state.currentUser,
            };
          });
          return { success: true };
        } catch (err: any) {
          console.error('Error updating user status:', err);
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
    }),
    {
      name: 'bettergovph-store-v2',
      partialize: (state) => ({
        users: state.users,
        currentUser: state.currentUser ? {
          ...state.currentUser,
          password: undefined,
        } : null,
      }),
    }
  )
);
