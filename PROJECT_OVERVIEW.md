# 🗄️ DB 1.1 - Project Architecture & System Overview

## System Architecture

```
                 ANTIGRAVITY IDE / AGENT
                           │
                           ▼
                      DB 1.1 APP
                           │
                           ▼
                LOCAL DATABASE CONNECTOR
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
      SQLite             MySQL            PostgreSQL / MongoDB
        │                  │
        │                  ▼
        │               XAMPP (127.0.0.1:3306)
        ▼
  External Database File (C:\...\company.db)
```

### Demonstration Tunnel Architecture

```
            REMOTE CLIENT COMPUTER
                      │
                      │ SSH Tunnel (Port 8080 -> 3000)
                      ▼
               YOUR WINDOWS PC
                      │
                      ▼
            DB 1.1 APP (127.0.0.1:3000)
                      │
                      ▼
               LOCAL CONNECTOR
                      │
                      ▼
            LOCAL DATABASE (127.0.0.1:3306)
```

---

## Backend Modules (`database/`)

- `DatabaseManager.js`: Master orchestrator managing active connections, saved profiles, and connection polling.
- `queryManager.js`: Read-Only security validator preventing unwanted data modification or DDL execution.
- `logger.js`: Local append-only logger writing sanitized metrics to `logs/connector.log`.
- `connectors/SQLiteConnector.js`: Direct external file opener using `sqlite3.OPEN_READONLY` mode for non-destructive testing.
- `connectors/MySQLConnector.js`: XAMPP reachability tester and `information_schema` dynamic metadata engine.
- `connectors/PostgresConnector.js`: PostgreSQL metadata inspector.
- `connectors/MongoDBConnector.js`: MongoDB collection and document schema inferrer.
- `mcp-server.js`: Standard I/O JSON-RPC 2.0 MCP server for Antigravity integration.

---

## API Endpoints

- `GET /api/status`: System health, active target DB, mode (`LOCAL` vs `TUNNEL ACTIVE`), and SSH status
- `POST /api/status/tunnel`: Toggle tunnel active status flag
- `GET /api/profiles`: Retrieve saved connection profiles
- `POST /api/profiles`: Create new saved connection profile
- `DELETE /api/profiles/:id`: Delete saved profile
- `POST /api/connections/test`: Non-destructive connection reachability check
- `POST /api/connections`: Establish active connection
- `GET /api/connections`: List active connections
- `PATCH /api/connections/:id/readonly`: Toggle Read-Only mode for connection
- `DELETE /api/connections/:id`: Disconnect connection
- `GET /api/schema/:id`: Discover tables, columns, primary keys, and row counts
- `GET /api/schema/:id/table/:tableName`: Inspect column data types, indexes, foreign keys, and sample rows
- `GET /api/data/:id/:tableName`: Preview paginated table data
- `POST /api/query/:id`: Execute SQL or MongoDB JSON query under Read-Only guardrails
- `POST /api/connections/:id/seed`: Seed sample demo tables (for demo databases)
