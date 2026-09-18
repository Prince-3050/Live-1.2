import React from 'react';
import axios from 'axios';
import { Server, Trash2, ArrowRight, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';

export default function ConnectionList({
  connections,
  activeConnId,
  onSelectConnection,
  onRemoveConnection,
  onToggleReadOnly,
  onExploreSchema
}) {
  const handleDisconnect = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to disconnect from this database?')) return;

    try {
      await axios.delete(`/api/connections/${id}`);
      onRemoveConnection(id);
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  const getDbBadgeClass = (type) => {
    switch (type) {
      case 'sqlite': return 'db-sqlite';
      case 'mysql': return 'db-mysql';
      case 'postgres': return 'db-postgres';
      case 'mongodb': return 'db-mongodb';
      default: return 'db-sqlite';
    }
  };

  return (
    <div className="glass-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Server size={20} className="text-primary-blue" />
          <span>Active Connections ({connections.length})</span>
        </div>
      </div>

      {connections.length === 0 ? (
        <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Server size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
          <p style={{ fontWeight: 500 }}>No Active Database Connections</p>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>
            Configure an External Local DB or select Demo Fixture DB to connect.
          </p>
        </div>
      ) : (
        <div className="conn-card-list">
          {connections.map((conn) => {
            const isSelected = conn.id === activeConnId;
            return (
              <div
                key={conn.id}
                className={`conn-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectConnection(conn.id)}
                style={{ cursor: 'pointer' }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                      <span className={`db-type-badge ${getDbBadgeClass(conn.type)}`}>
                        {conn.type}
                      </span>
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '4px',
                        background: conn.sourceType === 'external_local' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
                        color: conn.sourceType === 'external_local' ? 'var(--success-emerald)' : 'var(--text-dim)',
                        fontWeight: 600
                      }}>
                        {conn.sourceType === 'external_local' ? 'EXTERNAL' : 'DEMO'}
                      </span>
                    </div>

                    <span style={{
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      color: conn.status === 'connected' ? 'var(--success-emerald)' : 'var(--danger-rose)'
                    }}>
                      <span className="pulse-dot" style={{
                        background: conn.status === 'connected' ? 'var(--success-emerald)' : 'var(--danger-rose)'
                      }} />
                      {conn.status}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.2rem' }}>
                    {conn.name}
                  </h3>

                  <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                    {conn.type === 'sqlite'
                      ? conn.config?.filepath
                      : `${conn.config?.host || '127.0.0.1'}:${conn.config?.port || ''} [${conn.config?.database || 'default'}]`}
                  </p>
                </div>

                <div style={{ marginTop: '1rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectConnection(conn.id);
                        onExploreSchema();
                      }}
                    >
                      <span>Explore</span>
                      <ArrowRight size={14} />
                    </button>

                    <button
                      type="button"
                      className={`btn ${conn.readOnly ? 'btn-secondary' : 'btn-quick'}`}
                      style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleReadOnly(conn.id, conn.readOnly);
                      }}
                      title={conn.readOnly ? 'Read-Only Enabled. Click to toggle.' : 'Write Mode Enabled. Click to toggle read-only.'}
                    >
                      {conn.readOnly ? <ShieldCheck size={14} className="text-success-emerald" /> : <ShieldAlert size={14} className="text-danger-rose" />}
                      <span>{conn.readOnly ? 'Read-Only' : 'Write Mode'}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ padding: '0.35rem 0.6rem', fontSize: '0.78rem' }}
                    onClick={(e) => handleDisconnect(e, conn.id)}
                    title="Disconnect"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
