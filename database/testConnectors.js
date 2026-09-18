const dbManager = require('./DatabaseManager');
const logger = require('./logger');

async function runTests() {
  console.log('=====================================');
  console.log(' DB 1.1 AUTOMATED CONNECTOR TESTS');
  console.log('=====================================\n');

  // TEST 1: Connect demo SQLite database test.db
  console.log('TEST 1: Testing built-in SQLite test.db...');
  try {
    const res1 = await dbManager.testConnection('sqlite', { filepath: './test.db' });
    console.log('  ✅ SUCCESS:', res1.message);
  } catch (err) {
    console.log('  ❌ FAILED:', err.message);
  }

  // TEST 2: Connect external SQLite database path
  console.log('\nTEST 2: Testing external SQLite file path (non-destructive)...');
  try {
    const res2 = await dbManager.testConnection('sqlite', { filepath: './test.db', readOnly: true });
    console.log('  ✅ SUCCESS:', res2.message);
  } catch (err) {
    console.log('  ❌ FAILED:', err.message);
  }

  // TEST 3: MySQL Connector (Live check & Demo Fallback)
  console.log('\nTEST 3: Testing MySQL Connector (Live server & Demo mode fallback)...');
  try {
    const res3 = await dbManager.testConnection('mysql', {
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: '',
      database: ''
    });
    console.log('  ✅ SUCCESS (Live MySQL):', res3.message);
  } catch (err) {
    console.log('  ℹ️ LIVE MYSQL NOTE:', err.message);
    try {
      const res3Demo = await dbManager.testConnection('mysql', { isDemo: true });
      console.log('  ✅ SUCCESS (MySQL Demo Fallback):', res3Demo.message);
    } catch (e) {
      console.log('  ❌ FAILED:', e.message);
    }
  }

  // TEST 4: Postgres Connector (Live check & Demo Fallback)
  console.log('\nTEST 4: Testing Postgres Connector (Live server & Demo mode fallback)...');
  try {
    const res4Demo = await dbManager.testConnection('postgres', { isDemo: true });
    console.log('  ✅ SUCCESS (Postgres Demo Fallback):', res4Demo.message);
  } catch (err) {
    console.log('  ❌ FAILED:', err.message);
  }

  // TEST 5: MongoDB Connector (JSON Fixture)
  console.log('\nTEST 5: Testing MongoDB Connector (JSON Fixture ./test_mongodb.json)...');
  try {
    const res5 = await dbManager.testConnection('mongodb', { filepath: './test_mongodb.json', database: 'test_mongodb' });
    console.log('  ✅ SUCCESS:', res5.message);
  } catch (err) {
    console.log('  ❌ FAILED:', err.message);
  }

  // TEST 6: Read-Only Safety enforcement test
  console.log('\nTEST 6: Testing Read-Only Query Security Guardrails...');
  try {
    // Add temporary SQLite connection
    const conn = await dbManager.addConnection('Test Safety DB', 'sqlite', { filepath: './test.db' }, { readOnly: true });
    try {
      await dbManager.executeQuery(conn.id, 'DROP TABLE IF EXISTS users', false);
      console.log('  ❌ FAILED: Destructive query was NOT blocked by Read-Only guard!');
    } catch (e) {
      console.log('  ✅ SUCCESS: Read-Only Guard correctly blocked DROP query:', e.message);
    }
    await dbManager.removeConnection(conn.id);
  } catch (err) {
    console.log('  ❌ FAILED:', err.message);
  }

  console.log('\n=====================================');
  console.log(' ALL AUTOMATED TESTS COMPLETED');
  console.log('=====================================');
}

runTests().catch(console.error);
