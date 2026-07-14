const request = require('supertest');
const app = require('../server');
const db = require('../src/config/db');
const assert = require('assert');

let adminToken = '';
let customerToken = '';
let officeAddressId = '';

async function setup() {
  // Clear tables in dependency order
  await db.query('DELETE FROM order_status_history');
  await db.query('DELETE FROM coupon_usages');
  await db.query('DELETE FROM order_payments');
  await db.query('DELETE FROM order_item_custom_values');
  await db.query('DELETE FROM order_items');
  await db.query('DELETE FROM orders');
  await db.query('DELETE FROM cart_item_custom_values');
  await db.query('DELETE FROM cart_items');
  await db.query('DELETE FROM carts');
  await db.query('DELETE FROM addresses');
  await db.query('DELETE FROM material_shipments');
  await db.query('DELETE FROM office_addresses');
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

  // Generate tokens manually using JWT
  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'creativeart_access_secret_key_2026';
  
  adminToken = jwt.sign({ userId: adminRes.insertId, role: 'ADMIN' }, JWT_SECRET);
  customerToken = jwt.sign({ userId: custRes.insertId, role: 'CUSTOMER' }, JWT_SECRET);
}

async function runTests() {
  console.log('Running Office Address Endpoint Tests...');
  await setup();

  // Test 1: Admin Create Office Address
  console.log('  Testing POST /api/v1/admin/office-addresses...');
  const res1 = await request(app)
    .post('/api/v1/admin/office-addresses')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      label: 'Main HQ Guwahati',
      contactName: 'Nava Kumar',
      contactPhone: '9876543210',
      line1: '123 Assam Road',
      city: 'Guwahati',
      state: 'Assam',
      pincode: '781001',
      country: 'India',
      status: 'ACTIVE'
    });

  assert.strictEqual(res1.status, 201);
  assert.strictEqual(res1.body.success, true);
  officeAddressId = res1.body.data.id;

  // Test 2: Admin Create Office Address (denied to customer)
  console.log('  Testing Customer denied POST /api/v1/admin/office-addresses...');
  const res2 = await request(app)
    .post('/api/v1/admin/office-addresses')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      label: 'Unauthorized HQ',
      contactName: 'Nava Kumar',
      contactPhone: '9876543210',
      line1: '123 Assam Road',
      city: 'Guwahati',
      state: 'Assam',
      pincode: '781001'
    });

  assert.strictEqual(res2.status, 403);

  // Test 3: Public GET /api/v1/office-addresses
  console.log('  Testing GET /api/v1/office-addresses (public list)...');
  const res3 = await request(app)
    .get('/api/v1/office-addresses');

  assert.strictEqual(res3.status, 200);
  assert.strictEqual(res3.body.success, true);
  assert.strictEqual(res3.body.data.length, 1);
  assert.strictEqual(res3.body.data[0].label, 'Main HQ Guwahati');

  // Test 4: Admin GET Single
  console.log('  Testing GET /api/v1/admin/office-addresses/:id...');
  const res4 = await request(app)
    .get(`/api/v1/admin/office-addresses/${officeAddressId}`)
    .set('Authorization', `Bearer ${adminToken}`);

  assert.strictEqual(res4.status, 200);
  assert.strictEqual(res4.body.success, true);
  assert.strictEqual(res4.body.data.contactName, 'Nava Kumar');

  // Test 5: Admin PUT Update
  console.log('  Testing PUT /api/v1/admin/office-addresses/:id...');
  const res5 = await request(app)
    .put(`/api/v1/admin/office-addresses/${officeAddressId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      label: 'Main HQ Guwahati v2',
      contactName: 'Nava Kumar Edit',
      contactPhone: '9876543210',
      line1: '123 Assam Road',
      city: 'Guwahati',
      state: 'Assam',
      pincode: '781001',
      status: 'INACTIVE'
    });

  assert.strictEqual(res5.status, 200);
  
  // Test 6: Verify inactive does not show up in public list
  console.log('  Testing INACTIVE office address not in public list...');
  const res6 = await request(app)
    .get('/api/v1/office-addresses');
  assert.strictEqual(res6.status, 200);
  assert.strictEqual(res6.body.data.length, 0);

  // Test 7: Admin DELETE Office Address
  console.log('  Testing DELETE /api/v1/admin/office-addresses/:id...');
  const res7 = await request(app)
    .delete(`/api/v1/admin/office-addresses/${officeAddressId}`)
    .set('Authorization', `Bearer ${adminToken}`);

  assert.strictEqual(res7.status, 200);

  console.log('All Office Address Endpoint Tests Passed!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Office Address Tests Failed:', err);
  process.exit(1);
});
