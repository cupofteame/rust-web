'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { LoginResponse } from './api';

interface AuthContextType {
  user: LoginResponse | null;
  token: string | null;
  login: (userData: LoginResponse) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LoginResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Check for saved auth data on mount
    const savedAuth = localStorage.getItem('auth');
    if (savedAuth) {
      const authData = JSON.parse(savedAuth);
      setUser(authData.user);
      setToken(authData.token);
    }
  }, []);

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

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
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