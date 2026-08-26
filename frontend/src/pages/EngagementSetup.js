// src/pages/EngagementSetup.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';

export default function EngagementSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { capabilityTargetId, title: initTitle } = location.state || {};
  const [title, setTitle] = useState(initTitle || '');
  const [language, setLanguage] = useState('telugu');
  const [learners, setLearners] = useState([{ name: '', learner_ref: '', email: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addLearner = () => setLearners([...learners, { name: '', learner_ref: '', email: '' }]);
  const updateLearner = (i, field, val) => {
    const next = [...learners]; next[i][field] = val; setLearners(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      // Register learners first
      const bulkRes = await api.post('/institution/learners/bulk', {
        learners: learners.filter(l => l.name && l.learner_ref).map(l => ({ ...l, language }))
      });

      // Fetch learner IDs
      const allLearners = await api.get('/institution/learners');
      const refSet = new Set(learners.map(l => l.learner_ref));
      const learnerIds = allLearners.data.filter(l => refSet.has(l.learner_ref)).map(l => l.id);

      // Create engagement
      const engRes = await api.post('/institution/engagements', {
        capability_target_id: capabilityTargetId,
        title, language, learner_ids: learnerIds
      });
      navigate(`/institution/engagement/${engRes.data.engagement_id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Setup failed');
    }
    setLoading(false);
  };

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.back} onClick={() => navigate('/institution/dashboard')}>← Dashboard</div>
        <h1 style={S.h1}>Setup Engagement</h1>
        {error && <div style={S.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <label style={S.label}>Engagement Title</label>
          <input style={S.input} value={title} onChange={e => setTitle(e.target.value)} required />
          <label style={S.label}>Language of Instruction</label>
          <div style={S.langRow}>
            {['telugu', 'hindi'].map(lang => (
              <button key={lang} type="button" style={{ ...S.langBtn, ...(language === lang ? S.langBtnActive : {}) }} onClick={() => setLanguage(lang)}>
                {lang === 'hindi' ? 'हिंदी Hindi' : 'తెలుగు Telugu'}
              </button>
            ))}
          </div>
          <h3 style={S.h3}>Add Learners</h3>
          {learners.map((l, i) => (
            <div key={i} style={S.learnerRow}>
              <input style={S.inputSm} placeholder="Name" value={l.name} onChange={e => updateLearner(i, 'name', e.target.value)} />
              <input style={S.inputSm} placeholder="Ref No (e.g. LRNR-001)" value={l.learner_ref} onChange={e => updateLearner(i, 'learner_ref', e.target.value)} />
              <input style={S.inputSm} placeholder="Email (optional)" value={l.email} onChange={e => updateLearner(i, 'email', e.target.value)} />
            </div>
          ))}
          <button type="button" style={S.addBtn} onClick={addLearner}>+ Add Learner</button>
          <button type="submit" style={S.submitBtn} disabled={loading}>
            {loading ? 'Starting…' : 'Start Engagement →'}
          </button>
        </form>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0F172A', fontFamily: 'Arial, sans-serif', padding: 24 },
  container: { maxWidth: 700, margin: '0 auto' },
  back: { color: '#3B82F6', cursor: 'pointer', fontSize: 14, marginBottom: 24 },
  h1: { color: '#F1F5F9', fontSize: 24, fontWeight: 800, margin: '0 0 24px' },
  h3: { color: '#F1F5F9', fontSize: 16, fontWeight: 700, margin: '24px 0 12px' },
  error: { background: '#450A0A', color: '#FCA5A5', padding: '10px 14px', borderRadius: 8, marginBottom: 16 },
  label: { display: 'block', color: '#94A3B8', fontSize: 13, marginBottom: 6, marginTop: 20 },
  input: { width: '100%', background: '#0F172A', border: '1px solid #334155', color: '#F1F5F9', padding: '10px 12px', borderRadius: 8, fontSize: 15, boxSizing: 'border-box' },
  inputSm: { flex: 1, background: '#0F172A', border: '1px solid #334155', color: '#F1F5F9', padding: '9px 11px', borderRadius: 7, fontSize: 14 },
  langRow: { display: 'flex', gap: 12, marginTop: 8 },
  langBtn: { flex: 1, background: '#1E293B', border: '1px solid #334155', color: '#94A3B8', padding: '12px', borderRadius: 8, cursor: 'pointer', fontSize: 15 },
  langBtnActive: { background: '#0F3A2A', border: '1px solid #10B981', color: '#10B981' },
  learnerRow: { display: 'flex', gap: 8, marginBottom: 8 },
  addBtn: { background: 'transparent', border: '1px dashed #334155', color: '#64748B', padding: '8px 16px', borderRadius: 7, cursor: 'pointer', fontSize: 13, marginBottom: 24 },
  submitBtn: { width: '100%', background: '#3B82F6', color: 'white', border: 'none', padding: '13px', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer' }
};
