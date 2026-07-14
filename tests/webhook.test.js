const request = require('supertest');
const app = require('../server');
const db = require('../src/config/db');
const assert = require('assert');
const crypto = require('crypto');

let userId = '';
let standardOrderId = '';
let dualOrderId = '';

const gatewayOrderStd = 'order_std_mock_123';
const gatewayOrderDual = 'order_dual_mock_456';

function buildMockPhonepeWebhook(merchantTransactionId, code) {
  const payload = {
    merchantId: 'PGTESTPAYUAT86',
    merchantTransactionId,
    amount: 100000,
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
  // Clear tables in dependency order
  await db.query('DELETE FROM coupon_usages');
  await db.query('DELETE FROM order_payments');
  await db.query('DELETE FROM order_status_history');
  await db.query('DELETE FROM order_items');
  await db.query('DELETE FROM orders');
  await db.query('DELETE FROM users');

  // Create customer user
  const userRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role) 
     VALUES (?, ?, ?, ?)`,
    ['Webhook Test User', 'webhookuser@example.com', 'hashedpassword', 'CUSTOMER']
  );
  userId = userRes.insertId;

  // Create STANDARD order with status PLACED
  const stdOrderRes = await db.query(
    `INSERT INTO orders (order_number, user_id, order_type, status, subtotal, total_amount) 
     VALUES ('ORD-STD-W1', ?, 'STANDARD', 'PLACED', 1000.00, 1000.00)`,
    [userId]
  );
  standardOrderId = stdOrderRes.insertId;

  // Insert standard payment record in CREATED status
  await db.query(
    `INSERT INTO order_payments (order_id, payment_type, gateway, gateway_order_id, gateway_payment_id, amount, status) 
     VALUES (?, 'FULL', 'PHONEPE', ?, ?, 1000.00, 'CREATED')`,
    [standardOrderId, gatewayOrderStd, gatewayOrderStd]
  );

  // Create DUAL_PAYMENT order with status BOOKED_PENDING_ADVANCE
  const dualOrderRes = await db.query(
    `INSERT INTO orders (order_number, user_id, order_type, status, subtotal, total_amount, advance_amount, final_amount) 
     VALUES ('ORD-DUAL-W1', ?, 'DUAL_PAYMENT', 'BOOKED_PENDING_ADVANCE', 5000.00, 5000.00, 2000.00, 3000.00)`,
    [userId]
  );
  dualOrderId = dualOrderRes.insertId;

  // Insert dual-payment payment record in CREATED status
  await db.query(
    `INSERT INTO order_payments (order_id, payment_type, gateway, gateway_order_id, gateway_payment_id, amount, status) 
     VALUES (?, 'ADVANCE', 'PHONEPE', ?, ?, 2000.00, 'CREATED')`,
    [dualOrderId, gatewayOrderDual, gatewayOrderDual]
  );
}

async function runTests() {
  console.log('Running Webhook Endpoint Tests...');
  await setup();

  // Test 1: Handle PAYMENT_SUCCESS for standard order
  console.log('  Testing standard PAYMENT_SUCCESS webhook...');
  const webhookData1 = buildMockPhonepeWebhook(gatewayOrderStd, 'PAYMENT_SUCCESS');
  const res1 = await request(app)
    .post('/api/v1/webhooks/phonepe')
    .set('x-verify', webhookData1.xVerify)
    .set('Content-Type', 'application/json')
    .send(webhookData1.rawBodyStr);

  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.body.success, true);

  // Check database order state transitioned to PAID
  const [orderStd] = await db.query("SELECT status FROM orders WHERE id = ?", [standardOrderId]);
  assert.strictEqual(orderStd.status, 'PAID');

  // Check payment updated to CAPTURED
  const [payStd] = await db.query("SELECT status, gateway_payment_id FROM order_payments WHERE gateway_order_id = ?", [gatewayOrderStd]);
  assert.strictEqual(payStd.status, 'CAPTURED');
  assert.strictEqual(payStd.gateway_payment_id, gatewayOrderStd);

  // Test 2: Webhook Idempotency (Double delivery check)
  console.log('  Testing duplicate webhook delivery idempotency...');
  const webhookData2 = buildMockPhonepeWebhook(gatewayOrderStd, 'PAYMENT_SUCCESS');
  const res2 = await request(app)
    .post('/api/v1/webhooks/phonepe')
    .set('x-verify', webhookData2.xVerify)
    .set('Content-Type', 'application/json')
    .send(webhookData2.rawBodyStr);

  assert.strictEqual(res2.status, 200);
  assert.ok(res2.body.message.includes('Idempotent'));

  // Ensure no double entries in order status history for PAID
  const history = await db.query(
    "SELECT COUNT(*) as count FROM order_status_history WHERE order_id = ? AND to_status = 'PAID'",
    [standardOrderId]
  );
  assert.strictEqual(parseInt(history[0].count, 10), 1);

  // Test 3: Dual-payment advance webhook auto-transition checking
  console.log('  Testing dual-payment advance capture auto-transitions...');
  const webhookData3 = buildMockPhonepeWebhook(gatewayOrderDual, 'PAYMENT_SUCCESS');
  const res3 = await request(app)
    .post('/api/v1/webhooks/phonepe')
    .set('x-verify', webhookData3.xVerify)
    .set('Content-Type', 'application/json')
    .send(webhookData3.rawBodyStr);

  assert.strictEqual(res3.status, 200);
  assert.strictEqual(res3.body.success, true);

  // Verify order transitioned past ADVANCE_PAID directly to AWAITING_MATERIAL_DISPATCH
  const [orderDual] = await db.query("SELECT status FROM orders WHERE id = ?", [dualOrderId]);
  assert.strictEqual(orderDual.status, 'AWAITING_MATERIAL_DISPATCH');

  // Verify payment record updated to CAPTURED
  const [payDual] = await db.query("SELECT status FROM order_payments WHERE gateway_order_id = ?", [gatewayOrderDual]);
  assert.strictEqual(payDual.status, 'CAPTURED');

  console.log('All Webhook Endpoint Tests Passed!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Webhook Test Suite Failed:', err);
  process.exit(1);
});
