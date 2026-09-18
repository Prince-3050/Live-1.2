/**
 * Abstract Base Class for Database Connectors
 */
class BaseConnector {
  constructor(config) {
    this.config = config;
    this.connection = null;
    this.isConnected = false;
  }

  async connect() {
    throw new Error('connect() method must be implemented');
  }

  async disconnect() {
    throw new Error('disconnect() method must be implemented');
  }

  async testConnection() {
    throw new Error('testConnection() method must be implemented');
  }

  async getSchema() {
    throw new Error('getSchema() method must be implemented');
  }

  async getTableDetails(tableName) {
    throw new Error('getTableDetails() method must be implemented');
  }

  async getData(tableName, options = {}) {
    throw new Error('getData() method must be implemented');
  }

  async executeQuery(queryText) {
    throw new Error('executeQuery() method must be implemented');
  }

  async seedDemoData() {
    throw new Error('seedDemoData() method must be implemented');
  }
}

module.exports = BaseConnector;
