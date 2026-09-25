import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then(res => {
          setUser(res.data)
          window.dispatchEvent(new CustomEvent('trillionai:auth-changed', { detail: { authenticated: true } }))
        })
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (credentials) => {
    const res = await api.post('/auth/login', credentials);
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    window.dispatchEvent(new CustomEvent('trillionai:auth-changed', { detail: { authenticated: true } }));
    return res.data;
  };

  const register = async (data) => {
    const res = await api.post('/auth/register', data);
    localStorage.setItem('token', res.data.token);

    const initialPreferences = {};
    const language = localStorage.getItem('language');
    const theme = localStorage.getItem('theme');
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (language) initialPreferences.language = language;
    if (theme) initialPreferences.theme = theme;
    if (timezone) initialPreferences.timezone = timezone;
    if (Object.keys(initialPreferences).length) {
      await api.patch('/settings/preferences', initialPreferences).catch(() => {});
    }

    setUser(res.data.user);
    window.dispatchEvent(new CustomEvent('trillionai:auth-changed', { detail: { authenticated: true } }));
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    window.dispatchEvent(new CustomEvent('trillionai:auth-changed', { detail: { authenticated: false } }));
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      register,
      logout,
      isAuthenticated: !!user,
      isOwner: !!user?.isOwner,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
