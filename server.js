const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const sqlite3 = require('sqlite3').verbose();
const dbManager = require('./database/DatabaseManager');
const logger = require('./database/logger');

const app = express();
const PORT = process.env.PORT || 3000;
let isTunnelActive = false; // Toggled by tunnel status detection

app.use(cors());
app.use(express.json());

// Serve static frontend assets from client/dist if built
const distPath = path.join(__dirname, 'client/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Helper to check OpenSSH availability on Windows
function checkOpenSshAvailable() {
  try {
    const output = execSync('ssh -V', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { available: true, version: output.trim() || 'OpenSSH Installed' };
  } catch (e) {
    return { available: false, version: 'OpenSSH not found in PATH' };
  }
}

// Seed `./test.db`, `./test_mysql.db`, and `./test_postgres.db` for instant demo testing out-of-the-box
function seedTestDatabase() {
  const baseDir = process.env.VERCEL ? '/tmp' : process.cwd();
  const dbFiles = [
    path.join(baseDir, 'test.db'),
    path.join(baseDir, 'test_mysql.db'),
    path.join(baseDir, 'test_postgres.db')
  ];

  dbFiles.forEach(file => {
    const dbPath = path.resolve(file);
    try {
      const db = new sqlite3.Database(dbPath);

      db.serialize(() => {
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT,
            price REAL NOT NULL,
            stock INTEGER DEFAULT 0
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            total_amount REAL,
            status TEXT DEFAULT 'pending',
            ordered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
          if (!err && row && row.count === 0) {
            const stmt = db.prepare('INSERT INTO users (name, email, role) VALUES (?, ?, ?)');
            stmt.run('Alice Johnson', `alice@${path.basename(file, '.db')}.com`, 'admin');
            stmt.run('Bob Smith', `bob@${path.basename(file, '.db')}.com`, 'developer');
            stmt.run('Charlie Brown', `charlie@${path.basename(file, '.db')}.com`, 'user');
            stmt.run('Diana Prince', `diana@${path.basename(file, '.db')}.com`, 'manager');
            stmt.run('Ethan Hunt', `ethan@${path.basename(file, '.db')}.com`, 'user');
            stmt.finalize();

            const pStmt = db.prepare('INSERT INTO products (title, category, price, stock) VALUES (?, ?, ?, ?)');
            pStmt.run('Developer Laptop Pro 16"', 'Electronics', 2499.99, 45);
            pStmt.run('Ergonomic Mechanical Keyboard', 'Peripherals', 149.50, 120);
            pStmt.run('4K UltraHD Monitor 32"', 'Electronics', 699.00, 30);
            pStmt.run('Wireless Noise-Canceling Headphones', 'Audio', 299.99, 85);
            pStmt.run('Standing Desk Converters', 'Furniture', 349.00, 15);
            pStmt.finalize();

            const oStmt = db.prepare('INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?)');
            oStmt.run(1, 2649.49, 'completed');
            oStmt.run(2, 149.50, 'shipped');
            oStmt.run(3, 699.00, 'pending');
            oStmt.run(4, 648.99, 'completed');
            oStmt.finalize();

            const aStmt = db.prepare('INSERT INTO audit_logs (action, details) VALUES (?, ?)');
            aStmt.run('SYSTEM_INIT', `Database ${file} seeded with default demo tables and initial dataset.`);
            aStmt.run('USER_REGISTER', 'User Alice Johnson registered as admin.');
            aStmt.finalize();
          }
          db.close();
        });
      });
    } catch (e) {
      console.warn(`Could not seed SQLite database ${file}: ${e.message}`);
    }
  });
  console.log('✅ SQLite test databases seeded with demo data!');
}

seedTestDatabase();

// Real-time connection polling background worker (every 5 seconds, standalone mode only)
if (!process.env.VERCEL) {
  setInterval(() => {
    dbManager.pollStatuses().catch(err => {
      logger.error('POLL', 'Status poll error', { error: err.message });
    });
  }, 5000);
}

// --- RESTful API Routes ---

// System Health & Detailed Status Overview
app.get('/api/status', (req, res) => {
  const connections = dbManager.listConnections();
  const ssh = checkOpenSshAvailable();

  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    mode: isTunnelActive ? 'TUNNEL ACTIVE' : 'LOCAL MODE',
    applicationUrl: `http://127.0.0.1:${PORT}`,
    databaseHost: '127.0.0.1',
    activeConnectionsCount: connections.length,
    openSshStatus: ssh,
    logFile: logger.logFilePath,
    activeConnections: connections
  });
});

