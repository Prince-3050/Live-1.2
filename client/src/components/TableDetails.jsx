import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Columns, Database, List, Key, ShieldAlert, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

export default function TableDetails({ activeConnection, tableName }) {
  const [tab, setTab] = useState('data'); // 'columns' | 'data' | 'indexes'
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const limit = 20;

  const fetchDetails = async () => {
    if (!activeConnection || !tableName) return;
    setLoading(true);
    setError(null);

    try {
      const res = await axios.get(`/api/schema/${activeConnection.id}/table/${encodeURIComponent(tableName)}`);
      setDetails(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(0);
    fetchDetails();
  }, [activeConnection?.id, tableName]);

  if (!tableName) {
    return (
      <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
        <Database size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
        <p>Select a table or collection from the schema tree to inspect structure & data.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header Stat Bar */}
      <div className="panel-header" style={{ marginBottom: '0.75rem' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Table / Collection Inspection
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} className="text-primary-blue" />
            <code>{tableName}</code>
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '1rem', textAlign: 'right' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Row Count</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
              {details?.rowCount ?? '~'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Columns</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
              {details?.columns?.length ?? '~'}
            </div>
          </div>
        </div>
      </div>

      {/* Sub tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        {[
          { id: 'data', label: 'Data Preview', icon: List },
          { id: 'columns', label: 'Columns & Types', icon: Columns },
          { id: 'indexes', label: 'Indexes & Constraints', icon: Key }
        ].map(t => {
          const IconComponent = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              className={`tab-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <IconComponent size={15} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Loading table details...
        </div>
      ) : error ? (
        <div className="alert alert-error">
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {tab === 'columns' && details?.columns && (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Column Name</th>
                    <th>Data Type</th>
                    <th>Nullable</th>
                    <th>Default Value</th>
                  </tr>
                </thead>
                <tbody>
                  {details.columns.map((col, idx) => (
                    <tr key={idx}>
                      <td style={{ width: '40px', textAlign: 'center' }}>
                        {col.primaryKey ? <Key size={14} className="primary-key-icon" title="Primary Key" /> : '-'}
                      </td>
                      <td style={{ fontWeight: 600 }}><code>{col.name}</code></td>
                      <td>
                        <span style={{ fontSize: '0.78rem', background: 'rgba(255,255,255,0.06)', padding: '0.15rem 0.5rem', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                          {col.type}
                        </span>
                      </td>
                      <td>{col.nullable ? 'YES' : 'NO'}</td>
                      <td>{col.defaultValue !== undefined && col.defaultValue !== null ? String(col.defaultValue) : <span className="null-cell">NULL</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'data' && (
            <div>
              {details?.sampleData && details.sampleData.length > 0 ? (
                <>
                  <div className="table-wrapper" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          {Object.keys(details.sampleData[0]).map(key => (
                            <th key={key}><code>{key}</code></th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {details.sampleData.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {Object.keys(row).map((key, cIdx) => {
                              const val = row[key];
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

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <span>Showing sample of {details.sampleData.length} records</span>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
                  No rows found in table <code>{tableName}</code>
                </div>
              )}
            </div>
          )}

          {tab === 'indexes' && (
            <div>
              {details?.indexes && details.indexes.length > 0 ? (
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Index Name</th>
                        <th>Unique</th>
                        <th>Definition / Column</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.indexes.map((idx, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}><code>{idx.name}</code></td>
                          <td>
                            {idx.unique ? (
                              <span style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success-emerald)', padding: '0.15rem 0.5rem', borderRadius: '10px', fontSize: '0.75rem' }}>
                                UNIQUE
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>INDEX</span>
                            )}
                          </td>
                          <td><code>{idx.definition || idx.columnName || JSON.stringify(idx.key || {})}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)' }}>
                  No indexes or constraints found for table.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
