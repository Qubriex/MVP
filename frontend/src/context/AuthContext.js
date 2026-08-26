// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const t = localStorage.getItem('qubirex_token');
    const u = localStorage.getItem('qubirex_user');
    const r = localStorage.getItem('qubirex_role');
    if (t && u) { setToken(t); setUser(JSON.parse(u)); setRole(r); }
  }, []);

  const login = (tokenVal, userData, roleVal) => {
    setToken(tokenVal); setUser(userData); setRole(roleVal);
    localStorage.setItem('qubirex_token', tokenVal);
    localStorage.setItem('qubirex_user', JSON.stringify(userData));
    localStorage.setItem('qubirex_role', roleVal);
  };

  const logout = () => {
    setToken(null); setUser(null); setRole(null);
    localStorage.removeItem('qubirex_token');
    localStorage.removeItem('qubirex_user');
    localStorage.removeItem('qubirex_role');
  };

  return (
    <AuthContext.Provider value={{ user, token, role, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
