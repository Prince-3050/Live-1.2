import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Database, CheckCircle2, AlertCircle, Sparkles, FolderOpen, Bookmark, Save, Shield, Link, Sliders, Play, PlusCircle } from 'lucide-react';

export default function ConnectionForm({ onConnectionAdded, onSelectConnection }) {
  const [formMode, setFormMode] = useState('url'); // 'url' | 'manual'
  const [sourceType, setSourceType] = useState('external_local'); // 'external_local' | 'demo'
  const [dbType, setDbType] = useState('sqlite');
  const [name, setName] = useState('');
  const [readOnly, setReadOnly] = useState(true);
  const [autoSeedIfEmpty, setAutoSeedIfEmpty] = useState(true);

  // Single URL / Path input
  const [connectionUrl, setConnectionUrl] = useState('mysql://root:@127.0.0.1:3306/test_mysql');
  
  // Advanced manual inputs
  const [filepath, setFilepath] = useState('C:\\Users\\User\\Documents\\Databases\\company.db');
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState('3306');
  const [user, setUser] = useState('root');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState('');
  const [uri, setUri] = useState('mongodb://127.0.0.1:27017');

  const [savedProfiles, setSavedProfiles] = useState([]);
  const [testing, setTesting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);

  const fetchProfiles = async () => {
    try {
      const res = await axios.get('/api/profiles');
      setSavedProfiles(res.data || []);
    } catch (e) {}
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const parseAndGetConfig = () => {
    if (formMode === 'url') {
      if (!connectionUrl || !connectionUrl.trim()) {
        throw new Error('Connection URL or file path is required.');
      }
      const trimmed = connectionUrl.trim();

      // Check if MongoDB JSON file
      if (trimmed.endsWith('.json') || trimmed.includes('mongodb') || trimmed.includes('test_mongodb')) {
        return {
          type: 'mongodb',
          config: { filepath: trimmed, database: 'test_mongodb', readOnly, isDemo: true }
        };
      }

      // Check if SQLite file path (.db, .sqlite, .sqlite3)
      if (trimmed.endsWith('.db') || trimmed.endsWith('.sqlite') || trimmed.endsWith('.sqlite3')) {
        return {
          type: 'sqlite',
          config: { filepath: trimmed, readOnly, isDemo: sourceType === 'demo' || trimmed.includes('test_') }
        };
      }

      // Check URL string
      try {
        if (trimmed.includes('://')) {
          const parsed = new URL(trimmed);
          const protocol = parsed.protocol.replace(':', '').toLowerCase();

          let type = dbType;
          if (protocol === 'mysql') type = 'mysql';
          if (protocol === 'postgres' || protocol === 'postgresql') type = 'postgres';
          if (protocol === 'mongodb' || protocol === 'mongo') type = 'mongodb';
          if (protocol === 'sqlite' || protocol === 'file') type = 'sqlite';

          if (type === 'sqlite') {
            return { type: 'sqlite', config: { filepath: parsed.pathname || trimmed, readOnly, isDemo: sourceType === 'demo' } };
          }
          if (type === 'mongodb') {
            return {
              type: 'mongodb',
              config: {
                uri: trimmed,
                database: parsed.pathname ? parsed.pathname.replace('/', '') : 'test_mongodb',
                readOnly,
                isDemo: sourceType === 'demo' || trimmed.includes('test_mongodb')
              }
            };
          }

          return {
            type,
            config: {
              host: parsed.hostname || '127.0.0.1',
              port: parsed.port ? parseInt(parsed.port, 10) : (type === 'mysql' ? 3306 : 5432),
              user: parsed.username ? decodeURIComponent(parsed.username) : (type === 'mysql' ? 'root' : 'postgres'),
              password: parsed.password ? decodeURIComponent(parsed.password) : '',
              database: parsed.pathname ? parsed.pathname.replace('/', '') : '',
              readOnly,
              isDemo: sourceType === 'demo'
            }
          };
        }
      } catch (e) {
        throw new Error(`Invalid URL format: ${e.message}. Example: mysql://user:pass@127.0.0.1:3306/dbname`);
      }

      // Fallback
      return {
        type: dbType,
        config: { filepath: trimmed, host: '127.0.0.1', port: 3306, user: 'root', readOnly }
      };
    }

    // Manual mode
    if (dbType === 'sqlite') {
      return {
        type: 'sqlite',
        config: { filepath: sourceType === 'demo' ? './test.db' : filepath, isDemo: sourceType === 'demo', readOnly }
      };
    }
    if (dbType === 'mongodb') {
      return {
        type: 'mongodb',
        config: { uri, database: database || 'test_mongodb', isDemo: sourceType === 'demo', readOnly }
      };
    }
    return {
      type: dbType,
      config: {
        host: sourceType === 'demo' ? '127.0.0.1' : host,
        port: parseInt(port, 10) || 3306,
        user: sourceType === 'demo' ? (dbType === 'mysql' ? 'root' : 'postgres') : user,
        password,
        database: sourceType === 'demo' ? (dbType === 'mysql' ? 'test_mysql' : 'test_postgres') : database,
        isDemo: sourceType === 'demo',
        readOnly
      }
    };
  };

  const handleApplyPresetUrl = (presetUrl, type) => {
    setFormMode('url');
    setConnectionUrl(presetUrl);
    setDbType(type);
    setTestResult({ success: true, message: `Loaded preset for ${type.toUpperCase()}: ${presetUrl}` });
  };

  const handleTestConnection = async (e) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const { type, config } = parseAndGetConfig();
      const res = await axios.post('/api/connections/test', { type, config });
      setTestResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleCreateConnection = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      const { type, config } = parseAndGetConfig();
      const connName = name || `${type.toUpperCase()} Connection`;
      const res = await axios.post('/api/connections', {
        name: connName,
        type,
        sourceType,
        readOnly,
        autoSeed: autoSeedIfEmpty,
        config
      });
      onConnectionAdded(res.data);
      onSelectConnection(res.data.id);
      setName('');
      setTestResult(null);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="glass-panel">
      <div className="panel-header" style={{ marginBottom: '0.75rem' }}>
        <div className="panel-title">
          <Database size={20} className="text-primary-blue" />
          <span>Connect Database</span>
        </div>

        {savedProfiles.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Bookmark size={14} className="text-primary-blue" />
            <select
              className="input-field"
              style={{ width: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
              onChange={(e) => {
                const found = savedProfiles.find(p => p.id === e.target.value);
                if (found && found.config) {
                  setFormMode('manual');
                  setDbType(found.type);
                  setName(found.name);
                  if (found.config.filepath) setConnectionUrl(found.config.filepath);
                }
              }}
            >
              <option value="">Load Profile...</option>
              {savedProfiles.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.type.toUpperCase()})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Connection Mode Toggle: Single Connection URL vs Advanced Manual Fields */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0.4rem',
        marginBottom: '0.85rem',
        background: 'rgba(255, 255, 255, 0.03)',
        padding: '0.35rem',
        borderRadius: '8px',
        border: '1px solid var(--border-color)'
      }}>
        <button
          type="button"
          className={`btn ${formMode === 'url' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.78rem', padding: '0.4rem 0.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
          onClick={() => setFormMode('url')}
        >
          <Link size={14} /> Paste Connection URL / Path
        </button>

        <button
          type="button"
          className={`btn ${formMode === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.78rem', padding: '0.4rem 0.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
          onClick={() => setFormMode('manual')}
        >
          <Sliders size={14} /> Advanced Manual Fields
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {testResult && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>{testResult.message}</span>
        </div>
      )}

      <form onSubmit={handleCreateConnection}>
        {formMode === 'url' ? (
          /* PASTE CONNECTION URL MODE */
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Paste Connection String or Database File Path</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--primary-blue)', fontWeight: 600 }}>1-CLICK INSTANT URL</span>
            </label>

            <textarea
              className="input-field"
              rows={3}
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.83rem', resize: 'vertical' }}
              placeholder="Paste MySQL URL, Postgres URL, Mongo URI, or SQLite file path... e.g. mysql://root:@127.0.0.1:3306/sales_db"
              value={connectionUrl}
              onChange={(e) => setConnectionUrl(e.target.value)}
              required
            />

            {/* Quick Preset Buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', alignSelf: 'center', marginRight: '0.2rem' }}>Presets:</span>

              <button
                type="button"
                className="template-pill"
                onClick={() => handleApplyPresetUrl('mysql://root:@127.0.0.1:3306/test_mysql', 'mysql')}
              >
                MySQL (127.0.0.1:3306)
              </button>

              <button
                type="button"
                className="template-pill"
                onClick={() => handleApplyPresetUrl('postgresql://postgres:@127.0.0.1:5432/test_postgres', 'postgres')}
              >
                PostgreSQL (127.0.0.1:5432)
              </button>

              <button
                type="button"
                className="template-pill"
                onClick={() => handleApplyPresetUrl('./test.db', 'sqlite')}
              >
                SQLite (./test.db)
              </button>

              <button
                type="button"
                className="template-pill"
                onClick={() => handleApplyPresetUrl('mongodb://127.0.0.1:27017/test_mongodb', 'mongodb')}
              >
                MongoDB (127.0.0.1:27017)
              </button>
            </div>
          </div>
        ) : (
          /* MANUAL FIELDS MODE */
          <>
            {/* DB Type Switcher */}
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
              {[
                { id: 'sqlite', label: 'SQLite' },
                { id: 'mysql', label: 'MySQL / XAMPP' },
                { id: 'postgres', label: 'PostgreSQL' },
                { id: 'mongodb', label: 'MongoDB' }
              ].map(db => (
                <button
                  key={db.id}
                  type="button"
                  className={`btn ${dbType === db.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1, padding: '0.4rem 0.2rem', fontSize: '0.78rem' }}
                  onClick={() => setDbType(db.id)}
                >
                  {db.label}
                </button>
              ))}
            </div>

            {dbType === 'sqlite' && (
              <div className="form-group">
                <label>Database File Path on your PC</label>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. C:\Users\User\Documents\Database\company.db or ./test.db"
                    value={filepath}
                    onChange={(e) => setFilepath(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.75rem', fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      const sample = prompt("Enter complete path to external SQLite database file:", filepath);
                      if (sample) setFilepath(sample);
                    }}
                  >
                    <FolderOpen size={14} /> Browse
                  </button>
                </div>
              </div>
            )}

            {(dbType === 'mysql' || dbType === 'postgres') && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.5rem' }}>
                  <div className="form-group">
                    <label>Host / IP Address</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="127.0.0.1"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Port</label>
                    <input
                      type="text"
                      className="input-field"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div className="form-group">
                    <label>User</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder={dbType === 'mysql' ? 'root' : 'postgres'}
                      value={user}
                      onChange={(e) => setUser(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Password</label>
                    <input
                      type="password"
                      className="input-field"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Database Name</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. sales_db"
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                  />
                </div>
              </>
            )}

            {dbType === 'mongodb' && (
              <>
                <div className="form-group">
                  <label>MongoDB Connection URI</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="mongodb://127.0.0.1:27017"
                    value={uri}
                    onChange={(e) => setUri(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Database Name</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. test_mongodb"
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                  />
                </div>
              </>
            )}
          </>
        )}

        <div className="form-group">
          <label>Connection Label (Optional)</label>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. My XAMPP Sales DB"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Checkboxes: Read-Only Guard & Auto-Populate Example Data */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', margin: '0.75rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="autoSeedCheck"
              checked={autoSeedIfEmpty}
              onChange={(e) => setAutoSeedIfEmpty(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--primary-blue)', cursor: 'pointer' }}
            />
            <label htmlFor="autoSeedCheck" style={{ fontSize: '0.82rem', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <PlusCircle size={14} className="text-primary-blue" />
              <span>Auto-populate <strong>Example Data</strong> if Database is Empty</span>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="readOnlyCheck"
              checked={readOnly}
              onChange={(e) => setReadOnly(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--primary-blue)', cursor: 'pointer' }}
            />
            <label htmlFor="readOnlyCheck" style={{ fontSize: '0.82rem', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Shield size={14} className="text-success-emerald" />
              <span>Enable <strong>Read-Only Mode</strong> Guardrails</span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ flex: 1, fontSize: '0.8rem' }}
            onClick={handleTestConnection}
            disabled={testing}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ flex: 1.3, fontSize: '0.82rem', padding: '0.5rem 0.8rem' }}
            disabled={creating}
          >
            <Play size={16} />
            <span>{creating ? 'Connecting & Seeding...' : 'Connect & Fetch Data'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
