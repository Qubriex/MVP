// src/pages/InstitutionLogin.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function InstitutionLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/institution/login', { email, password });
      login(res.data.token, res.data.institution, 'institution');
      navigate('/institution/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>VAK</div>
        <h2 style={styles.title}>Institution Login</h2>
        <p style={styles.sub}>Commission capability builds for your learners</p>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Email</label>
          <input style={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <label style={styles.label}>Password</label>
          <input style={styles.input} type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p style={styles.switch}>
          Learner? <a href="/learner-login" style={styles.link}>Learner Login →</a>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' },
  card: { background: '#1E293B', border: '1px solid #334155', borderRadius: 16, padding: 40, width: '100%', maxWidth: 400 },
  logo: { color: '#3B82F6', fontSize: 28, fontWeight: 800, letterSpacing: 4, marginBottom: 8 },
  title: { color: '#F1F5F9', fontSize: 22, fontWeight: 700, margin: '0 0 4px' },
  sub: { color: '#64748B', fontSize: 13, margin: '0 0 24px' },
  error: { background: '#450A0A', border: '1px solid #7F1D1D', color: '#FCA5A5', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14 },
  label: { display: 'block', color: '#94A3B8', fontSize: 13, marginBottom: 6, marginTop: 16 },
  input: { width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F1F5F9', padding: '10px 12px', borderRadius: 8, fontSize: 15, boxSizing: 'border-box', outline: 'none' },
  btn: { width: '100%', background: '#3B82F6', color: 'white', border: 'none', padding: '12px', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer', marginTop: 24 },
  switch: { color: '#64748B', fontSize: 13, textAlign: 'center', marginTop: 20 },
  link: { color: '#3B82F6', textDecoration: 'none' }
};
