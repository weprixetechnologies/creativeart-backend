const request = require('supertest');
const app = require('../server');
const db = require('../src/config/db');
const assert = require('assert');
const localQueue = require('../src/utils/queue');

let adminToken = '';
let orderId = '';

async function setup() {
  await db.query('DELETE FROM order_status_history');
  await db.query('DELETE FROM coupon_usages');
  await db.query('DELETE FROM order_payments');
  await db.query('DELETE FROM notification_logs');
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

  // Insert a test order
  const orderRes = await db.query(
    `INSERT INTO orders (order_number, user_id, order_type, status, subtotal, total_amount) 
     VALUES ('ORD-NT-1', ?, 'STANDARD', 'PLACED', 500.00, 500.00)`,
    [custRes.insertId]
  );
  orderId = orderRes.insertId;
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('Running Admin Notifications CRUD & Dispatch Tests...');
  await setup();

  // Test 1: Fetch templates
  console.log('  Testing GET /api/v1/admin/notifications/templates...');
  const res1 = await request(app)
    .get('/api/v1/admin/notifications/templates')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.strictEqual(res1.status, 200);
  assert.ok(res1.body.data.length > 0); // We seeded basic ones

  // Test 2: Trigger state transition (PAID) and check notification dispatch logs
  console.log('  Testing transition to PAID enqueues & dispatches notification...');
  // We transition the order to PAID which generates an invoice and sends ORDER_PAID notification
  const stateMachine = require('../src/services/order-state-machine.service');
  await stateMachine.transition(orderId, 'PAID', { actorType: 'SYSTEM' });

  // Wait a short bit for the setImmediate queue to process
  await sleep(1000);

  // Fetch logs
  const res2 = await request(app)
    .get('/api/v1/admin/notifications/logs')
    .set('Authorization', `Bearer ${adminToken}`);

  assert.strictEqual(res2.status, 200);
  const orderLogs = res2.body.data.filter(l => Number(l.orderId) === Number(orderId));
  assert.ok(orderLogs.length > 0, 'Should have enqueued notification logs for the order.');
  assert.strictEqual(orderLogs[0].status, 'SENT');

  console.log('All Admin Notifications Tests Passed Successfully!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Notification Tests Failed:', err);
  process.exit(1);
});
