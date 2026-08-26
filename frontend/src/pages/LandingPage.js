// src/pages/LandingPage.js
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
  const navigate = useNavigate();
  return (
    <div style={styles.container}>
      <div style={styles.hero}>
        <div style={styles.badge}>VAK AI TECHNOLOGIES</div>
        <h1 style={styles.headline}>Receive. Build. Return.</h1>
        <p style={styles.sub}>
          Native-language AI instruction engine.<br/>
          Builds real capability in Hindi and Telugu — not translated from English.
        </p>
        <div style={styles.threeLaws}>
          {['RECEIVE', 'BUILD', 'RETURN'].map((law, i) => (
            <div key={law} style={styles.lawCard}>
              <div style={styles.lawNum}>{i + 1}</div>
              <div style={styles.lawText}>{law}</div>
              <div style={styles.lawDesc}>
                {law === 'RECEIVE' && 'Accept any capability target from any institution'}
                {law === 'BUILD' && 'Construct capability natively in the learner\'s language'}
                {law === 'RETURN' && 'Produce a clean, structured Mastery Log as evidence'}
              </div>
            </div>
          ))}
        </div>
        <div style={styles.btnRow}>
          <button style={styles.btnPrimary} onClick={() => navigate('/login')}>
            Institution Login
          </button>
          <button style={styles.btnSecondary} onClick={() => navigate('/learner-login')}>
            Learner Login
          </button>
        </div>
        <div style={styles.langs}>
          <span style={styles.langTag}>हिंदी</span>
          <span style={styles.langTag}>తెలుగు</span>
          <span style={styles.langNote}>Phase 1 Languages</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif', padding: '24px' },
  hero: { maxWidth: 760, textAlign: 'center' },
  badge: { color: '#60A5FA', fontSize: 12, letterSpacing: 3, fontWeight: 700, marginBottom: 16, textTransform: 'uppercase' },
  headline: { color: '#F1F5F9', fontSize: 48, fontWeight: 800, margin: '0 0 16px', lineHeight: 1.1 },
  sub: { color: '#94A3B8', fontSize: 18, lineHeight: 1.7, margin: '0 0 48px' },
  threeLaws: { display: 'flex', gap: 16, marginBottom: 48, justifyContent: 'center', flexWrap: 'wrap' },
  lawCard: { background: '#1E293B', border: '1px solid #334155', borderRadius: 12, padding: '24px 20px', flex: 1, minWidth: 180 },
  lawNum: { color: '#3B82F6', fontSize: 28, fontWeight: 800, marginBottom: 4 },
  lawText: { color: '#F1F5F9', fontSize: 15, fontWeight: 700, letterSpacing: 2, marginBottom: 8 },
  lawDesc: { color: '#64748B', fontSize: 13, lineHeight: 1.5 },
  btnRow: { display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 32, flexWrap: 'wrap' },
  btnPrimary: { background: '#3B82F6', color: 'white', border: 'none', padding: '14px 32px', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  btnSecondary: { background: 'transparent', color: '#60A5FA', border: '1px solid #3B82F6', padding: '14px 32px', borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer' },
  langs: { display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' },
  langTag: { background: '#1E3A5F', color: '#60A5FA', padding: '6px 14px', borderRadius: 20, fontSize: 16, fontWeight: 600 },
  langNote: { color: '#475569', fontSize: 12 }
};
