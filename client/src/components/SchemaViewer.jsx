import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Table, FolderTree, Key, ChevronRight, ChevronDown, Search, RefreshCw } from 'lucide-react';

export default function SchemaViewer({ activeConnection, selectedTable, onSelectTable }) {
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [expandedTables, setExpandedTables] = useState({});

  const fetchSchema = async () => {
    if (!activeConnection) return;
    setLoading(true);
    setError(null);

    try {
      const res = await axios.get(`/api/schema/${activeConnection.id}`);
      setSchema(res.data);
      if (res.data?.tables?.length > 0 && !selectedTable) {
        onSelectTable(res.data.tables[0].name);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchema();
  }, [activeConnection?.id]);

  const toggleExpand = (tableName, e) => {
    e.stopPropagation();
    setExpandedTables(prev => ({
      ...prev,
      [tableName]: !prev[tableName]
    }));
  };

  if (!activeConnection) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
        <FolderTree size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
        <p style={{ color: 'var(--text-muted)' }}>Select an active database connection to view schema</p>
      </div>
    );
  }

  const filteredTables = (schema?.tables || []).filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSeedDemoData = async () => {
    if (!activeConnection) return;
    setLoading(true);
    setError(null);
    try {
      await axios.post(`/api/connections/${activeConnection.id}/seed`);
      await fetchSchema();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="panel-header">
        <div className="panel-title">
          <FolderTree size={18} className="text-primary-blue" />
          <span>Schema Tree</span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            type="button"
            className="btn btn-quick"
            style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
            onClick={handleSeedDemoData}
            title="Populate database with sample tables and rows"
          >
            + Seed Demo Tables
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
            onClick={fetchSchema}
            title="Refresh Schema"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '1rem', position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
        <input
          type="text"
          className="input-field"
          placeholder="Filter tables..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: '2.2rem', fontSize: '0.82rem' }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Loading schema...
        </div>
      ) : error ? (
        <div className="alert alert-error">
          <span>{error}</span>
        </div>
      ) : filteredTables.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          <p style={{ marginBottom: '0.75rem' }}>No tables or collections found.</p>
          <button type="button" className="btn btn-quick" onClick={handleSeedDemoData}>
            Seed Demo Tables & Data
          </button>
        </div>
      ) : (
        <div className="tree-container">
          {filteredTables.map((table) => {
            const isSelected = selectedTable === table.name;
            const isExpanded = expandedTables[table.name];

            return (
              <div key={table.name} style={{ marginBottom: '0.2rem' }}>
                <div
                  className={`tree-node ${isSelected ? 'active' : ''}`}
                  onClick={() => onSelectTable(table.name)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span onClick={(e) => toggleExpand(table.name, e)}>
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <Table size={15} style={{ color: isSelected ? 'var(--primary-blue)' : 'var(--text-muted)' }} />
                    <span style={{ fontWeight: isSelected ? 600 : 400 }}>{table.name}</span>
                  </div>
                  <span className="table-badge">{table.columnsCount || table.columns?.length || 0}</span>
                </div>

                {isExpanded && table.columns && (
                  <div style={{ paddingLeft: '1.8rem', borderLeft: '1px dashed var(--border-color)', marginLeft: '0.8rem', marginTop: '0.2rem' }}>
                    {table.columns.map(col => (
                      <div
                        key={col.name}
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                          padding: '0.25rem 0.4rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          {col.primaryKey && <Key size={12} className="primary-key-icon" />}
                          <code>{col.name}</code>
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                          {col.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
