const request = require('supertest');
const app = require('../server');
const db = require('../src/config/db');
const assert = require('assert');

let adminToken = '';
let customerToken = '';

async function setup() {
  // Clear tables in dependency order
  await db.query('DELETE FROM settings');
  await db.query('DELETE FROM order_status_history');
  await db.query('DELETE FROM coupon_usages');
  await db.query('DELETE FROM order_payments');
  await db.query('DELETE FROM order_items');
  await db.query('DELETE FROM orders');
  await db.query('DELETE FROM users');

  // Create admin user
  const adminRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role) 
     VALUES (?, ?, ?, ?)`,
    ['Admin User', 'admin@example.com', 'hashedpassword', 'ADMIN']
  );
  
  // Create customer user
  const custRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role) 
     VALUES (?, ?, ?, ?)`,
    ['Customer User', 'customer@example.com', 'hashedpassword', 'CUSTOMER']
  );

  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'creativeart_access_secret_key_2026';
  
  adminToken = jwt.sign({ userId: adminRes.insertId, role: 'ADMIN' }, JWT_SECRET);
  customerToken = jwt.sign({ userId: custRes.insertId, role: 'CUSTOMER' }, JWT_SECRET);
}

async function runTests() {
  console.log('Running Settings Endpoint Tests...');
  await setup();

  // Test 1: Fetch settings initially (empty map)
  console.log('  Testing GET /api/v1/admin/settings...');
  const res1 = await request(app)
    .get('/api/v1/admin/settings')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.body.success, true);
  assert.deepStrictEqual(res1.body.data, {});

  // Test 2: Customer unauthorized to get settings
  const res2 = await request(app)
    .get('/api/v1/admin/settings')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.strictEqual(res2.status, 403);

  // Test 3: Admin update settings
  console.log('  Testing PUT /api/v1/admin/settings...');
  const res3 = await request(app)
    .put('/api/v1/admin/settings')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      stuck_order_sweep_threshold_days: '10',
      shiprocket_pickup_location: 'Guwahati_HQ'
    });

  assert.strictEqual(res3.status, 200);

  // Test 4: Fetch settings and check if updated
  const res4 = await request(app)
    .get('/api/v1/admin/settings')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.strictEqual(res4.status, 200);
  assert.strictEqual(res4.body.data.stuck_order_sweep_threshold_days, '10');
  assert.strictEqual(res4.body.data.shiprocket_pickup_location, 'Guwahati_HQ');

  console.log('All Settings Endpoint Tests Passed!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Settings Tests Failed:', err);
  process.exit(1);
});
