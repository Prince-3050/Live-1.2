import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Terminal, Play, Copy, Check, Clock, AlertTriangle, Database, ShieldCheck, ShieldAlert } from 'lucide-react';

export default function QueryExecutor({ activeConnection, selectedTable }) {
  const [query, setQuery] = useState('');
  const [overrideWrite, setOverrideWrite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const getTemplates = () => {
    const dbType = activeConnection?.type || 'sqlite';
    const tName = selectedTable || 'users';

    if (dbType === 'mongodb') {
      return [
        { label: `Find all in ${tName}`, code: `{\n  "collection": "${tName}",\n  "action": "find",\n  "query": {},\n  "limit": 20\n}` },
        { label: `Count in ${tName}`, code: `{\n  "collection": "${tName}",\n  "action": "count",\n  "query": {}\n}` },
        { label: 'Aggregate group', code: `{\n  "collection": "${tName}",\n  "action": "aggregate",\n  "query": [\n    { "$group": { "_id": null, "total": { "$sum": 1 } } }\n  ]\n}` }
      ];
    }

    return [
      { label: `Select all from ${tName}`, code: `SELECT * FROM ${tName} LIMIT 20;` },
      { label: `Count rows in ${tName}`, code: `SELECT COUNT(*) as total FROM ${tName};` },
      { label: `Filter ${tName}`, code: `SELECT * FROM ${tName} WHERE id > 0 ORDER BY id DESC LIMIT 10;` }
    ];
  };

  useEffect(() => {
    if (activeConnection) {
      const defaultTpl = getTemplates()[0];
      if (defaultTpl) setQuery(defaultTpl.code);
    }
  }, [activeConnection?.id, activeConnection?.type, selectedTable]);

  const handleExecute = async () => {
    if (!activeConnection || !query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await axios.post(`/api/query/${activeConnection.id}`, {
        query,
        overrideReadOnly: overrideWrite ? false : activeConnection.readOnly
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyResults = () => {
    if (!result?.rows) return;
    navigator.clipboard.writeText(JSON.stringify(result.rows, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!activeConnection) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
        <Terminal size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
        <p>Select an active database connection to run queries.</p>
      </div>
    );
  }

  const templates = getTemplates();
  const isReadOnly = activeConnection.readOnly && !overrideWrite;

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* QUERY TARGET BANNER */}
      <div style={{
        background: 'rgba(30, 41, 59, 0.8)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '0.65rem 1rem',
        marginBottom: '0.75rem',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Database size={18} className="text-primary-blue" />
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              QUERY TARGET
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span>{activeConnection.name}</span>
              <code style={{ fontSize: '0.8rem', color: 'var(--primary-blue)' }}>
                {activeConnection.type.toUpperCase()} // {activeConnection.type === 'sqlite' ? activeConnection.config?.filepath : `${activeConnection.config?.host || '127.0.0.1'}:${activeConnection.config?.port || '3306'} / ${activeConnection.config?.database || 'default'}`}
              </code>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            fontSize: '0.75rem',
            padding: '0.2rem 0.6rem',
            borderRadius: '12px',
            background: isReadOnly ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            color: isReadOnly ? 'var(--success-emerald)' : 'var(--danger-rose)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontWeight: 600
          }}>
            {isReadOnly ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
            <span>{isReadOnly ? 'READ ONLY' : 'WRITE PERMITTED'}</span>
          </div>
        </div>
      </div>

      <div className="panel-header" style={{ marginBottom: '0.5rem' }}>
        <div className="panel-title">
          <Terminal size={18} className="text-primary-blue" />
          <span>Console Editor</span>
        </div>

        <div className="template-pills">
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginRight: '0.2rem' }}>Templates:</span>
          {templates.map((tpl, i) => (
            <button
              key={i}
              type="button"
              className="template-pill"
              onClick={() => setQuery(tpl.code)}
            >
              {tpl.label}
            </button>
          ))}
        </div>
      </div>

      <div className="query-editor-container">
        <textarea
          className="query-editor"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Write your SELECT query or MongoDB JSON string here..."
        />

        <div className="query-meta-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <input
              type="checkbox"
              id="overrideWriteCheck"
              checked={overrideWrite}
              onChange={(e) => setOverrideWrite(e.target.checked)}
              style={{ accentColor: 'var(--danger-rose)', cursor: 'pointer' }}
            />
            <label htmlFor="overrideWriteCheck" style={{ fontSize: '0.78rem', color: 'var(--text-dim)', cursor: 'pointer' }}>
              Allow Write Operations (Bypass Read-Only Guard)
            </label>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExecute}
            disabled={loading || !query.trim()}
          >
            <Play size={16} />
            <span>{loading ? 'Running...' : 'Execute Query'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginTop: '1rem' }}>
          <AlertTriangle size={18} />
          <div>
            <strong>Query Failed:</strong>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', marginTop: '0.2rem' }}>{error}</div>
          </div>
        </div>
      )}

      {result && (
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Clock size={14} className="text-primary-blue" />
                Execution time: <strong>{result.executionTimeMs} ms</strong>
              </span>

              {result.rowCount !== undefined && (
                <span>Rows returned: <strong>{result.rowCount}</strong></span>
              )}

              {result.affectedRows !== undefined && (
                <span>Affected Rows: <strong>{result.affectedRows}</strong></span>
              )}
            </div>

            {result.rows && result.rows.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                onClick={handleCopyResults}
              >
                {copied ? <Check size={14} className="text-success-emerald" /> : <Copy size={14} />}
                <span>{copied ? 'Copied JSON!' : 'Copy JSON'}</span>
              </button>
            )}
          </div>

          {result.rows && result.rows.length > 0 ? (
            <div className="table-wrapper" style={{ flex: 1, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {(result.columns || Object.keys(result.rows[0])).map((col) => (
                      <th key={col}><code>{col}</code></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {(result.columns || Object.keys(row)).map((col, cIdx) => {
                        const val = row[col];
                        if (val === null || val === undefined) {
                          return <td key={cIdx}><span className="null-cell">NULL</span></td>;
                        }
                        if (typeof val === 'object') {
                          return <td key={cIdx}><code>{JSON.stringify(val)}</code></td>;
                        }
                        return <td key={cIdx}>{String(val)}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : result.type === 'COMMAND' ? (
            <div className="alert alert-success">
              <span>Command executed successfully. Affected rows: {result.affectedRows}</span>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
              Query executed successfully returned 0 rows.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
