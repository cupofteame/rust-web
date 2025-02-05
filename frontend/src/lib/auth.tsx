'use client';

import { createContext, useContext, useState, useEffect, useLayoutEffect } from 'react';
import { LoginResponse } from './api';

interface AuthContextType {
  user: LoginResponse | null;
  token: string | null;
  login: (userData: LoginResponse) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LoginResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // Handle initial hydration
  useIsomorphicLayoutEffect(() => {
    setIsHydrated(true);
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!isHydrated) return;

    const savedAuth = localStorage.getItem('auth');
    if (savedAuth) {
      try {
        const authData = JSON.parse(savedAuth);
        if (authData.token && typeof authData.token === 'string') {
          setUser(authData.user);
          setToken(authData.token);
        } else {
          localStorage.removeItem('auth');
        }
      } catch (e) {
        localStorage.removeItem('auth');
      }
    }
    setIsLoading(false);
  }, [isHydrated]);

  const login = (userData: LoginResponse) => {
    setUser(userData);
    setToken(userData.token);
    localStorage.setItem('auth', JSON.stringify({
      user: userData,
      token: userData.token,
    }));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth');
  };

  // Show nothing until the component has hydrated
  if (!isHydrated) {
    return null;
  }

  // After hydration, show loading state if still loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 