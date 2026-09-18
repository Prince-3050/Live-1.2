# 🗄️ DB 1.1 — Local Database System & Demonstration Tunnel

DB 1.1 is a production-ready, local database connection manager with real-time schema discovery, live paginated data inspection, read-only query guardrails, and an optional demonstration SSH tunnel.

---

## ⚡ Quick Start (Windows CMD)

You can launch and manage DB 1.1 using the provided batch scripts:

```cmd
:: 1. Start Application (Backend + Checks + URL output)
start-db11.bat

:: 2. Check System & Network Status
status.bat

:: 3. Run Automated Connector Tests
test-db.bat

:: 4. Launch Demonstration SSH Tunnel
start-tunnel.bat

:: 5. Stop Application
stop-db11.bat
```

App will be live locally at `http://127.0.0.1:3000` (Frontend dev server: `http://127.0.0.1:5173`).

---

## 🔌 LOCAL EXTERNAL DATABASE CONNECTION

DB 1.1 connects directly to databases located **OUTSIDE** the project directory on your local machine without uploading, moving, or copying database files.

### 1. SQLite External Database

- **File Path**: Enter any absolute path on your PC (e.g. `C:\Users\User\Documents\Databases\company.db`).
- **Direct Access**: DB 1.1 opens the file directly in-place. No files are copied or modified during connection testing.
- **Safety**: Reads default to Read-Only mode.

### 2. MySQL / MariaDB (XAMPP)

- **Host**: `127.0.0.1`
- **Port**: `3306`
- **User**: `root` (or custom user)
- **Password**: User-supplied
- **Database**: Select database name
- **Reachability Check**: DB 1.1 tests `127.0.0.1:3306` before connecting. If XAMPP/MySQL is not running, it clearly displays:
  > *"MySQL is not running or cannot be reached at 127.0.0.1:3306."*

---

## 🌐 DEMONSTRATION TUNNEL MODE

Allow remote clients to view and demonstrate the DB 1.1 web application **WITHOUT** moving the database or exposing MySQL port 3306 directly to the internet.

### Architecture

```
OTHER COMPUTER
      │
      │ SSH Tunnel (Port 8080 -> 3000)
      ▼
YOUR WINDOWS PC (DB 1.1 App: 127.0.0.1:3000)
      │
      ▼
LOCAL DATABASE CONNECTOR
      │
      ▼
LOCAL DATABASE (MySQL 127.0.0.1:3306 / SQLite)
```

> [!IMPORTANT]
> The SSH tunnel exposes the **DB 1.1 Application (`127.0.0.1:3000`)**, **NEVER** MySQL port 3306 directly.

### Demonstration Modes

- **MODE A — SAME NETWORK (LAN)**:
  Access `http://<YOUR_LAN_IP>:3000` from another device on the same local network.
- **MODE B — REMOTE INTERNET DEMO**:
  Launch `start-tunnel.bat` using Windows OpenSSH (`ssh -V`) to establish a reverse SSH tunnel to a remote server.

---

## 🛡️ SECURITY & READ-ONLY GUARDRAILS

- **Read-Only by Default**: Blocks `DROP`, `DELETE`, `TRUNCATE`, `ALTER`, `GRANT`, `REVOKE`, `INSERT`, `UPDATE` unless write mode is explicitly overridden.
- **Sanitized Logging**: All connections and query performance metrics are recorded in `logs/connector.log` with credentials redacted.
- **No Cloud Upload**: Data remains strictly local on host machine (`127.0.0.1`).

---

## 🤖 ANTIGRAVITY MCP INTEGRATION

DB 1.1 includes a built-in JSON-RPC 2.0 stdio MCP server (`mcp-server.js`) and configuration (`mcp_config.json`) exposing safe, read-only database tools (`list_connections`, `list_tables`, `describe_table`, `preview_table`, `execute_readonly_query`) directly to the Antigravity Agent.
