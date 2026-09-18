const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const BaseConnector = require('./BaseConnector');

class MongoDBConnector extends BaseConnector {
  constructor(config) {
    super(config);
    this.uri = config.uri || config.connectionString || `mongodb://${config.host || '127.0.0.1'}:${config.port || 27017}`;
    this.dbName = config.database || config.dbName || 'test_mongodb';
    this.client = null;
    this.db = null;
    this.isDemo = Boolean(config.isDemo || config.filepath || this.dbName === 'test_mongodb' || this.uri.includes('test_mongodb'));
    this.useFallback = false;
  }

  async connect() {
    if (this.isDemo || this.config.filepath) {
      this.useFallback = true;
      this.isConnected = true;
      return true;
    }
    try {
      this.client = new MongoClient(this.uri, { serverSelectionTimeoutMS: 3000 });
      await this.client.connect();
      this.db = this.client.db(this.dbName);
      this.isConnected = true;
      this.useFallback = false;
      return true;
    } catch (err) {
      // If connecting to demo/test database failed, gracefully fall back to local test_mongodb.json
      if (this.dbName === 'test_mongodb' || this.isDemo) {
        this.useFallback = true;
        this.isConnected = true;
        return true;
      }
      this.isConnected = false;
      if (err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT')) {
        throw new Error(`MongoDB service is not running or cannot be reached at ${this.uri}. (Tip: To test without a live Mongo server, select 'Demo Fixture DB' or use path './test_mongodb.json').`);
      }
      throw new Error(`MongoDB Server Error (${this.uri}): ${err.message}`);
    }
  }

  async disconnect() {
    if (this.client) {
      try {
        await this.client.close();
      } catch (e) {}
      this.client = null;
      this.db = null;
    }
    this.isConnected = false;
    return true;
  }

  async testConnection() {
    if (this.isDemo || this.config.filepath || this.dbName === 'test_mongodb') {
      return { success: true, message: 'Connected to Local MongoDB Fixture File (./test_mongodb.json)' };
    }
    const testClient = new MongoClient(this.uri, { serverSelectionTimeoutMS: 3000 });
    try {
      await testClient.connect();
      await testClient.db(this.dbName).command({ ping: 1 });
      await testClient.close();
      return { success: true, message: `Successfully connected to MongoDB database "${this.dbName}" at ${this.uri}` };
    } catch (err) {
      try { await testClient.close(); } catch (e) {}
      if (this.dbName === 'test_mongodb' || this.isDemo) {
        return { success: true, message: 'Connected to Local MongoDB Fixture File (./test_mongodb.json)' };
      }
      if (err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT')) {
        throw new Error(`MongoDB service is not running or cannot be reached at ${this.uri}. (Tip: Select 'Demo Fixture DB' or use preset './test_mongodb.json').`);
      }
      throw new Error(`MongoDB Connection Failed (${this.uri}): ${err.message}`);
    }
  }

  inferFieldType(value) {
    if (value === null || value === undefined) return 'Null';
    if (Array.isArray(value)) return 'Array';
    if (value instanceof Date) return 'Date';
    if (typeof value === 'object') {
      if (value._bsontype === 'ObjectID' || value.toHexString) return 'ObjectId';
      return 'Object';
    }
    return typeof value === 'string' ? 'String' : typeof value === 'number' ? 'Number' : typeof value === 'boolean' ? 'Boolean' : 'Unknown';
  }

