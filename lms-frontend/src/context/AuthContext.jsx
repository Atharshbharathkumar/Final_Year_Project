import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, errorMessage, TOKEN_KEY, USER_KEY } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

/** Maps the server's UserDto onto the shape the UI renders. */
const mapUser = (dto) => ({
  id: dto.id,
  name: dto.fullName,
  email: dto.email,
  role: (dto.role || 'STUDENT').toLowerCase(),
  avatar: dto.avatarEmoji || '👤',
  avatarUrl: dto.avatarUrl,
  department: dto.department,
  year: dto.studyYear,
  linkedStudentId: dto.linkedStudentId,
  linkedStudentName: dto.linkedStudentName,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  // Restore the cached profile immediately, then revalidate the token against
  // the server so a revoked or expired session does not linger.
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setUser(null);
      setLoading(false);
      return;
    }

    const cached = localStorage.getItem(USER_KEY);
    if (cached) {
      try {
        setUser(JSON.parse(cached));
      } catch {
        localStorage.removeItem(USER_KEY);
      }
    }

    let cancelled = false;
    authApi
      .getCurrentUser()
      .then(({ data }) => {
        if (cancelled) return;
        const mapped = mapUser(data);
        setUser(mapped);
        localStorage.setItem(USER_KEY, JSON.stringify(mapped));
      })
      .catch(() => {
        if (cancelled) return;
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const { data } = await authApi.login({ email, password });
      const mapped = mapUser(data.user);
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(mapped));
      setToken(data.accessToken);
      setUser(mapped);
      return mapped;
    } catch (error) {
      throw new Error(errorMessage(error, 'Login failed. Please check your credentials.'));
    }
  }, []);

  const register = useCallback(async ({ email, password, fullName, role }) => {
    try {
      const { data } = await authApi.register({ email, password, fullName, role: role.toUpperCase() });
      const mapped = mapUser(data.user);
      localStorage.setItem(TOKEN_KEY, data.accessToken);
      localStorage.setItem(USER_KEY, JSON.stringify(mapped));
      setToken(data.accessToken);
      setUser(mapped);
      return mapped;
    } catch (error) {
      throw new Error(errorMessage(error, 'Registration failed.'));
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};