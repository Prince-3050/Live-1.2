const { Client } = require('pg');
const BaseConnector = require('./BaseConnector');
const SQLiteConnector = require('./SQLiteConnector');

class PostgresConnector extends BaseConnector {
  constructor(config) {
    super(config);
    this.host = config.host || '127.0.0.1';
    this.port = parseInt(config.port, 10) || 5432;
    this.user = config.user || 'postgres';
    this.password = config.password || '';
    this.database = config.database || 'postgres';
    this.schema = config.schema || 'public';
    this.isDemo = Boolean(config.isDemo || config.sourceType === 'demo' || config.filepath === './test_postgres.db');
    this.fallbackConnector = new SQLiteConnector({ filepath: './test_postgres.db' });
    this.useFallback = false;
  }

  async connect() {
    if (this.isDemo) {
      await this.fallbackConnector.connect();
      this.isConnected = true;
      this.useFallback = true;
      return true;
    }
    try {
      this.client = new Client({
        host: this.host,
        port: this.port,
        user: this.user,
        password: this.password,
        database: this.database,
        connectionTimeoutMillis: 5000
      });
      await this.client.connect();
      this.isConnected = true;
      this.useFallback = false;
      return true;
    } catch (err) {
      this.isConnected = false;
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        throw new Error(`PostgreSQL is not running or cannot be reached at ${this.host}:${this.port}.`);
      }
      if (err.code === '28P01' || err.code === '28000') {
        throw new Error(`PostgreSQL Authentication failed for user '${this.user}' at ${this.host}:${this.port}. Check password.`);
      }
      if (err.code === '3D000') {
        throw new Error(`PostgreSQL Database '${this.database}' does not exist on ${this.host}:${this.port}.`);
      }
      throw new Error(`PostgreSQL Server Error (${this.host}:${this.port}): ${err.message}`);
    }
  }

  async disconnect() {
    if (this.useFallback) return await this.fallbackConnector.disconnect();
    if (this.client) {
      try {
        await this.client.end();
      } catch (e) {}
      this.client = null;
      this.isConnected = false;
    }
    return true;
  }

  async testConnection() {
    if (this.isDemo) {
      return await this.fallbackConnector.testConnection();
    }
    const testClient = new Client({
      host: this.host,
      port: this.port,
      user: this.user,
      password: this.password,
      database: this.database,
      connectionTimeoutMillis: 5000
    });
    try {
      await testClient.connect();
      await testClient.query('SELECT 1');
      await testClient.end();
      return { success: true, message: `Successfully connected to PostgreSQL database "${this.database}" on ${this.host}:${this.port}` };
    } catch (err) {
      try { await testClient.end(); } catch (e) {}
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        throw new Error(`PostgreSQL is not running or cannot be reached at ${this.host}:${this.port}.`);
      }
      if (err.code === '28P01' || err.code === '28000') {
        throw new Error(`PostgreSQL Authentication failed for user '${this.user}' at ${this.host}:${this.port}. Check password.`);
      }
      if (err.code === '3D000') {
        throw new Error(`PostgreSQL Database '${this.database}' does not exist on ${this.host}:${this.port}.`);
      }
      throw new Error(`PostgreSQL Connection Failed (${this.host}:${this.port}): ${err.message}`);
    }
  }

  async getSchema() {
    if (this.useFallback) return await this.fallbackConnector.getSchema();
    if (!this.isConnected) await this.connect();

    const tablesRes = await this.client.query(
      `SELECT table_name as name 
       FROM information_schema.tables 
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [this.schema]
    );

    const result = [];
    for (const t of tablesRes.rows) {
      const colsRes = await this.client.query(
        `SELECT column_name as name, data_type as type 
         FROM information_schema.columns 
         WHERE table_schema = $1 AND table_name = $2`,
        [this.schema, t.name]
      );
      const countRes = await this.client.query(`SELECT COUNT(*) as count FROM "${this.schema}"."${t.name}"`);
      result.push({
        name: t.name,
        type: 'table',
        columnsCount: colsRes.rows.length,
        rowCount: parseInt(countRes.rows[0]?.count || 0, 10),
        columns: colsRes.rows.map(c => ({
          name: c.name,
          type: c.type
        }))
      });
    }

    return { tables: result };
  }

  async getTableDetails(tableName) {
    if (this.useFallback) return await this.fallbackConnector.getTableDetails(tableName);
    if (!this.isConnected) await this.connect();

    const colsRes = await this.client.query(
      `SELECT column_name as name, data_type as type, is_nullable as nullable, column_default as default_value
       FROM information_schema.columns 
       WHERE table_schema = $1 AND table_name = $2`,
      [this.schema, tableName]
    );

    const pkRes = await this.client.query(
      `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       WHERE tc.constraint_type = 'PRIMARY KEY'
         AND tc.table_schema = $1
         AND tc.table_name = $2`,
      [this.schema, tableName]
    );
    const pkColumns = new Set(pkRes.rows.map(r => r.column_name));

    const columns = colsRes.rows.map(c => ({
      name: c.name,
      type: c.type,
      nullable: c.nullable === 'YES',
      primaryKey: pkColumns.has(c.name),
      defaultValue: c.default_value
    }));

    const idxRes = await this.client.query(
      `SELECT indexname as name, indexdef as def 
       FROM pg_indexes 
       WHERE schemaname = $1 AND tablename = $2`,
      [this.schema, tableName]
    );

    const countRes = await this.client.query(`SELECT COUNT(*) as count FROM "${this.schema}"."${tableName}"`);
    const sampleData = await this.getData(tableName, { limit: 20 });

    return {
      tableName,
      rowCount: parseInt(countRes.rows[0]?.count || 0, 10),
      columns,
      indexes: idxRes.rows.map(i => ({
        name: i.name,
        unique: i.def.includes('UNIQUE'),
        definition: i.def
      })),
      sampleData
    };
  }

  async getData(tableName, options = {}) {
    if (this.useFallback) return await this.fallbackConnector.getData(tableName, options);
    if (!this.isConnected) await this.connect();
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    const res = await this.client.query(
      `SELECT * FROM "${this.schema}"."${tableName}" LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return res.rows;
  }

  async executeQuery(queryText) {
    if (this.useFallback) return await this.fallbackConnector.executeQuery(queryText);
    if (!this.isConnected) await this.connect();
    const startTime = Date.now();

    const res = await this.client.query(queryText);
    const executionTimeMs = Date.now() - startTime;

    if (Array.isArray(res)) {
      const lastRes = res[res.length - 1];
      return {
        type: lastRes.command,
        columns: lastRes.fields ? lastRes.fields.map(f => f.name) : [],
        rows: lastRes.rows || [],
        rowCount: lastRes.rowCount || 0,
        executionTimeMs
      };
    } else {
      return {
        type: res.command,
        columns: res.fields ? res.fields.map(f => f.name) : [],
        rows: res.rows || [],
        rowCount: res.rowCount || 0,
        affectedRows: res.rowCount || 0,
        executionTimeMs
      };
    }
  }

  async seedDemoData() {
    if (this.useFallback) return await this.fallbackConnector.seedDemoData();
    if (!this.isConnected) await this.connect();
    const sqls = [
      `CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(100) UNIQUE NOT NULL, role VARCHAR(50) DEFAULT 'user', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
      `CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, title VARCHAR(150) NOT NULL, category VARCHAR(50), price NUMERIC(10, 2) NOT NULL, stock INT DEFAULT 0);`,
      `CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id), total_amount NUMERIC(10, 2), status VARCHAR(50) DEFAULT 'pending', ordered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
      `CREATE TABLE IF NOT EXISTS audit_logs (id SERIAL PRIMARY KEY, action VARCHAR(100) NOT NULL, details TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
      `INSERT INTO users (name, email, role) VALUES ('Alice Johnson', 'alice@postgres.com', 'admin'), ('Bob Smith', 'bob@postgres.com', 'developer'), ('Charlie Brown', 'charlie@postgres.com', 'user') ON CONFLICT (email) DO NOTHING;`,
      `INSERT INTO products (title, category, price, stock) VALUES ('Developer Laptop Pro 16"', 'Electronics', 2499.99, 45), ('Ergonomic Mechanical Keyboard', 'Peripherals', 149.50, 120), ('4K UltraHD Monitor 32"', 'Electronics', 699.00, 30);`,
      `INSERT INTO orders (user_id, total_amount, status) VALUES (1, 2649.49, 'completed'), (2, 149.50, 'shipped');`,
      `INSERT INTO audit_logs (action, details) VALUES ('POSTGRES_SEED', 'PostgreSQL demo database seeded successfully.');`
    ];

    for (const sql of sqls) {
      try {
        await this.executeQuery(sql);
      } catch (e) {
        // ignore
      }
    }
    return { success: true, message: 'PostgreSQL demo database seeded successfully' };
  }
}

module.exports = PostgresConnector;
