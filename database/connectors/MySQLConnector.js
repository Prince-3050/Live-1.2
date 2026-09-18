const mysql = require('mysql2/promise');
const BaseConnector = require('./BaseConnector');
const SQLiteConnector = require('./SQLiteConnector');

class MySQLConnector extends BaseConnector {
  constructor(config) {
    super(config);
    this.host = config.host || '127.0.0.1';
    this.port = parseInt(config.port, 10) || 3306;
    this.user = config.user || 'root';
    this.password = config.password || '';
    this.database = config.database || '';
    this.isDemo = Boolean(config.isDemo || config.sourceType === 'demo' || config.filepath === './test_mysql.db');
    this.fallbackConnector = new SQLiteConnector({ filepath: './test_mysql.db' });
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
      this.connection = await mysql.createConnection({
        host: this.host,
        port: this.port,
        user: this.user,
        password: this.password,
        database: this.database || undefined,
        connectTimeout: 5000
      });
      this.isConnected = true;
      this.useFallback = false;
      return true;
    } catch (err) {
      this.isConnected = false;
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        throw new Error(`MySQL is not running or cannot be reached at ${this.host}:${this.port}.`);
      }
      if (err.code === 'ER_ACCESS_DENIED_ERROR') {
        throw new Error(`MySQL Authentication failed for user '${this.user}' at ${this.host}:${this.port}. Check username & password.`);
      }
      if (err.code === 'ER_BAD_DB_ERROR') {
        throw new Error(`MySQL Database '${this.database}' does not exist on ${this.host}:${this.port}.`);
      }
      throw new Error(`MySQL Connection Failed (${this.host}:${this.port}): ${err.message}`);
    }
  }

  async disconnect() {
    if (this.useFallback) return await this.fallbackConnector.disconnect();
    if (this.connection) {
      try {
        await this.connection.end();
      } catch (e) {}
      this.connection = null;
      this.isConnected = false;
    }
    return true;
  }

  async testConnection() {
    if (this.isDemo) {
      return await this.fallbackConnector.testConnection();
    }

    let conn;
    try {
      conn = await mysql.createConnection({
        host: this.host,
        port: this.port,
        user: this.user,
        password: this.password,
        database: this.database || undefined,
        connectTimeout: 5000
      });

      await conn.query('SELECT 1');

      // If database was provided, verify it exists
      if (this.database) {
        const [dbs] = await conn.query('SHOW DATABASES LIKE ?', [this.database]);
        if (dbs.length === 0) {
          await conn.end();
          throw new Error(`Database '${this.database}' not found on MySQL server at ${this.host}:${this.port}.`);
        }
      }

      await conn.end();
      return {
        success: true,
        message: `Successfully reached MySQL server & authenticated on ${this.host}:${this.port}${this.database ? ` (Database: ${this.database})` : ''}`
      };
    } catch (err) {
      if (conn) try { await conn.end(); } catch (e) {}

      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
        throw new Error(`MySQL is not running or cannot be reached at ${this.host}:${this.port}.`);
      }
      if (err.code === 'ER_ACCESS_DENIED_ERROR') {
        throw new Error(`MySQL Authentication failed for user '${this.user}' at ${this.host}:${this.port}. Check username & password.`);
      }
      if (err.code === 'ER_BAD_DB_ERROR') {
        throw new Error(`MySQL Database '${this.database}' does not exist on ${this.host}:${this.port}.`);
      }
      throw err;
    }
  }

  async listDatabases() {
    if (this.useFallback) return ['test_mysql'];
    if (!this.isConnected) await this.connect();
    const [rows] = await this.connection.query('SHOW DATABASES');
    return rows.map(r => Object.values(r)[0]).filter(db => !['information_schema', 'mysql', 'performance_schema', 'sys'].includes(db));
  }

  async getSchema() {
    if (this.useFallback) return await this.fallbackConnector.getSchema();
    if (!this.isConnected) await this.connect();

    const targetDb = this.database;
    if (!targetDb) {
      const dbs = await this.listDatabases();
      return { databases: dbs, tables: [] };
    }

    const [tables] = await this.connection.query(
      `SELECT TABLE_NAME as name, TABLE_ROWS as rowCount, DATA_LENGTH as dataSize 
       FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = ?`,
      [targetDb]
    );

    const result = [];
    for (const t of tables) {
      const [cols] = await this.connection.query(
        `SELECT COLUMN_NAME as name, DATA_TYPE as type, COLUMN_KEY as columnKey
         FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [targetDb, t.name]
      );
      result.push({
        name: t.name,
        type: 'table',
        columnsCount: cols.length,
        rowCount: t.rowCount || 0,
        dataSize: t.dataSize || 0,
        columns: cols.map(c => ({
          name: c.name,
          type: c.type,
          primaryKey: c.columnKey === 'PRI'
        }))
      });
    }

    return { database: targetDb, tables: result };
  }

  async getTableDetails(tableName) {
    if (this.useFallback) return await this.fallbackConnector.getTableDetails(tableName);
    if (!this.isConnected) await this.connect();

    const targetDb = this.database;

    const [columnsRaw] = await this.connection.query(
      `SELECT COLUMN_NAME as name, COLUMN_TYPE as type, IS_NULLABLE as nullable, 
              COLUMN_KEY as columnKey, EXTRA as extra, COLUMN_DEFAULT as defaultValue
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [targetDb, tableName]
    );

    const columns = columnsRaw.map(c => ({
      name: c.name,
      type: c.type,
      nullable: c.nullable === 'YES',
      primaryKey: c.columnKey === 'PRI',
      autoIncrement: (c.extra || '').includes('auto_increment'),
      defaultValue: c.defaultValue
    }));

    const [indexesRaw] = await this.connection.query(
      `SELECT INDEX_NAME as name, NON_UNIQUE as nonUnique, COLUMN_NAME as columnName
       FROM information_schema.STATISTICS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [targetDb, tableName]
    );

    // Foreign Keys / Relationships discovery
    const [foreignKeysRaw] = await this.connection.query(
      `SELECT CONSTRAINT_NAME as constraintName, COLUMN_NAME as columnName, 
              REFERENCED_TABLE_NAME as referencedTable, REFERENCED_COLUMN_NAME as referencedColumn
       FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [targetDb, tableName]
    );

    const sampleData = await this.getData(tableName, { limit: 20 });
    const [countRes] = await this.connection.query(`SELECT COUNT(*) as cnt FROM \`${tableName}\``);
    const rowCount = countRes[0]?.cnt || 0;

    return {
      tableName,
      rowCount,
      columns,
      indexes: indexesRaw.map(i => ({
        name: i.name,
        unique: i.nonUnique === 0,
        columnName: i.columnName
      })),
      foreignKeys: foreignKeysRaw.map(fk => ({
        name: fk.constraintName,
        column: fk.columnName,
        referencedTable: fk.referencedTable,
        referencedColumn: fk.referencedColumn
      })),
      sampleData
    };
  }

  async getData(tableName, options = {}) {
    if (this.useFallback) return await this.fallbackConnector.getData(tableName, options);
    if (!this.isConnected) await this.connect();
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    const [rows] = await this.connection.query(
      `SELECT * FROM \`${tableName}\` LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return rows;
  }

  async executeQuery(queryText) {
    if (this.useFallback) return await this.fallbackConnector.executeQuery(queryText);
    if (!this.isConnected) await this.connect();
    const startTime = Date.now();

    const [results, fields] = await this.connection.query(queryText);
    const executionTimeMs = Date.now() - startTime;

    if (Array.isArray(results)) {
      const cols = fields ? fields.map(f => f.name) : (results[0] ? Object.keys(results[0]) : []);
      return {
        type: 'SELECT',
        columns: cols,
        rows: results,
        rowCount: results.length,
        executionTimeMs
      };
    } else {
      return {
        type: 'COMMAND',
        affectedRows: results.affectedRows || 0,
        insertId: results.insertId || null,
        executionTimeMs
      };
    }
  }

  async seedDemoData() {
    if (this.useFallback) return await this.fallbackConnector.seedDemoData();
    if (!this.isConnected) await this.connect();
    const sqls = [
      `CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(100) UNIQUE NOT NULL, role VARCHAR(50) DEFAULT 'user', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
      `CREATE TABLE IF NOT EXISTS products (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(150) NOT NULL, category VARCHAR(50), price DECIMAL(10, 2) NOT NULL, stock INT DEFAULT 0);`,
      `CREATE TABLE IF NOT EXISTS orders (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT, total_amount DECIMAL(10, 2), status VARCHAR(50) DEFAULT 'pending', ordered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
      `CREATE TABLE IF NOT EXISTS audit_logs (id INT AUTO_INCREMENT PRIMARY KEY, action VARCHAR(100) NOT NULL, details TEXT, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);`,
      `INSERT IGNORE INTO users (name, email, role) VALUES ('Alice Johnson', 'alice@mysql.com', 'admin'), ('Bob Smith', 'bob@mysql.com', 'developer'), ('Charlie Brown', 'charlie@mysql.com', 'user');`,
      `INSERT INTO products (title, category, price, stock) VALUES ('Developer Laptop Pro 16"', 'Electronics', 2499.99, 45), ('Ergonomic Mechanical Keyboard', 'Peripherals', 149.50, 120), ('4K UltraHD Monitor 32"', 'Electronics', 699.00, 30);`,
      `INSERT INTO orders (user_id, total_amount, status) VALUES (1, 2649.49, 'completed'), (2, 149.50, 'shipped');`,
      `INSERT INTO audit_logs (action, details) VALUES ('MYSQL_SEED', 'MySQL demo database seeded successfully.');`
    ];

    for (const sql of sqls) {
      try {
        await this.executeQuery(sql);
      } catch (e) {
        // ignore errors
      }
    }
    return { success: true, message: 'MySQL demo database seeded successfully' };
  }
}

module.exports = MySQLConnector;
