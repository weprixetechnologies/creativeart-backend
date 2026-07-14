const request = require('supertest');
const app = require('../server');
const db = require('../src/config/db');
const assert = require('assert');

let userToken = '';
let userId = '';

async function setup() {
  // Clear tables in dependency order
  await db.query('DELETE FROM order_status_history');
  await db.query('DELETE FROM order_payments');
  await db.query('DELETE FROM coupon_usages');
  await db.query('DELETE FROM material_shipments');
  await db.query('DELETE FROM shipments');
  await db.query('DELETE FROM order_item_custom_values');
  await db.query('DELETE FROM order_items');
  await db.query('DELETE FROM orders');
  await db.query('DELETE FROM cart_item_custom_values');
  await db.query('DELETE FROM cart_items');
  await db.query('DELETE FROM carts');
  await db.query('DELETE FROM addresses');
  await db.query('DELETE FROM users');

  // Create customer user
  const userRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role) 
     VALUES (?, ?, ?, ?)`,
    ['Address Test User', 'addressuser@example.com', 'hashedpassword', 'CUSTOMER']
  );
  userId = userRes.insertId;

  // Mock JWT token
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_ACCESS_SECRET || 'creativeart_access_secret_key_2026';
  userToken = jwt.sign({ userId, role: 'CUSTOMER' }, secret, { expiresIn: '1h' });
}

async function runTests() {
  console.log('Running Address Book Endpoint Tests...');
  await setup();

  // Test 1: Create first address (should default to isDefault = true)
  console.log('  Testing first address auto-default...');
  const res1 = await request(app)
    .post('/api/v1/addresses')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      label: 'Home',
      contactName: 'Jane Doe',
      contactPhone: '9876543210',
      line1: '123 Home lane',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      isDefault: false // explicitly false but should be overridden as it is the first address
    });

  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.body.data.isDefault, true);
  const address1Id = res1.body.data.id;

  // Test 2: Create second address
  console.log('  Testing second address creation...');
  const res2 = await request(app)
    .post('/api/v1/addresses')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      label: 'Office',
      contactName: 'Jane Doe',
      contactPhone: '9876543210',
      line1: '456 Office tower',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411002',
      isDefault: false
    });

  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.body.data.isDefault, false);
  const address2Id = res2.body.data.id;

  // Test 3: List addresses
  console.log('  Testing GET /addresses list order...');
  const resGet = await request(app)
    .get('/api/v1/addresses')
    .set('Authorization', `Bearer ${userToken}`);

  assert.strictEqual(resGet.status, 200);
  assert.strictEqual(resGet.body.data.length, 2);
  // Default address should be first
  assert.strictEqual(resGet.body.data[0].id, address1Id);

  // Test 4: Swap defaults (update address 2 as default)
  console.log('  Testing default swap update...');
  const resUpdate = await request(app)
    .put(`/api/v1/addresses/${address2Id}`)
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      label: 'Office HQ',
      contactName: 'Jane Doe',
      contactPhone: '9876543210',
      line1: '456 Office tower',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411002',
      isDefault: true
    });

  assert.strictEqual(resUpdate.status, 200);
  assert.strictEqual(resUpdate.body.data.isDefault, true);

  // Verify address 1 is no longer default
  const resGet2 = await request(app)
    .get('/api/v1/addresses')
    .set('Authorization', `Bearer ${userToken}`);
  
  const addr1 = resGet2.body.data.find(a => a.id === address1Id);
  const addr2 = resGet2.body.data.find(a => a.id === address2Id);
  assert.strictEqual(addr1.isDefault, false);
  assert.strictEqual(addr2.isDefault, true);

  // Test 5: Delete default address (should fallback default to remaining address)
  console.log('  Testing delete address and auto default fallback...');
  const resDelete = await request(app)
    .delete(`/api/v1/addresses/${address2Id}`)
    .set('Authorization', `Bearer ${userToken}`);

  assert.strictEqual(resDelete.status, 200);

  // Verify address 1 is now default
  const resGet3 = await request(app)
    .get('/api/v1/addresses')
    .set('Authorization', `Bearer ${userToken}`);
  
  assert.strictEqual(resGet3.body.data.length, 1);
  assert.strictEqual(resGet3.body.data[0].id, address1Id);
  assert.strictEqual(resGet3.body.data[0].isDefault, true);

  console.log('All Address Book Endpoint Tests Passed!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Address Test Suite Failed:', err);
  process.exit(1);
});
