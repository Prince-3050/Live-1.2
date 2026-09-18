# ⚡ DB 1.1 Quickstart Guide

## Prerequisites
- Node.js >= 16.x (`node -v`)
- Windows OpenSSH Client (for SSH Tunneling): check with `ssh -V`

---

## 🚀 1-Click Windows Batch Execution

Double-click or run from CMD:

```cmd
start-db11.bat
```

This script will:
1. Check Node.js runtime.
2. Verify dependencies.
3. Start the backend API server on `http://127.0.0.1:3000`.
4. Display live connection status.

To check system status at any time:

```cmd
status.bat
```

---

## 🗄️ Connecting External Databases

1. Open `http://127.0.0.1:3000` or `http://localhost:5173`.
2. On the **Connections & Profiles** tab, select **● External Local DB**.
3. Choose Database Type:
   - **SQLite**: Enter full file path (e.g. `C:\Users\User\Documents\Database\company.db`).
   - **MySQL / XAMPP**: Set Host (`127.0.0.1`), Port (`3306`), User (`root`), Password, and Database Name.
4. Click **Test Connection** to verify reachability without modifying data.
5. Click **Connect** to start exploring schema and querying live data.

---

## 🌐 Running Demonstration Tunnel

To present DB 1.1 to another device without exposing MySQL port 3306:

```cmd
start-tunnel.bat
```

To stop the tunnel:

```cmd
stop-tunnel.bat
```
