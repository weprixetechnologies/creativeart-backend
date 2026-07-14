const request = require('supertest');
const app = require('../server');
const db = require('../src/config/db');
const assert = require('assert');

let adminToken = '';
let customerToken = '';

async function setup() {
  // Clear tables in dependency order
  await db.query('DELETE FROM material_shipments');
  await db.query('DELETE FROM order_status_history');
  await db.query('DELETE FROM coupon_usages');
  await db.query('DELETE FROM order_payments');
  await db.query('DELETE FROM shipments');
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

  // Insert a test order with a captured payment to verify KPIs
  const orderRes = await db.query(
    `INSERT INTO orders (order_number, user_id, order_type, status, subtotal, total_amount) 
     VALUES ('ORD-DB-1', ?, 'STANDARD', 'PAID', 1500.00, 1500.00)`,
    [custRes.insertId]
  );

  await db.query(
    `INSERT INTO order_payments (order_id, payment_type, gateway, gateway_order_id, amount, status) 
     VALUES (?, 'FULL', 'PHONEPE', 'phonepe_order_db_1', 1500.00, 'CAPTURED')`,
    [orderRes.insertId]
  );
}

async function runTests() {
  console.log('Running Admin Dashboard KPI & Analytics Endpoint Tests...');
  await setup();

  // Test 1: Fetch dashboard KPIs as admin
  console.log('  Testing GET /api/v1/admin/dashboard/kpis...');
  const res1 = await request(app)
    .get('/api/v1/admin/dashboard/kpis')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.body.success, true);
  assert.strictEqual(parseFloat(res1.body.data.totalRevenue), 1500.00);
  assert.strictEqual(res1.body.data.totalOrders, 1);

  // Test 2: Fetch report graphs
  console.log('  Testing GET /api/v1/admin/dashboard/reports...');
  const res2 = await request(app)
    .get('/api/v1/admin/dashboard/reports')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.strictEqual(res2.status, 200);
  assert.ok(res2.body.data.monthlyRevenue.length > 0);

  // Test 3: Customer unauthorized to get KPIs
  const res3 = await request(app)
    .get('/api/v1/admin/dashboard/kpis')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.strictEqual(res3.status, 403);

  console.log('All Admin Dashboard KPI Tests Passed!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Dashboard Tests Failed:', err);
  process.exit(1);
});
