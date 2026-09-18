import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Network, Database, ShieldCheck, ArrowRight, Table, Key, RefreshCw, Cpu, Layers, Radio, Globe, Link2, Box, Sparkles, CheckCircle2, Server, Layers3, Activity } from 'lucide-react';

export default function StructuralFlowView({ activeConnection, connections = [], systemStatus, onSelectTable, onNavigateToSchema, onSelectConnection }) {
  // Requirement: Default to 2D view (false), switch to 3D when user clicks 3D button
  const [view3D, setView3D] = useState(false);
  const [multiDbScope, setMultiDbScope] = useState(true); // Default to multi-database overview if multiple connections exist
  const [schema, setSchema] = useState(null);
  const [tableDetails, setTableDetails] = useState([]);
  const [multiDbSchemas, setMultiDbSchemas] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hoveredTable, setHoveredTable] = useState(null);

  const isTunnelActive = systemStatus?.mode === 'TUNNEL ACTIVE';

  // Helper to fetch schema data for active connection and multi-DBs
  const fetchFlowData = async () => {
    if (!activeConnection && connections.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const targetConn = activeConnection || connections[0];
      if (targetConn) {
        const res = await axios.get(`/api/schema/${targetConn.id}`);
        setSchema(res.data);

        if (res.data?.tables?.length > 0) {
          const detailsPromises = res.data.tables.slice(0, 8).map(t =>
            axios.get(`/api/schema/${targetConn.id}/table/${encodeURIComponent(t.name)}`).then(r => r.data).catch(() => null)
          );
          const details = await Promise.all(detailsPromises);
          setTableDetails(details.filter(Boolean));
        }
      }

      // Fetch summary schemas for all connected DBs to show in multi-DB topology
      if (connections.length > 0) {
        const multiPromises = connections.map(conn =>
          axios.get(`/api/schema/${conn.id}`)
            .then(r => ({ id: conn.id, data: r.data }))
            .catch(() => ({ id: conn.id, data: { tables: [] } }))
        );
        const multiResults = await Promise.all(multiPromises);
        const map = {};
        multiResults.forEach(item => {
          map[item.id] = item.data;
        });
        setMultiDbSchemas(map);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlowData();
  }, [activeConnection?.id, connections.length]);

  if (!activeConnection && connections.length === 0) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
        <Network size={44} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
        <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>No Database Connections Discovered</p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', maxWidth: '500px', margin: '0.5rem auto 0' }}>
          Connect one or more SQLite, MySQL, PostgreSQL, or MongoDB databases to visualize the multi-database architecture and entity relationship matrix.
        </p>
      </div>
    );
  }

  const currentConn = activeConnection || connections[0];

  const getDbTypeBadgeStyle = (type) => {
    switch ((type || '').toLowerCase()) {
      case 'sqlite':
        return { bg: 'rgba(59, 130, 246, 0.2)', text: '#93c5fd', border: 'rgba(59, 130, 246, 0.4)', colorHex: '#3b82f6' };
      case 'mysql':
        return { bg: 'rgba(245, 158, 11, 0.2)', text: '#fde047', border: 'rgba(245, 158, 11, 0.4)', colorHex: '#f59e0b' };
      case 'postgres':
      case 'postgresql':
        return { bg: 'rgba(139, 92, 246, 0.2)', text: '#c084fc', border: 'rgba(139, 92, 246, 0.4)', colorHex: '#8b5cf6' };
      case 'mongodb':
      case 'mongo':
        return { bg: 'rgba(16, 185, 129, 0.2)', text: '#6ee7b7', border: 'rgba(16, 185, 129, 0.4)', colorHex: '#10b981' };
      default:
        return { bg: 'rgba(148, 163, 184, 0.2)', text: '#cbd5e1', border: 'rgba(148, 163, 184, 0.4)', colorHex: '#94a3b8' };
    }
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1.2rem' }}>
      {/* Header Controls */}
      <div className="panel-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <div className="panel-title" style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {view3D ? <Box size={24} className="text-primary-blue" /> : <Layers3 size={24} className="text-primary-blue" />}
            <span>{view3D ? '3D Isometric Architectural Flow' : '2D Topology & Connection Flow'}</span>
            <span style={{
              fontSize: '0.72rem',
              background: view3D ? 'rgba(139, 92, 246, 0.2)' : 'rgba(59, 130, 246, 0.2)',
              color: view3D ? '#c084fc' : '#93c5fd',
              border: `1px solid ${view3D ? 'rgba(139, 92, 246, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`,
              padding: '0.15rem 0.6rem',
              borderRadius: '12px',
              fontWeight: 700
            }}>
              {view3D ? '3D ISOMETRIC' : '2D FLAT VIEW (DEFAULT)'}
            </span>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.2rem', display: 'block' }}>
            Live visual pipeline map of <strong>{connections.length} active database connection{connections.length > 1 ? 's' : ''}</strong> & discovered schemas.
          </span>
        </div>

        {/* View Mode & Scope Switches */}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Scope Selector: All Connections vs Focused DB */}
          {connections.length > 1 && (
            <button
              type="button"
              className={`btn ${multiDbScope ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              onClick={() => setMultiDbScope(!multiDbScope)}
              title="Toggle between Multi-Database Topology and Single Active Database focus"
            >
              <Server size={14} />
              <span>{multiDbScope ? `All DBs Matrix (${connections.length})` : `Focused DB Target`}</span>
            </button>
          )}

          {/* 2D / 3D Mode Toggle (Requirements: 2D default, switch to 3D when clicked) */}
          <button
            type="button"
            className={`btn ${view3D ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              padding: '0.4rem 0.85rem',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: view3D ? '0 0 15px rgba(139, 92, 246, 0.4)' : 'none'
            }}
            onClick={() => setView3D(!view3D)}
          >
            {view3D ? <Box size={14} /> : <Layers size={14} />}
            <span>{view3D ? '🧊 Switch to 2D Flat' : '📐 Switch to 3D Isometric'}</span>
          </button>

          {/* Refresh Diagram */}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
            onClick={fetchFlowData}
            title="Re-scan and refresh connection topology"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* TOPOLOGY CANVAS SYSTEM */}
      <div className={`flow-canvas-container ${view3D ? 'mode-3d' : ''}`}>
        {/* Animated Scanline & Grid Effect */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: view3D
            ? 'linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)'
            : 'radial-gradient(rgba(59, 130, 246, 0.14) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          pointerEvents: 'none',
          opacity: 0.7
        }} />

        {/* Status Header */}
        <div style={{
          fontSize: '0.78rem',
          color: 'var(--text-dim)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 700,
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          zIndex: 2
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--text-main)' }}>
            <Sparkles size={15} className="text-primary-blue" />
            <span>ARCHITECTURE TOPOLOGY {multiDbScope ? `(${connections.length} CONNECTED DATABASES)` : `(${currentConn?.name})`}</span>
          </span>

          <span style={{
            fontSize: '0.74rem',
            color: 'var(--success-emerald)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            background: 'rgba(16, 185, 129, 0.1)',
            padding: '0.2rem 0.6rem',
            borderRadius: '12px',
            border: '1px solid rgba(16, 185, 129, 0.25)'
          }}>
            <Activity size={12} className="animate-pulse" />
            <span>LIVE DISCOVERED PIPELINE</span>
          </span>
        </div>

        {/* MAIN TOPOLOGY FLOW GRID */}
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '1rem',
          transform: view3D ? 'rotateX(18deg) rotateY(-8deg)' : 'none',
          transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          transformStyle: 'preserve-3d',
          position: 'relative',
          zIndex: 2,
          overflowX: 'auto',
          paddingBottom: '0.5rem'
        }}>

          {/* NODE 1: User Client Application */}
          <div className="flow-node-card animate-pulse-glow" style={{
            minWidth: '170px',
            textAlign: 'center',
            transform: view3D ? 'translateZ(15px)' : 'none'
          }}>
            <div style={{ color: 'var(--primary-blue)', marginBottom: '0.4rem' }}>
              <Cpu size={28} style={{ margin: '0 auto', filter: 'drop-shadow(0 0 10px rgba(59,130,246,0.6))' }} />
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff' }}>User Client App</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: '0.25rem' }}>
              {systemStatus?.applicationUrl || 'http://127.0.0.1:3000'}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--success-emerald)', marginTop: '0.35rem', fontWeight: 600 }}>
              ● REST API Active
            </div>
          </div>

          {/* FLOW ARROW 1 */}
          <div style={{ color: 'var(--primary-blue)', padding: '0 0.2rem' }} className="animate-flow-arrow">
            <ArrowRight size={24} style={{ filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.7))' }} />
          </div>

          {/* NODE 2: Direct Local Host / SSH Tunnel */}
          <div className="flow-node-card" style={{
            minWidth: '170px',
            textAlign: 'center',
            background: isTunnelActive
              ? 'linear-gradient(145deg, rgba(245, 158, 11, 0.2), rgba(15, 23, 42, 0.95))'
              : 'linear-gradient(145deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.95))',
            borderColor: isTunnelActive ? 'rgba(245, 158, 11, 0.5)' : 'var(--border-color)',
            transform: view3D ? 'translateZ(25px)' : 'none'
          }}>
            <div style={{ color: isTunnelActive ? '#f59e0b' : 'var(--text-dim)', marginBottom: '0.4rem' }}>
              {isTunnelActive ? <Globe size={28} style={{ margin: '0 auto' }} /> : <Radio size={28} style={{ margin: '0 auto' }} />}
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: isTunnelActive ? '#f59e0b' : '#fff' }}>
              {isTunnelActive ? 'SSH Demo Tunnel' : 'Direct Local Host'}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
              {isTunnelActive ? 'Port 8080 Active' : '127.0.0.1 Gateway'}
            </div>
            <div style={{ fontSize: '0.68rem', color: isTunnelActive ? '#f59e0b' : 'var(--text-muted)', marginTop: '0.35rem' }}>
              {isTunnelActive ? 'Encrypted Tunnel' : 'Zero-Latency Loopback'}
            </div>
          </div>

          {/* FLOW ARROW 2 */}
          <div style={{ color: 'var(--primary-blue)', padding: '0 0.2rem' }} className="animate-flow-arrow">
            <ArrowRight size={24} style={{ filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.7))' }} />
          </div>

          {/* NODE 3: Security & Read-Only Guard */}
          <div className="flow-node-card" style={{
            minWidth: '180px',
            textAlign: 'center',
            background: 'linear-gradient(145deg, rgba(16, 185, 129, 0.15), rgba(15, 23, 42, 0.95))',
            borderColor: 'rgba(16, 185, 129, 0.4)',
            transform: view3D ? 'translateZ(35px)' : 'none'
          }}>
            <div style={{ color: 'var(--success-emerald)', marginBottom: '0.4rem' }}>
              <ShieldCheck size={28} style={{ margin: '0 auto', filter: 'drop-shadow(0 0 10px rgba(16,185,129,0.7))' }} />
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#fff' }}>Read-Only Guard</div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>
              SQL AST Sanitizer
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--success-emerald)', marginTop: '0.35rem', fontWeight: 600 }}>
              ● Audit Logging Active
            </div>
          </div>

          {/* FLOW ARROW 3 */}
          <div style={{ color: 'var(--primary-blue)', padding: '0 0.2rem' }} className="animate-flow-arrow">
            <ArrowRight size={24} style={{ filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.7))' }} />
          </div>

          {/* NODE 4: CONNECTED DATABASE(S) NODE MATRIX */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            minWidth: '240px',
            flex: 1
          }}>
            {(multiDbScope ? connections : [currentConn]).map(conn => {
              const style = getDbTypeBadgeStyle(conn.type);
              const isSelected = currentConn?.id === conn.id;
              const connSchema = multiDbSchemas[conn.id];
              const tableCount = connSchema?.tables?.length || 0;

              return (
                <div
                  key={conn.id}
                  className={`flow-node-card ${isSelected ? 'active-target' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'space-between',
                    gap: '1rem',
                    cursor: 'pointer',
                    transform: view3D ? (isSelected ? 'translateZ(45px) scale(1.03)' : 'translateZ(25px)') : 'none',
                    borderLeft: `4px solid ${style.colorHex}`
                  }}
                  onClick={() => onSelectConnection && onSelectConnection(conn.id)}
                  title="Click to focus this connection as active target DB"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{
                      background: style.bg,
                      color: style.text,
                      border: `1px solid ${style.border}`,
                      padding: '0.35rem 0.65rem',
                      borderRadius: '8px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}>
                      {conn.type}
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span>{conn.name}</span>
                        {isSelected && <CheckCircle2 size={14} className="text-primary-blue" title="Active Selected DB" />}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                        {conn.type === 'sqlite'
                          ? conn.config?.filepath
                          : `${conn.config?.host || '127.0.0.1'}:${conn.config?.port || '3306'}`}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: 'var(--primary-blue)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '10px',
                      fontWeight: 600,
                      display: 'inline-block'
                    }}>
                      {tableCount} {conn.type === 'mongodb' ? 'collections' : 'tables'}
                    </span>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '0.2rem' }}>
                      {conn.sourceType === 'external_local' ? 'Local DB' : 'Demo DB'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* DISCOVERED ENTITY MATRIX (TABLES & COLLECTIONS) */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', perspective: view3D ? '1200px' : 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
            <Layers size={20} className="text-primary-blue" />
            <span>
              Discovered Entities for <strong>{currentConn?.name}</strong> ({schema?.tables?.length || 0} {currentConn?.type === 'mongodb' ? 'Collections' : 'Tables'})
            </span>
          </h3>

          <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
            Hover cards to highlight relations • Click card to open in Schema Inspector
          </span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
            <p style={{ fontSize: '0.9rem' }}>Discovering schema structure & table relationships...</p>
          </div>
        ) : error ? (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        ) : !schema?.tables || schema.tables.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
            No tables or collections discovered in active database schema.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: '1.2rem',
            transformStyle: 'preserve-3d'
          }}>
            {schema.tables.map((table) => {
              const detail = tableDetails.find(d => d?.tableName === table.name);
              const foreignKeys = detail?.foreignKeys || [];
              const isHovered = hoveredTable === table.name;

              return (
                <div
                  key={table.name}
                  className="flow-table-card"
                  style={{
                    background: isHovered
                      ? 'linear-gradient(145deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))'
                      : 'linear-gradient(145deg, rgba(30, 41, 59, 0.65), rgba(15, 23, 42, 0.85))',
                    borderColor: isHovered ? 'var(--primary-blue)' : 'var(--border-color)',
                    transform: view3D
                      ? (isHovered ? 'translateZ(30px) rotateX(4deg) scale(1.03)' : 'rotateX(6deg) rotateY(-2deg) translateZ(0)')
                      : (isHovered ? 'translateY(-4px) scale(1.01)' : 'none'),
                    transformStyle: 'preserve-3d'
                  }}
                  onMouseEnter={() => setHoveredTable(table.name)}
                  onMouseLeave={() => setHoveredTable(null)}
                  onClick={() => {
                    onSelectTable(table.name);
                    onNavigateToSchema();
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        background: 'rgba(59, 130, 246, 0.15)',
                        padding: '0.35rem',
                        borderRadius: '6px',
                        color: 'var(--primary-blue)'
                      }}>
                        <Table size={16} />
                      </div>
                      <strong style={{ fontSize: '1rem', color: '#fff' }}>{table.name}</strong>
                    </div>

                    <span style={{
                      fontSize: '0.74rem',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: 'var(--primary-blue)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      padding: '0.15rem 0.55rem',
                      borderRadius: '12px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600
                    }}>
                      {table.rowCount !== undefined ? `${table.rowCount} rows` : `${table.columnsCount} cols`}
                    </span>
                  </div>

                  {/* Columns list */}
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    borderRadius: '8px',
                    padding: '0.6rem',
                    maxHeight: '150px',
                    overflowY: 'auto',
                    fontSize: '0.78rem',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}>
                    {table.columns && table.columns.map(col => (
                      <div
                        key={col.name}
                        style={{
                          display: 'flex',
                          justify: 'space-between',
                          alignItems: 'center',
                          padding: '0.22rem 0.3rem',
                          color: 'var(--text-muted)',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.03)'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {col.primaryKey && <Key size={12} className="primary-key-icon" title="Primary Key" />}
                          <code>{col.name}</code>
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                          {col.type}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Relationship Flow Line */}
                  {foreignKeys.length > 0 && (
                    <div style={{
                      marginTop: '0.75rem',
                      paddingTop: '0.5rem',
                      borderTop: '1px dashed rgba(255, 255, 255, 0.1)',
                      fontSize: '0.74rem',
                      color: 'var(--primary-blue)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem'
                    }}>
                      <Link2 size={13} />
                      <span>Relations: {foreignKeys.map(fk => `${fk.column} → ${fk.referencedTable}`).join(', ')}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
