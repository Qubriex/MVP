// src/pages/LearnerDashboard.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function LearnerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [mastery, setMastery] = useState([]);

  useEffect(() => {
    api.get('/learner/dashboard').then(r => setData(r.data)).catch(() => {});
    api.get('/learner/mastery-record').then(r => setMastery(r.data)).catch(() => {});
  }, []);

  const langName = { hindi: 'हिंदी', telugu: 'తెలుగు' };

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <div style={S.logo}>VAK</div>
        <div style={S.navRight}>
          <div style={S.langBadge}>{langName[user?.language] || user?.language}</div>
          <span style={S.navName}>{user?.name}</span>
          <button style={S.logoutBtn} onClick={logout}>Logout</button>
        </div>
      </nav>

      <div style={S.content}>
        <h1 style={S.h1}>
          {user?.language === 'hindi' ? 'नमस्ते' : 'నమస్కారం'}, {user?.name}
        </h1>

        {data && (
          <>
            <p style={S.sub}>{data.engagement_title}</p>

            {/* Progress bar */}
            <div style={S.progressCard}>
              <div style={S.progressTop}>
                <span style={{ color: '#F1F5F9', fontWeight: 700 }}>Overall Progress</span>
                <span style={{ color: '#10B981', fontWeight: 700, fontSize: 20 }}>{data.progress_pct}%</span>
              </div>
              <div style={S.progressBar}>
                <div style={{ ...S.progressFill, width: `${data.progress_pct}%` }} />
              </div>
              <div style={S.progressMeta}>
                {data.nodes_mastered} of {data.total_nodes} skill nodes mastered
              </div>
            </div>

            {/* Current node */}
            {data.current_node_label && (
              <div style={S.currentNode}>
                <div style={{ color: '#94A3B8', fontSize: 12, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Current Skill</div>
                <div style={{ color: '#F1F5F9', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{data.current_node_label}</div>
                {data.current_cluster_label && <div style={{ color: '#60A5FA', fontSize: 13 }}>Cluster: {data.current_cluster_label}</div>}
                <button style={S.startBtn} onClick={() => navigate('/learn/session')}>
                  {user?.language === 'hindi' ? 'पढ़ाई शुरू करें →' : 'చదువు మొదలుపెట్టండి →'}
                </button>
              </div>
            )}

            {data.overall_status === 'completed' && (
              <div style={S.completedCard}>
                <div style={{ fontSize: 48, marginBottom: 8 }}>🎓</div>
                <div style={{ color: '#10B981', fontSize: 22, fontWeight: 800 }}>
                  {user?.language === 'hindi' ? 'बधाई हो!' : 'అభినందనలు!'}
                </div>
                <div style={{ color: '#94A3B8', fontSize: 15, marginTop: 8 }}>
                  You have completed all skill nodes. Your Mastery Log is ready.
                </div>
              </div>
            )}
          </>
        )}

        {/* Mastery record */}
        {mastery.length > 0 && (
          <>
            <h2 style={S.h2}>Skills I've Mastered</h2>
            <div style={S.masteryList}>
              {mastery.map((m, i) => (
                <div key={i} style={S.masteryCard}>
                  <div style={{ color: '#F1F5F9', fontWeight: 600, fontSize: 14 }}>{m.node_label}</div>
                  <div style={{ color: '#64748B', fontSize: 12, marginBottom: 8 }}>{m.cluster_label}</div>
                  <div style={S.masteryStats}>
                    <div><span style={S.statV}>{Math.round((m.mastery_attainment || 0) * 100)}%</span><span style={S.statL}> mastery</span></div>
                    <div><span style={S.statV}>{m.attempt_count}</span><span style={S.statL}> attempts</span></div>
                    <div><span style={{ ...S.statV, color: '#10B981' }}>✓</span><span style={S.statL}> mastered</span></div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0F172A', fontFamily: 'Arial, sans-serif' },
  nav: { background: '#1E293B', borderBottom: '1px solid #334155', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 },
  logo: { color: '#10B981', fontSize: 20, fontWeight: 800, letterSpacing: 3 },
  navRight: { display: 'flex', gap: 12, alignItems: 'center' },
  langBadge: { background: '#0F3A2A', color: '#10B981', padding: '4px 12px', borderRadius: 20, fontSize: 15, fontWeight: 600 },
  navName: { color: '#94A3B8', fontSize: 14 },
  logoutBtn: { background: 'transparent', color: '#64748B', border: '1px solid #334155', padding: '6px 13px', borderRadius: 7, fontSize: 13, cursor: 'pointer' },
  content: { maxWidth: 800, margin: '0 auto', padding: '40px 24px' },
  h1: { color: '#F1F5F9', fontSize: 28, fontWeight: 800, margin: '0 0 4px' },
  h2: { color: '#F1F5F9', fontSize: 18, fontWeight: 700, margin: '40px 0 16px' },
  sub: { color: '#64748B', fontSize: 14, margin: '0 0 32px' },
  progressCard: { background: '#1E293B', border: '1px solid #334155', borderRadius: 14, padding: '24px 28px', marginBottom: 20 },
  progressTop: { display: 'flex', justifyContent: 'space-between', marginBottom: 12 },
  progressBar: { height: 10, background: '#334155', borderRadius: 5, marginBottom: 8, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg, #10B981, #3B82F6)', borderRadius: 5, transition: 'width 0.4s' },
  progressMeta: { color: '#64748B', fontSize: 13 },
  currentNode: { background: '#0F2A1E', border: '1px solid #10B981', borderRadius: 14, padding: '24px 28px', marginBottom: 24 },
  startBtn: { background: '#10B981', color: 'white', border: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginTop: 16 },
  completedCard: { background: '#0A2A0A', border: '1px solid #10B981', borderRadius: 14, padding: '40px', textAlign: 'center', marginBottom: 32 },
  masteryList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 },
  masteryCard: { background: '#1E293B', border: '1px solid #334155', borderRadius: 10, padding: '16px 18px' },
  masteryStats: { display: 'flex', gap: 16 },
  statV: { color: '#10B981', fontWeight: 700, fontSize: 15 },
  statL: { color: '#64748B', fontSize: 12 }
};
