// src/pages/LearnerLogin.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function LearnerLogin() {
  const [ref, setRef] = useState('');
  const [engagementId, setEngagementId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/learner/login', { learner_ref: ref, engagement_id: engagementId });
      login(res.data.token, res.data.learner, 'learner');
      navigate('/learn/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your learner reference and engagement ID.');
    }
    setLoading(false);
  };

  const lang = { hindi: 'हिंदी', telugu: 'తెలుగు' };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>VAK</div>
        <h2 style={styles.title}>Learner Login</h2>
        <p style={styles.sub}>Enter your learner reference and engagement code</p>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Learner Reference Number</label>
          <input style={styles.input} value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. LRNR-001" required />
          <label style={styles.label}>Engagement ID</label>
          <input style={styles.input} value={engagementId} onChange={e => setEngagementId(e.target.value)} placeholder="Provided by your institution" required />
          <button style={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Entering…' : 'Enter Learning Space'}
          </button>
        </form>
        <div style={styles.langRow}>
          <span style={styles.langTag}>हिंदी</span>
          <span style={styles.langTag}>తెలుగు</span>
        </div>
        <p style={styles.switch}><a href="/login" style={styles.link}>← Institution Login</a></p>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' },
  card: { background: '#1E293B', border: '1px solid #334155', borderRadius: 16, padding: 40, width: '100%', maxWidth: 420 },
  logo: { color: '#10B981', fontSize: 28, fontWeight: 800, letterSpacing: 4, marginBottom: 8 },
  title: { color: '#F1F5F9', fontSize: 22, fontWeight: 700, margin: '0 0 4px' },
  sub: { color: '#64748B', fontSize: 13, margin: '0 0 24px' },
  error: { background: '#450A0A', border: '1px solid #7F1D1D', color: '#FCA5A5', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14 },
  label: { display: 'block', color: '#94A3B8', fontSize: 13, marginBottom: 6, marginTop: 16 },
  input: { width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F1F5F9', padding: '10px 12px', borderRadius: 8, fontSize: 15, boxSizing: 'border-box' },
  btn: { width: '100%', background: '#10B981', color: 'white', border: 'none', padding: '12px', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer', marginTop: 24 },
  langRow: { display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 },
  langTag: { background: '#0F3A2A', color: '#10B981', padding: '5px 14px', borderRadius: 20, fontSize: 15, fontWeight: 600 },
  switch: { color: '#64748B', fontSize: 13, textAlign: 'center', marginTop: 16 },
  link: { color: '#3B82F6', textDecoration: 'none' }
};
