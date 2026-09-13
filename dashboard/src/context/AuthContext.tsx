import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types/index.js';
import { ApiService } from '../services/api.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('attendance_teacher_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('attendance_teacher_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await ApiService.getMe();
        if (res.data.success && res.data.user) {
          const raw = res.data.user;
          setUser({
            ...raw,
            fullName: raw.fullName || raw.full_name || 'Staff User',
          });
        } else {
          logout();
        }
      } catch (err) {
        console.warn('Session expired or invalid token');
        logout();
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = (newToken: string, newUser: any) => {
    localStorage.setItem('attendance_teacher_token', newToken);
    setToken(newToken);
    setUser({
      ...newUser,
      fullName: newUser.fullName || newUser.full_name || 'Staff User',
    });
  };

  const logout = () => {
    localStorage.removeItem('attendance_teacher_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
