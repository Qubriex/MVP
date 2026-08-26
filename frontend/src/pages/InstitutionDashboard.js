// src/pages/InstitutionDashboard.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function InstitutionDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [engagements, setEngagements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/institution/engagements').then(r => { setEngagements(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const statusColor = { active: '#10B981', completed: '#3B82F6', setup: '#F59E0B', on_hold: '#6B7280' };

  return (
    <div style={styles.page}>
      <nav style={styles.nav}>
        <div style={styles.navLogo}>VAK</div>
        <div style={styles.navRight}>
          <span style={styles.navName}>{user?.name}</span>
          <button style={styles.navBtn} onClick={() => navigate('/institution/upload-target')}>+ New Engagement</button>
          <button style={styles.navLogout} onClick={logout}>Logout</button>
        </div>
      </nav>

      <div style={styles.content}>
        <h1 style={styles.h1}>Institution Dashboard</h1>
        <p style={styles.sub}>Manage capability builds for your learners</p>

        <div style={styles.actionRow}>
          <ActionCard icon="📋" title="Upload Capability Target" desc="Submit a new brief — any format" onClick={() => navigate('/institution/upload-target')} color="#3B82F6" />
          <ActionCard icon="👥" title="Manage Learners" desc="Add or import your learner cohort" onClick={() => navigate('/institution/upload-target')} color="#10B981" />
          <ActionCard icon="📊" title="View Mastery Logs" desc="Download structured capability evidence" onClick={() => {}} color="#8B5CF6" />
        </div>

        <h2 style={styles.h2}>Active Engagements</h2>
        {loading ? <p style={styles.muted}>Loading…</p> : (
          engagements.length === 0
            ? <EmptyState onStart={() => navigate('/institution/upload-target')} />
            : <div style={styles.engList}>
                {engagements.map(e => (
                  <div key={e.id} style={styles.engCard} onClick={() => navigate(`/institution/engagement/${e.id}`)}>
                    <div style={styles.engTop}>
                      <div>
                        <div style={styles.engTitle}>{e.title}</div>
                        <div style={styles.engSub}>{e.ct_title} · {e.language === 'hindi' ? 'हिंदी' : 'తెలుగు'}</div>
                      </div>
                      <div style={{ ...styles.engStatus, background: statusColor[e.status] + '22', color: statusColor[e.status] }}>
                        {e.status}
                      </div>
                    </div>
                    <div style={styles.engStats}>
                      <Stat label="Learners" val={e.learner_count} />
                      <Stat label="Completed" val={e.completed_count} />
                      <Stat label="Started" val={new Date(e.created_at).toLocaleDateString('en-IN')} />
                    </div>
                  </div>
                ))}
              </div>
        )}
      </div>
    </div>
  );
}

function ActionCard({ icon, title, desc, onClick, color }) {
  return (
    <div style={{ ...styles.actionCard, borderTopColor: color }} onClick={onClick}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ color: '#F1F5F9', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{title}</div>
      <div style={{ color: '#64748B', fontSize: 13 }}>{desc}</div>
    </div>
  );
}

function Stat({ label, val }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: '#F1F5F9', fontWeight: 700, fontSize: 18 }}>{val}</div>
      <div style={{ color: '#64748B', fontSize: 12 }}>{label}</div>
    </div>
  );
}

function EmptyState({ onStart }) {
  return (
    <div style={styles.empty}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
      <p style={{ color: '#94A3B8', marginBottom: 16 }}>No engagements yet. Upload a capability target to begin.</p>
      <button style={styles.emptyBtn} onClick={onStart}>Start First Engagement</button>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#0F172A', fontFamily: 'Arial, sans-serif' },
  nav: { background: '#1E293B', borderBottom: '1px solid #334155', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 },
  navLogo: { color: '#3B82F6', fontSize: 20, fontWeight: 800, letterSpacing: 3 },
  navRight: { display: 'flex', gap: 12, alignItems: 'center' },
  navName: { color: '#94A3B8', fontSize: 14 },
  navBtn: { background: '#3B82F6', color: 'white', border: 'none', padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  navLogout: { background: 'transparent', color: '#64748B', border: '1px solid #334155', padding: '7px 14px', borderRadius: 7, fontSize: 13, cursor: 'pointer' },
  content: { maxWidth: 1100, margin: '0 auto', padding: '40px 24px' },
  h1: { color: '#F1F5F9', fontSize: 28, fontWeight: 800, margin: '0 0 4px' },
  h2: { color: '#F1F5F9', fontSize: 20, fontWeight: 700, margin: '40px 0 16px' },
  sub: { color: '#64748B', fontSize: 15, margin: '0 0 40px' },
  actionRow: { display: 'flex', gap: 16, marginBottom: 48, flexWrap: 'wrap' },
  actionCard: { background: '#1E293B', border: '1px solid #334155', borderTopWidth: 3, borderRadius: 12, padding: '24px 20px', flex: 1, minWidth: 220, cursor: 'pointer' },
  engList: { display: 'flex', flexDirection: 'column', gap: 12 },
  engCard: { background: '#1E293B', border: '1px solid #334155', borderRadius: 12, padding: '20px 24px', cursor: 'pointer' },
  engTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  engTitle: { color: '#F1F5F9', fontSize: 16, fontWeight: 700, marginBottom: 4 },
  engSub: { color: '#64748B', fontSize: 13 },
  engStatus: { padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, textTransform: 'capitalize' },
  engStats: { display: 'flex', gap: 32 },
  muted: { color: '#64748B' },
  empty: { background: '#1E293B', border: '1px dashed #334155', borderRadius: 16, padding: 60, textAlign: 'center' },
  emptyBtn: { background: '#3B82F6', color: 'white', border: 'none', padding: '12px 28px', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' }
};
