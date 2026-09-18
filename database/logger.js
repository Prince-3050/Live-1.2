const fs = require('fs');
const path = require('path');

const logDir = path.resolve(process.cwd(), 'logs');
const logFilePath = path.join(logDir, 'connector.log');

function ensureLogDir() {
  if (!fs.existsSync(logDir)) {
    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch (e) {
      // ignore
    }
  }
}

function writeLog(level, category, message, metadata = {}) {
  try {
    ensureLogDir();
    const timestamp = new Date().toISOString();
    
    // Sanitize metadata to never log passwords or full dataset rows
    const safeMeta = { ...metadata };
    delete safeMeta.password;
    delete safeMeta.secret;
    delete safeMeta.rows;
    delete safeMeta.sampleData;

    const metaStr = Object.keys(safeMeta).length > 0 ? ` | ${JSON.stringify(safeMeta)}` : '';
    const logLine = `[${timestamp}] [${level.toUpperCase()}] [${category}] ${message}${metaStr}\n`;

    fs.appendFileSync(logFilePath, logLine, 'utf-8');
  } catch (err) {
    console.error('Failed to write to connector log:', err.message);
  }
}

module.exports = {
  info: (category, message, meta) => writeLog('INFO', category, message, meta),
  warn: (category, message, meta) => writeLog('WARN', category, message, meta),
  error: (category, message, meta) => writeLog('ERROR', category, message, meta),
  logFilePath
};