  loadFallbackJson() {
    try {
      const p = path.resolve(process.cwd(), './test_mongodb.json');
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
      }
    } catch (e) {}
    return {
      users: [
        { _id: "u1", name: "Alice Johnson", email: "alice@mongodb-demo.com", role: "admin" },
        { _id: "u2", name: "Bob Smith", email: "bob@mongodb-demo.com", role: "developer" }
      ],
      products: [
        { _id: "p1", title: "Developer Laptop Pro 16\"", category: "Electronics", price: 2499.99 }
      ],
      orders: [
        { _id: "o1", userEmail: "alice@mongodb-demo.com", totalAmount: 2649.49, status: "completed" }
      ],
      audit_logs: [
        { _id: "a1", action: "MONGODB_INIT", details: "MongoDB JSON database initialized." }
      ]
    };
  }

  async getSchema() {
    if (this.useFallback || this.isDemo) {
      const data = this.loadFallbackJson();
      const result = Object.keys(data).map(key => {
        const docs = data[key] || [];
        const sample = docs[0] || {};
        const columns = Object.keys(sample).map(k => ({
          name: k,
          type: this.inferFieldType(sample[k]),
          primaryKey: k === '_id'
        }));
        return {
          name: key,
          type: 'collection',
          columnsCount: columns.length,
          rowCount: docs.length,
          columns
        };
      });
      return { database: 'test_mongodb', tables: result };
    }

    if (!this.isConnected) await this.connect();

    const collections = await this.db.listCollections().toArray();
    const result = [];

    for (const col of collections) {
      const collectionName = col.name;
      const count = await this.db.collection(collectionName).countDocuments();
      const sample = await this.db.collection(collectionName).findOne();

      const columns = [];
      if (sample) {
        Object.keys(sample).forEach(key => {
          columns.push({
            name: key,
            type: this.inferFieldType(sample[key]),
            primaryKey: key === '_id'
          });
        });
      }

      result.push({
        name: collectionName,
        type: 'collection',
        columnsCount: columns.length,
        rowCount: count,
        columns
      });
    }

    return { database: this.dbName, tables: result };
  }

  async getTableDetails(collectionName) {
    if (this.useFallback || this.isDemo) {
      const data = this.loadFallbackJson();
      const docs = data[collectionName] || [];
      const fieldsMap = new Map();
      docs.forEach(doc => {
        Object.keys(doc).forEach(key => {
          if (!fieldsMap.has(key)) {
            fieldsMap.set(key, {
              name: key,
              type: this.inferFieldType(doc[key]),
              nullable: false,
              primaryKey: key === '_id'
            });
          }
        });
      });
      return {
        tableName: collectionName,
        rowCount: docs.length,
        columns: Array.from(fieldsMap.values()),
        indexes: [{ name: '_id_', unique: true, key: { _id: 1 } }],
        sampleData: docs.slice(0, 20)
      };
    }

    if (!this.isConnected) await this.connect();

    const collection = this.db.collection(collectionName);
    const count = await collection.countDocuments();
    const samples = await collection.find().limit(10).toArray();

    // Infer fields from sample documents
    const fieldsMap = new Map();
    samples.forEach(doc => {
      Object.keys(doc).forEach(key => {
        if (!fieldsMap.has(key)) {
          fieldsMap.set(key, {
            name: key,
            type: this.inferFieldType(doc[key]),
            nullable: false,
            primaryKey: key === '_id'
          });
        }
      });
    });

    const indexesRaw = await collection.indexes();
    const indexes = indexesRaw.map(idx => ({
      name: idx.name,
      unique: Boolean(idx.unique),
      key: idx.key
    }));

    const sampleData = samples.slice(0, 20);

    return {
      tableName: collectionName,
      rowCount: count,
      columns: Array.from(fieldsMap.values()),
      indexes,
      sampleData
    };
  }

  async getData(collectionName, options = {}) {
    if (this.useFallback || this.isDemo) {
      const data = this.loadFallbackJson();
      const docs = data[collectionName] || [];
      const limit = options.limit || 20;
      const offset = options.offset || 0;
      return docs.slice(offset, offset + limit);
    }

    if (!this.isConnected) await this.connect();
    const limit = options.limit || 20;
    const offset = options.offset || 0;

    return await this.db.collection(collectionName)
      .find()
      .skip(offset)
      .limit(limit)
      .toArray();
  }

  async executeQuery(queryText) {
    if (this.useFallback || this.isDemo) {
      const startTime = Date.now();
      let parsed;
      try {
        parsed = JSON.parse(queryText);
      } catch (e) {
        throw new Error(`MongoDB queries should be in JSON format, e.g. {"collection": "users", "action": "find", "query": {}}`);
      }
      const { collection, limit = 50 } = parsed;
      const data = this.loadFallbackJson();
      const rows = (data[collection] || []).slice(0, limit);
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      return {
        type: 'MONGO_QUERY',
        columns,
        rows,
        rowCount: rows.length,
        executionTimeMs: Date.now() - startTime
      };
    }

    if (!this.isConnected) await this.connect();
    const startTime = Date.now();

    let parsed;
    try {
      parsed = JSON.parse(queryText);
    } catch (e) {
      throw new Error(`MongoDB queries should be in JSON format, e.g. {"collection": "users", "action": "find", "query": {}}`);
    }

    const { collection, action = 'find', query = {}, limit = 50 } = parsed;

    if (!collection) {
      throw new Error(`Missing "collection" property in MongoDB JSON query`);
    }

    const col = this.db.collection(collection);
    let rows = [];

    if (action === 'find') {
      rows = await col.find(query).limit(limit).toArray();
    } else if (action === 'count') {
      const cnt = await col.countDocuments(query);
      rows = [{ count: cnt }];
    } else if (action === 'aggregate') {
      rows = await col.aggregate(Array.isArray(query) ? query : []).toArray();
    } else {
      throw new Error(`Unsupported MongoDB action "${action}". Supported: find, count, aggregate`);
    }

    const executionTimeMs = Date.now() - startTime;
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      type: 'MONGO_QUERY',
      columns,
      rows,
      rowCount: rows.length,
      executionTimeMs
    };
  }

  async seedDemoData() {
    if (this.useFallback || this.isDemo) {
      return { success: true, message: 'MongoDB test_mongodb.json is already populated with sample collections.' };
    }
    if (!this.isConnected) await this.connect();
    
    const usersCol = this.db.collection('users');
    const count = await usersCol.countDocuments();
    if (count === 0) {
      await usersCol.insertMany([
        { name: 'Alice Johnson', email: 'alice@mongodb.com', role: 'admin', createdAt: new Date() },
        { name: 'Bob Smith', email: 'bob@mongodb.com', role: 'developer', createdAt: new Date() },
        { name: 'Charlie Brown', email: 'charlie@mongodb.com', role: 'user', createdAt: new Date() }
      ]);

      await this.db.collection('products').insertMany([
        { title: 'Developer Laptop Pro 16"', category: 'Electronics', price: 2499.99, stock: 45 },
        { title: 'Ergonomic Mechanical Keyboard', category: 'Peripherals', price: 149.50, stock: 120 },
        { title: '4K UltraHD Monitor 32"', category: 'Electronics', price: 699.00, stock: 30 }
      ]);

      await this.db.collection('orders').insertMany([
        { userEmail: 'alice@mongodb.com', totalAmount: 2649.49, status: 'completed' },
        { userEmail: 'bob@mongodb.com', totalAmount: 149.50, status: 'shipped' }
      ]);

      await this.db.collection('audit_logs').insertMany([
        { action: 'MONGODB_SEED', details: 'MongoDB demo database collections seeded successfully.' }
      ]);
    }

    return { success: true, message: 'MongoDB demo collections seeded successfully' };
  }
}

module.exports = MongoDBConnector;
