import { createContext, useContext, useState, useEffect } from 'react';
import { USERS, ROLES } from '../data/mockData';
import { logAudit } from '../utils/auditLogger';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('clinix_session');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) localStorage.setItem('clinix_session', JSON.stringify(user));
    else localStorage.removeItem('clinix_session');
  }, [user]);

  const login = (username, password) => {
    const found = USERS.find(
      (u) => u.username === username && u.password === password
    );
    if (!found) return { ok: false, error: 'Invalid username or password.' };
    const { password: _pw, ...safe } = found;
    setUser(safe);
    logAudit({ actorId: safe.id, actorName: safe.name, role: safe.role, action: 'LOGIN', details: 'User signed in' });
    return { ok: true };
  };

  const logout = () => {
    if (user) {
      logAudit({ actorId: user.id, actorName: user.name, role: user.role, action: 'LOGOUT', details: 'User signed out' });
    }
    setUser(null);
  };

  const can = (permission) =>
    !!user && (ROLES[user.role]?.permissions || []).includes(permission);

  return (
    <AuthContext.Provider value={{ user, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