app.post('/api/status/tunnel', (req, res) => {
  const { active } = req.body;
  isTunnelActive = Boolean(active);
  logger.info('TUNNEL', `Tunnel status updated to ${isTunnelActive ? 'ACTIVE' : 'INACTIVE'}`);
  res.json({ success: true, mode: isTunnelActive ? 'TUNNEL ACTIVE' : 'LOCAL MODE' });
});

// Connection Profiles
app.get('/api/profiles', (req, res) => {
  res.json(dbManager.getSavedProfiles());
});

app.post('/api/profiles', (req, res) => {
  try {
    const profile = dbManager.addProfile(req.body);
    res.status(201).json(profile);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/profiles/:id', (req, res) => {
  const success = dbManager.removeProfile(req.params.id);
  if (success) {
    res.json({ success: true, message: 'Profile removed' });
  } else {
    res.status(404).json({ error: 'Profile not found' });
  }
});

app.post('/api/connections/parse-url', (req, res) => {
  const { connectionString, type } = req.body;
  if (!connectionString) {
    return res.status(400).json({ error: 'Connection string or URL is required' });
  }

  const parsed = dbManager.parseConnectionString(connectionString, type || 'sqlite');
  if (!parsed) {
    return res.status(400).json({ error: 'Invalid connection URL or path format.' });
  }

  res.json(parsed);
});

// Connection Management
app.post('/api/connections/test', async (req, res) => {
  const { type, config } = req.body;
  if (!type || !config) {
    return res.status(400).json({ error: 'Missing required connection type or configuration' });
  }

  try {
    const result = await dbManager.testConnection(type, config);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/connections', async (req, res) => {
  const { name, type, config, sourceType, readOnly } = req.body;
  if (!type || !config) {
    return res.status(400).json({ error: 'Missing required connection type or configuration' });
  }

  try {
    const conn = await dbManager.addConnection(name, type, config, { sourceType, readOnly });
    res.status(201).json(conn);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/connections', (req, res) => {
  res.json(dbManager.listConnections());
});

app.get('/api/connections/:id', (req, res) => {
  try {
    const conn = dbManager.getConnection(req.params.id);
    res.json(dbManager.sanitizeConnection(conn));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.patch('/api/connections/:id/readonly', async (req, res) => {
  try {
    const { readOnly } = req.body;
    const updated = await dbManager.setReadOnlyMode(req.params.id, readOnly);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/connections/:id', async (req, res) => {
  try {
    const success = await dbManager.removeConnection(req.params.id);
    if (success) {
      res.json({ success: true, message: 'Connection removed successfully' });
    } else {
      res.status(404).json({ error: 'Connection not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Schema Inspection
app.get('/api/schema/:id', async (req, res) => {
  try {
    const schema = await dbManager.getSchema(req.params.id);
    res.json(schema);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/schema/:id/table/:tableName', async (req, res) => {
  try {
    const details = await dbManager.getTableDetails(req.params.id, req.params.tableName);
    res.json(details);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/data/:id/:tableName', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;
    const rows = await dbManager.getData(req.params.id, req.params.tableName, { limit, offset });
    res.json({ rows, limit, offset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Query Execution
app.post('/api/query/:id', async (req, res) => {
  const { query, overrideReadOnly } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'Query string is required' });
  }

  try {
    const result = await dbManager.executeQuery(req.params.id, query, overrideReadOnly);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Seed Demo Tables on any Connection
app.post('/api/connections/:id/seed', async (req, res) => {
  try {
    const result = await dbManager.seedDemoData(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Fallback to index.html for SPA client routing
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'client/dist/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send('DB 1.1 Backend System Active. Client dist not built yet.');
  }
});

if (!process.env.VERCEL && require.main === module) {
  app.listen(PORT, '127.0.0.1', () => {
    console.log(`=====================================`);
    console.log(` DB 1.1 LOCAL DATABASE SYSTEM`);
    console.log(`=====================================`);
    console.log(`Application:        http://127.0.0.1:${PORT}`);
    console.log(`Database connector: ACTIVE`);
    console.log(`Status:             CONNECTED`);
    console.log(`Log File:           ${logger.logFilePath}`);
    console.log(`=====================================`);
  });
}

module.exports = app;
