// src/pages/MasteryLogView.js
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function MasteryLogView() {
  const { logId } = useParams();
  const navigate = useNavigate();
  const [log, setLog] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/institution/engagements/x/mastery-logs`).catch(() => {});
    // Try to get from admin route
    api.get(`/admin/mastery-logs/${logId}`).then(r => {
      setLog(r.data.log_data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [logId]);

  if (loading) return <div style={{ color: '#94A3B8', padding: 40, fontFamily: 'Arial' }}>Loading…</div>;
  if (!log) return <div style={{ color: '#FCA5A5', padding: 40, fontFamily: 'Arial' }}>Log not found</div>;

  const confPct = (v) => v !== null && v !== undefined ? `${Math.round(v * 100)}%` : '—';
  const mastery_to_bar = (v) => v || 0;

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={S.back} onClick={() => navigate(-1)}>← Back</div>

        {/* Header */}
        <div style={S.logHeader}>
          <div>
            <div style={S.docType}>VAK MASTERY LOG</div>
            <h1 style={S.learnerName}>{log.learner_name}</h1>
            <div style={S.meta}>
              {log.capability_target_document_reference} ·&nbsp;
              {log.language_of_instruction === 'hindi' ? 'हिंदी' : 'తెలుగు'} ·&nbsp;
              Produced {new Date(log.produced_at).toLocaleDateString('en-IN')}
            </div>
          </div>
          <div style={S.overallBox}>
            <div style={S.overallPct}>{log.overall_completion}%</div>
            <div style={S.overallLabel}>Programme Complete</div>
          </div>
        </div>

        <div style={S.institution}>Institution: {log.institution}</div>
        <div style={S.refRow}>
          <span style={S.refLabel}>Learner Ref:</span> <span style={S.refVal}>{log.learner_reference}</span>
          <span style={{ ...S.refLabel, marginLeft: 24 }}>Engagement:</span> <span style={S.refVal}>{log.engagement_id?.slice(0, 8)}…</span>
        </div>

        {/* Clusters */}
        {log.clusters?.map((cluster, ci) => (
          <div key={ci} style={S.clusterBlock}>
            <div style={S.clusterHeader}>
              <div>
                <div style={S.clusterName}>{cluster.cluster}</div>
                {cluster.cluster_ref && <div style={S.clusterRef}>Ref: {cluster.cluster_ref}</div>}
              </div>
              <div style={S.clusterMeta}>
                <div style={S.metaItem}>
                  <span style={S.metaLabel}>Nodes Mastered</span>
                  <span style={S.metaVal}>{cluster.nodes_mastered}/{cluster.nodes_total}</span>
                </div>
                <div style={S.metaItem}>
                  <span style={S.metaLabel}>Avg Mastery</span>
                  <span style={S.metaVal}>{cluster.average_mastery_attainment ?? '—'}%</span>
                </div>
                <div style={S.metaItem}>
                  <span style={S.metaLabel}>Sim. Readiness</span>
                  <span style={{ ...S.metaVal, color: cluster.simulation_readiness_flag ? '#10B981' : '#F59E0B' }}>
                    {cluster.simulation_readiness_flag ? 'Ready' : 'Not Yet'}
                  </span>
                </div>
              </div>
            </div>

            {/* BLANK FIELDS — intentionally present */}
            <div style={S.blankFieldsRow}>
              <div style={S.blankField}>
                <span style={S.blankLabel}>Readiness Classification</span>
                <span style={S.blankValue}>— [OWNED BY INSTITUTION]</span>
              </div>
              <div style={S.blankField}>
                <span style={S.blankLabel}>External Score</span>
                <span style={S.blankValue}>— [OWNED BY ASSESSMENT PLATFORM]</span>
              </div>
            </div>

            {/* Skill nodes table */}
            <div style={S.nodesTable}>
              <div style={S.nodeHead}>
                <span>Skill Node</span>
                <span>Mastery</span>
                <span>Time (min)</span>
                <span>Attempts</span>
                <span>Confidence</span>
                <span>Status</span>
              </div>
              {cluster.skill_nodes?.map((node, ni) => (
                <div key={ni} style={S.nodeRow}>
                  <div style={S.nodeLabel}>{node.skill_node}</div>
                  <div style={S.nodeCell}>
                    <div style={S.masteryBar}>
                      <div style={{ ...S.masteryFill, width: `${node.mastery_attainment ?? 0}%` }} />
                    </div>
                    <span style={{ color: '#F1F5F9', fontSize: 12 }}>{node.mastery_attainment ?? '—'}%</span>
                  </div>
                  <div style={S.nodeCell}>{node.time_to_mastery_minutes ?? '—'}</div>
                  <div style={S.nodeCell}>{node.attempt_count}</div>
                  <div style={S.nodeCell}>{node.confidence_indicator !== null ? `${Math.round((node.confidence_indicator || 0) * 100)}%` : '—'}</div>
                  <div style={{ ...S.nodeCell, color: node.node_status === 'mastered' ? '#10B981' : '#F59E0B', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
                    {node.node_status?.replace('_', ' ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Boundary statement */}
        <div style={S.boundary}>{log.boundary_statement}</div>
        <div style={S.footer}>Produced by Vak AI Technologies · Receive. Build. Return.</div>
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0F172A', fontFamily: 'Arial, sans-serif', padding: 24 },
  container: { maxWidth: 960, margin: '0 auto' },
  back: { color: '#3B82F6', cursor: 'pointer', fontSize: 14, marginBottom: 24 },
  logHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#1B3A6B', border: '1px solid #2E5BA8', borderRadius: 14, padding: '24px 28px', marginBottom: 12 },
  docType: { color: '#60A5FA', fontSize: 11, letterSpacing: 3, fontWeight: 700, marginBottom: 6 },
  learnerName: { color: '#F1F5F9', fontSize: 26, fontWeight: 800, margin: '0 0 6px' },
  meta: { color: '#93C5FD', fontSize: 13 },
  overallBox: { textAlign: 'center', background: '#0F172A', borderRadius: 10, padding: '16px 24px' },
  overallPct: { color: '#10B981', fontSize: 36, fontWeight: 800, lineHeight: 1 },
  overallLabel: { color: '#64748B', fontSize: 12, marginTop: 4 },
  institution: { color: '#64748B', fontSize: 13, marginBottom: 4 },
  refRow: { color: '#94A3B8', fontSize: 13, marginBottom: 32 },
  refLabel: { color: '#64748B', fontWeight: 600 },
  refVal: { color: '#CBD5E1', marginLeft: 4 },
  clusterBlock: { background: '#1E293B', border: '1px solid #334155', borderRadius: 14, padding: '20px 24px', marginBottom: 20 },
  clusterHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  clusterName: { color: '#F1F5F9', fontSize: 18, fontWeight: 700 },
  clusterRef: { color: '#64748B', fontSize: 12, marginTop: 2 },
  clusterMeta: { display: 'flex', gap: 24 },
  metaItem: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
  metaLabel: { color: '#64748B', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaVal: { color: '#F1F5F9', fontSize: 18, fontWeight: 700 },
  blankFieldsRow: { display: 'flex', gap: 12, marginBottom: 16 },
  blankField: { flex: 1, background: '#0F172A', border: '1px dashed #334155', borderRadius: 8, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 2 },
  blankLabel: { color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  blankValue: { color: '#334155', fontSize: 13, fontStyle: 'italic' },
  nodesTable: { border: '1px solid #334155', borderRadius: 10, overflow: 'hidden' },
  nodeHead: { display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr', background: '#0F172A', padding: '8px 14px', color: '#64748B', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, gap: 8 },
  nodeRow: { display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 1fr', padding: '10px 14px', borderTop: '1px solid #1E293B', alignItems: 'center', gap: 8 },
  nodeLabel: { color: '#CBD5E1', fontSize: 13 },
  nodeCell: { color: '#94A3B8', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 },
  masteryBar: { width: 50, height: 6, background: '#334155', borderRadius: 3, overflow: 'hidden' },
  masteryFill: { height: '100%', background: '#10B981', borderRadius: 3, transition: 'width 0.3s' },
  boundary: { background: '#1A1A2E', border: '1px solid #2E2E5E', borderRadius: 10, padding: '14px 18px', color: '#6B7280', fontSize: 12, lineHeight: 1.7, marginTop: 32, marginBottom: 12 },
  footer: { color: '#334155', fontSize: 12, textAlign: 'center', paddingBottom: 40 }
};
