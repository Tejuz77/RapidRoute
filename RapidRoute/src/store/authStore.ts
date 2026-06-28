import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: 'customer' | 'operator' | 'admin';
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  isOperator: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      login: (user: User, token: string) => {
        set({ user, token });
      },
      logout: () => {
        set({ user: null, token: null });
      },
      isAuthenticated: () => {
        return !!get().token && !!get().user;
      },
      isOperator: () => {
        const { user } = get();
        return user?.role === 'operator' || user?.role === 'admin';
      },
    }),
    {
      name: 'rapidroute-auth',
    }
  )
);
