// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const t = localStorage.getItem('vak_token');
    const u = localStorage.getItem('vak_user');
    const r = localStorage.getItem('vak_role');
    if (t && u) { setToken(t); setUser(JSON.parse(u)); setRole(r); }
  }, []);

  const login = (tokenVal, userData, roleVal) => {
    setToken(tokenVal); setUser(userData); setRole(roleVal);
    localStorage.setItem('vak_token', tokenVal);
    localStorage.setItem('vak_user', JSON.stringify(userData));
    localStorage.setItem('vak_role', roleVal);
  };

  const logout = () => {
    setToken(null); setUser(null); setRole(null);
    localStorage.removeItem('vak_token');
    localStorage.removeItem('vak_user');
    localStorage.removeItem('vak_role');
  };

  return (
    <AuthContext.Provider value={{ user, token, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
