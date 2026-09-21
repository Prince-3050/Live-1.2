const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const SQLiteConnector = require('./connectors/SQLiteConnector');
const MySQLConnector = require('./connectors/MySQLConnector');
const PostgresConnector = require('./connectors/PostgresConnector');
const MongoDBConnector = require('./connectors/MongoDBConnector');
const queryManager = require('./queryManager');
const logger = require('./logger');

const PROFILES_PATH = process.env.VERCEL
  ? '/tmp/profiles.json'
  : path.resolve(process.cwd(), 'database/profiles.json');

class DatabaseManager {
  constructor() {
    this.connections = new Map(); // id -> { id, name, type, sourceType, config, connector, status, readOnly, lastChecked, createdAt }
    this.profiles = this.loadProfiles();
  }

  loadProfiles() {
    try {
      if (fs.existsSync(PROFILES_PATH)) {
        const raw = fs.readFileSync(PROFILES_PATH, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      logger.warn('PROFILES', 'Failed to load saved connection profiles', { error: e.message });
    }
    return [];
  }

  saveProfiles() {
    try {
      const dir = path.dirname(PROFILES_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(PROFILES_PATH, JSON.stringify(this.profiles, null, 2), 'utf-8');
    } catch (e) {
      logger.error('PROFILES', 'Failed to save connection profiles', { error: e.message });
    }
  }

  parseConnectionString(str, fallbackType = 'sqlite') {
    if (!str || typeof str !== 'string') return null;
    const trimmed = str.trim();

    // Check if Mongo JSON file
    if (trimmed.endsWith('.json')) {
      return {
        type: 'mongodb',
        config: { filepath: trimmed, database: 'test_mongodb', isDemo: true }
      };
    }

    // Check if SQLite file path
    if (trimmed.endsWith('.db') || trimmed.endsWith('.sqlite') || trimmed.endsWith('.sqlite3') || trimmed.includes('\\') || (trimmed.includes('/') && !trimmed.includes('://'))) {
      return {
        type: 'sqlite',
        config: { filepath: trimmed, isDemo: trimmed === './test.db' || trimmed.includes('test_') }
      };
    }

    try {
      if (trimmed.includes('://')) {
        const parsed = new URL(trimmed);
        const protocol = parsed.protocol.replace(':', '').toLowerCase();

        let type = fallbackType;
        if (protocol === 'mysql') type = 'mysql';
        if (protocol === 'postgres' || protocol === 'postgresql') type = 'postgres';
        if (protocol === 'mongodb' || protocol === 'mongo') type = 'mongodb';
        if (protocol === 'sqlite' || protocol === 'file') type = 'sqlite';

        if (type === 'sqlite') {
          return { type: 'sqlite', config: { filepath: parsed.pathname || trimmed, isDemo: trimmed.includes('test_') } };
        }

        const dbName = parsed.pathname ? parsed.pathname.replace('/', '') : '';
        const isDemo = dbName.includes('test_') || trimmed.includes('test_');

        if (type === 'mongodb') {
          return {
            type: 'mongodb',
            config: {
              uri: trimmed,
              database: dbName || 'test_mongodb',
              isDemo
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
            database: dbName,
            isDemo
          }
        };
      }
    } catch (e) {
      // Ignore parse failure, return default fallback
    }

    return null;
  }

  getSavedProfiles() {
    return this.profiles.map(p => {
      const safeConfig = { ...p.config };
      if (safeConfig.password) safeConfig.password = '******';
      return { ...p, config: safeConfig };
    });
  }

  addProfile(profileData) {
    const { name, type, sourceType = 'external_local', config, readOnly = true } = profileData;
    if (!type || !config) throw new Error('Missing profile type or configuration');

    const id = uuidv4();
    const newProfile = {
      id,
      name: name || `${type.toUpperCase()} Profile (${id.slice(0, 4)})`,
      type: type.toLowerCase(),
      sourceType,
      readOnly,
      config,
      createdAt: new Date().toISOString()
    };

    this.profiles.push(newProfile);
    this.saveProfiles();
    logger.info('PROFILES', `Created connection profile "${newProfile.name}"`, { id, type, sourceType });
    return this.sanitizeProfile(newProfile);
  }

  removeProfile(id) {
    const idx = this.profiles.findIndex(p => p.id === id);
    if (idx !== -1) {
      const removed = this.profiles.splice(idx, 1)[0];
      this.saveProfiles();
      logger.info('PROFILES', `Removed connection profile "${removed.name}"`, { id });
      return true;
    }
    return false;
  }

  sanitizeProfile(profile) {
    const { config, ...safe } = profile;
    const safeConfig = { ...config };
    if (safeConfig.password) safeConfig.password = '******';
    return { ...safe, config: safeConfig };
  }

  createConnector(type, config) {
    const dbType = (type || '').toLowerCase();
    switch (dbType) {
      case 'sqlite':
      case 'sqlite3':
        return new SQLiteConnector(config);
      case 'mysql':
      case 'mariadb':
        return new MySQLConnector(config);
      case 'postgres':
      case 'postgresql':
        return new PostgresConnector(config);
      case 'mongodb':
      case 'mongo':
        return new MongoDBConnector(config);
      default:
        throw new Error(`Unsupported database type: ${type}`);
    }
  }

  async testConnection(type, config) {
    logger.info('CONNECT', `Testing connection for ${type}`, { dbType: type, host: config.host, filepath: config.filepath });
    const connector = this.createConnector(type, config);
    try {
      const result = await connector.testConnection();
      await connector.disconnect();
      logger.info('CONNECT', `Connection test successful for ${type}`, { result: result.message });
      return result;
    } catch (err) {
      try { await connector.disconnect(); } catch (e) {}
      logger.error('CONNECT', `Connection test failed for ${type}`, { error: err.message });
      throw err;
    }
  }

  async addConnection(name, type, config, options = {}) {
    const id = uuidv4();
    const connector = this.createConnector(type, config);
    await connector.connect();

    const sourceType = options.sourceType || (config.isDemo || config.filepath === './test.db' ? 'demo' : 'external_local');
    const readOnly = options.readOnly !== undefined ? options.readOnly : true;

    // Check if database is empty or demo, auto-seed sample tables so it never shows up blank!
    try {
      const schema = await connector.getSchema();
      if (!schema.tables || schema.tables.length === 0 || sourceType === 'demo' || options.autoSeed) {
        logger.info('SEED', `Database is empty or demo mode. Auto-seeding initial sample data...`, { id, type });
        await connector.seedDemoData();
      }
    } catch (e) {
      logger.warn('SEED', 'Auto-seed check skipped:', { error: e.message });
    }

    const connRecord = {
      id,
      name: name || `${type.toUpperCase()} DB (${id.slice(0, 4)})`,
      type: type.toLowerCase(),
      sourceType,
      readOnly,
      config,
      connector,
      status: 'connected',
      lastChecked: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    this.connections.set(id, connRecord);

    logger.info('CONNECT', `Registered active connection "${connRecord.name}"`, {
      id,
      type: connRecord.type,
      sourceType,
      readOnly
    });

    return this.sanitizeConnection(connRecord);
  }

  async removeConnection(id) {
    const connRecord = this.connections.get(id);
    if (!connRecord) return false;

    try {
      await connRecord.connector.disconnect();
    } catch (e) {
      // ignore
    }

    this.connections.delete(id);
    logger.info('CONNECT', `Removed active connection "${connRecord.name}"`, { id });
    return true;
  }

  getConnection(id) {
    const connRecord = this.connections.get(id);
    if (!connRecord) {
      throw new Error(`Connection not found for ID: ${id}`);
    }
    return connRecord;
  }

  listConnections() {
    const list = [];
    for (const record of this.connections.values()) {
      list.push(this.sanitizeConnection(record));
    }
    return list;
  }

  sanitizeConnection(record) {
    const { connector, config, ...safe } = record;
    const safeConfig = { ...config };
    if (safeConfig.password) safeConfig.password = '******';

    return {
      ...safe,
      config: safeConfig
    };
  }

  async setReadOnlyMode(id, readOnly) {
    const record = this.getConnection(id);
    record.readOnly = Boolean(readOnly);
    logger.info('SECURITY', `Set Read-Only mode to ${record.readOnly} for connection ${record.name}`, { id });
    return this.sanitizeConnection(record);
  }

  async pollStatuses() {
    for (const record of this.connections.values()) {
      try {
        await record.connector.testConnection();
        record.status = 'connected';
      } catch (err) {
        record.status = 'disconnected';
      }
      record.lastChecked = new Date().toISOString();
    }
  }

  async getSchema(id) {
    const record = this.getConnection(id);
    return await record.connector.getSchema();
  }

  async getTableDetails(id, tableName) {
    const record = this.getConnection(id);
    return await record.connector.getTableDetails(tableName);
  }

  async getData(id, tableName, options) {
    const record = this.getConnection(id);
    return await record.connector.getData(tableName, options);
  }

  async executeQuery(id, queryText, overrideReadOnly) {
    const record = this.getConnection(id);
    const readOnlyMode = overrideReadOnly !== undefined ? Boolean(overrideReadOnly) : record.readOnly;

    // Validate Read-Only safety rules before execution
    queryManager.validateQuery(queryText, {
      readOnly: readOnlyMode,
      dbType: record.type
    });

    const startTime = Date.now();
    try {
      const result = await record.connector.executeQuery(queryText);
      const executionTimeMs = Date.now() - startTime;
      logger.info('QUERY', `Query executed on ${record.name}`, {
        type: record.type,
        executionTimeMs,
        rowCount: result.rowCount,
        affectedRows: result.affectedRows
      });
      return {
        ...result,
        target: {
          name: record.name,
          type: record.type,
          host: record.config.host || 'localhost',
          port: record.config.port || (record.type === 'mysql' ? 3306 : record.type === 'postgres' ? 5432 : null),
          database: record.config.database || record.config.filepath || 'local',
          sourceType: record.sourceType,
          readOnly: readOnlyMode
        }
      };
    } catch (err) {
      logger.error('QUERY', `Query failed on ${record.name}`, { error: err.message });
      throw err;
    }
  }

  async seedDemoData(id) {
    const record = this.getConnection(id);
    return await record.connector.seedDemoData();
  }
}

module.exports = new DatabaseManager();
