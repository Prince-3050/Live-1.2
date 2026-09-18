import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ConnectionForm from './components/ConnectionForm';
import ConnectionList from './components/ConnectionList';
import SchemaViewer from './components/SchemaViewer';
import TableDetails from './components/TableDetails';
import QueryExecutor from './components/QueryExecutor';
import StructuralFlowView from './components/StructuralFlowView';
import { Database, Server, FolderTree, Terminal, Cpu, ShieldCheck, Radio, Globe, Network } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('connections'); // 'connections' | 'flow' | 'schema' | 'query'
  const [connections, setConnections] = useState([]);
  const [activeConnId, setActiveConnId] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);

  const fetchStatus = async () => {
    try {
      const res = await axios.get('/api/status');
      setSystemStatus(res.data);
      setConnections(res.data.activeConnections || []);
      if (res.data.activeConnections?.length > 0 && !activeConnId) {
        setActiveConnId(res.data.activeConnections[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const activeConnection = connections.find(c => c.id === activeConnId) || (connections.length > 0 ? connections[0] : null);

  const handleConnectionAdded = (newConn) => {
    setConnections(prev => [...prev.filter(c => c.id !== newConn.id), newConn]);
    setActiveConnId(newConn.id);
  };

  const handleRemoveConnection = (id) => {
    setConnections(prev => prev.filter(c => c.id !== id));
    if (activeConnId === id) {
      const remaining = connections.filter(c => c.id !== id);
      setActiveConnId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleToggleReadOnly = async (id, currentReadOnly) => {
    try {
      const res = await axios.patch(`/api/connections/${id}/readonly`, { readOnly: !currentReadOnly });
      setConnections(prev => prev.map(c => c.id === id ? res.data : c));
    } catch (err) {
      alert(err.response?.data?.error || err.message);
    }
  };

  return (
    <div className="app-container">
      {/* Top Header Bar */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-icon">
            <Database size={24} />
          </div>
          <div>
            <h1 className="brand-title">DB 1.1 Studio</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Local External Database Connector & Live Explorer
            </p>
          </div>
        </div>

        <div className="header-status" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Connection Mode Indicator */}
          <div className={`active-conn-badge ${systemStatus?.mode === 'TUNNEL ACTIVE' ? 'badge-tunnel' : ''}`} style={{
            background: systemStatus?.mode === 'TUNNEL ACTIVE' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            color: systemStatus?.mode === 'TUNNEL ACTIVE' ? '#f59e0b' : '#10b981',
            border: `1px solid ${systemStatus?.mode === 'TUNNEL ACTIVE' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
            padding: '0.35rem 0.75rem',
            borderRadius: '20px',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontWeight: 600
          }}>
            {systemStatus?.mode === 'TUNNEL ACTIVE' ? <Globe size={14} /> : <Radio size={14} />}
            <span>● {systemStatus?.mode || 'LOCAL MODE'}</span>
          </div>

          {/* Active Connections Badge */}
          <div className="active-conn-badge">
            <Cpu size={14} className="text-primary-blue" />
            <span>Active Connections: <strong>{connections.length}</strong></span>
          </div>

          {/* Read-Only Status */}
          <div className="active-conn-badge" style={{ color: 'var(--success-emerald)' }}>
            <ShieldCheck size={14} />
            <span>Read-Only Guard: <strong>ACTIVE</strong></span>
          </div>
        </div>
      </header>

      {/* Target DB Banner Bar */}
      {activeConnection && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.8)',
          borderBottom: '1px solid var(--border-color)',
          padding: '0.4rem 1.5rem',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Active Database Target:
            </span>
            <span style={{
              background: 'rgba(59, 130, 246, 0.15)',
              color: 'var(--primary-blue)',
              padding: '0.15rem 0.5rem',
              borderRadius: '4px',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)'
            }}>
              {activeConnection.type.toUpperCase()}
            </span>
            <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
              {activeConnection.name}
            </span>
            <span style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
              ({activeConnection.type === 'sqlite' ? activeConnection.config?.filepath : `${activeConnection.config?.host || '127.0.0.1'}:${activeConnection.config?.port || '3306'} / ${activeConnection.config?.database || 'default'}`})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              fontSize: '0.72rem',
              padding: '0.15rem 0.5rem',
              borderRadius: '10px',
              background: activeConnection.sourceType === 'external_local' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
              color: activeConnection.sourceType === 'external_local' ? 'var(--success-emerald)' : 'var(--text-dim)',
              fontWeight: 600
            }}>
              {activeConnection.sourceType === 'external_local' ? 'EXTERNAL LOCAL DB' : 'DEMO FIXTURE DB'}
            </span>
          </div>
        </div>
      )}

      {/* Main Tab Bar */}
      <nav className="nav-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'connections' ? 'active' : ''}`}
          onClick={() => setActiveTab('connections')}
        >
          <Server size={16} />
          <span>Connections & Profiles</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'flow' ? 'active' : ''}`}
          onClick={() => setActiveTab('flow')}
        >
          <Network size={16} />
          <span>Structural Flow View</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'schema' ? 'active' : ''}`}
          onClick={() => setActiveTab('schema')}
        >
          <FolderTree size={16} />
          <span>Schema Explorer</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === 'query' ? 'active' : ''}`}
          onClick={() => setActiveTab('query')}
        >
          <Terminal size={16} />
          <span>Query Console</span>
        </button>
      </nav>

      {/* Main Content Workspace */}
      <main className="main-content">
        {activeTab === 'connections' && (
          <div className="grid-connections">
            <ConnectionForm
              onConnectionAdded={handleConnectionAdded}
              onSelectConnection={setActiveConnId}
            />

            <ConnectionList
              connections={connections}
              activeConnId={activeConnId}
              onSelectConnection={setActiveConnId}
              onRemoveConnection={handleRemoveConnection}
              onToggleReadOnly={handleToggleReadOnly}
              onExploreSchema={() => setActiveTab('schema')}
            />
          </div>
        )}

        {activeTab === 'flow' && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <StructuralFlowView
              activeConnection={activeConnection}
              connections={connections}
              systemStatus={systemStatus}
              onSelectTable={setSelectedTable}
              onNavigateToSchema={() => setActiveTab('schema')}
              onSelectConnection={setActiveConnId}
            />
          </div>
        )}

        {activeTab === 'schema' && (
          <div className="grid-schema">
            <SchemaViewer
              activeConnection={activeConnection}
              selectedTable={selectedTable}
              onSelectTable={setSelectedTable}
            />

            <TableDetails
              activeConnection={activeConnection}
              tableName={selectedTable}
            />
          </div>
        )}

        {activeTab === 'query' && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <QueryExecutor
              activeConnection={activeConnection}
              selectedTable={selectedTable}
            />
          </div>
        )}
      </main>
    </div>
  );
}
