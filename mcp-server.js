/**
 * Antigravity Local MCP Server for DB 1.1
 * Uses JSON-RPC 2.0 stdio transport to expose read-only database tools.
 */

const readline = require('readline');
const dbManager = require('./database/DatabaseManager');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

const TOOLS = [
  {
    name: 'list_connections',
    description: 'List all currently active database connections in DB 1.1',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'list_tables',
    description: 'List all tables and columns in a connected database',
    inputSchema: {
      type: 'object',
      properties: {
        connectionId: { type: 'string', description: 'Active connection ID' }
      },
      required: ['connectionId']
    }
  },
  {
    name: 'describe_table',
    description: 'Get column schemas, data types, and primary keys for a table',
    inputSchema: {
      type: 'object',
      properties: {
        connectionId: { type: 'string', description: 'Active connection ID' },
        tableName: { type: 'string', description: 'Table name' }
      },
      required: ['connectionId', 'tableName']
    }
  },
  {
    name: 'preview_table',
    description: 'Preview sample data rows from a table',
    inputSchema: {
      type: 'object',
      properties: {
        connectionId: { type: 'string', description: 'Active connection ID' },
        tableName: { type: 'string', description: 'Table name' },
        limit: { type: 'number', description: 'Max rows to return (default: 20)' }
      },
      required: ['connectionId', 'tableName']
    }
  },
  {
    name: 'execute_readonly_query',
    description: 'Execute a read-only SELECT or PRAGMA query against a connected database',
    inputSchema: {
      type: 'object',
      properties: {
        connectionId: { type: 'string', description: 'Active connection ID' },
        query: { type: 'string', description: 'SQL or JSON query string' }
      },
      required: ['connectionId', 'query']
    }
  }
];

function sendResponse(id, result, error = null) {
  const response = { jsonrpc: '2.0', id };
  if (error) {
    response.error = { code: -32603, message: error };
  } else {
    response.result = result;
  }
  process.stdout.write(JSON.stringify(response) + '\n');
}

rl.on('line', async (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch (e) {
    return;
  }

  const { id, method, params } = req;

  if (method === 'initialize') {
    return sendResponse(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'db-1.1-mcp-server', version: '1.0.0' }
    });
  }

  if (method === 'tools/list') {
    return sendResponse(id, { tools: TOOLS });
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params || {};
    try {
      if (name === 'list_connections') {
        const conns = dbManager.listConnections();
        return sendResponse(id, { content: [{ type: 'text', text: JSON.stringify(conns, null, 2) }] });
      }

      if (name === 'list_tables') {
        const schema = await dbManager.getSchema(args.connectionId);
        return sendResponse(id, { content: [{ type: 'text', text: JSON.stringify(schema, null, 2) }] });
      }

      if (name === 'describe_table') {
        const details = await dbManager.getTableDetails(args.connectionId, args.tableName);
        return sendResponse(id, { content: [{ type: 'text', text: JSON.stringify(details, null, 2) }] });
      }

      if (name === 'preview_table') {
        const data = await dbManager.getData(args.connectionId, args.tableName, { limit: args.limit || 20 });
        return sendResponse(id, { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
      }

      if (name === 'execute_readonly_query') {
        const result = await dbManager.executeQuery(args.connectionId, args.query, true);
        return sendResponse(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
      }

      return sendResponse(id, null, `Unknown tool: ${name}`);
    } catch (err) {
      return sendResponse(id, null, err.message);
    }
  }
});
