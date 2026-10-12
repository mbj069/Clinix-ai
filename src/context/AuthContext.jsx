import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setToken, getToken } from '../utils/api';
import { ROLES } from '../data/mockData';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on load
  useEffect(() => {
    (async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const { user } = await api('/auth/me');
        setUser(user);
      } catch {
        setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (username, password) => {
    try {
      const { token, user } = await api('/auth/login', {
        method: 'POST',
        body: { username, password },
      });
      setToken(token);
      setUser(user);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch { /* best effort */ }
    setToken(null);
    setUser(null);
  }, []);

  const can = useCallback(
    (permission) => !!user && (ROLES[user.role]?.permissions || []).includes(permission),
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, login, logout, can, authLoading: loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
