/**
 * Query Manager & Security Validator for DB 1.1
 * Enforces Read-Only safety rules and query sanitation.
 */

const BLOCKED_SQL_KEYWORDS = [
  'DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'GRANT', 
  'REVOKE', 'CREATE', 'INSERT', 'UPDATE', 'REPLACE', 
  'RENAME', 'ATTACH', 'DETACH'
];

const ALLOWED_SQL_STARTS = [
  'SELECT', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN', 'PRAGMA', 'WITH'
];

const BLOCKED_MONGO_ACTIONS = [
  'insert', 'insertone', 'insertmany',
  'update', 'updateone', 'updatemany',
  'delete', 'deleteone', 'deletemany',
  'drop', 'dropcollection', 'dropdatabase',
  'remove'
];

/**
 * Validates whether a query is safe to execute under current security settings.
 * @param {string} queryText - The raw query string or JSON string
 * @param {Object} options - { readOnly: boolean, dbType: string }
 */
function validateQuery(queryText, options = {}) {
  const readOnly = options.readOnly !== false; // Default: true
  const dbType = (options.dbType || 'sqlite').toLowerCase();

  if (!queryText || typeof queryText !== 'string' || !queryText.trim()) {
    throw new Error('Query string cannot be empty.');
  }

  const trimmed = queryText.trim();

  if (readOnly) {
    if (dbType === 'mongodb' || dbType === 'mongo') {
      validateMongoReadOnly(trimmed);
    } else {
      validateSqlReadOnly(trimmed);
    }
  }

  return { isValid: true, readOnly };
}

function validateSqlReadOnly(query) {
  // Strip SQL single-line and multi-line comments
  const stripped = query
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();

  if (!stripped) {
    throw new Error('Query consists only of comments or whitespace.');
  }

  // Check statement start keyword
  const firstWordMatch = stripped.match(/^([a-zA-Z]+)/);
  const firstWord = firstWordMatch ? firstWordMatch[1].toUpperCase() : '';

  if (!ALLOWED_SQL_STARTS.includes(firstWord)) {
    throw new Error(
      `Read-Only Mode Blocked: Statement starting with '${firstWord}' is not permitted in Read-Only Mode. Allowed starting commands: ${ALLOWED_SQL_STARTS.join(', ')}.`
    );
  }

  // Double check for embedded destructive statements in multi-queries (e.g. SELECT 1; DROP TABLE users;)
  const upper = stripped.toUpperCase();
  for (const keyword of BLOCKED_SQL_KEYWORDS) {
    // Regex matching keyword as whole word bounded by whitespace/punctuation
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(upper)) {
      throw new Error(
        `Read-Only Mode Blocked: Destructive operation '${keyword}' is prohibited in Read-Only Mode.`
      );
    }
  }
}

function validateMongoReadOnly(query) {
  let parsed;
  try {
    parsed = JSON.parse(query);
  } catch (e) {
    // If not JSON, it will be caught during execution, but let me check text for obvious blocked actions
    const lower = query.toLowerCase();
    for (const action of BLOCKED_MONGO_ACTIONS) {
      if (lower.includes(`"${action}"`) || lower.includes(`'${action}'`)) {
        throw new Error(
          `Read-Only Mode Blocked: MongoDB mutation action '${action}' is prohibited in Read-Only Mode.`
        );
      }
    }
    return;
  }

  const action = (parsed.action || 'find').toLowerCase();
  if (BLOCKED_MONGO_ACTIONS.includes(action)) {
    throw new Error(
      `Read-Only Mode Blocked: MongoDB action '${action}' is prohibited in Read-Only Mode.`
    );
  }
}

module.exports = {
  validateQuery,
  BLOCKED_SQL_KEYWORDS,
  ALLOWED_SQL_STARTS
};
