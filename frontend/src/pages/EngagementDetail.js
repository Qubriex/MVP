// src/pages/EngagementDetail.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function EngagementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [producing, setProducing] = useState(false);
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    api.get(`/institution/engagements/${id}`).then(r => { setData(r.data); setLoading(false); });
    api.get(`/institution/engagements/${id}/mastery-logs`).then(r => setLogs(r.data)).catch(() => {});
  }, [id]);

  const produceLogs = async () => {
    setProducing(true);
    await api.post(`/institution/engagements/${id}/produce-mastery-logs`);
    const res = await api.get(`/institution/engagements/${id}/mastery-logs`);
    setLogs(res.data);
    setProducing(false);
  };

  if (loading) return <div style={{ color: '#94A3B8', padding: 40, fontFamily: 'Arial' }}>Loading…</div>;

  const statusColor = { active: '#10B981', completed: '#3B82F6', in_progress: '#F59E0B', paused: '#6B7280' };
  const completedCount = data.learners?.filter(l => l.overall_status === 'completed').length || 0;

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.back} onClick={() => navigate('/institution/dashboard')}>← Dashboard</div>
        <div style={S.header}>
          <div>
            <h1 style={S.h1}>{data.title}</h1>
            <p style={S.sub}>{data.ct_title} · {data.language === 'hindi' ? 'हिंदी' : 'తెలుగు'}</p>
          </div>
          <div style={{ ...S.badge, background: statusColor[data.status] + '22', color: statusColor[data.status] }}>
            {data.status}
          </div>
        </div>

        {/* Summary stats */}
        <div style={S.statsRow}>
          <StatBox val={data.learners?.length || 0} label="Total Learners" />
          <StatBox val={completedCount} label="Completed" color="#10B981" />
          <StatBox val={`${data.learners?.length ? Math.round(completedCount / data.learners.length * 100) : 0}%`} label="Completion Rate" />
          <StatBox val={logs.length} label="Mastery Logs Produced" color="#8B5CF6" />
        </div>

        {/* Engagement ID — for learner login */}
        <div style={S.engIdBox}>
          <div style={{ color: '#94A3B8', fontSize: 13, marginBottom: 4 }}>Engagement ID (share with learners for login)</div>
          <div style={{ color: '#60A5FA', fontFamily: 'monospace', fontSize: 15, fontWeight: 700 }}>{data.id}</div>
        </div>

        {/* Learner roster */}
        <h2 style={S.h2}>Learner Progress</h2>
        <div style={S.table}>
          <div style={S.tableHead}>
            <div style={S.th}>Learner</div><div style={S.th}>Ref</div><div style={S.th}>Current Node</div>
            <div style={S.th}>Nodes Mastered</div><div style={S.th}>Status</div>
          </div>
          {data.learners?.map((l, i) => (
            <div key={i} style={S.tableRow}>
              <div style={S.td}>{l.name}</div>
              <div style={{ ...S.td, color: '#64748B', fontFamily: 'monospace', fontSize: 12 }}>{l.learner_ref}</div>
              <div style={{ ...S.td, color: '#60A5FA', fontSize: 13 }}>{l.current_node_label || '—'}</div>
              <div style={S.td}>{l.nodes_mastered}</div>
              <div style={{ ...S.td }}>
                <span style={{ color: statusColor[l.overall_status] || '#94A3B8', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
                  {l.overall_status?.replace('_', ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Mastery Logs section */}
        <div style={S.logsSection}>
          <div style={S.logsHeader}>
            <h2 style={S.h2}>Mastery Logs</h2>
            <button style={S.produceBtn} onClick={produceLogs} disabled={producing}>
              {producing ? 'Producing…' : 'Produce Mastery Logs'}
            </button>
          </div>
          {logs.length === 0 ? (
            <div style={S.noLogs}>No Mastery Logs produced yet. Complete the instruction cycle, then produce logs.</div>
          ) : (
            logs.map(log => (
              <div key={log.id} style={S.logCard} onClick={() => navigate(`/institution/mastery-log/${log.id}`)}>
                <div style={{ color: '#F1F5F9', fontWeight: 600 }}>{log.learner_name}</div>
                <div style={{ color: '#64748B', fontSize: 12 }}>{log.learner_ref}</div>
                <div style={{ color: '#10B981', fontSize: 13, marginTop: 4 }}>
                  {log.log_data?.overall_completion || 0}% complete · View Log →
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ val, label, color = '#F1F5F9' }) {
  return (
    <div style={{ background: '#1E293B', border: '1px solid #334155', borderRadius: 10, padding: '20px 24px', flex: 1, minWidth: 120 }}>
      <div style={{ color, fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{val}</div>
      <div style={{ color: '#64748B', fontSize: 13 }}>{label}</div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0F172A', fontFamily: 'Arial, sans-serif', padding: 24 },
  container: { maxWidth: 1000, margin: '0 auto' },
  back: { color: '#3B82F6', cursor: 'pointer', fontSize: 14, marginBottom: 24 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
  h1: { color: '#F1F5F9', fontSize: 26, fontWeight: 800, margin: '0 0 4px' },
  h2: { color: '#F1F5F9', fontSize: 18, fontWeight: 700, margin: '0 0 16px' },
  sub: { color: '#64748B', fontSize: 14, margin: 0 },
  badge: { padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, textTransform: 'capitalize' },
  statsRow: { display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' },
  engIdBox: { background: '#1E3A5F', border: '1px solid #1D4ED8', borderRadius: 10, padding: '14px 18px', marginBottom: 32 },
  table: { background: '#1E293B', border: '1px solid #334155', borderRadius: 12, overflow: 'hidden', marginBottom: 40 },
  tableHead: { display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 1fr 1fr', background: '#0F172A', padding: '10px 16px', borderBottom: '1px solid #334155' },
  tableRow: { display: 'grid', gridTemplateColumns: '2fr 1fr 2fr 1fr 1fr', padding: '12px 16px', borderBottom: '1px solid #1E293B' },
  th: { color: '#64748B', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  td: { color: '#CBD5E1', fontSize: 14 },
  logsSection: { marginBottom: 40 },
  logsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  produceBtn: { background: '#8B5CF6', color: 'white', border: 'none', padding: '9px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  noLogs: { background: '#1E293B', border: '1px dashed #334155', borderRadius: 10, padding: '24px', color: '#64748B', fontSize: 14, textAlign: 'center' },
  logCard: { background: '#1E293B', border: '1px solid #334155', borderRadius: 10, padding: '16px 20px', marginBottom: 8, cursor: 'pointer' }
};
