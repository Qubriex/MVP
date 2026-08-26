// src/pages/CapabilityTargetUpload.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function CapabilityTargetUpload() {
  const navigate = useNavigate();
  const [path, setPath] = useState('B');
  const [title, setTitle] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [timeWindow, setTimeWindow] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post('/institution/capability-targets', {
        title, path, raw_input: rawInput, time_window_weeks: parseInt(timeWindow) || null
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed');
    }
    setLoading(false);
  };

  const handleConfirm = async () => {
    try {
      await api.post(`/institution/capability-targets/${result.id}/confirm`);
      setConfirmed(true);
    } catch (err) {
      setError('Confirmation failed');
    }
  };

  const handleBuildPathway = async () => {
    setLoading(true);
    try {
      await api.post(`/institution/capability-targets/${result.id}/build-pathway`, { language: 'telugu' });
      navigate('/institution/engagement/new', { state: { capabilityTargetId: result.id, title } });
    } catch (err) {
      setError('Pathway build failed: ' + (err.response?.data?.error || err.message));
    }
    setLoading(false);
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.back} onClick={() => navigate('/institution/dashboard')}>← Back to Dashboard</div>
        <h1 style={styles.h1}>Upload Capability Target</h1>
        <p style={styles.sub}>Tell Vak what to build. Any format accepted.</p>

        <div style={styles.pathTabs}>
          <button style={{ ...styles.tab, ...(path === 'B' ? styles.tabActive : {}) }} onClick={() => setPath('B')}>
            Path B — Any Format
            <span style={styles.tabSub}>Curriculum, JD, skills list, plain text</span>
          </button>
          <button style={{ ...styles.tab, ...(path === 'A' ? styles.tabActive : {}) }} onClick={() => setPath('A')}>
            Path A — Structured
            <span style={styles.tabSub}>Standard capability target document</span>
          </button>
        </div>

        {!result ? (
          <form onSubmit={handleSubmit} style={styles.form}>
            {error && <div style={styles.error}>{error}</div>}
            <label style={styles.label}>Engagement Title</label>
            <input style={styles.input} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Python Fundamentals — Batch 1" required />

            <label style={styles.label}>
              {path === 'B' ? 'Paste your document, curriculum, or brief here' : 'Paste structured capability target document'}
            </label>
            {path === 'B' && (
              <div style={styles.pathBHint}>
                🤖 Vak's AI will extract the capability targets and return a structured summary for your confirmation before instruction begins.
              </div>
            )}
            <textarea style={styles.textarea} value={rawInput} onChange={e => setRawInput(e.target.value)}
              rows={14} placeholder={path === 'B' ?
                'Example:\nWe need our bootcamp students to be able to write basic Python programs including variables, loops, functions, and file handling. Students are Telugu speakers with limited English. 4-week programme, 25 students.' :
                'Paste structured document here...'
              } required />

            <label style={styles.label}>Time Window (weeks) — optional</label>
            <input style={styles.inputSm} type="number" value={timeWindow} onChange={e => setTimeWindow(e.target.value)} placeholder="e.g. 4" min="1" max="52" />

            <button style={styles.btn} type="submit" disabled={loading}>
              {loading ? 'Processing…' : path === 'B' ? 'Extract Capability Targets →' : 'Submit Target →'}
            </button>
          </form>
        ) : (
          <div style={styles.resultBox}>
            <div style={styles.resultHeader}>
              <div style={styles.resultTitle}>
                {path === 'B' ? '✅ Targets Extracted' : '✅ Target Received'}
              </div>
              {path === 'B' && (
                <div style={styles.confBadge}>
                  Confidence: {Math.round((result.extraction?.extraction_confidence || 0) * 100)}%
                </div>
              )}
            </div>

            {path === 'B' && result.extraction && (
              <>
                <p style={styles.resultSub}>Review the extracted targets below. Confirm to begin instruction.</p>
                <div style={styles.confSummary}>{result.extraction.confirmation_summary}</div>

                {result.extraction.ambiguities?.length > 0 && (
                  <div style={styles.ambig}>
                    <strong>⚠️ Clarification needed:</strong>
                    <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                      {result.extraction.ambiguities.map((a, i) => <li key={i} style={{ color: '#FCD34D', fontSize: 13, marginBottom: 4 }}>{a}</li>)}
                    </ul>
                  </div>
                )}

                <h3 style={styles.clusterHead}>Extracted Clusters</h3>
                <div style={styles.clusterList}>
                  {result.extraction.clusters?.map((c, i) => (
                    <div key={i} style={styles.clusterCard}>
                      <div style={styles.clusterName}>{c.label}</div>
                      <div style={styles.clusterMeta}>{c.required_proficiency} · {c.priority} priority</div>
                      {c.description && <div style={styles.clusterDesc}>{c.description}</div>}
                    </div>
                  ))}
                </div>

                {!confirmed ? (
                  <button style={styles.confirmBtn} onClick={handleConfirm}>
                    ✓ Confirm — These targets are correct. Begin instruction setup.
                  </button>
                ) : (
                  <button style={styles.proceedBtn} onClick={handleBuildPathway} disabled={loading}>
                    {loading ? 'Building pathway…' : 'Build Learning Pathway & Start Engagement →'}
                  </button>
                )}
              </>
            )}

            {path === 'A' && (
              <button style={styles.proceedBtn} onClick={handleBuildPathway} disabled={loading}>
                {loading ? 'Building pathway…' : 'Build Learning Pathway & Start Engagement →'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const s = '#334155', bg = '#1E293B', dark = '#0F172A';
const styles = {
  page: { minHeight: '100vh', background: dark, fontFamily: 'Arial, sans-serif', padding: 24 },
  container: { maxWidth: 760, margin: '0 auto' },
  back: { color: '#3B82F6', cursor: 'pointer', fontSize: 14, marginBottom: 24 },
  h1: { color: '#F1F5F9', fontSize: 26, fontWeight: 800, margin: '0 0 4px' },
  sub: { color: '#64748B', fontSize: 15, margin: '0 0 32px' },
  pathTabs: { display: 'flex', gap: 12, marginBottom: 32 },
  tab: { flex: 1, background: bg, border: `1px solid ${s}`, borderRadius: 10, padding: '16px 20px', cursor: 'pointer', textAlign: 'left', color: '#94A3B8', fontSize: 15, fontWeight: 600, display: 'flex', flexDirection: 'column', gap: 4 },
  tabActive: { borderColor: '#3B82F6', background: '#1E3A5F', color: '#60A5FA' },
  tabSub: { fontSize: 12, fontWeight: 400, color: '#64748B' },
  form: { display: 'flex', flexDirection: 'column' },
  error: { background: '#450A0A', color: '#FCA5A5', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 14 },
  label: { color: '#94A3B8', fontSize: 13, marginBottom: 6, marginTop: 20 },
  input: { background: dark, border: `1px solid ${s}`, color: '#F1F5F9', padding: '10px 12px', borderRadius: 8, fontSize: 15, outline: 'none' },
  inputSm: { background: dark, border: `1px solid ${s}`, color: '#F1F5F9', padding: '10px 12px', borderRadius: 8, fontSize: 15, width: 120 },
  pathBHint: { background: '#1E3A5F', border: '1px solid #1D4ED8', color: '#93C5FD', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 8 },
  textarea: { background: dark, border: `1px solid ${s}`, color: '#F1F5F9', padding: '12px', borderRadius: 8, fontSize: 14, lineHeight: 1.6, resize: 'vertical', fontFamily: 'Arial, sans-serif' },
  btn: { background: '#3B82F6', color: 'white', border: 'none', padding: '13px', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer', marginTop: 24 },
  resultBox: { background: bg, border: `1px solid ${s}`, borderRadius: 14, padding: 28 },
  resultHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  resultTitle: { color: '#10B981', fontSize: 18, fontWeight: 700 },
  confBadge: { background: '#064E3B', color: '#10B981', padding: '4px 12px', borderRadius: 20, fontSize: 13 },
  resultSub: { color: '#94A3B8', fontSize: 14, margin: '0 0 16px' },
  confSummary: { background: dark, border: `1px solid ${s}`, borderRadius: 8, padding: '14px 16px', color: '#CBD5E1', fontSize: 14, lineHeight: 1.7, marginBottom: 16 },
  ambig: { background: '#451A03', border: '1px solid #92400E', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#FDE68A', fontSize: 13 },
  clusterHead: { color: '#F1F5F9', fontSize: 16, fontWeight: 700, margin: '20px 0 10px' },
  clusterList: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 },
  clusterCard: { background: dark, border: `1px solid ${s}`, borderRadius: 8, padding: '12px 16px' },
  clusterName: { color: '#F1F5F9', fontWeight: 700, fontSize: 14, marginBottom: 4 },
  clusterMeta: { color: '#3B82F6', fontSize: 12, textTransform: 'capitalize', marginBottom: 4 },
  clusterDesc: { color: '#64748B', fontSize: 13, lineHeight: 1.5 },
  confirmBtn: { background: '#10B981', color: 'white', border: 'none', padding: '13px 20px', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%' },
  proceedBtn: { background: '#8B5CF6', color: 'white', border: 'none', padding: '13px 20px', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: 8 }
};
