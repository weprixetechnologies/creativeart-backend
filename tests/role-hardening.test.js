const request = require('supertest');
const app = require('../server');
const db = require('../src/config/db');
const assert = require('assert');

let prodStaffToken = '';
let packStaffToken = '';
let customerToken = '';

async function setup() {
  await db.query('DELETE FROM order_status_history');
  await db.query('DELETE FROM coupon_usages');
  await db.query('DELETE FROM order_payments');
  await db.query('DELETE FROM shipments');
  await db.query('DELETE FROM order_items');
  await db.query('DELETE FROM orders');
  await db.query('DELETE FROM users');

  // Create staff users
  const prodStaff = await db.query(
    `INSERT INTO users (name, email, password_hash, role) 
     VALUES (?, ?, ?, ?)`,
    ['Prod Staff', 'prod@example.com', 'hashedpassword', 'STAFF_PRODUCTION']
  );
  
  const packStaff = await db.query(
    `INSERT INTO users (name, email, password_hash, role) 
     VALUES (?, ?, ?, ?)`,
    ['Pack Staff', 'pack@example.com', 'hashedpassword', 'STAFF_PACKAGING']
  );

  const customer = await db.query(
    `INSERT INTO users (name, email, password_hash, role) 
     VALUES (?, ?, ?, ?)`,
    ['Customer', 'customer@example.com', 'hashedpassword', 'CUSTOMER']
  );

  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'creativeart_access_secret_key_2026';
  
  prodStaffToken = jwt.sign({ userId: prodStaff.insertId, role: 'STAFF_PRODUCTION' }, JWT_SECRET);
  packStaffToken = jwt.sign({ userId: packStaff.insertId, role: 'STAFF_PACKAGING' }, JWT_SECRET);
  customerToken = jwt.sign({ userId: customer.insertId, role: 'CUSTOMER' }, JWT_SECRET);
}

async function runTests() {
  console.log('Running Role Hardening & Negative Permission Tests...');
  await setup();

  // Test 1: STAFF_PRODUCTION denied access to list all orders (ADMIN only)
  console.log('  Testing STAFF_PRODUCTION denied access to list all orders...');
  const res1 = await request(app)
    .get('/api/v1/admin/orders')
    .set('Authorization', `Bearer ${prodStaffToken}`);
  assert.strictEqual(res1.status, 403);

  // Test 2: STAFF_PRODUCTION denied access to mark-packed (STAFF_PACKAGING / ADMIN only)
  console.log('  Testing STAFF_PRODUCTION denied access to mark-packed...');
  const res2 = await request(app)
    .post('/api/v1/admin/orders/999/mark-packed')
    .set('Authorization', `Bearer ${prodStaffToken}`);
  assert.strictEqual(res2.status, 403);

  // Test 3: STAFF_PACKAGING denied access to start production (STAFF_PRODUCTION / ADMIN only)
  console.log('  Testing STAFF_PACKAGING denied access to start production...');
  const res3 = await request(app)
    .post('/api/v1/admin/orders/999/start-production')
    .set('Authorization', `Bearer ${packStaffToken}`);
  assert.strictEqual(res3.status, 403);

  // Test 4: STAFF_PACKAGING denied access to materials inbox (STAFF_PRODUCTION / ADMIN only)
  console.log('  Testing STAFF_PACKAGING denied access to materials-inbox...');
  const res4 = await request(app)
    .get('/api/v1/admin/orders/materials-inbox')
    .set('Authorization', `Bearer ${packStaffToken}`);
  assert.strictEqual(res4.status, 403);

  // Test 5: Customer denied access to any admin order routes
  console.log('  Testing Customer denied access to admin routes...');
  const res5 = await request(app)
    .get('/api/v1/admin/orders/materials-inbox')
    .set('Authorization', `Bearer ${customerToken}`);
  assert.strictEqual(res5.status, 403);

  console.log('All Role Hardening & Negative Tests Passed Successfully!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Role Hardening Tests Failed:', err);
  process.exit(1);
});
