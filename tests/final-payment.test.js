const request = require('supertest');
const app = require('../server');
const db = require('../src/config/db');
const assert = require('assert');
const crypto = require('crypto');

let userId = '';
let token = '';
let orderId = '';
let gatewayOrderId = '';

function buildMockPhonepeWebhook(merchantTransactionId, code) {
  const payload = {
    merchantId: 'PGTESTPAYUAT86',
    merchantTransactionId,
    amount: 300000,
    state: code === 'PAYMENT_SUCCESS' ? 'COMPLETED' : 'FAILED',
    code
  };
  const base64Response = Buffer.from(JSON.stringify(payload)).toString('base64');
  const body = { response: base64Response };
  const rawBodyStr = JSON.stringify(body);
  
  // Calculate signature
  const key = '96434309-7796-489d-8924-ab56988a6076';
  const computedHash = crypto
    .createHash('sha256')
    .update(base64Response + key)
    .digest('hex');
  const xVerify = `${computedHash}###1`;
  
  return {
    rawBodyStr,
    xVerify
  };
}

async function setup() {
  // Clear tables
  await db.query('DELETE FROM material_shipments');
  await db.query('DELETE FROM shipments');
  await db.query('DELETE FROM order_status_history');
  await db.query('DELETE FROM coupon_usages');
  await db.query('DELETE FROM order_payments');
  await db.query('DELETE FROM order_items');
  await db.query('DELETE FROM orders');
  await db.query('DELETE FROM users');

  // Create user
  const userRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role) 
     VALUES (?, ?, ?, ?)`,
    ['Final Pay Test User', 'finalpay@example.com', 'hashedpassword', 'CUSTOMER']
  );
  userId = userRes.insertId;

  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'creativeart_access_secret_key_2026';
  token = jwt.sign({ userId, role: 'CUSTOMER' }, JWT_SECRET);

  // Create order in READY_PENDING_FINAL_PAYMENT
  const orderRes = await db.query(
    `INSERT INTO orders (order_number, user_id, order_type, status, subtotal, total_amount, advance_amount, final_amount) 
     VALUES ('ORD-FP-1', ?, 'DUAL_PAYMENT', 'READY_PENDING_FINAL_PAYMENT', 5000.00, 5000.00, 2000.00, 3000.00)`,
    [userId]
  );
  orderId = orderRes.insertId;

  // Insert initial history
  await db.query(
    `INSERT INTO order_status_history (order_id, from_status, to_status, actor_type) 
     VALUES (?, NULL, 'READY_PENDING_FINAL_PAYMENT', 'SYSTEM')`,
    [orderId]
  );
}

async function runTests() {
  console.log('Running Custom Project Final Payment Endpoint Tests...');
  await setup();

  // Test 1: Initiate Final Payment
  console.log('  Testing POST /api/v1/orders/:id/final-payment...');
  const res1 = await request(app)
    .post(`/api/v1/orders/${orderId}/final-payment`)
    .set('Authorization', `Bearer ${token}`);

  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.body.success, true);
  assert.ok(res1.body.data.checkoutUrl);
  
  // Find generated gateway transaction ID from DB
  const payments = await db.query("SELECT gateway_order_id FROM order_payments WHERE order_id = ? AND payment_type = 'FINAL'", [orderId]);
  assert.ok(payments.length > 0);
  gatewayOrderId = payments[0].gateway_order_id;

  // Test 2: Webhook payment captured for FINAL payment type
  console.log('  Testing PhonePe webhook capture for FINAL payment...');
  const webhookData = buildMockPhonepeWebhook(gatewayOrderId, 'PAYMENT_SUCCESS');
  const res2 = await request(app)
    .post('/api/v1/webhooks/phonepe')
    .set('x-verify', webhookData.xVerify)
    .set('Content-Type', 'application/json')
    .send(webhookData.rawBodyStr);

  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.body.success, true);

  // Check order transitioned to FINAL_PAID
  const [order] = await db.query("SELECT status FROM orders WHERE id = ?", [orderId]);
  assert.strictEqual(order.status, 'FINAL_PAID');

  console.log('All Custom Project Final Payment Endpoint Tests Passed!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Final Payment Tests Failed:', err);
  process.exit(1);
});
