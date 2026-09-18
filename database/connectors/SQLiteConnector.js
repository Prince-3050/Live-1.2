const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const BaseConnector = require('./BaseConnector');

class SQLiteConnector extends BaseConnector {
  constructor(config) {
    super(config);
    this.filename = config.filepath || config.filename || './test.db';
    this.resolvedPath = path.isAbsolute(this.filename)
      ? this.filename
      : path.resolve(process.cwd(), this.filename);
  }

  async connect() {
    return new Promise((resolve, reject) => {
      // Check if file exists when opening an external database
      if (!fs.existsSync(this.resolvedPath)) {
        // If it's the demo database, we allow auto-creation directory, else fail for non-existent external file
        const isDemo = this.filename === './test.db' || this.config.isDemo;
        if (!isDemo) {
          this.isConnected = false;
          return reject(new Error(`SQLite database file not found at path: "${this.resolvedPath}"`));
        }
        const dir = path.dirname(this.resolvedPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      }

      // Open in OPEN_READONLY or OPEN_READWRITE mode
      const mode = (this.config.readOnly === false)
        ? (sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE)
        : sqlite3.OPEN_READONLY;

      this.connection = new sqlite3.Database(this.resolvedPath, mode, (err) => {
        if (err) {
          // If read-only open failed because file doesn't exist or permissions, attempt fallback if demo
          this.isConnected = false;
          return reject(new Error(`Failed to open SQLite database at "${this.resolvedPath}": ${err.message}`));
        }
        this.isConnected = true;
        resolve(true);
      });
    });
  }

  async disconnect() {
    if (!this.connection) return true;
    return new Promise((resolve, reject) => {
      this.connection.close((err) => {
        if (err) return reject(err);
        this.isConnected = false;
        this.connection = null;
        resolve(true);
      });
    });
  }

  async testConnection() {
    // Non-destructive read-only connection test
    if (!fs.existsSync(this.resolvedPath)) {
      throw new Error(`SQLite database file not found at: "${this.resolvedPath}"`);
    }

    return new Promise((resolve, reject) => {
      const testDb = new sqlite3.Database(this.resolvedPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          return reject(new Error(`Cannot access SQLite database at "${this.resolvedPath}": ${err.message}`));
        }
        testDb.get('SELECT 1 as alive', (qErr) => {
          testDb.close();
          if (qErr) {
            return reject(new Error(`SQLite Query Failure: ${qErr.message}`));
          }
          resolve({
            success: true,
            message: `SQLite database accessible & verified at "${this.resolvedPath}"`
          });
        });
      });
    });
  }

  async getSchema() {
    if (!this.isConnected) await this.connect();

    return new Promise((resolve, reject) => {
      const sql = `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;`;
      this.connection.all(sql, [], async (err, tables) => {
        if (err) return reject(err);

        try {
          const result = [];
          for (const table of tables) {
            const tableName = table.name;
            const columns = await this.getTableColumns(tableName);
            const count = await this.getTableRowCount(tableName);
            result.push({
              name: tableName,
              type: 'table',
              columnsCount: columns.length,
              rowCount: count,
              columns: columns.map(c => ({
                name: c.name,
                type: c.type || 'TEXT',
                primaryKey: Boolean(c.pk)
              }))
            });
          }
          resolve({ tables: result });
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  async getTableColumns(tableName) {
    return new Promise((resolve, reject) => {
      this.connection.all(`PRAGMA table_info("${tableName}")`, (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  async getTableRowCount(tableName) {
    return new Promise((resolve, reject) => {
      this.connection.get(`SELECT COUNT(*) as count FROM "${tableName}"`, (err, row) => {
        if (err) return resolve(0);
        resolve(row ? row.count : 0);
      });
    });
  }

  async getTableDetails(tableName) {
    if (!this.isConnected) await this.connect();

    const columnsRaw = await this.getTableColumns(tableName);
    const rowCount = await this.getTableRowCount(tableName);

    const columns = columnsRaw.map(c => ({
      name: c.name,
      type: c.type || 'TEXT',
      nullable: !c.notnull,
      primaryKey: Boolean(c.pk),
      defaultValue: c.dflt_value,
      unique: false
    }));

    const indexes = await new Promise((resolve) => {
      this.connection.all(`PRAGMA index_list("${tableName}")`, (err, rows) => {
        if (err) return resolve([]);
        resolve((rows || []).map(idx => ({
          name: idx.name,
          unique: Boolean(idx.unique),
          origin: idx.origin
        })));
      });
    });

    const sampleData = await this.getData(tableName, { limit: 20 });

    return {
      tableName,
      rowCount,
      columns,
      indexes,
      sampleData
    };
  }

  async getData(tableName, options = {}) {
    if (!this.isConnected) await this.connect();
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM "${tableName}" LIMIT ? OFFSET ?`;
      this.connection.all(sql, [limit, offset], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  async executeQuery(queryText) {
    if (!this.isConnected) await this.connect();
    const startTime = Date.now();
    const trimmed = queryText.trim();
    const isSelect = trimmed.toUpperCase().startsWith('SELECT') || 
                     trimmed.toUpperCase().startsWith('PRAGMA') || 
                     trimmed.toUpperCase().startsWith('EXPLAIN') ||
                     trimmed.toUpperCase().startsWith('SHOW') ||
                     trimmed.toUpperCase().startsWith('WITH');

    return new Promise((resolve, reject) => {
      if (isSelect) {
        this.connection.all(queryText, [], (err, rows) => {
          const executionTimeMs = Date.now() - startTime;
          if (err) return reject(err);
          const fields = rows && rows.length > 0 ? Object.keys(rows[0]) : [];
          resolve({
            type: 'SELECT',
            columns: fields,
            rows: rows || [],
            rowCount: rows ? rows.length : 0,
            executionTimeMs
          });
        });
      } else {
        this.connection.run(queryText, function (err) {
          const executionTimeMs = Date.now() - startTime;
          if (err) return reject(err);
          resolve({
            type: 'COMMAND',
            affectedRows: this.changes || 0,
            lastID: this.lastID,
            executionTimeMs
          });
        });
      }
    });
  }

  async seedDemoData() {
    if (!this.isConnected) await this.connect();
    const sqls = [
      `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, role TEXT DEFAULT 'user', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);`,
      `CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, category TEXT, price REAL NOT NULL, stock INTEGER DEFAULT 0);`,
      `CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, total_amount REAL, status TEXT DEFAULT 'pending', ordered_at DATETIME DEFAULT CURRENT_TIMESTAMP);`,
      `CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, details TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP);`,
      `INSERT INTO users (name, email, role) VALUES ('Alice Johnson', 'alice@sqlite.com', 'admin'), ('Bob Smith', 'bob@sqlite.com', 'developer'), ('Charlie Brown', 'charlie@sqlite.com', 'user');`,
      `INSERT INTO products (title, category, price, stock) VALUES ('Developer Laptop Pro 16"', 'Electronics', 2499.99, 45), ('Ergonomic Mechanical Keyboard', 'Peripherals', 149.50, 120), ('4K UltraHD Monitor 32"', 'Electronics', 699.00, 30);`,
      `INSERT INTO orders (user_id, total_amount, status) VALUES (1, 2649.49, 'completed'), (2, 149.50, 'shipped');`,
      `INSERT INTO audit_logs (action, details) VALUES ('SQLITE_SEED', 'SQLite database successfully seeded with demo tables.');`
    ];

    for (const sql of sqls) {
      try {
        await this.executeQuery(sql);
      } catch (e) {
        // ignore duplicates
      }
    }
    return { success: true, message: 'SQLite demo database seeded successfully' };
  }
}

module.exports = SQLiteConnector;
